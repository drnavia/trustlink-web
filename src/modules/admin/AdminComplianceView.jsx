/**
 * @file AdminComplianceView.jsx
 * @description Panel centralizado de Operaciones TrustLink para auditar prestadores y mediar
 * reclamos post-servicio, con diseño agrupado por persona (`user_id`):
 * - Agrupa múltiples especialidades bajo una sola identidad (evita duplicar DNI/email/membresía).
 * - Muestra semáforo de vigencia y fecha de vencimiento de Antecedentes Penales y Póliza ART.
 * - Jerarquía visual limpia: acción primaria `Aprobar`, `Aprobar todas` en lote, `Rechazar/Revocar`
 *   discreto con confirmación en 2 clics y gestión única de membresía "Socio Verificado" por persona.
 * - Dos pestañas superiores (`Auditoría de Prestadores` | `Reclamos y Garantía`) y selector de vista
 *   entre tarjetas agrupadas y tabla compacta para escalar a grandes nóminas.
 * Respeta Zona 4 (tarjetas principales) y Zona 5 (cajas internas) de `BrandingContext`.
 * @location /trustlink-web/src/modules/admin/AdminComplianceView.jsx
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  FileText,
  UserCheck,
  AlertCircle,
  RefreshCw,
  Search,
  X,
  Award,
  LayoutGrid,
  List,
  CheckCheck,
  Calendar,
} from 'lucide-react';
import { useBranding, DEFAULT_BRANDING_CONFIG } from '../branding/BrandingContext';
import { API_BASE } from '../../config/api';
import {
  PAGE_SHELL_CLASS,
  SECTION_CARD_CLASS,
  ITEMS_GRID_CLASS,
  FIELD_INPUT_CLASS,
  getUnifiedStatusMeta,
} from '../../config/uiTokens';

/**
 * Prioridad de ordenamiento visual por estado de compliance para mostrar
 * primero a las especialidades y personas pendientes de auditoría.
 */
const STATUS_PRIORITY = {
  pending: 0,
  approved: 1,
  rejected: 2,
  sin_perfil: 3,
};

/**
 * Evalúa la fecha de vencimiento de un documento (Antecedentes o ART) y devuelve
 * su etiqueta formateada en `es-AR` y clases de semáforo visual (vigente, por vencer, vencido).
 *
 * @param {string|null|undefined} expiryDate - Fecha ISO o timestamp de vencimiento.
 * @returns {{ label: string, badgeClass: string, isExpired: boolean }}
 */
function getDocExpiryMeta(expiryDate) {
  if (!expiryDate) {
    return {
      label: 'Sin vencimiento',
      badgeClass: 'border-white/15 bg-black/20 opacity-75',
      isExpired: false,
    };
  }
  const parsed = new Date(expiryDate);
  if (Number.isNaN(parsed.getTime())) {
    return {
      label: 'Sin vencimiento',
      badgeClass: 'border-white/15 bg-black/20 opacity-75',
      isExpired: false,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const formatted = parsed.toLocaleDateString('es-AR');

  if (diffDays < 0) {
    return {
      label: `Vencido · ${formatted}`,
      badgeClass: 'border-rose-500/50 bg-rose-950/60 text-rose-200',
      isExpired: true,
    };
  }
  if (diffDays <= 30) {
    return {
      label: `Por vencer · ${formatted}`,
      badgeClass: 'border-amber-500/50 bg-amber-950/50 text-amber-200',
      isExpired: false,
    };
  }
  return {
    label: `Vigente · ${formatted}`,
    badgeClass: 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200',
    isExpired: false,
  };
}

/**
 * Formatea una fecha corta en formato `DD/MM/YYYY` para vencimiento de membresías.
 *
 * @param {string|null|undefined} value - Fecha ISO o timestamp.
 * @returns {string} Fecha legible o cadena vacía.
 */
function formatShortDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-AR');
}

/**
 * Vista centralizada de auditoría de compliance de prestadores (agrupada por persona)
 * y mediación de reclamos post-servicio para el rol `superadmin`.
 *
 * @returns {JSX.Element} Panel administrativo de compliance y reclamos.
 */
export default function AdminComplianceView() {
  const { brand } = useBranding();

  // Estilos dinámicos de branding: Zona 4 (tarjetas principales) y Zona 5 (contenedores internos e inputs)
  const cardStyle = {
    backgroundColor: brand.cardBgColor || DEFAULT_BRANDING_CONFIG.cardBgColor,
    color: brand.cardTextColor || DEFAULT_BRANDING_CONFIG.cardTextColor,
  };

  const innerStyle = {
    backgroundColor: brand.innerBgColor || DEFAULT_BRANDING_CONFIG.innerBgColor,
    color: brand.innerTextColor || DEFAULT_BRANDING_CONFIG.innerTextColor,
  };

  // Pestaña activa ('compliance' | 'disputes') y modo de visualización ('cards' | 'table')
  const [activeTab, setActiveTab] = useState('compliance');
  const [viewMode, setViewMode] = useState('cards');

  // Datos crudos desde la API y estados de acciones en curso
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [updatingUserComplianceId, setUpdatingUserComplianceId] = useState(null);
  const [confirmRejectKey, setConfirmRejectKey] = useState(null);
  const [updatingMembershipUserId, setUpdatingMembershipUserId] = useState(null);

  // Estados de reclamos post-servicio
  const [disputes, setDisputes] = useState([]);
  const [resolutionDrafts, setResolutionDrafts] = useState({});
  const [resolvingDisputeId, setResolvingDisputeId] = useState(null);

  // Mensajes de feedback operativo y filtros de búsqueda/estado
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  /**
   * Agrupa las filas de `GET /api/v1/providers/all` por identidad única de persona (`user_id`),
   * consolidando sus especialidades, estado prioritario, documentos principales y membresía
   * para evitar tarjetas duplicadas y repetición de botones comerciales.
   */
  const groupedPeople = useMemo(() => {
    const byUser = new Map();

    for (const row of providers) {
      const key = row.user_id ? `u-${row.user_id}` : `e-${row.email || row.provider_id}`;
      const status = String(row.status || 'sin_perfil').toLowerCase();

      if (!byUser.has(key)) {
        byUser.set(key, {
          user_key: key,
          user_id: row.user_id,
          first_name: row.first_name || '',
          last_name: row.last_name || '',
          full_name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.email || 'Prestador',
          dni: row.dni || '-',
          email: row.email || '',
          is_verified_member: Boolean(row.is_verified_member),
          membership_tier: row.membership_tier || null,
          membership_ends_at: row.membership_ends_at || null,
          specialties: [],
        });
      }

      const person = byUser.get(key);
      if (row.provider_id) {
        person.specialties.push({
          provider_id: row.provider_id,
          specialty: row.specialty || 'Sin especialidad',
          status,
          is_custom_specialty: Boolean(row.is_custom_specialty),
          custom_specialty_description: row.custom_specialty_description || null,
          specialty_approval_status: String(row.specialty_approval_status || 'approved').toLowerCase(),
          criminal_record_url: row.criminal_record_url || null,
          criminal_record_expiry: row.criminal_record_expiry || null,
          insurance_policy_url: row.insurance_policy_url || row.art_insurance_url || null,
          insurance_expiry: row.insurance_expiry || null,
        });
      }
    }

    // Ordenar especialidades internas y calcular resumen de compliance personal vs rubros personalizados
    return Array.from(byUser.values())
      .map((person) => {
        const sortedSpecs = [...person.specialties].sort(
          (a, b) => (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9)
        );
        const standardSpecs = sortedSpecs.filter((s) => !s.is_custom_specialty);
        const customSpecs = sortedSpecs.filter((s) => s.is_custom_specialty);
        const pendingCustomSpecs = customSpecs.filter(
          (s) => s.specialty_approval_status === 'pending' || s.status === 'pending'
        );
        const pendingStandardSpecs = standardSpecs.filter((s) => s.status === 'pending');
        const pendingSpecs = sortedSpecs.filter((s) => s.status === 'pending');
        const approvedSpecs = sortedSpecs.filter((s) => s.status === 'approved');
        const rejectedSpecs = sortedSpecs.filter((s) => s.status === 'rejected');

        // Estado consolidado de compliance personal (prioriza documentación/estándar pendientes, luego custom)
        let primaryStatus = 'sin_perfil';
        if (pendingStandardSpecs.length > 0 || pendingSpecs.length > 0) primaryStatus = 'pending';
        else if (approvedSpecs.length > 0) primaryStatus = 'approved';
        else if (rejectedSpecs.length > 0) primaryStatus = 'rejected';

        // Indica si la persona ya tiene compliance personal aprobado (al menos un perfil aprobado y sin estándar pendientes)
        const isPersonApproved = approvedSpecs.length > 0 && pendingStandardSpecs.length === 0;

        // Documento representativo (primer registro con URL/fecha cargada)
        const docCriminal =
          sortedSpecs.find((s) => s.criminal_record_url || s.criminal_record_expiry) ||
          sortedSpecs[0] ||
          null;
        const docInsurance =
          sortedSpecs.find((s) => s.insurance_policy_url || s.insurance_expiry) ||
          sortedSpecs[0] ||
          null;

        return {
          ...person,
          specialties: sortedSpecs,
          standardSpecs,
          customSpecs,
          pendingCustomSpecs,
          pendingStandardSpecs,
          pendingCount: pendingSpecs.length,
          approvedCount: approvedSpecs.length,
          rejectedCount: rejectedSpecs.length,
          isPersonApproved,
          primaryStatus,
          criminal_record_url: docCriminal?.criminal_record_url || null,
          criminal_record_expiry: docCriminal?.criminal_record_expiry || null,
          insurance_policy_url: docInsurance?.insurance_policy_url || null,
          insurance_expiry: docInsurance?.insurance_expiry || null,
        };
      })
      .sort((a, b) => {
        const pa = STATUS_PRIORITY[a.primaryStatus] ?? 9;
        const pb = STATUS_PRIORITY[b.primaryStatus] ?? 9;
        if (pa !== pb) return pa - pb;
        return a.full_name.localeCompare(b.full_name, 'es');
      });
  }, [providers]);

  // Métricas reales separando personas únicas, compliance pendiente y especialidades personalizadas en revisión
  const auditSummary = useMemo(() => {
    const counts = {
      totalPeople: groupedPeople.length,
      totalSpecialties: 0,
      all: groupedPeople.length,
      pending: 0,
      custom_pending: 0,
      approved: 0,
      rejected: 0,
      sin_perfil: 0,
      totalPendingSpecs: 0,
    };

    groupedPeople.forEach((person) => {
      counts.totalSpecialties += person.specialties.length;
      counts.totalPendingSpecs += person.pendingCount;
      if (person.pendingCount > 0) counts.pending += 1;
      if (person.pendingCustomSpecs.length > 0) counts.custom_pending += 1;
      if (person.isPersonApproved) counts.approved += 1;
      if (person.rejectedCount > 0 && !person.isPersonApproved) counts.rejected += 1;
      if (person.specialties.length === 0) counts.sin_perfil += 1;
    });

    return counts;
  }, [groupedPeople]);

  // Conteo de reclamos abiertos o en revisión para el badge de la pestaña de Reclamos
  const openDisputesCount = useMemo(
    () => disputes.filter((d) => d.status === 'open' || d.status === 'in_review').length,
    [disputes]
  );

  // Filtra personas por estado de compliance / rubro personalizado y búsqueda libre
  const filteredPeople = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return groupedPeople.filter((person) => {
      let matchesStatus = true;
      if (statusFilter === 'pending') matchesStatus = person.pendingCount > 0;
      else if (statusFilter === 'custom_pending') matchesStatus = person.pendingCustomSpecs.length > 0;
      else if (statusFilter === 'approved') matchesStatus = person.isPersonApproved;
      else if (statusFilter === 'rejected') matchesStatus = person.rejectedCount > 0 && !person.isPersonApproved;
      else if (statusFilter === 'sin_perfil') matchesStatus = person.specialties.length === 0;

      const specsText = person.specialties.map((s) => s.specialty).join(' ');
      const haystack = `${person.full_name} ${person.dni} ${person.email} ${specsText}`.toLowerCase();
      const matchesQuery = !q || haystack.includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [groupedPeople, searchTerm, statusFilter]);

  /**
   * Consulta al backend el listado completo de prestadores y sus documentos de compliance.
   *
   * @returns {Promise<void>}
   */
  const fetchAllProviders = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/all`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setProviders(data.providers || []);
      } else {
        setErrorMsg(data.error || 'No se pudo cargar el listado de prestadores.');
      }
    } catch (error) {
      console.error('Error al consultar prestadores:', error);
      setErrorMsg('Error de conexión con el servidor backend.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Obtiene los reclamos post-servicio registrados en la plataforma para mediación centralizada.
   *
   * @returns {Promise<void>}
   */
  const fetchDisputes = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/contracts/disputes`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setDisputes(data.disputes || []);
      }
    } catch (error) {
      console.error('Error al consultar reclamos post-servicio:', error);
    }
  };

  // Carga inicial de prestadores y reclamos al montar la vista
  useEffect(() => {
    fetchAllProviders();
    fetchDisputes();
  }, []);

  /**
   * Actualiza el estado de compliance de una especialidad puntual ('approved' o 'rejected')
   * y recarga el listado tras confirmar la operación.
   *
   * @param {number|string} providerId - Identificador del perfil/especialidad de prestador.
   * @param {'approved'|'rejected'} newStatus - Nuevo estado de auditoría a aplicar.
   * @returns {Promise<void>}
   */
  const handleUpdateStatus = async (providerId, newStatus) => {
    setUpdatingId(providerId);
    setConfirmRejectKey(null);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/compliance`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
        body: JSON.stringify({
          provider_id: providerId,
          status: newStatus,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(
          newStatus === 'approved'
            ? 'Especialidad personalizada aprobada correctamente.'
            : 'Especialidad rechazada / revocada correctamente.'
        );
        await fetchAllProviders();
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar el estado de compliance.');
      }
    } catch (error) {
      console.error('Error al actualizar compliance:', error);
      setErrorMsg('Error de conexión al actualizar el estado.');
    } finally {
      setUpdatingId(null);
    }
  };

  /**
   * Aprueba o rechaza el compliance personal de una persona (`user_id`) en una sola acción
   * mediante `PATCH /api/v1/providers/compliance/user`. Al aprobar, activa todos los rubros
   * estándar del catálogo automáticamente y deja únicamente los personalizados pendientes
   * para su moderación puntual.
   *
   * @param {number|string} userId - Identificador único de la persona prestadora.
   * @param {'approved'|'rejected'} status - Estado de compliance personal a aplicar.
   * @returns {Promise<void>}
   */
  const handleUpdateUserCompliance = async (userId, status) => {
    setUpdatingUserComplianceId(userId);
    setConfirmRejectKey(null);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/compliance/user`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
        body: JSON.stringify({ user_id: userId, status }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(data.message || 'Compliance personal actualizado correctamente.');
        await fetchAllProviders();
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar el compliance personal.');
      }
    } catch (error) {
      console.error('Error al actualizar compliance personal:', error);
      setErrorMsg('Error de conexión al actualizar el compliance personal.');
    } finally {
      setUpdatingUserComplianceId(null);
    }
  };

  /**
   * Gestiona la membresía "Socio Verificado" a nivel persona (`userId`)
   * para activar, extender 30 días o revocar el beneficio en el directorio.
   *
   * @param {number|string} userId - Identificador único del usuario prestador.
   * @param {'activate'|'extend'|'cancel'} action - Acción de membresía a ejecutar.
   * @param {number} [days=30] - Cantidad de días de vigencia para activación o extensión.
   * @returns {Promise<void>}
   */
  const handleManageMembership = async (userId, action, days = 30) => {
    setUpdatingMembershipUserId(userId);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/billing/provider/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
        body: JSON.stringify({
          action,
          plan_code: 'verified_monthly',
          days,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(data.message || 'Membresía Socio Verificado actualizada.');
        await fetchAllProviders();
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar la membresía del prestador.');
      }
    } catch (error) {
      console.error('Error al gestionar membresía:', error);
      setErrorMsg('Error de conexión al gestionar la membresía.');
    } finally {
      setUpdatingMembershipUserId(null);
    }
  };

  /**
   * Resuelve o desestima un reclamo post-servicio exigiendo una nota de resolución obligatoria.
   * Limpia el borrador de la nota y refresca los reclamos al finalizar.
   *
   * @param {number|string} disputeId - Identificador del reclamo a cerrar.
   * @param {'resolved'|'rejected'} status - Resultado de la mediación.
   * @returns {Promise<void>}
   */
  const handleResolveDispute = async (disputeId, status) => {
    const notes = String(resolutionDrafts[disputeId] || '').trim();
    if (!notes) {
      setErrorMsg('Escribí una nota de resolución antes de cerrar o desestimar el reclamo.');
      return;
    }
    setResolvingDisputeId(disputeId);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/contracts/disputes/${disputeId}/resolve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
        body: JSON.stringify({ status, resolution_notes: notes }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(data.message || `Reclamo #${disputeId} actualizado.`);
        setResolutionDrafts((prev) => ({ ...prev, [disputeId]: '' }));
        await fetchDisputes();
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar el reclamo.');
      }
    } catch (error) {
      console.error('Error al resolver reclamo:', error);
      setErrorMsg('Error de conexión al resolver el reclamo.');
    } finally {
      setResolvingDisputeId(null);
    }
  };

  /**
   * Renderiza los botones de aprobación/rechazo de una especialidad personalizada en moderación.
   *
   * @param {Object} spec - Especialidad personalizada perteneciente a una persona.
   * @returns {JSX.Element}
   */
  const renderCustomSpecialtyActions = (spec) => {
    const isBusy = updatingId === spec.provider_id;
    const rejectKey = `spec-${spec.provider_id}`;
    const isConfirmingReject = confirmRejectKey === rejectKey;

    return (
      <div className="flex items-center gap-1.5 shrink-0">
        {spec.status !== 'approved' && (
          <button
            type="button"
            onClick={() => handleUpdateStatus(spec.provider_id, 'approved')}
            disabled={isBusy}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-1 rounded-lg text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-45"
          >
            <CheckCircle2 size={12} /> Aprobar rubro
          </button>
        )}

        {spec.status !== 'rejected' &&
          (isConfirmingReject ? (
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleUpdateStatus(spec.provider_id, 'rejected')}
                disabled={isBusy}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-2.5 py-1 rounded-lg text-[11px] cursor-pointer disabled:opacity-45"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setConfirmRejectKey(null)}
                className="px-2 py-1 rounded-lg text-[11px] border border-white/15 opacity-80 hover:opacity-100 cursor-pointer"
                style={cardStyle}
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmRejectKey(rejectKey)}
              disabled={isBusy}
              className="border border-rose-500/45 bg-rose-950/30 hover:bg-rose-950/60 text-rose-200 font-bold px-2.5 py-1 rounded-lg text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-45"
            >
              <XCircle size={12} /> Rechazar rubro
            </button>
          ))}
      </div>
    );
  };

  /**
   * Renderiza la acción única de compliance personal a nivel persona (`user_id`):
   * `Aprobar Prestador` cuando tiene compliance/rubros estándar pendientes y `Rechazar / Revocar`
   * discreto en 2 clics.
   *
   * @param {Object} person - Persona prestadora agrupada.
   * @returns {JSX.Element|null}
   */
  const renderPersonComplianceActions = (person) => {
    if (!person.user_id || person.specialties.length === 0) return null;
    const isBusy = updatingUserComplianceId === person.user_id;
    const rejectKey = `user-${person.user_id}`;
    const isConfirmingReject = confirmRejectKey === rejectKey;
    const needsPersonalApproval = !person.isPersonApproved;

    return (
      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        {needsPersonalApproval && (
          <button
            type="button"
            onClick={() => handleUpdateUserCompliance(person.user_id, 'approved')}
            disabled={isBusy}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-45"
          >
            <CheckCheck size={13} /> {isBusy ? 'Aprobando...' : 'Aprobar Prestador'}
          </button>
        )}

        {person.primaryStatus !== 'rejected' &&
          (isConfirmingReject ? (
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleUpdateUserCompliance(person.user_id, 'rejected')}
                disabled={isBusy}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-2.5 py-1.5 rounded-lg text-[11px] cursor-pointer disabled:opacity-45"
              >
                Confirmar rechazo
              </button>
              <button
                type="button"
                onClick={() => setConfirmRejectKey(null)}
                className="px-2 py-1.5 rounded-lg text-[11px] border border-white/15 opacity-80 hover:opacity-100 cursor-pointer"
                style={cardStyle}
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmRejectKey(rejectKey)}
              disabled={isBusy}
              className="border border-rose-500/45 bg-rose-950/30 hover:bg-rose-950/60 text-rose-200 font-bold px-2.5 py-1.5 rounded-lg text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-45"
            >
              <XCircle size={12} /> {person.isPersonApproved ? 'Revocar' : 'Rechazar'}
            </button>
          ))}
      </div>
    );
  };

  return (
    <div className={PAGE_SHELL_CLASS}>
      {/* Encabezado ejecutivo con métricas reales (personas vs especialidades) y pestañas */}
      <section
        className="p-5 sm:p-6 rounded-2xl border border-white/10 shadow-sm space-y-4"
        style={cardStyle}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl border border-white/15 text-emerald-400" style={innerStyle}>
              <UserCheck size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black">Compliance y Operaciones</h2>
              <p className="text-xs opacity-80 mt-0.5">
                Auditoría consolidada por prestador, vigencia documental, membresías y mediación de reclamos.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <span
              className="text-xs font-bold px-3 py-2 rounded-xl border border-white/15"
              style={innerStyle}
            >
              {auditSummary.totalPeople} prestador(es) · {auditSummary.totalSpecialties} rubro(s)
            </span>
            {auditSummary.totalPendingSpecs > 0 && (
              <span className="text-xs font-bold px-3 py-2 rounded-xl border border-amber-500/45 bg-amber-500/15 text-amber-200">
                {auditSummary.totalPendingSpecs} pendiente(s)
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                fetchAllProviders();
                fetchDisputes();
              }}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-white/15 cursor-pointer transition-opacity hover:opacity-90"
              style={innerStyle}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Actualizar
            </button>
          </div>
        </div>

        {/* Pestañas superiores: separa Compliance de Reclamos para eliminar scroll vacío */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('compliance')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              activeTab === 'compliance'
                ? 'bg-emerald-600 text-white border-transparent shadow-sm'
                : 'border-white/15 opacity-80 hover:opacity-100'
            }`}
            style={activeTab === 'compliance' ? undefined : innerStyle}
          >
            <ShieldCheck size={14} />
            <span>Auditoría de Prestadores</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/25">
              {auditSummary.totalPeople}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('disputes')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              activeTab === 'disputes'
                ? 'bg-emerald-600 text-white border-transparent shadow-sm'
                : 'border-white/15 opacity-80 hover:opacity-100'
            }`}
            style={activeTab === 'disputes' ? undefined : innerStyle}
          >
            <AlertCircle size={14} className={openDisputesCount > 0 ? 'text-rose-300' : ''} />
            <span>Reclamos y Garantía</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                openDisputesCount > 0
                  ? 'bg-rose-500/80 text-white'
                  : 'bg-black/25'
              }`}
            >
              {disputes.length}
            </span>
          </button>
        </div>
      </section>

      {/* Banners de feedback operativo (errores y confirmaciones) */}
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

      {/* PESTAÑA 1: AUDITORÍA CONSOLIDADA POR PERSONA */}
      {activeTab === 'compliance' && (
        <section className={SECTION_CARD_CLASS} style={cardStyle}>
          {/* Barra superior: título, buscador y selector Tarjetas vs Tabla */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3.5">
            <div className="flex items-center gap-2">
              <ShieldCheck size={17} className="text-emerald-400 shrink-0" />
              <h3 className="text-sm font-bold">Prestadores agrupados por identidad</h3>
              <span className="text-xs opacity-70">({filteredPeople.length})</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Buscador por nombre, DNI, correo o especialidad */}
              <div className="relative flex-1 md:w-72">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60 pointer-events-none"
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nombre, DNI, email o rubro..."
                  className={`w-full pl-9 pr-8 ${FIELD_INPUT_CLASS}`}
                  style={innerStyle}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    aria-label="Limpiar búsqueda"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Selector de vista: Tarjetas agrupadas o Tabla compacta */}
              <div
                className="inline-flex items-center p-0.5 rounded-xl border border-white/15"
                style={innerStyle}
              >
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  title="Vista tarjetas agrupadas"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${
                    viewMode === 'cards' ? 'bg-emerald-600 text-white' : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  <LayoutGrid size={13} /> Tarjetas
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  title="Vista tabla compacta"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${
                    viewMode === 'table' ? 'bg-emerald-600 text-white' : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  <List size={13} /> Tabla
                </button>
              </div>
            </div>
          </div>

          {/* Filtros rápidos por estado de compliance personal y rubros personalizados */}
          <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap pb-1">
            {[
              { id: 'all', label: 'Todos', count: auditSummary.all },
              { id: 'pending', label: 'Pendientes', count: auditSummary.pending },
              { id: 'custom_pending', label: 'Rubros personalizados', count: auditSummary.custom_pending },
              { id: 'approved', label: 'Aprobados', count: auditSummary.approved },
              { id: 'rejected', label: 'Rechazados', count: auditSummary.rejected },
              { id: 'sin_perfil', label: 'Sin perfil', count: auditSummary.sin_perfil },
            ].map((chip) => {
              const active = statusFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setStatusFilter(chip.id)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap border inline-flex items-center gap-1.5 ${
                    active
                      ? 'bg-emerald-600 text-white border-transparent shadow-sm'
                      : 'border-white/15 opacity-80 hover:opacity-100'
                  }`}
                  style={active ? undefined : innerStyle}
                >
                  <span>{chip.label}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/25">
                    {chip.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Estado de carga, vacío o listado según vista seleccionada */}
          {loading ? (
            <div
              className="text-center py-10 rounded-xl border border-white/10 text-xs"
              style={innerStyle}
            >
              Cargando prestadores desde PostgreSQL...
            </div>
          ) : filteredPeople.length === 0 ? (
            <div
              className="text-center py-10 rounded-xl border border-white/10 text-xs opacity-80"
              style={innerStyle}
            >
              No hay prestadores que coincidan con el filtro seleccionado.
            </div>
          ) : viewMode === 'cards' ? (
            /* VISTA A: TARJETAS CONSOLIDADAS POR PERSONA (compliance único + chips estándar + moderación custom) */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {filteredPeople.map((person) => {
                const criminalMeta = getDocExpiryMeta(person.criminal_record_expiry);
                const artMeta = getDocExpiryMeta(person.insurance_expiry);
                const hasProfile = person.specialties.length > 0;
                const personStatusMeta = getUnifiedStatusMeta(
                  person.isPersonApproved ? 'approved' : person.primaryStatus,
                  'compliance'
                );

                return (
                  <article
                    key={person.user_key}
                    className="rounded-xl p-4 sm:p-5 border border-white/10 space-y-3.5 text-xs"
                    style={innerStyle}
                  >
                    {/* Cabecera de persona: Identidad + Estado de compliance personal + Membresía */}
                    <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-white/10">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-black truncate">{person.full_name}</h4>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${personStatusMeta.cls}`}
                          >
                            {personStatusMeta.label}
                          </span>
                          {person.is_verified_member && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-400/45 bg-amber-500/15 text-amber-200">
                              <Award size={10} /> Socio
                              {person.membership_ends_at
                                ? ` · hasta ${formatShortDate(person.membership_ends_at)}`
                                : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] opacity-80 truncate">
                          DNI <strong className="font-mono">{person.dni}</strong> · {person.email}
                        </p>
                      </div>

                      {/* Acción comercial única por persona (estilo outline discreto) */}
                      {person.user_id && hasProfile && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!person.is_verified_member ? (
                            <button
                              type="button"
                              onClick={() => handleManageMembership(person.user_id, 'activate', 30)}
                              disabled={updatingMembershipUserId === person.user_id}
                              className="border border-amber-400/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 font-bold px-2.5 py-1 rounded-lg text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-45"
                            >
                              <Award size={11} /> Socio 30d
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleManageMembership(person.user_id, 'extend', 30)}
                                disabled={updatingMembershipUserId === person.user_id}
                                className="border border-amber-400/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 font-bold px-2 py-1 rounded-lg text-[11px] cursor-pointer disabled:opacity-45"
                              >
                                +30d
                              </button>
                              <button
                                type="button"
                                onClick={() => handleManageMembership(person.user_id, 'cancel')}
                                disabled={updatingMembershipUserId === person.user_id}
                                className="border border-white/15 hover:opacity-90 font-semibold px-2 py-1 rounded-lg text-[11px] opacity-80 cursor-pointer disabled:opacity-45"
                                style={cardStyle}
                              >
                                Revocar Socio
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Documentación personal consolidada con semáforo de vencimiento visible */}
                    {hasProfile ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div
                          className="rounded-xl p-2.5 border border-white/10 space-y-1.5"
                          style={cardStyle}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-[11px] inline-flex items-center gap-1">
                              <FileText size={12} className="text-sky-400 shrink-0" />
                              Antecedentes
                            </span>
                            {person.criminal_record_url ? (
                              <a
                                href={person.criminal_record_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-bold text-sky-300 underline underline-offset-2 hover:text-sky-200"
                              >
                                Abrir PDF
                              </a>
                            ) : (
                              <span className="text-[10px] opacity-60">Sin archivo</span>
                            )}
                          </div>
                          <div
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${criminalMeta.badgeClass}`}
                          >
                            <Calendar size={10} className="shrink-0" />
                            <span>{criminalMeta.label}</span>
                          </div>
                        </div>

                        <div
                          className="rounded-xl p-2.5 border border-white/10 space-y-1.5"
                          style={cardStyle}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-[11px] inline-flex items-center gap-1">
                              <FileText size={12} className="text-emerald-400 shrink-0" />
                              Póliza ART
                            </span>
                            {person.insurance_policy_url ? (
                              <a
                                href={person.insurance_policy_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-bold text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
                              >
                                Abrir PDF
                              </a>
                            ) : (
                              <span className="text-[10px] opacity-60">Sin archivo</span>
                            )}
                          </div>
                          <div
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${artMeta.badgeClass}`}
                          >
                            <Calendar size={10} className="shrink-0" />
                            <span>{artMeta.label}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="rounded-xl p-3 border border-white/10 flex items-center justify-between gap-2"
                        style={cardStyle}
                      >
                        <span className="opacity-75 italic">
                          Cuenta registrada como prestador — aún no cargó documentación ni especialidades.
                        </span>
                      </div>
                    )}

                    {/* Rubros estándar (chips informativos sin botones repetidos) */}
                    {person.standardSpecs.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                          Especialidades de catálogo ({person.standardSpecs.length})
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {person.standardSpecs.map((spec) => {
                            const statusMeta = getUnifiedStatusMeta(spec.status, 'compliance');
                            return (
                              <span
                                key={spec.provider_id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 text-[11px] font-semibold"
                                style={cardStyle}
                              >
                                <span>{spec.specialty}</span>
                                <span
                                  className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${statusMeta.cls}`}
                                >
                                  {statusMeta.label}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Bloque dedicado únicamente a Especialidades Personalizadas propuestas (con descripción) */}
                    {person.customSpecs.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                          Especialidades personalizadas ({person.customSpecs.length})
                        </span>
                        <div className="space-y-2">
                          {person.customSpecs.map((spec) => {
                            const statusMeta = getUnifiedStatusMeta(spec.status, 'compliance');
                            return (
                              <div
                                key={spec.provider_id}
                                className="rounded-xl p-3 border border-amber-500/35 bg-amber-950/20 space-y-2"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                                    <span className="font-bold text-xs">{spec.specialty}</span>
                                    <span
                                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusMeta.cls}`}
                                    >
                                      {statusMeta.label}
                                    </span>
                                  </div>
                                  {renderCustomSpecialtyActions(spec)}
                                </div>
                                {spec.custom_specialty_description && (
                                  <p className="text-[11px] opacity-85 italic">
                                    “{spec.custom_specialty_description}”
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Pie de tarjeta: 1 única barra de auditoría de compliance personal por prestador */}
                    {hasProfile && (
                      <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] opacity-75">
                          {person.isPersonApproved
                            ? 'Compliance personal verificado'
                            : 'Validá Antecedentes + ART para aprobar al prestador'}
                        </span>
                        {renderPersonComplianceActions(person)}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            /* VISTA B: TABLA COMPACTA AGRUPADA POR PERSONA */
            <div className="overflow-x-auto rounded-xl border border-white/10" style={innerStyle}>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 opacity-75 text-[11px] uppercase">
                    <th className="py-2.5 px-3">Prestador</th>
                    <th className="py-2.5 px-3">Documentación / Vigencia</th>
                    <th className="py-2.5 px-3">Rubros y Moderación</th>
                    <th className="py-2.5 px-3 text-right">Compliance y Socio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredPeople.map((person) => {
                    const criminalMeta = getDocExpiryMeta(person.criminal_record_expiry);
                    const artMeta = getDocExpiryMeta(person.insurance_expiry);
                    const hasProfile = person.specialties.length > 0;
                    const personStatusMeta = getUnifiedStatusMeta(
                      person.isPersonApproved ? 'approved' : person.primaryStatus,
                      'compliance'
                    );

                    return (
                      <tr key={person.user_key} className="align-top hover:bg-white/5">
                        <td className="py-3 px-3 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs">{person.full_name}</span>
                            <span
                              className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${personStatusMeta.cls}`}
                            >
                              {personStatusMeta.label}
                            </span>
                          </div>
                          <div className="text-[11px] opacity-75 font-mono">DNI {person.dni}</div>
                          <div className="text-[11px] opacity-70 truncate max-w-44">
                            {person.email}
                          </div>
                        </td>

                        <td className="py-3 px-3 space-y-1.5">
                          {hasProfile ? (
                            <>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {person.criminal_record_url ? (
                                  <a
                                    href={person.criminal_record_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] font-bold text-sky-300 underline"
                                  >
                                    Antec.
                                  </a>
                                ) : (
                                  <span className="text-[11px] opacity-60">Sin Antec.</span>
                                )}
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${criminalMeta.badgeClass}`}
                                >
                                  {criminalMeta.label}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {person.insurance_policy_url ? (
                                  <a
                                    href={person.insurance_policy_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] font-bold text-emerald-300 underline"
                                  >
                                    ART
                                  </a>
                                ) : (
                                  <span className="text-[11px] opacity-60">Sin ART</span>
                                )}
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${artMeta.badgeClass}`}
                                >
                                  {artMeta.label}
                                </span>
                              </div>
                            </>
                          ) : (
                            <span className="text-[11px] opacity-65 italic">Sin perfil</span>
                          )}
                        </td>

                        <td className="py-3 px-3 space-y-2">
                          {hasProfile ? (
                            <>
                              {person.standardSpecs.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {person.standardSpecs.map((spec) => (
                                    <span
                                      key={spec.provider_id}
                                      className="px-2 py-0.5 rounded-md border border-white/15 text-[10px] font-semibold"
                                      style={cardStyle}
                                    >
                                      {spec.specialty}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {person.customSpecs.map((spec) => (
                                <div
                                  key={spec.provider_id}
                                  className="rounded-lg p-2 border border-amber-500/35 bg-amber-950/20 space-y-1"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-bold text-[11px] text-amber-200">
                                      Personalizado: {spec.specialty}
                                    </span>
                                    {renderCustomSpecialtyActions(spec)}
                                  </div>
                                  {spec.custom_specialty_description && (
                                    <p className="text-[10px] opacity-80 italic">
                                      “{spec.custom_specialty_description}”
                                    </p>
                                  )}
                                </div>
                              ))}
                            </>
                          ) : (
                            <span className="text-[11px] opacity-65 italic">
                              Aún sin especialidades
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right">
                          {person.user_id && hasProfile ? (
                            <div className="inline-flex flex-col items-end gap-2">
                              {renderPersonComplianceActions(person)}
                              {person.is_verified_member ? (
                                <div className="flex items-center gap-1">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-400/45 bg-amber-500/15 text-amber-200">
                                    <Award size={10} /> Socio
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleManageMembership(person.user_id, 'extend', 30)
                                    }
                                    disabled={updatingMembershipUserId === person.user_id}
                                    className="border border-amber-400/50 text-amber-200 px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer"
                                  >
                                    +30d
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleManageMembership(person.user_id, 'cancel')
                                    }
                                    disabled={updatingMembershipUserId === person.user_id}
                                    className="border border-white/15 px-1.5 py-0.5 rounded text-[10px] opacity-80 cursor-pointer"
                                  >
                                    Revocar
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleManageMembership(person.user_id, 'activate', 30)
                                  }
                                  disabled={updatingMembershipUserId === person.user_id}
                                  className="border border-amber-400/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 font-bold px-2.5 py-1 rounded-lg text-[10px] inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Award size={10} /> Socio 30d
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="opacity-50">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* PESTAÑA 2: RECLAMOS Y GARANTÍA POST-SERVICIO */}
      {activeTab === 'disputes' && (
        <section className={SECTION_CARD_CLASS} style={cardStyle}>
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle size={17} className="text-amber-400 shrink-0" />
              <div>
                <h3 className="text-sm font-bold">
                  Reclamos y Garantía Post-Servicio ({disputes.length})
                </h3>
                <p className="text-[11px] opacity-75">
                  Mediación centralizada de Operaciones TrustLink sobre contratos con reclamo abierto.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={fetchDisputes}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/15 cursor-pointer"
              style={innerStyle}
            >
              <RefreshCw size={12} /> Actualizar
            </button>
          </div>

          {disputes.length === 0 ? (
            <div
              className="text-center py-8 rounded-xl border border-white/10 text-xs opacity-75"
              style={innerStyle}
            >
              No hay reclamos post-servicio registrados en la plataforma.
            </div>
          ) : (
            <div className={ITEMS_GRID_CLASS}>
              {disputes.map((d) => {
                const isOpen = d.status === 'open' || d.status === 'in_review';
                return (
                  <div
                    key={d.id}
                    className="rounded-xl p-4 sm:p-5 border border-white/10 flex flex-col justify-between gap-3 h-full text-xs"
                    style={innerStyle}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold">
                          Reclamo #{d.id} · Contrato #{d.contract_id}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                            isOpen
                              ? 'bg-rose-950/70 text-rose-200 border-rose-700'
                              : d.status === 'resolved'
                              ? 'bg-emerald-950/70 text-emerald-200 border-emerald-700'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {d.status}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-amber-300">{d.reason}</p>
                      <p className="text-xs opacity-85">{d.details}</p>
                      <p className="text-[11px] opacity-75">
                        Residente: <strong>{d.owner_name}</strong> · Prestador:{' '}
                        <strong>{d.provider_name}</strong> ({d.provider_specialty})
                      </p>
                      {d.resolution_notes && (
                        <p className="text-[11px] text-emerald-300 pt-1">
                          Resolución: {d.resolution_notes}
                        </p>
                      )}
                    </div>

                    {isOpen && (
                      <div className="pt-3 border-t border-white/10 space-y-2">
                        <input
                          type="text"
                          value={resolutionDrafts[d.id] || ''}
                          onChange={(e) =>
                            setResolutionDrafts((prev) => ({ ...prev, [d.id]: e.target.value }))
                          }
                          placeholder="Nota de resolución o acuerdo alcanzado..."
                          className={`w-full px-3 ${FIELD_INPUT_CLASS}`}
                          style={cardStyle}
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={resolvingDisputeId === d.id}
                            onClick={() => handleResolveDispute(d.id, 'resolved')}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs cursor-pointer disabled:opacity-50"
                          >
                            Resolver
                          </button>
                          <button
                            type="button"
                            disabled={resolvingDisputeId === d.id}
                            onClick={() => handleResolveDispute(d.id, 'rejected')}
                            className="border border-rose-500/45 bg-rose-950/30 hover:bg-rose-950/60 text-rose-200 font-bold px-3 py-1.5 rounded-xl text-xs cursor-pointer disabled:opacity-50"
                          >
                            Desestimar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
