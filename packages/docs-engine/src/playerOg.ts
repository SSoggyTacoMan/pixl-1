// 1200x630 player preview card - what a shared /explore/players/<id> link
// unfurls to. Same LEDGER frame as renderCard (./og.ts) and renderItemCard
// (./shopOg.ts), laid out around the builder: avatar (or an initial tile),
// public display name, and the stats the profile shows. Ported from the old
// apps/game/web/api/_lib/playerCard.ts. Only public profile fields go in:
// never a legal name, email or address.
import { Canvas, decodePNG, type DecodedImage } from "./png.ts";
import { drawText, textWidth, wrap, GLYPH_H } from "./font.ts";
import { BG, PANEL, STROKE, GOLD, INK, DIM, TEAL, shard } from "./og.ts";

const W = 1200;
const H = 630;
const STAT_GAP = 34;

export interface PlayerCardInput {
  /** Public display name. */
  name: string;
  level: number;
  /** Approved hours. */
  hours: number;
  /** Approved ships. */
  projects: number;
  /** ISO join date; only the year is shown. */
  joined: string | null;
  /** Canonical host for the footer, e.g. "pixl.hackclub.com". */
  siteHost: string;
  /** Avatar PNG bytes, or null (falls back to an initial tile). */
  avatarBytes: Uint8Array | null;
}

// Trims until the text fits: names are free text and a single long word
// can't be wrapped.
function ellipsize(text: string, scale: number, maxWidth: number, tracking = 1): string {
  if (textWidth(text, scale, tracking) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && textWidth(`${cut}...`, scale, tracking) > maxWidth) cut = cut.slice(0, -1);
  return `${cut.replace(/[.\s]+$/, "")}...`;
}

function statWidth(label: string, value: string, valueScale: number): number {
  return Math.max(textWidth(label, 3, 2), textWidth(value, valueScale, 1));
}

// Largest value size at which the whole stat strip still fits.
function fitStatScale(cells: [string, string][], maxWidth: number): number {
  for (let s = 7; s > 3; s--) {
    const total = cells.reduce((sum, [l, v]) => sum + statWidth(l, v, s), 0) + STAT_GAP * (cells.length - 1);
    if (total <= maxWidth) return s;
  }
  return 3;
}

export function renderPlayerCard({ name, level, hours, projects, joined, siteHost, avatarBytes }: PlayerCardInput): Uint8Array {
  const canvas = new Canvas(W, H, BG);

  const pad = 48;
  canvas.fill(pad, pad, W - pad * 2, H - pad * 2, PANEL);
  canvas.stroke(pad, pad, W - pad * 2, H - pad * 2, 3, STROKE);
  canvas.fill(pad, pad, 8, H - pad * 2, GOLD);

  const box = 300;
  const boxX = pad + 64;
  const boxY = (H - box) / 2;
  canvas.fill(boxX, boxY, box, box, BG);
  canvas.stroke(boxX, boxY, box, box, 2, STROKE);

  let avatar: DecodedImage | null = null;
  if (avatarBytes) {
    try {
      avatar = decodePNG(avatarBytes);
    } catch {
      avatar = null; // not a PNG we can decode: the initial tile covers it
    }
  }
  if (avatar) {
    const inset = 12;
    canvas.drawImage(avatar, boxX + inset, boxY + inset, box - inset * 2, box - inset * 2);
  } else {
    const initial = (name.trim()[0] ?? "?").toUpperCase();
    const scale = 22;
    drawText(canvas, initial, boxX + (box - textWidth(initial, scale, 1)) / 2, boxY + (box - GLYPH_H * scale) / 2, scale, GOLD);
  }

  const left = boxX + box + 64;
  const right = W - pad - 64;
  const maxWidth = right - left;

  shard(canvas, left + 10, pad + 78, 5, GOLD);
  drawText(canvas, "PIXL BUILDER", left + 44, pad + 80, 4, GOLD, 2);

  const footY = H - pad - 78;
  const statTop = footY - 28 - (GLYPH_H * 3 + 16 + GLYPH_H * 7);
  const blockTop = pad + 176;
  const nameSpace = statTop - 28 - blockTop;
  const lineHeightAt = (s: number) => GLYPH_H * s + 20;

  let scale = 11;
  let lines = wrap(name.toUpperCase(), scale, maxWidth);
  while (scale > 4 && lines.length * lineHeightAt(scale) > nameSpace) {
    scale -= 1;
    lines = wrap(name.toUpperCase(), scale, maxWidth);
  }
  const lineHeight = lineHeightAt(scale);
  const maxLines = Math.max(1, Math.floor(nameSpace / lineHeight));
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[lines.length - 1] = `${lines[lines.length - 1]!}...`;
  }
  lines = lines.map((line) => ellipsize(line, scale, maxWidth));
  const nameTop = blockTop + Math.max(0, (nameSpace - lines.length * lineHeight) / 2);
  lines.forEach((line, i) => drawText(canvas, line, left, nameTop + i * lineHeight, scale, INK));

  const cells: [string, string][] = [
    ["LEVEL", String(Number.isFinite(level) ? level : 0)],
    ["HOURS", `${Math.round(Number.isFinite(hours) ? hours : 0)}H`],
    ["SHIPS", String(projects)],
  ];
  const year = joined ? new Date(joined).getUTCFullYear() : NaN;
  if (Number.isFinite(year)) cells.push(["JOINED", String(year)]);
  const valueScale = fitStatScale(cells, maxWidth);
  let statX = left;
  for (const [label, value] of cells) {
    drawText(canvas, label, statX, statTop, 3, DIM, 2);
    drawText(canvas, value, statX, statTop + GLYPH_H * 3 + 16, valueScale, INK, 1);
    statX += statWidth(label, value, valueScale) + STAT_GAP;
  }

  canvas.fill(left, footY, maxWidth, 2, STROKE);
  drawText(canvas, siteHost.toUpperCase(), left, footY + 26, 3, TEAL, 2);

  return canvas.encode();
}
