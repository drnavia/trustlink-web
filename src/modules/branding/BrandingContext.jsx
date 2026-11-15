/**
 * @file BrandingContext.jsx
 * @description Contexto modular para la gestión de marca blanca (colores, logo y nombre del Country).
 * @location /trustlink-web/src/modules/branding/BrandingContext.jsx
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

const BrandingContext = createContext();

export const BrandingProvider = ({ children }) => {
  // Estado inicial de marca configurable por cada barrio (Country)
  const [brand, setBrand] = useState({
    countryName: 'TrustLink Community',
    logoUrl: '/assets/logo-default.svg',
    primaryColor: '#0A2540',
    accentColor: '#00D4B2',
  });

  // Aplicar dinámicamente las variables CSS al root cuando cambie la configuración
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', brand.primaryColor);
    root.style.setProperty('--color-accent', brand.accentColor);
  }, [brand]);

  const updateBranding = (newSettings) => {
    setBrand((prev) => ({ ...prev, ...newSettings }));
  };

  return (
    <BrandingContext.Provider value={{ brand, updateBranding }}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => useContext(BrandingContext);
