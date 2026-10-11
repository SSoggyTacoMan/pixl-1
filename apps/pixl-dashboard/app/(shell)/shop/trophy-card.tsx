"use client";

import Link from "next/link";
import { bbstrip } from "@/components/markdown";
import { SafeImage } from "@/components/safe-image";
import { Notice } from "@/components/ui/primitives";
import { useAction } from "@/components/use-action";
import { claimTrophy } from "./actions";
import type { ShopItem, TrophyState } from "./shop-lib";

export function TrophyCard({ item, xp, state }: { item: ShopItem; xp: number; state: TrophyState }) {
  const claim = useAction(claimTrophy);
  const need = Number(item.unlock_xp);
  const pct = Math.max(0, Math.min(100, (xp / Math.max(1, need)) * 100));

  return (
    <div className={`card panel trophy-card ${state}`} title={`Level ${need} trophy`}>
      <Link href={`/shop/${item.id}`} className="item-link" aria-label={item.name} />
      <div className={`trophy-tag${state === "claimed" ? " claimed" : state === "claimable" ? " ready" : ""}`}>
        {state === "claimed" ? "CLAIMED" : state === "claimable" ? "CLAIM ME!" : `LEVEL ${need}`}
      </div>
      <div className="item-img trophy-img">
        <SafeImage src={item.image_url} fallback={<span className="ph" />} />
      </div>
      <div className="item-name">{item.name}</div>
      <div className="item-desc">{bbstrip(item.description || "")}</div>
      <div className="trophy-foot">
        {state === "locked" ? (
          <>
            <div className="trophy-progress">
              <div style={{ width: `${pct}%` }} />
            </div>
            <div className="trophy-need">
              LEVEL {Math.floor(xp)} / {need} · keep shipping!
            </div>
          </>
        ) : state === "claimable" ? (
          <button
            type="button"
            className="btn teal trophy-claim"
            disabled={claim.pending}
            onClick={() => claim.run({ id: item.id })}
          >
            {claim.pending ? "CLAIMING..." : "CLAIM"}
          </button>
        ) : (
          <div className="trophy-need earned">Yours forever.</div>
        )}
        {claim.error ? <Notice tone="bad" className="mt-2">{claim.error}</Notice> : null}
      </div>
    </div>
  );
}
