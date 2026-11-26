/**
 * @file App.jsx
 * @description Enrutador y orquestador principal de TrustLink Web con control de sesión global (AuthContext),
 * marca blanca por zonas (BrandingContext), navegación adaptable a web y celular,
 * e identidad de usuario logueado visible y clara en la barra superior.
 * @location /trustlink-web/src/App.jsx
 */

import React, { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
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
  Search,
  X,
  MapPin,
  Heart,
  FileText,
  RefreshCw,
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

  // Estado compartido con la barra superior de 2 filas (buscador global + navegación del residente + menú usuario)
  const [globalSearchQuery, setGlobalSearchQuery] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      const saved = sessionStorage.getItem('trustlink_initial_service_query');
      if (saved && saved.trim()) {
        sessionStorage.removeItem('trustlink_initial_service_query');
        return saved.trim();
      }
    } catch {
      // Ignorar si sessionStorage no está disponible
    }
    return '';
  });
  const [landingSearchSubmitNonce, setLandingSearchSubmitNonce] = useState(0);
  const [residentTab, setResidentTab] = useState(() =>
    readViewFromHash() === 'payments' || hasMpReturnParams() ? 'services' : 'providers'
  );
  const [residentFavoritesOnly, setResidentFavoritesOnly] = useState(false);
  const [residentRefreshNonce, setResidentRefreshNonce] = useState(0);
  const [residentHeaderMeta, setResidentHeaderMeta] = useState({
    providersCount: 0,
    servicesActionCount: 0,
    servicesTotalCount: 0,
    passesCount: 0,
    favoritesCount: 0,
    refreshing: false,
  });
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

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

  // Cierra el menú desplegable de usuario al hacer clic fuera o presionar Escape
  useEffect(() => {
    if (!userMenuOpen) return undefined;
    const handleOutsideClick = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [userMenuOpen]);

  /**
   * Cierra la sesión global, repliega los menús y regresa a la portada pública.
   */
  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
    setMasterModeOpen(false);
    setResidentFavoritesOnly(false);
    setResidentTab('providers');
    setGlobalSearchQuery('');
    setCurrentView('landing');
  };

  // Nombre legible e iniciales del usuario logueado para web y celular
  const displayUserName =
    user?.first_name ||
    user?.name ||
    (user?.email ? user.email.split('@')[0] : '') ||
    'Usuario';

  const displayUserFullName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || displayUserName;

  const userInitials = useMemo(() => {
    const parts = displayUserFullName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (parts[0] || 'U').slice(0, 2).toUpperCase();
  }, [displayUserFullName]);

  // Domicilio del residente para la Zona 2 (estilo "📍 En Barrio · Fracc. · Lote")
  const residentLocationLabel = useMemo(() => {
    const parts = [];
    if (user?.country_name) parts.push(user.country_name);
    if (user?.fraction_type && user.fraction_type !== 'na' && user?.fraction_number) {
      const areaPrefix = user.fraction_type === 'manzana' ? 'Mz.' : 'Fracc.';
      parts.push(`${areaPrefix} ${user.fraction_number}`);
    }
    if (user?.lot_number) parts.push(`Lote ${user.lot_number}`);
    return parts.join(' · ');
  }, [user]);

  // Portales habilitados para el usuario autenticado (permite switcher limpio en menú de usuario o barra)
  const permittedPortals = useMemo(() => {
    if (!isAuthenticated) return [];
    const list = [];
    if (canSeeResident) {
      list.push({
        id: 'resident',
        label: 'Portal Residente',
        shortLabel: isSuperadmin ? 'Residente' : 'Portal Residente',
        Icon: Home,
      });
    }
    if (canSeeProvider) {
      list.push({
        id: 'provider',
        label: 'Portal Prestador',
        shortLabel: isSuperadmin ? 'Prestador' : 'Portal Prestador',
        Icon: Wrench,
      });
    }
    if (canSeeSecurity) {
      list.push({
        id: 'security',
        label: 'Consola Garita',
        shortLabel: isSuperadmin ? 'Garita' : 'Consola Garita',
        Icon: QrCode,
      });
    }
    if (isLocalAdmin) {
      list.push({
        id: 'local_admin',
        label: 'Admin Barrio',
        shortLabel: 'Admin Barrio',
        Icon: ShieldAlert,
      });
    }
    return list;
  }, [isAuthenticated, canSeeResident, canSeeProvider, canSeeSecurity, isLocalAdmin, isSuperadmin]);

  // Identidad de marca en la barra superior
  const displayBrandName = (brand?.brandName || brand?.name || 'TrustLink').trim() || 'TrustLink';
  const displayBrandBadge = (brand?.brandBadge || 'Community').trim() || 'Community';
  const displayBrandSubtitle =
    (brand?.brandSubtitle || 'Red de Confianza Residencial').trim() ||
    'Red de Confianza Residencial';

  // Detecta tema oscuro vs. claro para adaptar bordes, hover y acentos suaves en toda la barra superior
  const isDarkTheme = brand?.darkMode !== false;
  const isMasterViewActive = MASTER_VIEWS.has(currentView);
  const isResidentView = isAuthenticated && (currentView === 'resident' || currentView === 'payments');
  const showGlobalSearch = currentView === 'landing' || isResidentView;
  const showResidentSubBar = isResidentView && !(isSuperadmin && masterModeOpen);

  /**
   * Envía el buscador protagonista de Zona 1:
   * - En Landing desplaza suavemente hacia la vidriera pública filtrada.
   * - En Portal Residente lleva al directorio de prestadores y muestra los resultados.
   */
  const handleGlobalSearchSubmit = (event) => {
    event.preventDefault();
    if (currentView === 'landing') {
      setLandingSearchSubmitNonce((prev) => prev + 1);
      return;
    }
    if (isResidentView) {
      setResidentTab('providers');
      if (residentFavoritesOnly && globalSearchQuery.trim()) {
        setResidentFavoritesOnly(false);
      }
    }
  };

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

  // Clases livianas para los enlaces planos de Zona 2 del Portal Residente (estilo barra de utilidades MeLi)
  const subBarLinkClass = (isActive) =>
    `inline-flex items-center gap-1.5 py-1.5 px-1 text-xs font-semibold whitespace-nowrap shrink-0 border-b-2 transition-all cursor-pointer ${
      isActive
        ? isDarkTheme
          ? 'border-emerald-400 text-emerald-300 opacity-100'
          : 'border-emerald-600 text-emerald-800 opacity-100'
        : 'border-transparent opacity-75 hover:opacity-100'
    }`;

  // Clases adaptables al tema para el disparador del menú de usuario
  const accountBtnClass = (isActive) =>
    isActive
      ? isDarkTheme
        ? 'bg-indigo-500/20 text-indigo-100 border-indigo-400/50 shadow-xs'
        : 'bg-indigo-600/12 text-indigo-950 border-indigo-500/40 shadow-xs'
      : isDarkTheme
        ? 'bg-white/6 hover:bg-white/12 border-white/12 opacity-95 hover:opacity-100'
        : 'bg-black/5 hover:bg-black/10 border-black/12 opacity-95 hover:opacity-100';

  // Estilo adaptable al tema para el buscador protagonista en Zona 1
  const searchBarWrapperClass = isDarkTheme
    ? 'bg-white/10 border-white/15 focus-within:border-emerald-400/60 focus-within:bg-white/12'
    : 'bg-white border-slate-300 text-slate-900 shadow-xs focus-within:border-emerald-600';

  return (
    <div
      className="min-h-screen flex flex-col font-sans selection:bg-emerald-500 selection:text-white"
      style={{
        backgroundColor: brand?.platformBgColor || '#0F172A',
        color: brand?.platformTextColor || '#F1F5F9',
      }}
    >
      {/* ZONA 1: Barra de Navegación Superior (Fila 1: Marca · Buscador/Portales · Usuario) */}
      <header
        className={`border-b px-4 sm:px-6 py-2.5 sticky top-0 z-40 shadow-sm ${
          isDarkTheme ? 'border-white/10' : 'border-black/10'
        }`}
        style={{
          backgroundColor: brand?.menuBgColor || '#020617',
          color: brand?.menuTextColor || '#E2E8F0',
        }}
      >
        <div className="max-w-6xl w-full mx-auto flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 md:gap-4">
            {/* Izquierda: Marca / Logo */}
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen(false);
                if (isAuthenticated) {
                  const target = getDefaultAuthenticatedView(user);
                  if (target === 'resident') {
                    setResidentTab('providers');
                    setResidentFavoritesOnly(false);
                  }
                  setCurrentView(target);
                } else {
                  setCurrentView('landing');
                }
              }}
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
                    className={`hidden lg:inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                      isDarkTheme
                        ? 'bg-white/8 border-white/12 opacity-90'
                        : 'bg-black/6 border-black/12 opacity-85'
                    }`}
                  >
                    {displayBrandBadge}
                  </span>
                </div>
                <p className="hidden lg:block text-[10px] opacity-70 truncate">
                  {displayBrandSubtitle}
                </p>
              </div>
            </button>

            {/* Centro (escritorio): Buscador protagonista (Landing/Residente) o Switcher de Portales (vistas operativas) */}
            {showGlobalSearch ? (
              <form
                onSubmit={handleGlobalSearchSubmit}
                role="search"
                className="hidden md:flex flex-1 max-w-xl mx-2"
              >
                <div
                  className={`flex items-center w-full rounded-xl border px-3 py-1.5 gap-2 transition-all ${searchBarWrapperClass}`}
                >
                  <input
                    type="text"
                    value={globalSearchQuery}
                    onChange={(e) => {
                      const nextVal = e.target.value;
                      setGlobalSearchQuery(nextVal);
                      if (isResidentView && residentTab !== 'providers' && nextVal.trim()) {
                        setResidentTab('providers');
                      }
                    }}
                    placeholder="¿Qué necesitás resolver? Ej: pérdida de agua, electricista..."
                    aria-label="Buscar prestadores, rubros o problemas"
                    className="w-full bg-transparent text-xs md:text-sm focus:outline-none placeholder:opacity-65"
                  />
                  {globalSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setGlobalSearchQuery('')}
                      aria-label="Limpiar búsqueda"
                      className="p-1 rounded-lg opacity-65 hover:opacity-100 cursor-pointer shrink-0"
                    >
                      <X size={14} />
                    </button>
                  )}
                  <span
                    className={`h-4 w-px shrink-0 ${isDarkTheme ? 'bg-white/15' : 'bg-slate-300'}`}
                    aria-hidden="true"
                  />
                  <button
                    type="submit"
                    aria-label="Buscar"
                    className="p-1 rounded-lg opacity-75 hover:opacity-100 cursor-pointer shrink-0"
                    title="Buscar prestadores"
                  >
                    <Search size={15} />
                  </button>
                </div>
              </form>
            ) : (
              isAuthenticated &&
              (permittedPortals.length > 1 || isSuperadmin) && (
                <nav
                  aria-label="Navegación principal"
                  className="hidden md:flex items-center gap-1 overflow-x-auto flex-nowrap"
                >
                  {permittedPortals.map(({ id, shortLabel, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setCurrentView(id)}
                      className={navBtnClass(currentView === id)}
                      title={label}
                    >
                      <Icon size={13} /> {shortLabel}
                    </button>
                  ))}

                  {isSuperadmin && (
                    <button
                      type="button"
                      onClick={() => setMasterModeOpen((prev) => !prev)}
                      aria-expanded={masterModeOpen}
                      className={navBtnClass(
                        isMasterViewActive,
                        masterModeOpen && !isMasterViewActive
                      )}
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
              )
            )}

            {/* Derecha: Acceso Admin rápido (solo Superadmin en vista buscador) + Menú único de Usuario o Auth */}
            <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
              {isAuthenticated && user ? (
                <>
                  {showGlobalSearch && isSuperadmin && (
                    <button
                      type="button"
                      onClick={() => setMasterModeOpen((prev) => !prev)}
                      aria-expanded={masterModeOpen}
                      className={`hidden sm:inline-flex ${navBtnClass(
                        isMasterViewActive,
                        masterModeOpen && !isMasterViewActive
                      )}`}
                      title="Abrir submenú de Administración Global"
                    >
                      <Layers size={13} />
                      <span className="hidden lg:inline">Administración</span>
                      <ChevronDown
                        size={12}
                        className={`transition-transform opacity-75 ${masterModeOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                  )}

                  {/* Menú desplegable único del usuario: reemplaza [Mi Cuenta] | [Salir] */}
                  <div className="relative" ref={userMenuRef}>
                    <button
                      type="button"
                      onClick={() => setUserMenuOpen((prev) => !prev)}
                      aria-expanded={userMenuOpen}
                      aria-haspopup="menu"
                      className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs border cursor-pointer transition-all ${accountBtnClass(
                        userMenuOpen || currentView === 'account'
                      )}`}
                      title={`Menú de ${displayUserFullName}`}
                    >
                      <span
                        className={`w-6 h-6 rounded-full text-[10px] font-extrabold flex items-center justify-center shrink-0 border ${
                          isDarkTheme
                            ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                            : 'bg-emerald-600/15 border-emerald-600/35 text-emerald-800'
                        }`}
                      >
                        {userInitials}
                      </span>
                      <span className="font-semibold max-w-28 truncate">{displayUserName}</span>
                      <ChevronDown
                        size={13}
                        className={`opacity-75 transition-transform shrink-0 ${
                          userMenuOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {userMenuOpen && (
                      <div
                        role="menu"
                        className={`absolute right-0 mt-2 w-60 rounded-2xl border shadow-2xl py-1.5 z-50 ${
                          isDarkTheme ? 'border-white/15' : 'border-slate-200'
                        }`}
                        style={{
                          backgroundColor: brand?.cardBgColor || (isDarkTheme ? '#0F172A' : '#FFFFFF'),
                          color: brand?.cardTextColor || (isDarkTheme ? '#F1F5F9' : '#0F172A'),
                        }}
                      >
                        {/* Encabezado del usuario */}
                        <div
                          className={`px-3.5 py-2.5 border-b ${
                            isDarkTheme ? 'border-white/10' : 'border-slate-200'
                          }`}
                        >
                          <p className="text-xs font-extrabold truncate">{displayUserFullName}</p>
                          {user?.email && (
                            <p className="text-[11px] opacity-65 truncate mt-0.5">{user.email}</p>
                          )}
                        </div>

                        {/* Mi Cuenta y Domicilio */}
                        <div className="p-1.5">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setUserMenuOpen(false);
                              setCurrentView('account');
                            }}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-left cursor-pointer transition-colors ${
                              currentView === 'account'
                                ? isDarkTheme
                                  ? 'bg-indigo-500/20 text-indigo-200'
                                  : 'bg-indigo-50 text-indigo-900'
                                : isDarkTheme
                                  ? 'hover:bg-white/8'
                                  : 'hover:bg-slate-100'
                            }`}
                          >
                            <User size={14} className="opacity-80 shrink-0" />
                            <span>Mi Cuenta y Domicilio</span>
                          </button>
                        </div>

                        {/* Cambio rápido de portal (solo si la cuenta tiene más de un portal habilitado) */}
                        {(permittedPortals.length > 1 || isSuperadmin) && (
                          <div
                            className={`px-1.5 py-1.5 border-t ${
                              isDarkTheme ? 'border-white/10' : 'border-slate-200'
                            }`}
                          >
                            <p className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider opacity-55">
                              Cambiar de portal
                            </p>
                            {permittedPortals.map(({ id, label, Icon }) => {
                              const isActivePortal =
                                currentView === id || (id === 'resident' && currentView === 'payments');
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setUserMenuOpen(false);
                                    setCurrentView(id);
                                  }}
                                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-left cursor-pointer transition-colors ${
                                    isActivePortal
                                      ? isDarkTheme
                                        ? 'bg-emerald-500/15 text-emerald-300'
                                        : 'bg-emerald-50 text-emerald-800'
                                      : isDarkTheme
                                        ? 'hover:bg-white/8'
                                        : 'hover:bg-slate-100'
                                  }`}
                                >
                                  <span className="flex items-center gap-2.5 truncate">
                                    <Icon size={14} className="opacity-80 shrink-0" />
                                    <span className="truncate">{label}</span>
                                  </span>
                                  {isActivePortal && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                            {isSuperadmin && (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setUserMenuOpen(false);
                                  setMasterModeOpen(true);
                                  if (!isMasterViewActive) {
                                    setCurrentView('metrics');
                                  }
                                }}
                                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-left cursor-pointer transition-colors ${
                                  isMasterViewActive
                                    ? isDarkTheme
                                      ? 'bg-indigo-500/20 text-indigo-200'
                                      : 'bg-indigo-50 text-indigo-900'
                                    : isDarkTheme
                                      ? 'hover:bg-white/8'
                                      : 'hover:bg-slate-100'
                                }`}
                              >
                                <Layers size={14} className="opacity-80 shrink-0" />
                                <span>Administración Global</span>
                              </button>
                            )}
                          </div>
                        )}

                        {/* Cerrar sesión */}
                        <div
                          className={`p-1.5 border-t ${
                            isDarkTheme ? 'border-white/10' : 'border-slate-200'
                          }`}
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={handleLogout}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-left cursor-pointer transition-colors ${
                              isDarkTheme
                                ? 'text-rose-300 hover:bg-rose-500/15'
                                : 'text-rose-700 hover:bg-rose-50'
                            }`}
                          >
                            <LogOut size={14} className="shrink-0" />
                            <span>Cerrar sesión</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-1.5 md:gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentView('login')}
                    className={navBtnClass(currentView === 'login')}
                  >
                    <LogIn size={13} />
                    <span className="hidden sm:inline">Iniciar Sesión</span>
                    <span className="sm:hidden">Ingresar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentView('register')}
                    className={navBtnClass(currentView === 'register')}
                  >
                    <UserPlus size={13} />
                    <span className="hidden sm:inline">Registrarse</span>
                    <span className="sm:hidden">Registro</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Fila móvil complementaria en Zona 1: Buscador (Landing/Residente) o Portales (multi-portal) */}
          {showGlobalSearch ? (
            <form onSubmit={handleGlobalSearchSubmit} role="search" className="flex md:hidden w-full">
              <div
                className={`flex items-center w-full rounded-xl border px-3 py-1.5 gap-2 transition-all ${searchBarWrapperClass}`}
              >
                <input
                  type="text"
                  value={globalSearchQuery}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    setGlobalSearchQuery(nextVal);
                    if (isResidentView && residentTab !== 'providers' && nextVal.trim()) {
                      setResidentTab('providers');
                    }
                  }}
                  placeholder="¿Qué necesitás resolver? Ej: plomero, electricista..."
                  aria-label="Buscar prestadores, rubros o problemas"
                  className="w-full bg-transparent text-xs focus:outline-none placeholder:opacity-65"
                />
                {globalSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setGlobalSearchQuery('')}
                    aria-label="Limpiar búsqueda"
                    className="p-1 rounded-lg opacity-65 hover:opacity-100 cursor-pointer shrink-0"
                  >
                    <X size={13} />
                  </button>
                )}
                <button
                  type="submit"
                  aria-label="Buscar"
                  className="p-1 rounded-lg opacity-75 hover:opacity-100 cursor-pointer shrink-0"
                >
                  <Search size={14} />
                </button>
              </div>
            </form>
          ) : (
            isAuthenticated &&
            (permittedPortals.length > 1 || isSuperadmin) && (
              <nav
                aria-label="Navegación principal móvil"
                className="flex md:hidden items-center gap-1 overflow-x-auto flex-nowrap py-0.5"
              >
                {permittedPortals.map(({ id, shortLabel, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCurrentView(id)}
                    className={navBtnClass(currentView === id)}
                  >
                    <Icon size={13} /> {shortLabel}
                  </button>
                ))}
                {isSuperadmin && (
                  <button
                    type="button"
                    onClick={() => setMasterModeOpen((prev) => !prev)}
                    aria-expanded={masterModeOpen}
                    className={navBtnClass(
                      isMasterViewActive,
                      masterModeOpen && !isMasterViewActive
                    )}
                  >
                    <Layers size={13} />
                    <span>Administración</span>
                    <ChevronDown
                      size={12}
                      className={`transition-transform opacity-75 ${masterModeOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                )}
              </nav>
            )
          )}
        </div>
      </header>

      {/* ZONA 2A: Sub-menú de Administración Global (Superadmin) */}
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

      {/* ZONA 2B: Barra contextual del Residente (Domicilio + enlaces planos estilo MeLi) */}
      {showResidentSubBar && (
        <div
          className={`border-b px-4 sm:px-6 ${
            isDarkTheme ? 'border-white/10' : 'border-black/10'
          }`}
          style={{
            backgroundColor: brand?.submenuBgColor || '#090D16',
            color: brand?.submenuTextColor || '#CBD5E1',
          }}
        >
          <div className="max-w-6xl w-full mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
            {/* Domicilio clicable → Mi Cuenta */}
            <button
              type="button"
              onClick={() => setCurrentView('account')}
              className="inline-flex items-center gap-1.5 py-1.5 text-[11px] sm:text-xs font-medium opacity-85 hover:opacity-100 cursor-pointer text-left min-w-0 max-w-full"
              title="Editar domicilio y barrio en Mi Cuenta"
            >
              <MapPin
                size={13}
                className={`shrink-0 ${isDarkTheme ? 'text-emerald-400' : 'text-emerald-600'}`}
              />
              <span className="truncate">
                {residentLocationLabel || 'Completar barrio y lote'}
              </span>
            </button>

            {/* Enlaces planos sin cajas pesadas: Prestadores · Mis Servicios · Pases QR · Favoritos · Refrescar */}
            <nav
              aria-label="Navegación del Portal Residente"
              className="flex items-center gap-4 sm:gap-5 overflow-x-auto flex-nowrap"
            >
              <button
                type="button"
                onClick={() => {
                  setResidentTab('providers');
                  setResidentFavoritesOnly(false);
                }}
                className={subBarLinkClass(residentTab === 'providers' && !residentFavoritesOnly)}
              >
                <Users size={13} className="shrink-0 opacity-85" />
                <span>Prestadores</span>
              </button>

              <button
                type="button"
                onClick={() => setResidentTab('services')}
                className={subBarLinkClass(residentTab === 'services')}
              >
                <FileText size={13} className="shrink-0 opacity-85" />
                <span>Mis Servicios</span>
                {residentHeaderMeta.servicesActionCount > 0 ? (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                      isDarkTheme
                        ? 'bg-amber-400/20 text-amber-200 border border-amber-400/40'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {residentHeaderMeta.servicesActionCount}
                  </span>
                ) : residentHeaderMeta.servicesTotalCount > 0 ? (
                  <span className="text-[10px] opacity-60 font-semibold">
                    ({residentHeaderMeta.servicesTotalCount})
                  </span>
                ) : null}
              </button>

              <button
                type="button"
                onClick={() => setResidentTab('passes')}
                className={subBarLinkClass(residentTab === 'passes')}
              >
                <QrCode size={13} className="shrink-0 opacity-85" />
                <span>Pases QR</span>
                {residentHeaderMeta.passesCount > 0 && (
                  <span className="text-[10px] opacity-65 font-semibold">
                    ({residentHeaderMeta.passesCount})
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (residentTab !== 'providers') {
                    setResidentTab('providers');
                    setResidentFavoritesOnly(true);
                  } else {
                    setResidentFavoritesOnly((prev) => !prev);
                  }
                }}
                className={subBarLinkClass(residentTab === 'providers' && residentFavoritesOnly)}
              >
                <Heart
                  size={13}
                  className={`shrink-0 ${
                    residentTab === 'providers' && residentFavoritesOnly
                      ? 'fill-current text-rose-400'
                      : 'opacity-85'
                  }`}
                />
                <span>Favoritos</span>
                {residentHeaderMeta.favoritesCount > 0 && (
                  <span className="text-[10px] opacity-65 font-semibold">
                    ({residentHeaderMeta.favoritesCount})
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setResidentRefreshNonce((prev) => prev + 1)}
                className="inline-flex items-center justify-center p-1.5 rounded-lg opacity-65 hover:opacity-100 cursor-pointer shrink-0 transition-opacity"
                title="Actualizar información del portal"
                aria-label="Actualizar información del portal"
              >
                <RefreshCw
                  size={13}
                  className={residentHeaderMeta.refreshing ? 'animate-spin' : ''}
                />
              </button>
            </nav>
          </div>
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
            externalSearchTerm={globalSearchQuery}
            onExternalSearchChange={setGlobalSearchQuery}
            searchSubmitNonce={landingSearchSubmitNonce}
            useGlobalHeaderSearch
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

        {/* Portales operativos: Residente (sincronizado con barra de 2 filas), Prestador y Consola de Garita */}
        {(currentView === 'resident' || currentView === 'payments') && (
          <ResidentDashboard
            onNavigate={setCurrentView}
            onViewChange={setCurrentView}
            initialStep={currentView === 'payments' ? 'payments' : residentInitialStep}
            onConsumedInitialStep={() => setResidentInitialStep(null)}
            useGlobalHeader
            externalSearchTerm={globalSearchQuery}
            onExternalSearchChange={setGlobalSearchQuery}
            externalActiveStep={residentTab}
            onExternalStepChange={setResidentTab}
            externalOnlyFavorites={residentFavoritesOnly}
            onExternalOnlyFavoritesChange={setResidentFavoritesOnly}
            onHeaderMetaChange={setResidentHeaderMeta}
            refreshNonce={residentRefreshNonce}
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