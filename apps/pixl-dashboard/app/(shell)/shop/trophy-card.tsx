"use client";

import Link from "next/link";
import { bbstrip } from "@/components/markdown";
import { SafeImage } from "@/components/safe-image";
import { Button, card, Notice } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { useAction } from "@/components/use-action";
import { claimTrophy } from "./actions";
import type { ShopItem, TrophyState } from "./shop-lib";
import { imgPlaceholder, itemDesc, itemImg, itemName, slotImg } from "./shop-styles";

export function TrophyCard({ item, xp, state }: { item: ShopItem; xp: number; state: TrophyState }) {
  const claim = useAction(claimTrophy);
  const need = Number(item.unlock_xp);
  const pct = Math.max(0, Math.min(100, (xp / Math.max(1, need)) * 100));

  return (
    <div
      className={cn(card, "relative flex flex-col gap-[10px] px-[13px] pt-[13px] pb-[15px]")}
      title={`Level ${need} trophy`}
    >
      <Link href={`/shop/${item.id}`} className="absolute inset-0 z-1" aria-label={item.name} />
      <div
        className={cn(
          "self-start border-2 border-stroke bg-panel-2 px-[7px] py-[3px] font-pixel text-[10px] tracking-[1px] text-dim",
          state === "claimed" && "bg-good text-btn-ink",
          state === "claimable" && "bg-teal text-btn-ink",
        )}
      >
        {state === "claimed" ? "CLAIMED" : state === "claimable" ? "CLAIM ME!" : `LEVEL ${need}`}
      </div>
      <div className={itemImg}>
        <SafeImage src={item.image_url} className={slotImg} fallback={<span className={imgPlaceholder} />} />
      </div>
      <div className={itemName}>{item.name}</div>
      <div className={itemDesc}>{bbstrip(item.description || "")}</div>
      <div className="relative z-2 mt-auto">
        {state === "locked" ? (
          <>
            <div className="h-[10px] border-2 border-stroke bg-panel-deep">
              <div className="h-full bg-teal" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-[6px] text-[12px] text-faint">
              LEVEL {Math.floor(xp)} / {need} · keep shipping!
            </div>
          </>
        ) : state === "claimable" ? (
          <Button
            variant="teal"
            className="relative z-2"
            disabled={claim.pending}
            onClick={() => claim.run({ id: item.id })}
          >
            {claim.pending ? "CLAIMING..." : "CLAIM"}
          </Button>
        ) : (
          <div className="mt-[6px] text-[12px] text-good">Yours forever.</div>
        )}
        {claim.error ? <Notice tone="bad" className="mt-2">{claim.error}</Notice> : null}
      </div>
    </div>
  );
}
