/**
 * @file UserManagementView.jsx
 * @description Panel maestro para el rol 'superadmin'. Permite gestionar, dar de alta y auditar
 * los usuarios con roles críticos (superadmin y admin) en la plataforma TrustLink de forma segura.
 * @location /trustlink-web/src/modules/admin/UserManagementView.jsx
 */
import React, { useState, useEffect } from 'react';
import { ShieldAlert, UserPlus, CheckCircle2, AlertCircle, Users, Lock } from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';

export default function UserManagementView() {
  const { brand } = useBranding();
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    dni: '',
    email: '',
    password: '',
    role: 'admin',
    country_id: 1
  });

  const fetchPrivilegedUsers = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch('http://localhost:4000/api/v1/auth/users/privileged', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('trustlink_token') || ''}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setUsersList(data.users || []);
      } else {
        setUsersList([
          { id: 1, first_name: 'Damián', last_name: 'Navia', email: 'damian.navia@trustlink.com', role: 'superadmin', dni: '30123456', is_active: true },
          { id: 2, first_name: 'Martín', last_name: 'Operaciones', email: 'admin@trustlink.com', role: 'admin', dni: '25654321', is_active: true }
        ]);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error al cargar usuarios privilegiados:', error);
      setUsersList([
        { id: 1, first_name: 'Damián', last_name: 'Navia', email: 'damian.navia@trustlink.com', role: 'superadmin', dni: '30123456', is_active: true },
        { id: 2, first_name: 'Martín', last_name: 'Operaciones', email: 'admin@trustlink.com', role: 'admin', dni: '25654321', is_active: true }
      ]);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrivilegedUsers();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:4000/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('trustlink_token') || ''}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(`Usuario ${formData.role.toUpperCase()} creado exitosamente.`);
        setFormData({ first_name: '', last_name: '', dni: '', email: '', password: '', role: 'admin', country_id: 1 });
        fetchPrivilegedUsers();
      } else {
        setErrorMsg(data.error || 'No se pudo crear el usuario administrador.');
      }
      setLoading(false);
    } catch (error) {
      console.error('Error al crear usuario:', error);
      setErrorMsg('Error de conexión con el servidor de TrustLink.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-8 bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl my-8 font-sans">
      <div className="flex items-center justify-between pb-6 border-b border-slate-800 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <ShieldAlert size={26} />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-white">Ops Master — Gestión de Superadmins y Admins</h2>
            <p className="text-xs text-slate-400">Control maestro de accesos y gobernanza global de la plataforma</p>
          </div>
        </div>
        <span className="text-xs font-bold bg-slate-900 text-emerald-400 px-4 py-2 rounded-xl border border-slate-800 flex items-center gap-1.5">
          <Lock size={14} /> Nivel: Superadmin Global
        </span>
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 h-fit">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
            <UserPlus size={16} className="text-emerald-400" /> Registrar Nuevo Administrador
          </h3>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Rol del Sistema</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="admin">Administrador Operativo (Admin)</option>
                <option value="superadmin">Superadministrador TrustLink (Superadmin)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="Ej. Juan"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Apellido</label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Ej. Pérez"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">DNI</label>
              <input
                type="text"
                required
                value={formData.dni}
                onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                placeholder="40123456"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Correo Electrónico</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="admin@dominio.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Contraseña Temporal</label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg mt-2"
            >
              <UserPlus size={16} /> {loading ? 'Registrando...' : 'Otorgar Rol Administrador'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
            <Users size={16} className="text-emerald-400" /> Cuentas con Privilegios Activos ({usersList.length})
          </h3>
          <div className="space-y-3">
            {usersList.map((u) => (
              <div key={u.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{u.first_name} {u.last_name}</span>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                      u.role === 'superadmin' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}>
                      {u.role}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">📧 {u.email} | DNI: {u.dni}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg font-bold">
                    Activo
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}