// ============================================
// GRUPO POPPER - Pantalla de Login Premium
// ============================================

import React, { useState, useEffect } from 'react';

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

  useEffect(() => {
    setTimeout(() => setMounted(true), 100);
  }, []);

  useEffect(() => {
    if (error) setLoginError(error);
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (username && password) {
      const success = await onLogin(username, password);
      if (!success) {
        setLoginError('Credenciales incorrectas. Intenta nuevamente.');
      }
    }
  };

  const fillCredentials = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    setLoginError(null);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
      {/* Fondo premium con gradiente animado */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a1628] via-[#132d50] to-[#0d2137]" />

      {/* Patrón de grid sutil */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Orbes luminosos */}
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#1e3a5f]/40 blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#ffd700]/10 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] rounded-full bg-[#2d5a87]/20 blur-[100px] animate-pulse" style={{ animationDelay: '4s' }} />

      {/* Líneas decorativas laterales */}
      <div className="absolute left-0 top-0 w-px h-full bg-gradient-to-b from-transparent via-[#ffd700]/20 to-transparent" />
      <div className="absolute right-0 top-0 w-px h-full bg-gradient-to-b from-transparent via-[#ffd700]/20 to-transparent" />

      {/* Contenido principal */}
      <div className={`relative z-10 w-full max-w-[460px] mx-4 transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

        {/* Logo y branding */}
        <div className="text-center mb-10">
          {/* Logo con efecto glow */}
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-[#ffd700]/20 rounded-2xl blur-xl scale-110" />
            <div className="relative w-20 h-20 bg-gradient-to-br from-white to-gray-100 rounded-2xl shadow-2xl flex items-center justify-center transform hover:rotate-3 transition-transform duration-500">
              <div className="text-center">
                <span className="text-2xl font-black bg-gradient-to-br from-[#1e3a5f] to-[#2d5a87] bg-clip-text text-transparent">GP</span>
                <div className="h-[3px] w-8 bg-gradient-to-r from-[#ffd700] to-[#f0b800] mx-auto rounded-full mt-0.5" />
              </div>
            </div>
          </div>

          <h1 className="text-[2rem] font-extrabold text-white tracking-[-0.02em] leading-none">
            GRUPO POPPER
          </h1>
          <div className="flex items-center justify-center gap-3 mt-3">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-[#ffd700]/50" />
            <p className="text-[#ffd700]/80 text-xs font-medium tracking-[0.25em] uppercase">
              Sistema de Beneficios
            </p>
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-[#ffd700]/50" />
          </div>
        </div>

        {/* Card de login con glassmorphism premium */}
        <div className="relative">
          {/* Borde luminoso exterior */}
          <div className="absolute -inset-px rounded-[28px] bg-gradient-to-b from-white/20 via-white/5 to-transparent" />

          <div className="relative bg-white/[0.07] backdrop-blur-2xl rounded-[28px] border border-white/[0.08] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)]">
            {/* Línea dorada superior */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-[2px] bg-gradient-to-r from-transparent via-[#ffd700] to-transparent rounded-full" />

            <div className="p-8 pt-10">
              {/* Header del formulario */}
              <div className="text-center mb-8">
                <h2 className="text-xl font-bold text-white">Iniciar Sesion</h2>
                <p className="text-white/40 mt-1.5 text-sm">Ingresa tus credenciales para acceder</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Campo Usuario */}
                <div className="group">
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 ml-1">
                    Usuario
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-[#ffd700] transition-colors duration-300">
                      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="admin.popper"
                      value={username}
                      onChange={(e) => { setUsername(e.target.value); setLoginError(null); }}
                      className="w-full pl-12 pr-4 py-3.5 bg-white/[0.05] border border-white/[0.08] rounded-xl text-white placeholder-white/20 text-[15px] transition-all duration-300 focus:outline-none focus:border-[#ffd700]/50 focus:bg-white/[0.08] focus:shadow-[0_0_0_3px_rgba(255,215,0,0.1)] hover:border-white/15"
                      required
                      autoComplete="username"
                    />
                  </div>
                </div>

                {/* Campo Contrasena */}
                <div className="group">
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 ml-1">
                    Contrasena
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-[#ffd700] transition-colors duration-300">
                      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Ingresa tu contrasena"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setLoginError(null); }}
                      className="w-full pl-12 pr-12 py-3.5 bg-white/[0.05] border border-white/[0.08] rounded-xl text-white placeholder-white/20 text-[15px] transition-all duration-300 focus:outline-none focus:border-[#ffd700]/50 focus:bg-white/[0.08] focus:shadow-[0_0_0_3px_rgba(255,215,0,0.1)] hover:border-white/15"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
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

                {/* Error */}
                {loginError && (
                  <div className="flex items-center gap-3 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl animate-shake">
                    <div className="flex-shrink-0 w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-sm text-red-300">{loginError}</p>
                  </div>
                )}

                {/* Boton de login */}
                <button
                  type="submit"
                  disabled={!username || !password || isLoading}
                  className="relative w-full mt-2 py-4 rounded-xl font-semibold text-[15px] transition-all duration-300 overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed group"
                >
                  {/* Fondo del boton */}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#ffd700] via-[#ffe44d] to-[#ffd700] group-hover:from-[#ffe44d] group-hover:via-[#ffd700] group-hover:to-[#ffe44d] transition-all duration-500" />

                  {/* Efecto shine */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  </div>

                  {/* Sombra del boton */}
                  <div className="absolute inset-0 shadow-[0_8px_32px_rgba(255,215,0,0.3)] group-hover:shadow-[0_12px_40px_rgba(255,215,0,0.4)] transition-shadow duration-300 rounded-xl" />

                  <span className="relative z-10 flex items-center justify-center gap-2 text-[#0a1628] font-bold">
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Verificando...
                      </>
                    ) : (
                      <>
                        Acceder al Sistema
                        <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </span>
                </button>
              </form>

              {/* Separador */}
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent to-white/10" />
                <span className="text-[10px] text-white/25 uppercase tracking-[0.2em] font-medium">Acceso rapido</span>
                <div className="flex-1 h-px bg-gradient-to-l from-transparent to-white/10" />
              </div>

              {/* Credenciales de acceso rapido */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => fillCredentials('admin.popper', 'Admin2024!')}
                  className="group/cred relative p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl hover:bg-white/[0.06] hover:border-[#ffd700]/20 transition-all duration-300 text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded-md bg-[#ffd700]/10 flex items-center justify-center">
                      <svg className="w-3 h-3 text-[#ffd700]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                      </svg>
                    </div>
                    <span className="text-[11px] font-bold text-[#ffd700]/70 uppercase tracking-wider">Admin</span>
                  </div>
                  <p className="text-xs text-white/50 font-mono">admin.popper</p>
                </button>

                <button
                  type="button"
                  onClick={() => fillCredentials('sandra.perez', 'Sandra2024!')}
                  className="group/cred relative p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl hover:bg-white/[0.06] hover:border-[#ffd700]/20 transition-all duration-300 text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center">
                      <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-400/70 uppercase tracking-wider">Empleado</span>
                  </div>
                  <p className="text-xs text-white/50 font-mono">sandra.perez</p>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer con seguridad */}
        <div className="mt-8 text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-white/20">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            <span className="text-[11px] tracking-wide">Conexion segura encriptada</span>
          </div>
          <p className="text-white/15 text-[11px] tracking-wide">
            &copy; 2025 GRUPO POPPER. Todos los derechos reservados.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-3px); }
          20%, 40%, 60%, 80% { transform: translateX(3px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default LoginScreen;
