/**
 * @file LoginView.jsx
 * @description Vista de inicio de sesión conectada al AuthContext y a la API REST de TrustLink.
 * @location /trustlink-web/src/modules/auth/LoginView.jsx
 */

import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';
import { useAuth } from './AuthContext';

export default function LoginView({ onLoginSuccess }) {
  const { brand } = useBranding();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const success = await login(email, password);
      if (success) {
        const storedUser = JSON.parse(localStorage.getItem('trustlink_user') || '{}');
        if (onLoginSuccess) onLoginSuccess(storedUser);
      } else {
        setErrorMsg('Credenciales inválidas o cuenta inactiva en la base de datos.');
      }
    } catch (error) {
      console.error('Error de login:', error);
      setErrorMsg('Error de conexión con el servidor backend.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-16 bg-slate-950 text-slate-100 p-8 rounded-3xl border border-slate-800 shadow-2xl font-sans">
      
      {/* Cabecera */}
      <div className="text-center mb-8">
        <div
          className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white font-black text-2xl shadow-lg mb-4"
          style={{ backgroundColor: brand.primaryColor || '#0A2540' }}
        >
          {brand.name ? brand.name.charAt(0) : 'T'}
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white">Iniciar Sesión</h1>
        <p className="text-xs text-slate-400 mt-1">Acceso seguro a {brand.name || 'TrustLink'}</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        
        {errorMsg && (
          <div className="bg-rose-950/50 border border-rose-800 text-rose-200 p-3 rounded-xl text-xs font-medium flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Correo Electrónico</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-3 text-slate-500" size={16} />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@dominio.com"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Contraseña</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-3 text-slate-500" size={16} />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl text-xs font-bold text-white shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 mt-4"
          style={{ backgroundColor: brand.primaryColor || '#0A2540' }}
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={16} />}
          {loading ? 'Verificando credenciales...' : 'Ingresar a la Plataforma'}
        </button>

      </form>

      <div className="mt-6 pt-4 border-t border-slate-900 text-center text-xs text-slate-400">
        ¿No tienes cuenta?{' '}
        <span className="text-emerald-400 font-bold hover:underline cursor-pointer">Regístrate desde el menú superior</span>
      </div>

    </div>
  );
}