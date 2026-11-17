/**
 * @file AdminComplianceView.jsx
 * @description Panel de control central para que el equipo de Operaciones de TrustLink
 * audite y apruebe/rechace el compliance de todos los prestadores registrados (incluso sin perfil completo).
 * @location /trustlink-web/src/modules/admin/AdminComplianceView.jsx
 */
import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle2, XCircle, FileText, UserCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';

export default function AdminComplianceView() {
  const { brand } = useBranding();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Función para obtener todos los prestadores desde la Base de Datos
  const fetchAllProviders = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch('http://localhost:4000/api/v1/providers/all', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('trustlink_token') || ''}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setProviders(data.providers || []);
      } else {
        setErrorMsg(data.error || 'No se pudieron cargar los prestadores.');
      }
    } catch (error) {
      console.error('Error al conectar con el backend:', error);
      setErrorMsg('Error de conexión con el servidor backend de TrustLink.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllProviders();
  }, []);

  // Función para aprobar o rechazar el compliance
  const handleUpdateCompliance = async (providerId, userId, newStatus) => {
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
          provider_id: providerId || null,
          user_id: userId || null,
          status: newStatus
        })
      });

      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(`¡Prestador actualizado exitosamente a estado: ${newStatus}!`);
        fetchAllProviders(); // Recargar listado real desde PostgreSQL
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar el estado de compliance.');
      }
    } catch (error) {
      console.error('Error al actualizar compliance:', error);
      setErrorMsg('Error de conexión con el servidor de TrustLink.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-8 bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl my-8 font-sans">
      {/* Cabecera del Panel */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-800 mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <UserCheck size={26} />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-white">Panel de Operaciones Centrales - TrustLink</h2>
            <p className="text-xs text-slate-400">Auditoría global de antecedentes y certificación de prestadores conectado a PostgreSQL</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAllProviders}
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 px-3 py-2 rounded-xl text-xs font-bold border border-slate-800 flex items-center gap-1.5 cursor-pointer"
            title="Actualizar listado"
          >
            <RefreshCw size={14} /> Actualizar
          </button>
          <span className="text-xs font-bold bg-slate-900 text-emerald-400 px-4 py-2 rounded-xl border border-slate-800">
            Rol: TrustLink Superadmin / Ops
          </span>
        </div>
      </div>

      {/* Alertas */}
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

      {/* Listado de Prestadores */}
      <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <ShieldAlert size={16} className="text-emerald-400" /> Todos los Prestadores Registrados en la Red
          </h3>
          <span className="text-xs bg-slate-950 text-slate-300 px-3 py-1 rounded-xl border border-slate-800 font-bold">
            {providers.length} registros
          </span>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-400 text-sm">Consultando base de datos de prestadores...</div>
        ) : providers.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-sm">
            No hay prestadores registrados en la base de datos en este momento.
          </div>
        ) : (
          <div className="space-y-4">
            {providers.map((p) => (
              <div key={p.user_id || p.provider_id} className="bg-slate-950 p-5 rounded-xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-slate-700 transition-all">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-bold text-white text-base">{p.first_name} {p.last_name}</span>
                    <span className="text-[11px] font-bold px-3 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {p.specialty}
                    </span>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                      p.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      p.status === 'rejected' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                      p.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {p.status === 'sin_perfil' ? 'Sin Perfil / Sin Compliance' : p.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">DNI: <strong className="text-slate-300">{p.dni}</strong> | Email: {p.email}</p>
                  
                  <div className="flex items-center gap-4 text-xs flex-wrap">
                    <a
                      href={p.criminal_record_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-1 font-medium px-3 py-1.5 rounded-lg border ${
                        p.criminal_record_url 
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:underline' 
                          : 'text-slate-500 bg-slate-900 border-slate-800 cursor-not-allowed'
                      }`}
                    >
                      <FileText size={13} /> {p.criminal_record_url ? 'Ver Antecedentes Penales' : 'Sin Antecedentes Cargados'}
                    </a>
                    <a
                      href={p.insurance_policy_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-1 font-medium px-3 py-1.5 rounded-lg border ${
                        p.insurance_policy_url 
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:underline' 
                          : 'text-slate-500 bg-slate-900 border-slate-800 cursor-not-allowed'
                      }`}
                    >
                      <FileText size={13} /> {p.insurance_policy_url ? 'Ver Póliza ART / Seguro' : 'Sin Póliza Cargada'}
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  <button
                    onClick={() => handleUpdateCompliance(p.provider_id, p.user_id, 'approved')}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                  >
                    <CheckCircle2 size={15} /> Certificar / Aprobar
                  </button>
                  <button
                    onClick={() => handleUpdateCompliance(p.provider_id, p.user_id, 'rejected')}
                    className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                  >
                    <XCircle size={15} /> Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}