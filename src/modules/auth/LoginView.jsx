/**
 * @file LoginView.jsx
 * @description Vista minimalista de inicio de sesión para TrustLink. Permite a los usuarios
 * (propietarios, prestadores, personal de seguridad y administradores) autenticarse mediante JWT.
 * @location /trustlink-web/src/modules/auth/LoginView.jsx
 */

import React, { useState } from 'react';
import { ShieldCheck, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';

export default function LoginView({ onLoginSuccess }) {
  const { brand } = useBranding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Por favor, complete todos los campos.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch('http://localhost:4000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data = await response.json();

      if (response.ok && data.token) {
        // Guardar token y datos del usuario en localStorage
        localStorage.setItem('trustlink_token', data.token);
        localStorage.setItem('trustlink_user', JSON.stringify(data.user));
        
        if (onLoginSuccess) {
          onLoginSuccess(data.user);
        } else {
          alert(`¡Bienvenido de nuevo, ${data.user.first_name}!`);
        }
      } else {
        setErrorMsg(data.error || 'Credenciales inválidas.');
      }
      setLoading(false);
    } catch (error) {
      console.error('Error en inicio de sesión:', error);
      setErrorMsg('Error de conexión con el servidor de TrustLink.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center px-4 font-sans">
      {/* Tarjeta de Login */}
      <div className="max-w-md w-full bg-slate-950 p-8 rounded-2xl border border-slate-800 shadow-2xl">
        {/* Cabecera institucional */}
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white font-black text-2xl shadow-lg mb-4"
            style={{ backgroundColor: brand.primaryColor }}
          >
            {brand.countryName.charAt(0)}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">{brand.countryName}</h1>
          <p className="text-xs text-slate-400 mt-1">Plataforma Segura de Accesos y Prestadores</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleLogin} className="space-y-5">
          {errorMsg && (
            <div className="bg-rose-950/50 border border-rose-800 text-rose-200 p-3 rounded-xl text-xs font-medium flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Correo Electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 text-slate-500" size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 text-slate-500" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-sm active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Iniciando sesión...' : 'Ingresar a la Plataforma'} <ArrowRight size={16} />
          </button>
        </form>

        {/* Enlace de Registro */}
        <div className="mt-8 pt-6 border-t border-slate-800 text-center text-xs text-slate-400">
          ¿No tienes una cuenta?{' '}
          <a href="#register" className="text-emerald-400 font-bold hover:underline">
            Regístrate aquí
          </a>
        </div>
      </div>

      <footer className="mt-8 text-center text-xs text-slate-500">
        TrustLink Security Node © 2026 — Todos los derechos reservados
      </footer>
    </div>
  );
}