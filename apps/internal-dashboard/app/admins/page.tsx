import Link from "next/link";
import {
  requirePage,
  ownerSlackIds,
  secondPassSlackIds,
  reviewQueueScopeFor,
  REVIEW,
  NO_REVIEW,
  SECOND_PASS,
  EDIT_SUBMISSION,
} from "@/lib/guard";
import { listAdmins, listHelpers, listFulfillers, getReviewPayoutSettings } from "@/lib/db";
import {
  addReviewer,
  addHelperAction,
  removeHelperAction,
  addFulfillerAction,
  removeFulfillerAction,
  updateReviewPayoutSettings,
} from "@/app/actions";
import { slackHandles } from "@/lib/slack";
import { TeamLog } from "@/app/_components/TeamLog";
import { PendingButton } from "@/app/_components/PendingButton";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

// The team page. Four roles exist (see lib/roles.ts):
// - Owners come from ADMIN_SLACK_IDS only, so they're shown read-only here.
//   Nothing on this page (or anywhere in the dashboard) can make an owner.
// - Reviewers, ticket helpers and fulfillers are managed below.

function SlackIdForm({
  action,
  label,
  withName = false,
}: {
  action: (formData: FormData) => Promise<void>;
  label: string;
  withName?: boolean;
}) {
  return (
    <form action={action} className="flex flex-wrap gap-2 items-end">
      {withName && (
        <Input name="name" placeholder="Name (optional)" className="max-w-48 text-sm" />
      )}
      <Input
        name="slackId"
        required
        placeholder="Slack member ID (U0...)"
        className="max-w-56 text-sm font-mono"
      />
      <PendingButton pendingText="Adding...">{label}</PendingButton>
    </form>
  );
}

function PersonChip({
  slackId,
  label,
  remove,
}: {
  slackId: string;
  label: string;
  remove: (formData: FormData) => Promise<void>;
}) {
  return (
    <li className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1 text-sm">
      <span className="font-medium">{label}</span>
      <span className="font-mono text-xs text-muted-foreground">{slackId}</span>
      <form action={remove}>
        <input type="hidden" name="slackId" value={slackId} />
        <PendingButton
          variant="ghost"
          size="sm"
          pendingText="Removing..."
          confirm={`Remove ${label}?`}
          className="text-destructive h-6 px-1.5 text-xs"
        >
          remove
        </PendingButton>
      </form>
    </li>
  );
}

export default async function AdminsPage() {
  await requirePage("owner");
  const owners = ownerSlackIds();
  const secondPassIds = secondPassSlackIds();
  const [admins, helpers, fulfillers, payoutSettings] = await Promise.all([
    listAdmins(),
    listHelpers(),
    listFulfillers(),
    getReviewPayoutSettings(),
  ]);
  const reviewers = admins.filter(
    (a) => a.permissions.includes(REVIEW) && !a.permissions.includes(NO_REVIEW),
  );
  const handles = await slackHandles([
    ...owners,
    ...reviewers.map((r) => r.slack_id),
    ...helpers.map((h) => h.slack_user_id),
    ...fulfillers.map((f) => f.slack_user_id),
  ]);
  const label = (slackId: string, name?: string) => name || handles.get(slackId) || slackId;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Owners can do everything. Reviewers only work the review queue, ticket helpers only
          work tickets, fulfillers only work the order queue. Every change here is written to
          the audit log.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Owners</h2>
        <Card className="p-5 gap-0 space-y-3">
          {owners.length === 0 && (
            <div className="text-sm text-muted-foreground">
              ADMIN_SLACK_IDS is empty, so nobody is an owner.
            </div>
          )}
          {owners.map((id) => (
            <div key={id} className="flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="font-semibold truncate">{label(id)}</div>
                <div className="text-xs text-muted-foreground font-mono truncate">{id}</div>
              </div>
              <Badge variant="secondary" className="text-[0.65rem] uppercase tracking-wide">
                owner
              </Badge>
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-2 border-t border-border">
            Owners come from the ADMIN_SLACK_IDS env var only. Change it in the deployment env
            and redeploy; it can&apos;t be changed from the dashboard or the database.
          </p>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-semibold tracking-tight">
            Reviewers <span className="text-muted-foreground font-normal">({reviewers.length})</span>
          </h2>
          <Link href="/reviewers" className="text-sm text-brand underline">
            Stats and per-reviewer settings
          </Link>
        </div>
        <Card className="p-5 gap-0 space-y-4">
          <SlackIdForm action={addReviewer} label="Add reviewer" withName />
          <p className="text-xs text-muted-foreground">
            Final-reviewer (second pass), queue scope (software/hardware), edit-submission
            access and removal are on each reviewer&apos;s page.
          </p>
          {reviewers.length > 0 && (
            <ul className="divide-y divide-border border border-border rounded-lg">
              {reviewers.map((r) => {
                const scope = reviewQueueScopeFor(r.permissions);
                const finalReviewer =
                  r.permissions.includes(SECOND_PASS) || secondPassIds.includes(r.slack_id);
                return (
                  <li key={r.slack_id} className="flex items-center gap-2 px-3 py-2 text-sm flex-wrap">
                    <Link href={`/reviewers/${encodeURIComponent(r.slack_id)}`} className="font-medium hover:text-brand">
                      {label(r.slack_id, r.name)}
                    </Link>
                    <span className="font-mono text-xs text-muted-foreground">{r.slack_id}</span>
                    {finalReviewer && <Badge variant="success">second pass</Badge>}
                    {scope !== "both" && <Badge variant="outline">{scope} only</Badge>}
                    {r.permissions.includes(EDIT_SUBMISSION) && (
                      <Badge variant="outline">edit submission</Badge>
                    )}
                    <Link
                      href={`/reviewers/${encodeURIComponent(r.slack_id)}`}
                      className="ml-auto text-xs text-brand underline"
                    >
                      Manage
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Ticket helpers <span className="text-muted-foreground font-normal">({helpers.length})</span>
        </h2>
        <Card className="p-5 gap-0 space-y-4">
          <SlackIdForm action={addHelperAction} label="Add helper" />
          <p className="text-xs text-muted-foreground">
            Same list the Pixorpheus bot manages with <code>/pixl-addhelper</code>.
          </p>
          {helpers.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {helpers.map((h) => (
                <PersonChip
                  key={h.slack_user_id}
                  slackId={h.slack_user_id}
                  label={label(h.slack_user_id)}
                  remove={removeHelperAction}
                />
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Fulfillers <span className="text-muted-foreground font-normal">({fulfillers.length})</span>
        </h2>
        <Card className="p-5 gap-0 space-y-4">
          <SlackIdForm action={addFulfillerAction} label="Add fulfiller" />
          {fulfillers.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {fulfillers.map((f) => (
                <PersonChip
                  key={f.slack_user_id}
                  slackId={f.slack_user_id}
                  label={label(f.slack_user_id)}
                  remove={removeFulfillerAction}
                />
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Reviewer payouts</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Pixels a reviewer earns per review, set separately for an approval vs a
            request-changes verdict. Set either to 0 to turn off payouts for that verdict. Both
            still stack with an active Review Blitz multiplier and get cut for rushed reviews.
          </p>
        </div>
        <Card className="p-5 md:p-6 gap-0">
          <form action={updateReviewPayoutSettings} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Label className="block font-normal">
                <span className="block text-sm font-medium mb-1.5">Pixels per approval</span>
                <Input
                  name="approvedPixels"
                  type="number"
                  min={0}
                  step={0.5}
                  defaultValue={payoutSettings.approvedPixels}
                  className="w-full text-sm"
                />
              </Label>
              <Label className="block font-normal">
                <span className="block text-sm font-medium mb-1.5">Pixels per request-changes</span>
                <Input
                  name="needsChangesPixels"
                  type="number"
                  min={0}
                  step={0.5}
                  defaultValue={payoutSettings.needsChangesPixels}
                  className="w-full text-sm"
                />
              </Label>
            </div>
            {payoutSettings.updatedBy && (
              <p className="text-xs text-muted-foreground">Last changed by {payoutSettings.updatedBy}</p>
            )}
            <div className="flex justify-end">
              <PendingButton className="bg-brand text-white border-transparent" pendingText="Saving...">
                Save payout rates
              </PendingButton>
            </div>
          </form>
        </Card>
      </section>

      <TeamLog />
    </div>
  );
}
