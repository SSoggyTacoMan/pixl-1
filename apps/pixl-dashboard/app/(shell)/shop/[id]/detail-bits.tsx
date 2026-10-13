"use client";

import { useEffect, useState } from "react";
import { badgeVariants } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { countdown, type ShopItem } from "../shop-lib";
import { chipRow, detailPriceSize, discountTag, priceClass, priceHours, priceWas } from "../shop-styles";
import type { PriceState } from "./price-state";

export function DetailPrice({ ps, hint }: { ps: PriceState; hint?: string }) {
  return (
    <div className={cn(priceClass(ps.cant), detailPriceSize)}>
      {ps.discountPct ? <span className={discountTag}>-{ps.discountPct}% OFF</span> : null}
      {ps.lockedIcon ? <span>LOCKED · </span> : null}
      {ps.amount !== null ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/pixel.png" alt="" />
          {ps.amount.toLocaleString()} PIXELS
          {ps.was !== undefined ? <span className={priceWas}>{ps.was.toLocaleString()} PIXELS</span> : null}
          {hint && !ps.lockedIcon ? <span className={priceHours}>{hint}</span> : null}
          {ps.breakdown ? <span className={priceHours}>{ps.breakdown}</span> : null}
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
      <div className="mb-[6px] text-[13px] font-bold text-muted">{label}</div>
      <div className="h-[14px] border-2 border-stroke bg-panel-deep">
        <div
          className={cn(
            "h-full",
            teal
              ? "bg-[repeating-linear-gradient(90deg,var(--teal)_0_7px,var(--teal-hover)_7px_14px)]"
              : pct >= 100
                ? "bg-good"
                : "bg-[repeating-linear-gradient(90deg,var(--gold)_0_7px,var(--gold-soft)_7px_14px)]",
          )}
          style={{ width: `${pct}%` }}
        />
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
      <div className={chipRow}>
        <span className={badgeVariants({ tone: "gold" })}>FULLY CUSTOM, PRICE UPDATES AS YOU PICK</span>
      </div>
    );
  }
  const chips = [];
  if (item.limited) chips.push(<span key="l" className={badgeVariants({ tone: "red" })}>LIMITED, {countdown(item.limited_until)}</span>);
  if (item.stock?.length) chips.push(<span key="s" className={badgeVariants({ tone: "teal" })}>{item.stock[0].total} ONLY PER PERSON</span>);
  return chips.length ? <div className={chipRow}>{chips}</div> : null;
}
