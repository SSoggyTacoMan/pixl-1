import { createConcurrencyLimiter } from "./concurrency";
import { fetchUserSpans } from "./hackatime";
import type { RepoTreeFile } from "./commits";

// Time per file for a project's linked Hackatime projects, so a reviewer can see
// what the hours were spent on and what was spent outside the repo (terminal,
// AI tools, planning notes that are not committed). Hackatime's heartbeats carry
// the file ("entity") of every beat; the spans endpoint the rest of the
// dashboard uses does not.
//
// The attribution and path matching mirror ari-webhooks' filehours package: a
// gap is capped at two minutes, a session break's capped gap belongs to the beat
// that opens the next session, and each raw local path is matched to the
// repository's own path (full path, then longest suffix, then base name) before
// totals are merged. Unlike Ari we keep the raw seconds, so the per-file total
// still lines up with the hours the queue shows; AI-coded seconds are reported
// separately instead of being discounted.

const BASE = (process.env.HACKATIME_BASE ?? "https://hackatime.hackclub.com").replace(/\/$/, "");

// A heartbeat counts until the next one, but never for more than this: the same
// 2-minute idle rule Hackatime's own spans use.
export const IDLE_CAP_SECONDS = 120;
// On demand only. More than this would be a very long project; the most recent
// days win and the report says how many were left out.
const MAX_DAYS = 180;
const MAX_FILES = 2_500;
// Historical beats do not change, so a short process cache is enough to keep
// tab switches and repeat review opens from walking Hackatime again.
const CACHE_TTL_MS = 10 * 60 * 1000;

export interface Heartbeat {
  time: number;
  entity: string;
  project: string;
  /** Hackatime's entity type. Anything other than "file" is not a path, but
   * we still keep its seconds in the outside-the-repo bucket when it has a
   * label (for example "Terminal"). */
  kind?: string;
  /** WakaTime activity category, used only to report AI-coded seconds. */
  category?: string;
}

export type FileStatus = "head" | "history" | "none";

export interface FileRow {
  /** Repository path for head/history rows; the tail of a local path for
   * entities the repository cannot explain. */
  path: string;
  seconds: number;
  /** The portion of seconds whose opening heartbeat was "ai coding". */
  aiSeconds: number;
  /** File size on the default branch, when the host told us. */
  bytes: number | null;
  status: FileStatus;
}

export interface PersonFileSeconds {
  totalSeconds: number;
  aiSeconds: number;
  entitySeconds: Map<string, number>;
  aiEntitySeconds: Map<string, number>;
  missingDays: number;
  skippedDays: number;
}

export type PersonFileSecondsResult =
  | ({ ok: true } & PersonFileSeconds)
  | { ok: false; error: string };

export function isAiCoding(category: string | undefined): boolean {
  const c = String(category ?? "")
    .toLowerCase()
    .trim()
    .replace(/[_-]/g, " ");
  return c === "ai coding";
}

// "/Users/me/proj/src/a.ts" with project "proj" -> "src/a.ts". Anything not under
// a linked project's folder gets only its last three path parts, so a local user
// name or other folder names never reach the page. Used as the fallback when the
// repository tree cannot be read.
export function relativeEntity(entity: string, projects: readonly string[]): { path: string; inProject: boolean } {
  const e = String(entity ?? "").replace(/\\/g, "/");
  for (const name of projects) {
    const marker = `/${name}/`;
    const i = e.indexOf(marker);
    if (i >= 0) {
      const rest = e.slice(i + marker.length);
      if (rest) return { path: rest, inProject: true };
    }
  }
  const parts = e.split("/").filter(Boolean);
  return { path: parts.slice(-3).join("/") || "(unknown)", inProject: false };
}

export function isMarkdown(filePath: string): boolean {
  return /\.(md|mdx|markdown)$/i.test(filePath);
}

// Hackatime counts a beat for the gap until the next beat, capped at two
// minutes. A gap longer than the cap opens a new session and its capped credit
// follows the beat that opens it; the last beat of the window gets no trailing
// credit of its own. That is the same rule ari-webhooks' EntitySeconds uses, so
// file totals sum to the same number the maker sees logged.
export function fileSecondsFromHeartbeats(
  heartbeats: readonly Heartbeat[],
  projects: readonly string[],
): { entitySeconds: Map<string, number>; aiEntitySeconds: Map<string, number> } {
  const wanted = new Set(projects.map((project) => project.toLowerCase()));
  const beats = heartbeats
    .filter((h) => h.project && wanted.has(h.project.toLowerCase()) && Number.isFinite(Number(h.time)))
    .map((h) => ({ ...h, time: Number(h.time) }))
    .sort((a, b) => a.time - b.time);

  const entitySeconds = new Map<string, number>();
  const aiEntitySeconds = new Map<string, number>();
  const credit = (beat: Heartbeat, seconds: number) => {
    const entity = String(beat.entity ?? "").trim();
    if (!entity || seconds <= 0) return;
    entitySeconds.set(entity, (entitySeconds.get(entity) ?? 0) + seconds);
    if (isAiCoding(beat.category)) {
      aiEntitySeconds.set(entity, (aiEntitySeconds.get(entity) ?? 0) + seconds);
    }
  };

  for (let i = 0; i + 1 < beats.length; i++) {
    const gap = beats[i + 1]!.time - beats[i]!.time;
    if (gap <= 0) continue;
    if (gap > IDLE_CAP_SECONDS) credit(beats[i + 1]!, IDLE_CAP_SECONDS);
    else credit(beats[i]!, gap);
  }
  return { entitySeconds, aiEntitySeconds };
}

// ---- Resolving local entity paths to repository paths ----------------------

// Lowercase, forward slashes, no "." / ".." / duplicate segments. Absolute and
// relative paths both come out without a leading slash, so a repo-relative
// entity and an absolute editor path can be compared by suffix.
export function normalizePath(filePath: string): string {
  const raw = String(filePath ?? "").replace(/\\/g, "/");
  const parts: string[] = [];
  for (const segment of raw.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      parts.pop();
      continue;
    }
    parts.push(segment);
  }
  return parts.join("/").toLowerCase();
}

// The last three segments of a local path, so a maker's home directory never
// reaches an organizer's screen.
export function pathTail(entity: string): string {
  const parts = String(entity ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);
  return parts.slice(-3).join("/");
}

interface PathIndex {
  byPath: Map<string, string>;
  byBase: Map<string, string>;
}

function newPathIndex(originals: readonly string[]): PathIndex {
  const ordered = [...new Set(originals)].sort((a, b) => a.length - b.length || a.localeCompare(b));
  const idx: PathIndex = { byPath: new Map(), byBase: new Map() };
  for (const raw of ordered) {
    const normalized = normalizePath(raw);
    if (!normalized || normalized === ".") continue;
    if (!idx.byPath.has(normalized)) idx.byPath.set(normalized, raw);
    const base = normalized.slice(normalized.lastIndexOf("/") + 1);
    if (base && !idx.byBase.has(base)) idx.byBase.set(base, raw);
  }
  return idx;
}

function resolveAgainst(index: PathIndex, normalized: string): string | null {
  const exact = index.byPath.get(normalized);
  if (exact) return exact;

  // A repository path that is a tail of the entity: the maker's own directories
  // sit above the repo root, so prefer the longest (most specific) agreement.
  let bestKey = "";
  let bestOriginal = "";
  for (const [repoPath, original] of index.byPath) {
    if (!normalized.endsWith(`/${repoPath}`)) continue;
    if (repoPath.length > bestKey.length || (repoPath.length === bestKey.length && repoPath < bestKey)) {
      bestKey = repoPath;
      bestOriginal = original;
    }
  }
  if (bestKey) return bestOriginal;

  const base = normalized.slice(normalized.lastIndexOf("/") + 1);
  return (base && index.byBase.get(base)) || null;
}

function statusRank(status: FileStatus): number {
  if (status === "head") return 2;
  if (status === "history") return 1;
  return 0;
}

// Maps per-file coding time onto the repository, one row per resolved path plus
// a zero-second row for every default-branch file no time resolved to, so the
// browser shows the whole repository rather than only where the time went.
// `historyPaths` is every path the captured commits touched; rows there stay
// visible when the file is no longer on the default branch. Entities the
// repository cannot explain keep only their tail and are marked "none".
export function resolveFileHours(
  entitySeconds: ReadonlyMap<string, number>,
  headFiles: readonly RepoTreeFile[],
  historyPaths: readonly string[] = [],
  aiEntitySeconds: ReadonlyMap<string, number> = new Map(),
): FileRow[] {
  const headBytes = new Map<string, number | null>();
  for (const file of headFiles) headBytes.set(file.path, file.bytes);
  const head = newPathIndex([...headBytes.keys()]);
  const history = newPathIndex(historyPaths);

  const merged = new Map<string, FileRow>();
  for (const [entity, seconds] of entitySeconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) continue;
    const normalized = normalizePath(entity);
    if (!normalized) continue;
    const aiSeconds = Math.max(0, Number(aiEntitySeconds.get(entity)) || 0);

    let row: FileRow = { path: pathTail(entity), seconds, aiSeconds, bytes: null, status: "none" };
    const headPath = resolveAgainst(head, normalized);
    if (headPath) {
      row = { path: headPath, seconds, aiSeconds, bytes: headBytes.get(headPath) ?? null, status: "head" };
    } else {
      const historyPath = resolveAgainst(history, normalized);
      if (historyPath) row = { path: historyPath, seconds, aiSeconds, bytes: null, status: "history" };
    }

    const existing = merged.get(row.path);
    if (!existing) {
      merged.set(row.path, row);
      continue;
    }
    existing.seconds += row.seconds;
    existing.aiSeconds += row.aiSeconds;
    if (statusRank(row.status) > statusRank(existing.status)) {
      existing.status = row.status;
      existing.bytes = row.bytes;
    }
  }

  for (const [headPath, bytes] of headBytes) {
    if (merged.has(headPath)) continue;
    merged.set(headPath, { path: headPath, seconds: 0, aiSeconds: 0, bytes, status: "head" });
  }

  return [...merged.values()].sort((a, b) => b.seconds - a.seconds || a.path.localeCompare(b.path));
}

// Non-repository entities when the repo tree is unavailable: use the linked
// project folder to decide whether a file is in the project, and mark those
// rows "history" only so the caller's in-project math still works. The UI hides
// the status when there is no tree.
export function fallbackFileRows(
  entitySeconds: ReadonlyMap<string, number>,
  aiEntitySeconds: ReadonlyMap<string, number>,
  projects: readonly string[],
): FileRow[] {
  const merged = new Map<string, FileRow>();
  for (const [entity, seconds] of entitySeconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) continue;
    const { path, inProject } = relativeEntity(entity, projects);
    const status: FileStatus = inProject ? "history" : "none";
    const key = `${status}:${path}`;
    const aiSeconds = Math.max(0, Number(aiEntitySeconds.get(entity)) || 0);
    const existing = merged.get(key);
    if (existing) {
      existing.seconds += seconds;
      existing.aiSeconds += aiSeconds;
    } else {
      merged.set(key, { path, seconds, aiSeconds, bytes: null, status });
    }
  }
  return [...merged.values()].sort((a, b) => b.seconds - a.seconds || a.path.localeCompare(b.path));
}

export function mergeFileRows(groups: readonly (readonly FileRow[])[]): FileRow[] {
  const merged = new Map<string, FileRow>();
  for (const group of groups) {
    for (const row of group) {
      const key = `${row.status}:${row.path}`;
      const existing = merged.get(key);
      if (existing) {
        existing.seconds += row.seconds;
        existing.aiSeconds += row.aiSeconds;
      } else {
        merged.set(key, { ...row });
      }
    }
  }
  return [...merged.values()].sort((a, b) => b.seconds - a.seconds || a.path.localeCompare(b.path));
}

// Keep payloads bounded. Tracked files are the point of the view, so they win
// over untouched repository files; the caller reports how many were dropped.
export function capFileRows(rows: readonly FileRow[], max = MAX_FILES): FileRow[] {
  if (rows.length <= max) return [...rows];
  return rows.slice(0, max);
}

function utcDays(spans: { start: number; end: number }[]): string[] {
  const days = new Set<string>();
  for (const s of spans) {
    for (let t = Math.floor(s.start / 86400) * 86400; t <= s.end; t += 86400) {
      days.add(new Date(t * 1000).toISOString().slice(0, 10));
    }
  }
  return [...days].sort();
}

const secondsCache = new Map<string, { result: PersonFileSecondsResult & { ok: true }; at: number }>();

// Needs the maker's own Hackatime token: /my/heartbeats returns the token
// owner's data. Only the days that have spans for the linked projects are
// requested, and only the linked projects' heartbeats are kept - the endpoint
// returns every project of that day, and the rest is never read further.
export async function fetchPersonFileSeconds(
  slackId: string | null | undefined,
  token: string | null,
  projects: string[],
): Promise<PersonFileSecondsResult> {
  if (projects.length === 0) return { ok: false, error: "No Hackatime project is linked." };
  if (!token) return { ok: false, error: "This player has no Hackatime token stored." };
  const cacheKey = `${String(slackId ?? "").trim()}|${[...projects].sort().join(",")}`;
  const hit = secondsCache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return {
      ...hit.result,
      entitySeconds: new Map(hit.result.entitySeconds),
      aiEntitySeconds: new Map(hit.result.aiEntitySeconds),
    };
  }

  const spans = await fetchUserSpans(slackId, token, projects);
  if (spans === null) return { ok: false, error: "Hackatime could not be reached." };
  const allDays = utcDays(spans);
  if (allDays.length === 0) return { ok: false, error: "No coding time found for the linked projects." };
  const skippedDays = Math.max(0, allDays.length - MAX_DAYS);
  const days = allDays.slice(-MAX_DAYS);

  const limit = createConcurrencyLimiter(6);
  const wanted = new Set(projects.map((project) => project.toLowerCase()));
  let missingDays = 0;
  const beats: Heartbeat[] = [];
  await Promise.all(
    days.map((d) =>
      limit(async () => {
        try {
          const r = await fetch(
            `${BASE}/api/v1/my/heartbeats?start_time=${d}T00:00:00Z&end_time=${d}T23:59:59Z`,
            {
              headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
              signal: AbortSignal.timeout(20000),
            },
          );
          if (!r.ok) {
            missingDays++;
            return;
          }
          const j = (await r.json()) as {
            heartbeats?: {
              time?: number;
              entity?: string;
              project?: string;
              type?: string;
              entity_type?: string;
              category?: string;
            }[];
          };
          for (const h of j.heartbeats ?? []) {
            if (h.project && wanted.has(h.project.toLowerCase())) {
              beats.push({
                time: Number(h.time),
                entity: String(h.entity ?? ""),
                project: h.project,
                kind: h.type ?? h.entity_type,
                category: h.category,
              });
            }
          }
        } catch {
          missingDays++;
        }
      }),
    ),
  );
  if (missingDays === days.length) return { ok: false, error: "Hackatime did not return any heartbeats." };

  const { entitySeconds, aiEntitySeconds } = fileSecondsFromHeartbeats(beats, projects);
  const totalSeconds = [...entitySeconds.values()].reduce((sum, seconds) => sum + seconds, 0);
  const aiSeconds = [...aiEntitySeconds.values()].reduce((sum, seconds) => sum + seconds, 0);
  const result = { ok: true as const, totalSeconds, aiSeconds, entitySeconds, aiEntitySeconds, missingDays, skippedDays };
  secondsCache.set(cacheKey, { result, at: Date.now() });
  return {
    ...result,
    entitySeconds: new Map(entitySeconds),
    aiEntitySeconds: new Map(aiEntitySeconds),
  };
}
