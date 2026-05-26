import rateLimit from 'express-rate-limit';

/**
 * Limiter agresivo para el endpoint de canje.
 * 20 canjes por IP por minuto es más que suficiente para un punto de venta legítimo.
 * Un terminal físico rara vez necesita más de 1-2 por minuto.
 */
export const canjearLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Esperá un momento antes de intentar nuevamente.' },
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Limiter para búsqueda de beneficiarios (DNI lookup).
 * 60 por minuto por IP: un cajero activo no necesita más.
 */
export const beneficiarioLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas consultas. Esperá un momento.' },
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Limiter general para todos los endpoints públicos.
 * 120 por minuto por IP cubre cualquier uso legítimo.
 */
export const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Límite de requests alcanzado. Intentá en un minuto.' },
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Limiter para login: bloquear fuerza bruta.
 * 10 intentos por IP en 15 minutos.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de login. Intentá en 15 minutos.' },
  skip: () => process.env.NODE_ENV === 'test',
});
