/**
 * @file SystemHealthDashboard.jsx
 * @description Consola técnica y de integración externa para superadmin con estética minimalista
 * unificada al resto del sistema, conversión horaria al usuario y persistencia de estados.
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
  Power
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

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

const getPassEndMs = (passItem) => {
  if (passItem?.end_utc_ms !== null && passItem?.end_utc_ms !== undefined) {
    const n = Number(passItem.end_utc_ms);
    if (!Number.isNaN(n)) return n;
  }
  if (!passItem?.end_time) return null;
  const fallback = new Date(passItem.end_time).getTime();
  return Number.isNaN(fallback) ? null : fallback;
};

const formatEpochInUserTimeZone = (epochMs, rawFallback, timeZone) => {
  let ms = null;
  if (epochMs !== null && epochMs !== undefined && !Number.isNaN(Number(epochMs))) {
    ms = Number(epochMs);
  } else if (rawFallback) {
    const parsed = new Date(rawFallback).getTime();
    if (!Number.isNaN(parsed)) ms = parsed;
  }

  if (ms === null) return '-';

  return new Date(ms).toLocaleString('es-AR', {
    timeZone: timeZone || 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function SystemHealthDashboard() {
  const { user } = useAuth();
  const activeTimeZone = resolveUserTimeZone(user);

  const [activeTab, setActiveTab] = useState('health');

  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [healthData, setHealthData] = useState(null);
  const [diagnosticsData, setDiagnosticsData] = useState(null);
  const [httpLatencyMs, setHttpLatencyMs] = useState(null);

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

  const [authMode, setAuthMode] = useState('api_key');
  const [testApiKey, setTestApiKey] = useState('');
  const [testQrToken, setTestQrToken] = useState('');
  const [testingEndpoint, setTestingEndpoint] = useState(false);
  const [sandboxResponse, setSandboxResponse] = useState(null);

  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [auditOutcomeFilter, setAuditOutcomeFilter] = useState('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [accessSummary, setAccessSummary] = useState({
    total_attempts: 0,
    authorized_count: 0,
    denied_count: 0
  });
  const [accessLogs, setAccessLogs] = useState([]);
  const [financialSummary, setFinancialSummary] = useState({
    total_contracts: 0,
    pending_contracts: 0,
    completed_contracts: 0,
    total_transactions: 0,
    gross_volume: '0.00',
    platform_fees: '0.00',
    provider_payouts: '0.00'
  });
  const [transactionsList, setTransactionsList] = useState([]);

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`
  });

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

      const healthJson = await healthRes.json();
      setHealthData({
        ok: healthRes.ok,
        status: healthRes.status,
        data: healthJson
      });

      if (diagRes.ok) {
        const diagJson = await diagRes.json();
        setDiagnosticsData(diagJson);
      } else {
        const errJson = await diagRes.json().catch(() => ({}));
        setDiagnosticsData(null);
        setStatusError(errJson.error || 'No se pudo obtener el diagnóstico técnico.');
      }
    } catch (error) {
      console.error('Error al consultar salud del sistema:', error);
      setStatusError('No se pudo conectar con el servidor backend.');
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
        search: searchToLoad
      });
      const res = await fetch(`${API_BASE}/api/v1/external/countries?${params.toString()}`, {
        headers: getAuthHeaders()
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
        headers: getAuthHeaders()
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
        search: searchToLoad
      });
      const res = await fetch(`${API_BASE}/api/v1/external/passes?${params.toString()}`, {
        headers: getAuthHeaders()
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
        search: searchToLoad
      });
      const res = await fetch(`${API_BASE}/api/v1/external/audit?${params.toString()}`, {
        headers: getAuthHeaders()
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
            provider_payouts: '0.00'
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
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          name: newCountryName.trim(),
          location: newCountryLocation.trim() || null,
          is_active: true
        })
      });
      const data = await res.json();
      if (res.ok) {
        setCountryFeedback({
          type: 'success',
          message: data.message || 'Comunidad creada.'
        });
        setNewCountryName('');
        setNewCountryLocation('');
        await Promise.all([
          fetchCountries(1, countrySearch, countryStatusFilter),
          fetchCommunityIntegrations(),
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
      setCountryFeedback({
        type: 'error',
        message: 'Error de conexión al crear la comunidad.'
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
        message: 'El nombre es obligatorio.'
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
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          name: editCountryName.trim(),
          location: editCountryLocation.trim() || null,
          is_active: editCountryActive
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
          fetchCountries(countryPage, countrySearch, countryStatusFilter),
          fetchCommunityIntegrations(),
          fetchSystemHealth()
        ]);
      } else {
        setCountryFeedback({
          type: 'error',
          message: data.error || 'No se pudo actualizar.'
        });
      }
    } catch (error) {
      console.error('Error al editar comunidad:', error);
      setCountryFeedback({
        type: 'error',
        message: 'Error de conexión.'
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
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setCountryFeedback({
          type: 'success',
          message: data.message || 'Estado actualizado.'
        });
        await Promise.all([
          fetchCountries(countryPage, countrySearch, countryStatusFilter),
          fetchCommunityIntegrations(),
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
      setCountryFeedback({
        type: 'error',
        message: 'Error de conexión.'
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
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          country_id: Number(selectedIntegrationCountryId),
          label: newIntegrationLabel.trim() || 'Garita Principal'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setIntegrationFeedback({
          type: 'success',
          message: data.message || 'Clave generada.'
        });
        if (data.plain_api_key) {
          setLatestPlainKey({
            countryName: data.integration?.country_name || '',
            label: data.integration?.label || '',
            key: data.plain_api_key
          });
          setAuthMode('api_key');
          setTestApiKey(data.plain_api_key);
        }
        setIntegrationPage(1);
        await Promise.all([fetchCommunityIntegrations(), fetchSystemHealth()]);
      } else {
        setIntegrationFeedback({
          type: 'error',
          message: data.error || 'No se pudo generar la clave.'
        });
      }
    } catch (error) {
      console.error('Error al generar clave:', error);
      setIntegrationFeedback({
        type: 'error',
        message: 'Error de conexión.'
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
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setIntegrationFeedback({
          type: 'success',
          message: data.message || 'Clave rotada.'
        });
        if (data.plain_api_key) {
          setLatestPlainKey({
            countryName: data.integration?.country_name || '',
            label: data.integration?.label || '',
            key: data.plain_api_key
          });
          setAuthMode('api_key');
          setTestApiKey(data.plain_api_key);
        }
        await fetchCommunityIntegrations();
      } else {
        setIntegrationFeedback({
          type: 'error',
          message: data.error || 'No se pudo rotar la clave.'
        });
      }
    } catch (error) {
      console.error('Error al rotar clave:', error);
      setIntegrationFeedback({
        type: 'error',
        message: 'Error de conexión.'
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
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setIntegrationFeedback({
          type: 'success',
          message: data.message || 'Estado actualizado.'
        });
        await Promise.all([fetchCommunityIntegrations(), fetchSystemHealth()]);
      } else {
        setIntegrationFeedback({
          type: 'error',
          message: data.error || 'No se pudo actualizar.'
        });
      }
    } catch (error) {
      console.error('Error al cambiar estado de integración:', error);
      setIntegrationFeedback({
        type: 'error',
        message: 'Error de conexión.'
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
        hasKey: true
      });
    } else {
      setSandboxCopiedHint({
        passId: passItem.id,
        countryName: passItem.country_name || `Comunidad #${passItem.country_id}`,
        maskedKey: null,
        hasKey: false
      });
    }
  };

  const handleCancelPass = async (passId) => {
    setCancellingPassId(passId);
    setPassActionFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/passes/${passId}/cancel`, {
        method: 'PATCH',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setPassActionFeedback({
          type: 'success',
          message: data.message || `Pase #${passId} cancelado.`
        });
        await Promise.all([
          fetchRecentPasses(passPage, passSearch, passStatusFilter),
          fetchSystemHealth()
        ]);
      } else {
        setPassActionFeedback({
          type: 'error',
          message: data.error || 'No se pudo cancelar el pase.'
        });
      }
    } catch (error) {
      console.error('Error al cancelar pase:', error);
      setPassActionFeedback({
        type: 'error',
        message: 'Error de conexión.'
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
        'Content-Type': 'application/json'
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
          qr_token: testQrToken.trim()
        })
      });

      const elapsed = Math.round(performance.now() - startedAt);
      const bodyJson = await response.json().catch(() => ({}));

      setSandboxResponse({
        ok: response.ok,
        httpStatus: response.status,
        latencyMs: elapsed,
        body: bodyJson
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
          error: 'Error de red al invocar POST /api/v1/external/passes/verify.'
        }
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
    const endMs = getPassEndMs(passItem);
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
    <div className="flex-1 bg-slate-900 text-slate-100 font-sans p-6 md:p-8">
      <main className="max-w-6xl mx-auto space-y-6">
        {/* Cabecera minimalista */}
        <div className="bg-slate-950 border border-slate-800 p-5 md:p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Activity size={20} />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black tracking-tight text-white">
                Salud &amp; APIs
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Estado del sistema, barrios, claves, pases QR y auditoría.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-slate-900 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('health')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'health'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Salud &amp; APIs
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'audit'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileSpreadsheet size={13} />
                Auditoría
              </button>
            </div>

            <button
              type="button"
              onClick={handleRefreshAll}
              disabled={loadingStatus || loadingCountries || loadingIntegrations || loadingPasses || loadingAudit}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw
                size={13}
                className={
                  loadingStatus || loadingCountries || loadingIntegrations || loadingPasses || loadingAudit
                    ? 'animate-spin'
                    : ''
                }
              />
              Actualizar
            </button>
          </div>
        </div>

        {activeTab === 'health' ? (
          <>
            {statusError && (
              <div className="flex items-center gap-2 bg-rose-950/60 border border-rose-800/80 text-rose-200 p-4 rounded-xl text-xs">
                <AlertCircle size={16} className="text-rose-400 shrink-0" />
                <span>{statusError}</span>
              </div>
            )}

            {/* Tarjetas de estado */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-200 font-bold text-xs">
                    <Server size={16} className="text-sky-400" />
                    <span>Backend</span>
                  </div>
                  {loadingStatus ? (
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-900 text-slate-400">
                      ...
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
                <div className="space-y-1.5 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Latencia HTTP:</span>
                    <span className="font-mono text-slate-200">
                      {httpLatencyMs !== null ? `${httpLatencyMs} ms` : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tiempo activo:</span>
                    <span className="font-mono text-slate-200">
                      {formatUptime(diagnosticsData?.uptime_seconds)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-200 font-bold text-xs">
                    <Database size={16} className="text-indigo-400" />
                    <span>PostgreSQL</span>
                  </div>
                  {loadingStatus ? (
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-900 text-slate-400">
                      ...
                    </span>
                  ) : isDbConnected ? (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                      CONECTADA
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800">
                      OFFLINE
                    </span>
                  )}
                </div>
                <div className="space-y-1.5 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Latencia consulta:</span>
                    <span className="font-mono text-slate-200">
                      {typeof diagnosticsData?.database?.latency_ms === 'number'
                        ? `${diagnosticsData.database.latency_ms} ms`
                        : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pases / Vencidos:</span>
                    <span className="font-mono text-slate-200">
                      {diagnosticsData?.metrics?.total_passes ?? '-'} /{' '}
                      {diagnosticsData?.metrics?.expired_passes ?? '-'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-200 font-bold text-xs">
                    <KeyRound size={16} className="text-amber-400" />
                    <span>API Externa</span>
                  </div>
                  {loadingStatus ? (
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-900 text-slate-400">
                      ...
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
                <div className="space-y-1.5 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Claves activas:</span>
                    <span className="font-mono text-slate-200">
                      {diagnosticsData?.external_endpoint?.active_community_keys ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Barrios activos:</span>
                    <span className="font-mono text-slate-200">
                      {diagnosticsData?.metrics?.active_countries ?? '-'} /{' '}
                      {diagnosticsData?.metrics?.total_countries ?? '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Comunidades y Barrios */}
            <div className="bg-slate-950 border border-slate-800 p-5 md:p-6 rounded-2xl shadow-xl space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Building2 size={17} className="text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">
                    Comunidades ({countryTotalCount})
                  </h3>
                </div>

                <form onSubmit={handleCountrySearchSubmit} className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search size={13} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      placeholder="Buscar barrio..."
                      className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <select
                    value={countryStatusFilter}
                    onChange={(e) => {
                      setCountryStatusFilter(e.target.value);
                      setCountryPage(1);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="all">Todas</option>
                    <option value="active">Activas</option>
                    <option value="inactive">Inactivas</option>
                  </select>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 cursor-pointer"
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
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="md:col-span-5">
                  <input
                    type="text"
                    value={newCountryLocation}
                    onChange={(e) => setNewCountryLocation(e.target.value)}
                    placeholder="Ubicación"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
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
                <div className="text-center py-6 text-xs text-slate-400">Cargando comunidades...</div>
              ) : countries.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">Sin resultados.</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-2.5 px-3 font-semibold">ID</th>
                          <th className="py-2.5 px-3 font-semibold">Barrio</th>
                          <th className="py-2.5 px-3 font-semibold">Ubicación</th>
                          <th className="py-2.5 px-3 font-semibold">Estado</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900">
                        {countries.map((countryItem) => {
                          const isEditing = editingCountryId === countryItem.id;
                          return (
                            <tr key={countryItem.id} className="hover:bg-slate-900/50">
                              <td className="py-2.5 px-3 font-mono text-slate-300">#{countryItem.id}</td>
                              <td className="py-2.5 px-3">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editCountryName}
                                    onChange={(e) => setEditCountryName(e.target.value)}
                                    className="w-full px-2.5 py-1 rounded-lg bg-slate-900 border border-emerald-600 text-xs text-white focus:outline-none"
                                  />
                                ) : (
                                  <span className="font-semibold text-slate-200">{countryItem.name}</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editCountryLocation}
                                    onChange={(e) => setEditCountryLocation(e.target.value)}
                                    className="w-full px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none"
                                  />
                                ) : (
                                  <span className="text-slate-400">{countryItem.location || '-'}</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                {isEditing ? (
                                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-200 cursor-pointer">
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
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
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
                                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 cursor-pointer"
                                      >
                                        Cancelar
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => startEditingCountry(countryItem)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                                      >
                                        <Pencil size={12} />
                                        <span>Editar</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleCountry(countryItem.id)}
                                        disabled={togglingCountryId === countryItem.id}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
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

                  <div className="flex items-center justify-between pt-1 text-xs text-slate-400">
                    <span>
                      Página <strong className="text-slate-200">{countryPage}</strong> de{' '}
                      <strong className="text-slate-200">{countryTotalPages}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCountryPage((p) => Math.max(1, p - 1))}
                        disabled={countryPage <= 1 || loadingCountries}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 cursor-pointer"
                      >
                        <ChevronLeft size={13} />
                        Anterior
                      </button>
                      <button
                        type="button"
                        onClick={() => setCountryPage((p) => Math.min(countryTotalPages, p + 1))}
                        disabled={countryPage >= countryTotalPages || loadingCountries}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 cursor-pointer"
                      >
                        Siguiente
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Claves API por Comunidad */}
            <div className="bg-slate-950 border border-slate-800 p-5 md:p-6 rounded-2xl shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={17} className="text-amber-400" />
                  <h3 className="text-sm font-bold text-white">
                    Claves por Comunidad ({integrations.length})
                  </h3>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Por página:</span>
                  <select
                    value={integrationsPerPage}
                    onChange={(e) => {
                      setIntegrationsPerPage(Number(e.target.value));
                      setIntegrationPage(1);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200"
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
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
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
                    placeholder="Etiqueta (ej: Garita Principal)"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
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
                <div className="text-center py-6 text-xs text-slate-400">Cargando claves...</div>
              ) : paginatedIntegrations.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">Sin claves configuradas.</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-2.5 px-3 font-semibold">Comunidad</th>
                          <th className="py-2.5 px-3 font-semibold">Garita</th>
                          <th className="py-2.5 px-3 font-semibold">Clave</th>
                          <th className="py-2.5 px-3 font-semibold">Estado</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900">
                        {paginatedIntegrations.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-900/50">
                            <td className="py-2.5 px-3 font-semibold text-slate-200">{item.country_name}</td>
                            <td className="py-2.5 px-3 text-slate-400">{item.label}</td>
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
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
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
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 cursor-pointer"
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
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
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

                  <div className="flex items-center justify-between pt-1 text-xs text-slate-400">
                    <span>
                      Página <strong className="text-slate-200">{safeIntegrationPage}</strong> de{' '}
                      <strong className="text-slate-200">{integrationTotalPages}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIntegrationPage((p) => Math.max(1, p - 1))}
                        disabled={safeIntegrationPage <= 1}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 cursor-pointer"
                      >
                        <ChevronLeft size={13} />
                        Anterior
                      </button>
                      <button
                        type="button"
                        onClick={() => setIntegrationPage((p) => Math.min(integrationTotalPages, p + 1))}
                        disabled={safeIntegrationPage >= integrationTotalPages}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 cursor-pointer"
                      >
                        Siguiente
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Pases QR Recientes */}
            <div className="bg-slate-950 border border-slate-800 p-5 md:p-6 rounded-2xl shadow-xl space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <h3 className="text-sm font-bold text-white">
                  Pases QR ({passTotalCount}) · {activeTimeZone}
                </h3>

                <form onSubmit={handlePassSearchSubmit} className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search size={13} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={passSearch}
                      onChange={(e) => setPassSearch(e.target.value)}
                      placeholder="Buscar ID, barrio, prestador..."
                      className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <select
                    value={passStatusFilter}
                    onChange={(e) => {
                      setPassStatusFilter(e.target.value);
                      setPassPage(1);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="all">Todos</option>
                    <option value="pending">Pendientes</option>
                    <option value="expired">Vencidos</option>
                    <option value="cancelled">Cancelados</option>
                    <option value="used">Usados</option>
                  </select>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 cursor-pointer"
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
                <div className="text-center py-6 text-xs text-slate-400">Cargando pases QR...</div>
              ) : recentPasses.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">Sin pases para este filtro.</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-2.5 px-3 font-semibold">ID</th>
                          <th className="py-2.5 px-3 font-semibold">Barrio</th>
                          <th className="py-2.5 px-3 font-semibold">Prestador</th>
                          <th className="py-2.5 px-3 font-semibold">Destino</th>
                          <th className="py-2.5 px-3 font-semibold">Vigencia</th>
                          <th className="py-2.5 px-3 font-semibold">Estado</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900">
                        {recentPasses.map((passItem) => {
                          const rawStatus = String(passItem.status || '').toLowerCase();
                          const endMs = getPassEndMs(passItem);
                          const isExpired =
                            rawStatus === 'expired' ||
                            (rawStatus === 'pending' && endMs !== null && Date.now() > endMs);
                          const isCancelled = rawStatus === 'cancelled';

                          return (
                            <tr key={passItem.id} className="hover:bg-slate-900/50">
                              <td className="py-2.5 px-3 font-mono text-slate-300">#{passItem.id}</td>
                              <td className="py-2.5 px-3 font-semibold text-sky-300">
                                {passItem.country_name || `#${passItem.country_id}`}
                              </td>
                              <td className="py-2.5 px-3 text-slate-200">
                                {`${passItem.provider_first_name || ''} ${passItem.provider_last_name || ''}`.trim() ||
                                  'Prestador'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-400">
                                {[passItem.fraction_number, passItem.lot_number]
                                  .filter(Boolean)
                                  .join(' / ') || '-'}
                              </td>
                              <td className="py-2.5 px-3 text-[11px] text-slate-300 font-mono">
                                {formatEpochInUserTimeZone(
                                  passItem.start_utc_ms,
                                  passItem.start_time,
                                  activeTimeZone
                                )}{' '}
                                →{' '}
                                {formatEpochInUserTimeZone(
                                  passItem.end_utc_ms,
                                  passItem.end_time,
                                  activeTimeZone
                                )}
                              </td>
                              <td className="py-2.5 px-3">{renderPassStatusBadge(passItem)}</td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleCopyAndLoadPass(passItem)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
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

                  <div className="flex items-center justify-between pt-1 text-xs text-slate-400">
                    <span>
                      Página <strong className="text-slate-200">{passPage}</strong> de{' '}
                      <strong className="text-slate-200">{passTotalPages}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPassPage((p) => Math.max(1, p - 1))}
                        disabled={passPage <= 1 || loadingPasses}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 cursor-pointer"
                      >
                        <ChevronLeft size={13} />
                        Anterior
                      </button>
                      <button
                        type="button"
                        onClick={() => setPassPage((p) => Math.min(passTotalPages, p + 1))}
                        disabled={passPage >= passTotalPages || loadingPasses}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 cursor-pointer"
                      >
                        Siguiente
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Sandbox QR */}
            <div className="bg-slate-950 border border-slate-800 p-5 md:p-6 rounded-2xl shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h3 className="text-sm font-bold text-white">Sandbox QR</h3>
                <div className="inline-flex rounded-xl bg-slate-900 p-1 border border-slate-800 self-start">
                  <button
                    type="button"
                    onClick={() => setAuthMode('api_key')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      authMode === 'api_key'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    x-api-key
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('jwt')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      authMode === 'jwt'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Bearer JWT
                  </button>
                </div>
              </div>

              {sandboxCopiedHint && (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-sky-950/35 border border-sky-800/70 rounded-xl px-3.5 py-2 text-xs text-sky-200">
                  <span>
                    Pase <strong>#{sandboxCopiedHint.passId}</strong> ({sandboxCopiedHint.countryName}) listo.
                  </span>
                  <span className="font-mono">
                    {sandboxCopiedHint.hasKey ? `Clave: ${sandboxCopiedHint.maskedKey}` : 'Sin clave activa en barrio'}
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
                      placeholder="x-api-key"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                )}
                <div className={authMode === 'api_key' ? 'md:col-span-6' : 'md:col-span-10'}>
                  <input
                    type="text"
                    value={testQrToken}
                    onChange={(e) => setTestQrToken(e.target.value)}
                    placeholder="qr_token"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
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
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {sandboxResponse.body?.authorized ? (
                        <CheckCircle2 size={15} className="text-emerald-400" />
                      ) : (
                        <XCircle size={15} className="text-rose-400" />
                      )}
                      <span className="font-bold text-slate-200">
                        {sandboxResponse.body?.authorized ? 'AUTORIZADO' : 'DENEGADO'}
                      </span>
                      {sandboxResponse.body?.code && (
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                          {sandboxResponse.body.code}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[11px] text-slate-400">
                      HTTP {sandboxResponse.httpStatus} · {sandboxResponse.latencyMs} ms
                    </span>
                  </div>
                  <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto max-h-60">
                    {JSON.stringify(sandboxResponse.body, null, 2)}
                  </pre>
                </div>
              )}
            </div>
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
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-xl">
                <div className="text-xs text-slate-400">Intentos</div>
                <div className="text-2xl font-black text-white font-mono mt-1">
                  {accessSummary.total_attempts}
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-xl">
                <div className="text-xs text-emerald-400">Autorizados</div>
                <div className="text-2xl font-black text-emerald-300 font-mono mt-1">
                  {accessSummary.authorized_count}
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-xl">
                <div className="text-xs text-rose-400">Denegados</div>
                <div className="text-2xl font-black text-rose-300 font-mono mt-1">
                  {accessSummary.denied_count}
                </div>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-5 md:p-6 rounded-2xl shadow-xl space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <h3 className="text-sm font-bold text-white">Bitácora de Accesos</h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    fetchAuditOverview(auditOutcomeFilter, auditSearch);
                  }}
                  className="flex flex-wrap items-center gap-2"
                >
                  <div className="relative">
                    <Search size={13} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      placeholder="Buscar motivo o barrio..."
                      className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <select
                    value={auditOutcomeFilter}
                    onChange={(e) => setAuditOutcomeFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="all">Todos</option>
                    <option value="authorized">Autorizados</option>
                    <option value="denied">Denegados</option>
                  </select>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 cursor-pointer"
                  >
                    Buscar
                  </button>
                </form>
              </div>

              {loadingAudit ? (
                <div className="text-center py-6 text-xs text-slate-400">Cargando bitácora...</div>
              ) : paginatedAccessLogs.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">Sin registros.</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-2.5 px-3 font-semibold">Resultado</th>
                          <th className="py-2.5 px-3 font-semibold">Motivo</th>
                          <th className="py-2.5 px-3 font-semibold">Barrio / Origen</th>
                          <th className="py-2.5 px-3 font-semibold">Detalle</th>
                          <th className="py-2.5 px-3 font-semibold">Hora</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900">
                        {paginatedAccessLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-900/50">
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
                            <td className="py-2.5 px-3 text-slate-300">
                              {log.country_name || log.integration_label || log.auth_mode}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300">{log.message}</td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                              {formatEpochInUserTimeZone(null, log.created_at, activeTimeZone)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs text-slate-400">
                    <span>
                      Página <strong className="text-slate-200">{safeAuditPage}</strong> de{' '}
                      <strong className="text-slate-200">{auditTotalPages}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                        disabled={safeAuditPage <= 1}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 cursor-pointer"
                      >
                        <ChevronLeft size={13} />
                        Anterior
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))}
                        disabled={safeAuditPage >= auditTotalPages}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 cursor-pointer"
                      >
                        Siguiente
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="bg-slate-950 border border-slate-800 p-5 md:p-6 rounded-2xl shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h3 className="text-sm font-bold text-white">Transacciones</h3>
                <div className="flex flex-wrap gap-4 text-xs font-mono">
                  <span className="text-slate-300">
                    Volumen: <strong className="text-white">${financialSummary.gross_volume}</strong>
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
                <div className="text-center py-6 text-xs text-slate-500">
                  Sin transacciones ({financialSummary.total_contracts} contratos).
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2.5 px-3 font-semibold">#TX</th>
                        <th className="py-2.5 px-3 font-semibold">Contrato</th>
                        <th className="py-2.5 px-3 font-semibold">Monto</th>
                        <th className="py-2.5 px-3 font-semibold">Comisión</th>
                        <th className="py-2.5 px-3 font-semibold">Neto</th>
                        <th className="py-2.5 px-3 font-semibold">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {transactionsList.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-900/50">
                          <td className="py-2.5 px-3 font-mono text-slate-300">#{tx.id}</td>
                          <td className="py-2.5 px-3 text-slate-200">
                            {tx.contract_description || `Contrato #${tx.contract_id}`}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-200">${tx.total_amount}</td>
                          <td className="py-2.5 px-3 font-mono text-emerald-300">${tx.platform_fee}</td>
                          <td className="py-2.5 px-3 font-mono text-sky-300">${tx.provider_payout}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-300">{tx.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}