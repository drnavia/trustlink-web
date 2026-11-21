/**
 * @file CrossReviewsPanel.jsx
 * @description Panel de reseñas y reputación cruzada de TrustLink conectado a PostgreSQL.
 * Aplica Zonas 4 y 5, color de marca y título unificado text-xl.
 * @location /trustlink-web/src/modules/reviews/CrossReviewsPanel.jsx
 */

import React, { useState, useEffect } from 'react';
import {
  Star,
  Briefcase,
  MessageSquarePlus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  UserCheck
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';
import { useAuth } from '../auth/AuthContext';

const API_BASE = 'http://localhost:4000';

export default function CrossReviewsPanel() {
  const { brand } = useBranding();
  const { user } = useAuth();

  // Zona 4: Tarjetas principales
  const cardStyle = {
    backgroundColor: brand?.cardBgColor || '#020617',
    color: brand?.cardTextColor || '#F1F5F9',
  };

  // Zona 5: Cajas internas e inputs
  const innerStyle = {
    backgroundColor: brand?.innerBgColor || '#0F172A',
    color: brand?.innerTextColor || '#F1F5F9',
  };

  // Color principal / de acento configurado en marca
  const primaryActionColor = brand?.accentColor || brand?.primaryColor || '#10b981';

  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [selectedContractId, setSelectedContractId] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
  });

  const fetchContracts = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/reviews/contracts`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        const list = data.contracts || [];
        setContracts(list);
        if (list.length > 0 && !selectedContractId) {
          setSelectedContractId(list[0].contract_id);
        }
      } else {
        setErrorMsg(data.error || 'No se pudieron cargar los contratos para reseñas.');
      }
    } catch (error) {
      console.error('Error al cargar contratos:', error);
      setErrorMsg('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  const activeContract =
    contracts.find((c) => Number(c.contract_id) === Number(selectedContractId)) || null;
  const isProviderReviewer = user?.role === 'provider';

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!activeContract) return;

    setSubmitting(true);
    setFeedback(null);

    const endpoint = isProviderReviewer
      ? `${API_BASE}/api/v1/reviews/owner`
      : `${API_BASE}/api/v1/reviews/provider`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          contract_id: activeContract.contract_id,
          rating,
          comment: comment.trim() || null,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({
          type: 'success',
          message: data.message || 'Calificación registrada correctamente.',
        });
        setComment('');
        await fetchContracts();
      } else {
        setFeedback({
          type: 'error',
          message: data.error || 'No se pudo registrar la calificación.',
        });
      }
    } catch (error) {
      console.error('Error al enviar reseña:', error);
      setFeedback({
        type: 'error',
        message: 'Error de conexión al guardar la calificación.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 md:p-8 flex-1">
      <main className="max-w-6xl mx-auto space-y-6">
        {/* Cabecera */}
        <section
          className="border border-black/20 p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          style={cardStyle}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="p-3 rounded-xl border border-white/15 text-amber-400 shrink-0"
              style={innerStyle}
            >
              <Star size={20} strokeWidth={1.8} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">
                Reputación Cruzada y Reseñas
              </h2>
              <p className="text-xs opacity-80 mt-0.5">
                Calificaciones verificadas entre residentes y prestadores sobre servicios reales.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchContracts}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-white/15 transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer self-start sm:self-auto"
            style={innerStyle}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </section>

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna izquierda: historial de contratos */}
          <section
            className="lg:col-span-2 border border-black/20 p-6 rounded-2xl shadow-sm space-y-4"
            style={cardStyle}
          >
            <div className="flex items-center justify-between border-b border-black/20 pb-3">
              <div className="flex items-center gap-2">
                <Briefcase size={17} className="text-emerald-400" />
                <h3 className="text-sm font-bold">Historial de Contratos y Reseñas</h3>
              </div>
              <span className="text-[11px] font-mono opacity-80">
                {contracts.length} contrato(s)
              </span>
            </div>

            {loading ? (
              <div className="text-center py-10 text-xs opacity-80">
                Cargando historial de contratos...
              </div>
            ) : contracts.length === 0 ? (
              <div
                className="text-center py-10 text-xs opacity-75 rounded-xl border border-black/20"
                style={innerStyle}
              >
                No hay contratos registrados para mostrar reseñas.
              </div>
            ) : (
              <div className="space-y-3">
                {contracts.map((item) => {
                  const isSelected = Number(item.contract_id) === Number(selectedContractId);
                  return (
                    <div
                      key={item.contract_id}
                      onClick={() => setSelectedContractId(item.contract_id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 text-xs ${
                        isSelected ? 'border-emerald-500/70' : 'border-black/20'
                      }`}
                      style={innerStyle}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-emerald-400">
                            Contrato #{item.contract_id}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold border border-white/15">
                            {item.contract_status}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-emerald-400">
                          ${Number(item.agreed_amount || 0).toLocaleString('es-AR')}
                        </span>
                      </div>

                      <p className="font-medium">{item.description}</p>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] opacity-80 pt-1">
                        <div>
                          <span>
                            Prestador:{' '}
                            <strong>
                              {`${item.provider_first_name || ''} ${item.provider_last_name || ''}`.trim() ||
                                'N/D'}
                            </strong>
                          </span>
                          <span className="mx-2">·</span>
                          <span>
                            Residente:{' '}
                            <strong>
                              {`${item.owner_first_name || ''} ${item.owner_last_name || ''}`.trim() ||
                                'N/D'}
                            </strong>
                          </span>
                        </div>
                        <span>
                          Scoring prestador:{' '}
                          <strong className="text-amber-400">
                            {Number(item.provider_rating_avg || 0).toFixed(2)} ★
                          </strong>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Columna derecha: formulario de calificación cruzada */}
          <section
            className="border border-black/20 p-6 rounded-2xl shadow-sm space-y-4 self-start"
            style={cardStyle}
          >
            <div className="flex items-center gap-2 border-b border-black/20 pb-3">
              <MessageSquarePlus size={17} className="text-amber-400" />
              <h3 className="text-sm font-bold">
                {isProviderReviewer ? 'Calificar al Residente' : 'Calificar al Prestador'}
              </h3>
            </div>

            {!activeContract ? (
              <div className="text-xs opacity-75 py-6 text-center">
                Seleccioná un contrato para emitir una calificación.
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="space-y-4 text-xs">
                <div
                  className="p-3.5 rounded-xl border border-black/20 space-y-1"
                  style={innerStyle}
                >
                  <div className="font-mono opacity-80">Contrato #{activeContract.contract_id}</div>
                  <div className="font-bold">
                    {isProviderReviewer
                      ? `${activeContract.owner_first_name || ''} ${activeContract.owner_last_name || ''}`.trim() ||
                        'Residente'
                      : `${activeContract.provider_first_name || ''} ${activeContract.provider_last_name || ''}`.trim() ||
                        'Prestador'}
                  </div>
                  <div className="opacity-80">{activeContract.description}</div>
                </div>

                <div>
                  <label className="block font-semibold opacity-85 mb-1.5">Puntaje (1 a 5)</label>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((starVal) => (
                      <button
                        key={starVal}
                        type="button"
                        onClick={() => setRating(starVal)}
                        className={`flex items-center gap-1 px-3 py-2 rounded-xl font-bold border transition-colors cursor-pointer ${
                          rating >= starVal
                            ? 'bg-amber-950/70 border-amber-700 text-amber-300'
                            : 'border-white/15 opacity-60'
                        }`}
                        style={rating >= starVal ? undefined : innerStyle}
                      >
                        <Star
                          size={13}
                          className={rating >= starVal ? 'fill-amber-400 text-amber-400' : ''}
                        />
                        <span>{starVal}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold opacity-85 mb-1.5">Comentario</label>
                  <textarea
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Escribí tu reseña sobre el servicio y la experiencia..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                    style={innerStyle}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-95 disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: primaryActionColor }}
                >
                  <UserCheck size={14} />
                  {submitting ? 'Enviando...' : 'Publicar Calificación'}
                </button>
              </form>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}