import { redirect } from "next/navigation";
import { requirePage, requireGuidelinesAck } from "@/lib/guard";
import { canSeeBuilderPII } from "@/lib/reviewAccess";
import { listReviewAudits } from "@/lib/db";
import { getLiveMode } from "@/lib/liveModeServer";
import { LiveBlocked } from "@/app/_components/LiveBlocked";
import { parseAuditNote, type AuditHeader } from "@/lib/auditNote";
import { Badge, Card, EmptyState, Muted, TextLink, formatDateTime, type Tone } from "@/app/_ui/ui";

export const dynamic = "force-dynamic";

// Friendly labels for the structured audit-note sections (see buildAuditNote
// in lib/auditNote.ts). "NOTES" is the reviewer's freeform "Additional notes"
// field from the review form, shown as its own block.
const SECTION_LABEL: Record<AuditHeader, string> = {
  "TECHNICAL FEATURES": "Technical features",
  "DEFLATION REASON": "Deflation reason",
  "AGE JUSTIFICATION": "Age justification",
  NOTES: "Additional notes",
};

const VERDICT_TONE: Record<string, Tone> = {
  approved: "success",
  first_pass_approved: "neutral",
  needs_changes: "warning",
  reverted: "danger",
  banned: "danger",
  first_pass_banned: "danger",
};

export default async function AuditNotesPage() {
  const access = await requirePage("reviewer");
  await requireGuidelinesAck(access);
  if (!access.isOwner) redirect("/review");
  if (await getLiveMode()) return <LiveBlocked what="Audit notes" reason="These are internal reviewer notes" />;
  // Legal names only for owners/final reviewers.
  const audits = await listReviewAudits(200, undefined, { realNames: canSeeBuilderPII(access) });
  const withNotes = audits.filter((a) => a.audit_note && a.audit_note.trim() !== "");

  return (
    <div className="flex flex-col gap-6">
      <p className="hc-caption max-w-2xl text-sm">
        Internal notes reviewers write with every verdict. Players never see these: they&apos;re for audits
        and fraud checks.
      </p>
      {withNotes.length === 0 ? (
        <Card>
          <EmptyState title="No audit notes yet" icon="docs">
            They&apos;ll appear as reviews come in.
          </EmptyState>
        </Card>
      ) : (
        withNotes.map((a) => {
          const sections = parseAuditNote(a.audit_note);
          return (
            <Card key={a.id}>
              <div className="flex flex-wrap items-center gap-2">
                <TextLink href={`/projects/${a.project_id}`} className="font-bold">
                  {a.project_name}
                </TextLink>
                <Badge tone={VERDICT_TONE[a.verdict] ?? "neutral"}>{a.verdict.replaceAll("_", " ")}</Badge>
                <Muted className="text-xs">
                  by {a.reviewer.replace(/\s*\([^)]*\)\s*$/, "")}, player{" "}
                  <TextLink href={`/players/${a.user_id}`}>{a.player_name}</TextLink>
                </Muted>
                <Muted className="ml-auto text-xs">{formatDateTime(a.created_at)}</Muted>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                {(Object.keys(SECTION_LABEL) as AuditHeader[])
                  .filter((h) => sections[h]?.trim())
                  .map((h) => (
                    <div key={h}>
                      <div className="hc-eyebrow">{SECTION_LABEL[h]}</div>
                      <p className="mt-1 text-sm whitespace-pre-wrap">{sections[h]}</p>
                    </div>
                  ))}
                {a.note?.trim() && (
                  <div>
                    <div className="hc-eyebrow">Note to player</div>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{a.note}</p>
                  </div>
                )}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
