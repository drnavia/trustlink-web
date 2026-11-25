/**
 * @file ProviderCalendarManager.jsx
 * @description Calendario Vivo de Disponibilidad para el Paso 3 ("Agenda") del Portal Prestador (Fase 5.4).
 * Permite al prestador:
 * 1. Configurar su jornada semanal (qué días trabaja de Lunes a Domingo, hora de inicio/fin e intervalo de 30 o 60 min).
 * 2. Visualizar su agenda viva día por día en franjas de 30/60 minutos integrando automáticamente:
 *    - Franjas disponibles (clic para bloquear al instante 30m, 1h, 1h30, 2h, 3h, 4h o resto del día).
 *    - Trabajos externos conseguidos por fuera de TrustLink (`external_visit`).
 *    - Horarios no laborables manuales (`unavailable`).
 *    - Visitas confirmadas con residentes (`trustlink_visit`) y Pases QR emitidos (`trustlink_pass`).
 * 3. Liberar cualquier bloqueo manual en 1 clic o cargar un rango personalizado.
 * @location /trustlink-web/src/components/ProviderCalendarManager.jsx
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Plus,
  Trash2,
  RefreshCw,
  X,
  Check,
  Briefcase,
  Lock,
  ShieldCheck,
  QrCode,
} from 'lucide-react';
import { API_BASE } from '../config/api';

/** Opciones horarias cada 30 minutos (`06:00` a `23:30`) para configurar inicio/fin de jornada. */
const HALF_HOUR_TIME_OPTIONS = Array.from({ length: 36 }, (_, idx) => {
  const totalMinutes = 6 * 60 + idx * 30;
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const mm = String(totalMinutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
});

/** Duraciones rápidas (en minutos) para bloquear a partir de una franja seleccionada. */
const QUICK_DURATION_OPTIONS = [
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 h' },
  { minutes: 90, label: '1 h 30' },
  { minutes: 120, label: '2 h' },
  { minutes: 180, label: '3 h' },
  { minutes: 240, label: '4 h' },
  { minutes: -1, label: 'Resto del día' },
];

/**
 * Obtiene la fecha calendario local `YYYY-MM-DD` a partir de un objeto `Date`.
 * @param {Date} dateObj - Fecha local.
 * @returns {string} Cadena `YYYY-MM-DD`.
 */
const toLocalYmd = (dateObj) => {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Suma o resta días calendario a una cadena `YYYY-MM-DD`.
 * @param {string} ymd - Fecha base `YYYY-MM-DD`.
 * @param {number} delta - Cantidad de días a desplazar.
 * @returns {string} Nueva fecha `YYYY-MM-DD`.
 */
const shiftYmd = (ymd, delta) => {
  const [y, m, d] = String(ymd).split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return toLocalYmd(dt);
};

/**
 * Formatea `YYYY-MM-DD` en formato corto `DD/MM`.
 * @param {string} ymd - Fecha `YYYY-MM-DD`.
 * @returns {string} Cadena `DD/MM`.
 */
const formatShortDayMonth = (ymd) => {
  const parts = String(ymd || '').split('-');
  if (parts.length !== 3) return ymd || '';
  return `${parts[2]}/${parts[1]}`;
};

/**
 * Formatea una marca ISO/fecha a formato argentino legible `DD/MM HH:mm`.
 * @param {string} iso - Fecha ISO UTC.
 * @returns {string} Fecha y hora local formateadas.
 */
const formatBlockRange = (startIso, endIso) => {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '—';
  const dayStr = s.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  const startTime = s.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const endTime = e.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return `${dayStr} · ${startTime} → ${endTime}`;
};

/**
 * Devuelve etiqueta y estilo visual según el tipo de bloque de agenda.
 * @param {string} blockType - Tipo (`external_visit`, `unavailable`, `trustlink_visit`, `trustlink_pass`).
 * @returns {{ label: string, chipCls: string, tileCls: string }} Metadatos visuales.
 */
const getBlockVisualMeta = (blockType) => {
  const key = String(blockType || '').toLowerCase();
  if (key === 'external_visit') {
    return {
      label: 'Trabajo externo',
      chipCls: 'border-amber-500/50 bg-amber-950/50 text-amber-200',
      tileCls: 'border-amber-500/45 bg-amber-950/35 text-amber-100 hover:border-amber-400',
    };
  }
  if (key === 'trustlink_visit') {
    return {
      label: 'Visita TrustLink',
      chipCls: 'border-sky-500/50 bg-sky-950/50 text-sky-200',
      tileCls: 'border-sky-500/45 bg-sky-950/35 text-sky-100 hover:border-sky-400',
    };
  }
  if (key === 'trustlink_pass') {
    return {
      label: 'Pase QR',
      chipCls: 'border-purple-500/50 bg-purple-950/50 text-purple-200',
      tileCls: 'border-purple-500/45 bg-purple-950/35 text-purple-100 hover:border-purple-400',
    };
  }
  return {
    label: 'No laborable',
    chipCls: 'border-slate-500/50 bg-slate-800/70 text-slate-200',
    tileCls: 'border-slate-600/60 bg-slate-800/50 text-slate-200 hover:border-slate-400',
  };
};

/**
 * Componente interactivo de Agenda Viva y Jornada Semanal para el Portal Prestador.
 *
 * @param {Object} props
 * @param {Object} props.cardStyle - Estilo de contenedor principal (Zona 4).
 * @param {Object} props.innerStyle - Estilo de cajas internas (Zona 5).
 * @param {string} props.primaryColor - Color de acción principal.
 * @param {() => Object} props.getAuthHeaders - Generador de cabeceras Authorization Bearer.
 * @param {(count: number) => void} [props.onBlocksCountChange] - Sincroniza el contador de la pestaña Agenda.
 * @param {() => void} [props.onGoToVisits] - Navega directo al Paso 4 (Visitas) al inspeccionar una solicitud tentativa.
 * @returns {JSX.Element}
 */
export default function ProviderCalendarManager({
  cardStyle,
  innerStyle,
  primaryColor,
  getAuthHeaders,
  onBlocksCountChange,
  onGoToVisits,
}) {
  // Inicializadores perezosos de fecha y zona horaria (cumplen pureza de render para React Compiler)
  const [todayYmd] = useState(() => toLocalYmd(new Date()));
  const [tzOffsetMinutes] = useState(() => new Date().getTimezoneOffset());
  const [recentCutoffMs] = useState(() => Date.now() - 24 * 60 * 60 * 1000);

  // Ventana de 7 días y día actualmente enfocado en la grilla cada 30 min
  const [windowStartYmd, setWindowStartYmd] = useState(todayYmd);
  const [selectedDayYmd, setSelectedDayYmd] = useState(todayYmd);

  // Datos devueltos por GET /api/v1/passes/schedule/provider
  const [loading, setLoading] = useState(true);
  const [weeklyRules, setWeeklyRules] = useState([]);
  const [scheduleSummary, setScheduleSummary] = useState('');
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [calendarDays, setCalendarDays] = useState([]);
  const [blocks, setBlocks] = useState([]);

  // Feedback local claro sin contaminar otros pasos
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Editor desplegable de jornada semanal
  const [showRulesEditor, setShowRulesEditor] = useState(false);
  const [draftRules, setDraftRules] = useState([]);
  const [draftSlotMinutes, setDraftSlotMinutes] = useState(30);
  const [savingRules, setSavingRules] = useState(false);

  // Panel rápido al hacer clic sobre una franja disponible, ocupada o potencial visita pendiente
  const [selectedAvailableSlot, setSelectedAvailableSlot] = useState(null);
  const [quickBlockType, setQuickBlockType] = useState('external_visit');
  const [quickDurationMin, setQuickDurationMin] = useState(60);
  const [quickBlockTitle, setQuickBlockTitle] = useState('');
  const [savingQuickBlock, setSavingQuickBlock] = useState(false);
  const [selectedBusyBlock, setSelectedBusyBlock] = useState(null);
  const [selectedTentativeVisit, setSelectedTentativeVisit] = useState(null);
  const [deletingBlockId, setDeletingBlockId] = useState(null);

  // Formulario desplegable opcional para cargar un rango manual personalizado
  const [showCustomRangeForm, setShowCustomRangeForm] = useState(false);
  const [customType, setCustomType] = useState('external_visit');
  const [customTitle, setCustomTitle] = useState('');
  const [customDate, setCustomDate] = useState(todayYmd);
  const [customStartTime, setCustomStartTime] = useState('09:00');
  const [customEndTime, setCustomEndTime] = useState('11:00');
  const [savingCustomBlock, setSavingCustomBlock] = useState(false);

  /**
   * Consulta al backend la jornada semanal, los 7 días proyectados con franjas de 30/60 min
   * y los bloques actuales de agenda.
   */
  const fetchCalendar = useCallback(
    async (targetStart = windowStartYmd) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          start_date: targetStart,
          days: '7',
          tz_offset: String(tzOffsetMinutes),
        });
        const response = await fetch(`${API_BASE}/api/v1/passes/schedule/provider?${params.toString()}`, {
          method: 'GET',
          headers: getAuthHeaders(),
        });
        const data = await response.json();
        if (response.ok) {
          const rulesList = Array.isArray(data.rules) ? data.rules : [];
          const daysList = Array.isArray(data.calendar_days) ? data.calendar_days : [];
          const blocksList = Array.isArray(data.blocks) ? data.blocks : [];
          setWeeklyRules(rulesList);
          setDraftRules(rulesList.map((r) => ({ ...r })));
          setScheduleSummary(data.schedule_summary || '');
          const nextSlotMin = Number(data.slot_minutes) === 60 ? 60 : 30;
          setSlotMinutes(nextSlotMin);
          setDraftSlotMinutes(nextSlotMin);
          setCalendarDays(daysList);
          setBlocks(blocksList);
          if (typeof onBlocksCountChange === 'function') {
            onBlocksCountChange(blocksList.length);
          }
        } else {
          setFeedback({ type: 'error', text: data.error || 'No se pudo cargar la agenda.' });
        }
      } catch (error) {
        console.error('Error al cargar calendario vivo del prestador:', error);
        setFeedback({ type: 'error', text: 'Error de conexión al consultar la agenda.' });
      } finally {
        setLoading(false);
      }
    },
    [windowStartYmd, tzOffsetMinutes, getAuthHeaders, onBlocksCountChange]
  );

  // Recarga la ventana de 7 días al montar o al cambiar de semana
  useEffect(() => {
    fetchCalendar(windowStartYmd);
  }, [windowStartYmd, fetchCalendar]);

  // Día activo seleccionado dentro de la ventana actual (fallback al primer día de la ventana)
  const activeDay = useMemo(() => {
    return calendarDays.find((d) => d.date === selectedDayYmd) || calendarDays[0] || null;
  }, [calendarDays, selectedDayYmd]);

  /**
   * Desplaza la ventana semanal hacia adelante o atrás (+/- 7 días) manteniendo selección coherente.
   * @param {number} deltaDays - Desplazamiento en días (`-7`, `7`, o `0` para volver a hoy).
   */
  const handleShiftWindow = (deltaDays) => {
    const nextStart = deltaDays === 0 ? todayYmd : shiftYmd(windowStartYmd, deltaDays);
    setWindowStartYmd(nextStart);
    setSelectedDayYmd(nextStart);
    setSelectedAvailableSlot(null);
    setSelectedBusyBlock(null);
    setSelectedTentativeVisit(null);
  };

  /**
   * Actualiza un campo puntual de un día en el borrador de jornada semanal.
   * @param {number} dayOfWeek - Día `0..6`.
   * @param {string} field - Campo (`is_working`, `start_time`, `end_time`).
   * @param {boolean|string} value - Nuevo valor.
   */
  const handleDraftRuleChange = (dayOfWeek, field, value) => {
    setDraftRules((prev) =>
      prev.map((rule) =>
        Number(rule.day_of_week) === Number(dayOfWeek) ? { ...rule, [field]: value } : rule
      )
    );
  };

  /**
   * Copia el rango horario del primer día activo (habitualmente Lunes) a todos los días laborables.
   */
  const handleApplySameHoursToWorkingDays = () => {
    const template = draftRules.find((r) => r.is_working) || draftRules[0];
    if (!template) return;
    setDraftRules((prev) =>
      prev.map((r) =>
        r.is_working ? { ...r, start_time: template.start_time, end_time: template.end_time } : r
      )
    );
  };

  /**
   * Persiste la jornada semanal configurada mediante `PUT /api/v1/passes/schedule/rules`.
   * @param {React.FormEvent<HTMLFormElement>} e - Evento submit.
   */
  const handleSaveWeeklyRules = async (e) => {
    e.preventDefault();
    setSavingRules(true);
    setFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/schedule/rules`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          slot_minutes: draftSlotMinutes,
          rules: draftRules.map((r) => ({
            day_of_week: r.day_of_week,
            is_working: Boolean(r.is_working),
            start_time: r.start_time,
            end_time: r.end_time,
            slot_minutes: draftSlotMinutes,
          })),
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({
          type: 'success',
          text: data.message || 'Jornada semanal guardada correctamente.',
        });
        setShowRulesEditor(false);
        await fetchCalendar(windowStartYmd);
      } else {
        setFeedback({ type: 'error', text: data.error || 'No se pudo guardar la jornada semanal.' });
      }
    } catch (error) {
      console.error('Error al guardar jornada semanal:', error);
      setFeedback({ type: 'error', text: 'Error de conexión al guardar la jornada semanal.' });
    } finally {
      setSavingRules(false);
    }
  };

  /**
   * Confirma el bloqueo rápido de una franja libre seleccionada en la grilla cada 30 min.
   * @param {React.FormEvent<HTMLFormElement>} e - Evento submit.
   */
  const handleConfirmQuickBlock = async (e) => {
    e.preventDefault();
    if (!selectedAvailableSlot || !activeDay) return;

    const startMs = Date.parse(selectedAvailableSlot.start_iso);
    let endMs;
    if (quickDurationMin === -1) {
      // Resto del día hasta el cierre de la jornada laboral configurada
      const [y, m, d] = activeDay.date.split('-').map(Number);
      const [eh, em] = String(activeDay.end_time || '18:00').split(':').map(Number);
      endMs = new Date(y, m - 1, d, eh, em, 0, 0).getTime();
      if (endMs <= startMs) endMs = startMs + slotMinutes * 60 * 1000;
    } else {
      endMs = startMs + quickDurationMin * 60 * 1000;
    }

    setSavingQuickBlock(true);
    setFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/schedule/blocks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          block_type: quickBlockType,
          title:
            quickBlockTitle.trim() ||
            (quickBlockType === 'external_visit' ? 'Trabajo externo agendado' : 'Horario no laborable'),
          start_at: new Date(startMs).toISOString(),
          end_at: new Date(endMs).toISOString(),
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({ type: 'success', text: data.message || 'Franja bloqueada en tu agenda.' });
        setSelectedAvailableSlot(null);
        setQuickBlockTitle('');
        await fetchCalendar(windowStartYmd);
      } else {
        setFeedback({ type: 'error', text: data.error || 'No se pudo bloquear la franja.' });
      }
    } catch (error) {
      console.error('Error al bloquear franja rápida:', error);
      setFeedback({ type: 'error', text: 'Error de conexión al bloquear la franja.' });
    } finally {
      setSavingQuickBlock(false);
    }
  };

  /**
   * Crea un bloqueo manual desde el formulario desplegable de rango personalizado.
   * @param {React.FormEvent<HTMLFormElement>} e - Evento submit.
   */
  const handleCreateCustomRangeBlock = async (e) => {
    e.preventDefault();
    const [y, m, d] = String(customDate).split('-').map(Number);
    const [sh, sm] = String(customStartTime).split(':').map(Number);
    const [eh, em] = String(customEndTime).split(':').map(Number);
    const startDate = new Date(y, m - 1, d, sh, sm, 0, 0);
    const endDate = new Date(y, m - 1, d, eh, em, 0, 0);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
      setFeedback({ type: 'error', text: 'La hora de fin debe ser posterior a la hora de inicio.' });
      return;
    }

    setSavingCustomBlock(true);
    setFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/schedule/blocks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          block_type: customType,
          title:
            customTitle.trim() ||
            (customType === 'external_visit' ? 'Trabajo externo agendado' : 'Horario no laborable'),
          start_at: startDate.toISOString(),
          end_at: endDate.toISOString(),
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({ type: 'success', text: data.message || 'Franja bloqueada correctamente.' });
        setCustomTitle('');
        setShowCustomRangeForm(false);
        await fetchCalendar(windowStartYmd);
      } else {
        setFeedback({ type: 'error', text: data.error || 'No se pudo guardar el bloqueo.' });
      }
    } catch (error) {
      console.error('Error al guardar rango manual:', error);
      setFeedback({ type: 'error', text: 'Error de conexión al guardar el bloqueo.' });
    } finally {
      setSavingCustomBlock(false);
    }
  };

  /**
   * Elimina un bloqueo manual (`external_visit` o `unavailable`) liberando de inmediato las franjas.
   * @param {number|string} blockId - ID del bloque en `provider_schedule_blocks`.
   */
  const handleDeleteBlock = async (blockId) => {
    setDeletingBlockId(blockId);
    setFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/v1/passes/schedule/blocks/${blockId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback({ type: 'success', text: data.message || 'Franja liberada en tu agenda.' });
        setSelectedBusyBlock(null);
        await fetchCalendar(windowStartYmd);
      } else {
        setFeedback({ type: 'error', text: data.error || 'No se pudo liberar el bloque.' });
      }
    } catch (error) {
      console.error('Error al eliminar bloque de agenda:', error);
      setFeedback({ type: 'error', text: 'Error de conexión al liberar la franja.' });
    } finally {
      setDeletingBlockId(null);
    }
  };

  // Bloques activos/próximos ordenados cronológicamente para consulta rápida debajo del calendario
  const upcomingBlocks = useMemo(() => {
    return (blocks || []).filter((b) => {
      const endMs = Date.parse(b.end_at);
      return Number.isNaN(endMs) || endMs >= recentCutoffMs;
    });
  }, [blocks, recentCutoffMs]);

  return (
    <section
      className="rounded-2xl p-5 border border-slate-800/80 space-y-4 text-xs"
      style={cardStyle}
    >
      {/* Cabecera: resumen de jornada semanal + botones de configuración y bloqueo */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
            <Calendar size={18} className="text-emerald-400 shrink-0" />
            <span>Agenda Viva y Disponibilidad</span>
          </h2>
          <p className="text-xs opacity-80">
            {scheduleSummary ? (
              <>
                Jornada activa: <strong className="opacity-100">{scheduleSummary}</strong> · Turnos cada{' '}
                <strong>{slotMinutes} min</strong>. Los residentes ven tus horarios libres en tiempo real.
              </>
            ) : (
              'Configurá tus días y horarios de trabajo, bloqueá trabajos externos y sincronizá tus visitas TrustLink.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setDraftRules(weeklyRules.map((r) => ({ ...r })));
              setDraftSlotMinutes(slotMinutes);
              setShowRulesEditor((prev) => !prev);
              setShowCustomRangeForm(false);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-white/15 hover:opacity-90 cursor-pointer"
            style={innerStyle}
          >
            <SlidersHorizontal size={13} />
            <span>{showRulesEditor ? 'Cerrar jornada' : 'Configurar jornada'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCustomDate(selectedDayYmd || todayYmd);
              setShowCustomRangeForm((prev) => !prev);
              setShowRulesEditor(false);
            }}
            className="text-white font-bold px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-sm hover:opacity-95"
            style={{ backgroundColor: primaryColor }}
          >
            {showCustomRangeForm ? <X size={14} /> : <Plus size={14} />}
            <span>{showCustomRangeForm ? 'Cerrar' : 'Cargar trabajo externo'}</span>
          </button>

          <button
            type="button"
            onClick={() => fetchCalendar(windowStartYmd)}
            className="p-2 rounded-xl border border-white/15 hover:opacity-90 cursor-pointer"
            style={innerStyle}
            title="Actualizar agenda"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Feedback de guardado / bloqueo / liberación */}
      {feedback.text && (
        <div
          className={`rounded-xl p-3 border text-xs flex items-center justify-between gap-2 ${
            feedback.type === 'success'
              ? 'border-emerald-700/70 bg-emerald-950/50 text-emerald-200'
              : 'border-rose-800/70 bg-rose-950/50 text-rose-200'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback({ type: '', text: '' })}
            className="opacity-70 hover:opacity-100 cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Panel desplegable 1: Configuración de Jornada Semanal (días laborables, horarios e intervalo) */}
      {showRulesEditor && (
        <form
          onSubmit={handleSaveWeeklyRules}
          className="rounded-2xl p-4 border border-emerald-500/30 space-y-3.5"
          style={innerStyle}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-white/10">
            <div>
              <p className="font-bold text-sm">Configurar días y horarios de atención</p>
              <p className="text-[11px] opacity-75">
                Elegí qué días trabajás, tu franja horaria y el intervalo de bloqueo para tu calendario vivo.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-xl p-1 border border-white/15" style={cardStyle}>
                {[30, 60].map((min) => (
                  <button
                    key={min}
                    type="button"
                    onClick={() => setDraftSlotMinutes(min)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                      draftSlotMinutes === min ? 'text-white' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={draftSlotMinutes === min ? { backgroundColor: primaryColor } : undefined}
                  >
                    Cada {min} min
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleApplySameHoursToWorkingDays}
                className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold border border-white/15 hover:opacity-90 cursor-pointer"
                style={cardStyle}
              >
                Copiar horario a todos los días activos
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {draftRules.map((rule) => (
              <div
                key={rule.day_of_week}
                className={`rounded-xl px-3 py-2.5 border flex items-center justify-between gap-2 ${
                  rule.is_working ? 'border-emerald-500/30' : 'border-white/10 opacity-65'
                }`}
                style={cardStyle}
              >
                <label className="inline-flex items-center gap-2 font-bold cursor-pointer min-w-24">
                  <input
                    type="checkbox"
                    checked={Boolean(rule.is_working)}
                    onChange={(e) => handleDraftRuleChange(rule.day_of_week, 'is_working', e.target.checked)}
                    className="accent-emerald-500"
                  />
                  <span>{rule.day_label}</span>
                </label>

                {rule.is_working ? (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={rule.start_time}
                      onChange={(e) => handleDraftRuleChange(rule.day_of_week, 'start_time', e.target.value)}
                      className="px-2 py-1 rounded-lg border border-white/15 text-xs"
                      style={innerStyle}
                    >
                      {HALF_HOUR_TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <span className="opacity-60">a</span>
                    <select
                      value={rule.end_time}
                      onChange={(e) => handleDraftRuleChange(rule.day_of_week, 'end_time', e.target.value)}
                      className="px-2 py-1 rounded-lg border border-white/15 text-xs"
                      style={innerStyle}
                    >
                      {HALF_HOUR_TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="text-[11px] opacity-75">Día no laborable</span>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowRulesEditor(false)}
              className="px-3.5 py-2 rounded-xl font-bold border border-white/15 cursor-pointer"
              style={cardStyle}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingRules}
              className="text-white font-bold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              <Check size={14} /> {savingRules ? 'Guardando...' : 'Guardar jornada semanal'}
            </button>
          </div>
        </form>
      )}

      {/* Panel desplegable 2: Carga rápida de trabajo externo o bloqueo por fecha/rango */}
      {showCustomRangeForm && (
        <form
          onSubmit={handleCreateCustomRangeBlock}
          className="rounded-2xl p-4 border border-amber-500/35 space-y-3"
          style={innerStyle}
        >
          <p className="font-bold text-sm flex items-center gap-1.5">
            <Briefcase size={15} className="text-amber-300" />
            <span>Cargar trabajo externo o bloqueo horario</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <select
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              className="px-3 py-2 rounded-xl border border-white/15 text-xs"
              style={cardStyle}
            >
              <option value="external_visit">Trabajo externo (fuera de TrustLink)</option>
              <option value="unavailable">Horario no laborable</option>
            </select>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Detalle privado (ej: Obra Barrio Norte / Cliente particular)"
              className="sm:col-span-2 px-3 py-2 rounded-xl border border-white/15 text-xs"
              style={cardStyle}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] opacity-80 mb-1">Fecha</label>
              <input
                type="date"
                required
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                style={cardStyle}
              />
            </div>
            <div>
              <label className="block text-[11px] opacity-80 mb-1">Desde</label>
              <select
                value={customStartTime}
                onChange={(e) => setCustomStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                style={cardStyle}
              >
                {HALF_HOUR_TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] opacity-80 mb-1">Hasta</label>
              <select
                value={customEndTime}
                onChange={(e) => setCustomEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                style={cardStyle}
              >
                {HALF_HOUR_TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[11px] opacity-75">
            Privacidad garantizada: los residentes solo verán estas franjas como &ldquo;Ocupadas&rdquo;, nunca el detalle ni tus clientes externos.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCustomRangeForm(false)}
              className="px-3.5 py-2 rounded-xl font-bold border border-white/15 cursor-pointer"
              style={cardStyle}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingCustomBlock}
              className="text-white font-bold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              <Plus size={14} /> {savingCustomBlock ? 'Guardando...' : 'Bloquear franja'}
            </button>
          </div>
        </form>
      )}

      {/* Navegación semanal + Tira interactiva de 7 días */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleShiftWindow(-7)}
              className="p-1.5 rounded-xl border border-white/15 hover:opacity-90 cursor-pointer"
              style={innerStyle}
              title="Semana anterior"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => handleShiftWindow(0)}
              className="px-3 py-1.5 rounded-xl border border-white/15 font-bold hover:opacity-90 cursor-pointer"
              style={innerStyle}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => handleShiftWindow(7)}
              className="p-1.5 rounded-xl border border-white/15 hover:opacity-90 cursor-pointer"
              style={innerStyle}
              title="Próxima semana"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Leyenda de colores del calendario vivo */}
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Libre
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full border border-dashed border-amber-300 bg-amber-400/35" /> Potencial visita
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Trabajo externo
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> No laborable
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400" /> Visita acordada
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400" /> Pase QR
            </span>
          </div>
        </div>

        {/* Tira de 7 días */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {calendarDays.map((day) => {
            const isSelected = activeDay?.date === day.date;
            const isToday = day.date === todayYmd;
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => {
                  setSelectedDayYmd(day.date);
                  setSelectedAvailableSlot(null);
                  setSelectedBusyBlock(null);
                  setSelectedTentativeVisit(null);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer space-y-1 ${
                  isSelected
                    ? 'border-emerald-400 ring-1 ring-emerald-400/40'
                    : day.tentative_count > 0
                    ? 'border-amber-400/50 hover:border-amber-300'
                    : day.is_working
                    ? 'border-white/15 hover:border-white/30'
                    : 'border-white/10 opacity-60 hover:opacity-85'
                }`}
                style={isSelected ? { backgroundColor: 'rgba(16, 185, 129, 0.14)' } : innerStyle}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-xs">
                    {day.short_label} {formatShortDayMonth(day.date)}
                  </span>
                  {isToday && (
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/25 text-emerald-200">
                      Hoy
                    </span>
                  )}
                </div>
                {day.is_working ? (
                  <p className="text-[10px] opacity-85">
                    <span className="text-emerald-300 font-bold">{day.available_count} libre(s)</span>
                    {day.tentative_count > 0 && (
                      <span className="text-amber-200 font-bold"> · {day.tentative_count} pend.</span>
                    )}
                    {day.busy_count > 0 && (
                      <span className="text-sky-300 font-semibold"> · {day.busy_count} ocup.</span>
                    )}
                  </p>
                ) : (
                  <p className="text-[10px] opacity-70">No laborable</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel contextual inline: Detalle de Potencial Visita pendiente (sin bloquear aún para otros residentes) */}
      {selectedTentativeVisit && (
        <div
          className="rounded-xl p-3.5 border border-dashed border-amber-400/70 bg-amber-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-dashed border-amber-400/70 bg-amber-500/20 text-amber-100">
                Potencial visita (pendiente de confirmación)
              </span>
              <span className="font-bold text-sm">
                Visita #{selectedTentativeVisit.id} · {selectedTentativeVisit.owner_name}
              </span>
            </div>
            <p className="opacity-90">
              {formatBlockRange(selectedTentativeVisit.start_at, selectedTentativeVisit.end_at)} ·{' '}
              <strong>
                {selectedTentativeVisit.fraction_number || '—'} / Lote{' '}
                {selectedTentativeVisit.lot_number || '—'}
              </strong>
            </p>
            {selectedTentativeVisit.notes && (
              <p className="text-[11px] opacity-80 italic">
                &ldquo;{selectedTentativeVisit.notes}&rdquo;
              </p>
            )}
            <p className="text-[11px] text-amber-200/90">
              Aún no bloquea tu agenda para otros residentes: al confirmarla en 4. Visitas quedará bloqueada definitivamente.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {typeof onGoToVisits === 'function' && (
              <button
                type="button"
                onClick={() => {
                  setSelectedTentativeVisit(null);
                  onGoToVisits();
                }}
                className="px-3.5 py-1.5 rounded-xl font-bold text-white cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                Confirmar / Repactar en 4. Visitas
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedTentativeVisit(null)}
              className="px-3 py-1.5 rounded-xl font-bold border border-white/15 cursor-pointer"
              style={cardStyle}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Panel contextual inline: Bloqueo rápido al tocar una franja libre */}
      {selectedAvailableSlot && activeDay && (
        <form
          onSubmit={handleConfirmQuickBlock}
          className="rounded-xl p-3.5 border border-emerald-500/40 space-y-3"
          style={innerStyle}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="font-bold text-xs flex items-center gap-1.5">
              <Clock size={14} className="text-emerald-400" />
              <span>
                Bloquear {activeDay.day_label} {formatShortDayMonth(activeDay.date)} desde las{' '}
                {selectedAvailableSlot.time}
              </span>
            </p>
            <button
              type="button"
              onClick={() => setSelectedAvailableSlot(null)}
              className="opacity-70 hover:opacity-100 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setQuickBlockType('external_visit')}
              className={`px-3 py-1.5 rounded-xl font-bold border cursor-pointer inline-flex items-center gap-1.5 ${
                quickBlockType === 'external_visit'
                  ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                  : 'border-white/15 opacity-75'
              }`}
              style={quickBlockType === 'external_visit' ? undefined : cardStyle}
            >
              <Briefcase size={12} /> Trabajo externo
            </button>
            <button
              type="button"
              onClick={() => setQuickBlockType('unavailable')}
              className={`px-3 py-1.5 rounded-xl font-bold border cursor-pointer inline-flex items-center gap-1.5 ${
                quickBlockType === 'unavailable'
                  ? 'border-slate-400 bg-slate-700/60 text-white'
                  : 'border-white/15 opacity-75'
              }`}
              style={quickBlockType === 'unavailable' ? undefined : cardStyle}
            >
              <Lock size={12} /> Horario no laborable
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] opacity-80 mr-1">Duración:</span>
            {QUICK_DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.minutes}
                type="button"
                onClick={() => setQuickDurationMin(opt.minutes)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                  quickDurationMin === opt.minutes
                    ? 'text-white border-transparent'
                    : 'border-white/15 opacity-80 hover:opacity-100'
                }`}
                style={quickDurationMin === opt.minutes ? { backgroundColor: primaryColor } : cardStyle}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={quickBlockTitle}
              onChange={(e) => setQuickBlockTitle(e.target.value)}
              placeholder={
                quickBlockType === 'external_visit'
                  ? 'Detalle opcional (ej: Obra Pilar / Cliente externo)'
                  : 'Motivo opcional (ej: Almuerzo / Trámite personal)'
              }
              className="flex-1 px-3 py-2 rounded-xl border border-white/15 text-xs"
              style={cardStyle}
            />
            <button
              type="submit"
              disabled={savingQuickBlock}
              className="text-white font-bold px-4 py-2 rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              style={{ backgroundColor: primaryColor }}
            >
              <Check size={14} /> {savingQuickBlock ? 'Bloqueando...' : 'Confirmar bloqueo'}
            </button>
          </div>
        </form>
      )}

      {/* Panel contextual inline: Detalle de franja ocupada (liberar si es manual, solo lectura si es TrustLink) */}
      {selectedBusyBlock && (
        <div
          className="rounded-xl p-3.5 border border-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          style={innerStyle}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  getBlockVisualMeta(selectedBusyBlock.block_type).chipCls
                }`}
              >
                {getBlockVisualMeta(selectedBusyBlock.block_type).label}
              </span>
              <span className="font-bold text-sm">{selectedBusyBlock.title}</span>
            </div>
            <p className="opacity-80">
              {formatBlockRange(selectedBusyBlock.start_at, selectedBusyBlock.end_at)}
            </p>
            {!selectedBusyBlock.is_manual && (
              <p className="text-[11px] opacity-70">
                Reserva automática sincronizada con TrustLink (se libera si se cancela la visita o el pase QR).
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectedBusyBlock.is_manual && (
              <button
                type="button"
                disabled={deletingBlockId === selectedBusyBlock.id}
                onClick={() => handleDeleteBlock(selectedBusyBlock.id)}
                className="px-3 py-1.5 rounded-xl font-bold border border-rose-500/50 bg-rose-950/50 text-rose-200 hover:bg-rose-950/80 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 size={13} />
                {deletingBlockId === selectedBusyBlock.id ? 'Liberando...' : 'Liberar franja'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedBusyBlock(null)}
              className="px-3 py-1.5 rounded-xl font-bold border border-white/15 cursor-pointer"
              style={cardStyle}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Grilla interactiva de franjas cada 30/60 minutos para el día seleccionado */}
      {loading && calendarDays.length === 0 ? (
        <p className="py-8 text-center opacity-75">Cargando calendario vivo...</p>
      ) : !activeDay ? null : !activeDay.is_working ? (
        <div
          className="rounded-xl p-6 border border-white/10 text-center space-y-2.5"
          style={innerStyle}
        >
          <p className="font-bold text-sm">
            {activeDay.day_label} {formatShortDayMonth(activeDay.date)} está marcado como día no laborable
          </p>
          <p className="opacity-75">
            Los residentes verán que no atendés este día. Podés habilitarlo cuando quieras desde &ldquo;Configurar jornada&rdquo;.
          </p>
          <button
            type="button"
            onClick={() => {
              setDraftRules(weeklyRules.map((r) => ({ ...r })));
              setShowRulesEditor(true);
            }}
            className="px-3.5 py-2 rounded-xl font-bold border border-white/15 cursor-pointer hover:opacity-90"
            style={cardStyle}
          >
            Configurar jornada semanal
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-[11px] opacity-80">
            <span>
              <strong>
                {activeDay.day_label} {formatShortDayMonth(activeDay.date)}
              </strong>{' '}
              · Horario laboral: {activeDay.start_time} a {activeDay.end_time}
            </span>
            <span>Tocá cualquier franja libre para bloquearla o una ocupada para ver/liberar</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
            {activeDay.slots.map((slot) => {
              const isPast = slot.status === 'past';
              const isBusy = slot.status === 'busy';
              const isTentative = slot.status === 'tentative';
              const isSelectedAvail =
                selectedAvailableSlot && selectedAvailableSlot.start_iso === slot.start_iso;
              const isSelectedBusy =
                selectedBusyBlock && slot.block && selectedBusyBlock.id === slot.block.id;
              const isSelectedTentative =
                selectedTentativeVisit &&
                slot.tentative_visit &&
                selectedTentativeVisit.id === slot.tentative_visit.id;

              if (isBusy && slot.block) {
                const visual = getBlockVisualMeta(slot.block.block_type);
                return (
                  <button
                    key={slot.start_iso}
                    type="button"
                    onClick={() => {
                      setSelectedAvailableSlot(null);
                      setSelectedTentativeVisit(null);
                      setSelectedBusyBlock(slot.block);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer space-y-1 ${
                      visual.tileCls
                    } ${isSelectedBusy ? 'ring-2 ring-white/60' : ''}`}
                    title={`${visual.label}: ${slot.block.title}`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono font-bold text-xs">{slot.time}</span>
                      {slot.block.block_type === 'trustlink_pass' ? (
                        <QrCode size={11} className="shrink-0" />
                      ) : slot.block.block_type === 'trustlink_visit' ? (
                        <ShieldCheck size={11} className="shrink-0" />
                      ) : slot.block.block_type === 'external_visit' ? (
                        <Briefcase size={11} className="shrink-0" />
                      ) : (
                        <Lock size={11} className="shrink-0" />
                      )}
                    </div>
                    <p className="text-[10px] font-semibold truncate opacity-95">
                      {slot.block.title || visual.label}
                    </p>
                  </button>
                );
              }

              if (isTentative && slot.tentative_visit) {
                return (
                  <button
                    key={slot.start_iso}
                    type="button"
                    onClick={() => {
                      setSelectedAvailableSlot(null);
                      setSelectedBusyBlock(null);
                      setSelectedTentativeVisit(slot.tentative_visit);
                    }}
                    className={`p-2.5 rounded-xl border border-dashed border-amber-400/75 bg-amber-500/15 text-amber-100 hover:border-amber-300 text-left transition-all cursor-pointer space-y-1 ${
                      isSelectedTentative ? 'ring-2 ring-amber-300/70' : ''
                    }`}
                    title={`Potencial visita #${slot.tentative_visit.id} (${slot.tentative_visit.owner_name}) — Pendiente de confirmación`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono font-bold text-xs">{slot.time}</span>
                      <Clock size={11} className="text-amber-300 shrink-0" />
                    </div>
                    <p className="text-[10px] font-bold truncate text-amber-200">
                      Potencial · {slot.tentative_visit.owner_name}
                    </p>
                  </button>
                );
              }

              return (
                <button
                  key={slot.start_iso}
                  type="button"
                  disabled={isPast}
                  onClick={() => {
                    setSelectedBusyBlock(null);
                    setSelectedTentativeVisit(null);
                    setSelectedAvailableSlot(slot);
                    setQuickDurationMin(slotMinutes === 60 ? 60 : 60);
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all space-y-1 ${
                    isPast
                      ? 'border-white/10 opacity-35 cursor-not-allowed'
                      : isSelectedAvail
                      ? 'border-emerald-300 bg-emerald-500/25 text-emerald-100 ring-2 ring-emerald-400/50 cursor-pointer'
                      : 'border-emerald-500/25 bg-emerald-950/20 hover:border-emerald-400/70 hover:bg-emerald-950/40 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono font-bold text-xs">{slot.time}</span>
                    <span className="text-[9px] opacity-70">{slot.end_time}</span>
                  </div>
                  <p className="text-[10px] font-semibold text-emerald-300">
                    {isPast ? 'Finalizada' : 'Disponible'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Listado compacto de eventos y bloqueos registrados */}
      {upcomingBlocks.length > 0 && (
        <div className="pt-3 border-t border-white/10 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">
              Bloqueos y compromisos en agenda ({upcomingBlocks.length})
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {upcomingBlocks.slice(0, 8).map((blk) => {
              const isManual = !blk.source_ref;
              const visual = getBlockVisualMeta(blk.block_type);
              return (
                <div
                  key={blk.id}
                  className="p-3 rounded-xl border border-white/10 flex items-center justify-between gap-2"
                  style={innerStyle}
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold truncate">{blk.title || visual.label}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${visual.chipCls}`}>
                        {visual.label}
                      </span>
                    </div>
                    <p className="text-[11px] opacity-75">
                      {formatBlockRange(blk.start_at, blk.end_at)}
                    </p>
                  </div>
                  {isManual && (
                    <button
                      type="button"
                      disabled={deletingBlockId === blk.id}
                      onClick={() => handleDeleteBlock(blk.id)}
                      className="p-1.5 rounded-lg border border-rose-500/40 bg-rose-950/35 text-rose-300 hover:bg-rose-950/70 cursor-pointer shrink-0 disabled:opacity-50"
                      title="Liberar franja"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
