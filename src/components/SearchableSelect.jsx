/**
 * @file SearchableSelect.jsx
 * @description Combo selector reutilizable con buscador instantáneo (insensible a tildes y mayúsculas)
 * y opción fija opcional al pie (ej. "Mi barrio no figura — Proponer comunidad" o "Otra especialidad").
 * Respeta `cardStyle` / `innerStyle` white-label (Dark y Light).
 * @location /trustlink-web/src/components/SearchableSelect.jsx
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, Check, Plus, X } from 'lucide-react';

function normalizeSearchKey(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Selector desplegable escalable con caja de búsqueda integrada.
 *
 * @param {Object} props
 * @param {Array<{ value: string, label: string, subtitle?: string }>} props.options - Opciones disponibles.
 * @param {string} props.value - Valor actualmente seleccionado.
 * @param {(val: string) => void} props.onChange - Callback al elegir una opción.
 * @param {string} [props.placeholder='Seleccionar...'] - Texto cuando no hay valor elegido.
 * @param {string} [props.searchPlaceholder='Buscar...'] - Placeholder del input de búsqueda.
 * @param {string} [props.emptyMessage='Sin coincidencias'] - Mensaje cuando la búsqueda no arroja resultados.
 * @param {{ value: string, label: string, description?: string }} [props.extraAction] - Acción destacada fija al pie (ej. proponer barrio/especialidad).
 * @param {Object} [props.triggerStyle] - Estilo inline del botón disparador.
 * @param {Object} [props.panelStyle] - Estilo inline del panel desplegable.
 * @param {string} [props.ariaLabel] - Etiqueta ARIA accesible.
 * @param {boolean} [props.disabled=false] - Deshabilita interacción.
 */
export default function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'No encontramos coincidencias.',
  extraAction = null,
  triggerStyle,
  panelStyle,
  ariaLabel = 'Seleccionar opción',
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 20);
    }
  }, [open]);

  const selectedOption = useMemo(() => {
    if (extraAction && String(value) === String(extraAction.value)) {
      return { value: extraAction.value, label: extraAction.label, isExtra: true };
    }
    return options.find((opt) => String(opt.value) === String(value)) || null;
  }, [options, value, extraAction]);

  const filteredOptions = useMemo(() => {
    const q = normalizeSearchKey(query);
    if (!q) return options;
    return options.filter((opt) => {
      const hay = normalizeSearchKey(`${opt.label} ${opt.subtitle || ''}`);
      return hay.includes(q);
    });
  }, [options, query]);

  const handleSelect = (nextVal) => {
    if (typeof onChange === 'function') {
      onChange(String(nextVal));
    }
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((prev) => !prev)}
        className="w-full px-3 py-2.5 rounded-xl border border-white/15 text-xs text-left flex items-center justify-between gap-2 cursor-pointer focus:outline-none focus:border-emerald-400/70 disabled:opacity-50"
        style={triggerStyle}
      >
        <span className={`truncate ${selectedOption ? 'font-semibold' : 'opacity-65'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`opacity-70 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 right-0 mt-1.5 rounded-2xl border border-white/15 shadow-2xl p-2 z-50 space-y-1.5"
          style={panelStyle || triggerStyle}
        >
          {/* Buscador instantáneo */}
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-55 pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-7 py-2 rounded-xl border border-white/15 bg-black/20 text-xs focus:outline-none focus:border-emerald-400/60"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 opacity-65 hover:opacity-100 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Lista filtrada con scroll */}
          <div className="max-h-52 overflow-y-auto space-y-0.5 pr-0.5">
            {filteredOptions.length === 0 ? (
              <p className="px-2.5 py-3 text-[11px] opacity-70 text-center">{emptyMessage}</p>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs text-left cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-emerald-500/20 text-emerald-200 font-bold'
                        : 'hover:bg-white/8 opacity-90 hover:opacity-100 font-medium'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{opt.label}</span>
                      {opt.subtitle && (
                        <span className="block text-[10px] opacity-65 truncate">
                          {opt.subtitle}
                        </span>
                      )}
                    </span>
                    {isSelected && <Check size={13} className="text-emerald-400 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Opción fija destacada al pie (ej. Proponer comunidad / Otra especialidad) */}
          {extraAction && (
            <div className="pt-1.5 border-t border-white/10">
              <button
                type="button"
                onClick={() => handleSelect(extraAction.value)}
                className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-xl text-xs text-left cursor-pointer transition-colors ${
                  String(value) === String(extraAction.value)
                    ? 'bg-amber-500/20 text-amber-200 font-bold border border-amber-400/40'
                    : 'hover:bg-amber-500/12 text-amber-300 font-bold'
                }`}
              >
                <Plus size={13} className="shrink-0 mt-0.5" />
                <span className="min-w-0">
                  <span className="block">{extraAction.label}</span>
                  {extraAction.description && (
                    <span className="block text-[10px] font-normal opacity-80">
                      {extraAction.description}
                    </span>
                  )}
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
