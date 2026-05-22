import { useState, useEffect } from 'react';
import useAuth from './hooks/useAuth';
import useData from './hooks/useData';
import LoginScreen from './components/auth/LoginScreen';
import VerificationScreen from './components/verification/VerificationScreen';
import QRPage from './pages/QRPage';

type ScreenType = 'login' | 'verification' | 'dashboard';

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
  const { isAuthenticated, user, token, loading, error, login, logout } = useAuth();
  const { commerce, getBeneficiaryByDni, getBenefitsForBeneficiary, processVerification } = useData();
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('login');

  const handleLogin = async (username: string, password: string) => {
    const success = await login(username, password);
    if (success) {
      setCurrentScreen('verification');
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    logout();
    setCurrentScreen('login');
  };

  const handleVerify = async (formData: {
    dni: string;
    comercioId: string;
    beneficioId?: string;
  }) => {
    if (!user?.id || !token) {
      return { success: false, message: 'No autenticado' };
    }

    return await processVerification(
      formData,
      user.id,
      `${user.nombre || ''} ${user.apellido || ''}`,
      undefined,
      token
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080e1a' }}>
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(191,163,99,0.15)', borderTopColor: '#bfa363' }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} isLoading={loading} error={error} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] via-[#2d5a87] to-[#1e3a5f]">
      {currentScreen === 'verification' && (
        <div className="min-h-screen flex flex-col">
          <div className="bg-white/10 backdrop-blur-xl border-b border-white/20 p-4">
            <div className="max-w-6xl mx-auto flex justify-between items-center">
              <div className="text-white">
                <h2 className="text-xl font-bold">
                  Bienvenido, {user?.nombre || user?.username}
                </h2>
                <p className="text-white/70 text-sm">
                  Rol: {user?.rol}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition"
              >
                Cerrar Sesion
              </button>
            </div>
          </div>

          <div className="flex-1 p-4">
            <VerificationScreen
              onVerify={handleVerify}
              getBeneficiaryByDni={getBeneficiaryByDni}
              getBenefitsForBeneficiary={getBenefitsForBeneficiary}
              commerce={commerce}
              currentUserName={`${user?.nombre || ''} ${user?.apellido || ''}`.trim()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
