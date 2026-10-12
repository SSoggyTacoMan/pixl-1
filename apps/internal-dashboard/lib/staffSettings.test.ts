import { describe, expect, test } from "bun:test";
import { DEFAULT_STAFF_SETTINGS, parseStaffSettings } from "./staffSettings";

describe("parseStaffSettings", () => {
  test("defaults when nothing is stored", () => {
    expect(parseStaffSettings(null)).toEqual(DEFAULT_STAFF_SETTINGS);
    expect(parseStaffSettings("nope")).toEqual(DEFAULT_STAFF_SETTINGS);
  });

  test("confetti is off unless it is exactly true", () => {
    expect(parseStaffSettings({}).confetti).toBe(false);
    expect(parseStaffSettings({ confetti: "true" }).confetti).toBe(false);
    expect(parseStaffSettings({ confetti: true }).confetti).toBe(true);
  });

  test("keeps valid values and drops unknown ones", () => {
    expect(parseStaffSettings({ theme: "light", accent: "blue", compact: true, confetti: true })).toEqual({
      theme: "light",
      accent: "blue",
      compact: true,
      confetti: true,
    });
    expect(parseStaffSettings({ theme: "neon", accent: "javascript:alert(1)", extra: 1 })).toEqual(
      DEFAULT_STAFF_SETTINGS,
    );
  });
});
