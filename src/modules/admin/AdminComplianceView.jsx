/**
 * @file AdminComplianceView.jsx
 * @description Consola de operaciones centrales (Ops TrustLink) para auditar y aprobar/rechazar
 * la documentación de compliance de los prestadores con estética minimalista.
 * @location /trustlink-web/src/modules/admin/AdminComplianceView.jsx
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  FileText,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';

const API_BASE = 'http://localhost:4000';

export default function AdminComplianceView() {
  const { brand } = useBranding();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`
  });

  const fetchProviders = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/all`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (response.ok) {
        setProviders(data.providers || []);
      } else {
        setErrorMsg(data.error || 'No se pudo cargar la lista de prestadores.');
      }
    } catch (error) {
      console.error('Error al obtener prestadores:', error);
      setErrorMsg('Error de conexión con el servidor backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleUpdateStatus = async (providerId, nextStatus) => {
    setUpdatingId(providerId);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/compliance`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          provider_id: providerId,
          status: nextStatus
        })
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(data.message || `Estado actualizado a ${nextStatus}.`);
        await fetchProviders();
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar el estado.');
      }
    } catch (error) {
      console.error('Error al actualizar compliance:', error);
      setErrorMsg('Error de conexión al actualizar el estado.');
    } finally {
      setUpdatingId(null);
    }
  };

  const renderStatusBadge = (status) => {
    const normalized = String(status || 'pending').toLowerCase();
    if (normalized === 'approved') {
      return (
        <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-950/80 text-emerald-300 border border-emerald-800 px-2.5 py-0.5 rounded-full">
          APPROVED
        </span>
      );
    }
    if (normalized === 'rejected') {
      return (
        <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-950/80 text-rose-300 border border-rose-800 px-2.5 py-0.5 rounded-full">
          REJECTED
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-950/80 text-amber-300 border border-amber-800 px-2.5 py-0.5 rounded-full">
        PENDING
      </span>
    );
  };

  return (
    <div className="flex-1 bg-slate-900 text-slate-100 font-sans p-6 md:p-8">
      <main className="max-w-6xl mx-auto space-y-6">
        {/* Cabecera minimalista */}
        <div className="bg-slate-950 border border-slate-800 p-5 md:p-6 rounded-2xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black tracking-tight text-white">
                Ops TrustLink
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Certificación y compliance de prestadores en la red.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-slate-900 text-slate-300 border border-slate-800 px-3 py-1.5 rounded-xl">
              {providers.length} prestadores
            </span>
            <button
              type="button"
              onClick={fetchProviders}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Actualizar
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 bg-rose-950/60 border border-rose-800/80 text-rose-200 p-4 rounded-xl text-xs">
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 p-4 rounded-xl text-xs">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="bg-slate-950 border border-slate-800 p-5 md:p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <ShieldAlert size={15} />
              <span>Prestadores registrados</span>
            </div>
            <span className="text-xs text-slate-400">{providers.length} registros</span>
          </div>

          {loading ? (
            <div className="text-center py-8 text-xs text-slate-400">
              Cargando prestadores...
            </div>
          ) : providers.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              No hay prestadores registrados.
            </div>
          ) : (
            <div className="space-y-3">
              {providers.map((p) => {
                const isBusy = updatingId === p.provider_id;
                return (
                  <div
                    key={p.provider_id}
                    className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 transition-all"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-white">
                          {p.first_name} {p.last_name}
                        </span>
                        <span className="text-[11px] font-semibold bg-blue-950/80 text-blue-300 border border-blue-800 px-2.5 py-0.5 rounded-md">
                          {p.specialty || 'Sin especialidad'}
                        </span>
                        {renderStatusBadge(p.status)}
                      </div>

                      <p className="text-xs text-slate-400 font-mono">
                        DNI: <strong className="text-slate-200">{p.dni || '-'}</strong> | Email:{' '}
                        <span className="text-slate-300">{p.email}</span>
                      </p>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {p.criminal_record_url ? (
                          <a
                            href={p.criminal_record_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs bg-slate-950 hover:bg-slate-800 text-emerald-300 border border-slate-800 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <FileText size={13} /> Ver Antecedentes Penales
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs bg-slate-950 text-slate-500 border border-slate-800/80 px-3 py-1.5 rounded-lg">
                            <FileText size={13} /> Sin Antecedentes Cargados
                          </span>
                        )}

                        {p.insurance_policy_url ? (
                          <a
                            href={p.insurance_policy_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs bg-slate-950 hover:bg-slate-800 text-emerald-300 border border-slate-800 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <FileText size={13} /> Ver Póliza ART / Seguro
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs bg-slate-950 text-slate-500 border border-slate-800/80 px-3 py-1.5 rounded-lg">
                            <FileText size={13} /> Sin Póliza Cargada
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end lg:self-center">
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(p.provider_id, 'approved')}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow transition-all disabled:opacity-50 cursor-pointer"
                        style={{ backgroundColor: brand.primaryColor || '#059669' }}
                      >
                        <CheckCircle2 size={14} /> Certificar / Aprobar
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(p.provider_id, 'rejected')}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <XCircle size={14} /> Rechazar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}