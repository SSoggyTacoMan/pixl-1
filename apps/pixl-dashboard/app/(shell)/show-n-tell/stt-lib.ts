// Shapes for GET /api/show-n-tell (apps/server/src/routes/showNTell.ts) and
// the local vote bookkeeping. Pure, unit tested in stt-lib.test.ts.

export interface SttEntry {
  id: number;
  name?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  ownerName?: string | null;
  voteCount: number;
  votedByMe: boolean;
  isOwn: boolean;
}

export interface SttRound {
  id: number;
  title: string;
  openedAt?: string;
}

export function sortByVotes(entries: SttEntry[]): SttEntry[] {
  return entries.slice().sort((a, b) => b.voteCount - a.voteCount);
}

/**
 * Apply a vote result locally. A new vote moves any prior vote in this round
 * rather than stacking (one live vote per round, per user), so the previously
 * voted entry's count drops too. voted=false means the vote was withdrawn.
 */
export function applyVote(entries: SttEntry[], id: number, voted: boolean): SttEntry[] {
  return entries.map((e) => {
    if (e.id === id) {
      if (e.votedByMe === voted) return e;
      return { ...e, votedByMe: voted, voteCount: Math.max(0, e.voteCount + (voted ? 1 : -1)) };
    }
    if (voted && e.votedByMe) return { ...e, votedByMe: false, voteCount: Math.max(0, e.voteCount - 1) };
    return e;
  });
}

export function voteError(code: string): string {
  if (code === "round_closed") return "This round just closed.";
  if (code === "own_project") return "You can't vote for your own project.";
  return "Couldn't vote, try again.";
}
