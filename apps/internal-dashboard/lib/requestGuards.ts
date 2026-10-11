import { createHash, timingSafeEqual } from "crypto";

// Pure request checks for route handlers (no Next, no DB imports) so they are
// unit-testable. Wired up in lib/guard.ts and the individual routes.

// A Slack message ts: 10 digits, a dot, 6 digits. Ticket routes take this from
// the URL and splice it into calls to Pixorpheus/Slack, so anything else is
// rejected before it gets near a URL or query.
const TICKET_TS = /^\d{10}\.\d{6}$/;

export function isValidTicketTs(ts: unknown): ts is string {
  return typeof ts === "string" && TICKET_TS.test(ts);
}

export function originOf(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface CsrfOptions {
  // The handler parses a JSON body: also insist on Content-Type
  // application/json, which a cross-site <form> can't send without a preflight.
  requireJson?: boolean;
}

// CSRF check for cookie-authenticated route handlers. The session cookie is
// SameSite=Lax, which still lets some cross-site requests through (top-level
// POST navigations in older browsers, same-site subdomains), so every
// state-changing request must also carry an Origin header equal to BASE_URL's
// origin. A missing Origin is rejected: every browser we support sends it on
// POST/PUT/PATCH/DELETE, and non-browser clients have no business here.
// Returns null when the request may proceed, else a short reason.
export function csrfRejection(
  method: string,
  get: (name: string) => string | null,
  baseUrl: string | undefined,
  opts: CsrfOptions = {},
): string | null {
  if (SAFE_METHODS.has(method.toUpperCase())) return null;
  const expected = originOf(baseUrl);
  if (!expected) return "server_misconfigured";
  const origin = get("origin");
  if (!origin || origin === "null" || origin !== expected) return "bad_origin";
  if (opts.requireJson) {
    const ct = (get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (ct !== "application/json") return "bad_content_type";
  }
  return null;
}

// Constant-time comparison of a presented secret (e.g. the cron
// "Authorization: Bearer ..." header) against the expected one. Both sides are
// hashed first so the buffers handed to timingSafeEqual are always the same
// length, and the length of the real secret doesn't leak through an early exit.
export function secretsEqual(presented: string | null | undefined, expected: string): boolean {
  if (typeof presented !== "string" || !expected) return false;
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function bearerMatches(authorization: string | null, secret: string): boolean {
  return secretsEqual(authorization, `Bearer ${secret}`);
}
