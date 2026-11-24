/**
 * @file AuthContext.jsx
 * @description Proveedor de contexto global para la gestión de sesión de usuarios en TrustLink,
 * con limpieza automática de storage ante errores de autenticación.
 * @location /trustlink-web/src/modules/auth/AuthContext.jsx
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE } from '../../config/api';

const AuthContext = createContext(null);

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

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('trustlink_token') || null);
  const [user, setUser] = useState(() =>
    localStorage.getItem('trustlink_token') ? readStoredUser() : null
  );
  const loading = false;

  const lastSyncedTokenRef = useRef(null);

  const logout = useCallback(() => {
    localStorage.removeItem('trustlink_token');
    localStorage.removeItem('trustlink_user');
    lastSyncedTokenRef.current = null;
    setToken(null);
    setUser(null);
  }, []);

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

  useEffect(() => {
    if (token && lastSyncedTokenRef.current !== token) {
      lastSyncedTokenRef.current = token;
      refreshAccount(token);
    }
  }, [token, refreshAccount]);

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

export const useAuth = () => useContext(AuthContext);