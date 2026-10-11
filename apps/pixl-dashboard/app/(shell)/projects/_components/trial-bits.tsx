"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/primitives";
import { claimTrialReward } from "../actions";
import { projectError } from "../errors";
import type { Project, Trial } from "../types";

/** "Building for this Trial" brief shown on the new-project form and the editor. */
export function TrialBrief({ trial }: { trial: Trial | null | undefined }) {
  if (!trial) return null;
  return (
    <div className="trial-box mb-4 p-4">
      <div className="font-pixel tracking-wider">
        BUILDING FOR TRIAL: {trial.name}
        {trial.region ? ` · ${trial.region}` : ""}
      </div>
      {trial.description ? <p className="mt-2">{trial.description}</p> : null}
      {trial.brief ? (
        <div className="mt-3">
          <div className="label">THE FULL BRIEF</div>
          <p className="whitespace-pre-wrap">{trial.brief}</p>
        </div>
      ) : null}
      {trial.min_hours != null ? (
        <p className="mt-2">
          Minimum <b>{trial.min_hours}h</b> tracked to ship for this Trial.
        </p>
      ) : null}
      {trial.reward ? (
        <p className="mt-2">
          Reward on completion: <b>{trial.reward}</b>
          {trial.min_hours ? ` (covers the first ${trial.min_hours}h)` : ""}, plus pixels at the normal rate for every hour
          beyond that. Prefer pixels only? You can skip the prize once it&apos;s approved.
        </p>
      ) : null}
      <p className="hint mt-2">Build to this spec. When you ship, pick this Trial in the ship panel (change it if you&apos;re building something else).</p>
    </div>
  );
}

/**
 * Once a Trial ship is approved the payout is held until the player picks:
 * the Trial's prize, or the pixels their hours earned. Amounts are the
 * server's (trial_held_px / trial_prize_px), only subtracted for display.
 */
export function TrialReward({ project }: { project: Project }) {
  const router = useRouter();
  const [choice, setChoice] = useState<"item" | "pixels" | null>(null);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const state = project.trial_reward_choice;
  if (!state) return null;
  const prize = project.trial_prize_name || "the Trial reward";
  if (state === "item")
    return (
      <Notice tone="good" className="mb-4">
        Trial reward claimed: <b>{prize}</b>. Track it in <Link href="/orders">your orders</Link>.
      </Notice>
    );
  if (state === "pixels")
    return (
      <Notice tone="good" className="mb-4">
        You took the pixels for this Trial instead of the reward.
      </Notice>
    );

  const total = Math.round(Number(project.trial_held_px) || 0);
  const beyond = Math.max(total - Math.round(Number(project.trial_prize_px) || 0), 0);

  async function confirm() {
    if (!choice) return;
    setPending(true);
    const r = await claimTrialReward({ id: project.id, choice });
    setPending(false);
    setChoice(null);
    if (!r.ok) return setMsg({ tone: "bad", text: projectError(r.error) });
    setMsg({ tone: "good", text: choice === "item" ? `"${prize}" is on the way, check your orders.` : `+${total} pixels.` });
    router.refresh();
  }

  return (
    <div className="trial-box mb-4 p-4">
      <div className="font-pixel tracking-wider">YOUR TRIAL REWARD</div>
      <p className="mt-2">
        {project.sidequest_name || "This Trial"} is done! By default you keep <b>{prize}</b>
        {beyond > 0 ? (
          <>
            {" "}
            and still earn <b>{beyond} pixels</b> for the hours past the minimum
          </>
        ) : null}
        . Prefer pure pixels? Skip the prize to take all <b>{total}</b> instead. It&apos;s final either way.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={() => setChoice("item")}>
          KEEP {prize.toUpperCase()}
          {beyond > 0 ? ` + ${beyond} PX` : ""}
        </button>
        <button type="button" className="btn dark" onClick={() => setChoice("pixels")}>
          SKIP PRIZE, TAKE {total} PX
        </button>
      </div>
      {msg ? (
        <Notice tone={msg.tone} className="mt-3">
          {msg.text}
        </Notice>
      ) : null}
      <ConfirmDialog
        open={choice !== null}
        onOpenChange={(o) => !o && setChoice(null)}
        title={choice === "item" ? "Keep the prize?" : "Skip the prize?"}
        description={
          choice === "item"
            ? `You'll get "${prize}"${beyond > 0 ? ` plus ${beyond} pixels for the hours past the minimum` : ""}, and give up taking all ${total} pixels. This can't be undone.`
            : `You'll get all ${total} pixels and give up "${prize}". This can't be undone.`
        }
        confirmLabel={choice === "item" ? "Keep the prize" : "Take all pixels"}
        pending={pending}
        onConfirm={confirm}
      />
    </div>
  );
}
