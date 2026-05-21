# 🚀 SEMANA 1: SETUP INICIAL - PASO A PASO

## 📅 CRONOGRAMA

```
LUNES:   Setup del proyecto + Node.js/Express
MARTES:  Base de datos PostgreSQL
MIÉRCOLES: Autenticación segura
JUEVES:  Integración Frontend-Backend básica
VIERNES: Testing y ajustes
```

---

## 🎯 LUNES: SETUP DEL PROYECTO

### Paso 1.1: Crear carpeta backend

```bash
# Abre PowerShell en C:\Users\Personal\Desktop\BENEFICIOS QR

mkdir backend
cd backend
npm init -y
```

### Paso 1.2: Instalar dependencias

```bash
npm install express cors dotenv bcryptjs jsonwebtoken pg zod
npm install -D nodemon @types/node typescript ts-node
npm install -D @types/express @types/node
```

### Paso 1.3: Crear estructura

```
backend/
├── src/
│   ├── index.ts          (servidor principal)
│   ├── config.ts         (variables de entorno)
│   ├── db.ts             (conexión PostgreSQL)
│   ├── middleware/
│   │   ├── auth.ts       (JWT verificación)
│   │   └── validation.ts (Zod schemas)
│   ├── routes/
│   │   ├── auth.ts       (login)
│   │   ├── verificacion.ts (verificar beneficio)
│   │   └── dashboard.ts  (estadísticas)
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── verificacion.controller.ts
│   │   └── dashboard.controller.ts
│   ├── services/
│   │   ├── beneficiario.service.ts
│   │   ├── beneficio.service.ts
│   │   └── verificacion.service.ts
│   └── types.ts          (interfaces)
├── .env.example
├── .env.local           (NUNCA commitar)
├── tsconfig.json
└── package.json
```

### Paso 1.4: Crear `tsconfig.json`

```bash
npx tsc --init
```

Edita para que contenga:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### Paso 1.5: Crear `.env.example`

```
# .env.example (COMMITEAR ESTO)
DATABASE_URL=postgresql://user:password@localhost:5432/popper
JWT_SECRET=tu-secreto-super-largo-aqui-cambiar-en-prod
PORT=3001
NODE_ENV=development
```

### Paso 1.6: Crear `.env.local`

```
# .env.local (NUNCA COMMITAR)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/popper_dev
JWT_SECRET=dev-secret-temporario-1234567890abcdefghij
PORT=3001
NODE_ENV=development
```

### Paso 1.7: Crear `src/config.ts`

```typescript
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  nodeEnv: process.env.NODE_ENV || 'development',
};

if (!config.databaseUrl || !config.jwtSecret) {
  throw new Error('Variables de entorno faltantes en .env.local');
}
```

### Paso 1.8: Crear `src/index.ts`

```typescript
import express from 'express';
import cors from 'cors';
import { config } from './config';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Routes (agregar después)
// app.use('/api/auth', authRoutes);
// app.use('/api/verificacion', verificacionRoutes);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(config.port, () => {
  console.log(`✅ Servidor corriendo en puerto ${config.port}`);
  console.log(`📍 http://localhost:${config.port}`);
});
```

### Paso 1.9: Actualizar `package.json`

Reemplaza la sección "scripts":
```json
"scripts": {
  "dev": "nodemon --exec ts-node src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "test": "echo \"Error: no test specified\" && exit 1"
}
```

### Paso 1.10: Probar que funciona

```bash
npm run dev
```

Deberías ver:
```
✅ Servidor corriendo en puerto 3001
📍 http://localhost:3001
```

Abre en navegador: `http://localhost:3001/api/health`

Deberías ver:
```json
{
  "status": "ok",
  "timestamp": "2026-05-20T18:35:22.123Z"
}
```

---

## 📍 MARTES: BASE DE DATOS PostgreSQL

### Paso 2.1: Instalar PostgreSQL

```
Descarga: https://www.postgresql.org/download/windows/
Versión: 15 o 16

Durante instalación:
- Usuario: postgres
- Contraseña: postgres (temporal, cambiar después)
- Puerto: 5432 (default)

Instala también: pgAdmin (gestor visual)
```

### Paso 2.2: Crear base de datos

Abre pgAdmin (debería estar en: `http://localhost:5050`)

O en PowerShell:
```bash
psql -U postgres -h localhost

# Dentro de psql:
CREATE DATABASE popper_dev;
\c popper_dev
```

### Paso 2.3: Crear tablas

Crea archivo `backend/sql/init.sql`:

```sql
-- Beneficiarios (Empleados)
CREATE TABLE beneficiarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dni VARCHAR(8) UNIQUE NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  telefono VARCHAR(20),
  nivel VARCHAR(20) NOT NULL CHECK (nivel IN ('bronce', 'plata', 'oro', 'platinum')),
  departamento VARCHAR(100),
  empresa VARCHAR(100),
  fecha_ingreso DATE,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Beneficios (Descuentos, accesos, etc)
CREATE TABLE beneficios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  tipo VARCHAR(50) NOT NULL,
  nivel_minimo VARCHAR(20) NOT NULL,
  descuento DECIMAL(5, 2),
  valor_fijo DECIMAL(10, 2),
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  horario_inicio VARCHAR(5),
  horario_fin VARCHAR(5),
  limite_uso_diario INT,
  limite_uso_semanal INT,
  limite_uso_mensual INT,
  limite_total INT,
  activo BOOLEAN DEFAULT TRUE,
  uso_actual INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Comercios (Farmacias, Gimnasio, Restaurantes)
CREATE TABLE comercios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL,
  direccion VARCHAR(200),
  ciudad VARCHAR(100),
  provincia VARCHAR(100),
  codigo_postal VARCHAR(10),
  telefono VARCHAR(20),
  email VARCHAR(100),
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  horario_apertura VARCHAR(5),
  horario_cierre VARCHAR(5),
  activo BOOLEAN DEFAULT TRUE,
  qr_code VARCHAR(100),
  responsable VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Verificaciones (Transacciones)
CREATE TABLE verificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiario_id UUID NOT NULL REFERENCES beneficiarios(id),
  beneficiario_dni VARCHAR(8),
  beneficiario_nombre VARCHAR(100),
  beneficio_id UUID NOT NULL REFERENCES beneficios(id),
  beneficio_nombre VARCHAR(100),
  comercio_id UUID NOT NULL REFERENCES comercios(id),
  comercio_nombre VARCHAR(100),
  usuario_verificador_id UUID,
  usuario_verificador_nombre VARCHAR(100),
  estado VARCHAR(20) NOT NULL CHECK (estado IN ('exitoso', 'fallido', 'pendiente', 'cancelado')),
  fecha_verificacion TIMESTAMP NOT NULL DEFAULT NOW(),
  monto_descuento DECIMAL(10, 2),
  monto_original DECIMAL(10, 2),
  monto_final DECIMAL(10, 2),
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  notas TEXT,
  codigo_referencia VARCHAR(50) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_beneficiario (beneficiario_id),
  INDEX idx_fecha (fecha_verificacion)
);

-- Audit Log
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID,
  usuario_nombre VARCHAR(100),
  accion VARCHAR(100),
  modulo VARCHAR(50),
  registro_id UUID,
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  ip VARCHAR(45),
  user_agent TEXT,
  fecha TIMESTAMP NOT NULL DEFAULT NOW(),
  exitoso BOOLEAN DEFAULT TRUE,
  INDEX idx_usuario (usuario_id),
  INDEX idx_fecha (fecha)
);

-- Usuarios (Cajeros, Supervisores, Admin)
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100),
  password_hash VARCHAR(255) NOT NULL,
  nombre VARCHAR(100),
  apellido VARCHAR(100),
  rol VARCHAR(50) NOT NULL CHECK (rol IN ('admin', 'supervisor', 'empleado', 'auditor')),
  sucursal_id UUID REFERENCES comercios(id),
  activo BOOLEAN DEFAULT TRUE,
  ultimo_acceso TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(username)
);

-- Relación: Beneficios disponibles en Comercios
CREATE TABLE comercio_beneficios (
  comercio_id UUID NOT NULL REFERENCES comercios(id) ON DELETE CASCADE,
  beneficio_id UUID NOT NULL REFERENCES beneficios(id) ON DELETE CASCADE,
  PRIMARY KEY (comercio_id, beneficio_id)
);

-- Indices para performance
CREATE INDEX idx_beneficiarios_dni ON beneficiarios(dni);
CREATE INDEX idx_beneficiarios_nivel ON beneficiarios(nivel);
CREATE INDEX idx_beneficios_activo ON beneficios(activo);
CREATE INDEX idx_comercios_activo ON comercios(activo);
CREATE INDEX idx_verificaciones_beneficiario ON verificaciones(beneficiario_id);
CREATE INDEX idx_verificaciones_estado ON verificaciones(estado);
CREATE INDEX idx_usuarios_username ON usuarios(username);
```

### Paso 2.4: Ejecutar SQL

```bash
# En PowerShell
psql -U postgres -h localhost -d popper_dev -f sql/init.sql

# Si sale error, verifica que el archivo existe:
ls sql/init.sql
```

### Paso 2.5: Cargar datos de ejemplo

Crea `backend/sql/seed.sql`:

```sql
-- Insertar comercios
INSERT INTO comercios (nombre, direccion, ciudad, provincia, codigo_postal, telefono, email, lat, lng, horario_apertura, horario_cierre, activo, qr_code, responsable)
VALUES 
  ('Farmacia Popper - Centro', 'Av. Libertador 5000', 'Buenos Aires', 'Buenos Aires', 'C1425', '+54 11 4567-1000', 'centro@farmaciapopper.com.ar', -34.5748, -58.4216, '08:00', '22:00', true, 'QR-FARMA-CENTRO-001', 'Sandra Pérez'),
  ('Farmacia Popper - Norte', 'Av. del Libertador 9500', 'Buenos Aires', 'Buenos Aires', 'C1429', '+54 11 4567-2000', 'norte@farmaciapopper.com.ar', -34.5267, -58.4534, '09:00', '21:00', true, 'QR-FARMA-NORTE-002', 'Martín García'),
  ('Gimnasio FitPopper', 'Av. Santa Fe 3200', 'Buenos Aires', 'Buenos Aires', 'C1123', '+54 11 4567-4000', 'principal@fitpopper.com.ar', -34.5874, -58.3890, '06:00', '23:00', true, 'QR-GYM-PRINCIPAL-001', 'Carlos Ruiz'),
  ('Restaurante Popper Gourmet', 'Av. Callao 890', 'Buenos Aires', 'Buenos Aires', 'C1022', '+54 11 4567-5000', 'reservas@poppergourmet.com.ar', -34.6033, -58.3897, '12:00', '00:00', true, 'QR-REST-GOURMET-001', 'Chef María López'),
  ('Estacionamiento Popper Mall', 'Av. Cabildo 2500', 'Buenos Aires', 'Buenos Aires', 'C1425', '+54 11 4567-7000', 'estacionamiento@poppermall.com.ar', -34.5560, -58.4520, '00:00', '23:59', true, 'QR-PARK-MALL-001', 'Roberto Vega');

-- Insertar beneficios
INSERT INTO beneficios (nombre, descripcion, tipo, nivel_minimo, descuento, fecha_inicio, fecha_fin, horario_inicio, horario_fin, limite_uso_diario, limite_uso_mensual, activo, uso_actual)
VALUES
  ('Descuento 15% Farmacias', '15% de descuento en medicamentos', 'descuento', 'bronce', 15.00, '2024-01-01', '2025-12-31', '08:00', '22:00', 2, 10, true, 0),
  ('Acceso Gimnasio VIP', 'Acceso ilimitado a todas las instalaciones', 'acceso', 'plata', NULL, '2024-01-01', '2025-12-31', '06:00', '23:00', 1, 30, true, 0),
  ('2x1 Restaurantes', '2x1 en cenas (niveles Oro y Platinum)', 'promocion', 'oro', NULL, '2024-01-01', '2025-12-31', '19:00', '23:30', 1, 4, true, 0),
  ('Estacionamiento Premium', 'Estacionamiento gratuito', 'acceso', 'oro', NULL, '2024-01-01', '2025-12-31', '00:00', '23:59', 1, 30, true, 0);

-- Insertar comercio-beneficio relación
INSERT INTO comercio_beneficios (comercio_id, beneficio_id)
SELECT c.id, b.id FROM comercios c, beneficios b
WHERE (c.nombre LIKE '%Farmacia%' AND b.nombre LIKE '%Farmacias%')
   OR (c.nombre LIKE '%Gimnasio%' AND b.nombre LIKE '%Gimnasio%')
   OR (c.nombre LIKE '%Restaurante%' AND b.nombre LIKE '%Restaurante%')
   OR (c.nombre LIKE '%Estacionamiento%' AND b.nombre LIKE '%Estacionamiento%');

-- Insertar beneficiarios de ejemplo (los 30 del CSV)
-- [Ver EJEMPLO_BENEFICIARIOS.csv - copiar datos aquí después]
```

Luego ejecuta:
```bash
psql -U postgres -h localhost -d popper_dev -f sql/seed.sql
```

### Paso 2.6: Verificar datos

En pgAdmin:
```
Servidor > postgres > Databases > popper_dev > Tables

Verifica que existan:
- beneficiarios (vacía por ahora, la llenaremos después)
- beneficios (4 registros)
- comercios (5 registros)
- usuarios (vacía)
- verificaciones (vacía)
- audit_logs (vacía)
```

---

## 🔐 MIÉRCOLES: AUTENTICACIÓN SEGURA

### Paso 3.1: Crear `src/types.ts`

```typescript
export interface Usuario {
  id: string;
  username: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: 'admin' | 'supervisor' | 'empleado' | 'auditor';
  sucursal_id?: string;
  activo: boolean;
  ultimo_acceso?: Date;
}

export interface AuthRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  user: Omit<Usuario, 'password'>;
  token: string;
}

export interface JwtPayload {
  userId: string;
  username: string;
  rol: string;
}
```

### Paso 3.2: Crear `src/db.ts`

```typescript
import { Pool } from 'pg';
import { config } from './config';

export const pool = new Pool({
  connectionString: config.databaseUrl,
});

pool.on('error', (err) => {
  console.error('Error en pool de conexión:', err);
});

pool.on('connect', () => {
  console.log('✅ Conectado a PostgreSQL');
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('✅ Query ejecutado:', { text, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error('❌ Error en query:', error);
    throw error;
  }
}

export async function getClient() {
  return pool.connect();
}
```

### Paso 3.3: Crear `src/middleware/auth.ts`

```typescript
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    username: string;
    rol: string;
  };
}

export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

export const generateToken = (userId: string, username: string, rol: string): string => {
  return jwt.sign({ userId, username, rol }, config.jwtSecret, {
    expiresIn: '8h',
    algorithm: 'HS512',
  });
};
```

### Paso 3.4: Crear `src/middleware/validation.ts`

```typescript
import { z } from 'zod';

export const LoginSchema = z.object({
  username: z.string().min(1, 'Username requerido'),
  password: z.string().min(6, 'Contraseña debe tener al menos 6 caracteres'),
});

export const BuscarBeneficiarioSchema = z.object({
  dni: z.string().regex(/^\d{8}$/, 'DNI debe tener 8 dígitos'),
});

export const VerificacionSchema = z.object({
  dni: z.string().regex(/^\d{8}$/, 'DNI debe tener 8 dígitos'),
  comercio_id: z.string().uuid('ID de comercio inválido'),
  beneficio_id: z.string().uuid('ID de beneficio inválido').optional(),
});

export const validate = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      const validated = schema.parse(req.body);
      req.validated = validated;
      next();
    } catch (err: any) {
      const errors = err.errors?.map((e: any) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      res.status(400).json({ error: 'Validación fallida', details: errors });
    }
  };
};
```

### Paso 3.5: Crear `src/routes/auth.ts`

```typescript
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db';
import { generateToken } from '../middleware/auth';
import { validate, LoginSchema } from '../middleware/validation';
import { config } from '../config';

const router = Router();

// Crear usuario test
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, email, nombre, apellido, rol } = req.body;

    // Hash de contraseña
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await query(
      `INSERT INTO usuarios (username, email, password_hash, nombre, apellido, rol, activo)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, username, email, nombre, apellido, rol`,
      [username, email, passwordHash, nombre, apellido, rol]
    );

    const user = result.rows[0];
    const token = generateToken(user.id, user.username, user.rol);

    res.json({ user, token });
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Usuario ya existe' });
    }
    res.status(500).json({ error: 'Error en registro' });
  }
});

// Login
router.post('/login', validate(LoginSchema), async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    const result = await query(
      'SELECT * FROM usuarios WHERE username = $1 AND activo = true',
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

    // Actualizar último acceso
    await query('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = $1', [user.id]);

    const token = generateToken(user.id, user.username, user.rol);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        nombre: user.nombre,
        apellido: user.apellido,
        rol: user.rol,
      },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en login' });
  }
});

export default router;
```

### Paso 3.6: Actualizar `src/index.ts`

```typescript
import express from 'express';
import cors from 'cors';
import { config } from './config';
import { pool } from './db';
import authRoutes from './routes/auth';

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(config.port, async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log(`✅ Servidor corriendo en puerto ${config.port}`);
    console.log(`📍 http://localhost:${config.port}`);
  } catch (err) {
    console.error('❌ Error de conexión a BD:', err);
    process.exit(1);
  }
});
```

### Paso 3.7: Probar autenticación

```bash
npm run dev
```

Abre Postman o similiar y prueba:

```
POST http://localhost:3001/api/auth/register
Content-Type: application/json

{
  "username": "admin.popper",
  "password": "admin123",
  "email": "admin@grupopopper.com",
  "nombre": "Carlos",
  "apellido": "Popper",
  "rol": "admin"
}
```

Deberías recibir:
```json
{
  "user": {
    "id": "...",
    "username": "admin.popper",
    "nombre": "Carlos",
    "rol": "admin"
  },
  "token": "eyJhbGciOiJIUzUxMiI..."
}
```

---

## 🎯 JUEVES: VERIFICACIÓN DE BENEFICIOS

### Paso 4.1: Crear `src/services/beneficiario.service.ts`

```typescript
import { query } from '../db';

export async function getBeneficiarioByDni(dni: string) {
  const result = await query(
    'SELECT * FROM beneficiarios WHERE dni = $1 AND activo = true',
    [dni]
  );
  return result.rows[0] || null;
}

export async function getBenefitsForBeneficiary(beneficiarioId: string) {
  const result = await query(
    `SELECT b.* FROM beneficios b
     WHERE b.activo = true
     AND (SELECT nivel FROM beneficiarios WHERE id = $1) >= b.nivel_minimo
     AND b.fecha_fin >= NOW()`,
    [beneficiarioId]
  );
  return result.rows;
}
```

### Paso 4.2: Crear `src/routes/verificacion.ts`

```typescript
import { Router, Response } from 'express';
import { query } from '../db';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { validate, VerificacionSchema } from '../middleware/validation';
import { getBeneficiarioByDni } from '../services/beneficiario.service';

const router = Router();

router.use(verifyToken);

// Buscar beneficiario por DNI
router.get('/beneficiario/:dni', async (req: AuthRequest, res: Response) => {
  try {
    const { dni } = req.params;

    if (!/^\d{8}$/.test(dni)) {
      return res.status(400).json({ error: 'DNI inválido' });
    }

    const beneficiario = await getBeneficiarioByDni(dni);

    if (!beneficiario) {
      return res.status(404).json({ error: 'Beneficiario no encontrado' });
    }

    // Registrar acceso en auditoría
    await query(
      `INSERT INTO audit_logs (usuario_id, usuario_nombre, accion, modulo, registro_id, exitoso, ip)
       VALUES ($1, $2, $3, $4, $5, true, $6)`,
      [req.user?.userId, req.user?.username, 'BUSCAR_BENEFICIARIO', 'verificacion', beneficiario.id, req.ip]
    );

    res.json(beneficiario);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en búsqueda' });
  }
});

// Procesar verificación
router.post('/procesar', validate(VerificacionSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { dni, comercio_id, beneficio_id } = req.body;
    const verificadorId = req.user?.userId;
    const verificadorNombre = req.user?.username;

    // 1. Buscar beneficiario
    const beneficiario = await getBeneficiarioByDni(dni);
    if (!beneficiario) {
      return res.status(404).json({ success: false, message: 'Beneficiario no encontrado' });
    }

    if (!beneficiario.activo) {
      return res.status(400).json({ success: false, message: 'Beneficiario inactivo' });
    }

    // 2. Buscar beneficio
    const beneficioResult = await query(
      'SELECT * FROM beneficios WHERE id = $1 AND activo = true',
      [beneficio_id]
    );

    if (beneficioResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Beneficio no disponible' });
    }

    const beneficio = beneficioResult.rows[0];

    // 3. Buscar comercio
    const comercioResult = await query(
      'SELECT * FROM comercios WHERE id = $1 AND activo = true',
      [comercio_id]
    );

    if (comercioResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Comercio no encontrado' });
    }

    const comercio = comercioResult.rows[0];

    // 4. Verificar que comercio ofrece beneficio
    const ofreceBeneficioResult = await query(
      'SELECT * FROM comercio_beneficios WHERE comercio_id = $1 AND beneficio_id = $2',
      [comercio_id, beneficio.id]
    );

    if (ofreceBeneficioResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Beneficio no disponible en este comercio' });
    }

    // 5. Crear verificación
    const codigoReferencia = `REF-${new Date().getFullYear()}-${Math.random().toString().slice(2, 8)}`;

    const insertResult = await query(
      `INSERT INTO verificaciones (
        beneficiario_id, beneficiario_dni, beneficiario_nombre,
        beneficio_id, beneficio_nombre,
        comercio_id, comercio_nombre,
        usuario_verificador_id, usuario_verificador_nombre,
        estado, fecha_verificacion, monto_original, monto_descuento, monto_final,
        codigo_referencia
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12, $13, $14)
      RETURNING *`,
      [
        beneficiario.id,
        beneficiario.dni,
        `${beneficiario.nombre} ${beneficiario.apellido}`,
        beneficio.id,
        beneficio.nombre,
        comercio.id,
        comercio.nombre,
        verificadorId,
        verificadorNombre,
        'exitoso',
        1000, // Monto simulado
        beneficio.descuento ? (1000 * beneficio.descuento) / 100 : 0,
        beneficio.descuento ? 1000 - (1000 * beneficio.descuento) / 100 : 1000,
        codigoReferencia,
      ]
    );

    // 6. Registrar en auditoría
    await query(
      `INSERT INTO audit_logs (usuario_id, usuario_nombre, accion, modulo, registro_id, exitoso, ip)
       VALUES ($1, $2, $3, $4, $5, true, $6)`,
      [verificadorId, verificadorNombre, 'VERIFICACION_EXITOSA', 'verificacion', insertResult.rows[0].id, req.ip]
    );

    res.json({
      success: true,
      message: 'Verificación exitosa',
      verification: insertResult.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error en verificación' });
  }
});

export default router;
```

### Paso 4.3: Actualizar `src/index.ts`

```typescript
import express from 'express';
import cors from 'cors';
import { config } from './config';
import { pool } from './db';
import authRoutes from './routes/auth';
import verificacionRoutes from './routes/verificacion';  // Agregar esta línea

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.use('/api/auth', authRoutes);
app.use('/api/verificacion', verificacionRoutes);  // Agregar esta línea

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(config.port, async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log(`✅ Servidor corriendo en puerto ${config.port}`);
  } catch (err) {
    console.error('❌ Error de conexión a BD:', err);
    process.exit(1);
  }
});
```

---

## 🧪 VIERNES: TESTING

### Paso 5.1: Crear usuarios test

```bash
POST http://localhost:3001/api/auth/register

{
  "username": "sandra.perez",
  "password": "sandra123",
  "email": "sandra@farmaciapopper.com",
  "nombre": "Sandra",
  "apellido": "Pérez",
  "rol": "empleado"
}
```

Guarda el token que recibes.

### Paso 5.2: Cargar empleados de ejemplo

```bash
# Copia los 30 empleados de EJEMPLO_BENEFICIARIOS.csv
# Insértalos en la BD con INSERT statements
```

### Paso 5.3: Probar verificación

```bash
GET http://localhost:3001/api/verificacion/beneficiario/30123456
Headers: Authorization: Bearer [TU_TOKEN_AQUI]
```

Deberías recibir los datos de Roberto Fernández.

```bash
POST http://localhost:3001/api/verificacion/procesar
Headers: Authorization: Bearer [TU_TOKEN_AQUI]
Body: {
  "dni": "30123456",
  "comercio_id": "[ID_FARMACIA_CENTRO]",
  "beneficio_id": "[ID_DESCUENTO_FARMACIAS]"
}
```

Deberías recibir confirmación de verificación exitosa.

### Paso 5.4: Verificar auditoría

```bash
SELECT * FROM audit_logs ORDER BY fecha DESC LIMIT 5;
```

Deberías ver registros de tus búsquedas.

---

## ✅ FIN DE SEMANA 1: CHECKLIST

- [ ] Node.js + Express funcionando
- [ ] PostgreSQL conectado
- [ ] Tablas creadas
- [ ] Autenticación funcionando
- [ ] Verificación de beneficios funcionando
- [ ] Auditoría registrando
- [ ] 30 empleados cargados
- [ ] Tests manuales pasando

---

## 🎯 PRÓXIMA SEMANA (Semana 2)

Vamos a:
1. Conectar Frontend con Backend
2. Crear Dashboard para supervisor
3. Tests automatizados

---

## 📞 ¿PREGUNTAS?

Cuando llegues al viernes, me avisas cómo te fue:
- ✅ "Todo funciona"
- ⚠️ "Tengo error en X"
- ❓ "No entiendo el paso Y"

Estaré aquí para ayudarte. 🚀
