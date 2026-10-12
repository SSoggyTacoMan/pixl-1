// What /api/auth/expired does once the shell layout has seen apps/server
// reject a cookie that still verifies locally (revoked session, banned
// player). Pure so it's unit tested; the route handler is a thin wrapper.
//
// The route is a GET (the layout reaches it via redirect()), so a cross-site
// link can hit it. That's harmless by construction: it only clears the cookie
// after asking apps/server itself, and only if the server rejects the session.

/**
 * apps/server's two "this session is dead" answers: 401 (bad or revoked
 * token, auth/revocation.ts) and 403 { error: "banned" } (moderation.ts).
 * Any other 403 is a per-route permission error, not a dead session.
 */
export function sessionRejected(status: number, error: string | null | undefined): boolean {
  return status === 401 || (status === 403 && error === "banned");
}

export type ExpiryDecision = { clear: boolean; dest: "next" | "home" };

/**
 * @param locallyValid the cookie still verifies against JWT_SECRET
 * @param status       apps/server's status for an authenticated read (0 = unreachable)
 * @param error        the error code from that response, if any
 */
export function decideExpiry(locallyValid: boolean, status: number, error?: string | null): ExpiryDecision {
  if (!locallyValid || sessionRejected(status, error)) return { clear: true, dest: "next" };
  // Server accepts the session again (a blip): carry on where they were.
  if (status >= 200 && status < 300) return { clear: false, dest: "next" };
  // Anything else (5xx, unreachable): don't sign anyone out over an outage,
  // and don't bounce back into the shell, which could loop.
  return { clear: false, dest: "home" };
}

export const EXPIRED_PATH = "/api/auth/expired";

/** Where the shell layout sends a revoked session, keeping the page to return to. */
export function expiredUrl(next: string): string {
  return `${EXPIRED_PATH}?next=${encodeURIComponent(next)}`;
}
