"use client";

import Link from "next/link";
import { bbstrip } from "@/components/markdown";
import { SafeImage } from "@/components/safe-image";
import { PriceTag } from "./price-tag";
import { basePrice, isDiscounted, isPending, lockReason, metaBits, originalBasePrice, type ShopItem } from "./shop-lib";

function Foot({ item, canAfford }: { item: ShopItem; canAfford: boolean }) {
  if (item.locked && item.unlockPending) {
    return (
      <div className="price-wrap">
        <span className="price cant">NOT AVAILABLE</span>
        <span className="price-hours">Available soon</span>
      </div>
    );
  }
  if (item.locked) {
    return (
      <div className="price-wrap">
        <PriceTag amount={basePrice(item)} from={!!item.config_options} cant locked />
        <span className="price-hours">{lockReason(item)}</span>
      </div>
    );
  }
  if (isPending(item)) {
    return (
      <div className="price-wrap">
        <span className="price cant">NOT AVAILABLE</span>
        <span className="price-hours">{item.name === "Food Grant" ? "Available soon" : "Coming soon to this region"}</span>
      </div>
    );
  }
  return (
    <>
      <div className="price-wrap">
        {isDiscounted(item) ? <span className="discount-tag">-{Math.round(Number(item.discount_percent))}% OFF</span> : null}
        <PriceTag
          amount={basePrice(item)}
          from={!!item.config_options}
          cant={!canAfford}
          was={isDiscounted(item) ? originalBasePrice(item) : undefined}
        />
        {item.beacon_locked ? (
          <span className="price-hours beacon-note">Uses a Beacon unlock ({item.beaconAvailable ?? 0} available)</span>
        ) : null}
      </div>
      <span className={`dot ${canAfford ? "on" : "off"}`} title={canAfford ? "You can afford this" : "Keep shipping!"} />
    </>
  );
}

export function ItemCard({
  item,
  canAfford,
  onToggleSave,
}: {
  item: ShopItem;
  canAfford: boolean;
  onToggleSave: () => void;
}) {
  const meta = metaBits(item);
  return (
    <div className={`card panel item-card${item.limited ? " limited" : ""}${item.locked ? " locked" : ""}`}>
      <Link href={`/shop/${item.id}`} className="item-link" aria-label={item.name} />
      {item.locked && !item.unlockPending ? <div className="corner-tag locked-tag">LOCKED</div> : null}
      {item.limited ? <div className="corner-tag limited-tag">LIMITED</div> : null}
      {item.is_new && !item.limited ? <div className="corner-tag new-tag">NEW</div> : null}
      {item.stock && item.stock.length ? <div className="corner-tag stock-tag-corner">{item.stock[0].total} ONLY</div> : null}
      <div className="item-img">
        <SafeImage src={item.image_url} fallback={<span className="ph" />} />
        <button
          type="button"
          className={`pin-btn${item.saved ? " on" : ""}`}
          title={item.saved ? "Saved, click to unsave" : "Save this item"}
          aria-pressed={!!item.saved}
          onClick={onToggleSave}
        >
          {item.saved ? "★" : "☆"}
        </button>
      </div>
      <div className="item-name">{item.name}</div>
      <div className="item-desc">{bbstrip(item.description || "")}</div>
      {meta.length ? <div className="item-meta">{meta.join(" · ")}</div> : null}
      <div className="item-foot">
        <Foot item={item} canAfford={canAfford} />
      </div>
    </div>
  );
}
