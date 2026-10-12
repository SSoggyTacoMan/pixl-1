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
    expect(
      parseStaffSettings({ theme: "light", accent: "blue", compact: true, confetti: true, reviewPanelWidth: 620 }),
    ).toEqual({ theme: "light", accent: "blue", compact: true, confetti: true, sound: true, reviewPanelWidth: 620 });
    expect(parseStaffSettings({ theme: "neon", accent: "javascript:alert(1)", extra: 1 })).toEqual(
      DEFAULT_STAFF_SETTINGS,
    );
  });

  test("the review sound is on unless it is exactly false", () => {
    expect(parseStaffSettings({}).sound).toBe(true);
    expect(parseStaffSettings({ confetti: true }).sound).toBe(true);
    expect(parseStaffSettings({ sound: "false" }).sound).toBe(true);
    expect(parseStaffSettings({ sound: false }).sound).toBe(false);
  });

  test("review panel width is clamped to a sane range", () => {
    expect(parseStaffSettings({ reviewPanelWidth: 5 }).reviewPanelWidth).toBe(360);
    expect(parseStaffSettings({ reviewPanelWidth: 99999 }).reviewPanelWidth).toBe(1000);
    expect(parseStaffSettings({ reviewPanelWidth: "wide" }).reviewPanelWidth).toBe(460);
  });
});
