# TrustLink Web

Aplicación web de **TrustLink** — plataforma de servicios verificados, gestión de pases QR y control de accesos para comunidades privadas (countries y barrios cerrados).

---

## Stack Tecnológico

- **Framework:** React 19 + Vite 6
- **Estilos e Íconos:** Tailwind CSS 4 + `lucide-react`
- **Calidad:** `oxlint` y tests nativos con `node --test`

---

## Portales y Módulos (`src/modules`)

- **Landing Pública (`landing/LandingHome.jsx`):** Propuesta de valor diferenciada por actor, buscador rápido por rubro/servicio con persistencia de búsqueda al ingresar y accesos a registro/login.
- **Autenticación y Cuenta (`auth/`):** Login, registro, recuperación de contraseña y gestión de cuenta con **identidad dual** (switches de Portal Residente / Portal Prestador y selector de portal principal).
- **Portal Residente (`owner/`):** Directorio de prestadores verificados con flota, coordinación de visitas, emisión/edición/cancelación de pases QR (incluyendo ayudantes/cuadrilla), atajos de WhatsApp, pagos de contratos y reseñas.
- **Portal Prestador (`provider/`):** Credenciales y vencimientos documentales, flota vehicular, gestión de ayudantes/cuadrilla, agenda online, bandeja de visitas, Pases QR asignados y reseñas cruzadas.
- **Consola Garita (`security/SecurityScanner.jsx`):** Escáner QR con cámara en vivo o ingreso manual, validación en tiempo real de vigencia, compliance, vehículo y cuadrilla.
- **Gobernanza y Administración (`admin/` y `branding/`):**
  - **Modo Maestro (Superadmin):** Auditoría central de compliance, gestión de usuarios, comunidades y claves API de garita, diagnóstico del sistema y personalización de marca blanca.
  - **Admin Local:** Reportes/suspensiones operativas locales por comunidad y alertas proactivas de vencimientos documentales.

---

## Configuración Local

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Copiar `.env.example` a `.env` y definir la URL del backend:
   ```env
   VITE_API_BASE_URL=http://localhost:4000
   ```
3. Iniciar entorno de desarrollo:
   ```bash
   npm run dev
   ```

---

## Scripts Disponibles

- `npm run dev` — Levanta el servidor de desarrollo Vite.
- `npm run build` — Genera el bundle de producción en `dist/`.
- `npm run preview` — Previsualiza el build de producción.
- `npm run lint` — Ejecuta el linter (`oxlint`).
- `npm test` — Corre pruebas unitarias (`tests/qrEncoder.test.js`).
