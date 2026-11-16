/**
 * @file ProviderDashboard.jsx
 * @description Panel de control para que los prestadores gestionen su perfil profesional,
 * carguen su documentación obligatoria de compliance (antecedentes y ART) y registren su flota vehicular.
 * @location /trustlink-web/src/modules/provider/ProviderDashboard.jsx
 */

import React, { useState } from 'react';
import { Wrench, ShieldCheck, Car, FileText, CheckCircle2, AlertCircle, Plus, Upload } from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';

export default function ProviderDashboard() {
  const { brand } = useBranding();
  
  // Estado para el formulario de perfil y compliance
  const [specialty, setSpecialty] = useState('');
  const [criminalRecordUrl, setCriminalRecordUrl] = useState('');
  const [insurancePolicyUrl, setInsurancePolicyUrl] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });

  // Estado para el formulario de vehículos
  const [vehicle, setVehicle] = useState({ brand: '', model: '', color: '', plate: '', vehicle_insurance_url: '' });
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [vehicleMsg, setVehicleMsg] = useState({ type: '', text: '' });

  // Función para actualizar perfil y compliance en el backend (/api/v1/providers/profile)
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
        setProfileMsg({ type: 'success', text: '¡Perfil y documentación de compliance enviados con éxito! Estado: Pendiente de aprobación.' });
      } else {
        setProfileMsg({ type: 'error', text: data.error || 'No se pudo actualizar el perfil.' });
      }
      setProfileLoading(false);
    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      setProfileMsg({ type: 'error', text: 'Error de conexión con el servidor de TrustLink.' });
      setProfileLoading(false);
    }
  };

  // Función para registrar un vehículo en el backend (/api/v1/providers/vehicle)
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
        body: JSON.stringify(vehicle)
      });

      const data = await response.json();

      if (response.ok) {
        setVehicleMsg({ type: 'success', text: `Vehículo con patente ${data.vehicle.plate} asociado exitosamente.` });
        setVehicle({ brand: '', model: '', color: '', plate: '', vehicle_insurance_url: '' });
      } else {
        setVehicleMsg({ type: 'error', text: data.error || 'No se pudo registrar el vehículo.' });
      }
      setVehicleLoading(false);
    } catch (error) {
      console.error('Error al registrar vehículo:', error);
      setVehicleMsg({ type: 'error', text: 'Error de conexión con el servidor de TrustLink.' });
      setVehicleLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-8 bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl my-8 font-sans">
      {/* Cabecera del Panel */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-800 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <Wrench size={26} />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-white">Panel de Gestión del Prestador</h2>
            <p className="text-xs text-slate-400">Actualiza tus credenciales, antecedentes y vehículos para operar en {brand.countryName}</p>
          </div>
        </div>
        <span className="text-xs font-bold bg-slate-900 text-emerald-400 px-4 py-2 rounded-xl border border-slate-800 flex items-center gap-1.5">
          <ShieldCheck size={16} /> Portal Profesional
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Sección 1: Perfil y Compliance */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <FileText className="text-emerald-400" size={20} /> Compliance y Documentación
            </h3>
            <p className="text-xs text-slate-400 mb-6">Sube los enlaces de tus respaldos legales y certificados obligatorios.</p>

            {profileMsg.text && (
              <div className={`p-4 rounded-xl mb-6 text-xs font-medium flex items-center gap-2 border ${
                profileMsg.type === 'success' ? 'bg-emerald-950/50 border-emerald-800 text-emerald-200' : 'bg-rose-950/50 border-rose-800 text-rose-200'
              }`}>
                {profileMsg.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> : <AlertCircle size={16} className="text-rose-400 shrink-0" />}
                <span>{profileMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Especialidad Profesional</label>
                <input
                  type="text"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="Ej: Electricista Matriculado / Gasista"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">URL Antecedentes Penales</label>
                <input
                  type="url"
                  value={criminalRecordUrl}
                  onChange={(e) => setCriminalRecordUrl(e.target.value)}
                  placeholder="https://storage.trustlink.com/antecedentes.pdf"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">URL Póliza ART / Seguro</label>
                <input
                  type="url"
                  value={insurancePolicyUrl}
                  onChange={(e) => setInsurancePolicyUrl(e.target.value)}
                  placeholder="https://storage.trustlink.com/art.pdf"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={profileLoading}
                className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg text-sm flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Upload size={16} /> {profileLoading ? 'Enviando documentación...' : 'Actualizar Compliance'}
              </button>
            </form>
          </div>
        </div>

        {/* Sección 2: Registro de Vehículos */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Car className="text-blue-400" size={20} /> Flota y Vehículos de Acceso
            </h3>
            <p className="text-xs text-slate-400 mb-6">Registra los vehículos habilitados para el ingreso perimetral.</p>

            {vehicleMsg.text && (
              <div className={`p-4 rounded-xl mb-6 text-xs font-medium flex items-center gap-2 border ${
                vehicleMsg.type === 'success' ? 'bg-emerald-950/50 border-emerald-800 text-emerald-200' : 'bg-rose-950/50 border-rose-800 text-rose-200'
              }`}>
                {vehicleMsg.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> : <AlertCircle size={16} className="text-rose-400 shrink-0" />}
                <span>{vehicleMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleAddVehicle} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Marca</label>
                  <input
                    type="text"
                    value={vehicle.brand}
                    onChange={(e) => setVehicle({ ...vehicle, brand: e.target.value })}
                    placeholder="Ford"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Modelo</label>
                  <input
                    type="text"
                    value={vehicle.model}
                    onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })}
                    placeholder="Fiorino"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Color</label>
                  <input
                    type="text"
                    value={vehicle.color}
                    onChange={(e) => setVehicle({ ...vehicle, color: e.target.value })}
                    placeholder="Blanco"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Patente</label>
                  <input
                    type="text"
                    value={vehicle.plate}
                    onChange={(e) => setVehicle({ ...vehicle, plate: e.target.value })}
                    placeholder="AE123XX"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono uppercase"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">URL Seguro del Vehículo</label>
                <input
                  type="url"
                  value={vehicle.vehicle_insurance_url}
                  onChange={(e) => setVehicle({ ...vehicle, vehicle_insurance_url: e.target.value })}
                  placeholder="https://storage.trustlink.com/seguro.pdf"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={vehicleLoading}
                className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg text-sm flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Plus size={16} /> {vehicleLoading ? 'Registrando vehículo...' : 'Asociar Vehículo'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}