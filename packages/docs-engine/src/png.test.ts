import { describe, expect, test } from "bun:test";
import { deflateSync } from "node:zlib";
import { decodePNG, MAX_DECODE_PIXELS } from "./png";

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

// decodePNG doesn't verify CRCs, so the chunks here carry a zero CRC.
function chunk(type: string, data: Uint8Array): number[] {
  const len = data.length;
  return [
    (len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255,
    ...[...type].map((c) => c.charCodeAt(0)),
    ...data,
    0, 0, 0, 0,
  ];
}

function ihdr(width: number, height: number, colorType = 6): Uint8Array {
  const d = new Uint8Array(13);
  const v = new DataView(d.buffer);
  v.setUint32(0, width);
  v.setUint32(4, height);
  d[8] = 8; // bit depth
  d[9] = colorType;
  return d;
}

function png(header: Uint8Array, raw: Uint8Array): Uint8Array {
  return new Uint8Array([
    ...SIGNATURE,
    ...chunk("IHDR", header),
    ...chunk("IDAT", deflateSync(raw)),
    ...chunk("IEND", new Uint8Array()),
  ]);
}

describe("decodePNG", () => {
  test("decodes a small RGBA image", () => {
    // 2x1, filter byte 0, then two RGBA pixels.
    const img = decodePNG(png(ihdr(2, 1), new Uint8Array([0, 1, 2, 3, 255, 4, 5, 6, 255])));
    expect(img.width).toBe(2);
    expect(img.height).toBe(1);
    expect([...img.rgba]).toEqual([1, 2, 3, 255, 4, 5, 6, 255]);
  });

  test("refuses a header larger than MAX_DECODE_PIXELS before allocating", () => {
    const side = Math.ceil(Math.sqrt(MAX_DECODE_PIXELS)) + 1;
    expect(() => decodePNG(png(ihdr(side, side), new Uint8Array(1)))).toThrow(/too large/);
  });

  test("caps inflation at the size the header declares (zlib bomb)", () => {
    // Declares 2x2 RGB (14 bytes of scanlines) but inflates to 32 MiB.
    const bomb = new Uint8Array(32 * 1024 * 1024);
    expect(() => decodePNG(png(ihdr(2, 2, 2), bomb))).toThrow();
  });

  test("rejects truncated image data", () => {
    expect(() => decodePNG(png(ihdr(2, 2, 2), new Uint8Array(3)))).toThrow(/truncated/);
  });

  test("rejects a truncated IHDR", () => {
    const bytes = new Uint8Array([...SIGNATURE, ...chunk("IHDR", new Uint8Array(5))]);
    expect(() => decodePNG(bytes)).toThrow(/truncated PNG header/);
  });
});
