/**
 * @file App.jsx
 * @description Enrutador principal de TrustLink Web con arquitectura modular y diseño minimalista
 * inspirado en los estándares de UX/UI de Mercado Libre.
 * @location /trustlink-web/src/App.jsx
 */

import React from 'react';
import { BrandingProvider, useBranding } from './modules/branding/BrandingContext';
import { ShieldCheck, Star, QrCode, Search } from 'lucide-react';

/**
 * Componente que simula el Dashboard del Residente con un enfoque visual limpio.
 */
const ResidentDashboardMock = () => {
  const { brand } = useBranding();

  return (
    <div className="min-h-screen bg-trust-surface text-trust-dark font-sans">
      {/* Barra de Navegación Superior */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center space-x-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md"
            style={{ backgroundColor: brand.primaryColor }}
          >
            {brand.countryName.charAt(0)}
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">{brand.countryName}</h1>
            <span className="text-xs text-gray-500">Portal de Servicios y Accesos Residenciales</span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-full flex items-center gap-1 shadow-sm">
            <ShieldCheck size={14} /> Lote 15 - Verificado
          </span>
          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700 shadow-inner">
            AV
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="max-w-7xl mx-auto px-8 py-8">
        {/* Barra de Búsqueda y Acciones Rápidas */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-trust-dark">Directorio de Prestadores</h2>
            <p className="text-gray-500 text-sm mt-1">Profesionales auditados con antecedentes penales y seguros al día.</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar electricista, plomero..." 
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-sm transition-all"
            />
          </div>
        </div>

        {/* Tarjeta de Prestador (Estilo optimizado para confianza) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                  Electricista Matriculado
                </span>
                <h3 className="text-lg font-bold mt-2 text-slate-800">Federico Gómez</h3>
              </div>
              <span className="text-amber-700 font-bold text-xs bg-amber-50 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                <Star size={14} className="fill-amber-400 text-amber-400" /> 4.9 (32)
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">
              Instalaciones tableros seccionales, urgencias 24hs y asistencia general en domicilios.
            </p>
            <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <ShieldCheck size={14} /> Compliance OK
              </span>
              <button 
                className="text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-md transition-transform active:scale-95 flex items-center gap-1.5"
                style={{ backgroundColor: brand.primaryColor }}
              >
                <QrCode size={14} /> Contratar y Generar QR
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <BrandingProvider>
      <ResidentDashboardMock />
    </BrandingProvider>
  );
}