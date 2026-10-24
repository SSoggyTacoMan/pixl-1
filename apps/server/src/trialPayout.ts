// credit_project_pixels is idempotent per project: it credits
// (p_amount - what the project already paid out), not p_amount. So when a
// player keeps the Trial prize and still gets the pixels beyond the minimum,
// the amount handed to it must be a running total that already includes
// whatever the project paid before it became a Trial ship. Passing the
// beyond-minimum pixels on their own made a project that had already earned
// more than that go negative (243 already paid, 195 beyond -> -48), which
// tripped the pending-order clawback and cancelled the prize order itself.
export function trialItemCreditTarget(alreadyPx: number, heldPx: number, prizePx: number): number {
  const already = Math.max(alreadyPx, 0);
  const beyondPx = Math.max(heldPx - prizePx, 0);
  return already + beyondPx;
}
