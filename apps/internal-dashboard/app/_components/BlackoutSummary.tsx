import { BlackoutBadge } from "@/app/_components/BlackoutBadge";
import { Callout, Card, Muted } from "@/app/_ui/ui";
import { ENTRY_STATUS_LABEL, settleNoteText, type BlackoutEntry } from "@/lib/operations";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  }) + " UTC";
const h = (n: number) => `${Math.round(n * 100) / 100}h`;

export function BlackoutSummary({ entry }: { entry: BlackoutEntry }) {
  const missingEvidence = entry.contributors.filter((c) => !c.evidenceOk);
  return (
    <Card padding="compact">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <BlackoutBadge />
          <span className="hc-heading text-sm">{entry.operation.name}</span>
          <Muted className="text-xs">{ENTRY_STATUS_LABEL[entry.status]}</Muted>
        </div>
        <div className="hc-caption grid gap-0.5 text-xs">
          <span>
            Joined {fmt(entry.joinedAt)}
            {entry.firstQualifiedShipAt ? ` · first ship ${fmt(entry.firstQualifiedShipAt)}` : ""}
          </span>
          {entry.systemReason && <span>{entry.systemReason}</span>}
          {entry.decision && (
            <span>
              Ruled <strong>{entry.decision}</strong>
              {entry.decidedBy && entry.decidedBy !== "system"
                ? ` by ${entry.decidedBy.replace(/\s*\([^)]*\)\s*$/, "")}`
                : ""}
              {entry.decisionNote ? `: ${entry.decisionNote}` : ""}
            </span>
          )}
          {entry.status === "needs_changes" && entry.graceDeadline && (
            <span>Fix window open until {fmt(entry.graceDeadline)}</span>
          )}
        </div>
        {missingEvidence.length > 0 && (
          <Callout tone="danger" icon="important">
            <strong>Time evidence incomplete:</strong> Hackatime couldn&apos;t be read at ship time for{" "}
            {missingEvidence.map((c) => c.name).join(", ")}; tracked hours may be under-counted.
          </Callout>
        )}
        {entry.contributors.some((c) => c.settled) && (
          <div className="grid gap-1">
            {entry.contributors.map((c) => (
              <div key={c.userId} className="flex flex-wrap justify-between gap-3 text-xs">
                <span>{c.name}</span>
                <Muted>
                  {c.settled
                    ? `${h(c.paidHours)} at $${(c.effectiveUsdRate ?? 0).toFixed(2)}/hr (own rate $${(c.normalUsdRate ?? 0).toFixed(2)}), +${c.upliftPx} px`
                    : "not settled"}
                  {c.settleNote ? `. ${settleNoteText(c.settleNote)}` : ""}
                </Muted>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
