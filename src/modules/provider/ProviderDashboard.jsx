/**
 * @file ProviderDashboard.jsx
 * @description Portal del Prestador unificado estéticamente y en ritmo UX/UI con Portal Residente.
 * Organiza la operación integral del prestador en una secuencia de 6 pasos:
 * 1. Credenciales y Compliance: carga y edición del historial documental (antecedentes penales y póliza ART/seguro
 *    con vigencias), alertas proactivas de vencimiento (≤ 30 días o vencidos con bloqueo en garita), gestión de
 *    especialidades con visibilidad persistente en el directorio y suscripción/renovación de Membresía "Socio Verificado".
 * 2. Flota Vehicular y Cuadrilla/Ayudantes: registro y edición de vehículos con seguro automotor y administración
 *    completa de ayudantes (DNI, rol, contacto y vigencia de ART).
 * 3. Agenda Online y Disponibilidad: alta y eliminación de bloqueos manuales (horarios no laborables o visitas
 *    externas) integrados con franjas bloqueadas automáticamente por visitas y pases de TrustLink.
 * 4. Solicitudes de Visita: revisión de pedidos entrantes de residentes, mensajería contextual y confirmación o
 *    rechazo de disponibilidad sincronizado con la agenda.
 * 5. Pases QR: listado paginado con búsqueda y filtros de estado, visualización de cuadrilla autorizada, copia de
 *    token y modal con código QR escaneable en garita.
 * 6. Ingresos, Contratos y Reseñas Cruzadas: resumen de ingresos netos estimados (93%), contratos con emisión de
 *    comprobantes imprimibles, reseñas recibidas y calificación recíproca al residente.
 * @location /trustlink-web/src/modules/provider/ProviderDashboard.jsx
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Car,
  Plus,
  Edit3,
  Save,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Star,
  MessageSquare,
  Send,
  FileText,
  Award,
  Eye,
  EyeOff,
  History,
  RefreshCw,
  QrCode,
  Search,
  Copy,
  Check,
  Calendar,
  MapPin,
  Trash2,
  Clock,
  Users,
  Printer,
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';
import { API_BASE } from '../../config/api';
import QrCodeDisplay from '../../components/QrCodeDisplay';
import { printServiceReceipt } from '../../utils/receiptPrinter';
import {
  PAGE_SHELL_CLASS,
  SECTION_CARD_CLASS,
  ITEMS_GRID_CLASS,
  ITEM_CARD_CLASS,
  formatDateTimeAR,
  getUnifiedStatusMeta,
} from '../../config/uiTokens';

/** Cantidad máxima de pases QR mostrados por página en la pestaña de Pases. */
const PASSES_PER_PAGE = 6;

/**
 * Convierte un objeto `Date` al formato local `YYYY-MM-DDTHH:mm` requerido por inputs `datetime-local`.
 * @param {Date} dateObj - Instancia de fecha/hora a formatear.
 * @returns {string} Fecha y hora local formateada para controles HTML `datetime-local`.
 */
const toLocalDateTimeInput = (dateObj) => {
  const pad = (n) => String(n).padStart(2, '0');
  const y = dateObj.getFullYear();
  const m = pad(dateObj.getMonth() + 1);
  const d = pad(dateObj.getDate());
  const hh = pad(dateObj.getHours());
  const mm = pad(dateObj.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
};

/**
 * Evalúa la vigencia de una fecha de vencimiento documental respecto del día actual.
 * Clasifica el estado en "Vencido" (< 0 días), "Por vencer" (≤ 30 días), "Vigente" (> 30 días) o "Sin fecha".
 * @param {string|Date|null|undefined} expiryDateStr - Fecha de vencimiento a evaluar.
 * @returns {{ label: string, tone: 'neutral'|'danger'|'warning'|'success' }} Etiqueta legible y tono semántico para badges.
 */
function getValidityStatus(expiryDateStr) {
  if (!expiryDateStr) {
    return { label: 'Sin fecha', tone: 'neutral' };
  }

  const parsed = new Date(expiryDateStr);
  if (Number.isNaN(parsed.getTime())) {
    return { label: 'Sin fecha', tone: 'neutral' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: 'Vencido', tone: 'danger' };
  }
  if (diffDays <= 30) {
    return { label: 'Por vencer', tone: 'warning' };
  }
  return { label: 'Vigente', tone: 'success' };
}

/**
 * Formatea una fecha en formato corto localizado para Argentina (`es-AR`).
 * @param {string|Date|null|undefined} dateStr - Valor de fecha a formatear.
 * @returns {string} Fecha legible (`DD/MM/YYYY`) o `'Sin fecha'` si es inválida o vacía.
 */
function formatDateShort(dateStr) {
  if (!dateStr) return 'Sin fecha';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return 'Sin fecha';
  return parsed.toLocaleDateString('es-AR');
}

/**
 * Formatea una fecha con hora en formato localizado `es-AR` (`DD/MM/YYYY, HH:mm`).
 * @param {string|Date|null|undefined} value - Fecha/hora en formato ISO o instancia `Date`.
 * @returns {string} Fecha y hora formateadas, `'—'` si está vacía o el valor original como texto si no es parseable.
 */
function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Normaliza una fecha al formato `YYYY-MM-DD` esperado por inputs HTML `type="date"`.
 * @param {string|Date|null|undefined} dateStr - Fecha en formato ISO, cadena prefijada `YYYY-MM-DD` o instancia `Date`.
 * @returns {string} Fecha `YYYY-MM-DD` o cadena vacía si no es válida.
 */
function toDateInputValue(dateStr) {
  if (!dateStr) return '';
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr.slice(0, 10);
  }
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

/**
 * Traduce el estado técnico de un pase QR a una etiqueta descriptiva en español.
 * @param {string|null|undefined} status - Código de estado (`pending`, `used`, `expired`, `cancelled`).
 * @returns {string} Etiqueta legible para mostrar en encabezados y modales.
 */
function getPassStatusLabel(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'pending') return 'Vigente / Pendiente';
  if (normalized === 'used') return 'Utilizado';
  if (normalized === 'expired') return 'Vencido';
  if (normalized === 'cancelled') return 'Cancelado';
  return status || 'Sin estado';
}

/**
 * Traduce el tipo de bloqueo de agenda del prestador a una etiqueta legible en español.
 * @param {string|null|undefined} blockType - Código de tipo (`external_visit`, `trustlink_visit`, `trustlink_pass`, `unavailable`).
 * @returns {string} Descripción legible del origen o naturaleza del bloqueo.
 */
function getBlockTypeLabel(blockType) {
  const t = String(blockType || '').toLowerCase();
  if (t === 'external_visit') return 'Visita Externa';
  if (t === 'trustlink_visit') return 'Visita TrustLink';
  if (t === 'trustlink_pass') return 'Pase QR Bloqueado';
  return 'Horario No Laborable';
}

/**
 * Componente principal del Portal Prestador.
 * Centraliza la gestión de cumplimiento documental, membresía Socio Verificado, especialidades,
 * flota vehicular, cuadrilla de ayudantes, agenda online, solicitudes de visita, pases QR,
 * ingresos/comprobantes y reseñas cruzadas con residentes.
 * @component
 * @returns {JSX.Element} Interfaz completa del panel del prestador.
 */
export default function ProviderDashboard() {
  const { brand } = useBranding();

  // Tokens visuales de acción primaria y superficies compartidos con Portal Residente
  const primaryColor = brand?.primaryActionColor || brand?.primaryColor || '#059669';

  const cardStyle = {
    backgroundColor: brand?.cardBgColor || '#020617',
    color: brand?.cardTextColor || '#F1F5F9',
  };

  const innerStyle = {
    backgroundColor: brand?.innerBgColor || '#0F172A',
    color: brand?.innerTextColor || '#E2E8F0',
  };

  // Navegación principal por pasos: 'credentials' -> 'vehicles' -> 'schedule' -> 'visits' -> 'passes' -> 'reviews'
  const [activeStep, setActiveStep] = useState('credentials');

  // Estado global del perfil del prestador, membresía Socio Verificado y mensajes de feedback
  const [profileData, setProfileData] = useState({
    providers: [],
    vehicles: [],
    employees: [],
    expiry_alerts: [],
    membership: null,
    membership_plans: [],
  });
  const [showMembershipPlans, setShowMembershipPlans] = useState(false);
  const [subscribingPlan, setSubscribingPlan] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Paso 1: Credenciales — alta de documentación de compliance (Antecedentes / ART)
  const [showDocForm, setShowDocForm] = useState(false);
  const [docType, setDocType] = useState('Antecedentes Penales');
  const [docUrl, setDocUrl] = useState('');
  const [docValidFrom, setDocValidFrom] = useState('');
  const [docValidTo, setDocValidTo] = useState('');
  const [savingDoc, setSavingDoc] = useState(false);

  // Paso 1: Edición inline de documentos existentes en el historial
  const [editingDocKey, setEditingDocKey] = useState(null);
  const [editDocUrl, setEditDocUrl] = useState('');
  const [editDocValidFrom, setEditDocValidFrom] = useState('');
  const [editDocValidTo, setEditDocValidTo] = useState('');
  const [updatingDoc, setUpdatingDoc] = useState(false);

  // Paso 1: Alta, edición y control de visibilidad en directorio de especialidades
  const [showSpecialtyForm, setShowSpecialtyForm] = useState(false);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [savingSpecialty, setSavingSpecialty] = useState(false);
  const [togglingVisibilityId, setTogglingVisibilityId] = useState(null);
  const [editingSpecialtyId, setEditingSpecialtyId] = useState(null);
  const [editSpecialtyName, setEditSpecialtyName] = useState('');
  const [updatingSpecialty, setUpdatingSpecialty] = useState(false);

  // Paso 2: Flota Vehicular — formulario de alta de vehículos y seguro automotor
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vehType, setVehType] = useState('utilitario');
  const [vehBrand, setVehBrand] = useState('');
  const [vehModel, setVehModel] = useState('');
  const [vehColor, setVehColor] = useState('');
  const [vehPlate, setVehPlate] = useState('');
  const [vehInsuranceUrl, setVehInsuranceUrl] = useState('');
  const [vehInsuranceFrom, setVehInsuranceFrom] = useState('');
  const [vehInsuranceExpiry, setVehInsuranceExpiry] = useState('');
  const [savingVehicle, setSavingVehicle] = useState(false);

  // Paso 2: Edición inline de vehículos y pólizas automotor existentes
  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [editVehType, setEditVehType] = useState('utilitario');
  const [editVehBrand, setEditVehBrand] = useState('');
  const [editVehModel, setEditVehModel] = useState('');
  const [editVehColor, setEditVehColor] = useState('');
  const [editVehPlate, setEditVehPlate] = useState('');
  const [editVehInsuranceUrl, setEditVehInsuranceUrl] = useState('');
  const [editVehInsuranceFrom, setEditVehInsuranceFrom] = useState('');
  const [editVehInsuranceExpiry, setEditVehInsuranceExpiry] = useState('');
  const [updatingVehicle, setUpdatingVehicle] = useState(false);

  // Paso 2b: Ayudantes / Cuadrilla — formulario de alta con DNI y cobertura ART
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [empFullName, setEmpFullName] = useState('');
  const [empDni, setEmpDni] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empRoleLabel, setEmpRoleLabel] = useState('Ayudante');
  const [empInsuranceUrl, setEmpInsuranceUrl] = useState('');
  const [empInsuranceExpiry, setEmpInsuranceExpiry] = useState('');
  const [savingEmployee, setSavingEmployee] = useState(false);

  // Paso 2b: Edición inline de ayudantes registrados en la cuadrilla
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const [editEmpFullName, setEditEmpFullName] = useState('');
  const [editEmpDni, setEditEmpDni] = useState('');
  const [editEmpPhone, setEditEmpPhone] = useState('');
  const [editEmpRoleLabel, setEditEmpRoleLabel] = useState('Ayudante');
  const [editEmpInsuranceUrl, setEditEmpInsuranceUrl] = useState('');
  const [editEmpInsuranceExpiry, setEditEmpInsuranceExpiry] = useState('');
  const [updatingEmployee, setUpdatingEmployee] = useState(false);

  // Paso 3: Agenda Online — listado de franjas ocupadas y alta de bloqueos manuales
  const [scheduleBlocks, setScheduleBlocks] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [blockType, setBlockType] = useState('unavailable');
  const [blockTitle, setBlockTitle] = useState('');
  const [blockStart, setBlockStart] = useState(() =>
    toLocalDateTimeInput(new Date(Date.now() + 60 * 60 * 1000))
  );
  const [blockEnd, setBlockEnd] = useState(() =>
    toLocalDateTimeInput(new Date(Date.now() + 3 * 60 * 60 * 1000))
  );
  const [savingBlock, setSavingBlock] = useState(false);

  // Paso 4: Solicitudes de Visita — pedidos entrantes y borradores de respuesta
  const [incomingVisits, setIncomingVisits] = useState([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [visitReplyDrafts, setVisitReplyDrafts] = useState({});
  const [respondingVisitId, setRespondingVisitId] = useState(null);

  // Paso 5: Pases QR — listado asignado, búsqueda, filtro por estado, paginación y modal de detalle
  const [assignedPasses, setAssignedPasses] = useState([]);
  const [loadingPasses, setLoadingPasses] = useState(false);
  const [passesError, setPassesError] = useState('');
  const [passSearch, setPassSearch] = useState('');
  const [passStatusFilter, setPassStatusFilter] = useState('all');
  const [passPage, setPassPage] = useState(1);
  const [copiedPassId, setCopiedPassId] = useState(null);
  const [selectedPassModal, setSelectedPassModal] = useState(null);

  // Paso 6: Contratos, Ingresos netos (93%), comprobantes imprimibles y reseñas cruzadas
  const [providerContracts, setProviderContracts] = useState([]);
  const [providerEarningsSummary, setProviderEarningsSummary] = useState(null);
  const [loadingReceiptId, setLoadingReceiptId] = useState(null);
  const [reviewContracts, setReviewContracts] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [ownerRatingDrafts, setOwnerRatingDrafts] = useState({});
  const [ownerCommentDrafts, setOwnerCommentDrafts] = useState({});
  const [submittingOwnerReviewId, setSubmittingOwnerReviewId] = useState(null);

  /**
   * Construye las cabeceras HTTP de autorización con el token JWT persistido en `localStorage`.
   * @returns {{ Authorization: string }} Cabecera Bearer para las solicitudes al backend.
   */
  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
  });

  /**
   * Obtiene el perfil integral del prestador autenticado (`/api/v1/providers/me`),
   * incluyendo especialidades, flota vehicular, ayudantes, alertas de vencimiento y membresía.
   * @returns {Promise<void>}
   */
  const fetchProviderProfile = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/me`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setProfileData({
          providers: data.providers || [],
          vehicles: data.vehicles || [],
          employees: data.employees || [],
          expiry_alerts: data.expiry_alerts || [],
          membership: data.membership || null,
          membership_plans: data.membership_plans || [],
        });
      } else {
        setErrorMsg(data.error || 'No se pudo cargar el perfil del prestador.');
      }
    } catch (error) {
      console.error('Error al cargar perfil de prestador:', error);
      setErrorMsg('Error de conexión con el servidor backend.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Carga los bloques de agenda del prestador (manuales y generados por visitas o pases QR).
   * @returns {Promise<void>}
   */
  const fetchProviderSchedule = async () => {
    setLoadingSchedule(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/schedule/provider`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setScheduleBlocks(data.blocks || []);
      }
    } catch (error) {
      console.error('Error al cargar agenda del prestador:', error);
    } finally {
      setLoadingSchedule(false);
    }
  };

  /**
   * Consulta las solicitudes de visita entrantes enviadas por residentes junto con su hilo de mensajes.
   * @returns {Promise<void>}
   */
  const fetchIncomingVisits = async () => {
    setLoadingVisits(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/visit-requests/provider`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setIncomingVisits(data.visits || []);
      }
    } catch (error) {
      console.error('Error al cargar solicitudes de visita:', error);
    } finally {
      setLoadingVisits(false);
    }
  };

  /**
   * Recupera los pases QR asignados al prestador para validar su ingreso en garita.
   * @returns {Promise<void>}
   */
  const fetchAssignedPasses = async () => {
    setLoadingPasses(true);
    setPassesError('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/provider`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setAssignedPasses(data.passes || data.items || []);
      } else {
        setPassesError(
          data.error || 'No se pudieron cargar los pases QR asignados al prestador.'
        );
      }
    } catch (error) {
      console.error('Error al cargar pases QR del prestador:', error);
      setPassesError('Error de conexión al consultar los pases QR.');
    } finally {
      setLoadingPasses(false);
    }
  };

  /**
   * Obtiene el historial de contratos con reseñas cruzadas desde la perspectiva del prestador.
   * @returns {Promise<void>}
   */
  const fetchProviderReviewContracts = async () => {
    setLoadingReviews(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/reviews/contracts?portal=provider`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setReviewContracts(data.contracts || []);
      }
    } catch (error) {
      console.error('Error al cargar historial de contratos del prestador:', error);
    } finally {
      setLoadingReviews(false);
    }
  };

  /**
   * Consulta los contratos del prestador y el resumen financiero de ingresos netos (93%) y reclamos.
   * @returns {Promise<void>}
   */
  const fetchProviderContractsSummary = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/contracts/provider`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setProviderContracts(data.contracts || []);
        setProviderEarningsSummary(data.summary || null);
      }
    } catch (error) {
      console.error('Error al cargar contratos/ingresos del prestador:', error);
    }
  };

  /**
   * Solicita los datos del comprobante de servicio de un contrato y dispara su impresión.
   * @param {number|string} contractId - Identificador del contrato a imprimir.
   * @returns {Promise<void>}
   */
  const handlePrintProviderReceipt = async (contractId) => {
    setLoadingReceiptId(contractId);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/contracts/${contractId}/receipt`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok && data.receipt) {
        printServiceReceipt(data.receipt);
      } else {
        setErrorMsg(data.error || 'No se pudo generar el comprobante del servicio.');
      }
    } catch (error) {
      console.error('Error al imprimir comprobante del prestador:', error);
      setErrorMsg('Error de conexión al generar el comprobante.');
    } finally {
      setLoadingReceiptId(null);
    }
  };

  // Carga inicial paralela de todos los módulos del Portal Prestador al montar la vista
  useEffect(() => {
    fetchProviderProfile();
    fetchProviderSchedule();
    fetchIncomingVisits();
    fetchAssignedPasses();
    fetchProviderReviewContracts();
    fetchProviderContractsSummary();
  }, []);

  // Normaliza el historial documental combinando el arreglo estructurado `documents` y los campos legacy por perfil
  const documentHistory = useMemo(() => {
    const items = [];
    const profiles = profileData.providers || [];

    profiles.forEach((prof) => {
      if (Array.isArray(prof.documents) && prof.documents.length > 0) {
        prof.documents.forEach((doc, idx) => {
          items.push({
            key: `doc-${prof.id}-${doc.id || idx}`,
            profileId: prof.id,
            docType: doc.doc_type || doc.type || 'Documento',
            url: doc.url || '',
            validFrom: doc.valid_from || null,
            validTo: doc.valid_to || doc.expires_at || null,
            auditStatus: doc.status || prof.status || 'pending',
            specialty: prof.specialty || '',
          });
        });
      } else {
        const crimUrl = prof.criminal_record_url || '';
        const crimTo = prof.criminal_record_expiry || prof.criminal_record_valid_to || null;
        const crimFrom = prof.criminal_record_valid_from || prof.created_at || null;
        if (crimUrl || crimTo) {
          items.push({
            key: `crim-${prof.id}`,
            profileId: prof.id,
            field: 'criminal',
            docType: 'Antecedentes Penales',
            url: crimUrl,
            validFrom: crimFrom,
            validTo: crimTo,
            auditStatus: prof.status || 'pending',
            specialty: prof.specialty || '',
          });
        }

        const artUrl = prof.art_insurance_url || prof.insurance_policy_url || '';
        const artTo = prof.art_insurance_expiry || prof.insurance_expiry || null;
        const artFrom = prof.art_insurance_valid_from || prof.created_at || null;
        if (artUrl || artTo) {
          items.push({
            key: `art-${prof.id}`,
            profileId: prof.id,
            field: 'art',
            docType: 'Póliza ART / Seguro',
            url: artUrl,
            validFrom: artFrom,
            validTo: artTo,
            auditStatus: prof.status || 'pending',
            specialty: prof.specialty || '',
          });
        }
      }
    });

    return items;
  }, [profileData.providers]);

  // Cantidad de especialidades actualmente visibles para residentes en el directorio
  const activeSpecialtiesCount = useMemo(() => {
    return (profileData.providers || []).filter((p) => p.is_visible_in_directory !== false).length;
  }, [profileData.providers]);

  /**
   * Registra un nuevo documento de compliance (Antecedentes Penales o Póliza ART/Seguro)
   * creando o actualizando el perfil base del prestador según exista previamente.
   * @param {React.FormEvent<HTMLFormElement>} e - Evento de envío del formulario documental.
   * @returns {Promise<void>}
   */
  const handleCreateDocument = async (e) => {
    e.preventDefault();
    setSavingDoc(true);
    setErrorMsg('');
    setSuccessMsg('');

    const baseProfile = profileData.providers[0] || {};
    const isArt = docType.toLowerCase().includes('art') || docType.toLowerCase().includes('seguro');

    const payload = {
      specialty: baseProfile.specialty || 'Servicios Verificados',
      criminal_record_url: !isArt ? docUrl.trim() : baseProfile.criminal_record_url || '',
      criminal_record_from: !isArt ? docValidFrom || null : null,
      criminal_record_expiry: !isArt
        ? docValidTo || null
        : baseProfile.criminal_record_expiry || null,
      art_insurance_url: isArt
        ? docUrl.trim()
        : baseProfile.art_insurance_url || baseProfile.insurance_policy_url || '',
      insurance_policy_url: isArt
        ? docUrl.trim()
        : baseProfile.insurance_policy_url || baseProfile.art_insurance_url || '',
      insurance_from: isArt ? docValidFrom || null : null,
      art_insurance_expiry: isArt
        ? docValidTo || null
        : baseProfile.art_insurance_expiry || baseProfile.insurance_expiry || null,
      insurance_expiry: isArt
        ? docValidTo || null
        : baseProfile.insurance_expiry || baseProfile.art_insurance_expiry || null,
      valid_from: docValidFrom || null,
      valid_to: docValidTo || null,
      document_type: docType,
    };

    try {
      const endpoint = baseProfile.id
        ? `${API_BASE}/api/v1/providers/profile/${baseProfile.id}`
        : `${API_BASE}/api/v1/providers/profile`;
      const method = baseProfile.id ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (response.ok) {
        setSuccessMsg('Documentación cargada y registrada en el historial.');
        setDocUrl('');
        setDocValidFrom('');
        setDocValidTo('');
        setShowDocForm(false);
        await fetchProviderProfile();
      } else {
        setErrorMsg(data.error || 'No se pudo guardar la documentación.');
      }
    } catch (error) {
      console.error('Error al cargar documentación:', error);
      setErrorMsg('Error de conexión con el servidor.');
    } finally {
      setSavingDoc(false);
    }
  };

  /**
   * Activa el modo de edición inline para un documento del historial y precarga sus valores actuales.
   * @param {{ key: string, url?: string, validFrom?: string|null, validTo?: string|null }} docItem - Ítem documental seleccionado.
   */
  const startEditingDocument = (docItem) => {
    setEditingDocKey(docItem.key);
    setEditDocUrl(docItem.url || '');
    setEditDocValidFrom(toDateInputValue(docItem.validFrom));
    setEditDocValidTo(toDateInputValue(docItem.validTo));
    setErrorMsg('');
    setSuccessMsg('');
  };

  /**
   * Persiste los cambios editados de URL y fechas de vigencia de un documento del historial vía PATCH.
   * @param {{ profileId: number|string, field?: string, docType: string }} docItem - Ítem documental en edición.
   * @returns {Promise<void>}
   */
  const handleSaveDocumentEdit = async (docItem) => {
    setUpdatingDoc(true);
    setErrorMsg('');
    setSuccessMsg('');

    const targetProfile =
      profileData.providers.find((p) => p.id === docItem.profileId) || profileData.providers[0] || {};
    const isArt = docItem.field === 'art' || docItem.docType.toLowerCase().includes('art');

    const payload = {
      specialty: targetProfile.specialty || 'Servicios Verificados',
      criminal_record_url: !isArt ? editDocUrl.trim() : targetProfile.criminal_record_url || '',
      criminal_record_from: !isArt ? editDocValidFrom || null : null,
      criminal_record_expiry: !isArt
        ? editDocValidTo || null
        : targetProfile.criminal_record_expiry || null,
      art_insurance_url: isArt
        ? editDocUrl.trim()
        : targetProfile.art_insurance_url || targetProfile.insurance_policy_url || '',
      insurance_policy_url: isArt
        ? editDocUrl.trim()
        : targetProfile.insurance_policy_url || targetProfile.art_insurance_url || '',
      insurance_from: isArt ? editDocValidFrom || null : null,
      art_insurance_expiry: isArt
        ? editDocValidTo || null
        : targetProfile.art_insurance_expiry || targetProfile.insurance_expiry || null,
      insurance_expiry: isArt
        ? editDocValidTo || null
        : targetProfile.insurance_expiry || targetProfile.art_insurance_expiry || null,
      valid_from: editDocValidFrom || null,
      valid_to: editDocValidTo || null,
    };

    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/profile/${targetProfile.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (response.ok) {
        setSuccessMsg('Documento actualizado en el historial.');
        setEditingDocKey(null);
        await fetchProviderProfile();
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar el documento.');
      }
    } catch (error) {
      console.error('Error al actualizar documento:', error);
      setErrorMsg('Error de conexión al actualizar el documento.');
    } finally {
      setUpdatingDoc(false);
    }
  };

  /**
   * Agrega una nueva especialidad/rubro al prestador reutilizando los enlaces documentales del perfil principal.
   * @param {React.FormEvent<HTMLFormElement>} e - Evento de envío del formulario de especialidad.
   * @returns {Promise<void>}
   */
  const handleCreateSpecialty = async (e) => {
    e.preventDefault();
    if (!newSpecialty.trim()) return;

    setSavingSpecialty(true);
    setErrorMsg('');
    setSuccessMsg('');

    const currentDoc = profileData.providers[0] || {};

    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          specialty: newSpecialty.trim(),
          criminal_record_url: currentDoc.criminal_record_url || '',
          insurance_policy_url:
            currentDoc.insurance_policy_url || currentDoc.art_insurance_url || '',
        }),
      });
      const data = await response.json();

      if (response.ok) {
        setSuccessMsg('Especialidad agregada correctamente.');
        setNewSpecialty('');
        setShowSpecialtyForm(false);
        await fetchProviderProfile();
      } else {
        setErrorMsg(data.error || 'No se pudo agregar la especialidad.');
      }
    } catch (error) {
      console.error('Error al agregar especialidad:', error);
      setErrorMsg('Error de conexión con el servidor.');
    } finally {
      setSavingSpecialty(false);
    }
  };

  /**
   * Guarda el nuevo nombre de una especialidad editada inline manteniendo sus referencias documentales.
   * @param {Object} specialtyItem - Perfil de especialidad a actualizar.
   * @returns {Promise<void>}
   */
  const handleSaveSpecialtyEdit = async (specialtyItem) => {
    if (!editSpecialtyName.trim()) return;

    setUpdatingSpecialty(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/profile/${specialtyItem.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          specialty: editSpecialtyName.trim(),
          criminal_record_url: specialtyItem.criminal_record_url || '',
          insurance_policy_url:
            specialtyItem.insurance_policy_url || specialtyItem.art_insurance_url || '',
        }),
      });
      const data = await response.json();

      if (response.ok) {
        setSuccessMsg('Especialidad actualizada correctamente.');
        setEditingSpecialtyId(null);
        await fetchProviderProfile();
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar la especialidad.');
      }
    } catch (error) {
      console.error('Error al actualizar especialidad:', error);
      setErrorMsg('Error de conexión al actualizar la especialidad.');
    } finally {
      setUpdatingSpecialty(false);
    }
  };

  /**
   * Alterna de forma persistente en el backend la visibilidad de una especialidad en el directorio de residentes.
   * @param {Object|number|string} specialtyItem - Objeto de especialidad o su identificador.
   * @returns {Promise<void>}
   */
  const toggleSpecialtyVisibility = async (specialtyItem) => {
    const targetId = typeof specialtyItem === 'object' ? specialtyItem.id : specialtyItem;
    const currentVisible =
      typeof specialtyItem === 'object' ? specialtyItem.is_visible_in_directory !== false : true;
    setTogglingVisibilityId(targetId);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/profile/${targetId}/visibility`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ is_visible_in_directory: !currentVisible }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(data.message || 'Visibilidad actualizada en el directorio.');
        await fetchProviderProfile();
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar la visibilidad.');
      }
    } catch (error) {
      console.error('Error al cambiar visibilidad de especialidad:', error);
      setErrorMsg('Error de conexión al actualizar la visibilidad.');
    } finally {
      setTogglingVisibilityId(null);
    }
  };

  /**
   * Da de alta un nuevo vehículo en la flota habilitada del prestador junto con su póliza de seguro opcional.
   * @param {React.FormEvent<HTMLFormElement>} e - Evento de envío del formulario de flota vehicular.
   * @returns {Promise<void>}
   */
  const handleAddVehicle = async (e) => {
    e.preventDefault();
    setSavingVehicle(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/vehicle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          vehicle_type: vehType,
          brand: vehBrand.trim(),
          model: vehModel.trim(),
          color: vehColor.trim(),
          plate: vehPlate.trim().toUpperCase(),
          vehicle_insurance_url: vehInsuranceUrl.trim() || null,
          vehicle_insurance_from: vehInsuranceFrom || null,
          vehicle_insurance_expiry: vehInsuranceExpiry || null,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg('Vehículo y seguro automotor asociados a tu flota correctamente.');
        setVehBrand('');
        setVehModel('');
        setVehColor('');
        setVehPlate('');
        setVehInsuranceUrl('');
        setVehInsuranceFrom('');
        setVehInsuranceExpiry('');
        setShowVehicleForm(false);
        await fetchProviderProfile();
      } else {
        setErrorMsg(data.error || 'No se pudo registrar el vehículo.');
      }
    } catch (error) {
      console.error('Error al registrar vehículo:', error);
      setErrorMsg('Error de conexión con el servidor.');
    } finally {
      setSavingVehicle(false);
    }
  };

  /**
   * Habilita la edición inline de un vehículo y precarga sus datos técnicos y fechas de seguro.
   * @param {Object} v - Registro del vehículo seleccionado.
   */
  const startEditingVehicle = (v) => {
    setEditingVehicleId(v.id);
    setEditVehType(v.vehicle_type || 'utilitario');
    setEditVehBrand(v.brand || '');
    setEditVehModel(v.model || '');
    setEditVehColor(v.color || '');
    setEditVehPlate(v.plate || v.license_plate || '');
    setEditVehInsuranceUrl(v.vehicle_insurance_url || '');
    setEditVehInsuranceFrom(toDateInputValue(v.vehicle_insurance_from));
    setEditVehInsuranceExpiry(toDateInputValue(v.vehicle_insurance_expiry));
    setErrorMsg('');
    setSuccessMsg('');
  };

  /**
   * Actualiza los datos de un vehículo y la vigencia de su seguro automotor mediante PATCH.
   * @param {number|string} vehicleId - Identificador del vehículo a actualizar.
   * @returns {Promise<void>}
   */
  const handleSaveVehicleEdit = async (vehicleId) => {
    setUpdatingVehicle(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/vehicle/${vehicleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          vehicle_type: editVehType,
          brand: editVehBrand.trim(),
          model: editVehModel.trim(),
          color: editVehColor.trim(),
          plate: editVehPlate.trim().toUpperCase(),
          vehicle_insurance_url: editVehInsuranceUrl.trim() || null,
          vehicle_insurance_from: editVehInsuranceFrom || null,
          vehicle_insurance_expiry: editVehInsuranceExpiry || null,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg('Vehículo y póliza de seguro actualizados correctamente.');
        setEditingVehicleId(null);
        await fetchProviderProfile();
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar el vehículo.');
      }
    } catch (error) {
      console.error('Error al actualizar vehículo:', error);
      setErrorMsg('Error de conexión al actualizar el vehículo.');
    } finally {
      setUpdatingVehicle(false);
    }
  };

  /**
   * Registra un nuevo ayudante o integrante en la cuadrilla del prestador con DNI, rol y póliza ART opcional.
   * @param {React.FormEvent<HTMLFormElement>} e - Evento de envío del formulario de cuadrilla.
   * @returns {Promise<void>}
   */
  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setSavingEmployee(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/employees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          full_name: empFullName.trim(),
          dni: empDni.trim(),
          phone: empPhone.trim() || null,
          role_label: empRoleLabel.trim() || 'Ayudante',
          insurance_policy_url: empInsuranceUrl.trim() || null,
          insurance_expiry: empInsuranceExpiry || null,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(data.message || 'Ayudante agregado a tu cuadrilla.');
        setEmpFullName('');
        setEmpDni('');
        setEmpPhone('');
        setEmpRoleLabel('Ayudante');
        setEmpInsuranceUrl('');
        setEmpInsuranceExpiry('');
        setShowEmployeeForm(false);
        await fetchProviderProfile();
      } else {
        setErrorMsg(data.error || 'No se pudo registrar el ayudante.');
      }
    } catch (error) {
      console.error('Error al registrar ayudante:', error);
      setErrorMsg('Error de conexión al registrar el ayudante.');
    } finally {
      setSavingEmployee(false);
    }
  };

  /**
   * Activa la edición inline de un ayudante de la cuadrilla y precarga sus datos y vencimiento de ART.
   * @param {Object} emp - Integrante de cuadrilla seleccionado.
   */
  const startEditingEmployee = (emp) => {
    setEditingEmployeeId(emp.id);
    setEditEmpFullName(emp.full_name || '');
    setEditEmpDni(emp.dni || '');
    setEditEmpPhone(emp.phone || '');
    setEditEmpRoleLabel(emp.role_label || 'Ayudante');
    setEditEmpInsuranceUrl(emp.insurance_policy_url || '');
    setEditEmpInsuranceExpiry(toDateInputValue(emp.insurance_expiry));
    setErrorMsg('');
    setSuccessMsg('');
  };

  /**
   * Persiste los cambios editados de un integrante de la cuadrilla mediante PATCH.
   * @param {number|string} empId - Identificador del ayudante a actualizar.
   * @returns {Promise<void>}
   */
  const handleSaveEmployeeEdit = async (empId) => {
    setUpdatingEmployee(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/employees/${empId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          full_name: editEmpFullName.trim(),
          dni: editEmpDni.trim(),
          phone: editEmpPhone.trim() || null,
          role_label: editEmpRoleLabel.trim() || 'Ayudante',
          insurance_policy_url: editEmpInsuranceUrl.trim() || null,
          insurance_expiry: editEmpInsuranceExpiry || null,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(data.message || 'Ayudante actualizado correctamente.');
        setEditingEmployeeId(null);
        await fetchProviderProfile();
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar el ayudante.');
      }
    } catch (error) {
      console.error('Error al actualizar ayudante:', error);
      setErrorMsg('Error de conexión al actualizar el ayudante.');
    } finally {
      setUpdatingEmployee(false);
    }
  };

  /**
   * Elimina a un ayudante de la cuadrilla habilitada del prestador y refresca el perfil.
   * @param {number|string} empId - Identificador del ayudante a dar de baja.
   * @returns {Promise<void>}
   */
  const handleDeleteEmployee = async (empId) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/employees/${empId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        setSuccessMsg('Ayudante eliminado de tu cuadrilla.');
        await fetchProviderProfile();
      }
    } catch (error) {
      console.error('Error al eliminar ayudante:', error);
    }
  };

  /**
   * Crea un bloqueo manual en la agenda online (horario no laborable o visita externa fuera de TrustLink).
   * @param {React.FormEvent<HTMLFormElement>} e - Evento de envío del formulario de bloqueo de agenda.
   * @returns {Promise<void>}
   */
  const handleCreateScheduleBlock = async (e) => {
    e.preventDefault();
    setSavingBlock(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/schedule/blocks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          block_type: blockType,
          title: blockTitle.trim(),
          start_at: new Date(blockStart).toISOString(),
          end_at: new Date(blockEnd).toISOString(),
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(data.message || 'Bloque agregado a tu agenda.');
        setBlockTitle('');
        await fetchProviderSchedule();
      } else {
        setErrorMsg(data.error || 'No se pudo guardar el bloque en la agenda.');
      }
    } catch (error) {
      console.error('Error al guardar bloque de agenda:', error);
      setErrorMsg('Error de conexión al guardar en la agenda.');
    } finally {
      setSavingBlock(false);
    }
  };

  /**
   * Elimina un bloqueo manual de la agenda online y recarga las franjas vigentes.
   * @param {number|string} blockId - Identificador del bloque manual a eliminar.
   * @returns {Promise<void>}
   */
  const handleDeleteScheduleBlock = async (blockId) => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/schedule/blocks/${blockId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        setSuccessMsg('Bloque eliminado de la agenda.');
        await fetchProviderSchedule();
      }
    } catch (error) {
      console.error('Error al eliminar bloque:', error);
    }
  };

  /**
   * Responde a una solicitud de visita entrante confirmando o rechazando disponibilidad,
   * adjuntando opcionalmente un mensaje al hilo y resincronizando visitas y agenda.
   * @param {number|string} visitId - Identificador de la solicitud de visita.
   * @param {'confirm'|'decline'} action - Decisión operativa del prestador.
   * @returns {Promise<void>}
   */
  const handleRespondVisit = async (visitId, action) => {
    setRespondingVisitId(visitId);
    setErrorMsg('');
    setSuccessMsg('');
    const replyText = String(visitReplyDrafts[visitId] || '').trim();

    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/visit-requests/${visitId}/respond`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          action,
          reply_text: replyText || undefined,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(data.message || 'Respuesta registrada en la visita.');
        setVisitReplyDrafts((prev) => ({ ...prev, [visitId]: '' }));
        await Promise.all([fetchIncomingVisits(), fetchProviderSchedule()]);
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar la visita.');
      }
    } catch (error) {
      console.error('Error al responder visita:', error);
      setErrorMsg('Error de conexión al responder la visita.');
    } finally {
      setRespondingVisitId(null);
    }
  };

  /**
   * Suscribe o extiende la Membresía "Socio Verificado" según el código de plan elegido.
   * @param {string} planCode - Código identificador del plan de membresía.
   * @returns {Promise<void>}
   */
  const handleSubscribeMembership = async (planCode) => {
    setSubscribingPlan(planCode);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/billing/provider/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ plan_code: planCode, auto_renew: true }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(data.message || 'Membresía Socio Verificado activada correctamente.');
        setShowMembershipPlans(false);
        await fetchProviderProfile();
      } else {
        setErrorMsg(data.error || 'No se pudo activar la membresía.');
      }
    } catch (error) {
      console.error('Error al activar membresía Socio Verificado:', error);
      setErrorMsg('Error de conexión al activar la membresía.');
    } finally {
      setSubscribingPlan('');
    }
  };

  /**
   * Copia al portapapeles el token de un pase QR y muestra confirmación visual temporal.
   * @param {string} tokenValue - Cadena del token QR a copiar.
   * @param {number|string} passId - Identificador del pase (o `'modal-pass'`) para el indicador de copiado.
   * @returns {Promise<void>}
   */
  const handleCopyToken = async (tokenValue, passId) => {
    if (!tokenValue) return;
    try {
      await navigator.clipboard.writeText(tokenValue);
      setCopiedPassId(passId);
      setTimeout(() => setCopiedPassId(null), 1800);
    } catch (err) {
      console.error('No se pudo copiar el token:', err);
    }
  };

  /**
   * Envía la calificación cruzada (estrellas y comentario opcional) del prestador hacia el residente de un contrato.
   * @param {number|string} contractId - Identificador del contrato sobre el cual se emite la reseña.
   * @returns {Promise<void>}
   */
  const handleSubmitOwnerReview = async (contractId) => {
    const ratingVal = ownerRatingDrafts[contractId] || 5;
    const commentVal = (ownerCommentDrafts[contractId] || '').trim();
    setSubmittingOwnerReviewId(contractId);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch(`${API_BASE}/api/v1/reviews/owner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          contract_id: contractId,
          rating: ratingVal,
          comment: commentVal || null,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg('Calificación al residente registrada correctamente.');
        await fetchProviderReviewContracts();
      } else {
        setErrorMsg(data.error || 'No se pudo enviar la calificación.');
      }
    } catch (error) {
      console.error('Error al calificar residente:', error);
      setErrorMsg('Error de conexión al enviar la calificación.');
    } finally {
      setSubmittingOwnerReviewId(null);
    }
  };

  // Filtra los pases QR asignados por estado y coincidencia textual (residente, lote, patente, token o ID)
  const filteredPasses = useMemo(() => {
    const q = passSearch.trim().toLowerCase();
    return assignedPasses.filter((item) => {
      const status = String(item.status || '').toLowerCase();
      const matchesStatus = passStatusFilter === 'all' || status === passStatusFilter;
      const residentName = `${item.owner_first_name || ''} ${item.owner_last_name || ''} ${
        item.authorized_by || ''
      }`.toLowerCase();
      const dest = `${item.fraction_number || ''} ${item.lot_number || ''}`.toLowerCase();
      const plate = String(item.vehicle_plate || item.plate || '').toLowerCase();
      const token = String(item.qr_token || '').toLowerCase();

      const matchesQuery =
        !q ||
        residentName.includes(q) ||
        dest.includes(q) ||
        plate.includes(q) ||
        token.includes(q) ||
        String(item.id).includes(q);

      return matchesStatus && matchesQuery;
    });
  }, [assignedPasses, passSearch, passStatusFilter]);

  // Cálculo de paginación segura sobre la lista de pases filtrados
  const totalPassPages = Math.max(1, Math.ceil(filteredPasses.length / PASSES_PER_PAGE));
  const paginatedPasses = useMemo(() => {
    const safePage = Math.min(passPage, totalPassPages);
    const startIdx = (safePage - 1) * PASSES_PER_PAGE;
    return filteredPasses.slice(startIdx, startIdx + PASSES_PER_PAGE);
  }, [filteredPasses, passPage, totalPassPages]);

  // Indicadores derivados para badges de navegación y resumen del encabezado
  const activePassesCount = assignedPasses.filter(
    (p) => String(p.status || '').toLowerCase() === 'pending'
  ).length;

  const pendingVisitsCount = incomingVisits.filter(
    (v) => String(v.status || '').toLowerCase() === 'pending_provider'
  ).length;

  const primaryProfile = profileData.providers[0] || null;
  const profileStatus = primaryProfile?.status || 'Pendiente';

  // Clases utilitarias compartidas para encabezados de listas, contadores y botones de fila
  const listHeaderTitleClass =
    'text-[11px] font-bold uppercase tracking-wider opacity-85 flex items-center gap-1.5';
  const listCounterBadgeClass =
    'text-[11px] font-mono px-2.5 py-0.5 rounded-full border border-slate-700/80 shrink-0';
  const rowActionBtnClass =
    'px-2.5 py-1.5 rounded-xl border border-slate-700/80 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-opacity hover:opacity-90 shrink-0';

  // Definición ordenada de los 6 pasos del Portal Prestador con iconos y contadores en vivo
  const steps = [
    {
      id: 'credentials',
      stepNumber: 1,
      label: 'Credenciales',
      count: profileData.providers.length,
      icon: ShieldCheck,
    },
    {
      id: 'vehicles',
      stepNumber: 2,
      label: 'Flota Vehicular',
      count: profileData.vehicles.length,
      icon: Car,
    },
    {
      id: 'schedule',
      stepNumber: 3,
      label: 'Agenda',
      count: scheduleBlocks.length,
      icon: Calendar,
    },
    {
      id: 'visits',
      stepNumber: 4,
      label: 'Visitas',
      count: pendingVisitsCount || incomingVisits.length,
      icon: MessageSquare,
    },
    {
      id: 'passes',
      stepNumber: 5,
      label: 'Pases QR',
      count: activePassesCount || assignedPasses.length,
      icon: QrCode,
    },
    {
      id: 'reviews',
      stepNumber: 6,
      label: 'Reseñas',
      count: reviewContracts.length,
      icon: Star,
    },
  ];

  return (
    <div className={PAGE_SHELL_CLASS}>
      {/* Cabecera principal alineada estéticamente con Portal Residente */}
      <div
        className="rounded-2xl p-5 sm:p-6 border border-white/10 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        style={cardStyle}
      >
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
            <ShieldCheck size={14} />
            <span>Portal Prestador</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Credenciales, agenda, visitas y pases QR
          </h1>
          <p className="text-xs sm:text-sm opacity-80">
            Gestioná tu documentación verificada, flota, disponibilidad online, visitas y reseñas cruzadas.
          </p>
        </div>

        {/* Insignia Socio Verificado, scoring promedio, estado del perfil y recarga manual */}
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {profileData.membership?.is_verified_member && (
            <span className="text-xs font-bold px-3 py-2 rounded-xl border border-amber-400/50 bg-amber-500/15 text-amber-200 inline-flex items-center gap-1.5">
              <Award size={13} className="text-amber-300" />
              <span>{profileData.membership.badge_label || 'Socio Verificado'}</span>
            </span>
          )}
          <span
            className="text-xs font-bold px-3 py-2 rounded-xl border border-slate-700/80 inline-flex items-center gap-1.5"
            style={innerStyle}
          >
            <Star size={13} className="text-amber-400 fill-amber-400" />
            <span>Scoring: {Number(primaryProfile?.rating_avg || 0).toFixed(2)}</span>
          </span>
          <span
            className="text-xs font-bold px-3 py-2 rounded-xl border border-slate-700/80"
            style={innerStyle}
          >
            Estado: {profileStatus}
          </span>
          <button
            type="button"
            onClick={() => {
              fetchProviderProfile();
              fetchProviderSchedule();
              fetchIncomingVisits();
              fetchAssignedPasses();
              fetchProviderReviewContracts();
            }}
            className="p-2 rounded-xl border border-slate-700/80 hover:opacity-90 cursor-pointer"
            style={innerStyle}
            title="Actualizar información del prestador"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Selector de pasos en grilla unificada */}
      <div
        className="rounded-2xl p-2 border border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2"
        style={cardStyle}
      >
        {steps.map((step) => {
          const IconComponent = step.icon;
          const isSelected = activeStep === step.id;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setActiveStep(step.id)}
              className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                isSelected
                  ? 'text-white border-transparent shadow-sm'
                  : 'border-slate-800/70 opacity-85 hover:opacity-100'
              }`}
              style={isSelected ? { backgroundColor: primaryColor } : innerStyle}
            >
              <span className="flex items-center gap-1.5 truncate">
                <IconComponent size={14} className="shrink-0" />
                <span className="truncate">
                  {step.stepNumber}. {step.label}
                </span>
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/25 shrink-0">
                {step.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Alertas globales de feedback (errores y confirmaciones de operación) */}
      {errorMsg && (
        <div className="rounded-2xl p-4 border border-rose-800/70 bg-rose-950/50 text-rose-200 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="rounded-2xl p-4 border border-emerald-700/70 bg-emerald-950/50 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Banner proactivo de alertas de vencimiento documental (≤ 30 días o vencidos) */}
      {!loading && Array.isArray(profileData.expiry_alerts) && profileData.expiry_alerts.length > 0 && (
        <div
          className={`rounded-2xl p-4 border space-y-2.5 text-xs ${
            profileData.expiry_alerts.some((a) => a.severity === 'expired')
              ? 'border-rose-800/80 bg-rose-950/40 text-rose-100'
              : 'border-amber-700/80 bg-amber-950/35 text-amber-100'
          }`}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 font-bold">
              <AlertCircle
                size={16}
                className={
                  profileData.expiry_alerts.some((a) => a.severity === 'expired')
                    ? 'text-rose-400 shrink-0'
                    : 'text-amber-400 shrink-0'
                }
              />
              <span>
                Atención documental: tenés {profileData.expiry_alerts.length} alerta(s) de vencimiento
              </span>
            </div>
            <span className="text-[11px] opacity-85">
              {profileData.expiry_alerts.some((a) => a.severity === 'expired')
                ? 'Bloqueo activo: los documentos vencidos impiden emitir y validar pases QR en garita.'
                : 'Renovalos antes del vencimiento para evitar bloqueos automáticos en garita.'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {profileData.expiry_alerts.slice(0, 6).map((alert) => {
              const isExpired = alert.severity === 'expired';
              return (
                <div
                  key={alert.id}
                  className="p-2.5 rounded-xl bg-black/25 border border-white/10 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-bold truncate">{alert.title}</p>
                    <p className="text-[11px] opacity-80 truncate">
                      {isExpired
                        ? `Vencido hace ${Math.abs(alert.days_remaining)} día(s)`
                        : alert.days_remaining === 0
                        ? 'Vence hoy'
                        : `Vence en ${alert.days_remaining} día(s)`}{' '}
                      ({alert.expiry_date})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveStep(alert.target_step || 'credentials')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-white/15 bg-black/30 hover:bg-black/50 cursor-pointer shrink-0"
                  >
                    Renovar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Barra compacta de Membresía "Socio Verificado" (progressive disclosure) */}
      {!loading && (
        <div
          className={`rounded-2xl p-4 border space-y-3 text-xs ${
            profileData.membership?.is_verified_member
              ? 'border-amber-500/40'
              : 'border-slate-800/80'
          }`}
          style={cardStyle}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div
                className="p-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 shrink-0"
              >
                <Award size={16} />
              </div>
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-sm">
                    {profileData.membership?.is_verified_member
                      ? `Membresía activa: ${profileData.membership.plan_name}`
                      : 'Destacá tu perfil como Socio Verificado'}
                  </span>
                  {profileData.membership?.is_verified_member && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-300">
                      {profileData.membership.days_remaining} día(s) restantes
                    </span>
                  )}
                </div>
                <p className="opacity-80">
                  {profileData.membership?.is_verified_member
                    ? `Vigente hasta ${formatDateShort(profileData.membership.ends_at)}. Tu perfil aparece primero en el directorio de residentes con insignia distintiva.`
                    : 'Obtené insignia verificada, prioridad absoluta en el buscador de residentes y reputación acumulable incluso si cobrás en efectivo.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowMembershipPlans((prev) => !prev)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-white cursor-pointer shrink-0 self-start sm:self-auto transition-opacity hover:opacity-95"
              style={{ backgroundColor: primaryColor }}
            >
              {showMembershipPlans
                ? 'Ocultar planes'
                : profileData.membership?.is_verified_member
                ? 'Renovar / Cambiar plan'
                : 'Ver planes'}
            </button>
          </div>

          {/* Grilla desplegable de planes disponibles para activar o extender la membresía */}
          {showMembershipPlans && Array.isArray(profileData.membership_plans) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-white/10">
              {profileData.membership_plans.map((plan) => {
                const isCurrent =
                  profileData.membership?.is_verified_member &&
                  profileData.membership?.plan_code === plan.code;
                const isBusy = subscribingPlan === plan.code;
                return (
                  <div
                    key={plan.code}
                    className={`rounded-xl p-4 border flex flex-col justify-between gap-3 ${
                      isCurrent ? 'border-amber-400/50' : 'border-white/10'
                    }`}
                    style={innerStyle}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm">{plan.name}</span>
                        {isCurrent && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/40">
                            Actual
                          </span>
                        )}
                      </div>
                      <p className="text-base font-black text-emerald-400">
                        ARS {Number(plan.price_ars || 0).toLocaleString('es-AR')}
                        <span className="text-[11px] font-normal opacity-75">
                          {' '}
                          / {plan.duration_days} días
                        </span>
                      </p>
                      <ul className="space-y-1 opacity-85">
                        {(plan.features || []).map((feat) => (
                          <li key={feat} className="flex items-start gap-1.5">
                            <CheckCircle2 size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      type="button"
                      disabled={Boolean(subscribingPlan)}
                      onClick={() => handleSubscribeMembership(plan.code)}
                      className="w-full py-2 px-3 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50 transition-opacity hover:opacity-95"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {isBusy
                        ? 'Activando...'
                        : profileData.membership?.is_verified_member
                        ? `Extender +${plan.duration_days} días`
                        : 'Activar membresía'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Estado de carga inicial o vista activa correspondiente al paso seleccionado */}
      {loading ? (
        <div
          className="rounded-2xl p-10 border border-slate-800/80 text-center text-xs opacity-75 flex items-center justify-center gap-2"
          style={cardStyle}
        >
          <Loader2 className="animate-spin" size={16} />
          <span>Cargando información del prestador...</span>
        </div>
      ) : activeStep === 'credentials' ? (
        /* PASO 1: CREDENCIALES Y COMPLIANCE (Documentación personal + Especialidades) */
        <div className={ITEMS_GRID_CLASS}>
          {/* Sección 1A: Documentación personal de compliance (Antecedentes Penales y ART) */}
          <section
            className={`${SECTION_CARD_CLASS} h-full`}
            style={cardStyle}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <FileText size={18} className="text-emerald-400 shrink-0" />
                  <span>Documentación Personal</span>
                </h2>
                <p className="text-xs opacity-75">
                  Antecedentes penales, póliza ART/seguro y fechas de vigencia.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDocForm((prev) => !prev)}
                className="text-white font-bold px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 transition-opacity hover:opacity-95 cursor-pointer shrink-0 shadow-sm"
                style={{ backgroundColor: primaryColor }}
              >
                {showDocForm ? <X size={14} /> : <Plus size={14} />}
                {showDocForm ? 'Cerrar' : 'Cargar'}
              </button>
            </div>

            {/* Formulario desplegable de carga de nuevo documento de compliance */}
            {showDocForm && (
              <form
                onSubmit={handleCreateDocument}
                className="p-4 rounded-xl border border-slate-800/70 space-y-3 text-xs"
                style={innerStyle}
              >
                <p className="font-bold">Nuevo Documento de Compliance</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                    style={cardStyle}
                  >
                    <option value="Antecedentes Penales">Antecedentes Penales</option>
                    <option value="Póliza ART / Seguro">Póliza ART / Seguro</option>
                  </select>
                  <input
                    type="text"
                    required
                    value={docUrl}
                    onChange={(e) => setDocUrl(e.target.value)}
                    placeholder="URL o enlace del documento"
                    className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                    style={cardStyle}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] opacity-80 mb-1">Vigencia desde</label>
                    <input
                      type="date"
                      value={docValidFrom}
                      onChange={(e) => setDocValidFrom(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                      style={cardStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] opacity-80 mb-1">Vigencia hasta</label>
                    <input
                      type="date"
                      value={docValidTo}
                      onChange={(e) => setDocValidTo(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                      style={cardStyle}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowDocForm(false)}
                    className={rowActionBtnClass}
                    style={cardStyle}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingDoc}
                    className="text-white font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Save size={13} /> {savingDoc ? 'Guardando...' : 'Guardar Documento'}
                  </button>
                </div>
              </form>
            )}

            {/* Encabezado y listado del historial documental con edición inline */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className={listHeaderTitleClass}>
                <History size={13} className="opacity-80" /> HISTORIAL DOCUMENTAL
              </span>
              <span className={listCounterBadgeClass} style={innerStyle}>
                {documentHistory.length} doc(s)
              </span>
            </div>

            <div className="space-y-3">
              {documentHistory.length === 0 ? (
                <div
                  className="p-4 rounded-xl border border-slate-800/70 text-xs opacity-80"
                  style={innerStyle}
                >
                  No hay documentación cargada aún. Usá &ldquo;+ Cargar&rdquo; para agregarla.
                </div>
              ) : (
                documentHistory.map((docItem) => {
                  const isEditingDoc = editingDocKey === docItem.key;
                  const validity = getValidityStatus(docItem.validTo);

                  return (
                    <div
                      key={docItem.key}
                      className="p-4 rounded-xl border border-slate-800/70 space-y-2.5 text-xs"
                      style={innerStyle}
                    >
                      {isEditingDoc ? (
                        <div className="space-y-2.5">
                          <div className="font-bold">{docItem.docType}</div>
                          <input
                            type="text"
                            value={editDocUrl}
                            onChange={(e) => setEditDocUrl(e.target.value)}
                            placeholder="URL del documento"
                            className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                            style={cardStyle}
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] opacity-80 mb-1">Vigencia desde</label>
                              <input
                                type="date"
                                value={editDocValidFrom}
                                onChange={(e) => setEditDocValidFrom(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                                style={cardStyle}
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] opacity-80 mb-1">Vigencia hasta</label>
                              <input
                                type="date"
                                value={editDocValidTo}
                                onChange={(e) => setEditDocValidTo(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                                style={cardStyle}
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingDocKey(null)}
                              className={rowActionBtnClass}
                              style={cardStyle}
                            >
                              <X size={12} /> Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveDocumentEdit(docItem)}
                              disabled={updatingDoc}
                              className="text-white font-bold px-3 py-1.5 rounded-xl text-xs inline-flex items-center gap-1 cursor-pointer"
                              style={{ backgroundColor: primaryColor }}
                            >
                              <Save size={12} /> {updatingDoc ? 'Guardando...' : 'Guardar'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm">{docItem.docType}</span>
                              <span
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                  validity.tone === 'success'
                                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                                    : validity.tone === 'warning'
                                    ? 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                                    : validity.tone === 'danger'
                                    ? 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                                    : 'border-slate-700'
                                }`}
                                style={validity.tone === 'neutral' ? cardStyle : undefined}
                              >
                                {validity.label}
                              </span>
                              <span
                                className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-slate-700"
                                style={cardStyle}
                              >
                                Validado: {docItem.auditStatus}
                              </span>
                            </div>
                            {docItem.url && <p className="opacity-80 truncate">{docItem.url}</p>}
                            <p className="opacity-75">
                              Vigencia: {formatDateShort(docItem.validFrom)} →{' '}
                              {formatDateShort(docItem.validTo)}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => startEditingDocument(docItem)}
                            className={rowActionBtnClass}
                            style={cardStyle}
                          >
                            <Edit3 size={12} /> Editar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Sección 1B: Gestión de especialidades y control de visibilidad en directorio */}
          <section
            className="rounded-2xl p-5 border border-slate-800/80 space-y-4"
            style={cardStyle}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <Award size={18} className="text-emerald-400 shrink-0" />
                  <span>Especialidades y Credenciales</span>
                </h2>
                <p className="text-xs opacity-75">
                  Administrá tus rubros habilitados y su visibilidad en el directorio.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSpecialtyForm((prev) => !prev)}
                className="text-white font-bold px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 transition-opacity hover:opacity-95 cursor-pointer shrink-0 shadow-sm"
                style={{ backgroundColor: primaryColor }}
              >
                {showSpecialtyForm ? <X size={14} /> : <Plus size={14} />}
                {showSpecialtyForm ? 'Cerrar' : 'Agregar'}
              </button>
            </div>

            {/* Formulario desplegable para dar de alta una nueva especialidad */}
            {showSpecialtyForm && (
              <form
                onSubmit={handleCreateSpecialty}
                className="p-4 rounded-xl border border-slate-800/70 space-y-3 text-xs"
                style={innerStyle}
              >
                <p className="font-bold">Nueva Especialidad</p>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    required
                    value={newSpecialty}
                    onChange={(e) => setNewSpecialty(e.target.value)}
                    placeholder="Nueva especialidad (ej: Plomero Matriculado)"
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-700/80 text-xs focus:outline-none"
                    style={cardStyle}
                  />
                  <button
                    type="submit"
                    disabled={savingSpecialty}
                    className="text-white font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center justify-center gap-1.5 transition-opacity hover:opacity-95 cursor-pointer disabled:opacity-50 shrink-0"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Plus size={14} /> {savingSpecialty ? 'Agregando...' : 'Agregar'}
                  </button>
                </div>
              </form>
            )}

            {/* Listado de especialidades cargadas con visibilidad persistente y edición inline */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className={listHeaderTitleClass}>
                <ShieldCheck size={13} className="opacity-80" /> ESPECIALIDADES CARGADAS
              </span>
              <span className={listCounterBadgeClass} style={innerStyle}>
                {activeSpecialtiesCount} activa(s)
              </span>
            </div>

            <div className="space-y-3">
              {profileData.providers.length === 0 ? (
                <div
                  className="p-4 rounded-xl border border-slate-800/70 text-xs opacity-80"
                  style={innerStyle}
                >
                  No tenés especialidades registradas aún. Usá &ldquo;+ Agregar&rdquo; para cargar una.
                </div>
              ) : (
                profileData.providers.map((p) => {
                  const isEditing = editingSpecialtyId === p.id;
                  const isHidden = p.is_visible_in_directory === false;

                  return (
                    <div
                      key={p.id}
                      className="p-4 rounded-xl border border-slate-800/70 space-y-2.5 text-xs"
                      style={innerStyle}
                    >
                      {isEditing ? (
                        <div className="space-y-2.5">
                          <input
                            type="text"
                            value={editSpecialtyName}
                            onChange={(e) => setEditSpecialtyName(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                            style={cardStyle}
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingSpecialtyId(null)}
                              className={rowActionBtnClass}
                              style={cardStyle}
                            >
                              <X size={12} /> Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveSpecialtyEdit(p)}
                              disabled={updatingSpecialty}
                              className="text-white font-bold px-3 py-1.5 rounded-xl text-xs inline-flex items-center gap-1 cursor-pointer"
                              style={{ backgroundColor: primaryColor }}
                            >
                              <Save size={12} /> {updatingSpecialty ? 'Guardando...' : 'Guardar'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm">{p.specialty}</span>
                              <span
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                  p.status === 'approved'
                                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                                    : 'border-slate-700'
                                }`}
                                style={p.status === 'approved' ? undefined : cardStyle}
                              >
                                {p.status === 'approved' ? 'Aprobada' : 'Pendiente'}
                              </span>
                              <span
                                className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-slate-700"
                                style={cardStyle}
                              >
                                {isHidden ? 'Oculta' : 'Visible'}
                              </span>
                            </div>
                            <p className="opacity-75">
                              {p.status === 'approved'
                                ? 'Habilitada y visible según tu configuración en el directorio.'
                                : 'Pendiente de validación de TrustLink para habilitarse a residentes.'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              disabled={togglingVisibilityId === p.id}
                              onClick={() => toggleSpecialtyVisibility(p)}
                              className={rowActionBtnClass}
                              style={cardStyle}
                            >
                              {isHidden ? <Eye size={12} /> : <EyeOff size={12} />}
                              {isHidden ? 'Mostrar' : 'Ocultar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSpecialtyId(p.id);
                                setEditSpecialtyName(p.specialty || '');
                              }}
                              className={rowActionBtnClass}
                              style={cardStyle}
                            >
                              <Edit3 size={12} /> Editar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      ) : activeStep === 'vehicles' ? (
        /* PASO 2: FLOTA VEHICULAR Y CUADRILLA DE AYUDANTES */
        <section
          className="rounded-2xl p-5 border border-slate-800/80 space-y-4"
          style={cardStyle}
        >
          {/* Cabecera de Flota Vehicular Habilitada y acceso al alta */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Car size={18} className="text-emerald-400 shrink-0" />
                <span>Flota Vehicular Habilitada</span>
              </h2>
              <p className="text-xs opacity-75">
                Asociá los vehículos y patentes con los que ingresás a los barrios privados.
              </p>
            </div>
            <div className="flex items-center gap-2.5 self-start sm:self-auto">
              <span className={listCounterBadgeClass} style={innerStyle}>
                {profileData.vehicles.length} vehículo(s)
              </span>
              <button
                type="button"
                onClick={() => setShowVehicleForm((prev) => !prev)}
                className="text-white font-bold px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                style={{ backgroundColor: primaryColor }}
              >
                {showVehicleForm ? <X size={14} /> : <Plus size={14} />}
                {showVehicleForm ? 'Cerrar' : 'Cargar Vehículo'}
              </button>
            </div>
          </div>

          {/* Formulario desplegable de alta de vehículo y póliza de seguro automotor */}
          {showVehicleForm && (
            <form
              onSubmit={handleAddVehicle}
              className="p-4 rounded-xl border border-slate-800/70 space-y-3 text-xs"
              style={innerStyle}
            >
              <p className="font-bold">Asociar Vehículo</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <select
                  value={vehType}
                  onChange={(e) => setVehType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                  style={cardStyle}
                >
                  <option value="utilitario">Utilitario</option>
                  <option value="auto">Automóvil</option>
                  <option value="moto">Motocicleta</option>
                  <option value="camioneta">Camioneta</option>
                </select>
                <input
                  type="text"
                  required
                  value={vehBrand}
                  onChange={(e) => setVehBrand(e.target.value)}
                  placeholder="Marca (ej: Ford)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                  style={cardStyle}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  required
                  value={vehModel}
                  onChange={(e) => setVehModel(e.target.value)}
                  placeholder="Modelo (ej: Fiorino)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                  style={cardStyle}
                />
                <input
                  type="text"
                  required
                  value={vehColor}
                  onChange={(e) => setVehColor(e.target.value)}
                  placeholder="Color (ej: Blanco)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                  style={cardStyle}
                />
                <input
                  type="text"
                  required
                  value={vehPlate}
                  onChange={(e) => setVehPlate(e.target.value)}
                  placeholder="Patente (ej: AF123CD)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs uppercase"
                  style={cardStyle}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="url"
                  value={vehInsuranceUrl}
                  onChange={(e) => setVehInsuranceUrl(e.target.value)}
                  placeholder="URL Póliza de Seguro Automotor (opcional)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                  style={cardStyle}
                />
                <input
                  type="date"
                  value={vehInsuranceFrom}
                  onChange={(e) => setVehInsuranceFrom(e.target.value)}
                  title="Seguro vigente desde"
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                  style={cardStyle}
                />
                <input
                  type="date"
                  value={vehInsuranceExpiry}
                  onChange={(e) => setVehInsuranceExpiry(e.target.value)}
                  title="Vencimiento del seguro"
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                  style={cardStyle}
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingVehicle}
                  className="text-white font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Plus size={14} /> {savingVehicle ? 'Registrando...' : 'Registrar Vehículo'}
                </button>
              </div>
            </form>
          )}

          {/* Grilla de vehículos registrados con estado de seguro y edición inline */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {profileData.vehicles.length === 0 ? (
              <div
                className="md:col-span-2 p-8 rounded-xl border border-slate-800/70 text-xs opacity-75 text-center"
                style={innerStyle}
              >
                Sin vehículos registrados en tu flota.
              </div>
            ) : (
              profileData.vehicles.map((v) => {
                const isEditing = editingVehicleId === v.id;
                const insValidity = getValidityStatus(v.vehicle_insurance_expiry);

                return (
                  <div
                    key={v.id}
                    className="p-4 rounded-xl border border-slate-800/70 space-y-2.5 text-xs"
                    style={innerStyle}
                  >
                    {isEditing ? (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={editVehType}
                            onChange={(e) => setEditVehType(e.target.value)}
                            className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs"
                            style={cardStyle}
                          >
                            <option value="utilitario">Utilitario</option>
                            <option value="auto">Automóvil</option>
                            <option value="moto">Motocicleta</option>
                            <option value="camioneta">Camioneta</option>
                          </select>
                          <input
                            type="text"
                            value={editVehPlate}
                            onChange={(e) => setEditVehPlate(e.target.value.toUpperCase())}
                            placeholder="Patente"
                            className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs font-mono uppercase"
                            style={cardStyle}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={editVehBrand}
                            onChange={(e) => setEditVehBrand(e.target.value)}
                            placeholder="Marca"
                            className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs"
                            style={cardStyle}
                          />
                          <input
                            type="text"
                            value={editVehModel}
                            onChange={(e) => setEditVehModel(e.target.value)}
                            placeholder="Modelo"
                            className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs"
                            style={cardStyle}
                          />
                          <input
                            type="text"
                            value={editVehColor}
                            onChange={(e) => setEditVehColor(e.target.value)}
                            placeholder="Color"
                            className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs"
                            style={cardStyle}
                          />
                        </div>
                        <input
                          type="url"
                          value={editVehInsuranceUrl}
                          onChange={(e) => setEditVehInsuranceUrl(e.target.value)}
                          placeholder="URL Póliza de Seguro Automotor"
                          className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs"
                          style={cardStyle}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="date"
                            value={editVehInsuranceFrom}
                            onChange={(e) => setEditVehInsuranceFrom(e.target.value)}
                            className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs"
                            style={cardStyle}
                          />
                          <input
                            type="date"
                            value={editVehInsuranceExpiry}
                            onChange={(e) => setEditVehInsuranceExpiry(e.target.value)}
                            className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs"
                            style={cardStyle}
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingVehicleId(null)}
                            className={rowActionBtnClass}
                            style={cardStyle}
                          >
                            <X size={12} /> Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={updatingVehicle}
                            onClick={() => handleSaveVehicleEdit(v.id)}
                            className="text-white font-bold px-3 py-1.5 rounded-xl text-xs inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            style={{ backgroundColor: primaryColor }}
                          >
                            <Save size={12} /> {updatingVehicle ? 'Guardando...' : 'Guardar'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm">
                              {v.brand} {v.model}
                            </span>
                            <span
                              className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border border-slate-700"
                              style={cardStyle}
                            >
                              {v.vehicle_type}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                insValidity.tone === 'success'
                                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                                  : insValidity.tone === 'warning'
                                  ? 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                                  : insValidity.tone === 'danger'
                                  ? 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                                  : 'border-slate-700'
                              }`}
                              style={insValidity.tone === 'neutral' ? cardStyle : undefined}
                            >
                              Seguro: {v.vehicle_insurance_url ? insValidity.label : 'Sin póliza'}
                            </span>
                          </div>
                          <p className="opacity-80">
                            Color: {v.color || '-'} · Patente:{' '}
                            <strong className="font-mono">{v.license_plate || v.plate}</strong>
                          </p>
                          {(v.vehicle_insurance_url || v.vehicle_insurance_expiry) && (
                            <p className="opacity-75 text-[11px]">
                              Vigencia seguro: {formatDateShort(v.vehicle_insurance_from)} →{' '}
                              {formatDateShort(v.vehicle_insurance_expiry)}
                              {v.vehicle_insurance_url && (
                                <>
                                  {' · '}
                                  <a
                                    href={v.vehicle_insurance_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sky-400 hover:underline font-semibold"
                                  >
                                    Ver póliza
                                  </a>
                                </>
                              )}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => startEditingVehicle(v)}
                          className={rowActionBtnClass}
                          style={cardStyle}
                        >
                          <Edit3 size={12} /> Editar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Subsección: Ayudantes y Cuadrilla Habilitada */}
          <div className="pt-4 border-t border-slate-800/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Users size={17} className="text-sky-400 shrink-0" />
                  <span>Ayudantes y Cuadrilla Habilitada</span>
                </h3>
                <p className="text-xs opacity-75">
                  Declará a los ayudantes que te acompañan en obras o mantenimientos con DNI y seguro ART.
                </p>
              </div>
              <div className="flex items-center gap-2.5 self-start sm:self-auto">
                <span className={listCounterBadgeClass} style={innerStyle}>
                  {(profileData.employees || []).length} ayudante(s)
                </span>
                <button
                  type="button"
                  onClick={() => setShowEmployeeForm((prev) => !prev)}
                  className="text-white font-bold px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                  style={{ backgroundColor: primaryColor }}
                >
                  {showEmployeeForm ? <X size={14} /> : <Plus size={14} />}
                  {showEmployeeForm ? 'Cerrar' : 'Agregar Ayudante'}
                </button>
              </div>
            </div>

            {/* Formulario desplegable de alta de ayudante con DNI y cobertura ART */}
            {showEmployeeForm && (
              <form
                onSubmit={handleAddEmployee}
                className="p-4 rounded-xl border border-slate-800/70 space-y-3 text-xs"
                style={innerStyle}
              >
                <p className="font-bold">Nuevo Ayudante / Integrante</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    required
                    value={empFullName}
                    onChange={(e) => setEmpFullName(e.target.value)}
                    placeholder="Nombre y Apellido"
                    className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                    style={cardStyle}
                  />
                  <input
                    type="text"
                    required
                    value={empDni}
                    onChange={(e) => setEmpDni(e.target.value)}
                    placeholder="DNI (ej: 38123456)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs font-mono"
                    style={cardStyle}
                  />
                  <input
                    type="text"
                    value={empRoleLabel}
                    onChange={(e) => setEmpRoleLabel(e.target.value)}
                    placeholder="Rol (ej: Oficial, Ayudante)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                    style={cardStyle}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    value={empPhone}
                    onChange={(e) => setEmpPhone(e.target.value)}
                    placeholder="Teléfono (opcional)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                    style={cardStyle}
                  />
                  <input
                    type="url"
                    value={empInsuranceUrl}
                    onChange={(e) => setEmpInsuranceUrl(e.target.value)}
                    placeholder="URL Póliza ART / Seguro (opcional)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                    style={cardStyle}
                  />
                  <input
                    type="date"
                    value={empInsuranceExpiry}
                    onChange={(e) => setEmpInsuranceExpiry(e.target.value)}
                    title="Vencimiento de ART / Seguro"
                    className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                    style={cardStyle}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingEmployee}
                    className="text-white font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Plus size={14} /> {savingEmployee ? 'Registrando...' : 'Registrar Ayudante'}
                  </button>
                </div>
              </form>
            )}

            {/* Grilla de ayudantes de la cuadrilla con estado ART, edición inline y baja */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(profileData.employees || []).length === 0 ? (
                <div
                  className="md:col-span-2 p-6 rounded-xl border border-slate-800/70 text-xs opacity-75 text-center"
                  style={innerStyle}
                >
                  Sin ayudantes registrados en tu cuadrilla.
                </div>
              ) : (
                (profileData.employees || []).map((emp) => {
                  const isEditingEmp = editingEmployeeId === emp.id;
                  const insVal = getValidityStatus(emp.insurance_expiry);

                  return (
                    <div
                      key={emp.id}
                      className="p-4 rounded-xl border border-slate-800/70 space-y-2.5 text-xs"
                      style={innerStyle}
                    >
                      {isEditingEmp ? (
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={editEmpFullName}
                              onChange={(e) => setEditEmpFullName(e.target.value)}
                              placeholder="Nombre y Apellido"
                              className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs"
                              style={cardStyle}
                            />
                            <input
                              type="text"
                              value={editEmpDni}
                              onChange={(e) => setEditEmpDni(e.target.value)}
                              placeholder="DNI"
                              className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs font-mono"
                              style={cardStyle}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={editEmpRoleLabel}
                              onChange={(e) => setEditEmpRoleLabel(e.target.value)}
                              placeholder="Rol"
                              className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs"
                              style={cardStyle}
                            />
                            <input
                              type="text"
                              value={editEmpPhone}
                              onChange={(e) => setEditEmpPhone(e.target.value)}
                              placeholder="Teléfono"
                              className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs"
                              style={cardStyle}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="url"
                              value={editEmpInsuranceUrl}
                              onChange={(e) => setEditEmpInsuranceUrl(e.target.value)}
                              placeholder="URL Póliza ART"
                              className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs"
                              style={cardStyle}
                            />
                            <input
                              type="date"
                              value={editEmpInsuranceExpiry}
                              onChange={(e) => setEditEmpInsuranceExpiry(e.target.value)}
                              className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs"
                              style={cardStyle}
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingEmployeeId(null)}
                              className={rowActionBtnClass}
                              style={cardStyle}
                            >
                              <X size={12} /> Cancelar
                            </button>
                            <button
                              type="button"
                              disabled={updatingEmployee}
                              onClick={() => handleSaveEmployeeEdit(emp.id)}
                              className="text-white font-bold px-3 py-1.5 rounded-xl text-xs inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              style={{ backgroundColor: primaryColor }}
                            >
                              <Save size={12} /> {updatingEmployee ? 'Guardando...' : 'Guardar'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm">{emp.full_name}</span>
                              <span
                                className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-slate-700"
                                style={cardStyle}
                              >
                                {emp.role_label || 'Ayudante'}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                  insVal.tone === 'success'
                                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                                    : insVal.tone === 'warning'
                                    ? 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                                    : insVal.tone === 'danger'
                                    ? 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                                    : 'border-slate-700'
                                }`}
                                style={insVal.tone === 'neutral' ? cardStyle : undefined}
                              >
                                ART: {emp.insurance_policy_url ? insVal.label : 'Sin póliza'}
                              </span>
                            </div>
                            <p className="opacity-80">
                              DNI: <strong className="font-mono">{emp.dni || '-'}</strong>
                              {emp.phone ? ` · Tel: ${emp.phone}` : ''}
                            </p>
                            {(emp.insurance_policy_url || emp.insurance_expiry) && (
                              <p className="opacity-75 text-[11px]">
                                Vence: {formatDateShort(emp.insurance_expiry)}
                                {emp.insurance_policy_url && (
                                  <>
                                    {' · '}
                                    <a
                                      href={emp.insurance_policy_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sky-400 hover:underline font-semibold"
                                    >
                                      Ver póliza
                                    </a>
                                  </>
                                )}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => startEditingEmployee(emp)}
                              className={rowActionBtnClass}
                              style={cardStyle}
                            >
                              <Edit3 size={12} /> Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEmployee(emp.id)}
                              className={rowActionBtnClass}
                              style={cardStyle}
                              title="Eliminar ayudante"
                            >
                              <Trash2 size={12} className="text-rose-400" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      ) : activeStep === 'schedule' ? (
        /* PASO 3: AGENDA ONLINE Y DISPONIBILIDAD */
        <section
          className="rounded-2xl p-5 border border-slate-800/80 space-y-4"
          style={cardStyle}
        >
          {/* Cabecera de Agenda Online y botón de actualización */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Calendar size={18} className="text-emerald-400 shrink-0" />
                <span>Agenda Online y Disponibilidad</span>
              </h2>
              <p className="text-xs opacity-75">
                Bloqueá horarios no laborables, registrá visitas externas y revisá franjas ocupadas por TrustLink.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchProviderSchedule}
              className={rowActionBtnClass}
              style={innerStyle}
            >
              <RefreshCw size={13} className={loadingSchedule ? 'animate-spin' : ''} /> Actualizar
            </button>
          </div>

          {/* Formulario de creación de bloqueos manuales (no laborable / visita externa) */}
          <form
            onSubmit={handleCreateScheduleBlock}
            className="p-4 rounded-xl border border-slate-800/70 space-y-3 text-xs"
            style={innerStyle}
          >
            <p className="font-bold flex items-center gap-1.5">
              <Clock size={14} className="text-emerald-400" /> Agregar Bloqueo o Visita Externa
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <select
                value={blockType}
                onChange={(e) => setBlockType(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                style={cardStyle}
              >
                <option value="unavailable">Horario no laborable</option>
                <option value="external_visit">Visita externa (fuera de TrustLink)</option>
              </select>
              <input
                type="text"
                value={blockTitle}
                onChange={(e) => setBlockTitle(e.target.value)}
                placeholder="Detalle (ej: Descanso mediodía / Obra barrio norte)"
                className="sm:col-span-2 px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                style={cardStyle}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] opacity-80 mb-1">Desde</label>
                <input
                  type="datetime-local"
                  value={blockStart}
                  onChange={(e) => setBlockStart(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                  style={cardStyle}
                />
              </div>
              <div>
                <label className="block text-[11px] opacity-80 mb-1">Hasta</label>
                <input
                  type="datetime-local"
                  value={blockEnd}
                  onChange={(e) => setBlockEnd(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                  style={cardStyle}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingBlock}
                className="text-white font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: primaryColor }}
              >
                <Plus size={14} /> {savingBlock ? 'Guardando...' : 'Bloquear Franja'}
              </button>
            </div>
          </form>

          {/* Grilla de bloques de agenda (manuales eliminables y automáticos de TrustLink) */}
          {loadingSchedule ? (
            <p className="text-xs opacity-75 py-8 text-center">Cargando agenda del prestador...</p>
          ) : scheduleBlocks.length === 0 ? (
            <div
              className="p-8 rounded-xl border border-slate-800/70 text-xs opacity-75 text-center"
              style={innerStyle}
            >
              Sin bloques registrados todavía. Las visitas confirmadas o pases QR emitidos también se reflejarán aquí automáticamente.
            </div>
          ) : (
            <div className={ITEMS_GRID_CLASS}>
              {scheduleBlocks.map((blk) => {
                const isManualBlock = !blk.source_ref;
                return (
                  <div
                    key={blk.id}
                    className={ITEM_CARD_CLASS}
                    style={innerStyle}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-sm">{blk.title || 'Bloque de agenda'}</span>
                        <p className="opacity-80 mt-0.5">
                          {formatDateTime(blk.start_at)} → {formatDateTime(blk.end_at)}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-slate-700 shrink-0">
                        {getBlockTypeLabel(blk.block_type)}
                      </span>
                    </div>

                    {isManualBlock && (
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteScheduleBlock(blk.id)}
                          className="inline-flex items-center gap-1 text-rose-300 hover:text-rose-200 font-bold cursor-pointer"
                        >
                          <Trash2 size={12} /> Quitar bloque
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : activeStep === 'visits' ? (
        /* PASO 4: SOLICITUDES Y CONFIRMACIÓN DE VISITAS */
        <section
          className="rounded-2xl p-5 border border-slate-800/80 space-y-4"
          style={cardStyle}
        >
          {/* Cabecera de Solicitudes de Visita y botón de recarga */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <MessageSquare size={18} className="text-emerald-400 shrink-0" />
                <span>Solicitudes y Confirmación de Visitas</span>
              </h2>
              <p className="text-xs opacity-75">
                Respondé a los residentes y confirmá tu disponibilidad para bloquear el horario y habilitar el Pase QR.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchIncomingVisits}
              className={rowActionBtnClass}
              style={innerStyle}
            >
              <RefreshCw size={13} className={loadingVisits ? 'animate-spin' : ''} /> Actualizar
            </button>
          </div>

          {/* Listado de visitas solicitadas por residentes */}
          {loadingVisits ? (
            <p className="text-xs opacity-75 py-8 text-center">Cargando visitas solicitadas...</p>
          ) : incomingVisits.length === 0 ? (
            <div
              className="rounded-xl p-8 text-center text-xs opacity-75 border border-slate-800/70"
              style={innerStyle}
            >
              Todavía no tenés solicitudes de visita pendientes de coordinación.
            </div>
          ) : (
            <div className={ITEMS_GRID_CLASS}>
              {incomingVisits.map((visit) => {
                const statusLower = String(visit.status || '').toLowerCase();
                const isConfirmed = statusLower === 'confirmed';
                const msgs = Array.isArray(visit.messages) ? visit.messages : [];

                return (
                  <article
                    key={visit.id}
                    className={ITEM_CARD_CLASS}
                    style={innerStyle}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-sm">
                          Visita #{visit.id} · {visit.owner_name || 'Residente'}
                        </span>
                        <p className="opacity-80 mt-0.5">
                          Destino: {visit.fraction_number || '—'} / {visit.lot_number || '—'} ·
                          Horario: {visit.preferred_date ? formatDateTimeAR(visit.preferred_date) : 'A convenir'}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                          isConfirmed
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                            : statusLower === 'declined'
                            ? 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                            : 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                        }`}
                      >
                        {isConfirmed
                          ? 'Disponibilidad Confirmada'
                          : statusLower === 'declined'
                          ? 'Sin Disponibilidad'
                          : 'Pendiente de Confirmación'}
                      </span>
                    </div>

                    {/* Hilo de mensajes intercambiados entre residente y prestador */}
                    {msgs.length > 0 && (
                      <div className="rounded-lg p-3 bg-black/25 border border-slate-700/60 space-y-1.5">
                        {msgs.map((m, idx) => (
                          <p key={m.id || idx} className="text-xs">
                            <strong className="uppercase text-[10px] opacity-75 mr-1.5">
                              {m.sender_role === 'provider' ? 'Prestador:' : 'Residente:'}
                            </strong>
                            <span>{m.text}</span>
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Respuesta opcional al hilo y acciones para confirmar o rechazar la visita */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={visitReplyDrafts[visit.id] || ''}
                        onChange={(e) =>
                          setVisitReplyDrafts((prev) => ({
                            ...prev,
                            [visit.id]: e.target.value,
                          }))
                        }
                        placeholder="Escribí un mensaje o aclaración para el residente..."
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                        style={cardStyle}
                      />

                      <button
                        type="button"
                        disabled={respondingVisitId === visit.id}
                        onClick={() => handleRespondVisit(visit.id, 'confirm')}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50 shrink-0"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {respondingVisitId === visit.id
                          ? 'Guardando...'
                          : isConfirmed
                          ? 'Confirmada'
                          : 'Confirmar Disponibilidad'}
                      </button>

                      <button
                        type="button"
                        disabled={respondingVisitId === visit.id}
                        onClick={() => handleRespondVisit(visit.id, 'decline')}
                        className={rowActionBtnClass}
                        style={cardStyle}
                      >
                        Sin disponibilidad
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : activeStep === 'passes' ? (
        /* PASO 5: PASES QR ASIGNADOS */
        <section
          className="rounded-2xl p-5 border border-slate-800/80 space-y-4"
          style={cardStyle}
        >
          {/* Cabecera de Pases QR con buscador, filtro de estado y recarga */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <QrCode size={18} className="text-emerald-400 shrink-0" />
                <span>Pases QR Asignados para tu Ingreso</span>
              </h2>
              <p className="text-xs opacity-75">
                Consultá las autorizaciones emitidas por residentes con destino, vigencia y token QR.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60 pointer-events-none"
                />
                <input
                  type="text"
                  value={passSearch}
                  onChange={(e) => {
                    setPassSearch(e.target.value);
                    setPassPage(1);
                  }}
                  placeholder="Buscar residente, lote o patente..."
                  className="w-full sm:w-56 pl-8 pr-3 py-2 rounded-xl text-xs border border-slate-700/80 focus:outline-none"
                  style={innerStyle}
                />
              </div>

              <select
                value={passStatusFilter}
                onChange={(e) => {
                  setPassStatusFilter(e.target.value);
                  setPassPage(1);
                }}
                className="px-3 py-2 rounded-xl text-xs border border-slate-700/80 focus:outline-none"
                style={innerStyle}
              >
                <option value="all">Todos los estados</option>
                <option value="pending">Vigentes / Pendientes</option>
                <option value="used">Utilizados</option>
                <option value="expired">Vencidos</option>
                <option value="cancelled">Cancelados</option>
              </select>

              <button
                type="button"
                onClick={fetchAssignedPasses}
                className="p-2 rounded-xl border border-slate-700/80 hover:opacity-90 cursor-pointer self-end sm:self-auto"
                style={innerStyle}
                title="Actualizar pases QR"
              >
                <RefreshCw size={15} className={loadingPasses ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {passesError && (
            <div className="rounded-xl p-3.5 text-xs border border-amber-700/60 bg-amber-950/40 text-amber-200">
              {passesError}
            </div>
          )}

          {/* Grilla paginada de tarjetas de pases QR con destino, acceso y cuadrilla autorizada */}
          {loadingPasses ? (
            <p className="text-xs opacity-75 py-8 text-center">Cargando pases QR asignados...</p>
          ) : paginatedPasses.length === 0 ? (
            <div
              className="rounded-xl p-8 text-center text-xs opacity-75 border border-slate-800/70"
              style={innerStyle}
            >
              No hay pases QR registrados para tu perfil con los filtros actuales.
            </div>
          ) : (
            <div className={ITEMS_GRID_CLASS}>
              {paginatedPasses.map((passItem) => {
                const ownerLabel =
                  `${passItem.owner_first_name || ''} ${passItem.owner_last_name || ''}`.trim() ||
                  passItem.authorized_by ||
                  'Residente';
                const plateLabel = passItem.vehicle_plate || passItem.plate || 'Ingreso peatonal';
                const statusMeta = getUnifiedStatusMeta(passItem.status, 'pass');

                return (
                  <article
                    key={passItem.id}
                    className={ITEM_CARD_CLASS}
                    style={innerStyle}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-sm">Pase #{passItem.id}</span>
                        <p className="opacity-80 mt-0.5">Autorizó: {ownerLabel}</p>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border shrink-0 ${statusMeta.cls}`}
                      >
                        {statusMeta.label}
                      </span>
                    </div>

                    <div className="space-y-1 opacity-85">
                      <p className="flex items-center gap-1.5">
                        <MapPin size={13} className="text-emerald-400 shrink-0" />
                        <span>
                          Destino: {passItem.fraction_number || 'Sin fracción'} /{' '}
                          {passItem.lot_number || 'Sin lote'}
                        </span>
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Car size={13} className="text-sky-400 shrink-0" />
                        <span>Acceso: {plateLabel}</span>
                      </p>
                      {Array.isArray(passItem.authorized_employees) &&
                        passItem.authorized_employees.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
                              <Users size={12} className="text-emerald-400 shrink-0" /> Cuadrilla:
                            </span>
                            {passItem.authorized_employees.map((emp) => (
                              <span
                                key={emp.id || emp.dni || emp.full_name}
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-700/60 bg-emerald-950/50 text-emerald-200"
                              >
                                {emp.full_name}
                                {emp.dni ? ` · DNI ${emp.dni}` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      <p className="flex items-center gap-1.5 text-[11px] opacity-75">
                        <Calendar size={13} className="text-amber-400 shrink-0" />
                        <span>
                          Vigencia: {formatDateTime(passItem.start_time)} →{' '}
                          {formatDateTime(passItem.end_time)}
                        </span>
                      </p>
                    </div>

                    {/* Barra de token QR con copiado rápido y apertura de modal escaneable */}
                    {passItem.qr_token && (
                      <div className="pt-1 flex items-center justify-between gap-2 bg-black/25 px-2.5 py-1.5 rounded-lg border border-slate-700/50">
                        <code className="text-[11px] truncate">{passItem.qr_token}</code>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyToken(passItem.qr_token, passItem.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer"
                          >
                            {copiedPassId === passItem.id ? (
                              <>
                                <Check size={12} className="text-emerald-400" /> Copiado
                              </>
                            ) : (
                              <>
                                <Copy size={12} /> Copiar
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedPassModal(passItem)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer"
                            title="Ver detalle del token QR"
                          >
                            <QrCode size={12} /> Ver
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {/* Controles de paginación para los pases QR filtrados */}
          {filteredPasses.length > PASSES_PER_PAGE && (
            <div className="flex items-center justify-between pt-2 text-xs">
              <span className="opacity-75">
                Página {Math.min(passPage, totalPassPages)} de {totalPassPages} (
                {filteredPasses.length} pases)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={passPage <= 1}
                  onClick={() => setPassPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-700/80 font-bold disabled:opacity-40 cursor-pointer"
                  style={innerStyle}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={passPage >= totalPassPages}
                  onClick={() => setPassPage((p) => Math.min(totalPassPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-700/80 font-bold disabled:opacity-40 cursor-pointer"
                  style={innerStyle}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </section>
      ) : (
        /* PASO 6: INGRESOS NETOS, CONTRATOS, COMPROBANTES Y RESEÑAS CRUZADAS */
        <section
          className="rounded-2xl p-5 border border-slate-800/80 space-y-4"
          style={cardStyle}
        >
          {/* Cabecera de Servicios Realizados y Reputación Cruzada */}
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Star size={18} className="text-emerald-400 shrink-0" />
                <span>Servicios Realizados &amp; Reputación Cruzada</span>
              </h2>
              <p className="text-xs opacity-75">
                Visualizá las reseñas recibidas de residentes y calificá tu experiencia en cada domicilio.
              </p>
            </div>
            <span className={listCounterBadgeClass} style={innerStyle}>
              {reviewContracts.length} contrato(s)
            </span>
          </div>

          {/* Resumen de Ingresos, Contratos y Comprobantes del Prestador */}
          {providerEarningsSummary && (
            <div className="space-y-3 pb-2 border-b border-white/10">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-3 rounded-xl border border-white/10" style={innerStyle}>
                  <div className="text-[10px] uppercase opacity-70">Neto estimado (93%)</div>
                  <div className="text-base font-black font-mono text-emerald-400 mt-0.5">
                    ${Number(providerEarningsSummary.total_net_payout || 0).toLocaleString('es-AR')}
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-white/10" style={innerStyle}>
                  <div className="text-[10px] uppercase opacity-70">Completados</div>
                  <div className="text-base font-black font-mono mt-0.5">
                    {providerEarningsSummary.completed_count ?? 0}
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-white/10" style={innerStyle}>
                  <div className="text-[10px] uppercase opacity-70">Pendientes / En curso</div>
                  <div className="text-base font-black font-mono mt-0.5">
                    {(providerEarningsSummary.pending_count ?? 0) +
                      (providerEarningsSummary.in_progress_count ?? 0)}
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-white/10" style={innerStyle}>
                  <div className="text-[10px] uppercase opacity-70">Reclamos abiertos</div>
                  <div
                    className={`text-base font-black font-mono mt-0.5 ${
                      providerEarningsSummary.open_disputes_count > 0 ? 'text-rose-400' : ''
                    }`}
                  >
                    {providerEarningsSummary.open_disputes_count ?? 0}
                  </div>
                </div>
              </div>

              {/* Contratos recientes del prestador con liquidación neta y emisión de comprobante imprimible */}
              {providerContracts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                  {providerContracts.slice(0, 6).map((c) => {
                    const cMeta = getUnifiedStatusMeta(c.status, 'contract');
                    return (
                      <div
                        key={`earn-${c.id}`}
                        className="p-3 rounded-xl border border-white/10 flex items-center justify-between gap-2"
                        style={innerStyle}
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold">Contrato #{c.id}</span>
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${cMeta.cls}`}
                            >
                              {cMeta.label}
                            </span>
                            {Number(c.open_disputes_count || 0) > 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-700 bg-rose-950/60 text-rose-200">
                                Reclamo
                              </span>
                            )}
                          </div>
                          <p className="opacity-80 truncate">
                            {c.owner_name} · Neto:{' '}
                            <strong className="font-mono text-emerald-400">
                              ${Number(c.provider_payout || 0).toLocaleString('es-AR')}
                            </strong>
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={loadingReceiptId === c.id}
                          onClick={() => handlePrintProviderReceipt(c.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-white/15 cursor-pointer shrink-0 disabled:opacity-50"
                          style={cardStyle}
                        >
                          <Printer size={12} className="text-emerald-400" />
                          {loadingReceiptId === c.id ? '...' : 'Comprobante'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Grilla de historial de servicios y calificaciones cruzadas */}
          {loadingReviews ? (
            <p className="text-xs opacity-75 py-8 text-center">Cargando historial de servicios...</p>
          ) : reviewContracts.length === 0 ? (
            <div
              className="rounded-xl p-8 text-center text-xs opacity-75 border border-slate-800/70"
              style={innerStyle}
            >
              Aún no tenés contratos asignados en tu historial.
            </div>
          ) : (
            <div className={ITEMS_GRID_CLASS}>
              {reviewContracts.map((item) => {
                const ratingDraft = ownerRatingDrafts[item.contract_id] || 5;
                const commentDraft = ownerCommentDrafts[item.contract_id] || '';
                const alreadyRatedOwner = Boolean(item.owner_review_id);
                const statusMeta = getUnifiedStatusMeta(
                  item.contract_status || item.status,
                  'contract'
                );

                return (
                  <div
                    key={item.contract_id}
                    className={ITEM_CARD_CLASS}
                    style={innerStyle}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">
                          Contrato #{item.contract_id} ·{' '}
                          {`${item.owner_first_name || ''} ${item.owner_last_name || ''}`.trim() ||
                            item.owner_name ||
                            'Residente Verificado'}
                        </span>
                      </div>
                      <span
                        className={`uppercase text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${statusMeta.cls}`}
                      >
                        {statusMeta.label}
                      </span>
                    </div>

                    <p className="opacity-85">{item.description}</p>

                    {/* Reseña recibida del residente (si existe) y bloque de calificación al propietario */}
                    {item.provider_review_rating && (
                      <div className="rounded-lg p-2.5 bg-emerald-950/30 border border-emerald-800/40 text-xs">
                        <span className="font-bold text-emerald-300">
                          Reseña recibida del residente: ★ {item.provider_review_rating}/5
                        </span>
                        {item.provider_review_comment && (
                          <p className="opacity-85 mt-0.5">
                            &ldquo;{item.provider_review_comment}&rdquo;
                          </p>
                        )}
                      </div>
                    )}

                    {alreadyRatedOwner ? (
                      <div
                        className="p-3 rounded-lg border border-slate-700/80 text-xs"
                        style={cardStyle}
                      >
                        Tu calificación al residente: ★ {item.owner_review_rating}/5
                        {item.owner_review_comment ? ` — "${item.owner_review_comment}"` : ''}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center pt-1">
                        <select
                          value={ratingDraft}
                          onChange={(e) =>
                            setOwnerRatingDrafts((prev) => ({
                              ...prev,
                              [item.contract_id]: Number(e.target.value),
                            }))
                          }
                          className="sm:col-span-3 px-3 py-2 rounded-xl text-xs border border-slate-700/80"
                          style={cardStyle}
                        >
                          <option value={5}>★★★★★ (5/5)</option>
                          <option value={4}>★★★★☆ (4/5)</option>
                          <option value={3}>★★★☆☆ (3/5)</option>
                          <option value={2}>★★☆☆☆ (2/5)</option>
                          <option value={1}>★☆☆☆☆ (1/5)</option>
                        </select>

                        <input
                          type="text"
                          value={commentDraft}
                          onChange={(e) =>
                            setOwnerCommentDrafts((prev) => ({
                              ...prev,
                              [item.contract_id]: e.target.value,
                            }))
                          }
                          placeholder="Comentario sobre el trato y acceso en el domicilio..."
                          className="sm:col-span-6 px-3 py-2 rounded-xl text-xs border border-slate-700/80"
                          style={cardStyle}
                        />

                        <button
                          type="button"
                          onClick={() => handleSubmitOwnerReview(item.contract_id)}
                          disabled={submittingOwnerReviewId === item.contract_id}
                          className="sm:col-span-3 py-2 px-3 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <Send size={13} />
                          {submittingOwnerReviewId === item.contract_id
                            ? 'Enviando...'
                            : 'Calificar Residente'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Modal para visualizar el token QR completo */}
      {selectedPassModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div
            className="w-full max-w-md rounded-2xl p-6 border border-slate-700/80 shadow-2xl space-y-4 text-xs"
            style={cardStyle}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold">Pase QR #{selectedPassModal.id}</h3>
                <p className="opacity-75">
                  Estado: {getPassStatusLabel(selectedPassModal.status)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPassModal(null)}
                className="p-1 rounded-lg opacity-75 hover:opacity-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-xl p-3.5 border border-slate-800/70 space-y-1.5" style={innerStyle}>
              <p>
                <strong>Destino:</strong> {selectedPassModal.fraction_number || '—'} /{' '}
                {selectedPassModal.lot_number || '—'}
              </p>
              <p>
                <strong>Acceso:</strong>{' '}
                {selectedPassModal.vehicle_plate || selectedPassModal.plate || 'Ingreso peatonal'}
              </p>
              <p>
                <strong>Desde:</strong> {formatDateTime(selectedPassModal.start_time)}
              </p>
              <p>
                <strong>Hasta:</strong> {formatDateTime(selectedPassModal.end_time)}
              </p>
            </div>

            {/* Código QR escaneable en garita y bloque de token copiable */}
            <QrCodeDisplay token={selectedPassModal.qr_token} size={200} />

            <div className="rounded-xl p-3 bg-black/30 border border-slate-700/60 space-y-2">
              <span className="block text-[10px] font-bold uppercase opacity-75">
                Token QR para validación en garita
              </span>
              <code className="block font-mono text-[11px] break-all select-all">
                {selectedPassModal.qr_token}
              </code>
              <button
                type="button"
                onClick={() => handleCopyToken(selectedPassModal.qr_token, 'modal-pass')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                {copiedPassId === 'modal-pass' ? (
                  <>
                    <Check size={13} /> Token Copiado
                  </>
                ) : (
                  <>
                    <Copy size={13} /> Copiar Token
                  </>
                )}
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPassModal(null)}
                className="px-4 py-2 rounded-xl font-bold border border-slate-700/80 cursor-pointer"
                style={innerStyle}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}