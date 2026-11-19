/**
 * @file ResidentDashboard.jsx
 * @description Portal del Residente conectado 100% a PostgreSQL. Separa el buscador del directorio,
 * vincula la generación de pases QR (POST /api/v1/passes/create) a cada prestador y reserva
 * "Contratar" para el flujo de contratos y órdenes de pago.
 * @location /trustlink-web/src/modules/owner/ResidentDashboard.jsx
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Star,
  QrCode,
  Search,
  AlertCircle,
  Phone,
  Mail,
  Briefcase,
  X,
  Copy,
  CheckCircle2,
  FileCheck2
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';
import { useAuth } from '../auth/AuthContext';

export default function ResidentDashboard({ onViewChange }) {
  const { brand } = useBranding();
  const { user } = useAuth();

  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Estado para emisión de pase QR por prestador seleccionado
  const [selectedProviderForQr, setSelectedProviderForQr] = useState(null);
  const [fractionNumber, setFractionNumber] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [generatingQr, setGeneratingQr] = useState(false);
  const [qrErrorMsg, setQrErrorMsg] = useState('');
  const [generatedPass, setGeneratedPass] = useState(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const fetchVerifiedProviders = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch('http://localhost:4000/api/v1/providers/directory', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('trustlink_token') || ''}`
        }
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

  const toLocalDateTimeInput = (dateObj) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}T${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
  };

  const openQrModal = (provider) => {
    const now = new Date();
    const inFourHours = new Date(now.getTime() + 4 * 60 * 60 * 1000);

    setSelectedProviderForQr(provider);
    setFractionNumber(user?.fraction_number || '');
    setLotNumber(user?.lot_number || '');
    setStartTime(toLocalDateTimeInput(now));
    setEndTime(toLocalDateTimeInput(inFourHours));
    setQrErrorMsg('');
    setGeneratedPass(null);
    setCopiedToken(false);
  };

  const closeQrModal = () => {
    setSelectedProviderForQr(null);
    setQrErrorMsg('');
    setGeneratedPass(null);
    setCopiedToken(false);
  };

  const handleGeneratePass = async (e) => {
    e.preventDefault();
    if (!selectedProviderForQr) return;

    setGeneratingQr(true);
    setQrErrorMsg('');

    try {
      const response = await fetch('http://localhost:4000/api/v1/passes/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('trustlink_token') || ''}`
        },
        body: JSON.stringify({
          provider_id: selectedProviderForQr.provider_id,
          fraction_number: fractionNumber.trim() || null,
          lot_number: lotNumber.trim() || null,
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString()
        })
      });

      const data = await response.json();

      if (response.ok && data.pass) {
        setGeneratedPass(data.pass);
      } else {
        setQrErrorMsg(data.error || 'No se pudo generar el pase QR.');
      }
    } catch (error) {
      console.error('Error al generar pase QR:', error);
      setQrErrorMsg('Error de conexión con el servidor al emitir el pase QR.');
    } finally {
      setGeneratingQr(false);
    }
  };

  const handleCopyToken = async (tokenValue) => {
    try {
      await navigator.clipboard.writeText(tokenValue);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } catch (err) {
      console.error('No se pudo copiar el token:', err);
    }
  };

  const filteredProviders = providers.filter((p) => {
    const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
    const specialty = (p.specialty || '').toLowerCase();
    const query = searchTerm.toLowerCase();
    return fullName.includes(query) || specialty.includes(query);
  });

  return (
    <div className="min-h-[calc(100vh-50px)] bg-slate-900 text-slate-100 font-sans p-6 md:p-8">
      <main className="max-w-6xl mx-auto space-y-6">

        {/* Cabecera del Directorio con Buscador Independiente */}
        <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-black tracking-tight text-white">Directorio de Prestadores Verificados</h2>
            <p className="text-xs text-slate-400 mt-1">
              Profesionales auditados con compliance aprobado en la base de datos para contratación y autorización de ingreso por QR.
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o especialidad..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
            />
          </div>
        </div>

        {errorMsg && (
          <div className="bg-rose-950/50 border border-rose-800 text-rose-200 p-4 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle size={16} /> <span>{errorMsg}</span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-slate-400 text-xs">Consultando base de datos PostgreSQL...</div>
        ) : filteredProviders.length === 0 ? (
          <div className="text-center py-16 bg-slate-950 border border-slate-800 rounded-2xl text-slate-400 text-xs">
            No hay prestadores aprobados que coincidan con la búsqueda.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProviders.map((p) => (
              <div
                key={p.provider_id}
                className="bg-slate-950 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl shadow-xl flex flex-col justify-between gap-5 transition-all"
              >
                <div>
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2.5 py-0.5 rounded-md">
                      {p.specialty || 'Servicios Generales'}
                    </span>
                    <span className="text-amber-400 font-bold text-xs bg-amber-950/60 border border-amber-800 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                      <Star size={11} className="fill-amber-400" /> {Number(p.rating_avg || 5.0).toFixed(1)}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white mb-1">
                    {p.first_name} {p.last_name}
                  </h3>

                  <p className="text-[11px] text-emerald-400 font-medium mb-3 flex items-center gap-1">
                    <Briefcase size={12} /> {p.total_contracts || 0} contrataciones en la red
                  </p>

                  <div className="space-y-1 text-[11px] text-slate-400 mb-2">
                    <p className="flex items-center gap-1.5">
                      <Phone size={12} className="text-slate-500" /> {p.phone || 'Teléfono no especificado'}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Mail size={12} className="text-slate-500" /> {p.email}
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-900 pt-3 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 shrink-0">
                    <ShieldCheck size={13} /> Compliance OK
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openQrModal(p)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <QrCode size={13} /> Generar QR
                    </button>

                    <button
                      type="button"
                      onClick={() => onViewChange && onViewChange('payments')}
                      className="text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm transition-transform active:scale-95 flex items-center gap-1 cursor-pointer bg-emerald-600 hover:bg-emerald-500"
                      style={{ backgroundColor: brand.primaryColor || '#10b981' }}
                    >
                      <FileCheck2 size={13} /> Contratar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* Modal de Autorización de Ingreso y Emisión de Pase QR */}
      {selectedProviderForQr && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-md">
                  Autorización de Ingreso
                </span>
                <h3 className="text-base font-black text-white mt-1.5">
                  Pase QR para {selectedProviderForQr.first_name} {selectedProviderForQr.last_name}
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedProviderForQr.specialty || 'Prestador Verificado'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeQrModal}
                className="text-slate-400 hover:text-white bg-slate-900 border border-slate-800 p-1.5 rounded-xl cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {qrErrorMsg && (
              <div className="bg-rose-950/50 border border-rose-800 text-rose-200 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{qrErrorMsg}</span>
              </div>
            )}

            {generatedPass ? (
              <div className="space-y-4">
                <div className="bg-emerald-950/30 border border-emerald-700/60 p-4 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                    <CheckCircle2 size={16} /> Pase QR emitido en PostgreSQL (ID #{generatedPass.id})
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Token criptográfico único para validar en <strong>Consola Garita</strong>:
                  </p>
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl font-mono text-[11px] text-emerald-400 break-all">
                    {generatedPass.qr_token}
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyToken(generatedPass.qr_token)}
                    className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy size={14} /> {copiedToken ? 'Token Copiado' : 'Copiar Token QR'}
                  </button>

                  <button
                    type="button"
                    onClick={closeQrModal}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
                  >
                    Listo
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleGeneratePass} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Fracción</label>
                    <input
                      type="text"
                      value={fractionNumber}
                      onChange={(e) => setFractionNumber(e.target.value)}
                      placeholder="Ej: 4"
                      className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Lote</label>
                    <input
                      type="text"
                      value={lotNumber}
                      onChange={(e) => setLotNumber(e.target.value)}
                      placeholder="Ej: 15"
                      className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Válido Desde</label>
                    <input
                      type="datetime-local"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Válido Hasta</label>
                    <input
                      type="datetime-local"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl text-xs text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeQrModal}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={generatingQr}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <QrCode size={14} /> {generatingQr ? 'Emitiendo Pase...' : 'Emitir Pase QR'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}