import { describe, expect, test } from "bun:test";
import { trialItemCreditTarget } from "./trialPayout.js";

describe("trialItemCreditTarget", () => {
  // credit_project_pixels credits (target - already earned on the project), so
  // the target has to include what the project already paid out.
  test("a project with no earlier payout targets just the beyond-minimum pixels", () => {
    expect(trialItemCreditTarget(0, 432, 237)).toBe(195);
  });

  test("a project already paid before the Trial link adds the beyond-minimum pixels on top", () => {
    // Shizees Mod: 243 paid on the first approval, 195 beyond the minimum.
    // The old absolute 195 made credit_project_pixels credit 195 - 243 = -48.
    const target = trialItemCreditTarget(243, 432, 237);
    expect(target).toBe(438);
    expect(target - 243).toBe(195);
  });

  test("never targets below what the project already paid", () => {
    expect(trialItemCreditTarget(500, 100, 237)).toBe(500);
  });

  test("a ship at or under the Trial minimum earns nothing extra", () => {
    expect(trialItemCreditTarget(243, 237, 237)).toBe(243);
  });
});
