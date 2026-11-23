/**
 * @file LandingHome.jsx
 * @description Vista pública de bienvenida (/) para TrustLink.
 * Incorpora propuesta de valor comercial directa, buscador rápido de servicios/rubros
 * con atajos por especialidad y accesos claros a Iniciar Sesión o Registrarse,
 * delegando el footer único al orquestador principal (App.jsx).
 * @location /trustlink-web/src/modules/landing/LandingHome.jsx
 */

import React, { useState } from 'react';
import {
  Search,
  ShieldCheck,
  QrCode,
  Star,
  ArrowRight,
  CheckCircle2,
  Wrench,
  Sparkles,
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';

const POPULAR_SERVICES = [
  'Electricista',
  'Gasista',
  'Plomero',
  'Jardinería',
  'Aire Acondicionado',
];

export default function LandingHome({ onGoLogin, onGoRegister }) {
  const { brand } = useBranding();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedService, setSelectedService] = useState('');

  const primaryColor = brand?.primaryActionColor || '#059669';

  const cardStyle = {
    backgroundColor: brand?.cardBgColor || '#020617',
    color: brand?.cardTextColor || '#F1F5F9',
  };

  const innerStyle = {
    backgroundColor: brand?.innerBgColor || '#0F172A',
    color: brand?.innerTextColor || '#E2E8F0',
  };

  // Guarda el filtro elegido en sessionStorage para aprovecharlo al ingresar
  // y dirige al flujo de acceso/registro correspondiente.
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const query = (searchTerm || selectedService || '').trim();
    if (query) {
      sessionStorage.setItem('trustlink_initial_service_query', query);
    } else {
      sessionStorage.removeItem('trustlink_initial_service_query');
    }
    onGoLogin();
  };

  const handleQuickServiceClick = (serviceName) => {
    setSelectedService(serviceName);
    setSearchTerm(serviceName);
    sessionStorage.setItem('trustlink_initial_service_query', serviceName);
  };

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-8">
      {/* Hero + Buscador Rápido estilo Marketplace de Servicios */}
      <div
        className="rounded-3xl p-6 sm:p-8 md:p-10 border border-slate-800/80 shadow-xl space-y-6"
        style={cardStyle}
      >
        <div className="space-y-3 max-w-3xl">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          >
            <Sparkles size={13} />
            <span>Servicios Verificados y Accesos Ágiles</span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
            Profesionales de confianza para tu comunidad
          </h1>

          <p className="text-sm sm:text-base opacity-80 leading-relaxed max-w-2xl">
            Encontrá prestadores verificados, generá pases QR en segundos y gestioná tus servicios
            con conformidad y calificación cruzada en un solo lugar.
          </p>
        </div>

        {/* Barra de búsqueda rápida de servicios */}
        <form onSubmit={handleSearchSubmit} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-60 pointer-events-none"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (selectedService && e.target.value !== selectedService) {
                    setSelectedService('');
                  }
                }}
                placeholder="¿Qué servicio necesitás? Ej: electricista, plomero, gasista..."
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm border border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                style={innerStyle}
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white shadow-md transition-opacity hover:opacity-95 cursor-pointer shrink-0"
              style={{ backgroundColor: primaryColor }}
            >
              <span>Buscar y Entrar</span>
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Chips de rubros frecuentes */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-semibold opacity-70 mr-1">Rubros:</span>
            {POPULAR_SERVICES.map((service) => {
              const isSelected = selectedService === service;
              return (
                <button
                  key={service}
                  type="button"
                  onClick={() => handleQuickServiceClick(service)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                      : 'border-slate-700/70 opacity-85 hover:opacity-100'
                  }`}
                  style={!isSelected ? innerStyle : undefined}
                >
                  {service}
                </button>
              );
            })}
          </div>
        </form>

        {/* Acciones principales de cuenta */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onGoRegister}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white transition-opacity hover:opacity-95 cursor-pointer"
            style={{ backgroundColor: primaryColor }}
          >
            <span>Crear cuenta</span>
            <ArrowRight size={15} />
          </button>

          <button
            type="button"
            onClick={onGoLogin}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border border-slate-700/80 transition-colors cursor-pointer"
            style={innerStyle}
          >
            <span>Ya tengo cuenta</span>
          </button>
        </div>
      </div>

      {/* Bloques Modulares de Valor (3 Pilares Clave) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className="rounded-2xl p-5 border border-slate-800/80 space-y-2.5"
          style={cardStyle}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center border border-slate-700/70"
            style={innerStyle}
          >
            <ShieldCheck size={19} className="text-emerald-400" />
          </div>
          <h2 className="text-base font-bold">Prestadores Verificados</h2>
          <p className="text-xs opacity-80 leading-relaxed">
            Perfiles con documentación y habilitaciones revisadas para contratar con tranquilidad.
          </p>
        </div>

        <div
          className="rounded-2xl p-5 border border-slate-800/80 space-y-2.5"
          style={cardStyle}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center border border-slate-700/70"
            style={innerStyle}
          >
            <QrCode size={19} className="text-emerald-400" />
          </div>
          <h2 className="text-base font-bold">Pases QR Ágiles</h2>
          <p className="text-xs opacity-80 leading-relaxed">
            Generá pases claros con vigencia y destino para agilizar el ingreso en el acceso.
          </p>
        </div>

        <div
          className="rounded-2xl p-5 border border-slate-800/80 space-y-2.5"
          style={cardStyle}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center border border-slate-700/70"
            style={innerStyle}
          >
            <Star size={19} className="text-emerald-400" />
          </div>
          <h2 className="text-base font-bold">Pagos y Reseñas Reales</h2>
          <p className="text-xs opacity-80 leading-relaxed">
            Confirmá el trabajo realizado, registrá el pago y calificá la experiencia de ambos lados.
          </p>
        </div>
      </div>

      {/* Cierre rápido de beneficios */}
      <div
        className="rounded-2xl px-5 py-4 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs"
        style={innerStyle}
      >
        <div className="flex flex-wrap items-center gap-4 opacity-90">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-400" />
            <span>Para residentes, prestadores y barrios</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Wrench size={14} className="text-emerald-400" />
            <span>Acuerdos claros y reputación cruzada</span>
          </span>
        </div>

        <button
          type="button"
          onClick={onGoLogin}
          className="font-bold underline underline-offset-4 hover:opacity-80 cursor-pointer"
        >
          Ingresar a la plataforma →
        </button>
      </div>
    </section>
  );
}