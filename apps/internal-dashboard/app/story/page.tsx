import { requirePage } from "@/lib/guard";
import { listStoryNodes, type StoryNodeRow } from "@/lib/db";
import { addStoryNode, updateStoryNode, toggleStoryNode, deleteStoryNode } from "@/app/actions";
import {
  ActionButton,
  Badge,
  Card,
  CardHeader,
  Code,
  EmptyState,
  Field,
  Flash,
  Input,
  NativeSelect,
  PageHeader,
  Textarea,
} from "@/app/_ui/ui";

export const dynamic = "force-dynamic";

const KINDS = ["chapter", "operation", "prologue"];

function NodeFields({ n }: { n?: StoryNodeRow }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Kind">
          <NativeSelect name="kind" defaultValue={n?.kind ?? "chapter"}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Seal" hint="Badge glyph.">
          <Input name="seal" defaultValue={n?.seal} maxLength={8} placeholder="I" />
        </Field>
        <Field label="Tag">
          <Input name="tag" defaultValue={n?.tag} maxLength={40} placeholder="CHAPTER I" />
        </Field>
        <Field label="Duration">
          <Input name="duration" defaultValue={n?.duration} maxLength={40} placeholder="3 WEEKS" />
        </Field>
      </div>

      <Field label="Title">
        <Input name="title" defaultValue={n?.title} required maxLength={120} placeholder="Rise of Pixl" />
      </Field>

      <Field label="Body">
        <Textarea name="body" defaultValue={n?.body} rows={3} placeholder="What happens in this chapter..." />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Quote" hint="Operations only. The italic teaser line.">
          <Input name="quote" defaultValue={n?.quote} maxLength={300} placeholder="The Capital is standing..." />
        </Field>
        <Field label="Outcome" hint="Operations only. Supports <b> for bold.">
          <Input name="outcome" defaultValue={n?.outcome} maxLength={400} placeholder="The Great Forge is restored." />
        </Field>
      </div>

      <Field label="Sort position" className="sm:w-40">
        <Input name="position" type="number" defaultValue={n?.position ?? 0} />
      </Field>
    </div>
  );
}

export default async function StoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requirePage("owner");
  const { error, saved } = await searchParams;
  const nodes = await listStoryNodes();

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Story"
        count={nodes.length}
        description={
          <>
            The season timeline players see at <Code>/timeline</Code>: chapters, operations and the prologue, in
            order. Edits go live on the page.
          </>
        }
      />
      <Flash error={error} ok={saved ? "Saved." : null} />

      <Card>
        <CardHeader title="Add a node" icon="plus" />
        <form action={addStoryNode} className="flex flex-col gap-4">
          <NodeFields />
          <div>
            <ActionButton pendingLabel="Adding...">Add node</ActionButton>
          </div>
        </form>
      </Card>

      <div className="flex flex-col gap-4">
        {nodes.map((n) => (
          <Card key={n.id} className={n.active ? "" : "opacity-60"}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge tone="info">{n.kind}</Badge>
              {n.tag && <Badge tone="neutral" outline>{n.tag}</Badge>}
              <span className="font-bold">{n.title}</span>
              {!n.active && <Badge tone="neutral">hidden</Badge>}
            </div>
            <form action={updateStoryNode} className="flex flex-col gap-4">
              <input type="hidden" name="id" value={n.id} />
              <NodeFields n={n} />
              <div>
                <ActionButton variant="outline" size="sm" pendingLabel="Saving...">
                  Save changes
                </ActionButton>
              </div>
            </form>
            <div className="mt-4 flex items-center gap-2 border-t pt-4" style={{ borderColor: "var(--border)" }}>
              <form action={toggleStoryNode}>
                <input type="hidden" name="id" value={n.id} />
                <input type="hidden" name="active" value={n.active ? "0" : "1"} />
                <ActionButton
                  variant="outline"
                  size="sm"
                  icon={n.active ? "view-hide" : "view"}
                  pendingLabel={n.active ? "Hiding..." : "Showing..."}
                >
                  {n.active ? "Hide" : "Show"}
                </ActionButton>
              </form>
              <form action={deleteStoryNode}>
                <input type="hidden" name="id" value={n.id} />
                <ActionButton
                  variant="danger"
                  size="sm"
                  icon="delete"
                  pendingLabel="Deleting..."
                  confirm={`Delete "${n.title}"? This can't be undone.`}
                >
                  Delete
                </ActionButton>
              </form>
            </div>
          </Card>
        ))}
        {nodes.length === 0 && (
          <Card>
            <EmptyState title="No story nodes yet" icon="docs">
              Add the prologue and your first chapter above.
            </EmptyState>
          </Card>
        )}
      </div>
    </div>
  );
}
