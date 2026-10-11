import sharp from "sharp";

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
  | { ok: true; buffer: Buffer }
  | { ok: false; buffer?: undefined };

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
  try {
    const { data, info } = await sharp(buf, { failOn: "error" }).toBuffer({ resolveWithObject: true });
    if (info.format !== expected) return { ok: false };
    return { ok: true, buffer: data };
  } catch {
    return { ok: false };
  }
}

// Boolean-only convenience wrapper, kept for callers that just need the
// validity check (see sanitizeImage above for the metadata-stripped bytes).
export async function isRealImage(buf: Buffer, mime: string): Promise<boolean> {
  return (await sanitizeImage(buf, mime)).ok;
}
