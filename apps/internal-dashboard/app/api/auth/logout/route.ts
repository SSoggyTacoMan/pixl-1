import { NextResponse } from "next/server";
import { clearSessionCookie, getSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import { csrfRejection } from "@/lib/requestGuards";

export async function POST(req: Request) {
  const session = await getSession();
  // Cross-site logout (CSRF) is refused: only our own pages may post here.
  const csrf = csrfRejection(req.method, (n) => req.headers.get(n), process.env.BASE_URL);
  if (csrf) {
    await audit({ action: "auth.logout", result: "denied", slackId: session?.slackId ?? null, meta: { csrf } }, req);
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await clearSessionCookie();
  await audit({ action: "auth.logout", result: "ok", slackId: session?.slackId ?? null }, req);
  return NextResponse.redirect(`${process.env.BASE_URL}/login`, 303);
}
