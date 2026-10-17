import { describe, expect, test } from "bun:test";
import { computeClaimedHours, round1 } from "./hours";

describe("computeClaimedHours and round1", () => {
  test("computes claimed hours with tenths precision and avoids float addition errors", () => {
    // 0.1 hours (360 seconds) tracked + 0.2 hours journal
    const hours = computeClaimedHours({
      hackatimeSeconds: 360,
      journals: [{ hours: 0.2 }],
    });
    expect(hours).toBe(0.3);
  });

  test("hardware projects subtract raw owner journal hours and add deflated journal hours", () => {
    // Hardware: owner tracked 10h (36000s) which included 4h owner journal.
    // Reviewer deflated owner journal from 4h to 2h, and collaborator has 1h journal.
    const hours = computeClaimedHours({
      hackatimeSeconds: 36000,
      kind: "hardware",
      ownerUserId: "owner1",
      journals: [
        { user_id: "owner1", hours: 4, approved_hours: 2 },
        { user_id: "collab1", hours: 1, approved_hours: 1 },
      ],
    });
    // rawTracked = 10h, rawOwnerJournal = 4h => hackatimeOnly = 6h.
    // approved journals = 2h + 1h = 3h. Total = 6h + 3h = 9h.
    expect(hours).toBe(9);
  });

  test("raw option returns un-deflated journal hours", () => {
    const hours = computeClaimedHours({
      hackatimeSeconds: 3600, // 1h
      journals: [{ hours: 2, approved_hours: 1 }],
      raw: true,
    });
    expect(hours).toBe(3);
  });

  test("round1 correctly rounds float edge cases", () => {
    expect(round1(0.1 + 0.2)).toBe(0.3);
    expect(round1(1.04)).toBe(1);
    expect(round1(1.05)).toBe(1.1);
  });
});
