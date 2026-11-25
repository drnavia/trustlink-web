/**
 * @file ProviderTrustBadge.jsx
 * @description Insignia unificada de Confianza Progresiva (Fase 6.1, niveles 0..5) compartida
 * por Portal Residente, Portal Prestador y Administración -> Prestadores (Compliance).
 * Distingue visualmente: Perfil Básico (N1), Respaldo Parcial (N2), Doc. en validación (N3),
 * Verificado (N4) y Socio Verificado dorado (N5), manteniendo coherencia con Reputación.
 * @location /trustlink-web/src/components/ProviderTrustBadge.jsx
 */

import React from 'react';
import { Award, BadgeCheck, ShieldCheck, FileCheck2, UserCheck, AlertCircle } from 'lucide-react';

/** Estilos semánticos por tono de insignia (sobríos y legibles en temas oscuros y claros). */
const TONE_STYLES = {
  gold: {
    cls: 'border-amber-400/55 bg-amber-500/15 text-amber-200',
    Icon: Award,
  },
  emerald: {
    cls: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200',
    Icon: BadgeCheck,
  },
  teal: {
    cls: 'border-teal-500/45 bg-teal-500/15 text-teal-200',
    Icon: ShieldCheck,
  },
  sky: {
    cls: 'border-sky-500/45 bg-sky-500/15 text-sky-200',
    Icon: FileCheck2,
  },
  danger: {
    cls: 'border-rose-500/50 bg-rose-500/15 text-rose-200',
    Icon: AlertCircle,
  },
  slate: {
    cls: 'border-slate-500/45 bg-slate-500/15 text-slate-200',
    Icon: UserCheck,
  },
};

/**
 * Renderiza la insignia de nivel de confianza del prestador (`0..5`).
 *
 * @param {Object} props - Propiedades del componente.
 * @param {Object|null|undefined} props.trust - Objeto `trust_badge` devuelto por el backend o calculado localmente.
 * @param {boolean} [props.showLevel=false] - Muestra el prefijo `N1..N5` para vistas operativas/prestador.
 * @param {boolean} [props.compact=false] - Variante compacta para filas de tabla.
 * @returns {JSX.Element|null} Insignia visual con tooltip explicativo.
 */
export default function ProviderTrustBadge({ trust, showLevel = false, compact = false }) {
  if (!trust || !trust.label) return null;

  const toneKey = trust.tone && TONE_STYLES[trust.tone] ? trust.tone : 'slate';
  const { cls, Icon } = TONE_STYLES[toneKey];
  const levelNum = Number(trust.level ?? 0);
  const tooltip = [
    `Nivel ${levelNum}/5 · ${trust.label}`,
    trust.sublabel,
    trust.next_step_hint,
  ]
    .filter(Boolean)
    .join(' — ');

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1 rounded-lg border font-bold whitespace-nowrap shrink-0 ${cls} ${
        compact ? 'text-[10px] px-1.5 py-0.5' : 'text-[10px] px-2 py-1'
      }`}
    >
      <Icon size={compact ? 10 : 11} className="shrink-0" />
      {showLevel && levelNum > 0 && <span className="opacity-80">N{levelNum}</span>}
      <span>{trust.label}</span>
    </span>
  );
}
