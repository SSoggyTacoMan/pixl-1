"use client";

import Link from "next/link";
import { useState } from "react";
import { bbstrip } from "@/components/markdown";
import { SafeImage } from "@/components/safe-image";
import { Notice } from "@/components/ui/primitives";
import { useAction } from "@/components/use-action";
import { claimTrophy } from "../actions";
import type { ShopItem } from "../shop-lib";
import { AffordBar } from "./detail-bits";
import { optionGroups } from "./item-lib";

/** Level-gated trophy: earned, not bought. */
export function TrophyDetail({ item, xp, claimed }: { item: ShopItem; xp: number; claimed: boolean }) {
  const claim = useAction(claimTrophy);
  const [justClaimed, setJustClaimed] = useState(false);
  const need = Number(item.unlock_xp);
  const state = claimed || justClaimed ? "claimed" : xp >= need ? "claimable" : "locked";
  const pct = Math.max(0, Math.min(100, (xp / Math.max(1, need)) * 100));

  async function doClaim() {
    const r = await claim.run({ id: item.id });
    if (r.ok) setJustClaimed(true);
  }

  return (
    <section className="panel p-5">
      <div className="detail-row">
        <div className="detail-img">
          <SafeImage src={item.image_url} fallback={<span className="ph" />} />
        </div>
        <div className="detail-info">
          <h1 className="detail-name">{item.name}</h1>
          <div className="chip-row">
            <span className={`chip${state === "locked" ? "" : " teal"}`}>LEVEL {need} TROPHY, EARNED, NOT BOUGHT</span>
          </div>
          <div className={`price detail-price${state === "locked" ? " cant" : ""}`}>
            {state === "claimed" ? "CLAIMED" : state === "claimable" ? "READY TO CLAIM!" : `LOCKED, REACH ${need} XP`}
          </div>
          <div className="detail-desc">{bbstrip(item.description || "")}</div>
          <div className="chip-row">
            {optionGroups(item)
              .flatMap((g) => g.choices)
              .map((o) => (
                <span key={o} className="chip teal">
                  {o.toUpperCase()}
                </span>
              ))}
          </div>
          <AffordBar
            teal
            pct={pct}
            label={`YOU'RE AT ${Math.floor(xp)} / ${need} XP${pct >= 100 ? ", EARNED!" : `  ·  ${need - Math.floor(xp)} to go`}`}
          />
          {justClaimed ? <Notice tone="good">TROPHY CLAIMED! The team will reach out.</Notice> : null}
          {claim.error ? <Notice tone="bad">{claim.error}</Notice> : null}
          <div className="btn-row">
            <button
              type="button"
              className={`btn${state === "claimable" ? " teal" : ""}`}
              disabled={state !== "claimable" || claim.pending}
              onClick={doClaim}
            >
              {claim.pending ? "CLAIMING..." : state === "claimed" ? "CLAIMED" : state === "claimable" ? "CLAIM" : "LOCKED"}
            </button>
            <Link className="btn dark" href="/shop">
              KEEP BROWSING
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
