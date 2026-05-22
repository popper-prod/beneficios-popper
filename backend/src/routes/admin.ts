import { Router, Response } from 'express';
import { query } from '../db';
import { verifyToken, AuthRequest } from '../middleware/auth';

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

export default router;
