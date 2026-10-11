// Pure pieces of the login code flow (see the hardened relaunch spec, section
// 2 "Login without tokens in URLs"). Route handlers in app/api/auth/* are thin
// wrappers around these so the security-relevant logic is unit tested.
import { randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "@/app/_generated/config";

export const DEFAULT_NEXT = "/dashboard";
export const CALLBACK_PATH = "/api/auth/callback";

/**
 * Only same-site relative paths survive: "/x", never "//host", "/\host",
 * "https://...", or anything with control characters. Everything else falls
 * back to /dashboard so an attacker-built login link can't bounce the player
 * off-site after a real login.
 */
export function safeNext(next: string | null | undefined): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return DEFAULT_NEXT;
  if (!next.startsWith("/") || next.startsWith("//")) return DEFAULT_NEXT;
  if (/[\u0000-\u001f\\]/.test(next)) return DEFAULT_NEXT;
  try {
    const u = new URL(next, "https://pixl.invalid");
    if (u.origin !== "https://pixl.invalid") return DEFAULT_NEXT;
    // Never send someone back into the auth routes themselves.
    if (u.pathname.startsWith("/api/")) return DEFAULT_NEXT;
    return u.pathname + u.search + u.hash;
  } catch {
    return DEFAULT_NEXT;
  }
}

export function newState(): string {
  return randomBytes(32).toString("base64url");
}

/** Cookie value: `<state>.<base64url(next)>`, both parts URL-safe. */
export function encodeLoginState(state: string, next: string): string {
  return `${state}.${Buffer.from(safeNext(next), "utf8").toString("base64url")}`;
}

export function decodeLoginState(raw: string | null | undefined): { state: string; next: string } | null {
  if (!raw) return null;
  const dot = raw.indexOf(".");
  if (dot <= 0) return null;
  const state = raw.slice(0, dot);
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(state)) return null;
  let next = DEFAULT_NEXT;
  try {
    next = safeNext(Buffer.from(raw.slice(dot + 1), "base64url").toString("utf8"));
  } catch {
    next = DEFAULT_NEXT;
  }
  return { state, next };
}

/** Constant-time comparison; different lengths are simply unequal. */
export function statesMatch(expected: string, supplied: string): boolean {
  if (typeof expected !== "string" || typeof supplied !== "string") return false;
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(supplied, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function serverLoginUrl(state: string): string {
  const redirect = `${config.urls.site}${CALLBACK_PATH}`;
  return `${config.urls.server}/auth/hackclub?redirect=${encodeURIComponent(redirect)}&state=${encodeURIComponent(state)}`;
}

export interface ExchangeResponse {
  token: string;
  user: { id: string; displayName: string; slackId: string | null };
  isNew: boolean;
  needsLegalName: boolean;
}

export type CallbackError = "state_mismatch" | "missing_code" | "exchange_failed";

export type CallbackOutcome =
  | { kind: "session"; token: string; next: string; user: ExchangeResponse["user"]; needsLegalName: boolean }
  | { kind: "error"; error: CallbackError };

/**
 * Checks the state against the cookie BEFORE touching the code, then
 * exchanges the code. `exchange` performs the server-to-server
 * POST /auth/exchange with the service key.
 */
export async function resolveCallback(
  params: { code: string | null; state: string | null; cookie: string | null | undefined },
  exchange: (code: string) => Promise<ExchangeResponse | null>,
): Promise<CallbackOutcome> {
  const saved = decodeLoginState(params.cookie);
  if (!saved || !params.state || !statesMatch(saved.state, params.state)) {
    return { kind: "error", error: "state_mismatch" };
  }
  if (!params.code || params.code.length > 512) return { kind: "error", error: "missing_code" };
  const out = await exchange(params.code);
  if (!out || typeof out.token !== "string" || !out.token || !out.user || typeof out.user.id !== "string") {
    return { kind: "error", error: "exchange_failed" };
  }
  return {
    kind: "session",
    token: out.token,
    next: saved.next,
    user: out.user,
    needsLegalName: out.needsLegalName === true,
  };
}

/**
 * Base for redirects this app issues. Production always uses the canonical
 * site origin (the request's own host can be an internal cluster hop); dev
 * uses whatever host `next dev` is on.
 */
export function siteOrigin(requestOrigin: string): string {
  return process.env.NODE_ENV === "production" ? config.urls.site : requestOrigin;
}

/** Same-origin check for state-changing route handlers (logout). */
export function sameOrigin(originHeader: string | null, requestOrigin: string): boolean {
  if (!originHeader) return false;
  return originHeader === config.urls.site || originHeader === requestOrigin;
}
