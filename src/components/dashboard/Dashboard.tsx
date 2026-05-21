// ============================================
// GRUPO POPPER - Dashboard Principal Premium
// ============================================

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { StatCard, Card, CardHeader, CardContent } from '../ui/Card';
import { TransactionStatusBadge } from '../ui/Badge';
import { DashboardStats, Verification } from '../../types';

interface DashboardProps {
  stats: DashboardStats;
  recentVerifications: Verification[];
}

export const Dashboard: React.FC<DashboardProps> = ({ stats, recentVerifications }) => {
  // Colores para gráficos
  const COLORS = ['#1e3a5f', '#2d5a87', '#ffd700', '#10b981', '#f59e0b', '#ef4444'];

  // Datos para gráfico de verificaciones por sucursal
  const commerceData = stats.verificacionesPorSucursal.map((c, i) => ({
    name: c.comercioNombre.length > 20 ? c.comercioNombre.substring(0, 20) + '...' : c.comercioNombre,
    verificaciones: c.total,
    monto: c.montoTotal,
    fill: COLORS[i % COLORS.length],
  }));

  // Datos para gráfico circular de beneficios
  const benefitPieData = stats.beneficiosMasUsados.map((b, i) => ({
    name: b.beneficioNombre.length > 25 ? b.beneficioNombre.substring(0, 25) + '...' : b.beneficioNombre,
    value: b.totalUsos,
    fill: COLORS[i % COLORS.length],
  }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard
          title="Verificaciones Hoy"
          value={stats.verificacionesHoy}
          change={12.5}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          color="success"
        />
        <StatCard
          title="Beneficiarios Activos"
          value={stats.beneficiariosActivos}
          change={5.2}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
          color="primary"
        />
        <StatCard
          title="Beneficios Activos"
          value={stats.beneficiosActivos}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
          }
          color="accent"
        />
        <StatCard
          title="Monto Descuentos"
          value={formatCurrency(stats.montoTotalDescuentos)}
          change={-3.1}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          color="warning"
        />
      </div>

      {/* Gráficos principales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de barras - Verificaciones por sucursal */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Verificaciones por Sucursal"
            subtitle="Últimos 7 días"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
          />
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={commerceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e3a5f',
                      border: 'none',
                      borderRadius: '12px',
                      color: 'white',
                    }}
                  />
                  <Bar dataKey="verificaciones" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico circular - Beneficios más usados */}
        <Card>
          <CardHeader
            title="Beneficios Más Usados"
            subtitle="Distribución por uso"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
            }
          />
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={benefitPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {benefitPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                    }}
                  />
                  <Legend
                    formatter={(value) =>
                      value.length > 20 ? value.substring(0, 20) + '...' : value
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tendencia y actividad reciente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de tendencia */}
        <Card>
          <CardHeader
            title="Tendencia de Verificaciones"
            subtitle="Últimos 7 días"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
          />
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.verificacionesPorDia}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e3a5f',
                      border: 'none',
                      borderRadius: '12px',
                      color: 'white',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#ffd700"
                    strokeWidth={3}
                    dot={{ fill: '#1e3a5f', strokeWidth: 2 }}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Actividad reciente */}
        <Card>
          <CardHeader
            title="Actividad Reciente"
            subtitle="Últimas verificaciones"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <CardContent>
            <div className="space-y-4 max-h-64 overflow-y-auto">
              {recentVerifications.slice(0, 8).map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex-shrink-0">
                    <TransactionStatusBadge status={v.estado} size="sm" showDot={false} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                      {v.beneficiarioNombre}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {v.beneficioNombre}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(v.fechaVerificacion).toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {v.montoDescuento && (
                      <p className="text-xs font-semibold text-emerald-600">
                        -{formatCurrency(v.montoDescuento)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card variant="gradient">
          <div className="text-center">
            <p className="text-white/70 text-sm mb-2">Verificaciones del Mes</p>
            <p className="text-4xl font-bold text-white">{stats.verificacionesMes}</p>
            <div className="mt-4 flex justify-center gap-4 text-sm">
              <div>
                <p className="text-white/70">Semana</p>
                <p className="text-white font-semibold">{stats.verificacionesSemana}</p>
              </div>
              <div className="w-px bg-white/30" />
              <div>
                <p className="text-white/70">Promedio Diario</p>
                <p className="text-white font-semibold">{stats.promedioDiario.toFixed(1)}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="text-center">
            <p className="text-gray-500 text-sm mb-2">Tasa de Éxito</p>
            <div className="relative inline-flex items-center justify-center">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="#e5e7eb"
                  strokeWidth="12"
                  fill="none"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="#10b981"
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={`${stats.tasaExito * 3.51} 351`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute">
                <p className="text-3xl font-bold text-gray-800 dark:text-white">
                  {stats.tasaExito.toFixed(1)}%
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              {stats.totalVerificaciones} verificaciones exitosas
            </p>
          </div>
        </Card>

        <Card>
          <div className="text-center">
            <p className="text-gray-500 text-sm mb-2">Sucursales Activas</p>
            <p className="text-4xl font-bold text-[#1e3a5f]">
              {stats.comerciosActivos}
              <span className="text-lg text-gray-400 ml-1">/ {stats.totalComercios}</span>
            </p>
            <div className="mt-6 flex justify-center">
              <div className="flex -space-x-2">
                {stats.verificacionesPorSucursal.slice(0, 5).map((c, i) => (
                  <div
                    key={c.comercioId}
                    className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    title={c.comercioNombre}
                  >
                    {c.comercioNombre.charAt(0)}
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-500">Total de sucursales en el sistema</p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
