import type { Metadata } from "next";
import { EmptyNote, Notice } from "@/components/ui/primitives";
import { serverGet } from "@/lib/server-api";
import { TrialCard, type TrialQuest } from "./trial-card";
import "./trials.css";

export const metadata: Metadata = { title: "Trials" };

// Read-only, like the old page: Trials unlock by talking to villagers in the
// game; this page shows every Trial's story and reward.
export default async function TrialsPage() {
  const res = await serverGet<{ quests?: TrialQuest[] }>("/api/sidequests");
  const quests = res.ok ? (res.data.quests ?? []) : [];
  const sorted = [...quests].sort((a, b) => Number(!!b.unlocked) - Number(!!a.unlocked));

  return (
    <>
      <section className="hero">
        <div>
          <h1 className="page-title">TRIALS</h1>
          <div className="page-sub">Every Trial from the villagers, story and reward on the card.</div>
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
        <div className="trial-grid">
          {sorted.map((q) => (
            <TrialCard key={String(q.id)} q={q} />
          ))}
        </div>
      )}
    </>
  );
}
