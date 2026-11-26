/**
 * @file LoginView.jsx
 * @description Vista de inicio de sesión y recuperación de acceso conectada a `/api/v1/auth/login`,
 * `/api/v1/auth/forgot-password` y `/api/v1/auth/reset-password`.
 * Adopta un layout limpio de 2 columnas en escritorio (titular + tarjeta sobria de seguridad a la
 * izquierda; formulario aireado con toggle de contraseña a la derecha), respetando las zonas y
 * modos oscuro/claro de `BrandingContext`.
 * @location /trustlink-web/src/modules/auth/LoginView.jsx
 */

import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  KeyRound,
  ArrowLeft,
  Eye,
  EyeOff,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { useBranding } from '../branding/BrandingContext';
import { API_BASE } from '../../config/api';

/**
 * Vista de autenticación y recuperación de contraseña en tres modos:
 * ingreso (`login`), solicitud de código (`forgot`) y definición de nueva contraseña (`reset`).
 *
 * @param {object} props
 * @param {(user: object) => void} [props.onLoginSuccess] - Callback ejecutado tras autenticar con éxito.
 * @param {(view: string) => void} [props.onViewChange] - Navegador de vistas del contenedor principal.
 * @param {() => void} [props.onNavigateRegister] - Callback alternativo para abrir el registro.
 */
export default function LoginView({ onLoginSuccess, onViewChange, onNavigateRegister }) {
  const { login } = useAuth();
  const { brand } = useBranding();

  const isDark = brand?.darkMode !== false;

  // Zona 4: Tarjetas principales / contenedor del formulario
  const cardStyle = {
    backgroundColor: brand?.cardBgColor || '#020617',
    color: brand?.cardTextColor || '#F1F5F9',
  };

  // Zona 5: Cajas internas / campos de entrada
  const innerStyle = {
    backgroundColor: brand?.innerBgColor || '#0F172A',
    color: brand?.innerTextColor || '#E2E8F0',
  };

  // Color de acción primario coherente con el resto de la plataforma
  const accentColor =
    brand?.primaryActionColor || brand?.accentColor || brand?.primaryColor || '#059669';

  const cardBorder = isDark ? 'border-white/10' : 'border-slate-300/80';
  const inputBorder = isDark
    ? 'border-white/15 focus:border-emerald-400/70'
    : 'border-slate-300 focus:border-emerald-600';

  // Estado del subflujo activo, campos del formulario y mensajes de retroalimentación
  const [mode, setMode] = useState('login'); // 'login' | 'forgot' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  /** Cambia de subflujo limpiando avisos previos. */
  const switchMode = (nextMode) => {
    setErrorMsg('');
    setInfoMsg('');
    setMode(nextMode);
  };

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

  const goRegister = () => {
    if (typeof onViewChange === 'function') {
      onViewChange('register');
    } else if (typeof onNavigateRegister === 'function') {
      onNavigateRegister();
    }
  };

  const headline =
    mode === 'login'
      ? 'Ingresá tu e-mail para iniciar sesión'
      : mode === 'forgot'
        ? 'Recuperá el acceso a tu cuenta'
        : 'Definí tu nueva contraseña';

  const subtitle =
    mode === 'login'
      ? 'Accedé a tu portal de residente, prestador o consola de garita.'
      : mode === 'forgot'
        ? 'Ingresá tu e-mail registrado para generar un código temporal de recuperación.'
        : 'Pegá el código recibido y elegí una contraseña segura de al menos 6 caracteres.';

  return (
    <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10 md:py-16">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Columna izquierda: titular limpio y acceso sobrio a seguridad / recuperación */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-6 lg:pt-3">
          <div className="space-y-3">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-snug">
              {headline}
            </h1>
            <p className="text-sm opacity-75 leading-relaxed max-w-sm">{subtitle}</p>
          </div>

          {/* Tarjeta sobria de ayuda / seguridad (patrón minimalista sin ruido) */}
          <div className="space-y-3 pt-2 lg:pt-12">
            {mode === 'login' ? (
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className={`w-full max-w-xs rounded-2xl px-4 py-3.5 border ${cardBorder} flex items-center justify-between gap-3 text-left transition-opacity hover:opacity-90 cursor-pointer`}
                style={cardStyle}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ShieldAlert size={18} className="opacity-75 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold leading-snug">¿Olvidaste tu contraseña?</p>
                    <p className="text-[11px] opacity-70 truncate">
                      Recuperar acceso a mi cuenta
                    </p>
                  </div>
                </div>
                <ChevronRight size={16} className="opacity-60 shrink-0" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`w-full max-w-xs rounded-2xl px-4 py-3.5 border ${cardBorder} flex items-center gap-2.5 text-xs font-bold transition-opacity hover:opacity-90 cursor-pointer`}
                style={cardStyle}
              >
                <ArrowLeft size={15} />
                <span>Volver al inicio de sesión</span>
              </button>
            )}

            {typeof onViewChange === 'function' && (
              <div>
                <button
                  type="button"
                  onClick={() => onViewChange('landing')}
                  className="text-xs font-semibold opacity-75 hover:opacity-100 hover:underline cursor-pointer"
                  style={{ color: accentColor }}
                >
                  Volver a la portada
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha: tarjeta minimalista de autenticación */}
        <div className="lg:col-span-7 flex justify-center lg:justify-end">
          <div
            className={`w-full max-w-md border ${cardBorder} rounded-2xl p-6 sm:p-8 shadow-sm space-y-5`}
            style={cardStyle}
          >
            {/* Mensajes de error o confirmación */}
            {errorMsg && (
              <div className="bg-rose-950/60 border border-rose-500/40 text-rose-200 p-3.5 rounded-xl text-xs flex items-start gap-2">
                <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {infoMsg && (
              <div className="bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 p-3.5 rounded-xl text-xs flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>{infoMsg}</span>
              </div>
            )}

            {/* Subflujo 1: Inicio de sesión limpio en 1 paso */}
            {mode === 'login' ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="login-email" className="block text-xs font-semibold opacity-90">
                    E-mail
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@correo.com"
                    className={`w-full px-3.5 py-3 rounded-xl border ${inputBorder} text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-colors`}
                    style={innerStyle}
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-semibold opacity-90"
                  >
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Ingresá tu contraseña"
                      className={`w-full pl-3.5 pr-11 py-3 rounded-xl border ${inputBorder} text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-colors`}
                      style={innerStyle}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg opacity-65 hover:opacity-100 cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full text-white font-bold py-3.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-95 cursor-pointer disabled:opacity-50 mt-2"
                  style={{ backgroundColor: accentColor }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Ingresando...</span>
                    </>
                  ) : (
                    <span>Continuar</span>
                  )}
                </button>

                {(onViewChange || onNavigateRegister) && (
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={goRegister}
                      className="text-sm font-semibold hover:underline cursor-pointer"
                      style={{ color: accentColor }}
                    >
                      Crear cuenta
                    </button>
                  </div>
                )}
              </form>
            ) : mode === 'forgot' ? (
              /* Subflujo 2: Solicitud de código de recuperación */
              <form onSubmit={handleRequestReset} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="forgot-email" className="block text-xs font-semibold opacity-90">
                    E-mail
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@correo.com"
                    className={`w-full px-3.5 py-3 rounded-xl border ${inputBorder} text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-colors`}
                    style={innerStyle}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full text-white font-bold py-3.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-95 cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: accentColor }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Generando código...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound size={16} />
                      <span>Enviar código de recuperación</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Subflujo 3: Confirmación con código y nueva contraseña */
              <form onSubmit={handleConfirmReset} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="reset-token" className="block text-xs font-semibold opacity-90">
                    Código de recuperación
                  </label>
                  <input
                    id="reset-token"
                    type="text"
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="Pegá el código recibido"
                    className={`w-full px-3.5 py-3 rounded-xl border ${inputBorder} text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-colors`}
                    style={innerStyle}
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="reset-new-password"
                    className="block text-xs font-semibold opacity-90"
                  >
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="reset-new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className={`w-full pl-3.5 pr-11 py-3 rounded-xl border ${inputBorder} text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-colors`}
                      style={innerStyle}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      aria-label={showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg opacity-65 hover:opacity-100 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full text-white font-bold py-3.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-95 cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: accentColor }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Actualizando...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound size={16} />
                      <span>Guardar nueva contraseña</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
