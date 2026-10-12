import crypto from "crypto";
import { config } from "../config.generated.js";

// Single-use login codes for the code-exchange login (spec section 2,
// "Login without tokens in URLs"). The OAuth callback mints one and puts it
// on the redirect; the client trades it for a session token with
// POST /auth/exchange. A code is 32 random bytes, lives 60 s, works once, and
// is held only in memory.

export const LOGIN_CODE_TTL_MS = 60_000;
const MAX_PENDING_CODES = 10_000;

export interface LoginGrant {
  userId: string;
  displayName: string;
  slackId: string | null;
  isNew: boolean;
  needsLegalName: boolean;
}

export function createLoginCodeStore(now: () => number = Date.now) {
  const codes = new Map<string, LoginGrant & { expiresAt: number }>();

  function sweep(): void {
    const t = now();
    for (const [code, entry] of codes) if (entry.expiresAt <= t) codes.delete(code);
  }

  function issue(grant: LoginGrant): string {
    if (codes.size >= MAX_PENDING_CODES) sweep();
    // Still full of live codes: drop the oldest rather than grow unbounded.
    while (codes.size >= MAX_PENDING_CODES) {
      const oldest = codes.keys().next().value;
      if (oldest === undefined) break;
      codes.delete(oldest);
    }
    const code = crypto.randomBytes(32).toString("base64url");
    codes.set(code, { ...grant, expiresAt: now() + LOGIN_CODE_TTL_MS });
    return code;
  }

  // Deletes the code whatever happens next: a code is spent by the first
  // attempt to use it, valid or not.
  function redeem(code: string): LoginGrant | null {
    const entry = codes.get(code);
    if (!entry) return null;
    codes.delete(code);
    if (entry.expiresAt <= now()) return null;
    const { expiresAt: _expiresAt, ...grant } = entry;
    return grant;
  }

  return { issue, redeem, sweep, size: () => codes.size };
}

// Where a login (or any other OAuth round trip) may send the browser back
// to: an absolute https:// URL on the Pixl Dashboard or the game, nothing
// else. Returns the URL reduced to origin + path + query (no fragment, no
// credentials), or null.
export const REDIRECT_ORIGINS: readonly string[] = Object.freeze([config.urls.site, config.urls.play]);

export function checkRedirect(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2000) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!REDIRECT_ORIGINS.includes(url.origin)) return null;
  return `${url.origin}${url.pathname}${url.search}`;
}

// Where a LOGIN may send the browser back to, which is stricter than
// checkRedirect: the login redirect carries a live single-use code, so it
// may only land on the two pages that exchange it - the Pixl Dashboard's
// callback route and the game's root - exactly, with no other path, no
// query and no fragment. The re-auth flows (verify-address, resync,
// legal-name, Hackatime connect) carry no code and keep checkRedirect.
export const LOGIN_REDIRECTS: readonly string[] = Object.freeze([
  `${config.urls.site}/api/auth/callback`,
  `${config.urls.play}/`,
]);

export function checkLoginRedirect(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return LOGIN_REDIRECTS.includes(raw) ? raw : null;
}

// `state` is opaque to the server, the client binds it to a cookie or a
// local nonce and checks it when the browser comes back.
export const CLIENT_STATE_RE = /^[A-Za-z0-9._~-]{8,512}$/;
