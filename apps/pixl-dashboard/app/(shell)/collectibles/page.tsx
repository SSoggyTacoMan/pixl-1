import type { Metadata } from "next";
import { SafeImage } from "@/components/safe-image";
import { EmptyNote, PageHeader, panel } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { serverGet } from "@/lib/server-api";
import { progressPct, type CollectibleItem, type CollectiblesResponse } from "./lib";

export const metadata: Metadata = { title: "Collectibles" };

function CollectibleCard({ c, balance }: { c: CollectibleItem; balance: number }) {
  const cost = Number(c.cost) || 0;
  return (
    <div className={cn(panel, "flex flex-col gap-2.5 p-4")}>
      <div className="grid aspect-square place-items-center overflow-hidden border-2 border-stroke bg-panel-2">
        <SafeImage
          src={c.image_url}
          alt=""
          className="size-full object-contain [image-rendering:pixelated]"
          fallback={<span className="font-pixel text-xs text-faint">NO IMAGE</span>}
        />
      </div>
      <div className="font-pixel text-[15px] tracking-[.3px] text-ink">{c.name}</div>
      <div className="flex-1 text-[13.5px] leading-normal text-dim">{c.description ?? ""}</div>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 font-pixel text-[13px] text-gold">▲ {cost}</span>
        {c.owned ? (
          <span className="font-pixel text-xs tracking-[.5px] text-teal">OWNED</span>
        ) : (
          <div className="min-w-[60px] flex-1">
            <div
              className="h-1.5 overflow-hidden border border-stroke bg-panel-2"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={cost}
              aria-valuenow={Math.min(balance, cost)}
              aria-label={`${balance} of ${cost} upvotes`}
            >
              <div className="h-full bg-gold" style={{ width: `${progressPct(balance, cost, false)}%` }} />
            </div>
            <div className="mt-[3px] text-[11px] text-faint">
              {balance} / {cost} upvotes
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default async function CollectiblesPage() {
  // GET /api/collectibles (session): catalog, what you own, upvotes received.
  const res = await serverGet<CollectiblesResponse>("/api/collectibles");
  const balance = res.ok ? Number(res.data.balance) || 0 : 0;
  const items = res.ok ? (res.data.collectibles ?? []) : [];

  return (
    <>
      <PageHeader
        title="COLLECTIBLES"
        sub="Earn cosmetics for your Builder as your projects get upvoted. The moment you reach a collectible's upvote count it's yours to keep, even if a vote gets taken back later."
      />
      {!res.ok ? (
        <EmptyNote>COULDN&apos;T LOAD THE COLLECTIBLES.<br />TRY AGAIN IN A BIT.</EmptyNote>
      ) : (
        <>
          <div className="inline-flex items-center gap-2 border-2 border-stroke bg-panel px-[15px] py-[7px] font-pixel text-[15px] text-gold">
            ▲ <span className="text-[13px]">{balance}</span> UPVOTES RECEIVED
          </div>
          {items.length === 0 ? (
            <EmptyNote>NO COLLECTIBLES IN THE STORE YET. CHECK BACK SOON.</EmptyNote>
          ) : (
            <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4">
              {items.map((c) => (
                <CollectibleCard key={String(c.id)} c={c} balance={balance} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
