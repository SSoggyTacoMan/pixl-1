import { NextResponse } from "next/server";
import { guardedRoute, can } from "@/lib/guard";
import { globalSearch } from "@/lib/db";
import { slackHandles } from "@/lib/slack";

export const dynamic = "force-dynamic";

export const GET = guardedRoute("api.search", "staff", async (access, req) => {

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ players: [], projects: [] });

  const canPlayers = can(access, "owner");
  const canProjects = can(access, "reviewer");

  const { players, projects } = await globalSearch(q, {
    players: canPlayers,
    projects: canProjects,
  });

  const handles = await slackHandles(players.map((p) => p.slack_id));

  return NextResponse.json({
    players: players.map((p) => ({
      id: p.id,
      label: (p.real_name || (p.slack_id && handles.get(p.slack_id)) || p.slack_id || p.display_name) ?? "",
      sub: p.display_name,
    })),
    // Project names repeat a lot ("My Portfolio"), so say whose each one is.
    projects: projects.map((p) => {
      const maker = p.users?.display_name;
      return {
        id: p.id,
        label: p.name,
        sub: maker ? `by ${maker} · #${p.id}` : `#${p.id}`,
        status: p.status,
      };
    }),
  });
});
