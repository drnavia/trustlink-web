/**
 * @file AccountView.jsx
 * @description Vista "Mi Cuenta / Identidad Dual" conectada a /api/v1/account/me,
 * /api/v1/account/profile y /api/v1/account/primary-portal.
 * Permite editar datos personales, normalizar la ubicación residencial (Manzana/Fracción/N/A y Lote),
 * activar capacidades duales (Residente + Prestador) y elegir el Portal Principal de ingreso.
 * @location /trustlink-web/src/modules/auth/AccountView.jsx
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  User,
  Home,
  Wrench,
  MapPin,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Save,
  Star,
  ArrowRight,
  Building2,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { useBranding } from '../branding/BrandingContext';
import { API_BASE } from '../../config/api';

function formatDestinationPreview(fractionType, fractionNumber, lotNumber) {
  const cleanLot = String(lotNumber || '').trim();
  const cleanFrac = String(fractionNumber || '').trim();
  const type = String(fractionType || 'na').toLowerCase();

  const areaPart =
    type === 'manzana' && cleanFrac
      ? `Manzana ${cleanFrac}`
      : type === 'fraccion' && cleanFrac
      ? `Fracción ${cleanFrac}`
      : 'N/A';

  if (!cleanLot) {
    return 'Sin Lote registrado (requerido para emitir pases QR)';
  }
  return areaPart === 'N/A' ? `Lote ${cleanLot}` : `${areaPart} · Lote ${cleanLot}`;
}

export default function AccountView({ onNavigate }) {
  const { user, updateUser } = useAuth();
  const { brand } = useBranding();

  const locationSectionRef = useRef(null);

  const primaryColor = brand?.primaryActionColor || brand?.accentColor || '#059669';
  const cardStyle = {
    backgroundColor: brand?.cardBgColor || '#020617',
    color: brand?.cardTextColor || '#F1F5F9',
  };
  const innerStyle = {
    backgroundColor: brand?.innerBgColor || '#0F172A',
    color: brand?.innerTextColor || '#E2E8F0',
  };

  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState(null);
  const [countries, setCountries] = useState([]);

  // Formulario de perfil y ubicación
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [countryId, setCountryId] = useState('');
  const [fractionType, setFractionType] = useState('na');
  const [fractionNumber, setFractionNumber] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [canUseResident, setCanUseResident] = useState(true);
  const [canUseProvider, setCanUseProvider] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [switchingPortal, setSwitchingPortal] = useState('');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
  });

  const hydrateForm = useCallback((acc) => {
    if (!acc) return;
    setAccount(acc);
    setFirstName(acc.first_name || '');
    setLastName(acc.last_name || '');
    setPhone(acc.phone || '');
    setCountryId(acc.country_id ? String(acc.country_id) : '');
    setFractionType(acc.fraction_type || 'na');
    setFractionNumber(acc.fraction_number ? String(acc.fraction_number).replace(/\D+/g, '') : '');
    setLotNumber(acc.lot_number ? String(acc.lot_number).replace(/\D+/g, '') : '');
    setCanUseResident(Boolean(acc.can_use_resident));
    setCanUseProvider(Boolean(acc.can_use_provider));
  }, []);

  const fetchAccount = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/account/me`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.account) {
        hydrateForm(data.account);
        setCountries(data.countries || []);
        updateUser(data.account);
      } else {
        setFeedback({
          type: 'error',
          text: data.error || 'No se pudieron cargar los datos de tu cuenta.',
        });
      }
    } catch (err) {
      console.error('Error al cargar Mi Cuenta:', err);
      setFeedback({
        type: 'error',
        text: 'Error de conexión con el servidor al consultar tu cuenta.',
      });
    } finally {
      setLoading(false);
    }
  }, [hydrateForm, updateUser]);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setFeedback({ type: '', text: '' });

    try {
      const payload = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        country_id: countryId ? Number(countryId) : '',
        fraction_type: fractionType,
        fraction_number: fractionType === 'na' ? null : fractionNumber.trim(),
        lot_number: lotNumber.trim() || null,
        activate_resident_portal: canUseResident,
        activate_provider_portal: canUseProvider,
      };

      const res = await fetch(`${API_BASE}/api/v1/account/profile`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.account) {
        hydrateForm(data.account);
        updateUser(data.account, data.token || null);
        setFeedback({
          type: 'success',
          text: data.message || 'Perfil, rol por defecto y ubicación actualizados correctamente.',
        });
      } else {
        setFeedback({
          type: 'error',
          text: data.error || 'No se pudieron guardar los cambios.',
        });
      }
    } catch (err) {
      console.error('Error al actualizar perfil:', err);
      setFeedback({
        type: 'error',
        text: 'Error de conexión al guardar los datos de tu cuenta.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSetPrimaryPortal = async (targetPortal) => {
    setSwitchingPortal(targetPortal);
    setFeedback({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE}/api/v1/account/primary-portal`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ primary_portal: targetPortal }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.account) {
        const merged = { ...(account || {}), ...data.account };
        hydrateForm(merged);
        updateUser(merged, data.token || null);
        setFeedback({
          type: 'success',
          text: data.message || 'Rol y portal principal actualizado correctamente.',
        });
      } else {
        setFeedback({
          type: 'error',
          text: data.error || 'No se pudo cambiar el portal principal.',
        });
        if (targetPortal === 'resident' && locationSectionRef.current) {
          locationSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    } catch (err) {
      console.error('Error al cambiar portal principal:', err);
      setFeedback({
        type: 'error',
        text: 'Error de conexión al actualizar el portal principal.',
      });
    } finally {
      setSwitchingPortal('');
    }
  };

  const handleQuickTogglePortal = async (portalKey) => {
    if (portalKey === 'resident' && !canUseResident && !lotNumber.trim()) {
      setCanUseResident(true);
      setFeedback({
        type: 'error',
        text: 'Ingresá tu número de Lote abajo y presioná "Guardar Cambios" para activar el Portal Residente.',
      });
      if (locationSectionRef.current) {
        locationSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const nextResident = portalKey === 'resident' ? !canUseResident : canUseResident;
    const nextProvider = portalKey === 'provider' ? !canUseProvider : canUseProvider;

    if (!nextResident && !nextProvider) {
      setFeedback({
        type: 'error',
        text: 'Tu cuenta debe mantener al menos un portal operativo habilitado.',
      });
      return;
    }

    setSavingProfile(true);
    setFeedback({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE}/api/v1/account/profile`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          activate_resident_portal: nextResident,
          activate_provider_portal: nextProvider,
          fraction_type: fractionType,
          fraction_number: fractionType === 'na' ? null : fractionNumber.trim(),
          lot_number: lotNumber.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.account) {
        hydrateForm(data.account);
        updateUser(data.account, data.token || null);
        setFeedback({
          type: 'success',
          text:
            portalKey === 'provider'
              ? nextProvider
                ? 'Portal Prestador habilitado. Ya podés acceder desde la barra superior.'
                : 'Portal Prestador desactivado: tu cuenta opera ahora solo como Residente y dejás de figurar en el directorio sin perder tu historial.'
              : nextResident
              ? 'Portal Residente habilitado. Ya podés coordinar visitas y emitir pases QR.'
              : 'Portal Residente desactivado: tu cuenta opera ahora solo como Prestador.',
        });
      } else {
        setFeedback({
          type: 'error',
          text: data.error || 'No se pudo actualizar la capacidad del portal.',
        });
      }
    } catch (err) {
      console.error('Error al alternar portal:', err);
      setFeedback({ type: 'error', text: 'Error de conexión al actualizar portales.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const activePrimary = account?.primary_portal || user?.primary_portal || 'resident';
  const baseRole = (account?.role || user?.role || '').toLowerCase();
  const isPrivilegedRole = ['superadmin', 'admin', 'security'].includes(baseRole);
  const isDualActive = canUseResident && canUseProvider;
  const accountModeBadge = isDualActive
    ? 'Identidad Dual Activa'
    : canUseProvider && !canUseResident
    ? 'Solo Prestador'
    : 'Solo Residente';
  const defaultRoleLabel = isPrivilegedRole
    ? baseRole.toUpperCase()
    : activePrimary === 'provider'
    ? 'Prestador'
    : 'Residente';
  const destinationPreview = formatDestinationPreview(fractionType, fractionNumber, lotNumber);

  return (
    <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 md:py-8 space-y-6">
      {/* Encabezado de Cuenta */}
      <section
        className="rounded-2xl p-5 sm:p-6 border border-slate-800/80 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        style={cardStyle}
      >
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className="w-12 h-12 rounded-2xl border border-white/15 flex items-center justify-center text-emerald-400 shrink-0"
            style={innerStyle}
          >
            <User size={22} />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black tracking-tight">Mi Cuenta &amp; Identidad Dual</h1>
              <span
                className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                  isDualActive
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                }`}
              >
                {accountModeBadge}
              </span>
            </div>
            <p className="text-xs opacity-80 truncate">
              {account?.email || user?.email || '—'} · DNI: {account?.dni || '—'} · Rol por defecto:{' '}
              <span className="font-mono font-bold uppercase">{defaultRoleLabel}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchAccount}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-white/15 hover:opacity-90 cursor-pointer disabled:opacity-50 self-start sm:self-auto shrink-0"
          style={innerStyle}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </section>

      {feedback.text && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs border ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/60 border-rose-800 text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {loading && !account ? (
        <div
          className="rounded-2xl p-10 text-center text-xs opacity-80 border border-slate-800/80"
          style={cardStyle}
        >
          Cargando configuración de tu cuenta...
        </div>
      ) : (
        <>
          {/* Bloque 1: Portales Habilitados y Portal Principal */}
          <section
            className="rounded-2xl p-5 sm:p-6 border border-slate-800/80 shadow-md space-y-4"
            style={cardStyle}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-black/20 pb-3.5">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <ShieldCheck size={17} className="text-emerald-400 shrink-0" />
                  <span>Portales Habilitados y Portal Principal</span>
                </h2>
                <p className="text-xs opacity-75 mt-0.5">
                  Activá ambos portales si operás como residente y también ofrecés servicios en la red, y elegí con cuál iniciar sesión.
                </p>
              </div>
              <span
                className="text-[11px] font-semibold px-3 py-1 rounded-full border border-white/15 self-start sm:self-center shrink-0"
                style={innerStyle}
              >
                Principal: {activePrimary === 'provider' ? 'Prestador' : 'Residente'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tarjeta Portal Residente */}
              <div
                className={`rounded-xl p-4 border space-y-3 transition-all ${
                  activePrimary === 'resident'
                    ? 'border-emerald-500/60 ring-1 ring-emerald-500/30'
                    : 'border-slate-800/80'
                }`}
                style={innerStyle}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="p-2.5 rounded-xl border border-white/15 text-emerald-400"
                      style={cardStyle}
                    >
                      <Home size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">Portal Residente</h3>
                      <p className="text-[11px] opacity-75">
                        Directorio, visitas, pases QR, pagos y reseñas.
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border shrink-0 ${
                      canUseResident
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700'
                    }`}
                  >
                    {canUseResident ? 'Habilitado' : 'Inactivo'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={savingProfile || (canUseResident && !canUseProvider && !isPrivilegedRole)}
                    onClick={() => handleQuickTogglePortal('resident')}
                    title={
                      canUseResident && !canUseProvider && !isPrivilegedRole
                        ? 'Activá Portal Prestador primero si querés dejar de usar Portal Residente.'
                        : undefined
                    }
                    className="px-3 py-1.5 rounded-xl text-xs font-bold border border-white/15 cursor-pointer hover:opacity-90 disabled:opacity-45 disabled:cursor-not-allowed"
                    style={cardStyle}
                  >
                    {canUseResident ? 'Desactivar' : 'Activar Portal Residente'}
                  </button>

                  {canUseResident && (
                    <>
                      <button
                        type="button"
                        disabled={activePrimary === 'resident' || switchingPortal === 'resident'}
                        onClick={() => handleSetPrimaryPortal('resident')}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-60 ${
                          activePrimary === 'resident'
                            ? 'bg-emerald-600 text-white'
                            : 'border border-emerald-500/40 text-emerald-300'
                        }`}
                        style={activePrimary === 'resident' ? undefined : cardStyle}
                      >
                        <Star
                          size={12}
                          className={activePrimary === 'resident' ? 'fill-white' : ''}
                        />
                        {activePrimary === 'resident'
                          ? 'Portal Principal'
                          : switchingPortal === 'resident'
                          ? 'Guardando...'
                          : 'Definir Principal'}
                      </button>

                      {onNavigate && (
                        <button
                          type="button"
                          onClick={() => onNavigate('resident')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer hover:opacity-95 ml-auto"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <span>Abrir</span>
                          <ArrowRight size={12} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Tarjeta Portal Prestador */}
              <div
                className={`rounded-xl p-4 border space-y-3 transition-all ${
                  activePrimary === 'provider'
                    ? 'border-emerald-500/60 ring-1 ring-emerald-500/30'
                    : 'border-slate-800/80'
                }`}
                style={innerStyle}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="p-2.5 rounded-xl border border-white/15 text-sky-400"
                      style={cardStyle}
                    >
                      <Wrench size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">Portal Prestador</h3>
                      <p className="text-[11px] opacity-75">
                        Compliance, flota, agenda online, visitas y QR asignados.
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border shrink-0 ${
                      canUseProvider
                        ? 'bg-sky-950/80 text-sky-300 border-sky-700/60'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700'
                    }`}
                  >
                    {canUseProvider ? 'Habilitado' : 'Inactivo'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={savingProfile || (canUseProvider && !canUseResident && !isPrivilegedRole)}
                    onClick={() => handleQuickTogglePortal('provider')}
                    title={
                      canUseProvider && !canUseResident && !isPrivilegedRole
                        ? 'Activá Portal Residente primero si querés dejar de ofrecer servicios como Prestador.'
                        : undefined
                    }
                    className="px-3 py-1.5 rounded-xl text-xs font-bold border border-white/15 cursor-pointer hover:opacity-90 disabled:opacity-45 disabled:cursor-not-allowed"
                    style={cardStyle}
                  >
                    {canUseProvider ? 'Desactivar' : 'Activar Portal Prestador'}
                  </button>

                  {canUseProvider && (
                    <>
                      <button
                        type="button"
                        disabled={activePrimary === 'provider' || switchingPortal === 'provider'}
                        onClick={() => handleSetPrimaryPortal('provider')}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-60 ${
                          activePrimary === 'provider'
                            ? 'bg-emerald-600 text-white'
                            : 'border border-emerald-500/40 text-emerald-300'
                        }`}
                        style={activePrimary === 'provider' ? undefined : cardStyle}
                      >
                        <Star
                          size={12}
                          className={activePrimary === 'provider' ? 'fill-white' : ''}
                        />
                        {activePrimary === 'provider'
                          ? 'Portal Principal'
                          : switchingPortal === 'provider'
                          ? 'Guardando...'
                          : 'Definir Principal'}
                      </button>

                      {onNavigate && (
                        <button
                          type="button"
                          onClick={() => onNavigate('provider')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer hover:opacity-95 ml-auto"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <span>Abrir</span>
                          <ArrowRight size={12} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Bloque 2: Datos Personales y Ubicación Residencial Normalizada */}
          <form
            ref={locationSectionRef}
            onSubmit={handleSaveProfile}
            className="rounded-2xl p-5 sm:p-6 border border-slate-800/80 shadow-md space-y-5 text-xs"
            style={cardStyle}
          >
            <div className="border-b border-black/20 pb-3.5">
              <h2 className="text-base font-bold flex items-center gap-2">
                <MapPin size={17} className="text-emerald-400 shrink-0" />
                <span>Datos Personales y Ubicación Residencial</span>
              </h2>
              <p className="text-xs opacity-75 mt-0.5">
                Tu Manzana/Fracción y Lote registrados se aplican automáticamente (y bloqueados) en cada solicitud de visita y Pase QR.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1.5">
                  Nombre
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                  style={innerStyle}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1.5">
                  Apellido
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                  style={innerStyle}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1.5">
                  Teléfono
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+54 9 11 ..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                  style={innerStyle}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1.5 flex items-center gap-1">
                  <Building2 size={12} /> Comunidad / Barrio
                </label>
                <select
                  value={countryId}
                  onChange={(e) => setCountryId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                  style={innerStyle}
                >
                  <option value="">Sin comunidad asignada</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sub-bloque de ubicación normalizada */}
            <div
              className="rounded-xl p-4 border border-black/20 space-y-3"
              style={innerStyle}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span className="font-bold text-xs">Ubicación Residencial Normalizada</span>
                <span
                  className="text-[11px] font-mono px-2.5 py-1 rounded-lg border border-white/15"
                  style={cardStyle}
                >
                  Destino QR: {destinationPreview}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold opacity-80 mb-1">
                    Tipo de Área
                  </label>
                  <select
                    value={fractionType}
                    onChange={(e) => {
                      const next = e.target.value;
                      setFractionType(next);
                      if (next === 'na') setFractionNumber('');
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                    style={cardStyle}
                  >
                    <option value="na">No aplica (N/A)</option>
                    <option value="manzana">Manzana</option>
                    <option value="fraccion">Fracción</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold opacity-80 mb-1">
                    Número de {fractionType === 'manzana' ? 'Manzana' : 'Fracción'}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    disabled={fractionType === 'na'}
                    required={fractionType !== 'na'}
                    value={fractionNumber}
                    onChange={(e) => setFractionNumber(e.target.value.replace(/\D+/g, ''))}
                    placeholder={fractionType === 'na' ? 'N/A' : 'Solo números (ej: 4)'}
                    className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs font-mono focus:outline-none disabled:opacity-45"
                    style={cardStyle}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold opacity-80 mb-1">
                    Número de Lote {canUseResident ? '*' : '(opcional)'}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required={canUseResident}
                    value={lotNumber}
                    onChange={(e) => setLotNumber(e.target.value.replace(/\D+/g, ''))}
                    placeholder="Solo números (ej: 18)"
                    className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs font-mono focus:outline-none"
                    style={cardStyle}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer hover:opacity-95 disabled:opacity-50"
                style={{ backgroundColor: primaryColor }}
              >
                {savingProfile ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    Guardar Cambios
                  </>
                )}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
