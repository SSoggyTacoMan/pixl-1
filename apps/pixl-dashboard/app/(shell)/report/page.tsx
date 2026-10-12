import type { Metadata } from "next";
import { Card, CardTitle, PageHeader } from "@/components/ui/primitives";
import { serverApi } from "@/lib/server-api";
import { ReportForm } from "./report-form";
import "./report.css";

export const metadata: Metadata = { title: "Report a player" };

interface MyReport {
  id?: number | string;
  target_name: string;
  status: string;
  anonymous: boolean;
  reason?: string | null;
  created_at: string;
}

function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!isFinite(s)) return "";
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US");
}

export default async function ReportPage() {
  const mine = (await serverApi<{ reports?: MyReport[] }>("/api/reports/mine"))?.reports ?? [];

  return (
    <div className="report-wrap">
      <PageHeader title="REPORT A PLAYER" sub="Seen someone being mean? Let the team know. You can stay anonymous." />

      <Card className="mb-6">
        <CardTitle className="mb-3 text-gold">FILE A REPORT</CardTitle>
        <ReportForm />
      </Card>

      <Card>
        <CardTitle className="mb-3 text-gold">YOUR REPORTS</CardTitle>
        {mine.length === 0 ? (
          <p className="faint p-1.5 text-sm">You haven&apos;t filed any reports.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {mine.map((r, i) => {
              const done = r.status !== "open";
              return (
                <div key={String(r.id ?? i)} className="rep">
                  <div className="rep-head">
                    <span className="rep-target">{r.target_name}</span>
                    <span className={`tag ${done ? "done" : "open"}`}>{done ? r.status.toUpperCase() : "OPEN"}</span>
                    <span className="tag anon">{r.anonymous ? "ANONYMOUS" : "IDENTITY SHARED"}</span>
                    <span className="rep-meta">{timeAgo(r.created_at)}</span>
                  </div>
                  {r.reason ? <div className="rep-reason">{r.reason}</div> : null}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
