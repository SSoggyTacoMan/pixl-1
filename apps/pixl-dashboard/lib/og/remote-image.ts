// Fetches an image to composite into a link-preview card. The URL comes from
// the database (a shop item's image_url, a player's avatar_url), so it's
// treated as hostile: https only, CDN allowlist only (lib/cdn-hosts.ts),
// redirects followed by hand and only while they stay on the allowlist, a
// hard timeout and a byte cap enforced while streaming. Any failure returns
// null and the caller renders a text-only card.
import { CDN_HOSTS } from "../cdn-hosts";

export const IMAGE_TIMEOUT_MS = 5000;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 2;
const ALLOWED = new Set<string>(CDN_HOSTS);

/** The parsed URL if it's an https URL on the CDN allowlist (no credentials, default port). */
export function allowedImageUrl(raw: unknown): URL | null {
  if (typeof raw !== "string" || raw.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  return ALLOWED.has(url.hostname.toLowerCase()) ? url : null;
}

async function readCapped(res: Response, cap: number): Promise<Uint8Array | null> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > cap) return null;
  if (!res.body) return null;
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel().catch(() => {});
      return null;
    }
    parts.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.byteLength;
  }
  return out;
}

export async function fetchCardImage(
  raw: unknown,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number; maxBytes?: number } = {},
): Promise<Uint8Array | null> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  let url = allowedImageUrl(raw);
  if (!url) return null;
  const signal = AbortSignal.timeout(opts.timeoutMs ?? IMAGE_TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res: Response = await fetchImpl(url.toString(), {
        redirect: "manual",
        signal,
        cache: "no-store",
        headers: { accept: "image/png,image/*;q=0.8" },
      });
      if (res.status >= 300 && res.status < 400) {
        const next: string | null = res.headers.get("location");
        await res.body?.cancel().catch(() => {});
        url = next ? allowedImageUrl(new URL(next, url).toString()) : null;
        if (!url) return null; // redirect off the allowlist (or nowhere): stop
        continue;
      }
      if (!res.ok) return null;
      return await readCapped(res, opts.maxBytes ?? MAX_IMAGE_BYTES);
    }
    return null;
  } catch {
    return null;
  }
}
