// Public, no-login, read-only view of one project's journal entries, keyed by
// the project's share token (the link reviewers put in Airtable as evidence
// of hours). Lives outside the (shell) gate on purpose, like /docs and /form.
import type { Metadata } from "next";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/cn";
import { publicGet } from "@/lib/server-api";
import { fmtDate, hoursLine, journalsPath, parseShareParams, type PublicJournalsResponse } from "./lib";

const pageWrap = "mx-auto max-w-[720px] px-[16px] pt-[32px] pb-[64px]";
const pageHead = "mb-[24px]";
const pageHeading = "mb-[6px] font-pixel text-[20px] text-gold";
const centerNote = "py-[24px] text-center text-[14px] text-dim";
const hours = "font-semibold text-teal";

export const metadata: Metadata = {
  title: "Project journals",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function NotFound({ message }: { message: string }) {
  return (
    <main className={pageWrap}>
      <div className={pageHead}>
        <h1 className={pageHeading}>Not found</h1>
      </div>
      <div className={centerNote}>{message}</div>
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
    <main className={pageWrap}>
      <div className={pageHead}>
        <h1 className={pageHeading}>{data.project?.name || "Project journals"}</h1>
        <p className="text-[13px] text-dim">Journal entries only, read-only, shared as evidence of hours worked.</p>
      </div>
      {journals.length === 0 ? (
        <div className={centerNote}>No journal entries yet.</div>
      ) : (
        journals.map((j, i) => {
          const h = hoursLine(j);
          return (
            <article className="mb-[14px] border-2 border-stroke bg-panel p-[16px]" key={String(j.id ?? i)}>
              <div className="mb-[8px] flex flex-wrap items-center gap-[8px] text-[12px] text-dim">
                {data.multiContributor && j.contributor ? <span>{j.contributor}</span> : null}
                {h.credited != null ? (
                  <>
                    <span className={cn(hours, "mr-[4px] line-through opacity-60")}>{h.claimed}h claimed</span>
                    <span className={hours}>{h.credited}h credited</span>
                  </>
                ) : (
                  <span className={hours}>{h.claimed}h</span>
                )}
                <span>{fmtDate(j.createdAt)}</span>
              </div>
              {j.title ? <div className="mb-[6px] font-bold">{j.title}</div> : null}
              <Markdown
                source={j.content ?? ""}
                className="text-[14px] leading-[1.55] text-ink [overflow-wrap:anywhere]"
              />
            </article>
          );
        })
      )}
    </main>
  );
}
