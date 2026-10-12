import { describe, expect, test } from "bun:test";
import { isSlackTs, slackUserIdFromBody } from "./validate.js";

describe("slackUserIdFromBody (ticket resolve, channel joins)", () => {
  test("accepts a trimmed Slack user id", () => {
    expect(slackUserIdFromBody({ slackId: " U0ABC12345 " })).toBe("U0ABC12345");
    expect(slackUserIdFromBody({ slackId: "W0ABC12345" })).toBe("W0ABC12345");
  });
  test("rejects anything else", () => {
    for (const body of [
      null,
      [],
      "U0ABC12345",
      {},
      { slackId: 42 },
      { slackId: "" },
      { slackId: "C0CHANNEL1" },
      { slackId: "<!channel>" },
      { slackId: "<@U0ABC12345>" },
      { slackId: "U0ABC12345> <!here" },
    ]) {
      expect(slackUserIdFromBody(body)).toBeNull();
    }
  });
});

describe("isSlackTs", () => {
  test("accepts a message ts", () => {
    expect(isSlackTs("1700000000.123456")).toBe(true);
  });
  test("rejects anything else", () => {
    for (const v of ["", "abc", "1700000000", "1700000000.12", "1700000000.123456; drop", undefined, 1700000000.123456]) {
      expect(isSlackTs(v)).toBe(false);
    }
  });
});
