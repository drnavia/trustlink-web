/**
 * @file ResidentDashboard.jsx
 * @description Portal del Residente conectado 100% a PostgreSQL mediante API REST.
 * Muestra prestadores verificados unificados por usuario, permite emitir pases QR vinculados
 * al prestador, derivar a Pagos y Reseñas, y respeta de forma homogénea las Zonas 3, 4 y 5.
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
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
  });

  // Obtiene el directorio unificado de prestadores aprobados desde PostgreSQL
  const fetchVerifiedProviders = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/directory`, {
        method: 'GET',
        headers: getAuthHeaders(),
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

  // Filtro dinámico por nombre o cualquiera de las especialidades consolidadas
  const filteredProviders = providers.filter((p) => {
    const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
    const specialtiesText = (
      p.specialties_label ||
      (Array.isArray(p.specialties) ? p.specialties.join(' ') : '') ||
      p.specialty ||
      ''
    ).toLowerCase();
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return fullName.includes(query) || specialtiesText.includes(query);
  });

  // Abre el modal de pase QR para el prestador seleccionado
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
        end_time: new Date(endTime).toISOString(),
      };

      const response = await fetch(`${API_BASE}/api/v1/passes/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
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
    <div className="p-6 md:p-8 flex-1">
      <main className="max-w-6xl mx-auto space-y-6">
        {/* Barra del Directorio de Prestadores Verificados */}
        <div
          className="border border-black/20 px-6 py-6 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
          style={cardStyle}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="p-3 rounded-xl border border-white/15 text-emerald-400 shrink-0"
              style={innerStyle}
            >
              <Compass size={20} strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black tracking-tight">
                Directorio de Prestadores Verificados
              </h2>
              <p className="text-xs opacity-80 mt-1">
                Profesionales auditados con compliance aprobado para ingreso por QR o contratación directa.
              </p>
            </div>
          </div>

          {/* Buscador exclusivo en la barra del directorio */}
          <div className="relative w-full md:w-80 shrink-0">
            <Search
              className="opacity-60 absolute left-3.5 top-1/2 -translate-y-1/2"
              size={16}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o especialidad..."
              className="w-full pl-10 pr-4 py-2.5 border border-white/15 rounded-xl text-xs focus:outline-none"
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

        {/* Listado de prestadores verificados unificados */}
        {loading ? (
          <div className="text-center py-16 opacity-80 text-xs">
            Consultando base de datos PostgreSQL...
          </div>
        ) : filteredProviders.length === 0 ? (
          <div
            className="text-center py-16 border border-black/20 rounded-2xl opacity-80 text-xs shadow-sm"
            style={cardStyle}
          >
            No hay prestadores aprobados que coincidan con la búsqueda.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProviders.map((p) => {
              const totalJobs = Number(p.total_jobs || 0);
              const specialtiesList =
                Array.isArray(p.specialties) && p.specialties.length > 0
                  ? p.specialties
                  : [p.specialty || 'Servicio Verificado'];

              return (
                <div
                  key={p.user_id || p.provider_id}
                  className="border border-black/20 p-5 rounded-2xl shadow-sm flex flex-col justify-between gap-5 transition-all"
                  style={cardStyle}
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {specialtiesList.map((spec) => (
                          <span
                            key={spec}
                            className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-950/70 border border-emerald-800 px-2 py-0.5 rounded-md"
                          >
                            {spec}
                          </span>
                        ))}
                      </div>

                      <span className="text-amber-300 font-bold text-xs bg-amber-950/70 border border-amber-800 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                        <Star size={11} className="fill-amber-400" />
                        {Number(p.rating_avg || 0).toFixed(1)}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold mb-1">
                      {p.first_name} {p.last_name}
                    </h3>

                    <p className="text-[11px] opacity-90 font-medium mb-3 flex items-center gap-1.5">
                      <Briefcase size={12} className="text-emerald-400 shrink-0" />
                      <span>
                        {totalJobs} {totalJobs === 1 ? 'trabajo realizado' : 'trabajos realizados'}
                      </span>
                    </p>

                    <div className="space-y-1 text-[11px] opacity-80 border-t border-black/20 pt-2.5">
                      <p className="flex items-center gap-1.5">
                        <Phone size={12} className="opacity-70 shrink-0" />
                        <span>{p.phone || 'Teléfono no especificado'}</span>
                      </p>
                      <p className="flex items-center gap-1.5 break-all">
                        <Mail size={12} className="opacity-70 shrink-0" />
                        <span>{p.email}</span>
                      </p>
                    </div>
                  </div>

                  {/* Acciones: Pase QR para ingreso y Contratar para contratos/pagos */}
                  <div className="border-t border-black/20 pt-3 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 shrink-0">
                      <ShieldCheck size={13} /> Compliance OK
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenQrModal(p)}
                        className="border border-white/15 text-xs font-bold px-3 py-2 rounded-xl transition-opacity hover:opacity-90 flex items-center gap-1.5 cursor-pointer"
                        style={innerStyle}
                      >
                        <QrCode size={13} className="text-emerald-400" />
                        Pase QR
                      </button>

                      <button
                        type="button"
                        onClick={() => onViewChange && onViewChange('payments')}
                        className="text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm transition-opacity hover:opacity-95 flex items-center gap-1 cursor-pointer"
                        style={{ backgroundColor: primaryActionColor }}
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
          <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
            <div
              className="border border-white/15 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5"
              style={cardStyle}
            >
              <div className="flex items-start justify-between gap-3 border-b border-black/20 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    Autorización Perimetral — Pase QR
                  </span>
                  <h3 className="text-base font-black mt-0.5">
                    {qrModalProvider.first_name} {qrModalProvider.last_name}
                  </h3>
                  <p className="text-xs opacity-80">
                    {qrModalProvider.specialties_label ||
                      qrModalProvider.specialty ||
                      'Prestador Verificado'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setQrModalProvider(null)}
                  className="p-1.5 rounded-lg border border-white/15 opacity-80 hover:opacity-100 cursor-pointer"
                  style={innerStyle}
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
                    <p className="opacity-90">
                      Ubicación: {generatedPass.fraction || fraction} ·{' '}
                      {generatedPass.lot_number || lotNumber}
                    </p>
                    <div
                      className="border border-white/15 rounded-lg p-2.5 font-mono text-[11px] text-emerald-300 break-all"
                      style={innerStyle}
                    >
                      {generatedPass.qr_token || generatedPass.token || 'Token generado'}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyToken(generatedPass.qr_token || generatedPass.token || '')
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-white/15 cursor-pointer"
                      style={innerStyle}
                    >
                      {copiedToken ? (
                        <Check size={14} className="text-emerald-400" />
                      ) : (
                        <Copy size={14} />
                      )}
                      {copiedToken ? 'Copiado' : 'Copiar Token QR'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setQrModalProvider(null);
                        onViewChange && onViewChange('security');
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
                      style={{ backgroundColor: primaryActionColor }}
                    >
                      Probar en Garita
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreatePass} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold opacity-80 mb-1 flex items-center gap-1">
                        <MapPin size={12} /> Fracción / Sector
                      </label>
                      <input
                        type="text"
                        required
                        value={fraction}
                        onChange={(e) => setFraction(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-white/15 focus:outline-none"
                        style={innerStyle}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold opacity-80 mb-1">
                        Lote / Unidad
                      </label>
                      <input
                        type="text"
                        required
                        value={lotNumber}
                        onChange={(e) => setLotNumber(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-white/15 focus:outline-none"
                        style={innerStyle}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold opacity-80 mb-1 flex items-center gap-1">
                        <Calendar size={12} /> Inicio de Vigencia
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-white/15 focus:outline-none"
                        style={innerStyle}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold opacity-80 mb-1 flex items-center gap-1">
                        <Calendar size={12} /> Fin de Vigencia
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-white/15 focus:outline-none"
                        style={innerStyle}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setQrModalProvider(null)}
                      className="px-4 py-2 rounded-xl border border-white/15 font-bold cursor-pointer"
                      style={innerStyle}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={creatingPass}
                      className="px-4 py-2 rounded-xl text-white font-bold disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                      style={{ backgroundColor: primaryActionColor }}
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