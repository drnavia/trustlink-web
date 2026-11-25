/**
 * @file AdminPaginationBar.jsx
 * @description Pie de paginación estándar y helper `paginateItems` compartidos por todos los listados
 * del panel de Administración, garantizando la misma escala uniforme (`6 / 12 / 24 / 50`) y controles.
 * @location /trustlink-web/src/components/admin/AdminPaginationBar.jsx
 */

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ADMIN_PAGE_SIZE_OPTIONS } from '../../utils/adminPagination';

/**
 * Barra de paginación homogénea con rango visible, selector `6 / 12 / 24 / 50` y navegación.
 *
 * @param {Object} props - Propiedades de la barra de paginación.
 * @param {number} props.page - Página actual (1-indexed).
 * @param {number} props.totalPages - Total de páginas disponibles.
 * @param {number} props.totalItems - Total global de registros que coinciden con el filtro.
 * @param {number} props.pageSize - Cantidad actual de ítems por página.
 * @param {(nextPage: number) => void} props.onPageChange - Callback al cambiar de página.
 * @param {(nextSize: number) => void} props.onPageSizeChange - Callback al cambiar ítems por página.
 * @param {boolean} [props.loading=false] - Deshabilita botones mientras hay una carga remota en curso.
 * @param {string} [props.itemLabel='resultado(s)'] - Sustantivo plural para el resumen de conteo.
 * @param {React.CSSProperties} props.innerStyle - Estilo dinámico Zona 5.
 * @returns {JSX.Element} Pie de paginación unificado.
 */
export default function AdminPaginationBar({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  loading = false,
  itemLabel = 'resultado(s)',
  innerStyle,
}) {
  const safeTotalPages = Math.max(1, Number(totalPages) || 1);
  const safePage = Math.min(Math.max(1, Number(page) || 1), safeTotalPages);
  const safeSize = Math.max(1, Number(pageSize) || 6);
  const safeTotal = Math.max(0, Number(totalItems) || 0);
  const startItem = safeTotal === 0 ? 0 : (safePage - 1) * safeSize + 1;
  const endItem = Math.min(safeTotal, safePage * safeSize);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-white/10 text-xs opacity-90">
      <div className="flex flex-wrap items-center gap-3">
        <span>
          {safeTotal === 0
            ? `0 ${itemLabel}`
            : `Mostrando ${startItem}–${endItem} de ${safeTotal} ${itemLabel} · Página ${safePage} de ${safeTotalPages}`}
        </span>
        <label className="inline-flex items-center gap-1.5">
          <span className="opacity-70">Mostrar:</span>
          <select
            value={safeSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            disabled={loading}
            className="px-2.5 py-1 rounded-lg border border-white/15 text-xs font-semibold cursor-pointer focus:outline-none"
            style={innerStyle}
            aria-label="Cantidad de ítems por página"
          >
            {ADMIN_PAGE_SIZE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt} / pág
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto">
        <button
          type="button"
          disabled={safePage <= 1 || loading}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/15 font-semibold disabled:opacity-40 cursor-pointer hover:opacity-90"
          style={innerStyle}
        >
          <ChevronLeft size={13} />
          <span>Anterior</span>
        </button>
        <button
          type="button"
          disabled={safePage >= safeTotalPages || loading}
          onClick={() => onPageChange(Math.min(safeTotalPages, safePage + 1))}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/15 font-semibold disabled:opacity-40 cursor-pointer hover:opacity-90"
          style={innerStyle}
        >
          <span>Siguiente</span>
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}
