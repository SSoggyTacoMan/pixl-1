/**
 * Link-preview cards for Pixl Dashboard's core pages (/dashboard, /shop, ...),
 * drawn by the same renderCard() as the doc cards so every preview on the site
 * comes from one theme-aware renderer.
 *
 *   bun run previews:build
 *
 * Writes apps/pixl-dashboard/public/<slug>/og.png. Each page's own
 * generateMetadata points og:image at `${config.urls.site}/<slug>/og.png`.
 * (The old version injected meta blocks into the hand-written HTML pages in
 * apps/game/web, which no longer exists.)
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { renderCard } from "./src/og.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const OUT = `${ROOT}apps/pixl-dashboard/public`;

const SITE: string = JSON.parse(
  await Bun.file(`${ROOT}packages/config/pixl.json`).text(),
).urls.site;
const SITE_HOST = SITE.replace(/^https?:\/\//, "");

interface PageMeta {
  slug: string;
  title: string;
  eyebrow: string;
}

// Only the routes Pixl Dashboard actually serves.
const pages: PageMeta[] = [
  { slug: "dashboard", title: "Dashboard", eyebrow: "Dashboard" },
  { slug: "projects", title: "Projects", eyebrow: "Ships" },
  { slug: "shop", title: "Shop", eyebrow: "Shop" },
  { slug: "orders", title: "Orders", eyebrow: "Shop" },
  { slug: "quests", title: "Quests", eyebrow: "Progress" },
  { slug: "trials", title: "Trials", eyebrow: "Progress" },
  { slug: "account", title: "Account", eyebrow: "Account" },
  { slug: "report", title: "Report", eyebrow: "Moderation" },
];

for (const page of pages) {
  const dir = `${OUT}/${page.slug}`;
  await mkdir(dir, { recursive: true });
  await writeFile(
    `${dir}/og.png`,
    renderCard({ title: page.title, eyebrow: page.eyebrow, url: `${SITE_HOST}/${page.slug}` }),
  );
}

console.log(`[previews] wrote ${pages.length} og.png cards under apps/pixl-dashboard/public/`);
