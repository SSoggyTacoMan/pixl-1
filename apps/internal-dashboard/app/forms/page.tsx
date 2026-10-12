import { Suspense, cache } from "react";
import { requirePage } from "@/lib/guard";
import { listFormSubmissions, listFormConfigs, type FormSubmissionRow } from "@/lib/db";
import { slackAvatarsFor, slackHandles } from "@/lib/slack";
import {
  decideFormSubmission,
  saveFormConfig,
  markFormSubmissionInteresting,
  unmarkFormSubmissionInteresting,
} from "@/app/actions";
import { FormEditor } from "./FormEditor";
import {
  ActionButton,
  Avatar,
  Badge,
  Card,
  CardHeader,
  Details,
  EmptyState,
  Field,
  Input,
  Mono,
  Muted,
  PageHeader,
  Table,
  Textarea,
  formatDateTime,
} from "@/app/_ui/ui";

export const dynamic = "force-dynamic";

type Labels = Map<string, string>;

function SubmissionCard({
  s,
  showUnmark,
  questionLabels,
}: {
  s: FormSubmissionRow;
  showUnmark: boolean;
  questionLabels: Labels;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <SlackAvatar slackId={s.slack_id} size={36} />
        <span className="font-bold">{s.name || s.slack_id}</span>
        <Badge tone="neutral" outline>
          {s.form_key}
        </Badge>
        {s.interesting_at && (
          <span title={`Kept by ${s.interesting_by} on ${formatDateTime(s.interesting_at)}`}>
            <Badge tone="warning" icon="star">
              interesting
            </Badge>
          </span>
        )}
        <Muted className="ml-auto text-xs">{formatDateTime(s.created_at)}</Muted>
      </div>
      <div className="mt-4 flex flex-col gap-3 text-sm">
        {Object.entries(s.answers).map(([key, value]) => (
          <div key={key}>
            <div className="hc-eyebrow">{questionLabels.get(key) ?? key}</div>
            <div className="mt-1 break-words whitespace-pre-wrap">{value}</div>
          </div>
        ))}
      </div>
      <form
        action={decideFormSubmission}
        className="mt-4 flex flex-col gap-2 border-t pt-4"
        style={{ borderColor: "var(--border)" }}
      >
        <input type="hidden" name="id" value={s.id} />
        <Textarea name="note" placeholder="Optional note, included in the DM..." rows={2} />
        <div className="flex flex-wrap gap-2">
          <ActionButton name="decision" value="accepted" size="sm" variant="success" icon="checkmark" pendingLabel="Accepting...">
            Accept
          </ActionButton>
          <ActionButton name="decision" value="rejected" size="sm" variant="danger" pendingLabel="Rejecting...">
            Reject
          </ActionButton>
        </div>
      </form>
      <div className="mt-3">
        {showUnmark ? (
          <form action={unmarkFormSubmissionInteresting}>
            <input type="hidden" name="id" value={s.id} />
            <ActionButton variant="outline" size="sm" pendingLabel="Moving back...">
              Not interesting anymore
            </ActionButton>
          </form>
        ) : (
          <Details summary="Not ready to decide? Keep it for later">
            <form action={markFormSubmissionInteresting} className="flex flex-col gap-2">
              <input type="hidden" name="id" value={s.id} />
              <Textarea name="note" placeholder="Optional extra note, included in the DM..." rows={2} />
              <div>
                <ActionButton variant="outline" size="sm" icon="star" pendingLabel="Marking...">
                  Mark as interesting
                </ActionButton>
              </div>
            </form>
          </Details>
        )}
      </div>
    </Card>
  );
}

// Every public, no-account form submission (pixl.hackclub.com/form/*, see
// apps/server/src/routes/forms.ts) lands here for accept/reject. Submitters
// never got a Pixl account, so decideFormSubmission DMs them directly by the
// Slack id they verified via Hack Club Auth at submit time.
export default async function FormsPage() {
  await requirePage("owner");
  const [submissions, configs] = await Promise.all([listFormSubmissions(), listFormConfigs()]);
  // form_key -> {question key -> label}, so an answer's heading shows the
  // actual question asked instead of its internal storage key (e.g.
  // "message"). Falls back to the raw key if a question was since
  // renamed/removed in FormEditor.
  const questionLabelsByForm = new Map(
    configs.map((c) => [c.form_key, new Map(c.questions.map((q) => [q.key, q.label]))]),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Forms"
        description="Submissions from the public forms at pixl.hackclub.com/form/*. Submitters verify their real Slack identity but never get a Pixl account, so accept/reject DMs them directly."
      />

      <section className="flex flex-col gap-3">
        <h2 className="hc-eyebrow">Form settings</h2>
        {configs.map((c) => (
          <FormEditor key={c.form_key} config={c} />
        ))}
        <Card>
          <CardHeader title="New form" icon="plus" />
          <form action={saveFormConfig} className="flex flex-wrap items-end gap-2">
            <Field label="Form key" hint='Used in the URL, e.g. "review" for /form/review.'>
              <Input name="formKey" placeholder="my-form" className="w-56" required pattern="[a-z0-9_-]{1,50}" />
            </Field>
            <input type="hidden" name="title" value="" />
            <input type="hidden" name="description" value="" />
            <input type="hidden" name="closeAt" value="" />
            <input type="hidden" name="questionsJson" value="[]" />
            <ActionButton size="sm" variant="outline" pendingLabel="Creating...">
              Create
            </ActionButton>
          </form>
        </Card>
      </section>

      <Submissions submissions={submissions} labels={questionLabelsByForm} />
    </div>
  );
}

// Avatars and handles come from Slack (one users.info call per submitter),
// so each one streams in on its own. Only these small pieces wait: the cards
// and their note fields render immediately and are never re-rendered, so a
// note typed while Slack is slow is kept.
const avatarOf = cache(async (slackId: string) => (await slackAvatarsFor([slackId])).get(slackId));
const handleOf = cache(async (slackId: string) => (await slackHandles([slackId])).get(slackId));

async function StreamedAvatar({ slackId, size }: { slackId: string; size: number }) {
  return <Avatar src={await avatarOf(slackId)} size={size} />;
}

function SlackAvatar({ slackId, size }: { slackId: string; size: number }) {
  return (
    <Suspense fallback={<Avatar src={null} size={size} />}>
      <StreamedAvatar slackId={slackId} size={size} />
    </Suspense>
  );
}

async function StreamedHandle({ slackId }: { slackId: string }) {
  return <>{(await handleOf(slackId)) ?? slackId}</>;
}

function Submissions({
  submissions,
  labels,
}: {
  submissions: FormSubmissionRow[];
  labels: Map<string, Labels>;
}) {
  const emptyLabels: Labels = new Map();
  const pending = submissions.filter((s) => s.status === "pending" && !s.interesting_at);
  const interesting = submissions.filter((s) => s.status === "pending" && s.interesting_at);
  // Split out from "decided" so accepted applicants have their own place to
  // scan later. The accept DM already goes out immediately, this is just
  // for going back to message them again afterwards (e.g. once onboarding).
  const accepted = submissions.filter((s) => s.status === "accepted");
  const rejected = submissions.filter((s) => s.status === "rejected");

  return (
    <>
      {interesting.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="hc-eyebrow">{interesting.length} kept for later</h2>
          {interesting.map((s) => (
            <SubmissionCard
              key={s.id}
              s={s}
              showUnmark
              questionLabels={labels.get(s.form_key) ?? emptyLabels}
            />
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="hc-eyebrow">{pending.length} pending</h2>
        {pending.length === 0 ? (
          <Card>
            <EmptyState title="Nothing pending" />
          </Card>
        ) : (
          pending.map((s) => (
            <SubmissionCard
              key={s.id}
              s={s}
              showUnmark={false}
              questionLabels={labels.get(s.form_key) ?? emptyLabels}
            />
          ))
        )}
      </section>

      {accepted.length > 0 && (
        <Card padding="flush">
          <CardHeader title="Accepted, for DMing later" icon="checkmark" count={accepted.length} />
          <Table headers={["Submitter", "Form", "Decided"]}>
            {accepted.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <SlackAvatar slackId={s.slack_id} size={32} />
                    <div className="min-w-0">
                      <div className="font-bold">{s.name || s.slack_id}</div>
                      <div className="text-xs">
                        <Muted>
                          <Mono>
                            <Suspense fallback={s.slack_id}>
                              <StreamedHandle slackId={s.slack_id} />
                            </Suspense>
                          </Mono>
                        </Muted>
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <Badge tone="neutral" outline>
                    {s.form_key}
                  </Badge>
                </td>
                <td className="text-sm">
                  <Muted>
                    by {s.decided_by} · {formatDateTime(s.decided_at)}
                  </Muted>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {rejected.length > 0 && (
        <Card padding="flush">
          <CardHeader title="Rejected" icon="view-close" count={rejected.length} />
          <Table headers={["Submitter", "Form", "Decided"]}>
            {rejected.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <SlackAvatar slackId={s.slack_id} size={32} />
                    <span className="font-bold">{s.name || s.slack_id}</span>
                  </div>
                </td>
                <td>
                  <Badge tone="neutral" outline>
                    {s.form_key}
                  </Badge>
                </td>
                <td className="text-sm">
                  <Muted>
                    by {s.decided_by} · {formatDateTime(s.decided_at)}
                  </Muted>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </>
  );
}
