import { query } from '../db';
import { naalooToBeneficiario } from './naaloo';

const NAALOO_API_URL = 'https://backend.naaloo.com';
const NAALOO_TOKEN = process.env.NAALOO_TOKEN || '';

export interface SyncResumen {
  totalNaaloo: number;
  altas: number;
  reactivados: number;
  bajas: number;
  bajasReconciliadas: number;
  reconciliacionOmitida: boolean;
  actualizados: number;
  sinCambios: number;
}

export interface SyncResult {
  exito: boolean;
  resumen: SyncResumen;
  detalles: { dni: string; nombre: string; accion: string }[];
}

type LocalRow = { id: string; dni: string; activo: boolean; naaloo_id: number | null; origen: string | null; es_admin: boolean | null };
type BenRow = {
  dni: string; nombre: string; apellido: string;
  email: string | null; telefono: string | null;
  nivel: string; departamento: string | null; sector: string | null;
  cargo: string | null; empresa: string;
  fecha_ingreso: string | null; naaloo_id: number;
  foto: string | null;
};

// Lazy migration idempotente: columna `foto` + ensanche de `dni`.
let schemaEnsured = false;
async function ensureFotoColumn() {
  if (schemaEnsured) return;
  try {
    await query(`ALTER TABLE beneficiarios ADD COLUMN IF NOT EXISTS foto TEXT`);
  } catch { /* silencioso */ }
  // `dni` era VARCHAR(8): Naaloo incluye extranjeros/CUIT con identificadores de
  // más de 8 caracteres, cuyo INSERT ("value too long for type character varying(8)")
  // abortaba TODO el sync. Lo ensanchamos a VARCHAR(20). Idempotente.
  try {
    await query(`ALTER TABLE beneficiarios ALTER COLUMN dni TYPE VARCHAR(20)`);
  } catch (e: any) {
    console.error(`ensureFotoColumn: no se pudo ensanchar dni — ${e.message}`);
  }
  schemaEnsured = true;
}

async function fetchPaginaNaaloo(page: number, limit: number): Promise<any[]> {
  const response = await fetch(`${NAALOO_API_URL}/personal/?page=${page}&limit=${limit}`, {
    headers: {
      'Authorization': `Bearer ${NAALOO_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error(`Naaloo API error: ${response.status}`);
  const data: any = await response.json();
  const batch = data?.data || [];
  // Strip foto "frontal" (imageFr) que es la grande — conservamos `image` (la chica)
  // para guardarla en DB y mostrarla al cajero en el canje.
  for (const e of batch) { e.imageFr = ''; }
  return batch;
}

async function procesarBatch(
  empleados: any[],
  localMap: Map<string, LocalRow>,
  adminNombre: string,
  acumulado: {
    detalles: { dni: string; nombre: string; accion: string }[];
    altas: number; reactivados: number; bajas: number; actualizados: number;
    altaIds: string[]; reactivaIds: string[]; bajaIds: string[];
  }
) {
  const toInsert: BenRow[] = [];
  const toReactivate: Array<{ id: string } & BenRow> = [];
  const toBaja: string[] = [];
  const toUpdate: Array<{ id: string } & BenRow> = [];

  for (const emp of empleados) {
    const ben = naalooToBeneficiario(emp);
    const fechaIngreso = ben.fecha_ingreso ? new Date(ben.fecha_ingreso) : null;
    const fechaValida = fechaIngreso && !isNaN(fechaIngreso.getTime()) ? fechaIngreso.toISOString().split('T')[0] : null;
    const row: BenRow = {
      dni: ben.dni, nombre: ben.nombre, apellido: ben.apellido,
      email: ben.email || null, telefono: (ben.telefono || '').substring(0, 20) || null,
      nivel: ben.nivel, departamento: ben.departamento || null, sector: ben.sector || null,
      cargo: ben.cargo || null, empresa: ben.empresa, fecha_ingreso: fechaValida, naaloo_id: emp.id,
      foto: ben.foto || null,
    };
    const local = localMap.get(ben.dni);

    if (!local) {
      if (emp.activo) { toInsert.push(row); acumulado.detalles.push({ dni: ben.dni, nombre: `${ben.nombre} ${ben.apellido}`, accion: 'alta' }); }
    } else if (emp.activo && !local.activo) {
      toReactivate.push({ id: local.id, ...row }); acumulado.detalles.push({ dni: ben.dni, nombre: `${ben.nombre} ${ben.apellido}`, accion: 'reactivado' });
    } else if (!emp.activo && local.activo) {
      toBaja.push(local.id); acumulado.detalles.push({ dni: ben.dni, nombre: `${ben.nombre} ${ben.apellido}`, accion: 'baja' });
    } else {
      toUpdate.push({ id: local.id, ...row });
    }
  }

  // ALTAS
  if (toInsert.length > 0) {
    const valuePlaceholders = toInsert.map((_, i) => {
      const base = i * 13;
      return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11},TRUE,$${base+12},'naaloo',NOW(),$${base+13})`;
    }).join(',');
    const values = toInsert.flatMap(r => [r.dni, r.nombre, r.apellido, r.email, r.telefono, r.nivel, r.departamento, r.sector, r.cargo, r.empresa, r.fecha_ingreso, r.naaloo_id, r.foto]);
    const insertRes = await query(
      `INSERT INTO beneficiarios (dni,nombre,apellido,email,telefono,nivel,departamento,sector,cargo,empresa,fecha_ingreso,activo,naaloo_id,origen,ultima_sync,foto)
       VALUES ${valuePlaceholders}
       ON CONFLICT (dni) DO UPDATE SET nombre=EXCLUDED.nombre,apellido=EXCLUDED.apellido,departamento=EXCLUDED.departamento,
         sector=EXCLUDED.sector,cargo=EXCLUDED.cargo,naaloo_id=EXCLUDED.naaloo_id,foto=COALESCE(EXCLUDED.foto, beneficiarios.foto),ultima_sync=NOW()
       RETURNING id, dni`,
      values
    );
    for (const r of insertRes.rows) {
      acumulado.altaIds.push(r.id);
      // Actualizar localMap para que en próximas páginas no se duplique si aparece de nuevo
      localMap.set(r.dni, { id: r.id, dni: r.dni, activo: true, naaloo_id: null, origen: 'naaloo', es_admin: false });
    }
    acumulado.altas += toInsert.length;
  }

  // REACTIVACIONES
  for (const r of toReactivate) {
    await query(
      `UPDATE beneficiarios SET activo=TRUE,nombre=$1,apellido=$2,nivel=$3,departamento=$4,sector=$5,cargo=$6,naaloo_id=$7,
        foto=COALESCE($8, foto),
        motivo_baja=NULL,fecha_baja=NULL,ultima_sync=NOW(),updated_at=NOW() WHERE id=$9`,
      [r.nombre, r.apellido, r.nivel, r.departamento, r.sector, r.cargo, r.naaloo_id, r.foto, r.id]
    );
    acumulado.reactivaIds.push(r.id);
    const existing = localMap.get(r.dni);
    if (existing) localMap.set(r.dni, { ...existing, activo: true });
  }
  acumulado.reactivados += toReactivate.length;

  // BAJAS
  if (toBaja.length > 0) {
    const placeholders = toBaja.map((_, i) => `$${i + 1}`).join(',');
    await query(
      `UPDATE beneficiarios SET activo=FALSE,motivo_baja='Baja detectada en Naaloo',fecha_baja=NOW(),autorizado_por='Sync Naaloo',ultima_sync=NOW(),updated_at=NOW()
       WHERE id IN (${placeholders})`,
      toBaja
    );
    await query(
      `UPDATE familiares SET activo=FALSE,updated_at=NOW() WHERE beneficiario_id IN (${placeholders}) AND activo=TRUE`,
      toBaja
    ).catch(() => {});
    acumulado.bajaIds.push(...toBaja);
    acumulado.bajas += toBaja.length;
  }

  // ACTUALIZACIONES — en chunks de 200 para no superar el límite de params de PG
  if (toUpdate.length > 0) {
    const CHUNK = 200;
    for (let i = 0; i < toUpdate.length; i += CHUNK) {
      const slice = toUpdate.slice(i, i + CHUNK);
      const placeholders = slice.map((_, j) => {
        const base = j * 9;
        return `($${base+1}::uuid,$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9})`;
      }).join(',');
      const values = slice.flatMap(r => [r.id, r.nombre, r.apellido, r.nivel, r.departamento, r.sector, r.cargo, r.naaloo_id, r.foto]);
      await query(
        `UPDATE beneficiarios b SET nombre=v.nombre,apellido=v.apellido,nivel=v.nivel,departamento=v.departamento,
           sector=v.sector,cargo=v.cargo,naaloo_id=v.naaloo_id::int,
           foto=COALESCE(v.foto, b.foto),
           ultima_sync=NOW(),updated_at=NOW()
         FROM (VALUES ${placeholders}) AS v(id,nombre,apellido,nivel,departamento,sector,cargo,naaloo_id,foto)
         WHERE b.id = v.id::uuid`,
        values
      ).catch(async () => {
        for (const r of slice) {
          await query(
            `UPDATE beneficiarios SET nombre=$1,apellido=$2,nivel=$3,departamento=$4,sector=$5,cargo=$6,naaloo_id=$7,
              foto=COALESCE($8, foto),
              ultima_sync=NOW(),updated_at=NOW() WHERE id=$9`,
            [r.nombre, r.apellido, r.nivel, r.departamento, r.sector, r.cargo, r.naaloo_id, r.foto, r.id]
          ).catch(() => {});
        }
      });
    }
    acumulado.actualizados += toUpdate.length;
  }
}

export async function runSyncNaaloo(adminNombre: string = 'Cron'): Promise<SyncResult> {
  // 0. Asegurar columna `foto` (lazy migration idempotente)
  await ensureFotoColumn();

  // 1. Cargar estado local en memoria
  const localResult = await query('SELECT id, dni, activo, naaloo_id, origen, es_admin FROM beneficiarios');
  const localMap = new Map<string, LocalRow>();
  for (const row of localResult.rows) localMap.set(row.dni, row);

  // 2. Acumulador compartido entre batches
  const acumulado = {
    detalles: [] as { dni: string; nombre: string; accion: string }[],
    altas: 0, reactivados: 0, bajas: 0, actualizados: 0,
    altaIds: [] as string[],
    reactivaIds: [] as string[],
    bajaIds: [] as string[],
  };

  // 3. Iterar páginas de Naaloo en streaming, dedupeando por DNI.
  // La API de Naaloo ignora el parámetro `page` y devuelve siempre el mismo
  // conjunto, así que cortamos en cuanto una página no aporta DNIs nuevos.
  const LIMIT = 2000;
  const MAX_PAGES = 10;
  const dnisVistos = new Set<string>();
  let totalNaaloo = 0;
  let page = 1;

  while (page <= MAX_PAGES) {
    let batch: any[];
    try {
      batch = await fetchPaginaNaaloo(page, LIMIT);
    } catch (err: any) {
      console.error(`Error trayendo página ${page}: ${err.message}`);
      break;
    }
    if (batch.length === 0) break;

    // Filtrar duplicados (Naaloo devuelve los mismos en cada página)
    const nuevos = batch.filter(e => e.dni && !dnisVistos.has(e.dni));
    for (const e of nuevos) dnisVistos.add(e.dni);

    if (nuevos.length === 0) {
      console.log(`Página ${page}: 0 nuevos (corte por duplicados)`);
      break;
    }

    totalNaaloo += nuevos.length;
    await procesarBatch(nuevos, localMap, adminNombre, acumulado);
    console.log(`Página ${page}: ${nuevos.length} nuevos procesados (acumulado ${totalNaaloo})`);

    if (batch.length < LIMIT) break;
    page++;
  }

  if (totalNaaloo === 0) {
    throw new Error('No se pudo conectar con Naaloo o no hay empleados');
  }

  // 3b. RECONCILIACIÓN DE BAJAS
  // El endpoint /personal/ de Naaloo devuelve SOLO empleados activos y el roster
  // completo (ignora la paginación). Por lo tanto, un beneficiario local activo de
  // origen Naaloo cuyo DNI NO apareció en el feed = fue dado de baja en Naaloo.
  // (La rama `!emp.activo` de procesarBatch nunca se dispara porque Naaloo jamás
  // devuelve inactivos; esta reconciliación es la que realmente propaga las bajas.)
  // Los admins quedan EXCLUÍDOS de la reconciliación: pueden ser super-admins externos
  // (ej. staff de Recluta) que no figuran en el roster de empleados de Naaloo, y no
  // queremos desactivarlos por ausencia. Sus permisos se gestionan aparte.
  const candidatosBaja: string[] = [];
  let localActivosNaaloo = 0;
  for (const row of localMap.values()) {
    const esNaaloo = row.origen === 'naaloo' || row.naaloo_id != null;
    if (row.activo && esNaaloo && !row.es_admin) {
      localActivosNaaloo++;
      if (!dnisVistos.has(row.dni)) candidatosBaja.push(row.id);
    }
  }

  let bajasReconciliadas = 0;
  let reconciliacionOmitida = false;
  if (candidatosBaja.length > 0) {
    // Salvaguarda anti-outage basada en la COMPLETITUD del feed. El endpoint /personal/
    // de Naaloo devuelve el roster completo de activos, así que su tamaño debería ser del
    // mismo orden que los activos locales. Si volviera con muchos menos (outage / respuesta
    // parcial), reconciliar por ausencia sería un falso positivo masivo: en ese caso
    // omitimos y alertamos. Un backlog grande legítimo (feed completo pero muchas bajas
    // acumuladas) SÍ se procesa. Ratio configurable vía SYNC_FEED_MIN_RATIO (default 0.5).
    const minRatio = parseFloat(process.env.SYNC_FEED_MIN_RATIO || '0.5');
    const feedMinimo = Math.floor(localActivosNaaloo * minRatio);
    if (dnisVistos.size < feedMinimo) {
      reconciliacionOmitida = true;
      console.error(
        `⚠️ Reconciliación OMITIDA: el feed de Naaloo trajo ${dnisVistos.size} activos, por debajo ` +
        `del mínimo esperado (${feedMinimo} = ${minRatio}×${localActivosNaaloo} locales). Posible respuesta ` +
        `parcial de Naaloo. ${candidatosBaja.length} bajas candidatas sin aplicar. Revisar manualmente.`
      );
    } else {
      const CHUNK = 200;
      for (let i = 0; i < candidatosBaja.length; i += CHUNK) {
        const slice = candidatosBaja.slice(i, i + CHUNK);
        const ph = slice.map((_, j) => `$${j + 1}`).join(',');
        await query(
          `UPDATE beneficiarios SET activo=FALSE,motivo_baja='Baja detectada por reconciliación (ausente en Naaloo)',fecha_baja=NOW(),autorizado_por='Sync Naaloo',ultima_sync=NOW(),updated_at=NOW()
           WHERE id IN (${ph})`,
          slice
        );
        await query(
          `UPDATE familiares SET activo=FALSE,updated_at=NOW() WHERE beneficiario_id IN (${ph}) AND activo=TRUE`,
          slice
        ).catch(() => {});
      }
      bajasReconciliadas = candidatosBaja.length;
      acumulado.bajaIds.push(...candidatosBaja);
    }
  }

  // 4. Logs en batch
  const logRows = [
    ...acumulado.altaIds.map(id => [id, 'sync_alta', 'Alta automatica desde Naaloo', adminNombre]),
    ...acumulado.reactivaIds.map(id => [id, 'sync_alta', 'Reactivado automaticamente desde Naaloo', adminNombre]),
    ...acumulado.bajaIds.map(id => [id, 'sync_baja', 'Baja automatica - empleado inactivo en Naaloo', adminNombre]),
  ];
  if (logRows.length > 0) {
    const CHUNK = 200;
    for (let i = 0; i < logRows.length; i += CHUNK) {
      const slice = logRows.slice(i, i + CHUNK);
      const logPlaceholders = slice.map((_, j) => {
        const base = j * 4;
        return `($${base+1},$${base+2},$${base+3},$${base+4})`;
      }).join(',');
      await query(
        `INSERT INTO autorizacion_logs (beneficiario_id, accion, motivo, autorizado_por) VALUES ${logPlaceholders}`,
        slice.flat()
      ).catch(() => {});
    }
  }

  return {
    exito: true,
    resumen: {
      totalNaaloo,
      altas: acumulado.altas,
      reactivados: acumulado.reactivados,
      bajas: acumulado.bajas,
      bajasReconciliadas,
      reconciliacionOmitida,
      actualizados: acumulado.actualizados,
      sinCambios: totalNaaloo - acumulado.altas - acumulado.reactivados - acumulado.bajas - acumulado.actualizados,
    },
    detalles: acumulado.detalles,
  };
}

// Recolecta el set de DNIs activos del feed de Naaloo (roster completo; ignora paginación).
async function recolectarDnisActivosNaaloo(): Promise<Set<string>> {
  const dnisVistos = new Set<string>();
  const LIMIT = 2000;
  const MAX_PAGES = 10;
  let page = 1;
  while (page <= MAX_PAGES) {
    let batch: any[];
    try {
      batch = await fetchPaginaNaaloo(page, LIMIT);
    } catch {
      break;
    }
    if (batch.length === 0) break;
    const nuevos = batch.filter((e) => e.dni && !dnisVistos.has(e.dni));
    for (const e of nuevos) dnisVistos.add(e.dni);
    if (nuevos.length === 0 || batch.length < LIMIT) break;
    page++;
  }
  return dnisVistos;
}

export interface ReconciliacionPreview {
  totalNaalooActivos: number;
  localActivos: number;
  totalCandidatos: number;
  reconciliacionOmitida: boolean;
  candidatos: { dni: string; nombre: string; apellido: string; fecha_ingreso: string | null; ultima_sync: string | null }[];
}

// DRY-RUN: calcula a quiénes daría de baja la reconciliación SIN modificar nada.
// Sirve para revisar el listado antes de ejecutar el sync real.
export async function previewReconciliacionBajas(): Promise<ReconciliacionPreview> {
  const dnisVistos = await recolectarDnisActivosNaaloo();
  if (dnisVistos.size === 0) {
    throw new Error('No se pudo conectar con Naaloo o no hay empleados');
  }

  // Mismos criterios que la reconciliación real: activos, origen Naaloo, NO admin.
  const localRes = await query(
    `SELECT id, dni, nombre, apellido, fecha_ingreso, ultima_sync
       FROM beneficiarios
      WHERE activo = TRUE
        AND (origen = 'naaloo' OR naaloo_id IS NOT NULL)
        AND (es_admin IS NULL OR es_admin = FALSE)`
  );

  const localActivos = localRes.rows.length;
  const candidatos = localRes.rows.filter((r) => !dnisVistos.has(r.dni));

  const minRatio = parseFloat(process.env.SYNC_FEED_MIN_RATIO || '0.5');
  const reconciliacionOmitida = candidatos.length > 0 && dnisVistos.size < Math.floor(localActivos * minRatio);

  return {
    totalNaalooActivos: dnisVistos.size,
    localActivos,
    totalCandidatos: candidatos.length,
    reconciliacionOmitida,
    candidatos: candidatos.map((r) => ({
      dni: r.dni,
      nombre: r.nombre,
      apellido: r.apellido,
      fecha_ingreso: r.fecha_ingreso,
      ultima_sync: r.ultima_sync,
    })),
  };
}
