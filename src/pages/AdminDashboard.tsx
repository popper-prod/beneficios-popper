import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://beneficios-backend-jfpx.onrender.com/api';

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

type Tab = 'dashboard' | 'verificaciones' | 'beneficios' | 'comercios' | 'beneficiarios' | 'qrcodes';

const gold = '#bfa363';

// ============================================
// MODAL GENERICO
// ============================================
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl p-6" style={{ background: '#0f1929', border: '1px solid rgba(191,163,99,0.15)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[16px] font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 text-xl">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ============================================
// INPUT FIELD
// ============================================
function Field({ label, value, onChange, type = 'text', placeholder, required, options }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean;
  options?: { value: string; label: string }[];
}) {
  const inputStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' };
  return (
    <div className="mb-3">
      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(191,163,99,0.5)' }}>
        {label}{required && <span style={{ color: '#f87171' }}> *</span>}
      </label>
      {options ? (
        <select value={value} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none" style={inputStyle}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none placeholder:text-white/15" style={inputStyle} />
      )}
    </div>
  );
}

// ============================================
// BOTON SUBMIT
// ============================================
function SubmitBtn({ onClick, loading, label }: { onClick: () => void; loading: boolean; label: string }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="w-full py-3 rounded-xl text-[12px] font-bold uppercase tracking-wider transition-all disabled:opacity-50"
      style={{ background: `linear-gradient(135deg, ${gold}, #d4b96e)`, color: '#0a0e14' }}>
      {loading ? 'Guardando...' : label}
    </button>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function AdminDashboard({ token, user, onLogout }: {
  token: string;
  user: any;
  onLogout: () => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [data, setData] = useState<DashboardData | null>(null);
  const [verificaciones, setVerificaciones] = useState<any[]>([]);
  const [beneficios, setBeneficios] = useState<any[]>([]);
  const [comercios, setComercios] = useState<any[]>([]);
  const [beneficiarios, setBeneficiarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modal, setModal] = useState<{ type: 'beneficio' | 'comercio' | 'beneficiario'; mode: 'create' | 'edit'; item?: any } | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [cleanupMsg, setCleanupMsg] = useState('');
  const [cleaningUp, setCleaningUp] = useState(false);

  // Form state
  const [form, setForm] = useState<Record<string, string>>({});

  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/admin/dashboard`, { headers });
      if (res.ok) setData(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [token]);

  const fetchVerificaciones = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/verificaciones`, { headers });
      if (res.ok) { const d = await res.json(); setVerificaciones(d.verificaciones); }
    } catch (e) { console.error(e); }
  };

  const fetchBeneficios = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/beneficios`, { headers });
      if (res.ok) { const d = await res.json(); setBeneficios(d.beneficios); }
    } catch (e) { console.error(e); }
  };

  const fetchComercios = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/comercios`, { headers });
      if (res.ok) { const d = await res.json(); setComercios(d.comercios); }
    } catch (e) { console.error(e); }
  };

  const fetchBeneficiarios = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/beneficiarios`, { headers });
      if (res.ok) { const d = await res.json(); setBeneficiarios(d.beneficiarios); }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  useEffect(() => {
    if (activeTab === 'verificaciones') fetchVerificaciones();
    if (activeTab === 'beneficios') fetchBeneficios();
    if (activeTab === 'comercios' || activeTab === 'qrcodes') fetchComercios();
    if (activeTab === 'beneficiarios') fetchBeneficiarios();
  }, [activeTab]);

  // ============================================
  // MODAL HANDLERS
  // ============================================
  const openCreate = (type: 'beneficio' | 'comercio' | 'beneficiario') => {
    setMsg('');
    if (type === 'beneficio') {
      setForm({ nombre: '', descripcion: '', tipo: 'descuento', nivel_minimo: 'bronce', descuento: '', valor_fijo: '', fecha_inicio: '2024-01-01', fecha_fin: '2027-12-31', horario_inicio: '08:00', horario_fin: '22:00', limite_uso_diario: '', limite_uso_mensual: '' });
    } else if (type === 'comercio') {
      setForm({ nombre: '', direccion: '', ciudad: 'Buenos Aires', provincia: 'Buenos Aires', telefono: '', email: '', horario_apertura: '08:00', horario_cierre: '22:00', responsable: '' });
    } else {
      setForm({ dni: '', nombre: '', apellido: '', email: '', telefono: '', nivel: 'bronce', departamento: '', empresa: 'Grupo Popper' });
    }
    setModal({ type, mode: 'create' });
  };

  const openEdit = (type: 'beneficio' | 'comercio' | 'beneficiario', item: any) => {
    setMsg('');
    if (type === 'beneficio') {
      setForm({
        nombre: item.nombre || '', descripcion: item.descripcion || '', tipo: item.tipo || 'descuento',
        nivel_minimo: item.nivel_minimo || 'bronce', descuento: item.descuento || '', valor_fijo: item.valor_fijo || '',
        fecha_inicio: item.fecha_inicio?.split('T')[0] || '', fecha_fin: item.fecha_fin?.split('T')[0] || '',
        horario_inicio: item.horario_inicio || '', horario_fin: item.horario_fin || '',
        limite_uso_diario: item.limite_uso_diario?.toString() || '', limite_uso_mensual: item.limite_uso_mensual?.toString() || '',
        activo: item.activo ? 'true' : 'false',
      });
    } else if (type === 'comercio') {
      setForm({
        nombre: item.nombre || '', direccion: item.direccion || '', ciudad: item.ciudad || '', provincia: item.provincia || '',
        telefono: item.telefono || '', email: item.email || '', horario_apertura: item.horario_apertura || '',
        horario_cierre: item.horario_cierre || '', responsable: item.responsable || '', activo: item.activo ? 'true' : 'false',
      });
    } else {
      setForm({
        nombre: item.nombre || '', apellido: item.apellido || '', email: item.email || '', telefono: item.telefono || '',
        nivel: item.nivel || 'bronce', departamento: item.departamento || '', empresa: item.empresa || 'Grupo Popper',
        activo: item.activo ? 'true' : 'false',
      });
    }
    setModal({ type, mode: 'edit', item });
  };

  const handleSave = async () => {
    if (!modal) return;
    setSaving(true);
    setMsg('');
    try {
      const endpoint = modal.type === 'beneficio' ? 'beneficios' : modal.type === 'comercio' ? 'comercios' : 'beneficiarios';
      const url = modal.mode === 'create' ? `${API_URL}/admin/${endpoint}` : `${API_URL}/admin/${endpoint}/${modal.item.id}`;
      const method = modal.mode === 'create' ? 'POST' : 'PUT';

      const body: any = { ...form };
      if (body.descuento) body.descuento = parseFloat(body.descuento);
      if (body.valor_fijo) body.valor_fijo = parseFloat(body.valor_fijo);
      if (body.limite_uso_diario) body.limite_uso_diario = parseInt(body.limite_uso_diario);
      if (body.limite_uso_mensual) body.limite_uso_mensual = parseInt(body.limite_uso_mensual);
      if (body.activo !== undefined) body.activo = body.activo === 'true';

      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error || 'Error'); setSaving(false); return; }

      setModal(null);
      if (modal.type === 'beneficio') fetchBeneficios();
      if (modal.type === 'comercio') fetchComercios();
      if (modal.type === 'beneficiario') fetchBeneficiarios();
    } catch (e: any) {
      setMsg(e.message || 'Error de conexion');
    }
    setSaving(false);
  };

  const handleDelete = async (type: 'beneficio' | 'comercio' | 'beneficiario', id: string, nombre: string) => {
    if (!confirm(`Eliminar "${nombre}"?`)) return;
    try {
      const endpoint = type === 'beneficio' ? 'beneficios' : type === 'comercio' ? 'comercios' : 'beneficiarios';
      const res = await fetch(`${API_URL}/admin/${endpoint}/${id}`, { method: 'DELETE', headers });
      if (res.ok) {
        if (type === 'beneficio') fetchBeneficios();
        if (type === 'comercio') fetchComercios();
        if (type === 'beneficiario') fetchBeneficiarios();
      }
    } catch (e) { console.error(e); }
  };

  // Exportar CSV
  const handleExportCSV = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/exportar-verificaciones`, { headers });
      if (!res.ok) { alert('Error al exportar'); return; }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `verificaciones_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch { alert('Error de conexion al exportar'); }
  };

  // Limpiar duplicados
  const handleCleanup = async () => {
    if (!confirm('Limpiar verificaciones duplicadas? Esta accion no se puede deshacer.')) return;
    setCleaningUp(true);
    setCleanupMsg('');
    try {
      const res = await fetch(`${API_URL}/admin/limpiar-duplicados`, { method: 'POST', headers });
      const data = await res.json();
      if (res.ok) {
        setCleanupMsg(`Limpieza completada: ${data.duplicadosEliminados || 0} duplicados eliminados.`);
        fetchVerificaciones();
        fetchDashboard();
      } else {
        setCleanupMsg(data.error || 'Error al limpiar');
      }
    } catch { setCleanupMsg('Error de conexion'); }
    setCleaningUp(false);
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'verificaciones', label: 'Movimiento', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { id: 'beneficios', label: 'Beneficios', icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7' },
    { id: 'comercios', label: 'Comercios', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { id: 'beneficiarios', label: 'Colaboradores', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
    { id: 'qrcodes', label: 'QR Codes', icon: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z' },
  ];

  const formatDate = (d: string) => new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const baseUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}`
    : 'https://beneficios.recluta.com.ar/';

  const nivelOptions = [
    { value: 'bronce', label: 'Bronce' }, { value: 'plata', label: 'Plata' },
    { value: 'oro', label: 'Oro' }, { value: 'platinum', label: 'Platinum' },
  ];

  const addBtn = (label: string, onClick: () => void) => (
    <button onClick={onClick} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all"
      style={{ background: `linear-gradient(135deg, ${gold}, #d4b96e)`, color: '#0a0e14' }}>
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
      {label}
    </button>
  );

  const actionBtns = (type: 'beneficio' | 'comercio' | 'beneficiario', item: any) => (
    <div className="flex gap-1.5 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <button onClick={() => openEdit(type, item)} className="flex-1 py-2 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all"
        style={{ color: gold, border: `1px solid rgba(191,163,99,0.2)`, background: 'rgba(191,163,99,0.05)' }}>
        Editar
      </button>
      <button onClick={() => handleDelete(type, item.id, item.nombre)} className="flex-1 py-2 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all"
        style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.05)' }}>
        Eliminar
      </button>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: '#080e1a' }}>
      {/* Top bar */}
      <div className="border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(15,25,42,0.8)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ border: `1px solid rgba(191,163,99,0.25)` }}>
              <span className="text-[11px] font-bold" style={{ color: gold }}>GP</span>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-white">Panel RRHH</p>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Grupo Popper</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {user?.nombre} {user?.apellido}
            </p>
            <button onClick={onLogout} className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
              style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(220,38,38,0.3)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}>
              Salir
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b overflow-x-auto" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        <div className="max-w-7xl mx-auto px-4 flex gap-1">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-4 py-3 text-[12px] font-medium transition-all whitespace-nowrap"
              style={{
                color: activeTab === tab.id ? gold : 'rgba(255,255,255,0.35)',
                borderBottom: activeTab === tab.id ? `2px solid ${gold}` : '2px solid transparent',
              }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* ====== DASHBOARD ====== */}
        {activeTab === 'dashboard' && (
          loading ? (
            <div className="flex justify-center py-20">
              <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(191,163,99,0.15)', borderTopColor: gold }} />
            </div>
          ) : data && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Hoy', value: data.stats.verificacionesHoy, color: '#4ade80' },
                  { label: 'Semana', value: data.stats.verificacionesSemana, color: '#60a5fa' },
                  { label: 'Mes', value: data.stats.verificacionesMes, color: gold },
                  { label: 'Colaboradores', value: data.stats.totalBeneficiarios, color: '#a78bfa' },
                  { label: 'Comercios', value: data.stats.totalComercios, color: '#f472b6' },
                  { label: 'Beneficios', value: data.stats.totalBeneficios, color: '#fb923c' },
                ].map(s => (
                  <div key={s.label} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.label}</p>
                    <p className="text-[28px] font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-4" style={{ color: 'rgba(191,163,99,0.5)' }}>Top beneficios (30 dias)</p>
                  {data.topBeneficios.length === 0 ? (
                    <p className="text-[13px] py-4" style={{ color: 'rgba(255,255,255,0.2)' }}>Sin datos aun</p>
                  ) : data.topBeneficios.map((b, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-bold w-5 text-center" style={{ color: gold }}>{i + 1}</span>
                        <span className="text-[13px] text-white">{b.nombre}</span>
                      </div>
                      <span className="text-[13px] font-semibold" style={{ color: '#4ade80' }}>{b.total_usos}</span>
                    </div>
                  ))}
                </div>

                <div className="p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-4" style={{ color: 'rgba(191,163,99,0.5)' }}>Top comercios (30 dias)</p>
                  {data.topComercios.length === 0 ? (
                    <p className="text-[13px] py-4" style={{ color: 'rgba(255,255,255,0.2)' }}>Sin datos aun</p>
                  ) : data.topComercios.map((c, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-bold w-5 text-center" style={{ color: gold }}>{i + 1}</span>
                        <span className="text-[13px] text-white">{c.nombre}</span>
                      </div>
                      <span className="text-[13px] font-semibold" style={{ color: '#60a5fa' }}>{c.total_usos}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-4" style={{ color: 'rgba(191,163,99,0.5)' }}>Ultimo movimiento</p>
                {data.ultimasVerificaciones.length === 0 ? (
                  <p className="text-[13px] py-8 text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>No hay verificaciones registradas</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          {['Fecha', 'Colaborador', 'DNI', 'Beneficio', 'Comercio', 'Estado', 'Codigo'].map(h => (
                            <th key={h} className="text-left py-2 px-2 font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.ultimasVerificaciones.map(v => (
                          <tr key={v.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td className="py-2.5 px-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{formatDate(v.fecha_verificacion)}</td>
                            <td className="py-2.5 px-2 text-white font-medium">{v.beneficiario_nombre} {v.beneficiario_apellido}</td>
                            <td className="py-2.5 px-2 font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{v.dni}</td>
                            <td className="py-2.5 px-2" style={{ color: gold }}>{v.beneficio_nombre}</td>
                            <td className="py-2.5 px-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{v.comercio_nombre}</td>
                            <td className="py-2.5 px-2">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                style={{ background: v.estado === 'exitoso' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: v.estado === 'exitoso' ? '#4ade80' : '#f87171' }}>
                                {v.estado}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{v.codigo_referencia}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {/* ====== VERIFICACIONES ====== */}
        {activeTab === 'verificaciones' && (
          <div className="p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(191,163,99,0.5)' }}>
                Historial completo ({verificaciones.length})
              </p>
              <div className="flex items-center gap-2">
                <button onClick={handleExportCSV}
                  className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all"
                  style={{ color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)', background: 'rgba(74,222,128,0.05)' }}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Exportar CSV
                </button>
                <button onClick={handleCleanup} disabled={cleaningUp}
                  className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all disabled:opacity-50"
                  style={{ color: '#fb923c', border: '1px solid rgba(251,146,60,0.2)', background: 'rgba(251,146,60,0.05)' }}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  {cleaningUp ? 'Limpiando...' : 'Limpiar duplicados'}
                </button>
                <button onClick={fetchVerificaciones} className="text-[11px] px-3 py-1.5 rounded-lg"
                  style={{ color: gold, border: `1px solid rgba(191,163,99,0.2)` }}>
                  Actualizar
                </button>
              </div>
            </div>
            {cleanupMsg && (
              <div className="mb-4 p-3 rounded-lg" style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.15)' }}>
                <p className="text-[12px] text-center" style={{ color: '#fb923c' }}>{cleanupMsg}</p>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['Fecha', 'Colaborador', 'DNI', 'Nivel', 'Beneficio', 'Comercio', 'Estado', 'Codigo'].map(h => (
                      <th key={h} className="text-left py-2 px-2 font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {verificaciones.map(v => (
                    <tr key={v.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td className="py-2.5 px-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{formatDate(v.fecha_verificacion)}</td>
                      <td className="py-2.5 px-2 text-white font-medium">{v.beneficiario_nombre} {v.beneficiario_apellido}</td>
                      <td className="py-2.5 px-2 font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{v.dni}</td>
                      <td className="py-2.5 px-2">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase" style={{ background: 'rgba(191,163,99,0.1)', color: gold }}>
                          {v.nivel}
                        </span>
                      </td>
                      <td className="py-2.5 px-2" style={{ color: gold }}>{v.beneficio_nombre}</td>
                      <td className="py-2.5 px-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{v.comercio_nombre}</td>
                      <td className="py-2.5 px-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{ background: v.estado === 'exitoso' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: v.estado === 'exitoso' ? '#4ade80' : '#f87171' }}>
                          {v.estado}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{v.codigo_referencia}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {verificaciones.length === 0 && (
                <p className="text-center py-12 text-[13px]" style={{ color: 'rgba(255,255,255,0.2)' }}>No hay verificaciones registradas</p>
              )}
            </div>
          </div>
        )}

        {/* ====== BENEFICIOS ====== */}
        {activeTab === 'beneficios' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(191,163,99,0.5)' }}>
                Beneficios ({beneficios.length})
              </p>
              {addBtn('Nuevo beneficio', () => openCreate('beneficio'))}
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {beneficios.map(b => (
                <div key={b.id} className="p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-[14px] font-semibold text-white pr-2">{b.nombre}</h3>
                    <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                      style={{ background: b.activo ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: b.activo ? '#4ade80' : '#f87171' }}>
                      {b.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <p className="text-[12px] mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>{b.descripcion}</p>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between"><span style={{ color: 'rgba(255,255,255,0.3)' }}>Nivel min.</span><span style={{ color: gold }}>{b.nivel_minimo}</span></div>
                    {b.descuento && <div className="flex justify-between"><span style={{ color: 'rgba(255,255,255,0.3)' }}>Descuento</span><span className="font-bold" style={{ color: '#4ade80' }}>{b.descuento}%</span></div>}
                    <div className="flex justify-between"><span style={{ color: 'rgba(255,255,255,0.3)' }}>Usos</span><span className="text-white font-medium">{b.uso_actual || 0}</span></div>
                    <div className="flex justify-between"><span style={{ color: 'rgba(255,255,255,0.3)' }}>Horario</span><span style={{ color: 'rgba(255,255,255,0.5)' }}>{b.horario_inicio || '-'} a {b.horario_fin || '-'}</span></div>
                  </div>
                  {actionBtns('beneficio', b)}
                </div>
              ))}
              {beneficios.length === 0 && (
                <p className="col-span-full text-center py-12 text-[13px]" style={{ color: 'rgba(255,255,255,0.2)' }}>No hay beneficios</p>
              )}
            </div>
          </div>
        )}

        {/* ====== COMERCIOS ====== */}
        {activeTab === 'comercios' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(191,163,99,0.5)' }}>
                Comercios ({comercios.length})
              </p>
              {addBtn('Nuevo comercio', () => openCreate('comercio'))}
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {comercios.map(c => (
                <div key={c.id} className="p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-[14px] font-semibold text-white">{c.nombre}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                      style={{ background: c.activo ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: c.activo ? '#4ade80' : '#f87171' }}>
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="space-y-1 text-[11px] mb-3">
                    <p style={{ color: 'rgba(255,255,255,0.4)' }}>{c.direccion}, {c.ciudad}</p>
                    <p style={{ color: 'rgba(255,255,255,0.3)' }}>Responsable: {c.responsable}</p>
                    <p style={{ color: 'rgba(255,255,255,0.3)' }}>Horario: {c.horario_apertura} - {c.horario_cierre}</p>
                    {c.telefono && <p style={{ color: 'rgba(255,255,255,0.3)' }}>Tel: {c.telefono}</p>}
                  </div>
                  <div className="p-2.5 rounded-lg" style={{ background: 'rgba(191,163,99,0.05)', border: '1px solid rgba(191,163,99,0.1)' }}>
                    <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(191,163,99,0.5)' }}>Codigo QR</p>
                    <p className="text-[12px] font-mono mt-0.5" style={{ color: gold }}>{c.qr_code}</p>
                  </div>
                  {actionBtns('comercio', c)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ====== BENEFICIARIOS ====== */}
        {activeTab === 'beneficiarios' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(191,163,99,0.5)' }}>
                Colaboradores ({beneficiarios.length})
              </p>
              {addBtn('Nuevo colaborador', () => openCreate('beneficiario'))}
            </div>
            <div className="p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {['DNI', 'Nombre', 'Email', 'Nivel', 'Departamento', 'Empresa', 'Estado', 'Acciones'].map(h => (
                        <th key={h} className="text-left py-2 px-2 font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {beneficiarios.map(b => (
                      <tr key={b.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td className="py-2.5 px-2 font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>{b.dni}</td>
                        <td className="py-2.5 px-2 text-white font-medium">{b.nombre} {b.apellido}</td>
                        <td className="py-2.5 px-2" style={{ color: 'rgba(255,255,255,0.4)' }}>{b.email || '-'}</td>
                        <td className="py-2.5 px-2">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase" style={{ background: 'rgba(191,163,99,0.1)', color: gold }}>
                            {b.nivel}
                          </span>
                        </td>
                        <td className="py-2.5 px-2" style={{ color: 'rgba(255,255,255,0.4)' }}>{b.departamento || '-'}</td>
                        <td className="py-2.5 px-2" style={{ color: 'rgba(255,255,255,0.4)' }}>{b.empresa || '-'}</td>
                        <td className="py-2.5 px-2">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                            style={{ background: b.activo ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: b.activo ? '#4ade80' : '#f87171' }}>
                            {b.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="py-2.5 px-2">
                          <div className="flex gap-1">
                            <button onClick={() => openEdit('beneficiario', b)} className="px-2 py-1 rounded text-[9px] font-semibold" style={{ color: gold, border: '1px solid rgba(191,163,99,0.2)' }}>Editar</button>
                            <button onClick={() => handleDelete('beneficiario', b.id, `${b.nombre} ${b.apellido}`)} className="px-2 py-1 rounded text-[9px] font-semibold" style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {beneficiarios.length === 0 && (
                  <p className="text-center py-12 text-[13px]" style={{ color: 'rgba(255,255,255,0.2)' }}>No hay colaboradores registrados</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ====== QR CODES ====== */}
        {activeTab === 'qrcodes' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {comercios.filter(c => c.activo).map(c => {
              const qrUrl = `${baseUrl}#/qr/${c.qr_code}`;
              return (
                <div key={c.id} className="p-6 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <h3 className="text-[14px] font-semibold text-white mb-1">{c.nombre}</h3>
                  <p className="text-[11px] mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>{c.direccion}</p>
                  <div className="w-48 h-48 mx-auto bg-white rounded-xl p-3 mb-4 flex items-center justify-center">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUrl)}&bgcolor=ffffff&color=0a0e14`}
                      alt={`QR ${c.nombre}`}
                      className="w-full h-full"
                    />
                  </div>
                  <p className="text-[10px] font-mono mb-3 break-all" style={{ color: 'rgba(255,255,255,0.25)' }}>{qrUrl}</p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(qrUrl); }}
                    className="px-4 py-2 rounded-lg text-[11px] font-medium transition-all"
                    style={{ color: gold, border: `1px solid rgba(191,163,99,0.2)` }}>
                    Copiar URL
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ====== MODALES ====== */}

      {/* Modal Beneficio */}
      <Modal open={modal?.type === 'beneficio'} onClose={() => setModal(null)} title={modal?.mode === 'create' ? 'Nuevo Beneficio' : 'Editar Beneficio'}>
        <Field label="Nombre" value={form.nombre || ''} onChange={v => setForm({ ...form, nombre: v })} required />
        <Field label="Descripcion" value={form.descripcion || ''} onChange={v => setForm({ ...form, descripcion: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo" value={form.tipo || 'descuento'} onChange={v => setForm({ ...form, tipo: v })}
            options={[{ value: 'descuento', label: 'Descuento' }, { value: 'acceso', label: 'Acceso' }, { value: 'promocion', label: 'Promocion' }, { value: 'regalo', label: 'Regalo' }]} />
          <Field label="Nivel minimo" value={form.nivel_minimo || 'bronce'} onChange={v => setForm({ ...form, nivel_minimo: v })} options={nivelOptions} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Descuento %" value={form.descuento || ''} onChange={v => setForm({ ...form, descuento: v })} type="number" placeholder="15" />
          <Field label="Valor fijo $" value={form.valor_fijo || ''} onChange={v => setForm({ ...form, valor_fijo: v })} type="number" placeholder="0" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha inicio" value={form.fecha_inicio || ''} onChange={v => setForm({ ...form, fecha_inicio: v })} type="date" required />
          <Field label="Fecha fin" value={form.fecha_fin || ''} onChange={v => setForm({ ...form, fecha_fin: v })} type="date" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Horario inicio" value={form.horario_inicio || ''} onChange={v => setForm({ ...form, horario_inicio: v })} type="time" />
          <Field label="Horario fin" value={form.horario_fin || ''} onChange={v => setForm({ ...form, horario_fin: v })} type="time" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Limite diario" value={form.limite_uso_diario || ''} onChange={v => setForm({ ...form, limite_uso_diario: v })} type="number" />
          <Field label="Limite mensual" value={form.limite_uso_mensual || ''} onChange={v => setForm({ ...form, limite_uso_mensual: v })} type="number" />
        </div>
        {modal?.mode === 'edit' && (
          <Field label="Estado" value={form.activo || 'true'} onChange={v => setForm({ ...form, activo: v })}
            options={[{ value: 'true', label: 'Activo' }, { value: 'false', label: 'Inactivo' }]} />
        )}
        {msg && <p className="text-[12px] text-center mb-3" style={{ color: '#f87171' }}>{msg}</p>}
        <SubmitBtn onClick={handleSave} loading={saving} label={modal?.mode === 'create' ? 'Crear beneficio' : 'Guardar cambios'} />
      </Modal>

      {/* Modal Comercio */}
      <Modal open={modal?.type === 'comercio'} onClose={() => setModal(null)} title={modal?.mode === 'create' ? 'Nuevo Comercio' : 'Editar Comercio'}>
        <Field label="Nombre" value={form.nombre || ''} onChange={v => setForm({ ...form, nombre: v })} required />
        <Field label="Direccion" value={form.direccion || ''} onChange={v => setForm({ ...form, direccion: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ciudad" value={form.ciudad || ''} onChange={v => setForm({ ...form, ciudad: v })} />
          <Field label="Provincia" value={form.provincia || ''} onChange={v => setForm({ ...form, provincia: v })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefono" value={form.telefono || ''} onChange={v => setForm({ ...form, telefono: v })} />
          <Field label="Email" value={form.email || ''} onChange={v => setForm({ ...form, email: v })} type="email" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Horario apertura" value={form.horario_apertura || ''} onChange={v => setForm({ ...form, horario_apertura: v })} type="time" />
          <Field label="Horario cierre" value={form.horario_cierre || ''} onChange={v => setForm({ ...form, horario_cierre: v })} type="time" />
        </div>
        <Field label="Responsable" value={form.responsable || ''} onChange={v => setForm({ ...form, responsable: v })} />
        {modal?.mode === 'edit' && (
          <Field label="Estado" value={form.activo || 'true'} onChange={v => setForm({ ...form, activo: v })}
            options={[{ value: 'true', label: 'Activo' }, { value: 'false', label: 'Inactivo' }]} />
        )}
        {msg && <p className="text-[12px] text-center mb-3" style={{ color: '#f87171' }}>{msg}</p>}
        <SubmitBtn onClick={handleSave} loading={saving} label={modal?.mode === 'create' ? 'Crear comercio' : 'Guardar cambios'} />
      </Modal>

      {/* Modal Beneficiario */}
      <Modal open={modal?.type === 'beneficiario'} onClose={() => setModal(null)} title={modal?.mode === 'create' ? 'Nuevo Colaborador' : 'Editar Colaborador'}>
        {modal?.mode === 'create' && (
          <Field label="DNI" value={form.dni || ''} onChange={v => setForm({ ...form, dni: v })} placeholder="28348057" required />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre" value={form.nombre || ''} onChange={v => setForm({ ...form, nombre: v })} required />
          <Field label="Apellido" value={form.apellido || ''} onChange={v => setForm({ ...form, apellido: v })} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" value={form.email || ''} onChange={v => setForm({ ...form, email: v })} type="email" />
          <Field label="Telefono" value={form.telefono || ''} onChange={v => setForm({ ...form, telefono: v })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nivel" value={form.nivel || 'bronce'} onChange={v => setForm({ ...form, nivel: v })} options={nivelOptions} required />
          <Field label="Departamento" value={form.departamento || ''} onChange={v => setForm({ ...form, departamento: v })} />
        </div>
        <Field label="Empresa" value={form.empresa || 'Grupo Popper'} onChange={v => setForm({ ...form, empresa: v })} />
        {modal?.mode === 'edit' && (
          <Field label="Estado" value={form.activo || 'true'} onChange={v => setForm({ ...form, activo: v })}
            options={[{ value: 'true', label: 'Activo' }, { value: 'false', label: 'Inactivo' }]} />
        )}
        {msg && <p className="text-[12px] text-center mb-3" style={{ color: '#f87171' }}>{msg}</p>}
        <SubmitBtn onClick={handleSave} loading={saving} label={modal?.mode === 'create' ? 'Crear colaborador' : 'Guardar cambios'} />
      </Modal>
    </div>
  );
}
