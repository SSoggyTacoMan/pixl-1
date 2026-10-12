import Link from "next/link";
import { requirePage } from "@/lib/guard";
import { getLiveMode } from "@/lib/liveModeServer";
import { LiveBlocked } from "@/app/_components/LiveBlocked";
import { listReports } from "@/lib/db";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, "warning" | "default" | "destructive"> = {
  open: "warning",
  resolved: "default",
  dismissed: "destructive",
};

function aiBadge(verdict: string): "destructive" | "warning" | "outline" | "default" {
  const v = verdict.toLowerCase();
  if (v === "severe") return "destructive";
  if (v === "concerning") return "warning";
  if (v === "minor") return "outline";
  return "default";
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; verror?: string }>;
}) {
  await requirePage("owner");
  if (await getLiveMode()) return <LiveBlocked what="Reports" />;
  const { status, verror } = await searchParams;
  const all = await listReports(500);

  const REPEAT_THRESHOLD = 3;
  const targetCounts = new Map<string, number>();
  const reporterCounts = new Map<string, number>();
  for (const r of all) {
    targetCounts.set(r.target_id, (targetCounts.get(r.target_id) ?? 0) + 1);
    reporterCounts.set(r.reporter_id, (reporterCounts.get(r.reporter_id) ?? 0) + 1);
  }

  const openCount = all.filter((r) => r.status === "open").length;
  const activeStatus =
    status === "resolved" || status === "dismissed" || status === "all" ? status : "open";
  const rows = activeStatus === "all" ? all : all.filter((r) => r.status === activeStatus);

  const filters = [
    { key: "open", label: "Open", count: openCount },
    { key: "resolved", label: "Resolved" },
    { key: "dismissed", label: "Dismissed" },
    { key: "all", label: "All", count: all.length },
  ];
  const href = (s: string) => (s === "open" ? "/reports" : `/reports?status=${s}`);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground tracking-tight mb-1">Reports</h1>
      <p className="text-sm text-muted-foreground mb-5">
        Players flagged by other players. Owners only. Each report runs an AI pass over the reported player&apos;s recent chat.
      </p>

      {verror && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription className="font-medium text-destructive">{verror}</AlertDescription>
        </Alert>
      )}

      <div className="inline-flex items-center rounded-lg border border-border p-0.5 bg-card mb-4">
        {filters.map((f) => (
          <Button
            key={f.key}
            asChild
            variant="ghost"
            size="sm"
            className={
              activeStatus === f.key
                ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                : ""
            }
          >
            <Link href={href(f.key)}>
              {f.label}
              {typeof f.count === "number" ? ` (${f.count})` : ""}
            </Link>
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {rows.length === 0 && (
          <Card className="p-6 text-muted-foreground text-sm text-center">No reports here.</Card>
        )}
        {rows.map((r) => (
          <Link key={r.id} href={`/reports/${r.id}`} className="block">
            <Card className="p-4 gap-0 transition-[box-shadow] hover:ring-brand/40">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-medium text-foreground">{r.target_name}</span>
                <Badge variant={STATUS_BADGE[r.status] ?? "default"} className="capitalize">
                  {r.status}
                </Badge>
                {r.ai_verdict && (
                  <Badge variant={aiBadge(r.ai_verdict)} className="capitalize">
                    AI: {r.ai_verdict}
                    {r.ai_score != null ? ` ${r.ai_score}/100` : ""}
                  </Badge>
                )}
                {(targetCounts.get(r.target_id) ?? 0) >= REPEAT_THRESHOLD && (
                  <Badge variant="destructive">🚩 {targetCounts.get(r.target_id)}×</Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {!r.anonymous || (reporterCounts.get(r.reporter_id) ?? 0) >= REPEAT_THRESHOLD
                    ? `by ${r.reporter_name}${r.anonymous ? " 🚩" : ""}`
                    : "anonymous"}{" "}
                  · {new Date(r.created_at).toLocaleString()}
                </span>
              </div>
              {r.reason && (
                <p className="text-sm text-foreground/80 mt-2 line-clamp-2 break-words">{r.reason}</p>
              )}
              {r.ai_summary && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 break-words">
                  🤖 {r.ai_summary}
                </p>
              )}
            </Card>
          </Link>
        ))}
      </div>

    </div>
  );
}
