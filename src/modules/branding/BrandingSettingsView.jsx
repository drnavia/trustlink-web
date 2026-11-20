/**
 * @file BrandingSettingsView.jsx
 * @description Vista exclusiva de 'superadmin' para configurar fondos y tipografías
 * (plataforma general, menú y sub-menú), subir logo opcional (SVG, PNG, JPG)
 * y alternar el modo oscuro en TrustLink.
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

/**
 * Calcula luminancia relativa y relación de contraste aproximada entre dos colores HEX
 * para mostrar un aviso útil de legibilidad en la vista previa.
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
    platformBgColor: brand.platformBgColor || DEFAULT_BRANDING_CONFIG.platformBgColor,
    menuBgColor: brand.menuBgColor || DEFAULT_BRANDING_CONFIG.menuBgColor,
    submenuBgColor: brand.submenuBgColor || DEFAULT_BRANDING_CONFIG.submenuBgColor,
    platformTextColor: brand.platformTextColor || DEFAULT_BRANDING_CONFIG.platformTextColor,
    menuTextColor: brand.menuTextColor || DEFAULT_BRANDING_CONFIG.menuTextColor,
    submenuTextColor: brand.submenuTextColor || DEFAULT_BRANDING_CONFIG.submenuTextColor,
    logoUrl: brand.logoUrl || null,
    logoFileName: '',
    darkMode: typeof brand.darkMode === 'boolean' ? brand.darkMode : DEFAULT_BRANDING_CONFIG.darkMode,
  });

  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Sincroniza el formulario cuando cambia la configuración global desde el backend
  useEffect(() => {
    setFormState((prev) => ({
      ...prev,
      platformBgColor: brand.platformBgColor || DEFAULT_BRANDING_CONFIG.platformBgColor,
      menuBgColor: brand.menuBgColor || DEFAULT_BRANDING_CONFIG.menuBgColor,
      submenuBgColor: brand.submenuBgColor || DEFAULT_BRANDING_CONFIG.submenuBgColor,
      platformTextColor: brand.platformTextColor || DEFAULT_BRANDING_CONFIG.platformTextColor,
      menuTextColor: brand.menuTextColor || DEFAULT_BRANDING_CONFIG.menuTextColor,
      submenuTextColor: brand.submenuTextColor || DEFAULT_BRANDING_CONFIG.submenuTextColor,
      logoUrl: brand.logoUrl || null,
      darkMode: typeof brand.darkMode === 'boolean' ? brand.darkMode : DEFAULT_BRANDING_CONFIG.darkMode,
    }));
  }, [
    brand.platformBgColor,
    brand.menuBgColor,
    brand.submenuBgColor,
    brand.platformTextColor,
    brand.menuTextColor,
    brand.submenuTextColor,
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

  /**
   * Lee y valida una imagen SVG, PNG o JPG seleccionada por el usuario.
   */
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

    const allHexValid = [
      formState.platformBgColor,
      formState.menuBgColor,
      formState.submenuBgColor,
      formState.platformTextColor,
      formState.menuTextColor,
      formState.submenuTextColor,
    ].every((hex) => HEX_REGEX.test(hex));

    if (!allHexValid) {
      setFeedback({
        type: 'error',
        text: 'Verificá que todos los colores tengan formato hexadecimal válido (#RRGGBB).',
      });
      return;
    }

    setSaving(true);
    try {
      await saveBranding({
        platformBgColor: formState.platformBgColor,
        menuBgColor: formState.menuBgColor,
        submenuBgColor: formState.submenuBgColor,
        platformTextColor: formState.platformTextColor,
        menuTextColor: formState.menuTextColor,
        submenuTextColor: formState.submenuTextColor,
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
        platformBgColor: target.platformBgColor,
        menuBgColor: target.menuBgColor,
        submenuBgColor: target.submenuBgColor,
        platformTextColor: target.platformTextColor,
        menuTextColor: target.menuTextColor,
        submenuTextColor: target.submenuTextColor,
        logoUrl: target.logoUrl,
        logoFileName: '',
        darkMode: target.darkMode,
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

  // Verificación suave de contraste en vistas clave
  const platformContrast = getContrastRatio(
    formState.platformBgColor,
    formState.platformTextColor
  );
  const menuContrast = getContrastRatio(formState.menuBgColor, formState.menuTextColor);
  const submenuContrast = getContrastRatio(
    formState.submenuBgColor,
    formState.submenuTextColor
  );
  const hasLowContrastWarning =
    platformContrast < 3 || menuContrast < 3 || submenuContrast < 3;

  const renderColorRow = (label, description, field) => {
    const value = formState[field];
    const isValid = HEX_REGEX.test(value);

    return (
      <div className="bg-slate-900/70 border border-slate-800 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-white">{label}</p>
          <p className="text-[11px] text-slate-400">{description}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <input
            type="color"
            aria-label={label}
            value={isValid ? value : '#0F172A'}
            onChange={(e) => updateColorField(field, e.target.value)}
            className="w-10 h-9 rounded-lg bg-slate-950 border border-slate-700 cursor-pointer p-0.5"
          />
          <input
            type="text"
            maxLength={7}
            value={value}
            onChange={(e) => updateColorField(field, e.target.value)}
            placeholder="#000000"
            className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white uppercase focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8 bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl my-8 font-sans">
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
              Fondos, tipografías, logo opcional y modo oscuro para toda la plataforma.
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
            Aviso de contraste: alguna combinación de fondo y tipografía tiene bajo contraste y puede dificultar la lectura.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Columna Izquierda: Controles */}
        <form onSubmit={handleSave} className="lg:col-span-7 space-y-6">
          {/* 1. Fondos */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Colores de Fondo
            </h3>
            {renderColorRow(
              'Fondo de la plataforma general',
              'Fondo base de la aplicación y vistas principales.',
              'platformBgColor'
            )}
            {renderColorRow(
              'Fondo del menú',
              'Color de fondo de la barra de navegación superior.',
              'menuBgColor'
            )}
            {renderColorRow(
              'Fondo del sub-menú',
              'Color de fondo de la barra secundaria de Modo Maestro.',
              'submenuBgColor'
            )}
          </div>

          {/* 2. Tipografías */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Colores de Tipografía
            </h3>
            {renderColorRow(
              'Tipografía de la plataforma general',
              'Color de texto principal en vistas y contenidos.',
              'platformTextColor'
            )}
            {renderColorRow(
              'Tipografía del menú',
              'Color de texto de la barra de navegación superior.',
              'menuTextColor'
            )}
            {renderColorRow(
              'Tipografía del sub-menú',
              'Color de texto del sub-menú de gobernanza.',
              'submenuTextColor'
            )}
          </div>

          {/* 3. Logo Institucional Opcional + Modo Oscuro */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Subir Logo (SVG, PNG, JPG) */}
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

            {/* Switch Modo Oscuro */}
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
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
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

        {/* Columna Derecha: Vista Previa en Vivo */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-bold text-slate-200">Vista previa en vivo</span>
            <span className="text-[11px] text-slate-400">
              {formState.darkMode ? 'Modo oscuro' : 'Modo claro'}
            </span>
          </div>

          {/* Simulación de Menú */}
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
              <span className="text-xs font-bold truncate">TrustLink — Menú</span>
            </div>
            <span className="text-[11px] opacity-80 shrink-0">Navegación</span>
          </div>

          {/* Simulación de Sub-menú */}
          <div
            className="px-3.5 py-2 border-x border-slate-700/70 flex items-center justify-between text-[11px]"
            style={{
              backgroundColor: formState.submenuBgColor,
              color: formState.submenuTextColor,
            }}
          >
            <span className="font-semibold">Sub-menú Modo Maestro</span>
            <span className="opacity-80">Apariencia y Marca</span>
          </div>

          {/* Simulación de Plataforma General */}
          <div
            className="p-4 rounded-b-xl border border-slate-700/70 space-y-2"
            style={{
              backgroundColor: formState.platformBgColor,
              color: formState.platformTextColor,
            }}
          >
            <p className="text-xs font-bold">Contenido de la plataforma general</p>
            <p className="text-[11px] opacity-85 leading-relaxed">
              Así se visualizan los textos y fondos de la plataforma principal con la configuración seleccionada.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}