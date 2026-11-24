/**
 * @file uiTokens.js
 * @description Tokens de layout, tarjetas, grillas, inputs, formateadores de fecha y badges de estado
 * compartidos para garantizar una experiencia UX/UI homogénea en toda la plataforma TrustLink.
 * @location /trustlink-web/src/config/uiTokens.js
 */

// ============================================================================
// Tokens de layout, contenedores, grillas y campos de formulario
// ============================================================================

/** Contenedor de página estándar: mismo ancho máximo y padding horizontal en todas las vistas. */
export const PAGE_SHELL_CLASS =
  'max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 md:py-8 space-y-6';

/** Contenedor interno del header / submenú superior alineado con PAGE_SHELL_CLASS. */
export const NAV_INNER_CLASS = 'max-w-6xl w-full mx-auto';

/** Tarjeta contenedora de sección principal (Zona 4). */
export const SECTION_CARD_CLASS =
  'rounded-2xl p-5 sm:p-6 border border-white/10 shadow-sm space-y-4';

/** Grilla homogénea de tarjetas de ítems (2 columnas en escritorio con igual altura por fila). */
export const ITEMS_GRID_CLASS =
  'grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch';

/** Tarjeta de ítem homogénea dentro de ITEMS_GRID_CLASS (Zona 5). */
export const ITEM_CARD_CLASS =
  'rounded-xl p-4 sm:p-5 border border-white/10 flex flex-col justify-between gap-3 h-full text-xs';

/** Input / Select estándar con contraste accesible y anillo de foco consistente. */
export const FIELD_INPUT_CLASS =
  'px-3.5 py-2 rounded-xl border border-white/15 text-xs focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/25 transition-colors';

/** Catálogo oficial de micro-tags tocables sincronizado con el backend (`providerReputation.js`). */
export const REVIEW_MICRO_TAGS = [
  'Puntual',
  'Prolijo',
  'Precio justo',
  'Buena comunicación',
  'Resolvió en el día',
  'Recomendado',
];

/**
 * Catálogo oficial de especialidades estándar sincronizado con el backend (`providerReputation.js`).
 * Los rubros de esta lista se auto-aprueban si el prestador ya tiene compliance personal aprobado;
 * cualquier especialidad fuera de esta lista requiere descripción y moderación de Operaciones.
 */
export const STANDARD_SPECIALTIES_CATALOG = [
  'Electricista',
  'Plomero',
  'Gasista',
  'Climatización',
  'Piletero',
  'Jardinero / Parquero',
  'Pintor',
  'Albañil',
  'Carpintero',
  'Herrero',
  'Cerrajero',
  'Limpieza',
  'Fumigación',
  'Durlock / Yesero',
  'Techista / Impermeabilización',
  'Riego Automático',
  'Mantenimiento General',
  'Técnico en Electrodomésticos',
];

// ============================================================================
// Formateadores compartidos de fecha y hora
// ============================================================================

/**
 * Formatea una fecha/hora (incluyendo strings ISO `YYYY-MM-DDTHH:mm`) a formato legible `es-AR`.
 * Si el valor es vacío retorna `fallback`; si no es parseable devuelve la cadena original.
 * @param {string|number|Date|null|undefined} value Valor de fecha/hora a formatear.
 * @param {string} [fallback='—'] Texto de respaldo cuando el valor está vacío.
 * @returns {string} Fecha y hora formateadas en `DD/MM/YYYY, HH:mm` o respaldo.
 */
export function formatDateTimeAR(value, fallback = '—') {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================================================
// Estados unificados y estilos de badges por dominio
// ============================================================================

/**
 * Devuelve la etiqueta localizada en español y las clases Tailwind de badge unificadas
 * para estados de pases QR (`domain = 'pass'`), contratos, pagos o compliance.
 * @param {string|null|undefined} rawStatus Estado crudo devuelto por la API.
 * @param {'generic'|'pass'} [domain='generic'] Dominio funcional para desambiguar etiquetas (p. ej. `pending` en pases QR = `Vigente`).
 * @returns {{ label: string, cls: string }} Etiqueta visible y clases CSS del badge.
 */
export function getUnifiedStatusMeta(rawStatus, domain = 'generic') {
  const s = String(rawStatus || '').trim().toLowerCase();

  // Semántica específica para pases de acceso QR en garita.
  if (domain === 'pass') {
    if (s === 'pending') {
      return {
        label: 'Vigente',
        cls: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
      };
    }
    if (s === 'used') {
      return {
        label: 'Utilizado',
        cls: 'bg-sky-950/80 text-sky-300 border-sky-700/60',
      };
    }
    if (s === 'expired') {
      return {
        label: 'Vencido',
        cls: 'bg-amber-950/80 text-amber-300 border-amber-700/60',
      };
    }
    if (s === 'cancelled') {
      return {
        label: 'Cancelado',
        cls: 'bg-rose-950/80 text-rose-300 border-rose-700/60',
      };
    }
  }

  // Estados positivos/finalizados de contratos, pagos y aprobaciones documentales.
  if (s === 'completed' || s === 'paid' || s === 'released') {
    return {
      label: 'Completado',
      cls: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
    };
  }
  if (s === 'approved') {
    return {
      label: 'Aprobado',
      cls: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
    };
  }
  if (s === 'confirmed') {
    return {
      label: 'Confirmada',
      cls: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
    };
  }

  // Estados transitorios o en curso.
  if (s === 'pending' || s === 'pending_provider' || s === 'in_progress') {
    return {
      label: 'Pendiente',
      cls: 'bg-amber-950/80 text-amber-300 border-amber-700/60',
    };
  }

  // Estados negativos, rechazados o cancelados.
  if (s === 'rejected' || s === 'declined' || s === 'cancelled') {
    return {
      label: s === 'rejected' ? 'Rechazado' : s === 'declined' ? 'Sin disponibilidad' : 'Cancelado',
      cls: 'bg-rose-950/80 text-rose-300 border-rose-700/60',
    };
  }

  // Estados neutros o desconocidos (fallback seguro).
  if (s === 'sin_perfil') {
    return {
      label: 'Sin perfil',
      cls: 'bg-slate-800/80 text-slate-300 border-slate-700',
    };
  }

  return {
    label: rawStatus ? String(rawStatus) : 'Sin estado',
    cls: 'bg-slate-800/80 text-slate-300 border-slate-700',
  };
}
