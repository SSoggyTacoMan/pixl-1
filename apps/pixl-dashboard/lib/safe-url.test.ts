import { describe, expect, test } from "bun:test";
import { safeFlowUrl, safeHttpUrl, safeImageSrc } from "./safe-url";

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
