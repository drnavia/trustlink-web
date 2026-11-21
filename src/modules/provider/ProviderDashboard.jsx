/**
 * @file ProviderDashboard.jsx
 * @description Portal del Prestador conectado 100% a PostgreSQL. Gestiona credenciales de compliance,
 * flota vehicular habilitada (con validación de patente) y calificaciones cruzadas con residentes,
 * respetando de forma homogénea las Zonas 3, 4 y 5 de apariencia.
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

/**
 * Traduce el estado de compliance a una etiqueta limpia en español.
 * @param {string} status
 * @returns {{ label: string, badgeClass: string }}
 */
function formatComplianceStatus(status) {
  const normalized = (status || 'pending').toLowerCase();
  if (normalized === 'approved') {
    return {
      label: 'Aprobado',
      badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
    };
  }
  if (normalized === 'rejected') {
    return {
      label: 'Rechazado',
      badgeClass: 'bg-rose-950/80 text-rose-300 border-rose-800',
    };
  }
  return {
    label: 'Pendiente',
    badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-800',
  };
}

export default function ProviderDashboard() {
  const { brand } = useBranding();

  // Zona 4: Tarjetas principales
  const cardStyle = {
    backgroundColor: brand?.cardBgColor || '#020617',
    color: brand?.cardTextColor || '#F1F5F9',
  };

  // Zona 5: Cajas internas, inputs y contenedores secundarios
  const innerStyle = {
    backgroundColor: brand?.innerBgColor || '#0F172A',
    color: brand?.innerTextColor || '#F1F5F9',
  };

  // Color principal / de acento configurado en marca
  const primaryActionColor = brand?.accentColor || brand?.primaryColor || '#10b981';

  const [providerProfiles, setProviderProfiles] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Campos para nuevo perfil / credencial de compliance
  const [specialty, setSpecialty] = useState('');
  const [criminalRecordUrl, setCriminalRecordUrl] = useState('');
  const [insurancePolicyUrl, setInsurancePolicyUrl] = useState('');

  // Campos para edición completa de credencial
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [editSpecialty, setEditSpecialty] = useState('');
  const [editCriminalUrl, setEditCriminalUrl] = useState('');
  const [editInsuranceUrl, setEditInsuranceUrl] = useState('');

  // Campos para nuevo vehículo
  const [vehicleType, setVehicleType] = useState('Utilitario');
  const [brandName, setBrandName] = useState('');
  const [modelName, setModelName] = useState('');
  const [colorName, setColorName] = useState('');
  const [plate, setPlate] = useState('');

  // Campos para edición completa de vehículo
  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [editVehicleType, setEditVehicleType] = useState('Utilitario');
  const [editBrand, setEditBrand] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editPlate, setEditPlate] = useState('');

  // Reputación cruzada en contratos realizados
  const [providerContracts, setProviderContracts] = useState([]);
  const [loadingContracts, setLoadingContracts] = useState(true);
  const [ownerRatingDrafts, setOwnerRatingDrafts] = useState({});
  const [ownerCommentDrafts, setOwnerCommentDrafts] = useState({});
  const [submittingReviewId, setSubmittingReviewId] = useState(null);
  const [crossReviewFeedback, setCrossReviewFeedback] = useState(null);

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
  });

  const fetchProviderData = async () => {
    setFetching(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/me`, {
        headers: getAuthHeaders(),
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
        headers: getAuthHeaders(),
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
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          specialty: specialty.trim(),
          criminal_record_url: criminalRecordUrl.trim() || null,
          insurance_policy_url: insurancePolicyUrl.trim() || null,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({ type: 'success', text: data.message || 'Credencial agregada.' });
        setSpecialty('');
        setCriminalRecordUrl('');
        setInsurancePolicyUrl('');
        await fetchProviderData();
      } else {
        setFeedback({ type: 'error', text: data.error || 'No se pudo guardar la credencial.' });
      }
    } catch (error) {
      console.error('Error al guardar credencial:', error);
      setFeedback({ type: 'error', text: 'Error de conexión con el servidor.' });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSaveEditProfile = async (profileId) => {
    if (!editSpecialty.trim()) return;
    setLoadingAction(true);
    setFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/profile/${profileId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          specialty: editSpecialty.trim(),
          criminal_record_url: editCriminalUrl.trim() || null,
          insurance_policy_url: editInsuranceUrl.trim() || null,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({ type: 'success', text: data.message || 'Credencial actualizada.' });
        setEditingProfileId(null);
        await fetchProviderData();
      } else {
        setFeedback({ type: 'error', text: data.error || 'No se pudo actualizar.' });
      }
    } catch (error) {
      console.error('Error al editar credencial:', error);
      setFeedback({ type: 'error', text: 'Error de conexión.' });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleAddVehicle = async (e) => {
    e.preventDefault();
    if (!plate.trim()) {
      setFeedback({ type: 'error', text: 'La patente del vehículo es obligatoria.' });
      return;
    }
    setLoadingAction(true);
    setFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/vehicle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          vehicle_type: vehicleType,
          brand: brandName.trim(),
          model: modelName.trim(),
          color: colorName.trim(),
          plate: plate.trim().toUpperCase(),
        }),
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
    if (!editPlate.trim()) {
      setFeedback({ type: 'error', text: 'La patente del vehículo no puede quedar vacía.' });
      return;
    }
    setLoadingAction(true);
    setFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/vehicle/${vehicleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          vehicle_type: editVehicleType,
          brand: editBrand.trim(),
          model: editModel.trim(),
          color: editColor.trim(),
          plate: editPlate.trim().toUpperCase(),
        }),
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
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          contract_id: contractId,
          rating: selectedRating,
          comment: commentText || null,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setCrossReviewFeedback({
          type: 'success',
          message: data.message || 'Calificación al residente registrada correctamente.',
        });
        await fetchProviderContracts();
      } else {
        setCrossReviewFeedback({
          type: 'error',
          message: data.error || 'No se pudo registrar la calificación.',
        });
      }
    } catch (error) {
      console.error('Error al enviar reseña al residente:', error);
      setCrossReviewFeedback({
        type: 'error',
        message: 'Error de conexión al guardar la calificación.',
      });
    } finally {
      setSubmittingReviewId(null);
    }
  };

  const primaryStatusInfo = formatComplianceStatus(providerProfiles[0]?.status);

  return (
    <div className="p-6 md:p-8 flex-1">
      <main className="max-w-6xl mx-auto space-y-6">
        {/* Cabecera del Portal Prestador */}
        <div
          className="border border-black/20 p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
          style={cardStyle}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="p-3 rounded-xl border border-white/15 text-emerald-400 shrink-0"
              style={innerStyle}
            >
              <Wrench size={20} strokeWidth={1.8} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">Portal Prestador</h2>
              <p className="text-xs opacity-80 mt-0.5">
                Credenciales de compliance, flota vehicular y reputación cruzada.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {providerProfiles.length > 0 && (
              <span className="text-amber-300 font-bold text-xs bg-amber-950/60 border border-amber-800 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <Star size={14} className="fill-amber-400" />
                Scoring: {Number(providerProfiles[0].rating_avg || 0).toFixed(2)}
              </span>
            )}
            <span
              className={`text-xs font-semibold px-3 py-1.5 rounded-xl border ${primaryStatusInfo.badgeClass}`}
            >
              Estado: {primaryStatusInfo.label}
            </span>
          </div>
        </div>

        {/* Feedback global de acciones */}
        {feedback.text && (
          <div
            className={`p-4 rounded-xl text-xs border flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                : 'bg-rose-950/60 border-rose-800 text-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Bloques principales: Credenciales y Flota Vehicular */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Credenciales y Compliance */}
          <div
            className="border border-black/20 p-6 rounded-2xl shadow-sm space-y-5"
            style={cardStyle}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-400" />
                <h3 className="text-sm font-bold">Credenciales y Compliance</h3>
              </div>
              <span className="text-[11px] font-mono opacity-80">
                {providerProfiles.length} registro(s)
              </span>
            </div>

            <form onSubmit={handleAddCompliance} className="space-y-3">
              <input
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="Especialidad (ej: Electricista Matriculado)"
                className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                style={innerStyle}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={criminalRecordUrl}
                  onChange={(e) => setCriminalRecordUrl(e.target.value)}
                  placeholder="URL Certificado Antecedentes"
                  className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                  style={innerStyle}
                />
                <input
                  type="text"
                  value={insurancePolicyUrl}
                  onChange={(e) => setInsurancePolicyUrl(e.target.value)}
                  placeholder="URL Póliza ART / Seguro"
                  className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                  style={innerStyle}
                />
              </div>
              <button
                type="submit"
                disabled={loadingAction || !specialty.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 cursor-pointer transition-opacity hover:opacity-95"
                style={{ backgroundColor: primaryActionColor }}
              >
                <Plus size={14} /> Agregar Credencial
              </button>
            </form>

            {fetching ? (
              <div className="text-center py-6 text-xs opacity-80 flex items-center justify-center gap-2">
                <Loader2 className="animate-spin" size={15} /> Cargando credenciales...
              </div>
            ) : providerProfiles.length === 0 ? (
              <div className="text-center py-6 text-xs opacity-75">
                No tenés credenciales cargadas aún.
              </div>
            ) : (
              <div className="space-y-3">
                {providerProfiles.map((prof) => {
                  const isEditing = editingProfileId === prof.id;
                  const profStatus = formatComplianceStatus(prof.status);
                  return (
                    <div
                      key={prof.id}
                      className="p-4 rounded-xl border border-black/20 space-y-3 text-xs"
                      style={innerStyle}
                    >
                      {isEditing ? (
                        <div className="space-y-2.5">
                          <input
                            type="text"
                            value={editSpecialty}
                            onChange={(e) => setEditSpecialty(e.target.value)}
                            placeholder="Especialidad"
                            className="w-full px-3 py-1.5 rounded-lg border border-white/15 focus:outline-none"
                            style={cardStyle}
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={editCriminalUrl}
                              onChange={(e) => setEditCriminalUrl(e.target.value)}
                              placeholder="URL Certificado Antecedentes"
                              className="w-full px-3 py-1.5 rounded-lg border border-white/15 focus:outline-none"
                              style={cardStyle}
                            />
                            <input
                              type="text"
                              value={editInsuranceUrl}
                              onChange={(e) => setEditInsuranceUrl(e.target.value)}
                              placeholder="URL Póliza ART / Seguro"
                              className="w-full px-3 py-1.5 rounded-lg border border-white/15 focus:outline-none"
                              style={cardStyle}
                            />
                          </div>
                          <div className="flex justify-end gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => handleSaveEditProfile(prof.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-white font-bold cursor-pointer"
                              style={{ backgroundColor: primaryActionColor }}
                            >
                              <Save size={12} /> Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingProfileId(null)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/15 opacity-85 cursor-pointer"
                              style={cardStyle}
                            >
                              <X size={12} /> Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold">{prof.specialty}</span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${profStatus.badgeClass}`}
                              >
                                {profStatus.label}
                              </span>
                            </div>
                            <p className="opacity-80 mt-1 break-all">
                              Antecedentes: {prof.criminal_record_url || 'No cargado'} · ART:{' '}
                              {prof.insurance_policy_url || 'No cargado'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProfileId(prof.id);
                              setEditSpecialty(prof.specialty || '');
                              setEditCriminalUrl(prof.criminal_record_url || '');
                              setEditInsuranceUrl(prof.insurance_policy_url || '');
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/15 cursor-pointer shrink-0 hover:opacity-90"
                            style={cardStyle}
                          >
                            <Edit3 size={12} /> Editar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Flota Vehicular Habilitada */}
          <div
            className="border border-black/20 p-6 rounded-2xl shadow-sm space-y-5"
            style={cardStyle}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Car size={18} className="text-sky-400" />
                <h3 className="text-sm font-bold">Flota Vehicular Habilitada</h3>
              </div>
              <span className="text-[11px] font-mono opacity-80">
                {vehicles.length} vehículo(s)
              </span>
            </div>

            <form onSubmit={handleAddVehicle} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                  style={innerStyle}
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
                  placeholder="Marca (ej: Ford)"
                  className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                  style={innerStyle}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="Modelo (ej: Fiorino)"
                  className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                  style={innerStyle}
                />
                <input
                  type="text"
                  value={colorName}
                  onChange={(e) => setColorName(e.target.value)}
                  placeholder="Color (ej: Blanco)"
                  className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                  style={innerStyle}
                />
                <input
                  type="text"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value)}
                  placeholder="Patente (ej: AF123CD)"
                  className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs font-mono uppercase focus:outline-none"
                  style={innerStyle}
                />
              </div>

              <button
                type="submit"
                disabled={loadingAction || !plate.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 cursor-pointer transition-opacity hover:opacity-95"
                style={{ backgroundColor: primaryActionColor }}
              >
                <Plus size={14} /> Registrar Vehículo
              </button>
            </form>

            {vehicles.length === 0 ? (
              <div className="text-center py-4 text-xs opacity-75">Sin vehículos registrados.</div>
            ) : (
              <div className="space-y-3">
                {vehicles.map((veh) => {
                  const isEditingVeh = editingVehicleId === veh.id;
                  const cleanPlate = (veh.plate || '').trim();
                  return (
                    <div
                      key={veh.id}
                      className="p-4 rounded-xl border border-black/20 flex justify-between items-start gap-3 text-xs"
                      style={innerStyle}
                    >
                      {isEditingVeh ? (
                        <div className="space-y-2.5 w-full">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <select
                              value={editVehicleType}
                              onChange={(e) => setEditVehicleType(e.target.value)}
                              className="px-2.5 py-1.5 rounded-lg border border-white/15"
                              style={cardStyle}
                            >
                              <option value="Utilitario">Utilitario</option>
                              <option value="Automóvil">Automóvil</option>
                              <option value="Camioneta">Camioneta</option>
                              <option value="Moto">Moto</option>
                            </select>
                            <input
                              type="text"
                              value={editBrand}
                              onChange={(e) => setEditBrand(e.target.value)}
                              placeholder="Marca"
                              className="px-2.5 py-1.5 rounded-lg border border-white/15"
                              style={cardStyle}
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              type="text"
                              value={editModel}
                              onChange={(e) => setEditModel(e.target.value)}
                              placeholder="Modelo"
                              className="px-2.5 py-1.5 rounded-lg border border-white/15"
                              style={cardStyle}
                            />
                            <input
                              type="text"
                              value={editColor}
                              onChange={(e) => setEditColor(e.target.value)}
                              placeholder="Color"
                              className="px-2.5 py-1.5 rounded-lg border border-white/15"
                              style={cardStyle}
                            />
                            <input
                              type="text"
                              value={editPlate}
                              onChange={(e) => setEditPlate(e.target.value)}
                              placeholder="Patente"
                              className="px-2.5 py-1.5 rounded-lg border border-white/15 font-mono uppercase"
                              style={cardStyle}
                            />
                          </div>
                          <div className="flex justify-end gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => handleSaveEditVehicle(veh.id)}
                              className="px-2.5 py-1 rounded-lg text-white font-bold cursor-pointer"
                              style={{ backgroundColor: primaryActionColor }}
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingVehicleId(null)}
                              className="px-2.5 py-1 rounded-lg border border-white/15 opacity-85 cursor-pointer"
                              style={cardStyle}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold">
                                {veh.brand} {veh.model}
                              </span>
                              <span className="text-[10px] font-bold uppercase text-sky-300 bg-sky-950/70 border border-sky-800 px-2 py-0.5 rounded">
                                {veh.vehicle_type || 'Vehículo'}
                              </span>
                            </div>
                            <p className="opacity-80 mt-1">
                              Color: {veh.color || 'No especificado'} · Patente:{' '}
                              {cleanPlate ? (
                                <strong className="text-sky-300 font-mono">{cleanPlate}</strong>
                              ) : (
                                <strong className="text-amber-400">Sin patente</strong>
                              )}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingVehicleId(veh.id);
                              setEditVehicleType(veh.vehicle_type || 'Utilitario');
                              setEditBrand(veh.brand || '');
                              setEditModel(veh.model || '');
                              setEditColor(veh.color || '');
                              setEditPlate(veh.plate || '');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/15 cursor-pointer shrink-0 hover:opacity-90"
                            style={cardStyle}
                          >
                            <Edit3 size={12} /> Editar
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Servicios Realizados & Reputación Cruzada */}
        <div
          className="border border-black/20 p-6 rounded-2xl shadow-sm space-y-5"
          style={cardStyle}
        >
          <div className="flex items-center justify-between border-b border-black/20 pb-4">
            <div className="flex items-center gap-2.5">
              <Star size={18} className="text-amber-400" />
              <div>
                <h3 className="text-sm font-bold">
                  Servicios Realizados &amp; Reputación Cruzada
                </h3>
                <p className="text-xs opacity-80">
                  Visualizá las reseñas recibidas de residentes y calificá tu experiencia en cada domicilio.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono opacity-80">
              {providerContracts.length} contrato(s)
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
            <div className="text-center py-6 text-xs opacity-80">
              Cargando servicios y calificaciones cruzadas...
            </div>
          ) : providerContracts.length === 0 ? (
            <div className="text-center py-6 text-xs opacity-75">
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
                    className="p-4 rounded-xl border border-black/20 space-y-3 text-xs"
                    style={innerStyle}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-emerald-400">
                          Contrato #{item.contract_id}
                        </span>{' '}
                        ·{' '}
                        <span className="font-semibold">
                          Residente:{' '}
                          {`${item.owner_first_name || ''} ${item.owner_last_name || ''}`.trim() ||
                            'Propietario'}
                        </span>{' '}
                        <span className="opacity-75">({item.country_name || 'Comunidad'})</span>
                        <p className="opacity-80 mt-1">{item.description}</p>
                      </div>
                      <span
                        className="font-mono border border-white/15 px-3 py-1 rounded-lg self-start"
                        style={cardStyle}
                      >
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
                          <span className="opacity-90 italic">
                            "{item.provider_review_comment}"
                          </span>
                        )}
                      </div>
                    )}

                    {alreadyRatedOwner ? (
                      <div
                        className="border border-white/15 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2"
                        style={cardStyle}
                      >
                        <span className="font-semibold text-indigo-300">
                          Tu calificación al residente: {'★'.repeat(item.owner_review_rating)} (
                          {item.owner_review_rating}/5)
                        </span>
                        {item.owner_review_comment && (
                          <span className="opacity-90 italic">"{item.owner_review_comment}"</span>
                        )}
                      </div>
                    ) : (
                      <div
                        className="border border-black/20 rounded-lg p-3.5 space-y-2.5"
                        style={cardStyle}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="opacity-90 font-semibold">
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
                                    [item.contract_id]: starVal,
                                  }))
                                }
                                className={`p-1 rounded-lg border cursor-pointer ${
                                  draftRating >= starVal
                                    ? 'bg-amber-950/70 border-amber-700 text-amber-300'
                                    : 'border-white/15 opacity-60'
                                }`}
                                style={draftRating >= starVal ? undefined : innerStyle}
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
                              className="opacity-60 absolute left-3 top-1/2 -translate-y-1/2"
                            />
                            <input
                              type="text"
                              value={draftComment}
                              onChange={(e) =>
                                setOwnerCommentDrafts((prev) => ({
                                  ...prev,
                                  [item.contract_id]: e.target.value,
                                }))
                              }
                              placeholder="Comentario sobre trato, claridad del trabajo y acceso al barrio..."
                              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-white/15 text-xs focus:outline-none"
                              style={innerStyle}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSubmitOwnerReview(item.contract_id)}
                            disabled={submittingReviewId === item.contract_id}
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50 cursor-pointer transition-opacity hover:opacity-95"
                            style={{ backgroundColor: primaryActionColor }}
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