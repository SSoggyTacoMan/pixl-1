import type { Metadata } from "next";
import { SafeImage } from "@/components/safe-image";
import { EmptyNote, PageHeader } from "@/components/ui/primitives";
import { serverGet } from "@/lib/server-api";
import { progressPct, type CollectibleItem, type CollectiblesResponse } from "./lib";
import "./collectibles.css";

export const metadata: Metadata = { title: "Collectibles" };

function CollectibleCard({ c, balance }: { c: CollectibleItem; balance: number }) {
  const cost = Number(c.cost) || 0;
  return (
    <div className="col-card panel">
      <div className="col-thumb">
        <SafeImage src={c.image_url} alt="" fallback={<span className="ph">NO IMAGE</span>} />
      </div>
      <div className="col-name">{c.name}</div>
      <div className="col-desc">{c.description ?? ""}</div>
      <div className="col-foot">
        <span className="col-cost">▲ {cost}</span>
        {c.owned ? (
          <span className="col-owned">OWNED</span>
        ) : (
          <div className="col-progress">
            <div
              className="col-progress-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={cost}
              aria-valuenow={Math.min(balance, cost)}
              aria-label={`${balance} of ${cost} upvotes`}
            >
              <div style={{ width: `${progressPct(balance, cost, false)}%` }} />
            </div>
            <div className="col-progress-label">
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
          <div className="col-bal">
            ▲ <span className="up">{balance}</span> UPVOTES RECEIVED
          </div>
          {items.length === 0 ? (
            <EmptyNote>NO COLLECTIBLES IN THE STORE YET. CHECK BACK SOON.</EmptyNote>
          ) : (
            <div className="col-grid">
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
