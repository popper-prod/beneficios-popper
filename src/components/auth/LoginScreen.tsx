import { useState, useEffect, useRef } from 'react';

// ============================================
// LoginScreen - Premium Private Bank aesthetic
// Filosofía: bienvenida ceremonial, exclusividad, calma
// ============================================

interface LoginScreenProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
  onGoogleLogin?: (credential: string) => Promise<boolean>;
  isLoading?: boolean;
  error?: string | null;
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

declare global {
  interface Window {
    google?: any;
  }
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  onGoogleLogin,
  isLoading = false,
  error,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailFormOpen, setEmailFormOpen] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (error) setLoginError(error);
  }, [error]);

  // Inicializar Google Identity Services
  useEffect(() => {
    if (!onGoogleLogin || !GOOGLE_CLIENT_ID) return;

    let tries = 0;
    const init = () => {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: async (response: any) => {
              if (!response?.credential) return;
              setGoogleLoading(true);
              setLoginError(null);
              const ok = await onGoogleLogin(response.credential);
              if (!ok) setGoogleLoading(false);
            },
            ux_mode: 'popup',
            auto_select: false,
          });
          if (googleButtonRef.current) {
            googleButtonRef.current.innerHTML = '';
            window.google.accounts.id.renderButton(googleButtonRef.current, {
              type: 'standard',
              theme: 'filled_black',
              size: 'large',
              text: 'continue_with',
              shape: 'pill',
              logo_alignment: 'center',
              width: 360,
            });
          }
        } catch (e) {
          console.error('Google init error:', e);
        }
      } else if (tries < 60) {
        tries++;
        setTimeout(init, 100);
      }
    };
    init();
  }, [onGoogleLogin]);

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
      if (!success) setLoginError('Credenciales incorrectas');
    }
  };

  const handleBack = () => {
    setStep(1);
    setPassword('');
    setLoginError(null);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden p-4">
      {/* ====== Fondo cinematográfico ====== */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, #0f1b2e 0%, #080e1a 60%, #06090f 100%)',
        }}
      />

      {/* Grano sutil para textura premium */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='200' height='200' filter='url(%23n)' opacity='1'/></svg>\")",
        }}
      />

      {/* Glow dorado superior */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, rgba(191,163,99,0.08), transparent 65%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Ornamentos en esquinas */}
      <Ornaments mounted={mounted} />

      {/* ====== Card principal ====== */}
      <div
        className={`relative z-10 w-full max-w-[460px] transition-all ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
        style={{ transitionDuration: '1600ms', transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="relative">
          {/* Borde dorado con resplandor */}
          <div
            className="absolute -inset-px rounded-[24px] pointer-events-none"
            style={{
              background:
                'linear-gradient(180deg, rgba(191,163,99,0.25) 0%, rgba(191,163,99,0.08) 30%, rgba(191,163,99,0.02) 100%)',
            }}
          />

          <div
            className="relative rounded-[24px] overflow-hidden"
            style={{
              background:
                'linear-gradient(180deg, rgba(20,28,46,0.94) 0%, rgba(8,14,26,0.98) 100%)',
              backdropFilter: 'blur(40px)',
              boxShadow:
                '0 30px 80px rgba(8,14,26,0.5), inset 0 1px 0 rgba(212,185,120,0.08)',
            }}
          >
            {/* ====== Brand mark ====== */}
            <div className="pt-12 pb-2 text-center">
              <BrandMark mounted={mounted} />
              <h1
                className="mt-6 leading-none"
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: '26px',
                  fontWeight: 600,
                  color: 'rgba(245,241,232,0.92)',
                  letterSpacing: '0.04em',
                }}
              >
                Grupo Popper
              </h1>
              <p
                className="mt-3 text-[10px] font-semibold"
                style={{
                  color: 'rgba(191,163,99,0.55)',
                  letterSpacing: '0.42em',
                  textTransform: 'uppercase',
                }}
              >
                Beneficios Privados
              </p>
            </div>

            {/* Divisor dorado */}
            <div className="mx-12 mt-8 mb-7 divider-gold" />

            {/* ====== Contenido ====== */}
            <div className="px-10 pb-10">
              {/* Saludo + indicador de paso */}
              <div className="flex items-center justify-between mb-7">
                <div>
                  <h2
                    className="leading-tight"
                    style={{
                      fontFamily: "'Playfair Display', Georgia, serif",
                      fontSize: '28px',
                      fontWeight: 600,
                      color: 'rgba(255,255,255,0.95)',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {step === 1 ? 'Bienvenido' : `Hola${username ? ',' : ''}`}
                  </h2>
                  {step === 2 && username && (
                    <p
                      className="mt-1 text-[14px] truncate max-w-[280px]"
                      style={{
                        fontFamily: "'Playfair Display', Georgia, serif",
                        color: 'rgba(191,163,99,0.85)',
                        fontStyle: 'italic',
                      }}
                    >
                      {username}
                    </p>
                  )}
                </div>
                <StepDots step={step} />
              </div>

              {/* Subtítulo del paso */}
              <p className="text-[13px] mb-8 leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {step === 1
                  ? (GOOGLE_CLIENT_ID && onGoogleLogin
                      ? 'Acceso exclusivo para colaboradores autorizados. Continuá con tu cuenta de Google.'
                      : 'Ingresá tu email corporativo para continuar.')
                  : 'Ingresá tu contraseña para acceder a tu cuenta.'}
              </p>

              {/* === STEP 1 === */}
              {step === 1 && (
                <div className="animate-fadeIn">
                  {/* Botón Google */}
                  {GOOGLE_CLIENT_ID && onGoogleLogin && (
                    <>
                      <div className="relative">
                        <div
                          ref={googleButtonRef}
                          className="flex justify-center"
                          style={{ minHeight: '44px' }}
                        />
                        {googleLoading && (
                          <div
                            className="absolute inset-0 flex items-center justify-center rounded-full"
                            style={{ background: 'rgba(8,14,26,0.85)', backdropFilter: 'blur(6px)' }}
                          >
                            <Spinner size={16} />
                            <span className="ml-2.5 text-[12px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
                              Verificando con Google...
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Toggle: O acceder con email */}
                      <div className="mt-6">
                        <button
                          type="button"
                          onClick={() => setEmailFormOpen(v => !v)}
                          className="w-full flex items-center justify-center gap-2 py-2.5 text-[11px] font-semibold transition-all"
                          style={{
                            color: emailFormOpen ? 'rgba(191,163,99,0.8)' : 'rgba(255,255,255,0.35)',
                            letterSpacing: '0.15em',
                            textTransform: 'uppercase',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(191,163,99,0.7)')}
                          onMouseLeave={e =>
                            (e.currentTarget.style.color = emailFormOpen
                              ? 'rgba(191,163,99,0.8)'
                              : 'rgba(255,255,255,0.35)')
                          }
                        >
                          <span>{emailFormOpen ? 'Cerrar acceso con email' : 'Acceder con email'}</span>
                          <svg
                            className="w-3 h-3 transition-transform"
                            style={{ transform: emailFormOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    </>
                  )}

                  {/* Form email (colapsable cuando hay Google, siempre visible sino) */}
                  {(!GOOGLE_CLIENT_ID || !onGoogleLogin || emailFormOpen) && (
                    <form
                      onSubmit={handleSubmit}
                      className={GOOGLE_CLIENT_ID && onGoogleLogin ? 'mt-5 animate-fadeIn' : ''}
                    >
                      <PremiumField
                        label="Email corporativo"
                        type="email"
                        placeholder="tu.nombre@grupopopper.com"
                        value={username}
                        onChange={v => {
                          setUsername(v);
                          setLoginError(null);
                        }}
                        autoFocus={!GOOGLE_CLIENT_ID}
                      />
                      <PrimaryButton
                        type="submit"
                        disabled={!username.trim()}
                        loading={false}
                        className="mt-6"
                      >
                        Continuar
                      </PrimaryButton>
                    </form>
                  )}
                </div>
              )}

              {/* === STEP 2 === */}
              {step === 2 && (
                <form onSubmit={handleSubmit} className="animate-fadeIn">
                  <PremiumField
                    label="Contraseña"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Ingresá tu contraseña"
                    value={password}
                    onChange={v => {
                      setPassword(v);
                      setLoginError(null);
                    }}
                    autoFocus
                    rightAction={
                      <button
                        type="button"
                        onClick={() => setShowPassword(s => !s)}
                        tabIndex={-1}
                        className="transition-colors"
                        style={{ color: 'rgba(255,255,255,0.3)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(191,163,99,0.7)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
                      >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    }
                  />

                  <div className="flex items-center justify-between mt-5 mb-1">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="flex items-center gap-1.5 text-[12px] transition-colors"
                      style={{ color: 'rgba(255,255,255,0.35)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(191,163,99,0.7)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Cambiar usuario
                    </button>
                  </div>

                  <PrimaryButton
                    type="submit"
                    disabled={!password || isLoading}
                    loading={isLoading}
                    className="mt-6"
                  >
                    Acceder
                  </PrimaryButton>
                </form>
              )}

              {/* Error */}
              {loginError && (
                <div
                  className="mt-5 flex items-start gap-2.5 p-3.5 rounded-xl animate-shake"
                  style={{
                    background: 'rgba(232,144,137,0.06)',
                    border: '1px solid rgba(232,144,137,0.18)',
                  }}
                >
                  <svg
                    className="w-4 h-4 flex-shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="rgba(232,144,137,0.85)"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                    />
                  </svg>
                  <p className="text-[12.5px] leading-relaxed" style={{ color: 'rgba(232,144,137,0.92)' }}>
                    {loginError}
                  </p>
                </div>
              )}
            </div>

            {/* Divisor inferior */}
            <div className="mx-12 mb-6 divider-gold" />

            {/* Footer del card */}
            <div className="px-10 pb-7 text-center">
              <p
                className="text-[10px]"
                style={{
                  color: 'rgba(255,255,255,0.20)',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                }}
              >
                Acceso seguro &middot; SSL/TLS &middot; OAuth 2.0
              </p>
            </div>
          </div>
        </div>

        {/* Footer global */}
        <p
          className="mt-7 text-center text-[10.5px]"
          style={{ color: 'rgba(255,255,255,0.22)', letterSpacing: '0.05em' }}
        >
          &copy; 2026 Recluta &middot; Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
};

// ============================================
// Sub-componentes
// ============================================

function BrandMark({ mounted }: { mounted: boolean }) {
  return (
    <div
      className="relative inline-flex"
      style={{
        transitionDuration: '1200ms',
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        transitionDelay: '200ms',
        transform: mounted ? 'scale(1)' : 'scale(0.9)',
        opacity: mounted ? 1 : 0,
      }}
    >
      {/* Halo dorado */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(191,163,99,0.12), transparent 70%)',
          filter: 'blur(8px)',
          transform: 'scale(1.4)',
        }}
      />
      <div
        className="relative w-[76px] h-[76px] rounded-full flex items-center justify-center"
        style={{
          border: '1.5px solid rgba(191,163,99,0.4)',
          background:
            'radial-gradient(circle at 30% 30%, rgba(212,185,120,0.08), rgba(8,14,26,0.4))',
          boxShadow:
            '0 0 30px rgba(191,163,99,0.15), inset 0 1px 0 rgba(212,185,120,0.15)',
        }}
      >
        {/* Monograma GP en serif */}
        <span
          className="leading-none"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '28px',
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
  );
}

function StepDots({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="h-[2px] rounded-full transition-all"
        style={{
          width: step === 1 ? '24px' : '12px',
          backgroundColor: step === 1 ? '#bfa363' : 'rgba(191,163,99,0.22)',
          transitionDuration: '500ms',
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />
      <div
        className="h-[2px] rounded-full transition-all"
        style={{
          width: step === 2 ? '24px' : '12px',
          backgroundColor: step === 2 ? '#bfa363' : 'rgba(191,163,99,0.22)',
          transitionDuration: '500ms',
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />
    </div>
  );
}

function PremiumField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoFocus,
  rightAction,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
  rightAction?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label
        className="block text-[10px] font-semibold mb-2.5"
        style={{
          color: focused ? 'rgba(191,163,99,0.8)' : 'rgba(191,163,99,0.42)',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          transition: 'color 320ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus={autoFocus}
          autoComplete={type === 'password' ? 'current-password' : 'username'}
          required
          className="w-full px-5 py-[15px] rounded-xl text-[15px] transition-all"
          style={{
            color: 'rgba(255,255,255,0.95)',
            background: focused ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.025)',
            border: focused
              ? '1px solid rgba(191,163,99,0.35)'
              : '1px solid rgba(255,255,255,0.06)',
            boxShadow: focused
              ? '0 0 0 4px rgba(191,163,99,0.06), inset 0 1px 0 rgba(212,185,120,0.05)'
              : 'none',
            caretColor: '#bfa363',
            paddingRight: rightAction ? '48px' : undefined,
            transitionDuration: '320ms',
            transitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)',
          }}
        />
        {rightAction && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">{rightAction}</div>
        )}
      </div>
    </div>
  );
}

function PrimaryButton({
  children,
  type = 'button',
  disabled,
  loading,
  className = '',
  onClick,
}: {
  children: React.ReactNode;
  type?: 'button' | 'submit';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`relative w-full py-[16px] rounded-xl text-[12.5px] font-semibold overflow-hidden transition-all group disabled:opacity-30 disabled:cursor-not-allowed ${className}`}
      style={{
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        background: 'linear-gradient(135deg, #d4b978 0%, #bfa363 50%, #9d8649 100%)',
        boxShadow: disabled
          ? 'none'
          : '0 8px 24px rgba(191,163,99,0.18), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.15)',
        color: '#0a0e14',
        transitionDuration: '500ms',
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onMouseEnter={e => {
        if (!disabled) e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      {/* Shine sweep */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
        style={{
          background:
            'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)',
          backgroundSize: '200% 100%',
          backgroundPosition: '-100% 0',
          animation: 'shimmer 1.5s ease-in-out',
        }}
      />

      <span className="relative z-10 flex items-center justify-center gap-2">
        {loading ? (
          <>
            <Spinner size={14} dark />
            <span>Verificando</span>
          </>
        ) : (
          <>
            {children}
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
  );
}

function Spinner({ size = 16, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <svg
      className="animate-spin"
      style={{ width: size, height: size }}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke={dark ? 'currentColor' : '#bfa363'}
        strokeWidth="3"
      />
      <path
        className="opacity-90"
        fill={dark ? 'currentColor' : '#bfa363'}
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
      />
    </svg>
  );
}

function Ornaments({ mounted }: { mounted: boolean }) {
  return (
    <>
      {/* Esquinas con detalle minimalista */}
      {[
        { top: '32px', left: '32px' },
        { top: '32px', right: '32px', rotate: '90deg' },
        { bottom: '32px', left: '32px', rotate: '-90deg' },
        { bottom: '32px', right: '32px', rotate: '180deg' },
      ].map((pos, i) => (
        <div
          key={i}
          className="absolute pointer-events-none hidden md:block"
          style={{
            ...pos,
            transform: `rotate(${pos.rotate || '0deg'})`,
            opacity: mounted ? 1 : 0,
            transition: 'opacity 1600ms cubic-bezier(0.16, 1, 0.3, 1) 600ms',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path
              d="M2 2h6M2 2v6"
              stroke="rgba(191,163,99,0.35)"
              strokeWidth="1"
              strokeLinecap="round"
            />
            <circle cx="2" cy="2" r="1" fill="rgba(191,163,99,0.5)" />
          </svg>
        </div>
      ))}
    </>
  );
}

export default LoginScreen;
