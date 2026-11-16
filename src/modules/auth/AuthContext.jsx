/**
 * @file AuthContext.jsx
 * @description Proveedor de contexto global para la gestión de sesión de usuarios en TrustLink.
 * Almacena el token JWT y los datos del usuario logueado en el estado de React y en localStorage.
 * @location /trustlink-web/src/modules/auth/AuthContext.jsx
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Al iniciar la aplicación, recupera la sesión almacenada en el localStorage si existe
  useEffect(() => {
    const storedToken = localStorage.getItem('trustlink_token');
    const storedUser = localStorage.getItem('trustlink_user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  // Función para iniciar sesión y guardar credenciales
  const login = (newToken, userData) => {
    localStorage.setItem('trustlink_token', newToken);
    localStorage.setItem('trustlink_user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  };

  // Función para cerrar sesión y limpiar el almacenamiento
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