/**
 * @file ResidentDashboard.jsx
 * @description Portal del Residente alineado con la evolución de la plataforma:
 * pasos ordenados (1. Prestadores, 2. Visitas, 3. Pases QR, 4. Visitas y Pagos, 5. Reseñas),
 * estado de contacto/confirmación en la tarjeta del prestador, navegación directa a Visitas,
 * íconos consistentes en los títulos de sección y respeto a los colores por zona (BrandingContext).
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
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';
import { useAuth } from '../auth/AuthContext';
import { API_BASE } from '../../config/api';
import QrCodeDisplay from '../../components/QrCodeDisplay';
import {
  PAGE_SHELL_CLASS,
  SECTION_CARD_CLASS,
  ITEMS_GRID_CLASS,
  ITEM_CARD_CLASS,
  FIELD_INPUT_CLASS,
  formatDateTimeAR,
  getUnifiedStatusMeta,
} from '../../config/uiTokens';

const QUICK_SPECIALTIES = [
  'Todos',
  'Electricista',
  'Gasista',
  'Plomero',
  'Jardinería',
  'Aire Acondicionado',
];

const PASSES_PER_PAGE = 6;

const toLocalDateTimeInput = (dateObj) => {
  const pad = (n) => String(n).padStart(2, '0');
  const y = dateObj.getFullYear();
  const m = pad(dateObj.getMonth() + 1);
  const d = pad(dateObj.getDate());
  const hh = pad(dateObj.getHours());
  const mm = pad(dateObj.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
};

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

export default function ResidentDashboard({ onNavigate }) {
  const { brand } = useBranding();
  const { user } = useAuth();

  // Paso activo: 'providers' | 'visits' | 'passes' | 'payments' | 'reviews'
  const [activeStep, setActiveStep] = useState('providers');

  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [providersError, setProvidersError] = useState('');
  const [searchTerm, setSearchTerm] = useState(() => {
    const saved = sessionStorage.getItem('trustlink_initial_service_query');
    if (saved && saved.trim()) {
      sessionStorage.removeItem('trustlink_initial_service_query');
      return saved.trim();
    }
    return '';
  });
  const [selectedSpecialty, setSelectedSpecialty] = useState('Todos');

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

  // Contratos / Pagos
  const [contracts, setContracts] = useState([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [payingContractId, setPayingContractId] = useState(null);
  const [paymentFeedback, setPaymentFeedback] = useState({ type: '', text: '' });

  // Reseñas y reputación cruzada
  const [reviewContracts, setReviewContracts] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [ratingByContract, setRatingByContract] = useState({});
  const [commentByContract, setCommentByContract] = useState({});
  const [submittingReviewId, setSubmittingReviewId] = useState(null);
  const [reviewFeedback, setReviewFeedback] = useState({ type: '', text: '' });

  const primaryColor = brand?.primaryActionColor || '#059669';

  const cardStyle = {
    backgroundColor: brand?.cardBgColor || '#020617',
    color: brand?.cardTextColor || '#F1F5F9',
  };

  const innerStyle = {
    backgroundColor: brand?.innerBgColor || '#0F172A',
    color: brand?.innerTextColor || '#E2E8F0',
  };

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
  });

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

  useEffect(() => {
    fetchVerifiedProviders();
    fetchMyVisits();
    fetchMyPasses();
    fetchContractsData();
    fetchReviewsData();
  }, []);

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

  const availableSpecialties = useMemo(() => {
    const dbSpecialties = new Set();
    providers.forEach((p) => {
      const raw = String(p.specialty || '').trim();
      if (!raw) return;
      raw
        .split(/[·,|/]/)
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part) => dbSpecialties.add(part));
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

  const filteredProviders = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return providers.filter((p) => {
      const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
      const specialty = String(p.specialty || '').toLowerCase();
      const email = String(p.email || '').toLowerCase();

      const matchesSpecialty =
        selectedSpecialty === 'Todos' ||
        specialty.includes(selectedSpecialty.toLowerCase());

      const matchesQuery =
        !query ||
        fullName.includes(query) ||
        specialty.includes(query) ||
        email.includes(query);

      return matchesSpecialty && matchesQuery;
    });
  }, [providers, searchTerm, selectedSpecialty]);

  const openVisitModalForProvider = (provider) => {
    setVisitModalProvider(provider);
    setVisitFraction(user?.fraction_number || '');
    setVisitLot(user?.lot_number || '');
    setVisitDate(toLocalDateTimeInput(new Date(Date.now() + 60 * 60 * 1000)));
    setVisitNotes('');
    setVisitFeedback({ type: '', text: '' });
  };

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

  const openQrModalForProvider = (provider, prefill = {}) => {
    setQrModalProvider(provider);
    setFractionNumber(prefill.fraction ?? user?.fraction_number ?? '');
    setLotNumber(prefill.lot ?? user?.lot_number ?? '');
    const providerVehicles = Array.isArray(provider?.vehicles) ? provider.vehicles : [];
    setSelectedVehiclePlate(providerVehicles[0]?.plate || '');
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

  const toggleCreateEmployeeId = (empId) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const toggleEditEmployeeId = (empId) => {
    setEditPassEmployeeIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

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

  const totalPassPages = Math.max(1, Math.ceil(filteredPasses.length / PASSES_PER_PAGE));
  const paginatedPasses = useMemo(() => {
    const safePage = Math.min(passesPage, totalPassPages);
    const startIdx = (safePage - 1) * PASSES_PER_PAGE;
    return filteredPasses.slice(startIdx, startIdx + PASSES_PER_PAGE);
  }, [filteredPasses, passesPage, totalPassPages]);

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

  const pendingContractsCount = contracts.filter(
    (c) => String(c.status || '').toLowerCase() === 'pending'
  ).length;

  // Flujo alineado: 1. Prestadores -> 2. Visitas -> 3. Pases QR -> 4. Visitas y Pagos -> 5. Reseñas
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

      {/* PASO 1: PRESTADORES */}
      {activeStep === 'providers' && (
        <section className={SECTION_CARD_CLASS} style={cardStyle}>
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
                  placeholder="Buscar por nombre o especialidad..."
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

          <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap pb-1">
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

          {providersError && (
            <div className="rounded-xl p-4 border border-rose-800/70 bg-rose-950/50 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{providersError}</span>
            </div>
          )}

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

                return (
                  <article
                    key={providerId}
                    className={`${ITEM_CARD_CLASS} ${
                      isVerifiedMember ? 'border-amber-500/45 ring-1 ring-amber-500/20' : ''
                    }`}
                    style={innerStyle}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                            {provider.specialty || 'Servicio Verificado'}
                          </span>
                          {isVerifiedMember && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border border-amber-400/45 bg-amber-500/15 text-amber-200">
                              <Award size={11} className="text-amber-300 shrink-0" />
                              <span>{membershipBadgeLabel}</span>
                            </span>
                          )}
                          {hasExpiredDocs && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border border-rose-500/45 bg-rose-950/60 text-rose-200">
                              <AlertCircle size={11} className="text-rose-300 shrink-0" />
                              <span>Doc. vencida</span>
                            </span>
                          )}
                        </div>

                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border border-amber-500/30 bg-amber-500/10 text-amber-300 shrink-0">
                          <Star size={12} className="fill-amber-400 text-amber-400" />
                          {rating}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-sm font-bold">{fullName}</h3>
                        <p className="text-xs opacity-75 mt-0.5">
                          {jobsCount} {jobsCount === 1 ? 'trabajo registrado' : 'trabajos registrados'}
                        </p>
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
                        <div className="flex items-center justify-between text-[11px] opacity-65">
                          <span>Pase histórico ({statusMeta.label.toLowerCase()})</span>
                          <span>Solo consulta</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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

      {/* PASO 4: VISITAS Y PAGOS */}
      {activeStep === 'payments' && (
        <section className={SECTION_CARD_CLASS} style={cardStyle}>
          <div>
            <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
              <CreditCard size={18} className="text-emerald-400 shrink-0" />
              <span>Visitas y Órdenes de Pago</span>
            </h2>
            <p className="text-xs opacity-75">
              Revisá los contratos acordados con desglose de comisión (7% plataforma / 93% prestador).
            </p>
          </div>

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

          {loadingContracts ? (
            <p className="text-xs opacity-75 py-8 text-center">Cargando contratos y pagos...</p>
          ) : contracts.length === 0 ? (
            <div
              className="rounded-xl p-8 text-center text-xs opacity-75 border border-white/10"
              style={innerStyle}
            >
              No hay contratos registrados todavía. Podés emitir un pase QR en el Paso 3 o abrir Pagos y Reseñas en el menú superior.
            </div>
          ) : (
            <div className={ITEMS_GRID_CLASS}>
              {contracts.map((contract) => {
                const totalAmount = Number(contract.agreed_amount || contract.amount || 0);
                const feeAmount = Number((totalAmount * 0.07).toFixed(2));
                const payoutAmount = Number((totalAmount - feeAmount).toFixed(2));
                const isPending = String(contract.status || '').toLowerCase() === 'pending';
                const statusMeta = getUnifiedStatusMeta(contract.status, 'contract');

                return (
                  <div
                    key={contract.id}
                    className={ITEM_CARD_CLASS}
                    style={innerStyle}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold">
                          Contrato #{contract.id} ·{' '}
                          {contract.provider_name || `Prestador #${contract.provider_id}`}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border shrink-0 ${statusMeta.cls}`}
                        >
                          {statusMeta.label}
                        </span>
                      </div>

                      {contract.description && (
                        <p className="text-xs opacity-85">{contract.description}</p>
                      )}
                    </div>

                    <div className="space-y-3 pt-2 border-t border-white/10">
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="opacity-75">Monto acordado:</span>
                          <span className="font-bold font-mono">${totalAmount.toLocaleString('es-AR')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-75">Comisión TrustLink (7%):</span>
                          <span className="font-mono">${feeAmount.toLocaleString('es-AR')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-75">Neto prestador (93%):</span>
                          <span className="font-semibold font-mono text-emerald-400">
                            ${payoutAmount.toLocaleString('es-AR')}
                          </span>
                        </div>
                      </div>

                      {isPending && (
                        <button
                          type="button"
                          disabled={payingContractId === contract.id}
                          onClick={() => handlePayContract(contract.id)}
                          className="w-full py-2 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-95 cursor-pointer disabled:opacity-50"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {payingContractId === contract.id
                            ? 'Procesando pago...'
                            : 'Confirmar y Pagar'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* PASO 5: RESEÑAS */}
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

                    <div className="pt-2 border-t border-white/10">
                    {alreadyRatedProvider ? (
                      <div className="rounded-lg p-2.5 bg-emerald-950/30 border border-emerald-800/40 text-xs">
                        <span className="font-bold text-emerald-300">
                          Tu calificación al prestador: ★ {item.provider_review_rating}/5
                        </span>
                        {item.provider_review_comment && (
                          <p className="opacity-85 mt-0.5">“{item.provider_review_comment}”</p>
                        )}
                      </div>
                    ) : (
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
                    )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Modal de Solicitud / Coordinación de Visita */}
      {visitModalProvider && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div
            className="w-full max-w-md rounded-2xl p-6 border border-slate-700/80 shadow-2xl space-y-4"
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

            <QrCodeDisplay token={viewingQrPass.qr_token} size={200} />

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
    </div>
  );
}