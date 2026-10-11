import { CancelOrderButton } from "./cancel-order-button";
import { TimeAgo } from "./time-ago";

export interface Order {
  id: number;
  status: string;
  item_name?: string | null;
  option?: string | null;
  quantity?: number | null;
  price: number;
  created_at?: string | null;
  queue_position?: number | null;
  queue_total?: number | null;
  tracking?: string | null;
  note?: string | null;
}

const STAGES: [string, string][] = [
  ["pending", "NEW"],
  ["ordered", "ORDERED"],
  ["credited", "PAID"],
  ["shipped", "SHIPPED"],
  ["done", "DONE"],
];

const BADGE: Record<string, [string, string]> = {
  pending: ["AWAITING", ""],
  ordered: ["ORDERED", "gold"],
  credited: ["PAID", "gold"],
  shipped: ["SHIPPED", "teal"],
  done: ["DELIVERED", "green"],
  cancelled: ["CANCELLED · REFUNDED", "red"],
};

function Tracker({ status }: { status: string }) {
  const idx = STAGES.findIndex(([s]) => s === status);
  return (
    <div className="track">
      {STAGES.map(([s, label], i) => (
        <div key={s} className={`step${i < idx ? " filled" : i === idx ? " filled current" : ""}`}>
          <span className="bead" />
          <span className="lbl">{label}</span>
        </div>
      ))}
    </div>
  );
}

export function OrderCard({ order: o }: { order: Order }) {
  const [badgeText, badgeCls] = BADGE[o.status] ?? ["", ""];
  const qty = Number(o.quantity) || 1;
  return (
    <div className={`panel order${o.status === "cancelled" ? " cancelled" : ""}`}>
      <div className="order-head">
        <span className="order-name">
          {qty > 1 ? `${qty}× ` : ""}
          {o.item_name || "Item"}
        </span>
        <span className="order-price">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/pixel.png" alt="" />
          {Number(o.price).toLocaleString()} PX
        </span>
        {badgeText ? <span className={`chip ${badgeCls}`}>{badgeText}</span> : null}
        {o.option ? <span className="chip">{o.option}</span> : null}
        {o.created_at ? <TimeAgo iso={o.created_at} className="order-when" /> : null}
      </div>

      {o.status === "cancelled" ? (
        <div className="order-note">Refunded to your wallet.{o.note ? ` ${o.note}` : ""}</div>
      ) : (
        <>
          <Tracker status={o.status} />
          {o.status === "pending" && o.queue_position ? (
            <div className="order-meta">
              #{o.queue_position}
              {o.queue_total ? ` of ${o.queue_total}` : ""} in line to be claimed by fulfillment
            </div>
          ) : null}
        </>
      )}

      {(o.status === "shipped" || o.status === "done") && o.tracking ? (
        <div className="order-meta">
          Tracking <span className="order-track">{o.tracking}</span>
          <span className="muted"> · DM&apos;d to you</span>
        </div>
      ) : null}

      {o.status === "pending" ? (
        <div className="order-meta">
          <CancelOrderButton id={Number(o.id)} />
        </div>
      ) : null}
    </div>
  );
}
