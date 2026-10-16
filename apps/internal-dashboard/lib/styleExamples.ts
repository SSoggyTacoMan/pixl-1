// Picks the house-style examples the AI review draft copies (see
// generateAiReviewDraft in lib/aiReview.ts). The write-ups worth copying are
// the thorough ones the team sends to Airtable for long-hours projects, not
// whatever was approved last, so: latest write-up per project, long-hours
// projects only, longest technical-features text first.

export interface StyleExample {
  technicalFeatures: string;
  notes: string;
  deflationReason: string;
}

export interface StyleCandidate extends StyleExample {
  projectId: number;
  hours: number | null;
}

/** `candidates` must be newest first. */
export function pickStyleExamples(candidates: StyleCandidate[], limit = 4, minHours = 20): StyleExample[] {
  const seen = new Set<number>();
  const latest: StyleCandidate[] = [];
  for (const c of candidates) {
    if (seen.has(c.projectId)) continue;
    seen.add(c.projectId);
    latest.push(c);
  }

  const isLong = (c: StyleCandidate) => c.hours != null && c.hours >= minHours;
  const byLength = (a: StyleCandidate, b: StyleCandidate) => b.technicalFeatures.length - a.technicalFeatures.length;

  const picked = latest.filter(isLong).sort(byLength).slice(0, limit);
  // Too few long-hours projects yet: fill up to two with the newest others so
  // the draft still has a voice to follow.
  for (const c of latest) {
    if (picked.length >= Math.min(2, limit)) break;
    if (!picked.includes(c)) picked.push(c);
  }

  return picked.map(({ technicalFeatures, notes, deflationReason }) => ({ technicalFeatures, notes, deflationReason }));
}
