/**
 * @file ContractPaymentView.jsx
 * @description Vista de Pagos y Reseñas para residentes/propietarios, con desglose
 * financiero (Take Rate 7% / Neto Prestador 93%), contratación desde pases QR vigentes
 * y sección unificada "Reseñas y Reputación Cruzada" con cajas alineadas.
 * @location /trustlink-web/src/modules/owner/ContractPaymentView.jsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  FileCheck2,
  Star,
  MessageSquare,
  Send,
  RefreshCw,
  Compass,
  PlusCircle,
  Ticket,
  FileText,
  Printer,
  X,
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';
import { useAuth } from '../auth/AuthContext';
import { API_BASE } from '../../config/api';
import { printServiceReceipt } from '../../utils/receiptPrinter';
import {
  PAGE_SHELL_CLASS,
  SECTION_CARD_CLASS,
  ITEMS_GRID_CLASS,
  ITEM_CARD_CLASS,
  getUnifiedStatusMeta,
} from '../../config/uiTokens';

/* const API_BASE = 'http://localhost:4000'; */
const PLATFORM_FEE_RATE = 0.07;

export default function ContractPaymentView({ onViewChange }) {
  const { brand } = useBranding();
  const { user } = useAuth();

  const cardStyle = {
    backgroundColor: brand?.cardBgColor || '#020617',
    color: brand?.cardTextColor || '#F1F5F9',
  };

  const innerStyle = {
    backgroundColor: brand?.innerBgColor || '#0F172A',
    color: brand?.innerTextColor || '#F1F5F9',
  };

  const primaryActionColor = brand?.accentColor || brand?.primaryColor || '#10b981';

  const [contracts, setContracts] = useState([]);
  const [allContracts, setAllContracts] = useState([]);
  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState(null);
  const [completingId, setCompletingId] = useState(null);
  const [loadingReceiptId, setLoadingReceiptId] = useState(null);
  const [receiptModalData, setReceiptModalData] = useState(null);
  const [disputeModalContract, setDisputeModalContract] = useState(null);
  const [disputeReason, setDisputeReason] = useState('Trabajo incompleto o con fallas');
  const [disputeDetails, setDisputeDetails] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [gatewayConfig, setGatewayConfig] = useState({
    gateway_mode: 'mock',
    sandbox: false,
    platform_fee_percent: 7,
  });

  // Creación de contrato desde visita/pase QR
  const [selectedPassId, setSelectedPassId] = useState('');
  const [workDescription, setWorkDescription] = useState('');
  const [agreedAmount, setAgreedAmount] = useState('');
  const [creatingContract, setCreatingContract] = useState(false);

  // Reseñas cruzadas (Residente <-> Prestador)
  const [reviewContracts, setReviewContracts] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [ratingDrafts, setRatingDrafts] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [submittingContractId, setSubmittingContractId] = useState(null);
  const [reviewFeedback, setReviewFeedback] = useState(null);

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
  });

  const fetchPendingContracts = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingRes, allRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/payments/pending`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/api/v1/contracts`, { headers: getAuthHeaders() }).catch(() => null),
      ]);
      const data = await pendingRes.json();
      if (pendingRes.ok) {
        setContracts(data.contracts || []);
      }
      if (allRes && allRes.ok) {
        const allData = await allRes.json();
        setAllContracts(allData.contracts || []);
      }
    } catch (error) {
      console.error('Error al cargar contratos pendientes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMyPasses = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/passes/my`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        const list = data.passes || [];
        setPasses(list);
        const firstActive = list.find(
          (p) =>
            (p.status || '').toLowerCase() === 'pending' ||
            (p.status || '').toLowerCase() === 'used'
        );
        if (firstActive) {
          setSelectedPassId((prev) => prev || String(firstActive.id));
        }
      }
    } catch (error) {
      console.error('Error al cargar pases del residente:', error);
    }
  }, []);

  const fetchReviewContracts = useCallback(async () => {
    setLoadingReviews(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/reviews/contracts`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setReviewContracts(data.contracts || []);
      }
    } catch (error) {
      console.error('Error al cargar contratos para reseñas:', error);
    } finally {
      setLoadingReviews(false);
    }
  }, []);

  const fetchGatewayConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/payments/config`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && data) {
        setGatewayConfig({
          gateway_mode: data.gateway_mode || 'mock',
          sandbox: Boolean(data.sandbox),
          platform_fee_percent: Number(data.platform_fee_percent ?? 7),
        });
      }
    } catch {
      // Mantiene defaults seguros
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchGatewayConfig(),
      fetchPendingContracts(),
      fetchMyPasses(),
      fetchReviewContracts(),
    ]);
  }, [fetchGatewayConfig, fetchPendingContracts, fetchMyPasses, fetchReviewContracts]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Detecta retorno desde Mercado Pago Checkout Pro (?mp_status=approved|pending|rejected&contract_id=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const mpStatus = (params.get('mp_status') || params.get('collection_status') || '').toLowerCase();
      const returnedContractId = params.get('contract_id') || '';
      if (!mpStatus) return;

      const labelSuffix = returnedContractId ? ` (Contrato #${returnedContractId})` : '';
      if (mpStatus === 'approved') {
        setFeedback({
          type: 'success',
          text: `Pago aprobado en Mercado Pago${labelSuffix}. Estamos confirmando la acreditación en TrustLink.`,
        });
      } else if (mpStatus === 'pending' || mpStatus === 'in_process') {
        setFeedback({
          type: 'success',
          text: `Pago pendiente de acreditación en Mercado Pago${labelSuffix}. Te actualizaremos el estado automáticamente al recibir el webhook.`,
        });
      } else {
        setFeedback({
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

  const activePass = passes.find((p) => String(p.id) === String(selectedPassId)) || null;

  const handleCreateContractFromVisit = async (e) => {
    e.preventDefault();
    const numericAmount = Number(agreedAmount);
    if (!activePass) {
      setFeedback({ type: 'error', text: 'Seleccioná un pase QR de visita válido.' });
      return;
    }
    if (!workDescription.trim() || Number.isNaN(numericAmount) || numericAmount <= 0) {
      setFeedback({
        type: 'error',
        text: 'Indicá la descripción del trabajo y un monto acordado mayor a cero.',
      });
      return;
    }

    setCreatingContract(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/contracts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          provider_id: activePass.provider_id,
          pass_id: activePass.id,
          description: workDescription.trim(),
          agreed_amount: numericAmount,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: 'success',
          text:
            data.message ||
            'Orden de contratación generada a partir de la visita. Ya podés aprobar y pagar.',
        });
        setWorkDescription('');
        setAgreedAmount('');
        await Promise.all([fetchPendingContracts(), fetchReviewContracts()]);
      } else {
        setFeedback({
          type: 'error',
          text: data.error || 'No se pudo registrar la contratación de la visita.',
        });
      }
    } catch (error) {
      console.error('Error al crear contrato desde pase QR:', error);
      setFeedback({ type: 'error', text: 'Error de conexión al crear el contrato.' });
    } finally {
      setCreatingContract(false);
    }
  };

  const handlePayContract = async (contractId, amount) => {
    setPayingId(contractId);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/payments/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          contract_id: contractId,
          amount,
          payment_method: gatewayConfig.gateway_mode === 'mercadopago' ? 'mercadopago' : 'mercado_pago_mock',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.requires_redirect && data.checkout_url) {
          setFeedback({
            type: 'success',
            text: data.message || 'Redirigiendo al checkout seguro de Mercado Pago...',
            checkoutUrl: data.checkout_url,
          });
          window.location.assign(data.checkout_url);
          return;
        }
        setFeedback({
          type: 'success',
          text:
            data.message ||
            'Pago acreditado correctamente. Comisión de plataforma (7%) y liquidación calculadas.',
        });
        await Promise.all([fetchPendingContracts(), fetchReviewContracts()]);
      } else {
        setFeedback({
          type: 'error',
          text: data.error || 'No se pudo procesar el pago.',
        });
      }
    } catch (error) {
      console.error('Error en checkout:', error);
      setFeedback({ type: 'error', text: 'Error de red al procesar el pago.' });
    } finally {
      setPayingId(null);
    }
  };

  const handleCompleteContract = async (contractId) => {
    setCompletingId(contractId);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/contracts/${contractId}/complete`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ completion_notes: 'Conformidad registrada desde Pagos y Contratos' }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: 'success',
          text: data.message || `Conformidad registrada para el contrato #${contractId}.`,
        });
        await Promise.all([fetchPendingContracts(), fetchReviewContracts()]);
      } else {
        setFeedback({ type: 'error', text: data.error || 'No se pudo registrar conformidad.' });
      }
    } catch (error) {
      console.error('Error al registrar conformidad:', error);
      setFeedback({ type: 'error', text: 'Error de red al registrar conformidad.' });
    } finally {
      setCompletingId(null);
    }
  };

  const handleOpenReceipt = async (contractId) => {
    setLoadingReceiptId(contractId);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/contracts/${contractId}/receipt`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.receipt) {
        setReceiptModalData(data.receipt);
      } else {
        setFeedback({ type: 'error', text: data.error || 'No se pudo cargar el comprobante.' });
      }
    } catch (error) {
      console.error('Error al consultar comprobante:', error);
      setFeedback({ type: 'error', text: 'Error de red al cargar el comprobante.' });
    } finally {
      setLoadingReceiptId(null);
    }
  };

  const handleSubmitDispute = async (e) => {
    e.preventDefault();
    if (!disputeModalContract || !disputeReason.trim() || !disputeDetails.trim()) return;
    setSubmittingDispute(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/contracts/${disputeModalContract.id}/dispute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          reason: disputeReason.trim(),
          details: disputeDetails.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: 'success',
          text: data.message || 'Reclamo registrado para revisión de Operaciones.',
        });
        setDisputeModalContract(null);
        setDisputeDetails('');
        await fetchPendingContracts();
      } else {
        setFeedback({ type: 'error', text: data.error || 'No se pudo registrar el reclamo.' });
      }
    } catch (error) {
      console.error('Error al registrar reclamo:', error);
      setFeedback({ type: 'error', text: 'Error de red al registrar el reclamo.' });
    } finally {
      setSubmittingDispute(false);
    }
  };

  const handleSubmitProviderReview = async (contractId) => {
    const selectedRating = ratingDrafts[contractId] || 5;
    const commentText = (commentDrafts[contractId] || '').trim();
    setSubmittingContractId(contractId);
    setReviewFeedback(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/reviews/provider`, {
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
      const data = await res.json();
      if (res.ok) {
        setReviewFeedback({
          type: 'success',
          message:
            data.message ||
            'Calificación al prestador registrada y reputación actualizada en TrustLink.',
        });
        await fetchReviewContracts();
      } else {
        setReviewFeedback({
          type: 'error',
          message: data.error || 'No se pudo registrar la calificación.',
        });
      }
    } catch (error) {
      console.error('Error al calificar prestador:', error);
      setReviewFeedback({
        type: 'error',
        message: 'Error de conexión al enviar la calificación.',
      });
    } finally {
      setSubmittingContractId(null);
    }
  };

  const effectiveFeeRate =
    Number(gatewayConfig.platform_fee_percent ?? 7) / 100 || PLATFORM_FEE_RATE;
  const gatewayBadgeLabel =
    gatewayConfig.gateway_mode === 'mercadopago'
      ? gatewayConfig.sandbox
        ? 'Mercado Pago (Sandbox)'
        : 'Mercado Pago Real'
      : 'Modo Piloto (Simulado)';

  const statusBadgeClass =
    'text-[11px] font-semibold px-3 py-1 rounded-full border border-white/15 shrink-0';

  return (
    <div className={`${PAGE_SHELL_CLASS} flex-1`}>
      <main className="space-y-6">
        {/* Bloque 1: Presupuesto y Orden de Pago */}
        <section
          className={SECTION_CARD_CLASS}
          style={cardStyle}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-black/20 pb-4">
            <div className="flex items-center gap-3">
              <div
                className="p-2.5 rounded-xl border border-white/15 text-emerald-400 shrink-0"
                style={innerStyle}
              >
                <FileCheck2 size={18} strokeWidth={1.8} />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight">Presupuesto y Orden de Pago</h2>
                <p className="text-xs opacity-80">
                  Aprobá cotizaciones de trabajos realizados y aboná con desglose transparente (7% comisión plataforma).
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
              <span
                className={`text-[11px] font-bold px-3 py-1 rounded-full border shrink-0 ${
                  gatewayConfig.gateway_mode === 'mercadopago'
                    ? 'bg-sky-950/70 border-sky-700 text-sky-200'
                    : 'border-white/15 opacity-90'
                }`}
                style={gatewayConfig.gateway_mode === 'mercadopago' ? undefined : innerStyle}
              >
                {gatewayBadgeLabel}
              </span>
              <span className={statusBadgeClass} style={innerStyle}>
                {contracts.length === 0
                  ? 'Sin contratos pendientes'
                  : `${contracts.length} contrato(s) pendiente(s)`}
              </span>
              <button
                type="button"
                onClick={refreshAll}
                disabled={loading || loadingReviews}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/15 cursor-pointer hover:opacity-90 disabled:opacity-50"
                style={innerStyle}
              >
                <RefreshCw
                  size={13}
                  className={loading || loadingReviews ? 'animate-spin' : ''}
                />
                Actualizar
              </button>
            </div>
          </div>

          {feedback && (
            <div
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs border ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-800 text-rose-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
              <span>{feedback.text}</span>
              {feedback.checkoutUrl && (
                <a
                  href={feedback.checkoutUrl}
                  className="ml-auto font-bold underline underline-offset-2 shrink-0"
                >
                  Ir a Mercado Pago →
                </a>
              )}
            </div>
          )}

          {loading ? (
            <div className="text-center py-6 text-xs opacity-80">
              Consultando presupuestos y órdenes pendientes en PostgreSQL...
            </div>
          ) : contracts.length === 0 ? (
            <div
              className="p-4 rounded-xl border border-black/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
              style={innerStyle}
            >
              <span className="opacity-85">
                No hay órdenes de pago pendientes en este momento. Podés generar una orden desde una visita/pase QR o calificar tus servicios en la sección de reseñas.
              </span>
              {typeof onViewChange === 'function' && (
                <button
                  type="button"
                  onClick={() => onViewChange('resident')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white cursor-pointer hover:opacity-95 shrink-0"
                  style={{ backgroundColor: primaryActionColor }}
                >
                  <Compass size={13} /> Explorar prestadores
                </button>
              )}
            </div>
          ) : (
            <div className={ITEMS_GRID_CLASS}>
              {contracts.map((contract) => {
                const agreed = Number(contract.agreed_amount || 0);
                const platformFee = Number((agreed * effectiveFeeRate).toFixed(2));
                const providerPayout = Number((agreed - platformFee).toFixed(2));
                const providerName =
                  contract.provider_name ||
                  `${contract.first_name || ''} ${contract.last_name || ''}`.trim() ||
                  'Prestador Verificado';
                const statusMeta = getUnifiedStatusMeta(contract.status, 'contract');

                return (
                  <div
                    key={contract.id}
                    className={ITEM_CARD_CLASS}
                    style={innerStyle}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono font-bold text-emerald-400">
                            Contrato #{contract.id}
                          </span>{' '}
                          · <span className="font-bold text-sm">{providerName}</span>{' '}
                          <span className="opacity-75">({contract.specialty || 'Servicio'})</span>
                          <p className="opacity-80 mt-1">{contract.description}</p>
                        </div>
                        <span
                          className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border shrink-0 ${statusMeta.cls}`}
                        >
                          {statusMeta.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        <div
                          className="p-2.5 rounded-lg border border-white/10"
                          style={cardStyle}
                        >
                          <div className="text-[10px] opacity-75">Acordado (100%)</div>
                          <div className="font-mono font-bold text-xs mt-0.5">
                            ${agreed.toLocaleString('es-AR')}
                          </div>
                        </div>
                        <div
                          className="p-2.5 rounded-lg border border-white/10"
                          style={cardStyle}
                        >
                          <div className="text-[10px] opacity-75">Comisión (7%)</div>
                          <div className="font-mono font-bold text-xs text-amber-300 mt-0.5">
                            ${platformFee.toLocaleString('es-AR')}
                          </div>
                        </div>
                        <div
                          className="p-2.5 rounded-lg border border-white/10"
                          style={cardStyle}
                        >
                          <div className="text-[10px] opacity-75">Neto (93%)</div>
                          <div className="font-mono font-bold text-xs text-emerald-300 mt-0.5">
                            ${providerPayout.toLocaleString('es-AR')}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-white/10">
                      <button
                        type="button"
                        disabled={payingId === contract.id}
                        onClick={() => handlePayContract(contract.id, agreed)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer hover:opacity-95 disabled:opacity-50"
                        style={{ backgroundColor: primaryActionColor }}
                      >
                        <CreditCard size={14} />
                        {payingId === contract.id
                          ? 'Procesando pago...'
                          : `Pagar $${agreed.toLocaleString('es-AR')}`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Generar orden de pago a partir de un pase QR / visita */}
          {passes.length > 0 && (
            <form
              onSubmit={handleCreateContractFromVisit}
              className="p-4 rounded-xl border border-black/20 space-y-3 text-xs"
              style={innerStyle}
            >
              <div className="flex items-center gap-2 font-bold">
                <Ticket size={15} className="text-sky-400" />
                <span>Generar Orden desde Visita / Pase QR</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] opacity-75 mb-1">Pase QR / Prestador</label>
                  <select
                    value={selectedPassId}
                    onChange={(e) => setSelectedPassId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                    style={cardStyle}
                  >
                    {passes.map((p) => (
                      <option key={p.id} value={p.id}>
                        Pase #{p.id} — {p.provider_name || `Prestador #${p.provider_id}`} ({p.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] opacity-75 mb-1">Trabajo realizado</label>
                  <input
                    type="text"
                    required
                    value={workDescription}
                    onChange={(e) => setWorkDescription(e.target.value)}
                    placeholder="Ej: Reparación de pérdida y revisión"
                    className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                    style={cardStyle}
                  />
                </div>

                <div>
                  <label className="block text-[10px] opacity-75 mb-1">Monto acordado ($)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={agreedAmount}
                    onChange={(e) => setAgreedAmount(e.target.value)}
                    placeholder="Ej: 45000"
                    className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs font-mono focus:outline-none"
                    style={cardStyle}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={creatingContract}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer hover:opacity-95 disabled:opacity-50"
                  style={{ backgroundColor: primaryActionColor }}
                >
                  <PlusCircle size={13} />
                  {creatingContract ? 'Generando orden...' : 'Crear Orden de Pago'}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Bloque 2: Reseñas y Reputación Cruzada */}
        <section
          className={SECTION_CARD_CLASS}
          style={cardStyle}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-black/20 pb-4">
            <div className="flex items-center gap-3">
              <div
                className="p-2.5 rounded-xl border border-white/15 text-amber-400 shrink-0"
                style={innerStyle}
              >
                <Star size={18} strokeWidth={1.8} />
              </div>
              <div>
                <h3 className="text-lg font-bold">Reseñas y Reputación Cruzada</h3>
                <p className="text-xs opacity-80">
                  Calificá al prestador al concluir el trabajo y consultá las reseñas cruzadas de tus contratos.
                </p>
              </div>
            </div>

            <span className={statusBadgeClass} style={innerStyle}>
              {reviewContracts.length} contrato(s)
            </span>
          </div>

          {reviewFeedback && (
            <div
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs border ${
                reviewFeedback.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-800 text-rose-200'
              }`}
            >
              {reviewFeedback.type === 'success' ? (
                <CheckCircle2 size={15} />
              ) : (
                <AlertCircle size={15} />
              )}
              <span>{reviewFeedback.message}</span>
            </div>
          )}

          {loadingReviews ? (
            <div className="text-center py-6 text-xs opacity-80">
              Cargando historial de contratos para reseñas cruzadas...
            </div>
          ) : reviewContracts.length === 0 ? (
            <div
              className="p-4 rounded-xl border border-black/20 text-xs opacity-80 text-center"
              style={innerStyle}
            >
              Aún no tenés contratos registrados para emitir o consultar reseñas.
            </div>
          ) : (
            <div className={ITEMS_GRID_CLASS}>
              {reviewContracts.map((item) => {
                const currentDraftRating = ratingDrafts[item.contract_id] || 5;
                const currentDraftComment = commentDrafts[item.contract_id] || '';
                const alreadyRated = Boolean(item.provider_review_rating);
                const providerFullName =
                  `${item.provider_first_name || ''} ${item.provider_last_name || ''}`.trim() ||
                  'Prestador Verificado';

                return (
                  <div
                    key={item.contract_id}
                    className={ITEM_CARD_CLASS}
                    style={innerStyle}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-emerald-400">
                          Contrato #{item.contract_id}
                        </span>{' '}
                        · <span className="font-bold">{providerFullName}</span>{' '}
                        <span className="opacity-75">
                          ({item.specialty || 'Servicio'} · ★{' '}
                          {Number(item.provider_rating_avg || 0).toFixed(2)})
                        </span>
                        <p className="opacity-80 mt-1">{item.description}</p>
                      </div>
                      <span
                        className="font-mono border border-white/15 px-3 py-1 rounded-lg self-start"
                        style={cardStyle}
                      >
                        ${Number(item.agreed_amount || 0).toLocaleString('es-AR')}
                      </span>
                    </div>

                    {alreadyRated ? (
                      <div className="p-3 rounded-lg border border-emerald-800/60 bg-emerald-950/30 flex flex-wrap items-center justify-between gap-2">
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
                        className="p-3 rounded-lg border border-white/15 space-y-2.5"
                        style={cardStyle}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold opacity-90">
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
                                  className={currentDraftRating >= starVal ? 'fill-amber-400' : ''}
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
                              : 'Cerrar y Calificar'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Reseña recibida desde el prestador (estilo alineado) */}
                    {item.owner_review_rating ? (
                      <div className="p-3 rounded-lg border border-indigo-800/60 bg-indigo-950/35 flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-indigo-300">
                          Reseña recibida del prestador: {'★'.repeat(item.owner_review_rating)} (
                          {item.owner_review_rating}/5)
                        </span>
                        {item.owner_review_comment && (
                          <span className="opacity-90 italic">
                            "{item.owner_review_comment}"
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg border border-white/15 flex flex-wrap items-center justify-between gap-2 opacity-75">
                        <span>Pendiente de reseña cruzada por parte del prestador.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Bloque 3b: Contratos Activos / Completados — Conformidad, Comprobante y Reclamos */}
        {allContracts.filter((c) => ['in_progress', 'completed'].includes(String(c.status || '').toLowerCase())).length > 0 && (
          <section className={SECTION_CARD_CLASS} style={cardStyle}>
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FileText size={17} className="text-emerald-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold">
                    Conformidad Final, Comprobantes del Hogar y Garantía
                  </h3>
                  <p className="text-[11px] opacity-75">
                    Registrá conformidad, imprimí tu comprobante auditable o abrí un reclamo post-servicio.
                  </p>
                </div>
              </div>
            </div>

            <div className={ITEMS_GRID_CLASS}>
              {allContracts
                .filter((c) => ['in_progress', 'completed'].includes(String(c.status || '').toLowerCase()))
                .map((c) => {
                  const st = String(c.status || '').toLowerCase();
                  const statusMeta = getUnifiedStatusMeta(st, 'contract');
                  const hasOpenDispute = Number(c.open_disputes_count || 0) > 0;
                  return (
                    <div key={c.id} className={ITEM_CARD_CLASS} style={innerStyle}>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold">
                            Contrato #{c.id} · {c.provider_name || 'Prestador'}
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
                        <p className="text-xs opacity-80">{c.description}</p>
                        <p className="text-xs font-mono font-bold text-emerald-400">
                          ${Number(c.agreed_amount || 0).toLocaleString('es-AR')}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                        {st === 'in_progress' && (
                          <button
                            type="button"
                            disabled={completingId === c.id}
                            onClick={() => handleCompleteContract(c.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                            style={{ backgroundColor: primaryActionColor }}
                          >
                            <CheckCircle2 size={13} />
                            {completingId === c.id ? 'Guardando...' : 'Dar Conformidad'}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={loadingReceiptId === c.id}
                          onClick={() => handleOpenReceipt(c.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/15 cursor-pointer disabled:opacity-50"
                          style={cardStyle}
                        >
                          <FileText size={13} className="text-emerald-400" />
                          {loadingReceiptId === c.id ? 'Cargando...' : 'Comprobante'}
                        </button>
                        {!hasOpenDispute && (
                          <button
                            type="button"
                            onClick={() => {
                              setDisputeModalContract(c);
                              setDisputeReason('Trabajo incompleto o con fallas');
                              setDisputeDetails('');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-rose-800/60 bg-rose-950/35 text-rose-200 cursor-pointer"
                          >
                            <AlertCircle size={13} /> Reclamo
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        )}

        {/* Nota de respaldo de pasarela */}
        <div className="text-[11px] opacity-70 flex items-center gap-1.5">
          <Sparkles size={12} className="text-emerald-400" />
          <span>
            La comisión de plataforma del {gatewayConfig.platform_fee_percent}% se calcula automáticamente sobre cada orden abonada ({user?.email || 'residente'}).
          </span>
        </div>
      </main>

      {receiptModalData && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div
            className="w-full max-w-xl rounded-2xl p-6 border border-slate-700/80 shadow-2xl space-y-4 text-xs"
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
            <div className="p-3 rounded-xl border border-white/10 space-y-1" style={innerStyle}>
              <p className="font-bold">{receiptModalData.contract?.description}</p>
              <p className="opacity-80">
                Comunidad: {receiptModalData.community?.name} · Estado: {receiptModalData.contract?.status}
              </p>
              <p className="opacity-80">
                Monto: ${Number(receiptModalData.payment?.total_amount || 0).toLocaleString('es-AR')} · Neto prestador: $
                {Number(receiptModalData.payment?.provider_payout || 0).toLocaleString('es-AR')}
              </p>
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
                style={{ backgroundColor: primaryActionColor }}
              >
                <Printer size={14} /> Imprimir / Guardar PDF
              </button>
            </div>
          </div>
        </div>
      )}

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
            <form onSubmit={handleSubmitDispute} className="space-y-3">
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
              <textarea
                rows={4}
                required
                value={disputeDetails}
                onChange={(e) => setDisputeDetails(e.target.value)}
                placeholder="Describí qué ocurrió..."
                className="w-full px-3 py-2 rounded-xl border border-slate-700/80"
                style={innerStyle}
              />
              <div className="flex items-center justify-end gap-2">
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