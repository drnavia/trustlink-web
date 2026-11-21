/**
 * @file SystemHealthDashboard.jsx
 * @description Consola técnica y de integración externa exclusiva para el rol 'superadmin',
 * con aplicación explícita de Zona 4 (tarjetas principales) y Zona 5 (cajas/bloques internos),
 * sin fondos envolventes fijos que tapen Zona 3.
 * @location /trustlink-web/src/modules/admin/SystemHealthDashboard.jsx
 */

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Database,
  Server,
  KeyRound,
  RefreshCw,
  Send,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Copy,
  Check,
  Ban,
  Building2,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Pencil,
  RotateCw,
  ShieldCheck,
  FileSpreadsheet,
  Power,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useBranding, DEFAULT_BRANDING_CONFIG } from '../branding/BrandingContext';

const API_BASE = 'http://localhost:4000';
const COUNTRIES_PER_PAGE = 4;
const PASSES_PER_PAGE = 6;
const AUDIT_LOGS_PER_PAGE = 8;

const resolveUserTimeZone = (userObj) => {
  const candidate =
    userObj?.timezone ||
    userObj?.time_zone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    'America/Argentina/Buenos_Aires';

  try {
    Intl.DateTimeFormat(undefined, { timeZone: candidate });
    return candidate;
  } catch (e) {
    return 'America/Argentina/Buenos_Aires';
  }
};

const parsePassTimestampMs = (rawValue) => {
  if (!rawValue) return null;
  const str = String(rawValue).trim();
  const hasTimezone = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(str);
  const normalized = hasTimezone ? str : `${str.replace(' ', 'T')}Z`;
  const ms = new Date(normalized).getTime();
  return Number.isNaN(ms) ? null : ms;
};

const formatInTimeZone = (rawValue, timeZone) => {
  const ms = parsePassTimestampMs(rawValue);
  if (ms === null) return '-';
  return new Date(ms).toLocaleString('es-AR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function SystemHealthDashboard() {
  const { user } = useAuth();
  const { brand } = useBranding();
  const activeTimeZone = resolveUserTimeZone(user);

  const cardStyle = {
    backgroundColor: brand.cardBgColor || DEFAULT_BRANDING_CONFIG.cardBgColor,
    color: brand.cardTextColor || DEFAULT_BRANDING_CONFIG.cardTextColor,
  };

  const innerStyle = {
    backgroundColor: brand.innerBgColor || DEFAULT_BRANDING_CONFIG.innerBgColor,
    color: brand.innerTextColor || DEFAULT_BRANDING_CONFIG.innerTextColor,
  };

  const [activeTab, setActiveTab] = useState('health');

  // Salud y métricas
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [healthData, setHealthData] = useState(null);
  const [diagnosticsData, setDiagnosticsData] = useState(null);
  const [httpLatencyMs, setHttpLatencyMs] = useState(null);

  // Comunidades (countries)
  const [countries, setCountries] = useState([]);
  const [allCountriesForSelect, setAllCountriesForSelect] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [countryPage, setCountryPage] = useState(1);
  const [countryTotalPages, setCountryTotalPages] = useState(1);
  const [countryTotalCount, setCountryTotalCount] = useState(0);
  const [countryStatusFilter, setCountryStatusFilter] = useState('all');
  const [countrySearch, setCountrySearch] = useState('');
  const [newCountryName, setNewCountryName] = useState('');
  const [newCountryLocation, setNewCountryLocation] = useState('');
  const [creatingCountry, setCreatingCountry] = useState(false);
  const [countryFeedback, setCountryFeedback] = useState(null);
  const [togglingCountryId, setTogglingCountryId] = useState(null);
  const [editingCountryId, setEditingCountryId] = useState(null);
  const [editCountryName, setEditCountryName] = useState('');
  const [editCountryLocation, setEditCountryLocation] = useState('');
  const [editCountryActive, setEditCountryActive] = useState(true);
  const [savingEditCountry, setSavingEditCountry] = useState(false);

  // Integraciones por comunidad
  const [integrations, setIntegrations] = useState([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);
  const [integrationPage, setIntegrationPage] = useState(1);
  const [integrationsPerPage, setIntegrationsPerPage] = useState(4);
  const [selectedIntegrationCountryId, setSelectedIntegrationCountryId] = useState('');
  const [newIntegrationLabel, setNewIntegrationLabel] = useState('Garita Principal');
  const [creatingIntegration, setCreatingIntegration] = useState(false);
  const [integrationFeedback, setIntegrationFeedback] = useState(null);
  const [latestPlainKey, setLatestPlainKey] = useState(null);
  const [copiedIntegrationId, setCopiedIntegrationId] = useState(null);
  const [rotatingIntegrationId, setRotatingIntegrationId] = useState(null);
  const [togglingIntegrationId, setTogglingIntegrationId] = useState(null);

  // Pases QR recientes
  const [recentPasses, setRecentPasses] = useState([]);
  const [loadingPasses, setLoadingPasses] = useState(true);
  const [passPage, setPassPage] = useState(1);
  const [passTotalPages, setPassTotalPages] = useState(1);
  const [passTotalCount, setPassTotalCount] = useState(0);
  const [passStatusFilter, setPassStatusFilter] = useState('all');
  const [passSearch, setPassSearch] = useState('');
  const [copiedPassId, setCopiedPassId] = useState(null);
  const [cancellingPassId, setCancellingPassId] = useState(null);
  const [passActionFeedback, setPassActionFeedback] = useState(null);
  const [sandboxCopiedHint, setSandboxCopiedHint] = useState(null);

  // Sandbox endpoint externo
  const [authMode, setAuthMode] = useState('api_key');
  const [testApiKey, setTestApiKey] = useState('');
  const [testQrToken, setTestQrToken] = useState('');
  const [testingEndpoint, setTestingEndpoint] = useState(false);
  const [sandboxResponse, setSandboxResponse] = useState(null);

  // Auditoría de accesos y transacciones
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [auditOutcomeFilter, setAuditOutcomeFilter] = useState('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [accessSummary, setAccessSummary] = useState({
    total_attempts: 0,
    authorized_count: 0,
    denied_count: 0,
  });
  const [accessLogs, setAccessLogs] = useState([]);
  const [financialSummary, setFinancialSummary] = useState({
    total_contracts: 0,
    pending_contracts: 0,
    completed_contracts: 0,
    total_transactions: 0,
    gross_volume: '0.00',
    platform_fees: '0.00',
    provider_payouts: '0.00',
  });
  const [transactionsList, setTransactionsList] = useState([]);

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
  });

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

      const healthJson = await healthRes.json();
      setHealthData({
        ok: healthRes.ok,
        status: healthRes.status,
        data: healthJson,
      });

      if (diagRes.ok) {
        const diagJson = await diagRes.json();
        setDiagnosticsData(diagJson);
      } else {
        const errJson = await diagRes.json().catch(() => ({}));
        setDiagnosticsData(null);
        setStatusError(errJson.error || 'No se pudo obtener el diagnóstico técnico detallado.');
      }
    } catch (error) {
      console.error('Error al consultar salud del sistema:', error);
      setStatusError('No se pudo conectar con el servidor backend en http://localhost:4000.');
      setHealthData(null);
      setDiagnosticsData(null);
    } finally {
      setLoadingStatus(false);
    }
  };

  const fetchCountries = async (
    pageToLoad = countryPage,
    searchToLoad = countrySearch,
    statusToLoad = countryStatusFilter
  ) => {
    setLoadingCountries(true);
    try {
      const params = new URLSearchParams({
        page: String(pageToLoad),
        limit: String(COUNTRIES_PER_PAGE),
        status: statusToLoad,
        search: searchToLoad,
      });
      const res = await fetch(`${API_BASE}/api/v1/external/countries?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setCountries(data.countries || []);
        setCountryTotalCount(data.total ?? (data.countries || []).length);
        setCountryTotalPages(data.totalPages ?? 1);
        setCountryPage(data.page ?? pageToLoad);
      }
    } catch (error) {
      console.error('Error al cargar comunidades:', error);
    } finally {
      setLoadingCountries(false);
    }
  };

  const fetchCommunityIntegrations = async () => {
    setLoadingIntegrations(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/integrations`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        const loadedCountries = data.countries || [];
        const loadedIntegrations = data.integrations || [];
        setAllCountriesForSelect(loadedCountries);
        setIntegrations(loadedIntegrations);
        const maxPages = Math.max(1, Math.ceil(loadedIntegrations.length / integrationsPerPage));
        setIntegrationPage((prev) => Math.min(prev, maxPages));
        if (loadedCountries.length > 0) {
          setSelectedIntegrationCountryId((prev) =>
            prev && loadedCountries.some((c) => String(c.id) === String(prev))
              ? prev
              : String(loadedCountries[0].id)
          );
        }
      }
    } catch (error) {
      console.error('Error al cargar integraciones por comunidad:', error);
    } finally {
      setLoadingIntegrations(false);
    }
  };

  const fetchRecentPasses = async (
    pageToLoad = passPage,
    searchToLoad = passSearch,
    statusToLoad = passStatusFilter
  ) => {
    setLoadingPasses(true);
    try {
      const params = new URLSearchParams({
        page: String(pageToLoad),
        limit: String(PASSES_PER_PAGE),
        status: statusToLoad,
        search: searchToLoad,
      });
      const res = await fetch(`${API_BASE}/api/v1/external/passes?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setRecentPasses(data.passes || []);
        setPassTotalCount(data.total ?? (data.passes || []).length);
        setPassTotalPages(data.totalPages ?? 1);
        setPassPage(data.page ?? pageToLoad);
      }
    } catch (error) {
      console.error('Error al cargar pases recientes:', error);
    } finally {
      setLoadingPasses(false);
    }
  };

  const fetchAuditOverview = async (
    outcomeToLoad = auditOutcomeFilter,
    searchToLoad = auditSearch
  ) => {
    setLoadingAudit(true);
    setAuditError('');
    try {
      const params = new URLSearchParams({
        outcome: outcomeToLoad,
        search: searchToLoad,
      });
      const res = await fetch(`${API_BASE}/api/v1/external/audit?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setAccessSummary(
          data.access_summary || { total_attempts: 0, authorized_count: 0, denied_count: 0 }
        );
        setAccessLogs(data.access_logs || []);
        setAuditPage(1);
        setFinancialSummary(
          data.financial_summary || {
            total_contracts: 0,
            pending_contracts: 0,
            completed_contracts: 0,
            total_transactions: 0,
            gross_volume: '0.00',
            platform_fees: '0.00',
            provider_payouts: '0.00',
          }
        );
        setTransactionsList(data.transactions || []);
      } else {
        setAuditError(data.error || 'No se pudo cargar la auditoría.');
      }
    } catch (error) {
      console.error('Error al cargar auditoría:', error);
      setAuditError('Error de red al consultar la auditoría.');
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    fetchSystemHealth();
    fetchCommunityIntegrations();
  }, []);

  useEffect(() => {
    fetchCountries(countryPage, countrySearch, countryStatusFilter);
  }, [countryPage, countryStatusFilter]);

  useEffect(() => {
    fetchRecentPasses(passPage, passSearch, passStatusFilter);
  }, [passPage, passStatusFilter]);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditOverview(auditOutcomeFilter, auditSearch);
    }
  }, [activeTab, auditOutcomeFilter]);

  const handleRefreshAll = () => {
    fetchSystemHealth();
    fetchCommunityIntegrations();
    fetchCountries(countryPage, countrySearch, countryStatusFilter);
    fetchRecentPasses(passPage, passSearch, passStatusFilter);
    if (activeTab === 'audit') {
      fetchAuditOverview(auditOutcomeFilter, auditSearch);
    }
  };

  const handleCountrySearchSubmit = (e) => {
    e.preventDefault();
    setCountryPage(1);
    fetchCountries(1, countrySearch, countryStatusFilter);
  };

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
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          name: newCountryName.trim(),
          location: newCountryLocation.trim() || null,
          is_active: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCountryFeedback({
          type: 'success',
          message: data.message || 'Comunidad creada correctamente.',
        });
        setNewCountryName('');
        setNewCountryLocation('');
        await Promise.all([
          fetchCountries(1, countrySearch, countryStatusFilter),
          fetchCommunityIntegrations(),
          fetchSystemHealth(),
        ]);
      } else {
        setCountryFeedback({
          type: 'error',
          message: data.error || 'No se pudo crear la comunidad.',
        });
      }
    } catch (error) {
      console.error('Error al crear comunidad:', error);
      setCountryFeedback({
        type: 'error',
        message: 'Error de conexión al crear la comunidad.',
      });
    } finally {
      setCreatingCountry(false);
    }
  };

  const startEditingCountry = (countryItem) => {
    setEditingCountryId(countryItem.id);
    setEditCountryName(countryItem.name || '');
    setEditCountryLocation(countryItem.location || '');
    setEditCountryActive(Boolean(countryItem.is_active));
    setCountryFeedback(null);
  };

  const cancelEditingCountry = () => {
    setEditingCountryId(null);
    setEditCountryName('');
    setEditCountryLocation('');
    setEditCountryActive(true);
  };

  const handleSaveCountryEdit = async (countryId) => {
    if (!editCountryName.trim()) {
      setCountryFeedback({
        type: 'error',
        message: 'El nombre de la comunidad es obligatorio.',
      });
      return;
    }
    setSavingEditCountry(true);
    setCountryFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/countries/${countryId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          name: editCountryName.trim(),
          location: editCountryLocation.trim() || null,
          is_active: editCountryActive,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCountryFeedback({
          type: 'success',
          message: data.message || `Comunidad #${countryId} actualizada.`,
        });
        setEditingCountryId(null);
        await Promise.all([
          fetchCountries(countryPage, countrySearch, countryStatusFilter),
          fetchCommunityIntegrations(),
          fetchSystemHealth(),
        ]);
      } else {
        setCountryFeedback({
          type: 'error',
          message: data.error || 'No se pudo actualizar la comunidad.',
        });
      }
    } catch (error) {
      console.error('Error al editar comunidad:', error);
      setCountryFeedback({
        type: 'error',
        message: 'Error de conexión al editar la comunidad.',
      });
    } finally {
      setSavingEditCountry(false);
    }
  };

  const handleToggleCountry = async (countryId) => {
    setTogglingCountryId(countryId);
    setCountryFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/countries/${countryId}/toggle`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setCountryFeedback({
          type: 'success',
          message: data.message || 'Estado de comunidad actualizado.',
        });
        await Promise.all([
          fetchCountries(countryPage, countrySearch, countryStatusFilter),
          fetchCommunityIntegrations(),
          fetchSystemHealth(),
        ]);
      } else {
        setCountryFeedback({
          type: 'error',
          message: data.error || 'No se pudo cambiar el estado.',
        });
      }
    } catch (error) {
      console.error('Error al cambiar estado de comunidad:', error);
      setCountryFeedback({
        type: 'error',
        message: 'Error de conexión al cambiar el estado.',
      });
    } finally {
      setTogglingCountryId(null);
    }
  };

  const handleCreateIntegration = async (e) => {
    e.preventDefault();
    if (!selectedIntegrationCountryId) return;
    setCreatingIntegration(true);
    setIntegrationFeedback(null);
    setLatestPlainKey(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/integrations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          country_id: Number(selectedIntegrationCountryId),
          label: newIntegrationLabel.trim() || 'Garita Principal',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setIntegrationFeedback({
          type: 'success',
          message: data.message || 'Clave de integración generada.',
        });
        if (data.plain_api_key) {
          setLatestPlainKey({
            countryName: data.integration?.country_name || '',
            label: data.integration?.label || '',
            key: data.plain_api_key,
          });
          setAuthMode('api_key');
          setTestApiKey(data.plain_api_key);
        }
        setIntegrationPage(1);
        await Promise.all([fetchCommunityIntegrations(), fetchSystemHealth()]);
      } else {
        setIntegrationFeedback({
          type: 'error',
          message: data.error || 'No se pudo generar la clave de integración.',
        });
      }
    } catch (error) {
      console.error('Error al generar clave de integración:', error);
      setIntegrationFeedback({
        type: 'error',
        message: 'Error de conexión al generar la clave.',
      });
    } finally {
      setCreatingIntegration(false);
    }
  };

  const handleRotateIntegrationKey = async (integrationId) => {
    setRotatingIntegrationId(integrationId);
    setIntegrationFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/integrations/${integrationId}/rotate`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setIntegrationFeedback({
          type: 'success',
          message: data.message || 'Clave rotada correctamente.',
        });
        if (data.plain_api_key) {
          setLatestPlainKey({
            countryName: data.integration?.country_name || '',
            label: data.integration?.label || '',
            key: data.plain_api_key,
          });
          setAuthMode('api_key');
          setTestApiKey(data.plain_api_key);
        }
        await fetchCommunityIntegrations();
      } else {
        setIntegrationFeedback({
          type: 'error',
          message: data.error || 'No se pudo rotar la clave.',
        });
      }
    } catch (error) {
      console.error('Error al rotar clave:', error);
      setIntegrationFeedback({
        type: 'error',
        message: 'Error de conexión al rotar la clave.',
      });
    } finally {
      setRotatingIntegrationId(null);
    }
  };

  const handleToggleIntegrationStatus = async (integrationId) => {
    setTogglingIntegrationId(integrationId);
    setIntegrationFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/integrations/${integrationId}/toggle`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setIntegrationFeedback({
          type: 'success',
          message: data.message || 'Estado de integración actualizado.',
        });
        await Promise.all([fetchCommunityIntegrations(), fetchSystemHealth()]);
      } else {
        setIntegrationFeedback({
          type: 'error',
          message: data.error || 'No se pudo actualizar la integración.',
        });
      }
    } catch (error) {
      console.error('Error al cambiar estado de integración:', error);
      setIntegrationFeedback({
        type: 'error',
        message: 'Error de conexión al cambiar estado de integración.',
      });
    } finally {
      setTogglingIntegrationId(null);
    }
  };

  const handleCopyIntegrationKey = async (integration) => {
    const keyToCopy = integration?.api_key || '';
    if (!keyToCopy) return;
    try {
      await navigator.clipboard.writeText(keyToCopy);
      setCopiedIntegrationId(integration.id);
      setAuthMode('api_key');
      setTestApiKey(keyToCopy);
      setTimeout(() => setCopiedIntegrationId(null), 2000);
    } catch (err) {
      console.error('No se pudo copiar la clave:', err);
    }
  };

  const handlePassSearchSubmit = (e) => {
    e.preventDefault();
    setPassPage(1);
    fetchRecentPasses(1, passSearch, passStatusFilter);
  };

  const handleCopyAndLoadPass = async (passItem) => {
    const tokenStr = passItem.qr_token || '';
    try {
      await navigator.clipboard.writeText(tokenStr);
    } catch (err) {
      console.error('No se pudo copiar al portapapeles:', err);
    }

    setCopiedPassId(passItem.id);
    setTimeout(() => setCopiedPassId(null), 2000);

    setTestQrToken(tokenStr);
    setAuthMode('api_key');

    const matchingIntegration = integrations.find(
      (item) => Number(item.country_id) === Number(passItem.country_id) && item.is_active
    );

    if (matchingIntegration?.api_key) {
      setTestApiKey(matchingIntegration.api_key);
      setSandboxCopiedHint({
        passId: passItem.id,
        countryName: passItem.country_name || `Comunidad #${passItem.country_id}`,
        maskedKey: matchingIntegration.masked_key || '••••••••••',
        hasKey: true,
      });
    } else {
      setSandboxCopiedHint({
        passId: passItem.id,
        countryName: passItem.country_name || `Comunidad #${passItem.country_id}`,
        maskedKey: null,
        hasKey: false,
      });
    }
  };

  const handleCancelPass = async (passId) => {
    setCancellingPassId(passId);
    setPassActionFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/passes/${passId}/cancel`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setPassActionFeedback({
          type: 'success',
          message: data.message || `Pase #${passId} cancelado con éxito.`,
        });
        await Promise.all([
          fetchRecentPasses(passPage, passSearch, passStatusFilter),
          fetchSystemHealth(),
        ]);
      } else {
        setPassActionFeedback({
          type: 'error',
          message: data.error || 'No se pudo cancelar el pase.',
        });
      }
    } catch (error) {
      console.error('Error al cancelar pase:', error);
      setPassActionFeedback({
        type: 'error',
        message: 'Error de conexión al cancelar el pase.',
      });
    } finally {
      setCancellingPassId(null);
    }
  };

  const handleRunExternalTest = async (e) => {
    e.preventDefault();
    if (!testQrToken.trim()) return;
    setTestingEndpoint(true);
    setSandboxResponse(null);
    const startedAt = performance.now();
    try {
      const headers = {
        'Content-Type': 'application/json',
      };
      if (authMode === 'api_key') {
        if (testApiKey.trim()) {
          headers['x-api-key'] = testApiKey.trim();
        }
      } else {
        Object.assign(headers, getAuthHeaders());
      }

      const response = await fetch(`${API_BASE}/api/v1/external/passes/verify`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          qr_token: testQrToken.trim(),
        }),
      });

      const elapsed = Math.round(performance.now() - startedAt);
      const bodyJson = await response.json().catch(() => ({}));

      setSandboxResponse({
        ok: response.ok,
        httpStatus: response.status,
        latencyMs: elapsed,
        body: bodyJson,
      });

      await fetchRecentPasses(passPage, passSearch, passStatusFilter);
      if (activeTab === 'audit') {
        await fetchAuditOverview(auditOutcomeFilter, auditSearch);
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
          error: 'Error de red al invocar POST /api/v1/external/passes/verify.',
        },
      });
    } finally {
      setTestingEndpoint(false);
    }
  };

  const formatUptime = (seconds) => {
    if (typeof seconds !== 'number') return '-';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  };

  const renderPassStatusBadge = (passItem) => {
    const rawStatus = String(passItem.status || 'pending').toLowerCase();
    const endMs = parsePassTimestampMs(passItem.end_time);
    const isPastEnd = endMs !== null && Date.now() > endMs;

    if (rawStatus === 'cancelled') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
          cancelado
        </span>
      );
    }
    if (rawStatus === 'used') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-950 text-sky-300 border border-sky-800">
          usado
        </span>
      );
    }
    if (rawStatus === 'expired' || (rawStatus === 'pending' && isPastEnd)) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950 text-amber-300 border border-amber-700">
          vencido
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
        {rawStatus}
      </span>
    );
  };

  const isBackendHealthy = Boolean(healthData?.ok && diagnosticsData?.status === 'healthy');
  const isDbConnected = Boolean(diagnosticsData?.database?.connected);
  const isExternalReady = Boolean(diagnosticsData?.external_endpoint?.api_key_configured);

  const integrationTotalPages = Math.max(1, Math.ceil(integrations.length / integrationsPerPage));
  const safeIntegrationPage = Math.min(integrationPage, integrationTotalPages);
  const paginatedIntegrations = integrations.slice(
    (safeIntegrationPage - 1) * integrationsPerPage,
    safeIntegrationPage * integrationsPerPage
  );

  const auditTotalPages = Math.max(1, Math.ceil(accessLogs.length / AUDIT_LOGS_PER_PAGE));
  const safeAuditPage = Math.min(auditPage, auditTotalPages);
  const paginatedAccessLogs = accessLogs.slice(
    (safeAuditPage - 1) * AUDIT_LOGS_PER_PAGE,
    safeAuditPage * AUDIT_LOGS_PER_PAGE
  );

  return (
    <div className="max-w-6xl w-full mx-auto px-4 md:px-8 py-6 space-y-6 font-sans">
      {/* Zona 4: Cabecera principal */}
      <section
        className="border border-black/20 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        style={cardStyle}
      >
        <div className="flex items-center gap-3">
          <div className="p-3 text-emerald-400 rounded-xl border border-white/15" style={innerStyle}>
            <Activity size={22} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Salud &amp; APIs</h2>
            <p className="text-xs opacity-80 mt-0.5">
              Estado del sistema, barrios, claves de garita, pases QR y auditoría.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-xl p-1 border border-white/15"
            style={innerStyle}
          >
            <button
              type="button"
              onClick={() => setActiveTab('health')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'health' ? 'bg-emerald-600 text-white' : 'opacity-80 hover:opacity-100'
              }`}
            >
              Salud &amp; APIs
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'audit' ? 'bg-indigo-600 text-white' : 'opacity-80 hover:opacity-100'
              }`}
            >
              <FileSpreadsheet size={13} />
              Auditoría
            </button>
          </div>

          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={
              loadingStatus ||
              loadingCountries ||
              loadingIntegrations ||
              loadingPasses ||
              loadingAudit
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-white/15 transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
            style={innerStyle}
          >
            <RefreshCw
              size={13}
              className={
                loadingStatus ||
                loadingCountries ||
                loadingIntegrations ||
                loadingPasses ||
                loadingAudit
                  ? 'animate-spin'
                  : ''
              }
            />
            Actualizar
          </button>
        </div>
      </section>

      {activeTab === 'health' ? (
        <>
          {statusError && (
            <div className="flex items-center gap-2 bg-rose-950/60 border border-rose-800/80 text-rose-200 p-4 rounded-xl text-xs">
              <AlertCircle size={16} className="text-rose-400 shrink-0" />
              <span>{statusError}</span>
            </div>
          )}

          {/* Zona 4: Tarjetas de estado */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <section
              className="border border-black/20 p-5 rounded-2xl space-y-3"
              style={cardStyle}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Server size={16} className="text-sky-400" />
                  <span>Backend</span>
                </div>
                {loadingStatus ? (
                  <span
                    className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-white/15"
                    style={innerStyle}
                  >
                    Verificando...
                  </span>
                ) : isBackendHealthy ? (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                    ONLINE
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800">
                    DEGRADADO
                  </span>
                )}
              </div>
              <div className="p-3 rounded-xl border border-black/20 space-y-1.5 text-xs" style={innerStyle}>
                <div className="flex justify-between">
                  <span className="opacity-80">Latencia HTTP:</span>
                  <span className="font-mono font-bold">
                    {httpLatencyMs !== null ? `${httpLatencyMs} ms` : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-80">Tiempo activo:</span>
                  <span className="font-mono font-bold">
                    {formatUptime(diagnosticsData?.uptime_seconds)}
                  </span>
                </div>
              </div>
            </section>

            <section
              className="border border-black/20 p-5 rounded-2xl space-y-3"
              style={cardStyle}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Database size={16} className="text-indigo-400" />
                  <span>PostgreSQL</span>
                </div>
                {loadingStatus ? (
                  <span
                    className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-white/15"
                    style={innerStyle}
                  >
                    Verificando...
                  </span>
                ) : isDbConnected ? (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                    CONECTADA
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800">
                    SIN CONEXIÓN
                  </span>
                )}
              </div>
              <div className="p-3 rounded-xl border border-black/20 space-y-1.5 text-xs" style={innerStyle}>
                <div className="flex justify-between">
                  <span className="opacity-80">Latencia consulta:</span>
                  <span className="font-mono font-bold">
                    {typeof diagnosticsData?.database?.latency_ms === 'number'
                      ? `${diagnosticsData.database.latency_ms} ms`
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-80">Pases / Vencidos:</span>
                  <span className="font-mono font-bold">
                    {diagnosticsData?.metrics?.total_passes ?? '-'} /{' '}
                    {diagnosticsData?.metrics?.expired_passes ?? '-'}
                  </span>
                </div>
              </div>
            </section>

            <section
              className="border border-black/20 p-5 rounded-2xl space-y-3"
              style={cardStyle}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <KeyRound size={16} className="text-amber-400" />
                  <span>API Externa</span>
                </div>
                {loadingStatus ? (
                  <span
                    className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-white/15"
                    style={innerStyle}
                  >
                    Verificando...
                  </span>
                ) : isExternalReady ? (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                    ACTIVO
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">
                    SIN CLAVE
                  </span>
                )}
              </div>
              <div className="p-3 rounded-xl border border-black/20 space-y-1.5 text-xs" style={innerStyle}>
                <div className="flex justify-between">
                  <span className="opacity-80">Claves activas:</span>
                  <span className="font-mono font-bold">
                    {diagnosticsData?.external_endpoint?.active_community_keys ?? 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-80">Barrios activos:</span>
                  <span className="font-mono font-bold">
                    {diagnosticsData?.metrics?.active_countries ?? '-'} /{' '}
                    {diagnosticsData?.metrics?.total_countries ?? '-'}
                  </span>
                </div>
              </div>
            </section>
          </div>

          {/* Zona 4: Comunidades / Barrios */}
          <section
            className="border border-black/20 p-6 rounded-2xl space-y-4"
            style={cardStyle}
          >
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="flex items-center gap-2">
                <Building2 size={17} className="text-emerald-400" />
                <h3 className="text-sm font-bold">
                  Comunidades ({countryTotalCount})
                </h3>
              </div>

              <form onSubmit={handleCountrySearchSubmit} className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={13} className="opacity-70 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    placeholder="Buscar barrio..."
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                    style={innerStyle}
                  />
                </div>
                <select
                  value={countryStatusFilter}
                  onChange={(e) => {
                    setCountryStatusFilter(e.target.value);
                    setCountryPage(1);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                  style={innerStyle}
                >
                  <option value="all">Todas</option>
                  <option value="active">Activas</option>
                  <option value="inactive">Inactivas</option>
                </select>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border border-white/15 cursor-pointer"
                  style={innerStyle}
                >
                  Filtrar
                </button>
              </form>
            </div>

            <form onSubmit={handleCreateCountry} className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-5">
                <input
                  type="text"
                  value={newCountryName}
                  onChange={(e) => setNewCountryName(e.target.value)}
                  placeholder="Nombre del barrio"
                  className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                  style={innerStyle}
                />
              </div>
              <div className="md:col-span-5">
                <input
                  type="text"
                  value={newCountryLocation}
                  onChange={(e) => setNewCountryLocation(e.target.value)}
                  placeholder="Ubicación"
                  className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                  style={innerStyle}
                />
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={creatingCountry || !newCountryName.trim()}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Plus size={14} />
                  {creatingCountry ? 'Creando...' : 'Agregar'}
                </button>
              </div>
            </form>

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

            {loadingCountries ? (
              <div className="text-center py-6 rounded-xl border border-black/20 text-xs" style={innerStyle}>
                Cargando comunidades...
              </div>
            ) : countries.length === 0 ? (
              <div className="text-center py-6 rounded-xl border border-black/20 text-xs opacity-80" style={innerStyle}>
                Sin resultados.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border border-black/20" style={innerStyle}>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-black/20 opacity-80">
                        <th className="py-2.5 px-3 font-semibold">ID</th>
                        <th className="py-2.5 px-3 font-semibold">Barrio</th>
                        <th className="py-2.5 px-3 font-semibold">Ubicación</th>
                        <th className="py-2.5 px-3 font-semibold">Estado</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/15">
                      {countries.map((countryItem) => {
                        const isEditing = editingCountryId === countryItem.id;
                        return (
                          <tr key={countryItem.id} className="hover:bg-black/10">
                            <td className="py-2.5 px-3 font-mono">#{countryItem.id}</td>
                            <td className="py-2.5 px-3">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editCountryName}
                                  onChange={(e) => setEditCountryName(e.target.value)}
                                  className="w-full px-2.5 py-1 rounded-lg border border-emerald-600 text-xs focus:outline-none"
                                  style={cardStyle}
                                />
                              ) : (
                                <span className="font-semibold">{countryItem.name}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editCountryLocation}
                                  onChange={(e) => setEditCountryLocation(e.target.value)}
                                  className="w-full px-2.5 py-1 rounded-lg border border-white/15 text-xs focus:outline-none"
                                  style={cardStyle}
                                />
                              ) : (
                                <span className="opacity-80">{countryItem.location || '-'}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {isEditing ? (
                                <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={editCountryActive}
                                    onChange={(e) => setEditCountryActive(e.target.checked)}
                                  />
                                  <span>Activa</span>
                                </label>
                              ) : countryItem.is_active ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                  activa
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-white/15 opacity-80" style={cardStyle}>
                                  inactiva
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                {isEditing ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveCountryEdit(countryItem.id)}
                                      disabled={savingEditCountry}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                                    >
                                      <Check size={12} />
                                      <span>Guardar</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelEditingCountry}
                                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-white/15 cursor-pointer"
                                      style={cardStyle}
                                    >
                                      Cancelar
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => startEditingCountry(countryItem)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-white/15 cursor-pointer"
                                      style={cardStyle}
                                    >
                                      <Pencil size={12} />
                                      <span>Editar</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleCountry(countryItem.id)}
                                      disabled={togglingCountryId === countryItem.id}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-white/15 cursor-pointer"
                                      style={cardStyle}
                                    >
                                      <Power size={12} />
                                      <span>{countryItem.is_active ? 'Desactivar' : 'Activar'}</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-1 text-xs opacity-85">
                  <span>
                    Página <strong>{countryPage}</strong> de <strong>{countryTotalPages}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCountryPage((p) => Math.max(1, p - 1))}
                      disabled={countryPage <= 1 || loadingCountries}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-white/15 disabled:opacity-40 cursor-pointer"
                      style={innerStyle}
                    >
                      <ChevronLeft size={13} />
                      Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() => setCountryPage((p) => Math.min(countryTotalPages, p + 1))}
                      disabled={countryPage >= countryTotalPages || loadingCountries}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-white/15 disabled:opacity-40 cursor-pointer"
                      style={innerStyle}
                    >
                      Siguiente
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* Zona 4: Claves por Comunidad */}
          <section
            className="border border-black/20 p-6 rounded-2xl space-y-4"
            style={cardStyle}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck size={17} className="text-amber-400" />
                <h3 className="text-sm font-bold">
                  Claves por Comunidad ({integrations.length})
                </h3>
              </div>

              <div className="flex items-center gap-2 text-xs opacity-85">
                <span>Por página:</span>
                <select
                  value={integrationsPerPage}
                  onChange={(e) => {
                    setIntegrationsPerPage(Number(e.target.value));
                    setIntegrationPage(1);
                  }}
                  className="px-2.5 py-1 rounded-lg border border-white/15 text-xs"
                  style={innerStyle}
                >
                  <option value={4}>4</option>
                  <option value={6}>6</option>
                  <option value={10}>10</option>
                </select>
              </div>
            </div>

            <form onSubmit={handleCreateIntegration} className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-5">
                <select
                  value={selectedIntegrationCountryId}
                  onChange={(e) => setSelectedIntegrationCountryId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                  style={innerStyle}
                >
                  {allCountriesForSelect.map((c) => (
                    <option key={c.id} value={c.id}>
                      #{c.id} · {c.name} {!c.is_active ? '(Inactiva)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-4">
                <input
                  type="text"
                  value={newIntegrationLabel}
                  onChange={(e) => setNewIntegrationLabel(e.target.value)}
                  placeholder="Garita Principal"
                  className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                  style={innerStyle}
                />
              </div>
              <div className="md:col-span-3">
                <button
                  type="submit"
                  disabled={creatingIntegration || !selectedIntegrationCountryId}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <KeyRound size={14} />
                  {creatingIntegration ? 'Generando...' : 'Generar Clave'}
                </button>
              </div>
            </form>

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
                  Clave ({latestPlainKey.countryName} · {latestPlainKey.label}) cargada en Sandbox:
                </span>
                <code className="font-mono text-[11px] text-amber-100 break-all">{latestPlainKey.key}</code>
              </div>
            )}

            {loadingIntegrations ? (
              <div className="text-center py-6 rounded-xl border border-black/20 text-xs" style={innerStyle}>
                Cargando claves...
              </div>
            ) : paginatedIntegrations.length === 0 ? (
              <div className="text-center py-6 rounded-xl border border-black/20 text-xs opacity-80" style={innerStyle}>
                Sin claves configuradas.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border border-black/20" style={innerStyle}>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-black/20 opacity-80">
                        <th className="py-2.5 px-3 font-semibold">Comunidad</th>
                        <th className="py-2.5 px-3 font-semibold">Garita</th>
                        <th className="py-2.5 px-3 font-semibold">Clave</th>
                        <th className="py-2.5 px-3 font-semibold">Estado</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/15">
                      {paginatedIntegrations.map((item) => (
                        <tr key={item.id} className="hover:bg-black/10">
                          <td className="py-2.5 px-3 font-semibold">{item.country_name}</td>
                          <td className="py-2.5 px-3 opacity-80">{item.label}</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-amber-300">
                            {item.masked_key}
                          </td>
                          <td className="py-2.5 px-3">
                            {item.is_active ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                activa
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                                inactiva
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleCopyIntegrationKey(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-white/15 cursor-pointer"
                                style={cardStyle}
                              >
                                {copiedIntegrationId === item.id ? (
                                  <>
                                    <Check size={12} className="text-emerald-400" />
                                    <span>Copiada</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={12} />
                                    <span>Copiar</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRotateIntegrationKey(item.id)}
                                disabled={rotatingIntegrationId === item.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-white/15 text-amber-300 cursor-pointer"
                                style={cardStyle}
                              >
                                <RotateCw
                                  size={12}
                                  className={rotatingIntegrationId === item.id ? 'animate-spin' : ''}
                                />
                                <span>Rotar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleIntegrationStatus(item.id)}
                                disabled={togglingIntegrationId === item.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-white/15 cursor-pointer"
                                style={cardStyle}
                              >
                                <Power size={12} />
                                <span>{item.is_active ? 'Desactivar' : 'Activar'}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-1 text-xs opacity-85">
                  <span>
                    Página <strong>{safeIntegrationPage}</strong> de <strong>{integrationTotalPages}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIntegrationPage((p) => Math.max(1, p - 1))}
                      disabled={safeIntegrationPage <= 1}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-white/15 disabled:opacity-40 cursor-pointer"
                      style={innerStyle}
                    >
                      <ChevronLeft size={13} />
                      Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() => setIntegrationPage((p) => Math.min(integrationTotalPages, p + 1))}
                      disabled={safeIntegrationPage >= integrationTotalPages}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-white/15 disabled:opacity-40 cursor-pointer"
                      style={innerStyle}
                    >
                      Siguiente
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* Zona 4: Pases QR Recientes */}
          <section
            className="border border-black/20 p-6 rounded-2xl space-y-4"
            style={cardStyle}
          >
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">
                  Pases QR Recientes ({passTotalCount})
                </h3>
                <p className="text-xs opacity-80 mt-0.5">
                  Vigencia en zona horaria local (<code>{activeTimeZone}</code>); el estado vencido se evalúa en UTC.
                </p>
              </div>

              <form onSubmit={handlePassSearchSubmit} className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={13} className="opacity-70 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={passSearch}
                    onChange={(e) => setPassSearch(e.target.value)}
                    placeholder="Buscar ID, barrio, prestador..."
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                    style={innerStyle}
                  />
                </div>
                <select
                  value={passStatusFilter}
                  onChange={(e) => {
                    setPassStatusFilter(e.target.value);
                    setPassPage(1);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                  style={innerStyle}
                >
                  <option value="all">Todos</option>
                  <option value="pending">Pendientes</option>
                  <option value="expired">Vencidos</option>
                  <option value="cancelled">Cancelados</option>
                  <option value="used">Usados</option>
                </select>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border border-white/15 cursor-pointer"
                  style={innerStyle}
                >
                  Buscar
                </button>
              </form>
            </div>

            {passActionFeedback && (
              <div
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs border ${
                  passActionFeedback.type === 'success'
                    ? 'bg-emerald-950/50 border-emerald-800 text-emerald-200'
                    : 'bg-rose-950/50 border-rose-800 text-rose-200'
                }`}
              >
                {passActionFeedback.type === 'success' ? (
                  <CheckCircle2 size={15} />
                ) : (
                  <AlertCircle size={15} />
                )}
                <span>{passActionFeedback.message}</span>
              </div>
            )}

            {loadingPasses ? (
              <div className="text-center py-6 rounded-xl border border-black/20 text-xs" style={innerStyle}>
                Cargando pases QR...
              </div>
            ) : recentPasses.length === 0 ? (
              <div className="text-center py-6 rounded-xl border border-black/20 text-xs opacity-80" style={innerStyle}>
                Sin pases para este filtro.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border border-black/20" style={innerStyle}>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-black/20 opacity-80">
                        <th className="py-2.5 px-3 font-semibold">ID</th>
                        <th className="py-2.5 px-3 font-semibold">Barrio</th>
                        <th className="py-2.5 px-3 font-semibold">Prestador</th>
                        <th className="py-2.5 px-3 font-semibold">Destino</th>
                        <th className="py-2.5 px-3 font-semibold">Vigencia</th>
                        <th className="py-2.5 px-3 font-semibold">Estado</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/15">
                      {recentPasses.map((passItem) => {
                        const rawStatus = String(passItem.status || '').toLowerCase();
                        const endMs = parsePassTimestampMs(passItem.end_time);
                        const isExpired =
                          rawStatus === 'expired' ||
                          (rawStatus === 'pending' && endMs !== null && Date.now() > endMs);
                        const isCancelled = rawStatus === 'cancelled';

                        return (
                          <tr key={passItem.id} className="hover:bg-black/10">
                            <td className="py-2.5 px-3 font-mono">#{passItem.id}</td>
                            <td className="py-2.5 px-3 font-semibold">
                              {passItem.country_name || `#${passItem.country_id}`}
                            </td>
                            <td className="py-2.5 px-3">
                              {`${passItem.provider_first_name || ''} ${passItem.provider_last_name || ''}`.trim() ||
                                'Prestador'}
                            </td>
                            <td className="py-2.5 px-3 opacity-80">
                              {[passItem.fraction_number, passItem.lot_number]
                                .filter(Boolean)
                                .join(' / ') || '-'}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] font-mono">
                              {formatInTimeZone(passItem.start_time, activeTimeZone)} →{' '}
                              {formatInTimeZone(passItem.end_time, activeTimeZone)}
                            </td>
                            <td className="py-2.5 px-3">{renderPassStatusBadge(passItem)}</td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleCopyAndLoadPass(passItem)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-white/15 cursor-pointer"
                                  style={cardStyle}
                                >
                                  {copiedPassId === passItem.id ? (
                                    <>
                                      <Check size={12} className="text-emerald-400" />
                                      <span>Copiado</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={12} />
                                      <span>Copiar</span>
                                    </>
                                  )}
                                </button>
                                {!isCancelled && !isExpired && (
                                  <button
                                    type="button"
                                    onClick={() => handleCancelPass(passItem.id)}
                                    disabled={cancellingPassId === passItem.id}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-800/80 cursor-pointer"
                                  >
                                    <Ban size={12} />
                                    <span>Cancelar</span>
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

                <div className="flex items-center justify-between pt-1 text-xs opacity-85">
                  <span>
                    Página <strong>{passPage}</strong> de <strong>{passTotalPages}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPassPage((p) => Math.max(1, p - 1))}
                      disabled={passPage <= 1 || loadingPasses}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-white/15 disabled:opacity-40 cursor-pointer"
                      style={innerStyle}
                    >
                      <ChevronLeft size={13} />
                      Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() => setPassPage((p) => Math.min(passTotalPages, p + 1))}
                      disabled={passPage >= passTotalPages || loadingPasses}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-white/15 disabled:opacity-40 cursor-pointer"
                      style={innerStyle}
                    >
                      Siguiente
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* Zona 4: Sandbox endpoint externo */}
          <section
            className="border border-black/20 p-6 rounded-2xl space-y-4"
            style={cardStyle}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold">
                  Sandbox de Validación Externa
                </h3>
                <p className="text-xs opacity-80 mt-0.5">
                  Probá <code>POST /api/v1/external/passes/verify</code> con <code>x-api-key</code> o sesión JWT.
                </p>
              </div>
              <div className="inline-flex rounded-xl p-1 border border-white/15 self-start" style={innerStyle}>
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
            </div>

            {sandboxCopiedHint && (
              <div className="flex flex-wrap items-center justify-between gap-2 bg-sky-950/35 border border-sky-800/70 rounded-xl px-3.5 py-2 text-xs text-sky-200">
                <span>
                  Pase <strong>#{sandboxCopiedHint.passId}</strong> ({sandboxCopiedHint.countryName}) listo en Sandbox.
                </span>
                <span className="font-mono">
                  {sandboxCopiedHint.hasKey
                    ? `Clave: ${sandboxCopiedHint.maskedKey}`
                    : 'Sin clave activa en barrio'}
                </span>
              </div>
            )}

            <form onSubmit={handleRunExternalTest} className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {authMode === 'api_key' && (
                <div className="md:col-span-4">
                  <input
                    type="text"
                    value={testApiKey}
                    onChange={(e) => setTestApiKey(e.target.value)}
                    placeholder="x-api-key (ej: tl_c1_...)"
                    className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs font-mono focus:outline-none"
                    style={innerStyle}
                  />
                </div>
              )}
              <div className={authMode === 'api_key' ? 'md:col-span-6' : 'md:col-span-10'}>
                <input
                  type="text"
                  value={testQrToken}
                  onChange={(e) => setTestQrToken(e.target.value)}
                  placeholder="Pegá o copiá un qr_token..."
                  className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs font-mono focus:outline-none"
                  style={innerStyle}
                />
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={testingEndpoint || !testQrToken.trim()}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 cursor-pointer"
                >
                  <Send size={13} />
                  {testingEndpoint ? 'Probando...' : 'Validar'}
                </button>
              </div>
            </form>

            {sandboxResponse && (
              <div className="border border-black/20 rounded-xl p-4 space-y-2.5" style={innerStyle}>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {sandboxResponse.body?.authorized ? (
                      <CheckCircle2 size={15} className="text-emerald-400" />
                    ) : (
                      <XCircle size={15} className="text-rose-400" />
                    )}
                    <span className="font-bold">
                      {sandboxResponse.body?.authorized ? 'ACCESO AUTORIZADO' : 'ACCESO DENEGADO'}
                    </span>
                    {sandboxResponse.body?.code && (
                      <span
                        className="font-mono text-[11px] px-2 py-0.5 rounded border border-white/15"
                        style={cardStyle}
                      >
                        {sandboxResponse.body.code}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[11px] opacity-80">
                    HTTP {sandboxResponse.httpStatus} · {sandboxResponse.latencyMs} ms
                  </span>
                </div>
                <pre className="text-[11px] font-mono overflow-x-auto max-h-60 opacity-90">
                  {JSON.stringify(sandboxResponse.body, null, 2)}
                </pre>
              </div>
            )}
          </section>
        </>
      ) : (
        /* Pestaña Auditoría */
        <div className="space-y-6">
          {auditError && (
            <div className="flex items-center gap-2 bg-rose-950/60 border border-rose-800/80 text-rose-200 p-4 rounded-xl text-xs">
              <AlertCircle size={16} className="text-rose-400 shrink-0" />
              <span>{auditError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <section className="border border-black/20 p-5 rounded-2xl" style={cardStyle}>
              <div className="text-xs opacity-80">Intentos de validación</div>
              <div className="text-2xl font-black font-mono mt-1">
                {accessSummary.total_attempts}
              </div>
            </section>
            <section className="border border-black/20 p-5 rounded-2xl" style={cardStyle}>
              <div className="text-xs text-emerald-400">Autorizados</div>
              <div className="text-2xl font-black text-emerald-300 font-mono mt-1">
                {accessSummary.authorized_count}
              </div>
            </section>
            <section className="border border-black/20 p-5 rounded-2xl" style={cardStyle}>
              <div className="text-xs text-rose-400">Denegados</div>
              <div className="text-2xl font-black text-rose-300 font-mono mt-1">
                {accessSummary.denied_count}
              </div>
            </section>
          </div>

          <section className="border border-black/20 p-6 rounded-2xl space-y-4" style={cardStyle}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <h3 className="text-sm font-bold">Bitácora de Intentos de Acceso</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  fetchAuditOverview(auditOutcomeFilter, auditSearch);
                }}
                className="flex flex-wrap items-center gap-2"
              >
                <div className="relative">
                  <Search size={13} className="opacity-70 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Buscar motivo o barrio..."
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                    style={innerStyle}
                  />
                </div>
                <select
                  value={auditOutcomeFilter}
                  onChange={(e) => setAuditOutcomeFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                  style={innerStyle}
                >
                  <option value="all">Todos</option>
                  <option value="authorized">Autorizados</option>
                  <option value="denied">Denegados</option>
                </select>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border border-white/15 cursor-pointer"
                  style={innerStyle}
                >
                  Buscar
                </button>
              </form>
            </div>

            {loadingAudit ? (
              <div className="text-center py-6 rounded-xl border border-black/20 text-xs" style={innerStyle}>
                Cargando bitácora...
              </div>
            ) : paginatedAccessLogs.length === 0 ? (
              <div className="text-center py-6 rounded-xl border border-black/20 text-xs opacity-80" style={innerStyle}>
                Sin registros.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border border-black/20" style={innerStyle}>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-black/20 opacity-80">
                        <th className="py-2.5 px-3 font-semibold">Resultado</th>
                        <th className="py-2.5 px-3 font-semibold">Motivo</th>
                        <th className="py-2.5 px-3 font-semibold">Barrio / Origen</th>
                        <th className="py-2.5 px-3 font-semibold">Detalle</th>
                        <th className="py-2.5 px-3 font-semibold">Hora</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/15">
                      {paginatedAccessLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-black/10">
                          <td className="py-2.5 px-3">
                            {log.authorized ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                AUTORIZADO
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                                DENEGADO
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-amber-300">
                            {log.reason_code}
                          </td>
                          <td className="py-2.5 px-3">
                            {log.country_name || log.integration_label || log.auth_mode}
                          </td>
                          <td className="py-2.5 px-3">{log.message}</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] opacity-80">
                            {formatInTimeZone(log.created_at, activeTimeZone)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-1 text-xs opacity-85">
                  <span>
                    Página <strong>{safeAuditPage}</strong> de <strong>{auditTotalPages}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                      disabled={safeAuditPage <= 1}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-white/15 disabled:opacity-40 cursor-pointer"
                      style={innerStyle}
                    >
                      <ChevronLeft size={13} />
                      Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))}
                      disabled={safeAuditPage >= auditTotalPages}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-white/15 disabled:opacity-40 cursor-pointer"
                      style={innerStyle}
                    >
                      Siguiente
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="border border-black/20 p-6 rounded-2xl space-y-4" style={cardStyle}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h3 className="text-sm font-bold">Contratos y Transacciones</h3>
              <div className="flex flex-wrap gap-4 text-xs font-mono">
                <span>
                  Volumen: <strong>${financialSummary.gross_volume}</strong>
                </span>
                <span className="text-emerald-300">
                  Comisión: <strong>${financialSummary.platform_fees}</strong>
                </span>
                <span className="text-sky-300">
                  Prestador: <strong>${financialSummary.provider_payouts}</strong>
                </span>
              </div>
            </div>

            {transactionsList.length === 0 ? (
              <div className="text-center py-6 rounded-xl border border-black/20 text-xs opacity-80" style={innerStyle}>
                Sin transacciones registradas ({financialSummary.total_contracts} contratos).
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-black/20" style={innerStyle}>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-black/20 opacity-80">
                      <th className="py-2.5 px-3 font-semibold">#TX</th>
                      <th className="py-2.5 px-3 font-semibold">Contrato</th>
                      <th className="py-2.5 px-3 font-semibold">Monto</th>
                      <th className="py-2.5 px-3 font-semibold">Comisión</th>
                      <th className="py-2.5 px-3 font-semibold">Neto</th>
                      <th className="py-2.5 px-3 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/15">
                    {transactionsList.map((tx) => (
                      <tr key={tx.id} className="hover:bg-black/10">
                        <td className="py-2.5 px-3 font-mono">#{tx.id}</td>
                        <td className="py-2.5 px-3">
                          {tx.contract_description || `Contrato #${tx.contract_id}`}
                        </td>
                        <td className="py-2.5 px-3 font-mono">${tx.total_amount}</td>
                        <td className="py-2.5 px-3 font-mono text-emerald-300">${tx.platform_fee}</td>
                        <td className="py-2.5 px-3 font-mono text-sky-300">${tx.provider_payout}</td>
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
    </div>
  );
}