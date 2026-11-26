/**
 * @file ProviderTrustBadge.jsx
 * @description Componentes visuales unificados de Confianza Progresiva (Fase 6.1, niveles 0..5)
 * compartidos por Portal Residente, Portal Prestador y Administración -> Prestadores (Compliance):
 * - `ProviderTrustBadge`: insignia oficial por nivel (`N0` a `N5`) con variantes de tamaño.
 * - `TrustChecksStrip`: tira compacta de 4 controles reales (`DNI · Antecedentes · ART · Pase QR`).
 * - `TrustLevelsGuide`: guía explicativa compacta de la escala de 5 niveles para residentes.
 * @location /trustlink-web/src/components/ProviderTrustBadge.jsx
 */

import React from 'react';
import {
  Award,
  BadgeCheck,
  ShieldCheck,
  FileCheck2,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Circle,
  X,
} from 'lucide-react';

/** Estilos semánticos por tono de insignia (sobríos y legibles en temas oscuros y claros). */
const TONE_STYLES = {
  gold: {
    cls: 'border-amber-400/65 bg-amber-500/20 text-amber-200 shadow-sm shadow-amber-500/10',
    Icon: Award,
  },
  emerald: {
    cls: 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200',
    Icon: BadgeCheck,
  },
  teal: {
    cls: 'border-teal-400/50 bg-teal-500/15 text-teal-200',
    Icon: ShieldCheck,
  },
  sky: {
    cls: 'border-sky-400/50 bg-sky-500/15 text-sky-200',
    Icon: FileCheck2,
  },
  danger: {
    cls: 'border-rose-500/55 bg-rose-500/15 text-rose-200',
    Icon: AlertCircle,
  },
  slate: {
    cls: 'border-slate-500/50 bg-slate-500/15 text-slate-200',
    Icon: UserCheck,
  },
};

/** Definición resumida de los 5 niveles visibles en directorio para la guía rápida del residente. */
const TRUST_SCALE_ITEMS = [
  {
    level: 1,
    label: 'Perfil Básico',
    tone: 'slate',
    desc: 'DNI validado y especialidad activa. Solo consultas, aún sin Pase QR.',
  },
  {
    level: 2,
    label: 'Respaldo Parcial',
    tone: 'sky',
    desc: 'Póliza ART o Antecedentes vigentes cargados. Solo consultas, aún sin Pase QR.',
  },
  {
    level: 3,
    label: 'Doc. en validación',
    tone: 'teal',
    desc: 'Póliza ART y Antecedentes cargados, en cola de aprobación de TrustLink.',
  },
  {
    level: 4,
    label: 'Verificado',
    tone: 'emerald',
    desc: 'Identidad y documentación aprobadas y vigentes. Habilitado para Pase QR en garita.',
  },
  {
    level: 5,
    label: 'Socio Verificado',
    tone: 'gold',
    desc: 'Nivel 4 Verificado + membresía activa. Máxima prioridad y respaldo completo.',
  },
];

/**
 * Renderiza la insignia de nivel de confianza del prestador (`0..5`).
 *
 * @param {Object} props - Propiedades del componente.
 * @param {Object|null|undefined} props.trust - Objeto `trust_badge` devuelto por el backend o calculado localmente.
 * @param {boolean} [props.showLevel=false] - Muestra el prefijo `N0..N5` para vistas operativas/prestador.
 * @param {boolean} [props.showScale=false] - Muestra el sufijo `X/5` para facilitar comparación directa.
 * @param {boolean} [props.compact=false] - Variante compacta para filas de tabla.
 * @param {'sm'|'md'} [props.size='sm'] - Tamaño visual de la insignia (`md` destaca en cabecera de tarjetas).
 * @returns {JSX.Element|null} Insignia visual con tooltip explicativo.
 */
export default function ProviderTrustBadge({
  trust,
  showLevel = false,
  showScale = false,
  compact = false,
  size = 'sm',
}) {
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

  const sizeClass = compact
    ? 'text-[10px] px-1.5 py-0.5 gap-1'
    : size === 'md'
      ? 'text-xs px-2.5 py-1 gap-1.5'
      : 'text-[10px] px-2 py-1 gap-1';

  const iconSize = compact ? 10 : size === 'md' ? 13 : 11;

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center rounded-lg border font-bold whitespace-nowrap shrink-0 ${cls} ${sizeClass}`}
    >
      <Icon size={iconSize} className="shrink-0" />
      {showLevel && <span className="opacity-80 font-mono">N{levelNum}</span>}
      <span>{trust.label}</span>
      {showScale && (
        <span className="opacity-80 font-mono text-[10px] pl-1 border-l border-current/25">
          {levelNum}/5
        </span>
      )}
    </span>
  );
}

/**
 * Renderiza la tira compacta de 4 controles verificables de seguridad y compliance
 * (`DNI · Antecedentes · ART · Pase QR`) para que residentes y prestadores entiendan
 * en un vistazo qué respaldo concreto avala la insignia.
 *
 * @param {Object} props - Propiedades del componente.
 * @param {Object|null|undefined} props.trust - Objeto `trust_badge` con `checks` opcionales.
 * @param {boolean} [props.hasExpiredDocs=false] - Indica vencimiento documental activo.
 * @param {boolean} [props.compact=false] - Reduce padding para cabeceras densas.
 * @returns {JSX.Element|null} Tira de controles de respaldo.
 */
export function TrustChecksStrip({ trust, hasExpiredDocs = false, compact = false }) {
  if (!trust) return null;

  const level = Number(trust.level ?? 0);
  const checks = trust.checks || {};
  const expired = Boolean(hasExpiredDocs || trust.has_expired_docs);

  const identityOk =
    checks.identity_ok !== undefined ? Boolean(checks.identity_ok) : level >= 1;
  const criminalExpired = Boolean(checks.criminal_expired);
  const artExpired = Boolean(checks.art_expired);
  const criminalOk =
    checks.criminal_ok !== undefined
      ? Boolean(checks.criminal_ok)
      : !criminalExpired && (level >= 3 || (level === 2 && String(trust.label || '').toLowerCase().includes('antecedentes')));
  const artOk =
    checks.art_ok !== undefined
      ? Boolean(checks.art_ok)
      : !artExpired && (level >= 3 || (level === 2 && String(trust.label || '').toLowerCase().includes('art')));
  const passQrOk =
    checks.pass_qr_ok !== undefined
      ? Boolean(checks.pass_qr_ok)
      : Boolean(trust.can_issue_pass) && !expired;

  const items = [
    {
      key: 'dni',
      label: 'DNI',
      state: identityOk ? 'ok' : 'pending',
      title: identityOk ? 'Identidad (DNI) validada' : 'Identidad (DNI) pendiente de validación',
    },
    {
      key: 'art',
      label: 'ART',
      state: artExpired ? 'expired' : artOk ? 'ok' : 'pending',
      title: artExpired
        ? 'Póliza ART / Seguro vencida'
        : artOk
          ? 'Póliza ART / Seguro vigente'
          : 'Póliza ART / Seguro aún no cargada',
    },
    {
      key: 'criminal',
      label: 'Antecedentes',
      state: criminalExpired ? 'expired' : criminalOk ? 'ok' : 'pending',
      title: criminalExpired
        ? 'Antecedentes Penales vencidos'
        : criminalOk
          ? 'Antecedentes Penales vigentes'
          : 'Antecedentes Penales aún no cargados',
    },
    {
      key: 'qr',
      label: 'Pase QR',
      state: expired ? 'expired' : passQrOk ? 'ok' : 'pending',
      title: passQrOk
        ? 'Habilitado para emitir Pase QR e ingresar en garita'
        : expired
          ? 'Pase QR pausado por documentación vencida'
          : 'Requiere Nivel 4 (Verificado) para emitir Pase QR en garita',
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((item) => {
        const cls =
          item.state === 'ok'
            ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
            : item.state === 'expired'
              ? 'border-rose-500/45 bg-rose-500/15 text-rose-200'
              : 'border-white/10 bg-black/20 opacity-60';
        return (
          <span
            key={item.key}
            title={item.title}
            className={`inline-flex items-center gap-1 rounded-md border font-semibold whitespace-nowrap ${cls} ${
              compact ? 'text-[10px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'
            }`}
          >
            {item.state === 'ok' ? (
              <CheckCircle2 size={10} className="text-emerald-400 shrink-0" />
            ) : item.state === 'expired' ? (
              <AlertCircle size={10} className="text-rose-400 shrink-0" />
            ) : (
              <Circle size={9} className="opacity-65 shrink-0" />
            )}
            <span>{item.label}</span>
          </span>
        );
      })}
    </div>
  );
}

/**
 * Barra compacta de 5 segmentos (`N1..N5`) para visualizar de un golpe de vista
 * en qué estadio de confianza progresiva se encuentra un prestador (ideal para Compliance).
 *
 * @param {Object} props - Propiedades del componente.
 * @param {number} [props.level=0] - Nivel actual (`0..5`).
 * @param {boolean} [props.isDanger=false] - Si la cuenta está suspendida, rechazada o con doc. vencida.
 * @returns {JSX.Element} Indicador segmentado `N1..N5`.
 */
export function TrustLevelMeter({ level = 0, isDanger = false }) {
  const numericLevel = Math.max(0, Math.min(5, Number(level || 0)));
  const segmentTitles = [
    'N1 · Perfil Básico (DNI + Especialidad)',
    'N2 · Respaldo Parcial (1 doc. vigente)',
    'N3 · Doc. Completa (ART + Antecedentes)',
    'N4 · Verificado TrustLink (Habilita Pase QR)',
    'N5 · Socio Verificado (Prioridad + Insignia dorada)',
  ];
  const segmentColors = [
    'bg-slate-400',
    'bg-sky-400',
    'bg-teal-400',
    'bg-emerald-400',
    'bg-amber-400',
  ];

  return (
    <div
      className="flex items-center gap-1"
      role="img"
      aria-label={`Progreso de confianza nivel ${numericLevel} de 5`}
    >
      {segmentTitles.map((segTitle, idx) => {
        const stepNum = idx + 1;
        const isLit = !isDanger && stepNum <= numericLevel;
        const isDangerLit = isDanger && stepNum <= Math.max(1, numericLevel);
        return (
          <span
            key={segTitle}
            title={segTitle}
            className={`h-1.5 w-6 rounded-full transition-all ${
              isDangerLit
                ? 'bg-rose-500/80'
                : isLit
                  ? segmentColors[idx]
                  : 'bg-white/12'
            }`}
          />
        );
      })}
      <span className="text-[10px] font-mono opacity-75 ml-1">N{numericLevel}/5</span>
    </div>
  );
}

/**
 * Guía rápida desplegable de los 5 niveles de confianza del directorio TrustLink,
 * diseñada para que el residente entienda en segundos la diferencia entre Perfil Básico,
 * Verificado y Socio Verificado.
 *
 * @param {Object} props - Propiedades del componente.
 * @param {Object} [props.innerStyle] - Estilo temático para tarjetas internas.
 * @param {Function} [props.onClose] - Callback opcional para cerrar la guía.
 * @returns {JSX.Element} Panel explicativo de niveles `N1..N5`.
 */
export function TrustLevelsGuide({ innerStyle, onClose }) {
  return (
    <div
      className="rounded-xl p-3.5 border border-indigo-400/30 bg-indigo-950/25 space-y-2.5 text-xs"
      style={innerStyle}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-bold">
          <ShieldCheck size={15} className="text-emerald-400 shrink-0" />
          <span>¿Cómo leer los Niveles de Confianza (1 a 5)?</span>
        </div>
        {typeof onClose === 'function' && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar guía de niveles"
            className="p-1 rounded-lg border border-white/15 opacity-75 hover:opacity-100 cursor-pointer"
          >
            <X size={13} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {TRUST_SCALE_ITEMS.map((item) => (
          <div
            key={item.level}
            className={`rounded-xl p-2.5 border space-y-1.5 ${
              item.level === 5
                ? 'border-amber-400/45 bg-amber-500/10'
                : item.level === 4
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : 'border-white/10 bg-black/20'
            }`}
          >
            <ProviderTrustBadge
              trust={{ level: item.level, label: item.label, tone: item.tone }}
              showScale
              compact
            />
            <p className="text-[11px] opacity-85 leading-snug">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
