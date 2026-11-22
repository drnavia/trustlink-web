/**
 * @file ResidentDashboard.jsx
 * @description Hub integral del Residente conectado 100% a PostgreSQL mediante API REST.
 * Organiza el flujo en 4 pasos clicables superiores (1. Prestadores, 2. Pases QR, 3. Visitas y Pagos,
 * 4. Reseñas) para gestionar todo desde el Portal Residente con UX/UI limpia y fiel a Zonas 4 y 5.
 * @location /trustlink-web/src/modules/owner/ResidentDashboard.jsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Star,
  QrCode,
  Search,
  AlertCircle,
  CheckCircle2,
  Briefcase,
  Phone,
  Mail,
  Copy,
  Check,
  X,
  Calendar,
  MapPin,
  Compass,
  Ticket,
  Ban,
  RefreshCw,
  Eye,
  CreditCard,
  FilePlus2,
  MessageSquare,
  Send
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';
import { useAuth } from '../auth/AuthContext';

const API_BASE = 'http://localhost:4000';
const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

function formatLocalDateTimeInput(dateObj) {
  const pad = (n) => String(n).padStart(2, '0');
  const year = dateObj.getFullYear();
  const month = pad(dateObj.getMonth() + 1);
  const day = pad(dateObj.getDate());
  const hours = pad(dateObj.getHours());
  const minutes = pad(dateObj.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseUtcTimestampMs(value, fallbackMs = null) {
  if (fallbackMs !== null && fallbackMs !== undefined && !Number.isNaN(Number(fallbackMs))) {
    return Number(fallbackMs);
  }
  if (!value) return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;

  const raw = String(value).trim();
  const hasOffsetOrZ = /([zZ]|[+-]\d{2}:?\d{2})$/.test(raw);
  const normalized = hasOffsetOrZ ? raw : `${raw.replace(' ', 'T')}Z`;
  const ms = Date.parse(normalized);
  return Number.isNaN(ms) ? null : ms;
}

function formatPassDateTime(value, timeZone = DEFAULT_TIMEZONE, fallbackMs = null) {
  const ms = parseUtcTimestampMs(value, fallbackMs);
  if (ms === null) return 'No especificado';
  try {
    return new Date(ms).toLocaleString('es-AR', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return new Date(ms).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

export default function ResidentDashboard({ onViewChange }) {
  const { brand } = useBranding();
  const { user } = useAuth();
  const activeTimeZone = user?.timezone || user?.time_zone || DEFAULT_TIMEZONE;

  // Zona 4: Tarjetas principales
  const cardStyle = {
    backgroundColor: brand?.cardBgColor || '#020617',
    color: brand?.cardTextColor || '#F1F5F9',
  };

  // Zona 5: Cajas internas, inputs y botones secundarios
  const innerStyle = {
    backgroundColor: brand?.innerBgColor || '#0F172A',
    color: brand?.innerTextColor || '#F1F5F9',
  };

  // Color principal / de acento configurado en marca
  const primaryActionColor = brand?.accentColor || brand?.primaryColor || '#10b981';

  // Paso activo del flujo del residente: 'providers' | 'passes' | 'payments' | 'reviews'
  const [activeStep, setActiveStep] = useState('providers');

  // 1. Directorio de prestadores
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // 2. Historial de pases QR del residente
  const [myPasses, setMyPasses] = useState([]);
  const [loadingPasses, setLoadingPasses] = useState(true);
  const [passesError, setPassesError] = useState('');
  const [passSearch, setPassSearch] = useState('');
  const [passStatusFilter, setPassStatusFilter] = useState('all');
  const [copiedPassId, setCopiedPassId] = useState(null);
  const [cancellingPassId, setCancellingPassId] = useState(null);
  const [inspectingPass, setInspectingPass] = useState(null);

  // 3. Contratos pendientes de pago y visitas/pases para contratar
  const [pendingContracts, setPendingContracts] = useState([]);
  const [loadingContracts, setLoadingContracts] = useState(true);
  const [payingId, setPayingId] = useState(null);
  const [creatingFromPassId, setCreatingFromPassId] = useState(null);
  const [quoteDescriptions, setQuoteDescriptions] = useState({});
  const [quoteAmounts, setQuoteAmounts] = useState({});

  // 4. Calificación cruzada
  const [reviewContracts, setReviewContracts] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [ratingDrafts, setRatingDrafts] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [submittingContractId, setSubmittingContractId] = useState(null);

  // Retroalimentación global del portal
  const [feedback, setFeedback] = useState(null);

  // Modal de emisión de pase QR
  const [qrModalProvider, setQrModalProvider] = useState(null);
  const [fraction, setFraction] = useState('Fracción A');
  const [lotNumber, setLotNumber] = useState('Lote 12');
  const [startTime, setStartTime] = useState(() => formatLocalDateTimeInput(new Date()));
  const [endTime, setEndTime] = useState(() => {
    const plus4h = new Date(Date.now() + 4 * 60 * 60 * 1000);
    return formatLocalDateTimeInput(plus4h);
  });
  const [creatingPass, setCreatingPass] = useState(false);
  const [passError, setPassError] = useState('');
  const [generatedPass, setGeneratedPass] = useState(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
  });

  const fetchVerifiedProviders = useCallback(async () => {
    setLoadingProviders(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/directory`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setProviders(data.providers || []);
      } else {
        setErrorMsg(data.error || 'No se pudo cargar el directorio de prestadores.');
      }
    } catch (error) {
      console.error('Error de red al obtener prestadores:', error);
      setErrorMsg('Error de conexión con el servidor backend de TrustLink.');
    } finally {
      setLoadingProviders(false);
    }
  }, []);

  const fetchMyPasses = useCallback(async () => {
    setLoadingPasses(true);
    setPassesError('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/my`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setMyPasses(data.passes || []);
      } else {
        setPassesError(data.error || 'No se pudieron cargar tus pases QR.');
      }
    } catch (error) {
      console.error('Error de red al obtener pases del residente:', error);
      setPassesError('Error de conexión al consultar el historial de pases QR.');
    } finally {
      setLoadingPasses(false);
    }
  }, []);

  const fetchPendingContracts = useCallback(async () => {
    setLoadingContracts(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/contracts`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setPendingContracts(data.contracts || []);
      }
    } catch (error) {
      console.error('Error al obtener contratos pendientes:', error);
    } finally {
      setLoadingContracts(false);
    }
  }, []);

  const fetchReviewContracts = useCallback(async () => {
    setLoadingReviews(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/reviews/contracts`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setReviewContracts(data.contracts || []);
      }
    } catch (error) {
      console.error('Error al obtener contratos para reseñas:', error);
    } finally {
      setLoadingReviews(false);
    }
  }, []);

  const refreshAllPortalData = useCallback(async () => {
    await Promise.all([
      fetchVerifiedProviders(),
      fetchMyPasses(),
      fetchPendingContracts(),
      fetchReviewContracts(),
    ]);
  }, [fetchVerifiedProviders, fetchMyPasses, fetchPendingContracts, fetchReviewContracts]);

  useEffect(() => {
    refreshAllPortalData();
  }, [refreshAllPortalData]);

  const resolvePassBadge = (pass) => {
    const rawStatus = String(pass.status || 'pending').toLowerCase();
    const startMs = parseUtcTimestampMs(pass.start_time, pass.start_utc_ms);
    const endMs = parseUtcTimestampMs(pass.end_time, pass.end_utc_ms);
    const nowMs = Date.now();
    const isPastEnd = endMs !== null && nowMs > endMs;
    const isBeforeStart = startMs !== null && nowMs < startMs;

    if (rawStatus === 'cancelled') {
      return {
        key: 'cancelled',
        label: 'cancelado',
        sublabel: null,
        badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
      };
    }
    if (rawStatus === 'used') {
      return {
        key: 'used',
        label: 'usado',
        sublabel: null,
        badgeClass: 'bg-sky-950 text-sky-300 border-sky-800',
      };
    }
    if (rawStatus === 'expired' || (rawStatus === 'pending' && isPastEnd)) {
      return {
        key: 'expired',
        label: 'vencido',
        sublabel: rawStatus === 'pending' && isPastEnd ? 'fin superado' : null,
        badgeClass: 'bg-amber-950 text-amber-300 border-amber-700',
      };
    }
    if (rawStatus === 'pending' && isBeforeStart) {
      return {
        key: 'pending',
        label: 'pending',
        sublabel: 'aún no inicia',
        badgeClass: 'bg-indigo-950 text-indigo-300 border-indigo-800',
      };
    }
    return {
      key: 'pending',
      label: 'pending',
      sublabel: 'vigente',
      badgeClass: 'bg-emerald-950 text-emerald-300 border-emerald-800',
    };
  };

  const filteredProviders = providers.filter((p) => {
    const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
    const specialtiesText = (
      p.specialties_label ||
      (Array.isArray(p.specialties) ? p.specialties.join(' ') : '') ||
      p.specialty ||
      ''
    ).toLowerCase();
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return fullName.includes(query) || specialtiesText.includes(query);
  });

  const filteredMyPasses = myPasses.filter((pass) => {
    const badge = resolvePassBadge(pass);
    if (passStatusFilter !== 'all' && badge.key !== passStatusFilter) {
      return false;
    }
    const q = passSearch.trim().toLowerCase();
    if (!q) return true;
    const hay = [
      `#${pass.id}`,
      pass.provider_name || '',
      pass.specialty || '',
      pass.fraction_number || '',
      pass.lot_number || '',
      pass.qr_token || '',
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });

  const nowMs = Date.now();
  const linkedPassIds = new Set([
    ...pendingContracts.map((c) => Number(c.pass_id)).filter(Boolean),
    ...reviewContracts.map((c) => Number(c.pass_id)).filter(Boolean),
  ]);
  const visitsReadyForContract = myPasses.filter((p) => {
    const st = String(p.status || 'pending').toLowerCase();
    const endMs = parseUtcTimestampMs(p.end_time, p.end_utc_ms);
    const isExpired = st === 'expired' || (st === 'pending' && endMs !== null && nowMs > endMs);
    if (st === 'cancelled' || isExpired) return false;
    return !linkedPassIds.has(Number(p.id));
  });

  const handleOpenQrModal = (provider) => {
    const now = new Date();
    const endDefault = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    setQrModalProvider(provider);
    setFraction(user?.fraction || 'Fracción A');
    setLotNumber(user?.lot_number || 'Lote 12');
    setStartTime(formatLocalDateTimeInput(now));
    setEndTime(formatLocalDateTimeInput(endDefault));
    setPassError('');
    setGeneratedPass(null);
    setCopiedToken(false);
  };

  const handleCreatePass = async (e) => {
    e.preventDefault();
    if (!qrModalProvider) return;
    setCreatingPass(true);
    setPassError('');
    setGeneratedPass(null);

    try {
      const payload = {
        provider_id: qrModalProvider.provider_id,
        country_id: qrModalProvider.country_id || user?.country_id || 1,
        fraction: fraction.trim(),
        lot_number: lotNumber.trim(),
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
      };

      const response = await fetch(`${API_BASE}/api/v1/passes/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok) {
        const created = data.pass || data;
        setGeneratedPass(created);
        setFeedback({
          type: 'success',
          text: `Pase QR #${created?.id || ''} emitido para ${qrModalProvider.first_name} ${qrModalProvider.last_name}.`,
        });
        await fetchMyPasses();
      } else {
        setPassError(data.error || 'No se pudo generar el pase QR.');
      }
    } catch (error) {
      console.error('Error al generar pase QR:', error);
      setPassError('Error de conexión con el servidor al emitir el pase.');
    } finally {
      setCreatingPass(false);
    }
  };

  const handleCopyToken = async (tokenValue, passId = null) => {
    if (!tokenValue) return;
    try {
      await navigator.clipboard.writeText(tokenValue);
      if (passId !== null) {
        setCopiedPassId(passId);
        setTimeout(() => setCopiedPassId(null), 1800);
      } else {
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2000);
      }
    } catch (err) {
      console.error('No se pudo copiar el token:', err);
    }
  };

  const handleCancelMyPass = async (passId) => {
    setCancellingPassId(passId);
    setFeedback(null);
    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/${passId}/cancel`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({
          type: 'success',
          text: data.message || `Pase QR #${passId} cancelado.`,
        });
        if (inspectingPass?.id === passId) {
          setInspectingPass(null);
        }
        await fetchMyPasses();
      } else {
        setFeedback({
          type: 'error',
          text: data.error || 'No se pudo cancelar el pase QR.',
        });
      }
    } catch (error) {
      console.error('Error al cancelar pase QR:', error);
      setFeedback({
        type: 'error',
        text: 'Error de conexión al cancelar el pase QR.',
      });
    } finally {
      setCancellingPassId(null);
    }
  };

  const handleCreateContractFromPass = async (passItem, e) => {
    if (e) e.preventDefault();
    const rawDesc = (quoteDescriptions[passItem.id] || '').trim();
    const description =
      rawDesc ||
      `Servicio de ${passItem.specialty || 'prestador verificado'} — Pase #${passItem.id}`;
    const amountNum = Number(quoteAmounts[passItem.id]);

    if (Number.isNaN(amountNum) || amountNum <= 0) {
      setFeedback({
        type: 'error',
        text: 'Ingresá un monto acordado mayor a cero para generar el contrato.',
      });
      return;
    }

    setCreatingFromPassId(passItem.id);
    setFeedback(null);

    try {
      const response = await fetch(`${API_BASE}/api/v1/reviews/contract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          provider_id: passItem.provider_id,
          pass_id: passItem.id,
          description,
          agreed_amount: amountNum,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setFeedback({
          type: 'success',
          text:
            data.message ||
            `Contrato generado para el pase #${passItem.id}. Ya podés confirmar y pagar la orden.`,
        });
        setQuoteDescriptions((prev) => ({ ...prev, [passItem.id]: '' }));
        setQuoteAmounts((prev) => ({ ...prev, [passItem.id]: '' }));
        await Promise.all([fetchPendingContracts(), fetchReviewContracts()]);
      } else {
        setFeedback({
          type: 'error',
          text: data.error || 'No se pudo generar el contrato desde la visita.',
        });
      }
    } catch (error) {
      console.error('Error al generar contrato desde pase QR:', error);
      setFeedback({
        type: 'error',
        text: 'Error de conexión al generar el contrato.',
      });
    } finally {
      setCreatingFromPassId(null);
    }
  };

  const handlePayContract = async (contract) => {
    setPayingId(contract.id);
    setFeedback(null);
    try {
      const response = await fetch(`${API_BASE}/api/v1/payments/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          contract_id: contract.id,
          agreed_amount: contract.agreed_amount,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({
          type: 'success',
          text: data.message || `Orden de pago procesada para el contrato #${contract.id}.`,
        });
        await Promise.all([fetchPendingContracts(), fetchReviewContracts()]);
      } else {
        setFeedback({
          type: 'error',
          text: data.error || 'No se pudo procesar la orden de pago.',
        });
      }
    } catch (error) {
      console.error('Error al procesar pago:', error);
      setFeedback({
        type: 'error',
        text: 'Error de conexión al procesar el pago.',
      });
    } finally {
      setPayingId(null);
    }
  };

  const handleSubmitProviderReview = async (contractId) => {
    const rating = ratingDrafts[contractId] || 5;
    const comment = (commentDrafts[contractId] || '').trim();
    setSubmittingContractId(contractId);
    setFeedback(null);

    try {
      const response = await fetch(`${API_BASE}/api/v1/reviews/provider`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          contract_id: contractId,
          rating,
          comment: comment || null,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({
          type: 'success',
          text: data.message || 'Calificación al prestador registrada con éxito.',
        });
        await fetchReviewContracts();
      } else {
        setFeedback({
          type: 'error',
          text: data.error || 'No se pudo registrar la calificación.',
        });
      }
    } catch (error) {
      console.error('Error al enviar reseña al prestador:', error);
      setFeedback({
        type: 'error',
        text: 'Error de conexión al guardar la calificación.',
      });
    } finally {
      setSubmittingContractId(null);
    }
  };

  const buildShareableQrUrl = (token) => {
    if (!token || typeof window === 'undefined') return token || '';
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}?qr_token=${encodeURIComponent(token)}`;
  };

  const steps = [
    {
      id: 'providers',
      stepNumber: '1',
      label: 'Prestadores',
      count: providers.length,
      icon: Compass,
    },
    {
      id: 'passes',
      stepNumber: '2',
      label: 'Pases QR',
      count: myPasses.length,
      icon: Ticket,
    },
    {
      id: 'payments',
      stepNumber: '3',
      label: 'Visitas y Pagos',
      count: pendingContracts.length + visitsReadyForContract.length,
      icon: CreditCard,
    },
    {
      id: 'reviews',
      stepNumber: '4',
      label: 'Reseñas',
      count: reviewContracts.length,
      icon: Star,
    },
  ];

  const activeStepMeta = steps.find((s) => s.id === activeStep) || steps[0];

  return (
    <div className="p-6 md:p-8 flex-1">
      <main className="max-w-6xl mx-auto space-y-6">
        {/* Cabecera del Portal Residente + Indicadores de Pasos Clicables */}
        <section
          className="border border-black/20 p-6 rounded-2xl shadow-sm space-y-5"
          style={cardStyle}
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className="p-3 rounded-xl border border-white/15 text-emerald-400 shrink-0"
                style={innerStyle}
              >
                <activeStepMeta.icon size={20} strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-black tracking-tight">
                  Portal Residente — {activeStepMeta.stepNumber}. {activeStepMeta.label}
                </h2>
                <p className="text-xs opacity-80 mt-0.5">
                  {activeStep === 'providers' &&
                    'Prestadores verificados con compliance aprobado para emitir pase QR o contratar.'}
                  {activeStep === 'passes' &&
                    'Pases QR generados por tu cuenta, vigencia In/Out, copia de token y cancelación.'}
                  {activeStep === 'payments' &&
                    'Generá contratos desde visitas/pases vigentes y pagá órdenes con Take Rate del 7% / 93%.'}
                  {activeStep === 'reviews' &&
                    'Calificá el servicio al finalizar y consultá el historial de reseñas de tus contratos.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={refreshAllPortalData}
              disabled={loadingProviders || loadingPasses || loadingContracts || loadingReviews}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-white/15 cursor-pointer hover:opacity-90 disabled:opacity-50 shrink-0"
              style={innerStyle}
            >
              <RefreshCw
                size={13}
                className={
                  loadingProviders || loadingPasses || loadingContracts || loadingReviews
                    ? 'animate-spin'
                    : ''
                }
              />
              Actualizar
            </button>
          </div>

          {/* Barra de indicadores de pasos seleccionables mediante clic */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
            {steps.map((item) => {
              const IconComp = item.icon;
              const isSelected = activeStep === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveStep(item.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'text-white border-transparent shadow-sm'
                      : 'border-white/15 opacity-85 hover:opacity-100'
                  }`}
                  style={isSelected ? { backgroundColor: primaryActionColor } : innerStyle}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-full text-[11px] font-black flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-black/25 text-white' : 'bg-white/10'
                      }`}
                    >
                      {item.stepNumber}
                    </span>
                    <IconComp size={14} className="shrink-0" />
                    <span className="text-xs font-bold truncate">{item.label}</span>
                  </div>
                  <span
                    className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md shrink-0 ${
                      isSelected ? 'bg-black/25 text-white' : 'bg-black/20'
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Mensaje de retroalimentación de acciones */}
        {feedback && (
          <div
            className={`p-4 rounded-xl text-xs border flex items-center justify-between gap-3 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                : 'bg-rose-950/60 border-rose-800 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 size={16} className="shrink-0" />
              ) : (
                <AlertCircle size={16} className="shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="p-1 rounded-lg hover:bg-black/20 cursor-pointer shrink-0"
              aria-label="Cerrar aviso"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* PASO 1: Directorio de Prestadores Verificados */}
        {activeStep === 'providers' && (
          <div className="space-y-5">
            <div
              className="border border-black/20 px-5 py-4 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              style={cardStyle}
            >
              <span className="text-xs font-bold">
                Prestadores disponibles ({filteredProviders.length})
              </span>
              <div className="relative w-full sm:w-80">
                <Search
                  className="opacity-60 absolute left-3.5 top-1/2 -translate-y-1/2"
                  size={15}
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nombre o especialidad..."
                  className="w-full pl-9 pr-4 py-2 border border-white/15 rounded-xl text-xs focus:outline-none"
                  style={innerStyle}
                />
              </div>
            </div>

            {errorMsg && (
              <div className="bg-rose-950/60 border border-rose-800 text-rose-200 p-4 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {loadingProviders ? (
              <div className="text-center py-14 opacity-80 text-xs">
                Consultando base de datos PostgreSQL...
              </div>
            ) : filteredProviders.length === 0 ? (
              <div
                className="text-center py-14 border border-black/20 rounded-2xl opacity-80 text-xs shadow-sm"
                style={cardStyle}
              >
                No hay prestadores aprobados que coincidan con la búsqueda.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredProviders.map((p) => {
                  const totalJobs = Number(p.total_jobs || 0);
                  const specialtiesList =
                    Array.isArray(p.specialties) && p.specialties.length > 0
                      ? p.specialties
                      : [p.specialty || 'Servicio Verificado'];

                  return (
                    <div
                      key={p.user_id || p.provider_id}
                      className="border border-black/20 p-5 rounded-2xl shadow-sm flex flex-col justify-between gap-5 transition-all"
                      style={cardStyle}
                    >
                      <div>
                        <div className="flex justify-between items-start gap-2 mb-2.5">
                          <div className="flex flex-wrap gap-1.5">
                            {specialtiesList.map((spec) => (
                              <span
                                key={spec}
                                className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-950/70 border border-emerald-800 px-2 py-0.5 rounded-md"
                              >
                                {spec}
                              </span>
                            ))}
                          </div>

                          <span className="text-amber-300 font-bold text-xs bg-amber-950/70 border border-amber-800 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                            <Star size={11} className="fill-amber-400" />
                            {Number(p.rating_avg || 0).toFixed(1)}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold mb-1">
                          {p.first_name} {p.last_name}
                        </h3>

                        <p className="text-[11px] opacity-90 font-medium mb-3 flex items-center gap-1.5">
                          <Briefcase size={12} className="text-emerald-400 shrink-0" />
                          <span>
                            {totalJobs}{' '}
                            {totalJobs === 1 ? 'trabajo realizado' : 'trabajos realizados'}
                          </span>
                        </p>

                        <div className="space-y-1 text-[11px] opacity-80 border-t border-black/20 pt-2.5">
                          <p className="flex items-center gap-1.5">
                            <Phone size={12} className="opacity-70 shrink-0" />
                            <span>{p.phone || 'Teléfono no especificado'}</span>
                          </p>
                          <p className="flex items-center gap-1.5 break-all">
                            <Mail size={12} className="opacity-70 shrink-0" />
                            <span>{p.email}</span>
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-black/20 pt-3 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 shrink-0">
                          <ShieldCheck size={13} /> Compliance OK
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenQrModal(p)}
                            className="border border-white/15 text-xs font-bold px-3 py-2 rounded-xl transition-opacity hover:opacity-90 flex items-center gap-1.5 cursor-pointer"
                            style={innerStyle}
                          >
                            <QrCode size={13} className="text-emerald-400" />
                            Pase QR
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveStep('payments')}
                            className="text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm transition-opacity hover:opacity-95 flex items-center gap-1 cursor-pointer"
                            style={{ backgroundColor: primaryActionColor }}
                          >
                            Contratar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* PASO 2: Mis Pases QR */}
        {activeStep === 'passes' && (
          <section
            className="border border-black/20 p-6 rounded-2xl shadow-sm space-y-4"
            style={cardStyle}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-black/20 pb-4">
              <div>
                <h3 className="text-sm font-bold">Historial de Pases QR Emitidos</h3>
                <p className="text-xs opacity-80 mt-0.5">
                  Horarios In/Out en {activeTimeZone}. Copiá el token, revisá el enlace o cancelá un pase vigente.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="relative">
                  <Search
                    size={13}
                    className="opacity-60 absolute left-2.5 top-1/2 -translate-y-1/2"
                  />
                  <input
                    type="text"
                    value={passSearch}
                    onChange={(e) => setPassSearch(e.target.value)}
                    placeholder="Buscar prestador o lote..."
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                    style={innerStyle}
                  />
                </div>
                <select
                  value={passStatusFilter}
                  onChange={(e) => setPassStatusFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                  style={innerStyle}
                >
                  <option value="all">Todos</option>
                  <option value="pending">Pendientes / Vigentes</option>
                  <option value="expired">Vencidos</option>
                  <option value="used">Usados</option>
                  <option value="cancelled">Cancelados</option>
                </select>
              </div>
            </div>

            {passesError && (
              <div className="bg-rose-950/60 border border-rose-800 text-rose-200 p-3.5 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{passesError}</span>
              </div>
            )}

            {loadingPasses ? (
              <div className="text-center py-10 text-xs opacity-80">Cargando tus pases QR...</div>
            ) : filteredMyPasses.length === 0 ? (
              <div
                className="text-center py-10 rounded-xl border border-black/20 text-xs opacity-80 space-y-3"
                style={innerStyle}
              >
                <p>No tenés pases QR registrados con ese filtro.</p>
                <button
                  type="button"
                  onClick={() => setActiveStep('providers')}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
                  style={{ backgroundColor: primaryActionColor }}
                >
                  Ir al Paso 1: Prestadores
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-black/20" style={innerStyle}>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-black/20 opacity-75">
                      <th className="py-2.5 px-3 font-semibold">Pase</th>
                      <th className="py-2.5 px-3 font-semibold">Prestador</th>
                      <th className="py-2.5 px-3 font-semibold">Destino</th>
                      <th className="py-2.5 px-3 font-semibold">Vigencia (In / Out)</th>
                      <th className="py-2.5 px-3 font-semibold">Estado</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/15">
                    {filteredMyPasses.map((pass) => {
                      const badge = resolvePassBadge(pass);
                      const canCancel = pass.status === 'pending' && badge.key !== 'expired';
                      return (
                        <tr key={pass.id}>
                          <td className="py-2.5 px-3 font-mono">
                            <div className="font-bold">#{pass.id}</div>
                            <div className="text-[11px] opacity-75">
                              {pass.qr_token ? `${pass.qr_token.slice(0, 10)}...` : '-'}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold">
                              {pass.provider_name || 'Prestador Verificado'}
                            </div>
                            <div className="text-[11px] opacity-75">{pass.specialty || '-'}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div>
                              {[pass.fraction_number, pass.lot_number].filter(Boolean).join(' · ') ||
                                'Sin especificar'}
                            </div>
                            <div className="text-[11px] opacity-75">
                              {pass.country_name || 'Comunidad'}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-[11px] font-mono">
                            <div>
                              In:{' '}
                              {formatPassDateTime(
                                pass.start_time,
                                activeTimeZone,
                                pass.start_utc_ms
                              )}
                            </div>
                            <div>
                              Out:{' '}
                              {formatPassDateTime(pass.end_time, activeTimeZone, pass.end_utc_ms)}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="inline-flex flex-col items-start gap-1">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badge.badgeClass}`}
                              >
                                {badge.label}
                              </span>
                              {badge.sublabel && (
                                <span className="text-[10px] opacity-75">{badge.sublabel}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setInspectingPass(pass)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-white/15 cursor-pointer"
                                style={cardStyle}
                              >
                                <Eye size={11} /> Ver
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyToken(pass.qr_token, pass.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-white/15 cursor-pointer"
                                style={cardStyle}
                              >
                                {copiedPassId === pass.id ? (
                                  <>
                                    <Check size={11} className="text-emerald-400" /> Copiado
                                  </>
                                ) : (
                                  <>
                                    <Copy size={11} /> Token
                                  </>
                                )}
                              </button>
                              {canCancel && (
                                <button
                                  type="button"
                                  disabled={cancellingPassId === pass.id}
                                  onClick={() => handleCancelMyPass(pass.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-800/80 cursor-pointer disabled:opacity-50"
                                >
                                  <Ban size={11} />
                                  {cancellingPassId === pass.id ? 'Cancelando...' : 'Cancelar'}
                                </button>
                              )}
                            </div>
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

        {/* PASO 3: Visitas / Pases QR para Contratar + Órdenes de Pago */}
        {activeStep === 'payments' && (
          <div className="space-y-6">
            {/* Órdenes pendientes de pago */}
            <section
              className="border border-black/20 p-6 rounded-2xl shadow-sm space-y-4"
              style={cardStyle}
            >
              <div className="flex items-center justify-between gap-2 border-b border-black/20 pb-3">
                <h3 className="text-sm font-bold">
                  Órdenes de Pago Pendientes ({pendingContracts.length})
                </h3>
                <span className="text-[11px] font-mono opacity-80">Take Rate 7% / 93%</span>
              </div>

              {loadingContracts ? (
                <div className="text-center py-6 text-xs opacity-80">
                  Consultando órdenes de pago...
                </div>
              ) : pendingContracts.length === 0 ? (
                <div
                  className="p-5 rounded-xl border border-black/20 text-xs opacity-80 text-center"
                  style={innerStyle}
                >
                  No tenés órdenes de pago pendientes en este momento. Podés generar una desde las
                  visitas/pases disponibles abajo.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingContracts.map((contract) => {
                    const amount = Number(contract.agreed_amount || 0);
                    const fee = Number((amount * 0.07).toFixed(2));
                    const providerNet = Number((amount - fee).toFixed(2));

                    return (
                      <div
                        key={contract.id}
                        className="p-4 rounded-xl border border-black/20 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 text-xs"
                        style={innerStyle}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-emerald-400">
                              Contrato #{contract.id}
                            </span>
                            <span className="font-bold">
                              {contract.provider_name || 'Prestador Verificado'}
                            </span>
                          </div>
                          <p className="opacity-80">{contract.description}</p>
                          <p className="text-[11px] opacity-75 font-mono pt-1">
                            Total: ${amount.toLocaleString('es-AR')} · Comisión (7%): $
                            {fee.toLocaleString('es-AR')} · Neto Prestador (93%): $
                            {providerNet.toLocaleString('es-AR')}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handlePayContract(contract)}
                          disabled={payingId === contract.id}
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50 cursor-pointer shrink-0 transition-opacity hover:opacity-95"
                          style={{ backgroundColor: primaryActionColor }}
                        >
                          <CreditCard size={14} />
                          {payingId === contract.id ? 'Procesando...' : 'Confirmar y Pagar'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Visitas / Pases QR vigentes sin contrato para contratar */}
            <section
              className="border border-black/20 p-6 rounded-2xl shadow-sm space-y-4"
              style={cardStyle}
            >
              <div className="flex items-center justify-between gap-2 border-b border-black/20 pb-3">
                <div>
                  <h3 className="text-sm font-bold">
                    Visitas / Pases QR para Contratar ({visitsReadyForContract.length})
                  </h3>
                  <p className="text-xs opacity-80 mt-0.5">
                    Cargá la descripción y el monto acordado en la visita para generar el contrato y
                    la orden de pago.
                  </p>
                </div>
              </div>

              {loadingPasses ? (
                <div className="text-center py-6 text-xs opacity-80">Cargando visitas...</div>
              ) : visitsReadyForContract.length === 0 ? (
                <div
                  className="p-5 rounded-xl border border-black/20 text-xs opacity-80 text-center space-y-3"
                  style={innerStyle}
                >
                  <p>No tenés visitas/pases QR vigentes pendientes de contratar.</p>
                  <button
                    type="button"
                    onClick={() => setActiveStep('providers')}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
                    style={{ backgroundColor: primaryActionColor }}
                  >
                    Emitir Pase QR en Paso 1
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {visitsReadyForContract.map((passItem) => {
                    const draftDesc = quoteDescriptions[passItem.id] || '';
                    const draftAmount = quoteAmounts[passItem.id] || '';
                    const numericAmount = Number(draftAmount);
                    const hasValidAmount = !Number.isNaN(numericAmount) && numericAmount > 0;
                    const previewFee = hasValidAmount
                      ? Number((numericAmount * 0.07).toFixed(2))
                      : 0;
                    const previewNet = hasValidAmount
                      ? Number((numericAmount - previewFee).toFixed(2))
                      : 0;

                    return (
                      <form
                        key={passItem.id}
                        onSubmit={(e) => handleCreateContractFromPass(passItem, e)}
                        className="p-4 rounded-xl border border-black/20 space-y-3 text-xs"
                        style={innerStyle}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-emerald-400">
                              Pase QR #{passItem.id}
                            </span>
                            <span className="font-bold">
                              {passItem.provider_name || 'Prestador Verificado'}
                            </span>
                            {passItem.specialty && (
                              <span className="text-[10px] font-bold uppercase text-emerald-300 bg-emerald-950/70 border border-emerald-800 px-2 py-0.5 rounded">
                                {passItem.specialty}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] opacity-80 font-mono">
                            {[passItem.fraction_number, passItem.lot_number]
                              .filter(Boolean)
                              .join(' · ') || 'Sin destino'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                          <input
                            type="text"
                            value={draftDesc}
                            onChange={(e) =>
                              setQuoteDescriptions((prev) => ({
                                ...prev,
                                [passItem.id]: e.target.value,
                              }))
                            }
                            placeholder="Descripción del trabajo acordado"
                            className="md:col-span-2 w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                            style={cardStyle}
                          />
                          <input
                            type="number"
                            min="1"
                            step="0.01"
                            required
                            value={draftAmount}
                            onChange={(e) =>
                              setQuoteAmounts((prev) => ({
                                ...prev,
                                [passItem.id]: e.target.value,
                              }))
                            }
                            placeholder="Monto acordado ($)"
                            className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs font-mono focus:outline-none"
                            style={cardStyle}
                          />
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                          <span className="text-[11px] font-mono opacity-80">
                            {hasValidAmount
                              ? `Comisión (7%): $${previewFee.toLocaleString('es-AR')} · Neto Prestador (93%): $${previewNet.toLocaleString('es-AR')}`
                              : 'Ingresá el monto para previsualizar el 7% / 93%.'}
                          </span>

                          <button
                            type="submit"
                            disabled={creatingFromPassId === passItem.id || !hasValidAmount}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 cursor-pointer transition-opacity hover:opacity-95 shrink-0"
                            style={{ backgroundColor: primaryActionColor }}
                          >
                            <FilePlus2 size={14} />
                            {creatingFromPassId === passItem.id
                              ? 'Generando...'
                              : 'Generar Contrato y Orden'}
                          </button>
                        </div>
                      </form>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* PASO 4: Cierre de Servicio & Calificación Cruzada */}
        {activeStep === 'reviews' && (
          <section
            className="border border-black/20 p-6 rounded-2xl shadow-sm space-y-4"
            style={cardStyle}
          >
            <div className="flex items-center justify-between gap-2 border-b border-black/20 pb-3">
              <div>
                <h3 className="text-sm font-bold">
                  Cierre de Servicio &amp; Calificación Cruzada ({reviewContracts.length})
                </h3>
                <p className="text-xs opacity-80 mt-0.5">
                  Calificá al prestador al concluir el trabajo; tu reseña actualiza su reputación.
                </p>
              </div>
            </div>

            {loadingReviews ? (
              <div className="text-center py-8 text-xs opacity-80">
                Cargando servicios para calificación cruzada...
              </div>
            ) : reviewContracts.length === 0 ? (
              <div
                className="p-6 rounded-xl border border-black/20 text-center text-xs opacity-80"
                style={innerStyle}
              >
                Aún no tenés contratos registrados para calificar.
              </div>
            ) : (
              <div className="space-y-4">
                {reviewContracts.map((item) => {
                  const draftRating = ratingDrafts[item.contract_id] || 5;
                  const draftComment = commentDrafts[item.contract_id] || '';
                  const alreadyRatedProvider = Boolean(item.provider_review_rating);

                  return (
                    <div
                      key={item.contract_id}
                      className="p-4 rounded-xl border border-black/20 space-y-3 text-xs"
                      style={innerStyle}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <span className="font-mono font-bold text-emerald-400">
                            Contrato #{item.contract_id}
                          </span>{' '}
                          ·{' '}
                          <span className="font-bold">
                            {`${item.provider_first_name || ''} ${item.provider_last_name || ''}`.trim() ||
                              'Prestador'}
                          </span>
                          <p className="opacity-80 mt-0.5">{item.description}</p>
                        </div>
                        <span
                          className="font-mono border border-white/15 px-3 py-1 rounded-lg self-start"
                          style={cardStyle}
                        >
                          ${Number(item.agreed_amount || 0).toLocaleString('es-AR')}
                        </span>
                      </div>

                      {alreadyRatedProvider ? (
                        <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-emerald-300">
                            Tu calificación al prestador: {'★'.repeat(item.provider_review_rating)} (
                            {item.provider_review_rating}/5)
                          </span>
                          {item.provider_review_comment && (
                            <span className="opacity-90 italic">
                              "{item.provider_review_comment}"
                            </span>
                          )}
                        </div>
                      ) : (
                        <div
                          className="border border-black/20 rounded-lg p-3.5 space-y-2.5"
                          style={cardStyle}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="opacity-90 font-semibold">
                              Calificar desempeño del prestador:
                            </span>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((starVal) => (
                                <button
                                  key={starVal}
                                  type="button"
                                  onClick={() =>
                                    setRatingDrafts((prev) => ({
                                      ...prev,
                                      [item.contract_id]: starVal,
                                    }))
                                  }
                                  className={`p-1 rounded-lg border cursor-pointer ${
                                    draftRating >= starVal
                                      ? 'bg-amber-950/70 border-amber-700 text-amber-300'
                                      : 'border-white/15 opacity-60'
                                  }`}
                                  style={draftRating >= starVal ? undefined : innerStyle}
                                >
                                  <Star
                                    size={13}
                                    className={draftRating >= starVal ? 'fill-amber-400' : ''}
                                  />
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                              <MessageSquare
                                size={13}
                                className="opacity-60 absolute left-3 top-1/2 -translate-y-1/2"
                              />
                              <input
                                type="text"
                                value={draftComment}
                                onChange={(e) =>
                                  setCommentDrafts((prev) => ({
                                    ...prev,
                                    [item.contract_id]: e.target.value,
                                  }))
                                }
                                placeholder="Dejá un comentario sobre puntualidad, prolijidad y resolución..."
                                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-white/15 text-xs focus:outline-none"
                                style={innerStyle}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSubmitProviderReview(item.contract_id)}
                              disabled={submittingContractId === item.contract_id}
                              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50 cursor-pointer transition-opacity hover:opacity-95"
                              style={{ backgroundColor: primaryActionColor }}
                            >
                              <Send size={12} />
                              {submittingContractId === item.contract_id
                                ? 'Enviando...'
                                : 'Enviar Reseña'}
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

        {/* Modal de Emisión de Pase QR */}
        {qrModalProvider && (
          <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
            <div
              className="border border-white/15 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5"
              style={cardStyle}
            >
              <div className="flex items-start justify-between gap-3 border-b border-black/20 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    Autorización Perimetral — Pase QR
                  </span>
                  <h3 className="text-base font-black mt-0.5">
                    {qrModalProvider.first_name} {qrModalProvider.last_name}
                  </h3>
                  <p className="text-xs opacity-80">
                    {qrModalProvider.specialties_label ||
                      qrModalProvider.specialty ||
                      'Prestador Verificado'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setQrModalProvider(null)}
                  className="p-1.5 rounded-lg border border-white/15 opacity-80 hover:opacity-100 cursor-pointer"
                  style={innerStyle}
                  aria-label="Cerrar modal"
                >
                  <X size={16} />
                </button>
              </div>

              {passError && (
                <div className="bg-rose-950/60 border border-rose-800 text-rose-200 p-3 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{passError}</span>
                </div>
              )}

              {generatedPass ? (
                <div className="space-y-4">
                  <div className="bg-emerald-950/40 border border-emerald-800 rounded-xl p-4 space-y-2 text-xs">
                    <p className="font-bold text-emerald-300">
                      Pase QR emitido correctamente (#{generatedPass.id || 'Nuevo'})
                    </p>
                    <p className="opacity-90">
                      Ubicación: {generatedPass.fraction_number || fraction} ·{' '}
                      {generatedPass.lot_number || lotNumber}
                    </p>
                    <div
                      className="border border-white/15 rounded-lg p-2.5 font-mono text-[11px] text-emerald-300 break-all"
                      style={innerStyle}
                    >
                      {generatedPass.qr_token || generatedPass.token || 'Token generado'}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyToken(generatedPass.qr_token || generatedPass.token || '')
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-white/15 cursor-pointer"
                      style={innerStyle}
                    >
                      {copiedToken ? (
                        <Check size={14} className="text-emerald-400" />
                      ) : (
                        <Copy size={14} />
                      )}
                      {copiedToken ? 'Copiado' : 'Copiar Token QR'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setQrModalProvider(null);
                        setActiveStep('passes');
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
                      style={{ backgroundColor: primaryActionColor }}
                    >
                      Ir a Pases QR
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreatePass} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold opacity-80 mb-1 flex items-center gap-1">
                        <MapPin size={12} /> Fracción / Sector
                      </label>
                      <input
                        type="text"
                        required
                        value={fraction}
                        onChange={(e) => setFraction(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-white/15 focus:outline-none"
                        style={innerStyle}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold opacity-80 mb-1">
                        Lote / Unidad
                      </label>
                      <input
                        type="text"
                        required
                        value={lotNumber}
                        onChange={(e) => setLotNumber(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-white/15 focus:outline-none"
                        style={innerStyle}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold opacity-80 mb-1 flex items-center gap-1">
                        <Calendar size={12} /> Inicio de Vigencia
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-white/15 focus:outline-none"
                        style={innerStyle}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold opacity-80 mb-1 flex items-center gap-1">
                        <Calendar size={12} /> Fin de Vigencia
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-white/15 focus:outline-none"
                        style={innerStyle}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setQrModalProvider(null)}
                      className="px-4 py-2 rounded-xl border border-white/15 font-bold cursor-pointer"
                      style={innerStyle}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={creatingPass}
                      className="px-4 py-2 rounded-xl text-white font-bold disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                      style={{ backgroundColor: primaryActionColor }}
                    >
                      <QrCode size={14} />
                      {creatingPass ? 'Generando...' : 'Emitir Pase QR'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Modal de detalle de pase emitido */}
        {inspectingPass && (
          <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
            <div
              className="border border-white/15 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 text-xs"
              style={cardStyle}
            >
              <div className="flex items-start justify-between gap-3 border-b border-black/20 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    Detalle de Pase QR #{inspectingPass.id}
                  </span>
                  <h3 className="text-base font-black mt-0.5">
                    {inspectingPass.provider_name || 'Prestador Verificado'}
                  </h3>
                  <p className="opacity-80">{inspectingPass.specialty || '-'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectingPass(null)}
                  className="p-1.5 rounded-lg border border-white/15 opacity-80 hover:opacity-100 cursor-pointer"
                  style={innerStyle}
                  aria-label="Cerrar detalle"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-3.5 rounded-xl border border-black/20 space-y-1.5" style={innerStyle}>
                <div>
                  <strong>Destino:</strong>{' '}
                  {[inspectingPass.fraction_number, inspectingPass.lot_number]
                    .filter(Boolean)
                    .join(' · ') || 'No especificado'}
                </div>
                <div className="font-mono text-[11px]">
                  <strong>Inicio:</strong>{' '}
                  {formatPassDateTime(
                    inspectingPass.start_time,
                    activeTimeZone,
                    inspectingPass.start_utc_ms
                  )}
                </div>
                <div className="font-mono text-[11px]">
                  <strong>Fin:</strong>{' '}
                  {formatPassDateTime(
                    inspectingPass.end_time,
                    activeTimeZone,
                    inspectingPass.end_utc_ms
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold opacity-80">Token QR</span>
                <div
                  className="p-2.5 rounded-lg border border-white/15 font-mono text-[11px] text-emerald-300 break-all"
                  style={innerStyle}
                >
                  {inspectingPass.qr_token}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold opacity-80">Enlace directo con token</span>
                <div
                  className="p-2.5 rounded-lg border border-white/15 font-mono text-[11px] opacity-85 break-all"
                  style={innerStyle}
                >
                  {buildShareableQrUrl(inspectingPass.qr_token)}
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleCopyToken(inspectingPass.qr_token, inspectingPass.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold border border-white/15 cursor-pointer"
                  style={innerStyle}
                >
                  <Copy size={13} /> Copiar Token
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyToken(buildShareableQrUrl(inspectingPass.qr_token))}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-white cursor-pointer"
                  style={{ backgroundColor: primaryActionColor }}
                >
                  <Copy size={13} /> Copiar Enlace
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}