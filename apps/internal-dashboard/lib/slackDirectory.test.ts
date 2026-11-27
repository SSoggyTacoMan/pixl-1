import { afterEach, describe, expect, mock, test } from "bun:test";
import {
  matchSlackDirectory,
  searchPublicSlackDirectory,
  type SlackDirectoryMember,
} from "./slack";

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

describe("searchPublicSlackDirectory", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("maps username, display name and real name from the public directory", async () => {
    globalThis.fetch = mock(async (url: unknown) => {
      expect(String(url)).toContain("/users/search?q=krazyorange");
      return new Response(
        JSON.stringify({
          data: [
            {
              id: "U09TCVDPGGK",
              name: "krazyorange13",
              real_name: "krazyorange",
              display_name: "krazyorange",
            },
          ],
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const hits = await searchPublicSlackDirectory("krazyorange");
    expect(hits.map((h) => h.id)).toEqual(["U09TCVDPGGK"]);
  });

  test("returns no members when the public directory is unreachable", async () => {
    globalThis.fetch = mock(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await searchPublicSlackDirectory("offline-user")).toEqual([]);
  });
});
