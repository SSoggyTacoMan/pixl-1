// Render-side guards for any URL that came from a database row or a player.
// apps/server validates repo/demo URLs at save time; this is the backstop for
// old rows and any field that skipped that check.

/** The URL if it's absolute http(s), else null. Never returns javascript:, data:, etc. */
export function safeHttpUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const s = url.trim();
  if (!s || s.length > 2048) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Image source: https URLs or same-origin absolute paths (/img/...). */
export function safeImageSrc(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const s = url.trim();
  if (s.startsWith("/") && !s.startsWith("//") && !s.includes("\\")) return s;
  const u = safeHttpUrl(s);
  return u && u.startsWith("https://") ? u : null;
}

/** Navigation targets returned by apps/server flows (verify address, Hackatime, ...). */
export function safeFlowUrl(url: unknown): string | null {
  const u = safeHttpUrl(url);
  return u && u.startsWith("https://") ? u : null;
}
