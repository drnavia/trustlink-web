/**
 * @file UserManagementView.jsx
 * @description Panel maestro para el rol 'superadmin' con alta, edición y control
 * de cuentas privilegiadas ('admin' y 'superadmin'), con aplicación explícita de
 * Zona 4 (tarjetas principales) y Zona 5 (cajas/bloques internos e inputs).
 * @location /trustlink-web/src/modules/admin/UserManagementView.jsx
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Users,
  Edit3,
  X,
} from 'lucide-react';
import { useBranding, DEFAULT_BRANDING_CONFIG } from '../branding/BrandingContext';

const API_BASE = 'http://localhost:4000';

export default function UserManagementView() {
  const { brand } = useBranding();

  const cardStyle = {
    backgroundColor: brand.cardBgColor || DEFAULT_BRANDING_CONFIG.cardBgColor,
    color: brand.cardTextColor || DEFAULT_BRANDING_CONFIG.cardTextColor,
  };

  const innerStyle = {
    backgroundColor: brand.innerBgColor || DEFAULT_BRANDING_CONFIG.innerBgColor,
    color: brand.innerTextColor || DEFAULT_BRANDING_CONFIG.innerTextColor,
  };

  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Estado para el formulario de alta de Superadmin / Admin
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    dni: '',
    email: '',
    password: '',
    role: 'admin',
    country_id: 1,
  });

  // Estado para edición de cuenta privilegiada
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    dni: '',
    email: '',
    password: '',
    role: 'admin',
    is_active: true,
  });

  const fetchPrivilegedUsers = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/users/privileged`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setUsersList(data.users || []);
      } else {
        setErrorMsg(data.error || 'No se pudieron cargar las cuentas privilegiadas.');
      }
    } catch (error) {
      console.error('Error al cargar usuarios privilegiados:', error);
      setErrorMsg('Error de conexión con el servidor backend de TrustLink.');
    } finally {
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
      const response = await fetch(`${API_BASE}/api/v1/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
        },
        body: JSON.stringify({
          ...formData,
          country_id: formData.role === 'superadmin' ? null : Number(formData.country_id || 1),
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg('Cuenta privilegiada creada correctamente.');
        setFormData({
          first_name: '',
          last_name: '',
          dni: '',
          email: '',
          password: '',
          role: 'admin',
          country_id: 1,
        });
        await fetchPrivilegedUsers();
      } else {
        setErrorMsg(data.error || 'No se pudo crear la cuenta privilegiada.');
      }
    } catch (error) {
      console.error('Error al crear usuario privilegiado:', error);
      setErrorMsg('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (u) => {
    setEditingUser(u);
    setEditForm({
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      dni: u.dni || '',
      email: u.email || '',
      password: '',
      role: u.role || 'admin',
      is_active: Boolean(u.is_active),
    });
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const payload = {
      first_name: editForm.first_name,
      last_name: editForm.last_name,
      dni: editForm.dni,
      email: editForm.email,
      role: editForm.role,
      is_active: editForm.is_active,
    };
    if (editForm.password.trim()) {
      payload.password = editForm.password.trim();
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/v1/auth/users/privileged/${editingUser.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('trustlink_token') || ''}`,
          },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg('Cuenta privilegiada actualizada correctamente.');
        setEditingUser(null);
        await fetchPrivilegedUsers();
      } else {
        setErrorMsg(data.error || 'No se pudo actualizar la cuenta.');
      }
    } catch (error) {
      console.error('Error al actualizar cuenta privilegiada:', error);
      setErrorMsg('Error de conexión al actualizar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl w-full mx-auto px-4 md:px-8 py-6 space-y-6 font-sans">
      {/* Zona 4: Encabezado Cuentas Privilegiadas */}
      <section
        className="border border-black/20 p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={cardStyle}
      >
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl border border-white/15 text-purple-400" style={innerStyle}>
            <ShieldAlert size={22} />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">
              Cuentas Privilegiadas
            </h2>
            <p className="text-xs opacity-80 mt-0.5">
              Gestión de accesos y roles administrativos.
            </p>
          </div>
        </div>

        <span
          className="text-xs font-bold px-3.5 py-2 rounded-xl border border-white/15 self-start sm:self-auto"
          style={innerStyle}
        >
          {usersList.length} cuenta(s)
        </span>
      </section>

      {errorMsg && (
        <div className="bg-rose-950/60 border border-rose-800 text-rose-200 p-4 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-950/60 border border-emerald-800 text-emerald-200 p-4 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Zona 4: Formulario Alta + Zona 5: Inputs */}
        <section
          className="lg:col-span-5 border border-black/20 p-6 rounded-2xl space-y-4 self-start"
          style={cardStyle}
        >
          <h3 className="text-sm font-bold flex items-center gap-2 text-emerald-400">
            <UserPlus size={16} /> Registrar nuevo administrador
          </h3>

          <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
            <div>
              <label className="block font-bold uppercase tracking-wider opacity-80 mb-1">
                Rol del sistema
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs"
                style={innerStyle}
              >
                <option value="admin">Administrador Operativo (Admin)</option>
                <option value="superadmin">Superadministrador Global (Superadmin)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold uppercase tracking-wider opacity-80 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="Ej. Juan"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs"
                  style={innerStyle}
                />
              </div>
              <div>
                <label className="block font-bold uppercase tracking-wider opacity-80 mb-1">
                  Apellido
                </label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Ej. Pérez"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs"
                  style={innerStyle}
                />
              </div>
            </div>

            <div>
              <label className="block font-bold uppercase tracking-wider opacity-80 mb-1">
                DNI
              </label>
              <input
                type="text"
                required
                value={formData.dni}
                onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                placeholder="40123456"
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs"
                style={innerStyle}
              />
            </div>

            <div>
              <label className="block font-bold uppercase tracking-wider opacity-80 mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="admin@dominio.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs"
                style={innerStyle}
              />
            </div>

            <div>
              <label className="block font-bold uppercase tracking-wider opacity-80 mb-1">
                Contraseña temporal
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-xs"
                style={innerStyle}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 mt-2"
            >
              <UserPlus size={15} />
              {loading ? 'Procesando...' : 'Otorgar Rol Administrador'}
            </button>
          </form>
        </section>

        {/* Zona 4: Listado de Cuentas + Zona 5: Tarjetas de Usuario */}
        <section
          className="lg:col-span-7 border border-black/20 p-6 rounded-2xl space-y-4"
          style={cardStyle}
        >
          <h3 className="text-sm font-bold flex items-center gap-2 text-sky-400">
            <Users size={16} /> Cuentas con privilegios activos ({usersList.length})
          </h3>

          {loading && usersList.length === 0 ? (
            <div
              className="p-6 rounded-xl border border-black/20 text-center text-xs"
              style={innerStyle}
            >
              Cargando cuentas privilegiadas...
            </div>
          ) : usersList.length === 0 ? (
            <div
              className="p-6 rounded-xl border border-black/20 text-center text-xs opacity-80"
              style={innerStyle}
            >
              No hay cuentas privilegiadas registradas.
            </div>
          ) : (
            <div className="space-y-3">
              {usersList.map((u) => (
                <div
                  key={u.id}
                  className="p-4 rounded-xl border border-black/20 flex items-center justify-between gap-4 text-xs"
                  style={innerStyle}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">
                        {u.first_name} {u.last_name}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                          u.role === 'superadmin'
                            ? 'bg-purple-950/90 text-purple-200 border border-purple-700'
                            : 'bg-sky-950/90 text-sky-200 border border-sky-700'
                        }`}
                      >
                        {u.role}
                      </span>
                    </div>
                    <p className="opacity-80 truncate">
                      {u.email} · DNI: {u.dni || '-'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[11px] px-2.5 py-1 rounded-lg font-bold border ${
                        u.is_active
                          ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700'
                          : 'bg-rose-950/70 text-rose-300 border-rose-700'
                      }`}
                    >
                      {u.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditModal(u)}
                      className="p-2 rounded-lg border border-white/15 transition-opacity hover:opacity-90 cursor-pointer"
                      style={cardStyle}
                      title="Editar cuenta"
                    >
                      <Edit3 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Modal de Edición */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div
            className="border border-black/25 w-full max-w-md p-6 rounded-2xl relative space-y-4 text-xs"
            style={cardStyle}
          >
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg border border-white/15 cursor-pointer"
              style={innerStyle}
            >
              <X size={15} />
            </button>

            <h3 className="text-base font-black">Editar Cuenta Privilegiada</h3>

            <form onSubmit={handleUpdateUser} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase opacity-80 mb-1">Nombre</label>
                  <input
                    type="text"
                    required
                    value={editForm.first_name}
                    onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                    style={innerStyle}
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase opacity-80 mb-1">Apellido</label>
                  <input
                    type="text"
                    required
                    value={editForm.last_name}
                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                    style={innerStyle}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase opacity-80 mb-1">DNI</label>
                  <input
                    type="text"
                    required
                    value={editForm.dni}
                    onChange={(e) => setEditForm({ ...editForm, dni: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                    style={innerStyle}
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase opacity-80 mb-1">Rol</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                    style={innerStyle}
                  >
                    <option value="admin">admin</option>
                    <option value="superadmin">superadmin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase opacity-80 mb-1">Correo</label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                  style={innerStyle}
                />
              </div>

              <div>
                <label className="block font-bold uppercase opacity-80 mb-1">
                  Nueva contraseña (opcional)
                </label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="Dejar en blanco para mantener la actual"
                  className="w-full px-3 py-2 rounded-xl border border-white/15 text-xs"
                  style={innerStyle}
                />
              </div>

              <label className="inline-flex items-center gap-2 font-bold cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                />
                <span>Cuenta activa</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl font-bold border border-white/15 cursor-pointer"
                  style={innerStyle}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold cursor-pointer"
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