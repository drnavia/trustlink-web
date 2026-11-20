/**
 * @file LandingHome.jsx
 * @description Vista pública de la raíz (/) para TrustLink. Delega el footer único al layout principal (App.jsx)
 * para evitar duplicidad al scrollear y mantener una composición limpia y visible.
 * @location /trustlink-web/src/modules/landing/LandingHome.jsx
 */

import React from 'react';
import { ShieldCheck, QrCode, LogIn, UserPlus, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';

export default function LandingHome({ onNavigate }) {
  const { brand } = useBranding();

  const goTo = (target) => {
    if (typeof onNavigate === 'function') {
      onNavigate(target);
    }
  };

  return (
    <div className="bg-slate-950 text-slate-100 flex flex-col justify-center font-sans selection:bg-emerald-500 selection:text-white px-6 py-6 md:py-8 min-h-[calc(100vh-118px)]">
      <main className="max-w-5xl mx-auto text-center flex flex-col items-center w-full">
        {/* Badge Superior Institucional */}
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-full text-emerald-400 text-xs font-bold tracking-wide uppercase mb-4 shadow-inner">
          <ShieldCheck size={15} />
          Plataforma Criptográfica de Accesos y Servicios — {brand.countryName || 'TrustLink Community'}
        </div>

        {/* Título Principal */}
        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white max-w-4xl leading-tight mb-2.5">
          Seguridad Perimetral y{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
            Prestadores Verificados
          </span>
        </h1>

        {/* Subtítulo */}
        <p className="text-xs md:text-sm text-slate-400 max-w-2xl leading-relaxed mb-6">
          Conectamos barrios cerrados y comunidades inteligentes bajo un estricto control de compliance, ingresos ágiles por código QR y pasarela de pagos integrada para residentes.
        </p>

        {/* Tarjetas de Acceso Rápido */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-4xl mb-6">
          {/* Tarjeta 1: Iniciar Sesión */}
          <div className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl shadow-xl flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5 text-left">
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20 mb-3">
                <LogIn size={19} />
              </div>
              <h3 className="font-bold text-white text-base mb-1">¿Ya tienes cuenta?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Inicia sesión con tu rol asignado (Residente, Prestador, Seguridad o Superadmin).
              </p>
            </div>
            <button
              type="button"
              onClick={() => goTo('login')}
              className="mt-4 w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
            >
              Iniciar Sesión <ArrowRight size={14} />
            </button>
          </div>

          {/* Tarjeta 2: Registro */}
          <div className="bg-slate-900/90 border border-emerald-500/40 hover:border-emerald-500 p-5 rounded-2xl shadow-xl flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5 text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 font-black text-[9px] px-3 py-1 rounded-bl-xl uppercase tracking-wider">
              Nuevo Usuario
            </div>
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 mb-3">
                <UserPlus size={19} />
              </div>
              <h3 className="font-bold text-white text-base mb-1">Regístrate</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Crea tu perfil institucional como propietario, prestador o personal de guardia.
              </p>
            </div>
            <button
              type="button"
              onClick={() => goTo('register')}
              className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95"
              style={{ backgroundColor: brand.primaryColor || '#059669' }}
            >
              Crear Cuenta <ArrowRight size={14} />
            </button>
          </div>

          {/* Tarjeta 3: Consola Garita */}
          <div className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl shadow-xl flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5 text-left">
            <div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20 mb-3">
                <QrCode size={19} />
              </div>
              <h3 className="font-bold text-white text-base mb-1">Consola Garita</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Terminal ultrarrápida para validación perimetral y escaneo de pases QR.
              </p>
            </div>
            <button
              type="button"
              onClick={() => goTo('security')}
              className="mt-4 w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
            >
              Abrir Garita <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Badges de Características Inferiores */}
        <div className="inline-flex flex-wrap justify-center gap-5 bg-slate-900/60 border border-slate-800 px-6 py-2.5 rounded-2xl text-xs text-slate-300 shadow-lg">
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