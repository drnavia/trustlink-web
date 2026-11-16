/**
 * @file App.jsx
 * @description Enrutador y orquestador principal de TrustLink Web con control de sesión global (AuthContext),
 * manejo de marca blanca y enrutamiento modular seguro (restringiendo las vistas maestras a rutas privadas/roles autorizados).
 * @location /trustlink-web/src/App.jsx
 */
import React, { useState } from 'react';
import { BrandingProvider, useBranding } from './modules/branding/BrandingContext';
import { AuthProvider, useAuth } from './modules/auth/AuthContext';
import SecurityScanner from './modules/security/SecurityScanner';
import LoginView from './modules/auth/LoginView';
import RegisterView from './modules/auth/RegisterView';
import ContractPaymentView from './modules/owner/ContractPaymentView';
import AdminComplianceView from './modules/admin/AdminComplianceView';
import UserManagementView from './modules/admin/UserManagementView';
import ProviderDashboard from './modules/provider/ProviderDashboard';
import { ShieldCheck, Star, QrCode, Search, Home, ShieldAlert, LogIn, UserPlus, CreditCard, UserCheck, Wrench, LogOut, Lock } from 'lucide-react';

const ResidentDashboard = ({ onViewChange }) => {
  const { brand } = useBranding();
  const { user } = useAuth();
  return (
    <div className="min-h-[calc(100vh-50px)] bg-slate-900 text-slate-100 font-sans">
      <header className="bg-slate-950 border-b border-slate-800 px-8 py-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md" style={{ backgroundColor: brand.primaryColor }}>
            TL
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">{brand.countryName}</h1>
            <p className="text-xs text-slate-400">Portal del Residente — Red TrustLink</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <span className="text-xs bg-slate-900 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-xl font-medium">
              👤 {user.first_name} ({user.role})
            </span>
          )}
          <button
            onClick={() => onViewChange('payments')}
            className="text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-md transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
            style={{ backgroundColor: brand.primaryColor }}
          >
            <QrCode size={14} /> Contratar y Pagar
          </button>
        </div>
      </header>
      <main className="p-8 max-w-6xl mx-auto">
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-bold mb-2">Directorio de Prestadores Verificados</h2>
          <p className="text-sm text-slate-400 mb-6">Selecciona un profesional certificado por TrustLink para ingresar a tu lote con acceso seguro por QR.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">Federico Gómez</span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">Verificado</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">⚡ Electricista Matriculado • ⭐ 4.9 (18 trabajos)</p>
              </div>
              <button
                onClick={() => onViewChange('payments')}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer"
              >
                Contratar
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

function MainAppContent() {
  const [currentView, setCurrentView] = useState('resident');
  const { user, isAuthenticated, logout } = useAuth();
  const userRole = user ? user.role : 'guest';

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Barra de Navegación Superior / Selector de Vistas MVP y Estado de Sesión */}
      <nav className="bg-slate-950 border-b border-slate-800 px-6 py-2.5 flex justify-between items-center gap-2 sticky top-0 z-50 shadow-2xl flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setCurrentView('resident')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              currentView === 'resident' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Home size={14} /> Portal Residente
          </button>
          
          {(!user || userRole === 'security' || userRole === 'admin' || userRole === 'superadmin') && (
            <button
              onClick={() => setCurrentView('security')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentView === 'security' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <ShieldCheck size={14} /> Consola Garita
            </button>
          )}

          {(!user || userRole === 'owner' || userRole === 'provider' || userRole === 'superadmin') && (
            <button
              onClick={() => setCurrentView('payments')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentView === 'payments' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <CreditCard size={14} /> Pagos & Contratos
            </button>
          )}

          {(userRole === 'provider' || userRole === 'superadmin') && (
            <button
              onClick={() => setCurrentView('provider')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentView === 'provider' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Wrench size={14} /> Panel Prestador
            </button>
          )}

          {(userRole === 'superadmin') && (
            <button
              onClick={() => setCurrentView('admin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentView === 'admin' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <UserCheck size={14} /> Ops TrustLink (Compliance)
            </button>
          )}

          {/* RUTA PRIVADA / OCULTA: Solo visible y accesible para superadmin global */}
          {(userRole === 'superadmin') && (
            <button
              onClick={() => setCurrentView('users_master')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                currentView === 'users_master' ? 'bg-purple-600 border-purple-500 text-white shadow-lg' : 'bg-purple-950/40 border-purple-800/60 text-purple-300 hover:bg-purple-900/50'
              }`}
            >
              <Lock size={12} /> 🔒 Ops Master (Superadmins)
            </button>
          )}
        </div>

        {/* Zona de Autenticación Activa */}
        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300 font-semibold bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
                👤 {user.first_name} ({user.role})
              </span>
              <button
                onClick={() => { logout(); setCurrentView('login'); }}
                className="bg-rose-950/50 hover:bg-rose-900 text-rose-200 border border-rose-800 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <LogOut size={14} /> Salir
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentView('login')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentView === 'login' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <LogIn size={14} /> Ingresar
              </button>
              <button
                onClick={() => setCurrentView('register')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentView === 'register' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <UserPlus size={14} /> Registrarse
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Contenedor de Vistas con Guardia de Seguridad Frontend */}
      <div className="flex-grow">
        {currentView === 'resident' && <ResidentDashboard onViewChange={setCurrentView} />}
        {currentView === 'security' && <SecurityScanner />}
        {currentView === 'payments' && <ContractPaymentView />}
        {currentView === 'admin' && <AdminComplianceView />}
        
        {/* Renderizado condicional protegido: si no es superadmin, se deniega el acceso visual */}
        {currentView === 'users_master' && (
          userRole === 'superadmin' ? <UserManagementView /> : (
            <div className="max-w-md mx-auto my-20 bg-rose-950/40 border border-rose-800 p-8 rounded-2xl text-center">
              <Lock size={32} className="mx-auto text-rose-400 mb-3" />
              <h3 className="text-white font-bold text-lg mb-1">Acceso Restringido</h3>
              <p className="text-xs text-rose-200">Esta sección es exclusiva para el rol superadmin global de TrustLink.</p>
            </div>
          )
        )}

        {currentView === 'provider' && <ProviderDashboard />}
        {currentView === 'login' && <LoginView onLoginSuccess={(loggedInUser) => {
          if (loggedInUser.role === 'provider') setCurrentView('provider');
          else if (loggedInUser.role === 'superadmin') setCurrentView('admin');
          else if (loggedInUser.role === 'security') setCurrentView('security');
          else setCurrentView('resident');
        }} />}
        {currentView === 'register' && <RegisterView onRegisterSuccess={() => setCurrentView('login')} />}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrandingProvider>
      <AuthProvider>
        <MainAppContent />
      </AuthProvider>
    </BrandingProvider>
  );
}