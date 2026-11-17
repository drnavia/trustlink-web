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
  
  const [providerProfiles, setProviderProfiles] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Formulario de Compliance
  const [specialty, setSpecialty] = useState('');
  const [criminalRecordUrl, setCriminalRecordUrl] = useState('');
  const [criminalExpiry, setCriminalExpiry] = useState('');
  const [insurancePolicyUrl, setInsurancePolicyUrl] = useState('');
  const [insuranceExpiry, setInsuranceExpiry] = useState('');

  // Formulario de Vehículo
  const [vehicleType, setVehicleType] = useState('Automóvil');
  const [brandCar, setBrandCar] = useState('');
  const [modelCar, setModelCar] = useState('');
  const [plateCar, setPlateCar] = useState('');
  const [colorCar, setColorCar] = useState('');
  const [vehicleInsurance, setVehicleInsurance] = useState('');

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
      console.error('Error al cargar datos del prestador:', error);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchProviderData();
  }, []);

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
        body: JSON.stringify({
          specialty,
          criminal_record_url: criminalRecordUrl,
          criminal_record_expiry: criminalExpiry,
          insurance_policy_url: insurancePolicyUrl,
          insurance_expiry: insuranceExpiry
        })
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({ type: 'success', text: '¡Nuevo registro de compliance agregado con éxito!' });
        fetchProviderData();
        setSpecialty('');
        setCriminalRecordUrl('');
        setCriminalExpiry('');
        setInsurancePolicyUrl('');
        setInsuranceExpiry('');
      } else {
        setFeedback({ type: 'error', text: data.error || 'Error al guardar compliance.' });
      }
    } catch (error) {
      setFeedback({ type: 'error', text: 'Error de conexión con el servidor.' });
    } finally {
      setLoadingAction(false);
    }
  };

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
        body: JSON.stringify({
          vehicle_type: vehicleType,
          brand: brandCar,
          model: modelCar,
          plate: plateCar,
          color: colorCar,
          vehicle_insurance_url: vehicleInsurance
        })
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({ type: 'success', text: '¡Vehículo asociado con éxito!' });
        fetchProviderData();
        setBrandCar('');
        setModelCar('');
        setPlateCar('');
        setColorCar('');
        setVehicleInsurance('');
      } else {
        setFeedback({ type: 'error', text: data.error || 'Error al registrar vehículo.' });
      }
    } catch (error) {
      setFeedback({ type: 'error', text: 'Error de conexión con el servidor.' });
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 animate-fadeIn">
      {/* Encabezado del Panel */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Wrench className="text-emerald-400" size={24} /> Panel de Gestión del Prestador
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Administre su especialidad, historial de compliance (antecedentes y ART) y flota vehicular autorizada.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-mono">
            Estado Actual: <strong className="text-amber-400 uppercase">{providerProfiles[0]?.status || 'Sin Perfil'}</strong>
          </span>
        </div>
      </div>

      {feedback.text && (
        <div className={`p-4 rounded-2xl text-xs flex items-center gap-2 border ${
          feedback.type === 'success' ? 'bg-emerald-950/40 border-emerald-900 text-emerald-300' : 'bg-rose-950/40 border-rose-900 text-rose-300'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {feedback.text}
        </div>
      )}

      {fetching ? (
        <div className="text-center py-20">
          <Loader2 className="animate-spin mx-auto text-emerald-400 mb-3" size={32} />
          <p className="text-xs text-slate-400">Cargando información desde la base de datos...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* SECCIÓN 1: CREDENCIALES Y COMPLIANCE */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="text-emerald-400" size={18} /> Credenciales y Compliance (Historial)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Agregue o actualice su documentación con sus fechas de vigencia.</p>
            </div>

            {/* Listado Histórico */}
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {providerProfiles.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No hay registros de compliance cargados aún.</p>
              ) : (
                providerProfiles.map((p, idx) => (
                  <div key={p.id || idx} className="bg-slate-900 border border-slate-800/80 rounded-2xl p-3.5 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-white"># {p.specialty}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950 text-amber-400 border border-slate-800 font-mono uppercase">
                        {p.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 grid grid-cols-2 gap-2 pt-1">
                      <div>Antecedentes Vence: <strong className="text-slate-200">{p.criminal_record_expiry ? new Date(p.criminal_record_expiry).toLocaleDateString() : 'N/D'}</strong></div>
                      <div>ART Vence: <strong className="text-slate-200">{p.insurance_expiry ? new Date(p.insurance_expiry).toLocaleDateString() : 'N/D'}</strong></div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Formulario Nuevo Compliance */}
            <form onSubmit={handleAddCompliance} className="space-y-4 pt-2 border-t border-slate-800">
              <h4 className="text-xs font-bold text-slate-300">Registrar Nuevo Perfil / Renovación</h4>
              
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Especialidad Principal / Oficio</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Electricista Matriculado"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">URL Antecedentes (PDF)</label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={criminalRecordUrl}
                    onChange={(e) => setCriminalRecordUrl(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Vigencia Antecedentes</label>
                  <input
                    type="date"
                    value={criminalExpiry}
                    onChange={(e) => setCriminalExpiry(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">URL Póliza ART (PDF)</label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={insurancePolicyUrl}
                    onChange={(e) => setInsurancePolicyUrl(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Vigencia Póliza ART</label>
                  <input
                    type="date"
                    value={insuranceExpiry}
                    onChange={(e) => setInsuranceExpiry(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loadingAction}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                style={{ backgroundColor: brand.primaryColor }}
              >
                {loadingAction ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} 
                Registrar Nuevo Compliance
              </button>
            </form>
          </div>

          {/* SECCIÓN 2: FLOTA VEHICULAR AUTORIZADA */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Car className="text-blue-400" size={18} /> Flota Vehicular Autorizada
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Gestione los vehículos habilitados para el ingreso perimetral.</p>
            </div>

            {/* Listado de Vehículos */}
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {vehicles.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No hay vehículos asociados en la base de datos.</p>
              ) : (
                vehicles.map((v) => (
                  <div key={v.id} className="bg-slate-900 border border-slate-800/80 rounded-2xl p-3.5 flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-white">{v.brand} {v.model} ({v.vehicle_type})</span>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">Patente: <strong className="text-emerald-400">{v.plate}</strong> | Color: {v.color}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Formulario Nuevo Vehículo */}
            <form onSubmit={handleAddVehicle} className="space-y-4 pt-2 border-t border-slate-800">
              <h4 className="text-xs font-bold text-slate-300">Asociar Nuevo Vehículo</h4>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Tipo de Vehículo</label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Automóvil">Automóvil</option>
                    <option value="Utilitario / Furgón">Utilitario / Furgón</option>
                    <option value="Camión / Logística">Camión / Logística</option>
                    <option value="Moto">Moto</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Patente / Dominio</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: AB123CD"
                    value={plateCar}
                    onChange={(e) => setPlateCar(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white uppercase font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Marca</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Ford"
                    value={brandCar}
                    onChange={(e) => setBrandCar(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Modelo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Ranger"
                    value={modelCar}
                    onChange={(e) => setModelCar(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 MB-1">Color</label>
                  <input
                    type="text"
                    placeholder="Ej: Blanco"
                    value={colorCar}
                    onChange={(e) => setColorCar(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loadingAction}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {loadingAction ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} 
                Registrar y Asociar Vehículo
              </button>
            </form>
          </div>

        </div>
      )}
    </div>
  );
}