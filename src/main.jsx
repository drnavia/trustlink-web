/**
 * @file main.jsx
 * @description Punto de entrada principal del frontend React (trustlink-web).
 * Registra el Service Worker PWA en producción y monta el árbol principal `<App />`
 * dentro de `<StrictMode>` sobre el contenedor raíz `#root`.
 * @location /trustlink-web/src/main.jsx
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Registro diferido del Service Worker PWA únicamente en builds de producción
// tras el evento `load`, para no competir con la carga inicial y tolerar entornos sin soporte.
if (import.meta.env.PROD && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Montaje de la aplicación React con StrictMode para detectar efectos secundarios en desarrollo.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
