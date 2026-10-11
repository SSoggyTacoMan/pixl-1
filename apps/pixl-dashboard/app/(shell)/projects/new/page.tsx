import { loadStats, loadTrials } from "../data";
import { NewProject } from "../_components/new-project";
import "../projects.css";

export const metadata = { title: "New project" };

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ trial?: string }> }) {
  const { trial: trialParam } = await searchParams;
  const [trials, stats] = await Promise.all([loadTrials(), loadStats()]);
  // Only ?trial=<id> from the in-game NPC hand-off picks a Trial; never guess.
  const tid = Number(trialParam);
  const trial = (tid && trials.find((t) => Number(t.id) === tid && t.unlocked && !t.completed)) || null;
  return <NewProject trials={trials} stats={stats} trial={trial} />;
}
