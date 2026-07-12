import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, getToken, setAuth as storeAuth, getUser, clearAuth as clearStoredAuth } from '../api';
import type { AuthUser, AuthResp, LoginReq, UserRole } from '../types';
import { disconnectRealtime, reconnectRealtime } from '@/src/realtime/socket';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: UserRole, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const t = await getToken();
    if (t) {
      setToken(t);
      try {
        const u = await api<AuthUser>('/auth/me');
        setUser(u);
        await reconnectRealtime();
      } catch {
        await clearStoredAuth();
        disconnectRealtime();
        setToken(null);
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<AuthResp>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password } satisfies LoginReq),
    });
    await storeAuth(res.token, res.user);
    setToken(res.token);
    setUser(res.user);
    await reconnectRealtime();
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, role: UserRole, phone?: string) => {
    const res = await api<AuthResp>('/auth/register', {
      method: 'POST', body: JSON.stringify({ name, email, password, role, phone }),
    });
    await storeAuth(res.token, res.user);
    setToken(res.token);
    setUser(res.user);
    await reconnectRealtime();
  }, []);

  const logout = useCallback(async () => {
    await clearStoredAuth();
    disconnectRealtime();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
