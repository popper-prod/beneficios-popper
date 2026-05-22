-- ============================================
-- MIGRACION: Modulo de Autorizaciones
-- ============================================

-- Nuevas columnas en beneficiarios
ALTER TABLE beneficiarios ADD COLUMN IF NOT EXISTS naaloo_id INT;
ALTER TABLE beneficiarios ADD COLUMN IF NOT EXISTS motivo_baja VARCHAR(200);
ALTER TABLE beneficiarios ADD COLUMN IF NOT EXISTS fecha_baja TIMESTAMP;
ALTER TABLE beneficiarios ADD COLUMN IF NOT EXISTS autorizado_por VARCHAR(100);
ALTER TABLE beneficiarios ADD COLUMN IF NOT EXISTS ultima_sync TIMESTAMP;
ALTER TABLE beneficiarios ADD COLUMN IF NOT EXISTS origen VARCHAR(20) DEFAULT 'manual';

-- Indice para naaloo_id
CREATE INDEX IF NOT EXISTS idx_beneficiarios_naaloo_id ON beneficiarios(naaloo_id);
CREATE INDEX IF NOT EXISTS idx_beneficiarios_origen ON beneficiarios(origen);

-- Tabla de log de cambios de estado
CREATE TABLE IF NOT EXISTS autorizacion_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiario_id UUID NOT NULL REFERENCES beneficiarios(id),
  accion VARCHAR(20) NOT NULL CHECK (accion IN ('activar', 'desactivar', 'sync_alta', 'sync_baja')),
  motivo VARCHAR(200),
  autorizado_por VARCHAR(100),
  fecha TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autorizacion_logs_beneficiario ON autorizacion_logs(beneficiario_id);
CREATE INDEX IF NOT EXISTS idx_autorizacion_logs_fecha ON autorizacion_logs(fecha);

SELECT 'Migracion de autorizaciones completada' AS status;
