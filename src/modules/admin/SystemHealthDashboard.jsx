/**
 * @file SystemHealthDashboard.jsx
 * @description Consola técnica "Sistema" exclusiva para el rol `superadmin`, organizada en 3 pestañas
 * con el sistema de diseño homogéneo de Administración (`AdminPageHeader`, `AdminListToolbar` y
 * `AdminPaginationBar` con escala unificada 6/12/24/50):
 * 1) Salud y Pases: monitoreo en vivo de Backend, PostgreSQL y API Externa, listado paginado de
 *    Pases QR recientes con copia de token/cancelación y Sandbox externo de validación de garita.
 * 2) Endpoints: configuración activa del entorno, catálogo filtrable/paginado de endpoints del
 *    backend con requisitos de autenticación/roles y prueba rápida GET en vivo.
 * 3) Apariencia: personalización white-label por zonas y presets embebida (`BrandingSettingsView`).
 * @location /trustlink-web/src/modules/admin/SystemHealthDashboard.jsx
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Server,
  Database,
  KeyRound,
  RefreshCw,
  Check,
  Copy,
  QrCode,
  Ban,
  Send,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Webhook,
  Play,
  Lock,
  Palette,
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';
import { useAuth } from '../auth/AuthContext';
import { API_BASE } from '../../config/api';
import { PAGE_SHELL_CLASS, SECTION_CARD_CLASS, FIELD_INPUT_CLASS } from '../../config/uiTokens';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminListToolbar from '../../components/admin/AdminListToolbar';
import AdminPaginationBar from '../../components/admin/AdminPaginationBar';
import { paginateItems } from '../../utils/adminPagination';
import BrandingSettingsView from '../branding/BrandingSettingsView';

// Zona horaria por defecto utilizada cuando el perfil del usuario no define una propia
const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

// Pestañas válidas de la vista Sistema
const VALID_SYSTEM_TABS = new Set(['health', 'endpoints', 'appearance']);

// Catálogo estático de referencia de los endpoints clave del backend y sus requisitos de acceso
const SYSTEM_ENDPOINTS_CATALOG = [
  {
    id: 'health-root',
    method: 'GET',
    path: '/health',
    module: 'Salud',
    auth: 'Público',
    roles: 'Todos',
    summary: 'Verifica disponibilidad básica del servidor Express y devuelve timestamp.',
    testable: true,
  },
  {
    id: 'external-status',
    method: 'GET',
    path: '/api/v1/external/status',
    module: 'Diagnóstico',
    auth: 'Bearer JWT',
    roles: 'superadmin',
    summary: 'Evalúa conexión y latencia de PostgreSQL, uptime y métricas generales de la red.',
    testable: true,
  },
  {
    id: 'external-passes-verify',
    method: 'POST',
    path: '/api/v1/external/passes/verify',
    module: 'Garita / API Externa',
    auth: 'x-api-key o Bearer JWT',
    roles: 'external_gate / admin / superadmin / security',
    summary: 'Valida token QR, vigencia horaria, comunidad y compliance del prestador en tiempo real.',
    testable: false,
  },
  {
    id: 'external-countries',
    method: 'GET / POST',
    path: '/api/v1/external/countries',
    module: 'Comunidades',
    auth: 'Bearer JWT',
    roles: 'superadmin',
    summary: 'Lista con paginación y da de alta barrios/comunidades con plan B2B y consumo mensual QR.',
    testable: false,
  },
  {
    id: 'external-countries-billing',
    method: 'PATCH',
    path: '/api/v1/external/countries/:id/billing',
    module: 'Licenciamiento B2B',
    auth: 'Bearer JWT',
    roles: 'superadmin',
    summary: 'Actualiza plan comercial, estado (trial/active/grace/suspended), vigencia y cuota mensual QR.',
    testable: false,
  },
  {
    id: 'external-my-community-billing',
    method: 'GET',
    path: '/api/v1/external/my-community/billing',
    module: 'Licenciamiento B2B',
    auth: 'Bearer JWT',
    roles: 'admin / superadmin',
    summary: 'Consulta el plan B2B vigente, vencimiento y consumo mensual de validaciones QR de una comunidad.',
    testable: true,
  },
  {
    id: 'external-integrations',
    method: 'GET / POST',
    path: '/api/v1/external/integrations',
    module: 'Claves API',
    auth: 'Bearer JWT',
    roles: 'superadmin',
    summary: 'Administra claves de integración por comunidad (crear, rotar y activar/revocar).',
    testable: false,
  },
  {
    id: 'external-audit',
    method: 'GET',
    path: '/api/v1/external/audit',
    module: 'Auditoría',
    auth: 'Bearer JWT',
    roles: 'superadmin',
    summary: 'Consulta bitácora paginada de accesos (autorizados/denegados) y transacciones.',
    testable: false,
  },
  {
    id: 'auth-users-analytics',
    method: 'GET',
    path: '/api/v1/auth/users/analytics',
    module: 'Métricas',
    auth: 'Bearer JWT',
    roles: 'superadmin',
    summary: 'Devuelve métricas de adquisición (initial_role), identidad dual y embudos operativos.',
    testable: true,
  },
  {
    id: 'providers-directory',
    method: 'GET',
    path: '/api/v1/providers/directory',
    module: 'Prestadores',
    auth: 'Bearer JWT',
    roles: 'owner / family / admin / superadmin',
    summary: 'Devuelve el directorio unificado de prestadores aprobados con especialidades y scoring.',
    testable: false,
  },
  {
    id: 'providers-compliance',
    method: 'PATCH',
    path: '/api/v1/providers/compliance/user',
    module: 'Compliance',
    auth: 'Bearer JWT',
    roles: 'superadmin',
    summary: 'Aprueba, rechaza o deja pendiente el estado de compliance global de un prestador.',
    testable: false,
  },
];

// Lista de módulos únicos para el selector de filtro del catálogo de endpoints
const ENDPOINT_MODULES = Array.from(new Set(SYSTEM_ENDPOINTS_CATALOG.map((ep) => ep.module)));

/**
 * Convierte una fecha/timestamp UTC (string ISO, SQL o epoch en ms) a milisegundos Unix.
 * Prioriza `fallbackMs` si es un valor numérico válido y normaliza cadenas sin offset como UTC.
 *
 * @param {string|number|null|undefined} value - Fecha o marca de tiempo de entrada.
 * @param {number|null} [fallbackMs=null] - Valor en milisegundos ya calculado por el backend.
 * @returns {number|null} Timestamp en milisegundos o `null` si no se puede parsear.
 */
function parseUtcTimestampMs(value, fallbackMs = null) {
  if (fallbackMs !== null && fallbackMs !== undefined && !Number.isNaN(Number(fallbackMs))) {
    return Number(fallbackMs);
  }
  if (!value) return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;

  const raw = String(value).trim();
  const hasOffsetOrZ = /([zZ]|[+-]\d{2}:?\d{2})$/.test(raw);
  const normalized = hasOffsetOrZ ? raw : `${raw.replace(' ', 'T')}Z`;
  const ms = Date.parse(normalized);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Formatea una marca temporal UTC a formato legible local (`dd/mm hh:mm`, locale `es-AR`)
 * aplicando la zona horaria indicada, con respaldo seguro ante zonas inválidas.
 *
 * @param {string|number|null|undefined} value - Valor de fecha/hora a formatear.
 * @param {string} [timeZone=DEFAULT_TIMEZONE] - Identificador IANA de zona horaria.
 * @param {number|null} [fallbackMs=null] - Timestamp en milisegundos alternativo.
 * @returns {string} Fecha y hora formateadas o `'No especificado'`.
 */
function formatDateTime(value, timeZone = DEFAULT_TIMEZONE, fallbackMs = null) {
  const ms = parseUtcTimestampMs(value, fallbackMs);
  if (ms === null) return 'No especificado';
  try {
    return new Date(ms).toLocaleString('es-AR', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date(ms).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

/**
 * Panel técnico "Sistema" para usuarios `superadmin`:
 * Salud y Pases QR, Sandbox de Garita, Catálogo de Endpoints y Apariencia White-Label.
 *
 * @param {Object} [props] - Propiedades opcionales del componente.
 * @param {'health'|'endpoints'|'appearance'} [props.initialTab='health'] - Pestaña inicial a mostrar.
 * @param {(viewId: string) => void} [props.onNavigate] - Callback para navegar entre vistas de Administración.
 * @returns {JSX.Element} Consola administrativa de sistema y apariencia.
 */
export default function SystemHealthDashboard({ initialTab = 'health', onNavigate } = {}) {
  const { brand } = useBranding();
  const { user } = useAuth();
  const activeTimeZone = user?.timezone || user?.time_zone || DEFAULT_TIMEZONE;

  // Estilos dinámicos de Zona 4 (tarjetas) y Zona 5 (cajas internas)
  const cardStyle = {
    backgroundColor: brand?.cardBgColor || '#020617',
    color: brand?.cardTextColor || '#F1F5F9',
  };

  const innerStyle = {
    backgroundColor: brand?.innerBgColor || '#0F172A',
    color: brand?.innerTextColor || '#F1F5F9',
  };

  // Pestaña activa ('health' | 'endpoints' | 'appearance') sincronizada con `initialTab`
  const [activeTab, setActiveTab] = useState(
    VALID_SYSTEM_TABS.has(initialTab) ? initialTab : 'health'
  );

  useEffect(() => {
    if (VALID_SYSTEM_TABS.has(initialTab)) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Estado de salud, latencia HTTP y diagnóstico de backend y base de datos
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [healthHttpStatus, setHealthHttpStatus] = useState(null);
  const [diagHttpStatus, setDiagHttpStatus] = useState(null);
  const [httpLatencyMs, setHttpLatencyMs] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [diagnosticsData, setDiagnosticsData] = useState(null);
  const [showBackendDiagDetails, setShowBackendDiagDetails] = useState(false);

  // Estado de filtros, paginación y prueba rápida en vivo de la pestaña Endpoints
  const [endpointFilter, setEndpointFilter] = useState('');
  const [endpointModuleFilter, setEndpointModuleFilter] = useState('all');
  const [endpointModeChip, setEndpointModeChip] = useState('all');
  const [endpointPage, setEndpointPage] = useState(1);
  const [endpointPageSize, setEndpointPageSize] = useState(6);
  const [probingEndpointId, setProbingEndpointId] = useState(null);
  const [endpointProbeResult, setEndpointProbeResult] = useState(null);

  // Estado de Pases QR recientes (búsqueda, chips de estado, paginación 6/12/24/50, copia y cancelación)
  const [recentPasses, setRecentPasses] = useState([]);
  const [referenceNowMs, setReferenceNowMs] = useState(() => Date.now());
  const [loadingPasses, setLoadingPasses] = useState(true);
  const [passSearch, setPassSearch] = useState('');
  const [passStatusFilter, setPassStatusFilter] = useState('all');
  const [passPage, setPassPage] = useState(1);
  const [passPageSize, setPassPageSize] = useState(6);
  const [passTotalPages, setPassTotalPages] = useState(1);
  const [passTotalCount, setPassTotalCount] = useState(0);
  const [passFeedback, setPassFeedback] = useState(null);
  const [copiedTokenId, setCopiedTokenId] = useState(null);
  const [cancellingPassId, setCancellingPassId] = useState(null);

  // Estado del Sandbox para probar POST /api/v1/external/passes/verify
  const [testQrToken, setTestQrToken] = useState('');
  const [testApiKey, setTestApiKey] = useState('');
  const [authMode, setAuthMode] = useState('api_key');
  const [testingEndpoint, setTestingEndpoint] = useState(false);
  const [sandboxResponse, setSandboxResponse] = useState(null);

  /**
   * Genera el encabezado de autenticación Bearer JWT leyendo el token de sesión en `localStorage`.
   *
   * @returns {{ Authorization: string }} Cabeceras HTTP de autorización.
   */
  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
  });

  /**
   * Consulta en paralelo `/health` y `/api/v1/external/status` para evaluar conectividad,
   * latencia HTTP, estado de PostgreSQL y métricas globales del sistema.
   *
   * @returns {Promise<void>}
   */
  const fetchSystemHealth = async () => {
    setLoadingStatus(true);
    setStatusError('');
    const startedAt = performance.now();

    try {
      const [healthRes, diagRes] = await Promise.all([
        fetch(`${API_BASE}/health`),
        fetch(`${API_BASE}/api/v1/external/status`, {
          headers: getAuthHeaders(),
        }),
      ]);

      const elapsed = Math.round(performance.now() - startedAt);
      setHttpLatencyMs(elapsed);
      setHealthHttpStatus(healthRes.status);
      setDiagHttpStatus(diagRes.status);

      const healthJson = await healthRes.json().catch(() => null);
      setHealthData({
        ok: healthRes.ok,
        status: healthRes.status,
        body: healthJson,
      });

      const diagJson = await diagRes.json().catch(() => null);
      if (diagRes.ok && diagJson) {
        setDiagnosticsData(diagJson);
      } else {
        setDiagnosticsData(diagJson);
        setStatusError(
          diagJson?.error ||
            `El endpoint /api/v1/external/status respondió con HTTP ${diagRes.status}.`
        );
      }
    } catch (error) {
      console.error('Error al consultar salud del sistema:', error);
      setHttpLatencyMs(Math.round(performance.now() - startedAt));
      setStatusError('No se pudo conectar con el servidor backend en http://localhost:4000.');
      setHealthData(null);
      setDiagnosticsData(null);
    } finally {
      setLoadingStatus(false);
    }
  };

  /**
   * Ejecuta una prueba HTTP GET en vivo contra un endpoint habilitado del catálogo
   * y almacena el código de estado, la latencia y la respuesta JSON para inspección.
   *
   * @param {{ id: string, path: string, auth: string }} ep - Definición del endpoint a probar.
   * @returns {Promise<void>}
   */
  const handleProbeEndpoint = async (ep) => {
    setProbingEndpointId(ep.id);
    setEndpointProbeResult(null);
    const startedAt = performance.now();

    try {
      const needsAuth = ep.auth.includes('Bearer JWT');
      const res = await fetch(`${API_BASE}${ep.path}`, {
        method: 'GET',
        headers: needsAuth ? getAuthHeaders() : {},
      });
      const elapsed = Math.round(performance.now() - startedAt);
      const body = await res.json().catch(() => ({}));

      setEndpointProbeResult({
        endpointId: ep.id,
        path: ep.path,
        ok: res.ok,
        status: res.status,
        latencyMs: elapsed,
        body,
      });
    } catch (err) {
      console.error('Error al probar endpoint:', err);
      setEndpointProbeResult({
        endpointId: ep.id,
        path: ep.path,
        ok: false,
        status: 0,
        latencyMs: Math.round(performance.now() - startedAt),
        body: { error: 'No se pudo alcanzar el endpoint en el backend.' },
      });
    } finally {
      setProbingEndpointId(null);
    }
  };

  /**
   * Consulta los pases QR recientes aplicando paginación, filtro de estado y texto de búsqueda,
   * actualizando `referenceNowMs` para evaluar vigencias vencidas de forma consistente.
   *
   * @param {number} [pageToLoad=passPage] - Número de página a cargar.
   * @param {string} [statusToLoad=passStatusFilter] - Estado solicitado (`all`, `pending`, `expired`, `used`, `cancelled`).
   * @param {string} [searchToLoad=passSearch] - Filtro por prestador, barrio o token.
   * @param {number} [limitToLoad=passPageSize] - Registros por página (`6 | 12 | 24 | 50`).
   * @returns {Promise<void>}
   */
  const fetchRecentPasses = async (
    pageToLoad = passPage,
    statusToLoad = passStatusFilter,
    searchToLoad = passSearch,
    limitToLoad = passPageSize
  ) => {
    setLoadingPasses(true);
    try {
      const params = new URLSearchParams({
        page: String(pageToLoad),
        limit: String(limitToLoad),
        status: statusToLoad,
        search: searchToLoad,
      });
      const res = await fetch(`${API_BASE}/api/v1/external/passes?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        const list = data.passes || [];
        setRecentPasses(list);
        setReferenceNowMs(Date.now());
        const pagination = data.pagination || {};
        setPassPage(pagination.page || pageToLoad);
        setPassTotalPages(pagination.totalPages || 1);
        setPassTotalCount(pagination.total ?? list.length);
      }
    } catch (error) {
      console.error('Error al cargar pases recientes:', error);
    } finally {
      setLoadingPasses(false);
    }
  };

  // Carga inicial al montar el panel: salud del sistema y pases QR recientes
  useEffect(() => {
    fetchSystemHealth();
    fetchRecentPasses(1, 'all', '', 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Refresca en paralelo el diagnóstico técnico y los pases QR recientes.
   *
   * @returns {Promise<void>}
   */
  const handleRefreshAll = async () => {
    await Promise.all([
      fetchSystemHealth(),
      fetchRecentPasses(passPage, passStatusFilter, passSearch, passPageSize),
    ]);
  };

  /**
   * Copia el `qr_token` de un pase al portapapeles y activa una confirmación visual temporal.
   *
   * @param {{ id: number, qr_token: string }} pass - Pase QR cuyo token se copiará.
   * @returns {Promise<void>}
   */
  const handleCopyToken = async (pass) => {
    try {
      await navigator.clipboard.writeText(pass.qr_token);
      setCopiedTokenId(pass.id);
      setTimeout(() => setCopiedTokenId(null), 1800);
    } catch (err) {
      console.error('No se pudo copiar el token:', err);
    }
  };

  /**
   * Precarga un token QR en el formulario del sandbox, cambia a la pestaña `health`
   * y desplaza suavemente la pantalla hasta la sección de prueba externa.
   *
   * @param {string} token - Token QR a precargar en el sandbox.
   * @returns {void}
   */
  const handleLoadTokenInSandbox = (token) => {
    setTestQrToken(token);
    setSandboxResponse(null);
    setActiveTab('health');
    setTimeout(() => {
      const el = document.getElementById('external-sandbox-section');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  /**
   * Cancela manualmente un pase QR pendiente (`PATCH /api/v1/external/passes/:id/cancel`)
   * y refresca el listado de pases y las métricas globales del backend.
   *
   * @param {number} passId - Identificador del pase a cancelar.
   * @returns {Promise<void>}
   */
  const handleCancelPass = async (passId) => {
    setCancellingPassId(passId);
    setPassFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/passes/${passId}/cancel`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setPassFeedback({
          type: 'success',
          message: data.message || `Pase #${passId} cancelado.`,
        });
        await Promise.all([
          fetchRecentPasses(passPage, passStatusFilter, passSearch, passPageSize),
          fetchSystemHealth(),
        ]);
      } else {
        setPassFeedback({
          type: 'error',
          message: data.error || 'No se pudo cancelar el pase.',
        });
      }
    } catch (error) {
      console.error('Error al cancelar pase:', error);
      setPassFeedback({ type: 'error', message: 'Error de conexión al cancelar el pase.' });
    } finally {
      setCancellingPassId(null);
    }
  };

  /**
   * Ejecuta una prueba contra el endpoint de garita `POST /api/v1/external/passes/verify`
   * utilizando el modo de autenticación elegido (`x-api-key` o `Bearer JWT`) y registra respuesta y latencia.
   *
   * @param {React.FormEvent<HTMLFormElement>} e - Evento de envío del formulario del sandbox.
   * @returns {Promise<void>}
   */
  const handleRunExternalTest = async (e) => {
    e.preventDefault();
    if (!testQrToken.trim()) return;

    setTestingEndpoint(true);
    setSandboxResponse(null);
    const startedAt = performance.now();

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authMode === 'api_key') {
        if (testApiKey.trim()) headers['x-api-key'] = testApiKey.trim();
      } else {
        const token = localStorage.getItem('trustlink_token') || '';
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE}/api/v1/external/passes/verify`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ qr_token: testQrToken.trim() }),
      });

      const elapsed = Math.round(performance.now() - startedAt);
      const body = await response.json();

      setSandboxResponse({
        ok: response.ok,
        httpStatus: response.status,
        latencyMs: elapsed,
        body,
      });
    } catch (error) {
      console.error('Error al probar endpoint externo:', error);
      setSandboxResponse({
        ok: false,
        httpStatus: 0,
        latencyMs: Math.round(performance.now() - startedAt),
        body: {
          authorized: false,
          code: 'NETWORK_ERROR',
          error: 'Error de red al invocar POST /api/v1/external/passes/verify.',
        },
      });
    } finally {
      setTestingEndpoint(false);
    }
  };

  /**
   * Convierte una duración en segundos al formato compacto legible `Xh Ym Zs`.
   *
   * @param {number|null|undefined} seconds - Tiempo activo del proceso en segundos.
   * @returns {string} Uptime formateado o `'-'` si el valor no es numérico.
   */
  const formatUptime = (seconds) => {
    if (typeof seconds !== 'number') return '-';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  };

  /**
   * Calcula el estado visual efectivo en español de un pase QR combinando su estado persistido
   * con la comparación de su ventana horaria UTC (`start_time` / `end_time`) frente a `referenceNowMs`.
   *
   * @param {Object} pass - Registro del pase QR.
   * @returns {{ key: string, label: string, sublabel: string|null, badgeClass: string }} Metadatos de estado y estilo.
   */
  const resolvePassDisplayStatus = (pass) => {
    const rawStatus = String(pass.status || 'pending').toLowerCase();
    const startMs = parseUtcTimestampMs(pass.start_time, pass.start_utc_ms);
    const endMs = parseUtcTimestampMs(pass.end_time, pass.end_utc_ms);
    const nowMs = referenceNowMs;
    const isPastEnd = endMs !== null && nowMs > endMs;
    const isBeforeStart = startMs !== null && nowMs < startMs;

    if (rawStatus === 'cancelled') {
      return {
        key: 'cancelled',
        label: 'cancelado',
        sublabel: null,
        badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
      };
    }
    if (rawStatus === 'used') {
      return {
        key: 'used',
        label: 'usado',
        sublabel: null,
        badgeClass: 'bg-sky-950 text-sky-300 border-sky-800',
      };
    }
    if (rawStatus === 'expired' || (rawStatus === 'pending' && isPastEnd)) {
      return {
        key: 'expired',
        label: 'vencido',
        sublabel: rawStatus === 'pending' && isPastEnd ? 'fin superado' : null,
        badgeClass: 'bg-amber-950 text-amber-300 border-amber-700',
      };
    }
    if (rawStatus === 'pending' && isBeforeStart) {
      return {
        key: 'pending',
        label: 'pendiente',
        sublabel: 'aún no inicia',
        badgeClass: 'bg-indigo-950 text-indigo-300 border-indigo-800',
      };
    }
    return {
      key: 'pending',
      label: 'pendiente',
      sublabel: 'vigente',
      badgeClass: 'bg-emerald-950 text-emerald-300 border-emerald-800',
    };
  };

  // Filtrado en cliente sobre los pases cargados según el estado efectivo resuelto
  const filteredPasses = recentPasses.filter((pass) => {
    if (passStatusFilter === 'all') return true;
    return resolvePassDisplayStatus(pass).key === passStatusFilter;
  });

  // Filtrado y paginación en cliente del catálogo de endpoints
  const filteredEndpoints = useMemo(() => {
    const q = endpointFilter.trim().toLowerCase();
    return SYSTEM_ENDPOINTS_CATALOG.filter((ep) => {
      if (endpointModuleFilter !== 'all' && ep.module !== endpointModuleFilter) return false;
      if (endpointModeChip === 'testable' && !ep.testable) return false;
      if (endpointModeChip === 'sandbox' && ep.testable) return false;
      if (!q) return true;
      return (
        ep.path.toLowerCase().includes(q) ||
        ep.module.toLowerCase().includes(q) ||
        ep.method.toLowerCase().includes(q) ||
        ep.roles.toLowerCase().includes(q) ||
        ep.summary.toLowerCase().includes(q)
      );
    });
  }, [endpointFilter, endpointModuleFilter, endpointModeChip]);

  const pagedEndpoints = useMemo(
    () => paginateItems(filteredEndpoints, endpointPage, endpointPageSize),
    [filteredEndpoints, endpointPage, endpointPageSize]
  );

  // Derivación del estado global del backend (saludable, degradado u offline) y su causa
  const hasNetworkOrHttpFailure =
    Boolean(statusError) ||
    (healthHttpStatus !== null && healthHttpStatus >= 400) ||
    (diagHttpStatus !== null && diagHttpStatus >= 400) ||
    diagnosticsData?.status === 'degraded';

  const isSlowLatency = httpLatencyMs !== null && httpLatencyMs >= 300;
  const isBackendHealthy = Boolean(healthData?.ok && !hasNetworkOrHttpFailure && !isSlowLatency);
  const isBackendDegraded = Boolean(healthData?.ok && !isBackendHealthy);

  const backendDiagnosticReason = hasNetworkOrHttpFailure
    ? statusError || 'El endpoint de diagnóstico reportó incidencia o error HTTP.'
    : isSlowLatency
      ? `Latencia HTTP elevada (${httpLatencyMs} ms >= 300 ms) o carga de consulta.`
      : 'Respuesta nominal de /health y /api/v1/external/status.';

  // Métricas agregadas de diagnóstico técnico
  const metrics = diagnosticsData?.metrics || {};
  const activeKeysCount = metrics.active_integrations ?? 0;
  const activeCountriesCount = metrics.active_countries ?? 0;
  const totalCountriesCount = metrics.total_countries ?? 0;
  const envKeyConfigured = Boolean(diagnosticsData?.external_endpoint?.env_api_key_configured);

  return (
    <div className={PAGE_SHELL_CLASS}>
      <main className="space-y-6">
        {/* Cabecera unificada de Sistema con 3 pestañas: Salud y Pases, Endpoints y Apariencia */}
        <AdminPageHeader
          icon={<Activity size={22} strokeWidth={1.8} />}
          iconColorClass="text-emerald-400"
          title="Sistema"
          subtitle="Salud técnica en vivo, pases QR, sandbox de garita, catálogo de endpoints y apariencia white-label."
          tabs={[
            { id: 'health', label: 'Salud y Pases', icon: <Activity size={13} /> },
            {
              id: 'endpoints',
              label: 'Endpoints',
              icon: <Webhook size={13} />,
              count: SYSTEM_ENDPOINTS_CATALOG.length,
            },
            { id: 'appearance', label: 'Apariencia', icon: <Palette size={13} /> },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onRefresh={handleRefreshAll}
          refreshing={loadingStatus || loadingPasses}
          cardStyle={cardStyle}
          innerStyle={innerStyle}
        />

        {/* ==================== PESTAÑA 1: SALUD Y PASES QR ==================== */}
        {activeTab === 'health' && (
          <div className="space-y-6">
            {/* Banner de error de conectividad o diagnóstico del backend */}
            {statusError && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-rose-950/60 border border-rose-800/80 text-rose-200 p-4 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-400 shrink-0" />
                  <span>{statusError}</span>
                </div>
                <button
                  type="button"
                  onClick={fetchSystemHealth}
                  className="px-3 py-1.5 rounded-lg bg-rose-900/80 hover:bg-rose-800 text-white font-bold cursor-pointer self-start sm:self-auto shrink-0"
                >
                  Reintentar ahora
                </button>
              </div>
            )}

            {/* Tarjetas de estado en vivo: Backend, PostgreSQL y API Externa */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Tarjeta 1: Salud del servidor Backend, latencia HTTP y detalle técnico */}
              <section
                className="border border-white/10 p-5 rounded-2xl shadow-sm space-y-3"
                style={cardStyle}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <Server size={16} className="text-sky-400" />
                    <span>Backend</span>
                  </div>
                  {isBackendHealthy ? (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                      SALUDABLE
                    </span>
                  ) : isBackendDegraded ? (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-700">
                      DEGRADADO
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800">
                      OFFLINE
                    </span>
                  )}
                </div>

                <div
                  className="p-3 rounded-xl border border-white/10 space-y-1.5 text-xs"
                  style={innerStyle}
                >
                  <div className="flex justify-between">
                    <span className="opacity-75">Latencia HTTP:</span>
                    <span className="font-mono font-bold">
                      {httpLatencyMs !== null ? `${httpLatencyMs} ms` : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-75">Tiempo activo:</span>
                    <span className="font-mono">
                      {formatUptime(diagnosticsData?.uptime_seconds)}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-85 pt-1 border-t border-white/10">
                    {backendDiagnosticReason}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={fetchSystemHealth}
                    disabled={loadingStatus}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/15 font-bold cursor-pointer hover:opacity-90 disabled:opacity-50"
                    style={innerStyle}
                  >
                    <RefreshCw size={11} className={loadingStatus ? 'animate-spin' : ''} />
                    Reintentar
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowBackendDiagDetails((prev) => !prev)}
                    className="px-2.5 py-1 rounded-lg border border-white/15 font-semibold opacity-85 hover:opacity-100 cursor-pointer"
                    style={innerStyle}
                  >
                    {showBackendDiagDetails ? 'Ocultar detalle' : 'Ver detalle'}
                  </button>
                </div>

                {/* Panel desplegable con códigos HTTP y entorno del diagnóstico */}
                {showBackendDiagDetails && (
                  <div
                    className="p-3 rounded-xl border border-white/10 text-[11px] font-mono space-y-1 overflow-x-auto"
                    style={innerStyle}
                  >
                    <div>/health HTTP: {healthHttpStatus ?? 'N/A'}</div>
                    <div>/external/status HTTP: {diagHttpStatus ?? 'N/A'}</div>
                    <div>Entorno: {diagnosticsData?.environment || 'desarrollo'}</div>
                    <div>BD Latencia: {diagnosticsData?.database?.latency_ms ?? '-'} ms</div>
                  </div>
                )}
              </section>

              {/* Tarjeta 2: Conectividad, latencia y conteos principales en PostgreSQL */}
              <section
                className="border border-white/10 p-5 rounded-2xl shadow-sm space-y-3"
                style={cardStyle}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <Database size={16} className="text-indigo-400" />
                    <span>PostgreSQL</span>
                  </div>
                  {diagnosticsData?.database?.connected ? (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                      CONECTADA
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800">
                      DESCONECTADA
                    </span>
                  )}
                </div>
                <div
                  className="p-3 rounded-xl border border-white/10 space-y-1.5 text-xs"
                  style={innerStyle}
                >
                  <div className="flex justify-between">
                    <span className="opacity-75">Latencia consulta:</span>
                    <span className="font-mono font-bold">
                      {diagnosticsData?.database?.latency_ms ?? '-'} ms
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-75">Pases / Vencidos:</span>
                    <span className="font-mono">
                      {metrics.total_passes ?? 0} / {metrics.expired_passes ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-75">Prestadores aprobados:</span>
                    <span className="font-mono">{metrics.approved_providers ?? 0}</span>
                  </div>
                </div>
              </section>

              {/* Tarjeta 3: Resumen operativo de claves activas, barrios e intentos en API Externa */}
              <section
                className="border border-white/10 p-5 rounded-2xl shadow-sm space-y-3"
                style={cardStyle}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <KeyRound size={16} className="text-amber-400" />
                    <span>API Externa</span>
                  </div>
                  {activeKeysCount > 0 ? (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                      {activeKeysCount} CLAVE(S)
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">
                      SIN CLAVE
                    </span>
                  )}
                </div>
                <div
                  className="p-3 rounded-xl border border-white/10 space-y-1.5 text-xs"
                  style={innerStyle}
                >
                  <div className="flex justify-between">
                    <span className="opacity-75">Claves activas:</span>
                    <span className="font-mono font-bold">{activeKeysCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-75">Barrios activos:</span>
                    <span className="font-mono">
                      {activeCountriesCount} / {totalCountriesCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-75">Intentos registrados:</span>
                    <span className="font-mono">{metrics.total_access_logs ?? 0}</span>
                  </div>
                </div>
                {typeof onNavigate === 'function' && (
                  <div className="pt-0.5 flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigate('audit')}
                      className="px-2.5 py-1 rounded-lg border border-white/15 text-[11px] font-bold hover:opacity-90 cursor-pointer"
                      style={innerStyle}
                    >
                      Ver Auditoría →
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('local_admin')}
                      className="px-2.5 py-1 rounded-lg border border-white/15 text-[11px] font-bold hover:opacity-90 cursor-pointer"
                      style={innerStyle}
                    >
                      Comunidades y claves →
                    </button>
                  </div>
                )}
              </section>
            </div>

            {/* Pases QR Recientes */}
            <section className={`${SECTION_CARD_CLASS} space-y-4`} style={cardStyle}>
              <div>
                <h3 className="text-sm font-bold">Pases QR Recientes ({passTotalCount})</h3>
                <p className="text-xs opacity-80 mt-0.5">
                  Vigencia In/Out ({activeTimeZone}), copia de token, envío al sandbox y cancelación.
                </p>
              </div>

              {/* Barra homogénea de búsqueda y chips de estado para Pases QR */}
              <AdminListToolbar
                searchValue={passSearch}
                onSearchChange={setPassSearch}
                onSearchSubmit={(overrideQuery) => {
                  const q = typeof overrideQuery === 'string' ? overrideQuery : passSearch;
                  setPassPage(1);
                  fetchRecentPasses(1, passStatusFilter, q, passPageSize);
                }}
                searchPlaceholder="Buscar prestador, barrio o token..."
                showSubmitButton
                chips={[
                  { id: 'all', label: 'Todos' },
                  { id: 'pending', label: 'Pendientes' },
                  { id: 'expired', label: 'Vencidos' },
                  { id: 'used', label: 'Usados' },
                  { id: 'cancelled', label: 'Cancelados' },
                ]}
                activeChip={passStatusFilter}
                onChipChange={(nextStatus) => {
                  setPassStatusFilter(nextStatus);
                  setPassPage(1);
                  fetchRecentPasses(1, nextStatus, passSearch, passPageSize);
                }}
                hasActiveFilters={Boolean(passSearch.trim()) || passStatusFilter !== 'all'}
                onResetFilters={() => {
                  setPassSearch('');
                  setPassStatusFilter('all');
                  setPassPage(1);
                  fetchRecentPasses(1, 'all', '', passPageSize);
                }}
                innerStyle={innerStyle}
              />

              {/* Alerta de resultado de acciones sobre pases (ej. cancelación) */}
              {passFeedback && (
                <div
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs border ${
                    passFeedback.type === 'success'
                      ? 'bg-emerald-950/50 border-emerald-800 text-emerald-200'
                      : 'bg-rose-950/50 border-rose-800 text-rose-200'
                  }`}
                >
                  {passFeedback.type === 'success' ? (
                    <CheckCircle2 size={15} />
                  ) : (
                    <AlertCircle size={15} />
                  )}
                  <span>{passFeedback.message}</span>
                </div>
              )}

              {/* Tabla de pases QR con vigencia In/Out, estado efectivo y acciones rápidas */}
              {loadingPasses ? (
                <div className="text-center py-6 text-xs opacity-80">Cargando pases QR...</div>
              ) : filteredPasses.length === 0 ? (
                <div
                  className="text-center py-6 rounded-xl border border-white/10 text-xs opacity-80"
                  style={innerStyle}
                >
                  No hay pases QR que coincidan con el filtro.
                </div>
              ) : (
                <div
                  className="overflow-x-auto rounded-xl border border-white/10"
                  style={innerStyle}
                >
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 opacity-75">
                        <th className="py-2.5 px-3 font-semibold">Pase</th>
                        <th className="py-2.5 px-3 font-semibold">Prestador</th>
                        <th className="py-2.5 px-3 font-semibold">Barrio / Lote</th>
                        <th className="py-2.5 px-3 font-semibold">Vigencia (In / Out)</th>
                        <th className="py-2.5 px-3 font-semibold">Estado</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {filteredPasses.map((pass) => {
                        const statusInfo = resolvePassDisplayStatus(pass);
                        return (
                          <tr key={pass.id}>
                            <td className="py-2.5 px-3 font-mono">
                              <div className="font-bold">#{pass.id}</div>
                              <div className="text-[11px] opacity-75">
                                {pass.qr_token ? `${pass.qr_token.slice(0, 10)}...` : '-'}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold">
                                {pass.provider_name || 'Sin asignar'}
                              </div>
                              <div className="text-[11px] opacity-75">
                                {pass.specialty || '-'}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div>{pass.country_name || `Barrio #${pass.country_id}`}</div>
                              <div className="text-[11px] opacity-75">
                                {[pass.fraction_number, pass.lot_number]
                                  .filter(Boolean)
                                  .join(' / ') || '-'}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-[11px] font-mono">
                              <div>
                                In: {formatDateTime(pass.start_time, activeTimeZone, pass.start_utc_ms)}
                              </div>
                              <div>
                                Out: {formatDateTime(pass.end_time, activeTimeZone, pass.end_utc_ms)}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="inline-flex flex-col items-start gap-1">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusInfo.badgeClass}`}
                                >
                                  {statusInfo.label}
                                </span>
                                {statusInfo.sublabel && (
                                  <span className="text-[10px] opacity-75">
                                    {statusInfo.sublabel}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleCopyToken(pass)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-white/15 cursor-pointer"
                                  style={cardStyle}
                                >
                                  {copiedTokenId === pass.id ? (
                                    <>
                                      <Check size={11} className="text-emerald-400" /> Copiado
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={11} /> Copiar
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleLoadTokenInSandbox(pass.qr_token)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-white/15 cursor-pointer"
                                  style={cardStyle}
                                >
                                  <QrCode size={11} /> Sandbox
                                </button>
                                {pass.status === 'pending' && statusInfo.key !== 'expired' && (
                                  <button
                                    type="button"
                                    disabled={cancellingPassId === pass.id}
                                    onClick={() => handleCancelPass(pass.id)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-800/80 cursor-pointer disabled:opacity-50"
                                  >
                                    <Ban size={11} /> Cancelar
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Paginación unificada 6 / 12 / 24 / 50 */}
              <AdminPaginationBar
                page={passPage}
                totalPages={passTotalPages}
                totalItems={passTotalCount}
                pageSize={passPageSize}
                onPageChange={(nextPage) => {
                  setPassPage(nextPage);
                  fetchRecentPasses(nextPage, passStatusFilter, passSearch, passPageSize);
                }}
                onPageSizeChange={(nextSize) => {
                  setPassPageSize(nextSize);
                  setPassPage(1);
                  fetchRecentPasses(1, passStatusFilter, passSearch, nextSize);
                }}
                loading={loadingPasses}
                itemLabel="pase(s)"
                innerStyle={innerStyle}
              />
            </section>

            {/* Sandbox Endpoint Externo */}
            <section
              id="external-sandbox-section"
              className={`${SECTION_CARD_CLASS} space-y-4`}
              style={cardStyle}
            >
              <div>
                <h3 className="text-sm font-bold">
                  Sandbox POST /api/v1/external/passes/verify
                </h3>
                <p className="text-xs opacity-80 mt-0.5">
                  Probá la validación externa de un token QR con clave de comunidad o sesión.
                </p>
              </div>

              {/* Selector de modo de autenticación del sandbox: x-api-key o Bearer JWT */}
              <div
                className="inline-flex items-center gap-1 rounded-xl p-1 border border-white/15 self-start"
                style={innerStyle}
              >
                <button
                  type="button"
                  onClick={() => setAuthMode('api_key')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    authMode === 'api_key' ? 'bg-indigo-600 text-white shadow-sm' : 'opacity-80'
                  }`}
                >
                  x-api-key
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('jwt')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    authMode === 'jwt' ? 'bg-indigo-600 text-white shadow-sm' : 'opacity-80'
                  }`}
                >
                  Bearer JWT
                </button>
              </div>

              {/* Formulario de envío de token QR al endpoint externo de verificación */}
              <form onSubmit={handleRunExternalTest} className="space-y-3 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={testQrToken}
                    onChange={(e) => setTestQrToken(e.target.value)}
                    placeholder="qr_token a verificar"
                    className={`w-full px-3.5 font-mono ${FIELD_INPUT_CLASS}`}
                    style={innerStyle}
                  />
                  {authMode === 'api_key' && (
                    <input
                      type="text"
                      value={testApiKey}
                      onChange={(e) => setTestApiKey(e.target.value)}
                      placeholder="x-api-key de la comunidad (ej: tlk_live_...)"
                      className={`w-full px-3.5 font-mono ${FIELD_INPUT_CLASS}`}
                      style={innerStyle}
                    />
                  )}
                </div>

                <button
                  type="submit"
                  disabled={testingEndpoint || !testQrToken.trim()}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 cursor-pointer"
                >
                  <Send size={14} /> {testingEndpoint ? 'Probando...' : 'Probar Validación'}
                </button>
              </form>

              {/* Visor de respuesta JSON, código HTTP y latencia del sandbox */}
              {sandboxResponse && (
                <div
                  className="border border-white/10 rounded-xl p-4 space-y-2.5"
                  style={innerStyle}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-bold">
                      {sandboxResponse.ok ? (
                        <CheckCircle2 size={15} className="text-emerald-400" />
                      ) : (
                        <XCircle size={15} className="text-rose-400" />
                      )}
                      <span>HTTP {sandboxResponse.httpStatus}</span>
                      <span
                        className="font-mono text-[11px] px-2 py-0.5 rounded border border-white/15"
                        style={cardStyle}
                      >
                        {sandboxResponse.body?.code || (sandboxResponse.ok ? 'OK' : 'ERROR')}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] opacity-80">
                      {sandboxResponse.latencyMs} ms
                    </span>
                  </div>
                  <pre className="text-[11px] font-mono overflow-x-auto max-h-60 opacity-90">
                    {JSON.stringify(sandboxResponse.body, null, 2)}
                  </pre>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ==================== PESTAÑA 2: CATÁLOGO DE ENDPOINTS ==================== */}
        {activeTab === 'endpoints' && (
          <div className="space-y-6">
            {/* Tarjetas de resumen de entorno: clave ENV, modos de autenticación y URL base */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <section
                className="border border-white/10 p-5 rounded-2xl shadow-sm space-y-2"
                style={cardStyle}
              >
                <div className="text-xs opacity-75">Clave global de entorno (ENV)</div>
                <div className="text-sm font-black">
                  {envKeyConfigured
                    ? 'Configurada'
                    : 'No definida (usa claves por barrio / JWT)'}
                </div>
                <p className="text-[11px] opacity-75">
                  Las garitas también pueden autenticarse mediante clave API por comunidad.
                </p>
              </section>

              <section
                className="border border-white/10 p-5 rounded-2xl shadow-sm space-y-2"
                style={cardStyle}
              >
                <div className="text-xs opacity-75">Modos de autenticación soportados</div>
                <div className="text-sm font-black font-mono">x-api-key · Bearer JWT</div>
                <p className="text-[11px] opacity-75">
                  Roles internos con acceso a verificación: admin, superadmin y security.
                </p>
              </section>

              <section
                className="border border-white/10 p-5 rounded-2xl shadow-sm space-y-2"
                style={cardStyle}
              >
                <div className="text-xs opacity-75">Base URL activa del backend</div>
                <div className="text-sm font-black font-mono break-all">{API_BASE}</div>
                <p className="text-[11px] opacity-75">
                  Zona horaria de visualización activa: {activeTimeZone}.
                </p>
              </section>
            </div>

            {/* Catálogo filtrable y paginado de endpoints del backend con prueba rápida en vivo */}
            <section className={`${SECTION_CARD_CLASS} space-y-4`} style={cardStyle}>
              <div>
                <h3 className="text-sm font-bold">
                  Mapa de Endpoints del Backend ({filteredEndpoints.length})
                </h3>
                <p className="text-xs opacity-80 mt-0.5">
                  Consultá permisos, autenticación y ejecutá una prueba rápida sobre endpoints habilitados.
                </p>
              </div>

              <AdminListToolbar
                searchValue={endpointFilter}
                onSearchChange={(val) => {
                  setEndpointFilter(val);
                  setEndpointPage(1);
                }}
                searchPlaceholder="Buscar ruta, método, rol o módulo..."
                filters={
                  <select
                    value={endpointModuleFilter}
                    onChange={(e) => {
                      setEndpointModuleFilter(e.target.value);
                      setEndpointPage(1);
                    }}
                    className={`px-3 ${FIELD_INPUT_CLASS} cursor-pointer`}
                    style={innerStyle}
                    aria-label="Filtrar por módulo"
                  >
                    <option value="all">Todos los módulos</option>
                    {ENDPOINT_MODULES.map((mod) => (
                      <option key={mod} value={mod}>
                        {mod}
                      </option>
                    ))}
                  </select>
                }
                chips={[
                  { id: 'all', label: 'Todos', count: SYSTEM_ENDPOINTS_CATALOG.length },
                  {
                    id: 'testable',
                    label: 'Probables en vivo (GET)',
                    count: SYSTEM_ENDPOINTS_CATALOG.filter((e) => e.testable).length,
                  },
                  {
                    id: 'sandbox',
                    label: 'Referencia / Sandbox',
                    count: SYSTEM_ENDPOINTS_CATALOG.filter((e) => !e.testable).length,
                  },
                ]}
                activeChip={endpointModeChip}
                onChipChange={(nextChip) => {
                  setEndpointModeChip(nextChip);
                  setEndpointPage(1);
                }}
                hasActiveFilters={
                  Boolean(endpointFilter.trim()) ||
                  endpointModuleFilter !== 'all' ||
                  endpointModeChip !== 'all'
                }
                onResetFilters={() => {
                  setEndpointFilter('');
                  setEndpointModuleFilter('all');
                  setEndpointModeChip('all');
                  setEndpointPage(1);
                }}
                innerStyle={innerStyle}
              />

              {pagedEndpoints.pageItems.length === 0 ? (
                <div
                  className="text-center py-6 rounded-xl border border-white/10 text-xs opacity-80"
                  style={innerStyle}
                >
                  No hay endpoints que coincidan con el filtro aplicado.
                </div>
              ) : (
                <div
                  className="overflow-x-auto rounded-xl border border-white/10"
                  style={innerStyle}
                >
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 opacity-75">
                        <th className="py-2.5 px-3 font-semibold">Método</th>
                        <th className="py-2.5 px-3 font-semibold">Ruta / Módulo</th>
                        <th className="py-2.5 px-3 font-semibold">Auth / Roles</th>
                        <th className="py-2.5 px-3 font-semibold">Función</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {pagedEndpoints.pageItems.map((ep) => {
                        const isProbing = probingEndpointId === ep.id;
                        return (
                          <tr key={ep.id}>
                            <td className="py-2.5 px-3 font-mono font-bold text-sky-300 whitespace-nowrap">
                              {ep.method}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-mono text-[11px]">{ep.path}</div>
                              <div className="text-[10px] opacity-70">{ep.module}</div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold flex items-center gap-1">
                                <Lock size={11} className="opacity-70 shrink-0" />
                                <span>{ep.auth}</span>
                              </div>
                              <div className="text-[11px] opacity-75 font-mono">{ep.roles}</div>
                            </td>
                            <td className="py-2.5 px-3 opacity-85">{ep.summary}</td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              {ep.testable ? (
                                <button
                                  type="button"
                                  disabled={isProbing}
                                  onClick={() => handleProbeEndpoint(ep)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50 cursor-pointer"
                                >
                                  <Play size={11} />
                                  {isProbing ? 'Probando...' : 'Probar'}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleLoadTokenInSandbox(testQrToken)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-white/15 cursor-pointer"
                                  style={cardStyle}
                                >
                                  <QrCode size={11} /> Sandbox
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Paginación unificada 6 / 12 / 24 / 50 */}
              <AdminPaginationBar
                page={pagedEndpoints.safePage}
                totalPages={pagedEndpoints.totalPages}
                totalItems={pagedEndpoints.totalItems}
                pageSize={endpointPageSize}
                onPageChange={setEndpointPage}
                onPageSizeChange={(nextSize) => {
                  setEndpointPageSize(nextSize);
                  setEndpointPage(1);
                }}
                itemLabel="endpoint(s)"
                innerStyle={innerStyle}
              />

              {/* Visor de respuesta de la última prueba rápida ejecutada */}
              {endpointProbeResult && (
                <div
                  className="border border-white/10 rounded-xl p-4 space-y-2.5"
                  style={innerStyle}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 font-bold">
                      {endpointProbeResult.ok ? (
                        <CheckCircle2 size={15} className="text-emerald-400" />
                      ) : (
                        <XCircle size={15} className="text-rose-400" />
                      )}
                      <span className="font-mono">{endpointProbeResult.path}</span>
                      <span
                        className="font-mono text-[11px] px-2 py-0.5 rounded border border-white/15"
                        style={cardStyle}
                      >
                        HTTP {endpointProbeResult.status}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] opacity-80">
                      {endpointProbeResult.latencyMs} ms
                    </span>
                  </div>
                  <pre className="text-[11px] font-mono overflow-x-auto max-h-56 opacity-90">
                    {JSON.stringify(endpointProbeResult.body, null, 2)}
                  </pre>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ==================== PESTAÑA 3: APARIENCIA (MARCA Y ESTILOS) ==================== */}
        {activeTab === 'appearance' && <BrandingSettingsView embedded />}
      </main>
    </div>
  );
}
