/**
 * @file tailwind.config.js
 * @description Configuración de Tailwind CSS para TrustLink. Define las rutas de escaneo de clases,
 * tokens de color dinámicos para personalización marca blanca (por barrio/comunidad) y tipografía base.
 * @location /trustlink-web/tailwind.config.js
 */

module.exports = {
  // Archivos escaneados por Tailwind para generar únicamente las utilidades utilizadas.
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Paleta institucional `trust.*` con variables CSS personalizables y valores por defecto.
      colors: {
        trust: {
          primary: 'var(--color-primary, #0A2540)',   // Azul institucional corporativo
          accent: 'var(--color-accent, #00D4B2)',     // Verde esmeralda de confianza / éxito
          surface: '#F8FAFC',                         // Fondo gris minimalista muy suave
          dark: '#1E293B',                            // Texto principal
        }
      },
      // Pila tipográfica principal basada en Inter con respaldo nativo del sistema operativo.
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  // Sin plugins adicionales de Tailwind requeridos en esta configuración base.
  plugins: [],
};