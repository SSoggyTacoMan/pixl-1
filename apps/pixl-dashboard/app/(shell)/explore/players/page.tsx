import type { Metadata } from "next";
import Link from "next/link";
import { EmptyNote, PageHeader } from "@/components/ui/primitives";
import { serverGet } from "@/lib/server-api";
import { parseFilters, playersQuery, timeAgo } from "../lib";
import type { DirectoryPlayer } from "../types";
import { Avatar } from "../_components/avatar";
import { SearchBar } from "../_components/search-bar";
import { ExploreTabs } from "../_components/tabs";
import "../explore.css";

export const metadata: Metadata = { title: "Players" };

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { q } = parseFilters(await searchParams);
  // GET /api/explore/players (public route; sent with the session anyway).
  const res = await serverGet<{ players?: DirectoryPlayer[] }>(`/api/explore/players${playersQuery(q)}`);
  const players = res.ok ? (res.data.players ?? []) : [];

  return (
    <>
      <PageHeader title="PLAYERS" sub="EVERY HACK CLUBBER BUILDING ON PIXL." />
      <ExploreTabs active="players" />
      <SearchBar initial={{ q }} placeholder="Find a player..." />

      {!res.ok ? (
        <EmptyNote>COULDN&apos;T LOAD PLAYERS. TRY AGAIN IN A BIT.</EmptyNote>
      ) : players.length === 0 ? (
        <EmptyNote>NOBODY HERE BY THAT NAME.</EmptyNote>
      ) : (
        <div className="grid">
          {players.map((p) => {
            const n = Number(p.project_count ?? 0);
            return (
              <Link key={p.id} className="panel pcard" href={`/explore/players/${encodeURIComponent(p.id)}`}>
                <Avatar name={p.display_name} url={p.avatar_url} />
                <div className="pname">{p.display_name}</div>
                <div className="pmeta">
                  {n} project{n === 1 ? "" : "s"} · joined {timeAgo(p.created_at)}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
