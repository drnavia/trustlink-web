/**
 * @file AdminListToolbar.jsx
 * @description Barra estándar de búsqueda, filtros predeterminados, chips rápidos y acciones
 * (CSV / Alta) para homologar todos los listados del panel de Administración.
 * @location /trustlink-web/src/components/admin/AdminListToolbar.jsx
 */

import React from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
import { FIELD_INPUT_CLASS } from '../../config/uiTokens';

/**
 * Barra de herramientas homogénea para listados administrativos.
 *
 * @param {Object} props - Propiedades de la barra.
 * @param {string} props.searchValue - Texto actual del buscador.
 * @param {(value: string) => void} props.onSearchChange - Callback al escribir en el buscador.
 * @param {() => void} [props.onSearchSubmit] - Callback opcional al presionar Enter o botón Buscar.
 * @param {string} [props.searchPlaceholder='Buscar...'] - Placeholder descriptivo del buscador.
 * @param {boolean} [props.showSubmitButton=false] - Muestra botón explícito "Buscar" para consultas remotas.
 * @param {React.ReactNode} [props.filters=null] - Selects o controles de filtro adicionales.
 * @param {Array<{ id: string, label: string, count?: number }>} [props.chips=[]] - Filtros predeterminados en formato chip.
 * @param {string} [props.activeChip] - Chip activo seleccionado.
 * @param {(chipId: string) => void} [props.onChipChange] - Callback al tocar un chip.
 * @param {boolean} [props.hasActiveFilters=false] - Muestra botón "Limpiar" si hay filtros aplicados.
 * @param {() => void} [props.onResetFilters] - Callback para restablecer búsqueda y filtros.
 * @param {React.ReactNode} [props.actions=null] - Botones alineados a la derecha (CSV, + Nuevo, etc.).
 * @param {React.CSSProperties} props.innerStyle - Estilo dinámico Zona 5.
 * @returns {JSX.Element} Barra estándar de filtrado para listados.
 */
export default function AdminListToolbar({
  searchValue,
  onSearchChange,
  onSearchSubmit,
  searchPlaceholder = 'Buscar...',
  showSubmitButton = false,
  filters = null,
  chips = [],
  activeChip,
  onChipChange,
  hasActiveFilters = false,
  onResetFilters,
  actions = null,
  innerStyle,
}) {
  const handleFormSubmit = (e) => {
    e.preventDefault();
    onSearchSubmit?.();
  };

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        <form onSubmit={handleFormSubmit} className="flex flex-wrap items-center gap-2 flex-1">
          {/* Buscador con ícono y botón rápido de limpieza */}
          <div className="relative flex-1 min-w-52 max-w-sm">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60 pointer-events-none"
            />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className={`w-full pl-9 ${searchValue ? 'pr-8' : 'pr-3'} ${FIELD_INPUT_CLASS}`}
              style={innerStyle}
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => {
                  onSearchChange('');
                  if (onSearchSubmit) setTimeout(() => onSearchSubmit(''), 0);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-65 hover:opacity-100 cursor-pointer"
                aria-label="Limpiar búsqueda"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {filters}

          {showSubmitButton && (
            <button
              type="submit"
              className="px-3 py-2 rounded-xl border border-white/15 font-bold hover:opacity-90 cursor-pointer shrink-0"
              style={innerStyle}
            >
              Buscar
            </button>
          )}

          {hasActiveFilters && typeof onResetFilters === 'function' && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-white/15 font-semibold opacity-80 hover:opacity-100 cursor-pointer shrink-0"
              style={innerStyle}
            >
              <RotateCcw size={12} />
              <span>Limpiar</span>
            </button>
          )}
        </form>

        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {/* Chips predeterminados de filtro rápido */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => {
            const isActive = activeChip === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => onChipChange?.(chip.id)}
                className={`px-3 py-1.5 rounded-xl border font-bold transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                    : 'border-white/15 opacity-80 hover:opacity-100'
                }`}
                style={isActive ? undefined : innerStyle}
              >
                {chip.label}
                {typeof chip.count === 'number' ? ` (${chip.count})` : ''}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
