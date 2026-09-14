import { verifyToken, type TokenPayload } from "@/lib/helpers";

// Reads the "Authorization: Bearer <token>" header on an API route request
// and returns the decoded payload, or null if missing/invalid — callers
// respond 401 themselves so each route controls its own error shape.
export function getAuthUser(req: Request): TokenPayload | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}
