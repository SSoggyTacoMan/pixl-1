import { describe, expect, test } from "bun:test";
import { config, payoutUsdPerHour } from "@/app/_generated/config";
import { fundingHoursText } from "../projects/_components/funding-hours";
import { hoursHint } from "../shop/hours-hint";
import { earnRates, projectEstimate, usdPerHourFor } from "./estimates";

describe("projectEstimate", () => {
  test("null when nothing is tracked", () => {
    expect(projectEstimate({ htSeconds: 0, journalSeconds: 0, approvedHours: 0, re: 0 })).toBeNull();
  });
  test("first ship: full tracked hours at the base rate", () => {
    const e = projectEstimate({ htSeconds: 36000, journalSeconds: 0, approvedHours: null, re: 0 })!;
    expect(e.netHours).toBe(10);
    expect(e.usdPerHour).toBe(config.economy.basePayoutUsd);
    expect(e.px).toBe(Math.round((10 * config.economy.basePayoutUsd) / config.economy.pixelValueUsd));
  });
  test("update ship subtracts hours already paid out, never below zero", () => {
    const e = projectEstimate({ htSeconds: 7200, journalSeconds: 3600, approvedHours: 2, re: 1875 })!;
    expect(e.netHours).toBe(1);
    expect(e.usdPerHour).toBe(payoutUsdPerHour(1875));
    expect(projectEstimate({ htSeconds: 3600, journalSeconds: 0, approvedHours: 5, re: 0 })!.px).toBe(0);
  });
  test("garbage inputs don't produce NaN", () => {
    expect(usdPerHourFor("nope")).toBe(config.economy.basePayoutUsd);
    expect(usdPerHourFor(-100)).toBe(config.economy.basePayoutUsd);
    expect(usdPerHourFor(1e9)).toBe(config.economy.maxPayoutUsd);
  });
});

describe("display helpers", () => {
  test("shop hours hint", () => {
    const r = earnRates();
    expect(hoursHint(400, r)).toBe(
      `${400 / r.loPxPerHour}h at $${r.loUsd}/h → ${Math.round((400 / r.hiPxPerHour) * 10) / 10}h at $${r.hiUsd}/h`,
    );
    expect(hoursHint(0, r)).toBe("");
    expect(hoursHint(100, null)).toBe("");
  });
  test("funding hours note", () => {
    expect(fundingHoursText(40, 4)).toContain("~10.0h shipped at your current rate ($4.00/hr)");
    expect(fundingHoursText(0, 4)).toBe("");
    expect(fundingHoursText(40, null)).toBe("");
  });
});
