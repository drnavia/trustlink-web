/**
 * @file HomeProtectedBadge.jsx
 * @description Componentes reutilizables de confianza y reputación estilo marketplace (Fase 5):
 * - `ReputationThermometer`: termómetro visual de 5 segmentos (rojo -> verde esmeralda) + insignia
 *   de nivel (`TrustLink Platino`, `Destacado Oro`, `Confiable`, `Nuevo Verificado`, etc.).
 * - `HomeProtectedBadge`: sello UX **"Hogar Protegido TrustLink"** con las 3 garantías clave
 *   para mostrar en el directorio, modal de Pase QR y flujo de pago/conformidad.
 * @location /trustlink-web/src/components/HomeProtectedBadge.jsx
 */

import React from 'react';
import { ShieldCheck, CheckCircle2, FileCheck2, Award } from 'lucide-react';

/**
 * Clases de color por segmento (1 a 5) del termómetro visual estilo Mercado Libre.
 */
const THERMOMETER_SEGMENT_CLASSES = [
  'bg-rose-500',
  'bg-orange-400',
  'bg-amber-400',
  'bg-lime-400',
  'bg-emerald-400',
];

/**
 * Clases visuales de la insignia de nivel según el tono devuelto por el motor de reputación.
 */
const LEVEL_TONE_CLASSES = {
  emerald: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
  lime: 'border-lime-500/40 bg-lime-500/15 text-lime-200',
  sky: 'border-sky-500/40 bg-sky-500/15 text-sky-200',
  amber: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  orange: 'border-orange-500/45 bg-orange-500/15 text-orange-200',
  rose: 'border-rose-500/45 bg-rose-500/15 text-rose-200',
};

/**
 * Renderiza el termómetro de reputación de 5 barras y la insignia de nivel de un prestador.
 *
 * @param {Object} props
 * @param {{ score?: number, thermometer?: number, level_label?: string, tone?: string }} [props.reputation] - Objeto calculado por el backend.
 * @param {boolean} [props.compact=false] - Si es `true`, muestra versión compacta apta para tarjetas del directorio.
 * @returns {JSX.Element|null}
 */
export function ReputationThermometer({ reputation, compact = false }) {
  if (!reputation) return null;

  const activeSegments = Math.max(1, Math.min(5, Number(reputation.thermometer || 3)));
  const toneClass = LEVEL_TONE_CLASSES[reputation.tone] || LEVEL_TONE_CLASSES.sky;
  const label = reputation.level_label || 'Nuevo en TrustLink';
  const score = Number(reputation.score ?? 0);

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {/* Cabecera: insignia de nivel por mérito + puntaje compuesto /100 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${toneClass}`}
        >
          <Award size={11} className="shrink-0" />
          <span>{label}</span>
        </span>
        <span className="text-[11px] font-mono opacity-80">
          Reputación <strong>{score}</strong>/100
        </span>
      </div>

      {/* Termómetro de 5 segmentos progresivos */}
      <div
        className="grid grid-cols-5 gap-1"
        role="img"
        aria-label={`Termómetro de reputación ${activeSegments} de 5 (${label})`}
      >
        {THERMOMETER_SEGMENT_CLASSES.map((colorClass, idx) => {
          const isLit = idx < activeSegments;
          return (
            <div
              key={colorClass}
              className={`h-1.5 rounded-full transition-all ${
                isLit ? colorClass : 'bg-white/10'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Renderiza el sello UX **"Hogar Protegido TrustLink"** comunicando las 3 garantías clave
 * del flujo (compliance vigente al ingresar, pago protegido con conformidad y respaldo Ops).
 *
 * @param {Object} props
 * @param {'compact'|'full'} [props.variant='compact'] - Densidad visual del componente.
 * @returns {JSX.Element}
 */
export function HomeProtectedBadge({ variant = 'compact' }) {
  if (variant === 'compact') {
    return (
      <div className="rounded-xl px-3.5 py-2.5 border border-emerald-500/30 bg-emerald-950/35 text-emerald-100 text-[11px] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-bold text-emerald-300">
          <ShieldCheck size={15} className="shrink-0" />
          <span>Hogar Protegido TrustLink</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 opacity-90">
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
            En Nivel 4–5 (Verificados): ART y antecedentes vigentes en garita
          </span>
          <span className="inline-flex items-center gap-1">
            <FileCheck2 size={12} className="text-emerald-400 shrink-0" />
            Conformidad final, Comprobante y garantía Ops
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-4 border border-emerald-500/35 bg-emerald-950/35 text-emerald-100 text-xs space-y-2">
      <div className="flex items-center gap-2 font-bold text-emerald-300">
        <ShieldCheck size={16} className="shrink-0" />
        <span>Hogar Protegido TrustLink — Tus 3 garantías en cada servicio</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] opacity-90">
        <div className="rounded-xl p-2.5 bg-black/25 border border-white/10">
          <strong className="block text-emerald-300">1. Ingreso verificado</strong>
          DNI, póliza ART y antecedentes validados al momento de escanear en garita.
        </div>
        <div className="rounded-xl p-2.5 bg-black/25 border border-white/10">
          <strong className="block text-emerald-300">2. Pago y conformidad</strong>
          Acordás in situ y liberás la conformidad al finalizar (digital o efectivo).
        </div>
        <div className="rounded-xl p-2.5 bg-black/25 border border-white/10">
          <strong className="block text-emerald-300">3. Respaldo y trazabilidad</strong>
          Comprobante del Hogar imprimible y mediación de Operaciones ante reclamos.
        </div>
      </div>
    </div>
  );
}

export default HomeProtectedBadge;
