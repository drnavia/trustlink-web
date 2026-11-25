/**
 * @file adminPagination.js
 * @description Constantes y helper puro de paginación compartidos por todos los listados
 * del panel de Administración (`6 / 12 / 24 / 50`), separados del componente React para
 * preservar compatibilidad estricta con React Fast Refresh y 0 advertencias de lint.
 * @location /trustlink-web/src/utils/adminPagination.js
 */

/** Escala única y homologada de cantidad de ítems por página en todo el panel administrativo. */
export const ADMIN_PAGE_SIZE_OPTIONS = [6, 12, 24, 50];

/**
 * Recorta de forma segura un arreglo en memoria según la página y el tamaño solicitados,
 * ajustando automáticamente el número de página si el filtrado redujo el total.
 *
 * @template T
 * @param {T[]} items - Listado completo ya filtrado.
 * @param {number} page - Página solicitada (1-indexed).
 * @param {number} pageSize - Cantidad de ítems por página.
 * @returns {{ pageItems: T[], safePage: number, totalPages: number, totalItems: number }} Resultado paginado.
 */
export function paginateItems(items, page, pageSize) {
  const list = Array.isArray(items) ? items : [];
  const size = Math.max(1, Number(pageSize) || 6);
  const totalItems = list.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / size));
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const startIdx = (safePage - 1) * size;
  return {
    pageItems: list.slice(startIdx, startIdx + size),
    safePage,
    totalPages,
    totalItems,
  };
}
