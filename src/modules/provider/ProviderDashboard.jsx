/**
 * @file ProviderDashboard.jsx
 * @description Panel de control para que los prestadores gestionen su perfil profesional,
 * carguen o consulten su documentación obligatoria de compliance (antecedentes y ART) y registren su flota vehicular.
 * Se conecta 100% a la base de datos PostgreSQL mediante API REST (carga y guardado).
 * @location /trustlink-web/src/modules/provider/ProviderDashboard.jsx
 */
import React, { useState, useEffect } from 'react';
import { Wrench, ShieldCheck, Car, FileText, CheckCircle2, AlertCircle, Plus, Upload, Loader2 } from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';

export default function ProviderDashboard() {
  const { brand } = useBranding();

  // Estados para el perfil y compliance
  const [specialty, setSpecialty] = useState('');
  const [criminalRecordUrl, setCriminalRecordUrl] = useState('');
  const [insurancePolicyUrl, setInsurancePolicyUrl] = useState('');
  const [profileStatus, setProfileStatus] = useState('sin_perfil');
  const [ratingAvg, setRatingAvg] = useState(5.0);

  // Estados para vehículos
  const [vehicles, setVehicles] = useState([]);
  const [vehicleForm, setVehicleForm] = useState({ brand: '', model: '', plate: '', color: '' });

  // Estados de carga y mensajes
  const [fetching, setFetching] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [vehicleMsg, setVehicleMsg] = useState({ type: '', text: '' });

  // 1. Cargar datos actuales del prestador desde el backend al montar el componente
  const fetchProviderData = async () => {
    setFetching(true);
    try {
      const response = await fetch('http://localhost:4000/api/v1/providers/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('trustlink_token') || ''}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        if (data.provider) {
          setSpecialty(data.provider.specialty || '');
          setCriminalRecordUrl(data.provider.criminal_record_url || '');
          setInsurancePolicyUrl(data.provider.insurance_policy_url || '');
          setProfileStatus(data.provider.status || 'sin_perfil');
          setRatingAvg(data.provider.rating_avg || 5.0);
        }
        if (data.vehicles) {
          setVehicles(data.vehicles);
        }
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

  // 2. Función para actualizar perfil y compliance en el backend
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMsg({ type: '', text: '' });

    try {
      const response = await fetch('http://localhost:4000/api/v1/providers/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('trustlink_token') || ''}`
        },
        body: JSON.stringify({
          specialty: specialty.trim(),
          criminal_record_url: criminalRecordUrl.trim() || null,
          insurance_policy_url: insurancePolicyUrl.trim() || null
        })
      });

      const data = await response.json();

      if (response.ok) {
        setProfileMsg({ type: 'success', text: '¡Perfil y documentación actualizados con éxito en la base de datos!' });
        setProfileStatus(data.provider.status);
      } else {
        setProfileMsg({ type: 'error', text: data.error || 'No se pudo actualizar el perfil.' });
      }
    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      setProfileMsg({ type: 'error', text: 'Error de conexión con el servidor de TrustLink.' });
    } finally {
      setProfileLoading(false);
    }
  };

  // 3. Función para registrar un vehículo en el backend
  const handleAddVehicle = async (e) => {
    e.preventDefault();
    setVehicleLoading(true);
    setVehicleMsg({ type: '', text: '' });

    try {
      const response = await fetch('http://localhost:4000/api/v1/providers/vehicle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('trustlink_token') || ''}`
        },
        body: JSON.stringify(vehicleForm)
      });

      const data = await response.json();

      if (response.ok) {
        setVehicleMsg({ type: 'success', text: `Vehículo con patente ${data.vehicle.plate} asociado exitosamente.` });
        setVehicles([...vehicles, data.vehicle]);
        setVehicleForm({ brand: '', model: '', plate: '', color: '' });
      } else {
        setVehicleMsg({ type: 'error', text: data.error || 'No se pudo registrar el vehículo.' });
      }
    } catch (error) {
      console.error('Error al registrar vehículo:', error);
      setVehicleMsg({ type: 'error', text: 'Error de conexión con el servidor.' });
    } finally {
      setVehicleLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-[calc(100vh-60px)] bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="flex items-center gap-2 text-emerald-400 font-bold">
          <Loader2 className="animate-spin" size={24} /> Cargando panel del prestador...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-slate-900 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Cabecera del Panel */}
        <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-inner">
              <Wrench size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Panel de Gestión del Prestador</h1>
              <p className="text-xs text-slate-400">Administra tu perfil profesional, cumplimiento y flota vehicular para operar en la red.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-xs font-bold">
            Estado Compliance: 
            <span className={`px-2.5 py-1 rounded-lg uppercase tracking-wider text-[10px] ${
              profileStatus === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
              profileStatus === 'pending' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
              profileStatus === 'rejected' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
              'bg-slate-800 text-slate-400 border border-slate-700'
            }`}>
              {profileStatus}
            </span>
          </div>
        </div>

        {/* Sección 1: Perfil y Compliance */}
        <div className="bg-slate-950 border border-slate-800 p-8 rounded-3xl shadow-xl space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
            <ShieldCheck className="text-emerald-400" size={20} />
            <h2 className="text-lg font-bold text-white">Credenciales y Compliance</h2>
          </div>

          {profileMsg.text && (
            <div className={`p-4 rounded-xl text-xs flex items-center gap-2 border ${
              profileMsg.type === 'success' ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800' : 'bg-rose-950/40 text-rose-300 border-rose-800'
            }`}>
              {profileMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {profileMsg.text}
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Especialidad Principal / Oficio</label>
              <input
                type="text"
                required
                placeholder="Ej. Electricista Matriculado, Gasista, Pintor, etc."
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">URL Antecedentes Penales (PDF)</label>
                <input
                  type="url"
                  placeholder="https://storage.trustlink.com/antecedentes.pdf"
                  value={criminalRecordUrl}
                  onChange={(e) => setCriminalRecordUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">URL Póliza de Seguro / ART (PDF)</label>
                <input
                  type="url"
                  placeholder="https://storage.trustlink.com/art.pdf"
                  value={insurancePolicyUrl}
                  onChange={(e) => setInsurancePolicyUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={profileLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer"
            >
              {profileLoading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
              Guardar y Enviar Compliance a Revisión
            </button>
          </form>
        </div>

        {/* Sección 2: Flota Vehicular */}
        <div className="bg-slate-950 border border-slate-800 p-8 rounded-3xl shadow-xl space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
            <Car className="text-emerald-400" size={20} />
            <h2 className="text-lg font-bold text-white">Flota Vehicular Autorizada</h2>
          </div>

          {vehicleMsg.text && (
            <div className={`p-4 rounded-xl text-xs flex items-center gap-2 border ${
              vehicleMsg.type === 'success' ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800' : 'bg-rose-950/40 text-rose-300 border-rose-800'
            }`}>
              {vehicleMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {vehicleMsg.text}
            </div>
          )}

          {/* Listado de vehículos actuales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vehicles.length === 0 ? (
              <p className="text-xs text-slate-500 italic col-span-2">No tienes vehículos registrados actualmente.</p>
            ) : (
              vehicles.map((v) => (
                <div key={v.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-white text-sm">{v.brand} {v.model}</h4>
                    <p className="text-xs text-slate-400">Patente: <span className="text-emerald-400 font-mono font-bold">{v.plate}</span> ({v.color})</p>
                  </div>
                  <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-xl border border-emerald-500/20">
                    <Car size={18} />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Formulario para agregar vehículo */}
          <form onSubmit={handleAddVehicle} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 pt-6">
            <h3 className="text-xs font-bold uppercase text-slate-300">Asociar Nuevo Vehículo</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="text"
                required
                placeholder="Marca (Ej. Ford)"
                value={vehicleForm.brand}
                onChange={(e) => setVehicleForm({ ...vehicleForm, brand: e.target.value })}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                required
                placeholder="Modelo (Ej. Ranger)"
                value={vehicleForm.model}
                onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                required
                placeholder="Patente (Ej. AB123CD)"
                value={vehicleForm.plate}
                onChange={(e) => setVehicleForm({ ...vehicleForm, plate: e.target.value })}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white uppercase focus:outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                required
                placeholder="Color (Ej. Blanco)"
                value={vehicleForm.color}
                onChange={(e) => setVehicleForm({ ...vehicleForm, color: e.target.value })}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={vehicleLoading}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all border border-slate-700 cursor-pointer"
            >
              {vehicleLoading ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
              Registrar Vehículo
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}