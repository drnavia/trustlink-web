/**
 * @file vite.config.js
 * @description Configuración del empaquetador y servidor de desarrollo Vite para trustlink-web.
 * Habilita el plugin oficial de React para compilación JSX y Fast Refresh (HMR).
 * @location /trustlink-web/vite.config.js
 */

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Configuración base de Vite (https://vite.dev/config/) con soporte React mediante @vitejs/plugin-react.
export default defineConfig({
  plugins: [react()],
})
