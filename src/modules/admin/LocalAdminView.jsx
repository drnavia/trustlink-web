/**
 * @file LocalAdminView.jsx
 * @description Consola operativa para el rol `admin` (administrador local de barrio/comunidad)
 * y pestaña "Operación Local" embebida en `CommunitiesAdminView` para `superadmin`.
 * - Encabezado unificado (`AdminPageHeader`) con badge de comunidad en vista independiente.
 * - Barra de contexto superior para `superadmin` (selector de barrio + resumen compacto B2B)
 *   y tarjeta de Licencia B2B clara para `admin` (sin `∞` ambiguo y con aviso si falta asignación).
 * - Alertas proactivas de vencimiento documental agrupadas por persona (sin duplicados por rubro),
 *   fechas en formato local `dd/mm/aaaa`, `AdminListToolbar` y paginación `6 / 12 / 24 / 50`.
 * - Historial de suspensiones locales con modal de alta `+ Nueva suspensión local` (sin
 *   prestador preseleccionado, con chips de motivos frecuentes y aviso explícito de alcance local).
 * @location /trustlink-web/src/modules/admin/LocalAdminView.jsx
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldAlert,
  Building2,
  Plus,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Unlock,
  Clock,
  MessageCircle,
  Download,
  X,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useBranding, DEFAULT_BRANDING_CONFIG } from '../branding/BrandingContext';
import { API_BASE } from '../../config/api';
import { PAGE_SHELL_CLASS, SECTION_CARD_CLASS, FIELD_INPUT_CLASS } from '../../config/uiTokens';
import { downloadCsv } from '../../utils/csvExport';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminListToolbar from '../../components/admin/AdminListToolbar';
import AdminPaginationBar from '../../components/admin/AdminPaginationBar';
import { paginateItems } from '../../utils/adminPagination';

/** Motivos rápidos sugeridos al registrar una suspensión operativa local. */
const QUICK_SUSPENSION_REASONS = [
  'Incumplimiento normativo de obra',
  'Horario de trabajo no respetado',
  'Documentación o ingreso irregular en garita',
  'Incidente de convivencia dentro del barrio',
];

/**
 * Formatea una fecha ISO (`YYYY-MM-DD` o timestamp) al formato legible argentino `dd/mm/aaaa`.
 *
 * @param {string|null|undefined} rawDate - Fecha en formato ISO o cadena de fecha.
 * @returns {string} Fecha formateada `dd/mm/aaaa` o `'—'` si no existe.
 */
function formatLocalDate(rawDate) {
  if (!rawDate) return '—';
  const str = String(rawDate).trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return str;
  return parsed.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Devuelve etiqueta en español y estilos del badge de estado comercial B2B.
 *
 * @param {string|null|undefined} status - Estado (`active`, `trial`, `grace`, `suspended`).
 * @returns {{ label: string, cls: string }} Etiqueta y clases Tailwind.
 */
function getBillingStatusMeta(status) {
  if (status === 'suspended') {
    return { label: 'Suspendida', cls: 'bg-rose-950 text-rose-300 border-rose-800' };
  }
  if (status === 'grace') {
    return { label: 'Período de gracia', cls: 'bg-amber-950 text-amber-300 border-amber-700' };
  }
  if (status === 'trial') {
    return { label: 'Prueba', cls: 'bg-sky-950 text-sky-300 border-sky-800' };
  }
  return { label: 'Activa', cls: 'bg-emerald-950 text-emerald-300 border-emerald-800' };
}

/**
 * Agrupa alertas de documentación personal (`criminal_record` / `provider_art`) por persona + documento
 * como resguardo en cliente, evitando tarjetas duplicadas cuando un prestador ofrece varios rubros.
 *
 * @param {Array<Object>} alerts - Alertas devueltas por el backend.
 * @returns {Array<Object>} Alertas consolidadas sin duplicados personales.
 */
function consolidatePersonalAlerts(alerts) {
  if (!Array.isArray(alerts)) return [];
  const personalMap = new Map();
  const others = [];

  alerts.forEach((alert) => {
    const isPersonal = alert.category === 'criminal_record' || alert.category === 'provider_art';
    if (!isPersonal) {
      others.push(alert);
      return;
    }
    const personKey =
      alert.user_id ||
      alert.provider_email ||
      alert.provider_name ||
      alert.provider_id ||
      alert.id;
    const key = `${alert.category}:${String(personKey).toLowerCase()}`;
    const existing = personalMap.get(key);

    if (!existing) {
      const initialSpecialties = Array.isArray(alert.specialties) ? [...alert.specialties] : [];
      if (initialSpecialties.length === 0 && alert.subtitle && alert.provider_name) {
        const suffix = alert.subtitle.replace(alert.provider_name, '').replace(/^[\s·-]+/, '').trim();
        if (suffix) initialSpecialties.push(suffix);
      }
      personalMap.set(key, {
        ...alert,
        specialties: initialSpecialties,
      });
    } else {
      const incoming = Array.isArray(alert.specialties) ? alert.specialties : [];
      if (incoming.length > 0) {
        incoming.forEach((sp) => {
          if (sp && !existing.specialties.includes(sp)) existing.specialties.push(sp);
        });
      } else if (alert.subtitle && alert.provider_name) {
        const suffix = alert.subtitle.replace(alert.provider_name, '').replace(/^[\s·-]+/, '').trim();
        if (suffix && !existing.specialties.includes(suffix)) existing.specialties.push(suffix);
      }
      if (Number(alert.days_remaining) < Number(existing.days_remaining)) {
        existing.days_remaining = alert.days_remaining;
        existing.expiry_date = alert.expiry_date;
        existing.severity = alert.severity;
      }
    }
  });

  const merged = [...Array.from(personalMap.values()), ...others];
  merged.sort((a, b) => Number(a.days_remaining ?? 0) - Number(b.days_remaining ?? 0));
  return merged;
}

/**
 * Consola operativa de comunidad/barrio (standalone para `admin` o embebida para `superadmin`).
 *
 * @param {Object} [props] - Propiedades opcionales del componente.
 * @param {boolean} [props.embedded=false] - Si es `true`, omite el contenedor de página y encabezado propio.
 * @returns {JSX.Element} Vista operativa de administración local.
 */
export default function LocalAdminView({ embedded = false } = {}) {
  const { user } = useAuth();
  const { brand } = useBranding();
  const isSuperadmin = user?.role === 'superadmin';

  // Estilos dinámicos de branding: Zona 4 (tarjetas principales) y Zona 5 (cajas internas e inputs)
  const cardStyle = {
    backgroundColor: brand.cardBgColor || DEFAULT_BRANDING_CONFIG.cardBgColor,
    color: brand.cardTextColor || DEFAULT_BRANDING_CONFIG.cardTextColor,
  };

  const innerStyle = {
    backgroundColor: brand.innerBgColor || DEFAULT_BRANDING_CONFIG.innerBgColor,
    color: brand.innerTextColor || DEFAULT_BRANDING_CONFIG.innerTextColor,
  };

  // Datos cargados desde el backend: comunidades, prestadores, suspensiones, alertas y licencia B2B
  const [countries, setCountries] = useState([]);
  const [providers, setProviders] = useState([]);
  const [suspensions, setSuspensions] = useState([]);
  const [expiryAlerts, setExpiryAlerts] = useState([]);
  const [communityBilling, setCommunityBilling] = useState(null);

  // Estado de comunidad activa y modal de alta de suspensión local
  const [selectedCountryId, setSelectedCountryId] = useState(
    user?.country_id ? String(user.country_id) : ''
  );
  const [showSuspensionModal, setShowSuspensionModal] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [liftingId, setLiftingId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Filtros y paginación homologada (6 / 12 / 24 / 50) para Alertas y Suspensiones
  const [alertSearch, setAlertSearch] = useState('');
  const [alertSeverityFilter, setAlertSeverityFilter] = useState('all');
  const [alertPage, setAlertPage] = useState(1);
  const [alertPageSize, setAlertPageSize] = useState(6);

  const [suspSearch, setSuspSearch] = useState('');
  const [suspStatusFilter, setSuspStatusFilter] = useState('all');
  const [suspPage, setSuspPage] = useState(1);
  const [suspPageSize, setSuspPageSize] = useState(6);

  // Alertas consolidadas (sin duplicados por múltiples especialidades del mismo prestador)
  const normalizedAlerts = useMemo(() => consolidatePersonalAlerts(expiryAlerts), [expiryAlerts]);

  const alertCounts = useMemo(
    () =>
      normalizedAlerts.reduce(
        (acc, a) => {
          acc.all += 1;
          if (a.severity === 'expired') acc.expired += 1;
          else acc.expiringSoon += 1;
          return acc;
        },
        { all: 0, expired: 0, expiringSoon: 0 }
      ),
    [normalizedAlerts]
  );

  const filteredAlerts = useMemo(() => {
    const q = alertSearch.trim().toLowerCase();
    return normalizedAlerts.filter((a) => {
      if (alertSeverityFilter === 'expired' && a.severity !== 'expired') return false;
      if (alertSeverityFilter === 'expiring_soon' && a.severity === 'expired') return false;
      if (!q) return true;
      const specialtiesText = Array.isArray(a.specialties) ? a.specialties.join(' ') : '';
      const hay = `${a.title || ''} ${a.subtitle || ''} ${a.provider_name || ''} ${
        a.provider_email || ''
      } ${specialtiesText}`.toLowerCase();
      return hay.includes(q);
    });
  }, [normalizedAlerts, alertSearch, alertSeverityFilter]);

  const pagedAlerts = useMemo(
    () => paginateItems(filteredAlerts, alertPage, alertPageSize),
    [filteredAlerts, alertPage, alertPageSize]
  );

  const suspCounts = useMemo(
    () =>
      suspensions.reduce(
        (acc, item) => {
          acc.all += 1;
          if (item.status === 'active') acc.active += 1;
          else acc.lifted += 1;
          return acc;
        },
        { all: 0, active: 0, lifted: 0 }
      ),
    [suspensions]
  );

  const filteredSuspensions = useMemo(() => {
    const q = suspSearch.trim().toLowerCase();
    return suspensions.filter((item) => {
      if (suspStatusFilter === 'active' && item.status !== 'active') return false;
      if (suspStatusFilter === 'lifted' && item.status === 'active') return false;
      if (!q) return true;
      const hay = `${item.country_name || ''} ${item.provider_first_name || ''} ${
        item.provider_last_name || ''
      } ${item.specialty || ''} ${item.reason || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [suspensions, suspSearch, suspStatusFilter]);

  const pagedSuspensions = useMemo(
    () => paginateItems(filteredSuspensions, suspPage, suspPageSize),
    [filteredSuspensions, suspPage, suspPageSize]
  );

  // Nombre y ID efectivo de la comunidad actualmente visualizada
  const activeCommunity = useMemo(() => {
    if (communityBilling?.name) {
      return { id: String(communityBilling.id), name: communityBilling.name };
    }
    const found = countries.find((c) => String(c.id) === String(selectedCountryId));
    if (found) return { id: String(found.id), name: found.name };
    if (countries.length > 0 && !isSuperadmin) {
      return { id: String(countries[0].id), name: countries[0].name };
    }
    return null;
  }, [communityBilling, countries, selectedCountryId, isSuperadmin]);

  const hasAssignedCommunity = isSuperadmin || Boolean(activeCommunity?.id);

  /**
   * Construye el encabezado de autorización Bearer utilizando el JWT almacenado localmente.
   *
   * @returns {{ Authorization: string }} Cabeceras HTTP de autenticación.
   */
  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
  });

  /**
   * Carga en paralelo las suspensiones locales, alertas de vencimiento documental (30 días)
   * y el estado de la licencia B2B de la comunidad seleccionada (o asignada al admin local).
   *
   * @param {string|number} countryFilter - ID de comunidad usado como filtro cuando opera un superadmin.
   * @returns {Promise<void>}
   */
  const fetchLocalData = useCallback(
    async (countryFilter) => {
      setLoading(true);
      try {
        const query = isSuperadmin && countryFilter ? `?country_id=${countryFilter}` : '';
        const [res, alertsRes, billingRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/providers/local-suspensions${query}`, {
            headers: getAuthHeaders(),
          }),
          fetch(`${API_BASE}/api/v1/providers/expiry-alerts?days=30`, {
            headers: getAuthHeaders(),
          }).catch(() => null),
          fetch(`${API_BASE}/api/v1/external/my-community/billing${query}`, {
            headers: getAuthHeaders(),
          }).catch(() => null),
        ]);
        const data = await res.json();
        if (res.ok) {
          const loadedCountries = data.countries || [];
          const loadedProviders = data.providers || [];
          setCountries(loadedCountries);
          setProviders(loadedProviders);
          setSuspensions(data.suspensions || []);

          if (data.effective_country_id) {
            setSelectedCountryId(String(data.effective_country_id));
          } else if (loadedCountries.length > 0) {
            setSelectedCountryId((prev) => prev || String(loadedCountries[0].id));
          } else if (!isSuperadmin) {
            setSelectedCountryId('');
          }
        }
        // Actualiza alertas preventivas de documentación vencida o próxima a vencer
        if (alertsRes && alertsRes.ok) {
          const alertsData = await alertsRes.json();
          setExpiryAlerts(alertsData.alerts || []);
        }
        // Actualiza información de licencia B2B y cuota mensual de QR de la comunidad
        if (billingRes && billingRes.ok) {
          const billingData = await billingRes.json();
          setCommunityBilling(billingData.community || null);
        } else {
          setCommunityBilling(null);
        }
      } catch (error) {
        console.error('Error al cargar reportes locales:', error);
      } finally {
        setLoading(false);
      }
    },
    [isSuperadmin]
  );

  /**
   * Construye un enlace directo de WhatsApp (`wa.me`) con mensaje prellenado para notificar
   * al prestador sobre documentación vencida o próxima a vencer.
   *
   * @param {Object} alert - Objeto de alerta documental con teléfono, nombre, título y vencimiento.
   * @returns {string} URL lista para abrir en WhatsApp.
   */
  const buildExpiryWhatsAppUrl = (alert) => {
    const digits = String(alert.provider_phone || '').replace(/\D/g, '');
    const formattedDate = formatLocalDate(alert.expiry_date);
    const statusText =
      alert.severity === 'expired'
        ? `venció el ${formattedDate}`
        : Number(alert.days_remaining) === 0
          ? `vence hoy (${formattedDate})`
          : `vence en ${alert.days_remaining} día(s) (${formattedDate})`;
    const text =
      `Hola ${alert.provider_name || ''}, te escribimos desde la Administración TrustLink: ` +
      `tu documentación "${alert.title}" ${statusText}. Por favor actualizala en tu Portal Prestador para mantener el ingreso habilitado en garita.`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  };

  // Carga inicial de datos locales según la comunidad asignada al usuario autenticado
  useEffect(() => {
    fetchLocalData(user?.country_id ? String(user.country_id) : isSuperadmin ? '1' : '');
  }, [fetchLocalData, user?.country_id, isSuperadmin]);

  /**
   * Abre el modal de nueva suspensión local limpiando selección previa para evitar errores.
   */
  const openSuspensionModal = () => {
    setSelectedProviderId('');
    setReason('');
    setShowSuspensionModal(true);
  };

  /**
   * Registra un reporte o suspensión local de un prestador dentro de la comunidad seleccionada
   * y recarga el panel al confirmar la operación.
   *
   * @param {React.FormEvent<HTMLFormElement>} e - Evento de envío del formulario.
   * @returns {Promise<void>}
   */
  const handleCreateSuspension = async (e) => {
    e.preventDefault();
    const targetCountryId = Number(selectedCountryId || activeCommunity?.id || 0);
    if (!targetCountryId || !selectedProviderId || !reason.trim()) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/providers/local-suspensions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          country_id: targetCountryId,
          provider_id: Number(selectedProviderId),
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: 'success',
          message: data.message || 'Reporte o suspensión local registrado.',
        });
        setReason('');
        setSelectedProviderId('');
        setShowSuspensionModal(false);
        await fetchLocalData(String(targetCountryId));
      } else {
        setFeedback({
          type: 'error',
          message: data.error || 'No se pudo registrar el reporte local.',
        });
      }
    } catch (error) {
      console.error('Error al crear suspensión local:', error);
      setFeedback({
        type: 'error',
        message: 'Error de conexión con el backend.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Levanta una suspensión local activa para volver a habilitar el ingreso del prestador
   * en la comunidad y refresca el historial.
   *
   * @param {number|string} id - Identificador del registro de suspensión local.
   * @returns {Promise<void>}
   */
  const handleLiftSuspension = async (id) => {
    setLiftingId(id);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/providers/local-suspensions/${id}/lift`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: 'success',
          message: data.message || 'Suspensión local levantada.',
        });
        await fetchLocalData(selectedCountryId);
      } else {
        setFeedback({
          type: 'error',
          message: data.error || 'No se pudo levantar la suspensión.',
        });
      }
    } catch (error) {
      console.error('Error al levantar suspensión:', error);
      setFeedback({
        type: 'error',
        message: 'Error de conexión.',
      });
    } finally {
      setLiftingId(null);
    }
  };

  const billingMeta = getBillingStatusMeta(communityBilling?.billing_status);

  return (
    <div className={embedded ? 'space-y-6 font-sans' : `${PAGE_SHELL_CLASS} font-sans`}>
      {/* Zona 4: Encabezado homologado (solo en vista independiente de Admin Barrio) */}
      {!embedded && (
        <AdminPageHeader
          icon={<ShieldAlert size={22} strokeWidth={1.8} />}
          iconColorClass="text-amber-400"
          title="Administración de Barrio"
          subtitle={
            activeCommunity
              ? `Operación preventiva y suspensiones locales de ${activeCommunity.name}.`
              : 'Alertas de vencimiento documental y suspensiones locales de la comunidad.'
          }
          rightSlot={
            activeCommunity ? (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/15 text-xs font-bold"
                style={innerStyle}
              >
                <Building2 size={13} className="text-sky-400 shrink-0" />
                <span>{activeCommunity.name}</span>
              </span>
            ) : null
          }
          onRefresh={() => fetchLocalData(selectedCountryId)}
          refreshing={loading}
          cardStyle={cardStyle}
          innerStyle={innerStyle}
        />
      )}

      {/* Aviso explícito para Admin Barrio si su cuenta aún no tiene comunidad asignada */}
      {!loading && !isSuperadmin && !hasAssignedCommunity && (
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl text-xs border border-amber-700/70 bg-amber-950/50 text-amber-200">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Tu cuenta aún no tiene una comunidad asignada</p>
            <p className="opacity-85 mt-0.5">
              Solicitá a Administración Central que vincule tu usuario a tu barrio para consultar la
              licencia B2B y registrar suspensiones locales.
            </p>
          </div>
        </div>
      )}

      {/* Banner de feedback operativo (confirmación o error) */}
      {feedback && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs border ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/60 border-rose-800 text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Barra de Contexto Superior para Superadmin (controla toda la pestaña Operación Local) */}
      {isSuperadmin && (
        <section
          className="border border-white/10 p-4 rounded-2xl shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs"
          style={cardStyle}
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 font-bold opacity-85">
              <Building2 size={14} className="text-sky-400" />
              Comunidad:
            </span>
            <select
              value={selectedCountryId}
              onChange={(e) => {
                const nextCountry = e.target.value;
                setSelectedCountryId(nextCountry);
                setSuspPage(1);
                fetchLocalData(nextCountry);
              }}
              aria-label="Seleccionar comunidad a supervisar"
              className={`px-3 min-w-52 cursor-pointer ${FIELD_INPUT_CLASS}`}
              style={innerStyle}
            >
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.id} · {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Resumen compacto de licencia B2B sin duplicar la tarjeta completa de Barrios y Licencias */}
          {communityBilling && (
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="px-2.5 py-1 rounded-lg border border-white/15 font-semibold"
                style={innerStyle}
              >
                {communityBilling.plan_name || communityBilling.plan_code}
              </span>
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${billingMeta.cls}`}
              >
                {billingMeta.label}
              </span>
              <span
                className="px-2.5 py-1 rounded-lg border border-white/15 font-mono"
                style={innerStyle}
                title="Validaciones QR registradas en el mes en curso"
              >
                QR mes:{' '}
                <strong>{communityBilling.monthly_qr_used ?? 0}</strong>
                {communityBilling.monthly_pass_quota
                  ? ` / ${communityBilling.monthly_pass_quota}`
                  : ' (sin tope)'}
              </span>
              <span
                className="px-2.5 py-1 rounded-lg border border-white/15 opacity-85"
                style={innerStyle}
              >
                Claves API: <strong>{communityBilling.active_keys_count ?? 0}</strong>
              </span>
            </div>
          )}
        </section>
      )}

      {/* Tarjeta de Licencia B2B de la comunidad (visible para Admin Barrio) */}
      {!isSuperadmin && communityBilling && (
        <section
          className="border border-white/10 p-5 rounded-2xl shadow-sm space-y-3 text-xs"
          style={cardStyle}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="p-2.5 rounded-xl border border-white/15 text-emerald-400 shrink-0"
                style={innerStyle}
              >
                <Building2 size={17} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold">
                    Licencia B2B · {communityBilling.name}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold border border-white/15"
                    style={innerStyle}
                  >
                    {communityBilling.plan_name || communityBilling.plan_code}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${billingMeta.cls}`}
                  >
                    {billingMeta.label}
                  </span>
                </div>
                <p className="opacity-75 mt-0.5">
                  Claves API activas: <strong>{communityBilling.active_keys_count ?? 0}</strong>
                  {' · '}
                  Vigencia:{' '}
                  <strong>
                    {communityBilling.subscription_ends_at
                      ? formatLocalDate(communityBilling.subscription_ends_at)
                      : 'Sin vencimiento fijo'}
                  </strong>
                </p>
              </div>
            </div>

            <div
              className="px-3.5 py-2 rounded-xl border border-white/15 text-right shrink-0"
              style={innerStyle}
            >
              <div className="text-[10px] uppercase tracking-wider opacity-70">
                Validaciones QR del mes
              </div>
              <div className="text-sm font-black font-mono">
                {communityBilling.monthly_qr_used ?? 0}
                {communityBilling.monthly_pass_quota
                  ? ` / ${communityBilling.monthly_pass_quota}`
                  : ''}
              </div>
              {!communityBilling.monthly_pass_quota && (
                <div className="text-[10px] opacity-70">Sin tope mensual</div>
              )}
            </div>
          </div>

          {/* Barra de consumo mensual de cuota QR (verde <75%, ámbar >=75%, rojo >=90%) */}
          {typeof communityBilling.usage_percent === 'number' && (
            <div className="space-y-1">
              <div className="h-2 w-full rounded-full overflow-hidden bg-black/35 border border-white/10">
                <div
                  className={`h-full transition-all ${
                    communityBilling.usage_percent >= 90
                      ? 'bg-rose-500'
                      : communityBilling.usage_percent >= 75
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${communityBilling.usage_percent}%` }}
                />
              </div>
              <p className="text-[11px] opacity-75">
                Consumo mensual: {communityBilling.usage_percent}% de la cuota contratada.
              </p>
            </div>
          )}
        </section>
      )}

      {/* ==================== BLOQUE 1 (PRIORITARIO): ALERTAS DOCUMENTALES ==================== */}
      <section className={SECTION_CARD_CLASS} style={cardStyle}>
        <div className="flex items-center gap-2.5">
          <Clock size={17} className="text-amber-400 shrink-0" />
          <div>
            <h3 className="text-sm font-bold">
              Alertas de Vencimiento Documental (ART, Antecedentes, Seguros y Cuadrilla)
            </h3>
            <p className="text-xs opacity-75 mt-0.5">
              Documentos vencidos o próximos a vencer en 30 días, consolidados por prestador.
            </p>
          </div>
        </div>

        {/* Barra estándar: los chips muestran el conteo y filtran sin repetir píldoras arriba */}
        <AdminListToolbar
          searchValue={alertSearch}
          onSearchChange={(val) => {
            setAlertSearch(val);
            setAlertPage(1);
          }}
          searchPlaceholder="Buscar documento, prestador, rubro o correo..."
          chips={[
            { id: 'all', label: 'Todas', count: alertCounts.all },
            { id: 'expired', label: 'Vencidas', count: alertCounts.expired },
            { id: 'expiring_soon', label: 'Por vencer', count: alertCounts.expiringSoon },
          ]}
          activeChip={alertSeverityFilter}
          onChipChange={(chip) => {
            setAlertSeverityFilter(chip);
            setAlertPage(1);
          }}
          hasActiveFilters={Boolean(alertSearch.trim() || alertSeverityFilter !== 'all')}
          onResetFilters={() => {
            setAlertSearch('');
            setAlertSeverityFilter('all');
            setAlertPage(1);
          }}
          actions={
            <button
              type="button"
              disabled={filteredAlerts.length === 0}
              onClick={() =>
                downloadCsv(
                  `trustlink-vencimientos-${new Date().toISOString().slice(0, 10)}.csv`,
                  [
                    { key: 'title', label: 'Documento' },
                    { key: 'provider_name', label: 'Prestador' },
                    {
                      key: 'specialties',
                      label: 'Rubros',
                      format: (a) => (Array.isArray(a.specialties) ? a.specialties.join(' / ') : ''),
                    },
                    { key: 'provider_email', label: 'Email' },
                    { key: 'severity', label: 'Severidad' },
                    {
                      key: 'expiry_date',
                      label: 'Fecha Vencimiento',
                      format: (a) => formatLocalDate(a.expiry_date),
                    },
                    { key: 'days_remaining', label: 'Dias Restantes' },
                  ],
                  filteredAlerts
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/15 font-bold cursor-pointer hover:opacity-90 disabled:opacity-40"
              style={innerStyle}
            >
              <Download size={13} /> Exportar CSV
            </button>
          }
          innerStyle={innerStyle}
        />

        {pagedAlerts.pageItems.length === 0 ? (
          <div
            className="text-center py-6 rounded-xl border border-white/10 text-xs opacity-80"
            style={innerStyle}
          >
            {normalizedAlerts.length === 0
              ? 'Toda la documentación con fecha cargada se encuentra vigente (+30 días).'
              : 'Sin alertas que coincidan con el filtro aplicado.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pagedAlerts.pageItems.map((alert) => {
              const isExpired = alert.severity === 'expired';
              const specialties = Array.isArray(alert.specialties) ? alert.specialties : [];
              return (
                <div
                  key={alert.id}
                  className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                    isExpired
                      ? 'border-rose-800/70 bg-rose-950/35'
                      : 'border-amber-800/70 bg-amber-950/30'
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold">{alert.title}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isExpired
                            ? 'bg-rose-950 text-rose-300 border-rose-700'
                            : 'bg-amber-950 text-amber-300 border-amber-700'
                        }`}
                      >
                        {isExpired
                          ? `Vencido (${Math.abs(alert.days_remaining)} d)`
                          : Number(alert.days_remaining) === 0
                            ? 'Vence hoy'
                            : `Vence en ${alert.days_remaining} d`}
                      </span>
                    </div>
                    <p className="text-[11px] opacity-85 truncate">
                      <strong>{alert.provider_name || alert.subtitle}</strong>
                      {' · '}
                      Vencimiento: <span className="font-mono">{formatLocalDate(alert.expiry_date)}</span>
                    </p>
                    {specialties.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {specialties.map((sp) => (
                          <span
                            key={sp}
                            className="px-2 py-0.5 rounded-md text-[10px] border border-white/15 opacity-85"
                            style={innerStyle}
                          >
                            {sp}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <a
                    href={buildExpiryWhatsAppUrl(alert)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
                    title="Enviar recordatorio de renovación por WhatsApp"
                  >
                    <MessageCircle size={12} /> Avisar
                  </a>
                </div>
              );
            })}
          </div>
        )}

        {normalizedAlerts.length > 0 && (
          <AdminPaginationBar
            page={pagedAlerts.safePage}
            totalPages={pagedAlerts.totalPages}
            totalItems={pagedAlerts.totalItems}
            pageSize={alertPageSize}
            onPageChange={setAlertPage}
            onPageSizeChange={(nextSize) => {
              setAlertPageSize(nextSize);
              setAlertPage(1);
            }}
            itemLabel="alerta(s)"
            innerStyle={innerStyle}
          />
        )}
      </section>

      {/* ==================== BLOQUE 2: HISTORIAL DE SUSPENSIONES LOCALES ==================== */}
      <section className={SECTION_CARD_CLASS} style={cardStyle}>
        <div className="flex items-center gap-2.5">
          <ShieldAlert size={17} className="text-sky-400 shrink-0" />
          <div>
            <h3 className="text-sm font-bold">
              Historial de reportes y suspensiones locales ({suspensions.length})
            </h3>
            <p className="text-xs opacity-75 mt-0.5">
              Bloqueos operativos de ingreso aplicables únicamente a la comunidad seleccionada.
            </p>
          </div>
        </div>

        <AdminListToolbar
          searchValue={suspSearch}
          onSearchChange={(val) => {
            setSuspSearch(val);
            setSuspPage(1);
          }}
          searchPlaceholder="Buscar prestador, comunidad, rubro o motivo..."
          chips={[
            { id: 'all', label: 'Todas', count: suspCounts.all },
            { id: 'active', label: 'Activas', count: suspCounts.active },
            { id: 'lifted', label: 'Levantadas', count: suspCounts.lifted },
          ]}
          activeChip={suspStatusFilter}
          onChipChange={(chip) => {
            setSuspStatusFilter(chip);
            setSuspPage(1);
          }}
          hasActiveFilters={Boolean(suspSearch.trim() || suspStatusFilter !== 'all')}
          onResetFilters={() => {
            setSuspSearch('');
            setSuspStatusFilter('all');
            setSuspPage(1);
          }}
          actions={
            <>
              <button
                type="button"
                disabled={filteredSuspensions.length === 0}
                onClick={() =>
                  downloadCsv(
                    `trustlink-suspensiones-locales-${new Date().toISOString().slice(0, 10)}.csv`,
                    [
                      { key: 'id', label: 'ID' },
                      { key: 'country_name', label: 'Comunidad' },
                      {
                        key: 'provider',
                        label: 'Prestador',
                        format: (s) =>
                          `${s.provider_first_name || ''} ${s.provider_last_name || ''}`.trim(),
                      },
                      { key: 'specialty', label: 'Especialidad' },
                      { key: 'reason', label: 'Motivo' },
                      { key: 'status', label: 'Estado' },
                      { key: 'created_at', label: 'Fecha Registro' },
                      { key: 'lifted_at', label: 'Fecha Levantamiento' },
                    ],
                    filteredSuspensions
                  )
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-white/15 cursor-pointer hover:opacity-90 disabled:opacity-40"
                style={innerStyle}
              >
                <Download size={13} /> Exportar CSV
              </button>
              <button
                type="button"
                disabled={!hasAssignedCommunity}
                onClick={openSuspensionModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-sm cursor-pointer disabled:opacity-40"
              >
                <Plus size={14} /> Nueva suspensión local
              </button>
            </>
          }
          innerStyle={innerStyle}
        />

        {loading ? (
          <div
            className="text-center py-6 rounded-xl border border-white/10 text-xs"
            style={innerStyle}
          >
            Cargando registros...
          </div>
        ) : pagedSuspensions.pageItems.length === 0 ? (
          <div
            className="text-center py-8 px-4 rounded-xl border border-white/10 space-y-3"
            style={innerStyle}
          >
            <p className="text-xs opacity-80">
              {suspensions.length === 0
                ? 'No hay suspensiones ni reportes locales activos en esta comunidad.'
                : 'No hay suspensiones ni reportes locales para los filtros aplicados.'}
            </p>
            {suspensions.length === 0 && hasAssignedCommunity && (
              <button
                type="button"
                onClick={openSuspensionModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white cursor-pointer"
              >
                <Plus size={14} /> Registrar primera suspensión local
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10" style={innerStyle}>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 opacity-80">
                  <th className="py-2.5 px-3 font-semibold">ID</th>
                  <th className="py-2.5 px-3 font-semibold">Comunidad</th>
                  <th className="py-2.5 px-3 font-semibold">Prestador</th>
                  <th className="py-2.5 px-3 font-semibold">Motivo local</th>
                  <th className="py-2.5 px-3 font-semibold">Estado</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {pagedSuspensions.pageItems.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5">
                    <td className="py-2.5 px-3 font-mono">#{item.id}</td>
                    <td className="py-2.5 px-3 font-semibold">
                      {item.country_name || `Barrio #${item.country_id}`}
                    </td>
                    <td className="py-2.5 px-3">
                      {`${item.provider_first_name || ''} ${item.provider_last_name || ''}`.trim() ||
                        `Prestador #${item.provider_id}`}{' '}
                      <span className="opacity-75">({item.specialty || 'Prestador'})</span>
                    </td>
                    <td className="py-2.5 px-3">{item.reason}</td>
                    <td className="py-2.5 px-3">
                      {item.status === 'active' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950/80 text-amber-300 border border-amber-700">
                          Suspendido local
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-700">
                          Levantada
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {item.status === 'active' ? (
                        <button
                          type="button"
                          onClick={() => handleLiftSuspension(item.id)}
                          disabled={liftingId === item.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-white/15 text-emerald-300 cursor-pointer"
                          style={cardStyle}
                        >
                          <Unlock size={12} />
                          <span>{liftingId === item.id ? 'Levantando...' : 'Levantar'}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] opacity-60">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {suspensions.length > 0 && (
          <AdminPaginationBar
            page={pagedSuspensions.safePage}
            totalPages={pagedSuspensions.totalPages}
            totalItems={pagedSuspensions.totalItems}
            pageSize={suspPageSize}
            onPageChange={setSuspPage}
            onPageSizeChange={(nextSize) => {
              setSuspPageSize(nextSize);
              setSuspPage(1);
            }}
            itemLabel="registro(s)"
            innerStyle={innerStyle}
          />
        )}
      </section>

      {/* ==================== MODAL DE ALTA: NUEVA SUSPENSIÓN LOCAL ==================== */}
      {showSuspensionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="local-suspension-modal-title"
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-white/15 p-5 sm:p-6 shadow-2xl space-y-4"
            style={cardStyle}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="p-2.5 rounded-xl border border-white/15 text-amber-400 shrink-0"
                  style={innerStyle}
                >
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <h3 id="local-suspension-modal-title" className="text-base font-black">
                    Registrar reporte o suspensión local
                  </h3>
                  <p className="text-xs opacity-75 mt-0.5">
                    Bloquea temporalmente el ingreso en garita para esta comunidad.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSuspensionModal(false)}
                className="p-1.5 rounded-lg border border-white/15 opacity-75 hover:opacity-100 cursor-pointer"
                style={innerStyle}
                aria-label="Cerrar modal"
              >
                <X size={15} />
              </button>
            </div>

            {/* Aviso explícito de alcance multi-tenant */}
            <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border border-amber-700/60 bg-amber-950/35 text-amber-200 text-xs">
              <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
              <span>
                Esta suspensión solo bloquea el ingreso en{' '}
                <strong>{activeCommunity?.name || 'la comunidad seleccionada'}</strong> y no afecta
                el perfil global del prestador en otros barrios.
              </span>
            </div>

            <form onSubmit={handleCreateSuspension} className="space-y-4 text-xs">
              {isSuperadmin && (
                <div className="space-y-1.5">
                  <label className="block font-bold opacity-85">Comunidad</label>
                  <select
                    value={selectedCountryId}
                    onChange={(e) => setSelectedCountryId(e.target.value)}
                    required
                    className={`w-full px-3 cursor-pointer ${FIELD_INPUT_CLASS}`}
                    style={innerStyle}
                  >
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.id} · {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block font-bold opacity-85">Prestador a suspender</label>
                <select
                  value={selectedProviderId}
                  onChange={(e) => setSelectedProviderId(e.target.value)}
                  required
                  className={`w-full px-3 cursor-pointer ${FIELD_INPUT_CLASS}`}
                  style={innerStyle}
                >
                  <option value="">Seleccionar prestador...</option>
                  {providers.map((p) => (
                    <option key={p.provider_id} value={p.provider_id}>
                      {p.first_name} {p.last_name} ({p.specialty || 'Prestador'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block font-bold opacity-85">Motivo operativo local</label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_SUSPENSION_REASONS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setReason(preset)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors ${
                        reason === preset
                          ? 'bg-indigo-600 text-white border-indigo-400'
                          : 'border-white/15 opacity-80 hover:opacity-100'
                      }`}
                      style={reason === preset ? undefined : innerStyle}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={3}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describí el motivo operativo (ej: Incumplimiento normativo de obra en lote 15)"
                  className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs focus:outline-none resize-none"
                  style={innerStyle}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowSuspensionModal(false)}
                  className="px-4 py-2 rounded-xl border border-white/15 font-bold opacity-85 hover:opacity-100 cursor-pointer"
                  style={innerStyle}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedProviderId || !reason.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-45 cursor-pointer"
                >
                  <ShieldAlert size={14} />
                  {submitting ? 'Registrando...' : 'Confirmar suspensión local'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
