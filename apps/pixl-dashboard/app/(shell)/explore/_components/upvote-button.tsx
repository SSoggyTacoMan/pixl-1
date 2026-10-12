"use client";

// Upvote pill on a project card. Click again to take the vote back.
import { useState } from "react";
import { useAction } from "@/components/use-action";
import type { ActionResult } from "@/lib/guarded-action-core";
import { removeUpvote, upvoteProject } from "../actions";
import { upvoteError } from "../lib";

type Vote = { upvotes: number; hasUpvoted: boolean };

export function UpvoteButton({ projectId, count, voted }: { projectId: number; count: number; voted: boolean }) {
  const [state, setState] = useState<Vote>({ upvotes: count, hasUpvoted: voted });
  const [err, setErr] = useState<string | null>(null);
  const add = useAction(upvoteProject);
  const remove = useAction(removeUpvote);
  const pending = add.pending || remove.pending;

  async function toggle() {
    setErr(null);
    const res: ActionResult<Vote> = state.hasUpvoted ? await remove.run({ projectId }) : await add.run({ projectId });
    if (res.ok) setState(res.data);
    else setErr(upvoteError(res.error));
  }

  return (
    <>
      <button
        type="button"
        className={`pc-vote${state.hasUpvoted ? " on" : ""}`}
        onClick={toggle}
        disabled={pending}
        aria-pressed={state.hasUpvoted}
        aria-label={state.hasUpvoted ? "Remove your upvote" : "Upvote this project"}
        title={state.hasUpvoted ? "Remove your upvote" : "Upvote this project"}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/pixl-ui/icon_upvote.png" alt="" />
        <span>{state.upvotes}</span>
      </button>
      {err ? (
        <span role="alert" className="pc-vote-err">
          {err}
        </span>
      ) : null}
    </>
  );
}
