import { requirePage } from "@/lib/guard";
import { listVaultLevels, type VaultLevelRow } from "@/lib/db";
import { addVaultLevel, updateVaultLevel, toggleVaultLevel, deleteVaultLevel } from "@/app/actions";
import {
  ActionButton,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Flash,
  Input,
  Muted,
  PageHeader,
  Textarea,
  formatDate,
} from "@/app/_ui/ui";

export const dynamic = "force-dynamic";

// Round-trips through parseRewards in app/actions.ts, which uses the same
// gift fallback when a line has no icon.
function rewardsText(level: VaultLevelRow): string {
  return (level.rewards ?? []).map((r) => `${r.icon ?? "🎁"} ${r.label ?? ""}`.trim()).join("\n");
}

const REWARDS_HINT = "One per line: an icon (an emoji) first, then a space and the label.";

export default async function CommunityGoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requirePage("owner");
  const { error, saved } = await searchParams;
  const levels = await listVaultLevels();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Community Goals"
        count={levels.length}
        description="The Core Vault levels. The whole community's Restoration Energy (approved hours) unlocks each level for everyone once it crosses that energy threshold. Rewards are shown in-game as the equipment the Core recovers."
      />
      <Flash error={error} ok={saved ? "Saved." : null} />

      <Card>
        <CardHeader title="Add a vault level" icon="plus" />
        <form action={addVaultLevel} className="flex flex-col gap-3">
          <LevelFields />
          <div>
            <ActionButton pendingLabel="Adding...">Add level</ActionButton>
          </div>
        </form>
      </Card>

      <div className="flex flex-col gap-4">
        {levels.map((l) => (
          <Card key={l.id} className={l.active ? "" : "opacity-60"}>
            <form action={updateVaultLevel} className="flex flex-col gap-3">
              <input type="hidden" name="id" value={l.id} />
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="info">LV {l.level}</Badge>
                <span className="font-bold">{l.title}</span>
                <Badge tone="warning" icon="bolt-circle">
                  {l.energy_required.toLocaleString()}
                </Badge>
                {!l.active && <Badge tone="neutral">hidden</Badge>}
                <div className="ml-auto">
                  <ActionButton variant="outline" size="sm" pendingLabel="Saving...">
                    Save
                  </ActionButton>
                </div>
              </div>
              <LevelFields level={l} />
              {l.unlocked_at && (
                <Muted className="text-xs">
                  Chapter closed {formatDate(l.unlocked_at)}. Its leaderboard prize is already settled and won&apos;t
                  change if you edit the numbers above.
                </Muted>
              )}
            </form>
            <div className="mt-4 flex items-center gap-2 border-t pt-4" style={{ borderColor: "var(--border)" }}>
              <form action={toggleVaultLevel}>
                <input type="hidden" name="id" value={l.id} />
                <input type="hidden" name="active" value={l.active ? "0" : "1"} />
                <ActionButton
                  variant="outline"
                  size="sm"
                  icon={l.active ? "view-hide" : "view"}
                  pendingLabel={l.active ? "Hiding..." : "Showing..."}
                >
                  {l.active ? "Hide" : "Show"}
                </ActionButton>
              </form>
              <form action={deleteVaultLevel}>
                <input type="hidden" name="id" value={l.id} />
                <ActionButton
                  variant="danger"
                  size="sm"
                  icon="delete"
                  pendingLabel="Deleting..."
                  confirm={`Delete level ${l.level} "${l.title}"? This can't be undone.`}
                >
                  Delete
                </ActionButton>
              </form>
            </div>
          </Card>
        ))}
        {levels.length === 0 && (
          <Card>
            <EmptyState title="No vault levels yet" icon="trophy">
              Add the first community goal above.
            </EmptyState>
          </Card>
        )}
      </div>
    </div>
  );
}

// Shared by the add and edit forms; the field names are what the actions read.
function LevelFields({ level: l }: { level?: VaultLevelRow }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Level #">
          <Input name="level" type="number" min={l ? undefined : 1} required={!l} defaultValue={l?.level} placeholder="6" />
        </Field>
        <Field label="Energy required">
          <Input
            name="energy_required"
            type="number"
            min={l ? undefined : 0}
            required={!l}
            defaultValue={l?.energy_required}
            placeholder="8000"
          />
        </Field>
        <Field label="Title" className="sm:col-span-2">
          <Input name="title" required={!l} maxLength={80} defaultValue={l?.title} placeholder="The Deep Archive" />
        </Field>
      </div>
      <Field label="Blurb (shown in-game)">
        <Input
          name="blurb"
          maxLength={400}
          defaultValue={l?.blurb}
          placeholder="A sealed vault of pre-Crash secrets reopens."
        />
      </Field>
      <div className="grid items-start gap-3 sm:grid-cols-[1fr_auto]">
        <Field label="Rewards" hint={REWARDS_HINT}>
          <Textarea name="rewards" rows={3} defaultValue={l ? rewardsText(l) : undefined} />
        </Field>
        <Field label="Sort position">
          <Input name="position" type="number" defaultValue={l?.position} placeholder="6" className="sm:w-28" />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Top 1 chapter RE bonus">
          <Input name="top1_re" type="number" min={0} defaultValue={l ? (l.top1_re ?? 0) : undefined} placeholder="200" />
        </Field>
        <Field label="Top 2 chapter RE bonus">
          <Input name="top2_re" type="number" min={0} defaultValue={l ? (l.top2_re ?? 0) : undefined} placeholder="100" />
        </Field>
        <Field label="Top 3 chapter RE bonus">
          <Input name="top3_re" type="number" min={0} defaultValue={l ? (l.top3_re ?? 0) : undefined} placeholder="50" />
        </Field>
      </div>
      {!l && (
        <Muted className="text-xs">
          Paid once, automatically, to whoever contributed the most RE this chapter when this level unlocks. Leave at 0
          for no leaderboard prize.
        </Muted>
      )}
    </>
  );
}
