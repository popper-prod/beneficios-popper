import { Router, Response } from 'express';
import { query } from '../db';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { obtenerTodosEmpleados, naalooToBeneficiario } from '../services/naaloo';

const router = Router();
router.use(verifyToken);

// GET /api/admin/dashboard - Estadisticas generales
router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    const [
      verificacionesHoy,
      verificacionesSemana,
      verificacionesMes,
      totalBeneficiarios,
      totalComercios,
      totalBeneficios,
      topBeneficios,
      topComercios,
      verificacionesPorDia,
      ultimasVerificaciones,
    ] = await Promise.all([
      query(`SELECT COUNT(*) as total FROM verificaciones WHERE fecha_verificacion >= CURRENT_DATE AND estado = 'exitoso'`),
      query(`SELECT COUNT(*) as total FROM verificaciones WHERE fecha_verificacion >= date_trunc('week', CURRENT_DATE) AND estado = 'exitoso'`),
      query(`SELECT COUNT(*) as total FROM verificaciones WHERE fecha_verificacion >= date_trunc('month', CURRENT_DATE) AND estado = 'exitoso'`),
      query(`SELECT COUNT(*) as total FROM beneficiarios WHERE activo = TRUE`),
      query(`SELECT COUNT(*) as total FROM comercios WHERE activo = TRUE`),
      query(`SELECT COUNT(*) as total FROM beneficios WHERE activo = TRUE`),
      query(`
        SELECT b.nombre, COUNT(v.id) as total_usos
        FROM verificaciones v
        JOIN beneficios b ON b.id = v.beneficio_id
        WHERE v.estado = 'exitoso' AND v.fecha_verificacion >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY b.nombre ORDER BY total_usos DESC LIMIT 5
      `),
      query(`
        SELECT c.nombre, COUNT(v.id) as total_usos
        FROM verificaciones v
        JOIN comercios c ON c.id = v.comercio_id
        WHERE v.estado = 'exitoso' AND v.fecha_verificacion >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY c.nombre ORDER BY total_usos DESC LIMIT 5
      `),
      query(`
        SELECT DATE(fecha_verificacion) as fecha, COUNT(*) as total
        FROM verificaciones
        WHERE fecha_verificacion >= CURRENT_DATE - INTERVAL '7 days' AND estado = 'exitoso'
        GROUP BY DATE(fecha_verificacion)
        ORDER BY fecha
      `),
      query(`
        SELECT v.id, v.estado, v.codigo_referencia, v.fecha_verificacion,
               b.nombre as beneficiario_nombre, b.apellido as beneficiario_apellido, b.dni,
               ben.nombre as beneficio_nombre,
               c.nombre as comercio_nombre
        FROM verificaciones v
        LEFT JOIN beneficiarios b ON b.id = v.beneficiario_id
        LEFT JOIN beneficios ben ON ben.id = v.beneficio_id
        LEFT JOIN comercios c ON c.id = v.comercio_id
        ORDER BY v.fecha_verificacion DESC LIMIT 20
      `),
    ]);

    res.json({
      stats: {
        verificacionesHoy: parseInt(verificacionesHoy.rows[0].total),
        verificacionesSemana: parseInt(verificacionesSemana.rows[0].total),
        verificacionesMes: parseInt(verificacionesMes.rows[0].total),
        totalBeneficiarios: parseInt(totalBeneficiarios.rows[0].total),
        totalComercios: parseInt(totalComercios.rows[0].total),
        totalBeneficios: parseInt(totalBeneficios.rows[0].total),
      },
      topBeneficios: topBeneficios.rows,
      topComercios: topComercios.rows,
      verificacionesPorDia: verificacionesPorDia.rows,
      ultimasVerificaciones: ultimasVerificaciones.rows,
    });
  } catch (error: any) {
    console.error('Dashboard error:', error.message);
    res.status(500).json({ error: 'Error cargando dashboard' });
  }
});

// GET /api/admin/verificaciones - Listado completo con filtros
router.get('/verificaciones', async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '50', estado, comercio_id, desde, hasta } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let where = 'WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    if (estado) { where += ` AND v.estado = $${paramIdx++}`; params.push(estado); }
    if (comercio_id) { where += ` AND v.comercio_id = $${paramIdx++}`; params.push(comercio_id); }
    if (desde) { where += ` AND v.fecha_verificacion >= $${paramIdx++}`; params.push(desde); }
    if (hasta) { where += ` AND v.fecha_verificacion <= $${paramIdx++}`; params.push(hasta); }

    const [countResult, dataResult] = await Promise.all([
      query(`SELECT COUNT(*) as total FROM verificaciones v ${where}`, params),
      query(`
        SELECT v.id, v.estado, v.codigo_referencia, v.fecha_verificacion, v.monto_original, v.monto_descuento, v.monto_final,
               b.nombre as beneficiario_nombre, b.apellido as beneficiario_apellido, b.dni, b.nivel,
               ben.nombre as beneficio_nombre, ben.tipo as beneficio_tipo,
               c.nombre as comercio_nombre
        FROM verificaciones v
        LEFT JOIN beneficiarios b ON b.id = v.beneficiario_id
        LEFT JOIN beneficios ben ON ben.id = v.beneficio_id
        LEFT JOIN comercios c ON c.id = v.comercio_id
        ${where}
        ORDER BY v.fecha_verificacion DESC
        LIMIT $${paramIdx++} OFFSET $${paramIdx++}
      `, [...params, parseInt(limit as string), offset]),
    ]);

    res.json({
      verificaciones: dataResult.rows,
      total: parseInt(countResult.rows[0].total),
      page: parseInt(page as string),
      totalPages: Math.ceil(parseInt(countResult.rows[0].total) / parseInt(limit as string)),
    });
  } catch (error: any) {
    console.error('Verificaciones error:', error.message);
    res.status(500).json({ error: 'Error cargando verificaciones' });
  }
});

// GET /api/admin/beneficios - Listar beneficios
router.get('/beneficios', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM beneficios ORDER BY created_at DESC'
    );
    res.json({ beneficios: result.rows });
  } catch (error: any) {
    res.status(500).json({ error: 'Error cargando beneficios' });
  }
});

// GET /api/admin/comercios - Listar comercios
router.get('/comercios', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM comercios ORDER BY created_at DESC'
    );
    res.json({ comercios: result.rows });
  } catch (error: any) {
    res.status(500).json({ error: 'Error cargando comercios' });
  }
});

// GET /api/admin/beneficiarios - Listar beneficiarios
router.get('/beneficiarios', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM beneficiarios ORDER BY created_at DESC'
    );
    res.json({ beneficiarios: result.rows });
  } catch (error: any) {
    res.status(500).json({ error: 'Error cargando beneficiarios' });
  }
});

// ============================================
// CRUD BENEFICIOS
// ============================================

// POST /api/admin/beneficios - Crear beneficio
router.post('/beneficios', async (req: AuthRequest, res: Response) => {
  try {
    const { nombre, descripcion, tipo, nivel_minimo, descuento, valor_fijo, fecha_inicio, fecha_fin, horario_inicio, horario_fin, limite_uso_diario, limite_uso_mensual } = req.body;
    if (!nombre || !tipo || !nivel_minimo || !fecha_inicio || !fecha_fin) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    const result = await query(
      `INSERT INTO beneficios (nombre, descripcion, tipo, nivel_minimo, descuento, valor_fijo, fecha_inicio, fecha_fin, horario_inicio, horario_fin, limite_uso_diario, limite_uso_mensual, activo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE) RETURNING *`,
      [nombre, descripcion || null, tipo, nivel_minimo, descuento || null, valor_fijo || null, fecha_inicio, fecha_fin, horario_inicio || null, horario_fin || null, limite_uso_diario || null, limite_uso_mensual || null]
    );
    res.json({ beneficio: result.rows[0] });
  } catch (error: any) {
    console.error('Error creando beneficio:', error.message);
    res.status(500).json({ error: 'Error creando beneficio' });
  }
});

// PUT /api/admin/beneficios/:id - Editar beneficio
router.put('/beneficios/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, tipo, nivel_minimo, descuento, valor_fijo, fecha_inicio, fecha_fin, horario_inicio, horario_fin, limite_uso_diario, limite_uso_mensual, activo } = req.body;
    const result = await query(
      `UPDATE beneficios SET nombre=$1, descripcion=$2, tipo=$3, nivel_minimo=$4, descuento=$5, valor_fijo=$6, fecha_inicio=$7, fecha_fin=$8, horario_inicio=$9, horario_fin=$10, limite_uso_diario=$11, limite_uso_mensual=$12, activo=$13, updated_at=NOW()
       WHERE id=$14 RETURNING *`,
      [nombre, descripcion || null, tipo, nivel_minimo, descuento || null, valor_fijo || null, fecha_inicio, fecha_fin, horario_inicio || null, horario_fin || null, limite_uso_diario || null, limite_uso_mensual || null, activo, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Beneficio no encontrado' });
    res.json({ beneficio: result.rows[0] });
  } catch (error: any) {
    console.error('Error editando beneficio:', error.message);
    res.status(500).json({ error: 'Error editando beneficio' });
  }
});

// DELETE /api/admin/beneficios/:id - Eliminar beneficio
router.delete('/beneficios/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM comercio_beneficios WHERE beneficio_id = $1', [id]);
    const result = await query('DELETE FROM beneficios WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Beneficio no encontrado' });
    res.json({ eliminado: true });
  } catch (error: any) {
    console.error('Error eliminando beneficio:', error.message);
    res.status(500).json({ error: 'Error eliminando beneficio' });
  }
});

// ============================================
// CRUD COMERCIOS
// ============================================

// POST /api/admin/comercios - Crear comercio
router.post('/comercios', async (req: AuthRequest, res: Response) => {
  try {
    const { nombre, direccion, ciudad, provincia, telefono, email, horario_apertura, horario_cierre, responsable } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre es requerido' });
    const qr_code = `QR-${nombre.replace(/\s+/g, '-').toUpperCase().substring(0, 20)}-${Date.now().toString(36).toUpperCase()}`;
    const result = await query(
      `INSERT INTO comercios (nombre, direccion, ciudad, provincia, telefono, email, horario_apertura, horario_cierre, responsable, qr_code, activo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE) RETURNING *`,
      [nombre, direccion || null, ciudad || null, provincia || null, telefono || null, email || null, horario_apertura || null, horario_cierre || null, responsable || null, qr_code]
    );
    res.json({ comercio: result.rows[0] });
  } catch (error: any) {
    console.error('Error creando comercio:', error.message);
    res.status(500).json({ error: 'Error creando comercio' });
  }
});

// PUT /api/admin/comercios/:id - Editar comercio
router.put('/comercios/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { nombre, direccion, ciudad, provincia, telefono, email, horario_apertura, horario_cierre, responsable, activo } = req.body;
    const result = await query(
      `UPDATE comercios SET nombre=$1, direccion=$2, ciudad=$3, provincia=$4, telefono=$5, email=$6, horario_apertura=$7, horario_cierre=$8, responsable=$9, activo=$10, updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [nombre, direccion || null, ciudad || null, provincia || null, telefono || null, email || null, horario_apertura || null, horario_cierre || null, responsable || null, activo, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Comercio no encontrado' });
    res.json({ comercio: result.rows[0] });
  } catch (error: any) {
    console.error('Error editando comercio:', error.message);
    res.status(500).json({ error: 'Error editando comercio' });
  }
});

// DELETE /api/admin/comercios/:id - Eliminar comercio
router.delete('/comercios/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM comercio_beneficios WHERE comercio_id = $1', [id]);
    const result = await query('DELETE FROM comercios WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Comercio no encontrado' });
    res.json({ eliminado: true });
  } catch (error: any) {
    console.error('Error eliminando comercio:', error.message);
    res.status(500).json({ error: 'Error eliminando comercio' });
  }
});

// ============================================
// CRUD BENEFICIARIOS
// ============================================

// POST /api/admin/beneficiarios - Crear beneficiario
router.post('/beneficiarios', async (req: AuthRequest, res: Response) => {
  try {
    const { dni, nombre, apellido, email, telefono, nivel, departamento, empresa } = req.body;
    if (!dni || !nombre || !apellido || !nivel) return res.status(400).json({ error: 'Faltan campos requeridos' });
    const result = await query(
      `INSERT INTO beneficiarios (dni, nombre, apellido, email, telefono, nivel, departamento, empresa, activo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE) RETURNING *`,
      [dni, nombre, apellido, email || null, telefono || null, nivel, departamento || null, empresa || 'Grupo Popper']
    );
    res.json({ beneficiario: result.rows[0] });
  } catch (error: any) {
    if (error.message?.includes('duplicate')) return res.status(409).json({ error: 'Ya existe un beneficiario con ese DNI' });
    console.error('Error creando beneficiario:', error.message);
    res.status(500).json({ error: 'Error creando beneficiario' });
  }
});

// PUT /api/admin/beneficiarios/:id - Editar beneficiario
router.put('/beneficiarios/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, email, telefono, nivel, departamento, empresa, activo } = req.body;
    const result = await query(
      `UPDATE beneficiarios SET nombre=$1, apellido=$2, email=$3, telefono=$4, nivel=$5, departamento=$6, empresa=$7, activo=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [nombre, apellido, email || null, telefono || null, nivel, departamento || null, empresa || 'Grupo Popper', activo, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Beneficiario no encontrado' });
    res.json({ beneficiario: result.rows[0] });
  } catch (error: any) {
    console.error('Error editando beneficiario:', error.message);
    res.status(500).json({ error: 'Error editando beneficiario' });
  }
});

// DELETE /api/admin/beneficiarios/:id - Eliminar beneficiario
router.delete('/beneficiarios/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM beneficiarios WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Beneficiario no encontrado' });
    res.json({ eliminado: true });
  } catch (error: any) {
    console.error('Error eliminando beneficiario:', error.message);
    res.status(500).json({ error: 'Error eliminando beneficiario' });
  }
});

// ============================================
// VINCULAR COMERCIO ↔ BENEFICIO
// ============================================

// POST /api/admin/comercio-beneficios - Vincular
router.post('/comercio-beneficios', async (req: AuthRequest, res: Response) => {
  try {
    const { comercio_id, beneficio_id } = req.body;
    if (!comercio_id || !beneficio_id) return res.status(400).json({ error: 'Faltan datos' });
    await query(
      `INSERT INTO comercio_beneficios (comercio_id, beneficio_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [comercio_id, beneficio_id]
    );
    res.json({ vinculado: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Error vinculando' });
  }
});

// DELETE /api/admin/comercio-beneficios - Desvincular
router.delete('/comercio-beneficios', async (req: AuthRequest, res: Response) => {
  try {
    const { comercio_id, beneficio_id } = req.body;
    await query('DELETE FROM comercio_beneficios WHERE comercio_id = $1 AND beneficio_id = $2', [comercio_id, beneficio_id]);
    res.json({ desvinculado: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Error desvinculando' });
  }
});

// GET /api/admin/comercio-beneficios/:comercioId - Beneficios de un comercio
router.get('/comercio-beneficios/:comercioId', async (req: AuthRequest, res: Response) => {
  try {
    const { comercioId } = req.params;
    const result = await query(
      `SELECT b.* FROM beneficios b
       INNER JOIN comercio_beneficios cb ON cb.beneficio_id = b.id
       WHERE cb.comercio_id = $1 ORDER BY b.nombre`,
      [comercioId]
    );
    res.json({ beneficios: result.rows });
  } catch (error: any) {
    res.status(500).json({ error: 'Error cargando beneficios del comercio' });
  }
});

// ============================================
// LIMPIAR DUPLICADOS
// ============================================
router.post('/limpiar-duplicados', async (req: AuthRequest, res: Response) => {
  try {
    // Eliminar comercios duplicados (mantener el más reciente)
    const dupComercios = await query(`
      DELETE FROM comercios WHERE id NOT IN (
        SELECT DISTINCT ON (qr_code) id FROM comercios ORDER BY qr_code, created_at DESC
      ) AND id NOT IN (SELECT DISTINCT comercio_id FROM verificaciones)
      RETURNING id
    `);

    // Eliminar beneficios duplicados (mantener el más reciente)
    const dupBeneficios = await query(`
      DELETE FROM beneficios WHERE id NOT IN (
        SELECT DISTINCT ON (nombre) id FROM beneficios ORDER BY nombre, created_at DESC
      ) AND id NOT IN (SELECT DISTINCT beneficio_id FROM verificaciones)
      RETURNING id
    `);

    // Limpiar comercio_beneficios huérfanos
    await query(`DELETE FROM comercio_beneficios WHERE comercio_id NOT IN (SELECT id FROM comercios) OR beneficio_id NOT IN (SELECT id FROM beneficios)`);

    res.json({
      eliminados: {
        comercios: dupComercios.rows.length,
        beneficios: dupBeneficios.rows.length,
      }
    });
  } catch (error: any) {
    console.error('Error limpiando duplicados:', error.message);
    res.status(500).json({ error: 'Error limpiando duplicados', detalle: error.message });
  }
});

// ============================================
// EXPORTAR VERIFICACIONES CSV
// ============================================
router.get('/exportar-verificaciones', async (req: AuthRequest, res: Response) => {
  try {
    const { desde, hasta } = req.query;
    let where = "WHERE 1=1";
    const params: any[] = [];
    let idx = 1;
    if (desde) { where += ` AND v.fecha_verificacion >= $${idx++}`; params.push(desde); }
    if (hasta) { where += ` AND v.fecha_verificacion <= $${idx++}`; params.push(hasta); }

    const result = await query(`
      SELECT v.fecha_verificacion, v.estado, v.codigo_referencia, v.monto_original, v.monto_descuento, v.monto_final,
             b.dni, b.nombre as beneficiario_nombre, b.apellido as beneficiario_apellido, b.nivel,
             ben.nombre as beneficio_nombre, ben.tipo as beneficio_tipo, ben.descuento,
             c.nombre as comercio_nombre, c.direccion as comercio_direccion
      FROM verificaciones v
      LEFT JOIN beneficiarios b ON b.id = v.beneficiario_id
      LEFT JOIN beneficios ben ON ben.id = v.beneficio_id
      LEFT JOIN comercios c ON c.id = v.comercio_id
      ${where}
      ORDER BY v.fecha_verificacion DESC
    `, params);

    // CSV
    const headers = ['Fecha', 'Estado', 'Codigo', 'DNI', 'Colaborador', 'Nivel', 'Beneficio', 'Tipo', 'Descuento%', 'Comercio', 'Direccion'];
    const rows = result.rows.map((r: any) => [
      new Date(r.fecha_verificacion).toLocaleString('es-AR'),
      r.estado, r.codigo_referencia, r.dni,
      `${r.beneficiario_nombre || ''} ${r.beneficiario_apellido || ''}`.trim(),
      r.nivel || '', r.beneficio_nombre || '', r.beneficio_tipo || '',
      r.descuento || '', r.comercio_nombre || '', r.comercio_direccion || '',
    ]);

    const csv = [headers.join(','), ...rows.map((r: string[]) => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="verificaciones_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send('﻿' + csv); // BOM for Excel UTF-8
  } catch (error: any) {
    console.error('Error exportando:', error.message);
    res.status(500).json({ error: 'Error exportando' });
  }
});

// ============================================
// MODULO DE AUTORIZACIONES - SYNC NAALOO
// ============================================

// POST /api/admin/migrar-autorizaciones - Ejecutar migracion de columnas
router.post('/migrar-autorizaciones', async (req: AuthRequest, res: Response) => {
  try {
    await query(`ALTER TABLE beneficiarios ADD COLUMN IF NOT EXISTS naaloo_id INT`);
    await query(`ALTER TABLE beneficiarios ADD COLUMN IF NOT EXISTS motivo_baja VARCHAR(200)`);
    await query(`ALTER TABLE beneficiarios ADD COLUMN IF NOT EXISTS fecha_baja TIMESTAMP`);
    await query(`ALTER TABLE beneficiarios ADD COLUMN IF NOT EXISTS autorizado_por VARCHAR(100)`);
    await query(`ALTER TABLE beneficiarios ADD COLUMN IF NOT EXISTS ultima_sync TIMESTAMP`);
    await query(`ALTER TABLE beneficiarios ADD COLUMN IF NOT EXISTS origen VARCHAR(20) DEFAULT 'manual'`);
    await query(`CREATE INDEX IF NOT EXISTS idx_beneficiarios_naaloo_id ON beneficiarios(naaloo_id)`);
    await query(`
      CREATE TABLE IF NOT EXISTS autorizacion_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        beneficiario_id UUID NOT NULL REFERENCES beneficiarios(id),
        accion VARCHAR(20) NOT NULL CHECK (accion IN ('activar', 'desactivar', 'sync_alta', 'sync_baja')),
        motivo VARCHAR(200),
        autorizado_por VARCHAR(100),
        fecha TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_autorizacion_logs_beneficiario ON autorizacion_logs(beneficiario_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_autorizacion_logs_fecha ON autorizacion_logs(fecha)`);
    res.json({ exito: true, mensaje: 'Migracion de autorizaciones completada' });
  } catch (error: any) {
    console.error('Error migrando:', error.message);
    res.status(500).json({ error: 'Error en migracion', detalle: error.message });
  }
});

// POST /api/admin/sync-naaloo - Sincronizar empleados con Naaloo
router.post('/sync-naaloo', async (req: AuthRequest, res: Response) => {
  try {
    const empleados = await obtenerTodosEmpleados();
    if (empleados.length === 0) {
      return res.status(502).json({ error: 'No se pudo conectar con Naaloo o no hay empleados' });
    }

    const adminNombre = (req as any).user?.nombre ? `${(req as any).user.nombre} ${(req as any).user.apellido || ''}`.trim() : 'Sistema';

    // Pre-cargar TODOS los beneficiarios locales en memoria (1 sola query)
    const localResult = await query('SELECT id, dni, activo, naaloo_id FROM beneficiarios');
    const localMap = new Map<string, { id: string; activo: boolean; naaloo_id: number | null }>();
    for (const row of localResult.rows) {
      localMap.set(row.dni, { id: row.id, activo: row.activo, naaloo_id: row.naaloo_id });
    }

    let altas = 0, bajas = 0, actualizados = 0;
    const detalles: { dni: string; nombre: string; accion: string }[] = [];
    const logInserts: { beneficiario_id: string; accion: string; motivo: string }[] = [];

    for (const emp of empleados) {
      const ben = naalooToBeneficiario(emp);
      const fechaIngreso = ben.fecha_ingreso ? new Date(ben.fecha_ingreso) : null;
      const fechaValida = fechaIngreso && !isNaN(fechaIngreso.getTime()) ? fechaIngreso.toISOString().split('T')[0] : null;
      const local = localMap.get(ben.dni);

      if (!local) {
        // Empleado nuevo — insertar solo si activo en Naaloo
        if (emp.activo) {
          const inserted = await query(
            `INSERT INTO beneficiarios (dni, nombre, apellido, email, telefono, nivel, departamento, empresa, fecha_ingreso, activo, naaloo_id, origen, ultima_sync)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,$10,'naaloo',NOW())
             ON CONFLICT (dni) DO UPDATE SET nombre=EXCLUDED.nombre, apellido=EXCLUDED.apellido, naaloo_id=EXCLUDED.naaloo_id, ultima_sync=NOW()
             RETURNING id`,
            [ben.dni, ben.nombre, ben.apellido, ben.email || null, (ben.telefono || '').substring(0, 20) || null, ben.nivel, ben.departamento || null, ben.empresa, fechaValida, emp.id]
          );
          logInserts.push({ beneficiario_id: inserted.rows[0].id, accion: 'sync_alta', motivo: 'Alta automatica desde Naaloo' });
          altas++;
          detalles.push({ dni: ben.dni, nombre: `${ben.nombre} ${ben.apellido}`, accion: 'alta' });
        }
      } else if (emp.activo && !local.activo) {
        // Reactivar
        await query(
          `UPDATE beneficiarios SET activo=TRUE, nombre=$1, apellido=$2, nivel=$3, departamento=$4, naaloo_id=$5, motivo_baja=NULL, fecha_baja=NULL, ultima_sync=NOW(), updated_at=NOW() WHERE id=$6`,
          [ben.nombre, ben.apellido, ben.nivel, ben.departamento || null, emp.id, local.id]
        );
        logInserts.push({ beneficiario_id: local.id, accion: 'sync_alta', motivo: 'Reactivado automaticamente desde Naaloo' });
        altas++;
        detalles.push({ dni: ben.dni, nombre: `${ben.nombre} ${ben.apellido}`, accion: 'reactivado' });
      } else if (!emp.activo && local.activo) {
        // Baja
        await query(
          `UPDATE beneficiarios SET activo=FALSE, naaloo_id=$1, motivo_baja='Baja detectada en Naaloo', fecha_baja=NOW(), autorizado_por='Sync Naaloo', ultima_sync=NOW(), updated_at=NOW() WHERE id=$2`,
          [emp.id, local.id]
        );
        logInserts.push({ beneficiario_id: local.id, accion: 'sync_baja', motivo: 'Baja automatica - empleado inactivo en Naaloo' });
        bajas++;
        detalles.push({ dni: ben.dni, nombre: `${ben.nombre} ${ben.apellido}`, accion: 'baja' });
      } else {
        // Solo actualizar datos
        await query(
          `UPDATE beneficiarios SET nombre=$1, apellido=$2, nivel=$3, departamento=$4, naaloo_id=$5, ultima_sync=NOW(), updated_at=NOW() WHERE id=$6`,
          [ben.nombre, ben.apellido, ben.nivel, ben.departamento || null, emp.id, local.id]
        );
        actualizados++;
      }
    }

    // Insertar todos los logs de una vez
    for (const log of logInserts) {
      await query(
        `INSERT INTO autorizacion_logs (beneficiario_id, accion, motivo, autorizado_por) VALUES ($1, $2, $3, $4)`,
        [log.beneficiario_id, log.accion, log.motivo, adminNombre]
      );
    }

    res.json({
      exito: true,
      resumen: {
        totalNaaloo: empleados.length,
        altas,
        bajas,
        actualizados,
        sinCambios: empleados.length - altas - bajas - actualizados,
      },
      detalles,
    });
  } catch (error: any) {
    console.error('Error sincronizando con Naaloo:', error.message);
    res.status(500).json({ error: 'Error sincronizando', detalle: error.message });
  }
});

// POST /api/admin/autorizar - Activar o desactivar un beneficiario manualmente
router.post('/autorizar', async (req: AuthRequest, res: Response) => {
  try {
    const { beneficiario_id, accion, motivo } = req.body;
    if (!beneficiario_id || !accion || !['activar', 'desactivar'].includes(accion)) {
      return res.status(400).json({ error: 'Datos invalidos. Requerido: beneficiario_id, accion (activar/desactivar)' });
    }

    const adminNombre = (req as any).user?.nombre ? `${(req as any).user.nombre} ${(req as any).user.apellido || ''}`.trim() : 'Admin';

    if (accion === 'desactivar') {
      await query(
        `UPDATE beneficiarios SET activo=FALSE, motivo_baja=$1, fecha_baja=NOW(), autorizado_por=$2, updated_at=NOW() WHERE id=$3`,
        [motivo || 'Desactivacion manual', adminNombre, beneficiario_id]
      );
    } else {
      await query(
        `UPDATE beneficiarios SET activo=TRUE, motivo_baja=NULL, fecha_baja=NULL, autorizado_por=NULL, updated_at=NOW() WHERE id=$1`,
        [beneficiario_id]
      );
    }

    await query(
      `INSERT INTO autorizacion_logs (beneficiario_id, accion, motivo, autorizado_por) VALUES ($1, $2, $3, $4)`,
      [beneficiario_id, accion, motivo || (accion === 'desactivar' ? 'Desactivacion manual' : 'Reactivacion manual'), adminNombre]
    );

    res.json({ exito: true, accion });
  } catch (error: any) {
    console.error('Error autorizando:', error.message);
    res.status(500).json({ error: 'Error procesando autorizacion', detalle: error.message });
  }
});

// POST /api/admin/autorizar-bulk - Activar o desactivar varios beneficiarios
router.post('/autorizar-bulk', async (req: AuthRequest, res: Response) => {
  try {
    const { ids, accion, motivo } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0 || !accion || !['activar', 'desactivar'].includes(accion)) {
      return res.status(400).json({ error: 'Datos invalidos. Requerido: ids (array), accion (activar/desactivar)' });
    }

    const adminNombre = (req as any).user?.nombre ? `${(req as any).user.nombre} ${(req as any).user.apellido || ''}`.trim() : 'Admin';
    const motivoFinal = motivo || (accion === 'desactivar' ? 'Desactivacion masiva' : 'Reactivacion masiva');
    let procesados = 0;

    for (const id of ids) {
      if (accion === 'desactivar') {
        await query(
          `UPDATE beneficiarios SET activo=FALSE, motivo_baja=$1, fecha_baja=NOW(), autorizado_por=$2, updated_at=NOW() WHERE id=$3`,
          [motivoFinal, adminNombre, id]
        );
      } else {
        await query(
          `UPDATE beneficiarios SET activo=TRUE, motivo_baja=NULL, fecha_baja=NULL, autorizado_por=NULL, updated_at=NOW() WHERE id=$1`,
          [id]
        );
      }

      await query(
        `INSERT INTO autorizacion_logs (beneficiario_id, accion, motivo, autorizado_por) VALUES ($1, $2, $3, $4)`,
        [id, accion, motivoFinal, adminNombre]
      );
      procesados++;
    }

    res.json({ exito: true, procesados, accion });
  } catch (error: any) {
    console.error('Error autorizacion masiva:', error.message);
    res.status(500).json({ error: 'Error procesando autorizacion masiva', detalle: error.message });
  }
});

// GET /api/admin/autorizacion-logs - Historial de cambios de autorizacion
router.get('/autorizacion-logs', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT al.id, al.accion, al.motivo, al.autorizado_por, al.fecha,
             b.dni, b.nombre, b.apellido
      FROM autorizacion_logs al
      LEFT JOIN beneficiarios b ON b.id = al.beneficiario_id
      ORDER BY al.fecha DESC
      LIMIT 100
    `);
    res.json({ logs: result.rows });
  } catch (error: any) {
    // Si la tabla no existe aun, devolver vacio
    res.json({ logs: [] });
  }
});

export default router;
