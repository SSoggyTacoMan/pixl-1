import { describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { buildCsp, config, proxy } from "./proxy.ts";

describe("proxy", () => {
  test("sets a nonce CSP on the response and the forwarded request", () => {
    const res = proxy(new NextRequest("https://pixl.hackclub.com/dashboard?x=1"));
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(res.headers.get("x-middleware-request-x-pixl-path")).toBe("/dashboard?x=1");
    expect(res.headers.get("x-middleware-request-x-nonce")).toBeTruthy();
  });

  test("never turns a ?token= into a session cookie", () => {
    const res = proxy(new NextRequest("https://pixl.hackclub.com/dashboard?token=abc"));
    expect(res.cookies.get("pixl_session")).toBeUndefined();
    expect(res.cookies.get("__Host-pixl_session")).toBeUndefined();
    expect(res.status).toBe(200);
  });

  describe("matcher", () => {
    // The matcher source is a path-to-regexp pattern whose only group is a
    // plain JS regex, so anchoring it reproduces what Next matches.
    const re = new RegExp(`^${config.matcher[0].source}$`);
    for (const p of ["/form/review.x", "/form/a.b.c", "/journals/12.json", "/dashboard", "/", "/shop/1", "/docs/rules", "/logo.png"]) {
      test(`runs (and sets CSP) on ${p}`, () => expect(re.test(p)).toBe(true));
    }
    for (const p of [
      "/api/auth/login",
      "/_next/static/chunks/a.js",
      "/_next/image",
      "/img/boot-splash.png",
      "/fonts/x.woff2",
      "/favicon.ico",
      "/icon.png",
      "/robots.txt",
      "/sitemap.xml",
    ]) {
      test(`skips static ${p}`, () => expect(re.test(p)).toBe(false));
    }
    test("a page whose name merely starts like a metadata file still gets CSP", () => {
      expect(re.test("/robots.txt.x")).toBe(true);
      expect(re.test("/favicon.icox")).toBe(true);
    });
  });

  test("unsafe-eval only in dev", () => {
    expect(buildCsp("n", false)).not.toContain("unsafe-eval");
    expect(buildCsp("n", true)).toContain("unsafe-eval");
  });
});
