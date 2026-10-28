import { describe, expect, test } from "bun:test";
import { AI_DRAFT_BY, mayWriteAiDraft } from "./aiDraftBatch";

describe("mayWriteAiDraft", () => {
  test("an empty draft can always be filled", () => {
    expect(mayWriteAiDraft({ review_draft: null, review_draft_by: "" }, false)).toBe(true);
    expect(mayWriteAiDraft({ review_draft: {}, review_draft_by: "" }, false)).toBe(true);
  });

  test("a reviewer's draft is never overwritten, even when asked to", () => {
    const human = { review_draft: { technicalFeatures: "mine" }, review_draft_by: "someone (U0ABC123)" };
    expect(mayWriteAiDraft(human, false)).toBe(false);
    expect(mayWriteAiDraft(human, true)).toBe(false);
  });

  test("the job's own earlier draft is replaced only on overwrite", () => {
    const ai = { review_draft: { technicalFeatures: "old" }, review_draft_by: AI_DRAFT_BY };
    expect(mayWriteAiDraft(ai, false)).toBe(false);
    expect(mayWriteAiDraft(ai, true)).toBe(true);
  });
});
