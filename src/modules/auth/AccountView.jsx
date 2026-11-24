/**
 * @file AccountView.jsx
 * @description Vista "Mi Cuenta & Identidad Dual" conectada a /api/v1/account/me,
 * /api/v1/account/profile, /api/v1/account/primary-portal y /api/v1/account/password.
 * Aplica divulgación progresiva para Ubicación Residencial, switches accesibles para portales,
 * jerarquía clara de acciones (1 CTA primario por tarjeta), detección de cambios sin guardar
 * y sección de Identidad Verificada + cambio de contraseña.
 * @location /trustlink-web/src/modules/auth/AccountView.jsx
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  Lock,
  KeyRound,
  Mail,
  IdCard,
  Info,
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
    return 'Sin Lote registrado';
  }
  return areaPart === 'N/A' ? `Lote ${cleanLot}` : `${areaPart} · Lote ${cleanLot}`;
}

function PortalSwitch({ checked, disabled, onChange, label, title }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
        checked
          ? 'bg-emerald-500/90 border-emerald-400/80'
          : 'bg-slate-800 border-slate-600/80'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-95'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function AccountView({ onNavigate }) {
  const { user, updateUser } = useAuth();
  const { brand } = useBranding();

  const locationSectionRef = useRef(null);
  const lotInputRef = useRef(null);

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

  // Divulgación progresiva: cuando un prestador inicia el flujo para activar Portal Residente
  const [activatingResidentDraft, setActivatingResidentDraft] = useState(false);

  // Seguridad / Cambio de contraseña
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState({ type: '', text: '' });

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
    if (acc.can_use_resident) {
      setActivatingResidentDraft(false);
    }
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

  const showResidentialFields = canUseResident || activatingResidentDraft;

  const hasProfileChanges = useMemo(() => {
    if (!account) return false;
    const savedCountry = account.country_id ? String(account.country_id) : '';
    const savedFracType = account.fraction_type || 'na';
    const savedFracNum = account.fraction_number
      ? String(account.fraction_number).replace(/\D+/g, '')
      : '';
    const savedLot = account.lot_number ? String(account.lot_number).replace(/\D+/g, '') : '';

    return (
      firstName.trim() !== (account.first_name || '') ||
      lastName.trim() !== (account.last_name || '') ||
      phone.trim() !== (account.phone || '') ||
      countryId !== savedCountry ||
      fractionType !== savedFracType ||
      (fractionType === 'na' ? '' : fractionNumber.trim()) !== savedFracNum ||
      lotNumber.trim() !== savedLot ||
      activatingResidentDraft
    );
  }, [
    account,
    firstName,
    lastName,
    phone,
    countryId,
    fractionType,
    fractionNumber,
    lotNumber,
    activatingResidentDraft,
  ]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setFeedback({ type: '', text: '' });

    const nextResidentFlag = activatingResidentDraft ? true : canUseResident;

    try {
      const payload = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        country_id: countryId ? Number(countryId) : '',
        fraction_type: nextResidentFlag ? fractionType : account?.fraction_type || 'na',
        fraction_number: nextResidentFlag
          ? fractionType === 'na'
            ? null
            : fractionNumber.trim()
          : account?.fraction_number || null,
        lot_number: nextResidentFlag ? lotNumber.trim() || null : account?.lot_number || null,
        activate_resident_portal: nextResidentFlag,
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
        setActivatingResidentDraft(false);
        setFeedback({
          type: 'success',
          text: activatingResidentDraft
            ? 'Domicilio guardado y Portal Residente activado correctamente.'
            : data.message || 'Perfil y ubicación actualizados correctamente.',
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

  const openResidentActivationForm = () => {
    setActivatingResidentDraft(true);
    setFeedback({
      type: 'info',
      text: 'Completá tu Comunidad y Número de Lote abajo y presioná "Guardar y Activar Residente".',
    });
    setTimeout(() => {
      locationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      lotInputRef.current?.focus();
    }, 60);
  };

  const handleQuickTogglePortal = async (portalKey) => {
    if (portalKey === 'resident' && !canUseResident && !lotNumber.trim()) {
      openResidentActivationForm();
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
        setActivatingResidentDraft(false);
        setFeedback({
          type: 'success',
          text:
            portalKey === 'provider'
              ? nextProvider
                ? 'Portal Prestador habilitado. Ya podés acceder desde la barra superior.'
                : 'Portal Prestador desactivado: operás ahora solo como Residente y dejás de figurar en el directorio sin perder tu historial.'
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

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordFeedback({ type: '', text: '' });

    if (newPassword.length < 6) {
      setPasswordFeedback({
        type: 'error',
        text: 'La nueva contraseña debe tener al menos 6 caracteres.',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({
        type: 'error',
        text: 'La confirmación no coincide con la nueva contraseña.',
      });
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/account/password`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordFeedback({
          type: 'success',
          text: data.message || 'Contraseña actualizada correctamente.',
        });
      } else {
        setPasswordFeedback({
          type: 'error',
          text: data.error || 'No se pudo actualizar la contraseña.',
        });
      }
    } catch (err) {
      console.error('Error al cambiar contraseña:', err);
      setPasswordFeedback({
        type: 'error',
        text: 'Error de conexión al actualizar la contraseña.',
      });
    } finally {
      setSavingPassword(false);
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

  const residentOnlyLock = canUseResident && !canUseProvider && !isPrivilegedRole;
  const providerOnlyLock = canUseProvider && !canUseResident && !isPrivilegedRole;

  const inputBaseClass =
    'w-full px-3.5 py-2.5 rounded-xl border border-white/20 text-xs focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/25 transition-colors';

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
              Rol por defecto:{' '}
              <span className="font-mono font-bold uppercase">{defaultRoleLabel}</span> ·{' '}
              {account?.email || user?.email || '—'}
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
              : feedback.type === 'info'
              ? 'bg-sky-950/60 border-sky-800 text-sky-200'
              : 'bg-rose-950/60 border-rose-800 text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          ) : feedback.type === 'info' ? (
            <Info size={16} className="text-sky-400 shrink-0" />
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
          {/* Bloque 1: Portales Habilitados y Rol Principal */}
          <section
            className="rounded-2xl p-5 sm:p-6 border border-slate-800/80 shadow-md space-y-4"
            style={cardStyle}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-black/20 pb-3.5">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <ShieldCheck size={17} className="text-emerald-400 shrink-0" />
                  <span>Portales Habilitados y Rol Principal</span>
                </h2>
                <p className="text-xs opacity-75 mt-0.5">
                  Activá uno o ambos portales según cómo operes y elegí con cuál iniciar sesión por defecto.
                </p>
              </div>
              <span
                className="text-[11px] font-semibold px-3 py-1 rounded-full border border-white/15 self-start sm:self-center shrink-0"
                style={innerStyle}
              >
                Ingreso por defecto: {activePrimary === 'provider' ? 'Prestador' : 'Residente'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tarjeta Portal Residente */}
              <div
                className={`rounded-xl p-4 border space-y-4 transition-all ${
                  canUseResident && activePrimary === 'resident'
                    ? 'border-emerald-500/60 ring-1 ring-emerald-500/25'
                    : 'border-white/10'
                }`}
                style={innerStyle}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="p-2.5 rounded-xl border border-white/15 text-emerald-400 shrink-0"
                      style={cardStyle}
                    >
                      <Home size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold">Portal Residente</h3>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                            canUseResident
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                              : 'bg-slate-800/80 text-slate-400 border-slate-700'
                          }`}
                        >
                          {canUseResident ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-75 mt-0.5">
                        Directorio, visitas, pases QR, pagos y reseñas.
                      </p>
                    </div>
                  </div>

                  <PortalSwitch
                    checked={canUseResident}
                    disabled={savingProfile || residentOnlyLock}
                    onChange={() => handleQuickTogglePortal('resident')}
                    label="Activar o desactivar Portal Residente"
                    title={
                      residentOnlyLock
                        ? 'Activá Portal Prestador primero para poder desactivar Portal Residente'
                        : canUseResident
                        ? 'Desactivar Portal Residente'
                        : 'Activar Portal Residente'
                    }
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                  {canUseResident ? (
                    <>
                      {activePrimary === 'resident' ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-300 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                          <Star size={12} className="fill-emerald-400 text-emerald-400" />
                          Principal al ingresar
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={switchingPortal === 'resident'}
                          onClick={() => handleSetPrimaryPortal('resident')}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border border-white/15 hover:border-emerald-400/60 text-emerald-300 cursor-pointer disabled:opacity-50"
                          style={cardStyle}
                        >
                          <Star size={12} />
                          {switchingPortal === 'resident' ? 'Guardando...' : 'Definir Principal'}
                        </button>
                      )}

                      {onNavigate && (
                        <button
                          type="button"
                          onClick={() => onNavigate('resident')}
                          className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer hover:opacity-95 shadow-sm"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <span>Abrir</span>
                          <ArrowRight size={12} />
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span className="text-[11px] opacity-70">
                        Requiere domicilio / lote cargado
                      </span>
                      <button
                        type="button"
                        disabled={savingProfile}
                        onClick={() => handleQuickTogglePortal('resident')}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold border border-emerald-500/40 text-emerald-300 cursor-pointer hover:opacity-90"
                        style={cardStyle}
                      >
                        Activar
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Tarjeta Portal Prestador */}
              <div
                className={`rounded-xl p-4 border space-y-4 transition-all ${
                  canUseProvider && activePrimary === 'provider'
                    ? 'border-emerald-500/60 ring-1 ring-emerald-500/25'
                    : 'border-white/10'
                }`}
                style={innerStyle}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="p-2.5 rounded-xl border border-white/15 text-sky-400 shrink-0"
                      style={cardStyle}
                    >
                      <Wrench size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold">Portal Prestador</h3>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                            canUseProvider
                              ? 'bg-sky-950/80 text-sky-300 border-sky-700/60'
                              : 'bg-slate-800/80 text-slate-400 border-slate-700'
                          }`}
                        >
                          {canUseProvider ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-75 mt-0.5">
                        Compliance, flota, cuadrilla, agenda y pases QR.
                      </p>
                    </div>
                  </div>

                  <PortalSwitch
                    checked={canUseProvider}
                    disabled={savingProfile || providerOnlyLock}
                    onChange={() => handleQuickTogglePortal('provider')}
                    label="Activar o desactivar Portal Prestador"
                    title={
                      providerOnlyLock
                        ? 'Activá Portal Residente primero para poder desactivar Portal Prestador'
                        : canUseProvider
                        ? 'Desactivar Portal Prestador'
                        : 'Activar Portal Prestador'
                    }
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                  {canUseProvider ? (
                    <>
                      {activePrimary === 'provider' ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-300 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                          <Star size={12} className="fill-emerald-400 text-emerald-400" />
                          Principal al ingresar
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={switchingPortal === 'provider'}
                          onClick={() => handleSetPrimaryPortal('provider')}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border border-white/15 hover:border-emerald-400/60 text-emerald-300 cursor-pointer disabled:opacity-50"
                          style={cardStyle}
                        >
                          <Star size={12} />
                          {switchingPortal === 'provider' ? 'Guardando...' : 'Definir Principal'}
                        </button>
                      )}

                      {onNavigate && (
                        <button
                          type="button"
                          onClick={() => onNavigate('provider')}
                          className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer hover:opacity-95 shadow-sm"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <span>Abrir</span>
                          <ArrowRight size={12} />
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span className="text-[11px] opacity-70">
                        Ofrecé servicios sin perder tu cuenta residente
                      </span>
                      <button
                        type="button"
                        disabled={savingProfile}
                        onClick={() => handleQuickTogglePortal('provider')}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold border border-sky-500/40 text-sky-300 cursor-pointer hover:opacity-90"
                        style={cardStyle}
                      >
                        Activar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[11px] opacity-70 flex items-center gap-1.5">
              <Info size={13} className="shrink-0 opacity-80" />
              <span>
                {residentOnlyLock || providerOnlyLock
                  ? 'Tu cuenta mantiene al menos un portal activo. Si desactivás Portal Prestador en el futuro, dejás de aparecer en el directorio sin perder tu historial ni tu compliance.'
                  : 'Podés desactivar cualquiera de los dos portales cuando quieras; tu historial de pases, contratos y reseñas se conserva intacto.'}
              </span>
            </p>
          </section>

          {/* Bloque 2: Datos Personales y Ubicación Residencial (con divulgación progresiva) */}
          <form
            ref={locationSectionRef}
            onSubmit={handleSaveProfile}
            className="rounded-2xl p-5 sm:p-6 border border-slate-800/80 shadow-md space-y-5 text-xs"
            style={cardStyle}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-black/20 pb-3.5">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <MapPin size={17} className="text-emerald-400 shrink-0" />
                  <span>
                    {showResidentialFields
                      ? 'Datos Personales y Ubicación Residencial'
                      : 'Datos Personales de Contacto'}
                  </span>
                </h2>
                <p className="text-xs opacity-75 mt-0.5">
                  {showResidentialFields
                    ? 'Tu Manzana/Fracción y Lote registrados se aplican automáticamente (y bloqueados) en cada solicitud de visita y Pase QR.'
                    : 'Estos datos se muestran en tu perfil y se usan para coordinar visitas y avisos por WhatsApp.'}
                </p>
              </div>
              {hasProfileChanges && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border border-amber-500/40 bg-amber-500/15 text-amber-200 self-start sm:self-center shrink-0">
                  Cambios sin guardar
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1.5">
                  Nombre *
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputBaseClass}
                  style={innerStyle}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1.5">
                  Apellido *
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputBaseClass}
                  style={innerStyle}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1.5">
                  Teléfono / WhatsApp
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+54 9 11 ..."
                  className={inputBaseClass}
                  style={innerStyle}
                />
              </div>

              {showResidentialFields && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1.5 flex items-center gap-1">
                    <Building2 size={12} /> Comunidad / Barrio
                  </label>
                  <select
                    value={countryId}
                    onChange={(e) => setCountryId(e.target.value)}
                    className={inputBaseClass}
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
              )}
            </div>

            {/* Sub-bloque de ubicación normalizada: visible solo si es Residente o está activándolo */}
            {showResidentialFields ? (
              <div
                className="rounded-xl p-4 border border-white/15 space-y-3"
                style={innerStyle}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs">Ubicación Residencial Normalizada</span>
                    {activatingResidentDraft && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        Activando Portal Residente
                      </span>
                    )}
                  </div>
                  <span
                    className="text-[11px] font-mono px-2.5 py-1 rounded-lg border border-white/15 self-start sm:self-auto"
                    style={cardStyle}
                  >
                    Destino QR: {destinationPreview}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold opacity-85 mb-1">
                      Tipo de Área
                    </label>
                    <select
                      value={fractionType}
                      onChange={(e) => {
                        const next = e.target.value;
                        setFractionType(next);
                        if (next === 'na') setFractionNumber('');
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-white/20 text-xs focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/25"
                      style={cardStyle}
                    >
                      <option value="na">No aplica (N/A)</option>
                      <option value="manzana">Manzana</option>
                      <option value="fraccion">Fracción</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold opacity-85 mb-1">
                      Número de {fractionType === 'manzana' ? 'Manzana' : 'Fracción'}
                      {fractionType !== 'na' ? ' *' : ''}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      disabled={fractionType === 'na'}
                      required={fractionType !== 'na'}
                      value={fractionNumber}
                      onChange={(e) => setFractionNumber(e.target.value.replace(/\D+/g, ''))}
                      placeholder={fractionType === 'na' ? 'N/A' : 'Solo números (ej: 4)'}
                      className="w-full px-3 py-2 rounded-xl border border-white/20 text-xs font-mono focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/25 disabled:opacity-40"
                      style={cardStyle}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold opacity-85 mb-1">
                      Número de Lote *
                    </label>
                    <input
                      ref={lotInputRef}
                      type="text"
                      inputMode="numeric"
                      required
                      value={lotNumber}
                      onChange={(e) => setLotNumber(e.target.value.replace(/\D+/g, ''))}
                      placeholder="Solo números (ej: 18)"
                      className="w-full px-3 py-2 rounded-xl border border-white/20 text-xs font-mono focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/25"
                      style={cardStyle}
                    />
                  </div>
                </div>

                {activatingResidentDraft && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setActivatingResidentDraft(false);
                        setFeedback({ type: '', text: '' });
                      }}
                      className="text-[11px] font-semibold opacity-75 hover:opacity-100 cursor-pointer"
                    >
                      Cancelar activación de Portal Residente
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div
                className="rounded-xl p-4 border border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                style={innerStyle}
              >
                <div className="space-y-0.5">
                  <p className="font-bold text-xs flex items-center gap-1.5">
                    <Home size={14} className="text-emerald-400 shrink-0" />
                    <span>¿También vivís en una comunidad TrustLink?</span>
                  </p>
                  <p className="text-[11px] opacity-75">
                    El domicilio y número de Lote solo se requieren si querés habilitar el Portal Residente para emitir pases QR.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openResidentActivationForm}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold border border-emerald-500/40 text-emerald-300 hover:opacity-90 cursor-pointer shrink-0 self-start sm:self-auto"
                  style={cardStyle}
                >
                  Cargar domicilio y activar Residente
                </button>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="submit"
                disabled={savingProfile || !hasProfileChanges}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer hover:opacity-95 disabled:opacity-45 disabled:cursor-not-allowed shadow-sm transition-opacity"
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
                    {activatingResidentDraft ? 'Guardar y Activar Residente' : 'Guardar Cambios'}
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Bloque 3: Identidad Verificada y Seguridad de Acceso */}
          <section
            className="rounded-2xl p-5 sm:p-6 border border-slate-800/80 shadow-md space-y-4 text-xs"
            style={cardStyle}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <Lock size={16} className="text-sky-400 shrink-0" />
                  <span>Identidad Verificada y Seguridad</span>
                </h2>
                <p className="text-xs opacity-75 mt-0.5">
                  Correo y DNI asociados a tu cuenta (solo lectura) y gestión de contraseña.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordForm((prev) => !prev);
                  setPasswordFeedback({ type: '', text: '' });
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-white/15 hover:opacity-90 cursor-pointer self-start sm:self-auto shrink-0"
                style={innerStyle}
              >
                <KeyRound size={13} className="text-sky-400" />
                {showPasswordForm ? 'Ocultar cambio de contraseña' : 'Cambiar contraseña'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                className="rounded-xl p-3.5 border border-white/10 flex items-center gap-3"
                style={innerStyle}
              >
                <Mail size={15} className="opacity-70 shrink-0" />
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider opacity-65">
                    Correo electrónico
                  </span>
                  <span className="font-semibold truncate block">
                    {account?.email || user?.email || '—'}
                  </span>
                </div>
              </div>

              <div
                className="rounded-xl p-3.5 border border-white/10 flex items-center gap-3"
                style={innerStyle}
              >
                <IdCard size={15} className="opacity-70 shrink-0" />
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider opacity-65">
                    Documento (DNI)
                  </span>
                  <span className="font-mono font-semibold truncate block">
                    {account?.dni || '—'}
                  </span>
                </div>
              </div>
            </div>

            {showPasswordForm && (
              <form
                onSubmit={handleChangePassword}
                className="rounded-xl p-4 border border-white/15 space-y-3"
                style={innerStyle}
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold opacity-85 mb-1">
                      Contraseña actual *
                    </label>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 rounded-xl border border-white/20 text-xs focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/25"
                      style={cardStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold opacity-85 mb-1">
                      Nueva contraseña *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full px-3 py-2 rounded-xl border border-white/20 text-xs focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/25"
                      style={cardStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold opacity-85 mb-1">
                      Confirmar contraseña *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repetí la nueva contraseña"
                      className="w-full px-3 py-2 rounded-xl border border-white/20 text-xs focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/25"
                      style={cardStyle}
                    />
                  </div>
                </div>

                {passwordFeedback.text && (
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${
                      passwordFeedback.type === 'success'
                        ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                        : 'bg-rose-950/60 border-rose-800 text-rose-200'
                    }`}
                  >
                    {passwordFeedback.type === 'success' ? (
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle size={14} className="text-rose-400 shrink-0" />
                    )}
                    <span>{passwordFeedback.text}</span>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer hover:opacity-95 disabled:opacity-50"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <KeyRound size={13} />
                    {savingPassword ? 'Actualizando...' : 'Actualizar contraseña'}
                  </button>
                </div>
              </form>
            )}
          </section>
        </>
      )}
    </div>
  );
}
