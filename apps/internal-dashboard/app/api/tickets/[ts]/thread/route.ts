import { NextResponse } from "next/server";
import { guardedRoute } from "@/lib/guard";
import { isMissingThread, ticketThread } from "@/lib/tickets";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ ts: string }> };

export const GET = guardedRoute<Ctx>("api.tickets.thread", "helper", async (_access, _req, { params }) => {
  const { ts } = await params;
  try {
    const messages = await ticketThread(ts);
    return NextResponse.json({ messages });
  } catch (e) {
    if (isMissingThread(e)) {
      return NextResponse.json({ error: "thread_not_found" }, { status: 404 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
});
