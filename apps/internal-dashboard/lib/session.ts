import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "pixl_admin";
const MAX_AGE = 60 * 60 * 24 * 7;

export interface AdminSession {
  slackId: string;
  name: string;
  exp: number;
}

// The HMAC key for staff sessions. A short key is brute-forceable offline from
// any one captured cookie, which would let someone mint an owner session, so
// anything under 32 characters is refused outright.
export const MIN_SESSION_SECRET_LENGTH = 32;

export function validSessionSecret(s: string | undefined): string {
  if (!s) throw new Error("SESSION_SECRET is not set");
  if (s.length < MIN_SESSION_SECRET_LENGTH)
    throw new Error(`SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters`);
  return s;
}

function secret(): string {
  return validSessionSecret(process.env.SESSION_SECRET);
}

// Cookies are Secure everywhere except local dev. Keyed off NODE_ENV rather
// than parsing BASE_URL, so a missing/odd BASE_URL in production can't quietly
// send the staff session over plain HTTP.
export function secureCookies(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return nodeEnv !== "development" && nodeEnv !== "test";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function encodeSession(session: AdminSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(raw: string | undefined): AdminSession | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    ) as AdminSession;
    if (session.exp < Date.now() / 1000) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<AdminSession | null> {
  const jar = await cookies();
  return decodeSession(jar.get(COOKIE)?.value);
}

export async function setSessionCookie(slackId: string, name: string) {
  const jar = await cookies();
  jar.set(COOKIE, encodeSession({ slackId, name, exp: Date.now() / 1000 + MAX_AGE }), {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies(),
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

