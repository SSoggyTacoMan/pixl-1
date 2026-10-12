import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { speakerFactsBlock } from "./persona.js";
import type { WebClient } from "@slack/web-api";
import { ensureUserName, personalityMemory, userMemory } from "../memory/users.js";

const SPEAKER = "U0SPEAKER1";
const OTHER = "U0OTHER001";

// Display names come from the Slack profile (never a stored "name is X" fact).
beforeAll(async () => {
  const client = (name: string) =>
    ({ users: { info: async () => ({ ok: true, user: { profile: { display_name: name } } }) } }) as unknown as WebClient;
  await ensureUserName(SPEAKER, client("speaky"));
  await ensureUserName(OTHER, client("other"));
});

afterEach(() => {
  userMemory.clear();
  personalityMemory.clear();
});

describe("speakerFactsBlock", () => {
  test("only the speaker's facts, never another user's", () => {
    userMemory.set(SPEAKER, ["loves rust"]);
    userMemory.set(OTHER, ["loves secret stuff"]);
    const block = speakerFactsBlock(SPEAKER)!;
    expect(block).toContain("speaky:");
    expect(block).toContain("loves rust");
    expect(block).not.toContain("secret");
    expect(block).not.toContain("other");
  });

  test("identity facts already stored in the DB are dropped at read time", () => {
    userMemory.set(SPEAKER, ["name is Alexandra Real", "lives in Ohio", "is 13 years old", "goes to Lincoln High School", "loves rust"]);
    personalityMemory.set(SPEAKER, ["sarcastic", "is a girl"]);
    const block = speakerFactsBlock(SPEAKER)!;
    expect(block).toBe("speaky:\n- loves rust\n  vibe: sarcastic");
  });

  test("nothing when there is no speaker or nothing safe to say", () => {
    expect(speakerFactsBlock(null)).toBeNull();
    userMemory.set(SPEAKER, ["name is speaky", "lives in Ohio"]);
    expect(speakerFactsBlock(SPEAKER)).toBeNull();
  });
});
