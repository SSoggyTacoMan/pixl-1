import { NextResponse } from "next/server";
import { guardedRoute } from "@/lib/guard";
import { listTickets } from "@/lib/tickets";

export const dynamic = "force-dynamic";

export const GET = guardedRoute("api.tickets.list", "helper", async (_access, req) => {
  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const status =
    statusParam === "closed" || statusParam === "all" ? statusParam : "open";
  const search = searchParams.get("search") ?? "";
  const tickets = await listTickets(status, search);
  return NextResponse.json({ tickets });
});
