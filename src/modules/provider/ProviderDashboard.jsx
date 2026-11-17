/**
 * @file ProviderDashboard.jsx
 * @description Panel completo de gestión del prestador con soporte para historial, edición de registros
 * existentes y adición de nuevos elementos en Credenciales y Compliance y Flota Vehicular.
 * @location /trustlink-web/src/modules/provider/ProviderDashboard.jsx
 */
import React, { useState, useEffect } from 'react';
import { Wrench, ShieldCheck, Car, FileText, CheckCircle2, AlertCircle, Plus, Upload, Loader2, Edit3, Calendar } from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';

export default function ProviderDashboard() {
  const { brand } = useBranding();

  // Historial de perfiles de compliance y vehículos desde la BD
  const [providerProfiles, setProviderProfiles] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  // Estados para formulario NUEVO de Compliance
  const [newCompliance, setNewCompliance] = useState({
    specialty: '',
    criminal_record_url: '',
    criminal_record_expiry: '',
    insurance_policy_url: '',
    insurance_expiry: ''
  });

  // Estado para EDICIÓN de Compliance
  const [editingComplianceId, setEditingComplianceId] = useState(null);
  const [editComplianceForm, setEditComplianceForm] = useState({});

  // Estados para formulario NUEVO de Vehículo
  const [newVehicle, setNewVehicle] = useState({
    vehicle_type: 'Automóvil',
    brand: '',
    model: '',
    plate: '',
    color: '',
    vehicle_insurance_url: ''
  });

  // Estado para EDICIÓN de Vehículo
  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [editVehicleForm, setEditVehicleForm] = useState({});

  // Mensajes y carga
  const [fetching, setFetching] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const fetchProviderData = async () => {
    setFetching(true);
    try {
      const response = await fetch('http://localhost:4000/api/v1/providers/me', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('trustlink_token') || ''}` }
      });
      const data = await response.json();
      if (response.ok) {
        setProviderProfiles(data.providers || []);
        setVehicles(data.vehicles || []);
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchProviderData();
  }, []);

  // Agregar nuevo registro de Compliance
  const handleAddCompliance = async (e) => {
    e.preventDefault();
    setLoadingAction(true);
    setFeedback({ type: '', text: '' });

    try {
      const response = await fetch('http://localhost:4000/api/v1/providers/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('trustlink_token') || ''}`
        },
        body: JSON.stringify(newCompliance)
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({ type: 'success', text: '¡Nuevo registro de compliance agregado al historial!' });
        setNewCompliance({ specialty: '', criminal_record_url: '', criminal_record_expiry: '', insurance_policy_url: '', insurance_expiry: '' });
        fetchProviderData();
      } else {
        setFeedback({ type: 'error', text: data.error || 'Error al guardar.' });
      }
    } catch (error) {
      setFeedback({ type: 'error', text: 'Error de conexión con el servidor.' });
    } finally {
      setLoadingAction(false);
    }
  };

  // Guardar edición de Compliance
  const handleSaveEditCompliance = async (id) => {
    setLoadingAction(true);
    try {
      const response = await fetch(`http://localhost:4000/api/v1/providers/profile/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('trustlink_token') || ''}`
        },
        body: JSON.stringify(editComplianceForm)
      });
      if (response.ok) {
        setFeedback({ type: 'success', text: '¡Registro de compliance actualizado con éxito!' });
        setEditingComplianceId(null);
        fetchProviderData();
      } else {
        const data = await response.json();
        setFeedback({ type: 'error', text: data.error || 'Error al actualizar.' });
      }
    } catch (error) {
      setFeedback({ type: 'error', text: 'Error de conexión.' });
    } finally {
      setLoadingAction(false);
    }
  };

  // Agregar nuevo vehículo
  const handleAddVehicle = async (e) => {
    e.preventDefault();
    setLoadingAction(true);
    setFeedback({ type: '', text: '' });

    try {
      const response = await fetch('http://localhost:4000/api/v1/providers/vehicle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('trustlink_token') || ''}`
        },
        body: JSON.stringify(newVehicle)
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({ type: 'success', text: `Vehículo ${data.vehicle.plate} agregado a la flota.` });
        setNewVehicle({ vehicle_type: 'Automóvil', brand: '', model: '', plate: '', color: '', vehicle_insurance_url: '' });
        fetchProviderData();
      } else {
        setFeedback({ type: 'error', text: data.error || 'Error al registrar vehículo.' });
      }
    } catch (error) {
      setFeedback({ type: 'error', text: 'Error de conexión.' });
    } finally {
      setLoadingAction(false);
    }
  };

  // Guardar edición de Vehículo
  const handleSaveEditVehicle = async (id) => {
    setLoadingAction(true);
    try {
      const response = await fetch(`http://localhost:4000/api/v1/providers/vehicle/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('trustlink_token') || ''}`
        },
        body: JSON.stringify(editVehicleForm)
      });
      if (response.ok) {
        setFeedback({ type: 'success', text: '¡Vehículo actualizado correctamente!' });
        setEditingVehicleId(null);
        fetchProviderData();
      } else {
        const data = await response.json();
        setFeedback({ type: 'error', text: data.error || 'Error al actualizar vehículo.' });
      }
    } catch (error) {
      setFeedback({ type: 'error', text: 'Error de conexión.' });
    } finally {
      setLoadingAction(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-[calc(100vh-60px)] bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="flex items-center gap-2 text-emerald-400 font-bold">
          <Loader2 className="animate-spin" size={24} /> Cargando panel profesional...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-slate-900 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Cabecera */}
        <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl shadow-xl flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-inner">
              <Wrench size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Panel de Gestión del Prestador</h1>
              <p className="text-xs text-slate-400">Historial de compliance, vigencias y flota vehicular autorizada para operar en la red.</p>
            </div>
          </div>
        </div>

        {feedback.text && (
          <div className={`p-4 rounded-xl text-xs flex items-center gap-2 border ${
            feedback.type === 'success' ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800' : 'bg-rose-950/40 text-rose-300 border-rose-800'
          }`}>
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* ==================================================== */}
        {/* SECCIÓN 1: CREDENCIALES Y COMPLIANCE (Historial + Editar + Agregar) */}
        {/* ==================================================== */}
        <div className="bg-slate-950 border border-slate-800 p-8 rounded-3xl shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-emerald-400" size={20} />
              <h2 className="text-lg font-bold text-white">Historial de Credenciales y Compliance</h2>
            </div>
            <span className="text-xs bg-slate-900 border border-slate-700 px-3 py-1 rounded-lg text-slate-300">
              Registros totales: {providerProfiles.length}
            </span>
          </div>

          {/* Listado / Historial de Compliance */}
          <div className="space-y-4">
            {providerProfiles.map((p) => {
              const isEditing = editingComplianceId === p.id;
              return (
                <div key={p.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-emerald-400 uppercase">Editando Registro #{p.id}</span>
                        <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold ${p.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          {p.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Especialidad</label>
                          <input
                            type="text"
                            value={editComplianceForm.specialty ?? p.specialty}
                            onChange={(e) => setEditComplianceForm({ ...editComplianceForm, specialty: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">URL Antecedentes Penales</label>
                          <input
                            type="url"
                            value={editComplianceForm.criminal_record_url ?? (p.criminal_record_url || '')}
                            onChange={(e) => setEditComplianceForm({ ...editComplianceForm, criminal_record_url: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Vigencia Antecedentes</label>
                          <input
                            type="date"
                            value={editComplianceForm.criminal_record_expiry ?? (p.criminal_record_expiry ? p.criminal_record_expiry.split('T')[0] : '')}
                            onChange={(e) => setEditComplianceForm({ ...editComplianceForm, criminal_record_expiry: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">URL Póliza ART / Seguro</label>
                          <input
                            type="url"
                            value={editComplianceForm.insurance_policy_url ?? (p.insurance_policy_url || '')}
                            onChange={(e) => setEditComplianceForm({ ...editComplianceForm, insurance_policy_url: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Vigencia Póliza / ART</label>
                          <input
                            type="date"
                            value={editComplianceForm.insurance_expiry ?? (p.insurance_expiry ? p.insurance_expiry.split('T')[0] : '')}
                            onChange={(e) => setEditComplianceForm({ ...editComplianceForm, insurance_expiry: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end pt-2">
                        <button
                          onClick={() => setEditingComplianceId(null)}
                          className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleSaveEditCompliance(p.id)}
                          disabled={loadingAction}
                          className="px-3 py-1.5 rounded-lg text-xs bg-emerald-600 text-white font-bold hover:bg-emerald-500 cursor-pointer"
                        >
                          Guardar Cambios
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-white text-base">{p.specialty}</span>
                          <span className={`text-[10px] uppercase px-2.5 py-0.5 rounded font-bold ${
                            p.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                            {p.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 space-y-1">
                          <p>Antecedentes: <a href={p.criminal_record_url || '#'} target="_blank" rel="noreferrer" className="text-emerald-400 underline font-mono">Ver PDF</a> (Vence: {p.criminal_record_expiry ? p.criminal_record_expiry.split('T')[0] : 'No especificada'})</p>
                          <p>Póliza ART: <a href={p.insurance_policy_url || '#'} target="_blank" rel="noreferrer" className="text-emerald-400 underline font-mono">Ver PDF</a> (Vence: {p.insurance_expiry ? p.insurance_expiry.split('T')[0] : 'No especificada'})</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setEditingComplianceId(p.id);
                          setEditComplianceForm(p);
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 font-bold cursor-pointer"
                      >
                        <Edit3 size={14} /> Editar Registro
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Formulario para Agregar Nuevo Registro de Compliance */}
          <form onSubmit={handleAddCompliance} className="bg-slate-900/80 border border-dashed border-slate-700 p-6 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold uppercase text-emerald-400 flex items-center gap-1.5">
              <Plus size={16} /> Agregar Nuevo Registro de Compliance al Historial
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Especialidad Principal / Oficio</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Electricista Matriculado"
                  value={newCompliance.specialty}
                  onChange={(e) => setNewCompliance({ ...newCompliance, specialty: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">URL Antecedentes Penales (PDF)</label>
                <input
                  type="url"
                  placeholder="https://storage.trustlink.com/antecedentes.pdf"
                  value={newCompliance.criminal_record_url}
                  onChange={(e) => setNewCompliance({ ...newCompliance, criminal_record_url: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Fecha de vigencia de antecedentes</label>
                <input
                  type="date"
                  value={newCompliance.criminal_record_expiry}
                  onChange={(e) => setNewCompliance({ ...newCompliance, criminal_record_expiry: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">URL Póliza de Seguro / ART (PDF)</label>
                <input
                  type="url"
                  placeholder="https://storage.trustlink.com/art.pdf"
                  value={newCompliance.insurance_policy_url}
                  onChange={(e) => setNewCompliance({ ...newCompliance, insurance_policy_url: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Fecha de vigencia póliza / ART</label>
                <input
                  type="date"
                  value={newCompliance.insurance_expiry}
                  onChange={(e) => setNewCompliance({ ...newCompliance, insurance_expiry: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loadingAction}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Upload size={14} /> Registrar Nuevo Compliance
            </button>
          </form>
        </div>

        {/* ==================================================== */}
        {/* SECCIÓN 2: FLOTA VEHICULAR (Historial + Editar + Agregar) */}
        {/* ==================================================== */}
        <div className="bg-slate-950 border border-slate-800 p-8 rounded-3xl shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <Car className="text-emerald-400" size={20} />
              <h2 className="text-lg font-bold text-white">Flota Vehicular Autorizada (Historial)</h2>
            </div>
            <span className="text-xs bg-slate-900 border border-slate-700 px-3 py-1 rounded-lg text-slate-300">
              Vehículos registrados: {vehicles.length}
            </span>
          </div>

          {/* Listado / Historial de Vehículos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vehicles.map((v) => {
              const isEditing = editingVehicleId === v.id;
              return (
                <div key={v.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
                  {isEditing ? (
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-blue-400 uppercase">Editando Vehículo #{v.id}</span>
                      <input
                        type="text"
                        placeholder="Tipo (Ej. Utilitario)"
                        value={editVehicleForm.vehicle_type ?? v.vehicle_type}
                        onChange={(e) => setEditVehicleForm({ ...editVehicleForm, vehicle_type: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Marca"
                          value={editVehicleForm.brand ?? v.brand}
                          onChange={(e) => setEditVehicleForm({ ...editVehicleForm, brand: e.target.value })}
                          className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                        />
                        <input
                          type="text"
                          placeholder="Modelo"
                          value={editVehicleForm.model ?? v.model}
                          onChange={(e) => setEditVehicleForm({ ...editVehicleForm, model: e.target.value })}
                          className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Patente"
                          value={editVehicleForm.plate ?? v.plate}
                          onChange={(e) => setEditVehicleForm({ ...editVehicleForm, plate: e.target.value })}
                          className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white uppercase font-mono"
                        />
                        <input
                          type="text"
                          placeholder="Color"
                          value={editVehicleForm.color ?? v.color}
                          onChange={(e) => setEditVehicleForm({ ...editVehicleForm, color: e.target.value })}
                          className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                        />
                      </div>
                      <input
                        type="url"
                        placeholder="URL Póliza Seguro"
                        value={editVehicleForm.vehicle_insurance_url ?? (v.vehicle_insurance_url || '')}
                        onChange={(e) => setEditVehicleForm({ ...editVehicleForm, vehicle_insurance_url: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                      />
                      <div className="flex gap-2 justify-end pt-2">
                        <button onClick={() => setEditingVehicleId(null)} className="px-3 py-1 rounded text-xs bg-slate-800 text-slate-300 cursor-pointer">Cancelar</button>
                        <button onClick={() => handleSaveEditVehicle(v.id)} className="px-3 py-1 rounded text-xs bg-blue-600 text-white font-bold cursor-pointer">Guardar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] uppercase font-bold bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">{v.vehicle_type || 'Vehículo'}</span>
                        <h4 className="font-bold text-white text-sm mt-1">{v.brand} {v.model}</h4>
                        <p className="text-xs text-slate-400">Patente: <span className="text-emerald-400 font-mono font-bold">{v.plate}</span> ({v.color})</p>
                        {v.vehicle_insurance_url && <a href={v.vehicle_insurance_url} target="_blank" rel="noreferrer" className="text-[11px] text-blue-400 underline block mt-1">Ver Póliza Vehicular</a>}
                      </div>
                      <button
                        onClick={() => {
                          setEditingVehicleId(v.id);
                          setEditVehicleForm(v);
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 p-2 rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Formulario para Agregar Nuevo Vehículo */}
          <form onSubmit={handleAddVehicle} className="bg-slate-900/80 border border-dashed border-slate-700 p-6 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold uppercase text-blue-400 flex items-center gap-1.5">
              <Plus size={16} /> Asociar Nuevo Vehículo a la Flota
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Tipo de Vehículo</label>
                <select
                  value={newVehicle.vehicle_type}
                  onChange={(e) => setNewVehicle({ ...newVehicle, vehicle_type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white"
                >
                  <option value="Automóvil">Automóvil</option>
                  <option value="Utilitario">Utilitario</option>
                  <option value="Camión / Furgón">Camión / Furgón</option>
                  <option value="Motocicleta">Motocicleta</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Marca</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Ford"
                  value={newVehicle.brand}
                  onChange={(e) => setNewVehicle({ ...newVehicle, brand: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Modelo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Ranger"
                  value={newVehicle.model}
                  onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Patente</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. AE123XX"
                  value={newVehicle.plate}
                  onChange={(e) => setNewVehicle({ ...newVehicle, plate: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white uppercase font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Color</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Blanco"
                  value={newVehicle.color}
                  onChange={(e) => setNewVehicle({ ...newVehicle, color: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">URL Seguro / Póliza Vehicular</label>
                <input
                  type="url"
                  placeholder="https://storage.trustlink.com/seguro.pdf"
                  value={newVehicle.vehicle_insurance_url}
                  onChange={(e) => setNewVehicle({ ...newVehicle, vehicle_insurance_url: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white font-mono"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loadingAction}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Plus size={14} /> Registrar y Agregar Vehículo
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}