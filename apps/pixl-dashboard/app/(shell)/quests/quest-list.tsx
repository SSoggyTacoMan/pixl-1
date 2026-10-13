"use client";

import { Dialog as D } from "radix-ui";
import { useState } from "react";
import { bbstrip } from "@/components/markdown";
import { badgeVariants, panel } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { TrialCard, type TrialQuest } from "../trials/trial-card";

const ICONS = ["MAP", "SWORD", "CRYSTAL", "WHEAT", "ARROW", "AXE", "POTION", "SCROLL", "CHICKEN", "FISH"];

export function QuestList({ quests }: { quests: TrialQuest[] }) {
  const [open, setOpen] = useState<TrialQuest | null>(null);

  return (
    <>
      <div className="mt-[26px] flex max-w-[860px] flex-col gap-[16px]">
        {quests.map((q, i) => (
          <button
            key={String(q.id)}
            type="button"
            className={cn(
              panel,
              "relative flex w-full animate-toast-in gap-[18px] px-[20px] py-[18px] text-left text-inherit [font:inherit]",
              q.unlocked ? "border-4 shadow-drop-lg" : "opacity-55",
            )}
            style={{ animationDelay: `${Math.min(i * 40, 500)}ms` }}
            onClick={() => setOpen(q)}
          >
            <span
              className={cn(
                "flex size-[58px] shrink-0 items-center justify-center overflow-hidden border-2 border-stroke p-[2px]",
                "text-center font-pixel text-[11px] tracking-[.5px]",
                q.unlocked ? "bg-gold text-btn-ink" : "bg-panel-deep",
              )}
            >
              {q.unlocked ? ICONS[Math.abs(Number(q.id) || 0) % ICONS.length] : ""}
            </span>
            <span className="min-w-0 flex-1">
              <span className="mb-[5px] block text-[19px] text-ink">{q.name}</span>
              <span className="mb-[9px] block text-[15px] leading-[1.6] whitespace-pre-wrap text-dim">
                {q.description ? bbstrip(q.description) : q.unlocked ? "" : "Find the right villager to learn more..."}
              </span>
              <span className="flex flex-wrap gap-[8px]">
                {q.region ? <span className={badgeVariants()}>{q.region}</span> : null}
                {q.npc ? <span className={badgeVariants({ tone: "teal" })}>{q.npc}</span> : null}
                {q.reward ? <span className={badgeVariants({ tone: "green" })}>{q.reward}</span> : null}
              </span>
            </span>
            <span
              className={cn(
                "absolute top-[14px] right-[16px] border-2 border-stroke px-[9px] pt-[4px] pb-[3px] text-[12px] tracking-[2px]",
                q.unlocked ? "rotate-[4deg] bg-good text-panel-deep" : "-rotate-3 text-dim",
              )}
            >
              {q.unlocked ? "UNLOCKED" : "LOCKED"}
            </span>
          </button>
        ))}
      </div>

      <D.Root open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-100 bg-[rgba(22,22,30,.72)]" />
          <D.Content
            className="pointer-events-none fixed inset-0 z-101 flex items-center justify-center overflow-y-auto p-[24px]"
            aria-describedby={undefined}
          >
            <div className="pointer-events-auto relative">
              <D.Title className="sr-only">{open?.name ?? "Trial"}</D.Title>
              <D.Close
                className="absolute -top-[18px] -right-[18px] z-2 size-[40px] border-2 border-stroke bg-panel font-pixel text-[16px] text-ink shadow-drop"
                aria-label="Close"
              >
                X
              </D.Close>
              {open ? <TrialCard q={open} /> : null}
            </div>
          </D.Content>
        </D.Portal>
      </D.Root>
    </>
  );
}
