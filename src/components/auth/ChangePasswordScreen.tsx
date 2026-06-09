import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react';

// ============================================
// ChangePasswordScreen — cambio forzado tras un reset
// Mismo lenguaje visual que LoginScreen
// ============================================

interface ChangePasswordScreenProps {
  onSubmit: (actual: string, nueva: string) => Promise<{ ok: boolean; error?: string }>;
  onLogout: () => void;
}

export const ChangePasswordScreen: React.FC<ChangePasswordScreenProps> = ({ onSubmit, onLogout }) => {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (nueva.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (nueva !== repetir) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (nueva === actual) {
      setError('La nueva contraseña debe ser distinta a la temporal.');
      return;
    }
    setLoading(true);
    const res = await onSubmit(actual, nueva);
    setLoading(false);
    if (!res.ok) setError(res.error || 'No se pudo cambiar la contraseña.');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', display: 'grid', gridTemplateRows: '1fr auto' }}>
      <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: 380, animation: 'fadeInUp 320ms var(--ease-out)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, justifyContent: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'var(--brand)', color: 'var(--brand-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={17} />
            </div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.2 }}>Grupo Popper</p>
              <p style={{ fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.2, marginTop: 1 }}>Beneficios</p>
            </div>
          </div>

          <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-0.02em', marginBottom: 8, textAlign: 'center' }}>
            Creá tu contraseña
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center', marginBottom: 28, lineHeight: 1.5 }}>
            Por seguridad, definí una contraseña nueva para reemplazar la temporal.
          </p>

          <form onSubmit={handleSubmit}>
            <Field label="Contraseña temporal" value={actual} onChange={setActual} type={show ? 'text' : 'password'} autoComplete="current-password" autoFocus />
            <div style={{ position: 'relative' }}>
              <Field label="Nueva contraseña" value={nueva} onChange={setNueva} type={show ? 'text' : 'password'} autoComplete="new-password" hint="Mínimo 8 caracteres" />
              <button
                type="button"
                onClick={() => setShow(s => !s)}
                tabIndex={-1}
                style={{ position: 'absolute', right: 8, top: 30, background: 'none', border: 'none', color: 'var(--text-3)', padding: 6, cursor: 'pointer', display: 'flex', borderRadius: '4px' }}
              >
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <Field label="Repetir nueva contraseña" value={repetir} onChange={setRepetir} type={show ? 'text' : 'password'} autoComplete="new-password" />

            <button type="submit" disabled={loading || !actual || !nueva || !repetir} style={primaryBtnStyle(loading || !actual || !nueva || !repetir, loading)}>
              {loading ? (
                <>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid currentColor', borderTopColor: 'transparent', animation: 'spin 600ms linear infinite' }} />
                  Guardando
                </>
              ) : (
                <>
                  Guardar y entrar
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          {error && (
            <div style={{ marginTop: 16, padding: '10px 12px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: '6px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <AlertCircle size={14} style={{ color: 'var(--danger-text)', flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: '12.5px', color: 'var(--danger-text)', lineHeight: 1.5 }}>{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={onLogout}
            style={{ marginTop: 20, width: '100%', background: 'none', border: 'none', color: 'var(--text-3)', fontSize: '12px', cursor: 'pointer' }}
          >
            Cancelar y salir
          </button>
        </div>
      </main>

      <footer style={{ padding: '24px', textAlign: 'center', borderTop: '1px solid var(--border-subtle)' }}>
        <p style={{ fontSize: '11px', color: 'var(--text-4)' }}>© 2026 Recluta · Acceso seguro</p>
      </footer>
    </div>
  );
};

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  autoComplete?: string;
  autoFocus?: boolean;
  hint?: string;
}

const Field: React.FC<FieldProps> = ({ label, value, onChange, type, autoComplete, autoFocus, hint }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 }}>{label}</label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      autoComplete={autoComplete}
      autoFocus={autoFocus}
      required
      style={{ width: '100%', height: 40, padding: '0 40px 0 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '6px', color: 'var(--text-1)', fontSize: '13px', outline: 'none' }}
      onFocus={e => { e.target.style.borderColor = 'var(--brand)'; e.target.style.boxShadow = '0 0 0 3px var(--brand-subtle)'; }}
      onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; }}
    />
    {hint && <p style={{ fontSize: '11px', color: 'var(--text-4)', marginTop: 4 }}>{hint}</p>}
  </div>
);

function primaryBtnStyle(disabled: boolean, loading?: boolean): React.CSSProperties {
  return {
    width: '100%',
    height: 40,
    marginTop: 8,
    background: disabled ? 'rgba(212, 160, 23, 0.4)' : 'var(--brand)',
    color: 'var(--brand-fg)',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    opacity: disabled && !loading ? 0.6 : 1,
  };
}

export default ChangePasswordScreen;
