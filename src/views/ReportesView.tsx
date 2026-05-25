import { useState, useEffect } from 'react';
import { Download, Printer, TrendingUp, TrendingDown } from 'lucide-react';
import { AreaChartCard, BarChartCard } from '../components/ui/Chart';
import { DataTable } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';
import { Panel } from './DashboardView';

const API_URL = import.meta.env.VITE_API_URL || 'https://beneficios-backend-jfpx.onrender.com/api';

interface Props { token: string; }

export default function ReportesView({ token }: Props) {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  const [desde, setDesde] = useState(firstDay);
  const [hasta, setHasta] = useState(todayStr);
  const [reporte, setReporte] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const headers = { 'Authorization': `Bearer ${token}` };

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/reportes?desde=${desde}&hasta=${hasta}`, { headers });
      if (res.ok) setReporte(await res.json());
    } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [desde, hasta]);

  const exportarExcel = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/reportes/exportar?desde=${desde}&hasta=${hasta}`, { headers });
      if (!res.ok) { alert('Error al exportar'); return; }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `reporte-popper-${desde}_a_${hasta}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch { alert('Error de conexión'); }
  };

  const setPreset = (preset: 'mes' | 'mes_anterior' | 'trimestre' | 'anio') => {
    const now = new Date();
    if (preset === 'mes') {
      setDesde(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
      setHasta(now.toISOString().split('T')[0]);
    } else if (preset === 'mes_anterior') {
      setDesde(new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]);
      setHasta(new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]);
    } else if (preset === 'trimestre') {
      setDesde(new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0]);
      setHasta(now.toISOString().split('T')[0]);
    } else {
      setDesde(new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]);
      setHasta(now.toISOString().split('T')[0]);
    }
  };

  const fmt = (n: number) => `$${Math.round(n || 0).toLocaleString('es-AR')}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header con filtros */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-0.01em', marginBottom: 4 }}>
            Reportes
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>
            Analizá el consumo del programa de beneficios y exportá para Dirección.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => window.print()} className="no-print" style={btnStyle('ghost')}>
            <Printer size={13} style={{ marginRight: 4 }} /> Imprimir
          </button>
          <button onClick={exportarExcel} className="no-print" style={btnStyle('primary')}>
            <Download size={13} style={{ marginRight: 4 }} /> Excel
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="no-print" style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: 12,
        background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(['mes', 'mes_anterior', 'trimestre', 'anio'] as const).map(p => (
            <button key={p} onClick={() => setPreset(p)} style={presetBtn()}>
              {p === 'mes' ? 'Este mes' : p === 'mes_anterior' ? 'Mes anterior' : p === 'trimestre' ? 'Trimestre' : 'Año'}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={dateInput()} />
          <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>→</span>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={dateInput()} />
        </div>
      </div>

      {loading || !reporte ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>Cargando reporte…</div>
      ) : (
        <>
          {/* KPIs principales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <KpiBig
              label="Total gastado"
              value={fmt(reporte.resumen.total_gastado)}
              delta={reporte.resumen.delta_gasto_pct}
              prev={fmt(reporte.resumen.prev_gastado || 0)}
            />
            <KpiBig
              label="Canjes registrados"
              value={(reporte.resumen.total_canjes || 0).toLocaleString('es-AR')}
              delta={reporte.resumen.delta_canjes_pct}
              prev={(reporte.resumen.prev_canjes || 0).toString()}
            />
            <KpiBig
              label="Promedio por canje"
              value={fmt(reporte.resumen.promedio_canje)}
            />
            <KpiBig
              label="Canjes con monto"
              value={(reporte.resumen.canjes_con_monto || 0).toLocaleString('es-AR')}
              subtle={`de ${(reporte.resumen.total_canjes || 0).toLocaleString('es-AR')} totales`}
            />
          </div>

          {/* Serie temporal */}
          <Panel title="Gasto por día" description={`${desde} → ${hasta}`}>
            <AreaChartCard
              data={(reporte.serie_temporal || []).map((d: any) => ({
                label: new Date(d.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
                value: d.gastado,
              }))}
              height={240}
            />
          </Panel>

          {/* Por categoria + jerarquia */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
            <Panel title="Por categoría" description="Distribución de gasto" padded={false}>
              {reporte.por_categoria.length === 0 ? (
                <EmptySmall msg="Sin datos para este período." />
              ) : (
                <div style={{ padding: 8 }}>
                  <BarChartCard
                    data={reporte.por_categoria.slice(0, 8).map((c: any) => ({
                      label: (c.categoria === 'sin_categoria' ? 'Sin cat.' : c.categoria).replace('_', ' '),
                      value: c.gastado,
                    }))}
                    height={Math.min(240, reporte.por_categoria.length * 32)}
                  />
                </div>
              )}
            </Panel>

            <Panel title="Por jerarquía" description="Utilización del límite mensual" padded={false}>
              {reporte.por_jerarquia.length === 0 ? (
                <EmptySmall msg="Cargá jerarquías primero." />
              ) : (
                <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {reporte.por_jerarquia.map((j: any) => (
                    <JerarquiaRow key={j.jerarquia} data={j} />
                  ))}
                </div>
              )}
            </Panel>
          </div>

          {/* Por comercio */}
          <Panel title="Top comercios" description="Ranking por gasto" padded={false}>
            {reporte.por_comercio.length === 0 ? (
              <EmptySmall msg="Sin canjes en este período." />
            ) : (
              <DataTable
                columns={[
                  { key: 'rank', label: '#', width: 40, render: (_: any, _i?: any) => '' },
                  { key: 'comercio', label: 'Comercio', sortable: true,
                    render: (r: any) => <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{r.comercio}</span> },
                  { key: 'ciudad', label: 'Ciudad', sortable: true,
                    render: (r: any) => <span style={{ color: 'var(--text-3)' }}>{r.ciudad || '—'}</span> },
                  { key: 'canjes', label: 'Canjes', mono: true, sortable: true,
                    accessor: (r: any) => r.canjes },
                  { key: 'gastado', label: 'Gastado', mono: true, sortable: true,
                    accessor: (r: any) => r.gastado,
                    render: (r: any) => <span style={{ color: 'var(--brand)', fontWeight: 600 }}>{fmt(r.gastado)}</span> },
                ]}
                data={reporte.por_comercio}
                rowKey={(r: any) => r.comercio}
                searchable={false}
                pageSize={10}
                empty={{ title: 'Sin datos' }}
              />
            )}
          </Panel>

          {/* Top colaboradores */}
          <Panel title="Top colaboradores" description="Ranking por gasto + saldo restante" padded={false}>
            {reporte.top_colaboradores.length === 0 ? (
              <EmptySmall msg="Sin colaboradores con canjes en este período." />
            ) : (
              <DataTable
                columns={[
                  { key: 'dni', label: 'DNI', mono: true, sortable: true },
                  { key: 'nombre', label: 'Colaborador', sortable: true,
                    accessor: (r: any) => `${r.nombre} ${r.apellido}`,
                    render: (r: any) => (
                      <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>
                        {r.nombre} {r.apellido}
                        {r.es_talento_popper && <span style={{ marginLeft: 4, color: 'var(--brand)' }}>★</span>}
                      </span>
                    ) },
                  { key: 'departamento', label: 'Depto', sortable: true,
                    render: (r: any) => <span style={{ color: 'var(--text-3)' }}>{r.departamento || '—'}</span> },
                  { key: 'jerarquia', label: 'Jerarquía',
                    render: (r: any) => r.jerarquia ? <Badge tone="info" size="sm">{r.jerarquia}</Badge> : <span style={{ color: 'var(--text-4)' }}>—</span> },
                  { key: 'canjes', label: 'Canjes', mono: true, sortable: true },
                  { key: 'gastado', label: 'Gastado', mono: true, sortable: true,
                    render: (r: any) => <span style={{ color: 'var(--brand)', fontWeight: 600 }}>{fmt(r.gastado)}</span> },
                  { key: 'saldo_restante', label: 'Saldo', mono: true, sortable: true,
                    render: (r: any) => r.limite_aplicable > 0 ? <span style={{ color: r.saldo_restante > 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>{fmt(r.saldo_restante)}</span> : <span style={{ color: 'var(--text-4)' }}>—</span> },
                  { key: 'utilizacion_pct', label: '% uso', mono: true, sortable: true,
                    render: (r: any) => r.utilizacion_pct != null ? <UtilizacionBar pct={r.utilizacion_pct} /> : <span style={{ color: 'var(--text-4)' }}>—</span> },
                ]}
                data={reporte.top_colaboradores}
                rowKey={(r: any) => r.dni}
                searchPlaceholder="Buscar colaborador…"
                pageSize={20}
                empty={{ title: 'Sin datos' }}
              />
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

function KpiBig({ label, value, delta, prev, subtle }: { label: string; value: string; delta?: number; prev?: string; subtle?: string }) {
  const positivo = delta != null && delta >= 0;
  return (
    <div style={{
      padding: 16, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
      borderRadius: '8px',
    }}>
      <p style={{ fontSize: '11.5px', color: 'var(--text-3)', fontWeight: 500, marginBottom: 8 }}>{label}</p>
      <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {delta != null && Math.abs(delta) > 0.1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
          {positivo ? <TrendingUp size={11} color="var(--success-text)" /> : <TrendingDown size={11} color="var(--danger-text)" />}
          <span style={{ fontSize: '11px', color: positivo ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 500 }}>
            {positivo ? '+' : ''}{delta.toFixed(1)}%
          </span>
          {prev && <span style={{ fontSize: '10.5px', color: 'var(--text-4)' }}>vs {prev}</span>}
        </div>
      )}
      {subtle && (
        <p style={{ fontSize: '10.5px', color: 'var(--text-4)', marginTop: 6 }}>{subtle}</p>
      )}
    </div>
  );
}

function JerarquiaRow({ data }: { data: any }) {
  const pct = Math.min(100, data.utilizacion_pct || 0);
  const fmt = (n: number) => `$${Math.round(n || 0).toLocaleString('es-AR')}`;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'baseline' }}>
        <span style={{ fontSize: '12.5px', color: 'var(--text-1)', fontWeight: 500 }}>
          {data.jerarquia} <span style={{ color: 'var(--text-4)', fontSize: '11px' }}>({data.colaboradores} pers.)</span>
        </span>
        <span style={{ fontSize: '11.5px', color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
          {fmt(data.gastado_total)} / {fmt(data.limite_total)}
        </span>
      </div>
      <div style={{ height: 5, background: 'var(--bg-canvas)', borderRadius: 2.5, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: pct > 80 ? 'var(--warning)' : 'var(--brand)',
          transition: 'width 200ms var(--ease-out)',
        }} />
      </div>
      <div style={{ marginTop: 2, fontSize: '10.5px', color: 'var(--text-3)' }}>{pct.toFixed(1)}% utilización</div>
    </div>
  );
}

function UtilizacionBar({ pct }: { pct: number }) {
  const safePct = Math.min(100, pct);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 50, height: 4, background: 'var(--bg-canvas)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${safePct}%`,
          background: pct > 90 ? 'var(--danger)' : pct > 70 ? 'var(--warning)' : 'var(--brand)',
        }} />
      </div>
      <span style={{ fontSize: '11px', color: pct > 90 ? 'var(--danger-text)' : 'var(--text-2)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

function EmptySmall({ msg }: { msg: string }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: '12.5px' }}>
      {msg}
    </div>
  );
}

function btnStyle(kind: 'primary' | 'ghost'): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center',
    padding: '6px 12px', height: 32,
    background: kind === 'primary' ? 'var(--brand)' : 'transparent',
    color: kind === 'primary' ? 'var(--brand-fg)' : 'var(--text-2)',
    border: `1px solid ${kind === 'primary' ? 'var(--brand)' : 'var(--border-default)'}`,
    borderRadius: '6px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer',
  };
}
function presetBtn(): React.CSSProperties {
  return {
    padding: '5px 10px', background: 'var(--bg-canvas)',
    border: '1px solid var(--border-subtle)', borderRadius: '6px',
    color: 'var(--text-2)', fontSize: '11.5px', cursor: 'pointer',
  };
}
function dateInput(): React.CSSProperties {
  return {
    height: 30, padding: '0 8px', background: 'var(--bg-canvas)',
    border: '1px solid var(--border-default)', borderRadius: '6px',
    color: 'var(--text-1)', fontSize: '12.5px', outline: 'none',
    colorScheme: 'dark',
  };
}
