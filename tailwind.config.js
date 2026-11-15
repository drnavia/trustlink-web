/**
 * @file tailwind.config.js
 * @description Configuración de Tailwind CSS para TrustLink, incorporando variables dinámicas 
 * para soportar personalización de marca blanca (colores institucionales por barrio).
 * @location /trustlink-web/tailwind.config.js
 */

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        trust: {
          primary: 'var(--color-primary, #0A2540)',   // Azul institucional corporativo
          accent: 'var(--color-accent, #00D4B2)',     // Verde esmeralda de confianza / éxito
          surface: '#F8FAFC',                         // Fondo gris minimalista muy suave
          dark: '#1E293B',                            // Texto principal
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};