/**
 * @file AuthContext.jsx
 * @description Proveedor de contexto global para la gestión de sesión de usuarios en TrustLink,
 * con limpieza automática de storage ante errores de autenticación.
 * @location /trustlink-web/src/modules/auth/AuthContext.jsx
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE } from '../../config/api';

// Contexto React compartido para el estado de sesión y las acciones de autenticación
const AuthContext = createContext(null);

/**
 * Lee y parsea el perfil del usuario almacenado en localStorage.
 * Si el contenido está corrupto, limpia el almacenamiento para evitar sesiones inconsistentes.
 * @returns {object|null} Objeto de usuario persistido o null si no existe o es inválido.
 */
function readStoredUser() {
  try {
    const raw = localStorage.getItem('trustlink_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem('trustlink_token');
    localStorage.removeItem('trustlink_user');
    return null;
  }
}

/**
 * Proveedor global de autenticación que sincroniza token y perfil de usuario
 * con localStorage y rehidrata la cuenta contra el backend al detectar un token nuevo.
 * @param {{ children: React.ReactNode }} props
 */
export const AuthProvider = ({ children }) => {
  // Hidratación inicial desde localStorage: solo se carga el usuario si existe un token vigente
  const [token, setToken] = useState(() => localStorage.getItem('trustlink_token') || null);
  const [user, setUser] = useState(() =>
    localStorage.getItem('trustlink_token') ? readStoredUser() : null
  );
  const loading = false;

  // Evita sincronizar más de una vez el mismo token contra /api/v1/account/me
  const lastSyncedTokenRef = useRef(null);

  /**
   * Cierra la sesión limpiando credenciales en localStorage y restableciendo el estado en memoria.
   */
  const logout = useCallback(() => {
    localStorage.removeItem('trustlink_token');
    localStorage.removeItem('trustlink_user');
    lastSyncedTokenRef.current = null;
    setToken(null);
    setUser(null);
  }, []);

  /**
   * Fusiona datos parciales o completos en el perfil de usuario activo y persiste en localStorage.
   * Si se recibe un nuevo JWT (por ejemplo tras actualizar rol o portal), también rota el token.
   * @param {object|null} partialOrFullUser - Campos actualizados del usuario.
   * @param {string|null} [nextToken=null] - Nuevo token JWT opcional emitido por el backend.
   */
  const updateUser = useCallback((partialOrFullUser, nextToken = null) => {
    if (nextToken && typeof nextToken === 'string') {
      localStorage.setItem('trustlink_token', nextToken);
      lastSyncedTokenRef.current = nextToken;
      setToken(nextToken);
    }
    if (!partialOrFullUser) return;
    setUser((prev) => {
      const merged = { ...(prev || {}), ...partialOrFullUser };
      localStorage.setItem('trustlink_user', JSON.stringify(merged));
      return merged;
    });
  }, []);

  /**
   * Consulta `/api/v1/account/me` para refrescar permisos, portales y datos del usuario.
   * Cierra la sesión automáticamente si el backend responde 401 o 403.
   * @param {string|null} [explicitToken=null] - Token explícito a utilizar en lugar del guardado.
   * @returns {Promise<object|null>} Respuesta del servidor o null ante ausencia de token o error.
   */
  const refreshAccount = useCallback(
    async (explicitToken = null) => {
      const activeToken = explicitToken || localStorage.getItem('trustlink_token');
      if (!activeToken) return null;
      try {
        const res = await fetch(`${API_BASE}/api/v1/account/me`, {
          headers: { Authorization: `Bearer ${activeToken}` },
        });
        if (res.status === 401 || res.status === 403) {
          logout();
          return null;
        }
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.account) {
          updateUser(data.account);
          return data;
        }
      } catch (err) {
        console.warn('No se pudo sincronizar Mi Cuenta al iniciar:', err);
      }
      return null;
    },
    [logout, updateUser]
  );

  // Sincroniza automáticamente la cuenta con el backend cada vez que cambia el token activo
  useEffect(() => {
    if (token && lastSyncedTokenRef.current !== token) {
      lastSyncedTokenRef.current = token;
      refreshAccount(token);
    }
  }, [token, refreshAccount]);

  /**
   * Autentica al usuario contra `/api/v1/auth/login`, persiste token y perfil en localStorage
   * y limpia cualquier sesión previa si las credenciales fallan o ocurre un error de red.
   * @param {string} email - Correo electrónico del usuario.
   * @param {string} password - Contraseña en texto plano enviada por HTTPS/POST.
   * @returns {Promise<{ ok: boolean, user?: object, token?: string, error?: string }>}
   */
  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.token && data.user) {
        localStorage.setItem('trustlink_token', data.token);
        localStorage.setItem('trustlink_user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return { ok: true, user: data.user, token: data.token };
      } else {
        logout(); // Limpiar rastro anterior si falla
        return {
          ok: false,
          error: data.error || 'Credenciales inválidas o cuenta inactiva en la base de datos.'
        };
      }
    } catch (error) {
      console.error('Error en contexto de login:', error);
      logout();
      return {
        ok: false,
        error: 'Error de conexión con el servidor de TrustLink.'
      };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        updateUser,
        refreshAccount,
        isAuthenticated: !!token,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook de acceso al contexto global de autenticación (usuario, token y acciones de sesión).
 * @returns {object|null}
 */
export const useAuth = () => useContext(AuthContext);