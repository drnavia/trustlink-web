/**
 * @file App.jsx
 * @description Enrutador y orquestador principal de TrustLink Web con control de sesión global (AuthContext),
 * marca blanca por zonas (1 a 6), vista pública Landing, protección de rutas por rol
 * y barra de navegación + submenú de Modo Maestro compactos en dispositivos móviles.
 * @location /trustlink-web/src/App.jsx
 */

import React, { useState, useEffect } from 'react';
import { BrandingProvider, useBranding } from './modules/branding/BrandingContext';
import BrandingSettingsView from './modules/branding/BrandingSettingsView';
import { AuthProvider, useAuth } from './modules/auth/AuthContext';
import SecurityScanner from './modules/security/SecurityScanner';
import LoginView from './modules/auth/LoginView';
import RegisterView from './modules/auth/RegisterView';
import ResidentDashboard from './modules/owner/ResidentDashboard';
import ProviderDashboard from './modules/provider/ProviderDashboard';
import ContractPaymentView from './modules/owner/ContractPaymentView';
import AdminComplianceView from './modules/admin/AdminComplianceView';
import SystemHealthDashboard from './modules/admin/SystemHealthDashboard';
import UserManagementView from './modules/admin/UserManagementView';
import LocalAdminView from './modules/admin/LocalAdminView';
import LandingHome from './modules/landing/LandingHome';
import {
  ShieldCheck,
  QrCode,
  LogIn,
  UserPlus,
  LogOut,
  User,
  Wrench,
  CreditCard,
  UserCheck,
  Activity,
  Lock,
  Layers,
  MapPin,
} from 'lucide-react';

/**
 * Determina la vista inicial permitida según el rol autenticado.
 * @param {string|null} role
 * @returns {string}
 */
function getDefaultViewForRole(role) {
  if (role === 'provider') return 'provider';
  if (role === 'security') return 'security';
  if (role === 'admin') return 'local_admin';
  return 'resident';
}

/**
 * Contenido principal de la aplicación con acceso a contextos de sesión y apariencia.
 */
function MainAppContent() {
  const { isAuthenticated, user, logout, loading } = useAuth();
  const { brand } = useBranding();

  // Vista activa actual (por defecto 'landing' cuando no hay sesión iniciada)
  const [currentView, setCurrentView] = useState('landing');
  // Estado del submenú de Modo Maestro para el rol superadmin
  const [masterModeOpen, setMasterModeOpen] = useState(false);

  const normalizedRole = String(user?.role || '').toLowerCase();
  const isSuperadmin = isAuthenticated && normalizedRole === 'superadmin';
  const isAdmin = isAuthenticated && normalizedRole === 'admin';
  const isProvider = isAuthenticated && normalizedRole === 'provider';
  const isSecurity = isAuthenticated && normalizedRole === 'security';
  const isResident = isAuthenticated && (normalizedRole === 'owner' || normalizedRole === 'family');

  // Sincroniza vista y submenú al cambiar el estado de autenticación o rol
  useEffect(() => {
    if (!isAuthenticated) {
      setCurrentView('landing');
      setMasterModeOpen(false);
      return;
    }

    setCurrentView((prevView) => {
      if (prevView === 'landing' || prevView === 'login' || prevView === 'register') {
        return getDefaultViewForRole(normalizedRole);
      }
      return prevView;
    });

    if (normalizedRole === 'superadmin') {
      setMasterModeOpen(true);
    } else {
      setMasterModeOpen(false);
    }
  }, [isAuthenticated, normalizedRole]);

  // Cierra sesión y vuelve a la vista pública
  const handleLogout = () => {
    logout();
    setMasterModeOpen(false);
    setCurrentView('landing');
  };

  // Resuelve el logo institucional (imagen cargada por el usuario o emblema por defecto)
  const renderBrandLogo = () => {
    if (brand?.logoUrl && String(brand.logoUrl).trim() !== '') {
      return (
        <img
          src={brand.logoUrl}
          alt={brand.brandName || 'TrustLink'}
          className="h-7 w-7 md:h-8 md:w-8 rounded-lg object-contain shrink-0"
        />
      );
    }

    return (
      <div
        className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-white font-bold shadow-sm shrink-0"
        style={{ backgroundColor: brand?.primaryActionColor || '#059669' }}
      >
        <ShieldCheck className="w-4 h-4 md:w-[18px] md:h-[18px]" />
      </div>
    );
  };

  // Estilos por zona (Zonas 1 a 6)
  const platformStyle = {
    backgroundColor: brand?.platformBgColor || '#0F172A',
    color: brand?.platformTextColor || '#F1F5F9',
  };

  const menuStyle = {
    backgroundColor: brand?.menuBgColor || '#020617',
    color: brand?.menuTextColor || '#E2E8F0',
  };

  const submenuStyle = {
    backgroundColor: brand?.submenuBgColor || '#090D16',
    color: brand?.submenuTextColor || '#CBD5E1',
  };

  const footerStyle = {
    backgroundColor: brand?.footerBgColor || '#020617',
    color: brand?.footerTextColor || '#94A3B8',
  };

  const activePrimaryStyle = {
    backgroundColor: brand?.primaryActionColor || '#059669',
    color: '#FFFFFF',
  };

  const inactiveNavClass =
    'bg-slate-900/75 text-slate-300 hover:bg-slate-800/90 border border-slate-700/60';

  // Pantalla de carga inicial de sesión
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center font-sans"
        style={platformStyle}
      >
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs opacity-80">Cargando sesión de TrustLink...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans" style={platformStyle}>
      {/* ZONA 1: Barra de Navegación Superior Compacta en Móvil */}
      <header
        className="border-b border-slate-800/80 px-3 py-2 md:px-8 md:py-3.5 sticky top-0 z-40 shadow-md"
        style={menuStyle}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4">
          {/* Fila 1 en móvil: Marca + Acciones de sesión */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div
              className="flex items-center gap-2 md:gap-3 cursor-pointer min-w-0"
              onClick={() =>
                setCurrentView(isAuthenticated ? getDefaultViewForRole(normalizedRole) : 'landing')
              }
            >
              {renderBrandLogo()}
              <div className="min-w-0 leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm md:text-base font-bold tracking-tight truncate">
                    {brand?.brandName || 'TrustLink'}
                  </span>
                  {brand?.brandBadge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800/80 text-slate-200 border border-slate-700/70 shrink-0">
                      {brand.brandBadge}
                    </span>
                  )}
                </div>
                <p className="hidden sm:block text-[11px] opacity-75 truncate">
                  {brand?.brandSubtitle || 'Red de Confianza Residencial'}
                </p>
              </div>
            </div>

            {/* Bloque derecho en móvil y escritorio */}
            <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
              {!isAuthenticated ? (
                <>
                  <button
                    type="button"
                    onClick={() => setCurrentView('login')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 md:px-3.5 rounded-xl text-[11px] md:text-xs font-bold transition-all cursor-pointer ${
                      currentView === 'login' ? 'shadow-md' : inactiveNavClass
                    }`}
                    style={currentView === 'login' ? activePrimaryStyle : undefined}
                  >
                    <LogIn size={13} /> Ingresar
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentView('register')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 md:px-3.5 rounded-xl text-[11px] md:text-xs font-bold transition-all cursor-pointer ${
                      currentView === 'register' ? 'shadow-md' : inactiveNavClass
                    }`}
                    style={currentView === 'register' ? activePrimaryStyle : undefined}
                  >
                    <UserPlus size={13} /> Registrarse
                  </button>
                </>
              ) : (
                <>
                  {isSuperadmin && (
                    <button
                      type="button"
                      onClick={() => setMasterModeOpen((prev) => !prev)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 md:px-3 rounded-xl text-[11px] md:text-xs font-bold border transition-all cursor-pointer ${
                        masterModeOpen
                          ? 'bg-purple-600 border-purple-400 text-white'
                          : 'bg-purple-950/60 border-purple-800/80 text-purple-200 hover:bg-purple-900/70'
                      }`}
                      title="Alternar submenú de Modo Maestro"
                    >
                      <Layers size={13} />
                      <span className="hidden sm:inline">Modo Maestro</span>
                      <span className="sm:hidden">Maestro</span>
                    </button>
                  )}

                  <div className="hidden md:flex items-center gap-1.5 bg-slate-900/85 border border-slate-700/70 px-3 py-1.5 rounded-xl text-xs">
                    <User size={13} className="text-emerald-400 shrink-0" />
                    <span className="font-semibold truncate max-w-[140px]">
                      {user?.full_name || user?.email}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">
                      {user?.role}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1 bg-rose-950/55 hover:bg-rose-900/75 text-rose-200 border border-rose-800/70 px-2.5 py-1.5 md:px-3 rounded-xl text-[11px] md:text-xs font-bold transition-colors cursor-pointer"
                    title="Cerrar sesión"
                  >
                    <LogOut size={13} />
                    <span className="hidden sm:inline">Salir</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Fila 2 en móvil / centro en escritorio: Módulos operativos compactos */}
          {isAuthenticated && (
            <nav
              aria-label="Módulos principales"
              className="flex items-center gap-1.5 overflow-x-auto flex-nowrap pb-0.5 md:pb-0 no-scrollbar"
            >
              {(isResident || isSuperadmin) && (
                <button
                  type="button"
                  onClick={() => setCurrentView('resident')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 md:px-3 rounded-xl text-[11px] md:text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                    currentView === 'resident' ? 'shadow-md' : inactiveNavClass
                  }`}
                  style={currentView === 'resident' ? activePrimaryStyle : undefined}
                >
                  <QrCode size={13} /> Portal Residente
                </button>
              )}

              {(isResident || isSuperadmin) && (
                <button
                  type="button"
                  onClick={() => setCurrentView('payments')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 md:px-3 rounded-xl text-[11px] md:text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                    currentView === 'payments' ? 'shadow-md' : inactiveNavClass
                  }`}
                  style={currentView === 'payments' ? activePrimaryStyle : undefined}
                >
                  <CreditCard size={13} /> Pagos y Reseñas
                </button>
              )}

              {(isProvider || isSuperadmin) && (
                <button
                  type="button"
                  onClick={() => setCurrentView('provider')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 md:px-3 rounded-xl text-[11px] md:text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                    currentView === 'provider' ? 'shadow-md' : inactiveNavClass
                  }`}
                  style={currentView === 'provider' ? activePrimaryStyle : undefined}
                >
                  <Wrench size={13} /> Portal Prestador
                </button>
              )}

              {(isSecurity || isAdmin || isSuperadmin) && (
                <button
                  type="button"
                  onClick={() => setCurrentView('security')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 md:px-3 rounded-xl text-[11px] md:text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                    currentView === 'security' ? 'shadow-md' : inactiveNavClass
                  }`}
                  style={currentView === 'security' ? activePrimaryStyle : undefined}
                >
                  <ShieldCheck size={13} /> Consola Garita
                </button>
              )}

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setCurrentView('local_admin')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 md:px-3 rounded-xl text-[11px] md:text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                    currentView === 'local_admin' ? 'shadow-md' : inactiveNavClass
                  }`}
                  style={currentView === 'local_admin' ? activePrimaryStyle : undefined}
                >
                  <MapPin size={13} /> Vista Admin Barrio
                </button>
              )}
            </nav>
          )}
        </div>
      </header>

      {/* ZONA 2: Submenú de Modo Maestro Compacto en Móvil (solo superadmin) */}
      {isSuperadmin && masterModeOpen && (
        <div
          className="border-b border-slate-800/80 px-3 py-2 md:px-8 md:py-2.5"
          style={submenuStyle}
        >
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-1.5 md:gap-3">
            <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider opacity-80 shrink-0">
              Gobernanza Central Superadmin
            </span>

            <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap pb-0.5 md:pb-0">
              <button
                type="button"
                onClick={() => setCurrentView('admin')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  currentView === 'admin'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-900/75 text-slate-300 hover:bg-slate-800 border border-slate-700/60'
                }`}
              >
                <UserCheck size={12} /> Compliance Prestadores
              </button>

              <button
                type="button"
                onClick={() => setCurrentView('local_admin')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  currentView === 'local_admin'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-slate-900/75 text-slate-300 hover:bg-slate-800 border border-slate-700/60'
                }`}
              >
                <MapPin size={12} /> Vista Admin Barrio
              </button>

              <button
                type="button"
                onClick={() => setCurrentView('users_master')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  currentView === 'users_master'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-900/75 text-slate-300 hover:bg-slate-800 border border-slate-700/60'
                }`}
              >
                <UserCheck size={12} /> Cuentas Privilegiadas
              </button>

              <button
                type="button"
                onClick={() => setCurrentView('branding_master')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  currentView === 'branding_master'
                    ? 'bg-pink-600 text-white shadow-sm'
                    : 'bg-slate-900/75 text-slate-300 hover:bg-slate-800 border border-slate-700/60'
                }`}
              >
                <Layers size={12} /> Colores / Marca
              </button>

              <button
                type="button"
                onClick={() => setCurrentView('health')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  currentView === 'health'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-900/75 text-slate-300 hover:bg-slate-800 border border-slate-700/60'
                }`}
              >
                <Activity size={12} /> Salud & APIs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ZONA 3: Contenedor Principal de Vistas */}
      <main className="flex-1 w-full">
        {!isAuthenticated && currentView === 'landing' && (
          <LandingHome
            onGoLogin={() => setCurrentView('login')}
            onGoRegister={() => setCurrentView('register')}
          />
        )}

        {!isAuthenticated && currentView === 'login' && (
          <LoginView
            onLoginSuccess={(loggedUser) => {
              setCurrentView(getDefaultViewForRole(loggedUser?.role));
            }}
            onGoRegister={() => setCurrentView('register')}
          />
        )}

        {!isAuthenticated && currentView === 'register' && (
          <RegisterView onRegisterSuccess={() => setCurrentView('login')} />
        )}

        {isAuthenticated && currentView === 'resident' && (
          <ResidentDashboard onNavigate={(view) => setCurrentView(view)} />
        )}

        {isAuthenticated && currentView === 'payments' && <ContractPaymentView />}

        {isAuthenticated && currentView === 'provider' && <ProviderDashboard />}

        {isAuthenticated && currentView === 'security' && <SecurityScanner />}

        {isAuthenticated && currentView === 'local_admin' && (
          isAdmin || isSuperadmin ? (
            <LocalAdminView />
          ) : (
            <div className="max-w-md mx-auto my-20 bg-rose-950/40 border border-rose-800 p-8 rounded-2xl text-center">
              <Lock size={32} className="mx-auto text-rose-400 mb-3" />
              <p className="text-xs text-rose-200">
                Esta sección está reservada para administración de barrio o superadmin.
              </p>
            </div>
          )
        )}

        {isAuthenticated && currentView === 'admin' && (
          isSuperadmin ? (
            <AdminComplianceView />
          ) : (
            <div className="max-w-md mx-auto my-20 bg-rose-950/40 border border-rose-800 p-8 rounded-2xl text-center">
              <Lock size={32} className="mx-auto text-rose-400 mb-3" />
              <p className="text-xs text-rose-200">
                Esta sección es exclusiva para el rol superadmin global de TrustLink.
              </p>
            </div>
          )
        )}

        {isAuthenticated && currentView === 'users_master' && (
          isSuperadmin ? (
            <UserManagementView />
          ) : (
            <div className="max-w-md mx-auto my-20 bg-rose-950/40 border border-rose-800 p-8 rounded-2xl text-center">
              <Lock size={32} className="mx-auto text-rose-400 mb-3" />
              <p className="text-xs text-rose-200">
                Esta sección es exclusiva para el rol superadmin global de TrustLink.
              </p>
            </div>
          )
        )}

        {isAuthenticated && currentView === 'branding_master' && (
          isSuperadmin ? (
            <BrandingSettingsView />
          ) : (
            <div className="max-w-md mx-auto my-20 bg-rose-950/40 border border-rose-800 p-8 rounded-2xl text-center">
              <Lock size={32} className="mx-auto text-rose-400 mb-3" />
              <p className="text-xs text-rose-200">
                Esta sección es exclusiva para el rol superadmin global de TrustLink.
              </p>
            </div>
          )
        )}

        {isAuthenticated && currentView === 'health' && (
          isSuperadmin ? (
            <SystemHealthDashboard onNavigate={(view) => setCurrentView(view)} />
          ) : (
            <div className="max-w-md mx-auto my-20 bg-rose-950/40 border border-rose-800 p-8 rounded-2xl text-center">
              <Lock size={32} className="mx-auto text-rose-400 mb-3" />
              <p className="text-xs text-rose-200">
                Esta sección es exclusiva para el rol superadmin global de TrustLink.
              </p>
            </div>
          )
        )}
      </main>

      {/* ZONA 6: Footer Institucional Único */}
      <footer
        className="border-t border-slate-800/80 py-3.5 px-4 text-center text-[11px] md:text-xs"
        style={footerStyle}
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