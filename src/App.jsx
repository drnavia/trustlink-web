/**
 * @file App.jsx
 * @description Enrutador y orquestador principal de TrustLink Web con control de sesión global (AuthContext),
 * identidad configurable en el menú (nombre, etiqueta, subtítulo y logo opcional), aplicación explícita
 * de las 6 zonas de apariencia y submenú de Modo Maestro reordenado con color activo distintivo.
 * Unifica la etiqueta del administrador local como "Vista Admin Barrio" en barra superior y encabezado.
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

  // Sincroniza la vista inicial según el rol autenticado
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

  // Identidad configurable de la barra superior (Zona 1) con fallback a valores por defecto
  const displayBrandName = (brand.brandName || brand.name || 'TrustLink').trim() || 'TrustLink';
  const displayBrandBadge = (brand.brandBadge || 'Community').trim() || 'Community';
  const displayBrandSubtitle =
    (brand.brandSubtitle || 'Red de Confianza Residencial').trim() ||
    'Red de Confianza Residencial';

  return (
    <div
      className="min-h-screen flex flex-col font-sans"
      style={{
        backgroundColor: brand.platformBgColor || '#0F172A',
        color: brand.platformTextColor || '#F1F5F9',
      }}
    >
      {/* Zona 1: Barra de Navegación Superior Global */}
      <header
        className="border-b border-black/20 px-4 md:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-40"
        style={{
          backgroundColor: brand.menuBgColor || '#020617',
          color: brand.menuTextColor || '#E2E8F0',
        }}
      >
        {/* Identidad Visual / Logo Configurable */}
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
          {brand.logoUrl ? (
            <img
              src={brand.logoUrl}
              alt={displayBrandName}
              className="h-9 w-auto max-w-[120px] object-contain rounded-lg"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-lg bg-emerald-600">
              <ShieldCheck size={20} />
            </div>
          )}
          <div>
            <h1 className="text-sm font-black tracking-tight flex items-center gap-1.5">
              <span>{displayBrandName}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/25 font-medium border border-white/15">
                {displayBrandBadge}
              </span>
            </h1>
            <p className="text-[10px] opacity-80">{displayBrandSubtitle}</p>
          </div>
        </div>

        {/* Navegación Principal */}
        {isAuthenticated && (
          <nav className="flex flex-wrap items-center gap-2 text-xs">
            {canSeeResident && (
              <button
                type="button"
                onClick={() => setCurrentView('resident')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  currentView === 'resident'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-black/25 hover:bg-black/35'
                }`}
              >
                <Home size={13} /> Portal Residente
              </button>
            )}

            {canSeeProvider && (
              <button
                type="button"
                onClick={() => setCurrentView('provider')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  currentView === 'provider'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-black/25 hover:bg-black/35'
                }`}
              >
                <Wrench size={13} /> Portal Prestador
              </button>
            )}

            {canSeePaymentsAndReviews && (
              <button
                type="button"
                onClick={() => setCurrentView('payments')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  currentView === 'payments'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-black/25 hover:bg-black/35'
                }`}
              >
                <CreditCard size={13} /> Pagos y Reseñas
              </button>
            )}

            {canSeeSecurity && (
              <button
                type="button"
                onClick={() => setCurrentView('security')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  currentView === 'security'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-black/25 hover:bg-black/35'
                }`}
              >
                <QrCode size={13} /> Consola Garita
              </button>
            )}

            {/* Etiqueta unificada con el título interno y el submenú de Modo Maestro */}
            {isLocalAdmin && (
              <button
                type="button"
                onClick={() => setCurrentView('local_admin')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  currentView === 'local_admin'
                    ? 'bg-amber-600 text-white'
                    : 'bg-black/25 hover:bg-black/35'
                }`}
              >
                <ShieldAlert size={13} /> Vista Admin Barrio
              </button>
            )}

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
                    ? 'bg-purple-700 text-white border-purple-500'
                    : 'bg-purple-950 text-purple-200 border-purple-800 hover:bg-purple-900'
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
              <div className="flex items-center gap-2 bg-black/25 border border-white/15 px-3 py-1.5 rounded-xl">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span className="font-bold">
                  {user.first_name} ({user.role})
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 bg-black/25 hover:bg-rose-950/70 text-rose-300 border border-white/15 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer"
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
                    ? 'bg-emerald-600 text-white'
                    : 'bg-black/25 hover:bg-black/35'
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
                    : 'bg-black/25 border border-white/15 hover:bg-black/35'
                }`}
              >
                <UserPlus size={13} /> Registrarse
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Zona 2: Sub-menú de Gobernanza Central Superadmin (Modo Maestro) */}
      {isSuperadmin && masterModeOpen && (
        <div
          className="border-b border-black/20 px-4 md:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs"
          style={{
            backgroundColor: brand.submenuBgColor || '#090D16',
            color: brand.submenuTextColor || '#CBD5E1',
          }}
        >
          <span className="font-semibold flex items-center gap-1.5">
            <Layers size={13} /> Gobernanza Central Superadmin
          </span>

          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Compliance Prestadores (Esmeralda) */}
            <button
              type="button"
              onClick={() => setCurrentView('admin')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                currentView === 'admin'
                  ? 'bg-emerald-600 text-white ring-2 ring-emerald-400/50'
                  : 'bg-black/25 hover:bg-black/35 border border-white/15'
              }`}
            >
              <UserCheck size={12} /> Compliance Prestadores
            </button>

            {/* 2. Vista Admin Barrio (Ámbar) */}
            <button
              type="button"
              onClick={() => setCurrentView('local_admin')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                currentView === 'local_admin'
                  ? 'bg-amber-600 text-white ring-2 ring-amber-400/50'
                  : 'bg-black/25 hover:bg-black/35 border border-white/15'
              }`}
            >
              <ShieldAlert size={12} /> Vista Admin Barrio
            </button>

            {/* 3. Cuentas Privilegiadas (Púrpura) */}
            <button
              type="button"
              onClick={() => setCurrentView('users_master')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                currentView === 'users_master'
                  ? 'bg-purple-600 text-white ring-2 ring-purple-400/50'
                  : 'bg-black/25 hover:bg-black/35 border border-white/15'
              }`}
            >
              <ShieldAlert size={12} /> Cuentas Privilegiadas
            </button>

            {/* 4. Colores / Marca (Fucsia / Rosa) */}
            <button
              type="button"
              onClick={() => setCurrentView('branding_master')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                currentView === 'branding_master'
                  ? 'bg-pink-600 text-white ring-2 ring-pink-400/50'
                  : 'bg-black/25 hover:bg-black/35 border border-white/15'
              }`}
            >
              <Palette size={12} /> Colores / Marca
            </button>

            {/* 5. Salud & APIs (Cielo) */}
            <button
              type="button"
              onClick={() => setCurrentView('health')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                currentView === 'health'
                  ? 'bg-sky-600 text-white ring-2 ring-sky-400/50'
                  : 'bg-black/25 hover:bg-black/35 border border-white/15'
              }`}
            >
              <Activity size={12} /> Salud &amp; APIs
            </button>
          </div>
        </div>
      )}

      {/* Zona 3: Contenedor Principal de Vistas */}
      <main
        className="flex-grow flex flex-col"
        style={{
          backgroundColor: brand.platformBgColor || '#0F172A',
          color: brand.platformTextColor || '#F1F5F9',
        }}
      >
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
        {currentView === 'payments' && <ContractPaymentView onViewChange={setCurrentView} />}
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
                La configuración de apariencia y marca es exclusiva para el rol superadmin global de TrustLink.
              </p>
            </div>
          ))}
      </main>

      {/* Zona 6: Footer Institucional Único */}
      <footer
        className="border-t border-black/20 py-3.5 px-6 text-center text-xs w-full mt-auto"
        style={{
          backgroundColor: brand.footerBgColor || brand.menuBgColor || '#020617',
          color: brand.footerTextColor || '#94A3B8',
        }}
      >
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