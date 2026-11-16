/**
 * @file ContractPaymentView.jsx
 * @description Vista del residente para visualizar contratos activos, aprobar presupuestos 
 * acordados in situ y procesar el pago mediante pasarela integrada con cálculo de Take Rate.
 * @location /trustlink-web/src/modules/owner/ContractPaymentView.jsx
 */

import React, { useState } from 'react';
import { CreditCard, CheckCircle2, ShieldCheck, DollarSign, FileText, AlertCircle } from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';

export default function ContractPaymentView() {
  const { brand } = useBranding();
  const [loading, setLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Simulación de datos del contrato actual acordado in situ en domicilio
  const contract = {
    id: 104,
    providerName: 'Federico Gómez (Electricista)',
    description: 'Instalación de tablero seccional y revisión de acometida en domicilio',
    agreedAmount: 100000.00,
    platformFee: 7000.00, // 7% Take Rate institucional
    providerPayout: 93000.00,
    status: 'pending_payment'
  };

  // Función para procesar el pago contra el endpoint del backend (/api/v1/payments/quote)
  const handleProcessPayment = async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch('http://localhost:4000/api/v1/payments/quote', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('trustlink_token') || ''}` 
        },
        body: JSON.stringify({
          contract_id: contract.id,
          agreed_amount: contract.agreedAmount
        })
      });

      const data = await response.json();

      if (response.ok && data.checkout_url) {
        setPaymentUrl(data.checkout_url);
      } else {
        setErrorMsg(data.error || 'No se pudo generar la orden de pago.');
      }
      setLoading(false);

    } catch (error) {
      console.error('Error al procesar pasarela:', error);
      setErrorMsg('Error de conexión con el servidor de pagos de TrustLink.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-8 bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl my-8 font-sans">
      {/* Cabecera del Módulo */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-800 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <FileText size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-white">Presupuesto y Orden de Pago</h2>
            <p className="text-xs text-slate-400">Transacción segura respaldada por {brand.countryName}</p>
          </div>
        </div>
        <span className="text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-full">
          Pendiente de Pago
        </span>
      </div>

      {/* Detalle del Contrato */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 mb-6 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Prestador Asignado</span>
            <h3 className="text-lg font-bold text-white mt-0.5">{contract.providerName}</h3>
          </div>
          <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-lg border border-slate-700 font-mono">
            Contrato #{contract.id}
          </span>
        </div>

        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Detalle del Trabajo (Acordado In Situ)</span>
          <p className="text-sm text-slate-200 mt-1 leading-relaxed">{contract.description}</p>
        </div>

        {/* Desglose Financiero */}
        <div className="border-t border-slate-800 pt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Monto Acordado</span>
            <span className="text-base font-black text-white">${contract.agreedAmount.toLocaleString('es-AR')} ARS</span>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Comisión TrustLink (7%)</span>
            <span className="text-base font-black text-emerald-400">${contract.platformFee.toLocaleString('es-AR')} ARS</span>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Neto Prestador</span>
            <span className="text-base font-black text-slate-200">${contract.providerPayout.toLocaleString('es-AR')} ARS</span>
          </div>
        </div>
      </div>

      {/* Mensaje de Error */}
      {errorMsg && (
        <div className="bg-rose-950/50 border border-rose-800 text-rose-200 p-4 rounded-xl text-center font-medium mb-6 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Acciones de Pago */}
      {paymentUrl ? (
        <div className="bg-emerald-950/40 border border-emerald-600/50 p-6 rounded-xl text-center space-y-4">
          <CheckCircle2 size={36} className="text-emerald-400 mx-auto" />
          <h4 className="text-base font-bold text-white">¡Preferencia de Pago Generada con Éxito!</h4>
          <p className="text-xs text-slate-300">Haga clic en el botón para proceder de manera segura con la pasarela.</p>
          <a
            href={paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-sky-600 hover:bg-sky-500 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg text-sm"
          >
            Pagar en Pasarela Segura ➔
          </a>
        </div>
      ) : (
        <button
          onClick={handleProcessPayment}
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-sm active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          <CreditCard size={18} /> {loading ? 'Generando Orden de Pago...' : 'Aprobar y Pagar Servicio'}
        </button>
      )}
    </div>
  );
}