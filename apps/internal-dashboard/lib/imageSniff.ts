// Magic-byte check run BEFORE any image reaches sharp. sharp picks its decoder
// from the bytes, not the declared MIME, so an SVG (librsvg) or any other
// exotic format would otherwise be parsed - the 2026-10-11 RCE path. Only
// these three raster signatures may reach sharp. Same rules as
// apps/server/src/imageValidation.ts sniffFormat (copied, not imported: each
// app builds from its own folder).
export type RasterFormat = "png" | "jpeg" | "webp";

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function sniffFormat(buf: Uint8Array): RasterFormat | null {
  if (buf.length >= 8 && PNG_MAGIC.every((b, i) => buf[i] === b)) return "png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  const ascii = (from: number, to: number) => String.fromCharCode(...buf.subarray(from, to));
  if (buf.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  return null;
}
