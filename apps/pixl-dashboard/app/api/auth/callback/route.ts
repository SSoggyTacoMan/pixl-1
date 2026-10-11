import { NextRequest, NextResponse } from "next/server";
import { resolveCallback, siteOrigin, type ExchangeResponse } from "@/lib/auth-flow";
import { serverFetch } from "@/lib/server-api-core";
import { LOGIN_STATE_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE, cookieBase } from "@/lib/session-cookie";

async function exchange(code: string): Promise<ExchangeResponse | null> {
  const serviceKey = process.env.SERVICE_KEY_PIXL_DASHBOARD;
  if (!serviceKey) {
    console.error("SERVICE_KEY_PIXL_DASHBOARD is not set - logins cannot complete");
    return null;
  }
  const r = await serverFetch<ExchangeResponse>("/auth/exchange", {
    method: "POST",
    serviceKey,
    body: { kind: "json", value: { code } },
  });
  return r.ok ? r.data : null;
}

export async function GET(req: NextRequest) {
  const outcome = await resolveCallback(
    {
      code: req.nextUrl.searchParams.get("code"),
      state: req.nextUrl.searchParams.get("state"),
      cookie: req.cookies.get(LOGIN_STATE_COOKIE)?.value,
    },
    exchange,
  );
  const origin = siteOrigin(req.nextUrl.origin);

  // A brand-new player still missing a legal name goes to /account first,
  // where the legal-name flow lives.
  const dest =
    outcome.kind === "session"
      ? outcome.needsLegalName
        ? "/account?needs=legal-name"
        : outcome.next
      : `/login?error=${outcome.error}`;
  const res = NextResponse.redirect(new URL(dest, origin), 303);

  // Single use either way: a replayed callback URL finds no state cookie.
  res.cookies.set(LOGIN_STATE_COOKIE, "", { ...cookieBase(), maxAge: 0 });
  res.headers.set("cache-control", "no-store");
  res.headers.set("referrer-policy", "no-referrer");

  console.log(
    JSON.stringify({
      app: "pixl-dashboard",
      action: "auth.callback",
      userId: outcome.kind === "session" ? outcome.user.id : null,
      slackId: outcome.kind === "session" ? (outcome.user.slackId ?? null) : null,
      result: outcome.kind === "session" ? "ok" : "denied",
      error: outcome.kind === "error" ? outcome.error : null,
      at: new Date().toISOString(),
    }),
  );

  if (outcome.kind === "session") {
    res.cookies.set(SESSION_COOKIE, outcome.token, { ...cookieBase(), maxAge: SESSION_MAX_AGE });
  }
  return res;
}
