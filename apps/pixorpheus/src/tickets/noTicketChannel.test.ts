import { describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

// The private ticket log channel is gone: tickets live in the help-channel
// thread and on the internal dashboard, and Slack channel membership is never
// a permission (helpers table / SLACK_ADMIN_USER_IDS only).
const SRC = join(import.meta.dir, "..");

async function sources(): Promise<{ path: string; text: string }[]> {
  const out: { path: string; text: string }[] = [];
  for (const entry of await readdir(SRC, { recursive: true })) {
    const path = String(entry);
    if (!path.endsWith(".ts") || path.endsWith(".test.ts")) continue;
    out.push({ path, text: await Bun.file(join(SRC, path)).text() });
  }
  return out;
}

describe("no ticket log channel", () => {
  test("nothing reads SLACK_TICKET_CHANNEL or posts ticket cards", async () => {
    for (const { path, text } of await sources()) {
      for (const banned of ["SLACK_TICKET_CHANNEL", "ticket_msg_ts", "ticketBlocks", "claim_ticket", "resolve_from_ticket_channel"]) {
        expect(`${path}: ${text.includes(banned) ? banned : ""}`).toBe(`${path}: `);
      }
    }
  });

  test("channel membership is not checked for permissions", async () => {
    for (const { path, text } of await sources()) {
      expect(`${path}: ${/checkIsIn\w*Channel|ticketChannelMembership/.test(text)}`).toBe(`${path}: false`);
    }
    // The permission helpers themselves never look at channel members.
    for (const file of [join("tickets", "service.ts"), join("slack", "admins.ts")]) {
      expect(await Bun.file(join(SRC, file)).text()).not.toContain("conversations.members");
    }
  });

  test("/pixl-memories is helper/admin only", async () => {
    const src = await Bun.file(join(SRC, "commands", "memoryCommands.ts")).text();
    const start = src.indexOf('app.command("/pixl-memories"');
    const block = src.slice(start, src.indexOf("app.command(", start + 1));
    expect(block).toContain("checkIsHelper(command.user_id)");
  });
});
