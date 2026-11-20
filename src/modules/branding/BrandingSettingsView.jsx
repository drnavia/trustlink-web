/**
 * @file BrandingSettingsView.jsx
 * @description Vista exclusiva de 'superadmin' ordenada por Zonas 1 a 6 (Menú, Sub-menú,
 * Plataforma general, Tarjetas principales, Cajas internas y Footer), mostrando en cada zona
 * su color de fondo y su color de tipografía, junto con logo opcional (SVG, PNG, JPG) y modo oscuro.
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
} from 'lucide-react';
import { useBranding, DEFAULT_BRANDING_CONFIG } from './BrandingContext';

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;
const ALLOWED_MIME_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg'];
const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1 MB

const ZONES_CONFIG = [
  {
    zone: 'Zona 1',
    title: 'Menú',
    description: 'Barra de navegación superior principal.',
    bgField: 'menuBgColor',
    textField: 'menuTextColor',
  },
  {
    zone: 'Zona 2',
    title: 'Sub-menú',
    description: 'Barra secundaria de Gobernanza / Modo Maestro.',
    bgField: 'submenuBgColor',
    textField: 'submenuTextColor',
  },
  {
    zone: 'Zona 3',
    title: 'Fondo de la plataforma general',
    description: 'Lienzo general de la aplicación en todas las vistas.',
    bgField: 'platformBgColor',
    textField: 'platformTextColor',
  },
  {
    zone: 'Zona 4',
    title: 'Tarjetas principales',
    description: 'Contenedores y tarjetas principales de cada vista.',
    bgField: 'cardBgColor',
    textField: 'cardTextColor',
  },
  {
    zone: 'Zona 5',
    title: 'Cajas internas',
    description: 'Bloques internos, sub-paneles y elementos secundarios.',
    bgField: 'innerBgColor',
    textField: 'innerTextColor',
  },
  {
    zone: 'Zona 6',
    title: 'Footer',
    description: 'Pie institucional inferior de la plataforma.',
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
    saveBranding,
    resetBranding,
    fetchBranding,
  } = useBranding();

  const [formState, setFormState] = useState({
    ...DEFAULT_BRANDING_CONFIG,
    logoFileName: '',
  });

  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  useEffect(() => {
    setFormState((prev) => ({
      ...prev,
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

  const updateColorField = (field, rawValue) => {
    let cleaned = rawValue.trim().toUpperCase();
    if (cleaned && !cleaned.startsWith('#')) {
      cleaned = `#${cleaned}`;
    }
    setFormState((prev) => ({ ...prev, [field]: cleaned }));
    if (HEX_REGEX.test(cleaned)) {
      previewBranding({ [field]: cleaned });
    }
  };

  const handleDarkModeToggle = (checked) => {
    setFormState((prev) => ({ ...prev, darkMode: checked }));
    previewBranding({ darkMode: checked });
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

  const handleReset = async () => {
    setFeedback({ type: '', text: '' });
    setResetting(true);
    try {
      const target = defaults || DEFAULT_BRANDING_CONFIG;
      await resetBranding();
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
    await fetchBranding();
  };

  const hasLowContrastWarning = ZONES_CONFIG.some(
    (z) => getContrastRatio(formState[z.bgField], formState[z.textField]) < 3
  );

  const renderMiniColorControl = (label, field) => {
    const value = formState[field];
    const isValid = HEX_REGEX.test(value);

    return (
      <div className="flex items-center justify-between gap-2 bg-slate-950/80 border border-slate-800 px-3 py-2 rounded-lg">
        <span className="text-[11px] font-semibold text-slate-300">{label}</span>
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            aria-label={`${label} selector`}
            value={isValid ? value : '#0F172A'}
            onChange={(e) => updateColorField(field, e.target.value)}
            className="w-7 h-7 rounded bg-slate-900 border border-slate-700 cursor-pointer p-0.5"
          />
          <input
            type="text"
            maxLength={7}
            value={value}
            onChange={(e) => updateColorField(field, e.target.value)}
            placeholder="#000000"
            className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] font-mono text-white uppercase focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8 bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 my-8 font-sans">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 mb-8 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Palette size={22} />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-white">
              Apariencia y Marca
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Fondos y tipografías ordenados de Zona 1 a Zona 6, logo opcional y modo oscuro.
            </p>
          </div>
        </div>

        <span className="text-xs font-bold bg-slate-900 text-emerald-400 px-4 py-2 rounded-xl border border-slate-800 inline-flex items-center gap-1.5 self-start md:self-auto">
          <Lock size={13} /> Acceso Maestro
        </span>
      </div>

      {/* Mensajes de estado */}
      {feedback.text && (
        <div
          className={`p-4 rounded-xl mb-6 text-xs flex items-center gap-2 border ${
            feedback.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/50 border-rose-800 text-rose-200'
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
        <div className="p-3.5 rounded-xl mb-6 text-xs flex items-center gap-2 border bg-amber-950/40 border-amber-800/70 text-amber-200">
          <AlertCircle size={16} className="text-amber-400 shrink-0" />
          <span>
            Aviso de contraste: en alguna de las zonas el color de tipografía y el color de fondo tienen bajo contraste.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Columna Izquierda: Zonas 1 a 6 Ordenadas (Fondo + Tipografía por Zona) */}
        <form onSubmit={handleSave} className="lg:col-span-7 space-y-6">
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Zonas 1 a 6 — Fondo y Tipografía
            </h3>

            {ZONES_CONFIG.map((item) => (
              <div
                key={item.zone}
                className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mr-2">
                      {item.zone}
                    </span>
                    <span className="text-xs font-bold text-white">{item.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{item.description}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {renderMiniColorControl('Fondo', item.bgField)}
                  {renderMiniColorControl('Tipografía', item.textField)}
                </div>
              </div>
            ))}
          </div>

          {/* Logo Institucional Opcional + Modo Oscuro */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ImageIcon size={14} className="text-emerald-400" /> Logo (SVG, PNG, JPG)
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Opcional. Si no subís ninguno, se mantiene el emblema por defecto de TrustLink.
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 cursor-pointer transition-colors">
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

              {formState.logoFileName && (
                <p className="text-[11px] text-slate-400 truncate">
                  Archivo: <span className="font-mono text-slate-200">{formState.logoFileName}</span>
                </p>
              )}
            </div>

            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-3">
              <div className="space-y-1">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  {formState.darkMode ? (
                    <Moon size={14} className="text-emerald-400" />
                  ) : (
                    <Sun size={14} className="text-amber-400" />
                  )}
                  Modo Oscuro
                </span>
                <p className="text-[11px] text-slate-400">
                  Activa el esquema oscuro en toda la plataforma o alterná a modo claro.
                </p>
              </div>

              <label className="inline-flex items-center justify-between bg-slate-950 border border-slate-800 px-3.5 py-2.5 rounded-xl cursor-pointer">
                <span className="text-xs font-bold text-slate-200">
                  {formState.darkMode ? 'Activado (Oscuro)' : 'Desactivado (Claro)'}
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(formState.darkMode)}
                  onChange={(e) => handleDarkModeToggle(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Botones de Guardar y Restaurar */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
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
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RotateCcw size={14} />
              {resetting ? 'Restaurando...' : 'Restaurar por Defecto'}
            </button>

            <button
              type="button"
              onClick={handleDiscardPreview}
              disabled={saving || resetting}
              className="px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Descartar cambios sin guardar
            </button>
          </div>
        </form>

        {/* Columna Derecha: Vista Previa en Vivo (Zonas 1 a 6) */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-bold text-slate-200">Vista previa en vivo</span>
            <span className="text-[11px] text-slate-400">
              {formState.darkMode ? 'Modo oscuro' : 'Modo claro'}
            </span>
          </div>

          {/* Zona 1: Menú */}
          <div
            className="px-3.5 py-2.5 rounded-t-xl border border-slate-700/70 flex items-center justify-between gap-2"
            style={{
              backgroundColor: formState.menuBgColor,
              color: formState.menuTextColor,
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {formState.logoUrl ? (
                <img
                  src={formState.logoUrl}
                  alt="Logo TrustLink"
                  className="h-7 w-auto max-w-[96px] object-contain rounded"
                />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <ShieldCheck size={15} />
                </div>
              )}
              <span className="text-xs font-bold truncate">Zona 1 — Menú</span>
            </div>
            <span className="text-[11px] opacity-80 shrink-0">Navegación</span>
          </div>

          {/* Zona 2: Sub-menú */}
          <div
            className="px-3.5 py-2 border-x border-slate-700/70 flex items-center justify-between text-[11px]"
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
            className="p-4 border-x border-slate-700/70 space-y-3"
            style={{
              backgroundColor: formState.platformBgColor,
              color: formState.platformTextColor,
            }}
          >
            <p className="text-[11px] font-semibold">Zona 3 — Fondo de la plataforma general</p>

            {/* Zona 4: Tarjeta principal */}
            <div
              className="p-3.5 rounded-xl border border-slate-700/70 space-y-2.5"
              style={{
                backgroundColor: formState.cardBgColor,
                color: formState.cardTextColor,
              }}
            >
              <p className="text-xs font-bold">Zona 4 — Tarjetas principales</p>

              {/* Zona 5: Caja interna */}
              <div
                className="p-2.5 rounded-lg border border-slate-700/70 text-[11px]"
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
            className="px-3.5 py-2.5 rounded-b-xl border border-slate-700/70 text-[11px] text-center"
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
  );
}