/**
 * @file AdminPageHeader.jsx
 * @description Encabezado unificado para todas las vistas del panel de Administración (Superadmin).
 * Garantiza dimensiones, tipografía, caja de ícono, pestañas internas con accesibilidad ARIA
 * (acento índigo uniforme + `gap-1`) y botón de actualización 100% homogéneos entre secciones.
 * @location /trustlink-web/src/components/admin/AdminPageHeader.jsx
 */

import React from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * Encabezado maestro estándar (Zona 4) para vistas administrativas.
 *
 * @param {Object} props - Propiedades del encabezado.
 * @param {React.ReactNode} props.icon - Ícono principal de la sección (tamaño sugerido 22).
 * @param {string} [props.iconColorClass='text-indigo-300'] - Clase de color del ícono.
 * @param {string} props.title - Título principal de la vista (debe coincidir con el submenú).
 * @param {string} props.subtitle - Bajada descriptiva breve de una línea.
 * @param {Array<{ id: string, label: string, icon?: React.ReactNode, count?: number }>} [props.tabs=[]] - Pestañas internas opcionales.
 * @param {string} [props.activeTab] - Identificador de pestaña activa.
 * @param {(tabId: string) => void} [props.onTabChange] - Callback al cambiar de pestaña.
 * @param {() => void} [props.onRefresh] - Callback opcional del botón Actualizar.
 * @param {boolean} [props.refreshing=false] - Indica si los datos están recargando.
 * @param {React.ReactNode} [props.rightSlot=null] - Controles adicionales opcionales a la derecha.
 * @param {React.CSSProperties} props.cardStyle - Estilo dinámico Zona 4.
 * @param {React.CSSProperties} props.innerStyle - Estilo dinámico Zona 5.
 * @returns {JSX.Element} Cabecera administrativa homogénea.
 */
export default function AdminPageHeader({
  icon,
  iconColorClass = 'text-indigo-300',
  title,
  subtitle,
  tabs = [],
  activeTab,
  onTabChange,
  onRefresh,
  refreshing = false,
  rightSlot = null,
  cardStyle,
  innerStyle,
}) {
  return (
    <section
      className="border border-white/10 p-5 sm:p-6 rounded-2xl shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      style={cardStyle}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div
          className={`p-3 rounded-xl border border-white/15 shrink-0 ${iconColorClass}`}
          style={innerStyle}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-black tracking-tight truncate">{title}</h2>
          <p className="text-xs opacity-80 mt-0.5">{subtitle}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tabs.length > 0 && (
          <div
            role="tablist"
            aria-label={`Secciones de ${title}`}
            className="inline-flex items-center p-1 rounded-xl border border-white/15 gap-1 overflow-x-auto max-w-full"
            style={innerStyle}
          >
            {tabs.map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => onTabChange?.(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  {tab.icon}
                  <span>
                    {tab.label}
                    {typeof tab.count === 'number' ? ` (${tab.count})` : ''}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {rightSlot}

        {typeof onRefresh === 'function' && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/15 text-xs font-bold hover:opacity-90 cursor-pointer disabled:opacity-50 shrink-0"
            style={innerStyle}
            title="Actualizar datos"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        )}
      </div>
    </section>
  );
}
