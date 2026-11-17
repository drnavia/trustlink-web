/**
 * @file App.jsx
 * @description Enrutador y orquestador principal de TrustLink Web. Gestiona el ciclo de vida de la sesión global (AuthContext),
 * la marca blanca y el enrutamiento protegido por roles con orden lógico optimizado.
 * @location /trustlink-web/src/App.jsx
 */

import React, { useState } from 'react';
import { BrandingProvider, useBranding } from './modules/branding/BrandingContext';
import { AuthProvider, useAuth } from './modules/auth/AuthContext';
import LandingHome from './modules/landing/LandingHome';
import ResidentDashboard from './modules/owner/ResidentDashboard';
import ContractPaymentView from './modules/owner/ContractPaymentView';
import ProviderDashboard from './modules/provider/ProviderDashboard';
import SecurityScanner from './modules/security/SecurityScanner';
import AdminComplianceView from './modules/admin/AdminComplianceView';
import UserManagementView from './modules/admin/UserManagementView';
import LoginView from './modules/auth/LoginView';
import RegisterView from './modules/auth/RegisterView';
import { 
  ShieldCheck, QrCode, Home, ShieldAlert, LogIn, UserPlus, 
  CreditCard, UserCheck, Wrench, LogOut, Lock, Layers 
} from 'lucide-react';

function MainAppContent() {
  const [currentView, setCurrentView] = useState('landing');
  const { user, isAuthenticated, logout } = useAuth();
  const { brand } = useBranding();
  const userRole = user ? user.role : 'guest';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col">
      {/* Barra de Navegación Superior */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-3 flex justify-between items-center shadow-lg sticky top-0 z-50">
        {/* Identidad de la Plataforma */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentView(isAuthenticated ? 'resident' : 'landing')}>
          <div 
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md"
            style={{ backgroundColor: brand.primaryColor }}
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
        <nav className="hidden md:flex items-center space-x-1.5 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800/80">
          <button
            onClick={() => setCurrentView(isAuthenticated ? 'resident' : 'landing')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              currentView === 'landing' || currentView === 'resident' 
                ? 'bg-slate-800 text-white shadow-md' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Home size={14} /> Inicio / Residente
          </button>

          {isAuthenticated && (
            <>
              <button
                onClick={() => setCurrentView('payments')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentView === 'payments' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <CreditCard size={14} /> Pagos & Contratos
              </button>

              {(userRole === 'provider' || userRole === 'superadmin') && (
                <button
                  onClick={() => setCurrentView('provider')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    currentView === 'provider' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Wrench size={14} /> Panel Prestador
                </button>
              )}

              {(userRole === 'security' || userRole === 'superadmin') && (
                <button
                  onClick={() => setCurrentView('security')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    currentView === 'security' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <QrCode size={14} /> Consola Garita
                </button>
              )}

              {userRole === 'superadmin' && (
                <button
                  onClick={() => setCurrentView('admin')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    currentView === 'admin' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <UserCheck size={14} /> Ops TrustLink
                </button>
              )}
            </>
          )}
        </nav>

        {/* Acciones de Autenticación y Perfil */}
        <div className="flex items-center space-x-3">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <span className="block text-xs font-bold text-white">{user?.first_name} {user?.last_name}</span>
                <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-mono">[{userRole}]</span>
              </div>

              {/* Botón de Modo Maestro (Exclusivo Superadmin) */}
              {userRole === 'superadmin' && (
                <button
                  onClick={() => setCurrentView('users_master')}
                  title="Panel Maestro de Cuentas y Accesos"
                  className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    currentView === 'users_master' 
                      ? 'bg-purple-600 text-white border-purple-500 shadow-lg' 
                      : 'bg-slate-900 text-purple-400 border-purple-500/30 hover:bg-slate-800'
                  }`}
                >
                  <Layers size={16} />
                </button>
              )}

              <button
                onClick={() => {
                  logout();
                  setCurrentView('landing');
                }}
                className="bg-slate-900 hover:bg-rose-950/40 text-rose-400 p-2 rounded-xl border border-slate-800 hover:border-rose-900 transition-all cursor-pointer shadow-sm"
                title="Cerrar Sesión"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentView('login')}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-800 transition-all cursor-pointer"
              >
                <LogIn size={14} /> Ingresar
              </button>
              <button
                onClick={() => setCurrentView('register')}
                className="flex items-center gap-1.5 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-lg transition-all cursor-pointer"
                style={{ backgroundColor: brand.primaryColor }}
              >
                <UserPlus size={14} /> Registrarse
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Contenido Dinámico según la Vista Activa */}
      <main className="flex-1">
        {currentView === 'landing' && <LandingHome onViewChange={setCurrentView} />}
        {currentView === 'resident' && <ResidentDashboard onViewChange={setCurrentView} />}
        {currentView === 'payments' && <ContractPaymentView />}
        {currentView === 'security' && <SecurityScanner />}
        {currentView === 'admin' && <AdminComplianceView />}
        {currentView === 'users_master' && (
          userRole === 'superadmin' ? (
            <UserManagementView />
          ) : (
            <div className="p-12 text-center max-w-md mx-auto mt-20 bg-slate-950 border border-slate-800 rounded-3xl shadow-xl">
              <Lock size={32} className="mx-auto text-rose-400 mb-3" />
              <h3 className="font-bold text-lg text-rose-200">Acceso Restringido</h3>
              <p className="text-xs text-slate-400 mt-2">Se requiere rol de Superadmin para acceder a Ops Master.</p>
            </div>
          )
        )}
        {currentView === 'provider' && <ProviderDashboard />}
        {currentView === 'login' && (
          <LoginView onLoginSuccess={(loggedInUser) => {
            if (loggedInUser.role === 'provider') setCurrentView('provider');
            else if (loggedInUser.role === 'superadmin') setCurrentView('admin');
            else if (loggedInUser.role === 'security') setCurrentView('security');
            else setCurrentView('resident');
          }} />
        )}
        {currentView === 'register' && <RegisterView onRegisterSuccess={() => setCurrentView('login')} />}
      </main>

      {/* Pie de Página Institucional */}
      <footer className="bg-slate-950 border-t border-slate-800 px-6 py-4 text-center text-xs text-slate-500">
        TrustLink Security Node © 2026 — Arquitectura Modular de Acceso Perimetral y Compliance
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