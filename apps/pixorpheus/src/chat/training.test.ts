import { describe, expect, test } from "bun:test";
import { isTrainingAllowed } from "./training.js";
import { TRAINING_CHANNEL } from "../constants.js";
import { sanitizeStyleNotes, STYLE_NOTES_MAX } from "../memory/style.js";
import { isSlackAdmin } from "../slack/admins.js";

const ADMIN = "U0ADMIN001";
const env = { SLACK_ADMIN_USER_IDS: ADMIN };

describe("isTrainingAllowed", () => {
  test("admin in the training channel", () => {
    expect(isTrainingAllowed(ADMIN, TRAINING_CHANNEL, env)).toBe(true);
  });
  test("admin in any other channel is not", () => {
    expect(isTrainingAllowed(ADMIN, "C0B5P4N0WHH", env)).toBe(false);
    expect(isTrainingAllowed(ADMIN, "D0DMCHAN01", env)).toBe(false);
    expect(isTrainingAllowed(ADMIN, null, env)).toBe(false);
  });
  test("non-admin in the training channel is not", () => {
    expect(isTrainingAllowed("U0RANDOM01", TRAINING_CHANNEL, env)).toBe(false);
  });
  test("fails closed with no admins configured", () => {
    expect(isTrainingAllowed(ADMIN, TRAINING_CHANNEL, {})).toBe(false);
    expect(isTrainingAllowed(ADMIN, TRAINING_CHANNEL, { SLACK_ADMIN_USER_IDS: "" })).toBe(false);
  });
});

describe("isSlackAdmin", () => {
  test("ignores malformed entries", () => {
    expect(isSlackAdmin("C0CHANNEL1", { SLACK_ADMIN_USER_IDS: "C0CHANNEL1" })).toBe(false);
    expect(isSlackAdmin(undefined, env)).toBe(false);
    expect(isSlackAdmin(ADMIN, { SLACK_ADMIN_USER_IDS: ` ${ADMIN} ,U0OTHER001` })).toBe(true);
  });
});

describe("sanitizeStyleNotes", () => {
  test("strips every Slack control sequence and link", () => {
    const out = sanitizeStyleNotes(
      "uses lots of caps <!channel> <!here|here> <!subteam^S1|@team> <@U0A2SJ7B739> <#C0B5P4N0WHH> <https://evil.com|click> <mailto:a@b.co> slack://open www.evil.com https://evil.com/x",
    );
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).not.toContain("evil");
    expect(out).not.toContain("slack:");
    expect(out).not.toContain("mailto");
    expect(out).toContain("uses lots of caps");
  });
  test("caps the length", () => {
    expect(sanitizeStyleNotes("a".repeat(10_000)).length).toBe(STYLE_NOTES_MAX);
  });
  test("keeps plain style prose", () => {
    expect(sanitizeStyleNotes("- short replies\n- says ngl a lot")).toBe("- short replies\n- says ngl a lot");
  });
});
