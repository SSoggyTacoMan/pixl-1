// apps/server's GET /api/profile/eligibility no longer sends street address
// lines, state or postal code - only city, country and a hasAddress flag. The
// full address stays server side and is used only for fulfillment.

export interface AddressFields {
  hasAddress?: boolean | null;
  addressCity?: string | null;
  addressCountry?: string | null;
}

const clean = (s: unknown) => (typeof s === "string" ? s.trim() : "");

/** "Burlington, US" (whichever parts exist), or "" if neither does. */
export function cityCountry(e: AddressFields | null | undefined): string {
  if (!e) return "";
  return [clean(e.addressCity), clean(e.addressCountry)].filter(Boolean).join(", ");
}

/** Account page line: "Burlington, US — street address on file", or null when nothing is on file. */
export function accountAddressLine(e: AddressFields | null | undefined): string | null {
  if (!e?.hasAddress) return null;
  const place = cityCountry(e);
  return place ? `${place} — street address on file` : "Street address on file";
}
