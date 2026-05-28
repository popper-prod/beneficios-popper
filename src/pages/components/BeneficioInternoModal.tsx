import { useState, useEffect } from 'react';
import { X as XIcon, Plus as PlusIcon, Trash2 as TrashIcon } from 'lucide-react';

// ============================================
// Modal de edición de Beneficios Internos
// UI rica con escala de descuentos visual
// (no JSON crudo como el modal genérico).
// ============================================

const RELACIONES = [
  { value: 'Parents', label: 'Padres' },
  { value: 'Spouse', label: 'Cónyuge' },
  { value: 'CivilUnion', label: 'Concubino/a' },
  { value: 'Child', label: 'Hijos' },
  { value: 'Sibling', label: 'Hermanos' },
];

const CATEGORIAS = ['skipass', 'indumentaria', 'calzado', 'accesorios', 'equipos_nieve', 'gastronomia', 'recreacion', 'otra'];
const MODALIDADES = ['acceso', 'descuento', 'gratuito', 'puntos'];

type EscalaMode = 'titular-familiar' | 'tiers' | 'fijo' | 'gratuito';

type Tier = { antiguedad_meses: number; porcentaje: number };

export interface BeneficioInternoForm {
  id?: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  modalidad: string;
  fecha_inicio: string;
  fecha_fin: string;
  horario_inicio: string;
  horario_fin: string;
  aplica_a: 'empleado' | 'familiar' | 'ambos' | 'talento';
  relaciones_familiar: string[]; // ['Parents', 'Spouse', ...]
  escalaMode: EscalaMode;
  // titular-familiar:
  titularGratis: boolean;
  titularPct: number;
  familiarGratis: boolean;
  familiarPct: number;
  // tiers:
  tiers: Tier[];
  talentoOverride: boolean;
  talentoPct: number;
  // fijo:
  descuentoFijo: number;
  // Flags
  usa_limite_jerarquia: boolean;
  excluye_outlet: boolean;
  limite_total: number | '';
  limite_uso_diario: number | '';
  limite_uso_mensual: number | '';
  restricciones: string;
  activo: boolean;
}

const EMPTY_FORM: BeneficioInternoForm = {
  nombre: '', descripcion: '', categoria: 'skipass', modalidad: 'acceso',
  fecha_inicio: `${new Date().getFullYear()}-01-01`, fecha_fin: `${new Date().getFullYear()}-12-31`,
  horario_inicio: '08:00', horario_fin: '22:00',
  aplica_a: 'ambos',
  relaciones_familiar: ['Parents', 'Spouse', 'CivilUnion', 'Child'],
  escalaMode: 'titular-familiar',
  titularGratis: true, titularPct: 100,
  familiarGratis: false, familiarPct: 50,
  tiers: [{ antiguedad_meses: 0, porcentaje: 20 }, { antiguedad_meses: 12, porcentaje: 30 }],
  talentoOverride: false, talentoPct: 30,
  descuentoFijo: 20,
  usa_limite_jerarquia: false,
  excluye_outlet: false,
  limite_total: '',
  limite_uso_diario: '',
  limite_uso_mensual: '',
  restricciones: '',
  activo: true,
};

// Convierte un beneficio cargado desde la API en estado del form
export function beneficioToForm(b: any): BeneficioInternoForm {
  let escala: any = null;
  if (b.escala_descuentos) {
    escala = typeof b.escala_descuentos === 'string' ? (() => { try { return JSON.parse(b.escala_descuentos); } catch { return null; } })() : b.escala_descuentos;
  }
  let escalaMode: EscalaMode = 'fijo';
  if (escala?.titular != null || escala?.familiar != null) escalaMode = 'titular-familiar';
  else if (Array.isArray(escala?.tiers)) escalaMode = 'tiers';
  else if (b.tipo === 'gratuito') escalaMode = 'gratuito';
  return {
    id: b.id,
    nombre: b.nombre || '',
    descripcion: b.descripcion || '',
    categoria: b.categoria || 'otra',
    modalidad: b.modalidad || 'descuento',
    fecha_inicio: b.fecha_inicio?.split('T')[0] || `${new Date().getFullYear()}-01-01`,
    fecha_fin: b.fecha_fin?.split('T')[0] || `${new Date().getFullYear()}-12-31`,
    horario_inicio: b.horario_inicio || '08:00',
    horario_fin: b.horario_fin || '22:00',
    aplica_a: (b.aplica_a as any) || 'empleado',
    relaciones_familiar: b.relaciones_familiar ? String(b.relaciones_familiar).split(',').map((s: string) => s.trim()).filter(Boolean) : [],
    escalaMode,
    titularGratis: escala?.titular?.tipo === 'gratuito',
    titularPct: escala?.titular?.porcentaje ?? 100,
    familiarGratis: escala?.familiar?.tipo === 'gratuito',
    familiarPct: escala?.familiar?.porcentaje ?? 50,
    tiers: Array.isArray(escala?.tiers) && escala.tiers.length > 0
      ? escala.tiers.map((t: any) => ({ antiguedad_meses: t.antiguedad_min_meses ?? 0, porcentaje: t.porcentaje ?? 0 }))
      : [{ antiguedad_meses: 0, porcentaje: 20 }],
    talentoOverride: escala?.talento_porcentaje != null,
    talentoPct: escala?.talento_porcentaje ?? 30,
    descuentoFijo: b.descuento ?? 0,
    usa_limite_jerarquia: !!b.usa_limite_jerarquia,
    excluye_outlet: !!b.excluye_outlet,
    limite_total: b.limite_total ?? '',
    limite_uso_diario: b.limite_uso_diario ?? '',
    limite_uso_mensual: b.limite_uso_mensual ?? '',
    restricciones: b.restricciones || '',
    activo: b.activo !== false,
  };
}

// Convierte el form al payload del backend
export function formToPayload(f: BeneficioInternoForm) {
  let escala_descuentos: any = null;
  let descuento: number | null = null;
  let tipo: string = f.modalidad === 'acceso' ? 'acceso' : 'descuento';

  if (f.escalaMode === 'titular-familiar') {
    escala_descuentos = {
      titular: f.titularGratis ? { tipo: 'gratuito', porcentaje: 100 } : { tipo: 'descuento', porcentaje: Number(f.titularPct) || 0 },
      familiar: f.familiarGratis ? { tipo: 'gratuito', porcentaje: 100 } : { tipo: 'descuento', porcentaje: Number(f.familiarPct) || 0 },
    };
  } else if (f.escalaMode === 'tiers') {
    escala_descuentos = {
      tiers: f.tiers.map(t => ({ antiguedad_min_meses: Number(t.antiguedad_meses) || 0, porcentaje: Number(t.porcentaje) || 0 })),
      ...(f.talentoOverride ? { talento_porcentaje: Number(f.talentoPct) || 0 } : {}),
    };
  } else if (f.escalaMode === 'fijo') {
    descuento = Number(f.descuentoFijo) || 0;
  } else if (f.escalaMode === 'gratuito') {
    tipo = 'gratuito';
  }

  return {
    nombre: f.nombre.trim(),
    descripcion: f.descripcion.trim() || null,
    tipo,
    nivel_minimo: 'bronce',
    descuento,
    valor_fijo: null,
    fecha_inicio: f.fecha_inicio,
    fecha_fin: f.fecha_fin,
    horario_inicio: f.horario_inicio || null,
    horario_fin: f.horario_fin || null,
    limite_uso_diario: f.limite_uso_diario === '' ? null : Number(f.limite_uso_diario),
    limite_uso_mensual: f.limite_uso_mensual === '' ? null : Number(f.limite_uso_mensual),
    activo: f.activo,
    // V2
    origen: 'interno',
    categoria: f.categoria,
    aplica_a: f.aplica_a,
    modalidad: f.modalidad,
    escala_descuentos,
    restricciones: f.restricciones.trim() || null,
    excluye_outlet: f.excluye_outlet,
    relaciones_familiar: (f.aplica_a === 'familiar' || f.aplica_a === 'ambos') && f.relaciones_familiar.length > 0
      ? f.relaciones_familiar.join(',')
      : null,
    usa_limite_jerarquia: f.usa_limite_jerarquia,
  };
}

// ============================================
// Componente
// ============================================

interface Props {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: any; // beneficio cargado de la API si es edit
  onClose: () => void;
  onSave: (payload: any, id?: string) => Promise<void>;
}

export function BeneficioInternoModal({ open, mode, initial, onClose, onSave }: Props) {
  const [f, setF] = useState<BeneficioInternoForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (open) {
      setF(mode === 'edit' && initial ? beneficioToForm(initial) : EMPTY_FORM);
      setMsg('');
    }
  }, [open, mode, initial]);

  const aplicaIncluyeFamiliar = f.aplica_a === 'familiar' || f.aplica_a === 'ambos';

  const handleSave = async () => {
    if (!f.nombre.trim()) { setMsg('El nombre es requerido'); return; }
    if (!f.fecha_inicio || !f.fecha_fin) { setMsg('Las fechas son requeridas'); return; }
    setSaving(true); setMsg('');
    try {
      await onSave(formToPayload(f), f.id);
      onClose();
    } catch (e: any) {
      setMsg(e?.message || 'Error al guardar');
    }
    setSaving(false);
  };

  if (!open) return null;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '40px 16px', zIndex: 100, overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
        borderRadius: '12px', padding: '24px', maxWidth: 640, width: '100%',
        maxHeight: 'calc(100vh - 80px)', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-1)' }}>
            {mode === 'create' ? 'Nuevo beneficio interno' : 'Editar beneficio interno'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 4 }}>
            <XIcon size={18} />
          </button>
        </div>

        {/* Identidad */}
        <Section title="Identidad">
          <Field label="Nombre" value={f.nombre} onChange={v => setF({ ...f, nombre: v })} placeholder="Pase de Esquí · Temporada" required />
          <Field label="Descripción" value={f.descripcion} onChange={v => setF({ ...f, descripcion: v })} multiline placeholder="Qué es, quién lo usa, qué cubre…" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Categoría" value={f.categoria} onChange={v => setF({ ...f, categoria: v })} options={CATEGORIAS.map(c => ({ value: c, label: c.replace('_', ' ') }))} />
            <Field label="Modalidad" value={f.modalidad} onChange={v => setF({ ...f, modalidad: v })} options={MODALIDADES.map(m => ({ value: m, label: m }))} />
          </div>
        </Section>

        {/* Aplica a */}
        <Section title="¿Quién lo puede canjear?">
          <PillSelect
            value={f.aplica_a}
            onChange={v => setF({ ...f, aplica_a: v as any })}
            options={[
              { value: 'empleado', label: 'Solo titular' },
              { value: 'familiar', label: 'Solo familiares' },
              { value: 'ambos', label: 'Titular + familiares' },
              { value: 'talento', label: '★ Solo Talento' },
            ]}
          />
          {aplicaIncluyeFamiliar && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: '11.5px', color: 'var(--text-3)', marginBottom: 8, letterSpacing: '0.02em' }}>Relaciones familiares permitidas:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {RELACIONES.map(r => {
                  const checked = f.relaciones_familiar.includes(r.value);
                  return (
                    <button
                      key={r.value}
                      onClick={() => {
                        const next = checked
                          ? f.relaciones_familiar.filter(x => x !== r.value)
                          : [...f.relaciones_familiar, r.value];
                        setF({ ...f, relaciones_familiar: next });
                      }}
                      style={{
                        padding: '4px 10px', borderRadius: 999, fontSize: '11.5px', fontWeight: 500,
                        cursor: 'pointer', transition: 'all 150ms ease',
                        background: checked ? 'var(--brand-muted)' : 'var(--bg-surface)',
                        border: `1px solid ${checked ? 'var(--brand-border)' : 'var(--border-subtle)'}`,
                        color: checked ? 'var(--brand)' : 'var(--text-3)',
                      }}
                    >
                      {checked ? '✓ ' : ''}{r.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Section>

        {/* Cálculo del % */}
        <Section title="Cómo se calcula el descuento">
          <PillSelect
            value={f.escalaMode}
            onChange={v => setF({ ...f, escalaMode: v as EscalaMode })}
            options={[
              { value: 'titular-familiar', label: 'Titular vs Familiar' },
              { value: 'tiers', label: 'Por antigüedad' },
              { value: 'fijo', label: 'Descuento fijo' },
              { value: 'gratuito', label: 'Gratis total' },
            ]}
          />

          {f.escalaMode === 'titular-familiar' && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <TipoTitularFamiliarRow
                label="Titular"
                gratis={f.titularGratis} onToggleGratis={v => setF({ ...f, titularGratis: v })}
                pct={f.titularPct} onPctChange={v => setF({ ...f, titularPct: v })}
              />
              <TipoTitularFamiliarRow
                label="Familiar"
                gratis={f.familiarGratis} onToggleGratis={v => setF({ ...f, familiarGratis: v })}
                pct={f.familiarPct} onPctChange={v => setF({ ...f, familiarPct: v })}
              />
            </div>
          )}

          {f.escalaMode === 'tiers' && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {f.tiers.map((t, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 32px', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>Antigüedad mínima</span>
                  <input
                    type="number" min={0}
                    value={t.antiguedad_meses}
                    onChange={e => setF({ ...f, tiers: f.tiers.map((x, j) => j === i ? { ...x, antiguedad_meses: parseInt(e.target.value || '0') } : x) })}
                    style={inputStyle()}
                  />
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number" min={0} max={100}
                      value={t.porcentaje}
                      onChange={e => setF({ ...f, tiers: f.tiers.map((x, j) => j === i ? { ...x, porcentaje: parseInt(e.target.value || '0') } : x) })}
                      style={{ ...inputStyle(), paddingRight: 24 }}
                    />
                    <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-3)' }}>%</span>
                  </div>
                  <button onClick={() => setF({ ...f, tiers: f.tiers.filter((_, j) => j !== i) })} disabled={f.tiers.length === 1}
                    style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: f.tiers.length === 1 ? 'not-allowed' : 'pointer', padding: 4, opacity: f.tiers.length === 1 ? 0.3 : 1 }}>
                    <TrashIcon size={14} />
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: '0', fontSize: '10.5px', color: 'var(--text-4)', fontStyle: 'italic' }}>
                <span style={{ marginLeft: 'auto' }}>antigüedad en meses · porcentaje</span>
              </div>
              <button onClick={() => setF({ ...f, tiers: [...f.tiers, { antiguedad_meses: 24, porcentaje: 40 }] })}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  padding: '8px 12px', background: 'var(--bg-surface)', border: '1px dashed var(--border-default)',
                  borderRadius: 8, fontSize: '12px', color: 'var(--text-2)', cursor: 'pointer', marginTop: 4,
                }}>
                <PlusIcon size={12} /> Agregar tier
              </button>

              {/* Talento override */}
              <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={f.talentoOverride} onChange={e => setF({ ...f, talentoOverride: e.target.checked })} />
                  <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>★ Talento Popper accede a un % diferente (override desde día 1)</span>
                </label>
                {f.talentoOverride && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>Porcentaje para Talento:</span>
                    <div style={{ position: 'relative', width: 100 }}>
                      <input type="number" min={0} max={100} value={f.talentoPct}
                        onChange={e => setF({ ...f, talentoPct: parseInt(e.target.value || '0') })}
                        style={{ ...inputStyle(), paddingRight: 24 }} />
                      <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-3)' }}>%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {f.escalaMode === 'fijo' && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '12.5px', color: 'var(--text-2)' }}>Todos canjean al mismo porcentaje:</span>
              <div style={{ position: 'relative', width: 110 }}>
                <input type="number" min={0} max={100} value={f.descuentoFijo}
                  onChange={e => setF({ ...f, descuentoFijo: parseInt(e.target.value || '0') })}
                  style={{ ...inputStyle(), paddingRight: 24 }} />
                <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-3)' }}>%</span>
              </div>
            </div>
          )}

          {f.escalaMode === 'gratuito' && (
            <p style={{ marginTop: 12, fontSize: '12px', color: 'var(--text-3)', fontStyle: 'italic' }}>
              Gratuito 100% para todos los que cumplan con "Aplica a".
            </p>
          )}
        </Section>

        {/* Flags */}
        <Section title="Reglas adicionales">
          <Toggle label="🔒 Descuenta del cupo mensual de la jerarquía del colaborador"
            checked={f.usa_limite_jerarquia} onChange={v => setF({ ...f, usa_limite_jerarquia: v })} />
          <Toggle label="🚫 Excluye outlet (no aplica a productos de outlet)"
            checked={f.excluye_outlet} onChange={v => setF({ ...f, excluye_outlet: v })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
            <Field label="Máx total/persona" type="number" value={String(f.limite_total)} onChange={v => setF({ ...f, limite_total: v === '' ? '' : parseInt(v) || 0 })} placeholder="—" />
            <Field label="Máx por día" type="number" value={String(f.limite_uso_diario)} onChange={v => setF({ ...f, limite_uso_diario: v === '' ? '' : parseInt(v) || 0 })} placeholder="—" />
            <Field label="Máx por mes" type="number" value={String(f.limite_uso_mensual)} onChange={v => setF({ ...f, limite_uso_mensual: v === '' ? '' : parseInt(v) || 0 })} placeholder="—" />
          </div>
          <Field label="Restricciones (texto libre, aparece en la tablet)" value={f.restricciones} onChange={v => setF({ ...f, restricciones: v })} multiline placeholder="Ej: No aplica a marcas excluidas, no se acumula con outlet, etc." />
        </Section>

        {/* Vigencia */}
        <Section title="Vigencia">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Desde" type="date" value={f.fecha_inicio} onChange={v => setF({ ...f, fecha_inicio: v })} required />
            <Field label="Hasta" type="date" value={f.fecha_fin} onChange={v => setF({ ...f, fecha_fin: v })} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Horario inicio" type="time" value={f.horario_inicio} onChange={v => setF({ ...f, horario_inicio: v })} />
            <Field label="Horario fin" type="time" value={f.horario_fin} onChange={v => setF({ ...f, horario_fin: v })} />
          </div>
          {mode === 'edit' && (
            <Toggle label="Beneficio activo" checked={f.activo} onChange={v => setF({ ...f, activo: v })} />
          )}
        </Section>

        {msg && (
          <p style={{ fontSize: '12px', color: 'var(--danger-text)', textAlign: 'center', margin: '12px 0', padding: '8px', background: 'var(--danger-bg)', borderRadius: 6 }}>{msg}</p>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '10px 18px', background: 'transparent', border: '1px solid var(--border-default)',
            borderRadius: 8, color: 'var(--text-2)', fontSize: '13px', cursor: 'pointer',
          }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '10px 18px', background: 'var(--brand)', border: 'none',
            borderRadius: 8, color: '#000', fontSize: '13px', fontWeight: 600, cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}>{saving ? 'Guardando…' : (mode === 'create' ? 'Crear beneficio' : 'Guardar cambios')}</button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Sub-componentes auxiliares
// ============================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18, paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
      <h3 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: '100%', padding: '8px 10px', background: 'var(--bg-canvas)',
    border: '1px solid var(--border-default)', borderRadius: 6,
    color: 'var(--text-1)', fontSize: '12.5px', outline: 'none',
    fontVariantNumeric: 'tabular-nums',
  };
}

function Field({
  label, value, onChange, type = 'text', placeholder, multiline, options, required
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
  placeholder?: string; multiline?: boolean;
  options?: { value: string; label: string }[]; required?: boolean;
}) {
  return (
    <div>
      <label style={{ fontSize: '11px', color: 'var(--text-3)', display: 'block', marginBottom: 4, letterSpacing: '0.02em' }}>
        {label}{required && <span style={{ color: 'var(--brand)' }}> *</span>}
      </label>
      {options ? (
        <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle()}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={2}
          style={{ ...inputStyle(), resize: 'vertical', fontFamily: 'inherit', minHeight: 56 }} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle()} />
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 6, cursor: 'pointer' }}>
      <div style={{
        position: 'relative', width: 32, height: 18, borderRadius: 9, flexShrink: 0,
        background: checked ? 'var(--brand)' : 'rgba(255,255,255,0.15)',
        transition: 'background 150ms ease',
      }}>
        <div style={{
          position: 'absolute', top: 2, left: checked ? 16 : 2, width: 14, height: 14,
          borderRadius: '50%', background: 'white', transition: 'left 150ms ease',
          boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
        }} />
      </div>
      <span style={{ fontSize: '12.5px', color: 'var(--text-2)', flex: 1 }}>{label}</span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ display: 'none' }} />
    </label>
  );
}

function PillSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(o => {
        const active = o.value === value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)} style={{
            padding: '6px 12px', borderRadius: 999, fontSize: '12px', fontWeight: 500,
            cursor: 'pointer', transition: 'all 150ms ease',
            background: active ? 'var(--brand-muted)' : 'var(--bg-surface)',
            border: `1px solid ${active ? 'var(--brand-border)' : 'var(--border-subtle)'}`,
            color: active ? 'var(--brand)' : 'var(--text-3)',
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

function TipoTitularFamiliarRow({
  label, gratis, onToggleGratis, pct, onPctChange
}: {
  label: string; gratis: boolean; onToggleGratis: (v: boolean) => void;
  pct: number; onPctChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
      <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--text-1)', minWidth: 64 }}>{label}</span>
      <PillSelect
        value={gratis ? 'gratis' : 'descuento'}
        onChange={v => onToggleGratis(v === 'gratis')}
        options={[
          { value: 'gratis', label: 'Gratis' },
          { value: 'descuento', label: 'Descuento %' },
        ]}
      />
      {!gratis && (
        <div style={{ position: 'relative', width: 100, marginLeft: 'auto' }}>
          <input type="number" min={0} max={100} value={pct}
            onChange={e => onPctChange(parseInt(e.target.value || '0'))}
            style={{ ...inputStyle(), paddingRight: 24 }} />
          <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-3)' }}>%</span>
        </div>
      )}
      {gratis && (
        <span style={{ marginLeft: 'auto', fontSize: '14px', fontWeight: 700, color: 'var(--brand)' }}>GRATIS</span>
      )}
    </div>
  );
}
