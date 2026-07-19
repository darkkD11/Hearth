import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { api } from '../lib/api';
import type { PublicUser, Server, LoginRequest, RegisterRequest } from '@hearth/shared';

interface AuthState {
  user: PublicUser | null;
  server: Server | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    server: null,
    token: localStorage.getItem('hearth_token'),
    isLoading: true,
    isAuthenticated: false,
  });

  // Verify token on mount
  useEffect(() => {
    const token = localStorage.getItem('hearth_token');
    if (!token) {
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }

    api
      .get<{ user: PublicUser; server: Server }>('/auth/me')
      .then(({ user, server }) => {
        setState({
          user,
          server,
          token,
          isLoading: false,
          isAuthenticated: true,
        });
      })
      .catch(() => {
        localStorage.removeItem('hearth_token');
        setState({
          user: null,
          server: null,
          token: null,
          isLoading: false,
          isAuthenticated: false,
        });
      });
  }, []);

  const login = useCallback(async (data: LoginRequest) => {
    const res = await api.post<{ token: string; user: PublicUser; server: Server }>(
      '/auth/login',
      data
    );
    localStorage.setItem('hearth_token', res.token);
    setState({
      user: res.user,
      server: res.server,
      token: res.token,
      isLoading: false,
      isAuthenticated: true,
    });
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    const res = await api.post<{ token: string; user: PublicUser; server: Server }>(
      '/auth/register',
      data
    );
    localStorage.setItem('hearth_token', res.token);
    setState({
      user: res.user,
      server: res.server,
      token: res.token,
      isLoading: false,
      isAuthenticated: true,
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('hearth_token');
    setState({
      user: null,
      server: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
    });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
