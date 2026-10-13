"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Button, panelDeep } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { deleteProject } from "../actions";
import { projectError } from "../errors";
import { hint } from "./styles";

/** Two-step delete, like the old page. */
export function DangerZone({ id, name }: { id: number; name: string }) {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function del() {
    setPending(true);
    const r = await deleteProject({ id });
    setPending(false);
    setStep(0);
    if (!r.ok) return setErr(projectError(r.error));
    router.push("/projects");
  }

  return (
    <div className={cn(panelDeep, "mt-[28px] flex items-center justify-between gap-[12px] px-[14px] py-[12px]")}>
      <span className="text-sm text-faint">Done with this project?</span>
      <Button variant="red" onClick={() => setStep(1)}>
        DELETE PROJECT
      </Button>
      {err ? <span className={hint("bad")}>{err}</span> : null}
      <ConfirmDialog
        open={step === 1}
        onOpenChange={(o) => !o && setStep(0)}
        title="Delete this project?"
        description={`Delete "${name}" and all its journal entries? This can't be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => setStep(2)}
      />
      <ConfirmDialog
        open={step === 2}
        onOpenChange={(o) => !o && setStep(0)}
        title="Really sure?"
        description="Gone means gone."
        confirmLabel="Delete forever"
        danger
        pending={pending}
        onConfirm={del}
      />
    </div>
  );
}
