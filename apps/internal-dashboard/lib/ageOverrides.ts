// Players allowed to ship although they are now over the age limit (the server
// side of the exception is MANUAL_ELIGIBILITY_OVERRIDE_USER_IDS in
// apps/server/src/hcaEligibility.ts, keep the two in sync). When one of their
// projects is pushed to Airtable after approval, this text goes in "Optional -
// Override Age Justification", unless the reviewer already wrote one.
export const AGE_OVERRIDE_JUSTIFICATIONS: Readonly<Record<string, string>> = {
  // Muhammad Ans (Slack U0976TZ1BCN, "Ghost"), approved by Gabin, 2026-10-13.
  "718c246b-cd32-4751-adbf-efe2dce3231b": "This player shipped before turning 19.",
};

/** auditSections with the age justification filled in for an overridden player, otherwise unchanged. */
export function withAgeOverride<T extends { "AGE JUSTIFICATION": string }>(
  userId: string,
  auditSections: T,
  overrides: Readonly<Record<string, string>> = AGE_OVERRIDE_JUSTIFICATIONS,
): T {
  const text = overrides[userId];
  if (!text || auditSections["AGE JUSTIFICATION"].trim()) return auditSections;
  return { ...auditSections, "AGE JUSTIFICATION": text };
}
