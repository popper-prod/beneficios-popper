-- ============================================
-- GRUPO POPPER - Inicializar en Supabase
-- ============================================

-- Tabla de Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100),
  password_hash VARCHAR(255) NOT NULL,
  nombre VARCHAR(100),
  apellido VARCHAR(100),
  rol VARCHAR(50) NOT NULL CHECK (rol IN ('admin', 'supervisor', 'empleado', 'auditor')),
  sucursal_id UUID,
  activo BOOLEAN DEFAULT TRUE,
  ultimo_acceso TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de Beneficiarios
CREATE TABLE IF NOT EXISTS beneficiarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dni VARCHAR(8) UNIQUE NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  telefono VARCHAR(20),
  nivel VARCHAR(20) NOT NULL CHECK (nivel IN ('bronce', 'plata', 'oro', 'platinum')),
  departamento VARCHAR(100),
  empresa VARCHAR(100),
  legajo VARCHAR(20),
  fecha_ingreso DATE,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de Beneficios
CREATE TABLE IF NOT EXISTS beneficios (
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

-- Tabla de Comercios
CREATE TABLE IF NOT EXISTS comercios (
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

-- Tabla de Verificaciones
CREATE TABLE IF NOT EXISTS verificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiario_id UUID NOT NULL REFERENCES beneficiarios(id),
  beneficiario_dni VARCHAR(8),
  beneficiario_nombre VARCHAR(100),
  beneficio_id UUID NOT NULL REFERENCES beneficios(id),
  beneficio_nombre VARCHAR(100),
  comercio_id UUID NOT NULL REFERENCES comercios(id),
  comercio_nombre VARCHAR(100),
  usuario_verificador_id UUID REFERENCES usuarios(id),
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
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de Relacion Comercio-Beneficio
CREATE TABLE IF NOT EXISTS comercio_beneficios (
  comercio_id UUID NOT NULL REFERENCES comercios(id) ON DELETE CASCADE,
  beneficio_id UUID NOT NULL REFERENCES beneficios(id) ON DELETE CASCADE,
  PRIMARY KEY (comercio_id, beneficio_id)
);

-- Tabla de Audit Log
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id),
  usuario_nombre VARCHAR(100),
  accion VARCHAR(100),
  modulo VARCHAR(50),
  registro_id UUID,
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  ip VARCHAR(45),
  user_agent TEXT,
  fecha TIMESTAMP NOT NULL DEFAULT NOW(),
  exitoso BOOLEAN DEFAULT TRUE
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_beneficiarios_dni ON beneficiarios(dni);
CREATE INDEX IF NOT EXISTS idx_beneficiarios_nivel ON beneficiarios(nivel);
CREATE INDEX IF NOT EXISTS idx_verificaciones_beneficiario ON verificaciones(beneficiario_id);
CREATE INDEX IF NOT EXISTS idx_verificaciones_estado ON verificaciones(estado);
CREATE INDEX IF NOT EXISTS idx_verificaciones_fecha ON verificaciones(fecha_verificacion);
CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username);

-- ============================================
-- DATOS DE EJEMPLO
-- ============================================

-- Usuarios (admin y empleada)
-- admin.popper / Admin2024!
-- sandra.perez / Sandra2024!
INSERT INTO usuarios (username, email, password_hash, nombre, apellido, rol, activo)
VALUES
  ('admin.popper', 'admin@grupopopper.com', '$2b$12$dFGNo7O91slhEWzHphPQj.CKbNLAuQJsj3zc5HXAI3mFGAg4Oc3qC', 'Carlos', 'Popper', 'admin', true),
  ('sandra.perez', 'sandra@farmaciapopper.com', '$2b$12$bwSMxM4tW8xQ34YvMEj15usXBz5Ce0qeQ7SM3cWRMwqZ.I80McD9W', 'Sandra', 'Perez', 'empleado', true)
ON CONFLICT (username) DO NOTHING;

-- Beneficiarios (empleados que reciben beneficios)
INSERT INTO beneficiarios (dni, nombre, apellido, email, telefono, nivel, departamento, empresa, legajo, fecha_ingreso, activo)
VALUES
  ('12345678', 'Juan', 'Martinez', 'juan@grupopopper.com', '+54 11 1234-5678', 'oro', 'Ventas', 'Grupo Popper', 'LEG-001', '2020-03-15', true),
  ('23456789', 'Maria', 'Gonzalez', 'maria@grupopopper.com', '+54 11 2345-6789', 'platinum', 'RRHH', 'Grupo Popper', 'LEG-002', '2018-07-01', true),
  ('34567890', 'Pedro', 'Lopez', 'pedro@grupopopper.com', '+54 11 3456-7890', 'plata', 'IT', 'Grupo Popper', 'LEG-003', '2022-01-10', true),
  ('45678901', 'Ana', 'Rodriguez', 'ana@grupopopper.com', '+54 11 4567-8901', 'bronce', 'Administracion', 'Grupo Popper', 'LEG-004', '2024-06-01', true),
  ('56789012', 'Lucas', 'Fernandez', 'lucas@grupopopper.com', '+54 11 5678-9012', 'oro', 'Logistica', 'Grupo Popper', 'LEG-005', '2021-02-20', true)
ON CONFLICT (dni) DO NOTHING;

-- Comercios
INSERT INTO comercios (nombre, direccion, ciudad, provincia, codigo_postal, telefono, email, lat, lng, horario_apertura, horario_cierre, activo, qr_code, responsable)
VALUES
  ('Farmacia Popper - Centro', 'Av. Libertador 5000', 'Buenos Aires', 'Buenos Aires', 'C1425', '+54 11 4567-1000', 'centro@farmaciapopper.com.ar', -34.5748, -58.4216, '08:00', '22:00', true, 'QR-FARMA-CENTRO-001', 'Sandra Perez'),
  ('Farmacia Popper - Norte', 'Av. del Libertador 9500', 'Buenos Aires', 'Buenos Aires', 'C1429', '+54 11 4567-2000', 'norte@farmaciapopper.com.ar', -34.5267, -58.4534, '09:00', '21:00', true, 'QR-FARMA-NORTE-002', 'Martin Garcia'),
  ('Gimnasio FitPopper', 'Av. Santa Fe 3200', 'Buenos Aires', 'Buenos Aires', 'C1123', '+54 11 4567-4000', 'principal@fitpopper.com.ar', -34.5874, -58.3890, '06:00', '23:00', true, 'QR-GYM-PRINCIPAL-001', 'Carlos Ruiz'),
  ('Restaurante Popper Gourmet', 'Av. Callao 890', 'Buenos Aires', 'Buenos Aires', 'C1022', '+54 11 4567-5000', 'reservas@poppergourmet.com.ar', -34.6033, -58.3897, '12:00', '00:00', true, 'QR-REST-GOURMET-001', 'Chef Maria Lopez'),
  ('Estacionamiento Popper Mall', 'Av. Cabildo 2500', 'Buenos Aires', 'Buenos Aires', 'C1425', '+54 11 4567-7000', 'estacionamiento@poppermall.com.ar', -34.5560, -58.4520, '00:00', '23:59', true, 'QR-PARK-MALL-001', 'Roberto Vega')
ON CONFLICT DO NOTHING;

-- Beneficios
INSERT INTO beneficios (nombre, descripcion, tipo, nivel_minimo, descuento, fecha_inicio, fecha_fin, horario_inicio, horario_fin, limite_uso_diario, limite_uso_mensual, activo, uso_actual)
VALUES
  ('Descuento 15% Farmacias', '15% de descuento en medicamentos y productos de farmacia', 'descuento', 'bronce', 15.00, '2024-01-01', '2027-12-31', '08:00', '22:00', 2, 10, true, 0),
  ('Acceso Gimnasio VIP', 'Acceso ilimitado a todas las instalaciones del gimnasio', 'acceso', 'plata', NULL, '2024-01-01', '2027-12-31', '06:00', '23:00', 1, 30, true, 0),
  ('2x1 Restaurantes', '2x1 en cenas en restaurantes del grupo (niveles Oro y Platinum)', 'promocion', 'oro', NULL, '2024-01-01', '2027-12-31', '19:00', '23:30', 1, 4, true, 0),
  ('Estacionamiento Premium', 'Estacionamiento gratuito en centros comerciales Popper', 'acceso', 'oro', NULL, '2024-01-01', '2027-12-31', '00:00', '23:59', 1, 30, true, 0),
  ('Pack Bienvenida', 'Kit de bienvenida para nuevos empleados', 'regalo', 'bronce', NULL, '2024-01-01', '2027-12-31', '08:00', '17:00', 1, 1, true, 0)
ON CONFLICT DO NOTHING;

-- Relacion Comercio-Beneficio
INSERT INTO comercio_beneficios (comercio_id, beneficio_id)
SELECT c.id, b.id FROM comercios c, beneficios b
WHERE (c.nombre LIKE '%Farmacia%' AND b.nombre LIKE '%Farmacias%')
   OR (c.nombre LIKE '%Gimnasio%' AND b.nombre LIKE '%Gimnasio%')
   OR (c.nombre LIKE '%Restaurante%' AND b.nombre LIKE '%Restaurante%')
   OR (c.nombre LIKE '%Estacionamiento%' AND b.nombre LIKE '%Estacionamiento%')
   OR (c.nombre LIKE '%Farmacia%' AND b.nombre LIKE '%Bienvenida%')
ON CONFLICT DO NOTHING;

SELECT 'Base de datos inicializada correctamente' AS status;
