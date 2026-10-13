import { describe, expect, test } from "bun:test";
import { progressLine, progressPct, type ReviewGrantStatus } from "./reviewGrants";

const MILESTONES = [150, 200, 300, 400];

function status(reviews: number, over: Partial<ReviewGrantStatus> = {}): ReviewGrantStatus {
  const earned = MILESTONES.filter((m) => m <= reviews).length;
  const next = MILESTONES.find((m) => m > reviews) ?? null;
  return {
    reviews,
    milestones: MILESTONES,
    earned,
    claimed: 0,
    available: earned,
    next_at: next,
    to_go: next == null ? null : next - reviews,
    ...over,
  };
}

describe("progressPct", () => {
  test("starts at 0 and fills toward the first milestone", () => {
    expect(progressPct(status(0))).toBe(0);
    expect(progressPct(status(75))).toBe(50);
  });

  test("restarts from the milestone they just passed", () => {
    expect(progressPct(status(150))).toBe(0);
    expect(progressPct(status(175))).toBe(50);
    expect(progressPct(status(250))).toBe(50);
  });

  test("is full once every milestone is behind them", () => {
    expect(progressPct(status(400))).toBe(100);
    expect(progressPct(status(950))).toBe(100);
  });
});

describe("progressLine", () => {
  test("says how many reviews are left for the next grant", () => {
    expect(progressLine(status(118))).toBe("118 reviews, 32 to go for the next grant (at 150).");
    expect(progressLine(status(232))).toBe("232 reviews, 68 to go for the next grant (at 300).");
  });

  test("has nothing left to chase after the last milestone", () => {
    expect(progressLine(status(410))).toBe("410 reviews, every milestone reached.");
  });
});
