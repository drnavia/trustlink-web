/**
 * @file ProviderDashboard.jsx
 * @description Portal del Prestador con navegación por pasos superiores
 * (1. Credenciales, 2. Flota Vehicular, 3. Reseñas, 4. Pases QR),
 * gestión de documentación/especialidades, flota vehicular con seguro y
 * consulta de Pases QR asignados por residentes para el ingreso al barrio.
 * @location /trustlink-web/src/modules/provider/ProviderDashboard.jsx
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Car,
  Star,
  QrCode,
  Search,
  Copy,
  Check,
  RefreshCw,
  FileText,
  Award,
  Plus,
  Edit3,
  Eye,
  EyeOff,
  X,
  Calendar,
  MapPin,
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';
import { useAuth } from '../auth/AuthContext';

export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL && String(import.meta.env.VITE_API_BASE_URL).trim()) ||
  'http://localhost:4000';

const PASSES_PER_PAGE = 6;

const formatDateTime = (value) => {
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
};

const getPassStatusBadge = (status) => {
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
};

const getPassStatusLabel = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'pending') return 'Vigente / Pendiente';
  if (normalized === 'used') return 'Utilizado';
  if (normalized === 'expired') return 'Vencido';
  if (normalized === 'cancelled') return 'Cancelado';
  return status || 'Sin estado';
};

export default function ProviderDashboard() {
  const { brand } = useBranding();
  const { user } = useAuth();

  // Paso activo en el Portal Prestador: 'credentials' | 'vehicles' | 'reviews' | 'passes'
  const [activeTab, setActiveTab] = useState('credentials');

  // Datos generales del perfil del prestador
  const [profiles, setProfiles] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Formularios colapsables en Credenciales y Flota Vehicular
  const [showDocForm, setShowDocForm] = useState(false);
  const [showSpecialtyForm, setShowSpecialtyForm] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);

  const [docForm, setDocForm] = useState({
    doc_type: 'Antecedentes Penales',
    doc_url: '',
    issued_at: '',
    expires_at: '',
  });
  const [savingDoc, setSavingDoc] = useState(false);

  const [specialtyForm, setSpecialtyForm] = useState({
    specialty: '',
    license_url: '',
  });
  const [savingSpecialty, setSavingSpecialty] = useState(false);

  const [vehicleForm, setVehicleForm] = useState({
    vehicle_type: 'Automóvil',
    brand: '',
    model: '',
    color: '',
    plate: '',
    vehicle_insurance_url: '',
    vehicle_insurance_expiry: '',
  });
  const [savingVehicle, setSavingVehicle] = useState(false);

  // Reseñas cruzadas hacia residentes
  const [residentRating, setResidentRating] = useState({});
  const [residentComment, setResidentComment] = useState({});
  const [sendingReviewId, setSendingReviewId] = useState(null);

  // Pases QR asignados por residentes para el prestador
  const [assignedPasses, setAssignedPasses] = useState([]);
  const [loadingPasses, setLoadingPasses] = useState(false);
  const [passesError, setPassesError] = useState('');
  const [passSearch, setPassSearch] = useState('');
  const [passStatusFilter, setPassStatusFilter] = useState('all');
  const [passPage, setPassPage] = useState(1);
  const [copiedPassId, setCopiedPassId] = useState(null);
  const [selectedPassModal, setSelectedPassModal] = useState(null);

  const primaryColor = brand?.primaryActionColor || '#059669';

  const cardStyle = {
    backgroundColor: brand?.cardBgColor || '#020617',
    color: brand?.cardTextColor || '#F1F5F9',
  };

  const innerStyle = {
    backgroundColor: brand?.innerBgColor || '#0F172A',
    color: brand?.innerTextColor || '#E2E8F0',
  };

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
  });

  const fetchProviderData = async () => {
    setLoadingProfile(true);
    setFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/me`, {
        method: 'GET',
        headers: authHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setProfiles(data.profiles || data.providers || []);
        setDocuments(data.documents || []);
        setVehicles(data.vehicles || []);
        setContracts(data.contracts || []);
      } else {
        setFeedback({
          type: 'error',
          text: data.error || 'No se pudo cargar la información del prestador.',
        });
      }
    } catch (error) {
      console.error('Error al cargar datos del prestador:', error);
      setFeedback({
        type: 'error',
        text: 'Error de conexión con el servidor backend de TrustLink.',
      });
    } finally {
      setLoadingProfile(false);
    }
  };

  // Consulta los Pases QR generados por residentes para este prestador
  const fetchAssignedPasses = async () => {
    setLoadingPasses(true);
    setPassesError('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/provider`, {
        method: 'GET',
        headers: authHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setAssignedPasses(data.passes || data.items || []);
      } else {
        setPassesError(
          data.error ||
            'No se pudieron obtener los pases QR asignados. Verificá el endpoint GET /api/v1/passes/provider.'
        );
      }
    } catch (error) {
      console.error('Error al cargar pases QR del prestador:', error);
      setPassesError('Error de conexión al consultar los pases QR asignados.');
    } finally {
      setLoadingPasses(false);
    }
  };

  useEffect(() => {
    fetchProviderData();
    fetchAssignedPasses();
  }, []);

  const handleSaveDocument = async (e) => {
    e.preventDefault();
    if (!docForm.doc_type.trim()) return;
    setSavingDoc(true);
    setFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/documents`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(docForm),
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({ type: 'success', text: 'Documentación guardada correctamente.' });
        setDocForm({
          doc_type: 'Antecedentes Penales',
          doc_url: '',
          issued_at: '',
          expires_at: '',
        });
        setShowDocForm(false);
        await fetchProviderData();
      } else {
        setFeedback({ type: 'error', text: data.error || 'No se pudo guardar la documentación.' });
      }
    } catch (error) {
      console.error('Error al guardar documento:', error);
      setFeedback({ type: 'error', text: 'Error de conexión al guardar documentación.' });
    } finally {
      setSavingDoc(false);
    }
  };

  const handleAddSpecialty = async (e) => {
    e.preventDefault();
    if (!specialtyForm.specialty.trim()) return;
    setSavingSpecialty(true);
    setFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/specialties`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(specialtyForm),
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({ type: 'success', text: 'Especialidad cargada correctamente.' });
        setSpecialtyForm({ specialty: '', license_url: '' });
        setShowSpecialtyForm(false);
        await fetchProviderData();
      } else {
        setFeedback({ type: 'error', text: data.error || 'No se pudo cargar la especialidad.' });
      }
    } catch (error) {
      console.error('Error al cargar especialidad:', error);
      setFeedback({ type: 'error', text: 'Error de conexión al cargar especialidad.' });
    } finally {
      setSavingSpecialty(false);
    }
  };

  const handleToggleSpecialtyVisibility = async (profileItem) => {
    const profileId = profileItem.id;
    const nextVisible = !(profileItem.is_visible_in_directory ?? true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/${profileId}/visibility`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ is_visible_in_directory: nextVisible }),
      });
      if (response.ok) {
        await fetchProviderData();
      }
    } catch (error) {
      console.error('Error al cambiar visibilidad de especialidad:', error);
    }
  };

  const handleAddVehicle = async (e) => {
    e.preventDefault();
    if (!vehicleForm.brand.trim() || !vehicleForm.plate.trim()) return;
    setSavingVehicle(true);
    setFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/vehicles`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(vehicleForm),
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({ type: 'success', text: 'Vehículo registrado correctamente.' });
        setVehicleForm({
          vehicle_type: 'Automóvil',
          brand: '',
          model: '',
          color: '',
          plate: '',
          vehicle_insurance_url: '',
          vehicle_insurance_expiry: '',
        });
        setShowVehicleForm(false);
        await fetchProviderData();
      } else {
        setFeedback({ type: 'error', text: data.error || 'No se pudo registrar el vehículo.' });
      }
    } catch (error) {
      console.error('Error al registrar vehículo:', error);
      setFeedback({ type: 'error', text: 'Error de conexión al registrar vehículo.' });
    } finally {
      setSavingVehicle(false);
    }
  };

  const handleSendOwnerReview = async (contractId) => {
    setSendingReviewId(contractId);
    setFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/v1/reviews/owner`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          contract_id: contractId,
          rating: Number(residentRating[contractId] || 5),
          comment: String(residentComment[contractId] || '').trim(),
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({ type: 'success', text: 'Calificación al residente enviada.' });
        await fetchProviderData();
      } else {
        setFeedback({ type: 'error', text: data.error || 'No se pudo enviar la reseña.' });
      }
    } catch (error) {
      console.error('Error al enviar reseña al residente:', error);
      setFeedback({ type: 'error', text: 'Error de conexión al enviar reseña.' });
    } finally {
      setSendingReviewId(null);
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

  const avgRating = useMemo(() => {
    if (!profiles.length) return '0.00';
    const sum = profiles.reduce((acc, p) => acc + Number(p.rating_avg || 0), 0);
    return (sum / profiles.length).toFixed(2);
  }, [profiles]);

  const primaryStatus = profiles[0]?.compliance_status || 'pending';

  const tabs = [
    {
      id: 'credentials',
      label: '1. Credenciales',
      count: profiles.length + documents.length,
      icon: FileText,
    },
    {
      id: 'vehicles',
      label: '2. Flota Vehicular',
      count: vehicles.length,
      icon: Car,
    },
    {
      id: 'reviews',
      label: '3. Reseñas',
      count: contracts.length,
      icon: Star,
    },
    {
      id: 'passes',
      label: '4. Pases QR',
      count: activePassesCount || assignedPasses.length,
      icon: QrCode,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-8 space-y-6">
      {/* Cabecera del Portal Prestador */}
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
            {user?.full_name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Gestión del Prestador'}
          </h1>
          <p className="text-xs sm:text-sm opacity-80">
            Administrá tus credenciales, vehículos, reseñas y pases QR habilitados para ingresar al barrio.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <span
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border border-amber-500/30 bg-amber-500/10 text-amber-300"
          >
            <Star size={13} className="fill-amber-400 text-amber-400" />
            Scoring: {avgRating}
          </span>

          <span
            className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-700/80"
            style={innerStyle}
          >
            Estado: {primaryStatus === 'approved' ? 'Aprobado' : 'Pendiente'}
          </span>

          <button
            type="button"
            onClick={() => {
              fetchProviderData();
              fetchAssignedPasses();
            }}
            className="p-2 rounded-xl border border-slate-700/80 hover:opacity-90 cursor-pointer"
            style={innerStyle}
            title="Actualizar información"
          >
            <RefreshCw size={15} className={loadingProfile || loadingPasses ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Selector de pasos clicables superiores */}
      <div
        className="rounded-2xl p-2 border border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2"
        style={cardStyle}
      >
        {tabs.map((tab) => {
          const IconComponent = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                isSelected
                  ? 'text-white border-transparent shadow-sm'
                  : 'border-slate-800/70 opacity-85 hover:opacity-100'
              }`}
              style={isSelected ? { backgroundColor: primaryColor } : innerStyle}
            >
              <span className="flex items-center gap-1.5 truncate">
                <IconComponent size={14} className="shrink-0" />
                <span className="truncate">{tab.label}</span>
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/25 shrink-0">
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {feedback.text && (
        <div
          className={`rounded-2xl p-4 text-xs border ${
            feedback.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-700/70 text-emerald-200'
              : 'bg-rose-950/50 border-rose-800/70 text-rose-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* PASO 1: Credenciales y Especialidades */}
      {activeTab === 'credentials' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Documentación Personal */}
          <section
            className="rounded-2xl p-5 border border-slate-800/80 space-y-4"
            style={cardStyle}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold">Documentación Personal</h2>
                <p className="text-xs opacity-75">
                  Antecedentes y ART / seguro personal del prestador.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDocForm((prev) => !prev)}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                <Plus size={14} /> {showDocForm ? 'Cerrar' : 'Cargar Doc.'}
              </button>
            </div>

            {showDocForm && (
              <form
                onSubmit={handleSaveDocument}
                className="rounded-xl p-4 border border-slate-700/80 space-y-3 text-xs"
                style={innerStyle}
              >
                <div>
                  <label className="block font-semibold mb-1">Tipo de documento</label>
                  <select
                    value={docForm.doc_type}
                    onChange={(e) => setDocForm((prev) => ({ ...prev, doc_type: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-700"
                    style={cardStyle}
                  >
                    <option value="Antecedentes Penales">Antecedentes Penales</option>
                    <option value="Póliza ART / Seguro">Póliza ART / Seguro</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">URL del comprobante</label>
                  <input
                    type="text"
                    value={docForm.doc_url}
                    onChange={(e) => setDocForm((prev) => ({ ...prev, doc_url: e.target.value }))}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-700"
                    style={cardStyle}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-semibold mb-1">Vigencia desde</label>
                    <input
                      type="date"
                      value={docForm.issued_at}
                      onChange={(e) =>
                        setDocForm((prev) => ({ ...prev, issued_at: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-700"
                      style={cardStyle}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Vigencia hasta</label>
                    <input
                      type="date"
                      value={docForm.expires_at}
                      onChange={(e) =>
                        setDocForm((prev) => ({ ...prev, expires_at: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-700"
                      style={cardStyle}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingDoc}
                    className="px-4 py-2 rounded-xl font-bold text-white cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {savingDoc ? 'Guardando...' : 'Guardar Documento'}
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2.5">
              {documents.length === 0 ? (
                <div
                  className="rounded-xl p-6 text-center text-xs opacity-75 border border-slate-800/60"
                  style={innerStyle}
                >
                  Sin documentación personal cargada todavía.
                </div>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="rounded-xl p-3.5 border border-slate-800/70 flex items-center justify-between gap-3 text-xs"
                    style={innerStyle}
                  >
                    <div className="min-w-0">
                      <p className="font-bold truncate">{doc.doc_type}</p>
                      <p className="opacity-75 truncate">{doc.doc_url || 'Sin enlace'}</p>
                      <p className="text-[11px] opacity-70 mt-0.5">
                        Vigencia: {doc.issued_at || '—'} → {doc.expires_at || 'Sin fecha'}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 shrink-0">
                      {doc.status || 'Registrado'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Especialidades y Matrículas */}
          <section
            className="rounded-2xl p-5 border border-slate-800/80 space-y-4"
            style={cardStyle}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold flex items-center gap-1.5">
                  <Award size={16} className="text-emerald-400" />
                  <span>Especialidades y Credenciales</span>
                </h2>
                <p className="text-xs opacity-75">
                  Rubros habilitados y visibilidad en el directorio de residentes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSpecialtyForm((prev) => !prev)}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                <Plus size={14} /> {showSpecialtyForm ? 'Cerrar' : 'Cargar Especialidad'}
              </button>
            </div>

            {showSpecialtyForm && (
              <form
                onSubmit={handleAddSpecialty}
                className="rounded-xl p-4 border border-slate-700/80 space-y-3 text-xs"
                style={innerStyle}
              >
                <div>
                  <label className="block font-semibold mb-1">Especialidad</label>
                  <input
                    type="text"
                    value={specialtyForm.specialty}
                    onChange={(e) =>
                      setSpecialtyForm((prev) => ({ ...prev, specialty: e.target.value }))
                    }
                    placeholder="Ej: Electricista Matriculado, Gasista..."
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-700"
                    style={cardStyle}
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">URL Matrícula / Habilitación</label>
                  <input
                    type="text"
                    value={specialtyForm.license_url}
                    onChange={(e) =>
                      setSpecialtyForm((prev) => ({ ...prev, license_url: e.target.value }))
                    }
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-700"
                    style={cardStyle}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingSpecialty}
                    className="px-4 py-2 rounded-xl font-bold text-white cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {savingSpecialty ? 'Guardando...' : 'Guardar Especialidad'}
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2.5">
              {profiles.length === 0 ? (
                <div
                  className="rounded-xl p-6 text-center text-xs opacity-75 border border-slate-800/60"
                  style={innerStyle}
                >
                  Todavía no cargaste especialidades.
                </div>
              ) : (
                profiles.map((prof) => {
                  const isVisible = prof.is_visible_in_directory ?? true;
                  return (
                    <div
                      key={prof.id}
                      className="rounded-xl p-3.5 border border-slate-800/70 flex items-center justify-between gap-3 text-xs"
                      style={innerStyle}
                    >
                      <div className="min-w-0">
                        <p className="font-bold truncate">{prof.specialty}</p>
                        <p className="text-[11px] opacity-75 mt-0.5">
                          Estado: {prof.compliance_status === 'approved' ? 'Aprobada' : 'Pendiente'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleSpecialtyVisibility(prof)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer shrink-0 ${
                          isVisible
                            ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {isVisible ? <Eye size={13} /> : <EyeOff size={13} />}
                        {isVisible ? 'Visible' : 'Oculta'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}

      {/* PASO 2: Flota Vehicular */}
      {activeTab === 'vehicles' && (
        <section
          className="rounded-2xl p-5 border border-slate-800/80 space-y-4"
          style={cardStyle}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-bold">Flota Vehicular</h2>
              <p className="text-xs opacity-75">
                Vehículos asociados a tu perfil para agilizar el control en el acceso.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowVehicleForm((prev) => !prev)}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
              style={{ backgroundColor: primaryColor }}
            >
              <Plus size={14} /> {showVehicleForm ? 'Cerrar' : 'Cargar Vehículo'}
            </button>
          </div>

          {showVehicleForm && (
            <form
              onSubmit={handleAddVehicle}
              className="rounded-xl p-4 border border-slate-700/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs"
              style={innerStyle}
            >
              <div>
                <label className="block font-semibold mb-1">Tipo de vehículo</label>
                <input
                  type="text"
                  value={vehicleForm.vehicle_type}
                  onChange={(e) =>
                    setVehicleForm((prev) => ({ ...prev, vehicle_type: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-700"
                  style={cardStyle}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Marca</label>
                <input
                  type="text"
                  value={vehicleForm.brand}
                  onChange={(e) => setVehicleForm((prev) => ({ ...prev, brand: e.target.value }))}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-700"
                  style={cardStyle}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Modelo</label>
                <input
                  type="text"
                  value={vehicleForm.model}
                  onChange={(e) => setVehicleForm((prev) => ({ ...prev, model: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-700"
                  style={cardStyle}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Color</label>
                <input
                  type="text"
                  value={vehicleForm.color}
                  onChange={(e) => setVehicleForm((prev) => ({ ...prev, color: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-700"
                  style={cardStyle}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Patente</label>
                <input
                  type="text"
                  value={vehicleForm.plate}
                  onChange={(e) => setVehicleForm((prev) => ({ ...prev, plate: e.target.value }))}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-700"
                  style={cardStyle}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Vencimiento seguro</label>
                <input
                  type="date"
                  value={vehicleForm.vehicle_insurance_expiry}
                  onChange={(e) =>
                    setVehicleForm((prev) => ({
                      ...prev,
                      vehicle_insurance_expiry: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-700"
                  style={cardStyle}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={savingVehicle}
                  className="px-4 py-2 rounded-xl font-bold text-white cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  {savingVehicle ? 'Guardando...' : 'Guardar Vehículo'}
                </button>
              </div>
            </form>
          )}

          {vehicles.length === 0 ? (
            <div
              className="rounded-xl p-8 text-center text-xs opacity-75 border border-slate-800/60"
              style={innerStyle}
            >
              No hay vehículos registrados en tu flota.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {vehicles.map((v) => (
                <div
                  key={v.id}
                  className="rounded-xl p-4 border border-slate-800/70 space-y-1.5 text-xs"
                  style={innerStyle}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm">
                      {v.brand} {v.model || ''}
                    </span>
                    <span className="font-mono font-bold px-2.5 py-0.5 rounded bg-black/30 border border-slate-700">
                      {v.plate}
                    </span>
                  </div>
                  <p className="opacity-80">
                    Tipo: {v.vehicle_type || 'Vehículo'} · Color: {v.color || 'No informado'}
                  </p>
                  {v.vehicle_insurance_expiry && (
                    <p className="opacity-75">Seguro vigente hasta: {v.vehicle_insurance_expiry}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* PASO 3: Reseñas y Reputación Cruzada */}
      {activeTab === 'reviews' && (
        <section
          className="rounded-2xl p-5 border border-slate-800/80 space-y-4"
          style={cardStyle}
        >
          <div>
            <h2 className="text-base sm:text-lg font-bold">Reseñas y Calificación Cruzada</h2>
            <p className="text-xs opacity-75">
              Consultá las calificaciones recibidas de residentes y calificá a quienes te contrataron.
            </p>
          </div>

          {contracts.length === 0 ? (
            <div
              className="rounded-xl p-8 text-center text-xs opacity-75 border border-slate-800/60"
              style={innerStyle}
            >
              Todavía no tenés contratos registrados para calificar.
            </div>
          ) : (
            <div className="space-y-3">
              {contracts.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl p-4 border border-slate-800/70 space-y-3 text-xs"
                  style={innerStyle}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">
                      Servicio #{item.id} ·{' '}
                      {item.owner_name ||
                        `${item.owner_first_name || ''} ${item.owner_last_name || ''}`.trim() ||
                        'Residente'}
                    </span>
                    <span className="opacity-75">Estado: {item.status}</span>
                  </div>

                  {item.provider_review_rating && (
                    <div className="rounded-lg p-2.5 bg-amber-950/25 border border-amber-700/40">
                      <span className="font-bold text-amber-300">
                        Calificación del residente: ★ {item.provider_review_rating}/5
                      </span>
                      {item.provider_review_comment && (
                        <p className="opacity-85 mt-0.5">“{item.provider_review_comment}”</p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                    <select
                      value={residentRating[item.id] ?? 5}
                      onChange={(e) =>
                        setResidentRating((prev) => ({
                          ...prev,
                          [item.id]: Number(e.target.value),
                        }))
                      }
                      className="sm:col-span-3 px-3 py-2 rounded-xl border border-slate-700"
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
                      value={residentComment[item.id] ?? ''}
                      onChange={(e) =>
                        setResidentComment((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      placeholder="Comentario sobre la atención o acceso..."
                      className="sm:col-span-6 px-3 py-2 rounded-xl border border-slate-700"
                      style={cardStyle}
                    />

                    <button
                      type="button"
                      disabled={sendingReviewId === item.id}
                      onClick={() => handleSendOwnerReview(item.id)}
                      className="sm:col-span-3 py-2 px-3 rounded-xl font-bold text-white cursor-pointer disabled:opacity-50"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {sendingReviewId === item.id ? 'Enviando...' : 'Calificar Residente'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* PASO 4: Pases QR Generados por Residentes para el Prestador */}
      {activeTab === 'passes' && (
        <section
          className="rounded-2xl p-5 border border-slate-800/80 space-y-4"
          style={cardStyle}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                Pases QR Generados para tu Ingreso
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
              className="rounded-xl p-8 text-center text-xs opacity-75 border border-slate-800/60"
              style={innerStyle}
            >
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
                      <p className="flex items-center gap-1.5 text-[11px] opacity-80">
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
      )}

      {/* Modal limpio para visualizar el token QR completo en el celular */}
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
                className="p-1.5 rounded-lg border border-slate-700/80 cursor-pointer"
                style={innerStyle}
              >
                <X size={15} />
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

            <div className="rounded-xl p-3 bg-black/35 border border-slate-700/70 space-y-2">
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