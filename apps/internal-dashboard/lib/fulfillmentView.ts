export function ageLabel(iso: string | null | undefined, now = Date.now()): string {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (Number.isNaN(t)) return "";
  const mins = Math.max(0, Math.round((now - t) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function lastUpdated(o: {
  created_at: string;
  claimed_at: string | null;
  ordered_at: string | null;
  credited_at: string | null;
  shipped_at: string | null;
  done_at: string | null;
}): string {
  return o.done_at ?? o.shipped_at ?? o.credited_at ?? o.ordered_at ?? o.claimed_at ?? o.created_at;
}
