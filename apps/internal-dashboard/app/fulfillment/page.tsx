import type { ReactNode } from "react";
import { requirePage } from "@/lib/guard";
import { getLiveMode } from "@/lib/liveModeServer";
import { LiveBlocked } from "@/app/_components/LiveBlocked";
import {
  listShopOrders,
  listFulfillers,
  countPendingOrders,
  buyerDetailsByUserId,
  buyerCountriesByUserId,
  fulfillerStatsBySlackId,
  shopEconomySummary,
  ORDER_STAGES,
  type ShopOrderRow,
  type OrderStatus,
  type BuyerDetails,
  type ShopEconomySummary,
} from "@/lib/db";
import { canSeeBuyerDetails, isOwnOrder } from "@/lib/fulfillmentAccess";
import {
  claimOrder,
  markOrderCredited,
  shipOrder,
  markOrderDone,
  reassignOrder,
  cancelOrder,
  addFulfillerAction,
  removeFulfillerAction,
  flagOrderOverBudget,
  clearOrderFlag,
  updateOrderFulfillmentInfo,
} from "@/app/actions";
import { isSafeUrl } from "@/lib/safeUrl";
import { config } from "@/app/_generated/config";
import {
  ActionButton,
  Badge,
  ButtonLink,
  Callout,
  Card,
  CardHeader,
  DescriptionList,
  Details,
  EmptyRow,
  EmptyState,
  Field,
  Input,
  LinkTabs,
  Mono,
  Muted,
  PageHeader,
  Stat,
  StatGrid,
  Table,
  TextLink,
  formatDate,
  formatDateTime,
  type Tone,
} from "@/app/_ui/ui";
import { SlackHandle } from "./SlackHandle";

export const dynamic = "force-dynamic";

// These two ship in a plain envelope with no carrier tracking of their own,
// so a printable address label (app/fulfillment/label/[id]) is how the
// fulfiller actually gets it to the right mailbox.
const LABEL_ELIGIBLE_ITEMS = new Set(["Random Desk Object", "Signed Org Photo"]);

const STAGE_LABEL: Record<OrderStatus, string> = {
  pending: "New",
  ordered: "Ordered",
  credited: "Credited",
  shipped: "Shipped",
  done: "Done",
  cancelled: "Cancelled",
};

const STAGE_TONE: Record<OrderStatus, Tone> = {
  pending: "warning",
  ordered: "info",
  credited: "purple",
  shipped: "cyan",
  done: "success",
  cancelled: "neutral",
};

const TAB_KEYS = ["pending", "ordered", "credited", "shipped", "done", "cancelled", "flagged", "all", "leaderboard", "fulfillers"] as const;
type TabKey = (typeof TAB_KEYS)[number];

// What the order's pixels are actually worth in dollars, i.e. the ceiling a
// fulfiller has to source the item under.
function usdBudget(pricePx: number): string {
  return (pricePx * config.economy.pixelValueUsd).toFixed(2);
}

function slackLink(id: string): string {
  return `https://slack.com/app_redirect?channel=${id}`;
}

function SafeLink({ url }: { url: string }) {
  return isSafeUrl(url) ? (
    <TextLink href={url} external className="break-all">
      {url}
    </TextLink>
  ) : (
    <span className="break-all">{url}</span>
  );
}

// Lifetime shop P&L, fulfilled orders only. Both sides are scoped to the same
// cohort (orders with an actual_cost_usd on file, i.e. credited or later), so
// it compares fulfilled against fulfilled. New/Ordered orders aren't counted.
function ShopEconomy({ economy }: { economy: ShopEconomySummary }) {
  const redeemedUsd = economy.totalPx * config.economy.pixelValueUsd;
  const net = redeemedUsd - economy.totalActualCostUsd;
  const orders = economy.ordersWithCost > 0 ? `${economy.ordersWithCost} fulfilled orders` : "Fulfilled orders";
  return (
    <StatGrid>
      <Stat
        label="Redeemed by players"
        icon="enter"
        value={`${economy.totalPx.toLocaleString()} px`}
        hint={`$${redeemedUsd.toFixed(2)} · ${orders}`}
      />
      <Stat label="Spent fulfilling" icon="payment" value={`$${economy.totalActualCostUsd.toFixed(2)}`} />
      <Stat
        label="Net"
        icon="analytics"
        tone={net >= 0 ? "success" : "danger"}
        value={`${net >= 0 ? "+" : "-"}$${Math.abs(net).toFixed(2)}`}
      />
    </StatGrid>
  );
}

// Who's actually fulfilling orders, ranked by lifetime fulfillment pixels
// earned rather than order count, so a few expensive or slow orders don't look
// like less work than a pile of easy ones.
async function FulfillmentLeaderboard() {
  const stats = await fulfillerStatsBySlackId();
  const rows = [...stats.entries()].sort((a, b) => b[1].pixelsEarned - a[1].pixelsEarned);
  return (
    <Card padding="flush">
      <CardHeader title="Leaderboard" icon="leader" count={rows.length} />
      <Table headers={["Fulfiller", "Orders fulfilled", "Pixels earned", "Last active"]}>
        {rows.length === 0 && <EmptyRow colSpan={4} title="No fulfillments yet" icon="package" />}
        {rows.map(([slack, s]) => (
          <tr key={slack}>
            <td>
              <TextLink href={`/fulfillers/${slack}`} className="font-bold">
                <SlackHandle id={slack} fallback={`@${slack}`} />
              </TextLink>
            </td>
            <td className="tabular-nums">{s.shipped}</td>
            <td className="tabular-nums font-bold">{s.pixelsEarned.toLocaleString()} px</td>
            <td className="hc-muted">{formatDate(s.lastActivity)}</td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

async function FulfillerManager() {
  const fulfillers = await listFulfillers();
  return (
    <Card padding="flush">
      <CardHeader title="Fulfillers" icon="person" count={fulfillers.length} />
      <div className="flex flex-col gap-3 px-4 py-4">
        <p className="hc-caption text-sm">
          Fulfillers (and owners) can claim orders and mark them credited or shipped. Marking an order done,
          reassigning it, and cancel &amp; refund stay owner-only.
        </p>
        <form action={addFulfillerAction} className="flex flex-wrap items-end gap-2">
          <Field label="Slack user ID" className="w-full max-w-60">
            <Input name="slackId" placeholder="U0..." className="font-mono" required />
          </Field>
          <ActionButton pendingLabel="Adding..." icon="member-add">
            Add fulfiller
          </ActionButton>
        </form>
      </div>
      <Table headers={["Fulfiller", "Slack ID", ""]}>
        {fulfillers.length === 0 && <EmptyRow colSpan={3} title="No fulfillers yet" icon="person" />}
        {fulfillers.map((f) => (
          <tr key={f.slack_user_id}>
            <td>
              <TextLink href={`/fulfillers/${f.slack_user_id}`} className="font-bold">
                <SlackHandle id={f.slack_user_id} fallback={`@${f.slack_user_id}`} />
              </TextLink>
            </td>
            <td>
              <Mono>{f.slack_user_id}</Mono>
            </td>
            <td className="text-right">
              <form action={removeFulfillerAction}>
                <input type="hidden" name="slackId" value={f.slack_user_id} />
                <ActionButton variant="danger" size="sm" pendingLabel="Removing...">
                  Remove
                </ActionButton>
              </form>
            </td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

export default async function FulfillmentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; mine?: string }>;
}) {
  const access = await requirePage("fulfiller");
  if (await getLiveMode()) return <LiveBlocked what="Fulfillment" />;
  const me = access.session.slackId;
  const { status, mine } = await searchParams;
  const active: TabKey = TAB_KEYS.includes(status as TabKey) ? (status as TabKey) : "pending";
  const mineOnly = mine === "1";
  const showingFulfillers = active === "fulfillers";
  const showingLeaderboard = active === "leaderboard";

  // "My queue" is a fixed cross-stage view, not a filter on the selected tab:
  // every order this fulfiller has claimed that isn't done yet. Filtering the
  // default New tab instead would always be empty, since nobody has claimed a
  // pending order yet.
  let orders: ShopOrderRow[];
  if (showingFulfillers || showingLeaderboard) {
    orders = [];
  } else if (mineOnly) {
    const [orderedRows, creditedRows, shippedRows] = await Promise.all([
      listShopOrders("ordered", 500),
      listShopOrders("credited", 500),
      listShopOrders("shipped", 500),
    ]);
    orders = [...orderedRows, ...creditedRows, ...shippedRows]
      .filter((o) => o.claimed_by_slack === me)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } else {
    orders = await listShopOrders(active === "all" ? undefined : active, 500);
  }
  const [pendingCount, flaggedCount] = await Promise.all([
    active === "pending" && !mineOnly ? orders.length : countPendingOrders(),
    active === "flagged" && !mineOnly ? orders.length : listShopOrders("flagged", 50).then((r) => r.length),
  ]);
  // Name/email/phone/mailing address are decrypted ONLY for orders this
  // fulfiller has claimed (or for an owner), see canSeeBuyerDetails. Every
  // other order shows the buyer's country only, so browsing the queue doesn't
  // decrypt hundreds of kids' addresses.
  const detailOrders = orders.filter((o) => canSeeBuyerDetails(o, access));
  const countryOrders = orders.filter((o) => !canSeeBuyerDetails(o, access));
  const [buyerDetails, buyerCountries] = await Promise.all([
    buyerDetailsByUserId(detailOrders.map((o) => o.user_id)),
    buyerCountriesByUserId(countryOrders.map((o) => o.user_id)),
  ]);
  // Owner-only: a financial rollup, not something a fulfiller needs to do the job.
  const economy = access.isOwner ? await shopEconomySummary() : null;

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "pending", label: "New", count: pendingCount > 0 ? pendingCount : undefined },
    { key: "ordered", label: "Ordered" },
    { key: "credited", label: "Credited" },
    { key: "shipped", label: "Shipped" },
    { key: "done", label: "Done" },
    { key: "cancelled", label: "Cancelled" },
    { key: "flagged", label: "Over budget", count: flaggedCount > 0 ? flaggedCount : undefined },
    { key: "all", label: "All" },
    { key: "leaderboard", label: "Leaderboard" },
    ...(access.isOwner ? [{ key: "fulfillers" as TabKey, label: "Fulfillers" }] : []),
  ];

  const linkFor = (key: TabKey) => {
    const params = new URLSearchParams();
    if (key !== "pending") params.set("status", key);
    if (mineOnly && key !== "fulfillers" && key !== "leaderboard") params.set("mine", "1");
    const qs = params.toString();
    return qs ? `/fulfillment?${qs}` : "/fulfillment";
  };
  const mineToggleLink = () => {
    const params = new URLSearchParams();
    if (active !== "pending") params.set("status", active);
    if (!mineOnly) params.set("mine", "1");
    const qs = params.toString();
    return qs ? `/fulfillment?${qs}` : "/fulfillment";
  };

  const emptyTitle = mineOnly
    ? "Nothing in your queue"
    : active === "pending"
      ? "No orders waiting to be claimed"
      : active === "flagged"
        ? "Nothing over budget right now"
        : "Nothing here yet";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={mineOnly ? "My queue" : "Fulfillment"}
        description={
          <>
            Shop orders paid for with pixels. Claim one to place the real order; it walks through ordered, credited
            and shipped. Tracking is DM&apos;d to the buyer when it ships, and an order can be cancelled for a refund
            until someone claims it.
          </>
        }
        actions={
          !showingFulfillers &&
          !showingLeaderboard && (
            <ButtonLink href={mineToggleLink()} variant={mineOnly ? "primary" : "outline"} size="sm" icon="list">
              {mineOnly ? "Back to all orders" : "My queue"}
            </ButtonLink>
          )
        }
      />

      <Callout tone="info" icon="payment">
        Every order shows a <strong>budget</strong>: what the player&apos;s pixels are worth at $
        {config.economy.pixelValueUsd.toFixed(2)} per pixel. Buy it for that or less. If the cheapest you can find is
        over budget, don&apos;t place the order: flag it with what you found and an owner picks it up from the Over
        budget tab.
      </Callout>

      {economy && <ShopEconomy economy={economy} />}

      {!mineOnly && (
        <LinkTabs
          active={active}
          tabs={tabs.map((t) => ({ key: t.key, href: linkFor(t.key), label: t.label, count: t.count }))}
        />
      )}

      {showingFulfillers ? (
        <FulfillerManager />
      ) : showingLeaderboard ? (
        <FulfillmentLeaderboard />
      ) : orders.length === 0 ? (
        <Card>
          <EmptyState title={emptyTitle} icon="package" />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((o) => {
            const canSee = canSeeBuyerDetails(o, access);
            return (
              <OrderCard
                key={o.id}
                order={o}
                buyer={canSee ? buyerDetails.get(o.user_id) : undefined}
                country={canSee ? undefined : (buyerCountries.get(o.user_id) ?? "")}
                ownOrder={isOwnOrder(o, me)}
                mine={o.claimed_by_slack === me}
                canManage={access.isOwner}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// The live stages as a stepper, current one lit. Cancelled orders skip it.
function StageSteps({ status }: { status: OrderStatus }) {
  if (status === "cancelled") return null;
  const idx = ORDER_STAGES.indexOf(status);
  return (
    <ol className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
      {ORDER_STAGES.map((s, i) => (
        <li key={s} className="flex items-center gap-1.5">
          <span
            className={i === idx ? "font-bold text-[var(--primary)]" : i < idx ? "hc-muted" : "hc-muted opacity-40"}
          >
            {STAGE_LABEL[s]}
          </span>
          {i < ORDER_STAGES.length - 1 && <span className="hc-muted opacity-40">/</span>}
        </li>
      ))}
    </ol>
  );
}

function OnFile({ value }: { value: ReactNode }) {
  return value ? <>{value}</> : <Muted>Not available</Muted>;
}

function OrderCard({
  order: o,
  buyer,
  country,
  ownOrder,
  mine,
  canManage,
}: {
  order: ShopOrderRow;
  buyer?: BuyerDetails;
  // Set (possibly "") when the viewer may not see buyer details: country only.
  country?: string;
  ownOrder: boolean;
  mine: boolean;
  canManage: boolean;
}) {
  // Terminal orders are read-only; everything else still has an action.
  const actionable = o.status !== "done" && o.status !== "cancelled";
  const budget = usdBudget(o.price);
  const overBudget = o.actual_cost_usd !== null && Number(o.actual_cost_usd) > Number(budget);

  const facts: [ReactNode, ReactNode][] = [];
  if (!buyer && country !== undefined) {
    facts.push([
      "Ships to",
      <>
        {country || <Muted>Country not on file</Muted>} <Muted>· full shipping info appears once you claim it</Muted>
      </>,
    ]);
  }
  if (o.item_source_url) facts.push(["Last bought from", <SafeLink key="src" url={o.item_source_url} />]);
  if (o.claimed_by && o.status !== "pending") {
    const verb = o.status === "cancelled" ? "Handled by" : o.status === "shipped" || o.status === "done" ? "Fulfilled by" : "Claimed by";
    facts.push([
      verb,
      <>
        {o.claimed_by}
        {mine && actionable ? " (you)" : ""}
        {o.shipped_at && <Muted> · shipped {formatDate(o.shipped_at)}</Muted>}
        {o.status === "done" && o.done_at && <Muted> · done {formatDate(o.done_at)}</Muted>}
      </>,
    ]);
  }
  if ((o.status === "shipped" || o.status === "done") && o.tracking) {
    facts.push([
      "Tracking",
      <>
        <Mono>{o.tracking}</Mono> <Muted>· DM&apos;d to buyer</Muted>
      </>,
    ]);
  }
  if (o.status !== "pending" && o.status !== "cancelled" && o.hcb_link) {
    facts.push(["HCB", <SafeLink key="hcb" url={o.hcb_link} />]);
  }
  if (o.status === "cancelled" && o.note) facts.push(["Note", o.note]);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="hc-heading text-lg">
              {o.quantity > 1 ? `${o.quantity}x ` : ""}
              {o.item_name || "(item removed)"}
            </span>
            <Badge tone={STAGE_TONE[o.status] ?? "neutral"}>{STAGE_LABEL[o.status] ?? o.status}</Badge>
            <Badge tone="success">{o.price} px</Badge>
            <Badge outline>${budget} budget</Badge>
            {o.actual_cost_usd !== null && (
              <Badge tone={overBudget ? "danger" : "success"} outline>
                ${Number(o.actual_cost_usd).toFixed(2)} actual
              </Badge>
            )}
            {o.option && <Badge>{o.option}</Badge>}
          </div>
          <p className="hc-caption mt-1 text-sm">
            <TextLink href={`/players/${o.user_id}`} className="font-bold">
              {buyer ? o.player_name : o.player_display_name}
            </TextLink>
            {o.player_slack && (
              <>
                {" · "}
                <TextLink href={slackLink(o.player_slack)} external>
                  <SlackHandle id={o.player_slack} />
                </TextLink>
              </>
            )}
            {" · "}
            {formatDateTime(o.created_at)}
          </p>
        </div>
        <StageSteps status={o.status} />
      </div>

      {(buyer || facts.length > 0 || o.buyer_note || o.flagged_at) && (
        <div className="mt-4 flex flex-col gap-3">
          {buyer && (
            <Details summary="Shipping info">
              <DescriptionList
                items={[
                  ["Name", <OnFile key="n" value={buyer.name} />],
                  [
                    "Email",
                    <OnFile
                      key="e"
                      value={buyer.email && <TextLink href={`mailto:${buyer.email}`} external>{buyer.email}</TextLink>}
                    />,
                  ],
                  ["Phone", <OnFile key="p" value={buyer.phone} />],
                  [
                    "Address",
                    <OnFile
                      key="a"
                      value={
                        buyer.addressLines.length > 0 && (
                          <span className="whitespace-pre-line">{buyer.addressLines.join("\n")}</span>
                        )
                      }
                    />,
                  ],
                ]}
              />
              {LABEL_ELIGIBLE_ITEMS.has(o.item_name) && o.status !== "cancelled" && (
                <div className="mt-3">
                  <ButtonLink href={`/fulfillment/label/${o.id}`} variant="outline" size="sm" icon="post">
                    Print shipping label
                  </ButtonLink>
                </div>
              )}
            </Details>
          )}
          {facts.length > 0 && <DescriptionList items={facts} />}
          {o.buyer_note && (
            <Callout tone="warning" icon="message">
              <strong>Note from buyer:</strong> {o.buyer_note}
            </Callout>
          )}
          {o.flagged_at && (
            <Callout tone="danger" icon="important">
              <strong>Over budget:</strong> {o.flag_note}{" "}
              <Muted>
                (flagged by {o.flagged_by || "a fulfiller"} on {formatDate(o.flagged_at)})
              </Muted>
            </Callout>
          )}
          {actionable && /robux/i.test(o.item_name ?? "") && (
            <div>
              <TextLink href="https://www.roblox.com/fr/shopgiftcards?location=us&locale=us_us" external className="text-sm">
                Buy Robux here
              </TextLink>
            </div>
          )}
        </div>
      )}

      {(actionable || canManage) && (
        <div className="mt-5 flex flex-col gap-3 border-t border-[var(--border)] pt-5 empty:hidden">
          {actionable && <OrderActions order={o} mine={mine} ownOrder={ownOrder} canManage={canManage} />}
          {actionable && o.status !== "shipped" && (mine || canManage) && (
            <FlagControls order={o} canManage={canManage} budget={budget} />
          )}
          {canManage && o.status !== "pending" && o.status !== "cancelled" && <EditFulfillmentInfo order={o} />}
        </div>
      )}
    </Card>
  );
}

// Corrects the HCB link / actual cost / tracking after the fact. Deliberately
// not gated by `actionable`: a typo'd link or a wrong cost still needs fixing
// once an order is done. Owner-only, same as updateOrderFulfillmentInfo.
function EditFulfillmentInfo({ order: o }: { order: ShopOrderRow }) {
  return (
    <Details summary="Edit HCB link, cost, tracking or source URL">
      <form action={updateOrderFulfillmentInfo} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="id" value={o.id} />
        <Field label="HCB link">
          <Input name="hcbLink" type="url" maxLength={300} required defaultValue={o.hcb_link} />
        </Field>
        <Field label="Actual cost ($)">
          <Input
            name="actualCostUsd"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={o.actual_cost_usd !== null ? Number(o.actual_cost_usd) : undefined}
          />
        </Field>
        <Field label="Tracking">
          <Input name="tracking" maxLength={120} defaultValue={o.tracking} />
        </Field>
        <Field label="Bought from" hint="Saved onto the item for the next fulfiller">
          <Input
            name="sourceUrl"
            type="url"
            maxLength={500}
            defaultValue={o.item_source_url ?? ""}
            placeholder="https://..."
          />
        </Field>
        <div>
          <ActionButton variant="outline" pendingLabel="Saving...">
            Save
          </ActionButton>
        </div>
      </form>
    </Details>
  );
}

// Sourcing escalation. A fulfiller who can't buy the item for what the player's
// pixels are worth flags it here instead of ordering it over budget; an owner
// clears the flag once they've decided what to do about it.
function FlagControls({ order: o, canManage, budget }: { order: ShopOrderRow; canManage: boolean; budget: string }) {
  if (o.flagged_at) {
    if (!canManage) return null;
    return (
      <form action={clearOrderFlag}>
        <input type="hidden" name="id" value={o.id} />
        <ActionButton variant="outline" size="sm" pendingLabel="Clearing..." icon="checkmark">
          Clear flag
        </ActionButton>
      </form>
    );
  }
  return (
    <Details summary={`Can't source it for $${budget}?`}>
      <form action={flagOrderOverBudget} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={o.id} />
        <Field label="What's the cheapest you found, and where?" className="min-w-64 flex-1">
          <Input name="flagNote" maxLength={300} required placeholder="Cheapest is $95 on Amazon, $88 refurb on eBay" />
        </Field>
        <ActionButton variant="danger" pendingLabel="Flagging..." icon="flag">
          Flag over budget
        </ActionButton>
      </form>
    </Details>
  );
}

function OrderActions({
  order: o,
  mine,
  ownOrder,
  canManage,
}: {
  order: ShopOrderRow;
  mine: boolean;
  ownOrder: boolean;
  canManage: boolean;
}) {
  // Reassign, cancel/refund and the final "mark done" stay owner-only:
  // fulfillers can work a claimed order but not override or refund one. Cancel
  // is only offered before anyone has claimed it (cancelOrder in
  // app/actions.ts enforces the same rule server-side).
  const cancelForm =
    canManage && o.status === "pending" ? (
      <form action={cancelOrder}>
        <input type="hidden" name="id" value={o.id} />
        <ActionButton
          variant="danger"
          pendingLabel="Refunding..."
          confirm={`Cancel this order and refund ${o.price} pixels to ${o.player_name}?`}
        >
          Cancel &amp; refund
        </ActionButton>
      </form>
    ) : null;

  // Shipped: the only thing left is the final close.
  if (o.status === "shipped") {
    if (!canManage) return null;
    return (
      <form action={markOrderDone}>
        <input type="hidden" name="id" value={o.id} />
        <ActionButton variant="success" pendingLabel="Closing..." icon="checkmark">
          Mark done
        </ActionButton>
      </form>
    );
  }

  // Claimed by someone else: offer to take it over rather than acting on their queue.
  if (!mine && o.status !== "pending") {
    if (!canManage) return null;
    return (
      <div className="flex flex-wrap items-end gap-2">
        <form action={reassignOrder}>
          <input type="hidden" name="id" value={o.id} />
          <ActionButton variant="outline" pendingLabel="Taking over..." icon="member-add">
            Reassign to me
          </ActionButton>
        </form>
        {cancelForm}
      </div>
    );
  }

  if (o.status === "pending") {
    // claimOrder refuses a fulfiller's own order server-side too.
    if (ownOrder) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Muted className="text-sm">This is your own order, so someone else has to fulfill it.</Muted>
          {cancelForm}
        </div>
      );
    }
    return (
      <div className="flex flex-wrap items-end gap-2">
        <form action={claimOrder}>
          <input type="hidden" name="id" value={o.id} />
          <ActionButton pendingLabel="Claiming..." icon="bag">
            Place order &amp; claim
          </ActionButton>
        </form>
        {cancelForm}
      </div>
    );
  }

  // Ordered -> credited needs the HCB link and actual cost: the transaction
  // only exists once HCB has actually charged the card.
  if (o.status === "ordered") {
    return (
      <div className="flex flex-wrap items-end gap-2">
        <form action={markOrderCredited} className="grid flex-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)_auto]">
          <input type="hidden" name="id" value={o.id} />
          <Field label="HCB link" hint="The transaction or grant this was paid from">
            <Input name="hcbLink" type="url" maxLength={300} required placeholder="https://hcb.hackclub.com/..." />
          </Field>
          <Field label="Actual cost ($)">
            <Input name="actualCostUsd" type="number" min="0" step="0.01" required placeholder={usdBudget(o.price)} />
          </Field>
          <Field label="Bought from" hint="Optional, saved onto the item">
            <Input
              name="sourceUrl"
              type="url"
              maxLength={500}
              defaultValue={o.item_source_url ?? ""}
              placeholder="https://..."
            />
          </Field>
          <ActionButton pendingLabel="Saving..." icon="checkmark">
            Mark credited (receipt uploaded)
          </ActionButton>
        </form>
        {cancelForm}
      </div>
    );
  }

  // credited -> ship with a required tracking number.
  return (
    <div className="flex flex-wrap items-end gap-2">
      <form action={shipOrder} className="flex flex-1 flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={o.id} />
        <Field label="Tracking number" hint="DM'd to the buyer" className="min-w-64 flex-1">
          <Input name="tracking" maxLength={120} required placeholder="1Z..." />
        </Field>
        <ActionButton pendingLabel="Shipping..." icon="send">
          Mark shipped
        </ActionButton>
      </form>
      {cancelForm}
    </div>
  );
}
