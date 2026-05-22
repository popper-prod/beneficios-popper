// ============================================
// GRUPO POPPER - Hook de Datos
// ============================================

import { useState, useEffect, useCallback } from 'react';
import {
  Beneficiary,
  Benefit,
  Commerce,
  Verification,
  VerificationFormData,
  BenefitLevel
} from '../types';
import {
  MOCK_BENEFITS,
  MOCK_COMMERCE,
} from '../config';

const API_URL = import.meta.env.VITE_API_URL || 'https://beneficios-backend-jfpx.onrender.com/api';

export const useData = () => {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [commerce, setCommerce] = useState<Commerce[]>([]);
  const [verifications] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);

  // Cargar datos estáticos (comercios, beneficios) al iniciar
  useEffect(() => {
    // Por ahora usamos datos mock para comercios y beneficios
    // En una implementación completa, estas vendrían del backend
    setCommerce(MOCK_COMMERCE);
    setBenefits(MOCK_BENEFITS);
    setLoading(false);
  }, []);

  // ============================================
  // CRUD de Beneficiarios
  // ============================================
  
  const addBeneficiary = useCallback((beneficiary: Omit<Beneficiary, 'id'>) => {
    const newBeneficiary: Beneficiary = {
      ...beneficiary,
      id: `ben_${Date.now()}`,
    };
    const updated = [...beneficiaries, newBeneficiary];
    setBeneficiaries(updated);
    return newBeneficiary;
  }, [beneficiaries]);

  const updateBeneficiary = useCallback((id: string, updates: Partial<Beneficiary>) => {
    const updated = beneficiaries.map(b =>
      b.id === id ? { ...b, ...updates } : b
    );
    setBeneficiaries(updated);
  }, [beneficiaries]);

  const deleteBeneficiary = useCallback((id: string) => {
    const updated = beneficiaries.filter(b => b.id !== id);
    setBeneficiaries(updated);
  }, [beneficiaries]);

  const getBeneficiaryByDni = useCallback(async (dni: string, token?: string): Promise<Beneficiary | undefined> => {
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_URL}/verificacion/beneficiario/${dni}`, {
        headers,
      });

      if (!response.ok) {
        if (response.status === 404) return undefined;
        throw new Error('Error fetching beneficiary');
      }

      const data = await response.json();
      return data.beneficiario;
    } catch (err) {
      console.error('Error fetching beneficiary:', err);
      return undefined;
    }
  }, []);

  const getBeneficiaryById = useCallback((id: string): Beneficiary | undefined => {
    return beneficiaries.find(b => b.id === id);
  }, [beneficiaries]);

  // ============================================
  // CRUD de Beneficios
  // ============================================
  
  const addBenefit = useCallback((benefit: Omit<Benefit, 'id' | 'usoActual'>) => {
    const newBenefit: Benefit = {
      ...benefit,
      id: `ben_prest_${Date.now()}`,
      usoActual: 0,
    };
    const updated = [...benefits, newBenefit];
    setBenefits(updated);
    return newBenefit;
  }, [benefits]);

  const updateBenefit = useCallback((id: string, updates: Partial<Benefit>) => {
    const updated = benefits.map(b =>
      b.id === id ? { ...b, ...updates } : b
    );
    setBenefits(updated);
  }, [benefits]);

  const deleteBenefit = useCallback((id: string) => {
    const updated = benefits.filter(b => b.id !== id);
    setBenefits(updated);
  }, [benefits]);

  // ============================================
  // CRUD de Comercios
  // ============================================
  
  const addCommerce = useCallback((newCommerce: Omit<Commerce, 'id' | 'qrCode'>) => {
    const commerceItem: Commerce = {
      ...newCommerce,
      id: `com_${Date.now()}`,
      qrCode: `QR-${Date.now()}`,
    };
    const updated = [...commerce, commerceItem];
    setCommerce(updated);
    return commerceItem;
  }, [commerce]);

  const updateCommerce = useCallback((id: string, updates: Partial<Commerce>) => {
    const updated = commerce.map(c =>
      c.id === id ? { ...c, ...updates } : c
    );
    setCommerce(updated);
  }, [commerce]);

  const deleteCommerce = useCallback((id: string) => {
    const updated = commerce.filter(c => c.id !== id);
    setCommerce(updated);
  }, [commerce]);

  // ============================================
  // Verificación de Beneficios
  // ============================================
  
  const processVerification = useCallback(async (
    formData: VerificationFormData,
    _verifierId: string,
    _verifierName: string,
    geoLocation?: { lat: number; lng: number },
    token?: string
  ): Promise<{ success: boolean; message: string; verification?: Verification }> => {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_URL}/verificacion/procesar`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          dni: formData.dni,
          beneficio_id: formData.beneficioId,
          comercio_id: formData.comercioId,
          monto_original: 0,
          monto_descuento: 0,
          latitud: geoLocation?.lat,
          longitud: geoLocation?.lng,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        return { success: false, message: data.error || 'Error en verificación' };
      }

      const data = await response.json();
      return {
        success: true,
        message: '✅ Verificación exitosa',
        verification: data.verificacion
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error de conexión';
      return { success: false, message: errorMsg };
    }
  }, []);

  // ============================================
  // Funciones de consulta
  // ============================================
  
  const getBenefitsForBeneficiary = useCallback((beneficiaryId: string): Benefit[] => {
    const beneficiary = beneficiaries.find(b => b.id === beneficiaryId);
    if (!beneficiary) return [];

    const levelOrder: Record<BenefitLevel, number> = {
      bronce: 1,
      plata: 2,
      oro: 3,
      platinum: 4,
    };

    return benefits.filter(b => {
      const beneficioActivo = b.activo;
      const nivelSuficiente = levelOrder[beneficiary.nivel] >= levelOrder[b.nivelMinimo];
      const enVigencia = new Date(b.fechaFin) >= new Date();
      
      return beneficioActivo && nivelSuficiente && enVigencia;
    });
  }, [beneficiaries, benefits]);

  const getVerificationsByBeneficiary = useCallback((beneficiaryId: string): Verification[] => {
    return verifications.filter(v => v.beneficiarioId === beneficiaryId);
  }, [verifications]);

  const getVerificationsByBenefit = useCallback((benefitId: string): Verification[] => {
    return verifications.filter(v => v.beneficioId === benefitId);
  }, [verifications]);

  const getVerificationsByCommerce = useCallback((commerceId: string): Verification[] => {
    return verifications.filter(v => v.comercioId === commerceId);
  }, [verifications]);

  const getVerificationsByDateRange = useCallback((start: Date, end: Date): Verification[] => {
    return verifications.filter(v => {
      const fecha = new Date(v.fechaVerificacion);
      return fecha >= start && fecha <= end;
    });
  }, [verifications]);

  // ============================================
  // Estadísticas
  // ============================================
  
  const getStats = useCallback(() => {
    const hoy = new Date();
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay());
    inicioSemana.setHours(0, 0, 0, 0);
    
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    const verificacionesExitosas = verifications.filter(v => v.estado === 'exitoso');

    const verificacionesHoy = verificacionesExitosas.filter(v => 
      new Date(v.fechaVerificacion).toDateString() === hoy.toDateString()
    );

    const verificacionesSemana = verificacionesExitosas.filter(v => 
      new Date(v.fechaVerificacion) >= inicioSemana
    );

    const verificacionesMes = verificacionesExitosas.filter(v => 
      new Date(v.fechaVerificacion) >= inicioMes
    );

    const totalDescuentos = verificacionesExitosas.reduce(
      (sum: number, v) => sum + (v.montoDescuento || 0), 0
    );

    const beneficiosMasUsados = benefits
      .map(b => ({
        beneficioId: b.id,
        beneficioNombre: b.nombre,
        totalUsos: verificacionesExitosas.filter(v => v.beneficioId === b.id).length,
        porcentajeUso: 0,
      }))
      .sort((a, b) => b.totalUsos - a.totalUsos)
      .slice(0, 5);

    const totalUsos = beneficiosMasUsados.reduce((sum, b) => sum + b.totalUsos, 0);
    beneficiosMasUsados.forEach(b => {
      b.porcentajeUso = totalUsos > 0 ? (b.totalUsos / totalUsos) * 100 : 0;
    });

    // Verificaciones por día (últimos 7 días)
    const verificacionesPorDia = Array.from({ length: 7 }, (_, i) => {
      const fecha = new Date(hoy);
      fecha.setDate(hoy.getDate() - (6 - i));
      return {
        fecha: fecha.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }),
        total: verificacionesExitosas.filter((v: Verification) => 
          new Date(v.fechaVerificacion).toDateString() === fecha.toDateString()
        ).length,
      };
    });

    // Verificaciones por sucursal
    const verificacionesPorSucursal = commerce.map(c => ({
      comercioId: c.id,
      comercioNombre: c.nombre,
      total: verificacionesExitosas.filter((v: Verification) => v.comercioId === c.id).length,
      montoTotal: verificacionesExitosas
        .filter((v: Verification) => v.comercioId === c.id)
        .reduce((sum: number, v) => sum + (v.montoDescuento || 0), 0),
    })).sort((a, b) => b.total - a.total);

    return {
      totalVerificaciones: verificacionesExitosas.length,
      verificacionesHoy: verificacionesHoy.length,
      verificacionesSemana: verificacionesSemana.length,
      verificacionesMes: verificacionesMes.length,
      totalBeneficiarios: beneficiaries.length,
      beneficiariosActivos: beneficiaries.filter(b => b.activo).length,
      totalBeneficios: benefits.length,
      beneficiosActivos: benefits.filter(b => b.activo).length,
      totalComercios: commerce.length,
      comerciosActivos: commerce.filter(c => c.activo).length,
      montoTotalDescuentos: totalDescuentos,
      promedioDiario: verificacionesMes.length / hoy.getDate(),
      tasaExito: verifications.length > 0 
        ? (verificacionesExitosas.length / verifications.length) * 100 
        : 0,
      beneficiosMasUsados,
      verificacionesPorDia,
      verificacionesPorSucursal,
      alertasActivas: [],
    };
  }, [beneficiaries, benefits, commerce, verifications]);

  return {
    // Datos
    beneficiaries,
    benefits,
    commerce,
    verifications,
    loading,
    
    // CRUD Beneficiarios
    addBeneficiary,
    updateBeneficiary,
    deleteBeneficiary,
    getBeneficiaryByDni,
    getBeneficiaryById,
    
    // CRUD Beneficios
    addBenefit,
    updateBenefit,
    deleteBenefit,
    
    // CRUD Comercios
    addCommerce,
    updateCommerce,
    deleteCommerce,
    
    // Verificación
    processVerification,
    
    // Consultas
    getBenefitsForBeneficiary,
    getVerificationsByBeneficiary,
    getVerificationsByBenefit,
    getVerificationsByCommerce,
    getVerificationsByDateRange,
    
    // Estadísticas
    getStats,
  };
};

export default useData;
