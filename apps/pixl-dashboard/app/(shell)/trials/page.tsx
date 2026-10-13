import type { Metadata } from "next";
import { EmptyNote, Notice, pageSub, pageTitle } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { serverGet } from "@/lib/server-api";
import { TrialCard, trialsHero, type TrialQuest } from "./trial-card";

export const metadata: Metadata = { title: "Trials" };

// Read-only, like the old page: Trials unlock by talking to villagers in the
// game; this page shows every Trial's story and reward.
export default async function TrialsPage() {
  const res = await serverGet<{ quests?: TrialQuest[] }>("/api/sidequests");
  const quests = res.ok ? (res.data.quests ?? []) : [];
  const sorted = [...quests].sort((a, b) => Number(!!b.unlocked) - Number(!!a.unlocked));

  return (
    <>
      <section className={trialsHero}>
        <div>
          <h1 className={pageTitle}>TRIALS</h1>
          <div className={cn(pageSub, "text-ink")}>Every Trial from the villagers, story and reward on the card.</div>
        </div>
      </section>

      {!res.ok ? (
        <Notice tone="bad" className="mt-6">
          Couldn&apos;t load trials.
        </Notice>
      ) : sorted.length === 0 ? (
        <EmptyNote>
          NO TRIALS POSTED RIGHT NOW.
          <br />
          THE VILLAGERS ARE THINKING...
        </EmptyNote>
      ) : (
        <div className="mt-[30px] flex flex-wrap justify-center gap-[32px]">
          {sorted.map((q) => (
            <TrialCard key={String(q.id)} q={q} />
          ))}
        </div>
      )}
    </>
  );
}
