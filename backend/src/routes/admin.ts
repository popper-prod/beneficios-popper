import { Router, Response } from 'express';
import { query } from '../db';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { obtenerTodosEmpleados, naalooToBeneficiario, obtenerEmpleadoCompleto, NaalooFamiliar, normalizarRelacion } from '../services/naaloo';
import { runSyncNaaloo } from '../services/syncService';
import * as XLSX from 'xlsx';
import bcrypt from 'bcryptjs';

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
               v.retirado_por_dni, v.retirado_por_nombre, v.invitados_count,
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

// GET /api/admin/beneficios - Listar beneficios (con paginación)
router.get('/beneficios', async (req: AuthRequest, res: Response) => {
  try {
    const includeInactive = req.query.include_inactive === 'true' || req.query.all === 'true';
    const page = Math.max(1, parseInt(req.query.page as string || '1'));
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string || '100')));
    const offset = (page - 1) * limit;
    const whereClause = includeInactive ? '' : 'WHERE activo = TRUE';
    const [countRes, dataRes] = await Promise.all([
      query(`SELECT COUNT(*) as total FROM beneficios ${whereClause}`),
      query(`SELECT * FROM beneficios ${whereClause} ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]),
    ]);
    res.json({
      beneficios: dataRes.rows,
      total: parseInt(countRes.rows[0].total),
      page,
      totalPages: Math.ceil(parseInt(countRes.rows[0].total) / limit),
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Error cargando beneficios' });
  }
});

// GET /api/admin/comercios - Listar comercios (con paginación + count de beneficios vinculados)
router.get('/comercios', async (req: AuthRequest, res: Response) => {
  try {
    const includeInactive = req.query.include_inactive === 'true' || req.query.all === 'true';
    const page = Math.max(1, parseInt(req.query.page as string || '1'));
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string || '100')));
    const offset = (page - 1) * limit;
    const whereClause = includeInactive ? '' : 'WHERE c.activo = TRUE';
    const [countRes, dataRes] = await Promise.all([
      query(`SELECT COUNT(*) as total FROM comercios c ${whereClause}`),
      query(
        `SELECT c.*,
                (SELECT COUNT(*)::int FROM comercio_beneficios cb
                  INNER JOIN beneficios b ON b.id = cb.beneficio_id
                  WHERE cb.comercio_id = c.id AND b.activo = TRUE) AS beneficios_count
         FROM comercios c ${whereClause}
         ORDER BY c.created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
    ]);
    res.json({
      comercios: dataRes.rows,
      total: parseInt(countRes.rows[0].total),
      page,
      totalPages: Math.ceil(parseInt(countRes.rows[0].total) / limit),
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Error cargando comercios' });
  }
});

// GET /api/admin/beneficiarios - Listar beneficiarios (con paginación y búsqueda)
router.get('/beneficiarios', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string || '1'));
    const limit = Math.min(5000, Math.max(1, parseInt(req.query.limit as string || '2000')));
    const offset = (page - 1) * limit;
    const q = (req.query.q as string || '').trim();

    let whereClause = '';
    const params: any[] = [];
    if (q) {
      whereClause = `WHERE (LOWER(nombre) LIKE LOWER($1) OR LOWER(apellido) LIKE LOWER($1) OR dni LIKE $1 OR LOWER(email) LIKE LOWER($1))`;
      params.push(`%${q}%`);
    }

    const countParams = [...params];
    const dataParams = [...params, limit, offset];
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const [countRes, dataRes] = await Promise.all([
      query(`SELECT COUNT(*) as total FROM beneficiarios ${whereClause}`, countParams),
      query(`SELECT * FROM beneficiarios ${whereClause} ORDER BY created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`, dataParams),
    ]);
    res.json({
      beneficiarios: dataRes.rows,
      total: parseInt(countRes.rows[0].total),
      page,
      totalPages: Math.ceil(parseInt(countRes.rows[0].total) / limit),
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Error cargando beneficiarios' });
  }
});

// ============================================
// CRUD BENEFICIOS
// ============================================

// POST /api/admin/beneficios - Crear beneficio
// Asegurar columnas v2 del modelo extendido (idempotente)
let beneficiosV2Ensured = false;
async function ensureBeneficiosV2() {
  if (beneficiosV2Ensured) return;
  try {
    await query(`ALTER TABLE beneficios ADD COLUMN IF NOT EXISTS origen VARCHAR(20) DEFAULT 'externo'`);
    await query(`ALTER TABLE beneficios ADD COLUMN IF NOT EXISTS categoria VARCHAR(50)`);
    await query(`ALTER TABLE beneficios ADD COLUMN IF NOT EXISTS aplica_a VARCHAR(20) DEFAULT 'empleado'`);
    await query(`ALTER TABLE beneficios ADD COLUMN IF NOT EXISTS modalidad VARCHAR(20) DEFAULT 'descuento'`);
    await query(`ALTER TABLE beneficios ADD COLUMN IF NOT EXISTS escala_descuentos JSONB`);
    await query(`ALTER TABLE beneficios ADD COLUMN IF NOT EXISTS restricciones TEXT`);
    await query(`ALTER TABLE beneficios ADD COLUMN IF NOT EXISTS excluye_outlet BOOLEAN DEFAULT FALSE`);
    await query(`ALTER TABLE beneficios ADD COLUMN IF NOT EXISTS relaciones_familiar VARCHAR(100)`);
    await query(`ALTER TABLE beneficios ADD COLUMN IF NOT EXISTS usa_limite_jerarquia BOOLEAN DEFAULT FALSE`);
    // V4 — Talento: invitados
    await query(`ALTER TABLE beneficios ADD COLUMN IF NOT EXISTS max_invitados INT DEFAULT 0`);
    await query(`ALTER TABLE beneficios ADD COLUMN IF NOT EXISTS cubre_invitados BOOLEAN DEFAULT FALSE`);
    // V4 — verificaciones: registrar cantidad de invitados
    await query(`ALTER TABLE verificaciones ADD COLUMN IF NOT EXISTS invitados_count INT DEFAULT 0`);
    beneficiosV2Ensured = true;
  } catch { /* silencioso */ }
}

router.post('/beneficios', async (req: AuthRequest, res: Response) => {
  try {
    await ensureBeneficiosV2();
    const {
      nombre, descripcion, tipo, nivel_minimo, descuento, valor_fijo, fecha_inicio, fecha_fin,
      horario_inicio, horario_fin, limite_uso_diario, limite_uso_mensual,
      // V2 fields
      origen, categoria, aplica_a, modalidad, escala_descuentos,
      restricciones, excluye_outlet, relaciones_familiar, usa_limite_jerarquia,
      // V4 — Talento
      max_invitados, cubre_invitados,
    } = req.body;
    if (!nombre || !tipo || !fecha_inicio || !fecha_fin) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    const result = await query(
      `INSERT INTO beneficios (nombre, descripcion, tipo, nivel_minimo, descuento, valor_fijo,
                              fecha_inicio, fecha_fin, horario_inicio, horario_fin,
                              limite_uso_diario, limite_uso_mensual, activo,
                              origen, categoria, aplica_a, modalidad, escala_descuentos,
                              restricciones, excluye_outlet, relaciones_familiar, usa_limite_jerarquia,
                              max_invitados, cubre_invitados)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE,
               $13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) RETURNING *`,
      [nombre, descripcion || null, tipo, nivel_minimo || 'bronce', descuento || null, valor_fijo || null,
       fecha_inicio, fecha_fin, horario_inicio || null, horario_fin || null,
       limite_uso_diario || null, limite_uso_mensual || null,
       origen || 'externo', categoria || null, aplica_a || 'empleado', modalidad || 'descuento',
       escala_descuentos ? JSON.stringify(escala_descuentos) : null,
       restricciones || null, !!excluye_outlet,
       relaciones_familiar || null, !!usa_limite_jerarquia,
       parseInt(max_invitados) || 0, !!cubre_invitados]
    );
    res.json({ beneficio: result.rows[0] });
  } catch (error: any) {
    console.error('Error creando beneficio:', error.message);
    res.status(500).json({ error: 'Error creando beneficio', detalle: error.message });
  }
});

// PUT /api/admin/beneficios/:id - Editar beneficio
router.put('/beneficios/:id', async (req: AuthRequest, res: Response) => {
  try {
    await ensureBeneficiosV2();
    const { id } = req.params;
    const {
      nombre, descripcion, tipo, nivel_minimo, descuento, valor_fijo, fecha_inicio, fecha_fin,
      horario_inicio, horario_fin, limite_uso_diario, limite_uso_mensual, activo,
      origen, categoria, aplica_a, modalidad, escala_descuentos,
      restricciones, excluye_outlet, relaciones_familiar, usa_limite_jerarquia,
      // V4 — Talento
      max_invitados, cubre_invitados,
    } = req.body;
    const result = await query(
      `UPDATE beneficios SET nombre=$1, descripcion=$2, tipo=$3, nivel_minimo=$4, descuento=$5,
        valor_fijo=$6, fecha_inicio=$7, fecha_fin=$8, horario_inicio=$9, horario_fin=$10,
        limite_uso_diario=$11, limite_uso_mensual=$12, activo=$13,
        origen=$14, categoria=$15, aplica_a=$16, modalidad=$17, escala_descuentos=$18,
        restricciones=$19, excluye_outlet=$20, relaciones_familiar=$21, usa_limite_jerarquia=$22,
        max_invitados=$23, cubre_invitados=$24,
        updated_at=NOW()
       WHERE id=$25 RETURNING *`,
      [nombre, descripcion || null, tipo, nivel_minimo || 'bronce', descuento || null, valor_fijo || null,
       fecha_inicio, fecha_fin, horario_inicio || null, horario_fin || null,
       limite_uso_diario || null, limite_uso_mensual || null, activo !== false,
       origen || 'externo', categoria || null, aplica_a || 'empleado', modalidad || 'descuento',
       escala_descuentos ? JSON.stringify(escala_descuentos) : null,
       restricciones || null, !!excluye_outlet,
       relaciones_familiar || null, !!usa_limite_jerarquia,
       parseInt(max_invitados) || 0, !!cubre_invitados, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Beneficio no encontrado' });
    res.json({ beneficio: result.rows[0] });
  } catch (error: any) {
    console.error('Error editando beneficio:', error.message);
    res.status(500).json({ error: 'Error editando beneficio', detalle: error.message });
  }
});

// DELETE /api/admin/beneficios/:id - Eliminar beneficio
// Por default soft-delete cuando hay verificaciones históricas.
// Con ?force=true hace cascade: borra también verificaciones y vínculos.
router.delete('/beneficios/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const force = req.query.force === 'true';
    const used = await query('SELECT COUNT(*)::int AS c FROM verificaciones WHERE beneficio_id = $1', [id]);
    const usageCount = used.rows[0]?.c || 0;

    if (usageCount === 0 || force) {
      // Hard delete (con cascade si hay verificaciones y se pidió force)
      if (force && usageCount > 0) {
        await query('DELETE FROM verificaciones WHERE beneficio_id = $1', [id]);
      }
      await query('DELETE FROM comercio_beneficios WHERE beneficio_id = $1', [id]);
      const result = await query('DELETE FROM beneficios WHERE id = $1 RETURNING id', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Beneficio no encontrado' });
      return res.json({ eliminado: true, modo: 'hard', verificaciones_eliminadas: force ? usageCount : 0 });
    }

    // Soft delete (preserva el historial)
    const result = await query(
      'UPDATE beneficios SET activo = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Beneficio no encontrado' });
    res.json({ eliminado: true, modo: 'soft', verificaciones: usageCount });
  } catch (error: any) {
    console.error('Error eliminando beneficio:', error.message);
    res.status(500).json({ error: 'Error eliminando beneficio', detalle: error.message });
  }
});

// ============================================
// CRUD COMERCIOS
// ============================================

// Asegurar columnas v2/v3 de comercios (idempotente)
let comerciosV3Ensured = false;
async function ensureLogoColumn() {
  if (comerciosV3Ensured) return;
  try {
    await query(`ALTER TABLE comercios ADD COLUMN IF NOT EXISTS logo TEXT`);
    await query(`ALTER TABLE comercios ADD COLUMN IF NOT EXISTS pin_responsable VARCHAR(60)`);
    comerciosV3Ensured = true;
  } catch (e) { /* silencioso */ }
}

// POST /api/admin/comercios - Crear comercio
router.post('/comercios', async (req: AuthRequest, res: Response) => {
  try {
    await ensureLogoColumn();
    const { nombre, direccion, ciudad, provincia, telefono, email, horario_apertura, horario_cierre, responsable, logo, pin } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre es requerido' });
    const qr_code = `QR-${nombre.replace(/\s+/g, '-').toUpperCase().substring(0, 20)}-${Date.now().toString(36).toUpperCase()}`;
    // Hashear PIN si viene (mínimo 4 dígitos)
    let pinHash: string | null = null;
    if (pin && /^\d{4,8}$/.test(String(pin))) {
      pinHash = await bcrypt.hash(String(pin), 8);
    }
    const result = await query(
      `INSERT INTO comercios (nombre, direccion, ciudad, provincia, telefono, email, horario_apertura, horario_cierre, responsable, qr_code, logo, pin_responsable, activo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE) RETURNING *`,
      [nombre, direccion || null, ciudad || null, provincia || null, telefono || null, email || null, horario_apertura || null, horario_cierre || null, responsable || null, qr_code, logo || null, pinHash]
    );
    // No devolver el hash del PIN
    delete result.rows[0].pin_responsable;
    res.json({ comercio: result.rows[0] });
  } catch (error: any) {
    console.error('Error creando comercio:', error.message);
    res.status(500).json({ error: 'Error creando comercio' });
  }
});

// PUT /api/admin/comercios/:id - Editar comercio
router.put('/comercios/:id', async (req: AuthRequest, res: Response) => {
  try {
    await ensureLogoColumn();
    const { id } = req.params;
    const { nombre, direccion, ciudad, provincia, telefono, email, horario_apertura, horario_cierre, responsable, activo, logo, pin } = req.body;
    // Si pin viene vacío string → mantener actual. Si tiene contenido válido → hashear.
    let pinClause = '';
    let pinValue: any = null;
    if (pin !== undefined && pin !== null && pin !== '') {
      if (/^\d{4,8}$/.test(String(pin))) {
        pinValue = await bcrypt.hash(String(pin), 8);
        pinClause = ', pin_responsable=$13';
      }
    } else if (pin === '') {
      // explícitamente borrar
      pinValue = null;
      pinClause = ', pin_responsable=NULL';
    }

    const baseParams = [nombre, direccion || null, ciudad || null, provincia || null, telefono || null, email || null, horario_apertura || null, horario_cierre || null, responsable || null, activo, logo || null, id];
    const params = pinClause.includes('$13') ? [...baseParams.slice(0, 11), id, pinValue] : baseParams;

    const result = await query(
      `UPDATE comercios SET nombre=$1, direccion=$2, ciudad=$3, provincia=$4, telefono=$5, email=$6, horario_apertura=$7, horario_cierre=$8, responsable=$9, activo=$10, logo=$11${pinClause}, updated_at=NOW()
       WHERE id=$12 RETURNING *`,
      pinClause.includes('$13') ? [nombre, direccion || null, ciudad || null, provincia || null, telefono || null, email || null, horario_apertura || null, horario_cierre || null, responsable || null, activo, logo || null, id, pinValue] : baseParams
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Comercio no encontrado' });
    delete result.rows[0].pin_responsable;
    res.json({ comercio: result.rows[0] });
  } catch (error: any) {
    console.error('Error editando comercio:', error.message);
    res.status(500).json({ error: 'Error editando comercio' });
  }
});

// DELETE /api/admin/comercios/:id - Eliminar comercio
// Por default soft-delete cuando hay verificaciones históricas.
// Con ?force=true hace cascade: borra también verificaciones y vínculos.
router.delete('/comercios/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const force = req.query.force === 'true';
    const used = await query('SELECT COUNT(*)::int AS c FROM verificaciones WHERE comercio_id = $1', [id]);
    const usageCount = used.rows[0]?.c || 0;

    if (usageCount === 0 || force) {
      // Hard delete (con cascade si hay verificaciones y se pidió force)
      if (force && usageCount > 0) {
        await query('DELETE FROM verificaciones WHERE comercio_id = $1', [id]);
      }
      await query('DELETE FROM comercio_beneficios WHERE comercio_id = $1', [id]);
      const result = await query('DELETE FROM comercios WHERE id = $1 RETURNING id', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Comercio no encontrado' });
      return res.json({ eliminado: true, modo: 'hard', verificaciones_eliminadas: force ? usageCount : 0 });
    }

    // Soft delete
    const result = await query(
      'UPDATE comercios SET activo = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Comercio no encontrado' });
    res.json({ eliminado: true, modo: 'soft', verificaciones: usageCount });
  } catch (error: any) {
    console.error('Error eliminando comercio:', error.message);
    res.status(500).json({ error: 'Error eliminando comercio', detalle: error.message });
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

// DELETE /api/admin/beneficiarios/:id - Eliminar beneficiario (soft si tiene verificaciones)
router.delete('/beneficiarios/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    // Verificar si tiene verificaciones históricas
    const used = await query('SELECT COUNT(*)::int AS c FROM verificaciones WHERE beneficiario_id = $1', [id]);
    const usageCount = used.rows[0]?.c || 0;

    if (usageCount === 0) {
      // Sin historial: hard delete (también limpia familiares)
      await query('DELETE FROM familiares WHERE beneficiario_id = $1', [id]);
      const result = await query('DELETE FROM beneficiarios WHERE id = $1 RETURNING id', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Beneficiario no encontrado' });
      return res.json({ eliminado: true, modo: 'hard' });
    }

    // Con historial: soft delete para preservar integridad del historial
    const result = await query(
      `UPDATE beneficiarios SET activo = FALSE, motivo_baja = 'Dado de baja manualmente', fecha_baja = NOW(), updated_at = NOW() WHERE id = $1 RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Beneficiario no encontrado' });
    // Cascada: desactivar familiares también
    await query('UPDATE familiares SET activo = FALSE, updated_at = NOW() WHERE beneficiario_id = $1', [id]).catch(() => {});
    res.json({ eliminado: true, modo: 'soft', verificaciones: usageCount });
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
      SELECT v.fecha_verificacion, v.estado, v.codigo_referencia,
             v.monto_original, v.monto_descuento, v.monto_final,
             COALESCE(v.beneficiario_dni, b.dni) as dni,
             b.nombre as beneficiario_nombre, b.apellido as beneficiario_apellido, b.nivel,
             ben.nombre as beneficio_nombre, ben.tipo as beneficio_tipo,
             c.nombre as comercio_nombre, c.direccion as comercio_direccion
      FROM verificaciones v
      LEFT JOIN beneficiarios b ON b.id = v.beneficiario_id
      LEFT JOIN beneficios ben ON ben.id = v.beneficio_id
      LEFT JOIN comercios c ON c.id = v.comercio_id
      ${where}
      ORDER BY v.fecha_verificacion DESC
      LIMIT 10000
    `, params);

    // CSV — usa monto_descuento real del canje, no el % actual del beneficio
    const headers = ['Fecha', 'Estado', 'Codigo', 'DNI', 'Colaborador', 'Nivel', 'Beneficio', 'Tipo', 'Monto Original', 'Descuento $', 'Monto Final', 'Comercio', 'Direccion'];
    const rows = result.rows.map((r: any) => [
      new Date(r.fecha_verificacion).toLocaleString('es-AR'),
      r.estado, r.codigo_referencia, r.dni,
      `${r.beneficiario_nombre || ''} ${r.beneficiario_apellido || ''}`.trim(),
      r.nivel || '', r.beneficio_nombre || '', r.beneficio_tipo || '',
      r.monto_original ?? '', r.monto_descuento ?? '', r.monto_final ?? '',
      r.comercio_nombre || '', r.comercio_direccion || '',
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
    await query(`ALTER TABLE beneficiarios ADD COLUMN IF NOT EXISTS sector VARCHAR(100)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_beneficiarios_naaloo_id ON beneficiarios(naaloo_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_beneficiarios_sector ON beneficiarios(sector)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_beneficiarios_departamento ON beneficiarios(departamento)`);
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

// POST /api/admin/sync-naaloo - Sincronizar empleados con Naaloo (batch optimizado)
router.post('/sync-naaloo', async (req: AuthRequest, res: Response) => {
  try {
    const adminNombre = (req as any).user?.nombre ? `${(req as any).user.nombre} ${(req as any).user.apellido || ''}`.trim() : 'Sistema';
    const result = await runSyncNaaloo(adminNombre);
    res.json(result);
  } catch (error: any) {
    console.error('Error sincronizando con Naaloo:', error.message);
    const status = error.message.includes('No se pudo conectar') ? 502 : 500;
    res.status(status).json({ error: 'Error sincronizando', detalle: error.message });
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
    let familiaresAfectados = 0;

    if (accion === 'desactivar') {
      await query(
        `UPDATE beneficiarios SET activo=FALSE, motivo_baja=$1, fecha_baja=NOW(), autorizado_por=$2, updated_at=NOW() WHERE id=$3`,
        [motivo || 'Desactivacion manual', adminNombre, beneficiario_id]
      );
      // V3G CASCADE: desactivar TODOS los familiares del titular
      const cascada = await query(
        `UPDATE familiares SET activo=FALSE, updated_at=NOW() WHERE beneficiario_id=$1 AND activo=TRUE RETURNING id`,
        [beneficiario_id]
      ).catch(() => ({ rows: [] }));
      familiaresAfectados = cascada.rows.length;
    } else {
      await query(
        `UPDATE beneficiarios SET activo=TRUE, motivo_baja=NULL, fecha_baja=NULL, autorizado_por=NULL, updated_at=NOW() WHERE id=$1`,
        [beneficiario_id]
      );
      // V3G CASCADE: reactivar familiares también
      const cascada = await query(
        `UPDATE familiares SET activo=TRUE, updated_at=NOW() WHERE beneficiario_id=$1 AND activo=FALSE RETURNING id`,
        [beneficiario_id]
      ).catch(() => ({ rows: [] }));
      familiaresAfectados = cascada.rows.length;
    }

    await query(
      `INSERT INTO autorizacion_logs (beneficiario_id, accion, motivo, autorizado_por) VALUES ($1, $2, $3, $4)`,
      [beneficiario_id, accion,
       (motivo || (accion === 'desactivar' ? 'Desactivacion manual' : 'Reactivacion manual')) +
       (familiaresAfectados > 0 ? ` (cascada: ${familiaresAfectados} familiares)` : ''),
       adminNombre]
    );

    res.json({ exito: true, accion, familiaresAfectados });
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

    let totalFamiliaresAfectados = 0;
    for (const id of ids) {
      if (accion === 'desactivar') {
        await query(
          `UPDATE beneficiarios SET activo=FALSE, motivo_baja=$1, fecha_baja=NOW(), autorizado_por=$2, updated_at=NOW() WHERE id=$3`,
          [motivoFinal, adminNombre, id]
        );
        const cascada = await query(
          `UPDATE familiares SET activo=FALSE, updated_at=NOW() WHERE beneficiario_id=$1 AND activo=TRUE RETURNING id`,
          [id]
        ).catch(() => ({ rows: [] }));
        totalFamiliaresAfectados += cascada.rows.length;
      } else {
        await query(
          `UPDATE beneficiarios SET activo=TRUE, motivo_baja=NULL, fecha_baja=NULL, autorizado_por=NULL, updated_at=NOW() WHERE id=$1`,
          [id]
        );
        const cascada = await query(
          `UPDATE familiares SET activo=TRUE, updated_at=NOW() WHERE beneficiario_id=$1 AND activo=FALSE RETURNING id`,
          [id]
        ).catch(() => ({ rows: [] }));
        totalFamiliaresAfectados += cascada.rows.length;
      }

      await query(
        `INSERT INTO autorizacion_logs (beneficiario_id, accion, motivo, autorizado_por) VALUES ($1, $2, $3, $4)`,
        [id, accion, motivoFinal, adminNombre]
      );
      procesados++;
    }

    res.json({ exito: true, procesados, accion, familiaresAfectados: totalFamiliaresAfectados });
  } catch (error: any) {
    console.error('Error autorizacion masiva:', error.message);
    res.status(500).json({ error: 'Error procesando autorizacion masiva', detalle: error.message });
  }
});

// GET /api/admin/areas-sectores - Listar areas y sectores unicos
router.get('/areas-sectores', async (req: AuthRequest, res: Response) => {
  try {
    const [areasResult, sectoresResult] = await Promise.all([
      query(`SELECT DISTINCT departamento FROM beneficiarios WHERE departamento IS NOT NULL AND departamento != '' ORDER BY departamento`),
      query(`SELECT DISTINCT sector FROM beneficiarios WHERE sector IS NOT NULL AND sector != '' ORDER BY sector`),
    ]);
    res.json({
      areas: areasResult.rows.map((r: any) => r.departamento),
      sectores: sectoresResult.rows.map((r: any) => r.sector),
    });
  } catch (error: any) {
    res.json({ areas: [], sectores: [] });
  }
});

// POST /api/admin/autorizar-grupo - Bloquear/activar por area o sector
router.post('/autorizar-grupo', async (req: AuthRequest, res: Response) => {
  try {
    const { tipo, valor, accion, motivo } = req.body;
    // tipo: 'departamento' | 'sector'
    // valor: el nombre del area/sector
    // accion: 'activar' | 'desactivar'
    if (!tipo || !valor || !accion || !['activar', 'desactivar'].includes(accion) || !['departamento', 'sector'].includes(tipo)) {
      return res.status(400).json({ error: 'Datos invalidos. Requerido: tipo (departamento/sector), valor, accion (activar/desactivar)' });
    }

    const adminNombre = (req as any).user?.nombre ? `${(req as any).user.nombre} ${(req as any).user.apellido || ''}`.trim() : 'Admin';
    const motivoFinal = motivo || `${accion === 'desactivar' ? 'Bloqueo' : 'Desbloqueo'} por ${tipo}: ${valor}`;

    // Obtener IDs de beneficiarios afectados
    const col = tipo === 'departamento' ? 'departamento' : 'sector';
    const targetActivo = accion === 'desactivar'; // queremos los que estan activos para desactivar, o inactivos para activar
    const affected = await query(
      `SELECT id FROM beneficiarios WHERE ${col} = $1 AND activo = $2`,
      [valor, targetActivo]
    );

    if (affected.rows.length === 0) {
      return res.json({ exito: true, procesados: 0, mensaje: `No hay colaboradores ${targetActivo ? 'activos' : 'inactivos'} en ${tipo} "${valor}"` });
    }

    // Aplicar cambio
    if (accion === 'desactivar') {
      await query(
        `UPDATE beneficiarios SET activo=FALSE, motivo_baja=$1, fecha_baja=NOW(), autorizado_por=$2, updated_at=NOW() WHERE ${col} = $3 AND activo = TRUE`,
        [motivoFinal, adminNombre, valor]
      );
    } else {
      await query(
        `UPDATE beneficiarios SET activo=TRUE, motivo_baja=NULL, fecha_baja=NULL, autorizado_por=NULL, updated_at=NOW() WHERE ${col} = $1 AND activo = FALSE`,
        [valor]
      );
    }

    // Insertar logs
    for (const row of affected.rows) {
      await query(
        `INSERT INTO autorizacion_logs (beneficiario_id, accion, motivo, autorizado_por) VALUES ($1, $2, $3, $4)`,
        [row.id, accion, motivoFinal, adminNombre]
      );
    }

    res.json({ exito: true, procesados: affected.rows.length, accion, tipo, valor });
  } catch (error: any) {
    console.error('Error autorizacion por grupo:', error.message);
    res.status(500).json({ error: 'Error procesando autorizacion por grupo', detalle: error.message });
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

// ============================================
// MODULO PERMISOS DE ADMINISTRACION
// ============================================

// POST /api/admin/migrar-permisos - Agrega columnas de admin a beneficiarios
router.post('/migrar-permisos', async (req: AuthRequest, res: Response) => {
  try {
    await query(`ALTER TABLE beneficiarios ADD COLUMN IF NOT EXISTS es_admin BOOLEAN DEFAULT FALSE`);
    await query(`ALTER TABLE beneficiarios ADD COLUMN IF NOT EXISTS rol_admin VARCHAR(20)`);
    await query(`ALTER TABLE beneficiarios ADD COLUMN IF NOT EXISTS admin_desde TIMESTAMP`);
    await query(`ALTER TABLE beneficiarios ADD COLUMN IF NOT EXISTS admin_por VARCHAR(100)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_beneficiarios_es_admin ON beneficiarios(es_admin) WHERE es_admin = TRUE`);

    // Asignar Pedro (DNI 28348057) como super_admin inicial si existe
    const pedro = await query(`SELECT id FROM beneficiarios WHERE dni = '28348057' LIMIT 1`);
    let asignado = false;
    if (pedro.rows.length > 0) {
      await query(
        `UPDATE beneficiarios SET es_admin = TRUE, rol_admin = 'super_admin', admin_desde = NOW(), admin_por = 'sistema'
         WHERE id = $1 AND (es_admin IS NULL OR es_admin = FALSE)`,
        [pedro.rows[0].id]
      );
      asignado = true;
    }

    res.json({ exito: true, mensaje: 'Migración de permisos completada', superAdminInicial: asignado });
  } catch (error: any) {
    console.error('Error migracion permisos:', error.message);
    res.status(500).json({ error: 'Error en migración', detalle: error.message });
  }
});

// GET /api/admin/admins - Lista de administradores actuales
router.get('/admins', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT id, dni, nombre, apellido, email, telefono, nivel, departamento, sector,
             rol_admin, admin_desde, admin_por
      FROM beneficiarios
      WHERE es_admin = TRUE AND activo = TRUE
      ORDER BY rol_admin DESC, admin_desde ASC NULLS LAST
    `);
    res.json({ admins: result.rows });
  } catch (error: any) {
    console.error('Error listando admins:', error.message);
    res.status(500).json({ error: 'Error listando admins', detalle: error.message });
  }
});

// GET /api/admin/admins/buscar?q=texto - Buscar beneficiarios candidatos para admin
router.get('/admins/buscar', async (req: AuthRequest, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (q.length < 2) {
      return res.json({ resultados: [] });
    }
    const result = await query(`
      SELECT id, dni, nombre, apellido, email, nivel, departamento, sector, es_admin, rol_admin
      FROM beneficiarios
      WHERE activo = TRUE
        AND (
          LOWER(nombre) LIKE LOWER($1)
          OR LOWER(apellido) LIKE LOWER($1)
          OR LOWER(email) LIKE LOWER($1)
          OR dni LIKE $1
        )
      ORDER BY apellido ASC, nombre ASC
      LIMIT 30
    `, [`%${q}%`]);
    res.json({ resultados: result.rows });
  } catch (error: any) {
    console.error('Error buscando candidatos:', error.message);
    res.status(500).json({ error: 'Error buscando', detalle: error.message });
  }
});

// POST /api/admin/admins/asignar - Otorgar permiso de admin
router.post('/admins/asignar', async (req: AuthRequest, res: Response) => {
  try {
    const { beneficiarioId, rol } = req.body;
    const rolFinal = (rol === 'super_admin') ? 'super_admin' : 'admin';

    if (!beneficiarioId) {
      return res.status(400).json({ error: 'beneficiarioId requerido' });
    }

    // Verificar que el que hace la accion sea super_admin
    const me = await query(
      `SELECT b.rol_admin FROM beneficiarios b WHERE LOWER(b.email) = LOWER($1) LIMIT 1`,
      [req.user?.username || '']
    );
    const meRol = me.rows[0]?.rol_admin;
    // admin.popper (rol='admin' en tabla usuarios) tambien puede gestionar
    const esSuperLocal = req.user?.rol === 'admin' && !req.user?.username?.includes('@');
    if (meRol !== 'super_admin' && !esSuperLocal) {
      return res.status(403).json({ error: 'Solo super-administradores pueden asignar permisos' });
    }

    const targetRes = await query(
      `SELECT id, email, nombre, apellido, activo FROM beneficiarios WHERE id = $1`,
      [beneficiarioId]
    );
    if (targetRes.rows.length === 0) {
      return res.status(404).json({ error: 'Beneficiario no encontrado' });
    }
    const target = targetRes.rows[0];

    if (!target.email) {
      return res.status(400).json({ error: 'El beneficiario no tiene email registrado. No puede acceder vía Naaloo.' });
    }

    const adminNombre = req.user?.username || 'sistema';
    await query(
      `UPDATE beneficiarios SET es_admin = TRUE, rol_admin = $1, admin_desde = NOW(), admin_por = $2, updated_at = NOW() WHERE id = $3`,
      [rolFinal, adminNombre, beneficiarioId]
    );

    await query(
      `INSERT INTO autorizacion_logs (beneficiario_id, accion, motivo, autorizado_por) VALUES ($1, 'permiso_otorgado', $2, $3)`,
      [beneficiarioId, `Rol asignado: ${rolFinal}`, adminNombre]
    ).catch(() => {});

    res.json({ exito: true, mensaje: `${target.nombre} ${target.apellido} ahora es ${rolFinal}` });
  } catch (error: any) {
    console.error('Error asignando admin:', error.message);
    res.status(500).json({ error: 'Error asignando permiso', detalle: error.message });
  }
});

// POST /api/admin/admins/revocar - Revocar permiso de admin
router.post('/admins/revocar', async (req: AuthRequest, res: Response) => {
  try {
    const { beneficiarioId } = req.body;
    if (!beneficiarioId) {
      return res.status(400).json({ error: 'beneficiarioId requerido' });
    }

    // Solo super_admin puede revocar
    const me = await query(
      `SELECT b.id, b.rol_admin FROM beneficiarios b WHERE LOWER(b.email) = LOWER($1) LIMIT 1`,
      [req.user?.username || '']
    );
    const meRol = me.rows[0]?.rol_admin;
    const esSuperLocal = req.user?.rol === 'admin' && !req.user?.username?.includes('@');
    if (meRol !== 'super_admin' && !esSuperLocal) {
      return res.status(403).json({ error: 'Solo super-administradores pueden revocar permisos' });
    }

    // No puede revocarse a si mismo
    if (me.rows[0]?.id === beneficiarioId) {
      return res.status(400).json({ error: 'No puedes revocarte permisos a ti mismo' });
    }

    const targetRes = await query(
      `SELECT id, nombre, apellido, rol_admin FROM beneficiarios WHERE id = $1`,
      [beneficiarioId]
    );
    if (targetRes.rows.length === 0) {
      return res.status(404).json({ error: 'Beneficiario no encontrado' });
    }
    const target = targetRes.rows[0];

    const adminNombre = req.user?.username || 'sistema';
    await query(
      `UPDATE beneficiarios SET es_admin = FALSE, rol_admin = NULL, admin_desde = NULL, admin_por = NULL, updated_at = NOW() WHERE id = $1`,
      [beneficiarioId]
    );

    await query(
      `INSERT INTO autorizacion_logs (beneficiario_id, accion, motivo, autorizado_por) VALUES ($1, 'permiso_revocado', $2, $3)`,
      [beneficiarioId, `Rol revocado: ${target.rol_admin}`, adminNombre]
    ).catch(() => {});

    res.json({ exito: true, mensaje: `Permisos revocados a ${target.nombre} ${target.apellido}` });
  } catch (error: any) {
    console.error('Error revocando admin:', error.message);
    res.status(500).json({ error: 'Error revocando permiso', detalle: error.message });
  }
});

// GET /api/admin/mi-perfil - Datos del admin logueado (incluye si es super_admin)
router.get('/mi-perfil', async (req: AuthRequest, res: Response) => {
  try {
    const username = req.user?.username || '';
    if (username.includes('@')) {
      const result = await query(
        `SELECT id, dni, nombre, apellido, email, rol_admin FROM beneficiarios
         WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [username]
      );
      if (result.rows.length > 0) {
        return res.json({ ...result.rows[0], esSuperAdmin: result.rows[0].rol_admin === 'super_admin', origen: 'naaloo' });
      }
    }
    // fallback: admin.popper local
    res.json({
      id: req.user?.userId,
      email: username,
      nombre: 'Administrador',
      apellido: 'Sistema',
      rol_admin: 'super_admin',
      esSuperAdmin: true,
      origen: 'local',
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Error obteniendo perfil' });
  }
});

// ============================================
// IMPORTACION CATALOGO OFICIAL ADN POPPER 2026
// ============================================
// Fuente: "Listado beneficios ADN Popper 2026.xlsx"
// 11 comercios en Ushuaia y Rio Grande con sus beneficios oficiales
// Estrategia: desactivar todo lo existente (no borrar, para preservar
// verificaciones historicas) e insertar el catalogo oficial
// ============================================
const CATALOGO_2026: Array<{
  qr: string;
  comercio: string;
  cuit: string;
  direccion: string;
  ciudad: string;
  responsable: string;
  telefono: string;
  email: string;
  beneficioNombre: string;
  beneficioDescripcion: string;
  descuento: number;
  fechaInicio: string;
  fechaFin: string;
  lugar: string;
}> = [
  {
    qr: 'ADN-SALK-2026', comercio: 'Farmacia Salk', cuit: '30-70801763-5',
    direccion: 'Av. Malvinas 212', ciudad: 'Ushuaia', responsable: 'Martín Jiménez',
    telefono: '2901 51-4076', email: 'concentrador@farmaciasalk.com',
    beneficioNombre: 'Farmacia Salk · 10% OFF',
    beneficioDescripcion: '10% de descuento en farmacia. Presentando credencial de Grupo Popper.',
    descuento: 10, fechaInicio: '2026-05-18', fechaFin: '2027-05-13',
    lugar: 'Ushuaia · Río Grande',
  },
  {
    qr: 'ADN-PULSE-2026', comercio: 'Gimnasio Espacio Pulse', cuit: '16060462',
    direccion: 'Fuegia Basket 580', ciudad: 'Ushuaia', responsable: 'Sergio Petronio',
    telefono: '2901 50-1062', email: 'petronio1982@gmail.com',
    beneficioNombre: 'Espacio Pulse · 5% OFF',
    beneficioDescripcion: '5% de descuento en cuota mensual del gimnasio.',
    descuento: 5, fechaInicio: '2026-05-18', fechaFin: '2027-05-13',
    lugar: 'Ushuaia',
  },
  {
    qr: 'ADN-NEUMATICOS-2026', comercio: 'Neumáticos Río Grande Sur', cuit: '30-61051920-9',
    direccion: 'Magallanes 1055', ciudad: 'Ushuaia', responsable: 'Carlos Gustavo D\'Angelo',
    telefono: '2901 62-7271', email: 'tiresrgsur@gmail.com',
    beneficioNombre: 'Neumáticos RG Sur · 15% efectivo',
    beneficioDescripcion: '15% de descuento pagando en efectivo. Con Visa o Mastercard: 6 cuotas sin interés o 3 pagos sin interés con 5% off.',
    descuento: 15, fechaInicio: '2026-05-18', fechaFin: '2026-06-17',
    lugar: 'Ushuaia',
  },
  {
    qr: 'ADN-PLENA-2026', comercio: 'Plena Estudio', cuit: '32768750',
    direccion: 'Virrey Liniers 54', ciudad: 'Río Grande', responsable: 'Samanta Guerrero',
    telefono: '2964 69-5299', email: 'smt.socialmedias@mail.com',
    beneficioNombre: 'Plena Estudio · 10% OFF',
    beneficioDescripcion: '10% de descuento en estudio de belleza.',
    descuento: 10, fechaInicio: '2026-05-18', fechaFin: '2026-11-14',
    lugar: 'Río Grande',
  },
  {
    qr: 'ADN-FLAVIA-2026', comercio: 'Flavia Hair Center', cuit: '30901496',
    direccion: 'Obligado 1236', ciudad: 'Río Grande', responsable: 'Flavia Araceli Sánchez Dominiconi',
    telefono: '2964 51-3883', email: 'flaviasandominiconi@gmail.com',
    beneficioNombre: 'Flavia Hair Center · 10% OFF',
    beneficioDescripcion: '10% de descuento en peluquería y tratamientos.',
    descuento: 10, fechaInicio: '2026-05-18', fechaFin: '2026-11-14',
    lugar: 'Río Grande',
  },
  {
    qr: 'ADN-EUREKA-2026', comercio: 'Eureka', cuit: '18830736',
    direccion: 'Don Bosco y Campos', ciudad: 'Ushuaia', responsable: 'Jorge Lobos',
    telefono: '2901 64-7748', email: 'Eurekaushuaia@gmail.com',
    beneficioNombre: 'Eureka · 10% efectivo / 5% tarjeta',
    beneficioDescripcion: '10% pagando en efectivo o transferencia. 5% con tarjeta de crédito, débito o QR.',
    descuento: 10, fechaInicio: '2026-05-18', fechaFin: '2027-05-13',
    lugar: 'Ushuaia',
  },
  {
    qr: 'ADN-AROMAS-2026', comercio: 'Aromas', cuit: '18830736',
    direccion: 'Arturo Coronado 418', ciudad: 'Ushuaia', responsable: 'Jorge Lobos',
    telefono: '2901 64-7748', email: 'Lauravvalle@gmail.com',
    beneficioNombre: 'Aromas · 10% efectivo / 5% tarjeta',
    beneficioDescripcion: '10% pagando en efectivo o transferencia. 5% con tarjeta de crédito, débito o QR.',
    descuento: 10, fechaInicio: '2026-05-18', fechaFin: '2027-05-13',
    lugar: 'Ushuaia',
  },
  {
    qr: 'ADN-LAMORADA-2026', comercio: 'La Morada Burgers', cuit: '28509819',
    direccion: 'Tolhuin 138', ciudad: 'Ushuaia', responsable: 'Gastón Zarlenga',
    telefono: '11 6766-6784', email: 'info@lamoradaburgers.com.ar',
    beneficioNombre: 'La Morada Burgers · 10% OFF',
    beneficioDescripcion: '10% de descuento en hamburguesería.',
    descuento: 10, fechaInicio: '2026-05-18', fechaFin: '2026-11-14',
    lugar: 'Ushuaia',
  },
  {
    qr: 'ADN-CENTRALMARKET-2026', comercio: 'Central Market Ushuaia', cuit: '28509819',
    direccion: '25 de Mayo 231', ciudad: 'Ushuaia', responsable: 'Gastón Zarlenga',
    telefono: '11 6766-6784', email: 'administracion@centralmarketushuaia.com.ar',
    beneficioNombre: 'Central Market · 10% OFF',
    beneficioDescripcion: '10% de descuento en mercado.',
    descuento: 10, fechaInicio: '2026-05-18', fechaFin: '2026-11-14',
    lugar: 'Ushuaia',
  },
  {
    qr: 'ADN-TALLERTEXTIL-2026', comercio: 'Taller Textil', cuit: '33494010',
    direccion: 'Canga 1721', ciudad: 'Ushuaia', responsable: 'Raúl Monzón',
    telefono: '2901 50-8017', email: 'monzon769@hotmail.com',
    beneficioNombre: 'Taller Textil · 15% (1 prenda) · 20% (3+)',
    beneficioDescripcion: '15% de descuento por 1 prenda. 20% por más de 3 prendas.',
    descuento: 15, fechaInicio: '2026-05-18', fechaFin: '2026-11-14',
    lugar: 'Ushuaia',
  },
  {
    qr: 'ADN-COREREHAB-2026', comercio: 'Core Rehabilitación', cuit: '32131178',
    direccion: 'San Martín 1507, Piso 1, Oficina 104', ciudad: 'Ushuaia', responsable: 'Dalmiro Nicolás Naselli',
    telefono: '2901 64-0666', email: 'core.rehabilitacion.ushuaia@gmail.com',
    beneficioNombre: 'Core Rehabilitación · 10% OFF',
    beneficioDescripcion: '10% en Kinesiología, masajes deportivos, descontracturantes, estudio de pisada para plantillas y medición de fuerza.',
    descuento: 10, fechaInicio: '2026-05-18', fechaFin: '2027-05-13',
    lugar: 'Ushuaia',
  },
];

router.post('/importar-catalogo-2026', async (req: AuthRequest, res: Response) => {
  try {
    await ensureLogoColumn();
    let comerciosCreados = 0, comerciosActualizados = 0;
    let beneficiosCreados = 0, asociaciones = 0;

    // 1. Desactivar todo el catalogo previo (no borrar, para preservar verificaciones)
    await query(`UPDATE beneficios SET activo = FALSE, updated_at = NOW() WHERE activo = TRUE`);
    await query(`UPDATE comercios SET activo = FALSE, updated_at = NOW() WHERE activo = TRUE`);

    // 2. Insertar / upsert cada comercio del listado 2026
    for (const item of CATALOGO_2026) {
      // Upsert comercio por qr_code
      const existing = await query(`SELECT id FROM comercios WHERE qr_code = $1 LIMIT 1`, [item.qr]);
      let comercioId: string;

      if (existing.rows.length > 0) {
        comercioId = existing.rows[0].id;
        await query(
          `UPDATE comercios SET
            nombre = $1, direccion = $2, ciudad = $3, provincia = 'Tierra del Fuego',
            telefono = $4, email = $5, responsable = $6,
            horario_apertura = '09:00', horario_cierre = '20:00',
            activo = TRUE, updated_at = NOW()
          WHERE id = $7`,
          [item.comercio, item.direccion, item.ciudad, item.telefono, item.email, item.responsable, comercioId]
        );
        comerciosActualizados++;
      } else {
        const inserted = await query(
          `INSERT INTO comercios (nombre, direccion, ciudad, provincia, telefono, email, responsable,
                                  horario_apertura, horario_cierre, activo, qr_code)
           VALUES ($1, $2, $3, 'Tierra del Fuego', $4, $5, $6, '09:00', '20:00', TRUE, $7)
           RETURNING id`,
          [item.comercio, item.direccion, item.ciudad, item.telefono, item.email, item.responsable, item.qr]
        );
        comercioId = inserted.rows[0].id;
        comerciosCreados++;
      }

      // Crear beneficio
      const benef = await query(
        `INSERT INTO beneficios (nombre, descripcion, tipo, nivel_minimo, descuento,
                                 fecha_inicio, fecha_fin, horario_inicio, horario_fin, activo)
         VALUES ($1, $2, 'descuento', 'bronce', $3, $4, $5, '09:00', '20:00', TRUE)
         RETURNING id`,
        [item.beneficioNombre, item.beneficioDescripcion, item.descuento,
         item.fechaInicio, item.fechaFin]
      );
      beneficiosCreados++;

      // Asociar beneficio con comercio
      await query(
        `INSERT INTO comercio_beneficios (comercio_id, beneficio_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [comercioId, benef.rows[0].id]
      );
      asociaciones++;
    }

    res.json({
      exito: true,
      mensaje: 'Catálogo 2026 importado correctamente',
      resumen: {
        comerciosCreados,
        comerciosActualizados,
        beneficiosCreados,
        asociaciones,
        total: CATALOGO_2026.length,
      },
    });
  } catch (error: any) {
    console.error('Error importando catalogo 2026:', error.message);
    res.status(500).json({ error: 'Error importando catálogo', detalle: error.message });
  }
});

// ============================================
// MODULO MODELO EXTENDIDO V2
// Beneficios: origen (interno/externo), categoria, aplica_a, modalidad,
//             escala_descuentos (JSONB), restricciones, excluye_outlet
// Beneficiarios: es_talento_popper, talento_desde, talento_por
// Familiares: tabla nueva linkeada a beneficiarios + sync desde Naaloo
// ============================================

router.post('/migrar-modelo-v2', async (req: AuthRequest, res: Response) => {
  try {
    // ===== Extender beneficios =====
    await query(`ALTER TABLE beneficios ADD COLUMN IF NOT EXISTS origen VARCHAR(20) DEFAULT 'externo'`);
    await query(`ALTER TABLE beneficios ADD COLUMN IF NOT EXISTS categoria VARCHAR(50)`);
    await query(`ALTER TABLE beneficios ADD COLUMN IF NOT EXISTS aplica_a VARCHAR(20) DEFAULT 'empleado'`);
    await query(`ALTER TABLE beneficios ADD COLUMN IF NOT EXISTS modalidad VARCHAR(20) DEFAULT 'descuento'`);
    await query(`ALTER TABLE beneficios ADD COLUMN IF NOT EXISTS escala_descuentos JSONB`);
    await query(`ALTER TABLE beneficios ADD COLUMN IF NOT EXISTS restricciones TEXT`);
    await query(`ALTER TABLE beneficios ADD COLUMN IF NOT EXISTS excluye_outlet BOOLEAN DEFAULT FALSE`);
    await query(`ALTER TABLE beneficios ADD COLUMN IF NOT EXISTS relaciones_familiar VARCHAR(100)`);
    // relaciones_familiar = CSV de FamilyRelationship aceptados (ej: "Parents,Spouse,CivilUnion,Child")
    await query(`CREATE INDEX IF NOT EXISTS idx_beneficios_origen ON beneficios(origen)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_beneficios_categoria ON beneficios(categoria)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_beneficios_aplica_a ON beneficios(aplica_a)`);

    // ===== Flag Talento Popper en beneficiarios =====
    await query(`ALTER TABLE beneficiarios ADD COLUMN IF NOT EXISTS es_talento_popper BOOLEAN DEFAULT FALSE`);
    await query(`ALTER TABLE beneficiarios ADD COLUMN IF NOT EXISTS talento_desde TIMESTAMP`);
    await query(`ALTER TABLE beneficiarios ADD COLUMN IF NOT EXISTS talento_por VARCHAR(100)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_beneficiarios_talento ON beneficiarios(es_talento_popper) WHERE es_talento_popper = TRUE`);

    // ===== Tabla familiares =====
    await query(`
      CREATE TABLE IF NOT EXISTS familiares (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        beneficiario_id UUID NOT NULL REFERENCES beneficiarios(id) ON DELETE CASCADE,
        naaloo_id INT,
        dni VARCHAR(20) NOT NULL,
        nombre_completo VARCHAR(200) NOT NULL,
        relacion VARCHAR(30) NOT NULL,
        fecha_nacimiento DATE,
        email VARCHAR(100),
        telefono VARCHAR(50),
        a_cargo BOOLEAN DEFAULT FALSE,
        activo BOOLEAN DEFAULT TRUE,
        ultima_sync TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (beneficiario_id, dni)
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_familiares_dni ON familiares(dni)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_familiares_beneficiario ON familiares(beneficiario_id)`);

    res.json({
      exito: true,
      mensaje: 'Modelo v2 migrado correctamente',
      cambios: [
        'beneficios: +origen, categoria, aplica_a, modalidad, escala_descuentos, restricciones, excluye_outlet, relaciones_familiar',
        'beneficiarios: +es_talento_popper, talento_desde, talento_por',
        'familiares: tabla creada',
      ],
    });
  } catch (error: any) {
    console.error('Error migracion v2:', error.message);
    res.status(500).json({ error: 'Error en migración v2', detalle: error.message });
  }
});

// ============================================
// TALENTO POPPER
// ============================================
router.get('/talento-popper', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT id, dni, nombre, apellido, email, departamento, sector, nivel,
             talento_desde, talento_por
      FROM beneficiarios
      WHERE es_talento_popper = TRUE AND activo = TRUE
      ORDER BY talento_desde DESC NULLS LAST, apellido ASC
    `);
    res.json({ talentos: result.rows });
  } catch (error: any) {
    res.status(500).json({ error: 'Error listando talento popper', detalle: error.message });
  }
});

router.post('/talento-popper/toggle', async (req: AuthRequest, res: Response) => {
  try {
    const { beneficiarioId, activo } = req.body;
    if (!beneficiarioId) return res.status(400).json({ error: 'beneficiarioId requerido' });
    const adminNombre = req.user?.username || 'sistema';

    if (activo) {
      await query(
        `UPDATE beneficiarios SET es_talento_popper=TRUE, talento_desde=NOW(), talento_por=$1, updated_at=NOW() WHERE id=$2`,
        [adminNombre, beneficiarioId]
      );
    } else {
      await query(
        `UPDATE beneficiarios SET es_talento_popper=FALSE, talento_desde=NULL, talento_por=NULL, updated_at=NOW() WHERE id=$1`,
        [beneficiarioId]
      );
    }
    res.json({ exito: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Error toggle talento', detalle: error.message });
  }
});

// ============================================
// FAMILIARES — sync desde Naaloo
// ============================================
router.get('/familiares/:beneficiarioId', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM familiares WHERE beneficiario_id = $1 AND activo = TRUE ORDER BY relacion, nombre_completo`,
      [req.params.beneficiarioId]
    );
    res.json({ familiares: result.rows });
  } catch (error: any) {
    res.status(500).json({ error: 'Error cargando familiares' });
  }
});

router.post('/familiares/sync-naaloo', async (req: AuthRequest, res: Response) => {
  try {
    // Sincroniza familiares de TODOS los beneficiarios activos con naaloo_id.
    // Hace requests concurrentes en lotes para no bombardear Naaloo.
    const benefRes = await query(
      `SELECT id, naaloo_id, dni, nombre, apellido FROM beneficiarios
       WHERE activo = TRUE AND naaloo_id IS NOT NULL`
    );
    const beneficiarios = benefRes.rows;

    let totalSincronizados = 0;
    let totalFamiliaresNuevos = 0;
    let totalFamiliaresActualizados = 0;
    let totalEmpleadosSinFamiliares = 0;
    const errores: string[] = [];

    // Procesar en lotes de 8 concurrentes
    const batchSize = 8;
    for (let i = 0; i < beneficiarios.length; i += batchSize) {
      const batch = beneficiarios.slice(i, i + batchSize);
      await Promise.all(batch.map(async (b: any) => {
        try {
          const detalle = await obtenerEmpleadoCompleto(b.naaloo_id);
          if (!detalle) return;

          const fams: NaalooFamiliar[] = detalle.familiares || [];
          if (fams.length === 0) {
            totalEmpleadosSinFamiliares++;
            return;
          }

          for (const f of fams) {
            if (!f.dni) continue;
            // Upsert por (beneficiario_id, dni)
            const existing = await query(
              `SELECT id FROM familiares WHERE beneficiario_id=$1 AND dni=$2 LIMIT 1`,
              [b.id, f.dni]
            );
            const fechaNac = f.fechaNacimiento ? f.fechaNacimiento.split('T')[0] : null;
            if (existing.rows.length > 0) {
              await query(
                `UPDATE familiares SET
                  naaloo_id=$1, nombre_completo=$2, relacion=$3, fecha_nacimiento=$4,
                  email=$5, telefono=$6, a_cargo=$7, activo=TRUE, ultima_sync=NOW(), updated_at=NOW()
                WHERE id=$8`,
                [f.id, f.nombreCompleto, normalizarRelacion(f.relacion), fechaNac,
                 f.email || null, f.telefonos || null, f.aCargo || false, existing.rows[0].id]
              );
              totalFamiliaresActualizados++;
            } else {
              await query(
                `INSERT INTO familiares (beneficiario_id, naaloo_id, dni, nombre_completo, relacion,
                                         fecha_nacimiento, email, telefono, a_cargo, activo, ultima_sync)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, NOW())`,
                [b.id, f.id, f.dni, f.nombreCompleto, normalizarRelacion(f.relacion), fechaNac,
                 f.email || null, f.telefonos || null, f.aCargo || false]
              );
              totalFamiliaresNuevos++;
            }
          }
          totalSincronizados++;
        } catch (e: any) {
          errores.push(`${b.dni}: ${e.message}`);
        }
      }));
    }

    res.json({
      exito: true,
      resumen: {
        empleadosProcesados: totalSincronizados,
        empleadosSinFamiliares: totalEmpleadosSinFamiliares,
        familiaresNuevos: totalFamiliaresNuevos,
        familiaresActualizados: totalFamiliaresActualizados,
        errores: errores.slice(0, 10),
      },
    });
  } catch (error: any) {
    console.error('Error sync familiares:', error.message);
    res.status(500).json({ error: 'Error sincronizando familiares', detalle: error.message });
  }
});

// ============================================
// PHASE 3G — Anular verificación (revocar canje ya hecho)
// ============================================
router.post('/anular-verificacion/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    const adminNombre = (req as any).user?.nombre ? `${(req as any).user.nombre} ${(req as any).user.apellido || ''}`.trim() : 'Admin';

    const result = await query(
      `UPDATE verificaciones SET estado='anulado', motivo_baja=$1, autorizado_por=$2, updated_at=NOW()
       WHERE id=$3 AND estado='exitoso' RETURNING id, beneficiario_id, beneficio_id, monto`,
      [motivo || 'Anulado por administrador', adminNombre, id]
    ).catch(async () => {
      // Si las columnas motivo_baja/autorizado_por no existen en verificaciones, intentar sin
      return await query(
        `UPDATE verificaciones SET estado='anulado' WHERE id=$1 AND estado='exitoso' RETURNING id, beneficiario_id, beneficio_id, monto`,
        [id]
      );
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Verificación no encontrada o ya estaba anulada' });
    }

    // Decrementar uso_actual
    await query(`UPDATE beneficios SET uso_actual = GREATEST(0, uso_actual - 1) WHERE id=$1`, [result.rows[0].beneficio_id]);

    // Log
    await query(
      `INSERT INTO autorizacion_logs (beneficiario_id, accion, motivo, autorizado_por)
       VALUES ($1, 'anular_verificacion', $2, $3)`,
      [result.rows[0].beneficiario_id, `Anulada verificación ${id}: ${motivo || 'sin motivo'}`, adminNombre]
    ).catch(() => {});

    res.json({ exito: true, verificacion_id: id });
  } catch (error: any) {
    console.error('Error anulando verificación:', error.message);
    res.status(500).json({ error: 'Error anulando', detalle: error.message });
  }
});

// ============================================
// PHASE 3C — IMPORTACIÓN MASIVA + SEED
// ============================================

// Template Excel descargable
router.get('/importar/template-jerarquias', async (req: AuthRequest, res: Response) => {
  try {
    const wb = XLSX.utils.book_new();
    const data = [
      { Nombre: 'Operario', Orden: 1, 'Límite mensual': 50000, 'Límite Talento': 80000, Notas: 'Ej: cajeros, vendedores' },
      { Nombre: 'Supervisor', Orden: 2, 'Límite mensual': 80000, 'Límite Talento': 120000, Notas: '' },
      { Nombre: 'Jefe', Orden: 3, 'Límite mensual': 120000, 'Límite Talento': 180000, Notas: '' },
      { Nombre: 'Coordinador', Orden: 4, 'Límite mensual': 150000, 'Límite Talento': 220000, Notas: '' },
      { Nombre: 'Gerente', Orden: 5, 'Límite mensual': 200000, 'Límite Talento': 300000, Notas: '' },
    ];
    const sheet = XLSX.utils.json_to_sheet(data);
    sheet['!cols'] = [{ wch: 18 }, { wch: 8 }, { wch: 18 }, { wch: 18 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(wb, sheet, 'Jerarquías');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="template-jerarquias.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: 'Error generando template', detalle: error.message });
  }
});

// Import desde Excel (base64)
router.post('/importar/jerarquias', async (req: AuthRequest, res: Response) => {
  try {
    const { fileBase64, reemplazar } = req.body;
    if (!fileBase64) return res.status(400).json({ error: 'Falta el archivo' });

    // Asegurar que la tabla existe
    await query(`
      CREATE TABLE IF NOT EXISTS jerarquias (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre VARCHAR(100) NOT NULL UNIQUE,
        orden INT DEFAULT 0,
        limite_mensual DECIMAL(12,2) DEFAULT 0,
        limite_mensual_talento DECIMAL(12,2) DEFAULT 0,
        activo BOOLEAN DEFAULT TRUE,
        notas TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `).catch(() => {});

    const buffer = Buffer.from(fileBase64.split(',').pop() || fileBase64, 'base64');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (reemplazar) {
      // Desactiva todas las existentes antes de importar
      await query(`UPDATE jerarquias SET activo = FALSE`);
    }

    let creadas = 0, actualizadas = 0;
    const errores: string[] = [];

    for (const row of rows) {
      try {
        const nombre = String(row['Nombre'] || row['nombre'] || '').trim();
        if (!nombre) continue;
        const orden = parseInt(String(row['Orden'] || row['orden'] || 0), 10) || 0;
        const limite = parseFloat(String(row['Límite mensual'] || row['Limite mensual'] || row['limite_mensual'] || 0)) || 0;
        const limiteTalento = parseFloat(String(row['Límite Talento'] || row['Limite Talento'] || row['limite_mensual_talento'] || 0)) || 0;
        const notas = String(row['Notas'] || row['notas'] || '').trim() || null;

        const existing = await query(`SELECT id FROM jerarquias WHERE LOWER(nombre) = LOWER($1)`, [nombre]);
        if (existing.rows.length > 0) {
          await query(
            `UPDATE jerarquias SET orden=$1, limite_mensual=$2, limite_mensual_talento=$3, notas=$4, activo=TRUE, updated_at=NOW() WHERE id=$5`,
            [orden, limite, limiteTalento, notas, existing.rows[0].id]
          );
          actualizadas++;
        } else {
          await query(
            `INSERT INTO jerarquias (nombre, orden, limite_mensual, limite_mensual_talento, notas, activo)
             VALUES ($1, $2, $3, $4, $5, TRUE)`,
            [nombre, orden, limite, limiteTalento, notas]
          );
          creadas++;
        }
      } catch (e: any) {
        errores.push(`Fila ${JSON.stringify(row).substring(0, 80)}: ${e.message}`);
      }
    }

    res.json({ exito: true, creadas, actualizadas, errores: errores.slice(0, 10), total: rows.length });
  } catch (error: any) {
    console.error('Error importando jerarquias:', error.message);
    res.status(500).json({ error: 'Error importando', detalle: error.message });
  }
});

// Seed de beneficios internos estándar (skipass + indumentaria/calzado/etc + gastronómicos)
router.post('/seed-beneficios-internos', async (req: AuthRequest, res: Response) => {
  try {
    await ensureBeneficiosV2();

    const hoy = new Date().toISOString().split('T')[0];
    const finAnio = `${new Date().getFullYear()}-12-31`;

    type Seed = {
      nombre: string; descripcion: string; categoria: string; modalidad: string;
      aplica_a: string; descuento?: number; escala_descuentos?: any;
      usa_limite_jerarquia?: boolean; relaciones_familiar?: string;
      excluye_outlet?: boolean; restricciones?: string;
    };

    const seeds: Seed[] = [
      {
        nombre: 'Pase de Esquí · Temporada',
        descripcion: 'Acceso libre a pistas durante toda la temporada. Incluye familiares directos: padres, cónyuge/concubino e hijos.',
        categoria: 'skipass', modalidad: 'acceso', aplica_a: 'ambos',
        relaciones_familiar: 'Parents,Spouse,CivilUnion,Child',
      },
      {
        nombre: 'Indumentaria Corporativa Popper',
        descripcion: 'Descuento en ropa marca Popper. 20% durante el primer año, 30% al cumplir un año. Talento Popper: 30% desde día 1.',
        categoria: 'indumentaria', modalidad: 'descuento', aplica_a: 'empleado',
        escala_descuentos: { tiers: [{ antiguedad_min_meses: 0, porcentaje: 20 }, { antiguedad_min_meses: 12, porcentaje: 30 }], talento_porcentaje: 30 },
        usa_limite_jerarquia: true, excluye_outlet: true,
        restricciones: 'No aplica a marcas excluidas (NIKE, POC u otras según stock). Outlet no genera descuento.',
      },
      {
        nombre: 'Calzado deportivo',
        descripcion: 'Descuento en calzado. Escala por antigüedad. Talento Popper accede al máximo desde el día 1.',
        categoria: 'calzado', modalidad: 'descuento', aplica_a: 'empleado',
        escala_descuentos: { tiers: [{ antiguedad_min_meses: 0, porcentaje: 20 }, { antiguedad_min_meses: 12, porcentaje: 30 }], talento_porcentaje: 30 },
        usa_limite_jerarquia: true, excluye_outlet: true,
        restricciones: 'Restricciones de marca según producto y stock. Outlet excluido.',
      },
      {
        nombre: 'Accesorios',
        descripcion: 'Mochilas, lentes, gorros y accesorios deportivos.',
        categoria: 'accesorios', modalidad: 'descuento', aplica_a: 'empleado',
        escala_descuentos: { tiers: [{ antiguedad_min_meses: 0, porcentaje: 20 }, { antiguedad_min_meses: 12, porcentaje: 30 }], talento_porcentaje: 30 },
        usa_limite_jerarquia: true, excluye_outlet: true,
      },
      {
        nombre: 'Equipos de nieve',
        descripcion: 'Tablas, esquís, bastones, ropa técnica para nieve.',
        categoria: 'equipos_nieve', modalidad: 'descuento', aplica_a: 'empleado',
        escala_descuentos: { tiers: [{ antiguedad_min_meses: 0, porcentaje: 20 }, { antiguedad_min_meses: 12, porcentaje: 30 }], talento_porcentaje: 30 },
        usa_limite_jerarquia: true, excluye_outlet: true,
        restricciones: 'Restricciones de marca según producto y stock. Outlet excluido.',
      },
      {
        nombre: 'Puntos Gastronómicos',
        descripcion: 'Descuento en restaurantes del Grupo. Pendiente confirmar % específicos por RRHH.',
        categoria: 'gastronomia', modalidad: 'puntos', aplica_a: 'empleado',
        descuento: 15,
      },
      {
        nombre: 'Indumentaria de Renta',
        descripcion: 'Descuento sobre indumentaria de alquiler (renta) para uso recreacional.',
        categoria: 'indumentaria', modalidad: 'descuento', aplica_a: 'empleado',
        descuento: 25,
      },
    ];

    let creados = 0, actualizados = 0;

    for (const s of seeds) {
      const existing = await query(`SELECT id FROM beneficios WHERE LOWER(nombre) = LOWER($1) AND activo = TRUE LIMIT 1`, [s.nombre]);
      if (existing.rows.length > 0) {
        await query(`
          UPDATE beneficios SET descripcion=$1, categoria=$2, modalidad=$3, aplica_a=$4,
            origen='interno', descuento=$5, escala_descuentos=$6, usa_limite_jerarquia=$7,
            relaciones_familiar=$8, excluye_outlet=$9, restricciones=$10,
            nivel_minimo='bronce', tipo=$11, updated_at=NOW()
          WHERE id=$12
        `, [s.descripcion, s.categoria, s.modalidad, s.aplica_a, s.descuento || null,
            s.escala_descuentos ? JSON.stringify(s.escala_descuentos) : null,
            !!s.usa_limite_jerarquia, s.relaciones_familiar || null,
            !!s.excluye_outlet, s.restricciones || null,
            s.modalidad || 'descuento', existing.rows[0].id]);
        actualizados++;
      } else {
        await query(`
          INSERT INTO beneficios (nombre, descripcion, tipo, nivel_minimo, descuento,
            fecha_inicio, fecha_fin, horario_inicio, horario_fin, activo,
            origen, categoria, aplica_a, modalidad, escala_descuentos,
            restricciones, excluye_outlet, relaciones_familiar, usa_limite_jerarquia)
          VALUES ($1, $2, $3, 'bronce', $4, $5, $6, '00:00', '23:59', TRUE,
                  'interno', $7, $8, $9, $10, $11, $12, $13, $14)
        `, [s.nombre, s.descripcion, s.modalidad || 'descuento', s.descuento || null,
            hoy, finAnio,
            s.categoria, s.aplica_a, s.modalidad,
            s.escala_descuentos ? JSON.stringify(s.escala_descuentos) : null,
            s.restricciones || null, !!s.excluye_outlet,
            s.relaciones_familiar || null, !!s.usa_limite_jerarquia]);
        creados++;
      }
    }

    res.json({ exito: true, creados, actualizados, total: seeds.length });
  } catch (error: any) {
    console.error('Error seed beneficios internos:', error.message);
    res.status(500).json({ error: 'Error creando beneficios internos', detalle: error.message });
  }
});

// ============================================
// PHASE 3B — REPORTES + ANALYTICS
// ============================================
async function buildReporte(desde: string, hasta: string) {
  // Total general
  const resumen = await query(`
    SELECT
      COUNT(*) ::int AS total_canjes,
      COALESCE(SUM(monto), 0)::float AS total_gastado,
      COALESCE(AVG(monto), 0)::float AS promedio_canje,
      COUNT(*) FILTER (WHERE monto > 0)::int AS canjes_con_monto
    FROM verificaciones
    WHERE estado = 'exitoso' AND fecha_verificacion BETWEEN $1 AND $2
  `, [desde, hasta]);

  // Periodo anterior (mismo rango previo)
  const fromDate = new Date(desde);
  const toDate = new Date(hasta);
  const diff = toDate.getTime() - fromDate.getTime();
  const prevDesde = new Date(fromDate.getTime() - diff - 86400000).toISOString().split('T')[0];
  const prevHasta = new Date(fromDate.getTime() - 86400000).toISOString().split('T')[0];
  const resumenPrev = await query(`
    SELECT COUNT(*)::int AS canjes, COALESCE(SUM(monto), 0)::float AS gastado
    FROM verificaciones WHERE estado = 'exitoso' AND fecha_verificacion BETWEEN $1 AND $2
  `, [prevDesde, prevHasta]);

  // Por categoria
  const porCategoria = await query(`
    SELECT
      COALESCE(b.categoria, 'sin_categoria') AS categoria,
      COALESCE(b.origen, 'externo') AS origen,
      COUNT(v.id)::int AS canjes,
      COALESCE(SUM(v.monto), 0)::float AS gastado,
      COALESCE(SUM(v.monto * COALESCE(v.monto_descuento, 0) / NULLIF(v.monto, 0)), 0)::float AS descuento_total
    FROM verificaciones v
    LEFT JOIN beneficios b ON b.id = v.beneficio_id
    WHERE v.estado = 'exitoso' AND v.fecha_verificacion BETWEEN $1 AND $2
    GROUP BY b.categoria, b.origen
    ORDER BY gastado DESC
  `, [desde, hasta]);

  // Por jerarquia
  const porJerarquia = await query(`
    SELECT
      j.nombre AS jerarquia,
      j.limite_mensual::float AS limite_individual,
      COUNT(DISTINCT b.id)::int AS colaboradores,
      COALESCE(SUM(v.monto), 0)::float AS gastado_total
    FROM jerarquias j
    LEFT JOIN beneficiarios b ON b.jerarquia_id = j.id AND b.activo = TRUE
    LEFT JOIN verificaciones v ON v.beneficiario_id = b.id
      AND v.estado = 'exitoso' AND v.fecha_verificacion BETWEEN $1 AND $2
      AND v.usa_limite_jerarquia = TRUE
    WHERE j.activo = TRUE
    GROUP BY j.id, j.nombre, j.limite_mensual
    ORDER BY j.orden ASC, j.nombre ASC
  `, [desde, hasta]).catch(() => ({ rows: [] }));

  // Por comercio
  const porComercio = await query(`
    SELECT
      c.nombre AS comercio, c.ciudad,
      COUNT(v.id)::int AS canjes,
      COALESCE(SUM(v.monto), 0)::float AS gastado
    FROM verificaciones v
    JOIN comercios c ON c.id = v.comercio_id
    WHERE v.estado = 'exitoso' AND v.fecha_verificacion BETWEEN $1 AND $2
    GROUP BY c.id, c.nombre, c.ciudad
    ORDER BY gastado DESC
    LIMIT 20
  `, [desde, hasta]);

  // Top colaboradores
  const topColaboradores = await query(`
    SELECT
      b.dni, b.nombre, b.apellido, b.departamento, b.cargo,
      b.es_talento_popper, j.nombre AS jerarquia,
      j.limite_mensual::float AS limite_jerarquia,
      j.limite_mensual_talento::float AS limite_jerarquia_talento,
      COUNT(v.id)::int AS canjes,
      COALESCE(SUM(v.monto), 0)::float AS gastado
    FROM beneficiarios b
    LEFT JOIN jerarquias j ON j.id = b.jerarquia_id
    LEFT JOIN verificaciones v ON v.beneficiario_id = b.id
      AND v.estado = 'exitoso' AND v.fecha_verificacion BETWEEN $1 AND $2
    WHERE b.activo = TRUE
    GROUP BY b.id, b.dni, b.nombre, b.apellido, b.departamento, b.cargo, b.es_talento_popper, j.nombre, j.limite_mensual, j.limite_mensual_talento
    HAVING COUNT(v.id) > 0
    ORDER BY gastado DESC
    LIMIT 50
  `, [desde, hasta]);

  // Serie temporal (por día)
  const serieTemporal = await query(`
    SELECT
      DATE(fecha_verificacion) AS fecha,
      COUNT(*)::int AS canjes,
      COALESCE(SUM(monto), 0)::float AS gastado
    FROM verificaciones
    WHERE estado = 'exitoso' AND fecha_verificacion BETWEEN $1 AND $2
    GROUP BY DATE(fecha_verificacion)
    ORDER BY fecha ASC
  `, [desde, hasta]);

  const r = resumen.rows[0];
  const rp = resumenPrev.rows[0];
  const deltaGasto = rp.gastado > 0 ? ((r.total_gastado - rp.gastado) / rp.gastado) * 100 : 0;
  const deltaCanjes = rp.canjes > 0 ? ((r.total_canjes - rp.canjes) / rp.canjes) * 100 : 0;

  return {
    periodo: { desde, hasta, prev_desde: prevDesde, prev_hasta: prevHasta },
    resumen: {
      total_canjes: r.total_canjes,
      total_gastado: r.total_gastado,
      promedio_canje: r.promedio_canje,
      canjes_con_monto: r.canjes_con_monto,
      delta_gasto_pct: deltaGasto,
      delta_canjes_pct: deltaCanjes,
      prev_gastado: rp.gastado,
      prev_canjes: rp.canjes,
    },
    por_categoria: porCategoria.rows,
    por_jerarquia: porJerarquia.rows.map((j: any) => ({
      ...j,
      limite_total: (j.limite_individual || 0) * (j.colaboradores || 0),
      utilizacion_pct: (j.limite_individual || 0) * (j.colaboradores || 0) > 0
        ? (j.gastado_total / ((j.limite_individual || 0) * (j.colaboradores || 0))) * 100
        : 0,
    })),
    por_comercio: porComercio.rows,
    top_colaboradores: topColaboradores.rows.map((t: any) => {
      const limite = t.es_talento_popper ? (t.limite_jerarquia_talento || 0) : (t.limite_jerarquia || 0);
      return {
        ...t,
        limite_aplicable: limite,
        saldo_restante: Math.max(0, limite - (t.gastado || 0)),
        utilizacion_pct: limite > 0 ? (t.gastado / limite) * 100 : null,
      };
    }),
    serie_temporal: serieTemporal.rows,
  };
}

router.get('/reportes', async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const desde = (req.query.desde as string) || firstDay;
    const hasta = (req.query.hasta as string) || today.toISOString().split('T')[0];
    const reporte = await buildReporte(desde, hasta);
    res.json(reporte);
  } catch (error: any) {
    console.error('Error generando reporte:', error.message);
    res.status(500).json({ error: 'Error generando reporte', detalle: error.message });
  }
});

router.get('/reportes/exportar', async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const desde = (req.query.desde as string) || firstDay;
    const hasta = (req.query.hasta as string) || today.toISOString().split('T')[0];
    const reporte = await buildReporte(desde, hasta);

    const wb = XLSX.utils.book_new();

    // Sheet 1: Resumen
    const resumenSheet = XLSX.utils.json_to_sheet([{
      'Período desde': desde,
      'Período hasta': hasta,
      'Total canjes': reporte.resumen.total_canjes,
      'Total gastado': reporte.resumen.total_gastado,
      'Promedio por canje': reporte.resumen.promedio_canje,
      'Δ vs período anterior (gasto %)': reporte.resumen.delta_gasto_pct.toFixed(1) + '%',
      'Δ vs período anterior (canjes %)': reporte.resumen.delta_canjes_pct.toFixed(1) + '%',
    }]);
    XLSX.utils.book_append_sheet(wb, resumenSheet, 'Resumen');

    // Sheet 2: Por categoría
    const categoriaSheet = XLSX.utils.json_to_sheet(
      reporte.por_categoria.map((r: any) => ({
        'Categoría': r.categoria, 'Origen': r.origen,
        'Canjes': r.canjes, 'Gastado': r.gastado, 'Descuento total': r.descuento_total,
      }))
    );
    XLSX.utils.book_append_sheet(wb, categoriaSheet, 'Por categoría');

    // Sheet 3: Por jerarquía
    const jerarquiaSheet = XLSX.utils.json_to_sheet(
      reporte.por_jerarquia.map((r: any) => ({
        'Jerarquía': r.jerarquia, 'Límite individual': r.limite_individual,
        'Colaboradores': r.colaboradores, 'Límite total': r.limite_total,
        'Gastado': r.gastado_total, 'Utilización %': r.utilizacion_pct.toFixed(1) + '%',
      }))
    );
    XLSX.utils.book_append_sheet(wb, jerarquiaSheet, 'Por jerarquía');

    // Sheet 4: Por comercio
    const comercioSheet = XLSX.utils.json_to_sheet(
      reporte.por_comercio.map((r: any) => ({
        'Comercio': r.comercio, 'Ciudad': r.ciudad, 'Canjes': r.canjes, 'Gastado': r.gastado,
      }))
    );
    XLSX.utils.book_append_sheet(wb, comercioSheet, 'Por comercio');

    // Sheet 5: Top colaboradores
    const topSheet = XLSX.utils.json_to_sheet(
      reporte.top_colaboradores.map((r: any) => ({
        'DNI': r.dni, 'Nombre': `${r.nombre} ${r.apellido}`,
        'Departamento': r.departamento || '—', 'Cargo': r.cargo || '—',
        'Jerarquía': r.jerarquia || '—', 'Talento': r.es_talento_popper ? 'Sí' : 'No',
        'Canjes': r.canjes, 'Gastado': r.gastado,
        'Límite mensual': r.limite_aplicable, 'Saldo restante': r.saldo_restante,
        'Utilización %': r.utilizacion_pct != null ? r.utilizacion_pct.toFixed(1) + '%' : '—',
      }))
    );
    XLSX.utils.book_append_sheet(wb, topSheet, 'Top colaboradores');

    // Sheet 6: Serie temporal
    const serieSheet = XLSX.utils.json_to_sheet(
      reporte.serie_temporal.map((r: any) => ({
        'Fecha': new Date(r.fecha).toISOString().split('T')[0],
        'Canjes': r.canjes, 'Gastado': r.gastado,
      }))
    );
    XLSX.utils.book_append_sheet(wb, serieSheet, 'Serie temporal');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename="reporte-popper-${desde}_a_${hasta}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error: any) {
    console.error('Error exportando reporte:', error.message);
    res.status(500).json({ error: 'Error exportando', detalle: error.message });
  }
});

// ============================================
// PHASE 3A — Migración para presupuesto y cargo
// ============================================
router.post('/migrar-presupuesto', async (req: AuthRequest, res: Response) => {
  try {
    // Verificaciones: monto + categoria denormalizada
    await query(`ALTER TABLE verificaciones ADD COLUMN IF NOT EXISTS monto DECIMAL(12,2)`);
    await query(`ALTER TABLE verificaciones ADD COLUMN IF NOT EXISTS categoria_beneficio VARCHAR(50)`);
    await query(`ALTER TABLE verificaciones ADD COLUMN IF NOT EXISTS usa_limite_jerarquia BOOLEAN DEFAULT FALSE`);
    await query(`ALTER TABLE verificaciones ADD COLUMN IF NOT EXISTS retirado_por_dni VARCHAR(20)`);
    await query(`ALTER TABLE verificaciones ADD COLUMN IF NOT EXISTS retirado_por_nombre VARCHAR(200)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_verif_categoria ON verificaciones(categoria_beneficio) WHERE categoria_beneficio IS NOT NULL`);
    await query(`CREATE INDEX IF NOT EXISTS idx_verif_beneficiario_fecha ON verificaciones(beneficiario_id, fecha_verificacion)`);

    // Beneficiarios: cargo (synced from Naaloo) + link a jerarquia
    await query(`ALTER TABLE beneficiarios ADD COLUMN IF NOT EXISTS cargo VARCHAR(100)`);
    await query(`ALTER TABLE beneficiarios ADD COLUMN IF NOT EXISTS jerarquia_id UUID`);
    await query(`CREATE INDEX IF NOT EXISTS idx_beneficiarios_jerarquia ON beneficiarios(jerarquia_id) WHERE jerarquia_id IS NOT NULL`);

    res.json({
      exito: true,
      mensaje: 'Migración de presupuesto completada',
      cambios: [
        'verificaciones: +monto, categoria_beneficio, usa_limite_jerarquia',
        'beneficiarios: +cargo, jerarquia_id',
      ],
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Error migración presupuesto', detalle: error.message });
  }
});

// Auto-vincular beneficiarios a jerarquias por match de nombre
router.post('/vincular-jerarquias', async (req: AuthRequest, res: Response) => {
  try {
    const jerarquias = await query(`SELECT id, nombre FROM jerarquias WHERE activo = TRUE`);
    if (jerarquias.rows.length === 0) {
      return res.json({ exito: true, vinculados: 0, mensaje: 'No hay jerarquías cargadas. Cargá primero algunas desde el tab Jerarquías.' });
    }

    let vinculados = 0;
    let sinMatch: string[] = [];
    for (const j of jerarquias.rows) {
      const result = await query(
        `UPDATE beneficiarios SET jerarquia_id = $1
         WHERE activo = TRUE AND jerarquia_id IS NULL
         AND (LOWER(cargo) = LOWER($2) OR LOWER(departamento) = LOWER($2))
         RETURNING id`,
        [j.id, j.nombre]
      );
      vinculados += result.rows.length;
    }

    // Detectar cargos sin jerarquia
    const sinJ = await query(`
      SELECT DISTINCT cargo FROM beneficiarios
      WHERE activo = TRUE AND jerarquia_id IS NULL AND cargo IS NOT NULL
      LIMIT 50
    `);
    sinMatch = sinJ.rows.map((r: any) => r.cargo).filter(Boolean);

    res.json({ exito: true, vinculados, cargosSinJerarquia: sinMatch });
  } catch (error: any) {
    res.status(500).json({ error: 'Error vinculando jerarquías', detalle: error.message });
  }
});

// Consumo del mes corriente de un beneficiario por categoria
router.get('/consumo/:beneficiarioId', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT categoria_beneficio AS categoria, COALESCE(SUM(monto), 0)::float AS gastado, COUNT(*)::int AS canjes
      FROM verificaciones
      WHERE beneficiario_id = $1
        AND fecha_verificacion >= date_trunc('month', CURRENT_DATE)
        AND estado = 'exitoso'
        AND monto IS NOT NULL
      GROUP BY categoria_beneficio
    `, [req.params.beneficiarioId]);
    res.json({ consumo: result.rows });
  } catch (error: any) {
    res.json({ consumo: [] });
  }
});

// ============================================
// JERARQUIAS — cargos con límite mensual $ para indumentaria/calzado/etc
// ============================================
router.post('/migrar-jerarquias', async (req: AuthRequest, res: Response) => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS jerarquias (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre VARCHAR(100) NOT NULL UNIQUE,
        orden INT DEFAULT 0,
        limite_mensual DECIMAL(12,2) DEFAULT 0,
        limite_mensual_talento DECIMAL(12,2) DEFAULT 0,
        activo BOOLEAN DEFAULT TRUE,
        notas TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_jerarquias_orden ON jerarquias(orden)`);
    res.json({ exito: true, mensaje: 'Tabla jerarquias creada' });
  } catch (error: any) {
    res.status(500).json({ error: 'Error migración jerarquías', detalle: error.message });
  }
});

router.get('/jerarquias', async (req: AuthRequest, res: Response) => {
  try {
    const includeInactive = req.query.include_inactive === 'true';
    const where = includeInactive ? '' : 'WHERE activo = TRUE';
    const result = await query(`SELECT * FROM jerarquias ${where} ORDER BY orden ASC, nombre ASC`);
    res.json({ jerarquias: result.rows });
  } catch (error: any) {
    // si la tabla aún no existe
    res.json({ jerarquias: [] });
  }
});

router.post('/jerarquias', async (req: AuthRequest, res: Response) => {
  try {
    const { nombre, orden, limite_mensual, limite_mensual_talento, notas } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    const result = await query(
      `INSERT INTO jerarquias (nombre, orden, limite_mensual, limite_mensual_talento, notas)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nombre, orden || 0, limite_mensual || 0, limite_mensual_talento || 0, notas || null]
    );
    res.json({ jerarquia: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: 'Error creando jerarquía', detalle: error.message });
  }
});

router.put('/jerarquias/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { nombre, orden, limite_mensual, limite_mensual_talento, notas, activo } = req.body;
    const result = await query(
      `UPDATE jerarquias SET nombre=$1, orden=$2, limite_mensual=$3, limite_mensual_talento=$4,
       notas=$5, activo=$6, updated_at=NOW() WHERE id=$7 RETURNING *`,
      [nombre, orden || 0, limite_mensual || 0, limite_mensual_talento || 0, notas || null, activo !== false, req.params.id]
    );
    res.json({ jerarquia: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: 'Error editando jerarquía', detalle: error.message });
  }
});

router.delete('/jerarquias/:id', async (req: AuthRequest, res: Response) => {
  try {
    await query(`DELETE FROM jerarquias WHERE id = $1`, [req.params.id]);
    res.json({ exito: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Error eliminando jerarquía', detalle: error.message });
  }
});

// V3F — Foto del familiar (base64 inline)
router.post('/familiares/:id/foto', async (req: AuthRequest, res: Response) => {
  try {
    await query(`ALTER TABLE familiares ADD COLUMN IF NOT EXISTS foto TEXT`).catch(() => {});
    const { foto } = req.body; // data URL base64
    if (foto !== null && foto !== '' && (!foto || typeof foto !== 'string')) {
      return res.status(400).json({ error: 'Foto inválida' });
    }
    const result = await query(
      `UPDATE familiares SET foto=$1, updated_at=NOW() WHERE id=$2 RETURNING id`,
      [foto || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Familiar no encontrado' });
    res.json({ exito: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Error guardando foto', detalle: error.message });
  }
});

// V3F — Listado de autorizados a un beneficio (skipass principalmente)
router.get('/autorizados/:beneficioId', async (req: AuthRequest, res: Response) => {
  try {
    // El beneficio define aplica_a y relaciones_familiar
    const benRes = await query(`SELECT id, nombre, aplica_a, relaciones_familiar, categoria FROM beneficios WHERE id=$1`, [req.params.beneficioId]);
    if (benRes.rows.length === 0) return res.status(404).json({ error: 'Beneficio no encontrado' });
    const b = benRes.rows[0];
    const relacionesPermitidas: string[] = (b.relaciones_familiar || '').split(',').map((s: string) => s.trim()).filter(Boolean);

    // Titulares (si aplica_a in 'empleado' o 'ambos')
    let titulares: any[] = [];
    if (b.aplica_a === 'empleado' || b.aplica_a === 'ambos') {
      const r = await query(`
        SELECT id, dni, nombre, apellido, cargo, departamento, sector, fecha_ingreso
        FROM beneficiarios WHERE activo = TRUE ORDER BY apellido, nombre
      `);
      titulares = r.rows;
    }

    // Familiares (si aplica_a in 'familiar' o 'ambos')
    let familiares: any[] = [];
    if (b.aplica_a === 'familiar' || b.aplica_a === 'ambos') {
      let where = 'f.activo = TRUE AND b.activo = TRUE';
      const params: any[] = [];
      if (relacionesPermitidas.length > 0) {
        where += ` AND f.relacion = ANY($1)`;
        params.push(relacionesPermitidas);
      }
      // Try to select foto, fallback if column doesn't exist
      let famRes;
      try {
        famRes = await query(`
          SELECT f.id, f.dni, f.nombre_completo, f.relacion, f.fecha_nacimiento, f.foto,
                 b.dni as titular_dni, b.nombre as titular_nombre, b.apellido as titular_apellido,
                 b.cargo as titular_cargo, b.departamento as titular_departamento
          FROM familiares f JOIN beneficiarios b ON b.id = f.beneficiario_id
          WHERE ${where} ORDER BY b.apellido, b.nombre, f.relacion, f.nombre_completo
        `, params);
      } catch {
        // foto column doesn't exist yet
        famRes = await query(`
          SELECT f.id, f.dni, f.nombre_completo, f.relacion, f.fecha_nacimiento,
                 b.dni as titular_dni, b.nombre as titular_nombre, b.apellido as titular_apellido,
                 b.cargo as titular_cargo, b.departamento as titular_departamento
          FROM familiares f JOIN beneficiarios b ON b.id = f.beneficiario_id
          WHERE ${where} ORDER BY b.apellido, b.nombre, f.relacion, f.nombre_completo
        `, params);
      }
      familiares = famRes.rows;
    }

    res.json({ beneficio: b, titulares, familiares });
  } catch (error: any) {
    console.error('Error listado autorizados:', error.message);
    res.status(500).json({ error: 'Error generando listado', detalle: error.message });
  }
});

// V3F — Export Excel del listado de autorizados
router.get('/autorizados/:beneficioId/excel', async (req: AuthRequest, res: Response) => {
  try {
    const benRes = await query(`SELECT id, nombre, aplica_a, relaciones_familiar FROM beneficios WHERE id=$1`, [req.params.beneficioId]);
    if (benRes.rows.length === 0) return res.status(404).json({ error: 'Beneficio no encontrado' });
    const b = benRes.rows[0];
    const relacionesPermitidas: string[] = (b.relaciones_familiar || '').split(',').map((s: string) => s.trim()).filter(Boolean);

    const wb = XLSX.utils.book_new();

    if (b.aplica_a === 'empleado' || b.aplica_a === 'ambos') {
      const r = await query(`SELECT dni, nombre, apellido, cargo, departamento, sector FROM beneficiarios WHERE activo = TRUE ORDER BY apellido, nombre`);
      const sheet = XLSX.utils.json_to_sheet(r.rows.map((t: any) => ({
        DNI: t.dni, Apellido: t.apellido, Nombre: t.nombre,
        Cargo: t.cargo || '—', Departamento: t.departamento || '—', Sector: t.sector || '—',
      })));
      XLSX.utils.book_append_sheet(wb, sheet, 'Titulares');
    }

    if (b.aplica_a === 'familiar' || b.aplica_a === 'ambos') {
      let where = 'f.activo = TRUE AND b.activo = TRUE';
      const params: any[] = [];
      if (relacionesPermitidas.length > 0) {
        where += ` AND f.relacion = ANY($1)`;
        params.push(relacionesPermitidas);
      }
      const famRes = await query(`
        SELECT f.dni, f.nombre_completo, f.relacion, f.fecha_nacimiento,
               b.dni as titular_dni, b.nombre as titular_nombre, b.apellido as titular_apellido,
               b.cargo as titular_cargo
        FROM familiares f JOIN beneficiarios b ON b.id = f.beneficiario_id
        WHERE ${where} ORDER BY b.apellido, b.nombre, f.relacion, f.nombre_completo
      `, params);
      const relacionLabel: Record<string, string> = {
        Parents: 'Madre/Padre', Spouse: 'Cónyuge', CivilUnion: 'Concubino/a',
        Child: 'Hijo/a', Sibling: 'Hermano/a', Other: 'Otro',
      };
      const sheet = XLSX.utils.json_to_sheet(famRes.rows.map((f: any) => ({
        'DNI Familiar': f.dni,
        'Nombre Familiar': f.nombre_completo,
        'Relación': relacionLabel[f.relacion] || f.relacion,
        'Fecha Nac.': f.fecha_nacimiento ? new Date(f.fecha_nacimiento).toLocaleDateString('es-AR') : '',
        'DNI Titular': f.titular_dni,
        'Titular': `${f.titular_nombre} ${f.titular_apellido}`,
        'Cargo Titular': f.titular_cargo || '—',
      })));
      XLSX.utils.book_append_sheet(wb, sheet, 'Familiares');
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `autorizados-${(b.nombre || 'beneficio').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: 'Error exportando', detalle: error.message });
  }
});

// PUT /api/admin/beneficios/:id/skipass-config — Configurar temporada + descuentos skipass
router.put('/beneficios/:id/skipass-config', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      fecha_inicio,                   // "2026-06-21"
      fecha_fin,                      // "2026-10-12"
      familiar_descuento,             // number: 50 = 50% descuento para familiares
      permite_familiar_sin_titular,   // boolean
      relaciones_familiar,            // "Parents,Spouse,CivilUnion,Child"
    } = req.body;

    if (!fecha_inicio || !fecha_fin) {
      return res.status(400).json({ error: 'fecha_inicio y fecha_fin son requeridas' });
    }

    const escala_descuentos = {
      titular: { tipo: 'gratuito', porcentaje: 100 },
      familiar: { tipo: 'descuento', porcentaje: Number(familiar_descuento) || 50 },
      temporada: new Date(fecha_inicio).getFullYear().toString(),
      permite_familiar_sin_titular: !!permite_familiar_sin_titular,
    };

    const adminNombre = (req as any).user?.nombre
      ? `${(req as any).user.nombre} ${(req as any).user.apellido || ''}`.trim()
      : (req as any).user?.username || 'Admin';

    const result = await query(
      `UPDATE beneficios
       SET fecha_inicio=$1, fecha_fin=$2,
           escala_descuentos=$3,
           aplica_a='ambos',
           relaciones_familiar=$4,
           modalidad='acceso', categoria='skipass', origen='interno',
           updated_at=NOW()
       WHERE id=$5
       RETURNING id, nombre, fecha_inicio, fecha_fin, escala_descuentos, relaciones_familiar`,
      [fecha_inicio, fecha_fin, JSON.stringify(escala_descuentos),
       relaciones_familiar || 'Parents,Spouse,CivilUnion,Child', id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Beneficio no encontrado' });
    }

    await query(
      `INSERT INTO autorizacion_logs (beneficiario_id, accion, motivo, autorizado_por)
       SELECT gen_random_uuid(), 'config_skipass',
         $1, $2
       WHERE FALSE`, // solo para auditoría conceptual — tabla no tiene campo "config"
      [`Skipass configurado: temporada ${escala_descuentos.temporada}, familiar ${escala_descuentos.familiar.porcentaje}%`, adminNombre]
    ).catch(() => {});

    res.json({ exito: true, beneficio: result.rows[0] });
  } catch (error: any) {
    console.error('Error config skipass:', error.message);
    res.status(500).json({ error: 'Error guardando configuración skipass', detalle: error.message });
  }
});

// V3F — Seed boleterías + skipass
router.post('/seed-boleterias-skipass', async (req: AuthRequest, res: Response) => {
  try {
    await ensureLogoColumn();
    await ensureBeneficiosV2();

    const boleterias = [
      { qr: 'POPPER-BOLETERIA-CIUDAD', nombre: 'Boletería Ciudad', direccion: 'Av. San Martín 1234', ciudad: 'Ushuaia' },
      { qr: 'POPPER-BOLETERIA-CERRO', nombre: 'Boletería Cerro Castor', direccion: 'Base Cerro Castor RN 3', ciudad: 'Ushuaia' },
    ];

    const comercioIds: string[] = [];
    for (const b of boleterias) {
      const existing = await query(`SELECT id FROM comercios WHERE qr_code=$1`, [b.qr]);
      if (existing.rows.length > 0) {
        await query(`UPDATE comercios SET activo=TRUE, nombre=$1, direccion=$2, ciudad=$3, updated_at=NOW() WHERE qr_code=$4`,
          [b.nombre, b.direccion, b.ciudad, b.qr]);
        comercioIds.push(existing.rows[0].id);
      } else {
        const r = await query(
          `INSERT INTO comercios (nombre, direccion, ciudad, provincia, qr_code, horario_apertura, horario_cierre, activo, responsable)
           VALUES ($1, $2, $3, 'Tierra del Fuego', $4, '08:00', '20:00', TRUE, 'Punto de retiro interno') RETURNING id`,
          [b.nombre, b.direccion, b.ciudad, b.qr]
        );
        comercioIds.push(r.rows[0].id);
      }
    }

    // Upsert beneficio Skipass · Temporada con limite_total=1
    let skipassId: string;
    const exSki = await query(`SELECT id FROM beneficios WHERE LOWER(nombre) LIKE '%pase de esquí%' OR LOWER(nombre) LIKE '%skipass%' LIMIT 1`);
    const hoy = new Date().toISOString().split('T')[0];
    const finAnio = `${new Date().getFullYear()}-12-31`;
    if (exSki.rows.length > 0) {
      skipassId = exSki.rows[0].id;
      await query(`UPDATE beneficios SET
        activo=TRUE, origen='interno', categoria='skipass', modalidad='acceso', aplica_a='ambos',
        relaciones_familiar='Parents,Spouse,CivilUnion,Child', limite_total=1,
        nombre='Pase de Esquí · Temporada',
        descripcion='Retiro de pase de temporada en boletería. Incluye familiares directos (madre/padre, cónyuge, concubino/a, hijos). Solo 1 por persona por temporada.',
        updated_at=NOW() WHERE id=$1`, [skipassId]);
    } else {
      const r = await query(`
        INSERT INTO beneficios (nombre, descripcion, tipo, nivel_minimo, fecha_inicio, fecha_fin,
          horario_inicio, horario_fin, activo, origen, categoria, aplica_a, modalidad,
          relaciones_familiar, limite_total)
        VALUES ('Pase de Esquí · Temporada',
          'Retiro de pase de temporada en boletería. Incluye familiares directos (madre/padre, cónyuge, concubino/a, hijos). Solo 1 por persona por temporada.',
          'acceso', 'bronce', $1, $2, '08:00', '20:00', TRUE,
          'interno', 'skipass', 'ambos', 'acceso',
          'Parents,Spouse,CivilUnion,Child', 1) RETURNING id
      `, [hoy, finAnio]);
      skipassId = r.rows[0].id;
    }

    // Asociar skipass con ambas boleterías
    for (const cid of comercioIds) {
      await query(`INSERT INTO comercio_beneficios (comercio_id, beneficio_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [cid, skipassId]);
    }

    res.json({
      exito: true,
      mensaje: 'Boleterías y skipass configurados',
      boleterias: boleterias.map(b => ({ nombre: b.nombre, qr: b.qr })),
      skipass_id: skipassId,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Error seed boleterías', detalle: error.message });
  }
});

// V3H FIX — Normalizar relaciones numéricas (Naaloo a veces devuelve '2' en vez de 'Spouse')
router.post('/familiares/normalizar-relaciones', async (req: AuthRequest, res: Response) => {
  try {
    const updates = [
      { from: '0', to: 'Undefined' },
      { from: '1', to: 'Child' },
      { from: '2', to: 'Spouse' },
      { from: '3', to: 'Sibling' },
      { from: '4', to: 'Other' },
      { from: '5', to: 'Parents' },
      { from: '6', to: 'CivilUnion' },
    ];
    let total = 0;
    for (const u of updates) {
      const r = await query(`UPDATE familiares SET relacion=$1, updated_at=NOW() WHERE relacion=$2 RETURNING id`, [u.to, u.from]);
      total += r.rows.length;
    }
    res.json({ exito: true, normalizados: total });
  } catch (error: any) {
    res.status(500).json({ error: 'Error normalizando', detalle: error.message });
  }
});

// V3H — Crear familiar manualmente (cuando aún no está en Naaloo)
router.post('/familiares', async (req: AuthRequest, res: Response) => {
  try {
    const { beneficiario_id, dni, nombre_completo, relacion, fecha_nacimiento, email, telefono, a_cargo } = req.body;
    if (!beneficiario_id || !dni || !nombre_completo || !relacion) {
      return res.status(400).json({ error: 'Faltan datos: beneficiario_id, dni, nombre_completo, relacion' });
    }
    const validRel = ['Parents', 'Spouse', 'CivilUnion', 'Child', 'Sibling', 'Other'];
    if (!validRel.includes(relacion)) {
      return res.status(400).json({ error: `Relación inválida. Debe ser una de: ${validRel.join(', ')}` });
    }
    const result = await query(
      `INSERT INTO familiares (beneficiario_id, dni, nombre_completo, relacion, fecha_nacimiento, email, telefono, a_cargo, activo, ultima_sync)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW())
       ON CONFLICT (beneficiario_id, dni) DO UPDATE SET
         nombre_completo=EXCLUDED.nombre_completo, relacion=EXCLUDED.relacion,
         fecha_nacimiento=EXCLUDED.fecha_nacimiento, email=EXCLUDED.email,
         telefono=EXCLUDED.telefono, a_cargo=EXCLUDED.a_cargo,
         activo=TRUE, updated_at=NOW()
       RETURNING *`,
      [beneficiario_id, dni, nombre_completo, relacion, fecha_nacimiento || null,
       email || null, telefono || null, a_cargo || false]
    );
    res.json({ familiar: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: 'Error creando familiar', detalle: error.message });
  }
});

router.get('/familiares', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT f.id, f.dni, f.nombre_completo, f.relacion, f.fecha_nacimiento, f.a_cargo, f.activo,
             f.ultima_sync, b.id as titular_id, b.dni as titular_dni,
             b.nombre as titular_nombre, b.apellido as titular_apellido
      FROM familiares f
      JOIN beneficiarios b ON b.id = f.beneficiario_id
      WHERE f.activo = TRUE
      ORDER BY b.apellido, b.nombre, f.relacion, f.nombre_completo
    `);
    res.json({ familiares: result.rows });
  } catch (error: any) {
    res.status(500).json({ error: 'Error listando familiares', detalle: error.message });
  }
});

// ============================================
// ALERTAS DEL SISTEMA
// ============================================

// GET /api/admin/alertas - Estado del sistema para el dashboard
// Devuelve beneficios vencidos/por vencer, límites agotados y stats de hoy
router.get('/alertas', async (req: AuthRequest, res: Response) => {
  try {
    const [
      porVencer,
      yaVencidos,
      limiteAgotado,
      statsHoy,
    ] = await Promise.all([
      // Beneficios activos que vencen en los próximos 7 días
      query(`
        SELECT id, nombre, fecha_fin,
               EXTRACT(DAY FROM fecha_fin - NOW())::int AS dias_restantes
        FROM beneficios
        WHERE activo = TRUE AND fecha_fin IS NOT NULL
          AND fecha_fin BETWEEN NOW() AND NOW() + INTERVAL '7 days'
        ORDER BY fecha_fin ASC
      `),
      // Beneficios que ya vencieron pero siguen activos (inconsistencia de datos)
      query(`
        SELECT id, nombre, fecha_fin
        FROM beneficios
        WHERE activo = TRUE AND fecha_fin IS NOT NULL AND fecha_fin < NOW()
        ORDER BY fecha_fin DESC
        LIMIT 10
      `),
      // Beneficios con límite de uso total agotado
      query(`
        SELECT b.id, b.nombre, b.limite_total,
               COUNT(v.id)::int AS usos_realizados
        FROM beneficios b
        JOIN verificaciones v ON v.beneficio_id = b.id AND v.estado = 'exitoso'
        WHERE b.activo = TRUE AND b.limite_total IS NOT NULL
        GROUP BY b.id, b.nombre, b.limite_total
        HAVING COUNT(v.id) >= b.limite_total
      `).catch(() => ({ rows: [] })),
      // Stats del día
      query(`
        SELECT
          COUNT(*) FILTER (WHERE fecha_verificacion >= CURRENT_DATE)::int AS canjes_hoy,
          COUNT(*) FILTER (WHERE fecha_verificacion >= date_trunc('week', CURRENT_DATE))::int AS canjes_semana,
          COUNT(DISTINCT beneficiario_id) FILTER (WHERE fecha_verificacion >= CURRENT_DATE)::int AS colaboradores_hoy
        FROM verificaciones WHERE estado = 'exitoso'
      `),
    ]);

    const alertas = [];

    // Generar alertas priorizadas
    if (yaVencidos.rows.length > 0) {
      alertas.push({
        tipo: 'error',
        titulo: `${yaVencidos.rows.length} beneficio${yaVencidos.rows.length > 1 ? 's' : ''} vencido${yaVencidos.rows.length > 1 ? 's' : ''} y aún activo${yaVencidos.rows.length > 1 ? 's' : ''}`,
        detalle: yaVencidos.rows.map((b: any) => b.nombre).join(', '),
        items: yaVencidos.rows,
        accion: 'Ir a Beneficios y desactivarlos manualmente',
      });
    }

    if (porVencer.rows.length > 0) {
      const hoy = porVencer.rows.filter((b: any) => b.dias_restantes <= 1);
      const semana = porVencer.rows.filter((b: any) => b.dias_restantes > 1);
      if (hoy.length > 0) {
        alertas.push({
          tipo: 'warning',
          titulo: `${hoy.length} beneficio${hoy.length > 1 ? 's' : ''} vence${hoy.length > 1 ? 'n' : ''} hoy o mañana`,
          detalle: hoy.map((b: any) => b.nombre).join(', '),
          items: hoy,
        });
      }
      if (semana.length > 0) {
        alertas.push({
          tipo: 'info',
          titulo: `${semana.length} beneficio${semana.length > 1 ? 's' : ''} vence${semana.length > 1 ? 'n' : ''} en los próximos 7 días`,
          detalle: semana.map((b: any) => `${b.nombre} (${b.dias_restantes}d)`).join(', '),
          items: semana,
        });
      }
    }

    if (limiteAgotado.rows.length > 0) {
      alertas.push({
        tipo: 'warning',
        titulo: `${limiteAgotado.rows.length} beneficio${limiteAgotado.rows.length > 1 ? 's' : ''} con límite de uso agotado`,
        detalle: limiteAgotado.rows.map((b: any) => `${b.nombre} (${b.usos_realizados}/${b.limite_total})`).join(', '),
        items: limiteAgotado.rows,
      });
    }

    res.json({
      alertas,
      stats: statsHoy.rows[0] || {},
      ok: yaVencidos.rows.length === 0 && porVencer.rows.length === 0,
    });
  } catch (error: any) {
    console.error('Error obteniendo alertas:', error.message);
    res.status(500).json({ error: 'Error obteniendo alertas', detalle: error.message });
  }
});

export default router;
