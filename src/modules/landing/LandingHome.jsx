/**
 * @file LandingHome.jsx
 * @description Vista pública de la raíz (/) para TrustLink con aplicación explícita de
 * Zona 4 (tarjetas de acceso rápido y barra de características) y Zona 5 (cajas/íconos internos),
 * delegando el footer único a App.jsx.
 * @location /trustlink-web/src/modules/landing/LandingHome.jsx
 */

import React from 'react';
import { ShieldCheck, QrCode, LogIn, UserPlus, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useBranding, DEFAULT_BRANDING_CONFIG } from '../branding/BrandingContext';

export default function LandingHome({ onViewChange }) {
  const { brand } = useBranding();

  const cardStyle = {
    backgroundColor: brand.cardBgColor || DEFAULT_BRANDING_CONFIG.cardBgColor,
    color: brand.cardTextColor || DEFAULT_BRANDING_CONFIG.cardTextColor,
  };

  const innerStyle = {
    backgroundColor: brand.innerBgColor || DEFAULT_BRANDING_CONFIG.innerBgColor,
    color: brand.innerTextColor || DEFAULT_BRANDING_CONFIG.innerTextColor,
  };

  const goTo = (target) => {
    if (typeof onViewChange === 'function') {
      onViewChange(target);
    }
  };

  return (
    <div className="flex-grow flex flex-col justify-center font-sans px-6 py-8">
      <main className="max-w-5xl mx-auto text-center flex flex-col items-center w-full">
        {/* Zona 4: Badge Superior Institucional */}
        <div
          className="inline-flex items-center gap-2 border border-black/20 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase mb-4"
          style={cardStyle}
        >
          <ShieldCheck size={15} className="text-emerald-400" />
          <span>{brand.countryName || 'TrustLink Community'} · Red de Servicios Verificados</span>
        </div>

        {/* Título Principal */}
        <h1 className="text-3xl md:text-5xl font-black tracking-tight max-w-4xl leading-tight mb-2.5">
          Seguridad Perimetral y{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
            Prestadores Verificados
          </span>
        </h1>

        {/* Subtítulo */}
        <p className="text-xs md:text-sm opacity-85 max-w-2xl leading-relaxed mb-6">
          Conectamos barrios cerrados y comunidades inteligentes bajo un estricto control de
          compliance, ingresos ágiles por código QR y pasarela de pagos integrada para residentes.
        </p>

        {/* Zona 4: Tarjetas de Acceso Rápido */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-4xl mb-6">
          {/* Tarjeta 1: Iniciar Sesión */}
          <div
            className="border border-black/20 p-5 rounded-2xl flex flex-col justify-between transition-transform duration-200 hover:-translate-y-0.5 text-left"
            style={cardStyle}
          >
            <div>
              <div
                className="w-10 h-10 rounded-xl text-blue-400 flex items-center justify-center border border-white/15 mb-3"
                style={innerStyle}
              >
                <LogIn size={19} />
              </div>
              <h2 className="font-bold text-base mb-1">¿Ya tenés cuenta?</h2>
              <p className="text-xs opacity-80 leading-relaxed">
                Iniciá sesión con tu rol asignado (Residente, Prestador, Seguridad o Superadmin).
              </p>
            </div>
            <button
              type="button"
              onClick={() => goTo('login')}
              className="mt-4 w-full border border-white/15 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-opacity hover:opacity-90 cursor-pointer"
              style={innerStyle}
            >
              Iniciar Sesión <ArrowRight size={14} />
            </button>
          </div>

          {/* Tarjeta 2: Registro */}
          <div
            className="border border-emerald-500/50 p-5 rounded-2xl flex flex-col justify-between transition-transform duration-200 hover:-translate-y-0.5 text-left relative overflow-hidden"
            style={cardStyle}
          >
            <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 font-black text-[9px] px-3 py-1 rounded-bl-xl uppercase tracking-wider">
              Nuevo Usuario
            </div>
            <div>
              <div
                className="w-10 h-10 rounded-xl text-emerald-400 flex items-center justify-center border border-white/15 mb-3"
                style={innerStyle}
              >
                <UserPlus size={19} />
              </div>
              <h2 className="font-bold text-base mb-1">Registrate</h2>
              <p className="text-xs opacity-80 leading-relaxed">
                Creá tu perfil institucional como propietario, prestador o personal de guardia.
              </p>
            </div>
            <button
              type="button"
              onClick={() => goTo('register')}
              className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              Crear Cuenta <ArrowRight size={14} />
            </button>
          </div>

          {/* Tarjeta 3: Consola Garita */}
          <div
            className="border border-black/20 p-5 rounded-2xl flex flex-col justify-between transition-transform duration-200 hover:-translate-y-0.5 text-left"
            style={cardStyle}
          >
            <div>
              <div
                className="w-10 h-10 rounded-xl text-purple-400 flex items-center justify-center border border-white/15 mb-3"
                style={innerStyle}
              >
                <QrCode size={19} />
              </div>
              <h2 className="font-bold text-base mb-1">Consola Garita</h2>
              <p className="text-xs opacity-80 leading-relaxed">
                Terminal ultrarrápida para validación perimetral y escaneo de pases QR.
              </p>
            </div>
            <button
              type="button"
              onClick={() => goTo('security')}
              className="mt-4 w-full border border-white/15 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-opacity hover:opacity-90 cursor-pointer"
              style={innerStyle}
            >
              Abrir Garita <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Zona 4: Badges de Características Inferiores */}
        <div
          className="inline-flex flex-wrap justify-center gap-5 border border-black/20 px-6 py-2.5 rounded-2xl text-xs"
          style={cardStyle}
        >
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" /> Compliance Automatizado
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" /> Pases QR Criptográficos
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" /> Take Rate Transaccional
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" /> Multi-Country / Marca Blanca
          </div>
        </div>
      </main>
    </div>
  );
}