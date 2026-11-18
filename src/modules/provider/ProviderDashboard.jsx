/**
 * @file ProviderDashboard.jsx
 * @description Panel completo del Prestador conectado 100% a PostgreSQL con estructura flexible
 * que asegura la visibilidad inmediata de todos los elementos y el footer sin scroll forzado.
 * @location /trustlink-web/src/modules/provider/ProviderDashboard.jsx
 */

import React, { useState, useEffect } from 'react';
import { Wrench, ShieldCheck, Car, Plus, Edit3, Save, X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';

export default function ProviderDashboard() {
  const { brand } = useBranding();
  
  const [profileData, setProfileData] = useState({ providers: [], vehicles: [] });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Estados para nuevo compliance
  const [newSpecialty, setNewSpecialty] = useState('');
  const [newCrimUrl, setNewCrimUrl] = useState('');
  const [newCrimExp, setNewCrimExp] = useState('');
  const [newArtUrl, setNewArtUrl] = useState('');
  const [newArtExp, setNewArtExp] = useState('');

  // Estados para nuevo vehículo
  const [vehType, setVehType] = useState('Automóvil');
  const [vehBrand, setVehBrand] = useState('');
  const [vehModel, setVehModel] = useState('');
  const [vehColor, setVehColor] = useState('');
  const [vehPlate, setVehPlate] = useState('');

  // Estados de edición de Compliance
  const [editingProviderId, setEditingProviderId] = useState(null);
  const [editSpecialty, setEditSpecialty] = useState('');
  const [editCrimUrl, setEditCrimUrl] = useState('');
  const [editCrimExp, setEditCrimExp] = useState('');
  const [editArtUrl, setEditArtUrl] = useState('');
  const [editArtExp, setEditArtExp] = useState('');

  // Estados de edición de Vehículo
  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [editVehType, setEditVehType] = useState('Automóvil');
  const [editVehBrand, setEditVehBrand] = useState('');
  const [editVehModel, setEditVehModel] = useState('');
  const [editVehColor, setEditVehColor] = useState('');
  const [editVehPlate, setEditVehPlate] = useState('');

  const fetchProfile = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch('http://localhost:4000/api/v1/providers/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('trustlink_token') || ''}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setProfileData(data);
      } else {
        setErrorMsg(data.error || 'No se pudo cargar el perfil del prestador.');
      }
    } catch (error) {
      console.error('Error al conectar con el servidor:', error);
      setErrorMsg('Error de conexión con el backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Registrar nuevo compliance
  const handleRegisterCompliance = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch('http://localhost:4000/api/v1/providers/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('trustlink_token') || ''}`
        },
        body: JSON.stringify({
          specialty: newSpecialty,
          criminal_record_url: newCrimUrl || 'https://storage.trustlink.com/antecedentes.pdf',
          criminal_record_expiry: newCrimExp || null,
          insurance_policy_url: newArtUrl || 'https://storage.trustlink.com/art.pdf',
          insurance_expiry: newArtExp || null
        })
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg('Credencial de compliance registrada con éxito.');
        setNewSpecialty('');
        setNewCrimUrl('');
        setNewCrimExp('');
        setNewArtUrl('');
        setNewArtExp('');
        fetchProfile();
      } else {
        setErrorMsg(data.error || 'Error al registrar compliance.');
      }
    } catch (err) {
      setErrorMsg('Error de red al registrar compliance.');
    }
  };

  // Guardar edición de compliance
  const handleSaveComplianceEdit = async (id) => {
    setErrorMsg('');
    try {
      const response = await fetch(`http://localhost:4000/api/v1/providers/profile/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('trustlink_token') || ''}`
        },
        body: JSON.stringify({
          specialty: editSpecialty,
          criminal_record_url: editCrimUrl || null,
          criminal_record_expiry: editCrimExp || null,
          insurance_policy_url: editArtUrl || null,
          insurance_expiry: editArtExp || null
        })
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg('Credencial actualizada con éxito.');
        setEditingProviderId(null);
        fetchProfile();
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar la credencial.');
      }
    } catch (err) {
      setErrorMsg('Error de red al actualizar credencial.');
    }
  };

  // Registrar vehículo
  const handleRegisterVehicle = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch('http://localhost:4000/api/v1/providers/vehicle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('trustlink_token') || ''}`
        },
        body: JSON.stringify({
          vehicle_type: vehType,
          brand: vehBrand,
          model: vehModel,
          color: vehColor,
          plate: vehPlate
        })
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg('Vehículo asociado con éxito a su flota.');
        setVehBrand('');
        setVehModel('');
        setVehColor('');
        setVehPlate('');
        fetchProfile();
      } else {
        setErrorMsg(data.error || 'Error al registrar vehículo.');
      }
    } catch (err) {
      setErrorMsg('Error de red al registrar vehículo.');
    }
  };

  // Guardar edición de vehículo
  const handleSaveVehicleEdit = async (id) => {
    setErrorMsg('');
    try {
      const response = await fetch(`http://localhost:4000/api/v1/providers/vehicle/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('trustlink_token') || ''}`
        },
        body: JSON.stringify({
          vehicle_type: editVehType,
          brand: editVehBrand,
          model: editVehModel,
          color: editVehColor,
          plate: editVehPlate
        })
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg('Vehículo actualizado con éxito en PostgreSQL.');
        setEditingVehicleId(null);
        fetchProfile();
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar el vehículo.');
      }
    } catch (err) {
      setErrorMsg('Error de red al actualizar vehículo.');
    }
  };

  const providerStatus = profileData.providers[0]?.status || 'PENDING';

  return (
    <div className="flex-grow bg-slate-900 text-slate-100 font-sans p-6 md:p-8">
      
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Cabecera del Panel */}
        <header className="bg-slate-950 border border-slate-800 px-6 py-5 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center space-x-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-md shrink-0"
              style={{ backgroundColor: brand.primaryColor || '#10b981' }}
            >
              <Wrench size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white">Panel de Gestión del Prestador</h1>
              <p className="text-xs text-slate-400">Administre su especialidad, historial de compliance y flota vehicular autorizada.</p>
            </div>
          </div>
          
          <div className="bg-slate-900 border border-slate-700 px-3 py-1 rounded-xl text-xs font-bold text-amber-400 flex items-center gap-2 shrink-0 shadow-sm">
            <span className="text-slate-400 font-normal">Estado Actual:</span>
            <span className="uppercase tracking-wider">{providerStatus}</span>
          </div>
        </header>

        {successMsg && (
          <div className="bg-emerald-950/50 border border-emerald-600 text-emerald-200 p-3 rounded-xl text-xs flex items-center gap-2 shadow-sm">
            <CheckCircle2 size={16} /> <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="bg-rose-950/50 border border-rose-800 text-rose-200 p-3 rounded-xl text-xs flex items-center gap-2 shadow-sm">
            <AlertCircle size={16} /> <span>{errorMsg}</span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-slate-400 text-xs">Cargando perfil desde PostgreSQL...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* SECCIÓN 1: Credenciales y Compliance */}
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-5">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-400" /> Credenciales y Compliance (Historial)
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Gestione o actualice su documentación con sus fechas de vigencia.</p>
              </div>

              {/* Listado de perfiles cargados */}
              <div className="space-y-3">
                {profileData.providers.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No hay credenciales registradas aún.</p>
                ) : (
                  profileData.providers.map((p) => (
                    <div key={p.id} className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-2">
                      {editingProviderId === p.id ? (
                        <div className="space-y-2.5">
                          <div>
                            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Especialidad</label>
                            <input
                              type="text"
                              value={editSpecialty}
                              onChange={(e) => setEditSpecialty(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-white"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">URL Antecedentes</label>
                              <input
                                type="url"
                                value={editCrimUrl}
                                onChange={(e) => setEditCrimUrl(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Vence Antecedentes</label>
                              <input
                                type="date"
                                value={editCrimExp}
                                onChange={(e) => setEditCrimExp(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-white"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">URL Póliza ART</label>
                              <input
                                type="url"
                                value={editArtUrl}
                                onChange={(e) => setEditArtUrl(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Vence ART</label>
                              <input
                                type="date"
                                value={editArtExp}
                                onChange={(e) => setEditArtExp(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-white"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              onClick={() => setEditingProviderId(null)}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleSaveComplianceEdit(p.id)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1"
                            >
                              <Save size={13} /> Guardar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-xs">{p.specialty}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                p.status === 'approved' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                              }`}>
                                {p.status.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">
                              Antecedentes Vence: <strong className="text-slate-200">{p.criminal_record_expiry ? new Date(p.criminal_record_expiry).toLocaleDateString() : 'N/D'}</strong> | 
                              ART Vence: <strong className="text-slate-200">{p.insurance_expiry ? new Date(p.insurance_expiry).toLocaleDateString() : 'N/D'}</strong>
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setEditingProviderId(p.id);
                              setEditSpecialty(p.specialty || '');
                              setEditCrimUrl(p.criminal_record_url || '');
                              setEditCrimExp(p.criminal_record_expiry ? p.criminal_record_expiry.split('T')[0] : '');
                              setEditArtUrl(p.insurance_policy_url || '');
                              setEditArtExp(p.insurance_expiry ? p.insurance_expiry.split('T')[0] : '');
                            }}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-1.5 rounded-lg transition-colors cursor-pointer"
                            title="Editar Credencial"
                          >
                            <Edit3 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Formulario para Registrar Nuevo Perfil / Renovación */}
              <form onSubmit={handleRegisterCompliance} className="border-t border-slate-900 pt-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Registrar Nuevo Perfil / Renovación</h3>
                
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Especialidad Principal / Oficio</label>
                  <input
                    type="text"
                    required
                    value={newSpecialty}
                    onChange={(e) => setNewSpecialty(e.target.value)}
                    placeholder="Ej: Electricista Matriculado"
                    className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">URL Antecedentes (PDF)</label>
                    <input
                      type="url"
                      value={newCrimUrl}
                      onChange={(e) => setNewCrimUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Vigencia Antecedentes</label>
                    <input
                      type="date"
                      value={newCrimExp}
                      onChange={(e) => setNewCrimExp(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">URL Póliza ART (PDF)</label>
                    <input
                      type="url"
                      value={newArtUrl}
                      onChange={(e) => setNewArtUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Vigencia Póliza ART</label>
                    <input
                      type="date"
                      value={newArtExp}
                      onChange={(e) => setNewArtExp(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-xs text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                  style={{ backgroundColor: brand.primaryColor || '#10b981' }}
                >
                  <Plus size={14} /> Registrar Nuevo Compliance
                </button>
              </form>
            </div>

            {/* SECCIÓN 2: Flota Vehicular Autorizada */}
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-5">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Car size={16} className="text-emerald-400" /> Flota Vehicular Autorizada
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Gestione los vehículos habilitados para el ingreso perimetral.</p>
              </div>

              {/* Listado de vehículos */}
              <div className="space-y-3">
                {profileData.vehicles.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No hay vehículos registrados en su flota.</p>
                ) : (
                  profileData.vehicles.map((v) => (
                    <div key={v.id} className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-2">
                      {editingVehicleId === v.id ? (
                        <div className="space-y-2.5">
                          <div>
                            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Tipo de Vehículo</label>
                            <select
                              value={editVehType}
                              onChange={(e) => setEditVehType(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-white"
                            >
                              <option value="Automóvil">Automóvil</option>
                              <option value="Utilitario">Utilitario</option>
                              <option value="Motocicleta">Motocicleta</option>
                              <option value="Camión / Flete">Camión / Flete</option>
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Marca</label>
                              <input
                                type="text"
                                value={editVehBrand}
                                onChange={(e) => setEditVehBrand(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Modelo</label>
                              <input
                                type="text"
                                value={editVehModel}
                                onChange={(e) => setEditVehModel(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-white"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Color</label>
                              <input
                                type="text"
                                value={editVehColor}
                                onChange={(e) => setEditVehColor(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Patente</label>
                              <input
                                type="text"
                                value={editVehPlate}
                                onChange={(e) => setEditVehPlate(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-white uppercase font-mono"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              onClick={() => setEditingVehicleId(null)}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleSaveVehicleEdit(v.id)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1"
                            >
                              <Save size={13} /> Guardar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-xs font-bold text-white flex items-center gap-2">
                              {v.brand} {v.model} 
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-950 text-sky-400 border border-sky-800 uppercase tracking-wider">
                                {v.vehicle_type || 'Vehículo'}
                              </span>
                            </h3>
                            <p className="text-[11px] text-slate-400 mt-1">
                              Patente: <strong className="text-emerald-400 font-mono">{v.plate}</strong> | Color: {v.color}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setEditingVehicleId(v.id);
                              setEditVehType(v.vehicle_type || 'Automóvil');
                              setEditVehBrand(v.brand || '');
                              setEditVehModel(v.model || '');
                              setEditVehColor(v.color || '');
                              setEditVehPlate(v.plate || '');
                            }}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-1.5 rounded-lg transition-colors cursor-pointer"
                            title="Editar Vehículo"
                          >
                            <Edit3 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Formulario para Asociar Nuevo Vehículo */}
              <form onSubmit={handleRegisterVehicle} className="border-t border-slate-900 pt-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Asociar Nuevo Vehículo</h3>
                
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Tipo de Vehículo</label>
                  <select
                    value={vehType}
                    onChange={(e) => setVehType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-xs text-white"
                  >
                    <option value="Automóvil">Automóvil</option>
                    <option value="Utilitario">Utilitario</option>
                    <option value="Motocicleta">Motocicleta</option>
                    <option value="Camión / Flete">Camión / Flete</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Patente / Dominio</label>
                  <input
                    type="text"
                    required
                    value={vehPlate}
                    onChange={(e) => setVehPlate(e.target.value)}
                    placeholder="Ej: AB123CD"
                    className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-xs text-white uppercase font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Marca</label>
                    <input
                      type="text"
                      required
                      value={vehBrand}
                      onChange={(e) => setVehBrand(e.target.value)}
                      placeholder="Ej: Ford"
                      className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Modelo</label>
                    <input
                      type="text"
                      required
                      value={vehModel}
                      onChange={(e) => setVehModel(e.target.value)}
                      placeholder="Ej: Ranger"
                      className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Color</label>
                    <input
                      type="text"
                      required
                      value={vehColor}
                      onChange={(e) => setVehColor(e.target.value)}
                      placeholder="Ej: Blanco"
                      className="w-full bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-xs text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                  style={{ backgroundColor: brand.primaryColor || '#10b981' }}
                >
                  <Plus size={14} /> Registrar y Asociar Vehículo
                </button>
              </form>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}