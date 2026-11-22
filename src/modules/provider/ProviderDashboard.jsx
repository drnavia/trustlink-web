/**
 * @file ProviderDashboard.jsx
 * @description Portal del Prestador conectado a la API REST de TrustLink (PostgreSQL).
 * Incluye el paso 1. Credenciales con diseño minimalista y visual: badges en español
 * con color semántico, ícono de tilde ("Verificado") para validación, diferenciación
 * clara entre estado de verificación y visibilidad de especialidades, formulario
 * desplegable desde cabecera y simetría entre columnas.
 * @location /trustlink-web/src/modules/provider/ProviderDashboard.jsx
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Wrench,
  ShieldCheck,
  BadgeCheck,
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
  FileText,
  Award,
  Eye,
  EyeOff,
  History,
  RefreshCw,
} from 'lucide-react';
import { useBranding, DEFAULT_BRANDING_CONFIG } from '../branding/BrandingContext';

const API_BASE = 'http://localhost:4000';

/**
 * Traduce estados técnicos (inglés/español) a etiquetas limpias en español
 * con tono semántico para badges minimalistas.
 */
function normalizeAuditStatus(rawStatus) {
  const normalized = String(rawStatus || 'pending').toLowerCase().trim();
  if (normalized === 'approved' || normalized === 'aprobado' || normalized === 'verificado' || normalized === 'verified') {
    return { label: 'Verificado', tone: 'verified', isVerified: true };
  }
  if (normalized === 'rejected' || normalized === 'rechazado') {
    return { label: 'Rechazado', tone: 'danger', isVerified: false };
  }
  return { label: 'Pendiente', tone: 'warning', isVerified: false };
}

/**
 * Calcula el estado de vigencia de un documento a partir de su fecha de vencimiento.
 * Asigna un color distintivo también a 'Sin fecha' para que no pase desapercibido.
 */
function getValidityStatus(expiryDateStr) {
  if (!expiryDateStr) {
    return { label: 'Sin fecha', tone: 'info' };
  }

  const parsed = new Date(expiryDateStr);
  if (Number.isNaN(parsed.getTime())) {
    return { label: 'Sin fecha', tone: 'info' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: 'Vencido', tone: 'danger' };
  }
  if (diffDays <= 30) {
    return { label: 'Por vencer', tone: 'warning' };
  }
  return { label: 'Vigente', tone: 'success' };
}

/**
 * Devuelve clases de color semántico para badges minimalistas y visuales.
 */
function getSemanticBadgeClass(tone) {
  switch (tone) {
    case 'verified':
    case 'success':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35';
    case 'warning':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/35';
    case 'danger':
      return 'bg-rose-500/15 text-rose-300 border-rose-500/35';
    case 'info':
      return 'bg-sky-500/15 text-sky-300 border-sky-500/35';
    default:
      return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
  }
}

/**
 * Formatea una fecha a dd/mm/aaaa en español (Argentina).
 */
function formatDateShort(dateStr) {
  if (!dateStr) return 'Sin fecha';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return 'Sin fecha';
  return parsed.toLocaleDateString('es-AR');
}

/**
 * Convierte una fecha a formato YYYY-MM-DD para inputs de tipo date.
 */
function toDateInputValue(dateStr) {
  if (!dateStr) return '';
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr.slice(0, 10);
  }
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

export default function ProviderDashboard() {
  const { brand } = useBranding();

  // Superficies configurables desde BrandingContext
  const cardStyle = {
    backgroundColor: brand.cardBgColor || DEFAULT_BRANDING_CONFIG.cardBgColor,
    color: brand.cardTextColor || DEFAULT_BRANDING_CONFIG.cardTextColor,
  };

  const innerStyle = {
    backgroundColor: brand.innerBgColor || DEFAULT_BRANDING_CONFIG.innerBgColor,
    color: brand.innerTextColor || DEFAULT_BRANDING_CONFIG.innerTextColor,
  };

  const primaryActionColor = brand.primaryColor || brand.accentColor || '#10b981';

  // Navegación por pasos: 'credentials' | 'vehicles' | 'reviews'
  const [activeStep, setActiveStep] = useState('credentials');

  // Datos del perfil del prestador
  const [profileData, setProfileData] = useState({ providers: [], vehicles: [] });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ---------------------------------------------------------------------------
  // 1A. DOCUMENTACIÓN PERSONAL
  // ---------------------------------------------------------------------------
  const [showDocForm, setShowDocForm] = useState(false);
  const [docType, setDocType] = useState('Antecedentes Penales');
  const [docUrl, setDocUrl] = useState('');
  const [docValidFrom, setDocValidFrom] = useState('');
  const [docValidTo, setDocValidTo] = useState('');
  const [savingDoc, setSavingDoc] = useState(false);

  // Edición inline de un documento del historial
  const [editingDocKey, setEditingDocKey] = useState(null);
  const [editDocUrl, setEditDocUrl] = useState('');
  const [editDocValidFrom, setEditDocValidFrom] = useState('');
  const [editDocValidTo, setEditDocValidTo] = useState('');
  const [updatingDoc, setUpdatingDoc] = useState(false);

  // ---------------------------------------------------------------------------
  // 1B. ESPECIALIDADES Y CREDENCIALES (Formulario oculto por defecto)
  // ---------------------------------------------------------------------------
  const [showSpecialtyForm, setShowSpecialtyForm] = useState(false);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [savingSpecialty, setSavingSpecialty] = useState(false);

  // Visibilidad configurada por el prestador para residentes ('Visible' / 'Oculta')
  const [hiddenSpecialtyIds, setHiddenSpecialtyIds] = useState({});

  // Edición inline de especialidad
  const [editingSpecialtyId, setEditingSpecialtyId] = useState(null);
  const [editSpecialtyName, setEditSpecialtyName] = useState('');
  const [updatingSpecialty, setUpdatingSpecialty] = useState(false);

  // ---------------------------------------------------------------------------
  // 2. FLOTA VEHICULAR
  // ---------------------------------------------------------------------------
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vehType, setVehType] = useState('utilitario');
  const [vehBrand, setVehBrand] = useState('');
  const [vehModel, setVehModel] = useState('');
  const [vehColor, setVehColor] = useState('');
  const [vehPlate, setVehPlate] = useState('');
  const [savingVehicle, setSavingVehicle] = useState(false);

  // ---------------------------------------------------------------------------
  // 3. REPUTACIÓN CRUZADA
  // ---------------------------------------------------------------------------
  const [reviewContracts, setReviewContracts] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [ownerRatingDrafts, setOwnerRatingDrafts] = useState({});
  const [ownerCommentDrafts, setOwnerCommentDrafts] = useState({});
  const [submittingOwnerReviewId, setSubmittingOwnerReviewId] = useState(null);

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
  });

  /**
   * Consulta el perfil del prestador (especialidades, documentación y flota).
   */
  const fetchProviderProfile = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/me`, {
        method: 'GET',
        headers: getAuthHeaders(),
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

  /**
   * Consulta los contratos del prestador para reseñas cruzadas.
   */
  const fetchProviderReviewContracts = async () => {
    setLoadingReviews(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/reviews/provider-contracts`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setReviewContracts(data.contracts || []);
      }
    } catch (error) {
      console.error('Error al cargar contratos del prestador:', error);
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    fetchProviderProfile();
    fetchProviderReviewContracts();
  }, []);

  /**
   * Construye el listado del historial documental a partir de los registros del prestador.
   */
  const documentHistory = useMemo(() => {
    const items = [];
    const profiles = profileData.providers || [];

    profiles.forEach((prof) => {
      if (Array.isArray(prof.documents) && prof.documents.length > 0) {
        prof.documents.forEach((doc, idx) => {
          items.push({
            key: `doc-${prof.id}-${doc.id || idx}`,
            profileId: prof.id,
            docType: doc.doc_type || doc.type || 'Documento',
            url: doc.url || '',
            validFrom: doc.valid_from || null,
            validTo: doc.valid_to || doc.expires_at || null,
            auditStatus: doc.status || prof.status || 'pending',
          });
        });
      } else {
        const crimUrl = prof.criminal_record_url || '';
        const crimTo = prof.criminal_record_expiry || prof.criminal_record_valid_to || null;
        const crimFrom = prof.criminal_record_valid_from || prof.created_at || null;
        if (crimUrl || crimTo) {
          items.push({
            key: `crim-${prof.id}`,
            profileId: prof.id,
            field: 'criminal',
            docType: 'Antecedentes Penales',
            url: crimUrl,
            validFrom: crimFrom,
            validTo: crimTo,
            auditStatus: prof.status || 'pending',
          });
        }

        const artUrl = prof.art_insurance_url || prof.insurance_policy_url || '';
        const artTo = prof.art_insurance_expiry || prof.insurance_expiry || null;
        const artFrom = prof.art_insurance_valid_from || prof.created_at || null;
        if (artUrl || artTo) {
          items.push({
            key: `art-${prof.id}`,
            profileId: prof.id,
            field: 'art',
            docType: 'Póliza ART / Seguro',
            url: artUrl,
            validFrom: artFrom,
            validTo: artTo,
            auditStatus: prof.status || 'pending',
          });
        }
      }
    });

    return items;
  }, [profileData.providers]);

  /**
   * Cantidad de especialidades actualmente visibles/activas.
   */
  const activeSpecialtiesCount = useMemo(() => {
    return (profileData.providers || []).filter((p) => !hiddenSpecialtyIds[p.id]).length;
  }, [profileData.providers, hiddenSpecialtyIds]);

  /**
   * Crea o actualiza un documento de compliance personal.
   */
  const handleCreateDocument = async (e) => {
    e.preventDefault();
    setSavingDoc(true);
    setErrorMsg('');
    setSuccessMsg('');

    const baseProfile = profileData.providers[0] || {};
    const isArt = docType.toLowerCase().includes('art') || docType.toLowerCase().includes('seguro');

    const payload = {
      specialty: baseProfile.specialty || 'Servicios Verificados',
      criminal_record_url: !isArt
        ? docUrl.trim()
        : baseProfile.criminal_record_url || '',
      criminal_record_expiry: !isArt
        ? docValidTo || null
        : baseProfile.criminal_record_expiry || null,
      art_insurance_url: isArt
        ? docUrl.trim()
        : baseProfile.art_insurance_url || baseProfile.insurance_policy_url || '',
      insurance_policy_url: isArt
        ? docUrl.trim()
        : baseProfile.insurance_policy_url || baseProfile.art_insurance_url || '',
      art_insurance_expiry: isArt
        ? docValidTo || null
        : baseProfile.art_insurance_expiry || baseProfile.insurance_expiry || null,
      insurance_expiry: isArt
        ? docValidTo || null
        : baseProfile.insurance_expiry || baseProfile.art_insurance_expiry || null,
      valid_from: docValidFrom || null,
      valid_to: docValidTo || null,
      document_type: docType,
    };

    try {
      const endpoint = baseProfile.id
        ? `${API_BASE}/api/v1/providers/profile/${baseProfile.id}`
        : `${API_BASE}/api/v1/providers/profile`;
      const method = baseProfile.id ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (response.ok) {
        setSuccessMsg('Documentación cargada y registrada en el historial.');
        setDocUrl('');
        setDocValidFrom('');
        setDocValidTo('');
        setShowDocForm(false);
        await fetchProviderProfile();
      } else {
        setErrorMsg(data.error || 'No se pudo guardar la documentación.');
      }
    } catch (error) {
      console.error('Error al cargar documentación:', error);
      setErrorMsg('Error de conexión con el servidor.');
    } finally {
      setSavingDoc(false);
    }
  };

  /**
   * Abre el modo de edición para un ítem del historial documental.
   */
  const startEditingDocument = (docItem) => {
    setEditingDocKey(docItem.key);
    setEditDocUrl(docItem.url || '');
    setEditDocValidFrom(toDateInputValue(docItem.validFrom));
    setEditDocValidTo(toDateInputValue(docItem.validTo));
    setErrorMsg('');
    setSuccessMsg('');
  };

  /**
   * Guarda los cambios de URL y vigencia de un documento del historial.
   */
  const handleSaveDocumentEdit = async (docItem) => {
    setUpdatingDoc(true);
    setErrorMsg('');
    setSuccessMsg('');

    const targetProfile =
      profileData.providers.find((p) => p.id === docItem.profileId) || profileData.providers[0] || {};
    const isArt = docItem.field === 'art' || docItem.docType.toLowerCase().includes('art');

    const payload = {
      specialty: targetProfile.specialty || 'Servicios Verificados',
      criminal_record_url: !isArt
        ? editDocUrl.trim()
        : targetProfile.criminal_record_url || '',
      criminal_record_expiry: !isArt
        ? editDocValidTo || null
        : targetProfile.criminal_record_expiry || null,
      art_insurance_url: isArt
        ? editDocUrl.trim()
        : targetProfile.art_insurance_url || targetProfile.insurance_policy_url || '',
      insurance_policy_url: isArt
        ? editDocUrl.trim()
        : targetProfile.insurance_policy_url || targetProfile.art_insurance_url || '',
      art_insurance_expiry: isArt
        ? editDocValidTo || null
        : targetProfile.art_insurance_expiry || targetProfile.insurance_expiry || null,
      insurance_expiry: isArt
        ? editDocValidTo || null
        : targetProfile.insurance_expiry || targetProfile.art_insurance_expiry || null,
      valid_from: editDocValidFrom || null,
      valid_to: editDocValidTo || null,
    };

    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/profile/${targetProfile.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (response.ok) {
        setSuccessMsg('Documento actualizado en el historial.');
        setEditingDocKey(null);
        await fetchProviderProfile();
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar el documento.');
      }
    } catch (error) {
      console.error('Error al actualizar documento:', error);
      setErrorMsg('Error de conexión al actualizar el documento.');
    } finally {
      setUpdatingDoc(false);
    }
  };

  /**
   * Registra una nueva especialidad para el prestador.
   */
  const handleCreateSpecialty = async (e) => {
    e.preventDefault();
    if (!newSpecialty.trim()) return;

    setSavingSpecialty(true);
    setErrorMsg('');
    setSuccessMsg('');

    const currentDoc = profileData.providers[0] || {};

    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          specialty: newSpecialty.trim(),
          criminal_record_url: currentDoc.criminal_record_url || '',
          art_insurance_url: currentDoc.art_insurance_url || currentDoc.insurance_policy_url || '',
        }),
      });
      const data = await response.json();

      if (response.ok) {
        setSuccessMsg('Especialidad agregada correctamente.');
        setNewSpecialty('');
        setShowSpecialtyForm(false);
        await fetchProviderProfile();
      } else {
        setErrorMsg(data.error || 'No se pudo agregar la especialidad.');
      }
    } catch (error) {
      console.error('Error al agregar especialidad:', error);
      setErrorMsg('Error de conexión con el servidor.');
    } finally {
      setSavingSpecialty(false);
    }
  };

  /**
   * Actualiza el nombre de una especialidad existente.
   */
  const handleSaveSpecialtyEdit = async (specialtyItem) => {
    if (!editSpecialtyName.trim()) return;

    setUpdatingSpecialty(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/profile/${specialtyItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          specialty: editSpecialtyName.trim(),
          criminal_record_url: specialtyItem.criminal_record_url || '',
          art_insurance_url:
            specialtyItem.art_insurance_url || specialtyItem.insurance_policy_url || '',
        }),
      });
      const data = await response.json();

      if (response.ok) {
        setSuccessMsg('Especialidad actualizada correctamente.');
        setEditingSpecialtyId(null);
        await fetchProviderProfile();
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar la especialidad.');
      }
    } catch (error) {
      console.error('Error al actualizar especialidad:', error);
      setErrorMsg('Error de conexión al actualizar la especialidad.');
    } finally {
      setUpdatingSpecialty(false);
    }
  };

  /**
   * Alterna si la especialidad se muestra o se oculta ante residentes.
   */
  const toggleSpecialtyVisibility = (specialtyId) => {
    setHiddenSpecialtyIds((prev) => ({
      ...prev,
      [specialtyId]: !prev[specialtyId],
    }));
  };

  /**
   * Registra un vehículo en la flota del prestador.
   */
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
          ...getAuthHeaders(),
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
        setShowVehicleForm(false);
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

  /**
   * Envía calificación y comentario hacia el residente de un contrato.
   */
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
          ...getAuthHeaders(),
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
  const globalAudit = normalizeAuditStatus(primaryProfile?.status);

  // Clases compartidas para simetría visual entre columnas
  const listHeaderTitleClass =
    'text-[11px] font-bold uppercase tracking-wider opacity-85 flex items-center gap-1.5';
  const listCounterBadgeClass =
    'text-[11px] font-mono px-2.5 py-0.5 rounded-lg border border-white/15 shrink-0';
  const rowActionBtnClass =
    'px-2.5 py-1.5 rounded-lg border border-white/15 text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-opacity hover:opacity-85 shrink-0';

  return (
    <div className="max-w-6xl w-full mx-auto px-4 md:px-8 py-6 space-y-6">
      {/* Cabecera principal y selectores de pasos */}
      <section
        className="p-6 rounded-2xl border border-black/20 space-y-5"
        style={cardStyle}
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 rounded-xl border border-white/15" style={innerStyle}>
              <Wrench size={22} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">Portal Prestador — 1. Credenciales</h2>
              <p className="text-xs opacity-80">
                Documentación personal, vigencia por fechas y especialidades verificadas en TrustLink.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-xs font-bold px-3 py-1.5 rounded-xl border border-white/15 inline-flex items-center gap-1.5"
              style={innerStyle}
            >
              <Star size={13} className="text-amber-400 fill-amber-400" />
              Scoring: {Number(primaryProfile?.rating_avg || 0).toFixed(2)}
            </span>
            <span
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border inline-flex items-center gap-1.5 ${getSemanticBadgeClass(
                globalAudit.tone
              )}`}
            >
              {globalAudit.isVerified && <BadgeCheck size={14} />}
              Estado: {globalAudit.label}
            </span>
            <button
              type="button"
              onClick={() => {
                fetchProviderProfile();
                fetchProviderReviewContracts();
              }}
              className="text-xs font-bold px-3 py-1.5 rounded-xl border border-white/15 inline-flex items-center gap-1.5 cursor-pointer hover:opacity-85"
              style={innerStyle}
            >
              <RefreshCw size={13} /> Actualizar
            </button>
          </div>
        </div>

        {/* Pestañas de pasos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setActiveStep('credentials')}
            className={`px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between border transition-all cursor-pointer ${
              activeStep === 'credentials'
                ? 'text-white border-emerald-400/50'
                : 'border-white/15 opacity-80 hover:opacity-100'
            }`}
            style={activeStep === 'credentials' ? { backgroundColor: primaryActionColor } : innerStyle}
          >
            <span className="flex items-center gap-2">
              <ShieldCheck size={15} /> 1. Credenciales
            </span>
            <span className="font-mono px-2 py-0.5 rounded bg-black/20">
              {profileData.providers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStep('vehicles')}
            className={`px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between border transition-all cursor-pointer ${
              activeStep === 'vehicles'
                ? 'text-white border-emerald-400/50'
                : 'border-white/15 opacity-80 hover:opacity-100'
            }`}
            style={activeStep === 'vehicles' ? { backgroundColor: primaryActionColor } : innerStyle}
          >
            <span className="flex items-center gap-2">
              <Car size={15} /> 2. Flota Vehicular
            </span>
            <span className="font-mono px-2 py-0.5 rounded bg-black/20">
              {profileData.vehicles.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStep('reviews')}
            className={`px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between border transition-all cursor-pointer ${
              activeStep === 'reviews'
                ? 'text-white border-emerald-400/50'
                : 'border-white/15 opacity-80 hover:opacity-100'
            }`}
            style={activeStep === 'reviews' ? { backgroundColor: primaryActionColor } : innerStyle}
          >
            <span className="flex items-center gap-2">
              <Star size={15} /> 3. Reputación Cruzada
            </span>
            <span className="font-mono px-2 py-0.5 rounded bg-black/20">
              {reviewContracts.length}
            </span>
          </button>
        </div>
      </section>

      {/* Mensajes de estado */}
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
      ) : activeStep === 'credentials' ? (
        /* =====================================================================
           PASO 1: DOCUMENTACIÓN PERSONAL + ESPECIALIDADES Y CREDENCIALES
           ===================================================================== */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* COLUMNA IZQUIERDA: Documentación Personal */}
          <section
            className="p-6 rounded-2xl border border-black/20 space-y-5"
            style={cardStyle}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-bold flex items-center gap-2">
                <FileText size={18} className="text-emerald-400 shrink-0" /> Documentación Personal
              </h3>
              <button
                type="button"
                onClick={() => setShowDocForm((prev) => !prev)}
                className="text-white font-bold px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 transition-opacity hover:opacity-90 cursor-pointer shrink-0"
                style={{ backgroundColor: primaryActionColor }}
              >
                {showDocForm ? <X size={14} /> : <Plus size={14} />}
                {showDocForm ? 'Cerrar' : 'Cargar Documentación'}
              </button>
            </div>

            {showDocForm && (
              <form
                onSubmit={handleCreateDocument}
                className="p-4 rounded-xl border border-black/20 space-y-3 text-xs"
                style={innerStyle}
              >
                <p className="font-bold">Nuevo Documento de Compliance</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                    style={cardStyle}
                  >
                    <option value="Antecedentes Penales">Antecedentes Penales</option>
                    <option value="Póliza ART / Seguro">Póliza ART / Seguro</option>
                  </select>
                  <input
                    type="text"
                    required
                    value={docUrl}
                    onChange={(e) => setDocUrl(e.target.value)}
                    placeholder="URL o enlace del documento"
                    className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                    style={cardStyle}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] opacity-80 mb-1">Vigencia desde</label>
                    <input
                      type="date"
                      value={docValidFrom}
                      onChange={(e) => setDocValidFrom(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                      style={cardStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] opacity-80 mb-1">Vigencia hasta</label>
                    <input
                      type="date"
                      value={docValidTo}
                      onChange={(e) => setDocValidTo(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                      style={cardStyle}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowDocForm(false)}
                    className={rowActionBtnClass}
                    style={cardStyle}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingDoc}
                    className="text-white font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: primaryActionColor }}
                  >
                    <Save size={13} /> {savingDoc ? 'Guardando...' : 'Guardar Documento'}
                  </button>
                </div>
              </form>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className={listHeaderTitleClass}>
                <History size={13} className="opacity-80" /> HISTORIAL DOCUMENTAL
              </span>
              <span className={listCounterBadgeClass} style={innerStyle}>
                {documentHistory.length} doc(s)
              </span>
            </div>

            <div className="space-y-3">
              {documentHistory.length === 0 ? (
                <div
                  className="p-4 rounded-xl border border-black/20 text-xs opacity-80"
                  style={innerStyle}
                >
                  No hay documentación cargada aún. Usá &ldquo;+ Cargar Documentación&rdquo; para agregarla.
                </div>
              ) : (
                documentHistory.map((docItem) => {
                  const isEditingDoc = editingDocKey === docItem.key;
                  const validity = getValidityStatus(docItem.validTo);
                  const audit = normalizeAuditStatus(docItem.auditStatus);

                  return (
                    <div
                      key={docItem.key}
                      className="p-4 rounded-xl border border-black/20 space-y-2.5 text-xs"
                      style={innerStyle}
                    >
                      {isEditingDoc ? (
                        <div className="space-y-2.5">
                          <div className="font-bold">{docItem.docType}</div>
                          <input
                            type="text"
                            value={editDocUrl}
                            onChange={(e) => setEditDocUrl(e.target.value)}
                            placeholder="URL del documento"
                            className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                            style={cardStyle}
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] opacity-80 mb-1">Vigencia desde</label>
                              <input
                                type="date"
                                value={editDocValidFrom}
                                onChange={(e) => setEditDocValidFrom(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                                style={cardStyle}
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] opacity-80 mb-1">Vigencia hasta</label>
                              <input
                                type="date"
                                value={editDocValidTo}
                                onChange={(e) => setEditDocValidTo(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                                style={cardStyle}
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingDocKey(null)}
                              className={rowActionBtnClass}
                              style={cardStyle}
                            >
                              <X size={12} /> Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveDocumentEdit(docItem)}
                              disabled={updatingDoc}
                              className="text-white font-bold px-3 py-1.5 rounded-lg text-xs inline-flex items-center gap-1 cursor-pointer"
                              style={{ backgroundColor: primaryActionColor }}
                            >
                              <Save size={12} /> {updatingDoc ? 'Guardando...' : 'Guardar'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm">{docItem.docType}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${getSemanticBadgeClass(
                                  validity.tone
                                )}`}
                              >
                                {validity.label}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${getSemanticBadgeClass(
                                  audit.tone
                                )}`}
                                title="Estado de verificación en TrustLink"
                              >
                                {audit.isVerified && <BadgeCheck size={12} />}
                                {audit.label}
                              </span>
                            </div>
                            {docItem.url && (
                              <p className="opacity-80 truncate">{docItem.url}</p>
                            )}
                            <p className="opacity-80">
                              Vigencia: {formatDateShort(docItem.validFrom)} — {formatDateShort(docItem.validTo)}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => startEditingDocument(docItem)}
                            className={rowActionBtnClass}
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
          </section>

          {/* COLUMNA DERECHA: Especialidades y Credenciales */}
          <section
            className="p-6 rounded-2xl border border-black/20 space-y-5"
            style={cardStyle}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Award size={18} className="text-emerald-400 shrink-0" /> Especialidades y Credenciales
              </h3>
              <button
                type="button"
                onClick={() => setShowSpecialtyForm((prev) => !prev)}
                className="text-white font-bold px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 transition-opacity hover:opacity-90 cursor-pointer shrink-0"
                style={{ backgroundColor: primaryActionColor }}
              >
                {showSpecialtyForm ? <X size={14} /> : <Plus size={14} />}
                {showSpecialtyForm ? 'Cerrar' : 'Cargar Especialidad'}
              </button>
            </div>

            {showSpecialtyForm && (
              <form
                onSubmit={handleCreateSpecialty}
                className="p-4 rounded-xl border border-black/20 space-y-3 text-xs"
                style={innerStyle}
              >
                <p className="font-bold">Nueva Especialidad</p>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    required
                    value={newSpecialty}
                    onChange={(e) => setNewSpecialty(e.target.value)}
                    placeholder="Nueva especialidad (ej: Plomero Matriculado)"
                    className="flex-1 px-3 py-2 rounded-xl border border-white/15 text-xs focus:outline-none"
                    style={cardStyle}
                  />
                  <button
                    type="submit"
                    disabled={savingSpecialty}
                    className="text-white font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50 shrink-0"
                    style={{ backgroundColor: primaryActionColor }}
                  >
                    <Plus size={14} /> {savingSpecialty ? 'Agregando...' : 'Agregar'}
                  </button>
                </div>
              </form>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className={listHeaderTitleClass}>
                <ShieldCheck size={13} className="opacity-80" /> ESPECIALIDADES CARGADAS
              </span>
              <span className={listCounterBadgeClass} style={innerStyle}>
                {activeSpecialtiesCount} activa(s)
              </span>
            </div>

            <div className="space-y-3">
              {profileData.providers.length === 0 ? (
                <div
                  className="p-4 rounded-xl border border-black/20 text-xs opacity-80"
                  style={innerStyle}
                >
                  No tenés especialidades registradas aún. Usá &ldquo;+ Cargar Especialidad&rdquo; para agregar una.
                </div>
              ) : (
                profileData.providers.map((p) => {
                  const isEditing = editingSpecialtyId === p.id;
                  const isHidden = Boolean(hiddenSpecialtyIds[p.id]);
                  const specAudit = normalizeAuditStatus(p.status);

                  return (
                    <div
                      key={p.id}
                      className="p-4 rounded-xl border border-black/20 space-y-2.5 text-xs"
                      style={innerStyle}
                    >
                      {isEditing ? (
                        <div className="space-y-2.5">
                          <input
                            type="text"
                            value={editSpecialtyName}
                            onChange={(e) => setEditSpecialtyName(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                            style={cardStyle}
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingSpecialtyId(null)}
                              className={rowActionBtnClass}
                              style={cardStyle}
                            >
                              <X size={12} /> Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveSpecialtyEdit(p)}
                              disabled={updatingSpecialty}
                              className="text-white font-bold px-3 py-1.5 rounded-lg text-xs inline-flex items-center gap-1 cursor-pointer"
                              style={{ backgroundColor: primaryActionColor }}
                            >
                              <Save size={12} /> {updatingSpecialty ? 'Guardando...' : 'Guardar'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm">{p.specialty}</span>
                              {/* Estado de verificación con tilde + color semántico */}
                              <span
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${getSemanticBadgeClass(
                                  specAudit.tone
                                )}`}
                              >
                                {specAudit.isVerified && <BadgeCheck size={12} />}
                                {specAudit.isVerified ? 'Verificada' : specAudit.label}
                              </span>
                              {/* Visibilidad para residentes diferenciada */}
                              <span
                                className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                                  isHidden
                                    ? 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                                    : 'bg-sky-500/15 text-sky-300 border-sky-500/35'
                                }`}
                              >
                                {isHidden ? <EyeOff size={11} /> : <Eye size={11} />}
                                {isHidden ? 'Oculta' : 'Visible'}
                              </span>
                            </div>
                            <p className="opacity-80">
                              {specAudit.isVerified
                                ? isHidden
                                  ? 'Verificada por TrustLink, pero oculta para residentes por tu configuración.'
                                  : 'Verificada y habilitada para mostrarse a residentes en la red.'
                                : 'Pendiente de verificación de TrustLink para habilitarse a residentes.'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleSpecialtyVisibility(p.id)}
                              className={rowActionBtnClass}
                              style={cardStyle}
                            >
                              {isHidden ? <Eye size={12} /> : <EyeOff size={12} />}
                              {isHidden ? 'Mostrar' : 'Ocultar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSpecialtyId(p.id);
                                setEditSpecialtyName(p.specialty || '');
                              }}
                              className={rowActionBtnClass}
                              style={cardStyle}
                            >
                              <Edit3 size={12} /> Editar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      ) : activeStep === 'vehicles' ? (
        /* =====================================================================
           PASO 2: FLOTA VEHICULAR HABILITADA
           ===================================================================== */
        <section
          className="p-6 rounded-2xl border border-black/20 space-y-5"
          style={cardStyle}
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-bold flex items-center gap-2">
              <Car size={18} className="text-sky-400" /> Flota Vehicular Habilitada
            </h3>
            <div className="flex items-center gap-2.5">
              <span className={listCounterBadgeClass} style={innerStyle}>
                {profileData.vehicles.length} vehículo(s)
              </span>
              <button
                type="button"
                onClick={() => setShowVehicleForm((prev) => !prev)}
                className="text-white font-bold px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer"
                style={{ backgroundColor: primaryActionColor }}
              >
                {showVehicleForm ? <X size={14} /> : <Plus size={14} />}
                {showVehicleForm ? 'Cerrar' : 'Cargar Vehículo'}
              </button>
            </div>
          </div>

          {showVehicleForm && (
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
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingVehicle}
                  className="text-white font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: primaryActionColor }}
                >
                  <Plus size={14} /> {savingVehicle ? 'Registrando...' : 'Registrar Vehículo'}
                </button>
              </div>
            </form>
          )}

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
                        className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${getSemanticBadgeClass(
                          'info'
                        )}`}
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
        </section>
      ) : (
        /* =====================================================================
           PASO 3: REPUTACIÓN CRUZADA
           ===================================================================== */
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
                <h3 className="text-base font-bold">Servicios Realizados &amp; Reputación Cruzada</h3>
                <p className="text-xs opacity-80">
                  Visualizá las reseñas recibidas de residentes y calificá tu experiencia en cada domicilio.
                </p>
              </div>
            </div>
            <span className={listCounterBadgeClass} style={innerStyle}>
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
                          {'★'.repeat(item.provider_review_rating)} ({item.provider_review_rating}/5)
                        </span>
                        {item.provider_review_comment && (
                          <span className="opacity-85 italic">
                            &ldquo;{item.provider_review_comment}&rdquo;
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
      )}
    </div>
  );
}