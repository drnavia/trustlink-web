/**
 * @file ProviderTrustBadge.jsx
 * @description Componentes visuales unificados de Confianza Progresiva v2 (`N0..N4`) + Eje Comercial (`Destacado`)
 * compartidos por Landing, Portal Residente, Portal Prestador y Administración:
 * - `ProviderTrustBadge`: insignia oficial por nivel (`N0` a `N4`) con variantes de tamaño.
 * - `FeaturedPartnerBadge`: insignia transparente del Eje Comercial (`Destacado`, independiente de N1–N4).
 * - `TrustChecksStrip`: tira compacta de 4 controles reales (`DNI · Seguro AP/ART · Antecedentes · Pase QR`).
 * - `TrustLevelMeter`: barra de 4 segmentos (`N1..N4`) para Compliance.
 * - `TrustLevelsGuide`: guía explicativa compacta de los 4 niveles de confianza + Eje Comercial.
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
  Clock,
  Sparkles,
  X,
} from 'lucide-react';

/** Estilos semánticos por tono de insignia (sobrios y legibles en temas oscuros y claros). */
const TONE_STYLES = {
  gold: {
    cls: 'border-amber-400/65 bg-amber-500/20 text-amber-200 shadow-sm shadow-amber-500/10',
    Icon: Award,
  },
  emerald: {
    cls: 'border-emerald-400/65 bg-emerald-500/20 text-emerald-200 shadow-xs shadow-emerald-500/10',
    Icon: BadgeCheck,
  },
  teal: {
    cls: 'border-teal-400/55 bg-teal-500/15 text-teal-200',
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

/** Definición oficial de los 4 niveles visibles en directorio (`N1..N4`). */
const TRUST_SCALE_ITEMS = [
  {
    level: 1,
    label: 'Perfil Básico',
    tone: 'slate',
    desc: 'Celular y DNI validados + especialidad activa. Solo consultas, aún sin Pase QR.',
  },
  {
    level: 2,
    label: 'Seguro en revisión',
    tone: 'sky',
    desc: 'Seguro AP (independiente) o Póliza ART (con ayudantes) cargada. Solo consultas, aún sin Pase QR.',
  },
  {
    level: 3,
    label: 'Pase QR habilitado',
    tone: 'teal',
    desc: 'DNI, Seguro AP/ART y Antecedentes aprobados dentro de la vigencia del barrio. Habilita Pases QR en garita.',
  },
  {
    level: 4,
    label: 'Verificado',
    tone: 'emerald',
    desc: 'Tilde oficial TrustLink: coincidencia cotejada de todos los PDFs contra los datos cargados.',
  },
];

/**
 * Renderiza la insignia de nivel de confianza del prestador (`0..4`).
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
  const levelNum = Math.min(4, Math.max(0, Number(trust.level ?? 0)));
  const tooltip = [
    `Nivel ${levelNum}/4 · ${trust.label}`,
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
          {levelNum}/4
        </span>
      )}
    </span>
  );
}

/**
 * Insignia transparente del Eje Comercial (desacoplada de N1–N4).
 * Solo se muestra en prestadores habilitados (`N3` o `N4`) con plan comercial vigente.
 */
export function FeaturedPartnerBadge({ compact = false }) {
  return (
    <span
      title="Visibilidad comercial prioritaria (habilitada exclusivamente para prestadores N3–N4 con documentación vigente)"
      className={`inline-flex items-center gap-1 rounded-lg border border-amber-400/50 bg-amber-500/15 text-amber-200 font-bold whitespace-nowrap shrink-0 ${
        compact ? 'text-[10px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'
      }`}
    >
      <Sparkles size={10} className="text-amber-300 shrink-0" />
      <span>Destacado</span>
    </span>
  );
}

/**
 * Renderiza la tira compacta de 4 controles verificables de seguridad y compliance
 * (`DNI · Seguro AP/ART · Antecedentes · Pase QR`).
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
  const artOk =
    checks.art_ok !== undefined ? Boolean(checks.art_ok) : !artExpired && level >= 2;
  const criminalOk =
    checks.criminal_ok !== undefined ? Boolean(checks.criminal_ok) : !criminalExpired && level >= 3;
  const passQrOk =
    checks.pass_qr_ok !== undefined
      ? Boolean(checks.pass_qr_ok)
      : Boolean(trust.can_issue_pass) && !expired;
  const complianceOk =
    checks.compliance_ok !== undefined ? Boolean(checks.compliance_ok) : level >= 3 && !expired;

  const items = [
    {
      key: 'dni',
      label: 'DNI',
      state: identityOk ? 'ok' : 'pending',
      title: identityOk ? 'Identidad (DNI) validada' : 'Identidad (DNI) pendiente de validación',
    },
    {
      key: 'art',
      label: artOk && !artExpired && !complianceOk ? 'Seguro (en rev.)' : 'Seguro AP/ART',
      state: artExpired ? 'expired' : artOk ? (complianceOk ? 'ok' : 'review') : 'pending',
      title: artExpired
        ? 'Seguro AP / Póliza ART vencida'
        : artOk
          ? complianceOk
            ? 'Seguro AP / Póliza ART aprobada y vigente'
            : 'Seguro AP / Póliza ART cargado — en revisión de TrustLink'
          : 'Seguro AP / Póliza ART aún no cargado',
    },
    {
      key: 'criminal',
      label:
        criminalOk && !criminalExpired && !complianceOk ? 'Antecedentes (en rev.)' : 'Antecedentes',
      state: criminalExpired ? 'expired' : criminalOk ? (complianceOk ? 'ok' : 'review') : 'pending',
      title: criminalExpired
        ? 'Antecedentes Penales vencidos o fuera de ventana del barrio'
        : criminalOk
          ? complianceOk
            ? 'Antecedentes Penales aprobados y vigentes'
            : 'Antecedentes Penales cargados — en revisión de TrustLink'
          : 'Antecedentes Penales aún no cargados',
    },
    {
      key: 'qr',
      label: 'Pase QR',
      state: expired ? 'expired' : passQrOk ? 'ok' : 'pending',
      title: passQrOk
        ? 'Habilitado para emitir Pase QR e ingresar en garita (Nivel 3+)'
        : expired
          ? 'Pase QR pausado por documentación vencida'
          : 'Requiere Nivel 3 (Pase QR habilitado) para ingresar en garita',
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((item) => {
        const cls =
          item.state === 'ok'
            ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
            : item.state === 'review'
              ? 'border-amber-500/40 bg-amber-500/12 text-amber-200'
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
            ) : item.state === 'review' ? (
              <Clock size={10} className="text-amber-400 shrink-0" />
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
 * Barra compacta de 4 segmentos (`N1..N4`) para Compliance.
 */
export function TrustLevelMeter({ level = 0, isDanger = false }) {
  const numericLevel = Math.max(0, Math.min(4, Number(level || 0)));
  const segmentTitles = [
    'N1 · Perfil Básico (DNI validado + Especialidad)',
    'N2 · Cobertura cargada (Seguro AP / ART en revisión)',
    'N3 · Pase QR habilitado (Antecedentes + aprobación)',
    'N4 · Verificado TrustLink (PDFs cotejados automáticamente)',
  ];
  const segmentColors = [
    'bg-slate-400',
    'bg-sky-400',
    'bg-teal-400',
    'bg-emerald-400',
  ];

  return (
    <div
      className="flex items-center gap-1"
      role="img"
      aria-label={`Progreso de confianza nivel ${numericLevel} de 4`}
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
      <span className="text-[10px] font-mono opacity-75 ml-1">N{numericLevel}/4</span>
    </div>
  );
}

/**
 * Guía rápida desplegable de los 4 niveles de confianza (`N1..N4`) + aclaración del Eje Comercial.
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
          <span>¿Cómo leer los Niveles de Confianza (N1 a N4)?</span>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {TRUST_SCALE_ITEMS.map((item) => (
          <div
            key={item.level}
            className={`rounded-xl p-2.5 border space-y-1.5 ${
              item.level === 4
                ? 'border-emerald-500/45 bg-emerald-500/10'
                : item.level === 3
                  ? 'border-teal-400/40 bg-teal-500/10'
                  : 'border-white/10 bg-black/20'
            }`}
          >
            <ProviderTrustBadge
              trust={{ level: item.level, label: item.label, tone: item.tone }}
              showLevel
              compact
            />
            <p className="text-[11px] opacity-80 leading-snug">{item.desc}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] opacity-75">
        <strong className="text-amber-300">Destacado:</strong> visibilidad comercial opcional
        habilitada exclusivamente para prestadores <strong>N3 o N4</strong> con documentación
        vigente (nunca altera el nivel de seguridad).
      </p>
    </div>
  );
}
