// Cookie names and lifetimes, split out from lib/session.ts so proxy.ts and
// the route handlers can import them without pulling in next/headers.
//
// Outside local dev/test both cookies use the `__Host-` prefix: the browser
// then only accepts them when Secure, Path=/ and with no Domain, so a sibling
// *.hackclub.com subdomain can't plant or overwrite a session (cookie
// tossing). `next dev` runs on plain http://localhost where a Secure cookie
// would never come back, so there (and in bun test) the plain names are used.
// Renaming signs everyone out once; that's intended.

type Env = string | undefined;

/** true only for `next dev` and `bun test`; every other NODE_ENV is treated as production. */
export function isLocalEnv(env: Env = process.env.NODE_ENV): boolean {
  return env === "development" || env === "test";
}

export function cookieNames(env: Env = process.env.NODE_ENV) {
  const prefix = isLocalEnv(env) ? "" : "__Host-";
  return {
    session: `${prefix}pixl_session`,
    // Set by /api/auth/login right before the browser leaves for apps/server,
    // checked (and cleared) by /api/auth/callback. Holds `<state>.<next>` so
    // the post-login destination never travels through apps/server or the URL.
    loginState: `${prefix}pixl_login_state`,
  };
}

export const SESSION_COOKIE = cookieNames().session;
export const LOGIN_STATE_COOKIE = cookieNames().loginState;

// 14 days, matches apps/server's issueSessionToken expiry so the cookie
// never outlives the JWT it holds.
export const SESSION_MAX_AGE = 60 * 60 * 24 * 14;
export const LOGIN_STATE_MAX_AGE = 10 * 60;

// Secure whenever the __Host- names are in use (required by the prefix).
// Path=/ and no Domain attribute, also required by __Host-.
export function cookieBase(env: Env = process.env.NODE_ENV) {
  return {
    httpOnly: true,
    secure: !isLocalEnv(env),
    sameSite: "lax" as const,
    path: "/",
  };
}
