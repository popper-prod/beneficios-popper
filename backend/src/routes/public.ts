import { Router, Request, Response } from 'express';
import { query } from '../db';
import { buscarEmpleadoPorDni, naalooToBeneficiario } from '../services/naaloo';

const router = Router();

// GET /api/public/comercio/:qrCode - Info del comercio por QR code
router.get('/comercio/:qrCode', async (req: Request, res: Response) => {
  try {
    const { qrCode } = req.params;

    const result = await query(
      `SELECT c.id, c.nombre, c.direccion, c.ciudad, c.telefono, c.horario_apertura, c.horario_cierre, c.responsable
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

// GET /api/public/beneficiario/:comercioId/:dni - Datos del colaborador + beneficios disponibles
router.get('/beneficiario/:comercioId/:dni', async (req: Request, res: Response) => {
  try {
    const comercioId = req.params.comercioId as string;
    const dni = req.params.dni as string;

    if (!/^\d{7,8}$/.test(dni)) {
      return res.status(400).json({ error: 'DNI invalido' });
    }

    // Verificar que el comercio existe
    const comercioResult = await query(
      'SELECT id, nombre FROM comercios WHERE id = $1 AND activo = TRUE',
      [comercioId]
    );
    if (comercioResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comercio no encontrado' });
    }

    // Buscar en Naaloo primero
    const empleadoNaaloo = await buscarEmpleadoPorDni(dni as string);

    if (empleadoNaaloo) {
      const beneficiario = naalooToBeneficiario(empleadoNaaloo);

      // Obtener beneficios disponibles para este comercio y nivel
      const nivelOrder: Record<string, number> = { bronce: 1, plata: 2, oro: 3, platinum: 4 };
      const beneficiosResult = await query(
        `SELECT b.id, b.nombre, b.descripcion, b.tipo, b.descuento, b.valor_fijo, b.horario_inicio, b.horario_fin, b.nivel_minimo
         FROM beneficios b
         INNER JOIN comercio_beneficios cb ON cb.beneficio_id = b.id
         WHERE cb.comercio_id = $1 AND b.activo = TRUE`,
        [comercioId]
      );

      const beneficiosFiltrados = beneficiosResult.rows.filter(
        (b: any) => (nivelOrder[b.nivel_minimo] || 0) <= (nivelOrder[beneficiario.nivel] || 0)
      );

      return res.json({
        beneficiario: {
          dni: beneficiario.dni,
          nombre: beneficiario.nombre,
          apellido: beneficiario.apellido,
          foto: beneficiario.foto,
          nivel: beneficiario.nivel,
          departamento: beneficiario.departamento,
          cargo: beneficiario.cargo,
          legajo: beneficiario.legajo,
          empresa: beneficiario.empresa,
        },
        beneficios: beneficiosFiltrados,
        comercio: comercioResult.rows[0],
        fuente: 'naaloo',
      });
    }

    // Fallback: buscar en BD local
    const localResult = await query(
      'SELECT id, dni, nombre, apellido, nivel, departamento, legajo, activo FROM beneficiarios WHERE dni = $1',
      [dni]
    );

    if (localResult.rows.length === 0) {
      return res.status(404).json({ error: 'Colaborador no encontrado. Verifica tu DNI.' });
    }

    const beneficiario = localResult.rows[0];
    if (!beneficiario.activo) {
      return res.status(403).json({ error: 'Colaborador inactivo' });
    }

    const nivelOrder: Record<string, number> = { bronce: 1, plata: 2, oro: 3, platinum: 4 };
    const beneficiosResult = await query(
      `SELECT b.id, b.nombre, b.descripcion, b.tipo, b.descuento, b.valor_fijo, b.horario_inicio, b.horario_fin, b.nivel_minimo
       FROM beneficios b
       INNER JOIN comercio_beneficios cb ON cb.beneficio_id = b.id
       WHERE cb.comercio_id = $1 AND b.activo = TRUE`,
      [comercioId]
    );

    const beneficiosFiltrados = beneficiosResult.rows.filter(
      (b: any) => (nivelOrder[b.nivel_minimo] || 0) <= (nivelOrder[beneficiario.nivel] || 0)
    );

    res.json({
      beneficiario: {
        dni: beneficiario.dni,
        nombre: beneficiario.nombre,
        apellido: beneficiario.apellido,
        foto: null,
        nivel: beneficiario.nivel,
        departamento: beneficiario.departamento,
        legajo: beneficiario.legajo,
        empresa: 'Grupo Popper',
      },
      beneficios: beneficiosFiltrados,
      comercio: comercioResult.rows[0],
      fuente: 'local',
    });
  } catch (error) {
    console.error('Error buscando beneficiario:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/public/canjear - Canjear un beneficio (sin auth)
router.post('/canjear', async (req: Request, res: Response) => {
  try {
    const { dni, beneficio_id, comercio_id } = req.body;

    if (!dni || !beneficio_id || !comercio_id) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    // Buscar beneficiario en BD local (o crear desde Naaloo)
    let beneficiarioId: string;

    const localResult = await query('SELECT id FROM beneficiarios WHERE dni = $1', [dni]);

    if (localResult.rows.length > 0) {
      beneficiarioId = localResult.rows[0].id;
    } else {
      // Buscar en Naaloo y sincronizar
      const empleado = await buscarEmpleadoPorDni(dni);
      if (!empleado) {
        return res.status(404).json({ error: 'Colaborador no encontrado' });
      }
      const ben = naalooToBeneficiario(empleado);
      const insertResult = await query(
        `INSERT INTO beneficiarios (dni, nombre, apellido, email, telefono, nivel, departamento, empresa, legajo, fecha_ingreso, activo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (dni) DO UPDATE SET nombre = EXCLUDED.nombre, apellido = EXCLUDED.apellido, nivel = EXCLUDED.nivel, updated_at = NOW()
         RETURNING id`,
        [ben.dni, ben.nombre, ben.apellido, ben.email, ben.telefono, ben.nivel, ben.departamento, ben.empresa, ben.legajo, ben.fecha_ingreso, ben.activo]
      );
      beneficiarioId = insertResult.rows[0].id;
    }

    // Verificar beneficio
    const beneficioResult = await query(
      'SELECT id, nombre FROM beneficios WHERE id = $1 AND activo = TRUE',
      [beneficio_id]
    );
    if (beneficioResult.rows.length === 0) {
      return res.status(404).json({ error: 'Beneficio no encontrado' });
    }

    // Registrar verificacion
    const codigo = `QR-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const verificacion = await query(
      `INSERT INTO verificaciones (
        beneficiario_id, beneficio_id, comercio_id,
        estado, monto_original, monto_descuento, monto_final,
        codigo_referencia
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, estado, codigo_referencia, fecha_verificacion`,
      [beneficiarioId, beneficio_id, comercio_id, 'exitoso', 0, 0, 0, codigo]
    );

    // Incrementar uso
    await query('UPDATE beneficios SET uso_actual = uso_actual + 1 WHERE id = $1', [beneficio_id]);

    res.json({
      exito: true,
      verificacion: verificacion.rows[0],
      beneficio: beneficioResult.rows[0].nombre,
    });
  } catch (error) {
    console.error('Error canjeando beneficio:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;
