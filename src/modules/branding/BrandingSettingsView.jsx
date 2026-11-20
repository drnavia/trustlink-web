/**
 * @file BrandingSettingsView.jsx
 * @description Panel exclusivo de 'superadmin' para personalizar los 3 colores principales
 * de TrustLink (Primario, Secundario y Acento) con vista previa en tiempo real
 * y persistencia en PostgreSQL.
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
  Sparkles,
  ShieldCheck,
  QrCode,
  Eye,
} from 'lucide-react';
import { useBranding, DEFAULT_BRAND_COLORS } from './BrandingContext';

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

const PRESET_PALETTES = [
  {
    name: 'TrustLink Institucional (Defecto)',
    primaryColor: '#0A2540',
    secondaryColor: '#1E293B',
    accentColor: '#10B981',
  },
  {
    name: 'Zafiro & Cian Ejecutivo',
    primaryColor: '#0F172A',
    secondaryColor: '#1E3A8A',
    accentColor: '#06B6D4',
  },
  {
    name: 'Grafito & Ámbar Dorado',
    primaryColor: '#18181B',
    secondaryColor: '#27272A',
    accentColor: '#F59E0B',
  },
  {
    name: 'Bosque Profundo & Esmeralda',
    primaryColor: '#052E16',
    secondaryColor: '#14532D',
    accentColor: '#22C55E',
  },
];

export default function BrandingSettingsView() {
  const {
    brand,
    defaults,
    previewBranding,
    saveBrandingColors,
    resetBrandingColors,
    fetchBranding,
  } = useBranding();

  const [primaryColor, setPrimaryColor] = useState(
    brand.primaryColor || DEFAULT_BRAND_COLORS.primaryColor
  );
  const [secondaryColor, setSecondaryColor] = useState(
    brand.secondaryColor || DEFAULT_BRAND_COLORS.secondaryColor
  );
  const [accentColor, setAccentColor] = useState(
    brand.accentColor || DEFAULT_BRAND_COLORS.accentColor
  );

  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Sincroniza los inputs locales cuando se cargan los valores reales desde backend
  useEffect(() => {
    setPrimaryColor(brand.primaryColor || DEFAULT_BRAND_COLORS.primaryColor);
    setSecondaryColor(brand.secondaryColor || DEFAULT_BRAND_COLORS.secondaryColor);
    setAccentColor(brand.accentColor || DEFAULT_BRAND_COLORS.accentColor);
  }, [brand.primaryColor, brand.secondaryColor, brand.accentColor]);

  const handleHexInput = (setter, key, rawValue) => {
    let val = rawValue.trim().toUpperCase();
    if (val && !val.startsWith('#')) {
      val = `#${val}`;
    }
    setter(val);
    if (HEX_REGEX.test(val)) {
      previewBranding({ [key]: val });
    }
  };

  const handlePickerChange = (setter, key, hexValue) => {
    const normalized = hexValue.toUpperCase();
    setter(normalized);
    previewBranding({ [key]: normalized });
  };

  const handleApplyPreset = (preset) => {
    setFeedback({ type: '', text: '' });
    setPrimaryColor(preset.primaryColor);
    setSecondaryColor(preset.secondaryColor);
    setAccentColor(preset.accentColor);
    previewBranding({
      primaryColor: preset.primaryColor,
      secondaryColor: preset.secondaryColor,
      accentColor: preset.accentColor,
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', text: '' });

    if (
      !HEX_REGEX.test(primaryColor) ||
      !HEX_REGEX.test(secondaryColor) ||
      !HEX_REGEX.test(accentColor)
    ) {
      setFeedback({
        type: 'error',
        text: 'Verifica que los 3 colores tengan formato hexadecimal válido (#RRGGBB).',
      });
      return;
    }

    setSaving(true);
    try {
      await saveBrandingColors({
        primaryColor,
        secondaryColor,
        accentColor,
      });
      setFeedback({
        type: 'success',
        text: 'Paleta de 3 colores guardada y aplicada en toda la plataforma.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error.message || 'No se pudieron guardar los colores.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setFeedback({ type: '', text: '' });
    setResetting(true);
    try {
      const targetDefaults = defaults || DEFAULT_BRAND_COLORS;
      await resetBrandingColors();
      setPrimaryColor(targetDefaults.primaryColor);
      setSecondaryColor(targetDefaults.secondaryColor);
      setAccentColor(targetDefaults.accentColor);
      setFeedback({
        type: 'success',
        text: 'Colores restaurados a la paleta institucional por defecto.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error.message || 'No se pudieron restaurar los colores por defecto.',
      });
    } finally {
      setResetting(false);
    }
  };

  const handleDiscardPreview = async () => {
    setFeedback({ type: '', text: '' });
    await fetchBranding();
  };

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8 bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl my-8 font-sans">
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 mb-8 gap-4">
        <div className="flex items-center gap-3">
          <div
            className="p-3 rounded-xl border border-slate-700 text-white shadow-md"
            style={{ backgroundColor: primaryColor }}
          >
            <Palette size={24} style={{ color: accentColor }} />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-white">
              Identidad Visual &amp; Paleta de Colores
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Personaliza los 3 colores principales de TrustLink (Primario, Secundario y Acento) con impacto global en tiempo real.
            </p>
          </div>
        </div>

        <span className="text-xs font-bold bg-slate-900 text-slate-200 px-4 py-2 rounded-xl border border-slate-800 inline-flex items-center gap-1.5 self-start md:self-auto">
          <Lock size={13} style={{ color: accentColor }} /> Nivel: Superadmin Global
        </span>
      </div>

      {/* Feedback */}
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Columna Izquierda: Formulario de 3 Colores */}
        <form onSubmit={handleSave} className="lg:col-span-7 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 1. Color Primario */}
            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">1. Color Primario</span>
                <span
                  className="w-4 h-4 rounded-full border border-slate-600"
                  style={{ backgroundColor: HEX_REGEX.test(primaryColor) ? primaryColor : '#0A2540' }}
                />
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Identidad institucional, emblemas, cabeceras y botones principales de marca.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Selector Color Primario"
                  value={HEX_REGEX.test(primaryColor) ? primaryColor : '#0A2540'}
                  onChange={(e) => handlePickerChange(setPrimaryColor, 'primaryColor', e.target.value)}
                  className="w-11 h-10 rounded-lg bg-slate-950 border border-slate-700 cursor-pointer p-1"
                />
                <input
                  type="text"
                  maxLength={7}
                  value={primaryColor}
                  onChange={(e) => handleHexInput(setPrimaryColor, 'primaryColor', e.target.value)}
                  placeholder="#0A2540"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white uppercase focus:outline-none"
                />
              </div>
            </div>

            {/* 2. Color Secundario */}
            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">2. Color Secundario</span>
                <span
                  className="w-4 h-4 rounded-full border border-slate-600"
                  style={{ backgroundColor: HEX_REGEX.test(secondaryColor) ? secondaryColor : '#1E293B' }}
                />
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Superficies de apoyo, contenedores de navegación, etiquetas y jerarquía secundaria.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Selector Color Secundario"
                  value={HEX_REGEX.test(secondaryColor) ? secondaryColor : '#1E293B'}
                  onChange={(e) => handlePickerChange(setSecondaryColor, 'secondaryColor', e.target.value)}
                  className="w-11 h-10 rounded-lg bg-slate-950 border border-slate-700 cursor-pointer p-1"
                />
                <input
                  type="text"
                  maxLength={7}
                  value={secondaryColor}
                  onChange={(e) => handleHexInput(setSecondaryColor, 'secondaryColor', e.target.value)}
                  placeholder="#1E293B"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white uppercase focus:outline-none"
                />
              </div>
            </div>

            {/* 3. Color de Acento */}
            <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">3. Color de Acento</span>
                <span
                  className="w-4 h-4 rounded-full border border-slate-600"
                  style={{ backgroundColor: HEX_REGEX.test(accentColor) ? accentColor : '#10B981' }}
                />
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Botones de acción clave, pestañas activas, focos e indicadores de destaque.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Selector Color de Acento"
                  value={HEX_REGEX.test(accentColor) ? accentColor : '#10B981'}
                  onChange={(e) => handlePickerChange(setAccentColor, 'accentColor', e.target.value)}
                  className="w-11 h-10 rounded-lg bg-slate-950 border border-slate-700 cursor-pointer p-1"
                />
                <input
                  type="text"
                  maxLength={7}
                  value={accentColor}
                  onChange={(e) => handleHexInput(setAccentColor, 'accentColor', e.target.value)}
                  placeholder="#10B981"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white uppercase focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Paletas sugeridas rápidas */}
          <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl space-y-3">
            <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sparkles size={14} style={{ color: accentColor }} /> Paletas Predefinidas Rápidas
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PRESET_PALETTES.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-left transition-all cursor-pointer"
                >
                  <span className="text-xs font-semibold text-slate-200">{preset.name}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="w-4 h-4 rounded-full border border-slate-700"
                      style={{ backgroundColor: preset.primaryColor }}
                      title={`Primario: ${preset.primaryColor}`}
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-slate-700"
                      style={{ backgroundColor: preset.secondaryColor }}
                      title={`Secundario: ${preset.secondaryColor}`}
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-slate-700"
                      style={{ backgroundColor: preset.accentColor }}
                      title={`Acento: ${preset.accentColor}`}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || resetting}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: HEX_REGEX.test(accentColor) ? accentColor : '#10B981' }}
            >
              <Save size={15} />
              {saving ? 'Guardando paleta...' : 'Guardar y Aplicar en Toda la Plataforma'}
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
              Descartar vista previa
            </button>
          </div>
        </form>

        {/* Columna Derecha: Vista Previa en Vivo */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Eye size={14} style={{ color: accentColor }} /> Vista Previa de Componentes
              </span>
              <span className="text-[11px] font-mono text-slate-400">En vivo</span>
            </div>

            {/* Simulación de Barra Superior */}
            <div
              className="p-3.5 rounded-xl border border-slate-700/80 flex items-center justify-between gap-2"
              style={{ backgroundColor: secondaryColor }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold shadow"
                  style={{ backgroundColor: primaryColor }}
                >
                  <ShieldCheck size={17} />
                </div>
                <div>
                  <p className="text-xs font-black text-white leading-none">
                    {brand.name || 'TrustLink'}
                  </p>
                  <p className="text-[10px] text-slate-300 mt-0.5">Red de Confianza Residencial</p>
                </div>
              </div>

              <span
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white shadow"
                style={{ backgroundColor: accentColor }}
              >
                Activo
              </span>
            </div>

            {/* Simulación de Tarjeta Operativa */}
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  Prestador Verificado
                </span>
                <span className="text-xs font-bold" style={{ color: accentColor }}>
                  ★ 4.95
                </span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-white">Servicio Técnico Integral</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Así lucen las tarjetas, etiquetas y acciones principales con tu combinación actual.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-white inline-flex items-center gap-1.5 shadow"
                  style={{ backgroundColor: accentColor }}
                >
                  <QrCode size={13} /> Generar Pase QR
                </button>
                <button
                  type="button"
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-white border border-slate-700"
                  style={{ backgroundColor: secondaryColor }}
                >
                  Ver Detalle
                </button>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span>
              Primario: <strong className="font-mono text-slate-200">{primaryColor}</strong>
            </span>
            <span>
              Secundario: <strong className="font-mono text-slate-200">{secondaryColor}</strong>
            </span>
            <span>
              Acento: <strong className="font-mono text-slate-200">{accentColor}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}