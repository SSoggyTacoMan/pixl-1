import { describe, expect, test } from "bun:test";
import { ageLabel, lastUpdated } from "./fulfillmentView";

const NOW = Date.parse("2026-10-15T12:00:00Z");

describe("ageLabel", () => {
  test("shows minutes under an hour", () => {
    expect(ageLabel("2026-10-15T11:30:00Z", NOW)).toBe("30m ago");
  });
  test("shows hours under a day", () => {
    expect(ageLabel("2026-10-15T05:00:00Z", NOW)).toBe("7h ago");
  });
  test("shows days beyond that", () => {
    expect(ageLabel("2026-10-12T12:00:00Z", NOW)).toBe("3d ago");
  });
  test("returns empty for missing or invalid dates", () => {
    expect(ageLabel(null, NOW)).toBe("");
    expect(ageLabel("nope", NOW)).toBe("");
  });
  test("never goes negative for future timestamps", () => {
    expect(ageLabel("2026-10-15T13:00:00Z", NOW)).toBe("0m ago");
  });
});

describe("lastUpdated", () => {
  const base = { created_at: "c", claimed_at: null, ordered_at: null, credited_at: null, shipped_at: null, done_at: null };
  test("falls back to creation for an unclaimed order", () => {
    expect(lastUpdated(base)).toBe("c");
  });
  test("uses the latest stage stamp reached", () => {
    expect(lastUpdated({ ...base, claimed_at: "cl", ordered_at: "o", credited_at: "cr" })).toBe("cr");
    expect(lastUpdated({ ...base, ordered_at: "o", shipped_at: "s", done_at: "d" })).toBe("d");
  });
});
