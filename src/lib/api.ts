// Thin fetch wrapper for our own Next.js API routes (same-origin, so no
// base URL or auth-header plumbing is needed the way SMS-FRONTEND's axios
// client needed for its separate Express backend).
export async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Could not reach the server. Please check your connection and try again.");
  }

  const json = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok || json.success === false) {
    throw new Error((json.message as string) || "Something went wrong.");
  }
  return json as T;
}

// GET for our own authenticated API routes — token goes in the Authorization
// header rather than a cookie since there's no server session to attach it
// to; the caller reads it from AuthContext/localStorage.
export async function apiGet<T = unknown>(path: string, token: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error("Could not reach the server. Please check your connection and try again.");
  }

  const json = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok || json.success === false) {
    throw new Error((json.message as string) || "Something went wrong.");
  }
  return json as T;
}
