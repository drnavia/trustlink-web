/**
 * @file LandingHome.jsx
 * @description Portada pública marketplace-first (`/`) de TrustLink.
 * Eleva la vidriera pública en vivo de prestadores al primer plano (above the fold)
 * con la misma gramática limpia del Portal Residente: barra única de filtros con selector
 * desplegable de Rubros escalable, ordenamiento, guía N1–N5 desplegable, tarjetas escaneables
 * en 3 segundos y modal público "Ver ficha" sin exposición de PII.
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
  Home,
  Briefcase,
  Building2,
  Lock,
  X,
  SlidersHorizontal,
  Award,
  ChevronDown,
  Check,
  HelpCircle,
  AlertCircle,
  RotateCcw,
  MessageSquare,
} from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';
import { API_BASE } from '../../config/api';
import { TRUST_LEVEL_THEME } from '../../config/uiTokens';
import {
  getSearchSuggestions,
  matchesProviderQuery,
} from '../../utils/serviceSearchMatcher';
import ProviderTrustBadge, {
  FeaturedPartnerBadge,
  ProviderAvatar,
  TrustChecksStrip,
  TrustLevelsGuide,
  VerifiedSeal,
} from '../../components/ProviderTrustBadge';
import { ReputationThermometer } from '../../components/HomeProtectedBadge';

/** Etiquetas legibles de política de presupuesto para las tarjetas y ficha pública. */
const QUOTE_POLICY_LABELS = {
  sin_cargo: 'Presupuesto sin cargo',
  descontable: 'Visita descontable',
  arancelada: 'Visita arancelada',
  consultar: 'Presupuesto a consultar',
};

/** Etiquetas legibles de facturación para la ficha pública. */
const INVOICE_LABELS = {
  factura_a: 'Factura A',
  factura_b: 'Factura B',
  factura_c: 'Factura C',
  monotributo: 'Monotributo',
  consultar: null,
};

/** Propuesta de valor resumida por actor del ecosistema (ubicada debajo de la vidriera). */
const ACTOR_BENEFITS = [
  {
    id: 'resident',
    icon: Home,
    badge: 'Residentes',
    title: 'Contratá sin depender de WhatsApp',
    points: [
      'Prestadores verificados con DNI, Seguro AP/ART y antecedentes penales.',
      'Pases QR en segundos con destino, horario, vehículo y cuadrilla.',
      'Historial del hogar con acuerdos claros y reseñas de vecinos reales.',
    ],
  },
  {
    id: 'provider',
    icon: Briefcase,
    badge: 'Prestadores',
    title: 'Terminá con el "efecto portón"',
    points: [
      'Una sola verificación centralizada válida para toda la red de barrios.',
      'Flota vehicular y cuadrilla precargadas para ingresar sin demoras.',
      'Reputación acumulable e insignias N1–N4 frente a perfiles informales.',
    ],
  },
  {
    id: 'community',
    icon: Building2,
    badge: 'Barrios y Garitas',
    title: 'Accesos ágiles sin auditar papeles',
    points: [
      'Validación instantánea vía Consola Garita o API Universal.',
      'Trazabilidad auditable de cada ingreso autorizado o denegado.',
      'Autonomía para aplicar suspensiones locales cuando haga falta.',
    ],
  },
];

/** Extrae y deduplica las especialidades de un prestador público. */
const getShowcaseSpecialties = (prov) => {
  if (Array.isArray(prov?.specialties) && prov.specialties.length > 0) {
    return prov.specialties.map((s) => String(s || '').trim()).filter(Boolean);
  }
  if (prov?.specialty) {
    return String(prov.specialty)
      .split(/[·,|/]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

/** Devuelve color y etiqueta compacta de reputación (misma regla visual que Portal Residente). */
const getCompactReputationMeta = (prov) => {
  const rep = prov?.reputation;
  const label =
    rep?.level_label ||
    rep?.label ||
    (Number(prov?.completed_jobs || 0) > 0 ? 'Con experiencia' : 'Nuevo en TrustLink');
  const tone = String(rep?.tone || '').toLowerCase();
  const dotClass =
    tone === 'emerald'
      ? 'bg-emerald-400'
      : tone === 'lime'
        ? 'bg-lime-400'
        : tone === 'amber'
          ? 'bg-amber-400'
          : tone === 'orange'
            ? 'bg-orange-400'
            : tone === 'rose'
              ? 'bg-rose-400'
              : 'bg-sky-400';
  return { label, dotClass };
};

/**
 * Portada pública de TrustLink orientada al descubrimiento inmediato de prestadores registrados.
 *
 * @param {object} props
 * @param {() => void} props.onGoLogin - Navega al inicio de sesión.
 * @param {() => void} props.onGoRegister - Navega al registro.
 * @param {string} [props.externalSearchTerm] - Término de búsqueda sincronizado desde Zona 1.
 * @param {(val: string) => void} [props.onExternalSearchChange] - Actualiza búsqueda en Zona 1.
 * @param {string} [props.externalSelectedSpecialty] - Rubro seleccionado desde Zona 2.
 * @param {(val: string) => void} [props.onExternalSelectedSpecialtyChange] - Sincroniza rubro con Zona 2.
 * @param {(entries: Array<{name: string, count: number}>) => void} [props.onSpecialtiesChange] - Publica rubros activos a Zona 2.
 * @param {number} [props.searchSubmitNonce=0] - Contador incremental cuando se envía el buscador global.
 * @param {boolean} [props.useGlobalHeaderSearch=false] - Oculta el buscador duplicado cuando vive en Zona 1.
 */
export default function LandingHome({
  onGoLogin,
  onGoRegister,
  externalSearchTerm,
  onExternalSearchChange,
  externalSelectedSpecialty,
  onExternalSelectedSpecialtyChange,
  onSpecialtiesChange,
  searchSubmitNonce = 0,
  useGlobalHeaderSearch = false,
}) {
  const { brand } = useBranding();
  const showcaseRef = useRef(null);
  const specialtyMenuRef = useRef(null);

  const [internalSearchTerm, setInternalSearchTerm] = useState('');
  const isControlledSearch = typeof onExternalSearchChange === 'function';
  const searchTerm = isControlledSearch ? String(externalSearchTerm ?? '') : internalSearchTerm;
  const setSearchTerm = (nextOrUpdater) => {
    const nextValue =
      typeof nextOrUpdater === 'function' ? nextOrUpdater(searchTerm) : nextOrUpdater;
    if (isControlledSearch) {
      onExternalSearchChange(nextValue);
    } else {
      setInternalSearchTerm(nextValue);
    }
  };

  const [internalSpecialty, setInternalSpecialty] = useState('Todos');
  const isControlledSpecialty =
    typeof onExternalSelectedSpecialtyChange === 'function' &&
    externalSelectedSpecialty !== undefined;
  const selectedSpecialty = isControlledSpecialty
    ? String(externalSelectedSpecialty || 'Todos')
    : internalSpecialty;
  const setSelectedSpecialty = (nextOrUpdater) => {
    const nextValue =
      typeof nextOrUpdater === 'function' ? nextOrUpdater(selectedSpecialty) : nextOrUpdater;
    const normalized = String(nextValue || 'Todos');
    if (isControlledSpecialty) {
      onExternalSelectedSpecialtyChange(normalized);
    } else {
      setInternalSpecialty(normalized);
    }
  };

  // Filtros compactos de decisión (misma lógica Opción A que Portal Residente)
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [onlyEmergencies, setOnlyEmergencies] = useState(false);
  const [onlySocio, setOnlySocio] = useState(false);
  const [sortBy, setSortBy] = useState('featured');
  const [showAllShowcase, setShowAllShowcase] = useState(false);
  const [showTrustGuide, setShowTrustGuide] = useState(false);
  const [specialtyMenuOpen, setSpecialtyMenuOpen] = useState(false);
  const [specialtyMenuQuery, setSpecialtyMenuQuery] = useState('');
  const [selectedProfileModal, setSelectedProfileModal] = useState(null);

  // Datos vivos de la vidriera pública (sin PII)
  const [showcaseProviders, setShowcaseProviders] = useState([]);
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

  // Cargar la vidriera pública al montar (fail-safe)
  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/api/v1/providers/public-showcase?limit=36`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setShowcaseProviders(Array.isArray(data.providers) ? data.providers : []);
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

  // Cierra el selector desplegable de rubros al hacer clic afuera o presionar Escape
  useEffect(() => {
    if (!specialtyMenuOpen) return undefined;
    const handleOutside = (event) => {
      if (specialtyMenuRef.current && !specialtyMenuRef.current.contains(event.target)) {
        setSpecialtyMenuOpen(false);
        setSpecialtyMenuQuery('');
      }
    };
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        setSpecialtyMenuOpen(false);
        setSpecialtyMenuQuery('');
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [specialtyMenuOpen]);

  // Cierra el modal público "Ver ficha" con Escape
  useEffect(() => {
    if (!selectedProfileModal) return undefined;
    const handleEsc = (event) => {
      if (event.key === 'Escape') setSelectedProfileModal(null);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [selectedProfileModal]);

  // Desplaza suavemente hacia la vidriera si el visitante presiona Enter en el buscador global
  useEffect(() => {
    if (!searchSubmitNonce) return;
    const query = searchTerm.trim();
    try {
      if (query) {
        sessionStorage.setItem('trustlink_initial_service_query', query);
      } else {
        sessionStorage.removeItem('trustlink_initial_service_query');
      }
    } catch {
      // Ignorar
    }
    setShowAllShowcase(false);
    showcaseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchSubmitNonce]);

  /** Guarda intención de búsqueda/rubro y navega a iniciar sesión. */
  const persistIntentAndLogin = (queryText = '') => {
    const cleanQuery = String(
      queryText || searchTerm || (selectedSpecialty !== 'Todos' ? selectedSpecialty : '')
    ).trim();
    try {
      if (cleanQuery) {
        sessionStorage.setItem('trustlink_initial_service_query', cleanQuery);
      } else {
        sessionStorage.removeItem('trustlink_initial_service_query');
      }
    } catch {
      // Ignorar
    }
    onGoLogin();
  };

  /** Abre el registro preseleccionando el rol deseado (`owner` o `provider`). */
  const goRegisterWithRole = (targetRole = 'owner') => {
    try {
      sessionStorage.setItem('trustlink_initial_register_role', targetRole);
    } catch {
      // Ignorar
    }
    onGoRegister();
  };

  // Rubros activos ordenados con conteos reales de la vidriera
  const availableSpecialtyEntries = useMemo(() => {
    const countsMap = new Map();
    showcaseProviders.forEach((prov) => {
      getShowcaseSpecialties(prov).forEach((spec) => {
        countsMap.set(spec, (countsMap.get(spec) || 0) + 1);
      });
    });
    const sorted = Array.from(countsMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'));
    return [{ name: 'Todos', count: showcaseProviders.length }, ...sorted];
  }, [showcaseProviders]);

  // Publica los rubros activos a la Zona 2 pública de App.jsx
  useEffect(() => {
    if (typeof onSpecialtiesChange === 'function') {
      onSpecialtiesChange(availableSpecialtyEntries);
    }
  }, [onSpecialtiesChange, availableSpecialtyEntries]);

  const hasAnySocio = useMemo(
    () =>
      showcaseProviders.some(
        (p) => Boolean(p.is_featured_partner || p.is_verified_member) && !p.has_expired_docs
      ),
    [showcaseProviders]
  );

  // Sugerencias inteligentes por síntoma/problema cotidiano
  const symptomSuggestions = useMemo(() => getSearchSuggestions(searchTerm), [searchTerm]);

  // Filtrado y ordenamiento en vivo de la vidriera pública
  const filteredShowcase = useMemo(() => {
    const filtered = showcaseProviders.filter((prov) => {
      if (onlyVerified && (!prov.is_verified || prov.has_expired_docs)) return false;
      if (
        onlySocio &&
        (!(prov.is_featured_partner || prov.is_verified_member) || prov.has_expired_docs)
      ) {
        return false;
      }
      if (onlyEmergencies && (!prov.accepts_emergencies || prov.has_expired_docs)) return false;
      if (selectedSpecialty !== 'Todos') {
        const specs = getShowcaseSpecialties(prov).map((s) => s.toLowerCase());
        if (!specs.includes(selectedSpecialty.toLowerCase())) return false;
      }
      if (searchTerm.trim() && !matchesProviderQuery(prov, searchTerm)) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'rating') {
        return Number(b.rating_avg || 0) - Number(a.rating_avg || 0);
      }
      if (sortBy === 'jobs') {
        return Number(b.completed_jobs || 0) - Number(a.completed_jobs || 0);
      }
      if (sortBy === 'reputation') {
        return Number(b.reputation?.score || 0) - Number(a.reputation?.score || 0);
      }
      // 'featured': prioriza nivel de confianza vigente, luego reputación y rating
      const levelA = a.has_expired_docs ? 0 : Number(a.trust_level || 0);
      const levelB = b.has_expired_docs ? 0 : Number(b.trust_level || 0);
      if (levelB !== levelA) return levelB - levelA;
      return Number(b.rating_avg || 0) - Number(a.rating_avg || 0);
    });
  }, [showcaseProviders, onlyVerified, onlySocio, onlyEmergencies, selectedSpecialty, searchTerm, sortBy]);

  const visibleShowcaseCards = showAllShowcase ? filteredShowcase : filteredShowcase.slice(0, 9);
  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
      selectedSpecialty !== 'Todos' ||
      onlyVerified ||
      onlyEmergencies ||
      onlySocio
  );

  const resetShowcaseFilters = () => {
    setSearchTerm('');
    setSelectedSpecialty('Todos');
    setOnlyVerified(false);
    setOnlyEmergencies(false);
    setOnlySocio(false);
    setShowAllShowcase(false);
  };

  return (
    <section className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-5 md:py-6 space-y-6">
      {/* 1. FRANJA DE PRESENTACIÓN COMPACTA (sin empujar la vidriera fuera del primer pantallazo) */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2.5">
        <div className="space-y-0.5 min-w-0">
          <h1 className="text-lg sm:text-2xl font-black tracking-tight leading-snug">
            Prestadores verificados para tu comunidad
          </h1>
          <p className="text-xs sm:text-sm opacity-75">
            DNI, Seguro AP/ART y antecedentes penales validados para ingresar con Pase QR.
          </p>
        </div>

        {networkSummary &&
          (networkSummary.total_active_providers > 0 || networkSummary.total_communities > 0) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold opacity-80 shrink-0">
              {networkSummary.total_active_providers > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
                  <span>
                    {networkSummary.verified_providers >= 5
                      ? `${networkSummary.verified_providers} verificados con QR`
                      : `${networkSummary.total_active_providers} ${
                          networkSummary.total_active_providers === 1
                            ? 'prestador'
                            : 'prestadores'
                        } en red`}
                  </span>
                </span>
              )}
              {networkSummary.total_active_providers > 0 && networkSummary.total_communities > 0 && (
                <span className="opacity-40" aria-hidden="true">
                  ·
                </span>
              )}
              {networkSummary.total_communities > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 size={13} className="text-sky-400 shrink-0" />
                  <span>
                    {networkSummary.total_communities}{' '}
                    {networkSummary.total_communities === 1 ? 'comunidad' : 'comunidades'}
                  </span>
                </span>
              )}
            </div>
          )}
      </div>

      {/* 2. VIDRIERA PÚBLICA DE PRESTADORES — PROTAGONISTA INMEDIATO (misma estética limpia del Portal Residente) */}
      <div
        id="vidriera-publica"
        ref={showcaseRef}
        className={`rounded-2xl p-4 sm:p-5 border ${borderTone} shadow-lg space-y-4 scroll-mt-6`}
        style={cardStyle}
      >
        {/* Cabecera del directorio + Orden + Niveles N1–N5 */}
        {useGlobalHeaderSearch ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold tracking-tight">
                Directorio público de prestadores
              </h2>
              <span className="text-xs opacity-65 font-semibold">
                ({filteredShowcase.length})
              </span>
              {searchTerm.trim() && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 cursor-pointer"
                  title="Quitar texto de búsqueda"
                >
                  <span>“{searchTerm.trim()}”</span>
                  <X size={11} />
                </button>
              )}
              {useGlobalHeaderSearch && isControlledSpecialty && selectedSpecialty !== 'Todos' && (
                <button
                  type="button"
                  onClick={() => setSelectedSpecialty('Todos')}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 cursor-pointer"
                  title="Quitar filtro de rubro"
                >
                  <span>Rubro: {selectedSpecialty}</span>
                  <X size={11} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Ordenar prestadores"
                className="px-3 py-2 rounded-xl border border-white/15 text-xs font-semibold focus:outline-none"
                style={innerStyle}
              >
                <option value="featured">Orden: Destacados</option>
                <option value="reputation">Mejor reputación</option>
                <option value="rating">Mejor calificación</option>
                <option value="jobs">Más trabajos</option>
              </select>

              <button
                type="button"
                onClick={() => setShowTrustGuide((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                  showTrustGuide
                    ? 'border-indigo-400/65 bg-indigo-500/20 text-indigo-200'
                    : 'border-white/15 opacity-85 hover:opacity-100'
                }`}
                style={showTrustGuide ? undefined : innerStyle}
              >
                <HelpCircle size={13} className="shrink-0" />
                <span>Niveles de confianza</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-60 pointer-events-none"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="¿Qué necesitás resolver? Ej: pérdida de agua, salta la térmica, electricista..."
                className={`w-full pl-10 pr-9 py-2.5 rounded-xl text-xs sm:text-sm border ${subtleBorder} focus:outline-none`}
                style={innerStyle}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-3 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 cursor-pointer"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Ordenar prestadores"
                className="px-3 py-2.5 rounded-xl border border-white/15 text-xs font-semibold focus:outline-none"
                style={innerStyle}
              >
                <option value="featured">Orden: Destacados</option>
                <option value="reputation">Mejor reputación</option>
                <option value="rating">Mejor calificación</option>
                <option value="jobs">Más trabajos</option>
              </select>

              <button
                type="button"
                onClick={() => setShowTrustGuide((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                  showTrustGuide
                    ? 'border-indigo-400/65 bg-indigo-500/20 text-indigo-200'
                    : 'border-white/15 opacity-85 hover:opacity-100'
                }`}
                style={showTrustGuide ? undefined : innerStyle}
              >
                <HelpCircle size={13} className="shrink-0" />
                <span>Niveles de confianza</span>
              </button>
            </div>
          </div>
        )}

        {/* Guía desplegable de niveles de confianza */}
        {showTrustGuide && (
          <TrustLevelsGuide
            innerStyle={innerStyle}
            onClose={() => setShowTrustGuide(false)}
          />
        )}

        {/* Sugerencias inteligentes al buscar por síntoma */}
        {symptomSuggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="font-semibold text-emerald-300">Rubros sugeridos:</span>
            {symptomSuggestions.map((sug) => (
              <button
                key={sug.label}
                type="button"
                onClick={() => {
                  const matched = availableSpecialtyEntries.find(
                    (e) => e.name.toLowerCase() === sug.targetSpecialty.toLowerCase()
                  );
                  if (matched) {
                    setSearchTerm('');
                    setSelectedSpecialty(matched.name);
                  } else {
                    setSearchTerm(sug.targetSpecialty);
                  }
                }}
                className="px-2.5 py-0.5 rounded-full font-semibold border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 cursor-pointer"
              >
                {sug.label} → <strong>{sug.targetSpecialty}</strong>
              </button>
            ))}
          </div>
        )}

        {/* Barra única de filtros: oculta selector Rubros cuando ya vive en Zona 2C */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {!(useGlobalHeaderSearch && isControlledSpecialty) && (
            <>
              <div className="relative" ref={specialtyMenuRef}>
                <button
                  type="button"
                  onClick={() => setSpecialtyMenuOpen((prev) => !prev)}
                  aria-expanded={specialtyMenuOpen}
                  aria-haspopup="listbox"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${
                    selectedSpecialty !== 'Todos'
                      ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200'
                      : 'border-white/15 opacity-90 hover:opacity-100'
                  }`}
                  style={selectedSpecialty !== 'Todos' ? undefined : innerStyle}
                >
                  <SlidersHorizontal size={12} className="shrink-0 opacity-85" />
                  <span>
                    {selectedSpecialty === 'Todos'
                      ? `Rubro: Todos (${Math.max(0, availableSpecialtyEntries.length - 1)})`
                      : selectedSpecialty}
                  </span>
                  <ChevronDown
                    size={13}
                    className={`shrink-0 opacity-75 transition-transform ${
                      specialtyMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {specialtyMenuOpen && (
                  <div
                    role="listbox"
                    aria-label="Seleccionar rubro"
                    className="absolute left-0 mt-1.5 w-64 rounded-2xl border border-white/15 shadow-2xl p-2 z-40 space-y-1.5"
                    style={cardStyle}
                  >
                    {availableSpecialtyEntries.length > 3 && (
                      <div className="relative">
                        <Search
                          size={13}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-55 pointer-events-none"
                        />
                        <input
                          type="text"
                          value={specialtyMenuQuery}
                          onChange={(e) => setSpecialtyMenuQuery(e.target.value)}
                          placeholder="Filtrar rubro..."
                          className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-white/15 text-xs focus:outline-none"
                          style={innerStyle}
                          autoFocus
                        />
                      </div>
                    )}

                    <div className="max-h-60 overflow-y-auto space-y-0.5">
                      {availableSpecialtyEntries
                        .filter(({ name }) => {
                          const q = specialtyMenuQuery.trim().toLowerCase();
                          return !q || name.toLowerCase().includes(q);
                        })
                        .map(({ name: spec, count }) => {
                          const active = selectedSpecialty === spec;
                          return (
                            <button
                              key={spec}
                              type="button"
                              role="option"
                              aria-selected={active}
                              onClick={() => {
                                setSelectedSpecialty(spec);
                                setSpecialtyMenuOpen(false);
                                setSpecialtyMenuQuery('');
                                setShowAllShowcase(false);
                              }}
                              className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-left cursor-pointer transition-colors ${
                                active
                                  ? 'bg-emerald-500/20 text-emerald-200'
                                  : 'hover:bg-white/8 opacity-85 hover:opacity-100'
                              }`}
                            >
                              <span className="truncate">
                                {spec === 'Todos' ? 'Todos los rubros' : spec}
                              </span>
                              <span className="inline-flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] opacity-65">({count})</span>
                                {active && <Check size={12} className="text-emerald-400" />}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              <span className="hidden sm:inline-block h-4 w-px bg-white/15 mx-0.5" aria-hidden="true" />
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setOnlyVerified((prev) => !prev);
              setShowAllShowcase(false);
            }}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-semibold border transition-all cursor-pointer ${
              onlyVerified
                ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200'
                : 'border-white/12 opacity-80 hover:opacity-100'
            }`}
            style={onlyVerified ? undefined : innerStyle}
            title="Mostrar solo prestadores con documentación aprobada y Pase QR habilitado (niveles N3 y N4)"
          >
            <ShieldCheck size={12} />
            <span>Con Pase QR</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setOnlyEmergencies((prev) => !prev);
              setShowAllShowcase(false);
            }}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-semibold border transition-all cursor-pointer ${
              onlyEmergencies
                ? 'border-rose-400/70 bg-rose-500/20 text-rose-200'
                : 'border-white/12 opacity-80 hover:opacity-100'
            }`}
            style={onlyEmergencies ? undefined : innerStyle}
          >
            <AlertCircle size={12} />
            <span>Urgencias 24h</span>
          </button>

          {(hasAnySocio || onlySocio) && (
            <button
              type="button"
              onClick={() => {
                setOnlySocio((prev) => !prev);
                setShowAllShowcase(false);
              }}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-semibold border transition-all cursor-pointer ${
                onlySocio
                  ? 'border-amber-400/70 bg-amber-500/20 text-amber-200'
                  : 'border-white/12 opacity-80 hover:opacity-100'
              }`}
              style={onlySocio ? undefined : innerStyle}
            >
              <Award size={12} />
              <span>Destacados</span>
            </button>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetShowcaseFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border border-rose-400/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 cursor-pointer"
            >
              <RotateCcw size={11} />
              <span>Limpiar</span>
            </button>
          )}
        </div>

        {/* Estado de carga, vacío o grilla escaneable de 3 columnas */}
        {loadingShowcase ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {[1, 2, 3].map((slot) => (
              <div
                key={slot}
                className={`rounded-2xl p-5 border ${subtleBorder} h-48 animate-pulse`}
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
                  : 'No encontramos prestadores con ese filtro'}
              </p>
              <p className="text-xs opacity-75">
                {showcaseProviders.length === 0
                  ? 'Registrate como prestador o ingresá a tu comunidad para ver el directorio completo.'
                  : 'Probá limpiar los filtros o ingresar para explorar toda la red.'}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {visibleShowcaseCards.map((prov) => {
                const level = Number(prov.trust_level ?? 0);
                const isFeatured = Boolean(prov.is_featured_partner || prov.is_verified_member) && !prov.has_expired_docs;
                const isVerified = level >= 3 && !prov.has_expired_docs;
                const specs = getShowcaseSpecialties(prov);
                const ratingNum = Number(prov.rating_avg || 0);
                const hasRating = ratingNum > 0;
                const reviewsCount = Number(prov.reviews_count || 0);
                const repMeta = getCompactReputationMeta(prov);
                const jobsCount = Number(prov.completed_jobs || 0);
                const showTrustBadge = Boolean(prov.has_expired_docs) || level >= 2;
                const showMetaRow = showTrustBadge || isFeatured || hasRating;

                const cardBorderClass = prov.has_expired_docs
                  ? 'border-rose-500/40'
                  : isFeatured
                    ? 'border-amber-400/55 ring-1 ring-amber-400/20'
                    : (TRUST_LEVEL_THEME[level]?.cardRing || 'border-white/12');

                return (
                  <article
                    key={prov.showcase_id}
                    className={`rounded-2xl border ${cardBorderClass} p-4 flex flex-col justify-between gap-3.5 h-full transition-transform hover:-translate-y-0.5`}
                    style={innerStyle}
                  >
                    <div className="space-y-3">
                      {/* 1. Avatar circular + Nombre (+ tilde N4 único) + Confianza por excepción / Rating real + Rubros */}
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ProviderAvatar
                            name={prov.display_name}
                            avatarUrl={prov.avatar_url || prov.photo_url || ''}
                            level={level}
                            isDanger={Boolean(prov.has_expired_docs)}
                          />
                          <div className="min-w-0 space-y-1">
                            <h3 className="text-sm sm:text-base font-extrabold leading-snug inline-flex items-center gap-1.5 max-w-full">
                              <span className="truncate">{prov.display_name}</span>
                              {level >= 4 && !prov.has_expired_docs && <VerifiedSeal size={16} />}
                            </h3>

                            {showMetaRow && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {showTrustBadge && (
                                  <ProviderTrustBadge
                                    trust={prov.trust_badge}
                                    compact
                                    suppressSeal
                                    labelOverride={
                                      level >= 4 && !prov.has_expired_docs
                                        ? 'Verificado · Pase QR'
                                        : ''
                                    }
                                  />
                                )}
                                {isFeatured && <FeaturedPartnerBadge compact />}
                                {hasRating && (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300">
                                    <Star size={12} className="text-amber-400 fill-amber-400 shrink-0" />
                                    <span>{ratingNum.toFixed(1)}</span>
                                    {reviewsCount > 0 && (
                                      <span className="opacity-70 font-normal">({reviewsCount})</span>
                                    )}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {specs.slice(0, 3).map((spec) => (
                            <span
                              key={spec}
                              className="px-2 py-0.5 rounded-md text-[11px] font-bold border border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                            >
                              {spec}
                            </span>
                          ))}
                          {specs.length > 3 && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border border-white/15 bg-white/5 opacity-80">
                              +{specs.length - 3}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 2. Línea única de reputación y señales clave */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] opacity-85">
                        <span className="inline-flex items-center gap-1.5 font-semibold">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${repMeta.dotClass}`} />
                          <span>{repMeta.label}</span>
                        </span>
                        <span className="opacity-50">·</span>
                        <span>
                          {jobsCount > 0
                            ? `${jobsCount} trabajo${jobsCount === 1 ? '' : 's'}`
                            : isVerified
                              ? 'Pase QR listo'
                              : 'Solo consultas'}
                        </span>
                        {prov.accepts_emergencies && !prov.has_expired_docs ? (
                          <>
                            <span className="opacity-50">·</span>
                            <span className="text-rose-300 font-bold">Urgencias 24h</span>
                          </>
                        ) : prov.available_today && !prov.has_expired_docs ? (
                          <>
                            <span className="opacity-50">·</span>
                            <span className="text-emerald-300 font-semibold">Disponible hoy</span>
                          </>
                        ) : null}
                        {prov.quote_visit_policy === 'sin_cargo' && (
                          <>
                            <span className="opacity-50">·</span>
                            <span className="text-emerald-300 font-semibold">Presupuesto s/cargo</span>
                          </>
                        )}
                        {Array.isArray(prov.service_packages) && prov.service_packages.length > 0 && (
                          <>
                            <span className="opacity-50">·</span>
                            <span className="text-emerald-300 font-semibold font-mono">
                              Desde $
                              {Math.min(
                                ...prov.service_packages
                                  .map((p) => Number(p.fixed_price || 0))
                                  .filter((n) => n > 0)
                              ).toLocaleString('es-AR')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 3. Dos acciones limpias e idénticas al Portal Residente */}
                    <div className="pt-3 border-t border-white/10 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedProfileModal(prov)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold border border-white/15 bg-white/5 hover:bg-white/10 opacity-90 hover:opacity-100 cursor-pointer shrink-0 transition-colors"
                      >
                        Ver ficha
                      </button>
                      {isVerified ? (
                        <button
                          type="button"
                          onClick={() => persistIntentAndLogin(specs[0] || prov.display_name)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm hover:opacity-95 cursor-pointer"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <span>Solicitar visita</span>
                          <ArrowRight size={13} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => persistIntentAndLogin(specs[0] || prov.display_name)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-sky-400/45 bg-sky-500/12 text-sky-100 hover:bg-sky-500/22 cursor-pointer"
                        >
                          <MessageSquare size={13} />
                          <span>Consultar</span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {filteredShowcase.length > 9 && (
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

      {/* 3. CÓMO FUNCIONA EN 3 PASOS (debajo de los prestadores, compacto) */}
      <div
        id="como-funciona"
        className={`rounded-2xl p-5 sm:p-6 border border-emerald-500/30 space-y-4 scroll-mt-6`}
        style={cardStyle}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              <QrCode size={13} />
              <span>Cómo funciona</span>
            </span>
            <h2 className="text-base sm:text-xl font-black tracking-tight">
              Del pedido al ingreso en garita en 3 pasos simples
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => goRegisterWithRole('owner')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white hover:opacity-95 cursor-pointer"
              style={{ backgroundColor: primaryColor }}
            >
              <span>Crear cuenta gratis</span>
              <ArrowRight size={13} />
            </button>
            <button
              type="button"
              onClick={() => goRegisterWithRole('provider')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border ${subtleBorder} hover:opacity-90 cursor-pointer`}
              style={innerStyle}
            >
              <span>Soy prestador</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              step: '01',
              title: 'Elegís un perfil con respaldo',
              desc: 'Comparás nivel N1–N4, documentación vigente (DNI, Seguro AP/ART y antecedentes penales) y reseñas reales.',
            },
            {
              step: '02',
              title: 'Coordinás visita y emitís QR',
              desc: 'Acordás horario en la plataforma y generás un Pase QR con patente y cuadrilla.',
            },
            {
              step: '03',
              title: 'Ingreso ágil y conformidad',
              desc: 'La garita valida el QR en segundos. Al finalizar, registrás conformidad y reseña.',
            },
          ].map((item) => (
            <div
              key={item.step}
              className={`rounded-xl p-4 border ${subtleBorder} space-y-1`}
              style={innerStyle}
            >
              <span className="inline-block text-[10px] font-mono font-black text-emerald-400">
                PASO {item.step}
              </span>
              <h3 className="text-xs sm:text-sm font-extrabold">{item.title}</h3>
              <p className="text-xs opacity-75 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 4. PROPUESTA DE VALOR POR ACTOR (Residentes · Prestadores · Barrios y Garitas) */}
      <div id="actores" className="grid grid-cols-1 md:grid-cols-3 gap-3.5 scroll-mt-6">
        {ACTOR_BENEFITS.map((actor) => {
          const Icon = actor.icon;
          return (
            <div
              key={actor.id}
              className={`rounded-2xl p-4 sm:p-5 border ${borderTone} space-y-2.5`}
              style={cardStyle}
            >
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                <Icon size={12} />
                <span>{actor.badge}</span>
              </span>
              <h3 className="text-sm font-extrabold leading-snug">{actor.title}</h3>
              <ul className="space-y-1.5 text-xs opacity-80 leading-relaxed">
                {actor.points.map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* MODAL PÚBLICO "VER FICHA" (respaldo documental + reputación sin exponer PII) */}
      {selectedProfileModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedProfileModal(null)}
        >
          <div
            className={`w-full max-w-lg rounded-2xl border ${subtleBorder} shadow-2xl overflow-hidden`}
            style={cardStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`px-5 py-4 border-b ${borderTone} flex items-start justify-between gap-3`}>
              <div className="space-y-1.5 min-w-0">
                <h3 className="text-base sm:text-lg font-black inline-flex items-center gap-1.5 max-w-full">
                  <span className="truncate">{selectedProfileModal.display_name}</span>
                  {Number(selectedProfileModal.trust_level ?? selectedProfileModal.trust_badge?.level ?? 0) >= 4 &&
                    !selectedProfileModal.has_expired_docs && <VerifiedSeal size={18} />}
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <ProviderTrustBadge
                    trust={selectedProfileModal.trust_badge}
                    showScale
                    compact
                    suppressSeal
                  />
                  {Number(selectedProfileModal.rating_avg || 0) > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300">
                      <Star size={12} className="fill-amber-400 text-amber-400" />
                      <span>{Number(selectedProfileModal.rating_avg).toFixed(1)}</span>
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {getShowcaseSpecialties(selectedProfileModal).map((spec) => (
                    <span
                      key={spec}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProfileModal(null)}
                aria-label="Cerrar ficha"
                className="p-1.5 rounded-lg opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Checks de verificación en orden estandarizado: DNI → ART → Antecedentes → Pase QR */}
              <div className={`rounded-xl p-3.5 border ${subtleBorder} space-y-2`} style={innerStyle}>
                <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">
                  Respaldo documental vigente
                </p>
                <TrustChecksStrip
                  trust={selectedProfileModal.trust_badge}
                  hasExpiredDocs={Boolean(selectedProfileModal.has_expired_docs)}
                />
              </div>

              {selectedProfileModal.service_bio && (
                <p className="text-xs opacity-85 leading-relaxed">
                  {selectedProfileModal.service_bio}
                </p>
              )}

              {Array.isArray(selectedProfileModal.service_packages) &&
                selectedProfileModal.service_packages.length > 0 && (
                  <div className="rounded-xl p-3.5 border border-emerald-500/30 bg-emerald-950/20 space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                      Servicios con precio fijo ({selectedProfileModal.service_packages.length})
                    </p>
                    <div className="space-y-1.5">
                      {selectedProfileModal.service_packages.slice(0, 4).map((pkg) => (
                        <div
                          key={pkg.id}
                          className="flex items-center justify-between gap-2 text-xs px-2.5 py-1.5 rounded-lg border border-white/10"
                          style={innerStyle}
                        >
                          <span className="font-semibold truncate">
                            {pkg.title}{' '}
                            <span className="text-[10px] opacity-70">
                              (~{pkg.estimated_duration_minutes || 60} min)
                            </span>
                          </span>
                          <span className="font-mono font-bold text-emerald-300 shrink-0">
                            ${Number(pkg.fixed_price || 0).toLocaleString('es-AR')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs opacity-80">
                <span>
                  {QUOTE_POLICY_LABELS[selectedProfileModal.quote_visit_policy] ||
                    'Presupuesto a consultar'}
                </span>
                {INVOICE_LABELS[selectedProfileModal.invoice_type] && (
                  <span>· {INVOICE_LABELS[selectedProfileModal.invoice_type]}</span>
                )}
                <span>
                  ·{' '}
                  {Number(selectedProfileModal.completed_jobs || 0) > 0
                    ? `${selectedProfileModal.completed_jobs} trabajo(s) conformado(s)`
                    : 'Sin trabajos registrados aún'}
                </span>
              </div>

              {selectedProfileModal.reputation && (
                <div className={`rounded-xl p-3.5 border ${subtleBorder}`} style={innerStyle}>
                  <ReputationThermometer reputation={selectedProfileModal.reputation} compact />
                </div>
              )}

              <div className={`pt-3 border-t ${borderTone} flex items-center justify-between gap-3`}>
                <span className="inline-flex items-center gap-1.5 text-[11px] opacity-75">
                  <Lock size={12} className="shrink-0" />
                  <span>Contacto, agenda y Pases QR al ingresar</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const targetSpec = getShowcaseSpecialties(selectedProfileModal)[0];
                    setSelectedProfileModal(null);
                    persistIntentAndLogin(targetSpec || selectedProfileModal.display_name);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white hover:opacity-95 cursor-pointer shrink-0"
                  style={{ backgroundColor: primaryColor }}
                >
                  <span>Ingresar para consultar</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
