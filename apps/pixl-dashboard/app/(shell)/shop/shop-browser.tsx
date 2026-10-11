"use client";

// Catalog grid: search, sort, price tiers, categories, saved/unlocked
// toggles, region switch. All filtering is over the server's item list.
import { useMemo, useState } from "react";
import { Notice } from "@/components/ui/primitives";
import { useAction } from "@/components/use-action";
import { saveItem, unsaveItem } from "./actions";
import type { EarnRates } from "../calc/estimates";
import { ItemCard } from "./item-card";
import { RegionSelect } from "./region-select";
import { CATEGORIES, basePrice, isTrophy, trophyState, type ShopItem } from "./shop-lib";
import { TrophyCard } from "./trophy-card";

type Tier = "all" | "afford" | "under" | "over";
type Sort = "featured" | "cheap" | "pricey" | "name";

const TIERS: [Tier, string][] = [
  ["all", "ALL"],
  ["afford", "AFFORDABLE NOW"],
  ["under", "UNDER 500"],
  ["over", "500+"],
];

export function ShopBrowser({
  items: initialItems,
  xp,
  claimed,
  region,
  pixels,
  rates,
}: {
  items: ShopItem[];
  xp: number;
  claimed: number[];
  region: string;
  pixels: number | null;
  rates: EarnRates | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("featured");
  const [tier, setTier] = useState<Tier>("all");
  const [category, setCategory] = useState("all");
  const [unlockedOnly, setUnlockedOnly] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const claimedSet = useMemo(() => new Set(claimed), [claimed]);
  const save = useAction(saveItem);
  const unsave = useAction(unsaveItem);

  // Server props win after a revalidation (region switch, claim).
  const [seen, setSeen] = useState(initialItems);
  if (seen !== initialItems) {
    setSeen(initialItems);
    setItems(initialItems);
  }

  const canAfford = (i: ShopItem) => pixels !== null && pixels >= basePrice(i);
  const needle = q.trim().toLowerCase();
  const match = (i: ShopItem) =>
    !needle || i.name.toLowerCase().includes(needle) || String(i.description || "").toLowerCase().includes(needle);
  const tierMatch = (i: ShopItem) =>
    tier === "afford" ? canAfford(i) : tier === "under" ? basePrice(i) < 500 : tier === "over" ? basePrice(i) >= 500 : true;

  const trophies = items
    .filter((i) => isTrophy(i) && match(i))
    .filter((i) => !unlockedOnly || trophyState(i, xp, claimedSet) !== "locked");

  let list = items.filter(
    (i) =>
      !isTrophy(i) &&
      match(i) &&
      tierMatch(i) &&
      (category === "all" || (i.category || "other") === category) &&
      (!savedOnly || i.saved),
  );
  if (sort === "cheap") list = [...list].sort((a, b) => basePrice(a) - basePrice(b));
  else if (sort === "pricey") list = [...list].sort((a, b) => basePrice(b) - basePrice(a));
  else if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  else list = [...list].sort((a, b) => (a.category === "grants" ? 1 : 0) - (b.category === "grants" ? 1 : 0));
  list = [...list].sort((a, b) => (b.saved ? 1 : 0) - (a.saved ? 1 : 0));

  async function toggleSave(item: ShopItem) {
    const nowSaved = !item.saved;
    const flip = (v: boolean) => setItems((all) => all.map((i) => (i.id === item.id ? { ...i, saved: v } : i)));
    flip(nowSaved);
    const r = nowSaved
      ? await save.run({ id: item.id, option: item.saved_option || "", config: item.saved_config ?? null })
      : await unsave.run({ id: item.id });
    if (!r.ok) flip(!nowSaved);
  }

  const err = save.error || unsave.error;

  return (
    <div className="shop">
      <div className="shop-controls">
        <input className="field" type="search" placeholder="Search the shelves..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search items" />
        <select className="field" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
          <option value="featured">FEATURED</option>
          <option value="cheap">PRICE ↑</option>
          <option value="pricey">PRICE ↓</option>
          <option value="name">A–Z</option>
        </select>
        <RegionSelect region={region} />
      </div>

      <div className="tiers">
        {TIERS.map(([v, l]) => (
          <button key={v} type="button" className={`tier${tier === v ? " on" : ""}`} onClick={() => setTier(v)}>
            {l}
          </button>
        ))}
        <button type="button" className={`tier${unlockedOnly ? " on" : ""}`} onClick={() => setUnlockedOnly((v) => !v)}>
          UNLOCKED ONLY
        </button>
        <button type="button" className={`tier${savedOnly ? " on" : ""}`} onClick={() => setSavedOnly((v) => !v)}>
          ★ SAVED
        </button>
      </div>
      <div className="tiers">
        {CATEGORIES.map(([v, l]) => (
          <button key={v} type="button" className={`tier${category === v ? " on" : ""}`} onClick={() => setCategory(v)}>
            {l}
          </button>
        ))}
      </div>

      {err ? <Notice tone="bad" className="mb-4">Couldn&apos;t update that save: {err}</Notice> : null}

      {trophies.length > 0 ? (
        <>
          <div className="shop-section-h">
            <span className="t">✦ RESTORATION REWARDS</span>
            <span className="s">Earned by leveling up, not for sale</span>
          </div>
          <div className="grid">
            {trophies.map((i) => (
              <TrophyCard key={i.id} item={i} xp={xp} state={trophyState(i, xp, claimedSet)} />
            ))}
          </div>
          <div className="divider" />
        </>
      ) : null}

      {list.length > 0 ? (
        <div className="grid">
          {list.map((i) => (
            <ItemCard key={i.id} item={i} canAfford={canAfford(i)} rates={rates} onToggleSave={() => toggleSave(i)} />
          ))}
        </div>
      ) : null}

      {list.length + trophies.length === 0 ? (
        <div className="empty-note">NOTHING ON THESE SHELVES.<br />TRY ANOTHER FILTER.</div>
      ) : null}
    </div>
  );
}
