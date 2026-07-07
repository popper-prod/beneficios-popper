import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db';
import { buscarEmpleadoPorDni, naalooToBeneficiario } from '../services/naaloo';
import { canjearLimiter, beneficiarioLimiter, publicLimiter } from '../middleware/rateLimit';

const router = Router();

// Rate limiting global para todos los endpoints públicos
router.use(publicLimiter);

// Migración lazy idempotente: `verificaciones.beneficiario_dni` era VARCHAR(8), que
// desborda con DNIs de extranjeros/CUIT (>8 chars) y hace fallar el INSERT del canje
// ("value too long for type character varying(8)"). Lo ensanchamos a VARCHAR(20).
let verifDniEnsured = false;
async function ensureVerifDniWidth() {
  if (verifDniEnsured) return;
  try {
    await query(`ALTER TABLE verificaciones ALTER COLUMN beneficiario_dni TYPE VARCHAR(20)`);
    verifDniEnsured = true;
  } catch (e: any) {
    console.error(`ensureVerifDniWidth: no se pudo ensanchar beneficiario_dni — ${e.message}`);
  }
}

// GET /api/public/comercio/:qrCode - Info del comercio por QR code
router.get('/comercio/:qrCode', async (req: Request, res: Response) => {
  try {
    const { qrCode } = req.params;

    // COALESCE para que devuelva null si la columna logo aun no existe (migracion lazy)
    const result = await query(
      `SELECT c.id, c.nombre, c.direccion, c.ciudad, c.telefono, c.horario_apertura, c.horario_cierre, c.responsable,
              CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='comercios' AND column_name='logo')
                THEN (SELECT logo FROM comercios WHERE qr_code = $1 AND activo = TRUE LIMIT 1)
                ELSE NULL END as logo
       FROM comercios c WHERE c.qr_code = $1 AND c.activo = TRUE`,
      [qrCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comercio no encontrado' });
    }

    res.json({ comercio: result.rows[0] });
  } catch (error) {
    console.error('Error buscando comercio:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ============================================
// MODO VITRINA (TV) — para plasmas en comercios y oficinas.
// Solo catálogo público: nombres de beneficios, descuentos y comercios.
// NUNCA datos personales de beneficiarios.
// ============================================

// % máximo alcanzable de un beneficio (para mostrar "Hasta X%" en cartelera).
// Recorre la escala de descuentos si existe; si no, usa el % base.
function descuentoMaximo(b: any): number | null {
  let max = b.descuento != null ? Number(b.descuento) : null;
  const esc = b.escala_descuentos;
  if (esc && typeof esc === 'object') {
    const candidatos: number[] = [];
    for (const key of ['tiers', 'titular', 'familiar']) {
      const arr = (esc as any)[key];
      if (Array.isArray(arr)) {
        for (const t of arr) if (t?.porcentaje != null) candidatos.push(Number(t.porcentaje));
      }
    }
    if ((esc as any).talento_porcentaje != null) candidatos.push(Number((esc as any).talento_porcentaje));
    for (const c of candidatos) {
      if (!isNaN(c) && (max == null || c > max)) max = c;
    }
  }
  return max != null && !isNaN(max) ? max : null;
}

const TV_BENEFICIO_FIELDS = `b.id, b.nombre, b.descripcion, b.tipo, b.descuento, b.valor_fijo,
       b.categoria, b.origen, b.aplica_a, b.escala_descuentos,
       b.horario_inicio, b.horario_fin, b.restricciones, b.excluye_outlet`;

function tvBeneficioView(b: any) {
  return {
    id: b.id,
    nombre: b.nombre,
    descripcion: b.descripcion,
    tipo: b.tipo,
    descuento: b.descuento != null ? Number(b.descuento) : null,
    descuento_max: descuentoMaximo(b),
    valor_fijo: b.valor_fijo != null ? Number(b.valor_fijo) : null,
    categoria: b.categoria,
    origen: b.origen,
    aplica_a: b.aplica_a,
    horario_inicio: b.horario_inicio,
    horario_fin: b.horario_fin,
    restricciones: b.restricciones,
    excluye_outlet: b.excluye_outlet,
  };
}

// GET /api/public/tv/:qrCode — vitrina de un comercio: sus beneficios vigentes.
// No filtra por horario del día: el plasma anuncia el beneficio aunque todavía no abra.
router.get('/tv/:qrCode', async (req: Request, res: Response) => {
  try {
    const { qrCode } = req.params;
    const comercioRes = await query(
      `SELECT c.id, c.nombre, c.direccion, c.ciudad,
              CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='comercios' AND column_name='logo')
                THEN (SELECT logo FROM comercios WHERE qr_code = $1 AND activo = TRUE LIMIT 1)
                ELSE NULL END as logo
       FROM comercios c WHERE c.qr_code = $1 AND c.activo = TRUE`,
      [qrCode]
    );
    if (comercioRes.rows.length === 0) {
      return res.status(404).json({ error: 'Comercio no encontrado' });
    }
    const comercio = comercioRes.rows[0];

    const beneficiosRes = await query(
      `SELECT ${TV_BENEFICIO_FIELDS}
       FROM beneficios b
       INNER JOIN comercio_beneficios cb ON cb.beneficio_id = b.id
       WHERE cb.comercio_id = $1 AND b.activo = TRUE
         AND (b.fecha_inicio IS NULL OR b.fecha_inicio <= NOW())
         AND (b.fecha_fin   IS NULL OR b.fecha_fin   >= NOW())
       ORDER BY b.nombre`,
      [comercio.id]
    );

    res.json({
      comercio: { id: comercio.id, nombre: comercio.nombre, direccion: comercio.direccion, ciudad: comercio.ciudad, logo: comercio.logo },
      qr_code: qrCode,
      beneficios: beneficiosRes.rows.map(tvBeneficioView),
    });
  } catch (error) {
    console.error('Error en vitrina TV comercio:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/public/tv — cartelera general (oficinas): todos los beneficios vigentes
// con los comercios donde canjearlos.
router.get('/tv', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT ${TV_BENEFICIO_FIELDS},
              COALESCE(json_agg(DISTINCT c.nombre) FILTER (WHERE c.id IS NOT NULL), '[]') as comercios
       FROM beneficios b
       LEFT JOIN comercio_beneficios cb ON cb.beneficio_id = b.id
       LEFT JOIN comercios c ON c.id = cb.comercio_id AND c.activo = TRUE
       WHERE b.activo = TRUE
         AND (b.fecha_inicio IS NULL OR b.fecha_inicio <= NOW())
         AND (b.fecha_fin   IS NULL OR b.fecha_fin   >= NOW())
       GROUP BY b.id
       ORDER BY b.categoria NULLS LAST, b.nombre`
    );

    res.json({
      beneficios: result.rows.map((b: any) => ({ ...tvBeneficioView(b), comercios: b.comercios || [] })),
    });
  } catch (error) {
    console.error('Error en cartelera TV general:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// V3H: lista de adultos autorizados a retirar para un menor.
// Incluye al titular y a todos los familiares activos del titular que sean adultos
// (edad >= 18 o sin fecha_nacimiento — asumimos adulto por default).
// Excluye al propio menor.
async function getAdultosAutorizados(titularId: string, dniMenor: string): Promise<any[]> {
  try {
    const titularRes = await query(
      `SELECT dni, nombre, apellido, 'Titular' as relacion FROM beneficiarios WHERE id=$1`,
      [titularId]
    );
    const familiaresRes = await query(
      `SELECT dni, nombre_completo as nombre, '' as apellido, relacion, fecha_nacimiento
       FROM familiares WHERE beneficiario_id=$1 AND activo=TRUE AND dni != $2`,
      [titularId, dniMenor]
    ).catch(() => ({ rows: [] }));

    const hoy = new Date();
    const adultos: any[] = [];
    for (const t of titularRes.rows) adultos.push({ ...t, esTitular: true });
    for (const f of familiaresRes.rows) {
      let esAdulto = true;
      if (f.fecha_nacimiento) {
        const fn = new Date(f.fecha_nacimiento);
        if (!isNaN(fn.getTime())) {
          let edad = hoy.getFullYear() - fn.getFullYear();
          const m = hoy.getMonth() - fn.getMonth();
          if (m < 0 || (m === 0 && hoy.getDate() < fn.getDate())) edad--;
          esAdulto = edad >= 18;
        }
      }
      if (esAdulto) adultos.push({ dni: f.dni, nombre: f.nombre, apellido: '', relacion: f.relacion });
    }
    return adultos;
  } catch {
    return [];
  }
}

// Calcular % aplicable de un beneficio dado el titular (antiguedad + talento)
function calcularDescuentoAplicable(
  beneficio: any,
  antiguedadMeses: number,
  esTalento: boolean,
  esFamiliar?: boolean,
): { porcentaje: number | null; tipo: 'gratuito' | 'descuento' | null } {
  if (beneficio.escala_descuentos) {
    const escala = typeof beneficio.escala_descuentos === 'string'
      ? JSON.parse(beneficio.escala_descuentos)
      : beneficio.escala_descuentos;

    // Skipass/acceso: tiers explícitos titular vs familiar
    if (escala.titular != null || escala.familiar != null) {
      if (esFamiliar && escala.familiar != null) {
        const p = escala.familiar.porcentaje ?? null;
        return { porcentaje: p, tipo: escala.familiar.tipo === 'gratuito' ? 'gratuito' : 'descuento' };
      }
      if (!esFamiliar && escala.titular != null) {
        const tipo = escala.titular.tipo === 'gratuito' ? 'gratuito' : 'descuento';
        const p = tipo === 'gratuito' ? 100 : (escala.titular.porcentaje ?? null);
        return { porcentaje: p, tipo };
      }
    }

    // Talento override
    if (esTalento && escala.talento_porcentaje != null) {
      return { porcentaje: escala.talento_porcentaje, tipo: 'descuento' };
    }

    // Tiers por antigüedad
    if (Array.isArray(escala.tiers)) {
      const aplicables = escala.tiers
        .filter((t: any) => antiguedadMeses >= (t.antiguedad_min_meses || 0))
        .sort((a: any, b: any) => (b.antiguedad_min_meses || 0) - (a.antiguedad_min_meses || 0));
      if (aplicables.length > 0) return { porcentaje: aplicables[0].porcentaje, tipo: 'descuento' };
    }
  }

  // Beneficio gratuito simple (sin escala_descuentos)
  if (beneficio.tipo === 'gratuito') {
    return { porcentaje: 100, tipo: 'gratuito' };
  }
  const p = beneficio.descuento != null ? Number(beneficio.descuento) : null;
  return { porcentaje: p, tipo: p != null ? 'descuento' : null };
}

// GET /api/public/beneficiario/:comercioId/:dni - Datos del colaborador + beneficios disponibles
router.get('/beneficiario/:comercioId/:dni', beneficiarioLimiter, async (req: Request, res: Response) => {
  try {
    const comercioId = req.params.comercioId as string;
    const dni = req.params.dni as string;

    if (!/^\d{7,8}$/.test(dni)) {
      return res.status(400).json({ error: 'DNI invalido' });
    }

    // Verificar comercio
    const comercioResult = await query(
      'SELECT id, nombre FROM comercios WHERE id = $1 AND activo = TRUE',
      [comercioId]
    );
    if (comercioResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comercio no encontrado' });
    }

    // 1) ¿Es titular (beneficiario directo)?
    const titularResult = await query(
      `SELECT id, dni, nombre, apellido, nivel, departamento, sector, fecha_ingreso,
              activo, es_talento_popper,
              CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='beneficiarios' AND column_name='foto')
                   THEN foto ELSE NULL END as foto
       FROM beneficiarios WHERE dni = $1`,
      [dni]
    );

    let titular: any = null;
    let familiar: any = null;
    let esFamiliar = false;

    if (titularResult.rows.length > 0) {
      titular = titularResult.rows[0];
      if (!titular.activo) {
        return res.status(403).json({ error: 'Colaborador inactivo' });
      }
    } else {
      // 2) ¿Es familiar? Buscar en tabla familiares (con foto si existe la columna)
      let familiarResult: any = { rows: [] };
      try {
        familiarResult = await query(
          `SELECT f.id as familiar_id, f.dni as familiar_dni, f.nombre_completo, f.relacion,
                  f.fecha_nacimiento, f.activo as familiar_activo, f.foto as familiar_foto,
                  b.id, b.dni, b.nombre, b.apellido, b.nivel, b.departamento, b.sector,
                  b.fecha_ingreso, b.activo, b.es_talento_popper
           FROM familiares f
           JOIN beneficiarios b ON b.id = f.beneficiario_id
           WHERE f.dni = $1 LIMIT 1`,
          [dni]
        );
      } catch {
        familiarResult = await query(
          `SELECT f.id as familiar_id, f.dni as familiar_dni, f.nombre_completo, f.relacion,
                  f.fecha_nacimiento, f.activo as familiar_activo,
                  b.id, b.dni, b.nombre, b.apellido, b.nivel, b.departamento, b.sector,
                  b.fecha_ingreso, b.activo, b.es_talento_popper
           FROM familiares f
           JOIN beneficiarios b ON b.id = f.beneficiario_id
           WHERE f.dni = $1 LIMIT 1`,
          [dni]
        ).catch(() => ({ rows: [] }));
      }

      if (familiarResult.rows.length === 0) {
        // 3) Fallback Naaloo (busqueda directa por DNI)
        const empleadoNaaloo = await buscarEmpleadoPorDni(dni);
        if (empleadoNaaloo) {
          const conv = naalooToBeneficiario(empleadoNaaloo);
          titular = { ...conv, es_talento_popper: false, fecha_ingreso: conv.fecha_ingreso };
        } else {
          return res.status(404).json({ error: 'Colaborador no encontrado. Verificá tu DNI.' });
        }
      } else {
        const row = familiarResult.rows[0];
        if (!row.activo) return res.status(403).json({ error: 'Titular inactivo. Contactá a RRHH.' });
        if (!row.familiar_activo) return res.status(403).json({ error: 'Vínculo familiar inactivo.' });
        // V3H: calcular edad y flag menor
        let edad: number | null = null;
        let esMenor = false;
        if (row.fecha_nacimiento) {
          const fn = new Date(row.fecha_nacimiento);
          if (!isNaN(fn.getTime())) {
            const hoy = new Date();
            edad = hoy.getFullYear() - fn.getFullYear();
            const m = hoy.getMonth() - fn.getMonth();
            if (m < 0 || (m === 0 && hoy.getDate() < fn.getDate())) edad--;
            esMenor = edad < 18;
          }
        }
        familiar = {
          id: row.familiar_id, dni: row.familiar_dni, nombre_completo: row.nombre_completo,
          relacion: row.relacion, fecha_nacimiento: row.fecha_nacimiento,
          edad, es_menor: esMenor,
        };
        titular = {
          id: row.id, dni: row.dni, nombre: row.nombre, apellido: row.apellido,
          nivel: row.nivel, departamento: row.departamento, sector: row.sector,
          fecha_ingreso: row.fecha_ingreso, activo: row.activo,
          es_talento_popper: row.es_talento_popper,
        };
        esFamiliar = true;
      }
    }

    // Calcular antiguedad en meses (mínimo 0 para evitar negativos por fechas futuras en BD)
    const antiguedadMeses = titular.fecha_ingreso
      ? Math.max(0, Math.floor((Date.now() - new Date(titular.fecha_ingreso).getTime()) / (1000 * 60 * 60 * 24 * 30.44)))
      : 0;
    const esTalento = !!titular.es_talento_popper;

    // Beneficios del comercio (con campos V2)
    const beneficiosResult = await query(
      `SELECT b.id, b.nombre, b.descripcion, b.tipo, b.descuento, b.valor_fijo,
              b.horario_inicio, b.horario_fin, b.nivel_minimo,
              b.origen, b.categoria, b.aplica_a, b.modalidad, b.escala_descuentos,
              b.restricciones, b.excluye_outlet, b.relaciones_familiar, b.usa_limite_jerarquia,
              b.max_invitados, b.cubre_invitados
       FROM beneficios b
       INNER JOIN comercio_beneficios cb ON cb.beneficio_id = b.id
       WHERE cb.comercio_id = $1 AND b.activo = TRUE
         AND (b.fecha_inicio IS NULL OR b.fecha_inicio <= NOW())
         AND (b.fecha_fin   IS NULL OR b.fecha_fin   >= NOW())
         AND (b.horario_inicio IS NULL OR b.horario_fin IS NULL
              OR (CURRENT_TIME >= b.horario_inicio::time AND CURRENT_TIME <= b.horario_fin::time))`,
      [comercioId]
    );

    // Filtrado por aplica_a + relación familiar
    const beneficiosFiltrados = beneficiosResult.rows.filter((b: any) => {
      // Beneficios exclusivos de Talento: solo visibles para talento
      if (b.aplica_a === 'talento') return esTalento;
      // Si es familiar, beneficio debe permitirlo
      if (esFamiliar) {
        if (b.aplica_a && b.aplica_a === 'empleado') return false;
        // Validar relación si está definida
        if (b.relaciones_familiar) {
          const relacionesPermitidas = b.relaciones_familiar.split(',').map((r: string) => r.trim());
          if (!relacionesPermitidas.includes(familiar.relacion)) return false;
        }
      } else {
        // Es titular: el beneficio debe permitir empleado o ambos (o no especificar)
        if (b.aplica_a && b.aplica_a === 'familiar') return false;
      }
      return true;
    });

    // Anotar cada beneficio con el % aplicable.
    // NOTA: el cupo/límite de gasto de los beneficios internos lo controla Tango (ERP)
    // + la autorización del gerente comercial. Este sistema es SOLO informativo:
    // muestra el % y registra el canje, NO bloquea ni administra el presupuesto mensual.
    const beneficiosConDescuento = beneficiosFiltrados.map((b: any) => {
      const { porcentaje: descuentoCalculado, tipo: tipoDescuento } = calcularDescuentoAplicable(b, antiguedadMeses, esTalento, esFamiliar);
      return {
        ...b,
        descuento: descuentoCalculado != null ? descuentoCalculado : b.descuento,
        descuento_calculado: descuentoCalculado,
        tipo_descuento: tipoDescuento,
        saldo: null,
      };
    });

    // Foto del titular: primero DB local (rápido), Naaloo como fallback solo si no la tenemos.
    let foto: string | null = titular.foto || null;
    if (!foto) {
      try {
        const empleadoNaaloo = await buscarEmpleadoPorDni(titular.dni);
        if (empleadoNaaloo?.image) foto = empleadoNaaloo.image;
      } catch { /* silencioso */ }
    }

    res.json({
      beneficiario: {
        dni: esFamiliar ? familiar.dni : titular.dni,
        nombre: esFamiliar ? (familiar.nombre_completo || '').split(' ')[0] || familiar.nombre_completo : titular.nombre,
        apellido: esFamiliar ? (familiar.nombre_completo || '').split(' ').slice(1).join(' ') || '' : titular.apellido,
        foto,
        nivel: titular.nivel,
        departamento: titular.departamento,
        sector: titular.sector,
        legajo: null,
        empresa: 'Grupo Popper',
        es_talento_popper: esTalento,
        antiguedad_meses: antiguedadMeses,
      },
      familiar: esFamiliar ? {
        es_familiar: true,
        relacion: familiar.relacion,
        edad: familiar.edad,
        es_menor: familiar.es_menor,
        fecha_nacimiento: familiar.fecha_nacimiento,
        titular: { dni: titular.dni, nombre: titular.nombre, apellido: titular.apellido },
        adultos_autorizados: esFamiliar && familiar.es_menor ? await getAdultosAutorizados(titular.id, familiar.dni) : undefined,
      } : null,
      beneficios: beneficiosConDescuento,
      comercio: comercioResult.rows[0],
      fuente: esFamiliar ? 'familiar' : (titularResult.rows.length > 0 ? 'local' : 'naaloo'),
    });
  } catch (error: any) {
    console.error('Error buscando beneficiario:', error?.message || error);
    res.status(500).json({ error: 'Error interno', detalle: error?.message });
  }
});

// V3G — Verify pass: la boletería puede llamar este endpoint diariamente
// para confirmar si un DNI sigue autorizado a usar un beneficio dado.
// Devuelve estado claro: válido / inactivo / no-autorizado / vencido
router.get('/verify-pass/:dni/:beneficioId', async (req: Request, res: Response) => {
  try {
    const dni = req.params.dni as string;
    const beneficioId = req.params.beneficioId as string;
    if (!/^\d{7,8}$/.test(dni)) return res.status(400).json({ valid: false, error: 'DNI inválido' });

    // 1) Beneficio existe y vigente
    const benRes = await query(
      `SELECT id, nombre, activo, fecha_inicio, fecha_fin, aplica_a, relaciones_familiar, limite_total
       FROM beneficios WHERE id=$1`,
      [beneficioId]
    );
    if (benRes.rows.length === 0) return res.json({ valid: false, motivo: 'Beneficio no encontrado' });
    const b = benRes.rows[0];
    if (!b.activo) return res.json({ valid: false, motivo: 'Beneficio inactivo', codigo: 'BENEFICIO_INACTIVO' });
    const ahora = new Date();
    if (b.fecha_inicio && new Date(b.fecha_inicio) > ahora) {
      return res.json({ valid: false, motivo: `Inicia el ${new Date(b.fecha_inicio).toLocaleDateString('es-AR')}`, codigo: 'NO_VIGENTE_AUN' });
    }
    if (b.fecha_fin && new Date(b.fecha_fin) < ahora) {
      return res.json({ valid: false, motivo: `Venció el ${new Date(b.fecha_fin).toLocaleDateString('es-AR')}`, codigo: 'VENCIDO' });
    }

    // 2) Identidad: titular o familiar
    let esFamiliar = false;
    let relacion: string | null = null;
    let titular: any = null;
    let portador: any = null;

    const tRes = await query(`SELECT id, dni, nombre, apellido, activo, motivo_baja FROM beneficiarios WHERE dni=$1`, [dni]);
    if (tRes.rows.length > 0) {
      portador = tRes.rows[0]; titular = portador;
    } else {
      const fRes = await query(`
        SELECT f.id as fid, f.dni as fdni, f.nombre_completo, f.relacion, f.activo as f_activo,
               b.id, b.dni, b.nombre, b.apellido, b.activo, b.motivo_baja
        FROM familiares f JOIN beneficiarios b ON b.id = f.beneficiario_id
        WHERE f.dni=$1 LIMIT 1
      `, [dni]).catch(() => ({ rows: [] }));
      if (fRes.rows.length === 0) {
        return res.json({ valid: false, motivo: 'DNI no encontrado en el sistema', codigo: 'NO_AUTORIZADO' });
      }
      const r = fRes.rows[0];
      esFamiliar = true;
      relacion = r.relacion;
      titular = { id: r.id, dni: r.dni, nombre: r.nombre, apellido: r.apellido, activo: r.activo, motivo_baja: r.motivo_baja };
      portador = { id: r.fid, dni: r.fdni, nombre_completo: r.nombre_completo, activo: r.f_activo };

      if (!r.f_activo) return res.json({ valid: false, motivo: 'Vínculo familiar inactivo', codigo: 'FAMILIAR_INACTIVO' });
    }

    if (!titular.activo) {
      return res.json({
        valid: false,
        motivo: `Titular dado de baja${titular.motivo_baja ? ` (${titular.motivo_baja})` : ''}`,
        codigo: 'TITULAR_BAJA',
        titular: { nombre: titular.nombre, apellido: titular.apellido },
      });
    }

    // 3) Aplica_a: si es familiar, validar relación
    if (esFamiliar) {
      if (b.aplica_a === 'empleado') {
        return res.json({ valid: false, motivo: 'Este beneficio aplica solo al titular', codigo: 'NO_PARA_FAMILIAR' });
      }
      if (b.relaciones_familiar) {
        const permitidas = b.relaciones_familiar.split(',').map((s: string) => s.trim());
        if (!permitidas.includes(relacion)) {
          return res.json({ valid: false, motivo: `Relación "${relacion}" no autorizada para este beneficio`, codigo: 'RELACION_NO_AUTORIZADA' });
        }
      }
    } else {
      if (b.aplica_a === 'familiar') {
        return res.json({ valid: false, motivo: 'Este beneficio aplica solo a familiares', codigo: 'NO_PARA_TITULAR' });
      }
    }

    // 4) Si limite_total: ¿ya usó?
    let yaUsado = false;
    let usadoInfo: any = null;
    if (b.limite_total) {
      const usoRes = await query(`
        SELECT MAX(v.fecha_verificacion) as ultima, MAX(c.nombre) as comercio
        FROM verificaciones v LEFT JOIN comercios c ON c.id = v.comercio_id
        WHERE v.beneficiario_id=$1 AND v.beneficio_id=$2 AND v.estado='exitoso'
          AND v.beneficiario_dni=$3
      `, [titular.id, beneficioId, dni]);
      if (usoRes.rows[0].ultima) {
        yaUsado = true;
        usadoInfo = { fecha: usoRes.rows[0].ultima, comercio: usoRes.rows[0].comercio };
      }
    }

    res.json({
      valid: true,
      beneficio: b.nombre,
      portador: esFamiliar
        ? { dni: portador.dni, nombre_completo: portador.nombre_completo, relacion }
        : { dni: portador.dni, nombre: portador.nombre, apellido: portador.apellido },
      titular: esFamiliar
        ? { dni: titular.dni, nombre: titular.nombre, apellido: titular.apellido }
        : null,
      ya_usado: yaUsado,
      uso_previo: usadoInfo,
    });
  } catch (error: any) {
    res.status(500).json({ valid: false, error: error.message });
  }
});

// Endpoint dedicado para validar PIN del responsable
router.post('/verificar-pin', async (req: Request, res: Response) => {
  try {
    const { comercio_id, pin } = req.body;
    if (!comercio_id || !pin) return res.status(400).json({ valid: false, error: 'Faltan datos' });
    const r = await query(`SELECT pin_responsable FROM comercios WHERE id=$1 AND activo=TRUE`, [comercio_id])
      .catch(() => ({ rows: [] }));
    if (r.rows.length === 0 || !r.rows[0].pin_responsable) {
      return res.json({ valid: false, error: 'Este comercio no tiene PIN configurado. Pedile al admin que lo configure.' });
    }
    const ok = await bcrypt.compare(String(pin), r.rows[0].pin_responsable);
    res.json({ valid: ok });
  } catch (error: any) {
    res.status(500).json({ valid: false, error: error.message });
  }
});

// POST /api/public/canjear - Canjear un beneficio (sin auth)
// V3A: acepta monto, valida saldo mensual si beneficio.usa_limite_jerarquia
// V3E: si override_limite=true, requiere pin_responsable del comercio
router.post('/canjear', canjearLimiter, async (req: Request, res: Response) => {
  try {
    await ensureVerifDniWidth();
    const { dni, beneficio_id, comercio_id, monto, override_limite, pin_responsable, retirado_por_dni, invitados_count } = req.body;
    const montoNum = monto != null ? parseFloat(String(monto)) : null;

    // V3E: si quieren override, validar PIN
    if (override_limite) {
      const r = await query(`SELECT pin_responsable FROM comercios WHERE id=$1 AND activo=TRUE`, [comercio_id])
        .catch(() => ({ rows: [] }));
      if (r.rows.length === 0 || !r.rows[0].pin_responsable) {
        return res.status(403).json({ error: 'Este comercio no tiene PIN configurado. No se puede autorizar overrides.' });
      }
      if (!pin_responsable) {
        return res.status(401).json({ error: 'Se requiere el PIN del responsable para autorizar este canje.' });
      }
      const ok = await bcrypt.compare(String(pin_responsable), r.rows[0].pin_responsable);
      if (!ok) return res.status(401).json({ error: 'PIN incorrecto.' });
    }

    if (!dni || !beneficio_id || !comercio_id) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    // 1) Resolver beneficiario: titular o familiar (V2)
    // V3G: validación estricta — el titular debe estar ACTIVO siempre
    let beneficiarioId: string | null = null;
    let esFamiliarCanje = false;
    const titularRes = await query('SELECT id, activo, nombre, apellido, motivo_baja FROM beneficiarios WHERE dni = $1', [dni]);
    if (titularRes.rows.length > 0) {
      const t = titularRes.rows[0];
      if (!t.activo) {
        return res.status(403).json({
          error: `Colaborador inactivo${t.motivo_baja ? ` (${t.motivo_baja})` : ''}. No se puede registrar el canje.`,
          inactivo: true,
        });
      }
      beneficiarioId = t.id;
    } else {
      // ¿Familiar? Validar que tanto familiar como titular estén activos
      const famRes = await query(
        `SELECT b.id, b.activo as titular_activo, b.motivo_baja, f.activo as familiar_activo
         FROM familiares f JOIN beneficiarios b ON b.id = f.beneficiario_id
         WHERE f.dni = $1 LIMIT 1`,
        [dni]
      ).catch(() => ({ rows: [] }));
      if (famRes.rows.length > 0) {
        const r = famRes.rows[0];
        if (!r.titular_activo) {
          return res.status(403).json({
            error: `El titular de este familiar fue dado de baja${r.motivo_baja ? ` (${r.motivo_baja})` : ''}. Los beneficios familiares quedan suspendidos.`,
            inactivo: true,
          });
        }
        if (!r.familiar_activo) {
          return res.status(403).json({
            error: 'Vínculo familiar inactivo. Contactá a RRHH.',
            inactivo: true,
          });
        }
        beneficiarioId = r.id;
        esFamiliarCanje = true;
      } else {
        // Fallback Naaloo
        const empleado = await buscarEmpleadoPorDni(dni);
        if (!empleado) return res.status(404).json({ error: 'Colaborador no encontrado' });
        const ben = naalooToBeneficiario(empleado);
        const fechaIngreso = ben.fecha_ingreso ? new Date(ben.fecha_ingreso) : null;
        const fechaValida = fechaIngreso && !isNaN(fechaIngreso.getTime()) ? fechaIngreso.toISOString().split('T')[0] : null;
        const insertResult = await query(
          `INSERT INTO beneficiarios (dni, nombre, apellido, email, telefono, nivel, departamento, empresa, fecha_ingreso, activo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (dni) DO UPDATE SET nombre = EXCLUDED.nombre, apellido = EXCLUDED.apellido, nivel = EXCLUDED.nivel, updated_at = NOW()
           RETURNING id`,
          [ben.dni, ben.nombre, ben.apellido, ben.email || null, (ben.telefono || '').substring(0, 20) || null, ben.nivel, ben.departamento || null, ben.empresa, fechaValida, ben.activo]
        );
        beneficiarioId = insertResult.rows[0].id;
      }
    }

    // V3H: ¿El portador es menor de edad? Si es familiar y tiene fecha_nacimiento
    // calculada con edad <18, requiere retirado_por_dni de un adulto autorizado
    let retiradoPorInfo: { dni: string; nombre: string; tipo: 'titular' | 'familiar' } | null = null;
    if (beneficiarioId) {
      // Buscar si el DNI escaneado es familiar menor
      const famRes = await query(
        `SELECT f.fecha_nacimiento, f.nombre_completo, f.dni, f.beneficiario_id
         FROM familiares f WHERE f.dni=$1 AND f.activo=TRUE LIMIT 1`,
        [dni]
      ).catch(() => ({ rows: [] }));

      if (famRes.rows.length > 0 && famRes.rows[0].fecha_nacimiento) {
        const fn = new Date(famRes.rows[0].fecha_nacimiento);
        if (!isNaN(fn.getTime())) {
          const hoy = new Date();
          let edad = hoy.getFullYear() - fn.getFullYear();
          const m = hoy.getMonth() - fn.getMonth();
          if (m < 0 || (m === 0 && hoy.getDate() < fn.getDate())) edad--;

          if (edad < 18) {
            // Es menor → REQUIERE retirado_por
            if (!retirado_por_dni) {
              return res.status(400).json({
                error: `Es menor de edad (${edad} años). Se requiere el DNI del adulto autorizado que retira el beneficio.`,
                requiere_retirado_por: true,
              });
            }

            // Validar retirado_por: debe ser titular o familiar adulto activo del mismo titular
            const titularId = famRes.rows[0].beneficiario_id;
            const adultoTitular = await query(`SELECT dni, nombre, apellido FROM beneficiarios WHERE id=$1 AND dni=$2 AND activo=TRUE`,
              [titularId, retirado_por_dni]);
            if (adultoTitular.rows.length > 0) {
              const t = adultoTitular.rows[0];
              retiradoPorInfo = { dni: t.dni, nombre: `${t.nombre} ${t.apellido}`, tipo: 'titular' };
            } else {
              const adultoFam = await query(
                `SELECT dni, nombre_completo, fecha_nacimiento
                 FROM familiares WHERE beneficiario_id=$1 AND dni=$2 AND activo=TRUE`,
                [titularId, retirado_por_dni]
              ).catch(() => ({ rows: [] }));
              if (adultoFam.rows.length === 0) {
                return res.status(403).json({
                  error: `El DNI ${retirado_por_dni} no figura como familiar registrado del titular. No puede retirar este beneficio.`,
                });
              }
              // Validar edad >= 18
              let esAdultoOk = true;
              if (adultoFam.rows[0].fecha_nacimiento) {
                const fa = new Date(adultoFam.rows[0].fecha_nacimiento);
                if (!isNaN(fa.getTime())) {
                  let ea = hoy.getFullYear() - fa.getFullYear();
                  const ma = hoy.getMonth() - fa.getMonth();
                  if (ma < 0 || (ma === 0 && hoy.getDate() < fa.getDate())) ea--;
                  esAdultoOk = ea >= 18;
                }
              }
              if (!esAdultoOk) {
                return res.status(403).json({
                  error: `El DNI ${retirado_por_dni} también es menor de edad. Debe ser un adulto.`,
                });
              }
              retiradoPorInfo = { dni: adultoFam.rows[0].dni, nombre: adultoFam.rows[0].nombre_completo, tipo: 'familiar' };
            }
          }
        }
      }
    }

    // 2) Beneficio: validar que esté activo, vinculado al comercio Y que el comercio esté activo
    const beneficioResult = await query(
      `SELECT b.id, b.nombre, b.limite_uso_diario, b.limite_uso_mensual, b.limite_total, b.categoria, b.usa_limite_jerarquia,
              b.fecha_inicio, b.fecha_fin, b.descuento, b.escala_descuentos, b.modalidad, b.aplica_a
       FROM beneficios b
       INNER JOIN comercio_beneficios cb ON cb.beneficio_id = b.id AND cb.comercio_id = $2
       INNER JOIN comercios c ON c.id = cb.comercio_id AND c.activo = TRUE
       WHERE b.id = $1 AND b.activo = TRUE`,
      [beneficio_id, comercio_id]
    );
    if (beneficioResult.rows.length === 0) return res.status(404).json({ error: 'Beneficio no encontrado o no habilitado en este comercio' });
    const beneficio = beneficioResult.rows[0];

    // Validar que beneficios de Talento solo puedan usarlos talento
    if (beneficio.aplica_a === 'talento') {
      const tRes = await query(
        `SELECT es_talento_popper FROM beneficiarios WHERE id=$1 LIMIT 1`,
        [beneficiarioId]
      ).catch(() => ({ rows: [] }));
      if (!tRes.rows[0]?.es_talento_popper) {
        return res.status(403).json({ error: 'Este beneficio es exclusivo para Talento Popper.' });
      }
    }

    // V3G: vigencia del beneficio
    const ahora = new Date();
    if (beneficio.fecha_inicio && new Date(beneficio.fecha_inicio) > ahora) {
      return res.status(403).json({ error: `Este beneficio inicia el ${new Date(beneficio.fecha_inicio).toLocaleDateString('es-AR')}.` });
    }
    if (beneficio.fecha_fin && new Date(beneficio.fecha_fin) < ahora) {
      return res.status(403).json({ error: `Este beneficio venció el ${new Date(beneficio.fecha_fin).toLocaleDateString('es-AR')}.`, vencido: true });
    }

    // 3) Limite usos diario / mensual (V1)
    // Se cuenta por DNI de la persona que canjea (titular o familiar específico),
    // NO por beneficiario_id del titular. Así cada familiar tiene su propio límite.
    // Fallback a beneficiario_id para registros históricos sin beneficiario_dni.
    if (beneficio.limite_uso_diario) {
      const usosHoy = await query(
        `SELECT COUNT(*) as total FROM verificaciones
         WHERE beneficio_id = $2 AND estado = 'exitoso'
           AND (beneficiario_dni = $3 OR (beneficiario_dni IS NULL AND beneficiario_id = $1))
           AND fecha_verificacion >= CURRENT_DATE`,
        [beneficiarioId, beneficio_id, dni]
      );
      if (parseInt(usosHoy.rows[0].total) >= beneficio.limite_uso_diario) {
        return res.status(429).json({ error: `Ya canjeaste este beneficio hoy (límite ${beneficio.limite_uso_diario} por día)` });
      }
    }
    if (beneficio.limite_uso_mensual) {
      const usosMes = await query(
        `SELECT COUNT(*) as total FROM verificaciones
         WHERE beneficio_id = $2 AND estado = 'exitoso'
           AND (beneficiario_dni = $3 OR (beneficiario_dni IS NULL AND beneficiario_id = $1))
           AND fecha_verificacion >= date_trunc('month', CURRENT_DATE)`,
        [beneficiarioId, beneficio_id, dni]
      );
      if (parseInt(usosMes.rows[0].total) >= beneficio.limite_uso_mensual) {
        return res.status(429).json({ error: `Límite mensual alcanzado (${beneficio.limite_uso_mensual} por mes)` });
      }
    }

    // V3F — Límite total (1 vez por temporada/total, ej: skipass)
    // Buscamos el DNI exacto que escaneó (puede ser titular o familiar)
    if (beneficio.limite_total) {
      const usosTotal = await query(
        `SELECT COUNT(*) as total, MAX(v.fecha_verificacion) AS ultima, MAX(c.nombre) AS comercio_nombre
         FROM verificaciones v
         LEFT JOIN comercios c ON c.id = v.comercio_id
         WHERE v.beneficiario_id = $1 AND v.beneficio_id = $2 AND v.estado = 'exitoso'
           AND (v.beneficiario_dni = $3 OR v.beneficiario_dni IS NULL)`,
        [beneficiarioId, beneficio_id, dni]
      );
      const usosCount = parseInt(usosTotal.rows[0].total);
      if (usosCount >= beneficio.limite_total) {
        const ultima = usosTotal.rows[0].ultima;
        const comercioPrev = usosTotal.rows[0].comercio_nombre;
        const fechaStr = ultima ? new Date(ultima).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' }) : '';
        return res.status(429).json({
          error: `Ya retiró este beneficio${fechaStr ? ` el ${fechaStr}` : ''}${comercioPrev ? ` en ${comercioPrev}` : ''}. No se permite doble retiro.`,
          duplicado: true,
        });
      }
    }

    // 4) PRESUPUESTO POR JERARQUIA — DESACTIVADO
    // El control del cupo mensual de beneficios internos lo hace Tango (ERP) +
    // la autorización del gerente comercial. Este sistema NO bloquea por monto;
    // solo registra el canje (con su monto) para historial/reporting.

    // 5) Registrar verificacion (con monto + categoria denormalizada)
    const codigo = `QR-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Calcular descuento real: necesitamos antiguedadMeses y esTalento del titular
    const titularDataRes = await query(
      `SELECT fecha_ingreso, es_talento_popper FROM beneficiarios WHERE id=$1 LIMIT 1`,
      [beneficiarioId]
    ).catch(() => ({ rows: [] }));
    const tdRow = titularDataRes.rows[0] || {};
    const antiguedadMeses = tdRow.fecha_ingreso
      ? Math.max(0, Math.floor((Date.now() - new Date(tdRow.fecha_ingreso).getTime()) / (1000 * 60 * 60 * 24 * 30.44)))
      : 0;
    const esTalento = !!tdRow.es_talento_popper;

    const { porcentaje: pctDescuento } = calcularDescuentoAplicable(beneficio, antiguedadMeses, esTalento, esFamiliarCanje);
    const montoDescuento = montoNum > 0 && pctDescuento ? Math.round(montoNum * (pctDescuento / 100)) : 0;
    const montoFinal = montoNum > 0 ? montoNum - montoDescuento : 0;

    const invCount = parseInt(String(invitados_count)) || 0;
    const verificacion = await query(
      `INSERT INTO verificaciones (
        beneficiario_id, beneficiario_dni, beneficio_id, comercio_id,
        estado, monto_original, monto_descuento, monto_final,
        codigo_referencia, monto, categoria_beneficio, usa_limite_jerarquia,
        retirado_por_dni, retirado_por_nombre, invitados_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id, estado, codigo_referencia, fecha_verificacion, monto`,
      [beneficiarioId, dni, beneficio_id, comercio_id, 'exitoso',
       montoNum || 0, montoDescuento, montoFinal, codigo,
       montoNum || null, beneficio.categoria || null, !!beneficio.usa_limite_jerarquia,
       retiradoPorInfo?.dni || null, retiradoPorInfo?.nombre || null, invCount]
    ).catch(async () => {
      return await query(
        `INSERT INTO verificaciones (
          beneficiario_id, beneficiario_dni, beneficio_id, comercio_id,
          estado, monto_original, monto_descuento, monto_final,
          codigo_referencia, monto, categoria_beneficio, usa_limite_jerarquia
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, estado, codigo_referencia, fecha_verificacion, monto`,
        [beneficiarioId, dni, beneficio_id, comercio_id, 'exitoso',
         montoNum || 0, montoDescuento, montoFinal, codigo,
         montoNum || null, beneficio.categoria || null, !!beneficio.usa_limite_jerarquia]
      );
    });

    await query('UPDATE beneficios SET uso_actual = uso_actual + 1 WHERE id = $1', [beneficio_id]);

    res.json({
      exito: true,
      verificacion: verificacion.rows[0],
      beneficio: beneficio.nombre,
    });
  } catch (error: any) {
    console.error('Error canjeando beneficio:', error?.message || error);
    res.status(500).json({ error: 'Error interno', detalle: error?.message });
  }
});

// GET /api/public/historial/:dni - Historial de canjes del colaborador
router.get('/historial/:dni', async (req: Request, res: Response) => {
  try {
    const dni = req.params.dni as string;
    if (!/^\d{7,8}$/.test(dni)) return res.status(400).json({ error: 'DNI invalido' });

    // Buscar titular directo
    let beneficiarioId: string | null = null;
    const beneficiario = await query('SELECT id FROM beneficiarios WHERE dni = $1', [dni]);
    if (beneficiario.rows.length > 0) {
      beneficiarioId = beneficiario.rows[0].id;
    } else {
      // ¿Es un familiar? Buscar el titular para traer historial del grupo familiar
      const famRes = await query(
        `SELECT b.id FROM familiares f JOIN beneficiarios b ON b.id = f.beneficiario_id WHERE f.dni = $1 LIMIT 1`,
        [dni]
      ).catch(() => ({ rows: [] }));
      if (famRes.rows.length > 0) beneficiarioId = famRes.rows[0].id;
    }
    if (!beneficiarioId) return res.json({ historial: [] });

    const result = await query(
      `SELECT v.fecha_verificacion, v.estado, v.codigo_referencia,
              v.monto_descuento, v.monto_final, v.monto_original,
              ben.nombre as beneficio_nombre, ben.tipo as beneficio_tipo,
              ben.tipo_descuento, ben.valor_fijo,
              c.nombre as comercio_nombre
       FROM verificaciones v
       LEFT JOIN beneficios ben ON ben.id = v.beneficio_id
       LEFT JOIN comercios c ON c.id = v.comercio_id
       WHERE v.beneficiario_id = $1 AND v.estado = 'exitoso'
       ORDER BY v.fecha_verificacion DESC
       LIMIT 50`,
      [beneficiarioId]
    );

    res.json({
      historial: result.rows,
      total: result.rows.length,
    });
  } catch (error: any) {
    console.error('Error historial:', error?.message);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;
