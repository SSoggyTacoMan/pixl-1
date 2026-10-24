import { db, recentApprovedJustifications, type JournalRow } from "@/lib/db";
import { computeClaimedHours } from "@/lib/hours";
import { fetchHackatimeReport, fetchTrustFactor } from "@/lib/hackatime";
import { fetchCommits, attachCommitStats } from "@/lib/commits";
import { yswsShipsFor } from "@/lib/ysws";
import type { AiReviewInput } from "@/lib/aiReview";

// Gathers what the AI review draft reads for one project: the same objective
// facts a reviewer has open on the review page. Shared by the "Generate AI
// draft" button (generateAiReviewDraftAction) and the batch route that
// pre-fills drafts for the queue (app/api/cron/ai-drafts), so both build the
// exact same prompt input.

// What the player claimed, after any per-journal deflation (same figure the
// review form starts from). Mirrors claimedHoursFor in app/actions.ts.
async function claimedHours(projectId: number): Promise<number> {
  const [{ data: journals }, { data: proj }] = await Promise.all([
    db.from("project_journals").select("hours, approved_hours, user_id").eq("project_id", projectId),
    db.from("projects").select("hackatime_seconds, kind, user_id").eq("id", projectId).single(),
  ]);
  return computeClaimedHours({
    hackatimeSeconds: proj?.hackatime_seconds,
    kind: proj?.kind,
    ownerUserId: proj?.user_id,
    journals: journals ?? [],
  });
}

export async function buildAiReviewInput(projectId: number, reviewerHours?: number): Promise<AiReviewInput> {
  const { data: p, error } = await db
    .from("projects")
    .select("name, description, repo_url, demo_url, kind, ai_notes, user_id, hackatime_projects")
    .eq("id", projectId)
    .single();
  if (error || !p) throw new Error("Project not found");

  const { data: users } = await db
    .from("users")
    .select("slack_id, hackatime_token")
    .eq("id", p.user_id)
    .maybeSingle();
  const slackId = (users?.slack_id as string | undefined) ?? null;
  const hackatimeToken = (users?.hackatime_token as string | undefined) ?? null;
  const hackatimeProjects = (p.hackatime_projects as string[] | null) ?? [];

  const { data: journalRows } = await db
    .from("project_journals")
    .select("id, project_id, user_id, title, content, hours, approved_hours, created_at, edited_at")
    .eq("project_id", projectId);

  const [commits, hackatime, trust, claimed, yswsMatches, styleExamples] = await Promise.all([
    (async () => {
      const c = await fetchCommits(p.repo_url as string | null);
      await attachCommitStats(c);
      return c;
    })(),
    hackatimeProjects.length
      ? fetchHackatimeReport(slackId, hackatimeToken, hackatimeProjects)
      : Promise.resolve(null),
    fetchTrustFactor(slackId),
    claimedHours(projectId),
    yswsShipsFor(slackId, p.repo_url as string | null, p.demo_url as string | null).then((rows) =>
      rows.filter((s) => s.urlMatch),
    ),
    recentApprovedJustifications(),
  ]);

  return {
    projectName: p.name as string,
    description: (p.description as string | null) ?? "",
    repoUrl: p.repo_url as string | null,
    demoUrl: p.demo_url as string | null,
    kind: p.kind as string,
    aiNotes: (p.ai_notes as string | null) ?? "",
    claimedHours: claimed,
    reviewerHours: reviewerHours ?? claimed,
    commits,
    journals: (journalRows ?? []) as unknown as JournalRow[],
    hackatime,
    trust,
    yswsMatches,
    styleExamples,
  };
}
