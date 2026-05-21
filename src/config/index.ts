// ============================================
// GRUPO POPPER - Configuración del Sistema
// ============================================

import { SystemConfig, Benefit, Commerce, User, Beneficiary, Verification } from '../types';

// ============================================
// Configuración por defecto del sistema
// ============================================
export const DEFAULT_CONFIG: SystemConfig = {
  empresa: {
    nombre: 'GRUPO POPPER',
    nombreCorto: 'POPPER',
    logo: '',
    eslogan: 'Innovación y Excelencia Corporativa',
    colors: {
      primary: '#1e3a5f',
      secondary: '#2d5a87',
      accent: '#ffd700',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      background: '#f8fafc',
      surface: '#ffffff',
      text: '#1e293b',
    },
  },
  sistema: {
    idioma: 'es',
    tema: 'auto',
    timezone: 'America/Argentina/Buenos_Aires',
    moneda: 'ARS',
    formatFecha: 'dd/MM/yyyy',
    formatHora: 'HH:mm',
    sesionExpiracion: 8,
    maxIntentosLogin: 5,
    permitirRegistro: false,
    modoMantenimiento: false,
  },
  notificaciones: {
    emailHabilitado: true,
    emailRemitente: 'notificaciones@grupopopper.com',
    whatsappHabilitado: false,
    pushHabilitado: false,
    recordatoriosVencimiento: true,
    diasRecordatorio: [30, 15, 7, 1],
  },
  seguridad: {
    encriptacion: true,
    rateLimitRequests: 100,
    rateLimitWindow: 60,
    backupAutomatico: true,
    horaBackup: '02:00',
    retencionDias: 90,
  },
};

// ============================================
// Usuarios de prueba del sistema
// ============================================
export const MOCK_USERS: User[] = [
  {
    id: 'usr_001',
    username: 'admin.popper',
    email: 'admin@grupopopper.com',
    nombre: 'Carlos',
    apellido: 'Popper',
    rol: 'admin',
    activo: true,
    fechaCreacion: new Date('2024-01-01'),
    permisos: [
      { id: 'perm_1', nombre: 'Acceso Total', modulo: 'sistema', acciones: ['crear', 'leer', 'editar', 'eliminar', 'exportar'] },
    ],
  },
  {
    id: 'usr_002',
    username: 'supervisor.sucursal1',
    email: 'supervisor1@grupopopper.com',
    nombre: 'María',
    apellido: 'González',
    rol: 'supervisor',
    sucursalId: 'com_001',
    activo: true,
    fechaCreacion: new Date('2024-01-15'),
    permisos: [
      { id: 'perm_2', nombre: 'Supervisión', modulo: 'verificaciones', acciones: ['leer', 'exportar'] },
      { id: 'perm_3', nombre: 'Gestión Empleados', modulo: 'beneficiarios', acciones: ['crear', 'leer', 'editar'] },
    ],
  },
  {
    id: 'usr_003',
    username: 'empleado.ana',
    email: 'ana.martinez@grupopopper.com',
    nombre: 'Ana',
    apellido: 'Martínez',
    rol: 'employee',
    sucursalId: 'com_001',
    activo: true,
    fechaCreacion: new Date('2024-02-01'),
    permisos: [
      { id: 'perm_4', nombre: 'Verificación', modulo: 'verificacion', acciones: ['crear', 'leer'] },
    ],
  },
  {
    id: 'usr_004',
    username: 'auditor.jorge',
    email: 'jorge.lopez@grupopopper.com',
    nombre: 'Jorge',
    apellido: 'López',
    rol: 'auditor',
    activo: true,
    fechaCreacion: new Date('2024-02-15'),
    permisos: [
      { id: 'perm_5', nombre: 'Auditoría', modulo: 'audit_log', acciones: ['leer', 'exportar'] },
      { id: 'perm_6', nombre: 'Reportes', modulo: 'reportes', acciones: ['leer', 'exportar'] },
    ],
  },
];

// ============================================
// Beneficiarios de prueba
// ============================================
export const MOCK_BENEFICIARIES: Beneficiary[] = [
  {
    id: 'ben_001',
    dni: '30123456',
    cuil: '20-30123456-9',
    legajo: 'LEG-001',
    nombre: 'Roberto',
    apellido: 'Fernández',
    email: 'roberto.fernandez@empresa.com',
    telefono: '+54 11 5555-1234',
    nivel: 'platinum',
    empresa: 'Popper S.A.',
    departamento: 'Tecnología',
    fechaIngreso: new Date('2020-03-15'),
    activo: true,
    beneficiosAsignados: ['ben_prest_001', 'ben_prest_002', 'ben_prest_003'],
    direccion: 'Av. Corrientes 1234, Buenos Aires',
    fechaNacimiento: new Date('1985-06-20'),
  },
  {
    id: 'ben_002',
    dni: '32789012',
    legajo: 'LEG-002',
    nombre: 'Laura',
    apellido: 'Rodríguez',
    email: 'laura.rodriguez@empresa.com',
    telefono: '+54 11 5555-5678',
    nivel: 'oro',
    empresa: 'Popper S.A.',
    departamento: 'Recursos Humanos',
    fechaIngreso: new Date('2021-07-10'),
    activo: true,
    beneficiosAsignados: ['ben_prest_001', 'ben_prest_002'],
    fechaNacimiento: new Date('1990-09-12'),
  },
  {
    id: 'ben_003',
    dni: '34567890',
    cuil: '23-34567890-5',
    legajo: 'LEG-003',
    nombre: 'Martín',
    apellido: 'Sánchez',
    email: 'martin.sanchez@empresa.com',
    telefono: '+54 11 5555-9012',
    nivel: 'plata',
    empresa: 'Popper S.A.',
    departamento: 'Ventas',
    fechaIngreso: new Date('2022-01-20'),
    activo: true,
    beneficiosAsignados: ['ben_prest_001'],
    fechaNacimiento: new Date('1992-12-05'),
  },
  {
    id: 'ben_004',
    dni: '28901234',
    nombre: 'Patricia',
    apellido: 'Torres',
    email: 'patricia.torres@empresa.com',
    telefono: '+54 11 5555-3456',
    nivel: 'bronce',
    empresa: 'Popper S.A.',
    departamento: 'Administración',
    fechaIngreso: new Date('2023-05-08'),
    activo: true,
    beneficiosAsignados: ['ben_prest_001'],
    fechaNacimiento: new Date('1988-04-18'),
  },
  {
    id: 'ben_005',
    dni: '35678901',
    cuil: '23-35678901-3',
    legajo: 'LEG-004',
    nombre: 'Diego',
    apellido: 'Morales',
    email: 'diego.morales@empresa.com',
    telefono: '+54 11 5555-7890',
    nivel: 'oro',
    empresa: 'Popper S.A.',
    departamento: 'Logística',
    fechaIngreso: new Date('2022-09-12'),
    activo: true,
    beneficiosAsignados: ['ben_prest_001', 'ben_prest_002', 'ben_prest_003'],
    fechaNacimiento: new Date('1991-07-25'),
  },
];

// ============================================
// Beneficios/catálogo de prueba
// ============================================
export const MOCK_BENEFITS: Benefit[] = [
  {
    id: 'ben_prest_001',
    nombre: 'Descuento en Farmacias Popper',
    descripcion: '15% de descuento en medicamentos y productos de farmacia',
    tipo: 'descuento',
    nivelMinimo: 'bronce',
    descuento: 15,
    fechaInicio: new Date('2024-01-01'),
    fechaFin: new Date('2025-12-31'),
    horarioInicio: '08:00',
    horarioFin: '22:00',
    diasSemana: [1, 2, 3, 4, 5, 6, 0],
    limiteUsoDiario: 2,
    limiteUsoMensual: 10,
    comerciosIds: ['com_001', 'com_002', 'com_003'],
    activo: true,
    usoActual: 1250,
    tags: ['farmacia', 'salud', 'descuento'],
  },
  {
    id: 'ben_prest_002',
    nombre: 'Acceso VIP a Gimnasio FitPopper',
    descripcion: 'Acceso ilimitado a todas las instalaciones del gimnasio',
    tipo: 'acceso',
    nivelMinimo: 'plata',
    fechaInicio: new Date('2024-01-01'),
    fechaFin: new Date('2025-12-31'),
    horarioInicio: '06:00',
    horarioFin: '23:00',
    diasSemana: [1, 2, 3, 4, 5, 6],
    limiteUsoDiario: 1,
    limiteUsoMensual: 30,
    comerciosIds: ['com_004'],
    activo: true,
    usoActual: 890,
    tags: ['gimnasio', 'fitness', 'salud'],
  },
  {
    id: 'ben_prest_003',
    nombre: 'Cena Gourmet Popper Club',
    descripcion: '2x1 en cenas en restaurantes del grupo (niveles Oro y Platinum)',
    tipo: 'promocion',
    nivelMinimo: 'oro',
    fechaInicio: new Date('2024-01-01'),
    fechaFin: new Date('2025-12-31'),
    horarioInicio: '19:00',
    horarioFin: '23:30',
    diasSemana: [4, 5, 6],
    limiteUsoDiario: 1,
    limiteUsoMensual: 4,
    comerciosIds: ['com_005', 'com_006'],
    activo: true,
    usoActual: 456,
    tags: ['restaurante', 'gastronomía', 'premium'],
  },
  {
    id: 'ben_prest_004',
    nombre: 'Pack Bienvenida Popper',
    descripcion: 'Kit de bienvenida para nuevos empleados (nivel Bronce)',
    tipo: 'regalo',
    nivelMinimo: 'bronce',
    fechaInicio: new Date('2024-01-01'),
    fechaFin: new Date('2025-12-31'),
    limiteUsoDiario: 1,
    limiteUsoSemanal: 1,
    comerciosIds: ['com_001'],
    activo: true,
    usoActual: 320,
    tags: ['bienvenida', 'nuevos empleados'],
  },
  {
    id: 'ben_prest_005',
    nombre: 'Estacionamiento Premium',
    descripcion: 'Estacionamiento gratuito en centros comerciales Popper',
    tipo: 'acceso',
    nivelMinimo: 'oro',
    fechaInicio: new Date('2024-01-01'),
    fechaFin: new Date('2025-12-31'),
    horarioInicio: '00:00',
    horarioFin: '23:59',
    diasSemana: [0, 1, 2, 3, 4, 5, 6],
    limiteUsoDiario: 1,
    comerciosIds: ['com_007'],
    activo: true,
    usoActual: 678,
    tags: ['estacionamiento', 'conveniencia'],
  },
];

// ============================================
// Comercios/Sucursales de prueba
// ============================================
export const MOCK_COMMERCE: Commerce[] = [
  {
    id: 'com_001',
    nombre: 'Farmacia Popper - Centro',
    direccion: 'Av. Libertador 5000',
    ciudad: 'Buenos Aires',
    provincia: 'Buenos Aires',
    codigoPostal: 'C1425',
    telefono: '+54 11 4567-1000',
    email: 'centro@farmaciapopper.com.ar',
    coordenadas: { lat: -34.5748, lng: -58.4216 },
    horarioAtencion: { apertura: '08:00', cierre: '22:00' },
    activo: true,
    qrCode: 'QR-FARMA-CENTRO-001',
    responsable: 'Sandra Pérez',
    beneficiosDisponibles: ['ben_prest_001', 'ben_prest_004'],
  },
  {
    id: 'com_002',
    nombre: 'Farmacia Popper - Norte',
    direccion: 'Av. del Libertador 9500',
    ciudad: 'Buenos Aires',
    provincia: 'Buenos Aires',
    codigoPostal: 'C1429',
    telefono: '+54 11 4567-2000',
    email: 'norte@farmaciapopper.com.ar',
    coordenadas: { lat: -34.5267, lng: -58.4534 },
    horarioAtencion: { apertura: '09:00', cierre: '21:00' },
    activo: true,
    qrCode: 'QR-FARMA-NORTE-002',
    responsable: 'Martín García',
    beneficiosDisponibles: ['ben_prest_001'],
  },
  {
    id: 'com_003',
    nombre: 'Farmacia Popper - Sur',
    direccion: 'Av. Rivadavia 7800',
    ciudad: 'Buenos Aires',
    provincia: 'Buenos Aires',
    codigoPostal: 'C1405',
    telefono: '+54 11 4567-3000',
    email: 'sur@farmaciapopper.com.ar',
    coordenadas: { lat: -34.6108, lng: -58.4328 },
    horarioAtencion: { apertura: '08:00', cierre: '20:00' },
    activo: true,
    qrCode: 'QR-FARMA-SUR-003',
    responsable: 'Laura Díaz',
    beneficiosDisponibles: ['ben_prest_001'],
  },
  {
    id: 'com_004',
    nombre: 'Gimnasio FitPopper - Principal',
    direccion: 'Av. Santa Fe 3200',
    ciudad: 'Buenos Aires',
    provincia: 'Buenos Aires',
    codigoPostal: 'C1123',
    telefono: '+54 11 4567-4000',
    email: 'principal@fitpopper.com.ar',
    coordenadas: { lat: -34.5874, lng: -58.3890 },
    horarioAtencion: { apertura: '06:00', cierre: '23:00' },
    activo: true,
    qrCode: 'QR-GYM-PRINCIPAL-001',
    responsable: 'Carlos Ruiz',
    capacidadMaxima: 150,
    beneficiosDisponibles: ['ben_prest_002'],
  },
  {
    id: 'com_005',
    nombre: 'Restaurante Popper Gourmet',
    direccion: 'Av. Callao 890',
    ciudad: 'Buenos Aires',
    provincia: 'Buenos Aires',
    codigoPostal: 'C1022',
    telefono: '+54 11 4567-5000',
    email: 'reservas@poppergourmet.com.ar',
    coordenadas: { lat: -34.6033, lng: -58.3897 },
    horarioAtencion: { apertura: '12:00', cierre: '00:00' },
    activo: true,
    qrCode: 'QR-REST-GOURMET-001',
    responsable: 'Chef María López',
    capacidadMaxima: 80,
    beneficiosDisponibles: ['ben_prest_003'],
  },
  {
    id: 'com_006',
    nombre: 'Restaurante Popper Brasserie',
    direccion: 'Av. Paseo Colón 560',
    ciudad: 'Buenos Aires',
    provincia: 'Buenos Aires',
    codigoPostal: 'C1063',
    telefono: '+54 11 4567-6000',
    email: 'reservas@popperbrasserie.com.ar',
    coordenadas: { lat: -34.6180, lng: -58.3640 },
    horarioAtencion: { apertura: '19:00', cierre: '23:30' },
    activo: true,
    qrCode: 'QR-REST-BRASS-002',
    responsable: 'Chef Andrés Martínez',
    capacidadMaxima: 60,
    beneficiosDisponibles: ['ben_prest_003'],
  },
  {
    id: 'com_007',
    nombre: 'Estacionamiento Popper Mall',
    direccion: 'Av. Cabildo 2500',
    ciudad: 'Buenos Aires',
    provincia: 'Buenos Aires',
    codigoPostal: 'C1425',
    telefono: '+54 11 4567-7000',
    email: 'estacionamiento@poppermall.com.ar',
    coordenadas: { lat: -34.5560, lng: -58.4520 },
    horarioAtencion: { apertura: '00:00', cierre: '23:59' },
    activo: true,
    qrCode: 'QR-PARK-MALL-001',
    responsable: 'Roberto Vega',
    capacidadMaxima: 500,
    beneficiosDisponibles: ['ben_prest_005'],
  },
];

// ============================================
// Verificaciones de prueba
// ============================================
export const MOCK_VERIFICATIONS: Verification[] = [
  {
    id: 'ver_001',
    beneficiarioId: 'ben_001',
    beneficiarioDni: '30123456',
    beneficiarioNombre: 'Roberto Fernández',
    beneficioId: 'ben_prest_001',
    beneficioNombre: 'Descuento en Farmacias Popper',
    comercioId: 'com_001',
    comercioNombre: 'Farmacia Popper - Centro',
    usuarioVerificadorId: 'usr_003',
    usuarioVerificadorNombre: 'Ana Martínez',
    estado: 'exitoso',
    fechaVerificacion: new Date('2024-06-15T14:30:00'),
    montoDescuento: 234.50,
    montoOriginal: 1563.33,
    montoFinal: 1328.83,
    codigoReferencia: 'REF-2024-000001',
  },
  {
    id: 'ver_002',
    beneficiarioId: 'ben_002',
    beneficiarioDni: '32789012',
    beneficiarioNombre: 'Laura Rodríguez',
    beneficioId: 'ben_prest_002',
    beneficioNombre: 'Acceso VIP a Gimnasio FitPopper',
    comercioId: 'com_004',
    comercioNombre: 'Gimnasio FitPopper - Principal',
    usuarioVerificadorId: 'usr_003',
    usuarioVerificadorNombre: 'Ana Martínez',
    estado: 'exitoso',
    fechaVerificacion: new Date('2024-06-15T08:15:00'),
    codigoReferencia: 'REF-2024-000002',
  },
  {
    id: 'ver_003',
    beneficiarioId: 'ben_001',
    beneficiarioDni: '30123456',
    beneficiarioNombre: 'Roberto Fernández',
    beneficioId: 'ben_prest_003',
    beneficioNombre: 'Cena Gourmet Popper Club',
    comercioId: 'com_005',
    comercioNombre: 'Restaurante Popper Gourmet',
    usuarioVerificadorId: 'usr_003',
    usuarioVerificadorNombre: 'Ana Martínez',
    estado: 'exitoso',
    fechaVerificacion: new Date('2024-06-14T20:45:00'),
    montoDescuento: 8500,
    montoOriginal: 17000,
    montoFinal: 8500,
    codigoReferencia: 'REF-2024-000003',
  },
  {
    id: 'ver_004',
    beneficiarioId: 'ben_004',
    beneficiarioDni: '28901234',
    beneficiarioNombre: 'Patricia Torres',
    beneficioId: 'ben_prest_001',
    beneficioNombre: 'Descuento en Farmacias Popper',
    comercioId: 'com_002',
    comercioNombre: 'Farmacia Popper - Norte',
    usuarioVerificadorId: 'usr_003',
    usuarioVerificadorNombre: 'Ana Martínez',
    estado: 'fallido',
    fechaVerificacion: new Date('2024-06-15T11:20:00'),
    notas: 'Beneficio agotado para el mes actual',
    codigoReferencia: 'REF-2024-000004',
  },
  {
    id: 'ver_005',
    beneficiarioId: 'ben_005',
    beneficiarioDni: '35678901',
    beneficiarioNombre: 'Diego Morales',
    beneficioId: 'ben_prest_005',
    beneficioNombre: 'Estacionamiento Premium',
    comercioId: 'com_007',
    comercioNombre: 'Estacionamiento Popper Mall',
    usuarioVerificadorId: 'usr_003',
    usuarioVerificadorNombre: 'Ana Martínez',
    estado: 'exitoso',
    fechaVerificacion: new Date('2024-06-15T09:00:00'),
    codigoReferencia: 'REF-2024-000005',
  },
];

// ============================================
// Credenciales de acceso (simuladas)
// ============================================
export const MOCK_CREDENTIALS: Record<string, string> = {
  'admin.popper': 'admin123',
  'supervisor.sucursal1': 'super123',
  'empleado.ana': 'empleado123',
  'auditor.jorge': 'auditor123',
};

// ============================================
// Funciones de utilidad de configuración
// ============================================
export const getConfig = (): SystemConfig => {
  const saved = localStorage.getItem('popper_config');
  return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
};

export const saveConfig = (config: SystemConfig): void => {
  localStorage.setItem('popper_config', JSON.stringify(config));
};

export const resetConfig = (): void => {
  localStorage.removeItem('popper_config');
};

// ============================================
// Datos de localStorage (para demo)
// ============================================
export const initializeMockData = (): void => {
  if (!localStorage.getItem('popper_beneficiaries')) {
    localStorage.setItem('popper_beneficiaries', JSON.stringify(MOCK_BENEFICIARIES));
  }
  if (!localStorage.getItem('popper_benefits')) {
    localStorage.setItem('popper_benefits', JSON.stringify(MOCK_BENEFITS));
  }
  if (!localStorage.getItem('popper_commerce')) {
    localStorage.setItem('popper_commerce', JSON.stringify(MOCK_COMMERCE));
  }
  if (!localStorage.getItem('popper_verifications')) {
    localStorage.setItem('popper_verifications', JSON.stringify(MOCK_VERIFICATIONS));
  }
  if (!localStorage.getItem('popper_config')) {
    saveConfig(DEFAULT_CONFIG);
  }
};
