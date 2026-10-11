"use server";

import { z } from "zod";
import { guardedAction, json } from "@/lib/guarded-action";

// POST /api/referral/apply (session) with { code }.
export const applyReferral = guardedAction(
  "referral.apply",
  z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,6}$/) }),
  (input) => ({ method: "POST", path: "/api/referral/apply", body: json({ code: input.code }), target: "referral" }),
  {
    revalidate: ["/refers"],
    pick: (d: { referrerName?: unknown }) => ({
      referrerName: typeof d?.referrerName === "string" ? d.referrerName.slice(0, 80) : null,
    }),
  },
);
