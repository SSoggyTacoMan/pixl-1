import { expect, test } from "bun:test";
import { fmtDate, hoursLine, journalsPath, parseShareParams } from "./lib";

test("parseShareParams rejects anything that isn't an id + token", () => {
  expect(parseShareParams("12", "abcDEF_-9")).toEqual({ projectId: 12, token: "abcDEF_-9" });
  expect(parseShareParams("0", "abc")).toBeNull();
  expect(parseShareParams("-1", "abc")).toBeNull();
  expect(parseShareParams("1e3", "abc")).toBeNull();
  expect(parseShareParams("12", "")).toBeNull();
  expect(parseShareParams("12", "../../admin")).toBeNull();
  expect(parseShareParams("12", "a%2Fb")).toBeNull();
  expect(parseShareParams("12", "x".repeat(257))).toBeNull();
});

test("journalsPath", () => {
  expect(journalsPath(12, "tok_1")).toBe("/api/journals/public/12/tok_1");
});

test("hoursLine shows credited hours only when they differ", () => {
  expect(hoursLine({ hours: 2.04 })).toEqual({ claimed: 2, credited: null });
  expect(hoursLine({ hours: "3.25", approvedHours: 3.25 })).toEqual({ claimed: 3.3, credited: null });
  expect(hoursLine({ hours: 4, approvedHours: 2.5 })).toEqual({ claimed: 4, credited: 2.5 });
  expect(hoursLine({ hours: 4, approvedHours: 0 })).toEqual({ claimed: 4, credited: 0 });
  expect(hoursLine({ hours: null })).toEqual({ claimed: 0, credited: null });
});

test("fmtDate is UTC and tolerant", () => {
  expect(fmtDate("2026-08-18T00:30:00Z")).toBe("Aug 18, 2026");
  expect(fmtDate("nope")).toBe("");
  expect(fmtDate(undefined)).toBe("");
});
