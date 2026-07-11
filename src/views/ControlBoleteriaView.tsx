import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, Search } from 'lucide-react';
import { DataTable } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';
import { Panel } from './DashboardView';

const API_URL = import.meta.env.VITE_API_URL || 'https://beneficios-backend-jfpx.onrender.com/api';

interface Props { token: string; }

interface ResumenRow { comercio_id: string; comercio: string; consultas: number; confirmadas: number; sin_cerrar: number; }
interface PendienteRow { id: string; comercio: string; dni: string; nombre: string; tipo: string; relacion: string | null; fecha: string; created_at: string; }

export default function ControlBoleteriaView({ token }: Props) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [desde, setDesde] = useState(todayStr);
  const [hasta, setHasta] = useState(todayStr);
  const [resumen, setResumen] = useState<ResumenRow[]>([]);
  const [sinCerrar, setSinCerrar] = useState<PendienteRow[]>([]);
  const [loading, setLoading] = useState(true);

  const headers = { 'Authorization': `Bearer ${token}` };

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/pendientes?desde=${desde}&hasta=${hasta}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setResumen(data.resumen || []);
        setSinCerrar(data.sin_cerrar || []);
      }
    } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [desde, hasta]);

  const setPreset = (preset: 'hoy' | 'ayer' | 'semana' | 'mes') => {
    const now = new Date();
    const iso = (d: Date) => d.toISOString().split('T')[0];
    if (preset === 'hoy') { setDesde(iso(now)); setHasta(iso(now)); }
    else if (preset === 'ayer') { const y = new Date(now); y.setDate(y.getDate() - 1); setDesde(iso(y)); setHasta(iso(y)); }
    else if (preset === 'semana') { const w = new Date(now); w.setDate(w.getDate() - 6); setDesde(iso(w)); setHasta(iso(now)); }
    else { setDesde(iso(new Date(now.getFullYear(), now.getMonth(), 1))); setHasta(iso(now)); }
  };

  // Totales agregados sobre todos los comercios
  const totConsultas = resumen.reduce((a, r) => a + (r.consultas || 0), 0);
  const totConfirmadas = resumen.reduce((a, r) => a + (r.confirmadas || 0), 0);
  const totSinCerrar = resumen.reduce((a, r) => a + (r.sin_cerrar || 0), 0);
  const pctCierre = totConsultas > 0 ? (totConfirmadas / totConsultas) * 100 : 0;

  const horaDe = (ts: string) => {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-0.01em', marginBottom: 4 }}>
            Control boletería
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', maxWidth: 560 }}>
            Cada consulta del boletero deja registro. Las <strong>sin cerrar</strong> son pases que el boletero
            consultó pero <strong>no confirmó</strong> en el sistema — la brecha a seguir.
          </p>
        </div>
        <button onClick={cargar} style={btnGhost()}>
          <RefreshCw size={13} style={{ marginRight: 4 }} /> Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: 12,
        background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(['hoy', 'ayer', 'semana', 'mes'] as const).map(p => (
            <button key={p} onClick={() => setPreset(p)} style={presetBtn()}>
              {p === 'hoy' ? 'Hoy' : p === 'ayer' ? 'Ayer' : p === 'semana' ? 'Últimos 7 días' : 'Este mes'}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={dateInput()} />
          <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>→</span>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={dateInput()} />
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>Cargando…</div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <Kpi label="Consultas" value={totConsultas.toLocaleString('es-AR')} sub="pases consultados" />
            <Kpi label="Cerrados" value={totConfirmadas.toLocaleString('es-AR')} tone="ok" sub="registrados en el sistema" />
            <Kpi label="Sin cerrar" value={totSinCerrar.toLocaleString('es-AR')} tone={totSinCerrar > 0 ? 'warn' : undefined} sub="consultó y no confirmó" />
            <Kpi label="% de cierre" value={`${pctCierre.toFixed(0)}%`} tone={pctCierre >= 90 ? 'ok' : pctCierre >= 70 ? undefined : 'warn'} />
          </div>

          {/* Resumen por comercio */}
          <Panel title="Por boletería" description={desde === hasta ? desde : `${desde} → ${hasta}`} padded={false}>
            {resumen.length === 0 ? (
              <EmptySmall msg="Sin consultas en este período." />
            ) : (
              <DataTable
                columns={[
                  { key: 'comercio', label: 'Boletería', sortable: true,
                    render: (r: ResumenRow) => <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{r.comercio || '—'}</span> },
                  { key: 'consultas', label: 'Consultas', mono: true, sortable: true, accessor: (r: ResumenRow) => r.consultas },
                  { key: 'confirmadas', label: 'Cerrados', mono: true, sortable: true, accessor: (r: ResumenRow) => r.confirmadas,
                    render: (r: ResumenRow) => <span style={{ color: 'var(--success-text)', fontWeight: 600 }}>{r.confirmadas}</span> },
                  { key: 'sin_cerrar', label: 'Sin cerrar', mono: true, sortable: true, accessor: (r: ResumenRow) => r.sin_cerrar,
                    render: (r: ResumenRow) => r.sin_cerrar > 0
                      ? <span style={{ color: 'var(--warning)', fontWeight: 700 }}>{r.sin_cerrar}</span>
                      : <span style={{ color: 'var(--text-4)' }}>0</span> },
                  { key: 'pct', label: '% cierre', mono: true,
                    render: (r: ResumenRow) => {
                      const pct = r.consultas > 0 ? (r.confirmadas / r.consultas) * 100 : 0;
                      return <span style={{ color: pct >= 90 ? 'var(--success-text)' : pct >= 70 ? 'var(--text-2)' : 'var(--warning)', fontWeight: 500 }}>{pct.toFixed(0)}%</span>;
                    } },
                ]}
                data={resumen}
                rowKey={(r: ResumenRow) => r.comercio_id}
                searchable={false}
                pageSize={10}
                empty={{ title: 'Sin datos' }}
              />
            )}
          </Panel>

          {/* Listado de sin cerrar (la brecha) */}
          <Panel
            title="Pases sin registrar"
            description="Consultó el boletero pero no confirmó el canje"
            padded={false}
          >
            {sinCerrar.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--success-text)', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={24} />
                Todas las consultas del período quedaron registradas.
              </div>
            ) : (
              <DataTable
                columns={[
                  { key: 'created_at', label: 'Hora', mono: true, width: 70,
                    render: (r: PendienteRow) => <span style={{ color: 'var(--text-3)' }}>{horaDe(r.created_at)}</span> },
                  { key: 'fecha', label: 'Fecha', mono: true, width: 100,
                    render: (r: PendienteRow) => <span style={{ color: 'var(--text-3)' }}>{r.fecha ? new Date(r.fecha).toLocaleDateString('es-AR') : '—'}</span> },
                  { key: 'dni', label: 'DNI', mono: true, sortable: true },
                  { key: 'nombre', label: 'Nombre', sortable: true,
                    render: (r: PendienteRow) => <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{r.nombre || '—'}</span> },
                  { key: 'tipo', label: 'Tipo',
                    render: (r: PendienteRow) => r.tipo === 'familiar'
                      ? <Badge tone="info" size="sm">Familiar{r.relacion ? ` · ${r.relacion}` : ''}</Badge>
                      : <Badge tone="neutral" size="sm">Titular</Badge> },
                  { key: 'comercio', label: 'Boletería', sortable: true,
                    render: (r: PendienteRow) => <span style={{ color: 'var(--text-3)' }}>{r.comercio || '—'}</span> },
                ]}
                data={sinCerrar}
                rowKey={(r: PendienteRow) => r.id}
                searchPlaceholder="Buscar DNI o nombre…"
                pageSize={20}
                empty={{ title: 'Sin pendientes' }}
              />
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'warn' }) {
  const color = tone === 'ok' ? 'var(--success-text)' : tone === 'warn' ? 'var(--warning)' : 'var(--text-1)';
  return (
    <div style={{ padding: 16, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
      <p style={{ fontSize: '11.5px', color: 'var(--text-3)', fontWeight: 500, marginBottom: 8 }}>{label}</p>
      <div style={{ fontSize: '26px', fontWeight: 700, color, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {sub && <p style={{ fontSize: '10.5px', color: 'var(--text-4)', marginTop: 6 }}>{sub}</p>}
    </div>
  );
}

function EmptySmall({ msg }: { msg: string }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: '12.5px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <Search size={20} style={{ opacity: 0.5 }} />
      {msg}
    </div>
  );
}

function btnGhost(): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', padding: '6px 12px', height: 32,
    background: 'transparent', color: 'var(--text-2)',
    border: '1px solid var(--border-default)', borderRadius: '6px',
    fontSize: '12.5px', fontWeight: 500, cursor: 'pointer',
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
    color: 'var(--text-1)', fontSize: '12.5px', outline: 'none', colorScheme: 'dark',
  };
}
