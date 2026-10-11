// The cookie holds apps/server's own JWT (set by /api/auth/callback after the
// code exchange). It must decode with the exact same secret and payload shape
// as apps/server/src/auth/session.ts's verifySessionToken, or a legitimate
// session reads as signed out. The secret is read lazily so tests can set
// JWT_SECRET before the first call rather than before import.
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./session-cookie";

export interface SessionPayload {
  userId: string;
  displayName: string;
  /** Present only if apps/server includes it in the JWT; used for logging. */
  slackId?: string;
}

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) {
    console.error("JWT_SECRET is not set - all sessions will read as signed out");
    throw new Error("JWT_SECRET is not set");
  }
  return s;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, secret(), { algorithms: ["HS256"] });
    if (
      typeof decoded !== "object" ||
      typeof decoded.userId !== "string" ||
      typeof decoded.displayName !== "string"
    ) {
      return null;
    }
    const out: SessionPayload = { userId: decoded.userId, displayName: decoded.displayName };
    if (typeof decoded.slackId === "string") out.slackId = decoded.slackId;
    return out;
  } catch {
    return null;
  }
}

/** Raw token, only if it verifies. A forged or expired cookie reads as none. */
export async function getToken(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value ?? null;
  return token && verifySessionToken(token) ? token : null;
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

/** Token and session together, verified once. */
export async function getAuth(): Promise<{ token: string; session: SessionPayload } | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = verifySessionToken(token);
  return session ? { token, session } : null;
}
