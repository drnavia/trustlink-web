/**
 * @file SecurityScanner.jsx
 * @description Interfaz ultrarrápida para la garita de seguridad. Permite validar pases QR
 * y verificar la identidad y vehículos de los prestadores en tiempo real contra el backend de TrustLink.
 * @location /trustlink-web/src/modules/security/SecurityScanner.jsx
 */

import React, { useState } from 'react';
import { ShieldCheck, QrCode, Search, CheckCircle2, XCircle, Car, User } from 'lucide-react';

export default function SecurityScanner() {
  const [qrToken, setQrToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [error, setError] = useState(null);

  // Función para ejecutar la petición real al endpoint de la garita del backend
  const handleVerifyPass = async (e) => {
    e.preventDefault();
    if (!qrToken.trim()) return;

    setLoading(true);
    setError(null);
    setVerificationResult(null);

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
        setVerificationResult(data.details);
      } else {
        setError(data.error || 'Acceso denegado por el sistema.');
      }
    } catch (err) {
      console.error('Error de conexión con el servidor:', err);
      setError('No se pudo conectar con el servidor central de TrustLink.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-trust-surface p-6 font-sans">
      {/* Cabecera de la Garita */}
      <header className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm p-6 mb-6 flex items-center justify-between border border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="bg-trust-primary p-3 rounded-xl text-white shadow-md">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-trust-dark">TrustLink Community - Control Perimetral</h1>
            <p className="text-xs text-slate-500">Terminal de Validación Ultrarrápida para Garita</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-xs font-semibold border border-emerald-200 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Sistema en Línea (Garita Norte)
        </div>
      </header>

      {/* Contenedor Principal de Escaneo */}
      <main className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Panel Izquierdo: Input de Código QR / Lector */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-trust-dark mb-2 flex items-center gap-2">
              <QrCode className="text-trust-primary" size={20} />
              Escanear o Ingresar Token QR
            </h2>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Coloque el lector láser sobre el código QR del prestador o ingrese el token de acceso manualmente para validar su ingreso.
            </p>

            <form onSubmit={handleVerifyPass} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Token Criptográfico QR</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Search size={18} />
                  </span>
                  <input
                    type="text"
                    value={qrToken}
                    onChange={(e) => setQrToken(e.target.value)}
                    placeholder="Ej: 6c014b85045464462e28..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-trust-primary text-sm font-mono transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-trust-primary hover:bg-slate-800 text-white font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-md active:scale-95 cursor-pointer"
              >
                {loading ? 'Verificando en Base de Datos...' : 'Validar Ingreso en Garita'}
              </button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400 text-center font-medium">
            Protocolo de seguridad verificado por antecedentes y ART.
          </div>
        </div>

        {/* Panel Derecho: Resultados de la Validación */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200 flex flex-col justify-center">
          <h2 className="text-lg font-bold text-trust-dark mb-4">Estado de Autorización</h2>

          {/* Estado Inicial / Sin consulta */}
          {!verificationResult && !error && !loading && (
            <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
              <QrCode size={48} className="mx-auto mb-3 opacity-30 text-trust-primary" />
              <p className="text-sm font-medium">Esperando lectura de pase o código QR...</p>
            </div>
          )}

          {/* Estado de Carga */}
          {loading && (
            <div className="text-center py-12 text-trust-primary">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-trust-primary mx-auto mb-3"></div>
              <p className="text-sm font-semibold">Validando Compliance y Patentes...</p>
            </div>
          )}

          {/* Resultado: Acceso Autorizado (Éxito) */}
          {verificationResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-emerald-900 space-y-3 shadow-sm animate-fade-in">
              <div className="flex items-center gap-2 font-black text-emerald-700 text-base">
                <CheckCircle2 size={24} />
                ACCESO AUTORIZADO
              </div>
              <div className="text-xs space-y-2 pt-2 border-t border-emerald-200/60 font-medium">
                <p className="flex items-center gap-2">
                  <User size={16} className="text-emerald-600" />
                  <span><strong>Prestador:</strong> {verificationResult.provider} (DNI: {verificationResult.dni})</span>
                </p>
                <p className="flex items-center gap-2">
                  <Car size={16} className="text-emerald-600" />
                  <span><strong>Vehículo:</strong> {verificationResult.vehicle}</span>
                </p>
                <p className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-600" />
                  <span><strong>Destino:</strong> {verificationResult.destination}</span>
                </p>
                <p className="text-xs text-emerald-700 pt-1 font-semibold">
                  Autorizado por residente: {verificationResult.authorized_by}
                </p>
              </div>
            </div>
          )}

          {/* Resultado: Acceso Denegado (Error) */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 text-rose-900 space-y-2 shadow-sm animate-fade-in">
              <div className="flex items-center gap-2 font-black text-rose-700 text-base">
                <XCircle size={24} />
                ACCESO DENEGADO
              </div>
              <p className="text-sm text-rose-800 font-medium">{error}</p>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}