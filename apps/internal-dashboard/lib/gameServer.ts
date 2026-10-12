import { sniffFormat } from "./imageSniff";

// Talks to the live PixlServer admin API (/api/admin/*), authenticated with
// this app's own service key (x-pixl-service-key = SERVICE_KEY_INTERNAL_DASHBOARD).

export interface OnlinePlayer {
  userId: string;
  displayName: string;
  scene: string;
  skin: string;
}

function config(): { url: string; key: string } | null {
  const url = process.env.PIXL_SERVER_URL;
  const key = process.env.SERVICE_KEY_INTERNAL_DASHBOARD;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

export function gameServerConfigured(): boolean {
  return config() !== null;
}

export async function fetchOnlinePlayers(): Promise<OnlinePlayer[] | null> {
  const cfg = config();
  if (!cfg) return null;
  try {
    const res = await fetch(`${cfg.url}/api/admin/online`, {
      headers: { "x-pixl-service-key": cfg.key },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const json = (await res.json()) as { ok: boolean; players?: OnlinePlayer[] };
    if (!json.ok) return null;
    return json.players ?? [];
  } catch (e) {
    console.error("fetchOnlinePlayers", (e as Error).message);
    return null;
  }
}

// Refreshes an Operation Blackout entry's tracked evidence against its live
// window (min(now, operation.ends_at)) right before a review decision is
// applied - see apps/server/src/operations/service.ts's
// refreshEntryEvidence. Best-effort: if PixlServer is unreachable we log
// and let the review proceed against whatever evidence is already on the
// row rather than blocking a reviewer entirely.
export async function refreshBlackoutEvidence(entryId: number): Promise<boolean> {
  const cfg = config();
  if (!cfg) return false;
  try {
    const res = await fetch(`${cfg.url}/api/admin/operations/refresh-evidence`, {
      method: "POST",
      headers: { "x-pixl-service-key": cfg.key, "Content-Type": "application/json" },
      body: JSON.stringify({ entryId }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json()) as { ok: boolean; error?: string };
    if (!json.ok) console.error("refreshBlackoutEvidence failed", json.error);
    return json.ok === true;
  } catch (e) {
    console.error("refreshBlackoutEvidence", (e as Error).message);
    return false;
  }
}

// Proxies an image to the same Hack Club CDN a player's own project-banner
// upload goes through (apps/server/src/routes/uploads.ts's /api/uploads) -
// used by the dashboard's "Edit submission" panel, where the person
// uploading is a reviewer rather than the project's owner, so there's no
// player session token to send.
export async function uploadSubmissionImage(file: File): Promise<string> {
  return uploadImageBuffer(Buffer.from(await file.arrayBuffer()));
}

// Raw bytes -> CDN URL via the server. The bytes must already have passed
// sniffFormat (lib/imageSniff.ts); the content type sent is the sniffed one,
// never a client-declared MIME. The server re-validates and strips metadata.
export async function uploadImageBuffer(buf: Buffer): Promise<string> {
  const format = sniffFormat(buf);
  if (!format) throw new Error("Only PNG, JPEG or WebP images can be uploaded.");
  const cfg = config();
  if (!cfg) throw new Error("Image upload disabled: PIXL_SERVER_URL / SERVICE_KEY_INTERNAL_DASHBOARD not set.");
  const res = await fetch(`${cfg.url}/api/admin/uploads`, {
    method: "POST",
    headers: { "x-pixl-service-key": cfg.key, "Content-Type": `image/${format}` },
    body: new Uint8Array(buf),
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => null)) as
    | { ok?: boolean; url?: string; error?: string }
    | null;
  if (!json?.ok || !json.url) throw new Error(json?.error || "Image upload failed.");
  return json.url;
}

export async function kickOnlinePlayer(userId: string, reason: string): Promise<boolean> {
  const cfg = config();
  if (!cfg) return false;
  try {
    const res = await fetch(`${cfg.url}/api/admin/kick`, {
      method: "POST",
      headers: { "x-pixl-service-key": cfg.key, "Content-Type": "application/json" },
      body: JSON.stringify({ userId, reason }),
      signal: AbortSignal.timeout(5000),
    });
    const json = (await res.json()) as { ok: boolean; kicked?: boolean };
    return json.ok && json.kicked === true;
  } catch (e) {
    console.error("kickOnlinePlayer", (e as Error).message);
    return false;
  }
}
