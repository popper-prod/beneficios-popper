// ============================================
// GRUPO POPPER - Hook de Autenticación
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { User, AuthState } from '../types';

// Clave para localStorage
const AUTH_KEY = 'popper_auth';

const API_URL = import.meta.env.VITE_API_URL || 'https://beneficios-backend-jfpx.onrender.com/api';

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    expiresAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar sesión del localStorage al iniciar
  useEffect(() => {
    const savedAuth = localStorage.getItem(AUTH_KEY);
    if (savedAuth) {
      try {
        const parsed = JSON.parse(savedAuth);
        const expiresAt = new Date(parsed.expiresAt);

        if (expiresAt > new Date()) {
          setAuthState({
            isAuthenticated: true,
            user: parsed.user,
            token: parsed.token,
            expiresAt,
          });
        } else {
          localStorage.removeItem(AUTH_KEY);
        }
      } catch (e) {
        localStorage.removeItem(AUTH_KEY);
      }
    }
    setLoading(false);
  }, []);

  // Función de login - conectar al backend
  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Error en login');
        setLoading(false);
        return false;
      }

      const data = await response.json();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 8);

      const newAuth: AuthState = {
        isAuthenticated: true,
        user: { ...data.user, ultimoAcceso: new Date() },
        token: data.token,
        expiresAt,
      };

      setAuthState(newAuth);
      localStorage.setItem(AUTH_KEY, JSON.stringify(newAuth));
      setLoading(false);
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error de conexión';
      setError(errorMsg);
      setLoading(false);
      return false;
    }
  }, []);

  // Función de logout
  const logout = useCallback(() => {
    setAuthState({
      isAuthenticated: false,
      user: null,
      token: null,
      expiresAt: null,
    });
    localStorage.removeItem(AUTH_KEY);
    setError(null);
  }, []);

  // Verificar si el usuario tiene un permiso específico
  const hasPermission = useCallback((modulo: string, accion: string): boolean => {
    if (!authState.user) return false;
    
    // Admin tiene todos los permisos
    if (authState.user.rol === 'admin') return true;
    
    return authState.user.permisos.some(
      p => p.modulo === modulo && p.acciones.includes(accion as any)
    );
  }, [authState.user]);

  // Verificar si el usuario tiene un rol específico
  const hasRole = useCallback((roles: string[]): boolean => {
    if (!authState.user) return false;
    return roles.includes(authState.user.rol);
  }, [authState.user]);

  // Actualizar datos del usuario
  const updateUser = useCallback((updates: Partial<User>) => {
    if (!authState.user) return;
    
    const updatedUser = { ...authState.user, ...updates };
    setAuthState(prev => ({
      ...prev,
      user: updatedUser,
    }));
    
    // Actualizar en localStorage
    const savedAuth = localStorage.getItem(AUTH_KEY);
    if (savedAuth) {
      const parsed = JSON.parse(savedAuth);
      parsed.user = updatedUser;
      localStorage.setItem(AUTH_KEY, JSON.stringify(parsed));
    }
  }, [authState.user]);

  return {
    ...authState,
    loading,
    error,
    login,
    logout,
    hasPermission,
    hasRole,
    updateUser,
  };
};

export default useAuth;
