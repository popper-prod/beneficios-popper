# BENEFICIOS QR — Contexto para Claude Code

Producto de **Recluta** — plataforma de gestión de beneficios para empleados, deployada para clientes.
El cliente activo en este repositorio es **Grupo Popper** (Tierra del Fuego, Argentina).
Los empleados del cliente escanean un QR en el punto de venta, ingresan su DNI y canjean beneficios.

---

## Stack

| Capa | Tecnología | URL |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite (SPA single-file) | https://beneficios.recluta.com.ar |
| Backend | Express 5 + TypeScript + Node 20 | https://beneficios-backend-jfpx.onrender.com |
| DB | PostgreSQL (Render managed) | — |
| Deploy frontend | Vercel (`npx vercel --prod`) | alias: beneficios-qr.vercel.app |
| Deploy backend | Render (auto-deploy desde GitHub push a `main`) | — |
| Repositorio | https://github.com/popper-prod/beneficios-popper.git | — |

---

## Estructura del proyecto

```
BENEFICIOS QR/
├── src/                        # Frontend React
│   ├── pages/
│   │   ├── AdminDashboard.tsx  # Panel admin completo (tab-based, ~2500 líneas)
│   │   └── QRPage.tsx          # Terminal punto de venta (consumer-facing, ~2000 líneas)
│   └── ...
├── backend/
│   └── src/
│       ├── index.ts            # Express app, CORS, health endpoint, keep-alive
│       ├── routes/
│       │   ├── public.ts       # Endpoints sin auth (QR flow)
│       │   ├── admin.ts        # Endpoints con JWT auth (panel admin)
│       │   ├── auth.ts         # Login Naaloo + local + Google OAuth
│       │   └── verificacion.ts # Endpoints de verificación adicionales
│       ├── middleware/
│       │   ├── auth.ts         # verifyToken + generateToken (JWT HS512, 8h)
│       │   ├── rateLimit.ts    # Rate limiters por endpoint
│       │   └── validation.ts   # Zod middleware
│       ├── services/
│       │   └── naaloo.ts       # Integración API Naaloo (RRHH)
│       └── db.ts               # Pool PostgreSQL, helper query()
├── tests/
│   └── public.test.ts          # 17 tests de integración (Jest + supertest)
└── .github/workflows/
    ├── ci.yml                  # Tests automáticos en cada push
    └── monitor.yml             # Health check cada 15min → abre issue si cae
```

---

## Flujo principal (QRPage)

1. Punto de venta tiene tablet con URL `https://beneficios.recluta.com.ar#/qr/{QR_CODE}`
2. Colaborador o familiar escanea QR → pantalla pide DNI
3. GET `/api/public/beneficiario/:comercioId/:dni` → valida identidad + devuelve beneficios disponibles
4. Colaborador selecciona beneficio (+ monto si aplica + invitados si es Talento)
5. Pasa el teléfono al cajero (modo cajero)
6. Cajero confirma → POST `/api/public/canjear`
7. Pantalla de éxito con código de verificación

---

## Modelo de datos clave

### Beneficiarios
- `activo`, `es_talento_popper`, `es_admin`, `rol_admin`, `jerarquia_id`
- `nivel`, `departamento`, `sector`, `fecha_ingreso`
- Fuente: sync desde Naaloo vía POST `/api/admin/sync-naaloo`

### Beneficios
- `tipo`: `'descuento' | 'gratuito' | 'acceso'`
- `aplica_a`: `'empleado' | 'familiar' | 'ambos' | 'talento'`
- `escala_descuentos`: JSONB — tiers por antigüedad, titular/familiar, talento override
- `max_invitados`, `cubre_invitados`: para beneficios Talento
- `fecha_inicio`, `fecha_fin`, `horario_inicio`, `horario_fin`: vigencia y horario
- `usa_limite_jerarquia`: si consume del presupuesto mensual de la jerarquía
- `limite_uso_diario`, `limite_uso_mensual`, `limite_total`

### Verificaciones
- Registra cada canje: `beneficiario_id`, `beneficio_id`, `comercio_id`
- `monto_original`, `monto_descuento`, `monto_final` (valores reales aplicados)
- `invitados_count`, `retirado_por_dni`, `retirado_por_nombre`
- `codigo_referencia`: formato `QR-{timestamp}-{random}`

### Jerarquías
- Define `limite_mensual` y `limite_mensual_talento` en pesos
- Beneficios con `usa_limite_jerarquia=true` consumen de este presupuesto
- Override posible con PIN del responsable del comercio

### Familiares
- Vinculados a un beneficiario titular
- `relacion`: normalizada desde Naaloo
- Menores de edad requieren `retirado_por_dni` de un adulto autorizado

---

## Endpoints públicos (sin auth)

```
GET  /api/public/comercio/:qrCode              → Info del comercio
GET  /api/public/beneficiario/:comercioId/:dni → Identidad + beneficios disponibles
POST /api/public/canjear                        → Registrar canje
GET  /api/public/historial/:dni                 → Últimos 50 canjes
POST /api/public/verificar-pin                  → Validar PIN del responsable
GET  /api/public/verify-pass/:dni/:beneficioId  → Verificar acceso puntual
GET  /api/public/tv/:qrCode                     → Vitrina TV comercio (catálogo, sin datos personales)
GET  /api/public/tv                             → Cartelera TV general (oficinas)
```

**Modo vitrina (plasmas):** frontend `#/tv/{QR_CODE}` (comercio: QR gigante + carrusel)
y `#/tv` (cartelera general). Auto-refresh 5 min, rotación 9s, sin interacción.

**Rate limits:** 20 req/min en `/canjear`, 60 en `/beneficiario`, 120 global.

---

## Endpoints admin (requieren JWT)

```
GET/POST/PUT/DELETE /api/admin/beneficios
GET/POST/PUT/DELETE /api/admin/comercios
GET/POST/PUT/DELETE /api/admin/beneficiarios
POST/DELETE         /api/admin/comercio-beneficios   ← vincular beneficio ↔ comercio
GET                 /api/admin/comercio-beneficios/:id
GET                 /api/admin/dashboard
GET                 /api/admin/verificaciones         (paginado)
GET                 /api/admin/alertas                ← sistema de alertas
POST                /api/admin/sync-naaloo            ← sync batch desde Naaloo
POST                /api/admin/autorizar              ← activar/desactivar beneficiario
POST                /api/admin/autorizar-bulk
POST                /api/admin/autorizar-grupo        ← por área o sector
GET                 /api/admin/autorizacion-logs
GET/POST            /api/admin/admins                 ← gestión de permisos
GET                 /api/admin/exportar-verificaciones (CSV, LIMIT 10000)
```

---

## Autenticación admin

Tres flujos (todos devuelven JWT):
1. **Naaloo**: email + password → valida en Naaloo API → verifica `es_admin=true` en DB local
2. **Local**: `admin.popper` (usuarios tabla) → bcrypt
3. **Google OAuth**: ID token → verifica con Google → `es_admin=true` en DB

Token: JWT HS512, 8h de expiración. Header: `Authorization: Bearer {token}`.

---

## Migraciones

**No hay migration runner.** Todo usa `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` en funciones lazy que se ejecutan antes del primer uso del endpoint correspondiente:
- `ensureBeneficiosV2()` — campos V2+V4 en beneficios
- `ensureLogoColumn()` — logo + pin_responsable en comercios
- `migrar-autorizaciones` — columnas de baja + autorizacion_logs
- `migrar-permisos` — es_admin + rol_admin en beneficiarios

---

## `calcularDescuentoAplicable` (public.ts)

Función crítica que determina el % aplicable dado un beneficiario:

```
escala_descuentos.titular/familiar → tiers explícitos (skipass)
escala_descuentos.talento_porcentaje → override si esTalento
escala_descuentos.tiers[] → por antiguedad_min_meses
beneficio.tipo === 'gratuito' → { porcentaje: 100, tipo: 'gratuito' }
beneficio.descuento → fallback directo
```

---

## Reglas de negocio importantes

- Beneficios `aplica_a='talento'`: solo visibles/canjeables por `es_talento_popper=true`
- Beneficios `aplica_a='familiar'`: no disponibles para titulares, y viceversa
- `fecha_fin`/`fecha_inicio`/horario: filtrados en GET `/beneficiario` (no solo en canjear)
- Canjear valida que `beneficio_id` esté en `comercio_beneficios` para ese `comercio_id`
- Soft delete en beneficios/comercios/beneficiarios si tienen verificaciones históricas
- Baja de titular → cascade automático en familiares
- DELETE `/beneficiarios` también limpia familiares en hard delete

---

## Tests

```bash
cd backend
npm test              # 17 tests, ~3s
npm run test:watch    # modo watch
```

Tests en `backend/tests/public.test.ts`. Mocks en `backend/src/__mocks__/`.
No tocan DB real — todo mockeado con `jest.fn()`.

---

## Comandos útiles

```bash
# Deploy frontend
npx vercel --prod

# Dev local
cd backend && npm run dev      # backend en :3001
npm run dev                    # frontend en :5173

# Tests
cd backend && npm test

# Verificar TypeScript
npx tsc --noEmit               # frontend
cd backend && npx tsc --noEmit # backend
```

---

## Decisiones de diseño tomadas

- **Sin migration runner**: lazy migrations con `IF NOT EXISTS` — más simple para equipo pequeño
- **Sin tier visual**: `nivel_minimo` se guarda en DB pero no filtra ni muestra (se quitó en sesión de mayo 2026)
- **Dedup en frontend**: QRPage deduplica beneficios por `nombre|descuento|valor_fijo` como defensa extra
- **Historial usa montos reales**: `v.monto_descuento` del registro, no `ben.descuento` actual
- **CORS restringido**: solo `beneficios-qr.vercel.app`, `beneficios.recluta.com.ar`, localhost
- **Register deshabilitado en prod**: POST `/auth/register` devuelve 403 en `NODE_ENV=production`
- **Keep-alive interno**: el propio backend se pinga cada 14min para evitar que Render duerma el proceso

---

## Contexto organizacional

- **Producto**: desarrollado por **Recluta** para clientes corporativos
- **Cliente activo**: Grupo Popper, Ushuaia + Río Grande, Tierra del Fuego
- **Beneficiarios**: colaboradores del cliente y sus familiares
- **Talento Popper**: categoría especial de empleados con beneficios adicionales (invitados, etc.)
- **Puntos de venta**: comercios locales con los que el cliente tiene convenio (farmacias, gimnasios, etc.)
- **RRHH del cliente**: sistema Naaloo — fuente de verdad para empleados activos
- **Catálogo 2026**: hardcodeado en `admin.ts` como `CATALOGO_2026[]`, importable desde el panel

> **Roadmap**: Recluta también tiene un ATS y un LMS funcionando como productos separados.
> La visión es eventualmente unificarlos bajo una sola empresa/plataforma, pero por ahora
> cada producto sigue siendo un deploy independiente por cliente. No hay integración entre ellos aún.
