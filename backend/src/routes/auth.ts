import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db';
import { generateToken, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();

const LoginSchema = z.object({
  username: z.string().min(1, 'Username requerido'),
  password: z.string().min(6, 'Contraseña mínimo 6 caracteres'),
});

const RegisterSchema = z.object({
  username: z.string().min(3, 'Username mínimo 3 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Contraseña mínimo 8 caracteres'),
  nombre: z.string().min(1, 'Nombre requerido'),
  apellido: z.string().min(1, 'Apellido requerido'),
});

// Reset passwords - ejecutar UNA vez y eliminar
router.get('/reset-passwords', async (req: AuthRequest, res: Response) => {
  try {
    const adminHash = await bcrypt.hash('Admin2024!', 12);
    const sandraHash = await bcrypt.hash('Sandra2024!', 12);

    await query('UPDATE usuarios SET password_hash = $1 WHERE username = $2', [adminHash, 'admin.popper']);
    await query('UPDATE usuarios SET password_hash = $1 WHERE username = $2', [sandraHash, 'sandra.perez']);

    res.json({ success: true, message: 'Passwords reseteadas correctamente' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', validate(LoginSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { username, password } = req.body;

    const result = await query(
      'SELECT id, username, email, password_hash, nombre, apellido, rol FROM usuarios WHERE username = $1 AND activo = TRUE',
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
