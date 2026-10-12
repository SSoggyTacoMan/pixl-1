import { requirePage, requireGuidelinesAck } from "@/lib/guard";
import { getHideReviewers } from "@/lib/liveModeServer";
import { reviewerName } from "@/lib/liveMode";
import { db, payoutTotalsBySlackId, type ReviewAuditRow } from "@/lib/db";
import { ReviewVerdictChart, type VerdictWindow } from "@/app/_components/ReviewVerdictChart";
import { slackIdFromLabel, summarizeWindow } from "@/lib/reviewStats";
import { Badge, Card, CardHeader, EmptyRow, Muted, Table, TextLink, formatDate } from "@/app/_ui/ui";
import { reviewerPlayerId, reviewerPlayerIds } from "../reviewerLinks";

export const dynamic = "force-dynamic";

interface ReviewerStats {
  reviewer: string;
  total: number;
  approved: number;
  firstPass: number;
  changes: number;
  reverted: number;
  hoursCredited: number;
  pixelsWon: number;
  avgSeconds: number;
  lastActive: string;
}

function fmtDur(secs: number): string {
  if (secs <= 0) return "-";
  if (secs < 60) return `${Math.round(secs)}s`;
  if (secs < 3600) return `${Math.round(secs / 60)}m`;
  return `${(secs / 3600).toFixed(1)}h`;
}

export default async function ReviewStatsPage() {
  const access = await requirePage("reviewer");
  await requireGuidelinesAck(access);
  // While live, other reviewers show as "Reviewer" (the Show reviewer names
  // button reveals them); masked here on the server so the real names never
  // reach the chart's client props.
  const hideReviewers = await getHideReviewers();
  const rn = (label: string) => reviewerName(label, access.session.slackId, hideReviewers);
  const [{ data, error }, payoutTotals] = await Promise.all([
    db.from("review_audits").select("*").order("created_at", { ascending: false }).limit(2000),
    payoutTotalsBySlackId(),
  ]);
  if (error) console.error("review stats", error.message);
  const audits = (data ?? []) as ReviewAuditRow[];
  // The board is open to anyone who can reach /review. Avg time stays
  // owner-only: it's a moderation signal about a reviewer, not a scoreboard
  // stat, and reading it as a ranking gets it wrong.
  const showAuditColumns = access.isOwner;

  // Calendar windows in UTC (packages/config's convention). "This week"
  // starts Monday, matching an ISO week rather than a rolling 7 days.
  const now = new Date();
  const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  const weekStart = dayStart - daysSinceMonday * 86_400_000;
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const windowDefs: { key: string; label: string; since: number | null }[] = [
    { key: "all", label: "All time", since: null },
    { key: "day", label: "Today", since: dayStart },
    { key: "week", label: "This week", since: weekStart },
    { key: "month", label: "This month", since: monthStart },
  ];
  const verdictWindows: VerdictWindow[] = windowDefs.map((w) => ({
    key: w.key,
    label: w.label,
    ...summarizeWindow(audits, w.since, rn),
  }));

  // Owners can open a reviewer's own Pixl account (the players pages are
  // owner-only). Never while the name is masked: the URL would give it away.
  const reviewerIds = access.isOwner ? await reviewerPlayerIds(audits.map((a) => a.reviewer)) : new Map<string, string>();
  const reviewerLink = (label: string) => (rn(label) === "Reviewer" ? null : reviewerPlayerId(reviewerIds, label));

  const byReviewer = new Map<string, ReviewAuditRow[]>();
  for (const a of audits) {
    const list = byReviewer.get(a.reviewer) ?? [];
    list.push(a);
    byReviewer.set(a.reviewer, list);
  }
  const stats: ReviewerStats[] = [...byReviewer.entries()].map(([reviewer, rows]) => {
    const approved = rows.filter((r) => r.verdict === "approved");
    const timed = rows.filter((r) => (r.total_seconds ?? 0) > 0);
    const slackId = slackIdFromLabel(reviewer);
    return {
      reviewer,
      total: rows.length,
      approved: approved.length,
      firstPass: rows.filter((r) => r.verdict === "first_pass_approved").length,
      changes: rows.filter((r) => r.verdict === "needs_changes").length,
      reverted: rows.filter((r) => r.verdict === "reverted").length,
      hoursCredited: Math.round(approved.reduce((s, r) => s + (Number(r.approved_hours) || 0), 0) * 10) / 10,
      // Actual pixels paid out (review_payouts.paid_pixels), never recomputed
      // at today's rate: payout rates have changed over time.
      pixelsWon: slackId ? (payoutTotals.get(slackId)?.earnedPixels ?? 0) : 0,
      avgSeconds: timed.length > 0 ? timed.reduce((s, r) => s + r.total_seconds, 0) / timed.length : 0,
      lastActive: rows[0]?.created_at ?? "",
    };
  });
  stats.sort((a, b) => b.total - a.total);

  const headers = [
    "Reviewer",
    "Reviews",
    "Approved",
    "First pass",
    "Changes",
    "Hours credited",
    "Pixels won",
    ...(showAuditColumns ? ["Avg time"] : []),
    "Last active",
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader title="Verdicts over time" icon="analytics" />
        <p className="hc-caption mb-4 text-sm">Every review verdict across the whole team, by outcome.</p>
        <ReviewVerdictChart windows={verdictWindows} />
      </Card>

      <Card padding="flush">
        <CardHeader title="Reviewers" icon="leaders" count={stats.length} />
        <p className="hc-caption px-4 py-3 text-sm">
          From the review audit log: verdicts, hours credited and pixels won per reviewer
          {showAuditColumns ? ", plus time spent per review." : "."} Pixels won is the lifetime total actually
          paid out, at whatever rate was in effect at the time.
        </p>
        <Table headers={headers}>
          {stats.map((s, i) => {
            const rushed = s.avgSeconds > 0 && s.avgSeconds < 60;
            return (
              <tr key={hideReviewers ? i : s.reviewer}>
                <td className="font-bold break-words">
                  {reviewerLink(s.reviewer) ? (
                    <TextLink href={`/players/${reviewerLink(s.reviewer)}`}>{rn(s.reviewer)}</TextLink>
                  ) : (
                    rn(s.reviewer)
                  )}
                </td>
                <td className="hc-mono">{s.total}</td>
                <td className="hc-mono font-bold text-[var(--hc-green)]">{s.approved}</td>
                <td className="hc-mono">{s.firstPass}</td>
                <td className="hc-mono">{s.changes}</td>
                <td className="hc-mono">{s.hoursCredited}h</td>
                <td className="hc-mono">{s.pixelsWon.toLocaleString()} px</td>
                {showAuditColumns && (
                  <td>
                    {rushed ? (
                      <span title="Under a minute per review. Rubber-stamping?">
                        <Badge tone="danger" icon="important">
                          {fmtDur(s.avgSeconds)}
                        </Badge>
                      </span>
                    ) : (
                      <span className="hc-mono">{fmtDur(s.avgSeconds)}</span>
                    )}
                  </td>
                )}
                <td className="whitespace-nowrap">
                  <Muted>{s.lastActive ? formatDate(s.lastActive) : "-"}</Muted>
                </td>
              </tr>
            );
          })}
          {stats.length === 0 && <EmptyRow colSpan={headers.length} title="No reviews logged yet" icon="history" />}
        </Table>
      </Card>
    </div>
  );
}
