import { useState, useEffect } from 'react';
import { MapPin, Clock, ChevronRight, Check, AlertCircle, ArrowLeft, RotateCw, Copy } from 'lucide-react';

// ============================================
// QRPage — Apple Wallet / Mercado Pago aesthetic
// Consumer experience, card-first, photo-prominent, tier-as-color
// ============================================

const API_URL = import.meta.env.VITE_API_URL || 'https://beneficios-backend-jfpx.onrender.com/api';

interface Comercio {
  id: string;
  nombre: string;
  direccion: string;
  ciudad: string;
  telefono: string;
  horario_apertura: string;
  horario_cierre: string;
  responsable: string;
  logo?: string | null;
}

interface Beneficiario {
  dni: string;
  nombre: string;
  apellido: string;
  foto: string | null;
  nivel: string;
  departamento: string;
  cargo?: string;
  legajo?: string;
  empresa: string;
  es_talento_popper?: boolean;
  antiguedad_meses?: number;
}

interface FamiliarInfo {
  es_familiar: true;
  relacion: string;
  titular: { dni: string; nombre: string; apellido: string };
}

interface Beneficio {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: string;
  descuento: number | null;
  valor_fijo: number | null;
  categoria?: string;
  origen?: 'interno' | 'externo';
  modalidad?: string;
  restricciones?: string | null;
  excluye_outlet?: boolean;
  usa_limite_jerarquia?: boolean;
  nivel_minimo: string;
  saldo?: {
    limite_mensual?: number;
    gastado_mes?: number;
    disponible?: number;
    jerarquia?: string;
    sin_jerarquia?: boolean;
  } | null;
}

interface HistorialItem {
  fecha_verificacion: string;
  beneficio_nombre: string;
  beneficio_tipo: string;
  descuento: number | null;
  comercio_nombre: string;
  codigo_referencia: string;
}

type Step = 'loading' | 'identify' | 'profile' | 'confirm' | 'success' | 'error';

// Niveles con gradientes tipo metal real — todos suficientemente oscuros para que
// texto blanco tenga buen contraste. Los highlights metálicos sutiles.
const tierGradients: Record<string, { gradient: string; ringColor: string; textColor: string; label: string }> = {
  bronce: {
    gradient: 'linear-gradient(135deg, #5a3a1f 0%, #8b5a2b 40%, #a06b3a 50%, #8b5a2b 60%, #5a3a1f 100%)',
    ringColor: '#b97842',
    textColor: '#e8b888',
    label: 'Bronce',
  },
  plata: {
    gradient: 'linear-gradient(135deg, #3a4250 0%, #5a6470 40%, #7a8696 50%, #5a6470 60%, #3a4250 100%)',
    ringColor: '#94a3b8',
    textColor: '#e2e8f0',
    label: 'Plata',
  },
  oro: {
    gradient: 'linear-gradient(135deg, #5e4e29 0%, #9d8649 40%, #b89656 50%, #9d8649 60%, #5e4e29 100%)',
    ringColor: '#d4a017',
    textColor: '#fce884',
    label: 'Oro',
  },
  platinum: {
    gradient: 'linear-gradient(135deg, #2a2e36 0%, #4a525c 40%, #6a7280 50%, #4a525c 60%, #2a2e36 100%)',
    ringColor: '#9ca3af',
    textColor: '#f4f4f5',
    label: 'Platinum',
  },
};

export default function QRPage({ qrCode }: { qrCode: string }) {
  const [step, setStep] = useState<Step>('loading');
  const [comercio, setComercio] = useState<Comercio | null>(null);
  const [beneficiario, setBeneficiario] = useState<Beneficiario | null>(null);
  const [familiarInfo, setFamiliarInfo] = useState<FamiliarInfo | null>(null);
  const [beneficios, setBeneficios] = useState<Beneficio[]>([]);
  const [selectedBenefit, setSelectedBenefit] = useState<string>('');
  const [monto, setMonto] = useState<string>('');
  const [dni, setDni] = useState('');
  const [searching, setSearching] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successData, setSuccessData] = useState<any>(null);
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [showHistorial, setShowHistorial] = useState(false);

  useEffect(() => {
    // Reset al cambiar de QR
    setStep('loading');
    setErrorMsg('');
    setComercio(null);
    setBeneficiario(null);
    setBeneficios([]);
    setDni('');
    setSelectedBenefit('');

    const fetchComercio = async () => {
      try {
        const res = await fetch(`${API_URL}/public/comercio/${qrCode}`);
        if (!res.ok) {
          setStep('error');
          setErrorMsg('No pudimos identificar este comercio. Verificá el código QR.');
          return;
        }
        const data = await res.json();
        setComercio(data.comercio);
        setStep('identify');
      } catch {
        setStep('error');
        setErrorMsg('Error de conexión. Intentá nuevamente en unos instantes.');
      }
    };
    fetchComercio();
  }, [qrCode]);

  const handleSearch = async () => {
    if (!comercio || dni.length < 7) return;
    setSearching(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${API_URL}/public/beneficiario/${comercio.id}/${dni}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'No encontramos un colaborador con ese DNI.');
        setSearching(false);
        return;
      }

      setBeneficiario(data.beneficiario);
      setFamiliarInfo(data.familiar || null);
      // Dedupe defensivo por nombre+descuento+valor_fijo
      const seen = new Set<string>();
      const uniqueBeneficios = (data.beneficios || []).filter((b: Beneficio) => {
        const key = `${(b.nombre || '').toLowerCase().trim()}|${b.descuento ?? ''}|${b.valor_fijo ?? ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setBeneficios(uniqueBeneficios);
      setStep('profile');

      try {
        const hRes = await fetch(`${API_URL}/public/historial/${dni}`);
        if (hRes.ok) {
          const hData = await hRes.json();
          setHistorial(hData.historial || []);
        }
      } catch { /* silencioso */ }
    } catch {
      setErrorMsg('Error de conexión. Probá nuevamente.');
    }
    setSearching(false);
  };

  // Step "Confirmar": cuando el colaborador clickea Canjear, pasa por aquí
  // para que el cajero revise y confirme con un botón explícito (modo cajero).
  const handleIrConfirmar = () => {
    if (!comercio || !beneficiario || !selectedBenefit) return;
    const benData = beneficios.find(b => b.id === selectedBenefit);
    const requiereMonto = benData?.usa_limite_jerarquia;
    const montoNum = monto ? parseFloat(monto) : null;
    if (requiereMonto && (!montoNum || montoNum <= 0)) {
      setErrorMsg('Ingresá el monto del ticket para continuar.');
      return;
    }
    setErrorMsg('');
    setStep('confirm');
  };

  // Canjear definitivo (lo dispara el cajero desde el step confirm)
  const handleCanjearConfirmado = async (overrideLimite = false, pinResponsable?: string) => {
    if (!comercio || !beneficiario || !selectedBenefit) return;
    const montoNum = monto ? parseFloat(monto) : null;
    setProcessing(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${API_URL}/public/canjear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dni: beneficiario.dni,
          beneficio_id: selectedBenefit,
          comercio_id: comercio.id,
          monto: montoNum,
          override_limite: overrideLimite,
          pin_responsable: pinResponsable,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.requiere_override) {
          // Volver al confirm con flag para mostrar PIN field
          setErrorMsg(data.error);
          setProcessing(false);
          return;
        }
        setErrorMsg(data.error || 'No pudimos procesar el canje.');
        setProcessing(false);
        return;
      }

      setSuccessData(data);
      setStep('success');
    } catch {
      setErrorMsg('Error de conexión.');
    }
    setProcessing(false);
  };

  const handleReset = () => {
    setDni('');
    setBeneficiario(null);
    setFamiliarInfo(null);
    setBeneficios([]);
    setSelectedBenefit('');
    setMonto('');
    setErrorMsg('');
    setSuccessData(null);
    setHistorial([]);
    setShowHistorial(false);
    setStep('identify');
  };

  const selectedBenefitData = beneficios.find(b => b.id === selectedBenefit);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-canvas)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Sticky header con brand */}
      <header
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-canvas)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '7px',
              background: 'var(--brand)',
              color: 'var(--brand-fg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '12px',
              letterSpacing: '-0.02em',
            }}
          >
            GP
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.2 }}>
              Grupo Popper
            </p>
            <p style={{ fontSize: '10.5px', color: 'var(--text-3)', lineHeight: 1.2, marginTop: 1 }}>
              Beneficios
            </p>
          </div>
        </div>
        {comercio && step !== 'loading' && step !== 'error' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
            <span style={{ fontSize: '11.5px', color: 'var(--text-2)', fontWeight: 500 }}>
              {comercio.nombre}
            </span>
          </div>
        )}
      </header>

      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '24px 16px',
        }}
      >
        <div style={{ width: '100%', maxWidth: 480, animation: 'fadeInUp 280ms var(--ease-out)' }}>
          {step === 'loading' && <LoadingState />}
          {step === 'error' && <ErrorState message={errorMsg} />}

          {step === 'identify' && comercio && (
            <IdentifyStep
              comercio={comercio}
              dni={dni}
              setDni={setDni}
              searching={searching}
              errorMsg={errorMsg}
              setErrorMsg={setErrorMsg}
              onSearch={handleSearch}
            />
          )}

          {step === 'profile' && beneficiario && (
            <ProfileStep
              beneficiario={beneficiario}
              familiarInfo={familiarInfo}
              beneficios={beneficios}
              selectedBenefit={selectedBenefit}
              setSelectedBenefit={(id) => { setSelectedBenefit(id); setMonto(''); }}
              monto={monto}
              setMonto={setMonto}
              historial={historial}
              showHistorial={showHistorial}
              setShowHistorial={setShowHistorial}
              processing={processing}
              errorMsg={errorMsg}
              onCanjear={handleIrConfirmar}
              onReset={handleReset}
            />
          )}

          {step === 'confirm' && beneficiario && selectedBenefitData && comercio && (
            <ConfirmStep
              beneficiario={beneficiario}
              familiarInfo={familiarInfo}
              comercio={comercio}
              beneficio={selectedBenefitData}
              monto={monto}
              processing={processing}
              errorMsg={errorMsg}
              onConfirmar={() => handleCanjearConfirmado(false)}
              onConfirmarConPin={(pin) => handleCanjearConfirmado(true, pin)}
              onCancelar={() => { setStep('profile'); setErrorMsg(''); }}
            />
          )}

          {step === 'success' && successData && selectedBenefitData && comercio && (
            <SuccessStep
              beneficio={selectedBenefitData}
              successData={successData}
              comercio={comercio}
              onReset={handleReset}
            />
          )}
        </div>
      </main>

      <footer style={{ padding: '16px 20px', textAlign: 'center', borderTop: '1px solid var(--border-subtle)' }}>
        <p style={{ fontSize: '10.5px', color: 'var(--text-4)' }}>© 2026 Recluta · Verificación segura</p>
      </footer>
    </div>
  );
}

// ============================================
// LOADING
// ============================================
function LoadingState() {
  return (
    <div style={{ padding: '80px 20px', textAlign: 'center' }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: '2px solid var(--border-default)',
          borderTopColor: 'var(--brand)',
          margin: '0 auto 16px',
          animation: 'spin 800ms linear infinite',
        }}
      />
      <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>Cargando…</p>
    </div>
  );
}

// ============================================
// ERROR
// ============================================
function ErrorState({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: '64px 24px',
        textAlign: 'center',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'var(--danger-bg)',
          border: '1px solid var(--danger-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          color: 'var(--danger-text)',
        }}
      >
        <AlertCircle size={26} />
      </div>
      <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-1)', marginBottom: 6 }}>
        Hubo un problema
      </h2>
      <p style={{ fontSize: '13px', color: 'var(--text-3)', lineHeight: 1.55 }}>{message}</p>
    </div>
  );
}

// ============================================
// IDENTIFY — paso 1
// ============================================
function IdentifyStep({
  comercio,
  dni,
  setDni,
  searching,
  errorMsg,
  setErrorMsg,
  onSearch,
}: {
  comercio: Comercio;
  dni: string;
  setDni: (v: string) => void;
  searching: boolean;
  errorMsg: string;
  setErrorMsg: (v: string) => void;
  onSearch: () => void;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div>
      {/* Commerce card sutil */}
      <div
        style={{
          padding: '14px 16px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 32,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '10px',
            background: comercio.logo ? 'var(--bg-canvas)' : 'var(--brand-muted)',
            border: `1px solid ${comercio.logo ? 'var(--border-subtle)' : 'var(--brand-border)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--brand)',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {comercio.logo ? (
            <img src={comercio.logo} alt={comercio.nombre} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          ) : (
            <MapPin size={20} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-1)' }}>{comercio.nombre}</p>
          <p style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: 2 }}>
            {comercio.direccion}, {comercio.ciudad}
          </p>
        </div>
      </div>

      <h1
        style={{
          fontSize: '24px',
          fontWeight: 600,
          color: 'var(--text-1)',
          letterSpacing: '-0.02em',
          marginBottom: 8,
          textAlign: 'center',
        }}
      >
        Identificate
      </h1>
      <p
        style={{
          fontSize: '13.5px',
          color: 'var(--text-3)',
          textAlign: 'center',
          marginBottom: 32,
          lineHeight: 1.5,
        }}
      >
        Ingresá tu DNI para ver tus beneficios disponibles.
      </p>

      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="00.000.000"
        value={dni}
        onChange={e => {
          const val = e.target.value.replace(/\D/g, '').slice(0, 8);
          setDni(val);
          setErrorMsg('');
        }}
        onKeyDown={e => { if (e.key === 'Enter') onSearch(); }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus
        autoComplete="off"
        style={{
          width: '100%',
          height: 64,
          padding: '0 20px',
          background: 'var(--bg-elevated)',
          border: `1px solid ${focused ? 'var(--brand)' : 'var(--border-default)'}`,
          borderRadius: '12px',
          color: 'var(--text-1)',
          fontSize: '28px',
          fontWeight: 600,
          textAlign: 'center',
          letterSpacing: '0.04em',
          outline: 'none',
          fontVariantNumeric: 'tabular-nums',
          boxShadow: focused ? '0 0 0 4px var(--brand-subtle)' : 'none',
          transition: 'all 120ms var(--ease-in-out)',
        }}
      />

      {/* Progress dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 14 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: i < dni.length ? 7 : 4,
              height: i < dni.length ? 7 : 4,
              borderRadius: '50%',
              background: i < dni.length ? 'var(--brand)' : 'var(--border-default)',
              transition: 'all 160ms var(--ease-out)',
            }}
          />
        ))}
      </div>

      {errorMsg && (
        <div
          style={{
            marginTop: 20,
            padding: '10px 12px',
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <AlertCircle size={14} style={{ color: 'var(--danger-text)', flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: '12.5px', color: 'var(--danger-text)', lineHeight: 1.5 }}>{errorMsg}</p>
        </div>
      )}

      <button
        onClick={onSearch}
        disabled={dni.length < 7 || searching}
        style={{
          width: '100%',
          height: 48,
          marginTop: 24,
          background: dni.length >= 7 && !searching ? 'var(--brand)' : 'rgba(212,160,23,0.4)',
          color: 'var(--brand-fg)',
          border: 'none',
          borderRadius: '10px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: dni.length < 7 || searching ? 'not-allowed' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          transition: 'all 120ms var(--ease-in-out)',
          opacity: dni.length < 7 ? 0.6 : 1,
        }}
      >
        {searching ? (
          <>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: '1.5px solid currentColor',
                borderTopColor: 'transparent',
                animation: 'spin 600ms linear infinite',
              }}
            />
            Verificando
          </>
        ) : (
          <>
            Continuar
            <ChevronRight size={16} />
          </>
        )}
      </button>
    </div>
  );
}

// ============================================
// PROFILE — paso 2
// ============================================
function ProfileStep({
  beneficiario,
  familiarInfo,
  beneficios,
  selectedBenefit,
  setSelectedBenefit,
  monto,
  setMonto,
  historial,
  showHistorial,
  setShowHistorial,
  processing,
  errorMsg,
  onCanjear,
  onReset,
}: {
  beneficiario: Beneficiario;
  familiarInfo: FamiliarInfo | null;
  beneficios: Beneficio[];
  selectedBenefit: string;
  setSelectedBenefit: (v: string) => void;
  monto: string;
  setMonto: (v: string) => void;
  historial: HistorialItem[];
  showHistorial: boolean;
  setShowHistorial: (v: boolean) => void;
  processing: boolean;
  errorMsg: string;
  onCanjear: () => void;
  onReset: () => void;
}) {
  const selectedBen = beneficios.find(b => b.id === selectedBenefit);
  const necesitaMonto = !!selectedBen?.usa_limite_jerarquia;
  const montoNum = parseFloat(monto || '0') || 0;
  const descuento = selectedBen?.descuento ? Number(selectedBen.descuento) : 0;
  const ahorro = montoNum * (descuento / 100);
  const totalAPagar = montoNum - ahorro;
  const tier = tierGradients[beneficiario.nivel] || tierGradients.bronce;

  return (
    <div>
      {/* ===== Membership Card estilo Apple Wallet ===== */}
      <div
        style={{
          position: 'relative',
          padding: '20px',
          background: tier.gradient,
          borderRadius: '16px',
          marginBottom: 24,
          boxShadow: '0 12px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.18)',
          overflow: 'hidden',
        }}
      >
        {/* Highlight metálico arriba */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at 80% 0%, rgba(255,255,255,0.18), transparent 50%)',
            pointerEvents: 'none',
          }}
        />
        {/* Vignette oscuro para garantizar contraste del texto */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.25) 100%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Foto */}
          <div
            style={{
              position: 'relative',
              flexShrink: 0,
            }}
          >
            {beneficiario.foto ? (
              <img
                src={beneficiario.foto}
                alt={`${beneficiario.nombre} ${beneficiario.apellido}`}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid rgba(255,255,255,0.25)',
                  background: 'rgba(0,0,0,0.2)',
                }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)',
                  border: '3px solid rgba(255,255,255,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  fontWeight: 600,
                  color: tier.textColor,
                  letterSpacing: '-0.02em',
                }}
              >
                {beneficiario.nombre[0]}{beneficiario.apellido[0]}
              </div>
            )}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
              <p
                style={{
                  fontSize: '10.5px',
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.85)',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                }}
              >
                Beneficios · {tier.label}
              </p>
              {beneficiario.es_talento_popper && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  padding: '1px 7px', borderRadius: '999px',
                  background: 'rgba(212,160,23,0.25)', border: '1px solid rgba(212,160,23,0.6)',
                  color: '#fff', fontSize: '9.5px', fontWeight: 700,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                }}>★ Talento Popper</span>
              )}
              {familiarInfo && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  padding: '1px 7px', borderRadius: '999px',
                  background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)',
                  color: '#fff', fontSize: '9.5px', fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                }}>
                  {familiarInfo.relacion === 'Parents' ? 'Madre/Padre' :
                   familiarInfo.relacion === 'Spouse' ? 'Cónyuge' :
                   familiarInfo.relacion === 'CivilUnion' ? 'Concubino/a' :
                   familiarInfo.relacion === 'Child' ? 'Hijo/a' : 'Familiar'}
                </span>
              )}
            </div>
            {familiarInfo && (
              <p style={{
                fontSize: '11.5px', color: 'rgba(255,255,255,0.85)', fontWeight: 500, marginBottom: 6,
                textShadow: '0 1px 2px rgba(0,0,0,0.35)',
              }}>
                Titular: {familiarInfo.titular.nombre} {familiarInfo.titular.apellido}
              </p>
            )}
            <h2
              style={{
                fontSize: '20px',
                fontWeight: 700,
                color: 'white',
                letterSpacing: '-0.015em',
                lineHeight: 1.2,
                marginBottom: 2,
                textShadow: '0 1px 3px rgba(0,0,0,0.45)',
              }}
            >
              {beneficiario.nombre}
            </h2>
            <p
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.95)',
                lineHeight: 1.2,
                textShadow: '0 1px 2px rgba(0,0,0,0.35)',
              }}
            >
              {beneficiario.apellido}
            </p>
          </div>
        </div>

        {/* Footer info — cargo, dni */}
        <div
          style={{
            position: 'relative',
            marginTop: 16,
            paddingTop: 12,
            borderTop: '1px solid rgba(255,255,255,0.20)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{
              fontSize: '10px',
              color: 'rgba(255,255,255,0.75)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              marginBottom: 2,
              fontWeight: 600,
              textShadow: '0 1px 2px rgba(0,0,0,0.4)',
            }}>
              {beneficiario.cargo ? 'Cargo' : 'Departamento'}
            </p>
            <p style={{
              fontSize: '12.5px',
              color: 'white',
              fontWeight: 600,
              lineHeight: 1.3,
              textShadow: '0 1px 2px rgba(0,0,0,0.35)',
            }}>
              {beneficiario.cargo || beneficiario.departamento || '—'}
            </p>
          </div>
          {beneficiario.legajo && (
            <div style={{ textAlign: 'right' }}>
              <p style={{
                fontSize: '10px',
                color: 'rgba(255,255,255,0.75)',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                marginBottom: 2,
                fontWeight: 600,
                textShadow: '0 1px 2px rgba(0,0,0,0.4)',
              }}>
                Legajo
              </p>
              <p
                style={{
                  fontSize: '12.5px',
                  color: 'white',
                  fontWeight: 600,
                  fontFamily: 'var(--font-geist-mono)',
                  fontVariantNumeric: 'tabular-nums',
                  textShadow: '0 1px 2px rgba(0,0,0,0.35)',
                }}
              >
                #{beneficiario.legajo}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ===== Beneficios ===== */}
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-1)' }}>
          Beneficios disponibles
        </h3>
        <span style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>
          {beneficios.length} {beneficios.length === 1 ? 'oferta' : 'ofertas'}
        </span>
      </div>

      {beneficios.length === 0 ? (
        <div
          style={{
            padding: '32px 16px',
            background: 'var(--bg-elevated)',
            border: '1px dashed var(--border-default)',
            borderRadius: '10px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>
            No hay beneficios disponibles para tu nivel en este comercio.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {beneficios.map(b => (
            <BenefitOption
              key={b.id}
              benefit={b}
              selected={selectedBenefit === b.id}
              onSelect={() => setSelectedBenefit(b.id === selectedBenefit ? '' : b.id)}
            />
          ))}
        </div>
      )}

      {/* ===== Panel monto + saldo (V3A) ===== */}
      {selectedBen && necesitaMonto && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--brand-border)',
            borderRadius: '12px',
          }}
        >
          {/* Saldo header */}
          {selectedBen.saldo && !selectedBen.saldo.sin_jerarquia && (
            <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Saldo mensual {selectedBen.saldo.jerarquia ? `· ${selectedBen.saldo.jerarquia}` : ''}
                </span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>
                  ${(selectedBen.saldo.disponible || 0).toLocaleString('es-AR')}
                </span>
              </div>
              {/* Bar de progreso */}
              <div style={{ height: 4, background: 'var(--bg-canvas)', borderRadius: 2, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, ((selectedBen.saldo.gastado_mes || 0) / (selectedBen.saldo.limite_mensual || 1)) * 100)}%`,
                    background: 'var(--brand)',
                    transition: 'width 200ms var(--ease-out)',
                  }}
                />
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 6 }}>
                Gastado: ${(selectedBen.saldo.gastado_mes || 0).toLocaleString('es-AR')} de ${(selectedBen.saldo.limite_mensual || 0).toLocaleString('es-AR')}
              </p>
            </div>
          )}
          {selectedBen.saldo?.sin_jerarquia && (
            <div style={{
              padding: '8px 10px', marginBottom: 12,
              background: 'var(--warning-bg)', border: '1px solid var(--warning-border)',
              borderRadius: '6px',
            }}>
              <p style={{ fontSize: '11.5px', color: 'var(--warning-text)' }}>
                ⚠ No tenés jerarquía asignada. El sistema no podrá controlar tu límite mensual. Pedile a RRHH que te asigne una.
              </p>
            </div>
          )}

          {/* Input monto */}
          <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-2)', fontWeight: 500, marginBottom: 6 }}>
            Monto del ticket
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-3)', fontSize: '15px', fontWeight: 600,
            }}>$</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              style={{
                width: '100%', height: 48, padding: '0 14px 0 26px',
                background: 'var(--bg-canvas)', border: '1px solid var(--border-default)',
                borderRadius: '8px', color: 'var(--text-1)', fontSize: '20px', fontWeight: 600,
                outline: 'none', fontVariantNumeric: 'tabular-nums',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--brand)'; e.target.style.boxShadow = '0 0 0 3px var(--brand-subtle)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Cálculo en vivo */}
          {montoNum > 0 && descuento > 0 && (
            <div style={{
              marginTop: 12, padding: 12,
              background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-3)', marginBottom: 4 }}>
                <span>Subtotal</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>${montoNum.toLocaleString('es-AR')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--success-text)', marginBottom: 4 }}>
                <span>Descuento {Math.round(descuento)}%</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>−${Math.round(ahorro).toLocaleString('es-AR')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', color: 'var(--text-1)', fontWeight: 700, paddingTop: 6, borderTop: '1px solid var(--border-subtle)', marginTop: 6 }}>
                <span>Total a pagar</span>
                <span style={{ color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>${Math.round(totalAPagar).toLocaleString('es-AR')}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== Historial colapsable ===== */}
      {historial.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <button
            onClick={() => setShowHistorial(!showHistorial)}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              color: 'var(--text-2)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 120ms var(--ease-in-out)',
            }}
          >
            <span>Tus canjes recientes ({historial.length})</span>
            <ChevronRight
              size={14}
              style={{
                transform: showHistorial ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 200ms var(--ease-out)',
              }}
            />
          </button>
          {showHistorial && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, animation: 'fadeIn 200ms var(--ease-out)' }}>
              {historial.map((h, i) => (
                <div
                  key={i}
                  style={{
                    padding: '10px 12px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-1)', fontWeight: 500 }}>{h.beneficio_nombre}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 1 }}>
                      {h.comercio_nombre} ·{' '}
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {new Date(h.fecha_verificacion).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </span>
                    </p>
                  </div>
                  {h.descuento && (
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>
                      −{Math.round(Number(h.descuento))}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== Error ===== */}
      {errorMsg && (
        <div
          style={{
            marginTop: 16,
            padding: '10px 12px',
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <AlertCircle size={14} style={{ color: 'var(--danger-text)', flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: '12.5px', color: 'var(--danger-text)' }}>{errorMsg}</p>
        </div>
      )}

      {/* ===== Actions ===== */}
      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        <button
          onClick={onReset}
          style={{
            height: 48,
            padding: '0 18px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: '10px',
            color: 'var(--text-2)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            transition: 'all 120ms var(--ease-in-out)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
        >
          <ArrowLeft size={14} />
          Volver
        </button>
        <button
          onClick={onCanjear}
          disabled={!selectedBenefit || processing}
          style={{
            flex: 1,
            height: 48,
            background: selectedBenefit && !processing ? 'var(--brand)' : 'rgba(212,160,23,0.4)',
            color: 'var(--brand-fg)',
            border: 'none',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: !selectedBenefit || processing ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'all 120ms var(--ease-in-out)',
            opacity: !selectedBenefit ? 0.6 : 1,
          }}
        >
          {processing ? (
            <>
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: '1.5px solid currentColor',
                  borderTopColor: 'transparent',
                  animation: 'spin 600ms linear infinite',
                }}
              />
              Procesando
            </>
          ) : (
            'Canjear beneficio'
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================
// BENEFIT OPTION
// ============================================
function BenefitOption({
  benefit,
  selected,
  onSelect,
}: {
  benefit: Beneficio;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      style={{
        width: '100%',
        padding: '14px 16px',
        background: selected ? 'var(--brand-subtle)' : 'var(--bg-elevated)',
        border: `1px solid ${selected ? 'var(--brand)' : 'var(--border-subtle)'}`,
        borderRadius: '10px',
        textAlign: 'left',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        transition: 'all 120ms var(--ease-in-out)',
        boxShadow: selected ? '0 0 0 3px var(--brand-subtle)' : 'none',
      }}
      onMouseEnter={e => {
        if (!selected) e.currentTarget.style.background = 'var(--bg-raised)';
      }}
      onMouseLeave={e => {
        if (!selected) e.currentTarget.style.background = 'var(--bg-elevated)';
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-1)',
            marginBottom: 2,
            letterSpacing: '-0.005em',
          }}
        >
          {benefit.nombre}
        </p>
        {benefit.descripcion && (
          <p
            className="line-clamp-2"
            style={{
              fontSize: '12px',
              color: 'var(--text-3)',
              lineHeight: 1.5,
            }}
          >
            {benefit.descripcion}
          </p>
        )}
        {/* Badges secundarios: categoría/origen/restricciones */}
        <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
          {benefit.origen === 'interno' && (
            <span style={{
              fontSize: '9.5px', fontWeight: 600, color: 'var(--brand)',
              padding: '1px 6px', borderRadius: '999px',
              background: 'var(--brand-muted)', border: '1px solid var(--brand-border)',
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>Interno</span>
          )}
          {benefit.categoria && (
            <span style={{
              fontSize: '9.5px', fontWeight: 500, color: 'var(--text-3)',
              padding: '1px 6px', borderRadius: '999px',
              background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
              letterSpacing: '0.04em', textTransform: 'capitalize',
            }}>{benefit.categoria.replace('_', ' ')}</span>
          )}
          {benefit.excluye_outlet && (
            <span style={{
              fontSize: '9.5px', fontWeight: 500, color: 'var(--warning-text)',
              padding: '1px 6px', borderRadius: '999px',
              background: 'var(--warning-bg)', border: '1px solid var(--warning-border)',
            }}>Excluye outlet</span>
          )}
        </div>
        {benefit.restricciones && (
          <p style={{
            fontSize: '10.5px', color: 'var(--text-3)', marginTop: 6,
            fontStyle: 'italic', lineHeight: 1.4,
          }}>
            ⚠ {benefit.restricciones}
          </p>
        )}
      </div>
      {(benefit.descuento || benefit.valor_fijo) && (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {benefit.descuento && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: 1,
                color: selected ? 'var(--brand)' : 'var(--text-1)',
              }}
            >
              <span
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                }}
              >
                {Math.round(Number(benefit.descuento))}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>%</span>
            </div>
          )}
          {benefit.valor_fijo && !benefit.descuento && (
            <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>
              ${Number(benefit.valor_fijo).toLocaleString('es-AR')}
            </span>
          )}
        </div>
      )}
      {/* radio circle */}
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          border: `2px solid ${selected ? 'var(--brand)' : 'var(--border-default)'}`,
          background: selected ? 'var(--brand)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 120ms var(--ease-in-out)',
        }}
      >
        {selected && <Check size={13} strokeWidth={3} color="var(--brand-fg)" />}
      </div>
    </button>
  );
}

// ============================================
// SUCCESS
// ============================================
// ============================================
// CONFIRM STEP (V3E — modo cajero)
// El colaborador pasa el teléfono al cajero, que ve la info en grande
// y confirma el canje con un click. Si excede el límite, pide PIN del responsable.
// ============================================
function ConfirmStep({
  beneficiario, familiarInfo, comercio, beneficio, monto, processing, errorMsg,
  onConfirmar, onConfirmarConPin, onCancelar,
}: {
  beneficiario: Beneficiario;
  familiarInfo: FamiliarInfo | null;
  comercio: Comercio;
  beneficio: Beneficio;
  monto: string;
  processing: boolean;
  errorMsg: string;
  onConfirmar: () => void;
  onConfirmarConPin: (pin: string) => void;
  onCancelar: () => void;
}) {
  const requiereOverride: boolean = !!errorMsg && errorMsg.toLowerCase().includes('excede');
  const [pin, setPin] = useState('');
  const montoNum = parseFloat(monto || '0') || 0;
  const descuento = beneficio.descuento ? Number(beneficio.descuento) : 0;
  const ahorro = montoNum * (descuento / 100);
  const totalAPagar = montoNum - ahorro;
  const fullName = familiarInfo
    ? `${beneficiario.nombre} ${beneficiario.apellido}`
    : `${beneficiario.nombre} ${beneficiario.apellido}`;

  return (
    <div>
      {/* Banner para el cajero */}
      <div style={{
        padding: '10px 14px', marginBottom: 16,
        background: 'var(--brand-muted)', border: '1px solid var(--brand-border)',
        borderRadius: '8px',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--brand)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          📱 Pasale el teléfono al cajero
        </p>
        <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 2 }}>
          {comercio.nombre} debe verificar y confirmar el canje
        </p>
      </div>

      {/* Foto y nombre del colaborador — GRANDE */}
      <div style={{
        padding: 20, background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)', borderRadius: '14px',
        textAlign: 'center', marginBottom: 14,
      }}>
        {beneficiario.foto ? (
          <img
            src={beneficiario.foto}
            alt={fullName}
            style={{
              width: 120, height: 120, borderRadius: '50%', objectFit: 'cover',
              border: '3px solid var(--brand)',
              margin: '0 auto 14px', display: 'block',
            }}
          />
        ) : (
          <div style={{
            width: 120, height: 120, borderRadius: '50%',
            background: 'var(--brand-muted)', border: '3px solid var(--brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--brand)', fontWeight: 700, fontSize: '36px',
            margin: '0 auto 14px',
          }}>
            {beneficiario.nombre[0]}{beneficiario.apellido[0]}
          </div>
        )}
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.01em', marginBottom: 4 }}>
          {fullName}
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>
          DNI <span style={{ fontFamily: 'var(--font-geist-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)' }}>
            {beneficiario.dni}
          </span>
          {beneficiario.es_talento_popper && <span style={{ marginLeft: 8, color: 'var(--brand)' }}>★ Talento</span>}
        </p>
        {familiarInfo && (
          <div style={{ marginTop: 10, padding: '6px 10px', background: 'var(--bg-canvas)', borderRadius: '6px', display: 'inline-block' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Vínculo: </span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-1)' }}>
              {familiarInfo.relacion === 'Parents' ? 'Madre/Padre' :
               familiarInfo.relacion === 'Spouse' ? 'Cónyuge' :
               familiarInfo.relacion === 'CivilUnion' ? 'Concubino/a' :
               familiarInfo.relacion === 'Child' ? 'Hijo/a' : 'Familiar'}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}> de </span>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-2)' }}>
              {familiarInfo.titular.nombre} {familiarInfo.titular.apellido}
            </span>
          </div>
        )}
      </div>

      {/* Breakdown del canje */}
      <div style={{
        padding: 16, background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)', borderRadius: '12px', marginBottom: 14,
      }}>
        <p style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
          Resumen del canje
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Row label="Beneficio" value={beneficio.nombre} highlight />
          {beneficio.categoria && <Row label="Categoría" value={beneficio.categoria.replace('_', ' ')} />}
          {montoNum > 0 && (
            <>
              <Row label="Monto del ticket" value={`$${montoNum.toLocaleString('es-AR')}`} mono />
              {descuento > 0 && (
                <>
                  <Row label={`Descuento ${Math.round(descuento)}%`} value={`−$${Math.round(ahorro).toLocaleString('es-AR')}`} mono success />
                  <div style={{
                    paddingTop: 10, marginTop: 4, borderTop: '1px solid var(--border-subtle)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-2)', fontWeight: 500 }}>Total a pagar</span>
                    <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>
                      ${Math.round(totalAPagar).toLocaleString('es-AR')}
                    </span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {beneficio.restricciones && (
        <div style={{
          padding: '8px 12px', background: 'var(--warning-bg)',
          border: '1px solid var(--warning-border)', borderRadius: '8px', marginBottom: 14,
        }}>
          <p style={{ fontSize: '11.5px', color: 'var(--warning-text)' }}>⚠ {beneficio.restricciones}</p>
        </div>
      )}

      {/* Error / Override */}
      {errorMsg && (
        <div style={{
          padding: '10px 12px', background: 'var(--danger-bg)',
          border: '1px solid var(--danger-border)', borderRadius: '8px', marginBottom: 14,
        }}>
          <p style={{ fontSize: '12.5px', color: 'var(--danger-text)' }}>{errorMsg}</p>
        </div>
      )}

      {/* PIN del responsable si requiere override */}
      {requiereOverride && (
        <div style={{
          padding: 14, marginBottom: 14,
          background: 'var(--bg-elevated)', border: '1px solid var(--warning-border)', borderRadius: '10px',
        }}>
          <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--warning-text)', fontWeight: 600, marginBottom: 6 }}>
            🔒 PIN del responsable para autorizar
          </label>
          <input
            type="password" inputMode="numeric"
            placeholder="****"
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
            style={{
              width: '100%', height: 44, padding: '0 14px',
              background: 'var(--bg-canvas)', border: '1px solid var(--border-default)',
              borderRadius: '8px', color: 'var(--text-1)', fontSize: '20px', fontWeight: 600,
              outline: 'none', textAlign: 'center', letterSpacing: '0.5em',
            }}
            autoFocus
          />
          <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 6 }}>
            Pedile al responsable del comercio el PIN para autorizar este canje.
          </p>
        </div>
      )}

      {/* Botones */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancelar} disabled={processing} style={{
          height: 52, padding: '0 18px', background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)', borderRadius: '10px',
          color: 'var(--text-2)', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
        }}>
          ← Volver
        </button>
        <button
          onClick={() => requiereOverride ? onConfirmarConPin(pin) : onConfirmar()}
          disabled={processing || (requiereOverride && pin.length < 4)}
          style={{
            flex: 1, height: 52, background: requiereOverride ? 'var(--warning)' : 'var(--success)',
            color: '#0a0a0a', border: 'none', borderRadius: '10px',
            fontSize: '15px', fontWeight: 700, cursor: processing ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: processing || (requiereOverride && pin.length < 4) ? 0.6 : 1,
          }}
        >
          {processing ? (
            <>
              <span style={{
                width: 16, height: 16, borderRadius: '50%',
                border: '2px solid currentColor', borderTopColor: 'transparent',
                animation: 'spin 600ms linear infinite',
              }} />
              Procesando…
            </>
          ) : requiereOverride ? '✓ Autorizar con PIN' : '✓ Confirmar canje'}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, mono, success, highlight }: { label: string; value: string; mono?: boolean; success?: boolean; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <span style={{ fontSize: '12.5px', color: 'var(--text-3)' }}>{label}</span>
      <span style={{
        fontSize: highlight ? '14px' : '13px',
        fontWeight: highlight ? 600 : 500,
        color: success ? 'var(--success-text)' : 'var(--text-1)',
        fontVariantNumeric: mono ? 'tabular-nums' : undefined,
        textAlign: 'right',
      }}>{value}</span>
    </div>
  );
}

function SuccessStep({
  beneficio,
  successData,
  comercio,
  onReset,
}: {
  beneficio: Beneficio;
  successData: any;
  comercio: Comercio;
  onReset: () => void;
}) {
  const codigo = successData.verificacion?.codigo_referencia || '---';
  const fecha = new Date(successData.verificacion?.fecha_verificacion || Date.now());
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div>
      {/* Success badge */}
      <div style={{ textAlign: 'center', marginBottom: 32, animation: 'scaleIn 280ms var(--ease-out)' }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'var(--success-bg)',
            border: '1px solid var(--success-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            color: 'var(--success)',
          }}
        >
          <Check size={36} strokeWidth={2.5} />
        </div>
        <p
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--success-text)',
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Beneficio confirmado
        </p>
        <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
          {beneficio.nombre}
        </h1>
        {beneficio.descuento && (
          <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'baseline', gap: 4, color: 'var(--brand)' }}>
            <span style={{ fontSize: '32px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1 }}>
              {Math.round(Number(beneficio.descuento))}%
            </span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              de descuento
            </span>
          </div>
        )}
      </div>

      {/* Code card — el QR equivalente para el comerciante */}
      <div
        style={{
          padding: '24px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: '12px',
          textAlign: 'center',
          marginBottom: 16,
          position: 'relative',
        }}
      >
        <p
          style={{
            fontSize: '10.5px',
            fontWeight: 600,
            color: 'var(--text-3)',
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          Código de verificación
        </p>
        <p
          style={{
            fontSize: '32px',
            fontWeight: 700,
            color: 'var(--text-1)',
            fontFamily: 'var(--font-geist-mono)',
            letterSpacing: '0.16em',
            fontVariantNumeric: 'tabular-nums',
            marginBottom: 12,
            wordBreak: 'break-all',
            lineHeight: 1.1,
          }}
        >
          {codigo}
        </p>
        <button
          onClick={copyCode}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 12px',
            background: copied ? 'var(--success-bg)' : 'var(--bg-surface)',
            border: `1px solid ${copied ? 'var(--success-border)' : 'var(--border-subtle)'}`,
            borderRadius: '6px',
            color: copied ? 'var(--success-text)' : 'var(--text-2)',
            fontSize: '11.5px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 120ms var(--ease-in-out)',
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copiado' : 'Copiar código'}
        </button>
      </div>

      {/* Receipt details */}
      <div
        style={{
          padding: '12px 16px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          marginBottom: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <ReceiptRow icon={<MapPin size={13} />} label="Comercio" value={comercio.nombre} />
        <ReceiptRow icon={<Clock size={13} />} label="Fecha" value={fecha.toLocaleString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
      </div>

      <p style={{ fontSize: '12px', color: 'var(--text-3)', textAlign: 'center', marginBottom: 24, lineHeight: 1.5 }}>
        Mostrá este código al encargado del comercio para hacer efectivo el beneficio.
      </p>

      <button
        onClick={onReset}
        style={{
          width: '100%',
          height: 48,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: '10px',
          color: 'var(--text-1)',
          fontSize: '13px',
          fontWeight: 500,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          transition: 'all 120ms var(--ease-in-out)',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
      >
        <RotateCw size={14} />
        Nueva verificación
      </button>
    </div>
  );
}

function ReceiptRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: 'var(--text-4)', display: 'flex' }}>{icon}</span>
      <span style={{ fontSize: '11.5px', color: 'var(--text-3)', minWidth: 60 }}>{label}</span>
      <span style={{ fontSize: '12.5px', color: 'var(--text-1)', fontWeight: 500, flex: 1, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
