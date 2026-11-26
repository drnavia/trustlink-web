/**
 * @file UserManagementView.jsx
 * @description Vista dedicada de Usuarios para `superadmin` (homologada con `AdminPageHeader`,
 * `AdminListToolbar` y `AdminPaginationBar` con escala única `6 / 12 / 24 / 50`):
 * 1) Cuentas Generales (Residentes, Prestadores y Duales): búsqueda, filtros por comunidad, origen de alta,
 *    estado y chips por perfil actual, exportación CSV, paginación remota y suspender/reactivar en 2 clics.
 * 2) Cuentas Privilegiadas (Superadmin, Admin Barrio y Garita/Seguridad): búsqueda, chips por rol en español,
 *    paginación homologada (`6 / 12 / 24 / 50`), alta en modal con CTA contextual y edición completa.
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
  Download,
  Building2,
  ArrowRight,
  AlertTriangle,
  Globe,
  Phone,
  Mail,
  IdCard,
  MapPin,
  ShieldCheck,
  UserX,
  UserCheck,
} from 'lucide-react';
import { useBranding, DEFAULT_BRANDING_CONFIG } from '../branding/BrandingContext';
import { API_BASE } from '../../config/api';
import { PAGE_SHELL_CLASS, SECTION_CARD_CLASS, FIELD_INPUT_CLASS } from '../../config/uiTokens';
import { downloadCsv } from '../../utils/csvExport';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminListToolbar from '../../components/admin/AdminListToolbar';
import AdminPaginationBar from '../../components/admin/AdminPaginationBar';
import { paginateItems } from '../../utils/adminPagination';

/** Metadatos visuales y etiquetas en español para roles privilegiados. */
const PRIVILEGED_ROLE_META = {
  superadmin: {
    label: 'Superadmin',
    ctaLabel: 'Crear cuenta Superadmin',
    scopeHint: 'Acceso global a todas las comunidades, compliance, analítica y configuración.',
    badgeClass: 'bg-purple-950/90 text-purple-200 border-purple-700/70',
  },
  admin: {
    label: 'Admin Barrio',
    ctaLabel: 'Crear Admin de Barrio',
    scopeHint: 'Gestiona alertas, suspensiones locales y licencia B2B del barrio asignado.',
    badgeClass: 'bg-sky-950/90 text-sky-200 border-sky-700/70',
  },
  security: {
    label: 'Garita / Seguridad',
    ctaLabel: 'Crear cuenta de Garita',
    scopeHint: 'Escanea y valida Pases QR de ingreso en tiempo real para la comunidad asignada.',
    badgeClass: 'bg-amber-950/90 text-amber-200 border-amber-700/70',
  },
};

/**
 * Obtiene iniciales de 2 letras a partir de nombre y apellido.
 *
 * @param {string} firstName - Nombre.
 * @param {string} lastName - Apellido.
 * @returns {string} Iniciales en mayúsculas.
 */
function getInitials(firstName, lastName) {
  const f = String(firstName || '').trim().charAt(0);
  const l = String(lastName || '').trim().charAt(0);
  return `${f}${l}`.toUpperCase() || 'US';
}

/**
 * Formatea una fecha corta `dd/mm/aaaa` en formato argentino.
 *
 * @param {string|null|undefined} raw - Fecha ISO o SQL.
 * @returns {string} Fecha legible o `'—'`.
 */
function formatShortDate(raw) {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Formatea la ubicación residencial de una cuenta comunitaria.
 *
 * @param {Object} u - Usuario comunitario.
 * @returns {string} Texto legible del domicilio o `'Sin lote cargado'`.
 */
function formatResidentialLocation(u) {
  if (!u?.lot_number) return 'Sin lote cargado';
  const areaPrefix =
    u.fraction_type === 'manzana'
      ? 'Manzana '
      : u.fraction_type === 'fraccion'
      ? 'Fracción '
      : '';
  const areaPart = u.fraction_number ? `${areaPrefix}${u.fraction_number} · ` : '';
  return `${areaPart}Lote ${u.lot_number}`;
}

/**
 * Directorio maestro de Usuarios (Cuentas Generales + Cuentas Privilegiadas).
 *
 * @returns {JSX.Element} Vista dedicada de administración de usuarios.
 */
export default function UserManagementView() {
  const { brand } = useBranding();

  const cardStyle = {
    backgroundColor: brand.cardBgColor || DEFAULT_BRANDING_CONFIG.cardBgColor,
    color: brand.cardTextColor || DEFAULT_BRANDING_CONFIG.cardTextColor,
  };

  const innerStyle = {
    backgroundColor: brand.innerBgColor || DEFAULT_BRANDING_CONFIG.innerBgColor,
    color: brand.innerTextColor || DEFAULT_BRANDING_CONFIG.innerTextColor,
  };

  // Pestaña activa: 'community' (Cuentas Generales) | 'privileged' (Cuentas Privilegiadas)
  const [activeTab, setActiveTab] = useState('community');
  const [countries, setCountries] = useState([]);

  // Estado de Cuentas Generales (paginación remota homologada 6 / 12 / 24 / 50)
  const [communityUsers, setCommunityUsers] = useState([]);
  const [communitySummary, setCommunitySummary] = useState({
    total: 0,
    only_resident: 0,
    only_provider: 0,
    dual: 0,
    inactive: 0,
  });
  const [communityPage, setCommunityPage] = useState(1);
  const [communityPageSize, setCommunityPageSize] = useState(6);
  const [communityTotalPages, setCommunityTotalPages] = useState(1);
  const [communityTotalFiltered, setCommunityTotalFiltered] = useState(0);
  const [communitySearch, setCommunitySearch] = useState('');
  const [communityCountryFilter, setCommunityCountryFilter] = useState('all');
  const [communityOriginFilter, setCommunityOriginFilter] = useState('all');
  const [communityProfileFilter, setCommunityProfileFilter] = useState('all');
  const [communityStatusFilter, setCommunityStatusFilter] = useState('all');
  const [loadingCommunityUsers, setLoadingCommunityUsers] = useState(false);
  const [communityFeedback, setCommunityFeedback] = useState({ type: '', text: '' });
  const [confirmToggleUserId, setConfirmToggleUserId] = useState(null);
  const [togglingUserId, setTogglingUserId] = useState(null);

  // Estado de Cuentas Privilegiadas (paginación homologada 6 / 12 / 24 / 50)
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [privStatusFilter, setPrivStatusFilter] = useState('all');
  const [privPage, setPrivPage] = useState(1);
  const [privPageSize, setPrivPageSize] = useState(6);
  const [showCreateModal, setShowCreateModal] = useState(false);

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
   * Genera cabeceras autenticadas con JWT vigente.
   *
   * @returns {{ Authorization: string, 'Content-Type': string }} Cabeceras HTTP.
   */
  const getAuthHeaders = useCallback(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
    }),
    []
  );

  /**
   * Carga comunidades activas para filtros y formularios.
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
   * Consulta el listado paginado de cuentas generales de la comunidad.
   *
   * @param {number} [pageToLoad=communityPage] - Página solicitada.
   * @param {number} [limitToLoad=communityPageSize] - Ítems por página (`6/12/24/50`).
   * @param {string} [searchOverride] - Texto opcional de búsqueda explícita.
   * @returns {Promise<void>}
   */
  const fetchCommunityUsers = useCallback(
    async (pageToLoad = communityPage, limitToLoad = communityPageSize, searchOverride = undefined) => {
      setLoadingCommunityUsers(true);
      try {
        const effectiveSearch = searchOverride !== undefined ? searchOverride : communitySearch;
        const params = new URLSearchParams({
          page: String(pageToLoad),
          limit: String(limitToLoad),
        });
        if (String(effectiveSearch || '').trim()) params.set('search', String(effectiveSearch).trim());
        if (communityCountryFilter !== 'all') params.set('country_id', communityCountryFilter);
        if (communityOriginFilter !== 'all') params.set('initial_origin', communityOriginFilter);
        if (communityProfileFilter !== 'all') params.set('current_profile', communityProfileFilter);
        if (communityStatusFilter !== 'all') params.set('status', communityStatusFilter);

        const res = await fetch(`${API_BASE}/api/v1/auth/users/community?${params.toString()}`, {
          headers: getAuthHeaders(),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setCommunityUsers(Array.isArray(data.users) ? data.users : []);
          if (data.summary) setCommunitySummary(data.summary);
          const pag = data.pagination || {};
          setCommunityPage(pag.page || pageToLoad);
          setCommunityTotalPages(pag.totalPages || 1);
          setCommunityTotalFiltered(pag.total ?? (data.users || []).length);
        } else {
          setCommunityFeedback({
            type: 'error',
            text: data.error || 'No se pudieron cargar las cuentas generales.',
          });
        }
      } catch (error) {
        console.error('Error al cargar cuentas generales:', error);
        setCommunityFeedback({
          type: 'error',
          text: 'Error de conexión al consultar las cuentas de comunidad.',
        });
      } finally {
        setLoadingCommunityUsers(false);
      }
    },
    [
      communityPage,
      communityPageSize,
      communitySearch,
      communityCountryFilter,
      communityOriginFilter,
      communityProfileFilter,
      communityStatusFilter,
      getAuthHeaders,
    ]
  );

  /**
   * Consulta el listado completo de cuentas privilegiadas.
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

  useEffect(() => {
    fetchCountries();
    fetchPrivilegedUsers();
  }, [fetchCountries, fetchPrivilegedUsers]);

  useEffect(() => {
    fetchCommunityUsers(1, communityPageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    communityCountryFilter,
    communityOriginFilter,
    communityProfileFilter,
    communityStatusFilter,
    communityPageSize,
  ]);

  // Contadores y paginación homologada para Cuentas Privilegiadas
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

  const filteredPrivilegedUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return usersList.filter((u) => {
      if (roleFilter !== 'all' && String(u.role || '').toLowerCase() !== roleFilter) return false;
      if (privStatusFilter === 'active' && !u.is_active) return false;
      if (privStatusFilter === 'inactive' && u.is_active) return false;
      if (!q) return true;
      const hay = `${u.first_name || ''} ${u.last_name || ''} ${u.email || ''} ${u.dni || ''} ${
        u.country_name || ''
      }`.toLowerCase();
      return hay.includes(q);
    });
  }, [usersList, roleFilter, privStatusFilter, searchTerm]);

  const pagedPrivileged = useMemo(
    () => paginateItems(filteredPrivilegedUsers, privPage, privPageSize),
    [filteredPrivilegedUsers, privPage, privPageSize]
  );

  /**
   * Valida manualmente el celular (SMS OTP) de un usuario comunitario (MVP N0).
   *
   * @param {Object} targetUser - Usuario comunitario.
   * @returns {Promise<void>}
   */
  const handleVerifyCommunityUserPhone = async (targetUser) => {
    setTogglingUserId(targetUser.id);
    setCommunityFeedback({ type: '', text: '' });
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/auth/users/community/${targetUser.id}/verify-phone`,
        {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify({ verified: true }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCommunityFeedback({
          type: 'success',
          text: data.message || 'Celular validado manualmente por Administración.',
        });
        await fetchCommunityUsers(communityPage, communityPageSize);
      } else {
        setCommunityFeedback({
          type: 'error',
          text: data.error || 'No se pudo validar el celular del usuario.',
        });
      }
    } catch (error) {
      console.error('Error al validar celular:', error);
      setCommunityFeedback({ type: 'error', text: 'Error de conexión al validar el celular.' });
    } finally {
      setTogglingUserId(null);
    }
  };

  /**
   * Suspende o reactiva de forma segura una cuenta comunitaria.
   *
   * @param {Object} targetUser - Usuario comunitario.
   * @returns {Promise<void>}
   */
  const handleToggleCommunityUser = async (targetUser) => {
    setTogglingUserId(targetUser.id);
    setCommunityFeedback({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/users/community/${targetUser.id}/toggle`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_active: !targetUser.is_active }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCommunityFeedback({
          type: 'success',
          text: data.message || (targetUser.is_active ? 'Cuenta suspendida.' : 'Cuenta reactivada.'),
        });
        setConfirmToggleUserId(null);
        await fetchCommunityUsers(communityPage, communityPageSize);
      } else {
        setCommunityFeedback({
          type: 'error',
          text: data.error || 'No se pudo actualizar el estado de la cuenta.',
        });
      }
    } catch (error) {
      console.error('Error al cambiar estado de cuenta comunitaria:', error);
      setCommunityFeedback({ type: 'error', text: 'Error de conexión al actualizar el estado.' });
    } finally {
      setTogglingUserId(null);
    }
  };

  /**
   * Exporta a CSV la página actual de Cuentas Generales.
   */
  const handleExportCommunityCsv = () => {
    downloadCsv(
      `trustlink-cuentas-generales-p${communityPage}.csv`,
      [
        'ID',
        'Nombre',
        'Apellido',
        'Correo',
        'DNI',
        'Teléfono',
        'Comunidad',
        'Domicilio',
        'Origen Alta',
        'Perfil Hoy',
        'Estado',
        'Fecha Alta',
      ],
      communityUsers.map((u) => [
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.dni || '',
        u.phone || '',
        u.country_name || '',
        formatResidentialLocation(u),
        u.initial_origin === 'provider' ? 'Prestador' : 'Residente',
        u.current_profile === 'dual'
          ? 'Cuenta Dual'
          : u.current_profile === 'only_provider'
          ? 'Solo Prestador'
          : 'Solo Residente',
        u.is_active ? 'Activo' : 'Suspendido',
        formatShortDate(u.created_at),
      ])
    );
  };

  /**
   * Exporta a CSV las Cuentas Privilegiadas filtradas.
   */
  const handleExportPrivilegedCsv = () => {
    downloadCsv(
      `trustlink-cuentas-privilegiadas-${new Date().toISOString().slice(0, 10)}.csv`,
      ['ID', 'Nombre', 'Apellido', 'Rol', 'Comunidad', 'Correo', 'DNI', 'Teléfono', 'Estado'],
      filteredPrivilegedUsers.map((u) => [
        u.id,
        u.first_name,
        u.last_name,
        PRIVILEGED_ROLE_META[String(u.role || '').toLowerCase()]?.label || u.role,
        u.role === 'superadmin' ? 'Alcance global' : u.country_name || 'Sin barrio asignado',
        u.email,
        u.dni || '',
        u.phone || '',
        u.is_active ? 'Activo' : 'Inactivo',
      ])
    );
  };

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
        await fetchPrivilegedUsers();
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
    if (editForm.password.trim()) payload.password = editForm.password.trim();

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

  const createRoleMeta = PRIVILEGED_ROLE_META[formData.role] || PRIVILEGED_ROLE_META.admin;
  const hasCommunityFilters = Boolean(
    communitySearch.trim() ||
      communityCountryFilter !== 'all' ||
      communityOriginFilter !== 'all' ||
      communityProfileFilter !== 'all' ||
      communityStatusFilter !== 'all'
  );
  const hasPrivFilters = Boolean(
    searchTerm.trim() || roleFilter !== 'all' || privStatusFilter !== 'all'
  );

  return (
    <div className={`${PAGE_SHELL_CLASS} font-sans`}>
      <AdminPageHeader
        icon={<Users size={22} />}
        iconColorClass="text-indigo-300"
        title="Usuarios"
        subtitle="Cuentas generales de comunidad y roles privilegiados."
        tabs={[
          {
            id: 'community',
            label: 'Cuentas Generales',
            icon: <Users size={14} />,
            count: communitySummary.total,
          },
          {
            id: 'privileged',
            label: 'Cuentas Privilegiadas',
            icon: <ShieldAlert size={14} />,
            count: usersList.length,
          },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onRefresh={() =>
          activeTab === 'community'
            ? fetchCommunityUsers(communityPage, communityPageSize)
            : fetchPrivilegedUsers()
        }
        refreshing={activeTab === 'community' ? loadingCommunityUsers : loadingUsers}
        cardStyle={cardStyle}
        innerStyle={innerStyle}
      />

      {/* ==================== PESTAÑA 1: CUENTAS GENERALES ==================== */}
      {activeTab === 'community' && (
        <section className={SECTION_CARD_CLASS} style={cardStyle}>
          {communityFeedback.text && (
            <div
              className={`p-3.5 rounded-xl text-xs border flex items-center gap-2 ${
                communityFeedback.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-800 text-rose-200'
              }`}
            >
              {communityFeedback.type === 'success' ? (
                <CheckCircle2 size={15} className="shrink-0" />
              ) : (
                <AlertCircle size={15} className="shrink-0" />
              )}
              <span>{communityFeedback.text}</span>
            </div>
          )}

          <AdminListToolbar
            searchValue={communitySearch}
            onSearchChange={setCommunitySearch}
            onSearchSubmit={(overrideVal) =>
              fetchCommunityUsers(1, communityPageSize, overrideVal)
            }
            searchPlaceholder="Buscar nombre, correo, DNI, lote o barrio..."
            showSubmitButton
            filters={
              <>
                <select
                  value={communityCountryFilter}
                  onChange={(e) => setCommunityCountryFilter(e.target.value)}
                  className={FIELD_INPUT_CLASS}
                  style={innerStyle}
                  aria-label="Filtrar por comunidad"
                >
                  <option value="all">Todas las comunidades</option>
                  {countries.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={communityOriginFilter}
                  onChange={(e) => setCommunityOriginFilter(e.target.value)}
                  className={FIELD_INPUT_CLASS}
                  style={innerStyle}
                  aria-label="Filtrar por origen de alta"
                >
                  <option value="all">Origen: Todos</option>
                  <option value="resident">Alta como Residente</option>
                  <option value="provider">Alta como Prestador</option>
                </select>
                <select
                  value={communityStatusFilter}
                  onChange={(e) => setCommunityStatusFilter(e.target.value)}
                  className={FIELD_INPUT_CLASS}
                  style={innerStyle}
                  aria-label="Filtrar por estado"
                >
                  <option value="all">Estado: Todos</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Suspendidos</option>
                </select>
              </>
            }
            chips={[
              { id: 'all', label: 'Todos', count: communitySummary.total },
              { id: 'only_resident', label: 'Solo Residente', count: communitySummary.only_resident },
              { id: 'dual', label: 'Cuentas Duales', count: communitySummary.dual },
              { id: 'only_provider', label: 'Solo Prestador', count: communitySummary.only_provider },
            ]}
            activeChip={communityProfileFilter}
            onChipChange={setCommunityProfileFilter}
            hasActiveFilters={hasCommunityFilters}
            onResetFilters={() => {
              setCommunitySearch('');
              setCommunityCountryFilter('all');
              setCommunityOriginFilter('all');
              setCommunityProfileFilter('all');
              setCommunityStatusFilter('all');
              fetchCommunityUsers(1, communityPageSize, '');
            }}
            actions={
              <button
                type="button"
                onClick={handleExportCommunityCsv}
                disabled={communityUsers.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/15 font-bold hover:opacity-90 cursor-pointer disabled:opacity-40"
                style={innerStyle}
              >
                <Download size={13} />
                <span>Exportar CSV</span>
              </button>
            }
            innerStyle={innerStyle}
          />

          {loadingCommunityUsers && communityUsers.length === 0 ? (
            <div
              className="p-8 rounded-xl border border-white/10 text-center text-xs opacity-80"
              style={innerStyle}
            >
              Cargando cuentas generales...
            </div>
          ) : communityUsers.length === 0 ? (
            <div
              className="p-8 rounded-xl border border-white/10 text-center text-xs opacity-80 space-y-2"
              style={innerStyle}
            >
              <Users size={22} className="mx-auto opacity-50" />
              <p>No se encontraron cuentas generales con los filtros aplicados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              {communityUsers.map((u) => {
                const isDual = u.current_profile === 'dual';
                const isOnlyProv = u.current_profile === 'only_provider';
                const originLabel =
                  u.initial_origin === 'provider' ? 'Alta: Prestador' : 'Alta: Residente';
                const todayLabel = isDual
                  ? 'Hoy: Cuenta Dual'
                  : isOnlyProv
                  ? 'Hoy: Prestador'
                  : 'Hoy: Residente';
                const todayCls = isDual
                  ? 'bg-purple-950/90 text-purple-200 border-purple-700/70'
                  : isOnlyProv
                  ? 'bg-emerald-950/90 text-emerald-200 border-emerald-700/70'
                  : 'bg-sky-950/90 text-sky-200 border-sky-700/70';
                const isConfirming = confirmToggleUserId === u.id;

                return (
                  <article
                    key={u.id}
                    className={`p-4 rounded-xl border flex flex-col justify-between gap-3 text-xs ${
                      u.is_active ? 'border-white/10' : 'border-rose-900/60 opacity-75'
                    }`}
                    style={innerStyle}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className="w-9 h-9 rounded-xl border border-white/15 flex items-center justify-center font-black text-xs shrink-0"
                            style={cardStyle}
                          >
                            {getInitials(u.first_name, u.last_name)}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-sm truncate">
                                {u.first_name} {u.last_name}
                              </span>
                              {u.provider_approved && (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/60"
                                  title="Compliance aprobado como prestador"
                                >
                                  <ShieldCheck size={10} /> Verificado
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                              <span
                                className="px-2 py-0.5 rounded-md border border-white/15 font-semibold opacity-85"
                                style={cardStyle}
                              >
                                {originLabel}
                              </span>
                              <ArrowRight size={11} className="opacity-55 shrink-0" />
                              <span className={`px-2 py-0.5 rounded-full border font-bold ${todayCls}`}>
                                {todayLabel}
                              </span>
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
                          {u.is_active ? 'Activo' : 'Suspendido'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] opacity-85">
                        <span className="inline-flex items-center gap-1">
                          <Building2 size={11} className="text-sky-400 shrink-0" />
                          {u.country_name || 'Sin comunidad'}
                        </span>
                        {u.can_use_resident && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={11} className="text-emerald-400 shrink-0" />
                            {formatResidentialLocation(u)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-0.5 min-w-0 opacity-80 text-[11px]">
                        <p className="flex items-center gap-1.5 truncate">
                          <Mail size={11} className="shrink-0 opacity-70" />
                          <span className="truncate">{u.email}</span>
                        </p>
                        <p className="flex items-center gap-2.5 flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <IdCard size={11} className="opacity-70" /> DNI: {u.dni || '—'}
                          </span>
                          {u.phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone size={11} className="opacity-70" /> {u.phone}
                              {u.phone_verified === false && (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold border border-amber-500/50 bg-amber-950/60 text-amber-200">
                                  SMS pendiente
                                </span>
                              )}
                            </span>
                          )}
                          <span className="opacity-65">Alta: {formatShortDate(u.created_at)}</span>
                        </p>
                      </div>

                      <div className="inline-flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        {u.phone_verified === false && (
                          <button
                            type="button"
                            disabled={togglingUserId === u.id}
                            onClick={() => handleVerifyCommunityUserPhone(u, true)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-emerald-500/55 bg-emerald-950/50 text-emerald-200 hover:bg-emerald-950/80 font-bold text-xs cursor-pointer disabled:opacity-50"
                            title="Validar manualmente el celular (Nivel 0 MVP)"
                          >
                            <Phone size={12} /> <span>Validar SMS</span>
                          </button>
                        )}
                      {isConfirming ? (
                        <div className="inline-flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={togglingUserId === u.id}
                            onClick={() => handleToggleCommunityUser(u)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-white cursor-pointer disabled:opacity-50 ${
                              u.is_active
                                ? 'bg-rose-600 hover:bg-rose-500'
                                : 'bg-emerald-600 hover:bg-emerald-500'
                            }`}
                          >
                            {togglingUserId === u.id
                              ? '...'
                              : u.is_active
                              ? 'Confirmar'
                              : 'Reactivar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmToggleUserId(null)}
                            className="px-2 py-1.5 rounded-lg text-[11px] border border-white/15 cursor-pointer"
                            style={cardStyle}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmToggleUserId(u.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold text-xs cursor-pointer shrink-0 ${
                            u.is_active
                              ? 'border-white/15 hover:border-rose-500/50 hover:text-rose-200'
                              : 'border-emerald-600/60 bg-emerald-950/40 text-emerald-200 hover:bg-emerald-950/70'
                          }`}
                          style={u.is_active ? cardStyle : undefined}
                        >
                          {u.is_active ? (
                            <>
                              <UserX size={12} /> <span>Suspender</span>
                            </>
                          ) : (
                            <>
                              <UserCheck size={12} /> <span>Reactivar</span>
                            </>
                          )}
                        </button>
                      )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <AdminPaginationBar
            page={communityPage}
            totalPages={communityTotalPages}
            totalItems={communityTotalFiltered}
            pageSize={communityPageSize}
            onPageChange={(nextPage) => fetchCommunityUsers(nextPage, communityPageSize)}
            onPageSizeChange={(nextSize) => {
              setCommunityPageSize(nextSize);
              setCommunityPage(1);
            }}
            loading={loadingCommunityUsers}
            itemLabel="cuenta(s)"
            innerStyle={innerStyle}
          />
        </section>
      )}

      {/* ==================== PESTAÑA 2: CUENTAS PRIVILEGIADAS ==================== */}
      {activeTab === 'privileged' && (
        <section className={SECTION_CARD_CLASS} style={cardStyle}>
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

          <AdminListToolbar
            searchValue={searchTerm}
            onSearchChange={(val) => {
              setSearchTerm(val);
              setPrivPage(1);
            }}
            searchPlaceholder="Buscar por nombre, correo, DNI o barrio..."
            filters={
              <select
                value={privStatusFilter}
                onChange={(e) => {
                  setPrivStatusFilter(e.target.value);
                  setPrivPage(1);
                }}
                className={FIELD_INPUT_CLASS}
                style={innerStyle}
                aria-label="Filtrar por estado"
              >
                <option value="all">Estado: Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
            }
            chips={[
              { id: 'all', label: 'Todos', count: roleCounts.all },
              { id: 'superadmin', label: 'Superadmin', count: roleCounts.superadmin },
              { id: 'admin', label: 'Admin Barrio', count: roleCounts.admin },
              { id: 'security', label: 'Garita / Seguridad', count: roleCounts.security },
            ]}
            activeChip={roleFilter}
            onChipChange={(chip) => {
              setRoleFilter(chip);
              setPrivPage(1);
            }}
            hasActiveFilters={hasPrivFilters}
            onResetFilters={() => {
              setSearchTerm('');
              setRoleFilter('all');
              setPrivStatusFilter('all');
              setPrivPage(1);
            }}
            actions={
              <>
                <button
                  type="button"
                  onClick={handleExportPrivilegedCsv}
                  disabled={filteredPrivilegedUsers.length === 0}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/15 font-bold hover:opacity-90 cursor-pointer disabled:opacity-40"
                  style={innerStyle}
                >
                  <Download size={13} />
                  <span>Exportar CSV</span>
                </button>
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-sm"
                >
                  <UserPlus size={14} />
                  <span>Nueva cuenta privilegiada</span>
                </button>
              </>
            }
            innerStyle={innerStyle}
          />

          {loadingUsers && usersList.length === 0 ? (
            <div
              className="p-8 rounded-xl border border-white/10 text-center text-xs opacity-80"
              style={innerStyle}
            >
              Cargando cuentas privilegiadas...
            </div>
          ) : pagedPrivileged.pageItems.length === 0 ? (
            <div
              className="p-8 rounded-xl border border-white/10 text-center text-xs opacity-80 space-y-2"
              style={innerStyle}
            >
              <Users size={22} className="mx-auto opacity-50" />
              <p>No se encontraron cuentas privilegiadas con los filtros actuales.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {pagedPrivileged.pageItems.map((u) => {
                const roleKey = String(u.role || 'admin').toLowerCase();
                const meta = PRIVILEGED_ROLE_META[roleKey] || PRIVILEGED_ROLE_META.admin;
                const isSuper = roleKey === 'superadmin';
                const missingCommunity = !isSuper && !u.country_name;

                return (
                  <article
                    key={u.id}
                    className={`p-4 rounded-xl border flex flex-col justify-between gap-3 text-xs ${
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

          <AdminPaginationBar
            page={pagedPrivileged.safePage}
            totalPages={pagedPrivileged.totalPages}
            totalItems={pagedPrivileged.totalItems}
            pageSize={privPageSize}
            onPageChange={setPrivPage}
            onPageSizeChange={(nextSize) => {
              setPrivPageSize(nextSize);
              setPrivPage(1);
            }}
            itemLabel="cuenta(s)"
            innerStyle={innerStyle}
          />
        </section>
      )}

      {/* MODAL: ALTA DE NUEVA CUENTA PRIVILEGIADA */}
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
                  className={`w-full ${FIELD_INPUT_CLASS}`}
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
                    className={`w-full ${FIELD_INPUT_CLASS}`}
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
                    className={`w-full ${FIELD_INPUT_CLASS}`}
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
                    className={`w-full ${FIELD_INPUT_CLASS}`}
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
                    className={`w-full ${FIELD_INPUT_CLASS}`}
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
                    className={`w-full ${FIELD_INPUT_CLASS}`}
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
                  className={`w-full ${FIELD_INPUT_CLASS}`}
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
                  className={`w-full ${FIELD_INPUT_CLASS}`}
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

      {/* MODAL: EDICIÓN DE CUENTA PRIVILEGIADA */}
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
                    className={`w-full ${FIELD_INPUT_CLASS}`}
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
                    className={`w-full ${FIELD_INPUT_CLASS}`}
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
                    className={`w-full ${FIELD_INPUT_CLASS}`}
                    style={innerStyle}
                  />
                </div>
                <div>
                  <label className="block font-semibold opacity-85 mb-1">Rol operativo</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className={`w-full ${FIELD_INPUT_CLASS}`}
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
                    className={`w-full ${FIELD_INPUT_CLASS}`}
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
                    className={`w-full ${FIELD_INPUT_CLASS}`}
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
                    className={`w-full ${FIELD_INPUT_CLASS}`}
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
                  className={`w-full ${FIELD_INPUT_CLASS}`}
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
