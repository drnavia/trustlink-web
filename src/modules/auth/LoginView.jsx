/**
 * @file LoginView.jsx
 * @description Vista de inicio de sesión 100% conectada al backend de TrustLink (/api/v1/auth/login).
 * Persiste explícitamente trustlink_token y trustlink_user en localStorage, sincroniza el contexto
 * de autenticación y respeta las zonas de apariencia (Zonas 4 y 5) con título unificado text-xl.
 * @location /trustlink-web/src/modules/auth/LoginView.jsx
 */

import React, { useState } from 'react';
import { Lock, Mail, LogIn, AlertCircle, CheckCircle2, Loader2, KeyRound, ArrowLeft } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useBranding } from '../branding/BrandingContext';
import { API_BASE } from '../../config/api';

/**
 * Vista de autenticación y recuperación de contraseña en tres modos:
 * ingreso (`login`), solicitud de código (`forgot`) y definición de nueva contraseña (`reset`).
 * @param {object} props
 * @param {(user: object) => void} [props.onLoginSuccess] - Callback ejecutado tras autenticar con éxito.
 * @param {(view: string) => void} [props.onViewChange] - Navegador de vistas del contenedor principal.
 * @param {() => void} [props.onNavigateRegister] - Callback alternativo para abrir el registro.
 */
export default function LoginView({ onLoginSuccess, onViewChange, onNavigateRegister }) {
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

  // Estado del subflujo activo, campos del formulario y mensajes de retroalimentación
  const [mode, setMode] = useState('login'); // 'login' | 'forgot' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  /**
   * Envía las credenciales al contexto de autenticación (`AuthContext.login`)
   * y notifica a la aplicación principal para redirigir al portal correspondiente.
   * @param {React.FormEvent<HTMLFormElement>} e
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);

    const cleanEmail = email.trim();

    try {
      const result = await login(cleanEmail, password);

      if (result?.ok && result.user) {
        if (typeof onLoginSuccess === 'function') {
          onLoginSuccess(result.user);
        }
      } else {
        setErrorMsg(
          result?.error || 'Credenciales inválidas o cuenta inactiva en la base de datos.'
        );
      }
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      setErrorMsg('Error de conexión con el servidor de TrustLink.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Solicita un código temporal de recuperación en `/api/v1/auth/forgot-password`.
   * En entornos de desarrollo precarga `dev_reset_token` y avanza automáticamente al paso `reset`.
   * @param {React.FormEvent<HTMLFormElement>} e
   */
  const handleRequestReset = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.dev_reset_token) {
          setResetToken(data.dev_reset_token);
        }
        setInfoMsg(
          data.message ||
            'Si el correo corresponde a una cuenta activa, se generó un código de recuperación.'
        );
        setMode('reset');
      } else {
        setErrorMsg(data.error || 'No se pudo solicitar la recuperación.');
      }
    } catch (error) {
      console.error('Error en forgot-password:', error);
      setErrorMsg('Error de conexión con el servidor de TrustLink.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Confirma el código de recuperación y guarda la nueva contraseña en `/api/v1/auth/reset-password`.
   * Si tiene éxito, limpia los campos sensibles y vuelve al formulario de inicio de sesión.
   * @param {React.FormEvent<HTMLFormElement>} e
   */
  const handleConfirmReset = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken.trim(), new_password: newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setInfoMsg(data.message || 'Contraseña actualizada. Ya podés iniciar sesión.');
        setResetToken('');
        setNewPassword('');
        setPassword('');
        setMode('login');
      } else {
        setErrorMsg(data.error || 'No se pudo restablecer la contraseña.');
      }
    } catch (error) {
      console.error('Error en reset-password:', error);
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
            {mode === 'login' ? <Lock size={20} strokeWidth={1.8} /> : <KeyRound size={20} strokeWidth={1.8} />}
          </div>
          <h2 className="text-xl font-black tracking-tight">
            {mode === 'login'
              ? 'Iniciar Sesión'
              : mode === 'forgot'
              ? 'Recuperar Contraseña'
              : 'Nueva Contraseña'}
          </h2>
          <p className="text-xs opacity-80">
            {mode === 'login'
              ? 'Ingresá con tu cuenta para acceder a tu portal o consola operativa.'
              : mode === 'forgot'
              ? 'Ingresá tu correo para generar un código temporal de recuperación.'
              : 'Ingresá el código recibido y definí tu nueva contraseña.'}
          </p>
        </div>

        {/* Mensajes de error o éxito */}
        {errorMsg && (
          <div className="bg-rose-950/60 border border-rose-800 text-rose-200 p-3.5 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {infoMsg && (
          <div className="bg-emerald-950/60 border border-emerald-800 text-emerald-200 p-3.5 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{infoMsg}</span>
          </div>
        )}

        {/* Renderizado condicional del formulario según el modo activo: login, forgot o reset */}
        {mode === 'login' ? (
          /* Bloque 1: Formulario de inicio de sesión estándar */
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Campo de correo electrónico */}
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

            {/* Campo de contraseña y acceso directo al flujo de recuperación */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider opacity-80">
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setInfoMsg('');
                    setMode('forgot');
                  }}
                  className="text-[11px] font-semibold hover:underline cursor-pointer opacity-85"
                  style={{ color: accentColor }}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
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

            {/* Botón principal de envío de credenciales */}
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
        ) : mode === 'forgot' ? (
          /* Bloque 2: Formulario de solicitud de código de recuperación por correo */
          <form onSubmit={handleRequestReset} className="space-y-4 text-xs">
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

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-opacity hover:opacity-95 cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: accentColor }}
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Generando código...
                </>
              ) : (
                <>
                  <KeyRound size={15} />
                  Solicitar Código de Recuperación
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setErrorMsg('');
                setInfoMsg('');
                setMode('login');
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border border-white/15 cursor-pointer hover:opacity-90"
              style={innerStyle}
            >
              <ArrowLeft size={13} /> Volver al inicio de sesión
            </button>
          </form>
        ) : (
          /* Bloque 3: Formulario de confirmación con código temporal y nueva contraseña */
          <form onSubmit={handleConfirmReset} className="space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1.5">
                Código de Recuperación
              </label>
              <input
                type="text"
                required
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                placeholder="Pegá el código de recuperación"
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs font-mono focus:outline-none"
                style={innerStyle}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1.5">
                Nueva Contraseña
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                style={innerStyle}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-opacity hover:opacity-95 cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: accentColor }}
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Actualizando...
                </>
              ) : (
                <>
                  <KeyRound size={15} />
                  Guardar Nueva Contraseña
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setErrorMsg('');
                setInfoMsg('');
                setMode('login');
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border border-white/15 cursor-pointer hover:opacity-90"
              style={innerStyle}
            >
              <ArrowLeft size={13} /> Volver al inicio de sesión
            </button>
          </form>
        )}

        {/* Enlace al registro */}
        <div className="pt-4 border-t border-black/20 text-center text-xs opacity-80">
          <span>¿No tenés cuenta? </span>
          {onViewChange || onNavigateRegister ? (
            <button
              type="button"
              onClick={() => (onViewChange ? onViewChange('register') : onNavigateRegister())}
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