/**
 * @file ResidentDashboard.jsx
 * @description Portal del Residente con navegador superior por pasos clicables
 * (1. Prestadores, 2. Pases QR, 3. Visitas y Pagos, 4. Reseñas), buscador rápido
 * con chips de especialidad, emisión y cancelación de pases QR y reputación cruzada.
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
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';
import { useAuth } from '../auth/AuthContext';

export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL && String(import.meta.env.VITE_API_BASE_URL).trim()) ||
  'http://localhost:4000';

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

const getPassStatusBadge = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'pending') {
    return 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60';
  }
  if (normalized === 'used') {
    return 'bg-sky-950/80 text-sky-300 border-sky-700/60';
  }
  if (normalized === 'expired') {
    return 'bg-amber-950/80 text-amber-300 border-amber-700/60';
  }
  if (normalized === 'cancelled') {
    return 'bg-rose-950/80 text-rose-300 border-rose-700/60';
  }
  return 'bg-slate-800 text-slate-300 border-slate-700';
};

export default function ResidentDashboard({ onNavigate }) {
  const { brand } = useBranding();
  const { user } = useAuth();

  const [activeStep, setActiveStep] = useState('providers');

  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [providersError, setProvidersError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('Todos');

  const [qrModalProvider, setQrModalProvider] = useState(null);
  const [fractionNumber, setFractionNumber] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [startTime, setStartTime] = useState(() =>
    toLocalDateTimeInput(new Date(Date.now() - 10 * 60 * 1000))
  );
  const [endTime, setEndTime] = useState(() =>
    toLocalDateTimeInput(new Date(Date.now() + 8 * 60 * 60 * 1000))
  );
  const [creatingPass, setCreatingPass] = useState(false);
  const [passFeedback, setPassFeedback] = useState({ type: '', text: '', qrToken: '' });
  const [copiedTokenId, setCopiedTokenId] = useState(null);

  const [myPasses, setMyPasses] = useState([]);
  const [loadingPasses, setLoadingPasses] = useState(false);
  const [passSearch, setPassSearch] = useState('');
  const [passStatusFilter, setPassStatusFilter] = useState('all');
  const [passesPage, setPassesPage] = useState(1);
  const [cancellingPassId, setCancellingPassId] = useState(null);
  const [passListFeedback, setPassListFeedback] = useState({ type: '', text: '' });

  const [contracts, setContracts] = useState([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [payingContractId, setPayingContractId] = useState(null);
  const [paymentFeedback, setPaymentFeedback] = useState({ type: '', text: '' });

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

  useEffect(() => {
    const savedQuery = sessionStorage.getItem('trustlink_initial_service_query');
    if (savedQuery && savedQuery.trim()) {
      setSearchTerm(savedQuery.trim());
      sessionStorage.removeItem('trustlink_initial_service_query');
    }
  }, []);

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
      const response = await fetch(`${API_BASE}/api/v1/reviews/contracts`, {
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
          initialRatings[c.id] = c.provider_review_rating || 5;
          initialComments[c.id] = c.provider_review_comment || '';
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
    fetchMyPasses();
    fetchContractsData();
    fetchReviewsData();
  }, []);

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

  const openQrModalForProvider = (provider) => {
    setQrModalProvider(provider);
    setFractionNumber(user?.fraction_number || '');
    setLotNumber(user?.lot_number || '');
    setStartTime(toLocalDateTimeInput(new Date(Date.now() - 10 * 60 * 1000)));
    setEndTime(toLocalDateTimeInput(new Date(Date.now() + 8 * 60 * 60 * 1000)));
    setPassFeedback({ type: '', text: '', qrToken: '' });
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

  const steps = [
    {
      id: 'providers',
      stepNumber: 1,
      label: 'Prestadores',
      count: filteredProviders.length,
      icon: Users,
    },
    {
      id: 'passes',
      stepNumber: 2,
      label: 'Pases QR',
      count: myPasses.length,
      icon: QrCode,
    },
    {
      id: 'payments',
      stepNumber: 3,
      label: 'Visitas y Pagos',
      count: pendingContractsCount,
      icon: CreditCard,
    },
    {
      id: 'reviews',
      stepNumber: 4,
      label: 'Reseñas',
      count: reviewContracts.length,
      icon: MessageSquare,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-8 space-y-6">
      <div
        className="rounded-2xl p-5 sm:p-6 border border-slate-800/80 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        style={cardStyle}
      >
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
            <ShieldCheck size={14} />
            <span>Portal Residente</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Servicios verificados y pases de ingreso
          </h1>
          <p className="text-xs sm:text-sm opacity-80">
            Buscá profesionales aprobados, emití pases QR con vigencia y gestioná pagos y calificaciones.
          </p>
        </div>

        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('payments')}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-700/80 transition-opacity hover:opacity-90 cursor-pointer self-start sm:self-auto"
            style={innerStyle}
          >
            <span>Vista completa Pagos y Reseñas</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>

      <div
        className="rounded-2xl p-2 border border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2"
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

      {activeStep === 'providers' && (
        <section className="space-y-4">
          <div
            className="rounded-2xl p-4 sm:p-5 border border-slate-800/80 space-y-4"
            style={cardStyle}
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold">
                  Directorio de Prestadores Verificados
                </h2>
                <p className="text-xs opacity-75">
                  Profesionales habilitados con documentación revisada y calificación acumulada.
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
                    className="w-full pl-9 pr-8 py-2 rounded-xl text-xs border border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
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
                  onClick={fetchVerifiedProviders}
                  className="p-2 rounded-xl border border-slate-700/80 hover:opacity-90 cursor-pointer"
                  style={innerStyle}
                  title="Actualizar directorio"
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
                        : 'border-slate-700/70 opacity-80 hover:opacity-100'
                    }`}
                    style={active ? { backgroundColor: primaryColor } : innerStyle}
                  >
                    {spec}
                  </button>
                );
              })}
            </div>
          </div>

          {providersError && (
            <div className="rounded-2xl p-4 border border-rose-800/70 bg-rose-950/50 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{providersError}</span>
            </div>
          )}

          {loadingProviders ? (
            <div
              className="rounded-2xl p-10 border border-slate-800/80 text-center text-xs opacity-75"
              style={cardStyle}
            >
              Cargando prestadores verificados...
            </div>
          ) : filteredProviders.length === 0 ? (
            <div
              className="rounded-2xl p-10 border border-slate-800/80 text-center space-y-2"
              style={cardStyle}
            >
              <p className="text-sm font-bold">No se encontraron prestadores con ese filtro</p>
              <p className="text-xs opacity-75">
                Probá limpiar el buscador o seleccionar otra especialidad.
              </p>
              {(searchTerm || selectedSpecialty !== 'Todos') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedSpecialty('Todos');
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer"
                  style={{ backgroundColor: primaryColor }}
                >
                  Restablecer filtros
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProviders.map((provider) => {
                const fullName =
                  `${provider.first_name || ''} ${provider.last_name || ''}`.trim() ||
                  provider.email ||
                  'Prestador Verificado';
                const rating = Number(provider.rating_avg || 0).toFixed(1);
                const jobsCount = Number(provider.total_jobs ?? provider.completed_jobs ?? 0);

                return (
                  <article
                    key={provider.provider_id || provider.id}
                    className="rounded-2xl p-5 border border-slate-800/80 shadow-sm flex flex-col justify-between gap-4"
                    style={cardStyle}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                          {provider.specialty || 'Servicio Verificado'}
                        </span>

                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border border-amber-500/30 bg-amber-500/10 text-amber-300 shrink-0">
                          <Star size={12} className="fill-amber-400 text-amber-400" />
                          {rating}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-bold">{fullName}</h3>
                        <p className="text-xs opacity-75 mt-0.5">
                          {jobsCount} {jobsCount === 1 ? 'trabajo registrado' : 'trabajos registrados'}
                        </p>
                      </div>

                      <div
                        className="rounded-xl p-3 text-xs space-y-1 border border-slate-800/60"
                        style={innerStyle}
                      >
                        <p className="truncate opacity-85">
                          📞 {provider.phone || 'Teléfono no informado'}
                        </p>
                        <p className="truncate opacity-85">✉️ {provider.email || '—'}</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/70 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                        <CheckCircle2 size={14} /> Verificado
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openQrModalForProvider(provider)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-95 cursor-pointer"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <QrCode size={14} /> Generar QR
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveStep('payments')}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border border-slate-700/80 transition-opacity hover:opacity-90 cursor-pointer"
                          style={innerStyle}
                        >
                          Contratar
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

      {activeStep === 'passes' && (
        <section
          className="rounded-2xl p-5 border border-slate-800/80 space-y-4"
          style={cardStyle}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold">Mis Pases QR Emitidos</h2>
              <p className="text-xs opacity-75">
                Consultá el estado de tus autorizaciones, copiá el token o cancelá pases pendientes.
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
                className="px-3 py-2 rounded-xl text-xs border border-slate-700/80 focus:outline-none"
                style={innerStyle}
              />
              <select
                value={passStatusFilter}
                onChange={(e) => {
                  setPassStatusFilter(e.target.value);
                  setPassesPage(1);
                }}
                className="px-3 py-2 rounded-xl text-xs border border-slate-700/80 focus:outline-none"
                style={innerStyle}
              >
                <option value="all">Todos los estados</option>
                <option value="pending">Pendiente</option>
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
              className="rounded-xl p-8 text-center text-xs opacity-75 border border-slate-800/60"
              style={innerStyle}
            >
              No hay pases QR que coincidan con el filtro seleccionado.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {paginatedPasses.map((item) => {
                const isPending = String(item.status || '').toLowerCase() === 'pending';
                return (
                  <div
                    key={item.id}
                    className="rounded-xl p-4 border border-slate-800/70 space-y-2.5"
                    style={innerStyle}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold">
                        Pase #{item.id} · {item.provider_name || `Prestador #${item.provider_id}`}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${getPassStatusBadge(
                          item.status
                        )}`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <p className="text-xs opacity-80">
                      Destino: {item.fraction_number || 'Sin fracción'} /{' '}
                      {item.lot_number || 'Sin lote'}
                    </p>
                    <p className="text-[11px] opacity-75">
                      Vigencia: {formatLocalDateTime(item.start_time)} →{' '}
                      {formatLocalDateTime(item.end_time)}
                    </p>

                    {item.qr_token && (
                      <div className="flex items-center justify-between gap-2 bg-black/25 px-2.5 py-1.5 rounded-lg border border-slate-700/50">
                        <code className="text-[11px] truncate">{item.qr_token}</code>
                        <button
                          type="button"
                          onClick={() => handleCopyToken(item.qr_token, item.id)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer shrink-0"
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
                      </div>
                    )}

                    {isPending && (
                      <div className="pt-1 flex justify-end">
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
                    )}
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

      {activeStep === 'payments' && (
        <section
          className="rounded-2xl p-5 border border-slate-800/80 space-y-4"
          style={cardStyle}
        >
          <div>
            <h2 className="text-base sm:text-lg font-bold">Visitas y Órdenes de Pago</h2>
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
              className="rounded-xl p-8 text-center text-xs opacity-75 border border-slate-800/60"
              style={innerStyle}
            >
              No hay contratos registrados todavía. Podés emitir un pase QR en el Paso 2 o abrir la
              vista completa de Pagos y Reseñas.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contracts.map((contract) => {
                const totalAmount = Number(contract.agreed_amount || contract.amount || 0);
                const feeAmount = Number((totalAmount * 0.07).toFixed(2));
                const payoutAmount = Number((totalAmount - feeAmount).toFixed(2));
                const isPending = String(contract.status || '').toLowerCase() === 'pending';

                return (
                  <div
                    key={contract.id}
                    className="rounded-xl p-4 border border-slate-800/70 space-y-3"
                    style={innerStyle}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold">
                        Contrato #{contract.id} ·{' '}
                        {contract.provider_name || `Prestador #${contract.provider_id}`}
                      </span>
                      <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border border-slate-700">
                        {contract.status}
                      </span>
                    </div>

                    {contract.description && (
                      <p className="text-xs opacity-85">{contract.description}</p>
                    )}

                    <div className="text-xs space-y-1 pt-2 border-t border-slate-800/70">
                      <div className="flex justify-between">
                        <span className="opacity-75">Monto acordado:</span>
                        <span className="font-bold">${totalAmount.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="opacity-75">Comisión TrustLink (7%):</span>
                        <span>${feeAmount.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="opacity-75">Neto prestador (93%):</span>
                        <span className="font-semibold text-emerald-400">
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
                );
              })}
            </div>
          )}
        </section>
      )}

      {activeStep === 'reviews' && (
        <section
          className="rounded-2xl p-5 border border-slate-800/80 space-y-4"
          style={cardStyle}
        >
          <div>
            <h2 className="text-base sm:text-lg font-bold">Reseñas y Calificación Cruzada</h2>
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
              className="rounded-xl p-8 text-center text-xs opacity-75 border border-slate-800/60"
              style={innerStyle}
            >
              Todavía no tenés contratos habilitados para calificar.
            </div>
          ) : (
            <div className="space-y-3">
              {reviewContracts.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl p-4 border border-slate-800/70 space-y-3"
                  style={innerStyle}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold">
                      Servicio #{item.id} ·{' '}
                      {item.provider_name || `Prestador #${item.provider_id}`}
                    </span>
                    <span className="text-[11px] opacity-75">Estado: {item.status}</span>
                  </div>

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

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                    <select
                      value={ratingByContract[item.id] ?? 5}
                      onChange={(e) =>
                        setRatingByContract((prev) => ({
                          ...prev,
                          [item.id]: Number(e.target.value),
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
                      value={commentByContract[item.id] ?? ''}
                      onChange={(e) =>
                        setCommentByContract((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      placeholder="Dejá un comentario sobre el servicio..."
                      className="sm:col-span-6 px-3 py-2 rounded-xl text-xs border border-slate-700/80"
                      style={cardStyle}
                    />

                    <button
                      type="button"
                      disabled={submittingReviewId === item.id}
                      onClick={() => handleSubmitProviderReview(item.id)}
                      className="sm:col-span-3 py-2 px-3 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {submittingReviewId === item.id ? 'Guardando...' : 'Enviar Reseña'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

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
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold mb-1 opacity-85">Fracción</label>
                  <input
                    type="text"
                    value={fractionNumber}
                    onChange={(e) => setFractionNumber(e.target.value)}
                    placeholder="Ej: Fracción 5"
                    className="w-full px-3 py-2 rounded-xl border border-slate-700/80"
                    style={innerStyle}
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 opacity-85">Lote</label>
                  <input
                    type="text"
                    value={lotNumber}
                    onChange={(e) => setLotNumber(e.target.value)}
                    placeholder="Ej: Lote 15"
                    className="w-full px-3 py-2 rounded-xl border border-slate-700/80"
                    style={innerStyle}
                  />
                </div>
              </div>

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
    </div>
  );
}