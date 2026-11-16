/**
 * @file AdminComplianceView.jsx
 * @description Panel de control para que los administradores del Country gestionen
 * y aprueben/rechacen el compliance (antecedentes y seguros) de los prestadores postulados.
 * @location /trustlink-web/src/modules/admin/AdminComplianceView.jsx
 */

import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, CheckCircle2, XCircle, FileText, UserCheck, AlertCircle } from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';

export default function AdminComplianceView() {
  const { brand } = useBranding();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Función para obtener la lista de prestadores pendientes de aprobación (Simulada o conectada a API)
  const fetchPendingProviders = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // Simulación de datos para demostración visual inmediata en el panel de administración
      setTimeout(() => {
        setProviders([
          {
            id: 101,
            first_name: 'Federico',
            last_name: 'Gómez',
            dni: '32456789',
            specialty: 'Electricista Matriculado',
            criminal_record_url: 'https://storage.trustlink.com/antecedentes_fedegomez.pdf',
            insurance_policy_url: 'https://storage.trustlink.com/art_fedegomez.pdf',
            status: 'pending'
          },
          {
            id: 102,
            first_name: 'Marcos',
            last_name: 'Pérez',
            dni: '28987654',
            specialty: 'Gasista y Plomero',
            criminal_record_url: 'https://storage.trustlink.com/antecedentes_marcos.pdf',
            insurance_policy_url: 'https://storage.trustlink.com/art_marcos.pdf',
            status: 'pending'
          }
        ]);
        setLoading(false);
      }, 400);
    } catch (error) {
      console.error('Error al obtener prestadores:', error);
      setErrorMsg('Error de conexión al cargar las postulaciones.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingProviders();
  }, []);

  // Función para actualizar el estado de compliance (Aprobar o Rechazar) contra /api/v1/providers/compliance
  const handleUpdateCompliance = async (providerId, newStatus) => {
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch('http://localhost:4000/api/v1/providers/compliance', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('trustlink_token') || ''}` 
        },
        body: JSON.stringify({
          provider_id: providerId,
          status: newStatus
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMsg(`Prestador actualizado exitosamente a estado: ${newStatus}`);
        // Actualizar estado localmente para reflejar el cambio en la tabla
        setProviders(providers.map(p => p.id === providerId ? { ...p, status: newStatus } : p));
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar el compliance.');
      }
    } catch (error) {
      console.error('Error al actualizar compliance:', error);
      setErrorMsg('Error de conexión con el servidor backend.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-8 bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl my-8 font-sans">
      {/* Cabecera del Panel */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-800 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <UserCheck size={26} />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-white">Panel de Administración y Compliance</h2>
            <p className="text-xs text-slate-400">Auditoría de antecedentes y habilitación de prestadores en {brand.countryName}</p>
          </div>
        </div>
        <span className="text-xs font-bold bg-slate-900 text-slate-300 px-4 py-2 rounded-xl border border-slate-800">
          Rol: Administrador Country
        </span>
      </div>

      {/* Mensajes de Alerta y Éxito */}
      {errorMsg && (
        <div className="bg-rose-950/50 border border-rose-800 text-rose-200 p-4 rounded-xl mb-6 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-950/50 border border-emerald-800 text-emerald-200 p-4 rounded-xl mb-6 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tabla de Postulaciones */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-lg">
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Prestadores Postulados (Pendientes de Auditoría)</h3>
          <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-1 rounded-lg">{providers.length} registros</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Cargando postulaciones...</div>
        ) : providers.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">No hay prestadores pendientes de aprobación.</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {providers.map((p) => (
              <div key={p.id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-slate-850/50 transition-all">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-white">{p.first_name} {p.last_name}</h4>
                    <span className="text-xs bg-blue-950/80 text-blue-300 border border-blue-800 px-2.5 py-0.5 rounded-md font-medium">
                      {p.specialty}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">DNI: {p.dni}</p>
                  <div className="flex gap-4 pt-2 text-xs">
                    <a href={p.criminal_record_url} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline flex items-center gap-1 font-medium">
                      <FileText size={14} /> Ver Antecedentes Penales
                    </a>
                    <a href={p.insurance_policy_url} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline flex items-center gap-1 font-medium">
                      <FileText size={14} /> Ver Póliza ART / Seguro
                    </a>
                  </div>
                </div>

                {/* Acciones de Aprobación */}
                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                  {p.status === 'approved' ? (
                    <span className="text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 px-3.5 py-1.5 rounded-lg flex items-center gap-1.5">
                      <CheckCircle2 size={14} /> Aprobado
                    </span>
                  ) : p.status === 'rejected' ? (
                    <span className="text-xs font-bold bg-rose-950 text-rose-300 border border-rose-800 px-3.5 py-1.5 rounded-lg flex items-center gap-1.5">
                      <XCircle size={14} /> Rechazado
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => handleUpdateCompliance(p.id, 'approved')}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 size={14} /> Aprobar
                      </button>
                      <button
                        onClick={() => handleUpdateCompliance(p.id, 'rejected')}
                        className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center gap-1 cursor-pointer"
                      >
                        <XCircle size={14} /> Rechazar
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}