/**
 * @file ResidentDashboard.jsx
 * @description Portal del Residente conectado 100% a PostgreSQL mediante API REST.
 * Incluye los 4 pasos clicables:
 * 1. Prestadores (Directorio verificado con tilde, scoring y trabajos realizados)
 * 2. Pases QR (Emisión y listado de pases de acceso rápido)
 * 3. Visitas y Pagos (Contratos pendientes con desglose Take Rate 7% / 93%)
 * 4. Reseñas (Reseñas y reputación cruzada: calificación al prestador + reseña recibida del prestador)
 * @location /trustlink-web/src/modules/owner/ResidentDashboard.jsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Home,
  Compass,
  QrCode,
  CreditCard,
  Star,
  Search,
  ShieldCheck,
  BadgeCheck,
  Phone,
  Mail,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  MessageSquare,
  Send,
  Calendar,
  Car,
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';
import { useAuth } from '../auth/AuthContext';

const API_BASE = 'http://localhost:4000';
const PLATFORM_FEE_RATE = 0.07;

export default function ResidentDashboard({ onViewChange }) {
  const { brand } = useBranding();
  const { user } = useAuth();

  // Zona 4: Tarjetas principales
  const cardStyle = {
    backgroundColor: brand?.cardBgColor || '#020617',
    color: brand?.cardTextColor || '#F1F5F9',
  };

  // Zona 5: Cajas internas, inputs y contenedores secundarios
  const innerStyle = {
    backgroundColor: brand?.innerBgColor || '#0F172A',
    color: brand?.innerTextColor || '#F1F5F9',
  };

  const primaryActionColor = brand?.accentColor || brand?.primaryColor || '#10b981';

  // Paso activo: 'providers' | 'passes' | 'payments' | 'reviews'
  const [activeStep, setActiveStep] = useState('providers');

  // 1. Directorio de prestadores
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // 2. Pases QR
  const [passes, setPasses] = useState([]);
  const [loadingPasses, setLoadingPasses] = useState(true);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [destinationLot, setDestinationLot] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [creatingPass, setCreatingPass] = useState(false);

  // 3. Visitas y Pagos
  const [pendingContracts, setPendingContracts] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [payingId, setPayingId] = useState(null);

  // 4. Reseñas y Reputación Cruzada
  const [reviewContracts, setReviewContracts] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [ratingDrafts, setRatingDrafts] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [submittingContractId, setSubmittingContractId] = useState(null);

  const [feedback, setFeedback] = useState(null);

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
  });

  const fetchVerifiedProviders = useCallback(async () => {
    setLoadingProviders(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/directory`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        const list = data.providers || [];
        setProviders(list);
        if (list.length > 0) {
          setSelectedProviderId((prev) => prev || String(list[0].provider_id));
        }
      }
    } catch (error) {
      console.error('Error al cargar directorio de prestadores:', error);
    } finally {
      setLoadingProviders(false);
    }
  }, []);

  const fetchMyPasses = useCallback(async () => {
    setLoadingPasses(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/my`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setPasses(data.passes || []);
      }
    } catch (error) {
      console.error('Error al cargar pases QR:', error);
    } finally {
      setLoadingPasses(false);
    }
  }, []);

  const fetchPendingContracts = useCallback(async () => {
    setLoadingPayments(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/payments/pending`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setPendingContracts(data.contracts || []);
      }
    } catch (error) {
      console.error('Error al cargar contratos pendientes:', error);
    } finally {
      setLoadingPayments(false);
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
      console.error('Error al cargar contratos y reseñas cruzadas:', error);
    } finally {
      setLoadingReviews(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchVerifiedProviders(),
      fetchMyPasses(),
      fetchPendingContracts(),
      fetchReviewContracts(),
    ]);
  }, [fetchVerifiedProviders, fetchMyPasses, fetchPendingContracts, fetchReviewContracts]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const handleCreatePass = async (e) => {
    e.preventDefault();
    if (!selectedProviderId) {
      setFeedback({ type: 'error', text: 'Seleccioná un prestador verificado.' });
      return;
    }

    setCreatingPass(true);
    setFeedback(null);
    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          provider_id: Number(selectedProviderId),
          destination: destinationLot.trim() || 'Lote Residente',
          vehicle_plate: vehiclePlate.trim().toUpperCase() || null,
          valid_from: validFrom || new Date().toISOString(),
          valid_until: validUntil || new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({
          type: 'success',
          text: data.message || 'Pase QR generado con éxito.',
        });
        setDestinationLot('');
        setVehiclePlate('');
        await fetchMyPasses();
      } else {
        setFeedback({ type: 'error', text: data.error || 'No se pudo generar el pase QR.' });
      }
    } catch (error) {
      console.error('Error al generar pase QR:', error);
      setFeedback({ type: 'error', text: 'Error de conexión al generar el pase QR.' });
    } finally {
      setCreatingPass(false);
    }
  };

  const handlePayContract = async (contractId, amount) => {
    setPayingId(contractId);
    setFeedback(null);
    try {
      const response = await fetch(`${API_BASE}/api/v1/payments/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          contract_id: contractId,
          amount,
          payment_method: 'mercado_pago_mock',
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({
          type: 'success',
          text: data.message || 'Pago acreditado correctamente.',
        });
        await Promise.all([fetchPendingContracts(), fetchReviewContracts()]);
      } else {
        setFeedback({ type: 'error', text: data.error || 'No se pudo procesar el pago.' });
      }
    } catch (error) {
      console.error('Error al pagar contrato:', error);
      setFeedback({ type: 'error', text: 'Error de conexión al procesar el pago.' });
    } finally {
      setPayingId(null);
    }
  };

  const handleSubmitProviderReview = async (contractId) => {
    const selectedRating = ratingDrafts[contractId] || 5;
    const commentText = (commentDrafts[contractId] || '').trim();
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
          rating: selectedRating,
          comment: commentText || null,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({
          type: 'success',
          text:
            data.message ||
            'Calificación al prestador registrada y reputación actualizada en TrustLink.',
        });
        await Promise.all([fetchReviewContracts(), fetchVerifiedProviders()]);
      } else {
        setFeedback({ type: 'error', text: data.error || 'No se pudo registrar la reseña.' });
      }
    } catch (error) {
      console.error('Error al calificar prestador:', error);
      setFeedback({ type: 'error', text: 'Error de conexión al enviar la calificación.' });
    } finally {
      setSubmittingContractId(null);
    }
  };

  const filteredProviders = providers.filter((p) => {
    const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
    const spec = (p.specialties_label || p.specialty || '').toLowerCase();
    const q = searchTerm.toLowerCase();
    return fullName.includes(q) || spec.includes(q);
  });

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
      count: passes.length,
      icon: QrCode,
    },
    {
      id: 'payments',
      stepNumber: '3',
      label: 'Visitas y Pagos',
      count: pendingContracts.length,
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
        {/* Cabecera del Portal Residente + 4 Pasos Clicables */}
        <section
          className="border border-black/20 p-6 rounded-2xl shadow-sm space-y-5"
          style={cardStyle}
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className="p-3 rounded-xl border border-white/15 text-emerald-400 shrink-0"
                style={innerStyle}
              >
                <Home size={20} strokeWidth={1.8} />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight">
                  Portal Residente — {activeStepMeta.stepNumber}. {activeStepMeta.label}
                </h2>
                <p className="text-xs opacity-80 mt-0.5">
                  {activeStep === 'providers' &&
                    'Explorá prestadores verificados en TrustLink y generá pases QR de ingreso seguro.'}
                  {activeStep === 'passes' &&
                    'Emití y gestioná tus pases QR vigentes para ingreso de prestadores al barrio.'}
                  {activeStep === 'payments' &&
                    'Aprobá presupuestos acordados y aboná con desglose transparente (7% comisión plataforma).'}
                  {activeStep === 'reviews' &&
                    'Calificá el servicio al finalizar y consultá las reseñas cruzadas de tus contratos.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={refreshAll}
              disabled={loadingProviders || loadingPasses || loadingPayments || loadingReviews}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/15 cursor-pointer hover:opacity-90 disabled:opacity-50"
              style={innerStyle}
            >
              <RefreshCw
                size={13}
                className={
                  loadingProviders || loadingPasses || loadingPayments || loadingReviews
                    ? 'animate-spin'
                    : ''
                }
              />
              Actualizar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
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

        {/* Feedback global */}
        {feedback && (
          <div
            className={`p-4 rounded-xl text-xs border flex items-center justify-between gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                : 'bg-rose-950/60 border-rose-800 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
              <span>{feedback.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-[11px] underline opacity-80 cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* PASO 1: Prestadores Verificados */}
        {activeStep === 'providers' && (
          <section
            className="border border-black/20 p-6 rounded-2xl shadow-sm space-y-5"
            style={cardStyle}
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <h3 className="text-base font-bold">Directorio de Prestadores Verificados</h3>
                <p className="text-xs opacity-80">
                  Profesionales auditados con compliance aprobado para ingreso seguro por QR.
                </p>
              </div>

              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 opacity-60" size={15} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nombre o especialidad..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                  style={innerStyle}
                />
              </div>
            </div>

            {loadingProviders ? (
              <div className="text-center py-10 text-xs opacity-80 flex items-center justify-center gap-2">
                <Loader2 className="animate-spin" size={15} /> Cargando prestadores verificados...
              </div>
            ) : filteredProviders.length === 0 ? (
              <div
                className="p-6 rounded-xl border border-black/20 text-center text-xs opacity-80"
                style={innerStyle}
              >
                No hay prestadores verificados que coincidan con la búsqueda.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProviders.map((p) => (
                  <div
                    key={p.provider_id}
                    className="p-4 rounded-xl border border-black/20 flex flex-col justify-between gap-4"
                    style={innerStyle}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-500/15 text-emerald-300 border-emerald-500/35 inline-flex items-center gap-1">
                          <BadgeCheck size={12} /> Verificado
                        </span>
                        <span className="text-amber-300 font-bold text-xs bg-amber-950/60 border border-amber-800 px-2 py-0.5 rounded-lg inline-flex items-center gap-1">
                          <Star size={11} className="fill-amber-400" />
                          {Number(p.rating_avg || 0).toFixed(2)}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold">
                          {p.first_name} {p.last_name}
                        </h4>
                        <p className="text-xs text-emerald-300 font-semibold mt-0.5">
                          {p.specialties_label || p.specialty}
                        </p>
                      </div>

                      <p className="text-[11px] opacity-80">
                        {p.total_jobs || 0} trabajo(s) registrado(s) en la red
                      </p>

                      <div className="space-y-1 text-[11px] opacity-80 pt-1">
                        <p className="flex items-center gap-1.5">
                          <Phone size={12} /> {p.phone || 'Teléfono no especificado'}
                        </p>
                        <p className="flex items-center gap-1.5 truncate">
                          <Mail size={12} /> {p.email}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-emerald-300 font-semibold inline-flex items-center gap-1">
                        <ShieldCheck size={13} /> Compliance OK
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProviderId(String(p.provider_id));
                          setActiveStep('passes');
                        }}
                        className="text-white text-xs font-bold px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5 cursor-pointer hover:opacity-95"
                        style={{ backgroundColor: primaryActionColor }}
                      >
                        <QrCode size={13} /> Generar QR
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* PASO 2: Pases QR */}
        {activeStep === 'passes' && (
          <section
            className="border border-black/20 p-6 rounded-2xl shadow-sm space-y-5"
            style={cardStyle}
          >
            <div className="flex items-center justify-between border-b border-black/20 pb-3">
              <div className="flex items-center gap-2">
                <QrCode size={17} className="text-emerald-400" />
                <h3 className="text-base font-bold">Emisión y Gestión de Pases QR</h3>
              </div>
              <span className="text-xs font-mono opacity-80">{passes.length} pase(s)</span>
            </div>

            <form
              onSubmit={handleCreatePass}
              className="p-4 rounded-xl border border-white/15 grid grid-cols-1 md:grid-cols-12 gap-3 items-end text-xs"
              style={innerStyle}
            >
              <div className="md:col-span-4">
                <label className="block text-[10px] opacity-75 mb-1">Prestador Verificado</label>
                <select
                  value={selectedProviderId}
                  onChange={(e) => setSelectedProviderId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                  style={cardStyle}
                >
                  {providers.map((p) => (
                    <option key={p.provider_id} value={p.provider_id}>
                      {p.first_name} {p.last_name} — {p.specialty}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-[10px] opacity-75 mb-1">Lote / Destino</label>
                <input
                  type="text"
                  value={destinationLot}
                  onChange={(e) => setDestinationLot(e.target.value)}
                  placeholder="Ej: Lote 42 - Sector Norte"
                  className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                  style={cardStyle}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] opacity-75 mb-1">Patente (opcional)</label>
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="AF123CD"
                  className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs font-mono uppercase focus:outline-none"
                  style={cardStyle}
                />
              </div>

              <div className="md:col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={creatingPass || providers.length === 0}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer hover:opacity-95 disabled:opacity-50"
                  style={{ backgroundColor: primaryActionColor }}
                >
                  <QrCode size={14} />
                  {creatingPass ? 'Generando...' : 'Emitir Pase QR'}
                </button>
              </div>
            </form>

            {loadingPasses ? (
              <div className="text-center py-6 text-xs opacity-80">Cargando pases QR...</div>
            ) : passes.length === 0 ? (
              <div
                className="p-4 rounded-xl border border-black/20 text-center text-xs opacity-80"
                style={innerStyle}
              >
                No tenés pases QR generados aún.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {passes.map((pass) => (
                  <div
                    key={pass.id}
                    className="p-4 rounded-xl border border-black/20 space-y-1.5 text-xs"
                    style={innerStyle}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-emerald-400">
                        Pase #{pass.id}
                      </span>
                      <span
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-white/15 uppercase"
                        style={cardStyle}
                      >
                        {pass.status}
                      </span>
                    </div>
                    <p className="font-bold">
                      {pass.provider_name || `Prestador #${pass.provider_id}`}
                    </p>
                    <p className="opacity-80 flex items-center gap-1.5">
                      <Calendar size={12} /> Destino: {pass.destination || 'Domicilio'}
                      {pass.vehicle_plate && (
                        <span className="inline-flex items-center gap-1 ml-2 font-mono">
                          <Car size={12} /> {pass.vehicle_plate}
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* PASO 3: Visitas y Pagos */}
        {activeStep === 'payments' && (
          <section
            className="border border-black/20 p-6 rounded-2xl shadow-sm space-y-5"
            style={cardStyle}
          >
            <div className="flex items-center justify-between border-b border-black/20 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard size={17} className="text-emerald-400" />
                <h3 className="text-base font-bold">Visitas y Órdenes de Pago Pendientes</h3>
              </div>
              <span className="text-xs font-mono opacity-80">
                {pendingContracts.length} pendiente(s)
              </span>
            </div>

            {loadingPayments ? (
              <div className="text-center py-6 text-xs opacity-80">
                Consultando órdenes de pago pendientes...
              </div>
            ) : pendingContracts.length === 0 ? (
              <div
                className="p-4 rounded-xl border border-black/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                style={innerStyle}
              >
                <span className="opacity-85">
                  No tenés órdenes de pago pendientes en este momento.
                </span>
                {typeof onViewChange === 'function' && (
                  <button
                    type="button"
                    onClick={() => onViewChange('payments')}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-white cursor-pointer shrink-0"
                    style={{ backgroundColor: primaryActionColor }}
                  >
                    Ir a Pagos y Reseñas
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {pendingContracts.map((contract) => {
                  const agreed = Number(contract.agreed_amount || 0);
                  const platformFee = Number((agreed * PLATFORM_FEE_RATE).toFixed(2));
                  const providerPayout = Number((agreed - platformFee).toFixed(2));
                  return (
                    <div
                      key={contract.id}
                      className="p-4 rounded-xl border border-black/20 space-y-3 text-xs"
                      style={innerStyle}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-mono font-bold text-emerald-400">
                            Contrato #{contract.id}
                          </span>{' '}
                          · <span className="font-bold">{contract.provider_name}</span>
                          <p className="opacity-80 mt-1">{contract.description}</p>
                        </div>
                        <span className="font-mono font-bold text-sm">
                          ${agreed.toLocaleString('es-AR')}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 text-[11px]">
                        <span className="opacity-80">
                          Comisión TrustLink (7%): ${platformFee.toLocaleString('es-AR')} · Neto
                          prestador (93%): ${providerPayout.toLocaleString('es-AR')}
                        </span>
                        <button
                          type="button"
                          disabled={payingId === contract.id}
                          onClick={() => handlePayContract(contract.id, agreed)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                          style={{ backgroundColor: primaryActionColor }}
                        >
                          <CreditCard size={13} />
                          {payingId === contract.id ? 'Procesando...' : 'Aprobar y Pagar'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* PASO 4: Reseñas y Reputación Cruzada (muestra calificación enviada y recibida del prestador) */}
        {activeStep === 'reviews' && (
          <section
            className="border border-black/20 p-6 rounded-2xl shadow-sm space-y-5"
            style={cardStyle}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/20 pb-3">
              <div>
                <h3 className="text-base font-bold">
                  Reseñas y Reputación Cruzada ({reviewContracts.length})
                </h3>
                <p className="text-xs opacity-80">
                  Calificá al prestador al concluir el trabajo y visualizá la reseña cruzada que el
                  prestador envió sobre tu servicio.
                </p>
              </div>
            </div>

            {loadingReviews ? (
              <div className="text-center py-6 text-xs opacity-80">
                Cargando historial de contratos y reseñas cruzadas...
              </div>
            ) : reviewContracts.length === 0 ? (
              <div
                className="p-4 rounded-xl border border-black/20 text-center text-xs opacity-80"
                style={innerStyle}
              >
                Aún no tenés contratos registrados para emitir o consultar reseñas.
              </div>
            ) : (
              <div className="space-y-4">
                {reviewContracts.map((item) => {
                  const currentDraftRating = ratingDrafts[item.contract_id] || 5;
                  const currentDraftComment = commentDrafts[item.contract_id] || '';
                  const alreadyRatedProvider = Boolean(item.provider_review_rating);
                  const providerFullName =
                    `${item.provider_first_name || ''} ${item.provider_last_name || ''}`.trim() ||
                    'Prestador Verificado';

                  return (
                    <div
                      key={item.contract_id}
                      className="p-4 rounded-xl border border-black/20 space-y-3 text-xs"
                      style={innerStyle}
                    >
                      {/* Cabecera del contrato */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-mono font-bold text-emerald-400">
                            Contrato #{item.contract_id}
                          </span>{' '}
                          · <span className="font-bold">{providerFullName}</span>
                          {item.specialty && (
                            <span className="opacity-75"> ({item.specialty})</span>
                          )}
                          <p className="opacity-80 mt-1">{item.description}</p>
                        </div>
                        <span
                          className="font-mono border border-white/15 px-3 py-1 rounded-lg self-start"
                          style={cardStyle}
                        >
                          ${Number(item.agreed_amount || 0).toLocaleString('es-AR')}
                        </span>
                      </div>

                      {/* 1. Calificación del residente hacia el prestador */}
                      {alreadyRatedProvider ? (
                        <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-emerald-300">
                            Tu calificación al prestador:{' '}
                            {'★'.repeat(item.provider_review_rating)} (
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
                              Calificar al prestador:
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
                                    currentDraftRating >= starVal
                                      ? 'bg-amber-950/70 border-amber-700 text-amber-300'
                                      : 'border-white/15 opacity-60'
                                  }`}
                                  style={currentDraftRating >= starVal ? undefined : innerStyle}
                                >
                                  <Star
                                    size={13}
                                    className={
                                      currentDraftRating >= starVal ? 'fill-amber-400' : ''
                                    }
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
                                value={currentDraftComment}
                                onChange={(e) =>
                                  setCommentDrafts((prev) => ({
                                    ...prev,
                                    [item.contract_id]: e.target.value,
                                  }))
                                }
                                placeholder="Comentario sobre puntualidad, prolijidad y cumplimiento..."
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
                                : 'Calificar Prestador'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 2. Reseña cruzada recibida desde el prestador */}
                      {item.owner_review_rating ? (
                        <div className="bg-indigo-950/35 border border-indigo-800/70 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-indigo-300">
                            Reseña recibida del prestador:{' '}
                            {'★'.repeat(item.owner_review_rating)} ({item.owner_review_rating}/5)
                          </span>
                          {item.owner_review_comment && (
                            <span className="opacity-90 italic">
                              "{item.owner_review_comment}"
                            </span>
                          )}
                        </div>
                      ) : (
                        <div
                          className="border border-white/10 rounded-lg px-3 py-2 text-[11px] opacity-70"
                          style={cardStyle}
                        >
                          Pendiente de reseña cruzada por parte del prestador.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}