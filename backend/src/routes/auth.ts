import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import { query } from '../db';
import { generateToken, verifyToken, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { loginNaaloo } from '../services/naaloo';
import { loginLimiter } from '../middleware/rateLimit';

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

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

const CambiarPasswordSchema = z.object({
  actual: z.string().min(1, 'Contraseña actual requerida'),
  nueva: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
});

// Lazy migration: columnas para la contraseña local de admins (independiente de Naaloo).
// Permite que un super-admin genere una contraseña propia del sistema para un admin
// cuyo login por Naaloo no esté disponible.
let adminPwColumnsReady = false;
export async function ensureAdminPasswordColumns() {
  if (adminPwColumnsReady) return;
  await query(`ALTER TABLE beneficiarios ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`);
  await query(`ALTER TABLE beneficiarios ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE`);
  await query(`ALTER TABLE beneficiarios ADD COLUMN IF NOT EXISTS password_actualizada TIMESTAMP`);
  adminPwColumnsReady = true;
}

// Login hibrido: intenta Naaloo (email+pass) primero, luego local (admin.popper fallback)
router.post('/login', loginLimiter, validate(LoginSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { username, password } = req.body;
    const esEmail = username.includes('@');

    // === FLUJO 0: CONTRASEÑA LOCAL DE ADMIN (independiente de Naaloo) ===
    // Si el admin tiene una contraseña propia del sistema (generada por un
    // super-admin), la validamos primero. Así puede entrar aunque el puente
    // con Naaloo falle. Si no matchea, seguimos con Naaloo (puede usar su pass de Naaloo).
    if (esEmail) {
      await ensureAdminPasswordColumns();
      const localRes = await query(
        `SELECT id, dni, nombre, apellido, email, es_admin, rol_admin, password_hash, must_change_password
         FROM beneficiarios
         WHERE LOWER(email) = LOWER($1) AND activo = TRUE AND es_admin = TRUE AND password_hash IS NOT NULL
         LIMIT 1`,
        [username]
      );
      if (localRes.rows.length > 0) {
        const benef = localRes.rows[0];
        const validLocal = await bcrypt.compare(password, benef.password_hash);
        if (validLocal) {
          const rol = benef.rol_admin || 'admin';
          const token = generateToken(benef.id, benef.email, rol);

          await query(
            `INSERT INTO autorizacion_logs (beneficiario_id, accion, motivo, autorizado_por)
             VALUES ($1, 'login_admin', $2, $3)`,
            [benef.id, 'Login con contraseña local', benef.email]
          ).catch(() => {});

          return res.json({
            token,
            mustChangePassword: !!benef.must_change_password,
            user: {
              id: benef.id,
              username: benef.email,
              email: benef.email,
              nombre: benef.nombre,
              apellido: benef.apellido,
              rol,
              origen: 'local_admin',
            },
          });
        }
        // no matchea la local: continuamos con Naaloo por si usa su contraseña de Naaloo
      }
    }

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

// ============================================
// LOGIN GOOGLE: el frontend envia el ID token (credential) que devuelve Google
// El backend lo verifica con las claves publicas de Google, extrae el email
// y comprueba que el beneficiario tenga es_admin = TRUE
// ============================================
router.post('/login-google', loginLimiter, async (req: AuthRequest, res: Response) => {
  try {
    if (!GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: 'Google Sign-In no esta configurado en el servidor (falta GOOGLE_CLIENT_ID).' });
    }
    const { credential } = req.body || {};
    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({ error: 'Falta el token de Google (credential)' });
    }

    // Verificar el ID token contra las claves publicas de Google
    let payload: any;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (verifyErr: any) {
      console.error('Google verifyIdToken error:', verifyErr?.message || verifyErr);
      return res.status(401).json({ error: 'Token de Google invalido o expirado' });
    }

    if (!payload?.email || !payload?.email_verified) {
      return res.status(401).json({ error: 'Email de Google no verificado' });
    }

    const email = String(payload.email).toLowerCase();

    // Buscar beneficiario por email
    const benefRes = await query(
      `SELECT id, dni, nombre, apellido, email, es_admin, rol_admin, activo
       FROM beneficiarios
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email]
    );

    if (benefRes.rows.length === 0) {
      return res.status(403).json({ error: `No se encontró un colaborador registrado con el email ${email}.` });
    }

    const benef = benefRes.rows[0];

    if (!benef.activo) {
      return res.status(403).json({ error: 'Tu cuenta de colaborador está desactivada. Contactá a RRHH.' });
    }

    if (!benef.es_admin) {
      return res.status(403).json({ error: 'Tu cuenta de Google es válida, pero no tenés permisos de administración en el sistema. Solicitalo a un super-administrador.' });
    }

    const rol = benef.rol_admin || 'admin';
    const token = generateToken(benef.id, benef.email, rol);

    // Audit log
    await query(
      `INSERT INTO autorizacion_logs (beneficiario_id, accion, motivo, autorizado_por)
       VALUES ($1, 'login_admin', $2, $3)`,
      [benef.id, `Login con Google (${payload.name || ''})`, benef.email]
    ).catch(() => {});

    return res.json({
      token,
      user: {
        id: benef.id,
        username: benef.email,
        email: benef.email,
        nombre: benef.nombre,
        apellido: benef.apellido,
        rol,
        origen: 'google',
        avatar: payload.picture || null,
      },
    });
  } catch (error: any) {
    console.error('Login Google error:', error?.message || error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/register', validate(RegisterSchema), async (req: AuthRequest, res: Response) => {
  // Registro deshabilitado en producción. Los accesos se gestionan vía Naaloo + permisos de admin.
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Registro deshabilitado. Los accesos se asignan desde el panel de administración.' });
  }
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

// ============================================
// CAMBIAR CONTRASEÑA: el admin (logueado) setea su propia contraseña local.
// Se usa en el cambio forzado tras un reset, y para cambios voluntarios.
// ============================================
router.post('/cambiar-password', verifyToken, validate(CambiarPasswordSchema), async (req: AuthRequest, res: Response) => {
  try {
    await ensureAdminPasswordColumns();
    const { actual, nueva } = req.body;
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const result = await query(
      `SELECT id, password_hash FROM beneficiarios
       WHERE id = $1 AND es_admin = TRUE AND activo = TRUE LIMIT 1`,
      [userId]
    );
    if (result.rows.length === 0 || !result.rows[0].password_hash) {
      return res.status(400).json({ error: 'No hay una contraseña local para cambiar en esta cuenta.' });
    }

    const validActual = await bcrypt.compare(actual, result.rows[0].password_hash);
    if (!validActual) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
    }

    const nuevaHash = await bcrypt.hash(nueva, 12);
    await query(
      `UPDATE beneficiarios
       SET password_hash = $1, must_change_password = FALSE, password_actualizada = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [nuevaHash, userId]
    );

    await query(
      `INSERT INTO autorizacion_logs (beneficiario_id, accion, motivo, autorizado_por)
       VALUES ($1, 'cambio_password', 'Contraseña cambiada por el usuario', $2)`,
      [userId, req.user?.username || 'usuario']
    ).catch(() => {});

    res.json({ exito: true, mensaje: 'Contraseña actualizada correctamente' });
  } catch (error: any) {
    console.error('Cambiar password error:', error?.message || error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
