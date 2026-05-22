import { useState, useEffect } from 'react';

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

const nivelColors: Record<string, { bg: string; text: string; label: string }> = {
  bronce: { bg: 'rgba(180,130,70,0.15)', text: '#b48246', label: 'Bronce' },
  plata: { bg: 'rgba(160,170,180,0.15)', text: '#a0aab4', label: 'Plata' },
  oro: { bg: 'rgba(191,163,99,0.15)', text: '#bfa363', label: 'Oro' },
  platinum: { bg: 'rgba(170,180,200,0.15)', text: '#8ca0c0', label: 'Platinum' },
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

  const gold = '#bfa363';

  // Cargar info del comercio
  useEffect(() => {
    const fetchComercio = async () => {
      try {
        const res = await fetch(`${API_URL}/public/comercio/${qrCode}`);
        if (!res.ok) {
          setStep('error');
          setErrorMsg('Comercio no encontrado. Verifica el codigo QR.');
          return;
        }
        const data = await res.json();
        setComercio(data.comercio);
        setStep('identify');
      } catch {
        setStep('error');
        setErrorMsg('Error de conexion. Intenta nuevamente.');
      }
    };
    fetchComercio();
    setTimeout(() => setMounted(true), 100);
  }, [qrCode]);

  // Buscar colaborador por DNI
  const handleSearch = async () => {
    if (!comercio || dni.length < 7) return;
    setSearching(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${API_URL}/public/beneficiario/${comercio.id}/${dni}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Colaborador no encontrado');
        setSearching(false);
        return;
      }

      setBeneficiario(data.beneficiario);
      setBeneficios(data.beneficios);
      setStep('profile');

      // Cargar historial en paralelo (no bloquea)
      try {
        const hRes = await fetch(`${API_URL}/public/historial/${dni}`);
        if (hRes.ok) {
          const hData = await hRes.json();
          setHistorial(hData.historial || []);
        }
      } catch { /* silencioso */ }
    } catch {
      setErrorMsg('Error de conexion');
    }
    setSearching(false);
  };

  // Canjear beneficio
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
        setErrorMsg(data.error || 'Error al canjear');
        setProcessing(false);
        return;
      }

      setSuccessData(data);
      setStep('success');
    } catch {
      setErrorMsg('Error de conexion');
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
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* Fondo */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, #0f1b2e 0%, #080e1a 70%)' }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full opacity-[0.05]"
        style={{ background: `radial-gradient(ellipse, ${gold}, transparent 70%)` }} />

      <div className={`relative z-10 w-full max-w-[440px] transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
        <div className="relative">
          <div className="absolute -inset-px rounded-[20px]"
            style={{ background: 'linear-gradient(180deg, rgba(191,163,99,0.15) 0%, rgba(191,163,99,0.03) 100%)' }} />

          <div className="relative rounded-[20px] overflow-hidden"
            style={{ background: 'linear-gradient(180deg, rgba(15,25,42,0.95) 0%, rgba(10,16,28,0.98) 100%)', backdropFilter: 'blur(40px)' }}>

            {/* Header con logo */}
            <div className="pt-8 pb-5 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
                style={{ border: '1.5px solid rgba(191,163,99,0.3)' }}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke={gold} strokeWidth={1.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
                </svg>
              </div>
              <h1 className="text-lg font-semibold tracking-[0.15em] uppercase"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", color: 'rgba(191,163,99,0.75)' }}>
                Grupo Popper
              </h1>
              <p className="mt-1 text-[9px] font-medium tracking-[0.3em] uppercase" style={{ color: 'rgba(191,163,99,0.3)' }}>
                Beneficios Corporativos
              </p>
            </div>

            <div className="mx-7 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(191,163,99,0.12), transparent)' }} />

            {/* ====== LOADING ====== */}
            {step === 'loading' && (
              <div className="px-8 py-16 text-center">
                <div className="w-8 h-8 border-2 rounded-full mx-auto animate-spin"
                  style={{ borderColor: 'rgba(191,163,99,0.15)', borderTopColor: gold }} />
                <p className="mt-4 text-[13px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Cargando comercio...</p>
              </div>
            )}

            {/* ====== ERROR ====== */}
            {step === 'error' && (
              <div className="px-8 py-12 text-center">
                <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
                  style={{ background: 'rgba(220,38,38,0.1)' }}>
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="rgba(248,113,113,0.8)" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <p className="text-[14px]" style={{ color: 'rgba(248,113,113,0.8)' }}>{errorMsg}</p>
              </div>
            )}

            {/* ====== STEP 1: IDENTIFICACION ====== */}
            {step === 'identify' && comercio && (
              <div className="px-8 pt-6 pb-8">
                {/* Info del comercio */}
                <div className="p-4 rounded-xl mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(191,163,99,0.1)' }}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={gold} strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-white">{comercio.nombre}</p>
                      <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{comercio.direccion}, {comercio.ciudad}</p>
                    </div>
                  </div>
                </div>

                {/* Titulo */}
                <h2 className="text-[20px] font-semibold text-white mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  Bienvenido
                </h2>
                <p className="text-[13px] mb-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Ingresa tu DNI para ver tus beneficios disponibles.
                </p>

                {/* Input DNI */}
                <div>
                  <label className="block text-[10px] font-semibold tracking-[0.2em] uppercase mb-2.5"
                    style={{ color: 'rgba(191,163,99,0.45)' }}>
                    Numero de DNI
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Ej: 30123456"
                    value={dni}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                      setDni(val);
                      setErrorMsg('');
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                    className="w-full px-5 py-4 rounded-xl text-[18px] text-white text-center tracking-[0.15em] font-medium transition-all duration-300 focus:outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      caretColor: gold,
                      letterSpacing: '0.15em',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'rgba(191,163,99,0.3)';
                      e.target.style.boxShadow = '0 0 0 3px rgba(191,163,99,0.06)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(255,255,255,0.06)';
                      e.target.style.boxShadow = 'none';
                    }}
                    autoFocus
                    autoComplete="off"
                  />
                  <p className="text-center mt-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    {dni.length}/8 digitos
                  </p>
                </div>

                {/* Error */}
                {errorMsg && (
                  <div className="mt-4 p-3 rounded-lg" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.15)' }}>
                    <p className="text-[13px] text-center" style={{ color: 'rgba(248,113,113,0.9)' }}>{errorMsg}</p>
                  </div>
                )}

                {/* Boton */}
                <button
                  onClick={handleSearch}
                  disabled={dni.length < 7 || searching}
                  className="relative w-full mt-6 py-[14px] rounded-xl text-[13px] font-semibold tracking-[0.15em] uppercase overflow-hidden transition-all duration-500 disabled:opacity-30 disabled:cursor-not-allowed group"
                >
                  <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${gold}, #d4b978, ${gold})` }} />
                  <span className="relative z-10 flex items-center justify-center gap-2" style={{ color: '#0a0e14' }}>
                    {searching ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Buscando...
                      </>
                    ) : (
                      <>
                        Verificar
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </>
                    )}
                  </span>
                </button>
              </div>
            )}

            {/* ====== STEP 2: PERFIL + BENEFICIOS ====== */}
            {step === 'profile' && beneficiario && (
              <div className="px-8 pt-6 pb-8">
                {/* Perfil del colaborador */}
                <div className="text-center mb-6">
                  {/* Foto */}
                  <div className="relative inline-block mb-4">
                    {beneficiario.foto ? (
                      <img
                        src={beneficiario.foto}
                        alt={`${beneficiario.nombre} ${beneficiario.apellido}`}
                        className="w-24 h-24 rounded-full object-cover"
                        style={{ border: `2px solid ${gold}` }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold"
                        style={{ background: 'rgba(191,163,99,0.15)', color: gold, border: `2px solid rgba(191,163,99,0.3)` }}>
                        {beneficiario.nombre[0]}{beneficiario.apellido[0]}
                      </div>
                    )}
                    {/* Badge de nivel */}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
                      style={{
                        background: nivelColors[beneficiario.nivel]?.bg || 'rgba(191,163,99,0.15)',
                        color: nivelColors[beneficiario.nivel]?.text || gold,
                        border: `1px solid ${nivelColors[beneficiario.nivel]?.text || gold}40`,
                      }}>
                      {nivelColors[beneficiario.nivel]?.label || beneficiario.nivel}
                    </div>
                  </div>

                  <h2 className="text-[20px] font-semibold text-white" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                    {beneficiario.nombre} {beneficiario.apellido}
                  </h2>
                  <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {beneficiario.cargo && `${beneficiario.cargo} · `}{beneficiario.departamento}
                  </p>
                  {beneficiario.legajo && (
                    <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                      Legajo: {beneficiario.legajo}
                    </p>
                  )}
                </div>

                <div className="h-px mb-5" style={{ background: 'linear-gradient(90deg, transparent, rgba(191,163,99,0.12), transparent)' }} />

                {/* Beneficios disponibles */}
                <p className="text-[10px] font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: 'rgba(191,163,99,0.45)' }}>
                  Beneficios disponibles ({beneficios.length})
                </p>

                {beneficios.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.3)' }}>No hay beneficios disponibles en este comercio para tu nivel.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1">
                    {beneficios.map(b => (
                      <button
                        key={b.id}
                        onClick={() => setSelectedBenefit(b.id === selectedBenefit ? '' : b.id)}
                        className="w-full p-4 rounded-xl text-left transition-all duration-300"
                        style={{
                          background: selectedBenefit === b.id ? 'rgba(191,163,99,0.08)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${selectedBenefit === b.id ? 'rgba(191,163,99,0.3)' : 'rgba(255,255,255,0.05)'}`,
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-semibold text-white truncate">{b.nombre}</p>
                            <p className="text-[12px] mt-0.5 line-clamp-2" style={{ color: 'rgba(255,255,255,0.4)' }}>{b.descripcion}</p>
                            {b.descuento && (
                              <p className="text-[16px] font-bold mt-1.5" style={{ color: '#4ade80' }}>{b.descuento}% OFF</p>
                            )}
                          </div>
                          <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-1"
                            style={{
                              background: selectedBenefit === b.id ? gold : 'rgba(255,255,255,0.05)',
                              border: `1.5px solid ${selectedBenefit === b.id ? gold : 'rgba(255,255,255,0.1)'}`,
                            }}>
                            {selectedBenefit === b.id && (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="#0a0e14" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Historial de canjes */}
                {historial.length > 0 && (
                  <div className="mt-5">
                    <div className="h-px mb-4" style={{ background: 'linear-gradient(90deg, transparent, rgba(191,163,99,0.12), transparent)' }} />
                    <button
                      onClick={() => setShowHistorial(!showHistorial)}
                      className="w-full flex items-center justify-between py-2 text-[10px] font-semibold tracking-[0.2em] uppercase"
                      style={{ color: 'rgba(191,163,99,0.45)' }}
                    >
                      <span>Mis canjes recientes ({historial.length})</span>
                      <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${showHistorial ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showHistorial && (
                      <div className="mt-2 space-y-2 max-h-[180px] overflow-y-auto pr-1">
                        {historial.map((h, i) => (
                          <div key={i} className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-medium text-white truncate">{h.beneficio_nombre}</p>
                                <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                  {h.comercio_nombre} · {new Date(h.fecha_verificacion).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </p>
                              </div>
                              {h.descuento && (
                                <span className="flex-shrink-0 text-[11px] font-bold" style={{ color: '#4ade80' }}>{h.descuento}%</span>
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
                  <div className="mt-4 p-3 rounded-lg" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.15)' }}>
                    <p className="text-[13px] text-center" style={{ color: 'rgba(248,113,113,0.9)' }}>{errorMsg}</p>
                  </div>
                )}

                {/* Botones */}
                <div className="flex gap-3 mt-6">
                  <button onClick={handleReset}
                    className="flex-shrink-0 px-4 py-[14px] rounded-xl text-[12px] font-medium transition-all duration-300"
                    style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    Volver
                  </button>
                  <button
                    onClick={handleCanjear}
                    disabled={!selectedBenefit || processing}
                    className="relative flex-1 py-[14px] rounded-xl text-[13px] font-semibold tracking-[0.1em] uppercase overflow-hidden transition-all duration-500 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${gold}, #d4b978, ${gold})` }} />
                    <span className="relative z-10 flex items-center justify-center gap-2" style={{ color: '#0a0e14' }}>
                      {processing ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Procesando
                        </>
                      ) : 'Canjear beneficio'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* ====== STEP 3: EXITO ====== */}
            {step === 'success' && successData && selectedBenefitData && (
              <div className="px-8 pt-8 pb-8 text-center">
                {/* Check animado */}
                <div className="w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center"
                  style={{ background: 'rgba(74,222,128,0.1)', border: '2px solid rgba(74,222,128,0.3)' }}>
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>

                <h2 className="text-[22px] font-semibold text-white mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  Beneficio canjeado
                </h2>
                <p className="text-[13px] mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {selectedBenefitData.nombre}
                </p>

                {/* Codigo de referencia */}
                <div className="p-4 rounded-xl mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[9px] font-semibold tracking-[0.2em] uppercase mb-2" style={{ color: 'rgba(191,163,99,0.45)' }}>
                    Codigo de referencia
                  </p>
                  <p className="text-[18px] font-mono font-bold text-white tracking-wider">
                    {successData.verificacion?.codigo_referencia || '---'}
                  </p>
                  <p className="text-[11px] mt-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    {new Date(successData.verificacion?.fecha_verificacion || Date.now()).toLocaleString('es-AR')}
                  </p>
                </div>

                <p className="text-[11px] mb-6" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  Mostra este codigo al encargado del comercio
                </p>

                <button onClick={handleReset}
                  className="w-full py-[14px] rounded-xl text-[13px] font-medium transition-all"
                  style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  Nueva verificacion
                </button>
              </div>
            )}

            {/* Footer */}
            <div className="px-8 pb-5">
              <div className="h-px mb-4" style={{ background: 'linear-gradient(90deg, transparent, rgba(191,163,99,0.08), transparent)' }} />
              <p className="text-center text-[10px]" style={{ color: 'rgba(255,255,255,0.12)' }}>
                &copy; 2026 Recluta. Todos los derechos reservados.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
