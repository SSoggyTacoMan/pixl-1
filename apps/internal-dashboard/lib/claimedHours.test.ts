import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(import.meta.dir, "../app/actions.ts"), "utf8");

describe("claimed hours calculation and deflation comparison", () => {
  test("claimedHoursFor returns tenths rounded with Math.round to avoid float addition errors", () => {
    expect(src).toContain("return Math.round((rawTrackedHours + journalHours) * 10) / 10;");
    expect(src).toContain("return Math.round((hackatimeOnlyHours + journalHours) * 10) / 10;");
  });

  test("server deflated comparison avoids floating-point precision mismatch", () => {
    expect(src).toContain("Math.round(approvedHours * 10) < Math.round(claimedHours * 10)");
  });

  test("float addition like 0.1 + 0.2 equals 0.3 when rounded to tenths", () => {
    const rawTracked = 0.1;
    const journal = 0.2;
    // Without rounding, 0.1 + 0.2 is 0.30000000000000004 (> 0.3)
    expect(rawTracked + journal).toBeGreaterThan(0.3);
    const claimedHours = Math.round((rawTracked + journal) * 10) / 10;
    expect(claimedHours).toBe(0.3);
    const approvedHours = 0.3;
    const deflated = Math.round(approvedHours * 10) < Math.round(claimedHours * 10);
    expect(deflated).toBe(false);
  });
});
