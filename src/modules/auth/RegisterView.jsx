/**
 * @file RegisterView.jsx
 * @description Vista de registro modular para TrustLink. Permite dar de alta nuevos usuarios
 * diferenciando su rol (Propietario / Residente, Prestador o Personal de Seguridad).
 * @location /trustlink-web/src/modules/auth/RegisterView.jsx
 */

import React, { useState } from 'react';
import { UserPlus, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';

export default function RegisterView({ onRegisterSuccess }) {
  const { brand } = useBranding();
  const [role, setRole] = useState('owner'); // 'owner', 'provider', 'security'
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    dni: '',
    email: '',
    password: '',
    phone: '',
    fraction_number: '',
    lot_number: '',
    specialty: '' // Específico para prestadores
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch('http://localhost:4000/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country_id: 1, // ID por defecto del Country principal para el MVP
          role,
          ...formData
        })
      });

      const data = await response.json();

      if (response.ok && data.user) {
        setSuccessMsg(true);
        setTimeout(() => {
          if (onRegisterSuccess) onRegisterSuccess(data.user);
        }, 1500);
      } else {
        setErrorMsg(data.error || 'Error al procesar el registro.');
      }
      setLoading(false);
    } catch (error) {
      console.error('Error en registro:', error);
      setErrorMsg('Error de conexión con el servidor backend.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center px-4 py-12 font-sans">
      <div className="max-w-xl w-full bg-slate-950 p-8 rounded-2xl border border-slate-800 shadow-2xl">
        {/* Cabecera */}
        <div className="text-center mb-8">
          <div
            className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-white font-black text-xl shadow-lg mb-3"
            style={{ backgroundColor: brand.primaryColor }}
          >
            {brand.countryName.charAt(0)}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Registro en {brand.countryName}</h1>
          <p className="text-xs text-slate-400 mt-1">Crea tu cuenta institucional en TrustLink</p>
        </div>

        {successMsg ? (
          <div className="bg-emerald-950/40 border border-emerald-600/50 p-8 rounded-xl text-center space-y-3">
            <CheckCircle2 size={48} className="text-emerald-400 mx-auto" />
            <h3 className="text-xl font-bold text-white">¡Registro Exitoso!</h3>
            <p className="text-xs text-slate-300">Tu cuenta ha sido creada correctamente. Redirigiendo al sistema...</p>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            {errorMsg && (
              <div className="bg-rose-950/50 border border-rose-800 text-rose-200 p-3 rounded-xl text-xs font-medium flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Selector de Rol */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Seleccione su Perfil</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('owner')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    role === 'owner' ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  Residente / Propietario
                </button>
                <button
                  type="button"
                  onClick={() => setRole('provider')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    role === 'provider' ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  Prestador / Profesional
                </button>
                <button
                  type="button"
                  onClick={() => setRole('security')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    role === 'security' ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  Seguridad (Garita)
                </button>
              </div>
            </div>

            {/* Datos Personales */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Nombre</label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  placeholder="Juan"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Apellido</label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  placeholder="Pérez"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">DNI</label>
                <input
                  type="text"
                  name="dni"
                  value={formData.dni}
                  onChange={handleChange}
                  placeholder="35123456"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Teléfono</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+54911..."
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="juan@correo.com"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Contraseña</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            {/* Campos condicionales según el rol */}
            {role === 'owner' && (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Manzana / Fracción</label>
                  <input
                    type="text"
                    name="fraction_number"
                    value={formData.fraction_number}
                    onChange={handleChange}
                    placeholder="Manzana 4"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Lote</label>
                  <input
                    type="text"
                    name="lot_number"
                    value={formData.lot_number}
                    onChange={handleChange}
                    placeholder="Lote 12"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}

            {role === 'provider' && (
              <div className="pt-2 border-t border-slate-800">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Especialidad Profesional</label>
                <input
                  type="text"
                  name="specialty"
                  value={formData.specialty}
                  onChange={handleChange}
                  placeholder="Electricista / Plomero / Gasista"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-sm active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <UserPlus size={18} /> {loading ? 'Registrando cuenta...' : 'Completar Registro'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}