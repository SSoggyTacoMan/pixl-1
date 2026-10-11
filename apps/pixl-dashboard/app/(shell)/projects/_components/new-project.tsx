"use client";

import Link from "next/link";
import { SafeImage } from "@/components/safe-image";
import { Notice } from "@/components/ui/primitives";
import type { HtStats, Trial } from "../types";
import { ProjectForm } from "./project-form";
import { TrialBrief } from "./trial-bits";
import { useProjectForm } from "./use-project-form";

export function NewProject({
  trials,
  stats,
  trial,
  usdPerHour,
}: {
  trials: Trial[];
  stats: HtStats | null;
  trial: Trial | null;
  usdPerHour: number;
}) {
  const { form, set, save, saving, flash } = useProjectForm(null, trial?.id ?? null);
  return (
    <div>
      <Link className="btn dark mb-4 inline-block" href="/projects">
        ← ALL PROJECTS
      </Link>
      <h1 className="page-title mb-4">NEW PROJECT</h1>
      <TrialBrief trial={trial} />
      {form.imageUrl ? (
        <div className="proj-hero mb-4">
          <SafeImage src={form.imageUrl} />
        </div>
      ) : null}
      {flash ? (
        <Notice tone={flash.tone} className="mb-3">
          {flash.text}
        </Notice>
      ) : null}
      <ProjectForm
        form={form}
        set={set}
        trials={trials}
        stats={stats}
        saving={saving}
        onSave={() => void save()}
        saveLabel="CREATE PROJECT"
        usdPerHour={usdPerHour}
        returnTo="/projects/new"
      />
    </div>
  );
}
