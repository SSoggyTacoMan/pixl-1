import { describe, expect, test } from "bun:test";
import { ANON_DEFAULT, ANON_LABEL } from "./copy";

describe("report anonymity disclosure", () => {
  test("anonymous reporting is the default", () => {
    expect(ANON_DEFAULT).toBe(true);
  });

  test("the label discloses the repeat-report exception", () => {
    expect(ANON_LABEL).toMatch(/anonymously/i);
    expect(ANON_LABEL).toMatch(/repeat/i);
    expect(ANON_LABEL).toMatch(/reveal/i);
  });
});
