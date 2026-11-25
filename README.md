# TrustLink Web

Aplicación web de **TrustLink** — plataforma de servicios verificados, gestión de pases QR y control de accesos para comunidades privadas (countries y barrios cerrados).

---

## Stack Tecnológico

- **Framework:** React 19 + Vite 6 + **PWA instalable** (`public/manifest.webmanifest` + `public/sw.js`)
- **Estilos e Íconos:** Tailwind CSS 4 + `lucide-react`
- **Calidad:** `oxlint` (0 warnings/errors) y tests nativos con `node --test` (`qrEncoder` + `serviceSearchMatcher`)

---

## Portales y Módulos (`src/modules`, `src/components`, `src/utils`)

- **Landing Pública (`landing/LandingHome.jsx`):** Propuesta de valor diferenciada por actor, **buscador inteligente por síntomas y sinónimos** (`utils/serviceSearchMatcher.js`) con sugerencias en vivo y persistencia de consulta al iniciar sesión.
- **Autenticación y Cuenta (`auth/`):** Login, registro, recuperación/cambio de contraseña y gestión de cuenta con **identidad dual** (switches de Portal Residente / Portal Prestador, dirty state y selector de portal principal).
- **Portal Residente (`owner/ResidentDashboard.jsx` — flujo único de 5 pasos):**
  - Directorio verificado con **buscador por síntomas**, **tarjetas multi-especialidad** (muestra hasta 3 rubros habilitados + `+N más`, resalta el filtro activo y filtra por cualquiera de las especialidades del prestador), **termómetro de reputación** (`components/HomeProtectedBadge.jsx`), prueba social hiper-local (*"servicios/ingresos en tu barrio"*), **tiempo promedio de respuesta**, **ficha comercial rápida**, filtros *Mis Favoritos*, *Disponible hoy*, *Urgencias 24h* y *Solo Socios Verificados*, modal de **Q&A público** y modal de reseñas filtrable por estrellas y micro-tags.
  - Sello UX **Hogar Protegido**, coordinación de visitas con mensajería, emisión/edición/cancelación de Pases QR (vehículo + cuadrilla/ART + WhatsApp + acceso directo **`Crear orden de pago`** en pases utilizados), botón **Volver a contratar** en 1 clic, **Paso 4 unificado de Órdenes de Pago** (alta desplegable desde Pase QR en español, badge de pasarela `mock` / Mercado Pago Checkout Pro con detección de retorno `?mp_status=`, redirección automática desde `/#payments`, **conformidad final** digital o efectivo, **Comprobante del Hogar imprimible** `utils/receiptPrinter.js` y reclamos/garantía) y **Paso 5 de Reseñas cruzadas** con **micro-tags tocables**.
- **Portal Prestador (`provider/ProviderDashboard.jsx`):** **Documentación Personal** en 2 tarjetas vigentes (*Antecedentes Penales* y *Póliza ART / Seguro*) con renovación sincronizada y acordeón colapsable de historial inmutable para auditoría legal, alertas de vencimiento, **selector de catálogo oficial de especialidades auto-aprobado** (u *Otra especialidad* con descripción moderada por Ops, tanto en alta como en edición inline), visibilidad persistente por especialidad, **Tablero "Mi Reputación"** con termómetro y próximo hito, editor de **Ficha Comercial / Urgencias 24h**, **respuestas a Q&A público**, autogestión de membresía **Socio Verificado**, flota vehicular, cuadrilla/ayudantes, agenda online, bandeja de visitas, Pases QR, **resumen de ingresos netos (93%)**, comprobantes imprimibles y reseñas cruzadas.
- **Consola Garita (`security/SecurityScanner.jsx`):** Escáner QR con cámara en vivo o ingreso manual, validación en tiempo real de vigencia, compliance (con alerta roja diferenciada ante documentos vencidos), vehículo y cuadrilla.
- **Gobernanza y Administración (`admin/` y `branding/`):**
  - **Modo Maestro (Superadmin):** Auditoría central de compliance **agrupada por persona** (vista tarjetas o tabla compacta, semáforo de vigencia documental, aprobación única de compliance personal + bloque dedicado para moderar rubros personalizados con descripción y confirmación en 2 clics), gestión de membresías y pestaña dedicada de reclamos post-servicio, gestión de usuarios, **licenciamiento B2B y cuota mensual QR** por comunidad, claves API de garita, diagnóstico del sistema, exportaciones **CSV** (`utils/csvExport.js`) y personalización de marca blanca.
  - **Admin Local:** Estado de licencia B2B de la comunidad, reportes/suspensiones operativas locales, alertas proactivas de vencimientos documentales y exportaciones CSV.

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
- `npm test` — Corre pruebas unitarias (`tests/qrEncoder.test.js` y `tests/serviceSearchMatcher.test.js`).
