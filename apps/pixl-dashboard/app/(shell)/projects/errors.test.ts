import { describe, expect, test } from "bun:test";
import { hcaRecheckCopy, projectErrorWith, trialHoursCopy } from "./errors";

describe("project error details", () => {
  test("journal copy uses need/have/hours", () => {
    expect(projectErrorWith("journal_too_short", { need: 200, hours: 2 }, { contentLength: 57 })).toBe(
      "Logging 2h needs at least 200 characters (you have 57).",
    );
    expect(projectErrorWith("journal_images_required", { need: 1, have: 0 })).toBe("This entry needs 1 image (you have 0).");
    expect(projectErrorWith("journal_images_required", { need: 3, have: 1 })).toBe("This entry needs 3 images (you have 1).");
    expect(projectErrorWith("journal_too_short")).toContain("100 characters per hour");
  });
  test("trial hours copy", () => {
    expect(trialHoursCopy({ need: 5, have: 1.2 })).toContain("needs at least 5h tracked, you're at 1.2h");
    expect(trialHoursCopy()).toContain("more tracked hours");
  });
  test("hca copy falls back to unknown", () => {
    expect(hcaRecheckCopy("pending").title).toBe("Still under review");
    expect(hcaRecheckCopy("needs_submission").title).toBe("Finish verifying");
    expect(hcaRecheckCopy("__proto__").title).toBe("Verify with Hack Club Auth");
    expect(hcaRecheckCopy(undefined).title).toBe("Verify with Hack Club Auth");
  });
});
