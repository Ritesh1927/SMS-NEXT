"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { apiPost } from "@/lib/api";

export type UserRole = "schooladmin" | "teacher" | "parent" | "student";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  schoolName?: string;
  schoolCode?: string;
  school?: string;
  teacherId?: string;
  permissions?: unknown;
  subjects?: string[];
  classes?: string[];
  classTeacherOf?: string[];
  children?: Array<{ _id: string; name: string; studentId: string; class: string; section: string }>;
}

export interface MatchedSchool {
  schoolId: string;
  schoolName: string;
  role: string;
  userId: string;
  userName: string;
}

interface LoginOutcome {
  success: boolean;
  error?: string;
  schools?: MatchedSchool[];
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<LoginOutcome>;
  loginToSchool: (email: string, password: string, role: string, schoolId: string) => Promise<LoginOutcome>;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const TOKEN_KEY = "sms_next_token";
const USER_KEY = "sms_next_user";

const AuthContext = createContext<AuthContextType | null>(null);

interface LoginApiResponse {
  single: boolean;
  token?: string;
  user?: AuthUser;
  schools?: MatchedSchool[];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  // Starts true and flips false after the localStorage read below, so
  // route guards can wait for it instead of redirecting during the first
  // (unauthenticated-looking) server-rendered paint.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: see the `loading` comment above, this must run post-hydration.
      if (stored) setUser(JSON.parse(stored));
    } catch {
      // Corrupt or inaccessible storage — treat as logged out.
    }
    setLoading(false);
  }, []);

  const setAuth = useCallback((token: string, apiUser: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(apiUser));
    setUser(apiUser);
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginOutcome> => {
      try {
        const res = await apiPost<LoginApiResponse>("/auth/login", { email, password });
        if (res.single && res.token && res.user) {
          setAuth(res.token, res.user);
          return { success: true };
        }
        if (res.schools?.length) {
          return { success: false, schools: res.schools };
        }
        return { success: false, error: "Login failed." };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Login failed." };
      }
    },
    [setAuth],
  );

  const loginToSchool = useCallback(
    async (email: string, password: string, role: string, schoolId: string): Promise<LoginOutcome> => {
      try {
        const res = await apiPost<LoginApiResponse>("/auth/login", { email, password, role, schoolId });
        if (res.single && res.token && res.user) {
          setAuth(res.token, res.user);
          return { success: true };
        }
        return { success: false, error: "Login failed." };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Login failed." };
      }
    },
    [setAuth],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, login, loginToSchool, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
