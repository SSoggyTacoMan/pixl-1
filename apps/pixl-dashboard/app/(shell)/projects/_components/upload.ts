"use client";

// Client wrappers around the upload Server Actions: check type/size before
// sending (same caps as apps/server/src/routes/uploads.ts) so the player
// gets a precise message instead of a generic invalid_input.
import { uploadBom, uploadImage } from "../actions";
import { projectError } from "../errors";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE_BYTES = 15_000_000;
const MAX_CSV_BYTES = 512 * 1024;

export type UploadOutcome = { ok: true; url: string } | { ok: false; message: string };

export async function uploadImageFile(file: File): Promise<UploadOutcome> {
  if (!IMAGE_TYPES.includes(file.type)) return { ok: false, message: projectError("unsupported_type") };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, message: projectError("file_too_large") };
  if (file.size === 0) return { ok: false, message: projectError("empty_body") };
  const fd = new FormData();
  fd.append("file", file);
  try {
    const r = await uploadImage(fd);
    if (r.ok && r.data.url) return { ok: true, url: r.data.url };
    return { ok: false, message: projectError(r.ok ? "cdn_failed" : r.error) };
  } catch {
    return { ok: false, message: projectError("cdn_failed") };
  }
}

export async function uploadBomFile(file: File, projectId: number): Promise<UploadOutcome> {
  if (!projectId) return { ok: false, message: projectError("project_required") };
  if (file.size > MAX_CSV_BYTES) return { ok: false, message: projectError("file_too_large") };
  if (file.size === 0) return { ok: false, message: projectError("empty_body") };
  const fd = new FormData();
  fd.append("file", file);
  fd.append("projectId", String(projectId));
  try {
    const r = await uploadBom(fd);
    if (r.ok && r.data.url) return { ok: true, url: r.data.url };
    return { ok: false, message: projectError(r.ok ? "cdn_failed" : r.error) };
  } catch {
    return { ok: false, message: projectError("cdn_failed") };
  }
}
