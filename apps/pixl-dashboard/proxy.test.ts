import { describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { buildCsp, proxy } from "./proxy.ts";

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
    expect(res.status).toBe(200);
  });

  test("unsafe-eval only in dev", () => {
    expect(buildCsp("n", false)).not.toContain("unsafe-eval");
    expect(buildCsp("n", true)).toContain("unsafe-eval");
  });
});
