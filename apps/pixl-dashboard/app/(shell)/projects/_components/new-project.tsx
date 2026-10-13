"use client";

import Link from "next/link";
import { SafeImage } from "@/components/safe-image";
import { Notice, pageTitle } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import type { HtStats, Trial } from "../types";
import { ProjectForm } from "./project-form";
import { backLink, projHero, projHeroImg } from "./styles";
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
      <Link className={backLink} href="/projects">
        ← ALL PROJECTS
      </Link>
      <h1 className={cn(pageTitle, "mb-4")}>NEW PROJECT</h1>
      <TrialBrief trial={trial} />
      {form.imageUrl ? (
        <div className={projHero}>
          <SafeImage player src={form.imageUrl} className={projHeroImg} />
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
