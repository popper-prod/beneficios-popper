import { Activity, Calendar, TrendingUp, Users, Store, Gift, ArrowUpRight } from 'lucide-react';
import { AreaChartCard, BarChartCard } from '../components/ui/Chart';
import { DataTable } from '../components/ui/DataTable';
import { Badge, TierBadge } from '../components/ui/Badge';

// ============================================
// DashboardView — Vercel Analytics aesthetic
// ============================================

interface DashboardData {
  stats: {
    verificacionesHoy: number;
    verificacionesSemana: number;
    verificacionesMes: number;
    totalBeneficiarios: number;
    totalComercios: number;
    totalBeneficios: number;
  };
  topBeneficios: { nombre: string; total_usos: string }[];
  topComercios: { nombre: string; total_usos: string }[];
  verificacionesPorDia: { fecha: string; total: string }[];
  ultimasVerificaciones: any[];
}

interface Props {
  data: DashboardData;
  user: any;
}

export default function DashboardView({ data, user }: Props) {
  const firstName = (user?.nombre || '').split(' ')[0] || 'Hola';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

  // Chart data
  const chartData = (data.verificacionesPorDia || []).map((d: any) => ({
    label: new Date(d.fecha).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }),
    value: parseInt(d.total, 10) || 0,
  }));

  const topBeneficiosData = data.topBeneficios.slice(0, 5).map((b: any) => ({
    label: b.nombre.length > 22 ? b.nombre.substring(0, 20) + '…' : b.nombre,
    value: parseInt(b.total_usos, 10) || 0,
  }));

  const topComerciosData = data.topComercios.slice(0, 5).map((c: any) => ({
    label: c.nombre.length > 22 ? c.nombre.substring(0, 20) + '…' : c.nombre,
    value: parseInt(c.total_usos, 10) || 0,
  }));

  // Delta calculation (placeholder — when we have historical data we'll compute real deltas)
  const trend7Days = chartData.slice(-7).map(d => d.value);
  const sumLast7 = trend7Days.reduce((a, b) => a + b, 0);
  const sumPrev7 = chartData.slice(-14, -7).reduce((a, b) => a + b.value, 0);
  const delta7Days = sumPrev7 ? ((sumLast7 - sumPrev7) / sumPrev7) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ===== Greeting ===== */}
      <header>
        <h1
          style={{
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--text-1)',
            letterSpacing: '-0.01em',
            marginBottom: 4,
          }}
        >
          {greeting}, {firstName}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>
          Resumen general del programa de beneficios.
        </p>
      </header>

      {/* ===== KPI grid principal ===== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        <Metric
          label="Verificaciones hoy"
          value={data.stats.verificacionesHoy}
          icon={<Activity size={14} />}
        />
        <Metric
          label="Esta semana"
          value={data.stats.verificacionesSemana}
          delta={delta7Days}
          icon={<Calendar size={14} />}
        />
        <Metric
          label="Este mes"
          value={data.stats.verificacionesMes}
          icon={<TrendingUp size={14} />}
        />
        <Metric
          label="Colaboradores"
          value={data.stats.totalBeneficiarios}
          icon={<Users size={14} />}
          subtle
        />
        <Metric
          label="Comercios"
          value={data.stats.totalComercios}
          icon={<Store size={14} />}
          subtle
        />
        <Metric
          label="Beneficios activos"
          value={data.stats.totalBeneficios}
          icon={<Gift size={14} />}
          subtle
        />
      </div>

      {/* ===== Chart principal ===== */}
      <Panel
        title="Actividad reciente"
        description="Verificaciones registradas en los últimos días"
      >
        <AreaChartCard data={chartData} height={240} />
      </Panel>

      {/* ===== Top beneficios + comercios ===== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        <Panel title="Beneficios más canjeados" description="Top 5 — últimos 30 días">
          {topBeneficiosData.length === 0 ? (
            <EmptyPanel message="Aún no hay canjes registrados." />
          ) : (
            <BarChartCard data={topBeneficiosData} height={220} />
          )}
        </Panel>

        <Panel title="Comercios más visitados" description="Top 5 — últimos 30 días">
          {topComerciosData.length === 0 ? (
            <EmptyPanel message="Aún no hay actividad registrada." />
          ) : (
            <BarChartCard data={topComerciosData} height={220} />
          )}
        </Panel>
      </div>

      {/* ===== Activity feed ===== */}
      <Panel title="Movimiento reciente" description="Últimas verificaciones registradas en tiempo real" padded={false}>
        <DataTable
          columns={[
            {
              key: 'fecha',
              label: 'Fecha',
              sortable: true,
              accessor: (r: any) => new Date(r.fecha_verificacion).getTime(),
              render: (r: any) => (
                <span style={{ color: 'var(--text-3)' }}>
                  {new Date(r.fecha_verificacion).toLocaleString('es-AR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              ),
            },
            {
              key: 'colaborador',
              label: 'Colaborador',
              sortable: true,
              accessor: (r: any) => `${r.beneficiario_nombre || ''} ${r.beneficiario_apellido || ''}`,
              render: (r: any) => (
                <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>
                  {r.beneficiario_nombre} {r.beneficiario_apellido}
                </span>
              ),
            },
            { key: 'dni', label: 'DNI', mono: true, sortable: true },
            {
              key: 'beneficio',
              label: 'Beneficio',
              sortable: true,
              accessor: (r: any) => r.beneficio_nombre,
              render: (r: any) => <span style={{ color: 'var(--brand)' }}>{r.beneficio_nombre}</span>,
            },
            {
              key: 'comercio',
              label: 'Comercio',
              sortable: true,
              accessor: (r: any) => r.comercio_nombre,
            },
            {
              key: 'estado',
              label: 'Estado',
              render: (r: any) => (
                <Badge tone={r.estado === 'exitoso' ? 'success' : 'danger'} dot size="sm">
                  {r.estado}
                </Badge>
              ),
            },
            { key: 'codigo_referencia', label: 'Código', mono: true },
          ]}
          data={data.ultimasVerificaciones}
          rowKey={(r: any) => r.id}
          searchable={false}
          pageSize={10}
          empty={{
            title: 'Sin movimiento aún',
            description: 'Las verificaciones aparecerán acá en tiempo real.',
          }}
        />
      </Panel>
    </div>
  );
}

// ============================================
// Metric — KPI card minimalista
// ============================================
function Metric({
  label,
  value,
  delta,
  icon,
  subtle,
}: {
  label: string;
  value: number;
  delta?: number;
  icon?: React.ReactNode;
  subtle?: boolean;
}) {
  return (
    <div
      style={{
        padding: '16px',
        background: subtle ? 'var(--bg-surface)' : 'var(--bg-elevated)',
        border: `1px solid ${subtle ? 'var(--border-subtle)' : 'var(--border-subtle)'}`,
        borderRadius: '8px',
        transition: 'all 120ms var(--ease-in-out)',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontSize: '11.5px',
            color: 'var(--text-3)',
            fontWeight: 500,
          }}
        >
          {label}
        </span>
        {icon && <span style={{ color: 'var(--text-4)' }}>{icon}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span
          style={{
            fontSize: '24px',
            fontWeight: 600,
            color: 'var(--text-1)',
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value.toLocaleString('es-AR')}
        </span>
        {delta !== undefined && Math.abs(delta) > 0.5 && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 500,
              color: delta >= 0 ? 'var(--success-text)' : 'var(--danger-text)',
              fontVariantNumeric: 'tabular-nums',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            {delta >= 0 ? '↗' : '↘'} {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// Panel — sección con header
// ============================================
export function Panel({
  title,
  description,
  action,
  children,
  padded = true,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <section
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          padding: '14px 16px',
          borderBottom: padded ? undefined : '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '13.5px',
              fontWeight: 600,
              color: 'var(--text-1)',
              letterSpacing: '-0.005em',
            }}
          >
            {title}
          </h2>
          {description && (
            <p style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: 2 }}>
              {description}
            </p>
          )}
        </div>
        {action}
      </header>
      <div style={{ padding: padded ? '16px' : 0 }}>{children}</div>
    </section>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div
      style={{
        height: 220,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-4)',
        fontSize: '12px',
      }}
    >
      {message}
    </div>
  );
}

// re-export for tabs
export { TierBadge };

// arrow icon helper - re-export from lucide for convenience
export const ArrowUpRightIcon = ArrowUpRight;
