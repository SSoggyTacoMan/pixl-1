import { describe, expect, test } from "bun:test";
import type { WebClient } from "@slack/web-api";
import { ensureUserName, getDisplayName, userMemory } from "./users.js";

function fakeClient(profile: { display_name?: string; real_name?: string }): WebClient {
  return { users: { info: async () => ({ ok: true, user: { profile } }) } } as unknown as WebClient;
}

describe("getDisplayName", () => {
  test("never reads a stored 'name is X' memory fact (legacy rows can hold real names)", () => {
    userMemory.set("ULEGACY1", ["name is Alexandra Johnson", "loves rust"]);
    expect(getDisplayName("ULEGACY1")).toBeNull();
  });

  test("uses the Slack profile display name", async () => {
    userMemory.set("UPROFILE1", ["name is Alexandra Johnson"]);
    await ensureUserName("UPROFILE1", fakeClient({ display_name: "pixelfan", real_name: "Alexandra Johnson" }));
    expect(getDisplayName("UPROFILE1")).toBe("pixelfan");
  });

  test("never falls back to the profile's real name", async () => {
    await ensureUserName("UNODISPLAY", fakeClient({ display_name: "", real_name: "Alexandra Johnson" }));
    expect(getDisplayName("UNODISPLAY")).toBeNull();
  });

  test("doesn't write the display name into stored memory", async () => {
    userMemory.delete("UNOWRITE");
    await ensureUserName("UNOWRITE", fakeClient({ display_name: "pixelfan" }));
    expect(userMemory.get("UNOWRITE")).toBeUndefined();
  });
});
