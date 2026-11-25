/**
 * @file CommunitiesAdminView.jsx
 * @description Centro unificado de administración de Comunidades / Barrios Privados para `superadmin`.
 * Reúne en dos pestañas claras todo el ciclo de vida B2B y operativo de cada comunidad:
 * 1) Barrios y Licencias B2B:
 *    - Alta, búsqueda, filtrado, edición en línea, activación/desactivación y exportación CSV de comunidades.
 *    - Gestión comercial B2B: plan (`Piloto / Esencial / Pro / Enterprise`), estado, vigencia (+30d) y cuota mensual QR.
 *    - Claves API de garita por comunidad: generación, visualización única con copia rápida, rotación y revocación.
 * 2) Operación Local:
 *    - Embebe `LocalAdminView` para gestionar suspensiones locales, alertas preventivas de vencimientos
 *      documentales con aviso por WhatsApp y vista operativa de licencia del barrio.
 * @location /trustlink-web/src/modules/admin/CommunitiesAdminView.jsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  ShieldAlert,
  RefreshCw,
  Search,
  Download,
  Plus,
  Check,
  X,
  Pencil,
  KeyRound,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Copy,
} from 'lucide-react';
import { useBranding, DEFAULT_BRANDING_CONFIG } from '../branding/BrandingContext';
import { API_BASE } from '../../config/api';
import { downloadCsv } from '../../utils/csvExport';
import LocalAdminView from './LocalAdminView';

/**
 * Devuelve la etiqueta legible y estilos Tailwind del badge según el estado comercial B2B.
 *
 * @param {string|null|undefined} billingStatus - Estado de facturación (`active`, `trial`, `grace`, `suspended`).
 * @returns {{ label: string, cls: string }} Metadatos de presentación del badge.
 */
function getB2BBillingBadge(billingStatus) {
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
}

/**
 * Panel maestro unificado de Comunidades (Barrios B2B, Claves API y Operación Local).
 *
 * @returns {JSX.Element} Vista administrativa de comunidades para `superadmin`.
 */
export default function CommunitiesAdminView() {
  const { brand } = useBranding();

  // Estilos dinámicos de marca blanca: Zona 4 (tarjetas principales) y Zona 5 (contenedores internos e inputs)
  const cardStyle = {
    backgroundColor: brand?.cardBgColor || DEFAULT_BRANDING_CONFIG.cardBgColor,
    color: brand?.cardTextColor || DEFAULT_BRANDING_CONFIG.cardTextColor,
  };

  const innerStyle = {
    backgroundColor: brand?.innerBgColor || DEFAULT_BRANDING_CONFIG.innerBgColor,
    color: brand?.innerTextColor || DEFAULT_BRANDING_CONFIG.innerTextColor,
  };

  // Pestaña activa: 'b2b' (Barrios, Licencias y Claves API) o 'local_ops' (Operación Local)
  const [activeTab, setActiveTab] = useState('b2b');

  // Estado de listado, filtros, paginación y CRUD de Comunidades (countries)
  const [countries, setCountries] = useState([]);
  const [allCountriesOptions, setAllCountriesOptions] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [countryLoadError, setCountryLoadError] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [countryStatusFilter, setCountryStatusFilter] = useState('all');
  const [countryPage, setCountryPage] = useState(1);
  const [countryPageSize, setCountryPageSize] = useState(6);
  const [countryTotalPages, setCountryTotalPages] = useState(1);
  const [countryTotalCount, setCountryTotalCount] = useState(0);

  // Formulario desplegable de alta de nueva comunidad y feedback
  const [showCreateCountryForm, setShowCreateCountryForm] = useState(false);
  const [newCountryName, setNewCountryName] = useState('');
  const [newCountryAddress, setNewCountryAddress] = useState('');
  const [newCountryPostalCode, setNewCountryPostalCode] = useState('');
  const [newCountryCity, setNewCountryCity] = useState('');
  const [newCountryProvince, setNewCountryProvince] = useState('');
  const [creatingCountry, setCreatingCountry] = useState(false);
  const [countryFeedback, setCountryFeedback] = useState(null);

  // Edición en línea de datos generales de comunidad
  const [editingCountryId, setEditingCountryId] = useState(null);
  const [editCountryName, setEditCountryName] = useState('');
  const [editCountryAddress, setEditCountryAddress] = useState('');
  const [editCountryPostalCode, setEditCountryPostalCode] = useState('');
  const [editCountryCity, setEditCountryCity] = useState('');
  const [editCountryProvince, setEditCountryProvince] = useState('');
  const [savingCountryId, setSavingCountryId] = useState(null);

  // Edición en línea de licenciamiento B2B y cuota mensual de validaciones QR
  const [b2bPlans, setB2bPlans] = useState([]);
  const [editingBillingCountryId, setEditingBillingCountryId] = useState(null);
  const [billingPlanDraft, setBillingPlanDraft] = useState('pilot');
  const [billingStatusDraft, setBillingStatusDraft] = useState('active');
  const [billingQuotaDraft, setBillingQuotaDraft] = useState('');
  const [savingBillingCountryId, setSavingBillingCountryId] = useState(null);

  // Integraciones / Claves API por comunidad (alta, rotación, revocación y copia única)
  const [integrations, setIntegrations] = useState([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);
  const [selectedCountryForKey, setSelectedCountryForKey] = useState('');
  const [newKeyLabel, setNewKeyLabel] = useState('Garita Principal');
  const [creatingKey, setCreatingKey] = useState(false);
  const [latestPlainKey, setLatestPlainKey] = useState(null);
  const [copiedPlainKey, setCopiedPlainKey] = useState(false);
  const [integrationFeedback, setIntegrationFeedback] = useState(null);
  const [integrationsPage, setIntegrationsPage] = useState(1);
  const [integrationsPageSize, setIntegrationsPageSize] = useState(6);
  const [integrationsTotalPages, setIntegrationsTotalPages] = useState(1);
  const [integrationsTotalCount, setIntegrationsTotalCount] = useState(0);

  /**
   * Genera la cabecera Bearer JWT a partir del token de sesión activo.
   *
   * @returns {{ Authorization: string }} Cabecera HTTP de autenticación.
   */
  const getAuthHeaders = useCallback(
    () => ({
      Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
    }),
    []
  );

  /**
   * Obtiene hasta 100 comunidades sin filtrar para poblar el selector de generación de claves API.
   *
   * @returns {Promise<void>}
   */
  const fetchAllCountriesForSelector = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/countries?page=1&limit=100`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const list = data.countries || [];
        setAllCountriesOptions(list);
        setSelectedCountryForKey((prev) => prev || (list[0]?.id ? String(list[0].id) : ''));
      }
    } catch (err) {
      console.error('Error al cargar opciones de comunidades:', err);
    }
  }, [getAuthHeaders]);

  /**
   * Consulta la lista paginada de comunidades aplicando búsqueda y filtro de estado.
   *
   * @param {number} [pageToLoad=1] - Página solicitada.
   * @param {string} [searchToLoad=''] - Texto de búsqueda.
   * @param {number} [limitToLoad=6] - Registros por página.
   * @param {string} [statusToLoad='all'] - Filtro de estado (`all`, `active`, `inactive`).
   * @returns {Promise<void>}
   */
  const fetchCountries = useCallback(
    async (pageToLoad = 1, searchToLoad = '', limitToLoad = 6, statusToLoad = 'all') => {
      setLoadingCountries(true);
      setCountryLoadError('');
      try {
        const params = new URLSearchParams({
          page: String(pageToLoad),
          limit: String(limitToLoad),
          search: searchToLoad,
          status: statusToLoad,
        });
        const res = await fetch(`${API_BASE}/api/v1/external/countries?${params.toString()}`, {
          headers: getAuthHeaders(),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          const list = data.countries || [];
          setCountries(list);
          if (Array.isArray(data.b2b_plans)) {
            setB2bPlans(data.b2b_plans);
          }
          setSelectedCountryForKey((prev) => prev || (list[0]?.id ? String(list[0].id) : ''));
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
    },
    [getAuthHeaders]
  );

  /**
   * Consulta el listado paginado de claves API configuradas para garitas externas.
   *
   * @param {number} [pageToLoad=1] - Página a consultar.
   * @param {number} [limitToLoad=6] - Claves por página.
   * @returns {Promise<void>}
   */
  const fetchIntegrations = useCallback(
    async (pageToLoad = 1, limitToLoad = 6) => {
      setLoadingIntegrations(true);
      try {
        const params = new URLSearchParams({
          page: String(pageToLoad),
          limit: String(limitToLoad),
        });
        const res = await fetch(`${API_BASE}/api/v1/external/integrations?${params.toString()}`, {
          headers: getAuthHeaders(),
        });
        const data = await res.json().catch(() => ({}));
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
    },
    [getAuthHeaders]
  );

  // Carga inicial de comunidades, selector de barrios e integraciones al montar
  useEffect(() => {
    fetchAllCountriesForSelector();
    fetchCountries(1, '', 6, 'all');
    fetchIntegrations(1, 6);
  }, [fetchAllCountriesForSelector, fetchCountries, fetchIntegrations]);

  /**
   * Refresca en paralelo el listado de barrios, el catálogo y las claves API.
   *
   * @returns {Promise<void>}
   */
  const handleRefreshAll = async () => {
    await Promise.all([
      fetchAllCountriesForSelector(),
      fetchCountries(countryPage, countrySearch, countryPageSize, countryStatusFilter),
      fetchIntegrations(integrationsPage, integrationsPageSize),
    ]);
  };

  /**
   * Restablece los filtros de búsqueda y estado de comunidades y vuelve a la página 1.
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
   * Registra una nueva comunidad/barrio privado en el backend (`POST /api/v1/external/countries`).
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
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          name: newCountryName.trim(),
          address: newCountryAddress.trim() || null,
          postal_code: newCountryPostalCode.trim() || null,
          city: newCountryCity.trim() || null,
          province: newCountryProvince.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCountryFeedback({ type: 'success', message: data.message || 'Comunidad creada.' });
        setNewCountryName('');
        setNewCountryAddress('');
        setNewCountryPostalCode('');
        setNewCountryCity('');
        setNewCountryProvince('');
        setShowCreateCountryForm(false);
        await Promise.all([
          fetchAllCountriesForSelector(),
          fetchCountries(1, countrySearch, countryPageSize, countryStatusFilter),
        ]);
      } else {
        setCountryFeedback({
          type: 'error',
          message: data.error || 'No se pudo crear la comunidad.',
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
   * Habilita la edición en línea de datos generales de una comunidad.
   *
   * @param {Object} c - Registro de la comunidad.
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
   * Guarda los cambios de nombre y dirección de una comunidad (`PATCH /api/v1/external/countries/:id`).
   *
   * @param {number} countryId - ID de la comunidad editada.
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
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          name: editCountryName.trim(),
          address: editCountryAddress.trim() || null,
          postal_code: editCountryPostalCode.trim() || null,
          city: editCountryCity.trim() || null,
          province: editCountryProvince.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCountryFeedback({ type: 'success', message: data.message || 'Comunidad actualizada.' });
        setEditingCountryId(null);
        await Promise.all([
          fetchAllCountriesForSelector(),
          fetchCountries(countryPage, countrySearch, countryPageSize, countryStatusFilter),
        ]);
      } else {
        setCountryFeedback({
          type: 'error',
          message: data.error || 'No se pudo actualizar la comunidad.',
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
   * Abre el editor en línea de licenciamiento B2B para la comunidad seleccionada.
   *
   * @param {Object} country - Registro de la comunidad.
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
   * Actualiza la licencia B2B de una comunidad (`PATCH /api/v1/external/countries/:id/billing`).
   *
   * @param {number} countryId - ID de la comunidad.
   * @param {Object|null} [overridePayload=null] - Payload directo opcional (ej. extensión `+30d`).
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
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCountryFeedback({
          type: 'success',
          message: data.message || 'Licencia B2B actualizada.',
        });
        setEditingBillingCountryId(null);
        await Promise.all([
          fetchAllCountriesForSelector(),
          fetchCountries(countryPage, countrySearch, countryPageSize, countryStatusFilter),
        ]);
      } else {
        setCountryFeedback({
          type: 'error',
          message: data.error || 'No se pudo actualizar la licencia B2B.',
        });
      }
    } catch (error) {
      console.error('Error al actualizar licencia B2B:', error);
      setCountryFeedback({
        type: 'error',
        message: 'Error de conexión al guardar la licencia B2B.',
      });
    } finally {
      setSavingBillingCountryId(null);
    }
  };

  /**
   * Activa o desactiva una comunidad (`PATCH /api/v1/external/countries/:id/toggle`).
   *
   * @param {Object} country - Comunidad a activar/desactivar.
   * @returns {Promise<void>}
   */
  const handleToggleCountry = async (country) => {
    setCountryFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/countries/${country.id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ is_active: !country.is_active }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCountryFeedback({ type: 'success', message: data.message || 'Estado actualizado.' });
        await Promise.all([
          fetchAllCountriesForSelector(),
          fetchCountries(countryPage, countrySearch, countryPageSize, countryStatusFilter),
        ]);
      } else {
        setCountryFeedback({
          type: 'error',
          message: data.error || 'No se pudo cambiar el estado.',
        });
      }
    } catch (error) {
      console.error('Error al cambiar estado de comunidad:', error);
      setCountryFeedback({ type: 'error', message: 'Error de conexión.' });
    }
  };

  /**
   * Genera una nueva clave API para la comunidad seleccionada (`POST /api/v1/external/integrations`).
   *
   * @param {React.FormEvent<HTMLFormElement>} e - Evento de envío del formulario.
   * @returns {Promise<void>}
   */
  const handleCreateIntegrationKey = async (e) => {
    e.preventDefault();
    if (!selectedCountryForKey) return;
    setCreatingKey(true);
    setIntegrationFeedback(null);
    setLatestPlainKey(null);
    setCopiedPlainKey(false);
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/integrations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          country_id: Number(selectedCountryForKey),
          label: newKeyLabel.trim() || 'Garita Principal',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setIntegrationFeedback({
          type: 'success',
          message: data.message || 'Clave API generada.',
        });
        if (data.api_key) {
          setLatestPlainKey({
            label: `${data.integration?.country_name || 'Comunidad'} — ${data.integration?.label || ''}`,
            key: data.api_key,
          });
        }
        await Promise.all([
          fetchIntegrations(1, integrationsPageSize),
          fetchCountries(countryPage, countrySearch, countryPageSize, countryStatusFilter),
        ]);
      } else {
        setIntegrationFeedback({
          type: 'error',
          message: data.error || 'No se pudo generar la clave API.',
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
   * Rota una clave API existente (`PATCH /api/v1/external/integrations/:id/rotate`).
   *
   * @param {Object} integration - Integración a rotar.
   * @returns {Promise<void>}
   */
  const handleRotateIntegrationKey = async (integration) => {
    setIntegrationFeedback(null);
    setLatestPlainKey(null);
    setCopiedPlainKey(false);
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/integrations/${integration.id}/rotate`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setIntegrationFeedback({
          type: 'success',
          message: data.message || 'Clave rotada correctamente.',
        });
        if (data.api_key) {
          setLatestPlainKey({
            label: `${integration.country_name} — ${integration.label} (Rotada)`,
            key: data.api_key,
          });
        }
        await fetchIntegrations(integrationsPage, integrationsPageSize);
      } else {
        setIntegrationFeedback({
          type: 'error',
          message: data.error || 'No se pudo rotar la clave.',
        });
      }
    } catch (error) {
      console.error('Error al rotar clave:', error);
      setIntegrationFeedback({ type: 'error', message: 'Error de conexión al rotar clave.' });
    }
  };

  /**
   * Activa o revoca una clave API existente (`PATCH /api/v1/external/integrations/:id/toggle`).
   *
   * @param {Object} integration - Integración cuyo estado se invierte.
   * @returns {Promise<void>}
   */
  const handleToggleIntegrationKey = async (integration) => {
    setIntegrationFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/integrations/${integration.id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ is_active: !integration.is_active }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setIntegrationFeedback({
          type: 'success',
          message: data.message || 'Estado de clave actualizado.',
        });
        await Promise.all([
          fetchIntegrations(integrationsPage, integrationsPageSize),
          fetchCountries(countryPage, countrySearch, countryPageSize, countryStatusFilter),
        ]);
      } else {
        setIntegrationFeedback({
          type: 'error',
          message: data.error || 'No se pudo actualizar la clave.',
        });
      }
    } catch (error) {
      console.error('Error al cambiar estado de clave:', error);
      setIntegrationFeedback({ type: 'error', message: 'Error de conexión.' });
    }
  };

  /**
   * Copia la clave API recién generada o rotada al portapapeles con confirmación temporal.
   *
   * @returns {Promise<void>}
   */
  const handleCopyPlainKey = async () => {
    if (!latestPlainKey?.key) return;
    try {
      await navigator.clipboard.writeText(latestPlainKey.key);
      setCopiedPlainKey(true);
      setTimeout(() => setCopiedPlainKey(false), 1800);
    } catch (err) {
      console.error('No se pudo copiar la clave API:', err);
    }
  };

  const selectorCountriesList = allCountriesOptions.length > 0 ? allCountriesOptions : countries;

  return (
    <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 md:py-8 space-y-6 font-sans">
      {/* Encabezado unificado con selector de pestañas: Barrios B2B vs Operación Local */}
      <section
        className="border border-white/10 p-5 sm:p-6 rounded-2xl shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        style={cardStyle}
      >
        <div className="flex items-center gap-3.5">
          <div
            className="p-3 rounded-xl border border-white/15 text-emerald-400 shrink-0"
            style={innerStyle}
          >
            <Building2 size={22} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Comunidades</h2>
            <p className="text-xs opacity-80 mt-0.5">
              Barrios adheridos, licencias B2B, claves API de garita, alertas y suspensiones locales.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex items-center p-1 rounded-xl border border-white/15 gap-1"
            style={innerStyle}
          >
            <button
              type="button"
              onClick={() => setActiveTab('b2b')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'b2b'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'opacity-80 hover:opacity-100'
              }`}
            >
              <Building2 size={14} />
              <span>Barrios y Licencias ({countryTotalCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('local_ops')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'local_ops'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'opacity-80 hover:opacity-100'
              }`}
            >
              <ShieldAlert size={14} />
              <span>Operación Local</span>
            </button>
          </div>

          {activeTab === 'b2b' && (
            <button
              type="button"
              onClick={handleRefreshAll}
              disabled={loadingCountries || loadingIntegrations}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/15 text-xs font-bold hover:opacity-90 cursor-pointer disabled:opacity-50"
              style={innerStyle}
            >
              <RefreshCw
                size={14}
                className={loadingCountries || loadingIntegrations ? 'animate-spin' : ''}
              />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          )}
        </div>
      </section>

      {/* ======================================================================
          PESTAÑA 1: BARRIOS, LICENCIAS B2B Y CLAVES API DE GARITA
         ====================================================================== */}
      {activeTab === 'b2b' && (
        <div className="space-y-6">
          {/* Sección 1: Comunidades / Barrios Privados y Licenciamiento B2B */}
          <section
            className="border border-white/10 p-5 sm:p-6 rounded-2xl shadow-sm space-y-4"
            style={cardStyle}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Building2 size={17} className="text-emerald-400" />
                <h3 className="text-sm font-bold">Barrios y Licencias B2B ({countryTotalCount})</h3>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="relative">
                  <Search
                    size={13}
                    className="opacity-60 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
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
                <button
                  type="button"
                  onClick={() => setShowCreateCountryForm((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                >
                  {showCreateCountryForm ? <X size={13} /> : <Plus size={13} />}
                  <span>{showCreateCountryForm ? 'Cerrar alta' : 'Nuevo barrio'}</span>
                </button>
              </div>
            </div>

            {/* Formulario desplegable de alta de una nueva comunidad */}
            {showCreateCountryForm && (
              <form
                onSubmit={handleCreateCountry}
                className="p-4 rounded-xl border border-white/10 space-y-2.5 text-xs"
                style={innerStyle}
              >
                <p className="font-bold text-emerald-300">Registrar nueva comunidad / barrio</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    required
                    value={newCountryName}
                    onChange={(e) => setNewCountryName(e.target.value)}
                    placeholder="Nombre del barrio *"
                    className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                    style={cardStyle}
                  />
                  <input
                    type="text"
                    value={newCountryAddress}
                    onChange={(e) => setNewCountryAddress(e.target.value)}
                    placeholder="Dirección / acceso"
                    className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                    style={cardStyle}
                  />
                  <input
                    type="text"
                    value={newCountryPostalCode}
                    onChange={(e) => setNewCountryPostalCode(e.target.value)}
                    placeholder="Código postal"
                    className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                    style={cardStyle}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    value={newCountryCity}
                    onChange={(e) => setNewCountryCity(e.target.value)}
                    placeholder="Localidad"
                    className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                    style={cardStyle}
                  />
                  <input
                    type="text"
                    value={newCountryProvince}
                    onChange={(e) => setNewCountryProvince(e.target.value)}
                    placeholder="Provincia"
                    className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                    style={cardStyle}
                  />
                  <button
                    type="submit"
                    disabled={creatingCountry || !newCountryName.trim()}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Plus size={14} /> {creatingCountry ? 'Guardando...' : 'Crear barrio'}
                  </button>
                </div>
              </form>
            )}

            {/* Alertas de carga y feedback */}
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

            {/* Tabla de comunidades con edición en línea de datos y licencia B2B */}
            {loadingCountries ? (
              <div className="text-center py-6 text-xs opacity-80">Cargando comunidades...</div>
            ) : countries.length === 0 ? (
              <div
                className="text-center py-6 rounded-xl border border-white/10 text-xs opacity-80 space-y-2"
                style={innerStyle}
              >
                <p>Sin resultados para los filtros actuales.</p>
                {(countrySearch || countryStatusFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={handleResetCountryFilters}
                    className="px-3 py-1 rounded-lg border border-white/15 text-[11px] font-bold cursor-pointer"
                    style={cardStyle}
                  >
                    Restablecer filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10" style={innerStyle}>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 opacity-75">
                      <th className="py-2.5 px-3 font-semibold">ID</th>
                      <th className="py-2.5 px-3 font-semibold">Barrio</th>
                      <th className="py-2.5 px-3 font-semibold">Ubicación</th>
                      <th className="py-2.5 px-3 font-semibold">Licencia B2B / QR mes</th>
                      <th className="py-2.5 px-3 font-semibold">Claves</th>
                      <th className="py-2.5 px-3 font-semibold">Estado</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
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
                        [c.city, c.province, c.postal_code].filter(Boolean).join(', ') || '—';

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
                          <td className="py-2.5 px-3">
                            {isEditingBilling ? (
                              <div className="space-y-1.5 min-w-50">
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

            {/* Paginación de comunidades */}
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
                  <option value={6}>6 / pág</option>
                  <option value={10}>10 / pág</option>
                  <option value={20}>20 / pág</option>
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

          {/* Sección 2: Claves API por Comunidad (Integraciones de garita) */}
          <section
            className="border border-white/10 p-5 sm:p-6 rounded-2xl shadow-sm space-y-4"
            style={cardStyle}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck size={17} className="text-amber-400" />
                <h3 className="text-sm font-bold">
                  Claves API de Garita por Comunidad ({integrationsTotalCount})
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
                <div className="space-y-1 min-w-0">
                  <span className="text-amber-200 font-semibold block">
                    Clave generada ({latestPlainKey.label}) — guardala ahora, no volverá a mostrarse:
                  </span>
                  <code className="font-mono text-[11px] text-amber-100 break-all">
                    {latestPlainKey.key}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={handleCopyPlainKey}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-900/40 text-amber-100 font-bold cursor-pointer shrink-0 self-start sm:self-center"
                >
                  {copiedPlainKey ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedPlainKey ? 'Copiada' : 'Copiar'}</span>
                </button>
              </div>
            )}

            {loadingIntegrations ? (
              <div className="text-center py-6 text-xs opacity-80">Cargando claves...</div>
            ) : integrations.length === 0 ? (
              <div
                className="text-center py-6 rounded-xl border border-white/10 text-xs opacity-80"
                style={innerStyle}
              >
                Sin claves API configuradas.
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="overflow-x-auto rounded-xl border border-white/10" style={innerStyle}>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 opacity-75">
                        <th className="py-2.5 px-3 font-semibold">Barrio</th>
                        <th className="py-2.5 px-3 font-semibold">Etiqueta</th>
                        <th className="py-2.5 px-3 font-semibold">Prefijo</th>
                        <th className="py-2.5 px-3 font-semibold">Estado</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
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
        </div>
      )}

      {/* ======================================================================
          PESTAÑA 2: OPERACIÓN LOCAL (SUSPENSIONES, ALERTAS Y LICENCIA POR BARRIO)
         ====================================================================== */}
      {activeTab === 'local_ops' && <LocalAdminView embedded />}
    </div>
  );
}
