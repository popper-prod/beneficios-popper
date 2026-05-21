// ============================================
// GRUPO POPPER - Tipos TypeScript
// Sistema Premium de Verificación de Beneficios
// ============================================

// Tipos base del sistema
export type UserRole = 'admin' | 'supervisor' | 'employee' | 'auditor';

export type BenefitLevel = 'bronce' | 'plata' | 'oro' | 'platinum';

export type BenefitType = 'descuento' | 'acceso' | 'promocion' | 'regalo';

export type TransactionStatus = 'exitoso' | 'fallido' | 'pendiente' | 'cancelado';

export type ThemeMode = 'light' | 'dark' | 'auto';

export type Language = 'es' | 'en';

// ============================================
// Interfaces de Usuario
// ============================================
export interface User {
  id: string;
  username: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: UserRole;
  sucursalId?: string;
  activo: boolean;
  ultimoAcceso?: Date;
  fechaCreacion: Date;
  avatar?: string;
  permisos: Permission[];
}

export interface Permission {
  id: string;
  nombre: string;
  modulo: string;
  acciones: ('crear' | 'leer' | 'editar' | 'eliminar' | 'exportar')[];
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  expiresAt: Date | null;
}

// ============================================
// Interfaces de Beneficiarios
// ============================================
export interface Beneficiary {
  id: string;
  dni: string;
  cuil?: string;
  legajo?: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  nivel: BenefitLevel;
  empresa?: string;
  departamento?: string;
  fechaIngreso: Date;
  fechaVencimiento?: Date;
  foto?: string;
  activo: boolean;
  beneficiosAsignados: string[];
  direccion?: string;
  fechaNacimiento?: Date;
  contactoEmergencia?: {
    nombre: string;
    telefono: string;
    relacion: string;
  };
}

// ============================================
// Interfaces de Beneficios
// ============================================
export interface Benefit {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: BenefitType;
  nivelMinimo: BenefitLevel;
  descuento?: number;
  valorFijo?: number;
  fechaInicio: Date;
  fechaFin: Date;
  horarioInicio?: string;
  horarioFin?: string;
  diasSemana?: number[];
  limiteUsoDiario?: number;
  limiteUsoSemanal?: number;
  limiteUsoMensual?: number;
  limiteTotal?: number;
  comerciosIds: string[];
  activo: boolean;
  imagen?: string;
  terminosCondiciones?: string;
  usoActual: number;
  tags?: string[];
}

// ============================================
// Interfaces de Comercios/Sucursales
// ============================================
export interface Commerce {
  id: string;
  nombre: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  codigoPostal: string;
  telefono: string;
  email: string;
  coordenadas: {
    lat: number;
    lng: number;
  };
  horarioAtencion: {
    apertura: string;
    cierre: string;
  };
  activo: boolean;
  qrCode: string;
  responsable?: string;
  capacidadMaxima?: number;
  beneficiosDisponibles: string[];
}

// ============================================
// Interfaces de Verificación
// ============================================
export interface Verification {
  id: string;
  beneficiarioId: string;
  beneficiarioDni: string;
  beneficiarioNombre: string;
  beneficioId: string;
  beneficioNombre: string;
  comercioId: string;
  comercioNombre: string;
  usuarioVerificadorId: string;
  usuarioVerificadorNombre: string;
  estado: TransactionStatus;
  fechaVerificacion: Date;
  montoDescuento?: number;
  montoOriginal?: number;
  montoFinal?: number;
  geolocalizacion?: {
    lat: number;
    lng: number;
  };
  evidencia?: string;
  notas?: string;
  codigoReferencia: string;
  hash?: string;
}

// ============================================
// Interfaces del Dashboard
// ============================================
export interface DashboardStats {
  totalVerificaciones: number;
  verificacionesHoy: number;
  verificacionesSemana: number;
  verificacionesMes: number;
  totalBeneficiarios: number;
  beneficiariosActivos: number;
  totalBeneficios: number;
  beneficiosActivos: number;
  totalComercios: number;
  comerciosActivos: number;
  montoTotalDescuentos: number;
  promedioDiario: number;
  tasaExito: number;
  beneficiosMasUsados: TopBenefit[];
  horariosPico: HourlyStats[];
  verificacionesPorDia: DailyStats[];
  verificacionesPorSucursal: CommerceStats[];
  alertasActivas: Alert[];
}

export interface TopBenefit {
  beneficioId: string;
  beneficioNombre: string;
  totalUsos: number;
  porcentajeUso: number;
}

export interface HourlyStats {
  hora: number;
  total: number;
}

export interface DailyStats {
  fecha: string;
  total: number;
}

export interface CommerceStats {
  comercioId: string;
  comercioNombre: string;
  total: number;
  montoTotal: number;
}

export interface Alert {
  id: string;
  tipo: 'info' | 'warning' | 'error' | 'success';
  mensaje: string;
  fecha: Date;
  leida: boolean;
  accion?: string;
}

// ============================================
// Interfaces de Configuración
// ============================================
export interface SystemConfig {
  empresa: {
    nombre: string;
    nombreCorto: string;
    logo: string;
    eslogan?: string;
    colors: {
      primary: string;
      secondary: string;
      accent: string;
      success: string;
      warning: string;
      error: string;
      background: string;
      surface: string;
      text: string;
    };
  };
  sistema: {
    idioma: Language;
    tema: ThemeMode;
    timezone: string;
    moneda: string;
    formatFecha: string;
    formatHora: string;
    sesionExpiracion: number;
    maxIntentosLogin: number;
    permitirRegistro: boolean;
    modoMantenimiento: boolean;
  };
  notificaciones: {
    emailHabilitado: boolean;
    emailRemitente: string;
    whatsappHabilitado: boolean;
    pushHabilitado: boolean;
    recordatoriosVencimiento: boolean;
    diasRecordatorio: number[];
  };
  seguridad: {
    encriptacion: boolean;
    rateLimitRequests: number;
    rateLimitWindow: number;
    backupAutomatico: boolean;
    horaBackup: string;
    retencionDias: number;
  };
}

// ============================================
// Interfaces de Audit Log
// ============================================
export interface AuditLog {
  id: string;
  usuarioId: string;
  usuarioNombre: string;
  accion: string;
  modulo: string;
  registroId?: string;
  datosAnteriores?: Record<string, any>;
  datosNuevos?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  fecha: Date;
  exitoso: boolean;
}

// ============================================
// Interfaces de API
// ============================================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================
// Interfaces de Formulario
// ============================================
export interface VerificationFormData {
  dni: string;
  comercioId: string;
  beneficioId?: string;
}

export interface BeneficiaryFormData {
  dni: string;
  cuil?: string;
  legajo?: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  nivel: BenefitLevel;
  empresa?: string;
  departamento?: string;
  fechaIngreso: string;
  fechaVencimiento?: string;
}

// ============================================
// Tipos de UI
// ============================================
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface Toast {
  id: string;
  tipo: 'success' | 'error' | 'warning' | 'info';
  mensaje: string;
  duracion?: number;
}

export interface ModalState {
  isOpen: boolean;
  tipo?: string;
  datos?: any;
}

// ============================================
// Constantes
// ============================================
export const BENEFIT_LEVELS: { value: BenefitLevel; label: string; color: string; icon: string }[] = [
  { value: 'bronce', label: 'Bronce', color: '#cd7f32', icon: '🥉' },
  { value: 'plata', label: 'Plata', color: '#c0c0c0', icon: '🥈' },
  { value: 'oro', label: 'Oro', color: '#ffd700', icon: '🥇' },
  { value: 'platinum', label: 'Platinum', color: '#e5e4e2', icon: '💎' },
];

export const DAYS_OF_WEEK = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
];

export const BENEFIT_TYPES: { value: BenefitType; label: string; icon: string }[] = [
  { value: 'descuento', label: 'Descuento', icon: '🏷️' },
  { value: 'acceso', label: 'Acceso', icon: '🎫' },
  { value: 'promocion', label: 'Promoción', icon: '🎉' },
  { value: 'regalo', label: 'Regalo', icon: '🎁' },
];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  employee: 'Empleado',
  auditor: 'Auditor',
};

export const STATUS_LABELS: Record<TransactionStatus, { label: string; color: string }> = {
  exitoso: { label: 'Exitoso', color: '#10b981' },
  fallido: { label: 'Fallido', color: '#ef4444' },
  pendiente: { label: 'Pendiente', color: '#f59e0b' },
  cancelado: { label: 'Cancelado', color: '#6b7280' },
};
