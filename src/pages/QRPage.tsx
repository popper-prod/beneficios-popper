import { useState, useEffect } from 'react';

// ============================================
// QRPage - Premium Private Bank aesthetic
// Página pública que ven los colaboradores al escanear el QR.
// Es la cara visible de la marca - cada detalle suma a la sensación de exclusividad.
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
}

interface Beneficio {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: string;
  descuento: number | null;
  valor_fijo: number | null;
  nivel_minimo: string;
}

interface HistorialItem {
  fecha_verificacion: string;
  beneficio_nombre: string;
  beneficio_tipo: string;
  descuento: number | null;
  comercio_nombre: string;
  codigo_referencia: string;
}

type Step = 'loading' | 'identify' | 'profile' | 'success' | 'error';

// Niveles con paleta refinada (más sobria, menos chillona)
const nivelTier: Record<string, { gradient: string; text: string; border: string; label: string; tier: number }> = {
  bronce: {
    gradient: 'linear-gradient(135deg, #8b6a3a 0%, #6a4f29 100%)',
    text: '#d4a76a',
    border: 'rgba(180,130,70,0.45)',
    label: 'Bronce',
    tier: 1,
  },
  plata: {
    gradient: 'linear-gradient(135deg, #b8c0c8 0%, #889098 100%)',
    text: '#c8d0d8',
    border: 'rgba(184,192,200,0.45)',
    label: 'Plata',
    tier: 2,
  },
  oro: {
    gradient: 'linear-gradient(135deg, #d4b978 0%, #bfa363 50%, #9d8649 100%)',
    text: '#e8d9b3',
    border: 'rgba(212,185,120,0.55)',
    label: 'Oro',
    tier: 3,
  },
  platinum: {
    gradient: 'linear-gradient(135deg, #e8e6e3 0%, #c4c1bc 50%, #a8a4a0 100%)',
    text: '#f0eeea',
    border: 'rgba(232,230,227,0.55)',
    label: 'Platinum',
    tier: 4,
  },
};

export default function QRPage({ qrCode }: { qrCode: string }) {
  const [step, setStep] = useState<Step>('loading');
  const [comercio, setComercio] = useState<Comercio | null>(null);
  const [beneficiario, setBeneficiario] = useState<Beneficiario | null>(null);
  const [beneficios, setBeneficios] = useState<Beneficio[]>([]);
  const [selectedBenefit, setSelectedBenefit] = useState<string>('');
  const [dni, setDni] = useState('');
  const [searching, setSearching] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successData, setSuccessData] = useState<any>(null);
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [showHistorial, setShowHistorial] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
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
    requestAnimationFrame(() => setMounted(true));
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
      setBeneficios(data.beneficios);
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

  const handleCanjear = async () => {
    if (!comercio || !beneficiario || !selectedBenefit) return;
    setProcessing(true);

    try {
      const res = await fetch(`${API_URL}/public/canjear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dni: beneficiario.dni,
          beneficio_id: selectedBenefit,
          comercio_id: comercio.id,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
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
    setBeneficios([]);
    setSelectedBenefit('');
    setErrorMsg('');
    setSuccessData(null);
    setHistorial([]);
    setShowHistorial(false);
    setStep('identify');
  };

  const selectedBenefitData = beneficios.find(b => b.id === selectedBenefit);

  return (
    <div className="min-h-screen relative flex items-start md:items-center justify-center overflow-hidden py-6 px-4">
      {/* Fondo cinematográfico */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, #0f1b2e 0%, #080e1a 60%, #06090f 100%)' }}
      />
      {/* Grano */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>\")",
        }}
      />
      {/* Glow dorado */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, rgba(191,163,99,0.06), transparent 65%)',
          filter: 'blur(30px)',
        }}
      />

      <div
        className={`relative z-10 w-full max-w-[480px] transition-all ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
        style={{ transitionDuration: '1200ms', transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="relative">
          {/* Borde dorado */}
          <div
            className="absolute -inset-px rounded-[22px] pointer-events-none"
            style={{
              background:
                'linear-gradient(180deg, rgba(191,163,99,0.22) 0%, rgba(191,163,99,0.05) 40%, rgba(191,163,99,0.02) 100%)',
            }}
          />

          <div
            className="relative rounded-[22px] overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, rgba(20,28,46,0.94) 0%, rgba(8,14,26,0.98) 100%)',
              backdropFilter: 'blur(40px)',
              boxShadow: '0 24px 60px rgba(8,14,26,0.5), inset 0 1px 0 rgba(212,185,120,0.06)',
            }}
          >
            {/* ====== Brand header ====== */}
            <BrandHeader />

            <div className="mx-10 divider-gold" />

            {/* ====== LOADING ====== */}
            {step === 'loading' && <LoadingState />}

            {/* ====== ERROR ====== */}
            {step === 'error' && <ErrorState message={errorMsg} />}

            {/* ====== IDENTIFY ====== */}
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

            {/* ====== PROFILE ====== */}
            {step === 'profile' && beneficiario && (
              <ProfileStep
                beneficiario={beneficiario}
                beneficios={beneficios}
                selectedBenefit={selectedBenefit}
                setSelectedBenefit={setSelectedBenefit}
                historial={historial}
                showHistorial={showHistorial}
                setShowHistorial={setShowHistorial}
                processing={processing}
                errorMsg={errorMsg}
                onCanjear={handleCanjear}
                onReset={handleReset}
              />
            )}

            {/* ====== SUCCESS ====== */}
            {step === 'success' && successData && selectedBenefitData && (
              <SuccessStep
                beneficio={selectedBenefitData}
                successData={successData}
                comercio={comercio}
                onReset={handleReset}
              />
            )}

            {/* Footer */}
            <div className="mx-10 divider-gold" />
            <div className="px-8 py-5 text-center">
              <p
                className="text-[9.5px]"
                style={{
                  color: 'rgba(255,255,255,0.18)',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                }}
              >
                &copy; 2026 Recluta &middot; Verificación segura
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SUBCOMPONENTES
// ============================================

function BrandHeader() {
  return (
    <div className="pt-9 pb-7 text-center">
      <div className="relative inline-flex">
        {/* Halo */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(191,163,99,0.18), transparent 70%)',
            filter: 'blur(10px)',
            transform: 'scale(1.5)',
          }}
        />
        <div
          className="relative w-[60px] h-[60px] rounded-full flex items-center justify-center"
          style={{
            border: '1.5px solid rgba(191,163,99,0.4)',
            background: 'radial-gradient(circle at 30% 30%, rgba(212,185,120,0.08), rgba(8,14,26,0.4))',
            boxShadow: '0 0 24px rgba(191,163,99,0.1), inset 0 1px 0 rgba(212,185,120,0.15)',
          }}
        >
          <span
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: '22px',
              fontWeight: 700,
              color: '#d4b978',
              letterSpacing: '-0.02em',
              textShadow: '0 0 12px rgba(212,185,120,0.4)',
            }}
          >
            GP
          </span>
        </div>
      </div>
      <h1
        className="mt-5 leading-none"
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: '20px',
          fontWeight: 600,
          color: 'rgba(245,241,232,0.9)',
          letterSpacing: '0.04em',
        }}
      >
        Grupo Popper
      </h1>
      <p
        className="mt-2 text-[9.5px] font-semibold"
        style={{
          color: 'rgba(191,163,99,0.5)',
          letterSpacing: '0.42em',
          textTransform: 'uppercase',
        }}
      >
        Beneficios Privados
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="px-8 py-20 text-center">
      <div className="relative inline-flex">
        <div
          className="w-12 h-12 rounded-full"
          style={{
            border: '2px solid rgba(191,163,99,0.12)',
            borderTopColor: '#bfa363',
            animation: 'spin 800ms cubic-bezier(0.4, 0, 0.2, 1) infinite',
          }}
        />
      </div>
      <p
        className="mt-5 text-[11px] font-semibold"
        style={{ color: 'rgba(191,163,99,0.45)', letterSpacing: '0.3em', textTransform: 'uppercase' }}
      >
        Verificando comercio
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="px-10 py-14 text-center animate-fadeIn">
      <div
        className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center"
        style={{
          background: 'rgba(232,144,137,0.08)',
          border: '1px solid rgba(232,144,137,0.2)',
        }}
      >
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="rgba(232,144,137,0.85)" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>
      <h2
        className="text-[20px] mb-2"
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          color: 'rgba(255,255,255,0.9)',
          fontWeight: 600,
        }}
      >
        Hubo un inconveniente
      </h2>
      <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
        {message}
      </p>
    </div>
  );
}

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
    <div className="px-8 pt-7 pb-9 animate-fadeIn">
      {/* Commerce card */}
      <div
        className="relative p-4 rounded-2xl mb-7 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(191,163,99,0.04) 100%)',
          border: '1px solid rgba(191,163,99,0.12)',
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(212,185,120,0.3), transparent)' }}
        />
        <div className="flex items-center gap-3.5">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'rgba(191,163,99,0.08)',
              border: '1px solid rgba(191,163,99,0.18)',
            }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#bfa363" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="text-[9.5px] font-semibold mb-1"
              style={{ color: 'rgba(191,163,99,0.55)', letterSpacing: '0.22em', textTransform: 'uppercase' }}
            >
              Comercio adherido
            </p>
            <p
              className="text-[15px] leading-tight"
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                color: 'rgba(255,255,255,0.95)',
                fontWeight: 600,
              }}
            >
              {comercio.nombre}
            </p>
            <p className="text-[11px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {comercio.direccion}, {comercio.ciudad}
            </p>
          </div>
        </div>
      </div>

      {/* Título */}
      <h2
        className="leading-tight"
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: '26px',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.95)',
          letterSpacing: '-0.01em',
        }}
      >
        Bienvenido
      </h2>
      <p className="text-[13px] mt-2 mb-7 leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Identificate con tu DNI para acceder a tus beneficios disponibles en este comercio.
      </p>

      {/* DNI input dramático */}
      <label
        className="block text-[10px] font-semibold mb-3"
        style={{
          color: focused ? 'rgba(191,163,99,0.85)' : 'rgba(191,163,99,0.45)',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          transition: 'color 320ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        Número de Documento
      </label>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="00000000"
        value={dni}
        onChange={e => {
          const val = e.target.value.replace(/\D/g, '').slice(0, 8);
          setDni(val);
          setErrorMsg('');
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') onSearch();
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus
        autoComplete="off"
        className="w-full px-5 py-5 rounded-xl text-center transition-all"
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: '28px',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.95)',
          background: focused ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.025)',
          border: focused ? '1px solid rgba(191,163,99,0.4)' : '1px solid rgba(255,255,255,0.06)',
          boxShadow: focused
            ? '0 0 0 4px rgba(191,163,99,0.06), inset 0 1px 0 rgba(212,185,120,0.05)'
            : 'none',
          caretColor: '#bfa363',
          letterSpacing: '0.15em',
          fontVariantNumeric: 'tabular-nums',
          transitionDuration: '320ms',
          transitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)',
        }}
      />

      {/* Progress dots para los dígitos */}
      <div className="flex items-center justify-center gap-1.5 mt-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all"
            style={{
              width: i < dni.length ? '6px' : '4px',
              height: i < dni.length ? '6px' : '4px',
              backgroundColor:
                i < dni.length ? 'rgba(191,163,99,0.85)' : 'rgba(191,163,99,0.18)',
              transitionDuration: '300ms',
              transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        ))}
      </div>

      {/* Error */}
      {errorMsg && (
        <div
          className="mt-5 p-3 rounded-xl animate-shake"
          style={{
            background: 'rgba(232,144,137,0.06)',
            border: '1px solid rgba(232,144,137,0.18)',
          }}
        >
          <p className="text-[12.5px] text-center" style={{ color: 'rgba(232,144,137,0.92)' }}>
            {errorMsg}
          </p>
        </div>
      )}

      {/* Botón verificar */}
      <button
        onClick={onSearch}
        disabled={dni.length < 7 || searching}
        className="relative w-full mt-7 py-[16px] rounded-xl text-[12.5px] font-semibold overflow-hidden transition-all group disabled:opacity-30 disabled:cursor-not-allowed"
        style={{
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          background: 'linear-gradient(135deg, #d4b978 0%, #bfa363 50%, #9d8649 100%)',
          color: '#0a0e14',
          boxShadow:
            dni.length >= 7 && !searching
              ? '0 8px 24px rgba(191,163,99,0.18), inset 0 1px 0 rgba(255,255,255,0.15)'
              : 'none',
          transitionDuration: '500ms',
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onMouseEnter={e => {
          if (dni.length >= 7 && !searching) e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          {searching ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Verificando
            </>
          ) : (
            <>
              Verificar
              <svg
                className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </>
          )}
        </span>
      </button>
    </div>
  );
}

function ProfileStep({
  beneficiario,
  beneficios,
  selectedBenefit,
  setSelectedBenefit,
  historial,
  showHistorial,
  setShowHistorial,
  processing,
  errorMsg,
  onCanjear,
  onReset,
}: {
  beneficiario: Beneficiario;
  beneficios: Beneficio[];
  selectedBenefit: string;
  setSelectedBenefit: (v: string) => void;
  historial: HistorialItem[];
  showHistorial: boolean;
  setShowHistorial: (v: boolean) => void;
  processing: boolean;
  errorMsg: string;
  onCanjear: () => void;
  onReset: () => void;
}) {
  const tier = nivelTier[beneficiario.nivel] || nivelTier.bronce;

  return (
    <div className="px-8 pt-7 pb-9 animate-fadeIn">
      {/* Hero del perfil */}
      <div className="text-center mb-7">
        {/* Foto con tier ring */}
        <div className="relative inline-block mb-5">
          {/* Tier glow externo */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: tier.gradient,
              filter: 'blur(16px)',
              opacity: 0.25,
              transform: 'scale(1.3)',
            }}
          />
          {/* Ring */}
          <div
            className="relative rounded-full p-[2px]"
            style={{ background: tier.gradient }}
          >
            {beneficiario.foto ? (
              <img
                src={beneficiario.foto}
                alt={`${beneficiario.nombre} ${beneficiario.apellido}`}
                className="w-[108px] h-[108px] rounded-full object-cover block"
                style={{ background: '#0a0e14' }}
                onError={e => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div
                className="w-[108px] h-[108px] rounded-full flex items-center justify-center"
                style={{
                  background: '#0a0e14',
                  color: tier.text,
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: '36px',
                  fontWeight: 600,
                }}
              >
                {beneficiario.nombre[0]}
                {beneficiario.apellido[0]}
              </div>
            )}
          </div>
        </div>

        {/* Nombre */}
        <h2
          className="leading-tight"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '24px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.96)',
            letterSpacing: '-0.01em',
          }}
        >
          {beneficiario.nombre} {beneficiario.apellido}
        </h2>

        {/* Cargo + departamento */}
        <p className="text-[12.5px] mt-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {beneficiario.cargo && <span>{beneficiario.cargo}</span>}
          {beneficiario.cargo && beneficiario.departamento && (
            <span className="mx-1.5" style={{ color: 'rgba(191,163,99,0.4)' }}>
              ·
            </span>
          )}
          {beneficiario.departamento && <span>{beneficiario.departamento}</span>}
        </p>

        {/* Credential badge premium */}
        <div className="mt-4 inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full" style={{
          background: 'rgba(8,14,26,0.5)',
          border: `1px solid ${tier.border}`,
        }}>
          {/* Diamantes (estrellas) según tier */}
          <span className="flex items-center gap-0.5">
            {Array.from({ length: tier.tier }).map((_, i) => (
              <svg key={i} className="w-2.5 h-2.5" fill={tier.text} viewBox="0 0 16 16">
                <path d="M8 0L9.7 5.5H15L10.7 8.8 12.4 14.3 8 11 3.6 14.3 5.3 8.8 1 5.5H6.3z" />
              </svg>
            ))}
          </span>
          <span
            className="text-[10.5px] font-semibold"
            style={{
              color: tier.text,
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
            }}
          >
            {tier.label}
          </span>
          {beneficiario.legajo && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
              <span
                className="text-[10px]"
                style={{
                  color: 'rgba(255,255,255,0.4)',
                  letterSpacing: '0.1em',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                #{beneficiario.legajo}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="divider-gold mb-5" />

      {/* Beneficios */}
      <div className="flex items-center justify-between mb-4">
        <p
          className="text-[10px] font-semibold"
          style={{ color: 'rgba(191,163,99,0.5)', letterSpacing: '0.22em', textTransform: 'uppercase' }}
        >
          Beneficios disponibles
        </p>
        <span
          className="text-[11px]"
          style={{
            color: 'rgba(255,255,255,0.4)',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: "'Playfair Display', Georgia, serif",
            fontStyle: 'italic',
          }}
        >
          {beneficios.length} {beneficios.length === 1 ? 'oferta' : 'ofertas'}
        </span>
      </div>

      {beneficios.length === 0 ? (
        <div className="py-10 px-4 text-center rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
          <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
            No hay beneficios disponibles en este comercio para tu nivel.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1 -mr-1">
          {beneficios.map(b => (
            <BenefitCard
              key={b.id}
              benefit={b}
              selected={selectedBenefit === b.id}
              onSelect={() => setSelectedBenefit(b.id === selectedBenefit ? '' : b.id)}
            />
          ))}
        </div>
      )}

      {/* Historial colapsable */}
      {historial.length > 0 && (
        <div className="mt-6">
          <div className="divider-gold mb-3" />
          <button
            onClick={() => setShowHistorial(!showHistorial)}
            className="w-full flex items-center justify-between py-2 text-[10px] font-semibold transition-colors"
            style={{
              color: showHistorial ? 'rgba(191,163,99,0.8)' : 'rgba(191,163,99,0.45)',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
            }}
          >
            <span>
              Mis canjes recientes
              <span
                className="ml-2"
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontStyle: 'italic',
                  textTransform: 'lowercase',
                  letterSpacing: 'normal',
                  color: 'rgba(255,255,255,0.3)',
                }}
              >
                ({historial.length})
              </span>
            </span>
            <svg
              className={`w-3 h-3 transition-transform duration-500 ${showHistorial ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showHistorial && (
            <div className="mt-3 space-y-2 max-h-[200px] overflow-y-auto pr-1 animate-fadeIn">
              {historial.map((h, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-medium truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>
                        {h.beneficio_nombre}
                      </p>
                      <p className="text-[10.5px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {h.comercio_nombre}
                        <span className="mx-1.5">·</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {new Date(h.fecha_verificacion).toLocaleDateString('es-AR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                          })}
                        </span>
                      </p>
                    </div>
                    {h.descuento && (
                      <span
                        className="flex-shrink-0 text-[11px] font-semibold"
                        style={{
                          color: '#7fc99f',
                          fontFamily: "'Playfair Display', Georgia, serif",
                        }}
                      >
                        −{h.descuento}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div
          className="mt-5 p-3 rounded-xl"
          style={{ background: 'rgba(232,144,137,0.06)', border: '1px solid rgba(232,144,137,0.18)' }}
        >
          <p className="text-[12.5px] text-center" style={{ color: 'rgba(232,144,137,0.92)' }}>
            {errorMsg}
          </p>
        </div>
      )}

      {/* Botones */}
      <div className="flex gap-3 mt-7">
        <button
          onClick={onReset}
          className="flex-shrink-0 px-5 py-[15px] rounded-xl text-[11.5px] font-semibold transition-all"
          style={{
            color: 'rgba(255,255,255,0.5)',
            border: '1px solid rgba(255,255,255,0.08)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'rgba(191,163,99,0.25)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
          }}
        >
          Volver
        </button>
        <button
          onClick={onCanjear}
          disabled={!selectedBenefit || processing}
          className="relative flex-1 py-[15px] rounded-xl text-[12px] font-semibold overflow-hidden transition-all group disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            background: 'linear-gradient(135deg, #d4b978 0%, #bfa363 50%, #9d8649 100%)',
            color: '#0a0e14',
            boxShadow:
              selectedBenefit && !processing
                ? '0 8px 24px rgba(191,163,99,0.18), inset 0 1px 0 rgba(255,255,255,0.15)'
                : 'none',
            transitionDuration: '500ms',
          }}
          onMouseEnter={e => {
            if (selectedBenefit && !processing) e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            {processing ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Procesando
              </>
            ) : (
              'Canjear'
            )}
          </span>
        </button>
      </div>
    </div>
  );
}

function BenefitCard({
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
      className="relative w-full p-4 rounded-xl text-left transition-all overflow-hidden group"
      style={{
        background: selected
          ? 'linear-gradient(135deg, rgba(191,163,99,0.10) 0%, rgba(191,163,99,0.05) 100%)'
          : 'rgba(255,255,255,0.02)',
        border: selected ? '1px solid rgba(191,163,99,0.4)' : '1px solid rgba(255,255,255,0.05)',
        boxShadow: selected ? '0 0 0 3px rgba(191,163,99,0.06), 0 4px 12px rgba(191,163,99,0.08)' : 'none',
        transitionDuration: '320ms',
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {selected && (
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(212,185,120,0.5), transparent)' }}
        />
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p
            className="text-[14.5px] leading-tight"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              color: 'rgba(255,255,255,0.95)',
              fontWeight: 600,
            }}
          >
            {benefit.nombre}
          </p>
          {benefit.descripcion && (
            <p className="text-[11.5px] mt-1 leading-relaxed line-clamp-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {benefit.descripcion}
            </p>
          )}
          {(benefit.descuento || benefit.valor_fijo) && (
            <div className="mt-2 flex items-baseline gap-1.5">
              {benefit.descuento && (
                <>
                  <span
                    style={{
                      fontFamily: "'Playfair Display', Georgia, serif",
                      fontSize: '22px',
                      fontWeight: 600,
                      color: '#d4b978',
                      lineHeight: 1,
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {benefit.descuento}
                    <span style={{ fontSize: '14px', marginLeft: '2px' }}>%</span>
                  </span>
                  <span
                    className="text-[9.5px] font-semibold"
                    style={{
                      color: 'rgba(212,185,120,0.6)',
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Descuento
                  </span>
                </>
              )}
              {benefit.valor_fijo && !benefit.descuento && (
                <span
                  style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: '18px',
                    fontWeight: 600,
                    color: '#d4b978',
                  }}
                >
                  ${benefit.valor_fijo}
                </span>
              )}
            </div>
          )}
        </div>
        {/* Selector */}
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-1 transition-all"
          style={{
            background: selected ? 'linear-gradient(135deg, #d4b978, #bfa363)' : 'rgba(255,255,255,0.04)',
            border: selected ? '1px solid #d4b978' : '1.5px solid rgba(255,255,255,0.1)',
            boxShadow: selected ? '0 2px 8px rgba(191,163,99,0.25)' : 'none',
            transitionDuration: '320ms',
          }}
        >
          {selected && (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#0a0e14" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          )}
        </div>
      </div>
    </button>
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
  comercio: Comercio | null;
  onReset: () => void;
}) {
  const codigo = successData.verificacion?.codigo_referencia || '---';
  const fecha = new Date(successData.verificacion?.fecha_verificacion || Date.now());

  return (
    <div className="px-8 pt-9 pb-8 text-center animate-fadeIn">
      {/* Sello premium */}
      <div className="relative inline-block mb-6">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(127,201,159,0.25), transparent 70%)',
            filter: 'blur(16px)',
            transform: 'scale(1.5)',
          }}
        />
        <div
          className="relative w-[88px] h-[88px] rounded-full flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle at 30% 30%, rgba(127,201,159,0.15), rgba(8,14,26,0.5))',
            border: '1.5px solid rgba(127,201,159,0.5)',
            boxShadow: '0 0 30px rgba(127,201,159,0.18), inset 0 1px 0 rgba(127,201,159,0.2)',
          }}
        >
          <svg
            className="w-10 h-10 animate-scaleIn"
            fill="none"
            viewBox="0 0 24 24"
            stroke="#7fc99f"
            strokeWidth={2}
            style={{ filter: 'drop-shadow(0 0 8px rgba(127,201,159,0.4))' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
      </div>

      <p
        className="text-[10px] font-semibold mb-2"
        style={{
          color: 'rgba(127,201,159,0.7)',
          letterSpacing: '0.42em',
          textTransform: 'uppercase',
        }}
      >
        Beneficio confirmado
      </p>
      <h2
        className="leading-tight"
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: '26px',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.96)',
          letterSpacing: '-0.01em',
        }}
      >
        {beneficio.nombre}
      </h2>
      {beneficio.descuento && (
        <p className="mt-2">
          <span
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: '40px',
              fontWeight: 600,
              color: '#d4b978',
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {beneficio.descuento}%
          </span>
          <span className="ml-2 text-[12px] font-semibold uppercase" style={{ color: 'rgba(212,185,120,0.6)', letterSpacing: '0.2em' }}>
            de descuento
          </span>
        </p>
      )}

      {/* Recibo */}
      <div
        className="relative mt-7 p-5 rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(212,185,120,0.04) 0%, rgba(191,163,99,0.02) 100%)',
          border: '1px solid rgba(191,163,99,0.2)',
        }}
      >
        {/* Edge dorado superior */}
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(212,185,120,0.4), transparent)' }}
        />

        <p
          className="text-[9.5px] font-semibold mb-3"
          style={{ color: 'rgba(191,163,99,0.5)', letterSpacing: '0.32em', textTransform: 'uppercase' }}
        >
          Código de verificación
        </p>
        <p
          className="text-[26px] font-mono select-all"
          style={{
            color: 'rgba(245,241,232,0.95)',
            fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
            fontWeight: 600,
            letterSpacing: '0.2em',
            fontVariantNumeric: 'tabular-nums',
            textShadow: '0 0 10px rgba(212,185,120,0.15)',
          }}
        >
          {codigo}
        </p>

        {/* Línea decorativa */}
        <div className="my-4 divider-gold" />

        {/* Detalles del canje */}
        <div className="space-y-2 text-left">
          {comercio && (
            <ReceiptRow label="Comercio" value={comercio.nombre} />
          )}
          <ReceiptRow label="Fecha" value={fecha.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })} />
          <ReceiptRow label="Hora" value={fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} />
        </div>
      </div>

      <p className="text-[11.5px] mt-5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
        Mostrá este código al encargado del comercio para hacer efectivo el beneficio.
      </p>

      <button
        onClick={onReset}
        className="w-full mt-7 py-[15px] rounded-xl text-[11.5px] font-semibold transition-all"
        style={{
          color: 'rgba(255,255,255,0.55)',
          border: '1px solid rgba(255,255,255,0.1)',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'rgba(191,163,99,0.3)';
          e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
          e.currentTarget.style.color = 'rgba(255,255,255,0.55)';
        }}
      >
        Nueva verificación
      </button>
    </div>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className="text-[10px] font-semibold flex-shrink-0"
        style={{
          color: 'rgba(191,163,99,0.5)',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        className="text-[12.5px] text-right truncate"
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          color: 'rgba(255,255,255,0.85)',
          fontWeight: 500,
        }}
      >
        {value}
      </span>
    </div>
  );
}
