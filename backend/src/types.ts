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

export interface Beneficiario {
  id: string;
  dni: string;
  nombre: string;
  apellido: string;
  email?: string;
  nivel: 'bronce' | 'plata' | 'oro' | 'platinum';
  departamento?: string;
  activo: boolean;
}

export interface AuthResponse {
  user: Omit<Usuario, 'id'> & { id?: string };
  token: string;
}

export interface JwtPayload {
  userId: string;
  username: string;
  rol: string;
}

export interface VerificationResult {
  success: boolean;
  message: string;
  code?: string;
  discount?: number;
}
