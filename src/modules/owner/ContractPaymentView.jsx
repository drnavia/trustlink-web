/**
 * @file ContractPaymentView.jsx
 * @description Vista de Pagos y Reseñas para el residente conectada a PostgreSQL.
 * Conecta las visitas/pases QR emitidos sin contrato previo con la creación de contratos
 * (POST /api/v1/reviews/contract), muestra presupuestos/órdenes de pago con desglose de
 * Take Rate (7% / 93%), procesa pagos y habilita la calificación cruzada al prestador.
 * @location /trustlink-web/src/modules/owner/ContractPaymentView.jsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileCheck2,
  Star,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  Send,
  ArrowRight,
  Compass,
  Ticket,
  FilePlus2,
  RefreshCw
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';

const API_BASE = 'http://localhost:4000';
const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

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

function formatDateTime(value, timeZone = DEFAULT_TIMEZONE, fallbackMs = null) {
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

export default function ContractPaymentView({ onViewChange }) {
  const { brand } = useBranding();

  // Zona 4: Tarjetas principales de la vista
  const cardStyle = {
    backgroundColor: brand?.cardBgColor || '#020617',
    color: brand?.cardTextColor || '#F1F5F9',
  };

  // Zona 5: Cajas internas, badges neutros y contenedores de ítems
  const innerStyle = {
    backgroundColor: brand?.innerBgColor || '#0F172A',
    color: brand?.innerTextColor || '#F1F5F9',
  };

  // Color principal / de acento configurado en marca
  const primaryActionColor = brand?.accentColor || brand?.primaryColor || '#10b981';

  const [contracts, setContracts] = useState([]);
  const [reviewContracts, setReviewContracts] = useState([]);
  const [eligiblePasses, setEligiblePasses] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [loadingPasses, setLoadingPasses] = useState(true);

  const [payingId, setPayingId] = useState(null);
  const [creatingFromPassId, setCreatingFromPassId] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Borradores de contratación / presupuesto por pass_id
  const [quoteDescriptions, setQuoteDescriptions] = useState({});
  const [quoteAmounts, setQuoteAmounts] = useState({});

  // Borradores de calificación cruzada hacia el prestador por contract_id
  const [ratingDrafts, setRatingDrafts] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [submittingContractId, setSubmittingContractId] = useState(null);

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
  });

  // Consulta contratos pendientes/activos del residente
  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/contracts`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setContracts(data.contracts || []);
      }
    } catch (error) {
      console.error('Error al obtener contratos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Consulta contratos habilitados para calificación cruzada
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

  // Consulta pases QR del residente para detectar visitas sin contrato asociado
  const fetchEligiblePasses = useCallback(async () => {
    setLoadingPasses(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/my`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        const list = data.passes || [];
        const nowMs = Date.now();
        const filtered = list.filter((p) => {
          const st = String(p.status || 'pending').toLowerCase();
          const endMs = parseUtcTimestampMs(p.end_time, p.end_utc_ms);
          const isExpired = st === 'expired' || (st === 'pending' && endMs !== null && nowMs > endMs);
          if (st === 'cancelled' || isExpired) return false;
          return true;
        });
        setEligiblePasses(filtered);
      }
    } catch (error) {
      console.error('Error al cargar pases para contratación:', error);
    } finally {
      setLoadingPasses(false);
    }
  }, []);

  const refreshAllSections = useCallback(async () => {
    await Promise.all([fetchContracts(), fetchReviewContracts(), fetchEligiblePasses()]);
  }, [fetchContracts, fetchReviewContracts, fetchEligiblePasses]);

  useEffect(() => {
    refreshAllSections();
  }, [refreshAllSections]);

  // Crea un contrato de servicio a partir de una visita/pase QR y lo deja listo para pago
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
    setFeedback({ type: '', text: '' });

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
        await refreshAllSections();
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

  // Procesa el pago de un contrato con desglose de Take Rate (7% / 93%)
  const handlePayContract = async (contract) => {
    setPayingId(contract.id);
    setFeedback({ type: '', text: '' });
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
        await refreshAllSections();
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

  // Envía calificación cruzada del residente hacia el prestador
  const handleSubmitProviderReview = async (contractId) => {
    const rating = ratingDrafts[contractId] || 5;
    const comment = (commentDrafts[contractId] || '').trim();
    setSubmittingContractId(contractId);
    setFeedback({ type: '', text: '' });

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

  // Evita duplicar pases que ya tienen un contrato en pending o en reviewContracts
  const linkedPassIds = new Set([
    ...contracts.map((c) => Number(c.pass_id)).filter(Boolean),
    ...reviewContracts.map((c) => Number(c.pass_id)).filter(Boolean),
  ]);
  const visitsReadyForContract = eligiblePasses.filter((p) => !linkedPassIds.has(Number(p.id)));

  const pendingContractsCount = contracts.length;
  const reviewContractsCount = reviewContracts.length;

  return (
    <div className="p-6 md:p-8 flex-1">
      <main className="max-w-6xl mx-auto space-y-6">
        {/* Mensaje de retroalimentación */}
        {feedback.text && (
          <div
            className={`p-4 rounded-xl text-xs border flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                : 'bg-rose-950/60 border-rose-800 text-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 size={16} className="shrink-0" />
            ) : (
              <AlertCircle size={16} className="shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Sección 1: Presupuesto y Orden de Pago */}
        <section
          className="border border-black/20 p-6 rounded-2xl shadow-sm space-y-5"
          style={cardStyle}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-black/20 pb-4">
            <div className="flex items-center gap-3.5">
              <div
                className="p-2.5 rounded-xl border border-white/15 text-emerald-400 shrink-0"
                style={innerStyle}
              >
                <FileCheck2 size={20} strokeWidth={1.8} />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight">
                  Presupuesto y Orden de Pago
                </h2>
                <p className="text-xs opacity-80 mt-0.5">
                  Transacción segura respaldada por TrustLink con desglose transparente de comisión.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span
                className="text-xs font-semibold border border-white/15 px-3 py-1.5 rounded-xl"
                style={innerStyle}
              >
                {pendingContractsCount === 0
                  ? '0 contratos'
                  : `${pendingContractsCount} ${pendingContractsCount === 1 ? 'contrato' : 'contratos'}`}
              </span>
              <button
                type="button"
                onClick={refreshAllSections}
                className="p-2 rounded-xl border border-white/15 cursor-pointer hover:opacity-90"
                style={innerStyle}
                title="Actualizar órdenes y visitas"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-xs opacity-80">
              Consultando órdenes de pago en PostgreSQL...
            </div>
          ) : pendingContractsCount === 0 ? (
            <div
              className="p-6 rounded-xl border border-black/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs"
              style={innerStyle}
            >
              <p className="opacity-90">
                No hay órdenes de pago pendientes en este momento. Podés iniciar una contratación
                desde una visita/pase QR activo abajo, calificar tus servicios realizados o explorar
                prestadores verificados.
              </p>
              {onViewChange && (
                <button
                  type="button"
                  onClick={() => onViewChange('resident')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-white/15 cursor-pointer hover:opacity-90 shrink-0"
                  style={cardStyle}
                >
                  <Compass size={14} className="text-emerald-400" />
                  Ir al Portal Residente
                  <ArrowRight size={13} />
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {contracts.map((contract) => {
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
                        {contract.specialty && (
                          <span className="text-[10px] font-bold uppercase text-emerald-300 bg-emerald-950/70 border border-emerald-800 px-2 py-0.5 rounded">
                            {contract.specialty}
                          </span>
                        )}
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

        {/* Sección 2: Visitas / Pases QR para Contratar */}
        <section
          className="border border-black/20 p-6 rounded-2xl shadow-sm space-y-5"
          style={cardStyle}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-black/20 pb-4">
            <div className="flex items-center gap-3.5">
              <div
                className="p-2.5 rounded-xl border border-white/15 text-sky-400 shrink-0"
                style={innerStyle}
              >
                <Ticket size={20} strokeWidth={1.8} />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight">
                  Visitas / Pases QR para Contratar
                </h3>
                <p className="text-xs opacity-80 mt-0.5">
                  Pases vigentes o activos emitidos por vos sin contrato generado aún: cargá el
                  trabajo y el monto acordado para abrir la orden de pago.
                </p>
              </div>
            </div>

            <span
              className="text-xs font-semibold border border-white/15 px-3 py-1.5 rounded-xl self-start sm:self-auto"
              style={innerStyle}
            >
              {visitsReadyForContract.length}{' '}
              {visitsReadyForContract.length === 1 ? 'visita disponible' : 'visitas disponibles'}
            </span>
          </div>

          {loadingPasses ? (
            <div className="text-center py-6 text-xs opacity-80">
              Verificando pases QR activos...
            </div>
          ) : visitsReadyForContract.length === 0 ? (
            <div
              className="p-5 rounded-xl border border-black/20 text-xs opacity-80 text-center"
              style={innerStyle}
            >
              No tenés pases QR vigentes pendientes de presupuestar en este momento.
            </div>
          ) : (
            <div className="space-y-4">
              {visitsReadyForContract.map((passItem) => {
                const draftDesc = quoteDescriptions[passItem.id] || '';
                const draftAmount = quoteAmounts[passItem.id] || '';
                const numericAmount = Number(draftAmount);
                const hasValidAmount = !Number.isNaN(numericAmount) && numericAmount > 0;
                const previewFee = hasValidAmount ? Number((numericAmount * 0.07).toFixed(2)) : 0;
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
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
                        <p className="text-[11px] opacity-80 mt-0.5">
                          Destino:{' '}
                          {[passItem.fraction_number, passItem.lot_number]
                            .filter(Boolean)
                            .join(' · ') || 'No especificado'}{' '}
                          · Vigencia:{' '}
                          <span className="font-mono">
                            {formatDateTime(
                              passItem.start_time,
                              DEFAULT_TIMEZONE,
                              passItem.start_utc_ms
                            )}{' '}
                            —{' '}
                            {formatDateTime(
                              passItem.end_time,
                              DEFAULT_TIMEZONE,
                              passItem.end_utc_ms
                            )}
                          </span>
                        </p>
                      </div>
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
                          : 'Ingresá el monto para previsualizar la comisión del 7% y el neto del 93%.'}
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

        {/* Sección 3: Cierre de Servicio & Calificación Cruzada */}
        <section
          className="border border-black/20 p-6 rounded-2xl shadow-sm space-y-5"
          style={cardStyle}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-black/20 pb-4">
            <div className="flex items-center gap-3.5">
              <div
                className="p-2.5 rounded-xl border border-white/15 text-amber-400 shrink-0"
                style={innerStyle}
              >
                <Star size={20} strokeWidth={1.8} />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight">
                  Cierre de Servicio &amp; Calificación Cruzada
                </h2>
                <p className="text-xs opacity-80 mt-0.5">
                  Calificá al prestador al concluir el trabajo; tu reseña actualiza su reputación en
                  TrustLink.
                </p>
              </div>
            </div>

            <span
              className="text-xs font-semibold border border-white/15 px-3 py-1.5 rounded-xl self-start sm:self-auto"
              style={innerStyle}
            >
              {reviewContractsCount === 0
                ? '0 contratos'
                : `${reviewContractsCount} ${reviewContractsCount === 1 ? 'contrato' : 'contratos'}`}
            </span>
          </div>

          {loadingReviews ? (
            <div className="text-center py-8 text-xs opacity-80">
              Cargando servicios para calificación cruzada...
            </div>
          ) : reviewContractsCount === 0 ? (
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
      </main>
    </div>
  );
}