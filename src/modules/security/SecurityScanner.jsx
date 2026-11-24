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
  AlertCircle,
  Users,
  MessageCircle,
  Flashlight,
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';
import { API_BASE } from '../../config/api';
import { PAGE_SHELL_CLASS, SECTION_CARD_CLASS } from '../../config/uiTokens';

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

/**
 * Evalúa la fecha de vencimiento de ART/seguro de un integrante de cuadrilla y devuelve
 * la etiqueta legible y las clases Tailwind del badge semafórico (vencida / próxima a vencer / vigente).
 * @param {string|null|undefined} expiryDate - Fecha de vencimiento en formato ISO o YYYY-MM-DD.
 * @returns {{ label: string, cls: string }}
 */
function getCrewArtStatus(expiryDate) {
  if (!expiryDate) return { label: 'ART sin fecha', cls: 'bg-slate-800 text-slate-300 border-slate-700' };
  const parsed = new Date(expiryDate);
  if (Number.isNaN(parsed.getTime())) {
    return { label: 'ART sin fecha', cls: 'bg-slate-800 text-slate-300 border-slate-700' };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: 'ART vencida', cls: 'bg-rose-950/80 text-rose-300 border-rose-700/60' };
  if (diffDays <= 30) return { label: `ART vence en ${diffDays}d`, cls: 'bg-amber-950/80 text-amber-300 border-amber-700/60' };
  return { label: 'ART vigente', cls: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60' };
}

/**
 * Construye una URL `wa.me` prellenada para avisar por WhatsApp al residente el arribo en garita,
 * incluyendo prestador, especialidad, destino, patente/acceso peatonal, cuadrilla y número de pase.
 * @param {object} details - Detalles del pase validado devueltos por el backend.
 * @param {object} vehicleInfo - Información del vehículo asociado al pase (o fallback).
 * @returns {string} Enlace listo para abrir WhatsApp en una nueva pestaña.
 */
function buildGateArrivalWhatsAppUrl(details, vehicleInfo) {
  const digits = String(details?.owner_phone || '').replace(/\D/g, '');
  const crew = Array.isArray(details?.authorized_employees) ? details.authorized_employees : [];
  const crewText =
    crew.length > 0
      ? `\nCuadrilla ingresante: ${crew.map((e) => `${e.full_name}${e.dni ? ` (DNI ${e.dni})` : ''}`).join(', ')}`
      : '';
  const plateText = vehicleInfo?.plate || details?.vehicle_plate || 'Ingreso peatonal';
  const destino = [details?.fraction_number, details?.lot_number].filter(Boolean).join(' / ') || 'su lote';
  const msg =
    `Aviso de Garita TrustLink: ingresó ${details?.provider_name || 'el prestador autorizado'}` +
    `${details?.specialty ? ` (${details.specialty})` : ''} hacia ${destino}.\n` +
    `Vehículo/Acceso: ${plateText}${crewText}\n` +
    `Pase QR #${details?.pass_id || ''} validado correctamente.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}

/**
 * Consola de Garita para validación de pases QR mediante cámara (`BarcodeDetector`),
 * enlace directo con query param (`initialToken`) o ingreso manual/pistola lectora.
 * @param {object} props
 * @param {string} [props.initialToken=''] - Token QR inicial proveniente de la URL.
 * @param {() => void} [props.onClearInitialToken] - Callback para limpiar el query param una vez consumido.
 */
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

  // Estado del token actual, carga de validación y resultado de acceso devuelto por la API
  const [qrToken, setQrToken] = useState(initialToken || '');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);

  // Estado de cámara y escáner QR en vivo
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [detectorSupported, setDetectorSupported] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Referencias imperativas para el elemento <video>, MediaStream, intervalo de escaneo, detector y auto-verificación
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const detectorRef = useRef(null);
  const autoVerifiedInitialRef = useRef(false);

  /**
   * Detiene el bucle de lectura QR, apaga todas las pistas activas de cámara,
   * desvincula el `<video>` y restablece el estado de cámara y linterna.
   */
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
    setTorchOn(false);
    setTorchSupported(false);
    setCameraActive(false);
    setCameraStarting(false);
  }, []);

  /**
   * Normaliza el token QR y lo valida contra `POST /api/v1/passes/verify`,
   * registrando en estado un resultado uniforme de acceso autorizado o denegado.
   * @param {string} tokenToVerify - Token crudo o URL escaneada.
   */
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
          data.error ||
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

  // Verifica soporte nativo de BarcodeDetector para QR en el navegador y asegura apagado de cámara al desmontar
  useEffect(() => {
    let mounted = true;
    /**
     * Inicializa `window.BarcodeDetector` para formato `qr_code` si el navegador lo expone.
     */
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

  // Adjunta el stream al <video> ya montado y activa el bucle BarcodeDetector al abrir la cámara
  useEffect(() => {
    if (!cameraActive || !streamRef.current || !videoRef.current) return undefined;

    const videoEl = videoRef.current;
    videoEl.srcObject = streamRef.current;
    videoEl.play().catch(() => {});

    // Si hay soporte nativo, inspecciona el frame de video cada 300 ms hasta decodificar un QR
    if (detectorRef.current) {
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
      }, 300);
    } else {
      setCameraError(
        'Cámara abierta. Este navegador no expone BarcodeDetector nativo: escaneá con la cámara nativa del teléfono (abre el enlace directo) o pegá el token abajo.'
      );
    }

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [cameraActive, stopCameraScanner, verifyTokenValue]);

  /**
   * Enciende o apaga la linterna (flash) de la cámara activa usando `track.applyConstraints`.
   * Si el dispositivo rechaza la restricción, oculta el control de linterna.
   */
  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track || typeof track.applyConstraints !== 'function') return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  };

  /**
   * Solicita permiso de cámara trasera (`facingMode: 'environment'`), detecta soporte de linterna
   * y habilita el visor en vivo; ante fallo o falta de soporte muestra mensaje orientativo.
   */
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
      const track = stream.getVideoTracks()[0];
      const caps = typeof track?.getCapabilities === 'function' ? track.getCapabilities() : null;
      setTorchSupported(Boolean(caps?.torch));
      setCameraActive(true);
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

  /**
   * Maneja el envío del formulario de validación manual o por pistola lectora de QR.
   * Detiene la cámara si estaba abierta y dispara la verificación contra el backend.
   * @param {React.FormEvent<HTMLFormElement>} [e]
   */
  const handleVerifyPass = async (e) => {
    if (e) e.preventDefault();
    if (!qrToken.trim()) return;
    stopCameraScanner();
    await verifyTokenValue(qrToken);
  };

  /**
   * Restablece el escáner completo: apaga cámara y limpia token, resultado y avisos de error.
   */
  const handleClearScanner = () => {
    stopCameraScanner();
    setQrToken('');
    setResult(null);
    setCameraError('');
  };

  // Extracción segura de los detalles del pase y del vehículo principal para las tarjetas de resultado
  const details = result?.details || {};
  const vehicleInfo =
    details.vehicle ||
    (Array.isArray(details.vehicles) && details.vehicles.length > 0 ? details.vehicles[0] : null) ||
    details;

  return (
    <div className={`${PAGE_SHELL_CLASS} flex-1`}>
      <main className="space-y-6">
        {/* Tarjeta principal con ícono sobrio alineado a la izquierda del título */}
        <section
          className={`${SECTION_CARD_CLASS} md:p-8 space-y-6`}
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
              <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
                <span className="font-bold flex items-center gap-1.5">
                  <Camera size={14} className="text-emerald-400" />
                  Cámara activa — Apuntá hacia el código QR
                </span>
                <div className="flex items-center gap-2">
                  {torchSupported && (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/15 text-[11px] font-bold cursor-pointer"
                      style={cardStyle}
                    >
                      <Flashlight size={12} className={torchOn ? 'text-amber-300' : 'opacity-70'} />
                      {torchOn ? 'Apagar luz' : 'Linterna'}
                    </button>
                  )}
                  <span className="text-[11px] font-mono opacity-75">
                    {detectorSupported ? 'Detección QR automática' : 'Vista previa de cámara'}
                  </span>
                </div>
              </div>
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-72 mx-auto w-full flex items-center justify-center border border-white/10">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Retícula guía de escaneo QR */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-2xl border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                </div>
              </div>
            </div>
          )}

          {/* Aviso de error o limitación de la cámara */}
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

          {/* Resultado de la validación en garita (tarjeta verde autorizado / roja denegado) */}
          {result && (
            <div
              className={`p-5 rounded-2xl border space-y-4 text-xs ${
                result.authorized
                  ? 'bg-emerald-950/35 border-emerald-700/80 text-emerald-100'
                  : 'bg-rose-950/40 border-rose-800/80 text-rose-100'
              }`}
            >
              {/* Encabezado de veredicto y código operativo retornado por el backend */}
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

              {/* Alerta específica cuando el rechazo responde a documentación de compliance vencida */}
              {!result.authorized &&
                ['CRIMINAL_RECORD_EXPIRED', 'INSURANCE_EXPIRED', 'CREW_INSURANCE_EXPIRED'].includes(
                  result.code
                ) && (
                  <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-700/80 text-rose-100 text-xs flex items-start gap-2">
                    <AlertCircle size={15} className="text-rose-300 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-bold">Bloqueo automático por compliance vencido</p>
                      <p className="opacity-90">
                        No permitir el ingreso hasta que el prestador renueve su documentación
                        obligatoria en TrustLink (este intento quedó auditado en garita).
                      </p>
                    </div>
                  </div>
                )}

              {/* Detalle completo del acceso autorizado: prestador, vehículo/destino y cuadrilla */}
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
                      {[vehicleInfo.brand, vehicleInfo.model, vehicleInfo.vehicle_type]
                        .filter(Boolean)
                        .join(' · ') || 'Sin vehículo asociado'}
                      {vehicleInfo.color ? ` (${vehicleInfo.color})` : ''}
                    </p>
                    {vehicleInfo.plate && (
                      <p className="text-sky-300 font-mono font-bold">Patente: {vehicleInfo.plate}</p>
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

                  {/* Bloque Cuadrilla / Ayudantes Autorizados en el Pase */}
                  <div
                    className="md:col-span-2 p-4 rounded-xl border border-white/15 space-y-2.5"
                    style={cardStyle}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                        <Users size={13} /> Cuadrilla / Ayudantes Autorizados (
                        {Array.isArray(details.authorized_employees)
                          ? details.authorized_employees.length
                          : 0}
                        )
                      </p>
                      <a
                        href={buildGateArrivalWhatsAppUrl(details, vehicleInfo)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
                      >
                        <MessageCircle size={13} />
                        Avisar arribo al Residente por WhatsApp
                      </a>
                    </div>

                    {Array.isArray(details.authorized_employees) &&
                    details.authorized_employees.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {details.authorized_employees.map((emp) => {
                          const art = getCrewArtStatus(emp.insurance_expiry);
                          return (
                            <div
                              key={emp.id || emp.dni || emp.full_name}
                              className="p-2.5 rounded-lg border border-white/10 flex items-center justify-between gap-2"
                              style={innerStyle}
                            >
                              <div className="min-w-0">
                                <p className="font-bold truncate">{emp.full_name}</p>
                                <p className="text-[11px] opacity-80">
                                  DNI: {emp.dni || 'No declarado'} · {emp.role_label || 'Ayudante'}
                                </p>
                              </div>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${art.cls}`}
                              >
                                {art.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs opacity-75">
                        Solo titular autorizado (sin ayudantes declarados en este pase).
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