/**
 * @file UserManagementView.jsx
 * @description Panel maestro para el rol 'superadmin' con capacidades completas de alta,
 * edición (incluyendo DNI, email y contraseña) y gestión de cuentas privilegiadas conectadas a PostgreSQL.
 * @location /trustlink-web/src/modules/admin/UserManagementView.jsx
 */
import React, { useState, useEffect } from 'react';
import { ShieldAlert, UserPlus, CheckCircle2, AlertCircle, Users, Lock, Edit3, X } from 'lucide-react';
import { useBranding } from '../branding/BrandingContext';

export default function UserManagementView() {
  const { brand } = useBranding();
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Estado para el formulario de alta
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    dni: '',
    email: '',
    password: '',
    role: 'admin',
    country_id: 1
  });

  // Estado para la edición de usuario seleccionado (incluye email, dni y password opcional)
  const [editingUser, setEditingUser] = useState(null);

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
        setErrorMsg(data.error || 'No se pudieron cargar los usuarios privilegiados.');
      }
      setLoading(false);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      setErrorMsg('Error de conexión con el servidor backend.');
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
        setSuccessMsg(`¡Usuario ${formData.first_name} registrado con éxito en la base de datos!`);
        setFormData({ first_name: '', last_name: '', dni: '', email: '', password: '', role: 'admin', country_id: 1 });
        fetchPrivilegedUsers();
      } else {
        setErrorMsg(data.error || 'No se pudo crear el usuario.');
      }
      setLoading(false);
    } catch (error) {
      console.error('Error:', error);
      setErrorMsg('Error de conexión con el servidor.');
      setLoading(false);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const response = await fetch(`http://localhost:4000/api/v1/auth/users/privileged/${editingUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('trustlink_token') || ''}`
        },
        body: JSON.stringify({
          first_name: editingUser.first_name,
          last_name: editingUser.last_name,
          email: editingUser.email,
          dni: editingUser.dni,
          password: editingUser.password ? editingUser.password : undefined,
          role: editingUser.role,
          is_active: editingUser.is_active
        })
      });

      const data = await response.json();
      if (response.ok) {
        setSuccessMsg('¡Usuario actualizado correctamente en la base de datos!');
        setEditingUser(null);
        fetchPrivilegedUsers();
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar el usuario.');
      }
      setLoading(false);
    } catch (error) {
      console.error('Error:', error);
      setErrorMsg('Error de conexión con el servidor.');
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
            <h2 className="text-2xl font-black tracking-tight text-white">Ops Master — Gestión y Edición de Admins</h2>
            <p className="text-xs text-slate-400">Control maestro con persistencia directa en PostgreSQL</p>
          </div>
        </div>
        <span className="text-xs font-bold bg-slate-900 text-emerald-400 px-4 py-2 rounded-xl border border-slate-800 flex items-center gap-1.5">
          <Lock size={14} /> Nivel: Superadmin Global
        </span>
      </div>

      {errorMsg && (
        <div className="bg-rose-950/50 border border-rose-800 text-rose-200 p-4 rounded-xl mb-6 text-xs flex items-center gap-2">
          <AlertCircle size={16} /> <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-950/50 border border-emerald-800 text-emerald-200 p-4 rounded-xl mb-6 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} /> <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulario de Alta */}
        <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
            <UserPlus size={16} className="text-emerald-400" /> Registrar Nuevo Administrador
          </h3>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Rol del Sistema</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
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
                  placeholder="Ej. Juan"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Apellido</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Pérez"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">DNI</label>
              <input
                type="text"
                required
                placeholder="40123456"
                value={formData.dni}
                onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Correo Electrónico</label>
              <input
                type="email"
                required
                placeholder="admin@dominio.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Contraseña Temporal</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
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

        {/* Listado de Cuentas Privilegiadas con opción de Editar */}
        <div className="lg:col-span-2 bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
            <Users size={16} className="text-emerald-400" /> Cuentas con Privilegios Activos ({usersList.length})
          </h3>
          <div className="space-y-3">
            {usersList.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No hay cuentas privilegiadas registradas.</p>
            ) : (
              usersList.map((u) => (
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
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-3 py-1 rounded-lg font-bold border ${
                      u.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                      {u.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                    <button
                      onClick={() => setEditingUser({ ...u, password: '' })}
                      className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition-all cursor-pointer"
                      title="Editar usuario"
                    >
                      <Edit3 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal de Edición de Usuario (Con Nombre, Apellido, Email, DNI, Contraseña, Rol y Estado) */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-950 border border-slate-800 w-full max-w-md p-6 rounded-2xl shadow-2xl relative">
            <button
              onClick={() => setEditingUser(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Edit3 size={18} className="text-emerald-400" /> Editar Cuenta Privilegiada
            </h3>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Nombre</label>
                  <input
                    type="text"
                    required
                    value={editingUser.first_name}
                    onChange={(e) => setEditingUser({ ...editingUser, first_name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Apellido</label>
                  <input
                    type="text"
                    required
                    value={editingUser.last_name}
                    onChange={(e) => setEditingUser({ ...editingUser, last_name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">DNI</label>
                  <input
                    type="text"
                    required
                    value={editingUser.dni}
                    onChange={(e) => setEditingUser({ ...editingUser, dni: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    required
                    value={editingUser.email}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Nueva Contraseña (Opcional)</label>
                <input
                  type="password"
                  placeholder="Dejar en blanco para mantener la actual"
                  value={editingUser.password}
                  onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Rol del Sistema</label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="admin">Administrador Operativo (Admin)</option>
                  <option value="superadmin">Superadministrador (Superadmin)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Estado de la Cuenta</label>
                <select
                  value={editingUser.is_active ? 'true' : 'false'}
                  onChange={(e) => setEditingUser({ ...editingUser, is_active: e.target.value === 'true' })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="true">Activo</option>
                  <option value="false">Inactivo (Bloqueado)</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="w-1/2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-1/2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer shadow-lg"
                >
                  {loading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}