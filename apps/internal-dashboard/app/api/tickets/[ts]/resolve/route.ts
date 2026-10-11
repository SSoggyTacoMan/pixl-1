import { NextResponse } from "next/server";
import { guardedRoute } from "@/lib/guard";
import { isValidTicketTs } from "@/lib/requestGuards";
import { resolveTicketFromDash } from "@/lib/tickets";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ ts: string }> };

export const POST = guardedRoute<Ctx>("api.tickets.resolve", "helper", async (access, _req, { params }) => {
  const { ts } = await params;
  if (!isValidTicketTs(ts)) return NextResponse.json({ error: "invalid ticket id" }, { status: 400 });
  const result = await resolveTicketFromDash(ts, {
    slackId: access.session.slackId,
    username: access.session.name,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true, alreadyClosed: result.alreadyClosed ?? false });
});
