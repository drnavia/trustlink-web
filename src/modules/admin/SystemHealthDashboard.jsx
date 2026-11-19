/**
 * @file SystemHealthDashboard.jsx
 * @description Dashboard técnico exclusivo para 'superadmin'. Incluye salud del sistema,
 * resumen ejecutivo de gobernanza, integraciones y claves por comunidad (con paginación),
 * gestión de comunidades, pases QR recientes, trazabilidad de eventos / auditoría de accesos
 * y transacciones con paginación, y sandbox del endpoint externo.
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
  AlertCircle,
  Terminal,
  Clock,
  QrCode,
  Copy,
  Ban,
  Check,
  Building2,
  Plus,
  Power,
  Pencil,
  RotateCw,
  ShieldCheck,
  Users,
  ArrowUpRight,
  ClipboardList,
  Receipt
} from 'lucide-react';

const API_BASE = 'http://localhost:4000';

export default function SystemHealthDashboard({ onNavigate }) {
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [httpLatencyMs, setHttpLatencyMs] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [diagnosticsData, setDiagnosticsData] = useState(null);

  // Comunidades (nombre, dirección, código postal, localidad, provincia, estado)
  const [countries, setCountries] = useState([]);
  const [allCountriesForSelect, setAllCountriesForSelect] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [newCountryForm, setNewCountryForm] = useState({
    name: '',
    address: '',
    postal_code: '',
    locality: '',
    province: '',
    is_active: true
  });
  const [creatingCountry, setCreatingCountry] = useState(false);
  const [countryFeedback, setCountryFeedback] = useState({ type: '', message: '' });
  const [togglingCountryId, setTogglingCountryId] = useState(null);
  const [editingCountryId, setEditingCountryId] = useState(null);
  const [editCountryForm, setEditCountryForm] = useState({
    name: '',
    address: '',
    postal_code: '',
    locality: '',
    province: '',
    is_active: true
  });
  const [savingCountryId, setSavingCountryId] = useState(null);
  const [countrySearch, setCountrySearch] = useState('');
  const [countryStatusFilter, setCountryStatusFilter] = useState('all');
  const [countryPage, setCountryPage] = useState(1);
  const [countryTotalPages, setCountryTotalPages] = useState(1);
  const [countryTotalCount, setCountryTotalCount] = useState(0);
  const [countriesPerPage, setCountriesPerPage] = useState(6);

  // Integraciones y claves por comunidad (con paginación)
  const [integrations, setIntegrations] = useState([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);
  const [selectedCountryId, setSelectedCountryId] = useState('');
  const [integrationLabel, setIntegrationLabel] = useState('Garita Principal');
  const [creatingIntegration, setCreatingIntegration] = useState(false);
  const [integrationFeedback, setIntegrationFeedback] = useState({ type: '', message: '' });
  const [freshSecretKey, setFreshSecretKey] = useState(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedIntegrationId, setCopiedIntegrationId] = useState(null);
  const [busyIntegrationId, setBusyIntegrationId] = useState(null);
  const [integrationPage, setIntegrationPage] = useState(1);
  const [integrationsPerPage, setIntegrationsPerPage] = useState(6);

  // Pases QR recientes con paginación y filtros
  const [recentPasses, setRecentPasses] = useState([]);
  const [loadingPasses, setLoadingPasses] = useState(true);
  const [passPage, setPassPage] = useState(1);
  const [passTotalPages, setPassTotalPages] = useState(1);
  const [passTotalCount, setPassTotalCount] = useState(0);
  const [passStatusFilter, setPassStatusFilter] = useState('all');
  const [passSearch, setPassSearch] = useState('');
  const [passesPerPage, setPassesPerPage] = useState(8);
  const [copiedTokenId, setCopiedTokenId] = useState(null);
  const [cancellingPassId, setCancellingPassId] = useState(null);
  const [passActionMsg, setPassActionMsg] = useState({ type: '', text: '' });

  // Auditoría de accesos y transacciones con paginación
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [auditTab, setAuditTab] = useState('access');
  const [auditOutcomeFilter, setAuditOutcomeFilter] = useState('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditTotalCount, setAuditTotalCount] = useState(0);
  const [auditPerPage, setAuditPerPage] = useState(6);
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
  const [transactions, setTransactions] = useState([]);

  // Sandbox endpoint externo
  const [testQrToken, setTestQrToken] = useState('');
  const [testApiKey, setTestApiKey] = useState('tl_gate_dev_key_123456');
  const [sandboxKeyMeta, setSandboxKeyMeta] = useState('');
  const [authMode, setAuthMode] = useState('api_key');
  const [testingEndpoint, setTestingEndpoint] = useState(false);
  const [sandboxResponse, setSandboxResponse] = useState(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('trustlink_token') || '';
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };
  };

  const parsePassUtcMs = (value) => {
    if (!value) return null;
    const raw = String(value).trim();
    const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(raw);
    const normalized = hasTz ? raw : `${raw.replace(' ', 'T')}Z`;
    const ms = new Date(normalized).getTime();
    if (!Number.isNaN(ms)) return ms;
    const fallback = new Date(raw).getTime();
    return Number.isNaN(fallback) ? null : fallback;
  };

  const formatDateTimeShort = (value) => {
    const ms = parsePassUtcMs(value);
    if (ms === null) return '—';
    return new Date(ms).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPassEffectiveStatus = (passItem) => {
    const rawStatus = String(passItem?.status || 'pending').toLowerCase();
    if (rawStatus === 'cancelled') {
      return {
        key: 'cancelled',
        label: 'cancelled',
        sublabel: null,
        badgeClass: 'bg-rose-950 text-rose-300 border-rose-800'
      };
    }
    if (rawStatus === 'used') {
      return {
        key: 'used',
        label: 'used',
        sublabel: null,
        badgeClass: 'bg-sky-950 text-sky-300 border-sky-800'
      };
    }

    const nowMs = Date.now();
    const startMs = parsePassUtcMs(passItem?.start_time);
    const endMs = parsePassUtcMs(passItem?.end_time);

    if (rawStatus === 'expired' || (endMs !== null && nowMs > endMs)) {
      return {
        key: 'expired',
        label: 'vencido',
        sublabel: rawStatus === 'pending' ? 'fuera de horario' : null,
        badgeClass: 'bg-amber-950 text-amber-300 border-amber-700'
      };
    }

    if (startMs !== null && nowMs < startMs) {
      return {
        key: 'scheduled',
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

  const fetchSystemHealth = async () => {
    setLoadingStatus(true);
    setStatusError('');
    const startedAt = performance.now();
    try {
      const token = localStorage.getItem('trustlink_token') || '';
      const [healthRes, diagRes] = await Promise.all([
        fetch(`${API_BASE}/health`),
        fetch(`${API_BASE}/api/v1/external/status`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const elapsed = Math.round(performance.now() - startedAt);
      setHttpLatencyMs(elapsed);

      const healthJson = await healthRes.json();
      setHealthData({
        ok: healthRes.ok,
        httpStatus: healthRes.status,
        payload: healthJson
      });

      const diagJson = await diagRes.json();
      setDiagnosticsData({
        ok: diagRes.ok,
        httpStatus: diagRes.status,
        ...diagJson
      });

      if (!diagRes.ok) {
        setStatusError(diagJson.error || 'No se pudo obtener el diagnóstico técnico.');
      }
    } catch (error) {
      console.error('Error al consultar salud del sistema:', error);
      setStatusError('No se pudo conectar con el servidor backend en http://localhost:4000.');
    } finally {
      setLoadingStatus(false);
    }
  };

  const fetchCountries = async (
    pageToLoad = countryPage,
    searchToLoad = countrySearch,
    statusToLoad = countryStatusFilter,
    limitToLoad = countriesPerPage
  ) => {
    setLoadingCountries(true);
    try {
      const params = new URLSearchParams({
        page: String(pageToLoad),
        limit: String(limitToLoad),
        status: statusToLoad,
        search: searchToLoad
      });
      const res = await fetch(`${API_BASE}/api/v1/external/countries?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}` }
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

  const fetchIntegrations = async () => {
    setLoadingIntegrations(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/integrations`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}` }
      });
      const data = await res.json();
      if (res.ok) {
        const listCountries = data.countries || [];
        const listIntegrations = data.integrations || [];
        setAllCountriesForSelect(listCountries);
        setIntegrations(listIntegrations);
        const maxPages = Math.max(1, Math.ceil(listIntegrations.length / integrationsPerPage));
        setIntegrationPage((prev) => Math.min(prev, maxPages));
        if (!selectedCountryId && listCountries.length > 0) {
          setSelectedCountryId(String(listCountries[0].id));
        }
      }
    } catch (error) {
      console.error('Error al cargar integraciones:', error);
    } finally {
      setLoadingIntegrations(false);
    }
  };

  const fetchRecentPasses = async (
    pageToLoad = passPage,
    searchToLoad = passSearch,
    statusToLoad = passStatusFilter,
    limitToLoad = passesPerPage
  ) => {
    setLoadingPasses(true);
    try {
      const queryStatus = statusToLoad === 'expired' ? 'all' : statusToLoad;
      const params = new URLSearchParams({
        page: String(pageToLoad),
        limit: String(statusToLoad === 'expired' ? 50 : limitToLoad),
        status: queryStatus,
        search: searchToLoad
      });
      const res = await fetch(`${API_BASE}/api/v1/external/passes?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}` }
      });
      const data = await res.json();
      if (res.ok) {
        const rawList = data.passes || [];
        if (statusToLoad === 'expired') {
          const onlyExpired = rawList.filter(
            (item) => getPassEffectiveStatus(item).key === 'expired'
          );
          setRecentPasses(onlyExpired);
          setPassTotalCount(onlyExpired.length);
          setPassTotalPages(1);
          setPassPage(1);
        } else {
          setRecentPasses(rawList);
          setPassTotalCount(data.total ?? rawList.length);
          setPassTotalPages(data.totalPages ?? 1);
          setPassPage(data.page ?? pageToLoad);
        }
      }
    } catch (error) {
      console.error('Error al cargar pases recientes:', error);
    } finally {
      setLoadingPasses(false);
    }
  };

  const fetchAuditOverview = async (
    outcomeToLoad = auditOutcomeFilter,
    searchToLoad = auditSearch,
    pageToLoad = auditPage,
    limitToLoad = auditPerPage
  ) => {
    setLoadingAudit(true);
    try {
      const params = new URLSearchParams({
        outcome: outcomeToLoad,
        search: searchToLoad,
        page: String(pageToLoad),
        limit: String(limitToLoad)
      });
      const res = await fetch(`${API_BASE}/api/v1/external/audit?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}` }
      });
      const data = await res.json();
      if (res.ok) {
        setAccessSummary(data.access_summary || {
          total_attempts: 0,
          authorized_count: 0,
          denied_count: 0
        });
        setAccessLogs(data.access_logs || []);
        const pagination = data.access_pagination || {};
        setAuditTotalCount(pagination.total ?? (data.access_logs || []).length);
        setAuditTotalPages(pagination.totalPages ?? 1);
        setAuditPage(pagination.page ?? pageToLoad);

        setFinancialSummary(data.financial_summary || {
          total_contracts: 0,
          pending_contracts: 0,
          completed_contracts: 0,
          total_transactions: 0,
          gross_volume: '0.00',
          platform_fees: '0.00',
          provider_payouts: '0.00'
        });
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Error al cargar auditoría:', error);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    fetchSystemHealth();
    fetchCountries(1, '', 'all', countriesPerPage);
    fetchIntegrations();
    fetchRecentPasses(1, '', 'all', passesPerPage);
    fetchAuditOverview('all', '', 1, auditPerPage);
  }, []);

  useEffect(() => {
    setEditingCountryId(null);
    fetchCountries(countryPage, countrySearch, countryStatusFilter, countriesPerPage);
  }, [countryPage, countryStatusFilter, countriesPerPage]);

  useEffect(() => {
    fetchRecentPasses(passPage, passSearch, passStatusFilter, passesPerPage);
  }, [passPage, passStatusFilter, passesPerPage]);

  useEffect(() => {
    fetchAuditOverview(auditOutcomeFilter, auditSearch, auditPage, auditPerPage);
  }, [auditOutcomeFilter, auditPage, auditPerPage]);

  const handleCountrySearchSubmit = (e) => {
    e.preventDefault();
    setEditingCountryId(null);
    if (countryPage === 1) {
      fetchCountries(1, countrySearch, countryStatusFilter, countriesPerPage);
    } else {
      setCountryPage(1);
    }
  };

  const handlePassSearchSubmit = (e) => {
    e.preventDefault();
    if (passPage === 1) {
      fetchRecentPasses(1, passSearch, passStatusFilter, passesPerPage);
    } else {
      setPassPage(1);
    }
  };

  const handleAuditSearchSubmit = (e) => {
    e.preventDefault();
    if (auditPage === 1) {
      fetchAuditOverview(auditOutcomeFilter, auditSearch, 1, auditPerPage);
    } else {
      setAuditPage(1);
    }
  };

  const handleCreateCountry = async (e) => {
    e.preventDefault();
    setCountryFeedback({ type: '', message: '' });
    if (!newCountryForm.name.trim()) {
      setCountryFeedback({ type: 'error', message: 'Ingresá el nombre de la comunidad / barrio.' });
      return;
    }

    setCreatingCountry(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/countries`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: newCountryForm.name.trim(),
          address: newCountryForm.address.trim() || null,
          postal_code: newCountryForm.postal_code.trim() || null,
          locality: newCountryForm.locality.trim() || null,
          province: newCountryForm.province.trim() || null,
          is_active: Boolean(newCountryForm.is_active)
        })
      });
      const data = await res.json();
      if (res.ok) {
        setNewCountryForm({
          name: '',
          address: '',
          postal_code: '',
          locality: '',
          province: '',
          is_active: true
        });
        setCountryFeedback({ type: 'success', message: data.message || 'Comunidad creada.' });
        setCountryPage(1);
        await Promise.all([
          fetchCountries(1, countrySearch, countryStatusFilter, countriesPerPage),
          fetchIntegrations(),
          fetchSystemHealth()
        ]);
      } else {
        setCountryFeedback({ type: 'error', message: data.error || 'No se pudo crear la comunidad.' });
      }
    } catch (error) {
      setCountryFeedback({ type: 'error', message: 'Error de red al crear la comunidad.' });
    } finally {
      setCreatingCountry(false);
    }
  };

  const startEditingCountry = (country) => {
    setCountryFeedback({ type: '', message: '' });
    setEditingCountryId(country.id);
    setEditCountryForm({
      name: country.name || '',
      address: country.address || '',
      postal_code: country.postal_code || '',
      locality: country.locality || '',
      province: country.province || '',
      is_active: Boolean(country.is_active)
    });
  };

  const cancelEditingCountry = () => {
    setEditingCountryId(null);
    setEditCountryForm({
      name: '',
      address: '',
      postal_code: '',
      locality: '',
      province: '',
      is_active: true
    });
  };

  const handleSaveCountryEdit = async (id) => {
    setCountryFeedback({ type: '', message: '' });
    if (!editCountryForm.name.trim()) {
      setCountryFeedback({ type: 'error', message: 'El nombre de la comunidad / barrio es obligatorio.' });
      return;
    }
    setSavingCountryId(id);
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/countries/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: editCountryForm.name.trim(),
          address: editCountryForm.address.trim() || null,
          postal_code: editCountryForm.postal_code.trim() || null,
          locality: editCountryForm.locality.trim() || null,
          province: editCountryForm.province.trim() || null,
          is_active: Boolean(editCountryForm.is_active)
        })
      });
      const data = await res.json();
      if (res.ok) {
        setCountryFeedback({ type: 'success', message: data.message || 'Comunidad actualizada.' });
        setEditingCountryId(null);
        await Promise.all([
          fetchCountries(countryPage, countrySearch, countryStatusFilter, countriesPerPage),
          fetchIntegrations(),
          fetchRecentPasses(passPage, passSearch, passStatusFilter, passesPerPage),
          fetchSystemHealth()
        ]);
      } else {
        setCountryFeedback({ type: 'error', message: data.error || 'No se pudo actualizar.' });
      }
    } catch (error) {
      setCountryFeedback({ type: 'error', message: 'Error de red al actualizar la comunidad.' });
    } finally {
      setSavingCountryId(null);
    }
  };

  const handleToggleCountry = async (id) => {
    setCountryFeedback({ type: '', message: '' });
    setTogglingCountryId(id);
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/countries/${id}/toggle`, {
        method: 'PATCH',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setCountryFeedback({ type: 'success', message: data.message || 'Estado actualizado.' });
        await Promise.all([
          fetchCountries(countryPage, countrySearch, countryStatusFilter, countriesPerPage),
          fetchIntegrations(),
          fetchSystemHealth()
        ]);
      } else {
        setCountryFeedback({ type: 'error', message: data.error || 'No se pudo cambiar el estado.' });
      }
    } catch (error) {
      setCountryFeedback({ type: 'error', message: 'Error de red al cambiar estado.' });
    } finally {
      setTogglingCountryId(null);
    }
  };

  const handleCreateIntegration = async (e) => {
    e.preventDefault();
    setIntegrationFeedback({ type: '', message: '' });
    setFreshSecretKey(null);
    if (!selectedCountryId) {
      setIntegrationFeedback({ type: 'error', message: 'Seleccioná una comunidad.' });
      return;
    }

    setCreatingIntegration(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/integrations`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          country_id: Number(selectedCountryId),
          label: integrationLabel.trim() || 'Garita Principal'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setFreshSecretKey({
          key: data.plain_api_key,
          label: `${data.integration?.country_name || ''} — ${data.integration?.label || ''}`
        });
        setTestApiKey(data.plain_api_key);
        setSandboxKeyMeta(`${data.integration?.country_name || ''} (${data.integration?.masked_key || ''})`);
        setAuthMode('api_key');
        setIntegrationFeedback({ type: 'success', message: data.message || 'Clave generada.' });
        setIntegrationPage(1);
        await Promise.all([fetchIntegrations(), fetchSystemHealth()]);
      } else {
        setIntegrationFeedback({ type: 'error', message: data.error || 'No se pudo generar la clave.' });
      }
    } catch (error) {
      setIntegrationFeedback({ type: 'error', message: 'Error de red al generar la clave.' });
    } finally {
      setCreatingIntegration(false);
    }
  };

  const handleRotateIntegration = async (id) => {
    setIntegrationFeedback({ type: '', message: '' });
    setFreshSecretKey(null);
    setBusyIntegrationId(id);
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/integrations/${id}/rotate`, {
        method: 'PATCH',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setFreshSecretKey({
          key: data.plain_api_key,
          label: `${data.integration?.country_name || ''} — ${data.integration?.label || ''}`
        });
        setTestApiKey(data.plain_api_key);
        setSandboxKeyMeta(`${data.integration?.country_name || ''} (${data.integration?.masked_key || ''})`);
        setAuthMode('api_key');
        setIntegrationFeedback({ type: 'success', message: data.message || 'Clave rotada.' });
        await Promise.all([fetchIntegrations(), fetchSystemHealth()]);
      } else {
        setIntegrationFeedback({ type: 'error', message: data.error || 'No se pudo rotar la clave.' });
      }
    } catch (error) {
      setIntegrationFeedback({ type: 'error', message: 'Error de red al rotar la clave.' });
    } finally {
      setBusyIntegrationId(null);
    }
  };

  const handleToggleIntegration = async (id) => {
    setIntegrationFeedback({ type: '', message: '' });
    setBusyIntegrationId(id);
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/integrations/${id}/toggle`, {
        method: 'PATCH',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setIntegrationFeedback({ type: 'success', message: data.message || 'Estado de integración actualizado.' });
        await Promise.all([fetchIntegrations(), fetchSystemHealth()]);
      } else {
        setIntegrationFeedback({ type: 'error', message: data.error || 'No se pudo cambiar el estado.' });
      }
    } catch (error) {
      setIntegrationFeedback({ type: 'error', message: 'Error de red al actualizar la integración.' });
    } finally {
      setBusyIntegrationId(null);
    }
  };

  const handleCopyIntegrationKey = async (integrationId, rawKey, metaLabel = '') => {
    if (!rawKey) return;
    try {
      await navigator.clipboard.writeText(rawKey);
      setCopiedIntegrationId(integrationId);
      setTestApiKey(rawKey);
      setSandboxKeyMeta(metaLabel);
      setAuthMode('api_key');
      setTimeout(() => setCopiedIntegrationId(null), 2000);
    } catch {
      setIntegrationFeedback({ type: 'error', message: 'No se pudo copiar la clave al portapapeles.' });
    }
  };

  const handleCopySecretKey = async () => {
    if (!freshSecretKey?.key) return;
    try {
      await navigator.clipboard.writeText(freshSecretKey.key);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } catch {
      setIntegrationFeedback({ type: 'error', message: 'No se pudo copiar la clave al portapapeles.' });
    }
  };

  const handleCopyPassForSandbox = async (passItem) => {
    const token = passItem?.qr_token || '';
    const matchingIntegration = integrations.find(
      (intg) => Number(intg.country_id) === Number(passItem?.country_id) && intg.is_active
    );

    setTestQrToken(token);
    setAuthMode('api_key');

    if (matchingIntegration?.api_key) {
      setTestApiKey(matchingIntegration.api_key);
      setSandboxKeyMeta(
        `${matchingIntegration.country_name} · ${matchingIntegration.masked_key}`
      );
      setPassActionMsg({
        type: 'success',
        text: `Token #${passItem.id} copiado al portapapeles y Sandbox con clave activa de ${matchingIntegration.country_name} (${matchingIntegration.masked_key}).`
      });
    } else {
      setSandboxKeyMeta(
        passItem?.country_name
          ? `${passItem.country_name} (sin clave activa en tabla; usando clave actual)`
          : ''
      );
      setPassActionMsg({
        type: 'success',
        text: `Token #${passItem.id} copiado al portapapeles y Sandbox.`
      });
    }

    try {
      await navigator.clipboard.writeText(token);
      setCopiedTokenId(passItem.id);
      setTimeout(() => setCopiedTokenId(null), 1800);
    } catch {
      setPassActionMsg({ type: 'error', text: 'Se cargó en el Sandbox, pero no se pudo copiar al portapapeles.' });
    }
  };

  const handleCancelPass = async (passId) => {
    setPassActionMsg({ type: '', text: '' });
    setCancellingPassId(passId);
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/passes/${passId}/cancel`, {
        method: 'PATCH',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setPassActionMsg({ type: 'success', text: `Pase #${passId} cancelado.` });
        await Promise.all([
          fetchRecentPasses(passPage, passSearch, passStatusFilter, passesPerPage),
          fetchSystemHealth()
        ]);
      } else {
        setPassActionMsg({ type: 'error', text: data.error || 'No se pudo cancelar el pase.' });
      }
    } catch {
      setPassActionMsg({ type: 'error', text: 'Error de red al cancelar el pase.' });
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
      const headers = { 'Content-Type': 'application/json' };
      if (authMode === 'api_key') {
        if (testApiKey.trim()) headers['x-api-key'] = testApiKey.trim();
      } else {
        const token = localStorage.getItem('trustlink_token') || '';
        if (token) headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}/api/v1/external/passes/verify`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ qr_token: testQrToken.trim() })
      });
      const elapsed = Math.round(performance.now() - startedAt);
      const body = await res.json();
      setSandboxResponse({ status: res.status, ok: res.ok, latencyMs: elapsed, body });
      await Promise.all([
        fetchIntegrations(),
        fetchAuditOverview(auditOutcomeFilter, auditSearch, 1, auditPerPage)
      ]);
    } catch (error) {
      setSandboxResponse({
        status: 0,
        ok: false,
        latencyMs: Math.round(performance.now() - startedAt),
        body: { error: 'Error de conexión con el servidor backend.' }
      });
      await fetchAuditOverview(auditOutcomeFilter, auditSearch, 1, auditPerPage);
    } finally {
      setTestingEndpoint(false);
    }
  };

  const integrationTotalPages = Math.max(1, Math.ceil(integrations.length / integrationsPerPage));
  const paginatedIntegrations = integrations.slice(
    (integrationPage - 1) * integrationsPerPage,
    integrationPage * integrationsPerPage
  );

  const metrics = diagnosticsData?.metrics || {};
  const isHealthy = healthData?.ok && diagnosticsData?.ok && diagnosticsData?.database?.connected;

  return (
    <div className="max-w-6xl mx-auto p-6 sm:p-8 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl my-6 space-y-8">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <Activity size={26} />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              Salud del Sistema & API Externa
            </h2>
            <p className="text-xs text-slate-400">
              Diagnóstico en tiempo real, gobernanza de comunidades, claves por barrio, auditoría y sandbox
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            fetchSystemHealth();
            fetchCountries(countryPage, countrySearch, countryStatusFilter, countriesPerPage);
            fetchIntegrations();
            fetchRecentPasses(passPage, passSearch, passStatusFilter, passesPerPage);
            fetchAuditOverview(auditOutcomeFilter, auditSearch, auditPage, auditPerPage);
          }}
          disabled={loadingStatus}
          className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 px-4 py-2 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loadingStatus ? 'animate-spin' : ''} />
          Refrescar Todo
        </button>
      </div>

      {/* Resumen Ejecutivo de Gobernanza */}
      <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Resumen Ejecutivo de Gobernanza
            </p>
            <h3 className="text-base font-black text-white mt-0.5">
              Operación Central TrustLink
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl">
              <span className="text-slate-400">Prestadores aprobados: </span>
              <strong className="text-emerald-400">{metrics.approved_providers ?? 0}</strong>
            </div>
            <div className="bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl">
              <span className="text-slate-400">Comunidades activas: </span>
              <strong className="text-sky-400">{metrics.active_countries ?? 0}</strong>
            </div>
            <div className="bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl">
              <span className="text-slate-400">Claves activas: </span>
              <strong className="text-indigo-400">{metrics.active_integrations ?? 0}</strong>
            </div>
            <div className="bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl">
              <span className="text-slate-400">Pases emitidos: </span>
              <strong className="text-white">{metrics.total_passes ?? 0}</strong>
            </div>
          </div>

          {typeof onNavigate === 'function' && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <ShieldCheck size={14} /> Ops TrustLink <ArrowUpRight size={13} />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('users_master')}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Users size={14} /> Modo Maestro <ArrowUpRight size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      {statusError && (
        <div className="bg-rose-950/50 border border-rose-800 text-rose-200 p-4 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-400 shrink-0" />
          <span>{statusError}</span>
        </div>
      )}

      {/* Tarjetas de Estado */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Server size={14} className="text-emerald-400" /> Backend API
            </span>
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
              isHealthy
                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                : 'bg-rose-950 text-rose-300 border-rose-800'
            }`}>
              {loadingStatus ? 'VERIFICANDO...' : isHealthy ? 'HEALTHY' : 'DEGRADED'}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Latencia HTTP: <strong className="text-white">{httpLatencyMs !== null ? `${httpLatencyMs} ms` : '—'}</strong>
          </p>
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <Clock size={12} /> Uptime: <strong className="text-white">{diagnosticsData?.uptime_seconds ?? 0}s</strong>
          </p>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Database size={14} className="text-sky-400" /> PostgreSQL
            </span>
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
              diagnosticsData?.database?.connected
                ? 'bg-sky-950 text-sky-300 border-sky-800'
                : 'bg-rose-950 text-rose-300 border-rose-800'
            }`}>
              {diagnosticsData?.database?.connected ? 'CONECTADA' : 'SIN CONEXIÓN'}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Latencia DB: <strong className="text-white">{diagnosticsData?.database?.latency_ms !== undefined ? `${diagnosticsData.database.latency_ms} ms` : '—'}</strong>
          </p>
          <p className="text-xs text-slate-400 truncate">
            Hora DB: <strong className="text-slate-300">{diagnosticsData?.database?.db_time || '—'}</strong>
          </p>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <KeyRound size={14} className="text-amber-400" /> Integración Externa
            </span>
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
              diagnosticsData?.external_endpoint?.api_key_configured
                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                : 'bg-amber-950 text-amber-300 border-amber-800'
            }`}>
              {diagnosticsData?.external_endpoint?.api_key_configured ? 'CONFIGURADA' : 'PENDIENTE'}
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono truncate">
            POST /api/v1/external/passes/verify
          </p>
          <p className="text-xs text-slate-400">
            Claves por comunidad activas: <strong className="text-white">{metrics.active_integrations ?? 0}</strong>
          </p>
        </div>
      </div>

      {/* Integraciones y Claves API por Comunidad */}
      <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-5">
        <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <KeyRound size={18} className="text-amber-400" />
              Integraciones y Claves API por Comunidad
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Generá, copiá, rotá o revocá claves <code className="text-slate-300">x-api-key</code> por barrio privado sin editar archivos <code className="text-slate-300">.env</code>.
            </p>
          </div>
          <span className="text-xs text-slate-400">
            Total claves: <strong className="text-white">{integrations.length}</strong>
          </span>
        </div>

        <form onSubmit={handleCreateIntegration} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Comunidad / Barrio
            </label>
            <select
              value={selectedCountryId}
              onChange={(e) => setSelectedCountryId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              {allCountriesForSelect.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.id} — {c.name} {!c.is_active ? '(Inactiva)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-4">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Etiqueta / Punto de Acceso
            </label>
            <input
              type="text"
              value={integrationLabel}
              onChange={(e) => setIntegrationLabel(e.target.value)}
              placeholder="Ej. Garita Acceso Principal"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="md:col-span-3 flex items-end">
            <button
              type="submit"
              disabled={creatingIntegration || allCountriesForSelect.length === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} /> {creatingIntegration ? 'Generando...' : 'Generar API Key'}
            </button>
          </div>
        </form>

        {integrationFeedback.message && (
          <div className={`p-3.5 rounded-xl text-xs border flex items-center gap-2 ${
            integrationFeedback.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/50 border-rose-800 text-rose-200'
          }`}>
            {integrationFeedback.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            <span>{integrationFeedback.message}</span>
          </div>
        )}

        {freshSecretKey && (
          <div className="bg-amber-950/30 border border-amber-700/60 p-4 rounded-xl space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-xs font-bold text-amber-300">
                Clave generada para {freshSecretKey.label} (copiala ahora, se cargó también en el Sandbox):
              </p>
              <button
                type="button"
                onClick={handleCopySecretKey}
                className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer self-start"
              >
                {copiedSecret ? <Check size={13} /> : <Copy size={13} />}
                {copiedSecret ? 'Copiada' : 'Copiar Clave'}
              </button>
            </div>
            <pre className="bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-xs font-mono text-amber-200 overflow-x-auto">
              {freshSecretKey.key}
            </pre>
          </div>
        )}

        {loadingIntegrations ? (
          <p className="text-xs text-slate-400 py-4">Cargando integraciones...</p>
        ) : integrations.length === 0 ? (
          <p className="text-xs text-slate-400 py-4">
            Aún no hay claves por comunidad creadas. Podés generar una arriba o usar la clave de entorno.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                    <th className="py-2.5 px-3">Comunidad</th>
                    <th className="py-2.5 px-3">Etiqueta</th>
                    <th className="py-2.5 px-3">Clave (Enmascarada)</th>
                    <th className="py-2.5 px-3">Último Uso</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {paginatedIntegrations.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-900/40">
                      <td className="py-3 px-3 font-bold text-white">
                        #{item.country_id} · {item.country_name}
                      </td>
                      <td className="py-3 px-3 text-slate-300">{item.label}</td>
                      <td className="py-3 px-3 font-mono text-slate-300">{item.masked_key}</td>
                      <td className="py-3 px-3 text-slate-400">
                        {item.last_used_at ? new Date(item.last_used_at).toLocaleString() : 'Sin uso aún'}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          item.is_active
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {item.is_active ? 'Activa' : 'Revocada'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyIntegrationKey(
                                item.id,
                                item.api_key,
                                `${item.country_name} · ${item.masked_key}`
                              )
                            }
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            title="Copiar clave API y cargarla en el Sandbox"
                          >
                            {copiedIntegrationId === item.id ? <Check size={12} /> : <Copy size={12} />}
                            {copiedIntegrationId === item.id ? 'Copiada' : 'Copiar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRotateIntegration(item.id)}
                            disabled={busyIntegrationId === item.id}
                            className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            title="Rotar / regenerar clave"
                          >
                            <RotateCw size={12} /> Rotar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleIntegration(item.id)}
                            disabled={busyIntegrationId === item.id}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 border ${
                              item.is_active
                                ? 'bg-rose-950/60 hover:bg-rose-900/60 text-rose-200 border-rose-800'
                                : 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-200 border-emerald-800'
                            }`}
                          >
                            <Power size={12} /> {item.is_active ? 'Revocar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <span>
                  Página <strong className="text-white">{integrationPage}</strong> de{' '}
                  <strong className="text-white">{integrationTotalPages}</strong>
                </span>
                <label className="inline-flex items-center gap-1.5">
                  <span>Por página:</span>
                  <select
                    value={integrationsPerPage}
                    onChange={(e) => {
                      setIntegrationsPerPage(Number(e.target.value));
                      setIntegrationPage(1);
                    }}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200"
                  >
                    <option value={4}>4</option>
                    <option value={6}>6</option>
                    <option value={10}>10</option>
                  </select>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={integrationPage <= 1}
                  onClick={() => setIntegrationPage((p) => Math.max(p - 1, 1))}
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={integrationPage >= integrationTotalPages}
                  onClick={() => setIntegrationPage((p) => Math.min(p + 1, integrationTotalPages))}
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Gestión de Comunidades / Barrios Privados */}
      <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-5">
        <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Building2 size={18} className="text-sky-400" />
              Gestión de Comunidades / Barrios Privados
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Alta y modificación de datos de comunidad/barrio: Nombre, Dirección, Código Postal, Localidad, Provincia y Estado.
            </p>
          </div>
          <span className="text-xs text-slate-400">
            Total filtradas: <strong className="text-white">{countryTotalCount}</strong>
          </span>
        </div>

        <form onSubmit={handleCreateCountry} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-4">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Nombre Comunidad / Barrio *
            </label>
            <input
              type="text"
              value={newCountryForm.name}
              onChange={(e) => setNewCountryForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Ej. Barrio Las Lomas"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="lg:col-span-4">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Dirección
            </label>
            <input
              type="text"
              value={newCountryForm.address}
              onChange={(e) => setNewCountryForm((prev) => ({ ...prev, address: e.target.value }))}
              placeholder="Ej. Ruta 58 Km 12.5"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Código Postal
            </label>
            <input
              type="text"
              value={newCountryForm.postal_code}
              onChange={(e) => setNewCountryForm((prev) => ({ ...prev, postal_code: e.target.value }))}
              placeholder="Ej. B1814"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Estado
            </label>
            <select
              value={newCountryForm.is_active ? 'true' : 'false'}
              onChange={(e) => setNewCountryForm((prev) => ({ ...prev, is_active: e.target.value === 'true' }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="true">Activa</option>
              <option value="false">Inactiva</option>
            </select>
          </div>
          <div className="lg:col-span-5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Localidad
            </label>
            <input
              type="text"
              value={newCountryForm.locality}
              onChange={(e) => setNewCountryForm((prev) => ({ ...prev, locality: e.target.value }))}
              placeholder="Ej. Canning / Ezeiza"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="lg:col-span-4">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Provincia
            </label>
            <input
              type="text"
              value={newCountryForm.province}
              onChange={(e) => setNewCountryForm((prev) => ({ ...prev, province: e.target.value }))}
              placeholder="Ej. Buenos Aires"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="lg:col-span-3 flex items-end">
            <button
              type="submit"
              disabled={creatingCountry}
              className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} /> {creatingCountry ? 'Guardando...' : 'Agregar Comunidad'}
            </button>
          </div>
        </form>

        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleCountrySearchSubmit} className="flex-1 flex gap-2">
            <input
              type="text"
              value={countrySearch}
              onChange={(e) => setCountrySearch(e.target.value)}
              placeholder="Buscar por ID, nombre, dirección, CP, localidad o provincia..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
            />
            <button
              type="submit"
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-bold border border-slate-700 cursor-pointer"
            >
              Buscar
            </button>
          </form>
          <select
            value={countryStatusFilter}
            onChange={(e) => {
              setCountryStatusFilter(e.target.value);
              setCountryPage(1);
            }}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200"
          >
            <option value="all">Todas</option>
            <option value="active">Activas</option>
            <option value="inactive">Inactivas</option>
          </select>
        </div>

        {countryFeedback.message && (
          <div className={`p-3.5 rounded-xl text-xs border flex items-center gap-2 ${
            countryFeedback.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/50 border-rose-800 text-rose-200'
          }`}>
            {countryFeedback.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            <span>{countryFeedback.message}</span>
          </div>
        )}

        {loadingCountries ? (
          <p className="text-xs text-slate-400 py-4">Cargando comunidades...</p>
        ) : countries.length === 0 ? (
          <p className="text-xs text-slate-400 py-4">No se encontraron comunidades con los filtros actuales.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                    <th className="py-2.5 px-3">ID</th>
                    <th className="py-2.5 px-3">Nombre Comunidad / Barrio</th>
                    <th className="py-2.5 px-3">Dirección & CP</th>
                    <th className="py-2.5 px-3">Localidad & Provincia</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {countries.map((c) => {
                    const isEditing = editingCountryId === c.id;
                    return (
                      <React.Fragment key={c.id}>
                        <tr className="hover:bg-slate-900/40">
                          <td className="py-3 px-3 font-mono text-slate-400">#{c.id}</td>
                          <td className="py-3 px-3 font-bold text-white">{c.name}</td>
                          <td className="py-3 px-3 text-slate-300">
                            <span className="block">{c.address || c.location || '—'}</span>
                            {c.postal_code && (
                              <span className="text-[11px] text-slate-400 font-mono">CP: {c.postal_code}</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-300">
                            <span className="block">{c.locality || '—'}</span>
                            <span className="text-[11px] text-slate-400">{c.province || ''}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                              c.is_active
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}>
                              {c.is_active ? 'Activa' : 'Inactiva'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => (isEditing ? cancelEditingCountry() : startEditingCountry(c))}
                                className="bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Pencil size={12} /> {isEditing ? 'Cerrar' : 'Editar'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleCountry(c.id)}
                                disabled={togglingCountryId === c.id}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer border ${
                                  c.is_active
                                    ? 'bg-rose-950/60 hover:bg-rose-900/60 text-rose-200 border-rose-800'
                                    : 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-200 border-emerald-800'
                                }`}
                              >
                                <Power size={12} /> {c.is_active ? 'Desactivar' : 'Activar'}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isEditing && (
                          <tr className="bg-slate-900/80">
                            <td colSpan={6} className="p-4 border-t border-slate-800">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
                                <div className="lg:col-span-4">
                                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                    Nombre Comunidad / Barrio *
                                  </label>
                                  <input
                                    type="text"
                                    value={editCountryForm.name}
                                    onChange={(e) => setEditCountryForm((prev) => ({ ...prev, name: e.target.value }))}
                                    className="w-full bg-slate-950 border border-sky-500 rounded-lg px-3 py-1.5 text-xs text-white"
                                  />
                                </div>
                                <div className="lg:col-span-4">
                                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                    Dirección
                                  </label>
                                  <input
                                    type="text"
                                    value={editCountryForm.address}
                                    onChange={(e) => setEditCountryForm((prev) => ({ ...prev, address: e.target.value }))}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                                  />
                                </div>
                                <div className="lg:col-span-2">
                                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                    Código Postal
                                  </label>
                                  <input
                                    type="text"
                                    value={editCountryForm.postal_code}
                                    onChange={(e) => setEditCountryForm((prev) => ({ ...prev, postal_code: e.target.value }))}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                                  />
                                </div>
                                <div className="lg:col-span-2">
                                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                    Estado
                                  </label>
                                  <select
                                    value={editCountryForm.is_active ? 'true' : 'false'}
                                    onChange={(e) => setEditCountryForm((prev) => ({ ...prev, is_active: e.target.value === 'true' }))}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                  >
                                    <option value="true">Activa</option>
                                    <option value="false">Inactiva</option>
                                  </select>
                                </div>
                                <div className="lg:col-span-4">
                                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                    Localidad
                                  </label>
                                  <input
                                    type="text"
                                    value={editCountryForm.locality}
                                    onChange={(e) => setEditCountryForm((prev) => ({ ...prev, locality: e.target.value }))}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                                  />
                                </div>
                                <div className="lg:col-span-4">
                                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                    Provincia
                                  </label>
                                  <input
                                    type="text"
                                    value={editCountryForm.province}
                                    onChange={(e) => setEditCountryForm((prev) => ({ ...prev, province: e.target.value }))}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                                  />
                                </div>
                                <div className="lg:col-span-4 flex items-end justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveCountryEdit(c.id)}
                                    disabled={savingCountryId === c.id}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Check size={13} /> {savingCountryId === c.id ? 'Guardando...' : 'Guardar Cambios'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEditingCountry}
                                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <span>
                  Página <strong className="text-white">{countryPage}</strong> de{' '}
                  <strong className="text-white">{countryTotalPages}</strong>
                </span>
                <label className="inline-flex items-center gap-1.5">
                  <span>Por página:</span>
                  <select
                    value={countriesPerPage}
                    onChange={(e) => {
                      setCountriesPerPage(Number(e.target.value));
                      setCountryPage(1);
                    }}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200"
                  >
                    <option value={4}>4</option>
                    <option value={6}>6</option>
                    <option value={10}>10</option>
                  </select>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={countryPage <= 1}
                  onClick={() => setCountryPage((p) => Math.max(p - 1, 1))}
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={countryPage >= countryTotalPages}
                  onClick={() => setCountryPage((p) => Math.min(p + 1, countryTotalPages))}
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Pases QR Recientes */}
      <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-2">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <QrCode size={18} className="text-indigo-400" />
              Pases QR Recientes
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Al presionar Copiar se copia el token al portapapeles y al Sandbox junto con la clave activa de su comunidad.
            </p>
          </div>
          <span className="text-xs text-slate-400">
            Total filtrados: <strong className="text-white">{passTotalCount}</strong>
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={handlePassSearchSubmit} className="flex-1 flex gap-2">
            <input
              type="text"
              value={passSearch}
              onChange={(e) => setPassSearch(e.target.value)}
              placeholder="Buscar por ID, comunidad, prestador, fracción o lote..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-bold border border-slate-700 cursor-pointer"
            >
              Buscar
            </button>
          </form>
          <select
            value={passStatusFilter}
            onChange={(e) => {
              setPassStatusFilter(e.target.value);
              setPassPage(1);
            }}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200"
          >
            <option value="all">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="used">Usados</option>
            <option value="expired">Vencidos</option>
            <option value="cancelled">Cancelados</option>
          </select>
        </div>

        {passActionMsg.text && (
          <div className={`p-3 rounded-xl text-xs border ${
            passActionMsg.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/50 border-rose-800 text-rose-200'
          }`}>
            {passActionMsg.text}
          </div>
        )}

        {loadingPasses ? (
          <p className="text-xs text-slate-400 py-3">Cargando pases recientes...</p>
        ) : recentPasses.length === 0 ? (
          <p className="text-xs text-slate-400 py-3">No hay pases QR registrados para los filtros aplicados.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                    <th className="py-2.5 px-3">ID</th>
                    <th className="py-2.5 px-3">Comunidad / Barrio</th>
                    <th className="py-2.5 px-3">Prestador</th>
                    <th className="py-2.5 px-3">Destino</th>
                    <th className="py-2.5 px-3">Vigencia (Ingreso / Salida)</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3">Token</th>
                    <th className="py-2.5 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {recentPasses.map((p) => {
                    const effectiveStatus = getPassEffectiveStatus(p);
                    return (
                      <tr key={p.id} className="hover:bg-slate-900/40">
                        <td className="py-2.5 px-3 font-mono text-slate-400">#{p.id}</td>
                        <td className="py-2.5 px-3 font-bold text-sky-300">
                          {p.country_name || (p.country_id ? `Comunidad #${p.country_id}` : '—')}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-white">
                          {`${p.provider_first_name || ''} ${p.provider_last_name || ''}`.trim() || '—'}
                          {p.provider_specialty && (
                            <span className="block text-[11px] font-normal text-slate-400">
                              {p.provider_specialty}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {[p.fraction_number, p.lot_number].filter(Boolean).join(' / ') || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 text-[11px] leading-relaxed">
                          <span className="block">
                            <strong className="text-emerald-400 font-semibold">In:</strong> {formatDateTimeShort(p.start_time)}
                          </span>
                          <span className="block">
                            <strong className="text-amber-300 font-semibold">Out:</strong> {formatDateTimeShort(p.end_time)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border ${effectiveStatus.badgeClass}`}>
                            {effectiveStatus.label}
                          </span>
                          {effectiveStatus.sublabel && (
                            <span className="block text-[10px] text-slate-400 mt-0.5">
                              {effectiveStatus.sublabel}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">
                          {p.qr_token ? `${p.qr_token.slice(0, 12)}...` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleCopyPassForSandbox(p)}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              title="Copiar token al portapapeles y cargar en Sandbox con la clave de su comunidad"
                            >
                              {copiedTokenId === p.id ? <Check size={12} /> : <Copy size={12} />}
                              {copiedTokenId === p.id ? 'Copiado' : 'Copiar'}
                            </button>
                            {p.status !== 'cancelled' && effectiveStatus.key !== 'expired' && (
                              <button
                                type="button"
                                onClick={() => handleCancelPass(p.id)}
                                disabled={cancellingPassId === p.id}
                                className="bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-800 px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <Ban size={12} /> Cancelar
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

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <span>
                  Página <strong className="text-white">{passPage}</strong> de{' '}
                  <strong className="text-white">{passTotalPages}</strong>
                </span>
                <label className="inline-flex items-center gap-1.5">
                  <span>Por página:</span>
                  <select
                    value={passesPerPage}
                    onChange={(e) => {
                      setPassesPerPage(Number(e.target.value));
                      setPassPage(1);
                    }}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200"
                  >
                    <option value={4}>4</option>
                    <option value={8}>8</option>
                    <option value={15}>15</option>
                  </select>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={passPage <= 1}
                  onClick={() => setPassPage((p) => Math.max(p - 1, 1))}
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={passPage >= passTotalPages}
                  onClick={() => setPassPage((p) => Math.min(p + 1, passTotalPages))}
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Trazabilidad de Eventos / Auditoría de Accesos y Transacciones */}
      <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-3">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <ClipboardList size={18} className="text-emerald-400" />
              Trazabilidad de Eventos & Auditoría de Accesos y Transacciones
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Inspeccioná intentos de validación autorizados vs. denegados (con su código de motivo) y el resumen financiero de contratos/transacciones.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setAuditTab('access');
                setAuditPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer border ${
                auditTab === 'access'
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
              }`}
            >
              Accesos y Validaciones
            </button>
            <button
              type="button"
              onClick={() => {
                setAuditTab('transactions');
                setAuditPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer border inline-flex items-center gap-1.5 ${
                auditTab === 'transactions'
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Receipt size={13} /> Contratos y Transacciones
            </button>
          </div>
        </div>

        {auditTab === 'access' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-slate-400 block">Intentos Auditados</span>
                <strong className="text-white text-base">{accessSummary.total_attempts ?? 0}</strong>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-slate-400 block">Autorizados</span>
                <strong className="text-emerald-400 text-base">{accessSummary.authorized_count ?? 0}</strong>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-slate-400 block">Denegados</span>
                <strong className="text-rose-400 text-base">{accessSummary.denied_count ?? 0}</strong>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <form onSubmit={handleAuditSearchSubmit} className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Filtrar por código (OUT_OF_TIME_WINDOW, COUNTRY_MISMATCH...), token o comunidad..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-bold border border-slate-700 cursor-pointer"
                >
                  Filtrar
                </button>
              </form>
              <select
                value={auditOutcomeFilter}
                onChange={(e) => {
                  setAuditOutcomeFilter(e.target.value);
                  setAuditPage(1);
                }}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200"
              >
                <option value="all">Todos los resultados</option>
                <option value="authorized">Solo autorizados</option>
                <option value="denied">Solo denegados</option>
              </select>
            </div>

            {loadingAudit ? (
              <p className="text-xs text-slate-400 py-3">Cargando trazabilidad de accesos...</p>
            ) : accessLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">
                Aún no hay intentos registrados para los filtros actuales.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                        <th className="py-2.5 px-3">ID</th>
                        <th className="py-2.5 px-3">Resultado</th>
                        <th className="py-2.5 px-3">Código / Motivo</th>
                        <th className="py-2.5 px-3">Comunidad / Origen</th>
                        <th className="py-2.5 px-3">Token / Pase</th>
                        <th className="py-2.5 px-3">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {accessLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-900/40">
                          <td className="py-2.5 px-3 font-mono text-slate-400">#{log.id}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                              log.authorized
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                : 'bg-rose-950 text-rose-300 border-rose-800'
                            }`}>
                              {log.authorized ? 'AUTORIZADO' : 'DENEGADO'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono font-bold text-amber-300 block">{log.reason_code}</span>
                            <span className="text-[11px] text-slate-400">{log.message}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            <span className="block font-bold text-white">
                              {log.country_name || (log.country_id ? `Comunidad #${log.country_id}` : 'Sin comunidad')}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {log.integration_label || log.auth_mode} · HTTP {log.http_status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-400">
                            {log.pass_id ? `Pase #${log.pass_id} · ` : ''}
                            {log.qr_token ? `${log.qr_token.slice(0, 10)}...` : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                            {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-400">
                  <div className="flex items-center gap-3">
                    <span>
                      Total filtrados: <strong className="text-white">{auditTotalCount}</strong> · Página{' '}
                      <strong className="text-white">{auditPage}</strong> de{' '}
                      <strong className="text-white">{auditTotalPages}</strong>
                    </span>
                    <label className="inline-flex items-center gap-1.5">
                      <span>Por página:</span>
                      <select
                        value={auditPerPage}
                        onChange={(e) => {
                          setAuditPerPage(Number(e.target.value));
                          setAuditPage(1);
                        }}
                        className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200"
                      >
                        <option value={3}>3</option>
                        <option value={6}>6</option>
                        <option value={10}>10</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={auditPage <= 1}
                      onClick={() => setAuditPage((p) => Math.max(p - 1, 1))}
                      className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      disabled={auditPage >= auditTotalPages}
                      onClick={() => setAuditPage((p) => Math.min(p + 1, auditTotalPages))}
                      className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-slate-400 block">Contratos (Total / Pend. / Comp.)</span>
                <strong className="text-white text-sm">
                  {financialSummary.total_contracts ?? 0} / {financialSummary.pending_contracts ?? 0} / {financialSummary.completed_contracts ?? 0}
                </strong>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-slate-400 block">Volumen Bruto Transaccionado</span>
                <strong className="text-white text-sm">${financialSummary.gross_volume ?? '0.00'}</strong>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-slate-400 block">Comisión TrustLink (Take Rate)</span>
                <strong className="text-emerald-400 text-sm">${financialSummary.platform_fees ?? '0.00'}</strong>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-slate-400 block">Neto a Prestadores</span>
                <strong className="text-sky-400 text-sm">${financialSummary.provider_payouts ?? '0.00'}</strong>
              </div>
            </div>

            {loadingAudit ? (
              <p className="text-xs text-slate-400 py-3">Cargando transacciones...</p>
            ) : transactions.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">No hay transacciones registradas todavía en la tabla transactions.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                        <th className="py-2.5 px-3">ID</th>
                        <th className="py-2.5 px-3">Contrato / Prestador</th>
                        <th className="py-2.5 px-3">Monto Total</th>
                        <th className="py-2.5 px-3">Take Rate</th>
                        <th className="py-2.5 px-3">Neto Prestador</th>
                        <th className="py-2.5 px-3">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {transactions
                        .slice((auditPage - 1) * auditPerPage, auditPage * auditPerPage)
                        .map((tx) => (
                          <tr key={tx.id} className="hover:bg-slate-900/40">
                            <td className="py-2.5 px-3 font-mono text-slate-400">#{tx.id}</td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-white block">
                                Contrato #{tx.contract_id} · {`${tx.provider_first_name || ''} ${tx.provider_last_name || ''}`.trim() || 'Prestador'}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {tx.contract_description || tx.gateway_provider || '—'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-bold text-white">${tx.total_amount}</td>
                            <td className="py-2.5 px-3 font-mono text-emerald-400">${tx.platform_fee}</td>
                            <td className="py-2.5 px-3 font-mono text-sky-300">${tx.provider_payout}</td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold border bg-slate-800 text-slate-200 border-slate-700">
                                {tx.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-400">
                  <div className="flex items-center gap-3">
                    <span>
                      Total transacciones: <strong className="text-white">{transactions.length}</strong> · Página{' '}
                      <strong className="text-white">{auditPage}</strong> de{' '}
                      <strong className="text-white">
                        {Math.max(1, Math.ceil(transactions.length / auditPerPage))}
                      </strong>
                    </span>
                    <label className="inline-flex items-center gap-1.5">
                      <span>Por página:</span>
                      <select
                        value={auditPerPage}
                        onChange={(e) => {
                          setAuditPerPage(Number(e.target.value));
                          setAuditPage(1);
                        }}
                        className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200"
                      >
                        <option value={3}>3</option>
                        <option value={6}>6</option>
                        <option value={10}>10</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={auditPage <= 1}
                      onClick={() => setAuditPage((p) => Math.max(p - 1, 1))}
                      className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      disabled={auditPage >= Math.max(1, Math.ceil(transactions.length / auditPerPage))}
                      onClick={() =>
                        setAuditPage((p) =>
                          Math.min(p + 1, Math.max(1, Math.ceil(transactions.length / auditPerPage)))
                        )
                      }
                      className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Sandbox Endpoint Externo */}
      <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
        <div className="border-b border-slate-800 pb-4">
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <Terminal size={18} className="text-emerald-400" />
            Sandbox POST /api/v1/external/passes/verify
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Probá la validación externa con una clave por comunidad, clave global o sesión Bearer. Cada ejecución queda registrada en Auditoría.
          </p>
        </div>

        <form onSubmit={handleRunExternalTest} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="authMode"
                  checked={authMode === 'api_key'}
                  onChange={() => setAuthMode('api_key')}
                />
                <span>x-api-key</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="authMode"
                  checked={authMode === 'bearer'}
                  onChange={() => setAuthMode('bearer')}
                />
                <span>Bearer JWT (superadmin)</span>
              </label>
            </div>
            {sandboxKeyMeta && authMode === 'api_key' && (
              <span className="text-[11px] text-sky-300 font-mono">
                Clave vinculada: {sandboxKeyMeta}
              </span>
            )}
          </div>

          {authMode === 'api_key' && (
            <input
              type="text"
              value={testApiKey}
              onChange={(e) => setTestApiKey(e.target.value)}
              placeholder="x-api-key (ej. tl_c1_... o tl_gate_dev_key_123456)"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-white"
            />
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={testQrToken}
              onChange={(e) => setTestQrToken(e.target.value)}
              placeholder="Pegá o seleccioná un qr_token..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white"
            />
            <button
              type="submit"
              disabled={testingEndpoint || !testQrToken.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Send size={14} /> {testingEndpoint ? 'Probando...' : 'Ejecutar'}
            </button>
          </div>
        </form>

        {sandboxResponse && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-3 text-xs">
              <span className={`font-bold px-2.5 py-0.5 rounded-full border ${
                sandboxResponse.ok
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : 'bg-amber-950 text-amber-300 border-amber-800'
              }`}>
                HTTP {sandboxResponse.status}
              </span>
              <span className="text-slate-400">Latencia: {sandboxResponse.latencyMs} ms</span>
            </div>
            <pre className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs text-emerald-300 font-mono overflow-x-auto leading-relaxed">
              {JSON.stringify(sandboxResponse.body, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}