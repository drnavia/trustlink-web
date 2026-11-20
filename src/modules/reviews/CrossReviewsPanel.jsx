/**
 * @file CrossReviewsPanel.jsx
 * @description Vista interactiva de reseñas y reputación cruzada (Residente -> Prestador y
 * Prestador -> Residente) vinculada a los contratos de TrustLink en PostgreSQL.
 * @location /trustlink-web/src/modules/reviews/CrossReviewsPanel.jsx
 */

import React, { useState, useEffect } from 'react';
import {
  Star,
  MessageSquarePlus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Award,
  UserCheck,
  Briefcase
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

const API_BASE = 'http://localhost:4000';

export default function CrossReviewsPanel() {
  const { user } = useAuth();
  const isProvider = user?.role === 'provider';

  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [feedback, setFeedback] = useState(null);

  const [selectedContractId, setSelectedContractId] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`
  });

  const fetchContractsAndReviews = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/reviews/contracts`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        const list = data.contracts || [];
        setContracts(list);
        const firstPendingReview = list.find((item) =>
          isProvider ? !item.owner_review_rating : !item.provider_review_rating
        );
        if (firstPendingReview) {
          setSelectedContractId(firstPendingReview.contract_id);
        } else if (list.length > 0) {
          setSelectedContractId(list[0].contract_id);
        }
      } else {
        setErrorMsg(data.error || 'No se pudieron cargar los contratos para reseñas.');
      }
    } catch (err) {
      console.error('Error al cargar contratos para reseñas:', err);
      setErrorMsg('Error de conexión con el servidor backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContractsAndReviews();
  }, [user?.role]);

  const handleOpenReviewForm = (contractItem) => {
    setSelectedContractId(contractItem.contract_id);
    setRating(5);
    setComment('');
    setFeedback(null);
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!selectedContractId) return;

    setSubmitting(true);
    setFeedback(null);

    const endpoint = isProvider ? '/api/v1/reviews/owner' : '/api/v1/reviews/provider';

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          contract_id: Number(selectedContractId),
          rating: Number(rating),
          comment: comment.trim() || null
        })
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: 'success',
          message: data.message || 'Calificación registrada correctamente.'
        });
        setComment('');
        setRating(5);
        await fetchContractsAndReviews();
      } else {
        setFeedback({
          type: 'error',
          message: data.error || 'No se pudo registrar la calificación.'
        });
      }
    } catch (err) {
      console.error('Error al enviar reseña:', err);
      setFeedback({
        type: 'error',
        message: 'Error de red al enviar la calificación.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const activeContract = contracts.find(
    (item) => Number(item.contract_id) === Number(selectedContractId)
  );

  const alreadyReviewedByCurrentUser = activeContract
    ? isProvider
      ? Boolean(activeContract.owner_review_rating)
      : Boolean(activeContract.provider_review_rating)
    : false;

  return (
    <div className="min-h-[calc(100vh-50px)] bg-slate-900 text-slate-100 font-sans p-6 md:p-8">
      <main className="max-w-6xl mx-auto space-y-6">
        {/* Cabecera */}
        <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Award size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-white">
                Reseñas y Reputación Cruzada
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isProvider
                  ? 'Calificá a los residentes/propietarios con los que operaste y consultá sus reseñas.'
                  : 'Calificá a los prestadores contratados y actualizá su reputación en la red TrustLink.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchContractsAndReviews}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 bg-rose-950/60 border border-rose-800/80 text-rose-200 p-4 rounded-xl text-xs">
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {feedback && (
          <div
            className={`flex items-center gap-2 p-4 rounded-xl text-xs border ${
              feedback.type === 'success'
                ? 'bg-emerald-950/50 border-emerald-800 text-emerald-200'
                : 'bg-rose-950/50 border-rose-800 text-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-rose-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Columna izquierda: Contratos vinculados */}
          <div className="lg:col-span-7 bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase size={17} className="text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Contratos Registrados ({contracts.length})
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Rol: {user?.role || 'owner'}
              </span>
            </div>

            {loading ? (
              <div className="text-center py-10 text-xs text-slate-400">
                Cargando contratos y calificaciones desde PostgreSQL...
              </div>
            ) : contracts.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">
                No hay contratos asociados a tu cuenta para emitir reseñas.
              </div>
            ) : (
              <div className="space-y-3">
                {contracts.map((item) => {
                  const isSelected = Number(item.contract_id) === Number(selectedContractId);
                  const reviewedByMe = isProvider
                    ? Boolean(item.owner_review_rating)
                    : Boolean(item.provider_review_rating);

                  return (
                    <div
                      key={item.contract_id}
                      onClick={() => handleOpenReviewForm(item)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 ${
                        isSelected
                          ? 'bg-slate-900 border-emerald-600/80 shadow-md'
                          : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-300">
                            Contrato #{item.contract_id}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                            {item.contract_status}
                          </span>
                          {item.payment_status && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                              Pago: {item.payment_status}
                            </span>
                          )}
                        </div>

                        <span className="font-mono text-xs font-bold text-emerald-400">
                          ${Number(item.agreed_amount || 0).toFixed(2)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-200 font-medium">{item.description}</p>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-1">
                        <span>
                          {isProvider ? (
                            <>
                              Residente:{' '}
                              <strong className="text-slate-200">
                                {`${item.owner_first_name || ''} ${item.owner_last_name || ''}`.trim() ||
                                  `#${item.owner_id}`}
                              </strong>
                            </>
                          ) : (
                            <>
                              Prestador:{' '}
                              <strong className="text-slate-200">
                                {`${item.provider_first_name || ''} ${item.provider_last_name || ''}`.trim() ||
                                  `#${item.provider_id}`}
                              </strong>{' '}
                              ({item.specialty || 'Servicio'}) · Scoring{' '}
                              <strong className="text-amber-400">
                                ★ {Number(item.provider_rating_avg || 0).toFixed(2)}
                              </strong>
                            </>
                          )}
                        </span>

                        {reviewedByMe ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                            <CheckCircle2 size={12} /> Calificado (
                            {isProvider ? item.owner_review_rating : item.provider_review_rating}/5)
                          </span>
                        ) : (
                          <span className="text-amber-300 font-semibold">Pendiente de calificar</span>
                        )}
                      </div>

                      {(item.provider_review_comment || item.owner_review_comment) && (
                        <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-2.5 text-[11px] text-slate-300 space-y-1 mt-1">
                          {item.provider_review_rating && (
                            <div>
                              <span className="text-amber-400 font-bold">
                                Reseña al prestador ({item.provider_review_rating}★):
                              </span>{' '}
                              {item.provider_review_comment || 'Sin comentario'}
                            </div>
                          )}
                          {item.owner_review_rating && (
                            <div>
                              <span className="text-sky-400 font-bold">
                                Reseña al residente ({item.owner_review_rating}★):
                              </span>{' '}
                              {item.owner_review_comment || 'Sin comentario'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Columna derecha: Formulario de calificación cruzada */}
          <div className="lg:col-span-5 bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4 h-fit">
            <div className="flex items-center gap-2">
              <MessageSquarePlus size={17} className="text-amber-400" />
              <h3 className="text-sm font-bold text-white">
                {isProvider ? 'Calificar al Residente / Propietario' : 'Calificar al Prestador'}
              </h3>
            </div>

            {!activeContract ? (
              <p className="text-xs text-slate-400">
                Seleccioná un contrato en el listado para emitir una calificación cruzada.
              </p>
            ) : alreadyReviewedByCurrentUser ? (
              <div className="bg-emerald-950/35 border border-emerald-800/70 rounded-xl p-4 text-xs text-emerald-200 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold">
                  <UserCheck size={15} className="text-emerald-400" />
                  <span>Ya registraste tu calificación para el Contrato #{activeContract.contract_id}</span>
                </div>
                <p className="text-slate-300">
                  Puntaje otorgado:{' '}
                  <strong className="text-amber-400">
                    {isProvider
                      ? activeContract.owner_review_rating
                      : activeContract.provider_review_rating}{' '}
                    / 5 ★
                  </strong>
                </p>
                <p className="text-slate-400 italic">
                  “
                  {(isProvider
                    ? activeContract.owner_review_comment
                    : activeContract.provider_review_comment) || 'Sin comentario adicional'}
                  ”
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-xs space-y-1">
                  <div className="font-mono text-slate-400">
                    Contrato #{activeContract.contract_id} · ${Number(activeContract.agreed_amount || 0).toFixed(2)}
                  </div>
                  <div className="font-bold text-white">
                    {isProvider
                      ? `${activeContract.owner_first_name || ''} ${activeContract.owner_last_name || ''}`.trim() ||
                        'Residente'
                      : `${activeContract.provider_first_name || ''} ${activeContract.provider_last_name || ''}`.trim() ||
                        'Prestador'}
                  </div>
                  <div className="text-slate-400">{activeContract.description}</div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Puntuación (1 a 5 estrellas)
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((starVal) => (
                      <button
                        key={starVal}
                        type="button"
                        onClick={() => setRating(starVal)}
                        className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                          rating >= starVal
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Star
                          size={14}
                          className={rating >= starVal ? 'fill-amber-400 text-amber-400' : ''}
                        />
                        <span>{starVal}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Comentario de la experiencia
                  </label>
                  <textarea
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={
                      isProvider
                        ? 'Ej: Buena predisposición, acceso ágil y pago acordado en tiempo y forma.'
                        : 'Ej: Excelente trabajo, puntualidad y cumplimiento de seguridad en el barrio.'
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Star size={14} className="fill-white" />
                  <span>{submitting ? 'Guardando reseña...' : 'Publicar Calificación'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}