// Review timeline, rendered on the server from GET /api/projects/:id/timeline.
import type { TimelineData, TimelineEvent } from "../data";
import { timeAgo } from "../format";

const VERDICTS: Record<string, [string, string]> = {
  approved: ["ok", "Approved"],
  first_pass_approved: ["rev", "Passed first review"],
  needs_changes: ["warn", "Sent back for changes"],
  rejected: ["bad", "Rejected"],
};

function Item({ dot, title, time, children }: { dot: string; title: string; time: string; children?: React.ReactNode }) {
  return (
    <div className="tl-item">
      <span className={`tl-dot ${dot}`} />
      <div className="tl-head">
        <span>{title}</span>
        <span className="tl-time">{time}</span>
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
      {e.note ? <div className="tl-note">{e.note}</div> : null}
    </Item>
  );
}

export function Timeline({ data }: { data: TimelineData | null }) {
  if (!data) return <p className="faint text-sm">Couldn&apos;t load the timeline.</p>;
  const inPipeline = data.status === "second_review" || data.status === "fraud_review";
  return (
    <div className="tl-list">
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
