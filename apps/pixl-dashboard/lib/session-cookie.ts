// Cookie names and lifetimes, split out from lib/session.ts so proxy.ts and
// the route handlers can import them without pulling in next/headers.

export const SESSION_COOKIE = "pixl_session";

// Set by /api/auth/login right before the browser leaves for apps/server,
// checked (and cleared) by /api/auth/callback. Holds `<state>.<next>` so the
// post-login destination never travels through apps/server or the URL.
export const LOGIN_STATE_COOKIE = "pixl_login_state";

// 14 days, matches apps/server's issueSessionToken expiry so the cookie
// never outlives the JWT it holds.
export const SESSION_MAX_AGE = 60 * 60 * 24 * 14;
export const LOGIN_STATE_MAX_AGE = 10 * 60;

// Secure is unconditional in production. In `next dev` over plain
// http://localhost a Secure cookie would never be sent back, so dev is the
// one place it's off.
export function cookieBase() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}
