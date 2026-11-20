/**
 * @file LoginView.jsx
 * @description Vista de inicio de sesión conectada a AuthContext con aplicación explícita de
 * Zona 4 (tarjeta principal de login) y Zona 5 (cajas de inputs e íconos).
 * @location /trustlink-web/src/modules/auth/LoginView.jsx
 */

import React, { useState } from 'react';
import { ShieldCheck, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { useBranding, DEFAULT_BRANDING_CONFIG } from '../branding/BrandingContext';
import { useAuth } from './AuthContext';

export default function LoginView({ onLoginSuccess, onNavigateRegister }) {
  const { brand } = useBranding();
  const { login } = useAuth();

  const cardStyle = {
    backgroundColor: brand.cardBgColor || DEFAULT_BRANDING_CONFIG.cardBgColor,
    color: brand.cardTextColor || DEFAULT_BRANDING_CONFIG.cardTextColor,
  };

  const innerStyle = {
    backgroundColor: brand.innerBgColor || DEFAULT_BRANDING_CONFIG.innerBgColor,
    color: brand.innerTextColor || DEFAULT_BRANDING_CONFIG.innerTextColor,
  };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const ok = await login(email, password);
      if (ok) {
        const storedUser = JSON.parse(localStorage.getItem('trustlink_user') || 'null');
        if (typeof onLoginSuccess === 'function') {
          onLoginSuccess(storedUser);
        }
      } else {
        setErrorMsg('Credenciales inválidas o cuenta inactiva en TrustLink.');
      }
    } catch (error) {
      console.error('Error en inicio de sesión:', error);
      setErrorMsg('Error de conexión con el servidor de TrustLink.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-grow flex flex-col justify-center items-center px-4 py-8 font-sans">
      {/* Zona 4: Tarjeta de Login */}
      <div
        className="max-w-md w-full p-8 rounded-2xl border border-black/20 space-y-6"
        style={cardStyle}
      >
        {/* Cabecera institucional */}
        <div className="text-center space-y-2">
          <div
            className="w-12 h-12 rounded-2xl border border-white/15 text-emerald-400 flex items-center justify-center mx-auto"
            style={innerStyle}
          >
            <ShieldCheck size={24} />
          </div>
          <h2 className="text-2xl font-black tracking-tight">Iniciar Sesión</h2>
          <p className="text-xs opacity-80">
            Ingresá a {brand.name || 'TrustLink'} · {brand.countryName || 'Community'}
          </p>
        </div>

        {errorMsg && (
          <div className="bg-rose-950/60 border border-rose-800 text-rose-200 p-3.5 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold uppercase tracking-wider opacity-80 mb-1.5">
              Correo electrónico
            </label>
            <div className="relative">
              <Mail size={15} className="opacity-70 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@trustlink.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                style={innerStyle}
              />
            </div>
          </div>

          <div>
            <label className="block font-bold uppercase tracking-wider opacity-80 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <Lock size={15} className="opacity-70 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                style={innerStyle}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 mt-2"
          >
            <span>{loading ? 'Iniciando sesión...' : 'Ingresar a la Plataforma'}</span>
            <ArrowRight size={15} />
          </button>
        </form>

        {typeof onNavigateRegister === 'function' && (
          <div className="pt-3 border-t border-black/20 text-center text-xs opacity-80">
            ¿Todavía no tenés cuenta?{' '}
            <button
              type="button"
              onClick={onNavigateRegister}
              className="font-bold text-emerald-400 hover:underline cursor-pointer"
            >
              Registrate acá
            </button>
          </div>
        )}
      </div>
    </div>
  );
}