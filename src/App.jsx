/**
 * @file App.jsx
 * @description Enrutador y orquestador principal de TrustLink Web. Permite alternar mediante
 * un menú superior interactivo entre todos los módulos de la plataforma (Residente, Garita, Auth, Pagos y Admin).
 * @location /trustlink-web/src/App.jsx
 */

import React, { useState } from 'react';
import { BrandingProvider, useBranding } from './modules/branding/BrandingContext';
import SecurityScanner from './modules/security/SecurityScanner';
import LoginView from './modules/auth/LoginView';
import RegisterView from './modules/auth/RegisterView';
import ContractPaymentView from './modules/owner/ContractPaymentView';
import AdminComplianceView from './modules/admin/AdminComplianceView';
import { ShieldCheck, Star, QrCode, Search, Home, ShieldAlert, LogIn, UserPlus, CreditCard, UserCheck } from 'lucide-react';

/**
 * Componente del Dashboard del Residente con diseño UX/UI minimalista.
 */
const ResidentDashboard = ({ onViewChange }) => {
  const { brand } = useBranding();

  return (
    <div className="min-h-[calc(100vh-50px)] bg-slate-900 text-slate-100 font-sans">
      <header className="bg-slate-950 border-b border-slate-800 px-8 py-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center space-x-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md"
            style={{ backgroundColor: brand.primaryColor }}
          >
            {brand.countryName.charAt(0)}
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight text-white">{brand.countryName}</h1>
            <span className="text-xs text-slate-400">Portal de Servicios y Accesos Residenciales</span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
            <ShieldCheck size={14} className="text-emerald-400" /> Lote 15 - Verificado
          </span>
          <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200 shadow-inner">
            AV
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-white">Directorio de Prestadores</h2>
            <p className="text-slate-400 text-sm mt-1">Profesionales auditados con antecedentes penales y seguros al día.</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Buscar electricista, plomero..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm transition-all"
              />
            </div>
            <button
              onClick={() => onViewChange('payments')}
              className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            >
              <CreditCard size={16} /> Ver Pagos
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700 shadow-xl hover:border-slate-600 transition-all">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-300 bg-blue-950/60 border border-blue-800 px-2.5 py-1 rounded-lg">
                  Electricista Matriculado
                </span>
                <h3 className="text-lg font-bold mt-2 text-white">Federico Gómez</h3>
              </div>
              <span className="text-amber-300 font-bold text-xs bg-amber-950/60 border border-amber-800 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                <Star size={14} className="fill-amber-400 text-amber-400" /> 4.9 (32)
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Instalaciones tableros seccionales, urgencias 24hs y asistencia general en domicilios.
            </p>
            <div className="border-t border-slate-700/60 pt-4 flex justify-between items-center">
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <ShieldCheck size={14} /> Compliance OK
              </span>
              <button
                className="text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                style={{ backgroundColor: brand.primaryColor }}
                onClick={() => onViewChange('payments')}
              >
                <QrCode size={14} /> Contratar y Pagar
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default function App() {
  const [currentView, setCurrentView] = useState('resident'); // 'resident', 'security', 'payments', 'admin', 'login', 'register'

  return (
    <BrandingProvider>
      <div className="min-h-screen bg-slate-900 flex flex-col">
        {/* Barra de Navegación Superior / Selector de Vistas MVP */}
        <nav className="bg-slate-950 border-b border-slate-800 px-6 py-2.5 flex justify-center items-center gap-2 sticky top-0 z-50 shadow-2xl flex-wrap">
          <span className="text-xs text-slate-400 font-medium mr-2">Modo de Vista (MVP Demo):</span>
          <button
            onClick={() => setCurrentView('resident')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              currentView === 'resident' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Home size={14} /> Portal Residente
          </button>
          <button
            onClick={() => setCurrentView('security')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              currentView === 'security' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <ShieldAlert size={14} /> Consola Garita
          </button>
          <button
            onClick={() => setCurrentView('payments')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              currentView === 'payments' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <CreditCard size={14} /> Pagos
          </button>
          <button
            onClick={() => setCurrentView('admin')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              currentView === 'admin' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <UserCheck size={14} /> Panel Admin
          </button>
          <button
            onClick={() => setCurrentView('login')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              currentView === 'login' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <LogIn size={14} /> Iniciar Sesión
          </button>
          <button
            onClick={() => setCurrentView('register')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              currentView === 'register' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <UserPlus size={14} /> Registrarse
          </button>
        </nav>

        {/* Renderizado Condicional de la Vista Activa */}
        <div className="flex-grow">
          {currentView === 'resident' && <ResidentDashboard onViewChange={setCurrentView} />}
          {currentView === 'security' && <SecurityScanner />}
          {currentView === 'payments' && <ContractPaymentView />}
          {currentView === 'admin' && <AdminComplianceView />}
          {currentView === 'login' && <LoginView onLoginSuccess={(user) => { alert(`¡Bienvenido de nuevo, ${user.first_name}!`); setCurrentView('resident'); }} />}
          {currentView === 'register' && <RegisterView onRegisterSuccess={() => setCurrentView('login')} />}
        </div>
      </div>
    </BrandingProvider>
  );
}