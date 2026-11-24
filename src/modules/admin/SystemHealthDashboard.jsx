/**
 * @file SystemHealthDashboard.jsx
 * @description Consola integral exclusiva para el rol 'superadmin' organizada en tres pestañas:
 * 1) Resumen: monitoreo en tiempo real del Backend, PostgreSQL y API Externa (con detalle técnico
 *    desplegable); gestión CRUD paginada de Comunidades/Barrios privados con licenciamiento B2B
 *    (planes, estado comercial, vigencia, extensión rápida +30d, cuota mensual QR y exportación CSV);
 *    administración de Claves API por comunidad (creación, rotación, activación/revocación);
 *    listado paginado de Pases QR recientes con persistencia de 'expired', copia de token y cancelación;
 *    y Sandbox externo para validar tokens QR contra POST /api/v1/external/passes/verify.
 * 2) Endpoints: tarjetas de configuración del entorno, catálogo filtrable de endpoints del backend
 *    con requisitos de autenticación/roles y prueba rápida GET en vivo.
 * 3) Auditoría: KPIs de acceso, bitácora paginada de validaciones de garita con exportación CSV,
 *    y resumen/listado de contratos y transacciones financieras con exportación CSV.
 * @location /trustlink-web/src/modules/admin/SystemHealthDashboard.jsx
 */

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Server,
  Database,
  KeyRound,
  RefreshCw,
  Building2,
  Plus,
  Pencil,
  Check,
  X,
  Copy,
  RotateCcw,
  ShieldCheck,
  QrCode,
  Ban,
  Search,
  Send,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ClipboardList,
  Receipt,
  Webhook,
  Play,
  Lock,
  Download
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';
import { useAuth } from '../auth/AuthContext';
import { API_BASE } from '../../config/api';
import { downloadCsv } from '../../utils/csvExport';

// Zona horaria por defecto utilizada cuando el perfil del usuario no define una propia
const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

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
    testable: true
  },
  {
    id: 'external-status',
    method: 'GET',
    path: '/api/v1/external/status',
    module: 'Diagnóstico',
    auth: 'Bearer JWT',
    roles: 'superadmin',
    summary: 'Evalúa conexión y latencia de PostgreSQL, uptime y métricas generales de la red.',
    testable: true
  },
  {
    id: 'external-passes-verify',
    method: 'POST',
    path: '/api/v1/external/passes/verify',
    module: 'Garita / API Externa',
    auth: 'x-api-key o Bearer JWT',
    roles: 'external_gate / admin / superadmin / security',
    summary: 'Valida token QR, vigencia horaria, comunidad y compliance del prestador en tiempo real.',
    testable: false
  },
  {
    id: 'external-countries',
    method: 'GET / POST',
    path: '/api/v1/external/countries',
    module: 'Comunidades',
    auth: 'Bearer JWT',
    roles: 'superadmin',
    summary: 'Lista con paginación y da de alta barrios/comunidades con plan B2B y consumo mensual QR.',
    testable: false
  },
  {
    id: 'external-countries-billing',
    method: 'PATCH',
    path: '/api/v1/external/countries/:id/billing',
    module: 'Licenciamiento B2B',
    auth: 'Bearer JWT',
    roles: 'superadmin',
    summary: 'Actualiza plan comercial, estado (trial/active/grace/suspended), vigencia y cuota mensual QR.',
    testable: false
  },
  {
    id: 'external-my-community-billing',
    method: 'GET',
    path: '/api/v1/external/my-community/billing',
    module: 'Licenciamiento B2B',
    auth: 'Bearer JWT',
    roles: 'admin / superadmin',
    summary: 'Consulta el plan B2B vigente, vencimiento y consumo mensual de validaciones QR de una comunidad.',
    testable: true
  },
  {
    id: 'external-integrations',
    method: 'GET / POST',
    path: '/api/v1/external/integrations',
    module: 'Claves API',
    auth: 'Bearer JWT',
    roles: 'superadmin',
    summary: 'Administra claves de integración por comunidad (crear, rotar y activar/revocar).',
    testable: false
  },
  {
    id: 'external-audit',
    method: 'GET',
    path: '/api/v1/external/audit',
    module: 'Auditoría',
    auth: 'Bearer JWT',
    roles: 'superadmin',
    summary: 'Consulta bitácora paginada de accesos (autorizados/denegados) y transacciones.',
    testable: false
  },
  {
    id: 'providers-directory',
    method: 'GET',
    path: '/api/v1/providers/directory',
    module: 'Prestadores',
    auth: 'Bearer JWT',
    roles: 'owner / family / admin / superadmin',
    summary: 'Devuelve el directorio unificado de prestadores aprobados con especialidades y scoring.',
    testable: false
  },
  {
    id: 'providers-compliance',
    method: 'PATCH',
    path: '/api/v1/providers/compliance',
    module: 'Compliance',
    auth: 'Bearer JWT',
    roles: 'superadmin',
    summary: 'Aprueba, rechaza o deja pendiente el estado de compliance global de un prestador.',
    testable: false
  }
];

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
      minute: '2-digit'
    });
  } catch {
    return new Date(ms).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

/**
 * Panel principal de Salud, APIs, Comunidades B2B y Auditoría para usuarios `superadmin`.
 * Centraliza monitoreo operativo, administración de barrios/licencias, gestión de API keys,
 * control de pases QR, pruebas en sandbox y auditoría de accesos y transacciones.
 *
 * @returns {JSX.Element} Consola administrativa de salud y diagnóstico del sistema.
 */
export default function SystemHealthDashboard() {
  // Contextos globales de marca y autenticación; zona horaria activa del usuario
  const { brand } = useBranding();
  const { user } = useAuth();
  const activeTimeZone = user?.timezone || user?.time_zone || DEFAULT_TIMEZONE;

  // Estilos dinámicos de tarjetas principales y contenedores internos según branding activo
  const cardStyle = {
    backgroundColor: brand?.cardBgColor || '#020617',
    color: brand?.cardTextColor || '#F1F5F9',
  };

  const innerStyle = {
    backgroundColor: brand?.innerBgColor || '#0F172A',
    color: brand?.innerTextColor || '#F1F5F9',
  };

  // Pestaña activa de la consola ('health' | 'endpoints' | 'audit')
  const [activeTab, setActiveTab] = useState('health');

  // Estado de salud, latencia HTTP y diagnóstico de backend y base de datos
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [healthHttpStatus, setHealthHttpStatus] = useState(null);
  const [diagHttpStatus, setDiagHttpStatus] = useState(null);
  const [httpLatencyMs, setHttpLatencyMs] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [diagnosticsData, setDiagnosticsData] = useState(null);
  const [showBackendDiagDetails, setShowBackendDiagDetails] = useState(false);

  // Estado del filtro y prueba rápida en vivo desde la pestaña Endpoints
  const [endpointFilter, setEndpointFilter] = useState('');
  const [probingEndpointId, setProbingEndpointId] = useState(null);
  const [endpointProbeResult, setEndpointProbeResult] = useState(null);

  // Estado de listado, filtros, paginación y CRUD de Comunidades (countries)
  const [countries, setCountries] = useState([]);
  const [allCountriesOptions, setAllCountriesOptions] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [countryLoadError, setCountryLoadError] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [countryStatusFilter, setCountryStatusFilter] = useState('all');
  const [countryPage, setCountryPage] = useState(1);
  const [countryPageSize, setCountryPageSize] = useState(4);
  const [countryTotalPages, setCountryTotalPages] = useState(1);
  const [countryTotalCount, setCountryTotalCount] = useState(0);

  // Campos del formulario de alta de nueva comunidad y feedback de acciones
  const [newCountryName, setNewCountryName] = useState('');
  const [newCountryAddress, setNewCountryAddress] = useState('');
  const [newCountryPostalCode, setNewCountryPostalCode] = useState('');
  const [newCountryCity, setNewCountryCity] = useState('');
  const [newCountryProvince, setNewCountryProvince] = useState('');
  const [creatingCountry, setCreatingCountry] = useState(false);
  const [countryFeedback, setCountryFeedback] = useState(null);

  // Campos de edición en línea para los datos de una comunidad existente
  const [editingCountryId, setEditingCountryId] = useState(null);
  const [editCountryName, setEditCountryName] = useState('');
  const [editCountryAddress, setEditCountryAddress] = useState('');
  const [editCountryPostalCode, setEditCountryPostalCode] = useState('');
  const [editCountryCity, setEditCountryCity] = useState('');
  const [editCountryProvince, setEditCountryProvince] = useState('');
  const [savingCountryId, setSavingCountryId] = useState(null);

  // Estado de licenciamiento B2B y cuota mensual de validaciones QR por comunidad
  const [b2bPlans, setB2bPlans] = useState([]);
  const [editingBillingCountryId, setEditingBillingCountryId] = useState(null);
  const [billingPlanDraft, setBillingPlanDraft] = useState('pilot');
  const [billingStatusDraft, setBillingStatusDraft] = useState('active');
  const [billingQuotaDraft, setBillingQuotaDraft] = useState('');
  const [savingBillingCountryId, setSavingBillingCountryId] = useState(null);

  // Estado de Integraciones / Claves API por comunidad (alta, vista única y paginación)
  const [integrations, setIntegrations] = useState([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);
  const [selectedCountryForKey, setSelectedCountryForKey] = useState('');
  const [newKeyLabel, setNewKeyLabel] = useState('Garita Principal');
  const [creatingKey, setCreatingKey] = useState(false);
  const [latestPlainKey, setLatestPlainKey] = useState(null);
  const [integrationFeedback, setIntegrationFeedback] = useState(null);
  const [integrationsPage, setIntegrationsPage] = useState(1);
  const [integrationsPageSize, setIntegrationsPageSize] = useState(6);
  const [integrationsTotalPages, setIntegrationsTotalPages] = useState(1);
  const [integrationsTotalCount, setIntegrationsTotalCount] = useState(0);

  // Estado de Pases QR recientes (filtros, paginación, copiado y cancelación)
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

  // Estado de la pestaña Auditoría: bitácora de garita, paginación y transacciones
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditOutcomeFilter, setAuditOutcomeFilter] = useState('all');
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(8);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditTotalCount, setAuditTotalCount] = useState(0);
  const [accessSummary, setAccessSummary] = useState({
    total_attempts: 0,
    authorized_count: 0,
    denied_count: 0
  });
  const [accessLogs, setAccessLogs] = useState([]);
  const [transactionsSummary, setTransactionsSummary] = useState({
    total_transactions: 0,
    gross_volume: 0,
    platform_fee_total: 0,
    provider_payout_total: 0
  });
  const [recentTransactions, setRecentTransactions] = useState([]);

  /**
   * Genera el encabezado de autenticación Bearer JWT leyendo el token de sesión en `localStorage`.
   *
   * @returns {{ Authorization: string }} Cabeceras HTTP de autorización.
   */
  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`
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
          headers: getAuthHeaders()
        })
      ]);

      const elapsed = Math.round(performance.now() - startedAt);
      setHttpLatencyMs(elapsed);
      setHealthHttpStatus(healthRes.status);
      setDiagHttpStatus(diagRes.status);

      const healthJson = await healthRes.json().catch(() => null);
      setHealthData({
        ok: healthRes.ok,
        status: healthRes.status,
        body: healthJson
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
        headers: needsAuth ? getAuthHeaders() : {}
      });
      const elapsed = Math.round(performance.now() - startedAt);
      const body = await res.json().catch(() => ({}));

      setEndpointProbeResult({
        endpointId: ep.id,
        path: ep.path,
        ok: res.ok,
        status: res.status,
        latencyMs: elapsed,
        body
      });
    } catch (err) {
      console.error('Error al probar endpoint:', err);
      setEndpointProbeResult({
        endpointId: ep.id,
        path: ep.path,
        ok: false,
        status: 0,
        latencyMs: Math.round(performance.now() - startedAt),
        body: { error: 'No se pudo alcanzar el endpoint en el backend.' }
      });
    } finally {
      setProbingEndpointId(null);
    }
  };

  /**
   * Obtiene hasta 100 comunidades sin filtrar para poblar el selector completo
   * al generar claves API y preselecciona la primera comunidad si no hay una elegida.
   *
   * @returns {Promise<void>}
   */
  const fetchAllCountriesForSelector = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/countries?page=1&limit=100`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        const list = data.countries || [];
        setAllCountriesOptions(list);
        if (!selectedCountryForKey && list.length > 0) {
          setSelectedCountryForKey(String(list[0].id));
        }
      }
    } catch (err) {
      console.error('Error al cargar opciones de comunidades:', err);
    }
  };

  /**
   * Consulta la lista paginada de comunidades aplicando búsqueda y filtro de estado,
   * sincronizando además el catálogo de planes B2B disponibles y la paginación.
   *
   * @param {number} [pageToLoad=countryPage] - Página a solicitar.
   * @param {string} [searchToLoad=countrySearch] - Texto de búsqueda por nombre/ubicación.
   * @param {number} [limitToLoad=countryPageSize] - Cantidad de registros por página.
   * @param {string} [statusToLoad=countryStatusFilter] - Filtro de estado (`all`, `active`, `inactive`).
   * @returns {Promise<void>}
   */
  const fetchCountries = async (
    pageToLoad = countryPage,
    searchToLoad = countrySearch,
    limitToLoad = countryPageSize,
    statusToLoad = countryStatusFilter
  ) => {
    setLoadingCountries(true);
    setCountryLoadError('');
    try {
      const params = new URLSearchParams({
        page: String(pageToLoad),
        limit: String(limitToLoad),
        search: searchToLoad,
        status: statusToLoad
      });
      const res = await fetch(`${API_BASE}/api/v1/external/countries?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        const list = data.countries || [];
        setCountries(list);
        if (Array.isArray(data.b2b_plans)) {
          setB2bPlans(data.b2b_plans);
        }
        if (!selectedCountryForKey && list.length > 0) {
          setSelectedCountryForKey(String(list[0].id));
        }
        const pagination = data.pagination || {};
        setCountryPage(pagination.page || pageToLoad);
        setCountryTotalPages(pagination.totalPages || 1);
        setCountryTotalCount(pagination.total ?? list.length);
      } else {
        setCountryLoadError(data.error || `Error HTTP ${res.status} al cargar comunidades.`);
      }
    } catch (error) {
      console.error('Error al cargar comunidades:', error);
      setCountryLoadError('Error de conexión al consultar las comunidades.');
    } finally {
      setLoadingCountries(false);
    }
  };

  /**
   * Obtiene la página solicitada de integraciones (claves API por comunidad) desde el backend.
   *
   * @param {number} [pageToLoad=integrationsPage] - Número de página a consultar.
   * @param {number} [limitToLoad=integrationsPageSize] - Cantidad de claves por página.
   * @returns {Promise<void>}
   */
  const fetchIntegrations = async (
    pageToLoad = integrationsPage,
    limitToLoad = integrationsPageSize
  ) => {
    setLoadingIntegrations(true);
    try {
      const params = new URLSearchParams({
        page: String(pageToLoad),
        limit: String(limitToLoad)
      });
      const res = await fetch(`${API_BASE}/api/v1/external/integrations?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        const list = data.integrations || [];
        setIntegrations(list);
        const pagination = data.pagination || {};
        setIntegrationsPage(pagination.page || pageToLoad);
        setIntegrationsTotalPages(pagination.totalPages || 1);
        setIntegrationsTotalCount(pagination.total ?? list.length);
      }
    } catch (error) {
      console.error('Error al cargar integraciones por comunidad:', error);
    } finally {
      setLoadingIntegrations(false);
    }
  };

  /**
   * Consulta los pases QR recientes aplicando paginación, filtro de estado y texto de búsqueda,
   * actualizando `referenceNowMs` para evaluar vigencias vencidas de forma consistente.
   *
   * @param {number} [pageToLoad=passPage] - Número de página a cargar.
   * @param {string} [statusToLoad=passStatusFilter] - Estado solicitado (`all`, `pending`, `expired`, `used`, `cancelled`).
   * @param {string} [searchToLoad=passSearch] - Filtro por prestador, barrio o token.
   * @param {number} [limitToLoad=passPageSize] - Registros por página.
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
        search: searchToLoad
      });
      const res = await fetch(`${API_BASE}/api/v1/external/passes?${params.toString()}`, {
        headers: getAuthHeaders()
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

  /**
   * Obtiene el panorama de auditoría del sistema: métricas globales de accesos,
   * bitácora paginada de validaciones de garita y resumen/listado de transacciones recientes.
   *
   * @param {number} [pageToLoad=auditPage] - Página de la bitácora de accesos.
   * @param {string} [outcomeToLoad=auditOutcomeFilter] - Resultado a filtrar (`all`, `authorized`, `denied`).
   * @param {string} [searchToLoad=auditSearch] - Búsqueda por motivo, barrio o token.
   * @param {number} [limitToLoad=auditPageSize] - Eventos por página.
   * @returns {Promise<void>}
   */
  const fetchAuditOverview = async (
    pageToLoad = auditPage,
    outcomeToLoad = auditOutcomeFilter,
    searchToLoad = auditSearch,
    limitToLoad = auditPageSize
  ) => {
    setLoadingAudit(true);
    setAuditError('');
    try {
      const params = new URLSearchParams({
        page: String(pageToLoad),
        limit: String(limitToLoad),
        outcome: outcomeToLoad,
        search: searchToLoad
      });
      const res = await fetch(`${API_BASE}/api/v1/external/audit?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setAccessSummary(
          data.access_summary || {
            total_attempts: 0,
            authorized_count: 0,
            denied_count: 0
          }
        );
        setAccessLogs(data.access_logs || []);
        const pagination = data.access_pagination || {};
        setAuditPage(pagination.page || pageToLoad);
        setAuditTotalPages(pagination.totalPages || 1);
        setAuditTotalCount(pagination.total ?? (data.access_logs || []).length);

        setTransactionsSummary(
          data.transactions_summary || {
            total_transactions: 0,
            gross_volume: 0,
            platform_fee_total: 0,
            provider_payout_total: 0
          }
        );
        setRecentTransactions(data.recent_transactions || []);
      } else {
        setAuditError(data.error || 'No se pudo cargar la auditoría del sistema.');
      }
    } catch (error) {
      console.error('Error al cargar auditoría:', error);
      setAuditError('Error de conexión al consultar auditoría.');
    } finally {
      setLoadingAudit(false);
    }
  };

  // Carga inicial al montar el dashboard: salud, catálogo de comunidades, claves y pases recientes
  useEffect(() => {
    fetchSystemHealth();
    fetchAllCountriesForSelector();
    fetchCountries(1, '', 4, 'all');
    fetchIntegrations(1, 6);
    fetchRecentPasses(1, 'all', '', 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carga diferida de la auditoría de accesos y transacciones al ingresar en la pestaña 'audit'
  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditOverview(auditPage, auditOutcomeFilter, auditSearch, auditPageSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  /**
   * Refresca en paralelo todos los bloques de datos de la consola, incluyendo
   * la auditoría si la pestaña `audit` se encuentra activa.
   *
   * @returns {Promise<void>}
   */
  const handleRefreshAll = async () => {
    await Promise.all([
      fetchSystemHealth(),
      fetchAllCountriesForSelector(),
      fetchCountries(countryPage, countrySearch, countryPageSize, countryStatusFilter),
      fetchIntegrations(integrationsPage, integrationsPageSize),
      fetchRecentPasses(passPage, passStatusFilter, passSearch, passPageSize),
      ...(activeTab === 'audit'
        ? [fetchAuditOverview(auditPage, auditOutcomeFilter, auditSearch, auditPageSize)]
        : [])
    ]);
  };

  /**
   * Restablece los filtros de búsqueda y estado de comunidades y recarga desde la página 1.
   *
   * @returns {Promise<void>}
   */
  const handleResetCountryFilters = async () => {
    setCountrySearch('');
    setCountryStatusFilter('all');
    setCountryPage(1);
    await fetchCountries(1, '', countryPageSize, 'all');
  };

  /**
   * Da de alta una nueva comunidad/barrio privado en el backend (`POST /api/v1/external/countries`),
   * reinicia el formulario y refresca el selector, listado paginado y métricas de salud.
   *
   * @param {React.FormEvent<HTMLFormElement>} e - Evento de envío del formulario.
   * @returns {Promise<void>}
   */
  const handleCreateCountry = async (e) => {
    e.preventDefault();
    if (!newCountryName.trim()) return;
    setCreatingCountry(true);
    setCountryFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/countries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          name: newCountryName.trim(),
          address: newCountryAddress.trim() || null,
          postal_code: newCountryPostalCode.trim() || null,
          city: newCountryCity.trim() || null,
          province: newCountryProvince.trim() || null
        })
      });
      const data = await res.json();
      if (res.ok) {
        setCountryFeedback({ type: 'success', message: data.message || 'Comunidad creada.' });
        setNewCountryName('');
        setNewCountryAddress('');
        setNewCountryPostalCode('');
        setNewCountryCity('');
        setNewCountryProvince('');
        await Promise.all([
          fetchAllCountriesForSelector(),
          fetchCountries(1, countrySearch, countryPageSize, countryStatusFilter),
          fetchSystemHealth()
        ]);
      } else {
        setCountryFeedback({
          type: 'error',
          message: data.error || 'No se pudo crear la comunidad.'
        });
      }
    } catch (error) {
      console.error('Error al crear comunidad:', error);
      setCountryFeedback({ type: 'error', message: 'Error de conexión al crear comunidad.' });
    } finally {
      setCreatingCountry(false);
    }
  };

  /**
   * Habilita la edición en línea de los datos generales de una comunidad precargando sus campos actuales.
   *
   * @param {Object} c - Registro de la comunidad a editar.
   * @returns {void}
   */
  const startEditingCountry = (c) => {
    setEditingCountryId(c.id);
    setEditCountryName(c.name || '');
    setEditCountryAddress(c.address || '');
    setEditCountryPostalCode(c.postal_code || '');
    setEditCountryCity(c.city || '');
    setEditCountryProvince(c.province || '');
    setCountryFeedback(null);
  };

  /**
   * Persiste los cambios de nombre y ubicación de una comunidad (`PATCH /api/v1/external/countries/:id`)
   * y recarga el selector y la página actual del listado.
   *
   * @param {number} countryId - Identificador de la comunidad editada.
   * @returns {Promise<void>}
   */
  const handleSaveCountryEdit = async (countryId) => {
    if (!editCountryName.trim()) return;
    setSavingCountryId(countryId);
    setCountryFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/countries/${countryId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          name: editCountryName.trim(),
          address: editCountryAddress.trim() || null,
          postal_code: editCountryPostalCode.trim() || null,
          city: editCountryCity.trim() || null,
          province: editCountryProvince.trim() || null
        })
      });
      const data = await res.json();
      if (res.ok) {
        setCountryFeedback({
          type: 'success',
          message: data.message || 'Comunidad actualizada.'
        });
        setEditingCountryId(null);
        await Promise.all([
          fetchAllCountriesForSelector(),
          fetchCountries(countryPage, countrySearch, countryPageSize, countryStatusFilter)
        ]);
      } else {
        setCountryFeedback({
          type: 'error',
          message: data.error || 'No se pudo actualizar la comunidad.'
        });
      }
    } catch (error) {
      console.error('Error al actualizar comunidad:', error);
      setCountryFeedback({ type: 'error', message: 'Error de conexión al actualizar.' });
    } finally {
      setSavingCountryId(null);
    }
  };

  /**
   * Inicializa el editor en línea de licenciamiento B2B (plan, estado comercial y cuota mensual QR)
   * para la comunidad seleccionada.
   *
   * @param {Object} country - Registro de la comunidad cuya licencia B2B se va a modificar.
   * @returns {void}
   */
  const startEditingCountryBilling = (country) => {
    setEditingBillingCountryId(country.id);
    setBillingPlanDraft(country.plan_code || 'pilot');
    setBillingStatusDraft(country.billing_status || 'active');
    setBillingQuotaDraft(
      country.monthly_pass_quota !== null && country.monthly_pass_quota !== undefined
        ? String(country.monthly_pass_quota)
        : ''
    );
  };

  /**
   * Actualiza la configuración de licenciamiento B2B de una comunidad (`PATCH /api/v1/external/countries/:id/billing`),
   * permitiendo usar los valores del borrador en edición o un payload directo (ej. extensión `+30d`).
   *
   * @param {number} countryId - Identificador de la comunidad.
   * @param {Object|null} [overridePayload=null] - Payload opcional para acciones rápidas sin pasar por el borrador.
   * @returns {Promise<void>}
   */
  const handleSaveCountryBilling = async (countryId, overridePayload = null) => {
    setSavingBillingCountryId(countryId);
    setCountryFeedback(null);
    try {
      const payload = overridePayload || {
        plan_code: billingPlanDraft,
        billing_status: billingStatusDraft,
        monthly_pass_quota: billingQuotaDraft.trim() === '' ? null : Number(billingQuotaDraft),
      };
      const res = await fetch(`${API_BASE}/api/v1/external/countries/${countryId}/billing`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setCountryFeedback({
          type: 'success',
          message: data.message || 'Licencia B2B actualizada.',
        });
        setEditingBillingCountryId(null);
        await Promise.all([
          fetchAllCountriesForSelector(),
          fetchCountries(countryPage, countrySearch, countryPageSize, countryStatusFilter),
          fetchSystemHealth(),
        ]);
      } else {
        setCountryFeedback({
          type: 'error',
          message: data.error || 'No se pudo actualizar la licencia B2B.',
        });
      }
    } catch (error) {
      console.error('Error al actualizar licencia B2B:', error);
      setCountryFeedback({ type: 'error', message: 'Error de conexión al guardar la licencia B2B.' });
    } finally {
      setSavingBillingCountryId(null);
    }
  };

  /**
   * Devuelve la etiqueta legible y las clases Tailwind del badge según el estado comercial B2B.
   *
   * @param {string|null|undefined} billingStatus - Estado de facturación (`active`, `trial`, `grace`, `suspended`).
   * @returns {{ label: string, cls: string }} Metadatos de presentación del badge.
   */
  const getB2BBillingBadge = (billingStatus) => {
    const st = String(billingStatus || 'active').toLowerCase();
    if (st === 'suspended') {
      return { label: 'Suspendida', cls: 'bg-rose-950 text-rose-300 border-rose-800' };
    }
    if (st === 'grace') {
      return { label: 'Gracia', cls: 'bg-amber-950 text-amber-300 border-amber-700' };
    }
    if (st === 'trial') {
      return { label: 'Prueba', cls: 'bg-sky-950 text-sky-300 border-sky-800' };
    }
    return { label: 'B2B Activa', cls: 'bg-emerald-950 text-emerald-300 border-emerald-800' };
  };

  /**
   * Activa o desactiva una comunidad (`PATCH /api/v1/external/countries/:id/toggle`)
   * y actualiza el listado y los indicadores globales de salud.
   *
   * @param {Object} country - Comunidad cuyo estado `is_active` se invertirá.
   * @returns {Promise<void>}
   */
  const handleToggleCountry = async (country) => {
    setCountryFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/countries/${country.id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ is_active: !country.is_active })
      });
      const data = await res.json();
      if (res.ok) {
        setCountryFeedback({ type: 'success', message: data.message || 'Estado actualizado.' });
        await Promise.all([
          fetchAllCountriesForSelector(),
          fetchCountries(countryPage, countrySearch, countryPageSize, countryStatusFilter),
          fetchSystemHealth()
        ]);
      } else {
        setCountryFeedback({
          type: 'error',
          message: data.error || 'No se pudo cambiar el estado.'
        });
      }
    } catch (error) {
      console.error('Error al cambiar estado de comunidad:', error);
      setCountryFeedback({ type: 'error', message: 'Error de conexión.' });
    }
  };

  /**
   * Genera una nueva clave API para la comunidad seleccionada (`POST /api/v1/external/integrations`),
   * expone por única vez la clave en texto plano y la precarga automáticamente en el sandbox.
   *
   * @param {React.FormEvent<HTMLFormElement>} e - Evento de envío del formulario de creación.
   * @returns {Promise<void>}
   */
  const handleCreateIntegrationKey = async (e) => {
    e.preventDefault();
    if (!selectedCountryForKey) return;
    setCreatingKey(true);
    setIntegrationFeedback(null);
    setLatestPlainKey(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/integrations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          country_id: Number(selectedCountryForKey),
          label: newKeyLabel.trim() || 'Garita Principal'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setIntegrationFeedback({
          type: 'success',
          message: data.message || 'Clave API generada.'
        });
        if (data.api_key) {
          setLatestPlainKey({
            label: `${data.integration?.country_name || 'Comunidad'} — ${data.integration?.label || ''}`,
            key: data.api_key
          });
          setTestApiKey(data.api_key);
          setAuthMode('api_key');
        }
        await Promise.all([
          fetchIntegrations(1, integrationsPageSize),
          fetchCountries(countryPage, countrySearch, countryPageSize, countryStatusFilter),
          fetchSystemHealth()
        ]);
      } else {
        setIntegrationFeedback({
          type: 'error',
          message: data.error || 'No se pudo generar la clave API.'
        });
      }
    } catch (error) {
      console.error('Error al generar clave API:', error);
      setIntegrationFeedback({ type: 'error', message: 'Error de conexión al generar clave.' });
    } finally {
      setCreatingKey(false);
    }
  };

  /**
   * Rota una clave API existente (`PATCH /api/v1/external/integrations/:id/rotate`),
   * muestra la nueva clave generada en texto plano y la precarga en el sandbox.
   *
   * @param {Object} integration - Registro de integración a rotar.
   * @returns {Promise<void>}
   */
  const handleRotateIntegrationKey = async (integration) => {
    setIntegrationFeedback(null);
    setLatestPlainKey(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/integrations/${integration.id}/rotate`, {
        method: 'PATCH',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setIntegrationFeedback({
          type: 'success',
          message: data.message || 'Clave rotada correctamente.'
        });
        if (data.api_key) {
          setLatestPlainKey({
            label: `${integration.country_name} — ${integration.label} (Rotada)`,
            key: data.api_key
          });
          setTestApiKey(data.api_key);
          setAuthMode('api_key');
        }
        await fetchIntegrations(integrationsPage, integrationsPageSize);
      } else {
        setIntegrationFeedback({
          type: 'error',
          message: data.error || 'No se pudo rotar la clave.'
        });
      }
    } catch (error) {
      console.error('Error al rotar clave:', error);
      setIntegrationFeedback({ type: 'error', message: 'Error de conexión al rotar clave.' });
    }
  };

  /**
   * Activa o revoca una clave API existente (`PATCH /api/v1/external/integrations/:id/toggle`)
   * y actualiza la tabla de claves, el conteo por comunidad y los indicadores de salud.
   *
   * @param {Object} integration - Registro de integración cuyo estado se invertirá.
   * @returns {Promise<void>}
   */
  const handleToggleIntegrationKey = async (integration) => {
    setIntegrationFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/integrations/${integration.id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ is_active: !integration.is_active })
      });
      const data = await res.json();
      if (res.ok) {
        setIntegrationFeedback({
          type: 'success',
          message: data.message || 'Estado de clave actualizado.'
        });
        await Promise.all([
          fetchIntegrations(integrationsPage, integrationsPageSize),
          fetchCountries(countryPage, countrySearch, countryPageSize, countryStatusFilter),
          fetchSystemHealth()
        ]);
      } else {
        setIntegrationFeedback({
          type: 'error',
          message: data.error || 'No se pudo actualizar la clave.'
        });
      }
    } catch (error) {
      console.error('Error al cambiar estado de clave:', error);
      setIntegrationFeedback({ type: 'error', message: 'Error de conexión.' });
    }
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
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setPassFeedback({
          type: 'success',
          message: data.message || `Pase #${passId} cancelado.`
        });
        await Promise.all([
          fetchRecentPasses(passPage, passStatusFilter, passSearch, passPageSize),
          fetchSystemHealth()
        ]);
      } else {
        setPassFeedback({
          type: 'error',
          message: data.error || 'No se pudo cancelar el pase.'
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
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE}/api/v1/external/passes/verify`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ qr_token: testQrToken.trim() })
      });

      const elapsed = Math.round(performance.now() - startedAt);
      const body = await response.json();

      setSandboxResponse({
        ok: response.ok,
        httpStatus: response.status,
        latencyMs: elapsed,
        body
      });

      if (activeTab === 'audit') {
        await fetchAuditOverview(auditPage, auditOutcomeFilter, auditSearch, auditPageSize);
      }
    } catch (error) {
      console.error('Error al probar endpoint externo:', error);
      setSandboxResponse({
        ok: false,
        httpStatus: 0,
        latencyMs: Math.round(performance.now() - startedAt),
        body: {
          authorized: false,
          code: 'NETWORK_ERROR',
          error: 'Error de red al invocar POST /api/v1/external/passes/verify.'
        }
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
   * Calcula el estado visual efectivo de un pase QR combinando su estado persistido
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
        badgeClass: 'bg-slate-800 text-slate-300 border-slate-700'
      };
    }
    if (rawStatus === 'used') {
      return {
        key: 'used',
        label: 'usado',
        sublabel: null,
        badgeClass: 'bg-sky-950 text-sky-300 border-sky-800'
      };
    }
    if (rawStatus === 'expired' || (rawStatus === 'pending' && isPastEnd)) {
      return {
        key: 'expired',
        label: 'vencido',
        sublabel: rawStatus === 'pending' && isPastEnd ? 'fin superado' : null,
        badgeClass: 'bg-amber-950 text-amber-300 border-amber-700'
      };
    }
    if (rawStatus === 'pending' && isBeforeStart) {
      return {
        key: 'pending',
        label: 'pending',
        sublabel: 'aún no inicia',
        badgeClass: 'bg-indigo-950 text-indigo-300 border-indigo-800'
      };
    }
    return {
      key: 'pending',
      label: 'pending',
      sublabel: 'vigente',
      badgeClass: 'bg-emerald-950 text-emerald-300 border-emerald-800'
    };
  };

  // Filtrado en cliente sobre los pases cargados según el estado efectivo resuelto
  const filteredPasses = recentPasses.filter((pass) => {
    if (passStatusFilter === 'all') return true;
    return resolvePassDisplayStatus(pass).key === passStatusFilter;
  });

  // Filtrado en cliente del catálogo de endpoints por ruta, módulo, método o descripción
  const filteredEndpoints = SYSTEM_ENDPOINTS_CATALOG.filter((ep) => {
    const q = endpointFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      ep.path.toLowerCase().includes(q) ||
      ep.module.toLowerCase().includes(q) ||
      ep.method.toLowerCase().includes(q) ||
      ep.summary.toLowerCase().includes(q)
    );
  });

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

  // Métricas agregadas de diagnóstico y lista completa para el selector de claves API
  const metrics = diagnosticsData?.metrics || {};
  const activeKeysCount = metrics.active_integrations ?? 0;
  const activeCountriesCount = metrics.active_countries ?? 0;
  const totalCountriesCount = metrics.total_countries ?? 0;
  const envKeyConfigured = Boolean(diagnosticsData?.external_endpoint?.env_api_key_configured);
  const selectorCountriesList =
    allCountriesOptions.length > 0 ? allCountriesOptions : countries;

  return (
    <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 md:py-8 flex-1">
      <main className="space-y-6">
        {/* Cabecera con selector de pestañas: Resumen, Endpoints y Auditoría */}
        <section
          className="border border-white/10 p-5 sm:p-6 rounded-2xl shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4"
          style={cardStyle}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="p-3 text-emerald-400 rounded-xl border border-white/15 shrink-0"
              style={innerStyle}
            >
              <Activity size={22} strokeWidth={1.8} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">Salud &amp; APIs</h2>
              <p className="text-xs opacity-80 mt-0.5">
                Estado del sistema, endpoints, barrios, claves de garita, pases QR y auditoría.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Selector de pestañas principales de la consola */}
            <div
              className="inline-flex rounded-xl p-1 border border-white/15"
              style={innerStyle}
            >
              <button
                type="button"
                onClick={() => setActiveTab('health')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'health'
                    ? 'bg-emerald-600 text-white'
                    : 'opacity-80 hover:opacity-100'
                }`}
              >
                Resumen
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('endpoints')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'endpoints'
                    ? 'bg-sky-600 text-white'
                    : 'opacity-80 hover:opacity-100'
                }`}
              >
                <Webhook size={13} /> Endpoints
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'audit'
                    ? 'bg-indigo-600 text-white'
                    : 'opacity-80 hover:opacity-100'
                }`}
              >
                <ClipboardList size={13} /> Auditoría
              </button>
            </div>

            <button
              type="button"
              onClick={handleRefreshAll}
              disabled={loadingStatus || loadingCountries || loadingPasses || loadingAudit}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-white/15 transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
              style={innerStyle}
            >
              <RefreshCw
                size={14}
                className={
                  loadingStatus || loadingCountries || loadingPasses || loadingAudit
                    ? 'animate-spin'
                    : ''
                }
              />
              Actualizar
            </button>
          </div>
        </section>

        {/* ==================== PESTAÑA 1: RESUMEN DEL SISTEMA ==================== */}
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
                className="border border-black/20 p-5 rounded-2xl shadow-sm space-y-3"
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
                  className="p-3 rounded-xl border border-black/20 space-y-1.5 text-xs"
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
                    className="p-3 rounded-xl border border-black/20 text-[11px] font-mono space-y-1 overflow-x-auto"
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
                className="border border-black/20 p-5 rounded-2xl shadow-sm space-y-3"
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
                  className="p-3 rounded-xl border border-black/20 space-y-1.5 text-xs"
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
                className="border border-black/20 p-5 rounded-2xl shadow-sm space-y-3"
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
                  className="p-3 rounded-xl border border-black/20 space-y-1.5 text-xs"
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
              </section>
            </div>

            {/* Gestión de Comunidades / Barrios Privados y Licenciamiento B2B */}
            <section
              className="border border-black/20 p-6 rounded-2xl shadow-sm space-y-4"
              style={cardStyle}
            >
              {/* Encabezado, buscador, filtro de estado y exportación CSV de comunidades B2B */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Building2 size={17} className="text-emerald-400" />
                  <h3 className="text-sm font-bold">Comunidades ({countryTotalCount})</h3>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <div className="relative">
                    <Search
                      size={13}
                      className="opacity-60 absolute left-2.5 top-1/2 -translate-y-1/2"
                    />
                    <input
                      type="text"
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setCountryPage(1);
                          fetchCountries(1, countrySearch, countryPageSize, countryStatusFilter);
                        }
                      }}
                      placeholder="Buscar barrio..."
                      className="pl-8 pr-3 py-1.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                      style={innerStyle}
                    />
                  </div>
                  <select
                    value={countryStatusFilter}
                    onChange={(e) => {
                      const nextStatus = e.target.value;
                      setCountryStatusFilter(nextStatus);
                      setCountryPage(1);
                      fetchCountries(1, countrySearch, countryPageSize, nextStatus);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                    style={innerStyle}
                  >
                    <option value="all">Todas</option>
                    <option value="active">Activas</option>
                    <option value="inactive">Inactivas</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      downloadCsv(
                        `trustlink-comunidades-b2b-${new Date().toISOString().slice(0, 10)}.csv`,
                        [
                          { key: 'id', label: 'ID' },
                          { key: 'name', label: 'Barrio' },
                          { key: 'city', label: 'Localidad' },
                          { key: 'province', label: 'Provincia' },
                          { key: 'plan_code', label: 'Plan B2B' },
                          { key: 'billing_status', label: 'Estado Comercial' },
                          { key: 'monthly_qr_used', label: 'QR Usados Mes' },
                          { key: 'monthly_pass_quota', label: 'Cuota Mensual' },
                          { key: 'active_keys_count', label: 'Claves API' },
                          { key: 'is_active', label: 'Activa' },
                        ],
                        countries
                      )
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/15 cursor-pointer hover:opacity-90"
                    style={innerStyle}
                  >
                    <Download size={12} /> CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCountryPage(1);
                      fetchCountries(1, countrySearch, countryPageSize, countryStatusFilter);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold border border-white/15 cursor-pointer hover:opacity-90"
                    style={innerStyle}
                  >
                    Filtrar
                  </button>
                  {(countrySearch || countryStatusFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={handleResetCountryFilters}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold border border-white/15 opacity-85 hover:opacity-100 cursor-pointer"
                      style={innerStyle}
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>

              {/* Formulario de alta rápida de una nueva comunidad */}
              <form onSubmit={handleCreateCountry} className="space-y-2.5 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    required
                    value={newCountryName}
                    onChange={(e) => setNewCountryName(e.target.value)}
                    placeholder="Nombre del barrio"
                    className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                    style={innerStyle}
                  />
                  <input
                    type="text"
                    value={newCountryAddress}
                    onChange={(e) => setNewCountryAddress(e.target.value)}
                    placeholder="Dirección / acceso"
                    className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                    style={innerStyle}
                  />
                  <input
                    type="text"
                    value={newCountryPostalCode}
                    onChange={(e) => setNewCountryPostalCode(e.target.value)}
                    placeholder="Código postal"
                    className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                    style={innerStyle}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    value={newCountryCity}
                    onChange={(e) => setNewCountryCity(e.target.value)}
                    placeholder="Localidad"
                    className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                    style={innerStyle}
                  />
                  <input
                    type="text"
                    value={newCountryProvince}
                    onChange={(e) => setNewCountryProvince(e.target.value)}
                    placeholder="Provincia"
                    className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                    style={innerStyle}
                  />
                  <button
                    type="submit"
                    disabled={creatingCountry || !newCountryName.trim()}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Plus size={14} /> {creatingCountry ? 'Guardando...' : 'Agregar'}
                  </button>
                </div>
              </form>

              {/* Alertas de error de carga y feedback de operaciones CRUD/B2B */}
              {countryLoadError && (
                <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs border bg-rose-950/50 border-rose-800 text-rose-200">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{countryLoadError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      fetchCountries(countryPage, countrySearch, countryPageSize, countryStatusFilter)
                    }
                    className="px-2.5 py-1 rounded-lg bg-rose-900 text-white font-bold cursor-pointer shrink-0"
                  >
                    Reintentar
                  </button>
                </div>
              )}

              {countryFeedback && (
                <div
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs border ${
                    countryFeedback.type === 'success'
                      ? 'bg-emerald-950/50 border-emerald-800 text-emerald-200'
                      : 'bg-rose-950/50 border-rose-800 text-rose-200'
                  }`}
                >
                  {countryFeedback.type === 'success' ? (
                    <CheckCircle2 size={15} />
                  ) : (
                    <AlertCircle size={15} />
                  )}
                  <span>{countryFeedback.message}</span>
                </div>
              )}

              {/* Tabla de comunidades con edición en línea de datos generales y licencia B2B */}
              {loadingCountries ? (
                <div className="text-center py-6 text-xs opacity-80">Cargando comunidades...</div>
              ) : countries.length === 0 ? (
                <div
                  className="text-center py-6 rounded-xl border border-black/20 text-xs opacity-80 space-y-2"
                  style={innerStyle}
                >
                  <p>Sin resultados.</p>
                  {totalCountriesCount > 0 && (
                    <button
                      type="button"
                      onClick={handleResetCountryFilters}
                      className="px-3 py-1 rounded-lg border border-white/15 text-[11px] font-bold cursor-pointer"
                      style={cardStyle}
                    >
                      Restablecer filtros ({totalCountriesCount} registrados)
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-black/20" style={innerStyle}>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-black/20 opacity-75">
                        <th className="py-2.5 px-3 font-semibold">ID</th>
                        <th className="py-2.5 px-3 font-semibold">Barrio</th>
                        <th className="py-2.5 px-3 font-semibold">Ubicación</th>
                        <th className="py-2.5 px-3 font-semibold">Licencia B2B / QR mes</th>
                        <th className="py-2.5 px-3 font-semibold">Claves</th>
                        <th className="py-2.5 px-3 font-semibold">Estado</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/15">
                      {countries.map((c) => {
                        const isEditing = editingCountryId === c.id;
                        const isEditingBilling = editingBillingCountryId === c.id;
                        const billingBadge = getB2BBillingBadge(c.billing_status);
                        const monthlyUsed = Number(c.monthly_qr_used ?? 0);
                        const monthlyQuota =
                          c.monthly_pass_quota !== null && c.monthly_pass_quota !== undefined
                            ? Number(c.monthly_pass_quota)
                            : null;
                        const locationSummary =
                          [c.city, c.province, c.postal_code].filter(Boolean).join(', ') || '-';
                        return (
                          <tr key={c.id}>
                            <td className="py-2.5 px-3 font-mono opacity-80">#{c.id}</td>
                            <td className="py-2.5 px-3 font-semibold">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editCountryName}
                                  onChange={(e) => setEditCountryName(e.target.value)}
                                  className="w-full px-2.5 py-1 rounded-lg border border-emerald-600 text-xs focus:outline-none"
                                  style={cardStyle}
                                />
                              ) : (
                                <div>
                                  <div>{c.name}</div>
                                  {c.address && (
                                    <div className="text-[11px] opacity-75 font-normal">
                                      {c.address}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 opacity-85">
                              {isEditing ? (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                                  <input
                                    type="text"
                                    value={editCountryCity}
                                    onChange={(e) => setEditCountryCity(e.target.value)}
                                    placeholder="Localidad"
                                    className="w-full px-2 py-1 rounded-lg border border-white/15 text-xs focus:outline-none"
                                    style={cardStyle}
                                  />
                                  <input
                                    type="text"
                                    value={editCountryProvince}
                                    onChange={(e) => setEditCountryProvince(e.target.value)}
                                    placeholder="Provincia"
                                    className="w-full px-2 py-1 rounded-lg border border-white/15 text-xs focus:outline-none"
                                    style={cardStyle}
                                  />
                                  <input
                                    type="text"
                                    value={editCountryPostalCode}
                                    onChange={(e) => setEditCountryPostalCode(e.target.value)}
                                    placeholder="CP"
                                    className="w-full px-2 py-1 rounded-lg border border-white/15 text-xs focus:outline-none"
                                    style={cardStyle}
                                  />
                                </div>
                              ) : (
                                locationSummary
                              )}
                            </td>
                            {/* Celda de licencia B2B: editor en línea (plan, estado, cuota) o resumen */}
                            <td className="py-2.5 px-3">
                              {isEditingBilling ? (
                                <div className="space-y-1.5 min-w-[200px]">
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <select
                                      value={billingPlanDraft}
                                      onChange={(e) => setBillingPlanDraft(e.target.value)}
                                      className="px-2 py-1 rounded-lg border border-white/15 text-[11px]"
                                      style={cardStyle}
                                    >
                                      {(b2bPlans.length > 0
                                        ? b2bPlans
                                        : [
                                            { code: 'pilot', name: 'Piloto' },
                                            { code: 'starter', name: 'Esencial' },
                                            { code: 'pro', name: 'Country Pro' },
                                            { code: 'enterprise', name: 'Enterprise' },
                                          ]
                                      ).map((pl) => (
                                        <option key={pl.code} value={pl.code}>
                                          {pl.name}
                                        </option>
                                      ))}
                                    </select>
                                    <select
                                      value={billingStatusDraft}
                                      onChange={(e) => setBillingStatusDraft(e.target.value)}
                                      className="px-2 py-1 rounded-lg border border-white/15 text-[11px]"
                                      style={cardStyle}
                                    >
                                      <option value="active">Activa</option>
                                      <option value="trial">Prueba</option>
                                      <option value="grace">Gracia</option>
                                      <option value="suspended">Suspendida</option>
                                    </select>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="number"
                                      min="0"
                                      value={billingQuotaDraft}
                                      onChange={(e) => setBillingQuotaDraft(e.target.value)}
                                      placeholder="Cuota QR (vacío=∞)"
                                      className="w-full px-2 py-1 rounded-lg border border-white/15 text-[11px]"
                                      style={cardStyle}
                                    />
                                    <button
                                      type="button"
                                      disabled={savingBillingCountryId === c.id}
                                      onClick={() => handleSaveCountryBilling(c.id)}
                                      className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer shrink-0"
                                    >
                                      OK
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingBillingCountryId(null)}
                                      className="px-1.5 py-1 rounded-lg border border-white/15 text-[11px] cursor-pointer"
                                      style={cardStyle}
                                    >
                                      <X size={11} />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-1">
                                    <span
                                      className="px-2 py-0.5 rounded-md text-[10px] font-bold border border-white/15"
                                      style={cardStyle}
                                    >
                                      {c.plan_name || c.plan_code || 'Piloto'}
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${billingBadge.cls}`}
                                    >
                                      {billingBadge.label}
                                    </span>
                                  </div>
                                  <div className="text-[11px] opacity-80 font-mono">
                                    QR mes: {monthlyUsed} / {monthlyQuota ? monthlyQuota : '∞'}
                                    {c.subscription_ends_at
                                      ? ` · vto ${new Date(c.subscription_ends_at).toLocaleDateString('es-AR')}`
                                      : ''}
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono">{c.active_keys_count ?? 0}</td>
                            <td className="py-2.5 px-3">
                              {c.is_active ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                  Activa
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-white/15 opacity-80"
                                  style={cardStyle}
                                >
                                  Inactiva
                                </span>
                              )}
                            </td>
                            {/* Acciones por comunidad: guardar/cancelar edición, licencia, +30d, editar y toggle */}
                            <td className="py-2.5 px-3 text-right">
                              {isEditing ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={savingCountryId === c.id}
                                    onClick={() => handleSaveCountryEdit(c.id)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                                  >
                                    <Check size={12} /> Guardar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingCountryId(null)}
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-white/15 cursor-pointer"
                                    style={cardStyle}
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => startEditingCountryBilling(c)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-amber-500/40 bg-amber-500/10 text-amber-200 cursor-pointer"
                                  >
                                    Licencia
                                  </button>
                                  <button
                                    type="button"
                                    disabled={savingBillingCountryId === c.id}
                                    onClick={() =>
                                      handleSaveCountryBilling(c.id, {
                                        billing_status: 'active',
                                        extend_days: 30,
                                      })
                                    }
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border border-white/15 cursor-pointer"
                                    style={cardStyle}
                                    title="Extender licencia B2B +30 días"
                                  >
                                    +30d
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => startEditingCountry(c)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-white/15 cursor-pointer"
                                    style={cardStyle}
                                  >
                                    <Pencil size={11} /> Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleCountry(c)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-white/15 cursor-pointer"
                                    style={cardStyle}
                                  >
                                    {c.is_active ? 'Desactivar' : 'Activar'}
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Controles de paginación y tamaño de página para Comunidades */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs opacity-85">
                <div className="flex items-center gap-3">
                  <span>
                    Página {countryPage} de {countryTotalPages} ({countryTotalCount} total)
                  </span>
                  <select
                    value={countryPageSize}
                    onChange={(e) => {
                      const nextSize = Number(e.target.value);
                      setCountryPageSize(nextSize);
                      setCountryPage(1);
                      fetchCountries(1, countrySearch, nextSize, countryStatusFilter);
                    }}
                    className="px-2 py-1 rounded-lg border border-white/15 text-xs focus:outline-none"
                    style={innerStyle}
                  >
                    <option value={4}>4 / pág</option>
                    <option value={8}>8 / pág</option>
                    <option value={12}>12 / pág</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={countryPage <= 1 || loadingCountries}
                    onClick={() => {
                      const prev = Math.max(countryPage - 1, 1);
                      setCountryPage(prev);
                      fetchCountries(prev, countrySearch, countryPageSize, countryStatusFilter);
                    }}
                    className="px-3 py-1 rounded-lg border border-white/15 font-semibold disabled:opacity-40 cursor-pointer"
                    style={innerStyle}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    disabled={countryPage >= countryTotalPages || loadingCountries}
                    onClick={() => {
                      const next = Math.min(countryPage + 1, countryTotalPages);
                      setCountryPage(next);
                      fetchCountries(next, countrySearch, countryPageSize, countryStatusFilter);
                    }}
                    className="px-3 py-1 rounded-lg border border-white/15 font-semibold disabled:opacity-40 cursor-pointer"
                    style={innerStyle}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </section>

            {/* Claves API por Comunidad (Integraciones de garita) */}
            <section
              className="border border-black/20 p-6 rounded-2xl shadow-sm space-y-4"
              style={cardStyle}
            >
              {/* Encabezado y selector de cantidad de claves por página */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={17} className="text-amber-400" />
                  <h3 className="text-sm font-bold">
                    Claves por Comunidad ({integrationsTotalCount})
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs opacity-85">
                  <span>Por página:</span>
                  <select
                    value={integrationsPageSize}
                    onChange={(e) => {
                      const nextSize = Number(e.target.value);
                      setIntegrationsPageSize(nextSize);
                      setIntegrationsPage(1);
                      fetchIntegrations(1, nextSize);
                    }}
                    className="px-2.5 py-1 rounded-lg border border-white/15 text-xs focus:outline-none"
                    style={innerStyle}
                  >
                    <option value={4}>4</option>
                    <option value={6}>6</option>
                    <option value={10}>10</option>
                  </select>
                </div>
              </div>

              {/* Formulario de generación de nueva clave API asociada a una comunidad */}
              <form
                onSubmit={handleCreateIntegrationKey}
                className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs"
              >
                <select
                  value={selectedCountryForKey}
                  onChange={(e) => setSelectedCountryForKey(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                  style={innerStyle}
                >
                  {selectorCountriesList.length === 0 ? (
                    <option value="">Sin comunidades cargadas</option>
                  ) : (
                    selectorCountriesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (#{c.id})
                      </option>
                    ))
                  )}
                </select>
                <input
                  type="text"
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                  placeholder="Etiqueta (ej: Garita Principal)"
                  className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                  style={innerStyle}
                />
                <button
                  type="submit"
                  disabled={creatingKey || !selectedCountryForKey}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <KeyRound size={14} /> {creatingKey ? 'Generando...' : 'Generar Clave'}
                </button>
              </form>

              {/* Feedback de operación y visualización única de la clave recién generada o rotada */}
              {integrationFeedback && (
                <div
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs border ${
                    integrationFeedback.type === 'success'
                      ? 'bg-emerald-950/50 border-emerald-800 text-emerald-200'
                      : 'bg-rose-950/50 border-rose-800 text-rose-200'
                  }`}
                >
                  {integrationFeedback.type === 'success' ? (
                    <CheckCircle2 size={15} />
                  ) : (
                    <AlertCircle size={15} />
                  )}
                  <span>{integrationFeedback.message}</span>
                </div>
              )}

              {latestPlainKey && (
                <div className="bg-amber-950/35 border border-amber-700/70 rounded-xl p-3.5 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="text-amber-200 font-semibold">
                    Clave generada ({latestPlainKey.label}):
                  </span>
                  <code className="font-mono text-[11px] text-amber-100 break-all">
                    {latestPlainKey.key}
                  </code>
                </div>
              )}

              {/* Tabla paginada de claves API configuradas (rotación y activación/revocación) */}
              {loadingIntegrations ? (
                <div className="text-center py-6 text-xs opacity-80">Cargando claves...</div>
              ) : integrations.length === 0 ? (
                <div
                  className="text-center py-6 rounded-xl border border-black/20 text-xs opacity-80"
                  style={innerStyle}
                >
                  Sin claves configuradas.
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="overflow-x-auto rounded-xl border border-black/20" style={innerStyle}>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-black/20 opacity-75">
                          <th className="py-2.5 px-3 font-semibold">Barrio</th>
                          <th className="py-2.5 px-3 font-semibold">Etiqueta</th>
                          <th className="py-2.5 px-3 font-semibold">Prefijo</th>
                          <th className="py-2.5 px-3 font-semibold">Estado</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/15">
                        {integrations.map((integ) => (
                          <tr key={integ.id}>
                            <td className="py-2.5 px-3 font-semibold">{integ.country_name}</td>
                            <td className="py-2.5 px-3 opacity-85">{integ.label}</td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-amber-300">
                              {integ.api_key_prefix}
                            </td>
                            <td className="py-2.5 px-3">
                              {integ.is_active ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                  Activa
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                                  Revocada
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleRotateIntegrationKey(integ)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-white/15 cursor-pointer"
                                  style={cardStyle}
                                >
                                  <RotateCcw size={11} /> Rotar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleIntegrationKey(integ)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-white/15 cursor-pointer"
                                  style={cardStyle}
                                >
                                  {integ.is_active ? 'Revocar' : 'Activar'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Controles de paginación de Claves API */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs opacity-85">
                    <span>
                      Página {integrationsPage} de {integrationsTotalPages} ({integrationsTotalCount}{' '}
                      clave(s))
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={integrationsPage <= 1 || loadingIntegrations}
                        onClick={() => {
                          const prev = Math.max(integrationsPage - 1, 1);
                          setIntegrationsPage(prev);
                          fetchIntegrations(prev, integrationsPageSize);
                        }}
                        className="px-3 py-1 rounded-lg border border-white/15 font-semibold disabled:opacity-40 cursor-pointer"
                        style={innerStyle}
                      >
                        Anterior
                      </button>
                      <button
                        type="button"
                        disabled={integrationsPage >= integrationsTotalPages || loadingIntegrations}
                        onClick={() => {
                          const next = Math.min(integrationsPage + 1, integrationsTotalPages);
                          setIntegrationsPage(next);
                          fetchIntegrations(next, integrationsPageSize);
                        }}
                        className="px-3 py-1 rounded-lg border border-white/15 font-semibold disabled:opacity-40 cursor-pointer"
                        style={innerStyle}
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Pases QR Recientes */}
            <section
              className="border border-black/20 p-6 rounded-2xl shadow-sm space-y-4"
              style={cardStyle}
            >
              {/* Encabezado y barra de búsqueda/filtros de Pases QR */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold">Pases QR Recientes ({passTotalCount})</h3>
                  <p className="text-xs opacity-80 mt-0.5">
                    Vigencia In/Out ({activeTimeZone}), copia de token, envío al sandbox y cancelación.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <div className="relative">
                    <Search
                      size={13}
                      className="opacity-60 absolute left-2.5 top-1/2 -translate-y-1/2"
                    />
                    <input
                      type="text"
                      value={passSearch}
                      onChange={(e) => setPassSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setPassPage(1);
                          fetchRecentPasses(1, passStatusFilter, passSearch, passPageSize);
                        }
                      }}
                      placeholder="Buscar prestador, barrio o token..."
                      className="pl-8 pr-3 py-1.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                      style={innerStyle}
                    />
                  </div>
                  <select
                    value={passStatusFilter}
                    onChange={(e) => {
                      const nextStatus = e.target.value;
                      setPassStatusFilter(nextStatus);
                      setPassPage(1);
                      fetchRecentPasses(1, nextStatus, passSearch, passPageSize);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                    style={innerStyle}
                  >
                    <option value="all">Todos</option>
                    <option value="pending">Pendientes</option>
                    <option value="expired">Vencidos</option>
                    <option value="used">Usados</option>
                    <option value="cancelled">Cancelados</option>
                  </select>
                  <select
                    value={passPageSize}
                    onChange={(e) => {
                      const nextSize = Number(e.target.value);
                      setPassPageSize(nextSize);
                      setPassPage(1);
                      fetchRecentPasses(1, passStatusFilter, passSearch, nextSize);
                    }}
                    className="px-2.5 py-1.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                    style={innerStyle}
                  >
                    <option value={6}>6 / pág</option>
                    <option value={10}>10 / pág</option>
                    <option value={20}>20 / pág</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setPassPage(1);
                      fetchRecentPasses(1, passStatusFilter, passSearch, passPageSize);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold border border-white/15 cursor-pointer hover:opacity-90"
                    style={innerStyle}
                  >
                    Buscar
                  </button>
                </div>
              </div>

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
                  className="text-center py-6 rounded-xl border border-black/20 text-xs opacity-80"
                  style={innerStyle}
                >
                  No hay pases QR que coincidan con el filtro.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-black/20" style={innerStyle}>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-black/20 opacity-75">
                        <th className="py-2.5 px-3 font-semibold">Pase</th>
                        <th className="py-2.5 px-3 font-semibold">Prestador</th>
                        <th className="py-2.5 px-3 font-semibold">Barrio / Lote</th>
                        <th className="py-2.5 px-3 font-semibold">Vigencia (In / Out)</th>
                        <th className="py-2.5 px-3 font-semibold">Estado</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/15">
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
                                {[pass.fraction_number, pass.lot_number].filter(Boolean).join(' / ') ||
                                  '-'}
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

              {/* Controles de paginación de Pases QR */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs opacity-85">
                <span>
                  Página {passPage} de {passTotalPages} ({passTotalCount} pase(s))
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={passPage <= 1 || loadingPasses}
                    onClick={() => {
                      const prev = Math.max(passPage - 1, 1);
                      setPassPage(prev);
                      fetchRecentPasses(prev, passStatusFilter, passSearch, passPageSize);
                    }}
                    className="px-3 py-1 rounded-lg border border-white/15 font-semibold disabled:opacity-40 cursor-pointer"
                    style={innerStyle}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    disabled={passPage >= passTotalPages || loadingPasses}
                    onClick={() => {
                      const next = Math.min(passPage + 1, passTotalPages);
                      setPassPage(next);
                      fetchRecentPasses(next, passStatusFilter, passSearch, passPageSize);
                    }}
                    className="px-3 py-1 rounded-lg border border-white/15 font-semibold disabled:opacity-40 cursor-pointer"
                    style={innerStyle}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </section>

            {/* Sandbox Endpoint Externo */}
            <section
              id="external-sandbox-section"
              className="border border-black/20 p-6 rounded-2xl shadow-sm space-y-4"
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
                className="inline-flex rounded-xl p-1 border border-white/15 self-start"
                style={innerStyle}
              >
                <button
                  type="button"
                  onClick={() => setAuthMode('api_key')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                    authMode === 'api_key' ? 'bg-emerald-600 text-white' : 'opacity-80'
                  }`}
                >
                  x-api-key
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('jwt')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                    authMode === 'jwt' ? 'bg-emerald-600 text-white' : 'opacity-80'
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
                    className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs font-mono focus:outline-none"
                    style={innerStyle}
                  />
                  {authMode === 'api_key' && (
                    <input
                      type="text"
                      value={testApiKey}
                      onChange={(e) => setTestApiKey(e.target.value)}
                      placeholder="x-api-key de la comunidad (ej: tlk_live_...)"
                      className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs font-mono focus:outline-none"
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
                  className="border border-black/20 rounded-xl p-4 space-y-2.5"
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
                className="border border-black/20 p-5 rounded-2xl shadow-sm space-y-2"
                style={cardStyle}
              >
                <div className="text-xs opacity-75">Clave global de entorno (ENV)</div>
                <div className="text-sm font-black">
                  {envKeyConfigured ? 'Configurada' : 'No definida (usa claves por barrio / JWT)'}
                </div>
                <p className="text-[11px] opacity-75">
                  Las garitas también pueden autenticarse mediante clave API por comunidad.
                </p>
              </section>

              <section
                className="border border-black/20 p-5 rounded-2xl shadow-sm space-y-2"
                style={cardStyle}
              >
                <div className="text-xs opacity-75">Modos de autenticación soportados</div>
                <div className="text-sm font-black font-mono">x-api-key · Bearer JWT</div>
                <p className="text-[11px] opacity-75">
                  Roles internos con acceso a verificación: admin, superadmin y security.
                </p>
              </section>

              <section
                className="border border-black/20 p-5 rounded-2xl shadow-sm space-y-2"
                style={cardStyle}
              >
                <div className="text-xs opacity-75">Base URL activa del backend</div>
                <div className="text-sm font-black font-mono break-all">{API_BASE}</div>
                <p className="text-[11px] opacity-75">
                  Zona horaria de visualización activa: {activeTimeZone}.
                </p>
              </section>
            </div>

            {/* Catálogo filtrable de endpoints del backend y prueba rápida en vivo */}
            <section
              className="border border-black/20 p-6 rounded-2xl shadow-sm space-y-4"
              style={cardStyle}
            >
              {/* Encabezado y campo de filtrado por ruta, método o módulo */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/20 pb-4">
                <div>
                  <h3 className="text-sm font-bold">
                    Mapa de Endpoints del Backend ({filteredEndpoints.length})
                  </h3>
                  <p className="text-xs opacity-80 mt-0.5">
                    Consultá permisos, autenticación y ejecutá una prueba rápida sobre endpoints habilitados.
                  </p>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search
                    size={13}
                    className="opacity-60 absolute left-3 top-1/2 -translate-y-1/2"
                  />
                  <input
                    type="text"
                    value={endpointFilter}
                    onChange={(e) => setEndpointFilter(e.target.value)}
                    placeholder="Filtrar ruta, método o módulo..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                    style={innerStyle}
                  />
                </div>
              </div>

              {/* Tabla del catálogo de endpoints con botón de prueba GET o acceso al sandbox */}
              <div className="overflow-x-auto rounded-xl border border-black/20" style={innerStyle}>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-black/20 opacity-75">
                      <th className="py-2.5 px-3 font-semibold">Método</th>
                      <th className="py-2.5 px-3 font-semibold">Ruta</th>
                      <th className="py-2.5 px-3 font-semibold">Auth / Roles</th>
                      <th className="py-2.5 px-3 font-semibold">Función</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/15">
                    {filteredEndpoints.map((ep) => {
                      const isProbing = probingEndpointId === ep.id;
                      return (
                        <tr key={ep.id}>
                          <td className="py-2.5 px-3 font-mono font-bold text-sky-300 whitespace-nowrap">
                            {ep.method}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px]">{ep.path}</td>
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

              {/* Visor de respuesta de la última prueba rápida ejecutada */}
              {endpointProbeResult && (
                <div
                  className="border border-black/20 rounded-xl p-4 space-y-2.5"
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

        {/* ==================== PESTAÑA 3: AUDITORÍA Y TRANSACCIONES ==================== */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            {/* Alerta de error al consultar los datos de auditoría */}
            {auditError && (
              <div className="flex items-center gap-2 bg-rose-950/60 border border-rose-800/80 text-rose-200 p-4 rounded-xl text-xs">
                <AlertCircle size={16} className="text-rose-400 shrink-0" />
                <span>{auditError}</span>
              </div>
            )}

            {/* Tarjetas KPI de validaciones de acceso (totales, autorizados y denegados) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <section
                className="border border-black/20 p-5 rounded-2xl shadow-sm"
                style={cardStyle}
              >
                <div className="text-xs opacity-80">Intentos de validación</div>
                <div className="text-2xl font-black font-mono mt-1">
                  {accessSummary.total_attempts ?? 0}
                </div>
              </section>
              <section
                className="border border-black/20 p-5 rounded-2xl shadow-sm"
                style={cardStyle}
              >
                <div className="text-xs text-emerald-400">Autorizados</div>
                <div className="text-2xl font-black text-emerald-300 font-mono mt-1">
                  {accessSummary.authorized_count ?? 0}
                </div>
              </section>
              <section
                className="border border-black/20 p-5 rounded-2xl shadow-sm"
                style={cardStyle}
              >
                <div className="text-xs text-rose-400">Denegados</div>
                <div className="text-2xl font-black text-rose-300 font-mono mt-1">
                  {accessSummary.denied_count ?? 0}
                </div>
              </section>
            </div>

            {/* Bitácora paginada de intentos de acceso en garita */}
            <section
              className="border border-black/20 p-6 rounded-2xl shadow-sm space-y-4"
              style={cardStyle}
            >
              {/* Encabezado con exportación CSV y filtros de búsqueda/resultado/tamaño */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold">Bitácora de Intentos de Acceso</h3>
                  {accessLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        downloadCsv(
                          `trustlink-auditoria-garita-${new Date().toISOString().slice(0, 10)}.csv`,
                          [
                            { key: 'id', label: 'ID' },
                            { key: 'created_at', label: 'Fecha' },
                            { key: 'authorized', label: 'Autorizado' },
                            { key: 'reason_code', label: 'Codigo' },
                            { key: 'integration_label', label: 'Origen' },
                            { key: 'auth_mode', label: 'Auth' },
                            { key: 'qr_token', label: 'Token' },
                            { key: 'message', label: 'Detalle' },
                          ],
                          accessLogs
                        )
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-white/15 cursor-pointer hover:opacity-90"
                      style={innerStyle}
                    >
                      <Download size={11} /> Exportar CSV
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <div className="relative">
                    <Search
                      size={13}
                      className="opacity-60 absolute left-2.5 top-1/2 -translate-y-1/2"
                    />
                    <input
                      type="text"
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setAuditPage(1);
                          fetchAuditOverview(1, auditOutcomeFilter, auditSearch, auditPageSize);
                        }
                      }}
                      placeholder="Buscar motivo, barrio o token..."
                      className="pl-8 pr-3 py-1.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                      style={innerStyle}
                    />
                  </div>
                  <select
                    value={auditOutcomeFilter}
                    onChange={(e) => {
                      const nextOutcome = e.target.value;
                      setAuditOutcomeFilter(nextOutcome);
                      setAuditPage(1);
                      fetchAuditOverview(1, nextOutcome, auditSearch, auditPageSize);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                    style={innerStyle}
                  >
                    <option value="all">Todos</option>
                    <option value="authorized">Autorizados</option>
                    <option value="denied">Denegados</option>
                  </select>
                  <select
                    value={auditPageSize}
                    onChange={(e) => {
                      const nextSize = Number(e.target.value);
                      setAuditPageSize(nextSize);
                      setAuditPage(1);
                      fetchAuditOverview(1, auditOutcomeFilter, auditSearch, nextSize);
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-white/15 text-xs focus:outline-none"
                    style={innerStyle}
                  >
                    <option value={8}>8 / pág</option>
                    <option value={15}>15 / pág</option>
                    <option value={25}>25 / pág</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setAuditPage(1);
                      fetchAuditOverview(1, auditOutcomeFilter, auditSearch, auditPageSize);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold border border-white/15 cursor-pointer"
                    style={innerStyle}
                  >
                    Filtrar
                  </button>
                </div>
              </div>

              {/* Tabla de eventos de validación de acceso registrados */}
              {loadingAudit ? (
                <div className="text-center py-6 text-xs opacity-80">Cargando bitácora...</div>
              ) : accessLogs.length === 0 ? (
                <div
                  className="text-center py-6 rounded-xl border border-black/20 text-xs opacity-80"
                  style={innerStyle}
                >
                  Sin registros de validación en bitácora.
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="overflow-x-auto rounded-xl border border-black/20" style={innerStyle}>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-black/20 opacity-75">
                          <th className="py-2.5 px-3 font-semibold">Resultado</th>
                          <th className="py-2.5 px-3 font-semibold">Motivo</th>
                          <th className="py-2.5 px-3 font-semibold">Barrio / Origen</th>
                          <th className="py-2.5 px-3 font-semibold">Mensaje</th>
                          <th className="py-2.5 px-3 font-semibold">Fecha</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/15">
                        {accessLogs.map((log) => (
                          <tr key={log.id}>
                            <td className="py-2.5 px-3">
                              {log.authorized ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                  Autorizado
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                                  Denegado
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-amber-300">
                              {log.reason_code}
                            </td>
                            <td className="py-2.5 px-3">
                              {log.country_name || log.integration_label || '-'}
                            </td>
                            <td className="py-2.5 px-3 opacity-85">{log.message}</td>
                            <td className="py-2.5 px-3 font-mono text-[11px] opacity-80">
                              {formatDateTime(log.created_at, activeTimeZone)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Controles de paginación de la bitácora de auditoría */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs opacity-85">
                    <span>
                      Página {auditPage} de {auditTotalPages} ({auditTotalCount} evento(s))
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={auditPage <= 1 || loadingAudit}
                        onClick={() => {
                          const prev = Math.max(auditPage - 1, 1);
                          setAuditPage(prev);
                          fetchAuditOverview(prev, auditOutcomeFilter, auditSearch, auditPageSize);
                        }}
                        className="px-3 py-1 rounded-lg border border-white/15 font-semibold disabled:opacity-40 cursor-pointer"
                        style={innerStyle}
                      >
                        Anterior
                      </button>
                      <button
                        type="button"
                        disabled={auditPage >= auditTotalPages || loadingAudit}
                        onClick={() => {
                          const next = Math.min(auditPage + 1, auditTotalPages);
                          setAuditPage(next);
                          fetchAuditOverview(next, auditOutcomeFilter, auditSearch, auditPageSize);
                        }}
                        className="px-3 py-1 rounded-lg border border-white/15 font-semibold disabled:opacity-40 cursor-pointer"
                        style={innerStyle}
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Resumen financiero y listado de Contratos y Transacciones */}
            <section
              className="border border-black/20 p-6 rounded-2xl shadow-sm space-y-4"
              style={cardStyle}
            >
              {/* Encabezado con exportación CSV y totales (volumen bruto, comisión 7% y neto) */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Receipt size={17} className="text-emerald-400" />
                  <h3 className="text-sm font-bold">Contratos y Transacciones</h3>
                  {recentTransactions.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        downloadCsv(
                          `trustlink-transacciones-${new Date().toISOString().slice(0, 10)}.csv`,
                          [
                            { key: 'id', label: 'ID' },
                            { key: 'contract_id', label: 'Contrato' },
                            { key: 'gateway_provider', label: 'Pasarela' },
                            { key: 'gateway_payment_id', label: 'ID Pago Externo' },
                            { key: 'total_amount', label: 'Monto Total' },
                            { key: 'platform_fee', label: 'Comision Plataforma' },
                            { key: 'provider_payout', label: 'Neto Prestador' },
                            { key: 'status', label: 'Estado' },
                            { key: 'created_at', label: 'Fecha' },
                          ],
                          recentTransactions
                        )
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-white/15 cursor-pointer hover:opacity-90"
                      style={innerStyle}
                    >
                      <Download size={11} /> Exportar CSV
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 text-xs font-mono">
                  <span>Volumen: ${transactionsSummary.gross_volume ?? 0}</span>
                  <span className="text-emerald-300">
                    Comisión (7%): ${transactionsSummary.platform_fee_total ?? 0}
                  </span>
                  <span className="text-sky-300">
                    Neto prestadores: ${transactionsSummary.provider_payout_total ?? 0}
                  </span>
                </div>
              </div>

              {/* Tabla de transacciones recientes asociadas a contratos */}
              {recentTransactions.length === 0 ? (
                <div
                  className="text-center py-6 rounded-xl border border-black/20 text-xs opacity-80"
                  style={innerStyle}
                >
                  Aún no hay transacciones registradas.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-black/20" style={innerStyle}>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-black/20 opacity-75">
                        <th className="py-2.5 px-3 font-semibold">Tx</th>
                        <th className="py-2.5 px-3 font-semibold">Contrato</th>
                        <th className="py-2.5 px-3 font-semibold">Prestador</th>
                        <th className="py-2.5 px-3 font-semibold">Bruto</th>
                        <th className="py-2.5 px-3 font-semibold">Comisión (7%)</th>
                        <th className="py-2.5 px-3 font-semibold">Neto (93%)</th>
                        <th className="py-2.5 px-3 font-semibold">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/15">
                      {recentTransactions.map((tx) => (
                        <tr key={tx.id}>
                          <td className="py-2.5 px-3 font-mono">#{tx.id}</td>
                          <td className="py-2.5 px-3 font-mono">#{tx.contract_id}</td>
                          <td className="py-2.5 px-3">{tx.provider_name || '-'}</td>
                          <td className="py-2.5 px-3 font-mono">${tx.gross_amount}</td>
                          <td className="py-2.5 px-3 font-mono text-emerald-300">
                            ${tx.platform_fee}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-sky-300">
                            ${tx.provider_payout}
                          </td>
                          <td className="py-2.5 px-3 font-mono">{tx.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}