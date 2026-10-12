import { describe, expect, test } from "bun:test";
import { safeCompactSummary } from "./compactSummary.js";

// pixo compact / pixo:recap post a model summary of what players said, so a
// player could plant a mass-ping or a slur in chat and have it repeated.
describe("compact and recap output filter", () => {
  test("a planted <!channel> in a compact is not a live ping", () => {
    const out = safeCompactSummary("- someone said <!channel> check this out\n- ships happened");
    expect(out).not.toBeNull();
    expect(out).not.toContain("<!channel>");
    expect(out).toContain("ships happened");
  });

  test("a compact repeating banned language is dropped whole", () => {
    expect(safeCompactSummary("- someone said shut the fuck up")).toBeNull();
  });

  test("an empty or missing summary is no compact", () => {
    expect(safeCompactSummary("")).toBeNull();
    expect(safeCompactSummary(null)).toBeNull();
    expect(safeCompactSummary(undefined)).toBeNull();
  });

  test("dailyCompact filters both generated and stored compacts", async () => {
    const src = await Bun.file(new URL("./dailyCompact.ts", import.meta.url)).text();
    expect(src).toContain("return safeCompactSummary(res.data.choices");
    expect(src).toContain("safeCompactSummary((data as any).summary)");
  });

  test("pixo:recap runs its summary through sanitizeAIOutput", async () => {
    const src = await Bun.file(new URL("./messageHandler.ts", import.meta.url)).text();
    expect(src).toContain("sanitizeAIOutput(res.data.choices?.[0]?.message?.content");
  });
});
