import { describe, expect, test } from "bun:test";
import { playerImageSrc, safeFlowUrl, safeHttpUrl, safeImageSrc } from "./safe-url";

describe("safeHttpUrl", () => {
  test("allows http and https", () => {
    expect(safeHttpUrl("https://github.com/x")).toBe("https://github.com/x");
    expect(safeHttpUrl("http://example.com/")).toBe("http://example.com/");
  });
  for (const bad of ["javascript:alert(1)", "data:text/html,x", "vbscript:x", "/relative", "", null, 5, "https://u:p@h.com"]) {
    test(`rejects ${String(bad)}`, () => expect(safeHttpUrl(bad)).toBeNull());
  }
});

describe("safeImageSrc", () => {
  test("https and same-origin paths only", () => {
    expect(safeImageSrc("/img/pixel.png")).toBe("/img/pixel.png");
    expect(safeImageSrc("https://cdn.hackclub.com/a.png")).toBe("https://cdn.hackclub.com/a.png");
    expect(safeImageSrc("http://x.com/a.png")).toBeNull();
    expect(safeImageSrc("//evil.com/a.png")).toBeNull();
    expect(safeImageSrc("javascript:x")).toBeNull();
  });
});

describe("safeFlowUrl", () => {
  test("https only", () => {
    expect(safeFlowUrl("https://auth.hackclub.com/x")).toBe("https://auth.hackclub.com/x");
    expect(safeFlowUrl("http://auth.hackclub.com/x")).toBeNull();
  });
});

describe("playerImageSrc", () => {
  test("Hack Club CDN hosts only", () => {
    expect(playerImageSrc("https://cdn.hackclub.com/a.png")).toBe("https://cdn.hackclub.com/a.png");
    expect(playerImageSrc("https://hc-cdn.hel1.your-objectstorage.com/x/y.webp")).toBe(
      "https://hc-cdn.hel1.your-objectstorage.com/x/y.webp",
    );
    expect(playerImageSrc("https://CDN.HACKCLUB.COM/a.png")).toBe("https://cdn.hackclub.com/a.png");
  });
  for (const bad of [
    "https://evil.example/a.png",
    "http://cdn.hackclub.com/a.png",
    "https://cdn.hackclub.com.evil.example/a.png",
    "https://evil.example/cdn.hackclub.com/a.png",
    "https://cdn.hackclub.com:8443/a.png",
    "https://u:p@cdn.hackclub.com/a.png",
    "/img/pixel.png",
    "//cdn.hackclub.com/a.png",
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    null,
  ]) {
    test(`rejects ${String(bad)}`, () => expect(playerImageSrc(bad)).toBeNull());
  }
  test("Slack avatar hosts only for avatars", () => {
    const slack = "https://avatars.slack-edge.com/2024/1_512.png";
    expect(playerImageSrc(slack)).toBeNull();
    expect(playerImageSrc(slack, { avatar: true })).toBe(slack);
    expect(playerImageSrc("https://secure.gravatar.com/avatar/x", { avatar: true })).toBe("https://secure.gravatar.com/avatar/x");
    expect(playerImageSrc("https://evil.example/a.png", { avatar: true })).toBeNull();
  });
});
