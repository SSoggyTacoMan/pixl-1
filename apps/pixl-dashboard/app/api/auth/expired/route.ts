import { NextRequest, NextResponse } from "next/server";
import { safeNext, siteOrigin } from "@/lib/auth-flow";
import { serverFetch } from "@/lib/server-api-core";
import { verifySessionToken } from "@/lib/session";
import { SESSION_COOKIE, cookieBase } from "@/lib/session-cookie";
import { decideExpiry } from "@/lib/session-expiry";

// The shell layout redirects here when apps/server rejects a cookie that
// still verifies locally (401 revoked, 403 banned). Server Components can't
// set cookies, so this route clears it, then sends the player back to the
// page they asked for, which now renders the signed-out Gate.
export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? verifySessionToken(token) : null;
  let status = 0;
  let error: string | null = null;
  if (token && session) {
    const r = await serverFetch("/api/profile/wallet", { token });
    status = r.status;
    error = r.ok ? null : r.error;
  }
  const decision = decideExpiry(!!session, status, error);
  const dest = decision.dest === "next" ? safeNext(req.nextUrl.searchParams.get("next")) : "/";
  const res = NextResponse.redirect(new URL(dest, siteOrigin(req.nextUrl.origin)), 303);
  if (token && decision.clear) res.cookies.set(SESSION_COOKIE, "", { ...cookieBase(), maxAge: 0 });
  res.headers.set("cache-control", "no-store");
  console.log(
    JSON.stringify({
      app: "pixl-dashboard",
      action: "auth.expired",
      userId: session?.userId ?? null,
      slackId: session?.slackId ?? null,
      result: decision.clear ? "ok" : "denied",
      status,
      at: new Date().toISOString(),
    }),
  );
  return res;
}
