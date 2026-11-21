/**
 * @file ResidentDashboard.jsx
 * @description Portal del Residente conectado 100% a la base de datos PostgreSQL mediante API REST.
 * Permite buscar prestadores verificados, emitir pases QR de acceso vinculados a cada prestador
 * y derivar al flujo de contratos y pagos con respiro limpio en la barra del directorio.
 * @location /trustlink-web/src/modules/owner/ResidentDashboard.jsx
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Star,
  QrCode,
  Search,
  AlertCircle,
  Briefcase,
  Phone,
  Mail,
  Copy,
  Check,
  X,
  Calendar,
  MapPin,
  Compass
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';
import { useAuth } from '../auth/AuthContext';

const API_BASE = 'http://localhost:4000';

/**
 * Formatea una fecha local compatible con input datetime-local (YYYY-MM-DDTHH:mm).
 * @param {Date} dateObj
 * @returns {string}
 */
function formatLocalDateTimeInput(dateObj) {
  const pad = (n) => String(n).padStart(2, '0');
  const year = dateObj.getFullYear();
  const month = pad(dateObj.getMonth() + 1);
  const day = pad(dateObj.getDate());
  const hours = pad(dateObj.getHours());
  const minutes = pad(dateObj.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function ResidentDashboard({ onViewChange }) {
  const { brand } = useBranding();
  const { user } = useAuth();

  // Estilos dinámicos derivados del contexto de marca global
  const cardStyle = brand?.cardBgColor
    ? {
        backgroundColor: brand.cardBgColor,
        color: brand.cardTextColor || undefined
      }
    : undefined;

  const innerStyle = brand?.innerBgColor
    ? {
        backgroundColor: brand.innerBgColor,
        color: brand.innerTextColor || undefined
      }
    : undefined;

  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Estado para emisión de pase QR vinculada al prestador seleccionado
  const [qrModalProvider, setQrModalProvider] = useState(null);
  const [fraction, setFraction] = useState('Fracción A');
  const [lotNumber, setLotNumber] = useState('Lote 12');
  const [startTime, setStartTime] = useState(() => formatLocalDateTimeInput(new Date()));
  const [endTime, setEndTime] = useState(() => {
    const plus4h = new Date(Date.now() + 4 * 60 * 60 * 1000);
    return formatLocalDateTimeInput(plus4h);
  });
  const [creatingPass, setCreatingPass] = useState(false);
  const [passError, setPassError] = useState('');
  const [generatedPass, setGeneratedPass] = useState(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`
  });

  // Obtiene el directorio de prestadores aprobados desde PostgreSQL
  const fetchVerifiedProviders = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/directory`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (response.ok) {
        setProviders(data.providers || []);
      } else {
        setErrorMsg(data.error || 'No se pudo cargar el directorio de prestadores.');
      }
    } catch (error) {
      console.error('Error de red al obtener prestadores:', error);
      setErrorMsg('Error de conexión con el servidor backend de TrustLink.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerifiedProviders();
  }, []);

  // Filtro dinámico por nombre o especialidad
  const filteredProviders = providers.filter((p) => {
    const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
    const specialty = (p.specialty || '').toLowerCase();
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return fullName.includes(query) || specialty.includes(query);
  });

  // Abre el modal de pase QR para un prestador específico
  const handleOpenQrModal = (provider) => {
    const now = new Date();
    const endDefault = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    setQrModalProvider(provider);
    setFraction(user?.fraction || 'Fracción A');
    setLotNumber(user?.lot_number || 'Lote 12');
    setStartTime(formatLocalDateTimeInput(now));
    setEndTime(formatLocalDateTimeInput(endDefault));
    setPassError('');
    setGeneratedPass(null);
    setCopiedToken(false);
  };

  // Crea el pase QR real en access_passes vía POST /api/v1/passes/create
  const handleCreatePass = async (e) => {
    e.preventDefault();
    if (!qrModalProvider) return;
    setCreatingPass(true);
    setPassError('');
    setGeneratedPass(null);

    try {
      const payload = {
        provider_id: qrModalProvider.provider_id,
        country_id: qrModalProvider.country_id || user?.country_id || 1,
        fraction: fraction.trim(),
        lot_number: lotNumber.trim(),
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString()
      };

      const response = await fetch(`${API_BASE}/api/v1/passes/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (response.ok) {
        setGeneratedPass(data.pass || data);
      } else {
        setPassError(data.error || 'No se pudo generar el pase QR.');
      }
    } catch (error) {
      console.error('Error al generar pase QR:', error);
      setPassError('Error de conexión con el servidor al emitir el pase.');
    } finally {
      setCreatingPass(false);
    }
  };

  const handleCopyToken = async (tokenValue) => {
    if (!tokenValue) return;
    try {
      await navigator.clipboard.writeText(tokenValue);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } catch (err) {
      console.error('No se pudo copiar el token:', err);
    }
  };

  return (
    <div className="bg-slate-900 text-slate-100 font-sans p-6 md:p-8 min-h-[calc(100vh-120px)]">
      <main className="max-w-6xl mx-auto space-y-6">
        {/* Barra del Directorio de Prestadores Verificados con respiro lateral limpio */}
        <div
          className="bg-slate-950 border border-slate-800 px-6 py-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
          style={cardStyle}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="p-3 rounded-xl border border-slate-700/80 text-emerald-400 shrink-0"
              style={innerStyle}
            >
              <Compass size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black tracking-tight text-white">
                Directorio de Prestadores Verificados
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Profesionales auditados con compliance aprobado para ingreso por QR o contratación directa.
              </p>
            </div>
          </div>

          {/* Buscador exclusivo en la barra del directorio */}
          <div className="relative w-full md:w-80 shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o especialidad..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              style={innerStyle}
            />
          </div>
        </div>

        {/* Mensaje de error si falla la consulta al backend */}
        {errorMsg && (
          <div className="bg-rose-950/60 border border-rose-800 text-rose-200 p-4 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Listado de prestadores verificados */}
        {loading ? (
          <div className="text-center py-16 text-slate-400 text-xs">
            Consultando base de datos PostgreSQL...
          </div>
        ) : filteredProviders.length === 0 ? (
          <div
            className="text-center py-16 bg-slate-950 border border-slate-800 rounded-2xl text-slate-400 text-xs"
            style={cardStyle}
          >
            No hay prestadores aprobados que coincidan con la búsqueda.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProviders.map((p) => {
              const totalJobs = Number(p.total_jobs || 0);
              return (
                <div
                  key={p.provider_id}
                  className="bg-slate-950 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl shadow-xl flex flex-col justify-between gap-5 transition-all"
                  style={cardStyle}
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/70 border border-emerald-800 px-2.5 py-0.5 rounded-md">
                        {p.specialty || 'Servicio Verificado'}
                      </span>
                      <span className="text-amber-400 font-bold text-xs bg-amber-950/70 border border-amber-800 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                        <Star size={11} className="fill-amber-400" />
                        {Number(p.rating_avg || 0).toFixed(1)}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white mb-1">
                      {p.first_name} {p.last_name}
                    </h3>

                    {/* Cantidad real de trabajos completados desde PostgreSQL */}
                    <p className="text-[11px] text-slate-300 font-medium mb-3 flex items-center gap-1.5">
                      <Briefcase size={12} className="text-emerald-400 shrink-0" />
                      <span>
                        {totalJobs} {totalJobs === 1 ? 'trabajo realizado' : 'trabajos realizados'}
                      </span>
                    </p>

                    <div className="space-y-1 text-[11px] text-slate-400 border-t border-slate-900 pt-2.5 rounded-lg">
                      <p className="flex items-center gap-1.5">
                        <Phone size={12} className="text-slate-500 shrink-0" />
                        <span>{p.phone || 'Teléfono no especificado'}</span>
                      </p>
                      <p className="flex items-center gap-1.5 break-all">
                        <Mail size={12} className="text-slate-500 shrink-0" />
                        <span>{p.email}</span>
                      </p>
                    </div>
                  </div>

                  {/* Acciones: Pase QR para ingreso y Contratar para contratos/pagos */}
                  <div className="border-t border-slate-900 pt-3 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 shrink-0">
                      <ShieldCheck size={13} /> Compliance OK
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenQrModal(p)}
                        className="bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                        style={innerStyle}
                      >
                        <QrCode size={13} className="text-emerald-400" />
                        Pase QR
                      </button>

                      <button
                        type="button"
                        onClick={() => onViewChange && onViewChange('payments')}
                        className="text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm transition-transform active:scale-95 flex items-center gap-1 cursor-pointer bg-emerald-600 hover:bg-emerald-500"
                        style={{ backgroundColor: brand?.primaryColor || '#10b981' }}
                      >
                        Contratar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal de Emisión de Pase QR vinculado al prestador */}
        {qrModalProvider && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div
              className="bg-slate-950 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5"
              style={cardStyle}
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    Autorización Perimetral — Pase QR
                  </span>
                  <h3 className="text-base font-black text-white mt-0.5">
                    {qrModalProvider.first_name} {qrModalProvider.last_name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {qrModalProvider.specialty || 'Prestador Verificado'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setQrModalProvider(null)}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                  aria-label="Cerrar modal"
                >
                  <X size={16} />
                </button>
              </div>

              {passError && (
                <div className="bg-rose-950/60 border border-rose-800 text-rose-200 p-3 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{passError}</span>
                </div>
              )}

              {generatedPass ? (
                <div className="space-y-4">
                  <div className="bg-emerald-950/40 border border-emerald-800 rounded-xl p-4 space-y-2 text-xs">
                    <p className="font-bold text-emerald-300">
                      Pase QR emitido correctamente (#{generatedPass.id || 'Nuevo'})
                    </p>
                    <p className="text-slate-300">
                      Ubicación: {generatedPass.fraction || fraction} · {generatedPass.lot_number || lotNumber}
                    </p>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 font-mono text-[11px] text-emerald-300 break-all">
                      {generatedPass.qr_token || generatedPass.token || 'Token generado'}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyToken(generatedPass.qr_token || generatedPass.token || '')
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 cursor-pointer"
                    >
                      {copiedToken ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      {copiedToken ? 'Copiado' : 'Copiar Token QR'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setQrModalProvider(null);
                        onViewChange && onViewChange('security');
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                    >
                      Probar en Garita
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreatePass} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                        <MapPin size={12} /> Fracción / Sector
                      </label>
                      <input
                        type="text"
                        required
                        value={fraction}
                        onChange={(e) => setFraction(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                        style={innerStyle}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        Lote / Unidad
                      </label>
                      <input
                        type="text"
                        required
                        value={lotNumber}
                        onChange={(e) => setLotNumber(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                        style={innerStyle}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                        <Calendar size={12} /> Inicio de Vigencia
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                        style={innerStyle}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                        <Calendar size={12} /> Fin de Vigencia
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                        style={innerStyle}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setQrModalProvider(null)}
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-bold cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={creatingPass}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                      style={{ backgroundColor: brand?.primaryColor || '#10b981' }}
                    >
                      <QrCode size={14} />
                      {creatingPass ? 'Generando...' : 'Emitir Pase QR'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}