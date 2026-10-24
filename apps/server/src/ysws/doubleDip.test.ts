import { describe, expect, test } from "bun:test";
import { buildDoubleDip, type DoubleDipInput } from "./doubleDip.js";
import type { ArchiveMatch } from "./archive.js";

const REPO = "https://github.com/someone/thing";
const OWNER = "U0OWNER";

function match(ysws: string, hours: number, slackId = OWNER): ArchiveMatch {
  return { url: REPO, ysws, hours, approvedAt: 1789344000, slackId };
}

function input(matches: ArchiveMatch[], over: Partial<DoubleDipInput> = {}): DoubleDipInput {
  return {
    project: {
      name: "Thing",
      imported_ysws_entry_id: null,
      imported_from_ysws: null,
      imported_ysws_hours: null,
      imported_ysws_approved_at: null,
    },
    matches,
    otherYsws: false,
    trackedSeconds: 23.2 * 3600,
    collaborators: [],
    ownerLabel: "owner",
    ownerSlackId: OWNER,
    ...over,
  };
}

describe("buildDoubleDip", () => {
  test("subtracts every prior entry for a person, not just the first", () => {
    const r = buildDoubleDip(input([match("Pixl", 1), match("Pixl", 11)]));
    expect(r.systemNote).toContain("claims 23.2h here");
    expect(r.systemNote).toContain("got 12h before");
    expect(r.systemNote).toContain("at most 11.2h");
  });

  test("earlier ships to this same program are a re-ship, not a double dip", () => {
    const r = buildDoubleDip(input([match("Pixl", 1), match("Pixl", 11)]));
    expect(r.systemNote).not.toContain("did NOT disclose");
    expect(r.systemNote).toContain("re-ship");
    expect(r.flagDetail).toBeUndefined();
  });

  test("an undisclosed other program still flags, and the cap counts every prior entry", () => {
    const r = buildDoubleDip(input([match("Pixl", 2), match("Summer of Making", 5)]));
    expect(r.systemNote).toContain('under "Summer of Making"');
    expect(r.systemNote).toContain("did NOT disclose");
    expect(r.systemNote).toContain("at most 16.2h");
    expect(r.flagDetail).toContain("Summer of Making, 5h");
    expect(r.flagDetail).not.toContain("2h");
  });

  test("a disclosed other program names that program", () => {
    const r = buildDoubleDip(input([match("Pixl", 2), match("Arcade", 5)], { otherYsws: true }));
    expect(r.systemNote).toContain('submitted to "Arcade"');
    expect(r.flagDetail).toBeUndefined();
  });

  test("someone else's prior entry is not deducted from the owner", () => {
    const r = buildDoubleDip(input([match("Arcade", 5, "U0SOMEONE")]));
    expect(r.systemNote).toContain("no prior entry found for them specifically");
  });

  test("a prior entry without a Slack ID is the owner's when they are alone on the ship", () => {
    const r = buildDoubleDip(input([match("Future", 4, "")], { trackedSeconds: 3.5 * 3600, otherYsws: true }));
    expect(r.systemNote).toContain("owner got 4h");
    expect(r.systemNote).toContain("claims 3.5h here, got 4h before");
    expect(r.systemNote).toContain("at most 0h");
    expect(r.systemNote).not.toContain("no overlap to deflate");
  });

  test("with collaborators an entry without a Slack ID stays anonymous", () => {
    const r = buildDoubleDip(
      input([match("Future", 4, "")], {
        collaborators: [{ slackId: "U0FRIEND", label: "friend", claimedHours: 2 }],
      }),
    );
    expect(r.systemNote).toContain("someone got 4h");
    expect(r.systemNote).toContain("no prior entry found for them specifically");
  });

  test("a solo owner still ignores an entry that belongs to another Slack ID", () => {
    const r = buildDoubleDip(input([match("Arcade", 5, "U0SOMEONE")]));
    expect(r.systemNote).toContain("no prior entry found for them specifically");
  });

  test("no matches and no import means no note", () => {
    expect(buildDoubleDip(input([])).systemNote).toBe("");
  });
});
