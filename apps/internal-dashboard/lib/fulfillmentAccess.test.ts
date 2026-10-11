import { describe, expect, test } from "bun:test";
import { canFlagOrder, canSeeBuyerDetails, canViewLabel, claimedBy, isOwnOrder } from "./fulfillmentAccess";
import { PUBLIC_FALLBACK_NAME, PUBLIC_USER_COLUMNS, publicOwnerLabel } from "./publicLabels";

const fulfiller = (slackId: string, isOwner = false) => ({ isOwner, session: { slackId } });

describe("H2: buyer PII only for the claiming fulfiller or an owner", () => {
  test("unclaimed order: no fulfiller sees details", () => {
    expect(canSeeBuyerDetails({ claimed_by_slack: "" }, fulfiller("UF1"))).toBe(false);
    expect(canSeeBuyerDetails({ claimed_by_slack: null }, fulfiller("UF1"))).toBe(false);
  });
  test("an empty session id never matches an unclaimed order", () => {
    expect(claimedBy({ claimed_by_slack: "" }, "")).toBe(false);
  });
  test("claimed by me vs by someone else", () => {
    expect(canSeeBuyerDetails({ claimed_by_slack: "UF1" }, fulfiller("UF1"))).toBe(true);
    expect(canSeeBuyerDetails({ claimed_by_slack: "UF2" }, fulfiller("UF1"))).toBe(false);
  });
  test("owners see everything", () => {
    expect(canSeeBuyerDetails({ claimed_by_slack: "" }, fulfiller("UO", true))).toBe(true);
  });
  test("label IDOR: same rule as details", () => {
    expect(canViewLabel({ claimed_by_slack: "UF2" }, fulfiller("UF1"))).toBe(false);
    expect(canViewLabel({ claimed_by_slack: "UF1" }, fulfiller("UF1"))).toBe(true);
    expect(canViewLabel({ claimed_by_slack: "UF2" }, fulfiller("UO", true))).toBe(true);
  });
});

describe("fulfiller self-dealing", () => {
  test("own order detected by the buyer's Slack id", () => {
    expect(isOwnOrder({ player_slack: "UF1" }, "UF1")).toBe(true);
    expect(isOwnOrder({ player_slack: "UBUYER" }, "UF1")).toBe(false);
    expect(isOwnOrder({ player_slack: null }, "UF1")).toBe(false);
    expect(isOwnOrder({ player_slack: "" }, "")).toBe(false);
  });
  test("flagging only by the claimer or an owner", () => {
    expect(canFlagOrder({ claimed_by_slack: "" }, fulfiller("UF1"))).toBe(false);
    expect(canFlagOrder({ claimed_by_slack: "UF2" }, fulfiller("UF1"))).toBe(false);
    expect(canFlagOrder({ claimed_by_slack: "UF1" }, fulfiller("UF1"))).toBe(true);
    expect(canFlagOrder({ claimed_by_slack: "" }, fulfiller("UO", true))).toBe(true);
  });
});

describe("H1: public stats never show legal names", () => {
  test("only display_name is used", () => {
    expect(publicOwnerLabel({ display_name: "pixelkid" })).toBe("pixelkid");
    expect(publicOwnerLabel({ display_name: "  " } as { display_name: string })).toBe(PUBLIC_FALLBACK_NAME);
    expect(publicOwnerLabel(null)).toBe(PUBLIC_FALLBACK_NAME);
    // Even if a row carrying real_name sneaks in, it's ignored.
    const leaky = { display_name: "", real_name: "Jane Doe" } as { display_name: string };
    expect(publicOwnerLabel(leaky)).toBe(PUBLIC_FALLBACK_NAME);
  });
  test("the public users embed is display_name only", () => {
    expect(PUBLIC_USER_COLUMNS).toBe("display_name");
  });
});
