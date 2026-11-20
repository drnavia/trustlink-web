/**
 * @file ProviderDashboard.jsx
 * @description Portal del Prestador conectado 100% a PostgreSQL. Permite gestionar
 * credenciales de compliance, flota vehicular y emitir/consultar calificaciones cruzadas con residentes.
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
  Send
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';

const API_BASE = 'http://localhost:4000';

export default function ProviderDashboard() {
  const { brand } = useBranding();

  const [providerProfiles, setProviderProfiles] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Formulario nuevo perfil / compliance
  const [specialty, setSpecialty] = useState('');
  const [criminalRecordUrl, setCriminalRecordUrl] = useState('');
  const [insurancePolicyUrl, setInsurancePolicyUrl] = useState('');

  // Edición de perfil
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [editSpecialty, setEditSpecialty] = useState('');
  const [editCriminalUrl, setEditCriminalUrl] = useState('');
  const [editInsuranceUrl, setEditInsuranceUrl] = useState('');

  // Formulario nuevo vehículo
  const [vehicleType, setVehicleType] = useState('Utilitario');
  const [brandName, setBrandName] = useState('');
  const [modelName, setModelName] = useState('');
  const [colorName, setColorName] = useState('');
  const [plate, setPlate] = useState('');

  // Edición de vehículo
  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [editVehicleType, setEditVehicleType] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editPlate, setEditPlate] = useState('');

  // Reputación cruzada del prestador
  const [providerContracts, setProviderContracts] = useState([]);
  const [loadingContracts, setLoadingContracts] = useState(true);
  const [ownerRatingDrafts, setOwnerRatingDrafts] = useState({});
  const [ownerCommentDrafts, setOwnerCommentDrafts] = useState({});
  const [submittingReviewId, setSubmittingReviewId] = useState(null);
  const [crossReviewFeedback, setCrossReviewFeedback] = useState(null);

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`
  });

  const fetchProviderData = async () => {
    setFetching(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/me`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (response.ok) {
        setProviderProfiles(data.providers || []);
        setVehicles(data.vehicles || []);
      }
    } catch (error) {
      console.error('Error al cargar datos del prestador:', error);
    } finally {
      setFetching(false);
    }
  };

  const fetchProviderContracts = async () => {
    setLoadingContracts(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/reviews/contracts`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (response.ok) {
        setProviderContracts(data.contracts || []);
      }
    } catch (error) {
      console.error('Error al cargar contratos del prestador:', error);
    } finally {
      setLoadingContracts(false);
    }
  };

  useEffect(() => {
    fetchProviderData();
    fetchProviderContracts();
  }, []);

  const handleAddCompliance = async (e) => {
    e.preventDefault();
    if (!specialty.trim()) return;
    setLoadingAction(true);
    setFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          specialty: specialty.trim(),
          criminal_record_url: criminalRecordUrl.trim() || null,
          insurance_policy_url: insurancePolicyUrl.trim() || null
        })
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({ type: 'success', text: data.message || 'Perfil profesional guardado.' });
        setSpecialty('');
        setCriminalRecordUrl('');
        setInsurancePolicyUrl('');
        await fetchProviderData();
      } else {
        setFeedback({ type: 'error', text: data.error || 'No se pudo guardar el perfil.' });
      }
    } catch (error) {
      console.error('Error al guardar perfil:', error);
      setFeedback({ type: 'error', text: 'Error de conexión con el servidor.' });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSaveEditProfile = async (profileId) => {
    setLoadingAction(true);
    setFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/profile/${profileId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          specialty: editSpecialty.trim(),
          criminal_record_url: editCriminalUrl.trim() || null,
          insurance_policy_url: editInsuranceUrl.trim() || null
        })
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({ type: 'success', text: data.message || 'Perfil actualizado.' });
        setEditingProfileId(null);
        await fetchProviderData();
      } else {
        setFeedback({ type: 'error', text: data.error || 'No se pudo actualizar.' });
      }
    } catch (error) {
      console.error('Error al editar perfil:', error);
      setFeedback({ type: 'error', text: 'Error de conexión.' });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleAddVehicle = async (e) => {
    e.preventDefault();
    if (!plate.trim()) return;
    setLoadingAction(true);
    setFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/vehicle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          vehicle_type: vehicleType,
          brand: brandName.trim(),
          model: modelName.trim(),
          color: colorName.trim(),
          plate: plate.trim().toUpperCase()
        })
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({ type: 'success', text: data.message || 'Vehículo registrado.' });
        setBrandName('');
        setModelName('');
        setColorName('');
        setPlate('');
        await fetchProviderData();
      } else {
        setFeedback({ type: 'error', text: data.error || 'No se pudo registrar el vehículo.' });
      }
    } catch (error) {
      console.error('Error al agregar vehículo:', error);
      setFeedback({ type: 'error', text: 'Error de conexión.' });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSaveEditVehicle = async (vehicleId) => {
    setLoadingAction(true);
    setFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/vehicle/${vehicleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          vehicle_type: editVehicleType,
          brand: editBrand.trim(),
          model: editModel.trim(),
          color: editColor.trim(),
          plate: editPlate.trim().toUpperCase()
        })
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({ type: 'success', text: data.message || 'Vehículo actualizado.' });
        setEditingVehicleId(null);
        await fetchProviderData();
      } else {
        setFeedback({ type: 'error', text: data.error || 'No se pudo actualizar.' });
      }
    } catch (error) {
      console.error('Error al editar vehículo:', error);
      setFeedback({ type: 'error', text: 'Error de conexión.' });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSubmitOwnerReview = async (contractId) => {
    const selectedRating = ownerRatingDrafts[contractId] || 5;
    const commentText = (ownerCommentDrafts[contractId] || '').trim();

    setSubmittingReviewId(contractId);
    setCrossReviewFeedback(null);
    try {
      const response = await fetch(`${API_BASE}/api/v1/reviews/owner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          contract_id: contractId,
          rating: selectedRating,
          comment: commentText || null
        })
      });
      const data = await response.json();
      if (response.ok) {
        setCrossReviewFeedback({
          type: 'success',
          message: data.message || 'Calificación al residente registrada correctamente.'
        });
        await fetchProviderContracts();
      } else {
        setCrossReviewFeedback({
          type: 'error',
          message: data.error || 'No se pudo registrar la calificación.'
        });
      }
    } catch (error) {
      console.error('Error al enviar reseña al residente:', error);
      setCrossReviewFeedback({
        type: 'error',
        message: 'Error de conexión al guardar la calificación.'
      });
    } finally {
      setSubmittingReviewId(null);
    }
  };

  return (
    <div className="flex-1 bg-slate-900 text-slate-100 font-sans p-6 md:p-8">
      <main className="max-w-6xl mx-auto space-y-6">
        {/* Cabecera */}
        <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-xl text-white shadow-lg"
              style={{ backgroundColor: brand.primaryColor || '#10b981' }}
            >
              <Wrench size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Portal Prestador Verificado</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Gestión de credenciales de compliance, flota vehicular y reputación cruzada.
              </p>
            </div>
          </div>
          {providerProfiles.length > 0 && (
            <span className="text-amber-300 font-bold text-xs bg-amber-950/60 border border-amber-800 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <Star size={14} className="fill-amber-400" />
              Scoring Global: {Number(providerProfiles[0].rating_avg || 0).toFixed(2)}
            </span>
          )}
        </div>

        {feedback.text && (
          <div
            className={`p-4 rounded-xl text-xs border flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                : 'bg-rose-950/60 border-rose-800 text-rose-200'
            }`}
          >
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Sección 1: Compliance */}
        <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-5">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Perfiles Profesionales &amp; Compliance</h3>
          </div>

          <form onSubmit={handleAddCompliance} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="text"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="Especialidad (ej: Electricista Matriculado)"
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              value={criminalRecordUrl}
              onChange={(e) => setCriminalRecordUrl(e.target.value)}
              placeholder="URL Certificado Antecedentes"
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              value={insurancePolicyUrl}
              onChange={(e) => setInsurancePolicyUrl(e.target.value)}
              placeholder="URL Póliza ART / Seguro"
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={loadingAction || !specialty.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 cursor-pointer"
            >
              <Plus size={14} /> Agregar Perfil
            </button>
          </form>

          {fetching ? (
            <div className="text-center py-6 text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" size={15} /> Cargando perfiles...
            </div>
          ) : providerProfiles.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500">
              No tenés perfiles cargados aún.
            </div>
          ) : (
            <div className="space-y-3">
              {providerProfiles.map((prof) => {
                const isEditing = editingProfileId === prof.id;
                return (
                  <div
                    key={prof.id}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs"
                  >
                    {isEditing ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 w-full">
                        <input
                          type="text"
                          value={editSpecialty}
                          onChange={(e) => setEditSpecialty(e.target.value)}
                          className="px-3 py-1.5 rounded-lg bg-slate-950 border border-emerald-600 text-white"
                        />
                        <input
                          type="text"
                          value={editCriminalUrl}
                          onChange={(e) => setEditCriminalUrl(e.target.value)}
                          placeholder="URL Antecedentes"
                          className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white"
                        />
                        <input
                          type="text"
                          value={editInsuranceUrl}
                          onChange={(e) => setEditInsuranceUrl(e.target.value)}
                          placeholder="URL ART"
                          className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white"
                        />
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{prof.specialty}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                            {prof.status}
                          </span>
                        </div>
                        <p className="text-slate-400 mt-1">
                          Antecedentes: {prof.criminal_record_url || 'No cargado'} · ART:{' '}
                          {prof.insurance_policy_url || 'No cargado'}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSaveEditProfile(prof.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold cursor-pointer"
                          >
                            <Save size={12} /> Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingProfileId(null)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 cursor-pointer"
                          >
                            <X size={12} /> Cancelar
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProfileId(prof.id);
                            setEditSpecialty(prof.specialty || '');
                            setEditCriminalUrl(prof.criminal_record_url || '');
                            setEditInsuranceUrl(prof.insurance_policy_url || '');
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                        >
                          <Edit3 size={12} /> Editar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sección 2: Flota Vehicular */}
        <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-5">
          <div className="flex items-center gap-2">
            <Car size={18} className="text-sky-400" />
            <h3 className="text-sm font-bold text-white">Flota Vehicular Habilitada</h3>
          </div>

          <form onSubmit={handleAddVehicle} className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            >
              <option value="Utilitario">Utilitario</option>
              <option value="Automóvil">Automóvil</option>
              <option value="Camioneta">Camioneta</option>
              <option value="Moto">Moto</option>
            </select>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Marca"
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500"
            />
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="Modelo"
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500"
            />
            <input
              type="text"
              value={colorName}
              onChange={(e) => setColorName(e.target.value)}
              placeholder="Color"
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500"
            />
            <input
              type="text"
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder="Patente (ej: AF123CD)"
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 uppercase"
            />
            <button
              type="submit"
              disabled={loadingAction || !plate.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50 cursor-pointer"
            >
              <Plus size={14} /> Registrar
            </button>
          </form>

          {vehicles.length === 0 ? (
            <div className="text-center py-4 text-xs text-slate-500">Sin vehículos registrados.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {vehicles.map((veh) => {
                const isEditingVeh = editingVehicleId === veh.id;
                return (
                  <div
                    key={veh.id}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex justify-between items-center gap-3 text-xs"
                  >
                    {isEditingVeh ? (
                      <div className="grid grid-cols-2 gap-2 w-full">
                        <input
                          type="text"
                          value={editVehicleType}
                          onChange={(e) => setEditVehicleType(e.target.value)}
                          className="px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-white"
                        />
                        <input
                          type="text"
                          value={editPlate}
                          onChange={(e) => setEditPlate(e.target.value)}
                          className="px-2.5 py-1 rounded bg-slate-950 border border-sky-600 font-mono text-white uppercase"
                        />
                        <input
                          type="text"
                          value={editBrand}
                          onChange={(e) => setEditBrand(e.target.value)}
                          className="px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-white"
                        />
                        <input
                          type="text"
                          value={editModel}
                          onChange={(e) => setEditModel(e.target.value)}
                          className="px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-white"
                        />
                      </div>
                    ) : (
                      <div>
                        <span className="font-mono font-bold text-sky-300 bg-sky-950/70 border border-sky-800 px-2 py-0.5 rounded">
                          {veh.plate}
                        </span>
                        <span className="ml-2 font-semibold text-white">
                          {veh.vehicle_type} · {veh.brand} {veh.model}
                        </span>
                        <span className="text-slate-400 ml-1">({veh.color || 'Sin color'})</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1 shrink-0">
                      {isEditingVeh ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSaveEditVehicle(veh.id)}
                            className="px-2.5 py-1 rounded bg-emerald-600 text-white font-bold cursor-pointer"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingVehicleId(null)}
                            className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVehicleId(veh.id);
                            setEditVehicleType(veh.vehicle_type || '');
                            setEditBrand(veh.brand || '');
                            setEditModel(veh.model || '');
                            setEditColor(veh.color || '');
                            setEditPlate(veh.plate || '');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                        >
                          <Edit3 size={12} /> Editar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sección 3: Reputación Cruzada (Servicios y Calificación a Residentes) */}
        <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <Star size={18} className="text-amber-400" />
              <div>
                <h3 className="text-sm font-bold text-white">
                  Servicios Realizados &amp; Reputación Cruzada
                </h3>
                <p className="text-xs text-slate-400">
                  Visualizá las reseñas recibidas de residentes y calificá tu experiencia en cada domicilio.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {providerContracts.length} servicio(s)
            </span>
          </div>

          {crossReviewFeedback && (
            <div
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs border ${
                crossReviewFeedback.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-800 text-rose-200'
              }`}
            >
              {crossReviewFeedback.type === 'success' ? (
                <CheckCircle2 size={15} />
              ) : (
                <AlertCircle size={15} />
              )}
              <span>{crossReviewFeedback.message}</span>
            </div>
          )}

          {loadingContracts ? (
            <div className="text-center py-6 text-xs text-slate-400">
              Cargando servicios y calificaciones cruzadas...
            </div>
          ) : providerContracts.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500">
              Aún no tenés contratos asignados en tu historial.
            </div>
          ) : (
            <div className="space-y-4">
              {providerContracts.map((item) => {
                const draftRating = ownerRatingDrafts[item.contract_id] || 5;
                const draftComment = ownerCommentDrafts[item.contract_id] || '';
                const alreadyRatedOwner = Boolean(item.owner_review_id);

                return (
                  <div
                    key={item.contract_id}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-emerald-400">
                          Contrato #{item.contract_id}
                        </span>{' '}
                        ·{' '}
                        <span className="font-semibold text-white">
                          Residente:{' '}
                          {`${item.owner_first_name || ''} ${item.owner_last_name || ''}`.trim() ||
                            'Propietario'}
                        </span>{' '}
                        <span className="text-slate-400">({item.country_name || 'Comunidad'})</span>
                        <p className="text-slate-400 mt-1">{item.description}</p>
                      </div>
                      <span className="font-mono text-slate-200 bg-slate-950 border border-slate-800 px-3 py-1 rounded-lg self-start">
                        ${Number(item.agreed_amount || 0).toLocaleString('es-AR')}
                      </span>
                    </div>

                    {item.provider_review_rating && (
                      <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-emerald-300">
                          Reseña recibida del residente: {'★'.repeat(item.provider_review_rating)} (
                          {item.provider_review_rating}/5)
                        </span>
                        {item.provider_review_comment && (
                          <span className="text-slate-300 italic">"{item.provider_review_comment}"</span>
                        )}
                      </div>
                    )}

                    {alreadyRatedOwner ? (
                      <div className="bg-slate-950 border border-indigo-900/60 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-indigo-300">
                          Tu calificación al residente: {'★'.repeat(item.owner_review_rating)} (
                          {item.owner_review_rating}/5)
                        </span>
                        {item.owner_review_comment && (
                          <span className="text-slate-300 italic">"{item.owner_review_comment}"</span>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-slate-300 font-semibold">
                            Calificar experiencia con el residente / acceso:
                          </span>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((starVal) => (
                              <button
                                key={starVal}
                                type="button"
                                onClick={() =>
                                  setOwnerRatingDrafts((prev) => ({
                                    ...prev,
                                    [item.contract_id]: starVal
                                  }))
                                }
                                className={`p-1 rounded-lg border cursor-pointer ${
                                  draftRating >= starVal
                                    ? 'bg-amber-950/70 border-amber-700 text-amber-300'
                                    : 'bg-slate-900 border-slate-800 text-slate-500'
                                }`}
                              >
                                <Star
                                  size={13}
                                  className={draftRating >= starVal ? 'fill-amber-400' : ''}
                                />
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="relative flex-1">
                            <MessageSquare
                              size={13}
                              className="text-slate-500 absolute left-3 top-1/2 -translate-y-1/2"
                            />
                            <input
                              type="text"
                              value={draftComment}
                              onChange={(e) =>
                                setOwnerCommentDrafts((prev) => ({
                                  ...prev,
                                  [item.contract_id]: e.target.value
                                }))
                              }
                              placeholder="Comentario sobre trato, claridad del trabajo y acceso al barrio..."
                              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSubmitOwnerReview(item.contract_id)}
                            disabled={submittingReviewId === item.contract_id}
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 cursor-pointer"
                          >
                            <Send size={12} />
                            {submittingReviewId === item.contract_id
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
        </div>
      </main>
    </div>
  );
}