import { useState, useEffect, useCallback } from 'react';
import { Stat } from '../components/ui/Stat';
import { Section } from '../components/ui/Section';
import { Empty } from '../components/ui/Empty';
import { PremiumAreaChart, PremiumBarChart } from '../components/ui/Chart';

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

type Tab = 'dashboard' | 'verificaciones' | 'beneficios' | 'comercios' | 'beneficiarios' | 'qrcodes' | 'autorizaciones' | 'permisos';

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

  // Autorizaciones state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [authLogs, setAuthLogs] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMotivo, setBulkMotivo] = useState('');
  const [authMsg, setAuthMsg] = useState('');
  const [migracionDone, setMigracionDone] = useState(false);
  const [motivoModal, setMotivoModal] = useState<{ id: string; nombre: string; accion: 'activar' | 'desactivar' } | null>(null);
  const [motivoInput, setMotivoInput] = useState('');
  const [areas, setAreas] = useState<string[]>([]);
  const [sectores, setSectores] = useState<string[]>([]);
  const [filtroArea, setFiltroArea] = useState('');
  const [filtroSector, setFiltroSector] = useState('');
  const [grupoMotivo, setGrupoMotivo] = useState('');

  // Permisos state
  const [admins, setAdmins] = useState<any[]>([]);
  const [miPerfil, setMiPerfil] = useState<any>(null);
  const [permisoSearch, setPermisoSearch] = useState('');
  const [permisoResultados, setPermisoResultados] = useState<any[]>([]);
  const [searchingPermiso, setSearchingPermiso] = useState(false);
  const [permisoMsg, setPermisoMsg] = useState('');
  const [permisosMigracionDone, setPermisosMigracionDone] = useState(false);

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
    if (activeTab === 'autorizaciones') { fetchBeneficiarios(); fetchAuthLogs(); fetchAreasSectores(); }
    if (activeTab === 'permisos') { fetchAdmins(); fetchMiPerfil(); }
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

  // Autorizaciones: ejecutar migracion
  const handleMigracion = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/migrar-autorizaciones`, { method: 'POST', headers });
      const data = await res.json();
      if (res.ok) { setMigracionDone(true); setAuthMsg('Migracion completada correctamente'); }
      else setAuthMsg(data.error || 'Error en migracion');
    } catch { setAuthMsg('Error de conexion'); }
  };

  // Autorizaciones: sync con Naaloo
  const handleSyncNaaloo = async () => {
    setSyncing(true);
    setSyncResult(null);
    setAuthMsg('Sincronizando con Naaloo... esto puede tomar hasta 1 minuto.');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 55000);
      const res = await fetch(`${API_URL}/admin/sync-naaloo`, { method: 'POST', headers, signal: controller.signal });
      clearTimeout(timeout);
      const data = await res.json();
      if (res.ok) { setSyncResult(data); setAuthMsg(''); fetchBeneficiarios(); fetchAuthLogs(); }
      else setAuthMsg(data.error || 'Error sincronizando');
    } catch {
      // Timeout o error de red — la sync sigue corriendo en el server
      setAuthMsg('La sincronizacion se esta procesando en el servidor. Recarga en unos segundos para ver los resultados.');
      setTimeout(() => { fetchBeneficiarios(); fetchAuthLogs(); }, 5000);
    }
    setSyncing(false);
  };

  // Autorizaciones: cargar areas y sectores
  const fetchAreasSectores = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/areas-sectores`, { headers });
      if (res.ok) { const d = await res.json(); setAreas(d.areas || []); setSectores(d.sectores || []); }
    } catch { /* silencioso */ }
  };

  // Autorizaciones: bloquear/desbloquear por grupo
  const handleGrupoAutorizar = async (tipo: 'departamento' | 'sector', valor: string, accion: 'activar' | 'desactivar') => {
    const motivo = grupoMotivo || `${accion === 'desactivar' ? 'Bloqueo' : 'Desbloqueo'} por ${tipo}: ${valor}`;
    if (accion === 'desactivar' && !confirm(`${accion === 'desactivar' ? 'Bloquear' : 'Desbloquear'} todos los colaboradores de ${tipo} "${valor}"?\nMotivo: ${motivo}`)) return;
    try {
      const res = await fetch(`${API_URL}/admin/autorizar-grupo`, {
        method: 'POST', headers,
        body: JSON.stringify({ tipo, valor, accion, motivo }),
      });
      const data = await res.json();
      if (res.ok) {
        setAuthMsg(`${data.procesados} colaborador(es) ${accion === 'desactivar' ? 'bloqueados' : 'desbloqueados'} en ${tipo} "${valor}"`);
        fetchBeneficiarios(); fetchAuthLogs();
      } else setAuthMsg(data.error || 'Error');
    } catch { setAuthMsg('Error de conexion'); }
  };

  // ============================================
  // PERMISOS: gestión de admins
  // ============================================
  const fetchAdmins = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/admins`, { headers });
      if (res.ok) { const d = await res.json(); setAdmins(d.admins || []); }
    } catch { /* silencioso */ }
  };

  const fetchMiPerfil = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/mi-perfil`, { headers });
      if (res.ok) setMiPerfil(await res.json());
    } catch { /* silencioso */ }
  };

  const handleMigrarPermisos = async () => {
    setPermisoMsg('Ejecutando migracion...');
    try {
      const res = await fetch(`${API_URL}/admin/migrar-permisos`, { method: 'POST', headers });
      const data = await res.json();
      if (res.ok) {
        setPermisoMsg('Migracion completada. ' + (data.superAdminInicial ? 'Pedro asignado como super-admin.' : ''));
        setPermisosMigracionDone(true);
        fetchAdmins(); fetchMiPerfil();
      } else setPermisoMsg(data.error || 'Error');
    } catch { setPermisoMsg('Error de conexion'); }
  };

  const handleBuscarPermiso = async (q: string) => {
    setPermisoSearch(q);
    if (q.trim().length < 2) { setPermisoResultados([]); return; }
    setSearchingPermiso(true);
    try {
      const res = await fetch(`${API_URL}/admin/admins/buscar?q=${encodeURIComponent(q)}`, { headers });
      if (res.ok) { const d = await res.json(); setPermisoResultados(d.resultados || []); }
    } catch { /* silencioso */ }
    setSearchingPermiso(false);
  };

  const handleAsignarAdmin = async (beneficiarioId: string, rol: 'admin' | 'super_admin') => {
    setPermisoMsg('');
    try {
      const res = await fetch(`${API_URL}/admin/admins/asignar`, {
        method: 'POST', headers,
        body: JSON.stringify({ beneficiarioId, rol }),
      });
      const data = await res.json();
      if (res.ok) {
        setPermisoMsg(data.mensaje);
        setPermisoSearch(''); setPermisoResultados([]);
        fetchAdmins();
      } else setPermisoMsg(data.error || 'Error');
    } catch { setPermisoMsg('Error de conexion'); }
  };

  const handleRevocarAdmin = async (beneficiarioId: string, nombre: string) => {
    if (!confirm(`Revocar permisos de admin a ${nombre}? Perderá acceso al panel.`)) return;
    setPermisoMsg('');
    try {
      const res = await fetch(`${API_URL}/admin/admins/revocar`, {
        method: 'POST', headers,
        body: JSON.stringify({ beneficiarioId }),
      });
      const data = await res.json();
      if (res.ok) {
        setPermisoMsg(data.mensaje);
        fetchAdmins();
      } else setPermisoMsg(data.error || 'Error');
    } catch { setPermisoMsg('Error de conexion'); }
  };

  // Autorizaciones: logs
  const fetchAuthLogs = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/autorizacion-logs`, { headers });
      if (res.ok) { const d = await res.json(); setAuthLogs(d.logs || []); }
    } catch { /* silencioso */ }
  };

  // Autorizaciones: activar/desactivar individual
  const handleAutorizar = async (beneficiario_id: string, accion: 'activar' | 'desactivar', motivo: string) => {
    try {
      const res = await fetch(`${API_URL}/admin/autorizar`, {
        method: 'POST', headers,
        body: JSON.stringify({ beneficiario_id, accion, motivo }),
      });
      if (res.ok) { fetchBeneficiarios(); fetchAuthLogs(); setMotivoModal(null); setMotivoInput(''); }
      else { const d = await res.json(); setAuthMsg(d.error || 'Error'); }
    } catch { setAuthMsg('Error de conexion'); }
  };

  // Autorizaciones: bulk
  const handleBulkAutorizar = async (accion: 'activar' | 'desactivar') => {
    if (selectedIds.size === 0) return;
    const motivo = bulkMotivo || (accion === 'desactivar' ? 'Desactivacion masiva' : 'Reactivacion masiva');
    if (accion === 'desactivar' && !confirm(`Desactivar ${selectedIds.size} colaborador(es)? Motivo: ${motivo}`)) return;
    try {
      const res = await fetch(`${API_URL}/admin/autorizar-bulk`, {
        method: 'POST', headers,
        body: JSON.stringify({ ids: Array.from(selectedIds), accion, motivo }),
      });
      const data = await res.json();
      if (res.ok) {
        setAuthMsg(`${data.procesados} colaborador(es) ${accion === 'desactivar' ? 'desactivados' : 'activados'} correctamente`);
        setSelectedIds(new Set());
        setBulkMotivo('');
        fetchBeneficiarios();
        fetchAuthLogs();
      } else setAuthMsg(data.error || 'Error');
    } catch { setAuthMsg('Error de conexion'); }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === beneficiarios.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(beneficiarios.map((b: any) => b.id)));
    }
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
    { id: 'autorizaciones', label: 'Autorizaciones', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
    { id: 'permisos', label: 'Permisos', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
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

  // actionBtns reemplazado por CardActions premium al final del archivo

  const userInitials = ((user?.nombre?.[0] || '') + (user?.apellido?.[0] || '')).toUpperCase() || 'GP';

  return (
    <div className="min-h-screen relative" style={{ background: '#080e1a' }}>
      {/* Glow dorado superior sutil */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[300px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, rgba(191,163,99,0.05), transparent 65%)',
          filter: 'blur(40px)',
        }}
      />

      {/* ====== TOP BAR PREMIUM ====== */}
      <header
        className="sticky top-0 z-20 border-b"
        style={{
          borderColor: 'rgba(255,255,255,0.05)',
          background: 'linear-gradient(180deg, rgba(15,25,42,0.92) 0%, rgba(8,14,26,0.85) 100%)',
          backdropFilter: 'blur(24px)',
        }}
      >
        {/* Edge dorado superior */}
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(212,185,120,0.25) 30%, rgba(212,185,120,0.25) 70%, transparent)' }}
        />
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgba(191,163,99,0.18), transparent 70%)',
                  filter: 'blur(6px)',
                  transform: 'scale(1.4)',
                }}
              />
              <div
                className="relative w-9 h-9 rounded-full flex items-center justify-center"
                style={{
                  border: '1px solid rgba(191,163,99,0.4)',
                  background: 'radial-gradient(circle at 30% 30%, rgba(212,185,120,0.08), rgba(8,14,26,0.4))',
                  boxShadow: '0 0 16px rgba(191,163,99,0.1), inset 0 1px 0 rgba(212,185,120,0.15)',
                }}
              >
                <span
                  style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#d4b978',
                    letterSpacing: '-0.02em',
                  }}
                >
                  GP
                </span>
              </div>
            </div>
            <div className="hidden sm:block">
              <p
                className="leading-tight"
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: '15px',
                  fontWeight: 600,
                  color: 'rgba(245,241,232,0.95)',
                  letterSpacing: '0.02em',
                }}
              >
                Grupo Popper
              </p>
              <p
                className="text-[9px] mt-0.5"
                style={{
                  color: 'rgba(191,163,99,0.55)',
                  letterSpacing: '0.32em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                Panel Administrativo
              </p>
            </div>
          </div>

          {/* User + Logout */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(212,185,120,0.15), rgba(191,163,99,0.08))',
                  border: '1px solid rgba(191,163,99,0.25)',
                  color: '#d4b978',
                  fontWeight: 600,
                  fontSize: '12px',
                  fontFamily: "'Playfair Display', Georgia, serif",
                }}
              >
                {userInitials}
              </div>
              <div className="hidden md:block text-right">
                <p
                  className="text-[13px] leading-tight"
                  style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}
                >
                  {user?.nombre} {user?.apellido}
                </p>
                <p
                  className="text-[10px] mt-0.5"
                  style={{ color: 'rgba(191,163,99,0.55)', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600 }}
                >
                  {user?.rol === 'super_admin' ? 'Super Admin' : user?.rol === 'admin' ? 'Administrador' : 'Usuario'}
                </p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-semibold transition-all"
              style={{
                color: 'rgba(255,255,255,0.5)',
                border: '1px solid rgba(255,255,255,0.08)',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(232,144,137,0.3)';
                e.currentTarget.style.color = 'rgba(232,144,137,0.9)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* ====== TABS PREMIUM ====== */}
      <nav
        className="sticky top-[64px] z-10 border-b overflow-x-auto"
        style={{
          borderColor: 'rgba(255,255,255,0.04)',
          background: 'rgba(8,14,26,0.85)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 flex gap-0.5">
          {tabs.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative flex items-center gap-2 px-4 py-3.5 text-[12px] font-medium whitespace-nowrap transition-all group"
                style={{
                  color: active ? '#d4b978' : 'rgba(255,255,255,0.4)',
                  letterSpacing: '0.04em',
                  transitionDuration: '320ms',
                  transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                onMouseEnter={e => {
                  if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                }}
                onMouseLeave={e => {
                  if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.4)';
                }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                </svg>
                <span>{tab.label}</span>
                {/* Underline animado */}
                <span
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] rounded-full transition-all"
                  style={{
                    width: active ? '60%' : '0%',
                    background: 'linear-gradient(90deg, transparent, #d4b978, transparent)',
                    boxShadow: active ? '0 0 8px rgba(212,185,120,0.4)' : 'none',
                    transitionDuration: '500ms',
                    transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              </button>
            );
          })}
        </div>
      </nav>

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-6 py-8">

        {/* ====== DASHBOARD ====== */}
        {activeTab === 'dashboard' && (
          loading ? (
            <DashboardSkeleton />
          ) : data && (
            <PremiumDashboard data={data} user={user} formatDate={formatDate} />
          )
        )}

        {/* ====== VERIFICACIONES ====== */}
        {activeTab === 'verificaciones' && (
          <Section
            eyebrow="Historial completo"
            title={`${verificaciones.length} verificacion${verificaciones.length === 1 ? '' : 'es'} registrada${verificaciones.length === 1 ? '' : 's'}`}
            action={
              <div className="flex items-center gap-2">
                <GhostButton onClick={handleExportCSV} icon="download" tone="success">Exportar CSV</GhostButton>
                <GhostButton onClick={handleCleanup} disabled={cleaningUp} icon="trash" tone="warning">
                  {cleaningUp ? 'Limpiando…' : 'Limpiar duplicados'}
                </GhostButton>
                <GhostButton onClick={fetchVerificaciones} icon="refresh" tone="gold">Actualizar</GhostButton>
              </div>
            }
          >
            {cleanupMsg && (
              <div
                className="mb-4 p-3 rounded-lg"
                style={{ background: 'rgba(224,183,108,0.06)', border: '1px solid rgba(224,183,108,0.18)' }}
              >
                <p className="text-[12.5px] text-center" style={{ color: '#e0b76c' }}>{cleanupMsg}</p>
              </div>
            )}
            {verificaciones.length === 0 ? (
              <Empty
                title="Sin verificaciones aún"
                description="Las verificaciones de tus colaboradores en los comercios adheridos aparecerán acá."
                icon={
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                }
              />
            ) : (
              <PremiumTable
                columns={[
                  { key: 'fecha', label: 'Fecha' },
                  { key: 'colaborador', label: 'Colaborador' },
                  { key: 'dni', label: 'DNI', mono: true },
                  { key: 'nivel', label: 'Nivel' },
                  { key: 'beneficio', label: 'Beneficio', accent: true },
                  { key: 'comercio', label: 'Comercio' },
                  { key: 'estado', label: 'Estado' },
                  { key: 'codigo', label: 'Código', mono: true },
                ]}
                rows={verificaciones.map((v: any) => ({
                  id: v.id,
                  fecha: formatDate(v.fecha_verificacion),
                  colaborador: `${v.beneficiario_nombre} ${v.beneficiario_apellido || ''}`.trim(),
                  dni: v.dni,
                  nivel: <TierBadge nivel={v.nivel} />,
                  beneficio: v.beneficio_nombre,
                  comercio: v.comercio_nombre,
                  estado: <StatusBadge estado={v.estado} />,
                  codigo: v.codigo_referencia,
                }))}
              />
            )}
          </Section>
        )}

        {/* ====== BENEFICIOS ====== */}
        {activeTab === 'beneficios' && (
          <div>
            <PageHeader
              eyebrow="Catálogo"
              title={`${beneficios.length} beneficio${beneficios.length === 1 ? '' : 's'} configurado${beneficios.length === 1 ? '' : 's'}`}
              action={<PrimaryActionButton onClick={() => openCreate('beneficio')}>Nuevo beneficio</PrimaryActionButton>}
            />
            {beneficios.length === 0 ? (
              <Empty
                title="No hay beneficios todavía"
                description="Creá el primer beneficio para que tus colaboradores puedan empezar a canjearlo en los comercios adheridos."
                icon={
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                  </svg>
                }
                action={<PrimaryActionButton onClick={() => openCreate('beneficio')}>Crear primer beneficio</PrimaryActionButton>}
              />
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {beneficios.map(b => (
                  <PremiumCard key={b.id} active={b.activo}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h3
                        className="leading-tight"
                        style={{
                          fontFamily: "'Playfair Display', Georgia, serif",
                          fontSize: '17px',
                          fontWeight: 600,
                          color: 'rgba(255,255,255,0.95)',
                        }}
                      >
                        {b.nombre}
                      </h3>
                      <ActiveBadge active={b.activo} />
                    </div>
                    {b.descripcion && (
                      <p className="text-[12px] mb-4 leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        {b.descripcion}
                      </p>
                    )}
                    {b.descuento && (
                      <div className="mb-4 flex items-baseline gap-1.5">
                        <span
                          style={{
                            fontFamily: "'Playfair Display', Georgia, serif",
                            fontSize: '34px',
                            fontWeight: 600,
                            color: '#d4b978',
                            fontVariantNumeric: 'tabular-nums',
                            letterSpacing: '-0.02em',
                            lineHeight: 1,
                          }}
                        >
                          {b.descuento}
                          <span style={{ fontSize: '18px' }}>%</span>
                        </span>
                        <span
                          className="text-[10px] font-semibold"
                          style={{ color: 'rgba(212,185,120,0.55)', letterSpacing: '0.22em', textTransform: 'uppercase' }}
                        >
                          Descuento
                        </span>
                      </div>
                    )}
                    <div className="space-y-2 text-[11.5px] mb-3">
                      <DataRow label="Nivel mínimo" value={<TierBadge nivel={b.nivel_minimo} />} />
                      <DataRow label="Usos acumulados" value={<span style={{ color: 'rgba(255,255,255,0.85)', fontVariantNumeric: 'tabular-nums' }}>{b.uso_actual || 0}</span>} />
                      <DataRow label="Horario" value={<span style={{ color: 'rgba(255,255,255,0.6)', fontVariantNumeric: 'tabular-nums' }}>{b.horario_inicio || '—'} a {b.horario_fin || '—'}</span>} />
                    </div>
                    <CardActions onEdit={() => openEdit('beneficio', b)} onDelete={() => handleDelete('beneficio', b.id, b.nombre)} />
                  </PremiumCard>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ====== COMERCIOS ====== */}
        {activeTab === 'comercios' && (
          <div>
            <PageHeader
              eyebrow="Red de comercios"
              title={`${comercios.length} comercio${comercios.length === 1 ? '' : 's'} adherido${comercios.length === 1 ? '' : 's'}`}
              action={<PrimaryActionButton onClick={() => openCreate('comercio')}>Nuevo comercio</PrimaryActionButton>}
            />
            {comercios.length === 0 ? (
              <Empty
                title="Aún no hay comercios"
                description="Agregá el primer comercio para empezar a generar códigos QR que tus colaboradores puedan escanear."
                icon={
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                  </svg>
                }
                action={<PrimaryActionButton onClick={() => openCreate('comercio')}>Agregar primer comercio</PrimaryActionButton>}
              />
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {comercios.map(c => (
                  <PremiumCard key={c.id} active={c.activo}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0 flex-1">
                        <h3
                          className="leading-tight"
                          style={{
                            fontFamily: "'Playfair Display', Georgia, serif",
                            fontSize: '18px',
                            fontWeight: 600,
                            color: 'rgba(255,255,255,0.95)',
                          }}
                        >
                          {c.nombre}
                        </h3>
                        <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {c.direccion}, {c.ciudad}
                        </p>
                      </div>
                      <ActiveBadge active={c.activo} />
                    </div>
                    <div className="space-y-1.5 text-[11.5px] mb-4">
                      {c.responsable && <DataRow label="Responsable" value={<span style={{ color: 'rgba(255,255,255,0.75)' }}>{c.responsable}</span>} />}
                      <DataRow
                        label="Horario"
                        value={<span style={{ color: 'rgba(255,255,255,0.6)', fontVariantNumeric: 'tabular-nums' }}>{c.horario_apertura} – {c.horario_cierre}</span>}
                      />
                      {c.telefono && (
                        <DataRow label="Teléfono" value={<span style={{ color: 'rgba(255,255,255,0.6)', fontVariantNumeric: 'tabular-nums' }}>{c.telefono}</span>} />
                      )}
                    </div>
                    <div
                      className="relative p-3 rounded-xl overflow-hidden"
                      style={{
                        background: 'linear-gradient(135deg, rgba(212,185,120,0.06) 0%, rgba(191,163,99,0.03) 100%)',
                        border: '1px solid rgba(191,163,99,0.18)',
                      }}
                    >
                      <div
                        className="absolute top-0 left-0 right-0 h-px"
                        style={{ background: 'linear-gradient(90deg, transparent, rgba(212,185,120,0.4), transparent)' }}
                      />
                      <p
                        className="text-[9.5px] font-semibold mb-1"
                        style={{ color: 'rgba(191,163,99,0.6)', letterSpacing: '0.22em', textTransform: 'uppercase' }}
                      >
                        Código QR
                      </p>
                      <p
                        className="text-[13px]"
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          color: '#d4b978',
                          letterSpacing: '0.1em',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {c.qr_code}
                      </p>
                    </div>
                    <CardActions onEdit={() => openEdit('comercio', c)} onDelete={() => handleDelete('comercio', c.id, c.nombre)} />
                  </PremiumCard>
                ))}
              </div>
            )}
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

        {/* ====== AUTORIZACIONES ====== */}
        {activeTab === 'autorizaciones' && (
          <div className="space-y-5">
            {/* Barra de acciones */}
            <div className="p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(191,163,99,0.5)' }}>
                    Sincronizacion con Naaloo
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Detecta bajas, cesantias y nuevas altas automaticamente
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!migracionDone && (
                    <button onClick={handleMigracion}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all"
                      style={{ color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)', background: 'rgba(167,139,250,0.05)' }}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                      </svg>
                      Preparar BD
                    </button>
                  )}
                  <button onClick={handleSyncNaaloo} disabled={syncing}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                    style={{ background: `linear-gradient(135deg, ${gold}, #d4b96e)`, color: '#0a0e14' }}>
                    <svg className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {syncing ? 'Sincronizando...' : 'Sincronizar con Naaloo'}
                  </button>
                </div>
              </div>

              {/* Resultado de sync */}
              {syncResult && (
                <div className="p-4 rounded-xl mt-3" style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)' }}>
                  <p className="text-[12px] font-semibold mb-2" style={{ color: '#4ade80' }}>Sincronizacion completada</p>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-[11px]">
                    <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>Total Naaloo:</span> <span className="text-white font-bold">{syncResult.resumen.totalNaaloo}</span></div>
                    <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>Altas:</span> <span className="font-bold" style={{ color: '#4ade80' }}>{syncResult.resumen.altas}</span></div>
                    <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>Bajas:</span> <span className="font-bold" style={{ color: '#f87171' }}>{syncResult.resumen.bajas}</span></div>
                    <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>Actualizados:</span> <span className="font-bold" style={{ color: '#60a5fa' }}>{syncResult.resumen.actualizados}</span></div>
                    <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>Sin cambios:</span> <span className="text-white">{syncResult.resumen.sinCambios}</span></div>
                  </div>
                  {syncResult.detalles?.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {syncResult.detalles.map((d: any, i: number) => (
                        <p key={i} className="text-[11px]" style={{ color: d.accion === 'baja' ? '#f87171' : '#4ade80' }}>
                          {d.accion === 'baja' ? '⬇' : '⬆'} {d.nombre} ({d.dni}) — {d.accion}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {authMsg && (
                <div className="mt-3 p-3 rounded-lg" style={{ background: 'rgba(191,163,99,0.08)', border: '1px solid rgba(191,163,99,0.15)' }}>
                  <p className="text-[12px] text-center" style={{ color: gold }}>{authMsg}</p>
                </div>
              )}
            </div>

            {/* Bloqueo por area / sector */}
            <div className="p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-4" style={{ color: 'rgba(191,163,99,0.5)' }}>
                Bloqueo por area / sector
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                {/* Bloqueo por Area */}
                <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <p className="text-[11px] font-semibold text-white mb-2">Por Area / Departamento</p>
                  <select
                    value={filtroArea}
                    onChange={e => setFiltroArea(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-[12px] text-white outline-none mb-2"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <option value="">Seleccionar area...</option>
                    {areas.map(a => <option key={a} value={a}>{a} ({beneficiarios.filter((b: any) => b.departamento === a).length})</option>)}
                  </select>
                  {filtroArea && (
                    <div className="space-y-2">
                      <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        <span className="font-semibold text-white">{filtroArea}</span> — {beneficiarios.filter((b: any) => b.departamento === filtroArea && b.activo).length} activos, {beneficiarios.filter((b: any) => b.departamento === filtroArea && !b.activo).length} inactivos
                      </div>
                      <input type="text" placeholder="Motivo (ej: Temporada baja, Reestructuracion...)" value={grupoMotivo}
                        onChange={e => setGrupoMotivo(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-[11px] text-white outline-none placeholder:text-white/20"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
                      <div className="flex gap-2">
                        <button onClick={() => handleGrupoAutorizar('departamento', filtroArea, 'desactivar')}
                          className="flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.05)' }}>
                          Bloquear area
                        </button>
                        <button onClick={() => handleGrupoAutorizar('departamento', filtroArea, 'activar')}
                          className="flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)', background: 'rgba(74,222,128,0.05)' }}>
                          Desbloquear area
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bloqueo por Sector */}
                <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <p className="text-[11px] font-semibold text-white mb-2">Por Sector</p>
                  <select
                    value={filtroSector}
                    onChange={e => setFiltroSector(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-[12px] text-white outline-none mb-2"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <option value="">Seleccionar sector...</option>
                    {sectores.map(s => <option key={s} value={s}>{s} ({beneficiarios.filter((b: any) => b.sector === s).length})</option>)}
                  </select>
                  {filtroSector && (
                    <div className="space-y-2">
                      <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        <span className="font-semibold text-white">{filtroSector}</span> — {beneficiarios.filter((b: any) => b.sector === filtroSector && b.activo).length} activos, {beneficiarios.filter((b: any) => b.sector === filtroSector && !b.activo).length} inactivos
                      </div>
                      <input type="text" placeholder="Motivo (ej: Cierre temporada, Restructuracion...)" value={grupoMotivo}
                        onChange={e => setGrupoMotivo(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-[11px] text-white outline-none placeholder:text-white/20"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
                      <div className="flex gap-2">
                        <button onClick={() => handleGrupoAutorizar('sector', filtroSector, 'desactivar')}
                          className="flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.05)' }}>
                          Bloquear sector
                        </button>
                        <button onClick={() => handleGrupoAutorizar('sector', filtroSector, 'activar')}
                          className="flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)', background: 'rgba(74,222,128,0.05)' }}>
                          Desbloquear sector
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Acciones en bloque */}
            <div className="p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-4" style={{ color: 'rgba(191,163,99,0.5)' }}>
                Gestion manual ({beneficiarios.length} colaboradores) {selectedIds.size > 0 && <span className="text-white">— {selectedIds.size} seleccionados</span>}
              </p>

              {/* Barra de acciones bulk */}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 mb-4 p-3 rounded-lg" style={{ background: 'rgba(191,163,99,0.05)', border: '1px solid rgba(191,163,99,0.1)' }}>
                  <input
                    type="text"
                    placeholder="Motivo (ej: Temporada baja, Rendimiento, Cesantia...)"
                    value={bulkMotivo}
                    onChange={e => setBulkMotivo(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg text-[12px] text-white outline-none placeholder:text-white/20"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                  <button onClick={() => handleBulkAutorizar('desactivar')}
                    className="px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.05)' }}>
                    Desactivar ({selectedIds.size})
                  </button>
                  <button onClick={() => handleBulkAutorizar('activar')}
                    className="px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)', background: 'rgba(74,222,128,0.05)' }}>
                    Activar ({selectedIds.size})
                  </button>
                </div>
              )}

              {/* Tabla de colaboradores con checkboxes */}
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <th className="py-2 px-2 w-8">
                        <input type="checkbox" checked={selectedIds.size === beneficiarios.length && beneficiarios.length > 0}
                          onChange={selectAll} className="accent-amber-500 cursor-pointer" />
                      </th>
                      {['DNI', 'Nombre', 'Nivel', 'Area', 'Sector', 'Estado', 'Motivo baja', 'Acciones'].map(h => (
                        <th key={h} className="text-left py-2 px-2 font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {beneficiarios.map((b: any) => (
                      <tr key={b.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td className="py-2.5 px-2">
                          <input type="checkbox" checked={selectedIds.has(b.id)} onChange={() => toggleSelection(b.id)}
                            className="accent-amber-500 cursor-pointer" />
                        </td>
                        <td className="py-2.5 px-2 font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>{b.dni}</td>
                        <td className="py-2.5 px-2 text-white font-medium">{b.nombre} {b.apellido}</td>
                        <td className="py-2.5 px-2">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase" style={{ background: 'rgba(191,163,99,0.1)', color: gold }}>
                            {b.nivel}
                          </span>
                        </td>
                        <td className="py-2.5 px-2" style={{ color: 'rgba(255,255,255,0.4)' }}>{b.departamento || '-'}</td>
                        <td className="py-2.5 px-2" style={{ color: 'rgba(255,255,255,0.4)' }}>{b.sector || '-'}</td>
                        <td className="py-2.5 px-2">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                            style={{ background: b.activo ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: b.activo ? '#4ade80' : '#f87171' }}>
                            {b.activo ? 'Autorizado' : 'Desactivado'}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {b.motivo_baja || '-'}
                        </td>
                        <td className="py-2.5 px-2">
                          {b.activo ? (
                            <button onClick={() => { setMotivoModal({ id: b.id, nombre: `${b.nombre} ${b.apellido}`, accion: 'desactivar' }); setMotivoInput(''); }}
                              className="px-3 py-1 rounded text-[10px] font-semibold"
                              style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>
                              Desactivar
                            </button>
                          ) : (
                            <button onClick={() => handleAutorizar(b.id, 'activar', 'Reactivacion manual')}
                              className="px-3 py-1 rounded text-[10px] font-semibold"
                              style={{ color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>
                              Activar
                            </button>
                          )}
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

            {/* Historial de autorizaciones */}
            <div className="p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-4" style={{ color: 'rgba(191,163,99,0.5)' }}>
                Historial de autorizaciones ({authLogs.length})
              </p>
              {authLogs.length === 0 ? (
                <p className="text-center py-8 text-[13px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  Sin historial. Ejecuta "Preparar BD" y luego "Sincronizar con Naaloo" para comenzar.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        {['Fecha', 'Colaborador', 'DNI', 'Accion', 'Motivo', 'Autorizado por'].map(h => (
                          <th key={h} className="text-left py-2 px-2 font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {authLogs.map((log: any) => (
                        <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td className="py-2 px-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{formatDate(log.fecha)}</td>
                          <td className="py-2 px-2 text-white font-medium">{log.nombre} {log.apellido}</td>
                          <td className="py-2 px-2 font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{log.dni}</td>
                          <td className="py-2 px-2">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                              style={{
                                background: log.accion.includes('alta') || log.accion === 'activar' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                                color: log.accion.includes('alta') || log.accion === 'activar' ? '#4ade80' : '#f87171',
                              }}>
                              {log.accion}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{log.motivo}</td>
                          <td className="py-2 px-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{log.autorizado_por}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ====== PERMISOS ====== */}
        {activeTab === 'permisos' && (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[20px] font-semibold text-white" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  Permisos de Administracion
                </h2>
                <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Otorga acceso al panel a colaboradores de RRHH. Inician sesion con su email y contrasena de Naaloo.
                </p>
              </div>
              {miPerfil && (
                <div className="flex items-center gap-3 px-4 py-2 rounded-xl" style={{ background: 'rgba(191,163,99,0.05)', border: '1px solid rgba(191,163,99,0.15)' }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(191,163,99,0.1)', color: gold, fontWeight: 700 }}>
                    {miPerfil.nombre?.[0]}{miPerfil.apellido?.[0]}
                  </div>
                  <div>
                    <p className="text-[12px] text-white font-medium">{miPerfil.nombre} {miPerfil.apellido}</p>
                    <p className="text-[10px]" style={{ color: gold }}>
                      {miPerfil.esSuperAdmin ? 'Super Administrador' : (miPerfil.rol_admin || 'Administrador')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Migracion */}
            {!permisosMigracionDone && (
              <div className="p-4 rounded-xl flex items-center justify-between" style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)' }}>
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: '#fbbf24' }}>Primera vez: preparar la base de datos</p>
                  <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Agrega las columnas necesarias para gestionar permisos y asigna a Pedro (DNI 28348057) como super-admin inicial.
                  </p>
                </div>
                <button onClick={handleMigrarPermisos}
                  className="px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider"
                  style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                  Preparar BD
                </button>
              </div>
            )}

            {permisoMsg && (
              <div className="p-3 rounded-lg text-[12px]" style={{
                background: permisoMsg.includes('Error') ? 'rgba(248,113,113,0.08)' : 'rgba(74,222,128,0.08)',
                border: `1px solid ${permisoMsg.includes('Error') ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.2)'}`,
                color: permisoMsg.includes('Error') ? '#f87171' : '#4ade80',
              }}>
                {permisoMsg}
              </div>
            )}

            {/* Buscador para asignar */}
            <div className="p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(191,163,99,0.5)' }}>
                Otorgar permiso a un colaborador
              </p>
              <p className="text-[11px] mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Busca por nombre, apellido, DNI, email o legajo. Solo se muestran colaboradores activos.
              </p>
              <input
                type="text"
                value={permisoSearch}
                onChange={(e) => handleBuscarPermiso(e.target.value)}
                placeholder="Ej: Pedro Suarez, 28348057, pedro@..."
                className="w-full px-4 py-3 rounded-lg text-[13px] text-white outline-none placeholder:text-white/15"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />

              {searchingPermiso && (
                <p className="text-[11px] mt-3" style={{ color: 'rgba(255,255,255,0.3)' }}>Buscando...</p>
              )}

              {permisoResultados.length > 0 && (
                <div className="mt-4 space-y-2">
                  {permisoResultados.map((b: any) => (
                    <div key={b.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {b.foto ? (
                          <img src={b.foto} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold" style={{ background: 'rgba(191,163,99,0.1)', color: gold }}>
                            {b.nombre?.[0]}{b.apellido?.[0]}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-[13px] text-white font-medium truncate">{b.nombre} {b.apellido}</p>
                          <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            {b.email || 'Sin email'} &middot; {b.departamento || 'S/D'} &middot; DNI {b.dni}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {b.es_admin ? (
                          <span className="px-3 py-1 rounded-full text-[9px] font-bold uppercase" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>
                            Ya es {b.rol_admin}
                          </span>
                        ) : !b.email ? (
                          <span className="text-[10px]" style={{ color: 'rgba(248,113,113,0.7)' }}>Falta email</span>
                        ) : (
                          <>
                            <button onClick={() => handleAsignarAdmin(b.id, 'admin')}
                              className="px-3 py-1.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                              style={{ background: 'rgba(191,163,99,0.1)', color: gold, border: '1px solid rgba(191,163,99,0.3)' }}>
                              Admin
                            </button>
                            <button onClick={() => handleAsignarAdmin(b.id, 'super_admin')}
                              className="px-3 py-1.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                              style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                              Super Admin
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {permisoSearch.length >= 2 && !searchingPermiso && permisoResultados.length === 0 && (
                <p className="text-[12px] mt-4 text-center py-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Sin resultados para "{permisoSearch}"
                </p>
              )}
            </div>

            {/* Listado de admins actuales */}
            <div className="p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-4" style={{ color: 'rgba(191,163,99,0.5)' }}>
                Administradores activos ({admins.length})
              </p>
              {admins.length === 0 ? (
                <p className="text-center py-8 text-[13px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  No hay administradores asignados todavia.
                </p>
              ) : (
                <div className="space-y-2">
                  {admins.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {a.foto ? (
                          <img src={a.foto} alt="" className="w-12 h-12 rounded-full object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-full flex items-center justify-center text-[14px] font-bold" style={{ background: 'rgba(191,163,99,0.1)', color: gold }}>
                            {a.nombre?.[0]}{a.apellido?.[0]}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[14px] text-white font-medium truncate">{a.nombre} {a.apellido}</p>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                              style={{
                                background: a.rol_admin === 'super_admin' ? 'rgba(251,191,36,0.1)' : 'rgba(191,163,99,0.1)',
                                color: a.rol_admin === 'super_admin' ? '#fbbf24' : gold,
                              }}>
                              {a.rol_admin === 'super_admin' ? 'Super Admin' : 'Admin'}
                            </span>
                          </div>
                          <p className="text-[11px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            {a.email} &middot; {a.cargo || a.departamento || 'S/D'} &middot; Desde {a.admin_desde ? formatDate(a.admin_desde) : 'S/D'}
                          </p>
                          {a.admin_por && (
                            <p className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                              Asignado por: {a.admin_por}
                            </p>
                          )}
                        </div>
                      </div>
                      {miPerfil?.esSuperAdmin && miPerfil?.email !== a.email && (
                        <button onClick={() => handleRevocarAdmin(a.id, `${a.nombre} ${a.apellido}`)}
                          className="px-3 py-1.5 rounded text-[10px] font-semibold"
                          style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>
                          Revocar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-center text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Los administradores inician sesion con su email y contrasena de Naaloo. Sus beneficios siguen disponibles al escanear QR como cualquier otro colaborador.
            </p>
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

      {/* Modal Motivo de Desactivacion */}
      <Modal open={!!motivoModal} onClose={() => setMotivoModal(null)} title={`Desactivar: ${motivoModal?.nombre || ''}`}>
        <p className="text-[12px] mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
          El colaborador no podra canjear beneficios mientras este desactivado.
        </p>
        <Field label="Motivo de desactivacion" value={motivoInput} onChange={setMotivoInput}
          placeholder="Ej: Temporada baja, Cesantia, Rendimiento, Baja voluntaria..." required />
        <div className="flex gap-3 mt-4">
          <button onClick={() => setMotivoModal(null)}
            className="flex-1 py-3 rounded-xl text-[12px] font-medium"
            style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
            Cancelar
          </button>
          <button
            onClick={() => motivoModal && handleAutorizar(motivoModal.id, 'desactivar', motivoInput || 'Sin motivo especificado')}
            disabled={!motivoInput.trim()}
            className="flex-1 py-3 rounded-xl text-[12px] font-bold uppercase tracking-wider transition-all disabled:opacity-30"
            style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
            Confirmar desactivacion
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ============================================
// PREMIUM DASHBOARD - vista del tab dashboard
// ============================================
function PremiumDashboard({ data, user, formatDate }: { data: DashboardData; user: any; formatDate: (d: string) => string }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const firstName = (user?.nombre || '').split(' ')[0] || 'Bienvenido';

  // Transformar verificaciones por día para el chart
  const chartData = (data.verificacionesPorDia || []).map((d: any) => ({
    label: new Date(d.fecha).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit' }),
    value: parseInt(d.total),
  }));

  // Top beneficios y comercios como bar charts
  const topBeneficiosChart = data.topBeneficios.slice(0, 5).map((b: any) => ({
    label: b.nombre.length > 18 ? b.nombre.substring(0, 16) + '…' : b.nombre,
    value: parseInt(b.total_usos),
  }));
  const topComerciosChart = data.topComercios.slice(0, 5).map((c: any) => ({
    label: c.nombre.length > 18 ? c.nombre.substring(0, 16) + '…' : c.nombre,
    value: parseInt(c.total_usos),
  }));

  // Trend data para sparklines (últimos 7 días)
  const trendValues = chartData.slice(-7).map(d => d.value);

  return (
    <div className="space-y-8 stagger">
      {/* Greeting */}
      <div>
        <p
          className="text-[10px] font-semibold mb-2"
          style={{ color: 'rgba(191,163,99,0.55)', letterSpacing: '0.32em', textTransform: 'uppercase' }}
        >
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <h1
          className="leading-tight"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '38px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.97)',
            letterSpacing: '-0.02em',
          }}
        >
          {greeting},{' '}
          <span style={{ color: '#d4b978', fontStyle: 'italic' }}>{firstName}</span>
        </h1>
        <p className="text-[14px] mt-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Resumen ejecutivo del programa de beneficios.
        </p>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat
          label="Verificaciones hoy"
          value={data.stats.verificacionesHoy}
          variant="gold"
          trend={trendValues.length > 1 ? trendValues : undefined}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <Stat
          label="Esta semana"
          value={data.stats.verificacionesSemana}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <Stat
          label="Este mes"
          value={data.stats.verificacionesMes}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
      </div>

      {/* KPIs catálogo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat
          label="Colaboradores"
          value={data.stats.totalBeneficiarios}
          variant="subtle"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
        <Stat
          label="Comercios adheridos"
          value={data.stats.totalComercios}
          variant="subtle"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        />
        <Stat
          label="Beneficios activos"
          value={data.stats.totalBeneficios}
          variant="subtle"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
          }
        />
      </div>

      {/* Gráfico principal - tendencia 7 días */}
      <Section eyebrow="Tendencia" title="Verificaciones de la última semana">
        <PremiumAreaChart data={chartData} dataKey="value" xKey="label" height={260} />
      </Section>

      {/* Top beneficios + comercios */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Section eyebrow="Top 5 · 30 días" title="Beneficios más canjeados">
          {topBeneficiosChart.length === 0 ? (
            <Empty
              title="Sin canjes registrados"
              description="Apenas tus colaboradores empiecen a canjear, los beneficios más populares aparecerán acá."
              icon={
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            />
          ) : (
            <PremiumBarChart data={topBeneficiosChart} height={220} />
          )}
        </Section>

        <Section eyebrow="Top 5 · 30 días" title="Comercios más visitados">
          {topComerciosChart.length === 0 ? (
            <Empty
              title="Sin actividad reciente"
              description="Cuando los colaboradores empiecen a canjear, vas a ver los comercios más activos acá."
              icon={
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                </svg>
              }
            />
          ) : (
            <PremiumBarChart data={topComerciosChart} height={220} />
          )}
        </Section>
      </div>

      {/* Movimiento reciente */}
      <Section
        eyebrow="Tiempo real"
        title="Movimiento reciente"
        action={
          <span
            className="text-[11px] px-3 py-1 rounded-full"
            style={{ background: 'rgba(127,201,159,0.06)', border: '1px solid rgba(127,201,159,0.2)', color: '#7fc99f', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600 }}
          >
            En vivo
          </span>
        }
      >
        {data.ultimasVerificaciones.length === 0 ? (
          <Empty
            title="Aún no hay movimiento"
            description="Las verificaciones de tus colaboradores en los comercios adheridos aparecerán acá en tiempo real."
            icon={
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
          />
        ) : (
          <PremiumTable
            columns={[
              { key: 'fecha', label: 'Fecha' },
              { key: 'colaborador', label: 'Colaborador' },
              { key: 'dni', label: 'DNI', mono: true },
              { key: 'beneficio', label: 'Beneficio', accent: true },
              { key: 'comercio', label: 'Comercio' },
              { key: 'estado', label: 'Estado' },
              { key: 'codigo', label: 'Código', mono: true },
            ]}
            rows={data.ultimasVerificaciones.map((v: any) => ({
              id: v.id,
              fecha: formatDate(v.fecha_verificacion),
              colaborador: `${v.beneficiario_nombre} ${v.beneficiario_apellido || ''}`.trim(),
              dni: v.dni,
              beneficio: v.beneficio_nombre,
              comercio: v.comercio_nombre,
              estado: (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{
                    background: v.estado === 'exitoso' ? 'rgba(127,201,159,0.08)' : 'rgba(232,144,137,0.08)',
                    border: `1px solid ${v.estado === 'exitoso' ? 'rgba(127,201,159,0.22)' : 'rgba(232,144,137,0.22)'}`,
                    color: v.estado === 'exitoso' ? '#7fc99f' : '#e89089',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: v.estado === 'exitoso' ? '#7fc99f' : '#e89089' }} />
                  {v.estado}
                </span>
              ),
              codigo: v.codigo_referencia,
            }))}
          />
        )}
      </Section>
    </div>
  );
}

// ============================================
// PREMIUM TABLE - tabla reutilizable
// ============================================
function PremiumTable({
  columns,
  rows,
}: {
  columns: { key: string; label: string; mono?: boolean; accent?: boolean }[];
  rows: any[];
}) {
  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full text-[12.5px]" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr>
            {columns.map(c => (
              <th
                key={c.key}
                className="text-left py-3 px-3 font-semibold"
                style={{
                  color: 'rgba(191,163,99,0.55)',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  fontSize: '10px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={row.id || ri}
              className="transition-colors group"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
            >
              {columns.map(c => (
                <td
                  key={c.key}
                  className="py-3 px-3 group-hover:bg-white/[0.02] transition-colors"
                  style={{
                    color: c.accent ? '#d4b978' : 'rgba(255,255,255,0.78)',
                    fontFamily: c.mono ? "'JetBrains Mono', 'SF Mono', monospace" : undefined,
                    fontVariantNumeric: c.mono ? 'tabular-nums' : undefined,
                    fontSize: c.mono ? '11.5px' : '12.5px',
                  }}
                >
                  {row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================
// Skeleton del Dashboard mientras carga
// ============================================
function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Greeting skeleton */}
      <div>
        <div className="skeleton h-3 w-40 mb-3" />
        <div className="skeleton h-10 w-72 mb-3" />
        <div className="skeleton h-4 w-56" />
      </div>
      {/* KPIs skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="skeleton h-3 w-24 mb-4" />
            <div className="skeleton h-10 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="skeleton h-3 w-24 mb-4" />
            <div className="skeleton h-10 w-20" />
          </div>
        ))}
      </div>
      <div className="p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="skeleton h-3 w-32 mb-4" />
        <div className="skeleton h-5 w-72 mb-6" />
        <div className="skeleton h-60 w-full" />
      </div>
    </div>
  );
}

// ============================================
// UI HELPERS reutilizables dentro de AdminDashboard
// ============================================

function PageHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-7 flex-wrap">
      <div>
        <p
          className="text-[10px] font-semibold mb-2"
          style={{ color: 'rgba(191,163,99,0.55)', letterSpacing: '0.32em', textTransform: 'uppercase' }}
        >
          {eyebrow}
        </p>
        <h1
          className="leading-tight"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '28px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.95)',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h1>
      </div>
      {action}
    </div>
  );
}

function PrimaryActionButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11.5px] font-semibold overflow-hidden transition-all group"
      style={{
        background: 'linear-gradient(135deg, #d4b978 0%, #bfa363 50%, #9d8649 100%)',
        color: '#0a0e14',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        boxShadow: '0 6px 20px rgba(191,163,99,0.18), inset 0 1px 0 rgba(255,255,255,0.15)',
        transitionDuration: '500ms',
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      <span>{children}</span>
    </button>
  );
}

function GhostButton({
  children,
  onClick,
  disabled,
  icon,
  tone = 'default',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  icon?: 'download' | 'trash' | 'refresh';
  tone?: 'default' | 'gold' | 'success' | 'warning' | 'danger';
}) {
  const toneColor = {
    default: 'rgba(255,255,255,0.55)',
    gold: '#d4b978',
    success: '#7fc99f',
    warning: '#e0b76c',
    danger: '#e89089',
  }[tone];
  const toneBorder = {
    default: 'rgba(255,255,255,0.1)',
    gold: 'rgba(212,185,120,0.25)',
    success: 'rgba(127,201,159,0.22)',
    warning: 'rgba(224,183,108,0.22)',
    danger: 'rgba(232,144,137,0.22)',
  }[tone];

  const iconPath = {
    download: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
    trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
    refresh: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10.5px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        color: toneColor,
        border: `1px solid ${toneBorder}`,
        background: 'rgba(255,255,255,0.01)',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
      }}
      onMouseEnter={e => {
        if (!disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.01)')}
    >
      {icon && (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={iconPath[icon]} />
        </svg>
      )}
      {children}
    </button>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-semibold flex-shrink-0"
      style={{
        background: active ? 'rgba(127,201,159,0.08)' : 'rgba(232,144,137,0.08)',
        border: `1px solid ${active ? 'rgba(127,201,159,0.22)' : 'rgba(232,144,137,0.22)'}`,
        color: active ? '#7fc99f' : '#e89089',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{
          background: active ? '#7fc99f' : '#e89089',
          boxShadow: active ? '0 0 4px rgba(127,201,159,0.6)' : 'none',
        }}
      />
      {active ? 'Activo' : 'Inactivo'}
    </span>
  );
}

function StatusBadge({ estado }: { estado: string }) {
  const ok = estado === 'exitoso';
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
      style={{
        background: ok ? 'rgba(127,201,159,0.08)' : 'rgba(232,144,137,0.08)',
        border: `1px solid ${ok ? 'rgba(127,201,159,0.22)' : 'rgba(232,144,137,0.22)'}`,
        color: ok ? '#7fc99f' : '#e89089',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: ok ? '#7fc99f' : '#e89089' }}
      />
      {estado}
    </span>
  );
}

function TierBadge({ nivel }: { nivel: string }) {
  const tiers: Record<string, { color: string; bg: string; label: string }> = {
    bronce: { color: '#d4a76a', bg: 'rgba(180,130,70,0.12)', label: 'Bronce' },
    plata: { color: '#c8d0d8', bg: 'rgba(184,192,200,0.12)', label: 'Plata' },
    oro: { color: '#d4b978', bg: 'rgba(191,163,99,0.12)', label: 'Oro' },
    platinum: { color: '#e8e6e3', bg: 'rgba(232,230,227,0.10)', label: 'Platinum' },
  };
  const t = tiers[nivel] || tiers.bronce;
  return (
    <span
      className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
      style={{
        background: t.bg,
        color: t.color,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        border: `1px solid ${t.color}33`,
      }}
    >
      {t.label}
    </span>
  );
}

function PremiumCard({ children, active = true }: { children: React.ReactNode; active?: boolean }) {
  return (
    <div
      className="relative p-5 rounded-2xl transition-all group overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(15,25,42,0.7) 0%, rgba(10,16,28,0.85) 100%)',
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '0 4px 16px rgba(8,14,26,0.15)',
        opacity: active ? 1 : 0.65,
        transitionDuration: '320ms',
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(191,163,99,0.2)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 12px 32px rgba(8,14,26,0.3), 0 0 24px rgba(191,163,99,0.05)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(8,14,26,0.15)';
      }}
    >
      {children}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span
        className="text-[10px] font-semibold flex-shrink-0"
        style={{ color: 'rgba(191,163,99,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase' }}
      >
        {label}
      </span>
      <span className="text-[12px] text-right truncate">{value}</span>
    </div>
  );
}

function CardActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex gap-1.5 mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <button
        onClick={onEdit}
        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-semibold transition-all"
        style={{
          color: '#d4b978',
          border: '1px solid rgba(212,185,120,0.2)',
          background: 'rgba(212,185,120,0.04)',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,185,120,0.1)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(212,185,120,0.04)')}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Editar
      </button>
      <button
        onClick={onDelete}
        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-semibold transition-all"
        style={{
          color: '#e89089',
          border: '1px solid rgba(232,144,137,0.2)',
          background: 'rgba(232,144,137,0.04)',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(232,144,137,0.1)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(232,144,137,0.04)')}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Eliminar
      </button>
    </div>
  );
}
