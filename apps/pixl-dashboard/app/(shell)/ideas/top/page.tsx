import type { Metadata } from "next";
import { IdeaBoard, readQuery } from "../idea-board";

export const metadata: Metadata = { title: "Top ideas" };

export default async function TopIdeasPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  return <IdeaBoard sort="top" q={readQuery(q)} />;
}
