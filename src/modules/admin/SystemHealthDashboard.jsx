/**
 * @file SystemHealthDashboard.jsx
 * @description Dashboard técnico exclusivo para el rol 'superadmin'. Permite monitorear la salud
 * del servidor backend, la latencia de PostgreSQL, el estado de configuración del endpoint externo
 * y ejecutar pruebas en vivo sobre POST /api/v1/external/passes/verify sin usar terminal/CURL.
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
  ShieldCheck,
  Clock
} from 'lucide-react';

export default function SystemHealthDashboard() {
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [healthData, setHealthData] = useState(null);
  const [diagnosticsData, setDiagnosticsData] = useState(null);
  const [httpLatencyMs, setHttpLatencyMs] = useState(null);

  // Estados del Sandbox de prueba para POST /api/v1/external/passes/verify
  const [testQrToken, setTestQrToken] = useState('');
  const [testApiKey, setTestApiKey] = useState('');
  const [authMode, setAuthMode] = useState('api_key'); // 'api_key' | 'bearer'
  const [testingEndpoint, setTestingEndpoint] = useState(false);
  const [sandboxResponse, setSandboxResponse] = useState(null);

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
              Monitoreo en tiempo real del servidor Express, PostgreSQL y el endpoint externo para barrios privados.
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
        {/* 1. Servidor Backend */}
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

        {/* 2. Base de Datos PostgreSQL */}
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

        {/* 3. Endpoint Externo Barrios Privados */}
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
              Comunidades activas: <strong className="text-white">{diagnosticsData?.metrics?.total_countries ?? '-'}</strong>
            </p>
            <p className="text-[11px] text-slate-400">
              Autenticación: <span className="text-slate-200">x-api-key / Bearer JWT</span>
            </p>
          </div>
        </div>
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
                placeholder="Pegue aquí el qr_token generado desde el Portal Residente..."
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