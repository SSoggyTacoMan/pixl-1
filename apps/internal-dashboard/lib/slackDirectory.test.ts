import { describe, expect, test } from "bun:test";
import { matchSlackDirectory, type SlackDirectoryMember } from "./slack";

const member = (
  id: string,
  name: string,
  displayName = "",
  realName = "",
): SlackDirectoryMember => ({ id, name, displayName, realName });

const members = [
  member("U1", "maaren", "Maaren", "Maaren van Something"),
  member("U2", "alex", "pixelalex", "Alex Rivera"),
  member("U3", "pixelsmith", "", "Sam Pixel"),
  member("U4", "jane", "janey", "Jane Legal Doe"),
];

describe("matchSlackDirectory", () => {
  test("matches the Slack username, display name and real name", () => {
    expect(matchSlackDirectory(members, "maaren").map((m) => m.id)).toEqual(["U1"]);
    expect(matchSlackDirectory(members, "pixelalex").map((m) => m.id)).toEqual(["U2"]);
    expect(matchSlackDirectory(members, "Rivera").map((m) => m.id)).toEqual(["U2"]);
  });

  test("accepts an @handle and ignores case", () => {
    expect(matchSlackDirectory(members, "@JANEY").map((m) => m.id)).toEqual(["U4"]);
  });

  test("ranks exact matches before prefixes before substrings", () => {
    const ranked = [
      member("U1", "pixel"),
      member("U2", "pixelalex"),
      member("U3", "notapixel"),
    ];
    expect(matchSlackDirectory(ranked, "pixel").map((m) => m.id)).toEqual(["U1", "U2", "U3"]);
  });

  test("returns nothing for too-short or empty input", () => {
    expect(matchSlackDirectory(members, "p")).toEqual([]);
    expect(matchSlackDirectory(members, "  @  ")).toEqual([]);
  });

  test("respects the limit", () => {
    expect(matchSlackDirectory(members, "le", 1)).toHaveLength(1);
  });
});
