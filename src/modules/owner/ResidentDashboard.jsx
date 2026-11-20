/**
 * @file ResidentDashboard.jsx
 * @description Portal del Residente conectado a PostgreSQL con aplicación explícita de
 * Zona 4 (tarjetas principales) y Zona 5 (cajas internas / buscador), emisión de pase QR
 * y acceso a contratación/pagos.
 * @location /trustlink-web/src/modules/owner/ResidentDashboard.jsx
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Star,
  QrCode,
  Search,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useBranding, DEFAULT_BRANDING_CONFIG } from '../branding/BrandingContext';
import { useAuth } from '../auth/AuthContext';

const API_BASE = 'http://localhost:4000';

export default function ResidentDashboard({ onViewChange }) {
  const { brand } = useBranding();
  const { user } = useAuth();

  const cardStyle = {
    backgroundColor: brand.cardBgColor || DEFAULT_BRANDING_CONFIG.cardBgColor,
    color: brand.cardTextColor || DEFAULT_BRANDING_CONFIG.cardTextColor,
  };

  const innerStyle = {
    backgroundColor: brand.innerBgColor || DEFAULT_BRANDING_CONFIG.innerBgColor,
    color: brand.innerTextColor || DEFAULT_BRANDING_CONFIG.innerTextColor,
  };

  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Estado modal emisión de pase QR
  const [qrModalProvider, setQrModalProvider] = useState(null);
  const [passForm, setPassForm] = useState({
    fraction_number: '',
    lot_number: '',
    valid_from: '',
    valid_to: '',
  });
  const [creatingPass, setCreatingPass] = useState(false);
  const [passFeedback, setPassFeedback] = useState({ type: '', text: '', token: '' });

  const fetchVerifiedProviders = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/providers/directory`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setProviders(data.providers || []);
      } else {
        setErrorMsg(data.error || 'No se pudo cargar el directorio de prestadores.');
      }
    } catch (error) {
      console.error('Error al conectar con la base de datos:', error);
      setErrorMsg('Error de conexión con el servidor backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerifiedProviders();
  }, []);

  const openQrModal = (provider) => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const toLocalInput = (d) => {
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
        d.getHours()
      )}:${pad(d.getMinutes())}`;
    };

    setQrModalProvider(provider);
    setPassFeedback({ type: '', text: '', token: '' });
    setPassForm({
      fraction_number: user?.fraction_number || '',
      lot_number: user?.lot_number || '',
      valid_from: toLocalInput(now),
      valid_to: toLocalInput(tomorrow),
    });
  };

  const handleCreatePass = async (e) => {
    e.preventDefault();
    if (!qrModalProvider) return;
    setCreatingPass(true);
    setPassFeedback({ type: '', text: '', token: '' });

    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
        body: JSON.stringify({
          provider_id: qrModalProvider.provider_id || qrModalProvider.id,
          fraction_number: passForm.fraction_number,
          lot_number: passForm.lot_number,
          valid_from: passForm.valid_from,
          valid_to: passForm.valid_to,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        const generatedToken = data.pass?.qr_token || data.qr_token || '';
        setPassFeedback({
          type: 'success',
          text: 'Pase QR emitido correctamente.',
          token: generatedToken,
        });
      } else {
        setPassFeedback({
          type: 'error',
          text: data.error || 'No se pudo emitir el pase QR.',
          token: '',
        });
      }
    } catch (error) {
      console.error('Error al emitir pase QR:', error);
      setPassFeedback({
        type: 'error',
        text: 'Error de conexión con el servidor al generar el pase QR.',
        token: '',
      });
    } finally {
      setCreatingPass(false);
    }
  };

  const filteredProviders = providers.filter((p) => {
    const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
    const specialty = (p.specialty || '').toLowerCase();
    const query = searchTerm.toLowerCase();
    return fullName.includes(query) || specialty.includes(query);
  });

  return (
    <div className="max-w-6xl w-full mx-auto px-4 md:px-8 py-6 space-y-6">
      {/* Zona 4: Tarjeta Cabecera del Portal Residente */}
      <section
        className="border border-black/20 px-6 py-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        style={cardStyle}
      >
        <div className="flex items-center space-x-3.5">
          {brand.logoUrl ? (
            <img
              src={brand.logoUrl}
              alt={brand.countryName || 'TrustLink'}
              className="w-12 h-12 rounded-xl object-contain p-1"
              style={innerStyle}
            />
          ) : (
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl border border-white/15"
              style={innerStyle}
            >
              {brand.countryName ? brand.countryName.charAt(0) : 'T'}
            </div>
          )}
          <div>
            <h2 className="text-xl font-black tracking-tight">
              {brand.countryName || 'TrustLink Community'}
            </h2>
            <p className="text-xs opacity-80">
              Portal Residente — Red de Servicios y Accesos Verificados
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {user && (
            <span
              className="text-xs px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 border border-white/15"
              style={innerStyle}
            >
              <ShieldCheck size={15} className="text-emerald-400" /> {user.first_name} ({user.role})
            </span>
          )}
          <button
            type="button"
            onClick={() => onViewChange && onViewChange('payments')}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <QrCode size={15} /> Contratar y Generar QR
          </button>
        </div>
      </section>

      {/* Zona 4: Barra del Directorio + Zona 5: Buscador */}
      <section
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-5 rounded-2xl border border-black/20"
        style={cardStyle}
      >
        <div>
          <h3 className="text-lg font-bold">Directorio de Prestadores Verificados</h3>
          <p className="text-xs opacity-80 mt-0.5">
            Profesionales auditados con compliance aprobado en TrustLink para ingreso por QR.
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <Search
            className="absolute left-3 top-2.5 opacity-70"
            size={15}
            style={innerStyle}
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre o especialidad..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs border border-black/20 focus:outline-none"
            style={innerStyle}
          />
        </div>
      </section>

      {errorMsg && (
        <div className="bg-rose-950/60 border border-rose-800 text-rose-200 p-4 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle size={16} /> <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div
          className="text-center py-14 rounded-2xl border border-black/20 text-xs"
          style={cardStyle}
        >
          Consultando directorio de prestadores...
        </div>
      ) : filteredProviders.length === 0 ? (
        <div
          className="text-center py-14 rounded-2xl border border-black/20 text-xs"
          style={cardStyle}
        >
          No hay prestadores aprobados que coincidan con la búsqueda.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProviders.map((p) => (
            <article
              key={p.provider_id || p.id}
              className="border border-black/20 p-5 rounded-2xl flex flex-col justify-between gap-5"
              style={cardStyle}
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border border-white/15 inline-block"
                      style={innerStyle}
                    >
                      {p.specialty || 'Servicios Generales'}
                    </span>
                    <h4 className="text-base font-bold mt-2">
                      {p.first_name} {p.last_name}
                    </h4>
                  </div>
                  <span
                    className="text-amber-300 font-bold text-xs px-2.5 py-1 rounded-lg border border-white/15 flex items-center gap-1 shrink-0"
                    style={innerStyle}
                  >
                    <Star size={12} className="fill-amber-400 text-amber-400" />{' '}
                    {Number(p.rating_avg || 0).toFixed(1)}
                  </span>
                </div>

                <p className="text-xs opacity-80">
                  {p.phone || 'Teléfono no especificado'} · {p.email}
                </p>
              </div>

              <div className="border-t border-black/20 pt-3.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold flex items-center gap-1 text-emerald-400">
                  <ShieldCheck size={14} /> Compliance OK
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openQrModal(p)}
                    className="text-xs font-bold px-3 py-2 rounded-xl border border-white/15 flex items-center gap-1 cursor-pointer"
                    style={innerStyle}
                  >
                    <QrCode size={13} /> Pase QR
                  </button>
                  <button
                    type="button"
                    onClick={() => onViewChange && onViewChange('payments')}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    Contratar
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal de Emisión de Pase QR por Prestador */}
      {qrModalProvider && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div
            className="max-w-md w-full rounded-2xl border border-black/25 p-6 space-y-4"
            style={cardStyle}
          >
            <div className="flex items-center justify-between border-b border-black/20 pb-3">
              <div>
                <h4 className="text-sm font-black">Emitir Pase QR</h4>
                <p className="text-[11px] opacity-80">
                  Prestador: {qrModalProvider.first_name} {qrModalProvider.last_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQrModalProvider(null)}
                className="p-1.5 rounded-lg border border-white/15 cursor-pointer"
                style={innerStyle}
              >
                <X size={14} />
              </button>
            </div>

            {passFeedback.text && (
              <div
                className={`p-3 rounded-xl text-xs border space-y-1.5 ${
                  passFeedback.type === 'success'
                    ? 'bg-emerald-950/60 border-emerald-700 text-emerald-200'
                    : 'bg-rose-950/60 border-rose-700 text-rose-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  {passFeedback.type === 'success' ? (
                    <CheckCircle2 size={15} />
                  ) : (
                    <AlertCircle size={15} />
                  )}
                  <span>{passFeedback.text}</span>
                </div>
                {passFeedback.token && (
                  <p className="font-mono text-[11px] break-all bg-black/30 p-2 rounded">
                    Token: {passFeedback.token}
                  </p>
                )}
              </div>
            )}

            <form onSubmit={handleCreatePass} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Fracción / Manzana</label>
                  <input
                    type="text"
                    value={passForm.fraction_number}
                    onChange={(e) =>
                      setPassForm((prev) => ({ ...prev, fraction_number: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-white/15"
                    style={innerStyle}
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Lote</label>
                  <input
                    type="text"
                    value={passForm.lot_number}
                    onChange={(e) =>
                      setPassForm((prev) => ({ ...prev, lot_number: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-white/15"
                    style={innerStyle}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Válido desde</label>
                  <input
                    type="datetime-local"
                    value={passForm.valid_from}
                    onChange={(e) =>
                      setPassForm((prev) => ({ ...prev, valid_from: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-white/15"
                    style={innerStyle}
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Válido hasta</label>
                  <input
                    type="datetime-local"
                    value={passForm.valid_to}
                    onChange={(e) =>
                      setPassForm((prev) => ({ ...prev, valid_to: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-white/15"
                    style={innerStyle}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQrModalProvider(null)}
                  className="px-4 py-2 rounded-xl font-bold border border-white/15 cursor-pointer"
                  style={innerStyle}
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={creatingPass}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold cursor-pointer disabled:opacity-50"
                >
                  {creatingPass ? 'Generando...' : 'Generar Pase QR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}