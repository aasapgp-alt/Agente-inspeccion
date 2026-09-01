'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE_URL } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedUser = localStorage.getItem('auth_user');
        return storedUser ? JSON.parse(storedUser) : null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [token, setToken] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token') || null;
    }
    return null;
  });

  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('auth_token');
      const storedUser = localStorage.getItem('auth_user');
      // Si ya hay token y usuario guardados, no bloquear la pantalla con spinner
      return !(storedToken && storedUser);
    }
    return true;
  });

  useEffect(() => {
    let isMounted = true;
    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const storedUser = typeof window !== 'undefined' ? localStorage.getItem('auth_user') : null;

    if (!storedToken) {
      if (isMounted) setLoading(false);
      return;
    }

    if (storedUser && !user) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed && isMounted) setUser(parsed);
      } catch (e) {
        console.warn('Error restaurando auth_user de localStorage:', e);
      }
    }

    // Validar token en segundo plano con el backend
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      if (isMounted) setLoading(false);
    }, 8000);

    fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${storedToken}`
      },
      signal: controller.signal
    })
      .then(res => {
        if (res.status === 401) {
          // Solo si el backend indica explícitamente token inválido o revocado
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
          if (isMounted) {
            setToken(null);
            setUser(null);
          }
          return null;
        }
        if (res.ok) return res.json();
        return null;
      })
      .then(data => {
        if (data && isMounted) {
          setUser(data);
          localStorage.setItem('auth_user', JSON.stringify(data));
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') {
          console.warn("Validación de sesión demoró más de 8s (manteniendo sesión local).");
        } else {
          console.warn("Validación de sesión offline / error de red (manteniendo sesión local):", err.message);
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
    if (data.user) {
      localStorage.setItem('auth_user', JSON.stringify(data.user));
    }
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
    localStorage.removeItem('auth_user');
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
