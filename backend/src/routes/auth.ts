import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db';
import { generateToken, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { loginNaaloo } from '../services/naaloo';

const router = Router();

const LoginSchema = z.object({
  username: z.string().min(1, 'Usuario o email requerido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

const RegisterSchema = z.object({
  username: z.string().min(3, 'Username mínimo 3 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Contraseña mínimo 8 caracteres'),
  nombre: z.string().min(1, 'Nombre requerido'),
  apellido: z.string().min(1, 'Apellido requerido'),
});

// Login hibrido: intenta Naaloo (email+pass) primero, luego local (admin.popper fallback)
router.post('/login', validate(LoginSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { username, password } = req.body;
    const esEmail = username.includes('@');

    // === FLUJO 1: AUTH NAALOO (si parece email) ===
    if (esEmail) {
      const naaloo = await loginNaaloo(username, password);
      if (naaloo) {
        // Validar que tenga permiso en nuestro sistema
        const benefRes = await query(
          `SELECT id, dni, nombre, apellido, email, es_admin, rol_admin
           FROM beneficiarios
           WHERE LOWER(email) = LOWER($1) AND activo = TRUE
           LIMIT 1`,
          [naaloo.email || username]
        );

        if (benefRes.rows.length === 0) {
          return res.status(403).json({
            error: 'Credenciales válidas en Naaloo, pero no se encontró tu perfil en el sistema de beneficios.'
          });
        }

        const benef = benefRes.rows[0];
        if (!benef.es_admin) {
          return res.status(403).json({
            error: 'Tu cuenta de Naaloo no tiene permisos de administración. Solicita acceso a un super-administrador.'
          });
        }

        const rol = benef.rol_admin || 'admin';
        const token = generateToken(benef.id, benef.email, rol);

        // Audit log de acceso
        await query(
          `INSERT INTO autorizacion_logs (beneficiario_id, accion, motivo, autorizado_por)
           VALUES ($1, 'login_admin', $2, $3)`,
          [benef.id, `Login desde Naaloo (${naaloo.fullName})`, benef.email]
        ).catch(() => {}); // ignorar si tabla no existe

        return res.json({
          token,
          user: {
            id: benef.id,
            username: benef.email,
            email: benef.email,
            nombre: benef.nombre,
            apellido: benef.apellido,
            rol,
            origen: 'naaloo',
          },
        });
      }
      // si Naaloo falla, caemos al login local (por si el email coincide con un usuario local)
    }

    // === FLUJO 2: AUTH LOCAL (admin.popper y similares) ===
    const result = await query(
      'SELECT id, username, email, password_hash, nombre, apellido, rol FROM usuarios WHERE (username = $1 OR LOWER(email) = LOWER($1)) AND activo = TRUE',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    await query(
      'UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = $1',
      [user.id]
    );

    const token = generateToken(user.id, user.username, user.rol);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido,
        rol: user.rol,
        origen: 'local',
      },
    });
  } catch (error: any) {
    console.error('Login error:', error?.message || error);
    console.error('Login error stack:', error?.stack);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/register', validate(RegisterSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { username, email, password, nombre, apellido } = req.body;

    const existingUser = await query(
      'SELECT id FROM usuarios WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Usuario o email ya existe' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await query(
      `INSERT INTO usuarios (username, email, password_hash, nombre, apellido, rol)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, nombre, apellido, rol`,
      [username, email, hashedPassword, nombre, apellido, 'empleado']
    );

    const user = result.rows[0];
    const token = generateToken(user.id, user.username, user.rol);

    res.status(201).json({
      token,
      user,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
