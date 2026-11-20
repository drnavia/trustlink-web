/**
 * @file RegisterView.jsx
 * @description Vista de registro modular para TrustLink conectada a PostgreSQL, con
 * aplicación explícita de Zona 4 (tarjeta principal de registro) y Zona 5 (cajas de inputs/selects).
 * @location /trustlink-web/src/modules/auth/RegisterView.jsx
 */

import React, { useState } from 'react';
import { UserPlus, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { useBranding, DEFAULT_BRANDING_CONFIG } from '../branding/BrandingContext';

const API_BASE = 'http://localhost:4000';

export default function RegisterView({ onRegisterSuccess, onNavigateLogin }) {
  const { brand } = useBranding();

  const cardStyle = {
    backgroundColor: brand.cardBgColor || DEFAULT_BRANDING_CONFIG.cardBgColor,
    color: brand.cardTextColor || DEFAULT_BRANDING_CONFIG.cardTextColor,
  };

  const innerStyle = {
    backgroundColor: brand.innerBgColor || DEFAULT_BRANDING_CONFIG.innerBgColor,
    color: brand.innerTextColor || DEFAULT_BRANDING_CONFIG.innerTextColor,
  };

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    dni: '',
    phone: '',
    email: '',
    password: '',
    role: 'owner',
    country_id: 1,
    fraction_number: '',
    lot_number: '',
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const payload = {
        ...formData,
        country_id: Number(formData.country_id || 1),
      };

      const response = await fetch(`${API_BASE}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMsg('Cuenta creada correctamente. Ya podés iniciar sesión.');
        setTimeout(() => {
          if (typeof onRegisterSuccess === 'function') {
            onRegisterSuccess();
          } else if (typeof onNavigateLogin === 'function') {
            onNavigateLogin();
          }
        }, 900);
      } else {
        setErrorMsg(data.error || 'No se pudo completar el registro.');
      }
    } catch (error) {
      console.error('Error en registro de usuario:', error);
      setErrorMsg('Error de conexión con el servidor de TrustLink.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-grow flex flex-col justify-center items-center px-4 py-8 font-sans">
      {/* Zona 4: Tarjeta de Registro */}
      <div
        className="max-w-xl w-full p-8 rounded-2xl border border-black/20 space-y-6"
        style={cardStyle}
      >
        <div className="flex items-center justify-between border-b border-black/20 pb-4 gap-3">
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-xl border border-white/15 text-emerald-400"
              style={innerStyle}
            >
              <UserPlus size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">Crear Cuenta</h2>
              <p className="text-xs opacity-80">
                Registro institucional en {brand.name || 'TrustLink'}
              </p>
            </div>
          </div>

          {typeof onNavigateLogin === 'function' && (
            <button
              type="button"
              onClick={onNavigateLogin}
              className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl border border-white/15 cursor-pointer"
              style={innerStyle}
            >
              <ArrowLeft size={13} /> Ingresar
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="bg-rose-950/60 border border-rose-800 text-rose-200 p-3.5 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-950/60 border border-emerald-800 text-emerald-200 p-3.5 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold uppercase tracking-wider opacity-80 mb-1.5">
              Perfil / Rol
            </label>
            <select
              value={formData.role}
              onChange={(e) => handleChange('role', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs"
              style={innerStyle}
            >
              <option value="owner">Propietario / Residente</option>
              <option value="family">Familiar / Conviviente</option>
              <option value="provider">Prestador de Servicios</option>
              <option value="security">Personal de Seguridad / Garita</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-bold uppercase tracking-wider opacity-80 mb-1.5">
                Nombre
              </label>
              <input
                type="text"
                required
                value={formData.first_name}
                onChange={(e) => handleChange('first_name', e.target.value)}
                placeholder="Ej. María"
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs"
                style={innerStyle}
              />
            </div>
            <div>
              <label className="block font-bold uppercase tracking-wider opacity-80 mb-1.5">
                Apellido
              </label>
              <input
                type="text"
                required
                value={formData.last_name}
                onChange={(e) => handleChange('last_name', e.target.value)}
                placeholder="Ej. Gómez"
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs"
                style={innerStyle}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-bold uppercase tracking-wider opacity-80 mb-1.5">
                DNI
              </label>
              <input
                type="text"
                required
                value={formData.dni}
                onChange={(e) => handleChange('dni', e.target.value)}
                placeholder="35123456"
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs"
                style={innerStyle}
              />
            </div>
            <div>
              <label className="block font-bold uppercase tracking-wider opacity-80 mb-1.5">
                Teléfono
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="+54 9 11 ..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs"
                style={innerStyle}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-bold uppercase tracking-wider opacity-80 mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="correo@dominio.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs"
                style={innerStyle}
              />
            </div>
            <div>
              <label className="block font-bold uppercase tracking-wider opacity-80 mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs"
                style={innerStyle}
              />
            </div>
          </div>

          {(formData.role === 'owner' || formData.role === 'family') && (
            <div
              className="p-4 rounded-xl border border-black/20 grid grid-cols-1 sm:grid-cols-2 gap-3.5"
              style={innerStyle}
            >
              <div>
                <label className="block font-bold uppercase tracking-wider opacity-80 mb-1.5">
                  Fracción / Manzana
                </label>
                <input
                  type="text"
                  value={formData.fraction_number}
                  onChange={(e) => handleChange('fraction_number', e.target.value)}
                  placeholder="Ej. F-04"
                  className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs"
                  style={cardStyle}
                />
              </div>
              <div>
                <label className="block font-bold uppercase tracking-wider opacity-80 mb-1.5">
                  Lote
                </label>
                <input
                  type="text"
                  value={formData.lot_number}
                  onChange={(e) => handleChange('lot_number', e.target.value)}
                  placeholder="Ej. 18"
                  className="w-full px-3.5 py-2 rounded-xl border border-white/15 text-xs"
                  style={cardStyle}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 mt-2"
          >
            <UserPlus size={15} />
            <span>{loading ? 'Registrando...' : 'Completar Registro'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}