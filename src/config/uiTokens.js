/**
 * @file uiTokens.js
 * @description Tokens de layout, tarjetas, grillas, inputs y badges de estado compartidos
 * para garantizar una experiencia UX/UI homogénea en toda la plataforma TrustLink.
 * @location /trustlink-web/src/config/uiTokens.js
 */

/** Contenedor de página estándar: mismo ancho y padding horizontal en todas las vistas */
export const PAGE_SHELL_CLASS =
  'max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 md:py-8 space-y-6';

/** Contenedor interno del header / submenú superior alineado con PAGE_SHELL_CLASS */
export const NAV_INNER_CLASS = 'max-w-6xl w-full mx-auto';

/** Tarjeta contenedora de sección principal (Zona 4) */
export const SECTION_CARD_CLASS =
  'rounded-2xl p-5 sm:p-6 border border-white/10 shadow-sm space-y-4';

/** Grilla homogénea de tarjetas de ítems (2 columnas en escritorio con misma altura por fila) */
export const ITEMS_GRID_CLASS =
  'grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch';

/** Tarjeta de ítem homogénea dentro de ITEMS_GRID_CLASS (Zona 5) */
export const ITEM_CARD_CLASS =
  'rounded-xl p-4 sm:p-5 border border-white/10 flex flex-col justify-between gap-3 h-full text-xs';

/** Input / Select estándar con contraste accesible y foco consistente */
export const FIELD_INPUT_CLASS =
  'px-3.5 py-2 rounded-xl border border-white/15 text-xs focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/25 transition-colors';

/**
 * Formatea una fecha/hora (incluyendo strings ISO `YYYY-MM-DDTHH:mm`) a formato legible es-AR.
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

/**
 * Devuelve etiqueta localizada en español y clases de badge unificadas para cualquier estado
 * de pase QR, contrato, pago o compliance.
 */
export function getUnifiedStatusMeta(rawStatus, domain = 'generic') {
  const s = String(rawStatus || '').trim().toLowerCase();

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
  if (s === 'pending' || s === 'pending_provider' || s === 'in_progress') {
    return {
      label: 'Pendiente',
      cls: 'bg-amber-950/80 text-amber-300 border-amber-700/60',
    };
  }
  if (s === 'rejected' || s === 'declined' || s === 'cancelled') {
    return {
      label: s === 'rejected' ? 'Rechazado' : s === 'declined' ? 'Sin disponibilidad' : 'Cancelado',
      cls: 'bg-rose-950/80 text-rose-300 border-rose-700/60',
    };
  }
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
