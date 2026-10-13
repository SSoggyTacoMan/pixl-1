import type { Metadata } from "next";
import { EmptyNote, Notice, pageSub, pageTitle } from "@/components/ui/primitives";
import { serverGet } from "@/lib/server-api";
import { EntryList } from "./entry-list";
import type { SttEntry, SttRound } from "./stt-lib";

export const metadata: Metadata = { title: "Show & Tell" };

export default async function ShowNTellPage() {
  const res = await serverGet<{ round?: SttRound | null; entries?: SttEntry[] }>("/api/show-n-tell");
  const round = res.ok ? (res.data.round ?? null) : null;
  const entries = (res.ok ? (res.data.entries ?? []) : []).map((e) => ({
    ...e,
    id: Number(e.id),
    voteCount: Number(e.voteCount) || 0,
  }));

  return (
    <div>
      <h1 className={pageTitle}>SHOW &amp; TELL</h1>
      <div className={pageSub}>
        {round
          ? round.title
          : "Vote for your favorite project, one vote per account, no stuffing the ballot. You can't vote for your own project."}
      </div>

      {!res.ok ? (
        <Notice tone="bad" className="mt-6">
          Couldn&apos;t load Show &amp; Tell right now.
        </Notice>
      ) : !round ? (
        <EmptyNote>
          NO SHOW &amp; TELL RUNNING RIGHT NOW.
          <br />
          CHECK BACK WHEN THE NEXT ONE STARTS.
        </EmptyNote>
      ) : entries.length === 0 ? (
        <EmptyNote>
          NOTHING ENTERED FOR THIS ROUND YET.
          <br />
          CHECK BACK SOON.
        </EmptyNote>
      ) : (
        <EntryList key={round.id} initial={entries} />
      )}
    </div>
  );
}
