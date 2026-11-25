/**
 * @file UserManagementView.jsx
 * @description Panel maestro de Usuarios, Analítica Comunitaria y Cuentas Privilegiadas para `superadmin`.
 * Organizado en dos pestañas claras:
 * 1) Métricas y Comunidad:
 *    - Bloque 1: Adquisición (`initial_role`) vs. Identidad Activa Hoy (`can_use_resident` / `can_use_provider`),
 *      cuentas duales y conversión cruzada (Residente <-> Prestador).
 *    - Bloque 2: Embudo de Activación (salud de prestadores y residentes + ratio demanda/oferta).
 *    - Bloque 3: Embudo operativo de visitas/QR/garita/contratos/reseñas, crecimiento 7d/30d y comparativa por barrio.
 * 2) Cuentas Privilegiadas:
 *    - Buscador, filtros por rol en español, listado a ancho completo, alta en modal con CTA contextual y edición completa.
 * @location /trustlink-web/src/modules/admin/UserManagementView.jsx
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldAlert,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Users,
  Edit3,
  X,
  BarChart3,
  RefreshCw,
  Download,
  Search,
  Building2,
  ArrowRightLeft,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Globe,
  Phone,
  Mail,
  IdCard,
} from 'lucide-react';
import { useBranding, DEFAULT_BRANDING_CONFIG } from '../branding/BrandingContext';
import { API_BASE } from '../../config/api';
import { downloadCsv } from '../../utils/csvExport';

/**
 * Metadatos visuales y etiquetas en español para roles privilegiados del sistema.
 */
const PRIVILEGED_ROLE_META = {
  superadmin: {
    label: 'Superadmin',
    fullLabel: 'Superadministrador Global',
    ctaLabel: 'Crear cuenta Superadmin',
    scopeHint: 'Acceso global a todas las comunidades, compliance, analítica y configuración.',
    badgeClass: 'bg-purple-950/90 text-purple-200 border-purple-700/70',
  },
  admin: {
    label: 'Admin Barrio',
    fullLabel: 'Administrador de Comunidad',
    ctaLabel: 'Crear Admin de Barrio',
    scopeHint: 'Gestiona alertas, suspensiones locales y licencia B2B del barrio asignado.',
    badgeClass: 'bg-sky-950/90 text-sky-200 border-sky-700/70',
  },
  security: {
    label: 'Garita / Seguridad',
    fullLabel: 'Operador de Garita / Seguridad',
    ctaLabel: 'Crear cuenta de Garita',
    scopeHint: 'Escanea y valida Pases QR de ingreso en tiempo real para la comunidad asignada.',
    badgeClass: 'bg-amber-950/90 text-amber-200 border-amber-700/70',
  },
};

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
 * Obtiene iniciales de 2 letras a partir de nombre y apellido para el avatar compacto.
 *
 * @param {string} firstName - Nombre del usuario.
 * @param {string} lastName - Apellido del usuario.
 * @returns {string} Iniciales en mayúsculas.
 */
function getInitials(firstName, lastName) {
  const f = String(firstName || '').trim().charAt(0);
  const l = String(lastName || '').trim().charAt(0);
  return `${f}${l}`.toUpperCase() || 'US';
}

/**
 * Consola maestra de Usuarios, Métricas de Comunidad y Gestión de Cuentas Privilegiadas.
 *
 * @returns {JSX.Element} Vista integral de analítica de usuarios y administración de accesos.
 */
export default function UserManagementView() {
  const { brand } = useBranding();

  // Estilos dinámicos White-Label: Zona 4 (tarjetas principales) y Zona 5 (cajas internas e inputs)
  const cardStyle = {
    backgroundColor: brand.cardBgColor || DEFAULT_BRANDING_CONFIG.cardBgColor,
    color: brand.cardTextColor || DEFAULT_BRANDING_CONFIG.cardTextColor,
  };

  const innerStyle = {
    backgroundColor: brand.innerBgColor || DEFAULT_BRANDING_CONFIG.innerBgColor,
    color: brand.innerTextColor || DEFAULT_BRANDING_CONFIG.innerTextColor,
  };

  // Pestaña activa del panel: analítica de comunidad por defecto o gestión de cuentas privilegiadas
  const [activeTab, setActiveTab] = useState('analytics');

  // Catálogo de comunidades activas compartido entre filtros de analítica y alta/edición de cuentas
  const [countries, setCountries] = useState([]);

  // Estado de Analítica Comunitaria (Bloques 1, 2 y 3)
  const [analyticsCountryId, setAnalyticsCountryId] = useState('all');
  const [analyticsPeriod, setAnalyticsPeriod] = useState('all');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');

  // Estado de Cuentas Privilegiadas (listado, filtros, modal de alta y modal de edición)
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Estado para el formulario modal de alta de cuenta privilegiada
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    dni: '',
    phone: '',
    email: '',
    password: '',
    role: 'admin',
    country_id: '',
  });

  // Estado para el modal de edición de cuenta privilegiada
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    dni: '',
    phone: '',
    email: '',
    password: '',
    role: 'admin',
    country_id: '',
    is_active: true,
  });

  /**
   * Genera cabeceras autenticadas con el JWT de sesión vigente.
   *
   * @returns {{ Authorization: string, 'Content-Type': string }} Cabeceras HTTP estándar.
   */
  const getAuthHeaders = useCallback(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
    }),
    []
  );

  /**
   * Carga el catálogo de comunidades/barrios disponibles para filtros y asignación de roles locales.
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
        if (data.countries.length > 0) {
          setFormData((prev) => ({
            ...prev,
            country_id: prev.country_id || String(data.countries[0].id),
          }));
        }
      }
    } catch (err) {
      console.warn('No se pudieron cargar comunidades:', err);
    }
  }, [getAuthHeaders]);

  /**
   * Consulta al backend los 3 bloques de analítica de usuarios, identidad dual y operación.
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
        const queryString = params.toString();
        const url = `${API_BASE}/api/v1/auth/users/analytics${queryString ? `?${queryString}` : ''}`;
        const res = await fetch(url, { headers: getAuthHeaders() });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setAnalyticsData(data);
        } else {
          setAnalyticsError(data.error || 'No se pudieron cargar las métricas de comunidad.');
        }
      } catch (error) {
        console.error('Error al cargar analítica de usuarios:', error);
        setAnalyticsError('Error de conexión con el servidor al calcular métricas.');
      } finally {
        setLoadingAnalytics(false);
      }
    },
    [analyticsCountryId, analyticsPeriod, getAuthHeaders]
  );

  /**
   * Consulta al backend el listado completo de cuentas privilegiadas (`superadmin`, `admin`, `security`).
   *
   * @returns {Promise<void>}
   */
  const fetchPrivilegedUsers = useCallback(async () => {
    setLoadingUsers(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/users/privileged`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setUsersList(Array.isArray(data.users) ? data.users : []);
      } else {
        setErrorMsg(data.error || 'No se pudieron cargar las cuentas privilegiadas.');
      }
    } catch (error) {
      console.error('Error al cargar usuarios privilegiados:', error);
      setErrorMsg('Error de conexión con el servidor backend de TrustLink.');
    } finally {
      setLoadingUsers(false);
    }
  }, [getAuthHeaders]);

  // Carga inicial de comunidades y cuentas privilegiadas al montar la vista
  useEffect(() => {
    fetchCountries();
    fetchPrivilegedUsers();
  }, [fetchCountries, fetchPrivilegedUsers]);

  // Recarga automática de métricas cuando cambian los filtros de comunidad o período
  useEffect(() => {
    fetchAnalytics(analyticsCountryId, analyticsPeriod);
  }, [analyticsCountryId, analyticsPeriod, fetchAnalytics]);

  // Contadores rápidos por rol privilegiado para los chips de filtro
  const roleCounts = useMemo(() => {
    return usersList.reduce(
      (acc, u) => {
        const r = String(u.role || '').toLowerCase();
        acc.all += 1;
        if (r === 'superadmin') acc.superadmin += 1;
        else if (r === 'admin') acc.admin += 1;
        else if (r === 'security') acc.security += 1;
        return acc;
      },
      { all: 0, superadmin: 0, admin: 0, security: 0 }
    );
  }, [usersList]);

  // Listado filtrado en vivo por rol y búsqueda de texto (nombre, correo, DNI o barrio)
  const filteredPrivilegedUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return usersList.filter((u) => {
      if (roleFilter !== 'all' && String(u.role || '').toLowerCase() !== roleFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = `${u.first_name || ''} ${u.last_name || ''} ${u.email || ''} ${u.dni || ''} ${
        u.country_name || ''
      }`.toLowerCase();
      return haystack.includes(q);
    });
  }, [usersList, roleFilter, searchTerm]);

  /**
   * Exporta a CSV el desglose comunitario de métricas actuales respetando los filtros aplicados.
   */
  const handleExportAnalyticsCsv = () => {
    if (!analyticsData) return;
    const rows = Array.isArray(analyticsData.block3_operations?.by_community)
      ? analyticsData.block3_operations.by_community
      : [];
    const headers = [
      'Comunidad',
      'Total Usuarios',
      'Alta Residente',
      'Alta Prestador',
      'Residentes Hoy',
      'Prestadores Hoy',
      'Cuentas Duales',
      'Prestadores Aprobados',
    ];
    const dataRows = rows.map((r) => [
      r.country_name,
      r.total_users,
      r.created_as_resident,
      r.created_as_provider,
      r.active_resident_today,
      r.active_provider_today,
      r.dual_accounts,
      r.approved_providers,
    ]);
    downloadCsv(`trustlink-metricas-usuarios-${analyticsPeriod}.csv`, headers, dataRows);
  };

  /**
   * Abre el modal de creación de cuenta privilegiada reiniciando el borrador con comunidad por defecto.
   */
  const openCreateModal = () => {
    setErrorMsg('');
    setSuccessMsg('');
    setFormData({
      first_name: '',
      last_name: '',
      dni: '',
      phone: '',
      email: '',
      password: '',
      role: 'admin',
      country_id: countries[0]?.id ? String(countries[0].id) : '',
    });
    setShowCreateModal(true);
  };

  /**
   * Envía el alta de una nueva cuenta privilegiada (`admin`, `security` o `superadmin`).
   *
   * @param {React.FormEvent<HTMLFormElement>} e - Evento de envío del formulario modal.
   * @returns {Promise<void>}
   */
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSavingUser(true);

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/users/privileged`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...formData,
          country_id:
            formData.role === 'superadmin'
              ? null
              : formData.country_id
              ? Number(formData.country_id)
              : null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        const meta = PRIVILEGED_ROLE_META[formData.role] || PRIVILEGED_ROLE_META.admin;
        setSuccessMsg(`Cuenta de ${meta.label} creada correctamente.`);
        setShowCreateModal(false);
        await Promise.all([fetchPrivilegedUsers(), fetchAnalytics()]);
      } else {
        setErrorMsg(data.error || 'No se pudo crear la cuenta privilegiada.');
      }
    } catch (error) {
      console.error('Error al crear usuario privilegiado:', error);
      setErrorMsg('Error de conexión con el servidor.');
    } finally {
      setSavingUser(false);
    }
  };

  /**
   * Abre el modal de edición precargando todos los datos actuales de la cuenta seleccionada.
   *
   * @param {Object} u - Cuenta privilegiada a editar.
   */
  const openEditModal = (u) => {
    setEditingUser(u);
    setEditForm({
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      dni: u.dni || '',
      phone: u.phone || '',
      email: u.email || '',
      password: '',
      role: u.role || 'admin',
      country_id: u.country_id ? String(u.country_id) : '',
      is_active: Boolean(u.is_active),
    });
    setErrorMsg('');
    setSuccessMsg('');
  };

  /**
   * Persiste los cambios de una cuenta privilegiada vía PATCH y refresca el listado.
   *
   * @param {React.FormEvent<HTMLFormElement>} e - Evento de envío del modal de edición.
   * @returns {Promise<void>}
   */
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingUser(true);
    setErrorMsg('');
    setSuccessMsg('');

    const payload = {
      first_name: editForm.first_name,
      last_name: editForm.last_name,
      dni: editForm.dni,
      phone: editForm.phone.trim() || null,
      email: editForm.email,
      role: editForm.role,
      country_id:
        editForm.role === 'superadmin'
          ? null
          : editForm.country_id
          ? Number(editForm.country_id)
          : null,
      is_active: editForm.is_active,
    };
    if (editForm.password.trim()) {
      payload.password = editForm.password.trim();
    }

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/users/privileged/${editingUser.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setSuccessMsg('Cuenta privilegiada actualizada correctamente.');
        setEditingUser(null);
        await fetchPrivilegedUsers();
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar la cuenta.');
      }
    } catch (error) {
      console.error('Error al actualizar cuenta privilegiada:', error);
      setErrorMsg('Error de conexión al actualizar.');
    } finally {
      setSavingUser(false);
    }
  };

  // Atajos seguros a los 3 bloques de analítica
  const b1 = analyticsData?.block1_identity || null;
  const b2 = analyticsData?.block2_activation || null;
  const b3 = analyticsData?.block3_operations || null;
  const createRoleMeta = PRIVILEGED_ROLE_META[formData.role] || PRIVILEGED_ROLE_META.admin;

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

  return (
    <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 md:py-8 space-y-6 font-sans">
      {/* Zona 4: Encabezado unificado con navegación interna por pestañas */}
      <section
        className="border border-white/10 p-5 sm:p-6 rounded-2xl shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        style={cardStyle}
      >
        <div className="flex items-center gap-3.5">
          <div
            className="p-3 rounded-xl border border-white/15 text-indigo-300 shrink-0"
            style={innerStyle}
          >
            {activeTab === 'analytics' ? <BarChart3 size={22} /> : <ShieldAlert size={22} />}
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Usuarios, Métricas y Accesos</h2>
            <p className="text-xs opacity-80 mt-0.5">
              Origen de altas, identidad dual, salud del marketplace y administración de roles operativos.
            </p>
          </div>
        </div>

        {/* Pestañas internas limpias + acción de refresco */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex items-center p-1 rounded-xl border border-white/15 gap-1"
            style={innerStyle}
          >
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'opacity-80 hover:opacity-100'
              }`}
            >
              <BarChart3 size={14} />
              <span>Métricas y Comunidad</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('privileged')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'privileged'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'opacity-80 hover:opacity-100'
              }`}
            >
              <ShieldAlert size={14} />
              <span>Cuentas Privilegiadas ({usersList.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              activeTab === 'analytics'
                ? fetchAnalytics(analyticsCountryId, analyticsPeriod)
                : fetchPrivilegedUsers()
            }
            disabled={loadingAnalytics || loadingUsers}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/15 text-xs font-bold hover:opacity-90 cursor-pointer disabled:opacity-50"
            style={innerStyle}
            title="Actualizar datos"
          >
            <RefreshCw
              size={14}
              className={loadingAnalytics || loadingUsers ? 'animate-spin' : ''}
            />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>
      </section>

      {/* ========================================================================
          PESTAÑA 1: MÉTRICAS Y COMUNIDAD (BLOQUES 1, 2 Y 3)
         ======================================================================== */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Barra de filtros contextuales: Comunidad, Período y Exportación CSV */}
          <section
            className="border border-white/10 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3"
            style={cardStyle}
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-xs">
                <Building2 size={14} className="text-sky-400 shrink-0" />
                <label htmlFor="analytics-country-filter" className="font-semibold opacity-80">
                  Comunidad:
                </label>
                <select
                  id="analytics-country-filter"
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

              {/* Selector segmentado de período */}
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
              onClick={handleExportAnalyticsCsv}
              disabled={!analyticsData}
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
              <section
                className="border border-white/10 p-5 sm:p-6 rounded-2xl space-y-5"
                style={cardStyle}
              >
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
                  <span
                    className="text-[11px] font-bold px-3 py-1 rounded-full border border-white/15 self-start sm:self-auto"
                    style={innerStyle}
                  >
                    {b1.total_community_users} usuario(s) de comunidad
                  </span>
                </div>

                {/* 4 KPIs principales tipográficos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div className="p-4 rounded-xl border border-white/10 space-y-1" style={innerStyle}>
                    <span className="text-[11px] font-semibold opacity-75">
                      Creadas como Residente
                    </span>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-2xl font-black text-sky-300">
                        {b1.created_as_resident}
                      </span>
                      <span className="text-[11px] font-bold opacity-80">
                        {safePct(b1.created_as_resident, b1.total_community_users)}%
                      </span>
                    </div>
                    <p className="text-[11px] opacity-65">Origen inmutable de registro</p>
                  </div>

                  <div className="p-4 rounded-xl border border-white/10 space-y-1" style={innerStyle}>
                    <span className="text-[11px] font-semibold opacity-75">
                      Creadas como Prestador
                    </span>
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
                    <span className="text-[11px] font-semibold opacity-75">
                      Residentes activos hoy
                    </span>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-2xl font-black text-white">
                        {b1.active_resident_today}
                      </span>
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
                      <span className="text-2xl font-black text-white">
                        {b1.active_provider_today}
                      </span>
                      <span className="text-[11px] font-bold text-emerald-300">
                        {safePct(b1.active_provider_today, b1.total_community_users)}%
                      </span>
                    </div>
                    <p className="text-[11px] opacity-65">Sin importar cómo se registraron</p>
                  </div>
                </div>

                {/* Barra de composición de identidad + Efecto red (conversión cruzada) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div
                    className="lg:col-span-7 p-4 rounded-xl border border-white/10 space-y-3"
                    style={innerStyle}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold">Composición actual de portales</span>
                      <span className="opacity-70">{b1.total_community_users} cuentas</span>
                    </div>

                    {/* Barra proporcional apilada */}
                    <div className="h-3 w-full rounded-full overflow-hidden bg-black/35 flex">
                      {b1.total_community_users > 0 ? (
                        <>
                          <div
                            className="bg-sky-500 transition-all"
                            style={{
                              width: `${safePct(b1.only_resident, b1.total_community_users)}%`,
                            }}
                            title={`Solo Residente: ${b1.only_resident}`}
                          />
                          <div
                            className="bg-purple-500 transition-all"
                            style={{
                              width: `${safePct(b1.dual_accounts, b1.total_community_users)}%`,
                            }}
                            title={`Cuentas Duales: ${b1.dual_accounts}`}
                          />
                          <div
                            className="bg-emerald-500 transition-all"
                            style={{
                              width: `${safePct(b1.only_provider, b1.total_community_users)}%`,
                            }}
                            title={`Solo Prestador: ${b1.only_provider}`}
                          />
                        </>
                      ) : null}
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

                  {/* Tarjetas de conversión cruzada (Identidad Dual) */}
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

              {/* BLOQUE 2: EMBUDO DE ACTIVACIÓN (SALUD DEL MARKETPLACE) */}
              <section
                className="border border-white/10 p-5 sm:p-6 rounded-2xl space-y-5"
                style={cardStyle}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-black flex items-center gap-2">
                      <Sparkles size={16} className="text-amber-300 shrink-0" />
                      <span>2. Embudo de Activación (Salud del Marketplace)</span>
                    </h3>
                    <p className="text-xs opacity-75 mt-0.5">
                      Mide qué proporción de prestadores y residentes completan el onboarding y generan actividad real.
                    </p>
                  </div>

                  {/* Ratio Demanda / Oferta */}
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

                {/* Alerta accionable si hay cuellos de botella en compliance */}
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
                  {/* Embudo de Prestadores */}
                  <div className="p-4 rounded-xl border border-white/10 space-y-3" style={innerStyle}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-300">Activación de Prestadores</span>
                      <span className="opacity-75">Base: {b2.providers_registered}</span>
                    </div>
                    {[
                      {
                        label: 'Con portal prestador activo',
                        value: b2.providers_registered,
                        bar: 'bg-emerald-500',
                      },
                      {
                        label: 'Compliance aprobado (visibles)',
                        value: b2.providers_approved,
                        bar: 'bg-emerald-400',
                      },
                      {
                        label: 'Con agenda configurada',
                        value: b2.providers_with_schedule,
                        bar: 'bg-teal-400',
                      },
                      {
                        label: 'Con actividad (visita o Pase QR)',
                        value: b2.providers_with_activity,
                        bar: 'bg-sky-400',
                      },
                      {
                        label: 'Socios Verificados activos',
                        value: b2.providers_verified_members,
                        bar: 'bg-amber-400',
                      },
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

                  {/* Embudo de Residentes */}
                  <div className="p-4 rounded-xl border border-white/10 space-y-3" style={innerStyle}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-sky-300">Activación de Residentes</span>
                      <span className="opacity-75">Base: {b2.residents_registered}</span>
                    </div>
                    {[
                      {
                        label: 'Con portal residente activo',
                        value: b2.residents_registered,
                        bar: 'bg-sky-500',
                      },
                      {
                        label: 'Con domicilio completo (Lote)',
                        value: b2.residents_with_lot,
                        bar: 'bg-sky-400',
                      },
                      {
                        label: 'Activos (≥1 visita o Pase QR)',
                        value: b2.residents_active_ops,
                        bar: 'bg-indigo-400',
                      },
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
              <section
                className="border border-white/10 p-5 sm:p-6 rounded-2xl space-y-5"
                style={cardStyle}
              >
                <div>
                  <h3 className="text-sm sm:text-base font-black flex items-center gap-2">
                    <TrendingUp size={16} className="text-sky-400 shrink-0" />
                    <span>3. Conversión Operativa y Crecimiento</span>
                  </h3>
                  <p className="text-xs opacity-75 mt-0.5">
                    Pulso del flujo completo desde la primera solicitud de visita hasta la reseña final y ritmo de altas recientes.
                  </p>
                </div>

                {/* Embudo horizontal de punta a punta */}
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

                {/* Ritmo de crecimiento reciente (7d y 30d) */}
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

                {/* Tabla comparativa por comunidad */}
                {Array.isArray(b3.by_community) && b3.by_community.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold opacity-85">Desglose por comunidad</h4>
                    <div
                      className="rounded-xl border border-white/10 overflow-x-auto"
                      style={innerStyle}
                    >
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
                          {b3.by_community.map((row) => (
                            <tr key={row.country_id} className="hover:bg-white/5 transition-colors">
                              <td className="py-2.5 px-3 font-bold">{row.country_name}</td>
                              <td className="py-2.5 px-3 text-right font-bold">{row.total_users}</td>
                              <td className="py-2.5 px-3 text-right text-sky-300">
                                {row.created_as_resident}
                              </td>
                              <td className="py-2.5 px-3 text-right text-emerald-300">
                                {row.created_as_provider}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {row.active_resident_today}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {row.active_provider_today}
                              </td>
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
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>
      )}

      {/* ========================================================================
          PESTAÑA 2: CUENTAS PRIVILEGIADAS (UX/UI REDISEÑADA — LISTADO ANCHO + MODALES)
         ======================================================================== */}
      {activeTab === 'privileged' && (
        <div className="space-y-4">
          {/* Banners de feedback operativo */}
          {errorMsg && (
            <div className="bg-rose-950/60 border border-rose-800 text-rose-200 p-4 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-950/60 border border-emerald-800 text-emerald-200 p-4 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Barra superior limpia: Buscador + Filtros por rol + CTA Nueva cuenta */}
          <section
            className="border border-white/10 p-4 sm:p-5 rounded-2xl space-y-4"
            style={cardStyle}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Buscador en vivo */}
              <div className="relative flex-1 max-w-md">
                <Search
                  size={14}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-60 pointer-events-none"
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nombre, correo, DNI o barrio..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-white/15 text-xs"
                  style={innerStyle}
                />
              </div>

              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer shrink-0 shadow-sm"
              >
                <UserPlus size={15} />
                <span>Nueva cuenta privilegiada</span>
              </button>
            </div>

            {/* Chips de filtro por rol en español */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {[
                { id: 'all', label: `Todos (${roleCounts.all})` },
                { id: 'superadmin', label: `Superadmin (${roleCounts.superadmin})` },
                { id: 'admin', label: `Admin Barrio (${roleCounts.admin})` },
                { id: 'security', label: `Garita / Seguridad (${roleCounts.security})` },
              ].map((chip) => {
                const active = roleFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setRoleFilter(chip.id)}
                    className={`px-3 py-1.5 rounded-xl border font-bold transition-colors cursor-pointer ${
                      active
                        ? 'bg-indigo-600 text-white border-indigo-400'
                        : 'border-white/15 opacity-80 hover:opacity-100'
                    }`}
                    style={active ? undefined : innerStyle}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {/* Grilla a ancho completo (2 columnas en desktop) de cuentas privilegiadas */}
            {loadingUsers && usersList.length === 0 ? (
              <div
                className="p-8 rounded-xl border border-white/10 text-center text-xs opacity-80"
                style={innerStyle}
              >
                Cargando cuentas privilegiadas...
              </div>
            ) : filteredPrivilegedUsers.length === 0 ? (
              <div
                className="p-8 rounded-xl border border-white/10 text-center text-xs opacity-80 space-y-2"
                style={innerStyle}
              >
                <Users size={22} className="mx-auto opacity-50" />
                <p>No se encontraron cuentas privilegiadas con los filtros actuales.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredPrivilegedUsers.map((u) => {
                  const roleKey = String(u.role || 'admin').toLowerCase();
                  const meta = PRIVILEGED_ROLE_META[roleKey] || PRIVILEGED_ROLE_META.admin;
                  const isSuper = roleKey === 'superadmin';
                  const missingCommunity = !isSuper && !u.country_name;

                  return (
                    <article
                      key={u.id}
                      className={`p-4 rounded-xl border flex flex-col justify-between gap-3 text-xs transition-colors ${
                        u.is_active ? 'border-white/10' : 'border-rose-900/60 opacity-75'
                      }`}
                      style={innerStyle}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className="w-9 h-9 rounded-xl border border-white/15 flex items-center justify-center font-black text-xs shrink-0"
                            style={cardStyle}
                          >
                            {getInitials(u.first_name, u.last_name)}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm truncate">
                                {u.first_name} {u.last_name}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${meta.badgeClass}`}
                              >
                                {meta.label}
                              </span>
                            </div>

                            {/* Alcance geográfico siempre explícito */}
                            <div className="flex items-center gap-1.5 text-[11px]">
                              {isSuper ? (
                                <span className="inline-flex items-center gap-1 text-purple-300 font-semibold">
                                  <Globe size={11} /> Alcance global (todas las comunidades)
                                </span>
                              ) : missingCommunity ? (
                                <span className="inline-flex items-center gap-1 text-amber-300 font-semibold">
                                  <AlertTriangle size={11} /> Sin barrio asignado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 opacity-85">
                                  <Building2 size={11} className="text-sky-400" /> {u.country_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border shrink-0 ${
                            u.is_active
                              ? 'bg-emerald-950/75 text-emerald-300 border-emerald-700/70'
                              : 'bg-rose-950/75 text-rose-300 border-rose-700/70'
                          }`}
                        >
                          {u.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>

                      {/* Datos de contacto y botón explícito de edición */}
                      <div className="pt-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                        <div className="space-y-0.5 min-w-0 opacity-80 text-[11px]">
                          <p className="flex items-center gap-1.5 truncate">
                            <Mail size={11} className="shrink-0 opacity-70" />
                            <span className="truncate">{u.email}</span>
                          </p>
                          <p className="flex items-center gap-3 flex-wrap">
                            <span className="inline-flex items-center gap-1">
                              <IdCard size={11} className="opacity-70" /> DNI: {u.dni || '—'}
                            </span>
                            {u.phone && (
                              <span className="inline-flex items-center gap-1">
                                <Phone size={11} className="opacity-70" /> {u.phone}
                              </span>
                            )}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => openEditModal(u)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15 font-bold text-xs hover:opacity-90 cursor-pointer shrink-0"
                          style={cardStyle}
                        >
                          <Edit3 size={12} />
                          <span>Editar</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ========================================================================
          MODAL: ALTA DE NUEVA CUENTA PRIVILEGIADA (CTA CONTEXTUAL + LABELS CLAROS)
         ======================================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div
            className="border border-white/15 w-full max-w-lg p-6 rounded-2xl relative space-y-4 text-xs max-h-[90vh] overflow-y-auto shadow-2xl"
            style={cardStyle}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-black flex items-center gap-2">
                <UserPlus size={18} className="text-emerald-400" />
                <span>Nueva cuenta privilegiada</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg border border-white/15 cursor-pointer hover:opacity-90"
                style={innerStyle}
                aria-label="Cerrar modal"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block font-semibold opacity-85 mb-1">Rol operativo</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs"
                  style={innerStyle}
                >
                  <option value="admin">Admin Barrio — Administrador de Comunidad</option>
                  <option value="security">Garita / Seguridad — Control de Accesos QR</option>
                  <option value="superadmin">Superadmin — Gobernanza Global</option>
                </select>
                <p className="text-[11px] opacity-70 mt-1">{createRoleMeta.scopeHint}</p>
              </div>

              {formData.role !== 'superadmin' && countries.length > 0 && (
                <div>
                  <label className="block font-semibold opacity-85 mb-1">Comunidad / Barrio</label>
                  <select
                    required
                    value={formData.country_id}
                    onChange={(e) => setFormData({ ...formData, country_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs"
                    style={innerStyle}
                  >
                    {countries.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        #{c.id} · {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold opacity-85 mb-1">Nombre</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    placeholder="Ej. Juan"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs"
                    style={innerStyle}
                  />
                </div>
                <div>
                  <label className="block font-semibold opacity-85 mb-1">Apellido</label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    placeholder="Ej. Pérez"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs"
                    style={innerStyle}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold opacity-85 mb-1">DNI</label>
                  <input
                    type="text"
                    required
                    value={formData.dni}
                    onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                    placeholder="40123456"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs"
                    style={innerStyle}
                  />
                </div>
                <div>
                  <label className="block font-semibold opacity-85 mb-1">Teléfono (opcional)</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Ej. +54 9 11 5555-1234"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs"
                    style={innerStyle}
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold opacity-85 mb-1">Correo electrónico</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="operador@comunidad.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs"
                  style={innerStyle}
                />
              </div>

              <div>
                <label className="block font-semibold opacity-85 mb-1">Contraseña temporal</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs"
                  style={innerStyle}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl font-bold border border-white/15 cursor-pointer"
                  style={innerStyle}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <UserPlus size={14} />
                  <span>{savingUser ? 'Creando...' : createRoleMeta.ctaLabel}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL: EDICIÓN DE CUENTA PRIVILEGIADA
         ======================================================================== */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div
            className="border border-white/15 w-full max-w-lg p-6 rounded-2xl relative space-y-4 text-xs max-h-[90vh] overflow-y-auto shadow-2xl"
            style={cardStyle}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-black">Editar cuenta privilegiada</h3>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1.5 rounded-lg border border-white/15 cursor-pointer hover:opacity-90"
                style={innerStyle}
                aria-label="Cerrar modal"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold opacity-85 mb-1">Nombre</label>
                  <input
                    type="text"
                    required
                    value={editForm.first_name}
                    onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                    style={innerStyle}
                  />
                </div>
                <div>
                  <label className="block font-semibold opacity-85 mb-1">Apellido</label>
                  <input
                    type="text"
                    required
                    value={editForm.last_name}
                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                    style={innerStyle}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold opacity-85 mb-1">DNI</label>
                  <input
                    type="text"
                    required
                    value={editForm.dni}
                    onChange={(e) => setEditForm({ ...editForm, dni: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                    style={innerStyle}
                  />
                </div>
                <div>
                  <label className="block font-semibold opacity-85 mb-1">Rol operativo</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                    style={innerStyle}
                  >
                    <option value="admin">Admin Barrio</option>
                    <option value="security">Garita / Seguridad</option>
                    <option value="superadmin">Superadmin Global</option>
                  </select>
                </div>
              </div>

              {editForm.role !== 'superadmin' && countries.length > 0 && (
                <div>
                  <label className="block font-semibold opacity-85 mb-1">Comunidad / Barrio</label>
                  <select
                    value={editForm.country_id}
                    onChange={(e) => setEditForm({ ...editForm, country_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                    style={innerStyle}
                  >
                    <option value="">Sin comunidad asignada</option>
                    {countries.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        #{c.id} · {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold opacity-85 mb-1">Correo electrónico</label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                    style={innerStyle}
                  />
                </div>
                <div>
                  <label className="block font-semibold opacity-85 mb-1">Teléfono (opcional)</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="Ej. +54 9 11 5555-1234"
                    className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                    style={innerStyle}
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold opacity-85 mb-1">
                  Nueva contraseña (opcional)
                </label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="Dejar en blanco para mantener la actual"
                  className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                  style={innerStyle}
                />
              </div>

              <label
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/10 cursor-pointer"
                style={innerStyle}
              >
                <div>
                  <span className="font-bold block">Estado de acceso</span>
                  <span className="text-[11px] opacity-70">
                    Desactivá para revocar el ingreso temporalmente sin eliminar el historial.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl font-bold border border-white/15 cursor-pointer"
                  style={innerStyle}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold cursor-pointer disabled:opacity-50"
                >
                  {savingUser ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
