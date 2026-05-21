# 🔧 GUÍA DE REMEDIACIÓN TÉCNICA

## 1. ELIMINAR CREDENCIALES DEL CÓDIGO

### ❌ ACTUAL (INSEGURO)
```typescript
// src/config/index.ts
export const MOCK_CREDENTIALS: Record<string, string> = {
  'admin.popper': 'admin123',
  'supervisor.sucursal1': 'super123',
};
```

### ✅ CORRECCIÓN

#### Paso 1: Crear archivo `.env.local` (NUNCA commitearlo)
```
VITE_API_URL=http://localhost:3001
VITE_API_TIMEOUT=30000
```

#### Paso 2: Actualizar `.gitignore`
```
# Git Ignore
.env.local
.env.*.local
```

#### Paso 3: Modificar `src/config/index.ts`
```typescript
// Eliminar MOCK_CREDENTIALS completamente
// Usar variables de entorno en su lugar

export const API_CONFIG = {
  url: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  timeout: import.meta.env.VITE_API_TIMEOUT || 30000,
};
```

---

## 2. AUTENTICACIÓN SEGURA

### ✅ NUEVA IMPLEMENTACIÓN CON BACKEND

#### Instalar dependencias:
```bash
npm install bcryptjs jsonwebtoken zod
npm install -D @types/jsonwebtoken
```

#### Backend: `src/server/auth.ts` (Node.js + Express)
```typescript
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_EXPIRY = '8h';

// Hash de contraseña
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(12); // Costo computacional alto
  return bcrypt.hash(password, salt);
};

// Verificar contraseña
export const verifyPassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

// Generar JWT seguro
export const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
    algorithm: 'HS512', // Algoritmo fuerte
  });
};

// Validar JWT
export const validateToken = (token: string): { userId: string } | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch {
    return null;
  }
};

// Login endpoint (Express)
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  // Validación básica
  if (!username || !password) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  // Buscar usuario (base de datos)
  const user = await database.findUser({ username });
  if (!user) {
    // Respuesta genérica para evitar enumeración
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  // Verificar contraseña
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  // Generar token
  const token = generateToken(user.id);

  // Responder con httpOnly cookie
  res.cookie('auth_token', token, {
    httpOnly: true,      // Protección XSS
    secure: true,        // Solo HTTPS
    sameSite: 'strict',  // Protección CSRF
    maxAge: 8 * 60 * 60 * 1000, // 8 horas
  });

  res.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  });
});
```

#### Frontend: Actualizar `useAuth.ts`
```typescript
export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    expiresAt: null,
  });

  // Login con servidor
  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Incluir cookies httpOnly
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        setError('Credenciales inválidas');
        return false;
      }

      const data = await response.json();
      
      // Token se maneja automáticamente en cookie httpOnly
      // No almacenamos en localStorage
      setAuthState({
        isAuthenticated: true,
        user: data.user,
        token: null, // No almacenar token en cliente
        expiresAt: null,
      });

      return true;
    } catch (err) {
      setError('Error de conexión');
      return false;
    }
  }, []);

  return { ...authState, login, ... };
};
```

---

## 3. VALIDACIÓN DE ENTRADA CON ZOD

### Instalar Zod:
```bash
npm install zod
```

### Crear esquemas de validación:
```typescript
// src/schemas/verification.ts
import { z } from 'zod';

// DNI Argentina: 8 dígitos
const DNI_REGEX = /^\d{8}$/;

// CUIL Argentina: XX-XXXXXXXX-X
const CUIL_REGEX = /^\d{2}-\d{8}-\d{1}$/;

export const VerificationFormSchema = z.object({
  dni: z
    .string()
    .regex(DNI_REGEX, 'DNI debe tener 8 dígitos')
    .transform(v => v.trim()),
  
  comercioId: z
    .string()
    .uuid('Comercio ID inválido'),
  
  beneficioId: z
    .string()
    .uuid('Beneficio ID inválido')
    .optional(),
});

export const BeneficiaryFormSchema = z.object({
  dni: z.string().regex(DNI_REGEX),
  cuil: z.string().regex(CUIL_REGEX).optional(),
  nombre: z.string().min(1).max(100),
  apellido: z.string().min(1).max(100),
  email: z.string().email('Email inválido'),
  telefono: z.string().regex(/^\+?[\d\s-]{10,}$/, 'Teléfono inválido'),
  nivel: z.enum(['bronce', 'plata', 'oro', 'platinum']),
});

export type VerificationFormData = z.infer<typeof VerificationFormSchema>;
export type BeneficiaryFormData = z.infer<typeof BeneficiaryFormSchema>;
```

### Usar en componentes:
```typescript
// VerificationScreen.tsx
const handleVerify = async () => {
  try {
    // Validar entrada
    const validData = VerificationFormSchema.parse({
      dni: beneficiary.dni,
      comercioId: selectedCommerce,
      beneficioId: selectedBenefit || undefined,
    });

    const response = await onVerify(validData);
    // ...
  } catch (err) {
    if (err instanceof z.ZodError) {
      setError(err.errors[0].message);
    }
  }
};
```

---

## 4. ENCRIPTACIÓN DE DATOS SENSIBLES

### Instalar librerías:
```bash
npm install crypto-js
npm install -D @types/crypto-js
```

### Crear utilidad de encriptación:
```typescript
// src/utils/encryption.ts
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.REACT_APP_ENCRYPTION_KEY || '';

export const encryptPII = (data: string): string => {
  if (!ENCRYPTION_KEY) {
    console.warn('Clave de encriptación no configurada');
    return data;
  }
  return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
};

export const decryptPII = (encrypted: string): string => {
  if (!ENCRYPTION_KEY) {
    console.warn('Clave de encriptación no configurada');
    return encrypted;
  }
  return CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY).toString(
    CryptoJS.enc.Utf8
  );
};

// Máscaras para UI
export const maskDNI = (dni: string): string => {
  if (dni.length < 4) return dni;
  return '****' + dni.slice(-4);
};

export const maskEmail = (email: string): string => {
  const [local, domain] = email.split('@');
  return local[0] + '*'.repeat(local.length - 2) + local.slice(-1) + '@' + domain;
};

export const maskPhone = (phone: string): string => {
  return phone.slice(0, 2) + '*'.repeat(phone.length - 6) + phone.slice(-4);
};
```

### Usar en almacenamiento:
```typescript
// Guardar datos encriptados
const storeData = <T,>(key: string, data: T[]): void => {
  const encrypted = encryptPII(JSON.stringify(data));
  localStorage.setItem(key, encrypted);
};

// Recuperar y desencriptar
const getStoredData = <T,>(key: string, defaultData: T[]): T[] => {
  const encrypted = localStorage.getItem(key);
  if (encrypted) {
    try {
      const decrypted = decryptPII(encrypted);
      return JSON.parse(decrypted);
    } catch {
      return defaultData;
    }
  }
  return defaultData;
};
```

---

## 5. RATE LIMITING EN BACKEND

### Backend: Expresiones:
```bash
npm install express-rate-limit
```

### Implementar rate limiting:
```typescript
// src/server/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';

// Rate limit general
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests
  message: 'Demasiadas solicitudes, intente más tarde',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit para login (muy restrictivo)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 intentos
  skipSuccessfulRequests: true, // No contar intentos exitosos
  message: 'Demasiados intentos de login, intente en 15 minutos',
});

// Rate limit para verificación
export const verificationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // 10 verificaciones por minuto
  keyGenerator: (req) => req.user?.id || req.ip,
});

// Aplicar en Express
app.use('/api/', generalLimiter);
app.post('/api/auth/login', loginLimiter, authController.login);
app.post('/api/verify', verificationLimiter, verificationController.verify);
```

---

## 6. AUDITORÍA DE ACCESO

### Backend: Logger de auditoría:
```typescript
// src/server/services/auditLog.ts
import { AuditLog } from '../types';

class AuditLogger {
  async logAccess(
    userId: string,
    action: string,
    resource: string,
    resourceId: string,
    success: boolean,
    metadata?: Record<string, any>
  ): Promise<void> {
    const log: AuditLog = {
      id: generateId(),
      usuarioId: userId,
      accion: action,
      modulo: resource,
      registroId: resourceId,
      fecha: new Date(),
      exitoso: success,
      // Información de contexto (segura para logging)
      ip: metadata?.ip,
      userAgent: metadata?.userAgent,
    };

    // Guardar en base de datos
    await database.insertAuditLog(log);

    // Alertar si es sospechoso
    if (!success) {
      await notifySecurityTeam(log);
    }
  }
}

// Usar en endpoints
app.post('/api/verify', async (req, res) => {
  const userId = req.user?.id;

  try {
    const result = await verifyBenefit(req.body);
    
    // Registrar acceso exitoso
    await auditLogger.logAccess(
      userId,
      'VERIFY_BENEFIT',
      'verification',
      result.verificationId,
      true,
      { ip: req.ip, userAgent: req.get('user-agent') }
    );

    res.json(result);
  } catch (err) {
    // Registrar acceso fallido
    await auditLogger.logAccess(
      userId,
      'VERIFY_BENEFIT',
      'verification',
      req.body.beneficiary_id,
      false,
      { error: err.message }
    );

    res.status(400).json({ error: 'Verificación fallida' });
  }
});
```

---

## 7. PROTECCIÓN CSRF

### Backend con middleware:
```bash
npm install csurf
```

```typescript
import csrf from 'csurf';

const csrfProtection = csrf({ cookie: false, sessionKey: '_csrf' });

// GET request para obtener token CSRF
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// POST con protección CSRF
app.post('/api/verify', csrfProtection, verificationController.verify);
```

### Frontend: Usar token CSRF:
```typescript
export const useVerification = () => {
  const [csrfToken, setCsrfToken] = useState<string>('');

  useEffect(() => {
    const fetchCsrfToken = async () => {
      const response = await fetch('http://localhost:3001/api/csrf-token');
      const data = await response.json();
      setCsrfToken(data.csrfToken);
    };

    fetchCsrfToken();
  }, []);

  const verify = async (formData: any) => {
    const response = await fetch('http://localhost:3001/api/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify(formData),
    });

    return response.json();
  };

  return { verify, csrfToken };
};
```

---

## 8. TESTS DE SEGURIDAD

### Crear tests con Jest:
```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom
```

### Test de validación:
```typescript
// src/__tests__/security.test.ts
import { VerificationFormSchema } from '../schemas/verification';
import { z } from 'zod';

describe('Security - Input Validation', () => {
  test('debe rechazar DNI con menos de 8 dígitos', () => {
    expect(() => {
      VerificationFormSchema.parse({
        dni: '1234567',
        comercioId: 'com_001',
      });
    }).toThrow(z.ZodError);
  });

  test('debe rechazar DNI con caracteres no numéricos', () => {
    expect(() => {
      VerificationFormSchema.parse({
        dni: '12345AB',
        comercioId: 'com_001',
      });
    }).toThrow(z.ZodError);
  });

  test('debe aceptar DNI válido', () => {
    expect(() => {
      VerificationFormSchema.parse({
        dni: '12345678',
        comercioId: 'com_001',
      });
    }).not.toThrow();
  });
});

describe('Security - Auth', () => {
  test('no debe guardar token en localStorage', () => {
    const { login } = useAuth();
    login('admin', 'password');
    
    expect(localStorage.getItem('popper_auth')).toBeNull();
  });

  test('debe usar httpOnly cookies', async () => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'pass' }),
    });

    // Verificar que se envía cookie httpOnly
    const cookies = response.headers.get('set-cookie');
    expect(cookies).toContain('HttpOnly');
  });
});
```

---

## 9. CONFIGURACIÓN DE HEADERS SEGUROS

### Backend - Content Security Policy:
```typescript
import helmet from 'helmet';

app.use(helmet());

app.use((req, res, next) => {
  // CSP
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
  );

  // Prevenir clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevenir MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // XSS Protection (legacy)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // HSTS (solo HTTPS)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  next();
});
```

---

## 10. VARIABLES DE ENTORNO

### `.env.example` (commitear esto)
```
VITE_API_URL=http://localhost:3001
VITE_API_TIMEOUT=30000
VITE_ENVIRONMENT=development

# Backend
NODE_ENV=development
PORT=3001
JWT_SECRET=cambiar-esto-en-produccion
DATABASE_URL=postgresql://user:pass@localhost:5432/popper
ENCRYPTION_KEY=cambiar-esto-en-produccion
LOG_LEVEL=info
```

### `.env.local` (NUNCA commitar)
```
# Copiar de .env.example y llenar valores reales
```

---

## CHECKLIST DE IMPLEMENTACIÓN

- [ ] Eliminar credenciales del código
- [ ] Crear backend Node.js/Express
- [ ] Implementar autenticación con bcrypt + JWT
- [ ] Migrar a httpOnly cookies
- [ ] Implementar validación con Zod
- [ ] Encriptar datos sensibles
- [ ] Rate limiting en backend
- [ ] Auditoría de acceso
- [ ] CSRF tokens
- [ ] Headers de seguridad
- [ ] Tests automatizados (80%+)
- [ ] Validar con OWASP Top 10 checklist
- [ ] Penetration testing
- [ ] Code review de seguridad

---

**Tiempo estimado:** 4-6 semanas  
**Dificultad:** Media-Alta  
**Equipo recomendado:** 2 desarrolladores + 1 security engineer
