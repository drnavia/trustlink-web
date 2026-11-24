/**
 * @file api.js
 * @description Configuración centralizada de la URL base de la API REST para trustlink-web.
 * Toma `VITE_API_BASE_URL` desde variables de entorno en despliegues externos (p. ej. Vercel)
 * y utiliza `http://localhost:4000` como respaldo automático en desarrollo local.
 * @location /trustlink-web/src/config/api.js
 */

/**
 * URL base del backend consumida por todos los módulos del frontend.
 * @type {string}
 */
export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL && String(import.meta.env.VITE_API_BASE_URL).trim()) ||
  'http://localhost:4000';