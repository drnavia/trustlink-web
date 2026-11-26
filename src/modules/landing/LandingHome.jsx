/**
 * @file LandingHome.jsx
 * @description Vista pública de bienvenida (`/`) para TrustLink (Landing v2).
 * Combina claridad de marketplace vivo (buscador inteligente por síntomas, franja de accesos
 * rápidos, vidriera pública en vivo sin exposición de PII y grilla visual de rubros con conteos
 * reales desde `/api/v1/providers/public-showcase`) con la estética institucional y marca blanca
 * de 6 zonas provista por `BrandingContext`.
 * @location /trustlink-web/src/modules/landing/LandingHome.jsx
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Zap,
  Droplets,
  Flame,
  Wind,
  Waves,
  Trees,
  Paintbrush,
  KeyRound,
  Clock,
  Lock,
  X,
  SlidersHorizontal,
  Award,
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';
import { API_BASE } from '../../config/api';
import {
  getSearchSuggestions,
  matchesProviderQuery,
  normalizeSearchText,
} from '../../utils/serviceSearchMatcher';
import ProviderTrustBadge, {
  TrustChecksStrip,
  TrustLevelsGuide,
} from '../../components/ProviderTrustBadge';
import { ReputationThermometer } from '../../components/HomeProtectedBadge';

/** Rubros frecuentes mostrados como atajos rápidos en el buscador del Hero. */
const POPULAR_SERVICES = [
  'Electricista',
  'Plomero',
  'Gasista',
  'Climatización',
  'Piletero',
  'Jardinería',
];

/** Catálogo visual base de rubros para la grilla de categorías (se enriquece con conteos reales de la red). */
const VISUAL_CATEGORIES = [
  {
    key: 'plomer',
    name: 'Plomero',
    query: 'Plomero',
    subtitle: 'Pérdidas, cañerías y sanitarios',
    Icon: Droplets,
    accentClass: 'text-sky-400',
  },
  {
    key: 'electric',
    name: 'Electricista',
    query: 'Electricista',
    subtitle: 'Tableros, térmicas e iluminación',
    Icon: Zap,
    accentClass: 'text-amber-400',
  },
  {
    key: 'gasist',
    name: 'Gasista',
    query: 'Gasista',
    subtitle: 'Estufas, termotanques y calderas',
    Icon: Flame,
    accentClass: 'text-orange-400',
  },
  {
    key: 'climat',
    name: 'Climatización',
    query: 'Climatización',
    subtitle: 'Aires split y calefacción',
    Icon: Wind,
    accentClass: 'text-cyan-400',
  },
  {
    key: 'pilet',
    name: 'Piletero',
    query: 'Piletero',
    subtitle: 'Mantenimiento, filtros y bombas',
    Icon: Waves,
    accentClass: 'text-teal-400',
  },
  {
    key: 'jardin',
    name: 'Jardinería',
    query: 'Jardinería',
    subtitle: 'Poda, césped, riego y parques',
    Icon: Trees,
    accentClass: 'text-emerald-400',
  },
  {
    key: 'pinto',
    name: 'Pintor y Obra',
    query: 'Pintor',
    subtitle: 'Pintura, humedad y durlock',
    Icon: Paintbrush,
    accentClass: 'text-violet-400',
  },
  {
    key: 'cerraj',
    name: 'Cerrajería',
    query: 'Cerrajero',
    subtitle: 'Cerraduras, llaves y portones',
    Icon: KeyRound,
    accentClass: 'text-rose-400',
  },
];

/** Etiquetas legibles de política de presupuesto para las tarjetas públicas. */
const QUOTE_POLICY_LABELS = {
  sin_cargo: 'Presupuesto sin cargo',
  descontable: 'Visita descontable',
  arancelada: 'Visita arancelada',
  consultar: 'Presupuesto a consultar',
};

/** Etiquetas legibles de facturación para las tarjetas públicas. */
const INVOICE_LABELS = {
  factura_a: 'Factura A',
  factura_b: 'Factura B',
  factura_c: 'Factura C',
  monotributo: 'Monotributo',
  consultar: null,
};

/** Propuesta de valor segmentada para los tres actores del ecosistema TrustLink. */
const ACTOR_BENEFITS = [
  {
    id: 'resident',
    icon: Home,
    badge: 'Residentes',
    title: 'Contratá sin depender de WhatsApp',
    points: [
      'Directorio verificado con DNI, ART/seguro y antecedentes vigentes.',
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
 * Componente de página inicial pública (Landing v2) con vidriera conectada en vivo
 * y theming dinámico de 6 zonas provisto por `BrandingContext`.
 *
 * @param {object} props Propiedades de navegación inyectadas por `App.jsx`.
 * @param {() => void} props.onGoLogin Callback para navegar a la vista de inicio de sesión.
 * @param {() => void} props.onGoRegister Callback para navegar a la vista de registro de cuenta.
 * @returns {JSX.Element} Portada pública comercial e interactiva de TrustLink.
 */
export default function LandingHome({ onGoLogin, onGoRegister }) {
  const { brand } = useBranding();
  const showcaseRef = useRef(null);
  const actorsRef = useRef(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [showcaseFilter, setShowcaseFilter] = useState('all'); // 'all' | 'verified' | 'socio' | 'emergencies'
  const [showAllShowcase, setShowAllShowcase] = useState(false);
  const [showTrustGuide, setShowTrustGuide] = useState(false);

  // Datos vivos de la vidriera pública (sin PII)
  const [showcaseProviders, setShowcaseProviders] = useState([]);
  const [showcaseCategories, setShowcaseCategories] = useState([]);
  const [networkSummary, setNetworkSummary] = useState(null);
  const [loadingShowcase, setLoadingShowcase] = useState(true);

  const isDark = brand?.darkMode !== false;
  const primaryColor = brand?.primaryActionColor || '#059669';

  const cardStyle = {
    backgroundColor: brand?.cardBgColor || '#020617',
    color: brand?.cardTextColor || '#F1F5F9',
  };

  const innerStyle = {
    backgroundColor: brand?.innerBgColor || '#0F172A',
    color: brand?.innerTextColor || '#E2E8F0',
  };

  const borderTone = isDark ? 'border-white/10' : 'border-slate-300/80';
  const subtleBorder = isDark ? 'border-white/15' : 'border-slate-300';

  // Cargar la vidriera pública al montar la Landing (fail-safe: si no hay red, mantiene la landing funcional)
  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/api/v1/providers/public-showcase?limit=24`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setShowcaseProviders(Array.isArray(data.providers) ? data.providers : []);
        setShowcaseCategories(Array.isArray(data.categories) ? data.categories : []);
        setNetworkSummary(data.summary || null);
      })
      .catch(() => {
        // Silencioso en caso de desconexión temporal
      })
      .finally(() => {
        if (active) setLoadingShowcase(false);
      });
    return () => {
      active = false;
    };
  }, []);

  /** Desplaza suavemente hacia la sección indicada por ref. */
  const scrollToSection = (sectionRef) => {
    sectionRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /** Guarda una intención de búsqueda/servicio para retomarla inmediatamente al autenticarse. */
  const persistIntentAndLogin = (queryText = '') => {
    const cleanQuery = String(queryText || searchTerm || selectedService || '').trim();
    try {
      if (cleanQuery) {
        sessionStorage.setItem('trustlink_initial_service_query', cleanQuery);
      } else {
        sessionStorage.removeItem('trustlink_initial_service_query');
      }
    } catch {
      // Ignorar si sessionStorage no está disponible
    }
    onGoLogin();
  };

  /** Abre el registro preseleccionando el rol deseado (`owner` o `provider`). */
  const goRegisterWithRole = (targetRole = 'owner') => {
    try {
      sessionStorage.setItem('trustlink_initial_register_role', targetRole);
    } catch {
      // Ignorar si sessionStorage no está disponible
    }
    onGoRegister();
  };

  /** Envía el buscador: filtra la vidriera en vivo y desplaza hacia los resultados sin forzar login. */
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const query = (searchTerm || selectedService || '').trim();
    try {
      if (query) {
        sessionStorage.setItem('trustlink_initial_service_query', query);
      } else {
        sessionStorage.removeItem('trustlink_initial_service_query');
      }
    } catch {
      // Ignorar
    }
    if (showcaseProviders.length > 0) {
      setShowAllShowcase(false);
      scrollToSection(showcaseRef);
    } else {
      onGoLogin();
    }
  };

  /** Selecciona un rubro rápido desde los chips o la grilla de categorías y filtra la vidriera. */
  const handleQuickServiceSelect = (serviceName, shouldScroll = false) => {
    const isToggleOff = selectedService === serviceName && searchTerm === serviceName;
    const nextValue = isToggleOff ? '' : serviceName;
    setSelectedService(nextValue);
    setSearchTerm(nextValue);
    setShowAllShowcase(false);
    try {
      if (nextValue) {
        sessionStorage.setItem('trustlink_initial_service_query', nextValue);
      } else {
        sessionStorage.removeItem('trustlink_initial_service_query');
      }
    } catch {
      // Ignorar
    }
    if (shouldScroll && nextValue) {
      scrollToSection(showcaseRef);
    }
  };

  const resetShowcaseFilters = () => {
    setSearchTerm('');
    setSelectedService('');
    setShowcaseFilter('all');
    setShowAllShowcase(false);
  };

  // Sugerencias inteligentes por síntoma/problema cotidiano
  const symptomSuggestions = useMemo(() => getSearchSuggestions(searchTerm), [searchTerm]);

  // Contadores de filtros rápidos de la vidriera
  const showcaseCounts = useMemo(() => {
    const counts = { all: showcaseProviders.length, verified: 0, socio: 0, emergencies: 0 };
    showcaseProviders.forEach((p) => {
      if (p.is_verified && !p.has_expired_docs) counts.verified += 1;
      if (Number(p.trust_level) === 5 && !p.has_expired_docs) counts.socio += 1;
      if (p.accepts_emergencies && !p.has_expired_docs) counts.emergencies += 1;
    });
    return counts;
  }, [showcaseProviders]);

  // Filtrado en vivo de la vidriera pública según texto/síntoma y chip de nivel/urgencia
  const filteredShowcase = useMemo(() => {
    return showcaseProviders.filter((prov) => {
      if (showcaseFilter === 'verified' && (!prov.is_verified || prov.has_expired_docs)) {
        return false;
      }
      if (showcaseFilter === 'socio' && (Number(prov.trust_level) !== 5 || prov.has_expired_docs)) {
        return false;
      }
      if (showcaseFilter === 'emergencies' && (!prov.accepts_emergencies || prov.has_expired_docs)) {
        return false;
      }
      if (searchTerm.trim() && !matchesProviderQuery(prov, searchTerm)) {
        return false;
      }
      return true;
    });
  }, [showcaseProviders, showcaseFilter, searchTerm]);

  const visibleShowcaseCards = showAllShowcase ? filteredShowcase : filteredShowcase.slice(0, 6);
  const hasActiveFilters = Boolean(searchTerm.trim() || showcaseFilter !== 'all');

  // Enriquecer la grilla visual de categorías con conteos reales desde el backend
  const enrichedCategories = useMemo(() => {
    return VISUAL_CATEGORIES.map((cat) => {
      let totalCount = 0;
      let verifiedCount = 0;
      showcaseCategories.forEach((sc) => {
        const norm = normalizeSearchText(sc.name);
        if (norm.includes(cat.key) || (cat.key === 'climat' && norm.includes('aire'))) {
          totalCount += Number(sc.total_count || 0);
          verifiedCount += Number(sc.verified_count || 0);
        }
      });
      return { ...cat, totalCount, verifiedCount };
    });
  }, [showcaseCategories]);

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-7 md:py-10 space-y-8">
      {/* 1. HERO COMPACTO ORIENTADO A BÚSQUEDA Y DESCUBRIMIENTO (sin botones duplicados con el navbar) */}
      <div
        className={`rounded-3xl p-6 sm:p-8 md:p-9 border ${borderTone} shadow-xl space-y-5`}
        style={cardStyle}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            <Sparkles size={13} />
            <span>Red Transversal de Servicios Verificados y Accesos QR</span>
          </div>

          {networkSummary && networkSummary.total_active_providers > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold opacity-85">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${subtleBorder}`}
                style={innerStyle}
              >
                <ShieldCheck size={12} className="text-emerald-400" />
                <span>
                  {networkSummary.verified_providers > 0
                    ? `${networkSummary.verified_providers} verificado(s) con Pase QR`
                    : `${networkSummary.total_active_providers} prestador(es) en red`}
                </span>
              </span>
              {networkSummary.total_communities > 0 && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${subtleBorder}`}
                  style={innerStyle}
                >
                  <Building2 size={12} className="text-sky-400" />
                  <span>{networkSummary.total_communities} comunidad(es) conectadas</span>
                </span>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2.5 max-w-3xl">
          <h1 className="text-2xl sm:text-4xl md:text-[2.75rem] font-black tracking-tight leading-tight">
            Servicios verificados y accesos sin fricción para tu comunidad
          </h1>
          <p className="text-sm sm:text-base opacity-80 leading-relaxed max-w-2xl">
            Explorá prestadores auditados por DNI, póliza ART y antecedentes antes de registrarte.
            Cuando estés listo, coordiná la visita y emití tu Pase QR para garita en segundos.
          </p>
        </div>

        {/* Buscador inteligente en vivo por síntoma, problema o rubro */}
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
                placeholder="¿Qué necesitás resolver? Ej: pérdida de agua, salta la térmica, piletero..."
                className={`w-full pl-10 pr-9 py-3 rounded-xl text-sm border ${subtleBorder} focus:outline-none focus:ring-2 focus:ring-emerald-500/60`}
                style={innerStyle}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedService('');
                  }}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg opacity-65 hover:opacity-100 cursor-pointer"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white shadow-md transition-opacity hover:opacity-95 cursor-pointer shrink-0"
              style={{ backgroundColor: primaryColor }}
            >
              <span>Ver prestadores</span>
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Sugerencias inteligentes por síntoma mientras el visitante escribe */}
          {symptomSuggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-emerald-400">Sugerencias:</span>
              {symptomSuggestions.map((sug) => (
                <button
                  key={sug.label}
                  type="button"
                  onClick={() => handleQuickServiceSelect(sug.targetSpecialty, true)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                >
                  {sug.label} → <strong>{sug.targetSpecialty}</strong>
                </button>
              ))}
            </div>
          )}

          {/* Atajos rápidos de rubros populares */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] font-semibold opacity-70 mr-1">Búsquedas frecuentes:</span>
            {POPULAR_SERVICES.map((service) => {
              const isSelected = selectedService === service;
              return (
                <button
                  key={service}
                  type="button"
                  onClick={() => handleQuickServiceSelect(service, true)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                      : `${subtleBorder} opacity-85 hover:opacity-100`
                  }`}
                  style={!isSelected ? innerStyle : undefined}
                >
                  {service}
                </button>
              );
            })}
          </div>
        </form>
      </div>

      {/* 2. FRANJA DE 4 ACCESOS RÁPIDOS POR INTENCIÓN (inspirada en la tira de tarjetas de MeLi) */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div
            className={`rounded-2xl p-4 border ${borderTone} flex flex-col justify-between gap-3`}
            style={cardStyle}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold">Soy Residente</span>
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center border ${subtleBorder}`}
                  style={innerStyle}
                >
                  <Home size={15} className="text-emerald-400" />
                </div>
              </div>
              <p className="text-xs opacity-75 leading-relaxed">
                Buscá prestadores con documentación al día, coordiná visita y emití Pases QR.
              </p>
            </div>
            <button
              type="button"
              onClick={() => scrollToSection(showcaseRef)}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold border ${subtleBorder} hover:opacity-90 cursor-pointer flex items-center justify-center gap-1.5`}
              style={innerStyle}
            >
              <span>Explorar vidriera</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div
            className={`rounded-2xl p-4 border ${borderTone} flex flex-col justify-between gap-3`}
            style={cardStyle}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold">Soy Prestador</span>
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center border ${subtleBorder}`}
                  style={innerStyle}
                >
                  <Briefcase size={15} className="text-amber-400" />
                </div>
              </div>
              <p className="text-xs opacity-75 leading-relaxed">
                Validá tu DNI, póliza ART y antecedentes una sola vez y recibí consultas de toda la red.
              </p>
            </div>
            <button
              type="button"
              onClick={() => goRegisterWithRole('provider')}
              className="w-full py-2 px-3 rounded-xl text-xs font-bold text-white hover:opacity-95 cursor-pointer flex items-center justify-center gap-1.5"
              style={{ backgroundColor: primaryColor }}
            >
              <span>Postularme gratis</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div
            className={`rounded-2xl p-4 border ${borderTone} flex flex-col justify-between gap-3`}
            style={cardStyle}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold">Barrios y Garitas</span>
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center border ${subtleBorder}`}
                  style={innerStyle}
                >
                  <QrCode size={15} className="text-sky-400" />
                </div>
              </div>
              <p className="text-xs opacity-75 leading-relaxed">
                Validación perimetral por QR o API en segundos con trazabilidad y control local.
              </p>
            </div>
            <button
              type="button"
              onClick={() => scrollToSection(actorsRef)}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold border ${subtleBorder} hover:opacity-90 cursor-pointer flex items-center justify-center gap-1.5`}
              style={innerStyle}
            >
              <span>Ver beneficios</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div
            className={`rounded-2xl p-4 border ${borderTone} flex flex-col justify-between gap-3`}
            style={cardStyle}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold">Niveles N1 a N5</span>
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center border ${subtleBorder}`}
                  style={innerStyle}
                >
                  <ShieldCheck size={15} className="text-emerald-400" />
                </div>
              </div>
              <p className="text-xs opacity-75 leading-relaxed">
                Conocé cómo diferenciamos perfiles básicos, verificados con QR y Socios N5.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowTrustGuide((prev) => !prev)}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                showTrustGuide
                  ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
                  : `${subtleBorder} hover:opacity-90`
              }`}
              style={!showTrustGuide ? innerStyle : undefined}
            >
              <span>{showTrustGuide ? 'Ocultar escala' : 'Ver escala N1–N5'}</span>
            </button>
          </div>
        </div>

        {/* Guía interactiva de la escala N1..N5 reutilizando el componente oficial */}
        {showTrustGuide && (
          <TrustLevelsGuide
            innerStyle={cardStyle}
            onClose={() => setShowTrustGuide(false)}
          />
        )}
      </div>

      {/* 3. VIDRIERA PÚBLICA EN VIVO (sin exposición de PII: muestra valor real antes del login) */}
      <div
        id="vidriera-publica"
        ref={showcaseRef}
        className={`rounded-3xl p-5 sm:p-7 border ${borderTone} space-y-5 scroll-mt-6`}
        style={cardStyle}
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              <Award size={13} />
              <span>Vidriera pública en vivo</span>
            </div>
            <h2 className="text-lg sm:text-2xl font-black tracking-tight">
              Prestadores activos en la red TrustLink
            </h2>
            <p className="text-xs sm:text-sm opacity-75">
              Mostramos insignias verificadas, rubros y reputación real. Los datos de contacto y la
              emisión de Pases QR se habilitan al iniciar sesión.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {[
              { id: 'all', label: `Todos (${showcaseCounts.all})` },
              { id: 'verified', label: `Nivel 4–5 · Pase QR (${showcaseCounts.verified})` },
              { id: 'socio', label: `Socios N5 (${showcaseCounts.socio})` },
              { id: 'emergencies', label: `Urgencias 24h (${showcaseCounts.emergencies})` },
            ].map((chip) => {
              const active = showcaseFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => {
                    setShowcaseFilter(chip.id);
                    setShowAllShowcase(false);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                    active
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                      : `${subtleBorder} opacity-80 hover:opacity-100`
                  }`}
                  style={!active ? innerStyle : undefined}
                >
                  {chip.label}
                </button>
              );
            })}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetShowcaseFilters}
                className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold border border-rose-400/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Estado de carga */}
        {loadingShowcase ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((slot) => (
              <div
                key={slot}
                className={`rounded-2xl p-5 border ${subtleBorder} h-56 animate-pulse`}
                style={innerStyle}
              />
            ))}
          </div>
        ) : visibleShowcaseCards.length === 0 ? (
          <div
            className={`rounded-2xl p-6 border ${subtleBorder} text-center space-y-3`}
            style={innerStyle}
          >
            <SlidersHorizontal size={22} className="mx-auto opacity-60" />
            <div className="space-y-1">
              <p className="text-sm font-bold">
                {showcaseProviders.length === 0
                  ? 'Todavía no hay prestadores visibles en la vidriera pública'
                  : 'No encontramos prestadores que coincidan con tu búsqueda'}
              </p>
              <p className="text-xs opacity-75">
                {showcaseProviders.length === 0
                  ? 'Registrate como prestador o ingresá a tu comunidad para ver el directorio completo.'
                  : 'Probá limpiar los filtros o ingresar para ver todo el directorio de tu comunidad.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetShowcaseFilters}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border ${subtleBorder} cursor-pointer`}
                  style={cardStyle}
                >
                  Limpiar filtros
                </button>
              )}
              <button
                type="button"
                onClick={() => persistIntentAndLogin()}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                Ingresar a la plataforma →
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleShowcaseCards.map((prov) => {
                const level = Number(prov.trust_level ?? 0);
                const isSocio = level === 5 && !prov.has_expired_docs;
                const isVerified = level >= 4 && !prov.has_expired_docs;
                const specs =
                  Array.isArray(prov.specialties) && prov.specialties.length > 0
                    ? prov.specialties
                    : prov.specialty
                      ? [prov.specialty]
                      : [];
                const quoteLabel =
                  QUOTE_POLICY_LABELS[prov.quote_visit_policy] || 'Presupuesto a consultar';
                const invoiceLabel = INVOICE_LABELS[prov.invoice_type] || null;
                const ratingNum = Number(prov.rating_avg || 0);

                const headerBandClass = isSocio
                  ? 'border-amber-400/40 bg-amber-500/12'
                  : isVerified
                    ? 'border-emerald-500/35 bg-emerald-500/10'
                    : `${subtleBorder} bg-black/15`;

                return (
                  <article
                    key={prov.showcase_id}
                    className={`rounded-2xl border ${
                      isSocio ? 'border-amber-400/45' : subtleBorder
                    } overflow-hidden flex flex-col justify-between transition-transform hover:-translate-y-0.5`}
                    style={innerStyle}
                  >
                    <div>
                      {/* Banda superior de nivel de confianza y habilitación QR */}
                      <div
                        className={`px-4 py-2.5 border-b flex items-center justify-between gap-2 ${headerBandClass}`}
                      >
                        <ProviderTrustBadge trust={prov.trust_badge} showScale compact />
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                            prov.can_issue_pass && !prov.has_expired_docs
                              ? 'border-emerald-400/45 bg-emerald-500/15 text-emerald-300'
                              : `${subtleBorder} opacity-80`
                          }`}
                        >
                          {prov.can_issue_pass && !prov.has_expired_docs
                            ? 'Pase QR habilitado'
                            : 'Solo consultas'}
                        </span>
                      </div>

                      {/* Cuerpo principal de la tarjeta */}
                      <div className="p-4 space-y-3">
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm sm:text-base font-extrabold leading-snug">
                              {prov.display_name}
                            </h3>
                            <div className="inline-flex items-center gap-1 text-xs font-bold shrink-0">
                              <Star
                                size={13}
                                className={
                                  ratingNum > 0
                                    ? 'text-amber-400 fill-amber-400'
                                    : 'opacity-40'
                                }
                              />
                              <span>{ratingNum > 0 ? ratingNum.toFixed(1) : 'Nuevo'}</span>
                            </div>
                          </div>

                          {/* Rubros y estado operativo */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {specs.slice(0, 3).map((spec) => (
                              <span
                                key={spec}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${subtleBorder}`}
                                style={cardStyle}
                              >
                                {spec}
                              </span>
                            ))}
                            {specs.length > 3 && (
                              <span className="text-[10px] font-semibold opacity-70">
                                +{specs.length - 3}
                              </span>
                            )}
                            {prov.accepts_emergencies && !prov.has_expired_docs && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border border-amber-400/40 bg-amber-500/15 text-amber-300">
                                <Clock size={10} />
                                <span>Urgencias 24h</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Tira real de controles verificables */}
                        <TrustChecksStrip
                          trust={prov.trust_badge}
                          hasExpiredDocs={Boolean(prov.has_expired_docs)}
                          compact
                        />

                        {/* Bio breve y condiciones comerciales */}
                        {prov.service_bio && (
                          <p className="text-[11px] opacity-80 leading-relaxed line-clamp-2">
                            {prov.service_bio}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] opacity-75">
                          <span>{quoteLabel}</span>
                          {invoiceLabel && <span>· {invoiceLabel}</span>}
                          <span>
                            ·{' '}
                            {prov.completed_jobs > 0
                              ? `${prov.completed_jobs} trabajo(s) conformado(s)`
                              : 'Sin trabajos registrados aún'}
                          </span>
                        </div>

                        {/* Termómetro de reputación */}
                        {prov.reputation && (
                          <div className={`pt-2 border-t ${borderTone}`}>
                            <ReputationThermometer reputation={prov.reputation} compact />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Pie accionable con resguardo de privacidad */}
                    <div
                      className={`px-4 py-3 border-t ${borderTone} flex items-center justify-between gap-2`}
                      style={cardStyle}
                    >
                      <span className="inline-flex items-center gap-1 text-[10px] opacity-70">
                        <Lock size={11} className="shrink-0" />
                        <span>Contacto y QR al ingresar</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => persistIntentAndLogin(specs[0] || prov.display_name)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white hover:opacity-95 cursor-pointer shrink-0"
                        style={{ backgroundColor: primaryColor }}
                      >
                        <span>Consultar</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {filteredShowcase.length > 6 && (
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={() => setShowAllShowcase((prev) => !prev)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border ${subtleBorder} hover:opacity-95 cursor-pointer`}
                  style={innerStyle}
                >
                  {showAllShowcase
                    ? 'Ver menos prestadores'
                    : `Ver todos los prestadores (${filteredShowcase.length})`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. GRILLA VISUAL DE RUBROS (inspirada en el bloque Categorías de Mercado Libre) */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-black tracking-tight">
              Explorá por rubro del hogar
            </h2>
            <p className="text-xs sm:text-sm opacity-75">
              Elegí una especialidad para filtrar al instante la vidriera pública de prestadores.
            </p>
          </div>
          <button
            type="button"
            onClick={() => persistIntentAndLogin()}
            className="text-xs font-bold text-emerald-400 hover:underline cursor-pointer"
          >
            Ver directorio completo en el portal →
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {enrichedCategories.map((cat) => {
            const Icon = cat.Icon;
            const isSelected = selectedService === cat.query;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => handleQuickServiceSelect(cat.query, true)}
                className={`text-left rounded-2xl p-4 border transition-all cursor-pointer flex items-start gap-3 ${
                  isSelected
                    ? 'border-emerald-400 ring-1 ring-emerald-400/50'
                    : `${borderTone} hover:border-emerald-500/45`
                }`}
                style={cardStyle}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center border ${subtleBorder} shrink-0`}
                  style={innerStyle}
                >
                  <Icon size={18} className={cat.accentClass} />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs sm:text-sm font-extrabold truncate">{cat.name}</p>
                  <p className="text-[11px] opacity-70 line-clamp-1">{cat.subtitle}</p>
                  <p className="text-[10px] font-semibold text-emerald-400 pt-0.5">
                    {cat.verifiedCount > 0
                      ? `${cat.verifiedCount} verificado(s) N4–N5`
                      : cat.totalCount > 0
                        ? `${cat.totalCount} activo(s) en red`
                        : 'Explorar rubro →'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. BANDA DESTACADA DE FLUJO EN 3 PASOS (contraste medio estilo Meli+) */}
      <div
        className={`rounded-3xl p-6 sm:p-7 border border-emerald-500/35 space-y-5`}
        style={cardStyle}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              <QrCode size={13} />
              <span>Sin efecto portón</span>
            </span>
            <h2 className="text-lg sm:text-2xl font-black tracking-tight">
              Del pedido al ingreso en garita en 3 pasos simples
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => goRegisterWithRole('owner')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white hover:opacity-95 cursor-pointer"
              style={{ backgroundColor: primaryColor }}
            >
              <span>Crear cuenta gratis</span>
              <ArrowRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => goRegisterWithRole('provider')}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold border ${subtleBorder} hover:opacity-90 cursor-pointer`}
              style={innerStyle}
            >
              <span>Soy prestador</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {[
            {
              step: '01',
              title: 'Elegís un perfil con respaldo',
              desc: 'Comparás nivel N1–N5, checks de DNI/ART/Antecedentes, reseñas de vecinos y disponibilidad.',
            },
            {
              step: '02',
              title: 'Coordinás visita y emitís QR',
              desc: 'Acordás día y horario dentro de la app y generás un Pase QR con patente y cuadrilla.',
            },
            {
              step: '03',
              title: 'Validación ágil y conformidad',
              desc: 'La garita escanea el QR en segundos. Al finalizar, registrás conformidad y reseña cruzada.',
            },
          ].map((item) => (
            <div
              key={item.step}
              className={`rounded-2xl p-4 border ${subtleBorder} space-y-1.5`}
              style={innerStyle}
            >
              <span className="inline-block text-[11px] font-mono font-black text-emerald-400">
                PASO {item.step}
              </span>
              <h3 className="text-sm font-extrabold">{item.title}</h3>
              <p className="text-xs opacity-80 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 6. PROPUESTA DE VALOR POR ACTOR */}
      <div id="actores" ref={actorsRef} className="space-y-4 scroll-mt-6">
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
                className={`rounded-2xl p-5 border ${borderTone} space-y-3`}
                style={cardStyle}
              >
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                  <Icon size={12} />
                  <span>{actor.badge}</span>
                </span>

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

      {/* 7. PILARES DE CONFIANZA SOBRIOS DE CIERRE (patrón de cierre institucional de MeLi) */}
      <div
        className={`rounded-3xl p-6 border ${borderTone} space-y-5`}
        style={cardStyle}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border ${subtleBorder} shrink-0`}
              style={innerStyle}
            >
              <ShieldCheck size={19} className="text-emerald-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold">Compliance Centralizado</h3>
              <p className="text-xs opacity-75 leading-relaxed">
                DNI, póliza ART o accidentes personales, antecedentes penales, vehículos y cuadrilla
                auditados por TrustLink para toda la red.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border ${subtleBorder} shrink-0`}
              style={innerStyle}
            >
              <QrCode size={19} className="text-emerald-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold">Pases QR y API para Garitas</h3>
              <p className="text-xs opacity-75 leading-relaxed">
                Pases digitales con vigencia horaria, destino, patente y ayudantes adjuntos. La
                garita valida identidad y habilitación en segundos.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border ${subtleBorder} shrink-0`}
              style={innerStyle}
            >
              <Star size={19} className="text-emerald-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold">Reputación Cruzada Real</h3>
              <p className="text-xs opacity-75 leading-relaxed">
                Acordá el trabajo in situ, registrá conformidad y calificá la experiencia de ambos
                lados (residente ↔ prestador) con respaldo Ops.
              </p>
            </div>
          </div>
        </div>

        <div
          className={`pt-4 border-t ${borderTone} flex flex-wrap items-center justify-between gap-3 text-xs`}
        >
          <div className="flex flex-wrap items-center gap-4 opacity-85">
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
            onClick={() => persistIntentAndLogin()}
            className="font-bold underline underline-offset-4 hover:opacity-80 cursor-pointer"
          >
            Ingresar a la plataforma →
          </button>
        </div>
      </div>
    </section>
  );
}
