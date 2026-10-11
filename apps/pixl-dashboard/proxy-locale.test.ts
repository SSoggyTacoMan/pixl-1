import { describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { detectLocale, proxy } from "./proxy.ts";

describe("detectLocale", () => {
  test("country wins", () => expect(detectLocale("BR", "en-US")).toBe("pt"));
  test("accept-language by q", () => expect(detectLocale(null, "de;q=0.9,fr;q=0.8,en;q=0.1")).toBe("fr"));
  test("falls back to en", () => expect(detectLocale("DE", "de-DE")).toBe("en"));
});

describe("landing locale redirect", () => {
  test("first visit to / from a French browser goes to /fr", () => {
    const res = proxy(new NextRequest("https://pixl.hackclub.com/", { headers: { "accept-language": "fr-FR" } }));
    expect(res.headers.get("location")).toBe("https://pixl.hackclub.com/fr");
  });
  test("an existing locale cookie is respected", () => {
    const res = proxy(
      new NextRequest("https://pixl.hackclub.com/", { headers: { "accept-language": "fr-FR", cookie: "pixl_locale=en" } }),
    );
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });
  test("never redirects non-root paths", () => {
    const res = proxy(new NextRequest("https://pixl.hackclub.com/dashboard", { headers: { "accept-language": "fr-FR" } }));
    expect(res.headers.get("location")).toBeNull();
  });
});
