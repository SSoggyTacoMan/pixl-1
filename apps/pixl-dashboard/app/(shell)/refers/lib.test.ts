import { expect, test } from "bun:test";
import { applyCardState, applyError, normalizeCode, referralLink } from "./lib";

test("normalizeCode", () => {
  expect(normalizeCode(" abc123 ")).toBe("ABC123");
  expect(normalizeCode("ab-c 1<2>3xyz")).toBe("ABC123");
  expect(normalizeCode(undefined)).toBe("");
});

test("referralLink", () => {
  expect(referralLink("https://pixl.hackclub.com", "AB12CD")).toBe("https://pixl.hackclub.com/refers?code=AB12CD");
});

test("applyCardState", () => {
  expect(applyCardState({ boost: { shipsUsed: 0, shipsRemaining: 1 }, canApply: false })).toBe("boost-active");
  expect(applyCardState({ boost: { shipsUsed: 1, shipsRemaining: 0 }, canApply: true })).toBe("boost-used");
  expect(applyCardState({ boost: null, canApply: true })).toBe("apply");
  expect(applyCardState({ boost: null, canApply: false })).toBe("expired");
});

test("applyError", () => {
  expect(applyError("http_404")).toBe("That referral code doesn't exist.");
  expect(applyError("http_400")).toContain("Couldn't apply");
  expect(applyError("You can't refer yourself.")).toBe("You can't refer yourself.");
  expect(applyError("weird_code")).toBe("Couldn't apply that code right now.");
  expect(applyError(null)).toBe("Couldn't apply that code.");
});
