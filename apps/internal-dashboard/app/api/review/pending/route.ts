import { NextResponse } from "next/server";
import { guardedRoute } from "@/lib/guard";
import { countPendingReviews } from "@/lib/db";

export const dynamic = "force-dynamic";

export const GET = guardedRoute("api.review.pending", "reviewer", async () =>
  NextResponse.json({ count: await countPendingReviews() }),
);
