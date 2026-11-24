/**
 * @file App.jsx
 * @description Enrutador y orquestador principal de TrustLink Web con control de sesión global (AuthContext),
 * marca blanca por zonas (BrandingContext), navegación adaptable a web y celular,
 * e identidad de usuario logueado visible y clara en la barra superior.
 * @location /trustlink-web/src/App.jsx
 */

import React, { useState, useEffect } from 'react';
import {
  Home,
  Wrench,
  CreditCard,
  QrCode,
  LogOut,
  LogIn,
  UserPlus,
  User,
  Layers,
  UserCheck,
  ShieldAlert,
  Users,
  Palette,
  Activity,
} from 'lucide-react';

import { BrandingProvider, useBranding } from './modules/branding/BrandingContext';
import { AuthProvider, useAuth } from './modules/auth/AuthContext';

import LandingHome from './modules/landing/LandingHome';
import LoginView from './modules/auth/LoginView';
import RegisterView from './modules/auth/RegisterView';
import AccountView from './modules/auth/AccountView';
import ResidentDashboard from './modules/owner/ResidentDashboard';
import ProviderDashboard from './modules/provider/ProviderDashboard';
import ContractPaymentView from './modules/owner/ContractPaymentView';
import SecurityScanner from './modules/security/SecurityScanner';
import AdminComplianceView from './modules/admin/AdminComplianceView';
import LocalAdminView from './modules/admin/LocalAdminView';
import UserManagementView from './modules/admin/UserManagementView';
import BrandingSettingsView from './modules/branding/BrandingSettingsView';
import SystemHealthDashboard from './modules/admin/SystemHealthDashboard';

/**
 * Contenido principal de la aplicación con acceso a BrandingContext y AuthContext.
 */
function MainAppContent() {
  const { brand } = useBranding();
  const { user, isAuthenticated, logout } = useAuth();

  const userRole = user?.role ? String(user.role).toLowerCase() : 'guest';
  const isSuperadmin = userRole === 'superadmin';
  const isLocalAdmin = userRole === 'admin';

  // Permisos de módulos según rol base + capacidades duales de Mi Cuenta
  const canSeeResident =
    isSuperadmin ||
    userRole === 'owner' ||
    userRole === 'family' ||
    userRole === 'resident' ||
    Boolean(user?.can_use_resident);
  const canSeeProvider =
    isSuperadmin || userRole === 'provider' || Boolean(user?.can_use_provider);
  const canSeePayments = canSeeResident;
  const canSeeSecurity = isSuperadmin || userRole === 'security';

  // Vista activa inicial según rol base y Portal Principal configurable
  const getDefaultAuthenticatedView = (targetUser) => {
    const normalized = String(targetUser?.role || '').toLowerCase();
    if (normalized === 'security') return 'security';
    if (normalized === 'admin') return 'local_admin';

    const preferred = String(targetUser?.primary_portal || '').toLowerCase();
    const hasProvider =
      normalized === 'superadmin' ||
      normalized === 'provider' ||
      Boolean(targetUser?.can_use_provider);
    const hasResident =
      normalized === 'superadmin' ||
      normalized === 'owner' ||
      normalized === 'family' ||
      normalized === 'resident' ||
      Boolean(targetUser?.can_use_resident);

    if (preferred === 'provider' && hasProvider) return 'provider';
    if (preferred === 'resident' && hasResident) return 'resident';
    if (normalized === 'provider') return 'provider';
    return 'resident';
  };

  const [currentView, setCurrentView] = useState(
    isAuthenticated ? getDefaultAuthenticatedView(user) : 'landing'
  );
  const [masterModeOpen, setMasterModeOpen] = useState(false);

  // Sincroniza la vista cuando cambia la sesión (login / logout)
  useEffect(() => {
    if (!isAuthenticated) {
      setCurrentView('landing');
      setMasterModeOpen(false);
    } else {
      setCurrentView((prev) =>
        prev === 'landing' || prev === 'login' || prev === 'register'
          ? getDefaultAuthenticatedView(user)
          : prev
      );
    }
  }, [isAuthenticated, user]);

  // Cierra sesión y vuelve a la vista pública
  const handleLogout = () => {
    logout();
    setMasterModeOpen(false);
    setCurrentView('landing');
  };

  // Nombre legible del usuario logueado para web y celular
  const displayUserName =
    user?.first_name ||
    user?.name ||
    (user?.email ? user.email.split('@')[0] : '') ||
    'Usuario';

  // Identidad de marca en la barra superior
  const displayBrandName = (brand?.brandName || brand?.name || 'TrustLink').trim() || 'TrustLink';
  const displayBrandBadge = (brand?.brandBadge || 'Community').trim() || 'Community';
  const displayBrandSubtitle =
    (brand?.brandSubtitle || 'Red de Confianza Residencial').trim() ||
    'Red de Confianza Residencial';

  // Helper de estilo para botón de módulo activo/inactivo
  const navBtnClass = (isActive) =>
    `inline-flex items-center gap-1.5 px-2.5 py-1.5 md:px-3 rounded-xl text-[11px] md:text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
      isActive
        ? 'text-white shadow-md'
        : 'bg-black/25 hover:bg-black/35 border border-white/15 opacity-90 hover:opacity-100'
    }`;

  const navBtnStyle = (isActive) =>
    isActive ? { backgroundColor: brand?.accentColor || '#10B981' } : undefined;

  return (
    <div
      className="min-h-screen flex flex-col font-sans selection:bg-emerald-500 selection:text-white"
      style={{
        backgroundColor: brand?.platformBgColor || '#0F172A',
        color: brand?.platformTextColor || '#F1F5F9',
      }}
    >
      {/* ZONA 1: Barra de Navegación Superior (Adaptable Web y Celular) */}
      <header
        className="border-b border-black/20 px-3 py-2.5 md:px-6 md:py-3 sticky top-0 z-40 shadow-lg"
        style={{
          backgroundColor: brand?.menuBgColor || '#020617',
          color: brand?.menuTextColor || '#E2E8F0',
        }}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4">
          {/* Fila superior en móvil / Izquierda en web: Marca + Identidad del Usuario Logueado */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            {/* Marca / Logo */}
            <button
              type="button"
              onClick={() =>
                setCurrentView(isAuthenticated ? getDefaultAuthenticatedView(user) : 'landing')
              }
              className="flex items-center gap-2.5 cursor-pointer text-left shrink-0"
            >
              {brand?.logoUrl ? (
                <img
                  src={brand.logoUrl}
                  alt={displayBrandName}
                  className="h-8 w-auto max-w-[110px] object-contain rounded-lg shrink-0"
                />
              ) : (
                <div
                  className="w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center text-white font-black text-sm md:text-base shadow shrink-0"
                  style={{ backgroundColor: brand?.primaryColor || '#0A2540' }}
                >
                  {displayBrandName.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="leading-tight min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-sm md:text-base tracking-tight truncate max-w-[115px] sm:max-w-none">
                    {displayBrandName}
                  </span>
                  <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-black/25 font-semibold border border-white/15">
                    {displayBrandBadge}
                  </span>
                </div>
                <p className="hidden sm:block text-[10px] opacity-75 truncate">
                  {displayBrandSubtitle}
                </p>
              </div>
            </button>

            {/* En móvil (< md): Quién está logueado (acceso a Mi Cuenta) + Salir en una línea compacta */}
            <div className="flex md:hidden items-center gap-1.5 shrink-0">
              {isAuthenticated && user ? (
                <>
                  <button
                    type="button"
                    onClick={() => setCurrentView('account')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold max-w-[155px] cursor-pointer transition-all ${
                      currentView === 'account'
                        ? 'bg-emerald-600 text-white border border-emerald-400 shadow-sm'
                        : 'bg-slate-900/90 border border-emerald-500/30 text-emerald-300 hover:bg-slate-800'
                    }`}
                    title={`Mi Cuenta — ${displayUserName} (${userRole})`}
                  >
                    <User size={12} className="shrink-0" />
                    <span className="truncate">{displayUserName}</span>
                    <span className="opacity-75 font-medium text-[10px] shrink-0">
                      · Cuenta
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1 bg-rose-600 hover:bg-rose-500 text-white px-2.5 py-1 rounded-xl text-[11px] font-bold cursor-pointer shrink-0"
                    title="Cerrar sesión"
                  >
                    <LogOut size={12} />
                    <span>Salir</span>
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentView('login')}
                    className={navBtnClass(currentView === 'login')}
                    style={navBtnStyle(currentView === 'login')}
                  >
                    <LogIn size={12} /> Ingresar
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentView('register')}
                    className={navBtnClass(currentView === 'register')}
                    style={navBtnStyle(currentView === 'register')}
                  >
                    <UserPlus size={12} /> Registro
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Módulos: scroll horizontal en celular, wrap limpio en escritorio */}
          {isAuthenticated && (
            <nav
              aria-label="Navegación principal"
              className="flex items-center gap-1.5 overflow-x-auto md:flex-wrap py-0.5 md:py-0"
            >
              {canSeeResident && (
                <button
                  type="button"
                  onClick={() => setCurrentView('resident')}
                  className={navBtnClass(currentView === 'resident')}
                  style={navBtnStyle(currentView === 'resident')}
                >
                  <Home size={13} /> Portal Residente
                </button>
              )}

              {canSeeProvider && (
                <button
                  type="button"
                  onClick={() => setCurrentView('provider')}
                  className={navBtnClass(currentView === 'provider')}
                  style={navBtnStyle(currentView === 'provider')}
                >
                  <Wrench size={13} /> Portal Prestador
                </button>
              )}

              {canSeePayments && (
                <button
                  type="button"
                  onClick={() => setCurrentView('payments')}
                  className={navBtnClass(currentView === 'payments')}
                  style={navBtnStyle(currentView === 'payments')}
                >
                  <CreditCard size={13} /> Pagos y Reseñas
                </button>
              )}

              {canSeeSecurity && (
                <button
                  type="button"
                  onClick={() => setCurrentView('security')}
                  className={navBtnClass(currentView === 'security')}
                  style={navBtnStyle(currentView === 'security')}
                >
                  <QrCode size={13} /> Consola Garita
                </button>
              )}

              {isLocalAdmin && (
                <button
                  type="button"
                  onClick={() => setCurrentView('local_admin')}
                  className={navBtnClass(currentView === 'local_admin')}
                  style={
                    currentView === 'local_admin' ? { backgroundColor: '#D97706' } : undefined
                  }
                >
                  <ShieldAlert size={13} /> Vista Admin Barrio
                </button>
              )}

              {isSuperadmin && (
                <button
                  type="button"
                  onClick={() => setMasterModeOpen((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 md:px-3 rounded-xl text-[11px] md:text-xs font-bold whitespace-nowrap shrink-0 border transition-all cursor-pointer ${
                    masterModeOpen ||
                    [
                      'admin',
                      'local_admin',
                      'users_master',
                      'branding_master',
                      'health',
                    ].includes(currentView)
                      ? 'bg-purple-700 text-white border-purple-400 shadow-md'
                      : 'bg-purple-950/80 text-purple-200 border-purple-700/70 hover:bg-purple-900'
                  }`}
                >
                  <Layers size={13} /> Modo Maestro
                </button>
              )}
            </nav>
          )}

          {/* En escritorio (>= md): Quién está logueado (acceso a Mi Cuenta) + Salir */}
          <div className="hidden md:flex items-center gap-2.5 shrink-0">
            {isAuthenticated && user ? (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentView('account')}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs shadow-sm cursor-pointer transition-all ${
                    currentView === 'account'
                      ? 'bg-emerald-600 text-white border border-emerald-400'
                      : 'bg-slate-900/90 border border-slate-700/80 hover:border-emerald-500/50'
                  }`}
                  title={`Abrir Mi Cuenta (${displayUserName} · ${userRole})`}
                >
                  <span className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0">
                    <User size={12} />
                  </span>
                  <span
                    className={`font-bold ${
                      currentView === 'account' ? 'text-white' : 'text-emerald-300'
                    }`}
                  >
                    {displayUserName}
                  </span>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${
                      currentView === 'account'
                        ? 'bg-black/20 text-white border-white/25'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    Mi Cuenta
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white border border-rose-500/50 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
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
                  className={navBtnClass(currentView === 'login')}
                  style={navBtnStyle(currentView === 'login')}
                >
                  <LogIn size={13} /> Iniciar Sesión
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView('register')}
                  className={navBtnClass(currentView === 'register')}
                  style={navBtnStyle(currentView === 'register')}
                >
                  <UserPlus size={13} /> Registrarse
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ZONA 2: Sub-menú de Gobernanza Central Superadmin (Modo Maestro) */}
      {isAuthenticated && isSuperadmin && masterModeOpen && (
        <div
          className="border-b border-black/20 px-3 py-2 md:px-6"
          style={{
            backgroundColor: brand?.submenuBgColor || '#090D16',
            color: brand?.submenuTextColor || '#CBD5E1',
          }}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 overflow-x-auto md:flex-wrap text-xs">
            <span className="font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">
              <Layers size={13} /> Gobernanza Central Superadmin
            </span>

            <div className="flex items-center gap-1.5 md:flex-wrap shrink-0">
              <button
                type="button"
                onClick={() => setCurrentView('admin')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] md:text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  currentView === 'admin'
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-400/50'
                    : 'bg-black/25 hover:bg-black/35 border border-white/15'
                }`}
              >
                <UserCheck size={12} /> Compliance Prestadores
              </button>

              <button
                type="button"
                onClick={() => setCurrentView('local_admin')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] md:text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  currentView === 'local_admin'
                    ? 'bg-amber-600 text-white ring-2 ring-amber-400/50'
                    : 'bg-black/25 hover:bg-black/35 border border-white/15'
                }`}
              >
                <ShieldAlert size={12} /> Vista Admin Barrio
              </button>

              <button
                type="button"
                onClick={() => setCurrentView('users_master')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] md:text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  currentView === 'users_master'
                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-400/50'
                    : 'bg-black/25 hover:bg-black/35 border border-white/15'
                }`}
              >
                <Users size={12} /> Cuentas Privilegiadas
              </button>

              <button
                type="button"
                onClick={() => setCurrentView('branding_master')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] md:text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  currentView === 'branding_master'
                    ? 'bg-pink-600 text-white ring-2 ring-pink-400/50'
                    : 'bg-black/25 hover:bg-black/35 border border-white/15'
                }`}
              >
                <Palette size={12} /> Colores / Marca
              </button>

              <button
                type="button"
                onClick={() => setCurrentView('health')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] md:text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  currentView === 'health'
                    ? 'bg-sky-600 text-white ring-2 ring-sky-400/50'
                    : 'bg-black/25 hover:bg-black/35 border border-white/15'
                }`}
              >
                <Activity size={12} /> Salud &amp; APIs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ZONA 3: Contenedor Principal de Vistas */}
      <main className="flex-1 flex flex-col">
        {currentView === 'landing' && (
          <LandingHome
            onGoLogin={() => setCurrentView('login')}
            onGoRegister={() => setCurrentView('register')}
            onViewChange={setCurrentView}
          />
        )}

        {currentView === 'login' && (
          <LoginView
            onLoginSuccess={(loggedInUser) => {
              setCurrentView(getDefaultAuthenticatedView(loggedInUser));
            }}
            onViewChange={setCurrentView}
          />
        )}

        {currentView === 'register' && (
          <RegisterView
            onRegisterSuccess={() => setCurrentView('login')}
            onViewChange={setCurrentView}
          />
        )}

        {isAuthenticated && currentView === 'account' && (
          <AccountView onNavigate={setCurrentView} />
        )}

        {currentView === 'resident' && (
          <ResidentDashboard onNavigate={setCurrentView} onViewChange={setCurrentView} />
        )}

        {currentView === 'provider' && <ProviderDashboard onViewChange={setCurrentView} />}

        {currentView === 'payments' && <ContractPaymentView onViewChange={setCurrentView} />}

        {currentView === 'security' && <SecurityScanner />}

        {isSuperadmin && currentView === 'admin' && <AdminComplianceView />}

        {(isSuperadmin || isLocalAdmin) && currentView === 'local_admin' && <LocalAdminView />}

        {isSuperadmin && currentView === 'users_master' && <UserManagementView />}

        {isSuperadmin && currentView === 'branding_master' && <BrandingSettingsView />}

        {isSuperadmin && currentView === 'health' && (
          <SystemHealthDashboard onNavigate={setCurrentView} />
        )}
      </main>

      {/* ZONA 6: Footer Institucional Único */}
      <footer
        className="border-t border-black/20 py-3 px-4 md:px-6 text-center text-xs w-full mt-auto"
        style={{
          backgroundColor: brand?.footerBgColor || brand?.menuBgColor || '#020617',
          color: brand?.footerTextColor || brand?.menuTextColor || '#94A3B8',
        }}
      >
        TrustLink Community Network — Nodo Central de Validación Perimetral y Compliance © 2026
      </footer>
    </div>
  );
}

/**
 * Componente raíz que envuelve la aplicación con BrandingProvider y AuthProvider.
 */
export default function App() {
  return (
    <BrandingProvider>
      <AuthProvider>
        <MainAppContent />
      </AuthProvider>
    </BrandingProvider>
  );
}