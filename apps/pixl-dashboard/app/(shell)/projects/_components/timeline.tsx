// Review timeline, rendered on the server from GET /api/projects/:id/timeline.
import type { TimelineData, TimelineEvent } from "../data";
import { timeAgo } from "../format";
import { cn } from "@/lib/cn";

type Dot = "" | "ok" | "rev" | "warn" | "bad";
const DOT_BG: Record<Dot, string> = { "": "bg-panel", ok: "bg-good", rev: "bg-teal", warn: "bg-gold", bad: "bg-bad" };

const VERDICTS: Record<string, [Dot, string]> = {
  approved: ["ok", "Approved"],
  first_pass_approved: ["rev", "Passed first review"],
  needs_changes: ["warn", "Sent back for changes"],
  rejected: ["bad", "Rejected"],
};

function Item({ dot, title, time, children }: { dot: Dot; title: string; time: string; children?: React.ReactNode }) {
  return (
    <div className="relative">
      <span className={cn("absolute -left-[21px] top-[6px] size-[12px] border-2 border-stroke", DOT_BG[dot])} />
      <div className="flex items-baseline gap-[10px] text-[14px]">
        <span>{title}</span>
        <span className="text-[12px] text-faint">{time}</span>
      </div>
      {children}
    </div>
  );
}

function Row({ e }: { e: TimelineEvent }) {
  if (e.kind === "created") return <Item dot="" title="Project created" time={timeAgo(e.at)} />;
  if (e.kind === "shipped") return <Item dot="" title="Shipped for review" time={timeAgo(e.at)} />;
  const [dot, title] = VERDICTS[e.verdict ?? ""] ?? ["rev", "Reviewed"];
  const claimed = Number(e.claimedHours || 0);
  const approved = e.approvedHours != null ? Number(e.approvedHours) : null;
  return (
    <Item dot={dot} title={title} time={timeAgo(e.at)}>
      {approved != null ? (
        <div className="text-sm">
          Credited {approved}h{claimed > approved ? ` of ${claimed}h claimed` : ""}
        </div>
      ) : null}
      {e.note ? <div className="mt-[2px] whitespace-pre-wrap text-[13px] text-dim">{e.note}</div> : null}
    </Item>
  );
}

export function Timeline({ data }: { data: TimelineData | null }) {
  if (!data) return <p className="text-sm text-faint">Couldn&apos;t load the timeline.</p>;
  const inPipeline = data.status === "second_review" || data.status === "fraud_review";
  return (
    <div className="flex flex-col gap-[10px] border-l-2 border-stroke pl-[14px]">
      {data.events.map((e, i) => (
        <Row key={`${e.kind}-${e.at}-${i}`} e={e} />
      ))}
      {data.status === "fraud_review" ? (
        <>
          <Item dot="" title="Waiting on fraud review" time="in progress" />
          <Item dot="" title="Second review" time="not started yet" />
        </>
      ) : inPipeline ? (
        <>
          {data.joeUsed && data.fraudReviewDoneAt ? (
            <Item dot="rev" title="Passed fraud review" time={timeAgo(data.fraudReviewDoneAt)} />
          ) : null}
          <Item dot="" title="Second review" time="in progress" />
        </>
      ) : null}
    </div>
  );
}
