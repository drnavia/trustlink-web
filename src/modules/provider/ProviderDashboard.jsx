/**
 * @file ProviderDashboard.jsx
 * @description Panel completo del Prestador conectado a PostgreSQL con aplicación explícita
 * de Zona 4 (tarjetas principales) y Zona 5 (cajas/bloques internos e inputs).
 * Permite gestionar credenciales de compliance, flota vehicular y reputación cruzada.
 * @location /trustlink-web/src/modules/provider/ProviderDashboard.jsx
 */

import React, { useState, useEffect } from 'react';
import {
  Wrench,
  ShieldCheck,
  Car,
  Plus,
  Edit3,
  Save,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Star,
  MessageSquare,
  Send,
} from 'lucide-react';
import { useBranding, DEFAULT_BRANDING_CONFIG } from '../branding/BrandingContext';

const API_BASE = 'http://localhost:4000';

export default function ProviderDashboard() {
  const { brand } = useBranding();

  const cardStyle = {
    backgroundColor: brand.cardBgColor || DEFAULT_BRANDING_CONFIG.cardBgColor,
    color: brand.cardTextColor || DEFAULT_BRANDING_CONFIG.cardTextColor,
  };

  const innerStyle = {
    backgroundColor: brand.innerBgColor || DEFAULT_BRANDING_CONFIG.innerBgColor,
    color: brand.innerTextColor || DEFAULT_BRANDING_CONFIG.innerTextColor,
  };

  const [profileData, setProfileData] = useState({ providers: [], vehicles: [] });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Estados para nuevo compliance
  const [newSpecialty, setNewSpecialty] = useState('');
  const [newCrimUrl, setNewCrimUrl] = useState('');
  const [newArtUrl, setNewArtUrl] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Estados para edición de compliance existente
  const [editingProviderId, setEditingProviderId] = useState(null);
  const [editSpecialty, setEditSpecialty] = useState('');
  const [editCrimUrl, setEditCrimUrl] = useState('');
  const [editArtUrl, setEditArtUrl] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Estados para registro de vehículo
  const [vehType, setVehType] = useState('utilitario');
  const [vehBrand, setVehBrand] = useState('');
  const [vehModel, setVehModel] = useState('');
  const [vehColor, setVehColor] = useState('');
  const [vehPlate, setVehPlate] = useState('');
  const [savingVehicle, setSavingVehicle] = useState(false);

  // Estados para reputación cruzada (calificar residentes al cerrar servicio)
  const [reviewContracts, setReviewContracts] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [ownerRatingDrafts, setOwnerRatingDrafts] = useState({});
  const [ownerCommentDrafts, setOwnerCommentDrafts] = useState({});
  const [submittingOwnerReviewId, setSubmittingOwnerReviewId] = useState(null);

  const fetchProviderProfile = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setProfileData({
          providers: data.providers || [],
          vehicles: data.vehicles || [],
        });
      } else {
        setErrorMsg(data.error || 'No se pudo cargar el perfil del prestador.');
      }
    } catch (error) {
      console.error('Error al cargar perfil de prestador:', error);
      setErrorMsg('Error de conexión con el servidor backend.');
    } finally {
      setLoading(false);
    }
  };

  const fetchProviderReviewContracts = async () => {
    setLoadingReviews(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/reviews/provider-contracts`, {
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
      console.error('Error al cargar historial de contratos del prestador:', error);
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    fetchProviderProfile();
    fetchProviderReviewContracts();
  }, []);

  const handleCreateCompliance = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
        body: JSON.stringify({
          specialty: newSpecialty.trim(),
          criminal_record_url: newCrimUrl.trim(),
          art_insurance_url: newArtUrl.trim(),
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg('Credencial de compliance registrada correctamente.');
        setNewSpecialty('');
        setNewCrimUrl('');
        setNewArtUrl('');
        await fetchProviderProfile();
      } else {
        setErrorMsg(data.error || 'No se pudo registrar la credencial.');
      }
    } catch (error) {
      console.error('Error al registrar compliance:', error);
      setErrorMsg('Error de conexión con el servidor.');
    } finally {
      setSavingProfile(false);
    }
  };

  const startEditingCompliance = (provider) => {
    setEditingProviderId(provider.id);
    setEditSpecialty(provider.specialty || '');
    setEditCrimUrl(provider.criminal_record_url || '');
    setEditArtUrl(provider.art_insurance_url || '');
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSaveEditCompliance = async (providerId) => {
    setUpdatingProfile(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/profile/${providerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
        body: JSON.stringify({
          specialty: editSpecialty.trim(),
          criminal_record_url: editCrimUrl.trim(),
          art_insurance_url: editArtUrl.trim(),
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg('Credencial actualizada y enviada a revisión.');
        setEditingProviderId(null);
        await fetchProviderProfile();
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar la credencial.');
      }
    } catch (error) {
      console.error('Error al actualizar credencial:', error);
      setErrorMsg('Error de conexión al actualizar la credencial.');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleAddVehicle = async (e) => {
    e.preventDefault();
    setSavingVehicle(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/vehicles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
        body: JSON.stringify({
          vehicle_type: vehType,
          brand: vehBrand.trim(),
          model: vehModel.trim(),
          color: vehColor.trim(),
          license_plate: vehPlate.trim().toUpperCase(),
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg('Vehículo asociado a tu flota correctamente.');
        setVehBrand('');
        setVehModel('');
        setVehColor('');
        setVehPlate('');
        await fetchProviderProfile();
      } else {
        setErrorMsg(data.error || 'No se pudo registrar el vehículo.');
      }
    } catch (error) {
      console.error('Error al registrar vehículo:', error);
      setErrorMsg('Error de conexión con el servidor.');
    } finally {
      setSavingVehicle(false);
    }
  };

  const handleSubmitOwnerReview = async (contractId) => {
    const ratingVal = ownerRatingDrafts[contractId] || 5;
    const commentVal = (ownerCommentDrafts[contractId] || '').trim();
    setSubmittingOwnerReviewId(contractId);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch(`${API_BASE}/api/v1/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
        body: JSON.stringify({
          contract_id: contractId,
          rating: ratingVal,
          comment: commentVal,
          target_role: 'owner',
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg('Calificación al residente registrada correctamente.');
        await fetchProviderReviewContracts();
      } else {
        setErrorMsg(data.error || 'No se pudo enviar la calificación.');
      }
    } catch (error) {
      console.error('Error al calificar residente:', error);
      setErrorMsg('Error de conexión al enviar la calificación.');
    } finally {
      setSubmittingOwnerReviewId(null);
    }
  };

  const primaryProfile = profileData.providers[0] || null;
  const profileStatus = primaryProfile?.status || null;

  return (
    <div className="max-w-6xl w-full mx-auto px-4 md:px-8 py-6 space-y-6">
      {/* Zona 4: Cabecera del Portal Prestador */}
      <section
        className="p-6 rounded-2xl border border-black/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        style={cardStyle}
      >
        <div className="flex items-center space-x-3.5">
          <div className="p-3 rounded-xl border border-white/15" style={innerStyle}>
            <Wrench size={22} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight">Portal Prestador Verificado</h2>
            <p className="text-xs opacity-80">
              Gestión de credenciales de compliance, flota vehicular y reputación cruzada en{' '}
              {brand.countryName || 'TrustLink'}.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {profileStatus && (
            <span
              className="text-xs font-bold px-3.5 py-1.5 rounded-xl uppercase tracking-wider border border-white/15"
              style={innerStyle}
            >
              Estado: {profileStatus}
            </span>
          )}
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

      {loading ? (
        <div
          className="text-center py-12 rounded-2xl border border-black/20 text-xs flex items-center justify-center gap-2"
          style={cardStyle}
        >
          <Loader2 className="animate-spin" size={16} /> Cargando información del prestador...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Zona 4: Sección Compliance y Credenciales */}
            <section
              className="p-6 rounded-2xl border border-black/20 space-y-5 flex flex-col justify-between"
              style={cardStyle}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-black/20 pb-3">
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <ShieldCheck size={18} className="text-emerald-400" /> Credenciales y Compliance
                  </h3>
                  <span
                    className="text-[11px] px-2.5 py-1 rounded-lg border border-white/15"
                    style={innerStyle}
                  >
                    {profileData.providers.length} registro(s)
                  </span>
                </div>

                {/* Zona 5: Formulario Nuevo Compliance */}
                <form
                  onSubmit={handleCreateCompliance}
                  className="p-4 rounded-xl border border-black/20 space-y-3 text-xs"
                  style={innerStyle}
                >
                  <p className="font-bold">Registrar Nueva Especialidad / Documentación</p>
                  <input
                    type="text"
                    required
                    value={newSpecialty}
                    onChange={(e) => setNewSpecialty(e.target.value)}
                    placeholder="Especialidad (ej: Electricista Matriculado)"
                    className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                    style={cardStyle}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={newCrimUrl}
                      onChange={(e) => setNewCrimUrl(e.target.value)}
                      placeholder="URL Certificado Antecedentes"
                      className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                      style={cardStyle}
                    />
                    <input
                      type="text"
                      value={newArtUrl}
                      onChange={(e) => setNewArtUrl(e.target.value)}
                      placeholder="URL Póliza ART / Seguro"
                      className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                      style={cardStyle}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Plus size={14} /> {savingProfile ? 'Guardando...' : 'Agregar Credencial'}
                  </button>
                </form>

                {/* Zona 5: Listado de Credenciales */}
                <div className="space-y-3">
                  {profileData.providers.length === 0 ? (
                    <div
                      className="p-4 rounded-xl border border-black/20 text-xs opacity-80"
                      style={innerStyle}
                    >
                      No tenés credenciales de compliance registradas aún.
                    </div>
                  ) : (
                    profileData.providers.map((p) => {
                      const isEditing = editingProviderId === p.id;
                      return (
                        <div
                          key={p.id}
                          className="p-4 rounded-xl border border-black/20 space-y-3 text-xs"
                          style={innerStyle}
                        >
                          {isEditing ? (
                            <div className="space-y-2.5">
                              <input
                                type="text"
                                value={editSpecialty}
                                onChange={(e) => setEditSpecialty(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                                style={cardStyle}
                              />
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  value={editCrimUrl}
                                  onChange={(e) => setEditCrimUrl(e.target.value)}
                                  placeholder="URL Antecedentes"
                                  className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                                  style={cardStyle}
                                />
                                <input
                                  type="text"
                                  value={editArtUrl}
                                  onChange={(e) => setEditArtUrl(e.target.value)}
                                  placeholder="URL ART / Seguro"
                                  className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                                  style={cardStyle}
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingProviderId(null)}
                                  className="px-3 py-1.5 rounded-lg font-bold border border-white/15 inline-flex items-center gap-1 cursor-pointer"
                                  style={cardStyle}
                                >
                                  <X size={13} /> Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditCompliance(p.id)}
                                  disabled={updatingProfile}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Save size={13} /> {updatingProfile ? 'Guardando...' : 'Guardar'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-sm">{p.specialty}</span>
                                  <span
                                    className="text-[10px] font-bold uppercase px-2 py-0.5 rounded border border-white/15"
                                    style={cardStyle}
                                  >
                                    {p.status}
                                  </span>
                                </div>
                                <p className="opacity-80">
                                  Antecedentes: {p.criminal_record_url || 'No cargado'} · ART:{' '}
                                  {p.art_insurance_url || 'No cargado'}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => startEditingCompliance(p)}
                                className="px-2.5 py-1.5 rounded-lg border border-white/15 inline-flex items-center gap-1 cursor-pointer shrink-0"
                                style={cardStyle}
                              >
                                <Edit3 size={12} /> Editar
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </section>

            {/* Zona 4: Sección Flota Vehicular Habilitada */}
            <section
              className="p-6 rounded-2xl border border-black/20 space-y-5 flex flex-col justify-between"
              style={cardStyle}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-black/20 pb-3">
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <Car size={18} className="text-sky-400" /> Flota Vehicular Habilitada
                  </h3>
                  <span
                    className="text-[11px] px-2.5 py-1 rounded-lg border border-white/15"
                    style={innerStyle}
                  >
                    {profileData.vehicles.length} vehículo(s)
                  </span>
                </div>

                {/* Zona 5: Formulario Nuevo Vehículo */}
                <form
                  onSubmit={handleAddVehicle}
                  className="p-4 rounded-xl border border-black/20 space-y-3 text-xs"
                  style={innerStyle}
                >
                  <p className="font-bold">Asociar Vehículo</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <select
                      value={vehType}
                      onChange={(e) => setVehType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                      style={cardStyle}
                    >
                      <option value="utilitario">Utilitario</option>
                      <option value="auto">Automóvil</option>
                      <option value="moto">Motocicleta</option>
                      <option value="camioneta">Camioneta</option>
                    </select>
                    <input
                      type="text"
                      required
                      value={vehBrand}
                      onChange={(e) => setVehBrand(e.target.value)}
                      placeholder="Marca (ej: Ford)"
                      className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                      style={cardStyle}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      required
                      value={vehModel}
                      onChange={(e) => setVehModel(e.target.value)}
                      placeholder="Modelo (ej: Fiorino)"
                      className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                      style={cardStyle}
                    />
                    <input
                      type="text"
                      required
                      value={vehColor}
                      onChange={(e) => setVehColor(e.target.value)}
                      placeholder="Color (ej: Blanco)"
                      className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                      style={cardStyle}
                    />
                    <input
                      type="text"
                      required
                      value={vehPlate}
                      onChange={(e) => setVehPlate(e.target.value)}
                      placeholder="Patente (ej: AF123CD)"
                      className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs uppercase"
                      style={cardStyle}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingVehicle}
                    className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Plus size={14} /> {savingVehicle ? 'Registrando...' : 'Registrar Vehículo'}
                  </button>
                </form>

                {/* Zona 5: Listado de Vehículos */}
                <div className="space-y-3">
                  {profileData.vehicles.length === 0 ? (
                    <div
                      className="p-4 rounded-xl border border-black/20 text-xs opacity-80"
                      style={innerStyle}
                    >
                      Sin vehículos registrados en tu flota.
                    </div>
                  ) : (
                    profileData.vehicles.map((v) => (
                      <div
                        key={v.id}
                        className="p-4 rounded-xl border border-black/20 flex items-center justify-between gap-3 text-xs"
                        style={innerStyle}
                      >
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm">
                              {v.brand} {v.model}
                            </span>
                            <span
                              className="text-[10px] font-bold uppercase px-2 py-0.5 rounded border border-white/15"
                              style={cardStyle}
                            >
                              {v.vehicle_type}
                            </span>
                          </div>
                          <p className="opacity-80 mt-1">
                            Color: {v.color || '-'} · Patente:{' '}
                            <strong className="font-mono">{v.license_plate}</strong>
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Zona 4: Reputación Cruzada (Servicios y Calificación a Residentes) */}
          <section
            className="p-6 rounded-2xl border border-black/20 space-y-5"
            style={cardStyle}
          >
            <div className="flex items-center justify-between border-b border-black/20 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl border border-white/15" style={innerStyle}>
                  <Star size={18} className="text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    Servicios Realizados &amp; Reputación Cruzada
                  </h3>
                  <p className="text-xs opacity-80">
                    Visualizá las reseñas recibidas de residentes y calificá tu experiencia en cada domicilio.
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
                Cargando historial de servicios...
              </div>
            ) : reviewContracts.length === 0 ? (
              <div
                className="text-center py-8 rounded-xl border border-black/20 text-xs opacity-85"
                style={innerStyle}
              >
                Aún no tenés contratos asignados en tu historial.
              </div>
            ) : (
              <div className="space-y-4">
                {reviewContracts.map((item) => {
                  const ratingDraft = ownerRatingDrafts[item.contract_id] || 5;
                  const commentDraft = ownerCommentDrafts[item.contract_id] || '';
                  const alreadyRatedOwner = Boolean(item.owner_review_id);

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
                          <span className="opacity-80">
                            {item.country_name || 'TrustLink Community'}
                          </span>
                        </div>
                        <span className="uppercase text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-white/15">
                          {item.status}
                        </span>
                      </div>

                      <p className="font-bold">
                        Residente: {item.owner_name || 'Residente Verificado'}
                      </p>
                      <p className="opacity-85">{item.description}</p>

                      {item.provider_review_rating && (
                        <div
                          className="p-3 rounded-lg border border-white/15 flex flex-wrap items-center justify-between gap-2"
                          style={cardStyle}
                        >
                          <span className="font-semibold text-emerald-400">
                            Reseña recibida del residente:{' '}
                            {'★'.repeat(item.provider_review_rating)} (
                            {item.provider_review_rating}/5)
                          </span>
                          {item.provider_review_comment && (
                            <span className="opacity-85 italic">
                              "{item.provider_review_comment}"
                            </span>
                          )}
                        </div>
                      )}

                      {alreadyRatedOwner ? (
                        <div
                          className="p-3 rounded-lg border border-white/15 text-xs"
                          style={cardStyle}
                        >
                          Tu calificación al residente: {'★'.repeat(item.owner_review_rating)} (
                          {item.owner_review_rating}/5)
                          {item.owner_review_comment ? ` — "${item.owner_review_comment}"` : ''}
                        </div>
                      ) : (
                        <div className="space-y-2.5 pt-2 border-t border-black/20">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold">Calificar al residente:</span>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((starVal) => (
                                <button
                                  key={starVal}
                                  type="button"
                                  onClick={() =>
                                    setOwnerRatingDrafts((prev) => ({
                                      ...prev,
                                      [item.contract_id]: starVal,
                                    }))
                                  }
                                  className={`p-1.5 rounded-lg border cursor-pointer ${
                                    ratingDraft >= starVal
                                      ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                                      : 'border-white/15 opacity-70'
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
                              value={commentDraft}
                              onChange={(e) =>
                                setOwnerCommentDrafts((prev) => ({
                                  ...prev,
                                  [item.contract_id]: e.target.value,
                                }))
                              }
                              placeholder="Comentario sobre el trato y acceso en el domicilio..."
                              className="w-full pl-8 pr-3 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                              style={cardStyle}
                            />
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleSubmitOwnerReview(item.contract_id)}
                              disabled={submittingOwnerReviewId === item.contract_id}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <Send size={13} />
                              {submittingOwnerReviewId === item.contract_id
                                ? 'Enviando...'
                                : 'Calificar Residente'}
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
        </>
      )}
    </div>
  );
}