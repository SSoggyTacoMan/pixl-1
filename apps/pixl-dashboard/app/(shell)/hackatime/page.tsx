// Hackatime connect. The old static page just forwarded to /projects; this
// one starts the server's flow (POST /api/hackatime/connect {redirect}, via
// the connectHackatime Server Action) and shows how the round trip ended:
// the server sends the browser back here with ?hackatime=connected|failed.
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardTitle, Notice, PageHeader } from "@/components/ui/primitives";
import { serverGet } from "@/lib/server-api";
import { ConnectHackatimeButton } from "../projects/_components/hackatime-strip";
import type { HtStats } from "../projects/types";
import { outcomeFrom } from "./lib";

export const metadata: Metadata = { title: "Hackatime" };

export default async function HackatimePage({
  searchParams,
}: {
  searchParams: Promise<{ hackatime?: string | string[] }>;
}) {
  const outcome = outcomeFrom((await searchParams).hackatime);
  // GET /api/hackatime/stats (session): connection state + tracked projects.
  const res = await serverGet<{ stats?: HtStats }>("/api/hackatime/stats");
  const stats = res.ok ? (res.data.stats ?? null) : null;
  const connected = !!stats?.connected;

  return (
    <div className="max-w-[720px]">
      <PageHeader title="HACKATIME" sub="Connect Hackatime and track the coding hours behind your ships." />

      {outcome === "connected" ? (
        <Notice tone="good" className="mb-4">
          Hackatime connected. Link its projects to yours from the Projects page.
        </Notice>
      ) : null}
      {outcome === "failed" ? (
        <Notice tone="bad" className="mb-4">
          Connecting Hackatime didn&apos;t work. Try again, and approve access on the Hackatime screen.
        </Notice>
      ) : null}

      <Card>
        <CardTitle className="mb-3 text-gold">{connected ? "CONNECTED" : "NOT CONNECTED"}</CardTitle>
        {!res.ok ? (
          <p className="faint mb-4 text-sm">Couldn&apos;t check your Hackatime connection right now.</p>
        ) : connected ? (
          <p className="mb-4 text-sm">
            Hackatime is linked to your account and tracking {stats?.projects.length ?? 0} project
            {stats?.projects.length === 1 ? "" : "s"}.
          </p>
        ) : (
          <p className="mb-4 text-sm">
            Hours can&apos;t be counted until you link Hackatime.
            {stats?.error ? <span className="faint"> ({stats.error})</span> : null}
          </p>
        )}
        <div className="flex flex-wrap items-start gap-2">
          <ConnectHackatimeButton
            returnTo="/hackatime"
            label={connected ? "RECONNECT" : "CONNECT HACKATIME"}
            className={connected ? "btn ghost" : "btn"}
          />
          <Link href="/projects" className="btn dark">
            GO TO PROJECTS
          </Link>
        </div>
      </Card>
    </div>
  );
}
