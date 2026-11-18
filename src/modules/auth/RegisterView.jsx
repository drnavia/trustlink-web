/**
 * @file RegisterView.jsx
 * @description Vista de registro 100% conectada a PostgreSQL para TrustLink, con textos refinados y sin redundancias.
 * @location /trustlink-web/src/modules/auth/RegisterView.jsx
 */

import React, { useState } from 'react';
import { UserPlus, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';

export default function RegisterView({ onRegisterSuccess }) {
  const { brand } = useBranding();
  const [role, setRole] = useState('owner'); // 'owner', 'provider', 'security'
  const [formData, setFormData] = useState({
    country_id: 1,
    first_name: '',
    last_name: '',
    dni: '',
    email: '',
    password: '',
    phone: '',
    fraction_number: '',
    lot_number: '',
    specialty: ''
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const payload = {
        country_id: Number(formData.country_id),
        role,
        first_name: formData.first_name,
        last_name: formData.last_name,
        dni: formData.dni,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        fraction_number: role === 'owner' ? formData.fraction_number : null,
        lot_number: role === 'owner' ? formData.lot_number : null,
        specialty: role === 'provider' ? formData.specialty : null
      };

      const response = await fetch('http://localhost:4000/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMsg(true);
        setTimeout(() => {
          if (onRegisterSuccess) onRegisterSuccess();
        }, 1500);
      } else {
        setErrorMsg(data.error || 'No se pudo completar el registro en el servidor.');
      }
    } catch (error) {
      console.error('Error de registro:', error);
      setErrorMsg('Error de conexión con el servidor backend de TrustLink.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 bg-slate-950 text-slate-100 p-8 rounded-3xl border border-slate-800 shadow-2xl font-sans">
      
      {/* Cabecera sin redundancias */}
      <div className="text-center mb-8">
        <div
          className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white font-black text-2xl shadow-lg mb-4"
          style={{ backgroundColor: brand.primaryColor || '#0A2540' }}
        >
          {brand.name ? brand.name.charAt(0) : 'T'}
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white">Crea tu cuenta institucional</h1>
        <p className="text-xs text-slate-400 mt-1">Regístrate para formar parte de la red</p>
      </div>

      {successMsg ? (
        <div className="bg-emerald-950/40 border border-emerald-600/50 p-8 rounded-2xl text-center space-y-3">
          <CheckCircle2 size={48} className="text-emerald-400 mx-auto" />
          <h3 className="text-xl font-bold text-white">¡Registro Exitoso!</h3>
          <p className="text-xs text-slate-300">Tu cuenta se ha creado en PostgreSQL. Redirigiendo al login...</p>
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
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRole('owner')}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  role === 'owner' ? 'bg-emerald-600 border-emerald-500 text-white shadow-md' : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                Residente
              </button>
              <button
                type="button"
                onClick={() => setRole('provider')}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  role === 'provider' ? 'bg-emerald-600 border-emerald-500 text-white shadow-md' : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                Prestador
              </button>
              <button
                type="button"
                onClick={() => setRole('security')}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  role === 'security' ? 'bg-emerald-600 border-emerald-500 text-white shadow-md' : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                Seguridad
              </button>
            </div>
          </div>

          {/* Datos Personales */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Nombre</label>
              <input
                type="text"
                name="first_name"
                required
                value={formData.first_name}
                onChange={handleChange}
                placeholder="Juan"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Apellido</label>
              <input
                type="text"
                name="last_name"
                required
                value={formData.last_name}
                onChange={handleChange}
                placeholder="Pérez"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">DNI</label>
              <input
                type="text"
                name="dni"
                required
                value={formData.dni}
                onChange={handleChange}
                placeholder="35123456"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Correo Electrónico</label>
            <input
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="juan@correo.com"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Contraseña</label>
            <input
              type="password"
              name="password"
              required
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Campos condicionales según el rol */}
          {role === 'owner' && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-900">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Manzana / Fracción</label>
                <input
                  type="text"
                  name="fraction_number"
                  value={formData.fraction_number}
                  onChange={handleChange}
                  placeholder="Manzana 4"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {role === 'provider' && (
            <div className="pt-2 border-t border-slate-900">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Especialidad Principal / Oficio</label>
              <input
                type="text"
                name="specialty"
                value={formData.specialty}
                onChange={handleChange}
                placeholder="Ej. Electricista Matriculado"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-xs font-bold text-white shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 mt-4"
            style={{ backgroundColor: brand.primaryColor || '#0A2540' }}
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={16} />}
            {loading ? 'Registrando en Base de Datos...' : 'Completar Registro'}
          </button>
        </form>
      )}

      <div className="mt-6 pt-4 border-t border-slate-900 text-center text-xs text-slate-400">
        ¿Ya tienes cuenta?{' '}
        <button onClick={() => onRegisterSuccess && onRegisterSuccess()} className="text-emerald-400 font-bold hover:underline cursor-pointer">
          Inicia sesión aquí
        </button>
      </div>

    </div>
  );
}