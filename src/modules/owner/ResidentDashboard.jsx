/**
 * @file ResidentDashboard.jsx
 * @description Dashboard completo del Residente conectado 100% a la base de datos PostgreSQL mediante API REST.
 * Permite visualizar el directorio de prestadores verificados, buscar por especialidad y gestionar contratos/pases QR.
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
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Función para consumir el directorio real de prestadores aprobados desde la Base de Datos
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

  // Filtrar prestadores por término de búsqueda (nombre o especialidad)
  const filteredProviders = providers.filter((p) => {
    const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
    const specialty = (p.specialty || '').toLowerCase();
    const query = searchTerm.toLowerCase();
    return fullName.includes(query) || specialty.includes(query);
  });

  return (
    <div className="min-h-[calc(100vh-50px)] bg-slate-900 text-slate-100 font-sans p-8">
      {/* Cabecera del Portal */}
      <header className="bg-slate-950 border border-slate-800 px-8 py-6 rounded-2xl flex flex-col md:flex-row justify-between items-center shadow-xl mb-8 gap-4">
        <div className="flex items-center space-x-4">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-md" 
            style={{ backgroundColor: brand.primaryColor || '#10b981' }}
          >
            {brand.countryName ? brand.countryName.charAt(0) : 'TL'}
          </div>
          <div>
            <h1 className="text-xl font-black text-white">{brand.countryName || 'TrustLink Community'}</h1>
            <p className="text-xs text-slate-400">Portal del Residente — Red de Servicios Verificados</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs bg-emerald-950 border border-emerald-800 text-emerald-300 px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 shadow-sm">
            <ShieldCheck size={14} className="text-emerald-400" /> {user ? `${user.first_name} (${user.role})` : 'Lote Verificado'}
          </span>
          <button
            onClick={() => onViewChange && onViewChange('payments')}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
          >
            <QrCode size={14} /> Contratar y Generar QR
          </button>
        </div>
      </header>

      {/* Sección del Directorio de Prestadores */}
      <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 pb-4 border-b border-slate-800 gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Directorio de Prestadores Verificados</h2>
            <p className="text-xs text-slate-400">Profesionales con compliance aprobado en la base de datos de TrustLink.</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search size={16} className="absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar por nombre o especialidad..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <span className="text-xs bg-slate-900 border border-slate-800 text-slate-300 px-3 py-2 rounded-xl font-bold shrink-0">
              {filteredProviders.length} Disponibles
            </span>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-rose-950/50 border border-rose-800 text-rose-200 p-4 rounded-xl mb-6 text-xs flex items-center gap-2">
            <AlertCircle size={16} /> <span>{errorMsg}</span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-slate-400 text-sm">Consultando base de datos PostgreSQL...</div>
        ) : filteredProviders.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-sm">
            No hay prestadores aprobados que coincidan con la búsqueda en la base de datos.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProviders.map((p) => (
              <div key={p.provider_id} className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 flex flex-col justify-between gap-4 hover:border-slate-700 transition-all shadow-md">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-sm">{p.first_name} {p.last_name}</span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-bold uppercase">
                      {p.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 flex items-center gap-1.5 mb-2 font-medium">
                    <Wrench size={12} className="text-emerald-400" /> {p.specialty}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 mb-2">
                    <span className="flex items-center gap-1"><Phone size={11} /> {p.phone || 'S/N'}</span>
                    <span className="flex items-center gap-1"><Mail size={11} /> {p.email}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-amber-400 font-bold bg-amber-950/40 border border-amber-800/40 px-2 py-1 rounded-lg w-fit">
                    <Star size={13} className="fill-amber-400 text-amber-400" /> {Number(p.rating_avg || 0).toFixed(1)} de Reputación
                  </div>
                </div>
                <button
                  onClick={() => onViewChange && onViewChange('payments')}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl transition-all cursor-pointer shadow-md text-xs flex items-center justify-center gap-1.5"
                >
                  <QrCode size={14} /> Contratar y Generar QR
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}