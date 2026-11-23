/**
 * @file SecurityScanner.jsx
 * @description Consola de Garita para validación ultrarrápida de pases QR en accesos perimetrales.
 * Soporta ingreso manual/pistola, lectura por URL (?qr_token= / ?token=) y escaneo en vivo con cámara
 * del dispositivo (BarcodeDetector + fallback seguro a cámara/manual), aplicando Zonas 4 y 5.
 * @location /trustlink-web/src/modules/security/SecurityScanner.jsx
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  QrCode,
  Search,
  RotateCcw,
  User,
  Car,
  MapPin,
  Clock,
  Camera,
  CameraOff,
  AlertCircle
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';
import { API_BASE } from '../../config/api'; // Ajustá la cantidad de ../ según la carpeta del archivo

/* const API_BASE = 'http://localhost:4000'; */

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

/**
 * Extrae el token QR si el código escaneado contiene una URL con ?qr_token=... o ?token=...
 * @param {string} rawValue
 * @returns {string}
 */
function normalizeScannedToken(rawValue) {
  const trimmed = String(rawValue || '').trim();
  if (!trimmed) return '';
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const url = new URL(trimmed);
      return (
        url.searchParams.get('qr_token') ||
        url.searchParams.get('token') ||
        trimmed
      ).trim();
    }
  } catch {
    // Si no es una URL válida, se usa el valor tal cual
  }
  return trimmed;
}

export default function SecurityScanner({ initialToken = '', onClearInitialToken }) {
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

  const [qrToken, setQrToken] = useState(initialToken || '');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);

  // Estado de cámara y escáner QR en vivo
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [detectorSupported, setDetectorSupported] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const detectorRef = useRef(null);
  const autoVerifiedInitialRef = useRef(false);

  const stopCameraScanner = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraStarting(false);
  }, []);

  const verifyTokenValue = useCallback(async (tokenToVerify) => {
    const cleanToken = normalizeScannedToken(tokenToVerify);
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
  }, []);

  // Verifica soporte nativo de BarcodeDetector para QR en el navegador
  useEffect(() => {
    let mounted = true;
    const initDetector = async () => {
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          if (typeof window.BarcodeDetector.getSupportedFormats === 'function') {
            const formats = await window.BarcodeDetector.getSupportedFormats();
            if (mounted && Array.isArray(formats) && formats.includes('qr_code')) {
              detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
              setDetectorSupported(true);
              return;
            }
          }
          detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
          if (mounted) setDetectorSupported(true);
        } catch {
          if (mounted) setDetectorSupported(false);
        }
      }
    };
    initDetector();
    return () => {
      mounted = false;
      stopCameraScanner();
    };
  }, [stopCameraScanner]);

  // Si llega un token por URL (?qr_token= o ?token=), lo pre-carga y valida automáticamente una vez
  useEffect(() => {
    if (initialToken && !autoVerifiedInitialRef.current) {
      autoVerifiedInitialRef.current = true;
      const normalized = normalizeScannedToken(initialToken);
      setQrToken(normalized);
      verifyTokenValue(normalized);
      if (typeof onClearInitialToken === 'function') {
        onClearInitialToken();
      }
    }
  }, [initialToken, verifyTokenValue, onClearInitialToken]);

  const startCameraScanner = async () => {
    setCameraError('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Este navegador no admite acceso directo a la cámara. Ingresá o pegá el token manualmente.'
      );
      return;
    }

    setCameraStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      });

      streamRef.current = stream;
      setCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      if (detectorRef.current && videoRef.current) {
        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2 || !detectorRef.current) {
            return;
          }
          try {
            const barcodes = await detectorRef.current.detect(videoRef.current);
            if (Array.isArray(barcodes) && barcodes.length > 0 && barcodes[0]?.rawValue) {
              const detectedToken = normalizeScannedToken(barcodes[0].rawValue);
              if (detectedToken) {
                stopCameraScanner();
                setQrToken(detectedToken);
                verifyTokenValue(detectedToken);
              }
            }
          } catch {
            // Ignora frames intermedios no decodificables
          }
        }, 350);
      } else {
        setCameraError(
          'Cámara abierta. Si tu navegador no lee códigos QR en vivo automáticamente, ingresá el token en el campo de abajo.'
        );
      }
    } catch (err) {
      console.error('Error al acceder a la cámara:', err);
      setCameraError(
        'No se pudo iniciar la cámara (verificá permisos del navegador o el uso de HTTPS/localhost).'
      );
      stopCameraScanner();
    } finally {
      setCameraStarting(false);
    }
  };

  const handleVerifyPass = async (e) => {
    if (e) e.preventDefault();
    if (!qrToken.trim()) return;
    stopCameraScanner();
    await verifyTokenValue(qrToken);
  };

  const handleClearScanner = () => {
    stopCameraScanner();
    setQrToken('');
    setResult(null);
    setCameraError('');
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                  Escanee el código QR con la cámara, abra un enlace con token o ingrese el token manualmente.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={cameraActive ? stopCameraScanner : startCameraScanner}
              disabled={cameraStarting}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-white/15 cursor-pointer hover:opacity-90 disabled:opacity-50 shrink-0 self-start sm:self-auto"
              style={innerStyle}
            >
              {cameraActive ? (
                <>
                  <CameraOff size={14} className="text-rose-400" />
                  Cerrar Cámara
                </>
              ) : (
                <>
                  <Camera size={14} className="text-emerald-400" />
                  {cameraStarting ? 'Abriendo cámara...' : 'Escanear con Cámara'}
                </>
              )}
            </button>
          </div>

          {/* Visor de cámara en vivo cuando está activo */}
          {cameraActive && (
            <div
              className="p-4 rounded-2xl border border-white/15 space-y-3"
              style={innerStyle}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold flex items-center gap-1.5">
                  <Camera size={14} className="text-emerald-400" />
                  Cámara activa — Apuntá hacia el código QR
                </span>
                <span className="text-[11px] font-mono opacity-75">
                  {detectorSupported ? 'Detección QR automática' : 'Vista previa de cámara'}
                </span>
              </div>
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-72 mx-auto w-full flex items-center justify-center border border-white/10">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {cameraError && (
            <div className="flex items-center gap-2 bg-amber-950/50 border border-amber-800/80 text-amber-200 p-3.5 rounded-xl text-xs">
              <AlertCircle size={15} className="text-amber-400 shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}

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