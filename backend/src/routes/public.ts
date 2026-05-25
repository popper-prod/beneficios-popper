import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db';
import { buscarEmpleadoPorDni, naalooToBeneficiario } from '../services/naaloo';

const router = Router();

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

// Calcular % aplicable de un beneficio dado el titular (antiguedad + talento)
function calcularDescuentoAplicable(beneficio: any, antiguedadMeses: number, esTalento: boolean): number | null {
  // Si tiene escala_descuentos (modelo V2), usar reglas
  if (beneficio.escala_descuentos) {
    const escala = typeof beneficio.escala_descuentos === 'string'
      ? JSON.parse(beneficio.escala_descuentos)
      : beneficio.escala_descuentos;

    // Talento override: aplica el % máximo desde el día 1
    if (esTalento && escala.talento_porcentaje != null) {
      return escala.talento_porcentaje;
    }

    // Buscar tier que aplique (el de antiguedad_min_meses más alto que cumpla)
    if (Array.isArray(escala.tiers)) {
      const aplicables = escala.tiers
        .filter((t: any) => antiguedadMeses >= (t.antiguedad_min_meses || 0))
        .sort((a: any, b: any) => (b.antiguedad_min_meses || 0) - (a.antiguedad_min_meses || 0));
      if (aplicables.length > 0) return aplicables[0].porcentaje;
    }
  }

  // Fallback: descuento simple del modelo viejo
  return beneficio.descuento != null ? Number(beneficio.descuento) : null;
}

// GET /api/public/beneficiario/:comercioId/:dni - Datos del colaborador + beneficios disponibles
router.get('/beneficiario/:comercioId/:dni', async (req: Request, res: Response) => {
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
              activo, es_talento_popper
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
      // 2) ¿Es familiar? Buscar en tabla familiares
      const familiarResult = await query(
        `SELECT f.id as familiar_id, f.dni as familiar_dni, f.nombre_completo, f.relacion,
                f.fecha_nacimiento, f.activo as familiar_activo,
                b.id, b.dni, b.nombre, b.apellido, b.nivel, b.departamento, b.sector,
                b.fecha_ingreso, b.activo, b.es_talento_popper
         FROM familiares f
         JOIN beneficiarios b ON b.id = f.beneficiario_id
         WHERE f.dni = $1 LIMIT 1`,
        [dni]
      ).catch(() => ({ rows: [] }));

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
        familiar = {
          id: row.familiar_id, dni: row.familiar_dni, nombre_completo: row.nombre_completo,
          relacion: row.relacion, fecha_nacimiento: row.fecha_nacimiento,
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

    // Calcular antiguedad en meses
    const antiguedadMeses = titular.fecha_ingreso
      ? Math.floor((Date.now() - new Date(titular.fecha_ingreso).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
      : 0;
    const esTalento = !!titular.es_talento_popper;

    // Beneficios del comercio (con campos V2)
    const beneficiosResult = await query(
      `SELECT b.id, b.nombre, b.descripcion, b.tipo, b.descuento, b.valor_fijo,
              b.horario_inicio, b.horario_fin, b.nivel_minimo,
              b.origen, b.categoria, b.aplica_a, b.modalidad, b.escala_descuentos,
              b.restricciones, b.excluye_outlet, b.relaciones_familiar, b.usa_limite_jerarquia
       FROM beneficios b
       INNER JOIN comercio_beneficios cb ON cb.beneficio_id = b.id
       WHERE cb.comercio_id = $1 AND b.activo = TRUE`,
      [comercioId]
    );

    // Filtrado por aplica_a + relación familiar
    const beneficiosFiltrados = beneficiosResult.rows.filter((b: any) => {
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

    // === Saldo mensual del titular por categoria (Phase 3A) ===
    const consumoResult = await query(`
      SELECT categoria_beneficio AS categoria, COALESCE(SUM(monto), 0)::float AS gastado
      FROM verificaciones
      WHERE beneficiario_id = $1
        AND fecha_verificacion >= date_trunc('month', CURRENT_DATE)
        AND estado = 'exitoso' AND monto IS NOT NULL
      GROUP BY categoria_beneficio
    `, [titular.id]).catch(() => ({ rows: [] }));
    const consumoMap: Record<string, number> = {};
    for (const r of consumoResult.rows) consumoMap[r.categoria] = r.gastado;

    // Jerarquia del titular (para conocer su limite)
    let jerarquia: any = null;
    if (titular.id) {
      const jRes = await query(`
        SELECT j.id, j.nombre, j.limite_mensual::float, j.limite_mensual_talento::float
        FROM jerarquias j JOIN beneficiarios b ON b.jerarquia_id = j.id
        WHERE b.id = $1 LIMIT 1
      `, [titular.id]).catch(() => ({ rows: [] }));
      if (jRes.rows.length > 0) jerarquia = jRes.rows[0];
    }
    const limiteMensual = jerarquia
      ? (esTalento ? jerarquia.limite_mensual_talento : jerarquia.limite_mensual) || 0
      : 0;

    // Anotar cada beneficio con el % aplicable + saldo restante si usa límite jerarquia
    const beneficiosConDescuento = beneficiosFiltrados.map((b: any) => {
      const descuentoCalculado = calcularDescuentoAplicable(b, antiguedadMeses, esTalento);
      let saldoInfo: any = null;
      if (b.usa_limite_jerarquia && jerarquia) {
        const gastado = consumoMap[b.categoria] || 0;
        const disponible = Math.max(0, limiteMensual - gastado);
        saldoInfo = {
          limite_mensual: limiteMensual,
          gastado_mes: gastado,
          disponible,
          jerarquia: jerarquia.nombre,
        };
      } else if (b.usa_limite_jerarquia && !jerarquia) {
        saldoInfo = { sin_jerarquia: true };
      }
      return {
        ...b,
        descuento: descuentoCalculado != null ? descuentoCalculado : b.descuento,
        descuento_calculado: descuentoCalculado,
        saldo: saldoInfo,
      };
    });

    // Foto del titular si vino de Naaloo
    let foto: string | null = null;
    try {
      const empleadoNaaloo = await buscarEmpleadoPorDni(titular.dni);
      if (empleadoNaaloo?.image) foto = empleadoNaaloo.image;
    } catch { /* silencioso */ }

    res.json({
      beneficiario: {
        dni: esFamiliar ? familiar.dni : titular.dni,
        nombre: esFamiliar ? familiar.nombre_completo.split(' ')[0] : titular.nombre,
        apellido: esFamiliar ? familiar.nombre_completo.split(' ').slice(1).join(' ') : titular.apellido,
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
        titular: { dni: titular.dni, nombre: titular.nombre, apellido: titular.apellido },
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
router.post('/canjear', async (req: Request, res: Response) => {
  try {
    const { dni, beneficio_id, comercio_id, monto, override_limite, pin_responsable } = req.body;
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
    let beneficiarioId: string | null = null;
    const titularRes = await query('SELECT id FROM beneficiarios WHERE dni = $1', [dni]);
    if (titularRes.rows.length > 0) {
      beneficiarioId = titularRes.rows[0].id;
    } else {
      // ¿Familiar?
      const famRes = await query(
        `SELECT b.id FROM familiares f JOIN beneficiarios b ON b.id = f.beneficiario_id
         WHERE f.dni = $1 AND f.activo = TRUE LIMIT 1`,
        [dni]
      ).catch(() => ({ rows: [] }));
      if (famRes.rows.length > 0) {
        beneficiarioId = famRes.rows[0].id;
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

    // 2) Beneficio (incluyendo campos V2)
    const beneficioResult = await query(
      `SELECT id, nombre, limite_uso_diario, limite_uso_mensual, categoria, usa_limite_jerarquia
       FROM beneficios WHERE id = $1 AND activo = TRUE`,
      [beneficio_id]
    );
    if (beneficioResult.rows.length === 0) return res.status(404).json({ error: 'Beneficio no encontrado' });
    const beneficio = beneficioResult.rows[0];

    // 3) Limite usos diario / mensual (V1)
    if (beneficio.limite_uso_diario) {
      const usosHoy = await query(
        `SELECT COUNT(*) as total FROM verificaciones
         WHERE beneficiario_id = $1 AND beneficio_id = $2 AND estado = 'exitoso'
         AND fecha_verificacion >= CURRENT_DATE`,
        [beneficiarioId, beneficio_id]
      );
      if (parseInt(usosHoy.rows[0].total) >= beneficio.limite_uso_diario) {
        return res.status(429).json({ error: `Límite diario alcanzado (${beneficio.limite_uso_diario} por día)` });
      }
    }
    if (beneficio.limite_uso_mensual) {
      const usosMes = await query(
        `SELECT COUNT(*) as total FROM verificaciones
         WHERE beneficiario_id = $1 AND beneficio_id = $2 AND estado = 'exitoso'
         AND fecha_verificacion >= date_trunc('month', CURRENT_DATE)`,
        [beneficiarioId, beneficio_id]
      );
      if (parseInt(usosMes.rows[0].total) >= beneficio.limite_uso_mensual) {
        return res.status(429).json({ error: `Límite mensual alcanzado (${beneficio.limite_uso_mensual} por mes)` });
      }
    }

    // 4) PRESUPUESTO POR JERARQUIA (V3A)
    if (beneficio.usa_limite_jerarquia && montoNum && !override_limite) {
      // Obtener jerarquia del beneficiario
      const jRes = await query(`
        SELECT b.es_talento_popper, j.id AS jid, j.nombre AS jnombre,
               j.limite_mensual::float AS lim, j.limite_mensual_talento::float AS lim_t
        FROM beneficiarios b LEFT JOIN jerarquias j ON j.id = b.jerarquia_id
        WHERE b.id = $1 LIMIT 1
      `, [beneficiarioId]).catch(() => ({ rows: [] }));
      const jr = jRes.rows[0] || {};
      if (jr.jid) {
        const limite = jr.es_talento_popper ? (jr.lim_t || 0) : (jr.lim || 0);
        // Sumar gasto del mes en esta categoria
        const gastoRes = await query(`
          SELECT COALESCE(SUM(monto), 0)::float AS gastado
          FROM verificaciones
          WHERE beneficiario_id = $1 AND categoria_beneficio = $2
            AND fecha_verificacion >= date_trunc('month', CURRENT_DATE)
            AND estado = 'exitoso'
        `, [beneficiarioId, beneficio.categoria]);
        const gastado = gastoRes.rows[0]?.gastado || 0;
        if (limite > 0 && (gastado + montoNum) > limite) {
          return res.status(429).json({
            error: `Excede el límite mensual de ${jr.jnombre} ($${limite.toLocaleString('es-AR')}). ` +
                   `Ya gastaste $${gastado.toLocaleString('es-AR')}. Disponible: $${(limite - gastado).toLocaleString('es-AR')}.`,
            saldo: { limite, gastado, disponible: limite - gastado, monto_solicitado: montoNum },
            requiere_override: true,
          });
        }
      }
    }

    // 5) Registrar verificacion (con monto + categoria denormalizada)
    const codigo = `QR-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const verificacion = await query(
      `INSERT INTO verificaciones (
        beneficiario_id, beneficio_id, comercio_id,
        estado, monto_original, monto_descuento, monto_final,
        codigo_referencia, monto, categoria_beneficio, usa_limite_jerarquia
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, estado, codigo_referencia, fecha_verificacion, monto`,
      [beneficiarioId, beneficio_id, comercio_id, 'exitoso',
       montoNum || 0, 0, montoNum || 0, codigo,
       montoNum || null, beneficio.categoria || null, !!beneficio.usa_limite_jerarquia]
    );

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

    const beneficiario = await query('SELECT id, nombre, apellido FROM beneficiarios WHERE dni = $1', [dni]);
    if (beneficiario.rows.length === 0) return res.json({ historial: [] });

    const result = await query(
      `SELECT v.fecha_verificacion, v.estado, v.codigo_referencia,
              ben.nombre as beneficio_nombre, ben.tipo as beneficio_tipo, ben.descuento,
              c.nombre as comercio_nombre
       FROM verificaciones v
       LEFT JOIN beneficios ben ON ben.id = v.beneficio_id
       LEFT JOIN comercios c ON c.id = v.comercio_id
       WHERE v.beneficiario_id = $1 AND v.estado = 'exitoso'
       ORDER BY v.fecha_verificacion DESC
       LIMIT 50`,
      [beneficiario.rows[0].id]
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
