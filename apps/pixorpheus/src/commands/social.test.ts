import { describe, expect, test } from "bun:test";

// /pixl-roast used to feed the target's stored memory (harvested from DMs)
// into a roast posted publicly. Source-level guard so it can't come back:
// social.ts must not read user memory at all, nor the target's real name.
describe("/pixl-roast privacy", () => {
  test("social.ts never reads stored user memory or real names", async () => {
    const src = await Bun.file(new URL("./social.ts", import.meta.url)).text();
    for (const forbidden of ["userMemory", "personalityMemory", "parseFacts", "getSafeFacts", "getSafeTraits", "memory/users", "real_name"]) {
      expect(src).not.toContain(forbidden);
    }
  });
});
