import { describe, expect, test } from "bun:test";

// /pixl-remember and /pixl-forget write program facts that are injected into
// every prompt Pixo builds. Source-level guard (the module registers Slack
// handlers on import): both are gated on isSlackAdmin alone, with no helper,
// ticket-channel or hardcoded-user bypass.
describe("program memory commands", () => {
  async function block(name: string): Promise<string> {
    const src = await Bun.file(new URL("./memoryCommands.ts", import.meta.url)).text();
    const start = src.indexOf(`app.command("${name}"`);
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf("app.command(", start + 1);
    return src.slice(start, end === -1 ? undefined : end);
  }

  for (const name of ["/pixl-remember", "/pixl-forget"]) {
    test(`${name} is admin-only`, async () => {
      const b = await block(name);
      expect(b).toContain("isSlackAdmin(command.user_id)");
      for (const bypass of ["GABIN_ID", "checkIsHelper", "checkIsInTicketChannel"]) expect(b).not.toContain(bypass);
    });
  }

  test("no hardcoded user id is imported for a bypass", async () => {
    const src = await Bun.file(new URL("./memoryCommands.ts", import.meta.url)).text();
    expect(src).not.toContain("GABIN_ID");
  });
});
