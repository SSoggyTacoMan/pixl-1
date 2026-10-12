import type { Metadata } from "next";
import Link from "next/link";
import { EmptyNote, PageHeader } from "@/components/ui/primitives";
import { serverGet } from "@/lib/server-api";
import { BOARDS, boardHref, countdown, parseBoard, type Board } from "../lib";
import type { PixelBoard, ValueBoard } from "../types";
import { BoardRows, YouCard } from "../_components/board";
import { ExploreTabs } from "../_components/tabs";
import "../explore.css";

export const metadata: Metadata = { title: "Leaderboard" };

const VALUE_BOARDS = {
  referrals: {
    path: "/api/explore/leaderboard/referrals",
    unit: "REFERRED",
    empty: "NOBODY'S REFERRED ANYONE YET.",
    climb: "refer friends to climb",
  },
  upvotes: {
    path: "/api/explore/leaderboard/upvotes",
    unit: "▲",
    empty: "NO UPVOTES ANYWHERE YET.",
    climb: "ship great work to climb",
  },
} as const;

async function PixelsBoard() {
  // GET /api/explore/leaderboard (session)
  const res = await serverGet<PixelBoard>("/api/explore/leaderboard");
  if (!res.ok) return <EmptyNote>COULDN&apos;T LOAD THE LEADERBOARD.</EmptyNote>;
  const d = res.data;
  const rows = (d.players ?? []).map((p) => ({ ...p, value: p.pixels }));
  const sprint = d.sprint;
  return (
    <>
      <BoardRows rows={rows} unit="PX" empty="NO PIXELS ANYWHERE YET." />
      <YouCard rank={d.yourRank} value={d.yourPixels} unit="PX" climb="ship projects to climb" />
      {sprint ? (
        <div className="sprint-panel panel-deep">
          <h3>{sprint.name}</h3>
          <div className="faint mb-3 text-xs">Pixels earned during the event only · {countdown(sprint.ends_at)}</div>
          {(sprint.players ?? []).length ? (
            <BoardRows rows={(sprint.players ?? []).map((p) => ({ ...p, value: p.pixels }))} unit="PX" plainRanks />
          ) : (
            <div className="faint">No sprint pixels yet, be first!</div>
          )}
          <div className="muted mt-2.5 text-sm">
            Your sprint total: {Number(sprint.your_pixels || 0).toLocaleString("en-US")} PX
          </div>
        </div>
      ) : null}
    </>
  );
}

async function ValueBoardView({ board }: { board: Exclude<Board, "pixels"> }) {
  const cfg = VALUE_BOARDS[board];
  // GET /api/explore/leaderboard/referrals | /upvotes (session)
  const res = await serverGet<ValueBoard>(cfg.path);
  if (!res.ok) return <EmptyNote>COULDN&apos;T LOAD THE LEADERBOARD.</EmptyNote>;
  return (
    <>
      <BoardRows rows={res.data.players ?? []} unit={cfg.unit} empty={cfg.empty} showPixels={board === "referrals"} />
      <YouCard rank={res.data.yourRank} value={res.data.yourValue} unit={cfg.unit} climb={cfg.climb} />
    </>
  );
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const board = parseBoard((await searchParams).board);
  return (
    <>
      <PageHeader title="LEADERBOARD" sub="WHO IS SHIPPING THE MOST." />
      <ExploreTabs active="leaderboard" />
      <nav className="ex-tabs ex-subtabs" aria-label="Leaderboards">
        {BOARDS.map((b) => (
          <Link
            key={b.key}
            href={boardHref(b.key)}
            className={`ex-tab${b.key === board ? " active" : ""}`}
            aria-current={b.key === board ? "page" : undefined}
          >
            {b.label}
          </Link>
        ))}
      </nav>
      {board === "pixels" ? <PixelsBoard /> : <ValueBoardView board={board} />}
    </>
  );
}
