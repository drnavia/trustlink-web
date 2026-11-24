/**
 * @file AuthContext.jsx
 * @description Proveedor de contexto global para la gestión de sesión de usuarios en TrustLink,
 * con limpieza automática de storage ante errores de autenticación.
 * @location /trustlink-web/src/modules/auth/AuthContext.jsx
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE } from '../../config/api'; // Verificá la ruta relativa hacia src/config/api.js

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('trustlink_token');
    const storedUser = localStorage.getItem('trustlink_user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        logout();
      }
    }
    setLoading(false);
  }, []);

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

  const logout = () => {
    localStorage.removeItem('trustlink_token');
    localStorage.removeItem('trustlink_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);