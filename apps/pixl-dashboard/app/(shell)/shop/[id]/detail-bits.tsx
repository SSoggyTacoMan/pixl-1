"use client";

import { useEffect, useState } from "react";
import { countdown, type ShopItem } from "../shop-lib";
import type { PriceState } from "./price-state";

export function DetailPrice({ ps, hint }: { ps: PriceState; hint?: string }) {
  return (
    <div className={`price detail-price${ps.cant ? " cant" : ""}`}>
      {ps.discountPct ? <span className="discount-tag">-{ps.discountPct}% OFF</span> : null}
      {ps.lockedIcon ? <span>LOCKED · </span> : null}
      {ps.amount !== null ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/pixel.png" alt="" />
          {ps.amount.toLocaleString()} PIXELS
          {ps.was !== undefined ? <span className="price-was">{ps.was.toLocaleString()} PIXELS</span> : null}
          {hint && !ps.lockedIcon ? <span className="price-hours">{hint}</span> : null}
          {ps.breakdown ? <span className="price-hours">{ps.breakdown}</span> : null}
        </>
      ) : (
        ps.text
      )}
    </div>
  );
}

export function AffordBar({ pct, label, teal }: { pct: number; label: string; teal?: boolean }) {
  return (
    <div>
      <div className="afford-label">{label}</div>
      <div className={`afford-bar${teal ? " teal" : ""}`}>
        <div className={pct >= 100 ? "full" : ""} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** LIMITED countdown (ticks every second) and per-person stock chips. */
export function LimitedChips({ item, isConfig }: { item: ShopItem; isConfig: boolean }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!item.limited || !item.limited_until) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [item.limited, item.limited_until]);

  if (isConfig) {
    return (
      <div className="chip-row">
        <span className="chip gold">FULLY CUSTOM, PRICE UPDATES AS YOU PICK</span>
      </div>
    );
  }
  const chips = [];
  if (item.limited) chips.push(<span key="l" className="chip red">LIMITED, {countdown(item.limited_until)}</span>);
  if (item.stock?.length) chips.push(<span key="s" className="chip teal">{item.stock[0].total} ONLY PER PERSON</span>);
  return chips.length ? <div className="chip-row">{chips}</div> : null;
}
