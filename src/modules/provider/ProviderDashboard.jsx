/**
 * @file ProviderDashboard.jsx
 * @description Portal del Prestador unificado estéticamente y en ritmo UX/UI con Portal Residente.
 * Secuencia operativa rigurosa de 6 pasos:
 * 1. Credenciales, 2. Flota Vehicular, 3. Agenda, 4. Visitas, 5. Pases QR y 6. Reseñas.
 * @location /trustlink-web/src/modules/provider/ProviderDashboard.jsx
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
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
  Users,
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';
import { API_BASE } from '../../config/api';
import QrCodeDisplay from '../../components/QrCodeDisplay';

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
    return 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60';
  }
  if (normalized === 'used') {
    return 'bg-sky-950/80 text-sky-300 border-sky-700/60';
  }
  if (normalized === 'expired') {
    return 'bg-amber-950/80 text-amber-300 border-amber-700/60';
  }
  if (normalized === 'cancelled') {
    return 'bg-rose-950/80 text-rose-300 border-rose-700/60';
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

  // Mismos tokens de superficie y acción primaria que ResidentDashboard
  const primaryColor = brand?.primaryActionColor || brand?.primaryColor || '#059669';

  const cardStyle = {
    backgroundColor: brand?.cardBgColor || '#020617',
    color: brand?.cardTextColor || '#F1F5F9',
  };

  const innerStyle = {
    backgroundColor: brand?.innerBgColor || '#0F172A',
    color: brand?.innerTextColor || '#E2E8F0',
  };

  // Orden riguroso: 'credentials' -> 'vehicles' -> 'schedule' -> 'visits' -> 'passes' -> 'reviews'
  const [activeStep, setActiveStep] = useState('credentials');

  const [profileData, setProfileData] = useState({ providers: [], vehicles: [], employees: [] });
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
  const [vehInsuranceUrl, setVehInsuranceUrl] = useState('');
  const [vehInsuranceFrom, setVehInsuranceFrom] = useState('');
  const [vehInsuranceExpiry, setVehInsuranceExpiry] = useState('');
  const [savingVehicle, setSavingVehicle] = useState(false);

  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [editVehType, setEditVehType] = useState('utilitario');
  const [editVehBrand, setEditVehBrand] = useState('');
  const [editVehModel, setEditVehModel] = useState('');
  const [editVehColor, setEditVehColor] = useState('');
  const [editVehPlate, setEditVehPlate] = useState('');
  const [editVehInsuranceUrl, setEditVehInsuranceUrl] = useState('');
  const [editVehInsuranceFrom, setEditVehInsuranceFrom] = useState('');
  const [editVehInsuranceExpiry, setEditVehInsuranceExpiry] = useState('');
  const [updatingVehicle, setUpdatingVehicle] = useState(false);

  // 2b. Ayudantes / Cuadrilla
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [empFullName, setEmpFullName] = useState('');
  const [empDni, setEmpDni] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empRoleLabel, setEmpRoleLabel] = useState('Ayudante');
  const [empInsuranceUrl, setEmpInsuranceUrl] = useState('');
  const [empInsuranceExpiry, setEmpInsuranceExpiry] = useState('');
  const [savingEmployee, setSavingEmployee] = useState(false);

  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const [editEmpFullName, setEditEmpFullName] = useState('');
  const [editEmpDni, setEditEmpDni] = useState('');
  const [editEmpPhone, setEditEmpPhone] = useState('');
  const [editEmpRoleLabel, setEditEmpRoleLabel] = useState('Ayudante');
  const [editEmpInsuranceUrl, setEditEmpInsuranceUrl] = useState('');
  const [editEmpInsuranceExpiry, setEditEmpInsuranceExpiry] = useState('');
  const [updatingEmployee, setUpdatingEmployee] = useState(false);

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
          employees: data.employees || [],
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
      const response = await fetch(`${API_BASE}/api/v1/reviews/contracts?portal=provider`, {
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
      criminal_record_from: !isArt ? docValidFrom || null : null,
      criminal_record_expiry: !isArt
        ? docValidTo || null
        : baseProfile.criminal_record_expiry || null,
      art_insurance_url: isArt
        ? docUrl.trim()
        : baseProfile.art_insurance_url || baseProfile.insurance_policy_url || '',
      insurance_policy_url: isArt
        ? docUrl.trim()
        : baseProfile.insurance_policy_url || baseProfile.art_insurance_url || '',
      insurance_from: isArt ? docValidFrom || null : null,
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
      const method = baseProfile.id ? 'PATCH' : 'POST';

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
      criminal_record_from: !isArt ? editDocValidFrom || null : null,
      criminal_record_expiry: !isArt
        ? editDocValidTo || null
        : targetProfile.criminal_record_expiry || null,
      art_insurance_url: isArt
        ? editDocUrl.trim()
        : targetProfile.art_insurance_url || targetProfile.insurance_policy_url || '',
      insurance_policy_url: isArt
        ? editDocUrl.trim()
        : targetProfile.insurance_policy_url || targetProfile.art_insurance_url || '',
      insurance_from: isArt ? editDocValidFrom || null : null,
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
        method: 'PATCH',
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
          insurance_policy_url:
            currentDoc.insurance_policy_url || currentDoc.art_insurance_url || '',
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
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          specialty: editSpecialtyName.trim(),
          criminal_record_url: specialtyItem.criminal_record_url || '',
          insurance_policy_url:
            specialtyItem.insurance_policy_url || specialtyItem.art_insurance_url || '',
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
      const response = await fetch(`${API_BASE}/api/v1/providers/vehicle`, {
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
          plate: vehPlate.trim().toUpperCase(),
          vehicle_insurance_url: vehInsuranceUrl.trim() || null,
          vehicle_insurance_from: vehInsuranceFrom || null,
          vehicle_insurance_expiry: vehInsuranceExpiry || null,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg('Vehículo y seguro automotor asociados a tu flota correctamente.');
        setVehBrand('');
        setVehModel('');
        setVehColor('');
        setVehPlate('');
        setVehInsuranceUrl('');
        setVehInsuranceFrom('');
        setVehInsuranceExpiry('');
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

  const startEditingVehicle = (v) => {
    setEditingVehicleId(v.id);
    setEditVehType(v.vehicle_type || 'utilitario');
    setEditVehBrand(v.brand || '');
    setEditVehModel(v.model || '');
    setEditVehColor(v.color || '');
    setEditVehPlate(v.plate || v.license_plate || '');
    setEditVehInsuranceUrl(v.vehicle_insurance_url || '');
    setEditVehInsuranceFrom(toDateInputValue(v.vehicle_insurance_from));
    setEditVehInsuranceExpiry(toDateInputValue(v.vehicle_insurance_expiry));
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSaveVehicleEdit = async (vehicleId) => {
    setUpdatingVehicle(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/vehicle/${vehicleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          vehicle_type: editVehType,
          brand: editVehBrand.trim(),
          model: editVehModel.trim(),
          color: editVehColor.trim(),
          plate: editVehPlate.trim().toUpperCase(),
          vehicle_insurance_url: editVehInsuranceUrl.trim() || null,
          vehicle_insurance_from: editVehInsuranceFrom || null,
          vehicle_insurance_expiry: editVehInsuranceExpiry || null,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg('Vehículo y póliza de seguro actualizados correctamente.');
        setEditingVehicleId(null);
        await fetchProviderProfile();
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar el vehículo.');
      }
    } catch (error) {
      console.error('Error al actualizar vehículo:', error);
      setErrorMsg('Error de conexión al actualizar el vehículo.');
    } finally {
      setUpdatingVehicle(false);
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setSavingEmployee(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/employees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          full_name: empFullName.trim(),
          dni: empDni.trim(),
          phone: empPhone.trim() || null,
          role_label: empRoleLabel.trim() || 'Ayudante',
          insurance_policy_url: empInsuranceUrl.trim() || null,
          insurance_expiry: empInsuranceExpiry || null,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(data.message || 'Ayudante agregado a tu cuadrilla.');
        setEmpFullName('');
        setEmpDni('');
        setEmpPhone('');
        setEmpRoleLabel('Ayudante');
        setEmpInsuranceUrl('');
        setEmpInsuranceExpiry('');
        setShowEmployeeForm(false);
        await fetchProviderProfile();
      } else {
        setErrorMsg(data.error || 'No se pudo registrar el ayudante.');
      }
    } catch (error) {
      console.error('Error al registrar ayudante:', error);
      setErrorMsg('Error de conexión al registrar el ayudante.');
    } finally {
      setSavingEmployee(false);
    }
  };

  const startEditingEmployee = (emp) => {
    setEditingEmployeeId(emp.id);
    setEditEmpFullName(emp.full_name || '');
    setEditEmpDni(emp.dni || '');
    setEditEmpPhone(emp.phone || '');
    setEditEmpRoleLabel(emp.role_label || 'Ayudante');
    setEditEmpInsuranceUrl(emp.insurance_policy_url || '');
    setEditEmpInsuranceExpiry(toDateInputValue(emp.insurance_expiry));
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSaveEmployeeEdit = async (empId) => {
    setUpdatingEmployee(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/employees/${empId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          full_name: editEmpFullName.trim(),
          dni: editEmpDni.trim(),
          phone: editEmpPhone.trim() || null,
          role_label: editEmpRoleLabel.trim() || 'Ayudante',
          insurance_policy_url: editEmpInsuranceUrl.trim() || null,
          insurance_expiry: editEmpInsuranceExpiry || null,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(data.message || 'Ayudante actualizado correctamente.');
        setEditingEmployeeId(null);
        await fetchProviderProfile();
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar el ayudante.');
      }
    } catch (error) {
      console.error('Error al actualizar ayudante:', error);
      setErrorMsg('Error de conexión al actualizar el ayudante.');
    } finally {
      setUpdatingEmployee(false);
    }
  };

  const handleDeleteEmployee = async (empId) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/employees/${empId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        setSuccessMsg('Ayudante eliminado de tu cuadrilla.');
        await fetchProviderProfile();
      }
    } catch (error) {
      console.error('Error al eliminar ayudante:', error);
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
      const response = await fetch(`${API_BASE}/api/v1/reviews/owner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          contract_id: contractId,
          rating: ratingVal,
          comment: commentVal || null,
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
    'text-[11px] font-mono px-2.5 py-0.5 rounded-full border border-slate-700/80 shrink-0';
  const rowActionBtnClass =
    'px-2.5 py-1.5 rounded-xl border border-slate-700/80 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-opacity hover:opacity-90 shrink-0';

  const steps = [
    {
      id: 'credentials',
      stepNumber: 1,
      label: 'Credenciales',
      count: profileData.providers.length,
      icon: ShieldCheck,
    },
    {
      id: 'vehicles',
      stepNumber: 2,
      label: 'Flota Vehicular',
      count: profileData.vehicles.length,
      icon: Car,
    },
    {
      id: 'schedule',
      stepNumber: 3,
      label: 'Agenda',
      count: scheduleBlocks.length,
      icon: Calendar,
    },
    {
      id: 'visits',
      stepNumber: 4,
      label: 'Visitas',
      count: pendingVisitsCount || incomingVisits.length,
      icon: MessageSquare,
    },
    {
      id: 'passes',
      stepNumber: 5,
      label: 'Pases QR',
      count: activePassesCount || assignedPasses.length,
      icon: QrCode,
    },
    {
      id: 'reviews',
      stepNumber: 6,
      label: 'Reseñas',
      count: reviewContracts.length,
      icon: Star,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-8 space-y-6">
      {/* Cabecera principal alineada estéticamente con Portal Residente */}
      <div
        className="rounded-2xl p-5 sm:p-6 border border-slate-800/80 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        style={cardStyle}
      >
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
            <ShieldCheck size={14} />
            <span>Portal Prestador</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Credenciales, agenda, visitas y pases QR
          </h1>
          <p className="text-xs sm:text-sm opacity-80">
            Gestioná tu documentación verificada, flota, disponibilidad online, visitas y reseñas cruzadas.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <span
            className="text-xs font-bold px-3 py-2 rounded-xl border border-slate-700/80 inline-flex items-center gap-1.5"
            style={innerStyle}
          >
            <Star size={13} className="text-amber-400 fill-amber-400" />
            <span>Scoring: {Number(primaryProfile?.rating_avg || 0).toFixed(2)}</span>
          </span>
          <span
            className="text-xs font-bold px-3 py-2 rounded-xl border border-slate-700/80"
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
            className="p-2 rounded-xl border border-slate-700/80 hover:opacity-90 cursor-pointer"
            style={innerStyle}
            title="Actualizar información del prestador"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Selector de pasos en grilla unificada */}
      <div
        className="rounded-2xl p-2 border border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2"
        style={cardStyle}
      >
        {steps.map((step) => {
          const IconComponent = step.icon;
          const isSelected = activeStep === step.id;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setActiveStep(step.id)}
              className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                isSelected
                  ? 'text-white border-transparent shadow-sm'
                  : 'border-slate-800/70 opacity-85 hover:opacity-100'
              }`}
              style={isSelected ? { backgroundColor: primaryColor } : innerStyle}
            >
              <span className="flex items-center gap-1.5 truncate">
                <IconComponent size={14} className="shrink-0" />
                <span className="truncate">
                  {step.stepNumber}. {step.label}
                </span>
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/25 shrink-0">
                {step.count}
              </span>
            </button>
          );
        })}
      </div>

      {errorMsg && (
        <div className="rounded-2xl p-4 border border-rose-800/70 bg-rose-950/50 text-rose-200 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="rounded-2xl p-4 border border-emerald-700/70 bg-emerald-950/50 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div
          className="rounded-2xl p-10 border border-slate-800/80 text-center text-xs opacity-75 flex items-center justify-center gap-2"
          style={cardStyle}
        >
          <Loader2 className="animate-spin" size={16} />
          <span>Cargando información del prestador...</span>
        </div>
      ) : activeStep === 'credentials' ? (
        /* 1. CREDENCIALES */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <section
            className="rounded-2xl p-5 border border-slate-800/80 space-y-4"
            style={cardStyle}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <FileText size={18} className="text-emerald-400 shrink-0" />
                  <span>Documentación Personal</span>
                </h2>
                <p className="text-xs opacity-75">
                  Antecedentes penales, póliza ART/seguro y fechas de vigencia.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDocForm((prev) => !prev)}
                className="text-white font-bold px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 transition-opacity hover:opacity-95 cursor-pointer shrink-0 shadow-sm"
                style={{ backgroundColor: primaryColor }}
              >
                {showDocForm ? <X size={14} /> : <Plus size={14} />}
                {showDocForm ? 'Cerrar' : 'Cargar'}
              </button>
            </div>

            {showDocForm && (
              <form
                onSubmit={handleCreateDocument}
                className="p-4 rounded-xl border border-slate-800/70 space-y-3 text-xs"
                style={innerStyle}
              >
                <p className="font-bold">Nuevo Documento de Compliance</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
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
                    className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
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
                      className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                      style={cardStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] opacity-80 mb-1">Vigencia hasta</label>
                    <input
                      type="date"
                      value={docValidTo}
                      onChange={(e) => setDocValidTo(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
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
                    style={{ backgroundColor: primaryColor }}
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
                  className="p-4 rounded-xl border border-slate-800/70 text-xs opacity-80"
                  style={innerStyle}
                >
                  No hay documentación cargada aún. Usá &ldquo;+ Cargar&rdquo; para agregarla.
                </div>
              ) : (
                documentHistory.map((docItem) => {
                  const isEditingDoc = editingDocKey === docItem.key;
                  const validity = getValidityStatus(docItem.validTo);

                  return (
                    <div
                      key={docItem.key}
                      className="p-4 rounded-xl border border-slate-800/70 space-y-2.5 text-xs"
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
                            className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                            style={cardStyle}
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] opacity-80 mb-1">Vigencia desde</label>
                              <input
                                type="date"
                                value={editDocValidFrom}
                                onChange={(e) => setEditDocValidFrom(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                                style={cardStyle}
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] opacity-80 mb-1">Vigencia hasta</label>
                              <input
                                type="date"
                                value={editDocValidTo}
                                onChange={(e) => setEditDocValidTo(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
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
                              className="text-white font-bold px-3 py-1.5 rounded-xl text-xs inline-flex items-center gap-1 cursor-pointer"
                              style={{ backgroundColor: primaryColor }}
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
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                  validity.tone === 'success'
                                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                                    : validity.tone === 'warning'
                                    ? 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                                    : validity.tone === 'danger'
                                    ? 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                                    : 'border-slate-700'
                                }`}
                                style={validity.tone === 'neutral' ? cardStyle : undefined}
                              >
                                {validity.label}
                              </span>
                              <span
                                className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-slate-700"
                                style={cardStyle}
                              >
                                Validado: {docItem.auditStatus}
                              </span>
                            </div>
                            {docItem.url && <p className="opacity-80 truncate">{docItem.url}</p>}
                            <p className="opacity-75">
                              Vigencia: {formatDateShort(docItem.validFrom)} →{' '}
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

          <section
            className="rounded-2xl p-5 border border-slate-800/80 space-y-4"
            style={cardStyle}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <Award size={18} className="text-emerald-400 shrink-0" />
                  <span>Especialidades y Credenciales</span>
                </h2>
                <p className="text-xs opacity-75">
                  Administrá tus rubros habilitados y su visibilidad en el directorio.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSpecialtyForm((prev) => !prev)}
                className="text-white font-bold px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 transition-opacity hover:opacity-95 cursor-pointer shrink-0 shadow-sm"
                style={{ backgroundColor: primaryColor }}
              >
                {showSpecialtyForm ? <X size={14} /> : <Plus size={14} />}
                {showSpecialtyForm ? 'Cerrar' : 'Agregar'}
              </button>
            </div>

            {showSpecialtyForm && (
              <form
                onSubmit={handleCreateSpecialty}
                className="p-4 rounded-xl border border-slate-800/70 space-y-3 text-xs"
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
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-700/80 text-xs focus:outline-none"
                    style={cardStyle}
                  />
                  <button
                    type="submit"
                    disabled={savingSpecialty}
                    className="text-white font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center justify-center gap-1.5 transition-opacity hover:opacity-95 cursor-pointer disabled:opacity-50 shrink-0"
                    style={{ backgroundColor: primaryColor }}
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
                  className="p-4 rounded-xl border border-slate-800/70 text-xs opacity-80"
                  style={innerStyle}
                >
                  No tenés especialidades registradas aún. Usá &ldquo;+ Agregar&rdquo; para cargar una.
                </div>
              ) : (
                profileData.providers.map((p) => {
                  const isEditing = editingSpecialtyId === p.id;
                  const isHidden = Boolean(hiddenSpecialtyIds[p.id]);

                  return (
                    <div
                      key={p.id}
                      className="p-4 rounded-xl border border-slate-800/70 space-y-2.5 text-xs"
                      style={innerStyle}
                    >
                      {isEditing ? (
                        <div className="space-y-2.5">
                          <input
                            type="text"
                            value={editSpecialtyName}
                            onChange={(e) => setEditSpecialtyName(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
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
                              className="text-white font-bold px-3 py-1.5 rounded-xl text-xs inline-flex items-center gap-1 cursor-pointer"
                              style={{ backgroundColor: primaryColor }}
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
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                  p.status === 'approved'
                                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                                    : 'border-slate-700'
                                }`}
                                style={p.status === 'approved' ? undefined : cardStyle}
                              >
                                {p.status === 'approved' ? 'Aprobada' : 'Pendiente'}
                              </span>
                              <span
                                className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-slate-700"
                                style={cardStyle}
                              >
                                {isHidden ? 'Oculta' : 'Visible'}
                              </span>
                            </div>
                            <p className="opacity-75">
                              {p.status === 'approved'
                                ? 'Habilitada y visible según tu configuración en el directorio.'
                                : 'Pendiente de validación de TrustLink para habilitarse a residentes.'}
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
        <section
          className="rounded-2xl p-5 border border-slate-800/80 space-y-4"
          style={cardStyle}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Car size={18} className="text-emerald-400 shrink-0" />
                <span>Flota Vehicular Habilitada</span>
              </h2>
              <p className="text-xs opacity-75">
                Asociá los vehículos y patentes con los que ingresás a los barrios privados.
              </p>
            </div>
            <div className="flex items-center gap-2.5 self-start sm:self-auto">
              <span className={listCounterBadgeClass} style={innerStyle}>
                {profileData.vehicles.length} vehículo(s)
              </span>
              <button
                type="button"
                onClick={() => setShowVehicleForm((prev) => !prev)}
                className="text-white font-bold px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                style={{ backgroundColor: primaryColor }}
              >
                {showVehicleForm ? <X size={14} /> : <Plus size={14} />}
                {showVehicleForm ? 'Cerrar' : 'Cargar Vehículo'}
              </button>
            </div>
          </div>

          {showVehicleForm && (
            <form
              onSubmit={handleAddVehicle}
              className="p-4 rounded-xl border border-slate-800/70 space-y-3 text-xs"
              style={innerStyle}
            >
              <p className="font-bold">Asociar Vehículo</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <select
                  value={vehType}
                  onChange={(e) => setVehType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                  style={cardStyle}
                />
                <input
                  type="text"
                  required
                  value={vehColor}
                  onChange={(e) => setVehColor(e.target.value)}
                  placeholder="Color (ej: Blanco)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                  style={cardStyle}
                />
                <input
                  type="text"
                  required
                  value={vehPlate}
                  onChange={(e) => setVehPlate(e.target.value)}
                  placeholder="Patente (ej: AF123CD)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs uppercase"
                  style={cardStyle}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="url"
                  value={vehInsuranceUrl}
                  onChange={(e) => setVehInsuranceUrl(e.target.value)}
                  placeholder="URL Póliza de Seguro Automotor (opcional)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                  style={cardStyle}
                />
                <input
                  type="date"
                  value={vehInsuranceFrom}
                  onChange={(e) => setVehInsuranceFrom(e.target.value)}
                  title="Seguro vigente desde"
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                  style={cardStyle}
                />
                <input
                  type="date"
                  value={vehInsuranceExpiry}
                  onChange={(e) => setVehInsuranceExpiry(e.target.value)}
                  title="Vencimiento del seguro"
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                  style={cardStyle}
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingVehicle}
                  className="text-white font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Plus size={14} /> {savingVehicle ? 'Registrando...' : 'Registrar Vehículo'}
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {profileData.vehicles.length === 0 ? (
              <div
                className="md:col-span-2 p-8 rounded-xl border border-slate-800/70 text-xs opacity-75 text-center"
                style={innerStyle}
              >
                Sin vehículos registrados en tu flota.
              </div>
            ) : (
              profileData.vehicles.map((v) => {
                const isEditing = editingVehicleId === v.id;
                const insValidity = getValidityStatus(v.vehicle_insurance_expiry);

                return (
                  <div
                    key={v.id}
                    className="p-4 rounded-xl border border-slate-800/70 space-y-2.5 text-xs"
                    style={innerStyle}
                  >
                    {isEditing ? (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={editVehType}
                            onChange={(e) => setEditVehType(e.target.value)}
                            className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs"
                            style={cardStyle}
                          >
                            <option value="utilitario">Utilitario</option>
                            <option value="auto">Automóvil</option>
                            <option value="moto">Motocicleta</option>
                            <option value="camioneta">Camioneta</option>
                          </select>
                          <input
                            type="text"
                            value={editVehPlate}
                            onChange={(e) => setEditVehPlate(e.target.value.toUpperCase())}
                            placeholder="Patente"
                            className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs font-mono uppercase"
                            style={cardStyle}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={editVehBrand}
                            onChange={(e) => setEditVehBrand(e.target.value)}
                            placeholder="Marca"
                            className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs"
                            style={cardStyle}
                          />
                          <input
                            type="text"
                            value={editVehModel}
                            onChange={(e) => setEditVehModel(e.target.value)}
                            placeholder="Modelo"
                            className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs"
                            style={cardStyle}
                          />
                          <input
                            type="text"
                            value={editVehColor}
                            onChange={(e) => setEditVehColor(e.target.value)}
                            placeholder="Color"
                            className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs"
                            style={cardStyle}
                          />
                        </div>
                        <input
                          type="url"
                          value={editVehInsuranceUrl}
                          onChange={(e) => setEditVehInsuranceUrl(e.target.value)}
                          placeholder="URL Póliza de Seguro Automotor"
                          className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs"
                          style={cardStyle}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="date"
                            value={editVehInsuranceFrom}
                            onChange={(e) => setEditVehInsuranceFrom(e.target.value)}
                            className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs"
                            style={cardStyle}
                          />
                          <input
                            type="date"
                            value={editVehInsuranceExpiry}
                            onChange={(e) => setEditVehInsuranceExpiry(e.target.value)}
                            className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs"
                            style={cardStyle}
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingVehicleId(null)}
                            className={rowActionBtnClass}
                            style={cardStyle}
                          >
                            <X size={12} /> Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={updatingVehicle}
                            onClick={() => handleSaveVehicleEdit(v.id)}
                            className="text-white font-bold px-3 py-1.5 rounded-xl text-xs inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            style={{ backgroundColor: primaryColor }}
                          >
                            <Save size={12} /> {updatingVehicle ? 'Guardando...' : 'Guardar'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm">
                              {v.brand} {v.model}
                            </span>
                            <span
                              className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border border-slate-700"
                              style={cardStyle}
                            >
                              {v.vehicle_type}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                insValidity.tone === 'success'
                                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                                  : insValidity.tone === 'warning'
                                  ? 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                                  : insValidity.tone === 'danger'
                                  ? 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                                  : 'border-slate-700'
                              }`}
                              style={insValidity.tone === 'neutral' ? cardStyle : undefined}
                            >
                              Seguro: {v.vehicle_insurance_url ? insValidity.label : 'Sin póliza'}
                            </span>
                          </div>
                          <p className="opacity-80">
                            Color: {v.color || '-'} · Patente:{' '}
                            <strong className="font-mono">{v.license_plate || v.plate}</strong>
                          </p>
                          {(v.vehicle_insurance_url || v.vehicle_insurance_expiry) && (
                            <p className="opacity-75 text-[11px]">
                              Vigencia seguro: {formatDateShort(v.vehicle_insurance_from)} →{' '}
                              {formatDateShort(v.vehicle_insurance_expiry)}
                              {v.vehicle_insurance_url && (
                                <>
                                  {' · '}
                                  <a
                                    href={v.vehicle_insurance_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sky-400 hover:underline font-semibold"
                                  >
                                    Ver póliza
                                  </a>
                                </>
                              )}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => startEditingVehicle(v)}
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

          {/* Subsección: Ayudantes y Cuadrilla Habilitada */}
          <div className="pt-4 border-t border-slate-800/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Users size={17} className="text-sky-400 shrink-0" />
                  <span>Ayudantes y Cuadrilla Habilitada</span>
                </h3>
                <p className="text-xs opacity-75">
                  Declará a los ayudantes que te acompañan en obras o mantenimientos con DNI y seguro ART.
                </p>
              </div>
              <div className="flex items-center gap-2.5 self-start sm:self-auto">
                <span className={listCounterBadgeClass} style={innerStyle}>
                  {(profileData.employees || []).length} ayudante(s)
                </span>
                <button
                  type="button"
                  onClick={() => setShowEmployeeForm((prev) => !prev)}
                  className="text-white font-bold px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                  style={{ backgroundColor: primaryColor }}
                >
                  {showEmployeeForm ? <X size={14} /> : <Plus size={14} />}
                  {showEmployeeForm ? 'Cerrar' : 'Agregar Ayudante'}
                </button>
              </div>
            </div>

            {showEmployeeForm && (
              <form
                onSubmit={handleAddEmployee}
                className="p-4 rounded-xl border border-slate-800/70 space-y-3 text-xs"
                style={innerStyle}
              >
                <p className="font-bold">Nuevo Ayudante / Integrante</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    required
                    value={empFullName}
                    onChange={(e) => setEmpFullName(e.target.value)}
                    placeholder="Nombre y Apellido"
                    className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                    style={cardStyle}
                  />
                  <input
                    type="text"
                    required
                    value={empDni}
                    onChange={(e) => setEmpDni(e.target.value)}
                    placeholder="DNI (ej: 38123456)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs font-mono"
                    style={cardStyle}
                  />
                  <input
                    type="text"
                    value={empRoleLabel}
                    onChange={(e) => setEmpRoleLabel(e.target.value)}
                    placeholder="Rol (ej: Oficial, Ayudante)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                    style={cardStyle}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    value={empPhone}
                    onChange={(e) => setEmpPhone(e.target.value)}
                    placeholder="Teléfono (opcional)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                    style={cardStyle}
                  />
                  <input
                    type="url"
                    value={empInsuranceUrl}
                    onChange={(e) => setEmpInsuranceUrl(e.target.value)}
                    placeholder="URL Póliza ART / Seguro (opcional)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                    style={cardStyle}
                  />
                  <input
                    type="date"
                    value={empInsuranceExpiry}
                    onChange={(e) => setEmpInsuranceExpiry(e.target.value)}
                    title="Vencimiento de ART / Seguro"
                    className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                    style={cardStyle}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingEmployee}
                    className="text-white font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Plus size={14} /> {savingEmployee ? 'Registrando...' : 'Registrar Ayudante'}
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(profileData.employees || []).length === 0 ? (
                <div
                  className="md:col-span-2 p-6 rounded-xl border border-slate-800/70 text-xs opacity-75 text-center"
                  style={innerStyle}
                >
                  Sin ayudantes registrados en tu cuadrilla.
                </div>
              ) : (
                (profileData.employees || []).map((emp) => {
                  const isEditingEmp = editingEmployeeId === emp.id;
                  const insVal = getValidityStatus(emp.insurance_expiry);

                  return (
                    <div
                      key={emp.id}
                      className="p-4 rounded-xl border border-slate-800/70 space-y-2.5 text-xs"
                      style={innerStyle}
                    >
                      {isEditingEmp ? (
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={editEmpFullName}
                              onChange={(e) => setEditEmpFullName(e.target.value)}
                              placeholder="Nombre y Apellido"
                              className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs"
                              style={cardStyle}
                            />
                            <input
                              type="text"
                              value={editEmpDni}
                              onChange={(e) => setEditEmpDni(e.target.value)}
                              placeholder="DNI"
                              className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs font-mono"
                              style={cardStyle}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={editEmpRoleLabel}
                              onChange={(e) => setEditEmpRoleLabel(e.target.value)}
                              placeholder="Rol"
                              className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs"
                              style={cardStyle}
                            />
                            <input
                              type="text"
                              value={editEmpPhone}
                              onChange={(e) => setEditEmpPhone(e.target.value)}
                              placeholder="Teléfono"
                              className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs"
                              style={cardStyle}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="url"
                              value={editEmpInsuranceUrl}
                              onChange={(e) => setEditEmpInsuranceUrl(e.target.value)}
                              placeholder="URL Póliza ART"
                              className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs"
                              style={cardStyle}
                            />
                            <input
                              type="date"
                              value={editEmpInsuranceExpiry}
                              onChange={(e) => setEditEmpInsuranceExpiry(e.target.value)}
                              className="w-full px-2.5 py-2 rounded-xl border border-slate-700/80 text-xs"
                              style={cardStyle}
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingEmployeeId(null)}
                              className={rowActionBtnClass}
                              style={cardStyle}
                            >
                              <X size={12} /> Cancelar
                            </button>
                            <button
                              type="button"
                              disabled={updatingEmployee}
                              onClick={() => handleSaveEmployeeEdit(emp.id)}
                              className="text-white font-bold px-3 py-1.5 rounded-xl text-xs inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              style={{ backgroundColor: primaryColor }}
                            >
                              <Save size={12} /> {updatingEmployee ? 'Guardando...' : 'Guardar'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm">{emp.full_name}</span>
                              <span
                                className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-slate-700"
                                style={cardStyle}
                              >
                                {emp.role_label || 'Ayudante'}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                  insVal.tone === 'success'
                                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                                    : insVal.tone === 'warning'
                                    ? 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                                    : insVal.tone === 'danger'
                                    ? 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                                    : 'border-slate-700'
                                }`}
                                style={insVal.tone === 'neutral' ? cardStyle : undefined}
                              >
                                ART: {emp.insurance_policy_url ? insVal.label : 'Sin póliza'}
                              </span>
                            </div>
                            <p className="opacity-80">
                              DNI: <strong className="font-mono">{emp.dni || '-'}</strong>
                              {emp.phone ? ` · Tel: ${emp.phone}` : ''}
                            </p>
                            {(emp.insurance_policy_url || emp.insurance_expiry) && (
                              <p className="opacity-75 text-[11px]">
                                Vence: {formatDateShort(emp.insurance_expiry)}
                                {emp.insurance_policy_url && (
                                  <>
                                    {' · '}
                                    <a
                                      href={emp.insurance_policy_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sky-400 hover:underline font-semibold"
                                    >
                                      Ver póliza
                                    </a>
                                  </>
                                )}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => startEditingEmployee(emp)}
                              className={rowActionBtnClass}
                              style={cardStyle}
                            >
                              <Edit3 size={12} /> Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEmployee(emp.id)}
                              className={rowActionBtnClass}
                              style={cardStyle}
                              title="Eliminar ayudante"
                            >
                              <Trash2 size={12} className="text-rose-400" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      ) : activeStep === 'schedule' ? (
        /* 3. AGENDA */
        <section
          className="rounded-2xl p-5 border border-slate-800/80 space-y-4"
          style={cardStyle}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Calendar size={18} className="text-emerald-400 shrink-0" />
                <span>Agenda Online y Disponibilidad</span>
              </h2>
              <p className="text-xs opacity-75">
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
            className="p-4 rounded-xl border border-slate-800/70 space-y-3 text-xs"
            style={innerStyle}
          >
            <p className="font-bold flex items-center gap-1.5">
              <Clock size={14} className="text-emerald-400" /> Agregar Bloqueo o Visita Externa
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <select
                value={blockType}
                onChange={(e) => setBlockType(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
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
                className="sm:col-span-2 px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                  style={cardStyle}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingBlock}
                className="text-white font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: primaryColor }}
              >
                <Plus size={14} /> {savingBlock ? 'Guardando...' : 'Bloquear Franja'}
              </button>
            </div>
          </form>

          {loadingSchedule ? (
            <p className="text-xs opacity-75 py-8 text-center">Cargando agenda del prestador...</p>
          ) : scheduleBlocks.length === 0 ? (
            <div
              className="p-8 rounded-xl border border-slate-800/70 text-xs opacity-75 text-center"
              style={innerStyle}
            >
              Sin bloques registrados todavía. Las visitas confirmadas o pases QR emitidos también se reflejarán aquí automáticamente.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {scheduleBlocks.map((blk) => {
                const isManualBlock = !blk.source_ref;
                return (
                  <div
                    key={blk.id}
                    className="p-4 rounded-xl border border-slate-800/70 space-y-2 text-xs"
                    style={innerStyle}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-sm">{blk.title || 'Bloque de agenda'}</span>
                        <p className="opacity-80 mt-0.5">
                          {formatDateTime(blk.start_at)} → {formatDateTime(blk.end_at)}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-slate-700 shrink-0">
                        {getBlockTypeLabel(blk.block_type)}
                      </span>
                    </div>

                    {isManualBlock && (
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteScheduleBlock(blk.id)}
                          className="inline-flex items-center gap-1 text-rose-300 hover:text-rose-200 font-bold cursor-pointer"
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
        /* 4. VISITAS */
        <section
          className="rounded-2xl p-5 border border-slate-800/80 space-y-4"
          style={cardStyle}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <MessageSquare size={18} className="text-emerald-400 shrink-0" />
                <span>Solicitudes y Confirmación de Visitas</span>
              </h2>
              <p className="text-xs opacity-75">
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
            <div
              className="rounded-xl p-8 text-center text-xs opacity-75 border border-slate-800/70"
              style={innerStyle}
            >
              Todavía no tenés solicitudes de visita pendientes de coordinación.
            </div>
          ) : (
            <div className="space-y-3.5">
              {incomingVisits.map((visit) => {
                const statusLower = String(visit.status || '').toLowerCase();
                const isConfirmed = statusLower === 'confirmed';
                const msgs = Array.isArray(visit.messages) ? visit.messages : [];

                return (
                  <article
                    key={visit.id}
                    className="rounded-xl p-4 border border-slate-800/70 space-y-3 text-xs"
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
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                          isConfirmed
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                            : statusLower === 'declined'
                            ? 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                            : 'bg-amber-950/80 text-amber-300 border-amber-700/60'
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
                      <div className="rounded-lg p-3 bg-black/25 border border-slate-700/60 space-y-1.5">
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
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-700/80 text-xs"
                        style={cardStyle}
                      />

                      <button
                        type="button"
                        disabled={respondingVisitId === visit.id}
                        onClick={() => handleRespondVisit(visit.id, 'confirm')}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50 shrink-0"
                        style={{ backgroundColor: primaryColor }}
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
        <section
          className="rounded-2xl p-5 border border-slate-800/80 space-y-4"
          style={cardStyle}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <QrCode size={18} className="text-emerald-400 shrink-0" />
                <span>Pases QR Asignados para tu Ingreso</span>
              </h2>
              <p className="text-xs opacity-75">
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
                  className="w-full sm:w-56 pl-8 pr-3 py-2 rounded-xl text-xs border border-slate-700/80 focus:outline-none"
                  style={innerStyle}
                />
              </div>

              <select
                value={passStatusFilter}
                onChange={(e) => {
                  setPassStatusFilter(e.target.value);
                  setPassPage(1);
                }}
                className="px-3 py-2 rounded-xl text-xs border border-slate-700/80 focus:outline-none"
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
                className="p-2 rounded-xl border border-slate-700/80 hover:opacity-90 cursor-pointer self-end sm:self-auto"
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
            <div
              className="rounded-xl p-8 text-center text-xs opacity-75 border border-slate-800/70"
              style={innerStyle}
            >
              No hay pases QR registrados para tu perfil con los filtros actuales.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {paginatedPasses.map((passItem) => {
                const ownerLabel =
                  `${passItem.owner_first_name || ''} ${passItem.owner_last_name || ''}`.trim() ||
                  passItem.authorized_by ||
                  'Residente';
                const plateLabel = passItem.vehicle_plate || passItem.plate || 'Ingreso peatonal';

                return (
                  <article
                    key={passItem.id}
                    className="rounded-xl p-4 border border-slate-800/70 space-y-2.5 text-xs"
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
                      <p className="flex items-center gap-1.5 text-[11px] opacity-75">
                        <Calendar size={13} className="text-amber-400 shrink-0" />
                        <span>
                          Vigencia: {formatDateTime(passItem.start_time)} →{' '}
                          {formatDateTime(passItem.end_time)}
                        </span>
                      </p>
                    </div>

                    {passItem.qr_token && (
                      <div className="pt-1 flex items-center justify-between gap-2 bg-black/25 px-2.5 py-1.5 rounded-lg border border-slate-700/50">
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
                  className="px-3 py-1.5 rounded-lg border border-slate-700/80 font-bold disabled:opacity-40 cursor-pointer"
                  style={innerStyle}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={passPage >= totalPassPages}
                  onClick={() => setPassPage((p) => Math.min(totalPassPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-700/80 font-bold disabled:opacity-40 cursor-pointer"
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
        <section
          className="rounded-2xl p-5 border border-slate-800/80 space-y-4"
          style={cardStyle}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Star size={18} className="text-emerald-400 shrink-0" />
                <span>Servicios Realizados &amp; Reputación Cruzada</span>
              </h2>
              <p className="text-xs opacity-75">
                Visualizá las reseñas recibidas de residentes y calificá tu experiencia en cada domicilio.
              </p>
            </div>
            <span className={listCounterBadgeClass} style={innerStyle}>
              {reviewContracts.length} contrato(s)
            </span>
          </div>

          {loadingReviews ? (
            <p className="text-xs opacity-75 py-8 text-center">Cargando historial de servicios...</p>
          ) : reviewContracts.length === 0 ? (
            <div
              className="rounded-xl p-8 text-center text-xs opacity-75 border border-slate-800/70"
              style={innerStyle}
            >
              Aún no tenés contratos asignados en tu historial.
            </div>
          ) : (
            <div className="space-y-3">
              {reviewContracts.map((item) => {
                const ratingDraft = ownerRatingDrafts[item.contract_id] || 5;
                const commentDraft = ownerCommentDrafts[item.contract_id] || '';
                const alreadyRatedOwner = Boolean(item.owner_review_id);

                return (
                  <div
                    key={item.contract_id}
                    className="p-4 rounded-xl border border-slate-800/70 space-y-3 text-xs"
                    style={innerStyle}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">
                          Contrato #{item.contract_id} ·{' '}
                          {`${item.owner_first_name || ''} ${item.owner_last_name || ''}`.trim() ||
                            item.owner_name ||
                            'Residente Verificado'}
                        </span>
                      </div>
                      <span className="uppercase text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-slate-700">
                        {item.contract_status || item.status}
                      </span>
                    </div>

                    <p className="opacity-85">{item.description}</p>

                    {item.provider_review_rating && (
                      <div className="rounded-lg p-2.5 bg-emerald-950/30 border border-emerald-800/40 text-xs">
                        <span className="font-bold text-emerald-300">
                          Reseña recibida del residente: ★ {item.provider_review_rating}/5
                        </span>
                        {item.provider_review_comment && (
                          <p className="opacity-85 mt-0.5">
                            &ldquo;{item.provider_review_comment}&rdquo;
                          </p>
                        )}
                      </div>
                    )}

                    {alreadyRatedOwner ? (
                      <div
                        className="p-3 rounded-lg border border-slate-700/80 text-xs"
                        style={cardStyle}
                      >
                        Tu calificación al residente: ★ {item.owner_review_rating}/5
                        {item.owner_review_comment ? ` — "${item.owner_review_comment}"` : ''}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center pt-1">
                        <select
                          value={ratingDraft}
                          onChange={(e) =>
                            setOwnerRatingDrafts((prev) => ({
                              ...prev,
                              [item.contract_id]: Number(e.target.value),
                            }))
                          }
                          className="sm:col-span-3 px-3 py-2 rounded-xl text-xs border border-slate-700/80"
                          style={cardStyle}
                        >
                          <option value={5}>★★★★★ (5/5)</option>
                          <option value={4}>★★★★☆ (4/5)</option>
                          <option value={3}>★★★☆☆ (3/5)</option>
                          <option value={2}>★★☆☆☆ (2/5)</option>
                          <option value={1}>★☆☆☆☆ (1/5)</option>
                        </select>

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
                          className="sm:col-span-6 px-3 py-2 rounded-xl text-xs border border-slate-700/80"
                          style={cardStyle}
                        />

                        <button
                          type="button"
                          onClick={() => handleSubmitOwnerReview(item.contract_id)}
                          disabled={submittingOwnerReviewId === item.contract_id}
                          className="sm:col-span-3 py-2 px-3 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <Send size={13} />
                          {submittingOwnerReviewId === item.contract_id
                            ? 'Enviando...'
                            : 'Calificar Residente'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Modal para visualizar el token QR completo */}
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
                className="p-1 rounded-lg opacity-75 hover:opacity-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-xl p-3.5 border border-slate-800/70 space-y-1.5" style={innerStyle}>
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

            <QrCodeDisplay token={selectedPassModal.qr_token} size={200} />

            <div className="rounded-xl p-3 bg-black/30 border border-slate-700/60 space-y-2">
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
                style={{ backgroundColor: primaryColor }}
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
                className="px-4 py-2 rounded-xl font-bold border border-slate-700/80 cursor-pointer"
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