/**
 * @file ContractPaymentView.jsx
 * @description Vista del residente para visualizar contratos pendientes desde PostgreSQL,
 * aprobar presupuestos con cálculo de Take Rate (7%) y emitir calificaciones cruzadas al prestador.
 * @location /trustlink-web/src/modules/owner/ContractPaymentView.jsx
 */

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  FileText,
  AlertCircle,
  Loader2,
  Star,
  MessageSquare,
  Send
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';

const API_BASE = 'http://localhost:4000';

export default function ContractPaymentView() {
  const { brand } = useBranding();

  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Estado para historial de contratos y reseñas cruzadas
  const [reviewContracts, setReviewContracts] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [ratingDrafts, setRatingDrafts] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [submittingContractId, setSubmittingContractId] = useState(null);
  const [reviewFeedback, setReviewFeedback] = useState(null);

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`
  });

  const fetchPendingContract = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/payments/pending`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (response.ok) {
        if (data.contracts && data.contracts.length > 0) {
          setContract(data.contracts[0]);
        } else {
          setContract(null);
        }
      } else {
        setErrorMsg(data.error || 'No se pudo cargar la orden de pago.');
      }
    } catch (error) {
      console.error('Error de red al obtener contratos:', error);
      setErrorMsg('Error de conexión con el servidor backend de TrustLink.');
    } finally {
      setLoading(false);
    }
  };

  const fetchReviewContracts = async () => {
    setLoadingReviews(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/reviews/contracts`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (response.ok) {
        setReviewContracts(data.contracts || []);
      }
    } catch (error) {
      console.error('Error al consultar contratos para reseñas:', error);
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    fetchPendingContract();
    fetchReviewContracts();
  }, []);

  const handleProcessPayment = async () => {
    if (!contract) return;
    setPaying(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/payments/quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          contract_id: contract.id,
          agreed_amount: contract.agreed_amount
        })
      });
      const data = await response.json();
      if (response.ok && data.checkout_url) {
        setPaymentUrl(data.checkout_url);
        await fetchReviewContracts();
      } else {
        setErrorMsg(data.error || 'No se pudo generar la orden de pago en la pasarela.');
      }
    } catch (error) {
      console.error('Error al procesar pasarela:', error);
      setErrorMsg('Error de conexión con el servidor de pagos de TrustLink.');
    } finally {
      setPaying(false);
    }
  };

  const handleSubmitProviderReview = async (contractId) => {
    const selectedRating = ratingDrafts[contractId] || 5;
    const commentText = (commentDrafts[contractId] || '').trim();

    setSubmittingContractId(contractId);
    setReviewFeedback(null);
    try {
      const response = await fetch(`${API_BASE}/api/v1/reviews/provider`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          contract_id: contractId,
          rating: selectedRating,
          comment: commentText || null
        })
      });
      const data = await response.json();
      if (response.ok) {
        setReviewFeedback({
          type: 'success',
          message:
            data.message ||
            `Calificación enviada. Nuevo promedio del prestador: ${data.updated_provider_rating} ★`
        });
        await Promise.all([fetchReviewContracts(), fetchPendingContract()]);
      } else {
        setReviewFeedback({
          type: 'error',
          message: data.error || 'No se pudo registrar la reseña.'
        });
      }
    } catch (error) {
      console.error('Error al enviar reseña al prestador:', error);
      setReviewFeedback({
        type: 'error',
        message: 'Error de conexión al registrar la calificación.'
      });
    } finally {
      setSubmittingContractId(null);
    }
  };

  const totalAmount = contract ? Number(contract.agreed_amount) : 0;
  const platformFee = Number((totalAmount * 0.07).toFixed(2));
  const providerPayout = Number((totalAmount - platformFee).toFixed(2));

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-6 font-sans text-slate-100">
      {/* Bloque 1: Presupuesto y Orden de Pago */}
      <div className="p-6 md:p-8 bg-slate-950 rounded-3xl border border-slate-800 shadow-2xl">
        <div className="flex items-center justify-between pb-6 border-b border-slate-800 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
              <FileText size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-white">Presupuesto y Orden de Pago</h2>
              <p className="text-xs text-slate-400">
                Transacción segura respaldada por {brand.countryName || 'TrustLink Community'}
              </p>
            </div>
          </div>
          <span className="text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-full">
            {contract ? contract.status : 'Sin Pendientes'}
          </span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400 text-xs flex items-center justify-center gap-2">
            <Loader2 className="animate-spin" size={16} /> Consultando contratos pendientes en PostgreSQL...
          </div>
        ) : !contract ? (
          <div className="text-center py-10 bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400 text-xs">
            No hay órdenes de pago pendientes en este momento. Podés calificar tus servicios realizados en la sección inferior.
          </div>
        ) : (
          <>
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 mb-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2.5 py-0.5 rounded-md">
                    Contrato #{contract.id}
                  </span>
                  <h3 className="text-base font-bold text-white mt-2">
                    Prestador: {contract.provider_name || 'Profesional Verificado'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    <strong>Detalle del trabajo:</strong> {contract.description}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                  <span className="text-xs text-slate-400 block mb-1">Monto Acordado</span>
                  <span className="text-base font-black text-white">
                    ${totalAmount.toLocaleString('es-AR')} ARS
                  </span>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                  <span className="text-xs text-slate-400 block mb-1">Comisión TrustLink (7%)</span>
                  <span className="text-base font-black text-emerald-400">
                    ${platformFee.toLocaleString('es-AR')} ARS
                  </span>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                  <span className="text-xs text-slate-400 block mb-1">Neto Prestador</span>
                  <span className="text-base font-black text-slate-200">
                    ${providerPayout.toLocaleString('es-AR')} ARS
                  </span>
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="bg-rose-950/50 border border-rose-800 text-rose-200 p-4 rounded-xl text-center font-medium mb-6 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {paymentUrl ? (
              <div className="bg-emerald-950/40 border border-emerald-600/50 p-6 rounded-2xl text-center space-y-4">
                <CheckCircle2 size={36} className="text-emerald-400 mx-auto" />
                <h4 className="text-base font-bold text-white">¡Preferencia de Pago Generada con Éxito!</h4>
                <p className="text-xs text-slate-300">
                  Hacé clic en el botón para proceder de manera segura con la pasarela.
                </p>
                <a
                  href={paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-sky-600 hover:bg-sky-500 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg text-xs"
                >
                  Pagar en Pasarela Segura ➔
                </a>
              </div>
            ) : (
              <button
                onClick={handleProcessPayment}
                disabled={paying}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-xs active:scale-95 disabled:opacity-50 cursor-pointer"
                style={{ backgroundColor: brand.primaryColor || '#10b981' }}
              >
                {paying ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
                {paying ? 'Generando Orden de Pago...' : 'Aprobar y Pagar Servicio'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Bloque 2: Cierre de Servicio y Reputación Cruzada */}
      <div className="p-6 md:p-8 bg-slate-950 rounded-3xl border border-slate-800 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
              <Star size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Cierre de Servicio &amp; Calificación Cruzada</h3>
              <p className="text-xs text-slate-400">
                Calificá al prestador al concluir el trabajo; tu reseña actualiza su reputación verificada en TrustLink.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-slate-400">
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
            {reviewFeedback.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            <span>{reviewFeedback.message}</span>
          </div>
        )}

        {loadingReviews ? (
          <div className="text-center py-8 text-xs text-slate-400">
            Cargando historial de servicios y reseñas...
          </div>
        ) : reviewContracts.length === 0 ? (
          <div className="text-center py-8 bg-slate-900/60 rounded-2xl border border-slate-800 text-xs text-slate-400">
            Aún no tenés contratos registrados para calificar.
          </div>
        ) : (
          <div className="space-y-4">
            {reviewContracts.map((item) => {
              const currentDraftRating = ratingDrafts[item.contract_id] || 5;
              const currentDraftComment = commentDrafts[item.contract_id] || '';
              const alreadyReviewedProvider = Boolean(item.provider_review_id);

              return (
                <div
                  key={item.contract_id}
                  className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800 px-2 py-0.5 rounded">
                          Contrato #{item.contract_id}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400">
                          {item.country_name || 'TrustLink Community'}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white mt-1.5">
                        {`${item.provider_first_name || ''} ${item.provider_last_name || ''}`.trim() ||
                          'Prestador Verificado'}{' '}
                        <span className="text-xs font-normal text-emerald-400">
                          ({item.specialty || 'Servicios'})
                        </span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <span className="text-amber-300 font-bold text-xs bg-amber-950/60 border border-amber-800 px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <Star size={12} className="fill-amber-400" />
                        {Number(item.provider_rating_avg || 0).toFixed(1)}
                      </span>
                      <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                        ${Number(item.agreed_amount || 0).toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>

                  {alreadyReviewedProvider ? (
                    <div className="bg-slate-950 border border-emerald-900/60 rounded-xl p-3.5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-300">
                          Tu calificación al prestador: {'★'.repeat(item.provider_review_rating)} (
                          {item.provider_review_rating}/5)
                        </span>
                        <span className="text-[11px] text-slate-500">Registrada en PostgreSQL</span>
                      </div>
                      {item.provider_review_comment && (
                        <p className="text-slate-300 italic">"{item.provider_review_comment}"</p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-300">
                          Calificar trabajo del prestador:
                        </span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((starVal) => (
                            <button
                              key={starVal}
                              type="button"
                              onClick={() =>
                                setRatingDrafts((prev) => ({ ...prev, [item.contract_id]: starVal }))
                              }
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                currentDraftRating >= starVal
                                  ? 'bg-amber-950/70 border-amber-700 text-amber-300'
                                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                              }`}
                            >
                              <Star
                                size={14}
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
                            className="text-slate-500 absolute left-3 top-1/2 -translate-y-1/2"
                          />
                          <input
                            type="text"
                            value={currentDraftComment}
                            onChange={(e) =>
                              setCommentDrafts((prev) => ({
                                ...prev,
                                [item.contract_id]: e.target.value
                              }))
                            }
                            placeholder="Comentario breve sobre puntualidad, prolijidad y cumplimiento..."
                            className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSubmitProviderReview(item.contract_id)}
                          disabled={submittingContractId === item.contract_id}
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Send size={13} />
                          {submittingContractId === item.contract_id
                            ? 'Enviando...'
                            : 'Cerrar y Calificar'}
                        </button>
                      </div>
                    </div>
                  )}

                  {item.owner_review_rating && (
                    <div className="bg-indigo-950/30 border border-indigo-800/60 rounded-xl p-3 text-xs flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-indigo-300">
                        Calificación cruzada recibida del prestador: {'★'.repeat(item.owner_review_rating)} (
                        {item.owner_review_rating}/5)
                      </span>
                      {item.owner_review_comment && (
                        <span className="text-slate-300 italic">"{item.owner_review_comment}"</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}