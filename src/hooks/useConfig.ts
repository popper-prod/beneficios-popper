// ============================================
// GRUPO POPPER - Hook de Configuración
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { SystemConfig, ThemeMode, Language } from '../types';
import { getConfig, saveConfig, DEFAULT_CONFIG } from '../config';

export const useConfig = () => {
  const [config, setConfig] = useState<SystemConfig>(getConfig());
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Detectar tema según hora del día o preferencia del sistema
  useEffect(() => {
    const detectTheme = () => {
      if (config.sistema.tema === 'auto') {
        const hour = new Date().getHours();
        // Modo oscuro entre 20:00 y 06:00
        setTheme(hour >= 20 || hour < 6 ? 'dark' : 'light');
      } else {
        setTheme(config.sistema.tema);
      }
    };

    detectTheme();

    // Actualizar cada minuto si está en modo automático
    if (config.sistema.tema === 'auto') {
      const interval = setInterval(detectTheme, 60000);
      return () => clearInterval(interval);
    }
  }, [config.sistema.tema]);

  // Aplicar tema al documento
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    
    // Aplicar colores CSS custom properties
    const root = document.documentElement;
    root.style.setProperty('--color-primary', config.empresa.colors.primary);
    root.style.setProperty('--color-secondary', config.empresa.colors.secondary);
    root.style.setProperty('--color-accent', config.empresa.colors.accent);
    root.style.setProperty('--color-success', config.empresa.colors.success);
    root.style.setProperty('--color-warning', config.empresa.colors.warning);
    root.style.setProperty('--color-error', config.empresa.colors.error);
  }, [theme, config.empresa.colors]);

  // Actualizar configuración
  const updateConfig = useCallback((updates: Partial<SystemConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    saveConfig(newConfig);
  }, [config]);

  // Actualizar tema
  const updateTheme = useCallback((newTheme: ThemeMode) => {
    updateConfig({
      sistema: { ...config.sistema, tema: newTheme },
    });
  }, [config.sistema, updateConfig]);

  // Actualizar idioma
  const updateLanguage = useCallback((lang: Language) => {
    updateConfig({
      sistema: { ...config.sistema, idioma: lang },
    });
    document.documentElement.lang = lang;
  }, [config.sistema, updateConfig]);

  // Actualizar colores
  const updateColors = useCallback((colors: Partial<SystemConfig['empresa']['colors']>) => {
    updateConfig({
      empresa: {
        ...config.empresa,
        colors: { ...config.empresa.colors, ...colors },
      },
    });
  }, [config.empresa, updateConfig]);

  // Resetear configuración
  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    saveConfig(DEFAULT_CONFIG);
  }, []);

  return {
    config,
    theme,
    language: config.sistema.idioma,
    isDarkMode: theme === 'dark',
    updateConfig,
    updateTheme,
    updateLanguage,
    updateColors,
    resetConfig,
  };
};

export default useConfig;
