/**
 * @file SecurityScanner.jsx
 * @description Consola de Garita para validación ultrarrápida de pases QR en accesos perimetrales.
 * Aplica de forma homogénea Zonas 4 y 5, color principal de marca y título unificado text-xl.
 * @location /trustlink-web/src/modules/security/SecurityScanner.jsx
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  QrCode,
  Search,
  RotateCcw,
  User,
  Car,
  MapPin,
  Clock
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';

const API_BASE = 'http://localhost:4000';

/**
 * Formatea una fecha/hora de forma segura para la consola de garita.
 * @param {string|null|undefined} isoValue
 * @returns {string}
 */
function formatDateTime(isoValue) {
  if (!isoValue) return 'No especificado';
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) return String(isoValue);
  return parsed.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SecurityScanner() {
  const { brand } = useBranding();

  // Zona 4: Tarjetas principales
  const cardStyle = {
    backgroundColor: brand?.cardBgColor || '#020617',
    color: brand?.cardTextColor || '#F1F5F9',
  };

  // Zona 5: Cajas internas, inputs y botones secundarios
  const innerStyle = {
    backgroundColor: brand?.innerBgColor || '#0F172A',
    color: brand?.innerTextColor || '#F1F5F9',
  };

  // Color principal / de acento configurado en marca
  const primaryActionColor = brand?.accentColor || brand?.primaryColor || '#10b981';

  const [qrToken, setQrToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);

  const handleVerifyPass = async (e) => {
    if (e) e.preventDefault();
    const cleanToken = qrToken.trim();
    if (!cleanToken) return;

    setVerifying(true);
    setResult(null);

    try {
      const token =
        localStorage.getItem('trustlink_token') ||
        localStorage.getItem('security_token') ||
        '';

      const response = await fetch(`${API_BASE}/api/v1/passes/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ qr_token: cleanToken }),
      });

      const data = await response.json();
      setResult({
        authorized: response.ok && Boolean(data.authorized),
        message:
          data.message ||
          (response.ok ? 'Acceso autorizado.' : 'Acceso denegado o token inválido.'),
        code: data.code || (response.ok ? 'ACCESS_GRANTED' : 'ACCESS_DENIED'),
        details: data.details || data.pass || null,
      });
    } catch (error) {
      console.error('Error al validar token QR en garita:', error);
      setResult({
        authorized: false,
        message: 'Error de conexión con el servidor de validación de pases.',
        code: 'NETWORK_ERROR',
        details: null,
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleClearScanner = () => {
    setQrToken('');
    setResult(null);
  };

  const details = result?.details || {};

  return (
    <div className="p-6 md:p-8 flex-1">
      <main className="max-w-4xl mx-auto space-y-6">
        {/* Tarjeta principal con ícono sobrio alineado a la izquierda del título */}
        <section
          className="border border-black/20 p-6 md:p-8 rounded-2xl shadow-sm space-y-6"
          style={cardStyle}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="p-3 rounded-xl border border-white/15 text-emerald-400 shrink-0"
              style={innerStyle}
            >
              <ShieldCheck size={22} strokeWidth={1.8} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">
                Validación Ultrarrápida de Accesos
              </h2>
              <p className="text-xs opacity-80 mt-0.5">
                Escanee el código QR o ingrese el token digital presentado por el prestador.
              </p>
            </div>
          </div>

          {/* Formulario de escaneo / ingreso de token */}
          <form
            onSubmit={handleVerifyPass}
            className="p-4 rounded-2xl border border-black/20 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
            style={innerStyle}
          >
            <div className="relative flex-1">
              <QrCode
                size={17}
                className="opacity-60 absolute left-3.5 top-1/2 -translate-y-1/2"
              />
              <input
                type="text"
                value={qrToken}
                onChange={(e) => setQrToken(e.target.value)}
                placeholder="Ingrese o pistolee el Token QR (ej. 6c014b85...)"
                className="w-full pl-10 pr-4 py-2.5 border border-white/15 rounded-xl text-xs font-mono focus:outline-none"
                style={cardStyle}
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {(qrToken || result) && (
                <button
                  type="button"
                  onClick={handleClearScanner}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border border-white/15 cursor-pointer hover:opacity-90"
                  style={cardStyle}
                  title="Limpiar campo y resultado"
                >
                  <RotateCcw size={14} />
                  Limpiar
                </button>
              )}

              <button
                type="submit"
                disabled={verifying || !qrToken.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50 cursor-pointer transition-opacity hover:opacity-95"
                style={{ backgroundColor: primaryActionColor }}
              >
                <Search size={14} />
                {verifying ? 'Validando...' : 'Validar Pase'}
              </button>
            </div>
          </form>

          {/* Resultado de la validación en garita */}
          {result && (
            <div
              className={`p-5 rounded-2xl border space-y-4 text-xs ${
                result.authorized
                  ? 'bg-emerald-950/35 border-emerald-700/80 text-emerald-100'
                  : 'bg-rose-950/40 border-rose-800/80 text-rose-100'
              }`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  {result.authorized ? (
                    <ShieldCheck size={20} className="text-emerald-400 shrink-0" />
                  ) : (
                    <ShieldAlert size={20} className="text-rose-400 shrink-0" />
                  )}
                  <span className="text-sm font-black tracking-tight">
                    {result.authorized ? 'ACCESO AUTORIZADO' : 'ACCESO DENEGADO'}
                  </span>
                </div>
                <span className="font-mono text-[11px] px-2.5 py-1 rounded-lg bg-black/30 border border-white/10">
                  {result.code}
                </span>
              </div>

              <p className="text-xs opacity-90">{result.message}</p>

              {result.authorized && result.details && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* Bloque Prestador */}
                  <div
                    className="p-4 rounded-xl border border-white/15 space-y-1.5"
                    style={cardStyle}
                  >
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <User size={13} /> Prestador
                    </p>
                    <p className="text-sm font-bold">
                      {details.provider_name ||
                        `${details.provider_first_name || ''} ${details.provider_last_name || ''}`.trim() ||
                        'Prestador Verificado'}
                    </p>
                    {details.provider_dni && (
                      <p className="opacity-85">DNI: {details.provider_dni}</p>
                    )}
                    {details.specialty && (
                      <p className="opacity-85">Especialidad: {details.specialty}</p>
                    )}
                  </div>

                  {/* Bloque Vehículo, Destino y Vigencia */}
                  <div
                    className="p-4 rounded-xl border border-white/15 space-y-1.5"
                    style={cardStyle}
                  >
                    <p className="text-[11px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                      <Car size={13} /> Vehículo y Destino
                    </p>
                    <p className="font-semibold">
                      {[details.brand, details.model, details.vehicle_type]
                        .filter(Boolean)
                        .join(' · ') || 'Sin vehículo asociado'}
                      {details.color ? ` (${details.color})` : ''}
                    </p>
                    {details.plate && (
                      <p className="text-sky-300 font-mono font-bold">Patente: {details.plate}</p>
                    )}
                    <p className="opacity-85 flex items-center gap-1.5">
                      <MapPin size={12} className="text-emerald-400 shrink-0" />
                      <span>
                        Destino:{' '}
                        {[details.fraction_number, details.lot_number].filter(Boolean).join(' / ') ||
                          'No especificado'}
                      </span>
                    </p>
                    {(details.start_time || details.end_time) && (
                      <p className="opacity-75 flex items-center gap-1.5">
                        <Clock size={12} className="opacity-70 shrink-0" />
                        <span>
                          Vigencia: {formatDateTime(details.start_time)} —{' '}
                          {formatDateTime(details.end_time)}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}