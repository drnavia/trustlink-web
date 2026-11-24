/**
 * @file postcss.config.js
 * @description Configuración de PostCSS para Tailwind CSS v4 utilizando `@tailwindcss/postcss`
 * y prefijos automáticos de compatibilidad entre navegadores.
 * @location /trustlink-web/postcss.config.js
 */

export default {
  plugins: {
    // Motor de compilación de utilidades y directivas de Tailwind CSS v4.
    '@tailwindcss/postcss': {},
    // Añade prefijos CSS específicos de navegador según browserslist.
    autoprefixer: {},
  },
};