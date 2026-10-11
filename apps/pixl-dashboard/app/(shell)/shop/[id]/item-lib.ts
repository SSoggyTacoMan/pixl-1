// Option / configurator helpers for the item detail page, ported from
// apps/game/web/shop/item/index.html. Pure functions over server data.
import type { ConfigPicks, ShopItem, StockEntry } from "../shop-lib";

export interface OptionGroup {
  name: string;
  choices: string[];
}

/** "Size: S, M, L" strings become named groups; bare strings form one unnamed group. */
export function optionGroups(item: ShopItem): OptionGroup[] {
  const named: OptionGroup[] = [];
  const loose: string[] = [];
  for (const raw of Array.isArray(item.options) ? item.options : []) {
    const o = String(raw);
    const idx = o.indexOf(":");
    if (idx > 0) {
      const name = o.slice(0, idx).trim();
      const choices = o
        .slice(idx + 1)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (choices.length) named.push({ name, choices });
    } else if (o.trim()) {
      loose.push(o.trim());
    }
  }
  if (loose.length) named.unshift({ name: "", choices: loose });
  return named;
}

export function stockMap(item: ShopItem): Map<string, StockEntry> {
  const m = new Map<string, StockEntry>();
  for (const s of Array.isArray(item.stock) ? item.stock : []) m.set(s.choice, s);
  return m;
}

/** The option group whose choices are all stock-tracked, or -1. */
export function stockGroupIndex(groups: OptionGroup[], stock: Map<string, StockEntry>): number {
  if (!stock.size) return -1;
  return groups.findIndex((g) => g.choices.length > 0 && g.choices.every((c) => stock.has(c)));
}

export function firstAvailableChoice(choices: string[], stock: Map<string, StockEntry>): string {
  return choices.find((c) => !stock.has(c) || (stock.get(c)?.remaining ?? 0) > 0) ?? choices[0];
}

/** Picks per group index, defaulting to the first (in-stock) choice. */
export function resolvePicks(item: ShopItem, picks: Record<number, string>): Record<number, string> {
  const groups = optionGroups(item);
  const stock = stockMap(item);
  const sIdx = stockGroupIndex(groups, stock);
  const out: Record<number, string> = {};
  groups.forEach((g, gi) => {
    let pick = picks[gi] ?? g.choices[0];
    if (gi === sIdx && (stock.get(pick)?.remaining ?? 1) <= 0) pick = firstAvailableChoice(g.choices, stock);
    out[gi] = pick;
  });
  return out;
}

export function stockChoice(item: ShopItem, picks: Record<number, string>): string {
  const groups = optionGroups(item);
  const sIdx = stockGroupIndex(groups, stockMap(item));
  return sIdx === -1 ? "" : (picks[sIdx] ?? "");
}

export function stockOk(item: ShopItem, picks: Record<number, string>, quantity: number): boolean {
  const choice = stockChoice(item, picks);
  if (!choice) return true;
  const s = stockMap(item).get(choice);
  return !s || s.remaining >= quantity;
}

/**
 * Total of a configurator build: the server's base price plus the server's
 * per-choice prices for what's picked. This is catalog arithmetic, not an
 * economy formula; apps/server recomputes it on buy and is authoritative.
 */
export function configTotal(item: ShopItem, picks: ConfigPicks): number {
  const cfg = item.config_options;
  if (!cfg) return Number(item.price);
  let total = Number(cfg.base_price) || 0;
  for (const g of cfg.groups ?? []) {
    if (g.type === "multi") {
      const chosen = new Set((picks[g.name] as string[] | undefined) ?? []);
      for (const c of g.choices) if (chosen.has(c.label)) total += Number(c.price) || 0;
    } else {
      const pick = (picks[g.name] as string | undefined) ?? g.choices[0]?.label;
      const c = g.choices.find((x) => x.label === pick) ?? g.choices[0];
      total += Number(c?.price) || 0;
    }
  }
  return total;
}

/** A single-choice pick may carry its own image (e.g. A1 vs A1 Combo). */
export function configImage(item: ShopItem, picks: ConfigPicks): string | null {
  let img: string | null = null;
  for (const g of item.config_options?.groups ?? []) {
    if (g.type === "multi") continue;
    const label = (picks[g.name] as string | undefined) ?? g.choices[0]?.label;
    const choice = g.choices.find((c) => c.label === label);
    if (choice?.image) img = choice.image;
  }
  return img ?? item.image_url ?? null;
}

export function optionSummary(item: ShopItem, picks: Record<number, string>, config: ConfigPicks): string {
  if (item.config_options) {
    return (item.config_options.groups ?? [])
      .map((g) => {
        if (g.type === "multi") {
          const p = (config[g.name] as string[] | undefined) ?? [];
          return p.length ? `${g.name}: ${p.join(", ")}` : null;
        }
        return `${g.name}: ${(config[g.name] as string | undefined) ?? g.choices[0]?.label}`;
      })
      .filter(Boolean)
      .join(" · ");
  }
  return optionGroups(item)
    .map((g, gi) => {
      const pick = picks[gi] ?? g.choices[0];
      return g.name ? `${g.name}: ${pick}` : pick;
    })
    .join(" · ");
}
