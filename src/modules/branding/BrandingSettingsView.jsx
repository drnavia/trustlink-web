/**
 * @file BrandingSettingsView.jsx
 * @description Vista exclusiva de 'superadmin' para configurar presets rápidos minimalistas,
 * logo opcional (SVG, PNG, JPG) con vista previa directa de la imagen o emblema vigente,
 * identidad opcional del menú, fondos y tipografías de las Zonas 1 a 6 en formato compacto
 * y modo oscuro, con vista previa en vivo alineada y persistencia en PostgreSQL.
 * @location /trustlink-web/src/modules/branding/BrandingSettingsView.jsx
 */

import React, { useState, useEffect } from 'react';
import {
  Palette,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Lock,
  Upload,
  Trash2,
  Moon,
  Sun,
  Image as ImageIcon,
  ShieldCheck,
  Sparkles,
  Type,
} from 'lucide-react';
import {
  useBranding,
  DEFAULT_BRANDING_CONFIG,
  BRANDING_PRESETS,
} from './BrandingContext';

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;
const ALLOWED_MIME_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg'];
const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1 MB

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
    title: 'Fondo de la plataforma general',
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

/**
 * Calcula la relación de contraste aproximada entre dos colores HEX.
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

export default function BrandingSettingsView() {
  const {
    brand,
    defaults,
    previewBranding,
    applyBrandingPreset,
    saveBranding,
    resetBranding,
    fetchBranding,
  } = useBranding();

  const cardStyle = {
    backgroundColor: brand.cardBgColor || DEFAULT_BRANDING_CONFIG.cardBgColor,
    color: brand.cardTextColor || DEFAULT_BRANDING_CONFIG.cardTextColor,
  };

  const innerStyle = {
    backgroundColor: brand.innerBgColor || DEFAULT_BRANDING_CONFIG.innerBgColor,
    color: brand.innerTextColor || DEFAULT_BRANDING_CONFIG.innerTextColor,
  };

  const [formState, setFormState] = useState({
    ...DEFAULT_BRANDING_CONFIG,
    logoFileName: '',
  });

  const [selectedPresetKey, setSelectedPresetKey] = useState('default');
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  useEffect(() => {
    setFormState((prev) => ({
      ...prev,
      brandName: brand.brandName || DEFAULT_BRANDING_CONFIG.brandName,
      brandBadge: brand.brandBadge || DEFAULT_BRANDING_CONFIG.brandBadge,
      brandSubtitle: brand.brandSubtitle || DEFAULT_BRANDING_CONFIG.brandSubtitle,
      menuBgColor: brand.menuBgColor || DEFAULT_BRANDING_CONFIG.menuBgColor,
      menuTextColor: brand.menuTextColor || DEFAULT_BRANDING_CONFIG.menuTextColor,
      submenuBgColor: brand.submenuBgColor || DEFAULT_BRANDING_CONFIG.submenuBgColor,
      submenuTextColor: brand.submenuTextColor || DEFAULT_BRANDING_CONFIG.submenuTextColor,
      platformBgColor: brand.platformBgColor || DEFAULT_BRANDING_CONFIG.platformBgColor,
      platformTextColor: brand.platformTextColor || DEFAULT_BRANDING_CONFIG.platformTextColor,
      cardBgColor: brand.cardBgColor || DEFAULT_BRANDING_CONFIG.cardBgColor,
      cardTextColor: brand.cardTextColor || DEFAULT_BRANDING_CONFIG.cardTextColor,
      innerBgColor: brand.innerBgColor || DEFAULT_BRANDING_CONFIG.innerBgColor,
      innerTextColor: brand.innerTextColor || DEFAULT_BRANDING_CONFIG.innerTextColor,
      footerBgColor: brand.footerBgColor || DEFAULT_BRANDING_CONFIG.footerBgColor,
      footerTextColor: brand.footerTextColor || DEFAULT_BRANDING_CONFIG.footerTextColor,
      logoUrl: brand.logoUrl || null,
      darkMode: typeof brand.darkMode === 'boolean' ? brand.darkMode : DEFAULT_BRANDING_CONFIG.darkMode,
    }));
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

  const updateIdentityField = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    previewBranding({ [field]: value });
  };

  const updateColorField = (field, rawValue) => {
    let cleaned = rawValue.trim().toUpperCase();
    if (cleaned && !cleaned.startsWith('#')) {
      cleaned = `#${cleaned}`;
    }
    setSelectedPresetKey('custom');
    setFormState((prev) => ({ ...prev, [field]: cleaned }));
    if (HEX_REGEX.test(cleaned)) {
      previewBranding({ [field]: cleaned });
    }
  };

  const handleDarkModeToggle = (checked) => {
    setSelectedPresetKey('custom');
    setFormState((prev) => ({ ...prev, darkMode: checked }));
    previewBranding({ darkMode: checked });
  };

  const handleApplyPreset = (presetKey) => {
    const presetObj = BRANDING_PRESETS[presetKey];
    if (!presetObj) return;
    setFeedback({ type: '', text: '' });
    setSelectedPresetKey(presetKey);
    setFormState((prev) => ({
      ...prev,
      ...presetObj.config,
    }));
    applyBrandingPreset(presetKey);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFeedback({ type: '', text: '' });

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

  const handleRemoveLogo = () => {
    setFeedback({ type: '', text: '' });
    setFormState((prev) => ({
      ...prev,
      logoUrl: null,
      logoFileName: '',
    }));
    previewBranding({ logoUrl: null });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', text: '' });

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

    setSaving(true);
    try {
      await saveBranding({
        brandName: formState.brandName,
        brandBadge: formState.brandBadge,
        brandSubtitle: formState.brandSubtitle,
        menuBgColor: formState.menuBgColor,
        menuTextColor: formState.menuTextColor,
        submenuBgColor: formState.submenuBgColor,
        submenuTextColor: formState.submenuTextColor,
        platformBgColor: formState.platformBgColor,
        platformTextColor: formState.platformTextColor,
        cardBgColor: formState.cardBgColor,
        cardTextColor: formState.cardTextColor,
        innerBgColor: formState.innerBgColor,
        innerTextColor: formState.innerTextColor,
        footerBgColor: formState.footerBgColor,
        footerTextColor: formState.footerTextColor,
        logoUrl: formState.logoUrl,
        darkMode: formState.darkMode,
      });

      setFeedback({
        type: 'success',
        text: 'Apariencia e identidad guardadas en PostgreSQL y aplicadas en toda la plataforma.',
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

  const handleReset = async () => {
    setFeedback({ type: '', text: '' });
    setResetting(true);
    try {
      const target = defaults || DEFAULT_BRANDING_CONFIG;
      await resetBranding();
      setSelectedPresetKey('default');
      setFormState({
        ...target,
        logoFileName: '',
      });
      setFeedback({
        type: 'success',
        text: 'Configuración restaurada a los valores por defecto de TrustLink.',
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

  const handleDiscardPreview = async () => {
    setFeedback({ type: '', text: '' });
    setSelectedPresetKey('default');
    await fetchBranding();
  };

  const hasLowContrastWarning = ZONES_CONFIG.some(
    (z) => getContrastRatio(formState[z.bgField], formState[z.textField]) < 3
  );

  const renderCompactColorInput = (label, field) => {
    const value = formState[field];
    const isValid = HEX_REGEX.test(value);

    return (
      <div
        className="flex items-center justify-between gap-2 border border-black/20 px-2.5 py-1.5 rounded-lg"
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
            className="w-[74px] border border-white/15 rounded px-1.5 py-0.5 text-[11px] font-mono uppercase focus:outline-none"
            style={innerStyle}
          />
        </div>
      </div>
    );
  };

  const previewTitle = (formState.brandName || '').trim() || DEFAULT_BRANDING_CONFIG.brandName;
  const previewBadge = (formState.brandBadge || '').trim() || DEFAULT_BRANDING_CONFIG.brandBadge;
  const previewSubtitle =
    (formState.brandSubtitle || '').trim() || DEFAULT_BRANDING_CONFIG.brandSubtitle;

  return (
    <form
      onSubmit={handleSave}
      className="max-w-6xl w-full mx-auto p-6 md:p-8 rounded-2xl border border-black/20 my-6 font-sans space-y-6"
      style={cardStyle}
    >
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-5 border-b border-black/20 gap-4">
        <div className="flex items-center gap-3">
          <div
            className="p-3 rounded-xl border border-white/15 text-emerald-400"
            style={innerStyle}
          >
            <Palette size={22} />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">
              Apariencia y Marca
            </h2>
            <p className="text-xs opacity-80 mt-0.5">
              Identidad del menú, fondos y tipografías de Zona 1 a Zona 6, presets rápidos, logo y modo oscuro.
            </p>
          </div>
        </div>

        <span
          className="text-xs font-bold text-emerald-400 px-4 py-2 rounded-xl border border-white/15 inline-flex items-center gap-1.5 self-start md:self-auto"
          style={innerStyle}
        >
          <Lock size={13} /> Acceso Maestro
        </span>
      </div>

      {/* 1. Presets de Piel Rápidos (Minimalistas y Compactos) */}
      <section
        className="border border-black/20 p-4 rounded-2xl space-y-3"
        style={innerStyle}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-emerald-400">
            <Sparkles size={14} /> Presets de Piel Rápidos
          </h3>
          <p className="text-[11px] opacity-80">
            Previsualizá un esquema al instante; luego presioná Guardar y Aplicar.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {Object.entries(BRANDING_PRESETS).map(([key, preset]) => {
            const isSelected = selectedPresetKey === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleApplyPreset(key)}
                title={preset.description}
                className={`px-3 py-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                  isSelected
                    ? 'border-emerald-400 ring-2 ring-emerald-500/40'
                    : 'border-white/15 hover:border-white/30'
                }`}
                style={cardStyle}
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{preset.name}</p>
                  <span className="text-[10px] font-mono opacity-70">
                    {preset.config.darkMode ? 'Dark' : 'Light'}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-white/30"
                    style={{ backgroundColor: preset.config.menuBgColor }}
                    title="Zona 1 — Menú"
                  />
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-white/30"
                    style={{ backgroundColor: preset.config.platformBgColor }}
                    title="Zona 3 — Plataforma"
                  />
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-white/30"
                    style={{ backgroundColor: preset.config.cardBgColor }}
                    title="Zona 4 — Tarjetas"
                  />
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-white/30"
                    style={{ backgroundColor: preset.config.innerBgColor }}
                    title="Zona 5 — Cajas internas"
                  />
                </div>
              </button>
            );
          })}
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

      {/* Aviso preventivo de contraste */}
      {hasLowContrastWarning && (
        <div className="p-3.5 rounded-xl text-xs flex items-center gap-2 border bg-amber-950/50 border-amber-800/70 text-amber-200">
          <AlertCircle size={16} className="text-amber-400 shrink-0" />
          <span>
            Aviso de contraste: en alguna de las zonas el color de tipografía y el color de fondo tienen bajo contraste.
          </span>
        </div>
      )}

      {/* 2. Fila Intermedia: Logo con vista previa directa + Identidad del Menú */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div
          className="lg:col-span-5 border border-black/20 p-4 rounded-xl flex flex-col justify-between space-y-3"
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

            {/* Vista previa del logo actual (cargado o por defecto) */}
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
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold border border-white/15 cursor-pointer transition-colors"
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
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 text-xs font-bold text-rose-200 border border-rose-800 cursor-pointer transition-colors"
                >
                  <Trash2 size={13} /> Quitar
                </button>
              )}
            </div>

            <span className="text-[10px] opacity-75 truncate max-w-[160px]">
              {formState.logoFileName
                ? formState.logoFileName
                : formState.logoUrl
                ? 'Logo personalizado'
                : 'Emblema por defecto'}
            </span>
          </div>
        </div>

        <div
          className="lg:col-span-7 border border-black/20 p-4 rounded-xl space-y-3"
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
                className="w-full px-3 py-1.5 rounded-lg border border-white/15 text-xs focus:outline-none"
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
                className="w-full px-3 py-1.5 rounded-lg border border-white/15 text-xs focus:outline-none"
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
                className="w-full px-3 py-1.5 rounded-lg border border-white/15 text-xs focus:outline-none"
                style={cardStyle}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Zonas 1 a 6 Minimalistas + Vista Previa en Vivo Alineada a la Altura de ZONA 1 */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider opacity-80">
          Zonas 1 a 6 — Fondo y Tipografía
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Columna Izquierda: Filas compactas de Zonas 1 a 6 + Modo Oscuro */}
          <div className="lg:col-span-7 space-y-2.5">
            {ZONES_CONFIG.map((item) => (
              <div
                key={item.zone}
                className="border border-black/20 px-3.5 py-2.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                style={innerStyle}
              >
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mr-2">
                    {item.zone}
                  </span>
                  <span className="text-xs font-bold">{item.title}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 shrink-0">
                  {renderCompactColorInput('Fondo', item.bgField)}
                  {renderCompactColorInput('Tipografía', item.textField)}
                </div>
              </div>
            ))}

            {/* Modo Oscuro compacto */}
            <div
              className="border border-black/20 px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3"
              style={innerStyle}
            >
              <div className="flex items-center gap-2">
                {formState.darkMode ? (
                  <Moon size={14} className="text-emerald-400 shrink-0" />
                ) : (
                  <Sun size={14} className="text-amber-400 shrink-0" />
                )}
                <span className="text-xs font-bold">Modo Oscuro</span>
              </div>

              <label
                className="inline-flex items-center gap-2.5 border border-white/15 px-3 py-1.5 rounded-lg cursor-pointer text-xs font-semibold"
                style={cardStyle}
              >
                <span>{formState.darkMode ? 'Activado' : 'Desactivado'}</span>
                <input
                  type="checkbox"
                  checked={Boolean(formState.darkMode)}
                  onChange={(e) => handleDarkModeToggle(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Columna Derecha: Vista Previa en Vivo alineada a la altura de ZONA 1 */}
          <div
            className="lg:col-span-5 border border-black/20 p-4 rounded-2xl space-y-3"
            style={innerStyle}
          >
            <div className="flex items-center justify-between border-b border-black/20 pb-2.5">
              <span className="text-xs font-bold">Vista previa en vivo</span>
              <span className="text-[11px] opacity-80">
                {formState.darkMode ? 'Modo oscuro' : 'Modo claro'}
              </span>
            </div>

            {/* Zona 1: Menú */}
            <div
              className="px-3.5 py-2.5 rounded-t-xl border border-black/20 flex items-center justify-between gap-2"
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
                    className="h-8 w-auto max-w-[96px] object-contain rounded"
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
              className="px-3.5 py-2 border-x border-black/20 flex items-center justify-between text-[11px]"
              style={{
                backgroundColor: formState.submenuBgColor,
                color: formState.submenuTextColor,
              }}
            >
              <span className="font-semibold">Zona 2 — Sub-menú</span>
              <span className="opacity-80">Modo Maestro</span>
            </div>

            {/* Zona 3: Fondo Plataforma + Zona 4 Tarjeta + Zona 5 Caja Interna */}
            <div
              className="p-3.5 border-x border-black/20 space-y-2.5"
              style={{
                backgroundColor: formState.platformBgColor,
                color: formState.platformTextColor,
              }}
            >
              <p className="text-[11px] font-semibold">Zona 3 — Fondo de la plataforma general</p>

              {/* Zona 4: Tarjeta principal */}
              <div
                className="p-3 rounded-xl border border-black/20 space-y-2"
                style={{
                  backgroundColor: formState.cardBgColor,
                  color: formState.cardTextColor,
                }}
              >
                <p className="text-xs font-bold">Zona 4 — Tarjetas principales</p>

                {/* Zona 5: Caja interna */}
                <div
                  className="p-2 rounded-lg border border-black/20 text-[11px]"
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
              className="px-3.5 py-2 rounded-b-xl border border-black/20 text-[11px] text-center"
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

      {/* 4. Botones de Guardar y Restaurar */}
      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-black/20">
        <button
          type="submit"
          disabled={saving || resetting}
          className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
        >
          <Save size={15} />
          {saving ? 'Guardando...' : 'Guardar y Aplicar'}
        </button>

        <button
          type="button"
          onClick={handleReset}
          disabled={saving || resetting}
          className="px-4 py-2.5 rounded-xl text-xs font-bold border border-white/15 inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          style={innerStyle}
        >
          <RotateCcw size={14} />
          {resetting ? 'Restaurando...' : 'Restaurar por Defecto'}
        </button>

        <button
          type="button"
          onClick={handleDiscardPreview}
          disabled={saving || resetting}
          className="px-3.5 py-2.5 rounded-xl text-xs font-semibold opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
        >
          Descartar cambios sin guardar
        </button>
      </div>
    </form>
  );
}