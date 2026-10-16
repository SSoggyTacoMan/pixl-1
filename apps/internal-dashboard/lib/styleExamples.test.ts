import { describe, expect, test } from "bun:test";
import { pickStyleExamples, type StyleCandidate } from "./styleExamples";

const c = (projectId: number, hours: number | null, tf: string): StyleCandidate => ({
  projectId,
  hours,
  technicalFeatures: tf,
  notes: "",
  deflationReason: "",
});

describe("pickStyleExamples", () => {
  test("long-hours projects only, longest write-up first", () => {
    const out = pickStyleExamples(
      [c(1, 5, "x".repeat(900)), c(2, 40, "b".repeat(100)), c(3, 120, "c".repeat(300)), c(4, 25, "d".repeat(200))],
      2,
    );
    expect(out.map((e) => e.technicalFeatures.length)).toEqual([300, 200]);
  });

  test("keeps only the latest write-up of a project", () => {
    const out = pickStyleExamples([c(1, 30, "new"), c(1, 30, "older and much longer text"), c(2, 30, "other")], 4);
    expect(out.map((e) => e.technicalFeatures)).toEqual(["other", "new"]);
  });

  test("falls back to the newest write-ups when few projects are long", () => {
    const out = pickStyleExamples([c(1, 3, "a"), c(2, 4, "b"), c(3, 6, "c")], 4);
    expect(out.map((e) => e.technicalFeatures)).toEqual(["a", "b"]);
  });

  test("a project with unknown hours is not treated as long", () => {
    const out = pickStyleExamples([c(1, null, "z".repeat(500)), c(2, 50, "y")], 1);
    expect(out[0].technicalFeatures).toBe("y");
  });

  test("returns plain examples without bookkeeping fields", () => {
    const [ex] = pickStyleExamples([c(1, 50, "t")], 1);
    expect(Object.keys(ex).sort()).toEqual(["deflationReason", "notes", "technicalFeatures"]);
  });
});
