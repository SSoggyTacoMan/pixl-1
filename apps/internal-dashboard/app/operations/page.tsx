import { requirePage } from "@/lib/guard";
import { db } from "@/lib/db";
import {
  BLACKOUT_SLUG,
  ENTRY_STATUSES,
  ENTRY_STATUS_LABEL,
  getOperation,
  getOperationStats,
  listOperationEntries,
  type EntryStatus,
  type OperationRow,
} from "@/lib/operations";
import { createOperation, operationControl } from "@/app/operations/actions";
import {
  ActionButton,
  Badge,
  Card,
  CardHeader,
  Checkbox,
  Details,
  EmptyRow,
  Field,
  Flash,
  Input,
  LinkTabs,
  Muted,
  NativeSelect,
  PageHeader,
  Pagination,
  Stat,
  StatGrid,
  Table,
  TextLink,
  type Tone,
} from "@/app/_ui/ui";

export const dynamic = "force-dynamic";

const PER = 20;

const STATUS_TONE: Record<OperationRow["effectiveStatus"], Tone> = {
  active: "success",
  paused: "warning",
  upcoming: "neutral",
  ended: "danger",
};

const ENTRY_TONE: Record<EntryStatus, Tone> = {
  entered: "neutral",
  shipped: "warning",
  eligible: "info",
  needs_changes: "purple",
  approved: "success",
  ineligible: "danger",
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  });
const inputValue = (iso: string) => new Date(iso).toISOString().slice(0, 16);
const actorLabel = (actor: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(actor) ? "player" : actor.replace(/\s*\([^)]*\)\s*$/, "") || "system";
const usd = (n: number) => `$${(Math.round(n * 100) / 100).toFixed(2)}`;
const hrs = (n: number) => `${Math.round(n * 100) / 100}h`;

function CreateForm() {
  return (
    <Card className="max-w-2xl">
      <CardHeader title="Create Operation Blackout" icon="plus" />
      <p className="hc-caption mb-4 text-sm">
        Nothing is live until the start time. Entries open at the start and close at the end. All times UTC.
      </p>
      <form action={createOperation} className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">
          <Input name="name" defaultValue="Operation Blackout" required maxLength={80} />
        </Field>
        <Field label="Slug">
          <Input name="slug" defaultValue={BLACKOUT_SLUG} required pattern="[a-z0-9][a-z0-9\-]{0,63}" />
        </Field>
        <Field label="Bonus ($/hr)">
          <Input name="rateUsd" type="number" step="0.01" min="0" defaultValue="1" required />
        </Field>
        <Field label="Rate mode">
          <NativeSelect name="rateMode" defaultValue="additive">
            <option value="additive">Additive: flat bonus on top of each player&apos;s own rate</option>
            <option value="floor">Floor: nobody drops below this rate</option>
          </NativeSelect>
        </Field>
        <Field label="Starts (UTC)">
          <Input name="startsAt" type="datetime-local" required />
        </Field>
        <Field label="Ends (UTC)">
          <Input name="endsAt" type="datetime-local" required />
        </Field>
        <Field label="Grace period after changes are requested (hours)">
          <Input name="graceHours" type="number" min="0" defaultValue="72" required />
        </Field>
        <div className="sm:col-span-2">
          <ActionButton pendingLabel="Creating...">Create operation</ActionButton>
        </div>
      </form>
    </Card>
  );
}

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; ok?: string; error?: string; status?: string; page?: string }>;
}) {
  await requirePage("owner");
  const sp = await searchParams;
  const slug = sp.slug || BLACKOUT_SLUG;
  const statusFilter = ENTRY_STATUSES.includes(sp.status as EntryStatus) ? (sp.status as EntryStatus) : undefined;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const op = await getOperation(slug);
  const header = (
    <PageHeader
      title={
        <>
          Operations <Badge tone="warning">Blackout</Badge>
        </>
      }
      description="Time-boxed campaigns. Reviewers rule on eligibility and hours, the database works out the pay. All times are UTC."
    />
  );

  if (!op) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Flash error={sp.error} ok={sp.ok} />
        <CreateForm />
      </div>
    );
  }

  const [stats, list, auditRes] = await Promise.all([
    getOperationStats(slug),
    listOperationEntries(slug, { status: statusFilter, limit: PER, offset: (page - 1) * PER }),
    db
      .from("operation_audit")
      .select("id, actor, action, detail, created_at")
      .eq("operation_id", op.id)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);
  const audit = (auditRes.data ?? []) as { id: number; actor: string; action: string; created_at: string | Date }[];
  const pages = Math.max(1, Math.ceil(list.total / PER));
  const qs = (p: number, st?: string) => {
    const q = new URLSearchParams();
    if (slug !== BLACKOUT_SLUG) q.set("slug", slug);
    if (st) q.set("status", st);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return `/operations${s ? `?${s}` : ""}`;
  };
  const eff = op.effectiveStatus;
  const e = stats?.entries;
  const skippedForTrial = Number(stats?.trial_held_skips ?? 0);
  const canChange = op.status !== "ended" && eff !== "ended";

  return (
    <div className="flex flex-col gap-6">
      {header}
      <Flash error={sp.error} ok={sp.ok} />

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="hc-heading text-lg">{op.name}</h2>
              <Badge tone={STATUS_TONE[eff]}>{eff}</Badge>
              {(op.status === "paused" || op.status === "ended") && op.status !== eff && (
                <Muted className="text-xs">(set to {op.status})</Muted>
              )}
            </div>
            <p className="hc-caption mt-1 text-sm">
              {fmt(op.startsAt)} to {fmt(op.endsAt)} UTC
            </p>
            <p className="hc-caption text-sm">
              {op.rateMode === "additive" ? (
                <>+{usd(op.rateUsd)}/hr bonus, effective rate = player&apos;s own rate + {usd(op.rateUsd)}</>
              ) : (
                <>Floor rate {usd(op.rateUsd)}/hr, effective rate = max(player&apos;s own rate, {usd(op.rateUsd)})</>
              )}
              {" "}· grace {op.gracePeriodHours}h
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canChange && op.status !== "paused" && (
              <form action={operationControl}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="action" value="pause" />
                <ActionButton
                  variant="outline"
                  size="sm"
                  icon="pause-circle"
                  pendingLabel="Pausing..."
                  confirm="Pause new entries? Projects already entered can still ship."
                >
                  Pause entries
                </ActionButton>
              </form>
            )}
            {op.status === "paused" && (
              <form action={operationControl}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="action" value="resume" />
                <ActionButton size="sm" icon="play-circle" pendingLabel="Resuming...">
                  Resume entries
                </ActionButton>
              </form>
            )}
          </div>
        </div>

        {canChange && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Card sunken padding="compact">
              <form action={operationControl} className="flex flex-col gap-2">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="action" value="extend" />
                <h3 className="hc-heading text-sm">Extend the end</h3>
                <p className="hc-caption text-xs">
                  Only later. Entries keep their recorded join and first-ship times, nothing already decided changes.
                </p>
                <Input name="endsAt" type="datetime-local" required defaultValue={inputValue(op.endsAt)} />
                <div>
                  <ActionButton size="sm" variant="outline" pendingLabel="Saving...">
                    Extend
                  </ActionButton>
                </div>
              </form>
            </Card>
            <Card sunken padding="compact">
              <form action={operationControl} className="flex flex-col gap-2">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="action" value="end" />
                <h3 className="hc-heading text-sm">End the operation now</h3>
                <p className="hc-caption text-xs">
                  Closes it immediately. Entries that already shipped are still reviewed and paid, unshipped ones
                  can&apos;t qualify.
                </p>
                <Checkbox name="confirmEnd" value="1" label="I understand this can't be undone" />
                <div>
                  <ActionButton size="sm" variant="danger" pendingLabel="Ending...">
                    End now
                  </ActionButton>
                </div>
              </form>
            </Card>
          </div>
        )}

        <div className="mt-4">
          <Details summary="Edit name, rate, grace">
            <form action={operationControl} className="grid gap-3 sm:grid-cols-3">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="action" value="edit" />
              <Field label="Name" className="sm:col-span-3">
                <Input name="name" defaultValue={op.name} maxLength={80} />
              </Field>
              <Field label="Bonus ($/hr)">
                <Input name="rateUsd" type="number" step="0.01" min="0" defaultValue={op.rateUsd} />
              </Field>
              <Field label="Rate mode">
                <NativeSelect name="rateMode" defaultValue={op.rateMode}>
                  <option value="additive">Additive: flat bonus</option>
                  <option value="floor">Floor: minimum rate</option>
                </NativeSelect>
              </Field>
              <Field label="Grace (hours)">
                <Input name="graceHours" type="number" min="0" defaultValue={op.gracePeriodHours} />
              </Field>
              <p className="hc-caption text-xs sm:col-span-3">
                Rate, rate mode, and grace apply only to entries created after this save, each entry snapshots them
                when it joins. The start can only move before anything has joined.
              </p>
              <div className="sm:col-span-3">
                <ActionButton size="sm" pendingLabel="Saving...">
                  Save
                </ActionButton>
              </div>
            </form>
          </Details>
        </div>
      </Card>

      {stats && e && (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="hc-eyebrow">Entries</h2>
            <StatGrid>
              <Stat label="Entered" value={e.entries} hint={`${e.not_shipped} not shipped yet`} />
              <Stat label="Shipped" value={e.shipped_entries} />
              <Stat label="Pending review" value={e.pending_review} hint="shipped or ruled, awaiting final" />
              <Stat label="Changes requested" value={e.needs_changes} hint="in the grace window" />
              <Stat label="Eligible" value={e.eligible} />
              <Stat label="Ineligible" value={e.ineligible} />
              <Stat label="Approved" value={e.approved} tone="success" />
              <Stat
                label="Participants"
                value={stats.participants}
                hint={`${stats.active_builders_7d} journaling in the last 7d`}
              />
            </StatGrid>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="hc-eyebrow">Blackout cost (top-up only)</h2>
            <StatGrid>
              <Stat
                label="Blackout cost paid"
                value={usd(stats.actual_uplift_usd)}
                hint={`extra pixels credited over normal pay, net of reversals · ${stats.ledger.paid_transactions} payouts`}
              />
              <Stat
                label="Pending cost (max)"
                value={usd(Number(stats.pending.uplift_max_usd))}
                hint="most the unpaid entries could still add"
              />
              <Stat label="Projected cost (max)" value={usd(stats.projected_uplift_max_usd)} hint="paid + pending max" />
              <Stat label="Trial-held skips" value={skippedForTrial} hint="owner top-ups skipped, Trial prize pending" />
            </StatGrid>
            <h2 className="hc-eyebrow mt-3">Work value (not extra cost)</h2>
            <StatGrid>
              <Stat
                label="Approved hours"
                value={hrs(Number(stats.contributors.approved_hours))}
                hint={`power restored: ${Math.round(Number(stats.power_units))} units`}
              />
              <Stat
                label="Approved work value"
                value={usd(stats.actual_gross_usd)}
                hint="approved hours × effective rate, mostly paid by normal payouts"
              />
              <Stat label="Pending hours" value={hrs(Number(stats.pending.hours))} hint="upper bound, not yet approved" />
              <Stat
                label="Pending work value"
                value={usd(Number(stats.pending.gross_usd))}
                hint="if every pending hour is approved"
              />
            </StatGrid>
            <p className="hc-caption max-w-3xl text-xs">
              Blackout cost means only the top-up. Each person&apos;s normal project payout already pays their hours at
              their own rate, so the operation adds just the difference on top.{" "}
              {op.rateMode === "additive" ? (
                <>
                  Every eligible contributor gets the same flat +{usd(Number(op.rateUsd))}/hr, whether their own rate
                  is $4, $5, or $6/hr, so nobody is left out for already being above some minimum.
                </>
              ) : (
                <>Below the {usd(Number(op.rateUsd))}/hr floor, the difference is added. At or above it, nothing extra.</>
              )}{" "}
              Work value is the total those hours are worth at the effective rate, for context. Pending hours are a
              ceiling from tracked time inside each entry&apos;s window, not yet approved
              {op.rateMode === "additive" &&
                ". The pending cost figure itself is exact for the bonus (it doesn't depend on anyone's real rate), not an estimate"}
              .
            </p>
          </section>
        </>
      )}

      <Card padding="flush">
        <CardHeader title="Entries" icon="list" count={list.total} />
        <LinkTabs
          active={statusFilter ?? "all"}
          tabs={[
            { key: "all", href: qs(1), label: "All" },
            ...ENTRY_STATUSES.map((s) => ({ key: s, href: qs(1, s), label: ENTRY_STATUS_LABEL[s] })),
          ]}
        />
        <Table headers={["Project", "Status", "Joined", "Shipped", "Hours"]}>
          {list.items.map((it) => (
            <tr key={it.id}>
              <td>
                <TextLink href={`/projects/${it.projectId}`} className="font-bold">
                  {it.projectName}
                </TextLink>
                <div className="text-xs">
                  <Muted>{it.ownerName}</Muted>
                </div>
              </td>
              <td>
                <div className="flex flex-wrap gap-1">
                  <Badge tone={ENTRY_TONE[it.status]}>{ENTRY_STATUS_LABEL[it.status]}</Badge>
                  {it.evidenceIncomplete && <Badge tone="danger">Hackatime incomplete</Badge>}
                  {it.trialHoldSkipped && <Badge tone="warning">Top-up skipped: Trial hold</Badge>}
                </div>
              </td>
              <td className="text-sm">
                <Muted>{fmt(it.joinedAt)}</Muted>
              </td>
              <td className="text-sm">
                {it.firstQualifiedShipAt ? fmt(it.firstQualifiedShipAt) : <Muted>not shipped</Muted>}
              </td>
              <td className="text-sm">
                <div>{hrs(it.eligibleHours)} in window</div>
                {it.approvedHours > 0 && <div><Muted>{hrs(it.approvedHours)} ruled</Muted></div>}
                {it.paidHours > 0 && (
                  <div>
                    <Muted>
                      {hrs(it.paidHours)} paid (+{it.upliftPx} px)
                    </Muted>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {list.items.length === 0 && (
            <EmptyRow colSpan={5} title={`No entries${statusFilter ? " with that status" : " yet"}`} icon="search" />
          )}
        </Table>
      </Card>
      <Pagination page={page} totalPages={pages} hrefFor={(p) => qs(p, statusFilter)} />

      {audit.length > 0 && (
        <Card padding="flush">
          <CardHeader title="Audit trail" icon="history" />
          <Table headers={["Action", "By", "When"]}>
            {audit.map((a) => (
              <tr key={a.id}>
                <td className="font-bold">{a.action.replaceAll("_", " ")}</td>
                <td>
                  <Muted>{actorLabel(a.actor)}</Muted>
                </td>
                <td className="text-sm">
                  <Muted>{fmt(new Date(a.created_at).toISOString())} UTC</Muted>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}
