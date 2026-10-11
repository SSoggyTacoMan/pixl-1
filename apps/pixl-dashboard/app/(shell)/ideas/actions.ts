"use server";

// Idea board mutations. Each is one guarded call to one apps/server endpoint
// (apps/server/src/routes/ideas.ts).
import { z } from "zod";
import { guardedAction, json } from "@/lib/guarded-action";
import { ROLES } from "./ideas-lib";

const id = z.number().int().positive();
const PATHS = ["/ideas", "/ideas/top"];

export const postIdea = guardedAction(
  "ideas.create",
  z.object({
    title: z.string().trim().min(3).max(120),
    body: z.string().trim().max(2000),
    isCollab: z.boolean(),
    rolesNeeded: z.array(z.enum(ROLES)).max(ROLES.length),
    hoursEstimate: z.number().positive().max(1000).optional(),
    imageUrl: z.string().trim().max(500).startsWith("https://").optional(),
  }),
  (input) => ({
    method: "POST",
    path: "/api/ideas",
    body: json(
      input.isCollab
        ? {
            title: input.title,
            body: input.body,
            isCollab: true,
            rolesNeeded: input.rolesNeeded,
            ...(input.hoursEstimate ? { hoursEstimate: input.hoursEstimate } : {}),
            ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
          }
        : { title: input.title, body: input.body },
    ),
  }),
  { revalidate: PATHS, pick: () => null },
);

export const deleteIdea = guardedAction(
  "ideas.delete",
  z.object({ id }),
  (input) => ({ method: "DELETE", path: `/api/ideas/${input.id}`, target: `idea:${input.id}` }),
  { revalidate: PATHS, pick: () => null },
);

export const voteIdea = guardedAction(
  "ideas.vote",
  z.object({ id, dir: z.enum(["up", "down"]) }),
  (input) => ({
    method: "POST",
    path: `/api/ideas/${input.id}/${input.dir === "up" ? "upvote" : "downvote"}`,
    target: `idea:${input.id}`,
  }),
  {
    pick: (d: { upvotes?: number; downvotes?: number }) => ({
      upvotes: typeof d?.upvotes === "number" ? d.upvotes : null,
      downvotes: typeof d?.downvotes === "number" ? d.downvotes : null,
    }),
  },
);

export const applyToIdea = guardedAction(
  "ideas.apply",
  z.object({ id }),
  (input) => ({ method: "POST", path: `/api/ideas/${input.id}/apply`, target: `idea:${input.id}` }),
  { pick: () => null },
);
