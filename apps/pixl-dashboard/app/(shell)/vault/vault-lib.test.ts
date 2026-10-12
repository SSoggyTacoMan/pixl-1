import { describe, expect, test } from "bun:test";
import { SEGMENTS, filledSegments, hasTopReward, type VaultLevel } from "./vault-lib";

const lvl = (energyRequired: number, unlocked: boolean): VaultLevel => ({
  level: 1,
  title: "",
  blurb: "",
  energyRequired,
  rewards: [],
  unlocked,
});

describe("vault gauge", () => {
  test("fully recovered vault fills every segment", () => {
    expect(filledSegments({ energy: 10, nextRequired: null, levels: [lvl(5, true)] })).toBe(SEGMENTS);
  });

  test("progress is measured from the last unlocked threshold", () => {
    const levels = [lvl(100, true), lvl(200, false)];
    expect(filledSegments({ energy: 150, nextRequired: 200, levels })).toBe(SEGMENTS / 2);
    expect(filledSegments({ energy: 100, nextRequired: 200, levels })).toBe(0);
  });

  test("clamps outside the span", () => {
    expect(filledSegments({ energy: -5, nextRequired: 50, levels: [] })).toBe(0);
    expect(filledSegments({ energy: 999, nextRequired: 50, levels: [] })).toBe(SEGMENTS);
  });

  test("top reward needs at least one non-zero place", () => {
    expect(hasTopReward({ first: 0, second: 0, third: 0 })).toBe(false);
    expect(hasTopReward({ first: 0, second: 5, third: 0 })).toBe(true);
    expect(hasTopReward(null)).toBe(false);
  });
});
