/**
 * @file App.jsx
 * @description Enrutador y orquestador principal de TrustLink Web con control de sesión global (AuthContext),
 * marca blanca por zonas (BrandingContext), navegación adaptable a web y celular,
 * e identidad de usuario logueado visible y clara en la barra superior.
 * @location /trustlink-web/src/App.jsx
 */

import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  Home,
  Wrench,
  QrCode,
  LogOut,
  LogIn,
  UserPlus,
  User,
  Layers,
  UserCheck,
  ShieldAlert,
  ShieldCheck,
  Users,
  Building2,
  BarChart3,
  ClipboardList,
  Activity,
  ChevronDown,
} from 'lucide-react';

import { BrandingProvider, useBranding } from './modules/branding/BrandingContext';
import { AuthProvider, useAuth } from './modules/auth/AuthContext';

// Carga diferida (code-splitting) de cada módulo para reducir el bundle inicial
const LandingHome = lazy(() => import('./modules/landing/LandingHome'));
const LoginView = lazy(() => import('./modules/auth/LoginView'));
const RegisterView = lazy(() => import('./modules/auth/RegisterView'));
const AccountView = lazy(() => import('./modules/auth/AccountView'));
const ResidentDashboard = lazy(() => import('./modules/owner/ResidentDashboard'));
const ProviderDashboard = lazy(() => import('./modules/provider/ProviderDashboard'));
const SecurityScanner = lazy(() => import('./modules/security/SecurityScanner'));
const AnalyticsDashboardView = lazy(() => import('./modules/admin/AnalyticsDashboardView'));
const AdminComplianceView = lazy(() => import('./modules/admin/AdminComplianceView'));
const LocalAdminView = lazy(() => import('./modules/admin/LocalAdminView'));
const CommunitiesAdminView = lazy(() => import('./modules/admin/CommunitiesAdminView'));
const UserManagementView = lazy(() => import('./modules/admin/UserManagementView'));
const AuditView = lazy(() => import('./modules/admin/AuditView'));
const SystemHealthDashboard = lazy(() => import('./modules/admin/SystemHealthDashboard'));

// Conjunto de vistas permitidas para sincronización con el hash de la URL (#vista)
const VALID_VIEWS = new Set([
  'landing',
  'login',
  'register',
  'account',
  'resident',
  'provider',
  'payments',
  'security',
  'metrics',
  'admin',
  'local_admin',
  'users_master',
  'audit',
  'branding_master',
  'health',
]);

// Subconjunto de vistas de Administración Global que despliegan el sub-menú
const MASTER_VIEWS = new Set([
  'metrics',
  'admin',
  'local_admin',
  'users_master',
  'audit',
  'branding_master',
  'health',
]);

/**
 * Lee un token de pase QR enviado en los query params iniciales (`?qr_token=` o `?token=`).
 * Permite abrir enlaces directos de garita y pre-cargar el escáner tras autenticar.
 * @returns {string} Token recortado o cadena vacía si no está presente.
 */
function readInitialQrTokenFromUrl() {
  if (typeof window === 'undefined') return '';
  try {
    const params = new URLSearchParams(window.location.search);
    return (params.get('qr_token') || params.get('token') || '').trim();
  } catch {
    return '';
  }
}

/**
 * Extrae y valida el identificador de vista presente en `window.location.hash` (ej. `#resident`).
 * @returns {string} Identificador de vista válido según `VALID_VIEWS` o cadena vacía.
 */
function readViewFromHash() {
  if (typeof window === 'undefined') return '';
  const raw = String(window.location.hash || '').replace(/^#\/?/, '').trim();
  return VALID_VIEWS.has(raw) ? raw : '';
}

/**
 * Detecta si la URL actual incluye parámetros de retorno de Mercado Pago Checkout Pro
 * (`?mp_status=` o `?collection_status=`) para abrir directamente el Paso 4 de Pagos.
 * @returns {boolean} `true` si la URL corresponde a un retorno de pasarela de pagos.
 */
function hasMpReturnParams() {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return Boolean(params.get('mp_status') || params.get('collection_status'));
  } catch {
    return false;
  }
}

/**
 * Contenido principal de la aplicación con acceso a BrandingContext y AuthContext.
 * Orquesta los permisos por rol/portal, la navegación vía hash/History API,
 * la barra superior adaptable, el sub-menú de Modo Maestro y la carga diferida de vistas.
 */
function MainAppContent() {
  const { brand } = useBranding();
  const { user, isAuthenticated, logout } = useAuth();

  // Normalización del rol base del usuario autenticado
  const userRole = user?.role ? String(user.role).toLowerCase() : 'guest';
  const isSuperadmin = userRole === 'superadmin';
  const isLocalAdmin = userRole === 'admin';

  // Permisos de módulos según capacidades reales de la cuenta (can_use_resident / can_use_provider)
  // manteniendo compatibilidad con sesiones previas y acceso total para superadmin.
  const canSeeResident =
    isSuperadmin ||
    (user?.can_use_resident !== undefined
      ? Boolean(user.can_use_resident)
      : userRole === 'owner' || userRole === 'family' || userRole === 'resident');
  const canSeeProvider =
    isSuperadmin ||
    (user?.can_use_provider !== undefined
      ? Boolean(user.can_use_provider)
      : userRole === 'provider');
  const canSeeSecurity = isSuperadmin || userRole === 'security';

  /**
   * Resuelve la vista inicial por defecto de un usuario autenticado según rol privilegiado,
   * portales habilitados (`can_use_resident` / `can_use_provider`) y preferencia `primary_portal`.
   * @param {object|null} targetUser - Perfil de usuario recién autenticado o persistido.
   * @returns {string} Identificador de la vista destino.
   */
  const getDefaultAuthenticatedView = (targetUser) => {
    const normalized = String(targetUser?.role || '').toLowerCase();
    if (normalized === 'security') return 'security';
    if (normalized === 'admin') return 'local_admin';

    const preferred = String(targetUser?.primary_portal || '').toLowerCase();
    const hasProvider =
      normalized === 'superadmin' ||
      (targetUser?.can_use_provider !== undefined
        ? Boolean(targetUser.can_use_provider)
        : normalized === 'provider');
    const hasResident =
      normalized === 'superadmin' ||
      (targetUser?.can_use_resident !== undefined
        ? Boolean(targetUser.can_use_resident)
        : ['owner', 'family', 'resident'].includes(normalized));

    if (preferred === 'provider' && hasProvider) return 'provider';
    if (preferred === 'resident' && hasResident) return 'resident';
    if (hasProvider && !hasResident) return 'provider';
    if (hasResident) return 'resident';
    return 'account';
  };

  // Token QR inicial capturado desde la URL (si la garita abrió un enlace directo)
  const [initialQrToken, setInitialQrToken] = useState(() => readInitialQrTokenFromUrl());
  // Paso inicial opcional del Portal Residente (ej. 'payments' al ingresar por /#payments o retorno de Mercado Pago)
  const [residentInitialStep, setResidentInitialStep] = useState(() =>
    readViewFromHash() === 'payments' || hasMpReturnParams() ? 'payments' : null
  );

  // Vista activa inicial: unifica alias heredado `#payments` hacia `#resident` (Paso 4)
  const [currentView, setCurrentViewState] = useState(() => {
    const hashView = readViewFromHash();
    if (!isAuthenticated) {
      if (readInitialQrTokenFromUrl()) return 'login';
      return hashView === 'login' || hashView === 'register' ? hashView : 'landing';
    }
    if (readInitialQrTokenFromUrl() && canSeeSecurity) return 'security';
    if (hashView === 'payments' || hasMpReturnParams()) {
      return canSeeResident ? 'resident' : getDefaultAuthenticatedView(user);
    }
    return hashView || getDefaultAuthenticatedView(user);
  });
  // Estado desplegable de la sub-barra de Gobernanza Central (Modo Maestro)
  const [masterModeOpen, setMasterModeOpen] = useState(() =>
    MASTER_VIEWS.has(readViewFromHash())
  );

  /**
   * Cambia la vista activa y actualiza el historial del navegador normalizando el pathname a `/`
   * y reflejando la ruta como hash (`/#<vista>`) sin provocar recargas.
   * Mantiene compatibilidad redirigiendo el alias heredado `payments` al Paso 4 de `resident`.
   * @param {string|((prev: string) => string)} nextOrUpdater - Nueva vista o función actualizadora.
   */
  const setCurrentView = useCallback((nextOrUpdater) => {
    setCurrentViewState((prev) => {
      const requested = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev) : nextOrUpdater;
      const isLegacyPayments = requested === 'payments';
      const next = isLegacyPayments ? 'resident' : requested;
      if (isLegacyPayments) {
        setResidentInitialStep('payments');
      }
      if (typeof window !== 'undefined' && next && VALID_VIEWS.has(next)) {
        const targetHash = `#${next}`;
        const cleanPath = '/';
        if (window.location.hash !== targetHash || window.location.pathname !== cleanPath) {
          window.history.pushState({ view: next }, '', `${cleanPath}${window.location.search}${targetHash}`);
        }
      }
      return next;
    });
  }, []);

  /**
   * Limpia el token QR inicial tanto del estado React como de los query params de la URL
   * para evitar re-validaciones accidentales al recargar o navegar.
   */
  const clearInitialQrToken = useCallback(() => {
    setInitialQrToken('');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('qr_token');
      url.searchParams.delete('token');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
  }, []);

  // Normaliza pathname heredado (ej. /admin/superadmin/config#account -> /#account) y alias #payments -> #resident al montar
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isLegacyHash = readViewFromHash() === 'payments';
    if (window.location.pathname !== '/' || (isAuthenticated && isLegacyHash)) {
      const targetHash = isLegacyHash ? '#resident' : window.location.hash || `#${currentView}`;
      window.history.replaceState(null, '', `/${window.location.search}${targetHash}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Soporte para botón Atrás/Adelante del navegador vía evento popstate y hash
  useEffect(() => {
    /**
     * Sincroniza la vista activa y cualquier `?qr_token=` presente al navegar por el historial.
     * Si el hash corresponde al alias heredado `#payments`, redirige al Paso 4 de `resident`.
     */
    const onPopState = () => {
      const tokenFromUrl = readInitialQrTokenFromUrl();
      if (tokenFromUrl) {
        setInitialQrToken(tokenFromUrl);
      }
      const hashView = readViewFromHash();
      if (hashView === 'payments') {
        setResidentInitialStep('payments');
        setCurrentViewState('resident');
      } else if (hashView) {
        setCurrentViewState(hashView);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Sincroniza la vista cuando cambia la sesión (login / logout), llegan permisos nuevos o llega un ?qr_token=
  useEffect(() => {
    if (!isAuthenticated) {
      setCurrentViewState((prev) =>
        initialQrToken ? 'login' : prev === 'login' || prev === 'register' ? prev : 'landing'
      );
      setMasterModeOpen(false);
    } else if (initialQrToken && canSeeSecurity) {
      setCurrentView('security');
    } else {
      setCurrentViewState((prev) => {
        if (prev === 'landing' || prev === 'login' || prev === 'register') {
          return getDefaultAuthenticatedView(user);
        }
        if ((prev === 'resident' || prev === 'payments') && !canSeeResident) {
          return getDefaultAuthenticatedView(user);
        }
        if (prev === 'provider' && !canSeeProvider) {
          return getDefaultAuthenticatedView(user);
        }
        return prev;
      });
    }
  }, [isAuthenticated, user, initialQrToken, canSeeSecurity, canSeeResident, canSeeProvider, setCurrentView]);

  // Sincroniza la sub-barra de Administración: se abre en vistas admin y se repliega al cambiar a otro portal/cuenta
  useEffect(() => {
    if (isAuthenticated && isSuperadmin) {
      setMasterModeOpen(MASTER_VIEWS.has(currentView));
    }
  }, [isAuthenticated, isSuperadmin, currentView]);

  /**
   * Cierra la sesión global, repliega el menú de Administración y regresa a la portada pública.
   */
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

  // Detecta tema oscuro vs. claro para adaptar bordes, hover y acentos suaves en toda la barra superior
  const isDarkTheme = brand?.darkMode !== false;
  const isMasterViewActive = MASTER_VIEWS.has(currentView);

  /**
   * Devuelve las clases Tailwind sobrias (*soft tinted*) para botones de navegación en Zona 1 y Zona 2,
   * evitando colores neón y garantizando legibilidad tanto en presets Dark como Light.
   * @param {boolean} isActive - Indica si corresponde a la vista activa.
   * @param {boolean} [isExpanded=false] - Indica si un menú desplegable está abierto sin vista activa dentro.
   * @returns {string}
   */
  const navBtnClass = (isActive, isExpanded = false) => {
    const base =
      'inline-flex items-center gap-1.5 px-2.5 py-1.5 md:px-3 rounded-xl text-[11px] md:text-xs font-semibold whitespace-nowrap shrink-0 border transition-all cursor-pointer';
    if (isActive) {
      return `${base} font-bold ${
        isDarkTheme
          ? 'bg-indigo-500/20 text-indigo-100 border-indigo-400/50 shadow-xs'
          : 'bg-indigo-600/12 text-indigo-950 border-indigo-500/40 shadow-xs'
      }`;
    }
    if (isExpanded) {
      return `${base} ${
        isDarkTheme
          ? 'bg-white/8 border-white/20 opacity-100'
          : 'bg-black/6 border-black/15 opacity-100'
      }`;
    }
    return `${base} border-transparent ${
      isDarkTheme
        ? 'bg-transparent hover:bg-white/8 hover:border-white/12 opacity-80 hover:opacity-100'
        : 'bg-transparent hover:bg-black/6 hover:border-black/12 opacity-80 hover:opacity-100'
    }`;
  };

  // Clases sobrias para el botón `Salir`: atenuado en reposo, rojo sutil solo en hover/focus
  const logoutBtnClass = isDarkTheme
    ? 'bg-transparent border-white/12 opacity-65 hover:opacity-100 hover:bg-rose-500/15 hover:text-rose-200 hover:border-rose-400/45 focus-visible:opacity-100 focus-visible:bg-rose-500/15 focus-visible:text-rose-200'
    : 'bg-transparent border-black/12 opacity-65 hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-700 hover:border-rose-400/50 focus-visible:opacity-100 focus-visible:bg-rose-500/10 focus-visible:text-rose-700';

  // Clases adaptables al tema para el botón `Mi Cuenta`
  const accountBtnClass = (isActive) =>
    isActive
      ? isDarkTheme
        ? 'bg-indigo-500/20 text-indigo-100 border-indigo-400/50 shadow-xs'
        : 'bg-indigo-600/12 text-indigo-950 border-indigo-500/40 shadow-xs'
      : isDarkTheme
        ? 'bg-white/5 hover:bg-white/10 border-white/12 opacity-90 hover:opacity-100'
        : 'bg-black/5 hover:bg-black/8 border-black/12 opacity-90 hover:opacity-100';

  return (
    <div
      className="min-h-screen flex flex-col font-sans selection:bg-emerald-500 selection:text-white"
      style={{
        backgroundColor: brand?.platformBgColor || '#0F172A',
        color: brand?.platformTextColor || '#F1F5F9',
      }}
    >
      {/* ZONA 1: Barra de Navegación Superior (Adaptable Web y Celular, Dark y Light) */}
      <header
        className={`border-b px-4 sm:px-6 py-2.5 md:py-3 sticky top-0 z-40 shadow-sm ${
          isDarkTheme ? 'border-white/10' : 'border-black/10'
        }`}
        style={{
          backgroundColor: brand?.menuBgColor || '#020617',
          color: brand?.menuTextColor || '#E2E8F0',
        }}
      >
        <div className="max-w-6xl w-full mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4">
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
                  className="h-8 w-auto max-w-27.5 object-contain rounded-lg shrink-0"
                />
              ) : (
                <div
                  className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-emerald-600/90 text-white flex items-center justify-center shadow-xs shrink-0"
                  aria-hidden="true"
                >
                  <ShieldCheck size={18} />
                </div>
              )}

              <div className="leading-tight min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-sm md:text-base tracking-tight truncate max-w-28.75 sm:max-w-none">
                    {displayBrandName}
                  </span>
                  <span
                    className={`hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                      isDarkTheme
                        ? 'bg-white/8 border-white/12 opacity-90'
                        : 'bg-black/6 border-black/12 opacity-85'
                    }`}
                  >
                    {displayBrandBadge}
                  </span>
                </div>
                <p className="hidden sm:block text-[10px] opacity-70 truncate">
                  {displayBrandSubtitle}
                </p>
              </div>
            </button>

            {/* En móvil (< md): Quién está logueado (acceso a Mi Cuenta) + Salir atenuado */}
            <div className="flex md:hidden items-center gap-1.5 shrink-0">
              {isAuthenticated && user ? (
                <>
                  <button
                    type="button"
                    onClick={() => setCurrentView('account')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold border max-w-38.75 cursor-pointer transition-all ${accountBtnClass(
                      currentView === 'account'
                    )}`}
                    title={`Mi Cuenta — ${displayUserName} (${userRole})`}
                  >
                    <User size={12} className="shrink-0 opacity-80" />
                    <span className="truncate">{displayUserName}</span>
                    <span className="opacity-70 font-medium text-[10px] shrink-0">
                      · Cuenta
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-all cursor-pointer shrink-0 ${logoutBtnClass}`}
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
                  >
                    <LogIn size={12} /> Ingresar
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentView('register')}
                    className={navBtnClass(true)}
                  >
                    <UserPlus size={12} /> Registro
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Módulos: una sola línea limpia en escritorio y scroll horizontal en celular */}
          {isAuthenticated && (
            <nav
              aria-label="Navegación principal"
              className="flex items-center gap-1 overflow-x-auto flex-nowrap py-0.5 md:py-0"
            >
              {canSeeResident && (
                <button
                  type="button"
                  onClick={() => setCurrentView('resident')}
                  className={navBtnClass(currentView === 'resident')}
                  title="Portal Residente"
                >
                  <Home size={13} /> {isSuperadmin ? 'Residente' : 'Portal Residente'}
                </button>
              )}

              {canSeeProvider && (
                <button
                  type="button"
                  onClick={() => setCurrentView('provider')}
                  className={navBtnClass(currentView === 'provider')}
                  title="Portal Prestador"
                >
                  <Wrench size={13} /> {isSuperadmin ? 'Prestador' : 'Portal Prestador'}
                </button>
              )}

              {canSeeSecurity && (
                <button
                  type="button"
                  onClick={() => setCurrentView('security')}
                  className={navBtnClass(currentView === 'security')}
                  title="Consola Garita"
                >
                  <QrCode size={13} /> {isSuperadmin ? 'Garita' : 'Consola Garita'}
                </button>
              )}

              {isLocalAdmin && (
                <button
                  type="button"
                  onClick={() => setCurrentView('local_admin')}
                  className={navBtnClass(currentView === 'local_admin')}
                >
                  <ShieldAlert size={13} /> Admin Barrio
                </button>
              )}

              {isSuperadmin && (
                <button
                  type="button"
                  onClick={() => setMasterModeOpen((prev) => !prev)}
                  aria-expanded={masterModeOpen}
                  className={navBtnClass(isMasterViewActive, masterModeOpen && !isMasterViewActive)}
                >
                  <Layers size={13} />
                  <span>Administración</span>
                  <ChevronDown
                    size={13}
                    className={`transition-transform opacity-75 ${masterModeOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              )}
            </nav>
          )}

          {/* En escritorio (>= md): Quién está logueado (acceso a Mi Cuenta) + separador + Salir atenuado */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            {isAuthenticated && user ? (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentView('account')}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs border cursor-pointer transition-all ${accountBtnClass(
                    currentView === 'account'
                  )}`}
                  title={`Abrir Mi Cuenta (${displayUserName} · ${userRole})`}
                >
                  <span
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                      currentView === 'account'
                        ? isDarkTheme
                          ? 'bg-indigo-400/20 border-indigo-300/40 text-indigo-200'
                          : 'bg-indigo-600/15 border-indigo-500/35 text-indigo-800'
                        : isDarkTheme
                          ? 'bg-white/10 border-white/15 opacity-85'
                          : 'bg-black/8 border-black/15 opacity-80'
                    }`}
                  >
                    <User size={11} />
                  </span>
                  <span className="font-semibold">{displayUserName}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                      isDarkTheme
                        ? 'bg-white/8 border-white/12 opacity-80'
                        : 'bg-black/6 border-black/12 opacity-75'
                    }`}
                  >
                    Mi Cuenta
                  </span>
                </button>

                <span
                  className={`h-5 w-px ${isDarkTheme ? 'bg-white/12' : 'bg-black/12'}`}
                  aria-hidden="true"
                />

                <button
                  type="button"
                  onClick={handleLogout}
                  className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${logoutBtnClass}`}
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
                >
                  <LogIn size={13} /> Iniciar Sesión
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView('register')}
                  className={navBtnClass(currentView === 'register')}
                >
                  <UserPlus size={13} /> Registrarse
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ZONA 2: Sub-menú de Administración Global (alineado a la izquierda, orden por dominio y acento sobrio) */}
      {isAuthenticated && isSuperadmin && masterModeOpen && (
        <div
          className={`border-b px-4 sm:px-6 py-2 ${
            isDarkTheme ? 'border-white/10' : 'border-black/10'
          }`}
          style={{
            backgroundColor: brand?.submenuBgColor || '#090D16',
            color: brand?.submenuTextColor || '#CBD5E1',
          }}
        >
          <nav
            aria-label="Submenú de Administración"
            className="max-w-6xl w-full mx-auto flex items-center gap-1 overflow-x-auto md:flex-wrap text-xs"
          >
            {[
              { id: 'metrics', label: 'Métricas', Icon: BarChart3 },
              { id: 'admin', label: 'Prestadores', Icon: UserCheck },
              { id: 'local_admin', label: 'Comunidades', Icon: Building2 },
              { id: 'users_master', label: 'Usuarios', Icon: Users },
              { id: 'audit', label: 'Auditoría', Icon: ClipboardList },
              { id: 'health', label: 'Sistema', Icon: Activity },
            ].map(({ id, label, Icon }) => {
              const isActive =
                currentView === id || (id === 'health' && currentView === 'branding_master');
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCurrentView(id)}
                  className={navBtnClass(isActive)}
                >
                  <Icon size={13} /> {label}
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* ZONA 3: Contenedor Principal de Vistas (carga diferida por módulo) */}
      <main className="flex-1 flex flex-col">
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center p-10 text-xs opacity-75">
              Cargando vista...
            </div>
          }
        >
        {/* Vistas públicas: portada, inicio de sesión y registro */}
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

        {/* Vista de configuración de cuenta e identidad dual */}
        {isAuthenticated && currentView === 'account' && (
          <AccountView onNavigate={setCurrentView} />
        )}

        {/* Portales operativos: Residente (flujo único de 5 pasos incl. Pagos y Reseñas), Prestador y Consola de Garita */}
        {(currentView === 'resident' || currentView === 'payments') && (
          <ResidentDashboard
            onNavigate={setCurrentView}
            onViewChange={setCurrentView}
            initialStep={currentView === 'payments' ? 'payments' : residentInitialStep}
            onConsumedInitialStep={() => setResidentInitialStep(null)}
          />
        )}

        {currentView === 'provider' && <ProviderDashboard onViewChange={setCurrentView} />}

        {currentView === 'security' && (
          <SecurityScanner
            initialToken={initialQrToken}
            onClearInitialToken={clearInitialQrToken}
          />
        )}

        {/* Vistas de Administración Global (Superadmin) y Administración Local (Admin Barrio) */}
        {isSuperadmin && currentView === 'metrics' && (
          <AnalyticsDashboardView onNavigate={setCurrentView} />
        )}

        {isSuperadmin && currentView === 'admin' && <AdminComplianceView />}

        {isSuperadmin && currentView === 'local_admin' && <CommunitiesAdminView />}

        {isLocalAdmin && currentView === 'local_admin' && <LocalAdminView />}

        {isSuperadmin && currentView === 'users_master' && <UserManagementView />}

        {isSuperadmin && currentView === 'audit' && <AuditView />}

        {isSuperadmin && (currentView === 'health' || currentView === 'branding_master') && (
          <SystemHealthDashboard
            initialTab={currentView === 'branding_master' ? 'appearance' : 'health'}
            onNavigate={setCurrentView}
          />
        )}
        </Suspense>
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