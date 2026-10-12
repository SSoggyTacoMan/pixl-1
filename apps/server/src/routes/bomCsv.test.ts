import { describe, expect, test } from "bun:test";
import { csvCell, sanitizeBomCsv } from "./bomCsv.js";

describe("BOM CSV formula neutralization", () => {
  test("cells starting with = + - @ tab or CR are defused", () => {
    for (const v of ["=1+1", "+1", "-1", "@SUM(A1)", "\t=HYPERLINK(\"https://evil\")", "\r=1+1"])
      expect(csvCell(v).replace(/^"/, "").startsWith("'")).toBe(true);
  });

  test("a CR inside a cell is quoted", () => {
    expect(csvCell("a\rb")).toBe("\"a\rb\"");
  });

  test("ordinary cells pass through", () => {
    expect(csvCell("Resistor 10k")).toBe("Resistor 10k");
    expect(csvCell("1,2")).toBe("\"1,2\"");
  });

  test("a whole uploaded file with a tab-led formula comes out defused", () => {
    const out = sanitizeBomCsv(Buffer.from("item,qty\n\t=cmd|' /C calc'!A0,1\n")).toString("utf8");
    expect(out).not.toMatch(/(^|,)\t=/m);
    expect(out).toContain("'\t=cmd");
  });
});
