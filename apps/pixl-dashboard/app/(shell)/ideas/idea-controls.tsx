"use client";

// Interactive bits of an idea card: vote buttons, delete, apply.
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useAction } from "@/components/use-action";
import { applyToIdea, deleteIdea, voteIdea } from "./actions";
import { applyError, voteError, type Idea } from "./ideas-lib";

export function VoteGroup({ idea }: { idea: Idea }) {
  const [up, setUp] = useState({ n: idea.upvotes || 0, on: idea.has_upvoted });
  const [down, setDown] = useState({ n: idea.downvotes || 0, on: idea.has_downvoted });
  const [msg, setMsg] = useState<string | null>(null);
  const vote = useAction(voteIdea);
  const locked = up.on || down.on || vote.pending;

  async function cast(dir: "up" | "down") {
    if (locked) return;
    setMsg(null);
    const res = await vote.run({ id: Number(idea.id), dir });
    if (!res.ok) return setMsg(voteError(res.error, dir));
    if (dir === "up") setUp({ n: res.data.upvotes ?? up.n + 1, on: true });
    else setDown({ n: res.data.downvotes ?? down.n + 1, on: true });
  }

  return (
    <span className="flex flex-col gap-1">
      <span className="vote-group">
        <button
          type="button"
          className={`vote-btn up${up.on ? " on" : ""}`}
          disabled={locked}
          aria-label="Upvote this idea"
          title={up.on ? "You upvoted this" : "Upvote this idea"}
          onClick={() => cast("up")}
        >
          ▲ <span>{up.n}</span>
        </button>
        <button
          type="button"
          className={`vote-btn down${down.on ? " on" : ""}`}
          disabled={locked}
          aria-label="Downvote this idea"
          title={down.on ? "You downvoted this" : "Downvote this idea"}
          onClick={() => cast("down")}
        >
          ▼ <span>{down.n}</span>
        </button>
      </span>
      {msg ? <span className="inline-error" role="alert">{msg}</span> : null}
    </span>
  );
}

export function DeleteIdeaButton({ id, className = "btn dark" }: { id: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const del = useAction(deleteIdea);

  async function confirm() {
    const res = await del.run({ id });
    if (res.ok) setOpen(false);
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        DELETE
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete this idea?"
        confirmLabel="Delete"
        danger
        pending={del.pending}
        onConfirm={confirm}
      >
        {del.error ? <p className="inline-error">Couldn&apos;t delete that idea.</p> : null}
      </ConfirmDialog>
    </>
  );
}

export function ApplyButton({ id }: { id: number }) {
  const [applied, setApplied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const apply = useAction(applyToIdea);

  async function run() {
    if (applied) return;
    setMsg(null);
    const res = await apply.run({ id });
    if (res.ok) {
      setApplied(true);
      setMsg("Applied! Link up on Slack once the poster reaches out.");
    } else setMsg(applyError(res.error));
  }

  return (
    <>
      <button
        type="button"
        className={`btn teal poster-desc-apply${applied ? " on" : ""}`}
        disabled={applied || apply.pending}
        onClick={run}
      >
        {applied ? "APPLIED" : apply.pending ? "APPLYING..." : "APPLY"}
      </button>
      <div className={applied || !msg ? "poster-desc-note" : "inline-error"} role="status">
        {msg ?? "Link up on Slack if the poster reaches out"}
      </div>
    </>
  );
}
