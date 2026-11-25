/**
 * @file LocalAdminView.jsx
 * @description Consola operativa para el rol 'admin' (administrador local de barrio/comunidad)
 * y supervisión de superadmin: permite consultar la licencia B2B local, gestionar reportes
 * y suspensiones locales, monitorear alertas de vencimiento documental con aviso por WhatsApp
 * y exportar listados a CSV, con aplicación explícita de Zona 4 y Zona 5 sin pisar Zona 3.
 * @location /trustlink-web/src/modules/admin/LocalAdminView.jsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Building2,
  Plus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Unlock,
  Clock,
  MessageCircle,
  Download,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useBranding, DEFAULT_BRANDING_CONFIG } from '../branding/BrandingContext';
import { API_BASE } from '../../config/api';
import { PAGE_SHELL_CLASS, SECTION_CARD_CLASS } from '../../config/uiTokens';
import { downloadCsv } from '../../utils/csvExport';

/**
 * Consola local de administración de comunidad/barrio.
 * Muestra el estado de la licencia B2B y cuota mensual de QR, habilita la creación y
 * levantamiento de suspensiones locales de prestadores y expone alertas preventivas de
 * vencimiento documental con recordatorio vía WhatsApp y exportación CSV.
 *
 * @param {Object} [props] - Propiedades opcionales del componente.
 * @param {boolean} [props.embedded=false] - Si es `true`, omite el contenedor de página y encabezado propio para integrarse como pestaña dentro de `CommunitiesAdminView`.
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

  // Datos cargados desde el backend: comunidades, prestadores, suspensiones, alertas documentales y licencia B2B
  const [countries, setCountries] = useState([]);
  const [providers, setProviders] = useState([]);
  const [suspensions, setSuspensions] = useState([]);
  const [expiryAlerts, setExpiryAlerts] = useState([]);
  const [expirySummary, setExpirySummary] = useState({ total: 0, expired: 0, expiring_soon: 0 });
  const [communityBilling, setCommunityBilling] = useState(null);

  // Estados del formulario de suspensión local y feedback de operaciones
  const [selectedCountryId, setSelectedCountryId] = useState(
    user?.country_id ? String(user.country_id) : '1'
  );
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [liftingId, setLiftingId] = useState(null);
  const [feedback, setFeedback] = useState(null);

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
          }

          if (loadedProviders.length > 0) {
            setSelectedProviderId((prev) => prev || String(loadedProviders[0].provider_id));
          }
        }
        // Actualiza alertas preventivas de documentación vencida o próxima a vencer
        if (alertsRes && alertsRes.ok) {
          const alertsData = await alertsRes.json();
          setExpiryAlerts(alertsData.alerts || []);
          setExpirySummary(
            alertsData.summary || { total: 0, expired: 0, expiring_soon: 0 }
          );
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
    const statusText =
      alert.severity === 'expired'
        ? `venció el ${alert.expiry_date}`
        : `vence en ${alert.days_remaining} día(s) (${alert.expiry_date})`;
    const text =
      `Hola ${alert.provider_name || ''}, te escribimos desde la Administración TrustLink: ` +
      `tu documentación "${alert.title}" ${statusText}. Por favor actualizala en tu Portal Prestador para mantener el ingreso habilitado en garita.`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  };

  // Carga inicial de datos locales según la comunidad asignada al usuario autenticado
  useEffect(() => {
    fetchLocalData(user?.country_id ? String(user.country_id) : '1');
  }, [fetchLocalData, user?.country_id]);

  /**
   * Registra un reporte o suspensión local de un prestador dentro de la comunidad seleccionada
   * y recarga el panel al confirmar la operación.
   *
   * @param {React.FormEvent<HTMLFormElement>} e - Evento de envío del formulario.
   * @returns {Promise<void>}
   */
  const handleCreateSuspension = async (e) => {
    e.preventDefault();
    if (!selectedProviderId || !reason.trim()) return;
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
          country_id: Number(selectedCountryId || 1),
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
        await fetchLocalData(selectedCountryId);
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

  return (
    <div className={embedded ? 'space-y-6 font-sans' : `${PAGE_SHELL_CLASS} font-sans`}>
      {/* Zona 4: Encabezado propio (solo en vista independiente del Admin Local) */}
      {!embedded && (
        <section
          className="border border-white/10 p-5 sm:p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm"
          style={cardStyle}
        >
          <div className="flex items-center gap-3">
            <div className="p-3 text-amber-400 rounded-xl border border-white/15" style={innerStyle}>
              <ShieldAlert size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Administración de Barrio</h2>
              <p className="text-xs opacity-80 mt-0.5">
                Reportes, suspensiones locales y alertas de vencimiento documental de la comunidad.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchLocalData(selectedCountryId)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-white/15 cursor-pointer hover:opacity-90"
            style={innerStyle}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </section>
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

      {/* Tarjeta de estado de Licencia B2B de la comunidad (solo lectura) */}
      {communityBilling && (
        <section
          className="border border-white/10 p-5 rounded-2xl space-y-3 text-xs"
          style={cardStyle}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl border border-white/15 text-emerald-400" style={innerStyle}>
                <Building2 size={16} />
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
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      communityBilling.billing_status === 'suspended'
                        ? 'bg-rose-950 text-rose-300 border-rose-800'
                        : communityBilling.billing_status === 'grace'
                        ? 'bg-amber-950 text-amber-300 border-amber-700'
                        : communityBilling.billing_status === 'trial'
                        ? 'bg-sky-950 text-sky-300 border-sky-800'
                        : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    }`}
                  >
                    {communityBilling.billing_status === 'suspended'
                      ? 'Suspendida'
                      : communityBilling.billing_status === 'grace'
                      ? 'Período de gracia'
                      : communityBilling.billing_status === 'trial'
                      ? 'Prueba'
                      : 'Activa'}
                  </span>
                </div>
                <p className="opacity-75 mt-0.5">
                  Claves API activas: <strong>{communityBilling.active_keys_count ?? 0}</strong>
                  {' · '}
                  Vigencia:{' '}
                  <strong>
                    {communityBilling.subscription_ends_at
                      ? new Date(communityBilling.subscription_ends_at).toLocaleDateString('es-AR')
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
                {communityBilling.monthly_qr_used ?? 0} /{' '}
                {communityBilling.monthly_pass_quota ? communityBilling.monthly_pass_quota : '∞'}
              </div>
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

      {/* Zona 4: Formulario de reporte / suspensión local */}
      <section
        className={SECTION_CARD_CLASS}
        style={cardStyle}
      >
        <div className="flex items-center gap-2">
          <Building2 size={17} className="text-sky-400" />
          <h3 className="text-sm font-bold">Registrar reporte o suspensión local</h3>
        </div>

        <form onSubmit={handleCreateSuspension} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Selector de comunidad exclusivo para supervisión del rol superadmin */}
          {isSuperadmin && (
            <div className="md:col-span-3">
              <select
                value={selectedCountryId}
                onChange={(e) => {
                  const nextCountry = e.target.value;
                  setSelectedCountryId(nextCountry);
                  fetchLocalData(nextCountry);
                }}
                className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
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

          <div className={isSuperadmin ? 'md:col-span-3' : 'md:col-span-4'}>
            <select
              value={selectedProviderId}
              onChange={(e) => setSelectedProviderId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
              style={innerStyle}
            >
              {providers.map((p) => (
                <option key={p.provider_id} value={p.provider_id}>
                  {p.first_name} {p.last_name} ({p.specialty || 'Prestador'})
                </option>
              ))}
            </select>
          </div>

          <div className={isSuperadmin ? 'md:col-span-4' : 'md:col-span-6'}>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo operativo local (ej: Incumplimiento normativo de obra)"
              className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
              style={innerStyle}
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting || !selectedProviderId || !reason.trim()}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50 cursor-pointer"
            >
              <Plus size={14} />
              {submitting ? 'Guardando...' : 'Suspender'}
            </button>
          </div>
        </form>
      </section>

      {/* Zona 4: Alertas proactivas de vencimiento documental */}
      <section
        className="border border-black/20 p-6 rounded-2xl space-y-4"
        style={cardStyle}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock size={17} className="text-amber-400" />
            <div>
              <h3 className="text-sm font-bold">
                Alertas de Vencimiento Documental (ART, Antecedentes, Seguros y Cuadrilla)
              </h3>
              <p className="text-[11px] opacity-75">
                Vencidos y próximos a vencer en los próximos 30 días para gestión preventiva.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
            <span className="px-2.5 py-1 rounded-full border border-rose-700/70 bg-rose-950/60 text-rose-200">
              {expirySummary.expired} vencido(s)
            </span>
            <span className="px-2.5 py-1 rounded-full border border-amber-700/70 bg-amber-950/60 text-amber-200">
              {expirySummary.expiring_soon} por vencer
            </span>
            {/* Botón de exportación CSV de alertas documentales */}
            {expiryAlerts.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  downloadCsv(
                    `trustlink-vencimientos-${new Date().toISOString().slice(0, 10)}.csv`,
                    [
                      { key: 'title', label: 'Documento' },
                      { key: 'provider_name', label: 'Prestador' },
                      { key: 'provider_email', label: 'Email' },
                      { key: 'severity', label: 'Severidad' },
                      { key: 'expiry_date', label: 'Fecha Vencimiento' },
                      { key: 'days_remaining', label: 'Dias Restantes' },
                    ],
                    expiryAlerts
                  )
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-white/15 cursor-pointer hover:opacity-90"
                style={innerStyle}
              >
                <Download size={12} /> CSV
              </button>
            )}
          </div>
        </div>

        {/* Estado vacío o grilla de hasta 10 alertas prioritarias con aviso por WhatsApp */}
        {expiryAlerts.length === 0 ? (
          <div
            className="text-center py-5 rounded-xl border border-black/20 text-xs opacity-80"
            style={innerStyle}
          >
            Toda la documentación con fecha cargada se encuentra vigente (+30 días).
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {expiryAlerts.slice(0, 10).map((alert) => {
              const isExpired = alert.severity === 'expired';
              return (
                <div
                  key={alert.id}
                  className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                    isExpired
                      ? 'border-rose-800/70 bg-rose-950/35'
                      : 'border-amber-800/70 bg-amber-950/30'
                  }`}
                >
                  <div className="min-w-0 space-y-0.5">
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
                          ? `Vencido (${Math.abs(alert.days_remaining)}d)`
                          : alert.days_remaining === 0
                          ? 'Vence hoy'
                          : `Vence en ${alert.days_remaining}d`}
                      </span>
                    </div>
                    <p className="text-[11px] opacity-80 truncate">
                      {alert.subtitle} · Fecha: {alert.expiry_date}
                    </p>
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
      </section>

      {/* Zona 4: Listado de suspensiones locales */}
      <section
        className="border border-black/20 p-6 rounded-2xl space-y-4"
        style={cardStyle}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold">
            Historial de reportes y suspensiones locales ({suspensions.length})
          </h3>
          {/* Botón de exportación CSV del historial de suspensiones locales */}
          {suspensions.length > 0 && (
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  `trustlink-suspensiones-locales-${new Date().toISOString().slice(0, 10)}.csv`,
                  [
                    { key: 'id', label: 'ID' },
                    { key: 'country_name', label: 'Comunidad' },
                    {
                      key: 'provider',
                      label: 'Prestador',
                      format: (s) => `${s.first_name || ''} ${s.last_name || ''}`.trim(),
                    },
                    { key: 'specialty', label: 'Especialidad' },
                    { key: 'reason', label: 'Motivo' },
                    { key: 'status', label: 'Estado' },
                    { key: 'created_at', label: 'Fecha Registro' },
                    { key: 'lifted_at', label: 'Fecha Levantamiento' },
                  ],
                  suspensions
                )
              }
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border border-white/15 cursor-pointer hover:opacity-90"
              style={innerStyle}
            >
              <Download size={12} /> Exportar CSV
            </button>
          )}
        </div>

        {/* Estados de carga, vacío o tabla interactiva de suspensiones locales */}
        {loading ? (
          <div
            className="text-center py-6 rounded-xl border border-black/20 text-xs"
            style={innerStyle}
          >
            Cargando registros...
          </div>
        ) : suspensions.length === 0 ? (
          <div
            className="text-center py-6 rounded-xl border border-black/20 text-xs opacity-80"
            style={innerStyle}
          >
            No hay suspensiones ni reportes locales registrados para esta comunidad.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-black/20" style={innerStyle}>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-black/20 opacity-80">
                  <th className="py-2.5 px-3 font-semibold">ID</th>
                  <th className="py-2.5 px-3 font-semibold">Comunidad</th>
                  <th className="py-2.5 px-3 font-semibold">Prestador</th>
                  <th className="py-2.5 px-3 font-semibold">Motivo local</th>
                  <th className="py-2.5 px-3 font-semibold">Estado</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/15">
                {suspensions.map((item) => (
                  <tr key={item.id} className="hover:bg-black/10">
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
                          suspendido local
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-700">
                          levantada
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
                        <span className="text-[11px] opacity-60">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}