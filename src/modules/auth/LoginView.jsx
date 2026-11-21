/**
 * @file LoginView.jsx
 * @description Vista de inicio de sesión 100% conectada al backend de TrustLink (/api/v1/auth/login).
 * Persiste explícitamente trustlink_token y trustlink_user en localStorage, sincroniza el contexto
 * de autenticación y respeta las zonas de apariencia (Zonas 4 y 5) con título unificado text-xl.
 * @location /trustlink-web/src/modules/auth/LoginView.jsx
 */

import React, { useState } from 'react';
import { Lock, Mail, LogIn, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useBranding } from '../branding/BrandingContext';

const API_BASE = 'http://localhost:4000';

export default function LoginView({ onLoginSuccess, onViewChange }) {
  const { login } = useAuth();
  const { brand } = useBranding();

  // Zona 4: Tarjetas principales / contenedor del formulario
  const cardStyle = {
    backgroundColor: brand?.cardBgColor || '#020617',
    color: brand?.cardTextColor || '#F1F5F9',
  };

  // Zona 5: Cajas internas / campos e ícono superior
  const innerStyle = {
    backgroundColor: brand?.innerBgColor || '#0F172A',
    color: brand?.innerTextColor || '#F1F5F9',
  };

  // Color de acento / primario para botones y enlaces destacados
  const accentColor = brand?.accentColor || brand?.primaryColor || '#10b981';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const cleanEmail = email.trim();

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: cleanEmail,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.token && data.user) {
        // Persistir sesión en localStorage de forma explícita y confiable
        localStorage.setItem('trustlink_token', data.token);
        localStorage.setItem('trustlink_user', JSON.stringify(data.user));

        // Sincronizar AuthContext según la firma disponible
        if (typeof login === 'function') {
          try {
            if (login.length >= 2) {
              await login(cleanEmail, password);
            } else {
              await login({ user: data.user, token: data.token });
            }
          } catch (ctxErr) {
            console.warn('Aviso al sincronizar AuthContext:', ctxErr);
          }
        }

        if (typeof onLoginSuccess === 'function') {
          onLoginSuccess(data.user);
        }
      } else {
        localStorage.removeItem('trustlink_token');
        localStorage.removeItem('trustlink_user');
        setErrorMsg(data.error || 'Credenciales inválidas o cuenta inactiva en la base de datos.');
      }
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      localStorage.removeItem('trustlink_token');
      localStorage.removeItem('trustlink_user');
      setErrorMsg('Error de conexión con el servidor de TrustLink.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-10">
      <div
        className="w-full max-w-md border border-black/20 rounded-2xl p-6 md:p-8 shadow-sm space-y-6"
        style={cardStyle}
      >
        {/* Encabezado de la vista con título unificado a text-xl */}
        <div className="text-center space-y-2">
          <div
            className="w-12 h-12 rounded-2xl border border-white/15 flex items-center justify-center mx-auto"
            style={{ ...innerStyle, color: accentColor }}
          >
            <Lock size={20} strokeWidth={1.8} />
          </div>
          <h2 className="text-xl font-black tracking-tight">Iniciar Sesión</h2>
          <p className="text-xs opacity-80">
            Ingresá con tu cuenta para acceder a tu portal o consola operativa.
          </p>
        </div>

        {/* Mensaje de error si falla la autenticación */}
        {errorMsg && (
          <div className="bg-rose-950/60 border border-rose-800 text-rose-200 p-3.5 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Formulario de acceso */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1.5">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail
                size={15}
                className="opacity-60 absolute left-3.5 top-1/2 -translate-y-1/2"
              />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@ejemplo.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                style={innerStyle}
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <Lock
                size={15}
                className="opacity-60 absolute left-3.5 top-1/2 -translate-y-1/2"
              />
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
            className="w-full text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-opacity hover:opacity-95 cursor-pointer disabled:opacity-50 mt-2"
            style={{ backgroundColor: accentColor }}
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Ingresando...
              </>
            ) : (
              <>
                <LogIn size={15} />
                Ingresar
              </>
            )}
          </button>
        </form>

        {/* Enlace al registro */}
        <div className="pt-4 border-t border-black/20 text-center text-xs opacity-80">
          <span>¿No tenés cuenta? </span>
          {onViewChange ? (
            <button
              type="button"
              onClick={() => onViewChange('register')}
              className="font-bold hover:underline cursor-pointer"
              style={{ color: accentColor }}
            >
              Registrate acá
            </button>
          ) : (
            <span className="font-bold" style={{ color: accentColor }}>
              Registrate desde el menú superior
            </span>
          )}
        </div>
      </div>
    </div>
  );
}