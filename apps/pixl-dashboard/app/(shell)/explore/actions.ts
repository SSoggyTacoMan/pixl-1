"use server";

import { z } from "zod";
import { guardedAction } from "@/lib/guarded-action";

interface VoteResponse {
  upvotes?: number;
  has_upvoted?: boolean;
}

const pickVote = (d: VoteResponse) => ({ upvotes: Number(d?.upvotes ?? 0), hasUpvoted: !!d?.has_upvoted });
const voteInput = z.object({ projectId: z.number().int().positive() });

// POST /api/projects/:id/upvote (session). Idempotent; self-votes and
// unshipped projects are rejected by the server.
export const upvoteProject = guardedAction(
  "projects.upvote",
  voteInput,
  (input) => ({ method: "POST", path: `/api/projects/${input.projectId}/upvote`, target: `project:${input.projectId}` }),
  { pick: pickVote },
);

// DELETE /api/projects/:id/upvote (session). Removing a missing vote is a no-op.
export const removeUpvote = guardedAction(
  "projects.upvote_remove",
  voteInput,
  (input) => ({ method: "DELETE", path: `/api/projects/${input.projectId}/upvote`, target: `project:${input.projectId}` }),
  { pick: pickVote },
);
