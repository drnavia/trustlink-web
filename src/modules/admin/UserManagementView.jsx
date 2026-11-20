/**
 * @file UserManagementView.jsx
 * @description Consola minimalista de Cuentas Privilegiadas para superadmin: alta, edición y
 * control de estado de usuarios con roles 'admin' y 'superadmin'.
 * @location /trustlink-web/src/modules/admin/UserManagementView.jsx
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  UserPlus,
  Pencil,
  CheckCircle2,
  AlertCircle,
  X,
  Save,
  Mail
} from 'lucide-react';

const API_BASE = 'http://localhost:4000';

export default function UserManagementView() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Formulario alta
  const [role, setRole] = useState('admin');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Modal / edición inline
  const [editingUser, setEditingUser] = useState(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editRole, setEditRole] = useState('admin');
  const [editActive, setEditActive] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`
  });

  const fetchPrivilegedUsers = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/users/privileged`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (response.ok) {
        setUsers(data.users || []);
      } else {
        setErrorMsg(data.error || 'No se pudieron cargar las cuentas privilegiadas.');
      }
    } catch (error) {
      console.error('Error al cargar cuentas privilegiadas:', error);
      setErrorMsg('Error de conexión con el servidor backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrivilegedUsers();
  }, []);

  const handleCreatePrivilegedUser = async (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) return;
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          role,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          dni: dni.trim() || null,
          email: email.trim(),
          password
        })
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(data.message || 'Cuenta privilegiada creada.');
        setFirstName('');
        setLastName('');
        setDni('');
        setEmail('');
        setPassword('');
        await fetchPrivilegedUsers();
      } else {
        setErrorMsg(data.error || 'No se pudo crear la cuenta.');
      }
    } catch (error) {
      console.error('Error al crear cuenta privilegiada:', error);
      setErrorMsg('Error de conexión al registrar la cuenta.');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditUser = (u) => {
    setEditingUser(u);
    setEditFirstName(u.first_name || '');
    setEditLastName(u.last_name || '');
    setEditRole(u.role || 'admin');
    setEditActive(Boolean(u.is_active));
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSaveUserEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/users/privileged/${editingUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          first_name: editFirstName.trim(),
          last_name: editLastName.trim(),
          role: editRole,
          is_active: editActive
        })
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(data.message || 'Cuenta actualizada.');
        setEditingUser(null);
        await fetchPrivilegedUsers();
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar la cuenta.');
      }
    } catch (error) {
      console.error('Error al actualizar cuenta:', error);
      setErrorMsg('Error de conexión al actualizar.');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-900 text-slate-100 font-sans p-6 md:p-8">
      <main className="max-w-6xl mx-auto space-y-6">
        {/* Cabecera minimalista */}
        <div className="bg-slate-950 border border-slate-800 p-5 md:p-6 rounded-2xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black tracking-tight text-white">
                Cuentas Privilegiadas
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Gestión de accesos y roles administrativos.
              </p>
            </div>
          </div>

          <span className="text-xs font-mono bg-slate-900 text-slate-300 border border-slate-800 px-3 py-1.5 rounded-xl">
            {users.length} cuentas
          </span>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 bg-rose-950/60 border border-rose-800/80 text-rose-200 p-4 rounded-xl text-xs">
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 p-4 rounded-xl text-xs">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Columna izquierda: Alta */}
          <div className="lg:col-span-5 bg-slate-950 border border-slate-800 p-5 md:p-6 rounded-2xl shadow-xl space-y-4 self-start">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <UserPlus size={15} />
              <span>Registrar nuevo administrador</span>
            </div>

            <form onSubmit={handleCreatePrivilegedUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Rol del sistema
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="admin">Administrador Operativo (Admin)</option>
                  <option value="superadmin">Superadmin Global</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Ej. Juan"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Apellido
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Ej. Pérez"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  DNI
                </label>
                <input
                  type="text"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  placeholder="40123456"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@dominio.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Contraseña temporal
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition-all disabled:opacity-50 cursor-pointer"
              >
                <UserPlus size={14} />
                {submitting ? 'Registrando...' : 'Otorgar Rol Administrador'}
              </button>
            </form>
          </div>

          {/* Columna derecha: Cuentas activas */}
          <div className="lg:col-span-7 bg-slate-950 border border-slate-800 p-5 md:p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <Shield size={15} />
                <span>Cuentas con privilegios activos ({users.length})</span>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8 text-xs text-slate-400">Cargando cuentas...</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">Sin cuentas registradas.</div>
            ) : (
              <div className="space-y-3">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">
                          {u.first_name} {u.last_name}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                            u.role === 'superadmin'
                              ? 'bg-purple-950 text-purple-300 border-purple-800'
                              : 'bg-blue-950 text-blue-300 border-blue-800'
                          }`}
                        >
                          {u.role}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 flex items-center gap-1.5">
                        <Mail size={12} className="text-slate-500" />
                        <span>{u.email}</span>
                        {u.dni && <span>| DNI: {u.dni}</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-lg border ${
                          u.is_active
                            ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {u.is_active ? 'Activo' : 'Inactivo'}
                      </span>

                      <button
                        type="button"
                        onClick={() => openEditUser(u)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                        title="Editar cuenta"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {editingUser && (
              <form
                onSubmit={handleSaveUserEdit}
                className="bg-slate-900 border border-purple-800/70 rounded-xl p-4 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-300">
                    Editando cuenta #{editingUser.id} ({editingUser.email})
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    placeholder="Nombre"
                    className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                  />
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    placeholder="Apellido"
                    className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                  >
                    <option value="admin">admin</option>
                    <option value="superadmin">superadmin</option>
                  </select>

                  <label className="inline-flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editActive}
                      onChange={(e) => setEditActive(e.target.checked)}
                    />
                    <span>Cuenta activa</span>
                  </label>

                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                  >
                    <Save size={13} />
                    {savingEdit ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}