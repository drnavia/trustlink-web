/**
 * @file ResidentDashboard.jsx
 * @description Dashboard completo del Residente conectado 100% a la base de datos PostgreSQL mediante API REST.
 * Permite visualizar el directorio de prestadores verificados, buscar por especialidad y gestionar contratos/pases QR.
 * @location /trustlink-web/src/modules/owner/ResidentDashboard.jsx
 */

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Star, QrCode, Search, Wrench, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';
import { useAuth } from '../auth/AuthContext';

export default function ResidentDashboard({ onViewChange }) {
  const { brand } = useBranding();
  const { user } = useAuth();
  
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

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
    <div className="min-h-[calc(100vh-50px)] bg-slate-900 text-slate-100 font-sans p-8">
      
      {/* Cabecera del Portal con Enfoque de Marketing Institucional */}
      <header className="bg-slate-950 border border-slate-800 px-8 py-8 rounded-3xl flex flex-col md:flex-row justify-between items-center shadow-2xl mb-8 gap-6">
        <div className="flex items-center space-x-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg"
            style={{ backgroundColor: brand.primaryColor || '#10b981' }}
          >
            {brand.countryName ? brand.countryName.charAt(0) : 'T'}
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">{brand.countryName || 'TrustLink Community'}</h1>
            <p className="text-xs text-slate-400 mt-0.5">Portal del Residente — Red de Servicios y Accesos Verificados</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <span className="text-xs bg-emerald-950 border border-emerald-800 text-emerald-300 px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 shadow-sm">
              <ShieldCheck size={16} className="text-emerald-400" /> {user.first_name} ({user.role})
            </span>
          )}
          <button
            onClick={() => onViewChange && onViewChange('payments')}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg cursor-pointer"
            style={{ backgroundColor: brand.primaryColor || '#10b981' }}
          >
            <QrCode size={16} /> Contratar y Generar QR
          </button>
        </div>
      </header>

      {/* Sección del Directorio */}
      <main className="max-w-6xl mx-auto space-y-6">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-950/60 p-6 rounded-2xl border border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white">Directorio de Prestadores Verificados</h2>
            <p className="text-xs text-slate-400 mt-1">
              Profesionales auditados con compliance aprobado en la base de datos de TrustLink para ingreso seguro por QR.
            </p>
          </div>

          {/* Buscador Inteligente */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o especialidad..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {errorMsg && (
          <div className="bg-rose-950/50 border border-rose-800 text-rose-200 p-4 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle size={16} /> <span>{errorMsg}</span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-slate-400 text-sm">Consultando base de datos PostgreSQL en tiempo real...</div>
        ) : filteredProviders.length === 0 ? (
          <div className="text-center py-20 bg-slate-950 border border-slate-800 rounded-2xl text-slate-400 text-xs">
            No hay prestadores aprobados que coincidan con la búsqueda en la base de datos.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProviders.map((p) => (
              <div
                key={p.provider_id}
                className="bg-slate-950 border border-slate-800 hover:border-slate-700 p-6 rounded-2xl shadow-xl flex flex-col justify-between gap-6 transition-all"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2.5 py-1 rounded-lg">
                        {p.specialty || 'Servicios Generales'}
                      </span>
                      <h3 className="text-base font-bold mt-2 text-white">{p.first_name} {p.last_name}</h3>
                    </div>
                    <span className="text-amber-400 font-bold text-xs bg-amber-950/60 border border-amber-800 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                      <Star size={12} className="fill-amber-400" /> {Number(p.rating_avg || 5.0).toFixed(1)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mb-4">
                    📞 {p.phone || 'Teléfono no especificado'} | ✉️ {p.email}
                  </p>
                </div>

                <div className="border-t border-slate-900 pt-4 flex justify-between items-center">
                  <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                    <ShieldCheck size={14} /> Compliance OK
                  </span>
                  <button
                    onClick={() => onViewChange && onViewChange('payments')}
                    className="text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-500"
                    style={{ backgroundColor: brand.primaryColor || '#10b981' }}
                  >
                    <QrCode size={14} /> Contratar y Generar QR
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