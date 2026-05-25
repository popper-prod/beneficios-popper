import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../components/layout/AppShell';
import DashboardView, { Panel } from '../views/DashboardView';
import ReportesView from '../views/ReportesView';
import { DataTable } from '../components/ui/DataTable';
import { Button } from '../components/ui/Button';
import { Badge, TierBadge } from '../components/ui/Badge';

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

type Tab = 'dashboard' | 'verificaciones' | 'beneficios' | 'comercios' | 'beneficiarios' | 'qrcodes' | 'autorizaciones' | 'permisos' | 'talento' | 'familiares' | 'jerarquias' | 'reportes';

// gold token reemplazado por var(--brand)

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
// SubmitBtn reemplazado por <Button variant="primary" loading={...} />
// gold ya no se usa — todo va por var(--brand)

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

  // Import catalogo 2026
  const [importingCatalog, setImportingCatalog] = useState(false);
  const [importCatalogMsg, setImportCatalogMsg] = useState('');

  // V2 — Talento Popper
  const [talentos, setTalentos] = useState<any[]>([]);
  const [talentoSearch, setTalentoSearch] = useState('');
  const [talentoMsg, setTalentoMsg] = useState('');

  // V2 — Familiares
  const [familiares, setFamiliares] = useState<any[]>([]);
  const [syncingFamiliares, setSyncingFamiliares] = useState(false);
  const [familiaresMsg, setFamiliaresMsg] = useState('');

  // V2 — Jerarquías
  const [jerarquias, setJerarquias] = useState<any[]>([]);
  const [jerarquiaModal, setJerarquiaModal] = useState<{ mode: 'create' | 'edit'; item?: any } | null>(null);
  const [jerarquiaForm, setJerarquiaForm] = useState<Record<string, string>>({});
  const [jerarquiaSaving, setJerarquiaSaving] = useState(false);
  const [jerarquiaMsg, setJerarquiaMsg] = useState('');

  // V3C — Importación
  const [importandoJerarquias, setImportandoJerarquias] = useState(false);
  const [seedingInternos, setSeedingInternos] = useState(false);

  // V3F — Skipass operativo
  const [seedingBoleterias, setSeedingBoleterias] = useState(false);
  const [exportandoSkipass, setExportandoSkipass] = useState(false);

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
    if (activeTab === 'talento') { fetchTalentos(); fetchBeneficiarios(); }
    if (activeTab === 'familiares') fetchFamiliares();
    if (activeTab === 'jerarquias') fetchJerarquias();
  }, [activeTab]);

  // ============================================
  // MODAL HANDLERS
  // ============================================
  const openCreate = (type: 'beneficio' | 'comercio' | 'beneficiario') => {
    setMsg('');
    if (type === 'beneficio') {
      setForm({
        nombre: '', descripcion: '', tipo: 'descuento', nivel_minimo: 'bronce',
        descuento: '', valor_fijo: '',
        fecha_inicio: '2026-01-01', fecha_fin: '2027-12-31',
        horario_inicio: '08:00', horario_fin: '22:00',
        limite_uso_diario: '', limite_uso_mensual: '',
        // V2
        origen: 'externo', categoria: '', aplica_a: 'empleado', modalidad: 'descuento',
        escala_descuentos: '', restricciones: '', excluye_outlet: '',
        relaciones_familiar: '', usa_limite_jerarquia: '',
      });
    } else if (type === 'comercio') {
      setForm({ nombre: '', direccion: '', ciudad: 'Ushuaia', provincia: 'Tierra del Fuego', telefono: '', email: '', horario_apertura: '09:00', horario_cierre: '20:00', responsable: '', logo: '', pin: '' });
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
        // V2
        origen: item.origen || 'externo',
        categoria: item.categoria || '',
        aplica_a: item.aplica_a || 'empleado',
        modalidad: item.modalidad || 'descuento',
        escala_descuentos: item.escala_descuentos ? (typeof item.escala_descuentos === 'string' ? item.escala_descuentos : JSON.stringify(item.escala_descuentos)) : '',
        restricciones: item.restricciones || '',
        excluye_outlet: item.excluye_outlet ? 'true' : '',
        relaciones_familiar: item.relaciones_familiar || '',
        usa_limite_jerarquia: item.usa_limite_jerarquia ? 'true' : '',
      });
    } else if (type === 'comercio') {
      setForm({
        nombre: item.nombre || '', direccion: item.direccion || '', ciudad: item.ciudad || '', provincia: item.provincia || '',
        telefono: item.telefono || '', email: item.email || '', horario_apertura: item.horario_apertura || '',
        horario_cierre: item.horario_cierre || '', responsable: item.responsable || '', activo: item.activo ? 'true' : 'false',
        logo: item.logo || '', pin: '',
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
      // V2 — escala_descuentos viene como JSON string del editor
      if (body.escala_descuentos && typeof body.escala_descuentos === 'string') {
        try { body.escala_descuentos = JSON.parse(body.escala_descuentos); } catch { body.escala_descuentos = null; }
      }
      // V2 — booleanos del checkbox vienen como string 'true' / ''
      body.excluye_outlet = body.excluye_outlet === 'true';
      body.usa_limite_jerarquia = body.usa_limite_jerarquia === 'true';
      // legacy: tipo = modalidad si no se setea
      if (!body.tipo) body.tipo = body.modalidad || 'descuento';

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
    if (!confirm(`¿Eliminar "${nombre}"?`)) return;
    try {
      const endpoint = type === 'beneficio' ? 'beneficios' : type === 'comercio' ? 'comercios' : 'beneficiarios';
      const res = await fetch(`${API_URL}/admin/${endpoint}/${id}`, { method: 'DELETE', headers });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data?.modo === 'soft') {
          alert(`"${nombre}" fue desactivado (tiene ${data.verificaciones} verificación(es) histórica(s) que se preservan). No se ve más en el listado.`);
        }
        if (type === 'beneficio') fetchBeneficios();
        if (type === 'comercio') fetchComercios();
        if (type === 'beneficiario') fetchBeneficiarios();
      } else {
        alert(`No se pudo eliminar: ${data?.error || res.statusText}`);
      }
    } catch (e: any) {
      alert(`Error de conexión al eliminar: ${e?.message || ''}`);
    }
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

  // Importar catalogo oficial ADN Popper 2026
  const handleImportarCatalogo2026 = async () => {
    const ok = confirm(
      '¿Importar el catálogo oficial ADN Popper 2026?\n\n' +
      'Esto va a:\n' +
      '• Desactivar todos los beneficios y comercios actuales\n' +
      '• Importar 11 comercios oficiales de Ushuaia y Río Grande\n' +
      '• Crear los beneficios oficiales 2026\n\n' +
      'Las verificaciones históricas se preservan.'
    );
    if (!ok) return;
    setImportingCatalog(true);
    setImportCatalogMsg('');
    try {
      const res = await fetch(`${API_URL}/admin/importar-catalogo-2026`, { method: 'POST', headers });
      const data = await res.json();
      if (res.ok) {
        setImportCatalogMsg(
          `✓ ${data.mensaje}. ${data.resumen.comerciosCreados} comercios creados, ` +
          `${data.resumen.comerciosActualizados} actualizados, ` +
          `${data.resumen.beneficiosCreados} beneficios importados.`
        );
        fetchBeneficios();
        fetchComercios();
      } else {
        setImportCatalogMsg(`Error: ${data.error || 'No se pudo importar'}`);
      }
    } catch {
      setImportCatalogMsg('Error de conexión');
    }
    setImportingCatalog(false);
  };

  // ============================================
  // V2 — TALENTO POPPER
  // ============================================
  const fetchTalentos = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/talento-popper`, { headers });
      if (res.ok) { const d = await res.json(); setTalentos(d.talentos || []); }
    } catch { /* silencioso */ }
  };

  const handleToggleTalento = async (beneficiarioId: string, nuevoEstado: boolean) => {
    try {
      const res = await fetch(`${API_URL}/admin/talento-popper/toggle`, {
        method: 'POST', headers,
        body: JSON.stringify({ beneficiarioId, activo: nuevoEstado }),
      });
      const data = await res.json();
      if (res.ok) {
        setTalentoMsg(nuevoEstado ? '✓ Agregado al programa Talento Popper' : '✓ Quitado del programa');
        fetchTalentos(); fetchBeneficiarios();
      } else setTalentoMsg(`Error: ${data.error}`);
    } catch { setTalentoMsg('Error de conexión'); }
  };

  // ============================================
  // V2 — FAMILIARES
  // ============================================
  const fetchFamiliares = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/familiares`, { headers });
      if (res.ok) { const d = await res.json(); setFamiliares(d.familiares || []); }
    } catch { /* silencioso */ }
  };

  const handleSyncFamiliares = async () => {
    if (!confirm('Sincronizar familiares desde Naaloo? Esto puede tardar 1-3 minutos para 500+ empleados.')) return;
    setSyncingFamiliares(true);
    setFamiliaresMsg('Sincronizando con Naaloo… puede tardar varios minutos.');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);
      const res = await fetch(`${API_URL}/admin/familiares/sync-naaloo`, { method: 'POST', headers, signal: controller.signal });
      clearTimeout(timeout);
      const data = await res.json();
      if (res.ok) {
        setFamiliaresMsg(
          `✓ Sincronización completa: ${data.resumen.empleadosProcesados} empleados procesados, ` +
          `${data.resumen.familiaresNuevos} familiares nuevos, ${data.resumen.familiaresActualizados} actualizados.`
        );
        fetchFamiliares();
      } else setFamiliaresMsg(`Error: ${data.error}`);
    } catch {
      setFamiliaresMsg('La sincronización continúa en el servidor. Recargá en unos minutos.');
      setTimeout(fetchFamiliares, 10000);
    }
    setSyncingFamiliares(false);
  };

  // ============================================
  // V2 — JERARQUIAS
  // ============================================
  const fetchJerarquias = async () => {
    try {
      // Asegurar migración primero
      await fetch(`${API_URL}/admin/migrar-jerarquias`, { method: 'POST', headers }).catch(() => {});
      const res = await fetch(`${API_URL}/admin/jerarquias`, { headers });
      if (res.ok) { const d = await res.json(); setJerarquias(d.jerarquias || []); }
    } catch { /* silencioso */ }
  };

  const openJerarquia = (mode: 'create' | 'edit', item?: any) => {
    setJerarquiaMsg('');
    if (mode === 'edit' && item) {
      setJerarquiaForm({
        nombre: item.nombre || '',
        orden: String(item.orden || 0),
        limite_mensual: String(item.limite_mensual || 0),
        limite_mensual_talento: String(item.limite_mensual_talento || 0),
        notas: item.notas || '',
      });
    } else {
      setJerarquiaForm({ nombre: '', orden: '0', limite_mensual: '0', limite_mensual_talento: '0', notas: '' });
    }
    setJerarquiaModal({ mode, item });
  };

  const handleSaveJerarquia = async () => {
    setJerarquiaSaving(true);
    setJerarquiaMsg('');
    try {
      const url = jerarquiaModal?.mode === 'create'
        ? `${API_URL}/admin/jerarquias`
        : `${API_URL}/admin/jerarquias/${jerarquiaModal?.item.id}`;
      const method = jerarquiaModal?.mode === 'create' ? 'POST' : 'PUT';
      const body = {
        nombre: jerarquiaForm.nombre,
        orden: parseInt(jerarquiaForm.orden || '0', 10),
        limite_mensual: parseFloat(jerarquiaForm.limite_mensual || '0'),
        limite_mensual_talento: parseFloat(jerarquiaForm.limite_mensual_talento || '0'),
        notas: jerarquiaForm.notas,
        activo: true,
      };
      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) { setJerarquiaModal(null); fetchJerarquias(); }
      else setJerarquiaMsg(data.error || 'Error');
    } catch { setJerarquiaMsg('Error de conexión'); }
    setJerarquiaSaving(false);
  };

  // V3C — Importación masiva
  const handleDescargarTemplateJerarquias = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/importar/template-jerarquias`, { headers });
      if (!res.ok) return alert('Error descargando template');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'template-jerarquias.xlsx';
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch { alert('Error de conexión'); }
  };

  const handleAbrirImportJerarquias = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const reemplazar = confirm('¿Reemplazar las jerarquías existentes?\n\nOK = Reemplazar (las que no estén en el Excel quedan inactivas)\nCancel = Solo crear/actualizar (mantener las que ya tenés)');
      setImportandoJerarquias(true);
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const fileBase64 = e.target?.result as string;
          const res = await fetch(`${API_URL}/admin/importar/jerarquias`, {
            method: 'POST', headers,
            body: JSON.stringify({ fileBase64, reemplazar }),
          });
          const data = await res.json();
          if (res.ok) {
            alert(`✓ Importación completada. ${data.creadas} creadas, ${data.actualizadas} actualizadas${data.errores.length ? `, ${data.errores.length} errores` : ''}.`);
            fetchJerarquias();
          } else {
            alert(`Error: ${data.error || 'No se pudo importar'}`);
          }
          setImportandoJerarquias(false);
        };
        reader.readAsDataURL(file);
      } catch (e: any) {
        alert(`Error: ${e.message}`);
        setImportandoJerarquias(false);
      }
    };
    input.click();
  };

  const handleSeedInternos = async () => {
    const ok = confirm(
      '¿Cargar los beneficios internos estándar?\n\n' +
      'Esto creará (o actualizará si ya existen):\n' +
      '• Pase de Esquí · Temporada (acceso, familiares)\n' +
      '• Indumentaria Corporativa Popper (20/30%, jerarquía)\n' +
      '• Calzado deportivo\n' +
      '• Accesorios\n' +
      '• Equipos de nieve\n' +
      '• Puntos Gastronómicos\n' +
      '• Indumentaria de Renta\n\n' +
      'Después podés editarlos uno por uno desde el form.'
    );
    if (!ok) return;
    setSeedingInternos(true);
    try {
      const res = await fetch(`${API_URL}/admin/seed-beneficios-internos`, { method: 'POST', headers });
      const data = await res.json();
      if (res.ok) {
        alert(`✓ ${data.creados} beneficios internos creados, ${data.actualizados} actualizados.`);
        fetchBeneficios();
      } else {
        alert(`Error: ${data.error || 'No se pudo crear'}`);
      }
    } catch { alert('Error de conexión'); }
    setSeedingInternos(false);
  };

  // V3F — Seed boleterías + skipass + foto + listado
  const handleSeedBoleteriasSkipass = async () => {
    const ok = confirm(
      '¿Configurar Skipass operativo?\n\n' +
      'Esto va a:\n' +
      '• Crear (o reactivar) 2 comercios: "Boletería Ciudad" y "Boletería Cerro Castor"\n' +
      '• Crear/actualizar el beneficio "Pase de Esquí · Temporada" con límite 1 por persona\n' +
      '• Asociar el skipass con ambas boleterías (se puede retirar en cualquiera, pero solo 1 vez)\n' +
      '• Aplica a empleado + familiares (Madre/Padre, Cónyuge, Concubino, Hijos)'
    );
    if (!ok) return;
    setSeedingBoleterias(true);
    try {
      const res = await fetch(`${API_URL}/admin/seed-boleterias-skipass`, { method: 'POST', headers });
      const data = await res.json();
      if (res.ok) {
        alert(`✓ Configurado. ${data.boleterias.length} boleterías + skipass listas.\n\nQRs:\n${data.boleterias.map((b: any) => `• ${b.nombre}: ${b.qr}`).join('\n')}`);
        fetchComercios(); fetchBeneficios();
      } else {
        alert(`Error: ${data.error || 'No se pudo configurar'}`);
      }
    } catch { alert('Error de conexión'); }
    setSeedingBoleterias(false);
  };

  const handleExportarAutorizadosSkipass = async () => {
    setExportandoSkipass(true);
    try {
      // Buscar el beneficio skipass
      const benRes = await fetch(`${API_URL}/admin/beneficios`, { headers });
      const benData = await benRes.json();
      const skipass = (benData.beneficios || []).find((b: any) =>
        (b.nombre || '').toLowerCase().includes('skipass') ||
        (b.nombre || '').toLowerCase().includes('esquí') ||
        b.categoria === 'skipass'
      );
      if (!skipass) {
        alert('No encontré el beneficio Skipass. Hacé click primero en "Configurar Skipass".');
        setExportandoSkipass(false);
        return;
      }
      const res = await fetch(`${API_URL}/admin/autorizados/${skipass.id}/excel`, { headers });
      if (!res.ok) { alert('Error generando el listado'); setExportandoSkipass(false); return; }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `autorizados-skipass-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch { alert('Error de conexión'); }
    setExportandoSkipass(false);
  };

  const handleUploadFotoFamiliar = async (familiarId: string, fotoDataUrl: string) => {
    try {
      const res = await fetch(`${API_URL}/admin/familiares/${familiarId}/foto`, {
        method: 'POST', headers, body: JSON.stringify({ foto: fotoDataUrl }),
      });
      if (res.ok) {
        fetchFamiliares();
        return true;
      }
      return false;
    } catch { return false; }
  };

  const handleDeleteJerarquia = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar jerarquía "${nombre}"?`)) return;
    try {
      const res = await fetch(`${API_URL}/admin/jerarquias/${id}`, { method: 'DELETE', headers });
      if (res.ok) fetchJerarquias();
    } catch { /* */ }
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

  const baseUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}`
    : 'https://beneficios.recluta.com.ar/';

  const nivelOptions = [
    { value: 'bronce', label: 'Bronce' }, { value: 'plata', label: 'Plata' },
    { value: 'oro', label: 'Oro' }, { value: 'platinum', label: 'Platinum' },
  ];

  const formatDate = (d: string) => new Date(d).toLocaleString('es-AR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  return (
    <AppShell activeTab={activeTab} onTabChange={(t) => setActiveTab(t as Tab)} user={user} onLogout={onLogout}>
      {/* ====== DASHBOARD ====== */}
      {activeTab === 'dashboard' && (
        loading ? <DashboardSkeleton /> : data ? <DashboardView data={data} user={user} /> : <DashboardEmpty onRetry={fetchDashboard} />
      )}

      {/* ====== REPORTES ====== */}
      {activeTab === 'reportes' && <ReportesView token={token} />}

      {/* ====== MOVIMIENTO ====== */}
      {activeTab === 'verificaciones' && (
        <PageSection
          title="Movimiento"
          description="Historial completo de verificaciones registradas."
          action={
            <div style={{ display: 'flex', gap: 6 }}>
              <Button variant="ghost" size="sm" leftIcon={<DownloadIcon size={13} />} onClick={handleExportCSV}>Exportar CSV</Button>
              <Button variant="ghost" size="sm" leftIcon={<TrashIcon size={13} />} onClick={handleCleanup} loading={cleaningUp}>Limpiar duplicados</Button>
              <Button variant="secondary" size="sm" leftIcon={<RefreshIcon size={13} />} onClick={fetchVerificaciones}>Actualizar</Button>
            </div>
          }
        >
          {cleanupMsg && <InlineMessage tone={cleanupMsg.includes('Error') ? 'danger' : 'success'}>{cleanupMsg}</InlineMessage>}
          <DataTable
            columns={[
              {
                key: 'fecha', label: 'Fecha', sortable: true,
                accessor: (r: any) => new Date(r.fecha_verificacion).getTime(),
                render: (r: any) => formatDate(r.fecha_verificacion),
              },
              {
                key: 'colaborador', label: 'Colaborador', sortable: true,
                accessor: (r: any) => `${r.beneficiario_nombre || ''} ${r.beneficiario_apellido || ''}`,
                render: (r: any) => <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{r.beneficiario_nombre} {r.beneficiario_apellido}</span>,
              },
              { key: 'dni', label: 'DNI', mono: true, sortable: true },
              { key: 'nivel', label: 'Nivel', render: (r: any) => <TierBadge tier={r.nivel} /> },
              {
                key: 'beneficio_nombre', label: 'Beneficio', sortable: true,
                render: (r: any) => <span style={{ color: 'var(--brand)' }}>{r.beneficio_nombre}</span>,
              },
              { key: 'comercio_nombre', label: 'Comercio', sortable: true },
              {
                key: 'estado', label: 'Estado',
                render: (r: any) => <Badge tone={r.estado === 'exitoso' ? 'success' : 'danger'} dot size="sm">{r.estado}</Badge>,
              },
              { key: 'codigo_referencia', label: 'Código', mono: true },
            ]}
            data={verificaciones}
            rowKey={(r: any) => r.id}
            searchPlaceholder="Buscar por colaborador, DNI o código…"
            empty={{
              title: 'Sin verificaciones registradas',
              description: 'Las verificaciones aparecerán acá apenas los colaboradores empiecen a canjear beneficios.',
            }}
          />
        </PageSection>
      )}

      {/* ====== BENEFICIOS ====== */}
      {activeTab === 'beneficios' && (
        <PageSection
          title="Beneficios"
          description={`${beneficios.length} ${beneficios.length === 1 ? 'beneficio' : 'beneficios'} en el catálogo.`}
          action={
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Button variant="ghost" size="md" onClick={handleSeedInternos} loading={seedingInternos}>
                {seedingInternos ? 'Cargando…' : 'Cargar beneficios internos'}
              </Button>
              <Button variant="outline" size="md" onClick={handleImportarCatalogo2026} loading={importingCatalog}>
                {importingCatalog ? 'Importando…' : 'Importar catálogo 2026'}
              </Button>
              <Button variant="primary" size="md" leftIcon={<PlusIcon size={13} />} onClick={() => openCreate('beneficio')}>Nuevo beneficio</Button>
            </div>
          }
        >
          {importCatalogMsg && (
            <InlineMessage tone={importCatalogMsg.includes('Error') ? 'danger' : 'success'}>
              {importCatalogMsg}
            </InlineMessage>
          )}
          {beneficios.length === 0 ? (
            <EmptyView
              icon={<GiftIcon size={28} />}
              title="No hay beneficios todavía"
              description="Creá el primer beneficio para que tus colaboradores puedan canjearlo."
              action={<Button variant="primary" leftIcon={<PlusIcon size={13} />} onClick={() => openCreate('beneficio')}>Crear primer beneficio</Button>}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {beneficios.map((b: any) => (
                <ItemCard key={b.id}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-1)' }}>{b.nombre}</h3>
                    <Badge tone={b.activo ? 'success' : 'neutral'} size="sm" dot>{b.activo ? 'Activo' : 'Inactivo'}</Badge>
                  </div>
                  {b.descripcion && <p style={{ fontSize: '12.5px', color: 'var(--text-3)', marginBottom: 12, lineHeight: 1.5 }}>{b.descripcion}</p>}
                  {b.descuento && (
                    <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--brand-subtle)', border: '1px solid var(--brand-border)', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span style={{ fontSize: '22px', fontWeight: 700, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{b.descuento}%</span>
                        <span style={{ fontSize: '11px', color: 'var(--brand)', opacity: 0.7, fontWeight: 500 }}>de descuento</span>
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, fontSize: '12px' }}>
                    <Row label="Nivel mínimo"><TierBadge tier={b.nivel_minimo} /></Row>
                    <Row label="Usos">{b.uso_actual || 0}</Row>
                    {b.horario_inicio && <Row label="Horario">{b.horario_inicio} – {b.horario_fin || '—'}</Row>}
                  </div>
                  <CardFooterActions onEdit={() => openEdit('beneficio', b)} onDelete={() => handleDelete('beneficio', b.id, b.nombre)} />
                </ItemCard>
              ))}
            </div>
          )}
        </PageSection>
      )}

      {/* ====== COMERCIOS ====== */}
      {activeTab === 'comercios' && (
        <PageSection
          title="Comercios"
          description={`${comercios.length} ${comercios.length === 1 ? 'comercio adherido' : 'comercios adheridos'}.`}
          action={<Button variant="primary" size="md" leftIcon={<PlusIcon size={13} />} onClick={() => openCreate('comercio')}>Nuevo comercio</Button>}
        >
          {comercios.length === 0 ? (
            <EmptyView
              icon={<StoreIcon size={28} />}
              title="Aún no hay comercios"
              description="Agregá el primer comercio para empezar a generar códigos QR."
              action={<Button variant="primary" leftIcon={<PlusIcon size={13} />} onClick={() => openCreate('comercio')}>Agregar primer comercio</Button>}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
              {comercios.map((c: any) => (
                <ItemCard key={c.id}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                    {/* Logo o placeholder */}
                    <div style={{
                      width: 44, height: 44, borderRadius: '8px',
                      background: c.logo ? 'var(--bg-canvas)' : 'var(--brand-muted)',
                      border: `1px solid ${c.logo ? 'var(--border-subtle)' : 'var(--brand-border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', flexShrink: 0,
                      color: 'var(--brand)', fontWeight: 700, fontSize: '14px',
                    }}>
                      {c.logo ? (
                        <img src={c.logo} alt={c.nombre} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      ) : (
                        c.nombre.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
                      )}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-1)' }}>{c.nombre}</h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: 2 }}>{c.direccion}, {c.ciudad}</p>
                    </div>
                    <Badge tone={c.activo ? 'success' : 'neutral'} size="sm" dot>{c.activo ? 'Activo' : 'Inactivo'}</Badge>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '12px 0', fontSize: '12px' }}>
                    {c.responsable && <Row label="Responsable">{c.responsable}</Row>}
                    {c.horario_apertura && <Row label="Horario">{c.horario_apertura} – {c.horario_cierre}</Row>}
                    {c.telefono && <Row label="Teléfono">{c.telefono}</Row>}
                  </div>
                  <div style={{
                    padding: '8px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                    borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  }}>
                    <div>
                      <p style={{ fontSize: '10px', color: 'var(--text-4)', fontWeight: 500, marginBottom: 2 }}>CÓDIGO QR</p>
                      <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '12px', color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>{c.qr_code}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard?.writeText(`${baseUrl}#/qr/${c.qr_code}`); }} title="Copiar URL"><CopyIcon size={13} /></Button>
                  </div>
                  <CardFooterActions onEdit={() => openEdit('comercio', c)} onDelete={() => handleDelete('comercio', c.id, c.nombre)} />
                </ItemCard>
              ))}
            </div>
          )}
        </PageSection>
      )}

      {/* ====== COLABORADORES ====== */}
      {activeTab === 'beneficiarios' && (
        <PageSection
          title="Colaboradores"
          description={`${beneficiarios.length} ${beneficiarios.length === 1 ? 'colaborador registrado' : 'colaboradores registrados'}.`}
          action={<Button variant="primary" size="md" leftIcon={<PlusIcon size={13} />} onClick={() => openCreate('beneficiario')}>Nuevo colaborador</Button>}
        >
          <DataTable
            columns={[
              { key: 'dni', label: 'DNI', mono: true, sortable: true },
              {
                key: 'nombre', label: 'Colaborador', sortable: true,
                accessor: (r: any) => `${r.nombre} ${r.apellido}`,
                render: (r: any) => <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{r.nombre} {r.apellido}</span>,
              },
              { key: 'email', label: 'Email', sortable: true, render: (r: any) => <span style={{ color: 'var(--text-3)' }}>{r.email || '—'}</span> },
              { key: 'nivel', label: 'Nivel', sortable: true, render: (r: any) => <TierBadge tier={r.nivel} /> },
              { key: 'departamento', label: 'Departamento', sortable: true, render: (r: any) => <span style={{ color: 'var(--text-3)' }}>{r.departamento || '—'}</span> },
              { key: 'activo', label: 'Estado', render: (r: any) => <Badge tone={r.activo ? 'success' : 'danger'} size="sm" dot>{r.activo ? 'Activo' : 'Inactivo'}</Badge> },
              {
                key: 'actions', label: '',
                render: (r: any) => (
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <Button variant="ghost" size="sm" onClick={() => openEdit('beneficiario', r)}>Editar</Button>
                  </div>
                ),
              },
            ]}
            data={beneficiarios}
            rowKey={(r: any) => r.id}
            searchPlaceholder="Buscar por nombre, DNI o email…"
            empty={{ title: 'Sin colaboradores', description: 'Sincronizá con Naaloo desde Autorizaciones o creá uno manualmente.' }}
          />
        </PageSection>
      )}

      {/* ====== QR CODES ====== */}
      {activeTab === 'qrcodes' && (
        <PageSection
          title="Códigos QR"
          description="Generá e imprimí los QR de cada comercio adherido."
        >
          {comercios.length === 0 ? (
            <EmptyView icon={<QrCodeIcon size={28} />} title="No hay comercios" description="Agregá comercios primero desde la sección Comercios." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {comercios.map((c: any) => {
                const qrUrl = `${baseUrl}#/qr/${c.qr_code}`;
                const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrUrl)}&margin=10&color=ededee&bgcolor=16161a`;
                return (
                  <ItemCard key={c.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: '8px',
                        background: c.logo ? 'var(--bg-canvas)' : 'var(--brand-muted)',
                        border: `1px solid ${c.logo ? 'var(--border-subtle)' : 'var(--brand-border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', flexShrink: 0,
                        color: 'var(--brand)', fontWeight: 700, fontSize: '12px',
                      }}>
                        {c.logo
                          ? <img src={c.logo} alt={c.nombre} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                          : c.nombre.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-1)' }}>{c.nombre}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 2 }}>{c.direccion}</p>
                      </div>
                    </div>
                    <div style={{
                      padding: 12, background: 'var(--bg-surface)', borderRadius: '8px',
                      border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'center', marginBottom: 10,
                    }}>
                      <img src={qrImg} alt={`QR ${c.nombre}`} style={{ width: 200, height: 200, display: 'block' }} />
                    </div>
                    <p style={{
                      fontSize: '10.5px', color: 'var(--text-3)', textAlign: 'center', marginBottom: 10,
                      fontFamily: 'var(--font-geist-mono)', wordBreak: 'break-all',
                    }}>{qrUrl}</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button variant="secondary" size="sm" leftIcon={<CopyIcon size={12} />} onClick={() => { navigator.clipboard?.writeText(qrUrl); }} style={{ flex: 1 }}>Copiar URL</Button>
                      <Button variant="ghost" size="sm" leftIcon={<DownloadIcon size={12} />} onClick={() => window.open(qrImg, '_blank')} style={{ flex: 1 }}>Descargar</Button>
                    </div>
                  </ItemCard>
                );
              })}
            </div>
          )}
        </PageSection>
      )}

      {/* ====== AUTORIZACIONES ====== */}
      {activeTab === 'autorizaciones' && (
        <PageSection
          title="Autorizaciones"
          description="Sincronizá con Naaloo y gestioná las bajas, suspensiones y reactivaciones."
        >
          {authMsg && <InlineMessage tone={authMsg.includes('Error') ? 'danger' : 'info'}>{authMsg}</InlineMessage>}

          {/* Sync con Naaloo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 16 }}>
            {!migracionDone && (
              <ActionCard
                title="Preparar base de datos"
                description="Solo la primera vez. Agrega las columnas necesarias para sincronización."
                actionLabel="Preparar BD"
                onAction={handleMigracion}
                tone="warning"
              />
            )}
            <ActionCard
              title="Sincronizar con Naaloo"
              description="Importa altas, bajas y modificaciones desde el sistema de RRHH."
              actionLabel={syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
              onAction={handleSyncNaaloo}
              tone="brand"
              loading={syncing}
            />
          </div>

          {syncResult && (
            <div style={{ padding: '12px 14px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: '6px', marginBottom: 16 }}>
              <p style={{ fontSize: '12.5px', color: 'var(--success-text)', fontWeight: 500, marginBottom: 4 }}>Sincronización completada</p>
              <p style={{ fontSize: '11.5px', color: 'var(--text-2)' }}>
                {syncResult.nuevos || 0} nuevos · {syncResult.actualizados || 0} actualizados · {syncResult.bajas || 0} bajas · {syncResult.reactivados || 0} reactivados
              </p>
            </div>
          )}

          {/* Bloqueo por área/sector */}
          {(areas.length > 0 || sectores.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 16 }}>
              <GroupBlockPanel
                title="Por área"
                items={areas}
                beneficiarios={beneficiarios}
                tipoKey="departamento"
                motivo={grupoMotivo}
                setMotivo={setGrupoMotivo}
                filtroValue={filtroArea}
                setFiltroValue={setFiltroArea}
                onAction={(valor, accion) => handleGrupoAutorizar('departamento', valor, accion)}
              />
              <GroupBlockPanel
                title="Por sector"
                items={sectores}
                beneficiarios={beneficiarios}
                tipoKey="sector"
                motivo={grupoMotivo}
                setMotivo={setGrupoMotivo}
                filtroValue={filtroSector}
                setFiltroValue={setFiltroSector}
                onAction={(valor, accion) => handleGrupoAutorizar('sector', valor, accion)}
              />
            </div>
          )}

          {/* Tabla individual */}
          <Panel
            title="Gestión individual"
            description="Activar o desactivar colaboradores uno por uno o por selección múltiple."
            padded={false}
          >
            {selectedIds.size > 0 && (
              <div style={{
                padding: '8px 14px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{selectedIds.size} seleccionado{selectedIds.size === 1 ? '' : 's'}</span>
                <input
                  placeholder="Motivo (opcional)"
                  value={bulkMotivo}
                  onChange={e => setBulkMotivo(e.target.value)}
                  style={{
                    height: 28, padding: '0 10px', background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)', borderRadius: '4px',
                    color: 'var(--text-1)', fontSize: '12px', flex: 1, maxWidth: 320, outline: 'none',
                  }}
                />
                <Button variant="success" size="sm" onClick={() => handleBulkAutorizar('activar')}>Activar</Button>
                <Button variant="danger" size="sm" onClick={() => handleBulkAutorizar('desactivar')}>Desactivar</Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Limpiar</Button>
              </div>
            )}
            <DataTable
              columns={[
                {
                  key: 'select', label: '', width: 32,
                  render: (r: any) => (
                    <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelection(r.id)} style={{ accentColor: 'var(--brand)' }} />
                  ),
                },
                { key: 'dni', label: 'DNI', mono: true, sortable: true },
                {
                  key: 'nombre', label: 'Colaborador', sortable: true,
                  accessor: (r: any) => `${r.nombre} ${r.apellido}`,
                  render: (r: any) => <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{r.nombre} {r.apellido}</span>,
                },
                { key: 'nivel', label: 'Nivel', render: (r: any) => <TierBadge tier={r.nivel} /> },
                { key: 'departamento', label: 'Área', sortable: true, render: (r: any) => <span style={{ color: 'var(--text-3)' }}>{r.departamento || '—'}</span> },
                { key: 'sector', label: 'Sector', sortable: true, render: (r: any) => <span style={{ color: 'var(--text-3)' }}>{r.sector || '—'}</span> },
                { key: 'activo', label: 'Estado', render: (r: any) => <Badge tone={r.activo ? 'success' : 'danger'} size="sm" dot>{r.activo ? 'Activo' : 'Inactivo'}</Badge> },
                { key: 'motivo_baja', label: 'Motivo baja', render: (r: any) => <span style={{ color: 'var(--text-3)', fontSize: '11.5px' }}>{r.motivo_baja || '—'}</span> },
                {
                  key: 'actions', label: '',
                  render: (r: any) => r.activo ? (
                    <Button variant="ghost" size="sm" onClick={() => { setMotivoModal({ id: r.id, nombre: `${r.nombre} ${r.apellido}`, accion: 'desactivar' }); setMotivoInput(''); }}>Desactivar</Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => handleAutorizar(r.id, 'activar', 'Reactivación manual')}>Activar</Button>
                  ),
                },
              ]}
              data={beneficiarios}
              rowKey={(r: any) => r.id}
              searchPlaceholder="Buscar colaborador…"
              empty={{ title: 'Sin colaboradores', description: 'Sincronizá con Naaloo para importarlos.' }}
            />
          </Panel>

          {/* Logs */}
          {authLogs.length > 0 && (
            <Panel title="Historial de cambios" description={`Últimos ${authLogs.length} eventos`} padded={false}>
              <DataTable
                columns={[
                  { key: 'fecha', label: 'Fecha', render: (r: any) => formatDate(r.fecha) },
                  { key: 'colaborador', label: 'Colaborador', render: (r: any) => `${r.nombre || ''} ${r.apellido || ''}`.trim() || '—' },
                  { key: 'dni', label: 'DNI', mono: true },
                  { key: 'accion', label: 'Acción', render: (r: any) => <Badge tone={r.accion.includes('alta') || r.accion === 'activar' ? 'success' : 'danger'} size="sm">{r.accion}</Badge> },
                  { key: 'motivo', label: 'Motivo', render: (r: any) => <span style={{ color: 'var(--text-3)' }}>{r.motivo}</span> },
                  { key: 'autorizado_por', label: 'Por', render: (r: any) => <span style={{ color: 'var(--text-3)', fontSize: '11.5px' }}>{r.autorizado_por}</span> },
                ]}
                data={authLogs}
                rowKey={(r: any) => r.id}
                searchable={false}
                pageSize={10}
                empty={{ title: 'Sin registros' }}
              />
            </Panel>
          )}
        </PageSection>
      )}

      {/* ====== PERMISOS ====== */}
      {activeTab === 'permisos' && (
        <PageSection
          title="Permisos"
          description="Otorgá acceso al panel a los colaboradores de RRHH que lo necesiten."
          action={miPerfil && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--brand-muted)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 600 }}>
                {miPerfil.nombre?.[0]}{miPerfil.apellido?.[0]}
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-1)', fontWeight: 500, lineHeight: 1.2 }}>{miPerfil.nombre} {miPerfil.apellido}</p>
                <p style={{ fontSize: '10.5px', color: 'var(--text-3)', lineHeight: 1.2 }}>{miPerfil.esSuperAdmin ? 'Super admin' : 'Admin'}</p>
              </div>
            </div>
          )}
        >
          {permisoMsg && <InlineMessage tone={permisoMsg.includes('Error') ? 'danger' : 'success'}>{permisoMsg}</InlineMessage>}

          {!permisosMigracionDone && (
            <ActionCard
              title="Preparar permisos"
              description="Agrega las columnas necesarias y asigna a Pedro como super-admin inicial."
              actionLabel="Preparar BD"
              onAction={handleMigrarPermisos}
              tone="warning"
            />
          )}

          {/* Buscar y otorgar */}
          <Panel title="Otorgar permiso a un colaborador" description="Buscá por nombre, DNI o email. Solo los activos.">
            <input
              type="text"
              placeholder="Pedro Suárez, 28348057, pedro@…"
              value={permisoSearch}
              onChange={(e) => handleBuscarPermiso(e.target.value)}
              style={{
                width: '100%', height: 36, padding: '0 12px',
                background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                borderRadius: '6px', color: 'var(--text-1)', fontSize: '13px', outline: 'none',
                marginBottom: 12,
              }}
            />
            {searchingPermiso && <p style={{ fontSize: '12px', color: 'var(--text-3)' }}>Buscando…</p>}
            {permisoResultados.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {permisoResultados.map((b: any) => (
                  <div key={b.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px',
                  }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--brand-muted)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600 }}>
                      {b.nombre?.[0]}{b.apellido?.[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '13px', color: 'var(--text-1)', fontWeight: 500, lineHeight: 1.2 }}>{b.nombre} {b.apellido}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.3, marginTop: 2 }}>{b.email || 'Sin email'} · {b.departamento || 'S/D'} · DNI {b.dni}</p>
                    </div>
                    {b.es_admin ? (
                      <Badge tone="success" size="sm" dot>Ya es {b.rol_admin}</Badge>
                    ) : !b.email ? (
                      <span style={{ fontSize: '11px', color: 'var(--danger-text)' }}>Falta email</span>
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button variant="ghost" size="sm" onClick={() => handleAsignarAdmin(b.id, 'admin')}>Admin</Button>
                        <Button variant="primary" size="sm" onClick={() => handleAsignarAdmin(b.id, 'super_admin')}>Super</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {permisoSearch.length >= 2 && !searchingPermiso && permisoResultados.length === 0 && (
              <p style={{ fontSize: '12px', color: 'var(--text-3)', textAlign: 'center', padding: 16 }}>Sin resultados para "{permisoSearch}"</p>
            )}
          </Panel>

          {/* Admins actuales */}
          <Panel title={`Administradores activos (${admins.length})`} padded={false}>
            {admins.length === 0 ? (
              <EmptyView icon={<KeyRoundIcon size={28} />} title="Sin administradores asignados" description="Buscá colaboradores arriba y asignales rol." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {admins.map((a: any) => (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--brand-muted)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600 }}>
                      {a.nombre?.[0]}{a.apellido?.[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <p style={{ fontSize: '13px', color: 'var(--text-1)', fontWeight: 500 }}>{a.nombre} {a.apellido}</p>
                        <Badge tone={a.rol_admin === 'super_admin' ? 'brand' : 'neutral'} size="sm">
                          {a.rol_admin === 'super_admin' ? 'Super admin' : 'Admin'}
                        </Badge>
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 2 }}>
                        {a.email} · {a.departamento || 'S/D'} · Desde {a.admin_desde ? new Date(a.admin_desde).toLocaleDateString('es-AR') : 'S/D'}
                      </p>
                    </div>
                    {miPerfil?.esSuperAdmin && miPerfil?.email !== a.email && (
                      <Button variant="ghost" size="sm" onClick={() => handleRevocarAdmin(a.id, `${a.nombre} ${a.apellido}`)}>Revocar</Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </PageSection>
      )}

      {/* ====== TALENTO POPPER ====== */}
      {activeTab === 'talento' && (
        <PageSection
          title="Talento Popper"
          description={`${talentos.length} colaborador${talentos.length === 1 ? '' : 'es'} en el programa.`}
        >
          {talentoMsg && <InlineMessage tone={talentoMsg.includes('Error') ? 'danger' : 'success'}>{talentoMsg}</InlineMessage>}
          <Panel title="Programa actual" description="Estos colaboradores acceden a porcentajes y límites mejorados.">
            {talentos.length === 0 ? (
              <EmptyView icon={<SparklesIcon size={28} />} title="Sin colaboradores en el programa" description="Buscalos abajo y marcalos como Talento Popper." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {talentos.map((t: any) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--brand-muted)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600 }}>
                      {t.nombre?.[0]}{t.apellido?.[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '13px', color: 'var(--text-1)', fontWeight: 500 }}>{t.nombre} {t.apellido}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-3)' }}>DNI {t.dni} · {t.departamento || 'S/D'}{t.sector ? ` · ${t.sector}` : ''}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleToggleTalento(t.id, false)} style={{ color: 'var(--danger-text)' }}>Quitar</Button>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Agregar al programa" description="Buscá por nombre, DNI o departamento. Click para marcar como Talento Popper.">
            <input
              type="text"
              placeholder="Buscar colaborador…"
              value={talentoSearch}
              onChange={(e) => setTalentoSearch(e.target.value)}
              style={{
                width: '100%', height: 36, padding: '0 12px',
                background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                borderRadius: '6px', color: 'var(--text-1)', fontSize: '13px', outline: 'none',
                marginBottom: 12,
              }}
            />
            {talentoSearch.length >= 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
                {beneficiarios
                  .filter((b: any) => !b.es_talento_popper && b.activo)
                  .filter((b: any) => {
                    const q = talentoSearch.toLowerCase();
                    return (b.nombre + ' ' + b.apellido).toLowerCase().includes(q) ||
                           b.dni?.includes(q) ||
                           (b.departamento || '').toLowerCase().includes(q);
                  })
                  .slice(0, 50)
                  .map((b: any) => (
                    <div key={b.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                      background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '12.5px', color: 'var(--text-1)', fontWeight: 500 }}>{b.nombre} {b.apellido}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-3)' }}>DNI {b.dni} · {b.departamento || 'S/D'}</p>
                      </div>
                      <Button variant="primary" size="sm" onClick={() => handleToggleTalento(b.id, true)}>+ Talento</Button>
                    </div>
                  ))
                }
              </div>
            )}
          </Panel>
        </PageSection>
      )}

      {/* ====== FAMILIARES ====== */}
      {activeTab === 'familiares' && (
        <PageSection
          title="Familiares"
          description={`${familiares.length} familiar${familiares.length === 1 ? '' : 'es'} vinculado${familiares.length === 1 ? '' : 's'}.`}
          action={
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Button variant="ghost" size="md" onClick={handleSeedBoleteriasSkipass} loading={seedingBoleterias}>
                {seedingBoleterias ? 'Cargando…' : 'Configurar Skipass'}
              </Button>
              <Button variant="outline" size="md" onClick={handleExportarAutorizadosSkipass} loading={exportandoSkipass}>
                {exportandoSkipass ? 'Generando…' : 'Lista autorizados Skipass'}
              </Button>
              <Button variant="primary" size="md" onClick={handleSyncFamiliares} loading={syncingFamiliares}>
                {syncingFamiliares ? 'Sincronizando…' : 'Sincronizar desde Naaloo'}
              </Button>
            </div>
          }
        >
          {familiaresMsg && <InlineMessage tone={familiaresMsg.includes('Error') ? 'danger' : 'success'}>{familiaresMsg}</InlineMessage>}
          {familiares.length === 0 ? (
            <EmptyView
              icon={<HeartIcon size={28} />}
              title="Sin familiares cargados"
              description="Click en 'Sincronizar desde Naaloo' para importar madres, padres, cónyuges, concubinos e hijos de cada colaborador."
              action={<Button variant="primary" onClick={handleSyncFamiliares} loading={syncingFamiliares}>Sincronizar ahora</Button>}
            />
          ) : (
            <DataTable
              columns={[
                {
                  key: 'foto', label: '', width: 48,
                  render: (r: any) => <FamiliarFotoCell familiar={r} onUpload={handleUploadFotoFamiliar} />,
                },
                { key: 'dni', label: 'DNI', mono: true, sortable: true },
                {
                  key: 'nombre_completo', label: 'Familiar', sortable: true,
                  render: (r: any) => <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{r.nombre_completo}</span>,
                },
                {
                  key: 'relacion', label: 'Relación', sortable: true,
                  render: (r: any) => <RelacionBadge relacion={r.relacion} />,
                },
                {
                  key: 'titular', label: 'Titular', sortable: true,
                  accessor: (r: any) => `${r.titular_nombre || ''} ${r.titular_apellido || ''}`,
                  render: (r: any) => <span style={{ color: 'var(--text-3)' }}>{r.titular_nombre} {r.titular_apellido} <span style={{ color: 'var(--text-4)' }}>({r.titular_dni})</span></span>,
                },
                {
                  key: 'fecha_nacimiento', label: 'Nacimiento', sortable: true,
                  render: (r: any) => r.fecha_nacimiento ? new Date(r.fecha_nacimiento).toLocaleDateString('es-AR') : '—',
                },
                {
                  key: 'a_cargo', label: 'A cargo',
                  render: (r: any) => r.a_cargo ? <Badge tone="success" size="sm">Sí</Badge> : <span style={{ color: 'var(--text-4)' }}>No</span>,
                },
              ]}
              data={familiares}
              rowKey={(r: any) => r.id}
              searchPlaceholder="Buscar por DNI, nombre o titular…"
              empty={{ title: 'Sin familiares', description: 'Sincronizá con Naaloo.' }}
            />
          )}
        </PageSection>
      )}

      {/* ====== JERARQUIAS ====== */}
      {activeTab === 'jerarquias' && (
        <PageSection
          title="Jerarquías y límites"
          description="Definí los cargos/jerarquías de la empresa y el límite mensual de gasto en indumentaria, calzado, accesorios y equipos."
          action={
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Button variant="ghost" size="md" onClick={handleDescargarTemplateJerarquias}>Descargar template</Button>
              <Button variant="outline" size="md" onClick={handleAbrirImportJerarquias} loading={importandoJerarquias}>
                {importandoJerarquias ? 'Importando…' : 'Importar Excel'}
              </Button>
              <Button variant="primary" size="md" leftIcon={<PlusIcon size={13} />} onClick={() => openJerarquia('create')}>Nueva jerarquía</Button>
            </div>
          }
        >
          {jerarquias.length === 0 ? (
            <EmptyView
              icon={<LayersIcon size={28} />}
              title="Sin jerarquías definidas"
              description="Creá la primera jerarquía. Ej: 'Operario' con límite $50.000/mes, 'Supervisor' con $100.000/mes, etc."
              action={<Button variant="primary" leftIcon={<PlusIcon size={13} />} onClick={() => openJerarquia('create')}>Crear primera jerarquía</Button>}
            />
          ) : (
            <DataTable
              columns={[
                { key: 'orden', label: 'Orden', sortable: true, width: 80 },
                {
                  key: 'nombre', label: 'Jerarquía', sortable: true,
                  render: (r: any) => <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{r.nombre}</span>,
                },
                {
                  key: 'limite_mensual', label: 'Límite mensual', mono: true, sortable: true,
                  render: (r: any) => <span style={{ color: 'var(--brand)' }}>${Number(r.limite_mensual).toLocaleString('es-AR')}</span>,
                },
                {
                  key: 'limite_mensual_talento', label: 'Límite Talento', mono: true, sortable: true,
                  render: (r: any) => <span style={{ color: 'var(--brand)' }}>${Number(r.limite_mensual_talento).toLocaleString('es-AR')}</span>,
                },
                {
                  key: 'notas', label: 'Notas',
                  render: (r: any) => <span style={{ color: 'var(--text-3)', fontSize: '11.5px' }}>{r.notas || '—'}</span>,
                },
                {
                  key: 'actions', label: '',
                  render: (r: any) => (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Button variant="ghost" size="sm" onClick={() => openJerarquia('edit', r)}>Editar</Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteJerarquia(r.id, r.nombre)} style={{ color: 'var(--danger-text)' }}>Eliminar</Button>
                    </div>
                  ),
                },
              ]}
              data={jerarquias}
              rowKey={(r: any) => r.id}
              searchPlaceholder="Buscar jerarquía…"
              empty={{ title: 'Sin jerarquías' }}
            />
          )}
        </PageSection>
      )}

      {/* ============ MODALES ============ */}

      {/* Modal Beneficio (V2 extendido) */}
      <Modal open={modal?.type === 'beneficio'} onClose={() => setModal(null)} title={modal?.mode === 'create' ? 'Nuevo beneficio' : 'Editar beneficio'}>
        {/* === Identidad === */}
        <SectionDivider label="Información básica" />
        <Field label="Nombre" value={form.nombre || ''} onChange={v => setForm({ ...form, nombre: v })} required />
        <Field label="Descripción" value={form.descripcion || ''} onChange={v => setForm({ ...form, descripcion: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Origen" value={form.origen || 'externo'} onChange={v => setForm({ ...form, origen: v })}
            options={[
              { value: 'externo', label: 'Externo (comercio adherido)' },
              { value: 'interno', label: 'Interno (Grupo Popper)' },
            ]} />
          <Field label="Categoría" value={form.categoria || ''} onChange={v => setForm({ ...form, categoria: v })}
            options={[
              { value: '', label: '— sin categoría —' },
              { value: 'skipass', label: 'Skipass' },
              { value: 'gastronomia', label: 'Gastronomía' },
              { value: 'indumentaria', label: 'Indumentaria' },
              { value: 'calzado', label: 'Calzado' },
              { value: 'accesorios', label: 'Accesorios' },
              { value: 'equipos_nieve', label: 'Equipos de nieve' },
              { value: 'farmacia', label: 'Farmacia' },
              { value: 'gym', label: 'Gimnasio' },
              { value: 'otros', label: 'Otros' },
            ]} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Aplica a" value={form.aplica_a || 'empleado'} onChange={v => setForm({ ...form, aplica_a: v })}
            options={[
              { value: 'empleado', label: 'Solo empleado' },
              { value: 'familiar', label: 'Solo familiares' },
              { value: 'ambos', label: 'Empleado y familiares' },
            ]} />
          <Field label="Modalidad" value={form.modalidad || 'descuento'} onChange={v => setForm({ ...form, modalidad: v })}
            options={[
              { value: 'descuento', label: 'Descuento %' },
              { value: 'valor_fijo', label: 'Valor fijo $' },
              { value: 'puntos', label: 'Puntos' },
              { value: 'acceso', label: 'Acceso (skipass)' },
            ]} />
        </div>
        {(form.aplica_a === 'familiar' || form.aplica_a === 'ambos') && (
          <RelacionesFamiliarPicker
            value={form.relaciones_familiar || ''}
            onChange={v => setForm({ ...form, relaciones_familiar: v })}
          />
        )}

        {/* === Valor === */}
        <SectionDivider label="Valor del beneficio" />
        <EscalaEditor
          value={form.escala_descuentos || ''}
          onChange={v => setForm({ ...form, escala_descuentos: v })}
          fallbackDescuento={form.descuento || ''}
          onFallbackChange={v => setForm({ ...form, descuento: v })}
        />
        <Field label="Valor fijo $ (alternativo)" value={form.valor_fijo || ''} onChange={v => setForm({ ...form, valor_fijo: v })} type="number" placeholder="Solo si modalidad = valor fijo" />

        {/* === Restricciones === */}
        <SectionDivider label="Restricciones y vigencia" />
        <Field label="Restricciones (texto libre)" value={form.restricciones || ''} onChange={v => setForm({ ...form, restricciones: v })}
          placeholder="Ej: No aplica a NIKE, POC, outlet ni promociones combinadas" />
        <div className="grid grid-cols-2 gap-3">
          <CheckboxField label="Excluye outlet" checked={form.excluye_outlet === 'true'} onChange={v => setForm({ ...form, excluye_outlet: v ? 'true' : '' })} />
          <CheckboxField label="Usa límite mensual de Jerarquía" checked={form.usa_limite_jerarquia === 'true'} onChange={v => setForm({ ...form, usa_limite_jerarquia: v ? 'true' : '' })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde" value={form.fecha_inicio || ''} onChange={v => setForm({ ...form, fecha_inicio: v })} type="date" required />
          <Field label="Hasta" value={form.fecha_fin || ''} onChange={v => setForm({ ...form, fecha_fin: v })} type="date" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Horario apertura" value={form.horario_inicio || ''} onChange={v => setForm({ ...form, horario_inicio: v })} type="time" />
          <Field label="Horario cierre" value={form.horario_fin || ''} onChange={v => setForm({ ...form, horario_fin: v })} type="time" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Límite usos diario" value={form.limite_uso_diario || ''} onChange={v => setForm({ ...form, limite_uso_diario: v })} type="number" />
          <Field label="Límite usos mensual" value={form.limite_uso_mensual || ''} onChange={v => setForm({ ...form, limite_uso_mensual: v })} type="number" />
        </div>

        {/* === Compat: tipo legacy === */}
        <input type="hidden" value={form.tipo || form.modalidad || 'descuento'} onChange={() => {}} />

        {modal?.mode === 'edit' && (
          <Field label="Estado" value={form.activo || 'true'} onChange={v => setForm({ ...form, activo: v })}
            options={[{ value: 'true', label: 'Activo' }, { value: 'false', label: 'Inactivo' }]} />
        )}
        {msg && <p style={{ fontSize: '12px', color: 'var(--danger-text)', textAlign: 'center', margin: '8px 0' }}>{msg}</p>}
        <Button variant="primary" size="lg" onClick={handleSave} loading={saving} style={{ width: '100%' }}>
          {modal?.mode === 'create' ? 'Crear beneficio' : 'Guardar cambios'}
        </Button>
      </Modal>

      {/* Modal Comercio */}
      <Modal open={modal?.type === 'comercio'} onClose={() => setModal(null)} title={modal?.mode === 'create' ? 'Nuevo comercio' : 'Editar comercio'}>
        <LogoUploader value={form.logo || ''} onChange={(v) => setForm({ ...form, logo: v })} />
        <Field label="Nombre" value={form.nombre || ''} onChange={v => setForm({ ...form, nombre: v })} required />
        <Field label="Dirección" value={form.direccion || ''} onChange={v => setForm({ ...form, direccion: v })} required />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ciudad" value={form.ciudad || ''} onChange={v => setForm({ ...form, ciudad: v })} required />
          <Field label="Provincia" value={form.provincia || ''} onChange={v => setForm({ ...form, provincia: v })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Teléfono" value={form.telefono || ''} onChange={v => setForm({ ...form, telefono: v })} />
          <Field label="Email" value={form.email || ''} onChange={v => setForm({ ...form, email: v })} type="email" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Apertura" value={form.horario_apertura || ''} onChange={v => setForm({ ...form, horario_apertura: v })} type="time" />
          <Field label="Cierre" value={form.horario_cierre || ''} onChange={v => setForm({ ...form, horario_cierre: v })} type="time" />
        </div>
        <Field label="Responsable" value={form.responsable || ''} onChange={v => setForm({ ...form, responsable: v })} />
        <Field
          label={modal?.mode === 'edit' ? 'PIN responsable (vacío = no cambiar)' : 'PIN responsable (4-8 dígitos, opcional)'}
          value={form.pin || ''}
          onChange={v => setForm({ ...form, pin: v.replace(/\D/g, '').slice(0, 8) })}
          type="password"
          placeholder="****"
        />
        <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: -8, marginBottom: 8 }}>
          🔒 El PIN permite al cajero autorizar canjes que excedan el límite mensual del colaborador. Si no se carga, no se pueden hacer overrides.
        </p>
        {modal?.mode === 'edit' && (
          <Field label="Estado" value={form.activo || 'true'} onChange={v => setForm({ ...form, activo: v })}
            options={[{ value: 'true', label: 'Activo' }, { value: 'false', label: 'Inactivo' }]} />
        )}
        {msg && <p style={{ fontSize: '12px', color: 'var(--danger-text)', textAlign: 'center', margin: '8px 0' }}>{msg}</p>}
        <Button variant="primary" size="lg" onClick={handleSave} loading={saving} style={{ width: '100%' }}>
          {modal?.mode === 'create' ? 'Crear comercio' : 'Guardar cambios'}
        </Button>
      </Modal>

      {/* Modal Beneficiario */}
      <Modal open={modal?.type === 'beneficiario'} onClose={() => setModal(null)} title={modal?.mode === 'create' ? 'Nuevo colaborador' : 'Editar colaborador'}>
        {modal?.mode === 'create' && (
          <Field label="DNI" value={form.dni || ''} onChange={v => setForm({ ...form, dni: v })} required placeholder="28348057" />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre" value={form.nombre || ''} onChange={v => setForm({ ...form, nombre: v })} required />
          <Field label="Apellido" value={form.apellido || ''} onChange={v => setForm({ ...form, apellido: v })} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" value={form.email || ''} onChange={v => setForm({ ...form, email: v })} type="email" />
          <Field label="Teléfono" value={form.telefono || ''} onChange={v => setForm({ ...form, telefono: v })} />
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
        {msg && <p style={{ fontSize: '12px', color: 'var(--danger-text)', textAlign: 'center', margin: '8px 0' }}>{msg}</p>}
        <Button variant="primary" size="lg" onClick={handleSave} loading={saving} style={{ width: '100%' }}>
          {modal?.mode === 'create' ? 'Crear colaborador' : 'Guardar cambios'}
        </Button>
      </Modal>

      {/* Modal motivo de desactivación */}
      <Modal open={!!motivoModal} onClose={() => setMotivoModal(null)} title={`Desactivar: ${motivoModal?.nombre || ''}`}>
        <p style={{ fontSize: '12.5px', color: 'var(--text-3)', marginBottom: 16 }}>
          El colaborador no podrá canjear beneficios mientras esté desactivado.
        </p>
        <Field label="Motivo" value={motivoInput} onChange={setMotivoInput} placeholder="Ej: Temporada baja, cesantía, baja voluntaria…" required />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Button variant="ghost" size="lg" onClick={() => setMotivoModal(null)} style={{ flex: 1 }}>Cancelar</Button>
          <Button
            variant="danger"
            size="lg"
            onClick={() => motivoModal && handleAutorizar(motivoModal.id, 'desactivar', motivoInput || 'Sin motivo')}
            disabled={!motivoInput.trim()}
            style={{ flex: 1 }}
          >
            Confirmar desactivación
          </Button>
        </div>
      </Modal>

      {/* Modal Jerarquía */}
      <Modal open={!!jerarquiaModal} onClose={() => setJerarquiaModal(null)} title={jerarquiaModal?.mode === 'create' ? 'Nueva jerarquía' : 'Editar jerarquía'}>
        <Field label="Nombre del cargo" value={jerarquiaForm.nombre || ''} onChange={v => setJerarquiaForm({ ...jerarquiaForm, nombre: v })} placeholder="Operario, Supervisor, Jefe…" required />
        <Field label="Orden de aparición" value={jerarquiaForm.orden || '0'} onChange={v => setJerarquiaForm({ ...jerarquiaForm, orden: v })} type="number" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Límite mensual $" value={jerarquiaForm.limite_mensual || '0'} onChange={v => setJerarquiaForm({ ...jerarquiaForm, limite_mensual: v })} type="number" placeholder="50000" required />
          <Field label="Límite Talento $" value={jerarquiaForm.limite_mensual_talento || '0'} onChange={v => setJerarquiaForm({ ...jerarquiaForm, limite_mensual_talento: v })} type="number" placeholder="80000" />
        </div>
        <Field label="Notas (opcional)" value={jerarquiaForm.notas || ''} onChange={v => setJerarquiaForm({ ...jerarquiaForm, notas: v })} placeholder="Comentarios internos sobre este cargo" />
        {jerarquiaMsg && <p style={{ fontSize: '12px', color: 'var(--danger-text)', textAlign: 'center', margin: '8px 0' }}>{jerarquiaMsg}</p>}
        <Button variant="primary" size="lg" onClick={handleSaveJerarquia} loading={jerarquiaSaving} style={{ width: '100%' }}>
          {jerarquiaModal?.mode === 'create' ? 'Crear jerarquía' : 'Guardar cambios'}
        </Button>
      </Modal>

      {/* Selección all hidden helper */}
      <span style={{ display: 'none' }} aria-hidden="true">{selectAll.toString().length}</span>
    </AppShell>
  );
}

// ============================================
// V2 — Form helpers: SectionDivider, CheckboxField, RelacionesFamiliarPicker, EscalaEditor
// ============================================
function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 12px', paddingBottom: 6, borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: '10.5px', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  );
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
      background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '6px',
      cursor: 'pointer', fontSize: '12.5px', color: 'var(--text-1)',
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ accentColor: 'var(--brand)', cursor: 'pointer' }}
      />
      {label}
    </label>
  );
}

function RelacionesFamiliarPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const relaciones = [
    { key: 'Parents', label: 'Madre/Padre' },
    { key: 'Spouse', label: 'Cónyuge' },
    { key: 'CivilUnion', label: 'Concubino/a' },
    { key: 'Child', label: 'Hijos' },
    { key: 'Sibling', label: 'Hermanos' },
  ];
  const selected = new Set((value || '').split(',').map(s => s.trim()).filter(Boolean));
  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange(Array.from(next).join(','));
  };
  return (
    <div style={{ marginTop: 8, marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-2)', marginBottom: 6, fontWeight: 500 }}>
        Relaciones familiares aceptadas
      </label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {relaciones.map(r => (
          <button
            key={r.key}
            type="button"
            onClick={() => toggle(r.key)}
            style={{
              padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
              background: selected.has(r.key) ? 'var(--brand-muted)' : 'var(--bg-elevated)',
              border: `1px solid ${selected.has(r.key) ? 'var(--brand-border)' : 'var(--border-default)'}`,
              color: selected.has(r.key) ? 'var(--brand)' : 'var(--text-2)',
              cursor: 'pointer',
            }}
          >
            {r.label}
          </button>
        ))}
      </div>
      <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 6 }}>
        Si no seleccionás ninguna, el beneficio aplica a cualquier familiar vinculado.
      </p>
    </div>
  );
}

function EscalaEditor({
  value, onChange, fallbackDescuento, onFallbackChange,
}: {
  value: string; onChange: (v: string) => void;
  fallbackDescuento: string; onFallbackChange: (v: string) => void;
}) {
  // Parseamos value como JSON. Si está vacío, mostramos solo el descuento simple.
  let parsed: any = null;
  try { if (value) parsed = typeof value === 'string' ? JSON.parse(value) : value; } catch { parsed = null; }

  const [usaEscala, setUsaEscala] = useState(!!parsed);
  const [tiers, setTiers] = useState<{ meses: string; pct: string }[]>(
    parsed?.tiers?.length ? parsed.tiers.map((t: any) => ({ meses: String(t.antiguedad_min_meses || 0), pct: String(t.porcentaje || 0) })) : [
      { meses: '0', pct: '20' }, { meses: '12', pct: '30' },
    ]
  );
  const [talentoPct, setTalentoPct] = useState(parsed?.talento_porcentaje != null ? String(parsed.talento_porcentaje) : '30');

  const sync = (newTiers: typeof tiers, newTalento: string, enabled: boolean) => {
    if (!enabled) {
      onChange('');
      return;
    }
    const payload = {
      tiers: newTiers.map(t => ({ antiguedad_min_meses: parseInt(t.meses || '0', 10), porcentaje: parseFloat(t.pct || '0') })),
      talento_porcentaje: parseFloat(newTalento || '0'),
    };
    onChange(JSON.stringify(payload));
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <CheckboxField
        label="Usar escala por antigüedad (cambia % según meses en la empresa)"
        checked={usaEscala}
        onChange={(v) => { setUsaEscala(v); sync(tiers, talentoPct, v); if (v) onFallbackChange(''); }}
      />
      {!usaEscala && (
        <div style={{ marginTop: 8 }}>
          <Field label="Descuento simple %" value={fallbackDescuento || ''} onChange={onFallbackChange} type="number" placeholder="15" />
        </div>
      )}
      {usaEscala && (
        <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: 8 }}>
            Definí los tiers en orden creciente de antigüedad. Ej: 0 meses = 20%, 12 meses = 30%.
          </p>
          {tiers.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <input
                type="number"
                placeholder="meses"
                value={t.meses}
                onChange={(e) => {
                  const nt = [...tiers]; nt[i] = { ...nt[i], meses: e.target.value };
                  setTiers(nt); sync(nt, talentoPct, usaEscala);
                }}
                style={{ width: 80, height: 32, padding: '0 10px', background: 'var(--bg-canvas)', border: '1px solid var(--border-default)', borderRadius: '6px', color: 'var(--text-1)', fontSize: '12.5px', outline: 'none' }}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>meses →</span>
              <input
                type="number"
                placeholder="%"
                value={t.pct}
                onChange={(e) => {
                  const nt = [...tiers]; nt[i] = { ...nt[i], pct: e.target.value };
                  setTiers(nt); sync(nt, talentoPct, usaEscala);
                }}
                style={{ width: 70, height: 32, padding: '0 10px', background: 'var(--bg-canvas)', border: '1px solid var(--border-default)', borderRadius: '6px', color: 'var(--text-1)', fontSize: '12.5px', outline: 'none' }}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>%</span>
              {tiers.length > 1 && (
                <button type="button" onClick={() => { const nt = tiers.filter((_, j) => j !== i); setTiers(nt); sync(nt, talentoPct, usaEscala); }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--danger-text)', cursor: 'pointer', fontSize: '14px' }}>×</button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => { const nt = [...tiers, { meses: '0', pct: '0' }]; setTiers(nt); sync(nt, talentoPct, usaEscala); }}
            style={{ marginTop: 4, padding: '6px 10px', background: 'var(--bg-canvas)', border: '1px dashed var(--border-default)', borderRadius: '6px', color: 'var(--text-2)', fontSize: '11.5px', cursor: 'pointer' }}>
            + Agregar tier
          </button>
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
            <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-3)', marginBottom: 4 }}>
              Override Talento Popper (% desde el día 1)
            </label>
            <input
              type="number"
              value={talentoPct}
              onChange={(e) => { setTalentoPct(e.target.value); sync(tiers, e.target.value, usaEscala); }}
              style={{ width: 100, height: 32, padding: '0 10px', background: 'var(--bg-canvas)', border: '1px solid var(--border-default)', borderRadius: '6px', color: 'var(--text-1)', fontSize: '12.5px', outline: 'none' }}
              placeholder="30"
            />
            <span style={{ fontSize: '12px', color: 'var(--text-3)', marginLeft: 6 }}>%</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// V3F — FamiliarFotoCell (upload foto inline)
// ============================================
function FamiliarFotoCell({ familiar, onUpload }: { familiar: any; onUpload: (id: string, dataUrl: string) => Promise<boolean> }) {
  const [uploading, setUploading] = useState(false);
  const handleClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 800 * 1024) { alert('Máx 800 KB'); return; }
      setUploading(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        const ok = await onUpload(familiar.id, e.target?.result as string);
        if (!ok) alert('Error subiendo foto');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };
  return (
    <button
      onClick={handleClick}
      title={familiar.foto ? 'Cambiar foto' : 'Subir foto del DNI / persona'}
      style={{
        width: 36, height: 36, borderRadius: '50%',
        background: familiar.foto ? 'transparent' : 'var(--bg-elevated)',
        border: `1px solid ${familiar.foto ? 'var(--brand-border)' : 'var(--border-default)'}`,
        cursor: 'pointer', padding: 0, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-3)',
      }}
    >
      {uploading ? '…' : familiar.foto ? (
        <img src={familiar.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
        </svg>
      )}
    </button>
  );
}

// ============================================
// V2 — RelacionBadge para familiares
// ============================================
function RelacionBadge({ relacion }: { relacion: string }) {
  const map: Record<string, { tone: 'brand' | 'success' | 'info' | 'warning' | 'neutral'; label: string }> = {
    Parents: { tone: 'info', label: 'Madre/Padre' },
    Spouse: { tone: 'success', label: 'Cónyuge' },
    CivilUnion: { tone: 'success', label: 'Concubino/a' },
    Child: { tone: 'brand', label: 'Hijo/a' },
    Sibling: { tone: 'neutral', label: 'Hermano/a' },
    Other: { tone: 'neutral', label: 'Otro' },
    Undefined: { tone: 'neutral', label: '—' },
  };
  const m = map[relacion] || map.Undefined;
  return <Badge tone={m.tone} size="sm">{m.label}</Badge>;
}

// ============================================
// HELPER COMPONENTS
// ============================================

function PageSection({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-0.01em', marginBottom: 4 }}>{title}</h1>
          {description && <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </div>
  );
}

function ItemCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        padding: 16,
        transition: 'all 120ms var(--ease-in-out)',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'var(--bg-raised)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}
    >
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>{label}</span>
      <span style={{ fontSize: '12px', color: 'var(--text-1)', textAlign: 'right' }}>{children}</span>
    </div>
  );
}

function CardFooterActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
      <Button variant="ghost" size="sm" onClick={onEdit} style={{ flex: 1 }}>Editar</Button>
      <Button variant="ghost" size="sm" onClick={onDelete} style={{ flex: 1, color: 'var(--danger-text)' }}>Eliminar</Button>
    </div>
  );
}

function InlineMessage({ tone, children }: { tone: 'success' | 'danger' | 'info' | 'warning'; children: React.ReactNode }) {
  const bg = `var(--${tone}-bg)`;
  const border = `var(--${tone}-border)`;
  const color = `var(--${tone}-text)`;
  return (
    <div style={{ padding: '10px 12px', background: bg, border: `1px solid ${border}`, borderRadius: '6px', marginBottom: 12 }}>
      <p style={{ fontSize: '12.5px', color }}>{children}</p>
    </div>
  );
}

function EmptyView({ icon, title, description, action }: { icon: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div style={{ padding: '64px 24px', textAlign: 'center' }}>
      <div style={{ color: 'var(--text-4)', marginBottom: 12, display: 'flex', justifyContent: 'center' }}>{icon}</div>
      <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>{title}</p>
      {description && <p style={{ fontSize: '12.5px', color: 'var(--text-3)', maxWidth: 360, margin: '0 auto 16px' }}>{description}</p>}
      {action}
    </div>
  );
}

function ActionCard({ title, description, actionLabel, onAction, tone = 'brand', loading }: { title: string; description: string; actionLabel: string; onAction: () => void; tone?: 'brand' | 'warning'; loading?: boolean }) {
  return (
    <div style={{
      padding: 16,
      background: tone === 'warning' ? 'var(--warning-bg)' : 'var(--bg-elevated)',
      border: `1px solid ${tone === 'warning' ? 'var(--warning-border)' : 'var(--border-subtle)'}`,
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div>
        <p style={{ fontSize: '13px', fontWeight: 600, color: tone === 'warning' ? 'var(--warning-text)' : 'var(--text-1)' }}>{title}</p>
        <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: 4, lineHeight: 1.5 }}>{description}</p>
      </div>
      <Button variant={tone === 'warning' ? 'outline' : 'primary'} size="sm" onClick={onAction} loading={loading}>{actionLabel}</Button>
    </div>
  );
}

function GroupBlockPanel({
  title, items, beneficiarios, tipoKey, motivo, setMotivo, filtroValue, setFiltroValue, onAction,
}: {
  title: string; items: string[]; beneficiarios: any[]; tipoKey: string;
  motivo: string; setMotivo: (v: string) => void;
  filtroValue: string; setFiltroValue: (v: string) => void;
  onAction: (valor: string, accion: 'activar' | 'desactivar') => void;
}) {
  const activos = beneficiarios.filter((b: any) => b[tipoKey] === filtroValue && b.activo).length;
  const inactivos = beneficiarios.filter((b: any) => b[tipoKey] === filtroValue && !b.activo).length;
  return (
    <Panel title={title} description="Bloqueá o desbloqueá todos los colaboradores del grupo a la vez.">
      <select
        value={filtroValue}
        onChange={(e) => setFiltroValue(e.target.value)}
        style={{
          width: '100%', height: 36, padding: '0 10px',
          background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
          borderRadius: '6px', color: 'var(--text-1)', fontSize: '13px', outline: 'none',
          marginBottom: 8,
        }}
      >
        <option value="">— Seleccionar —</option>
        {items.map(x => <option key={x} value={x}>{x}</option>)}
      </select>
      {filtroValue && (
        <>
          <p style={{ fontSize: '11.5px', color: 'var(--text-3)', marginBottom: 10 }}>
            <span style={{ color: 'var(--success-text)' }}>{activos} activos</span>
            {' · '}
            <span style={{ color: 'var(--danger-text)' }}>{inactivos} inactivos</span>
          </p>
          <input
            placeholder="Motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            style={{
              width: '100%', height: 32, padding: '0 10px',
              background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
              borderRadius: '6px', color: 'var(--text-1)', fontSize: '12px', outline: 'none',
              marginBottom: 8,
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <Button variant="danger" size="sm" onClick={() => onAction(filtroValue, 'desactivar')} style={{ flex: 1 }}>Bloquear</Button>
            <Button variant="success" size="sm" onClick={() => onAction(filtroValue, 'activar')} style={{ flex: 1 }}>Desbloquear</Button>
          </div>
        </>
      )}
    </Panel>
  );
}

// ============================================
// LogoUploader — file picker que convierte a base64 inline
// ============================================
function LogoUploader({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [error, setError] = useState('');
  const handleFile = async (file: File) => {
    setError('');
    if (file.size > 600 * 1024) {
      setError('Imagen muy pesada. Máximo 600 KB.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      onChange(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <label
        style={{
          display: 'block',
          fontSize: '12px',
          fontWeight: 500,
          color: 'var(--text-2)',
          marginBottom: 6,
        }}
      >
        Logo del comercio
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Preview */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '8px',
            background: value ? 'var(--bg-canvas)' : 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {value ? (
            <img
              src={value}
              alt="Logo"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-4)' }}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                background: 'var(--bg-raised)',
                border: '1px solid var(--border-default)',
                borderRadius: '6px',
                color: 'var(--text-1)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 120ms var(--ease-in-out)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              {value ? 'Cambiar' : 'Subir logo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = '';
                }}
              />
            </label>
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                style={{
                  padding: '7px 10px',
                  background: 'transparent',
                  border: '1px solid var(--border-default)',
                  borderRadius: '6px',
                  color: 'var(--danger-text)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 120ms var(--ease-in-out)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--danger-bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Quitar
              </button>
            )}
          </div>
          <p style={{ fontSize: '11px', color: error ? 'var(--danger-text)' : 'var(--text-3)' }}>
            {error || 'PNG, JPG, WEBP o SVG. Máx 600 KB.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function DashboardEmpty({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={{
      padding: '64px 24px',
      textAlign: 'center',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '12px',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: 'var(--bg-raised)', border: '1px solid var(--border-default)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px', color: 'var(--text-3)',
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9-3.75h.008v.008H12V8.25zm-.001 7.5h.008v.008H12v-.008z" />
          <path d="M12 8v4" />
        </svg>
      </div>
      <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-1)', marginBottom: 6 }}>
        No pudimos cargar los datos
      </h2>
      <p style={{ fontSize: '12.5px', color: 'var(--text-3)', maxWidth: 360, margin: '0 auto 20px', lineHeight: 1.5 }}>
        Verificá tu conexión o tu sesión. Si el problema persiste, refrescá la página.
      </p>
      <Button variant="primary" size="md" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeIn 200ms var(--ease-out)' }}>
      <div>
        <div className="skeleton" style={{ height: 24, width: 240, marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 14, width: 360 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ padding: 16, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
            <div className="skeleton" style={{ height: 12, width: 80, marginBottom: 16 }} />
            <div className="skeleton" style={{ height: 24, width: 60 }} />
          </div>
        ))}
      </div>
      <div className="skeleton" style={{ height: 280, width: '100%', borderRadius: '8px' }} />
    </div>
  );
}

// Lightweight wrapper icons re-exported with semantic names
const PlusIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const DownloadIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);
const TrashIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
const RefreshIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);
const CopyIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const GiftIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 12 20 22 4 22 4 12" />
    <rect x="2" y="7" width="20" height="5" />
    <line x1="12" y1="22" x2="12" y2="7" />
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
  </svg>
);
const StoreIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l1-5h16l1 5M3 9v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9M3 9h18M9 22V12h6v10" />
  </svg>
);
const QrCodeIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <path d="M14 14h3v3h-3zM21 14h-3M14 21h3v-3M21 17v4" />
  </svg>
);
const KeyRoundIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 18v3h3l11-11a4 4 0 1 0-3-3L2 18z" />
  </svg>
);
const SparklesIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const HeartIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);
const LayersIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);
