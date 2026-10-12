import { describe, expect, test } from "bun:test";
import { SEED_NODES, kindClass, outcomeParts, revealCut } from "./timeline-lib";

describe("timeline reveal", () => {
  test("seed content reveals through chapter 1", () => {
    expect(SEED_NODES[revealCut(SEED_NODES)].id).toBe("chapter-1");
  });

  test("explicit revealed flags win", () => {
    const nodes = [{ title: "a" }, { title: "b", revealed: true }, { title: "c", revealed: false }];
    expect(revealCut(nodes)).toBe(1);
  });

  test("api nodes without ids or flags are all shown", () => {
    expect(revealCut([{ title: "a" }, { title: "b" }])).toBe(1);
  });

  test("kind mapping", () => {
    expect(kindClass("operation")).toBe("op");
    expect(kindClass("op")).toBe("op");
    expect(kindClass("prologue")).toBe("prologue");
    expect(kindClass(null)).toBe("chapter");
  });
});

describe("outcome text", () => {
  test("only <b> becomes bold, everything else stays text", () => {
    expect(outcomeParts("The <b>Forge</b> is <img src=x onerror=alert(1)> back")).toEqual([
      { text: "The ", bold: false },
      { text: "Forge", bold: true },
      { text: " is <img src=x onerror=alert(1)> back", bold: false },
    ]);
  });

  test("unbalanced tag just bolds the rest", () => {
    expect(outcomeParts("a <B>b")).toEqual([
      { text: "a ", bold: false },
      { text: "b", bold: true },
    ]);
  });
});
