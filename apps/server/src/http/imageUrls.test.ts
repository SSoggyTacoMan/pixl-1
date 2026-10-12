import { describe, expect, test } from "bun:test";
import {
  allowedImageUrl,
  demoteDisallowedMarkdownImages,
  markdownImagesAllowed,
  markdownImageUrls,
} from "./imageUrls.js";

describe("allowedImageUrl", () => {
  test("accepts the Hack Club CDN hosts", () => {
    expect(allowedImageUrl("https://cdn.hackclub.com/abc/shot.png")).toBe("https://cdn.hackclub.com/abc/shot.png");
    expect(allowedImageUrl("https://hc-cdn.hel1.your-objectstorage.com/x/y.webp")).not.toBeNull();
    expect(allowedImageUrl("  https://assets.hackclub.com/flag.png  ")).toBe("https://assets.hackclub.com/flag.png");
  });

  test("refuses attacker hosts, look-alikes and other schemes", () => {
    for (const bad of [
      "https://evil.example/track.png",
      "https://cdn.hackclub.com.evil.example/a.png",
      "https://evilcdn.hackclub.com/a.png",
      "https://cdn.hackclub.com@evil.example/a.png",
      "https://user:pw@cdn.hackclub.com/a.png",
      "https://cdn.hackclub.com:8443/a.png",
      "http://cdn.hackclub.com/a.png",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "//cdn.hackclub.com/a.png",
      "https://cdn.hackclub.com/a\".png",
      "https://cdn.hackclub.com/<a>.png",
      "https://cdn.hackclub.com/" + "a".repeat(600),
      "",
      42,
      null,
    ])
      expect(allowedImageUrl(bad)).toBeNull();
  });

  test("Slack avatar hosts only when asked for an avatar", () => {
    const slack = "https://avatars.slack-edge.com/2024-01-01/123_abc_512.png";
    const gravatar = "https://secure.gravatar.com/avatar/abc?s=512&d=https%3A%2F%2Fa.slack-edge.com%2Fdf10d%2Fimg%2Favatars%2Fava_0001-512.png";
    expect(allowedImageUrl(slack)).toBeNull();
    expect(allowedImageUrl(slack, { avatar: true })).toBe(slack);
    expect(allowedImageUrl(gravatar, { avatar: true })).not.toBeNull();
    expect(allowedImageUrl("https://evil.example/a.png", { avatar: true })).toBeNull();
  });
});

describe("journal markdown images", () => {
  test("finds every image target, with or without a title or angle brackets", () => {
    expect(markdownImageUrls('a ![x](https://a.test/1.png "t") b ![](<https://b.test/2.png>)')).toEqual([
      "https://a.test/1.png",
      "https://b.test/2.png",
    ]);
  });

  test("allows CDN images and plain links, refuses any other image host", () => {
    expect(markdownImagesAllowed("![ok](https://cdn.hackclub.com/a.png) [link](https://evil.example)")).toBe(true);
    expect(markdownImagesAllowed("![ok](https://cdn.hackclub.com/a.png) ![t](https://evil.example/t.png)")).toBe(false);
    expect(markdownImagesAllowed("![t](javascript:alert(1))")).toBe(false);
  });

  test("imported content keeps CDN images and turns the rest into links", () => {
    expect(
      demoteDisallowedMarkdownImages("![a](https://cdn.hackclub.com/a.png) ![b](https://evil.example/b.png)"),
    ).toBe("![a](https://cdn.hackclub.com/a.png) [b](https://evil.example/b.png)");
  });
});
