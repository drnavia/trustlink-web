/**
 * @file App.jsx
 * @description Enrutador y orquestador principal de TrustLink Web con arquitectura modular espejo completa
 * y cuadrícula unificada de accesos rápidos, incluyendo Landing Page institucional en la raíz.
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
import LandingHome from './modules/landing/LandingHome';
import { ShieldCheck, QrCode, Home, ShieldAlert, LogIn, UserPlus, CreditCard, UserCheck, Wrench, LogOut, Lock, Globe } from 'lucide-react';

function MainAppContent() {
  const { user, isAuthenticated, logout } = useAuth();
  const { brand } = useBranding();
  const userRole = user ? user.role : 'guest';
  
  // Si no está autenticado, por defecto se muestra la landing institucional ('landing')
  const [currentView, setCurrentView] = useState(isAuthenticated ? 'resident' : 'landing');

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col font-sans">
      {/* Barra de Navegación Superior Global */}
      <nav className="bg-slate-950 border-b border-slate-800 px-6 py-3 flex justify-between items-center gap-4 sticky top-0 z-50 shadow-2xl flex-wrap">
        {/* Lado Izquierdo: Branding Global "TrustLink Community" */}
        <div 
          className="flex items-center space-x-3 cursor-pointer"
          onClick={() => setCurrentView(isAuthenticated ? 'resident' : 'landing')}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md"
            style={{ backgroundColor: brand.primaryColor || '#10b981' }}
          >
            {brand.countryName ? brand.countryName.charAt(0) : 'TL'}
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight text-white">{brand.countryName || 'TrustLink Community'}</h1>
            <span className="text-[10px] text-slate-400">Red de Servicios y Accesos</span>
          </div>
        </div>

        {/* Centro: Selector de Módulos Operativos en Orden Lógico de Negocio */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setCurrentView('landing')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              currentView === 'landing' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Globe size={14} /> Inicio / Landing
          </button>

          {/* 1. Portal Residente */}
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

          {/* 2. Pagos & Contratos */}
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

          {/* 3. Consola Garita */}
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

          {/* 4. Ops TrustLink */}
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

          {/* 5. Panel Prestador */}
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

          {/* 6. Ops Master (Superadmin) */}
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
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl">
              <span className="text-xs text-emerald-400 font-bold">
                👤 {user.first_name} <span className="text-slate-400 font-normal">({user.role})</span>
              </span>
              <button
                onClick={() => {
                  logout();
                  setCurrentView('landing');
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
        {currentView === 'landing' && <LandingHome onNavigate={(view) => setCurrentView(view)} />}
        {currentView === 'resident' && <ResidentDashboard onViewChange={setCurrentView} />}
        {currentView === 'security' && <SecurityScanner />}
        {currentView === 'payments' && <ContractPaymentView />}
        {currentView === 'admin' && <AdminComplianceView />}
        {currentView === 'users_master' && (
          userRole === 'superadmin' ? <UserManagementView /> : (
            <div className="max-w-md mx-auto my-20 bg-rose-950/40 border border-rose-800 p-8 rounded-2xl text-center text-slate-100">
              <Lock size={32} className="mx-auto text-rose-400 mb-3" />
              <h3 className="font-bold text-lg text-rose-200">Acceso Restringido</h3>
              <p className="text-xs text-slate-400 mt-2">Se requiere rol de Superadmin para acceder a Ops Master.</p>
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