/**
 * @file App.jsx
 * @description Enrutador y orquestador principal de TrustLink Web con control de sesión global (AuthContext),
 * manejo de marca blanca y enrutamiento modular seguro por roles.
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
import ResidentDashboard from './modules/owner/ResidentDashboard';
import { ShieldCheck, QrCode, Home, ShieldAlert, LogIn, UserPlus, CreditCard, UserCheck, Wrench, LogOut, Lock } from 'lucide-react';

function MainAppContent() {
  const [currentView, setCurrentView] = useState('resident');
  const { user, isAuthenticated, logout } = useAuth();
  const userRole = user ? user.role : 'guest';

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Barra de Navegación Superior / Selector de Vistas MVP y Estado de Sesión */}
      <nav className="bg-slate-950 border-b border-slate-800 px-6 py-2.5 flex justify-between items-center gap-2 sticky top-0 z-50 shadow-2xl flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400 font-medium mr-2">Módulos Disponibles:</span>
          
          {/* Portal Residente */}
          {(!user || userRole === 'owner' || userRole === 'family' || userRole === 'superadmin') && (
            <button
              onClick={() => setCurrentView('resident')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentView === 'resident' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Home size={14} /> Portal Residente
            </button>
          )}

          {/* Consola de Garita */}
          {(!user || userRole === 'security' || userRole === 'admin' || userRole === 'superadmin') && (
            <button
              onClick={() => setCurrentView('security')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentView === 'security' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <ShieldAlert size={14} /> Consola Garita
            </button>
          )}

          {/* Pagos y Contratos */}
          {(!user || userRole === 'owner' || userRole === 'provider' || userRole === 'superadmin') && (
            <button
              onClick={() => setCurrentView('payments')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentView === 'payments' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <CreditCard size={14} /> Pagos
            </button>
          )}

          {/* Ops TrustLink (Compliance) */}
          {userRole === 'superadmin' && (
            <button
              onClick={() => setCurrentView('admin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentView === 'admin' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <UserCheck size={14} /> Ops TrustLink
            </button>
          )}

          {/* Panel Prestador */}
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

          {/* Ruta Privada / Ops Master */}
          {userRole === 'superadmin' && (
            <button
              onClick={() => setCurrentView('users_master')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                currentView === 'users_master' ? 'bg-purple-600 border-purple-500 text-white shadow-lg' : 'bg-purple-950/40 border-purple-800/60 text-purple-300 hover:bg-purple-900/50'
              }`}
            >
              <Lock size={12} /> 🔒 Ops Master
            </button>
          )}
        </div>

        {/* Zona de Autenticación Activa */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <div className="flex items-center gap-3 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl">
              <span className="text-xs text-emerald-400 font-bold">
                👤 {user?.first_name} <span className="text-slate-400 font-normal">({user?.role})</span>
              </span>
              <button
                onClick={() => {
                  logout();
                  setCurrentView('login');
                }}
                className="bg-rose-600/80 hover:bg-rose-600 text-white px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                title="Cerrar Sesión"
              >
                <LogOut size={12} /> Salir
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentView('login')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentView === 'login' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <LogIn size={14} /> Ingresar
              </button>
              <button
                onClick={() => setCurrentView('register')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentView === 'register' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <UserPlus size={14} /> Registrarse
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Renderizado Condicional de la Vista Activa */}
      <div className="flex-grow">
        {currentView === 'resident' && <ResidentDashboard onViewChange={setCurrentView} />}
        {currentView === 'security' && <SecurityScanner />}
        {currentView === 'payments' && <ContractPaymentView />}
        {currentView === 'admin' && <AdminComplianceView />}
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