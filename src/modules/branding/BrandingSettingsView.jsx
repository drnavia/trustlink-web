/**
 * @file BrandingSettingsView.jsx
 * @description Vista de configuración de Apariencia (Marca y Estilos) exclusiva de `superadmin`,
 * integrada como 3ª pestaña de `Sistema` (`embedded = true`) o accesible en modo directo:
 * - 12 presets rápidos (6 Dark + 6 Light) con detección automática del preset activo,
 *   muestras de alto contraste y toggle switch accesible de Modo Oscuro.
 * - Carga y vista previa del logo institucional + identidad textual del menú.
 * - Zonas 1 a 6 alineadas a igual altura con indicador de contraste WCAG por zona y
 *   vista previa continua en vivo (`lg:sticky`) ensamblada en un solo marco.
 * - Detección real de cambios sin guardar (`hasUnsavedChanges`) y confirmación en 2 clics
 *   para `Restaurar por Defecto`.
 * @location /trustlink-web/src/modules/branding/BrandingSettingsView.jsx
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Palette,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Upload,
  Trash2,
  Moon,
  Sun,
  Image as ImageIcon,
  ShieldCheck,
  Sparkles,
  Type,
  X,
} from 'lucide-react';
import {
  useBranding,
  DEFAULT_BRANDING_CONFIG,
  BRANDING_PRESETS,
} from './BrandingContext';
import { PAGE_SHELL_CLASS, FIELD_INPUT_CLASS } from '../../config/uiTokens';
import AdminPageHeader from '../../components/admin/AdminPageHeader';

// Reglas de validación para colores HEX y carga de logo institucional
const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;
const ALLOWED_MIME_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg'];
const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1 MB

// Claves de presets oscuros (fila 1) y claros (fila 2) del selector rápido
const DARK_PRESET_KEYS = [
  'default',
  'countryClub',
  'graphiteTech',
  'emeraldPerimeter',
  'midnightViolet',
  'amberSunset',
];

const LIGHT_PRESET_KEYS = [
  'lightDay',
  'ivoryClub',
  'alabaster',
  'mintDay',
  'lavenderDay',
  'cyanUrban',
];

// Definición declarativa de las 6 zonas de color editables (rótulos concisos de 1 línea)
const ZONES_CONFIG = [
  {
    zone: 'ZONA 1',
    title: 'Menú',
    bgField: 'menuBgColor',
    textField: 'menuTextColor',
  },
  {
    zone: 'ZONA 2',
    title: 'Sub-menú',
    bgField: 'submenuBgColor',
    textField: 'submenuTextColor',
  },
  {
    zone: 'ZONA 3',
    title: 'Plataforma general',
    bgField: 'platformBgColor',
    textField: 'platformTextColor',
  },
  {
    zone: 'ZONA 4',
    title: 'Tarjetas principales',
    bgField: 'cardBgColor',
    textField: 'cardTextColor',
  },
  {
    zone: 'ZONA 5',
    title: 'Cajas internas',
    bgField: 'innerBgColor',
    textField: 'innerTextColor',
  },
  {
    zone: 'ZONA 6',
    title: 'Footer',
    bgField: 'footerBgColor',
    textField: 'footerTextColor',
  },
];

// Campos persistidos que determinan si existen cambios sin guardar
const TRACKED_BRANDING_FIELDS = [
  'brandName',
  'brandBadge',
  'brandSubtitle',
  'menuBgColor',
  'menuTextColor',
  'submenuBgColor',
  'submenuTextColor',
  'platformBgColor',
  'platformTextColor',
  'cardBgColor',
  'cardTextColor',
  'innerBgColor',
  'innerTextColor',
  'footerBgColor',
  'footerTextColor',
  'logoUrl',
  'darkMode',
];

/**
 * Extrae una fotografía normalizada de los campos persistidos del branding para comparaciones.
 *
 * @param {Object} src - Objeto fuente (`brand` o `formState`).
 * @returns {Object} Snapshot normalizado con valores de respaldo seguros.
 */
function buildBrandingSnapshot(src = {}) {
  return {
    brandName: src.brandName ?? DEFAULT_BRANDING_CONFIG.brandName,
    brandBadge: src.brandBadge ?? DEFAULT_BRANDING_CONFIG.brandBadge,
    brandSubtitle: src.brandSubtitle ?? DEFAULT_BRANDING_CONFIG.brandSubtitle,
    menuBgColor: (src.menuBgColor || DEFAULT_BRANDING_CONFIG.menuBgColor).toUpperCase(),
    menuTextColor: (src.menuTextColor || DEFAULT_BRANDING_CONFIG.menuTextColor).toUpperCase(),
    submenuBgColor: (src.submenuBgColor || DEFAULT_BRANDING_CONFIG.submenuBgColor).toUpperCase(),
    submenuTextColor: (src.submenuTextColor || DEFAULT_BRANDING_CONFIG.submenuTextColor).toUpperCase(),
    platformBgColor: (src.platformBgColor || DEFAULT_BRANDING_CONFIG.platformBgColor).toUpperCase(),
    platformTextColor: (src.platformTextColor || DEFAULT_BRANDING_CONFIG.platformTextColor).toUpperCase(),
    cardBgColor: (src.cardBgColor || DEFAULT_BRANDING_CONFIG.cardBgColor).toUpperCase(),
    cardTextColor: (src.cardTextColor || DEFAULT_BRANDING_CONFIG.cardTextColor).toUpperCase(),
    innerBgColor: (src.innerBgColor || DEFAULT_BRANDING_CONFIG.innerBgColor).toUpperCase(),
    innerTextColor: (src.innerTextColor || DEFAULT_BRANDING_CONFIG.innerTextColor).toUpperCase(),
    footerBgColor: (src.footerBgColor || DEFAULT_BRANDING_CONFIG.footerBgColor).toUpperCase(),
    footerTextColor: (src.footerTextColor || DEFAULT_BRANDING_CONFIG.footerTextColor).toUpperCase(),
    logoUrl: src.logoUrl || null,
    darkMode: typeof src.darkMode === 'boolean' ? src.darkMode : DEFAULT_BRANDING_CONFIG.darkMode,
  };
}

/**
 * Detecta automáticamente qué clave de `BRANDING_PRESETS` coincide con los colores activos.
 * Si el usuario modificó colores manualmente y no coincide con ningún preset, retorna `'custom'`.
 *
 * @param {Object} state - Estado actual de colores.
 * @returns {string} Clave del preset coincidente o `'custom'`.
 */
function detectMatchingPresetKey(state) {
  const norm = (val) => String(val || '').trim().toUpperCase();
  const keysToCheck = [...DARK_PRESET_KEYS, ...LIGHT_PRESET_KEYS];
  const colorProps = ['menuBgColor', 'platformBgColor', 'cardBgColor', 'innerBgColor'];

  // Primera pasada: coincidencia exacta con la variante por defecto de cada preset
  for (const key of keysToCheck) {
    const preset = BRANDING_PRESETS[key];
    const variant = preset?.variants?.[preset.defaultMode];
    if (!variant) continue;
    if (colorProps.every((prop) => norm(state[prop]) === norm(variant[prop]))) {
      return key;
    }
  }

  // Segunda pasada: coincidencia con la variante alterna (par oscuro/claro)
  for (const key of keysToCheck) {
    const preset = BRANDING_PRESETS[key];
    const altMode = preset?.defaultMode === 'dark' ? 'light' : 'dark';
    const variant = preset?.variants?.[altMode];
    if (!variant) continue;
    if (colorProps.every((prop) => norm(state[prop]) === norm(variant[prop]))) {
      return key;
    }
  }

  return 'custom';
}

/**
 * Calcula la relación de contraste WCAG 2.x entre dos colores HEX (`#RRGGBB`).
 * Se utiliza para mostrar badges de accesibilidad por zona y avisos preventivos < 3:1.
 *
 * @param {string} hexA - Primer color en formato HEX de 6 dígitos.
 * @param {string} hexB - Segundo color en formato HEX de 6 dígitos.
 * @returns {number} Relación de contraste en el rango [1, 21] (retorna 4.5 si algún HEX es incompleto).
 */
const getContrastRatio = (hexA, hexB) => {
  if (!HEX_REGEX.test(hexA) || !HEX_REGEX.test(hexB)) return 4.5;

  const channelLuminance = (hexSlice) => {
    const c = parseInt(hexSlice, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  const lumA =
    0.2126 * channelLuminance(hexA.slice(1, 3)) +
    0.7152 * channelLuminance(hexA.slice(3, 5)) +
    0.0722 * channelLuminance(hexA.slice(5, 7));

  const lumB =
    0.2126 * channelLuminance(hexB.slice(1, 3)) +
    0.7152 * channelLuminance(hexB.slice(3, 5)) +
    0.0722 * channelLuminance(hexB.slice(5, 7));

  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
};

/**
 * Panel de configuración de apariencia white-label (colores, presets, logo e identidad).
 *
 * @param {Object} [props] - Propiedades opcionales del componente.
 * @param {boolean} [props.embedded=false] - Si es `true`, omite contenedor y cabecera propia para integrarse dentro de `Sistema → Apariencia`.
 * @returns {JSX.Element} Consola de personalización visual.
 */
export default function BrandingSettingsView({ embedded = false } = {}) {
  const {
    brand,
    defaults,
    previewBranding,
    applyBrandingPreset,
    saveBranding,
    resetBranding,
    fetchBranding,
  } = useBranding();

  // Estilos base de Zona 4 (tarjetas) y Zona 5 (cajas internas) reflejando el tema vivo
  const cardStyle = {
    backgroundColor: brand.cardBgColor || DEFAULT_BRANDING_CONFIG.cardBgColor,
    color: brand.cardTextColor || DEFAULT_BRANDING_CONFIG.cardTextColor,
  };

  const innerStyle = {
    backgroundColor: brand.innerBgColor || DEFAULT_BRANDING_CONFIG.innerBgColor,
    color: brand.innerTextColor || DEFAULT_BRANDING_CONFIG.innerTextColor,
  };

  // Snapshot persistido inicial para calcular con exactitud si existen cambios sin guardar
  const initialSnapshot = useMemo(() => buildBrandingSnapshot(brand), [brand]);
  const [savedSnapshot, setSavedSnapshot] = useState(() => buildBrandingSnapshot(brand));
  const initializedSnapshotRef = useRef(false);

  // Estado controlado del formulario, preset activo y banderas de operación
  const [formState, setFormState] = useState(() => ({
    ...buildBrandingSnapshot(brand),
    logoFileName: '',
  }));

  const [selectedPresetKey, setSelectedPresetKey] = useState(() =>
    detectMatchingPresetKey(brand)
  );
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Sincroniza `formState` cuando `BrandingContext` carga por primera vez desde el backend
  useEffect(() => {
    const snap = buildBrandingSnapshot(brand);
    setFormState((prev) => ({
      ...prev,
      ...snap,
    }));
    if (!initializedSnapshotRef.current) {
      initializedSnapshotRef.current = true;
      setSavedSnapshot(snap);
      setSelectedPresetKey(detectMatchingPresetKey(snap));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    brand.brandName,
    brand.brandBadge,
    brand.brandSubtitle,
    brand.menuBgColor,
    brand.menuTextColor,
    brand.submenuBgColor,
    brand.submenuTextColor,
    brand.platformBgColor,
    brand.platformTextColor,
    brand.cardBgColor,
    brand.cardTextColor,
    brand.innerBgColor,
    brand.innerTextColor,
    brand.footerBgColor,
    brand.footerTextColor,
    brand.logoUrl,
    brand.darkMode,
  ]);

  // Determina si hay diferencias entre la vista previa local y el último estado guardado en PostgreSQL
  const hasUnsavedChanges = useMemo(() => {
    const current = buildBrandingSnapshot(formState);
    return TRACKED_BRANDING_FIELDS.some((field) => current[field] !== savedSnapshot[field]);
  }, [formState, savedSnapshot]);

  // Preset efectivo mostrado en la grilla (coincidencia exacta o `'custom'`)
  const effectivePresetKey = useMemo(
    () =>
      selectedPresetKey && BRANDING_PRESETS[selectedPresetKey]
        ? selectedPresetKey
        : detectMatchingPresetKey(formState),
    [selectedPresetKey, formState]
  );

  /**
   * Actualiza un campo textual de identidad del menú (`brandName`, `brandBadge`, `brandSubtitle`)
   * y lo refleja inmediatamente en la vista previa global.
   */
  const updateIdentityField = (field, value) => {
    setConfirmingReset(false);
    setFormState((prev) => ({ ...prev, [field]: value }));
    previewBranding({ [field]: value });
  };

  /**
   * Normaliza un valor HEX ingresado (agregando `#` y mayúsculas), recalcula si coincide con
   * algún preset o pasa a `custom`, y aplica vista previa cuando el código es `#RRGGBB`.
   */
  const updateColorField = (field, rawValue) => {
    setConfirmingReset(false);
    let cleaned = rawValue.trim().toUpperCase();
    if (cleaned && !cleaned.startsWith('#')) {
      cleaned = `#${cleaned}`;
    }
    setFormState((prev) => {
      const next = { ...prev, [field]: cleaned };
      setSelectedPresetKey(detectMatchingPresetKey(next));
      return next;
    });
    if (HEX_REGEX.test(cleaned)) {
      previewBranding({ [field]: cleaned });
    }
  };

  /**
   * Alterna entre la variante dark y light explícita del preset activo
   * (o usa el preset por defecto si se habían editado colores sueltos).
   */
  const handleDarkModeToggle = (checked) => {
    setConfirmingReset(false);
    const targetMode = checked ? 'dark' : 'light';
    const baseKey =
      effectivePresetKey && BRANDING_PRESETS[effectivePresetKey]
        ? effectivePresetKey
        : 'default';

    const variantConfig = applyBrandingPreset(baseKey, targetMode);
    setFormState((prev) => ({
      ...prev,
      ...variantConfig,
      darkMode: checked,
    }));
  };

  /**
   * Aplica inmediatamente uno de los 12 presets del catálogo usando su modo por defecto
   * y sincroniza todos los controles de color del formulario.
   */
  const handleApplyPreset = (presetKey) => {
    const presetObj = BRANDING_PRESETS[presetKey];
    if (!presetObj) return;
    setFeedback({ type: '', text: '' });
    setConfirmingReset(false);
    setSelectedPresetKey(presetKey);
    const variantConfig = applyBrandingPreset(presetKey, presetObj.defaultMode);
    setFormState((prev) => ({
      ...prev,
      ...variantConfig,
    }));
  };

  /**
   * Valida tipo MIME/extensión (SVG, PNG, JPG) y tamaño máximo (1 MB) del archivo elegido,
   * lo convierte a Data URL mediante `FileReader` y lo aplica en la vista previa en vivo.
   */
  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFeedback({ type: '', text: '' });
    setConfirmingReset(false);

    const mime = (file.type || '').toLowerCase();
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const validMime = ALLOWED_MIME_TYPES.includes(mime);
    const validExt = ['svg', 'png', 'jpg', 'jpeg'].includes(ext);

    if (!validMime && !validExt) {
      setFeedback({
        type: 'error',
        text: 'Formato no soportado. Seleccioná un archivo SVG, PNG o JPG.',
      });
      e.target.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFeedback({
        type: 'error',
        text: 'El archivo del logo supera el límite de 1 MB.',
      });
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const resultDataUrl = typeof reader.result === 'string' ? reader.result : null;
      if (!resultDataUrl) return;
      setFormState((prev) => ({
        ...prev,
        logoUrl: resultDataUrl,
        logoFileName: file.name,
      }));
      previewBranding({ logoUrl: resultDataUrl });
    };
    reader.readAsDataURL(file);
  };

  /**
   * Quita el logo personalizado para volver al emblema por defecto en el formulario y vista previa.
   */
  const handleRemoveLogo = () => {
    setFeedback({ type: '', text: '' });
    setConfirmingReset(false);
    setFormState((prev) => ({
      ...prev,
      logoUrl: null,
      logoFileName: '',
    }));
    previewBranding({ logoUrl: null });
  };

  /**
   * Valida que los 12 colores de las 6 zonas tengan formato HEX válido y persiste
   * toda la configuración en PostgreSQL vía `BrandingContext.saveBranding`.
   */
  const handleSave = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', text: '' });
    setConfirmingReset(false);

    const allColorFields = ZONES_CONFIG.flatMap((z) => [
      formState[z.bgField],
      formState[z.textField],
    ]);

    if (!allColorFields.every((hex) => HEX_REGEX.test(hex))) {
      setFeedback({
        type: 'error',
        text: 'Verificá que todos los colores de fondo y tipografía de las 6 zonas tengan formato HEX válido (#RRGGBB).',
      });
      return;
    }

    const payload = buildBrandingSnapshot(formState);
    setSaving(true);
    try {
      await saveBranding(payload);
      setSavedSnapshot(payload);
      setFeedback({
        type: 'success',
        text: 'Apariencia guardada en PostgreSQL y aplicada en toda la plataforma.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error.message || 'Error al guardar la configuración.',
      });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Restaura la apariencia a los valores institucionales por defecto tras confirmación explícita.
   */
  const handleConfirmReset = async () => {
    setFeedback({ type: '', text: '' });
    setResetting(true);
    try {
      const target = buildBrandingSnapshot(defaults || DEFAULT_BRANDING_CONFIG);
      await resetBranding();
      setSelectedPresetKey('default');
      setSavedSnapshot(target);
      setFormState({
        ...target,
        logoFileName: '',
      });
      setConfirmingReset(false);
      setFeedback({
        type: 'success',
        text: 'Apariencia restaurada a los valores por defecto de TrustLink.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error.message || 'No se pudo restaurar la configuración por defecto.',
      });
    } finally {
      setResetting(false);
    }
  };

  /**
   * Descarta los cambios previsualizados localmente recargando la última configuración persistida.
   */
  const handleDiscardPreview = async () => {
    setFeedback({ type: '', text: '' });
    setConfirmingReset(false);
    const fresh = await fetchBranding();
    const snap = buildBrandingSnapshot(fresh || savedSnapshot || initialSnapshot);
    setSavedSnapshot(snap);
    setFormState({ ...snap, logoFileName: '' });
    setSelectedPresetKey(detectMatchingPresetKey(snap));
  };

  // Relación de contraste WCAG por zona + alerta global si alguna cae por debajo de 3:1
  const zoneContrastMap = useMemo(() => {
    const map = {};
    ZONES_CONFIG.forEach((z) => {
      map[z.zone] = getContrastRatio(formState[z.bgField], formState[z.textField]);
    });
    return map;
  }, [formState]);

  const hasLowContrastWarning = useMemo(
    () => Object.values(zoneContrastMap).some((ratio) => ratio < 3),
    [zoneContrastMap]
  );

  /**
   * Renderiza una tarjeta clickeable de preset rápido con 4 muestras visibles de alto contraste
   * (fondo de plataforma, cajas internas, menú y acento/tipografía) e indicador índigo unificado.
   */
  const renderPresetCard = (presetKey) => {
    const preset = BRANDING_PRESETS[presetKey];
    if (!preset) return null;
    const isSelected = effectivePresetKey === presetKey;
    const baseSwatch = preset.variants[preset.defaultMode] || preset.variants.dark;

    return (
      <button
        key={presetKey}
        type="button"
        onClick={() => handleApplyPreset(presetKey)}
        title={preset.description}
        className={`px-3 py-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
          isSelected
            ? 'border-indigo-400 ring-2 ring-indigo-500/40 shadow-sm'
            : 'border-white/15 hover:border-white/30'
        }`}
        style={cardStyle}
      >
        <div className="min-w-0">
          <p className="text-[11px] font-bold truncate">{preset.name}</p>
          <span className="text-[9px] font-mono opacity-65 uppercase">
            {preset.group}
          </span>
        </div>

        {/* 4 muestras distinguibles en Dark y Light gracias al aro sutil + muestra de tipografía/acento */}
        <div className="flex items-center gap-1 shrink-0">
          <span
            className="w-3 h-3 rounded-full ring-1 ring-white/30 shadow-xs"
            style={{ backgroundColor: baseSwatch.platformBgColor }}
            title="Zona 3 — Plataforma"
          />
          <span
            className="w-3 h-3 rounded-full ring-1 ring-white/30 shadow-xs"
            style={{ backgroundColor: baseSwatch.innerBgColor }}
            title="Zona 5 — Cajas internas"
          />
          <span
            className="w-3 h-3 rounded-full ring-1 ring-white/30 shadow-xs"
            style={{ backgroundColor: baseSwatch.menuBgColor }}
            title="Zona 1 — Menú"
          />
          <span
            className="w-3 h-3 rounded-full ring-1 ring-white/30 shadow-xs"
            style={{ backgroundColor: baseSwatch.footerTextColor || baseSwatch.menuTextColor }}
            title="Acento / Tipografía"
          />
        </div>
      </button>
    );
  };

  /**
   * Renderiza un control compacto de color compuesto por selector nativo y campo HEX sincronizados.
   */
  const renderCompactColorInput = (label, field) => {
    const value = formState[field];
    const isValid = HEX_REGEX.test(value);

    return (
      <div
        className="flex items-center justify-between gap-2 border border-white/10 px-2.5 py-1.5 rounded-lg"
        style={cardStyle}
      >
        <span className="text-[11px] font-medium opacity-85">{label}</span>
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            aria-label={`${label} selector`}
            value={isValid ? value : '#0F172A'}
            onChange={(e) => updateColorField(field, e.target.value)}
            className="w-6 h-6 rounded border border-white/15 cursor-pointer p-0"
            style={innerStyle}
          />
          <input
            type="text"
            maxLength={7}
            value={value}
            onChange={(e) => updateColorField(field, e.target.value)}
            placeholder="#000000"
            className="w-18.5 border border-white/15 rounded px-1.5 py-0.5 text-[11px] font-mono uppercase focus:outline-none"
            style={innerStyle}
          />
        </div>
      </div>
    );
  };

  // Textos efectivos para la maqueta en vivo (con fallback a valores por defecto si están vacíos)
  const previewTitle = (formState.brandName || '').trim() || DEFAULT_BRANDING_CONFIG.brandName;
  const previewBadge = (formState.brandBadge || '').trim() || DEFAULT_BRANDING_CONFIG.brandBadge;
  const previewSubtitle =
    (formState.brandSubtitle || '').trim() || DEFAULT_BRANDING_CONFIG.brandSubtitle;

  return (
    <div className={embedded ? 'space-y-6 font-sans' : `${PAGE_SHELL_CLASS} font-sans`}>
      {/* Cabecera propia únicamente cuando se renderiza fuera de Sistema (compatibilidad directa) */}
      {!embedded && (
        <AdminPageHeader
          icon={<Palette size={22} strokeWidth={1.8} />}
          iconColorClass="text-emerald-400"
          title="Apariencia"
          subtitle="Presets de piel, logo institucional, identidad del menú y colores por zona."
          cardStyle={cardStyle}
          innerStyle={innerStyle}
        />
      )}

      <form
        onSubmit={handleSave}
        className="w-full p-5 sm:p-6 rounded-2xl border border-white/10 shadow-sm space-y-6"
        style={cardStyle}
      >
        {/* 1. Presets de Piel Rápidos (Fila 1: 6 Dark · Fila 2: 6 Light) + Toggle Modo Oscuro */}
        <section
          className="border border-white/10 p-4 rounded-2xl space-y-3"
          style={innerStyle}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-emerald-400">
                  <Sparkles size={14} /> Presets de Piel Rápidos
                </h3>
                {effectivePresetKey === 'custom' && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-indigo-400/50 bg-indigo-950/60 text-indigo-200"
                  >
                    Personalizado
                  </span>
                )}
                {hasUnsavedChanges && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-amber-500/50 bg-amber-950/60 text-amber-200">
                    Cambios sin guardar (vista previa)
                  </span>
                )}
              </div>
              <p className="text-[11px] opacity-80 mt-0.5">
                Fila superior: 6 estilos Dark · Fila inferior: 6 estilos Light. Cada preset adapta su par oscuro/claro al alternar Modo Oscuro.
              </p>
            </div>

            {/* Toggle switch moderno y accesible para Modo Oscuro */}
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(formState.darkMode)}
              onClick={() => handleDarkModeToggle(!formState.darkMode)}
              className="inline-flex items-center gap-2.5 border border-white/15 px-3 py-1.5 rounded-xl cursor-pointer text-xs font-bold self-start sm:self-auto shrink-0 transition-opacity hover:opacity-95"
              style={cardStyle}
            >
              {formState.darkMode ? (
                <Moon size={14} className="text-indigo-300 shrink-0" />
              ) : (
                <Sun size={14} className="text-amber-400 shrink-0" />
              )}
              <span>Modo Oscuro</span>
              <span
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  formState.darkMode ? 'bg-indigo-600' : 'bg-slate-500/60'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    formState.darkMode ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                />
              </span>
            </button>
          </div>

          {/* Fila 1: 6 Presets Dark */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {DARK_PRESET_KEYS.map((key) => renderPresetCard(key))}
          </div>

          {/* Fila 2: 6 Presets Light */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {LIGHT_PRESET_KEYS.map((key) => renderPresetCard(key))}
          </div>
        </section>

        {/* Mensajes de estado */}
        {feedback.text && (
          <div
            className={`p-4 rounded-xl text-xs flex items-center gap-2 border ${
              feedback.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                : 'bg-rose-950/60 border-rose-800 text-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-rose-400 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Aviso preventivo de contraste global */}
        {hasLowContrastWarning && (
          <div className="p-3.5 rounded-xl text-xs flex items-center gap-2 border bg-amber-950/50 border-amber-800/70 text-amber-200">
            <AlertCircle size={16} className="text-amber-400 shrink-0" />
            <span>
              Aviso de contraste: una o más zonas tienen baja legibilidad entre fondo y tipografía (marcadas abajo en ámbar).
            </span>
          </div>
        )}

        {/* 2. Fila Intermedia: Logo con vista previa directa + Identidad del Menú */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Tarjeta de carga y vista previa del logo institucional */}
          <div
            className="lg:col-span-5 border border-white/10 p-4 rounded-2xl flex flex-col justify-between space-y-3"
            style={innerStyle}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <ImageIcon size={14} className="text-emerald-400 shrink-0" /> Logo (SVG, PNG, JPG)
                </span>
                <p className="text-[11px] opacity-80 leading-relaxed">
                  Opcional (máx. 1 MB). Dimensión recomendada: <strong>240×72 px</strong> horizontal o{' '}
                  <strong>128×128 px</strong> cuadrado.
                </p>
              </div>

              <div
                className="w-16 h-14 rounded-xl border border-white/15 flex items-center justify-center p-1.5 shrink-0"
                style={cardStyle}
                title={formState.logoUrl ? 'Logo personalizado cargado' : 'Emblema por defecto'}
              >
                {formState.logoUrl ? (
                  <img
                    src={formState.logoUrl}
                    alt={previewTitle}
                    className="max-h-full max-w-full object-contain rounded"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                    <ShieldCheck size={18} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                <label
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-white/15 cursor-pointer hover:opacity-90 transition-opacity"
                  style={cardStyle}
                >
                  <Upload size={13} /> Subir logo
                  <input
                    type="file"
                    accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>

                {formState.logoUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/70 text-xs font-bold text-rose-200 border border-rose-800 cursor-pointer transition-colors"
                  >
                    <Trash2 size={13} /> Quitar
                  </button>
                )}
              </div>

              <span className="text-[10px] opacity-75 truncate max-w-40">
                {formState.logoFileName
                  ? formState.logoFileName
                  : formState.logoUrl
                    ? 'Logo personalizado'
                    : 'Emblema por defecto'}
              </span>
            </div>
          </div>

          {/* Tarjeta de campos de identidad textual del encabezado (nombre, badge y subtítulo) */}
          <div
            className="lg:col-span-7 border border-white/10 p-4 rounded-2xl space-y-3"
            style={innerStyle}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <Type size={14} className="text-emerald-400" /> Identidad del Menú (Opcional)
              </span>
              <span className="text-[11px] opacity-75">
                Si dejás un campo vacío, conserva el valor por defecto.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="block text-[11px] font-semibold opacity-85 mb-1">
                  Nombre en menú
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={formState.brandName}
                  onChange={(e) => updateIdentityField('brandName', e.target.value)}
                  placeholder="TrustLink"
                  className={`w-full px-3 ${FIELD_INPUT_CLASS}`}
                  style={cardStyle}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold opacity-85 mb-1">
                  Etiqueta / Badge
                </label>
                <input
                  type="text"
                  maxLength={40}
                  value={formState.brandBadge}
                  onChange={(e) => updateIdentityField('brandBadge', e.target.value)}
                  placeholder="Community"
                  className={`w-full px-3 ${FIELD_INPUT_CLASS}`}
                  style={cardStyle}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold opacity-85 mb-1">
                  Subtítulo institucional
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={formState.brandSubtitle}
                  onChange={(e) => updateIdentityField('brandSubtitle', e.target.value)}
                  placeholder="Red de Confianza Residencial"
                  className={`w-full px-3 ${FIELD_INPUT_CLASS}`}
                  style={cardStyle}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3. Zonas 1 a 6 alineadas + Vista Previa continua sticky */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider opacity-80">
            Zonas 1 a 6 — Fondo y Tipografía
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Columna Izquierda: 6 filas uniformes con indicador de contraste WCAG */}
            <div className="lg:col-span-7 space-y-2.5">
              {ZONES_CONFIG.map((item) => {
                const ratio = zoneContrastMap[item.zone] ?? 4.5;
                const isLow = ratio < 3;
                const isMedium = ratio >= 3 && ratio < 4.5;
                return (
                  <div
                    key={item.zone}
                    className={`border px-3.5 py-2.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                      isLow ? 'border-amber-500/70' : 'border-white/10'
                    }`}
                    style={innerStyle}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 shrink-0">
                        {item.zone}
                      </span>
                      <span className="text-xs font-bold truncate">{item.title}</span>
                      {isLow ? (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-700/70 shrink-0"
                          title={`Contraste WCAG ${ratio.toFixed(1)}:1 (recomendado ≥ 4.5:1)`}
                        >
                          Bajo ({ratio.toFixed(1)}:1)
                        </span>
                      ) : isMedium ? (
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-800/70 text-slate-300 border border-white/10 shrink-0"
                          title={`Contraste WCAG ${ratio.toFixed(1)}:1`}
                        >
                          {ratio.toFixed(1)}:1
                        </span>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-2 shrink-0">
                      {renderCompactColorInput('Fondo', item.bgField)}
                      {renderCompactColorInput('Tipografía', item.textField)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Columna Derecha: Vista Previa continua en un único marco sticky */}
            <div
              className="lg:col-span-5 lg:sticky lg:top-20 border border-white/10 p-4 rounded-2xl space-y-3"
              style={innerStyle}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <span className="text-xs font-bold">Vista previa en vivo</span>
                <span className="text-[11px] opacity-80">
                  {formState.darkMode ? 'Modo oscuro' : 'Modo claro'}
                </span>
              </div>

              {/* Marco continuo Zonas 1 → 6 sin huecos artificiales */}
              <div className="rounded-xl overflow-hidden border border-white/15 shadow-sm">
                {/* Zona 1: Menú */}
                <div
                  className="px-3.5 py-2.5 border-b border-white/10 flex items-center justify-between gap-2"
                  style={{
                    backgroundColor: formState.menuBgColor,
                    color: formState.menuTextColor,
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {formState.logoUrl ? (
                      <img
                        src={formState.logoUrl}
                        alt={previewTitle}
                        className="h-8 w-auto max-w-24 object-contain rounded"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <ShieldCheck size={16} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black truncate">{previewTitle}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-black/25 border border-white/15 shrink-0">
                          {previewBadge}
                        </span>
                      </div>
                      <p className="text-[10px] opacity-80 truncate">{previewSubtitle}</p>
                    </div>
                  </div>
                  <span className="text-[10px] opacity-75 shrink-0">Zona 1</span>
                </div>

                {/* Zona 2: Sub-menú */}
                <div
                  className="px-3.5 py-2 border-b border-white/10 flex items-center justify-between text-[11px]"
                  style={{
                    backgroundColor: formState.submenuBgColor,
                    color: formState.submenuTextColor,
                  }}
                >
                  <span className="font-semibold">Zona 2 — Sub-menú</span>
                  <span className="opacity-80">Administración</span>
                </div>

                {/* Zona 3: Plataforma general + Zona 4 Tarjeta + Zona 5 Caja Interna */}
                <div
                  className="p-3.5 space-y-2.5"
                  style={{
                    backgroundColor: formState.platformBgColor,
                    color: formState.platformTextColor,
                  }}
                >
                  <p className="text-[11px] font-semibold">Zona 3 — Plataforma general</p>

                  {/* Zona 4: Tarjeta principal */}
                  <div
                    className="p-3 rounded-xl border border-white/10 space-y-2"
                    style={{
                      backgroundColor: formState.cardBgColor,
                      color: formState.cardTextColor,
                    }}
                  >
                    <p className="text-xs font-bold">Zona 4 — Tarjetas principales</p>

                    {/* Zona 5: Caja interna */}
                    <div
                      className="p-2 rounded-lg border border-white/10 text-[11px]"
                      style={{
                        backgroundColor: formState.innerBgColor,
                        color: formState.innerTextColor,
                      }}
                    >
                      Zona 5 — Cajas internas
                    </div>
                  </div>
                </div>

                {/* Zona 6: Footer */}
                <div
                  className="px-3.5 py-2 border-t border-white/10 text-[11px] text-center"
                  style={{
                    backgroundColor: formState.footerBgColor,
                    color: formState.footerTextColor,
                  }}
                >
                  Zona 6 — Footer
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Barra de acciones con dirty-state real y confirmación en 2 clics para Restaurar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="submit"
              disabled={saving || resetting || !hasUnsavedChanges}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <Save size={15} />
              {saving ? 'Guardando...' : 'Guardar y Aplicar'}
            </button>

            {hasUnsavedChanges && (
              <button
                type="button"
                onClick={handleDiscardPreview}
                disabled={saving || resetting}
                className="px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-white/15 opacity-85 hover:opacity-100 transition-opacity cursor-pointer"
                style={innerStyle}
              >
                Descartar cambios
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {confirmingReset ? (
              <>
                <span className="text-[11px] text-amber-300 font-semibold">
                  ¿Restaurar valores de fábrica?
                </span>
                <button
                  type="button"
                  onClick={handleConfirmReset}
                  disabled={resetting}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw size={13} />
                  {resetting ? 'Restaurando...' : 'Confirmar restauración'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingReset(false)}
                  disabled={resetting}
                  className="px-3 py-2 rounded-xl text-xs font-semibold border border-white/15 inline-flex items-center gap-1 cursor-pointer"
                  style={innerStyle}
                >
                  <X size={13} /> Cancelar
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingReset(true)}
                disabled={saving || resetting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold border border-white/15 inline-flex items-center gap-2 transition-all hover:opacity-90 cursor-pointer disabled:opacity-45"
                style={innerStyle}
              >
                <RotateCcw size={14} />
                Restaurar por Defecto
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
