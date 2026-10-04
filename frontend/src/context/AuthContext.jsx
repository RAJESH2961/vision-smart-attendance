/**
 * Authentication Context — manages user state, JWT, and auth flow.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('access_token'));
  const [loading, setLoading] = useState(true);

  // On mount: verify stored token
  useEffect(() => {
    const verifyAuth = async () => {
      if (token) {
        try {
          const response = await authAPI.getMe();
          setUser(response.data);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };
    verifyAuth();
  }, [token]);

  const login = useCallback(async (identifier, password) => {
    const response = await authAPI.login(identifier, password);
    const { access_token } = response.data;
    localStorage.setItem('access_token', access_token);
    setToken(access_token);

    // Fetch user profile
    const meResponse = await authAPI.getMe();
    setUser(meResponse.data);
    localStorage.setItem('user', JSON.stringify(meResponse.data));

    return meResponse.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
