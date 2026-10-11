// Server-side reads for the projects pages. Every call goes through
// lib/server-api.ts (Bearer token from the session cookie).
import "server-only";
import { serverApi } from "@/lib/server-api";
import { BLACKOUT_SLUG, normalizeProject, type BlackoutEntry, type BlackoutState, type HtStats, type JournalEntry, type Project, type Trial } from "./types";

export async function loadProjects(): Promise<Project[]> {
  const d = await serverApi<{ projects?: Record<string, unknown>[] }>("/api/projects");
  return (d?.projects ?? []).map(normalizeProject);
}

export async function loadStats(path = "/api/hackatime/stats"): Promise<HtStats | null> {
  const d = await serverApi<{ stats?: HtStats | null }>(path);
  return d?.stats ?? null;
}

export async function loadTrials(): Promise<Trial[]> {
  const d = await serverApi<{ quests?: Trial[] }>("/api/sidequests");
  return d?.quests ?? [];
}

export async function loadBlackout(): Promise<BlackoutState> {
  const d = await serverApi<{ operation?: BlackoutState["op"]; entries?: BlackoutEntry[] }>(
    `/api/operations/${BLACKOUT_SLUG}`,
  );
  const entries: Record<number, BlackoutEntry> = {};
  for (const e of d?.entries ?? []) entries[Number(e.projectId)] = e;
  return { op: d?.operation ?? null, entries };
}

export async function loadJournal(id: number): Promise<JournalEntry[]> {
  const d = await serverApi<{ entries?: JournalEntry[] }>(`/api/projects/${id}/journal`);
  return d?.entries ?? [];
}

export interface TimelineData {
  events: TimelineEvent[];
  status?: string;
  joeUsed?: boolean;
  fraudReviewDoneAt?: string | null;
}
export interface TimelineEvent {
  kind: "created" | "shipped" | "review" | string;
  at: string;
  verdict?: string;
  note?: string;
  claimedHours?: number | null;
  approvedHours?: number | null;
}

export async function loadTimeline(id: number): Promise<TimelineData | null> {
  return serverApi<TimelineData>(`/api/projects/${id}/timeline`);
}

export interface ProjectHours {
  trackedSeconds: number;
  hackatimeSeconds: number;
  journalSeconds: number;
}

export async function loadHours(id: number): Promise<ProjectHours | null> {
  return serverApi<ProjectHours>(`/api/projects/${id}/hours`);
}

export interface Collaborator {
  id: string | number;
  name: string;
  status: string;
  isSelf?: boolean;
  hackatimeProjects?: string[];
}

export async function loadCollaborators(id: number): Promise<{ collaborators: Collaborator[]; isOwner: boolean } | null> {
  const d = await serverApi<{ collaborators?: Collaborator[]; isOwner?: boolean }>(`/api/projects/${id}/collaborators`);
  return d ? { collaborators: d.collaborators ?? [], isOwner: !!d.isOwner } : null;
}

/** Lifetime RE from the wallet (drives the payout rate); null if unavailable. */
export async function loadWalletRe(): Promise<number | null> {
  const d = await serverApi<{ re?: unknown }>("/api/profile/wallet");
  const re = Number(d?.re);
  return d && Number.isFinite(re) ? re : null;
}

export async function loadHasBirthday(): Promise<boolean> {
  const d = await serverApi<{ ok?: boolean; birthday?: unknown }>("/api/profile/eligibility");
  // Unknown counts as yes, so a failed fetch doesn't nag.
  return d ? !!(d.ok && d.birthday) : true;
}
