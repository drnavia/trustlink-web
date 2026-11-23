/**
 * @file ProviderDashboard.jsx
 * @description Portal del Prestador conectado 100% a PostgreSQL mediante API REST.
 * Unifica la pestaña "3. Reseñas" y el encabezado "Reseñas y reputación cruzada"
 * con el Portal Residente, manteniendo la estética y funcionalidad de Credenciales
 * y Flota Vehicular.
 * @location /trustlink-web/src/modules/provider/ProviderDashboard.jsx
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  RefreshCw,
  Award,
  FileText,
  History,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';
import { useAuth } from '../auth/AuthContext';
import { API_BASE } from '../../config/api'; // Ajustá la cantidad de ../ según la carpeta del archivo

/* const API_BASE = 'http://localhost:4000'; */

/**
 * Traduce el estado de validación de TrustLink a etiqueta y estilo en español.
 */
function formatTrustlinkValidationStatus(status) {
  const normalized = (status || 'pending').toLowerCase();
  if (normalized === 'approved') {
    return {
      label: 'Verificado',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
      isVerified: true,
    };
  }
  if (normalized === 'rejected') {
    return {
      label: 'Rechazado',
      badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
      isVerified: false,
    };
  }
  return {
    label: 'Pendiente',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
    isVerified: false,
  };
}

/**
 * Traduce el estado de especialidad de forma concisa.
 */
function formatSpecialtyStatus(status) {
  const normalized = (status || 'pending').toLowerCase();
  if (normalized === 'approved') {
    return {
      label: 'Verificada',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
      isVerified: true,
    };
  }
  if (normalized === 'rejected') {
    return {
      label: 'Rechazada',
      badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
      isVerified: false,
    };
  }
  return {
    label: 'Pendiente',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
    isVerified: false,
  };
}

/**
 * Normaliza un valor de fecha a YYYY-MM-DD para inputs de tipo date.
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
 */
function formatDisplayDate(dateStr) {
  const isoDate = toDateInputValue(dateStr);
  if (!isoDate) return 'Sin fecha';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Evalúa la vigencia de un documento o póliza según las fechas Desde / Hasta.
 */
function resolveDateValidity(fromStr, untilStr) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const fromIso = toDateInputValue(fromStr);
  const untilIso = toDateInputValue(untilStr);

  if (untilIso && untilIso < todayIso) {
    return {
      label: 'Vencido',
      badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
    };
  }
  if (fromIso && fromIso > todayIso) {
    return {
      label: 'Vigencia futura',
      badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/35',
    };
  }
  if (fromIso || untilIso) {
    return {
      label: 'Vigente',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
    };
  }
  return {
    label: 'Sin seguro / Sin fecha',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
  };
}

export default function ProviderDashboard() {
  const { brand } = useBranding();
  const { user } = useAuth();

  const cardStyle = {
    backgroundColor: brand?.cardBgColor || '#020617',
    color: brand?.cardTextColor || '#F1F5F9',
  };

  const innerStyle = {
    backgroundColor: brand?.innerBgColor || '#0F172A',
    color: brand?.innerTextColor || '#F1F5F9',
  };

  const primaryActionColor = brand?.accentColor || brand?.primaryColor || '#10b981';

  const hiddenStorageKey = `trustlink_hidden_specialties_${user?.id || user?.email || 'default'}`;

  // Paso activo: 'credentials' | 'vehicles' | 'reviews'
  const [activeStep, setActiveStep] = useState('credentials');

  const [providerProfiles, setProviderProfiles] = useState([]);
  const [documentHistory, setDocumentHistory] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [savingDocs, setSavingDocs] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const [hiddenProfileIds, setHiddenProfileIds] = useState(() => {
    try {
      const raw = localStorage.getItem(hiddenStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(Number) : [];
    } catch {
      return [];
    }
  });

  const [baseDocs, setBaseDocs] = useState({
    criminalRecordUrl: '',
    criminalFromDate: '',
    criminalUntilDate: '',
    insurancePolicyUrl: '',
    insuranceFromDate: '',
    insuranceUntilDate: '',
  });

  // 1A. Documentación Personal
  const [showNewDocForm, setShowNewDocForm] = useState(false);
  const [newDocType, setNewDocType] = useState('criminal');
  const [newDocUrl, setNewDocUrl] = useState('');
  const [newDocFrom, setNewDocFrom] = useState('');
  const [newDocUntil, setNewDocUntil] = useState('');

  const [editingDocKey, setEditingDocKey] = useState(null);
  const [editDocUrl, setEditDocUrl] = useState('');
  const [editDocFrom, setEditDocFrom] = useState('');
  const [editDocUntil, setEditDocUntil] = useState('');

  // 1B. Especialidades y Credenciales
  const [showNewSpecialtyForm, setShowNewSpecialtyForm] = useState(false);
  const [specialty, setSpecialty] = useState('');
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [editSpecialty, setEditSpecialty] = useState('');

  // 2. Flota Vehicular
  const [showNewVehicleForm, setShowNewVehicleForm] = useState(false);
  const [vehicleType, setVehicleType] = useState('Utilitario');
  const [brandName, setBrandName] = useState('');
  const [modelName, setModelName] = useState('');
  const [colorName, setColorName] = useState('');
  const [plate, setPlate] = useState('');
  const [vehInsuranceUrl, setVehInsuranceUrl] = useState('');
  const [vehInsuranceFrom, setVehInsuranceFrom] = useState('');
  const [vehInsuranceUntil, setVehInsuranceUntil] = useState('');

  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [editVehicleType, setEditVehicleType] = useState('Utilitario');
  const [editBrand, setEditBrand] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editPlate, setEditPlate] = useState('');
  const [editVehInsuranceUrl, setEditVehInsuranceUrl] = useState('');
  const [editVehInsuranceFrom, setEditVehInsuranceFrom] = useState('');
  const [editVehInsuranceUntil, setEditVehInsuranceUntil] = useState('');

  // 3. Reseñas y Reputación Cruzada
  const [providerContracts, setProviderContracts] = useState([]);
  const [loadingContracts, setLoadingContracts] = useState(true);
  const [ownerRatingDrafts, setOwnerRatingDrafts] = useState({});
  const [ownerCommentDrafts, setOwnerCommentDrafts] = useState({});
  const [submittingReviewId, setSubmittingReviewId] = useState(null);
  const [crossReviewFeedback, setCrossReviewFeedback] = useState(null);

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
  });

  const handleToggleSpecialtyVisibility = (prof) => {
    const idNum = Number(prof.id);
    setHiddenProfileIds((prev) => {
      const exists = prev.includes(idNum);
      const next = exists ? prev.filter((item) => item !== idNum) : [...prev, idNum];
      try {
        localStorage.setItem(hiddenStorageKey, JSON.stringify(next));
      } catch {
        // Ignora errores de almacenamiento local
      }
      setFeedback({
        type: 'success',
        text: exists
          ? `Especialidad "${prof.specialty}" marcada como Visible.`
          : `Especialidad "${prof.specialty}" marcada como Oculta.`,
      });
      return next;
    });
  };

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
        setDocumentHistory(data.document_history || []);
        setVehicles(data.vehicles || []);

        const withDocs =
          list.find((p) => p.criminal_record_url || p.insurance_policy_url) || list[0];
        if (withDocs) {
          setBaseDocs({
            criminalRecordUrl: withDocs.criminal_record_url || '',
            criminalFromDate: toDateInputValue(
              withDocs.criminal_record_from || withDocs.created_at
            ),
            criminalUntilDate: toDateInputValue(withDocs.criminal_record_expiry),
            insurancePolicyUrl: withDocs.insurance_policy_url || '',
            insuranceFromDate: toDateInputValue(withDocs.insurance_from || withDocs.created_at),
            insuranceUntilDate: toDateInputValue(withDocs.insurance_expiry),
          });
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

  const persistPersonalDocs = async (
    docType,
    { url, fromDate, untilDate },
    nextDocs,
    successText
  ) => {
    setSavingDocs(true);
    setFeedback({ type: '', text: '' });

    const isCriminal = docType === 'criminal';
    const docPayload = {
      criminal_record_url: nextDocs.criminalRecordUrl.trim() || null,
      criminal_record_from: isCriminal ? fromDate || null : nextDocs.criminalFromDate || null,
      criminal_record_expiry: nextDocs.criminalUntilDate || null,
      insurance_policy_url: nextDocs.insurancePolicyUrl.trim() || null,
      insurance_from: !isCriminal ? fromDate || null : nextDocs.insuranceFromDate || null,
      insurance_expiry: nextDocs.insuranceUntilDate || null,
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
          return false;
        }
      } else {
        await Promise.all(
          providerProfiles.map((prof) =>
            fetch(`${API_BASE}/api/v1/providers/profile/${prof.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
              body: JSON.stringify({
                specialty: prof.specialty,
                criminal_record_url: isCriminal ? url.trim() || null : prof.criminal_record_url,
                criminal_record_from: isCriminal ? fromDate || null : prof.criminal_record_from,
                criminal_record_expiry: isCriminal ? untilDate || null : prof.criminal_record_expiry,
                insurance_policy_url: !isCriminal ? url.trim() || null : prof.insurance_policy_url,
                insurance_from: !isCriminal ? fromDate || null : prof.insurance_from,
                insurance_expiry: !isCriminal ? untilDate || null : prof.insurance_expiry,
              }),
            })
          )
        );
      }

      setFeedback({ type: 'success', text: successText });
      await fetchProviderData();
      return true;
    } catch (error) {
      console.error('Error al guardar documentación personal:', error);
      setFeedback({ type: 'error', text: 'Error de conexión al guardar documentación.' });
      return false;
    } finally {
      setSavingDocs(false);
    }
  };

  const handleCreateNewDoc = async (e) => {
    e.preventDefault();
    if (newDocFrom && newDocUntil && newDocUntil < newDocFrom) {
      setFeedback({
        type: 'error',
        text: 'La fecha "Hasta" no puede ser anterior a la fecha "Desde".',
      });
      return;
    }

    const nextDocs =
      newDocType === 'criminal'
        ? {
            ...baseDocs,
            criminalRecordUrl: newDocUrl,
            criminalFromDate: newDocFrom,
            criminalUntilDate: newDocUntil,
          }
        : {
            ...baseDocs,
            insurancePolicyUrl: newDocUrl,
            insuranceFromDate: newDocFrom,
            insuranceUntilDate: newDocUntil,
          };

    const ok = await persistPersonalDocs(
      newDocType,
      { url: newDocUrl, fromDate: newDocFrom, untilDate: newDocUntil },
      nextDocs,
      'Nueva versión documental registrada en el historial.'
    );
    if (ok) {
      setNewDocUrl('');
      setNewDocFrom('');
      setNewDocUntil('');
      setShowNewDocForm(false);
    }
  };

  const startInlineDocEdit = (row) => {
    setEditingDocKey(row.docKey);
    setEditDocUrl(row.url === 'Sin URL' ? '' : row.url || '');
    setEditDocFrom(toDateInputValue(row.fromDate));
    setEditDocUntil(toDateInputValue(row.untilDate));
  };

  const handleSaveInlineDocEdit = async (row) => {
    if (editDocFrom && editDocUntil && editDocUntil < editDocFrom) {
      setFeedback({
        type: 'error',
        text: 'La fecha "Hasta" no puede ser anterior a la fecha "Desde".',
      });
      return;
    }

    const nextDocs =
      row.docType === 'criminal'
        ? {
            ...baseDocs,
            criminalRecordUrl: editDocUrl,
            criminalFromDate: editDocFrom,
            criminalUntilDate: editDocUntil,
          }
        : {
            ...baseDocs,
            insurancePolicyUrl: editDocUrl,
            insuranceFromDate: editDocFrom,
            insuranceUntilDate: editDocUntil,
          };

    const ok = await persistPersonalDocs(
      row.docType,
      { url: editDocUrl, fromDate: editDocFrom, untilDate: editDocUntil },
      nextDocs,
      'Versión documental guardada en el historial.'
    );
    if (ok) {
      setEditingDocKey(null);
    }
  };

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
          criminal_record_url: baseDocs.criminalRecordUrl.trim() || null,
          criminal_record_from: baseDocs.criminalFromDate || null,
          criminal_record_expiry: baseDocs.criminalUntilDate || null,
          insurance_policy_url: baseDocs.insurancePolicyUrl.trim() || null,
          insurance_from: baseDocs.insuranceFromDate || null,
          insurance_expiry: baseDocs.insuranceUntilDate || null,
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
        setShowNewSpecialtyForm(false);
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
          criminal_record_url: baseDocs.criminalRecordUrl.trim() || null,
          criminal_record_from: baseDocs.criminalFromDate || null,
          criminal_record_expiry: baseDocs.criminalUntilDate || null,
          insurance_policy_url: baseDocs.insurancePolicyUrl.trim() || null,
          insurance_from: baseDocs.insuranceFromDate || null,
          insurance_expiry: baseDocs.insuranceUntilDate || null,
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
    if (vehInsuranceFrom && vehInsuranceUntil && vehInsuranceUntil < vehInsuranceFrom) {
      setFeedback({
        type: 'error',
        text: 'La fecha "Hasta" del seguro vehicular no puede ser anterior a "Desde".',
      });
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
          vehicle_insurance_url: vehInsuranceUrl.trim() || null,
          vehicle_insurance_from: vehInsuranceFrom || null,
          vehicle_insurance_expiry: vehInsuranceUntil || null,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({
          type: 'success',
          text: data.message || 'Vehículo y seguro automotor registrados con éxito.',
        });
        setBrandName('');
        setModelName('');
        setColorName('');
        setPlate('');
        setVehInsuranceUrl('');
        setVehInsuranceFrom('');
        setVehInsuranceUntil('');
        setShowNewVehicleForm(false);
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
    if (
      editVehInsuranceFrom &&
      editVehInsuranceUntil &&
      editVehInsuranceUntil < editVehInsuranceFrom
    ) {
      setFeedback({
        type: 'error',
        text: 'La fecha "Hasta" del seguro vehicular no puede ser anterior a "Desde".',
      });
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
          vehicle_insurance_url: editVehInsuranceUrl.trim() || null,
          vehicle_insurance_from: editVehInsuranceFrom || null,
          vehicle_insurance_expiry: editVehInsuranceUntil || null,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({
          type: 'success',
          text: data.message || 'Vehículo y seguro automotor actualizados.',
        });
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

  const personalDocRows = useMemo(() => {
    const rawRows = [];

    if (documentHistory.length > 0) {
      documentHistory.forEach((ver, idx) => {
        const isInsurance = ver.doc_type === 'insurance';
        const fromVal = ver.valid_from || ver.created_at;
        const untilVal = ver.valid_to;
        rawRows.push({
          docKey: `ver-${ver.id || idx}`,
          docType: isInsurance ? 'insurance' : 'criminal',
          title: isInsurance ? 'Póliza ART / Seguro' : 'Antecedentes Penales',
          url: (ver.document_url || 'Sin URL').trim(),
          fromDate: fromVal,
          untilDate: untilVal,
          validity: resolveDateValidity(fromVal, untilVal),
          trustlinkValidation: formatTrustlinkValidationStatus(ver.status),
        });
      });
    } else {
      const baseSource =
        providerProfiles.find(
          (p) =>
            p.criminal_record_url ||
            p.criminal_record_expiry ||
            p.insurance_policy_url ||
            p.insurance_expiry
        ) || providerProfiles[0];

      if (baseSource) {
        const trustStatus = baseSource.status || 'pending';

        if (
          baseSource.criminal_record_url ||
          baseSource.criminal_record_from ||
          baseSource.criminal_record_expiry
        ) {
          const fromVal = baseSource.criminal_record_from || baseSource.created_at;
          const untilVal = baseSource.criminal_record_expiry;
          rawRows.push({
            docKey: 'criminal',
            docType: 'criminal',
            title: 'Antecedentes Penales',
            url: (baseSource.criminal_record_url || 'Sin URL').trim(),
            fromDate: fromVal,
            untilDate: untilVal,
            validity: resolveDateValidity(fromVal, untilVal),
            trustlinkValidation: formatTrustlinkValidationStatus(trustStatus),
          });
        }

        if (
          baseSource.insurance_policy_url ||
          baseSource.insurance_from ||
          baseSource.insurance_expiry
        ) {
          const fromVal = baseSource.insurance_from || baseSource.created_at;
          const untilVal = baseSource.insurance_expiry;
          rawRows.push({
            docKey: 'insurance',
            docType: 'insurance',
            title: 'Póliza ART / Seguro',
            url: (baseSource.insurance_policy_url || 'Sin URL').trim(),
            fromDate: fromVal,
            untilDate: untilVal,
            validity: resolveDateValidity(fromVal, untilVal),
            trustlinkValidation: formatTrustlinkValidationStatus(trustStatus),
          });
        }
      }
    }

    const seenSignatures = new Set();
    return rawRows.filter((row) => {
      const signature = [
        row.docType,
        row.url.toLowerCase(),
        toDateInputValue(row.fromDate),
        toDateInputValue(row.untilDate),
      ].join('|');
      if (seenSignatures.has(signature)) return false;
      seenSignatures.add(signature);
      return true;
    });
  }, [documentHistory, providerProfiles]);

  const primaryStatusInfo = formatSpecialtyStatus(providerProfiles[0]?.status);

  // Pestañas cortas unificadas: 1. Credenciales, 2. Flota Vehicular, 3. Reseñas
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
      label: 'Reseñas',
      count: providerContracts.length,
      icon: Star,
    },
  ];

  const activeStepMeta = steps.find((s) => s.id === activeStep) || steps[0];

  return (
    <div className="p-6 md:p-8 flex-1">
      <main className="max-w-6xl mx-auto space-y-6">
        {/* Cabecera del Portal Prestador + Navegación de Pasos */}
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
                    'Historial documental deduplicado (incluyendo vencidos), vigencia por fechas y especialidades verificadas en TrustLink.'}
                  {activeStep === 'vehicles' &&
                    'Vehículos habilitados, patentes y vigencia de seguro automotor asociado a tu perfil.'}
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
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl border inline-flex items-center gap-1.5 ${primaryStatusInfo.badgeClass}`}
              >
                {primaryStatusInfo.isVerified && <BadgeCheck size={14} />}
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

        {/* PASO 1: Credenciales */}
        {activeStep === 'credentials' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <section
              className="lg:col-span-6 border border-black/20 p-5 rounded-2xl shadow-sm space-y-4 flex flex-col"
              style={cardStyle}
            >
              <div className="flex items-center justify-between gap-2 border-b border-black/20 pb-3">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-emerald-400" />
                  <h3 className="text-sm font-bold">Documentación Personal</h3>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowNewDocForm((prev) => !prev);
                    setNewDocType('criminal');
                    setNewDocUrl('');
                    setNewDocFrom('');
                    setNewDocUntil('');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer hover:opacity-95 shrink-0"
                  style={{ backgroundColor: primaryActionColor }}
                >
                  {showNewDocForm ? (
                    <>
                      <X size={13} /> Cerrar
                    </>
                  ) : (
                    <>
                      <Plus size={13} /> Cargar Documentación
                    </>
                  )}
                </button>
              </div>

              {showNewDocForm && (
                <form
                  onSubmit={handleCreateNewDoc}
                  className="p-3.5 rounded-xl border border-white/15 space-y-2.5 text-xs"
                  style={innerStyle}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider opacity-85">
                      Nueva Versión Documental
                    </span>
                    <select
                      value={newDocType}
                      onChange={(e) => setNewDocType(e.target.value)}
                      className="px-2.5 py-1 rounded-lg border border-white/15 text-[11px] focus:outline-none"
                      style={cardStyle}
                    >
                      <option value="criminal">Antecedentes Penales</option>
                      <option value="insurance">Póliza ART / Seguro</option>
                    </select>
                  </div>

                  <input
                    type="text"
                    required
                    value={newDocUrl}
                    onChange={(e) => setNewDocUrl(e.target.value)}
                    placeholder="URL del documento (https://...)"
                    className="w-full px-3 py-1.5 rounded-lg border border-white/15 text-xs focus:outline-none"
                    style={cardStyle}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] opacity-70 mb-0.5">Desde</label>
                      <input
                        type="date"
                        value={newDocFrom}
                        onChange={(e) => setNewDocFrom(e.target.value)}
                        className="w-full px-2.5 py-1 rounded-lg border border-white/15 text-[11px] focus:outline-none"
                        style={cardStyle}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] opacity-70 mb-0.5">Hasta</label>
                      <input
                        type="date"
                        value={newDocUntil}
                        onChange={(e) => setNewDocUntil(e.target.value)}
                        className="w-full px-2.5 py-1 rounded-lg border border-white/15 text-[11px] focus:outline-none"
                        style={cardStyle}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowNewDocForm(false)}
                      className="px-3 py-1.5 rounded-lg border border-white/15 text-xs font-semibold cursor-pointer"
                      style={cardStyle}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingDocs || !newDocUrl.trim()}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50 cursor-pointer"
                      style={{ backgroundColor: primaryActionColor }}
                    >
                      <Save size={12} /> {savingDocs ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-2.5 text-xs flex-1 flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider opacity-85 flex items-center gap-1.5">
                    <History size={13} className="text-sky-400" />
                    Historial Documental
                  </span>
                  <span
                    className="text-[11px] font-mono px-2.5 py-0.5 rounded-lg border border-white/15"
                    style={innerStyle}
                  >
                    {personalDocRows.length} doc(s)
                  </span>
                </div>

                {fetching ? (
                  <div className="text-center py-6 text-xs opacity-80 flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={14} /> Cargando documentación...
                  </div>
                ) : personalDocRows.length === 0 ? (
                  <div
                    className="p-4 rounded-xl border border-black/20 text-[11px] opacity-75 text-center"
                    style={innerStyle}
                  >
                    Sin documentación cargada. Usá el botón <strong>Cargar Documentación</strong> para
                    registrar tus antecedentes o seguro.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                    {personalDocRows.map((row) => {
                      const isRowEditing = editingDocKey === row.docKey;
                      return (
                        <div
                          key={row.docKey}
                          className="p-3.5 rounded-xl border border-black/20 space-y-2 text-[11px] min-h-[116px] flex flex-col justify-between"
                          style={innerStyle}
                        >
                          {isRowEditing ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs">{row.title}</span>
                                <span className="text-[10px] opacity-70">Nueva versión</span>
                              </div>
                              <input
                                type="text"
                                value={editDocUrl}
                                onChange={(e) => setEditDocUrl(e.target.value)}
                                placeholder="URL del documento"
                                className="w-full px-3 py-1.5 rounded-lg border border-white/15 text-xs focus:outline-none"
                                style={cardStyle}
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] opacity-70 mb-0.5">
                                    Desde
                                  </label>
                                  <input
                                    type="date"
                                    value={editDocFrom}
                                    onChange={(e) => setEditDocFrom(e.target.value)}
                                    className="w-full px-2.5 py-1 rounded-lg border border-white/15 text-[11px] focus:outline-none"
                                    style={cardStyle}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] opacity-70 mb-0.5">
                                    Hasta
                                  </label>
                                  <input
                                    type="date"
                                    value={editDocUntil}
                                    onChange={(e) => setEditDocUntil(e.target.value)}
                                    className="w-full px-2.5 py-1 rounded-lg border border-white/15 text-[11px] focus:outline-none"
                                    style={cardStyle}
                                  />
                                </div>
                              </div>
                              <div className="flex justify-end gap-1.5 pt-1">
                                <button
                                  type="button"
                                  disabled={savingDocs}
                                  onClick={() => handleSaveInlineDocEdit(row)}
                                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-white font-bold cursor-pointer disabled:opacity-50"
                                  style={{ backgroundColor: primaryActionColor }}
                                >
                                  <Save size={11} /> Guardar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingDocKey(null)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/15 opacity-85 cursor-pointer"
                                  style={cardStyle}
                                >
                                  <X size={11} /> Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center justify-between gap-2 h-6">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-bold text-xs truncate">{row.title}</span>
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 shrink-0 ${row.trustlinkValidation.badgeClass}`}
                                    title="Estado de verificación en TrustLink"
                                  >
                                    {row.trustlinkValidation.isVerified && <BadgeCheck size={12} />}
                                    {row.trustlinkValidation.label}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => startInlineDocEdit(row)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/15 text-[11px] font-semibold cursor-pointer hover:opacity-90 shrink-0"
                                  style={cardStyle}
                                >
                                  <Edit3 size={11} /> Editar
                                </button>
                              </div>

                              <div className="truncate opacity-80 h-4 leading-4">{row.url}</div>

                              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/10 h-7">
                                <span className="font-mono text-[10px] opacity-75 truncate">
                                  Vigencia: {formatDisplayDate(row.fromDate)} —{' '}
                                  {formatDisplayDate(row.untilDate)}
                                </span>
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${row.validity.badgeClass}`}
                                >
                                  {row.validity.label}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            <section
              className="lg:col-span-6 border border-black/20 p-5 rounded-2xl shadow-sm space-y-4 flex flex-col"
              style={cardStyle}
            >
              <div className="flex items-center justify-between gap-2 border-b border-black/20 pb-3">
                <div className="flex items-center gap-2">
                  <Award size={16} className="text-emerald-400" />
                  <h3 className="text-sm font-bold">Especialidades y Credenciales</h3>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowNewSpecialtyForm((prev) => !prev);
                    setSpecialty('');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer hover:opacity-95 shrink-0"
                  style={{ backgroundColor: primaryActionColor }}
                >
                  {showNewSpecialtyForm ? (
                    <>
                      <X size={13} /> Cerrar
                    </>
                  ) : (
                    <>
                      <Plus size={13} /> Cargar Especialidad
                    </>
                  )}
                </button>
              </div>

              {showNewSpecialtyForm && (
                <form
                  onSubmit={handleAddSpecialty}
                  className="p-3.5 rounded-xl border border-white/15 space-y-2.5 text-xs"
                  style={innerStyle}
                >
                  <div className="text-[11px] font-bold uppercase tracking-wider opacity-85">
                    Nueva Especialidad
                  </div>
                  <input
                    type="text"
                    required
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="Especialidad (ej: Plomero Matriculado)"
                    className="w-full px-3 py-1.5 rounded-lg border border-white/15 text-xs focus:outline-none"
                    style={cardStyle}
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowNewSpecialtyForm(false)}
                      className="px-3 py-1.5 rounded-lg border border-white/15 text-xs font-semibold cursor-pointer"
                      style={cardStyle}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loadingAction || !specialty.trim()}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50 cursor-pointer"
                      style={{ backgroundColor: primaryActionColor }}
                    >
                      <Plus size={12} /> {loadingAction ? 'Agregando...' : 'Agregar'}
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-2.5 text-xs flex-1 flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider opacity-85 flex items-center gap-1.5">
                    <Award size={13} className="text-emerald-400" />
                    Especialidades Cargadas
                  </span>
                  <span
                    className="text-[11px] font-mono px-2.5 py-0.5 rounded-lg border border-white/15"
                    style={innerStyle}
                  >
                    {providerProfiles.length} activa(s)
                  </span>
                </div>

                {fetching ? (
                  <div className="text-center py-6 text-xs opacity-80 flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={14} /> Cargando especialidades...
                  </div>
                ) : providerProfiles.length === 0 ? (
                  <div
                    className="p-4 rounded-xl border border-black/20 text-[11px] opacity-75 text-center"
                    style={innerStyle}
                  >
                    Sin especialidades cargadas. Usá el botón <strong>Cargar Especialidad</strong>{' '}
                    para sumar tu oficio.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                    {providerProfiles.map((prof) => {
                      const isEditing = editingProfileId === prof.id;
                      const profStatus = formatSpecialtyStatus(prof.status);
                      const isHiddenByProvider = hiddenProfileIds.includes(Number(prof.id));
                      const isVisible = !isHiddenByProvider;

                      return (
                        <div
                          key={prof.id}
                          className="p-3.5 rounded-xl border border-black/20 text-[11px] space-y-2 min-h-[116px] flex flex-col justify-between"
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
                                <Save size={11} /> Guardar
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingProfileId(null)}
                                className="p-1.5 rounded-lg border border-white/15 opacity-85 cursor-pointer"
                                style={cardStyle}
                                aria-label="Cancelar"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center justify-between gap-2 h-6">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-bold text-xs truncate">
                                    {prof.specialty}
                                  </span>
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 shrink-0 ${profStatus.badgeClass}`}
                                  >
                                    {profStatus.isVerified && <BadgeCheck size={12} />}
                                    {profStatus.label}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingProfileId(prof.id);
                                    setEditSpecialty(prof.specialty || '');
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/15 text-[11px] font-semibold cursor-pointer hover:opacity-90 shrink-0"
                                  style={cardStyle}
                                >
                                  <Edit3 size={11} /> Editar
                                </button>
                              </div>

                              <p className="opacity-80 truncate h-4 leading-4">
                                {isHiddenByProvider
                                  ? 'Oculta por tu configuración actual para residentes.'
                                  : profStatus.isVerified
                                  ? 'Verificada y habilitada para mostrarse a residentes.'
                                  : 'Pendiente de verificación de TrustLink para residentes.'}
                              </p>

                              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/10 h-7">
                                <span className="opacity-75 truncate">
                                  Visibilidad en directorio:
                                </span>

                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={isVisible}
                                  onClick={() => handleToggleSpecialtyVisibility(prof)}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold transition-all cursor-pointer shrink-0 ${
                                    isVisible
                                      ? 'bg-sky-500/15 text-sky-300 border-sky-500/35'
                                      : 'bg-slate-800/80 text-slate-400 border-slate-700'
                                  }`}
                                  title="Clic para alternar entre Visible y Oculta"
                                >
                                  {isVisible ? (
                                    <Eye size={11} className="text-sky-300" />
                                  ) : (
                                    <EyeOff size={11} className="text-slate-400" />
                                  )}
                                  <span>{isVisible ? 'Visible' : 'Oculta'}</span>
                                  <span
                                    className={`relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors ${
                                      isVisible ? 'bg-sky-400/80' : 'bg-slate-600'
                                    }`}
                                  >
                                    <span
                                      className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${
                                        isVisible ? 'translate-x-3' : 'translate-x-0.5'
                                      }`}
                                    />
                                  </span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* PASO 2: Flota Vehicular Habilitada */}
        {activeStep === 'vehicles' && (
          <section
            className="border border-black/20 p-5 rounded-2xl shadow-sm space-y-4"
            style={cardStyle}
          >
            <div className="flex items-center justify-between gap-2 border-b border-black/20 pb-3">
              <div className="flex items-center gap-2">
                <Car size={16} className="text-sky-400" />
                <h3 className="text-sm font-bold">Flota Vehicular Habilitada</h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowNewVehicleForm((prev) => !prev);
                  setVehicleType('Utilitario');
                  setBrandName('');
                  setModelName('');
                  setColorName('');
                  setPlate('');
                  setVehInsuranceUrl('');
                  setVehInsuranceFrom('');
                  setVehInsuranceUntil('');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer hover:opacity-95 shrink-0"
                style={{ backgroundColor: primaryActionColor }}
              >
                {showNewVehicleForm ? (
                  <>
                    <X size={13} /> Cerrar
                  </>
                ) : (
                  <>
                    <Plus size={13} /> Cargar Vehículo
                  </>
                )}
              </button>
            </div>

            {showNewVehicleForm && (
              <form
                onSubmit={handleAddVehicle}
                className="p-3.5 rounded-xl border border-white/15 space-y-2.5 text-xs"
                style={innerStyle}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider opacity-85">
                    Nuevo Vehículo y Seguro Automotor
                  </span>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="px-2.5 py-1 rounded-lg border border-white/15 text-[11px] focus:outline-none"
                    style={cardStyle}
                  >
                    <option value="Utilitario">Utilitario</option>
                    <option value="Automóvil">Automóvil</option>
                    <option value="Camioneta">Camioneta</option>
                    <option value="Moto">Moto</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    required
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="Marca (ej: Ford)"
                    className="w-full px-3 py-1.5 rounded-lg border border-white/15 text-xs focus:outline-none"
                    style={cardStyle}
                  />
                  <input
                    type="text"
                    required
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="Modelo (ej: Fiorino)"
                    className="w-full px-3 py-1.5 rounded-lg border border-white/15 text-xs focus:outline-none"
                    style={cardStyle}
                  />
                  <input
                    type="text"
                    value={colorName}
                    onChange={(e) => setColorName(e.target.value)}
                    placeholder="Color (ej: Blanco)"
                    className="w-full px-3 py-1.5 rounded-lg border border-white/15 text-xs focus:outline-none"
                    style={cardStyle}
                  />
                  <input
                    type="text"
                    required
                    value={plate}
                    onChange={(e) => setPlate(e.target.value)}
                    placeholder="Patente (ej: AF123CD)"
                    className="w-full px-3 py-1.5 rounded-lg border border-white/15 text-xs font-mono uppercase focus:outline-none"
                    style={cardStyle}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                  <div className="sm:col-span-6">
                    <label className="block text-[10px] opacity-70 mb-0.5">
                      URL Póliza de Seguro Vehicular (PDF / Enlace)
                    </label>
                    <input
                      type="text"
                      value={vehInsuranceUrl}
                      onChange={(e) => setVehInsuranceUrl(e.target.value)}
                      placeholder="https://storage.trustlink.com/seguro-auto.pdf"
                      className="w-full px-3 py-1.5 rounded-lg border border-white/15 text-xs focus:outline-none"
                      style={cardStyle}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] opacity-70 mb-0.5">Seguro Desde</label>
                    <input
                      type="date"
                      value={vehInsuranceFrom}
                      onChange={(e) => setVehInsuranceFrom(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-white/15 text-[11px] focus:outline-none"
                      style={cardStyle}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] opacity-70 mb-0.5">Seguro Hasta</label>
                    <input
                      type="date"
                      value={vehInsuranceUntil}
                      onChange={(e) => setVehInsuranceUntil(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-white/15 text-[11px] focus:outline-none"
                      style={cardStyle}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowNewVehicleForm(false)}
                    className="px-3 py-1.5 rounded-lg border border-white/15 text-xs font-semibold cursor-pointer"
                    style={cardStyle}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loadingAction || !plate.trim()}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50 cursor-pointer"
                    style={{ backgroundColor: primaryActionColor }}
                  >
                    <Save size={12} /> {loadingAction ? 'Guardando...' : 'Guardar Vehículo'}
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider opacity-85 flex items-center gap-1.5">
                  <Car size={13} className="text-sky-400" />
                  Vehículos Registrados
                </span>
                <span
                  className="text-[11px] font-mono px-2.5 py-0.5 rounded-lg border border-white/15"
                  style={innerStyle}
                >
                  {vehicles.length} vehículo(s)
                </span>
              </div>

              {fetching ? (
                <div className="text-center py-6 text-xs opacity-80 flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin" size={14} /> Cargando flota vehicular...
                </div>
              ) : vehicles.length === 0 ? (
                <div
                  className="p-4 rounded-xl border border-black/20 text-[11px] opacity-75 text-center"
                  style={innerStyle}
                >
                  Sin vehículos registrados. Usá el botón <strong>Cargar Vehículo</strong> para
                  asociar un vehículo y su póliza de seguro.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {vehicles.map((veh) => {
                    const isEditingVeh = editingVehicleId === veh.id;
                    const cleanPlate = (veh.plate || '').trim();
                    const insFrom = veh.vehicle_insurance_from;
                    const insUntil = veh.vehicle_insurance_expiry;
                    const insValidity = resolveDateValidity(insFrom, insUntil);

                    return (
                      <div
                        key={veh.id}
                        className="p-3.5 rounded-xl border border-black/20 space-y-2 text-[11px] min-h-[116px] flex flex-col justify-between"
                        style={innerStyle}
                      >
                        {isEditingVeh ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs">Editando Vehículo</span>
                              <select
                                value={editVehicleType}
                                onChange={(e) => setEditVehicleType(e.target.value)}
                                className="px-2.5 py-1 rounded-lg border border-white/15 text-[11px]"
                                style={cardStyle}
                              >
                                <option value="Utilitario">Utilitario</option>
                                <option value="Automóvil">Automóvil</option>
                                <option value="Camioneta">Camioneta</option>
                                <option value="Moto">Moto</option>
                              </select>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <input
                                type="text"
                                value={editBrand}
                                onChange={(e) => setEditBrand(e.target.value)}
                                placeholder="Marca"
                                className="px-2.5 py-1 rounded-lg border border-white/15 text-xs"
                                style={cardStyle}
                              />
                              <input
                                type="text"
                                value={editModel}
                                onChange={(e) => setEditModel(e.target.value)}
                                placeholder="Modelo"
                                className="px-2.5 py-1 rounded-lg border border-white/15 text-xs"
                                style={cardStyle}
                              />
                              <input
                                type="text"
                                value={editColor}
                                onChange={(e) => setEditColor(e.target.value)}
                                placeholder="Color"
                                className="px-2.5 py-1 rounded-lg border border-white/15 text-xs"
                                style={cardStyle}
                              />
                              <input
                                type="text"
                                value={editPlate}
                                onChange={(e) => setEditPlate(e.target.value)}
                                placeholder="Patente"
                                className="px-2.5 py-1 rounded-lg border border-white/15 text-xs font-mono uppercase"
                                style={cardStyle}
                              />
                            </div>

                            <input
                              type="text"
                              value={editVehInsuranceUrl}
                              onChange={(e) => setEditVehInsuranceUrl(e.target.value)}
                              placeholder="URL Póliza de Seguro Vehicular"
                              className="w-full px-3 py-1.5 rounded-lg border border-white/15 text-xs"
                              style={cardStyle}
                            />

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] opacity-70 mb-0.5">
                                  Seguro Desde
                                </label>
                                <input
                                  type="date"
                                  value={editVehInsuranceFrom}
                                  onChange={(e) => setEditVehInsuranceFrom(e.target.value)}
                                  className="w-full px-2.5 py-1 rounded-lg border border-white/15 text-[11px]"
                                  style={cardStyle}
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] opacity-70 mb-0.5">
                                  Seguro Hasta
                                </label>
                                <input
                                  type="date"
                                  value={editVehInsuranceUntil}
                                  onChange={(e) => setEditVehInsuranceUntil(e.target.value)}
                                  className="w-full px-2.5 py-1 rounded-lg border border-white/15 text-[11px]"
                                  style={cardStyle}
                                />
                              </div>
                            </div>

                            <div className="flex justify-end gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={() => handleSaveEditVehicle(veh.id)}
                                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-white font-bold cursor-pointer"
                                style={{ backgroundColor: primaryActionColor }}
                              >
                                <Save size={11} /> Guardar
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingVehicleId(null)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/15 opacity-85 cursor-pointer"
                                style={cardStyle}
                              >
                                <X size={11} /> Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between gap-2 h-6">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-bold text-xs truncate">
                                  {veh.brand} {veh.model}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-sky-500/15 text-sky-300 border-sky-500/35 uppercase shrink-0">
                                  {veh.vehicle_type || 'Vehículo'}
                                </span>
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
                                  setEditVehInsuranceUrl(veh.vehicle_insurance_url || '');
                                  setEditVehInsuranceFrom(
                                    toDateInputValue(veh.vehicle_insurance_from)
                                  );
                                  setEditVehInsuranceUntil(
                                    toDateInputValue(veh.vehicle_insurance_expiry)
                                  );
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/15 text-[11px] font-semibold cursor-pointer hover:opacity-90 shrink-0"
                                style={cardStyle}
                              >
                                <Edit3 size={11} /> Editar
                              </button>
                            </div>

                            <div className="flex items-center justify-between gap-2 opacity-80 h-4 leading-4">
                              <span className="truncate">
                                Color: {veh.color || 'No especificado'} · Patente:{' '}
                                {cleanPlate ? (
                                  <strong className="text-sky-300 font-mono">{cleanPlate}</strong>
                                ) : (
                                  <strong className="text-amber-400">Sin patente</strong>
                                )}
                              </span>
                              {veh.vehicle_insurance_url && (
                                <a
                                  href={veh.vehicle_insurance_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-emerald-300 hover:underline font-semibold shrink-0"
                                >
                                  Ver póliza
                                </a>
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/10 h-7">
                              <span className="font-mono text-[10px] opacity-75 truncate">
                                Seguro: {formatDisplayDate(insFrom)} —{' '}
                                {formatDisplayDate(insUntil)}
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${insValidity.badgeClass}`}
                              >
                                {insValidity.label}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* PASO 3: Reseñas y Reputación Cruzada */}
        {activeStep === 'reviews' && (
          <div
            className="border border-black/20 p-6 rounded-2xl shadow-sm space-y-5"
            style={cardStyle}
          >
            <div className="flex items-center justify-between border-b border-black/20 pb-4">
              <div className="flex items-center gap-2.5">
                <Star size={18} className="text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold">Reseñas y Reputación Cruzada</h3>
                  <p className="text-xs opacity-80">
                    Reseñas recibidas de residentes y calificación cruzada por servicio realizado.
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
        )}
      </main>
    </div>
  );
}