"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { loadProjectFileTime, type ProjectFileTime, type ProjectFileTimePerson } from "@/app/actions";
import { actionErrorMessage } from "@/app/_ui/actionError";
import { Button, Card, CardHeader, Icon, Muted } from "@/app/_ui/ui";
import type { FileRow } from "@/lib/hackatimeFiles";
import { buildFileTree, formatBytes, type FileTreeDirectory } from "@/lib/fileTree";

// "Time by file" for the review page: where the Hackatime hours went, file by
// file, resolved against the repository's own tree. Loaded on demand because it
// costs one Hackatime request per coding day plus one repository tree read.

function fmt(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

function Wrap({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  return embedded ? (
    <div className="p-4">
      <p className="hc-eyebrow mb-3">Time by file</p>
      {children}
    </div>
  ) : (
    <Card>
      <CardHeader title="Time by file" icon="code" />
      {children}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="hc-caption text-xs">{label}</p>
      <p className="hc-mono font-bold">{value}</p>
    </div>
  );
}

function EmptyTree({ children }: { children: ReactNode }) {
  return <p className="hc-caption text-sm">{children}</p>;
}

function AiChip({ row }: { row: FileRow }) {
  if (row.aiSeconds <= 0) return null;
  return (
    <span
      className="shrink-0 rounded bg-[var(--sunken)] px-1 text-[10px] font-bold uppercase tracking-wide text-[var(--hc-orange)]"
      title={`${fmt(row.aiSeconds)} of this file was AI-coded`}
    >
      AI
    </span>
  );
}

function TimeBar({ seconds, max }: { seconds: number; max: number }) {
  return (
    <span className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-[var(--sunken)]" aria-hidden>
      <span
        className="block h-full rounded-full bg-[var(--hc-blue)]"
        style={{ width: `${Math.min(100, Math.round((seconds / Math.max(1, max)) * 100))}%` }}
      />
    </span>
  );
}

function FileRowView({ row, depth, max }: { row: FileRow; depth: number; max: number }) {
  return (
    <div
      className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-[var(--surface-hover)]"
      style={{ paddingLeft: `${4 + depth * 14 + 20}px` }}
    >
      <span className="min-w-0 flex-1 truncate text-sm" title={row.path}>
        {row.path.slice(row.path.lastIndexOf("/") + 1)}
      </span>
      <AiChip row={row} />
      {row.bytes !== null && <span className="hc-caption shrink-0 text-xs">{formatBytes(row.bytes)}</span>}
      <TimeBar seconds={row.seconds} max={max} />
      <span className="hc-mono w-14 shrink-0 text-right text-xs tabular-nums">{fmt(row.seconds)}</span>
    </div>
  );
}

function DirectoryView({
  node,
  depth,
  max,
  collapsed,
  toggle,
}: {
  node: FileTreeDirectory;
  depth: number;
  max: number;
  collapsed: ReadonlySet<string>;
  toggle: (path: string) => void;
}) {
  const open = !collapsed.has(node.path);
  return (
    <>
      {node.path && (
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-[var(--surface-hover)]"
          style={{ paddingLeft: `${4 + depth * 14}px` }}
          aria-expanded={open}
          onClick={() => toggle(node.path)}
        >
          <Icon glyph={open ? "down-caret" : "right-caret"} size={12} className="hc-muted shrink-0" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{node.name}</span>
          <span className="hc-mono w-14 shrink-0 text-right text-xs tabular-nums">{fmt(node.seconds)}</span>
        </button>
      )}
      {open && (
        <>
          {node.directories.map((child) => (
            <DirectoryView
              key={child.path}
              node={child}
              depth={node.path ? depth + 1 : 0}
              max={max}
              collapsed={collapsed}
              toggle={toggle}
            />
          ))}
          {node.files.map((file) => (
            <FileRowView
              key={file.row.path}
              row={file.row}
              depth={node.path ? depth + 1 : 0}
              max={max}
            />
          ))}
        </>
      )}
    </>
  );
}

function FlatFiles({ rows, max = 25 }: { rows: FileRow[]; max?: number }) {
  if (rows.length === 0) return null;
  const shown = rows.slice(0, max);
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {shown.map((row) => (
        <li key={`${row.status}:${row.path}`} className="flex items-center gap-2">
          <span className="hc-mono w-14 shrink-0 text-right text-xs tabular-nums">{fmt(row.seconds)}</span>
          <TimeBar seconds={row.seconds} max={Math.max(1, ...rows.map((r) => r.seconds))} />
          <span className="min-w-0 flex-1 truncate" title={row.path}>
            {row.path}
          </span>
          <AiChip row={row} />
        </li>
      ))}
      {rows.length > max && <li className="hc-caption text-xs">+ {rows.length - max} more not shown</li>}
    </ul>
  );
}

function PeopleSummary({ people, treeOk }: { people: ProjectFileTimePerson[]; treeOk: boolean }) {
  if (people.length < 2) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
      {people.map((person, index) => (
        <span key={`${person.name}:${index}`} className="hc-caption text-xs">
          <span className="font-bold text-[var(--text)]">{person.name}</span> {fmt(person.totalSeconds)} tracked ·{" "}
          {fmt(person.repoSeconds)} {treeOk ? "in repo" : "in project"}
        </span>
      ))}
    </div>
  );
}

function Report({ data }: { data: Extract<ProjectFileTime, { ok: true }> }) {
  const report = data.report;
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (path: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const tree = useMemo(
    () => (report.treeOk ? buildFileTree(report.files.filter((file) => file.status === "head")) : null),
    [report],
  );
  const maxSeconds = useMemo(() => Math.max(1, ...report.files.map((file) => file.seconds)), [report.files]);
  const history = report.files.filter((file) => file.status === "history");
  const outside = report.files.filter((file) => file.status === "none");

  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Stat label="Total" value={fmt(report.totalSeconds)} />
        <Stat label={report.treeOk ? "In the repo" : "In the project"} value={fmt(report.repoSeconds)} />
        <Stat label={report.treeOk ? "Outside the repo" : "Outside the project"} value={fmt(report.outsideSeconds)} />
        <Stat label="Markdown files" value={fmt(report.markdownSeconds)} />
      </div>
      <PeopleSummary people={report.people} treeOk={report.treeOk} />
      {report.skippedPeople.map((person, index) => (
        <p key={`${person.name}:${index}`} className="hc-caption mb-2 text-xs">
          No per-file data for {person.name}: {person.reason}
        </p>
      ))}
      <p className="hc-caption mb-3 text-xs">
        {report.repoFileCount > 0
          ? `${report.repoFileCount.toLocaleString()} file${report.repoFileCount === 1 ? "" : "s"} on the default branch`
          : "No repository file list available"}
        {report.totalSeconds > 0 && report.aiSeconds > 0
          ? ` · ${fmt(report.aiSeconds)} AI-coded, counted in full`
          : ""}
      </p>
      {report.missingDays > 0 && (
        <p className="hc-caption mb-2 text-xs">
          {report.missingDays} day{report.missingDays === 1 ? "" : "s"} could not be loaded, so the totals may be short.
        </p>
      )}
      {report.skippedDays > 0 && (
        <p className="hc-caption mb-2 text-xs">
          {report.skippedDays} earlier coding day{report.skippedDays === 1 ? "" : "s"} were not loaded (kept the most
          recent).
        </p>
      )}
      {report.treeTruncated && (
        <p className="hc-caption mb-2 text-xs">
          The repository file list was cut short, so some files may be missing.
        </p>
      )}
      {report.hiddenFiles > 0 && (
        <p className="hc-caption mb-2 text-xs">
          {report.hiddenFiles.toLocaleString()} smaller or untouched file{report.hiddenFiles === 1 ? "" : "s"} are not
          shown.
        </p>
      )}

      {tree && tree.files.length + tree.directories.length > 0 ? (
        <div className="mb-4">
          <DirectoryView node={tree} depth={0} max={maxSeconds} collapsed={collapsed} toggle={toggle} />
        </div>
      ) : !report.treeOk ? (
        <EmptyTree>The repository file list could not be read; these paths come from the heartbeats.</EmptyTree>
      ) : (
        <EmptyTree>The capture did not record which files the time went to.</EmptyTree>
      )}

      {history.length > 0 && (
        <div className="mb-3">
          <p className="hc-eyebrow mb-1">
            {report.treeOk ? "No longer on the default branch" : "Project files"}
          </p>
          <FlatFiles rows={history} />
        </div>
      )}
      {outside.length > 0 && (
        <div>
          <p className="hc-eyebrow mb-1">
            {report.treeOk ? "Outside the repository" : "Outside the project"}
          </p>
          <p className="hc-caption mb-1 text-xs">Terminal, AI tools, notes and other paths not matched to the repo.</p>
          <FlatFiles rows={outside} />
        </div>
      )}
    </>
  );
}

export function FileTimeCard({
  projectId,
  hasHackatime,
  embedded = false,
}: {
  projectId: number;
  hasHackatime: boolean;
  /** Inside the Hackatime tab: plain padded block instead of its own card. */
  embedded?: boolean;
}) {
  const [pending, start] = useTransition();
  const [data, setData] = useState<ProjectFileTime | null>(null);
  const [error, setError] = useState("");

  // A different ship reuses this component; nothing loaded for the last one
  // may stay on screen while the reviewer moves through the queue.
  useEffect(() => {
    setData(null);
    setError("");
  }, [projectId]);

  const load = () => {
    setError("");
    start(async () => {
      try {
        setData(await loadProjectFileTime(projectId));
      } catch (e) {
        setError(actionErrorMessage(e, "load the time by file"));
      }
    });
  };

  return (
    <Wrap embedded={embedded}>
      {!hasHackatime ? (
        <Muted className="text-sm">No Hackatime project is linked.</Muted>
      ) : (
        <>
          {!data && (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" size="sm" onClick={load} disabled={pending}>
                {pending ? "Loading..." : "Load time by file"}
              </Button>
              <Muted className="text-xs">
                Reads heartbeats from Hackatime and the repo file list, can take a few seconds.
              </Muted>
            </div>
          )}
          {error && <p className="mt-2 text-sm text-[var(--hc-red)]">{error}</p>}
          {data && !data.ok && <p className="text-sm text-[var(--hc-red)]">{data.error}</p>}
          {data?.ok && <Report data={data} />}
        </>
      )}
    </Wrap>
  );
}
