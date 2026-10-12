import { Suspense } from "react";
import { requirePage } from "@/lib/guard";
import { ticketStats, ticketActivity, resolverLeaderboard } from "@/lib/tickets";
import { listHelpers } from "@/lib/db";
import { addHelperAction, removeHelperAction } from "@/app/actions";
import { pixorpheusUrl } from "@/lib/pixo";
import { PIXO_OFFLINE_MESSAGE, pixoStatus } from "@/lib/pixoCall";
import SlackName from "@/app/_ui/SlackName";
import {
  ActionButton,
  Callout,
  Card,
  CardHeader,
  Code,
  EmptyRow,
  Input,
  Mono,
  Muted,
  PageHeader,
  Stat,
  StatGrid,
  Table,
} from "@/app/_ui/ui";
import { TicketsClient } from "./TicketsClient";
import { TicketsActivityChart } from "./TicketsActivityChart";

export const dynamic = "force-dynamic";

// Streams in after the page: the health probe can take up to its 2s timeout
// when Pixo is down, and that must not delay the ticket list.
async function PixoBanner() {
  if ((await pixoStatus(pixorpheusUrl())) !== "offline") return null;
  return (
    <Callout tone="warning" icon="important">
      {PIXO_OFFLINE_MESSAGE} Tickets still load and can be resolved here, but resolves are saved by
      the dashboard and the Slack thread may not show them until Pixo is back.
    </Callout>
  );
}

async function HelperManager() {
  const helpers = await listHelpers();
  return (
    <Card padding="flush">
      <CardHeader title="Helpers" icon="support-fill" count={helpers.length} />
      <div className="flex flex-col gap-3 p-4">
        <p className="hc-caption text-sm">
          Only helpers (and owners) can see and work tickets. This is the same list the Pixorpheus
          bot manages with <Code>/pixl-addhelper</Code>.
        </p>
        <form action={addHelperAction} className="flex flex-wrap gap-2">
          <Input name="slackId" placeholder="Slack user ID (U0...)" className="hc-mono max-w-56" required />
          <ActionButton icon="member-add" pendingLabel="Adding...">
            Add helper
          </ActionButton>
        </form>
      </div>
      <Table headers={["Helper", "Slack ID", ""]}>
        {helpers.map((h) => (
          <tr key={h.slack_user_id}>
            <td className="font-bold">
              <SlackName id={h.slack_user_id} fallback={`@${h.slack_user_id}`} />
            </td>
            <td>
              <Mono>{h.slack_user_id}</Mono>
            </td>
            <td className="text-right">
              <form action={removeHelperAction}>
                <input type="hidden" name="slackId" value={h.slack_user_id} />
                <ActionButton variant="ghost" size="sm" pendingLabel="Removing...">
                  Remove
                </ActionButton>
              </form>
            </td>
          </tr>
        ))}
        {helpers.length === 0 && <EmptyRow colSpan={3} title="No helpers yet" icon="support-fill" />}
      </Table>
    </Card>
  );
}

async function ResolverLeaderboard() {
  const rows = (await resolverLeaderboard()).slice(0, 15);
  return (
    <Card padding="flush">
      <CardHeader title="Top resolvers" icon="trophy-fill" />
      <Table headers={["#", "Helper", "Last 7 days", "Last 30 days", "All time"]}>
        {rows.map((r, i) => (
          <tr key={r.slackId}>
            <td>
              <Muted>{i + 1}</Muted>
            </td>
            <td className="font-bold">
              <SlackName id={r.slackId} fallback={`@${r.slackId}`} />
            </td>
            <td className="tabular-nums">{r.last7d}</td>
            <td className="tabular-nums">{r.last30d}</td>
            <td className="font-bold tabular-nums">{r.total}</td>
          </tr>
        ))}
        {rows.length === 0 && <EmptyRow colSpan={5} title="No resolved tickets yet" icon="trophy-fill" />}
      </Table>
    </Card>
  );
}

export default async function TicketsPage() {
  const access = await requirePage("helper");
  const [stats, activity] = await Promise.all([ticketStats(), ticketActivity()]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tickets"
        count={stats.open}
        description="Support requests from the Slack help channel. Reply in-thread or resolve from here."
      />

      <Suspense fallback={null}>
        <PixoBanner />
      </Suspense>

      <StatGrid>
        <Stat label="Total" value={stats.total} icon="list-bulleted" />
        <Stat label="Open" value={stats.open} icon="message-exclamation" tone="warning" />
        <Stat label="Resolved" value={stats.resolved} icon="checkmark" tone="success" />
      </StatGrid>

      <Card>
        <CardHeader title="Tickets, last 30 days" icon="easel-analytics" action={<Muted className="text-xs">Created vs resolved per day</Muted>} />
        <TicketsActivityChart points={activity} />
      </Card>

      <TicketsClient />

      <div className={`grid gap-6 ${access.isOwner ? "lg:grid-cols-2" : ""}`}>
        <ResolverLeaderboard />
        {access.isOwner && <HelperManager />}
      </div>
    </div>
  );
}
