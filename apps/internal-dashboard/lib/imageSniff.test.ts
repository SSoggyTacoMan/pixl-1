import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sniffFormat } from "./imageSniff";

const bytes = (...b: number[]) => new Uint8Array(b);
const ascii = (s: string) => new TextEncoder().encode(s);

describe("sniffFormat (runs before sharp)", () => {
  test("accepts PNG, JPEG and WebP signatures", () => {
    expect(sniffFormat(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toBe("png");
    expect(sniffFormat(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpeg");
    const webp = new Uint8Array([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"), ...ascii("VP8 ")]);
    expect(sniffFormat(webp)).toBe("webp");
  });

  test("rejects SVG even when it would be labelled image/png", () => {
    expect(sniffFormat(ascii('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffFormat(ascii("<svg onload=alert(1)>"))).toBeNull();
  });

  test("rejects other formats sharp could decode, and short/empty input", () => {
    expect(sniffFormat(ascii("GIF89a......"))).toBeNull();
    expect(sniffFormat(ascii("%PDF-1.7"))).toBeNull();
    expect(sniffFormat(bytes(0x49, 0x49, 0x2a, 0x00))).toBeNull(); // TIFF
    expect(sniffFormat(ascii("RIFF\0\0\0\0WAVE"))).toBeNull();
    expect(sniffFormat(bytes(0x89, 0x50, 0x4e))).toBeNull();
    expect(sniffFormat(bytes())).toBeNull();
  });

  test("the shop upload sniffs before calling sharp and never uses Supabase", () => {
    const src = readFileSync(join(import.meta.dir, "../app/actions.ts"), "utf8");
    const start = src.indexOf("async function uploadShopImageBuffer(");
    const body = src.slice(start, src.indexOf("\n}\n", start));
    expect(body.indexOf("sniffFormat(raw)")).toBeGreaterThan(-1);
    expect(body.indexOf("sniffFormat(raw)")).toBeLessThan(body.indexOf("sharp("));
    expect(src).not.toMatch(/SUPABASE_/);
  });
});
