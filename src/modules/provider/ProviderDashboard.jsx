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
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';
import { API_BASE } from '../../config/api';
import QrCodeDisplay from '../../components/QrCodeDisplay';
import SearchableSelect from '../../components/SearchableSelect';
import AdminPaginationBar from '../../components/admin/AdminPaginationBar';
import { paginateItems } from '../../utils/adminPagination';
import { ReputationThermometer } from '../../components/HomeProtectedBadge';
import ProviderCalendarManager from '../../components/ProviderCalendarManager';
import ProviderTrustBadge, {
  FeaturedPartnerBadge,
  ProviderAvatar,
  TrustChecksStrip,
  VerifiedSeal,
} from '../../components/ProviderTrustBadge';
import { printServiceReceipt } from '../../utils/receiptPrinter';
import {
  PAGE_SHELL_CLASS,
  SECTION_CARD_CLASS,
  ITEMS_GRID_CLASS,
  ITEM_CARD_CLASS,
  FIELD_INPUT_CLASS,
  STANDARD_SPECIALTIES_CATALOG,
  TRUST_LEVEL_THEME,
  formatDateTimeAR,
  getUnifiedStatusMeta,
} from '../../config/uiTokens';

/** Enlace oficial del Registro Nacional de Reincidencia para tramitar Antecedentes Penales en Argentina. */
const CRIMINAL_RECORD_OFFICIAL_URL =
  'https://www.argentina.gob.ar/justicia/reincidencia/antecedentespenales';

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

/** Normaliza domicilio de visita evitando duplicar la palabra "Lote". */
function formatVisitAddressProvider(fractionNumber, lotNumber) {
  const frac = String(fractionNumber || '').trim();
  const rawLot = String(lotNumber || '').trim();
  const cleanLot = rawLot ? (/^lote\b/i.test(rawLot) ? rawLot : `Lote ${rawLot}`) : 'Lote —';
  return frac ? `${frac} · ${cleanLot}` : cleanLot;
}

/** Formatea franja horaria compacta en 24h (`25/11 · 09:00–10:00`) simétrica a Mis Servicios. */
function formatVisitScheduleShortProvider(preferredDate, preferredEndDate) {
  if (!preferredDate) return 'A convenir';
  const start = new Date(preferredDate);
  if (Number.isNaN(start.getTime())) return String(preferredDate);
  const datePart = start.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  const startTimePart = start.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  if (preferredEndDate) {
    const end = new Date(preferredEndDate);
    if (!Number.isNaN(end.getTime())) {
      const endTimePart = end.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      return `${datePart} · ${startTimePart}–${endTimePart}`;
    }
  }
  return `${datePart} · ${startTimePart}`;
}

/**
 * Componente principal del Portal Prestador.
 * Centraliza la gestión de cumplimiento documental, membresía Socio Verificado, especialidades,
 * flota vehicular, cuadrilla de ayudantes, agenda online, solicitudes de visita, pases QR,
 * ingresos/comprobantes y reseñas cruzadas con residentes.
 * @component
 * @returns {JSX.Element} Interfaz completa del panel del prestador.
 */
export default function ProviderDashboard({
  useGlobalHeader = false,
  externalActiveStep,
  onExternalStepChange,
  onHeaderMetaChange,
  refreshNonce = 0,
} = {}) {
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

  // Navegación principal sincronizable con la Zona 2D global (App.jsx)
  const [internalActiveStep, setInternalActiveStep] = useState('credentials');
  const isControlledStep =
    typeof onExternalStepChange === 'function' && Boolean(externalActiveStep);
  const activeStep = isControlledStep ? externalActiveStep : internalActiveStep;
  const setActiveStep = (nextOrUpdater) => {
    const nextValue =
      typeof nextOrUpdater === 'function' ? nextOrUpdater(activeStep) : nextOrUpdater;
    if (isControlledStep) {
      onExternalStepChange(nextValue);
    } else {
      setInternalActiveStep(nextValue);
    }
  };

  // Estado global del perfil del prestador, historial documental, membresía Destacado, ficha comercial y Q&A
  const [profileData, setProfileData] = useState({
    dni: null,
    dni_document_url: null,
    dni_back_url: null,
    phone_verified: true,
    identity_verified: false,
    identity_verified_at: null,
    auto_verified: false,
    auto_verified_at: null,
    trust_level: 0,
    trust_badge: null,
    is_featured_partner: false,
    providers: [],
    document_history: [],
    vehicles: [],
    employees: [],
    expiry_alerts: [],
    membership: null,
    membership_plans: [],
    reputation: null,
    response_stats: null,
    commercial_profile: null,
    public_questions: [],
    service_packages: [],
  });
  const [showDocHistory, setShowDocHistory] = useState(false);
  const [showMembershipPlans, setShowMembershipPlans] = useState(false);
  const [showTrustRoadmapExpanded, setShowTrustRoadmapExpanded] = useState(false);
  const [subscribingPlan, setSubscribingPlan] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Ficha comercial rápida y Urgencias 24h (Fase 5.2)
  const [showCommercialEditor, setShowCommercialEditor] = useState(false);
  const [commAcceptsEmergencies, setCommAcceptsEmergencies] = useState(false);
  const [commQuotePolicy, setCommQuotePolicy] = useState('consultar');
  const [commInvoiceType, setCommInvoiceType] = useState('consultar');
  const [commPaymentMethods, setCommPaymentMethods] = useState([
    'efectivo',
    'transferencia',
    'mercadopago',
  ]);
  const [commServiceBio, setCommServiceBio] = useState('');
  const [savingCommercial, setSavingCommercial] = useState(false);

  // Catálogo de Servicios con Precio Fijo del prestador (Paso 3)
  const [pkgModalOpen, setPkgModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [pkgSpecialty, setPkgSpecialty] = useState('');
  const [pkgTitle, setPkgTitle] = useState('');
  const [pkgIncludes, setPkgIncludes] = useState('');
  const [pkgPrice, setPkgPrice] = useState('');
  const [pkgDuration, setPkgDuration] = useState(60);
  const [savingPackage, setSavingPackage] = useState(false);
  const [pkgModalError, setPkgModalError] = useState('');
  const [togglingPackageId, setTogglingPackageId] = useState(null);
  const [deletingPackageId, setDeletingPackageId] = useState(null);

  // Preguntas públicas de la comunidad (Q&A estilo ficha de producto)
  const [showQaPanel, setShowQaPanel] = useState(false);
  const [qaAnswerDrafts, setQaAnswerDrafts] = useState({});
  const [answeringQuestionId, setAnsweringQuestionId] = useState(null);

  // Paso 1: Credenciales — alta de documentación de compliance (DNI N1 / Seguro AP o ART N2 / Antecedentes N3)
  const [showDocForm, setShowDocForm] = useState(false);
  const [docType, setDocType] = useState('Póliza ART / Seguro');
  const [docUrl, setDocUrl] = useState('');
  const [docDniNumber, setDocDniNumber] = useState('');
  const [docDniBackUrl, setDocDniBackUrl] = useState('');
  const [docValidFrom, setDocValidFrom] = useState('');
  const [docValidTo, setDocValidTo] = useState('');
  const [docInsuranceType, setDocInsuranceType] = useState('ap');
  const [docInsurerName, setDocInsurerName] = useState('');
  const [docPolicyNumber, setDocPolicyNumber] = useState('');
  const [docHolderCuit, setDocHolderCuit] = useState('');
  const [docCoverageSummary, setDocCoverageSummary] = useState('');
  const [docCriminalIssuedAt, setDocCriminalIssuedAt] = useState('');
  const [docCriminalRequestCode, setDocCriminalRequestCode] = useState('');
  const [docCriminalSecurityCode, setDocCriminalSecurityCode] = useState('');
  const [savingDoc, setSavingDoc] = useState(false);

  // Paso 1: Edición inline de documentos existentes en el historial
  const [editingDocKey, setEditingDocKey] = useState(null);
  const [editDocUrl, setEditDocUrl] = useState('');
  const [editDocValidFrom, setEditDocValidFrom] = useState('');
  const [editDocValidTo, setEditDocValidTo] = useState('');
  const [editInsuranceType, setEditInsuranceType] = useState('ap');
  const [editInsurerName, setEditInsurerName] = useState('');
  const [editPolicyNumber, setEditPolicyNumber] = useState('');
  const [editHolderCuit, setEditHolderCuit] = useState('');
  const [editCoverageSummary, setEditCoverageSummary] = useState('');
  const [editCriminalIssuedAt, setEditCriminalIssuedAt] = useState('');
  const [editCriminalRequestCode, setEditCriminalRequestCode] = useState('');
  const [editCriminalSecurityCode, setEditCriminalSecurityCode] = useState('');
  const [updatingDoc, setUpdatingDoc] = useState(false);

  // Paso 1: Alta (catálogo oficial auto-aprobado vs. especialidad personalizada), edición y visibilidad
  const [showSpecialtyForm, setShowSpecialtyForm] = useState(false);
  const [selectedCatalogSpecialty, setSelectedCatalogSpecialty] = useState(
    STANDARD_SPECIALTIES_CATALOG[0]
  );
  const [newSpecialty, setNewSpecialty] = useState('');
  const [customSpecialtyDesc, setCustomSpecialtyDesc] = useState('');
  const [savingSpecialty, setSavingSpecialty] = useState(false);
  const [togglingVisibilityId, setTogglingVisibilityId] = useState(null);
  const [editingSpecialtyId, setEditingSpecialtyId] = useState(null);
  const [editSpecialtyCatalog, setEditSpecialtyCatalog] = useState(
    STANDARD_SPECIALTIES_CATALOG[0]
  );
  const [editSpecialtyName, setEditSpecialtyName] = useState('');
  const [editSpecialtyDesc, setEditSpecialtyDesc] = useState('');
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

  // Paso 3: Agenda Viva — contador de bloques sincronizado con ProviderCalendarManager
  const [scheduleBlocks, setScheduleBlocks] = useState([]);
  const [scheduleRefreshKey, setScheduleRefreshKey] = useState(0);

  // Paso 4: Solicitudes de Visita — pedidos entrantes, búsqueda, filtros, paginación y modal de detalle
  const [incomingVisits, setIncomingVisits] = useState([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [visitStatusFilter, setVisitStatusFilter] = useState('all');
  const [visitSearch, setVisitSearch] = useState('');
  const [visitPage, setVisitPage] = useState(1);
  const [visitPageSize, setVisitPageSize] = useState(6);
  const [selectedVisitDetailId, setSelectedVisitDetailId] = useState(null);
  const [visitReplyDrafts, setVisitReplyDrafts] = useState({});
  const [visitMessageDrafts, setVisitMessageDrafts] = useState({});
  const [sendingVisitMessageId, setSendingVisitMessageId] = useState(null);
  const [respondingVisitId, setRespondingVisitId] = useState(null);
  const [reschedulingVisitId, setReschedulingVisitId] = useState(null);
  const [rescheduleDateDraft, setRescheduleDateDraft] = useState('');

  // Paso 4b: Presupuestos formales vinculados a una solicitud de visita
  const [quoteModalVisit, setQuoteModalVisit] = useState(null);
  const [quoteAmountDraft, setQuoteAmountDraft] = useState('');
  const [quoteDescriptionDraft, setQuoteDescriptionDraft] = useState('');
  const [quoteNotesDraft, setQuoteNotesDraft] = useState('');
  const [savingQuote, setSavingQuote] = useState(false);
  const [quoteModalError, setQuoteModalError] = useState('');

  // Paso 5: Pases QR — listado asignado, búsqueda, filtro por estado, paginación y modal de detalle
  const [assignedPasses, setAssignedPasses] = useState([]);
  const [loadingPasses, setLoadingPasses] = useState(false);
  const [passesError, setPassesError] = useState('');
  const [passSearch, setPassSearch] = useState('');
  const [passStatusFilter, setPassStatusFilter] = useState('all');
  const [passPage, setPassPage] = useState(1);
  const [passPageSize, setPassPageSize] = useState(6);
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
        const comm = data.commercial_profile || {
          accepts_emergencies: false,
          quote_visit_policy: 'consultar',
          invoice_type: 'consultar',
          accepted_payment_methods: ['efectivo', 'transferencia', 'mercadopago'],
          service_bio: '',
        };
        setProfileData({
          dni: data.dni || null,
          dni_document_url: data.dni_document_url || null,
          dni_back_url: data.dni_back_url || null,
          phone_verified: data.phone_verified !== false,
          identity_verified: Boolean(data.identity_verified),
          identity_verified_at: data.identity_verified_at || null,
          auto_verified: Boolean(data.auto_verified),
          auto_verified_at: data.auto_verified_at || null,
          trust_level: Number(data.trust_level ?? data.trust_badge?.level ?? 0),
          trust_badge: data.trust_badge || null,
          is_featured_partner: Boolean(
            data.is_featured_partner || data.trust_badge?.is_featured_partner
          ),
          providers: data.providers || [],
          document_history: data.document_history || [],
          vehicles: data.vehicles || [],
          employees: data.employees || [],
          expiry_alerts: data.expiry_alerts || [],
          membership: data.membership || null,
          membership_plans: data.membership_plans || [],
          reputation: data.reputation || null,
          response_stats: data.response_stats || null,
          commercial_profile: comm,
          public_questions: data.public_questions || [],
          service_packages: Array.isArray(data.service_packages) ? data.service_packages : [],
        });
        setCommAcceptsEmergencies(Boolean(comm.accepts_emergencies));
        setCommQuotePolicy(comm.quote_visit_policy || 'consultar');
        setCommInvoiceType(comm.invoice_type || 'consultar');
        setCommPaymentMethods(
          Array.isArray(comm.accepted_payment_methods)
            ? comm.accepted_payment_methods
            : ['efectivo', 'transferencia', 'mercadopago']
        );
        setCommServiceBio(comm.service_bio || '');
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
   * Alterna un medio de pago aceptado en el editor de ficha comercial del prestador.
   * @param {string} method - Clave del medio de pago (`efectivo`, `transferencia`, `mercadopago`, `tarjeta`).
   */
  const handleToggleCommPaymentMethod = (method) => {
    setCommPaymentMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  };

  /**
   * Guarda la ficha comercial rápida y disponibilidad de urgencias 24h mediante
   * `PATCH /api/v1/providers/commercial-profile`.
   * @param {React.FormEvent<HTMLFormElement>} e - Evento de envío del formulario.
   * @returns {Promise<void>}
   */
  const handleSaveCommercialProfile = async (e) => {
    e.preventDefault();
    setSavingCommercial(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/commercial-profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          accepts_emergencies: commAcceptsEmergencies,
          quote_visit_policy: commQuotePolicy,
          invoice_type: commInvoiceType,
          accepted_payment_methods: commPaymentMethods,
          service_bio: commServiceBio,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setSuccessMsg(
          data.message || 'Ficha comercial y urgencias 24h actualizadas correctamente.'
        );
        setShowCommercialEditor(false);
        await fetchProviderProfile();
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar la ficha comercial.');
      }
    } catch (error) {
      console.error('Error al guardar ficha comercial:', error);
      setErrorMsg('Error de conexión al guardar la ficha comercial.');
    } finally {
      setSavingCommercial(false);
    }
  };

  /**
   * Publica la respuesta del prestador a una pregunta pública de la comunidad (Q&A)
   * mediante `PATCH /api/v1/providers/questions/:questionId/answer`.
   * @param {number|string} questionId - Identificador de la pregunta a responder.
   * @returns {Promise<void>}
   */
  const handleAnswerPublicQuestion = async (questionId) => {
    const answerText = String(qaAnswerDrafts[questionId] || '').trim();
    if (answerText.length < 2) return;
    setAnsweringQuestionId(questionId);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/questions/${questionId}/answer`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ answer: answerText }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setSuccessMsg(data.message || 'Respuesta publicada en tu ficha pública.');
        setQaAnswerDrafts((prev) => ({ ...prev, [questionId]: '' }));
        await fetchProviderProfile();
      } else {
        setErrorMsg(data.error || 'No se pudo publicar la respuesta.');
      }
    } catch (error) {
      console.error('Error al responder pregunta pública:', error);
      setErrorMsg('Error de conexión al guardar la respuesta.');
    } finally {
      setAnsweringQuestionId(null);
    }
  };

  /**
   * Sincroniza el contador de bloques de agenda y fuerza el refresco del calendario vivo
   * (por ejemplo tras confirmar una visita o recargar manualmente).
   * @returns {Promise<void>}
   */
  const fetchProviderSchedule = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/schedule/provider`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setScheduleBlocks(data.blocks || []);
        setScheduleRefreshKey((prev) => prev + 1);
      }
    } catch (error) {
      console.error('Error al cargar agenda del prestador:', error);
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

  // Recarga bajo demanda disparada desde el botón ↻ en Zona 2D global
  useEffect(() => {
    if (!refreshNonce) return;
    fetchProviderProfile();
    fetchProviderSchedule();
    fetchIncomingVisits();
    fetchAssignedPasses();
    fetchProviderReviewContracts();
    fetchProviderContractsSummary();
  }, [refreshNonce]);

  /**
   * Normaliza una cadena (minúsculas sin acentos) para comparar rubros contra el catálogo oficial.
   * @param {string} value - Texto a normalizar.
   * @returns {string} Cadena normalizada.
   */
  const normalizeTextKey = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

  /**
   * Traduce un estado de auditoría documental al español amigable para mostrar en badges.
   * @param {string} status - Estado proveniente del backend (`approved`, `rejected`, `pending`).
   * @returns {{ label: string, tone: 'success'|'danger'|'warning' }} Etiqueta y tono visual.
   */
  const getAuditStatusMeta = (status) => {
    const normalized = String(status || 'pending').toLowerCase();
    if (normalized === 'approved') return { label: 'Aprobado', tone: 'success' };
    if (normalized === 'rejected') return { label: 'Rechazado', tone: 'danger' };
    return { label: 'En revisión', tone: 'warning' };
  };

  /**
   * Proyecta la documentación personal a nivel persona (no multiplicada por especialidad):
   * - `currentDocs`: exactamente 2 tarjetas vigentes/activas (**Antecedentes Penales** y
   *   **Póliza ART / Seguro**), priorizando la versión más reciente de `provider_document_versions`
   *   y haciendo fallback al perfil más reciente con datos cargados.
   * - `historicalDocs`: historial inmutable deduplicado de versiones anteriores/vencidas para
   *   auditoría legal en barrios cerrados (se muestra colapsado por defecto en modo solo lectura).
   */
  const personalDocumentsSummary = useMemo(() => {
    const profiles = profileData.providers || [];
    const versions = Array.isArray(profileData.document_history)
      ? profileData.document_history
      : [];
    const primaryProf = profiles[0] || null;

    const toDateKey = (v) => {
      if (!v) return '';
      const s = String(v).trim();
      return s.length >= 10 ? s.slice(0, 10) : s;
    };

    const normalizeDocSlot = (rawType) => {
      const t = normalizeTextKey(rawType);
      if (t.includes('insurance') || t.includes('art') || t.includes('seguro')) {
        return 'insurance';
      }
      return 'criminal';
    };

    const slotConfig = [
      {
        slot: 'insurance',
        field: 'art',
        docType: 'Póliza ART / Seguro',
      },
      {
        slot: 'criminal',
        field: 'criminal',
        docType: 'Antecedentes Penales',
      },
    ];

    const currentSignatureBySlot = new Map();
    const currentVersionIdBySlot = new Map();

    const currentDocs = slotConfig.map(({ slot, field, docType: slotTitle }) => {
      const slotVersions = versions.filter((v) => normalizeDocSlot(v.doc_type) === slot);
      const latestVersion = slotVersions[0] || null;

      // Fallback a la fila de `providers` más reciente que contenga este documento
      const fallbackProf =
        profiles.find((p) =>
          slot === 'criminal'
            ? Boolean(p.criminal_record_url || p.criminal_record_expiry)
            : Boolean(
                p.insurance_policy_url ||
                  p.art_insurance_url ||
                  p.insurance_expiry ||
                  p.art_insurance_expiry
              )
        ) || primaryProf;

      const profUrl =
        slot === 'criminal'
          ? fallbackProf?.criminal_record_url || ''
          : fallbackProf?.insurance_policy_url || fallbackProf?.art_insurance_url || '';
      const profTo =
        slot === 'criminal'
          ? fallbackProf?.criminal_record_expiry || fallbackProf?.criminal_record_valid_to || null
          : fallbackProf?.insurance_expiry || fallbackProf?.art_insurance_expiry || null;
      const profFrom =
        slot === 'criminal'
          ? fallbackProf?.criminal_record_valid_from || fallbackProf?.created_at || null
          : fallbackProf?.art_insurance_valid_from || fallbackProf?.created_at || null;

      const resolvedUrl = latestVersion?.document_url || profUrl || '';
      const resolvedFrom = latestVersion?.valid_from || latestVersion?.created_at || profFrom || null;
      const resolvedMetadata =
        (latestVersion?.metadata && typeof latestVersion.metadata === 'object'
          ? latestVersion.metadata
          : null) ||
        (slot === 'insurance'
          ? fallbackProf?.insurance_metadata || null
          : fallbackProf?.criminal_record_metadata || null);
      const resolvedIssuedAt =
        slot === 'criminal'
          ? fallbackProf?.criminal_record_issued_at ||
            resolvedMetadata?.issued_at ||
            resolvedFrom ||
            null
          : null;
      let standard180Expiry = null;
      if (slot === 'criminal' && resolvedIssuedAt) {
        const issuedDate = new Date(resolvedIssuedAt);
        if (!Number.isNaN(issuedDate.getTime())) {
          issuedDate.setDate(issuedDate.getDate() + 180);
          standard180Expiry = issuedDate.toISOString().slice(0, 10);
        }
      }
      let resolvedTo = latestVersion?.valid_to || profTo || null;
      if (slot === 'criminal' && !resolvedTo && standard180Expiry) {
        resolvedTo = standard180Expiry;
      }
      const resolvedAuditStatus =
        latestVersion?.status || fallbackProf?.status || primaryProf?.status || 'pending';
      const isMissing = !resolvedUrl && !resolvedTo && !resolvedIssuedAt;

      if (latestVersion?.id) {
        currentVersionIdBySlot.set(slot, latestVersion.id);
      }
      if (!isMissing) {
        currentSignatureBySlot.set(
          slot,
          `${slot}|${resolvedUrl.trim().toLowerCase()}|${toDateKey(resolvedFrom)}|${toDateKey(resolvedTo)}`
        );
      }

      return {
        key: `current-${slot}`,
        slot,
        field,
        profileId: latestVersion?.provider_id || fallbackProf?.id || primaryProf?.id || null,
        docType: slotTitle,
        url: resolvedUrl,
        validFrom: resolvedFrom,
        validTo: resolvedTo,
        issuedAt: resolvedIssuedAt,
        standard180Expiry,
        metadata: resolvedMetadata,
        auditStatus: resolvedAuditStatus,
        isMissing,
      };
    });

    // Construye el historial de versiones anteriores/vencidas evitando duplicados por especialidad
    const seenHistoryKeys = new Set();
    const historicalDocs = [];

    versions.forEach((v) => {
      const slot = normalizeDocSlot(v.doc_type);
      const docTitle = slot === 'insurance' ? 'Póliza ART / Seguro' : 'Antecedentes Penales';
      const url = String(v.document_url || '').trim();
      const validFrom = v.valid_from || v.created_at || null;
      const validTo = v.valid_to || null;
      const sig = `${slot}|${url.toLowerCase()}|${toDateKey(validFrom)}|${toDateKey(validTo)}`;

      // Excluir la versión actualmente vigente mostrada arriba
      if (currentVersionIdBySlot.get(slot) === v.id) return;
      if (currentSignatureBySlot.get(slot) === sig) return;
      if (seenHistoryKeys.has(sig)) return;

      seenHistoryKeys.add(sig);
      historicalDocs.push({
        key: `hist-${v.id}`,
        slot,
        docType: docTitle,
        url,
        validFrom,
        validTo,
        createdAt: v.created_at || null,
        auditStatus: v.status || 'pending',
      });
    });

    const loadedCount = currentDocs.filter((d) => !d.isMissing).length;
    return { currentDocs, historicalDocs, loadedCount };
  }, [profileData.providers, profileData.document_history]);

  // Cantidad de especialidades actualmente visibles para residentes en el directorio
  const activeSpecialtiesCount = useMemo(() => {
    return (profileData.providers || []).filter((p) => p.is_visible_in_directory !== false).length;
  }, [profileData.providers]);

  /**
   * Registra o renueva un documento personal de compliance (Antecedentes Penales o Póliza ART/Seguro).
   * Envía únicamente el documento cargado para que el backend lo propague a todas las especialidades
   * de la persona y conserve la versión anterior en el historial de auditoría.
   * @param {React.FormEvent<HTMLFormElement>} e - Evento de envío del formulario documental.
   * @returns {Promise<void>}
   */
  const handleCreateDocument = async (e) => {
    e.preventDefault();
    setSavingDoc(true);
    setErrorMsg('');
    setSuccessMsg('');

    const normalizedType = docType.toLowerCase();
    const isDni = normalizedType.includes('dni') || normalizedType.includes('identidad');

    // Carga o actualización del documento de identidad (DNI) a nivel cuenta (Nivel 1)
    if (isDni) {
      try {
        const dniPayload = {
          dni_document_url: docUrl.trim(),
          dni_back_url: docDniBackUrl.trim() || null,
        };
        if (docDniNumber.trim()) {
          dniPayload.dni = docDniNumber.trim();
        }
        const response = await fetch(`${API_BASE}/api/v1/providers/identity/document`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify(dniPayload),
        });
        const data = await response.json();
        if (response.ok) {
          setSuccessMsg(
            data.message || 'DNI cargado para validación de Administración (Nivel 1).'
          );
          setDocUrl('');
          setDocDniBackUrl('');
          setDocValidFrom('');
          setDocValidTo('');
          setShowDocForm(false);
          await fetchProviderProfile();
        } else {
          setErrorMsg(data.error || 'No se pudo guardar el documento de identidad.');
        }
      } catch (error) {
        console.error('Error al cargar DNI:', error);
        setErrorMsg('Error de conexión con el servidor.');
      } finally {
        setSavingDoc(false);
      }
      return;
    }

    const baseProfile = profileData.providers[0] || {};
    const isArt = normalizedType.includes('art') || normalizedType.includes('seguro');

    const docFields = isArt
      ? {
          insurance_policy_url: docUrl.trim(),
          art_insurance_url: docUrl.trim(),
          insurance_from: docValidFrom || null,
          insurance_expiry: docValidTo || null,
          art_insurance_expiry: docValidTo || null,
          insurance_metadata: {
            policy_type: docInsuranceType,
            insurer_name: docInsurerName.trim() || null,
            policy_number: docPolicyNumber.trim() || null,
            holder_cuit: docHolderCuit.trim() || null,
            coverage_summary: docInsuranceType === 'ap' ? docCoverageSummary.trim() || null : null,
          },
        }
      : {
          criminal_record_url: docUrl.trim(),
          criminal_record_issued_at: docCriminalIssuedAt || docValidFrom || null,
          criminal_record_from: docCriminalIssuedAt || docValidFrom || null,
          criminal_record_metadata: {
            issued_at: docCriminalIssuedAt || docValidFrom || null,
            request_code: docCriminalRequestCode.trim() || null,
            security_code: docCriminalSecurityCode.trim() || null,
          },
        };

    const payload = baseProfile.id
      ? docFields
      : {
          specialty: STANDARD_SPECIALTIES_CATALOG[0] || 'Mantenimiento General',
          ...docFields,
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
        setSuccessMsg(
          data.message || 'Documentación personal registrada y enviada a revisión de TrustLink.'
        );
        setDocUrl('');
        setDocValidFrom('');
        setDocValidTo('');
        setDocInsurerName('');
        setDocPolicyNumber('');
        setDocHolderCuit('');
        setDocCoverageSummary('');
        setDocCriminalIssuedAt('');
        setDocCriminalRequestCode('');
        setDocCriminalSecurityCode('');
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
   * Activa el modo de edición/renovación inline para uno de los 2 documentos personales vigentes.
   * @param {Object} docItem - Documento vigente seleccionado.
   */
  const startEditingDocument = (docItem) => {
    const meta = docItem.metadata && typeof docItem.metadata === 'object' ? docItem.metadata : {};
    setEditingDocKey(docItem.key);
    setEditDocUrl(docItem.url || '');
    setEditDocValidFrom(toDateInputValue(docItem.validFrom));
    setEditDocValidTo(toDateInputValue(docItem.validTo));
    if (docItem.slot === 'insurance') {
      setEditInsuranceType(meta.policy_type === 'art' ? 'art' : 'ap');
      setEditInsurerName(meta.insurer_name || '');
      setEditPolicyNumber(meta.policy_number || '');
      setEditHolderCuit(meta.holder_cuit || '');
      setEditCoverageSummary(meta.coverage_summary || '');
    } else {
      setEditCriminalIssuedAt(toDateInputValue(docItem.issuedAt || meta.issued_at || docItem.validFrom));
      setEditCriminalRequestCode(meta.request_code || '');
      setEditCriminalSecurityCode(meta.security_code || '');
    }
    setErrorMsg('');
    setSuccessMsg('');
  };

  /**
   * Persiste la renovación o edición de URL, metadatos y vigencias de un documento personal (Seguro AP/ART o Antecedentes).
   * Envía solo el documento modificado para sincronizarlo en todas las especialidades de la persona
   * y preservar la versión previa en `provider_document_versions`.
   * @param {Object} docItem - Documento vigente en edición.
   * @returns {Promise<void>}
   */
  const handleSaveDocumentEdit = async (docItem) => {
    setUpdatingDoc(true);
    setErrorMsg('');
    setSuccessMsg('');

    const targetProfile =
      profileData.providers.find((p) => p.id === docItem.profileId) || profileData.providers[0] || null;
    const isArt = docItem.field === 'art' || docItem.docType.toLowerCase().includes('art');

    const docFields = isArt
      ? {
          insurance_policy_url: editDocUrl.trim(),
          art_insurance_url: editDocUrl.trim(),
          insurance_from: editDocValidFrom || null,
          insurance_expiry: editDocValidTo || null,
          art_insurance_expiry: editDocValidTo || null,
          insurance_metadata: {
            policy_type: editInsuranceType,
            insurer_name: editInsurerName.trim() || null,
            policy_number: editPolicyNumber.trim() || null,
            holder_cuit: editHolderCuit.trim() || null,
            coverage_summary:
              editInsuranceType === 'ap' ? editCoverageSummary.trim() || null : null,
          },
        }
      : {
          criminal_record_url: editDocUrl.trim(),
          criminal_record_issued_at: editCriminalIssuedAt || editDocValidFrom || null,
          criminal_record_from: editCriminalIssuedAt || editDocValidFrom || null,
          criminal_record_metadata: {
            issued_at: editCriminalIssuedAt || editDocValidFrom || null,
            request_code: editCriminalRequestCode.trim() || null,
            security_code: editCriminalSecurityCode.trim() || null,
          },
        };

    try {
      const endpoint = targetProfile?.id
        ? `${API_BASE}/api/v1/providers/profile/${targetProfile.id}`
        : `${API_BASE}/api/v1/providers/profile`;
      const method = targetProfile?.id ? 'PATCH' : 'POST';
      const payload = targetProfile?.id
        ? docFields
        : {
            specialty: STANDARD_SPECIALTIES_CATALOG[0] || 'Mantenimiento General',
            ...docFields,
          };

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
        setSuccessMsg(
          data.message || 'Documentación personal actualizada; la versión anterior quedó en el historial.'
        );
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
   * Agrega una nueva especialidad al prestador (Fase 5.3):
   * - Desde el catálogo estándar: se auto-aprueba al instante si el compliance personal ya está aprobado.
   * - Desde "Otra especialidad" (`__custom__`): envía `is_custom_specialty: true` y su breve descripción
   *   para moderación puntual en Operaciones TrustLink.
   * @param {React.FormEvent<HTMLFormElement>} e - Evento de envío del formulario de especialidad.
   * @returns {Promise<void>}
   */
  const handleCreateSpecialty = async (e) => {
    e.preventDefault();
    const isCustomMode = selectedCatalogSpecialty === '__custom__';
    const specialtyName = isCustomMode ? newSpecialty.trim() : selectedCatalogSpecialty;
    if (!specialtyName) return;

    if (isCustomMode && customSpecialtyDesc.trim().length < 5) {
      setErrorMsg('Describí brevemente tu especialidad personalizada (mínimo 5 caracteres).');
      return;
    }

    setSavingSpecialty(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload = {
        specialty: specialtyName,
        is_custom_specialty: isCustomMode,
      };
      if (isCustomMode) {
        payload.custom_specialty_description = customSpecialtyDesc.trim();
      }

      const response = await fetch(`${API_BASE}/api/v1/providers/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (response.ok) {
        setSuccessMsg(
          data.message ||
            (data.auto_approved
              ? `Especialidad "${specialtyName}" activada automáticamente.`
              : 'Especialidad agregada correctamente.')
        );
        setSelectedCatalogSpecialty(STANDARD_SPECIALTIES_CATALOG[0]);
        setNewSpecialty('');
        setCustomSpecialtyDesc('');
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
   * Activa la edición inline de una especialidad precargando el selector de catálogo estándar
   * o el modo "Otra especialidad" con su descripción personalizada.
   * @param {Object} specialtyItem - Fila de especialidad seleccionada para editar.
   */
  const startEditingSpecialty = (specialtyItem) => {
    const targetKey = normalizeTextKey(specialtyItem.specialty);
    const standardMatch = STANDARD_SPECIALTIES_CATALOG.find(
      (cat) => normalizeTextKey(cat) === targetKey
    );

    if (standardMatch && !specialtyItem.is_custom_specialty) {
      setEditSpecialtyCatalog(standardMatch);
      setEditSpecialtyName('');
      setEditSpecialtyDesc('');
    } else {
      setEditSpecialtyCatalog('__custom__');
      setEditSpecialtyName(specialtyItem.specialty || '');
      setEditSpecialtyDesc(specialtyItem.custom_specialty_description || '');
    }

    setEditingSpecialtyId(specialtyItem.id);
    setErrorMsg('');
    setSuccessMsg('');
  };

  /**
   * Guarda una especialidad editada inline usando el catálogo estándar (auto-aprobado si el
   * compliance personal ya está validado) o el modo personalizado con breve descripción para Ops.
   * No reenvía URLs documentales para evitar duplicados en el historial documental.
   * @param {Object} specialtyItem - Perfil de especialidad a actualizar.
   * @returns {Promise<void>}
   */
  const handleSaveSpecialtyEdit = async (specialtyItem) => {
    const isCustomMode = editSpecialtyCatalog === '__custom__';
    const finalName = isCustomMode ? editSpecialtyName.trim() : editSpecialtyCatalog;
    if (!finalName) return;

    if (isCustomMode && editSpecialtyDesc.trim().length < 5) {
      setErrorMsg('Describí brevemente tu especialidad personalizada (mínimo 5 caracteres).');
      return;
    }

    setUpdatingSpecialty(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload = {
        specialty: finalName,
        is_custom_specialty: isCustomMode,
      };
      if (isCustomMode) {
        payload.custom_specialty_description = editSpecialtyDesc.trim();
      } else {
        payload.custom_specialty_description = null;
      }

      const response = await fetch(`${API_BASE}/api/v1/providers/profile/${specialtyItem.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (response.ok) {
        setSuccessMsg(
          data.message ||
            (data.auto_approved
              ? `Especialidad "${finalName}" actualizada y habilitada automáticamente.`
              : 'Especialidad actualizada correctamente.')
        );
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
   * Abre el panel inline para repactar fecha y horario de una solicitud de visita,
   * precargando la fecha actual solicitada en formato local `YYYY-MM-DDTHH:mm`.
   * @param {Object} visit - Solicitud de visita seleccionada.
   */
  const openVisitReschedule = (visit) => {
    const baseDate = visit?.preferred_date ? new Date(visit.preferred_date) : new Date(Date.now() + 2 * 3600000);
    const safe = Number.isNaN(baseDate.getTime()) ? new Date(Date.now() + 2 * 3600000) : baseDate;
    const pad = (n) => String(n).padStart(2, '0');
    const formatted = `${safe.getFullYear()}-${pad(safe.getMonth() + 1)}-${pad(safe.getDate())}T${pad(safe.getHours())}:${pad(safe.getMinutes())}`;
    setReschedulingVisitId(visit.id);
    setRescheduleDateDraft(formatted);
    setErrorMsg('');
    setSuccessMsg('');
  };

  /**
   * Responde a una solicitud de visita entrante confirmando (`confirm`), repactando un nuevo
   * día/horario (`propose` -> pasa a `pending_resident`) o rechazando (`decline`), y resincroniza
   * visitas y agenda viva.
   * @param {number|string} visitId - Identificador de la solicitud de visita.
   * @param {'confirm'|'propose'|'decline'} action - Decisión operativa del prestador.
   * @param {string} [proposedLocalDateTime=''] - Nueva fecha/hora local cuando `action === 'propose'`.
   * @returns {Promise<void>}
   */
  const handleRespondVisit = async (visitId, action, proposedLocalDateTime = '') => {
    if (action === 'propose' && !String(proposedLocalDateTime || '').trim()) {
      setErrorMsg('Elegí la nueva fecha y horario que querés proponerle al residente.');
      return;
    }

    setRespondingVisitId(visitId);
    setErrorMsg('');
    setSuccessMsg('');
    const replyText = String(visitReplyDrafts[visitId] || '').trim();
    const parsedProposed =
      action === 'propose' && proposedLocalDateTime ? new Date(proposedLocalDateTime) : null;
    const isoProposed =
      parsedProposed && !Number.isNaN(parsedProposed.getTime())
        ? parsedProposed.toISOString()
        : proposedLocalDateTime || undefined;

    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/visit-requests/${visitId}/respond`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          action,
          preferred_date: action === 'propose' ? isoProposed : undefined,
          reply_text: replyText || undefined,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(data.message || 'Respuesta registrada en la visita.');
        setVisitReplyDrafts((prev) => ({ ...prev, [visitId]: '' }));
        if (action === 'propose' || action === 'confirm' || action === 'decline') {
          setReschedulingVisitId(null);
          setRescheduleDateDraft('');
        }
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
   * Envía un mensaje de seguimiento del prestador en el hilo de una visita activa
   * (`POST /api/v1/passes/visit-requests/:id/messages`) desde el Modal de Detalle.
   */
  const handleSendProviderVisitMessage = async (visitId) => {
    const text = String(visitMessageDrafts[visitId] || '').trim();
    if (!text) return;
    setSendingVisitMessageId(visitId);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/visit-requests/${visitId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ text }),
      });
      if (response.ok) {
        setVisitMessageDrafts((prev) => ({ ...prev, [visitId]: '' }));
        await fetchIncomingVisits();
      } else {
        const data = await response.json().catch(() => ({}));
        setErrorMsg(data.error || 'No se pudo enviar el mensaje.');
      }
    } catch (error) {
      console.error('Error al enviar mensaje de visita desde prestador:', error);
      setErrorMsg('Error de conexión al enviar el mensaje.');
    } finally {
      setSendingVisitMessageId(null);
    }
  };

  /**
   * Abre el modal de presupuesto formal precargando el título del servicio o un presupuesto previo.
   * @param {Object} visit - Solicitud de visita sobre la cual se cotiza el trabajo.
   */
  const openQuoteModal = (visit) => {
    setQuoteModalVisit(visit);
    setQuoteDescriptionDraft(
      String(visit?.quote_description || visit?.service_title || '').trim()
    );
    setQuoteAmountDraft(
      visit?.quote_amount && Number(visit.quote_amount) > 0 ? String(Number(visit.quote_amount)) : ''
    );
    setQuoteNotesDraft(String(visit?.quote_notes || '').trim());
    setQuoteModalError('');
    setErrorMsg('');
    setSuccessMsg('');
  };

  /**
   * Envía o actualiza el presupuesto formal del prestador para una visita (`POST /api/v1/passes/visit-requests/:id/quote`).
   * @param {React.FormEvent<HTMLFormElement>} e - Evento de envío del formulario.
   * @returns {Promise<void>}
   */
  const handleSubmitVisitQuote = async (e) => {
    e.preventDefault();
    if (!quoteModalVisit?.id) return;

    const numericAmount = Number(quoteAmountDraft);
    const cleanDescription = String(quoteDescriptionDraft || '').trim();
    const cleanNotes = String(quoteNotesDraft || '').trim();

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setQuoteModalError('Ingresá un monto total válido mayor a cero.');
      return;
    }
    if (cleanDescription.length < 3) {
      setQuoteModalError('Describí brevemente qué trabajo incluye el presupuesto.');
      return;
    }

    setSavingQuote(true);
    setQuoteModalError('');
    try {
      const response = await fetch(
        `${API_BASE}/api/v1/passes/visit-requests/${quoteModalVisit.id}/quote`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            amount: numericAmount,
            description: cleanDescription,
            notes: cleanNotes || null,
          }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setSuccessMsg(
          data.message ||
            `Presupuesto de $${numericAmount.toLocaleString('es-AR')} enviado al residente.`
        );
        setQuoteModalVisit(null);
        setQuoteAmountDraft('');
        setQuoteDescriptionDraft('');
        setQuoteNotesDraft('');
        await fetchIncomingVisits();
      } else {
        setQuoteModalError(data.error || 'No se pudo enviar el presupuesto.');
      }
    } catch (error) {
      console.error('Error al enviar presupuesto de visita:', error);
      setQuoteModalError('Error de conexión al enviar el presupuesto.');
    } finally {
      setSavingQuote(false);
    }
  };

  /**
   * Abre el modal para publicar un nuevo servicio con precio fijo.
   */
  const openCreatePackageModal = () => {
    const firstSpec = profileData.providers?.[0]?.specialty || STANDARD_SPECIALTIES_CATALOG[0];
    setEditingPackage(null);
    setPkgSpecialty(firstSpec);
    setPkgTitle('');
    setPkgIncludes('');
    setPkgPrice('');
    setPkgDuration(60);
    setPkgModalError('');
    setPkgModalOpen(true);
  };

  /**
   * Abre el modal para editar un servicio con precio fijo existente.
   * @param {Object} pkg - Paquete de servicio seleccionado.
   */
  const openEditPackageModal = (pkg) => {
    setEditingPackage(pkg);
    setPkgSpecialty(pkg.specialty || profileData.providers?.[0]?.specialty || '');
    setPkgTitle(pkg.title || '');
    setPkgIncludes(pkg.includes_description || '');
    setPkgPrice(pkg.fixed_price ? String(Number(pkg.fixed_price)) : '');
    setPkgDuration(Number(pkg.estimated_duration_minutes || 60));
    setPkgModalError('');
    setPkgModalOpen(true);
  };

  /**
   * Crea o actualiza un servicio con precio fijo en el catálogo del prestador.
   */
  const handleSaveServicePackage = async (e) => {
    e.preventDefault();
    const numericPrice = Number(pkgPrice);
    if (String(pkgTitle || '').trim().length < 3) {
      setPkgModalError('Indicá un título claro del servicio (ej: Mantenimiento anual de termotanque).');
      return;
    }
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setPkgModalError('Ingresá un precio fijo válido mayor a cero.');
      return;
    }

    setSavingPackage(true);
    setPkgModalError('');
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const isEdit = Boolean(editingPackage?.id);
      const url = isEdit
        ? `${API_BASE}/api/v1/providers/service-packages/${editingPackage.id}`
        : `${API_BASE}/api/v1/providers/service-packages`;
      const response = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          specialty: pkgSpecialty,
          title: pkgTitle.trim(),
          includes_description: pkgIncludes.trim() || null,
          fixed_price: numericPrice,
          estimated_duration_minutes: Number(pkgDuration || 60),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setSuccessMsg(data.message || 'Servicio con precio fijo guardado.');
        setPkgModalOpen(false);
        setEditingPackage(null);
        await fetchProviderProfile();
      } else {
        setPkgModalError(data.error || 'No se pudo guardar el servicio.');
      }
    } catch (error) {
      console.error('Error al guardar servicio con precio fijo:', error);
      setPkgModalError('Error de conexión al guardar el servicio.');
    } finally {
      setSavingPackage(false);
    }
  };

  /**
   * Pausa o reactiva un servicio con precio fijo del catálogo.
   */
  const handleTogglePackageActive = async (pkg) => {
    setTogglingPackageId(pkg.id);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/service-packages/${pkg.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ is_active: !pkg.is_active }),
      });
      if (response.ok) {
        setSuccessMsg(
          pkg.is_active
            ? `Servicio "${pkg.title}" pausado en el directorio.`
            : `Servicio "${pkg.title}" reactivado en el directorio.`
        );
        await fetchProviderProfile();
      }
    } catch (error) {
      console.error('Error al alternar estado del servicio:', error);
    } finally {
      setTogglingPackageId(null);
    }
  };

  /**
   * Elimina un servicio con precio fijo del catálogo.
   */
  const handleDeleteServicePackage = async (pkgId) => {
    setDeletingPackageId(pkgId);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/service-packages/${pkgId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setSuccessMsg(data.message || 'Servicio eliminado de tu catálogo.');
        await fetchProviderProfile();
      }
    } catch (error) {
      console.error('Error al eliminar servicio con precio fijo:', error);
    } finally {
      setDeletingPackageId(null);
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

  // Contadores, búsqueda, orden de prioridad y paginación de Solicitudes y Visitas (paridad con Mis Servicios)
  const { visitCounts, filteredVisits } = useMemo(() => {
    const q = visitSearch.trim().toLowerCase();
    const counts = incomingVisits.reduce(
      (acc, v) => {
        const st = String(v.status || '').toLowerCase();
        const qSt = String(v.quote_status || '').toLowerCase();
        const isClosed = st === 'declined' || st === 'cancelled';
        const needsAction =
          st === 'pending_provider' || st === 'pending' || (!isClosed && qSt === 'changes_requested');
        acc.all += 1;
        if (needsAction) acc.action += 1;
        if (st === 'confirmed') acc.confirmed += 1;
        else if (isClosed) acc.closed += 1;
        else acc.pending += 1;
        return acc;
      },
      { all: 0, action: 0, pending: 0, confirmed: 0, closed: 0 }
    );

    const list = incomingVisits
      .filter((v) => {
        const st = String(v.status || '').toLowerCase();
        const qSt = String(v.quote_status || '').toLowerCase();
        const isClosed = st === 'declined' || st === 'cancelled';
        const needsAction =
          st === 'pending_provider' || st === 'pending' || (!isClosed && qSt === 'changes_requested');

        if (visitStatusFilter === 'action' && !needsAction) return false;
        if (
          visitStatusFilter === 'pending' &&
          !(st === 'pending_provider' || st === 'pending' || st === 'pending_resident')
        ) {
          return false;
        }
        if (visitStatusFilter === 'confirmed' && st !== 'confirmed') return false;
        if (visitStatusFilter === 'closed' && !isClosed) return false;

        if (q) {
          const searchable = `${v.id} ${v.service_title || ''} ${v.service_specialty || ''} ${
            v.provider_specialty || ''
          } ${v.owner_name || ''} ${v.fraction_number || ''} ${v.lot_number || ''} ${
            v.notes || ''
          }`.toLowerCase();
          if (!searchable.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (visitStatusFilter === 'action') {
          const aPri = String(a.status || '').toLowerCase() === 'pending_provider' ? 0 : 1;
          const bPri = String(b.status || '').toLowerCase() === 'pending_provider' ? 0 : 1;
          if (aPri !== bPri) return aPri - bPri;
        }
        return Number(b.id || 0) - Number(a.id || 0);
      });

    return { visitCounts: counts, filteredVisits: list };
  }, [incomingVisits, visitStatusFilter, visitSearch]);

  const {
    pageItems: paginatedVisits,
    safePage: safeVisitPage,
    totalPages: totalVisitPages,
  } = useMemo(
    () => paginateItems(filteredVisits, visitPage, visitPageSize),
    [filteredVisits, visitPage, visitPageSize]
  );

  const selectedVisitDetail = useMemo(
    () =>
      selectedVisitDetailId
        ? incomingVisits.find((v) => Number(v.id) === Number(selectedVisitDetailId)) || null
        : null,
    [incomingVisits, selectedVisitDetailId]
  );

  // Contadores por estado y filtrado de pases QR asignados (paridad con Mis Servicios)
  const { passCounts, filteredPasses } = useMemo(() => {
    const counts = assignedPasses.reduce(
      (acc, p) => {
        const st = String(p.status || '').toLowerCase();
        acc.all += 1;
        if (st === 'pending') acc.pending += 1;
        else if (st === 'used') acc.used += 1;
        else if (st === 'expired') acc.expired += 1;
        else if (st === 'cancelled') acc.cancelled += 1;
        return acc;
      },
      { all: 0, pending: 0, used: 0, expired: 0, cancelled: 0 }
    );
    const q = passSearch.trim().toLowerCase();
    const list = assignedPasses.filter((item) => {
      const status = String(item.status || '').toLowerCase();
      const matchesStatus = passStatusFilter === 'all' || status === passStatusFilter;
      const residentName = `${item.owner_first_name || ''} ${item.owner_last_name || ''} ${
        item.authorized_by || ''
      }`.toLowerCase();
      const dest = `${item.fraction_number || ''} ${item.lot_number || ''}`.toLowerCase();
      const plate = String(item.vehicle_plate || item.plate || '').toLowerCase();
      const spec = String(item.provider_specialty || '').toLowerCase();
      const token = String(item.qr_token || '').toLowerCase();

      const matchesQuery =
        !q ||
        residentName.includes(q) ||
        dest.includes(q) ||
        plate.includes(q) ||
        spec.includes(q) ||
        token.includes(q) ||
        String(item.id).includes(q);

      return matchesStatus && matchesQuery;
    });
    return { passCounts: counts, filteredPasses: list };
  }, [assignedPasses, passSearch, passStatusFilter]);

  // Paginación homologada (`AdminPaginationBar`: 6 / 12 / 24 / 50) sobre la lista de pases filtrados
  const {
    pageItems: paginatedPasses,
    safePage: safePassPage,
    totalPages: totalPassPages,
  } = useMemo(
    () => paginateItems(filteredPasses, passPage, passPageSize),
    [filteredPasses, passPage, passPageSize]
  );

  // Indicadores derivados para badges de navegación y resumen del encabezado
  const activePassesCount = assignedPasses.filter(
    (p) => String(p.status || '').toLowerCase() === 'pending'
  ).length;

  const pendingVisitsCount = incomingVisits.filter(
    (v) => String(v.status || '').toLowerCase() === 'pending_provider'
  ).length;

  const primaryProfile = profileData.providers[0] || null;
  const [todayStartMs] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });
  // Evaluación en vivo de los 4 requisitos reales para figurar en el Portal de Residentes
  const directoryReadiness = useMemo(() => {
    const rows = profileData.providers || [];
    const currentDocs = personalDocumentsSummary.currentDocs || [];
    const criminalDoc = currentDocs.find((d) => d.slot === 'criminal');
    const artDoc = currentDocs.find((d) => d.slot === 'insurance');

    const isDateExpired = (rawDate) => {
      if (!rawDate) return false;
      const d = new Date(rawDate);
      if (Number.isNaN(d.getTime())) return false;
      d.setHours(0, 0, 0, 0);
      return d.getTime() < todayStartMs;
    };

    const hasCriminal = Boolean(criminalDoc && !criminalDoc.isMissing);
    const criminalExpired = hasCriminal && isDateExpired(criminalDoc?.validTo);
    const criminalOk = hasCriminal && !criminalExpired;

    const hasArt = Boolean(artDoc && !artDoc.isMissing);
    const artExpired = hasArt && isDateExpired(artDoc?.validTo);
    const artOk = hasArt && !artExpired;

    const hasSpecialty = rows.length > 0;
    const visibleSpecsCount = rows.filter((r) => r.is_visible_in_directory !== false).length;
    const hasApprovedCompliance = rows.some((r) => r.status === 'approved');
    const hasApprovedVisibleSpecialty = rows.some(
      (r) =>
        r.status === 'approved' &&
        String(r.specialty_approval_status || 'approved').toLowerCase() === 'approved' &&
        r.is_visible_in_directory !== false
    );
    const hasDirectoryEligibleSpecialty = rows.some(
      (r) =>
        r.status !== 'rejected' &&
        String(r.specialty_approval_status || 'approved').toLowerCase() === 'approved' &&
        r.is_visible_in_directory !== false
    );
    const isAllRejected = rows.length > 0 && rows.every((r) => r.status === 'rejected');
    const phoneVerified = profileData.phone_verified !== false;
    const identityVerified = Boolean(profileData.identity_verified) || hasApprovedCompliance;
    const hasDniDoc = Boolean(profileData.dni_document_url);
    const autoVerified = Boolean(profileData.auto_verified);
    const isVerifiedMember = Boolean(profileData.membership?.is_verified_member);
    const providerInputsComplete = criminalOk && artOk && hasDirectoryEligibleSpecialty;
    const isComplianceApproved =
      hasApprovedCompliance && hasApprovedVisibleSpecialty && criminalOk && artOk;
    const isFeaturedPartner = Boolean(
      (profileData.is_featured_partner || isVerifiedMember) && isComplianceApproved && phoneVerified
    );

    // Respaldo determinista en escala oficial N0..N4 si el backend aún no envió `trust_badge`
    const fallbackLevel = isAllRejected
      ? 0
      : !phoneVerified || !identityVerified || !hasDirectoryEligibleSpecialty
        ? 0
        : hasApprovedCompliance && (criminalExpired || artExpired)
          ? artOk
            ? 2
            : 1
          : isComplianceApproved && autoVerified
            ? 4
            : isComplianceApproved
              ? 3
              : artOk
                ? 2
                : 1;

    const resolvedTrustBadge = profileData.trust_badge || {
      level: fallbackLevel,
      tier: isAllRejected
        ? 'rejected'
        : hasApprovedCompliance && (criminalExpired || artExpired)
          ? 'docs_expired'
          : fallbackLevel === 4
            ? 'verified'
            : fallbackLevel === 3
              ? 'qr_ready'
              : fallbackLevel === 2
                ? criminalOk
                  ? 'docs_in_review'
                  : 'insurance_review'
                : fallbackLevel === 1
                  ? 'basic'
                  : 'account_created',
      label: isAllRejected
        ? 'Rechazado'
        : !phoneVerified
          ? 'SMS pendiente'
          : hasApprovedCompliance && (criminalExpired || artExpired)
            ? 'Doc. vencida'
            : fallbackLevel === 4
              ? 'Verificado'
              : fallbackLevel === 3
                ? 'Pase QR habilitado'
                : fallbackLevel === 2
                  ? criminalOk
                    ? 'Doc. en validación'
                    : 'Seguro en revisión'
                  : fallbackLevel === 1
                    ? 'Perfil Básico'
                    : 'Cuenta creada',
      tone: isAllRejected || (hasApprovedCompliance && (criminalExpired || artExpired))
        ? 'danger'
        : fallbackLevel === 4
          ? 'emerald'
          : fallbackLevel === 3
            ? 'teal'
            : fallbackLevel === 2
              ? 'sky'
              : 'slate',
      is_verified: fallbackLevel >= 4,
      visible_in_directory:
        !isAllRejected && phoneVerified && identityVerified && hasDirectoryEligibleSpecialty,
      can_issue_pass: fallbackLevel >= 3,
      has_expired_docs: criminalExpired || artExpired,
      is_featured_partner: isFeaturedPartner,
      checks: {
        phone_ok: phoneVerified,
        identity_ok: identityVerified,
        specialty_ok: hasDirectoryEligibleSpecialty,
        criminal_ok: criminalOk,
        criminal_expired: criminalExpired,
        art_ok: artOk,
        art_expired: artExpired,
        compliance_ok: isComplianceApproved,
        pass_qr_ok: fallbackLevel >= 3,
        auto_verified_ok: fallbackLevel >= 4,
        member_ok: isFeaturedPartner,
      },
    };

    const trustLevel = Number(resolvedTrustBadge.level ?? fallbackLevel);
    const isVisibleInDirectory = Boolean(resolvedTrustBadge.visible_in_directory);
    const canIssuePass = Boolean(resolvedTrustBadge.can_issue_pass);

    let visibilityLabel = 'Oculto en directorio';
    let visibilityTone = 'warning';
    let visibilityHeadline = 'Todavía no figurás en el Portal de Residentes';
    let summaryHint =
      resolvedTrustBadge.next_step_hint ||
      'Completá tu DNI y agregá al menos 1 especialidad visible para activar Nivel 1.';

    if (isAllRejected) {
      visibilityLabel = 'Rechazado · Oculto';
      visibilityTone = 'danger';
      visibilityHeadline = 'Tu solicitud fue rechazada y no figurás en el directorio';
      summaryHint =
        'Actualizá tus documentos o especialidades para solicitar una nueva evaluación de TrustLink.';
    } else if (!phoneVerified) {
      visibilityLabel = 'N0 · SMS pendiente';
      visibilityTone = 'warning';
      visibilityHeadline = 'Falta validar tu celular por SMS para habilitar tu cuenta';
      summaryHint =
        'Validá el código SMS o solicitá a Administración que valide tu celular manualmente. Mientras tanto podés ir cargando tu DNI y especialidad.';
    } else if (hasApprovedCompliance && (criminalExpired || artExpired)) {
      visibilityLabel = 'Pausado · Doc. vencida';
      visibilityTone = 'danger';
      visibilityHeadline = 'Tu acceso con Pase QR está pausado por documentación vencida';
      summaryHint =
        'Renová tu Seguro AP/ART o Antecedentes Penales vencidos para recuperar los Pases QR en garita.';
    } else if (canIssuePass) {
      visibilityLabel = trustLevel >= 4 ? 'Visible · Verificado N4' : 'Visible + Pase QR (N3)';
      visibilityTone = 'success';
      visibilityHeadline =
        trustLevel >= 4
          ? 'Tenés tilde oficial Verificado (N4) y Pases QR habilitados en garita'
          : 'Estás en Nivel 3: habilitado para emitir Pases QR en garita';
      summaryHint =
        trustLevel >= 4
          ? 'Tu documentación está cotejada y vigente. Opcionalmente podés sumar Plan Destacado para priorizar tu perfil en búsquedas.'
          : 'Ya podés emitir Pases QR. TrustLink cotejará tus PDFs para otorgarte el tilde oficial N4 Verificado; además ya podés activar Plan Destacado.';
    } else if (isVisibleInDirectory) {
      visibilityLabel = 'Visible · Solo consultas';
      visibilityTone = 'info';
      visibilityHeadline = `Ya sos visible en el directorio como "${resolvedTrustBadge.label}" (sin Pase QR aún)`;
      summaryHint =
        resolvedTrustBadge.next_step_hint ||
        'Cargá tu Seguro (AP o ART) y tus Antecedentes Penales para subir a Nivel 3 y habilitar Pases QR en garita.';
    } else if (hasApprovedCompliance && !hasDirectoryEligibleSpecialty) {
      visibilityLabel = 'Oculto · Sin rubro visible';
      visibilityTone = 'warning';
      visibilityHeadline = 'Tu compliance está aprobado pero ocultaste tus especialidades';
      summaryHint = 'Activá la visibilidad de al menos 1 especialidad para volver a aparecer ante residentes.';
    } else if (!hasDirectoryEligibleSpecialty && !identityVerified) {
      summaryHint = hasDniDoc
        ? 'Ya cargaste tu DNI (en revisión por Administración). Agregá al menos 1 especialidad visible para aparecer en Nivel 1 apenas validen tu DNI.'
        : 'Paso N1: cargá tu DNI (frente y dorso) y agregá al menos 1 especialidad visible para aparecer como Perfil Básico.';
    } else if (!hasDirectoryEligibleSpecialty) {
      summaryHint =
        'Tu DNI ya está validado: agregá al menos 1 especialidad visible para aparecer inmediatamente en el directorio (Nivel 1).';
    } else if (!identityVerified) {
      summaryHint = hasDniDoc
        ? 'Ya cargaste tu DNI y especialidad: Administración TrustLink lo revisará para validar tu identidad y activar tu Nivel 1. Mientras tanto podés adelantar Seguro y Antecedentes.'
        : 'Ya cargaste especialidad: cargá tu DNI en el paso N1 para que Administración lo valide y active tu Nivel 1.';
    }

    return {
      hasCriminal,
      criminalExpired,
      criminalOk,
      hasArt,
      artExpired,
      artOk,
      hasSpecialty,
      hasVisibleSpecialty: hasDirectoryEligibleSpecialty,
      visibleSpecsCount,
      phoneVerified,
      identityVerified,
      hasDniDoc,
      autoVerified,
      isVerifiedMember,
      isFeaturedPartner,
      hasApprovedCompliance,
      isAllRejected,
      providerInputsComplete,
      isFullyVerified: isComplianceApproved,
      isVisibleInDirectory,
      canIssuePass,
      trustLevel,
      resolvedTrustBadge,
      visibilityLabel,
      visibilityTone,
      visibilityHeadline,
      summaryHint,
    };
  }, [
    profileData.providers,
    profileData.dni_document_url,
    profileData.phone_verified,
    profileData.identity_verified,
    profileData.auto_verified,
    profileData.is_featured_partner,
    profileData.membership,
    profileData.trust_badge,
    personalDocumentsSummary.currentDocs,
    todayStartMs,
  ]);
  // Scoring unificado con el motor de reputación (evita desfasaje frente a "Mi Reputación")
  const headerScoring = Number(
    profileData.reputation?.rating_avg ?? primaryProfile?.rating_avg ?? 0
  ).toFixed(2);

  const unansweredQaCount = useMemo(
    () =>
      Array.isArray(profileData.public_questions)
        ? profileData.public_questions.filter((q) => !q.answer).length
        : 0,
    [profileData.public_questions]
  );

  // Publica estado y contadores vivos hacia la Zona 2D global (App.jsx)
  useEffect(() => {
    if (typeof onHeaderMetaChange !== 'function') return;
    onHeaderMetaChange({
      trustLevel: directoryReadiness.trustLevel,
      trustLabel: directoryReadiness.resolvedTrustBadge?.label || 'Portal Prestador',
      scoring: headerScoring,
      fleetCount: profileData.vehicles.length + profileData.employees.length,
      scheduleCount: scheduleBlocks.length,
      pendingVisitsCount,
      totalVisitsCount: incomingVisits.length,
      activePassesCount,
      totalPassesCount: assignedPasses.length,
      reviewsCount: reviewContracts.length,
      unansweredQaCount,
      refreshing: loading,
    });
  }, [
    onHeaderMetaChange,
    directoryReadiness.trustLevel,
    directoryReadiness.resolvedTrustBadge?.label,
    headerScoring,
    profileData.vehicles.length,
    profileData.employees.length,
    scheduleBlocks.length,
    pendingVisitsCount,
    incomingVisits.length,
    activePassesCount,
    assignedPasses.length,
    reviewContracts.length,
    unansweredQaCount,
    loading,
  ]);

  // Tira contextual "Acciones pendientes" (solo visible si hay actividad operativa real)
  const providerQuickActions = useMemo(() => {
    const items = [];
    if (pendingVisitsCount > 0) {
      items.push({
        id: 'pending-visits',
        eyebrow: 'Requiere tu respuesta',
        title: `${pendingVisitsCount} solicitud(es) de visita pendiente(s)`,
        cta: 'Responder visitas',
        tone: 'amber',
        onClick: () => setActiveStep('visits'),
      });
    }
    if (unansweredQaCount > 0) {
      items.push({
        id: 'unanswered-qa',
        eyebrow: 'Consultas de vecinos',
        title: `${unansweredQaCount} pregunta(s) sin responder en tu ficha`,
        cta: 'Responder preguntas',
        tone: 'sky',
        onClick: () => {
          setActiveStep('credentials');
          setShowQaPanel(true);
        },
      });
    }
    if (activePassesCount > 0) {
      items.push({
        id: 'active-passes',
        eyebrow: 'Ingresos habilitados',
        title: `${activePassesCount} Pase(s) QR vigente(s) para garita`,
        cta: 'Ver Pases QR',
        tone: 'emerald',
        onClick: () => setActiveStep('passes'),
      });
    }
    return items.slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingVisitsCount, unansweredQaCount, activePassesCount]);

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
      label: 'Flota y Equipo',
      count: profileData.vehicles.length + profileData.employees.length,
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
      label: 'Reputación',
      count: reviewContracts.length,
      icon: Star,
    },
  ];

  const canShowMembershipCard =
    Number(profileData.trust_level ?? (directoryReadiness.canIssuePass ? 3 : 0)) >= 3 ||
    Boolean(profileData.membership?.is_verified_member);

  return (
    <div className={PAGE_SHELL_CLASS}>
      {/* Cabecera local + selector de 6 pestañas (se omiten cuando la Zona 2D global asume la navegación) */}
      {!useGlobalHeader && (
        <>
          <div
            className="rounded-2xl p-5 sm:p-6 border border-white/10 shadow-md flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
            style={cardStyle}
          >
            <div className="space-y-1 min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                <ShieldCheck size={14} />
                <span>Portal Prestador</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                Credenciales, agenda, visitas y pases QR
              </h1>
              <p className="text-xs sm:text-sm opacity-80">
                Gestioná tu documentación verificada, flota, disponibilidad online, visitas y reputación.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap lg:flex-nowrap shrink-0 self-start lg:self-auto">
              <ProviderTrustBadge
                trust={directoryReadiness.resolvedTrustBadge}
                showLevel
                size="md"
              />
              <span
                className={`text-xs font-bold px-2.5 py-1.5 rounded-xl border inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  directoryReadiness.visibilityTone === 'gold'
                    ? 'bg-amber-950/60 text-amber-200 border-amber-500/60'
                    : directoryReadiness.visibilityTone === 'success'
                      ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60'
                      : directoryReadiness.visibilityTone === 'danger'
                        ? 'bg-rose-950/70 text-rose-300 border-rose-700/60'
                        : directoryReadiness.visibilityTone === 'info'
                          ? 'bg-sky-950/70 text-sky-200 border-sky-500/55'
                          : 'bg-amber-950/70 text-amber-200 border-amber-500/55'
                }`}
                title={directoryReadiness.summaryHint}
              >
                {directoryReadiness.visibilityTone === 'danger' ? (
                  <AlertCircle size={13} className="shrink-0" />
                ) : directoryReadiness.isVisibleInDirectory ? (
                  <Eye size={13} className="shrink-0" />
                ) : (
                  <EyeOff size={13} className="shrink-0" />
                )}
                <span>{directoryReadiness.visibilityLabel}</span>
              </span>
              <span
                className="text-xs font-bold px-2.5 py-1.5 rounded-xl border border-slate-700/80 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                style={innerStyle}
              >
                <Star size={13} className="text-amber-400 fill-amber-400 shrink-0" />
                <span>Scoring: {headerScoring}</span>
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
                className="p-2 rounded-xl border border-slate-700/80 hover:opacity-90 cursor-pointer shrink-0"
                style={innerStyle}
                title="Actualizar información del prestador"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

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
        </>
      )}

      {/* Tira contextual "Acciones pendientes" (solo visible si hay visitas, preguntas o pases activos) */}
      {!loading && providerQuickActions.length > 0 && (
        <div
          className={`grid grid-cols-1 gap-2.5 ${
            providerQuickActions.length === 2
              ? 'md:grid-cols-2'
              : providerQuickActions.length >= 3
                ? 'md:grid-cols-3'
                : ''
          }`}
        >
          {providerQuickActions.map((item) => {
            const toneBorder =
              item.tone === 'emerald'
                ? 'border-emerald-500/35'
                : item.tone === 'sky'
                  ? 'border-sky-400/40'
                  : 'border-amber-400/40';
            const toneText =
              item.tone === 'emerald'
                ? 'text-emerald-300'
                : item.tone === 'sky'
                  ? 'text-sky-300'
                  : 'text-amber-300';
            return (
              <div
                key={item.id}
                className={`rounded-xl px-4 py-2.5 border ${toneBorder} flex items-center justify-between gap-3`}
                style={cardStyle}
              >
                <div className="min-w-0 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${toneText}`}>
                    {item.eyebrow}
                  </span>
                  <span className="text-xs font-extrabold truncate">{item.title}</span>
                </div>
                <button
                  type="button"
                  onClick={item.onClick}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-white/15 hover:opacity-90 cursor-pointer shrink-0 whitespace-nowrap"
                  style={
                    item.tone === 'amber'
                      ? { backgroundColor: primaryColor, color: '#ffffff', borderColor: 'transparent' }
                      : innerStyle
                  }
                >
                  {item.cta}
                </button>
              </div>
            );
          })}
        </div>
      )}

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
                      ({formatDateShort(alert.expiry_date)})
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

      {/* Aviso compacto de 1 línea en pasos 2..6 cuando todavía no alcanzó Nivel 3 (Pase QR) */}
      {!loading && activeStep !== 'credentials' && !directoryReadiness.canIssuePass && (
        <div
          className={`rounded-xl px-4 py-2.5 border flex flex-wrap items-center justify-between gap-2 text-xs ${
            directoryReadiness.isAllRejected ||
            (directoryReadiness.hasApprovedCompliance &&
              (directoryReadiness.criminalExpired || directoryReadiness.artExpired))
              ? 'border-rose-800/80 bg-rose-950/40 text-rose-100'
              : directoryReadiness.trustLevel === 2
                ? 'border-orange-400/60 bg-orange-950/35 text-orange-100'
                : directoryReadiness.trustLevel === 1
                  ? 'border-slate-400/45 bg-slate-900/55 text-slate-100'
                  : 'border-amber-700/80 bg-amber-950/35 text-amber-100'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle size={15} className="shrink-0 opacity-90" />
            <span className="font-semibold truncate">
              Nivel {directoryReadiness.trustLevel}/4 ({directoryReadiness.resolvedTrustBadge?.label}) ·{' '}
              {directoryReadiness.isVisibleInDirectory
                ? 'Visible para consultas, aún sin Pase QR en garita.'
                : 'Aún oculto en el directorio de residentes.'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveStep('credentials')}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-white/20 bg-black/30 hover:bg-black/50 cursor-pointer shrink-0"
          >
            Completar en 1. Credenciales
          </button>
        </div>
      )}

      {/* Panel de Estadio y Camino de Confianza Progresiva (Niveles N0..N4) — exclusivo de Paso 1 Credenciales */}
      {!loading &&
        activeStep === 'credentials' &&
        (() => {
          const level = directoryReadiness.trustLevel;
          const isDanger =
            directoryReadiness.isAllRejected ||
            (directoryReadiness.hasApprovedCompliance &&
              (directoryReadiness.criminalExpired || directoryReadiness.artExpired));
          const isQrReadyOrHigher = directoryReadiness.canIssuePass && !isDanger;

          const calloutBoxClass = isDanger
            ? 'border-rose-800/80 bg-rose-950/40 text-rose-100'
            : level >= 4 && isQrReadyOrHigher
              ? 'border-sky-400/65 bg-sky-950/35 text-sky-50'
              : level === 3 && isQrReadyOrHigher
                ? 'border-emerald-500/65 bg-emerald-950/30 text-emerald-50'
                : level === 2
                  ? 'border-orange-400/60 bg-orange-950/30 text-orange-50'
                  : level === 1
                    ? 'border-slate-400/45 bg-slate-900/55 text-slate-100'
                    : 'border-amber-700/80 bg-amber-950/35 text-amber-100';

          const progressFillClass = isDanger
            ? 'bg-rose-400/90'
            : level >= 4 && isQrReadyOrHigher
              ? 'bg-sky-400'
              : level === 3 && isQrReadyOrHigher
                ? 'bg-emerald-400'
                : level === 2
                  ? 'bg-orange-400'
                  : level === 1
                    ? 'bg-slate-300'
                    : 'bg-amber-400/90';

          const showFullLadder = showTrustRoadmapExpanded;

          const openDocModal = (targetDocType) => {
            setActiveStep('credentials');
            setDocType(targetDocType);
            if (targetDocType === 'Documento de Identidad (DNI)') {
              setDocDniNumber(profileData.dni || '');
              setDocUrl(profileData.dni_document_url || '');
              setDocDniBackUrl(profileData.dni_back_url || '');
            }
            setShowDocForm(true);
          };

          // Único CTA prioritario según el siguiente paso real del prestador (evita botones repetidos)
          const nextPriorityAction =
            !directoryReadiness.identityVerified && !directoryReadiness.hasDniDoc
              ? {
                  label: 'Cargar DNI',
                  onClick: () => openDocModal('Documento de Identidad (DNI)'),
                }
              : !directoryReadiness.hasVisibleSpecialty
                ? {
                    label: directoryReadiness.hasSpecialty ? 'Activar rubro' : 'Agregar rubro',
                    onClick: () => {
                      if (!directoryReadiness.hasSpecialty) setShowSpecialtyForm(true);
                    },
                  }
                : !directoryReadiness.artOk
                  ? {
                      label: directoryReadiness.artExpired
                        ? 'Renovar Seguro AP/ART'
                        : 'Cargar Seguro AP/ART',
                      onClick: () => openDocModal('Póliza ART / Seguro'),
                    }
                  : !directoryReadiness.criminalOk
                    ? {
                        label: directoryReadiness.criminalExpired
                          ? 'Renovar Antecedentes'
                          : 'Cargar Antecedentes',
                        onClick: () => openDocModal('Antecedentes Penales'),
                      }
                    : null;

          const levelSteps = [
            {
              num: 1,
              title: 'N1 · Perfil Básico',
              benefit: 'Visible para consultas',
              done:
                directoryReadiness.phoneVerified &&
                directoryReadiness.identityVerified &&
                directoryReadiness.hasVisibleSpecialty,
              isCurrent: level === 1 && !isDanger,
              statusLabel: !directoryReadiness.phoneVerified
                ? 'SMS pend.'
                : directoryReadiness.identityVerified && directoryReadiness.hasVisibleSpecialty
                  ? 'Logrado'
                  : !directoryReadiness.identityVerified && !directoryReadiness.hasDniDoc
                    ? 'Falta DNI'
                    : !directoryReadiness.identityVerified && directoryReadiness.hasDniDoc
                      ? 'DNI en revisión'
                      : 'Falta rubro',
              statusTone:
                directoryReadiness.phoneVerified &&
                directoryReadiness.identityVerified &&
                directoryReadiness.hasVisibleSpecialty
                  ? 'done'
                  : !directoryReadiness.identityVerified && directoryReadiness.hasDniDoc
                    ? 'info'
                    : 'pending',
              detail: !directoryReadiness.phoneVerified
                ? 'Falta validar tu celular por SMS (o validación manual en Administración).'
                : directoryReadiness.identityVerified && directoryReadiness.hasVisibleSpecialty
                  ? 'DNI validado y especialidad visible en el directorio.'
                  : !directoryReadiness.identityVerified && !directoryReadiness.hasDniDoc
                    ? 'Cargá tu Nro. de DNI, fotos/PDF frente y dorso y al menos 1 rubro.'
                    : !directoryReadiness.identityVerified && directoryReadiness.hasDniDoc
                      ? 'DNI cargado. Administración lo revisará para activar Nivel 1.'
                      : 'DNI validado. Agregá o activá al menos 1 especialidad visible.',
              cta:
                !directoryReadiness.identityVerified && !directoryReadiness.hasDniDoc
                  ? {
                      label: 'Cargar DNI',
                      onClick: () => openDocModal('Documento de Identidad (DNI)'),
                    }
                  : !directoryReadiness.hasVisibleSpecialty
                    ? {
                        label: directoryReadiness.hasSpecialty ? 'Activar rubro' : 'Agregar rubro',
                        onClick: () => {
                          setActiveStep('credentials');
                          if (!directoryReadiness.hasSpecialty) setShowSpecialtyForm(true);
                        },
                      }
                    : null,
            },
            {
              num: 2,
              title: 'N2 · Seguro en revisión',
              benefit: 'Seguro AP o ART vigente',
              done: directoryReadiness.artOk,
              isCurrent: level === 2 && !isDanger,
              statusLabel: directoryReadiness.artOk
                ? isQrReadyOrHigher
                  ? 'Aprobado'
                  : 'Logrado'
                : directoryReadiness.artExpired
                  ? 'Vencido'
                  : 'Pendiente',
              statusTone: directoryReadiness.artOk
                ? 'done'
                : directoryReadiness.artExpired
                  ? 'danger'
                  : 'pending',
              detail: directoryReadiness.artOk
                ? isQrReadyOrHigher
                  ? 'Póliza de Seguro AP / ART vigente y aprobada.'
                  : 'Seguro cargado · pasa a aprobación final en Nivel 3.'
                : 'Cargá Seguro de Accidentes Personales (si trabajás solo) o Póliza ART (si tenés ayudantes).',
              cta: !directoryReadiness.artOk
                ? {
                    label: directoryReadiness.artExpired ? 'Renovar Seguro' : 'Cargar Seguro',
                    onClick: () => openDocModal('Póliza ART / Seguro'),
                  }
                : null,
            },
            {
              num: 3,
              title: 'N3 · Pase QR habilitado',
              benefit: 'Antecedentes + Ingreso QR',
              done: isQrReadyOrHigher,
              isCurrent: level === 3 && isQrReadyOrHigher,
              statusLabel: isQrReadyOrHigher
                ? 'Logrado'
                : isDanger
                  ? directoryReadiness.isAllRejected
                    ? 'Rechazado'
                    : 'Doc. vencida'
                  : directoryReadiness.criminalOk && directoryReadiness.artOk
                    ? 'En revisión'
                    : directoryReadiness.criminalExpired
                      ? 'Vencido'
                      : 'Pendiente',
              statusTone: isQrReadyOrHigher
                ? 'done'
                : isDanger
                  ? 'danger'
                  : directoryReadiness.criminalOk && directoryReadiness.artOk
                    ? 'info'
                    : 'pending',
              detail: isQrReadyOrHigher
                ? 'Seguro y Antecedentes aprobados: ya podés generar y recibir Pases QR en garita.'
                : directoryReadiness.criminalOk && directoryReadiness.artOk
                  ? 'Documentación completa en revisión para habilitar Pases QR.'
                  : 'Cargá tu Certificado de Antecedentes Penales (fecha de emisión, trámite y cód. de seguridad).',
              cta: !directoryReadiness.criminalOk
                ? {
                    label: directoryReadiness.criminalExpired
                      ? 'Renovar Antecedentes'
                      : 'Cargar Antecedentes',
                    onClick: () => openDocModal('Antecedentes Penales'),
                  }
                : null,
            },
            {
              num: 4,
              title: 'N4 · Verificado',
              benefit: 'Tilde oficial TrustLink',
              done: level >= 4 && isQrReadyOrHigher,
              isCurrent: level >= 4 && isQrReadyOrHigher,
              statusLabel:
                level >= 4 && isQrReadyOrHigher
                  ? 'Activo ✓'
                  : isQrReadyOrHigher
                    ? 'En cotejo'
                    : 'Requiere N3',
              statusTone:
                level >= 4 && isQrReadyOrHigher
                  ? 'done'
                  : isQrReadyOrHigher
                    ? 'info'
                    : 'muted',
              detail:
                level >= 4 && isQrReadyOrHigher
                  ? 'TrustLink cotejó tus PDFs contra tus datos: contás con el sello oficial N4.'
                  : isQrReadyOrHigher
                    ? 'Pendiente de cotejo de PDFs (DNI, Seguro y Antecedentes) por TrustLink.'
                    : 'Alcanzá Nivel 3 primero para acceder al tilde oficial de verificación documental.',
              cta: null,
            },
          ];

          return (
            <section className={`rounded-2xl px-4 py-3.5 border space-y-2.5 text-xs ${calloutBoxClass}`}>
              {/* Franja compacta de 1 línea: estado + 1 único CTA prioritario + desplegable N1–N4 */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap font-bold">
                    {isQrReadyOrHigher && level >= 4 ? (
                      <VerifiedSeal size={17} />
                    ) : isQrReadyOrHigher ? (
                      <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle
                        size={15}
                        className={
                          isDanger
                            ? 'text-rose-400 shrink-0'
                            : level === 2
                              ? 'text-indigo-400 shrink-0'
                              : level === 1
                                ? 'text-slate-300 shrink-0'
                                : 'text-amber-400 shrink-0'
                        }
                      />
                    )}
                    <span className="text-xs sm:text-sm font-extrabold">
                      Nivel {level} / 4 · {directoryReadiness.resolvedTrustBadge?.label}
                    </span>
                    <span className="text-[11px] font-semibold opacity-80">
                      — {level >= 4 && isQrReadyOrHigher ? 'Pase QR habilitado' : directoryReadiness.visibilityLabel}
                    </span>
                    {directoryReadiness.isFeaturedPartner && <FeaturedPartnerBadge compact />}
                  </div>
                  <p className="text-[11px] opacity-85">{directoryReadiness.summaryHint}</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {nextPriorityAction && (
                    <button
                      type="button"
                      onClick={nextPriorityAction.onClick}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-95 cursor-pointer shrink-0"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {nextPriorityAction.label}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowTrustRoadmapExpanded((prev) => !prev)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold border border-white/15 bg-black/25 hover:bg-black/40 cursor-pointer shrink-0"
                  >
                    <span>{showFullLadder ? 'Ocultar escala N1–N4' : 'Ver escala N1–N4'}</span>
                    {showFullLadder ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>
              </div>

              {/* Barra de progreso sobre 4 niveles objetivos */}
              <div className="h-1.5 w-full rounded-full overflow-hidden bg-black/35 border border-white/10">
                <div
                  className={`h-full transition-all ${progressFillClass}`}
                  style={{ width: `${Math.max(8, Math.round((level / 4) * 100))}%` }}
                />
              </div>

              {/* Vista previa de cómo te ven los residentes + escalera de 4 niveles (desplegable a demanda) */}
              {showFullLadder && (
                <div className="space-y-3 pt-1">
                  <div className="rounded-xl px-3 py-2 border border-white/15 bg-black/25 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                      Así te ven los residentes hoy
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {directoryReadiness.isVisibleInDirectory ? (
                        <>
                          <ProviderTrustBadge
                            trust={directoryReadiness.resolvedTrustBadge}
                            size="md"
                          />
                          {directoryReadiness.isFeaturedPartner && <FeaturedPartnerBadge compact />}
                          <TrustChecksStrip
                            trust={directoryReadiness.resolvedTrustBadge}
                            hasExpiredDocs={
                              directoryReadiness.criminalExpired || directoryReadiness.artExpired
                            }
                            compact
                          />
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold opacity-85">
                          <EyeOff size={12} className="text-amber-300 shrink-0" />
                          <span>Aún no aparecés en el directorio público</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {levelSteps.map((st) => {
                      const levelTheme = TRUST_LEVEL_THEME[st.num] || TRUST_LEVEL_THEME[0];
                      const shortTitle = st.title.replace(/^N\d\s*·\s*/, '');
                      const isActiveOrReached = st.done || st.isCurrent || st.statusTone === 'info';

                      const cardToneClass =
                        st.statusTone === 'danger'
                          ? 'border-rose-700/65 bg-rose-950/35'
                          : isActiveOrReached
                            ? levelTheme.card
                            : `${levelTheme.card} opacity-75`;

                      const pillToneClass =
                        st.statusTone === 'done'
                          ? 'bg-emerald-950/85 text-emerald-300 border-emerald-600/60'
                          : st.statusTone === 'danger'
                            ? 'bg-rose-950/85 text-rose-300 border-rose-700/70'
                            : st.statusTone === 'info'
                              ? 'bg-black/45 text-white/95 border-white/25'
                              : st.statusTone === 'pending'
                                ? 'bg-black/40 text-amber-200 border-amber-600/50'
                                : 'bg-black/40 text-slate-300 border-white/15';

                      return (
                        <div
                          key={st.num}
                          className={`p-2.5 rounded-xl border flex flex-col justify-between gap-2 transition-colors ${cardToneClass} ${
                            st.isCurrent ? 'ring-1 ring-white/45 shadow-sm' : ''
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="inline-flex items-center gap-1.5 font-bold text-[11px] min-w-0">
                                <span
                                  className={`font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded border shrink-0 ${levelTheme.pill}`}
                                >
                                  N{st.num}
                                </span>
                                <span className="truncate">{shortTitle}</span>
                                {st.num === 4 && <VerifiedSeal size={13} />}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${pillToneClass}`}
                              >
                                {st.statusLabel}
                              </span>
                            </div>
                            <p className="text-[10px] font-semibold opacity-90">{st.benefit}</p>
                            <p className="text-[11px] opacity-75 leading-snug">{st.detail}</p>
                          </div>
                          {st.cta && (
                            <button
                              type="button"
                              onClick={st.cta.onClick}
                              className="self-start px-2.5 py-1 rounded-lg text-[11px] font-bold border border-white/20 bg-black/35 hover:bg-black/55 cursor-pointer shrink-0"
                            >
                              {st.cta.label}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          );
        })()}

      {/* Bloque A: Mi Reputación en el Directorio (centralizado exclusivamente en Paso 6 Reputación) */}
      {!loading &&
        profileData.reputation &&
        activeStep === 'reviews' && (
          <section
            className="rounded-2xl p-4 sm:p-5 border border-slate-800/80 space-y-3.5 text-xs"
            style={cardStyle}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              {/* Izquierda: nivel actual, termómetro de 5 segmentos y micro-tags destacados */}
              <div className="lg:col-span-5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <Star size={15} className="text-amber-400 fill-amber-400 shrink-0" />
                    <span>Mi Reputación en el Directorio</span>
                  </div>
                  {profileData.reputation.response_label && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300 shrink-0">
                      <Clock size={12} className="shrink-0" />
                      {profileData.reputation.response_label}
                    </span>
                  )}
                </div>
                <ReputationThermometer reputation={profileData.reputation} />
                {Array.isArray(profileData.reputation.top_tags) &&
                  profileData.reputation.top_tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {profileData.reputation.top_tags.map((item) => (
                        <span
                          key={item.tag}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
                        >
                          {item.tag} ({item.count})
                        </span>
                      ))}
                    </div>
                  )}
              </div>

              {/* Derecha: 3 KPIs tipográficos de solo lectura (diferenciados visualmente de botones) + próximo hito */}
              <div className="lg:col-span-7 space-y-2.5">
                <div className="grid grid-cols-3 gap-2">
                  <div
                    className="rounded-xl px-3 py-2 border border-white/10"
                    style={innerStyle}
                  >
                    <p className="text-[10px] uppercase tracking-wider opacity-65 font-semibold">
                      Conformados
                    </p>
                    <p className="text-base font-extrabold mt-0.5">
                      {profileData.reputation.completed_jobs ?? 0}
                    </p>
                  </div>

                  <div
                    className="rounded-xl px-3 py-2 border border-white/10"
                    style={innerStyle}
                  >
                    <p className="text-[10px] uppercase tracking-wider opacity-65 font-semibold">
                      Reseñas
                    </p>
                    <p className="text-base font-extrabold mt-0.5 flex items-baseline gap-1.5">
                      <span>{profileData.reputation.reviews_count ?? 0}</span>
                      <span className="text-[11px] font-semibold text-amber-300">
                        ★ {Number(profileData.reputation.rating_avg || 0).toFixed(1)}
                      </span>
                    </p>
                  </div>

                  <div
                    className="rounded-xl px-3 py-2 border border-white/10"
                    style={innerStyle}
                  >
                    <p className="text-[10px] uppercase tracking-wider opacity-65 font-semibold">
                      Reclamos
                    </p>
                    <p
                      className={`text-base font-extrabold mt-0.5 ${
                        Number(profileData.reputation.disputes_count || 0) > 0
                          ? 'text-rose-300'
                          : 'text-emerald-300'
                      }`}
                    >
                      {profileData.reputation.disputes_count ?? 0}
                    </p>
                  </div>
                </div>

                {profileData.reputation.next_milestone && (
                  <p className="text-[11px] opacity-85 leading-relaxed">
                    <span className="font-bold opacity-100">Próximo objetivo:</span>{' '}
                    {profileData.reputation.next_milestone}
                  </p>
                )}
              </div>
            </div>
          </section>
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
        /* PASO 1: CREDENCIALES Y COMPLIANCE (Documentación + Especialidades arriba; Ficha Comercial + Socio abajo) */
        <div className="space-y-4">
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
                  DNI, póliza ART/seguro, antecedentes penales y fechas de vigencia.
                </p>
              </div>
              {showDocForm && (
                <button
                  type="button"
                  onClick={() => setShowDocForm(false)}
                  className={rowActionBtnClass}
                  style={innerStyle}
                >
                  <X size={13} /> Cerrar
                </button>
              )}
            </div>

            {/* Formulario desplegable estructurado de carga (DNI N1 / Seguro AP o ART N2 / Antecedentes N3) */}
            {showDocForm && (
              <form
                onSubmit={handleCreateDocument}
                className="p-4 rounded-xl border border-slate-800/70 space-y-3 text-xs"
                style={innerStyle}
              >
                <p className="font-bold">Cargar Documento Personal</p>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs font-semibold"
                  style={cardStyle}
                >
                  <option value="Documento de Identidad (DNI)">
                    Nivel 1 · Documento de Identidad (DNI)
                  </option>
                  <option value="Póliza ART / Seguro">
                    Nivel 2 · Seguro de Accidentes Personales (AP) o Póliza ART
                  </option>
                  <option value="Antecedentes Penales">
                    Nivel 3 · Certificado de Antecedentes Penales
                  </option>
                </select>

                {/* --- MODO DNI (N1) --- */}
                {docType === 'Documento de Identidad (DNI)' && (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] opacity-80 mb-1">Nro. de DNI *</label>
                        <input
                          type="text"
                          required={!profileData.dni}
                          value={docDniNumber}
                          onChange={(e) => setDocDniNumber(e.target.value)}
                          placeholder="Ej: 35123456"
                          className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs font-mono"
                          style={cardStyle}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] opacity-80 mb-1">
                          PDF (frente y dorso) o Foto Frente *
                        </label>
                        <input
                          type="text"
                          required
                          value={docUrl}
                          onChange={(e) => setDocUrl(e.target.value)}
                          placeholder="https://.../dni-frente-o-pdf"
                          className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                          style={cardStyle}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] opacity-80 mb-1">
                        Foto Dorso (opcional si subiste 1 PDF completo)
                      </label>
                      <input
                        type="text"
                        value={docDniBackUrl}
                        onChange={(e) => setDocDniBackUrl(e.target.value)}
                        placeholder="https://.../dni-dorso.jpg"
                        className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                        style={cardStyle}
                      />
                    </div>
                  </div>
                )}

                {/* --- MODO SEGURO AP / ART (N2) --- */}
                {docType === 'Póliza ART / Seguro' && (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDocInsuranceType('ap')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          docInsuranceType === 'ap'
                            ? 'border-emerald-400/70 bg-emerald-500/15'
                            : 'border-white/10 opacity-75 hover:opacity-100'
                        }`}
                        style={docInsuranceType === 'ap' ? undefined : cardStyle}
                      >
                        <p className="font-bold text-xs">Trabajo solo (Independiente)</p>
                        <p className="text-[11px] opacity-80">Seguro de Accidentes Personales (AP)</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDocInsuranceType('art')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          docInsuranceType === 'art'
                            ? 'border-emerald-400/70 bg-emerald-500/15'
                            : 'border-white/10 opacity-75 hover:opacity-100'
                        }`}
                        style={docInsuranceType === 'art' ? undefined : cardStyle}
                      >
                        <p className="font-bold text-xs">Tengo ayudantes / cuadrilla</p>
                        <p className="text-[11px] opacity-80">Póliza de ART con nómina</p>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] opacity-80 mb-1">
                          {docInsuranceType === 'art'
                            ? 'Aseguradora / ART emisora *'
                            : 'Compañía aseguradora *'}
                        </label>
                        <input
                          type="text"
                          required
                          value={docInsurerName}
                          onChange={(e) => setDocInsurerName(e.target.value)}
                          placeholder={
                            docInsuranceType === 'art'
                              ? 'Ej: Prevención ART / Galeno ART'
                              : 'Ej: Sancor Seguros / Federación Patronal'
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                          style={cardStyle}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] opacity-80 mb-1">
                          Nro. de póliza o certificado *
                        </label>
                        <input
                          type="text"
                          required
                          value={docPolicyNumber}
                          onChange={(e) => setDocPolicyNumber(e.target.value)}
                          placeholder="Ej: AP-450192 / ART-88912"
                          className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs font-mono"
                          style={cardStyle}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] opacity-80 mb-1">
                          {docInsuranceType === 'art'
                            ? 'Tomador / Afiliado (CUIT) *'
                            : 'Asegurado (CUIT) *'}
                        </label>
                        <input
                          type="text"
                          required
                          value={docHolderCuit}
                          onChange={(e) => setDocHolderCuit(e.target.value)}
                          placeholder="Ej: 20-35123456-7"
                          className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs font-mono"
                          style={cardStyle}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] opacity-80 mb-1">
                          Comprobante PDF vigente (URL) *
                        </label>
                        <input
                          type="text"
                          required
                          value={docUrl}
                          onChange={(e) => setDocUrl(e.target.value)}
                          placeholder="https://.../certificado-cobertura.pdf"
                          className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                          style={cardStyle}
                        />
                      </div>
                    </div>

                    {docInsuranceType === 'ap' && (
                      <div>
                        <label className="block text-[11px] opacity-80 mb-1">
                          Sumas aseguradas o alcances básicos
                        </label>
                        <input
                          type="text"
                          value={docCoverageSummary}
                          onChange={(e) => setDocCoverageSummary(e.target.value)}
                          placeholder="Ej: Muerte e Invalidez $15M · Asistencia Médica $2M · Cláusula de no repetición"
                          className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                          style={cardStyle}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] opacity-80 mb-1">Vigencia desde *</label>
                        <input
                          type="date"
                          required
                          value={docValidFrom}
                          onChange={(e) => setDocValidFrom(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                          style={cardStyle}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] opacity-80 mb-1">Vigencia hasta *</label>
                        <input
                          type="date"
                          required
                          value={docValidTo}
                          onChange={(e) => setDocValidTo(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                          style={cardStyle}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* --- MODO ANTECEDENTES PENALES (N3) --- */}
                {docType === 'Antecedentes Penales' && (
                  <div className="space-y-2.5">
                    <div className="rounded-xl px-3 py-2 border border-sky-500/30 bg-sky-950/35 text-[11px] flex flex-wrap items-center justify-between gap-2">
                      <span className="opacity-90">
                        ¿Todavía no tenés tu certificado de Antecedentes Penales?
                      </span>
                      <a
                        href={CRIMINAL_RECORD_OFFICIAL_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-sky-300 hover:text-sky-200 underline underline-offset-2 shrink-0"
                      >
                        <span>Solicitar en Argentina.gob.ar</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] opacity-80 mb-1">
                          Fecha de emisión *
                        </label>
                        <input
                          type="date"
                          required
                          value={docCriminalIssuedAt}
                          onChange={(e) => setDocCriminalIssuedAt(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                          style={cardStyle}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] opacity-80 mb-1">
                          Código de Solicitud / Trámite *
                        </label>
                        <input
                          type="text"
                          required
                          value={docCriminalRequestCode}
                          onChange={(e) => setDocCriminalRequestCode(e.target.value)}
                          placeholder="Ej: TR-901234"
                          className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs font-mono"
                          style={cardStyle}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] opacity-80 mb-1">
                          Código de Seguridad *
                        </label>
                        <input
                          type="text"
                          required
                          value={docCriminalSecurityCode}
                          onChange={(e) => setDocCriminalSecurityCode(e.target.value)}
                          placeholder="Ej: SEC-7788"
                          className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs font-mono"
                          style={cardStyle}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] opacity-80 mb-1">
                        Comprobante PDF vigente (URL) *
                      </label>
                      <input
                        type="text"
                        required
                        value={docUrl}
                        onChange={(e) => setDocUrl(e.target.value)}
                        placeholder="https://.../certificado-antecedentes.pdf"
                        className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                        style={cardStyle}
                      />
                    </div>

                    <p className="text-[11px] opacity-75">
                      El motor de TrustLink calcula automáticamente el vencimiento a partir de la{' '}
                      <strong>Fecha de emisión</strong> según la ventana configurada por cada barrio
                      (30, 90, 180 o 365 días).
                    </p>
                  </div>
                )}

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

            {/* Encabezado y tarjetas de Documentación Personal Vigente (DNI + Seguro AP/ART + Antecedentes) */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className={listHeaderTitleClass}>
                <ShieldCheck size={13} className="opacity-80" /> DOCUMENTACIÓN VIGENTE
              </span>
              <span className={listCounterBadgeClass} style={innerStyle}>
                {personalDocumentsSummary.loadedCount +
                  (directoryReadiness.identityVerified || profileData.dni_document_url ? 1 : 0)}
                /3 completo(s)
              </span>
            </div>

            <div className="space-y-3">
              {/* Tarjeta 0: Documento de Identidad (DNI) para Nivel 1 */}
              <div
                className="p-4 rounded-xl border border-slate-800/70 space-y-2 text-xs"
                style={innerStyle}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        title="Requisito de Nivel 1 · Perfil Básico"
                        className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-md border shrink-0 ${TRUST_LEVEL_THEME[1].pill}`}
                      >
                        N1
                      </span>
                      <span className="font-bold text-sm">
                        Documento de Identidad (DNI{profileData.dni ? ` ${profileData.dni}` : ''})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {directoryReadiness.identityVerified ? (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-emerald-950/80 text-emerald-300 border-emerald-700/60">
                          DNI Validado ✓
                        </span>
                      ) : profileData.dni_document_url ? (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-sky-950/80 text-sky-200 border-sky-600/60">
                          En revisión
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-amber-600/50 bg-amber-950/60 text-amber-200">
                          Pendiente de carga
                        </span>
                      )}
                    </div>
                    {profileData.dni_document_url ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <a
                          href={profileData.dni_document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-sky-300 underline underline-offset-2 truncate max-w-64"
                        >
                          {profileData.dni_back_url ? 'Ver DNI Frente' : 'Ver DNI cargado'}
                        </a>
                        {profileData.dni_back_url && (
                          <a
                            href={profileData.dni_back_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-sky-300 underline underline-offset-2"
                          >
                            Ver DNI Dorso
                          </a>
                        )}
                      </div>
                    ) : (
                      <p className="opacity-75">
                        {directoryReadiness.identityVerified
                          ? 'Tu identidad ya fue validada por Administración. Podés adjuntar tu DNI si deseás mantener el respaldo.'
                          : 'Cargá tu Nro. de DNI y foto/PDF frente y dorso para que Administración valide tu identidad (Nivel 1).'}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDocType('Documento de Identidad (DNI)');
                      setDocDniNumber(profileData.dni || '');
                      setDocUrl(profileData.dni_document_url || '');
                      setDocDniBackUrl(profileData.dni_back_url || '');
                      setShowDocForm(true);
                    }}
                    className={
                      profileData.dni_document_url || directoryReadiness.identityVerified
                        ? rowActionBtnClass
                        : 'text-white font-bold px-3 py-1.5 rounded-xl text-xs inline-flex items-center gap-1 cursor-pointer shrink-0'
                    }
                    style={
                      profileData.dni_document_url || directoryReadiness.identityVerified
                        ? cardStyle
                        : { backgroundColor: primaryColor }
                    }
                  >
                    {profileData.dni_document_url ? (
                      <>
                        <Edit3 size={12} /> Actualizar
                      </>
                    ) : directoryReadiness.identityVerified ? (
                      <>
                        <Plus size={12} /> Adjuntar respaldo
                      </>
                    ) : (
                      <>
                        <Plus size={12} /> Cargar
                      </>
                    )}
                  </button>
                </div>
              </div>
              {personalDocumentsSummary.currentDocs.map((docItem) => {
                const isEditingDoc = editingDocKey === docItem.key;
                const validity = docItem.isMissing
                  ? { label: 'Sin cargar', tone: 'neutral' }
                  : getValidityStatus(docItem.validTo);
                const auditMeta = getAuditStatusMeta(docItem.auditStatus);
                const docMeta =
                  docItem.metadata && typeof docItem.metadata === 'object' ? docItem.metadata : null;
                const displayDocTitle =
                  docItem.slot === 'insurance'
                    ? docMeta?.policy_type === 'art'
                      ? 'Póliza de ART'
                      : docMeta?.policy_type === 'ap'
                        ? 'Seguro de Accidentes Personales (AP)'
                        : 'Seguro AP / Póliza ART'
                    : docItem.docType;

                return (
                  <div
                    key={docItem.key}
                    className="p-4 rounded-xl border border-slate-800/70 space-y-2.5 text-xs"
                    style={innerStyle}
                  >
                    {isEditingDoc ? (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-bold">{displayDocTitle}</span>
                          <div className="flex items-center gap-3 flex-wrap">
                            {docItem.slot === 'criminal' && (
                              <a
                                href={CRIMINAL_RECORD_OFFICIAL_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-300 hover:text-sky-200 underline underline-offset-2"
                              >
                                <span>Tramitar en Argentina.gob.ar</span>
                                <ExternalLink size={11} />
                              </a>
                            )}
                            <span className="text-[11px] opacity-75">
                              La versión anterior se conserva en el historial
                            </span>
                          </div>
                        </div>

                        {docItem.slot === 'insurance' ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setEditInsuranceType('ap')}
                                className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold cursor-pointer ${
                                  editInsuranceType === 'ap'
                                    ? 'border-emerald-400/70 bg-emerald-500/15'
                                    : 'border-white/15 opacity-75'
                                }`}
                                style={editInsuranceType === 'ap' ? undefined : cardStyle}
                              >
                                Solo · Seguro AP
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditInsuranceType('art')}
                                className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold cursor-pointer ${
                                  editInsuranceType === 'art'
                                    ? 'border-emerald-400/70 bg-emerald-500/15'
                                    : 'border-white/15 opacity-75'
                                }`}
                                style={editInsuranceType === 'art' ? undefined : cardStyle}
                              >
                                Ayudantes · ART
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <input
                                type="text"
                                value={editInsurerName}
                                onChange={(e) => setEditInsurerName(e.target.value)}
                                placeholder="Aseguradora / ART"
                                className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                                style={cardStyle}
                              />
                              <input
                                type="text"
                                value={editPolicyNumber}
                                onChange={(e) => setEditPolicyNumber(e.target.value)}
                                placeholder="Nro. póliza"
                                className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs font-mono"
                                style={cardStyle}
                              />
                              <input
                                type="text"
                                value={editHolderCuit}
                                onChange={(e) => setEditHolderCuit(e.target.value)}
                                placeholder="CUIT"
                                className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs font-mono"
                                style={cardStyle}
                              />
                            </div>
                            {editInsuranceType === 'ap' && (
                              <input
                                type="text"
                                value={editCoverageSummary}
                                onChange={(e) => setEditCoverageSummary(e.target.value)}
                                placeholder="Sumas aseguradas / alcances básicos"
                                className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                                style={cardStyle}
                              />
                            )}
                            <input
                              type="text"
                              value={editDocUrl}
                              onChange={(e) => setEditDocUrl(e.target.value)}
                              placeholder="URL del comprobante PDF vigente"
                              className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                              style={cardStyle}
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[11px] opacity-80 mb-1">
                                  Vigencia desde
                                </label>
                                <input
                                  type="date"
                                  value={editDocValidFrom}
                                  onChange={(e) => setEditDocValidFrom(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                                  style={cardStyle}
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] opacity-80 mb-1">
                                  Vigencia hasta
                                </label>
                                <input
                                  type="date"
                                  value={editDocValidTo}
                                  onChange={(e) => setEditDocValidTo(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                                  style={cardStyle}
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[11px] opacity-80 mb-1">
                                  Fecha de emisión
                                </label>
                                <input
                                  type="date"
                                  value={editCriminalIssuedAt}
                                  onChange={(e) => setEditCriminalIssuedAt(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                                  style={cardStyle}
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] opacity-80 mb-1">
                                  Cód. Solicitud / Trámite
                                </label>
                                <input
                                  type="text"
                                  value={editCriminalRequestCode}
                                  onChange={(e) => setEditCriminalRequestCode(e.target.value)}
                                  placeholder="TR-..."
                                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs font-mono"
                                  style={cardStyle}
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] opacity-80 mb-1">
                                  Código de Seguridad
                                </label>
                                <input
                                  type="text"
                                  value={editCriminalSecurityCode}
                                  onChange={(e) => setEditCriminalSecurityCode(e.target.value)}
                                  placeholder="SEC-..."
                                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs font-mono"
                                  style={cardStyle}
                                />
                              </div>
                            </div>
                            <input
                              type="text"
                              value={editDocUrl}
                              onChange={(e) => setEditDocUrl(e.target.value)}
                              placeholder="URL del comprobante PDF vigente"
                              className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                              style={cardStyle}
                            />
                          </div>
                        )}

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
                            className="text-white font-bold px-3 py-1.5 rounded-xl text-xs inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            style={{ backgroundColor: primaryColor }}
                          >
                            <Save size={12} /> {updatingDoc ? 'Guardando...' : 'Guardar renovación'}
                          </button>
                        </div>
                      </div>
                    ) : docItem.isMissing ? (
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              title={
                                docItem.slot === 'insurance'
                                  ? 'Requisito de Nivel 2 · Seguro en revisión'
                                  : 'Requisito de Nivel 3 · Pase QR habilitado'
                              }
                              className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-md border shrink-0 ${
                                docItem.slot === 'insurance'
                                  ? TRUST_LEVEL_THEME[2].pill
                                  : TRUST_LEVEL_THEME[3].pill
                              }`}
                            >
                              {docItem.slot === 'insurance' ? 'N2' : 'N3'}
                            </span>
                            <span className="font-bold text-sm">{displayDocTitle}</span>
                          </div>
                          <div>
                            <span
                              className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-amber-600/50 bg-amber-950/60 text-amber-200"
                            >
                              Pendiente de carga
                            </span>
                          </div>
                          <p className="opacity-75">
                            {docItem.slot === 'insurance'
                              ? 'Elegí Seguro de Accidentes Personales (si trabajás solo) o Póliza ART (si tenés ayudantes) para pasar a Nivel 2.'
                              : 'Cargá tu Certificado de Antecedentes Penales con fecha de emisión y códigos para habilitar Pases QR (Nivel 3).'}
                          </p>
                          {docItem.slot === 'criminal' && (
                            <a
                              href={CRIMINAL_RECORD_OFFICIAL_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-300 hover:text-sky-200 underline underline-offset-2 pt-0.5"
                            >
                              <span>Cómo solicitarlo en Argentina.gob.ar</span>
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setDocType(docItem.docType);
                            setShowDocForm(true);
                          }}
                          className="text-white font-bold px-3 py-1.5 rounded-xl text-xs inline-flex items-center gap-1 cursor-pointer shrink-0"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <Plus size={12} /> Cargar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              title={
                                docItem.slot === 'insurance'
                                  ? 'Requisito de Nivel 2 · Seguro en revisión'
                                  : 'Requisito de Nivel 3 · Pase QR habilitado'
                              }
                              className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-md border shrink-0 ${
                                docItem.slot === 'insurance'
                                  ? TRUST_LEVEL_THEME[2].pill
                                  : TRUST_LEVEL_THEME[3].pill
                              }`}
                            >
                              {docItem.slot === 'insurance' ? 'N2' : 'N3'}
                            </span>
                            <span className="font-bold text-sm">{displayDocTitle}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {docItem.validTo || docItem.standard180Expiry ? (
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
                            ) : (
                              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-amber-600/50 bg-amber-950/60 text-amber-200">
                                Falta vencimiento
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                auditMeta.tone === 'success'
                                  ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60'
                                  : auditMeta.tone === 'danger'
                                  ? 'bg-rose-950/70 text-rose-300 border-rose-700/60'
                                  : 'bg-amber-950/60 text-amber-200 border-amber-600/50'
                              }`}
                            >
                              {auditMeta.tone === 'success'
                                ? 'Aprobado por TrustLink ✓'
                                : auditMeta.tone === 'danger'
                                  ? 'Rechazado por TrustLink'
                                  : 'En revisión de TrustLink'}
                            </span>
                          </div>
                          {docItem.slot === 'insurance' && docMeta && (
                            <p className="text-[11px] opacity-85">
                              {[
                                docMeta.insurer_name,
                                docMeta.policy_number ? `Póliza ${docMeta.policy_number}` : '',
                                docMeta.holder_cuit ? `CUIT ${docMeta.holder_cuit}` : '',
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          )}
                          {docItem.slot === 'insurance' && docMeta?.coverage_summary && (
                            <p className="text-[11px] opacity-70">{docMeta.coverage_summary}</p>
                          )}
                          {docItem.slot === 'criminal' && (docItem.issuedAt || docMeta) && (
                            <p className="text-[11px] opacity-85">
                              {[
                                docItem.issuedAt
                                  ? `Emisión: ${formatDateShort(docItem.issuedAt)}`
                                  : '',
                                docMeta?.request_code ? `Trámite ${docMeta.request_code}` : '',
                                docMeta?.security_code ? `Cód. Seg. ${docMeta.security_code}` : '',
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          )}
                          <p className="opacity-75">
                            {docItem.slot === 'criminal'
                              ? docItem.standard180Expiry
                                ? `Vigencia estándar (180d): hasta ${formatDateShort(docItem.standard180Expiry)} · ajustable por barrio`
                                : docItem.validTo
                                  ? `Vencimiento registrado: ${formatDateShort(docItem.validTo)}`
                                  : 'Cargá la fecha de emisión para calcular vigencia por barrio.'
                              : docItem.validTo
                                ? `Vigencia: ${formatDateShort(docItem.validFrom)} → ${formatDateShort(docItem.validTo)}`
                                : `Desde ${formatDateShort(docItem.validFrom)} · Cargá la fecha de vencimiento con "Renovar / Editar"`}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 pt-0.5">
                            {docItem.url && (
                              <a
                                href={docItem.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={docItem.url}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
                              >
                                <span>Ver comprobante PDF</span>
                                <ExternalLink size={11} />
                              </a>
                            )}
                            {docItem.slot === 'criminal' && (
                              <a
                                href={CRIMINAL_RECORD_OFFICIAL_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-300 hover:text-sky-200 underline underline-offset-2"
                              >
                                <span>Tramitar / renovar en Argentina.gob.ar</span>
                                <ExternalLink size={11} />
                              </a>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => startEditingDocument(docItem)}
                          className={rowActionBtnClass}
                          style={cardStyle}
                        >
                          <Edit3 size={12} /> Renovar / Editar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Acordeón colapsable (solo lectura) con el historial inmutable de versiones anteriores */}
            {personalDocumentsSummary.historicalDocs.length > 0 && (
              <div className="pt-2 border-t border-white/10 space-y-2.5">
                <button
                  type="button"
                  onClick={() => setShowDocHistory((prev) => !prev)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-800/80 text-xs font-bold hover:opacity-95 cursor-pointer"
                  style={innerStyle}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <History size={13} className="opacity-80" />
                    <span>
                      Ver historial de versiones anteriores (
                      {personalDocumentsSummary.historicalDocs.length})
                    </span>
                  </span>
                  {showDocHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showDocHistory && (
                  <div className="space-y-2">
                    <p className="text-[11px] opacity-75 px-1">
                      Respaldo inmutable solo lectura: TrustLink conserva las versiones anteriores o
                      vencidas para auditoría legal de ingresos pasados en barrios cerrados.
                    </p>
                    {personalDocumentsSummary.historicalDocs.map((hist) => {
                      const histValidity = getValidityStatus(hist.validTo);
                      const isExpiredHist = histValidity.tone === 'danger';
                      return (
                        <div
                          key={hist.key}
                          className="p-3 rounded-xl border border-slate-800/70 text-xs space-y-1 opacity-85"
                          style={innerStyle}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">{hist.docType}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  isExpiredHist
                                    ? 'bg-rose-950/70 text-rose-300 border-rose-700/60'
                                    : 'border-slate-700 opacity-85'
                                }`}
                                style={isExpiredHist ? undefined : cardStyle}
                              >
                                {isExpiredHist ? 'Vencido' : 'Versión anterior'}
                              </span>
                            </div>
                            {hist.createdAt && (
                              <span className="text-[10px] opacity-70">
                                Cargado: {formatDateShort(hist.createdAt)}
                              </span>
                            )}
                          </div>
                          {hist.url && <p className="opacity-75 truncate">{hist.url}</p>}
                          <p className="text-[11px] opacity-70">
                            Vigencia: {formatDateShort(hist.validFrom)} →{' '}
                            {formatDateShort(hist.validTo)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Sección 1B: Gestión de especialidades y control de visibilidad en directorio */}
          <section
            className="rounded-2xl p-5 border border-slate-800/80 space-y-4"
            style={cardStyle}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 flex-wrap">
                  <Award size={18} className="text-emerald-400 shrink-0" />
                  <span>Especialidades y Credenciales</span>
                  <span
                    title="Tener al menos 1 rubro visible es requisito de Nivel 1 (Perfil Básico)"
                    className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-md border ${TRUST_LEVEL_THEME[1].pill}`}
                  >
                    Requisito N1
                  </span>
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

            {/* Formulario desplegable: Catálogo estándar (auto-aprobado) u Otra especialidad (moderada por Ops) */}
            {showSpecialtyForm && (
              <form
                onSubmit={handleCreateSpecialty}
                className="p-4 rounded-xl border border-slate-800/70 space-y-3 text-xs"
                style={innerStyle}
              >
                <div className="space-y-1">
                  <p className="font-bold">Nueva Especialidad</p>
                  <p className="text-[11px] opacity-75">
                    Elegí un rubro del catálogo oficial (se activa al instante si tu documentación ya está aprobada) o proponé una especialidad personalizada.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <SearchableSelect
                    value={selectedCatalogSpecialty}
                    onChange={(val) => setSelectedCatalogSpecialty(val)}
                    options={STANDARD_SPECIALTIES_CATALOG.map((spec) => ({
                      value: spec,
                      label: spec,
                    }))}
                    placeholder="Buscar o elegir especialidad..."
                    searchPlaceholder="Escribí para buscar tu rubro (ej. Gasista, Piletero)..."
                    emptyMessage="No encontramos ese rubro en el catálogo."
                    extraAction={{
                      value: '__custom__',
                      label: 'Otra especialidad (no figura en la lista)',
                      description: 'Requiere aprobación de Operaciones TrustLink',
                    }}
                    triggerStyle={cardStyle}
                    panelStyle={innerStyle}
                    ariaLabel="Seleccionar especialidad"
                  />

                  {selectedCatalogSpecialty === '__custom__' ? (
                    <div className="space-y-2 rounded-xl p-3 border border-amber-500/35 bg-amber-950/20">
                      <input
                        type="text"
                        required
                        maxLength={100}
                        value={newSpecialty}
                        onChange={(e) => setNewSpecialty(e.target.value)}
                        placeholder="Nombre de la especialidad (ej: Técnico en Domótica, Paneles Solares...)"
                        className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs focus:outline-none"
                        style={cardStyle}
                      />
                      <textarea
                        rows={2}
                        required
                        maxLength={300}
                        value={customSpecialtyDesc}
                        onChange={(e) => setCustomSpecialtyDesc(e.target.value)}
                        placeholder="Breve descripción del servicio que prestás para que Operaciones TrustLink pueda aprobar el rubro..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs focus:outline-none"
                        style={cardStyle}
                      />
                      <p className="text-[11px] text-amber-200 opacity-90">
                        Este rubro personalizado quedará en revisión por Operaciones antes de mostrarse en el directorio.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-emerald-300 opacity-90">
                      Rubro de catálogo estándar: si tu compliance personal (ART + Antecedentes) ya está aprobado, queda activo inmediatamente.
                    </p>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingSpecialty}
                      className="text-white font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center justify-center gap-1.5 transition-opacity hover:opacity-95 cursor-pointer disabled:opacity-50 shrink-0"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Plus size={14} />{' '}
                      {savingSpecialty
                        ? 'Agregando...'
                        : selectedCatalogSpecialty === '__custom__'
                        ? 'Enviar a revisión'
                        : 'Agregar especialidad'}
                    </button>
                  </div>
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

            {profileData.providers.length > 0 &&
              directoryReadiness.isVisibleInDirectory &&
              !directoryReadiness.canIssuePass && (
                <p className="text-[11px] opacity-80 rounded-xl px-3 py-2 border border-sky-500/30 bg-sky-950/25 text-sky-200">
                  Tus rubros visibles figuran hoy para consultas (N1–N2). Al aprobarse tu
                  documentación pasarán automáticamente a <strong>Pase QR activo</strong>.
                </p>
              )}

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
                          <SearchableSelect
                            value={editSpecialtyCatalog}
                            onChange={(val) => setEditSpecialtyCatalog(val)}
                            options={STANDARD_SPECIALTIES_CATALOG.map((spec) => ({
                              value: spec,
                              label: spec,
                            }))}
                            placeholder="Buscar o elegir especialidad..."
                            searchPlaceholder="Escribí para buscar tu rubro..."
                            emptyMessage="No encontramos ese rubro en el catálogo."
                            extraAction={{
                              value: '__custom__',
                              label: 'Otra especialidad (no figura en la lista)',
                              description: 'Requiere aprobación de Operaciones TrustLink',
                            }}
                            triggerStyle={cardStyle}
                            panelStyle={innerStyle}
                            ariaLabel="Editar especialidad"
                          />

                          {editSpecialtyCatalog === '__custom__' ? (
                            <div className="space-y-2 rounded-xl p-3 border border-amber-500/35 bg-amber-950/20">
                              <input
                                type="text"
                                required
                                maxLength={100}
                                value={editSpecialtyName}
                                onChange={(e) => setEditSpecialtyName(e.target.value)}
                                placeholder="Nombre de la especialidad personalizada..."
                                className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs focus:outline-none"
                                style={cardStyle}
                              />
                              <textarea
                                rows={2}
                                required
                                maxLength={300}
                                value={editSpecialtyDesc}
                                onChange={(e) => setEditSpecialtyDesc(e.target.value)}
                                placeholder="Breve descripción del servicio para moderación de Operaciones TrustLink..."
                                className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs focus:outline-none"
                                style={cardStyle}
                              />
                              <p className="text-[11px] text-amber-200 opacity-90">
                                Las especialidades personalizadas quedan en revisión de Operaciones antes de publicarse.
                              </p>
                            </div>
                          ) : (
                            <p className="text-[11px] text-emerald-300 opacity-90">
                              Rubro de catálogo estándar: mantiene la aprobación al instante si tu compliance personal ya está validado.
                            </p>
                          )}

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
                              className="text-white font-bold px-3 py-1.5 rounded-xl text-xs inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              style={{ backgroundColor: primaryColor }}
                            >
                              <Save size={12} /> {updatingSpecialty ? 'Guardando...' : 'Guardar'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm">{p.specialty}</span>
                              {p.is_custom_specialty && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/45 bg-amber-500/15 text-amber-200">
                                  Personalizada
                                </span>
                              )}
                              {p.status === 'rejected' ? (
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-rose-950/80 text-rose-300 border-rose-700/60">
                                  Rechazada
                                </span>
                              ) : p.is_custom_specialty && p.specialty_approval_status === 'pending' ? (
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-amber-500/45 bg-amber-950/60 text-amber-200">
                                  Rubro en revisión
                                </span>
                              ) : isHidden ? (
                                <span
                                  className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-slate-700 opacity-85"
                                  style={cardStyle}
                                >
                                  Oculta en directorio
                                </span>
                              ) : directoryReadiness.canIssuePass && p.status === 'approved' ? (
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-emerald-950/80 text-emerald-300 border-emerald-700/60">
                                  Pase QR activo
                                </span>
                              ) : directoryReadiness.isVisibleInDirectory ? (
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-sky-950/70 text-sky-200 border-sky-600/55">
                                  Solo consultas
                                </span>
                              ) : (
                                <span
                                  className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-slate-700"
                                  style={cardStyle}
                                >
                                  Pendiente de validación
                                </span>
                              )}
                            </div>
                            {p.is_custom_specialty && p.custom_specialty_description && (
                              <p className="text-[11px] opacity-85 italic">
                                &ldquo;{p.custom_specialty_description}&rdquo;
                              </p>
                            )}
                            {(isHidden ||
                              p.status === 'rejected' ||
                              (!directoryReadiness.isVisibleInDirectory && p.status !== 'approved') ||
                              (p.is_custom_specialty &&
                                p.specialty_approval_status === 'pending')) && (
                              <p className="opacity-75 text-[11px]">
                                {isHidden
                                  ? 'Oculta manualmente: los residentes no verán este rubro hasta que lo vuelvas a mostrar.'
                                  : p.status === 'rejected'
                                    ? 'Rubro rechazado por Administración. Podés editarlo o consultar con soporte.'
                                    : p.is_custom_specialty &&
                                        p.specialty_approval_status === 'pending'
                                      ? 'Especialidad personalizada en revisión por Operaciones TrustLink.'
                                      : 'Se publicará en el directorio al validar tu DNI y documentación.'}
                              </p>
                            )}
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
                              onClick={() => startEditingSpecialty(p)}
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

        {/* Fila secundaria de Paso 1: Ficha Comercial (+ Socio Verificado solo desde Nivel 4 o si ya está activo) */}
        <div
          className={`grid grid-cols-1 gap-4 items-start ${
            canShowMembershipCard ? 'lg:grid-cols-2' : ''
          }`}
        >
          {/* Tarjeta 1C: Ficha Comercial y Consultas Públicas (Q&A) */}
          <section
            className={`rounded-2xl p-4 sm:p-5 border border-slate-800/80 space-y-3 text-xs ${
              canShowMembershipCard && (showCommercialEditor || showQaPanel) ? 'lg:col-span-2' : ''
            }`}
            style={cardStyle}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <p className="font-bold text-sm">Ficha Comercial en el Directorio</p>
                <p className="text-[11px] opacity-80 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>
                    Urgencias 24h:{' '}
                    <strong className={commAcceptsEmergencies ? 'text-emerald-300' : 'opacity-90'}>
                      {commAcceptsEmergencies ? 'Activado' : 'No'}
                    </strong>
                  </span>
                  <span className="opacity-40">·</span>
                  <span>
                    Presupuesto:{' '}
                    <strong>
                      {commQuotePolicy === 'sin_cargo'
                        ? 'Sin cargo'
                        : commQuotePolicy === 'arancelada'
                        ? 'Visita arancelada'
                        : 'A consultar'}
                    </strong>
                  </span>
                  <span className="opacity-40">·</span>
                  <span>
                    Facturación:{' '}
                    <strong>
                      {commInvoiceType === 'factura_a'
                        ? 'Factura A'
                        : commInvoiceType === 'factura_c'
                        ? 'Factura C'
                        : commInvoiceType === 'ambas'
                        ? 'Factura A / C'
                        : commInvoiceType === 'sin_factura'
                        ? 'Recibo / Sin factura'
                        : 'A consultar'}
                    </strong>
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCommercialEditor((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/15 hover:opacity-90 cursor-pointer"
                  style={innerStyle}
                >
                  <Edit3 size={13} />
                  <span>{showCommercialEditor ? 'Ocultar' : 'Editar Ficha'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowQaPanel((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/15 hover:opacity-90 cursor-pointer"
                  style={innerStyle}
                >
                  <MessageSquare size={13} />
                  <span>
                    Preguntas ({Array.isArray(profileData.public_questions) ? profileData.public_questions.length : 0})
                  </span>
                  {Array.isArray(profileData.public_questions) &&
                    profileData.public_questions.some((q) => !q.answer) && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 border border-amber-400/45 text-amber-200">
                        {profileData.public_questions.filter((q) => !q.answer).length} nueva(s)
                      </span>
                    )}
                </button>
              </div>
            </div>

            {/* Editor desplegable de Ficha Comercial rápida y Urgencias 24h */}
            {showCommercialEditor && (
              <form
                onSubmit={handleSaveCommercialProfile}
                className="rounded-xl p-3.5 border border-white/10 space-y-3"
                style={innerStyle}
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl border border-white/15 cursor-pointer" style={cardStyle}>
                    <input
                      type="checkbox"
                      checked={commAcceptsEmergencies}
                      onChange={(e) => setCommAcceptsEmergencies(e.target.checked)}
                      className="accent-emerald-500"
                    />
                    <span className="font-bold">Atiendo Urgencias 24h</span>
                  </label>

                  <select
                    value={commQuotePolicy}
                    onChange={(e) => setCommQuotePolicy(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-white/15 text-xs"
                    style={cardStyle}
                  >
                    <option value="consultar">Presupuesto: A consultar</option>
                    <option value="sin_cargo">Presupuesto sin cargo</option>
                    <option value="arancelada">Visita técnica arancelada</option>
                  </select>

                  <select
                    value={commInvoiceType}
                    onChange={(e) => setCommInvoiceType(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-white/15 text-xs"
                    style={cardStyle}
                  >
                    <option value="consultar">Facturación: A consultar</option>
                    <option value="factura_c">Emito Factura C</option>
                    <option value="factura_a">Emito Factura A</option>
                    <option value="ambas">Emito Factura A y C</option>
                    <option value="sin_factura">Recibo común</option>
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold opacity-80">Medios de pago:</span>
                  {[
                    { id: 'efectivo', label: 'Efectivo' },
                    { id: 'transferencia', label: 'Transferencia' },
                    { id: 'mercadopago', label: 'Mercado Pago' },
                    { id: 'tarjeta', label: 'Tarjeta' },
                  ].map((pm) => {
                    const active = commPaymentMethods.includes(pm.id);
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => handleToggleCommPaymentMethod(pm.id)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-pointer ${
                          active
                            ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200'
                            : 'border-white/15 opacity-70 hover:opacity-100'
                        }`}
                        style={active ? undefined : cardStyle}
                      >
                        {active ? '✓ ' : '+ '}
                        {pm.label}
                      </button>
                    );
                  })}
                </div>

                <textarea
                  rows={2}
                  maxLength={400}
                  value={commServiceBio}
                  onChange={(e) => setCommServiceBio(e.target.value)}
                  placeholder="Breve resumen visible en el directorio (ej: 12 años de experiencia, trabajos con garantía, zonas que cubrís...)"
                  className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                  style={cardStyle}
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCommercialEditor(false)}
                    className="px-3 py-1.5 rounded-xl border border-white/15 font-bold cursor-pointer"
                    style={cardStyle}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingCommercial}
                    className="px-4 py-1.5 rounded-xl text-white font-bold cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {savingCommercial ? 'Guardando...' : 'Guardar Ficha Comercial'}
                  </button>
                </div>
              </form>
            )}

            {/* Panel desplegable de Preguntas Públicas de la Comunidad (Q&A) */}
            {showQaPanel && (
              <div
                className="rounded-xl p-3.5 border border-white/10 space-y-2.5"
                style={innerStyle}
              >
                <p className="font-bold">Preguntas públicas de residentes (Q&amp;A)</p>
                {!Array.isArray(profileData.public_questions) ||
                profileData.public_questions.length === 0 ? (
                  <p className="opacity-75">
                    Todavía no recibiste preguntas públicas en tu ficha del directorio.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {profileData.public_questions.map((q) => {
                      const asker =
                        `${q.asked_by_first_name || ''} ${q.asked_by_last_name || ''}`.trim() ||
                        'Residente';
                      return (
                        <div
                          key={q.id}
                          className="p-3 rounded-xl border border-white/10 space-y-2"
                          style={cardStyle}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-bold">{asker}:</span>{' '}
                              <span className="opacity-90">{q.question}</span>
                            </div>
                            <span className="text-[10px] opacity-65 shrink-0">
                              {formatDateShort(q.created_at)}
                            </span>
                          </div>
                          {q.answer ? (
                            <p className="text-emerald-300 bg-emerald-950/35 border border-emerald-800/40 rounded-lg px-2.5 py-1.5">
                              <strong>Tu respuesta:</strong> {q.answer}
                            </p>
                          ) : (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                type="text"
                                value={qaAnswerDrafts[q.id] || ''}
                                onChange={(e) =>
                                  setQaAnswerDrafts((prev) => ({
                                    ...prev,
                                    [q.id]: e.target.value,
                                  }))
                                }
                                placeholder="Escribí una respuesta pública clara para toda la comunidad..."
                                className="flex-1 px-3 py-1.5 rounded-xl border border-white/15 text-xs"
                                style={innerStyle}
                              />
                              <button
                                type="button"
                                disabled={answeringQuestionId === q.id}
                                onClick={() => handleAnswerPublicQuestion(q.id)}
                                className="px-3.5 py-1.5 rounded-xl text-white font-bold cursor-pointer disabled:opacity-50 shrink-0"
                                style={{ backgroundColor: primaryColor }}
                              >
                                {answeringQuestionId === q.id ? 'Publicando...' : 'Responder'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Tarjeta 1C-bis: Catálogo de Servicios con Precio Fijo (Paso 3) */}
          <section
            className="lg:col-span-2 rounded-2xl p-4 sm:p-5 border border-slate-800/80 space-y-3 text-xs"
            style={cardStyle}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <FileText size={15} className="text-emerald-400 shrink-0" />
                  <h3 className="text-sm font-bold">Servicios con Precio Fijo</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 text-emerald-300">
                    {(profileData.service_packages || []).filter((p) => p.is_active).length} activos
                  </span>
                </div>
                <p className="text-[11px] opacity-75">
                  Publicá trabajos estandarizados (ej: mantenimiento de termotanque o caldera) con precio cerrado para que los residentes reserven turno sin esperar presupuesto.
                </p>
              </div>
              <button
                type="button"
                disabled={(profileData.providers || []).length === 0}
                onClick={openCreatePackageModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white cursor-pointer hover:opacity-95 disabled:opacity-50 shrink-0 self-start sm:self-auto"
                style={{ backgroundColor: primaryColor }}
              >
                <Plus size={14} />
                <span>Agregar servicio</span>
              </button>
            </div>

            {!Array.isArray(profileData.service_packages) || profileData.service_packages.length === 0 ? (
              <div
                className="rounded-xl p-4 border border-white/10 text-[11px] opacity-80 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                style={innerStyle}
              >
                <span>
                  Todavía no publicaste servicios con precio fijo. Podés sumar los trabajos que siempre cotizás igual para convertir más rápido.
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {profileData.service_packages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className={`rounded-xl p-3.5 border flex flex-col justify-between gap-2.5 ${
                      pkg.is_active ? 'border-emerald-500/30' : 'border-white/10 opacity-65'
                    }`}
                    style={innerStyle}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <h4 className="font-extrabold text-sm leading-snug">{pkg.title}</h4>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                              {pkg.specialty}
                            </span>
                            <span className="text-[10px] font-semibold opacity-75 inline-flex items-center gap-1">
                              <Clock size={11} /> ~{pkg.estimated_duration_minutes || 60} min
                            </span>
                            {!pkg.is_active && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-600 bg-slate-800 text-slate-300">
                                Pausado
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="font-mono font-black text-sm text-emerald-300 shrink-0">
                          ${Number(pkg.fixed_price || 0).toLocaleString('es-AR')}
                        </span>
                      </div>
                      {pkg.includes_description && (
                        <p className="text-[11px] opacity-80 leading-relaxed">
                          {pkg.includes_description}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={togglingPackageId === pkg.id}
                        onClick={() => handleTogglePackageActive(pkg)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-white/15 hover:opacity-90 cursor-pointer disabled:opacity-50"
                        style={cardStyle}
                      >
                        {pkg.is_active ? <EyeOff size={12} /> : <Eye size={12} />}
                        <span>{pkg.is_active ? 'Pausar' : 'Activar'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditPackageModal(pkg)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-sky-500/35 bg-sky-950/35 text-sky-200 hover:bg-sky-950/60 cursor-pointer"
                      >
                        <Edit3 size={12} />
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        disabled={deletingPackageId === pkg.id}
                        onClick={() => handleDeleteServicePackage(pkg.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-rose-500/35 bg-rose-950/30 text-rose-200 hover:bg-rose-950/60 cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 size={12} />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Tarjeta 1D: Eje Comercial · Plan Destacado — visible solo desde Nivel 3 o si ya está activo */}
          {canShowMembershipCard && (
          <div
            className={`rounded-2xl p-4 sm:p-5 border space-y-3 text-xs ${
              profileData.membership?.is_verified_member
                ? 'border-amber-500/40'
                : 'border-slate-800/80'
            } ${showMembershipPlans ? 'lg:col-span-2' : ''}`}
            style={cardStyle}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="p-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 shrink-0">
                  <Award size={16} />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm">
                      {profileData.membership?.is_verified_member
                        ? `Plan Destacado activo: ${profileData.membership.plan_name}`
                        : 'Plan Destacado (Visibilidad Comercial)'}
                    </span>
                    {profileData.membership?.is_verified_member && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-300">
                        {profileData.membership.days_remaining} día(s) restantes
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] opacity-80">
                    {profileData.membership?.is_verified_member
                      ? `Vigente hasta ${formatDateShort(profileData.membership.ends_at)}. Prioridad en directorios y etiqueta Destacado (independiente de tu nivel N3/N4).`
                      : 'Prioridad en directorios y futuras campañas publicitarias. Disponible desde Nivel 3; no altera tu nivel de confianza N1–N4.'}
                  </p>
                </div>
              </div>

              {Number(profileData.trust_level ?? (directoryReadiness.canIssuePass ? 3 : 0)) >= 3 ||
              profileData.membership?.is_verified_member ? (
                <button
                  type="button"
                  onClick={() => setShowMembershipPlans((prev) => !prev)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer shrink-0 self-start sm:self-auto transition-opacity hover:opacity-95"
                  style={{ backgroundColor: primaryColor }}
                >
                  {showMembershipPlans
                    ? 'Ocultar planes'
                    : profileData.membership?.is_verified_member
                      ? 'Renovar / Cambiar'
                      : 'Ver planes'}
                </button>
              ) : (
                <span
                  className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold border border-white/15 bg-black/25 opacity-80 shrink-0 self-start sm:self-auto whitespace-nowrap"
                  title="Primero necesitás alcanzar el Nivel 3 (Pase QR habilitado) con documentación aprobada"
                >
                  Requiere Nivel 3
                </span>
              )}
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
        </div>
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
        /* PASO 3: AGENDA VIVA Y DISPONIBILIDAD (Jornada semanal + Grilla interactiva cada 30/60 min) */
        <ProviderCalendarManager
          key={scheduleRefreshKey}
          cardStyle={cardStyle}
          innerStyle={innerStyle}
          primaryColor={primaryColor}
          getAuthHeaders={getAuthHeaders}
          onGoToVisits={() => setActiveStep('visits')}
          onBlocksCountChange={(count) =>
            setScheduleBlocks((prev) =>
              prev.length === count ? prev : Array.from({ length: count }, (_, idx) => ({ id: idx }))
            )
          }
        />
      ) : activeStep === 'visits' ? (
        /* PASO 4: SOLICITUDES Y CONFIRMACIÓN DE VISITAS (Paridad estética y UX/UI con "Mis Servicios") */
        <section
          className="rounded-2xl p-5 border border-slate-800/80 space-y-4"
          style={cardStyle}
        >
          {/* Cabecera limpia de Solicitudes y Visitas */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold flex items-center gap-2">
                <MessageSquare size={18} className="text-emerald-400 shrink-0" />
                <span>Solicitudes y Confirmación de Visitas</span>
              </h2>
              <p className="text-xs opacity-75">
                Seguí pedidos de residentes, confirmá horarios, enviá presupuestos y chateá en un solo lugar.
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

          {/* Buscador + chips de filtro homologados con Mis Servicios */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-55 pointer-events-none"
              />
              <input
                type="text"
                value={visitSearch}
                onChange={(e) => {
                  setVisitSearch(e.target.value);
                  setVisitPage(1);
                }}
                placeholder="Buscar por residente, trabajo, rubro, lote o #número..."
                className={`w-full pl-9 pr-3 ${FIELD_INPUT_CLASS}`}
                style={innerStyle}
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {[
                { id: 'all', label: 'Todas', count: visitCounts.all },
                ...(visitCounts.action > 0 || visitStatusFilter === 'action'
                  ? [{ id: 'action', label: 'Requiere tu acción', count: visitCounts.action }]
                  : []),
                { id: 'pending', label: 'Pendientes', count: visitCounts.pending },
                { id: 'confirmed', label: 'Acordadas', count: visitCounts.confirmed },
                { id: 'closed', label: 'Cerradas', count: visitCounts.closed },
              ].map((chip) => {
                const active = visitStatusFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => {
                      setVisitStatusFilter(chip.id);
                      setVisitPage(1);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold border transition-all cursor-pointer ${
                      active
                        ? 'text-white border-transparent shadow-sm'
                        : 'border-white/15 opacity-80 hover:opacity-100'
                    }`}
                    style={active ? { backgroundColor: primaryColor } : innerStyle}
                  >
                    <span>{chip.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/25">
                      {chip.count}
                    </span>
                  </button>
                );
              })}

              {(visitStatusFilter !== 'all' || visitSearch.trim()) && (
                <button
                  type="button"
                  onClick={() => {
                    setVisitStatusFilter('all');
                    setVisitSearch('');
                    setVisitPage(1);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border border-rose-400/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 cursor-pointer"
                >
                  <RotateCcw size={11} />
                  <span>Limpiar</span>
                </button>
              )}
            </div>
          </div>

          {/* Listado horizontal minimalista (Divulgación progresiva -> Modal de Detalle) */}
          {loadingVisits ? (
            <p className="text-xs opacity-75 py-8 text-center">Cargando solicitudes de visita...</p>
          ) : filteredVisits.length === 0 ? (
            <div
              className="rounded-xl p-8 text-center text-xs opacity-80 border border-white/10 space-y-2"
              style={innerStyle}
            >
              <p className="font-bold text-sm">
                {incomingVisits.length === 0
                  ? 'Todavía no recibiste solicitudes de visita.'
                  : 'No hay solicitudes que coincidan con el filtro actual.'}
              </p>
              <p className="opacity-75">
                {incomingVisits.length === 0
                  ? 'Cuando un residente te solicite turno o reserve un servicio con precio fijo, aparecerá acá.'
                  : 'Probá seleccionar "Todas" o limpiar la búsqueda.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {paginatedVisits.map((visit) => {
                const statusLower = String(visit.status || '').toLowerCase();
                const isConfirmed = statusLower === 'confirmed';
                const isPendingProvider =
                  statusLower === 'pending_provider' || statusLower === 'pending';
                const isPendingResident = statusLower === 'pending_resident';
                const isClosed = statusLower === 'declined' || statusLower === 'cancelled';
                const quoteStatus = String(visit.quote_status || '').toLowerCase();
                const quoteAmount = Number(visit.quote_amount || 0);
                const isFixedPrice = Boolean(visit.service_package_id) && quoteAmount > 0;
                const msgs = Array.isArray(visit.messages) ? visit.messages : [];
                const ownerLabel = visit.owner_name || 'Residente';
                const specialtyLabel = visit.service_specialty || visit.provider_specialty || '';
                const serviceTitle =
                  String(visit.service_title || '').trim() ||
                  (specialtyLabel ? `Servicio de ${specialtyLabel}` : `Visita #${visit.id}`);
                const addressLabel = formatVisitAddressProvider(
                  visit.fraction_number,
                  visit.lot_number
                );
                const scheduleShort = formatVisitScheduleShortProvider(
                  visit.preferred_date,
                  visit.preferred_end_date
                );

                const badgeLabel =
                  !isClosed && quoteStatus === 'changes_requested'
                    ? 'Ajuste solicitado'
                    : isPendingProvider
                      ? 'Pendiente de respuesta'
                      : isConfirmed && quoteStatus === 'approved'
                        ? isFixedPrice
                          ? 'Acordada · Precio fijo'
                          : 'Presupuesto aprobado'
                        : isConfirmed && quoteStatus === 'sent'
                          ? 'Presupuesto enviado'
                          : isConfirmed
                            ? 'Acordada · En agenda'
                            : isPendingResident
                              ? 'Contrapropuesta enviada'
                              : statusLower === 'declined'
                                ? 'Sin disponibilidad'
                                : 'Cancelada por residente';

                const badgeCls =
                  !isClosed && (isPendingProvider || quoteStatus === 'changes_requested')
                    ? 'bg-amber-500/20 text-amber-200 border-amber-400/50'
                    : isConfirmed && quoteStatus === 'sent'
                      ? 'bg-sky-500/15 text-sky-200 border-sky-400/45'
                      : isConfirmed
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                        : isPendingResident
                          ? 'bg-sky-500/15 text-sky-200 border-sky-400/45'
                          : 'bg-rose-500/15 text-rose-200 border-rose-500/40';

                const rowBorderCls =
                  !isClosed && (isPendingProvider || quoteStatus === 'changes_requested')
                    ? 'border-amber-400/55 ring-1 ring-amber-400/20'
                    : isConfirmed
                      ? 'border-emerald-500/40'
                      : isPendingResident
                        ? 'border-sky-400/45'
                        : 'border-white/10 opacity-85 hover:opacity-100';

                return (
                  <article
                    key={visit.id}
                    className={`rounded-2xl border px-4 py-3.5 text-xs transition-colors ${rowBorderCls}`}
                    style={innerStyle}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      {/* Izquierda clicable: Avatar + Título del servicio + Rubro + Estado -> Residente · Domicilio · Mensajes */}
                      <button
                        type="button"
                        onClick={() => {
                          setReschedulingVisitId(null);
                          setSelectedVisitDetailId(visit.id);
                        }}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer group"
                      >
                        <ProviderAvatar
                          name={ownerLabel}
                          level={isConfirmed ? 3 : 1}
                          size="md"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-extrabold truncate max-w-full sm:max-w-md group-hover:underline">
                              {serviceTitle}
                            </h3>
                            {specialtyLabel && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 shrink-0">
                                {specialtyLabel}
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${badgeCls}`}
                            >
                              {badgeLabel}
                            </span>
                            {isFixedPrice && !isConfirmed && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 font-mono shrink-0">
                                Precio fijo
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] opacity-75">
                            <span>
                              de <strong className="font-semibold opacity-95">{ownerLabel}</strong>
                            </span>
                            <span className="opacity-45">·</span>
                            <span>{addressLabel}</span>
                            {msgs.length > 0 && (
                              <>
                                <span className="opacity-45">·</span>
                                <span className="inline-flex items-center gap-1">
                                  <MessageSquare size={11} className="opacity-80" />
                                  <span>
                                    {msgs.length} {msgs.length === 1 ? 'mensaje' : 'mensajes'}
                                  </span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Derecha: Horario/Monto compacto + máx. 2 acciones limpias */}
                      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between md:justify-end gap-2 shrink-0 pl-12 md:pl-0">
                        {quoteAmount > 0 && (quoteStatus === 'sent' || quoteStatus === 'approved' || isFixedPrice) ? (
                          <span className="font-mono font-black text-sm text-emerald-300 mr-1 whitespace-nowrap">
                            ${quoteAmount.toLocaleString('es-AR')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold opacity-90 mr-1 whitespace-nowrap">
                            <Clock size={12} className="text-emerald-400 shrink-0" />
                            <span>{scheduleShort}</span>
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setReschedulingVisitId(null);
                            setSelectedVisitDetailId(visit.id);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/15 bg-white/5 hover:bg-white/10 opacity-90 hover:opacity-100 cursor-pointer transition-colors"
                        >
                          {!isClosed && msgs.length > 0 ? (
                            <>
                              <MessageSquare size={12} className="text-sky-300" />
                              <span>Mensajes</span>
                            </>
                          ) : (
                            <span>Ver detalle</span>
                          )}
                        </button>

                        {isPendingProvider ? (
                          <button
                            type="button"
                            onClick={() => {
                              setReschedulingVisitId(null);
                              setSelectedVisitDetailId(visit.id);
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer shadow-sm hover:opacity-95"
                            style={{ backgroundColor: primaryColor }}
                          >
                            <CheckCircle2 size={13} />
                            <span>Responder</span>
                          </button>
                        ) : isConfirmed && quoteStatus === 'changes_requested' ? (
                          <button
                            type="button"
                            onClick={() => openQuoteModal(visit)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer shadow-sm hover:opacity-95"
                            style={{ backgroundColor: primaryColor }}
                          >
                            <FileText size={13} />
                            <span>Nuevo presupuesto</span>
                          </button>
                        ) : isConfirmed && !quoteStatus ? (
                          <button
                            type="button"
                            onClick={() => openQuoteModal(visit)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer shadow-sm hover:opacity-95"
                            style={{ backgroundColor: primaryColor }}
                          >
                            <FileText size={13} />
                            <span>Enviar presupuesto</span>
                          </button>
                        ) : isConfirmed && quoteStatus === 'sent' ? (
                          <button
                            type="button"
                            onClick={() => openQuoteModal(visit)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-sky-400/45 bg-sky-500/12 text-sky-200 hover:bg-sky-500/22 cursor-pointer"
                          >
                            <Edit3 size={12} />
                            <span>Editar presupuesto</span>
                          </button>
                        ) : isConfirmed && quoteStatus === 'approved' ? (
                          <button
                            type="button"
                            onClick={() => setActiveStep('reviews')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-emerald-500/40 bg-emerald-500/12 text-emerald-200 hover:bg-emerald-500/22 cursor-pointer"
                          >
                            <CheckCircle2 size={12} />
                            <span>Ver ingresos</span>
                          </button>
                        ) : isPendingResident ? (
                          <button
                            type="button"
                            onClick={() => {
                              openVisitReschedule(visit);
                              setSelectedVisitDetailId(visit.id);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-sky-400/45 bg-sky-500/12 text-sky-200 hover:bg-sky-500/22 cursor-pointer"
                          >
                            <Calendar size={12} />
                            <span>Cambiar horario</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Paginación estándar homologada (`6 / 12 / 24 / 50`) */}
          {filteredVisits.length > 0 && (
            <AdminPaginationBar
              page={safeVisitPage}
              totalPages={totalVisitPages}
              totalItems={filteredVisits.length}
              pageSize={visitPageSize}
              onPageChange={setVisitPage}
              onPageSizeChange={(nextSize) => {
                setVisitPageSize(nextSize);
                setVisitPage(1);
              }}
              loading={loadingVisits}
              itemLabel="solicitudes"
              innerStyle={innerStyle}
            />
          )}
        </section>
      ) : activeStep === 'passes' ? (
        /* PASO 5: PASES QR ASIGNADOS (Paridad estética y UX/UI con Mis Servicios y Solicitudes) */
        <section
          className="rounded-2xl p-5 border border-slate-800/80 space-y-4"
          style={cardStyle}
        >
          {/* Cabecera limpia de Pases QR */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold flex items-center gap-2">
                <QrCode size={18} className="text-emerald-400 shrink-0" />
                <span>Pases QR Asignados para tu Ingreso</span>
              </h2>
              <p className="text-xs opacity-75">
                Consultá tus autorizaciones vigentes para garita, destino, cuadrilla y código QR escaneable.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchAssignedPasses}
              className={rowActionBtnClass}
              style={innerStyle}
              title="Actualizar pases QR"
            >
              <RefreshCw size={13} className={loadingPasses ? 'animate-spin' : ''} /> Actualizar
            </button>
          </div>

          {/* Buscador full-width + chips de filtro homologados */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-55 pointer-events-none"
              />
              <input
                type="text"
                value={passSearch}
                onChange={(e) => {
                  setPassSearch(e.target.value);
                  setPassPage(1);
                }}
                placeholder="Buscar en Pases QR por residente, lote, patente, rubro o #número..."
                className={`w-full pl-9 pr-3 ${FIELD_INPUT_CLASS}`}
                style={innerStyle}
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {[
                { id: 'all', label: 'Todos', count: passCounts.all },
                ...(passCounts.pending > 0 || passStatusFilter === 'pending'
                  ? [{ id: 'pending', label: 'Vigentes', count: passCounts.pending }]
                  : []),
                { id: 'used', label: 'Utilizados', count: passCounts.used },
                { id: 'expired', label: 'Vencidos', count: passCounts.expired },
                ...(passCounts.cancelled > 0 || passStatusFilter === 'cancelled'
                  ? [{ id: 'cancelled', label: 'Cancelados', count: passCounts.cancelled }]
                  : []),
              ].map((chip) => {
                const active = passStatusFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => {
                      setPassStatusFilter(chip.id);
                      setPassPage(1);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold border transition-all cursor-pointer ${
                      active
                        ? 'text-white border-transparent shadow-sm'
                        : 'border-white/15 opacity-80 hover:opacity-100'
                    }`}
                    style={active ? { backgroundColor: primaryColor } : innerStyle}
                  >
                    <span>{chip.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/25">
                      {chip.count}
                    </span>
                  </button>
                );
              })}

              {(passStatusFilter !== 'all' || passSearch.trim()) && (
                <button
                  type="button"
                  onClick={() => {
                    setPassStatusFilter('all');
                    setPassSearch('');
                    setPassPage(1);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border border-rose-400/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 cursor-pointer"
                >
                  <RotateCcw size={11} />
                  <span>Limpiar</span>
                </button>
              )}
            </div>
          </div>

          {passesError && (
            <div className="rounded-xl p-3.5 text-xs border border-amber-700/60 bg-amber-950/40 text-amber-200">
              {passesError}
            </div>
          )}

          {/* Listado horizontal minimalista de Pases QR asignados (Divulgación progresiva -> Modal QR) */}
          {loadingPasses ? (
            <p className="text-xs opacity-75 py-8 text-center">Cargando pases QR asignados...</p>
          ) : paginatedPasses.length === 0 ? (
            <div
              className="rounded-xl p-8 text-center text-xs opacity-80 border border-white/10 space-y-2"
              style={innerStyle}
            >
              <p className="font-bold text-sm">
                {assignedPasses.length === 0
                  ? 'Todavía no tenés pases QR asignados.'
                  : 'No hay pases QR que coincidan con el filtro actual.'}
              </p>
              <p className="opacity-75">
                {assignedPasses.length === 0
                  ? 'Cuando un residente emita un Pase QR para tu visita, aparecerá acá listo para presentar en garita.'
                  : 'Probá seleccionar "Todos" o limpiar la búsqueda.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {paginatedPasses.map((passItem) => {
                const statusLower = String(passItem.status || '').toLowerCase();
                const isPending = statusLower === 'pending';
                const isUsed = statusLower === 'used';
                const ownerLabel =
                  `${passItem.owner_first_name || ''} ${passItem.owner_last_name || ''}`.trim() ||
                  passItem.authorized_by ||
                  'Residente';
                const plateLabel = passItem.vehicle_plate || passItem.plate || 'Ingreso peatonal';
                const statusMeta = getUnifiedStatusMeta(passItem.status, 'pass');
                const addressLabel = formatVisitAddressProvider(
                  passItem.fraction_number,
                  passItem.lot_number
                );
                const crewCount = Array.isArray(passItem.authorized_employees)
                  ? passItem.authorized_employees.length
                  : 0;
                const scheduleShort = formatVisitScheduleShortProvider(
                  passItem.start_time,
                  passItem.end_time
                );
                const rowBorderCls = isPending
                  ? 'border-emerald-500/45 ring-1 ring-emerald-500/15'
                  : isUsed
                    ? 'border-sky-400/40'
                    : 'border-white/10 opacity-85 hover:opacity-100';

                return (
                  <article
                    key={passItem.id}
                    className={`rounded-2xl border px-4 py-3.5 text-xs transition-colors ${rowBorderCls}`}
                    style={innerStyle}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      {/* Izquierda clicable: Avatar + Pase/Rubro/Estado -> Residente · Destino · Acceso */}
                      <button
                        type="button"
                        onClick={() => setSelectedPassModal(passItem)}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer group"
                      >
                        <ProviderAvatar
                          name={ownerLabel}
                          level={isPending ? 3 : 1}
                          size="md"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-extrabold truncate max-w-full sm:max-w-md group-hover:underline">
                              Pase #{passItem.id} · {ownerLabel}
                            </h3>
                            {passItem.provider_specialty && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 shrink-0">
                                {passItem.provider_specialty}
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border shrink-0 ${statusMeta.cls}`}
                            >
                              {statusMeta.label}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] opacity-75">
                            <span className="inline-flex items-center gap-1">
                              <MapPin size={11} className="text-emerald-400 shrink-0" />
                              <span>{addressLabel}</span>
                            </span>
                            <span className="opacity-45">·</span>
                            <span className="inline-flex items-center gap-1">
                              <Car size={11} className="text-sky-400 shrink-0" />
                              <span>{plateLabel}</span>
                            </span>
                            {crewCount > 0 && (
                              <>
                                <span className="opacity-45">·</span>
                                <span className="inline-flex items-center gap-1 text-emerald-300 opacity-100 font-semibold">
                                  <Users size={11} />
                                  <span>
                                    +{crewCount} {crewCount === 1 ? 'ayudante' : 'ayudantes'}
                                  </span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Derecha: Vigencia compacta 24h + máx. 2 acciones limpias */}
                      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between md:justify-end gap-2 shrink-0 pl-12 md:pl-0">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold opacity-90 mr-1 whitespace-nowrap">
                          <Clock size={12} className="text-emerald-400 shrink-0" />
                          <span>{scheduleShort}</span>
                        </span>

                        {isPending && passItem.qr_token ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCopyToken(passItem.qr_token, passItem.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/15 bg-white/5 hover:bg-white/10 opacity-90 hover:opacity-100 cursor-pointer transition-colors"
                            >
                              {copiedPassId === passItem.id ? (
                                <>
                                  <Check size={12} className="text-emerald-400" />
                                  <span>Copiado</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={12} />
                                  <span>Copiar</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedPassModal(passItem)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer shadow-sm hover:opacity-95"
                              style={{ backgroundColor: primaryColor }}
                            >
                              <QrCode size={13} />
                              <span>Ver QR</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedPassModal(passItem)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/15 bg-white/5 hover:bg-white/10 opacity-90 hover:opacity-100 cursor-pointer transition-colors"
                          >
                            <span>Ver detalle</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Paginación homologada para los pases QR filtrados */}
          {filteredPasses.length > 0 && (
            <AdminPaginationBar
              page={safePassPage}
              totalPages={totalPassPages}
              totalItems={filteredPasses.length}
              pageSize={passPageSize}
              onPageChange={setPassPage}
              onPageSizeChange={(nextSize) => {
                setPassPageSize(nextSize);
                setPassPage(1);
              }}
              itemLabel="pases QR"
              innerStyle={innerStyle}
            />
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
                <span>Reputación, Ingresos y Reseñas Cruzadas</span>
              </h2>
              <p className="text-xs opacity-75">
                Consultá tu reputación en el directorio, ingresos netos (93%), comprobantes y calificaciones cruzadas.
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

      {/* Modal: Detalle de Solicitud / Visita del Prestador (Divulgación progresiva simétrica a Mis Servicios) */}
      {selectedVisitDetail && (() => {
        const visit = selectedVisitDetail;
        const statusLower = String(visit.status || '').toLowerCase();
        const isConfirmed = statusLower === 'confirmed';
        const isPendingProvider = statusLower === 'pending_provider' || statusLower === 'pending';
        const isPendingResident = statusLower === 'pending_resident';
        const isClosed = statusLower === 'declined' || statusLower === 'cancelled';
        const isRescheduling = reschedulingVisitId === visit.id;
        const quoteStatus = String(visit.quote_status || '').toLowerCase();
        const quoteAmount = Number(visit.quote_amount || 0);
        const isFixedPrice = Boolean(visit.service_package_id) && quoteAmount > 0;
        const msgs = Array.isArray(visit.messages) ? visit.messages : [];
        const ownerLabel = visit.owner_name || 'Residente';
        const specialtyLabel = visit.service_specialty || visit.provider_specialty || '';
        const serviceTitle =
          String(visit.service_title || '').trim() ||
          (specialtyLabel ? `Servicio de ${specialtyLabel}` : `Visita #${visit.id}`);
        const addressLabel = formatVisitAddressProvider(visit.fraction_number, visit.lot_number);

        const badgeLabel =
          !isClosed && quoteStatus === 'changes_requested'
            ? 'Ajuste solicitado'
            : isPendingProvider
              ? 'Pendiente de respuesta'
              : isConfirmed && quoteStatus === 'approved'
                ? isFixedPrice
                  ? 'Acordada · Precio fijo'
                  : 'Presupuesto aprobado'
                : isConfirmed && quoteStatus === 'sent'
                  ? 'Presupuesto enviado'
                  : isConfirmed
                    ? 'Acordada · En agenda'
                    : isPendingResident
                      ? 'Contrapropuesta enviada'
                      : statusLower === 'declined'
                        ? 'Sin disponibilidad'
                        : 'Cancelada por residente';

        const badgeCls =
          !isClosed && (isPendingProvider || quoteStatus === 'changes_requested')
            ? 'bg-amber-500/20 text-amber-200 border-amber-400/50'
            : isConfirmed && quoteStatus === 'sent'
              ? 'bg-sky-500/15 text-sky-200 border-sky-400/45'
              : isConfirmed
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                : isPendingResident
                  ? 'bg-sky-500/15 text-sky-200 border-sky-400/45'
                  : 'bg-rose-500/15 text-rose-200 border-rose-500/40';

        const closeVisitModal = () => {
          setSelectedVisitDetailId(null);
          setReschedulingVisitId(null);
        };

        return (
          <div
            className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
            onClick={closeVisitModal}
          >
            <div
              className="w-full max-w-xl rounded-2xl border border-slate-700/80 shadow-2xl flex flex-col max-h-[88vh] overflow-hidden text-xs"
              style={cardStyle}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Cabecera fija del Modal de Solicitud */}
              <div className="px-5 py-4 border-b border-white/10 flex items-start justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <ProviderAvatar name={ownerLabel} level={isConfirmed ? 3 : 1} size="md" />
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-black truncate">{serviceTitle}</h3>
                      {specialtyLabel && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                          {specialtyLabel}
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${badgeCls}`}
                      >
                        {badgeLabel}
                      </span>
                    </div>
                    <p className="text-[11px] opacity-75">
                      Residente: <strong className="opacity-95">{ownerLabel}</strong> · Visita #{visit.id} ·{' '}
                      {addressLabel}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeVisitModal}
                  aria-label="Cerrar detalle de solicitud"
                  className="p-1.5 rounded-lg opacity-75 hover:opacity-100 cursor-pointer shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Cuerpo desplazable */}
              <div className="p-5 overflow-y-auto tl-scroll space-y-4 flex-1">
                {/* Hitos del servicio (solo en solicitudes activas) */}
                {!isClosed && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                    <span
                      className={`px-2.5 py-1 rounded-lg border ${
                        isConfirmed
                          ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                          : 'border-amber-400/45 bg-amber-500/10 text-amber-200'
                      }`}
                    >
                      {isConfirmed ? '✓ Horario acordado' : '● Coordinando horario'}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-lg border ${
                        quoteStatus === 'approved'
                          ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                          : quoteStatus === 'sent'
                            ? 'border-sky-400/40 bg-sky-500/10 text-sky-200'
                            : quoteStatus === 'changes_requested'
                              ? 'border-amber-400/50 bg-amber-500/15 text-amber-200'
                              : 'border-white/10 opacity-50'
                      }`}
                    >
                      {quoteStatus === 'approved'
                        ? isFixedPrice
                          ? '✓ Precio fijo'
                          : '✓ Presupuesto aprobado'
                        : quoteStatus === 'sent'
                          ? '● Presupuesto enviado'
                          : quoteStatus === 'changes_requested'
                            ? '● Ajuste pedido'
                            : '○ Presupuesto'}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-lg border ${
                        isConfirmed
                          ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                          : 'border-white/10 opacity-45'
                      }`}
                    >
                      {isConfirmed ? '✓ En tu Agenda' : '○ Agenda'}
                    </span>
                  </div>
                )}

                {/* Resumen de horario + acceso directo a Agenda */}
                <div
                  className="rounded-xl p-3.5 border border-white/10 flex flex-wrap items-center justify-between gap-2"
                  style={innerStyle}
                >
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-65">
                      {isConfirmed
                        ? 'Horario acordado'
                        : isPendingResident
                          ? 'Horario que propusiste'
                          : 'Horario solicitado'}
                    </span>
                    <p className="font-bold inline-flex items-center gap-1.5 text-xs">
                      <Clock size={13} className="text-emerald-400 shrink-0" />
                      <span>
                        {visit.preferred_date
                          ? `${formatDateTimeAR(visit.preferred_date)}${
                              visit.preferred_end_date
                                ? ` → ${new Date(visit.preferred_end_date).toLocaleTimeString(
                                    'es-AR',
                                    { hour: '2-digit', minute: '2-digit', hour12: false }
                                  )}`
                                : ''
                            }`
                          : 'A convenir'}
                      </span>
                    </p>
                  </div>
                  {isConfirmed && (
                    <button
                      type="button"
                      onClick={() => {
                        closeVisitModal();
                        setActiveStep('schedule');
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-emerald-500/40 bg-emerald-950/50 text-emerald-200 hover:bg-emerald-950/80 cursor-pointer shrink-0"
                    >
                      Ver en Agenda
                    </button>
                  )}
                </div>

                {/* Tarjeta de Presupuesto / Precio Fijo cuando corresponde */}
                {!isClosed && (quoteAmount > 0 || quoteStatus === 'changes_requested') && (
                  <div
                    className={`rounded-xl p-3.5 border space-y-2 ${
                      quoteStatus === 'approved'
                        ? 'border-emerald-500/40 bg-emerald-950/25'
                        : quoteStatus === 'changes_requested'
                          ? 'border-amber-400/50 bg-amber-950/30'
                          : 'border-sky-500/40 bg-sky-950/25'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                          {isFixedPrice
                            ? 'Servicio con precio fijo'
                            : quoteStatus === 'approved'
                              ? 'Presupuesto aprobado por el residente'
                              : quoteStatus === 'changes_requested'
                                ? 'El residente pidió un ajuste'
                                : 'Presupuesto enviado'}
                        </span>
                        {visit.quote_description && (
                          <p className="text-xs font-semibold leading-relaxed">
                            {visit.quote_description}
                          </p>
                        )}
                        {visit.quote_notes && (
                          <p className="text-[11px] opacity-80">{visit.quote_notes}</p>
                        )}
                      </div>
                      {quoteAmount > 0 && (
                        <div className="text-right shrink-0">
                          <span className="block font-mono font-black text-base text-emerald-300">
                            ${quoteAmount.toLocaleString('es-AR')}
                          </span>
                          <span className="text-[10px] opacity-75 font-mono">
                            Neto 93%: ${Math.round(quoteAmount * 0.93).toLocaleString('es-AR')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Decisión de turno (cuando está pendiente o repactando) */}
                {!isConfirmed && !isClosed && (
                  <div className="space-y-2.5">
                    {isPendingResident && !isRescheduling && (
                      <div className="rounded-xl p-3 border border-sky-500/35 bg-sky-950/30 text-sky-100 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span>
                          Esperando que el residente confirme tu contrapropuesta o sugiera otro turno.
                        </span>
                        <button
                          type="button"
                          onClick={() => openVisitReschedule(visit)}
                          className="px-2.5 py-1 rounded-lg font-bold border border-sky-400/45 hover:bg-sky-900/50 cursor-pointer shrink-0"
                        >
                          Cambiar propuesta
                        </button>
                      </div>
                    )}

                    {isRescheduling ? (
                      <div className="rounded-xl p-3.5 border border-sky-500/40 bg-sky-950/25 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-sky-200 flex items-center gap-1.5">
                            <Calendar size={13} /> Proponer nuevo día y horario
                          </span>
                          <button
                            type="button"
                            onClick={() => setReschedulingVisitId(null)}
                            className="opacity-70 hover:opacity-100 cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] opacity-80 mb-1">
                              Nueva fecha y hora propuesta
                            </label>
                            <input
                              type="datetime-local"
                              value={rescheduleDateDraft}
                              onChange={(e) => setRescheduleDateDraft(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                              style={cardStyle}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] opacity-80 mb-1">
                              Mensaje aclaratorio (opcional)
                            </label>
                            <input
                              type="text"
                              value={visitReplyDrafts[visit.id] || ''}
                              onChange={(e) =>
                                setVisitReplyDrafts((prev) => ({
                                  ...prev,
                                  [visit.id]: e.target.value,
                                }))
                              }
                              placeholder="Ej: Ese día estoy en obra, ¿te sirve a las 15:00?"
                              className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                              style={cardStyle}
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setReschedulingVisitId(null)}
                            className={rowActionBtnClass}
                            style={cardStyle}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={respondingVisitId === visit.id}
                            onClick={() =>
                              handleRespondVisit(visit.id, 'propose', rescheduleDateDraft)
                            }
                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                            style={{ backgroundColor: primaryColor }}
                          >
                            {respondingVisitId === visit.id
                              ? 'Enviando...'
                              : 'Enviar propuesta al residente'}
                          </button>
                        </div>
                      </div>
                    ) : isPendingProvider ? (
                      <div
                        className="rounded-xl p-3.5 border border-amber-400/45 bg-amber-950/25 space-y-2.5"
                      >
                        <p className="font-bold text-amber-200 text-xs">
                          Respondé disponibilidad al residente
                        </p>
                        <input
                          type="text"
                          value={visitReplyDrafts[visit.id] || ''}
                          onChange={(e) =>
                            setVisitReplyDrafts((prev) => ({
                              ...prev,
                              [visit.id]: e.target.value,
                            }))
                          }
                          placeholder="Mensaje opcional al confirmar o rechazar..."
                          className={`w-full ${FIELD_INPUT_CLASS}`}
                          style={cardStyle}
                        />
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={respondingVisitId === visit.id}
                            onClick={() => handleRespondVisit(visit.id, 'decline')}
                            className="px-3 py-2 rounded-xl text-xs font-bold border border-rose-500/40 bg-rose-950/30 text-rose-200 hover:bg-rose-950/60 cursor-pointer disabled:opacity-50"
                          >
                            Sin disponibilidad
                          </button>
                          <button
                            type="button"
                            disabled={respondingVisitId === visit.id}
                            onClick={() => openVisitReschedule(visit)}
                            className="px-3 py-2 rounded-xl text-xs font-bold border border-sky-500/45 bg-sky-950/35 text-sky-200 hover:bg-sky-950/65 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Calendar size={13} /> Repactar horario
                          </button>
                          <button
                            type="button"
                            disabled={respondingVisitId === visit.id}
                            onClick={() => handleRespondVisit(visit.id, 'confirm')}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            style={{ backgroundColor: primaryColor }}
                          >
                            <CheckCircle2 size={13} />
                            {respondingVisitId === visit.id
                              ? 'Guardando...'
                              : 'Confirmar horario'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Hilo de mensajes completo + envío directo de mensajes de seguimiento */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider opacity-70 inline-flex items-center gap-1.5">
                    <MessageSquare size={12} />
                    <span>Mensajes ({msgs.length})</span>
                  </span>

                  <div
                    className="rounded-xl p-3.5 border border-white/10 space-y-2 max-h-56 overflow-y-auto tl-scroll"
                    style={innerStyle}
                  >
                    {msgs.length === 0 ? (
                      <p className="text-[11px] opacity-65 text-center py-2">
                        Todavía no intercambiaron mensajes en esta solicitud.
                      </p>
                    ) : (
                      msgs.map((m, idx) => (
                        <p key={m.id || idx} className="text-xs leading-relaxed">
                          <strong
                            className={`uppercase text-[10px] mr-1.5 ${
                              m.sender_role === 'provider' ? 'text-emerald-300' : 'text-sky-300'
                            }`}
                          >
                            {m.sender_role === 'provider' ? 'Vos:' : 'Residente:'}
                          </strong>
                          <span>{m.text}</span>
                        </p>
                      ))
                    )}
                  </div>

                  {!isClosed && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={visitMessageDrafts[visit.id] || ''}
                        onChange={(e) =>
                          setVisitMessageDrafts((prev) => ({
                            ...prev,
                            [visit.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (visitMessageDrafts[visit.id] || '').trim()) {
                            e.preventDefault();
                            handleSendProviderVisitMessage(visit.id);
                          }
                        }}
                        placeholder="Escribí un mensaje para el residente..."
                        className={`flex-1 ${FIELD_INPUT_CLASS}`}
                        style={innerStyle}
                      />
                      <button
                        type="button"
                        disabled={sendingVisitMessageId === visit.id}
                        onClick={() => handleSendProviderVisitMessage(visit.id)}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-white/15 bg-white/5 hover:bg-white/10 cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        <Send size={13} />
                        <span>Enviar</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Pie fijo del Modal */}
              <div
                className="px-5 py-3.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 shrink-0"
                style={innerStyle}
              >
                <button
                  type="button"
                  onClick={closeVisitModal}
                  className="px-3.5 py-2 rounded-xl font-bold border border-white/15 cursor-pointer hover:opacity-90"
                  style={cardStyle}
                >
                  Cerrar
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  {isConfirmed && !quoteStatus && (
                    <button
                      type="button"
                      onClick={() => {
                        closeVisitModal();
                        openQuoteModal(visit);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer shadow-sm hover:opacity-95"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <FileText size={13} />
                      <span>Enviar presupuesto</span>
                    </button>
                  )}
                  {isConfirmed && quoteStatus === 'changes_requested' && (
                    <button
                      type="button"
                      onClick={() => {
                        closeVisitModal();
                        openQuoteModal(visit);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer shadow-sm hover:opacity-95"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <FileText size={13} />
                      <span>Enviar nuevo presupuesto</span>
                    </button>
                  )}
                  {isConfirmed && quoteStatus === 'sent' && (
                    <button
                      type="button"
                      onClick={() => {
                        closeVisitModal();
                        openQuoteModal(visit);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-sky-400/45 bg-sky-500/15 text-sky-100 hover:bg-sky-500/25 cursor-pointer"
                    >
                      <Edit3 size={13} />
                      <span>Editar presupuesto</span>
                    </button>
                  )}
                  {isConfirmed && quoteStatus === 'approved' && (
                    <button
                      type="button"
                      onClick={() => {
                        closeVisitModal();
                        setActiveStep('reviews');
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-emerald-500/45 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 cursor-pointer"
                    >
                      <CheckCircle2 size={13} />
                      <span>Ver en Reputación e Ingresos</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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

      {/* Modal: Enviar o actualizar Presupuesto Formal vinculado a una Visita */}
      {quoteModalVisit && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => !savingQuote && setQuoteModalVisit(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl p-6 border border-slate-700/80 shadow-2xl space-y-4 text-xs"
            style={cardStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
              <div className="space-y-0.5 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 inline-flex items-center gap-1.5">
                  <FileText size={12} />
                  <span>
                    {quoteModalVisit.quote_status
                      ? 'Actualizar presupuesto'
                      : 'Nuevo presupuesto formal'}
                  </span>
                </span>
                <h3 className="text-base font-black truncate">
                  {quoteModalVisit.service_title ||
                    (quoteModalVisit.service_specialty || quoteModalVisit.provider_specialty
                      ? `Servicio de ${quoteModalVisit.service_specialty || quoteModalVisit.provider_specialty}`
                      : `Visita #${quoteModalVisit.id}`)}
                </h3>
                <p className="text-[11px] opacity-75">
                  Residente: <strong className="opacity-95">{quoteModalVisit.owner_name || 'Residente'}</strong> · Visita #{quoteModalVisit.id}
                </p>
              </div>
              <button
                type="button"
                disabled={savingQuote}
                onClick={() => setQuoteModalVisit(null)}
                aria-label="Cerrar modal de presupuesto"
                className="p-1 rounded-lg opacity-75 hover:opacity-100 cursor-pointer shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {quoteModalError && (
              <div className="rounded-xl p-3 border border-rose-500/45 bg-rose-950/50 text-rose-200 flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-400" />
                <span>{quoteModalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitVisitQuote} className="space-y-3.5">
              <div className="space-y-1">
                <label className="block font-semibold opacity-90">
                  Alcance del trabajo presupuestado *
                </label>
                <textarea
                  rows={3}
                  required
                  maxLength={500}
                  value={quoteDescriptionDraft}
                  onChange={(e) => setQuoteDescriptionDraft(e.target.value)}
                  placeholder="Ej: Cambio de válvula, sellado de cañería bajo mesada y prueba de presión."
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs focus:outline-none resize-none"
                  style={innerStyle}
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold opacity-90">
                  Monto total del presupuesto (ARS) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold opacity-70">
                    $
                  </span>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={quoteAmountDraft}
                    onChange={(e) => setQuoteAmountDraft(e.target.value)}
                    placeholder="Ej: 85000"
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-slate-700/80 text-sm font-mono font-bold focus:outline-none"
                    style={innerStyle}
                  />
                </div>
                {Number(quoteAmountDraft) > 0 && (
                  <div className="flex items-center justify-between gap-2 pt-1 text-[11px] opacity-85">
                    <span>Comisión plataforma (7%):</span>
                    <span className="font-mono">
                      ${Math.round(Number(quoteAmountDraft) * 0.07).toLocaleString('es-AR')}
                    </span>
                  </div>
                )}
                {Number(quoteAmountDraft) > 0 && (
                  <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-emerald-300">
                    <span>Tu ingreso neto estimado (93%):</span>
                    <span className="font-mono">
                      ${Math.round(Number(quoteAmountDraft) * 0.93).toLocaleString('es-AR')}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="block font-semibold opacity-90">
                  Materiales, plazo o condiciones (opcional)
                </label>
                <input
                  type="text"
                  maxLength={300}
                  value={quoteNotesDraft}
                  onChange={(e) => setQuoteNotesDraft(e.target.value)}
                  placeholder="Ej: Incluye materiales. Demora estimada: 1 jornada. Validez: 7 días."
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs focus:outline-none"
                  style={innerStyle}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  disabled={savingQuote}
                  onClick={() => setQuoteModalVisit(null)}
                  className="px-4 py-2 rounded-xl font-bold border border-slate-700/80 cursor-pointer"
                  style={innerStyle}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingQuote}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-white cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Send size={13} />
                  <span>{savingQuote ? 'Enviando...' : 'Enviar presupuesto'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Crear o editar Servicio con Precio Fijo */}
      {pkgModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => !savingPackage && setPkgModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl p-6 border border-slate-700/80 shadow-2xl space-y-4 text-xs"
            style={cardStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Catálogo de precio fijo
                </span>
                <h3 className="text-base font-black">
                  {editingPackage ? 'Editar servicio con precio fijo' : 'Nuevo servicio con precio fijo'}
                </h3>
              </div>
              <button
                type="button"
                disabled={savingPackage}
                onClick={() => setPkgModalOpen(false)}
                aria-label="Cerrar modal de servicio"
                className="p-1 rounded-lg opacity-75 hover:opacity-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {pkgModalError && (
              <div className="rounded-xl p-3 border border-rose-500/45 bg-rose-950/50 text-rose-200 flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-400" />
                <span>{pkgModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveServicePackage} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold opacity-90">Rubro / Especialidad *</label>
                  <select
                    value={pkgSpecialty}
                    onChange={(e) => setPkgSpecialty(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs focus:outline-none"
                    style={innerStyle}
                  >
                    {(profileData.providers || []).map((prof) => (
                      <option key={prof.id} value={prof.specialty}>
                        {prof.specialty}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold opacity-90">Duración estimada</label>
                  <select
                    value={pkgDuration}
                    onChange={(e) => setPkgDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs focus:outline-none"
                    style={innerStyle}
                  >
                    <option value={60}>1 hora (60 min)</option>
                    <option value={90}>1 h 30 min (90 min)</option>
                    <option value={120}>2 horas (120 min)</option>
                    <option value={180}>3 horas (180 min)</option>
                    <option value={240}>4 horas (240 min)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold opacity-90">Nombre del servicio *</label>
                <input
                  type="text"
                  required
                  maxLength={140}
                  value={pkgTitle}
                  onChange={(e) => setPkgTitle(e.target.value)}
                  placeholder="Ej: Mantenimiento anual de termotanque"
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs focus:outline-none"
                  style={innerStyle}
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold opacity-90">Precio fijo total (ARS) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold opacity-70">
                    $
                  </span>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={pkgPrice}
                    onChange={(e) => setPkgPrice(e.target.value)}
                    placeholder="Ej: 45000"
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-slate-700/80 text-sm font-mono font-bold focus:outline-none"
                    style={innerStyle}
                  />
                </div>
                {Number(pkgPrice) > 0 && (
                  <div className="flex items-center justify-between gap-2 pt-1 text-[11px] font-bold text-emerald-300">
                    <span>Tu ingreso neto estimado (93%):</span>
                    <span className="font-mono">
                      ${Math.round(Number(pkgPrice) * 0.93).toLocaleString('es-AR')}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="block font-semibold opacity-90">
                  ¿Qué incluye este servicio? (opcional)
                </label>
                <textarea
                  rows={3}
                  maxLength={400}
                  value={pkgIncludes}
                  onChange={(e) => setPkgIncludes(e.target.value)}
                  placeholder="Ej: Purga completa, limpieza de quemador, control de ánodo de magnesio y prueba de funcionamiento."
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs focus:outline-none resize-none"
                  style={innerStyle}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  disabled={savingPackage}
                  onClick={() => setPkgModalOpen(false)}
                  className="px-4 py-2 rounded-xl font-bold border border-slate-700/80 cursor-pointer"
                  style={innerStyle}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPackage}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-white cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Save size={13} />
                  <span>{savingPackage ? 'Guardando...' : editingPackage ? 'Guardar cambios' : 'Publicar servicio'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}