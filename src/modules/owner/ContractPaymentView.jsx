/**
 * @file ContractPaymentView.jsx
 * @description Vista del residente para visualizar contratos pendientes reales desde PostgreSQL,
 * aprobar presupuestos acordados in situ y procesar el pago seguro con cálculo automático de Take Rate.
 * @location /trustlink-web/src/modules/owner/ContractPaymentView.jsx
 */

import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle2, ShieldCheck, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';

export default function ContractPaymentView() {
  const { brand } = useBranding();
  
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Obtener contratos pendientes de pago reales desde la Base de Datos
  const fetchPendingContract = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch('http://localhost:4000/api/v1/payments/pending', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('trustlink_token') || ''}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        // Tomar el primer contrato pendiente o activo disponible
        if (data.contracts && data.contracts.length > 0) {
          setContract(data.contracts[0]);
        } else {
          setContract(null);
        }
      } else {
        setErrorMsg(data.error || 'No se pudo cargar la orden de pago.');
      }
    } catch (error) {
      console.error('Error de red al obtener contratos:', error);
      setErrorMsg('Error de conexión con el servidor backend de TrustLink.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingContract();
  }, []);

  // 2. Procesar el pago contra el endpoint del backend
  const handleProcessPayment = async () => {
    if (!contract) return;
    setPaying(true);
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
          agreed_amount: contract.agreed_amount
        })
      });
      const data = await response.json();
      if (response.ok && data.checkout_url) {
        setPaymentUrl(data.checkout_url);
      } else {
        setErrorMsg(data.error || 'No se pudo generar la orden de pago en la pasarela.');
      }
    } catch (error) {
      console.error('Error al procesar pasarela:', error);
      setErrorMsg('Error de conexión con el servidor de pagos de TrustLink.');
    } finally {
      setPaying(false);
    }
  };

  // Cálculos dinámicos del Take Rate (7% institucional)
  const totalAmount = contract ? Number(contract.agreed_amount) : 0;
  const platformFee = Number((totalAmount * 0.07).toFixed(2));
  const providerPayout = Number((totalAmount - platformFee).toFixed(2));

  return (
    <div className="max-w-3xl mx-auto p-8 bg-slate-950 text-slate-100 rounded-3xl border border-slate-800 shadow-2xl my-8 font-sans">
      
      {/* Cabecera del Módulo */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-800 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
            <FileText size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-white">Presupuesto y Orden de Pago</h2>
            <p className="text-xs text-slate-400">Transacción segura respaldada por {brand.countryName || 'TrustLink Community'}</p>
          </div>
        </div>
        <span className="text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-full">
          {contract ? contract.status : 'Sin Contratos'}
        </span>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400 text-xs flex items-center justify-center gap-2">
          <Loader2 className="animate-spin" size={16} /> Consultando contratos pendientes en PostgreSQL...
        </div>
      ) : !contract ? (
        <div className="text-center py-16 bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400 text-xs">
          No hay órdenes de pago pendientes en este momento. Contrata a un prestador desde el Portal Residente para generar un presupuesto.
        </div>
      ) : (
        <>
          {/* Detalle del Contrato Real */}
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 mb-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2.5 py-0.5 rounded-md">
                  Contrato #{contract.id}
                </span>
                <h3 className="text-base font-bold text-white mt-2">Prestador: {contract.provider_name || 'Profesional Verificado'}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  <strong>Detalle del trabajo:</strong> {contract.description}
                </p>
              </div>
            </div>

            {/* Desglose Financiero Dinámico */}
            <div className="border-t border-slate-800 pt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                <span className="text-xs text-slate-400 block mb-1">Monto Acordado</span>
                <span className="text-base font-black text-white">${totalAmount.toLocaleString('es-AR')} ARS</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                <span className="text-xs text-slate-400 block mb-1">Comisión TrustLink (7%)</span>
                <span className="text-base font-black text-emerald-400">${platformFee.toLocaleString('es-AR')} ARS</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                <span className="text-xs text-slate-400 block mb-1">Neto Prestador</span>
                <span className="text-base font-black text-slate-200">${providerPayout.toLocaleString('es-AR')} ARS</span>
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
            <div className="bg-emerald-950/40 border border-emerald-600/50 p-6 rounded-2xl text-center space-y-4">
              <CheckCircle2 size={36} className="text-emerald-400 mx-auto" />
              <h4 className="text-base font-bold text-white">¡Preferencia de Pago Generada con Éxito!</h4>
              <p className="text-xs text-slate-300">Haga clic en el botón para proceder de manera segura con la pasarela.</p>
              <a
                href={paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-sky-600 hover:bg-sky-500 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg text-xs"
              >
                Pagar en Pasarela Segura ➔
              </a>
            </div>
          ) : (
            <button
              onClick={handleProcessPayment}
              disabled={paying}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-xs active:scale-95 disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: brand.primaryColor || '#10b981' }}
            >
              {paying ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
              {paying ? 'Generando Orden de Pago...' : 'Aprobar y Pagar Servicio'}
            </button>
          )}
        </>
      )}

    </div>
  );
}