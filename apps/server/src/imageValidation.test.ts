import { describe, expect, test } from "bun:test";
import { deflateSync } from "node:zlib";
import sharp from "sharp";
import { declaredSizeOk, isRealImage, sanitizeImage, sniffFormat, withSanitizeSlot, BUSY, MAX_INPUT_PIXELS } from "./imageValidation.js";

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

// A real 2x2 PNG whose IHDR is rewritten to declare width x height, with a
// valid chunk CRC so the header parses. The pixel data stays 2x2-sized, so
// the file is a few dozen bytes while a full decode would need w*h*3 bytes.
async function pngDeclaring(width: number, height: number): Promise<Buffer> {
  const buf = Buffer.from(await sharp(pixel()).png().toBuffer());
  // signature(8) + length(4) + "IHDR"(4), then width/height (4 each).
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  const crc = Bun.hash.crc32(buf.subarray(12, 29));
  buf.writeUInt32BE(crc >>> 0, 29);
  return buf;
}

// A complete, valid, all-black 1-bit grayscale PNG of any size, built by
// hand (zlib + CRCs) so the test doesn't have to encode it with sharp. All
// zero rows deflate to almost nothing, so a 9000x9000 image is a few KB on
// the wire - a real compressed bomb, not just a forged header, so a decoder
// with no pixel limit would happily inflate it.
function zeroPng(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(Bun.hash.crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 1; // bit depth
  ihdr[9] = 0; // grayscale
  // Each row: filter byte 0 + ceil(width / 8) bytes of zero bits.
  const raw = Buffer.alloc((1 + Math.ceil(width / 8)) * height);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

describe("decompression bombs", () => {
  test("a tiny PNG declaring 100000x100000 pixels is refused", async () => {
    const bomb = await pngDeclaring(100_000, 100_000);
    expect(bomb.length).toBeLessThan(200);
    expect(await isRealImage(bomb, "image/png")).toBe(false);
  });

  test("the hand-built PNG is a valid image sharp decodes when it's under our cap", async () => {
    const small = zeroPng(3000, 3000);
    const meta = await sharp(small).metadata();
    expect(meta.width).toBe(3000);
    expect(meta.height).toBe(3000);
    expect((await sanitizeImage(small, "image/png")).ok).toBe(true);
  });

  test("a valid, highly compressed 9000x9000 PNG (over our 40M pixel cap, under sharp's own default) is refused", async () => {
    const bomb = zeroPng(9000, 9000);
    expect(bomb.length).toBeLessThan(200_000);
    expect(9000 * 9000).toBeGreaterThan(MAX_INPUT_PIXELS);
    // Under sharp's built-in 268M-pixel default, so only our limit refuses it:
    // with no options sharp reads it as a perfectly normal image.
    expect(9000 * 9000).toBeLessThan(0x3fff * 0x3fff);
    expect((await sharp(bomb).metadata()).width).toBe(9000);
    expect(await isRealImage(bomb, "image/png")).toBe(false);
  });

  test("declared size limits", () => {
    expect(declaredSizeOk({ width: 4000, height: 4000 })).toBe(true);
    expect(declaredSizeOk({ width: 10_001, height: 10 })).toBe(false);
    expect(declaredSizeOk({ width: 10, height: 10_001 })).toBe(false);
    expect(declaredSizeOk({ width: 8000, height: 6000 })).toBe(false);
    expect(declaredSizeOk({ width: 2000, height: 2000, pages: 20 })).toBe(false);
    expect(declaredSizeOk({ width: 0, height: 10 })).toBe(false);
    expect(declaredSizeOk({})).toBe(false);
  });

  test("a normal image still sanitizes", async () => {
    const r = await sanitizeImage(await sharp(pixel()).png().toBuffer(), "image/png");
    expect(r.ok).toBe(true);
  });
});

describe("sanitize concurrency", () => {
  test("at most two run at once and the queue is bounded", async () => {
    let active = 0;
    let peak = 0;
    const releases: (() => void)[] = [];
    const job = () =>
      withSanitizeSlot(async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise<void>((r) => releases.push(r));
        active--;
        return "done";
      });
    const jobs = Array.from({ length: 22 }, job);
    // 2 running + 20 waiting; one more is turned away.
    expect(await withSanitizeSlot(async () => "extra")).toBe(BUSY);
    while (releases.length || active) {
      await Bun.sleep(1);
      releases.shift()?.();
    }
    expect(await Promise.all(jobs)).toEqual(Array(22).fill("done"));
    expect(peak).toBe(2);
  });
});
