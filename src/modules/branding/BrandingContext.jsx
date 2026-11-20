/**
 * @file BrandingContext.jsx
 * @description Contexto modular para gestionar fondos y tipografías de las Zonas 1 a 6
 * (Menú, Sub-menú, Plataforma general, Tarjetas principales, Cajas internas y Footer),
 * logo opcional (SVG, PNG, JPG) y modo oscuro/claro, sincronizado con PostgreSQL.
 * @location /trustlink-web/src/modules/branding/BrandingContext.jsx
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:4000';

// Valores iniciales por defecto de TrustLink
export const DEFAULT_BRANDING_CONFIG = {
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
  logoUrl: null,
  darkMode: true,
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
   * Propaga fondos y tipografías de las Zonas 1 a 6 y modo oscuro/claro.
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

    const styleId = 'trustlink-appearance-dynamic-styles';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = `
      /* Zona 3: Fondo y tipografía de la plataforma general */
      html, body, #root, main, .tl-platform-surface {
        background-color: var(--tl-platform-bg) !important;
        color: var(--tl-platform-text) !important;
      }

      /* Zona 1: Fondo y tipografía del menú superior */
      .tl-menu-surface {
        background-color: var(--tl-menu-bg) !important;
        color: var(--tl-menu-text) !important;
      }

      /* Zona 2: Fondo y tipografía del sub-menú */
      .tl-submenu-surface {
        background-color: var(--tl-submenu-bg) !important;
        color: var(--tl-submenu-text) !important;
      }

      /* Zona 6: Fondo y tipografía del footer */
      .tl-footer-surface {
        background-color: var(--tl-footer-bg) !important;
        color: var(--tl-footer-text) !important;
      }

      /* Zona 4: Fondo y tipografía de tarjetas principales */
      .tl-platform-surface [class*="bg-slate-950"],
      .tl-platform-surface [class*="bg-slate-900"] {
        background-color: var(--tl-card-bg) !important;
        color: var(--tl-card-text) !important;
      }

      /* Zona 5: Fondo y tipografía de cajas internas */
      .tl-platform-surface [class*="bg-slate-800"] {
        background-color: var(--tl-inner-bg) !important;
        color: var(--tl-inner-text) !important;
      }

      /* Tipografía general en elementos sin tarjeta */
      .tl-platform-surface h1,
      .tl-platform-surface h2,
      .tl-platform-surface h3,
      .tl-platform-surface h4,
      .tl-platform-surface p,
      .tl-platform-surface span,
      .tl-platform-surface label {
        color: inherit;
      }

      /* Suavizado de sombras en tarjetas y contenedores para evitar halos oscuros */
      .tl-platform-surface [class*="shadow-"] {
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08) !important;
      }
    `;
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