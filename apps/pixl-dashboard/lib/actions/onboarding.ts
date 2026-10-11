"use server";

// Cross-app onboarding counter shared with the game's first-run guide
// (0 = new, 1 = game intro done, 2 = fully onboarded). apps/server keeps it
// forward-only, so a stale tab can never rewind a player.
import { z } from "zod";
import { guardedAction, json } from "@/lib/guarded-action";

export const setOnboardingStep = guardedAction(
  "profile.onboarding",
  z.object({ step: z.number().int().min(0).max(2) }),
  (input) => ({ method: "POST", path: "/api/profile/onboarding", body: json({ step: input.step }) }),
  { pick: (d: { step?: unknown; done?: unknown }) => ({ step: Number(d?.step) || 0, done: d?.done === true }) },
);
