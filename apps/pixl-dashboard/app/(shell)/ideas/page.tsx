import type { Metadata } from "next";
import { IdeaBoard, readQuery } from "./idea-board";

export const metadata: Metadata = { title: "Ideas" };

export default async function IdeasPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  return <IdeaBoard sort="new" q={readQuery(q)} />;
}
