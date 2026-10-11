// Pure helpers for the public shared-journal page.

export interface PublicJournal {
  id?: number | string;
  title?: string | null;
  content?: string | null;
  hours?: number | string | null;
  approvedHours?: number | string | null;
  createdAt?: string;
  contributor?: string | null;
}

export interface PublicJournalsResponse {
  ok: boolean;
  project?: { name?: string | null };
  multiContributor?: boolean;
  journals?: PublicJournal[];
}

/** The URL path segments, checked before anything goes to the server. */
export function parseShareParams(projectId: string, token: string): { projectId: number; token: string } | null {
  if (!/^\d{1,12}$/.test(projectId)) return null;
  const id = Number(projectId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(token)) return null;
  return { projectId: id, token };
}

export function journalsPath(projectId: number, token: string): string {
  return `/api/journals/public/${projectId}/${encodeURIComponent(token)}`;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Claimed hours, and credited hours only when a reviewer changed them. */
export function hoursLine(j: PublicJournal): { claimed: number; credited: number | null } {
  const claimed = round1(Number(j.hours) || 0);
  if (j.approvedHours == null || j.approvedHours === "") return { claimed, credited: null };
  const credited = round1(Number(j.approvedHours) || 0);
  return { claimed, credited: credited !== claimed ? credited : null };
}

export function fmtDate(iso: unknown): string {
  if (typeof iso !== "string") return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}
