import { describe, expect, test } from "bun:test";
import { filterByHours, isReviewSort, parseHoursBound, sortQueueRows } from "./reviewSort";

const rows = [
  { id: 1, hours: 5, status: "shipped" },
  { id: 2, hours: 12, status: "shipped" },
  { id: 3, hours: 5, status: "shipped" },
  { id: 4, hours: 0.5, status: "shipped" },
];
const ids = (list: { id: number }[]) => list.map((r) => r.id);

describe("sortQueueRows", () => {
  test("oldest keeps the order it was given", () => {
    expect(ids(sortQueueRows(rows, "oldest"))).toEqual([1, 2, 3, 4]);
    expect(ids(sortQueueRows(rows, undefined))).toEqual([1, 2, 3, 4]);
  });

  test("newest reverses it", () => {
    expect(ids(sortQueueRows(rows, "newest"))).toEqual([4, 3, 2, 1]);
  });

  test("most hours first, ties keep the longest waiter first", () => {
    expect(ids(sortQueueRows(rows, "hours"))).toEqual([2, 1, 3, 4]);
  });

  test("fewest hours first, ties keep the longest waiter first", () => {
    expect(ids(sortQueueRows(rows, "hours_asc"))).toEqual([4, 1, 3, 2]);
  });

  test("does not mutate its input", () => {
    sortQueueRows(rows, "hours_asc");
    expect(ids(rows)).toEqual([1, 2, 3, 4]);
  });
});

describe("hours filter", () => {
  test("parses numbers and ignores junk", () => {
    expect(parseHoursBound("3")).toBe(3);
    expect(parseHoursBound(" 2,5 ")).toBe(2.5);
    expect(parseHoursBound("")).toBeNull();
    expect(parseHoursBound("abc")).toBeNull();
    expect(parseHoursBound("-1")).toBeNull();
    expect(parseHoursBound(undefined)).toBeNull();
  });

  test("min and max are inclusive", () => {
    expect(ids(filterByHours(rows, 5, 12))).toEqual([1, 2, 3]);
    expect(ids(filterByHours(rows, null, 5))).toEqual([1, 3, 4]);
    expect(ids(filterByHours(rows, 10, null))).toEqual([2]);
    expect(ids(filterByHours(rows, null, null))).toEqual([1, 2, 3, 4]);
  });
});

describe("isReviewSort", () => {
  test("knows the new keys", () => {
    expect(isReviewSort("newest")).toBe(true);
    expect(isReviewSort("hours_asc")).toBe(true);
    expect(isReviewSort("nope")).toBe(false);
  });
});
