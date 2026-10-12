"use client";

import { useState } from "react";
import { SafeImage } from "@/components/safe-image";
import { Notice } from "@/components/ui/primitives";
import { useAction } from "@/components/use-action";
import { voteEntry } from "./actions";
import { applyVote, sortByVotes, voteError, type SttEntry } from "./stt-lib";

const RANK = ["top1", "top2", "top3"];

export function EntryList({ initial }: { initial: SttEntry[] }) {
  const [entries, setEntries] = useState(() => sortByVotes(initial));
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const vote = useAction(voteEntry);

  async function cast(id: number) {
    if (busy !== null) return;
    setBusy(id);
    setMsg(null);
    const res = await vote.run({ id });
    setBusy(null);
    if (!res.ok) return setMsg(voteError(res.error));
    setEntries((prev) => sortByVotes(applyVote(prev, id, res.data.voted)));
  }

  return (
    <>
      {msg ? (
        <Notice tone="bad" className="mt-4">
          {msg}
        </Notice>
      ) : null}
      <div className="stt-list">
        {entries.map((e, i) => (
          <div key={e.id} className="panel stt-card">
            <span className={`stt-rank ${RANK[i] ?? ""}`}>#{i + 1}</span>
            <div className="stt-thumb">
              <SafeImage player src={e.imageUrl} fallback={<span className="faint text-xl">?</span>} />
            </div>
            <div className="stt-body">
              <div className="stt-name">{e.name || "Untitled"}</div>
              <div className="stt-owner">by {e.ownerName || "someone"}</div>
              {e.description ? <div className="stt-desc">{e.description}</div> : null}
            </div>
            <div className="stt-vote">
              {e.isOwn ? (
                <span className="stt-vote-btn stt-vote-own" title="You can't vote for your own project">
                  —
                </span>
              ) : (
                <button
                  type="button"
                  className={`stt-vote-btn${e.votedByMe ? " voted" : ""}`}
                  disabled={busy !== null}
                  aria-pressed={e.votedByMe}
                  aria-label={e.votedByMe ? `Remove your vote for ${e.name || "this project"}` : `Vote for ${e.name || "this project"}`}
                  onClick={() => cast(e.id)}
                >
                  {e.votedByMe ? "♥" : "♡"}
                </button>
              )}
              <span className="stt-vote-count">
                {e.voteCount} vote{e.voteCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
