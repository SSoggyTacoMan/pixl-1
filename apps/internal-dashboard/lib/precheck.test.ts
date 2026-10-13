import { expect, test } from "bun:test";
import { PRECHECK_HIDE_MS, isPrecheckRunning, precheckView } from "./precheck";

const now = Date.parse("2026-10-13T12:00:00Z");
const ago = (ms: number) => new Date(now - ms).toISOString();

test("a fresh pending check hides the project, a stale one doesn't", () => {
  expect(isPrecheckRunning({ ai_review_status: "pending", ai_review_started_at: ago(30_000) }, now)).toBe(true);
  expect(isPrecheckRunning({ ai_review_status: "pending", ai_review_started_at: ago(PRECHECK_HIDE_MS + 1) }, now)).toBe(false);
  expect(isPrecheckRunning({ ai_review_status: "pending", ai_review_started_at: null }, now)).toBe(false);
  expect(isPrecheckRunning({ ai_review_status: "clear", ai_review_started_at: ago(1000) }, now)).toBe(false);
});

test("precheckView ignores projects the check never ran on", () => {
  expect(precheckView({ ai_review_status: "disabled" })).toBeNull();
  const v = precheckView({
    ai_review_status: "flagged",
    ai_review_summary: "A clock",
    ai_review_findings: { findings: [{ id: "bom_missing", label: "No BOM" }, null], notes: ["messy"] },
  })!;
  expect(v.findings).toEqual([{ id: "bom_missing", label: "No BOM", evidence: "" }]);
  expect(v.notes).toEqual(["messy"]);
});
