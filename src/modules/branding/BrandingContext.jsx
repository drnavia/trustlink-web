/**
 * @file BrandingContext.jsx
 * @description Contexto modular para gestionar la apariencia global de TrustLink:
 * fondos (plataforma Zona 3, menú Zona 1, sub-menú Zona 2, tarjetas Zona 4 y cajas internas Zona 5),
 * tipografías (plataforma, menú, sub-menú), logo institucional opcional (SVG, PNG, JPG) y modo oscuro/claro,
 * sincronizado con PostgreSQL vía /api/v1/branding.
 * @location /trustlink-web/src/modules/branding/BrandingContext.jsx
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:4000';

// Valores iniciales por defecto de TrustLink (estética oscura y sobria)
export const DEFAULT_BRANDING_CONFIG = {
  platformBgColor: '#0F172A',
  menuBgColor: '#020617',
  submenuBgColor: '#090D16',
  cardBgColor: '#020617',
  innerBgColor: '#0F172A',
  platformTextColor: '#F1F5F9',
  menuTextColor: '#E2E8F0',
  submenuTextColor: '#CBD5E1',
  logoUrl: null,
  darkMode: true,
};

const BrandingContext = createContext(null);

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
  cardBgColor:
    raw.card_bg_color ||
    raw.cardBgColor ||
    DEFAULT_BRANDING_CONFIG.cardBgColor,
  innerBgColor:
    raw.inner_bg_color ||
    raw.innerBgColor ||
    DEFAULT_BRANDING_CONFIG.innerBgColor,
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
   * Aplica directamente los colores explícitos de Zona 1 a Zona 6, tipografías,
   * modo oscuro/claro y suaviza sombras pesadas para evitar halos oscuros.
   */
  useEffect(() => {
    const root = document.documentElement;
    const isDark = Boolean(brand.darkMode);

    const platformBg = brand.platformBgColor || DEFAULT_BRANDING_CONFIG.platformBgColor;
    const menuBg = brand.menuBgColor || DEFAULT_BRANDING_CONFIG.menuBgColor;
    const submenuBg = brand.submenuBgColor || DEFAULT_BRANDING_CONFIG.submenuBgColor;
    const cardBg = brand.cardBgColor || DEFAULT_BRANDING_CONFIG.cardBgColor;
    const innerBg = brand.innerBgColor || DEFAULT_BRANDING_CONFIG.innerBgColor;
    const platformText = brand.platformTextColor || DEFAULT_BRANDING_CONFIG.platformTextColor;
    const menuText = brand.menuTextColor || DEFAULT_BRANDING_CONFIG.menuTextColor;
    const submenuText = brand.submenuTextColor || DEFAULT_BRANDING_CONFIG.submenuTextColor;

    root.style.setProperty('--tl-platform-bg', platformBg);
    root.style.setProperty('--tl-menu-bg', menuBg);
    root.style.setProperty('--tl-submenu-bg', submenuBg);
    root.style.setProperty('--tl-card-bg', cardBg);
    root.style.setProperty('--tl-inner-bg', innerBg);
    root.style.setProperty('--tl-platform-text', platformText);
    root.style.setProperty('--tl-menu-text', menuText);
    root.style.setProperty('--tl-submenu-text', submenuText);

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
      /* Zona 3: Fondo general de la plataforma */
      html, body, #root, main, .tl-platform-surface {
        background-color: var(--tl-platform-bg) !important;
        color: var(--tl-platform-text) !important;
      }

      /* Zona 1 y Zona 6: Menú superior y Footer */
      .tl-menu-surface {
        background-color: var(--tl-menu-bg) !important;
        color: var(--tl-menu-text) !important;
      }

      /* Zona 2: Sub-menú Modo Maestro */
      .tl-submenu-surface {
        background-color: var(--tl-submenu-bg) !important;
        color: var(--tl-submenu-text) !important;
      }

      /* Zona 4: Tarjetas / contenedores principales */
      .tl-platform-surface [class*="bg-slate-950"],
      .tl-platform-surface [class*="bg-slate-900"] {
        background-color: var(--tl-card-bg) !important;
      }

      /* Zona 5: Cajas / bloques internos */
      .tl-platform-surface [class*="bg-slate-800"] {
        background-color: var(--tl-inner-bg) !important;
      }

      /* Tipografía general en todas las vistas */
      .tl-platform-surface .text-white,
      .tl-platform-surface .text-slate-100,
      .tl-platform-surface .text-slate-200,
      .tl-platform-surface .text-slate-300,
      .tl-platform-surface .text-slate-400 {
        color: var(--tl-platform-text) !important;
      }

      /* Suavizado de sombras en tarjetas y contenedores para evitar halos oscuros */
      .tl-platform-surface [class*="shadow-"] {
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08) !important;
      }
    `;
  }, [
    brand.platformBgColor,
    brand.menuBgColor,
    brand.submenuBgColor,
    brand.cardBgColor,
    brand.innerBgColor,
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
   * Persiste los cambios de apariencia en PostgreSQL vía PUT /api/v1/branding.
   */
  const saveBranding = async (nextConfig) => {
    const token = localStorage.getItem('trustlink_token') || '';
    const payload = {
      platform_bg_color: nextConfig.platformBgColor,
      menu_bg_color: nextConfig.menuBgColor,
      submenu_bg_color: nextConfig.submenuBgColor,
      card_bg_color: nextConfig.cardBgColor,
      inner_bg_color: nextConfig.innerBgColor,
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