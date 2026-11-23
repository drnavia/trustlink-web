/**
 * @file ProviderDashboard.jsx
 * @description Portal del Prestador con secuencia operativa rigurosa de 6 pasos:
 * 1. Credenciales, 2. Flota Vehicular, 3. Agenda, 4. Visitas, 5. Pases QR y 6. Reseñas.
 * @location /trustlink-web/src/modules/provider/ProviderDashboard.jsx
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  FileText,
  Award,
  Eye,
  EyeOff,
  History,
  RefreshCw,
  QrCode,
  Search,
  Copy,
  Check,
  Calendar,
  MapPin,
  Trash2,
  Clock,
} from 'lucide-react';
import { useBranding, DEFAULT_BRANDING_CONFIG } from '../branding/BrandingContext';

export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL && String(import.meta.env.VITE_API_BASE_URL).trim()) ||
  'http://localhost:4000';

const PASSES_PER_PAGE = 6;

const toLocalDateTimeInput = (dateObj) => {
  const pad = (n) => String(n).padStart(2, '0');
  const y = dateObj.getFullYear();
  const m = pad(dateObj.getMonth() + 1);
  const d = pad(dateObj.getDate());
  const hh = pad(dateObj.getHours());
  const mm = pad(dateObj.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
};

function getValidityStatus(expiryDateStr) {
  if (!expiryDateStr) {
    return { label: 'Sin fecha', tone: 'neutral' };
  }

  const parsed = new Date(expiryDateStr);
  if (Number.isNaN(parsed.getTime())) {
    return { label: 'Sin fecha', tone: 'neutral' };
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

function formatDateShort(dateStr) {
  if (!dateStr) return 'Sin fecha';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return 'Sin fecha';
  return parsed.toLocaleDateString('es-AR');
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toDateInputValue(dateStr) {
  if (!dateStr) return '';
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr.slice(0, 10);
  }
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function getPassStatusBadge(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'pending') {
    return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  }
  if (normalized === 'used') {
    return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
  }
  if (normalized === 'expired') {
    return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  }
  if (normalized === 'cancelled') {
    return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
  }
  return 'bg-slate-800 text-slate-300 border-slate-700';
}

function getPassStatusLabel(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'pending') return 'Vigente / Pendiente';
  if (normalized === 'used') return 'Utilizado';
  if (normalized === 'expired') return 'Vencido';
  if (normalized === 'cancelled') return 'Cancelado';
  return status || 'Sin estado';
}

function getBlockTypeLabel(blockType) {
  const t = String(blockType || '').toLowerCase();
  if (t === 'external_visit') return 'Visita Externa';
  if (t === 'trustlink_visit') return 'Visita TrustLink';
  if (t === 'trustlink_pass') return 'Pase QR Bloqueado';
  return 'Horario No Laborable';
}

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

  const primaryActionColor = brand.primaryColor || brand.accentColor || '#10b981';

  // Orden riguroso: 'credentials' -> 'vehicles' -> 'schedule' -> 'visits' -> 'passes' -> 'reviews'
  const [activeStep, setActiveStep] = useState('credentials');

  const [profileData, setProfileData] = useState({ providers: [], vehicles: [] });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Credenciales
  const [showDocForm, setShowDocForm] = useState(false);
  const [docType, setDocType] = useState('Antecedentes Penales');
  const [docUrl, setDocUrl] = useState('');
  const [docValidFrom, setDocValidFrom] = useState('');
  const [docValidTo, setDocValidTo] = useState('');
  const [savingDoc, setSavingDoc] = useState(false);

  const [editingDocKey, setEditingDocKey] = useState(null);
  const [editDocUrl, setEditDocUrl] = useState('');
  const [editDocValidFrom, setEditDocValidFrom] = useState('');
  const [editDocValidTo, setEditDocValidTo] = useState('');
  const [updatingDoc, setUpdatingDoc] = useState(false);

  const [showSpecialtyForm, setShowSpecialtyForm] = useState(false);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [savingSpecialty, setSavingSpecialty] = useState(false);
  const [hiddenSpecialtyIds, setHiddenSpecialtyIds] = useState({});
  const [editingSpecialtyId, setEditingSpecialtyId] = useState(null);
  const [editSpecialtyName, setEditSpecialtyName] = useState('');
  const [updatingSpecialty, setUpdatingSpecialty] = useState(false);

  // 2. Flota Vehicular
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vehType, setVehType] = useState('utilitario');
  const [vehBrand, setVehBrand] = useState('');
  const [vehModel, setVehModel] = useState('');
  const [vehColor, setVehColor] = useState('');
  const [vehPlate, setVehPlate] = useState('');
  const [savingVehicle, setSavingVehicle] = useState(false);

  // 3. Agenda
  const [scheduleBlocks, setScheduleBlocks] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [blockType, setBlockType] = useState('unavailable');
  const [blockTitle, setBlockTitle] = useState('');
  const [blockStart, setBlockStart] = useState(() =>
    toLocalDateTimeInput(new Date(Date.now() + 60 * 60 * 1000))
  );
  const [blockEnd, setBlockEnd] = useState(() =>
    toLocalDateTimeInput(new Date(Date.now() + 3 * 60 * 60 * 1000))
  );
  const [savingBlock, setSavingBlock] = useState(false);

  // 4. Visitas
  const [incomingVisits, setIncomingVisits] = useState([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [visitReplyDrafts, setVisitReplyDrafts] = useState({});
  const [respondingVisitId, setRespondingVisitId] = useState(null);

  // 5. Pases QR
  const [assignedPasses, setAssignedPasses] = useState([]);
  const [loadingPasses, setLoadingPasses] = useState(false);
  const [passesError, setPassesError] = useState('');
  const [passSearch, setPassSearch] = useState('');
  const [passStatusFilter, setPassStatusFilter] = useState('all');
  const [passPage, setPassPage] = useState(1);
  const [copiedPassId, setCopiedPassId] = useState(null);
  const [selectedPassModal, setSelectedPassModal] = useState(null);

  // 6. Reseñas
  const [reviewContracts, setReviewContracts] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [ownerRatingDrafts, setOwnerRatingDrafts] = useState({});
  const [ownerCommentDrafts, setOwnerCommentDrafts] = useState({});
  const [submittingOwnerReviewId, setSubmittingOwnerReviewId] = useState(null);

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
  });

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

  const fetchProviderSchedule = async () => {
    setLoadingSchedule(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/schedule/provider`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setScheduleBlocks(data.blocks || []);
      }
    } catch (error) {
      console.error('Error al cargar agenda del prestador:', error);
    } finally {
      setLoadingSchedule(false);
    }
  };

  const fetchIncomingVisits = async () => {
    setLoadingVisits(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/visit-requests/provider`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setIncomingVisits(data.visits || []);
      }
    } catch (error) {
      console.error('Error al cargar solicitudes de visita:', error);
    } finally {
      setLoadingVisits(false);
    }
  };

  const fetchAssignedPasses = async () => {
    setLoadingPasses(true);
    setPassesError('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/provider`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setAssignedPasses(data.passes || data.items || []);
      } else {
        setPassesError(
          data.error || 'No se pudieron cargar los pases QR asignados al prestador.'
        );
      }
    } catch (error) {
      console.error('Error al cargar pases QR del prestador:', error);
      setPassesError('Error de conexión al consultar los pases QR.');
    } finally {
      setLoadingPasses(false);
    }
  };

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
      console.error('Error al cargar historial de contratos del prestador:', error);
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    fetchProviderProfile();
    fetchProviderSchedule();
    fetchIncomingVisits();
    fetchAssignedPasses();
    fetchProviderReviewContracts();
  }, []);

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
            specialty: prof.specialty || '',
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
            specialty: prof.specialty || '',
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
            specialty: prof.specialty || '',
          });
        }
      }
    });

    return items;
  }, [profileData.providers]);

  const activeSpecialtiesCount = useMemo(() => {
    return (profileData.providers || []).filter((p) => !hiddenSpecialtyIds[p.id]).length;
  }, [profileData.providers, hiddenSpecialtyIds]);

  const handleCreateDocument = async (e) => {
    e.preventDefault();
    setSavingDoc(true);
    setErrorMsg('');
    setSuccessMsg('');

    const baseProfile = profileData.providers[0] || {};
    const isArt = docType.toLowerCase().includes('art') || docType.toLowerCase().includes('seguro');

    const payload = {
      specialty: baseProfile.specialty || 'Servicios Verificados',
      criminal_record_url: !isArt ? docUrl.trim() : baseProfile.criminal_record_url || '',
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

  const startEditingDocument = (docItem) => {
    setEditingDocKey(docItem.key);
    setEditDocUrl(docItem.url || '');
    setEditDocValidFrom(toDateInputValue(docItem.validFrom));
    setEditDocValidTo(toDateInputValue(docItem.validTo));
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSaveDocumentEdit = async (docItem) => {
    setUpdatingDoc(true);
    setErrorMsg('');
    setSuccessMsg('');

    const targetProfile =
      profileData.providers.find((p) => p.id === docItem.profileId) || profileData.providers[0] || {};
    const isArt = docItem.field === 'art' || docItem.docType.toLowerCase().includes('art');

    const payload = {
      specialty: targetProfile.specialty || 'Servicios Verificados',
      criminal_record_url: !isArt ? editDocUrl.trim() : targetProfile.criminal_record_url || '',
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

  const toggleSpecialtyVisibility = (specialtyId) => {
    setHiddenSpecialtyIds((prev) => ({
      ...prev,
      [specialtyId]: !prev[specialtyId],
    }));
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

  const handleCreateScheduleBlock = async (e) => {
    e.preventDefault();
    setSavingBlock(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/schedule/blocks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          block_type: blockType,
          title: blockTitle.trim(),
          start_at: new Date(blockStart).toISOString(),
          end_at: new Date(blockEnd).toISOString(),
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(data.message || 'Bloque agregado a tu agenda.');
        setBlockTitle('');
        await fetchProviderSchedule();
      } else {
        setErrorMsg(data.error || 'No se pudo guardar el bloque en la agenda.');
      }
    } catch (error) {
      console.error('Error al guardar bloque de agenda:', error);
      setErrorMsg('Error de conexión al guardar en la agenda.');
    } finally {
      setSavingBlock(false);
    }
  };

  const handleDeleteScheduleBlock = async (blockId) => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/schedule/blocks/${blockId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        setSuccessMsg('Bloque eliminado de la agenda.');
        await fetchProviderSchedule();
      }
    } catch (error) {
      console.error('Error al eliminar bloque:', error);
    }
  };

  const handleRespondVisit = async (visitId, action) => {
    setRespondingVisitId(visitId);
    setErrorMsg('');
    setSuccessMsg('');
    const replyText = String(visitReplyDrafts[visitId] || '').trim();

    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/visit-requests/${visitId}/respond`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          action,
          reply_text: replyText || undefined,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(data.message || 'Respuesta registrada en la visita.');
        setVisitReplyDrafts((prev) => ({ ...prev, [visitId]: '' }));
        await Promise.all([fetchIncomingVisits(), fetchProviderSchedule()]);
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar la visita.');
      }
    } catch (error) {
      console.error('Error al responder visita:', error);
      setErrorMsg('Error de conexión al responder la visita.');
    } finally {
      setRespondingVisitId(null);
    }
  };

  const handleCopyToken = async (tokenValue, passId) => {
    if (!tokenValue) return;
    try {
      await navigator.clipboard.writeText(tokenValue);
      setCopiedPassId(passId);
      setTimeout(() => setCopiedPassId(null), 1800);
    } catch (err) {
      console.error('No se pudo copiar el token:', err);
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

  const filteredPasses = useMemo(() => {
    const q = passSearch.trim().toLowerCase();
    return assignedPasses.filter((item) => {
      const status = String(item.status || '').toLowerCase();
      const matchesStatus = passStatusFilter === 'all' || status === passStatusFilter;
      const residentName = `${item.owner_first_name || ''} ${item.owner_last_name || ''} ${
        item.authorized_by || ''
      }`.toLowerCase();
      const dest = `${item.fraction_number || ''} ${item.lot_number || ''}`.toLowerCase();
      const plate = String(item.vehicle_plate || item.plate || '').toLowerCase();
      const token = String(item.qr_token || '').toLowerCase();

      const matchesQuery =
        !q ||
        residentName.includes(q) ||
        dest.includes(q) ||
        plate.includes(q) ||
        token.includes(q) ||
        String(item.id).includes(q);

      return matchesStatus && matchesQuery;
    });
  }, [assignedPasses, passSearch, passStatusFilter]);

  const totalPassPages = Math.max(1, Math.ceil(filteredPasses.length / PASSES_PER_PAGE));
  const paginatedPasses = useMemo(() => {
    const safePage = Math.min(passPage, totalPassPages);
    const startIdx = (safePage - 1) * PASSES_PER_PAGE;
    return filteredPasses.slice(startIdx, startIdx + PASSES_PER_PAGE);
  }, [filteredPasses, passPage, totalPassPages]);

  const activePassesCount = assignedPasses.filter(
    (p) => String(p.status || '').toLowerCase() === 'pending'
  ).length;

  const pendingVisitsCount = incomingVisits.filter(
    (v) => String(v.status || '').toLowerCase() === 'pending_provider'
  ).length;

  const primaryProfile = profileData.providers[0] || null;
  const profileStatus = primaryProfile?.status || 'Pendiente';

  const listHeaderTitleClass =
    'text-[11px] font-bold uppercase tracking-wider opacity-85 flex items-center gap-1.5';
  const listCounterBadgeClass =
    'text-[11px] font-mono px-2.5 py-0.5 rounded-lg border border-white/15 shrink-0';
  const rowActionBtnClass =
    'px-2.5 py-1.5 rounded-lg border border-white/15 text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-opacity hover:opacity-85 shrink-0';

  // Secuencia rigurosa de 6 pasos
  const steps = [
    {
      id: 'credentials',
      label: '1. Credenciales',
      count: profileData.providers.length,
      icon: ShieldCheck,
    },
    {
      id: 'vehicles',
      label: '2. Flota Vehicular',
      count: profileData.vehicles.length,
      icon: Car,
    },
    {
      id: 'schedule',
      label: '3. Agenda',
      count: scheduleBlocks.length,
      icon: Calendar,
    },
    {
      id: 'visits',
      label: '4. Visitas',
      count: pendingVisitsCount || incomingVisits.length,
      icon: MessageSquare,
    },
    {
      id: 'passes',
      label: '5. Pases QR',
      count: activePassesCount || assignedPasses.length,
      icon: QrCode,
    },
    {
      id: 'reviews',
      label: '6. Reseñas',
      count: reviewContracts.length,
      icon: Star,
    },
  ];

  return (
    <div className="max-w-6xl w-full mx-auto px-4 md:px-8 py-6 space-y-6">
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
              <h2 className="text-xl font-black tracking-tight">Portal Prestador</h2>
              <p className="text-xs opacity-80">
                Credenciales, flota vehicular, agenda online, visitas, pases QR y reseñas cruzadas.
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
              className="text-xs font-bold px-3 py-1.5 rounded-xl border border-white/15"
              style={innerStyle}
            >
              Estado: {profileStatus}
            </span>
            <button
              type="button"
              onClick={() => {
                fetchProviderProfile();
                fetchProviderSchedule();
                fetchIncomingVisits();
                fetchAssignedPasses();
                fetchProviderReviewContracts();
              }}
              className="text-xs font-bold px-3 py-1.5 rounded-xl border border-white/15 inline-flex items-center gap-1.5 cursor-pointer hover:opacity-85"
              style={innerStyle}
            >
              <RefreshCw size={13} /> Actualizar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {steps.map((step) => {
            const IconComponent = step.icon;
            const isSelected = activeStep === step.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between gap-1.5 border transition-all cursor-pointer ${
                  isSelected
                    ? 'text-white border-emerald-400/50 shadow-sm'
                    : 'border-white/15 opacity-80 hover:opacity-100'
                }`}
                style={isSelected ? { backgroundColor: primaryActionColor } : innerStyle}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <IconComponent size={13} className="shrink-0" />
                  <span className="truncate">{step.label}</span>
                </span>
                <span className="font-mono px-1.5 py-0.5 rounded bg-black/20 text-[11px] shrink-0">
                  {step.count}
                </span>
              </button>
            );
          })}
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
      ) : activeStep === 'credentials' ? (
        /* 1. CREDENCIALES */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <section className="p-6 rounded-2xl border border-black/20 space-y-5" style={cardStyle}>
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
                <div className="p-4 rounded-xl border border-black/20 text-xs opacity-80" style={innerStyle}>
                  No hay documentación cargada aún. Usá &ldquo;+ Cargar Documentación&rdquo; para agregarla.
                </div>
              ) : (
                documentHistory.map((docItem) => {
                  const isEditingDoc = editingDocKey === docItem.key;
                  const validity = getValidityStatus(docItem.validTo);

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
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm">{docItem.docType}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded border border-white/15 ${
                                  validity.tone === 'success'
                                    ? 'bg-emerald-600/25 text-emerald-300'
                                    : validity.tone === 'warning'
                                    ? 'bg-amber-600/25 text-amber-300'
                                    : validity.tone === 'danger'
                                    ? 'bg-rose-600/25 text-rose-300'
                                    : ''
                                }`}
                                style={validity.tone === 'neutral' ? cardStyle : undefined}
                              >
                                {validity.label}
                              </span>
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded border border-white/15"
                                style={cardStyle}
                              >
                                Validado TrustLink: {docItem.auditStatus}
                              </span>
                            </div>
                            {docItem.url && <p className="opacity-80 truncate">{docItem.url}</p>}
                            <p className="opacity-80">
                              Vigencia: {formatDateShort(docItem.validFrom)} —{' '}
                              {formatDateShort(docItem.validTo)}
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

          <section className="p-6 rounded-2xl border border-black/20 space-y-5" style={cardStyle}>
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
                <div className="p-4 rounded-xl border border-black/20 text-xs opacity-80" style={innerStyle}>
                  No tenés especialidades registradas aún. Usá &ldquo;+ Cargar Especialidad&rdquo; para agregar una.
                </div>
              ) : (
                profileData.providers.map((p) => {
                  const isEditing = editingSpecialtyId === p.id;
                  const isHidden = Boolean(hiddenSpecialtyIds[p.id]);

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
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm">{p.specialty}</span>
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded border border-white/15"
                                style={cardStyle}
                              >
                                {p.status === 'approved' ? 'Aprobada' : 'Pendiente'}
                              </span>
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded border border-white/15"
                                style={cardStyle}
                              >
                                {isHidden ? 'Oculta' : 'Visible'}
                              </span>
                            </div>
                            <p className="opacity-80">
                              Pendiente de validación de TrustLink para habilitarse a residentes.
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
        /* 2. FLOTA VEHICULAR */
        <section className="p-6 rounded-2xl border border-black/20 space-y-5" style={cardStyle}>
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
              <div className="p-4 rounded-xl border border-black/20 text-xs opacity-80" style={innerStyle}>
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
        </section>
      ) : activeStep === 'schedule' ? (
        /* 3. AGENDA — DISPONIBILIDAD, BLOQUEOS, VISITAS EXTERNAS Y BLOQUEO AUTOMÁTICO */
        <section className="p-6 rounded-2xl border border-black/20 space-y-5" style={cardStyle}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                <Calendar size={18} className="text-emerald-400" /> Agenda Online y Disponibilidad
              </h3>
              <p className="text-xs opacity-80 mt-0.5">
                Bloqueá horarios no laborables, registrá visitas externas y revisá franjas ocupadas por TrustLink.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchProviderSchedule}
              className={rowActionBtnClass}
              style={innerStyle}
            >
              <RefreshCw size={13} className={loadingSchedule ? 'animate-spin' : ''} /> Actualizar
            </button>
          </div>

          <form
            onSubmit={handleCreateScheduleBlock}
            className="p-4 rounded-xl border border-black/20 space-y-3 text-xs"
            style={innerStyle}
          >
            <p className="font-bold flex items-center gap-1.5">
              <Clock size={14} className="text-emerald-400" /> Agregar Bloqueo o Visita Externa
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <select
                value={blockType}
                onChange={(e) => setBlockType(e.target.value)}
                className="px-3 py-2 rounded-xl border border-white/15 text-xs"
                style={cardStyle}
              >
                <option value="unavailable">Horario no laborable</option>
                <option value="external_visit">Visita externa (fuera de TrustLink)</option>
              </select>
              <input
                type="text"
                value={blockTitle}
                onChange={(e) => setBlockTitle(e.target.value)}
                placeholder="Detalle (ej: Descanso mediodía / Obra barrio norte)"
                className="sm:col-span-2 px-3 py-2 rounded-xl border border-white/15 text-xs"
                style={cardStyle}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] opacity-80 mb-1">Desde</label>
                <input
                  type="datetime-local"
                  value={blockStart}
                  onChange={(e) => setBlockStart(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                  style={cardStyle}
                />
              </div>
              <div>
                <label className="block text-[11px] opacity-80 mb-1">Hasta</label>
                <input
                  type="datetime-local"
                  value={blockEnd}
                  onChange={(e) => setBlockEnd(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                  style={cardStyle}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingBlock}
                className="text-white font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: primaryActionColor }}
              >
                <Plus size={14} /> {savingBlock ? 'Guardando...' : 'Bloquear Franja'}
              </button>
            </div>
          </form>

          {loadingSchedule ? (
            <p className="text-xs opacity-75 py-8 text-center">Cargando agenda del prestador...</p>
          ) : scheduleBlocks.length === 0 ? (
            <div className="p-6 rounded-xl border border-black/20 text-xs opacity-80 text-center" style={innerStyle}>
              Sin bloques registrados todavía. Las visitas confirmadas o pases QR emitidos también se reflejarán aquí automáticamente.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {scheduleBlocks.map((blk) => {
                const isManualBlock = !blk.source_ref;
                return (
                  <div
                    key={blk.id}
                    className="p-4 rounded-xl border border-black/20 space-y-2 text-xs"
                    style={innerStyle}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-sm">{blk.title || 'Bloque de agenda'}</span>
                        <p className="opacity-80 mt-0.5">
                          {formatDateTime(blk.start_at)} → {formatDateTime(blk.end_at)}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-white/15 shrink-0">
                        {getBlockTypeLabel(blk.block_type)}
                      </span>
                    </div>

                    {isManualBlock && (
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteScheduleBlock(blk.id)}
                          className="inline-flex items-center gap-1 text-rose-300 hover:text-rose-200 font-semibold cursor-pointer"
                        >
                          <Trash2 size={12} /> Quitar bloque
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : activeStep === 'visits' ? (
        /* 4. VISITAS — CONFIRMACIÓN BIDIRECCIONAL CON RESIDENTES */
        <section className="p-6 rounded-2xl border border-black/20 space-y-5" style={cardStyle}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                <MessageSquare size={18} className="text-emerald-400" /> Solicitudes y Confirmación de Visitas
              </h3>
              <p className="text-xs opacity-80 mt-0.5">
                Respondé a los residentes y confirmá tu disponibilidad para bloquear el horario y habilitar el Pase QR.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchIncomingVisits}
              className={rowActionBtnClass}
              style={innerStyle}
            >
              <RefreshCw size={13} className={loadingVisits ? 'animate-spin' : ''} /> Actualizar
            </button>
          </div>

          {loadingVisits ? (
            <p className="text-xs opacity-75 py-8 text-center">Cargando visitas solicitadas...</p>
          ) : incomingVisits.length === 0 ? (
            <div className="rounded-xl p-8 text-center text-xs opacity-75 border border-black/20" style={innerStyle}>
              Todavía no tenés solicitudes de visita pendientes de coordinación.
            </div>
          ) : (
            <div className="space-y-4">
              {incomingVisits.map((visit) => {
                const statusLower = String(visit.status || '').toLowerCase();
                const isConfirmed = statusLower === 'confirmed';
                const msgs = Array.isArray(visit.messages) ? visit.messages : [];

                return (
                  <article
                    key={visit.id}
                    className="rounded-xl p-4 border border-black/20 space-y-3 text-xs"
                    style={innerStyle}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-sm">
                          Visita #{visit.id} · {visit.owner_name || 'Residente'}
                        </span>
                        <p className="opacity-80 mt-0.5">
                          Destino: {visit.fraction_number || '—'} / {visit.lot_number || '—'} ·
                          Horario propuesto: {visit.preferred_date || 'A convenir'}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                          isConfirmed
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : statusLower === 'declined'
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {isConfirmed
                          ? 'Disponibilidad Confirmada'
                          : statusLower === 'declined'
                          ? 'Sin Disponibilidad'
                          : 'Pendiente de Confirmación'}
                      </span>
                    </div>

                    {msgs.length > 0 && (
                      <div className="rounded-lg p-3 bg-black/25 border border-white/10 space-y-1.5">
                        {msgs.map((m, idx) => (
                          <p key={m.id || idx} className="text-xs">
                            <strong className="uppercase text-[10px] opacity-75 mr-1.5">
                              {m.sender_role === 'provider' ? 'Prestador:' : 'Residente:'}
                            </strong>
                            <span>{m.text}</span>
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={visitReplyDrafts[visit.id] || ''}
                        onChange={(e) =>
                          setVisitReplyDrafts((prev) => ({
                            ...prev,
                            [visit.id]: e.target.value,
                          }))
                        }
                        placeholder="Escribí un mensaje o aclaración para el residente..."
                        className="flex-1 px-3 py-2 rounded-xl border border-white/15 text-xs"
                        style={cardStyle}
                      />

                      <button
                        type="button"
                        disabled={respondingVisitId === visit.id}
                        onClick={() => handleRespondVisit(visit.id, 'confirm')}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50 shrink-0"
                        style={{ backgroundColor: primaryActionColor }}
                      >
                        {respondingVisitId === visit.id
                          ? 'Guardando...'
                          : isConfirmed
                          ? 'Confirmada'
                          : 'Confirmar Disponibilidad'}
                      </button>

                      <button
                        type="button"
                        disabled={respondingVisitId === visit.id}
                        onClick={() => handleRespondVisit(visit.id, 'decline')}
                        className={rowActionBtnClass}
                        style={cardStyle}
                      >
                        Sin disponibilidad
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : activeStep === 'passes' ? (
        /* 5. PASES QR */
        <section className="p-6 rounded-2xl border border-black/20 space-y-5" style={cardStyle}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                <QrCode size={18} className="text-emerald-400" /> Pases QR Asignados para tu Ingreso
              </h3>
              <p className="text-xs opacity-80 mt-0.5">
                Consultá las autorizaciones emitidas por residentes con destino, vigencia y token QR.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60 pointer-events-none"
                />
                <input
                  type="text"
                  value={passSearch}
                  onChange={(e) => {
                    setPassSearch(e.target.value);
                    setPassPage(1);
                  }}
                  placeholder="Buscar residente, lote o patente..."
                  className="w-full sm:w-56 pl-8 pr-3 py-2 rounded-xl text-xs border border-white/15 focus:outline-none"
                  style={innerStyle}
                />
              </div>

              <select
                value={passStatusFilter}
                onChange={(e) => {
                  setPassStatusFilter(e.target.value);
                  setPassPage(1);
                }}
                className="px-3 py-2 rounded-xl text-xs border border-white/15 focus:outline-none"
                style={innerStyle}
              >
                <option value="all">Todos los estados</option>
                <option value="pending">Vigentes / Pendientes</option>
                <option value="used">Utilizados</option>
                <option value="expired">Vencidos</option>
                <option value="cancelled">Cancelados</option>
              </select>

              <button
                type="button"
                onClick={fetchAssignedPasses}
                className="p-2 rounded-xl border border-white/15 hover:opacity-85 cursor-pointer self-end sm:self-auto"
                style={innerStyle}
                title="Actualizar pases QR"
              >
                <RefreshCw size={15} className={loadingPasses ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {passesError && (
            <div className="rounded-xl p-3.5 text-xs border border-amber-700/60 bg-amber-950/40 text-amber-200">
              {passesError}
            </div>
          )}

          {loadingPasses ? (
            <p className="text-xs opacity-75 py-8 text-center">Cargando pases QR asignados...</p>
          ) : paginatedPasses.length === 0 ? (
            <div className="rounded-xl p-8 text-center text-xs opacity-75 border border-black/20" style={innerStyle}>
              No hay pases QR registrados para tu perfil con los filtros actuales.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {paginatedPasses.map((passItem) => {
                const ownerLabel =
                  `${passItem.owner_first_name || ''} ${passItem.owner_last_name || ''}`.trim() ||
                  passItem.authorized_by ||
                  'Residente';
                const plateLabel = passItem.vehicle_plate || passItem.plate || 'Ingreso peatonal';

                return (
                  <article
                    key={passItem.id}
                    className="rounded-xl p-4 border border-black/20 space-y-2.5 text-xs"
                    style={innerStyle}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-sm">Pase #{passItem.id}</span>
                        <p className="opacity-80 mt-0.5">Autorizó: {ownerLabel}</p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${getPassStatusBadge(
                          passItem.status
                        )}`}
                      >
                        {getPassStatusLabel(passItem.status)}
                      </span>
                    </div>

                    <div className="space-y-1 opacity-85">
                      <p className="flex items-center gap-1.5">
                        <MapPin size={13} className="text-emerald-400 shrink-0" />
                        <span>
                          Destino: {passItem.fraction_number || 'Sin fracción'} /{' '}
                          {passItem.lot_number || 'Sin lote'}
                        </span>
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Car size={13} className="text-sky-400 shrink-0" />
                        <span>Acceso: {plateLabel}</span>
                      </p>
                      <p className="flex items-center gap-1.5 text-[11px] opacity-80">
                        <Calendar size={13} className="text-amber-400 shrink-0" />
                        <span>
                          Vigencia: {formatDateTime(passItem.start_time)} →{' '}
                          {formatDateTime(passItem.end_time)}
                        </span>
                      </p>
                    </div>

                    {passItem.qr_token && (
                      <div className="pt-1 flex items-center justify-between gap-2 bg-black/25 px-2.5 py-1.5 rounded-lg border border-white/10">
                        <code className="text-[11px] truncate">{passItem.qr_token}</code>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyToken(passItem.qr_token, passItem.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer"
                          >
                            {copiedPassId === passItem.id ? (
                              <>
                                <Check size={12} className="text-emerald-400" /> Copiado
                              </>
                            ) : (
                              <>
                                <Copy size={12} /> Copiar
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedPassModal(passItem)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer"
                            title="Ver detalle del token QR"
                          >
                            <QrCode size={12} /> Ver
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {filteredPasses.length > PASSES_PER_PAGE && (
            <div className="flex items-center justify-between pt-2 text-xs">
              <span className="opacity-75">
                Página {Math.min(passPage, totalPassPages)} de {totalPassPages} (
                {filteredPasses.length} pases)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={passPage <= 1}
                  onClick={() => setPassPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-white/15 font-bold disabled:opacity-40 cursor-pointer"
                  style={innerStyle}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={passPage >= totalPassPages}
                  onClick={() => setPassPage((p) => Math.min(totalPassPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-white/15 font-bold disabled:opacity-40 cursor-pointer"
                  style={innerStyle}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </section>
      ) : (
        /* 6. RESEÑAS */
        <section className="p-6 rounded-2xl border border-black/20 space-y-5" style={cardStyle}>
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
            <div className="text-center py-8 rounded-xl border border-black/20 text-xs" style={innerStyle}>
              Cargando historial de servicios...
            </div>
          ) : reviewContracts.length === 0 ? (
            <div className="text-center py-8 rounded-xl border border-black/20 text-xs opacity-85" style={innerStyle}>
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
                      <div className="p-3 rounded-lg border border-white/15 text-xs" style={cardStyle}>
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

      {selectedPassModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div
            className="w-full max-w-md rounded-2xl p-6 border border-slate-700/80 shadow-2xl space-y-4 text-xs"
            style={cardStyle}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold">Pase QR #{selectedPassModal.id}</h3>
                <p className="opacity-75">
                  Estado: {getPassStatusLabel(selectedPassModal.status)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPassModal(null)}
                className="p-1.5 rounded-lg border border-white/15 cursor-pointer"
                style={innerStyle}
              >
                <X size={15} />
              </button>
            </div>

            <div className="rounded-xl p-3.5 border border-white/15 space-y-1.5" style={innerStyle}>
              <p>
                <strong>Destino:</strong> {selectedPassModal.fraction_number || '—'} /{' '}
                {selectedPassModal.lot_number || '—'}
              </p>
              <p>
                <strong>Acceso:</strong>{' '}
                {selectedPassModal.vehicle_plate || selectedPassModal.plate || 'Ingreso peatonal'}
              </p>
              <p>
                <strong>Desde:</strong> {formatDateTime(selectedPassModal.start_time)}
              </p>
              <p>
                <strong>Hasta:</strong> {formatDateTime(selectedPassModal.end_time)}
              </p>
            </div>

            <div className="rounded-xl p-3 bg-black/35 border border-white/15 space-y-2">
              <span className="block text-[10px] font-bold uppercase opacity-75">
                Token QR para validación en garita
              </span>
              <code className="block font-mono text-[11px] break-all select-all">
                {selectedPassModal.qr_token}
              </code>
              <button
                type="button"
                onClick={() => handleCopyToken(selectedPassModal.qr_token, 'modal-pass')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white cursor-pointer"
                style={{ backgroundColor: primaryActionColor }}
              >
                {copiedPassId === 'modal-pass' ? (
                  <>
                    <Check size={13} /> Token Copiado
                  </>
                ) : (
                  <>
                    <Copy size={13} /> Copiar Token
                  </>
                )}
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPassModal(null)}
                className="px-4 py-2 rounded-xl font-bold border border-white/15 cursor-pointer"
                style={innerStyle}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}