/**
 * @file AnalyticsDashboardView.jsx
 * @description Vista dedicada de Métricas y Analítica Comunitaria para `superadmin`.
 * Presenta 3 bloques ejecutivos filtrables por comunidad y período (`Histórico / 30 días / 7 días`):
 * 1) Adquisición (`initial_role`) vs. Identidad Activa Hoy (`can_use_resident` / `can_use_provider`) y cuentas duales.
 * 2) Embudo de Activación (salud de prestadores y residentes + ratio Demanda/Oferta).
 * 3) Conversión Operativa, ritmo de crecimiento 7d/30d y comparativa por comunidad paginada (`6/12/24/50`).
 * @location /trustlink-web/src/modules/admin/AnalyticsDashboardView.jsx
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3,
  Building2,
  Download,
  AlertCircle,
  ArrowRightLeft,
  Sparkles,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { useBranding, DEFAULT_BRANDING_CONFIG } from '../branding/BrandingContext';
import { API_BASE } from '../../config/api';
import { PAGE_SHELL_CLASS, SECTION_CARD_CLASS } from '../../config/uiTokens';
import { downloadCsv } from '../../utils/csvExport';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminListToolbar from '../../components/admin/AdminListToolbar';
import AdminPaginationBar from '../../components/admin/AdminPaginationBar';
import { paginateItems } from '../../utils/adminPagination';

/**
 * Calcula un porcentaje entero acotado entre 0 y 100 de forma segura ante denominadores en 0.
 *
 * @param {number} part - Numerador.
 * @param {number} total - Denominador.
 * @returns {number} Porcentaje entero (`0..100`).
 */
function safePct(part, total) {
  const num = Number(part || 0);
  const den = Number(total || 0);
  if (den <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((num / den) * 100)));
}

/**
 * Tablero ejecutivo de Métricas comunitarias y marketplace para `superadmin`.
 *
 * @param {Object} [props] - Propiedades opcionales.
 * @param {(viewId: string) => void} [props.onNavigate] - Navegación directa hacia `Usuarios` u otra vista.
 * @returns {JSX.Element} Vista dedicada de analítica.
 */
export default function AnalyticsDashboardView({ onNavigate } = {}) {
  const { brand } = useBranding();

  const cardStyle = {
    backgroundColor: brand.cardBgColor || DEFAULT_BRANDING_CONFIG.cardBgColor,
    color: brand.cardTextColor || DEFAULT_BRANDING_CONFIG.cardTextColor,
  };

  const innerStyle = {
    backgroundColor: brand.innerBgColor || DEFAULT_BRANDING_CONFIG.innerBgColor,
    color: brand.innerTextColor || DEFAULT_BRANDING_CONFIG.innerTextColor,
  };

  // Catálogo de comunidades, filtros globales y datos de analítica
  const [countries, setCountries] = useState([]);
  const [analyticsCountryId, setAnalyticsCountryId] = useState('all');
  const [analyticsPeriod, setAnalyticsPeriod] = useState('all');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');

  // Búsqueda y paginación estándar (6/12/24/50) para la tabla comparativa por comunidad
  const [commSearch, setCommSearch] = useState('');
  const [commPage, setCommPage] = useState(1);
  const [commPageSize, setCommPageSize] = useState(6);

  /**
   * Genera cabeceras autenticadas con el JWT vigente.
   *
   * @returns {{ Authorization: string }} Cabecera HTTP de autorización.
   */
  const getAuthHeaders = useCallback(
    () => ({
      Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
    }),
    []
  );

  /**
   * Carga las comunidades disponibles para el filtro superior.
   *
   * @returns {Promise<void>}
   */
  const fetchCountries = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/external/countries?page=1&limit=100`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.countries)) {
        setCountries(data.countries);
      }
    } catch (err) {
      console.warn('No se pudieron cargar comunidades:', err);
    }
  }, [getAuthHeaders]);

  /**
   * Consulta los 3 bloques de analítica al backend (`GET /api/v1/auth/users/analytics`).
   *
   * @param {string} [targetCountry=analyticsCountryId] - ID de comunidad o `'all'`.
   * @param {string} [targetPeriod=analyticsPeriod] - Ventana temporal (`'all'`, `'30d'`, `'7d'`).
   * @returns {Promise<void>}
   */
  const fetchAnalytics = useCallback(
    async (targetCountry = analyticsCountryId, targetPeriod = analyticsPeriod) => {
      setLoadingAnalytics(true);
      setAnalyticsError('');
      try {
        const params = new URLSearchParams();
        if (targetCountry && targetCountry !== 'all') {
          params.set('country_id', String(targetCountry));
        }
        if (targetPeriod && targetPeriod !== 'all') {
          params.set('period', targetPeriod);
        }
        const qs = params.toString();
        const res = await fetch(`${API_BASE}/api/v1/auth/users/analytics${qs ? `?${qs}` : ''}`, {
          headers: getAuthHeaders(),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setAnalyticsData(data);
        } else {
          setAnalyticsError(data.error || 'No se pudieron cargar las métricas.');
        }
      } catch (error) {
        console.error('Error al cargar analítica:', error);
        setAnalyticsError('Error de conexión con el servidor al calcular métricas.');
      } finally {
        setLoadingAnalytics(false);
      }
    },
    [analyticsCountryId, analyticsPeriod, getAuthHeaders]
  );

  useEffect(() => {
    fetchCountries();
  }, [fetchCountries]);

  useEffect(() => {
    fetchAnalytics(analyticsCountryId, analyticsPeriod);
  }, [analyticsCountryId, analyticsPeriod, fetchAnalytics]);

  const b1 = analyticsData?.block1_identity || null;
  const b2 = analyticsData?.block2_activation || null;
  const b3 = analyticsData?.block3_operations || null;

  // Etapas del embudo operativo (Bloque 3)
  const funnelSteps = useMemo(() => {
    if (!b3?.funnel) return [];
    const f = b3.funnel;
    return [
      { key: 'visits_requested', label: 'Visitas solicitadas', value: f.visits_requested, tone: 'text-sky-300' },
      { key: 'visits_confirmed', label: 'Acuerdos mutuos', value: f.visits_confirmed, tone: 'text-emerald-300' },
      { key: 'passes_emitted', label: 'Pases QR emitidos', value: f.passes_emitted, tone: 'text-indigo-300' },
      { key: 'passes_used_gate', label: 'Ingresos en garita', value: f.passes_used_gate, tone: 'text-teal-300' },
      {
        key: 'contracts_created',
        label: 'Órdenes de pago',
        value: f.contracts_created,
        sub: f.contracts_created > 0 ? `${f.contracts_completed} conformadas` : 'Sin órdenes',
        tone: 'text-amber-300',
      },
      { key: 'reviews_submitted', label: 'Reseñas emitidas', value: f.reviews_submitted, tone: 'text-purple-300' },
    ];
  }, [b3]);

  // Filtrado y paginación estándar de la tabla comparativa por comunidad
  const filteredCommunities = useMemo(() => {
    const list = Array.isArray(b3?.by_community) ? b3.by_community : [];
    const q = commSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((row) => String(row.country_name || '').toLowerCase().includes(q));
  }, [b3, commSearch]);

  const pagedCommunities = useMemo(
    () => paginateItems(filteredCommunities, commPage, commPageSize),
    [filteredCommunities, commPage, commPageSize]
  );

  /**
   * Exporta a CSV el desglose comunitario filtrado.
   */
  const handleExportCsv = () => {
    if (!filteredCommunities.length) return;
    downloadCsv(
      `trustlink-metricas-${analyticsPeriod}.csv`,
      [
        'Comunidad',
        'Total Usuarios',
        'Alta Residente',
        'Alta Prestador',
        'Residentes Hoy',
        'Prestadores Hoy',
        'Cuentas Duales',
        'Prestadores Aprobados',
      ],
      filteredCommunities.map((r) => [
        r.country_name,
        r.total_users,
        r.created_as_resident,
        r.created_as_provider,
        r.active_resident_today,
        r.active_provider_today,
        r.dual_accounts,
        r.approved_providers,
      ])
    );
  };

  return (
    <div className={`${PAGE_SHELL_CLASS} font-sans`}>
      <AdminPageHeader
        icon={<BarChart3 size={22} />}
        iconColorClass="text-indigo-300"
        title="Métricas"
        subtitle="Adquisición inmutable, identidad dual, salud del marketplace y conversión operativa."
        onRefresh={() => fetchAnalytics(analyticsCountryId, analyticsPeriod)}
        refreshing={loadingAnalytics}
        cardStyle={cardStyle}
        innerStyle={innerStyle}
      />

      {/* Barra global de contexto: Comunidad, Período y Exportación CSV */}
      <section
        className="border border-white/10 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3"
        style={cardStyle}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Building2 size={14} className="text-sky-400 shrink-0" />
            <label htmlFor="metrics-country-filter" className="font-semibold opacity-80">
              Comunidad:
            </label>
            <select
              id="metrics-country-filter"
              value={analyticsCountryId}
              onChange={(e) => setAnalyticsCountryId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-white/15 text-xs font-semibold cursor-pointer"
              style={innerStyle}
            >
              <option value="all">Todas las comunidades</option>
              {countries.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div
            className="inline-flex items-center p-0.5 rounded-xl border border-white/15 text-xs"
            style={innerStyle}
          >
            {[
              { id: 'all', label: 'Histórico' },
              { id: '30d', label: '30 días' },
              { id: '7d', label: '7 días' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAnalyticsPeriod(opt.id)}
                className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  analyticsPeriod === opt.id
                    ? 'bg-emerald-600 text-white'
                    : 'opacity-75 hover:opacity-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={filteredCommunities.length === 0}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/15 text-xs font-bold hover:opacity-90 cursor-pointer disabled:opacity-40"
          style={innerStyle}
        >
          <Download size={14} />
          <span>Exportar CSV</span>
        </button>
      </section>

      {analyticsError && (
        <div className="bg-rose-950/60 border border-rose-800 text-rose-200 p-4 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-400 shrink-0" />
          <span>{analyticsError}</span>
        </div>
      )}

      {loadingAnalytics && !analyticsData ? (
        <div
          className="p-10 rounded-2xl border border-white/10 text-center text-xs opacity-80"
          style={cardStyle}
        >
          Calculando métricas de comunidad e identidad dual...
        </div>
      ) : b1 && b2 && b3 ? (
        <>
          {/* BLOQUE 1: ADQUISICIÓN VS. IDENTIDAD ACTIVA HOY */}
          <section className={SECTION_CARD_CLASS} style={cardStyle}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-black flex items-center gap-2">
                  <ArrowRightLeft size={16} className="text-emerald-400 shrink-0" />
                  <span>1. Adquisición vs. Identidad Activa Hoy</span>
                </h3>
                <p className="text-xs opacity-75 mt-0.5">
                  Compara cómo crearon originalmente su cuenta frente a qué portales tienen habilitados actualmente.
                </p>
              </div>
              {typeof onNavigate === 'function' ? (
                <button
                  type="button"
                  onClick={() => onNavigate('users_master')}
                  className="text-[11px] font-bold px-3 py-1 rounded-full border border-white/15 self-start sm:self-auto hover:opacity-90 cursor-pointer"
                  style={innerStyle}
                >
                  {b1.total_community_users} usuario(s) de comunidad →
                </button>
              ) : (
                <span
                  className="text-[11px] font-bold px-3 py-1 rounded-full border border-white/15 self-start sm:self-auto"
                  style={innerStyle}
                >
                  {b1.total_community_users} usuario(s) de comunidad
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-xl border border-white/10 space-y-1" style={innerStyle}>
                <span className="text-[11px] font-semibold opacity-75">Creadas como Residente</span>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-black text-sky-300">{b1.created_as_resident}</span>
                  <span className="text-[11px] font-bold opacity-80">
                    {safePct(b1.created_as_resident, b1.total_community_users)}%
                  </span>
                </div>
                <p className="text-[11px] opacity-65">Origen inmutable de registro</p>
              </div>

              <div className="p-4 rounded-xl border border-white/10 space-y-1" style={innerStyle}>
                <span className="text-[11px] font-semibold opacity-75">Creadas como Prestador</span>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-black text-emerald-300">
                    {b1.created_as_provider}
                  </span>
                  <span className="text-[11px] font-bold opacity-80">
                    {safePct(b1.created_as_provider, b1.total_community_users)}%
                  </span>
                </div>
                <p className="text-[11px] opacity-65">Origen inmutable de registro</p>
              </div>

              <div className="p-4 rounded-xl border border-sky-500/25 space-y-1" style={innerStyle}>
                <span className="text-[11px] font-semibold opacity-75">Residentes activos hoy</span>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-black text-white">{b1.active_resident_today}</span>
                  <span className="text-[11px] font-bold text-sky-300">
                    {safePct(b1.active_resident_today, b1.total_community_users)}%
                  </span>
                </div>
                <p className="text-[11px] opacity-65">Sin importar cómo se registraron</p>
              </div>

              <div
                className="p-4 rounded-xl border border-emerald-500/25 space-y-1"
                style={innerStyle}
              >
                <span className="text-[11px] font-semibold opacity-75">
                  Prestadores activos hoy
                </span>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-black text-white">{b1.active_provider_today}</span>
                  <span className="text-[11px] font-bold text-emerald-300">
                    {safePct(b1.active_provider_today, b1.total_community_users)}%
                  </span>
                </div>
                <p className="text-[11px] opacity-65">Sin importar cómo se registraron</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div
                className="lg:col-span-7 p-4 rounded-xl border border-white/10 space-y-3"
                style={innerStyle}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold">Composición actual de portales</span>
                  <span className="opacity-70">{b1.total_community_users} cuentas</span>
                </div>

                <div className="h-3 w-full rounded-full overflow-hidden bg-black/35 flex">
                  {b1.total_community_users > 0 && (
                    <>
                      <div
                        className="bg-sky-500 transition-all"
                        style={{
                          width: `${safePct(b1.only_resident, b1.total_community_users)}%`,
                        }}
                      />
                      <div
                        className="bg-purple-500 transition-all"
                        style={{
                          width: `${safePct(b1.dual_accounts, b1.total_community_users)}%`,
                        }}
                      />
                      <div
                        className="bg-emerald-500 transition-all"
                        style={{
                          width: `${safePct(b1.only_provider, b1.total_community_users)}%`,
                        }}
                      />
                    </>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
                    <div>
                      <div className="font-bold">{b1.only_resident}</div>
                      <div className="text-[11px] opacity-70">Solo Residente</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
                    <div>
                      <div className="font-bold text-purple-300">{b1.dual_accounts}</div>
                      <div className="text-[11px] opacity-70">Cuentas Duales</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <div>
                      <div className="font-bold">{b1.only_provider}</div>
                      <div className="text-[11px] opacity-70">Solo Prestador</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                <div
                  className="p-3.5 rounded-xl border border-white/10 flex items-center justify-between gap-3"
                  style={innerStyle}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold">Residente → activó Prestador</div>
                    <p className="text-[11px] opacity-70">
                      Vecinos que empezaron a ofrecer servicios
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-base font-black text-purple-300">
                      {b1.resident_to_provider_count}
                    </div>
                    <div className="text-[11px] opacity-75">
                      {b1.resident_to_provider_pct}% del origen
                    </div>
                  </div>
                </div>

                <div
                  className="p-3.5 rounded-xl border border-white/10 flex items-center justify-between gap-3"
                  style={innerStyle}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold">Prestador → activó Residente</div>
                    <p className="text-[11px] opacity-70">
                      Prestadores que habilitaron portal residencial
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-base font-black text-sky-300">
                      {b1.provider_to_resident_count}
                    </div>
                    <div className="text-[11px] opacity-75">
                      {b1.provider_to_resident_pct}% del origen
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[11px] opacity-65">
              Nota: se excluyen {b1.privileged_accounts} cuenta(s) operativas internas (Superadmin, Admin Barrio y Garita) para no distorsionar los indicadores de la comunidad.
            </p>
          </section>

          {/* BLOQUE 2: EMBUDO DE ACTIVACIÓN */}
          <section className={SECTION_CARD_CLASS} style={cardStyle}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-black flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-300 shrink-0" />
                  <span>2. Embudo de Activación (Salud del Marketplace)</span>
                </h3>
                <p className="text-xs opacity-75 mt-0.5">
                  Proporción de prestadores y residentes que completan el onboarding y generan actividad real.
                </p>
              </div>

              <div
                className="px-3.5 py-2 rounded-xl border border-white/15 text-xs flex items-center gap-2 self-start sm:self-auto"
                style={innerStyle}
              >
                <span className="opacity-75">Ratio Demanda / Oferta:</span>
                <span className="font-black text-emerald-300">
                  {b2.residents_per_approved_provider !== null
                    ? `${b2.residents_per_approved_provider} : 1`
                    : 'Sin prestadores aprobados'}
                </span>
              </div>
            </div>

            {(b2.providers_pending_compliance > 0 || b2.providers_with_expired_docs > 0) && (
              <div className="rounded-xl p-3.5 border border-amber-500/35 bg-amber-950/30 text-amber-100 text-xs flex flex-wrap items-center gap-3">
                <AlertTriangle size={15} className="text-amber-400 shrink-0" />
                <span>
                  Atención operativa:{' '}
                  {b2.providers_pending_compliance > 0 && (
                    <strong>{b2.providers_pending_compliance} prestador(es) sin aprobar</strong>
                  )}
                  {b2.providers_pending_compliance > 0 && b2.providers_with_expired_docs > 0 && ' · '}
                  {b2.providers_with_expired_docs > 0 && (
                    <strong>{b2.providers_with_expired_docs} con documentación vencida</strong>
                  )}
                  .
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-white/10 space-y-3" style={innerStyle}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-300">Activación de Prestadores</span>
                  <span className="opacity-75">Base: {b2.providers_registered}</span>
                </div>
                {[
                  { label: 'Con portal prestador activo', value: b2.providers_registered, bar: 'bg-emerald-500' },
                  { label: 'Compliance aprobado (visibles)', value: b2.providers_approved, bar: 'bg-emerald-400' },
                  { label: 'Con agenda configurada', value: b2.providers_with_schedule, bar: 'bg-teal-400' },
                  { label: 'Con actividad (visita o Pase QR)', value: b2.providers_with_activity, bar: 'bg-sky-400' },
                  { label: 'Socios Verificados activos', value: b2.providers_verified_members, bar: 'bg-amber-400' },
                ].map((row) => {
                  const pct = safePct(row.value, b2.providers_registered);
                  return (
                    <div key={row.label} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="opacity-85">{row.label}</span>
                        <span className="font-bold">
                          {row.value} <span className="opacity-65 font-normal">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-black/35 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${row.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 rounded-xl border border-white/10 space-y-3" style={innerStyle}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-sky-300">Activación de Residentes</span>
                  <span className="opacity-75">Base: {b2.residents_registered}</span>
                </div>
                {[
                  { label: 'Con portal residente activo', value: b2.residents_registered, bar: 'bg-sky-500' },
                  { label: 'Con domicilio completo (Lote)', value: b2.residents_with_lot, bar: 'bg-sky-400' },
                  { label: 'Activos (≥1 visita o Pase QR)', value: b2.residents_active_ops, bar: 'bg-indigo-400' },
                ].map((row) => {
                  const pct = safePct(row.value, b2.residents_registered);
                  return (
                    <div key={row.label} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="opacity-85">{row.label}</span>
                        <span className="font-bold">
                          {row.value} <span className="opacity-65 font-normal">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-black/35 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${row.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

                <div className="pt-2 border-t border-white/10 text-[11px] opacity-75">
                  Los residentes con Lote cargado pueden coordinar visitas y emitir Pases QR en 1 clic sin volver a escribir su domicilio.
                </div>
              </div>
            </div>
          </section>

          {/* BLOQUE 3: CONVERSIÓN OPERATIVA, CRECIMIENTO Y COMPARATIVA POR COMUNIDAD */}
          <section className={SECTION_CARD_CLASS} style={cardStyle}>
            <div>
              <h3 className="text-sm sm:text-base font-black flex items-center gap-2">
                <TrendingUp size={16} className="text-sky-400 shrink-0" />
                <span>3. Conversión Operativa y Crecimiento</span>
              </h3>
              <p className="text-xs opacity-75 mt-0.5">
                Pulso del flujo completo desde la primera solicitud de visita hasta la reseña final y ritmo de altas recientes.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {funnelSteps.map((step, idx) => {
                const prevVal = idx > 0 ? funnelSteps[idx - 1].value : null;
                const stepRate = prevVal && prevVal > 0 ? safePct(step.value, prevVal) : null;
                return (
                  <div
                    key={step.key}
                    className="p-3.5 rounded-xl border border-white/10 flex flex-col justify-between gap-1.5"
                    style={innerStyle}
                  >
                    <span className="text-[11px] font-semibold opacity-75 leading-snug">
                      {idx + 1}. {step.label}
                    </span>
                    <div className={`text-xl font-black ${step.tone}`}>{step.value}</div>
                    <span className="text-[10px] opacity-65">
                      {step.sub
                        ? step.sub
                        : stepRate !== null
                        ? `${stepRate}% vs. paso ant.`
                        : 'Inicio del flujo'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div
                className="p-4 rounded-xl border border-white/10 flex items-center justify-between gap-4"
                style={innerStyle}
              >
                <div>
                  <span className="text-xs font-bold">Altas últimos 7 días</span>
                  <p className="text-[11px] opacity-70 mt-0.5">
                    {b3.growth.last_7d_residents} residente(s) · {b3.growth.last_7d_providers}{' '}
                    prestador(es)
                  </p>
                </div>
                <span className="text-2xl font-black text-emerald-300">
                  +{b3.growth.last_7d_total}
                </span>
              </div>

              <div
                className="p-4 rounded-xl border border-white/10 flex items-center justify-between gap-4"
                style={innerStyle}
              >
                <div>
                  <span className="text-xs font-bold">Altas últimos 30 días</span>
                  <p className="text-[11px] opacity-70 mt-0.5">
                    {b3.growth.last_30d_residents} residente(s) · {b3.growth.last_30d_providers}{' '}
                    prestador(es)
                  </p>
                </div>
                <span className="text-2xl font-black text-sky-300">
                  +{b3.growth.last_30d_total}
                </span>
              </div>
            </div>

            {/* Desglose por comunidad con buscador + paginación homologada (6/12/24/50) */}
            <div className="space-y-3 pt-2 border-t border-white/10">
              <h4 className="text-xs font-bold opacity-90">Desglose por comunidad</h4>

              <AdminListToolbar
                searchValue={commSearch}
                onSearchChange={(val) => {
                  setCommSearch(val);
                  setCommPage(1);
                }}
                searchPlaceholder="Buscar comunidad por nombre..."
                hasActiveFilters={Boolean(commSearch.trim())}
                onResetFilters={() => {
                  setCommSearch('');
                  setCommPage(1);
                }}
                innerStyle={innerStyle}
              />

              {pagedCommunities.pageItems.length === 0 ? (
                <div
                  className="p-6 rounded-xl border border-white/10 text-center text-xs opacity-75"
                  style={innerStyle}
                >
                  No se encontraron comunidades para el filtro actual.
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 overflow-x-auto" style={innerStyle}>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-[11px] opacity-75">
                        <th className="py-2.5 px-3 font-semibold">Comunidad</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Total</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Alta Res.</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Alta Prest.</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Res. hoy</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Prest. hoy</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Duales</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Aprobados</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {pagedCommunities.pageItems.map((row) => (
                        <tr key={row.country_id} className="hover:bg-white/5 transition-colors">
                          <td className="py-2.5 px-3 font-bold">{row.country_name}</td>
                          <td className="py-2.5 px-3 text-right font-bold">{row.total_users}</td>
                          <td className="py-2.5 px-3 text-right text-sky-300">
                            {row.created_as_resident}
                          </td>
                          <td className="py-2.5 px-3 text-right text-emerald-300">
                            {row.created_as_provider}
                          </td>
                          <td className="py-2.5 px-3 text-right">{row.active_resident_today}</td>
                          <td className="py-2.5 px-3 text-right">{row.active_provider_today}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-purple-300">
                            {row.dual_accounts}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-300">
                            {row.approved_providers}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <AdminPaginationBar
                page={pagedCommunities.safePage}
                totalPages={pagedCommunities.totalPages}
                totalItems={pagedCommunities.totalItems}
                pageSize={commPageSize}
                onPageChange={setCommPage}
                onPageSizeChange={(nextSize) => {
                  setCommPageSize(nextSize);
                  setCommPage(1);
                }}
                itemLabel="comunidad(es)"
                innerStyle={innerStyle}
              />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
