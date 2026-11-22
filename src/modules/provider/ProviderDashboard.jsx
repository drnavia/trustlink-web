/**
 * @file ProviderDashboard.jsx
 * @description Portal del Prestador conectado 100% a PostgreSQL mediante API REST.
 * Organiza la operación en 3 pasos clicables superiores (1. Credenciales, 2. Flota Vehicular,
 * 3. Reputación Cruzada). En Credenciales presenta un formulario compacto de Documentación Personal
 * (Antecedentes Penales y Póliza ART/Seguro con vigencia Desde/Hasta), un historial en filas por
 * persona con vigencia por fecha, estado de validación de TrustLink y edición, y la columna de
 * Especialidades y Credenciales. Aplica las Zonas 4 y 5 de apariencia.
 * @location /trustlink-web/src/modules/provider/ProviderDashboard.jsx
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  RefreshCw,
  Award,
  FileText,
  History
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';

const API_BASE = 'http://localhost:4000';

/**
 * Traduce el estado de validación de TrustLink a etiqueta y estilo en español.
 * @param {string} status
 * @returns {{ label: string, badgeClass: string }}
 */
function formatTrustlinkValidationStatus(status) {
  const normalized = (status || 'pending').toLowerCase();
  if (normalized === 'approved') {
    return {
      label: 'Validado TrustLink: Aprobado',
      badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
    };
  }
  if (normalized === 'rejected') {
    return {
      label: 'Validado TrustLink: Rechazado',
      badgeClass: 'bg-rose-950/80 text-rose-300 border-rose-800',
    };
  }
  return {
    label: 'Validado TrustLink: Pendiente',
    badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-800',
  };
}

/**
 * Traduce el estado de especialidad de forma concisa.
 * @param {string} status
 * @returns {{ label: string, badgeClass: string }}
 */
function formatSpecialtyStatus(status) {
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

/**
 * Normaliza un valor de fecha a formato YYYY-MM-DD para inputs tipo date.
 * @param {string|null|undefined} dateStr
 * @returns {string}
 */
function toDateInputValue(dateStr) {
  if (!dateStr) return '';
  const raw = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

/**
 * Formatea una fecha YYYY-MM-DD o ISO a DD/MM/AAAA.
 * @param {string|null|undefined} dateStr
 * @returns {string}
 */
function formatDisplayDate(dateStr) {
  const isoDate = toDateInputValue(dateStr);
  if (!isoDate) return 'Sin fecha';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Evalúa la vigencia de un documento según las fechas Desde / Hasta.
 * @param {string|null|undefined} fromStr
 * @param {string|null|undefined} untilStr
 * @returns {{ label: string, badgeClass: string }}
 */
function resolveDateValidity(fromStr, untilStr) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const fromIso = toDateInputValue(fromStr);
  const untilIso = toDateInputValue(untilStr);

  if (untilIso && untilIso < todayIso) {
    return {
      label: 'Vencido',
      badgeClass: 'bg-rose-950/80 text-rose-300 border-rose-800',
    };
  }
  if (fromIso && fromIso > todayIso) {
    return {
      label: 'Vigencia futura',
      badgeClass: 'bg-sky-950/80 text-sky-300 border-sky-800',
    };
  }
  if (fromIso || untilIso) {
    return {
      label: 'Vigente',
      badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
    };
  }
  return {
    label: 'Sin vigencia',
    badgeClass: 'bg-slate-800/80 text-slate-300 border-slate-700',
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

  const primaryActionColor = brand?.accentColor || brand?.primaryColor || '#10b981';

  // Paso activo: 'credentials' | 'vehicles' | 'reviews'
  const [activeStep, setActiveStep] = useState('credentials');

  const [providerProfiles, setProviderProfiles] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [savingDocs, setSavingDocs] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Documentación Personal (Antecedentes + ART/Seguro con vigencias Desde/Hasta)
  const [criminalRecordUrl, setCriminalRecordUrl] = useState('');
  const [criminalFromDate, setCriminalFromDate] = useState('');
  const [criminalUntilDate, setCriminalUntilDate] = useState('');
  const [insurancePolicyUrl, setInsurancePolicyUrl] = useState('');
  const [insuranceFromDate, setInsuranceFromDate] = useState('');
  const [insuranceUntilDate, setInsuranceUntilDate] = useState('');

  // Especialidades / Credenciales
  const [specialty, setSpecialty] = useState('');
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [editSpecialty, setEditSpecialty] = useState('');

  // Flota vehicular
  const [vehicleType, setVehicleType] = useState('Utilitario');
  const [brandName, setBrandName] = useState('');
  const [modelName, setModelName] = useState('');
  const [colorName, setColorName] = useState('');
  const [plate, setPlate] = useState('');

  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [editVehicleType, setEditVehicleType] = useState('Utilitario');
  const [editBrand, setEditBrand] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editPlate, setEditPlate] = useState('');

  // Reputación cruzada
  const [providerContracts, setProviderContracts] = useState([]);
  const [loadingContracts, setLoadingContracts] = useState(true);
  const [ownerRatingDrafts, setOwnerRatingDrafts] = useState({});
  const [ownerCommentDrafts, setOwnerCommentDrafts] = useState({});
  const [submittingReviewId, setSubmittingReviewId] = useState(null);
  const [crossReviewFeedback, setCrossReviewFeedback] = useState(null);

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
  });

  const fetchProviderData = useCallback(async () => {
    setFetching(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/me`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        const list = data.providers || [];
        setProviderProfiles(list);
        setVehicles(data.vehicles || []);

        const withDocs =
          list.find((p) => p.criminal_record_url || p.insurance_policy_url) || list[0];
        if (withDocs) {
          setCriminalRecordUrl(withDocs.criminal_record_url || '');
          setCriminalFromDate(
            toDateInputValue(withDocs.criminal_record_from || withDocs.created_at)
          );
          setCriminalUntilDate(toDateInputValue(withDocs.criminal_record_expiry));
          setInsurancePolicyUrl(withDocs.insurance_policy_url || '');
          setInsuranceFromDate(
            toDateInputValue(withDocs.insurance_from || withDocs.created_at)
          );
          setInsuranceUntilDate(toDateInputValue(withDocs.insurance_expiry));
        }
      }
    } catch (error) {
      console.error('Error al cargar datos del prestador:', error);
    } finally {
      setFetching(false);
    }
  }, []);

  const fetchProviderContracts = useCallback(async () => {
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
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchProviderData(), fetchProviderContracts()]);
  }, [fetchProviderData, fetchProviderContracts]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Carga los datos de un documento del historial en el formulario para editarlo
  const handleEditPersonalDoc = (docRow) => {
    if (docRow.docKey === 'criminal') {
      setCriminalRecordUrl(docRow.url || '');
      setCriminalFromDate(toDateInputValue(docRow.fromDate));
      setCriminalUntilDate(toDateInputValue(docRow.untilDate));
    } else if (docRow.docKey === 'insurance') {
      setInsurancePolicyUrl(docRow.url || '');
      setInsuranceFromDate(toDateInputValue(docRow.fromDate));
      setInsuranceUntilDate(toDateInputValue(docRow.untilDate));
    }
    setFeedback({
      type: 'success',
      text: `Editá "${docRow.title}" en el formulario y guardá los cambios.`,
    });
  };

  // Guarda/actualiza la documentación personal (Antecedentes + ART/Seguro)
  const handleSavePersonalDocs = async (e) => {
    e.preventDefault();
    if (criminalFromDate && criminalUntilDate && criminalUntilDate < criminalFromDate) {
      setFeedback({
        type: 'error',
        text: 'En Antecedentes Penales, la fecha "Hasta" no puede ser anterior a "Desde".',
      });
      return;
    }
    if (insuranceFromDate && insuranceUntilDate && insuranceUntilDate < insuranceFromDate) {
      setFeedback({
        type: 'error',
        text: 'En Póliza ART / Seguro, la fecha "Hasta" no puede ser anterior a "Desde".',
      });
      return;
    }

    setSavingDocs(true);
    setFeedback({ type: '', text: '' });

    const docPayload = {
      criminal_record_url: criminalRecordUrl.trim() || null,
      criminal_record_from: criminalFromDate || null,
      criminal_record_expiry: criminalUntilDate || null,
      insurance_policy_url: insurancePolicyUrl.trim() || null,
      insurance_from: insuranceFromDate || null,
      insurance_expiry: insuranceUntilDate || null,
    };

    try {
      if (providerProfiles.length === 0) {
        const res = await fetch(`${API_BASE}/api/v1/providers/profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({
            specialty: 'Servicios Generales',
            ...docPayload,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setFeedback({ type: 'error', text: data.error || 'No se pudo guardar la documentación.' });
          return;
        }
      } else {
        await Promise.all(
          providerProfiles.map((prof) =>
            fetch(`${API_BASE}/api/v1/providers/profile/${prof.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
              body: JSON.stringify({
                specialty: prof.specialty,
                ...docPayload,
              }),
            })
          )
        );
      }

      setFeedback({
        type: 'success',
        text: 'Documentación personal guardada. Queda sujeta a validación de TrustLink.',
      });
      await fetchProviderData();
    } catch (error) {
      console.error('Error al guardar documentación personal:', error);
      setFeedback({ type: 'error', text: 'Error de conexión al guardar documentación.' });
    } finally {
      setSavingDocs(false);
    }
  };

  // Agrega una nueva especialidad
  const handleAddSpecialty = async (e) => {
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
          criminal_record_from: criminalFromDate || null,
          criminal_record_expiry: criminalUntilDate || null,
          insurance_policy_url: insurancePolicyUrl.trim() || null,
          insurance_from: insuranceFromDate || null,
          insurance_expiry: insuranceUntilDate || null,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({
          type: 'success',
          text:
            data.message ||
            'Especialidad agregada. Queda en revisión de compliance para su aprobación.',
        });
        setSpecialty('');
        await fetchProviderData();
      } else {
        setFeedback({ type: 'error', text: data.error || 'No se pudo agregar la especialidad.' });
      }
    } catch (error) {
      console.error('Error al agregar especialidad:', error);
      setFeedback({ type: 'error', text: 'Error de conexión con el servidor.' });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSaveEditSpecialty = async (profileId) => {
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
          criminal_record_url: criminalRecordUrl.trim() || null,
          criminal_record_from: criminalFromDate || null,
          criminal_record_expiry: criminalUntilDate || null,
          insurance_policy_url: insurancePolicyUrl.trim() || null,
          insurance_from: insuranceFromDate || null,
          insurance_expiry: insuranceUntilDate || null,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({
          type: 'success',
          text: data.message || 'Especialidad actualizada.',
        });
        setEditingProfileId(null);
        await fetchProviderData();
      } else {
        setFeedback({ type: 'error', text: data.error || 'No se pudo actualizar.' });
      }
    } catch (error) {
      console.error('Error al editar especialidad:', error);
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

  // Construye las filas de documentación personal (una por documento de la persona, no por especialidad)
  const personalDocRows = (() => {
    const baseSource =
      providerProfiles.find((p) => p.criminal_record_url || p.insurance_policy_url) ||
      providerProfiles[0];
    if (!baseSource) return [];

    const rows = [];
    const trustStatus = baseSource.status || 'pending';

    if (baseSource.criminal_record_url || baseSource.criminal_record_expiry) {
      const fromVal = baseSource.criminal_record_from || baseSource.created_at;
      const untilVal = baseSource.criminal_record_expiry;
      rows.push({
        docKey: 'criminal',
        title: 'Antecedentes Penales',
        url: baseSource.criminal_record_url || 'Sin URL',
        fromDate: fromVal,
        untilDate: untilVal,
        validity: resolveDateValidity(fromVal, untilVal),
        trustlinkValidation: formatTrustlinkValidationStatus(trustStatus),
      });
    }

    if (baseSource.insurance_policy_url || baseSource.insurance_expiry) {
      const fromVal = baseSource.insurance_from || baseSource.created_at;
      const untilVal = baseSource.insurance_expiry;
      rows.push({
        docKey: 'insurance',
        title: 'Póliza ART / Seguro',
        url: baseSource.insurance_policy_url || 'Sin URL',
        fromDate: fromVal,
        untilDate: untilVal,
        validity: resolveDateValidity(fromVal, untilVal),
        trustlinkValidation: formatTrustlinkValidationStatus(trustStatus),
      });
    }

    return rows;
  })();

  const primaryStatusInfo = formatSpecialtyStatus(providerProfiles[0]?.status);

  const steps = [
    {
      id: 'credentials',
      stepNumber: '1',
      label: 'Credenciales',
      count: providerProfiles.length,
      icon: ShieldCheck,
    },
    {
      id: 'vehicles',
      stepNumber: '2',
      label: 'Flota Vehicular',
      count: vehicles.length,
      icon: Car,
    },
    {
      id: 'reviews',
      stepNumber: '3',
      label: 'Reputación Cruzada',
      count: providerContracts.length,
      icon: Star,
    },
  ];

  const activeStepMeta = steps.find((s) => s.id === activeStep) || steps[0];

  return (
    <div className="p-6 md:p-8 flex-1">
      <main className="max-w-6xl mx-auto space-y-6">
        {/* Cabecera del Portal Prestador + Indicadores de Pasos Clicables */}
        <section
          className="border border-black/20 p-6 rounded-2xl shadow-sm space-y-5"
          style={cardStyle}
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className="p-3 rounded-xl border border-white/15 text-emerald-400 shrink-0"
                style={innerStyle}
              >
                <Wrench size={20} strokeWidth={1.8} />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight">
                  Portal Prestador — {activeStepMeta.stepNumber}. {activeStepMeta.label}
                </h2>
                <p className="text-xs opacity-80 mt-0.5">
                  {activeStep === 'credentials' &&
                    'Documentación personal del prestador, vigencia por fechas y especialidades habilitadas.'}
                  {activeStep === 'vehicles' &&
                    'Vehículos habilitados y patentes asociadas a tu perfil de prestador.'}
                  {activeStep === 'reviews' &&
                    'Reseñas recibidas de residentes y calificación cruzada por servicio realizado.'}
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
              <button
                type="button"
                onClick={refreshAll}
                disabled={fetching || loadingContracts}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/15 cursor-pointer hover:opacity-90 disabled:opacity-50"
                style={innerStyle}
              >
                <RefreshCw
                  size={13}
                  className={fetching || loadingContracts ? 'animate-spin' : ''}
                />
                Actualizar
              </button>
            </div>
          </div>

          {/* Barra de indicadores de pasos seleccionables mediante clic */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            {steps.map((item) => {
              const IconComp = item.icon;
              const isSelected = activeStep === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveStep(item.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'text-white border-transparent shadow-sm'
                      : 'border-white/15 opacity-85 hover:opacity-100'
                  }`}
                  style={isSelected ? { backgroundColor: primaryActionColor } : innerStyle}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-full text-[11px] font-black flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-black/25 text-white' : 'bg-white/10'
                      }`}
                    >
                      {item.stepNumber}
                    </span>
                    <IconComp size={14} className="shrink-0" />
                    <span className="text-xs font-bold truncate">{item.label}</span>
                  </div>
                  <span
                    className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md shrink-0 ${
                      isSelected ? 'bg-black/25 text-white' : 'bg-black/20'
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Feedback global */}
        {feedback.text && (
          <div
            className={`p-4 rounded-xl text-xs border flex items-center justify-between gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                : 'bg-rose-950/60 border-rose-800 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
              <span>{feedback.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback({ type: '', text: '' })}
              className="p-1 rounded-lg hover:bg-black/20 cursor-pointer"
              aria-label="Cerrar aviso"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* PASO 1: Documentación Personal minimalista + filas por persona (Izquierda) / Especialidades (Derecha) */}
        {activeStep === 'credentials' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Columna Izquierda: Formulario minimalista + Historial en filas de documentación de la persona */}
            <section
              className="lg:col-span-6 border border-black/20 p-5 rounded-2xl shadow-sm space-y-5"
              style={cardStyle}
            >
              <div className="flex items-center justify-between border-b border-black/20 pb-3">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-emerald-400" />
                  <h3 className="text-sm font-bold">Documentación Personal</h3>
                </div>
                <span className="text-[11px] opacity-75">Por persona</span>
              </div>

              <form onSubmit={handleSavePersonalDocs} className="space-y-2.5 text-xs">
                {/* Fila compacta 1: Antecedentes Penales */}
                <div
                  className="p-2.5 rounded-xl border border-black/20 space-y-2"
                  style={innerStyle}
                >
                  <div className="text-[11px] font-bold opacity-85">Antecedentes Penales</div>
                  <input
                    type="text"
                    value={criminalRecordUrl}
                    onChange={(e) => setCriminalRecordUrl(e.target.value)}
                    placeholder="URL de antecedentes"
                    className="w-full px-3 py-1.5 rounded-lg border border-white/15 text-xs focus:outline-none"
                    style={cardStyle}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={criminalFromDate}
                      onChange={(e) => setCriminalFromDate(e.target.value)}
                      aria-label="Antecedentes Desde"
                      className="w-full px-2.5 py-1 rounded-lg border border-white/15 text-[11px] focus:outline-none"
                      style={cardStyle}
                    />
                    <input
                      type="date"
                      value={criminalUntilDate}
                      onChange={(e) => setCriminalUntilDate(e.target.value)}
                      aria-label="Antecedentes Hasta"
                      className="w-full px-2.5 py-1 rounded-lg border border-white/15 text-[11px] focus:outline-none"
                      style={cardStyle}
                    />
                  </div>
                </div>

                {/* Fila compacta 2: Póliza ART / Seguro */}
                <div
                  className="p-2.5 rounded-xl border border-black/20 space-y-2"
                  style={innerStyle}
                >
                  <div className="text-[11px] font-bold opacity-85">Póliza ART / Seguro</div>
                  <input
                    type="text"
                    value={insurancePolicyUrl}
                    onChange={(e) => setInsurancePolicyUrl(e.target.value)}
                    placeholder="URL de póliza ART / Seguro"
                    className="w-full px-3 py-1.5 rounded-lg border border-white/15 text-xs focus:outline-none"
                    style={cardStyle}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={insuranceFromDate}
                      onChange={(e) => setInsuranceFromDate(e.target.value)}
                      aria-label="ART Desde"
                      className="w-full px-2.5 py-1 rounded-lg border border-white/15 text-[11px] focus:outline-none"
                      style={cardStyle}
                    />
                    <input
                      type="date"
                      value={insuranceUntilDate}
                      onChange={(e) => setInsuranceUntilDate(e.target.value)}
                      aria-label="ART Hasta"
                      className="w-full px-2.5 py-1 rounded-lg border border-white/15 text-[11px] focus:outline-none"
                      style={cardStyle}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingDocs}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 cursor-pointer transition-opacity hover:opacity-95"
                  style={{ backgroundColor: primaryActionColor }}
                >
                  <Save size={13} />
                  {savingDocs ? 'Guardando...' : 'Guardar Documentación'}
                </button>
              </form>

              {/* Historial en filas de la documentación cargada por persona */}
              <div className="pt-3 border-t border-black/20 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider opacity-85 flex items-center gap-1.5">
                    <History size={13} className="text-sky-400" />
                    Historial Documental
                  </span>
                  <span className="text-[10px] font-mono opacity-75">
                    {personalDocRows.length} doc(s)
                  </span>
                </div>

                {personalDocRows.length === 0 ? (
                  <div
                    className="p-3 rounded-xl border border-black/20 text-[11px] opacity-75 text-center"
                    style={innerStyle}
                  >
                    Sin documentación cargada todavía.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {personalDocRows.map((row) => (
                      <div
                        key={row.docKey}
                        className="p-3 rounded-xl border border-black/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]"
                        style={innerStyle}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs">{row.title}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${row.validity.badgeClass}`}
                            >
                              {row.validity.label}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${row.trustlinkValidation.badgeClass}`}
                            >
                              {row.trustlinkValidation.label}
                            </span>
                          </div>
                          <div className="truncate opacity-80">{row.url}</div>
                          <div className="font-mono text-[10px] opacity-70">
                            Vigencia: {formatDisplayDate(row.fromDate)} —{' '}
                            {formatDisplayDate(row.untilDate)}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleEditPersonalDoc(row)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/15 font-semibold cursor-pointer hover:opacity-90 shrink-0 self-start sm:self-center"
                          style={cardStyle}
                        >
                          <Edit3 size={11} /> Editar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Columna Derecha: Especialidades y Credenciales */}
            <section
              className="lg:col-span-6 border border-black/20 p-5 rounded-2xl shadow-sm space-y-4"
              style={cardStyle}
            >
              <div className="flex items-center justify-between border-b border-black/20 pb-3">
                <div className="flex items-center gap-2">
                  <Award size={16} className="text-emerald-400" />
                  <h3 className="text-sm font-bold">Especialidades y Credenciales</h3>
                </div>
                <span className="text-[11px] font-mono opacity-80">
                  {providerProfiles.length} activa(s)
                </span>
              </div>

              <form onSubmit={handleAddSpecialty} className="flex gap-2 text-xs">
                <input
                  type="text"
                  required
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="Nueva especialidad (ej: Plomero Matriculado)"
                  className="flex-1 px-3 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                  style={innerStyle}
                />
                <button
                  type="submit"
                  disabled={loadingAction || !specialty.trim()}
                  className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 cursor-pointer shrink-0 hover:opacity-95"
                  style={{ backgroundColor: primaryActionColor }}
                >
                  <Plus size={14} /> Agregar
                </button>
              </form>

              {fetching ? (
                <div className="text-center py-8 text-xs opacity-80 flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin" size={15} /> Cargando especialidades...
                </div>
              ) : providerProfiles.length === 0 ? (
                <div
                  className="text-center py-8 rounded-xl border border-black/20 text-xs opacity-75"
                  style={innerStyle}
                >
                  Aún no agregaste especialidades. Ingresá tu oficio arriba.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {providerProfiles.map((prof) => {
                    const isEditing = editingProfileId === prof.id;
                    const profStatus = formatSpecialtyStatus(prof.status);

                    return (
                      <div
                        key={prof.id}
                        className="p-3.5 rounded-xl border border-black/20 text-xs space-y-1"
                        style={innerStyle}
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editSpecialty}
                              onChange={(e) => setEditSpecialty(e.target.value)}
                              className="flex-1 px-3 py-1.5 rounded-lg border border-white/15 text-xs focus:outline-none"
                              style={cardStyle}
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEditSpecialty(prof.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-white font-bold cursor-pointer"
                              style={{ backgroundColor: primaryActionColor }}
                            >
                              <Save size={12} /> Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingProfileId(null)}
                              className="p-1.5 rounded-lg border border-white/15 opacity-85 cursor-pointer"
                              style={cardStyle}
                              aria-label="Cancelar"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap min-w-0">
                                <span className="font-bold truncate">{prof.specialty}</span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${profStatus.badgeClass}`}
                                >
                                  {profStatus.label}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingProfileId(prof.id);
                                  setEditSpecialty(prof.specialty || '');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/15 cursor-pointer shrink-0 hover:opacity-90"
                                style={cardStyle}
                              >
                                <Edit3 size={11} /> Editar
                              </button>
                            </div>
                            <p className="text-[11px] opacity-75">
                              {prof.status === 'approved'
                                ? 'Visible para residentes en el directorio.'
                                : 'Pendiente de aprobación de compliance para mostrarse a residentes.'}
                            </p>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* PASO 2: Flota Vehicular Habilitada */}
        {activeStep === 'vehicles' && (
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
        )}

        {/* PASO 3: Servicios Realizados & Reputación Cruzada */}
        {activeStep === 'reviews' && (
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
                            <span className="opacity-90 italic">
                              "{item.owner_review_comment}"
                            </span>
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
                              disabled={submittingContractId === item.contract_id}
                              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50 cursor-pointer transition-opacity hover:opacity-95"
                              style={{ backgroundColor: primaryActionColor }}
                            >
                              <Send size={12} />
                              {submittingContractId === item.contract_id
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
        )}
      </main>
    </div>
  );
}