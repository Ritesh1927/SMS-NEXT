// Super Admin sessions are a separate, top-level auth track from the
// school-scoped AuthContext (different role, different login flow, never
// mixed with a schooladmin/teacher/parent/student session in the same tab).
const TOKEN_KEY = "sms_next_superadmin_token";
const USER_KEY = "sms_next_superadmin_user";

export interface SuperAdminUser {
  id: string;
  name: string;
  email: string;
  role: "superadmin";
}

export function getSuperAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getSuperAdminUser(): SuperAdminUser | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? (JSON.parse(stored) as SuperAdminUser) : null;
  } catch {
    return null;
  }
}

export function setSuperAdminAuth(token: string, user: SuperAdminUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSuperAdminAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
