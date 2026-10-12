import { NextRequest, NextResponse } from "next/server";
import { sameOrigin, siteOrigin } from "@/lib/auth-flow";
import { serverFetch } from "@/lib/server-api-core";
import { verifySessionToken } from "@/lib/session";
import { SESSION_COOKIE, cookieBase, sessionCookiesToClear } from "@/lib/session-cookie";

// POST only, same-origin only: a cross-site form can't sign a player out.
export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers.get("origin"), req.nextUrl.origin)) {
    return NextResponse.json({ ok: false, error: "bad_origin" }, { status: 403 });
  }
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? verifySessionToken(token) : null;
  let revoked = false;
  if (token && session) {
    const r = await serverFetch("/auth/logout", { method: "POST", token });
    revoked = r.ok;
  }
  console.log(
    JSON.stringify({
      app: "pixl-dashboard",
      action: "auth.logout",
      userId: session?.userId ?? null,
      slackId: session?.slackId ?? null,
      result: revoked ? "ok" : "error",
      at: new Date().toISOString(),
    }),
  );
  const res = NextResponse.redirect(new URL("/", siteOrigin(req.nextUrl.origin)), 303);
  // The legacy non-__Host- pixl_session too (see sessionCookiesToClear).
  for (const name of sessionCookiesToClear()) res.cookies.set(name, "", { ...cookieBase(), maxAge: 0 });
  res.headers.set("cache-control", "no-store");
  return res;
}
