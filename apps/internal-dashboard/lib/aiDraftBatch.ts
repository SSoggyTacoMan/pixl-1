// Rules for pre-filling the shared review draft (projects.review_draft) with the
// AI's technical-features text, used by app/api/cron/ai-drafts. Pure, so the
// "never touch a human's notes" rule is unit-testable.

/** review_draft_by on a draft this job wrote. */
export const AI_DRAFT_BY = "the AI draft";

export interface DraftState {
  review_draft: Record<string, unknown> | null;
  review_draft_by: string | null;
}

/**
 * Whether the job may write a draft over this one. An empty draft is always
 * fair game. A draft the job itself wrote earlier is only replaced when asked
 * to (overwrite). Anything else was typed by a reviewer and is never touched.
 */
export function mayWriteAiDraft(cur: DraftState, overwrite: boolean): boolean {
  const hasDraft = !!cur.review_draft && Object.keys(cur.review_draft).length > 0;
  if (!hasDraft) return true;
  return overwrite && cur.review_draft_by === AI_DRAFT_BY;
}
