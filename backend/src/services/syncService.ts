import { query } from '../db';
import { obtenerTodosEmpleados, naalooToBeneficiario } from './naaloo';

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

export async function runSyncNaaloo(adminNombre: string = 'Cron'): Promise<SyncResult> {
  const empleados = await obtenerTodosEmpleados();
  if (empleados.length === 0) {
    throw new Error('No se pudo conectar con Naaloo o no hay empleados');
  }

  const localResult = await query('SELECT id, dni, activo, naaloo_id FROM beneficiarios');
  const localMap = new Map<string, { id: string; activo: boolean; naaloo_id: number | null }>();
  for (const row of localResult.rows) localMap.set(row.dni, row);

  type BenRow = { dni: string; nombre: string; apellido: string; email: string | null; telefono: string | null; nivel: string; departamento: string | null; sector: string | null; cargo: string | null; empresa: string; fecha_ingreso: string | null; naaloo_id: number };
  const toInsert: BenRow[] = [];
  const toReactivate: Array<{ id: string } & BenRow> = [];
  const toBaja: string[] = [];
  const toUpdate: Array<{ id: string } & BenRow> = [];
  const detalles: { dni: string; nombre: string; accion: string }[] = [];

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
      if (emp.activo) { toInsert.push(row); detalles.push({ dni: ben.dni, nombre: `${ben.nombre} ${ben.apellido}`, accion: 'alta' }); }
    } else if (emp.activo && !local.activo) {
      toReactivate.push({ id: local.id, ...row }); detalles.push({ dni: ben.dni, nombre: `${ben.nombre} ${ben.apellido}`, accion: 'reactivado' });
    } else if (!emp.activo && local.activo) {
      toBaja.push(local.id); detalles.push({ dni: ben.dni, nombre: `${ben.nombre} ${ben.apellido}`, accion: 'baja' });
    } else {
      toUpdate.push({ id: local.id, ...row });
    }
  }

  // ALTAS
  let altaIds: string[] = [];
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
       RETURNING id`,
      values
    );
    altaIds = insertRes.rows.map((r: any) => r.id);
  }

  // REACTIVACIONES
  const reactivaIds: string[] = [];
  for (const r of toReactivate) {
    await query(
      `UPDATE beneficiarios SET activo=TRUE,nombre=$1,apellido=$2,nivel=$3,departamento=$4,sector=$5,cargo=$6,naaloo_id=$7,motivo_baja=NULL,fecha_baja=NULL,ultima_sync=NOW(),updated_at=NOW() WHERE id=$8`,
      [r.nombre, r.apellido, r.nivel, r.departamento, r.sector, r.cargo, r.naaloo_id, r.id]
    );
    reactivaIds.push(r.id);
  }

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
  }

  // ACTUALIZACIONES
  if (toUpdate.length > 0) {
    const placeholders = toUpdate.map((_, i) => {
      const base = i * 8;
      return `($${base+1}::uuid,$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8})`;
    }).join(',');
    const values = toUpdate.flatMap(r => [r.id, r.nombre, r.apellido, r.nivel, r.departamento, r.sector, r.cargo, r.naaloo_id]);
    await query(
      `UPDATE beneficiarios b SET nombre=v.nombre,apellido=v.apellido,nivel=v.nivel,departamento=v.departamento,
         sector=v.sector,cargo=v.cargo,naaloo_id=v.naaloo_id::int,ultima_sync=NOW(),updated_at=NOW()
       FROM (VALUES ${placeholders}) AS v(id,nombre,apellido,nivel,departamento,sector,cargo,naaloo_id)
       WHERE b.id = v.id::uuid`,
      values
    ).catch(async () => {
      for (const r of toUpdate) {
        await query(
          `UPDATE beneficiarios SET nombre=$1,apellido=$2,nivel=$3,departamento=$4,sector=$5,cargo=$6,naaloo_id=$7,ultima_sync=NOW(),updated_at=NOW() WHERE id=$8`,
          [r.nombre, r.apellido, r.nivel, r.departamento, r.sector, r.cargo, r.naaloo_id, r.id]
        ).catch(() => {});
      }
    });
  }

  // LOGS
  const logRows = [
    ...altaIds.map(id => [id, 'sync_alta', 'Alta automatica desde Naaloo', adminNombre]),
    ...reactivaIds.map(id => [id, 'sync_alta', 'Reactivado automaticamente desde Naaloo', adminNombre]),
    ...toBaja.map(id => [id, 'sync_baja', 'Baja automatica - empleado inactivo en Naaloo', adminNombre]),
  ];
  if (logRows.length > 0) {
    const logPlaceholders = logRows.map((_, i) => {
      const base = i * 4;
      return `($${base+1},$${base+2},$${base+3},$${base+4})`;
    }).join(',');
    await query(
      `INSERT INTO autorizacion_logs (beneficiario_id, accion, motivo, autorizado_por) VALUES ${logPlaceholders}`,
      logRows.flat()
    ).catch(() => {});
  }

  return {
    exito: true,
    resumen: {
      totalNaaloo: empleados.length,
      altas: toInsert.length,
      reactivados: toReactivate.length,
      bajas: toBaja.length,
      actualizados: toUpdate.length,
      sinCambios: empleados.length - toInsert.length - toReactivate.length - toBaja.length - toUpdate.length,
    },
    detalles,
  };
}
