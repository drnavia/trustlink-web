/**
 * @file BrandingContext.jsx
 * @description Contexto modular para gestionar la apariencia global de TrustLink:
 * identidad opcional del menú (brandName, brandBadge, brandSubtitle),
 * fondos y tipografías de las Zonas 1 a 6, logo opcional (SVG, PNG, JPG),
 * modo oscuro/claro funcional y 12 presets de piel (6 Dark + 6 Light) con pares
 * explícitos dark/light, sincronizado con PostgreSQL vía /api/v1/branding.
 * @location /trustlink-web/src/modules/branding/BrandingContext.jsx
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../config/api'; // Ajustá la cantidad de ../ según la carpeta del archivo

/* const API_BASE = 'http://localhost:4000'; */

// 12 Presets (6 Dark en fila superior + 6 Light en fila inferior), cada uno con su par explícito dark/light
export const BRANDING_PRESETS = {
  // --- FILA 1: 6 PRESETS DARK ---
  default: {
    id: 'default',
    group: 'dark',
    name: 'Por Defecto',
    description: 'Grafito profundo de alto contraste para operación continua.',
    defaultMode: 'dark',
    variants: {
      dark: {
        menuBgColor: '#020617',
        menuTextColor: '#E2E8F0',
        submenuBgColor: '#090D16',
        submenuTextColor: '#CBD5E1',
        platformBgColor: '#0F172A',
        platformTextColor: '#F1F5F9',
        cardBgColor: '#020617',
        cardTextColor: '#F1F5F9',
        innerBgColor: '#0F172A',
        innerTextColor: '#E2E8F0',
        footerBgColor: '#020617',
        footerTextColor: '#94A3B8',
        darkMode: true,
      },
      light: {
        menuBgColor: '#FFFFFF',
        menuTextColor: '#0F172A',
        submenuBgColor: '#E2E8F0',
        submenuTextColor: '#1E293B',
        platformBgColor: '#F1F5F9',
        platformTextColor: '#0F172A',
        cardBgColor: '#FFFFFF',
        cardTextColor: '#0F172A',
        innerBgColor: '#F8FAFC',
        innerTextColor: '#334155',
        footerBgColor: '#E2E8F0',
        footerTextColor: '#475569',
        darkMode: false,
      },
    },
  },
  countryClub: {
    id: 'countryClub',
    group: 'dark',
    name: 'Country Club',
    description: 'Azul institucional profundo con contraste cálido en tarjetas.',
    defaultMode: 'dark',
    variants: {
      dark: {
        menuBgColor: '#0B192C',
        menuTextColor: '#F8FAFC',
        submenuBgColor: '#11223A',
        submenuTextColor: '#CBD5E1',
        platformBgColor: '#162A45',
        platformTextColor: '#F1F5F9',
        cardBgColor: '#0B192C',
        cardTextColor: '#F8FAFC',
        innerBgColor: '#1D3557',
        innerTextColor: '#E2E8F0',
        footerBgColor: '#0B192C',
        footerTextColor: '#94A3B8',
        darkMode: true,
      },
      light: {
        menuBgColor: '#EFF6FF',
        menuTextColor: '#0B192C',
        submenuBgColor: '#DBEAFE',
        submenuTextColor: '#1E3A8A',
        platformBgColor: '#F0F5FA',
        platformTextColor: '#0F172A',
        cardBgColor: '#FFFFFF',
        cardTextColor: '#0B192C',
        innerBgColor: '#EFF6FF',
        innerTextColor: '#1E3A5F',
        footerBgColor: '#DBEAFE',
        footerTextColor: '#1E3A8A',
        darkMode: false,
      },
    },
  },
  graphiteTech: {
    id: 'graphiteTech',
    group: 'dark',
    name: 'Grafito',
    description: 'Escala neutra tipo carbón para lectura técnica prolongada.',
    defaultMode: 'dark',
    variants: {
      dark: {
        menuBgColor: '#09090B',
        menuTextColor: '#FAFAFA',
        submenuBgColor: '#18181B',
        submenuTextColor: '#D4D4D8',
        platformBgColor: '#18181B',
        platformTextColor: '#F4F4F5',
        cardBgColor: '#09090B',
        cardTextColor: '#FAFAFA',
        innerBgColor: '#27272A',
        innerTextColor: '#E4E4E7',
        footerBgColor: '#09090B',
        footerTextColor: '#A1A1AA',
        darkMode: true,
      },
      light: {
        menuBgColor: '#FAFAFA',
        menuTextColor: '#18181B',
        submenuBgColor: '#E4E4E7',
        submenuTextColor: '#27272A',
        platformBgColor: '#F4F4F5',
        platformTextColor: '#18181B',
        cardBgColor: '#FFFFFF',
        cardTextColor: '#09090B',
        innerBgColor: '#F4F4F5',
        innerTextColor: '#3F3F46',
        footerBgColor: '#E4E4E7',
        footerTextColor: '#52525B',
        darkMode: false,
      },
    },
  },
  emeraldPerimeter: {
    id: 'emeraldPerimeter',
    group: 'dark',
    name: 'Esmeralda',
    description: 'Tonos esmeralda profundos inspirados en accesos verificados.',
    defaultMode: 'dark',
    variants: {
      dark: {
        menuBgColor: '#041F17',
        menuTextColor: '#ECFDF5',
        submenuBgColor: '#072E23',
        submenuTextColor: '#A7F3D0',
        platformBgColor: '#0B3B2D',
        platformTextColor: '#F0FDF4',
        cardBgColor: '#041F17',
        cardTextColor: '#ECFDF5',
        innerBgColor: '#0F4C3A',
        innerTextColor: '#D1FAE5',
        footerBgColor: '#041F17',
        footerTextColor: '#6EE7B7',
        darkMode: true,
      },
      light: {
        menuBgColor: '#ECFDF5',
        menuTextColor: '#064E3B',
        submenuBgColor: '#D1FAE5',
        submenuTextColor: '#065F46',
        platformBgColor: '#F0FDF4',
        platformTextColor: '#052E16',
        cardBgColor: '#FFFFFF',
        cardTextColor: '#064E3B',
        innerBgColor: '#ECFDF5',
        innerTextColor: '#065F46',
        footerBgColor: '#D1FAE5',
        footerTextColor: '#047857',
        darkMode: false,
      },
    },
  },
  midnightViolet: {
    id: 'midnightViolet',
    group: 'dark',
    name: 'Violeta',
    description: 'Piel nocturna en violeta e índigo intenso con textos vibrantes.',
    defaultMode: 'dark',
    variants: {
      dark: {
        menuBgColor: '#120A24',
        menuTextColor: '#F5F3FF',
        submenuBgColor: '#1B1036',
        submenuTextColor: '#DDD6FE',
        platformBgColor: '#241547',
        platformTextColor: '#F5F3FF',
        cardBgColor: '#120A24',
        cardTextColor: '#EDE9FE',
        innerBgColor: '#2E1B5C',
        innerTextColor: '#E9D5FF',
        footerBgColor: '#120A24',
        footerTextColor: '#C4B5FD',
        darkMode: true,
      },
      light: {
        menuBgColor: '#F5F3FF',
        menuTextColor: '#2E1065',
        submenuBgColor: '#EDE9FE',
        submenuTextColor: '#4C1D95',
        platformBgColor: '#FAF5FF',
        platformTextColor: '#1E1B4B',
        cardBgColor: '#FFFFFF',
        cardTextColor: '#2E1065',
        innerBgColor: '#F5F3FF',
        innerTextColor: '#4C1D95',
        footerBgColor: '#EDE9FE',
        footerTextColor: '#5B21B6',
        darkMode: false,
      },
    },
  },
  amberSunset: {
    id: 'amberSunset',
    group: 'dark',
    name: 'Ámbar',
    description: 'Estética cálida en tonos cobre y espresso con acentos dorados.',
    defaultMode: 'dark',
    variants: {
      dark: {
        menuBgColor: '#211108',
        menuTextColor: '#FFFBEB',
        submenuBgColor: '#30190C',
        submenuTextColor: '#FDE68A',
        platformBgColor: '#3E2010',
        platformTextColor: '#FFFBEB',
        cardBgColor: '#211108',
        cardTextColor: '#FEF3C7',
        innerBgColor: '#4F2915',
        innerTextColor: '#FDE68A',
        footerBgColor: '#211108',
        footerTextColor: '#FBBF24',
        darkMode: true,
      },
      light: {
        menuBgColor: '#FFFBEB',
        menuTextColor: '#451A03',
        submenuBgColor: '#FEF3C7',
        submenuTextColor: '#78350F',
        platformBgColor: '#FEF9EE',
        platformTextColor: '#291509',
        cardBgColor: '#FFFFFF',
        cardTextColor: '#451A03',
        innerBgColor: '#FFFBEB',
        innerTextColor: '#78350F',
        footerBgColor: '#FEF3C7',
        footerTextColor: '#92400E',
        darkMode: false,
      },
    },
  },

  // --- FILA 2: 6 PRESETS LIGHT ---
  lightDay: {
    id: 'lightDay',
    group: 'light',
    name: 'Día Clásico',
    description: 'Esquema claro minimalista con alta legibilidad en todas las zonas.',
    defaultMode: 'light',
    variants: {
      light: {
        menuBgColor: '#FFFFFF',
        menuTextColor: '#0F172A',
        submenuBgColor: '#E2E8F0',
        submenuTextColor: '#1E293B',
        platformBgColor: '#F1F5F9',
        platformTextColor: '#0F172A',
        cardBgColor: '#FFFFFF',
        cardTextColor: '#0F172A',
        innerBgColor: '#F8FAFC',
        innerTextColor: '#334155',
        footerBgColor: '#E2E8F0',
        footerTextColor: '#334155',
        darkMode: false,
      },
      dark: {
        menuBgColor: '#020617',
        menuTextColor: '#F1F5F9',
        submenuBgColor: '#0F172A',
        submenuTextColor: '#CBD5E1',
        platformBgColor: '#0F172A',
        platformTextColor: '#F8FAFC',
        cardBgColor: '#020617',
        cardTextColor: '#F1F5F9',
        innerBgColor: '#1E293B',
        innerTextColor: '#E2E8F0',
        footerBgColor: '#020617',
        footerTextColor: '#94A3B8',
        darkMode: true,
      },
    },
  },
  ivoryClub: {
    id: 'ivoryClub',
    group: 'light',
    name: 'Marfil Club',
    description: 'Tonos crema y arena suave estilo club residencial diurno.',
    defaultMode: 'light',
    variants: {
      light: {
        menuBgColor: '#FFFDF9',
        menuTextColor: '#1C1917',
        submenuBgColor: '#F5EFE6',
        submenuTextColor: '#44403C',
        platformBgColor: '#F7F3EB',
        platformTextColor: '#1C1917',
        cardBgColor: '#FFFFFF',
        cardTextColor: '#1C1917',
        innerBgColor: '#FAF6F0',
        innerTextColor: '#44403C',
        footerBgColor: '#EFE8DC',
        footerTextColor: '#57534E',
        darkMode: false,
      },
      dark: {
        menuBgColor: '#1C1917',
        menuTextColor: '#FAF5EE',
        submenuBgColor: '#292524',
        submenuTextColor: '#E7E5E4',
        platformBgColor: '#262220',
        platformTextColor: '#FAF5EE',
        cardBgColor: '#1C1917',
        cardTextColor: '#FAF5EE',
        innerBgColor: '#332E2B',
        innerTextColor: '#E7E5E4',
        footerBgColor: '#1C1917',
        footerTextColor: '#A8A29E',
        darkMode: true,
      },
    },
  },
  alabaster: {
    id: 'alabaster',
    group: 'light',
    name: 'Alabastro',
    description: 'Gris perla limpio y equilibrado para lectura prolongada de día.',
    defaultMode: 'light',
    variants: {
      light: {
        menuBgColor: '#FAFAFA',
        menuTextColor: '#18181B',
        submenuBgColor: '#E4E4E7',
        submenuTextColor: '#27272A',
        platformBgColor: '#F4F4F5',
        platformTextColor: '#18181B',
        cardBgColor: '#FFFFFF',
        cardTextColor: '#18181B',
        innerBgColor: '#F4F4F5',
        innerTextColor: '#3F3F46',
        footerBgColor: '#E4E4E7',
        footerTextColor: '#52525B',
        darkMode: false,
      },
      dark: {
        menuBgColor: '#09090B',
        menuTextColor: '#FAFAFA',
        submenuBgColor: '#18181B',
        submenuTextColor: '#D4D4D8',
        platformBgColor: '#18181B',
        platformTextColor: '#F4F4F5',
        cardBgColor: '#09090B',
        cardTextColor: '#FAFAFA',
        innerBgColor: '#27272A',
        innerTextColor: '#E4E4E7',
        footerBgColor: '#09090B',
        footerTextColor: '#A1A1AA',
        darkMode: true,
      },
    },
  },
  mintDay: {
    id: 'mintDay',
    group: 'light',
    name: 'Menta Día',
    description: 'Verde menta claro y fresco con textos bosque de alto contraste.',
    defaultMode: 'light',
    variants: {
      light: {
        menuBgColor: '#ECFDF5',
        menuTextColor: '#064E3B',
        submenuBgColor: '#D1FAE5',
        submenuTextColor: '#065F46',
        platformBgColor: '#F0FDF4',
        platformTextColor: '#052E16',
        cardBgColor: '#FFFFFF',
        cardTextColor: '#064E3B',
        innerBgColor: '#ECFDF5',
        innerTextColor: '#065F46',
        footerBgColor: '#D1FAE5',
        footerTextColor: '#047857',
        darkMode: false,
      },
      dark: {
        menuBgColor: '#041F17',
        menuTextColor: '#ECFDF5',
        submenuBgColor: '#072E23',
        submenuTextColor: '#A7F3D0',
        platformBgColor: '#0B3B2D',
        platformTextColor: '#F0FDF4',
        cardBgColor: '#041F17',
        cardTextColor: '#ECFDF5',
        innerBgColor: '#0F4C3A',
        innerTextColor: '#D1FAE5',
        footerBgColor: '#041F17',
        footerTextColor: '#6EE7B7',
        darkMode: true,
      },
    },
  },
  lavenderDay: {
    id: 'lavenderDay',
    group: 'light',
    name: 'Lavanda Día',
    description: 'Tonos lavanda luminosos con tipografía índigo profundo.',
    defaultMode: 'light',
    variants: {
      light: {
        menuBgColor: '#F5F3FF',
        menuTextColor: '#2E1065',
        submenuBgColor: '#EDE9FE',
        submenuTextColor: '#4C1D95',
        platformBgColor: '#FAF5FF',
        platformTextColor: '#1E1B4B',
        cardBgColor: '#FFFFFF',
        cardTextColor: '#2E1065',
        innerBgColor: '#F5F3FF',
        innerTextColor: '#4C1D95',
        footerBgColor: '#EDE9FE',
        footerTextColor: '#5B21B6',
        darkMode: false,
      },
      dark: {
        menuBgColor: '#120A24',
        menuTextColor: '#F5F3FF',
        submenuBgColor: '#1B1036',
        submenuTextColor: '#DDD6FE',
        platformBgColor: '#241547',
        platformTextColor: '#F5F3FF',
        cardBgColor: '#120A24',
        cardTextColor: '#EDE9FE',
        innerBgColor: '#2E1B5C',
        innerTextColor: '#E9D5FF',
        footerBgColor: '#120A24',
        footerTextColor: '#C4B5FD',
        darkMode: true,
      },
    },
  },
  cyanUrban: {
    id: 'cyanUrban',
    group: 'light',
    name: 'Cian Urbano',
    description: 'Piel clara en tonos agua y azul marino de alto contraste.',
    defaultMode: 'light',
    variants: {
      light: {
        menuBgColor: '#ECFEFF',
        menuTextColor: '#083344',
        submenuBgColor: '#CFFAFE',
        submenuTextColor: '#155E75',
        platformBgColor: '#E0F2FE',
        platformTextColor: '#0F172A',
        cardBgColor: '#FFFFFF',
        cardTextColor: '#0F172A',
        innerBgColor: '#F0F9FF',
        innerTextColor: '#1E293B',
        footerBgColor: '#CFFAFE',
        footerTextColor: '#164E63',
        darkMode: false,
      },
      dark: {
        menuBgColor: '#041E26',
        menuTextColor: '#ECFEFF',
        submenuBgColor: '#082F3B',
        submenuTextColor: '#A5F3FC',
        platformBgColor: '#0C3D4D',
        platformTextColor: '#F0F9FF',
        cardBgColor: '#041E26',
        cardTextColor: '#ECFEFF',
        innerBgColor: '#114E63',
        innerTextColor: '#CFFAFE',
        footerBgColor: '#041E26',
        footerTextColor: '#67E8F9',
        darkMode: true,
      },
    },
  },
};

// Configuración inicial por defecto de TrustLink
export const DEFAULT_BRANDING_CONFIG = {
  brandName: 'TrustLink',
  brandBadge: 'Community',
  brandSubtitle: 'Red de Confianza Residencial',
  ...BRANDING_PRESETS.default.variants.dark,
  logoUrl: null,
};

const BrandingContext = createContext(null);

/**
 * Normaliza la estructura de /api/v1/branding al estado camelCase del frontend.
 * @param {Record<string, any>} raw
 */
const mapBackendBrandingToState = (raw = {}) => {
  const resolvedBrandName =
    raw.brand_name || raw.brandName || DEFAULT_BRANDING_CONFIG.brandName;
  const resolvedBrandBadge =
    raw.brand_badge || raw.brandBadge || DEFAULT_BRANDING_CONFIG.brandBadge;
  const resolvedBrandSubtitle =
    raw.brand_subtitle || raw.brandSubtitle || DEFAULT_BRANDING_CONFIG.brandSubtitle;

  return {
    name: resolvedBrandName,
    brandName: resolvedBrandName,
    brandBadge: resolvedBrandBadge,
    brandSubtitle: resolvedBrandSubtitle,
    countryName: `${resolvedBrandName} ${resolvedBrandBadge}`.trim(),
    menuBgColor:
      raw.menu_bg_color || raw.menuBgColor || DEFAULT_BRANDING_CONFIG.menuBgColor,
    menuTextColor:
      raw.menu_text_color || raw.menuTextColor || DEFAULT_BRANDING_CONFIG.menuTextColor,
    submenuBgColor:
      raw.submenu_bg_color || raw.submenuBgColor || DEFAULT_BRANDING_CONFIG.submenuBgColor,
    submenuTextColor:
      raw.submenu_text_color || raw.submenuTextColor || DEFAULT_BRANDING_CONFIG.submenuTextColor,
    platformBgColor:
      raw.platform_bg_color || raw.platformBgColor || DEFAULT_BRANDING_CONFIG.platformBgColor,
    platformTextColor:
      raw.platform_text_color || raw.platformTextColor || DEFAULT_BRANDING_CONFIG.platformTextColor,
    cardBgColor:
      raw.card_bg_color || raw.cardBgColor || DEFAULT_BRANDING_CONFIG.cardBgColor,
    cardTextColor:
      raw.card_text_color || raw.cardTextColor || DEFAULT_BRANDING_CONFIG.cardTextColor,
    innerBgColor:
      raw.inner_bg_color || raw.innerBgColor || DEFAULT_BRANDING_CONFIG.innerBgColor,
    innerTextColor:
      raw.inner_text_color || raw.innerTextColor || DEFAULT_BRANDING_CONFIG.innerTextColor,
    footerBgColor:
      raw.footer_bg_color ||
      raw.footerBgColor ||
      raw.menu_bg_color ||
      DEFAULT_BRANDING_CONFIG.footerBgColor,
    footerTextColor:
      raw.footer_text_color || raw.footerTextColor || DEFAULT_BRANDING_CONFIG.footerTextColor,
    logoUrl:
      raw.logo_url !== undefined
        ? raw.logo_url
        : raw.logoUrl !== undefined
        ? raw.logoUrl
        : DEFAULT_BRANDING_CONFIG.logoUrl,
    darkMode:
      typeof raw.dark_mode === 'boolean'
        ? raw.dark_mode
        : typeof raw.darkMode === 'boolean'
        ? raw.darkMode
        : DEFAULT_BRANDING_CONFIG.darkMode,
  };
};

export const BrandingProvider = ({ children }) => {
  const [brand, setBrand] = useState({
    name: DEFAULT_BRANDING_CONFIG.brandName,
    countryName: `${DEFAULT_BRANDING_CONFIG.brandName} ${DEFAULT_BRANDING_CONFIG.brandBadge}`,
    ...DEFAULT_BRANDING_CONFIG,
    updatedAt: null,
  });

  const [defaults, setDefaults] = useState(DEFAULT_BRANDING_CONFIG);
  const [loadingBrand, setLoadingBrand] = useState(true);

  /**
   * Consulta la configuración vigente desde el backend.
   */
  const fetchBranding = useCallback(async () => {
    setLoadingBrand(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/branding`);
      const data = await response.json();

      if (response.ok && data.branding) {
        const mapped = mapBackendBrandingToState(data.branding);
        setBrand((prev) => ({
          ...prev,
          ...mapped,
          updatedAt: data.branding.updated_at || null,
        }));

        if (data.defaults) {
          setDefaults(mapBackendBrandingToState(data.defaults));
        }
      }
    } catch (error) {
      console.error('[BrandingContext] Error al cargar configuración de apariencia:', error);
    } finally {
      setLoadingBrand(false);
    }
  }, []);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  /**
   * Expone las variables CSS de las Zonas 1 a 6 y sincroniza el atributo de tema.
   */
  useEffect(() => {
    const root = document.documentElement;
    const isDark = Boolean(brand.darkMode);

    const menuBg = brand.menuBgColor || DEFAULT_BRANDING_CONFIG.menuBgColor;
    const menuText = brand.menuTextColor || DEFAULT_BRANDING_CONFIG.menuTextColor;
    const submenuBg = brand.submenuBgColor || DEFAULT_BRANDING_CONFIG.submenuBgColor;
    const submenuText = brand.submenuTextColor || DEFAULT_BRANDING_CONFIG.submenuTextColor;
    const platformBg = brand.platformBgColor || DEFAULT_BRANDING_CONFIG.platformBgColor;
    const platformText = brand.platformTextColor || DEFAULT_BRANDING_CONFIG.platformTextColor;
    const cardBg = brand.cardBgColor || DEFAULT_BRANDING_CONFIG.cardBgColor;
    const cardText = brand.cardTextColor || DEFAULT_BRANDING_CONFIG.cardTextColor;
    const innerBg = brand.innerBgColor || DEFAULT_BRANDING_CONFIG.innerBgColor;
    const innerText = brand.innerTextColor || DEFAULT_BRANDING_CONFIG.innerTextColor;
    const footerBg = brand.footerBgColor || DEFAULT_BRANDING_CONFIG.footerBgColor;
    const footerText = brand.footerTextColor || DEFAULT_BRANDING_CONFIG.footerTextColor;

    root.style.setProperty('--tl-menu-bg', menuBg);
    root.style.setProperty('--tl-menu-text', menuText);
    root.style.setProperty('--tl-submenu-bg', submenuBg);
    root.style.setProperty('--tl-submenu-text', submenuText);
    root.style.setProperty('--tl-platform-bg', platformBg);
    root.style.setProperty('--tl-platform-text', platformText);
    root.style.setProperty('--tl-card-bg', cardBg);
    root.style.setProperty('--tl-card-text', cardText);
    root.style.setProperty('--tl-inner-bg', innerBg);
    root.style.setProperty('--tl-inner-text', innerText);
    root.style.setProperty('--tl-footer-bg', footerBg);
    root.style.setProperty('--tl-footer-text', footerText);

    root.classList.toggle('dark', isDark);
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');

    document.body.style.backgroundColor = platformBg;
    document.body.style.color = platformText;
  }, [
    brand.menuBgColor,
    brand.menuTextColor,
    brand.submenuBgColor,
    brand.submenuTextColor,
    brand.platformBgColor,
    brand.platformTextColor,
    brand.cardBgColor,
    brand.cardTextColor,
    brand.innerBgColor,
    brand.innerTextColor,
    brand.footerBgColor,
    brand.footerTextColor,
    brand.darkMode,
  ]);

  /**
   * Actualiza localmente el estado de apariencia para vista previa en vivo.
   */
  const previewBranding = (partial) => {
    setBrand((prev) => {
      const nextName =
        partial.brandName !== undefined
          ? partial.brandName || DEFAULT_BRANDING_CONFIG.brandName
          : prev.brandName;
      const nextBadge =
        partial.brandBadge !== undefined
          ? partial.brandBadge || DEFAULT_BRANDING_CONFIG.brandBadge
          : prev.brandBadge;

      return {
        ...prev,
        ...partial,
        name: nextName,
        countryName: `${nextName} ${nextBadge}`.trim(),
      };
    });
  };

  /**
   * Aplica un preset de piel en vivo (con su variante dark o light explícita),
   * conservando logo e identidad del menú actuales.
   */
  const applyBrandingPreset = (presetKey, overrideMode = null) => {
    const selectedPreset = BRANDING_PRESETS[presetKey] || BRANDING_PRESETS.default;
    const targetMode = overrideMode || selectedPreset.defaultMode || 'dark';
    const variantConfig =
      selectedPreset.variants[targetMode] || selectedPreset.variants.dark;

    setBrand((prev) => ({
      ...prev,
      ...variantConfig,
    }));
    return variantConfig;
  };

  /**
   * Persiste los cambios de apariencia e identidad en PostgreSQL vía PUT /api/v1/branding.
   */
  const saveBranding = async (nextConfig) => {
    const token = localStorage.getItem('trustlink_token') || '';
    const payload = {
      brand_name: (nextConfig.brandName || '').trim() || DEFAULT_BRANDING_CONFIG.brandName,
      brand_badge: (nextConfig.brandBadge || '').trim() || DEFAULT_BRANDING_CONFIG.brandBadge,
      brand_subtitle:
        (nextConfig.brandSubtitle || '').trim() || DEFAULT_BRANDING_CONFIG.brandSubtitle,
      menu_bg_color: nextConfig.menuBgColor,
      menu_text_color: nextConfig.menuTextColor,
      submenu_bg_color: nextConfig.submenuBgColor,
      submenu_text_color: nextConfig.submenuTextColor,
      platform_bg_color: nextConfig.platformBgColor,
      platform_text_color: nextConfig.platformTextColor,
      card_bg_color: nextConfig.cardBgColor,
      card_text_color: nextConfig.cardTextColor,
      inner_bg_color: nextConfig.innerBgColor,
      inner_text_color: nextConfig.innerTextColor,
      footer_bg_color: nextConfig.footerBgColor,
      footer_text_color: nextConfig.footerTextColor,
      logo_url: nextConfig.logoUrl || null,
      dark_mode: Boolean(nextConfig.darkMode),
    };

    const response = await fetch(`${API_BASE}/api/v1/branding`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'No se pudo guardar la configuración de apariencia.');
    }

    if (data.branding) {
      const mapped = mapBackendBrandingToState(data.branding);
      setBrand((prev) => ({
        ...prev,
        ...mapped,
        updatedAt: data.branding.updated_at || new Date().toISOString(),
      }));
    }

    return data;
  };

  /**
   * Restaura todos los controles a los valores por defecto de TrustLink y los guarda.
   */
  const resetBranding = async () => {
    const targetDefaults = defaults || DEFAULT_BRANDING_CONFIG;
    return saveBranding(targetDefaults);
  };

  return (
    <BrandingContext.Provider
      value={{
        brand,
        defaults,
        presets: BRANDING_PRESETS,
        loadingBrand,
        fetchBranding,
        previewBranding,
        applyBrandingPreset,
        saveBranding,
        resetBranding,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding debe utilizarse dentro de un BrandingProvider.');
  }
  return context;
};