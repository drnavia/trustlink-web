/**
 * @file BrandingContext.jsx
 * @description Contexto modular para gestionar la apariencia global de TrustLink:
 * fondos (plataforma, menú, sub-menú), tipografías (plataforma, menú, sub-menú),
 * logo institucional opcional (SVG, PNG, JPG) y modo oscuro/claro, sincronizado
 * con PostgreSQL vía /api/v1/branding.
 * @location /trustlink-web/src/modules/branding/BrandingContext.jsx
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:4000';

// Valores iniciales por defecto de TrustLink (estética oscura y sobria)
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
 * Normaliza la estructura recibida desde /api/v1/branding (snake_case o camelCase)
 * hacia el estado camelCase del frontend.
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
   * Aplica las variables CSS y el modo oscuro/claro en toda la plataforma.
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

    // Variables CSS semánticas de apariencia
    root.style.setProperty('--tl-platform-bg', platformBg);
    root.style.setProperty('--tl-menu-bg', menuBg);
    root.style.setProperty('--tl-submenu-bg', submenuBg);
    root.style.setProperty('--tl-platform-text', platformText);
    root.style.setProperty('--tl-menu-text', menuText);
    root.style.setProperty('--tl-submenu-text', submenuText);
    root.style.setProperty('--tl-dark-mode', isDark ? '1' : '0');

    // Clase y atributo de tema para estilos globales y modo claro/oscuro
    root.classList.toggle('dark', isDark);
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');

    // Hoja de estilo dinámica para propagar fondos, tipografías y modo oscuro/claro
    const styleId = 'trustlink-appearance-dynamic-styles';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    const surfaceCardBg = isDark ? 'rgba(2, 6, 23, 0.88)' : '#FFFFFF';
    const surfaceMutedBg = isDark ? 'rgba(15, 23, 42, 0.85)' : '#F8FAFC';
    const borderTone = isDark ? 'rgba(51, 65, 85, 0.7)' : '#CBD5E1';
    const secondaryTextTone = isDark ? '#94A3B8' : '#475569';

    styleEl.textContent = `
      body {
        background-color: var(--tl-platform-bg) !important;
        color: var(--tl-platform-text) !important;
      }

      .tl-platform-surface {
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

      /* Propagación en vistas cuando está activo el modo claro */
      html[data-theme="light"] .tl-platform-surface .bg-slate-950,
      html[data-theme="light"] .tl-platform-surface .bg-slate-900,
      html[data-theme="light"] .tl-platform-surface .bg-slate-900\\/80,
      html[data-theme="light"] .tl-platform-surface .bg-slate-900\\/70,
      html[data-theme="light"] .tl-platform-surface .bg-slate-900\\/60,
      html[data-theme="light"] .tl-platform-surface .bg-slate-900\\/50 {
        background-color: ${surfaceCardBg} !important;
        border-color: ${borderTone} !important;
      }

      html[data-theme="light"] .tl-platform-surface .bg-slate-800 {
        background-color: ${surfaceMutedBg} !important;
        border-color: ${borderTone} !important;
      }

      html[data-theme="light"] .tl-platform-surface .text-white,
      html[data-theme="light"] .tl-platform-surface .text-slate-100,
      html[data-theme="light"] .tl-platform-surface .text-slate-200 {
        color: var(--tl-platform-text) !important;
      }

      html[data-theme="light"] .tl-platform-surface .text-slate-300,
      html[data-theme="light"] .tl-platform-surface .text-slate-400 {
        color: ${secondaryTextTone} !important;
      }

      html[data-theme="light"] .tl-platform-surface input,
      html[data-theme="light"] .tl-platform-surface select,
      html[data-theme="light"] .tl-platform-surface textarea {
        background-color: #FFFFFF !important;
        color: #0F172A !important;
        border-color: #CBD5E1 !important;
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
   * Permite previsualizar cambios en vivo antes de guardar en base de datos.
   */
  const previewBranding = (partial) => {
    setBrand((prev) => ({
      ...prev,
      ...partial,
    }));
  };

  /**
   * Persiste los cambios de apariencia en PostgreSQL mediante PUT /api/v1/branding.
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