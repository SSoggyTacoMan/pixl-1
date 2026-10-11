import { NextResponse } from "next/server";
import { guardedRoute } from "@/lib/guard";
import { ticketReply } from "@/lib/tickets";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ ts: string }> };

export const POST = guardedRoute<Ctx>("api.tickets.reply", "helper", async (access, req, { params }) => {
  const { ts } = await params;
  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text = body.text?.trim();
  if (!text) return NextResponse.json({ error: "Text is required" }, { status: 400 });
  try {
    await ticketReply(ts, text, {
      slackId: access.session.slackId,
      username: access.session.name,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
});
