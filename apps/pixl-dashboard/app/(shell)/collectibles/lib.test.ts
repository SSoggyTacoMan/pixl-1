import { expect, test } from "bun:test";
import { progressPct } from "./lib";

test("progressPct", () => {
  expect(progressPct(5, 10, false)).toBe(50);
  expect(progressPct(50, 10, false)).toBe(100);
  expect(progressPct(0, 0, false)).toBe(0);
  expect(progressPct(3, 0, false)).toBe(100);
  expect(progressPct(-4, 10, false)).toBe(0);
  expect(progressPct(0, 10, true)).toBe(100);
});
