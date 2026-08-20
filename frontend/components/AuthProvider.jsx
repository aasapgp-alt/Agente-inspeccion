'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE_URL } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

    if (!storedToken) {
      setLoading(false);
      return;
    }

    setToken(storedToken);

    // AbortController para timeout máximo de 3 segundos al validar token
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      if (isMounted) setLoading(false);
    }, 3000);

    fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${storedToken}`
      },
      signal: controller.signal
    })
      .then(res => {
        if (res.ok) return res.json();
        localStorage.removeItem('auth_token');
        if (isMounted) {
          setToken(null);
          setUser(null);
        }
        return null;
      })
      .then(data => {
        if (data && isMounted) setUser(data);
      })
      .catch(err => {
        console.warn("Advertencia validando sesión:", err.message);
        localStorage.removeItem('auth_token');
        if (isMounted) {
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  const login = async (username, password) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });
    
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Error de inicio de sesión');
    }
    
    localStorage.setItem('auth_token', data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (err) {
        console.error("Error de logout en backend:", err);
      }
    }
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}
