import { useState, useEffect } from 'react';
import useAuth from './hooks/useAuth';
import LoginScreen from './components/auth/LoginScreen';
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

  // Ocultar la pantalla de carga HTML cuando React se monta
  useEffect(() => {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
      setTimeout(() => loadingScreen.remove(), 600);
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
  const { isAuthenticated, user, token, loading, error, login, loginWithGoogle, logout } = useAuth();

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080e1a' }}>
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(191,163,99,0.15)', borderTopColor: '#bfa363' }} />
      </div>
    );
  }

  if (!isAuthenticated || !token) {
    return <LoginScreen onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} isLoading={loading} error={error} />;
  }

  return <AdminDashboard token={token} user={user} onLogout={logout} />;
}
