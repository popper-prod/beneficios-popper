import { useState, useEffect } from 'react';

interface LoginScreenProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
  isLoading?: boolean;
  error?: string | null;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  isLoading = false,
  error,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (error) setLoginError(error);
  }, [error]);

  const handleNext = () => {
    if (username.trim()) {
      setStep(2);
      setLoginError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (step === 1) {
      handleNext();
      return;
    }
    if (username && password) {
      const success = await onLogin(username, password);
      if (!success) {
        setLoginError('Credenciales incorrectas');
      }
    }
  };

  const handleBack = () => {
    setStep(1);
    setPassword('');
    setLoginError(null);
  };

  const gold = '#bfa363';
  const goldLight = '#d4b978';
  const goldDim = 'rgba(191,163,99,';

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden p-4">
      {/* Fondo */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, #0f1b2e 0%, #080e1a 70%)' }} />

      {/* Glow sutil superior */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-[0.04]"
        style={{ background: `radial-gradient(ellipse, ${gold}, transparent 70%)` }} />

      {/* Card principal */}
      <div className={`relative z-10 w-full max-w-[420px] transition-all duration-[1200ms] ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
        <div className="relative">
          {/* Borde sutil dorado */}
          <div className="absolute -inset-px rounded-[20px]"
            style={{ background: `linear-gradient(180deg, ${goldDim}0.15) 0%, ${goldDim}0.06) 40%, ${goldDim}0.02) 100%)` }} />

          <div className="relative rounded-[20px] overflow-hidden"
            style={{ background: 'linear-gradient(180deg, rgba(15,25,42,0.95) 0%, rgba(10,16,28,0.98) 100%)', backdropFilter: 'blur(40px)' }}>

            {/* ====== HEADER: Logo + Brand ====== */}
            <div className="pt-10 pb-6 text-center">
              {/* Icono circular con borde dorado */}
              <div className="inline-flex items-center justify-center w-[68px] h-[68px] rounded-full mb-5"
                style={{ border: `1.5px solid ${goldDim}0.3)`, boxShadow: `0 0 40px ${goldDim}0.06)` }}>
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke={gold} strokeWidth={1.2} style={{ opacity: 0.8 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
                </svg>
              </div>

              {/* Nombre de marca - Serif */}
              <h1 className="text-[22px] font-semibold tracking-[0.18em] uppercase leading-none"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", color: `${goldDim}0.75)` }}>
                Grupo Popper
              </h1>

              {/* Subtitulo */}
              <p className="mt-2.5 text-[10px] font-medium tracking-[0.3em] uppercase"
                style={{ color: `${goldDim}0.35)` }}>
                Sistema de Beneficios
              </p>
            </div>

            {/* ====== SEPARADOR ====== */}
            <div className="mx-8 h-px" style={{ background: `linear-gradient(90deg, transparent, ${goldDim}0.12), transparent)` }} />

            {/* ====== FORMULARIO ====== */}
            <div className="px-8 pt-7 pb-8">
              {/* Step indicator + label */}
              <div className="flex items-center justify-between mb-5">
                <p className="text-[10px] font-semibold tracking-[0.2em] uppercase"
                  style={{ color: `${goldDim}0.4)` }}>
                  {step === 1 ? 'Identificacion' : 'Autenticacion'}
                </p>
                <div className="flex items-center gap-1.5">
                  <div className="h-[3px] rounded-full transition-all duration-500"
                    style={{
                      width: step === 1 ? '16px' : '8px',
                      backgroundColor: step === 1 ? gold : `${goldDim}0.2)`,
                    }} />
                  <div className="h-[3px] rounded-full transition-all duration-500"
                    style={{
                      width: step === 2 ? '16px' : '8px',
                      backgroundColor: step === 2 ? gold : `${goldDim}0.2)`,
                    }} />
                </div>
              </div>

              {/* Titulo del paso */}
              <h2 className="text-[22px] font-semibold text-white mb-1.5 leading-tight"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                {step === 1 ? 'Bienvenido' : `Hola, ${username}`}
              </h2>
              <p className="text-[13px] mb-7" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {step === 1
                  ? 'Ingresa tu email de Naaloo para continuar.'
                  : 'Usa la misma contrasena con la que accedes a Naaloo.'
                }
              </p>

              <form onSubmit={handleSubmit}>
                {/* Step 1: Usuario */}
                {step === 1 && (
                  <div className="space-y-5 animate-fadeIn">
                    <div>
                      <label className="block text-[10px] font-semibold tracking-[0.2em] uppercase mb-2.5"
                        style={{ color: `${goldDim}0.45)` }}>
                        Email
                      </label>
                      <input
                        type="text"
                        placeholder="tu.email@grupopopper.com"
                        value={username}
                        onChange={(e) => { setUsername(e.target.value); setLoginError(null); }}
                        className="w-full px-5 py-4 rounded-xl text-[15px] text-white transition-all duration-300 focus:outline-none"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: `1px solid rgba(255,255,255,0.06)`,
                          caretColor: gold,
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = `${goldDim}0.3)`;
                          e.target.style.boxShadow = `0 0 0 3px ${goldDim}0.06)`;
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'rgba(255,255,255,0.06)';
                          e.target.style.boxShadow = 'none';
                        }}
                        required
                        autoComplete="username"
                        autoFocus
                      />
                    </div>

                    {/* Info Naaloo */}
                    <div className="pt-2">
                      <div className="flex items-start gap-2.5 p-3 rounded-lg" style={{ background: 'rgba(191,163,99,0.04)', border: '1px solid rgba(191,163,99,0.1)' }}>
                        <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke={gold} strokeWidth={1.5} style={{ opacity: 0.7 }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="text-[10px] font-semibold tracking-wide uppercase mb-1" style={{ color: `${goldDim}0.6)` }}>
                            Acceso vinculado con Naaloo
                          </p>
                          <p className="text-[10.5px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            Usa las mismas credenciales que en Naaloo. Solo los colaboradores con permisos asignados podran acceder al panel.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Contrasena */}
                {step === 2 && (
                  <div className="space-y-5 animate-fadeIn">
                    <div>
                      <label className="block text-[10px] font-semibold tracking-[0.2em] uppercase mb-2.5"
                        style={{ color: `${goldDim}0.45)` }}>
                        Contrasena
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Ingresa tu contrasena"
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); setLoginError(null); }}
                          className="w-full px-5 py-4 pr-12 rounded-xl text-[15px] text-white transition-all duration-300 focus:outline-none"
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            caretColor: gold,
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = `${goldDim}0.3)`;
                            e.target.style.boxShadow = `0 0 0 3px ${goldDim}0.06)`;
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = 'rgba(255,255,255,0.06)';
                            e.target.style.boxShadow = 'none';
                          }}
                          required
                          autoComplete="current-password"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors duration-200"
                          style={{ color: 'rgba(255,255,255,0.2)' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                            </svg>
                          ) : (
                            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Boton volver */}
                    <button type="button" onClick={handleBack}
                      className="flex items-center gap-1.5 text-[12px] transition-colors duration-200"
                      style={{ color: 'rgba(255,255,255,0.25)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                      </svg>
                      Cambiar usuario
                    </button>
                  </div>
                )}

                {/* Error */}
                {loginError && (
                  <div className="mt-4 flex items-center gap-2.5 p-3 rounded-lg animate-shake"
                    style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.15)' }}>
                    <svg className="w-4 h-4 flex-shrink-0" fill="rgba(248,113,113,0.8)" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-[13px]" style={{ color: 'rgba(248,113,113,0.9)' }}>{loginError}</p>
                  </div>
                )}

                {/* Boton principal */}
                <button
                  type="submit"
                  disabled={step === 1 ? !username.trim() : (!password || isLoading)}
                  className="relative w-full mt-6 py-[14px] rounded-xl text-[13px] font-semibold tracking-[0.15em] uppercase overflow-hidden transition-all duration-500 disabled:opacity-30 disabled:cursor-not-allowed group"
                  style={{ letterSpacing: '0.15em' }}
                >
                  {/* Fondo dorado */}
                  <div className="absolute inset-0 transition-all duration-500"
                    style={{ background: `linear-gradient(135deg, ${gold}, ${goldLight}, ${gold})` }} />

                  {/* Shine effect */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                    style={{ background: `linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 50%, transparent 60%)`, transform: 'translateX(-100%)', animation: 'none' }} />

                  {/* Shadow glow */}
                  <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ boxShadow: `0 8px 32px ${goldDim}0.25)` }} />

                  <span className="relative z-10 flex items-center justify-center gap-2"
                    style={{ color: '#0a0e14' }}>
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Verificando
                      </>
                    ) : (
                      <>
                        {step === 1 ? 'Continuar' : 'Acceder'}
                        <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </>
                    )}
                  </span>
                </button>
              </form>
            </div>

            {/* ====== FOOTER ====== */}
            <div className="px-8 pb-6">
              <div className="h-px mb-5" style={{ background: `linear-gradient(90deg, transparent, ${goldDim}0.08), transparent)` }} />
              <p className="text-center text-[11px] tracking-wide" style={{ color: 'rgba(255,255,255,0.15)' }}>
                &copy; 2026 Recluta. Todos los derechos reservados.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15%, 45%, 75% { transform: translateX(-3px); }
          30%, 60%, 90% { transform: translateX(3px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
        input::placeholder {
          color: rgba(255,255,255,0.15) !important;
        }
      `}</style>
    </div>
  );
};

export default LoginScreen;
