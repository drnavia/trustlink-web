/**
 * @file SecurityScanner.jsx
 * @description Interfaz ultrarrápida para validación de pases QR en garita conectada al backend de TrustLink.
 * @location /trustlink-web/src/modules/security/SecurityScanner.jsx
 */

import React, { useState } from 'react';
import { QrCode, Search, CheckCircle2, XCircle, Car, User, ShieldCheck, AlertCircle } from 'lucide-react';

export default function SecurityScanner() {
  const [qrToken, setQrToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleVerifyPass = async (e) => {
    e.preventDefault();
    if (!qrToken.trim()) return;

    setLoading(true);
    setScanResult(null);
    setErrorMsg('');

    try {
      const token = localStorage.getItem('trustlink_token') || localStorage.getItem('security_token') || '';
      const response = await fetch('http://localhost:4000/api/v1/passes/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
    } catch (error) {
      console.error('Error al verificar pase:', error);
      setErrorMsg('Error de conexión con el servidor de seguridad de TrustLink.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-grow bg-slate-900 text-slate-100 font-sans flex flex-col justify-center px-6 py-10">
      <main className="max-w-4xl mx-auto w-full">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black tracking-tight text-white mb-2">
            Validación Ultrarrápida de Accesos
          </h2>
          <p className="text-slate-400 text-sm">
            Escanee el código QR o ingrese el token digital presentado por el prestador.
          </p>
        </div>

        <form
          onSubmit={handleVerifyPass}
          className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-xl mb-6 flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-grow">
            <QrCode className="absolute left-4 top-3.5 text-slate-400" size={20} />
            <input
              type="text"
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value)}
              placeholder="Ingrese o pistolee el Token QR (ej. 6c014b85...)"
              className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-sm active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
          >
            <Search size={18} /> {loading ? 'Verificando...' : 'Validar Pase'}
          </button>
        </form>

        {errorMsg && (
          <div className="bg-rose-950/50 border border-rose-800 text-rose-200 p-4 rounded-xl text-xs flex items-center gap-2 mb-6">
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {scanResult && (
          <div
            className={`rounded-2xl p-6 border shadow-2xl transition-all ${
              scanResult.authorized
                ? 'bg-emerald-950/30 border-emerald-600/50'
                : 'bg-rose-950/30 border-rose-600/50'
            }`}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-5">
              <div className="flex items-center gap-2.5">
                {scanResult.authorized ? (
                  <>
                    <CheckCircle2 className="text-emerald-400" size={24} />
                    <span className="text-base font-black text-emerald-300 tracking-wide">
                      ACCESO AUTORIZADO
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="text-rose-400" size={24} />
                    <span className="text-base font-black text-rose-300 tracking-wide">
                      ACCESO DENEGADO
                    </span>
                  </>
                )}
              </div>
            </div>

            {scanResult.authorized && scanResult.details ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-1.5">
                  <p className="text-slate-400 uppercase font-bold text-[10px] flex items-center gap-1.5">
                    <User size={13} className="text-emerald-400" /> Prestador
                  </p>
                  <p className="text-sm font-bold text-white">
                    {scanResult.details.provider_first_name} {scanResult.details.provider_last_name}
                  </p>
                  <p className="text-slate-400">DNI: {scanResult.details.provider_dni || 'No registrado'}</p>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-950 text-emerald-300 px-2.5 py-0.5 rounded border border-emerald-800 mt-1">
                    <ShieldCheck size={12} /> Compliance Aprobado
                  </span>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-1.5">
                  <p className="text-slate-400 uppercase font-bold text-[10px] flex items-center gap-1.5">
                    <Car size={13} className="text-sky-400" /> Vehículo y Destino
                  </p>
                  <p className="text-sm font-bold text-white">
                    {scanResult.details.brand
                      ? `${scanResult.details.brand} ${scanResult.details.model || ''} (${scanResult.details.color || 'S/C'})`
                      : 'Ingreso peatonal / Sin vehículo'}
                  </p>
                  {scanResult.details.plate && (
                    <p className="text-emerald-400 font-mono font-bold">Patente: {scanResult.details.plate}</p>
                  )}
                  <p className="text-slate-300">
                    Destino: Fracción {scanResult.details.fraction_number || '-'} / Lote {scanResult.details.lot_number || '-'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-rose-200 font-medium">
                {scanResult.error}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}