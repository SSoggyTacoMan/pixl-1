"use server";

// Redirect flows that leave this site (Hack Club Auth address verification,
// profile resync, legal name, Hackatime connect). Each starts with a
// Bearer-authenticated POST that returns the URL to navigate to; the client
// then does window.location.assign() with it. No token ever goes in a URL.
import { z } from "zod";
import { config } from "@/app/_generated/config";
import { guardedAction, json } from "@/lib/guarded-action";
import { safeFlowUrl, } from "@/lib/safe-url";
import { safeNext } from "@/lib/auth-flow";

const flowInput = z.object({
  name: z.enum(["verify-address", "resync", "legal-name"]),
  returnTo: z.string().max(512).optional(),
});

function pickUrl(data: { url?: unknown }): { url: string | null } {
  return { url: safeFlowUrl(data?.url) };
}

export const startAuthFlow = guardedAction(
  "auth.flow",
  flowInput,
  (input) => ({
    method: "POST",
    path: `/auth/flow/${input.name}`,
    body: json({ redirect: `${config.urls.site}${safeNext(input.returnTo ?? "/account")}` }),
    target: `flow:${input.name}`,
  }),
  { pick: pickUrl },
);

export const connectHackatime = guardedAction(
  "hackatime.connect",
  z.object({ returnTo: z.string().max(512).optional() }),
  (input) => ({
    method: "POST",
    path: "/api/hackatime/connect",
    body: json({ redirect: `${config.urls.site}${safeNext(input.returnTo ?? "/projects")}` }),
  }),
  { pick: pickUrl },
);
