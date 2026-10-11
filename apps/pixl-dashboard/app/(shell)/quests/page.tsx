import type { Metadata } from "next";
import { EmptyNote, Notice } from "@/components/ui/primitives";
import { serverGet } from "@/lib/server-api";
import type { TrialQuest } from "../trials/trial-card";
import { QuestList } from "./quest-list";
import "../trials/trials.css";
import "./quests.css";

export const metadata: Metadata = { title: "Quest log" };

export default async function QuestsPage() {
  const res = await serverGet<{ quests?: TrialQuest[] }>("/api/sidequests");
  const quests = res.ok ? (res.data.quests ?? []) : [];
  const unlocked = quests.filter((q) => q.unlocked).length;
  const pct = quests.length ? (unlocked / quests.length) * 100 : 0;
  const sorted = [...quests].sort((a, b) => Number(!!b.unlocked) - Number(!!a.unlocked));

  return (
    <>
      <section className="hero">
        <div>
          <h1 className="page-title">QUEST LOG</h1>
          <div className="page-sub">Trials from the villagers, special rewards on top.</div>
        </div>
        <div className="progress-box">
          <div className="progress-label">
            {unlocked} / {quests.length} UNLOCKED
          </div>
          <div className="progress-bar">
            <div style={{ width: `${pct}%` }} />
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
            <div className="hint-box panel-deep">
              Locked quests are unlocked by talking to the right NPC in the game: wander the village, chat with
              everyone, and their quests open up here.
            </div>
          )}
        </>
      )}
    </>
  );
}
