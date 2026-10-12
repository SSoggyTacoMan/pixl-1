"use client";

import { Dialog as D } from "radix-ui";
import { useState } from "react";
import { bbstrip } from "@/components/markdown";
import { TrialCard, type TrialQuest } from "../trials/trial-card";

const ICONS = ["MAP", "SWORD", "CRYSTAL", "WHEAT", "ARROW", "AXE", "POTION", "SCROLL", "CHICKEN", "FISH"];

export function QuestList({ quests }: { quests: TrialQuest[] }) {
  const [open, setOpen] = useState<TrialQuest | null>(null);

  return (
    <>
      <div className="quest-list">
        {quests.map((q, i) => (
          <button
            key={String(q.id)}
            type="button"
            className={`quest panel ${q.unlocked ? "unlocked" : "locked"}`}
            style={{ animationDelay: `${Math.min(i * 40, 500)}ms` }}
            onClick={() => setOpen(q)}
          >
            <span className="quest-icon">{q.unlocked ? ICONS[Math.abs(Number(q.id) || 0) % ICONS.length] : ""}</span>
            <span className="quest-main">
              <span className="quest-name block">{q.name}</span>
              <span className="quest-desc block">
                {q.description ? bbstrip(q.description) : q.unlocked ? "" : "Find the right villager to learn more..."}
              </span>
              <span className="quest-meta">
                {q.region ? <span className="chip">{q.region}</span> : null}
                {q.npc ? <span className="chip teal">{q.npc}</span> : null}
                {q.reward ? <span className="chip reward-tag">{q.reward}</span> : null}
              </span>
            </span>
            <span className={`stamp ${q.unlocked ? "on" : "off"}`}>{q.unlocked ? "UNLOCKED" : "LOCKED"}</span>
          </button>
        ))}
      </div>

      <D.Root open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <D.Portal>
          <D.Overlay className="tc-overlay" />
          <D.Content className="tc-content" aria-describedby={undefined}>
            <div>
              <D.Title className="sr-only">{open?.name ?? "Trial"}</D.Title>
              <D.Close className="tc-close" aria-label="Close">
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
