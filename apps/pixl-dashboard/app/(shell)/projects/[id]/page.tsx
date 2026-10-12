import { notFound } from "next/navigation";
import {
  loadBlackout,
  loadCollaborators,
  loadHasBirthday,
  loadHours,
  loadJournal,
  loadProjects,
  loadStats,
  loadTimeline,
  loadTrials,
  loadWalletRe,
} from "../data";
import { projectEstimate, usdPerHourFor } from "../../calc/estimates";
import { projectCutoffMs, statsPath } from "../format";
import { isInReview } from "../types";
import { Collaborators } from "../_components/collaborators";
import { CollabView } from "../_components/collab-view";
import { DangerZone } from "../_components/danger-zone";
import { Journal } from "../_components/journal";
import { linkedSeconds } from "../_components/project-list";
import { ProjectEditor } from "../_components/project-editor";
import { Timeline } from "../_components/timeline";
import "../projects.css";

export const metadata = { title: "Project" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();

  // Only projects you own or collaborate on are viewable here; the public
  // permalink view of other players' projects is not part of this relaunch.
  const project = (await loadProjects()).find((p) => p.id === id);
  if (!project) notFound();

  const cutoffMs = projectCutoffMs(project.hours_extended_since);
  const [trials, stats, blackout, journal, collabs, hasBirthday] = await Promise.all([
    loadTrials(),
    loadStats(statsPath(cutoffMs)),
    loadBlackout(),
    loadJournal(id),
    loadCollaborators(id),
    loadHasBirthday(),
  ]);
  const locked = isInReview(project);

  if (project.is_owner === false) {
    const hours = await loadHours(id);
    return (
      <CollabView
        project={project}
        stats={stats}
        hours={hours}
        collaborators={collabs?.collaborators ?? []}
        journal={<Journal projectId={id} entries={journal} locked={locked} />}
      />
    );
  }

  const [timeline, re] = await Promise.all([loadTimeline(id), loadWalletRe()]);
  const htSeconds = linkedSeconds(project, stats);
  // Computed here, server side: the client only ever sees the resulting numbers.
  const estimate = projectEstimate({
    htSeconds,
    journalSeconds: project.journal_seconds,
    approvedHours: project.approved_hours,
    re: re ?? 0,
  });
  return (
    <ProjectEditor
      project={project}
      trials={trials}
      stats={stats}
      cutoffMs={cutoffMs}
      blackout={blackout}
      hasBirthday={hasBirthday}
      htSeconds={htSeconds}
      estimate={estimate}
      usdPerHour={usdPerHourFor(re ?? 0)}
      collaborators={
        collabs ? (
          <Collaborators projectId={id} collaborators={collabs.collaborators} isOwner={collabs.isOwner} joinCode={project.join_code} />
        ) : (
          <p className="faint text-sm">Couldn&apos;t load collaborators.</p>
        )
      }
      timeline={<Timeline data={timeline} />}
      journal={<Journal projectId={id} entries={journal} locked={locked} />}
      dangerZone={<DangerZone id={id} name={project.name} />}
    />
  );
}
