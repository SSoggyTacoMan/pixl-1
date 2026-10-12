import { describe, expect, test } from "bun:test";
import { activeTrial, clampStep, firstProjectSteps, onboardingSteps, type Rich } from "./steps";

const text = (r: Rich) => r.map((p) => (typeof p === "string" ? p : "b" in p ? p.b : "\n")).join("");

describe("tour steps", () => {
  test("onboarding tour targets the real editor ids and opens /projects/new", () => {
    const s = onboardingSteps(40);
    expect(s.map((x) => x.target).filter(Boolean)).toEqual(["new-btn", "f-name", "f-repo", "ht-connect", "f-save", "s-ship"]);
    expect(s.find((x) => x.target === "new-btn")?.nextRoute).toBe("/projects/new");
    expect(text(s.find((x) => x.target === "ht-connect")!.body)).toContain("40 pixels");
    expect(s.every((x) => !x.extra || x.extra.href.startsWith("/docs/"))).toBe(true);
  });

  test("first-project tour speaks to the Trial, as text only", () => {
    const trial = { id: 7, name: "<img src=x onerror=alert(1)>", description: "Build a lamp", region: "EU", reward: "A kit" };
    const s = firstProjectSteps(trial, 40);
    expect(s[0].title).toBe("Let's build your Trial");
    expect(s[1].title).toBe("What to build");
    // The name stays a plain string run - React escapes it, nothing parses it.
    expect(s[1].body).toContainEqual({ b: trial.name });
    expect(s.find((x) => x.target === "new-btn")?.nextRoute).toBe("/projects/new?trial=7");
    const generic = firstProjectSteps(null, 40);
    expect(generic[0].title).toBe("Let's make your first project");
    expect(generic.some((x) => x.title === "What to build")).toBe(false);
  });

  test("activeTrial picks the single open trial or the most recently accepted", () => {
    const t = (id: number, at: string | null, extra = {}) => ({ id, unlocked: true, completed: false, unlocked_at: at, ...extra });
    expect(activeTrial([])).toBeNull();
    expect(activeTrial([t(1, null, { completed: true })])).toBeNull();
    expect(activeTrial([t(1, null)])?.id).toBe(1);
    expect(activeTrial([t(1, "2026-10-01T00:00:00Z"), t(2, "2026-10-05T00:00:00Z"), t(3, null)])?.id).toBe(2);
    expect(activeTrial([t(1, "2026-10-01T00:00:00Z"), t(2, "2026-10-05T00:00:00Z")], 1)?.id).toBe(1);
  });

  test("clampStep", () => {
    expect(clampStep("3", 8)).toBe(3);
    expect(clampStep("99", 8)).toBe(7);
    expect(clampStep("-2", 8)).toBe(0);
    expect(clampStep("abc", 8)).toBe(0);
  });
});
