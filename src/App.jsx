/**
 * @file App.jsx
 * @description Enrutador y orquestador principal de TrustLink Web con control de sesión global (AuthContext),
 * paleta dinámica de 3 colores (Primario, Secundario y Acento), vista pública Landing,
 * footer único global y protección de rutas por rol.
 * @location /trustlink-web/src/App.jsx
 */

import React, { useState, useEffect } from 'react';
import { BrandingProvider, useBranding } from './modules/branding/BrandingContext';
import BrandingSettingsView from './modules/branding/BrandingSettingsView';
import { AuthProvider, useAuth } from './modules/auth/AuthContext';
import SecurityScanner from './modules/security/SecurityScanner';
import LoginView from './modules/auth/LoginView';
import RegisterView from './modules/auth/RegisterView';
import ContractPaymentView from './modules/owner/ContractPaymentView';
import AdminComplianceView from './modules/admin/AdminComplianceView';
import UserManagementView from './modules/admin/UserManagementView';
import SystemHealthDashboard from './modules/admin/SystemHealthDashboard';
import LocalAdminView from './modules/admin/LocalAdminView';
import ProviderDashboard from './modules/provider/ProviderDashboard';
import ResidentDashboard from './modules/owner/ResidentDashboard';
import LandingHome from './modules/landing/LandingHome';
import {
  ShieldCheck,
  QrCode,
  Home,
  Wrench,
  CreditCard,
  ShieldAlert,
  UserCheck,
  Activity,
  Layers,
  Palette,
  LogIn,
  UserPlus,
  LogOut,
  Lock,
} from 'lucide-react';

function MainAppContent() {
  const { brand } = useBranding();
  const { user, isAuthenticated, logout } = useAuth();
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
  const canSeeSecurity = userRole === 'security' || isSuperadmin;

  const handleLogout = () => {
    logout();
    setCurrentView('landing');
    setMasterModeOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Barra de Navegación Superior Global */}
      <header className="bg-slate-950 border-b border-slate-800 px-4 md:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-40 shadow-lg">
        {/* Identidad Visual Global (Primario + Secundario) */}
        <div
          className="flex items-center space-x-3 cursor-pointer"
          onClick={() =>
            setCurrentView(
              isAuthenticated
                ? userRole === 'provider'
                  ? 'provider'
                  : userRole === 'security'
                  ? 'security'
                  : userRole === 'admin'
                  ? 'local_admin'
                  : 'resident'
                : 'landing'
            )
          }
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md border border-white/10"
            style={{ backgroundColor: brand.primaryColor || '#0A2540' }}
          >
            <ShieldCheck size={20} style={{ color: brand.accentColor || '#10B981' }} />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
              {brand.name || 'TrustLink'}
              <span
                className="text-[10px] px-2 py-0.5 rounded-full text-slate-200 font-medium border border-slate-700"
                style={{ backgroundColor: brand.secondaryColor || '#1E293B' }}
              >
                Community
              </span>
            </h1>
            <p className="text-[10px] text-slate-400">Red de Confianza Residencial</p>
          </div>
        </div>

        {/* Navegación Principal Ordenada por Flujo de Negocio */}
        {isAuthenticated && (
          <nav className="flex flex-wrap items-center gap-2 text-xs">
            {/* 1. Portal Residente */}
            {canSeeResident && (
              <button
                type="button"
                onClick={() => setCurrentView('resident')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  currentView === 'resident'
                    ? 'text-white shadow-lg'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                style={
                  currentView === 'resident'
                    ? { backgroundColor: brand.accentColor || '#10B981' }
                    : undefined
                }
              >
                <Home size={13} /> Portal Residente
              </button>
            )}

            {/* 2. Portal Prestador */}
            {canSeeProvider && (
              <button
                type="button"
                onClick={() => setCurrentView('provider')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  currentView === 'provider'
                    ? 'text-white shadow-lg'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                style={
                  currentView === 'provider'
                    ? { backgroundColor: brand.accentColor || '#10B981' }
                    : undefined
                }
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
                    ? 'text-white shadow-lg'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                style={
                  currentView === 'payments'
                    ? { backgroundColor: brand.accentColor || '#10B981' }
                    : undefined
                }
              >
                <CreditCard size={13} /> Pagos y Reseñas
              </button>
            )}

            {/* 4. Consola Garita */}
            {canSeeSecurity && (
              <button
                type="button"
                onClick={() => setCurrentView('security')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  currentView === 'security'
                    ? 'text-white shadow-lg'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                style={
                  currentView === 'security'
                    ? { backgroundColor: brand.accentColor || '#10B981' }
                    : undefined
                }
              >
                <QrCode size={13} /> Consola Garita
              </button>
            )}

            {/* Admin Barrio (rol admin local) */}
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

            {/* 5. Modo Maestro (Superadmin) */}
            {isSuperadmin && (
              <button
                type="button"
                onClick={() => setMasterModeOpen((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${
                  masterModeOpen ||
                  currentView === 'admin' ||
                  currentView === 'health' ||
                  currentView === 'users_master' ||
                  currentView === 'local_admin' ||
                  currentView === 'branding_master'
                    ? 'bg-purple-700 text-white border-purple-500 shadow'
                    : 'bg-purple-950 text-purple-300 border-purple-800 hover:bg-purple-900'
                }`}
              >
                <Layers size={13} /> Modo Maestro
              </button>
            )}
          </nav>
        )}

        {/* Zona de Usuario / Autenticación */}
        <div className="flex items-center gap-2.5 text-xs">
          {isAuthenticated && user ? (
            <>
              <div
                className="flex items-center gap-2 border border-slate-700 px-3 py-1.5 rounded-xl shadow-inner"
                style={{ backgroundColor: brand.secondaryColor || '#1E293B' }}
              >
                <ShieldCheck size={14} style={{ color: brand.accentColor || '#10B981' }} />
                <span className="font-bold text-slate-100">
                  {user.first_name} ({user.role})
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-rose-950/60 text-rose-400 border border-slate-800 hover:border-rose-800 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer"
                title="Cerrar sesión"
              >
                <LogOut size={13} /> Salir
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentView('login')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  currentView === 'login'
                    ? 'text-white shadow'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
                style={
                  currentView === 'login'
                    ? { backgroundColor: brand.accentColor || '#10B981' }
                    : undefined
                }
              >
                <LogIn size={13} /> Ingresar
              </button>
              <button
                type="button"
                onClick={() => setCurrentView('register')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  currentView === 'register'
                    ? 'text-white shadow'
                    : 'bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800'
                }`}
                style={
                  currentView === 'register'
                    ? { backgroundColor: brand.primaryColor || '#0A2540' }
                    : undefined
                }
              >
                <UserPlus size={13} /> Registrarse
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Sub-menú de Gobernanza Central Superadmin (Modo Maestro) */}
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
                  ? 'text-white'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
              style={
                currentView === 'admin'
                  ? { backgroundColor: brand.accentColor || '#10B981' }
                  : undefined
              }
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
              <ShieldAlert size={12} /> Cuentas Privilegiadas
            </button>

            <button
              type="button"
              onClick={() => setCurrentView('local_admin')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                currentView === 'local_admin'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <ShieldAlert size={12} /> Vista Admin Barrio
            </button>

            <button
              type="button"
              onClick={() => setCurrentView('branding_master')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                currentView === 'branding_master'
                  ? 'text-white shadow'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
              style={
                currentView === 'branding_master'
                  ? { backgroundColor: brand.primaryColor || '#0A2540' }
                  : undefined
              }
            >
              <Palette size={12} /> Colores / Marca
            </button>
          </div>
        </div>
      )}

      {/* Contenedor Principal de Vistas */}
      <main className="flex-grow flex flex-col">
        {currentView === 'landing' && <LandingHome onViewChange={setCurrentView} />}
        {currentView === 'login' && (
          <LoginView
            onLoginSuccess={(loggedInUser) => {
              if (loggedInUser.role === 'provider') setCurrentView('provider');
              else if (loggedInUser.role === 'superadmin') setCurrentView('admin');
              else if (loggedInUser.role === 'admin') setCurrentView('local_admin');
              else if (loggedInUser.role === 'security') setCurrentView('security');
              else setCurrentView('resident');
            }}
          />
        )}
        {currentView === 'register' && (
          <RegisterView onRegisterSuccess={() => setCurrentView('login')} />
        )}
        {currentView === 'resident' && <ResidentDashboard onViewChange={setCurrentView} />}
        {currentView === 'provider' && <ProviderDashboard />}
        {currentView === 'payments' && <ContractPaymentView />}
        {currentView === 'security' && <SecurityScanner />}
        {currentView === 'admin' && <AdminComplianceView />}
        {currentView === 'health' && (
          <SystemHealthDashboard onNavigate={(view) => setCurrentView(view)} />
        )}
        {currentView === 'local_admin' && <LocalAdminView />}

        {currentView === 'users_master' &&
          (isSuperadmin ? (
            <UserManagementView />
          ) : (
            <div className="max-w-md mx-auto my-20 bg-rose-950/40 border border-rose-800 p-8 rounded-2xl text-center">
              <Lock size={32} className="mx-auto text-rose-400 mb-3" />
              <p className="text-xs text-rose-200">
                Esta sección es exclusiva para el rol superadmin global de TrustLink.
              </p>
            </div>
          ))}

        {currentView === 'branding_master' &&
          (isSuperadmin ? (
            <BrandingSettingsView />
          ) : (
            <div className="max-w-md mx-auto my-20 bg-rose-950/40 border border-rose-800 p-8 rounded-2xl text-center">
              <Lock size={32} className="mx-auto text-rose-400 mb-3" />
              <p className="text-xs text-rose-200">
                La personalización de colores es exclusiva para el rol superadmin global de TrustLink.
              </p>
            </div>
          ))}
      </main>

      {/* Footer Institucional Único */}
      <footer className="bg-slate-950 border-t border-slate-800 py-3.5 px-6 text-center text-xs text-slate-500 w-full mt-auto">
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