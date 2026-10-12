import sharp from "sharp";

// One libvips worker thread per sanitization: with the semaphore below this
// bounds how much CPU a burst of uploads can take from the game server.
sharp.concurrency(1);

// Decompression-bomb limits. A tiny PNG can declare 100000x100000 pixels in
// its header and make a full decode allocate tens of GB, so the declared size
// is checked from the header (metadata() decodes no pixel data) before any
// decode, and sharp is also told to refuse anything bigger on its own.
export const MAX_INPUT_PIXELS = 40_000_000;
export const MAX_IMAGE_SIDE = 10_000;

// At most MAX_CONCURRENT decodes at once, at most MAX_WAITING queued behind
// them; past that an upload is told to retry instead of piling up.
const MAX_CONCURRENT = 2;
const MAX_WAITING = 20;
let running = 0;
const waiting: (() => void)[] = [];

export async function withSanitizeSlot<T>(fn: () => Promise<T>): Promise<T | typeof BUSY> {
  if (running >= MAX_CONCURRENT) {
    if (waiting.length >= MAX_WAITING) return BUSY;
    await new Promise<void>((resolve) => waiting.push(resolve));
  } else {
    running++;
  }
  try {
    return await fn();
  } finally {
    // Hand the slot straight to the next waiter (running stays the same), or
    // free it.
    const next = waiting.shift();
    if (next) next();
    else running--;
  }
}
export const BUSY: unique symbol = Symbol("sanitize-busy");

const MIME_TO_FORMAT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/webp": "webp",
};

// Magic-byte check run BEFORE sharp. The declared MIME comes from the client,
// and sharp chooses its decoder from the bytes, not the MIME - so without this
// an SVG labelled image/png was parsed by librsvg, which is how the sharp
// 0.35.4 RCE was reached. Only these three raster signatures may reach sharp.
export function sniffFormat(buf: Buffer): "png" | "jpeg" | "webp" | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 12 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP")
    return "webp";
  return null;
}

export type SanitizeResult =
  | { ok: true; buffer: Buffer; busy?: undefined }
  | { ok: false; buffer?: undefined; busy?: true };

export function declaredSizeOk(meta: { width?: number; height?: number; pages?: number }): boolean {
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const pages = Math.max(1, meta.pages ?? 1);
  if (!(w > 0 && h > 0)) return false;
  if (w > MAX_IMAGE_SIDE || h > MAX_IMAGE_SIDE) return false;
  return w * h * pages <= MAX_INPUT_PIXELS;
}

// Full decode + re-encode - catches truncation/format mismatches (a
// malformed or mismatched file throws or fails the format check) and, as a
// side effect, strips EXIF/ICC/XMP metadata: sharp only carries that through
// to its output when withMetadata() is explicitly called, which this never
// does. That matters because a phone-camera photo's EXIF commonly embeds GPS
// coordinates - every caller MUST upload the returned buffer, never the
// original bytes, or the metadata (and any location) survives untouched.
export async function sanitizeImage(buf: Buffer, mime: string): Promise<SanitizeResult> {
  const expected = MIME_TO_FORMAT[mime];
  if (!expected) return { ok: false };
  if (sniffFormat(buf) !== expected) return { ok: false };
  const result = await withSanitizeSlot(async (): Promise<SanitizeResult> => {
    try {
      const opts = { failOn: "error" as const, limitInputPixels: MAX_INPUT_PIXELS };
      const meta = await sharp(buf, opts).metadata();
      if (meta.format !== expected || !declaredSizeOk(meta)) return { ok: false };
      const { data, info } = await sharp(buf, opts).toBuffer({ resolveWithObject: true });
      if (info.format !== expected) return { ok: false };
      return { ok: true, buffer: data };
    } catch {
      return { ok: false };
    }
  });
  return result === BUSY ? { ok: false, busy: true } : result;
}

// Boolean-only convenience wrapper, kept for callers that just need the
// validity check (see sanitizeImage above for the metadata-stripped bytes).
export async function isRealImage(buf: Buffer, mime: string): Promise<boolean> {
  return (await sanitizeImage(buf, mime)).ok;
}
