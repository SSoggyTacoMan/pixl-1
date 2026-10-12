/* eslint-disable @next/next/no-img-element */
import { addProjectNote } from "@/app/actions";
import { ActionButton, Card, CardHeader, Field, Muted, Textarea, formatDateTime } from "@/app/_ui/ui";
import type { ProjectNoteRow } from "@/lib/db";

// Free-form internal notes any reviewer can leave on a project. Not tied to a
// verdict, just context for whoever looks at this project next. Shared between
// the project detail page and the review page, since reviewers work from both.
export function ProjectNotes({
  projectId,
  notes,
  className = "",
}: {
  projectId: number;
  notes: ProjectNoteRow[];
  className?: string;
}) {
  return (
    <div className={className}>
      <Card>
        <CardHeader title="Reviewer notes" icon="message" count={notes.length} />
        <form action={addProjectNote} className="mb-4 flex flex-col gap-3">
          <input type="hidden" name="projectId" value={projectId} />
          <Textarea
            name="body"
            required
            maxLength={2000}
            rows={2}
            placeholder="Leave a note for whoever looks at this project next..."
          />
          <Field label="Screenshot" hint="Optional. PNG, JPEG or WebP.">
            <input name="image" type="file" accept="image/png,image/jpeg,image/webp" className="hc-file" />
          </Field>
          <div>
            <ActionButton variant="outline" size="sm" pendingLabel="Adding...">
              Add note
            </ActionButton>
          </div>
        </form>
        {notes.length === 0 ? (
          <Muted className="text-sm">No notes yet.</Muted>
        ) : (
          <ul className="flex flex-col">
            {notes.map((n) => (
              <li key={n.id} className="border-t border-[var(--border)] py-3 text-sm last:pb-0">
                <p className="whitespace-pre-wrap break-words">{n.body}</p>
                {n.image_url && (
                  <a href={n.image_url} target="_blank" rel="noreferrer" className="mt-2 inline-block">
                    <img
                      src={n.image_url}
                      alt=""
                      className="max-h-48 rounded border border-[var(--border)] object-cover"
                    />
                  </a>
                )}
                <p className="hc-caption mt-1 text-xs">
                  {n.author} · {formatDateTime(n.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
