// Link-preview (Open Graph) PNGs for shop items and players. They read ONLY
// apps/server's public, session-free endpoints, render with
// packages/docs-engine, and never fail: any miss renders a generic card,
// since a broken og:image is a blank box in every chat client.
//
// Only public fields reach a card: item name/price/photo, a player's public
// display name, level, approved hours, ship count and join year. Never a
// legal name, email, Slack ID or address.
import { renderCard } from "@pixl/docs-engine/src/og.ts";
import { renderPlayerCard } from "@pixl/docs-engine/src/playerOg.ts";
import { renderItemCard } from "@pixl/docs-engine/src/shopOg.ts";
import { config } from "@/app/_generated/config";
import { serverFetch } from "../server-api-core";
import { fetchCardImage } from "./remote-image";

export const OG_SIZE = { width: 1200, height: 630 };
const SITE_HOST = config.urls.site.replace(/^https?:\/\//, "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CardDeps {
  fetchImpl?: typeof fetch;
}

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");

/** Public item fields for the card; null if the item isn't public. */
async function publicItem(id: number, deps: CardDeps) {
  const r = await serverFetch<{ item?: { name?: unknown; price?: unknown; image_url?: unknown } }>(
    `/api/shop/item/${id}/public`,
    {},
    deps.fetchImpl,
  );
  const item = r.ok ? r.data?.item : null;
  if (!item) return null;
  return { name: clip(item.name, 120), price: Number(item.price) || 0, imageUrl: item.image_url };
}

export async function shopItemCard(rawId: string, deps: CardDeps = {}): Promise<Uint8Array> {
  const id = Number(rawId);
  const generic = () => renderCard({ title: "The Pixl Shop", eyebrow: "Pixl Shop", url: `${SITE_HOST}/shop` });
  if (!/^\d{1,10}$/.test(rawId) || !Number.isSafeInteger(id) || id <= 0) return generic();
  try {
    const item = await publicItem(id, deps);
    if (!item || !item.name) return generic();
    const imageBytes = await fetchCardImage(item.imageUrl, { fetchImpl: deps.fetchImpl });
    return renderItemCard({ name: item.name, price: item.price, imageBytes, footer: `${SITE_HOST}/shop` });
  } catch {
    return generic();
  }
}

export async function playerCard(rawId: string, deps: CardDeps = {}): Promise<Uint8Array> {
  const generic = () =>
    renderPlayerCard({ name: "Pixl", level: 0, hours: 0, projects: 0, joined: null, siteHost: SITE_HOST, avatarBytes: null });
  if (!UUID.test(rawId)) return generic();
  try {
    const r = await serverFetch<{
      player?: { display_name?: unknown; avatar_url?: unknown; created_at?: unknown; level?: unknown; xp_hours?: unknown };
      projects?: unknown[];
    }>(`/api/explore/players/${rawId.toLowerCase()}/public`, {}, deps.fetchImpl);
    const player = r.ok ? r.data?.player : null;
    if (!r.ok || !player) return generic();
    const ships = Array.isArray(r.data?.projects) ? r.data.projects.length : 0;
    const avatarBytes = await fetchCardImage(player.avatar_url, { fetchImpl: deps.fetchImpl });
    return renderPlayerCard({
      name: clip(player.display_name, 80) || "A Pixl builder",
      level: Number(player.level) || 0,
      hours: Number(player.xp_hours) || 0,
      projects: ships,
      joined: typeof player.created_at === "string" ? player.created_at : null,
      siteHost: SITE_HOST,
      avatarBytes,
    });
  } catch {
    return generic();
  }
}

/** PNG response for an opengraph-image route; cached at the edge for an hour. */
export function pngResponse(png: Uint8Array): Response {
  return new Response(png as BodyInit, {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
