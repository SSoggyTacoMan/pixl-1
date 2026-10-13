"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button, Notice } from "@/components/ui/primitives";
import type { ProjectEstimate } from "../../calc/estimates";
import { isInReview, type BlackoutState, type HtStats, type Project, type Trial } from "../types";
import { ProjectForm } from "./project-form";
import { ProjectHeader } from "./project-header";
import { SaveStatusChip } from "./save-status";
import { ShipPanel } from "./ship-panel";
import { backLink, sectionH } from "./styles";
import { TrialBrief, TrialReward } from "./trial-bits";
import { useProjectForm } from "./use-project-form";

/** The owner's full editor for one project. Server-rendered sections arrive as slots. */
export function ProjectEditor({
  project,
  trials,
  stats,
  cutoffMs,
  blackout,
  hasBirthday,
  htSeconds,
  estimate,
  usdPerHour,
  collaborators,
  timeline,
  journal,
  dangerZone,
}: {
  project: Project;
  trials: Trial[];
  stats: HtStats | null;
  cutoffMs: number;
  blackout: BlackoutState;
  hasBirthday: boolean;
  htSeconds: number;
  estimate: ProjectEstimate | null;
  usdPerHour: number;
  collaborators: ReactNode;
  timeline: ReactNode;
  journal: ReactNode;
  dangerZone: ReactNode;
}) {
  const inReview = isInReview(project);
  const { form, set, save, saving, flash, status, pauseAutosave } = useProjectForm(project, null, inReview);
  const [showDetails, setShowDetails] = useState(false);
  const trial = trials.find((t) => Number(t.id) === Number(project.sidequest_id) && t.unlocked && !t.completed);

  return (
    <div>
      <Link className={backLink} href="/projects">
        ← ALL PROJECTS
      </Link>
      <ProjectHeader
        project={project}
        imageUrl={form.imageUrl}
        htSeconds={htSeconds}
        estimate={estimate}
        journalSeconds={Number(project.journal_seconds) || 0}
        blackoutEntry={blackout.entries[project.id]}
      />
      <TrialReward project={project} />
      {!inReview ? <TrialBrief trial={trial} /> : null}

      <div className={sectionH}>
        PROJECT DETAILS
        <SaveStatusChip status={status} />
        <Button variant="ghost" className="ml-auto" onClick={() => setShowDetails((v) => !v)}>
          {showDetails ? "HIDE DETAILS" : "EDIT DETAILS"}
        </Button>
      </div>
      {flash ? (
        <Notice tone={flash.tone} className="mb-3">
          {flash.text}
        </Notice>
      ) : null}
      {showDetails ? (
        <ProjectForm
          form={form}
          set={set}
          projectId={project.id}
          trials={trials}
          linkedTrialName={project.sidequest_name}
          stats={stats}
          locked={inReview}
          saving={saving}
          onSave={() => void save()}
          saveLabel="SAVE"
          usdPerHour={usdPerHour}
          returnTo={`/projects/${project.id}`}
        />
      ) : null}

      <div className={sectionH}>COLLABORATORS</div>
      {collaborators}

      <div className={sectionH}>SHIP IT</div>
      <ShipPanel
        project={project}
        form={form}
        stats={stats}
        cutoffMs={cutoffMs}
        blackout={blackout}
        inReview={inReview}
        hasBirthday={hasBirthday}
        save={save}
        pauseAutosave={pauseAutosave}
      />

      <div className={sectionH}>TIMELINE</div>
      {timeline}

      <div className={sectionH}>JOURNAL</div>
      {journal}

      {dangerZone}
    </div>
  );
}
