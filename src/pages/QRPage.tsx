import { useState, useEffect } from 'react';
import { MapPin, Clock, ChevronRight, Check, AlertCircle, ArrowLeft, RotateCw, Copy } from 'lucide-react';
import { useWakeLock, useIdleTimeout } from '../hooks/useTerminal';

// ============================================
// QRPage — Apple Wallet / Mercado Pago aesthetic
// Consumer experience, card-first, photo-prominent, tier-as-color
// ============================================

const API_URL = import.meta.env.VITE_API_URL || 'https://beneficios-backend-jfpx.onrender.com/api';

// Hook responsive: true en pantallas de escritorio (≥ 768px). En celular queda false.
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    setIsDesktop(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

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
  sector?: string;
  cargo?: string;
  legajo?: string;
  empresa: string;
  es_talento_popper?: boolean;
  antiguedad_meses?: number;
}

interface FamiliarInfo {
  es_familiar: true;
  relacion: string;
  edad?: number | null;
  es_menor?: boolean;
  fecha_nacimiento?: string;
  titular: { dni: string; nombre: string; apellido: string; foto?: string | null; departamento?: string | null; sector?: string | null };
  adultos_autorizados?: Array<{ dni: string; nombre: string; apellido?: string; relacion: string; esTitular?: boolean }>;
}

// Etiqueta legible del vínculo familiar (Naaloo usa códigos en inglés)
function relacionLabel(relacion: string): string {
  switch (relacion) {
    case 'Parents': return 'Madre/Padre';
    case 'Spouse': return 'Cónyuge';
    case 'CivilUnion': return 'Concubino/a';
    case 'Child': return 'Hijo/a';
    default: return 'Familiar';
  }
}

// Combina departamento y sector sin repetir el mismo valor (ej. "RRHH · RRHH" → "RRHH")
function formatArea(departamento?: string | null, sector?: string | null): string {
  const vistos = new Set<string>();
  return [departamento, sector]
    .map(p => (p || '').trim())
    .filter(p => {
      if (!p) return false;
      const k = p.toLowerCase();
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    })
    .join(' · ');
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
  tipo_descuento?: 'gratuito' | 'descuento' | null;
  max_invitados?: number;
  cubre_invitados?: boolean;
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
  tipo_descuento: string | null;
  monto_descuento: number | null;
  monto_final: number | null;
  monto_original: number | null;
  valor_fijo: number | null;
  comercio_nombre: string;
  codigo_referencia: string;
}

type Step = 'loading' | 'identify' | 'profile' | 'confirm' | 'success' | 'error';

// Card unificada — estilo premium oscuro sin distinción de nivel
const CARD_GRADIENT = 'linear-gradient(160deg, #0d1f35 0%, #162944 45%, #1a3352 55%, #0d1f35 100%)';

export default function QRPage({ qrCode }: { qrCode: string }) {
  const isDesktop = useIsDesktop();
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
  const [overrideRequired, setOverrideRequired] = useState(false);
  const [invitadosCount, setInvitadosCount] = useState(0);
  const [successData, setSuccessData] = useState<any>(null);
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [showHistorial, setShowHistorial] = useState(false);
  const [logoOk, setLogoOk] = useState(true);

  // Terminal: activar el blindaje de kiosco (definido en index.html) solo mientras
  // se muestra la pantalla de cajero. No afecta el panel admin ni otras vistas.
  useEffect(() => {
    document.body.classList.add('kiosk');
    return () => document.body.classList.remove('kiosk');
  }, []);

  // Terminal: mantener la pantalla encendida durante toda la jornada.
  useWakeLock();

  // Terminal: "despertar" el backend de Render apenas abre la terminal, para que
  // la primera lectura de DNI no espere el cold-start (~30-50s).
  useEffect(() => {
    const warmup = () => { fetch(`${API_URL}/health`).catch(() => { /* silencioso */ }); };
    warmup();
    const id = window.setInterval(warmup, 10 * 60 * 1000); // re-ping cada 10 min
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    // Reset al cambiar de QR
    setStep('loading');
    setErrorMsg('');
    setComercio(null);
    setBeneficiario(null);
    setBeneficios([]);
    setDni('');
    setSelectedBenefit('');

    let cancelled = false;
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    // Reintenta ante 5xx / errores de red (Render puede tardar en despertar).
    // Un 404 es un QR inválido de verdad → error inmediato.
    const fetchComercio = async (attempt = 0): Promise<void> => {
      const MAX_RETRIES = 4;
      try {
        const res = await fetch(`${API_URL}/public/comercio/${qrCode}`);
        if (cancelled) return;
        if (res.status >= 500 && attempt < MAX_RETRIES) {
          await sleep(2500);
          return fetchComercio(attempt + 1);
        }
        if (!res.ok) {
          setStep('error');
          setErrorMsg('No pudimos identificar este comercio. Verificá el código QR.');
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setComercio(data.comercio);
        setStep('identify');
      } catch {
        if (cancelled) return;
        if (attempt < MAX_RETRIES) {
          await sleep(2500);
          return fetchComercio(attempt + 1);
        }
        setStep('error');
        setErrorMsg('No pudimos conectar con el servidor. Verificá la red y reintentá.');
      }
    };
    fetchComercio();

    return () => { cancelled = true; };
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
  const handleCanjearConfirmado = async (overrideLimite = false, pinResponsable?: string, retiradoPorDni?: string) => {
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
          retirado_por_dni: retiradoPorDni,
          invitados_count: invitadosCount,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.requiere_override) {
          setOverrideRequired(true);
          setErrorMsg(data.error);
          setProcessing(false);
          return;
        }
        setOverrideRequired(false);
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
    setInvitadosCount(0);
    setErrorMsg('');
    setOverrideRequired(false);
    setSuccessData(null);
    setHistorial([]);
    setShowHistorial(false);
    setStep('identify');
  };

  // Terminal: volver solo a la pantalla inicial entre clientes.
  // Tras un canje exitoso, a los 25s. En perfil/confirmación, tras 90s de inactividad
  // (evita dejar el DNI/foto de una persona en pantalla). La pantalla de DNI no expira.
  const idleMs = step === 'success' ? 25_000 : 90_000;
  const idleEnabled = step === 'profile' || step === 'confirm' || step === 'success';
  useIdleTimeout(handleReset, idleMs, idleEnabled);

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
          {logoOk ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 32,
                padding: '0 9px',
                background: '#fff',
                borderRadius: '8px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
              }}
            >
              <img
                src="/logo-popper.png"
                alt="Grupo Popper"
                onError={() => setLogoOk(false)}
                style={{ height: 20, width: 'auto', maxWidth: 120, objectFit: 'contain', display: 'block' }}
              />
            </div>
          ) : (
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
          )}
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
              gap: 8,
              padding: comercio.logo ? '4px 12px 4px 4px' : '5px 12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '999px',
              minWidth: 0,
            }}
          >
            {comercio.logo ? (
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: '#fff',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={comercio.logo}
                    alt={comercio.nombre}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2, boxSizing: 'border-box' }}
                  />
                </div>
                <div
                  title="En línea"
                  style={{
                    position: 'absolute',
                    right: -1,
                    bottom: -1,
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: 'var(--success)',
                    border: '2px solid var(--bg-elevated)',
                  }}
                />
              </div>
            ) : (
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
            )}
            <span
              style={{
                fontSize: '11.5px',
                color: 'var(--text-2)',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 200,
              }}
            >
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
        <div style={{ width: '100%', maxWidth: step === 'profile' && isDesktop ? 940 : 480, animation: 'fadeInUp 280ms var(--ease-out)', transition: 'max-width 200ms var(--ease-out)' }}>
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
              setSelectedBenefit={(id) => { setSelectedBenefit(id); setMonto(''); setInvitadosCount(0); }}
              monto={monto}
              setMonto={setMonto}
              invitadosCount={invitadosCount}
              setInvitadosCount={setInvitadosCount}
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
              beneficio={selectedBenefitData}
              monto={monto}
              invitadosCount={invitadosCount}
              processing={processing}
              errorMsg={errorMsg}
              overrideRequired={overrideRequired}
              onConfirmar={(retiradoPorDni?: string) => handleCanjearConfirmado(false, undefined, retiradoPorDni)}
              onConfirmarConPin={(pin, retiradoPorDni?: string) => handleCanjearConfirmado(true, pin, retiradoPorDni)}
              onCancelar={() => { setStep('profile'); setErrorMsg(''); setOverrideRequired(false); }}
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
  invitadosCount,
  setInvitadosCount,
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
  invitadosCount: number;
  setInvitadosCount: (v: number) => void;
  historial: HistorialItem[];
  showHistorial: boolean;
  setShowHistorial: (v: boolean) => void;
  processing: boolean;
  errorMsg: string;
  onCanjear: () => void;
  onReset: () => void;
}) {
  const isDesktop = useIsDesktop();
  const selectedBen = beneficios.find(b => b.id === selectedBenefit);
  const descuento = selectedBen?.descuento ? Number(selectedBen.descuento) : 0;
  // Se pide el monto cuando hay un descuento porcentual parcial (entre 1% y 99%):
  // ej. skipass familiar 50%, indumentaria 20/30%, descuentos externos. Para
  // beneficios gratuitos (100%) o de acceso sin costo no hace falta monto.
  const necesitaMonto = descuento > 0 && descuento < 100;
  const montoNum = parseFloat(monto || '0') || 0;
  const ahorro = montoNum * (descuento / 100);
  const totalAPagar = montoNum - ahorro;
  const saldoDisponible = selectedBen?.saldo?.disponible ?? Infinity;
  const montoExcedeSaldo = necesitaMonto && montoNum > 0 && saldoDisponible !== Infinity && montoNum > saldoDisponible;

  return (
    <div
      style={{
        display: isDesktop ? 'grid' : 'block',
        gridTemplateColumns: isDesktop ? '340px minmax(0, 1fr)' : undefined,
        gap: isDesktop ? 28 : undefined,
        alignItems: 'start',
      }}
    >
      {/* ===== Membership Card ===== */}
      <div
        style={{
          position: 'relative',
          padding: isDesktop ? '24px' : '20px',
          ...(isDesktop ? { position: 'sticky', top: 24 } : null),
          background: CARD_GRADIENT,
          borderRadius: '16px',
          marginBottom: 24,
          boxShadow: '0 12px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
          overflow: 'hidden',
          borderTop: '2px solid rgba(191,163,99,0.35)',
        }}
      >
        {/* Highlight sutil arriba */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at 70% 0%, rgba(191,163,99,0.12), transparent 55%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', display: 'flex', flexDirection: isDesktop ? 'column' : 'row', alignItems: isDesktop ? 'flex-start' : 'center', gap: isDesktop ? 18 : 16 }}>
          {/* Foto */}
          <div
            style={{
              position: 'relative',
              flexShrink: 0,
            }}
          >
            {!familiarInfo && beneficiario.foto ? (
              <img
                src={beneficiario.foto}
                alt={`${beneficiario.nombre} ${beneficiario.apellido}`}
                style={{
                  width: isDesktop ? 132 : 72,
                  height: isDesktop ? 132 : 72,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: isDesktop ? '4px solid rgba(255,255,255,0.28)' : '3px solid rgba(255,255,255,0.25)',
                  background: 'rgba(0,0,0,0.2)',
                  boxShadow: isDesktop ? '0 6px 20px rgba(0,0,0,0.35)' : 'none',
                }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div
                style={{
                  width: isDesktop ? 132 : 72,
                  height: isDesktop ? 132 : 72,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)',
                  border: isDesktop ? '4px solid rgba(255,255,255,0.28)' : '3px solid rgba(255,255,255,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isDesktop ? '42px' : '24px',
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.9)',
                  letterSpacing: '-0.02em',
                  boxShadow: isDesktop ? '0 6px 20px rgba(0,0,0,0.35)' : 'none',
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
                Grupo Popper · Beneficios
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
                  {relacionLabel(familiarInfo.relacion)}
                </span>
              )}
            </div>
            <h2
              style={{
                fontSize: isDesktop ? '26px' : '22px',
                fontWeight: 700,
                color: 'white',
                letterSpacing: '-0.015em',
                lineHeight: 1.15,
                margin: 0,
                textShadow: '0 1px 3px rgba(0,0,0,0.45)',
              }}
            >
              {beneficiario.nombre} {beneficiario.apellido}
            </h2>
            {familiarInfo && (() => {
              const titFoto = familiarInfo.titular.foto ?? beneficiario.foto;
              const titArea = formatArea(
                familiarInfo.titular.departamento ?? beneficiario.departamento,
                familiarInfo.titular.sector ?? beneficiario.sector,
              );
              return (
              <div style={{
                marginTop: 10,
                padding: '10px 12px',
                borderRadius: 12,
                background: 'rgba(0,0,0,0.30)',
                border: '1px solid rgba(255,255,255,0.22)',
                display: 'flex',
                alignItems: 'center',
                gap: 11,
              }}>
                {titFoto ? (
                  <img
                    src={titFoto}
                    alt={`${familiarInfo.titular.nombre} ${familiarInfo.titular.apellido}`}
                    style={{
                      width: 48, height: 48, borderRadius: '50%', objectFit: 'cover',
                      flexShrink: 0, border: '2px solid rgba(255,255,255,0.3)',
                      background: 'rgba(0,0,0,0.2)',
                    }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '17px', fontWeight: 600, color: 'rgba(255,255,255,0.9)',
                  }}>
                    {familiarInfo.titular.nombre[0]}{familiarInfo.titular.apellido[0]}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: 'rgba(255,255,255,0.72)',
                    marginBottom: 2, textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                  }}>
                    Titular · Colaborador Grupo Popper
                  </p>
                  <p style={{
                    fontSize: isDesktop ? '16px' : '14.5px', fontWeight: 700,
                    color: '#fff', lineHeight: 1.2,
                    textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                  }}>
                    {familiarInfo.titular.nombre} {familiarInfo.titular.apellido}
                  </p>
                  {titArea && (
                    <p style={{
                      fontSize: '11.5px', fontWeight: 500, color: 'rgba(255,255,255,0.8)',
                      lineHeight: 1.2, marginTop: 2, textShadow: '0 1px 2px rgba(0,0,0,0.35)',
                    }}>
                      {titArea}
                    </p>
                  )}
                </div>
              </div>
              );
            })()}
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
              {familiarInfo ? 'DNI del familiar' : beneficiario.cargo ? 'Cargo' : 'Departamento'}
            </p>
            <p style={{
              fontSize: '12.5px',
              color: 'white',
              fontWeight: 600,
              lineHeight: 1.3,
              fontFamily: familiarInfo ? 'var(--font-geist-mono)' : undefined,
              fontVariantNumeric: familiarInfo ? 'tabular-nums' : undefined,
              textShadow: '0 1px 2px rgba(0,0,0,0.35)',
            }}>
              {familiarInfo
                ? beneficiario.dni
                : (beneficiario.cargo || beneficiario.departamento || '—')}
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

      {/* ===== Columna derecha (desktop) — beneficios + acciones ===== */}
      <div style={{ minWidth: 0 }}>
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

      {/* ===== Panel invitados (V4 Talento) ===== */}
      {selectedBen && beneficiario.es_talento_popper && (selectedBen.max_invitados ?? 0) > 0 && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            background: 'rgba(191,163,99,0.06)',
            border: '1px solid rgba(191,163,99,0.2)',
            borderRadius: '12px',
          }}
        >
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--brand)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
            Invitados
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '13px', color: 'var(--text-1)', fontWeight: 500 }}>
                {invitadosCount === 0 ? 'Sin invitados' : `${invitadosCount} invitado${invitadosCount !== 1 ? 's' : ''}`}
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 2 }}>
                Máx. {selectedBen.max_invitados} · {selectedBen.cubre_invitados ? 'Empresa cubre' : 'Pagan aparte'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setInvitadosCount(Math.max(0, invitadosCount - 1))}
                disabled={invitadosCount === 0}
                style={{
                  width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border-default)',
                  background: 'var(--bg-elevated)', color: 'var(--text-1)', fontSize: '20px',
                  cursor: invitadosCount === 0 ? 'not-allowed' : 'pointer',
                  opacity: invitadosCount === 0 ? 0.4 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >−</button>
              <span style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-1)', minWidth: 28, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                {invitadosCount}
              </span>
              <button
                onClick={() => setInvitadosCount(Math.min(selectedBen.max_invitados ?? 0, invitadosCount + 1))}
                disabled={invitadosCount >= (selectedBen.max_invitados ?? 0)}
                style={{
                  width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--brand)',
                  background: 'var(--brand)', color: 'var(--brand-fg)', fontSize: '20px',
                  cursor: invitadosCount >= (selectedBen.max_invitados ?? 0) ? 'not-allowed' : 'pointer',
                  opacity: invitadosCount >= (selectedBen.max_invitados ?? 0) ? 0.4 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >+</button>
            </div>
          </div>
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
                    width: selectedBen.saldo.limite_mensual
                      ? `${Math.min(100, ((selectedBen.saldo.gastado_mes || 0) / selectedBen.saldo.limite_mensual) * 100)}%`
                      : '0%',
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

          {/* Warning en tiempo real: monto excede saldo */}
          {montoExcedeSaldo && (
            <div style={{
              marginTop: 8, padding: '8px 12px',
              background: 'var(--warning-bg)', border: '1px solid var(--warning-border)',
              borderRadius: '8px', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: '16px' }}>⚠</span>
              <p style={{ fontSize: '12px', color: 'var(--warning-text)', lineHeight: 1.4 }}>
                El monto excede el saldo disponible (<strong>${saldoDisponible.toLocaleString('es-AR')}</strong>).
                Al confirmar, el responsable del comercio deberá autorizar con su PIN.
              </p>
            </div>
          )}

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
                  {(() => {
                    if (h.tipo_descuento === 'gratuito') {
                      return (
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '3px 8px', borderRadius: '20px' }}>
                          GRATIS
                        </span>
                      );
                    }
                    if (h.monto_descuento && Number(h.monto_descuento) > 0) {
                      return (
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>
                          −${Math.round(Number(h.monto_descuento)).toLocaleString('es-AR')}
                        </span>
                      );
                    }
                    if (h.valor_fijo && Number(h.valor_fijo) > 0) {
                      return (
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>
                          ${Number(h.valor_fijo).toLocaleString('es-AR')}
                        </span>
                      );
                    }
                    return null;
                  })()}
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
      {(benefit.tipo_descuento === 'gratuito' || benefit.descuento || benefit.valor_fijo) && (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {benefit.tipo_descuento === 'gratuito' ? (
            <span style={{
              fontSize: '13px', fontWeight: 700, color: '#16a34a',
              background: '#dcfce7', padding: '4px 10px', borderRadius: '20px',
              display: 'inline-block',
            }}>
              GRATIS
            </span>
          ) : benefit.descuento ? (
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 1, color: selected ? 'var(--brand)' : 'var(--text-1)' }}>
              <span style={{ fontSize: '22px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {Math.round(Number(benefit.descuento))}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>%</span>
            </div>
          ) : benefit.valor_fijo ? (
            <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>
              ${Number(benefit.valor_fijo).toLocaleString('es-AR')}
            </span>
          ) : null}
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
  beneficiario, familiarInfo, beneficio, monto, invitadosCount, processing, errorMsg, overrideRequired,
  onConfirmar, onConfirmarConPin, onCancelar,
}: {
  beneficiario: Beneficiario;
  familiarInfo: FamiliarInfo | null;
  beneficio: Beneficio;
  monto: string;
  invitadosCount: number;
  processing: boolean;
  errorMsg: string;
  overrideRequired: boolean;
  onConfirmar: (retiradoPorDni?: string) => void;
  onConfirmarConPin: (pin: string, retiradoPorDni?: string) => void;
  onCancelar: () => void;
}) {
  const [pin, setPin] = useState('');
  const esMenor = familiarInfo?.es_menor === true;
  const [retiradoPorDni, setRetiradoPorDni] = useState('');
  const montoNum = parseFloat(monto || '0') || 0;
  const descuento = beneficio.descuento ? Number(beneficio.descuento) : 0;
  const ahorro = montoNum * (descuento / 100);
  const totalAPagar = montoNum - ahorro;
  const esGratis = beneficio.tipo_descuento === 'gratuito';
  const fullName = `${beneficiario.nombre} ${beneficiario.apellido}`;

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
        <p style={{ fontSize: '11.5px', color: 'var(--text-2)', marginTop: 4, lineHeight: 1.4 }}>
          {esMenor
            ? 'Pedí DNI del adulto autorizado que retira'
            : familiarInfo
              ? 'Pedí DNI físico al familiar y verificá contra los datos en pantalla'
              : 'Pedí DNI físico al colaborador y verificá contra los datos en pantalla'}
        </p>
      </div>

      {/* Foto y nombre del colaborador — GRANDE */}
      <div style={{
        padding: 20, background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)', borderRadius: '14px',
        textAlign: 'center', marginBottom: 14,
      }}>
        {(() => {
          // V3H: solo la foto del titular (de Naaloo). Familiares sin foto.
          const fotoMostrar = familiarInfo ? null : beneficiario.foto;
          if (fotoMostrar) {
            return (
              <img
                src={fotoMostrar}
                alt={fullName}
                style={{
                  width: 120, height: 120, borderRadius: '50%', objectFit: 'cover',
                  border: '3px solid var(--brand)',
                  margin: '0 auto 14px', display: 'block',
                }}
              />
            );
          }
          return (
            <div style={{
              width: 120, height: 120, borderRadius: '50%',
              background: 'var(--brand-muted)', border: '3px solid var(--brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--brand)', fontWeight: 700, fontSize: '36px',
              margin: '0 auto 14px',
            }}>
              {beneficiario.nombre[0]}{beneficiario.apellido[0]}
            </div>
          );
        })()}
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.01em', marginBottom: 4 }}>
          {fullName}
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>
          DNI <span style={{ fontFamily: 'var(--font-geist-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)' }}>
            {beneficiario.dni}
          </span>
          {beneficiario.es_talento_popper && <span style={{ marginLeft: 8, color: 'var(--brand)' }}>★ Talento</span>}
        </p>
        {familiarInfo && (() => {
          const titFoto = familiarInfo.titular.foto ?? beneficiario.foto;
          const titArea = formatArea(
            familiarInfo.titular.departamento ?? beneficiario.departamento,
            familiarInfo.titular.sector ?? beneficiario.sector,
          );
          return (
          <div style={{
            marginTop: 12, padding: '10px 12px', maxWidth: 340,
            marginLeft: 'auto', marginRight: 'auto',
            background: 'var(--bg-canvas)', borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left',
          }}>
            {titFoto ? (
              <img
                src={titFoto}
                alt={`${familiarInfo.titular.nombre} ${familiarInfo.titular.apellido}`}
                style={{
                  width: 46, height: 46, borderRadius: '50%', objectFit: 'cover',
                  flexShrink: 0, border: '2px solid var(--brand)',
                }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div style={{
                width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                background: 'var(--brand-muted)', border: '2px solid var(--brand)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--brand)', fontWeight: 700, fontSize: '16px',
              }}>
                {familiarInfo.titular.nombre[0]}{familiarInfo.titular.apellido[0]}
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{
                fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 2,
              }}>
                {relacionLabel(familiarInfo.relacion)} · Titular colaborador
              </p>
              <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.2 }}>
                {familiarInfo.titular.nombre} {familiarInfo.titular.apellido}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                {titArea && (
                  <span style={{ fontSize: '11.5px', color: 'var(--text-2)' }}>
                    {titArea}
                  </span>
                )}
                {familiarInfo.edad != null && (
                  <span style={{
                    padding: '1px 7px', borderRadius: '999px',
                    background: esMenor ? 'var(--danger-bg)' : 'var(--success-bg)',
                    color: esMenor ? 'var(--danger-text)' : 'var(--success-text)',
                    fontSize: '10.5px', fontWeight: 700,
                  }}>
                    {familiarInfo.edad} años {esMenor ? '· menor' : '· adulto'}
                  </span>
                )}
              </div>
            </div>
          </div>
          );
        })()}
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
          {invitadosCount > 0 && (
            <Row
              label="Invitados"
              value={`${invitadosCount} persona${invitadosCount !== 1 ? 's' : ''}${beneficio.cubre_invitados ? ' (empresa cubre)' : ''}`}
            />
          )}

          {/* Condición de precio — siempre visible */}
          {esGratis ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
              <span style={{ fontSize: '12.5px', color: 'var(--text-3)' }}>Condición</span>
              <span style={{
                fontSize: '13px', fontWeight: 700, color: '#16a34a',
                background: '#dcfce7', padding: '3px 12px', borderRadius: '20px',
              }}>GRATIS</span>
            </div>
          ) : descuento > 0 && montoNum === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
              <span style={{ fontSize: '12.5px', color: 'var(--text-3)' }}>Descuento aplicable</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--brand)' }}>{Math.round(descuento)}% OFF</span>
            </div>
          ) : null}

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

      {/* V3H: Banner menor de edad + dropdown adulto autorizado */}
      {esMenor && familiarInfo && (
        <div style={{
          padding: 14, marginBottom: 14,
          background: 'var(--danger-bg)', border: '2px solid var(--danger-border)',
          borderRadius: '10px',
        }}>
          <p style={{
            fontSize: '12px', fontWeight: 700, color: 'var(--danger-text)',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8,
          }}>
            ⚠ Menor de edad ({familiarInfo.edad} años)
          </p>
          <p style={{ fontSize: '12.5px', color: 'var(--text-1)', marginBottom: 12, lineHeight: 1.5 }}>
            Menor de edad. Requiere adulto autorizado por la empresa.
          </p>
          <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-2)', fontWeight: 500, marginBottom: 6 }}>
            DNI del adulto que retira (titular o familiar adulto del titular)
          </label>
          {familiarInfo.adultos_autorizados && familiarInfo.adultos_autorizados.length > 0 && (
            <select
              value={retiradoPorDni}
              onChange={e => setRetiradoPorDni(e.target.value)}
              style={{
                width: '100%', height: 40, padding: '0 12px',
                background: 'var(--bg-canvas)', border: '1px solid var(--border-default)',
                borderRadius: '6px', color: 'var(--text-1)', fontSize: '13px',
                marginBottom: 8, outline: 'none',
              }}
            >
              <option value="">— Seleccionar adulto autorizado —</option>
              {familiarInfo.adultos_autorizados.map(a => (
                <option key={a.dni} value={a.dni}>
                  {a.nombre} {a.apellido || ''} · DNI {a.dni} {a.esTitular ? '(Titular)' : `(${a.relacion})`}
                </option>
              ))}
            </select>
          )}
          <input
            type="text" inputMode="numeric"
            placeholder="O ingresar DNI manualmente"
            value={retiradoPorDni}
            onChange={e => setRetiradoPorDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
            style={{
              width: '100%', height: 40, padding: '0 12px',
              background: 'var(--bg-canvas)', border: '1px solid var(--border-default)',
              borderRadius: '6px', color: 'var(--text-1)', fontSize: '14px',
              fontVariantNumeric: 'tabular-nums', letterSpacing: '0.1em',
              outline: 'none',
            }}
          />
          <p style={{ fontSize: '10.5px', color: 'var(--text-3)', marginTop: 6 }}>
            El sistema valida que el DNI corresponda a un adulto registrado en Naaloo como familiar del titular o al propio titular.
          </p>
        </div>
      )}

      {/* PIN del responsable si requiere override */}
      {overrideRequired && (
        <div style={{
          padding: 14, marginBottom: 14,
          background: 'var(--bg-elevated)', border: '1px solid var(--warning-border)', borderRadius: '10px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: '11.5px', color: 'var(--warning-text)', fontWeight: 600 }}>
              🔒 PIN del responsable para autorizar
            </label>
            <span style={{
              fontSize: '11px', fontWeight: 600,
              color: pin.length >= 4 ? 'var(--success-text)' : 'var(--text-3)',
            }}>
              {pin.length}/4 {pin.length >= 4 ? '✓' : ''}
            </span>
          </div>
          <input
            type="password" inputMode="numeric"
            placeholder="• • • •"
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
            style={{
              width: '100%', height: 44, padding: '0 14px',
              background: 'var(--bg-canvas)',
              border: `1px solid ${pin.length >= 4 ? 'var(--success-border, #86efac)' : 'var(--border-default)'}`,
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
          onClick={() => {
            const rp = esMenor ? retiradoPorDni : undefined;
            overrideRequired ? onConfirmarConPin(pin, rp) : onConfirmar(rp);
          }}
          disabled={
            processing ||
            (overrideRequired && pin.length < 4) ||
            (esMenor && retiradoPorDni.length < 7)
          }
          style={{
            flex: 1, height: 52, background: overrideRequired ? 'var(--warning)' : 'var(--success)',
            color: '#0a0a0a', border: 'none', borderRadius: '10px',
            fontSize: '15px', fontWeight: 700, cursor: processing ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: processing || (overrideRequired && pin.length < 4) || (esMenor && retiradoPorDni.length < 7) ? 0.6 : 1,
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
          ) : overrideRequired ? '✓ Autorizar con PIN' : '✓ Confirmar canje'}
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
          beneficio.tipo_descuento === 'gratuito' ? (
            <div style={{ marginTop: 10 }}>
              <span style={{
                fontSize: '18px', fontWeight: 700, color: '#16a34a',
                background: '#dcfce7', padding: '6px 18px', borderRadius: '24px',
                display: 'inline-block', letterSpacing: '0.05em',
              }}>
                GRATIS
              </span>
            </div>
          ) : (
            <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'baseline', gap: 4, color: 'var(--brand)' }}>
              <span style={{ fontSize: '32px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {Math.round(Number(beneficio.descuento))}%
              </span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                de descuento
              </span>
            </div>
          )
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
