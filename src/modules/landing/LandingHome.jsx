/**
 * @file LandingHome.jsx
 * @description Vista pública de la raíz (/) para TrustLink optimizada con badge comercial refinado,
 * textos de alto impacto, diseño compacto above-the-fold, fondo 100% unificado en slate-950 y footer visible.
 * @location /trustlink-web/src/modules/landing/LandingHome.jsx
 */

import React from 'react';
import { ShieldCheck, QrCode, LogIn, UserPlus, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';

export default function LandingHome({ onViewChange }) {
  const { brand } = useBranding();

  return (
    <div className="bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white min-h-[calc(100vh-60px)] justify-between">
      
      {/* Contenido Principal / Hero Section */}
      <main className="max-w-5xl mx-auto px-6 py-10 text-center flex flex-col items-center w-full my-auto">
        
        {/* Badge Superior Institucional con texto comercial refinado */}
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-full text-emerald-400 text-xs font-bold tracking-wide uppercase mb-6 shadow-inner">
          <ShieldCheck size={16} />
          Acceso Perimetral Inteligente
        </div>

        {/* Título Principal Refinado (Simple y de Alto Impacto) */}
        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white max-w-4xl leading-tight mb-4">
          La red de confianza para <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">comunidades privadas</span>
        </h1>

        {/* Subtítulo Refinado (Directo al valor) */}
        <p className="text-xs md:text-sm text-slate-400 max-w-2xl leading-relaxed mb-10">
          Conectamos propietarios y prestadores auditados con accesos QR instantáneos y pagos protegidos de punta a punta.
        </p>

        {/* Tarjetas de Acceso Rápido (Grid Modular UX/UI) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-4xl mb-10">
          
          {/* Tarjeta 1: Iniciar Sesión */}
          <div className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 p-6 rounded-2xl shadow-xl flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 text-left">
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20 mb-4">
                <LogIn size={20} />
              </div>
              <h3 className="font-bold text-white text-base mb-1">¿Ya tienes cuenta?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Inicia sesión con tu rol asignado (Residente, Prestador, Seguridad o Superadmin).
              </p>
            </div>
            <button
              onClick={() => onViewChange('login')}
              className="mt-6 w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
            >
              Iniciar Sesión <ArrowRight size={14} />
            </button>
          </div>

          {/* Tarjeta 2: Registro */}
          <div className="bg-slate-900/90 border border-emerald-500/40 hover:border-emerald-500 p-6 rounded-2xl shadow-xl flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 font-black text-[9px] px-3 py-1 rounded-bl-xl uppercase tracking-wider">
              Nuevo Usuario
            </div>
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 mb-4">
                <UserPlus size={20} />
              </div>
              <h3 className="font-bold text-white text-base mb-1">Regístrate</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Crea tu perfil institucional como propietario, prestador o personal de guardia.
              </p>
            </div>
            <button
              onClick={() => onViewChange('register')}
              className="mt-6 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95"
              style={{ backgroundColor: brand.primaryColor || '#0A2540' }}
            >
              Crear Cuenta <ArrowRight size={14} />
            </button>
          </div>

          {/* Tarjeta 3: Consola Garita */}
          <div className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 p-6 rounded-2xl shadow-xl flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 text-left">
            <div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20 mb-4">
                <QrCode size={20} />
              </div>
              <h3 className="font-bold text-white text-base mb-1">Consola Garita</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Terminal ultrarrápida para validación perimetral y escaneo de pases QR.
              </p>
            </div>
            <button
              onClick={() => onViewChange('security')}
              className="mt-6 w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
            >
              Abrir Garita <ArrowRight size={14} />
            </button>
          </div>

        </div>

        {/* Badges de Características / Beneficios Inferiores */}
        <div className="inline-flex flex-wrap justify-center gap-5 bg-slate-900/60 border border-slate-800 px-6 py-3 rounded-2xl text-xs text-slate-300 shadow-lg">
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

      {/* Footer Institucional Integrado en la Landing */}
      <footer className="bg-slate-950 border-t border-slate-800 py-4 px-6 text-center text-xs text-slate-500 w-full">
        TrustLink Community Network — Nodo Central de Validación Perimetral y Compliance © 2026
      </footer>

    </div>
  );
}