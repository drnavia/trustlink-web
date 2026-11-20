/**
 * @file SecurityScanner.jsx
 * @description Consola de validación perimetral en garita conectada a /api/v1/passes/verify,
 * con aplicación explícita de Zona 4 (tarjetas principales) y Zona 5 (cajas/bloques internos).
 * @location /trustlink-web/src/modules/security/SecurityScanner.jsx
 */

import React, { useState } from 'react';
import {
  QrCode,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  Car,
} from 'lucide-react';
import { useBranding, DEFAULT_BRANDING_CONFIG } from '../branding/BrandingContext';

const API_BASE = 'http://localhost:4000';

export default function SecurityScanner() {
  const { brand } = useBranding();

  const cardStyle = {
    backgroundColor: brand.cardBgColor || DEFAULT_BRANDING_CONFIG.cardBgColor,
    color: brand.cardTextColor || DEFAULT_BRANDING_CONFIG.cardTextColor,
  };

  const innerStyle = {
    backgroundColor: brand.innerBgColor || DEFAULT_BRANDING_CONFIG.innerBgColor,
    color: brand.innerTextColor || DEFAULT_BRANDING_CONFIG.innerTextColor,
  };

  const [qrToken, setQrToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleVerifyPass = async (e) => {
    e.preventDefault();
    if (!qrToken.trim()) return;

    setLoading(true);
    setScanResult(null);
    setErrorMsg('');

    try {
      const authToken =
        localStorage.getItem('trustlink_token') ||
        localStorage.getItem('security_token') ||
        '';

      const response = await fetch(`${API_BASE}/api/v1/passes/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ qr_token: qrToken.trim() }),
      });

      const data = await response.json();

      if (response.ok && data.authorized) {
        setScanResult({
          authorized: true,
          details: data.details || {},
        });
      } else {
        setScanResult({
          authorized: false,
          error: data.error || 'Pase inexistente, expirado o no autorizado.',
        });
      }
    } catch (error) {
      console.error('Error al verificar pase en garita:', error);
      setErrorMsg('Error de conexión con el servidor de seguridad de TrustLink.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl w-full mx-auto px-4 md:px-8 py-8 space-y-6">
      {/* Zona 4: Tarjeta Principal de Validación */}
      <section
        className="p-6 md:p-8 rounded-2xl border border-black/20 space-y-6"
        style={cardStyle}
      >
        <div className="text-center space-y-1.5">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight">
            Validación Ultrarrápida de Accesos
          </h2>
          <p className="text-xs md:text-sm opacity-80">
            Escanee el código QR o ingrese el token digital presentado por el prestador.
          </p>
        </div>

        {/* Zona 5: Caja Interna del Formulario de Escaneo */}
        <form
          onSubmit={handleVerifyPass}
          className="p-4 rounded-2xl border border-black/20 flex flex-col sm:flex-row gap-3"
          style={innerStyle}
        >
          <div className="relative flex-grow">
            <QrCode className="absolute left-3.5 top-3 opacity-70" size={18} />
            <input
              type="text"
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value)}
              placeholder="Ingrese o pistolee el Token QR (ej. 6c014b85...)"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/15 text-xs sm:text-sm font-mono focus:outline-none"
              style={cardStyle}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-xl transition-colors inline-flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer disabled:opacity-50 shrink-0"
          >
            <Search size={16} /> {loading ? 'Verificando...' : 'Validar Pase'}
          </button>
        </form>

        {errorMsg && (
          <div className="bg-rose-950/60 border border-rose-800 text-rose-200 p-4 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Resultado de Validación */}
        {scanResult && (
          <div
            className={`rounded-2xl p-6 border space-y-5 ${
              scanResult.authorized
                ? 'bg-emerald-950/40 border-emerald-600/50 text-emerald-100'
                : 'bg-rose-950/40 border-rose-600/50 text-rose-100'
            }`}
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/15">
              <div className="flex items-center gap-2.5">
                {scanResult.authorized ? (
                  <>
                    <CheckCircle2 className="text-emerald-400" size={22} />
                    <span className="text-base font-black tracking-wide text-emerald-300">
                      ACCESO AUTORIZADO
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="text-rose-400" size={22} />
                    <span className="text-base font-black tracking-wide text-rose-300">
                      ACCESO DENEGADO
                    </span>
                  </>
                )}
              </div>
            </div>

            {scanResult.authorized && scanResult.details ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Zona 5: Datos del Prestador */}
                <div
                  className="p-4 rounded-xl border border-white/15 space-y-1.5"
                  style={innerStyle}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 opacity-80">
                    <User size={14} className="text-emerald-400" /> Datos del Prestador
                  </span>
                  <p className="text-sm font-bold">
                    {scanResult.details.provider || 'Prestador Verificado'}
                  </p>
                  <p className="opacity-80">DNI: {scanResult.details.dni || '-'}</p>
                  {scanResult.details.specialty && (
                    <p className="opacity-80">Especialidad: {scanResult.details.specialty}</p>
                  )}
                </div>

                {/* Zona 5: Datos del Vehículo y Destino */}
                <div
                  className="p-4 rounded-xl border border-white/15 space-y-1.5"
                  style={innerStyle}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 opacity-80">
                    <Car size={14} className="text-sky-400" /> Vehículo y Destino
                  </span>
                  <p className="font-semibold">
                    Vehículo: {scanResult.details.vehicle || 'Sin vehículo asociado'}
                  </p>
                  <p className="opacity-80">
                    Destino: {scanResult.details.destination || '-'}
                  </p>
                  <p className="opacity-80">
                    Autorizado por: {scanResult.details.authorized_by || '-'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs font-medium">{scanResult.error}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}