/**
 * @file LandingHome.jsx
 * @description Vista pública de la raíz (/) para TrustLink. Presenta la propuesta de valor corporativa,
 * llamadas a la acción claras (Login, Registro, Portal) y evita mostrar errores de token a usuarios anónimos.
 * @location /trustlink-web/src/modules/landing/LandingHome.jsx
 */
import React from 'react';
import { ShieldCheck, QrCode, LogIn, UserPlus, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';

export default function LandingHome({ onNavigate }) {
  const { brand } = useBranding();

  return (
    <div className="min-h-[calc(100vh-60px)] bg-slate-900 text-slate-100 flex flex-col justify-between font-sans">
      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-6 py-16 text-center space-y-8 my-auto">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm">
          <ShieldCheck size={16} /> Plataforma Criptográfica de Accesos y Servicios
        </div>

        <div className="space-y-4 max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-tight">
            Seguridad Perimetral y <span className="text-emerald-400">Prestadores Verificados</span>
          </h1>
          <p className="text-base md:text-lg text-slate-400 font-normal">
            Conectamos barrios cerrados y comunidades inteligentes bajo un estricto control de compliance, 
            ingresos ágiles por código QR y pasarela de pagos integrada para residentes.
          </p>
        </div>

        {/* Tarjetas de Acceso Rápido / Acciones E2E */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 max-w-3xl mx-auto">
          <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col justify-between text-left hover:border-slate-700 transition-all">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                <LogIn size={20} />
              </div>
              <h3 className="font-bold text-white text-lg">¿Ya tienes cuenta?</h3>
              <p className="text-xs text-slate-400">Inicia sesión con tu rol asignado (Residente, Prestador, Seguridad o Superadmin).</p>
            </div>
            <button
              onClick={() => onNavigate('login')}
              className="mt-6 w-full bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              Iniciar Sesión <ArrowRight size={14} />
            </button>
          </div>

          <div className="bg-slate-950 border border-emerald-500/30 p-6 rounded-2xl shadow-xl flex flex-col justify-between text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 text-[10px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider">
              Nuevo Usuario
            </div>
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <UserPlus size={20} />
              </div>
              <h3 className="font-bold text-white text-lg">Regístrate</h3>
              <p className="text-xs text-slate-400">Crea tu perfil institucional como propietario, prestador o personal de guardia.</p>
            </div>
            <button
              onClick={() => onNavigate('register')}
              className="mt-6 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer"
            >
              Crear Cuenta <ArrowRight size={14} />
            </button>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col justify-between text-left hover:border-slate-700 transition-all">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
                <QrCode size={20} />
              </div>
              <h3 className="font-bold text-white text-lg">Consola Garita</h3>
              <p className="text-xs text-slate-400">Terminal ultrarrápida para validación perimetral y escaneo de pases QR.</p>
            </div>
            <button
              onClick={() => onNavigate('security')}
              className="mt-6 w-full bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              Abrir Garita <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="pt-8 border-t border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4 text-left text-xs text-slate-400">
          <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> Compliance Automatizado</div>
          <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> Pases QR Criptográficos</div>
          <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> Take Rate Transaccional</div>
          <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> Multi-Country / Marca Blanca</div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 py-4 text-center text-xs text-slate-500">
        TrustLink Community Network — Nodo Central de Validación Perimetral © 2026
      </footer>
    </div>
  );
}