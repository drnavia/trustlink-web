/**
 * @file SecurityScanner.jsx
 * @description Interfaz ultrarrápida para el personal de seguridad en garita. 
 * Permite ingresar o escanear el token QR para validar el acceso en tiempo real contra el backend,
 * mostrando el estado de compliance del prestador, sus datos y los del vehículo.
 * @location /trustlink-web/src/modules/security/SecurityScanner.jsx
 */

import React, { useState } from 'react';
import { ShieldCheck, QrCode, Search, CheckCircle2, XCircle, Car, User } from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';

export default function SecurityScanner() {
  const { brand } = useBranding();
  const [qrToken, setQrToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Función para ejecutar la petición real de validación al backend (/api/v1/passes/verify)
  const handleVerifyPass = async (e) => {
    e.preventDefault();
    if (!qrToken.trim()) return;

    setLoading(true);
    setScanResult(null);
    setErrorMsg('');

    try {
      const response = await fetch('http://localhost:4000/api/v1/passes/verify', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${localStorage.getItem('security_token') || ''}` 
        },
        body: JSON.stringify({ qr_token: qrToken.trim() })
      });
      const data = await response.json();

      if (response.ok && data.authorized) {
        setScanResult({
          authorized: true,
          details: data.details
        });
      } else {
        setScanResult({
          authorized: false,
          error: data.error || 'Pase inexistente, expirado o no autorizado.'
        });
      }
      setLoading(false);

    } catch (error) {
      console.error('Error al verificar pase:', error);
      setErrorMsg('Error de conexión con el servidor de seguridad de TrustLink (Backend inactivo o puerto incorrecto).');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-45px)] bg-slate-900 text-slate-100 font-sans flex flex-col justify-between">
      {/* Barra Superior Institucional */}
      <header className="bg-slate-950 border-b border-slate-800 px-8 py-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center space-x-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md"
            style={{ backgroundColor: brand.primaryColor }}
          >
            {brand.countryName.charAt(0)}
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-wide">{brand.countryName}</h1>
            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Control Perimetral - Garita Activa
            </span>
          </div>
        </div>
        <div className="text-xs font-semibold bg-slate-800 text-slate-300 px-4 py-2 rounded-xl border border-slate-700">
          Guardia: Operador Turno Activo
        </div>
      </header>

      {/* Contenido Principal / Consola de Escaneo */}
      <main className="max-w-4xl mx-auto px-6 py-12 w-full flex-grow flex flex-col justify-center">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-black tracking-tight text-white mb-2">Validación Ultrarrápida de Accesos</h2>
          <p className="text-slate-400 text-sm">Escanee el código QR o ingrese el token digital presentado por el prestador.</p>
        </div>

        {/* Input de Búsqueda / Pistola Escáner */}
        <form onSubmit={handleVerifyPass} className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700 shadow-xl mb-8 flex gap-3">
          <div className="relative flex-grow">
            <QrCode className="absolute left-4 top-3.5 text-slate-400" size={22} />
            <input
              type="text"
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value)}
              placeholder="Ingrese o pistolee el Token QR (ej. 6c014b85...)"
              className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base transition-all font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Search size={20} /> {loading ? 'Verificando...' : 'Validar Pase'}
          </button>
        </form>

        {/* Mensaje de Error de Red */}
        {errorMsg && (
          <div className="bg-rose-950/50 border border-rose-800 text-rose-200 p-4 rounded-xl text-center font-medium mb-6">
            {errorMsg}
          </div>
        )}

        {/* Panel de Resultado de Validación */}
        {scanResult && (
          <div className={`rounded-2xl p-8 border shadow-2xl transition-all ${
            scanResult.authorized 
              ? 'bg-emerald-950/30 border-emerald-600/50' 
              : 'bg-rose-950/30 border-rose-600/50'
          }`}>
            <div className="flex items-center justify-between pb-6 border-b border-slate-800 mb-6">
              <div className="flex items-center gap-3">
                {scanResult.authorized ? (
                  <CheckCircle2 size={40} className="text-emerald-400" />
                ) : (
                  <XCircle size={40} className="text-rose-400" />
                )}
                <div>
                  <h3 className="text-2xl font-black tracking-wide">
                    {scanResult.authorized ? 'ACCESO AUTORIZADO' : 'ACCESO DENEGADO'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {scanResult.authorized ? 'Verificación perimetral exitosa y compliance al día.' : scanResult.error}
                  </p>
                </div>
              </div>
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider ${
                scanResult.authorized ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {scanResult.authorized ? 'Pase Válido' : 'Bloqueado'}
              </span>
            </div>

            {scanResult.authorized && scanResult.details && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                {/* Datos del Prestador */}
                <div className="bg-slate-900/80 p-5 rounded-xl border border-slate-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-3">
                    <User size={16} className="text-emerald-400" /> Datos del Prestador
                  </span>
                  <p className="text-lg font-bold text-white mb-1">
                    {scanResult.details.provider}
                  </p>
                  <p className="text-slate-400 text-xs mb-3">DNI: {scanResult.details.dni}</p>
                  <span className="inline-block text-xs font-semibold bg-emerald-950 text-emerald-300 px-2.5 py-1 rounded border border-emerald-800">
                    ✓ Compliance Aprobado
                  </span>
                </div>

                {/* Datos del Vehículo y Destino */}
                <div className="bg-slate-900/80 p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-3">
                      <Car size={16} className="text-blue-400" /> Vehículo y Destino
                    </span>
                    <p className="text-base font-bold text-white mb-1">
                      {scanResult.details.vehicle}
                    </p>
                  </div>
                  <div className="border-t border-slate-800 pt-3 text-xs text-slate-400 flex justify-between">
                    <span>Destino: <strong>{scanResult.details.destination}</strong></span>
                    <span>Autorizado por: <strong>{scanResult.details.authorized_by}</strong></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Pie de página */}
      <footer className="bg-slate-950 border-t border-slate-800 py-4 text-center text-xs text-slate-500">
        TrustLink Security Node — Sistema Criptográfico de Validación Perimetral © 2026
      </footer>
    </div>
  );
}