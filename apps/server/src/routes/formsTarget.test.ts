import { describe, expect, test } from "bun:test";

process.env.JWT_SECRET ??= "test-secret";
const { noteTargetDm, targetDmAvailable, TARGET_DM_LIMIT } = await import("./forms.js");

describe("form code DMs per target Slack account", () => {
  test("at most 3 code DMs per Slack id per hour, across every form and IP", () => {
    expect(TARGET_DM_LIMIT.max).toBe(3);
    const victim = "U0VICTIM01";
    for (let i = 0; i < 3; i++) {
      expect(targetDmAvailable(victim)).toBe(true);
      noteTargetDm(victim);
    }
    expect(targetDmAvailable(victim)).toBe(false);
    // Someone else is unaffected.
    expect(targetDmAvailable("U0OTHER001")).toBe(true);
  });
});
