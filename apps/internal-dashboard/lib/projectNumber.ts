// A search box entry that is just a project number ("747" or "#747"), so the
// project searches can match by id as well as by name. Returns null for
// anything else, including numbers too long to be a real id.
export function projectNumber(query: string | null | undefined): number | null {
  const m = /^#?\s*(\d{1,9})$/.exec((query ?? "").trim());
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 ? n : null;
}
