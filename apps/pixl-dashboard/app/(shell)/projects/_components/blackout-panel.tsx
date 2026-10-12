"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/primitives";
import { enterBlackout, leaveBlackout } from "../collab-actions";
import { projectError } from "../errors";
import type { BlackoutState, Project } from "../types";
import { BLACKOUT_CHIPS } from "./blackout-chip";

const TEXT: Record<string, string> = {
  entered: "Entered. Only work you do from now until Blackout ends is eligible.",
  shipped: "Shipped while entered, waiting for review.",
  awaiting_review: "In review for Blackout.",
  eligible: "Eligible for Blackout rewards.",
  ineligible: "A reviewer marked this project not eligible for Blackout.",
  approved: "Approved for Blackout.",
  needs_changes: "Changes requested. Fix it up and ship again before the fix window closes.",
};

const fmt = (iso: string) => new Date(iso).toLocaleString();

/** Operation Blackout opt-in / opt-out for one project. */
export function BlackoutPanel({ project, blackout, inReview }: { project: Project; blackout: BlackoutState; inReview: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const op = blackout.op;
  if (!op) return null;
  const entry = blackout.entries[project.id];
  const canEnter = ["draft", "needs_changes", "approved"].includes(String(project.status)) && !project.banned_at;
  if (!entry && !(op.status === "active" && canEnter)) return null;

  async function run(kind: "enter" | "leave") {
    setPending(true);
    setErr(null);
    const r = kind === "enter" ? await enterBlackout({ projectId: project.id }) : await leaveBlackout({ projectId: project.id });
    setPending(false);
    setConfirmOut(false);
    if (!r.ok) setErr(projectError(r.error));
    router.refresh();
  }

  if (entry) {
    const chip = BLACKOUT_CHIPS[entry.label];
    const canTakeBack = (entry.label === "entered" && !entry.firstShipAt) || entry.label === "needs_changes";
    return (
      <div className="disclosure">
        <div className="flex flex-wrap items-center gap-2">
          <strong>Operation Blackout</strong>
          {chip ? <Badge tone={chip[1]}>{chip[0]}</Badge> : null}
        </div>
        <p className="hint">
          {TEXT[entry.label] ?? ""}
          {entry.graceDeadline ? ` Fix window closes ${fmt(entry.graceDeadline)} (your local time).` : ""}
        </p>
        {canTakeBack && !inReview ? (
          <button type="button" className="btn ghost mt-2" disabled={pending} onClick={() => setConfirmOut(true)}>
            OPT OUT OF BLACKOUT
          </button>
        ) : null}
        {err ? <p className="hint bad">{err}</p> : null}
        <ConfirmDialog
          open={confirmOut}
          onOpenChange={setConfirmOut}
          title="Opt out of Operation Blackout?"
          description="You can rejoin while Blackout is still open, but only work you do after rejoining will count. Your normal review and payout are unaffected."
          confirmLabel="Opt out"
          pending={pending}
          onConfirm={() => run("leave")}
        />
      </div>
    );
  }

  return (
    <div className="disclosure">
      <strong>Operation Blackout</strong>
      <label className="check-row mt-2">
        <input type="checkbox" checked={false} disabled={pending} onChange={() => run("enter")} />
        Enter this project into Operation Blackout
      </label>
      <p className="hint">
        Only work you do after entering{op.endsAt ? `, and before Blackout ends (${fmt(op.endsAt)}, your local time)` : ""}, is
        eligible. You can still ship and get reviewed anytime. Entering doesn&apos;t guarantee approval. Once you ship you can only
        opt out if changes are requested.
      </p>
      {err ? <p className="hint bad">{err}</p> : null}
    </div>
  );
}
