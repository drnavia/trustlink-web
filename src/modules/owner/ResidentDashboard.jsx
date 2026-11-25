/**
 * @file ResidentDashboard.jsx
 * @description Portal integral del Residente en TrustLink, estructurado en un flujo guiado de 5 pasos:
 * 1. Directorio de Prestadores Verificados: búsqueda por texto, filtros dinámicos por especialidad,
 *    toggle de "Socio Verificado", ordenamiento (destacados, calificación, trabajos), visibilidad de
 *    documentación vencida, modal de reseñas verificadas y estado de contacto/visita por prestador.
 * 2. Visitas: coordinación bidireccional de disponibilidad, mensajería de seguimiento por solicitud
 *    y acceso directo para emitir un Pase QR con datos precargados.
 * 3. Pases QR: emisión, visualización escaneable, edición y cancelación de pases con asignación de
 *    vehículo/patente, selección de cuadrilla/ayudantes con estado de vigencia ART, filtros/paginación,
 *    copia rápida del token y envío por WhatsApp con enlace directo para garita.
 * 4. Visitas y Pagos: gestión de contratos acordados con desglose de comisión (7% plataforma / 93% prestador),
 *    pago online con redirección a checkout, registro de conformidad (online o efectivo), Comprobante del Hogar
 *    imprimible/PDF y apertura de reclamos o garantías post-servicio.
 * 5. Reseñas: calificación cruzada entre residente y prestador para actualizar la reputación comunitaria.
 * Respeta la paleta visual por zona definida en BrandingContext y los tokens compartidos de uiTokens.
 * @location /trustlink-web/src/modules/owner/ResidentDashboard.jsx
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Star,
  QrCode,
  Search,
  AlertCircle,
  CheckCircle2,
  X,
  Copy,
  Check,
  Ban,
  CreditCard,
  MessageSquare,
  Users,
  RefreshCw,
  Send,
  Calendar,
  Car,
  Edit3,
  Save,
  Share2,
  Award,
  FileText,
  Printer,
  Heart,
  Zap,
  RotateCcw,
  MapPin,
  Clock,
  HelpCircle,
  Plus,
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';
import { useAuth } from '../auth/AuthContext';
import { API_BASE } from '../../config/api';
import QrCodeDisplay from '../../components/QrCodeDisplay';
import {
  HomeProtectedBadge,
  ReputationThermometer,
} from '../../components/HomeProtectedBadge';
import { printServiceReceipt } from '../../utils/receiptPrinter';
import {
  matchesProviderQuery,
  getSearchSuggestions,
} from '../../utils/serviceSearchMatcher';
import {
  PAGE_SHELL_CLASS,
  SECTION_CARD_CLASS,
  ITEMS_GRID_CLASS,
  ITEM_CARD_CLASS,
  FIELD_INPUT_CLASS,
  REVIEW_MICRO_TAGS,
  formatDateTimeAR,
  getUnifiedStatusMeta,
} from '../../config/uiTokens';

/** Especialidades base mostradas como accesos rápidos en los filtros del directorio. */
const QUICK_SPECIALTIES = [
  'Todos',
  'Electricista',
  'Gasista',
  'Plomero',
  'Jardinería',
  'Aire Acondicionado',
];

/** Cantidad máxima de tarjetas de Pases QR visibles por página en el listado. */
const PASSES_PER_PAGE = 6;

/** Cantidad máxima de chips de especialidad visibles por tarjeta antes de agrupar con "+N más". */
const MAX_VISIBLE_CARD_SPECIALTIES = 3;

/**
 * Extrae y deduplica todas las especialidades habilitadas de un prestador del directorio,
 * priorizando el arreglo `specialties` del backend y usando `specialties_label` o `specialty` como respaldo.
 *
 * @param {Object} provider - Registro consolidado del prestador devuelto por `/api/v1/providers/directory`.
 * @returns {string[]} Lista ordenada y sin duplicados de rubros habilitados.
 */
const getProviderSpecialties = (provider) => {
  const collected = [];
  const pushUnique = (value) => {
    const clean = String(value || '').trim();
    if (!clean) return;
    if (!collected.some((item) => item.toLowerCase() === clean.toLowerCase())) {
      collected.push(clean);
    }
  };

  if (Array.isArray(provider?.specialties) && provider.specialties.length > 0) {
    provider.specialties.forEach(pushUnique);
  } else if (provider?.specialties_label) {
    String(provider.specialties_label)
      .split(/[·,|/]/)
      .forEach(pushUnique);
  } else if (provider?.specialty) {
    String(provider.specialty)
      .split(/[·,|/]/)
      .forEach(pushUnique);
  }

  return collected.length > 0 ? collected : ['Servicio Verificado'];
};

/**
 * Convierte una instancia de Date al formato local `YYYY-MM-DDTHH:mm`
 * requerido por inputs HTML de tipo `datetime-local`.
 *
 * @param {Date} dateObj - Fecha y hora a formatear en zona horaria local.
 * @returns {string} Cadena compatible con `datetime-local`.
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
 * Formatea una fecha/hora en formato legible argentino (`DD/MM/YYYY, HH:mm`).
 * Devuelve `'—'` si el valor está vacío o el valor original como texto si no puede parsearse.
 *
 * @param {string|number|Date|null|undefined} value - Fecha/hora de entrada.
 * @returns {string} Representación localizada para visualización en interfaz o mensajes.
 */
const formatLocalDateTime = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Calcula la etiqueta y clases visuales del badge de estado de cobertura ART
 * para un integrante de cuadrilla en función de su fecha de vencimiento.
 *
 * @param {string|Date|null|undefined} expiryDate - Fecha de vencimiento de la ART.
 * @returns {{ label: string, cls: string }} Texto descriptivo y clases Tailwind de severidad.
 */
const getCrewArtBadge = (expiryDate) => {
  if (!expiryDate) return { label: 'ART sin fecha', cls: 'bg-slate-800 text-slate-300 border-slate-700' };
  const parsed = new Date(expiryDate);
  if (Number.isNaN(parsed.getTime())) return { label: 'ART sin fecha', cls: 'bg-slate-800 text-slate-300 border-slate-700' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: 'ART vencida', cls: 'bg-rose-950/80 text-rose-300 border-rose-700/60' };
  if (diffDays <= 30) return { label: `ART vence en ${diffDays}d`, cls: 'bg-amber-950/80 text-amber-300 border-amber-700/60' };
  return { label: 'ART vigente', cls: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60' };
};

/**
 * Construye un enlace de WhatsApp (`https://wa.me/...`) con el resumen completo
 * del Pase QR emitido: destino, vehículo o ingreso peatonal, cuadrilla autorizada,
 * ventana de vigencia y enlace directo con token para validación en garita.
 *
 * @param {Object} passItem - Registro del pase QR emitido.
 * @returns {string} URL lista para abrir en una nueva pestaña y compartir por WhatsApp.
 */
const buildPassWhatsAppUrl = (passItem) => {
  const digits = String(passItem?.provider_phone || '').replace(/\D/g, '');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const gateLink = passItem?.qr_token ? `${origin}/?qr_token=${encodeURIComponent(passItem.qr_token)}` : '';
  const crew = Array.isArray(passItem?.authorized_employees) ? passItem.authorized_employees : [];
  const crewLine =
    crew.length > 0
      ? `\nCuadrilla autorizada: ${crew.map((e) => `${e.full_name}${e.dni ? ` (DNI ${e.dni})` : ''}`).join(', ')}`
      : '';
  const message =
    `Hola${passItem?.provider_name ? ` ${passItem.provider_name}` : ''}, te comparto tu Pase QR TrustLink #${passItem?.id || ''}.\n` +
    `Destino: ${passItem?.fraction_number || 'N/A'} / Lote ${passItem?.lot_number || '—'}\n` +
    `Acceso: ${passItem?.vehicle_plate || 'Ingreso peatonal'}${crewLine}\n` +
    `Vigencia: ${formatLocalDateTime(passItem?.start_time)} a ${formatLocalDateTime(passItem?.end_time)}\n` +
    (gateLink ? `Enlace directo para garita: ${gateLink}` : `Token QR: ${passItem?.qr_token || ''}`);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
};

/**
 * Traduce el estado de una solicitud de visita en metadatos de presentación
 * (etiqueta, estilos del badge y banderas booleanas de confirmación/rechazo).
 *
 * @param {Object|null|undefined} visit - Última solicitud de visita asociada a un prestador.
 * @returns {{ label: string, badgeClass: string, isConfirmed: boolean, isDeclined: boolean }} Metadatos de estado.
 */
const getVisitStatusMeta = (visit) => {
  if (!visit) {
    return {
      label: 'Sin contacto previo',
      badgeClass: 'bg-slate-800/80 text-slate-300 border-slate-700',
      isConfirmed: false,
      isDeclined: false,
    };
  }
  const st = String(visit.status || '').toLowerCase();
  if (st === 'confirmed') {
    return {
      label: 'Disponibilidad Confirmada',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      isConfirmed: true,
      isDeclined: false,
    };
  }
  if (st === 'declined') {
    return {
      label: 'Sin Disponibilidad',
      badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
      isConfirmed: false,
      isDeclined: true,
    };
  }
  return {
    label: 'Pendiente de Confirmación',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    isConfirmed: false,
    isDeclined: false,
  };
};

/**
 * Componente principal del Portal del Residente.
 * Centraliza la búsqueda de prestadores verificados, coordinación de visitas,
 * emisión/gestión de Pases QR, generación y pago de órdenes (incluyendo retorno de Mercado Pago),
 * conformidad/comprobantes/reclamos y reseñas cruzadas en un único flujo guiado de 5 pasos.
 *
 * @param {Object} props
 * @param {(view: string) => void} [props.onNavigate] - Callback opcional para navegar a otras vistas (ej. 'account').
 * @param {string|null} [props.initialStep] - Paso inicial solicitado externamente (ej. `'payments'` al llegar desde `/#payments`).
 * @param {() => void} [props.onConsumedInitialStep] - Callback opcional para limpiar `initialStep` tras aplicarlo.
 * @returns {JSX.Element} Vista completa del dashboard del residente.
 */
export default function ResidentDashboard({
  onNavigate,
  initialStep = null,
  onConsumedInitialStep,
}) {
  // Contextos globales de marca y sesión del residente autenticado
  const { brand } = useBranding();
  const { user } = useAuth();

  // Paso activo del flujo guiado: 'providers' | 'visits' | 'passes' | 'payments' | 'reviews'
  const [activeStep, setActiveStep] = useState(() =>
    ['providers', 'visits', 'passes', 'payments', 'reviews'].includes(initialStep)
      ? initialStep
      : 'providers'
  );

  // Sincroniza cambios externos de paso inicial (ej. redirección desde /#payments o retorno de Mercado Pago)
  useEffect(() => {
    if (['providers', 'visits', 'passes', 'payments', 'reviews'].includes(initialStep)) {
      setActiveStep(initialStep);
      if (typeof onConsumedInitialStep === 'function') {
        onConsumedInitialStep();
      }
    }
  }, [initialStep, onConsumedInitialStep]);

  // Directorio de prestadores, filtros, ordenamiento y modal de reseñas públicas
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [providersError, setProvidersError] = useState('');
  // Si el usuario llegó desde una búsqueda rápida externa, consume y limpia el término precargado
  const [searchTerm, setSearchTerm] = useState(() => {
    const saved = sessionStorage.getItem('trustlink_initial_service_query');
    if (saved && saved.trim()) {
      sessionStorage.removeItem('trustlink_initial_service_query');
      return saved.trim();
    }
    return '';
  });
  const [selectedSpecialty, setSelectedSpecialty] = useState('Todos');
  const [onlyVerifiedMembers, setOnlyVerifiedMembers] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [onlyAvailableToday, setOnlyAvailableToday] = useState(false);
  const [onlyEmergencies, setOnlyEmergencies] = useState(false);
  const [togglingFavoriteUserId, setTogglingFavoriteUserId] = useState(null);
  const [directorySortBy, setDirectorySortBy] = useState('featured');
  const [reviewsModalProvider, setReviewsModalProvider] = useState(null);
  const [providerReviewsList, setProviderReviewsList] = useState([]);
  const [loadingProviderReviews, setLoadingProviderReviews] = useState(false);
  const [reviewFilterTag, setReviewFilterTag] = useState('all');
  const [reviewFilterMinStars, setReviewFilterMinStars] = useState(0);

  // Modal de Preguntas y Respuestas públicas (Q&A estilo ficha de producto)
  const [qaModalProvider, setQaModalProvider] = useState(null);
  const [qaQuestionsList, setQaQuestionsList] = useState([]);
  const [loadingQaQuestions, setLoadingQaQuestions] = useState(false);
  const [newQaText, setNewQaText] = useState('');
  const [submittingQa, setSubmittingQa] = useState(false);
  const [qaFeedback, setQaFeedback] = useState({ type: '', text: '' });

  // Solicitudes / coordinación de visita del residente
  const [myVisits, setMyVisits] = useState([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [visitModalProvider, setVisitModalProvider] = useState(null);
  const [visitFraction, setVisitFraction] = useState('');
  const [visitLot, setVisitLot] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [savingVisit, setSavingVisit] = useState(false);
  const [visitFeedback, setVisitFeedback] = useState({ type: '', text: '' });
  const [followupDrafts, setFollowupDrafts] = useState({});
  const [sendingFollowupId, setSendingFollowupId] = useState(null);
  // Disponibilidad viva del prestador dentro del modal "Solicitar Visita" (Fase 5.4)
  const [visitAvailability, setVisitAvailability] = useState(null);
  const [loadingVisitAvailability, setLoadingVisitAvailability] = useState(false);
  const [selectedVisitAvailDay, setSelectedVisitAvailDay] = useState('');

  // Emisión de pase QR vinculado a un prestador
  const [qrModalProvider, setQrModalProvider] = useState(null);
  const [fractionNumber, setFractionNumber] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [selectedVehiclePlate, setSelectedVehiclePlate] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [startTime, setStartTime] = useState(() =>
    toLocalDateTimeInput(new Date(Date.now() - 10 * 60 * 1000))
  );
  const [endTime, setEndTime] = useState(() =>
    toLocalDateTimeInput(new Date(Date.now() + 8 * 60 * 60 * 1000))
  );
  const [creatingPass, setCreatingPass] = useState(false);
  const [passFeedback, setPassFeedback] = useState({ type: '', text: '', qrToken: '' });
  const [copiedTokenId, setCopiedTokenId] = useState(null);

  // Modal de visualización QR y edición de pase vigente
  const [viewingQrPass, setViewingQrPass] = useState(null);
  const [editingPass, setEditingPass] = useState(null);
  const [editPassPlate, setEditPassPlate] = useState('');
  const [editPassEmployeeIds, setEditPassEmployeeIds] = useState([]);
  const [editPassStart, setEditPassStart] = useState('');
  const [editPassEnd, setEditPassEnd] = useState('');
  const [savingPassEdit, setSavingPassEdit] = useState(false);
  const [editPassFeedback, setEditPassFeedback] = useState({ type: '', text: '' });

  // Listado y gestión de Pases QR emitidos
  const [myPasses, setMyPasses] = useState([]);
  const [loadingPasses, setLoadingPasses] = useState(false);
  const [passSearch, setPassSearch] = useState('');
  const [passStatusFilter, setPassStatusFilter] = useState('all');
  const [passesPage, setPassesPage] = useState(1);
  const [cancellingPassId, setCancellingPassId] = useState(null);
  const [passListFeedback, setPassListFeedback] = useState({ type: '', text: '' });

  // Contratos / Pagos / Nueva Orden desde Pase QR / Conformidad / Comprobante / Reclamos
  const [contracts, setContracts] = useState([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [gatewayConfig, setGatewayConfig] = useState({
    gateway_mode: 'mock',
    sandbox: false,
    platform_fee_percent: 7,
  });
  const [showNewOrderForm, setShowNewOrderForm] = useState(false);
  const [orderPassId, setOrderPassId] = useState('');
  const [orderDescription, setOrderDescription] = useState('');
  const [orderAmount, setOrderAmount] = useState('');
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [payingContractId, setPayingContractId] = useState(null);
  const [completingContractId, setCompletingContractId] = useState(null);
  const [loadingReceiptId, setLoadingReceiptId] = useState(null);
  const [receiptModalData, setReceiptModalData] = useState(null);
  const [disputeModalContract, setDisputeModalContract] = useState(null);
  const [disputeReason, setDisputeReason] = useState('Trabajo incompleto o con fallas');
  const [disputeDetails, setDisputeDetails] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [paymentFeedback, setPaymentFeedback] = useState({ type: '', text: '' });

  // Reseñas y reputación cruzada (con micro-tags tocables por contrato)
  const [reviewContracts, setReviewContracts] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [ratingByContract, setRatingByContract] = useState({});
  const [commentByContract, setCommentByContract] = useState({});
  const [reviewTagsByContract, setReviewTagsByContract] = useState({});
  const [submittingReviewId, setSubmittingReviewId] = useState(null);
  const [reviewFeedback, setReviewFeedback] = useState({ type: '', text: '' });

  // Estilos dinámicos por zona provistos por BrandingContext con valores de respaldo
  const primaryColor = brand?.primaryActionColor || '#059669';

  const cardStyle = {
    backgroundColor: brand?.cardBgColor || '#020617',
    color: brand?.cardTextColor || '#F1F5F9',
  };

  const innerStyle = {
    backgroundColor: brand?.innerBgColor || '#0F172A',
    color: brand?.innerTextColor || '#E2E8F0',
  };

  /**
   * Genera las cabeceras HTTP estándar para peticiones JSON autenticadas con JWT.
   *
   * @returns {{ 'Content-Type': string, Authorization: string }} Cabeceras de solicitud.
   */
  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
  });

  /**
   * Consulta el directorio de prestadores verificados disponibles para el residente,
   * incluyendo especialidades, calificación, vehículos, cuadrilla y estado documental.
   *
   * @returns {Promise<void>}
   */
  const fetchVerifiedProviders = async () => {
    setLoadingProviders(true);
    setProvidersError('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/directory`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setProviders(data.providers || []);
      } else {
        setProvidersError(data.error || 'No se pudo cargar el directorio de prestadores.');
      }
    } catch (error) {
      console.error('Error al cargar directorio de prestadores:', error);
      setProvidersError('Error de conexión con el servidor backend de TrustLink.');
    } finally {
      setLoadingProviders(false);
    }
  };

  /**
   * Obtiene las solicitudes de visita creadas por el residente junto con su estado
   * de confirmación e historial de mensajes intercambiados con cada prestador.
   *
   * @returns {Promise<void>}
   */
  const fetchMyVisits = async () => {
    setLoadingVisits(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/visit-requests/my`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setMyVisits(data.visits || []);
      }
    } catch (error) {
      console.error('Error al cargar visitas del residente:', error);
    } finally {
      setLoadingVisits(false);
    }
  };

  /**
   * Recupera todos los Pases QR emitidos por el residente (vigentes, utilizados,
   * vencidos y cancelados) para su gestión y consulta.
   *
   * @returns {Promise<void>}
   */
  const fetchMyPasses = async () => {
    setLoadingPasses(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/my`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setMyPasses(data.passes || data.items || []);
      }
    } catch (error) {
      console.error('Error al cargar pases emitidos:', error);
    } finally {
      setLoadingPasses(false);
    }
  };

  /**
   * Consulta la configuración activa de la pasarela de pagos (`mock` / `mercadopago`, sandbox y
   * porcentaje de comisión de plataforma) para reflejarla en el Paso 4.
   *
   * @returns {Promise<void>}
   */
  const fetchGatewayConfig = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/payments/config`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
      });
      const data = await response.json();
      if (response.ok && data) {
        setGatewayConfig({
          gateway_mode: data.gateway_mode || 'mock',
          sandbox: Boolean(data.sandbox),
          platform_fee_percent: Number(data.platform_fee_percent ?? 7),
        });
      }
    } catch {
      // Mantiene configuración segura por defecto
    }
  };

  /**
   * Carga los contratos y órdenes de pago vinculados al residente para gestionar
   * pagos, conformidades, comprobantes y reclamos.
   *
   * @returns {Promise<void>}
   */
  const fetchContractsData = async () => {
    setLoadingContracts(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/contracts`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setContracts(data.contracts || data.items || []);
      }
    } catch (error) {
      console.error('Error al cargar contratos:', error);
    } finally {
      setLoadingContracts(false);
    }
  };

  /**
   * Obtiene los contratos habilitados para reseña cruzada en el portal residente
   * e inicializa los mapas locales de puntaje y comentario por contrato.
   *
   * @returns {Promise<void>}
   */
  const fetchReviewsData = async () => {
    setLoadingReviews(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/reviews/contracts?portal=resident`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        const list = data.contracts || data.items || [];
        setReviewContracts(list);
        const initialRatings = {};
        const initialComments = {};
        list.forEach((c) => {
          const cid = c.contract_id ?? c.id;
          initialRatings[cid] = c.provider_review_rating || 5;
          initialComments[cid] = c.provider_review_comment || '';
        });
        setRatingByContract(initialRatings);
        setCommentByContract(initialComments);
      }
    } catch (error) {
      console.error('Error al cargar contratos para reseñas:', error);
    } finally {
      setLoadingReviews(false);
    }
  };

  // Carga inicial paralela de todos los módulos del Portal Residente al montar el componente
  useEffect(() => {
    fetchVerifiedProviders();
    fetchMyVisits();
    fetchMyPasses();
    fetchGatewayConfig();
    fetchContractsData();
    fetchReviewsData();
  }, []);

  // Consulta la disponibilidad viva de 7 días (sin datos privados) al abrir el modal "Solicitar Visita"
  useEffect(() => {
    const providerUserId = Number(visitModalProvider?.user_id);
    if (!providerUserId) {
      setVisitAvailability(null);
      setSelectedVisitAvailDay('');
      return;
    }

    let cancelled = false;
    const loadAvailability = async () => {
      setLoadingVisitAvailability(true);
      try {
        const tzOffset = new Date().getTimezoneOffset();
        const res = await fetch(
          `${API_BASE}/api/v1/passes/schedule/availability/${providerUserId}?days=7&tz_offset=${tzOffset}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
            },
          }
        );
        const data = await res.json();
        if (!cancelled && res.ok && Array.isArray(data.days)) {
          setVisitAvailability(data);
          const firstWithSlots =
            data.days.find((d) => d.is_working && d.available_count > 0) ||
            data.days.find((d) => d.is_working) ||
            data.days[0];
          setSelectedVisitAvailDay(firstWithSlots?.date || '');
        }
      } catch (error) {
        console.error('Error al consultar disponibilidad del prestador:', error);
      } finally {
        if (!cancelled) setLoadingVisitAvailability(false);
      }
    };

    loadAvailability();
    return () => {
      cancelled = true;
    };
  }, [visitModalProvider]);

  // Detecta retorno desde Mercado Pago Checkout Pro (?mp_status=...&contract_id=...), abre Paso 4 y limpia la URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const mpStatus = (params.get('mp_status') || params.get('collection_status') || '').toLowerCase();
      const returnedContractId = params.get('contract_id') || '';
      if (!mpStatus) return;

      setActiveStep('payments');
      const labelSuffix = returnedContractId ? ` (Contrato #${returnedContractId})` : '';
      if (mpStatus === 'approved') {
        setPaymentFeedback({
          type: 'success',
          text: `Pago aprobado en Mercado Pago${labelSuffix}. Estamos confirmando la acreditación en TrustLink.`,
        });
      } else if (mpStatus === 'pending' || mpStatus === 'in_process') {
        setPaymentFeedback({
          type: 'success',
          text: `Pago pendiente de acreditación en Mercado Pago${labelSuffix}. Te actualizaremos el estado automáticamente al recibir la notificación.`,
        });
      } else {
        setPaymentFeedback({
          type: 'error',
          text: `El pago en Mercado Pago no se completó (${mpStatus})${labelSuffix}. Podés reintentar cuando quieras.`,
        });
      }

      params.delete('mp_status');
      params.delete('collection_status');
      params.delete('contract_id');
      const nextSearch = params.toString();
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
      window.history.replaceState({}, document.title, nextUrl);
    } catch {
      // Ignora URLs malformadas
    }
  }, []);

  // Pases elegibles para generar una orden de pago: excluye cancelados y prioriza Utilizados > Vigentes > Vencidos
  const eligibleOrderPasses = useMemo(() => {
    const priority = { used: 0, pending: 1, expired: 2 };
    return (myPasses || [])
      .filter((p) => String(p.status || '').toLowerCase() !== 'cancelled')
      .sort((a, b) => {
        const pa = priority[String(a.status || '').toLowerCase()] ?? 3;
        const pb = priority[String(b.status || '').toLowerCase()] ?? 3;
        if (pa !== pb) return pa - pb;
        return Number(b.id || 0) - Number(a.id || 0);
      });
  }, [myPasses]);

  /**
   * Abre el formulario "+ Nueva Orden de Pago" en el Paso 4 preseleccionando un Pase QR puntual.
   *
   * @param {Object} passItem - Pase QR desde el cual se generará la orden de pago.
   */
  const openNewOrderForPass = (passItem) => {
    if (passItem?.id) {
      setOrderPassId(String(passItem.id));
    }
    setPaymentFeedback({ type: '', text: '' });
    setShowNewOrderForm(true);
    setActiveStep('payments');
  };

  /**
   * Crea una nueva orden de pago asociada a un Pase QR de visita (`POST /api/v1/contracts`)
   * y actualiza el listado de contratos y reseñas en el Paso 4.
   *
   * @param {React.FormEvent<HTMLFormElement>} e - Evento de envío del formulario.
   * @returns {Promise<void>}
   */
  const handleCreateOrderFromPass = async (e) => {
    e.preventDefault();
    const selectedPass =
      eligibleOrderPasses.find((p) => String(p.id) === String(orderPassId)) ||
      eligibleOrderPasses[0] ||
      null;
    const numericAmount = Number(orderAmount);

    if (!selectedPass) {
      setPaymentFeedback({
        type: 'error',
        text: 'Emití primero un Pase QR en el Paso 3 para poder generar una orden de pago.',
      });
      return;
    }
    if (!orderDescription.trim() || Number.isNaN(numericAmount) || numericAmount <= 0) {
      setPaymentFeedback({
        type: 'error',
        text: 'Indicá la descripción del trabajo realizado y un monto acordado mayor a cero.',
      });
      return;
    }

    setCreatingOrder(true);
    setPaymentFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/v1/contracts`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          provider_id: selectedPass.provider_id,
          pass_id: selectedPass.id,
          description: orderDescription.trim(),
          agreed_amount: numericAmount,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setPaymentFeedback({
          type: 'success',
          text:
            data.message ||
            'Orden de pago generada correctamente. Ya podés confirmar el pago o registrar conformidad.',
        });
        setOrderDescription('');
        setOrderAmount('');
        setShowNewOrderForm(false);
        await Promise.all([fetchContractsData(), fetchReviewsData()]);
      } else {
        setPaymentFeedback({
          type: 'error',
          text: data.error || 'No se pudo crear la orden de pago.',
        });
      }
    } catch (error) {
      console.error('Error al crear orden de pago desde pase QR:', error);
      setPaymentFeedback({
        type: 'error',
        text: 'Error de conexión al crear la orden de pago.',
      });
    } finally {
      setCreatingOrder(false);
    }
  };

  // Índice rápido de la solicitud de visita más reciente por `provider_id` para mostrar su estado en el directorio
  const latestVisitByProvider = useMemo(() => {
    const map = {};
    myVisits.forEach((v) => {
      const pid = Number(v.provider_id);
      if (pid && !map[pid]) {
        map[pid] = v;
      }
    });
    return map;
  }, [myVisits]);

  // Lista deduplicada de especialidades combinando chips rápidos y todos los rubros habilitados en BD
  const availableSpecialties = useMemo(() => {
    const dbSpecialties = new Set();
    providers.forEach((p) => {
      getProviderSpecialties(p).forEach((spec) => {
        if (spec && spec !== 'Servicio Verificado') {
          dbSpecialties.add(spec);
        }
      });
    });

    const combined = ['Todos'];
    QUICK_SPECIALTIES.slice(1).forEach((s) => {
      if (!combined.includes(s)) combined.push(s);
    });
    dbSpecialties.forEach((s) => {
      if (!combined.some((existing) => existing.toLowerCase() === s.toLowerCase())) {
        combined.push(s);
      }
    });
    return combined;
  }, [providers]);

  // Sugerencias de búsqueda por síntoma/problema en tiempo real en el directorio
  const directorySearchSuggestions = useMemo(
    () => getSearchSuggestions(searchTerm),
    [searchTerm]
  );

  // Aplica filtros de especialidad (sobre todos los rubros del prestador), Socio Verificado, Favoritos, Disponible hoy, Urgencias 24h, búsqueda por síntomas y ordenamiento
  const filteredProviders = useMemo(() => {
    const selectedSpecLower = selectedSpecialty.toLowerCase();
    const list = providers.filter((p) => {
      const providerSpecs = getProviderSpecialties(p);

      const matchesSpecialty =
        selectedSpecialty === 'Todos' ||
        providerSpecs.some((spec) => spec.toLowerCase().includes(selectedSpecLower));

      const matchesMember = !onlyVerifiedMembers || Boolean(p.is_verified_member);
      const matchesFavorite = !onlyFavorites || Boolean(p.is_favorite);
      const matchesAvailableToday = !onlyAvailableToday || Boolean(p.available_today);
      const matchesEmergencies = !onlyEmergencies || Boolean(p.accepts_emergencies);
      const matchesQuery = matchesProviderQuery(p, searchTerm);

      return (
        matchesSpecialty &&
        matchesMember &&
        matchesFavorite &&
        matchesAvailableToday &&
        matchesEmergencies &&
        matchesQuery
      );
    });

    return [...list].sort((a, b) => {
      if (directorySortBy === 'reputation') {
        return Number(b.reputation?.score || 0) - Number(a.reputation?.score || 0);
      }
      if (directorySortBy === 'rating') {
        return Number(b.rating_avg || 0) - Number(a.rating_avg || 0);
      }
      if (directorySortBy === 'jobs') {
        return Number(b.total_jobs ?? b.completed_jobs ?? 0) - Number(a.total_jobs ?? a.completed_jobs ?? 0);
      }
      const memberDiff = Number(Boolean(b.is_verified_member)) - Number(Boolean(a.is_verified_member));
      if (memberDiff !== 0) return memberDiff;
      const repDiff = Number(b.reputation?.score || 0) - Number(a.reputation?.score || 0);
      if (repDiff !== 0) return repDiff;
      return Number(b.rating_avg || 0) - Number(a.rating_avg || 0);
    });
  }, [
    providers,
    searchTerm,
    selectedSpecialty,
    onlyVerifiedMembers,
    onlyFavorites,
    onlyAvailableToday,
    onlyEmergencies,
    directorySortBy,
  ]);

  /**
   * Abre el modal de Preguntas y Respuestas públicas (Q&A) de un prestador y carga
   * el historial comunitario desde `GET /api/v1/providers/:providerUserId/questions`.
   *
   * @param {Object} provider - Prestador seleccionado en el directorio.
   * @returns {Promise<void>}
   */
  const handleOpenProviderQa = async (provider) => {
    const providerUserId = Number(provider?.user_id);
    if (!providerUserId) return;
    setQaModalProvider(provider);
    setQaQuestionsList([]);
    setNewQaText('');
    setQaFeedback({ type: '', text: '' });
    setLoadingQaQuestions(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/providers/${providerUserId}/questions`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setQaQuestionsList(data.questions || []);
      }
    } catch (error) {
      console.error('Error al consultar Q&A del prestador:', error);
    } finally {
      setLoadingQaQuestions(false);
    }
  };

  /**
   * Publica una nueva pregunta pública en la ficha del prestador abierto en el modal Q&A.
   *
   * @param {React.FormEvent<HTMLFormElement>} e - Evento de envío del formulario Q&A.
   * @returns {Promise<void>}
   */
  const handleSubmitPublicQuestion = async (e) => {
    e.preventDefault();
    if (!qaModalProvider) return;
    const providerUserId = Number(qaModalProvider.user_id);
    const cleanQ = newQaText.trim();
    if (cleanQ.length < 5) {
      setQaFeedback({ type: 'error', text: 'Escribí al menos 5 caracteres para tu consulta.' });
      return;
    }
    setSubmittingQa(true);
    setQaFeedback({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE}/api/v1/providers/${providerUserId}/questions`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ question: cleanQ }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNewQaText('');
        setQaFeedback({
          type: 'success',
          text: data.message || 'Pregunta publicada. Cuando responda el prestador quedará visible.',
        });
        await handleOpenProviderQa(qaModalProvider);
        fetchVerifiedProviders();
      } else {
        setQaFeedback({ type: 'error', text: data.error || 'No se pudo publicar la pregunta.' });
      }
    } catch (error) {
      console.error('Error al publicar pregunta pública:', error);
      setQaFeedback({ type: 'error', text: 'Error de conexión al enviar tu consulta.' });
    } finally {
      setSubmittingQa(false);
    }
  };

  /**
   * Alterna un prestador en "Mis prestadores de confianza" (favoritos) con actualización optimista
   * y persistencia en `/api/v1/providers/favorites/:providerUserId`.
   *
   * @param {Object} provider - Registro del prestador en el directorio.
   * @returns {Promise<void>}
   */
  const handleToggleFavorite = async (provider) => {
    const providerUserId = Number(provider?.user_id);
    if (!providerUserId || togglingFavoriteUserId === providerUserId) return;

    const nextFav = !provider.is_favorite;
    setTogglingFavoriteUserId(providerUserId);
    // Actualización optimista para respuesta inmediata en el directorio
    setProviders((prev) =>
      prev.map((item) =>
        Number(item.user_id) === providerUserId ? { ...item, is_favorite: nextFav } : item
      )
    );

    try {
      const res = await fetch(`${API_BASE}/api/v1/providers/favorites/${providerUserId}`, {
        method: nextFav ? 'POST' : 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        // Revertir estado optimista si el backend rechazó la operación
        setProviders((prev) =>
          prev.map((item) =>
            Number(item.user_id) === providerUserId ? { ...item, is_favorite: !nextFav } : item
          )
        );
      }
    } catch (error) {
      console.error('Error al actualizar prestador favorito:', error);
      setProviders((prev) =>
        prev.map((item) =>
          Number(item.user_id) === providerUserId ? { ...item, is_favorite: !nextFav } : item
        )
      );
    } finally {
      setTogglingFavoriteUserId(null);
    }
  };

  /**
   * Alterna un micro-tag en el borrador de calificación de un contrato del Paso 5.
   *
   * @param {number|string} contractId - Identificador del contrato.
   * @param {string} tag - Micro-tag del catálogo oficial.
   */
  const toggleReviewTag = (contractId, tag) => {
    setReviewTagsByContract((prev) => {
      const current = Array.isArray(prev[contractId]) ? prev[contractId] : [];
      const next = current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag];
      return { ...prev, [contractId]: next };
    });
  };

  /**
   * Flujo rápido "Volver a contratar" desde historial de pases o contratos:
   * busca al prestador en el directorio verificado y abre el modal de Pase QR precargando
   * su última patente utilizada; si ya no figura activo, filtra el directorio por su nombre.
   *
   * @param {number|string} targetProviderId - ID de perfil (`provider_id`) del prestador.
   * @param {string} [fallbackName=''] - Nombre de respaldo para búsqueda en directorio.
   * @param {string} [lastPlate=''] - Patente del último ingreso para precargar el pase.
   */
  const handleRehireProvider = (targetProviderId, fallbackName = '', lastPlate = '') => {
    const pid = Number(targetProviderId);
    const matched = providers.find(
      (p) =>
        Number(p.provider_id || p.id) === pid ||
        (Array.isArray(p.provider_ids) && p.provider_ids.map(Number).includes(pid))
    );
    if (matched) {
      openQrModalForProvider(matched, { vehiclePlate: lastPlate || '' });
      return;
    }
    setActiveStep('providers');
    if (fallbackName) {
      setSearchTerm(fallbackName);
    }
  };

  /**
   * Abre el modal de reputación de un prestador y consulta sus reseñas verificadas.
   *
   * @param {Object} provider - Objeto del prestador seleccionado en el directorio.
   * @returns {Promise<void>}
   */
  const handleOpenProviderReviews = async (provider) => {
    const pid = Number(provider.provider_id || provider.id);
    setReviewsModalProvider(provider);
    setProviderReviewsList([]);
    setReviewFilterTag('all');
    setReviewFilterMinStars(0);
    setLoadingProviderReviews(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/reviews/provider/${pid}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setProviderReviewsList(data.reviews || []);
      }
    } catch (error) {
      console.error('Error al consultar reseñas del prestador:', error);
    } finally {
      setLoadingProviderReviews(false);
    }
  };

  /**
   * Inicializa y abre el modal para solicitar/coordinar una visita con un prestador,
   * precargando la ubicación del residente y una fecha sugerida (+1 hora).
   *
   * @param {Object} provider - Prestador destinatario de la solicitud.
   */
  const openVisitModalForProvider = (provider) => {
    setVisitModalProvider(provider);
    setVisitFraction(user?.fraction_number || '');
    setVisitLot(user?.lot_number || '');
    setVisitDate(toLocalDateTimeInput(new Date(Date.now() + 60 * 60 * 1000)));
    setVisitNotes('');
    setVisitFeedback({ type: '', text: '' });
  };

  /**
   * Envía al backend la solicitud de coordinación de visita y actualiza el listado de visitas.
   *
   * @param {React.FormEvent<HTMLFormElement>} e - Evento de envío del formulario modal.
   * @returns {Promise<void>}
   */
  const handleSaveVisitCoordination = async (e) => {
    e.preventDefault();
    if (!visitModalProvider) return;
    const providerId = visitModalProvider.provider_id || visitModalProvider.id;

    setSavingVisit(true);
    setVisitFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/visit-requests`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          provider_id: providerId,
          fraction_number: visitFraction.trim() || null,
          lot_number: visitLot.trim() || null,
          preferred_date: visitDate || null,
          notes: visitNotes.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setVisitFeedback({
          type: 'success',
          text:
            data.message ||
            'Solicitud enviada al prestador. Podés seguir la confirmación en el paso 2. Visitas.',
        });
        await fetchMyVisits();
      } else {
        setVisitFeedback({
          type: 'error',
          text: data.error || 'No se pudo registrar la coordinación de la visita.',
        });
      }
    } catch (error) {
      console.error('Error al coordinar visita:', error);
      setVisitFeedback({
        type: 'error',
        text: 'Error de conexión con el servidor al registrar la visita.',
      });
    } finally {
      setSavingVisit(false);
    }
  };

  /**
   * Envía un mensaje de seguimiento dentro del hilo de una solicitud de visita existente
   * y recarga el historial para reflejar la conversación actualizada.
   *
   * @param {number|string} visitId - Identificador de la visita en curso.
   * @returns {Promise<void>}
   */
  const handleSendFollowupMessage = async (visitId) => {
    const text = String(followupDrafts[visitId] || '').trim();
    if (!text) return;
    setSendingFollowupId(visitId);
    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/visit-requests/${visitId}/messages`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ text }),
      });
      if (response.ok) {
        setFollowupDrafts((prev) => ({ ...prev, [visitId]: '' }));
        await fetchMyVisits();
      }
    } catch (error) {
      console.error('Error al enviar mensaje de seguimiento:', error);
    } finally {
      setSendingFollowupId(null);
    }
  };

  /**
   * Abre el modal de emisión de Pase QR para un prestador determinado,
   * precargando ubicación, primer vehículo registrado y una ventana horaria de 8 horas.
   *
   * @param {Object} provider - Prestador al que se le emitirá el pase.
   * @param {{ fraction?: string, lot?: string, preferredDate?: string }} [prefill={}] - Datos opcionales desde una visita previa.
   */
  const openQrModalForProvider = (provider, prefill = {}) => {
    setQrModalProvider(provider);
    setFractionNumber(prefill.fraction ?? user?.fraction_number ?? '');
    setLotNumber(prefill.lot ?? user?.lot_number ?? '');
    const providerVehicles = Array.isArray(provider?.vehicles) ? provider.vehicles : [];
    setSelectedVehiclePlate(prefill.vehiclePlate ?? providerVehicles[0]?.plate ?? '');
    setSelectedEmployeeIds([]);
    const baseStart = prefill.preferredDate
      ? new Date(prefill.preferredDate)
      : new Date(Date.now() - 10 * 60 * 1000);
    const validStart = Number.isNaN(baseStart.getTime())
      ? new Date(Date.now() - 10 * 60 * 1000)
      : baseStart;
    setStartTime(toLocalDateTimeInput(validStart));
    setEndTime(toLocalDateTimeInput(new Date(validStart.getTime() + 8 * 60 * 60 * 1000)));
    setPassFeedback({ type: '', text: '', qrToken: '' });
  };

  /**
   * Alterna la inclusión de un ayudante/miembro de cuadrilla al crear un nuevo Pase QR.
   *
   * @param {number} empId - ID del empleado del prestador.
   */
  const toggleCreateEmployeeId = (empId) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  /**
   * Alterna la inclusión de un ayudante/miembro de cuadrilla al editar un Pase QR vigente.
   *
   * @param {number} empId - ID del empleado del prestador.
   */
  const toggleEditEmployeeId = (empId) => {
    setEditPassEmployeeIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  /**
   * Precarga los datos de un Pase QR vigente (`pending`) y abre el modal de edición
   * para modificar patente, cuadrilla autorizada o rango horario.
   *
   * @param {Object} passItem - Pase QR seleccionado para edición.
   */
  const openEditPassModal = (passItem) => {
    setEditingPass(passItem);
    setEditPassPlate(passItem.vehicle_plate || '');
    const currentCrew = Array.isArray(passItem.authorized_employees)
      ? passItem.authorized_employees.map((e) => Number(e.id)).filter(Boolean)
      : [];
    setEditPassEmployeeIds(currentCrew);
    const parsedStart = passItem.start_time ? new Date(passItem.start_time) : new Date();
    const parsedEnd = passItem.end_time ? new Date(passItem.end_time) : new Date(Date.now() + 4 * 3600000);
    setEditPassStart(toLocalDateTimeInput(Number.isNaN(parsedStart.getTime()) ? new Date() : parsedStart));
    setEditPassEnd(toLocalDateTimeInput(Number.isNaN(parsedEnd.getTime()) ? new Date() : parsedEnd));
    setEditPassFeedback({ type: '', text: '' });
  };

  /**
   * Persiste los cambios de un Pase QR vigente mediante `PATCH /api/v1/passes/:id`
   * y actualiza el listado de pases emitidos.
   *
   * @param {React.FormEvent<HTMLFormElement>} e - Evento de envío del formulario de edición.
   * @returns {Promise<void>}
   */
  const handleSavePassEdit = async (e) => {
    e.preventDefault();
    if (!editingPass) return;
    setSavingPassEdit(true);
    setEditPassFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/${editingPass.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          fraction_number: user?.fraction_number || null,
          lot_number: user?.lot_number || null,
          vehicle_plate: editPassPlate.trim() ? editPassPlate.trim().toUpperCase() : null,
          employee_ids: editPassEmployeeIds,
          start_time: new Date(editPassStart).toISOString(),
          end_time: new Date(editPassEnd).toISOString(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setPassListFeedback({
          type: 'success',
          text: data.message || `Pase #${editingPass.id} actualizado correctamente.`,
        });
        setEditingPass(null);
        await fetchMyPasses();
      } else {
        setEditPassFeedback({
          type: 'error',
          text: data.error || 'No se pudo actualizar el pase QR.',
        });
      }
    } catch (error) {
      console.error('Error al editar pase QR:', error);
      setEditPassFeedback({
        type: 'error',
        text: 'Error de conexión con el servidor al actualizar el pase.',
      });
    } finally {
      setSavingPassEdit(false);
    }
  };

  /**
   * Valida y emite un nuevo Pase QR para el prestador seleccionado, incluyendo
   * patente opcional, cuadrilla autorizada y vigencia horaria, mostrando el QR generado.
   *
   * @param {React.FormEvent<HTMLFormElement>} e - Evento de envío del formulario de creación.
   * @returns {Promise<void>}
   */
  const handleCreatePassSubmit = async (e) => {
    e.preventDefault();
    if (!qrModalProvider) return;

    const providerId = qrModalProvider.provider_id || qrModalProvider.id;
    if (!providerId || !startTime || !endTime) {
      setPassFeedback({
        type: 'error',
        text: 'Completá el prestador, la fecha/hora de inicio y la fecha/hora de fin.',
        qrToken: '',
      });
      return;
    }

    setCreatingPass(true);
    setPassFeedback({ type: '', text: '', qrToken: '' });

    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/create`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          provider_id: providerId,
          fraction_number: fractionNumber.trim() || null,
          lot_number: lotNumber.trim() || null,
          vehicle_plate: selectedVehiclePlate.trim() ? selectedVehiclePlate.trim().toUpperCase() : null,
          employee_ids: selectedEmployeeIds,
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
        }),
      });

      const data = await response.json();
      if (response.ok) {
        const createdToken = data.pass?.qr_token || data.qr_token || '';
        setPassFeedback({
          type: 'success',
          text: data.message || 'Pase QR generado correctamente.',
          qrToken: createdToken,
        });
        await fetchMyPasses();
      } else {
        setPassFeedback({
          type: 'error',
          text: data.error || 'No se pudo emitir el pase QR.',
          qrToken: '',
        });
      }
    } catch (error) {
      console.error('Error al crear pase QR:', error);
      setPassFeedback({
        type: 'error',
        text: 'Error de conexión con el servidor al emitir el pase QR.',
        qrToken: '',
      });
    } finally {
      setCreatingPass(false);
    }
  };

  /**
   * Copia el token de un Pase QR al portapapeles del sistema y activa un indicador
   * visual temporal de confirmación sobre el botón correspondiente.
   *
   * @param {string} tokenValue - Token QR a copiar.
   * @param {string|number} idKey - Identificador de UI para mostrar el estado "Copiado".
   * @returns {Promise<void>}
   */
  const handleCopyToken = async (tokenValue, idKey) => {
    if (!tokenValue) return;
    try {
      await navigator.clipboard.writeText(tokenValue);
      setCopiedTokenId(idKey);
      setTimeout(() => setCopiedTokenId(null), 1800);
    } catch (err) {
      console.error('No se pudo copiar el token:', err);
    }
  };

  /**
   * Cancela un Pase QR pendiente mediante `PATCH /api/v1/passes/:id/cancel`,
   * registra feedback en el listado y refresca los pases del residente.
   *
   * @param {number|string} passId - Identificador del pase a cancelar.
   * @returns {Promise<void>}
   */
  const handleCancelPass = async (passId) => {
    setCancellingPassId(passId);
    setPassListFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/${passId}/cancel`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setPassListFeedback({
          type: 'success',
          text: data.message || `Pase #${passId} cancelado correctamente.`,
        });
        await fetchMyPasses();
      } else {
        setPassListFeedback({
          type: 'error',
          text: data.error || `No se pudo cancelar el pase #${passId} (HTTP ${response.status}).`,
        });
      }
    } catch (error) {
      console.error('Error al cancelar pase:', error);
      setPassListFeedback({
        type: 'error',
        text: 'Error de conexión con el servidor al intentar cancelar el pase.',
      });
    } finally {
      setCancellingPassId(null);
    }
  };

  // Filtra los pases emitidos por estado y por búsqueda textual (prestador, destino, token o ID)
  const filteredPasses = useMemo(() => {
    const q = passSearch.trim().toLowerCase();
    return myPasses.filter((passItem) => {
      const status = String(passItem.status || '').toLowerCase();
      const matchesStatus = passStatusFilter === 'all' || status === passStatusFilter;
      const providerLabel = String(passItem.provider_name || passItem.provider_id || '').toLowerCase();
      const destLabel = `${passItem.fraction_number || ''} ${passItem.lot_number || ''}`.toLowerCase();
      const tokenLabel = String(passItem.qr_token || '').toLowerCase();

      const matchesQuery =
        !q ||
        providerLabel.includes(q) ||
        destLabel.includes(q) ||
        tokenLabel.includes(q) ||
        String(passItem.id).includes(q);

      return matchesStatus && matchesQuery;
    });
  }, [myPasses, passSearch, passStatusFilter]);

  // Cálculo de páginas totales y porción de pases visibles en la página actual
  const totalPassPages = Math.max(1, Math.ceil(filteredPasses.length / PASSES_PER_PAGE));
  const paginatedPasses = useMemo(() => {
    const safePage = Math.min(passesPage, totalPassPages);
    const startIdx = (safePage - 1) * PASSES_PER_PAGE;
    return filteredPasses.slice(startIdx, startIdx + PASSES_PER_PAGE);
  }, [filteredPasses, passesPage, totalPassPages]);

  /**
   * Inicia el pago de un contrato pendiente. Si el backend devuelve una URL de checkout
   * externo (Mercado Pago), redirige al residente; caso contrario confirma el pago directo
   * y recarga contratos, reseñas y directorio.
   *
   * @param {number|string} contractId - Identificador del contrato a abonar.
   * @returns {Promise<void>}
   */
  const handlePayContract = async (contractId) => {
    setPayingContractId(contractId);
    setPaymentFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/v1/contracts/${contractId}/pay`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        if (data.requires_redirect && data.checkout_url) {
          setPaymentFeedback({
            type: 'success',
            text: data.message || 'Redirigiendo al checkout seguro de Mercado Pago...',
          });
          window.location.assign(data.checkout_url);
          return;
        }
        setPaymentFeedback({
          type: 'success',
          text: data.message || 'Pago confirmado y comisión registrada.',
        });
        await Promise.all([fetchContractsData(), fetchReviewsData(), fetchVerifiedProviders()]);
      } else {
        setPaymentFeedback({
          type: 'error',
          text: data.error || 'No se pudo procesar el pago del contrato.',
        });
      }
    } catch (error) {
      console.error('Error al pagar contrato:', error);
      setPaymentFeedback({
        type: 'error',
        text: 'Error de conexión al confirmar el pago.',
      });
    } finally {
      setPayingContractId(null);
    }
  };

  /**
   * Registra la conformidad del servicio para un contrato (en curso o acuerdo en efectivo)
   * mediante `PATCH /api/v1/contracts/:id/complete` y actualiza contratos y reseñas.
   *
   * @param {number|string} contractId - Identificador del contrato a finalizar con conformidad.
   * @returns {Promise<void>}
   */
  const handleCompleteContract = async (contractId) => {
    setCompletingContractId(contractId);
    setPaymentFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/v1/contracts/${contractId}/complete`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ completion_notes: 'Conformidad registrada desde Portal Residente' }),
      });
      const data = await response.json();
      if (response.ok) {
        setPaymentFeedback({
          type: 'success',
          text: data.message || `Conformidad registrada para el contrato #${contractId}.`,
        });
        await Promise.all([fetchContractsData(), fetchReviewsData()]);
      } else {
        setPaymentFeedback({
          type: 'error',
          text: data.error || 'No se pudo registrar la conformidad del servicio.',
        });
      }
    } catch (error) {
      console.error('Error al dar conformidad al contrato:', error);
      setPaymentFeedback({ type: 'error', text: 'Error de conexión al registrar conformidad.' });
    } finally {
      setCompletingContractId(null);
    }
  };

  /**
   * Consulta el Comprobante del Hogar oficial de un contrato y abre su modal de
   * visualización e impresión/exportación a PDF.
   *
   * @param {number|string} contractId - Identificador del contrato a consultar.
   * @returns {Promise<void>}
   */
  const handleOpenReceipt = async (contractId) => {
    setLoadingReceiptId(contractId);
    setPaymentFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/v1/contracts/${contractId}/receipt`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok && data.receipt) {
        setReceiptModalData(data.receipt);
      } else {
        setPaymentFeedback({
          type: 'error',
          text: data.error || 'No se pudo cargar el comprobante del servicio.',
        });
      }
    } catch (error) {
      console.error('Error al consultar comprobante:', error);
      setPaymentFeedback({ type: 'error', text: 'Error de conexión al generar el comprobante.' });
    } finally {
      setLoadingReceiptId(null);
    }
  };

  /**
   * Envía un reclamo o solicitud de garantía post-servicio asociado a un contrato
   * para mediación del equipo de Operaciones de TrustLink.
   *
   * @param {React.FormEvent<HTMLFormElement>} e - Evento de envío del formulario de reclamo.
   * @returns {Promise<void>}
   */
  const handleSubmitDispute = async (e) => {
    e.preventDefault();
    if (!disputeModalContract || !disputeReason.trim() || !disputeDetails.trim()) return;
    setSubmittingDispute(true);
    setPaymentFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/v1/contracts/${disputeModalContract.id}/dispute`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          reason: disputeReason.trim(),
          details: disputeDetails.trim(),
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setPaymentFeedback({
          type: 'success',
          text: data.message || 'Reclamo registrado correctamente para revisión de Operaciones.',
        });
        setDisputeModalContract(null);
        setDisputeDetails('');
        await fetchContractsData();
      } else {
        setPaymentFeedback({
          type: 'error',
          text: data.error || 'No se pudo registrar el reclamo.',
        });
      }
    } catch (error) {
      console.error('Error al registrar reclamo:', error);
      setPaymentFeedback({ type: 'error', text: 'Error de conexión al enviar el reclamo.' });
    } finally {
      setSubmittingDispute(false);
    }
  };

  /**
   * Registra la calificación y reseña del residente hacia el prestador de un contrato
   * y refresca el historial de reseñas junto con el rating promedio del directorio.
   *
   * @param {number|string} contractId - Identificador del contrato evaluado.
   * @returns {Promise<void>}
   */
  const handleSubmitProviderReview = async (contractId) => {
    setSubmittingReviewId(contractId);
    setReviewFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/v1/reviews/provider`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          contract_id: contractId,
          rating: Number(ratingByContract[contractId] || 5),
          comment: String(commentByContract[contractId] || '').trim(),
          tags: Array.isArray(reviewTagsByContract[contractId]) ? reviewTagsByContract[contractId] : [],
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setReviewFeedback({
          type: 'success',
          text: data.message || 'Calificación enviada y reputación actualizada.',
        });
        await Promise.all([fetchReviewsData(), fetchVerifiedProviders()]);
      } else {
        setReviewFeedback({
          type: 'error',
          text: data.error || 'No se pudo guardar la calificación.',
        });
      }
    } catch (error) {
      console.error('Error al enviar reseña:', error);
      setReviewFeedback({
        type: 'error',
        text: 'Error de conexión al enviar la calificación.',
      });
    } finally {
      setSubmittingReviewId(null);
    }
  };

  // Contador de contratos con pago pendiente para el acceso rápido en la cabecera del portal
  const pendingContractsCount = contracts.filter(
    (c) => String(c.status || '').toLowerCase() === 'pending'
  ).length;

  // Definición del flujo guiado de 5 pasos con sus contadores e íconos respectivos
  const steps = [
    {
      id: 'providers',
      stepNumber: 1,
      label: 'Prestadores',
      count: filteredProviders.length,
      icon: Users,
    },
    {
      id: 'visits',
      stepNumber: 2,
      label: 'Visitas',
      count: myVisits.length,
      icon: Calendar,
    },
    {
      id: 'passes',
      stepNumber: 3,
      label: 'Pases QR',
      count: myPasses.length,
      icon: QrCode,
    },
    {
      id: 'payments',
      stepNumber: 4,
      label: 'Visitas y Pagos',
      count: contracts.length,
      icon: CreditCard,
    },
    {
      id: 'reviews',
      stepNumber: 5,
      label: 'Reseñas',
      count: reviewContracts.length,
      icon: MessageSquare,
    },
  ];

  return (
    <div className={PAGE_SHELL_CLASS}>
      {/* Cabecera principal del Portal Residente con alerta de pagos pendientes y refresco global */}
      <div
        className="rounded-2xl p-5 sm:p-6 border border-white/10 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        style={cardStyle}
      >
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
            <ShieldCheck size={14} />
            <span>Portal Residente</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Users size={20} className="text-emerald-400 shrink-0" />
            <span>Servicios verificados y pases de ingreso</span>
          </h1>
          <p className="text-xs sm:text-sm opacity-80">
            Coordiná disponibilidad con el prestador, confirmá visitas, emití pases QR y gestioná pagos y reseñas.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {pendingContractsCount > 0 && (
            <button
              type="button"
              onClick={() => setActiveStep('payments')}
              className="text-xs font-bold px-3 py-2 rounded-xl border border-amber-500/40 bg-amber-950/50 text-amber-200 cursor-pointer hover:opacity-90"
            >
              {pendingContractsCount} pago(s) pendiente(s)
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              fetchVerifiedProviders();
              fetchMyVisits();
              fetchMyPasses();
              fetchContractsData();
              fetchReviewsData();
            }}
            className="p-2 rounded-xl border border-white/15 hover:opacity-90 cursor-pointer"
            style={innerStyle}
            title="Actualizar información del portal"
          >
            <RefreshCw size={15} className={loadingProviders ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Selector de pasos alineado */}
      <div
        className="rounded-2xl p-2 border border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2"
        style={cardStyle}
      >
        {steps.map((step) => {
          const IconComponent = step.icon;
          const isActive = activeStep === step.id;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setActiveStep(step.id)}
              className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                isActive
                  ? 'text-white border-transparent shadow-sm'
                  : 'border-slate-800/70 opacity-85 hover:opacity-100'
              }`}
              style={isActive ? { backgroundColor: primaryColor } : innerStyle}
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

      {/* PASO 1: DIRECTORIO DE PRESTADORES VERIFICADOS */}
      {activeStep === 'providers' && (
        <section className={SECTION_CARD_CLASS} style={cardStyle}>
          {/* Encabezado del directorio, buscador por texto y actualización manual */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Users size={18} className="text-emerald-400 shrink-0" />
                <span>Directorio de Prestadores Verificados</span>
              </h2>
              <p className="text-xs opacity-75">
                Consultá si ya lo contactaste, revisá el estado de confirmación y pasá a Visitas o Pases QR.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 md:w-72">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60 pointer-events-none"
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por rubro, nombre o problema (ej: pérdida de agua)..."
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
                    <X size={14} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  fetchVerifiedProviders();
                  fetchMyVisits();
                }}
                className="p-2 rounded-xl border border-white/15 hover:opacity-90 cursor-pointer"
                style={innerStyle}
                title="Actualizar directorio y visitas"
              >
                <RefreshCw size={15} className={loadingProviders ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Sello UX Hogar Protegido TrustLink (3 garantías antes de contratar) */}
          <HomeProtectedBadge variant="compact" />

          {/* Sugerencias inteligentes cuando el residente busca por síntoma o problema */}
          {directorySearchSuggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="font-semibold text-emerald-300">Rubros sugeridos:</span>
              {directorySearchSuggestions.map((sug) => (
                <button
                  key={sug.label}
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedSpecialty(
                      availableSpecialties.find(
                        (s) => s.toLowerCase() === sug.targetSpecialty.toLowerCase()
                      ) || 'Todos'
                    );
                    if (
                      !availableSpecialties.some(
                        (s) => s.toLowerCase() === sug.targetSpecialty.toLowerCase()
                      )
                    ) {
                      setSearchTerm(sug.targetSpecialty);
                    }
                  }}
                  className="px-2.5 py-0.5 rounded-full font-semibold border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 cursor-pointer"
                >
                  {sug.label} → <strong>{sug.targetSpecialty}</strong>
                </button>
              ))}
            </div>
          )}

          {/* Barra de filtros: chips de especialidades, Favoritos, Disponible hoy, Urgencias 24h, Socio Verificado y ordenamiento */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
            <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap">
              {availableSpecialties.map((spec) => {
                const active = selectedSpecialty === spec;
                return (
                  <button
                    key={spec}
                    type="button"
                    onClick={() => setSelectedSpecialty(spec)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap border ${
                      active
                        ? 'text-white border-transparent shadow-sm'
                        : 'border-white/15 opacity-80 hover:opacity-100'
                    }`}
                    style={active ? { backgroundColor: primaryColor } : innerStyle}
                  >
                    {spec}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setOnlyFavorites((prev) => !prev)}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-bold border transition-all cursor-pointer ${
                  onlyFavorites
                    ? 'border-rose-400/70 bg-rose-500/20 text-rose-200'
                    : 'border-white/15 opacity-80 hover:opacity-100'
                }`}
                style={onlyFavorites ? undefined : innerStyle}
              >
                <Heart size={12} className={onlyFavorites ? 'fill-rose-400 text-rose-400' : ''} />
                <span>Mis Favoritos</span>
              </button>

              <button
                type="button"
                onClick={() => setOnlyAvailableToday((prev) => !prev)}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-bold border transition-all cursor-pointer ${
                  onlyAvailableToday
                    ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200'
                    : 'border-white/15 opacity-80 hover:opacity-100'
                }`}
                style={onlyAvailableToday ? undefined : innerStyle}
              >
                <Zap size={12} />
                <span>Disponible hoy</span>
              </button>

              <button
                type="button"
                onClick={() => setOnlyEmergencies((prev) => !prev)}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-bold border transition-all cursor-pointer ${
                  onlyEmergencies
                    ? 'border-rose-400/70 bg-rose-500/20 text-rose-200'
                    : 'border-white/15 opacity-80 hover:opacity-100'
                }`}
                style={onlyEmergencies ? undefined : innerStyle}
              >
                <AlertCircle size={12} />
                <span>Urgencias 24h</span>
              </button>

              <button
                type="button"
                onClick={() => setOnlyVerifiedMembers((prev) => !prev)}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-bold border transition-all cursor-pointer ${
                  onlyVerifiedMembers
                    ? 'border-amber-400/70 bg-amber-500/20 text-amber-200'
                    : 'border-white/15 opacity-80 hover:opacity-100'
                }`}
                style={onlyVerifiedMembers ? undefined : innerStyle}
              >
                <Award size={12} />
                <span>Solo Socios Verificados</span>
              </button>

              <select
                value={directorySortBy}
                onChange={(e) => setDirectorySortBy(e.target.value)}
                aria-label="Ordenar prestadores"
                className="px-2.5 py-1 rounded-xl border border-white/15 text-xs font-semibold focus:outline-none"
                style={innerStyle}
              >
                <option value="featured">Orden: Destacados</option>
                <option value="reputation">Mejor reputación</option>
                <option value="rating">Mejor calificación</option>
                <option value="jobs">Más trabajos</option>
              </select>
            </div>
          </div>

          {/* Alerta de error al cargar el directorio */}
          {providersError && (
            <div className="rounded-xl p-4 border border-rose-800/70 bg-rose-950/50 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{providersError}</span>
            </div>
          )}

          {/* Estados de carga, sin resultados o grilla de tarjetas de prestadores */}
          {loadingProviders ? (
            <div
              className="rounded-xl p-8 border border-white/10 text-center text-xs opacity-75"
              style={innerStyle}
            >
              Cargando prestadores verificados...
            </div>
          ) : filteredProviders.length === 0 ? (
            <div
              className="rounded-xl p-8 border border-white/10 text-center space-y-2"
              style={innerStyle}
            >
              <p className="text-sm font-bold">No se encontraron prestadores con ese filtro</p>
              <p className="text-xs opacity-75">
                Probá limpiar el buscador o seleccionar otra especialidad.
              </p>
            </div>
          ) : (
            <div className={ITEMS_GRID_CLASS}>
              {filteredProviders.map((provider) => {
                const providerId = Number(provider.provider_id || provider.id);
                const fullName =
                  `${provider.first_name || ''} ${provider.last_name || ''}`.trim() ||
                  provider.email ||
                  'Prestador Verificado';
                const rating = Number(provider.rating_avg || 0).toFixed(1);
                const jobsCount = Number(provider.total_jobs ?? provider.completed_jobs ?? 0);
                const activeVisit = latestVisitByProvider[providerId];
                const visitMeta = getVisitStatusMeta(activeVisit);
                const isVerifiedMember = Boolean(provider.is_verified_member);
                const membershipBadgeLabel =
                  provider.membership_tier === 'verified_pro'
                    ? 'Socio Verificado Pro'
                    : 'Socio Verificado';
                const hasExpiredDocs = Boolean(provider.has_expired_docs);
                const isFavorite = Boolean(provider.is_favorite);
                const availableToday = Boolean(provider.available_today);
                const acceptsEmergencies = Boolean(provider.accepts_emergencies);
                const communityActivityCount = Number(provider.community_activity_count || 0);
                const topTags = Array.isArray(provider.top_tags) ? provider.top_tags : [];
                const paymentMethods = Array.isArray(provider.accepted_payment_methods)
                  ? provider.accepted_payment_methods
                  : [];
                const quotePolicyLabel =
                  provider.quote_visit_policy === 'sin_cargo'
                    ? 'Presupuesto sin cargo'
                    : provider.quote_visit_policy === 'arancelada'
                    ? 'Visita técnica arancelada'
                    : null;
                const invoiceLabel =
                  provider.invoice_type === 'factura_a'
                    ? 'Factura A'
                    : provider.invoice_type === 'factura_c'
                    ? 'Factura C'
                    : provider.invoice_type === 'ambas'
                    ? 'Factura A / C'
                    : provider.invoice_type === 'sin_factura'
                    ? 'Recibo común'
                    : null;

                // Ordena las especialidades habilitadas promoviendo primero la que coincide con el filtro activo
                const rawSpecialties = getProviderSpecialties(provider);
                const selectedFilterKey = selectedSpecialty.toLowerCase();
                const orderedSpecialties =
                  selectedSpecialty === 'Todos'
                    ? rawSpecialties
                    : [...rawSpecialties].sort((a, b) => {
                        const aMatch = a.toLowerCase().includes(selectedFilterKey) ? 0 : 1;
                        const bMatch = b.toLowerCase().includes(selectedFilterKey) ? 0 : 1;
                        return aMatch - bMatch;
                      });
                const visibleSpecialties = orderedSpecialties.slice(0, MAX_VISIBLE_CARD_SPECIALTIES);
                const extraSpecialties = orderedSpecialties.slice(MAX_VISIBLE_CARD_SPECIALTIES);

                return (
                  <article
                    key={providerId}
                    className={`${ITEM_CARD_CLASS} ${
                      isVerifiedMember ? 'border-amber-500/45 ring-1 ring-amber-500/20' : ''
                    }`}
                    style={innerStyle}
                  >
                    <div className="space-y-3">
                      {/* Fila superior: señales operativas (membresía, urgencias, disponibilidad) + favorito y calificación */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isVerifiedMember && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border border-amber-400/45 bg-amber-500/15 text-amber-200">
                              <Award size={11} className="text-amber-300 shrink-0" />
                              <span>{membershipBadgeLabel}</span>
                            </span>
                          )}
                          {acceptsEmergencies && !hasExpiredDocs && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border border-rose-400/50 bg-rose-500/15 text-rose-200">
                              <AlertCircle size={10} className="shrink-0" />
                              <span>Urgencias 24h</span>
                            </span>
                          )}
                          {!hasExpiredDocs && (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border ${
                                availableToday
                                  ? 'border-emerald-500/40 bg-emerald-950/50 text-emerald-200'
                                  : 'border-amber-500/40 bg-amber-950/40 text-amber-200'
                              }`}
                            >
                              <Zap size={10} className="shrink-0" />
                              <span>{availableToday ? 'Disponible hoy' : 'Agenda ocupada hoy'}</span>
                            </span>
                          )}
                          {hasExpiredDocs && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border border-rose-500/45 bg-rose-950/60 text-rose-200">
                              <AlertCircle size={11} className="text-rose-300 shrink-0" />
                              <span>Doc. vencida</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleFavorite(provider)}
                            disabled={togglingFavoriteUserId === Number(provider.user_id)}
                            title={isFavorite ? 'Quitar de Mis Favoritos' : 'Guardar en Mis Favoritos'}
                            aria-label={isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              isFavorite
                                ? 'border-rose-500/50 bg-rose-500/15 text-rose-300'
                                : 'border-white/15 opacity-75 hover:opacity-100'
                            }`}
                            style={isFavorite ? undefined : cardStyle}
                          >
                            <Heart size={13} className={isFavorite ? 'fill-rose-400 text-rose-400' : ''} />
                          </button>

                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border border-amber-500/30 bg-amber-500/10 text-amber-300">
                            <Star size={12} className="fill-amber-400 text-amber-400" />
                            {rating}
                          </span>
                        </div>
                      </div>

                      {/* Identidad, rubros habilitados, métricas y accesos a Reseñas y Q&A */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1.5">
                          <div>
                            <h3 className="text-sm font-bold leading-snug">{fullName}</h3>
                            <p className="text-xs opacity-75 mt-0.5">
                              {jobsCount} {jobsCount === 1 ? 'trabajo registrado' : 'trabajos registrados'}
                              {Array.isArray(provider.vehicles) && provider.vehicles.length > 0
                                ? ` · ${provider.vehicles.length} vehículo(s)`
                                : ''}
                            </p>
                          </div>

                          {/* Franja dedicada de especialidades habilitadas (máx. 3 chips + "+N más" con tooltip) */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {visibleSpecialties.map((spec) => {
                              const isHighlighted =
                                selectedSpecialty !== 'Todos' &&
                                spec.toLowerCase().includes(selectedFilterKey);
                              return (
                                <span
                                  key={spec}
                                  className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                                    isHighlighted
                                      ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200'
                                      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                  }`}
                                >
                                  {spec}
                                </span>
                              );
                            })}
                            {extraSpecialties.length > 0 && (
                              <span
                                title={`Otros rubros habilitados: ${extraSpecialties.join(', ')}`}
                                className="text-[11px] font-semibold px-2 py-0.5 rounded-md border border-white/15 opacity-85"
                                style={cardStyle}
                              >
                                +{extraSpecialties.length} más
                              </span>
                            )}
                          </div>

                          {provider.service_bio && (
                            <p className="text-[11px] opacity-85 line-clamp-2">
                              {provider.service_bio}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenProviderReviews(provider)}
                            className="text-[11px] font-bold underline underline-offset-2 opacity-85 hover:opacity-100 cursor-pointer"
                          >
                            Ver reseñas{Number(provider.reviews_count || 0) > 0 ? ` (${provider.reviews_count})` : ''}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenProviderQa(provider)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-300 hover:text-sky-200 cursor-pointer"
                          >
                            <HelpCircle size={11} />
                            <span>
                              Preguntas{Number(provider.public_questions_count || 0) > 0 ? ` (${provider.public_questions_count})` : ''}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Termómetro de reputación + tiempo de respuesta + actividad en tu barrio + ficha comercial */}
                      <div
                        className="rounded-xl p-3 text-xs space-y-2 border border-white/10"
                        style={cardStyle}
                      >
                        <ReputationThermometer reputation={provider.reputation} compact />

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                          {provider.response_label && (
                            <span className="inline-flex items-center gap-1 font-semibold text-sky-300">
                              <Clock size={11} className="shrink-0" />
                              <span>{provider.response_label}</span>
                            </span>
                          )}
                          {communityActivityCount > 0 && (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-300">
                              <MapPin size={11} className="shrink-0" />
                              <span>
                                {communityActivityCount}{' '}
                                {communityActivityCount === 1
                                  ? 'servicio/ingreso en tu barrio'
                                  : 'servicios/ingresos en tu barrio'}
                              </span>
                            </span>
                          )}
                        </div>

                        {(quotePolicyLabel || invoiceLabel || paymentMethods.length > 0) && (
                          <div className="flex flex-wrap gap-1 text-[10px]">
                            {quotePolicyLabel && (
                              <span
                                className="px-2 py-0.5 rounded-md border border-white/15 opacity-90"
                                style={innerStyle}
                              >
                                {quotePolicyLabel}
                              </span>
                            )}
                            {invoiceLabel && (
                              <span
                                className="px-2 py-0.5 rounded-md border border-white/15 opacity-90"
                                style={innerStyle}
                              >
                                {invoiceLabel}
                              </span>
                            )}
                            {paymentMethods.length > 0 && (
                              <span
                                className="px-2 py-0.5 rounded-md border border-white/15 opacity-85 capitalize"
                                style={innerStyle}
                              >
                                Pagos: {paymentMethods.join(', ')}
                              </span>
                            )}
                          </div>
                        )}

                        {topTags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {topTags.map((t) => (
                              <span
                                key={t.tag}
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                              >
                                {t.tag} · {t.count}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Estado limpio de contacto y confirmación */}
                      <div
                        className="rounded-xl p-3 text-xs space-y-1.5 border border-white/10"
                        style={cardStyle}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold opacity-80">Estado de visita:</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${visitMeta.badgeClass}`}
                          >
                            {visitMeta.label}
                          </span>
                        </div>
                        <p className="truncate opacity-80">
                          ✉️ {provider.email || '—'} · 📞 {provider.phone || 'Sin teléfono'}
                        </p>
                      </div>
                    </div>

                    {/* Acciones: Solicitar Visita / Ir a 2. Visitas + Generar QR */}
                    <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                      {activeVisit ? (
                        <button
                          type="button"
                          onClick={() => setActiveStep('visits')}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-white/15 transition-opacity hover:opacity-90 cursor-pointer"
                          style={cardStyle}
                        >
                          <Calendar size={13} className="text-emerald-400" />
                          <span>Ir a 2. Visitas</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openVisitModalForProvider(provider)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-white/15 transition-opacity hover:opacity-90 cursor-pointer"
                          style={cardStyle}
                        >
                          <MessageSquare size={13} />
                          <span>Solicitar Visita</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          openQrModalForProvider(provider, {
                            fraction: activeVisit?.fraction_number,
                            lot: activeVisit?.lot_number,
                            preferredDate: activeVisit?.preferred_date,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-95 cursor-pointer"
                        style={{ backgroundColor: primaryColor }}
                      >
                        <QrCode size={14} />
                        <span>{visitMeta.isConfirmed ? 'Emitir Pase QR' : 'Generar QR'}</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* PASO 2: VISITAS — CONFIRMACIÓN BIDIRECCIONAL Y SEGUIMIENTO */}
      {activeStep === 'visits' && (
        <section className={SECTION_CARD_CLASS} style={cardStyle}>
          {/* Encabezado de agenda de visitas y botón de refresco */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Calendar size={18} className="text-emerald-400 shrink-0" />
                <span>Visitas Solicitadas y Confirmación de Disponibilidad</span>
              </h2>
              <p className="text-xs opacity-75">
                Conversá con el prestador, verificá si confirmó disponibilidad y emití el Pase QR cuando esté acordada.
              </p>
            </div>

            <button
              type="button"
              onClick={fetchMyVisits}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-white/15 cursor-pointer self-start sm:self-auto"
              style={innerStyle}
            >
              <RefreshCw size={14} className={loadingVisits ? 'animate-spin' : ''} /> Actualizar
            </button>
          </div>

          {/* Estados de carga, agenda vacía o tarjetas de solicitudes de visita */}
          {loadingVisits ? (
            <p className="text-xs opacity-75 py-8 text-center">Cargando visitas...</p>
          ) : myVisits.length === 0 ? (
            <div
              className="rounded-xl p-8 text-center text-xs opacity-75 border border-white/10 space-y-2"
              style={innerStyle}
            >
              <p className="font-bold">Todavía no coordinaste visitas con prestadores.</p>
              <button
                type="button"
                onClick={() => setActiveStep('providers')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                Ir a 1. Prestadores
              </button>
            </div>
          ) : (
            <div className={ITEMS_GRID_CLASS}>
              {myVisits.map((visit) => {
                const meta = getVisitStatusMeta(visit);
                const msgs = Array.isArray(visit.messages) ? visit.messages : [];
                const matchedProvider = providers.find(
                  (p) => Number(p.provider_id || p.id) === Number(visit.provider_id)
                ) || {
                  id: visit.provider_id,
                  provider_id: visit.provider_id,
                  first_name: visit.provider_name || 'Prestador',
                  last_name: '',
                };

                return (
                  <article
                    key={visit.id}
                    className={ITEM_CARD_CLASS}
                    style={innerStyle}
                  >
                    <div className="space-y-3">
                      {/* Cabecera de la visita con destino, horario y estado de confirmación */}
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-sm">
                            Visita #{visit.id} · {visit.provider_name || `Prestador #${visit.provider_id}`}
                          </span>
                          <p className="opacity-80 mt-0.5">
                            Destino: {visit.fraction_number || '—'} / {visit.lot_number || '—'} ·
                            Horario: {visit.preferred_date ? formatDateTimeAR(visit.preferred_date) : 'A convenir'}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                      </div>

                      {/* Historial de mensajes intercambiados entre residente y prestador */}
                      {msgs.length > 0 && (
                        <div className="rounded-lg p-3 bg-black/25 border border-white/10 space-y-1.5 max-h-32 overflow-y-auto">
                          {msgs.map((m, idx) => (
                            <p key={m.id || idx} className="text-xs">
                              <strong className="uppercase text-[10px] opacity-75 mr-1.5">
                                {m.sender_role === 'provider' ? 'Prestador:' : 'Vos:'}
                              </strong>
                              <span>{m.text}</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Mensajería de seguimiento y botón directo para emitir Pase QR precargado */}
                    <div className="pt-3 border-t border-white/10 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={followupDrafts[visit.id] || ''}
                          onChange={(e) =>
                            setFollowupDrafts((prev) => ({
                              ...prev,
                              [visit.id]: e.target.value,
                            }))
                          }
                          placeholder="Escribí un mensaje para coordinar horario..."
                          className={`flex-1 ${FIELD_INPUT_CLASS}`}
                          style={cardStyle}
                        />

                        <button
                          type="button"
                          disabled={sendingFollowupId === visit.id}
                          onClick={() => handleSendFollowupMessage(visit.id)}
                          className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border border-white/15 cursor-pointer shrink-0"
                          style={cardStyle}
                        >
                          <Send size={13} /> Enviar
                        </button>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            openQrModalForProvider(matchedProvider, {
                              fraction: visit.fraction_number,
                              lot: visit.lot_number,
                              preferredDate: visit.preferred_date,
                            })
                          }
                          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <QrCode size={14} /> Emitir Pase QR
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* PASO 3: PASES QR EMITIDOS */}
      {activeStep === 'passes' && (
        <section className={SECTION_CARD_CLASS} style={cardStyle}>
          {/* Encabezado de Pases QR con buscador textual y filtro por estado */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <QrCode size={18} className="text-emerald-400 shrink-0" />
                <span>Mis Pases QR Emitidos</span>
              </h2>
              <p className="text-xs opacity-75">
                Consultá el estado de tus autorizaciones, compartí el QR vigente o cancelá pases pendientes.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={passSearch}
                onChange={(e) => {
                  setPassSearch(e.target.value);
                  setPassesPage(1);
                }}
                placeholder="Buscar por prestador, lote o token..."
                className={`w-full sm:w-64 ${FIELD_INPUT_CLASS}`}
                style={innerStyle}
              />
              <select
                value={passStatusFilter}
                onChange={(e) => {
                  setPassStatusFilter(e.target.value);
                  setPassesPage(1);
                }}
                className={FIELD_INPUT_CLASS}
                style={innerStyle}
              >
                <option value="all">Todos los estados</option>
                <option value="pending">Vigente</option>
                <option value="used">Utilizado</option>
                <option value="expired">Vencido</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          </div>

          {/* Feedback de acciones sobre el listado (edición o cancelación de pases) */}
          {passListFeedback.text && (
            <div
              className={`rounded-xl p-3 text-xs border flex items-center gap-2 ${
                passListFeedback.type === 'success'
                  ? 'border-emerald-700/70 bg-emerald-950/50 text-emerald-200'
                  : 'border-rose-800/70 bg-rose-950/50 text-rose-200'
              }`}
            >
              {passListFeedback.type === 'success' ? (
                <CheckCircle2 size={15} className="shrink-0" />
              ) : (
                <AlertCircle size={15} className="shrink-0" />
              )}
              <span>{passListFeedback.text}</span>
            </div>
          )}

          {/* Estados de carga, vacío o grilla paginada de Pases QR */}
          {loadingPasses ? (
            <p className="text-xs opacity-75 py-8 text-center">Cargando pases QR...</p>
          ) : paginatedPasses.length === 0 ? (
            <div
              className="rounded-xl p-8 text-center text-xs opacity-75 border border-white/10"
              style={innerStyle}
            >
              No hay pases QR que coincidan con el filtro seleccionado.
            </div>
          ) : (
            <div className={ITEMS_GRID_CLASS}>
              {paginatedPasses.map((item) => {
                const isPending = String(item.status || '').toLowerCase() === 'pending';
                const statusMeta = getUnifiedStatusMeta(item.status, 'pass');
                return (
                  <div
                    key={item.id}
                    className={ITEM_CARD_CLASS}
                    style={innerStyle}
                  >
                    {/* Detalles del pase: destino, vehículo/acceso, cuadrilla autorizada y vigencia */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold">
                          Pase #{item.id} · {item.provider_name || `Prestador #${item.provider_id}`}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border shrink-0 ${statusMeta.cls}`}
                        >
                          {statusMeta.label}
                        </span>
                      </div>

                      <p className="text-xs opacity-80">
                        Destino: {item.fraction_number || 'Sin fracción'} /{' '}
                        {item.lot_number || 'Sin lote'}
                      </p>
                      <p className="text-xs opacity-80 flex items-center gap-1.5">
                        <Car size={12} className="text-sky-400 shrink-0" />
                        <span>Acceso: {item.vehicle_plate || 'Ingreso peatonal'}</span>
                      </p>
                      {Array.isArray(item.authorized_employees) && item.authorized_employees.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <span className="text-[11px] font-semibold opacity-80 inline-flex items-center gap-1">
                            <Users size={11} className="text-emerald-400 shrink-0" /> Cuadrilla:
                          </span>
                          {item.authorized_employees.map((emp) => (
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
                      <p className="text-[11px] opacity-75">
                        Vigencia: {formatLocalDateTime(item.start_time)} →{' '}
                        {formatLocalDateTime(item.end_time)}
                      </p>
                    </div>

                    {/* Acciones sobre el token QR (copiar, ver QR, WhatsApp) y gestión de pases vigentes */}
                    <div className="space-y-2.5 pt-2 border-t border-white/10">
                      {item.qr_token && (
                        <div className="flex items-center justify-between gap-2 bg-black/25 px-2.5 py-1.5 rounded-lg border border-white/10">
                          <code className="text-[11px] truncate opacity-85">{item.qr_token}</code>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleCopyToken(item.qr_token, item.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer"
                            >
                              {copiedTokenId === item.id ? (
                                <>
                                  <Check size={12} className="text-emerald-400" /> Copiado
                                </>
                              ) : (
                                <>
                                  <Copy size={12} /> Copiar
                                </>
                              )}
                            </button>
                            {isPending && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setViewingQrPass(item)}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer"
                                  title="Mostrar código QR escaneable"
                                >
                                  <QrCode size={12} /> Ver QR
                                </button>
                                <a
                                  href={buildPassWhatsAppUrl(item)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded bg-emerald-700/90 hover:bg-emerald-600 text-white"
                                  title="Compartir pase QR y cuadrilla por WhatsApp"
                                >
                                  <Share2 size={12} /> WhatsApp
                                </a>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {isPending ? (
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => openEditPassModal(item)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-sky-300 hover:text-sky-200 cursor-pointer"
                          >
                            <Edit3 size={13} />
                            Editar pase
                          </button>
                          <button
                            type="button"
                            disabled={cancellingPassId === item.id}
                            onClick={() => handleCancelPass(item.id)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-rose-300 hover:text-rose-200 cursor-pointer disabled:opacity-50"
                          >
                            <Ban size={13} />
                            {cancellingPassId === item.id ? 'Cancelando...' : 'Cancelar pase'}
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <span className="opacity-70">Pase histórico ({statusMeta.label.toLowerCase()})</span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {String(item.status || '').toLowerCase() === 'used' && (
                              <button
                                type="button"
                                onClick={() => openNewOrderForPass(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-sky-200 border border-sky-500/40 bg-sky-950/40 hover:bg-sky-950/70 cursor-pointer"
                              >
                                <CreditCard size={11} /> Crear orden de pago
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                handleRehireProvider(
                                  item.provider_id,
                                  item.provider_name || '',
                                  item.vehicle_plate || ''
                                )
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-emerald-300 border border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-950/70 cursor-pointer"
                            >
                              <RotateCcw size={11} /> Volver a contratar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Paginación del listado de Pases QR */}
          {filteredPasses.length > PASSES_PER_PAGE && (
            <div className="flex items-center justify-between pt-2 text-xs">
              <span className="opacity-75">
                Página {Math.min(passesPage, totalPassPages)} de {totalPassPages} (
                {filteredPasses.length} pases)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={passesPage <= 1}
                  onClick={() => setPassesPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-700/80 font-bold disabled:opacity-40 cursor-pointer"
                  style={innerStyle}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={passesPage >= totalPassPages}
                  onClick={() => setPassesPage((p) => Math.min(totalPassPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-700/80 font-bold disabled:opacity-40 cursor-pointer"
                  style={innerStyle}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* PASO 4: VISITAS Y ÓRDENES DE PAGO / NUEVA ORDEN / CONFORMIDAD / COMPROBANTES / RECLAMOS */}
      {activeStep === 'payments' && (
        <section className={SECTION_CARD_CLASS} style={cardStyle}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <CreditCard size={18} className="text-emerald-400 shrink-0" />
                <span>Visitas y Órdenes de Pago</span>
              </h2>
              <p className="text-xs opacity-75">
                Generá órdenes desde tus pases QR, aboná con desglose transparente (
                {gatewayConfig.platform_fee_percent}% plataforma /{' '}
                {100 - gatewayConfig.platform_fee_percent}% prestador) y descargá comprobantes.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <span
                className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border ${
                  gatewayConfig.gateway_mode === 'mercadopago'
                    ? 'border-sky-500/40 bg-sky-950/50 text-sky-200'
                    : 'border-white/15 opacity-85'
                }`}
                style={gatewayConfig.gateway_mode === 'mercadopago' ? undefined : innerStyle}
              >
                {gatewayConfig.gateway_mode === 'mercadopago'
                  ? gatewayConfig.sandbox
                    ? 'Mercado Pago (Sandbox)'
                    : 'Mercado Pago Activo'
                  : 'Modo Piloto (Simulado)'}
              </span>

              <button
                type="button"
                onClick={() => {
                  if (!showNewOrderForm && !orderPassId && eligibleOrderPasses.length > 0) {
                    setOrderPassId(String(eligibleOrderPasses[0].id));
                  }
                  setShowNewOrderForm((prev) => !prev);
                }}
                className="text-white font-bold px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 transition-opacity hover:opacity-95 cursor-pointer shadow-sm"
                style={{ backgroundColor: primaryColor }}
              >
                {showNewOrderForm ? <X size={14} /> : <Plus size={14} />}
                <span>{showNewOrderForm ? 'Cerrar' : 'Nueva Orden de Pago'}</span>
              </button>
            </div>
          </div>

          {/* Sello UX Hogar Protegido TrustLink en el flujo de pagos y conformidad */}
          <HomeProtectedBadge variant="compact" />

          {/* Formulario desplegable: Generar Orden de Pago desde Visita / Pase QR */}
          {showNewOrderForm && (
            <form
              onSubmit={handleCreateOrderFromPass}
              className="rounded-xl p-4 border border-white/15 space-y-3 text-xs"
              style={innerStyle}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-bold">Generar Orden de Pago desde Pase QR</p>
                  <p className="text-[11px] opacity-75">
                    Seleccioná el pase de la visita realizada, detallá el trabajo y cargá el monto acordado.
                  </p>
                </div>
              </div>

              {eligibleOrderPasses.length === 0 ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-amber-500/35 bg-amber-950/25 text-amber-100">
                  <span>
                    Aún no tenés pases QR elegibles. Emití primero un pase en el Paso 3 o elegí un prestador en el Paso 1.
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveStep('passes')}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white cursor-pointer shrink-0"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Ir a Pases QR
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] opacity-80 mb-1">Pase QR / Prestador</label>
                      <select
                        value={orderPassId || String(eligibleOrderPasses[0]?.id || '')}
                        onChange={(e) => setOrderPassId(e.target.value)}
                        className={`w-full ${FIELD_INPUT_CLASS}`}
                        style={cardStyle}
                      >
                        {eligibleOrderPasses.map((pass) => {
                          const passStatusLabel = getUnifiedStatusMeta(pass.status, 'pass').label;
                          const providerName =
                            pass.provider_name || `Prestador #${pass.provider_id}`;
                          return (
                            <option key={pass.id} value={String(pass.id)}>
                              Pase #{pass.id} · {providerName} · {passStatusLabel}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] opacity-80 mb-1">Trabajo realizado</label>
                      <input
                        type="text"
                        required
                        maxLength={200}
                        value={orderDescription}
                        onChange={(e) => setOrderDescription(e.target.value)}
                        placeholder="Ej: Reparación de pérdida y revisión"
                        className={`w-full ${FIELD_INPUT_CLASS}`}
                        style={cardStyle}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] opacity-80 mb-1">Monto acordado ($)</label>
                      <input
                        type="number"
                        required
                        min="1"
                        step="0.01"
                        value={orderAmount}
                        onChange={(e) => setOrderAmount(e.target.value)}
                        placeholder="Ej: 45000"
                        className={`w-full ${FIELD_INPUT_CLASS}`}
                        style={cardStyle}
                      />
                    </div>
                  </div>

                  {Number(orderAmount) > 0 && (
                    <div className="flex flex-wrap items-center gap-3 text-[11px] px-3 py-2 rounded-lg border border-white/10 bg-black/20">
                      <span>
                        Comisión TrustLink ({gatewayConfig.platform_fee_percent}%):{' '}
                        <strong className="font-mono">
                          $
                          {(
                            (Number(orderAmount) * Number(gatewayConfig.platform_fee_percent || 7)) /
                            100
                          ).toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                        </strong>
                      </span>
                      <span>
                        Neto prestador ({100 - Number(gatewayConfig.platform_fee_percent || 7)}%):{' '}
                        <strong className="font-mono text-emerald-300">
                          $
                          {(
                            Number(orderAmount) -
                            (Number(orderAmount) * Number(gatewayConfig.platform_fee_percent || 7)) /
                              100
                          ).toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                        </strong>
                      </span>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowNewOrderForm(false)}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold border border-white/15 cursor-pointer hover:opacity-90"
                      style={cardStyle}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={creatingOrder}
                      className="text-white font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Plus size={13} />
                      {creatingOrder ? 'Creando orden...' : 'Crear Orden de Pago'}
                    </button>
                  </div>
                </>
              )}
            </form>
          )}

          {/* Feedback de pagos, conformidad, comprobantes y reclamos */}
          {paymentFeedback.text && (
            <div
              className={`rounded-xl p-3 text-xs border ${
                paymentFeedback.type === 'success'
                  ? 'border-emerald-700/70 bg-emerald-950/50 text-emerald-200'
                  : 'border-rose-800/70 bg-rose-950/50 text-rose-200'
              }`}
            >
              {paymentFeedback.text}
            </div>
          )}

          {/* Estados de carga, sin contratos o grilla de órdenes de pago */}
          {loadingContracts ? (
            <p className="text-xs opacity-75 py-8 text-center">Cargando contratos y pagos...</p>
          ) : contracts.length === 0 ? (
            <div
              className="rounded-xl p-8 text-center text-xs opacity-75 border border-white/10 space-y-3"
              style={innerStyle}
            >
              <p>
                No hay órdenes de pago registradas todavía. Usá &ldquo;+ Nueva Orden de Pago&rdquo;
                arriba o generá una orden desde tus Pases QR en el Paso 3.
              </p>
            </div>
          ) : (
            <div className={ITEMS_GRID_CLASS}>
              {contracts.map((contract) => {
                const totalAmount = Number(contract.agreed_amount || contract.amount || 0);
                const feePercent = Number(gatewayConfig.platform_fee_percent ?? 7);
                const feeAmount = Number(((totalAmount * feePercent) / 100).toFixed(2));
                const payoutAmount = Number((totalAmount - feeAmount).toFixed(2));
                const isPending = String(contract.status || '').toLowerCase() === 'pending';
                const isInProgress = String(contract.status || '').toLowerCase() === 'in_progress';
                const isCompleted = String(contract.status || '').toLowerCase() === 'completed';
                const hasOpenDispute = Number(contract.open_disputes_count || 0) > 0;
                const statusMeta = getUnifiedStatusMeta(contract.status, 'contract');

                return (
                  <div
                    key={contract.id}
                    className={ITEM_CARD_CLASS}
                    style={innerStyle}
                  >
                    {/* Resumen del contrato, badge de reclamo abierto y fecha de conformidad */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold">
                          Contrato #{contract.id} ·{' '}
                          {contract.provider_name || `Prestador #${contract.provider_id}`}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {hasOpenDispute && (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border border-rose-700/70 bg-rose-950/60 text-rose-200">
                              Reclamo abierto
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${statusMeta.cls}`}
                          >
                            {statusMeta.label}
                          </span>
                        </div>
                      </div>

                      {contract.description && (
                        <p className="text-xs opacity-85">{contract.description}</p>
                      )}
                      {contract.completed_at && (
                        <p className="text-[11px] text-emerald-300/90">
                          Conformidad registrada el {formatDateTimeAR(contract.completed_at)}
                        </p>
                      )}
                    </div>

                    {/* Desglose financiero (7% comisión / 93% neto) y acciones habilitadas según estado */}
                    <div className="space-y-3 pt-2 border-t border-white/10">
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="opacity-75">Monto acordado:</span>
                          <span className="font-bold font-mono">${totalAmount.toLocaleString('es-AR')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-75">Comisión TrustLink ({feePercent}%):</span>
                          <span className="font-mono">${feeAmount.toLocaleString('es-AR')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-75">Neto prestador ({100 - feePercent}%):</span>
                          <span className="font-semibold font-mono text-emerald-400">
                            ${payoutAmount.toLocaleString('es-AR')}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {isPending && (
                          <>
                            <button
                              type="button"
                              disabled={payingContractId === contract.id}
                              onClick={() => handlePayContract(contract.id)}
                              className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-95 cursor-pointer disabled:opacity-50"
                              style={{ backgroundColor: primaryColor }}
                            >
                              {payingContractId === contract.id
                                ? 'Procesando pago...'
                                : 'Confirmar y Pagar'}
                            </button>
                            <button
                              type="button"
                              disabled={completingContractId === contract.id}
                              onClick={() => handleCompleteContract(contract.id)}
                              className="py-2 px-3 rounded-xl text-xs font-bold border border-white/15 hover:opacity-90 cursor-pointer disabled:opacity-50"
                              style={cardStyle}
                              title="Registrar conformidad si abonaste en efectivo o acuerdo directo"
                            >
                              {completingContractId === contract.id ? 'Guardando...' : 'Conformidad (Efectivo)'}
                            </button>
                          </>
                        )}

                        {isInProgress && (
                          <button
                            type="button"
                            disabled={completingContractId === contract.id}
                            onClick={() => handleCompleteContract(contract.id)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-95 cursor-pointer disabled:opacity-50"
                            style={{ backgroundColor: primaryColor }}
                          >
                            <CheckCircle2 size={13} />
                            {completingContractId === contract.id ? 'Registrando...' : 'Dar Conformidad'}
                          </button>
                        )}

                        {(isInProgress || isCompleted) && (
                          <>
                            <button
                              type="button"
                              disabled={loadingReceiptId === contract.id}
                              onClick={() => handleOpenReceipt(contract.id)}
                              className="inline-flex items-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold border border-white/15 hover:opacity-90 cursor-pointer disabled:opacity-50"
                              style={cardStyle}
                            >
                              <FileText size={13} className="text-emerald-400" />
                              {loadingReceiptId === contract.id ? 'Cargando...' : 'Comprobante'}
                            </button>
                            {!hasOpenDispute && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDisputeModalContract(contract);
                                  setDisputeReason('Trabajo incompleto o con fallas');
                                  setDisputeDetails('');
                                }}
                                className="inline-flex items-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold border border-rose-800/60 bg-rose-950/35 text-rose-200 hover:bg-rose-950/60 cursor-pointer"
                              >
                                <AlertCircle size={13} />
                                Reclamo
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                handleRehireProvider(
                                  contract.provider_id,
                                  contract.provider_name || ''
                                )
                              }
                              className="inline-flex items-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold border border-emerald-500/40 bg-emerald-950/35 text-emerald-200 hover:bg-emerald-950/60 cursor-pointer"
                            >
                              <RotateCcw size={13} />
                              Volver a contratar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* PASO 5: RESEÑAS Y CALIFICACIÓN CRUZADA */}
      {activeStep === 'reviews' && (
        <section className={SECTION_CARD_CLASS} style={cardStyle}>
          <div>
            <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
              <MessageSquare size={18} className="text-emerald-400 shrink-0" />
              <span>Reseñas y Calificación Cruzada</span>
            </h2>
            <p className="text-xs opacity-75">
              Calificá a los prestadores por los trabajos realizados y consultá sus devoluciones.
            </p>
          </div>

          {/* Feedback de envío de calificación */}
          {reviewFeedback.text && (
            <div
              className={`rounded-xl p-3 text-xs border ${
                reviewFeedback.type === 'success'
                  ? 'border-emerald-700/70 bg-emerald-950/50 text-emerald-200'
                  : 'border-rose-800/70 bg-rose-950/50 text-rose-200'
              }`}
            >
              {reviewFeedback.text}
            </div>
          )}

          {/* Estados de carga, sin contratos calificables o tarjetas de reseñas cruzadas */}
          {loadingReviews ? (
            <p className="text-xs opacity-75 py-8 text-center">Cargando reseñas...</p>
          ) : reviewContracts.length === 0 ? (
            <div
              className="rounded-xl p-8 text-center text-xs opacity-75 border border-white/10"
              style={innerStyle}
            >
              Todavía no tenés contratos habilitados para calificar.
            </div>
          ) : (
            <div className={ITEMS_GRID_CLASS}>
              {reviewContracts.map((item) => {
                const cid = item.contract_id ?? item.id;
                const providerDisplay =
                  `${item.provider_first_name || ''} ${item.provider_last_name || ''}`.trim() ||
                  item.provider_name ||
                  `Prestador #${item.provider_id}`;
                const statusMeta = getUnifiedStatusMeta(
                  item.contract_status || item.status || 'pending',
                  'contract'
                );
                const alreadyRatedProvider = Boolean(item.provider_review_rating);

                return (
                  <div
                    key={cid}
                    className={ITEM_CARD_CLASS}
                    style={innerStyle}
                  >
                    {/* Datos del servicio y devolución recibida por parte del prestador */}
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-bold">
                          Servicio #{cid} · {providerDisplay}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border shrink-0 ${statusMeta.cls}`}
                        >
                          {statusMeta.label}
                        </span>
                      </div>

                      {item.description && <p className="text-xs opacity-80">{item.description}</p>}

                      {item.owner_review_rating && (
                        <div className="rounded-lg p-2.5 bg-emerald-950/30 border border-emerald-800/40 text-xs">
                          <span className="font-bold text-emerald-300">
                            Reseña del prestador: ★ {item.owner_review_rating}/5
                          </span>
                          {item.owner_review_comment && (
                            <p className="opacity-85 mt-0.5">“{item.owner_review_comment}”</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Calificación emitida por el residente o formulario interactivo con micro-tags */}
                    <div className="pt-2 border-t border-white/10">
                    {alreadyRatedProvider ? (
                      <div className="rounded-lg p-2.5 bg-emerald-950/30 border border-emerald-800/40 text-xs space-y-1.5">
                        <span className="font-bold text-emerald-300">
                          Tu calificación al prestador: ★ {item.provider_review_rating}/5
                        </span>
                        {item.provider_review_comment && (
                          <p className="opacity-85 mt-0.5">“{item.provider_review_comment}”</p>
                        )}
                        {Array.isArray(item.provider_review_tags) && item.provider_review_tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {item.provider_review_tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {/* Micro-tags tocables de experiencia rápida */}
                        <div className="flex flex-wrap gap-1.5">
                          {REVIEW_MICRO_TAGS.map((tag) => {
                            const selected = (reviewTagsByContract[cid] || []).includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => toggleReviewTag(cid, tag)}
                                className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                                  selected
                                    ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200'
                                    : 'border-white/15 opacity-75 hover:opacity-100'
                                }`}
                                style={selected ? undefined : cardStyle}
                              >
                                {selected ? '✓ ' : '+ '}
                                {tag}
                              </button>
                            );
                          })}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                          <select
                            value={ratingByContract[cid] ?? 5}
                            onChange={(e) =>
                              setRatingByContract((prev) => ({
                                ...prev,
                                [cid]: Number(e.target.value),
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
                            value={commentByContract[cid] ?? ''}
                            onChange={(e) =>
                              setCommentByContract((prev) => ({
                                ...prev,
                                [cid]: e.target.value,
                              }))
                            }
                            placeholder="Dejá un comentario sobre el servicio..."
                            className="sm:col-span-6 px-3 py-2 rounded-xl text-xs border border-slate-700/80"
                            style={cardStyle}
                          />

                          <button
                            type="button"
                            disabled={submittingReviewId === cid}
                            onClick={() => handleSubmitProviderReview(cid)}
                            className="sm:col-span-3 py-2 px-3 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                            style={{ backgroundColor: primaryColor }}
                          >
                            {submittingReviewId === cid ? 'Guardando...' : 'Enviar Reseña'}
                          </button>
                        </div>
                      </div>
                    )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Modal de Solicitud / Coordinación de Visita con Calendario Vivo de Disponibilidad */}
      {visitModalProvider && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div
            className="w-full max-w-lg rounded-2xl p-5 sm:p-6 border border-slate-700/80 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            style={cardStyle}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold">
                Solicitar Visita · {visitModalProvider.first_name} {visitModalProvider.last_name}
              </h3>
              <button
                type="button"
                onClick={() => setVisitModalProvider(null)}
                className="p-1 rounded-lg opacity-75 hover:opacity-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveVisitCoordination} className="space-y-3 text-xs">
              {/* Ubicación residencial tomada automáticamente del perfil del usuario */}
              <div
                className="rounded-xl p-3 border border-slate-700/80 flex items-center justify-between gap-2"
                style={innerStyle}
              >
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider opacity-70">
                    Ubicación residencial automática
                  </span>
                  <span className="font-bold">
                    {user?.lot_number
                      ? `${
                          user?.fraction_number
                            ? `${
                                user?.fraction_type === 'manzana'
                                  ? 'Manzana '
                                  : user?.fraction_type === 'fraccion'
                                  ? 'Fracción '
                                  : ''
                              }${user.fraction_number} · `
                            : ''
                        }Lote ${user.lot_number}`
                      : 'Sin Lote registrado en Mi Cuenta'}
                  </span>
                </div>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => {
                      setVisitModalProvider(null);
                      onNavigate('account');
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-white/15 cursor-pointer hover:opacity-90 shrink-0"
                    style={cardStyle}
                  >
                    {user?.lot_number ? 'Mi Cuenta' : 'Completar'}
                  </button>
                )}
              </div>

              {/* Calendario vivo de disponibilidad del prestador (7 días, franjas cada 30/60 min) */}
              <div className="rounded-xl p-3 border border-slate-700/80 space-y-2.5" style={innerStyle}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold flex items-center gap-1.5">
                    <Calendar size={13} className="text-emerald-400 shrink-0" />
                    <span>Disponibilidad en tiempo real</span>
                  </span>
                  {visitAvailability?.schedule_summary && (
                    <span className="text-[10px] opacity-75">
                      {visitAvailability.schedule_summary}
                    </span>
                  )}
                </div>

                {loadingVisitAvailability ? (
                  <p className="text-[11px] opacity-75 py-2">Consultando agenda del prestador...</p>
                ) : visitAvailability && Array.isArray(visitAvailability.days) ? (
                  (() => {
                    const selectedDayObj =
                      visitAvailability.days.find((d) => d.date === selectedVisitAvailDay) ||
                      visitAvailability.days[0];
                    return (
                      <div className="space-y-2.5">
                        {/* Tira horizontal de los próximos 7 días */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                          {visitAvailability.days.map((day) => {
                            const isPicked = selectedDayObj?.date === day.date;
                            const dayNum = String(day.date || '').split('-')[2] || '';
                            const monthNum = String(day.date || '').split('-')[1] || '';
                            return (
                              <button
                                key={day.date}
                                type="button"
                                onClick={() => setSelectedVisitAvailDay(day.date)}
                                className={`px-2.5 py-1.5 rounded-xl border text-left shrink-0 cursor-pointer transition-all ${
                                  isPicked
                                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                                    : day.is_working
                                    ? 'border-white/15 hover:border-white/30'
                                    : 'border-white/10 opacity-50'
                                }`}
                                style={isPicked ? undefined : cardStyle}
                              >
                                <div className="font-bold text-[11px] whitespace-nowrap">
                                  {day.short_label} {dayNum}/{monthNum}
                                </div>
                                <div className="text-[10px] opacity-80 whitespace-nowrap">
                                  {!day.is_working
                                    ? 'No atiende'
                                    : day.available_count > 0
                                    ? `${day.available_count} libres`
                                    : 'Completo'}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Franjas horarias del día seleccionado (clic para autocompletar fecha/hora) */}
                        {selectedDayObj && !selectedDayObj.is_working ? (
                          <p className="text-[11px] opacity-75">
                            El prestador no atiende los {selectedDayObj.day_label.toLowerCase()}. Elegí otro día arriba.
                          </p>
                        ) : selectedDayObj && selectedDayObj.slots.length > 0 ? (
                          <div className="space-y-1.5">
                            <p className="text-[10px] opacity-75">
                              Tocá un horario libre para proponer tu visita (horarios tachados ya están ocupados):
                            </p>
                            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                              {selectedDayObj.slots.map((slot) => {
                                const slotInputVal = `${selectedDayObj.date}T${slot.time}`;
                                const isChosen = visitDate === slotInputVal;
                                const isAvail = slot.status === 'available';
                                return (
                                  <button
                                    key={slot.start_iso}
                                    type="button"
                                    disabled={!isAvail}
                                    onClick={() => setVisitDate(slotInputVal)}
                                    className={`px-2 py-1 rounded-lg font-mono text-[11px] font-bold border transition-all ${
                                      isChosen
                                        ? 'border-emerald-300 text-white shadow-sm cursor-pointer'
                                        : isAvail
                                        ? 'border-emerald-500/35 bg-emerald-950/35 text-emerald-200 hover:border-emerald-400 cursor-pointer'
                                        : 'border-white/10 opacity-35 line-through cursor-not-allowed'
                                    }`}
                                    style={
                                      isChosen
                                        ? { backgroundColor: primaryColor }
                                        : !isAvail
                                        ? cardStyle
                                        : undefined
                                    }
                                    title={
                                      isAvail
                                        ? `Disponible de ${slot.time} a ${slot.end_time}`
                                        : slot.status === 'busy'
                                        ? 'Franja ocupada'
                                        : 'Horario pasado'
                                    }
                                  >
                                    {slot.time}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] opacity-75">
                            No hay franjas disponibles para este día.
                          </p>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-[11px] opacity-75">
                    Podés proponer tu horario preferido debajo para coordinar con el prestador.
                  </p>
                )}
              </div>

              {/* Fecha/hora sugerida (autocompletada al tocar una franja libre o editable manualmente) */}
              <div>
                <label className="block font-semibold mb-1 opacity-85">Fecha y hora propuesta</label>
                <input
                  type="datetime-local"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80"
                  style={innerStyle}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 opacity-85">
                  Consulta / disponibilidad a coordinar
                </label>
                <textarea
                  rows={3}
                  required
                  value={visitNotes}
                  onChange={(e) => setVisitNotes(e.target.value)}
                  placeholder="Ej: ¿Tenés disponibilidad mañana por la tarde para revisar el tablero?"
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80"
                  style={innerStyle}
                />
              </div>

              {/* Resultado del envío de la solicitud */}
              {visitFeedback.text && (
                <div
                  className={`rounded-xl p-3 border space-y-2 ${
                    visitFeedback.type === 'success'
                      ? 'border-emerald-700/70 bg-emerald-950/50 text-emerald-200'
                      : 'border-rose-800/70 bg-rose-950/50 text-rose-200'
                  }`}
                >
                  <p>{visitFeedback.text}</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVisitModalProvider(null)}
                  className="px-4 py-2 rounded-xl font-bold border border-slate-700/80 cursor-pointer"
                  style={innerStyle}
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={savingVisit}
                  className="px-4 py-2 rounded-xl font-bold text-white cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  {savingVisit ? 'Enviando...' : 'Enviar Solicitud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Emisión de Pase QR por Prestador */}
      {qrModalProvider && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div
            className="w-full max-w-md rounded-2xl p-6 border border-slate-700/80 shadow-2xl space-y-4"
            style={cardStyle}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold">
                Emitir Pase QR · {qrModalProvider.first_name} {qrModalProvider.last_name}
              </h3>
              <button
                type="button"
                onClick={() => setQrModalProvider(null)}
                className="p-1 rounded-lg opacity-75 hover:opacity-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePassSubmit} className="space-y-3 text-xs">
              {/* Garantía Hogar Protegido visible al emitir el Pase QR */}
              <HomeProtectedBadge variant="compact" />

              {/* Ubicación residencial bloqueada desde Mi Cuenta para evitar inconsistencias en garita */}
              <div
                className="rounded-xl p-3 border border-slate-700/80 flex items-center justify-between gap-2"
                style={innerStyle}
              >
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider opacity-70">
                    Ubicación residencial automática (bloqueada)
                  </span>
                  <span className="font-bold">
                    {user?.lot_number
                      ? `${
                          user?.fraction_number
                            ? `${
                                user?.fraction_type === 'manzana'
                                  ? 'Manzana '
                                  : user?.fraction_type === 'fraccion'
                                  ? 'Fracción '
                                  : ''
                              }${user.fraction_number} · `
                            : ''
                        }Lote ${user.lot_number}`
                      : 'Sin Lote registrado en Mi Cuenta'}
                  </span>
                </div>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => {
                      setQrModalProvider(null);
                      onNavigate('account');
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-white/15 cursor-pointer hover:opacity-90 shrink-0"
                    style={cardStyle}
                  >
                    {user?.lot_number ? 'Mi Cuenta' : 'Completar'}
                  </button>
                )}
              </div>

              {/* Selección de vehículo registrado o ingreso manual de patente / peatonal */}
              <div>
                <label className="block font-semibold mb-1 opacity-85">
                  Vehículo autorizado del prestador
                </label>
                {Array.isArray(qrModalProvider.vehicles) && qrModalProvider.vehicles.length > 0 ? (
                  <select
                    value={selectedVehiclePlate}
                    onChange={(e) => setSelectedVehiclePlate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-700/80"
                    style={innerStyle}
                  >
                    <option value="">Ingreso peatonal / sin vehículo</option>
                    {qrModalProvider.vehicles.map((v) => (
                      <option key={v.id || v.plate} value={v.plate}>
                        {v.brand} {v.model} ({v.vehicle_type || 'Vehículo'}) · {v.plate}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={selectedVehiclePlate}
                    onChange={(e) => setSelectedVehiclePlate(e.target.value.toUpperCase())}
                    placeholder="Opcional: patente (dejar vacío para ingreso peatonal)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-700/80 font-mono uppercase"
                    style={innerStyle}
                  />
                )}
              </div>

              {/* Selección opcional de cuadrilla / ayudantes del prestador con indicador de ART */}
              {Array.isArray(qrModalProvider.employees) && qrModalProvider.employees.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block font-semibold opacity-85">
                    Cuadrilla / Ayudantes que acompañan (opcional)
                  </label>
                  <div
                    className="rounded-xl p-2.5 border border-slate-700/80 max-h-36 overflow-y-auto space-y-1.5"
                    style={innerStyle}
                  >
                    {qrModalProvider.employees.map((emp) => {
                      const checked = selectedEmployeeIds.includes(emp.id);
                      const art = getCrewArtBadge(emp.insurance_expiry);
                      return (
                        <label
                          key={emp.id}
                          className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-black/20 cursor-pointer"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCreateEmployeeId(emp.id)}
                              className="rounded border-slate-600 accent-emerald-500"
                            />
                            <span className="truncate font-semibold">
                              {emp.full_name}
                              {emp.dni ? ` (DNI ${emp.dni})` : ''}
                            </span>
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${art.cls}`}
                          >
                            {art.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ventana horaria de validez del Pase QR */}
              <div>
                <label className="block font-semibold mb-1 opacity-85">Válido desde</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80"
                  style={innerStyle}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 opacity-85">Válido hasta</label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80"
                  style={innerStyle}
                />
              </div>

              {/* Feedback de emisión y vista previa del QR generado con botón de copia */}
              {passFeedback.text && (
                <div
                  className={`rounded-xl p-3 border space-y-2 ${
                    passFeedback.type === 'success'
                      ? 'border-emerald-700/70 bg-emerald-950/50 text-emerald-200'
                      : 'border-rose-800/70 bg-rose-950/50 text-rose-200'
                  }`}
                >
                  <p>{passFeedback.text}</p>
                  {passFeedback.qrToken && (
                    <div className="space-y-2.5 pt-1">
                      <QrCodeDisplay token={passFeedback.qrToken} size={160} />
                      <div className="flex items-center justify-between gap-2 bg-black/30 px-2.5 py-1.5 rounded-lg">
                        <code className="text-[11px] truncate">{passFeedback.qrToken}</code>
                        <button
                          type="button"
                          onClick={() => handleCopyToken(passFeedback.qrToken, 'modal-token')}
                          className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer shrink-0"
                        >
                          {copiedTokenId === 'modal-token' ? (
                            <>
                              <Check size={12} className="text-emerald-400" /> Copiado
                            </>
                          ) : (
                            <>
                              <Copy size={12} /> Copiar
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQrModalProvider(null)}
                  className="px-4 py-2 rounded-xl font-bold border border-slate-700/80 cursor-pointer"
                  style={innerStyle}
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={creatingPass}
                  className="px-4 py-2 rounded-xl font-bold text-white cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  {creatingPass ? 'Generando...' : 'Emitir Pase QR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para visualizar QR escaneable de un pase emitido */}
      {viewingQrPass && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div
            className="w-full max-w-md rounded-2xl p-6 border border-slate-700/80 shadow-2xl space-y-4 text-xs"
            style={cardStyle}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold">
                  Pase QR #{viewingQrPass.id} · {viewingQrPass.provider_name || `Prestador #${viewingQrPass.provider_id}`}
                </h3>
                <p className="opacity-75">
                  Destino: {viewingQrPass.fraction_number || '—'} / Lote {viewingQrPass.lot_number || '—'} ·{' '}
                  {viewingQrPass.vehicle_plate || 'Ingreso peatonal'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingQrPass(null)}
                className="p-1 rounded-lg opacity-75 hover:opacity-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Renderizado del código QR escaneable */}
            <QrCodeDisplay token={viewingQrPass.qr_token} size={200} />

            {/* Listado de integrantes de cuadrilla autorizados en el pase */}
            {Array.isArray(viewingQrPass.authorized_employees) &&
              viewingQrPass.authorized_employees.length > 0 && (
                <div
                  className="rounded-xl p-3 border border-slate-700/60 space-y-1.5"
                  style={innerStyle}
                >
                  <span className="block text-[10px] font-bold uppercase opacity-75">
                    Cuadrilla autorizada en este pase ({viewingQrPass.authorized_employees.length})
                  </span>
                  <div className="space-y-1">
                    {viewingQrPass.authorized_employees.map((emp) => (
                      <div key={emp.id || emp.dni || emp.full_name} className="flex items-center justify-between gap-2">
                        <span className="font-semibold">
                          {emp.full_name} {emp.dni ? `· DNI ${emp.dni}` : ''}
                        </span>
                        <span className="text-[10px] opacity-75">{emp.role_label || 'Ayudante'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Token seleccionable y acción rápida de envío por WhatsApp */}
            <div className="rounded-xl p-3 bg-black/25 border border-slate-700/60 space-y-1.5">
              <span className="block text-[10px] font-bold uppercase opacity-75">Token QR</span>
              <code className="block font-mono text-[11px] break-all select-all">
                {viewingQrPass.qr_token}
              </code>
            </div>

            <div className="flex items-center justify-between gap-2">
              <a
                href={buildPassWhatsAppUrl(viewingQrPass)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                <Share2 size={13} /> Compartir por WhatsApp
              </a>
              <button
                type="button"
                onClick={() => setViewingQrPass(null)}
                className="px-4 py-2 rounded-xl font-bold border border-slate-700/80 cursor-pointer"
                style={innerStyle}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para editar un pase QR vigente (pending) */}
      {editingPass && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div
            className="w-full max-w-md rounded-2xl p-6 border border-slate-700/80 shadow-2xl space-y-4 text-xs"
            style={cardStyle}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold">Editar Pase QR #{editingPass.id}</h3>
              <button
                type="button"
                onClick={() => setEditingPass(null)}
                className="p-1 rounded-lg opacity-75 hover:opacity-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePassEdit} className="space-y-3">
              {/* Campo editable de patente vehicular */}
              <div>
                <label className="block font-semibold mb-1 opacity-85">
                  Patente de vehículo (vacío = ingreso peatonal)
                </label>
                <input
                  type="text"
                  value={editPassPlate}
                  onChange={(e) => setEditPassPlate(e.target.value.toUpperCase())}
                  placeholder="Ej: AF123CD"
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 font-mono uppercase"
                  style={innerStyle}
                />
              </div>

              {/* Selección de cuadrilla buscando el prestador asociado en el directorio cargado */}
              {(() => {
                const matchedProvider = providers.find(
                  (p) =>
                    Number(p.provider_id || p.id) === Number(editingPass.provider_id) ||
                    (Array.isArray(p.provider_ids) &&
                      p.provider_ids.map(Number).includes(Number(editingPass.provider_id)))
                );
                const empList = Array.isArray(matchedProvider?.employees)
                  ? matchedProvider.employees
                  : [];
                if (empList.length === 0) return null;
                return (
                  <div className="space-y-1.5">
                    <label className="block font-semibold opacity-85">
                      Cuadrilla / Ayudantes autorizados
                    </label>
                    <div
                      className="rounded-xl p-2.5 border border-slate-700/80 max-h-36 overflow-y-auto space-y-1.5"
                      style={innerStyle}
                    >
                      {empList.map((emp) => {
                        const checked = editPassEmployeeIds.includes(Number(emp.id));
                        const art = getCrewArtBadge(emp.insurance_expiry);
                        return (
                          <label
                            key={emp.id}
                            className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-black/20 cursor-pointer"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleEditEmployeeId(Number(emp.id))}
                                className="rounded border-slate-600 accent-emerald-500"
                              />
                              <span className="truncate font-semibold">
                                {emp.full_name}
                                {emp.dni ? ` (DNI ${emp.dni})` : ''}
                              </span>
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${art.cls}`}
                            >
                              {art.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Modificación de la ventana horaria del pase vigente */}
              <div>
                <label className="block font-semibold mb-1 opacity-85">Válido desde</label>
                <input
                  type="datetime-local"
                  required
                  value={editPassStart}
                  onChange={(e) => setEditPassStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80"
                  style={innerStyle}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 opacity-85">Válido hasta</label>
                <input
                  type="datetime-local"
                  required
                  value={editPassEnd}
                  onChange={(e) => setEditPassEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80"
                  style={innerStyle}
                />
              </div>

              {editPassFeedback.text && (
                <div className="rounded-xl p-3 border border-rose-800/70 bg-rose-950/50 text-rose-200">
                  {editPassFeedback.text}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPass(null)}
                  className="px-4 py-2 rounded-xl font-bold border border-slate-700/80 cursor-pointer"
                  style={innerStyle}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPassEdit}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-white cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Save size={13} />
                  {savingPassEdit ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Comprobante del Hogar */}
      {receiptModalData && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div
            className="w-full max-w-xl rounded-2xl p-6 border border-slate-700/80 shadow-2xl space-y-4 text-xs max-h-[90vh] overflow-y-auto"
            style={cardStyle}
          >
            <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  Comprobante del Hogar · {receiptModalData.receipt_code}
                </p>
                <h3 className="text-base font-black mt-0.5">
                  Contrato #{receiptModalData.contract?.id} · {receiptModalData.provider?.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReceiptModalData(null)}
                className="p-1 rounded-lg opacity-75 hover:opacity-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Bloques de comunidad/destino y compliance documental del prestador */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-white/10 space-y-1" style={innerStyle}>
                <p className="font-bold text-emerald-300">Comunidad y Destino</p>
                <p>{receiptModalData.community?.name}</p>
                <p className="opacity-80">Titular: {receiptModalData.resident?.name}</p>
                <p className="opacity-80">
                  Destino:{' '}
                  {[
                    receiptModalData.resident?.fraction,
                    receiptModalData.resident?.lot ? `Lote ${receiptModalData.resident.lot}` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </p>
              </div>
              <div className="p-3 rounded-xl border border-white/10 space-y-1" style={innerStyle}>
                <p className="font-bold text-emerald-300">Prestador y Compliance</p>
                <p>
                  {receiptModalData.provider?.name} ({receiptModalData.provider?.specialty})
                </p>
                <p className="opacity-80">
                  DNI: {receiptModalData.provider?.dni || '—'} · Compliance:{' '}
                  {receiptModalData.provider?.compliance_status}
                </p>
                <p className="opacity-80">
                  ART vto:{' '}
                  {receiptModalData.provider?.insurance_expiry
                    ? new Date(receiptModalData.provider.insurance_expiry).toLocaleDateString('es-AR')
                    : 'Sin fecha'}
                </p>
              </div>
            </div>

            {/* Detalle del servicio ejecutado, conformidad y trazabilidad del Pase QR */}
            <div className="p-3 rounded-xl border border-white/10 space-y-1.5" style={innerStyle}>
              <p className="font-bold">Servicio y Conformidad</p>
              <p className="opacity-90">{receiptModalData.contract?.description}</p>
              <p className="opacity-80">
                Estado: <strong>{receiptModalData.contract?.status}</strong>
                {receiptModalData.contract?.completed_at
                  ? ` · Conformidad: ${formatDateTimeAR(receiptModalData.contract.completed_at)}`
                  : ''}
              </p>
              {receiptModalData.access_pass && (
                <p className="opacity-80 font-mono">
                  Pase QR #{receiptModalData.access_pass.id}:{' '}
                  {receiptModalData.access_pass.qr_token_masked} ({receiptModalData.access_pass.status})
                </p>
              )}
            </div>

            {/* Resumen económico del comprobante y acción de impresión / PDF */}
            <div className="p-3 rounded-xl border border-white/10 space-y-1" style={innerStyle}>
              <div className="flex justify-between">
                <span className="opacity-75">Monto acordado:</span>
                <span className="font-bold font-mono">
                  ${Number(receiptModalData.payment?.total_amount || 0).toLocaleString('es-AR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-75">Comisión TrustLink:</span>
                <span className="font-mono">
                  ${Number(receiptModalData.payment?.platform_fee || 0).toLocaleString('es-AR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-75">Neto prestador:</span>
                <span className="font-bold font-mono text-emerald-400">
                  ${Number(receiptModalData.payment?.provider_payout || 0).toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setReceiptModalData(null)}
                className="px-4 py-2 rounded-xl font-bold border border-white/15 cursor-pointer"
                style={innerStyle}
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => printServiceReceipt(receiptModalData)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-white cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                <Printer size={14} /> Imprimir / Guardar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reseñas verificadas del prestador (con filtros por micro-tag y estrellas) */}
      {reviewsModalProvider && (() => {
        const filteredModalReviews = providerReviewsList.filter((rev) => {
          const matchesStars =
            reviewFilterMinStars === 0
              ? true
              : reviewFilterMinStars === -3
              ? Number(rev.rating || 0) <= 3
              : Number(rev.rating || 0) >= reviewFilterMinStars;
          const matchesTag =
            reviewFilterTag === 'all' ||
            (Array.isArray(rev.tags) && rev.tags.includes(reviewFilterTag));
          return matchesStars && matchesTag;
        });

        return (
          <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
            <div
              className="w-full max-w-lg rounded-2xl p-6 border border-slate-700/80 shadow-2xl space-y-4 text-xs max-h-[85vh] overflow-y-auto"
              style={cardStyle}
            >
              <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                    Reputación Verificada
                  </p>
                  <h3 className="text-base font-black mt-0.5">
                    {reviewsModalProvider.first_name} {reviewsModalProvider.last_name} · ★{' '}
                    {Number(reviewsModalProvider.rating_avg || 0).toFixed(1)}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewsModalProvider(null)}
                  className="p-1 rounded-lg opacity-75 hover:opacity-100 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Filtros rápidos del modal de reseñas (estrellas + micro-tags) */}
              {!loadingProviderReviews && providerReviewsList.length > 0 && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { val: 0, label: `Todas (${providerReviewsList.length})` },
                      { val: 5, label: '5 ★' },
                      { val: 4, label: '4 ★ o más' },
                      { val: -3, label: '3 ★ o menos' },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setReviewFilterMinStars(opt.val)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border cursor-pointer ${
                          reviewFilterMinStars === opt.val
                            ? 'border-amber-400/70 bg-amber-500/20 text-amber-200'
                            : 'border-white/15 opacity-75 hover:opacity-100'
                        }`}
                        style={reviewFilterMinStars === opt.val ? undefined : innerStyle}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setReviewFilterTag('all')}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border cursor-pointer ${
                        reviewFilterTag === 'all'
                          ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200'
                          : 'border-white/15 opacity-75 hover:opacity-100'
                      }`}
                      style={reviewFilterTag === 'all' ? undefined : innerStyle}
                    >
                      Todos los tags
                    </button>
                    {REVIEW_MICRO_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setReviewFilterTag(tag)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border cursor-pointer ${
                          reviewFilterTag === tag
                            ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200'
                            : 'border-white/15 opacity-75 hover:opacity-100'
                        }`}
                        style={reviewFilterTag === tag ? undefined : innerStyle}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Listado filtrado de reseñas verificadas dejadas por otros residentes */}
              {loadingProviderReviews ? (
                <p className="py-6 text-center opacity-75">Cargando reseñas verificadas...</p>
              ) : filteredModalReviews.length === 0 ? (
                <div className="p-5 rounded-xl border border-white/10 text-center opacity-75" style={innerStyle}>
                  {providerReviewsList.length === 0
                    ? 'Este prestador aún no tiene reseñas escritas publicadas.'
                    : 'No hay reseñas que coincidan con el filtro seleccionado.'}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredModalReviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-3.5 rounded-xl border border-white/10 space-y-1"
                      style={innerStyle}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold">
                          {rev.owner_name ||
                            `${rev.owner_first_name || rev.first_name || ''} ${rev.owner_last_name || rev.last_name || ''}`.trim() ||
                            'Residente Verificado'}
                        </span>
                        <span className="font-bold text-amber-300">
                          {'★'.repeat(Number(rev.rating || 5))} ({rev.rating}/5)
                        </span>
                      </div>
                      {Array.isArray(rev.tags) && rev.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {rev.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {rev.comment && <p className="opacity-85 italic">&ldquo;{rev.comment}&rdquo;</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Modal: Preguntas y Respuestas públicas de la comunidad (Q&A estilo ficha de producto) */}
      {qaModalProvider && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div
            className="w-full max-w-lg rounded-2xl p-6 border border-slate-700/80 shadow-2xl space-y-4 text-xs max-h-[85vh] overflow-y-auto"
            style={cardStyle}
          >
            <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-sky-300">
                  Preguntas y Respuestas Públicas
                </p>
                <h3 className="text-base font-black mt-0.5">
                  {qaModalProvider.first_name} {qaModalProvider.last_name}
                </h3>
                <p className="text-[11px] font-semibold text-emerald-300 mt-0.5">
                  {getProviderSpecialties(qaModalProvider).join(' · ')}
                </p>
                {qaModalProvider.response_label && (
                  <p className="text-[11px] text-sky-300 mt-0.5">{qaModalProvider.response_label}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setQaModalProvider(null)}
                className="p-1 rounded-lg opacity-75 hover:opacity-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Formulario para publicar una pregunta pública visible para toda la comunidad */}
            <form onSubmit={handleSubmitPublicQuestion} className="space-y-2">
              <label className="block font-semibold opacity-85">
                Hacé una consulta pública antes de pedir visita:
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  maxLength={400}
                  value={newQaText}
                  onChange={(e) => setNewQaText(e.target.value)}
                  placeholder="Ej: ¿Trabajás sábados? ¿Hacés mantenimiento de aires inverter?"
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                  style={innerStyle}
                />
                <button
                  type="submit"
                  disabled={submittingQa}
                  className="px-4 py-2 rounded-xl font-bold text-white cursor-pointer disabled:opacity-50 shrink-0"
                  style={{ backgroundColor: primaryColor }}
                >
                  {submittingQa ? 'Enviando...' : 'Preguntar'}
                </button>
              </div>
              {qaFeedback.text && (
                <div
                  className={`rounded-xl p-2.5 border ${
                    qaFeedback.type === 'success'
                      ? 'border-emerald-700/70 bg-emerald-950/50 text-emerald-200'
                      : 'border-rose-800/70 bg-rose-950/50 text-rose-200'
                  }`}
                >
                  {qaFeedback.text}
                </div>
              )}
            </form>

            {/* Historial de preguntas y respuestas comunitarias del prestador */}
            {loadingQaQuestions ? (
              <p className="py-6 text-center opacity-75">Cargando preguntas de la comunidad...</p>
            ) : qaQuestionsList.length === 0 ? (
              <div className="p-5 rounded-xl border border-white/10 text-center opacity-75" style={innerStyle}>
                Todavía no hay preguntas publicadas para este prestador. ¡Hacé la primera consulta!
              </div>
            ) : (
              <div className="space-y-2.5">
                {qaQuestionsList.map((q) => {
                  const asker =
                    `${q.asked_by_first_name || ''} ${q.asked_by_last_name || ''}`.trim() ||
                    'Residente';
                  return (
                    <div
                      key={q.id}
                      className="p-3.5 rounded-xl border border-white/10 space-y-2"
                      style={innerStyle}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold">
                          <span className="opacity-70">{asker}:</span> {q.question}
                        </p>
                      </div>
                      {q.answer ? (
                        <div className="rounded-lg p-2.5 bg-emerald-950/35 border border-emerald-800/40 text-emerald-200">
                          <strong>Respuesta del prestador:</strong> {q.answer}
                        </div>
                      ) : (
                        <p className="text-[11px] opacity-65 italic">
                          Pendiente de respuesta del prestador.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Abrir Reclamo / Garantía Post-Servicio */}
      {disputeModalContract && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div
            className="w-full max-w-md rounded-2xl p-6 border border-slate-700/80 shadow-2xl space-y-4 text-xs"
            style={cardStyle}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold">
                Reclamo / Garantía · Contrato #{disputeModalContract.id}
              </h3>
              <button
                type="button"
                onClick={() => setDisputeModalContract(null)}
                className="p-1 rounded-lg opacity-75 hover:opacity-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Formulario de tipificación y descripción del reclamo para Operaciones */}
            <form onSubmit={handleSubmitDispute} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1 opacity-85">Motivo del reclamo</label>
                <select
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80"
                  style={innerStyle}
                >
                  <option value="Trabajo incompleto o con fallas">Trabajo incompleto o con fallas</option>
                  <option value="Garantía post-servicio sin respuesta">Garantía post-servicio sin respuesta</option>
                  <option value="Diferencia en monto o alcance acordado">Diferencia en monto o alcance acordado</option>
                  <option value="Daño material o incumplimiento en domicilio">Daño material o incumplimiento en domicilio</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1 opacity-85">Detalle del caso</label>
                <textarea
                  rows={4}
                  required
                  value={disputeDetails}
                  onChange={(e) => setDisputeDetails(e.target.value)}
                  placeholder="Describí qué ocurrió para que Operaciones TrustLink medie y resuelva el reclamo..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80"
                  style={innerStyle}
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDisputeModalContract(null)}
                  className="px-4 py-2 rounded-xl font-bold border border-white/15 cursor-pointer"
                  style={innerStyle}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingDispute || !disputeDetails.trim()}
                  className="px-4 py-2 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-500 cursor-pointer disabled:opacity-50"
                >
                  {submittingDispute ? 'Enviando...' : 'Registrar Reclamo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}