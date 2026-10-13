import type { Metadata } from "next";
import { EmptyNote, Notice, pageSub, pageTitle, panelDeep } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { serverGet } from "@/lib/server-api";
import { trialsHero, type TrialQuest } from "../trials/trial-card";
import { QuestList } from "./quest-list";

export const metadata: Metadata = { title: "Quest log" };

export default async function QuestsPage() {
  const res = await serverGet<{ quests?: TrialQuest[] }>("/api/sidequests");
  const quests = res.ok ? (res.data.quests ?? []) : [];
  const unlocked = quests.filter((q) => q.unlocked).length;
  const pct = quests.length ? (unlocked / quests.length) * 100 : 0;
  const sorted = [...quests].sort((a, b) => Number(!!b.unlocked) - Number(!!a.unlocked));

  return (
    <>
      <section className={trialsHero}>
        <div>
          <h1 className={pageTitle}>QUEST LOG</h1>
          <div className={cn(pageSub, "text-ink")}>Trials from the villagers, special rewards on top.</div>
        </div>
        <div className="ml-auto text-right">
          <div className="mb-[7px] text-[13px] tracking-[1px] text-ink">
            {unlocked} / {quests.length} UNLOCKED
          </div>
          <div className="h-[18px] w-[240px] max-w-[60vw] overflow-hidden border-2 border-stroke bg-panel-deep">
            <div className="h-full bg-gold transition-[width] duration-500 ease-[ease]" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </section>

      {!res.ok ? (
        <Notice tone="bad" className="mt-6">
          Couldn&apos;t load quests.
        </Notice>
      ) : sorted.length === 0 ? (
        <EmptyNote>
          NO TRIALS POSTED RIGHT NOW.
          <br />
          THE VILLAGERS ARE THINKING...
        </EmptyNote>
      ) : (
        <>
          <QuestList quests={sorted} />
          {sorted.every((q) => q.unlocked) ? null : (
            <div className={cn(panelDeep, "mt-[30px] max-w-[860px] px-[20px] py-[16px] text-[14px] leading-[1.7] text-dim")}>
              Locked quests are unlocked by talking to the right NPC in the game: wander the village, chat with
              everyone, and their quests open up here.
            </div>
          )}
        </>
      )}
    </>
  );
}
