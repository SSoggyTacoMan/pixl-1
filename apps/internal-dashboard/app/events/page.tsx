import { requirePage } from "@/lib/guard";
import {
  listEvents,
  listShopItems,
  communityGoalShipCount,
  bountyClaimCount,
  EVENT_TYPES,
  type DashEventRow,
} from "@/lib/db";
import { createEvent, stopEvent, deleteEvent } from "@/app/actions";
import { CreateEventForm } from "@/app/_components/CreateEventForm";
import {
  ActionButton,
  Badge,
  Card,
  CardHeader,
  EmptyRow,
  Flash,
  Muted,
  PageHeader,
  Table,
  type Tone,
} from "@/app/_ui/ui";
import Progress from "@/app/_ui/Progress";

export const dynamic = "force-dynamic";

type EventStatus = "live" | "upcoming" | "ended" | "stopped";

function status(ev: DashEventRow): EventStatus {
  const now = new Date().toISOString();
  if (ev.stopped_at) return "stopped";
  if (ev.starts_at > now) return "upcoming";
  if (ev.ends_at <= now) return "ended";
  return "live";
}

const STATUS_TONE: Record<EventStatus, Tone> = {
  live: "success",
  upcoming: "info",
  ended: "neutral",
  stopped: "danger",
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function configSummary(ev: DashEventRow): string {
  const c = ev.config;
  switch (ev.type) {
    case "bounty":
      return `+${Number(c.reward) || 0} px per project${c.description ? `: ${c.description}` : ""}`;
    case "community_goal":
      return `${Number(c.target) || 0} ships for +${Number(c.bonusPct) || 0}% to every shipper${c.projectType ? ` (${c.projectType} only)` : ""}`;
    case "mystery_merchant":
      return `items ${(Array.isArray(c.itemIds) ? c.itemIds : []).join(", ")}`;
    case "review_blitz":
      return `reviewer payouts ×${Number(c.mult) || 1}`;
    default:
      return "window-only leaderboard in the explore menu";
  }
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  await requirePage("owner");
  const { error, created } = await searchParams;

  const [events, allShopItems] = await Promise.all([listEvents(), listShopItems()]);
  // Trophies (unlock_xp > 0) are earned, not sold, so never offer one as a
  // limited mystery-merchant item.
  const shopItems = allShopItems.filter((i) => i.unlock_xp === 0);
  const progress = new Map<number, number>();
  const claims = new Map<number, number>();
  await Promise.all(
    events.map(async (ev) => {
      if (ev.type === "community_goal" && status(ev) !== "upcoming")
        progress.set(ev.id, await communityGoalShipCount(ev));
      if (ev.type === "bounty") claims.set(ev.id, await bountyClaimCount(ev.id));
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Events"
        count={events.length}
        description="Weekend events players see in-game the moment they go live. All times are UTC. Bonus math runs server-side, so nothing here hands out free pixels."
      />
      <Flash error={error} ok={created ? "Event created." : null} />

      <Card>
        <CardHeader title="Start an event" icon="plus" />
        <p className="hc-caption -mt-2 mb-4 text-sm">Fill only the fields your event type uses. The rest are ignored.</p>
        <CreateEventForm
          action={createEvent}
          types={EVENT_TYPES}
          shopItems={shopItems.map((i) => ({ id: i.id, name: i.name, active: i.active }))}
        />
      </Card>

      <Card padding="flush">
        <CardHeader title="All events" icon="event-code" count={events.length} />
        <Table headers={["Event", "Status", "Window (UTC)", ""]}>
          {events.map((ev) => {
            const st = status(ev);
            const shipped = progress.get(ev.id) ?? 0;
            const target = Number(ev.config.target) || 0;
            const claimCount = claims.get(ev.id) ?? 0;
            return (
              <tr key={ev.id}>
                <td>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{ev.name}</span>
                    <Badge tone="neutral" outline>
                      {EVENT_TYPES[ev.type] ?? ev.type}
                    </Badge>
                  </div>
                  <div className="mt-1 text-sm">
                    <Muted>{configSummary(ev)}</Muted>
                  </div>
                  {ev.type === "community_goal" && progress.has(ev.id) && (
                    <div className="mt-2 max-w-sm">
                      <div className="mb-1 flex justify-between text-xs">
                        <Muted>
                          {shipped} / {target} ships
                        </Muted>
                        <Muted>
                          {shipped >= (target || Infinity) ? "Goal hit" : `+${Number(ev.config.bonusPct) || 0}% if hit`}
                        </Muted>
                      </div>
                      <Progress value={shipped} max={target || 1} label="Ships toward the goal" />
                    </div>
                  )}
                  {ev.type === "bounty" && (
                    <div className="mt-1 text-xs">
                      <Muted>
                        {claimCount} project{claimCount === 1 ? "" : "s"} claimed it
                      </Muted>
                    </div>
                  )}
                </td>
                <td>
                  <Badge tone={STATUS_TONE[st]}>{st}</Badge>
                </td>
                <td className="text-sm">
                  <div>
                    {fmt(ev.starts_at)} to {fmt(ev.ends_at)}
                  </div>
                  {ev.created_by && (
                    <div className="text-xs">
                      <Muted>by {ev.created_by.replace(/\s*\([^)]*\)\s*$/, "")}</Muted>
                    </div>
                  )}
                </td>
                <td>
                  <div className="flex items-center justify-end gap-2">
                    {(st === "live" || st === "upcoming") && (
                      <form action={stopEvent}>
                        <input type="hidden" name="id" value={ev.id} />
                        <ActionButton
                          variant="danger"
                          size="sm"
                          pendingLabel="Stopping..."
                          confirm={`Stop "${ev.name}" now? Players stop seeing it immediately.`}
                        >
                          Stop
                        </ActionButton>
                      </form>
                    )}
                    {st !== "live" && (
                      <form action={deleteEvent}>
                        <input type="hidden" name="id" value={ev.id} />
                        <ActionButton
                          variant="ghost"
                          size="sm"
                          icon="delete"
                          pendingLabel="Deleting..."
                          confirm={`Delete "${ev.name}"? This can't be undone.`}
                        >
                          Delete
                        </ActionButton>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {events.length === 0 && (
            <EmptyRow colSpan={4} title="No events yet" icon="event-code">
              Start one above. Players see it in-game instantly.
            </EmptyRow>
          )}
        </Table>
      </Card>
    </div>
  );
}
