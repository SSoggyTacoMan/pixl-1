import { NextResponse } from "next/server";
import { clearSessionCookie, getSession } from "@/lib/session";
import { audit } from "@/lib/audit";

export async function POST(req: Request) {
  const session = await getSession();
  await clearSessionCookie();
  await audit({ action: "auth.logout", result: "ok", slackId: session?.slackId ?? null }, req);
  return NextResponse.redirect(`${process.env.BASE_URL}/login`, 303);
}
