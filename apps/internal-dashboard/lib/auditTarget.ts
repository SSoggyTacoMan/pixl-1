// Pure helpers for audit rows (kept free of Next/DB imports so they're
// unit-testable). See lib/audit.ts for the writer.

// formData field -> target prefix, checked in this order. The first one
// present becomes the row's target ("project:123").
const TARGET_FIELDS: [string, string][] = [
  ["projectId", "project"],
  ["orderId", "order"],
  ["userId", "user"],
  ["playerId", "user"],
  ["itemId", "shop_item"],
  ["entryId", "entry"],
  ["submissionId", "form_submission"],
  ["reportId", "report"],
  ["banId", "ban"],
  ["proposalId", "ban_proposal"],
  ["roundId", "show_n_tell_round"],
  ["slackId", "slack"],
  ["formKey", "form"],
  ["slug", "slug"],
  ["id", "id"],
];

function isFormDataLike(v: unknown): v is FormData {
  return typeof v === "object" && v !== null && typeof (v as FormData).get === "function" && typeof (v as FormData).keys === "function";
}

// Derives "kind:id" from an action's arguments: a FormData's id fields, or a
// bare number/string first argument (e.g. heartbeatReview(projectId)).
export function targetFromArgs(args: unknown[]): string | null {
  for (const a of args) {
    if (isFormDataLike(a)) {
      for (const [field, kind] of TARGET_FIELDS) {
        const v = a.get(field);
        if (typeof v === "string" && v.trim()) return `${kind}:${v.trim().slice(0, 100)}`;
      }
    } else if (a && typeof a === "object" && !Array.isArray(a)) {
      const o = a as Record<string, unknown>;
      for (const [field, kind] of TARGET_FIELDS) {
        const v = o[field];
        if ((typeof v === "string" && v.trim()) || typeof v === "number")
          return `${kind}:${String(v).slice(0, 100)}`;
      }
    }
  }
  const first = args[0];
  if (typeof first === "number" && Number.isFinite(first)) return `id:${first}`;
  return null;
}

// Field names only, never values: values can be player PII (addresses,
// names, notes), and meta must never hold that.
export function fieldNamesFromArgs(args: unknown[]): string[] {
  const names = new Set<string>();
  for (const a of args) {
    if (isFormDataLike(a)) for (const k of a.keys()) if (!k.startsWith("$ACTION")) names.add(k);
  }
  return [...names].slice(0, 50);
}

// First hop of x-forwarded-for (set by the Orchard ingress), else x-real-ip.
export function clientIp(get: (name: string) => string | null): string | null {
  const fwd = get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim() || null;
  return get("x-real-ip");
}

// Next signals redirect()/notFound() by throwing; those are normal control
// flow, not failures.
export function isNavigationSignal(e: unknown): boolean {
  const digest = (e as { digest?: unknown } | null)?.digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") || digest === "NEXT_NOT_FOUND")
  );
}
