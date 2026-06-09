import { useState, useEffect } from 'react';
import useAuth from './hooks/useAuth';
import LoginScreen from './components/auth/LoginScreen';
import ChangePasswordScreen from './components/auth/ChangePasswordScreen';
import AdminDashboard from './pages/AdminDashboard';
import QRPage from './pages/QRPage';

// Simple hash router
function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return hash;
}

export default function App() {
  const hash = useHashRoute();

  // Ocultar el splash inicial cuando React monta
  useEffect(() => {
    const el = document.getElementById('loading');
    if (el) {
      el.classList.add('hidden');
      setTimeout(() => el.remove(), 320);
    }
  }, []);

  // Ruta publica: #/qr/CODIGO_QR
  const qrMatch = hash.match(/^#\/qr\/(.+)$/);
  if (qrMatch) {
    return <QRPage qrCode={decodeURIComponent(qrMatch[1])} />;
  }

  // Ruta privada: login + admin
  return <PrivateApp />;
}

function PrivateApp() {
  const { isAuthenticated, user, token, loading, error, mustChangePassword, login, loginWithGoogle, cambiarPassword, logout } = useAuth();

  const handleLogin = async (username: string, password: string) => {
    const success = await login(username, password);
    return success;
  };

  const handleGoogleLogin = async (credential: string) => {
    const success = await loginWithGoogle(credential);
    return success;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-canvas)' }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'var(--brand)',
          animation: 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        }} />
      </div>
    );
  }

  if (!isAuthenticated || !token) {
    return <LoginScreen onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} isLoading={loading} error={error} />;
  }

  if (mustChangePassword) {
    return <ChangePasswordScreen onSubmit={cambiarPassword} onLogout={logout} />;
  }

  return <AdminDashboard token={token} user={user} onLogout={logout} />;
}
