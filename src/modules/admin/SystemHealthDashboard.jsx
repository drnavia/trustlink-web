/**
 * @file SystemHealthDashboard.jsx
 * @description Dashboard técnico y operativo exclusivo para el rol 'superadmin'.
 * Monitorea servidor, PostgreSQL y API externa, administra comunidades (crear, editar, activar/desactivar),
 * gestiona pases QR recientes y permite probar el endpoint externo en vivo.
 * @location /trustlink-web/src/modules/admin/SystemHealthDashboard.jsx
 */

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Database,
  Server,
  KeyRound,
  RefreshCw,
  Send,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Terminal,
  Clock,
  QrCode,
  Copy,
  Ban,
  Check,
  Building2,
  Plus,
  Power,
  Pencil,
  Save,
  X
} from 'lucide-react';

export default function SystemHealthDashboard() {
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [healthData, setHealthData] = useState(null);
  const [diagnosticsData, setDiagnosticsData] = useState(null);
  const [httpLatencyMs, setHttpLatencyMs] = useState(null);

  // Estado de comunidades (countries)
  const [countries, setCountries] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [countryName, setCountryName] = useState('');
  const [countryLocation, setCountryLocation] = useState('');
  const [countryActive, setCountryActive] = useState(true);
  const [creatingCountry, setCreatingCountry] = useState(false);
  const [editingCountryId, setEditingCountryId] = useState(null);
  const [editCountryName, setEditCountryName] = useState('');
  const [editCountryLocation, setEditCountryLocation] = useState('');
  const [savingCountryId, setSavingCountryId] = useState(null);
  const [togglingCountryId, setTogglingCountryId] = useState(null);
  const [countryFeedback, setCountryFeedback] = useState(null);

  // Estado de pases QR recientes
  const [recentPasses, setRecentPasses] = useState([]);
  const [loadingPasses, setLoadingPasses] = useState(false);
  const [copiedPassId, setCopiedPassId] = useState(null);
  const [cancellingPassId, setCancellingPassId] = useState(null);
  const [passActionFeedback, setPassActionFeedback] = useState(null);

  // Estados del Sandbox de prueba para POST /api/v1/external/passes/verify
  const [testQrToken, setTestQrToken] = useState('');
  const [testApiKey, setTestApiKey] = useState('tl_gate_dev_key_123456');
  const [authMode, setAuthMode] = useState('api_key'); // 'api_key' | 'bearer'
  const [testingEndpoint, setTestingEndpoint] = useState(false);
  const [sandboxResponse, setSandboxResponse] = useState(null);

  const fetchCountries = async () => {
    setLoadingCountries(true);
    try {
      const token = localStorage.getItem('trustlink_token') || '';
      const res = await fetch('http://localhost:4000/api/v1/external/countries', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setCountries(data.countries || []);
      }
    } catch (error) {
      console.error('Error al cargar comunidades:', error);
    } finally {
      setLoadingCountries(false);
    }
  };

  const fetchRecentPasses = async () => {
    setLoadingPasses(true);
    try {
      const token = localStorage.getItem('trustlink_token') || '';
      const res = await fetch('http://localhost:4000/api/v1/external/passes', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setRecentPasses(data.passes || []);
      }
    } catch (error) {
      console.error('Error al cargar pases recientes:', error);
    } finally {
      setLoadingPasses(false);
    }
  };

  const fetchSystemHealth = async () => {
    setLoadingStatus(true);
    setStatusError('');
    const startedAt = performance.now();

    try {
      const token = localStorage.getItem('trustlink_token') || '';

      const [healthRes, diagRes] = await Promise.all([
        fetch('http://localhost:4000/health'),
        fetch('http://localhost:4000/api/v1/external/status', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      ]);

      const elapsed = Math.round(performance.now() - startedAt);
      setHttpLatencyMs(elapsed);

      const healthJson = await healthRes.json();
      setHealthData({
        ok: healthRes.ok,
        status: healthRes.status,
        body: healthJson
      });

      const diagJson = await diagRes.json();
      if (diagRes.ok) {
        setDiagnosticsData(diagJson);
      } else {
        setStatusError(diagJson.error || 'No se pudo obtener el diagnóstico técnico del backend.');
      }

      await Promise.all([fetchCountries(), fetchRecentPasses()]);
    } catch (error) {
      console.error('Error al consultar salud del sistema:', error);
      setStatusError('No se pudo conectar con el servidor backend en http://localhost:4000.');
      setHealthData(null);
      setDiagnosticsData(null);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchSystemHealth();
  }, []);

  const handleCreateCountry = async (e) => {
    e.preventDefault();
    if (!countryName.trim()) return;

    setCreatingCountry(true);
    setCountryFeedback(null);

    try {
      const token = localStorage.getItem('trustlink_token') || '';
      const res = await fetch('http://localhost:4000/api/v1/external/countries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: countryName.trim(),
          location: countryLocation.trim() || null,
          is_active: countryActive
        })
      });

      const data = await res.json();

      if (res.ok) {
        setCountryFeedback({
          type: 'success',
          message: data.message || 'Comunidad creada exitosamente.'
        });
        setCountryName('');
        setCountryLocation('');
        setCountryActive(true);
        await fetchCountries();
      } else {
        setCountryFeedback({
          type: 'error',
          message: data.error || 'No se pudo crear la comunidad.'
        });
      }
    } catch (error) {
      console.error('Error al crear comunidad:', error);
      setCountryFeedback({
        type: 'error',
        message: 'Error de conexión al crear la comunidad.'
      });
    } finally {
      setCreatingCountry(false);
    }
  };

  const startEditingCountry = (country) => {
    setEditingCountryId(country.id);
    setEditCountryName(country.name || '');
    setEditCountryLocation(country.location || '');
    setCountryFeedback(null);
  };

  const cancelEditingCountry = () => {
    setEditingCountryId(null);
    setEditCountryName('');
    setEditCountryLocation('');
  };

  const handleSaveCountryEdit = async (countryId) => {
    if (!editCountryName.trim()) {
      setCountryFeedback({
        type: 'error',
        message: 'El nombre de la comunidad es obligatorio.'
      });
      return;
    }

    setSavingCountryId(countryId);
    setCountryFeedback(null);

    try {
      const token = localStorage.getItem('trustlink_token') || '';
      const res = await fetch(`http://localhost:4000/api/v1/external/countries/${countryId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editCountryName.trim(),
          location: editCountryLocation.trim() || null
        })
      });

      const data = await res.json();

      if (res.ok) {
        setCountryFeedback({
          type: 'success',
          message: data.message || `Comunidad #${countryId} actualizada con éxito.`
        });
        setEditingCountryId(null);
        await fetchCountries();
      } else {
        setCountryFeedback({
          type: 'error',
          message: data.error || 'No se pudo actualizar la comunidad.'
        });
      }
    } catch (error) {
      console.error('Error al guardar edición de comunidad:', error);
      setCountryFeedback({
        type: 'error',
        message: 'Error de conexión al actualizar la comunidad.'
      });
    } finally {
      setSavingCountryId(null);
    }
  };

  const handleToggleCountry = async (countryId) => {
    setTogglingCountryId(countryId);
    setCountryFeedback(null);

    try {
      const token = localStorage.getItem('trustlink_token') || '';
      const res = await fetch(`http://localhost:4000/api/v1/external/countries/${countryId}/toggle`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (res.ok) {
        setCountryFeedback({
          type: 'success',
          message: data.message || 'Estado de comunidad actualizado.'
        });
        await fetchCountries();
      } else {
        setCountryFeedback({
          type: 'error',
          message: data.error || 'No se pudo actualizar el estado de la comunidad.'
        });
      }
    } catch (error) {
      console.error('Error al cambiar estado de comunidad:', error);
      setCountryFeedback({
        type: 'error',
        message: 'Error de conexión al actualizar la comunidad.'
      });
    } finally {
      setTogglingCountryId(null);
    }
  };

  const handleCopyToken = async (passId, tokenStr) => {
    try {
      await navigator.clipboard.writeText(tokenStr);
      setCopiedPassId(passId);
      setTimeout(() => setCopiedPassId(null), 2000);
    } catch (err) {
      console.error('No se pudo copiar el token:', err);
    }
  };

  const handleCancelPass = async (passId) => {
    setCancellingPassId(passId);
    setPassActionFeedback(null);

    try {
      const token = localStorage.getItem('trustlink_token') || '';
      const res = await fetch(`http://localhost:4000/api/v1/external/passes/${passId}/cancel`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();

      if (res.ok) {
        setPassActionFeedback({
          type: 'success',
          message: data.message || `Pase #${passId} cancelado con éxito.`
        });
        await fetchRecentPasses();
      } else {
        setPassActionFeedback({
          type: 'error',
          message: data.error || `No se pudo cancelar el pase #${passId}.`
        });
      }
    } catch (error) {
      console.error('Error al cancelar pase:', error);
      setPassActionFeedback({
        type: 'error',
        message: 'Error de conexión al cancelar el pase.'
      });
    } finally {
      setCancellingPassId(null);
    }
  };

  const handleRunExternalTest = async (e) => {
    e.preventDefault();
    if (!testQrToken.trim()) return;

    setTestingEndpoint(true);
    setSandboxResponse(null);
    const startedAt = performance.now();

    try {
      const headers = {
        'Content-Type': 'application/json'
      };

      if (authMode === 'api_key') {
        if (testApiKey.trim()) {
          headers['x-api-key'] = testApiKey.trim();
        }
      } else {
        const token = localStorage.getItem('trustlink_token') || '';
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('http://localhost:4000/api/v1/external/passes/verify', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          qr_token: testQrToken.trim()
        })
      });

      const elapsed = Math.round(performance.now() - startedAt);
      const body = await response.json();

      setSandboxResponse({
        ok: response.ok,
        httpStatus: response.status,
        latencyMs: elapsed,
        body
      });
    } catch (error) {
      console.error('Error al probar endpoint externo:', error);
      setSandboxResponse({
        ok: false,
        httpStatus: 0,
        latencyMs: Math.round(performance.now() - startedAt),
        body: {
          authorized: false,
          code: 'NETWORK_ERROR',
          error: 'Error de red al invocar POST /api/v1/external/passes/verify.'
        }
      });
    } finally {
      setTestingEndpoint(false);
    }
  };

  const formatUptime = (seconds) => {
    if (typeof seconds !== 'number') return '-';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  };

  const renderStatusBadge = (status) => {
    if (status === 'cancelled') {
      return (
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800">
          CANCELADO
        </span>
      );
    }
    if (status === 'expired') {
      return (
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">
          EXPIRADO
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
        {status || 'PENDING'}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8 text-slate-100 font-sans space-y-6">
      {/* Cabecera */}
      <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/20">
            <Activity size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-white">
              Salud del Sistema & Sandbox de Integraciones
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Monitoreo del servidor Express, PostgreSQL, comunidades, pases QR y prueba del endpoint externo.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchSystemHealth}
          disabled={loadingStatus}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={14} className={loadingStatus ? 'animate-spin' : ''} />
          {loadingStatus ? 'Verificando...' : 'Refrescar Estado'}
        </button>
      </div>

      {statusError && (
        <div className="bg-rose-950/50 border border-rose-800 text-rose-200 p-4 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-400 shrink-0" />
          <span>{statusError}</span>
        </div>
      )}

      {/* Tarjetas de Salud Técnica */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5">
              <Server size={15} className="text-emerald-400" /> Servidor Backend
            </span>
            {healthData?.ok ? (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                ONLINE ({healthData.status})
              </span>
            ) : (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800">
                OFFLINE
              </span>
            )}
          </div>

          <div className="text-xs space-y-1 text-slate-300">
            <p>
              Servicio: <strong className="text-white">{diagnosticsData?.service || healthData?.body?.service || 'trustlink-backend'}</strong>
            </p>
            <p className="flex items-center gap-1.5 text-slate-400">
              <Clock size={12} /> Uptime: <strong className="text-slate-200">{formatUptime(diagnosticsData?.uptime_seconds)}</strong>
            </p>
            <p className="text-slate-400">
              Latencia HTTP: <strong className="text-emerald-400">{httpLatencyMs !== null ? `${httpLatencyMs} ms` : '-'}</strong>
            </p>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5">
              <Database size={15} className="text-sky-400" /> PostgreSQL
            </span>
            {diagnosticsData?.database?.connected ? (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                CONECTADO
              </span>
            ) : (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800">
                SIN CONEXIÓN
              </span>
            )}
          </div>

          <div className="text-xs space-y-1 text-slate-300">
            <p>
              Latencia consulta: <strong className="text-sky-400">{diagnosticsData?.database?.latency_ms ?? '-'} ms</strong>
            </p>
            <p className="text-slate-400">
              Pases QR registrados: <strong className="text-white">{diagnosticsData?.metrics?.total_passes ?? '-'}</strong>
            </p>
            <p className="text-slate-400">
              Prestadores aprobados: <strong className="text-white">{diagnosticsData?.metrics?.approved_providers ?? '-'}</strong>
            </p>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5">
              <KeyRound size={15} className="text-amber-400" /> API Externa Garita
            </span>
            {diagnosticsData?.external_endpoint?.api_key_configured ? (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                API KEY ACTIVA
              </span>
            ) : (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">
                FALLBACK LOCAL
              </span>
            )}
          </div>

          <div className="text-xs space-y-1 text-slate-300">
            <p className="font-mono text-[11px] text-emerald-400">
              POST {diagnosticsData?.external_endpoint?.route || '/api/v1/external/passes/verify'}
            </p>
            <p className="text-slate-400">
              Comunidades activas: <strong className="text-white">{countries.filter((c) => c.is_active).length}</strong>
            </p>
            <p className="text-[11px] text-slate-400">
              Autenticación: <span className="text-slate-200">x-api-key / Bearer JWT</span>
            </p>
          </div>
        </div>
      </div>

      {/* 2. Gestión de Comunidades / Barrios Privados */}
      <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-5">
        <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Building2 size={18} className="text-sky-400" /> Gestión de Comunidades / Barrios Privados
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Registrá, editá o activá/desactivá comunidades desde el panel sin tocar código ni base de datos.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchCountries}
            disabled={loadingCountries}
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={13} className={loadingCountries ? 'animate-spin' : ''} /> Actualizar Comunidades
          </button>
        </div>

        {countryFeedback && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
              countryFeedback.type === 'success'
                ? 'bg-emerald-950/50 border-emerald-700 text-emerald-200'
                : 'bg-rose-950/50 border-rose-800 text-rose-200'
            }`}
          >
            {countryFeedback.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            <span>{countryFeedback.message}</span>
          </div>
        )}

        <form onSubmit={handleCreateCountry} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <div className="md:col-span-4">
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
              Nombre de la Comunidad *
            </label>
            <input
              type="text"
              required
              maxLength={150}
              value={countryName}
              onChange={(e) => setCountryName(e.target.value)}
              placeholder="Ej: Barrio Privado San Lucas"
              className="w-full bg-slate-950 border border-slate-700 px-3 py-2 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="md:col-span-5">
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
              Ubicación / Zona
            </label>
            <input
              type="text"
              maxLength={255}
              value={countryLocation}
              onChange={(e) => setCountryLocation(e.target.value)}
              placeholder="Ej: Cañuelas / Ezeiza - Buenos Aires"
              className="w-full bg-slate-950 border border-slate-700 px-3 py-2 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="md:col-span-1 flex items-center gap-2 pb-2">
            <input
              id="countryActiveCheckbox"
              type="checkbox"
              checked={countryActive}
              onChange={(e) => setCountryActive(e.target.checked)}
              className="w-4 h-4 accent-emerald-500 cursor-pointer"
            />
            <label htmlFor="countryActiveCheckbox" className="text-xs text-slate-300 cursor-pointer">
              Activa
            </label>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={creatingCountry}
              className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <Plus size={14} /> {creatingCountry ? 'Creando...' : 'Agregar'}
            </button>
          </div>
        </form>

        {loadingCountries ? (
          <div className="text-center py-6 text-xs text-slate-400">Cargando comunidades desde PostgreSQL...</div>
        ) : countries.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500">No hay comunidades registradas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 px-3">ID</th>
                  <th className="py-2.5 px-3">Comunidad</th>
                  <th className="py-2.5 px-3">Ubicación</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {countries.map((c) => {
                  const isEditing = editingCountryId === c.id;

                  return (
                    <tr key={c.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-300">#{c.id}</td>
                      <td className="py-3 px-3 font-bold text-white">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editCountryName}
                            onChange={(e) => setEditCountryName(e.target.value)}
                            className="w-full bg-slate-900 border border-sky-600 px-2.5 py-1.5 rounded-lg text-xs text-white focus:outline-none"
                          />
                        ) : (
                          c.name
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editCountryLocation}
                            onChange={(e) => setEditCountryLocation(e.target.value)}
                            placeholder="Ubicación / Zona"
                            className="w-full bg-slate-900 border border-sky-600 px-2.5 py-1.5 rounded-lg text-xs text-white focus:outline-none"
                          />
                        ) : (
                          c.location || '-'
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {c.is_active ? (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                            ACTIVA
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800">
                            INACTIVA
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-2 justify-end flex-wrap">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                disabled={savingCountryId === c.id}
                                onClick={() => handleSaveCountryEdit(c.id)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
                              >
                                <Save size={12} /> {savingCountryId === c.id ? 'Guardando...' : 'Guardar'}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditingCountry}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <X size={12} /> Cancelar
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEditingCountry(c)}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Pencil size={12} /> Editar
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={togglingCountryId === c.id || isEditing}
                            onClick={() => handleToggleCountry(c.id)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 border cursor-pointer disabled:opacity-40 ${
                              c.is_active
                                ? 'bg-amber-950/60 hover:bg-amber-900 text-amber-300 border-amber-800'
                                : 'bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border-emerald-800'
                            }`}
                          >
                            <Power size={12} />
                            {togglingCountryId === c.id
                              ? 'Actualizando...'
                              : c.is_active
                              ? 'Desactivar'
                              : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 1. Pases QR Recientes (Copiar Token / Cancelar Pase) */}
      <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <QrCode size={18} className="text-emerald-400" /> Pases QR Recientes
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Copiá el token QR de cualquier pase para probarlo o cancelá pases activos/pendientes sin tocar la base de datos.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchRecentPasses}
            disabled={loadingPasses}
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={13} className={loadingPasses ? 'animate-spin' : ''} /> Actualizar Pases
          </button>
        </div>

        {passActionFeedback && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
              passActionFeedback.type === 'success'
                ? 'bg-emerald-950/50 border-emerald-700 text-emerald-200'
                : 'bg-rose-950/50 border-rose-800 text-rose-200'
            }`}
          >
            {passActionFeedback.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            <span>{passActionFeedback.message}</span>
          </div>
        )}

        {loadingPasses ? (
          <div className="text-center py-8 text-xs text-slate-400">Cargando pases QR desde PostgreSQL...</div>
        ) : recentPasses.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">No hay pases QR registrados aún.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 px-3">ID</th>
                  <th className="py-2.5 px-3">Prestador</th>
                  <th className="py-2.5 px-3">Destino</th>
                  <th className="py-2.5 px-3">Token QR</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {recentPasses.map((passItem) => {
                  const isCancelled = passItem.status === 'cancelled';
                  const isExpired = passItem.status === 'expired';

                  return (
                    <tr key={passItem.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-300">#{passItem.id}</td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-white">
                          {passItem.provider_first_name || 'Prestador'} {passItem.provider_last_name || ''}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {passItem.provider_specialty || 'Sin especialidad'} · {passItem.country_name || 'Comunidad'}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {passItem.fraction_number || '-'} / {passItem.lot_number || '-'}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-emerald-400">
                        {passItem.qr_token ? `${passItem.qr_token.slice(0, 14)}...` : '-'}
                      </td>
                      <td className="py-3 px-3">{renderStatusBadge(passItem.status)}</td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-2 justify-end flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleCopyToken(passItem.id, passItem.qr_token)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            title="Copiar Token QR completo"
                          >
                            {copiedPassId === passItem.id ? (
                              <>
                                <Check size={12} className="text-emerald-400" /> Copiado
                              </>
                            ) : (
                              <>
                                <Copy size={12} /> Copiar Token
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setTestQrToken(passItem.qr_token)}
                            className="bg-sky-950/60 hover:bg-sky-900 text-sky-300 border border-sky-800 px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            title="Cargar en el probador de abajo"
                          >
                            Cargar en Sandbox
                          </button>

                          <button
                            type="button"
                            disabled={isCancelled || isExpired || cancellingPassId === passItem.id}
                            onClick={() => handleCancelPass(passItem.id)}
                            className="bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Cancelar pase QR"
                          >
                            <Ban size={12} /> {cancellingPassId === passItem.id ? 'Cancelando...' : 'Cancelar Pase'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sandbox Interactivo de Prueba de Integración Externa */}
      <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-5">
        <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Terminal size={18} className="text-emerald-400" /> Probador en Vivo del Endpoint Externo
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Simula exactamente la petición HTTP que envía la aplicación de un barrio privado al leer un Token QR de TrustLink.
            </p>
          </div>
          <span className="text-[11px] font-mono bg-slate-900 border border-slate-700 px-3 py-1 rounded-lg text-slate-300">
            POST /api/v1/external/passes/verify
          </span>
        </div>

        <form onSubmit={handleRunExternalTest} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                Token QR a Verificar (qr_token)
              </label>
              <input
                type="text"
                required
                value={testQrToken}
                onChange={(e) => setTestQrToken(e.target.value)}
                placeholder="Pegue aquí el qr_token o haga clic en 'Cargar en Sandbox' arriba..."
                className="w-full bg-slate-900 border border-slate-700 px-3.5 py-2.5 rounded-xl text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                Modo de Autenticación
              </label>
              <select
                value={authMode}
                onChange={(e) => setAuthMode(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="api_key">Header x-api-key (App Externa)</option>
                <option value="bearer">Bearer Token (Sesión Superadmin)</option>
              </select>
            </div>
          </div>

          {authMode === 'api_key' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                Valor de x-api-key
              </label>
              <input
                type="text"
                value={testApiKey}
                onChange={(e) => setTestApiKey(e.target.value)}
                placeholder="Ej: tl_gate_dev_key_123456"
                className="w-full bg-slate-900 border border-slate-700 px-3.5 py-2.5 rounded-xl text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={testingEndpoint}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              <Send size={14} /> {testingEndpoint ? 'Ejecutando Petición...' : 'Probar Validación Externa'}
            </button>
          </div>
        </form>

        {sandboxResponse && (
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold">
                {sandboxResponse.ok ? (
                  <>
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <span className="text-emerald-300">
                      HTTP {sandboxResponse.httpStatus} — Respuesta Autorizada
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle size={16} className="text-rose-400" />
                    <span className="text-rose-300">
                      HTTP {sandboxResponse.httpStatus} — Rechazado / Error
                    </span>
                  </>
                )}
              </div>

              <span className="text-[11px] text-slate-400 font-mono">
                Tiempo de respuesta: {sandboxResponse.latencyMs} ms
              </span>
            </div>

            <pre className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs text-emerald-300 font-mono overflow-x-auto leading-relaxed">
              {JSON.stringify(sandboxResponse.body, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}