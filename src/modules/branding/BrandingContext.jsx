/**
 * @file BrandingContext.jsx
 * @description Contexto modular de marca blanca y paleta de 3 colores de TrustLink
 * (Primario, Secundario y Acento). Sincroniza con PostgreSQL vía /api/v1/branding
 * y propaga las variables CSS y utilidades dinámicas a toda la plataforma.
 * @location /trustlink-web/src/modules/branding/BrandingContext.jsx
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:4000';

export const DEFAULT_BRAND_COLORS = {
  primaryColor: '#0A2540',
  secondaryColor: '#1E293B',
  accentColor: '#10B981',
};

const BrandingContext = createContext(null);

/**
 * Convierte un color hexadecimal #RRGGBB a componentes RGB { r, g, b }.
 */
const hexToRgb = (hex) => {
  if (typeof hex !== 'string') return { r: 16, g: 185, b: 129 };
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return { r: 16, g: 185, b: 129 };
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return { r: 16, g: 185, b: 129 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
};

/**
 * Ajusta el brillo de un color #RRGGBB (amount entre -1 y 1) para estados hover.
 */
const adjustHexBrightness = (hex, amount) => {
  const { r, g, b } = hexToRgb(hex);
  const clamp = (val) => Math.max(0, Math.min(255, Math.round(val)));
  const nr = clamp(r + 255 * amount);
  const ng = clamp(g + 255 * amount);
  const nb = clamp(b + 255 * amount);
  return `#${[nr, ng, nb].map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
};

export const BrandingProvider = ({ children }) => {
  const [brand, setBrand] = useState({
    name: 'TrustLink',
    countryName: 'TrustLink Community',
    logoUrl: '/assets/logo-default.svg',
    primaryColor: DEFAULT_BRAND_COLORS.primaryColor,
    secondaryColor: DEFAULT_BRAND_COLORS.secondaryColor,
    accentColor: DEFAULT_BRAND_COLORS.accentColor,
    updatedAt: null,
  });

  const [defaults, setDefaults] = useState(DEFAULT_BRAND_COLORS);
  const [loadingBrand, setLoadingBrand] = useState(true);

  /**
   * Carga la paleta de 3 colores persistida en el backend.
   */
  const fetchBranding = useCallback(async () => {
    setLoadingBrand(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/branding`);
      const data = await response.json();

      if (response.ok && data.branding) {
        setBrand((prev) => ({
          ...prev,
          primaryColor: data.branding.primary_color || DEFAULT_BRAND_COLORS.primaryColor,
          secondaryColor: data.branding.secondary_color || DEFAULT_BRAND_COLORS.secondaryColor,
          accentColor: data.branding.accent_color || DEFAULT_BRAND_COLORS.accentColor,
          updatedAt: data.branding.updated_at || null,
        }));

        if (data.defaults) {
          setDefaults({
            primaryColor: data.defaults.primary_color || DEFAULT_BRAND_COLORS.primaryColor,
            secondaryColor: data.defaults.secondary_color || DEFAULT_BRAND_COLORS.secondaryColor,
            accentColor: data.defaults.accent_color || DEFAULT_BRAND_COLORS.accentColor,
          });
        }
      }
    } catch (error) {
      console.error('[BrandingContext] Error al cargar colores desde backend:', error);
    } finally {
      setLoadingBrand(false);
    }
  }, []);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  /**
   * Propaga los 3 colores a las variables CSS de :root y a una hoja de estilo
   * dinámica global para asegurar que toda la plataforma responda en tiempo real.
   */
  useEffect(() => {
    const root = document.documentElement;

    const primary = brand.primaryColor || DEFAULT_BRAND_COLORS.primaryColor;
    const secondary = brand.secondaryColor || DEFAULT_BRAND_COLORS.secondaryColor;
    const accent = brand.accentColor || DEFAULT_BRAND_COLORS.accentColor;

    const primaryHover = adjustHexBrightness(primary, 0.08);
    const secondaryHover = adjustHexBrightness(secondary, 0.08);
    const accentHover = adjustHexBrightness(accent, 0.08);

    const primaryRgb = hexToRgb(primary);
    const secondaryRgb = hexToRgb(secondary);
    const accentRgb = hexToRgb(accent);

    root.style.setProperty('--color-primary', primary);
    root.style.setProperty('--color-secondary', secondary);
    root.style.setProperty('--color-accent', accent);

    root.style.setProperty('--tl-primary', primary);
    root.style.setProperty('--tl-primary-hover', primaryHover);
    root.style.setProperty('--tl-primary-soft', `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.16)`);

    root.style.setProperty('--tl-secondary', secondary);
    root.style.setProperty('--tl-secondary-hover', secondaryHover);
    root.style.setProperty('--tl-secondary-soft', `rgba(${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}, 0.22)`);

    root.style.setProperty('--tl-accent', accent);
    root.style.setProperty('--tl-accent-hover', accentHover);
    root.style.setProperty('--tl-accent-soft', `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.14)`);

    // Sincronización global sobre tokens visuales de marca y acción en todas las vistas
    const styleTagId = 'trustlink-dynamic-branding-vars';
    let styleTag = document.getElementById(styleTagId);
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = styleTagId;
      document.head.appendChild(styleTag);
    }

    styleTag.textContent = `
      .tl-bg-primary { background-color: var(--tl-primary) !important; }
      .tl-bg-primary:hover { background-color: var(--tl-primary-hover) !important; }
      .tl-border-primary { border-color: var(--tl-primary) !important; }

      .tl-bg-secondary { background-color: var(--tl-secondary) !important; }
      .tl-bg-secondary:hover { background-color: var(--tl-secondary-hover) !important; }
      .tl-border-secondary { border-color: var(--tl-secondary) !important; }

      .tl-bg-accent { background-color: var(--tl-accent) !important; }
      .tl-bg-accent:hover { background-color: var(--tl-accent-hover) !important; }
      .tl-text-accent { color: var(--tl-accent) !important; }
      .tl-border-accent { border-color: var(--tl-accent) !important; }

      /* Propagación a acciones principales y destacados de marca en toda la UI */
      button.bg-emerald-600 {
        background-color: var(--tl-accent) !important;
      }
      button.bg-emerald-600:hover {
        background-color: var(--tl-accent-hover) !important;
      }
      .focus\\:border-emerald-500:focus {
        border-color: var(--tl-accent) !important;
      }
      .selection\\:bg-emerald-500 ::selection,
      .selection\\:bg-emerald-500::selection {
        background-color: var(--tl-accent) !important;
      }
    `;
  }, [brand.primaryColor, brand.secondaryColor, brand.accentColor]);

  /**
   * Actualiza localmente el estado de marca (útil para previsualización en vivo).
   */
  const previewBranding = (partialColors) => {
    setBrand((prev) => ({
      ...prev,
      ...partialColors,
    }));
  };

  /**
   * Persiste los 3 colores en PostgreSQL mediante PUT /api/v1/branding (requiere superadmin).
   */
  const saveBrandingColors = async ({ primaryColor, secondaryColor, accentColor }) => {
    const token = localStorage.getItem('trustlink_token') || '';
    const response = await fetch(`${API_BASE}/api/v1/branding`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        accent_color: accentColor,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'No se pudieron guardar los colores de la plataforma.');
    }

    if (data.branding) {
      setBrand((prev) => ({
        ...prev,
        primaryColor: data.branding.primary_color,
        secondaryColor: data.branding.secondary_color,
        accentColor: data.branding.accent_color,
        updatedAt: data.branding.updated_at || new Date().toISOString(),
      }));
    }

    return data;
  };

  /**
   * Restaura los 3 colores a los valores por defecto y los guarda en PostgreSQL.
   */
  const resetBrandingColors = async () => {
    return saveBrandingColors(defaults);
  };

  return (
    <BrandingContext.Provider
      value={{
        brand,
        defaults,
        loadingBrand,
        fetchBranding,
        previewBranding,
        saveBrandingColors,
        resetBrandingColors,
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