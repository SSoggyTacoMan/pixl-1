"use client";

import { useState } from "react";
import { SafeImage } from "@/components/safe-image";
import { Notice, panel } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { useAction } from "@/components/use-action";
import { voteEntry } from "./actions";
import { applyVote, sortByVotes, voteError, type SttEntry } from "./stt-lib";

const RANK = ["text-gold", "text-teal", "text-gold-soft"];

const voteBtn = "size-[52px] border-2 border-stroke bg-panel-deep font-pixel text-[20px] text-ink";

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
      <div className="mt-[22px] flex flex-col gap-[14px]">
        {entries.map((e, i) => (
          <div
            key={e.id}
            className={cn(panel, "flex items-center gap-[14px] px-[18px] py-[16px] max-[480px]:gap-[10px] max-[480px]:p-[12px]")}
          >
            <span className={cn("w-[26px] shrink-0 text-center font-pixel text-[14px] text-faint", RANK[i])}>#{i + 1}</span>
            <div className="flex size-[64px] shrink-0 items-center justify-center overflow-hidden border-2 border-stroke bg-panel-deep max-[480px]:size-[48px]">
              <SafeImage
                player
                src={e.imageUrl}
                className="size-full object-cover [image-rendering:pixelated]"
                fallback={<span className="text-xl text-faint">?</span>}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-pixel text-[16px] tracking-[.3px] [overflow-wrap:anywhere] text-ink">{e.name || "Untitled"}</div>
              <div className="mt-[2px] text-[12.5px] text-faint">by {e.ownerName || "someone"}</div>
              {e.description ? <div className="mt-[6px] line-clamp-2 text-[13px] leading-[1.5] text-dim">{e.description}</div> : null}
            </div>
            <div className="flex shrink-0 flex-col items-center gap-[4px]">
              {e.isOwn ? (
                <span
                  className={cn(voteBtn, "inline-flex cursor-default items-center justify-center text-faint")}
                  title="You can't vote for your own project"
                >
                  —
                </span>
              ) : (
                <button
                  type="button"
                  className={cn(
                    voteBtn,
                    "hover:border-accent",
                    e.votedByMe && "border-accent bg-accent text-panel-deep",
                  )}
                  disabled={busy !== null}
                  aria-pressed={e.votedByMe}
                  aria-label={e.votedByMe ? `Remove your vote for ${e.name || "this project"}` : `Vote for ${e.name || "this project"}`}
                  onClick={() => cast(e.id)}
                >
                  {e.votedByMe ? "♥" : "♡"}
                </button>
              )}
              <span className="text-[12px] text-faint tabular-nums">
                {e.voteCount} vote{e.voteCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
