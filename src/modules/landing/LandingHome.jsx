/**
 * @file LandingHome.jsx
 * @description Vista pública de bienvenida (`/`) para TrustLink.
 * Presenta la narrativa comercial consolidada (compliance centralizado, propuesta de valor por actor
 * y eliminación del "efecto portón"), un buscador rápido de rubros con atajos predefinidos y los
 * accesos a Iniciar Sesión o Registrarse, delegando el pie de página único a `App.jsx`.
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
  Home,
  Briefcase,
  Building2,
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';

/** Rubros frecuentes mostrados como chips de selección rápida en el buscador del Hero. */
const POPULAR_SERVICES = [
  'Electricista',
  'Gasista',
  'Plomero',
  'Piletero',
  'Jardinería',
  'Aire Acondicionado',
];

/**
 * Propuesta de valor comercial segmentada para los tres actores del ecosistema TrustLink:
 * residentes, prestadores de servicios y administraciones/garitas de barrios cerrados.
 */
const ACTOR_BENEFITS = [
  {
    id: 'resident',
    icon: Home,
    badge: 'Residentes',
    title: 'Contratá sin depender de WhatsApp',
    points: [
      'Directorio verificado con DNI, antecedentes y ART/seguro vigentes.',
      'Pases QR en segundos con destino, franja horaria y ayudantes declarados.',
      'Historial del hogar con acuerdos claros y reseñas de vecinos reales.',
    ],
  },
  {
    id: 'provider',
    icon: Briefcase,
    badge: 'Prestadores',
    title: 'Terminá con el "efecto portón"',
    points: [
      'Una sola verificación centralizada válida para operar en toda la red.',
      'Flota vehicular y cuadrilla precargadas para evitar demoras en garita.',
      'Insignia de confianza y reputación acumulable frente a perfiles informales.',
    ],
  },
  {
    id: 'community',
    icon: Building2,
    badge: 'Barrios y Garitas',
    title: 'Accesos ágiles sin auditar antecedentes',
    points: [
      'Validación instantánea vía Consola Garita o API Universal por comunidad.',
      'Trazabilidad auditable de cada ingreso autorizado o denegado.',
      'Autonomía para aplicar suspensiones operativas locales cuando haga falta.',
    ],
  },
];

/**
 * Componente de página inicial pública (Landing) con theming dinámico provisto por `BrandingContext`.
 * @param {object} props Propiedades de navegación inyectadas por `App.jsx`.
 * @param {() => void} props.onGoLogin Callback para navegar a la vista de inicio de sesión.
 * @param {() => void} props.onGoRegister Callback para navegar a la vista de registro de cuenta.
 * @returns {JSX.Element} Sección completa de bienvenida comercial y acceso rápido.
 */
export default function LandingHome({ onGoLogin, onGoRegister }) {
  const { brand } = useBranding();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedService, setSelectedService] = useState('');

  // Estilos adaptables a la configuración de marca blanca activa (con paleta oscura por defecto).
  const primaryColor = brand?.primaryActionColor || '#059669';

  const cardStyle = {
    backgroundColor: brand?.cardBgColor || '#020617',
    color: brand?.cardTextColor || '#F1F5F9',
  };

  const innerStyle = {
    backgroundColor: brand?.innerBgColor || '#0F172A',
    color: brand?.innerTextColor || '#E2E8F0',
  };

  /**
   * Persiste en `sessionStorage` el servicio buscado para precargarlo tras la autenticación
   * y redirige al flujo de inicio de sesión.
   * @param {React.FormEvent<HTMLFormElement>} e Evento de envío del formulario de búsqueda.
   */
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

  /**
   * Selecciona un rubro popular desde los chips de atajo, sincroniza el campo de búsqueda
   * y guarda la preferencia en `sessionStorage` para el posterior ingreso del usuario.
   * @param {string} serviceName Nombre del rubro seleccionado.
   */
  const handleQuickServiceClick = (serviceName) => {
    setSelectedService(serviceName);
    setSearchTerm(serviceName);
    sessionStorage.setItem('trustlink_initial_service_query', serviceName);
  };

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-8">
      {/* Sección Hero: propuesta de valor principal, buscador rápido y botones de cuenta */}
      <div
        className="rounded-3xl p-6 sm:p-8 md:p-10 border border-slate-800/80 shadow-xl space-y-6"
        style={cardStyle}
      >
        {/* Encabezado comercial e insignia de posicionamiento */}
        <div className="space-y-3 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            <Sparkles size={13} />
            <span>Red Transversal de Servicios Verificados y Accesos QR</span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
            Servicios verificados y accesos sin fricción para tu comunidad
          </h1>

          <p className="text-sm sm:text-base opacity-80 leading-relaxed max-w-2xl">
            Dejá atrás las recomendaciones anárquicas por WhatsApp y las demoras en garita.
            Conectamos residentes, prestadores con documentación auditada y barrios cerrados con
            pases QR inteligentes y reputación cruzada.
          </p>
        </div>

        {/* Formulario de búsqueda rápida de rubros con atajos seleccionables */}
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
                placeholder="¿Qué servicio necesitás? Ej: electricista, piletero, gasista..."
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

          {/* Chips de atajo para rubros populares */}
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

        {/* Acciones primarias de acceso y alta de cuenta */}
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

      {/* Sección de 3 pilares diferenciales: Compliance, Accesos QR/API y Reputación Cruzada */}
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
          <h2 className="text-base font-bold">Compliance Centralizado</h2>
          <p className="text-xs opacity-80 leading-relaxed">
            DNI, antecedentes penales, póliza ART o accidentes personales, vehículos y cuadrilla
            auditados por TrustLink para operar con respaldo en toda la red.
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
          <h2 className="text-base font-bold">Pases QR y API para Garitas</h2>
          <p className="text-xs opacity-80 leading-relaxed">
            Emití pases digitales con vigencia horaria, destino, patente y ayudantes adjuntos. La
            garita valida identidad y habilitación en segundos.
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
          <h2 className="text-base font-bold">Reputación Cruzada Real</h2>
          <p className="text-xs opacity-80 leading-relaxed">
            Coordiná la visita dentro de la app, acordá el trabajo in situ, registrá conformidad y
            calificá la experiencia de ambos lados (residente ↔ prestador).
          </p>
        </div>
      </div>

      {/* Sección de beneficios segmentados por perfil (Residentes, Prestadores y Barrios/Garitas) */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg sm:text-xl font-black tracking-tight">
            Una misma red, valor concreto para cada actor
          </h2>
          <p className="text-xs sm:text-sm opacity-75">
            A diferencia de los sistemas cerrados de expensas, TrustLink conecta la economía de
            servicios con el control de accesos sin sobrecargar a la administración.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ACTOR_BENEFITS.map((actor) => {
            const Icon = actor.icon;
            return (
              <div
                key={actor.id}
                className="rounded-2xl p-5 border border-slate-800/80 space-y-3"
                style={cardStyle}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                    <Icon size={12} />
                    <span>{actor.badge}</span>
                  </span>
                </div>

                <h3 className="text-sm sm:text-base font-bold leading-snug">{actor.title}</h3>

                <ul className="space-y-2 text-xs opacity-85 leading-relaxed">
                  {actor.points.map((point) => (
                    <li key={point} className="flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Banda de cierre con resumen de diferenciadores y acceso directo a la plataforma */}
      <div
        className="rounded-2xl px-5 py-4 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs"
        style={innerStyle}
      >
        <div className="flex flex-wrap items-center gap-4 opacity-90">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-400" />
            <span>Identidad dual: operá como residente y/o prestador</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Wrench size={14} className="text-emerald-400" />
            <span>Cumplimiento auditable y trazabilidad en garita</span>
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
