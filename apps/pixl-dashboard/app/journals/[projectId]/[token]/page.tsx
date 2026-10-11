// Public, no-login, read-only view of one project's journal entries, keyed by
// the project's share token (the link reviewers put in Airtable as evidence
// of hours). Lives outside the (shell) gate on purpose, like /docs and /form.
import type { Metadata } from "next";
import { Markdown } from "@/components/markdown";
import { publicGet } from "@/lib/server-api";
import { fmtDate, hoursLine, journalsPath, parseShareParams, type PublicJournalsResponse } from "./lib";
import "./journals.css";

export const metadata: Metadata = {
  title: "Project journals",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function NotFound({ message }: { message: string }) {
  return (
    <main className="jp-wrap">
      <div className="jp-head">
        <h1>Not found</h1>
      </div>
      <div className="jp-error">{message}</div>
    </main>
  );
}

export default async function SharedJournalsPage({ params }: { params: Promise<{ projectId: string; token: string }> }) {
  const raw = await params;
  const parsed = parseShareParams(raw.projectId, raw.token);
  if (!parsed) return <NotFound message="That link isn't valid." />;

  // GET /api/journals/public/:projectId/:token (public, rate limited server side)
  const data = await publicGet<PublicJournalsResponse>(journalsPath(parsed.projectId, parsed.token));
  if (!data?.ok) return <NotFound message="That link isn't valid, or these journals aren't shared." />;

  const journals = data.journals ?? [];
  return (
    <main className="jp-wrap">
      <div className="jp-head">
        <h1>{data.project?.name || "Project journals"}</h1>
        <p>Journal entries only, read-only, shared as evidence of hours worked.</p>
      </div>
      {journals.length === 0 ? (
        <div className="jp-empty">No journal entries yet.</div>
      ) : (
        journals.map((j, i) => {
          const h = hoursLine(j);
          return (
            <article className="jp-entry" key={String(j.id ?? i)}>
              <div className="jp-meta">
                {data.multiContributor && j.contributor ? <span>{j.contributor}</span> : null}
                {h.credited != null ? (
                  <>
                    <span className="jp-hours deflated">{h.claimed}h claimed</span>
                    <span className="jp-hours">{h.credited}h credited</span>
                  </>
                ) : (
                  <span className="jp-hours">{h.claimed}h</span>
                )}
                <span>{fmtDate(j.createdAt)}</span>
              </div>
              {j.title ? <div className="jp-title">{j.title}</div> : null}
              <Markdown source={j.content ?? ""} className="jp-body" />
            </article>
          );
        })
      )}
    </main>
  );
}
