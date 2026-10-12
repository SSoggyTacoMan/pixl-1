import { describe, expect, test } from "bun:test";
import { canUnship, isInReview } from "./types";

describe("canUnship", () => {
  test("only before a reviewer has given a verdict", () => {
    expect(canUnship({ status: "shipped" })).toBe(true);
    for (const status of ["fraud_review", "second_review", "draft", "approved", "needs_changes"])
      expect(canUnship({ status })).toBe(false);
  });

  test("later review stages still count as in review", () => {
    expect(isInReview({ status: "fraud_review" })).toBe(true);
    expect(isInReview({ status: "second_review" })).toBe(true);
  });
});
