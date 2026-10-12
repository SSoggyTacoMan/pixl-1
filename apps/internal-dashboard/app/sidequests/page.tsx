import { requirePage } from "@/lib/guard";
import { listSidequests, type SidequestRow } from "@/lib/db";
import { addSidequest, updateSidequest, toggleSidequest, deleteSidequest } from "@/app/actions";
import { NpcsTab } from "@/app/sidequests/NpcsTab";
import {
  ActionButton,
  Badge,
  Card,
  CardHeader,
  Details,
  EmptyState,
  Field,
  Flash,
  Input,
  LinkTabs,
  Muted,
  PageHeader,
  Textarea,
} from "@/app/_ui/ui";

export const dynamic = "force-dynamic";

// Trials and the NPCs who hand them out are edited together: a Trial-giver is
// just an NPC pointing at a Trial, so splitting them across two pages meant
// bouncing between them to wire one up. Tabs live in the URL so the server
// actions can redirect straight back to the one you were on.
export default async function SidequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; saved?: string; tab?: string }>;
}) {
  await requirePage("owner");
  const { error, created, saved, tab } = await searchParams;
  const quests = await listSidequests();
  const activeTab = tab === "npcs" ? "npcs" : "trials";
  const isNpc = created === "npc" || saved === "npc";
  const ok = created ? (isNpc ? "NPC added." : "Trial added.") : saved ? (isNpc ? "NPC saved." : "Trial saved.") : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Trials & NPCs"
        description="The quest log every player sees in-game (J key), and the characters who hand those quests out."
      />

      <LinkTabs
        active={activeTab}
        tabs={[
          { key: "trials", href: "/sidequests", label: "Trials", count: quests.length },
          { key: "npcs", href: "/sidequests?tab=npcs", label: "NPCs" },
        ]}
      />

      <Flash error={error} ok={ok} />

      {activeTab === "npcs" && <NpcsTab quests={quests} />}

      {activeTab === "trials" && (
        <>
          <Card>
            <CardHeader title="Add a trial" icon="plus" />
            <form action={addSidequest} className="flex flex-col gap-3">
              <TrialFields />
              <div>
                <ActionButton pendingLabel="Adding...">Add trial</ActionButton>
              </div>
            </form>
          </Card>

          <div className="flex flex-col gap-3">
            {quests.map((q) => (
              <Card key={q.id} padding="compact" className={q.active ? "" : "opacity-60"}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{q.name}</span>
                      {q.region && <Badge tone="info">{q.region}</Badge>}
                      {!q.active && <Badge tone="neutral">hidden</Badge>}
                    </div>
                    {q.description && (
                      <div className="mt-1 text-sm">
                        <Muted>{q.description}</Muted>
                      </div>
                    )}
                    <div className="mt-1 text-xs">
                      <Muted>
                        {q.npc ? `given by ${q.npc}` : "no NPC set"}
                        {q.reward ? ` · reward: ${q.reward}` : ""}
                        {q.min_hours != null ? ` · min ${q.min_hours}h` : ""}
                      </Muted>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <form action={toggleSidequest}>
                      <input type="hidden" name="id" value={q.id} />
                      <input type="hidden" name="active" value={q.active ? "0" : "1"} />
                      <ActionButton
                        variant="outline"
                        size="sm"
                        icon={q.active ? "view-hide" : "view"}
                        pendingLabel={q.active ? "Hiding..." : "Showing..."}
                      >
                        {q.active ? "Hide" : "Show"}
                      </ActionButton>
                    </form>
                    <form action={deleteSidequest}>
                      <input type="hidden" name="id" value={q.id} />
                      <ActionButton
                        variant="danger"
                        size="sm"
                        icon="delete"
                        pendingLabel="Deleting..."
                        confirm={`Delete trial "${q.name}"? This can't be undone.`}
                      >
                        Delete
                      </ActionButton>
                    </form>
                  </div>
                </div>

                <div className="mt-3">
                  <Details summary="Edit">
                    <form action={updateSidequest} className="flex flex-col gap-3">
                      <input type="hidden" name="id" value={q.id} />
                      <TrialFields quest={q} />
                      <div>
                        <ActionButton size="sm" pendingLabel="Saving...">
                          Save changes
                        </ActionButton>
                      </div>
                    </form>
                  </Details>
                </div>
              </Card>
            ))}
            {quests.length === 0 && (
              <Card>
                <EmptyState title="No trials yet" icon="flag">
                  The landing page&apos;s trial rewards are good seeds.
                </EmptyState>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Shared by the add and edit forms; the field names are what the actions read.
function TrialFields({ quest }: { quest?: SidequestRow }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name">
          <Input
            name="name"
            required
            maxLength={80}
            defaultValue={quest?.name}
            placeholder="e.g. Secure the Cyberpunk City network"
          />
        </Field>
        <Field label="Region">
          <Input name="region" maxLength={40} defaultValue={quest?.region ?? ""} placeholder="e.g. Cyberpunk City" />
        </Field>
        <Field label="NPC who gives it">
          <Input name="npc" maxLength={40} defaultValue={quest?.npc ?? ""} placeholder="e.g. The Netrunner" />
        </Field>
      </div>
      <Field label="Description" hint="Short, shown by the NPC up front.">
        <Input
          name="description"
          maxLength={500}
          defaultValue={quest?.description ?? ""}
          placeholder="Build a security tool or CTF-style challenge..."
        />
      </Field>
      <Field label="Full brief" hint="Detailed spec, shown in the Builder Terminal after the player accepts.">
        <Textarea
          name="brief"
          maxLength={3000}
          rows={5}
          defaultValue={quest?.brief ?? ""}
          placeholder="Precise deliverables and acceptance criteria: (1) ..., (2) ..., repo must include ..."
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Reward (shown to players)" className="sm:col-span-2">
          <Input name="reward" maxLength={120} defaultValue={quest?.reward ?? ""} placeholder="e.g. Flipper Zero" />
        </Field>
        <Field label="Min hours (optional gate)">
          <Input
            name="minHours"
            type="number"
            min="0"
            step="0.5"
            defaultValue={quest?.min_hours ?? ""}
            placeholder="e.g. 7"
          />
        </Field>
      </div>
    </>
  );
}
