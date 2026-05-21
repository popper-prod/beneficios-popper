# 📋 AUDITORÍA COMPLETA - SISTEMA BENEFICIOS QR

**Fecha de Auditoría:** 20 de Mayo, 2026  
**Estado General:** ⚠️ **CRÍTICO** - Múltiples vulnerabilidades de seguridad detectadas  
**Riesgo Recomendado:** NO PRODUCCIÓN

---

## 📊 RESUMEN EJECUTIVO

Sistema React/TypeScript para gestión de beneficios con verificación QR. Aunque la arquitectura es clara y bien estructurada, presenta **vulnerabilidades críticas de seguridad** que lo hacen inapropiado para producción sin correcciones significativas.

**Puntuación General:**
- 🔴 Seguridad: **3/10** (Crítico)
- 🟡 Código: **6/10** (Moderado)
- 🟢 Arquitectura: **7/10** (Bueno)

---

## 🔴 VULNERABILIDADES CRÍTICAS

### 1. **Almacenamiento de Credenciales Expuestas (CRÍTICO)**
**Ubicación:** `src/config/index.ts:515-520`

```typescript
// ❌ VULNERABLE
export const MOCK_CREDENTIALS: Record<string, string> = {
  'admin.popper': 'admin123',
  'supervisor.sucursal1': 'super123',
  'empleado.ana': 'empleado123',
  'auditor.jorge': 'auditor123',
};
```

**Impacto:** 
- Credenciales de todos los usuarios en código fuente (visible en control de versiones)
- Contraseñas débiles (credenciales obvias)
- Acceso no autorizado garantizado

**Recomendación:** Eliminar inmediatamente del código. Usar variables de entorno (.env).

---

### 2. **Autenticación Insegura (CRÍTICO)**
**Ubicación:** `src/hooks/useAuth.ts:60-64`

```typescript
// ❌ INSEGURO: Comparación directa de contraseñas sin hash
if (MOCK_CREDENTIALS[username] && MOCK_CREDENTIALS[username] === password) {
  const user = MOCK_USERS.find(u => u.username === username);
```

**Problemas:**
- Sin hashing de contraseñas (bcrypt, Argon2, etc.)
- Sin salt
- Sin validación de fuerza de contraseña
- Sin rate limiting real (delay simulado, no real)
- Tokens generados débilmente: `tok_${Date.now()}_${Math.random()}`

**Recomendación:** 
- Usar bcrypt mínimo (preferir Argon2)
- Rate limiting en servidor
- JWT firmados con secret fuerte
- Validación de contraseña robusta

---

### 3. **Almacenamiento de Tokens en localStorage (CRÍTICO)**
**Ubicación:** `src/hooks/useAuth.ts:76`

```typescript
// ❌ VULNERABLE: Token en localStorage accesible a XSS
localStorage.setItem(AUTH_KEY, JSON.stringify(newAuth));
```

**Impacto XSS:**
- Cualquier XSS = robo de token
- Acceso permanente a cuenta
- Datos sensibles de beneficiarios expuestos

**Información Sensible Almacenada:**
- DNI completo (`beneficiary.dni`)
- CUIL (`beneficiary.cuil`)
- Datos personales: nombre, apellido, email, teléfono, fechas nacimiento
- Información médica implícita (beneficio de farmacia)

**Recomendación:**
- Usar httpOnly cookies en servidor
- Si client-side es necesario, usar RAM + refresh tokens

---

### 4. **Sin Protección CSRF (CRÍTICO)**
**Impacto:** Ataques CSRF son posibles sin tokens CSRF
**Solución:** Implementar CSRF tokens con servidor

---

### 5. **Datos Sensibles en Formularios (ALTO)**
**Ubicación:** Verificación de beneficios procesa DNI sin encriptación

```typescript
// ❌ DNI transmitido sin protección en la verificación
const beneficiary = beneficiaries.find(b => b.dni === formData.dni);
```

**PII Expuesta:**
- DNI (identificador único)
- Nombre completo
- Teléfono
- Email
- Fecha de nacimiento
- Datos de empresa/departamento
- Información de emergencia

**Recomendación:**
- Encriptar datos sensibles en tránsito (HTTPS mínimo)
- Encriptar en reposo (localStorage)
- Mascarar DNI en UI (mostrar últimos 4 dígitos)

---

### 6. **Sin Validación de Entrada (ALTO)**
**Ubicación:** `src/hooks/useData.ts` - Múltiples funciones

```typescript
// ❌ Sin validación
const beneficiary = beneficiaries.find(b => b.dni === formData.dni);
```

**Problemas:**
- DNI no validado contra formato argentino (8 dígitos)
- Sin validación de CUIL (formato 23-XXXXXXXX-X)
- Sin validación de email
- Sin sanitización de entrada
- Posible inyección lógica en búsquedas

**Recomendación:** Usar Zod o similares para validación de schema

---

### 7. **Gestión de Permisos Insuficiente (ALTO)**
**Ubicación:** `src/hooks/useAuth.ts:100-109`

```typescript
// ❌ Insuficiente: Solo verifica a nivel módulo/acción
const hasPermission = (modulo: string, accion: string): boolean => {
  if (authState.user.rol === 'admin') return true;
  // ...
};
```

**Problemas:**
- Admin puede hacer CUALQUIER cosa (sin restricciones de contexto)
- No hay RBAC basado en recursos
- No hay granularidad por sucursal
- Employee puede ver datos de otros beneficiarios
- Sin auditoría de acceso

**Recomendación:**
- Implementar RBAC/ABAC con restricciones por recurso
- Validar sucursalId en backend
- Registrar acceso a PII

---

### 8. **Sin Auditoría de Acceso (ALTO)**
**Definición de tipo existe pero no se usa:**

```typescript
export interface AuditLog {
  id: string;
  usuarioId: string;
  // ... pero NUNCA se registra nada
}
```

**Impacto:** Sin trazabilidad de:
- Quién accedió a datos sensibles
- Quién realizó verificaciones fraudulentas
- Cambios no autorizados

**Recomendación:** Registrar cada acceso a PII y transacción

---

### 9. **Fraude Detectable Débilmente (MEDIO)**
**Ubicación:** `src/hooks/useData.ts:247-258`

```typescript
// ❌ Detección débil: Solo 30 minutos
if (minutosTranscurridos < 30) {
  return { success: false, message: 'Fraude detectado...' };
}
```

**Problemas:**
- 30 minutos es demasiado tiempo para uso del mismo beneficio
- Sin geolocalización real
- Sin detección de velocidad (distancia imposible en 30 min)
- Sin análisis de patrón de comportamiento
- Límites diarios muy permisivos (2x en farmacias)

**Recomendación:**
- Límite de 1 uso por beneficio por hora
- Validar geolocalización
- Detección de velocidad imposible
- Machine learning para fraude

---

## 🟡 VULNERABILIDADES MEDIANAS

### 10. **Exposición de Información en Error (MEDIO)**
**Ubicación:** Mensajes de error revelan estructura

```typescript
return { success: false, message: 'Beneficiario no encontrado con ese DNI' };
```

**Impacto:** Permite enumerar DNIs válidos (fuerza bruta de beneficiarios)

**Recomendación:** Mensajes genéricos: "Datos inválidos"

---

### 11. **Sin HTTPS (ASUMIDO) (MEDIO)**
El código no fuerza HTTPS. En producción, todos los datos sensibles viajarían en texto plano.

---

### 12. **Sin Protección de Rate Limiting Real (MEDIO)**
**Ubicación:** `src/config/index.ts:264`

```typescript
rateLimitRequests: 100,  // Definido pero no implementado
rateLimitWindow: 60,
```

**Impacto:** 
- 100 login attempts en 60 segundos = fácil fuerza bruta
- Sin protección DDoS

---

### 13. **Datos de Prueba en Producción (MEDIO)**
**Ubicación:** `src/config/index.ts:61-118`

```typescript
export const MOCK_USERS: User[] = [
  { id: 'usr_001', username: 'admin.popper', email: 'admin@grupopopper.com', ... }
  // Datos de ejemplo públicos en código
];
```

**Problema:** Información de ejemplo con emails reales accesible al código fuente

---

### 14. **Sin Validación de Vencimiento en Backend (MEDIO)**
Las fechas de vencimiento se validan en client, no en servidor.

```typescript
// Client-side solamente
if (beneficiary.fechaVencimiento && new Date(beneficiary.fechaVencimiento) < new Date()) {
  return { success: false, message: '...' };
}
```

---

## 🟢 VULNERABILIDADES BAJAS

### 15. **Exposición de Información Técnica (BAJO)**
Package.json expone versiones exactas de dependencias (información útil para ataques dirigidos)

### 16. **Sin Content Security Policy (CSP) (BAJO)**
Sin protección contra XSS/inyecciones

### 17. **Sin Sanitización de HTML (BAJO)**
Si se renderizara contenido dinámico, sería vulnerable a XSS

---

## 📈 PROBLEMAS DE ARQUITECTURA

### 18. **Lógica de Negocio en Cliente (CRÍTICO)**
**Toda la lógica de verificación está en frontend:**

```typescript
// src/hooks/useData.ts:169-327
const processVerification = useCallback(async (
  formData: VerificationFormData,
  // ... LÓGICA SENSIBLE EN CLIENTE
) => {
  const beneficiary = beneficiaries.find(...);
  // ... 160 líneas de lógica que puede ser bypass
});
```

**Impactos:**
- User puede abrir DevTools y modificar beneficiarios
- `processVerification` puede ser reemplazada
- Verificaciones fraudulentas son triviales
- Límites de uso se ignoran fácilmente

**Recomendación:** MOVER TODO A BACKEND
- Backend debe validar TODAS las reglas
- Cliente solo formatea UI

---

### 19. **Gestión de Estado Global Inadecuada (MEDIO)**
Sin Redux/Context para estado de verificación. useData es un "god hook" (>500 líneas).

---

### 20. **Sin Patrón de Separación Seguridad (MEDIO)**
- Routes no están protegidas
- Admin Panel accesible sin verificar permisos
- Sin guards de ruta

---

## 💻 PROBLEMAS DE CÓDIGO

### 21. **Código Duplicado (BAJO)**
- Lógica de verificación de nivel duplicada en 2 lugares
  - `useData.ts:205-212`
  - `useData.ts:337-346`

**Recomendación:** Extraer a función `getBenefitsForLevel`

---

### 22. **TypeScript Warnings (BAJO)**
```typescript
// useAuth.ts:107 - Tipo cast inseguro
p.acciones.includes(accion as any)
```

---

### 23. **Validación de Hora Incompleta (BAJO)**
```typescript
// useData.ts:263-264
const horaActual = `${hoy.getHours().toString().padStart(2, '0')}...`;
// Sin validación de segundos/zona horaria
```

---

## 📚 DEPENDENCIAS

**Análisis:**
- React 19.2.6 ✅ (Actualizado)
- TypeScript 5.9.3 ✅ (Actualizado)
- Vite 7.3.2 ✅ (Moderno)
- Tailwind 4.1.17 ✅ (Moderno)

**Faltantes Críticos:**
- ❌ Validación (Zod/Yup)
- ❌ Hashing (bcrypt)
- ❌ JWT (jsonwebtoken)
- ❌ CORS
- ❌ Sanitización (DOMPurify)
- ❌ Rate limiting (express-rate-limit)

---

## 🎯 ANÁLISIS DE CALIDAD DE CÓDIGO

### Puntos Positivos:
✅ Estructura clara de componentes  
✅ TypeScript bien configurado (`strict: true`)  
✅ Tipos bien definidos (excelentes interfaces)  
✅ Componentes UI reutilizables  
✅ Validación de permisos implementada  
✅ Buena separación de concerns (excepto lógica de negocio)  

### Puntos Negativos:
❌ Lógica de negocio en cliente  
❌ SRP violado en useData (>500 líneas)  
❌ Sin manejo de errores exhaustivo  
❌ Sin tests (0% cobertura)  
❌ Sin logging (critical para auditoría)  
❌ Sin versionado de API  

---

## 🔐 CONFORMIDAD REGULATORIA

### Ley de Protección de Datos Personales (Argentina)
**Estatus:** ❌ NO CONFORME

**Violaciones:**
- Art. 5: Datos sin protección adecuada
- Art. 6: Sin consentimiento implícito para almacenamiento
- Art. 7: Sin derecho a acceso controlado
- Art. 12: Sin borrado seguro de datos
- Art. 15: Sin encriptación de datos sensibles

### GDPR/Protección de PII
**Estatus:** ❌ NO CONFORME

Almacenar DNI sin encriptación viola GDPR artículo 5(1)(f)

---

## 📋 PLAN DE REMEDIACIÓN

### FASE 1: Crítico (INMEDIATO - Semana 1)
1. Eliminar credenciales del código fuente
2. Mover autenticación a backend
3. Implementar hashing bcrypt
4. Migrar tokens a httpOnly cookies
5. Agregar validación de entrada con Zod

### FASE 2: Alto (Semana 2-3)
6. Implementar backend de verificación
7. Agregar auditoría de acceso
8. Encriptar datos sensibles en tránsito
9. Rate limiting real
10. CSRF protection con tokens

### FASE 3: Medio (Semana 4-5)
11. Tests automatizados (Jest)
12. Logging centralizado
13. RBAC/ABAC más granular
14. Detección avanzada de fraude
15. CSP headers

### FASE 4: Optimización (Semana 6+)
16. Manejo de errores exhaustivo
17. Documentación de seguridad
18. Penetration testing
19. Cumplimiento legal certificado

---

## 🧪 TESTING RECOMENDADO

**Actualmente:** 0 tests

**Recomendado:**
- 80%+ cobertura de lógica de verificación
- Tests de permisos (usuario no puede acceder a otra sucursal)
- Tests de rate limiting
- Tests de validación de entrada
- OWASP Top 10 security tests

---

## 🚀 MEJORAS DE RENDIMIENTO

**Estado Actual:** Bueno (React 19, Vite, SPA)

**Recomendaciones:**
- Lazy load de componentes admin (no usado en verificación)
- Caché de beneficios (rara vez cambian)
- Compresión de datos en localStorage
- Workers para cálculos pesados

---

## 📊 TABLA RESUMEN

| Aspecto | Calificación | Crítico | Acción |
|---------|-------------|---------|--------|
| Seguridad Autenticación | 2/10 | ✅ | Rehacer completamente |
| Encriptación de Datos | 1/10 | ✅ | Agregar AES-256 |
| Validación de Entrada | 3/10 | ✅ | Implementar Zod |
| Control de Acceso | 5/10 | ⚠️ | Refinar permisos |
| Auditoría/Logging | 0/10 | ✅ | Crear sistema |
| CSRF Protection | 0/10 | ✅ | Implementar |
| Rate Limiting | 1/10 | ✅ | Backend real |
| Detección Fraude | 3/10 | ⚠️ | Mejorar lógica |
| Arquitectura | 6/10 | ⚠️ | Mover lógica a backend |
| Tests | 0/10 | ⚠️ | 80%+ cobertura |

---

## ✅ CONCLUSIÓN

**Este sistema NO es apto para producción en su estado actual.**

Aunque la interfaz de usuario es polida y la arquitectura React es sólida, las vulnerabilidades de seguridad son **inaceptables** para un sistema que maneja datos personales sensibles (DNI, información de empleados, transacciones de beneficios).

**Recomendación:** 
- ✅ Excelente prototipo para demo
- ❌ Requiere reingeniería completa para producción
- ⏱️ Estimado: 4-6 semanas de trabajo de seguridad

**Siguiente paso:** Implementar el plan de remediación Fase 1 antes de cualquier exposición a datos reales.

---

*Auditoría completada: 20/05/2026*  
*Auditor: Claude Code Security Review*
