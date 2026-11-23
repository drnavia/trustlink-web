/**
 * @file api.js
 * @description Base única de la API para trustlink-web.
 * Usa VITE_API_BASE_URL si está definida (Vercel / entornos externos)
 * o cae automáticamente en http://localhost:4000 en desarrollo local.
 * @location /trustlink-web/src/config/api.js
 */

export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL && String(import.meta.env.VITE_API_BASE_URL).trim()) ||
  'http://localhost:4000';