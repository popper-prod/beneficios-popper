import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { buscarEmpleadoPorDni, obtenerEmpleadosActivos, naalooToBeneficiario } from '../services/naaloo';

const router = Router();

router.use(verifyToken);

const BuscarBeneficiarioSchema = z.object({
  dni: z.string().regex(/^\d{8}$/, 'DNI debe ser 8 dígitos'),
});

const VerificacionSchema = z.object({
  dni: z.string().regex(/^\d{8}$/, 'DNI debe ser 8 dígitos'),
  beneficio_id: z.string().uuid('Beneficio ID inválido'),
  comercio_id: z.string().uuid('Comercio ID inválido'),
  monto_original: z.number().positive('Monto debe ser positivo'),
  monto_descuento: z.number().nonnegative('Descuento no puede ser negativo'),
  latitud: z.number().optional(),
  longitud: z.number().optional(),
});

router.get('/beneficiario/:dni', async (req: AuthRequest, res: Response) => {
  try {
    const dni = req.params.dni as string;

    if (!/^\d{7,8}$/.test(dni)) {
      return res.status(400).json({ error: 'DNI inválido' });
    }

    // 1. Buscar primero en Naaloo (datos reales de RRHH)
    const empleadoNaaloo = await buscarEmpleadoPorDni(dni);

    if (empleadoNaaloo) {
      const beneficiario = naalooToBeneficiario(empleadoNaaloo);

      // Buscar beneficios disponibles según su nivel
      const nivelOrder: Record<string, number> = { bronce: 1, plata: 2, oro: 3, platinum: 4 };
      const beneficiosResult = await query(
        `SELECT b.id, b.nombre, b.descripcion, b.tipo, b.descuento, b.valor_fijo, b.horario_inicio, b.horario_fin, b.nivel_minimo
         FROM beneficios b WHERE b.activo = TRUE`
      );

      const beneficiosFiltrados = beneficiosResult.rows.filter(
        (b: any) => (nivelOrder[b.nivel_minimo] || 0) <= (nivelOrder[beneficiario.nivel] || 0)
      );

      return res.json({
        beneficiario,
        beneficios: beneficiosFiltrados,
        fuente: 'naaloo',
      });
    }

    // 2. Si no está en Naaloo, buscar en BD local
    const result = await query(
      `SELECT id, dni, nombre, apellido, email, telefono, nivel, activo, legajo, departamento
       FROM beneficiarios WHERE dni = $1`,
      [dni]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Beneficiario no encontrado' });
    }

    const beneficiario = result.rows[0];

    if (!beneficiario.activo) {
      return res.status(403).json({ error: 'Beneficiario inactivo' });
    }

    const beneficiosResult = await query(
      `SELECT b.id, b.nombre, b.descripcion, b.tipo, b.descuento, b.valor_fijo, b.horario_inicio, b.horario_fin
       FROM beneficios b
       WHERE b.activo = TRUE AND b.nivel_minimo <= $1`,
      [beneficiario.nivel]
    );

    res.json({
      beneficiario,
      beneficios: beneficiosResult.rows,
      fuente: 'local',
    });
  } catch (error) {
    console.error('Error buscando beneficiario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint para sincronizar empleados de Naaloo
router.get('/sync-naaloo', async (req: AuthRequest, res: Response) => {
  try {
    const empleados = await obtenerEmpleadosActivos();

    let sincronizados = 0;
    for (const emp of empleados) {
      const beneficiario = naalooToBeneficiario(emp);
      await query(
        `INSERT INTO beneficiarios (dni, nombre, apellido, email, telefono, nivel, departamento, empresa, legajo, fecha_ingreso, activo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (dni) DO UPDATE SET
           nombre = EXCLUDED.nombre,
           apellido = EXCLUDED.apellido,
           email = EXCLUDED.email,
           telefono = EXCLUDED.telefono,
           nivel = EXCLUDED.nivel,
           departamento = EXCLUDED.departamento,
           legajo = EXCLUDED.legajo,
           activo = EXCLUDED.activo,
           updated_at = NOW()`,
        [
          beneficiario.dni, beneficiario.nombre, beneficiario.apellido,
          beneficiario.email, beneficiario.telefono, beneficiario.nivel,
          beneficiario.departamento, beneficiario.empresa, beneficiario.legajo,
          beneficiario.fecha_ingreso, beneficiario.activo
        ]
      );
      sincronizados++;
    }

    res.json({
      exito: true,
      mensaje: `${sincronizados} empleados sincronizados desde Naaloo`,
      total: empleados.length,
    });
  } catch (error) {
    console.error('Error sincronizando Naaloo:', error);
    res.status(500).json({ error: 'Error sincronizando con Naaloo' });
  }
});

router.post('/procesar', validate(VerificacionSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { dni, beneficio_id, comercio_id, monto_original, monto_descuento, latitud, longitud } = req.body;

    const beneficiarioResult = await query(
      'SELECT id, nivel FROM beneficiarios WHERE dni = $1 AND activo = TRUE',
      [dni]
    );

    if (beneficiarioResult.rows.length === 0) {
      return res.status(404).json({ error: 'Beneficiario no encontrado' });
    }

    const beneficiario = beneficiarioResult.rows[0];

    const beneficioResult = await query(
      `SELECT id, nombre, nivel_minimo, limites, uso_actual
       FROM beneficios WHERE id = $1 AND activo = TRUE`,
      [beneficio_id]
    );

    if (beneficioResult.rows.length === 0) {
      return res.status(404).json({ error: 'Beneficio no encontrado' });
    }

    const beneficio = beneficioResult.rows[0];

    if (beneficio.nivel_minimo > beneficiario.nivel) {
      return res.status(403).json({ error: 'Nivel insuficiente para este beneficio' });
    }

    const comercioResult = await query(
      'SELECT id FROM comercios WHERE id = $1 AND activo = TRUE',
      [comercio_id]
    );

    if (comercioResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comercio no encontrado' });
    }

    const codigoReferencia = `VER-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const verificacionResult = await query(
      `INSERT INTO verificaciones (
        beneficiario_id, beneficio_id, comercio_id, usuario_verificador_id,
        estado, monto_original, monto_descuento, monto_final,
        geolocation_lat, geolocation_lng, codigo_referencia
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, estado, codigo_referencia, fecha_verificacion`,
      [
        beneficiario.id,
        beneficio_id,
        comercio_id,
        req.user?.userId,
        'exitoso',
        monto_original,
        monto_descuento,
        monto_original - monto_descuento,
        latitud || null,
        longitud || null,
        codigoReferencia,
      ]
    );

    await query(
      'UPDATE beneficios SET uso_actual = uso_actual + 1 WHERE id = $1',
      [beneficio_id]
    );

    const userAgentValue = req.get('user-agent');
    const userAgent = typeof userAgentValue === 'string' ? userAgentValue : (userAgentValue?.[0] || 'unknown');
    await query(
      `INSERT INTO audit_logs (usuario_id, usuario_nombre, accion, modulo, registro_id, datos_nuevos, ip, user_agent, exitoso)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        req.user?.userId,
        req.user?.username,
        'VERIFICACION',
        'verificaciones',
        verificacionResult.rows[0].id,
        JSON.stringify(verificacionResult.rows[0]),
        req.ip || 'unknown',
        userAgent,
        true,
      ]
    );

    res.json({
      exito: true,
      verificacion: verificacionResult.rows[0],
    });
  } catch (error) {
    console.error('Error procesando verificación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
