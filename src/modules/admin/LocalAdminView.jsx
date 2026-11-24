/**
 * @file LocalAdminView.jsx
 * @description Consola operativa para el rol 'admin' (administrador local de barrio/comunidad)
 * y supervisión de superadmin, con aplicación explícita de Zona 4 (tarjetas principales)
 * y Zona 5 (cajas/bloques internos e inputs) sin pisar el fondo de Zona 3.
 * @location /trustlink-web/src/modules/admin/LocalAdminView.jsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Building2,
  Plus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Unlock,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useBranding, DEFAULT_BRANDING_CONFIG } from '../branding/BrandingContext';
import { API_BASE } from '../../config/api'; // Ajustá la cantidad de ../ según la carpeta del archivo

/* const API_BASE = 'http://localhost:4000'; */

export default function LocalAdminView() {
  const { user } = useAuth();
  const { brand } = useBranding();
  const isSuperadmin = user?.role === 'superadmin';

  const cardStyle = {
    backgroundColor: brand.cardBgColor || DEFAULT_BRANDING_CONFIG.cardBgColor,
    color: brand.cardTextColor || DEFAULT_BRANDING_CONFIG.cardTextColor,
  };

  const innerStyle = {
    backgroundColor: brand.innerBgColor || DEFAULT_BRANDING_CONFIG.innerBgColor,
    color: brand.innerTextColor || DEFAULT_BRANDING_CONFIG.innerTextColor,
  };

  const [countries, setCountries] = useState([]);
  const [providers, setProviders] = useState([]);
  const [suspensions, setSuspensions] = useState([]);
  const [selectedCountryId, setSelectedCountryId] = useState(
    user?.country_id ? String(user.country_id) : '1'
  );
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [liftingId, setLiftingId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
  });

  const fetchLocalData = useCallback(
    async (countryFilter) => {
      setLoading(true);
      try {
        const query = isSuperadmin && countryFilter ? `?country_id=${countryFilter}` : '';
        const res = await fetch(`${API_BASE}/api/v1/providers/local-suspensions${query}`, {
          headers: getAuthHeaders(),
        });
        const data = await res.json();
        if (res.ok) {
          const loadedCountries = data.countries || [];
          const loadedProviders = data.providers || [];
          setCountries(loadedCountries);
          setProviders(loadedProviders);
          setSuspensions(data.suspensions || []);

          if (data.effective_country_id) {
            setSelectedCountryId(String(data.effective_country_id));
          } else if (loadedCountries.length > 0) {
            setSelectedCountryId((prev) => prev || String(loadedCountries[0].id));
          }

          if (loadedProviders.length > 0) {
            setSelectedProviderId((prev) => prev || String(loadedProviders[0].provider_id));
          }
        }
      } catch (error) {
        console.error('Error al cargar reportes locales:', error);
      } finally {
        setLoading(false);
      }
    },
    [isSuperadmin]
  );

  useEffect(() => {
    fetchLocalData(user?.country_id ? String(user.country_id) : '1');
  }, [fetchLocalData, user?.country_id]);

  const handleCreateSuspension = async (e) => {
    e.preventDefault();
    if (!selectedProviderId || !reason.trim()) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/providers/local-suspensions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          country_id: Number(selectedCountryId || 1),
          provider_id: Number(selectedProviderId),
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: 'success',
          message: data.message || 'Reporte o suspensión local registrado.',
        });
        setReason('');
        await fetchLocalData(selectedCountryId);
      } else {
        setFeedback({
          type: 'error',
          message: data.error || 'No se pudo registrar el reporte local.',
        });
      }
    } catch (error) {
      console.error('Error al crear suspensión local:', error);
      setFeedback({
        type: 'error',
        message: 'Error de conexión con el backend.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLiftSuspension = async (id) => {
    setLiftingId(id);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/providers/local-suspensions/${id}/lift`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: 'success',
          message: data.message || 'Suspensión local levantada.',
        });
        await fetchLocalData(selectedCountryId);
      } else {
        setFeedback({
          type: 'error',
          message: data.error || 'No se pudo levantar la suspensión.',
        });
      }
    } catch (error) {
      console.error('Error al levantar suspensión:', error);
      setFeedback({
        type: 'error',
        message: 'Error de conexión.',
      });
    } finally {
      setLiftingId(null);
    }
  };

  return (
    <div className="max-w-6xl w-full mx-auto px-4 md:px-8 py-6 space-y-6 font-sans">
      {/* Zona 4: Encabezado Vista Admin Barrio */}
      <section
        className="border border-black/20 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        style={cardStyle}
      >
        <div className="flex items-center gap-3">
          <div className="p-3 text-amber-400 rounded-xl border border-white/15" style={innerStyle}>
            <ShieldAlert size={22} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Vista Admin Barrio</h2>
            <p className="text-xs opacity-80 mt-0.5">
              Reportes y suspensiones locales dentro de la comunidad.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchLocalData(selectedCountryId)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-white/15 cursor-pointer hover:opacity-90"
          style={innerStyle}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </section>

      {feedback && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs border ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/60 border-rose-800 text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Zona 4: Formulario de reporte / suspensión local */}
      <section
        className="border border-black/20 p-6 rounded-2xl space-y-4"
        style={cardStyle}
      >
        <div className="flex items-center gap-2">
          <Building2 size={17} className="text-sky-400" />
          <h3 className="text-sm font-bold">Registrar reporte o suspensión local</h3>
        </div>

        <form onSubmit={handleCreateSuspension} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {isSuperadmin && (
            <div className="md:col-span-3">
              <select
                value={selectedCountryId}
                onChange={(e) => {
                  const nextCountry = e.target.value;
                  setSelectedCountryId(nextCountry);
                  fetchLocalData(nextCountry);
                }}
                className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                style={innerStyle}
              >
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.id} · {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={isSuperadmin ? 'md:col-span-3' : 'md:col-span-4'}>
            <select
              value={selectedProviderId}
              onChange={(e) => setSelectedProviderId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
              style={innerStyle}
            >
              {providers.map((p) => (
                <option key={p.provider_id} value={p.provider_id}>
                  {p.first_name} {p.last_name} ({p.specialty || 'Prestador'})
                </option>
              ))}
            </select>
          </div>

          <div className={isSuperadmin ? 'md:col-span-4' : 'md:col-span-6'}>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo operativo local (ej: Incumplimiento normativo de obra)"
              className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
              style={innerStyle}
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting || !selectedProviderId || !reason.trim()}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50 cursor-pointer"
            >
              <Plus size={14} />
              {submitting ? 'Guardando...' : 'Suspender'}
            </button>
          </div>
        </form>
      </section>

      {/* Zona 4: Listado de suspensiones locales */}
      <section
        className="border border-black/20 p-6 rounded-2xl space-y-4"
        style={cardStyle}
      >
        <h3 className="text-sm font-bold">
          Historial de reportes y suspensiones locales ({suspensions.length})
        </h3>

        {loading ? (
          <div
            className="text-center py-6 rounded-xl border border-black/20 text-xs"
            style={innerStyle}
          >
            Cargando registros...
          </div>
        ) : suspensions.length === 0 ? (
          <div
            className="text-center py-6 rounded-xl border border-black/20 text-xs opacity-80"
            style={innerStyle}
          >
            No hay suspensiones ni reportes locales registrados para esta comunidad.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-black/20" style={innerStyle}>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-black/20 opacity-80">
                  <th className="py-2.5 px-3 font-semibold">ID</th>
                  <th className="py-2.5 px-3 font-semibold">Comunidad</th>
                  <th className="py-2.5 px-3 font-semibold">Prestador</th>
                  <th className="py-2.5 px-3 font-semibold">Motivo local</th>
                  <th className="py-2.5 px-3 font-semibold">Estado</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/15">
                {suspensions.map((item) => (
                  <tr key={item.id} className="hover:bg-black/10">
                    <td className="py-2.5 px-3 font-mono">#{item.id}</td>
                    <td className="py-2.5 px-3 font-semibold">
                      {item.country_name || `Barrio #${item.country_id}`}
                    </td>
                    <td className="py-2.5 px-3">
                      {`${item.provider_first_name || ''} ${item.provider_last_name || ''}`.trim() ||
                        `Prestador #${item.provider_id}`}{' '}
                      <span className="opacity-75">({item.specialty || 'Prestador'})</span>
                    </td>
                    <td className="py-2.5 px-3">{item.reason}</td>
                    <td className="py-2.5 px-3">
                      {item.status === 'active' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950/80 text-amber-300 border border-amber-700">
                          suspendido local
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-700">
                          levantada
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {item.status === 'active' ? (
                        <button
                          type="button"
                          onClick={() => handleLiftSuspension(item.id)}
                          disabled={liftingId === item.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-white/15 text-emerald-300 cursor-pointer"
                          style={cardStyle}
                        >
                          <Unlock size={12} />
                          <span>{liftingId === item.id ? 'Levantando...' : 'Levantar'}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] opacity-60">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}