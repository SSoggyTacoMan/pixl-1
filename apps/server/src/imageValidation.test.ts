import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { isRealImage, sniffFormat } from "./imageValidation.js";

function pixel() {
  return { create: { width: 2, height: 2, channels: 3 as const, background: { r: 1, g: 2, b: 3 } } };
}

describe("isRealImage", () => {
  test("accepts a real PNG claiming image/png", async () => {
    const buf = await sharp(pixel()).png().toBuffer();
    expect(await isRealImage(buf, "image/png")).toBe(true);
  });

  test("accepts a real JPEG claiming image/jpeg", async () => {
    const buf = await sharp(pixel()).jpeg().toBuffer();
    expect(await isRealImage(buf, "image/jpeg")).toBe(true);
  });

  test("accepts a real WebP claiming image/webp", async () => {
    const buf = await sharp(pixel()).webp().toBuffer();
    expect(await isRealImage(buf, "image/webp")).toBe(true);
  });

  test("rejects random bytes claiming image/png", async () => {
    const buf = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(await isRealImage(buf, "image/png")).toBe(false);
  });

  test("rejects a real image whose declared MIME doesn't match its actual bytes", async () => {
    const jpeg = await sharp(pixel()).jpeg().toBuffer();
    expect(await isRealImage(jpeg, "image/png")).toBe(false);

    const png = await sharp(pixel()).png().toBuffer();
    expect(await isRealImage(png, "image/webp")).toBe(false);
  });

  test("rejects a truncated PNG even though its header is intact", async () => {
    const full = await sharp(pixel()).png().toBuffer();
    const truncated = full.subarray(0, Math.floor(full.length / 2));
    expect(await isRealImage(truncated, "image/png")).toBe(false);
  });

  test("rejects a truncated JPEG even though its header is intact", async () => {
    const full = await sharp(pixel()).jpeg().toBuffer();
    const truncated = full.subarray(0, Math.floor(full.length / 2));
    expect(await isRealImage(truncated, "image/jpeg")).toBe(false);
  });

  test("rejects an unsupported declared MIME outright", async () => {
    const buf = await sharp(pixel()).png().toBuffer();
    expect(await isRealImage(buf, "image/gif")).toBe(false);
  });
});

// The declared MIME is client-controlled and sharp picks its decoder from the
// bytes, so anything that isn't PNG/JPEG/WebP by signature must be refused
// before sharp ever sees it - an SVG labelled image/png used to reach librsvg.
describe("sniffFormat", () => {
  test("identifies PNG, JPEG and WebP by signature", async () => {
    expect(sniffFormat(await sharp(pixel()).png().toBuffer())).toBe("png");
    expect(sniffFormat(await sharp(pixel()).jpeg().toBuffer())).toBe("jpeg");
    expect(sniffFormat(await sharp(pixel()).webp().toBuffer())).toBe("webp");
  });

  test("refuses SVG, GIF, TIFF, HEIF and short buffers", () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
    const svgBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), svg]);
    const gif = Buffer.from("GIF89a\x01\x00\x01\x00", "latin1");
    const tiff = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]);
    const heif = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
    for (const buf of [svg, svgBom, gif, tiff, heif, Buffer.from([0x89, 0x50])])
      expect(sniffFormat(buf)).toBeNull();
  });
});

describe("isRealImage with non-raster payloads", () => {
  test("rejects an SVG claiming image/png", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>');
    expect(await isRealImage(svg, "image/png")).toBe(false);
  });
});
