"use client";

import { useEffect, useRef, useState } from "react";
import type { Commit, CommitDiff, CommitResult } from "@/lib/commits";
import { Badge, Button, Callout, EmptyState, formatDate, Icon, Mono, Muted } from "@/app/_ui/ui";

const PER_PAGE = 8;

// The commit list isn't GitHub-only, so error copy names whichever host
// actually answered instead of blaming GitHub for a Codeberg timeout.
function hostLabel(result: CommitResult): string {
  return result.host ?? "The git host";
}

function tokenEnv(result: CommitResult): string {
  if (result.provider === "gitlab") return "GITLAB_TOKEN";
  if (result.provider === "forgejo") return "FORGEJO_TOKEN";
  return "GITHUB_TOKEN";
}

function fmtGap(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

function TrackedBadge({ secs }: { secs?: number }) {
  if (secs === undefined) return null;
  if (secs < 120)
    return (
      <span title="Almost no tracked coding time between this commit and the previous one: code appeared without coding.">
        <Badge tone="danger">~0m coded</Badge>
      </span>
    );
  const h = secs / 3600;
  return (
    <span title="Hackatime coding time between this commit and the previous one">
      <Badge>{h >= 1 ? `${h.toFixed(1)}h` : `${Math.round(secs / 60)}m`} coded</Badge>
    </span>
  );
}

function Notice({ tone, children }: { tone: "danger" | "warning" | "neutral"; children: React.ReactNode }) {
  return (
    <div className="p-4">
      <Callout tone={tone} icon="important">
        {children}
      </Callout>
    </div>
  );
}

// One fetch per commit per page view, shared by the hover preview and the
// inline view. A commit never changes, so there is nothing to invalidate.
const diffRequests = new Map<string, Promise<CommitDiff>>();

function loadDiff(projectId: number, sha: string): Promise<CommitDiff> {
  const key = `${projectId}:${sha}`;
  let request = diffRequests.get(key);
  if (!request) {
    request = fetch(`/api/projects/${projectId}/commits/${sha}`)
      .then(async (res) => (res.ok ? ((await res.json()) as CommitDiff) : { files: [], moreFiles: 0, error: `http_${res.status}` }))
      .catch(() => ({ files: [], moreFiles: 0, error: "fetch_failed" }));
    diffRequests.set(key, request);
    // Let a failed load be retried on the next open.
    void request.then((d) => {
      if (d.error) diffRequests.delete(key);
    });
  }
  return request;
}

const DIFF_ERRORS: Record<string, string> = {
  unsupported: "This git host doesn't expose commit diffs. Open the commit to read it there.",
  rate_limited: "The git host's rate limit was hit. Try again in a bit.",
  not_found: "That commit couldn't be found on the host.",
};

function lineKind(line: string): string | undefined {
  if (line.startsWith("@@")) return "hunk";
  if (line.startsWith("+")) return "add";
  if (line.startsWith("-")) return "del";
  return undefined;
}

function DiffView({ projectId, sha }: { projectId: number; sha: string }) {
  const [diff, setDiff] = useState<CommitDiff | null>(null);

  useEffect(() => {
    let live = true;
    void loadDiff(projectId, sha).then((d) => {
      if (live) setDiff(d);
    });
    return () => {
      live = false;
    };
  }, [projectId, sha]);

  if (!diff) return <p className="hc-caption p-4 text-sm">Loading diff...</p>;
  if (diff.error) return <p className="hc-caption p-4 text-sm">{DIFF_ERRORS[diff.error] ?? "Couldn't load this diff right now."}</p>;
  if (diff.files.length === 0) return <p className="hc-caption p-4 text-sm">This commit changed no files.</p>;

  return (
    <div className="hc-diff">
      {diff.files.map((file) => (
        <section key={file.path} className="hc-diff-file">
          <header>
            <Mono>{file.path}</Mono>
            {file.status !== "modified" && <Badge>{file.status}</Badge>}
            <span className="hc-mono ml-auto shrink-0 text-xs tabular-nums">
              <span className="text-[var(--hc-green)]">+{file.additions}</span>{" "}
              <span className="text-[var(--hc-red)]">-{file.deletions}</span>
            </span>
          </header>
          {file.patch ? (
            <pre>
              {file.patch.split("\n").map((line, i) => (
                <span key={i} data-kind={lineKind(line)}>
                  {line || " "}
                  {"\n"}
                </span>
              ))}
            </pre>
          ) : (
            <p className="hc-caption px-3 py-2 text-xs">Binary file, or too large for the host to show inline.</p>
          )}
          {file.truncated && <p className="hc-caption px-3 py-2 text-xs">Diff cut off here. Open the commit for the rest.</p>}
        </section>
      ))}
      {diff.moreFiles > 0 && (
        <p className="hc-caption p-3 text-xs">And {diff.moreFiles} more files. Open the commit to see them all.</p>
      )}
    </div>
  );
}

// A commit row. Hovering the hash previews the diff in a popover; clicking the
// message opens it inline, where it stays until closed.
function CommitRow({
  commit: c,
  dump,
  gap,
  projectId,
}: {
  commit: Commit;
  dump: boolean;
  gap?: number;
  projectId?: number;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const timer = useRef<number | null>(null);
  const canDiff = projectId !== undefined;

  function schedule(show: boolean, delay: number) {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPreview(show), delay);
  }

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  return (
    <li className="relative border-b border-[var(--border)] text-sm last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
        <a
          href={c.url}
          target="_blank"
          rel="noreferrer"
          className="hc-link shrink-0"
          onMouseEnter={canDiff && !open ? () => schedule(true, 350) : undefined}
          onMouseLeave={canDiff ? () => schedule(false, 200) : undefined}
        >
          <Mono>{c.sha}</Mono>
        </a>
        {canDiff ? (
          <button
            type="button"
            className="hc-commit-toggle min-w-0 flex-1"
            aria-expanded={open}
            title={open ? "Hide the diff" : "Show the diff"}
            onClick={() => {
              setPreview(false);
              setOpen((o) => !o);
            }}
          >
            <Icon glyph={open ? "down-caret" : "right-caret"} size={16} className="hc-muted shrink-0" />
            <span className="min-w-0 break-words">{c.message}</span>
          </button>
        ) : (
          <span className="min-w-0 flex-1 break-words">{c.message}</span>
        )}
        {c.ai && (
          <span title="Signed by an AI tool (co-author trailer, bot author or generated-with footer). Check the AI-used disclosure.">
            <Badge tone="purple">AI commit</Badge>
          </span>
        )}
        {c.additions !== undefined && (
          <span
            className={`hc-mono shrink-0 text-xs tabular-nums ${dump ? "font-bold" : ""}`}
            title={dump ? "Huge amount of code vs almost no tracked coding time: possible paste or AI dump." : "Lines added / removed"}
          >
            <span className="text-[var(--hc-green)]">+{c.additions}</span>{" "}
            <span className="text-[var(--hc-red)]">-{c.deletions ?? 0}</span>
          </span>
        )}
        {gap !== undefined && (
          <span className="shrink-0 text-xs tabular-nums" title="Wall-clock time since the previous commit">
            <Muted>+{fmtGap(gap)}</Muted>
          </span>
        )}
        <TrackedBadge secs={c.tracked} />
        <Muted className="hidden shrink-0 text-xs sm:inline">{c.author}</Muted>
        <Muted className="shrink-0 text-xs">{c.date ? formatDate(c.date) : ""}</Muted>
      </div>

      {canDiff && open && (
        <div className="border-t border-[var(--border)]">
          <DiffView projectId={projectId} sha={c.sha} />
        </div>
      )}
      {canDiff && preview && !open && (
        <div
          className="hc-diff-popover"
          onMouseEnter={() => schedule(true, 0)}
          onMouseLeave={() => schedule(false, 200)}
        >
          <DiffView projectId={projectId} sha={c.sha} />
        </div>
      )}
    </li>
  );
}

// Pass projectId to let reviewers read each commit's diff in place.
export function CommitList({ result, projectId }: { result: CommitResult; projectId?: number }) {
  const [page, setPage] = useState(0);

  // Not a repo url, or a host that answers neither the Forgejo (Gitea/Codeberg)
  // nor the GitLab API. The ship can still be valid; we just can't list commits.
  if (result.error === "unsupported_host" || result.error === "not_github")
    return (
      <EmptyState title="No commit API for this host" icon="github">
        {result.host ? `${result.host} isn't supported. ` : ""}Open the repo link to review it by hand.
      </EmptyState>
    );
  if (result.error === "not_found")
    return (
      <Notice tone="danger">
        <Mono>{result.repo}</Mono>: repo not found or private (404){result.host ? ` on ${result.host}` : ""}.
      </Notice>
    );
  if (result.error === "rate_limited")
    return (
      <Notice tone="warning">
        {hostLabel(result)} API rate limit hit. This is not &ldquo;no commits&rdquo;, the list just couldn&apos;t be
        fetched right now. Wait a bit and reload, or ask an owner to set {tokenEnv(result)} on the dashboard to raise
        the limit.
      </Notice>
    );
  if (result.error === "forbidden")
    return (
      <Notice tone="warning">
        {hostLabel(result)} refused this request. Not a rate limit, and not &ldquo;no commits&rdquo;.
        {result.detail && <span className="hc-caption mt-1 block text-sm">{result.detail}</span>}
      </Notice>
    );
  if (result.error)
    return (
      <EmptyState title="Couldn't load commits" icon="github">
        {result.error}
      </EmptyState>
    );
  if (result.commits.length === 0) return <EmptyState title="No commits" icon="github" />;

  const total = result.commits.length;
  const pages = Math.ceil(total / PER_PAGE);
  const start = page * PER_PAGE;
  const shown = result.commits.slice(start, start + PER_PAGE);
  const hasTracking = result.commits.some((c) => c.tracked !== undefined);

  // Wall-clock gap to the previous commit, in date order.
  const gaps = new Map<string, number>();
  const asc = result.commits.filter((c) => c.date).sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < asc.length; i++) {
    const s = (new Date(asc[i].date).getTime() - new Date(asc[i - 1].date).getTime()) / 1000;
    if (Number.isFinite(s) && s >= 0) gaps.set(asc[i].sha, s);
  }

  return (
    <div>
      {hasTracking && (
        <p className="hc-caption border-b border-[var(--border)] px-4 py-3 text-sm">
          &ldquo;coded&rdquo; = Hackatime time between commits. <Badge tone="danger">~0m coded</Badge> means code
          landed with no tracked coding behind it, so check for pasted or AI-dumped work.
        </p>
      )}
      <ul>
        {shown.map((c) => {
          const dump =
            c.tracked !== undefined &&
            c.additions !== undefined &&
            c.additions >= 200 &&
            c.additions / (Math.max(c.tracked, 60) / 3600) > 1500;
          return (
            <CommitRow key={c.sha} commit={c} dump={dump} gap={gaps.get(c.sha)} projectId={projectId} />
          );
        })}
      </ul>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-4 border-t border-[var(--border)] px-4 py-3">
          <span className="hc-caption text-sm tabular-nums">
            {start + 1}-{Math.min(start + PER_PAGE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= pages - 1}
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            >
              Next
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
