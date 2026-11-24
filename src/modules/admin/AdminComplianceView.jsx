/**
 * @file AdminComplianceView.jsx
 * @description Panel de control central para que el equipo de Operaciones audite
 * y apruebe/rechace el compliance de los prestadores registrados en la red,
 * con aplicación explícita de Zona 4 (tarjetas principales) y Zona 5 (cajas internas).
 * @location /trustlink-web/src/modules/admin/AdminComplianceView.jsx
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  FileText,
  UserCheck,
  AlertCircle,
  RefreshCw,
  Search,
  X,
  Award,
} from 'lucide-react';
import { useBranding, DEFAULT_BRANDING_CONFIG } from '../branding/BrandingContext';
import { API_BASE } from '../../config/api';
import {
  PAGE_SHELL_CLASS,
  SECTION_CARD_CLASS,
  ITEMS_GRID_CLASS,
  ITEM_CARD_CLASS,
  FIELD_INPUT_CLASS,
  getUnifiedStatusMeta,
} from '../../config/uiTokens';

const STATUS_PRIORITY = {
  pending: 0,
  approved: 1,
  rejected: 2,
  sin_perfil: 3,
};

/* const API_BASE = 'http://localhost:4000'; */

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
  const [updatingMembershipUserId, setUpdatingMembershipUserId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const statusCounts = useMemo(() => {
    const counts = { all: providers.length, pending: 0, approved: 0, rejected: 0, sin_perfil: 0 };
    providers.forEach((p) => {
      const st = String(p.status || 'sin_perfil').toLowerCase();
      if (st in counts) counts[st] += 1;
      else counts.sin_perfil += 1;
    });
    return counts;
  }, [providers]);

  const filteredProviders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return [...providers]
      .filter((p) => {
        const st = String(p.status || 'sin_perfil').toLowerCase();
        const matchesStatus = statusFilter === 'all' || st === statusFilter;
        const haystack = `${p.first_name || ''} ${p.last_name || ''} ${p.dni || ''} ${p.email || ''} ${p.specialty || ''}`.toLowerCase();
        const matchesQuery = !q || haystack.includes(q);
        return matchesStatus && matchesQuery;
      })
      .sort((a, b) => {
        const pa = STATUS_PRIORITY[String(a.status || 'sin_perfil').toLowerCase()] ?? 9;
        const pb = STATUS_PRIORITY[String(b.status || 'sin_perfil').toLowerCase()] ?? 9;
        return pa - pb;
      });
  }, [providers, searchTerm, statusFilter]);

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

  const handleManageMembership = async (userId, action, days = 30) => {
    setUpdatingMembershipUserId(userId);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/billing/provider/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
        body: JSON.stringify({
          action,
          plan_code: 'verified_monthly',
          days,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(data.message || 'Membresía Socio Verificado actualizada.');
        await fetchAllProviders();
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar la membresía del prestador.');
      }
    } catch (error) {
      console.error('Error al gestionar membresía:', error);
      setErrorMsg('Error de conexión al gestionar la membresía.');
    } finally {
      setUpdatingMembershipUserId(null);
    }
  };

  return (
    <div className={PAGE_SHELL_CLASS}>
      {/* Zona 4: Encabezado Compliance Prestadores */}
      <section
        className="p-5 sm:p-6 rounded-2xl border border-white/10 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
        style={cardStyle}
      >
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl border border-white/15 text-emerald-400" style={innerStyle}>
            <UserCheck size={22} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">
              Compliance Prestadores
            </h2>
            <p className="text-xs opacity-80 mt-0.5">
              Certificación y auditoría de prestadores en la red.
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
        className={SECTION_CARD_CLASS}
        style={cardStyle}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-2">
            <ShieldCheck size={17} className="text-emerald-400 shrink-0" />
            <h3 className="text-sm font-bold">Prestadores registrados</h3>
            <span className="text-xs opacity-70">({filteredProviders.length})</span>
          </div>

          <div className="relative w-full md:w-72">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60 pointer-events-none"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, DNI o rubro..."
              className={`w-full pl-9 pr-8 ${FIELD_INPUT_CLASS}`}
              style={innerStyle}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Filtros rápidos por estado (Pendientes primero) */}
        <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap pb-1">
          {[
            { id: 'all', label: 'Todos', count: statusCounts.all },
            { id: 'pending', label: 'Pendientes', count: statusCounts.pending },
            { id: 'approved', label: 'Aprobados', count: statusCounts.approved },
            { id: 'rejected', label: 'Rechazados', count: statusCounts.rejected },
            { id: 'sin_perfil', label: 'Sin perfil', count: statusCounts.sin_perfil },
          ].map((chip) => {
            const active = statusFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setStatusFilter(chip.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap border inline-flex items-center gap-1.5 ${
                  active
                    ? 'bg-emerald-600 text-white border-transparent shadow-sm'
                    : 'border-white/15 opacity-80 hover:opacity-100'
                }`}
                style={active ? undefined : innerStyle}
              >
                <span>{chip.label}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/25">
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div
            className="text-center py-10 rounded-xl border border-white/10 text-xs"
            style={innerStyle}
          >
            Cargando prestadores desde PostgreSQL...
          </div>
        ) : filteredProviders.length === 0 ? (
          <div
            className="text-center py-10 rounded-xl border border-white/10 text-xs opacity-80"
            style={innerStyle}
          >
            No hay prestadores que coincidan con el filtro seleccionado.
          </div>
        ) : (
          <div className={ITEMS_GRID_CLASS}>
            {filteredProviders.map((p) => {
              const rowKey = p.provider_id || p.user_id || p.email;
              const targetProviderId = p.provider_id;
              const currentStatus = p.status || 'sin_perfil';
              const statusMeta = getUnifiedStatusMeta(currentStatus, 'compliance');

              return (
                <div
                  key={rowKey}
                  className={ITEM_CARD_CLASS}
                  style={innerStyle}
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-bold">
                        {p.first_name} {p.last_name}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {p.is_verified_member && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-400/45 bg-amber-500/15 text-amber-200">
                            <Award size={10} /> Socio
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${statusMeta.cls}`}
                        >
                          {statusMeta.label}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span
                        className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-lg border border-white/15"
                        style={cardStyle}
                      >
                        {p.specialty || 'Sin especialidad cargada'}
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

                      {p.insurance_policy_url || p.art_insurance_url ? (
                        <a
                          href={p.insurance_policy_url || p.art_insurance_url}
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
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/10 shrink-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {p.user_id && !p.is_verified_member && (
                          <button
                            type="button"
                            onClick={() => handleManageMembership(p.user_id, 'activate', 30)}
                            disabled={updatingMembershipUserId === p.user_id}
                            className="bg-amber-600/90 hover:bg-amber-500 text-white font-bold px-2.5 py-1.5 rounded-xl text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-45"
                          >
                            <Award size={12} /> Activar Socio (30d)
                          </button>
                        )}
                        {p.user_id && p.is_verified_member && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleManageMembership(p.user_id, 'extend', 30)}
                              disabled={updatingMembershipUserId === p.user_id}
                              className="bg-amber-600/80 hover:bg-amber-500 text-white font-bold px-2.5 py-1.5 rounded-xl text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-45"
                            >
                              <Award size={12} /> +30d
                            </button>
                            <button
                              type="button"
                              onClick={() => handleManageMembership(p.user_id, 'cancel')}
                              disabled={updatingMembershipUserId === p.user_id}
                              className="border border-white/15 hover:opacity-90 font-bold px-2.5 py-1.5 rounded-xl text-[11px] inline-flex items-center gap-1 transition-opacity cursor-pointer disabled:opacity-45"
                              style={cardStyle}
                            >
                              Revocar Socio
                            </button>
                          </>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
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
                    </div>
                  ) : (
                    <div className="pt-3 border-t border-white/10">
                      <span className="text-[11px] opacity-75 italic">
                        Aún no completó perfil de compliance
                      </span>
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