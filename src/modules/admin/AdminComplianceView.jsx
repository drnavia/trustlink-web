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
  Award,
  LayoutGrid,
  List,
  CheckCheck,
  Calendar,
  Eye,
  EyeOff,
  MessageCircle,
  HelpCircle,
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
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminListToolbar from '../../components/admin/AdminListToolbar';
import AdminPaginationBar from '../../components/admin/AdminPaginationBar';
import ProviderTrustBadge, {
  TrustChecksStrip,
  TrustLevelMeter,
  TrustLevelsGuide,
} from '../../components/ProviderTrustBadge';
import { paginateItems } from '../../utils/adminPagination';

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

  // Pestaña activa ('compliance' | 'disputes') y modo de visualización ('table' por defecto para escalar a 100+ cuentas)
  const [activeTab, setActiveTab] = useState('compliance');
  const [viewMode, setViewMode] = useState('table');

  // Datos crudos desde la API y estados de acciones en curso
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [updatingUserComplianceId, setUpdatingUserComplianceId] = useState(null);
  const [confirmRejectKey, setConfirmRejectKey] = useState(null);
  const [updatingMembershipUserId, setUpdatingMembershipUserId] = useState(null);
  const [updatingIdentityUserId, setUpdatingIdentityUserId] = useState(null);

  // Estados de reclamos post-servicio
  const [disputes, setDisputes] = useState([]);
  const [resolutionDrafts, setResolutionDrafts] = useState({});
  const [resolvingDisputeId, setResolvingDisputeId] = useState(null);

  // Mensajes de feedback operativo, filtros y paginación homologada (6 / 12 / 24 / 50)
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [compliancePage, setCompliancePage] = useState(1);
  const [compliancePageSize, setCompliancePageSize] = useState(6);
  const [showTrustGuide, setShowTrustGuide] = useState(false);

  // Filtros y paginación homologada (6 / 12 / 24 / 50) para Reclamos y Garantía
  const [disputeSearch, setDisputeSearch] = useState('');
  const [disputeStatusFilter, setDisputeStatusFilter] = useState('all');
  const [disputePage, setDisputePage] = useState(1);
  const [disputePageSize, setDisputePageSize] = useState(6);

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
          dni_document_url: row.dni_document_url || null,
          email: row.email || '',
          phone: row.phone || '',
          identity_verified: Boolean(row.identity_verified),
          user_is_active: row.user_is_active !== false,
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
          is_visible_in_directory: row.is_visible_in_directory !== false,
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

        const criminalUrl = docCriminal?.criminal_record_url || null;
        const criminalExpiry = docCriminal?.criminal_record_expiry || null;
        const insuranceUrl = docInsurance?.insurance_policy_url || null;
        const insuranceExpiry = docInsurance?.insurance_expiry || null;
        const crimExpMeta = getDocExpiryMeta(criminalExpiry);
        const artExpMeta = getDocExpiryMeta(insuranceExpiry);

        const hasCriminalOk = Boolean(criminalUrl) && !crimExpMeta.isExpired;
        const hasArtOk = Boolean(insuranceUrl) && !artExpMeta.isExpired;
        const hasAnySpecialty = sortedSpecs.length > 0;
        const identityVerified = Boolean(person.identity_verified) || approvedSpecs.length > 0;
        const hasVisibleApprovedSpec = sortedSpecs.some(
          (s) =>
            s.status === 'approved' &&
            s.specialty_approval_status === 'approved' &&
            s.is_visible_in_directory !== false
        );
        const hasVisibleEligibleSpec = sortedSpecs.some(
          (s) =>
            (s.status === 'approved' || (identityVerified && s.status === 'pending')) &&
            s.specialty_approval_status === 'approved' &&
            s.is_visible_in_directory !== false
        );
        const isAllRejected = sortedSpecs.length > 0 && sortedSpecs.every((s) => s.status === 'rejected');
        const hasExpired = crimExpMeta.isExpired || artExpMeta.isExpired;
        const isVisibleInResidentPortal =
          person.user_is_active !== false && !isAllRejected && hasVisibleEligibleSpec;
        const baseChecks = {
          identity_ok: identityVerified,
          specialty_ok: hasVisibleEligibleSpec,
          criminal_ok: hasCriminalOk,
          criminal_expired: crimExpMeta.isExpired,
          art_ok: hasArtOk,
          art_expired: artExpMeta.isExpired,
          compliance_ok: approvedSpecs.length > 0 && !hasExpired,
          pass_qr_ok:
            person.user_is_active !== false && !isAllRejected && approvedSpecs.length > 0 && !hasExpired,
          member_ok:
            person.user_is_active !== false &&
            !isAllRejected &&
            approvedSpecs.length > 0 &&
            !hasExpired &&
            Boolean(person.is_verified_member),
        };

        let trustBadge;
        if (person.user_is_active === false || isAllRejected) {
          trustBadge = {
            level: 0,
            label: isAllRejected ? 'Rechazado' : 'Suspendida',
            tone: 'danger',
            has_expired_docs: hasExpired,
            checks: baseChecks,
          };
        } else if (!identityVerified || !hasVisibleEligibleSpec) {
          trustBadge = {
            level: 0,
            label: 'Sin habilitar',
            tone: 'slate',
            has_expired_docs: hasExpired,
            checks: baseChecks,
          };
        } else if (approvedSpecs.length > 0 && hasExpired) {
          trustBadge = {
            level: hasCriminalOk || hasArtOk ? 2 : 1,
            label: 'Doc. vencida',
            tone: 'danger',
            has_expired_docs: true,
            checks: baseChecks,
          };
        } else if (approvedSpecs.length > 0 && person.is_verified_member) {
          trustBadge = {
            level: 5,
            label: 'Socio Verificado',
            tone: 'gold',
            can_issue_pass: true,
            has_expired_docs: false,
            checks: baseChecks,
          };
        } else if (approvedSpecs.length > 0) {
          trustBadge = {
            level: 4,
            label: 'Verificado',
            tone: 'emerald',
            can_issue_pass: true,
            has_expired_docs: false,
            checks: baseChecks,
          };
        } else if (hasCriminalOk && hasArtOk) {
          trustBadge = {
            level: 3,
            label: 'Doc. en validación',
            tone: 'teal',
            has_expired_docs: false,
            checks: baseChecks,
          };
        } else if (hasCriminalOk || hasArtOk) {
          trustBadge = {
            level: 2,
            label: hasCriminalOk ? 'Antecedentes al día' : 'ART al día',
            tone: 'sky',
            has_expired_docs: hasExpired,
            checks: baseChecks,
          };
        } else {
          trustBadge = {
            level: 1,
            label: 'Perfil Básico',
            tone: 'slate',
            has_expired_docs: hasExpired,
            checks: baseChecks,
          };
        }

        const missingReasons = [];
        if (person.user_is_active === false) missingReasons.push('Cuenta suspendida');
        if (!identityVerified) {
          missingReasons.push(
            person.dni_document_url ? 'DNI cargado · falta validar DNI' : 'Falta cargar/validar DNI'
          );
        }
        if (!insuranceUrl) missingReasons.push('Falta Póliza ART');
        else if (artExpMeta.isExpired) missingReasons.push('Póliza ART vencida');
        if (!criminalUrl) missingReasons.push('Falta Antecedentes');
        else if (crimExpMeta.isExpired) missingReasons.push('Antecedentes vencidos');
        if (!hasAnySpecialty) missingReasons.push('Falta especialidad');
        else if (!hasVisibleApprovedSpec && approvedSpecs.length > 0) {
          missingReasons.push('Especialidades ocultas en directorio');
        }
        if (hasAnySpecialty && !isPersonApproved && approvedSpecs.length === 0) {
          missingReasons.push(
            hasCriminalOk && hasArtOk
              ? 'Listo para aprobar a Nivel 4 (Verificado)'
              : 'Pendiente de aprobación de Administración'
          );
        }

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
          criminal_record_url: criminalUrl,
          criminal_record_expiry: criminalExpiry,
          insurance_policy_url: insuranceUrl,
          insurance_expiry: insuranceExpiry,
          identity_verified: identityVerified,
          trust_badge: trustBadge,
          readiness: {
            hasCriminal: Boolean(criminalUrl),
            hasCriminalOk,
            criminalExpired: crimExpMeta.isExpired,
            hasArt: Boolean(insuranceUrl),
            hasArtOk,
            artExpired: artExpMeta.isExpired,
            hasAnySpecialty,
            hasVisibleApprovedSpec,
            isVisibleInResidentPortal,
            missingReasons,
          },
        };
      })
      .sort((a, b) => {
        const pa = STATUS_PRIORITY[a.primaryStatus] ?? 9;
        const pb = STATUS_PRIORITY[b.primaryStatus] ?? 9;
        if (pa !== pb) return pa - pb;
        return a.full_name.localeCompare(b.full_name, 'es');
      });
  }, [providers]);

  // Métricas reales sobre cuentas activas (separando suspendidas en su propio chip)
  const auditSummary = useMemo(() => {
    const counts = {
      totalPeople: 0,
      totalSpecialties: 0,
      all: 0,
      pending: 0,
      custom_pending: 0,
      approved: 0,
      rejected: 0,
      sin_perfil: 0,
      suspended: 0,
      totalPendingSpecs: 0,
    };

    groupedPeople.forEach((person) => {
      if (person.user_is_active === false) {
        counts.suspended += 1;
        return;
      }
      counts.totalPeople += 1;
      counts.all += 1;
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
      const isSuspended = person.user_is_active === false;
      if (statusFilter === 'suspended') {
        if (!isSuspended) return false;
      } else if (isSuspended) {
        return false;
      }

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

  // Paginación homologada (6 / 12 / 24 / 50) para Compliance de Prestadores
  const pagedPeople = useMemo(
    () => paginateItems(filteredPeople, compliancePage, compliancePageSize),
    [filteredPeople, compliancePage, compliancePageSize]
  );

  // Contadores, filtrado y paginación homologada (6 / 12 / 24 / 50) para Reclamos
  const disputeCounts = useMemo(
    () =>
      disputes.reduce(
        (acc, d) => {
          acc.all += 1;
          if (d.status === 'open' || d.status === 'in_review') acc.open += 1;
          else if (d.status === 'resolved') acc.resolved += 1;
          else acc.rejected += 1;
          return acc;
        },
        { all: 0, open: 0, resolved: 0, rejected: 0 }
      ),
    [disputes]
  );

  const filteredDisputes = useMemo(() => {
    const q = disputeSearch.trim().toLowerCase();
    return disputes.filter((d) => {
      if (disputeStatusFilter === 'open' && d.status !== 'open' && d.status !== 'in_review') {
        return false;
      }
      if (disputeStatusFilter === 'resolved' && d.status !== 'resolved') return false;
      if (disputeStatusFilter === 'rejected' && d.status !== 'rejected') return false;
      if (!q) return true;
      const hay = `${d.id || ''} ${d.contract_id || ''} ${d.reason || ''} ${d.details || ''} ${
        d.owner_name || ''
      } ${d.provider_name || ''} ${d.provider_specialty || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [disputes, disputeSearch, disputeStatusFilter]);

  const pagedDisputes = useMemo(
    () => paginateItems(filteredDisputes, disputePage, disputePageSize),
    [filteredDisputes, disputePage, disputePageSize]
  );

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
  /**
   * Valida o revoca la identidad básica (DNI) del prestador (Fase 6.1) para habilitar Nivel 1 (Perfil Básico).
   */
  const handleToggleIdentity = async (userId, verified) => {
    setUpdatingIdentityUserId(userId);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/identity/verify`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
        body: JSON.stringify({ user_id: userId, verified }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(data.message || 'Estado de validación de DNI actualizado.');
        await fetchAllProviders();
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar la validación de DNI.');
      }
    } catch (error) {
      console.error('Error al validar DNI:', error);
      setErrorMsg('Error de conexión al validar DNI.');
    } finally {
      setUpdatingIdentityUserId(null);
    }
  };

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
   * Calcula la etiqueta única y clara de visibilidad en el Portal de Residentes para una persona.
   *
   * @param {Object} person - Persona prestadora agrupada.
   * @returns {{ label: string, cls: string, visible: boolean }}
   */
  const getVisibilityPillMeta = (person) => {
    if (person.user_is_active === false) {
      return {
        label: 'Cuenta suspendida',
        cls: 'border-rose-600/60 bg-rose-950/60 text-rose-200',
        visible: false,
      };
    }
    if (person.trust_badge?.can_issue_pass) {
      return {
        label: 'Visible + Pase QR',
        cls: 'border-emerald-700/70 bg-emerald-950/60 text-emerald-300',
        visible: true,
      };
    }
    if (person.readiness?.isVisibleInResidentPortal) {
      return {
        label: 'Solo consultas',
        cls: 'border-sky-600/60 bg-sky-950/55 text-sky-200',
        visible: true,
      };
    }
    return {
      label: 'Oculto',
      cls: 'border-slate-700 bg-slate-900/70 text-slate-300',
      visible: false,
    };
  };

  /**
   * Renderiza las acciones explícitas de compliance personal (`user_id`) según el estadio real:
   * - Solo habilita `Aprobar Verificado (→ N4)` cuando el prestador cargó Antecedentes + ART vigentes.
   * - Si faltan documentos, muestra claramente qué espera (`Esperando Antec. y ART`) en vez de un botón verde engañoso.
   * - Etiquetas explícitas `Rechazar docs` / `Revocar N4` con confirmación en 2 clics.
   *
   * @param {Object} person - Persona prestadora agrupada.
   * @returns {JSX.Element|null}
   */
  const renderPersonComplianceActions = (person) => {
    if (!person.user_id || person.specialties.length === 0) return null;
    if (person.user_is_active === false) {
      return (
        <span className="text-[10px] font-bold px-2 py-1 rounded-lg border border-rose-700/60 bg-rose-950/50 text-rose-200">
          Suspendida
        </span>
      );
    }

    const isBusy = updatingUserComplianceId === person.user_id;
    const rejectKey = `user-${person.user_id}`;
    const isConfirmingReject = confirmRejectKey === rejectKey;
    const needsPersonalApproval = !person.isPersonApproved;
    const hasCriminal = Boolean(person.readiness?.hasCriminal);
    const hasArt = Boolean(person.readiness?.hasArt);
    const hasCriminalOk = Boolean(person.readiness?.hasCriminalOk);
    const hasArtOk = Boolean(person.readiness?.hasArtOk);
    const canApproveLevel4 = hasCriminalOk && hasArtOk;

    const waitingDocsLabel =
      person.readiness?.artExpired || person.readiness?.criminalExpired
        ? 'Renovar docs vencidos'
        : !hasArt && !hasCriminal
          ? 'Esperando ART y Antec.'
          : !hasArt
            ? 'Esperando Póliza ART'
            : 'Esperando Antecedentes';

    const canRejectOrRevoke =
      person.isPersonApproved ||
      (person.primaryStatus !== 'rejected' && (hasCriminal || hasArt));

    return (
      <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
        {needsPersonalApproval &&
          (canApproveLevel4 ? (
            <button
              type="button"
              onClick={() => handleUpdateUserCompliance(person.user_id, 'approved')}
              disabled={isBusy}
              title="Aprueba Póliza ART + Antecedentes vigentes y sube al prestador a Nivel 4 (Verificado + Pases QR)"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-45"
            >
              <CheckCheck size={13} /> {isBusy ? 'Aprobando...' : 'Aprobar Verificado (→ N4)'}
            </button>
          ) : (
            <span
              title="Para aprobar a Nivel 4 (Verificado) el prestador primero debe cargar Póliza ART y Antecedentes Penales vigentes"
              className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border border-white/12 bg-black/25 opacity-80 whitespace-nowrap"
            >
              {waitingDocsLabel}
            </span>
          ))}

        {canRejectOrRevoke &&
          (isConfirmingReject ? (
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleUpdateUserCompliance(person.user_id, 'rejected')}
                disabled={isBusy}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-2.5 py-1.5 rounded-lg text-[11px] cursor-pointer disabled:opacity-45"
              >
                {person.isPersonApproved ? 'Confirmar revocación' : 'Confirmar rechazo'}
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
              title={
                person.isPersonApproved
                  ? 'Revoca el Nivel 4 (Verificado) y pausa la emisión de Pases QR'
                  : 'Rechaza la documentación cargada y solicita recarga al prestador'
              }
              className="border border-rose-500/45 bg-rose-950/30 hover:bg-rose-950/60 text-rose-200 font-bold px-2.5 py-1.5 rounded-lg text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-45"
            >
              <XCircle size={12} /> {person.isPersonApproved ? 'Revocar N4' : 'Rechazar docs'}
            </button>
          ))}
      </div>
    );
  };

  return (
    <div className={PAGE_SHELL_CLASS}>
      {/* Encabezado unificado (AdminPageHeader) */}
      <AdminPageHeader
        icon={<UserCheck size={22} />}
        iconColorClass="text-emerald-400"
        title="Prestadores"
        subtitle="Compliance por identidad, vigencia documental, membresías y reclamos."
        tabs={[
          {
            id: 'compliance',
            label: 'Compliance',
            icon: <ShieldCheck size={14} />,
            count: auditSummary.totalPeople,
          },
          {
            id: 'disputes',
            label: 'Reclamos y Garantía',
            icon: <AlertCircle size={14} className={openDisputesCount > 0 ? 'text-rose-300' : ''} />,
            count: disputes.length,
          },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onRefresh={() => {
          fetchAllProviders();
          fetchDisputes();
        }}
        refreshing={loading}
        cardStyle={cardStyle}
        innerStyle={innerStyle}
      />

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
          <AdminListToolbar
            searchValue={searchTerm}
            onSearchChange={(val) => {
              setSearchTerm(val);
              setCompliancePage(1);
            }}
            searchPlaceholder="Buscar por nombre, DNI, correo o rubro..."
            chips={[
              { id: 'all', label: 'Todos', count: auditSummary.all },
              { id: 'pending', label: 'Pendientes', count: auditSummary.pending },
              { id: 'custom_pending', label: 'Rubros personalizados', count: auditSummary.custom_pending },
              { id: 'approved', label: 'Verificados (N4–N5)', count: auditSummary.approved },
              { id: 'rejected', label: 'Rechazados', count: auditSummary.rejected },
              { id: 'sin_perfil', label: 'Sin perfil', count: auditSummary.sin_perfil },
              ...(auditSummary.suspended > 0
                ? [{ id: 'suspended', label: 'Suspendidas', count: auditSummary.suspended }]
                : []),
            ]}
            activeChip={statusFilter}
            onChipChange={(chip) => {
              setStatusFilter(chip);
              setCompliancePage(1);
            }}
            hasActiveFilters={Boolean(searchTerm.trim() || statusFilter !== 'all')}
            onResetFilters={() => {
              setSearchTerm('');
              setStatusFilter('all');
              setCompliancePage(1);
            }}
            actions={
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowTrustGuide((prev) => !prev)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                    showTrustGuide
                      ? 'border-indigo-400/65 bg-indigo-500/20 text-indigo-200'
                      : 'border-white/15 opacity-85 hover:opacity-100'
                  }`}
                  style={showTrustGuide ? undefined : innerStyle}
                >
                  <HelpCircle size={13} /> Niveles N1–N5
                </button>
                <div
                  className="inline-flex items-center gap-1 p-0.5 rounded-xl border border-white/15"
                  style={innerStyle}
                >
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    title="Vista tabla compacta (recomendada para grandes nóminas)"
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${
                      viewMode === 'table' ? 'bg-indigo-600 text-white' : 'opacity-75 hover:opacity-100'
                    }`}
                  >
                    <List size={13} /> Tabla
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('cards')}
                    title="Vista tarjetas simétricas"
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${
                      viewMode === 'cards' ? 'bg-indigo-600 text-white' : 'opacity-75 hover:opacity-100'
                    }`}
                  >
                    <LayoutGrid size={13} /> Tarjetas
                  </button>
                </div>
              </div>
            }
            innerStyle={innerStyle}
          />

          {/* Guía desplegable de los 5 niveles de confianza (qué habilita cada nivel) */}
          {showTrustGuide && (
            <TrustLevelsGuide
              innerStyle={innerStyle}
              onClose={() => setShowTrustGuide(false)}
            />
          )}

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
            /* VISTA A: TARJETAS SIMÉTRICAS DE ALTURA UNIFORME (3 bandas fijas: cabecera, cuerpo flex-1, pie mt-auto) */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              {pagedPeople.pageItems.map((person) => {
                const criminalMeta = getDocExpiryMeta(person.criminal_record_expiry);
                const artMeta = getDocExpiryMeta(person.insurance_expiry);
                const hasProfile = person.specialties.length > 0;
                const hasExpired = Boolean(
                  person.readiness?.criminalExpired || person.readiness?.artExpired
                );
                const isDangerState =
                  person.user_is_active === false ||
                  person.trust_badge?.tone === 'danger' ||
                  hasExpired;
                const visPill = getVisibilityPillMeta(person);
                const canGrantSocio =
                  person.user_is_active !== false &&
                  Number(person.trust_badge?.level || 0) >= 4 &&
                  !hasExpired;
                const visibleStandardSpecs = person.standardSpecs.slice(0, 3);
                const hiddenStandardCount = Math.max(0, person.standardSpecs.length - 3);

                return (
                  <article
                    key={person.user_key}
                    className="rounded-xl p-4 sm:p-5 border border-white/10 flex flex-col justify-between gap-3.5 text-xs h-full"
                    style={innerStyle}
                  >
                    {/* Cabecera de persona: Identidad + Estadio N1-N5 + Visibilidad real + Membresía (solo N4+) */}
                    <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-white/10">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-black truncate">{person.full_name}</h4>
                          <ProviderTrustBadge trust={person.trust_badge} showLevel compact />
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${visPill.cls}`}
                            title={person.readiness?.missingReasons?.join(' · ') || visPill.label}
                          >
                            {visPill.visible ? <Eye size={10} /> : <EyeOff size={10} />}
                            {visPill.label}
                          </span>
                          {person.is_verified_member && person.user_is_active !== false && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-400/45 bg-amber-500/15 text-amber-200">
                              <Award size={10} /> Socio
                              {person.membership_ends_at
                                ? ` · hasta ${formatShortDate(person.membership_ends_at)}`
                                : ''}
                            </span>
                          )}
                        </div>
                        <TrustLevelMeter
                          level={person.trust_badge?.level}
                          isDanger={isDangerState}
                        />
                        <p className="text-[11px] opacity-80 truncate">
                          DNI <strong className="font-mono">{person.dni}</strong> · {person.email}
                        </p>
                      </div>

                      {/* Acción comercial Socio Verificado: solo habilitada a partir de Nivel 4 (o si ya es Socio) */}
                      {person.user_id && hasProfile && (canGrantSocio || person.is_verified_member) && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!person.is_verified_member ? (
                            <button
                              type="button"
                              onClick={() => handleManageMembership(person.user_id, 'activate', 30)}
                              disabled={updatingMembershipUserId === person.user_id}
                              title="Activar membresía Socio Verificado por 30 días (sube a Nivel 5)"
                              className="border border-amber-400/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 font-bold px-2.5 py-1 rounded-lg text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-45"
                            >
                              <Award size={11} /> Socio 30d (→ N5)
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

                    {/* Banda central flexible: checklist de nivel N1-N5, documentos, rubros y requisitos */}
                    <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <TrustChecksStrip
                        trust={person.trust_badge}
                        hasExpiredDocs={hasExpired}
                        compact
                      />
                    </div>

                    {/* Documentación personal consolidada (DNI + Antecedentes + ART sin ruido de "Sin vencimiento") */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div
                        className="rounded-xl p-2.5 border border-white/10 space-y-1.5"
                        style={cardStyle}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[11px] inline-flex items-center gap-1">
                            <UserCheck size={12} className="text-indigo-300 shrink-0" />
                            DNI
                          </span>
                          {person.dni_document_url ? (
                            <a
                              href={person.dni_document_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-bold text-indigo-300 underline underline-offset-2 hover:text-indigo-200"
                            >
                              Ver DNI
                            </a>
                          ) : (
                            <span className="text-[10px] opacity-60">Sin archivo</span>
                          )}
                        </div>
                        <div
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            person.identity_verified
                              ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
                              : person.dni_document_url
                                ? 'border-sky-500/40 bg-sky-950/40 text-sky-200'
                                : 'border-amber-600/50 bg-amber-950/40 text-amber-200'
                          }`}
                        >
                          <span>
                            {person.identity_verified
                              ? 'DNI Validado ✓'
                              : person.dni_document_url
                                ? 'Cargado · Validar'
                                : 'Pendiente'}
                          </span>
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
                          {person.insurance_policy_url && (
                            <a
                              href={person.insurance_policy_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-bold text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
                            >
                              Abrir PDF
                            </a>
                          )}
                        </div>
                        {person.insurance_policy_url ? (
                          <div
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${artMeta.badgeClass}`}
                          >
                            <Calendar size={10} className="shrink-0" />
                            <span>{artMeta.label}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-700/55 bg-amber-950/40 text-amber-200">
                            ✗ Falta cargar
                          </span>
                        )}
                      </div>

                      <div
                        className="rounded-xl p-2.5 border border-white/10 space-y-1.5"
                        style={cardStyle}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[11px] inline-flex items-center gap-1">
                            <FileText size={12} className="text-sky-400 shrink-0" />
                            Antecedentes
                          </span>
                          {person.criminal_record_url && (
                            <a
                              href={person.criminal_record_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-bold text-sky-300 underline underline-offset-2 hover:text-sky-200"
                            >
                              Abrir PDF
                            </a>
                          )}
                        </div>
                        {person.criminal_record_url ? (
                          <div
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${criminalMeta.badgeClass}`}
                          >
                            <Calendar size={10} className="shrink-0" />
                            <span>{criminalMeta.label}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-700/55 bg-amber-950/40 text-amber-200">
                            ✗ Falta cargar
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Resumen compacto de requisitos faltantes cuando no es Nivel 4 completo */}
                    {(!person.isPersonApproved || !person.readiness?.isVisibleInResidentPortal) &&
                      person.readiness?.missingReasons?.length > 0 && (
                        <div className="rounded-xl px-3 py-2 border border-amber-700/40 bg-amber-950/20 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <span className="font-semibold text-amber-200">
                            Pendiente: {person.readiness.missingReasons.join(' · ')}
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
                          {visibleStandardSpecs.map((spec) => {
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
                          {hiddenStandardCount > 0 && (
                            <span
                              className="inline-flex items-center px-2.5 py-1 rounded-lg border border-white/15 text-[11px] font-bold opacity-80"
                              style={cardStyle}
                              title={person.standardSpecs.slice(3).map((s) => s.specialty).join(' · ')}
                            >
                              +{hiddenStandardCount} más
                            </span>
                          )}
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

                    </div>

                    {/* Banda inferior fija al pie en 1 línea para todas las tarjetas (simetría visual) */}
                    <div className="mt-auto pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                      <span className="text-[11px] opacity-75 truncate">
                        {!hasProfile
                          ? 'Esperando carga del prestador'
                          : person.isPersonApproved
                            ? 'Compliance verificado'
                            : person.readiness?.hasCriminalOk && person.readiness?.hasArtOk
                              ? 'Listo para aprobar'
                              : 'Falta documentación vigente'}
                      </span>
                      <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                        {person.user_id &&
                          person.user_is_active !== false &&
                          !person.isPersonApproved && (
                            <button
                              type="button"
                              disabled={updatingIdentityUserId === person.user_id}
                              onClick={() =>
                                handleToggleIdentity(person.user_id, !person.identity_verified)
                              }
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer disabled:opacity-45 ${
                                person.identity_verified
                                  ? 'border-sky-500/40 bg-sky-950/50 text-sky-200 hover:bg-sky-900/60'
                                  : 'border-indigo-400/50 bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30'
                              }`}
                              title={
                                person.identity_verified
                                  ? 'DNI validado (Nivel 1 habilitado). Clic para revocar.'
                                  : 'Validar DNI para habilitar Perfil Básico (Nivel 1) en el directorio'
                              }
                            >
                              {person.identity_verified ? 'DNI Validado ✓' : 'Validar DNI (→ N1)'}
                            </button>
                          )}
                        {hasProfile ? (
                          renderPersonComplianceActions(person)
                        ) : person.phone ? (
                          <a
                            href={`https://wa.me/${String(person.phone).replace(/\D/g, '')}?text=${encodeURIComponent(
                              `Hola ${person.first_name || person.full_name}, te escribimos desde TrustLink. Para aparecer visible en el Portal de Residentes solo te falta cargar tu DNI, Póliza ART, Antecedentes Penales y tu especialidad desde tu Portal Prestador.`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600/85 hover:bg-emerald-500 text-white"
                          >
                            <MessageCircle size={11} /> Recordar por WhatsApp
                          </a>
                        ) : (
                          <span className="text-[11px] opacity-60">Sin teléfono</span>
                        )}
                      </div>
                    </div>
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
                    <th className="py-2.5 px-3">Prestador y Estadio N1–N5</th>
                    <th className="py-2.5 px-3">Documentación</th>
                    <th className="py-2.5 px-3">Rubros y Moderación</th>
                    <th className="py-2.5 px-3 text-right">Próxima Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {pagedPeople.pageItems.map((person) => {
                    const criminalMeta = getDocExpiryMeta(person.criminal_record_expiry);
                    const artMeta = getDocExpiryMeta(person.insurance_expiry);
                    const hasProfile = person.specialties.length > 0;
                    const hasExpired = Boolean(
                      person.readiness?.criminalExpired || person.readiness?.artExpired
                    );
                    const isDangerState =
                      person.user_is_active === false ||
                      person.trust_badge?.tone === 'danger' ||
                      hasExpired;
                    const visPill = getVisibilityPillMeta(person);
                    const canGrantSocio =
                      person.user_is_active !== false &&
                      Number(person.trust_badge?.level || 0) >= 4 &&
                      !hasExpired;

                    return (
                      <tr key={person.user_key} className="align-top hover:bg-white/5">
                        <td className="py-3 px-3 space-y-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs">{person.full_name}</span>
                            <ProviderTrustBadge trust={person.trust_badge} showLevel compact />
                            <span
                              className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${visPill.cls}`}
                              title={person.readiness?.missingReasons?.join(' · ') || visPill.label}
                            >
                              {visPill.visible ? <Eye size={9} /> : <EyeOff size={9} />}
                              {visPill.label}
                            </span>
                          </div>
                          <TrustLevelMeter
                            level={person.trust_badge?.level}
                            isDanger={isDangerState}
                          />
                          <TrustChecksStrip
                            trust={person.trust_badge}
                            hasExpiredDocs={hasExpired}
                            compact
                          />
                          <div className="text-[11px] opacity-75 font-mono">
                            DNI {person.dni} · <span className="font-sans opacity-90">{person.email}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {person.dni_document_url ? (
                              <a
                                href={person.dni_document_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-bold text-indigo-300 underline"
                              >
                                Ver DNI
                              </a>
                            ) : (
                              <span className="text-[11px] opacity-60">DNI</span>
                            )}
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                person.identity_verified
                                  ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
                                  : person.dni_document_url
                                    ? 'border-sky-500/40 bg-sky-950/40 text-sky-200'
                                    : 'border-amber-600/50 bg-amber-950/40 text-amber-200'
                              }`}
                            >
                              {person.identity_verified
                                ? 'DNI Validado ✓'
                                : person.dni_document_url
                                  ? 'En revisión'
                                  : 'Pendiente'}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {person.insurance_policy_url ? (
                              <>
                                <a
                                  href={person.insurance_policy_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] font-bold text-emerald-300 underline"
                                >
                                  ART
                                </a>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${artMeta.badgeClass}`}
                                >
                                  {artMeta.label}
                                </span>
                              </>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-700/55 bg-amber-950/40 text-amber-200">
                                ✗ Falta Póliza ART
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {person.criminal_record_url ? (
                              <>
                                <a
                                  href={person.criminal_record_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] font-bold text-sky-300 underline"
                                >
                                  Antec.
                                </a>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${criminalMeta.badgeClass}`}
                                >
                                  {criminalMeta.label}
                                </span>
                              </>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-700/55 bg-amber-950/40 text-amber-200">
                                ✗ Falta Antecedentes
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 space-y-1.5">
                          {hasProfile ? (
                            <>
                              {person.standardSpecs.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {person.standardSpecs.slice(0, 3).map((spec) => (
                                    <span
                                      key={spec.provider_id}
                                      className="px-2 py-0.5 rounded-md border border-white/15 text-[10px] font-semibold"
                                      style={cardStyle}
                                    >
                                      {spec.specialty}
                                    </span>
                                  ))}
                                  {person.standardSpecs.length > 3 && (
                                    <span
                                      className="px-2 py-0.5 rounded-md border border-white/15 text-[10px] font-bold opacity-80"
                                      style={cardStyle}
                                      title={person.standardSpecs.slice(3).map((s) => s.specialty).join(' · ')}
                                    >
                                      +{person.standardSpecs.length - 3} más
                                    </span>
                                  )}
                                </div>
                              )}
                              {!person.readiness?.isVisibleInResidentPortal &&
                                person.readiness?.missingReasons?.length > 0 && (
                                  <p className="text-[10px] text-amber-300/90">
                                    {person.readiness.missingReasons.join(' · ')}
                                  </p>
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
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                {person.user_is_active !== false && !person.isPersonApproved && (
                                  <button
                                    type="button"
                                    disabled={updatingIdentityUserId === person.user_id}
                                    onClick={() =>
                                      handleToggleIdentity(person.user_id, !person.identity_verified)
                                    }
                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer disabled:opacity-45 ${
                                      person.identity_verified
                                        ? 'border-sky-500/40 bg-sky-950/50 text-sky-200 hover:bg-sky-900/60'
                                        : 'border-indigo-400/50 bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30'
                                    }`}
                                    title={
                                      person.identity_verified
                                        ? 'DNI validado (Nivel 1 habilitado). Clic para revocar.'
                                        : 'Validar DNI para habilitar Perfil Básico (Nivel 1) en el directorio'
                                    }
                                  >
                                    {person.identity_verified ? 'DNI Validado ✓' : 'Validar DNI (→ N1)'}
                                  </button>
                                )}
                                {renderPersonComplianceActions(person)}
                              </div>
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
                              ) : canGrantSocio ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleManageMembership(person.user_id, 'activate', 30)
                                  }
                                  disabled={updatingMembershipUserId === person.user_id}
                                  title="Activar membresía Socio Verificado por 30 días (sube a Nivel 5)"
                                  className="border border-amber-400/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 font-bold px-2.5 py-1 rounded-lg text-[10px] inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Award size={10} /> Socio 30d (→ N5)
                                </button>
                              ) : null}
                            </div>
                          ) : (
                            <div className="inline-flex flex-col items-end gap-1.5">
                              {person.user_id && person.user_is_active !== false && (
                                <button
                                  type="button"
                                  disabled={updatingIdentityUserId === person.user_id}
                                  onClick={() =>
                                    handleToggleIdentity(person.user_id, !person.identity_verified)
                                  }
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer disabled:opacity-45 ${
                                    person.identity_verified
                                      ? 'border-sky-500/40 bg-sky-950/50 text-sky-200'
                                      : 'border-indigo-400/50 bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30'
                                  }`}
                                  title={
                                    person.identity_verified
                                      ? 'DNI validado. Clic para revocar.'
                                      : 'Validar DNI del prestador'
                                  }
                                >
                                  {person.identity_verified ? 'DNI Validado ✓' : 'Validar DNI (→ N1)'}
                                </button>
                              )}
                              <span className="text-[10px] opacity-70">Esperando especialidad</span>
                              {person.phone && (
                                <a
                                  href={`https://wa.me/${String(person.phone).replace(/\D/g, '')}?text=${encodeURIComponent(
                                    `Hola ${person.first_name || person.full_name}, te escribimos desde TrustLink. Para aparecer visible en el Portal de Residentes solo te falta cargar tu DNI, Póliza ART, Antecedentes Penales y tu especialidad desde tu Portal Prestador.`
                                  )}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-600/85 hover:bg-emerald-500 text-white"
                                >
                                  <MessageCircle size={10} /> Recordar
                                </a>
                              )}
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

          <AdminPaginationBar
            page={pagedPeople.safePage}
            totalPages={pagedPeople.totalPages}
            totalItems={pagedPeople.totalItems}
            pageSize={compliancePageSize}
            onPageChange={setCompliancePage}
            onPageSizeChange={(nextSize) => {
              setCompliancePageSize(nextSize);
              setCompliancePage(1);
            }}
            itemLabel="prestador(es)"
            innerStyle={innerStyle}
          />
        </section>
      )}

      {/* PESTAÑA 2: RECLAMOS Y GARANTÍA POST-SERVICIO */}
      {activeTab === 'disputes' && (
        <section className={SECTION_CARD_CLASS} style={cardStyle}>
          <AdminListToolbar
            searchValue={disputeSearch}
            onSearchChange={(val) => {
              setDisputeSearch(val);
              setDisputePage(1);
            }}
            searchPlaceholder="Buscar por #reclamo, contrato, residente, prestador o motivo..."
            chips={[
              { id: 'all', label: 'Todos', count: disputeCounts.all },
              { id: 'open', label: 'Abiertos', count: disputeCounts.open },
              { id: 'resolved', label: 'Resueltos', count: disputeCounts.resolved },
              { id: 'rejected', label: 'Desestimados', count: disputeCounts.rejected },
            ]}
            activeChip={disputeStatusFilter}
            onChipChange={(chip) => {
              setDisputeStatusFilter(chip);
              setDisputePage(1);
            }}
            hasActiveFilters={Boolean(disputeSearch.trim() || disputeStatusFilter !== 'all')}
            onResetFilters={() => {
              setDisputeSearch('');
              setDisputeStatusFilter('all');
              setDisputePage(1);
            }}
            innerStyle={innerStyle}
          />

          {pagedDisputes.pageItems.length === 0 ? (
            <div
              className="text-center py-8 rounded-xl border border-white/10 text-xs opacity-75"
              style={innerStyle}
            >
              No hay reclamos post-servicio que coincidan con los filtros actuales.
            </div>
          ) : (
            <div className={ITEMS_GRID_CLASS}>
              {pagedDisputes.pageItems.map((d) => {
                const isOpen = d.status === 'open' || d.status === 'in_review';
                const statusLabel =
                  d.status === 'open'
                    ? 'Abierto'
                    : d.status === 'in_review'
                    ? 'En revisión'
                    : d.status === 'resolved'
                    ? 'Resuelto'
                    : 'Desestimado';
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
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                            isOpen
                              ? 'bg-rose-950/70 text-rose-200 border-rose-700'
                              : d.status === 'resolved'
                              ? 'bg-emerald-950/70 text-emerald-200 border-emerald-700'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {statusLabel}
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

          <AdminPaginationBar
            page={pagedDisputes.safePage}
            totalPages={pagedDisputes.totalPages}
            totalItems={pagedDisputes.totalItems}
            pageSize={disputePageSize}
            onPageChange={setDisputePage}
            onPageSizeChange={(nextSize) => {
              setDisputePageSize(nextSize);
              setDisputePage(1);
            }}
            itemLabel="reclamo(s)"
            innerStyle={innerStyle}
          />
        </section>
      )}
    </div>
  );
}
