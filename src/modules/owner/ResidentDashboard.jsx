/**
 * @file ResidentDashboard.jsx
 * @description Dashboard completo del Residente conectado 100% a la base de datos PostgreSQL mediante API REST.
 * Muestra el directorio de prestadores verificados, buscador inteligente y acceso rápido a contratos/pagos,
 * sin bloques redundantes y con visibilidad perfecta al cargar.
 * @location /trustlink-web/src/modules/owner/ResidentDashboard.jsx
 */

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Star, QrCode, Search, Wrench, AlertCircle, Phone, Mail } from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';
import { useAuth } from '../auth/AuthContext';

export default function ResidentDashboard({ onViewChange }) {
  const { brand } = useBranding();
  const { user } = useAuth();
  
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Consumir el directorio real de prestadores aprobados desde PostgreSQL
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
      console.error('Error al conectar con la base de datos:', error);
      setErrorMsg('Error de conexión con el servidor backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerifiedProviders();
  }, []);

  // Filtrado dinámico por nombre o especialidad
  const filteredProviders = providers.filter((p) => {
    const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
    const specialty = (p.specialty || '').toLowerCase();
    const query = searchTerm.toLowerCase();
    return fullName.includes(query) || specialty.includes(query);
  });

  return (
    <div className="bg-slate-900 text-slate-100 font-sans p-6 md:p-8">
      
      {/* Contenedor Principal del Directorio */}
      <main className="max-w-6xl mx-auto space-y-6">
        
        {/* Cabecera del Directorio y Buscador */}
        <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-black tracking-tight text-white">Directorio de Prestadores Verificados</h2>
            <p className="text-xs text-slate-400 mt-1">
              Profesionales auditados con compliance aprobado en la base de datos para ingreso seguro por QR.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Buscador Inteligente */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre o especialidad..."
                className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
              />
            </div>

            <button
              onClick={() => onViewChange && onViewChange('payments')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer shrink-0"
              style={{ backgroundColor: brand.primaryColor || '#10b981' }}
            >
              <QrCode size={14} /> Generar QR
            </button>
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
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2.5 py-0.5 rounded-md">
                      {p.specialty || 'Servicios Generales'}
                    </span>
                    <span className="text-amber-400 font-bold text-xs bg-amber-950/60 border border-amber-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Star size={11} className="fill-amber-400" /> {Number(p.rating_avg || 5.0).toFixed(1)}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white mb-2">{p.first_name} {p.last_name}</h3>
                  
                  <div className="space-y-1 text-[11px] text-slate-400 mb-3">
                    <p className="flex items-center gap-1.5"><Phone size={12} className="text-slate-500" /> {p.phone || 'Teléfono no especificado'}</p>
                    <p className="flex items-center gap-1.5"><Mail size={12} className="text-slate-500" /> {p.email}</p>
                  </div>
                </div>

                <div className="border-t border-slate-900 pt-3 flex justify-between items-center">
                  <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                    <ShieldCheck size={13} /> Compliance OK
                  </span>
                  <button
                    onClick={() => onViewChange && onViewChange('payments')}
                    className="text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm transition-transform active:scale-95 flex items-center gap-1 cursor-pointer bg-emerald-600 hover:bg-emerald-500"
                    style={{ backgroundColor: brand.primaryColor || '#10b981' }}
                  >
                    <QrCode size={13} /> Contratar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

    </div>
  );
}