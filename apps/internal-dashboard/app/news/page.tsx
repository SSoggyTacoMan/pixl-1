import { requirePage } from "@/lib/guard";
import { listNews } from "@/lib/db";
import { addNews, updateNews, toggleNews, deleteNews } from "@/app/actions";
import {
  ActionButton,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Flash,
  Input,
  PageHeader,
  Textarea,
  formatDate,
} from "@/app/_ui/ui";

export const dynamic = "force-dynamic";

// The <input type="datetime-local"> value format, in UTC so it matches how the
// posts are stored and how the players' page renders them.
function localInputValue(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return at.toISOString().slice(0, 16);
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requirePage("owner");
  const { error, saved } = await searchParams;
  const posts = await listNews();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="News"
        count={posts.length}
        description="The news feed on the players' projects page. One short line per post, newest first. Hidden posts stay here but drop out of the feed."
      />
      <Flash error={error} ok={saved ? "Saved." : null} />

      <Card>
        <CardHeader title="Post news" icon="announcement" />
        <form action={addNews} className="flex flex-col gap-3">
          <Field label="Post">
            <Textarea name="body" rows={2} required maxLength={500} placeholder="New items added to the shop!" />
          </Field>
          <div className="grid items-start gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="Link (optional)">
              <Input name="link_url" type="url" maxLength={500} placeholder="https://pixl.hackclub.com/shop" />
            </Field>
            <Field label="Date (optional, UTC)">
              <Input name="posted_at" type="datetime-local" className="sm:w-56" />
            </Field>
          </div>
          <div>
            <ActionButton icon="send" pendingLabel="Posting...">
              Post
            </ActionButton>
          </div>
        </form>
      </Card>

      <div className="flex flex-col gap-4">
        {posts.map((p) => (
          <Card key={p.id} className={p.active ? "" : "opacity-60"}>
            <form action={updateNews} className="flex flex-col gap-3">
              <input type="hidden" name="id" value={p.id} />
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="info">{formatDate(p.posted_at)}</Badge>
                {!p.active && <Badge tone="neutral">hidden</Badge>}
                <div className="ml-auto">
                  <ActionButton variant="outline" size="sm" pendingLabel="Saving...">
                    Save
                  </ActionButton>
                </div>
              </div>
              <Field label="Post">
                <Textarea name="body" rows={2} defaultValue={p.body} maxLength={500} />
              </Field>
              <div className="grid items-start gap-3 sm:grid-cols-[1fr_auto]">
                <Field label="Link">
                  <Input name="link_url" type="url" defaultValue={p.link_url ?? ""} maxLength={500} />
                </Field>
                <Field label="Date (UTC)">
                  <Input
                    name="posted_at"
                    type="datetime-local"
                    defaultValue={localInputValue(p.posted_at)}
                    className="sm:w-56"
                  />
                </Field>
              </div>
            </form>
            <div className="mt-4 flex items-center gap-2 border-t pt-4" style={{ borderColor: "var(--border)" }}>
              <form action={toggleNews}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="active" value={p.active ? "0" : "1"} />
                <ActionButton
                  variant="outline"
                  size="sm"
                  icon={p.active ? "view-hide" : "view"}
                  pendingLabel={p.active ? "Hiding..." : "Showing..."}
                >
                  {p.active ? "Hide" : "Show"}
                </ActionButton>
              </form>
              <form action={deleteNews}>
                <input type="hidden" name="id" value={p.id} />
                <ActionButton
                  variant="danger"
                  size="sm"
                  icon="delete"
                  pendingLabel="Deleting..."
                  confirm="Delete this post? This can't be undone."
                >
                  Delete
                </ActionButton>
              </form>
            </div>
          </Card>
        ))}
        {posts.length === 0 && (
          <Card>
            <EmptyState title="Nothing posted yet" icon="announcement">
              Write the first one above.
            </EmptyState>
          </Card>
        )}
      </div>
    </div>
  );
}
