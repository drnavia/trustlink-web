/**
 * @file App.jsx
 * @description Enrutador y orquestador principal de TrustLink Web con control de sesión global (AuthContext),
 * marca blanca, vista pública Landing y protección de rutas por rol con sub-menú de gobernanza en Modo Maestro.
 * @location /trustlink-web/src/App.jsx
 */

import React, { useState, useEffect } from 'react';
import { BrandingProvider, useBranding } from './modules/branding/BrandingContext';
import { AuthProvider, useAuth } from './modules/auth/AuthContext';
import LandingHome from './modules/landing/LandingHome';
import ResidentDashboard from './modules/owner/ResidentDashboard';
import ContractPaymentView from './modules/owner/ContractPaymentView';
import ProviderDashboard from './modules/provider/ProviderDashboard';
import SecurityScanner from './modules/security/SecurityScanner';
import AdminComplianceView from './modules/admin/AdminComplianceView';
import UserManagementView from './modules/admin/UserManagementView';
import SystemHealthDashboard from './modules/admin/SystemHealthDashboard';
import LocalAdminView from './modules/admin/LocalAdminView';
import LoginView from './modules/auth/LoginView';
import RegisterView from './modules/auth/RegisterView';
import {
  ShieldCheck,
  QrCode,
  CreditCard,
  Wrench,
  ShieldAlert,
  UserCheck,
  Activity,
  Layers,
  LogIn,
  UserPlus,
  LogOut,
  User
} from 'lucide-react';

function MainAppContent() {
  const { brand } = useBranding();
  const { user, logout } = useAuth();
  const [currentView, setCurrentView] = useState(user ? 'resident' : 'landing');
  const [masterModeOpen, setMasterModeOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setCurrentView('landing');
      setMasterModeOpen(false);
    } else if (user.role === 'superadmin') {
      setCurrentView('admin');
      setMasterModeOpen(true);
    } else if (user.role === 'admin') {
      setCurrentView('local_admin');
      setMasterModeOpen(false);
    } else if (user.role === 'provider') {
      setCurrentView('provider');
      setMasterModeOpen(false);
    } else if (user.role === 'security') {
      setCurrentView('security');
      setMasterModeOpen(false);
    } else {
      setCurrentView('resident');
      setMasterModeOpen(false);
    }
  }, [user]);

  const userRole = user?.role || null;
  const isSuperadmin = userRole === 'superadmin';
  const isLocalAdmin = userRole === 'admin';
  const canSeeResident = userRole === 'owner' || userRole === 'family' || isSuperadmin;
  const canSeeProvider = userRole === 'provider' || isSuperadmin;
  const canSeePaymentsAndReviews =
    userRole === 'owner' || userRole === 'family' || userRole === 'provider' || isSuperadmin;

  const handleLogout = () => {
    logout();
    setCurrentView('landing');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      <header className="bg-slate-950 border-b border-slate-800 px-4 md:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-40 shadow-lg">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCurrentView(user ? 'resident' : 'landing')}
            className="flex items-center gap-2.5 text-left cursor-pointer"
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-lg shadow"
              style={{ backgroundColor: brand.primaryColor || '#10b981' }}
            >
              T
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-white tracking-tight text-base">TrustLink</span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Red Verificada
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Acceso Perimetral y Reputación</p>
            </div>
          </button>
        </div>

        <nav className="flex flex-wrap items-center gap-1.5 text-xs">
          {!user ? (
            <>
              <button
                type="button"
                onClick={() => setCurrentView('landing')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  currentView === 'landing'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Inicio
              </button>
              <button
                type="button"
                onClick={() => setCurrentView('login')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  currentView === 'login'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <LogIn size={13} /> Ingresar
              </button>
              <button
                type="button"
                onClick={() => setCurrentView('register')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  currentView === 'register'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <UserPlus size={13} /> Registrarse
              </button>
            </>
          ) : (
            <>
              {/* 1. Portal Residente */}
              {canSeeResident && (
                <button
                  type="button"
                  onClick={() => setCurrentView('resident')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    currentView === 'resident'
                      ? 'bg-emerald-600 text-white shadow-lg'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <ShieldCheck size={13} /> Portal Residente
                </button>
              )}

              {/* 2. Portal Prestador */}
              {canSeeProvider && (
                <button
                  type="button"
                  onClick={() => setCurrentView('provider')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    currentView === 'provider'
                      ? 'bg-emerald-600 text-white shadow-lg'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Wrench size={13} /> Portal Prestador
                </button>
              )}

              {/* 3. Pagos y Reseñas */}
              {canSeePaymentsAndReviews && (
                <button
                  type="button"
                  onClick={() => setCurrentView('payments')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    currentView === 'payments'
                      ? 'bg-emerald-600 text-white shadow-lg'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <CreditCard size={13} /> Pagos y Reseñas
                </button>
              )}

              {/* 4. Consola Garita */}
              {(userRole === 'security' || isLocalAdmin || isSuperadmin) && (
                <button
                  type="button"
                  onClick={() => setCurrentView('security')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    currentView === 'security'
                      ? 'bg-emerald-600 text-white shadow-lg'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <QrCode size={13} /> Consola Garita
                </button>
              )}

              {/* Admin Barrio local */}
              {isLocalAdmin && (
                <button
                  type="button"
                  onClick={() => setCurrentView('local_admin')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    currentView === 'local_admin'
                      ? 'bg-amber-600 text-white shadow-lg'
                      : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
                  }`}
                >
                  <ShieldAlert size={13} /> Admin Barrio
                </button>
              )}

              {/* 5. Modo Maestro */}
              {isSuperadmin && (
                <button
                  type="button"
                  onClick={() => setMasterModeOpen((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${
                    masterModeOpen ||
                    currentView === 'admin' ||
                    currentView === 'health' ||
                    currentView === 'users_master' ||
                    currentView === 'local_admin'
                      ? 'bg-purple-700 text-white border-purple-500 shadow'
                      : 'bg-purple-950 text-purple-300 border-purple-800 hover:bg-purple-900'
                  }`}
                >
                  <Layers size={13} /> Modo Maestro
                </button>
              )}

              {/* Badge de usuario con estética e ícono */}
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 text-emerald-300 font-bold shadow-sm">
                <User size={13} className="text-emerald-400" />
                <span>{user.first_name}</span>
                <span className="text-slate-400 font-medium">({user.role})</span>
              </span>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-800 cursor-pointer"
              >
                <LogOut size={13} /> Salir
              </button>
            </>
          )}
        </nav>
      </header>

      {isSuperadmin && masterModeOpen && (
        <div className="bg-slate-950/95 border-b border-purple-900/60 px-4 md:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-purple-300 font-semibold flex items-center gap-1.5">
            <Layers size={13} /> Gobernanza Central Superadmin
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentView('admin')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                currentView === 'admin'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <UserCheck size={12} /> Ops TrustLink
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('health')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                currentView === 'health'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Activity size={12} /> Salud &amp; APIs
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('users_master')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                currentView === 'users_master'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              Cuentas Privilegiadas
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('local_admin')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                currentView === 'local_admin'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-900 text-amber-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <ShieldAlert size={12} /> Vista Admin Barrio
            </button>
          </div>
        </div>
      )}

      <div className="flex-1">
        {currentView === 'landing' && (
          <LandingHome onNavigate={(target) => setCurrentView(target)} />
        )}
        {currentView === 'login' && (
          <LoginView
            onLoginSuccess={() => setCurrentView('resident')}
            onNavigateRegister={() => setCurrentView('register')}
          />
        )}
        {currentView === 'register' && (
          <RegisterView
            onRegisterSuccess={() => setCurrentView('login')}
            onNavigateLogin={() => setCurrentView('login')}
          />
        )}
        {currentView === 'resident' && (
          <ResidentDashboard onViewChange={(v) => setCurrentView(v)} />
        )}
        {currentView === 'payments' && <ContractPaymentView />}
        {currentView === 'provider' && <ProviderDashboard />}
        {currentView === 'security' && <SecurityScanner />}
        {currentView === 'local_admin' && <LocalAdminView />}
        {currentView === 'admin' && <AdminComplianceView />}
        {currentView === 'health' && <SystemHealthDashboard />}
        {currentView === 'users_master' && <UserManagementView />}
      </div>

      <footer className="bg-slate-950 border-t border-slate-800 px-6 py-4 text-center text-xs text-slate-500">
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