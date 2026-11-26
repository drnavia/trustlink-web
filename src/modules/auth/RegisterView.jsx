/**
 * @file RegisterView.jsx
 * @description Vista de registro institucional de TrustLink conectada al backend (/api/v1/auth/register).
 * Mantiene coherencia estética con LoginView.jsx mediante Zonas 4 y 5, color de acento de marca,
 * título unificado text-xl y enlace inferior simétrico hacia el inicio de sesión.
 * @location /trustlink-web/src/modules/auth/RegisterView.jsx
 */

import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Building2,
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';
import { API_BASE } from '../../config/api';

/**
 * Vista de registro de nuevas cuentas (Propietario/Residente o Prestador de Servicios).
 * Consulta las comunidades activas disponibles y normaliza los campos residenciales antes del envío.
 * @param {object} props
 * @param {() => void} [props.onRegisterSuccess] - Callback invocado tras completar el alta.
 * @param {(view: string) => void} [props.onViewChange] - Navegador de vistas del contenedor principal.
 */
export default function RegisterView({ onRegisterSuccess, onViewChange }) {
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

  // Estados del formulario: perfil/comunidad, datos personales, credenciales y ubicación residencial
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
  const [countries, setCountries] = useState([]);
  const [countryId, setCountryId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dni, setDni] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  /**
   * Construye el payload normalizado y registra la cuenta en `/api/v1/auth/register`.
   * Si el alta es exitosa, muestra confirmación y redirige automáticamente al inicio de sesión.
   * @param {React.FormEvent<HTMLFormElement>} e
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const payload = {
        country_id: countryId ? Number(countryId) : null,
        role,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        dni: dni.trim(),
        phone: phone.trim() || null,
        email: email.trim(),
        password,
        fraction_type: fractionType,
        fraction_number: fractionType === 'na' ? null : fraction.trim() || null,
        lot_number: lotNumber.trim() || null,
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
        // Breve demora para que el usuario lea la confirmación antes de pasar al login
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

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-10">
      <div
        className="w-full max-w-xl border border-black/20 rounded-2xl p-6 md:p-8 shadow-sm space-y-6"
        style={cardStyle}
      >
        {/* Encabezado alineado con el tamaño de título text-xl */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div
              className="p-3 rounded-xl border border-white/15 shrink-0"
              style={{ ...innerStyle, color: accentColor }}
            >
              <UserPlus size={20} strokeWidth={1.8} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">Crear Cuenta</h2>
              <p className="text-xs opacity-80 mt-0.5">
                Registro institucional en TrustLink
              </p>
            </div>
          </div>

          {typeof onViewChange === 'function' && (
            <button
              type="button"
              onClick={() => onViewChange('login')}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-white/15 cursor-pointer hover:opacity-90 shrink-0"
              style={innerStyle}
            >
              <ArrowLeft size={13} />
              Volver
            </button>
          )}
        </div>

        {/* Mensajes de error o éxito */}
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

        {/* Formulario de registro */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Selección de rol operativo y comunidad/barrio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1.5">
                Perfil / Rol
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                style={innerStyle}
              >
                <option value="owner">Propietario / Residente</option>
                <option value="provider">Prestador de Servicios</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1.5 flex items-center gap-1">
                <Building2 size={12} /> Comunidad / Barrio
              </label>
              <select
                value={countryId}
                onChange={(e) => setCountryId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs focus:outline-none"
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
          </div>

          {/* Datos personales básicos: nombre y apellido */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1.5">
                Nombre
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ej. María"
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                style={innerStyle}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1.5">
                Apellido
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Ej. Gómez"
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                style={innerStyle}
              />
            </div>
          </div>

          {/* Identificación y teléfono de contacto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1.5">
                DNI
              </label>
              <input
                type="text"
                required
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                placeholder="35123456"
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                style={innerStyle}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1.5">
                Teléfono
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+54 9 11 ..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                style={innerStyle}
              />
            </div>
          </div>

          {/* Credenciales de acceso */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1.5">
                Correo Electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@dominio.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                style={innerStyle}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                style={innerStyle}
              />
            </div>
          </div>

          {/* Sub-bloque interno (Zona 5) para datos residenciales normalizados (campos condicionales por área y rol) */}
          <div
            className="p-4 rounded-xl border border-black/20 grid grid-cols-1 sm:grid-cols-3 gap-3"
            style={innerStyle}
          >
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1.5">
                Tipo de Área
              </label>
              <select
                value={fractionType}
                onChange={(e) => {
                  const next = e.target.value;
                  setFractionType(next);
                  if (next === 'na') setFraction('');
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-white/15 text-xs focus:outline-none"
                style={cardStyle}
              >
                <option value="na">No aplica (N/A)</option>
                <option value="manzana">Manzana</option>
                <option value="fraccion">Fracción</option>
              </select>
            </div>

            {/* Número de Manzana o Fracción: se habilita y exige solo si Tipo de Área es distinto de 'na' */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1.5">
                N° {fractionType === 'manzana' ? 'Manzana' : 'Fracción'}
              </label>
              <input
                type="text"
                inputMode="numeric"
                disabled={fractionType === 'na'}
                required={fractionType !== 'na'}
                value={fraction}
                onChange={(e) => setFraction(e.target.value.replace(/\D+/g, ''))}
                placeholder={fractionType === 'na' ? 'N/A' : 'Ej. 4'}
                className="w-full px-3 py-2.5 rounded-xl border border-white/15 text-xs font-mono focus:outline-none disabled:opacity-45"
                style={cardStyle}
              />
            </div>

            {/* Número de Lote: obligatorio cuando el rol seleccionado es 'owner' */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1.5">
                N° Lote {role === 'owner' ? '*' : ''}
              </label>
              <input
                type="text"
                inputMode="numeric"
                required={role === 'owner'}
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value.replace(/\D+/g, ''))}
                placeholder="Ej. 18"
                className="w-full px-3 py-2.5 rounded-xl border border-white/15 text-xs font-mono focus:outline-none"
                style={cardStyle}
              />
            </div>
          </div>

          {/* Botón de envío del formulario */}
          <button
            type="submit"
            disabled={loading}
            className="w-full text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-opacity hover:opacity-95 cursor-pointer disabled:opacity-50 mt-2"
            style={{ backgroundColor: accentColor }}
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <UserPlus size={15} />
                Completar Registro
              </>
            )}
          </button>
        </form>

        {/* Pie simétrico al de LoginView */}
        <div className="pt-4 border-t border-black/20 text-center text-xs opacity-80">
          <span>¿Ya tenés cuenta? </span>
          {typeof onViewChange === 'function' ? (
            <button
              type="button"
              onClick={() => onViewChange('login')}
              className="font-bold hover:underline cursor-pointer"
              style={{ color: accentColor }}
            >
              Iniciá sesión acá
            </button>
          ) : (
            <span className="font-bold" style={{ color: accentColor }}>
              Ingresá desde el menú superior
            </span>
          )}
        </div>
      </div>
    </div>
  );
}