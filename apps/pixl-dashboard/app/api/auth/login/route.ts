import { NextRequest, NextResponse } from "next/server";
import { encodeLoginState, newState, safeNext, serverLoginUrl } from "@/lib/auth-flow";
import { LOGIN_STATE_COOKIE, LOGIN_STATE_MAX_AGE, cookieBase } from "@/lib/session-cookie";

// The only place a login starts. Binds a random `state` to this browser with
// an httpOnly cookie, then sends it to apps/server's Hack Club Auth entry.
// apps/server echoes `state` back to /api/auth/callback untouched, which
// refuses to exchange the code unless the two match (login CSRF guard).
export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const state = newState();
  const res = NextResponse.redirect(serverLoginUrl(state), 303);
  res.cookies.set(LOGIN_STATE_COOKIE, encodeLoginState(state, next), {
    ...cookieBase(),
    maxAge: LOGIN_STATE_MAX_AGE,
  });
  res.headers.set("cache-control", "no-store");
  return res;
}
