/**
 * @file RegisterView.jsx
 * @description Vista de registro institucional minimalista conectada a `/api/v1/auth/register`.
 * Diseñada en columna única angosta (`max-w-md`) con etiquetas naturales, prefijo telefónico `+54`,
 * toggle ver/ocultar contraseña y revelación progresiva:
 * - Prestadores: registro directo en 1 paso sin campos residenciales innecesarios.
 * - Residentes: Paso 1 (datos de cuenta e identidad) y Paso 2 (barrio y lote).
 * Respeta las zonas y modos oscuro/claro de `BrandingContext`.
 * @location /trustlink-web/src/modules/auth/RegisterView.jsx
 */

import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Eye,
  EyeOff,
  Home,
  Briefcase,
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';
import { API_BASE } from '../../config/api';

/**
 * Vista de registro de nuevas cuentas (Residente o Prestador de Servicios).
 * Consulta las comunidades activas disponibles y normaliza los campos residenciales antes del envío.
 *
 * @param {object} props
 * @param {() => void} [props.onRegisterSuccess] - Callback invocado tras completar el alta.
 * @param {(view: string) => void} [props.onViewChange] - Navegador de vistas del contenedor principal.
 */
export default function RegisterView({ onRegisterSuccess, onViewChange }) {
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

  // Rol inicial (respeta la preselección proveniente de la Landing)
  const [role, setRole] = useState(() => {
    try {
      const initialRole = sessionStorage.getItem('trustlink_initial_register_role');
      if (initialRole === 'provider' || initialRole === 'owner') {
        sessionStorage.removeItem('trustlink_initial_register_role');
        return initialRole;
      }
    } catch {
      // Ignorar si sessionStorage no está disponible
    }
    return 'owner';
  });

  // Paso activo del registro: 1 = datos personales y acceso; 2 = barrio y lote (solo Residente)
  const [step, setStep] = useState(1);

  const [countries, setCountries] = useState([]);
  const [countryId, setCountryId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dni, setDni] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [fractionType, setFractionType] = useState('na');
  const [fraction, setFraction] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Carga el catálogo de comunidades activas desde `/api/v1/auth/countries` y preselecciona la primera
  useEffect(() => {
    let mounted = true;
    fetch(`${API_BASE}/api/v1/auth/countries`)
      .then((res) => res.json())
      .then((data) => {
        if (mounted && Array.isArray(data.countries)) {
          setCountries(data.countries);
          if (data.countries.length > 0) {
            setCountryId((prev) => prev || String(data.countries[0].id));
          }
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  /** Cambia entre perfil Residente y Prestador manteniendo los datos ya cargados. */
  const handleRoleChange = (nextRole) => {
    setRole(nextRole);
    setErrorMsg('');
    if (nextRole === 'provider' && step === 2) {
      setStep(1);
    }
  };

  /** Normaliza el teléfono agregando prefijo `+54` cuando el usuario ingresa solo el número local. */
  const normalizePhone = (rawPhone) => {
    const clean = String(rawPhone || '').trim();
    if (!clean) return null;
    if (clean.startsWith('+')) return clean;
    return `+54 ${clean}`;
  };

  /** Valida el Paso 1 antes de avanzar al Paso 2 (Residente) o enviar el alta (Prestador). */
  const validateStepOne = () => {
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Ingresá un e-mail válido.');
      return false;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setErrorMsg('Completá tu nombre y apellido.');
      return false;
    }
    if (dni.trim().length < 6) {
      setErrorMsg('Ingresá un DNI válido (sin puntos ni espacios).');
      return false;
    }
    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return false;
    }
    if (!acceptedTerms) {
      setErrorMsg('Debés aceptar los términos de uso y validación de identidad para continuar.');
      return false;
    }
    return true;
  };

  /** Envía el alta definitiva al endpoint `/api/v1/auth/register`. */
  const submitRegistration = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    const isOwner = role === 'owner';

    try {
      const payload = {
        country_id: isOwner && countryId ? Number(countryId) : null,
        role,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        dni: dni.trim(),
        phone: normalizePhone(phone),
        email: email.trim(),
        password,
        fraction_type: isOwner ? fractionType : 'na',
        fraction_number: isOwner && fractionType !== 'na' ? fraction.trim() || null : null,
        lot_number: isOwner ? lotNumber.trim() || null : null,
      };

      const response = await fetch(`${API_BASE}/api/v1/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMsg(
          data.message || 'Cuenta creada correctamente. Ya podés iniciar sesión.'
        );
        setTimeout(() => {
          if (typeof onRegisterSuccess === 'function') {
            onRegisterSuccess();
          } else if (typeof onViewChange === 'function') {
            onViewChange('login');
          }
        }, 900);
      } else {
        setErrorMsg(data.error || 'No se pudo completar el registro.');
      }
    } catch (error) {
      console.error('Error al registrar usuario:', error);
      setErrorMsg('Error de conexión con el servidor de TrustLink.');
    } finally {
      setLoading(false);
    }
  };

  /** Maneja el envío del formulario según rol y paso activo. */
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (step === 1) {
      if (!validateStepOne()) return;
      if (role === 'owner') {
        setStep(2);
        return;
      }
      await submitRegistration();
      return;
    }

    // Paso 2 (Residente): validar lote y enviar alta
    if (role === 'owner' && !lotNumber.trim()) {
      setErrorMsg('Ingresá tu número de lote para identificar tu domicilio.');
      return;
    }
    if (fractionType !== 'na' && !fraction.trim()) {
      setErrorMsg(
        `Ingresá el número de ${fractionType === 'manzana' ? 'manzana' : 'fracción'}.`
      );
      return;
    }
    await submitRegistration();
  };

  const isOwner = role === 'owner';

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 md:py-12">
      <div className="w-full max-w-md space-y-5">
        {/* Encabezado limpio centrado fuera de la tarjeta (ritmo minimalista) */}
        <div className="text-center space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-snug">
            {isOwner ? 'Creá tu cuenta y gestioná tu hogar' : 'Creá tu cuenta de prestador'}
          </h1>
          <p className="text-xs sm:text-sm opacity-75">
            {isOwner
              ? step === 1
                ? 'Empezá con tus datos básicos para acceder a prestadores verificados.'
                : 'Último paso: indicanos tu barrio y lote para emitir Pases QR.'
              : 'Validá tu identidad y documentación una sola vez para toda la red.'}
          </p>
        </div>

        {/* Tarjeta única vertical */}
        <div
          className={`w-full border ${cardBorder} rounded-2xl p-6 sm:p-8 shadow-sm space-y-5`}
          style={cardStyle}
        >
          {/* Selector de perfil limpio + progreso discreto para Residente */}
          <div className="space-y-3">
            <div
              className={`grid grid-cols-2 gap-1.5 p-1 rounded-xl border ${cardBorder}`}
              style={innerStyle}
              role="tablist"
              aria-label="Tipo de cuenta"
            >
              <button
                type="button"
                role="tab"
                aria-selected={isOwner}
                onClick={() => handleRoleChange('owner')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isOwner ? 'text-white shadow-sm' : 'opacity-75 hover:opacity-100'
                }`}
                style={isOwner ? { backgroundColor: accentColor } : undefined}
              >
                <Home size={14} />
                <span>Residente</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={!isOwner}
                onClick={() => handleRoleChange('provider')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  !isOwner ? 'text-white shadow-sm' : 'opacity-75 hover:opacity-100'
                }`}
                style={!isOwner ? { backgroundColor: accentColor } : undefined}
              >
                <Briefcase size={14} />
                <span>Prestador</span>
              </button>
            </div>

            {isOwner && (
              <div className="flex items-center justify-between gap-2 text-[11px] opacity-75">
                <span className="font-semibold">
                  Paso {step} de 2 · {step === 1 ? 'Tus datos' : 'Tu barrio y lote'}
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-7 rounded-full"
                    style={{ backgroundColor: accentColor }}
                  />
                  <span
                    className={`h-1.5 w-7 rounded-full ${
                      step === 2 ? '' : isDark ? 'bg-white/15' : 'bg-slate-300'
                    }`}
                    style={step === 2 ? { backgroundColor: accentColor } : undefined}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Mensajes de error o confirmación */}
          {errorMsg && (
            <div className="bg-rose-950/60 border border-rose-500/40 text-rose-200 p-3.5 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 p-3.5 rounded-xl text-xs flex items-start gap-2">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Formulario progresivo */}
          <form onSubmit={handleFormSubmit} className="space-y-4">
            {step === 1 ? (
              <>
                <div className="space-y-1.5">
                  <label htmlFor="reg-email" className="block text-xs font-semibold opacity-90">
                    E-mail
                  </label>
                  <input
                    id="reg-email"
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

                <div className="space-y-1">
                  <label htmlFor="reg-phone" className="block text-xs font-semibold opacity-90">
                    Teléfono
                  </label>
                  <div
                    className={`flex items-center rounded-xl border ${inputBorder} overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/30`}
                    style={innerStyle}
                  >
                    <span
                      className={`px-3 py-3 text-xs font-bold border-r ${cardBorder} opacity-80 select-none shrink-0`}
                    >
                      AR +54
                    </span>
                    <input
                      id="reg-phone"
                      type="tel"
                      autoComplete="tel-national"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="11 5555-1234"
                      className="w-full px-3 py-3 text-sm bg-transparent focus:outline-none"
                    />
                  </div>
                  <p className="text-[11px] opacity-65">Código de área + número (opcional).</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="reg-firstname"
                      className="block text-xs font-semibold opacity-90"
                    >
                      Nombre
                    </label>
                    <input
                      id="reg-firstname"
                      type="text"
                      required
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Ej. María"
                      className={`w-full px-3.5 py-3 rounded-xl border ${inputBorder} text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-colors`}
                      style={innerStyle}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="reg-lastname"
                      className="block text-xs font-semibold opacity-90"
                    >
                      Apellido
                    </label>
                    <input
                      id="reg-lastname"
                      type="text"
                      required
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Ej. Gómez"
                      className={`w-full px-3.5 py-3 rounded-xl border ${inputBorder} text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-colors`}
                      style={innerStyle}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="reg-dni" className="block text-xs font-semibold opacity-90">
                    DNI
                  </label>
                  <input
                    id="reg-dni"
                    type="text"
                    inputMode="numeric"
                    required
                    value={dni}
                    onChange={(e) => setDni(e.target.value.replace(/\D+/g, ''))}
                    placeholder="35123456"
                    className={`w-full px-3.5 py-3 rounded-xl border ${inputBorder} text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-colors`}
                    style={innerStyle}
                  />
                  <p className="text-[11px] opacity-65">
                    Solo números. Se utiliza para validar identidad y accesos en garita.
                  </p>
                </div>

                <div className="space-y-1">
                  <label htmlFor="reg-password" className="block text-xs font-semibold opacity-90">
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
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

                <label className="flex items-start gap-2.5 pt-1 text-xs opacity-80 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded accent-emerald-500 cursor-pointer shrink-0"
                  />
                  <span className="leading-snug">
                    Acepto los términos de uso y autorizo la validación de identidad para gestionar
                    servicios y accesos en garita.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full text-white font-bold py-3.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-95 cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: accentColor }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Creando cuenta...</span>
                    </>
                  ) : (
                    <span>{isOwner ? 'Continuar' : 'Crear cuenta'}</span>
                  )}
                </button>
              </>
            ) : (
              /* Paso 2 (exclusivo Residente): ubicación en la comunidad */
              <>
                <div
                  className={`rounded-xl px-3.5 py-2.5 border ${cardBorder} flex items-center justify-between gap-2 text-xs`}
                  style={innerStyle}
                >
                  <span className="truncate opacity-85 font-medium">{email}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setStep(1);
                    }}
                    className="font-bold hover:underline cursor-pointer shrink-0"
                    style={{ color: accentColor }}
                  >
                    Editar datos
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="reg-country" className="block text-xs font-semibold opacity-90">
                    Comunidad / Barrio
                  </label>
                  <select
                    id="reg-country"
                    value={countryId}
                    onChange={(e) => setCountryId(e.target.value)}
                    className={`w-full px-3.5 py-3 rounded-xl border ${inputBorder} text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30`}
                    style={innerStyle}
                  >
                    <option value="">Seleccionar comunidad (opcional)</option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="reg-fraction-type"
                      className="block text-xs font-semibold opacity-90"
                    >
                      Tipo de área
                    </label>
                    <select
                      id="reg-fraction-type"
                      value={fractionType}
                      onChange={(e) => {
                        const next = e.target.value;
                        setFractionType(next);
                        if (next === 'na') setFraction('');
                      }}
                      className={`w-full px-3.5 py-3 rounded-xl border ${inputBorder} text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30`}
                      style={innerStyle}
                    >
                      <option value="na">No aplica</option>
                      <option value="manzana">Manzana</option>
                      <option value="fraccion">Fracción</option>
                    </select>
                  </div>

                  {fractionType !== 'na' && (
                    <div className="space-y-1.5">
                      <label
                        htmlFor="reg-fraction"
                        className="block text-xs font-semibold opacity-90"
                      >
                        N° {fractionType === 'manzana' ? 'Manzana' : 'Fracción'}
                      </label>
                      <input
                        id="reg-fraction"
                        type="text"
                        inputMode="numeric"
                        required
                        value={fraction}
                        onChange={(e) => setFraction(e.target.value.replace(/\D+/g, ''))}
                        placeholder="Ej. 4"
                        className={`w-full px-3.5 py-3 rounded-xl border ${inputBorder} text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30`}
                        style={innerStyle}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label htmlFor="reg-lot" className="block text-xs font-semibold opacity-90">
                    N° de Lote
                  </label>
                  <input
                    id="reg-lot"
                    type="text"
                    inputMode="numeric"
                    required
                    value={lotNumber}
                    onChange={(e) => setLotNumber(e.target.value.replace(/\D+/g, ''))}
                    placeholder="Ej. 18"
                    className={`w-full px-3.5 py-3 rounded-xl border ${inputBorder} text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30`}
                    style={innerStyle}
                  />
                  <p className="text-[11px] opacity-65">
                    Destino predeterminado para tus visitas y Pases QR en garita.
                  </p>
                </div>

                <div className="space-y-2.5 pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full text-white font-bold py-3.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-95 cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: accentColor }}
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Creando cuenta...</span>
                      </>
                    ) : (
                      <span>Crear cuenta</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setStep(1);
                    }}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold border ${cardBorder} flex items-center justify-center gap-1.5 opacity-85 hover:opacity-100 cursor-pointer`}
                    style={innerStyle}
                  >
                    <ArrowLeft size={14} />
                    <span>Volver al paso anterior</span>
                  </button>
                </div>
              </>
            )}
          </form>
        </div>

        {/* Enlaces secundarios discretos fuera de la tarjeta (mismo patrón limpio de MeLi) */}
        <div className="text-center space-y-2 text-xs opacity-85">
          <div>
            <span>{isOwner ? '¿Ofrecés servicios en barrios? ' : '¿Vivís en un barrio cerrado? '}</span>
            <button
              type="button"
              onClick={() => handleRoleChange(isOwner ? 'provider' : 'owner')}
              className="font-bold hover:underline cursor-pointer"
              style={{ color: accentColor }}
            >
              {isOwner ? 'Creá una cuenta de prestador' : 'Creá una cuenta de residente'}
            </button>
          </div>

          {typeof onViewChange === 'function' && (
            <div>
              <span>¿Ya tenés cuenta? </span>
              <button
                type="button"
                onClick={() => onViewChange('login')}
                className="font-bold hover:underline cursor-pointer"
                style={{ color: accentColor }}
              >
                Iniciar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
