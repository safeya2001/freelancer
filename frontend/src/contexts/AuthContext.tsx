import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import Cookies from 'js-cookie';
import { authApi, usersApi } from '@/services/api';
import { User, FullProfile } from '@/types';
import toast from 'react-hot-toast';
import { useRouter } from 'next/router';

interface AuthContextType {
  user: User | null;
  profile: FullProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  reloadAuth: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isFreelancer: boolean;
  isClient: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const adminRoles = ['admin', 'super_admin', 'finance_admin', 'support_admin'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Always attempt to load the user on mount.
  // The backend sets an httpOnly access_token cookie that js-cookie cannot read,
  // so we cannot gate this on Cookies.get('access_token').
  // If the user is not authenticated the API returns 401 and we clear state quietly.
  const loadUser = useCallback(async () => {
    // Mark loading so protected pages display a spinner rather than
    // briefly rendering as "unauthenticated" during the auth check.
    setLoading(true);
    try {
      // Step 1: verify the session — the authoritative auth check.
      // If /auth/me returns 401 we are not authenticated; clear state.
      const meRes = await authApi.me();
      setUser(meRes.data.data);

      // Step 2: fetch the full profile. A failure here (e.g. profile row
      // not yet created, or a transient error) must NOT break the session.
      try {
        const profileRes = await usersApi.getMyProfile();
        setProfile(profileRes.data.data);
      } catch {
        setProfile(null);
      }
    } catch {
      // /auth/me failed — not authenticated. Clear stale tokens.
      Cookies.remove('access_token');
      Cookies.remove('refresh_token');
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  async function login(email: string, password: string): Promise<string> {
    const res = await authApi.login({ email, password });
    const { access_token, refresh_token, role } = res.data.data;

    // Backend already sets httpOnly cookies on the response.
    // Mirror them in js-cookie so the request interceptor can attach
    // the Authorization header for environments that don't send httpOnly cookies.
    const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
    Cookies.set('access_token', access_token, {
      expires: 1 / 96,        // 15 minutes
      secure: isSecure,
      sameSite: 'strict',
    });
    if (refresh_token) {
      Cookies.set('refresh_token', refresh_token, {
        expires: 7,
        secure: isSecure,
        sameSite: 'strict',
      });
    }

    // Load user into global state. The profile fetch inside loadUser is
    // non-fatal — a profile error will not prevent the session from being set.
    await loadUser();

    // Return the role from the login response (already available without
    // waiting for a React re-render) so the caller can redirect immediately.
    return role as string;
  }

  async function register(data: any) {
    await authApi.register(data);
    const isDev = process.env.NODE_ENV !== 'production';
    toast.success(isDev ? 'Account created! You can log in now.' : 'Account created! Please verify your email.');
    router.push('/auth/login');
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch {
      // Backend unavailable — proceed with local cleanup anyway
    }
    Cookies.remove('access_token');
    Cookies.remove('refresh_token');
    setUser(null);
    setProfile(null);
    router.push('/');
  }

  // Exposed so the login page (which calls the API directly) can
  // trigger a state reload after receiving tokens.
  async function reloadAuth() {
    await loadUser();
  }

  async function refreshProfile() {
    const res = await usersApi.getMyProfile();
    setProfile(res.data.data);
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      login, register, logout, reloadAuth, refreshProfile,
      isAuthenticated: !!user,
      isAdmin: !!user && adminRoles.includes(user.role),
      isFreelancer: user?.role === 'freelancer',
      isClient: user?.role === 'client',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
