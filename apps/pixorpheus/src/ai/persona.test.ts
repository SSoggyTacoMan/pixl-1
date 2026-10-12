import { afterEach, describe, expect, test } from "bun:test";
import { speakerFactsBlock } from "./persona.js";
import { personalityMemory, userMemory } from "../memory/users.js";

const SPEAKER = "U0SPEAKER1";
const OTHER = "U0OTHER001";

afterEach(() => {
  userMemory.clear();
  personalityMemory.clear();
});

describe("speakerFactsBlock", () => {
  test("only the speaker's facts, never another user's", () => {
    userMemory.set(SPEAKER, ["name is speaky", "loves rust"]);
    userMemory.set(OTHER, ["name is other", "loves secret stuff"]);
    const block = speakerFactsBlock(SPEAKER)!;
    expect(block).toContain("speaky:");
    expect(block).toContain("loves rust");
    expect(block).not.toContain("secret");
    expect(block).not.toContain("other");
  });

  test("identity facts already stored in the DB are dropped at read time", () => {
    userMemory.set(SPEAKER, ["name is speaky", "lives in Ohio", "is 13 years old", "goes to Lincoln High School", "loves rust"]);
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
