"use server";

import { z } from "zod";
import { guardedAction, json } from "@/lib/guarded-action";

export interface PlayerHit {
  id: string;
  display_name: string;
}

// Read-only lookup, but the browser can't call apps/server directly, so it
// goes through the same guarded wrapper (one GET endpoint).
export const searchPlayers = guardedAction(
  "reports.search_players",
  z.object({ q: z.string().trim().min(2).max(64) }),
  (input) => ({ method: "GET", path: `/api/reports/players?q=${encodeURIComponent(input.q)}` }),
  {
    pick: (data: { players?: PlayerHit[] }) =>
      (data.players ?? []).map((p) => ({ id: String(p.id), display_name: String(p.display_name ?? "") })),
  },
);

export const fileReport = guardedAction(
  "reports.create",
  z.object({
    targetId: z.string().trim().min(1).max(64),
    reason: z.string().trim().max(500),
    anonymous: z.boolean(),
  }),
  (input) => ({
    method: "POST",
    path: "/api/reports",
    body: json({ targetId: input.targetId, reason: input.reason, anonymous: input.anonymous }),
    target: `user:${input.targetId}`,
  }),
  { revalidate: ["/report"], pick: () => null },
);
