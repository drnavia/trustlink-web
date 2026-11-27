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

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  ChevronDown,
  SlidersHorizontal,
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';
import { useAuth } from '../auth/AuthContext';
import { API_BASE } from '../../config/api';
import QrCodeDisplay from '../../components/QrCodeDisplay';
import SearchableSelect from '../../components/SearchableSelect';
import AdminPaginationBar from '../../components/admin/AdminPaginationBar';
import { paginateItems } from '../../utils/adminPagination';
import ProviderTrustBadge, {
  FeaturedPartnerBadge,
  ProviderAvatar,
  TrustChecksStrip,
  TrustLevelsGuide,
  VerifiedSeal,
} from '../../components/ProviderTrustBadge';
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
  TRUST_LEVEL_THEME,
  formatDateTimeAR,
  getUnifiedStatusMeta,
} from '../../config/uiTokens';

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
    hour12: false,
  });
};

/**
 * Normaliza el domicilio de una visita evitando duplicar la palabra "Lote" (ej. "Lote Lote 15").
 */
const formatVisitAddress = (fractionNumber, lotNumber) => {
  const frac = String(fractionNumber || '').trim();
  const rawLot = String(lotNumber || '').trim();
  const cleanLot = rawLot ? (/^lote\b/i.test(rawLot) ? rawLot : `Lote ${rawLot}`) : 'Lote —';
  return frac ? `${frac} · ${cleanLot}` : cleanLot;
};

/**
 * Formatea el rango horario compacto de una visita (`26/11 · 11:00–12:00`).
 */
const formatVisitScheduleShort = (preferredDate, preferredEndDate) => {
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
 * Traduce el estado de una solicitud de visita en metadatos de presentación claros
 * para el circuito de acuerdo mutuo (`pending_provider` ↔ `pending_resident` → `confirmed`).
 *
 * @param {Object|null|undefined} visit - Última solicitud de visita asociada a un prestador.
 * @returns {{
 *   label: string,
 *   badgeClass: string,
 *   isConfirmed: boolean,
 *   isPendingProvider: boolean,
 *   isPendingResident: boolean,
 *   isDeclined: boolean,
 *   isClosed: boolean
 * }} Metadatos de estado.
 */
const getVisitStatusMeta = (visit) => {
  if (!visit) {
    return {
      label: 'Sin contacto previo',
      badgeClass: 'bg-slate-800/80 text-slate-300 border-slate-700',
      isConfirmed: false,
      isPendingProvider: false,
      isPendingResident: false,
      isDeclined: false,
      isClosed: true,
    };
  }
  const st = String(visit.status || '').toLowerCase();
  if (st === 'confirmed') {
    return {
      label: 'Acordada · Lista para QR',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
      isConfirmed: true,
      isPendingProvider: false,
      isPendingResident: false,
      isDeclined: false,
      isClosed: false,
    };
  }
  if (st === 'pending_resident') {
    return {
      label: 'Contrapropuesta · Confirmá horario',
      badgeClass: 'bg-sky-500/15 text-sky-200 border-sky-400/50',
      isConfirmed: false,
      isPendingProvider: false,
      isPendingResident: true,
      isDeclined: false,
      isClosed: false,
    };
  }
  if (st === 'declined') {
    return {
      label: 'Sin disponibilidad',
      badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
      isConfirmed: false,
      isPendingProvider: false,
      isPendingResident: false,
      isDeclined: true,
      isClosed: true,
    };
  }
  if (st === 'cancelled') {
    return {
      label: 'Cancelada',
      badgeClass: 'bg-slate-800/80 text-slate-300 border-slate-700',
      isConfirmed: false,
      isPendingProvider: false,
      isPendingResident: false,
      isDeclined: false,
      isClosed: true,
    };
  }
  return {
    label: 'Esperando al prestador',
    badgeClass: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
    isConfirmed: false,
    isPendingProvider: true,
    isPendingResident: false,
    isDeclined: false,
    isClosed: false,
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
  useGlobalHeader = false,
  useGlobalSearch = false,
  externalSearchTerm,
  onExternalSearchChange,
  externalActiveStep,
  onExternalStepChange,
  externalOnlyFavorites,
  onExternalOnlyFavoritesChange,
  externalSelectedSpecialty,
  onExternalSelectedSpecialtyChange,
  onHeaderMetaChange,
  refreshNonce = 0,
}) {
  // Contextos globales de marca y sesión del residente autenticado
  const { brand } = useBranding();
  const { user, updateUser } = useAuth();

  // Onboarding de domicilio (barrio y lote) al ingresar por primera vez como Residente
  const viewerRole = String(user?.role || '').toLowerCase();
  const isPrivilegedViewer = ['superadmin', 'admin', 'security'].includes(viewerRole);
  const needsResidentLocation =
    Boolean(user?.id) &&
    !isPrivilegedViewer &&
    (!user?.country_id || !String(user?.lot_number || '').trim());

  const [locationCountries, setLocationCountries] = useState([]);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locCountryId, setLocCountryId] = useState('');
  const [locProposedName, setLocProposedName] = useState('');
  const [locProposedCity, setLocProposedCity] = useState('');
  const [locProposedProvince, setLocProposedProvince] = useState('');
  const [locFractionType, setLocFractionType] = useState('na');
  const [locFractionNumber, setLocFractionNumber] = useState('');
  const [locLotNumber, setLocLotNumber] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState('');

  useEffect(() => {
    if (!needsResidentLocation) {
      setShowLocationModal(false);
      return;
    }
    let mounted = true;
    fetch(`${API_BASE}/api/v1/auth/countries`)
      .then((res) => res.json())
      .then((data) => {
        if (mounted && Array.isArray(data.countries)) {
          setLocationCountries(data.countries);
          setLocCountryId((prev) =>
            prev || (user?.country_id ? String(user.country_id) : '')
          );
        }
      })
      .catch(() => {});

    setLocFractionType(user?.fraction_type || 'na');
    setLocFractionNumber(
      user?.fraction_number ? String(user.fraction_number).replace(/\D+/g, '') : ''
    );
    setLocLotNumber(user?.lot_number ? String(user.lot_number).replace(/\D+/g, '') : '');

    // Abre automáticamente el modal una vez por sesión en el primer ingreso sin domicilio
    try {
      const promptKey = `trustlink_resident_location_prompted_${user.id}`;
      if (!sessionStorage.getItem(promptKey)) {
        sessionStorage.setItem(promptKey, '1');
        setShowLocationModal(true);
      }
    } catch {
      setShowLocationModal(true);
    }

    return () => {
      mounted = false;
    };
  }, [
    needsResidentLocation,
    user?.id,
    user?.country_id,
    user?.fraction_type,
    user?.fraction_number,
    user?.lot_number,
  ]);

  const handleSaveResidentLocation = async (e) => {
    e.preventDefault();
    setLocationFeedback('');
    const isProposingCommunity = locCountryId === '__propose__';
    if (!locCountryId) {
      setLocationFeedback('Seleccioná tu barrio o comunidad, o elegí "Mi barrio no figura" para proponerlo.');
      return;
    }
    if (isProposingCommunity && locProposedName.trim().length < 2) {
      setLocationFeedback('Ingresá el nombre de tu barrio o comunidad (mínimo 2 caracteres).');
      return;
    }
    if (!locLotNumber.trim()) {
      setLocationFeedback('Ingresá tu número de lote.');
      return;
    }
    if (locFractionType !== 'na' && !locFractionNumber.trim()) {
      setLocationFeedback(
        `Ingresá el número de ${locFractionType === 'manzana' ? 'manzana' : 'fracción'}.`
      );
      return;
    }

    setSavingLocation(true);
    try {
      const payload = {
        fraction_type: locFractionType,
        fraction_number: locFractionType === 'na' ? null : locFractionNumber.trim(),
        lot_number: locLotNumber.trim(),
        activate_resident_portal: true,
      };
      if (isProposingCommunity) {
        payload.proposed_country = {
          name: locProposedName.trim(),
          city: locProposedCity.trim() || null,
          province: locProposedProvince.trim() || null,
        };
      } else {
        payload.country_id = Number(locCountryId);
      }

      const res = await fetch(`${API_BASE}/api/v1/account/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.account) {
        updateUser(data.account, data.token || null);
        setShowLocationModal(false);
        setLocationFeedback('');
        setLocProposedName('');
        setLocProposedCity('');
        setLocProposedProvince('');
        await fetchProviders();
      } else {
        setLocationFeedback(data.error || 'No se pudo guardar tu domicilio.');
      }
    } catch (error) {
      console.error('Error al guardar domicilio de residente:', error);
      setLocationFeedback('Error de conexión al guardar tu domicilio.');
    } finally {
      setSavingLocation(false);
    }
  };

  // Mapea pasos externos legados ('visits'|'payments'|'reviews') a la pestaña unificada 'services'
  const resolveNormalizedStep = (rawStep) => {
    if (rawStep === 'providers' || rawStep === 'passes' || rawStep === 'services') return rawStep;
    if (rawStep === 'visits' || rawStep === 'payments' || rawStep === 'reviews') return 'services';
    return 'providers';
  };

  // Paso activo del flujo simplificado de 3 pestañas: 'providers' | 'services' | 'passes'
  // Puede ser controlado externamente por la barra superior de 2 filas (App.jsx)
  const [internalActiveStep, setInternalActiveStep] = useState(() =>
    resolveNormalizedStep(initialStep)
  );
  const isControlledStep =
    typeof onExternalStepChange === 'function' && Boolean(externalActiveStep);
  const activeStep = isControlledStep
    ? resolveNormalizedStep(externalActiveStep)
    : internalActiveStep;
  const setActiveStep = (nextOrUpdater) => {
    const nextRaw =
      typeof nextOrUpdater === 'function' ? nextOrUpdater(activeStep) : nextOrUpdater;
    const normalized = resolveNormalizedStep(nextRaw);
    if (isControlledStep) {
      onExternalStepChange(normalized);
    } else {
      setInternalActiveStep(normalized);
    }
  };

  // Filtros unificados de "2. Mis Servicios" (estilo "Mis Compras")
  const [servicesFilter, setServicesFilter] = useState(() => {
    if (initialStep === 'visits') return 'visits';
    if (initialStep === 'payments') return 'contracts';
    if (initialStep === 'reviews') return 'unrated';
    return 'all';
  });
  const [servicesSearch, setServicesSearch] = useState('');
  const [servicesPage, setServicesPage] = useState(1);
  const [servicesPageSize, setServicesPageSize] = useState(6);
  const [selectedServiceKey, setSelectedServiceKey] = useState(null);

  /** Navega a "Mis Servicios" aplicando el filtro contextual solicitado. */
  const openServicesView = (nextFilter = 'all') => {
    setServicesFilter(nextFilter);
    setServicesPage(1);
    setActiveStep('services');
  };

  // Sincroniza cambios externos de paso inicial (ej. redirección desde /#payments o retorno de Mercado Pago)
  useEffect(() => {
    if (['providers', 'services', 'visits', 'passes', 'payments', 'reviews'].includes(initialStep)) {
      setActiveStep(resolveNormalizedStep(initialStep));
      if (initialStep === 'visits') setServicesFilter('visits');
      else if (initialStep === 'payments') setServicesFilter('contracts');
      else if (initialStep === 'reviews') setServicesFilter('unrated');
      if (typeof onConsumedInitialStep === 'function') {
        onConsumedInitialStep();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStep, onConsumedInitialStep]);

  // Directorio de prestadores, filtros, ordenamiento y modal de reseñas públicas
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [providersError, setProvidersError] = useState('');
  // Si el usuario llegó desde una búsqueda rápida externa, consume y limpia el término precargado
  const [internalSearchTerm, setInternalSearchTerm] = useState(() => {
    const saved = sessionStorage.getItem('trustlink_initial_service_query');
    if (saved && saved.trim()) {
      sessionStorage.removeItem('trustlink_initial_service_query');
      return saved.trim();
    }
    return '';
  });
  const isControlledSearch =
    typeof onExternalSearchChange === 'function' && externalSearchTerm !== undefined;
  const searchTerm = isControlledSearch ? String(externalSearchTerm ?? '') : internalSearchTerm;
  const setSearchTerm = (nextOrUpdater) => {
    const nextValue =
      typeof nextOrUpdater === 'function' ? nextOrUpdater(searchTerm) : nextOrUpdater;
    if (isControlledSearch) {
      onExternalSearchChange(nextValue);
    } else {
      setInternalSearchTerm(nextValue);
    }
  };
  const [internalSelectedSpecialty, setInternalSelectedSpecialty] = useState('Todos');
  const isControlledSpecialty =
    typeof onExternalSelectedSpecialtyChange === 'function' &&
    externalSelectedSpecialty !== undefined;
  const selectedSpecialty = isControlledSpecialty
    ? String(externalSelectedSpecialty || 'Todos')
    : internalSelectedSpecialty;
  const setSelectedSpecialty = (nextOrUpdater) => {
    const nextValue =
      typeof nextOrUpdater === 'function' ? nextOrUpdater(selectedSpecialty) : nextOrUpdater;
    const normalized = String(nextValue || 'Todos');
    if (isControlledSpecialty) {
      onExternalSelectedSpecialtyChange(normalized);
    } else {
      setInternalSelectedSpecialty(normalized);
    }
  };
  const [specialtyMenuOpen, setSpecialtyMenuOpen] = useState(false);
  const [specialtyMenuQuery, setSpecialtyMenuQuery] = useState('');
  const specialtyMenuRef = useRef(null);

  // Cierra el desplegable de rubros al hacer clic fuera o presionar Escape
  useEffect(() => {
    if (!specialtyMenuOpen) return undefined;
    const handleOutside = (event) => {
      if (specialtyMenuRef.current && !specialtyMenuRef.current.contains(event.target)) {
        setSpecialtyMenuOpen(false);
        setSpecialtyMenuQuery('');
      }
    };
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        setSpecialtyMenuOpen(false);
        setSpecialtyMenuQuery('');
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [specialtyMenuOpen]);
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [onlyVerifiedMembers, setOnlyVerifiedMembers] = useState(false);
  const [internalOnlyFavorites, setInternalOnlyFavorites] = useState(false);
  const isControlledFavorites =
    typeof onExternalOnlyFavoritesChange === 'function' && externalOnlyFavorites !== undefined;
  const onlyFavorites = isControlledFavorites ? Boolean(externalOnlyFavorites) : internalOnlyFavorites;
  const setOnlyFavorites = (nextOrUpdater) => {
    const nextValue =
      typeof nextOrUpdater === 'function' ? nextOrUpdater(onlyFavorites) : nextOrUpdater;
    if (isControlledFavorites) {
      onExternalOnlyFavoritesChange(Boolean(nextValue));
    } else {
      setInternalOnlyFavorites(Boolean(nextValue));
    }
  };
  const [onlyAvailableToday, setOnlyAvailableToday] = useState(false);
  const [onlyEmergencies, setOnlyEmergencies] = useState(false);
  const [showTrustGuide, setShowTrustGuide] = useState(false);
  const [togglingFavoriteUserId, setTogglingFavoriteUserId] = useState(null);
  const [directorySortBy, setDirectorySortBy] = useState('featured');
  const [directoryPage, setDirectoryPage] = useState(1);
  const [directoryPageSize, setDirectoryPageSize] = useState(12);
  // Ficha Completa unificada del prestador (pestañas: 'overview' | 'reviews' | 'qa')
  const [profileModalProvider, setProfileModalProvider] = useState(null);
  const [profileModalTab, setProfileModalTab] = useState('overview');
  const [providerReviewsList, setProviderReviewsList] = useState([]);
  const [loadingProviderReviews, setLoadingProviderReviews] = useState(false);
  const [reviewFilterSpecialty, setReviewFilterSpecialty] = useState('all');
  const [reviewFilterTag, setReviewFilterTag] = useState('all');
  const [reviewFilterMinStars, setReviewFilterMinStars] = useState(0);
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
  const [visitEndDate, setVisitEndDate] = useState('');
  const [visitDurationMin, setVisitDurationMin] = useState(60);
  const [visitServiceTitle, setVisitServiceTitle] = useState('');
  const [visitSpecialty, setVisitSpecialty] = useState('');
  const [visitSelectedPackage, setVisitSelectedPackage] = useState(null);
  const [visitNotes, setVisitNotes] = useState('');
  const [savingVisit, setSavingVisit] = useState(false);
  const [visitFeedback, setVisitFeedback] = useState({ type: '', text: '' });
  const [followupDrafts, setFollowupDrafts] = useState({});
  const [sendingFollowupId, setSendingFollowupId] = useState(null);
  // Disponibilidad viva del prestador dentro del modal "Solicitar Visita" (Fase 5.4)
  const [visitAvailability, setVisitAvailability] = useState(null);
  const [loadingVisitAvailability, setLoadingVisitAvailability] = useState(false);
  const [selectedVisitAvailDay, setSelectedVisitAvailDay] = useState('');
  // Acuerdo mutuo en Paso 2 (aceptar contrapropuesta o proponer otro horario desde agenda viva)
  const [visitActionFeedback, setVisitActionFeedback] = useState({ type: '', text: '' });
  const [respondingResidentVisitId, setRespondingResidentVisitId] = useState(null);
  const [counterVisitId, setCounterVisitId] = useState(null);
  const [counterVisitDate, setCounterVisitDate] = useState('');
  const [counterAvailability, setCounterAvailability] = useState(null);
  const [loadingCounterAvail, setLoadingCounterAvail] = useState(false);
  const [selectedCounterDay, setSelectedCounterDay] = useState('');

  // Paso 2b: Respuesta formal del residente ante presupuestos recibidos
  const [respondingQuoteVisitId, setRespondingQuoteVisitId] = useState(null);
  const [requestingQuoteChangesId, setRequestingQuoteChangesId] = useState(null);
  const [quoteChangesDraft, setQuoteChangesDraft] = useState('');

  // Emisión de pase QR vinculado a un prestador (y opcionalmente a una visita)
  const [qrModalProvider, setQrModalProvider] = useState(null);
  const [qrVisitRequestId, setQrVisitRequestId] = useState(null);
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
  const [passesPageSize, setPassesPageSize] = useState(6);
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
  const [orderVisitRequestId, setOrderVisitRequestId] = useState(null);
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

  // Recarga bajo demanda disparada desde el botón de actualizar en la Zona 2 global
  useEffect(() => {
    if (!refreshNonce) return;
    fetchVerifiedProviders();
    fetchMyVisits();
    fetchMyPasses();
    fetchContractsData();
    fetchReviewsData();
  }, [refreshNonce]);

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

      setServicesFilter('contracts');
      setActiveStep('services');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    openServicesView('contracts');
  };

  /**
   * Abre el modal de Nueva Orden de Pago precargando el Pase QR, la Visita vinculada
   * y el título del servicio para mantener la trazabilidad punta a punta (Fase 2).
   */
  const openOrderModalForService = ({ passId = '', visitId = null, description = '' } = {}) => {
    const resolvedPassId = passId
      ? String(passId)
      : eligibleOrderPasses[0]?.id
        ? String(eligibleOrderPasses[0].id)
        : '';
    setOrderPassId(resolvedPassId);
    setOrderVisitRequestId(visitId || null);
    setOrderDescription(description || '');
    setOrderAmount('');
    setShowNewOrderForm(true);
  };

  /**
   * Crea una nueva orden de pago asociada a un Pase QR de visita (`POST /api/v1/contracts`)
   * y actualiza el expediente unificado de Mis Servicios.
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

    if (!selectedPass && !orderVisitRequestId) {
      setPaymentFeedback({
        type: 'error',
        text: 'Emití primero un Pase QR en Pases QR para poder generar una orden de pago.',
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

    const linkedVisitId = orderVisitRequestId || selectedPass?.visit_request_id || null;

    setCreatingOrder(true);
    setPaymentFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/v1/contracts`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          provider_id: selectedPass?.provider_id || null,
          pass_id: selectedPass?.id || null,
          visit_request_id: linkedVisitId,
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
        setOrderVisitRequestId(null);
        setShowNewOrderForm(false);
        await Promise.all([fetchContractsData(), fetchReviewsData(), fetchMyVisits()]);
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

  // Lista de especialidades activas con conteo real de prestadores (evita chips vacíos sin resultados)
  const availableSpecialtyEntries = useMemo(() => {
    const countsByKey = new Map();
    providers.forEach((p) => {
      const seenForProvider = new Set();
      getProviderSpecialties(p).forEach((spec) => {
        if (!spec || spec === 'Servicio Verificado') return;
        const key = spec.toLowerCase();
        if (seenForProvider.has(key)) return;
        seenForProvider.add(key);
        const current = countsByKey.get(key) || { name: spec, count: 0 };
        current.count += 1;
        countsByKey.set(key, current);
      });
    });

    const sorted = Array.from(countsByKey.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name, 'es');
    });

    if (
      selectedSpecialty !== 'Todos' &&
      !sorted.some((item) => item.name.toLowerCase() === selectedSpecialty.toLowerCase())
    ) {
      sorted.push({ name: selectedSpecialty, count: 0 });
    }

    return [{ name: 'Todos', count: providers.length }, ...sorted];
  }, [providers, selectedSpecialty]);

  const availableSpecialties = useMemo(
    () => availableSpecialtyEntries.map((item) => item.name),
    [availableSpecialtyEntries]
  );

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

      const matchesVerified =
        !onlyVerified ||
        Boolean(p.is_verified) ||
        Number(p.trust_level ?? (p.trust_badge?.level ?? 3)) >= 3;
      const matchesMember = !onlyVerifiedMembers || Boolean(p.is_verified_member);
      const matchesFavorite = !onlyFavorites || Boolean(p.is_favorite);
      const matchesAvailableToday = !onlyAvailableToday || Boolean(p.available_today);
      const matchesEmergencies = !onlyEmergencies || Boolean(p.accepts_emergencies);
      const matchesQuery = matchesProviderQuery(p, searchTerm);

      return (
        matchesSpecialty &&
        matchesVerified &&
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
      const trustDiff = Number(b.trust_level ?? 0) - Number(a.trust_level ?? 0);
      if (trustDiff !== 0) return trustDiff;
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
    onlyVerified,
    onlyVerifiedMembers,
    onlyFavorites,
    onlyAvailableToday,
    onlyEmergencies,
    directorySortBy,
  ]);

  /**
   * Carga las preguntas públicas (Q&A) del prestador desde `/api/v1/providers/:providerUserId/questions`.
   *
   * @param {Object} provider - Prestador seleccionado en el directorio.
   * @returns {Promise<void>}
   */
  const fetchProviderQaQuestions = async (provider) => {
    const providerUserId = Number(provider?.user_id);
    if (!providerUserId) return;
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
   * Carga las reseñas consolidadas por persona desde `/api/v1/reviews/provider/:providerId`.
   *
   * @param {Object} provider - Prestador seleccionado en el directorio.
   * @returns {Promise<void>}
   */
  const fetchProviderReviews = async (provider) => {
    const pid = Number(provider?.provider_id || provider?.id);
    if (!pid) return;
    setLoadingProviderReviews(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/reviews/provider/${pid}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
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
   * Abre la Ficha Completa del Prestador (Resumen y respaldo, Reseñas y Preguntas Q&A)
   * cargando en paralelo sus reseñas consolidadas y consultas comunitarias.
   *
   * @param {Object} provider - Prestador seleccionado en el directorio.
   * @param {'overview'|'reviews'|'qa'} [initialTab='overview'] - Pestaña inicial a mostrar.
   */
  const openProviderProfile = (provider, initialTab = 'overview') => {
    setProfileModalProvider(provider);
    setProfileModalTab(initialTab);
    setProviderReviewsList([]);
    setQaQuestionsList([]);
    setReviewFilterSpecialty('all');
    setReviewFilterTag('all');
    setReviewFilterMinStars(0);
    setNewQaText('');
    setQaFeedback({ type: '', text: '' });
    fetchProviderReviews(provider);
    fetchProviderQaQuestions(provider);
  };

  /**
   * Publica una nueva pregunta pública en la Ficha del Prestador abierta.
   *
   * @param {React.FormEvent<HTMLFormElement>} e - Evento de envío del formulario Q&A.
   * @returns {Promise<void>}
   */
  const handleSubmitPublicQuestion = async (e) => {
    e.preventDefault();
    if (!profileModalProvider) return;
    const providerUserId = Number(profileModalProvider.user_id);
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
        await fetchProviderQaQuestions(profileModalProvider);
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
   * Calcula y sincroniza la fecha/hora de fin de una solicitud de visita asegurando
   * un mínimo de 60 minutos desde el inicio (contemplando visita y traslados).
   *
   * @param {string} startLocalStr - Fecha/hora inicio en formato `YYYY-MM-DDTHH:mm`.
   * @param {number} [durationMin=60] - Duración deseada en minutos (mín. 60).
   */
  const syncVisitWindowFromStart = (startLocalStr, durationMin = visitDurationMin) => {
    setVisitDate(startLocalStr);
    const safeMin = Math.max(60, Number(durationMin) || 60);
    setVisitDurationMin(safeMin);
    const parsed = new Date(startLocalStr);
    if (!Number.isNaN(parsed.getTime())) {
      setVisitEndDate(toLocalDateTimeInput(new Date(parsed.getTime() + safeMin * 60 * 1000)));
    }
  };

  /**
   * Inicializa y abre el modal para solicitar/coordinar una visita con un prestador,
   * precargando la ubicación automática y una ventana inicial mínima de 1 hora.
   *
   * @param {Object} provider - Prestador destinatario de la solicitud.
   */
  const openVisitModalForProvider = (provider, preselectedPackage = null) => {
    const providerSpecs = getProviderSpecialties(provider);
    const matchingFilterSpec =
      selectedSpecialty !== 'Todos'
        ? providerSpecs.find((s) => s.toLowerCase() === selectedSpecialty.toLowerCase())
        : null;
    const durationMin = preselectedPackage
      ? Math.max(60, Number(preselectedPackage.estimated_duration_minutes || 60))
      : 60;
    setVisitModalProvider(provider);
    setVisitSelectedPackage(preselectedPackage || null);
    setVisitFraction(user?.fraction_number || '');
    setVisitLot(user?.lot_number || '');
    const defaultStart = new Date(Date.now() + 60 * 60 * 1000);
    setVisitDurationMin(durationMin);
    setVisitDate(toLocalDateTimeInput(defaultStart));
    setVisitEndDate(toLocalDateTimeInput(new Date(defaultStart.getTime() + durationMin * 60 * 1000)));
    setVisitServiceTitle(preselectedPackage ? String(preselectedPackage.title || '') : '');
    setVisitSpecialty(
      preselectedPackage?.specialty || matchingFilterSpec || providerSpecs[0] || ''
    );
    setVisitNotes('');
    setVisitFeedback({ type: '', text: '' });
  };

  /**
   * Envía al backend la solicitud de coordinación de visita con ventana mínima de 1 hora
   * (`preferred_date` y `preferred_end_date`) y actualiza el listado de visitas.
   *
   * @param {React.FormEvent<HTMLFormElement>} e - Evento de envío del formulario modal.
   * @returns {Promise<void>}
   */
  const handleSaveVisitCoordination = async (e) => {
    e.preventDefault();
    if (!visitModalProvider) return;
    const providerId = visitModalProvider.provider_id || visitModalProvider.id;

    const parsedPreferred = visitDate ? new Date(visitDate) : null;
    const parsedEnd = visitEndDate ? new Date(visitEndDate) : null;
    if (
      parsedPreferred &&
      !Number.isNaN(parsedPreferred.getTime()) &&
      parsedEnd &&
      !Number.isNaN(parsedEnd.getTime()) &&
      parsedEnd.getTime() - parsedPreferred.getTime() < 60 * 60 * 1000
    ) {
      setVisitFeedback({
        type: 'error',
        text: 'La ventana mínima de visita es de 1 hora (para contemplar tiempos de traslado).',
      });
      return;
    }

    if (!visitServiceTitle.trim()) {
      setVisitFeedback({
        type: 'error',
        text: 'Indicá brevemente qué trabajo o servicio necesitás (ej: Revisión de tablero eléctrico).',
      });
      return;
    }

    setSavingVisit(true);
    setVisitFeedback({ type: '', text: '' });
    const preferredIso =
      parsedPreferred && !Number.isNaN(parsedPreferred.getTime())
        ? parsedPreferred.toISOString()
        : visitDate || null;
    const preferredEndIso =
      parsedEnd && !Number.isNaN(parsedEnd.getTime())
        ? parsedEnd.toISOString()
        : parsedPreferred && !Number.isNaN(parsedPreferred.getTime())
        ? new Date(parsedPreferred.getTime() + Math.max(60, visitDurationMin) * 60 * 1000).toISOString()
        : null;
    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/visit-requests`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          provider_id: providerId,
          fraction_number: visitFraction.trim() || null,
          lot_number: visitLot.trim() || null,
          preferred_date: preferredIso,
          preferred_end_date: preferredEndIso,
          duration_minutes: Math.max(60, visitDurationMin),
          service_title: visitServiceTitle.trim(),
          service_specialty: visitSpecialty.trim() || null,
          service_package_id: visitSelectedPackage?.id || null,
          notes: visitNotes.trim() || visitServiceTitle.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setVisitFeedback({
          type: 'success',
          text:
            data.message ||
            'Solicitud enviada al prestador. Podés seguir el avance en Mis Servicios.',
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
   * Abre el selector inline de "Proponer otro horario" dentro del Paso 2 (Visitas)
   * consultando la agenda viva de 7 días del prestador para que el residente elija
   * únicamente entre franjas realmente disponibles.
   *
   * @param {Object} visit - Solicitud de visita sobre la cual contraproponer horario.
   * @returns {Promise<void>}
   */
  const openResidentCounterPropose = async (visit) => {
    setCounterVisitId(visit.id);
    const base = visit?.preferred_date ? new Date(visit.preferred_date) : new Date(Date.now() + 2 * 3600000);
    setCounterVisitDate(toLocalDateTimeInput(Number.isNaN(base.getTime()) ? new Date(Date.now() + 2 * 3600000) : base));
    setCounterAvailability(null);
    setSelectedCounterDay('');
    setVisitActionFeedback({ type: '', text: '' });

    const matchedProv = providers.find(
      (p) =>
        Number(p.provider_id || p.id) === Number(visit.provider_id) ||
        (Array.isArray(p.provider_ids) && p.provider_ids.map(Number).includes(Number(visit.provider_id)))
    );
    const providerUserId = Number(visit.provider_user_id || matchedProv?.user_id);
    if (!providerUserId) return;

    setLoadingCounterAvail(true);
    try {
      const tzOffset = new Date().getTimezoneOffset();
      const res = await fetch(
        `${API_BASE}/api/v1/passes/schedule/availability/${providerUserId}?days=7&tz_offset=${tzOffset}`,
        { headers: getAuthHeaders() }
      );
      const data = await res.json();
      if (res.ok && Array.isArray(data.days)) {
        setCounterAvailability(data);
        const firstOpen =
          data.days.find((d) => d.is_working && d.available_count > 0) ||
          data.days.find((d) => d.is_working) ||
          data.days[0];
        setSelectedCounterDay(firstOpen?.date || '');
      }
    } catch (error) {
      console.error('Error al cargar disponibilidad para contrapropuesta:', error);
    } finally {
      setLoadingCounterAvail(false);
    }
  };

  /**
   * Envía la respuesta del residente sobre una visita en negociación:
   * - `accept`: acepta la contrapropuesta del prestador -> estado `confirmed` y habilita Pase QR.
   * - `propose`: propone otro día/horario -> vuelve a `pending_provider`.
   * - `cancel`: cancela la solicitud de visita.
   *
   * @param {number|string} visitId - ID de la visita.
   * @param {'accept'|'propose'|'cancel'} action - Acción del residente.
   * @param {string} [localDateTime=''] - Fecha/hora local cuando `action === 'propose'`.
   * @returns {Promise<void>}
   */
  const handleResidentVisitResponse = async (visitId, action, localDateTime = '') => {
    if (action === 'propose' && !String(localDateTime || '').trim()) {
      setVisitActionFeedback({
        type: 'error',
        text: 'Seleccioná una fecha y horario disponible de la agenda del prestador.',
      });
      return;
    }
    setRespondingResidentVisitId(visitId);
    setVisitActionFeedback({ type: '', text: '' });

    const parsed = action === 'propose' && localDateTime ? new Date(localDateTime) : null;
    const isoDate =
      parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : localDateTime || undefined;
    const replyText = String(followupDrafts[visitId] || '').trim();

    try {
      const res = await fetch(`${API_BASE}/api/v1/passes/visit-requests/${visitId}/resident-respond`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action,
          preferred_date: action === 'propose' ? isoDate : undefined,
          reply_text: replyText || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setVisitActionFeedback({
          type: 'success',
          text: data.message || 'Estado de la visita actualizado.',
        });
        setFollowupDrafts((prev) => ({ ...prev, [visitId]: '' }));
        setCounterVisitId(null);
        await Promise.all([fetchMyVisits(), fetchContractsData(), fetchReviewsData()]);
        if (action === 'accept' && data.contract?.id) {
          setSelectedServiceKey(`contract-${data.contract.id}`);
        }
      } else {
        setVisitActionFeedback({
          type: 'error',
          text: data.error || 'No se pudo actualizar la visita.',
        });
      }
    } catch (error) {
      console.error('Error al responder visita desde residente:', error);
      setVisitActionFeedback({
        type: 'error',
        text: 'Error de conexión al responder la visita.',
      });
    } finally {
      setRespondingResidentVisitId(null);
    }
  };

  /**
   * Responde a un presupuesto formal enviado por el prestador (`POST /api/v1/passes/visit-requests/:id/quote-respond`):
   * - `approve`: aprueba el presupuesto y genera automáticamente el contrato vinculado al servicio.
   * - `request_changes`: solicita un ajuste con comentario opcional.
   *
   * @param {number|string} visitId - Identificador de la visita presupuestada.
   * @param {'approve'|'request_changes'} action - Decisión del residente.
   * @param {string} [feedback=''] - Comentario de ajuste cuando `action === 'request_changes'`.
   * @returns {Promise<void>}
   */
  const handleRespondVisitQuote = async (visitId, action, feedback = '') => {
    setRespondingQuoteVisitId(visitId);
    setVisitActionFeedback({ type: '', text: '' });
    try {
      const response = await fetch(
        `${API_BASE}/api/v1/passes/visit-requests/${visitId}/quote-respond`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            action,
            feedback: String(feedback || '').trim() || undefined,
          }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setRequestingQuoteChangesId(null);
        setQuoteChangesDraft('');
        const feedbackMsg =
          data.message ||
          (action === 'approve'
            ? 'Presupuesto aprobado. Tu orden de servicio quedó lista.'
            : 'Pedido de ajuste enviado al prestador.');
        setVisitActionFeedback({ type: 'success', text: feedbackMsg });
        if (action === 'approve') {
          setPaymentFeedback({ type: 'success', text: feedbackMsg });
        }
        await Promise.all([
          fetchMyVisits(),
          fetchContractsData(),
          fetchReviewsData(),
          fetchMyPasses(),
        ]);
        // Al aprobar, el contrato recién creado absorbe la visita: transicionamos el modal al expediente del contrato
        if (action === 'approve' && data.contract?.id) {
          setSelectedServiceKey(`contract-${data.contract.id}`);
        }
      } else {
        setVisitActionFeedback({
          type: 'error',
          text: data.error || 'No se pudo procesar tu respuesta sobre el presupuesto.',
        });
      }
    } catch (error) {
      console.error('Error al responder presupuesto de visita:', error);
      setVisitActionFeedback({
        type: 'error',
        text: 'Error de conexión al responder el presupuesto.',
      });
    } finally {
      setRespondingQuoteVisitId(null);
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
   * precargando automáticamente el domicilio del residente (Fracción/Manzana y Lote bloqueados),
   * el primer vehículo registrado y la ventana horaria exacta (`Desde` -> `Hasta`) de la visita acordada.
   *
   * @param {Object} provider - Prestador al que se le emitirá el pase.
   * @param {{ fraction?: string, lot?: string, preferredDate?: string, preferredEndDate?: string, vehiclePlate?: string }} [prefill={}] - Datos opcionales desde una visita acordada.
   */
  const openQrModalForProvider = (provider, prefill = {}) => {
    const targetProvider =
      prefill.providerId && provider
        ? { ...provider, provider_id: Number(prefill.providerId) }
        : provider;
    setQrModalProvider(targetProvider);
    setQrVisitRequestId(prefill.visitRequestId || null);
    setFractionNumber(user?.fraction_number ?? prefill.fraction ?? '');
    setLotNumber(user?.lot_number ?? prefill.lot ?? '');
    const providerVehicles = Array.isArray(provider?.vehicles) ? provider.vehicles : [];
    setSelectedVehiclePlate(prefill.vehiclePlate ?? providerVehicles[0]?.plate ?? '');
    setSelectedEmployeeIds([]);
    const hasAgreedDate = Boolean(prefill.preferredDate);
    const baseStart = hasAgreedDate
      ? new Date(prefill.preferredDate)
      : new Date(Date.now() - 10 * 60 * 1000);
    const validStart = Number.isNaN(baseStart.getTime())
      ? new Date(Date.now() - 10 * 60 * 1000)
      : baseStart;
    const parsedAgreedEnd = prefill.preferredEndDate ? new Date(prefill.preferredEndDate) : null;
    const validEnd =
      parsedAgreedEnd &&
      !Number.isNaN(parsedAgreedEnd.getTime()) &&
      parsedAgreedEnd.getTime() > validStart.getTime()
        ? parsedAgreedEnd
        : new Date(validStart.getTime() + (hasAgreedDate ? 60 * 60 * 1000 : 4 * 60 * 60 * 1000));
    setStartTime(toLocalDateTimeInput(validStart));
    setEndTime(toLocalDateTimeInput(validEnd));
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
          visit_request_id: qrVisitRequestId || null,
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
        await Promise.all([fetchMyPasses(), fetchMyVisits()]);
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

  // Paginación homologada (`AdminPaginationBar`: 6 / 12 / 24 / 50) para Pases QR
  const {
    pageItems: paginatedPasses,
    safePage: safePassesPage,
    totalPages: totalPassPages,
  } = useMemo(
    () => paginateItems(filteredPasses, passesPage, passesPageSize),
    [filteredPasses, passesPage, passesPageSize]
  );

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

  // Contadores accionables y filtros derivados por paso (evita recalcular dentro del JSX)
  const pendingContractsCount = contracts.filter(
    (c) => String(c.status || '').toLowerCase() === 'pending'
  ).length;

  const pendingResidentVisitsCount = myVisits.filter(
    (v) => String(v.status || '').toLowerCase() === 'pending_resident'
  ).length;

  const hasActiveDirectoryFilters = Boolean(
    searchTerm.trim() ||
      selectedSpecialty !== 'Todos' ||
      onlyFavorites ||
      onlyAvailableToday ||
      onlyEmergencies ||
      onlyVerified ||
      onlyVerifiedMembers
  );

  const resetDirectoryFilters = () => {
    setSearchTerm('');
    setSelectedSpecialty('Todos');
    setOnlyFavorites(false);
    setOnlyAvailableToday(false);
    setOnlyEmergencies(false);
    setOnlyVerified(false);
    setOnlyVerifiedMembers(false);
  };

  // Línea de tiempo unificada de "Mis Servicios" (estilo "Mis Compras"):
  // combina contratos/pagos/reseñas y visitas en un único historial filtrable y buscable.
  const { allUnifiedServices, servicesCounts, filteredUnifiedServices, unratedServicesCount } =
    useMemo(() => {
    const reviewByContractId = new Map();
    reviewContracts.forEach((rc) => {
      const cid = Number(rc.contract_id ?? rc.id);
      if (cid) reviewByContractId.set(cid, rc);
    });

    const passById = new Map();
    const passesByVisitId = new Map();
    myPasses.forEach((p) => {
      const pid = Number(p.id);
      if (pid) passById.set(pid, p);
      const vid = Number(p.visit_request_id || 0);
      if (vid) {
        const list = passesByVisitId.get(vid) || [];
        list.push(p);
        passesByVisitId.set(vid, list);
      }
    });

    const visitById = new Map();
    myVisits.forEach((v) => {
      const vid = Number(v.id);
      if (vid) visitById.set(vid, v);
    });

    const unified = [];
    const seenContractIds = new Set();
    const absorbedVisitIds = new Set();

    // 1. Expedientes con contrato / orden de pago (absorben su visita y pase QR vinculados en 1 sola fila)
    contracts.forEach((contract) => {
      const cid = Number(contract.id);
      seenContractIds.add(cid);
      const rev = reviewByContractId.get(cid) || null;
      const linkedPass = contract.pass_id ? passById.get(Number(contract.pass_id)) || null : null;
      const resolvedVisitId =
        Number(contract.visit_request_id || linkedPass?.visit_request_id || 0) || null;
      const linkedVisit = resolvedVisitId ? visitById.get(resolvedVisitId) || null : null;
      if (linkedVisit) {
        absorbedVisitIds.add(Number(linkedVisit.id));
      }
      const linkedPasses = resolvedVisitId
        ? passesByVisitId.get(resolvedVisitId) || (linkedPass ? [linkedPass] : [])
        : linkedPass
          ? [linkedPass]
          : [];
      const st = String(contract.status || '').toLowerCase();
      const isCompleted = st === 'completed';
      const hasRatedProvider = Boolean(rev?.provider_review_rating);
      const hasOpenDispute = Number(contract.open_disputes_count || 0) > 0;
      const needsAction = !isCompleted || !hasRatedProvider || hasOpenDispute;
      const providerDisplay =
        contract.provider_name ||
        `${rev?.provider_first_name || ''} ${rev?.provider_last_name || ''}`.trim() ||
        `Prestador #${contract.provider_id}`;
      const specialtyLabel =
        rev?.specialty ||
        linkedVisit?.service_specialty ||
        linkedPass?.visit_service_specialty ||
        linkedPass?.provider_specialty ||
        contract.specialty ||
        '';
      const ts = new Date(contract.completed_at || contract.created_at || 0).getTime() || 0;

      unified.push({
        key: `contract-${cid}`,
        kind: 'contract',
        id: cid,
        contract,
        reviewInfo: rev,
        linkedPass,
        linkedPasses,
        linkedVisit,
        providerDisplay,
        specialty: specialtyLabel,
        searchableText: `${cid} ${providerDisplay} ${contract.description || ''} ${linkedVisit?.service_title || ''} ${specialtyLabel}`.toLowerCase(),
        isCompleted,
        hasRatedProvider,
        hasOpenDispute,
        needsAction,
        actionPriority: hasOpenDispute ? 0 : !isCompleted ? 1 : !hasRatedProvider ? 3 : 9,
        sortTs: ts,
      });
    });

    // Respaldo: incluir cualquier contrato presente en reviewContracts que no figure en contracts
    reviewContracts.forEach((rc) => {
      const cid = Number(rc.contract_id ?? rc.id);
      if (!cid || seenContractIds.has(cid)) return;
      const st = String(rc.contract_status || rc.status || 'completed').toLowerCase();
      const isCompleted = st === 'completed';
      const hasRatedProvider = Boolean(rc.provider_review_rating);
      const linkedPass = rc.pass_id ? passById.get(Number(rc.pass_id)) || null : null;
      const resolvedVisitId = Number(linkedPass?.visit_request_id || 0) || null;
      const linkedVisit = resolvedVisitId ? visitById.get(resolvedVisitId) || null : null;
      if (linkedVisit) {
        absorbedVisitIds.add(Number(linkedVisit.id));
      }
      const providerDisplay =
        `${rc.provider_first_name || ''} ${rc.provider_last_name || ''}`.trim() ||
        rc.provider_name ||
        `Prestador #${rc.provider_id}`;
      const ts = new Date(rc.created_at || 0).getTime() || 0;

      unified.push({
        key: `contract-${cid}`,
        kind: 'contract',
        id: cid,
        contract: {
          id: cid,
          provider_id: rc.provider_id,
          provider_name: providerDisplay,
          pass_id: rc.pass_id,
          visit_request_id: resolvedVisitId,
          description: rc.description,
          agreed_amount: rc.agreed_amount,
          status: st,
          created_at: rc.created_at,
          open_disputes_count: 0,
        },
        reviewInfo: rc,
        linkedPass,
        linkedPasses: linkedPass ? [linkedPass] : [],
        linkedVisit,
        providerDisplay,
        specialty: rc.specialty || linkedVisit?.service_specialty || '',
        searchableText: `${cid} ${providerDisplay} ${rc.description || ''} ${rc.specialty || ''}`.toLowerCase(),
        isCompleted,
        hasRatedProvider,
        hasOpenDispute: false,
        needsAction: !isCompleted || !hasRatedProvider,
        actionPriority: !isCompleted ? 1 : !hasRatedProvider ? 3 : 9,
        sortTs: ts,
      });
    });

    // 2. Expedientes en fase de Visita / Pase QR (aún sin orden de pago vinculada)
    myVisits.forEach((visit) => {
      if (absorbedVisitIds.has(Number(visit.id))) return;
      const meta = getVisitStatusMeta(visit);
      const matchedProvider = providers.find(
        (p) =>
          Number(p.provider_id || p.id) === Number(visit.provider_id) ||
          (Array.isArray(p.provider_ids) &&
            p.provider_ids.map(Number).includes(Number(visit.provider_id)))
      ) || {
        id: visit.provider_id,
        provider_id: visit.provider_id,
        user_id: visit.provider_user_id,
        first_name: visit.provider_name || 'Prestador',
        last_name: '',
      };
      const canIssueQr =
        matchedProvider.can_issue_pass !== false &&
        !matchedProvider.has_expired_docs &&
        Number(matchedProvider.trust_level ?? matchedProvider.trust_badge?.level ?? 3) >= 3;
      const linkedPasses = passesByVisitId.get(Number(visit.id)) || [];
      const activePass =
        linkedPasses.find((p) => ['pending', 'used'].includes(String(p.status || '').toLowerCase())) ||
        linkedPasses[0] ||
        null;
      const activePassStatus = String(activePass?.status || '').toLowerCase();
      const hasActiveOrUsedPass = activePassStatus === 'pending' || activePassStatus === 'used';
      const passIsUsed = activePassStatus === 'used';
      const quoteStatus = String(visit.quote_status || '').toLowerCase();
      const quoteAmount = Number(visit.quote_amount || 0);
      const hasPendingQuote = !meta.isClosed && quoteStatus === 'sent' && quoteAmount > 0;
      const quoteChangesRequested = !meta.isClosed && quoteStatus === 'changes_requested';

      const needsAction =
        hasPendingQuote ||
        meta.isPendingResident ||
        (meta.isConfirmed && canIssueQr && !hasActiveOrUsedPass) ||
        passIsUsed;
      const providerDisplay = visit.provider_name || `Prestador #${visit.provider_id}`;
      const visitSpecialtyLabel = String(
        visit.service_specialty || visit.provider_specialty || matchedProvider?.specialty || ''
      ).trim();
      const serviceTitle =
        String(visit.service_title || '').trim() ||
        (visitSpecialtyLabel ? `Servicio de ${visitSpecialtyLabel}` : `Solicitud de visita #${visit.id}`);
      const ts = new Date(visit.quoted_at || visit.preferred_date || visit.created_at || 0).getTime() || 0;

      unified.push({
        key: `visit-${visit.id}`,
        kind: 'visit',
        id: visit.id,
        visit,
        meta,
        matchedProvider,
        canIssueQr,
        linkedPasses,
        activePass,
        hasActiveOrUsedPass,
        passIsUsed,
        quoteStatus,
        quoteAmount,
        hasPendingQuote,
        quoteChangesRequested,
        providerDisplay,
        specialty: visitSpecialtyLabel,
        serviceTitle,
        searchableText: `${visit.id} ${serviceTitle} ${visitSpecialtyLabel} ${providerDisplay} ${visit.notes || ''} ${visit.quote_description || ''} presupuesto visita ${visit.lot_number || ''}`.toLowerCase(),
        needsAction,
        hasOpenDispute: false,
        hasRatedProvider: true,
        actionPriority: hasPendingQuote
          ? 0
          : meta.isPendingResident
            ? 1
            : passIsUsed
              ? 2
              : meta.isConfirmed && canIssueQr && !hasActiveOrUsedPass
                ? 3
                : 8,
        sortTs: ts,
      });
    });

    const counts = {
      all: unified.length,
      action: unified.filter((i) => i.needsAction).length,
      visits: unified.filter((i) => i.kind === 'visit').length,
      contracts: unified.filter((i) => i.kind === 'contract').length,
      unrated: unified.filter((i) => i.kind === 'contract' && !i.hasRatedProvider).length,
      disputes: unified.filter((i) => i.kind === 'contract' && i.hasOpenDispute).length,
    };

    const q = servicesSearch.trim().toLowerCase();
    const filtered = unified
      .filter((item) => {
        if (servicesFilter === 'action' && !item.needsAction) return false;
        if (servicesFilter === 'visits' && item.kind !== 'visit') return false;
        if (servicesFilter === 'contracts' && item.kind !== 'contract') return false;
        if (servicesFilter === 'unrated' && !(item.kind === 'contract' && !item.hasRatedProvider)) {
          return false;
        }
        if (servicesFilter === 'disputes' && !(item.kind === 'contract' && item.hasOpenDispute)) {
          return false;
        }
        if (q && !item.searchableText.includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        if (servicesFilter === 'action' && a.actionPriority !== b.actionPriority) {
          return a.actionPriority - b.actionPriority;
        }
        return b.sortTs - a.sortTs;
      });

    return {
      allUnifiedServices: unified,
      servicesCounts: counts,
      filteredUnifiedServices: filtered,
      unratedServicesCount: counts.unrated,
    };
  }, [contracts, reviewContracts, myPasses, myVisits, providers, servicesFilter, servicesSearch]);

  const selectedServiceEntry = useMemo(
    () => (selectedServiceKey ? allUnifiedServices.find((e) => e.key === selectedServiceKey) || null : null),
    [allUnifiedServices, selectedServiceKey]
  );

  // Índice de servicios en curso por `provider_id` (para enlazar desde el catálogo sin secuestrar el CTA)
  const activeServicesByProviderId = useMemo(() => {
    const map = new Map();
    allUnifiedServices.forEach((entry) => {
      const isOngoing =
        entry.kind === 'visit' ? !entry.meta?.isClosed : !entry.isCompleted;
      if (!isOngoing) return;
      const pid = Number(
        entry.kind === 'visit' ? entry.visit?.provider_id : entry.contract?.provider_id
      );
      if (!pid) return;
      const list = map.get(pid) || [];
      list.push(entry);
      map.set(pid, list);
    });
    return map;
  }, [allUnifiedServices]);

  // Paginación homologada (`AdminPaginationBar`: 6 / 12 / 24 / 50) para Mis Servicios y Directorio
  const {
    pageItems: paginatedUnifiedServices,
    safePage: safeServicesPage,
    totalPages: totalServicesPages,
  } = useMemo(
    () => paginateItems(filteredUnifiedServices, servicesPage, servicesPageSize),
    [filteredUnifiedServices, servicesPage, servicesPageSize]
  );

  const {
    pageItems: paginatedDirectoryProviders,
    safePage: safeDirectoryPage,
    totalPages: totalDirectoryPages,
  } = useMemo(
    () => paginateItems(filteredProviders, directoryPage, directoryPageSize),
    [filteredProviders, directoryPage, directoryPageSize]
  );

  // Contexto residencial personal para el encabezado (comunidad, área y lote)
  const residentLocationLabel = useMemo(() => {
    const parts = [];
    if (user?.country_name) parts.push(user.country_name);
    if (user?.fraction_type && user.fraction_type !== 'na' && user?.fraction_number) {
      const areaPrefix = user.fraction_type === 'manzana' ? 'Mz.' : 'Fracc.';
      parts.push(`${areaPrefix} ${user.fraction_number}`);
    }
    if (user?.lot_number) parts.push(`Lote ${user.lot_number}`);
    return parts.join(' · ');
  }, [user]);

  // Tarjetas contextuales "Retomá rápido" (solo se muestran si hay actividad real del residente)
  const quickContinueCards = useMemo(() => {
    const cards = [];

    // 1. Presupuesto recibido, contrapropuesta de horario o servicio listo para Pase QR
    const pendingQuoteService = allUnifiedServices.find(
      (entry) => entry.kind === 'visit' && entry.hasPendingQuote
    );
    if (pendingQuoteService) {
      cards.push({
        id: `visit-quote-${pendingQuoteService.id}`,
        eyebrow: 'Presupuesto recibido',
        title: `${pendingQuoteService.serviceTitle} · $${pendingQuoteService.quoteAmount.toLocaleString('es-AR')}`,
        cta: 'Revisar presupuesto',
        tone: 'amber',
        actionType: 'open_service_detail',
        serviceKey: pendingQuoteService.key,
      });
    } else if (pendingResidentVisitsCount > 0) {
      cards.push({
        id: 'visit-confirm',
        eyebrow: 'Requiere tu confirmación',
        title: `${pendingResidentVisitsCount} ${
          pendingResidentVisitsCount === 1
            ? 'servicio con contrapropuesta'
            : 'servicios con contrapropuesta'
        }`,
        cta: 'Confirmar horario',
        tone: 'sky',
        actionType: 'go_visits_confirm',
      });
    } else {
      const readyQrService = allUnifiedServices.find(
        (entry) =>
          entry.kind === 'visit' &&
          entry.meta?.isConfirmed &&
          entry.canIssueQr &&
          !entry.hasActiveOrUsedPass
      );
      if (readyQrService) {
        cards.push({
          id: 'visit-ready-qr',
          eyebrow: 'Servicio acordado · Listo para Pase QR',
          title: `${readyQrService.serviceTitle} · con ${readyQrService.providerDisplay}`,
          cta: 'Emitir Pase QR',
          tone: 'emerald',
          actionType: 'emit_qr',
          provider: readyQrService.matchedProvider,
          visit: readyQrService.visit,
        });
      }
    }

    // 2. Mis prestadores de confianza (favoritos) o pases QR vigentes
    const favoriteCount = providers.filter((p) => Boolean(p.is_favorite)).length;
    const activePassesCount = myPasses.filter(
      (p) => String(p.status || '').toLowerCase() === 'pending'
    ).length;

    if (favoriteCount > 0) {
      cards.push({
        id: 'favorites-shortcut',
        eyebrow: 'Volvé a contratar',
        title: `${favoriteCount} ${favoriteCount === 1 ? 'prestador' : 'prestadores'} en Favoritos`,
        cta: onlyFavorites ? 'Mostrando favoritos' : 'Ver favoritos',
        tone: 'rose',
        actionType: 'toggle_favorites',
      });
    } else if (activePassesCount > 0) {
      cards.push({
        id: 'active-passes',
        eyebrow: 'Accesos vigentes en garita',
        title: `${activePassesCount} ${activePassesCount === 1 ? 'Pase QR vigente' : 'Pases QR vigentes'}`,
        cta: 'Ver Pases QR',
        tone: 'emerald',
        actionType: 'go_passes',
      });
    }

    // 3. Pagos pendientes o reseñas sin calificar
    if (pendingContractsCount > 0) {
      cards.push({
        id: 'pending-payments',
        eyebrow: 'Pagos y conformidad',
        title: `${pendingContractsCount} ${pendingContractsCount === 1 ? 'orden pendiente' : 'órdenes pendientes'}`,
        cta: 'Ir a Mis Servicios',
        tone: 'amber',
        actionType: 'go_payments',
      });
    } else if (unratedServicesCount > 0) {
      cards.push({
        id: 'pending-reviews',
        eyebrow: 'Tu experiencia ayuda al barrio',
        title: `${unratedServicesCount} ${unratedServicesCount === 1 ? 'servicio sin calificar' : 'servicios sin calificar'}`,
        cta: 'Dejar reseña',
        tone: 'amber',
        actionType: 'go_reviews',
      });
    }

    return cards.slice(0, 3);
  }, [
    pendingResidentVisitsCount,
    allUnifiedServices,
    providers,
    myPasses,
    onlyFavorites,
    pendingContractsCount,
    unratedServicesCount,
  ]);

  const hasAnySocioMember = useMemo(
    () => providers.some((p) => Boolean(p.is_verified_member) && !p.has_expired_docs),
    [providers]
  );

  const favoritesCount = useMemo(
    () => providers.filter((p) => Boolean(p.is_favorite)).length,
    [providers]
  );

  // Publica contadores vivos y rubros activos hacia la Zona 2 de la barra superior (App.jsx)
  useEffect(() => {
    if (typeof onHeaderMetaChange !== 'function') return;
    onHeaderMetaChange({
      providersCount: filteredProviders.length,
      servicesActionCount: servicesCounts.action,
      servicesTotalCount: servicesCounts.all,
      passesCount: myPasses.length,
      favoritesCount,
      specialties: availableSpecialtyEntries,
      refreshing: loadingProviders || loadingVisits || loadingPasses || loadingContracts,
    });
  }, [
    onHeaderMetaChange,
    filteredProviders.length,
    servicesCounts.action,
    servicesCounts.all,
    myPasses.length,
    favoritesCount,
    availableSpecialtyEntries,
    loadingProviders,
    loadingVisits,
    loadingPasses,
    loadingContracts,
  ]);

  // Definición de la navegación simplificada en 3 pestañas (Opción A: Prestadores · Mis Servicios · Pases QR)
  const steps = [
    {
      id: 'providers',
      stepNumber: 1,
      label: 'Prestadores',
      count: filteredProviders.length,
      icon: Users,
    },
    {
      id: 'services',
      stepNumber: 2,
      label: 'Mis Servicios',
      count: servicesCounts.action || servicesCounts.all,
      icon: FileText,
    },
    {
      id: 'passes',
      stepNumber: 3,
      label: 'Pases QR',
      count: myPasses.length,
      icon: QrCode,
    },
  ];

  return (
    <div className={PAGE_SHELL_CLASS}>
      {/* Cabecera local + selector de 3 pestañas (se omiten cuando la barra superior de 2 filas asume esa navegación) */}
      {!useGlobalHeader && (
        <>
          <div
            className="rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 border border-white/10 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5"
            style={cardStyle}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight truncate">
                {user?.first_name ? `Hola, ${user.first_name}` : 'Portal Residente'}
              </h1>
              {residentLocationLabel && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-white/15 opacity-90"
                  style={innerStyle}
                >
                  <MapPin size={11} className="text-emerald-400 shrink-0" />
                  <span>{residentLocationLabel}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
              {pendingResidentVisitsCount > 0 && (
                <button
                  type="button"
                  onClick={() => openServicesView('visits')}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl border border-sky-400/50 bg-sky-950/50 text-sky-200 cursor-pointer hover:opacity-90 whitespace-nowrap"
                >
                  {pendingResidentVisitsCount} visita(s) por confirmar
                </button>
              )}
              {pendingContractsCount > 0 && (
                <button
                  type="button"
                  onClick={() => openServicesView('contracts')}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl border border-amber-500/40 bg-amber-950/50 text-amber-200 cursor-pointer hover:opacity-90 whitespace-nowrap"
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/15 hover:opacity-90 cursor-pointer shrink-0"
                style={innerStyle}
                title="Actualizar toda la información del portal"
              >
                <RefreshCw size={13} className={loadingProviders ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Actualizar</span>
              </button>
            </div>
          </div>

          <div
            className="rounded-2xl p-2 border border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-2"
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
        </>
      )}

      {/* Cartel informativo si el residente propuso su barrio y está en validación de TrustLink */}
      {!needsResidentLocation && user?.country_approval_status === 'pending' && (
        <div className="rounded-2xl px-4 py-3 border border-sky-500/40 bg-sky-950/35 text-sky-100 flex items-start gap-2.5 text-xs">
          <MapPin size={16} className="text-sky-300 shrink-0 mt-0.5" />
          <div className="space-y-0.5 min-w-0">
            <p className="font-bold">
              Comunidad &ldquo;{user?.country_name || 'tu barrio'}&rdquo; en validación por TrustLink
            </p>
            <p className="text-[11px] opacity-85 leading-snug">
              Recibimos tu propuesta de barrio. Mientras Operaciones la valida, podés explorar el
              directorio y consultar prestadores normalmente.
            </p>
          </div>
        </div>
      )}

      {/* Cartel persistente si el Residente todavía no cargó su barrio y lote */}
      {needsResidentLocation && (
        <div
          className="rounded-2xl px-4 py-3 border border-amber-500/45 bg-amber-950/35 text-amber-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <MapPin size={16} className="text-amber-300 shrink-0 mt-0.5" />
            <div className="space-y-0.5 min-w-0">
              <p className="font-bold text-amber-100">
                Completá tu barrio y lote para aprovechar todo el portal
              </p>
              <p className="text-[11px] opacity-90 leading-snug">
                Esta información como residente es importante para personalizar tu navegación en el
                directorio de prestadores, ver actividad en tu comunidad y emitir Pases QR en garita.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setLocationFeedback('');
              setShowLocationModal(true);
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-95 cursor-pointer shrink-0 self-start sm:self-auto whitespace-nowrap"
            style={{ backgroundColor: primaryColor }}
          >
            Cargar barrio y lote
          </button>
        </div>
      )}

      {/* PASO 1: DIRECTORIO DE PRESTADORES (enfocado en búsqueda rápida + tarjetas escaneables en 3s) */}
      {activeStep === 'providers' && (
        <section className={SECTION_CARD_CLASS} style={cardStyle}>
          {/* Tira contextual "Retomá rápido": adapta columnas a la cantidad real (sin huecos vacíos) */}
          {quickContinueCards.length > 0 && (
            <div
              className={`grid grid-cols-1 gap-2.5 ${
                quickContinueCards.length === 2
                  ? 'md:grid-cols-2'
                  : quickContinueCards.length >= 3
                    ? 'md:grid-cols-3'
                    : ''
              }`}
            >
              {quickContinueCards.map((item) => {
                const toneBorder =
                  item.tone === 'emerald'
                    ? 'border-emerald-500/35'
                    : item.tone === 'sky'
                      ? 'border-sky-400/40'
                      : item.tone === 'rose'
                        ? 'border-rose-400/35'
                        : 'border-amber-400/35';
                const toneText =
                  item.tone === 'emerald'
                    ? 'text-emerald-300'
                    : item.tone === 'sky'
                      ? 'text-sky-300'
                      : item.tone === 'rose'
                        ? 'text-rose-300'
                        : 'text-amber-300';

                const handleQuickAction = () => {
                  if (item.actionType === 'go_visits_confirm') {
                    openServicesView('visits');
                  } else if (item.actionType === 'open_service_detail' && item.serviceKey) {
                    openServicesView('action');
                    setSelectedServiceKey(item.serviceKey);
                  } else if (item.actionType === 'emit_qr' && item.provider) {
                    openQrModalForProvider(item.provider, {
                      providerId: item.visit?.provider_id,
                      visitRequestId: item.visit?.id,
                      preferredDate: item.visit?.preferred_date,
                      preferredEndDate: item.visit?.preferred_end_date,
                    });
                  } else if (item.actionType === 'toggle_favorites') {
                    setOnlyFavorites((prev) => !prev);
                  } else if (item.actionType === 'go_passes') {
                    setActiveStep('passes');
                  } else if (item.actionType === 'go_payments') {
                    openServicesView('contracts');
                  } else if (item.actionType === 'go_reviews') {
                    openServicesView('unrated');
                  }
                };

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl px-4 py-2.5 border ${toneBorder} flex items-center justify-between gap-3`}
                    style={innerStyle}
                  >
                    <div className="min-w-0 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${toneText}`}>
                        {item.eyebrow}
                      </span>
                      <span className="text-xs font-extrabold truncate">{item.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleQuickAction}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-white/15 hover:opacity-90 cursor-pointer shrink-0 whitespace-nowrap"
                      style={
                        item.actionType === 'emit_qr' || item.actionType === 'open_service_detail'
                          ? { backgroundColor: primaryColor, color: '#ffffff', borderColor: 'transparent' }
                          : cardStyle
                      }
                    >
                      {item.cta}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Barra de utilidades del directorio: oculta el input local solo cuando el buscador vive en Zona 1 */}
          {useGlobalSearch ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <h2 className="text-sm sm:text-base font-extrabold tracking-tight">
                  {onlyFavorites ? 'Tus prestadores favoritos' : 'Directorio de prestadores'}
                </h2>
                <span className="text-xs opacity-65 font-semibold">
                  ({filteredProviders.length})
                </span>
                {searchTerm.trim() && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 cursor-pointer"
                    title="Quitar texto de búsqueda"
                  >
                    <span>“{searchTerm.trim()}”</span>
                    <X size={11} />
                  </button>
                )}
                {useGlobalHeader && isControlledSpecialty && selectedSpecialty !== 'Todos' && (
                  <button
                    type="button"
                    onClick={() => setSelectedSpecialty('Todos')}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 cursor-pointer"
                    title="Quitar filtro de rubro"
                  >
                    <span>Rubro: {selectedSpecialty}</span>
                    <X size={11} />
                  </button>
                )}
                {onlyFavorites && (
                  <button
                    type="button"
                    onClick={() => setOnlyFavorites(false)}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-rose-400/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25 cursor-pointer"
                    title="Volver a ver todos los prestadores"
                  >
                    <Heart size={11} className="fill-current" />
                    <span>Solo favoritos</span>
                    <X size={11} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={directorySortBy}
                  onChange={(e) => setDirectorySortBy(e.target.value)}
                  aria-label="Ordenar prestadores"
                  className="px-3 py-2 rounded-xl border border-white/15 text-xs font-semibold focus:outline-none"
                  style={innerStyle}
                >
                  <option value="featured">Orden: Destacados</option>
                  <option value="reputation">Mejor reputación</option>
                  <option value="rating">Mejor calificación</option>
                  <option value="jobs">Más trabajos</option>
                </select>

                <button
                  type="button"
                  onClick={() => setShowTrustGuide((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                    showTrustGuide
                      ? 'border-indigo-400/65 bg-indigo-500/20 text-indigo-200'
                      : 'border-white/15 opacity-85 hover:opacity-100'
                  }`}
                  style={showTrustGuide ? undefined : innerStyle}
                >
                  <HelpCircle size={13} className="shrink-0" />
                  <span>Niveles de confianza</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-60 pointer-events-none"
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="¿Qué necesitás resolver hoy? Ej: pérdida de agua, salta la térmica, electricista..."
                  className={`w-full pl-10 pr-9 py-2.5 ${FIELD_INPUT_CLASS}`}
                  style={innerStyle}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    aria-label="Limpiar búsqueda"
                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={directorySortBy}
                  onChange={(e) => setDirectorySortBy(e.target.value)}
                  aria-label="Ordenar prestadores"
                  className="px-3 py-2.5 rounded-xl border border-white/15 text-xs font-semibold focus:outline-none"
                  style={innerStyle}
                >
                  <option value="featured">Orden: Destacados</option>
                  <option value="reputation">Mejor reputación</option>
                  <option value="rating">Mejor calificación</option>
                  <option value="jobs">Más trabajos</option>
                </select>

                <button
                  type="button"
                  onClick={() => setShowTrustGuide((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                    showTrustGuide
                      ? 'border-indigo-400/65 bg-indigo-500/20 text-indigo-200'
                      : 'border-white/15 opacity-85 hover:opacity-100'
                  }`}
                  style={showTrustGuide ? undefined : innerStyle}
                >
                  <HelpCircle size={13} className="shrink-0" />
                  <span>Niveles de confianza</span>
                </button>
              </div>
            </div>
          )}

          {/* Guía desplegable de niveles de confianza */}
          {showTrustGuide && (
            <TrustLevelsGuide
              innerStyle={innerStyle}
              onClose={() => setShowTrustGuide(false)}
            />
          )}

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

          {/* Barra única de filtros: evita duplicar el desplegable de Rubros cuando ya vive en Zona 2B */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {/* Selector desplegable de Rubros (solo en modo standalone sin barra global) */}
            {!(useGlobalHeader && isControlledSpecialty) && (
              <>
                <div className="relative" ref={specialtyMenuRef}>
                  <button
                    type="button"
                    onClick={() => setSpecialtyMenuOpen((prev) => !prev)}
                    aria-expanded={specialtyMenuOpen}
                    aria-haspopup="listbox"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${
                      selectedSpecialty !== 'Todos'
                        ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200'
                        : 'border-white/15 opacity-90 hover:opacity-100'
                    }`}
                    style={selectedSpecialty !== 'Todos' ? undefined : innerStyle}
                  >
                    <SlidersHorizontal size={12} className="shrink-0 opacity-85" />
                    <span>
                      {selectedSpecialty === 'Todos'
                        ? `Rubro: Todos (${Math.max(0, availableSpecialtyEntries.length - 1)})`
                        : selectedSpecialty}
                    </span>
                    <ChevronDown
                      size={13}
                      className={`shrink-0 opacity-75 transition-transform ${
                        specialtyMenuOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {specialtyMenuOpen && (
                    <div
                      role="listbox"
                      aria-label="Seleccionar rubro"
                      className="absolute left-0 mt-1.5 w-64 rounded-2xl border border-white/15 shadow-2xl p-2 z-40 space-y-1.5"
                      style={cardStyle}
                    >
                      {availableSpecialtyEntries.length > 3 && (
                        <div className="relative">
                          <Search
                            size={13}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-55 pointer-events-none"
                          />
                          <input
                            type="text"
                            value={specialtyMenuQuery}
                            onChange={(e) => setSpecialtyMenuQuery(e.target.value)}
                            placeholder="Filtrar rubro..."
                            className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-white/15 text-xs focus:outline-none"
                            style={innerStyle}
                            autoFocus
                          />
                        </div>
                      )}

                      <div className="max-h-60 overflow-y-auto space-y-0.5">
                        {availableSpecialtyEntries
                          .filter(({ name }) => {
                            const q = specialtyMenuQuery.trim().toLowerCase();
                            return !q || name.toLowerCase().includes(q);
                          })
                          .map(({ name: spec, count }) => {
                            const active = selectedSpecialty === spec;
                            return (
                              <button
                                key={spec}
                                type="button"
                                role="option"
                                aria-selected={active}
                                onClick={() => {
                                  setSelectedSpecialty(spec);
                                  setSpecialtyMenuOpen(false);
                                  setSpecialtyMenuQuery('');
                                }}
                                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-left cursor-pointer transition-colors ${
                                  active
                                    ? 'bg-emerald-500/20 text-emerald-200'
                                    : 'hover:bg-white/8 opacity-85 hover:opacity-100'
                                }`}
                              >
                                <span className="truncate">
                                  {spec === 'Todos' ? 'Todos los rubros' : spec}
                                </span>
                                <span className="inline-flex items-center gap-1.5 shrink-0">
                                  <span className="text-[10px] opacity-65">({count})</span>
                                  {active && <Check size={12} className="text-emerald-400" />}
                                </span>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                <span className="hidden sm:inline-block h-4 w-px bg-white/15 mx-0.5" aria-hidden="true" />
              </>
            )}

            <button
              type="button"
              onClick={() => setOnlyVerified((prev) => !prev)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-semibold border transition-all cursor-pointer ${
                onlyVerified
                  ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200'
                  : 'border-white/12 opacity-80 hover:opacity-100'
              }`}
              style={onlyVerified ? undefined : innerStyle}
              title="Mostrar solo prestadores con documentación aprobada y Pase QR habilitado (niveles N3 y N4)"
            >
              <ShieldCheck size={12} />
              <span>Con Pase QR</span>
            </button>

            <button
              type="button"
              onClick={() => setOnlyAvailableToday((prev) => !prev)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-semibold border transition-all cursor-pointer ${
                onlyAvailableToday
                  ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200'
                  : 'border-white/12 opacity-80 hover:opacity-100'
              }`}
              style={onlyAvailableToday ? undefined : innerStyle}
            >
              <Zap size={12} />
              <span>Disponible hoy</span>
            </button>

            <button
              type="button"
              onClick={() => setOnlyEmergencies((prev) => !prev)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-semibold border transition-all cursor-pointer ${
                onlyEmergencies
                  ? 'border-rose-400/70 bg-rose-500/20 text-rose-200'
                  : 'border-white/12 opacity-80 hover:opacity-100'
              }`}
              style={onlyEmergencies ? undefined : innerStyle}
            >
              <AlertCircle size={12} />
              <span>Urgencias 24h</span>
            </button>

            {!useGlobalHeader && (
              <button
                type="button"
                onClick={() => setOnlyFavorites((prev) => !prev)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-semibold border transition-all cursor-pointer ${
                  onlyFavorites
                    ? 'border-rose-400/70 bg-rose-500/20 text-rose-200'
                    : 'border-white/12 opacity-80 hover:opacity-100'
                }`}
                style={onlyFavorites ? undefined : innerStyle}
              >
                <Heart size={12} className={onlyFavorites ? 'fill-rose-400 text-rose-400' : ''} />
                <span>Favoritos</span>
              </button>
            )}

            {(hasAnySocioMember || onlyVerifiedMembers) && (
              <button
                type="button"
                onClick={() => setOnlyVerifiedMembers((prev) => !prev)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-semibold border transition-all cursor-pointer ${
                  onlyVerifiedMembers
                    ? 'border-amber-400/70 bg-amber-500/20 text-amber-200'
                    : 'border-white/12 opacity-80 hover:opacity-100'
                }`}
                style={onlyVerifiedMembers ? undefined : innerStyle}
              >
                <Award size={12} />
                <span>Destacados</span>
              </button>
            )}

            {hasActiveDirectoryFilters && (
              <button
                type="button"
                onClick={resetDirectoryFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border border-rose-400/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 cursor-pointer"
              >
                <RotateCcw size={11} />
                <span>Limpiar</span>
              </button>
            )}
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
              className="rounded-xl p-8 border border-white/10 text-center space-y-2.5"
              style={innerStyle}
            >
              <p className="text-sm font-bold">No se encontraron prestadores con ese filtro</p>
              <p className="text-xs opacity-75">
                Probá limpiar los filtros activos o seleccionar otra especialidad.
              </p>
              {hasActiveDirectoryFilters && (
                <button
                  type="button"
                  onClick={resetDirectoryFilters}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer"
                  style={{ backgroundColor: primaryColor }}
                >
                  <RotateCcw size={12} /> Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            /* Grilla 3 columnas con tarjetas minimalistas y paginación estándar */
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
              {paginatedDirectoryProviders.map((provider) => {
                const providerId = Number(provider.provider_id || provider.id);
                const fullName =
                  `${provider.first_name || ''} ${provider.last_name || ''}`.trim() ||
                  provider.email ||
                  'Prestador Verificado';
                const ratingNum = Number(provider.rating_avg || 0);
                const hasRating = ratingNum > 0;
                const reviewsCount = Number(provider.reviews_count || 0);
                const jobsCount = Number(provider.total_jobs ?? provider.completed_jobs ?? 0);
                const providerIdsList =
                  Array.isArray(provider.provider_ids) && provider.provider_ids.length > 0
                    ? provider.provider_ids.map(Number)
                    : [providerId];
                const seenOngoingKeys = new Set();
                const activeProviderServices = [];
                providerIdsList.forEach((pid) => {
                  (activeServicesByProviderId.get(pid) || []).forEach((srv) => {
                    if (!seenOngoingKeys.has(srv.key)) {
                      seenOngoingKeys.add(srv.key);
                      activeProviderServices.push(srv);
                    }
                  });
                });
                const isVerifiedMember = Boolean(provider.is_verified_member);
                const membershipBadgeLabel =
                  provider.membership_tier === 'verified_pro' ? 'Destacado Pro' : 'Destacado';
                const hasExpiredDocs = Boolean(provider.has_expired_docs);
                const isFavorite = Boolean(provider.is_favorite);
                const availableToday = Boolean(provider.available_today);
                const acceptsEmergencies = Boolean(provider.accepts_emergencies);

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

                const isFeaturedPartner = Boolean(
                  provider.is_featured_partner || isVerifiedMember
                );
                const cardTrust = provider.trust_badge || {
                  level: provider.auto_verified ? 4 : 3,
                  label: provider.auto_verified ? 'Verificado' : 'Pase QR habilitado',
                  tone: hasExpiredDocs ? 'danger' : provider.auto_verified ? 'sky' : 'emerald',
                  can_issue_pass: !hasExpiredDocs,
                  has_expired_docs: hasExpiredDocs,
                };
                const trustLevel = Number(provider.trust_level ?? cardTrust.level ?? 0);
                const canIssueQrForCard =
                  provider.can_issue_pass !== false && !hasExpiredDocs && trustLevel >= 3;
                // Diseño por excepción: en tarjetas N1 (Perfil Básico) no agregamos badge repetitivo
                const showTrustBadge = hasExpiredDocs || trustLevel >= 2;
                const showMetaRow =
                  showTrustBadge || (isFeaturedPartner && !hasExpiredDocs) || hasRating;

                const cardRingClass = hasExpiredDocs
                  ? 'border-rose-500/40'
                  : isFeaturedPartner
                    ? 'border-amber-400/55 ring-1 ring-amber-400/20'
                    : (TRUST_LEVEL_THEME[trustLevel]?.cardRing || 'border-white/12');

                const repLabel = provider.reputation?.level_label || 'Nuevo en TrustLink';
                const repDotClass =
                  provider.reputation?.tone === 'emerald'
                    ? 'bg-emerald-400'
                    : provider.reputation?.tone === 'lime'
                      ? 'bg-lime-400'
                      : provider.reputation?.tone === 'amber'
                        ? 'bg-amber-400'
                        : provider.reputation?.tone === 'orange'
                          ? 'bg-orange-400'
                          : provider.reputation?.tone === 'rose'
                            ? 'bg-rose-400'
                            : 'bg-sky-400';

                return (
                  <article
                    key={providerId}
                    className={`rounded-2xl border p-4 flex flex-col justify-between gap-3.5 h-full transition-transform hover:-translate-y-0.5 ${cardRingClass}`}
                    style={innerStyle}
                  >
                    {/* Cuerpo limpio y continuo: Avatar + Identidad + Favorito -> Confianza/Rating -> Rubros -> Señales */}
                    <div className="space-y-3">
                      <div className="space-y-2.5">
                        {/* 1. Cabecera humana: Avatar circular + Nombre (+ tilde N4 único) + Favorito aislado */}
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <ProviderAvatar
                              name={fullName}
                              avatarUrl={provider.avatar_url || provider.photo_url || ''}
                              level={trustLevel}
                              isDanger={hasExpiredDocs}
                            />
                            <div className="min-w-0 space-y-1">
                              <button
                                type="button"
                                onClick={() => openProviderProfile(provider, 'overview')}
                                className="inline-flex items-center gap-1.5 max-w-full text-left text-sm sm:text-base font-extrabold leading-snug hover:underline cursor-pointer"
                              >
                                <span className="truncate">{fullName}</span>
                                {trustLevel >= 4 && !hasExpiredDocs && <VerifiedSeal size={16} />}
                              </button>

                              {/* 2. Confianza por excepción + Rating real */}
                              {showMetaRow && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {showTrustBadge && (
                                    <ProviderTrustBadge
                                      trust={cardTrust}
                                      compact
                                      suppressSeal
                                      labelOverride={
                                        trustLevel >= 4 && !hasExpiredDocs
                                          ? 'Verificado · Pase QR'
                                          : ''
                                      }
                                    />
                                  )}
                                  {isFeaturedPartner && !hasExpiredDocs && (
                                    <FeaturedPartnerBadge compact label={membershipBadgeLabel} />
                                  )}
                                  {hasRating && (
                                    <button
                                      type="button"
                                      onClick={() => openProviderProfile(provider, 'reviews')}
                                      title="Ver reseñas verificadas"
                                      className="inline-flex items-center gap-1 text-xs font-bold text-amber-300 hover:underline cursor-pointer"
                                    >
                                      <Star size={12} className="fill-amber-400 text-amber-400 shrink-0" />
                                      <span>{ratingNum.toFixed(1)}</span>
                                      {reviewsCount > 0 && (
                                        <span className="opacity-70 font-normal">({reviewsCount})</span>
                                      )}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleFavorite(provider)}
                            disabled={togglingFavoriteUserId === Number(provider.user_id)}
                            title={isFavorite ? 'Quitar de Favoritos' : 'Guardar en Favoritos'}
                            aria-label={isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer shrink-0 ${
                              isFavorite
                                ? 'border-rose-500/50 bg-rose-500/15 text-rose-300'
                                : 'border-white/12 bg-white/5 opacity-65 hover:opacity-100'
                            }`}
                          >
                            <Heart size={13} className={isFavorite ? 'fill-rose-400 text-rose-400' : ''} />
                          </button>
                        </div>

                        {/* 3. Rubros */}
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
                                    : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                                }`}
                              >
                                {spec}
                              </span>
                            );
                          })}
                          {extraSpecialties.length > 0 && (
                            <span
                              title={`Otros rubros: ${extraSpecialties.join(', ')}`}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-md border border-white/15 bg-white/5 opacity-80"
                            >
                              +{extraSpecialties.length}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 4. Línea única de señal operativa + reputación */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] opacity-85">
                        <span className="inline-flex items-center gap-1.5 font-semibold">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${repDotClass}`} />
                          <span>{repLabel}</span>
                        </span>
                        <span className="opacity-50">·</span>
                        <span>
                          {jobsCount > 0
                            ? `${jobsCount} ${jobsCount === 1 ? 'trabajo' : 'trabajos'}`
                            : canIssueQrForCard
                              ? 'Pase QR listo'
                              : 'Solo consultas'}
                        </span>
                        {!hasExpiredDocs && acceptsEmergencies ? (
                          <>
                            <span className="opacity-50">·</span>
                            <span className="font-bold text-rose-300">Urgencias 24h</span>
                          </>
                        ) : !hasExpiredDocs && availableToday ? (
                          <>
                            <span className="opacity-50">·</span>
                            <span className="font-semibold text-emerald-300">Disponible hoy</span>
                          </>
                        ) : null}
                        {provider.response_label && (
                          <>
                            <span className="opacity-50">·</span>
                            <span className="text-sky-300 font-semibold">{provider.response_label}</span>
                          </>
                        )}
                      </div>

                      {/* 5. Señal discreta de catálogo con precio fijo y/o servicios en curso */}
                      {((Array.isArray(provider.service_packages) && provider.service_packages.length > 0) ||
                        activeProviderServices.length > 0) && (
                        <div className="pt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                          {Array.isArray(provider.service_packages) &&
                            provider.service_packages.length > 0 && (() => {
                              const minPkgPrice = Math.min(
                                ...provider.service_packages.map((p) => Number(p.fixed_price || 0)).filter((n) => n > 0)
                              );
                              return (
                                <button
                                  type="button"
                                  onClick={() => openProviderProfile(provider, 'overview')}
                                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 hover:underline cursor-pointer"
                                  title="Ver catálogo de servicios con precio fijo"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                  <span>
                                    Precio fijo desde ${minPkgPrice.toLocaleString('es-AR')} (
                                    {provider.service_packages.length}) →
                                  </span>
                                </button>
                              );
                            })()}
                          {activeProviderServices.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                openServicesView('all');
                                if (activeProviderServices.length === 1) {
                                  setSelectedServiceKey(activeProviderServices[0].key);
                                }
                              }}
                              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-sky-300 hover:text-sky-200 hover:underline cursor-pointer"
                              title="Ver el seguimiento en Mis Servicios"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                              <span>
                                {activeProviderServices.length === 1
                                  ? '1 servicio en curso →'
                                  : `${activeProviderServices.length} servicios en curso →`}
                              </span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 6. Pie liviano e integrado: Ver ficha + CTA siempre libre para contratar un nuevo servicio */}
                    <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => openProviderProfile(provider, 'overview')}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold border border-white/15 bg-white/5 hover:bg-white/10 opacity-90 hover:opacity-100 cursor-pointer shrink-0 transition-colors"
                      >
                        Ver ficha
                      </button>

                      {canIssueQrForCard ? (
                        <button
                          type="button"
                          onClick={() => openVisitModalForProvider(provider)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm hover:opacity-95 cursor-pointer"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <Calendar size={13} />
                          <span>Solicitar visita</span>
                        </button>
                      ) : hasExpiredDocs ? (
                        <button
                          type="button"
                          onClick={() => openVisitModalForProvider(provider)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-rose-500/40 bg-rose-950/30 text-rose-200 hover:bg-rose-950/50 cursor-pointer"
                        >
                          <AlertCircle size={13} />
                          <span>Consultar (sin QR)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openVisitModalForProvider(provider)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-sky-400/45 bg-sky-500/12 text-sky-100 hover:bg-sky-500/22 cursor-pointer"
                        >
                          <MessageSquare size={13} />
                          <span>Consultar</span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            {filteredProviders.length > 0 && (
              <AdminPaginationBar
                page={safeDirectoryPage}
                totalPages={totalDirectoryPages}
                totalItems={filteredProviders.length}
                pageSize={directoryPageSize}
                onPageChange={setDirectoryPage}
                onPageSizeChange={(nextSize) => {
                  setDirectoryPageSize(nextSize);
                  setDirectoryPage(1);
                }}
                loading={loadingProviders}
                itemLabel="prestadores"
                innerStyle={innerStyle}
              />
            )}
            </>
          )}
        </section>
      )}

      {/* PASO 2: MIS SERVICIOS (unificado estilo "Mis Compras": Visitas + Pagos/Contratos + Comprobantes + Reseñas + Reclamos) */}
      {activeStep === 'services' && (
        <section className={SECTION_CARD_CLASS} style={cardStyle}>
          {/* Cabecera limpia de Mis Servicios */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <FileText size={18} className="text-emerald-400 shrink-0" />
                <span>Mis Servicios</span>
              </h2>
              <p className="text-xs opacity-75">
                Seguí tus visitas, acuerdos, pagos, comprobantes y reseñas en un solo lugar.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {gatewayConfig.gateway_mode === 'mercadopago' && (
                <span className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl border border-sky-500/40 bg-sky-950/50 text-sky-200">
                  {gatewayConfig.sandbox ? 'Mercado Pago (Sandbox)' : 'Mercado Pago Activo'}
                </span>
              )}

              <button
                type="button"
                onClick={() => openOrderModalForService()}
                className="text-white font-bold px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 transition-opacity hover:opacity-95 cursor-pointer shadow-sm"
                style={{ backgroundColor: primaryColor }}
              >
                <Plus size={14} />
                <span>Nueva Orden de Pago</span>
              </button>

              {!useGlobalHeader && (
                <button
                  type="button"
                  onClick={() => {
                    fetchMyVisits();
                    fetchContractsData();
                    fetchReviewsData();
                    fetchMyPasses();
                  }}
                  className="p-2 rounded-xl border border-white/15 hover:opacity-90 cursor-pointer"
                  style={innerStyle}
                  title="Actualizar Mis Servicios"
                >
                  <RefreshCw
                    size={15}
                    className={loadingVisits || loadingContracts || loadingReviews ? 'animate-spin' : ''}
                  />
                </button>
              )}
            </div>
          </div>

          {/* Feedback consolidado de visitas, pagos/conformidad y reseñas */}
          {visitActionFeedback.text && (
            <div
              className={`rounded-xl p-3 text-xs border flex items-center justify-between gap-2 ${
                visitActionFeedback.type === 'success'
                  ? 'border-emerald-700/70 bg-emerald-950/50 text-emerald-200'
                  : 'border-rose-800/70 bg-rose-950/50 text-rose-200'
              }`}
            >
              <span>{visitActionFeedback.text}</span>
              <button
                type="button"
                onClick={() => setVisitActionFeedback({ type: '', text: '' })}
                className="opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {paymentFeedback.text && (
            <div
              className={`rounded-xl p-3 text-xs border flex items-center justify-between gap-2 ${
                paymentFeedback.type === 'success'
                  ? 'border-emerald-700/70 bg-emerald-950/50 text-emerald-200'
                  : 'border-rose-800/70 bg-rose-950/50 text-rose-200'
              }`}
            >
              <span>{paymentFeedback.text}</span>
              <button
                type="button"
                onClick={() => setPaymentFeedback({ type: '', text: '' })}
                className="opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {reviewFeedback.text && (
            <div
              className={`rounded-xl p-3 text-xs border flex items-center justify-between gap-2 ${
                reviewFeedback.type === 'success'
                  ? 'border-emerald-700/70 bg-emerald-950/50 text-emerald-200'
                  : 'border-rose-800/70 bg-rose-950/50 text-rose-200'
              }`}
            >
              <span>{reviewFeedback.text}</span>
              <button
                type="button"
                onClick={() => setReviewFeedback({ type: '', text: '' })}
                className="opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* Barra estilo "Mis Compras": buscador + filtros por estado con conteo vivo */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-60 pointer-events-none"
              />
              <input
                type="text"
                value={servicesSearch}
                onChange={(e) => {
                  setServicesSearch(e.target.value);
                  setServicesPage(1);
                }}
                placeholder="Buscar en Mis Servicios por prestador, trabajo o #número..."
                className={`w-full pl-9 pr-9 py-2 ${FIELD_INPUT_CLASS}`}
                style={innerStyle}
              />
              {servicesSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setServicesSearch('');
                    setServicesPage(1);
                  }}
                  aria-label="Limpiar búsqueda en Mis Servicios"
                  className="absolute right-3 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {[
                { id: 'all', label: 'Todos', count: servicesCounts.all },
                ...(servicesCounts.action > 0 || servicesFilter === 'action'
                  ? [{ id: 'action', label: 'Requiere tu acción', count: servicesCounts.action }]
                  : []),
                { id: 'visits', label: 'Visitas', count: servicesCounts.visits },
                { id: 'contracts', label: 'Pagos y contratos', count: servicesCounts.contracts },
                ...(servicesCounts.unrated > 0 || servicesFilter === 'unrated'
                  ? [{ id: 'unrated', label: 'Por calificar', count: servicesCounts.unrated }]
                  : []),
                ...(servicesCounts.disputes > 0 || servicesFilter === 'disputes'
                  ? [{ id: 'disputes', label: 'Con reclamo', count: servicesCounts.disputes }]
                  : []),
              ].map((chip) => {
                const active = servicesFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => {
                      setServicesFilter(chip.id);
                      setServicesPage(1);
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

              {(servicesFilter !== 'all' || servicesSearch.trim()) && (
                <button
                  type="button"
                  onClick={() => {
                    setServicesFilter('all');
                    setServicesSearch('');
                    setServicesPage(1);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border border-rose-400/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 cursor-pointer"
                >
                  <RotateCcw size={11} />
                  <span>Limpiar</span>
                </button>
              )}
            </div>
          </div>

          {/* Línea de tiempo unificada de Mis Servicios */}
          {loadingVisits && loadingContracts && loadingReviews ? (
            <p className="text-xs opacity-75 py-8 text-center">Cargando tus servicios...</p>
          ) : filteredUnifiedServices.length === 0 ? (
            <div
              className="rounded-xl p-8 text-center text-xs opacity-80 border border-white/10 space-y-3"
              style={innerStyle}
            >
              <p className="font-bold text-sm">
                {servicesCounts.all === 0
                  ? 'Todavía no tenés visitas ni servicios registrados.'
                  : 'No hay servicios que coincidan con el filtro actual.'}
              </p>
              <p className="opacity-75">
                {servicesCounts.all === 0
                  ? 'Buscá un prestador verificado en Prestadores para coordinar tu primera visita.'
                  : 'Probá seleccionar "Todos" o limpiar la búsqueda.'}
              </p>
              <button
                type="button"
                onClick={() =>
                  servicesCounts.all === 0
                    ? setActiveStep('providers')
                    : (setServicesFilter('all'), setServicesSearch(''), setServicesPage(1))
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                {servicesCounts.all === 0 ? 'Ir a Prestadores' : 'Ver todos mis servicios'}
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {paginatedUnifiedServices.map((entry) => {
                /* ===== FILA MINIMALISTA DE CONTRATO / SERVICIO (Divulgación progresiva -> Modal de Detalle) ===== */
                if (entry.kind === 'contract') {
                  const {
                    contract,
                    reviewInfo,
                    providerDisplay,
                    specialty,
                    isCompleted,
                    hasRatedProvider,
                    hasOpenDispute,
                  } = entry;
                  const cid = contract.id;
                  const totalAmount = Number(contract.agreed_amount || contract.amount || 0);
                  const isPending = String(contract.status || '').toLowerCase() === 'pending';
                  const isInProgress = String(contract.status || '').toLowerCase() === 'in_progress';
                  const statusMeta = getUnifiedStatusMeta(contract.status, 'contract');
                  const createdDateShort = contract.created_at
                    ? new Date(contract.created_at).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })
                    : `Servicio #${cid}`;

                  const contractTitle =
                    String(contract.description || '').trim() ||
                    (specialty ? `Servicio de ${specialty}` : `Servicio #${cid}`);

                  return (
                    <article
                      key={entry.key}
                      className={`rounded-2xl border px-4 py-3.5 text-xs transition-colors ${
                        hasOpenDispute
                          ? 'border-rose-500/45'
                          : !isCompleted
                            ? 'border-amber-500/35'
                            : 'border-white/10 hover:border-white/20'
                      }`}
                      style={innerStyle}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        {/* Izquierda clicable centrada en el Servicio: Título del trabajo -> Rubro/Estado -> Prestador + Fecha */}
                        <button
                          type="button"
                          onClick={() => setSelectedServiceKey(entry.key)}
                          className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer group"
                        >
                          <ProviderAvatar name={providerDisplay} level={3} size="md" />
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-extrabold truncate max-w-full sm:max-w-md group-hover:underline">
                                {contractTitle}
                              </h3>
                              {specialty && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 shrink-0">
                                  {specialty}
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border shrink-0 ${statusMeta.cls}`}
                              >
                                {statusMeta.label}
                              </span>
                              {hasOpenDispute && (
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border border-rose-700/70 bg-rose-950/60 text-rose-200 shrink-0">
                                  Reclamo abierto
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] opacity-75">
                              <span>
                                con <strong className="font-semibold opacity-95">{providerDisplay}</strong>
                              </span>
                              <span className="opacity-45">·</span>
                              <span>{createdDateShort}</span>
                              {hasRatedProvider && reviewInfo?.provider_review_rating ? (
                                <>
                                  <span className="opacity-45">·</span>
                                  <span className="inline-flex items-center gap-1 font-bold text-amber-300 opacity-100">
                                    <Star size={11} className="fill-amber-400 text-amber-400" />
                                    <span>{reviewInfo.provider_review_rating}/5</span>
                                  </span>
                                </>
                              ) : isCompleted ? (
                                <>
                                  <span className="opacity-45">·</span>
                                  <span className="font-semibold text-amber-300 opacity-100">
                                    Por calificar
                                  </span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </button>

                        {/* Derecha: Monto + máx. 2 acciones limpias */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between md:justify-end gap-2 shrink-0 pl-12 md:pl-0">
                          <span className="font-mono font-black text-sm mr-1">
                            ${totalAmount.toLocaleString('es-AR')}
                          </span>

                          <button
                            type="button"
                            onClick={() => setSelectedServiceKey(entry.key)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold border border-white/15 bg-white/5 hover:bg-white/10 opacity-90 hover:opacity-100 cursor-pointer transition-colors"
                          >
                            Ver detalle
                          </button>

                          {isPending ? (
                            <button
                              type="button"
                              disabled={payingContractId === cid}
                              onClick={() => handlePayContract(cid)}
                              className="py-1.5 px-3.5 rounded-xl text-xs font-bold text-white hover:opacity-95 cursor-pointer disabled:opacity-50 shadow-sm"
                              style={{ backgroundColor: primaryColor }}
                            >
                              {payingContractId === cid ? 'Procesando...' : 'Confirmar y Pagar'}
                            </button>
                          ) : isInProgress ? (
                            <button
                              type="button"
                              disabled={completingContractId === cid}
                              onClick={() => handleCompleteContract(cid)}
                              className="inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl text-xs font-bold text-white hover:opacity-95 cursor-pointer disabled:opacity-50 shadow-sm"
                              style={{ backgroundColor: primaryColor }}
                            >
                              <CheckCircle2 size={13} />
                              <span>{completingContractId === cid ? 'Registrando...' : 'Dar conformidad'}</span>
                            </button>
                          ) : !hasRatedProvider ? (
                            <button
                              type="button"
                              onClick={() => setSelectedServiceKey(entry.key)}
                              className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold border border-amber-400/50 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 cursor-pointer"
                            >
                              <Star size={12} />
                              <span>Calificar</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                handleRehireProvider(contract.provider_id, providerDisplay)
                              }
                              className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold border border-emerald-500/35 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 cursor-pointer"
                            >
                              <RotateCcw size={12} />
                              <span>Volver a contratar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                }

                /* ===== FILA MINIMALISTA DE VISITA (Centrada en el Servicio -> evoluciona con Presupuesto, Pase QR y Pago) ===== */
                const {
                  visit,
                  meta,
                  matchedProvider,
                  canIssueQr,
                  activePass,
                  hasActiveOrUsedPass,
                  passIsUsed,
                  hasPendingQuote,
                  quoteChangesRequested,
                  quoteAmount,
                  providerDisplay,
                  specialty: visitSpecialtyLabel,
                  serviceTitle,
                } = entry;
                const msgs = Array.isArray(visit.messages) ? visit.messages : [];
                const visitTrustLevel = Number(
                  matchedProvider?.trust_level ?? matchedProvider?.trust_badge?.level ?? 0
                );
                const visitBadgeLabel = hasPendingQuote
                  ? 'Presupuesto recibido'
                  : quoteChangesRequested
                    ? 'Ajuste solicitado'
                    : passIsUsed
                      ? 'Ingreso registrado'
                      : hasActiveOrUsedPass
                        ? 'Pase QR vigente'
                        : meta.isConfirmed && !canIssueQr
                          ? 'Acordada · Sin Pase QR'
                          : meta.label;
                const visitBadgeCls = hasPendingQuote
                  ? 'bg-amber-500/20 text-amber-200 border-amber-400/50'
                  : quoteChangesRequested
                    ? 'bg-amber-500/10 text-amber-200 border-amber-400/35'
                    : passIsUsed
                      ? 'bg-sky-500/15 text-sky-200 border-sky-400/45'
                      : hasActiveOrUsedPass
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                        : meta.isConfirmed && !canIssueQr
                          ? 'bg-amber-500/15 text-amber-200 border-amber-500/40'
                          : meta.badgeClass;
                const cardBorderCls = hasPendingQuote
                  ? 'border-amber-400/60 ring-1 ring-amber-400/25'
                  : meta.isPendingResident || passIsUsed
                    ? 'border-sky-400/55 ring-1 ring-sky-400/20'
                    : (meta.isConfirmed && canIssueQr) || hasActiveOrUsedPass
                      ? 'border-emerald-500/45'
                      : meta.isConfirmed && !canIssueQr
                        ? 'border-amber-500/35'
                        : meta.isPendingProvider
                          ? 'border-amber-500/35'
                          : 'border-white/10 opacity-85 hover:opacity-100';
                const addressLabel = formatVisitAddress(visit.fraction_number, visit.lot_number);
                const scheduleShort = formatVisitScheduleShort(
                  visit.preferred_date,
                  visit.preferred_end_date
                );

                return (
                  <article
                    key={entry.key}
                    className={`rounded-2xl border px-4 py-3.5 text-xs transition-colors ${cardBorderCls}`}
                    style={innerStyle}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      {/* Izquierda clicable centrada en el Servicio: Título -> Rubro/Estado -> Prestador + Domicilio */}
                      <button
                        type="button"
                        onClick={() => setSelectedServiceKey(entry.key)}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer group"
                      >
                        <ProviderAvatar
                          name={providerDisplay}
                          level={visitTrustLevel}
                          isDanger={Boolean(matchedProvider?.has_expired_docs)}
                          size="md"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-extrabold truncate max-w-full sm:max-w-md group-hover:underline">
                              {serviceTitle}
                            </h3>
                            {visitSpecialtyLabel && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 shrink-0">
                                {visitSpecialtyLabel}
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${visitBadgeCls}`}
                            >
                              {visitBadgeLabel}
                            </span>
                            {Boolean(visit.service_package_id) && quoteAmount > 0 && !hasPendingQuote && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 font-mono shrink-0">
                                Precio fijo · ${quoteAmount.toLocaleString('es-AR')}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] opacity-75">
                            <span>
                              con <strong className="font-semibold opacity-95">{providerDisplay}</strong>
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

                      {/* Derecha: Monto (si hay presupuesto) u Horario compacto + máx. 2 acciones contextuales */}
                      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between md:justify-end gap-2 shrink-0 pl-12 md:pl-0">
                        {hasPendingQuote ? (
                          <span className="font-mono font-black text-sm text-amber-200 mr-1 whitespace-nowrap">
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
                          onClick={() => setSelectedServiceKey(entry.key)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/15 bg-white/5 hover:bg-white/10 opacity-90 hover:opacity-100 cursor-pointer transition-colors"
                        >
                          {!meta.isClosed && msgs.length > 0 ? (
                            <>
                              <MessageSquare size={12} className="text-sky-300" />
                              <span>Mensajes</span>
                            </>
                          ) : (
                            <span>Ver detalle</span>
                          )}
                        </button>

                        {hasPendingQuote ? (
                          <button
                            type="button"
                            onClick={() => setSelectedServiceKey(entry.key)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer shadow-sm hover:opacity-95"
                            style={{ backgroundColor: primaryColor }}
                          >
                            <FileText size={13} />
                            <span>Revisar presupuesto</span>
                          </button>
                        ) : hasActiveOrUsedPass ? (
                          <button
                            type="button"
                            onClick={() =>
                              openOrderModalForService({
                                passId: activePass.id,
                                visitId: visit.id,
                                description: serviceTitle,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer shadow-sm hover:opacity-95"
                            style={{ backgroundColor: primaryColor }}
                          >
                            <CreditCard size={13} />
                            <span>Registrar pago</span>
                          </button>
                        ) : meta.isPendingResident ? (
                          <button
                            type="button"
                            onClick={() => setSelectedServiceKey(entry.key)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer shadow-sm hover:opacity-95"
                            style={{ backgroundColor: primaryColor }}
                          >
                            <Calendar size={13} />
                            <span>Confirmar horario</span>
                          </button>
                        ) : meta.isConfirmed && canIssueQr ? (
                          <button
                            type="button"
                            onClick={() =>
                              openQrModalForProvider(matchedProvider, {
                                providerId: visit.provider_id,
                                visitRequestId: visit.id,
                                preferredDate: visit.preferred_date,
                                preferredEndDate: visit.preferred_end_date,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer shadow-sm hover:opacity-95"
                            style={{ backgroundColor: primaryColor }}
                          >
                            <QrCode size={13} />
                            <span>Emitir Pase QR</span>
                          </button>
                        ) : meta.isClosed ? (
                          <button
                            type="button"
                            onClick={() => openVisitModalForProvider(matchedProvider)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-sky-400/45 bg-sky-500/12 text-sky-100 hover:bg-sky-500/22 cursor-pointer"
                          >
                            <Calendar size={12} />
                            <span>Nueva visita</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}

              <AdminPaginationBar
                page={safeServicesPage}
                totalPages={totalServicesPages}
                totalItems={filteredUnifiedServices.length}
                pageSize={servicesPageSize}
                onPageChange={setServicesPage}
                onPageSizeChange={(nextSize) => {
                  setServicesPageSize(nextSize);
                  setServicesPage(1);
                }}
                loading={loadingVisits || loadingContracts || loadingReviews}
                itemLabel="servicios"
                innerStyle={innerStyle}
              />
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
              <div className="relative flex-1 sm:w-64">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60 pointer-events-none"
                />
                <input
                  type="text"
                  value={passSearch}
                  onChange={(e) => {
                    setPassSearch(e.target.value);
                    setPassesPage(1);
                  }}
                  placeholder="Buscar por prestador, lote o token..."
                  className={`w-full pl-8 pr-8 ${FIELD_INPUT_CLASS}`}
                  style={innerStyle}
                />
                {passSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setPassSearch('');
                      setPassesPage(1);
                    }}
                    aria-label="Limpiar búsqueda de pases"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
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
              <button
                type="button"
                onClick={fetchMyPasses}
                className="p-2 rounded-xl border border-white/15 hover:opacity-90 cursor-pointer self-end sm:self-auto"
                style={innerStyle}
                title="Actualizar pases QR"
              >
                <RefreshCw size={15} className={loadingPasses ? 'animate-spin' : ''} />
              </button>
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

                      {item.visit_service_title && (
                        <p className="text-xs font-semibold text-emerald-300/95 truncate">
                          Servicio: {item.visit_service_title}
                        </p>
                      )}

                      <p className="text-xs opacity-80">
                        Destino: {formatVisitAddress(item.fraction_number, item.lot_number)}
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

          {/* Paginación estándar homologada del listado de Pases QR */}
          {filteredPasses.length > 0 && (
            <AdminPaginationBar
              page={safePassesPage}
              totalPages={totalPassPages}
              totalItems={filteredPasses.length}
              pageSize={passesPageSize}
              onPageChange={setPassesPage}
              onPageSizeChange={(nextSize) => {
                setPassesPageSize(nextSize);
                setPassesPage(1);
              }}
              loading={loadingPasses}
              itemLabel="pases QR"
              innerStyle={innerStyle}
            />
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

              {/* Identidad del servicio solicitado (Catálogo Precio Fijo o Trabajo a presupuestar) */}
              {(() => {
                const modalSpecs = getProviderSpecialties(visitModalProvider);
                const providerPkgs = Array.isArray(visitModalProvider.service_packages)
                  ? visitModalProvider.service_packages
                  : [];
                return (
                  <div className="rounded-xl p-3 border border-slate-700/80 space-y-2.5" style={innerStyle}>
                    {providerPkgs.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <label className="block font-semibold opacity-90">
                            Modalidad de contratación
                          </label>
                          {visitSelectedPackage && (
                            <button
                              type="button"
                              onClick={() => {
                                setVisitSelectedPackage(null);
                                setVisitServiceTitle('');
                                syncVisitWindowFromStart(visitDate, 60);
                              }}
                              className="text-[11px] font-semibold text-sky-300 hover:underline cursor-pointer"
                            >
                              Cambiar a trabajo a presupuestar
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setVisitSelectedPackage(null);
                              setVisitServiceTitle('');
                              syncVisitWindowFromStart(visitDate, 60);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                              !visitSelectedPackage
                                ? 'border-sky-400 bg-sky-500/20 text-sky-100'
                                : 'border-white/15 opacity-75 hover:opacity-100'
                            }`}
                            style={!visitSelectedPackage ? undefined : cardStyle}
                          >
                            A presupuestar
                          </button>
                          {providerPkgs.map((pkg) => {
                            const selected = Number(visitSelectedPackage?.id) === Number(pkg.id);
                            return (
                              <button
                                key={pkg.id}
                                type="button"
                                onClick={() => {
                                  const dur = Math.max(60, Number(pkg.estimated_duration_minutes || 60));
                                  setVisitSelectedPackage(pkg);
                                  setVisitServiceTitle(pkg.title || '');
                                  setVisitSpecialty(pkg.specialty || modalSpecs[0] || '');
                                  syncVisitWindowFromStart(visitDate, dur);
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                                  selected
                                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                                    : 'border-white/15 opacity-80 hover:opacity-100'
                                }`}
                                style={selected ? undefined : cardStyle}
                              >
                                {pkg.title} · ${Number(pkg.fixed_price).toLocaleString('es-AR')}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {visitSelectedPackage ? (
                      <div className="rounded-xl p-3 border border-emerald-500/40 bg-emerald-950/30 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5 min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                              Servicio con precio fijo · Sin espera de presupuesto
                            </span>
                            <p className="text-xs font-extrabold">{visitSelectedPackage.title}</p>
                            <p className="text-[11px] opacity-80">
                              {visitSelectedPackage.specialty} · ~{visitSelectedPackage.estimated_duration_minutes || 60} min
                            </p>
                          </div>
                          <span className="font-mono font-black text-base text-emerald-300 shrink-0">
                            ${Number(visitSelectedPackage.fixed_price).toLocaleString('es-AR')}
                          </span>
                        </div>
                        {visitSelectedPackage.includes_description && (
                          <p className="text-[11px] opacity-85 pt-0.5">
                            {visitSelectedPackage.includes_description}
                          </p>
                        )}
                      </div>
                    ) : (
                      <>
                        {modalSpecs.length > 1 ? (
                          <div className="space-y-1.5">
                            <label className="block font-semibold opacity-90">
                              Rubro del servicio
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {modalSpecs.map((spec) => {
                                const active = visitSpecialty === spec;
                                return (
                                  <button
                                    key={spec}
                                    type="button"
                                    onClick={() => setVisitSpecialty(spec)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                                      active
                                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                                        : 'border-white/15 opacity-80 hover:opacity-100'
                                    }`}
                                    style={active ? undefined : cardStyle}
                                  >
                                    {spec}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : modalSpecs.length === 1 ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] opacity-75">Rubro seleccionado</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                              {modalSpecs[0]}
                            </span>
                          </div>
                        ) : null}

                        <div>
                          <label className="block font-semibold mb-1 opacity-90">
                            ¿Qué servicio o trabajo necesitás? *
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={120}
                            value={visitServiceTitle}
                            onChange={(e) => setVisitServiceTitle(e.target.value)}
                            placeholder="Ej: Revisión de tablero eléctrico, pérdida bajo mesada..."
                            className="w-full px-3 py-2 rounded-xl border border-slate-700/80"
                            style={cardStyle}
                          />
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

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

                        {/* Franjas horarias del día seleccionado (clic para seleccionar inicio + ventana mínima de 1 hora) */}
                        {selectedDayObj && !selectedDayObj.is_working ? (
                          <p className="text-[11px] opacity-75">
                            El prestador no atiende los {selectedDayObj.day_label.toLowerCase()}. Elegí otro día arriba.
                          </p>
                        ) : selectedDayObj && selectedDayObj.slots.length > 0 ? (
                          (() => {
                            const winStartMs = visitDate ? new Date(visitDate).getTime() : NaN;
                            const winEndMs = visitEndDate ? new Date(visitEndDate).getTime() : NaN;
                            const hasValidWindow =
                              !Number.isNaN(winStartMs) && !Number.isNaN(winEndMs) && winEndMs > winStartMs;
                            const hasOverlapBusy =
                              hasValidWindow &&
                              selectedDayObj.slots.some((slot) => {
                                const sMs = new Date(slot.start_iso).getTime();
                                return sMs >= winStartMs && sMs < winEndMs && slot.status !== 'available';
                              });

                            return (
                              <div className="space-y-1.5">
                                <p className="text-[10px] opacity-75">
                                  Tocá la hora de inicio: el sistema reserva automáticamente una ventana mínima de 1 hora (podés ampliarla debajo).
                                </p>
                                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                                  {selectedDayObj.slots.map((slot) => {
                                    const slotInputVal = `${selectedDayObj.date}T${slot.time}`;
                                    const slotStartMs = new Date(slot.start_iso).getTime();
                                    const isStartSlot = visitDate === slotInputVal;
                                    const isInWindow =
                                      hasValidWindow &&
                                      !Number.isNaN(slotStartMs) &&
                                      slotStartMs >= winStartMs &&
                                      slotStartMs < winEndMs;
                                    const isAvail = slot.status === 'available';

                                    let slotCls =
                                      'border-white/10 opacity-35 line-through cursor-not-allowed';
                                    if (isStartSlot && isAvail) {
                                      slotCls = 'border-emerald-300 text-white shadow-sm cursor-pointer';
                                    } else if (isInWindow && isAvail) {
                                      slotCls =
                                        'border-emerald-400/80 bg-emerald-500/35 text-white cursor-pointer';
                                    } else if (isInWindow && !isAvail) {
                                      slotCls =
                                        'border-amber-400/80 bg-amber-500/20 text-amber-200 line-through cursor-not-allowed';
                                    } else if (isAvail) {
                                      slotCls =
                                        'border-emerald-500/35 bg-emerald-950/35 text-emerald-200 hover:border-emerald-400 cursor-pointer';
                                    }

                                    return (
                                      <button
                                        key={slot.start_iso}
                                        type="button"
                                        disabled={!isAvail}
                                        onClick={() => syncVisitWindowFromStart(slotInputVal, visitDurationMin)}
                                        className={`px-2 py-1 rounded-lg font-mono text-[11px] font-bold border transition-all ${slotCls}`}
                                        style={
                                          isStartSlot && isAvail
                                            ? { backgroundColor: primaryColor }
                                            : !isAvail && !isInWindow
                                            ? cardStyle
                                            : undefined
                                        }
                                        title={
                                          isAvail
                                            ? `Iniciar visita a las ${slot.time} (ventana de ${visitDurationMin} min)`
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
                                {hasOverlapBusy && (
                                  <p className="text-[10px] text-amber-200 bg-amber-950/40 border border-amber-500/40 rounded-lg px-2.5 py-1.5">
                                    Atención: dentro de la duración elegida hay una franja ya ocupada. Podés elegir otro horario de inicio o aclararlo en el mensaje.
                                  </p>
                                )}
                              </div>
                            );
                          })()
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

              {/* Ventana de visita (mínimo 1 hora por tiempos de traslado entre barrios) */}
              <div className="rounded-xl p-3 border border-slate-700/80 space-y-2.5" style={innerStyle}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-semibold opacity-90">Duración de la visita (mínimo 1 hora)</span>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { min: 60, label: '1 h (mín.)' },
                      { min: 90, label: '1 h 30' },
                      { min: 120, label: '2 h' },
                      { min: 180, label: '3 h' },
                    ].map((opt) => {
                      const active = visitDurationMin === opt.min;
                      return (
                        <button
                          key={opt.min}
                          type="button"
                          onClick={() => syncVisitWindowFromStart(visitDate, opt.min)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border cursor-pointer transition-all ${
                            active
                              ? 'border-emerald-300 text-white'
                              : 'border-white/15 opacity-80 hover:opacity-100'
                          }`}
                          style={active ? { backgroundColor: primaryColor } : cardStyle}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-semibold mb-1 opacity-85">Desde</label>
                    <input
                      type="datetime-local"
                      value={visitDate}
                      onChange={(e) => syncVisitWindowFromStart(e.target.value, visitDurationMin)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-700/80"
                      style={cardStyle}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 opacity-85">Hasta (mín. 1 h)</label>
                    <input
                      type="datetime-local"
                      value={visitEndDate}
                      onChange={(e) => {
                        const nextVal = e.target.value;
                        setVisitEndDate(nextVal);
                        const s = new Date(visitDate);
                        const en = new Date(nextVal);
                        if (!Number.isNaN(s.getTime()) && !Number.isNaN(en.getTime())) {
                          const diffMin = Math.round((en.getTime() - s.getTime()) / 60000);
                          if (diffMin >= 60) {
                            setVisitDurationMin(diffMin);
                          }
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-700/80"
                      style={cardStyle}
                    />
                  </div>
                </div>

                <p className="text-[10px] opacity-75">
                  Se exige al menos 1 hora para contemplar el servicio en domicilio y el traslado hacia el próximo barrio. Mientras el prestador no confirme, la franja aparece como potencial en su agenda sin bloquear todavía a otros vecinos.
                </p>
              </div>

              <div>
                <label className="block font-semibold mb-1 opacity-85">
                  Mensaje o detalle adicional (opcional)
                </label>
                <textarea
                  rows={2}
                  value={visitNotes}
                  onChange={(e) => setVisitNotes(e.target.value)}
                  placeholder="Ej: Si podés avisame antes de llegar a la garita..."
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
                {visitFeedback.type === 'success' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setVisitModalProvider(null);
                      openServicesView('visits');
                    }}
                    className="px-4 py-2 rounded-xl font-bold text-white cursor-pointer"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Ir a Mis Servicios
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={savingVisit}
                    className="px-4 py-2 rounded-xl font-bold text-white cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {savingVisit
                      ? 'Enviando...'
                      : visitSelectedPackage
                        ? `Reservar por $${Number(visitSelectedPackage.fixed_price).toLocaleString('es-AR')}`
                        : 'Enviar Solicitud'}
                  </button>
                )}
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

      {/* Modal Unificado: Ficha Completa del Prestador (Resumen y Respaldo · Reseñas · Preguntas Q&A) */}
      {profileModalProvider && (() => {
        const provider = profileModalProvider;
        const pid = Number(provider.provider_id || provider.id);
        const providerIdsList =
          Array.isArray(provider.provider_ids) && provider.provider_ids.length > 0
            ? provider.provider_ids.map(Number)
            : [pid];
        const modalSeenKeys = new Set();
        const activeProviderServices = [];
        providerIdsList.forEach((id) => {
          (activeServicesByProviderId.get(id) || []).forEach((srv) => {
            if (!modalSeenKeys.has(srv.key)) {
              modalSeenKeys.add(srv.key);
              activeProviderServices.push(srv);
            }
          });
        });
        const fullName =
          `${provider.first_name || ''} ${provider.last_name || ''}`.trim() ||
          provider.email ||
          'Prestador Verificado';
        const isVerifiedMember = Boolean(provider.is_verified_member);
        const hasExpiredDocs = Boolean(provider.has_expired_docs);
        const isFeaturedPartner = Boolean(provider.is_featured_partner || isVerifiedMember);
        const cardTrust = provider.trust_badge || {
          level: provider.auto_verified ? 4 : 3,
          label: provider.auto_verified ? 'Verificado' : 'Pase QR habilitado',
          tone: hasExpiredDocs ? 'danger' : provider.auto_verified ? 'emerald' : 'teal',
          can_issue_pass: !hasExpiredDocs,
          has_expired_docs: hasExpiredDocs,
        };
        const trustLevel = Number(provider.trust_level ?? cardTrust.level ?? 0);
        const canIssueQr =
          provider.can_issue_pass !== false && !hasExpiredDocs && trustLevel >= 3;
        const trustSummaryLine = hasExpiredDocs
          ? 'Documentación vencida · Emisión de Pase QR pausada hasta renovación'
          : trustLevel >= 4
            ? 'Verificado (N4) · Documentación cotejada y Pase QR habilitado en garita'
            : trustLevel === 3
              ? 'Pase QR habilitado (N3) · Seguro y Antecedentes aprobados por TrustLink'
              : trustLevel === 2
                ? 'Seguro en revisión (N2) · Solo consultas y presupuesto por ahora'
                : 'Perfil Básico (N1) · Solo consultas y presupuesto · Aún sin Pase QR';
        const specialties = getProviderSpecialties(provider);
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
              : 'Presupuesto a consultar';
        const invoiceLabel =
          provider.invoice_type === 'factura_a'
            ? 'Factura A'
            : provider.invoice_type === 'factura_c'
              ? 'Factura C'
              : provider.invoice_type === 'ambas'
                ? 'Factura A / C'
                : provider.invoice_type === 'sin_factura'
                  ? 'Recibo común'
                  : 'Facturación a consultar';
        const contactParts = [
          provider.email ? `✉️ ${provider.email}` : null,
          provider.phone ? `📞 ${provider.phone}` : null,
        ].filter(Boolean);

        // Especialidades presentes en reseñas para filtro rápido dentro de la pestaña Reseñas
        const specialtyCountsMap = new Map();
        providerReviewsList.forEach((rev) => {
          const spec = String(rev.specialty || '').trim();
          if (!spec) return;
          specialtyCountsMap.set(spec, (specialtyCountsMap.get(spec) || 0) + 1);
        });
        const modalSpecialtyOptions = Array.from(specialtyCountsMap.entries()).sort((a, b) => {
          if (b[1] !== a[1]) return b[1] - a[1];
          return a[0].localeCompare(b[0], 'es');
        });
        const filteredModalReviews = providerReviewsList.filter((rev) => {
          const matchesSpecialty =
            reviewFilterSpecialty === 'all' ||
            String(rev.specialty || '').trim().toLowerCase() ===
              reviewFilterSpecialty.toLowerCase();
          const matchesStars =
            reviewFilterMinStars === 0
              ? true
              : reviewFilterMinStars === -3
                ? Number(rev.rating || 0) <= 3
                : Number(rev.rating || 0) >= reviewFilterMinStars;
          const matchesTag =
            reviewFilterTag === 'all' ||
            (Array.isArray(rev.tags) && rev.tags.includes(reviewFilterTag));
          return matchesSpecialty && matchesStars && matchesTag;
        });

        const reviewsBadgeCount =
          providerReviewsList.length || Number(provider.reviews_count || 0);
        const qaBadgeCount =
          qaQuestionsList.length || Number(provider.public_questions_count || 0);

        return (
          <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
            <div
              className="w-full max-w-2xl rounded-2xl border border-slate-700/80 shadow-2xl flex flex-col max-h-[88vh] overflow-hidden text-xs"
              style={cardStyle}
            >
              {/* Cabecera fija de la Ficha */}
              <div className="p-5 pb-3 border-b border-white/10 space-y-3 shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2 min-w-0">
                    <h3 className="text-lg font-black tracking-tight inline-flex items-center gap-2 max-w-full">
                      <span className="truncate">{fullName}</span>
                      {trustLevel >= 4 && !hasExpiredDocs && <VerifiedSeal size={19} />}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <ProviderTrustBadge trust={cardTrust} size="md" showScale suppressSeal />
                      {isFeaturedPartner && !hasExpiredDocs && (
                        <FeaturedPartnerBadge compact />
                      )}
                      {Number(provider.rating_avg || 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300">
                          <Star size={12} className="fill-amber-400 text-amber-400" />
                          <span>{Number(provider.rating_avg).toFixed(1)}</span>
                          {reviewsBadgeCount > 0 && (
                            <span className="opacity-70 font-normal">({reviewsBadgeCount})</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold opacity-65">Sin reseñas aún</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {specialties.map((spec) => (
                        <span
                          key={spec}
                          className="text-[11px] font-bold px-2 py-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        >
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setProfileModalProvider(null)}
                    aria-label="Cerrar ficha del prestador"
                    className="p-1.5 rounded-lg opacity-75 hover:opacity-100 cursor-pointer shrink-0"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Pestañas internas de la Ficha Completa */}
                <div className="flex items-center gap-1.5 pt-1">
                  {[
                    { id: 'overview', label: 'Resumen y respaldo' },
                    { id: 'reviews', label: `Reseñas (${reviewsBadgeCount})` },
                    { id: 'qa', label: `Preguntas (${qaBadgeCount})` },
                  ].map((tab) => {
                    const active = profileModalTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setProfileModalTab(tab.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          active
                            ? 'text-white border-transparent shadow-sm'
                            : 'border-white/15 opacity-75 hover:opacity-100'
                        }`}
                        style={active ? { backgroundColor: primaryColor } : innerStyle}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cuerpo desplazable de la Ficha */}
              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                {profileModalTab === 'overview' && (
                  <>
                    {/* Servicios con precio fijo publicados por el prestador (reserva directa sin presupuesto) */}
                    {Array.isArray(provider.service_packages) && provider.service_packages.length > 0 && (
                      <div className="rounded-xl p-4 border border-emerald-500/35 bg-emerald-950/20 space-y-2.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                            Servicios con precio fijo ({provider.service_packages.length})
                          </span>
                          <span className="text-[10px] opacity-80">
                            Reservás horario directo · sin esperar presupuesto
                          </span>
                        </div>
                        <div className="space-y-2">
                          {provider.service_packages.map((pkg) => (
                            <div
                              key={pkg.id}
                              className="rounded-xl p-3 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                              style={innerStyle}
                            >
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-extrabold text-xs">{pkg.title}</span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                                    {pkg.specialty}
                                  </span>
                                  <span className="text-[10px] opacity-70">
                                    ~{pkg.estimated_duration_minutes || 60} min
                                  </span>
                                </div>
                                {pkg.includes_description && (
                                  <p className="text-[11px] opacity-80 leading-relaxed">
                                    {pkg.includes_description}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                                <span className="font-mono font-black text-sm text-emerald-300">
                                  ${Number(pkg.fixed_price || 0).toLocaleString('es-AR')}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setProfileModalProvider(null);
                                    openVisitModalForProvider(provider, pkg);
                                  }}
                                  className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-white cursor-pointer hover:opacity-95 whitespace-nowrap"
                                  style={{ backgroundColor: primaryColor }}
                                >
                                  Reservar
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Respaldo documental real (DNI · ART · Antecedentes · Pase QR) */}
                    <div className="rounded-xl p-4 border border-white/10 space-y-2.5" style={innerStyle}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[11px] font-bold uppercase tracking-wider opacity-75">
                          Respaldo documental y garita
                        </span>
                        <span className="text-[11px] opacity-80">
                          {Array.isArray(provider.vehicles) && provider.vehicles.length > 0
                            ? `${provider.vehicles.length} vehículo(s) registrado(s)`
                            : 'Sin vehículo registrado'}
                          {Array.isArray(provider.employees) && provider.employees.length > 0
                            ? ` · ${provider.employees.length} ayudante(s)`
                            : ''}
                        </span>
                      </div>
                      <p className="text-xs opacity-90">{trustSummaryLine}</p>
                      <TrustChecksStrip trust={cardTrust} hasExpiredDocs={hasExpiredDocs} />
                    </div>

                    {/* Reputación general consolidada */}
                    <div className="rounded-xl p-4 border border-white/10 space-y-2.5" style={innerStyle}>
                      <span className="block text-[11px] font-bold uppercase tracking-wider opacity-75">
                        Reputación general en TrustLink
                      </span>
                      <ReputationThermometer reputation={provider.reputation} />
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                        <span>
                          {Number(provider.total_jobs ?? provider.completed_jobs ?? 0)} trabajo(s) registrado(s)
                        </span>
                        {provider.response_label && (
                          <span className="inline-flex items-center gap-1 font-semibold text-sky-300">
                            <Clock size={11} />
                            <span>{provider.response_label}</span>
                          </span>
                        )}
                        {communityActivityCount > 0 && (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-300">
                            <MapPin size={11} />
                            <span>{communityActivityCount} servicio(s)/ingreso(s) en tu barrio</span>
                          </span>
                        )}
                      </div>
                      {topTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {topTags.map((t) => (
                            <span
                              key={t.tag}
                              className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
                            >
                              {t.tag} · {t.count}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Condiciones comerciales y contacto */}
                    <div className="rounded-xl p-4 border border-white/10 space-y-2.5" style={innerStyle}>
                      <span className="block text-[11px] font-bold uppercase tracking-wider opacity-75">
                        Condiciones comerciales y contacto
                      </span>
                      {provider.service_bio && (
                        <p className="text-xs opacity-90 leading-relaxed">{provider.service_bio}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 text-[11px]">
                        <span className="px-2.5 py-1 rounded-lg border border-white/15" style={cardStyle}>
                          {quotePolicyLabel}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg border border-white/15" style={cardStyle}>
                          {invoiceLabel}
                        </span>
                        {paymentMethods.length > 0 && (
                          <span
                            className="px-2.5 py-1 rounded-lg border border-white/15 capitalize"
                            style={cardStyle}
                          >
                            Pagos: {paymentMethods.join(', ')}
                          </span>
                        )}
                        {!hasExpiredDocs && provider.accepts_emergencies && (
                          <span className="px-2.5 py-1 rounded-lg border border-rose-400/50 bg-rose-500/15 text-rose-200 font-bold">
                            Atiende urgencias 24h
                          </span>
                        )}
                      </div>
                      {contactParts.length > 0 && (
                        <p className="text-xs opacity-85 pt-0.5">{contactParts.join(' · ')}</p>
                      )}
                    </div>

                    {/* Garantía Hogar Protegido en el punto de decisión */}
                    <HomeProtectedBadge variant="compact" />
                  </>
                )}

                {profileModalTab === 'reviews' && (
                  <div className="space-y-3">
                    {!loadingProviderReviews && providerReviewsList.length > 0 && (
                      <div className="space-y-2">
                        {modalSpecialtyOptions.length > 1 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setReviewFilterSpecialty('all')}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border cursor-pointer ${
                                reviewFilterSpecialty === 'all'
                                  ? 'border-sky-400/70 bg-sky-500/20 text-sky-200'
                                  : 'border-white/15 opacity-75 hover:opacity-100'
                              }`}
                              style={reviewFilterSpecialty === 'all' ? undefined : innerStyle}
                            >
                              Todos los rubros ({providerReviewsList.length})
                            </button>
                            {modalSpecialtyOptions.map(([specName, specCount]) => (
                              <button
                                key={specName}
                                type="button"
                                onClick={() => setReviewFilterSpecialty(specName)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold border cursor-pointer ${
                                  reviewFilterSpecialty === specName
                                    ? 'border-sky-400/70 bg-sky-500/20 text-sky-200'
                                    : 'border-white/15 opacity-75 hover:opacity-100'
                                }`}
                                style={reviewFilterSpecialty === specName ? undefined : innerStyle}
                              >
                                {specName} ({specCount})
                              </button>
                            ))}
                          </div>
                        )}

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

                    {loadingProviderReviews ? (
                      <p className="py-6 text-center opacity-75">Cargando reseñas verificadas...</p>
                    ) : filteredModalReviews.length === 0 ? (
                      <div
                        className="p-5 rounded-xl border border-white/10 text-center opacity-75"
                        style={innerStyle}
                      >
                        {providerReviewsList.length === 0
                          ? 'Este prestador aún no tiene reseñas escritas publicadas.'
                          : 'No hay reseñas que coincidan con el filtro seleccionado.'}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {filteredModalReviews.map((rev) => (
                          <div
                            key={rev.id}
                            className="p-3.5 rounded-xl border border-white/10 space-y-1.5"
                            style={innerStyle}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                <span className="font-bold">
                                  {rev.owner_name ||
                                    `${rev.owner_first_name || rev.first_name || ''} ${rev.owner_last_name || rev.last_name || ''}`.trim() ||
                                    'Residente Verificado'}
                                </span>
                                {rev.specialty && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-sky-400/40 bg-sky-500/15 text-sky-200">
                                    {rev.specialty}
                                  </span>
                                )}
                              </div>
                              <span className="font-bold text-amber-300 shrink-0">
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
                            {rev.comment && (
                              <p className="opacity-85 italic">&ldquo;{rev.comment}&rdquo;</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {profileModalTab === 'qa' && (
                  <div className="space-y-3">
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

                    {loadingQaQuestions ? (
                      <p className="py-6 text-center opacity-75">
                        Cargando preguntas de la comunidad...
                      </p>
                    ) : qaQuestionsList.length === 0 ? (
                      <div
                        className="p-5 rounded-xl border border-white/10 text-center opacity-75"
                        style={innerStyle}
                      >
                        Todavía no hay preguntas publicadas para este prestador. ¡Hacé la primera
                        consulta!
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
                              <p className="font-semibold">
                                <span className="opacity-70">{asker}:</span> {q.question}
                              </p>
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
                )}
              </div>

              {/* Pie fijo con acción directa */}
              <div
                className="px-5 py-3.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 shrink-0"
                style={innerStyle}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setProfileModalProvider(null)}
                    className="px-4 py-2 rounded-xl font-bold border border-white/15 cursor-pointer"
                    style={cardStyle}
                  >
                    Cerrar
                  </button>
                  {activeProviderServices.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileModalProvider(null);
                        openServicesView('all');
                        if (activeProviderServices.length === 1) {
                          setSelectedServiceKey(activeProviderServices[0].key);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-sky-400/45 bg-sky-500/12 text-sky-200 hover:bg-sky-500/22 cursor-pointer"
                    >
                      <span>
                        {activeProviderServices.length === 1
                          ? 'Ver servicio en curso'
                          : `Ver ${activeProviderServices.length} en curso`}
                      </span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setProfileModalProvider(null);
                    openVisitModalForProvider(provider);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-white cursor-pointer"
                  style={{ backgroundColor: primaryColor }}
                >
                  {canIssueQr ? <Calendar size={14} /> : <MessageSquare size={14} />}
                  <span>{canIssueQr ? 'Solicitar visita' : 'Consultar / Pedir presupuesto'}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Generar Nueva Orden de Pago desde Pase QR */}
      {showNewOrderForm && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => setShowNewOrderForm(false)}
        >
          <form
            onSubmit={handleCreateOrderFromPass}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden text-xs"
            style={cardStyle}
          >
            <div className="px-5 py-4 border-b border-white/10 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold">Nueva Orden de Pago</h3>
                <p className="text-[11px] opacity-75 mt-0.5">
                  Seleccioná el pase de la visita realizada, detallá el trabajo y cargá el monto acordado.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewOrderForm(false)}
                aria-label="Cerrar ventana"
                className="p-1 rounded-lg opacity-75 hover:opacity-100 cursor-pointer shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              {eligibleOrderPasses.length === 0 ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 rounded-xl border border-amber-500/35 bg-amber-950/25 text-amber-100">
                  <span>
                    Aún no tenés pases QR elegibles. Emití primero un pase en Pases QR o elegí un prestador en Prestadores.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewOrderForm(false);
                      setActiveStep('passes');
                    }}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white cursor-pointer shrink-0"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Ir a Pases QR
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[11px] opacity-80 mb-1">Pase QR / Prestador</label>
                    <select
                      value={orderPassId || String(eligibleOrderPasses[0]?.id || '')}
                      onChange={(e) => setOrderPassId(e.target.value)}
                      className={`w-full ${FIELD_INPUT_CLASS}`}
                      style={innerStyle}
                    >
                      {eligibleOrderPasses.map((pass) => {
                        const passStatusLabel = getUnifiedStatusMeta(pass.status, 'pass').label;
                        const providerName = pass.provider_name || `Prestador #${pass.provider_id}`;
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
                      style={innerStyle}
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
                      style={innerStyle}
                    />
                  </div>

                  {Number(orderAmount) > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] px-3 py-2 rounded-xl border border-white/10 bg-black/25">
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
                </>
              )}
            </div>

            <div
              className="px-5 py-3.5 border-t border-white/10 flex items-center justify-end gap-2"
              style={innerStyle}
            >
              <button
                type="button"
                onClick={() => setShowNewOrderForm(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold border border-white/15 cursor-pointer hover:opacity-90"
                style={cardStyle}
              >
                Cancelar
              </button>
              {eligibleOrderPasses.length > 0 && (
                <button
                  type="submit"
                  disabled={creatingOrder}
                  className="text-white font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Plus size={13} />
                  <span>{creatingOrder ? 'Creando orden...' : 'Crear Orden de Pago'}</span>
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Modal unificado: Detalle de Visita o Servicio (divulgación progresiva de Mis Servicios) */}
      {selectedServiceEntry && (() => {
        const closeDetailModal = () => {
          setSelectedServiceKey(null);
          setCounterVisitId(null);
          setRequestingQuoteChangesId(null);
          setQuoteChangesDraft('');
        };

        if (selectedServiceEntry.kind === 'visit') {
          const {
            visit,
            meta,
            matchedProvider,
            canIssueQr,
            linkedPasses = [],
            activePass,
            hasActiveOrUsedPass,
            passIsUsed,
            hasPendingQuote,
            quoteChangesRequested,
            quoteAmount,
            providerDisplay,
            specialty: visitSpecialtyLabel,
            serviceTitle,
          } = selectedServiceEntry;
          const msgs = Array.isArray(visit.messages) ? visit.messages : [];
          const isCountering = counterVisitId === visit.id;
          const isRequestingQuoteChanges = requestingQuoteChangesId === visit.id;
          const visitTrustLevel = Number(
            matchedProvider?.trust_level ?? matchedProvider?.trust_badge?.level ?? 0
          );
          const visitBadgeLabel = hasPendingQuote
            ? 'Presupuesto recibido'
            : quoteChangesRequested
              ? 'Ajuste solicitado'
              : passIsUsed
                ? 'Ingreso registrado'
                : hasActiveOrUsedPass
                  ? 'Pase QR vigente'
                  : meta.isConfirmed && !canIssueQr
                    ? 'Acordada · Sin Pase QR'
                    : meta.label;
          const visitBadgeCls = hasPendingQuote
            ? 'bg-amber-500/20 text-amber-200 border-amber-400/50'
            : quoteChangesRequested
              ? 'bg-amber-500/10 text-amber-200 border-amber-400/35'
              : passIsUsed
                ? 'bg-sky-500/15 text-sky-200 border-sky-400/45'
                : hasActiveOrUsedPass
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : meta.isConfirmed && !canIssueQr
                    ? 'bg-amber-500/15 text-amber-200 border-amber-500/40'
                    : meta.badgeClass;

          return (
            <div
              className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
              onClick={closeDetailModal}
            >
              <div
                className="w-full max-w-xl rounded-2xl border border-slate-700/80 shadow-2xl flex flex-col max-h-[88vh] overflow-hidden text-xs"
                style={cardStyle}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Cabecera del Modal de Visita (centrada en el servicio) */}
                <div className="px-5 py-4 border-b border-white/10 flex items-start justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <ProviderAvatar
                      name={providerDisplay}
                      level={visitTrustLevel}
                      isDanger={Boolean(matchedProvider?.has_expired_docs)}
                      size="md"
                    />
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black truncate">{serviceTitle}</h3>
                        {visitSpecialtyLabel && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                            {visitSpecialtyLabel}
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${visitBadgeCls}`}
                        >
                          {visitBadgeLabel}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-75">
                        con <strong className="opacity-95">{providerDisplay}</strong> · Visita #{visit.id} ·{' '}
                        {formatVisitAddress(visit.fraction_number, visit.lot_number)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeDetailModal}
                    aria-label="Cerrar detalle de visita"
                    className="p-1.5 rounded-lg opacity-75 hover:opacity-100 cursor-pointer shrink-0"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Cuerpo desplazable del Modal de Visita */}
                <div className="p-5 overflow-y-auto tl-scroll space-y-4 flex-1">
                  {/* Progreso de hitos (solo en visitas activas) */}
                  {!meta.isClosed && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                      <span
                        className={`px-2.5 py-1 rounded-lg border ${
                          meta.isConfirmed
                            ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                            : 'border-sky-400/40 bg-sky-500/10 text-sky-200'
                        }`}
                      >
                        {meta.isConfirmed ? '✓ Visita acordada' : '● Coordinando visita'}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-lg border ${
                          hasPendingQuote
                            ? 'border-amber-400/55 bg-amber-500/15 text-amber-200'
                            : quoteChangesRequested
                              ? 'border-amber-400/40 bg-amber-500/10 text-amber-200'
                              : 'border-white/10 opacity-50'
                        }`}
                      >
                        {hasPendingQuote
                          ? '● Presupuesto recibido'
                          : quoteChangesRequested
                            ? '● Ajuste pedido'
                            : '○ Presupuesto'}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-lg border ${
                          hasActiveOrUsedPass
                            ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                            : meta.isConfirmed && canIssueQr
                              ? 'border-amber-400/40 bg-amber-500/10 text-amber-200'
                              : 'border-white/10 opacity-55'
                        }`}
                      >
                        {hasActiveOrUsedPass
                          ? '✓ Pase QR'
                          : meta.isConfirmed && canIssueQr
                            ? '● Pase QR listo'
                            : '○ Pase QR'}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-lg border ${
                          passIsUsed
                            ? 'border-amber-400/40 bg-amber-500/10 text-amber-200'
                            : 'border-white/10 opacity-45'
                        }`}
                      >
                        {passIsUsed ? '● Pago / Conf.' : '○ Pago / Conf.'}
                      </span>
                    </div>
                  )}

                  {/* Tarjeta de Presupuesto Recibido (Aprobar -> crea contrato automático / Pedir ajuste) */}
                  {hasPendingQuote && (
                    <div className="rounded-xl p-4 border border-amber-400/55 bg-amber-950/30 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 inline-flex items-center gap-1.5">
                            <FileText size={12} />
                            <span>Presupuesto formal recibido</span>
                          </span>
                          <p className="text-xs font-semibold leading-relaxed">
                            {visit.quote_description || serviceTitle}
                          </p>
                          {visit.quote_notes && (
                            <p className="text-[11px] opacity-80">{visit.quote_notes}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="block text-[10px] uppercase opacity-70 font-semibold">
                            Total
                          </span>
                          <span className="font-mono font-black text-lg text-amber-200">
                            ${quoteAmount.toLocaleString('es-AR')}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] opacity-80">
                        Si aprobás este presupuesto, se genera automáticamente la orden de servicio por{' '}
                        <strong className="font-mono">${quoteAmount.toLocaleString('es-AR')}</strong>{' '}
                        vinculada a este trabajo.
                      </p>

                      {!isRequestingQuoteChanges ? (
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <button
                            type="button"
                            disabled={respondingQuoteVisitId === visit.id}
                            onClick={() => handleRespondVisitQuote(visit.id, 'approve')}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50 shadow-sm"
                            style={{ backgroundColor: primaryColor }}
                          >
                            <CheckCircle2 size={14} />
                            <span>
                              {respondingQuoteVisitId === visit.id
                                ? 'Aprobando...'
                                : 'Aprobar presupuesto'}
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={respondingQuoteVisitId === visit.id}
                            onClick={() => {
                              setRequestingQuoteChangesId(visit.id);
                              setQuoteChangesDraft('');
                            }}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold border border-amber-400/45 text-amber-100 hover:bg-amber-900/40 cursor-pointer"
                          >
                            Pedir ajuste
                          </button>
                        </div>
                      ) : (
                        <div
                          className="rounded-xl p-3 border border-white/15 space-y-2"
                          style={cardStyle}
                        >
                          <label className="block text-[11px] font-bold text-amber-200">
                            ¿Qué te gustaría ajustar del presupuesto?
                          </label>
                          <input
                            type="text"
                            value={quoteChangesDraft}
                            onChange={(e) => setQuoteChangesDraft(e.target.value)}
                            placeholder="Ej: ¿Podemos hacerlo sin provisión de materiales o desglosar mano de obra?"
                            className={`w-full ${FIELD_INPUT_CLASS}`}
                            style={innerStyle}
                          />
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setRequestingQuoteChangesId(null);
                                setQuoteChangesDraft('');
                              }}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-white/15 cursor-pointer"
                              style={innerStyle}
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              disabled={respondingQuoteVisitId === visit.id}
                              onClick={() =>
                                handleRespondVisitQuote(
                                  visit.id,
                                  'request_changes',
                                  quoteChangesDraft
                                )
                              }
                              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white cursor-pointer disabled:opacity-50"
                            >
                              {respondingQuoteVisitId === visit.id
                                ? 'Enviando...'
                                : 'Enviar pedido de ajuste'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {quoteChangesRequested && (
                    <div className="rounded-xl p-3 border border-amber-500/35 bg-amber-950/25 text-amber-100 text-[11px] flex items-start gap-2">
                      <AlertCircle size={14} className="text-amber-300 shrink-0 mt-0.5" />
                      <span>
                        Pediste un ajuste sobre el presupuesto anterior
                        {quoteAmount > 0 ? ` ($${quoteAmount.toLocaleString('es-AR')})` : ''}.
                        Esperando nueva cotización del prestador.
                      </span>
                    </div>
                  )}

                  {/* Pases QR vinculados al expediente del servicio (soporta múltiples jornadas/visitas) */}
                  {linkedPasses.length > 0 && (
                    <div
                      className="rounded-xl p-3.5 border border-emerald-500/30 bg-emerald-950/20 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                          {linkedPasses.length === 1
                            ? 'Pase QR vinculado'
                            : `Pases QR del servicio (${linkedPasses.length})`}
                        </span>
                        {canIssueQr && !meta.isClosed && (
                          <button
                            type="button"
                            onClick={() => {
                              closeDetailModal();
                              openQrModalForProvider(matchedProvider, {
                                providerId: visit.provider_id,
                                visitRequestId: visit.id,
                              });
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-emerald-400/45 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 cursor-pointer"
                            title="Emitir un pase adicional para otra jornada o visita de ejecución del mismo servicio"
                          >
                            <Plus size={11} />
                            <span>Nuevo Pase QR</span>
                          </button>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        {linkedPasses.map((p) => {
                          const pStatus = getUnifiedStatusMeta(p.status, 'pass');
                          return (
                            <div
                              key={p.id}
                              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg border border-white/10 bg-black/20"
                            >
                              <div className="flex flex-wrap items-center gap-2 min-w-0">
                                <span className="font-bold">Pase #{p.id}</span>
                                <span
                                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${pStatus.cls}`}
                                >
                                  {pStatus.label}
                                </span>
                                <span className="text-[11px] opacity-80">
                                  {p.vehicle_plate ? `Patente ${p.vehicle_plate}` : 'Peatonal'}
                                  {p.start_time ? ` · ${formatDateTimeAR(p.start_time)}` : ''}
                                </span>
                              </div>
                              {p.qr_token && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    closeDetailModal();
                                    setViewingQrPass(p);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-white/15 bg-white/5 hover:bg-white/10 cursor-pointer shrink-0"
                                >
                                  <QrCode size={12} className="text-sky-300" />
                                  <span>Ver QR</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Resumen de horario y estado QR */}
                  <div
                    className="rounded-xl p-3.5 border border-white/10 flex flex-wrap items-center justify-between gap-2"
                    style={innerStyle}
                  >
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-65">
                        Horario coordinado
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

                    {meta.isConfirmed && !canIssueQr && (
                      <span className="text-[11px] text-amber-200 font-semibold inline-flex items-center gap-1">
                        <AlertCircle size={13} />
                        <span>Prestador en verificación para Pase QR</span>
                      </span>
                    )}
                  </div>

                  {/* Contrapropuesta de horario con agenda viva */}
                  {meta.isPendingResident && (
                    <div className="rounded-xl p-3.5 border border-sky-400/45 bg-sky-950/35 space-y-2.5">
                      <p className="text-sky-100 font-semibold">
                        El prestador propuso repactar la visita. Si te queda bien, aceptá para acordar la visita y habilitar el Pase QR.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={respondingResidentVisitId === visit.id}
                          onClick={() => handleResidentVisitResponse(visit.id, 'accept')}
                          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <CheckCircle2 size={13} />
                          {respondingResidentVisitId === visit.id
                            ? 'Confirmando...'
                            : 'Aceptar horario y habilitar QR'}
                        </button>
                        <button
                          type="button"
                          disabled={respondingResidentVisitId === visit.id}
                          onClick={() =>
                            isCountering
                              ? setCounterVisitId(null)
                              : openResidentCounterPropose(visit)
                          }
                          className="px-3 py-2 rounded-xl text-xs font-bold border border-sky-400/45 text-sky-100 hover:bg-sky-900/40 cursor-pointer"
                        >
                          {isCountering ? 'Cerrar agenda' : 'Proponer otro horario'}
                        </button>
                      </div>

                      {isCountering && (
                        <div
                          className="rounded-xl p-3 border border-white/15 space-y-2.5 mt-1"
                          style={cardStyle}
                        >
                          <p className="font-bold text-[11px] flex items-center gap-1.5">
                            <Calendar size={12} className="text-emerald-400" />
                            <span>Elegí un horario libre de la agenda del prestador</span>
                          </p>

                          {loadingCounterAvail ? (
                            <p className="text-[11px] opacity-75">Consultando disponibilidad...</p>
                          ) : counterAvailability && Array.isArray(counterAvailability.days) ? (
                            (() => {
                              const dayObj =
                                counterAvailability.days.find((d) => d.date === selectedCounterDay) ||
                                counterAvailability.days[0];
                              return (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 tl-scroll">
                                    {counterAvailability.days.map((day) => {
                                      const picked = dayObj?.date === day.date;
                                      const parts = String(day.date || '').split('-');
                                      return (
                                        <button
                                          key={day.date}
                                          type="button"
                                          onClick={() => setSelectedCounterDay(day.date)}
                                          className={`px-2 py-1 rounded-lg border text-[10px] font-bold shrink-0 cursor-pointer ${
                                            picked
                                              ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                                              : day.is_working
                                                ? 'border-white/15'
                                                : 'border-white/10 opacity-45'
                                          }`}
                                          style={picked ? undefined : innerStyle}
                                        >
                                          {day.short_label} {parts[2]}/{parts[1]} (
                                          {day.is_working ? `${day.available_count}` : '0'})
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {dayObj && dayObj.is_working && dayObj.slots.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto tl-scroll">
                                      {dayObj.slots.map((slot) => {
                                        const val = `${dayObj.date}T${slot.time}`;
                                        const avail = slot.status === 'available';
                                        const chosen = counterVisitDate === val;
                                        return (
                                          <button
                                            key={slot.start_iso}
                                            type="button"
                                            disabled={!avail}
                                            onClick={() => setCounterVisitDate(val)}
                                            className={`px-2 py-1 rounded font-mono text-[10px] font-bold border ${
                                              chosen
                                                ? 'border-emerald-300 text-white cursor-pointer'
                                                : avail
                                                  ? 'border-emerald-500/35 bg-emerald-950/35 text-emerald-200 cursor-pointer'
                                                  : 'border-white/10 opacity-35 line-through cursor-not-allowed'
                                            }`}
                                            style={chosen ? { backgroundColor: primaryColor } : undefined}
                                          >
                                            {slot.time}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-[11px] opacity-75">Sin franjas libres este día.</p>
                                  )}
                                </div>
                              );
                            })()
                          ) : null}

                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="datetime-local"
                              value={counterVisitDate}
                              onChange={(e) => setCounterVisitDate(e.target.value)}
                              className="flex-1 px-2.5 py-1.5 rounded-xl border border-slate-700/80 text-xs"
                              style={innerStyle}
                            />
                            <button
                              type="button"
                              disabled={respondingResidentVisitId === visit.id}
                              onClick={() =>
                                handleResidentVisitResponse(visit.id, 'propose', counterVisitDate)
                              }
                              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50 shrink-0"
                              style={{ backgroundColor: primaryColor }}
                            >
                              Enviar nueva propuesta
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Chat dedicado de la visita */}
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
                              {m.sender_role === 'provider' ? 'Prestador:' : 'Vos:'}
                            </strong>
                            <span>{m.text}</span>
                          </p>
                        ))
                      )}
                    </div>

                    {!meta.isClosed && (
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
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (followupDrafts[visit.id] || '').trim()) {
                              e.preventDefault();
                              handleSendFollowupMessage(visit.id);
                            }
                          }}
                          placeholder="Escribí un mensaje para el prestador..."
                          className={`flex-1 ${FIELD_INPUT_CLASS}`}
                          style={innerStyle}
                        />
                        <button
                          type="button"
                          disabled={sendingFollowupId === visit.id}
                          onClick={() => handleSendFollowupMessage(visit.id)}
                          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-white/15 bg-white/5 hover:bg-white/10 cursor-pointer shrink-0"
                        >
                          <Send size={13} />
                          <span>Enviar</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pie fijo del Modal de Visita */}
                <div
                  className="px-5 py-3.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 shrink-0"
                  style={innerStyle}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={closeDetailModal}
                      className="px-3.5 py-2 rounded-xl font-bold border border-white/15 cursor-pointer hover:opacity-90"
                      style={cardStyle}
                    >
                      Cerrar
                    </button>
                    {meta.isPendingProvider && (
                      <button
                        type="button"
                        disabled={respondingResidentVisitId === visit.id}
                        onClick={() => handleResidentVisitResponse(visit.id, 'cancel')}
                        className="text-rose-300 hover:text-rose-200 font-bold text-xs cursor-pointer"
                      >
                        Cancelar solicitud
                      </button>
                    )}
                  </div>

                  {hasActiveOrUsedPass ? (
                    <button
                      type="button"
                      onClick={() => {
                        closeDetailModal();
                        openOrderModalForService({
                          passId: activePass.id,
                          visitId: visit.id,
                          description: serviceTitle,
                        });
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer shadow-sm"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <CreditCard size={14} />
                      <span>Registrar pago</span>
                    </button>
                  ) : meta.isConfirmed && canIssueQr ? (
                    <button
                      type="button"
                      onClick={() => {
                        closeDetailModal();
                        openQrModalForProvider(matchedProvider, {
                          providerId: visit.provider_id,
                          visitRequestId: visit.id,
                          preferredDate: visit.preferred_date,
                          preferredEndDate: visit.preferred_end_date,
                        });
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer shadow-sm"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <QrCode size={14} />
                      <span>Emitir Pase QR</span>
                    </button>
                  ) : meta.isClosed ? (
                    <button
                      type="button"
                      onClick={() => {
                        closeDetailModal();
                        openVisitModalForProvider(matchedProvider);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-sky-400/45 bg-sky-500/12 text-sky-100 hover:bg-sky-500/22 cursor-pointer"
                    >
                      <Calendar size={13} />
                      <span>Solicitar nueva visita</span>
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        }

        // Detalle de Contrato / Servicio
        const {
          contract,
          reviewInfo,
          linkedPass,
          linkedPasses = [],
          linkedVisit,
          providerDisplay,
          specialty,
          isCompleted,
          hasRatedProvider,
          hasOpenDispute,
        } = selectedServiceEntry;
        const cid = contract.id;
        const matchedContractProvider =
          providers.find(
            (p) =>
              Number(p.provider_id || p.id) === Number(contract.provider_id) ||
              (Array.isArray(p.provider_ids) &&
                p.provider_ids.map(Number).includes(Number(contract.provider_id)))
          ) || null;
        const canIssueExtraPassForContract = Boolean(
          !isCompleted &&
            matchedContractProvider &&
            matchedContractProvider.can_issue_pass !== false &&
            !matchedContractProvider.has_expired_docs &&
            Number(matchedContractProvider.trust_level ?? matchedContractProvider.trust_badge?.level ?? 0) >= 3
        );
        const totalAmount = Number(contract.agreed_amount || contract.amount || 0);
        const feePercent = Number(gatewayConfig.platform_fee_percent ?? 7);
        const feeAmount = Number(((totalAmount * feePercent) / 100).toFixed(2));
        const payoutAmount = Number((totalAmount - feeAmount).toFixed(2));
        const isPending = String(contract.status || '').toLowerCase() === 'pending';
        const isInProgress = String(contract.status || '').toLowerCase() === 'in_progress';
        const statusMeta = getUnifiedStatusMeta(contract.status, 'contract');

        return (
          <div
            className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
            onClick={closeDetailModal}
          >
            <div
              className="w-full max-w-xl rounded-2xl border border-slate-700/80 shadow-2xl flex flex-col max-h-[88vh] overflow-hidden text-xs"
              style={cardStyle}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Cabecera del Modal de Servicio (centrada en el trabajo) */}
              <div className="px-5 py-4 border-b border-white/10 flex items-start justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <ProviderAvatar name={providerDisplay} level={3} size="md" />
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-black truncate">
                        {String(contract.description || '').trim() ||
                          (specialty ? `Servicio de ${specialty}` : `Servicio #${cid}`)}
                      </h3>
                      {specialty && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                          {specialty}
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusMeta.cls}`}
                      >
                        {statusMeta.label}
                      </span>
                    </div>
                    <p className="text-[11px] opacity-75">
                      con <strong className="opacity-95">{providerDisplay}</strong> · Servicio #{cid}
                      {contract.created_at ? ` · ${formatDateTimeAR(contract.created_at)}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeDetailModal}
                  aria-label="Cerrar detalle de servicio"
                  className="p-1.5 rounded-lg opacity-75 hover:opacity-100 cursor-pointer shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Cuerpo desplazable del Modal de Servicio */}
              <div className="p-5 overflow-y-auto tl-scroll space-y-4 flex-1">
                {/* Progreso de hitos */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                  <span className="px-2.5 py-1 rounded-lg border border-emerald-500/35 bg-emerald-500/10 text-emerald-300">
                    ✓ Visita
                  </span>
                  {linkedVisit?.quote_status === 'approved' && (
                    <span className="px-2.5 py-1 rounded-lg border border-emerald-500/35 bg-emerald-500/10 text-emerald-300">
                      {linkedVisit?.service_package_id ? '✓ Precio fijo' : '✓ Presupuesto'}
                    </span>
                  )}
                  <span
                    className={`px-2.5 py-1 rounded-lg border ${
                      contract.pass_id || linkedPass
                        ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                        : 'border-white/10 opacity-55'
                    }`}
                  >
                    {contract.pass_id || linkedPass ? '✓ Pase QR' : '○ Pase QR'}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-lg border ${
                      isCompleted
                        ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                        : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                    }`}
                  >
                    {isCompleted ? '✓ Conformidad' : '● Pago / Conf.'}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-lg border ${
                      hasRatedProvider
                        ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                        : 'border-white/15 opacity-70'
                    }`}
                  >
                    {hasRatedProvider ? '✓ Reseña' : '○ Reseña'}
                  </span>
                </div>

                {/* Descripción + desglose económico */}
                <div className="rounded-xl p-4 border border-white/10 space-y-2.5" style={innerStyle}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-65">
                        Trabajo acordado
                      </span>
                      <p className="text-xs font-semibold opacity-95">
                        {contract.description || 'Servicio registrado en TrustLink'}
                      </p>
                      {contract.completed_at && (
                        <p className="text-[11px] text-emerald-300/90">
                          Conformidad registrada el {formatDateTimeAR(contract.completed_at)}
                        </p>
                      )}
                    </div>
                    <span className="font-mono font-black text-base shrink-0">
                      ${totalAmount.toLocaleString('es-AR')}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] opacity-75">
                    <span>
                      Comisión TrustLink ({feePercent}%):{' '}
                      <strong className="font-mono">${feeAmount.toLocaleString('es-AR')}</strong>
                    </span>
                    <span>
                      Neto prestador ({100 - feePercent}%):{' '}
                      <strong className="font-mono text-emerald-300">
                        ${payoutAmount.toLocaleString('es-AR')}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Reseñas emitidas/recibidas o formulario de calificación */}
                {(hasRatedProvider || reviewInfo?.owner_review_rating) && (
                  <div
                    className={`grid grid-cols-1 ${
                      hasRatedProvider && reviewInfo?.owner_review_rating ? 'sm:grid-cols-2' : ''
                    } gap-2.5`}
                  >
                    {hasRatedProvider && (
                      <div className="rounded-xl p-3 bg-emerald-950/25 border border-emerald-800/40 space-y-1">
                        <span className="font-bold text-emerald-300">
                          Tu reseña: ★ {reviewInfo.provider_review_rating}/5
                        </span>
                        {reviewInfo.provider_review_comment && (
                          <p className="opacity-85 italic">
                            “{reviewInfo.provider_review_comment}”
                          </p>
                        )}
                        {Array.isArray(reviewInfo.provider_review_tags) &&
                          reviewInfo.provider_review_tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {reviewInfo.provider_review_tags.map((tag) => (
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
                    )}
                    {reviewInfo?.owner_review_rating && (
                      <div className="rounded-xl p-3 bg-sky-950/25 border border-sky-800/40 space-y-1">
                        <span className="font-bold text-sky-300">
                          El prestador te calificó: ★ {reviewInfo.owner_review_rating}/5
                        </span>
                        {reviewInfo.owner_review_comment && (
                          <p className="opacity-85 italic">“{reviewInfo.owner_review_comment}”</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {!hasRatedProvider && (
                  <div
                    className="rounded-xl p-3.5 border border-emerald-500/35 space-y-2.5"
                    style={innerStyle}
                  >
                    <p className="font-bold text-emerald-300 flex items-center gap-1.5">
                      <Star size={13} />
                      <span>Calificá tu experiencia con {providerDisplay}</span>
                    </p>
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
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <select
                        value={ratingByContract[cid] ?? 5}
                        onChange={(e) =>
                          setRatingByContract((prev) => ({
                            ...prev,
                            [cid]: Number(e.target.value),
                          }))
                        }
                        className="sm:col-span-4 px-3 py-2 rounded-xl text-xs border border-slate-700/80"
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
                        placeholder="Comentario breve sobre el servicio..."
                        className="sm:col-span-8 px-3 py-2 rounded-xl text-xs border border-slate-700/80"
                        style={cardStyle}
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={submittingReviewId === cid}
                        onClick={() => handleSubmitProviderReview(cid)}
                        className="py-1.5 px-4 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {submittingReviewId === cid ? 'Guardando...' : 'Enviar reseña'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Pases QR del expediente del servicio (soporta múltiples jornadas) */}
                {(linkedPasses.length > 0 || canIssueExtraPassForContract) && (
                  <div className="rounded-xl p-3.5 border border-white/10 space-y-2" style={innerStyle}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                        {linkedPasses.length > 1
                          ? `Pases QR del servicio (${linkedPasses.length})`
                          : 'Pase QR en garita'}
                      </span>
                      {canIssueExtraPassForContract && (
                        <button
                          type="button"
                          onClick={() => {
                            closeDetailModal();
                            openQrModalForProvider(matchedContractProvider, {
                              providerId: contract.provider_id,
                              visitRequestId: linkedVisit?.id || contract.visit_request_id || null,
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-emerald-400/45 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 cursor-pointer"
                        >
                          <Plus size={11} />
                          <span>Nuevo Pase QR</span>
                        </button>
                      )}
                    </div>
                    {linkedPasses.length > 0 && (
                      <div className="space-y-1.5">
                        {linkedPasses.map((p) => {
                          const pStatus = getUnifiedStatusMeta(p.status, 'pass');
                          return (
                            <div
                              key={p.id}
                              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg border border-white/10 bg-black/20"
                            >
                              <div className="flex flex-wrap items-center gap-2 min-w-0">
                                <span className="font-bold">Pase #{p.id}</span>
                                <span
                                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${pStatus.cls}`}
                                >
                                  {pStatus.label}
                                </span>
                                <span className="text-[11px] opacity-80">
                                  {p.vehicle_plate ? `Patente ${p.vehicle_plate}` : 'Peatonal'}
                                  {p.start_time ? ` · ${formatDateTimeAR(p.start_time)}` : ''}
                                </span>
                              </div>
                              {p.qr_token && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    closeDetailModal();
                                    setViewingQrPass(p);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-white/15 bg-white/5 hover:bg-white/10 cursor-pointer shrink-0"
                                >
                                  <QrCode size={12} className="text-sky-300" />
                                  <span>Ver QR</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Historial de mensajes de la visita vinculada (expediente completo punta a punta) */}
                {linkedVisit && Array.isArray(linkedVisit.messages) && linkedVisit.messages.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider opacity-70 inline-flex items-center gap-1.5">
                      <MessageSquare size={12} />
                      <span>Historial de coordinación · Visita #{linkedVisit.id} ({linkedVisit.messages.length})</span>
                    </span>
                    <div
                      className="rounded-xl p-3 border border-white/10 space-y-1.5 max-h-36 overflow-y-auto tl-scroll"
                      style={innerStyle}
                    >
                      {linkedVisit.messages.map((m, idx) => (
                        <p key={m.id || idx} className="text-xs leading-relaxed">
                          <strong
                            className={`uppercase text-[10px] mr-1.5 ${
                              m.sender_role === 'provider' ? 'text-emerald-300' : 'text-sky-300'
                            }`}
                          >
                            {m.sender_role === 'provider' ? 'Prestador:' : 'Vos:'}
                          </strong>
                          <span>{m.text}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Documentos y soporte secundario (Reclamo fuera del listado principal) */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {(isInProgress || isCompleted) && (
                      <button
                        type="button"
                        disabled={loadingReceiptId === cid}
                        onClick={() => handleOpenReceipt(cid)}
                        className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold border border-white/15 bg-white/5 hover:bg-white/10 cursor-pointer disabled:opacity-50"
                      >
                        <FileText size={12} className="text-emerald-400" />
                        <span>{loadingReceiptId === cid ? 'Cargando...' : 'Ver comprobante'}</span>
                      </button>
                    )}
                    {linkedPass?.qr_token && (
                      <button
                        type="button"
                        onClick={() => {
                          closeDetailModal();
                          setViewingQrPass(linkedPass);
                        }}
                        className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold border border-white/15 bg-white/5 hover:bg-white/10 cursor-pointer"
                      >
                        <QrCode size={12} className="text-sky-300" />
                        <span>Ver Pase QR</span>
                      </button>
                    )}
                  </div>

                  {(isInProgress || isCompleted) && !hasOpenDispute && (
                    <button
                      type="button"
                      onClick={() => {
                        closeDetailModal();
                        setDisputeModalContract(contract);
                        setDisputeReason('Trabajo incompleto o con fallas');
                        setDisputeDetails('');
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-300/85 hover:text-rose-200 hover:underline cursor-pointer"
                    >
                      <AlertCircle size={12} />
                      <span>Reportar un problema</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Pie fijo del Modal de Servicio */}
              <div
                className="px-5 py-3.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 shrink-0"
                style={innerStyle}
              >
                <button
                  type="button"
                  onClick={closeDetailModal}
                  className="px-3.5 py-2 rounded-xl font-bold border border-white/15 cursor-pointer hover:opacity-90"
                  style={cardStyle}
                >
                  Cerrar
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  {isPending ? (
                    <>
                      <button
                        type="button"
                        disabled={completingContractId === cid}
                        onClick={() => handleCompleteContract(cid)}
                        className="py-2 px-3 rounded-xl text-xs font-bold border border-white/15 hover:opacity-90 cursor-pointer disabled:opacity-50"
                        style={cardStyle}
                        title="Registrar conformidad si abonaste en efectivo o acuerdo directo"
                      >
                        {completingContractId === cid ? 'Guardando...' : 'Conformidad (Efectivo)'}
                      </button>
                      <button
                        type="button"
                        disabled={payingContractId === cid}
                        onClick={() => handlePayContract(cid)}
                        className="py-2 px-4 rounded-xl text-xs font-bold text-white hover:opacity-95 cursor-pointer disabled:opacity-50"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {payingContractId === cid ? 'Procesando...' : 'Confirmar y Pagar'}
                      </button>
                    </>
                  ) : isInProgress ? (
                    <button
                      type="button"
                      disabled={completingContractId === cid}
                      onClick={() => handleCompleteContract(cid)}
                      className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-bold text-white hover:opacity-95 cursor-pointer disabled:opacity-50"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <CheckCircle2 size={13} />
                      <span>{completingContractId === cid ? 'Registrando...' : 'Dar Conformidad'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        closeDetailModal();
                        handleRehireProvider(contract.provider_id, providerDisplay);
                      }}
                      className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-bold border border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 cursor-pointer"
                    >
                      <RotateCcw size={13} />
                      <span>Volver a contratar</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal de bienvenida / primer ingreso: Completar barrio y lote del Residente */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div
            className="w-full max-w-md rounded-2xl p-6 border border-slate-700/80 shadow-2xl space-y-4 text-xs"
            style={cardStyle}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  <MapPin size={13} />
                  <span>Tu domicilio en TrustLink</span>
                </div>
                <h3 className="text-base font-extrabold">Indicá tu barrio y lote</h3>
                <p className="text-[11px] opacity-80 leading-relaxed">
                  Esta información es importante para personalizar tu navegación en el directorio de
                  prestadores, ver actividad en tu comunidad y habilitar Pases QR en garita.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLocationModal(false)}
                aria-label="Cerrar ventana"
                className="p-1 rounded-lg opacity-75 hover:opacity-100 cursor-pointer shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {locationFeedback && (
              <div className="rounded-xl p-3 border border-rose-500/45 bg-rose-950/50 text-rose-200 flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-400" />
                <span>{locationFeedback}</span>
              </div>
            )}

            <form onSubmit={handleSaveResidentLocation} className="space-y-3">
              <div className="space-y-1.5">
                <label className="block font-semibold opacity-90">Comunidad / Barrio</label>
                <SearchableSelect
                  value={locCountryId}
                  onChange={(nextVal) => setLocCountryId(nextVal)}
                  options={locationCountries.map((c) => ({
                    value: String(c.id),
                    label: c.name,
                    subtitle: [c.city, c.province].filter(Boolean).join(', '),
                  }))}
                  placeholder="Buscar o seleccionar comunidad / barrio..."
                  searchPlaceholder="Escribí para buscar tu barrio..."
                  emptyMessage="No encontramos ese barrio en la lista."
                  extraAction={{
                    value: '__propose__',
                    label: 'Mi barrio no figura — Proponer comunidad',
                    description: 'Se envía a validación de TrustLink',
                  }}
                  triggerStyle={innerStyle}
                  panelStyle={cardStyle}
                  ariaLabel="Seleccionar comunidad o barrio"
                />

                {locCountryId === '__propose__' ? (
                  <div className="rounded-xl p-3 border border-amber-500/40 bg-amber-950/25 space-y-2">
                    <p className="text-[11px] font-bold text-amber-200">
                      Proponer nueva comunidad / barrio
                    </p>
                    <input
                      type="text"
                      required
                      maxLength={120}
                      value={locProposedName}
                      onChange={(e) => setLocProposedName(e.target.value)}
                      placeholder="Nombre del barrio o country *"
                      className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                      style={cardStyle}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        maxLength={100}
                        value={locProposedCity}
                        onChange={(e) => setLocProposedCity(e.target.value)}
                        placeholder="Localidad (ej. Pilar, Tigre...)"
                        className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                        style={cardStyle}
                      />
                      <input
                        type="text"
                        maxLength={100}
                        value={locProposedProvince}
                        onChange={(e) => setLocProposedProvince(e.target.value)}
                        placeholder="Provincia (ej. Buenos Aires)"
                        className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                        style={cardStyle}
                      />
                    </div>
                    <p className="text-[10px] text-amber-200/90 leading-snug">
                      Tu propuesta quedará en validación de TrustLink y asociada a tu cuenta desde
                      ahora.
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] opacity-70">
                    ¿No encontrás tu barrio? Elegí <strong>Mi barrio no figura</strong> dentro del
                    buscador para proponerlo, o tocá <strong>Omitir por ahora</strong>.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="block font-semibold opacity-90">Tipo de área</label>
                  <select
                    value={locFractionType}
                    onChange={(e) => {
                      const next = e.target.value;
                      setLocFractionType(next);
                      if (next === 'na') setLocFractionNumber('');
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                    style={innerStyle}
                  >
                    <option value="na">No aplica</option>
                    <option value="manzana">Manzana</option>
                    <option value="fraccion">Fracción</option>
                  </select>
                </div>

                {locFractionType !== 'na' && (
                  <div className="space-y-1">
                    <label className="block font-semibold opacity-90">
                      N° {locFractionType === 'manzana' ? 'Manzana' : 'Fracción'}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={locFractionNumber}
                      onChange={(e) => setLocFractionNumber(e.target.value.replace(/\D+/g, ''))}
                      placeholder="Ej. 4"
                      className="w-full px-3 py-2.5 rounded-xl border border-white/15 text-xs font-mono focus:outline-none"
                      style={innerStyle}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="block font-semibold opacity-90">N° de Lote</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={locLotNumber}
                  onChange={(e) => setLocLotNumber(e.target.value.replace(/\D+/g, ''))}
                  placeholder="Ej. 18"
                  className="w-full px-3 py-2.5 rounded-xl border border-white/15 text-xs font-mono focus:outline-none"
                  style={innerStyle}
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLocationModal(false)}
                  className="px-4 py-2 rounded-xl font-bold border border-white/15 opacity-85 hover:opacity-100 cursor-pointer"
                  style={innerStyle}
                >
                  Omitir por ahora
                </button>
                <button
                  type="submit"
                  disabled={savingLocation}
                  className="px-4 py-2 rounded-xl font-bold text-white hover:opacity-95 cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  {savingLocation ? 'Guardando...' : 'Guardar mi domicilio'}
                </button>
              </div>
            </form>
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