/**
 * @file ContractPaymentView.jsx
 * @description Vista de Pagos y Calificación Cruzada con aplicación explícita de
 * Zona 4 (tarjetas principales) y Zona 5 (cajas internas).
 * @location /trustlink-web/src/modules/owner/ContractPaymentView.jsx
 */

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  ShieldCheck,
  FileText,
  AlertCircle,
  Loader2,
  Star,
  Wrench,
  MessageSquare,
  Send,
} from 'lucide-react';
import { useBranding, DEFAULT_BRANDING_CONFIG } from '../branding/BrandingContext';

const API_BASE = 'http://localhost:4000';

export default function ContractPaymentView() {
  const { brand } = useBranding();

  const cardStyle = {
    backgroundColor: brand.cardBgColor || DEFAULT_BRANDING_CONFIG.cardBgColor,
    color: brand.cardTextColor || DEFAULT_BRANDING_CONFIG.cardTextColor,
  };

  const innerStyle = {
    backgroundColor: brand.innerBgColor || DEFAULT_BRANDING_CONFIG.innerBgColor,
    color: brand.innerTextColor || DEFAULT_BRANDING_CONFIG.innerTextColor,
  };

  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const [reviewContracts, setReviewContracts] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [ratingDrafts, setRatingDrafts] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [submittingContractId, setSubmittingContractId] = useState(null);

  const fetchPendingContract = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/payments/pending`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setContract(data.contracts && data.contracts.length > 0 ? data.contracts[0] : null);
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

  const fetchReviewableContracts = async () => {
    setLoadingReviews(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/reviews/owner-contracts`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setReviewContracts(data.contracts || []);
      }
    } catch (error) {
      console.error('Error al cargar historial de contratos para reseñas:', error);
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    fetchPendingContract();
    fetchReviewableContracts();
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
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
        body: JSON.stringify({
          contract_id: contract.id,
          agreed_amount: contract.agreed_amount,
        }),
      });
      const data = await response.json();
      if (response.ok && data.checkout_url) {
        setPaymentUrl(data.checkout_url);
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
    setErrorMsg('');

    try {
      const response = await fetch(`${API_BASE}/api/v1/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
        body: JSON.stringify({
          contract_id: contractId,
          rating: selectedRating,
          comment: commentText,
          target_role: 'provider',
        }),
      });
      const data = await response.json();
      if (response.ok) {
        await fetchReviewableContracts();
        await fetchPendingContract();
      } else {
        setErrorMsg(data.error || 'No se pudo enviar la calificación.');
      }
    } catch (error) {
      console.error('Error al enviar calificación:', error);
      setErrorMsg('Error de conexión al registrar la calificación.');
    } finally {
      setSubmittingContractId(null);
    }
  };

  const totalAmount = contract ? Number(contract.agreed_amount) : 0;
  const platformFee = Number((totalAmount * 0.07).toFixed(2));
  const providerPayout = Number((totalAmount - platformFee).toFixed(2));

  return (
    <div className="max-w-3xl w-full mx-auto px-4 py-6 space-y-6">
      {/* Zona 4: Tarjeta de Presupuesto y Orden de Pago */}
      <section
        className="p-6 md:p-8 rounded-2xl border border-black/20"
        style={cardStyle}
      >
        <div className="flex items-center justify-between pb-5 border-b border-black/20 mb-6 gap-3">
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-xl border border-white/15"
              style={innerStyle}
            >
              <FileText size={22} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">
                Presupuesto y Orden de Pago
              </h2>
              <p className="text-xs opacity-80">
                Transacción segura respaldada por {brand.countryName || 'TrustLink Community'}
              </p>
            </div>
          </div>

          <span
            className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border border-white/15"
            style={innerStyle}
          >
            {contract ? contract.status : 'Sin Contratos'}
          </span>
        </div>

        {loading ? (
          <div
            className="text-center py-12 rounded-xl border border-black/20 text-xs flex items-center justify-center gap-2"
            style={innerStyle}
          >
            <Loader2 className="animate-spin" size={16} /> Consultando contratos pendientes...
          </div>
        ) : !contract ? (
          <div
            className="text-center py-12 px-4 rounded-xl border border-black/20 text-xs opacity-90"
            style={innerStyle}
          >
            No hay órdenes de pago pendientes en este momento. Podés calificar tus servicios realizados en la sección inferior.
          </div>
        ) : (
          <>
            {/* Zona 5: Caja Interna con Detalle del Contrato */}
            <div
              className="p-5 rounded-xl border border-black/20 mb-6 space-y-4"
              style={innerStyle}
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md border border-white/15">
                      Contrato #{contract.id}
                    </span>
                    {contract.provider_status === 'approved' && (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md border border-white/15 flex items-center gap-1 text-emerald-400">
                        <ShieldCheck size={12} /> Compliance Verificado
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold">
                    {contract.provider_name || 'Profesional Verificado'}
                  </h3>
                  {contract.specialty && (
                    <p className="text-xs font-medium mt-0.5 flex items-center gap-1 text-emerald-400">
                      <Wrench size={12} /> {contract.specialty}
                    </p>
                  )}
                  <p className="text-xs opacity-85 mt-1.5">
                    <strong>Detalle del trabajo:</strong> {contract.description}
                  </p>
                </div>

                <span className="text-amber-300 font-bold text-xs px-3 py-1 rounded-lg border border-white/15 flex items-center gap-1 shrink-0">
                  <Star size={12} className="fill-amber-400 text-amber-400" />{' '}
                  {Number(contract.rating_avg || 5.0).toFixed(1)} Scoring
                </span>
              </div>

              <div className="border-t border-black/20 pt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="p-3.5 rounded-xl border border-white/15" style={cardStyle}>
                  <span className="text-xs opacity-80 block mb-1">Monto Acordado</span>
                  <span className="text-base font-black">
                    ${totalAmount.toLocaleString('es-AR')} ARS
                  </span>
                </div>
                <div className="p-3.5 rounded-xl border border-white/15" style={cardStyle}>
                  <span className="text-xs opacity-80 block mb-1">Comisión TrustLink (7%)</span>
                  <span className="text-base font-black text-emerald-400">
                    ${platformFee.toLocaleString('es-AR')} ARS
                  </span>
                </div>
                <div className="p-3.5 rounded-xl border border-white/15" style={cardStyle}>
                  <span className="text-xs opacity-80 block mb-1">Neto Prestador</span>
                  <span className="text-base font-black">
                    ${providerPayout.toLocaleString('es-AR')} ARS
                  </span>
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="bg-rose-950/60 border border-rose-800 text-rose-200 p-4 rounded-xl text-center font-medium mb-6 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {paymentUrl ? (
              <div
                className="p-6 rounded-xl text-center space-y-4 border border-white/15"
                style={innerStyle}
              >
                <CheckCircle2 size={34} className="text-emerald-400 mx-auto" />
                <h4 className="text-base font-bold">¡Preferencia de Pago Generada con Éxito!</h4>
                <p className="text-xs opacity-85">
                  Hacé clic en el botón para proceder con la pasarela de pago.
                </p>
                <a
                  href={paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-sky-600 hover:bg-sky-500 text-white font-bold px-6 py-2.5 rounded-xl transition-colors text-xs"
                >
                  Pagar en Pasarela Segura
                </a>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleProcessPayment}
                disabled={paying}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-xs disabled:opacity-50 cursor-pointer"
              >
                {paying ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <CreditCard size={16} />
                )}
                {paying ? 'Generando Orden de Pago...' : 'Aprobar y Pagar Servicio'}
              </button>
            )}
          </>
        )}
      </section>

      {/* Zona 4: Tarjeta de Cierre de Servicio y Calificación Cruzada */}
      <section
        className="p-6 md:p-8 rounded-2xl border border-black/20 space-y-5"
        style={cardStyle}
      >
        <div className="flex items-center justify-between border-b border-black/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl border border-white/15" style={innerStyle}>
              <Star size={20} className="text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Cierre de Servicio &amp; Calificación Cruzada</h3>
              <p className="text-xs opacity-80">
                Calificá al prestador al concluir el trabajo; tu reseña actualiza su reputación en TrustLink.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold opacity-80">
            {reviewContracts.length} contrato(s)
          </span>
        </div>

        {loadingReviews ? (
          <div
            className="text-center py-8 rounded-xl border border-black/20 text-xs"
            style={innerStyle}
          >
            Cargando contratos...
          </div>
        ) : reviewContracts.length === 0 ? (
          <div
            className="text-center py-8 rounded-xl border border-black/20 text-xs opacity-85"
            style={innerStyle}
          >
            Aún no tenés contratos registrados para calificar.
          </div>
        ) : (
          <div className="space-y-4">
            {reviewContracts.map((item) => {
              const currentDraftRating = ratingDrafts[item.contract_id] || 5;
              const currentDraftComment = commentDrafts[item.contract_id] || '';
              const alreadyRated = Boolean(item.provider_review_id);

              return (
                <div
                  key={item.contract_id}
                  className="p-4 rounded-xl border border-black/20 space-y-3 text-xs"
                  style={innerStyle}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold px-2 py-0.5 rounded border border-white/15">
                        Contrato #{item.contract_id}
                      </span>
                      <span className="opacity-80">{item.country_name || 'TrustLink Community'}</span>
                    </div>
                    <span className="uppercase text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-white/15">
                      {item.status}
                    </span>
                  </div>

                  <p className="font-bold">
                    Prestador: {item.provider_name || 'Profesional Verificado'}
                  </p>
                  <p className="opacity-85">{item.description}</p>

                  {alreadyRated ? (
                    <div className="p-3 rounded-lg border border-white/15 flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-emerald-400">
                        Calificación enviada: {'★'.repeat(item.provider_review_rating)} (
                        {item.provider_review_rating}/5)
                      </span>
                      {item.provider_review_comment && (
                        <span className="opacity-85 italic">
                          "{item.provider_review_comment}"
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3 pt-2 border-t border-black/20">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">Calificar trabajo del prestador:</span>
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
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                currentDraftRating >= starVal
                                  ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                                  : 'border-white/15 opacity-70 hover:opacity-100'
                              }`}
                            >
                              <Star size={14} className="fill-current" />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="relative">
                        <MessageSquare
                          size={14}
                          className="absolute left-3 top-2.5 opacity-70"
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
                          placeholder="Comentario breve sobre puntualidad, prolijidad y cumplimiento..."
                          className="w-full pl-8 pr-3 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                          style={cardStyle}
                        />
                      </div>

                      <div className="flex justify-end">
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
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}