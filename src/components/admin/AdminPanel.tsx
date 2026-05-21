// ============================================
// GRUPO POPPER - Panel Administrativo Premium
// ============================================

import React, { useState } from 'react';
import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { Input } from '../ui/Input';
import { BenefitLevelBadge, TransactionStatusBadge } from '../ui/Badge';
import { 
  User, 
  Beneficiary, 
  Benefit, 
  Commerce, 
  Verification
} from '../../types';

type AdminTab = 'beneficiarios' | 'beneficios' | 'comercios' | 'reportes';

interface AdminPanelProps {
  user: User;
  beneficiaries: Beneficiary[];
  benefits: Benefit[];
  commerce: Commerce[];
  verifications: Verification[];
  onUpdateBeneficiary: (id: string, data: Partial<Beneficiary>) => void;
  onUpdateBenefit: (id: string, data: Partial<Benefit>) => void;
  onUpdateCommerce: (id: string, data: Partial<Commerce>) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  user: _user,
  beneficiaries,
  benefits,
  commerce,
  verifications,
  onUpdateBeneficiary: _onUpdateBeneficiary,
  onUpdateBenefit: _onUpdateBenefit,
  onUpdateCommerce: _onUpdateCommerce,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('beneficiarios');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [_isEditing, setIsEditing] = useState(false);

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode; count: number }[] = [
    {
      id: 'beneficiarios',
      label: 'Beneficiarios',
      count: beneficiaries.length,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      id: 'beneficios',
      label: 'Beneficios',
      count: benefits.length,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
        </svg>
      ),
    },
    {
      id: 'comercios',
      label: 'Comercios',
      count: commerce.length,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      id: 'reportes',
      label: 'Reportes',
      count: verifications.length,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
  ];

  const filteredBeneficiaries = beneficiaries.filter(b => 
    b.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.apellido.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.dni.includes(searchQuery)
  );

  const filteredBenefits = benefits.filter(b =>
    b.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.descripcion.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCommerce = commerce.filter(c =>
    c.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.ciudad.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Panel de Administración</h2>
          <p className="text-gray-500 dark:text-gray-400">Gestiona beneficiarios, beneficios y sucursales</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Importar CSV
          </Button>
          <Button variant="outline" size="sm">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exportar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedItem(null);
                setIsEditing(false);
                setSearchQuery('');
              }}
              className={cn(
                'flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors',
                activeTab === tab.id
                  ? 'border-[#1e3a5f] text-[#1e3a5f]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              {tab.icon}
              {tab.label}
              <span className={cn(
                'px-2 py-0.5 rounded-full text-xs font-bold',
                activeTab === tab.id
                  ? 'bg-[#1e3a5f] text-white'
                  : 'bg-gray-100 text-gray-600'
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1">
          <Input
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </div>
        <Button>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nuevo
        </Button>
      </div>

      {/* Content */}
      <Card>
        <CardContent className="p-0">
          {/* Beneficiarios */}
          {activeTab === 'beneficiarios' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Beneficiario
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      DNI
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Nivel
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Departamento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredBeneficiaries.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#2d5a87] flex items-center justify-center text-white font-bold text-sm">
                            {b.nombre[0]}{b.apellido[0]}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 dark:text-white">
                              {b.nombre} {b.apellido}
                            </p>
                            <p className="text-sm text-gray-500">{b.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-800 dark:text-white">
                        {b.dni}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <BenefitLevelBadge level={b.nivel} size="sm" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {b.departamento || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn(
                          'px-2 py-1 rounded-full text-xs font-semibold',
                          b.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                        )}>
                          {b.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => {
                            setSelectedItem(b);
                            setIsEditing(true);
                          }}
                          className="text-[#1e3a5f] hover:text-[#2d5a87] font-medium text-sm"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Beneficios */}
          {activeTab === 'beneficios' && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBenefits.map((b) => (
                  <div
                    key={b.id}
                    className={cn(
                      'border-2 rounded-xl p-4 transition-all cursor-pointer hover:shadow-md',
                      selectedItem?.id === b.id
                        ? 'border-[#1e3a5f] bg-[#1e3a5f]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                    onClick={() => setSelectedItem(b)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-gray-800 dark:text-white">{b.nombre}</h4>
                      <BenefitLevelBadge level={b.nivelMinimo} size="sm" />
                    </div>
                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">{b.descripcion}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">
                        {b.descuento ? `${b.descuento}% OFF` : b.valorFijo ? formatCurrency(b.valorFijo) : 'Acceso'}
                      </span>
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-semibold',
                        b.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      )}>
                        {b.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comercios */}
          {activeTab === 'comercios' && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCommerce.map((c) => (
                  <div
                    key={c.id}
                    className={cn(
                      'border-2 rounded-xl p-4 transition-all hover:shadow-md',
                      selectedItem?.id === c.id
                        ? 'border-[#1e3a5f] bg-[#1e3a5f]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-[#1e3a5f]/10 flex items-center justify-center text-[#1e3a5f]">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800 dark:text-white">{c.nombre}</h4>
                        <p className="text-sm text-gray-500">{c.direccion}, {c.ciudad}</p>
                        <div className="flex items-center gap-2 mt-2 text-sm text-gray-400">
                          <span>{c.telefono}</span>
                          <span>•</span>
                          <span>{c.horarioAtencion.apertura} - {c.horarioAtencion.cierre}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={cn(
                          'px-2 py-1 rounded-full text-xs font-semibold',
                          c.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                        )}>
                          {c.activo ? 'Activo' : 'Inactivo'}
                        </span>
                        <div className="mt-2">
                          <Button size="sm" variant="ghost">QR</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reportes */}
          {activeTab === 'reportes' && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card variant="gradient">
                  <div className="text-center text-white">
                    <p className="text-white/70 text-sm">Total Verificaciones</p>
                    <p className="text-3xl font-bold mt-1">{verifications.length}</p>
                  </div>
                </Card>
                <Card>
                  <div className="text-center">
                    <p className="text-gray-500 text-sm">Verificaciones Exitosas</p>
                    <p className="text-3xl font-bold text-emerald-600 mt-1">
                      {verifications.filter(v => v.estado === 'exitoso').length}
                    </p>
                  </div>
                </Card>
                <Card>
                  <div className="text-center">
                    <p className="text-gray-500 text-sm">Monto Total Descuentos</p>
                    <p className="text-3xl font-bold text-[#1e3a5f] mt-1">
                      {formatCurrency(verifications.reduce((sum, v) => sum + (v.montoDescuento || 0), 0))}
                    </p>
                  </div>
                </Card>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        Fecha
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        Beneficiario
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        Beneficio
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        Sucursal
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                        Descuento
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {verifications.slice(0, 20).map((v) => (
                      <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(v.fechaVerificacion).toLocaleString('es-AR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">
                          {v.beneficiarioNombre}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {v.beneficioNombre}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {v.comercioNombre}
                        </td>
                        <td className="px-4 py-3">
                          <TransactionStatusBadge status={v.estado} size="sm" />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-right text-emerald-600">
                          {v.montoDescuento ? `-${formatCurrency(v.montoDescuento)}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPanel;
