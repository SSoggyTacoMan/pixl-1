import Link from "next/link";
import type { ReactNode } from "react";
import { Markdown } from "@/components/markdown";
import { safeHttpUrl } from "@/lib/safe-url";
import type { Collaborator, ProjectHours } from "../data";
import type { HtStats, Project } from "../types";
import { Collaborators, MyHackatime } from "./collaborators";
import { ProjectHeader } from "./project-header";

/** Read-only page for a project you collaborate on: journal your hours and link your own Hackatime. */
export function CollabView({
  project,
  stats,
  hours,
  collaborators,
  journal,
}: {
  project: Project;
  stats: HtStats | null;
  hours: ProjectHours | null;
  collaborators: Collaborator[];
  journal: ReactNode;
}) {
  const repo = safeHttpUrl(project.repo_url);
  const demo = safeHttpUrl(project.demo_url);
  return (
    <div>
      <Link className="btn dark mb-4 inline-block" href="/projects">
        ← ALL PROJECTS
      </Link>
      <ProjectHeader
        project={project}
        imageUrl={project.image_url ?? ""}
        htSeconds={hours?.hackatimeSeconds ?? 0}
        journalSeconds={hours?.journalSeconds ?? 0}
        collaborator
      />
      {project.description ? <Markdown source={project.description} className="mb-4" /> : null}
      <div className="mb-5 flex gap-2">
        {repo ? (
          <a className="btn ghost" href={repo} target="_blank" rel="noopener noreferrer">
            REPO
          </a>
        ) : null}
        {demo ? (
          <a className="btn ghost" href={demo} target="_blank" rel="noopener noreferrer">
            DEMO
          </a>
        ) : null}
      </div>
      <div className="section-h">COLLABORATORS</div>
      <Collaborators projectId={project.id} collaborators={collaborators} isOwner={false} joinCode={null} />
      <div className="section-h">MY HACKATIME</div>
      <div className="panel p-4">
        <MyHackatime self={collaborators.find((c) => c.isSelf)} stats={stats} projectId={project.id} />
      </div>
      <div className="section-h">JOURNAL</div>
      {journal}
    </div>
  );
}
