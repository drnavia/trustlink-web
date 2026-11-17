/**
 * @file App.jsx
 * @description Enrutador y orquestador principal de TrustLink Web con control de sesión global (AuthContext),
 * manejo de marca blanca, orden lógico de módulos optimizado y un footer institucional unificado.
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
import { ShieldCheck, QrCode, Home, ShieldAlert, LogIn, UserPlus, CreditCard, UserCheck, Wrench, LogOut, Lock } from 'lucide-react';

function MainAppContent() {
  const { user, isAuthenticated, logout } = useAuth();
  const { brand } = useBranding();
  const userRole = user ? user.role : 'guest';
  
  const [currentView, setCurrentView] = useState(isAuthenticated ? 'resident' : 'landing');

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      
      {/* Barra de Navegación Superior Global */}
      <nav className="bg-slate-950 border-b border-slate-800 px-6 py-3 flex justify-between items-center gap-4 sticky top-0 z-50 shadow-2xl flex-wrap">
        
        {/* Branding Global */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentView(isAuthenticated ? 'resident' : 'landing')}>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md"
            style={{ backgroundColor: brand.primaryColor || '#0A2540' }}
          >
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
              {brand.name || 'TrustLink'}
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-normal border border-slate-700">
                Community
              </span>
            </h1>
            <p className="text-[10px] text-slate-400">Acceso Perimetral Inteligente</p>
          </div>
        </div>

        {/* Menú de Módulos (Orden Lógico de Negocio) */}
        {isAuthenticated && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* 1. Portal Residente */}
            {(userRole === 'owner' || userRole === 'family' || userRole === 'superadmin') && (
              <button
                onClick={() => setCurrentView('resident')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentView === 'resident' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Home size={14} /> Portal Residente
              </button>
            )}

            {/* 2. Pagos */}
            {(userRole === 'owner' || userRole === 'family' || userRole === 'superadmin') && (
              <button
                onClick={() => setCurrentView('payments')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentView === 'payments' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <CreditCard size={14} /> Pagos
              </button>
            )}

            {/* 3. Panel Prestador */}
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

            {/* 4. Consola Garita */}
            {(userRole === 'security' || userRole === 'admin' || userRole === 'superadmin') && (
              <button
                onClick={() => setCurrentView('security')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentView === 'security' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <ShieldAlert size={14} /> Consola Garita
              </button>
            )}

            {/* 5. Ops TrustLink */}
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
          </div>
        )}

        {/* Zona de Autenticación y Perfil */}
        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl">
                <span className="text-xs text-emerald-400 font-bold">
                  👤 {user.first_name} <span className="text-slate-400 font-normal">({user.role})</span>
                </span>
                
                {/* Acceso Ops Master Reubicado junto al Perfil (Solo Superadmin) */}
                {userRole === 'superadmin' && (
                  <button
                    onClick={() => setCurrentView('users_master')}
                    className={`ml-2 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                      currentView === 'users_master' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-purple-950/60 border-purple-800 text-purple-300 hover:bg-purple-900'
                    }`}
                    title="Modo Maestro / Gestión de Superadmins"
                  >
                    🔒 Master
                  </button>
                )}
              </div>

              <button
                onClick={() => { logout(); setCurrentView('landing'); }}
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

      {/* Contenedor de Vistas Activas */}
      <main className="flex-grow">
        {currentView === 'landing' && <LandingHome onViewChange={setCurrentView} />}
        {currentView === 'resident' && <ResidentDashboard onViewChange={setCurrentView} />}
        {currentView === 'payments' && <ContractPaymentView />}
        {currentView === 'security' && <SecurityScanner />}
        {currentView === 'admin' && <AdminComplianceView />}
        {currentView === 'provider' && <ProviderDashboard />}
        {currentView === 'login' && <LoginView onLoginSuccess={(loggedInUser) => {
          if (loggedInUser.role === 'provider') setCurrentView('provider');
          else if (loggedInUser.role === 'superadmin') setCurrentView('admin');
          else if (loggedInUser.role === 'security') setCurrentView('security');
          else setCurrentView('resident');
        }} />}
        {currentView === 'register' && <RegisterView onRegisterSuccess={() => setCurrentView('login')} />}
        {currentView === 'users_master' && (
          userRole === 'superadmin' ? <UserManagementView /> : (
            <div className="max-w-md mx-auto my-20 bg-rose-950/40 border border-rose-800 p-8 rounded-2xl text-center">
              <Lock size={32} className="mx-auto text-rose-400 mb-3" />
              <h3 className="text-white font-bold text-lg mb-1">Acceso Restringido</h3>
              <p className="text-xs text-rose-200">Esta sección es exclusiva para el rol superadmin global de TrustLink.</p>
            </div>
          )
        )}
      </main>

      {/* Footer Institucional Único (Replicado en toda la plataforma) */}
      <footer className="bg-slate-950 border-t border-slate-800 py-4 px-6 text-center text-xs text-slate-500">
        TrustLink Community Network — Nodo Central de Validación Perimetral y Compliance © 2026
      </footer>

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