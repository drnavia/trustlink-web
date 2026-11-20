/**
 * @file BrandingContext.jsx
 * @description Contexto modular para gestionar la apariencia global de TrustLink:
 * fondos y tipografías de las Zonas 1 a 6 (Menú, Sub-menú, Plataforma general,
 * Tarjetas principales, Cajas internas y Footer), logo opcional (SVG, PNG, JPG),
 * modo oscuro/claro y presets de piel (clásicos y llamativos), sincronizado con
 * PostgreSQL vía /api/v1/branding.
 * @location /trustlink-web/src/modules/branding/BrandingContext.jsx
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:4000';

// Presets estándar y visuales/llamativos para probar estilos al instante antes de guardar
export const BRANDING_PRESETS = {
  default: {
    id: 'default',
    name: 'Por Defecto (Grafito Profundo)',
    description: 'Estética oscura sobria de alto contraste para operación continua.',
    config: {
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
  },
  countryClub: {
    id: 'countryClub',
    name: 'Country Club Clásico',
    description: 'Azul institucional profundo con contraste cálido en tarjetas y cajas.',
    config: {
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
  },
  lightDay: {
    id: 'lightDay',
    name: 'Luminoso Residencial (Día)',
    description: 'Esquema claro minimalista con alta legibilidad en todas las zonas.',
    config: {
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
  },
  graphiteTech: {
    id: 'graphiteTech',
    name: 'Grafito Operativo',
    description: 'Escala neutra tipo carbón para lectura técnica prolongada.',
    config: {
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
  emeraldPerimeter: {
    id: 'emeraldPerimeter',
    name: 'Esmeralda Perimetral',
    description: 'Tonos esmeralda profundos y frescos inspirados en accesos verificados.',
    config: {
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
  midnightViolet: {
    id: 'midnightViolet',
    name: 'Medianoche Violeta',
    description: 'Piel visual nocturna en violeta e índigo intenso con textos vibrantes.',
    config: {
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
  amberSunset: {
    id: 'amberSunset',
    name: 'Atardecer Ámbar',
    description: 'Estética cálida en tonos cobre y espresso con acentos dorados.',
    config: {
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
  },
  cyanUrban: {
    id: 'cyanUrban',
    name: 'Cian Urbano (Día)',
    description: 'Piel clara y luminosa en tonos agua y azul marino de alto contraste.',
    config: {
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
  },
};

// Configuración inicial por defecto de TrustLink (estética oscura y sobria)
export const DEFAULT_BRANDING_CONFIG = {
  ...BRANDING_PRESETS.default.config,
  logoUrl: null,
};

const BrandingContext = createContext(null);

/**
 * Normaliza la estructura de /api/v1/branding al estado camelCase del frontend.
 * @param {Record<string, any>} raw
 */
const mapBackendBrandingToState = (raw = {}) => ({
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
});

export const BrandingProvider = ({ children }) => {
  const [brand, setBrand] = useState({
    name: 'TrustLink',
    countryName: 'TrustLink Community',
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
    setBrand((prev) => ({
      ...prev,
      ...partial,
    }));
  };

  /**
   * Aplica un preset de piel en vivo conservando el logo actual si el usuario ya subió uno.
   */
  const applyBrandingPreset = (presetKey) => {
    const selectedPreset = BRANDING_PRESETS[presetKey] || BRANDING_PRESETS.default;
    setBrand((prev) => ({
      ...prev,
      ...selectedPreset.config,
    }));
    return selectedPreset.config;
  };

  /**
   * Persiste los cambios de apariencia en PostgreSQL vía PUT /api/v1/branding.
   */
  const saveBranding = async (nextConfig) => {
    const token = localStorage.getItem('trustlink_token') || '';
    const payload = {
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