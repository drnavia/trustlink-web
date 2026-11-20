/**
 * @file BrandingContext.jsx
 * @description Contexto modular para gestionar la apariencia global de TrustLink:
 * fondos (plataforma, menú, sub-menú), tipografías (plataforma, menú, sub-menú),
 * logo institucional opcional (SVG, PNG, JPG) y modo oscuro/claro, sincronizado
 * con PostgreSQL vía /api/v1/branding con fondo de plataforma unificado en todas las vistas.
 * @location /trustlink-web/src/modules/branding/BrandingContext.jsx
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:4000';

// Valores iniciales por defecto de TrustLink
export const DEFAULT_BRANDING_CONFIG = {
  platformBgColor: '#0F172A',
  menuBgColor: '#020617',
  submenuBgColor: '#090D16',
  platformTextColor: '#F1F5F9',
  menuTextColor: '#E2E8F0',
  submenuTextColor: '#CBD5E1',
  logoUrl: null,
  darkMode: true,
};

const BrandingContext = createContext(null);

/**
 * Convierte un color hexadecimal #RRGGBB a { r, g, b }.
 * @param {string} hex
 */
const hexToRgb = (hex) => {
  if (typeof hex !== 'string') return { r: 15, g: 23, b: 42 };
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return { r: 15, g: 23, b: 42 };
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return { r: 15, g: 23, b: 42 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
};

/**
 * Calcula luminancia relativa aproximada (0 oscuro .. 1 claro) de un color #RRGGBB.
 * @param {string} hex
 */
const getRelativeLuminance = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (c8) => {
    const c = c8 / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

/**
 * Ajusta un color #RRGGBB sumando o restando luminosidad (delta entre -0.5 y 0.5).
 * @param {string} hex
 * @param {number} delta
 */
const shiftHex = (hex, delta) => {
  const { r, g, b } = hexToRgb(hex);
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  const shift = delta * 255;
  return `#${[clamp(r + shift), clamp(g + shift), clamp(b + shift)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
};

/**
 * Normaliza la estructura de /api/v1/branding al estado camelCase del frontend.
 * @param {Record<string, any>} raw
 */
const mapBackendBrandingToState = (raw = {}) => ({
  platformBgColor:
    raw.platform_bg_color ||
    raw.platformBgColor ||
    DEFAULT_BRANDING_CONFIG.platformBgColor,
  menuBgColor:
    raw.menu_bg_color ||
    raw.menuBgColor ||
    DEFAULT_BRANDING_CONFIG.menuBgColor,
  submenuBgColor:
    raw.submenu_bg_color ||
    raw.submenuBgColor ||
    DEFAULT_BRANDING_CONFIG.submenuBgColor,
  platformTextColor:
    raw.platform_text_color ||
    raw.platformTextColor ||
    DEFAULT_BRANDING_CONFIG.platformTextColor,
  menuTextColor:
    raw.menu_text_color ||
    raw.menuTextColor ||
    DEFAULT_BRANDING_CONFIG.menuTextColor,
  submenuTextColor:
    raw.submenu_text_color ||
    raw.submenuTextColor ||
    DEFAULT_BRANDING_CONFIG.submenuTextColor,
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
   * Obtiene los ajustes activos desde el backend.
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
      console.error('[BrandingContext] Error al cargar apariencia:', error);
    } finally {
      setLoadingBrand(false);
    }
  }, []);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  /**
   * Propaga fondos, tipografías y modo oscuro/claro usando directamente
   * el color de fondo de la plataforma en todas las vistas.
   */
  useEffect(() => {
    const root = document.documentElement;
    const isDark = Boolean(brand.darkMode);

    const platformBg = brand.platformBgColor || DEFAULT_BRANDING_CONFIG.platformBgColor;
    const menuBg = brand.menuBgColor || DEFAULT_BRANDING_CONFIG.menuBgColor;
    const submenuBg = brand.submenuBgColor || DEFAULT_BRANDING_CONFIG.submenuBgColor;
    const platformText = brand.platformTextColor || DEFAULT_BRANDING_CONFIG.platformTextColor;
    const menuText = brand.menuTextColor || DEFAULT_BRANDING_CONFIG.menuTextColor;
    const submenuText = brand.submenuTextColor || DEFAULT_BRANDING_CONFIG.submenuTextColor;

    const platformLum = getRelativeLuminance(platformBg);
    const isLightPlatform = platformLum > 0.45;

    // Usamos un tono muy cercano y coherente con platformBg para tarjetas y bloques
    // para que todas las vistas compartan el mismo color de fondo sin oscurecerse
    const cardBg = isLightPlatform
      ? shiftHex(platformBg, -0.04)
      : shiftHex(platformBg, 0.03);

    const mutedBg = isLightPlatform
      ? shiftHex(platformBg, -0.08)
      : shiftHex(platformBg, 0.06);

    const borderColor = isLightPlatform
      ? shiftHex(platformBg, -0.16)
      : shiftHex(platformBg, 0.14);

    const secondaryTextColor = isLightPlatform ? '#334155' : '#E2E8F0';

    root.style.setProperty('--tl-platform-bg', platformBg);
    root.style.setProperty('--tl-menu-bg', menuBg);
    root.style.setProperty('--tl-submenu-bg', submenuBg);
    root.style.setProperty('--tl-platform-text', platformText);
    root.style.setProperty('--tl-menu-text', menuText);
    root.style.setProperty('--tl-submenu-text', submenuText);
    root.style.setProperty('--tl-card-bg', cardBg);
    root.style.setProperty('--tl-muted-bg', mutedBg);
    root.style.setProperty('--tl-border-color', borderColor);
    root.style.setProperty('--tl-secondary-text', secondaryTextColor);

    root.classList.toggle('dark', isDark);
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');

    const styleId = 'trustlink-appearance-dynamic-styles';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = `
      html, body, #root, main, .tl-platform-surface {
        background-color: var(--tl-platform-bg) !important;
        color: var(--tl-platform-text) !important;
      }

      .tl-menu-surface {
        background-color: var(--tl-menu-bg) !important;
        color: var(--tl-menu-text) !important;
      }

      .tl-submenu-surface {
        background-color: var(--tl-submenu-bg) !important;
        color: var(--tl-submenu-text) !important;
      }

      /* Superficies coherentes con el fondo de la plataforma en todas las vistas */
      .tl-platform-surface [class*="bg-slate-950"],
      .tl-platform-surface [class*="bg-slate-900"] {
        background-color: var(--tl-card-bg) !important;
      }

      .tl-platform-surface [class*="bg-slate-800"] {
        background-color: var(--tl-muted-bg) !important;
      }

      .tl-platform-surface [class*="border-slate-800"],
      .tl-platform-surface [class*="border-slate-700"] {
        border-color: var(--tl-border-color) !important;
      }

      .tl-platform-surface .text-white,
      .tl-platform-surface .text-slate-100,
      .tl-platform-surface .text-slate-200 {
        color: var(--tl-platform-text) !important;
      }

      .tl-platform-surface .text-slate-300,
      .tl-platform-surface .text-slate-400 {
        color: var(--tl-secondary-text) !important;
      }

      .tl-platform-surface input,
      .tl-platform-surface select,
      .tl-platform-surface textarea {
        background-color: ${isLightPlatform ? '#FFFFFF' : cardBg} !important;
        color: ${isLightPlatform ? '#0F172A' : platformText} !important;
        border-color: var(--tl-border-color) !important;
      }
    `;
  }, [
    brand.platformBgColor,
    brand.menuBgColor,
    brand.submenuBgColor,
    brand.platformTextColor,
    brand.menuTextColor,
    brand.submenuTextColor,
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
   * Persiste los cambios en PostgreSQL vía PUT /api/v1/branding.
   */
  const saveBranding = async (nextConfig) => {
    const token = localStorage.getItem('trustlink_token') || '';
    const payload = {
      platform_bg_color: nextConfig.platformBgColor,
      menu_bg_color: nextConfig.menuBgColor,
      submenu_bg_color: nextConfig.submenuBgColor,
      platform_text_color: nextConfig.platformTextColor,
      menu_text_color: nextConfig.menuTextColor,
      submenu_text_color: nextConfig.submenuTextColor,
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
   * Restaura los valores por defecto en PostgreSQL.
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
        loadingBrand,
        fetchBranding,
        previewBranding,
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