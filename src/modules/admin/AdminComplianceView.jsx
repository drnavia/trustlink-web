/**
 * @file AdminComplianceView.jsx
 * @description Panel de control central para que el equipo de Operaciones de TrustLink
 * audite y apruebe/rechace el compliance de los prestadores registrados en la red,
 * con aplicación explícita de Zona 4 (tarjetas principales) y Zona 5 (cajas internas).
 * @location /trustlink-web/src/modules/admin/AdminComplianceView.jsx
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  FileText,
  UserCheck,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useBranding, DEFAULT_BRANDING_CONFIG } from '../branding/BrandingContext';

const API_BASE = 'http://localhost:4000';

export default function AdminComplianceView() {
  const { brand } = useBranding();

  const cardStyle = {
    backgroundColor: brand.cardBgColor || DEFAULT_BRANDING_CONFIG.cardBgColor,
    color: brand.cardTextColor || DEFAULT_BRANDING_CONFIG.cardTextColor,
  };

  const innerStyle = {
    backgroundColor: brand.innerBgColor || DEFAULT_BRANDING_CONFIG.innerBgColor,
    color: brand.innerTextColor || DEFAULT_BRANDING_CONFIG.innerTextColor,
  };

  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchAllProviders = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/all`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setProviders(data.providers || []);
      } else {
        setErrorMsg(data.error || 'No se pudo cargar el listado de prestadores.');
      }
    } catch (error) {
      console.error('Error al consultar prestadores:', error);
      setErrorMsg('Error de conexión con el servidor backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllProviders();
  }, []);

  const handleUpdateStatus = async (providerId, newStatus) => {
    setUpdatingId(providerId);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/compliance`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
        body: JSON.stringify({
          provider_id: providerId,
          status: newStatus,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(`Estado de compliance actualizado a "${newStatus}".`);
        await fetchAllProviders();
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar el estado de compliance.');
      }
    } catch (error) {
      console.error('Error al actualizar compliance:', error);
      setErrorMsg('Error de conexión al actualizar el estado.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="max-w-6xl w-full mx-auto px-4 md:px-8 py-6 space-y-6">
      {/* Zona 4: Encabezado Ops TrustLink */}
      <section
        className="p-6 rounded-2xl border border-black/20 flex flex-col md:flex-row md:items-center justify-between gap-4"
        style={cardStyle}
      >
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl border border-white/15 text-emerald-400" style={innerStyle}>
            <UserCheck size={22} />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">Ops TrustLink</h2>
            <p className="text-xs opacity-80 mt-0.5">
              Certificación y compliance de prestadores en la red.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <span
            className="text-xs font-bold px-3.5 py-2 rounded-xl border border-white/15"
            style={innerStyle}
          >
            {providers.length} prestador(es)
          </span>
          <button
            type="button"
            onClick={fetchAllProviders}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-white/15 cursor-pointer transition-opacity hover:opacity-90"
            style={innerStyle}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </section>

      {errorMsg && (
        <div className="bg-rose-950/60 border border-rose-800 text-rose-200 p-4 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-950/60 border border-emerald-800 text-emerald-200 p-4 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Zona 4: Listado de Prestadores */}
      <section
        className="p-6 rounded-2xl border border-black/20 space-y-4"
        style={cardStyle}
      >
        <div className="flex items-center justify-between border-b border-black/20 pb-3.5">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <ShieldCheck size={17} className="text-emerald-400" /> Prestadores registrados
          </h3>
          <span className="text-xs opacity-80">{providers.length} registro(s)</span>
        </div>

        {loading ? (
          <div
            className="text-center py-10 rounded-xl border border-black/20 text-xs"
            style={innerStyle}
          >
            Cargando prestadores desde PostgreSQL...
          </div>
        ) : providers.length === 0 ? (
          <div
            className="text-center py-10 rounded-xl border border-black/20 text-xs opacity-80"
            style={innerStyle}
          >
            No hay prestadores registrados en la red todavía.
          </div>
        ) : (
          <div className="space-y-3.5">
            {providers.map((p) => {
              const rowKey = p.provider_id || p.user_id || p.email;
              const targetProviderId = p.provider_id;
              const currentStatus = p.status || 'sin_perfil';

              return (
                <div
                  key={rowKey}
                  className="p-4 rounded-xl border border-black/20 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs"
                  style={innerStyle}
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold">
                        {p.first_name} {p.last_name}
                      </span>
                      <span
                        className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg border border-white/15"
                        style={cardStyle}
                      >
                        {p.specialty || 'Sin especialidad cargada'}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                          currentStatus === 'approved'
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                            : currentStatus === 'rejected'
                            ? 'bg-rose-950/80 text-rose-300 border-rose-700'
                            : 'bg-amber-950/80 text-amber-300 border-amber-700'
                        }`}
                      >
                        {currentStatus}
                      </span>
                    </div>

                    <p className="opacity-80">
                      DNI: <strong className="font-mono">{p.dni || '-'}</strong> · Email:{' '}
                      <span>{p.email}</span>
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {p.criminal_record_url ? (
                        <a
                          href={p.criminal_record_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/15 font-semibold hover:opacity-90"
                          style={cardStyle}
                        >
                          <FileText size={12} className="text-sky-400" /> Ver Antecedentes
                        </a>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/15 opacity-75"
                          style={cardStyle}
                        >
                          <FileText size={12} /> Sin Antecedentes
                        </span>
                      )}

                      {p.art_insurance_url ? (
                        <a
                          href={p.art_insurance_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/15 font-semibold hover:opacity-90"
                          style={cardStyle}
                        >
                          <FileText size={12} className="text-emerald-400" /> Ver Póliza ART
                        </a>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/15 opacity-75"
                          style={cardStyle}
                        >
                          <FileText size={12} /> Sin Póliza ART
                        </span>
                      )}
                    </div>
                  </div>

                  {targetProviderId ? (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(targetProviderId, 'approved')}
                        disabled={updatingId === targetProviderId || currentStatus === 'approved'}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-45"
                      >
                        <CheckCircle2 size={14} /> Aprobar
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(targetProviderId, 'rejected')}
                        disabled={updatingId === targetProviderId || currentStatus === 'rejected'}
                        className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-45"
                      >
                        <XCircle size={14} /> Rechazar
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] opacity-75 italic">
                      Aún no completó perfil de compliance
                    </span>
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