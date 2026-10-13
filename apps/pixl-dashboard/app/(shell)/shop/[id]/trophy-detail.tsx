"use client";

import Link from "next/link";
import { useState } from "react";
import { bbstrip } from "@/components/markdown";
import { SafeImage } from "@/components/safe-image";
import { Badge, Button, buttonVariants, Notice, panel } from "@/components/ui/primitives";
import { useAction } from "@/components/use-action";
import { cn } from "@/lib/cn";
import { claimTrophy } from "../actions";
import { shopError } from "../shop-errors";
import type { ShopItem } from "../shop-lib";
import { AffordBar } from "./detail-bits";
import { optionGroups } from "./item-lib";
import {
  btnRow,
  chipRow,
  detailDesc,
  detailImg,
  detailInfo,
  detailName,
  detailPriceSize,
  detailRow,
  imgPlaceholder,
  priceClass,
  slotImg,
} from "../shop-styles";

/** Level-gated trophy: earned, not bought. */
export function TrophyDetail({ item, xp, claimed }: { item: ShopItem; xp: number; claimed: boolean }) {
  const claim = useAction(claimTrophy, shopError);
  const [justClaimed, setJustClaimed] = useState(false);
  const need = Number(item.unlock_xp);
  const state = claimed || justClaimed ? "claimed" : xp >= need ? "claimable" : "locked";
  const pct = Math.max(0, Math.min(100, (xp / Math.max(1, need)) * 100));

  async function doClaim() {
    const r = await claim.run({ id: item.id });
    if (r.ok) setJustClaimed(true);
  }

  return (
    <section className={cn(panel, "p-5")}>
      <div className={detailRow}>
        <div className={detailImg}>
          <SafeImage src={item.image_url} className={slotImg} fallback={<span className={imgPlaceholder} />} />
        </div>
        <div className={detailInfo}>
          <h1 className={detailName}>{item.name}</h1>
          <div className={chipRow}>
            <Badge tone={state === "locked" ? "default" : "teal"}>LEVEL {need} TROPHY, EARNED, NOT BOUGHT</Badge>
          </div>
          <div className={cn(priceClass(state === "locked"), detailPriceSize)}>
            {state === "claimed" ? "CLAIMED" : state === "claimable" ? "READY TO CLAIM!" : `LOCKED, REACH ${need} XP`}
          </div>
          <div className={detailDesc}>{bbstrip(item.description || "")}</div>
          <div className={chipRow}>
            {optionGroups(item)
              .flatMap((g) => g.choices)
              .map((o) => (
                <Badge key={o} tone="teal">
                  {o.toUpperCase()}
                </Badge>
              ))}
          </div>
          <AffordBar
            teal
            pct={pct}
            label={`YOU'RE AT ${Math.floor(xp)} / ${need} XP${pct >= 100 ? ", EARNED!" : `  ·  ${need - Math.floor(xp)} to go`}`}
          />
          {justClaimed ? <Notice tone="good">TROPHY CLAIMED! The team will reach out.</Notice> : null}
          {claim.error ? <Notice tone="bad">{claim.error}</Notice> : null}
          <div className={btnRow}>
            <Button
              variant={state === "claimable" ? "teal" : "default"}
              disabled={state !== "claimable" || claim.pending}
              onClick={doClaim}
            >
              {claim.pending ? "CLAIMING..." : state === "claimed" ? "CLAIMED" : state === "claimable" ? "CLAIM" : "LOCKED"}
            </Button>
            <Link className={buttonVariants({ variant: "dark" })} href="/shop">
              KEEP BROWSING
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
