import { describe, expect, test } from "bun:test";
import { erasureSummary } from "./erasure";

describe("erasureSummary", () => {
  test("a clean erase is one line", () => {
    expect(erasureSummary("Orpheus", { airtableDeleted: 0, airtableFailed: [], ageOverride: false })).toBe(
      "Erased Orpheus's data.",
    );
  });

  test("flags every manual follow-up", () => {
    const s = erasureSummary("Orpheus", {
      airtableDeleted: 1,
      airtableFailed: ["recAAAAAAAAAAAAAA"],
      ageOverride: true,
    });
    expect(s).toContain("Unified YSWS DB");
    expect(s).toContain("recAAAAAAAAAAAAAA");
    expect(s).toContain("ageOverrides.ts");
  });
});
