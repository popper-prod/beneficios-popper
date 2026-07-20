import { useState, useEffect, useRef } from 'react';
import { ArrowRight, Eye, EyeOff, AlertCircle, ChevronLeft } from 'lucide-react';

// ============================================
// LoginScreen — Stripe/Resend minimal
// Una columna, espacio generoso, foco en CTA
// ============================================

interface LoginScreenProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
  onGoogleLogin?: (credential: string) => Promise<boolean>;
  isLoading?: boolean;
  error?: string | null;
}

const API_URL = import.meta.env.VITE_API_URL || 'https://beneficios-backend-jfpx.onrender.com/api';

// El Client ID se pide al backend en runtime (GET /public/auth-config) en vez de
// hornearlo en build time. VITE_GOOGLE_CLIENT_ID queda sólo como override local.
// Motivo: al migrar el dominio entre cuentas de Vercel se perdió la variable de
// build y el botón de Google desapareció del bundle. El backend ya tiene el valor
// (lo usa como `audience` al verificar el token), así que es la fuente de verdad.
const GOOGLE_CLIENT_ID_BUILD = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

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
  const [step, setStep] = useState<1 | 2>(1);
  const [emailMode, setEmailMode] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [googleClientId, setGoogleClientId] = useState(GOOGLE_CLIENT_ID_BUILD);
  const [authConfigLoading, setAuthConfigLoading] = useState(!GOOGLE_CLIENT_ID_BUILD);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) setLoginError(error);
  }, [error]);

  // Traer el Client ID del backend. Si falla o tarda (Render puede estar frío),
  // cortamos a los 6s y caemos al login por email en vez de dejar la pantalla vacía.
  //
  // Corre SIEMPRE, incluso si hay valor de build: ese se usa para pintar el botón
  // al instante (sin esperar el round-trip), y el del backend lo pisa si difiere.
  // Así el .env no puede quedar desactualizado respecto del `audience` real.
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);

    fetch(`${API_URL}/public/auth-config`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.googleClientId) setGoogleClientId(data.googleClientId);
      })
      .catch(() => {
        /* sin Google: queda el login por email */
      })
      .finally(() => {
        clearTimeout(timer);
        setAuthConfigLoading(false);
      });

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, []);

  // Inicializar Google Identity Services
  useEffect(() => {
    if (!onGoogleLogin || !googleClientId) return;

    let tries = 0;
    const init = () => {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
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
              shape: 'rectangular',
              logo_alignment: 'left',
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
  }, [onGoogleLogin, googleClientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (step === 1) {
      if (username.trim()) setStep(2);
      return;
    }
    if (username && password) {
      const success = await onLogin(username, password);
      if (!success) setLoginError('Credenciales incorrectas');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-canvas)',
        display: 'grid',
        gridTemplateRows: '1fr auto',
      }}
    >
      <main
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 380,
            animation: 'fadeInUp 320ms var(--ease-out)',
          }}
        >
          {/* ===== Logo discreto ===== */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 40,
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'var(--brand)',
                color: 'var(--brand-fg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '13px',
                letterSpacing: '-0.02em',
              }}
            >
              GP
            </div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.2 }}>
                Grupo Popper
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.2, marginTop: 1 }}>
                Beneficios
              </p>
            </div>
          </div>

          {/* ===== Heading ===== */}
          {step === 1 ? (
            <>
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
                Iniciá sesión
              </h1>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--text-3)',
                  textAlign: 'center',
                  marginBottom: 32,
                  lineHeight: 1.5,
                }}
              >
                Acceso exclusivo para administradores autorizados.
              </p>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setStep(1);
                  setPassword('');
                  setLoginError(null);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  color: 'var(--text-3)',
                  fontSize: '12px',
                  marginBottom: 12,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'color 120ms var(--ease-in-out)',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-1)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
              >
                <ChevronLeft size={13} />
                Atrás
              </button>
              <h1
                style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  color: 'var(--text-1)',
                  letterSpacing: '-0.01em',
                  marginBottom: 4,
                }}
              >
                Tu contraseña
              </h1>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--text-3)',
                  marginBottom: 24,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {username}
              </p>
            </>
          )}

          {/* ===== Step 1: Google + Email ===== */}
          {step === 1 && (
            <>
              {/* Google */}
              {googleClientId && onGoogleLogin && !emailMode && (
                <>
                  <div style={{ position: 'relative', marginBottom: 24 }}>
                    <div ref={googleButtonRef} style={{ display: 'flex', justifyContent: 'center', minHeight: 44 }} />
                    {googleLoading && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(8, 9, 10, 0.85)',
                          backdropFilter: 'blur(4px)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '6px',
                          gap: 8,
                          color: 'var(--text-2)',
                          fontSize: '12px',
                        }}
                      >
                        <span
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            border: '1.5px solid var(--text-3)',
                            borderTopColor: 'var(--brand)',
                            animation: 'spin 600ms linear infinite',
                          }}
                        />
                        Verificando con Google
                      </div>
                    )}
                  </div>

                  {/* Divider con O */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: 24,
                    }}
                  >
                    <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-4)' }}>O</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
                  </div>

                  {/* Toggle email */}
                  <button
                    type="button"
                    onClick={() => setEmailMode(true)}
                    style={{
                      width: '100%',
                      height: 40,
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '6px',
                      color: 'var(--text-1)',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 120ms var(--ease-in-out)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                  >
                    Acceder con email y contraseña
                  </button>
                </>
              )}

              {/* Form email */}
              {(emailMode || (!authConfigLoading && (!googleClientId || !onGoogleLogin))) && (
                <form onSubmit={handleSubmit} style={{ animation: 'fadeIn 200ms var(--ease-out)' }}>
                  {emailMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setEmailMode(false);
                        setLoginError(null);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        color: 'var(--text-3)',
                        fontSize: '12px',
                        marginBottom: 16,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-1)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
                    >
                      <ChevronLeft size={13} />
                      Volver a las opciones
                    </button>
                  )}
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--text-2)',
                      marginBottom: 6,
                    }}
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    value={username}
                    onChange={e => {
                      setUsername(e.target.value);
                      setLoginError(null);
                    }}
                    placeholder="tu.email@grupopopper.com"
                    autoFocus
                    autoComplete="username"
                    required
                    style={{
                      width: '100%',
                      height: 40,
                      padding: '0 12px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '6px',
                      color: 'var(--text-1)',
                      fontSize: '13px',
                      outline: 'none',
                      transition: 'all 120ms var(--ease-in-out)',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = 'var(--brand)';
                      e.target.style.boxShadow = '0 0 0 3px var(--brand-subtle)';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = 'var(--border-default)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!username.trim()}
                    style={primaryBtnStyle(!username.trim())}
                  >
                    Continuar
                    <ArrowRight size={14} />
                  </button>
                </form>
              )}
            </>
          )}

          {/* ===== Step 2: Password ===== */}
          {step === 2 && (
            <form onSubmit={handleSubmit} style={{ animation: 'fadeIn 200ms var(--ease-out)' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--text-2)',
                  marginBottom: 6,
                }}
              >
                Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    setLoginError(null);
                  }}
                  autoFocus
                  autoComplete="current-password"
                  required
                  style={{
                    width: '100%',
                    height: 40,
                    padding: '0 40px 0 12px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '6px',
                    color: 'var(--text-1)',
                    fontSize: '13px',
                    outline: 'none',
                    transition: 'all 120ms var(--ease-in-out)',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = 'var(--brand)';
                    e.target.style.boxShadow = '0 0 0 3px var(--brand-subtle)';
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = 'var(--border-default)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  tabIndex={-1}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-3)',
                    padding: 6,
                    cursor: 'pointer',
                    display: 'flex',
                    borderRadius: '4px',
                    transition: 'color 120ms var(--ease-in-out)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-1)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <button
                type="submit"
                disabled={!password || isLoading}
                style={primaryBtnStyle(!password || isLoading, isLoading)}
              >
                {isLoading ? (
                  <>
                    <span
                      style={{
                        width: 12,
                        height: 12,
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
                    Acceder
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ===== Error ===== */}
          {loginError && (
            <div
              style={{
                marginTop: 16,
                padding: '10px 12px',
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <AlertCircle size={14} style={{ color: 'var(--danger-text)', flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: '12.5px', color: 'var(--danger-text)', lineHeight: 1.5 }}>
                {loginError}
              </p>
            </div>
          )}
        </div>
      </main>

      <footer
        style={{
          padding: '24px',
          textAlign: 'center',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <p style={{ fontSize: '11px', color: 'var(--text-4)' }}>
          © 2026 Recluta · Acceso seguro
        </p>
      </footer>
    </div>
  );
};

function primaryBtnStyle(disabled: boolean, loading?: boolean): React.CSSProperties {
  return {
    width: '100%',
    height: 40,
    marginTop: 16,
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
    transition: 'all 120ms var(--ease-in-out)',
    opacity: disabled && !loading ? 0.6 : 1,
  };
}

export default LoginScreen;
