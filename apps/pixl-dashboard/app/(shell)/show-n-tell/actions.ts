"use server";

// Show & Tell vote: one guarded call to POST /api/show-n-tell/entries/:id/vote.
// The server toggles (or moves) the vote and answers { voted }.
import { z } from "zod";
import { guardedAction } from "@/lib/guarded-action";

export const voteEntry = guardedAction(
  "show_n_tell.vote",
  z.object({ id: z.number().int().positive() }),
  (input) => ({ method: "POST", path: `/api/show-n-tell/entries/${input.id}/vote`, target: `stt_entry:${input.id}` }),
  { pick: (d: { voted?: boolean }) => ({ voted: d?.voted === true }) },
);
