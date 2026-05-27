import { query } from '../db';
import { naalooToBeneficiario } from './naaloo';

const NAALOO_API_URL = 'https://backend.naaloo.com';
const NAALOO_TOKEN = process.env.NAALOO_TOKEN || '';

export interface SyncResumen {
  totalNaaloo: number;
  altas: number;
  reactivados: number;
  bajas: number;
  actualizados: number;
  sinCambios: number;
}

export interface SyncResult {
  exito: boolean;
  resumen: SyncResumen;
  detalles: { dni: string; nombre: string; accion: string }[];
}

type LocalRow = { id: string; activo: boolean; naaloo_id: number | null };
type BenRow = {
  dni: string; nombre: string; apellido: string;
  email: string | null; telefono: string | null;
  nivel: string; departamento: string | null; sector: string | null;
  cargo: string | null; empresa: string;
  fecha_ingreso: string | null; naaloo_id: number;
};

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
  // Strip fotos base64 inmediatamente para liberar memoria
  for (const e of batch) { e.image = ''; e.imageFr = ''; }
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
      const base = i * 12;
      return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11},TRUE,$${base+12},'naaloo',NOW())`;
    }).join(',');
    const values = toInsert.flatMap(r => [r.dni, r.nombre, r.apellido, r.email, r.telefono, r.nivel, r.departamento, r.sector, r.cargo, r.empresa, r.fecha_ingreso, r.naaloo_id]);
    const insertRes = await query(
      `INSERT INTO beneficiarios (dni,nombre,apellido,email,telefono,nivel,departamento,sector,cargo,empresa,fecha_ingreso,activo,naaloo_id,origen,ultima_sync)
       VALUES ${valuePlaceholders}
       ON CONFLICT (dni) DO UPDATE SET nombre=EXCLUDED.nombre,apellido=EXCLUDED.apellido,departamento=EXCLUDED.departamento,
         sector=EXCLUDED.sector,cargo=EXCLUDED.cargo,naaloo_id=EXCLUDED.naaloo_id,ultima_sync=NOW()
       RETURNING id, dni`,
      values
    );
    for (const r of insertRes.rows) {
      acumulado.altaIds.push(r.id);
      // Actualizar localMap para que en próximas páginas no se duplique si aparece de nuevo
      localMap.set(r.dni, { id: r.id, activo: true, naaloo_id: null });
    }
    acumulado.altas += toInsert.length;
  }

  // REACTIVACIONES
  for (const r of toReactivate) {
    await query(
      `UPDATE beneficiarios SET activo=TRUE,nombre=$1,apellido=$2,nivel=$3,departamento=$4,sector=$5,cargo=$6,naaloo_id=$7,motivo_baja=NULL,fecha_baja=NULL,ultima_sync=NOW(),updated_at=NOW() WHERE id=$8`,
      [r.nombre, r.apellido, r.nivel, r.departamento, r.sector, r.cargo, r.naaloo_id, r.id]
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
        const base = j * 8;
        return `($${base+1}::uuid,$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8})`;
      }).join(',');
      const values = slice.flatMap(r => [r.id, r.nombre, r.apellido, r.nivel, r.departamento, r.sector, r.cargo, r.naaloo_id]);
      await query(
        `UPDATE beneficiarios b SET nombre=v.nombre,apellido=v.apellido,nivel=v.nivel,departamento=v.departamento,
           sector=v.sector,cargo=v.cargo,naaloo_id=v.naaloo_id::int,ultima_sync=NOW(),updated_at=NOW()
         FROM (VALUES ${placeholders}) AS v(id,nombre,apellido,nivel,departamento,sector,cargo,naaloo_id)
         WHERE b.id = v.id::uuid`,
        values
      ).catch(async () => {
        for (const r of slice) {
          await query(
            `UPDATE beneficiarios SET nombre=$1,apellido=$2,nivel=$3,departamento=$4,sector=$5,cargo=$6,naaloo_id=$7,ultima_sync=NOW(),updated_at=NOW() WHERE id=$8`,
            [r.nombre, r.apellido, r.nivel, r.departamento, r.sector, r.cargo, r.naaloo_id, r.id]
          ).catch(() => {});
        }
      });
    }
    acumulado.actualizados += toUpdate.length;
  }
}

export async function runSyncNaaloo(adminNombre: string = 'Cron'): Promise<SyncResult> {
  // 1. Cargar estado local en memoria
  const localResult = await query('SELECT id, dni, activo, naaloo_id FROM beneficiarios');
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

  // 3. Iterar páginas de Naaloo en streaming
  const LIMIT = 500;
  const MAX_PAGES = 30;
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

    totalNaaloo += batch.length;
    await procesarBatch(batch, localMap, adminNombre, acumulado);
    console.log(`Página ${page}: ${batch.length} empleados procesados (acumulado ${totalNaaloo})`);

    if (batch.length < LIMIT) break;
    page++;
  }

  if (totalNaaloo === 0) {
    throw new Error('No se pudo conectar con Naaloo o no hay empleados');
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
      actualizados: acumulado.actualizados,
      sinCambios: totalNaaloo - acumulado.altas - acumulado.reactivados - acumulado.bajas - acumulado.actualizados,
    },
    detalles: acumulado.detalles,
  };
}
