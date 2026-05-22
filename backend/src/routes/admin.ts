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

export default router;
