import { afterEach, describe, expect, mock, test } from "bun:test";
import {
  buildAirtableFields,
  duplicateOverrideNote,
  githubUsernameFromRepoUrl,
  groupProjectNote,
  newHoursOnly,
  pushProjectRecord,
} from "./airtable";

const baseInput = {
  repoUrl: "https://github.com/octocat/spoon-knife",
  demoUrl: "https://octocat.github.io/spoon-knife",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  imageUrl: "https://cdn.example.com/shot.png",
  description: "A pixel garden that grows with your commits.",
  approvedHours: 12.5,
  systemNote: "",
  birthday: "2009-04-12",
  addressLine1: "1 Analytical Engine Way",
  addressLine2: "",
  city: "London",
  state: "",
  country: "United Kingdom",
  zip: "SW1A 1AA",
  auditSections: {
    "TECHNICAL FEATURES": "Custom WebSocket sync, no framework.",
    "DEFLATION REASON": "",
    "AGE JUSTIFICATION": "",
    NOTES: "Clean ship, approved as claimed.",
  },
  hackatimeProjectDateRanges: "",
  submitterHackatimeId: "",
  lapseLinks: "",
  journalShareUrl: "",
};

describe("githubUsernameFromRepoUrl", () => {
  test("extracts the username from a github.com repo URL", () => {
    expect(githubUsernameFromRepoUrl("https://github.com/octocat/spoon-knife")).toBe("octocat");
  });

  test("returns empty string for a non-github URL", () => {
    expect(githubUsernameFromRepoUrl("https://octocat.itch.io/spoon-knife")).toBe("");
  });

  test("returns empty string for a malformed URL", () => {
    expect(githubUsernameFromRepoUrl("not a url")).toBe("");
  });
});

describe("buildAirtableFields", () => {
  test("never includes the Unified-submission automation field", () => {
    const fields = buildAirtableFields(baseInput);
    expect(Object.keys(fields)).not.toContain("Automation - Submit to Unified YSWS");
    expect(Object.keys(fields).some((k) => k.startsWith("Automation -"))).toBe(false);
  });

  test("maps the core project + person fields", () => {
    const fields = buildAirtableFields(baseInput);
    expect(fields["Code URL"]).toBe(baseInput.repoUrl);
    expect(fields["Playable URL"]).toBe(baseInput.demoUrl);
    expect(fields["First Name"]).toBe("Ada");
    expect(fields["Last Name"]).toBe("Lovelace");
    expect(fields["Email"]).toBe("ada@example.com");
    expect(fields["Description"]).toBe(baseInput.description);
    expect(fields["GitHub Username"]).toBe("octocat");
    expect(fields["Optional - Override Hours Spent"]).toBe(12.5);
  });

  test("wraps the screenshot as an Airtable attachment reference", () => {
    const fields = buildAirtableFields(baseInput);
    expect(fields["Screenshot"]).toEqual([{ url: baseInput.imageUrl }]);
  });

  test("omits the Screenshot field entirely when there is no image", () => {
    const fields = buildAirtableFields({ ...baseInput, imageUrl: "" });
    expect(fields).not.toHaveProperty("Screenshot");
  });

  test("maps address + birthday straight through (caller is responsible for decrypting first)", () => {
    const fields = buildAirtableFields(baseInput);
    expect(fields["Address (Line 1)"]).toBe("1 Analytical Engine Way");
    expect(fields["City"]).toBe("London");
    expect(fields["Country"]).toBe("United Kingdom");
    expect(fields["Birthday"]).toBe("2009-04-12");
  });

  test("splits the audit note sections into their matching Airtable fields", () => {
    const fields = buildAirtableFields(baseInput);
    expect(fields["Justification - Specific Technical Features"]).toBe(
      "Custom WebSocket sync, no framework.",
    );
    expect(fields["Justification - Additional Justification"]).toBe(
      "Clean ship, approved as claimed.",
    );
  });

  test("leaves Deflation/Age Justification blank when the audit note has no such section", () => {
    const fields = buildAirtableFields(baseInput);
    expect(fields["Justification - Deflation Justification"]).toBe("");
    expect(fields["Optional - Override Age Justification"]).toBe("");
  });

  test("carries the duplicate-check system note through when present", () => {
    const fields = buildAirtableFields({
      ...baseInput,
      systemNote: "Matches an existing ship in the cross-YSWS archive.",
    });
    expect(fields["Optional - Override Duplicate Justification"]).toBe(
      "Matches an existing ship in the cross-YSWS archive.",
    );
  });

  test("fields with no Pixl source stay unset rather than empty strings", () => {
    const fields = buildAirtableFields(baseInput);
    expect(fields).not.toHaveProperty("How did you hear about this?");
    expect(fields).not.toHaveProperty("What are we doing well?");
    expect(fields).not.toHaveProperty("How can we improve?");
    expect(fields).not.toHaveProperty("Justification - Hackatime Project Name(s) + Date Range(s)");
    expect(fields).not.toHaveProperty("Justification - Submitter Hackatime ID");
    expect(fields).not.toHaveProperty("Justification - Lapse Links, comma-separated");
    expect(fields).not.toHaveProperty("Justification - Alternate Tracking Method");
  });

  test("sets the Hackatime project/lapse fields when present", () => {
    const fields = buildAirtableFields({
      ...baseInput,
      hackatimeProjectDateRanges: "spoon-knife-game 8/1/2026-8/10/2026",
      submitterHackatimeId: "25659",
      lapseLinks: "https://lapse.hackclub.com/a, https://lapse.hackclub.com/b",
    });
    expect(fields["Justification - Hackatime Project Name(s) + Date Range(s)"]).toBe(
      "spoon-knife-game 8/1/2026-8/10/2026",
    );
    expect(fields["Justification - Submitter Hackatime ID"]).toBe("25659");
    expect(fields["Justification - Lapse Links, comma-separated"]).toBe(
      "https://lapse.hackclub.com/a, https://lapse.hackclub.com/b",
    );
  });

  test("sets the alternate-tracking-method field to the journal share URL when present", () => {
    const fields = buildAirtableFields({
      ...baseInput,
      journalShareUrl: "https://play.pixl.hackclub.com/journals/482/abc123",
    });
    expect(fields["Justification - Alternate Tracking Method"]).toBe(
      "https://play.pixl.hackclub.com/journals/482/abc123",
    );
  });
});

describe("pushProjectRecord", () => {
  const originalFetch = global.fetch;
  const originalToken = process.env.AIRTABLE_PIXL_YSWS_UNIFIED_TOKEN;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.AIRTABLE_PIXL_YSWS_UNIFIED_TOKEN;
    else process.env.AIRTABLE_PIXL_YSWS_UNIFIED_TOKEN = originalToken;
  });

  test("fails clearly when the token is not set", async () => {
    delete process.env.AIRTABLE_PIXL_YSWS_UNIFIED_TOKEN;
    const result = await pushProjectRecord({ "Code URL": "https://github.com/a/b" }, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("AIRTABLE_PIXL_YSWS_UNIFIED_TOKEN");
  });

  test("POSTs to create a new record when no existing ID is given", async () => {
    process.env.AIRTABLE_PIXL_YSWS_UNIFIED_TOKEN = "test-token";
    let capturedUrl = "";
    let capturedMethod = "";
    global.fetch = mock(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method ?? "";
      return new Response(JSON.stringify({ id: "recNEW123" }), { status: 200 });
    }) as unknown as typeof fetch;
    const result = await pushProjectRecord({ "Code URL": "https://github.com/a/b" }, null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.recordId).toBe("recNEW123");
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).not.toContain("recNEW123");
  });

  test("PATCHes the existing record when an ID is given", async () => {
    process.env.AIRTABLE_PIXL_YSWS_UNIFIED_TOKEN = "test-token";
    let capturedUrl = "";
    let capturedMethod = "";
    global.fetch = mock(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method ?? "";
      return new Response(JSON.stringify({ id: "recEXISTING" }), { status: 200 });
    }) as unknown as typeof fetch;
    const result = await pushProjectRecord({ "Code URL": "https://github.com/a/b" }, "recEXISTING");
    expect(result.ok).toBe(true);
    expect(capturedMethod).toBe("PATCH");
    expect(capturedUrl).toContain("recEXISTING");
  });

  test("surfaces a network failure without throwing", async () => {
    process.env.AIRTABLE_PIXL_YSWS_UNIFIED_TOKEN = "test-token";
    global.fetch = mock(async () => {
      throw new Error("network unreachable");
    }) as unknown as typeof fetch;
    const result = await pushProjectRecord({ "Code URL": "https://github.com/a/b" }, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("network unreachable");
  });

  test("handles a non-JSON error body from Airtable without throwing", async () => {
    process.env.AIRTABLE_PIXL_YSWS_UNIFIED_TOKEN = "test-token";
    global.fetch = mock(async () => new Response("<html>502 Bad Gateway</html>", { status: 502 })) as unknown as typeof fetch;
    const result = await pushProjectRecord({ "Code URL": "https://github.com/a/b" }, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("502");
  });

  test("treats a 2xx response missing an id as a failure", async () => {
    process.env.AIRTABLE_PIXL_YSWS_UNIFIED_TOKEN = "test-token";
    global.fetch = mock(async () => new Response(JSON.stringify({}), { status: 200 })) as unknown as typeof fetch;
    const result = await pushProjectRecord({ "Code URL": "https://github.com/a/b" }, null);
    expect(result.ok).toBe(false);
  });

  test("surfaces Airtable's own error message on a 4xx response", async () => {
    process.env.AIRTABLE_PIXL_YSWS_UNIFIED_TOKEN = "test-token";
    global.fetch = mock(
      async () =>
        new Response(JSON.stringify({ error: { message: "Invalid field name" } }), { status: 422 }),
    ) as unknown as typeof fetch;
    const result = await pushProjectRecord({ "Code URL": "https://github.com/a/b" }, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Invalid field name");
  });
});

describe("groupProjectNote", () => {
  test("names every submitter in a group project", () => {
    expect(groupProjectNote(["Andrei Pop", "David Boltong"])).toBe(
      "This is a group project, submitted separately by each member (one row per person, with their own hours). Submitters: Andrei Pop and David Boltong.",
    );
    expect(groupProjectNote(["Ada", "Bo", "Cy"])).toContain("Submitters: Ada, Bo and Cy.");
  });

  test("says nothing for a solo project", () => {
    expect(groupProjectNote([])).toBe("");
    expect(groupProjectNote(["Ada"])).toBe("");
  });

  test("ignores blank and repeated names, so two blanks are not a group", () => {
    expect(groupProjectNote(["Ada", "", "  "])).toBe("");
    expect(groupProjectNote(["Ada", "Ada"])).toBe("");
    expect(groupProjectNote(["Ada", "", "Bo"])).toContain("Submitters: Ada and Bo.");
  });
});

describe("duplicateOverrideNote", () => {
  test("group sentence first, then the existing duplicate-detection note", () => {
    const out = duplicateOverrideNote("Matches another YSWS submission.", ["Ada", "Bo"]);
    expect(out.startsWith("This is a group project")).toBe(true);
    expect(out.endsWith("Matches another YSWS submission.")).toBe(true);
  });

  test("keeps just the existing note for a solo project", () => {
    expect(duplicateOverrideNote("Matches another YSWS submission.", ["Ada"])).toBe("Matches another YSWS submission.");
  });

  test("is empty when there is nothing to say", () => {
    expect(duplicateOverrideNote("", ["Ada"])).toBe("");
    expect(duplicateOverrideNote("  ", [])).toBe("");
  });

  test("a group project fills the Airtable field, a solo one leaves it out", () => {
    const group = buildAirtableFields({ ...baseInput, systemNote: duplicateOverrideNote("", ["Ada", "Bo"]) });
    expect(group["Optional - Override Duplicate Justification"]).toContain("Submitters: Ada and Bo.");
    const solo = buildAirtableFields({ ...baseInput, systemNote: duplicateOverrideNote("", ["Ada"]) });
    expect("Optional - Override Duplicate Justification" in solo).toBe(false);
  });
});

describe("newHoursOnly", () => {
  test("a first approval keeps the full hours", () => {
    expect(newHoursOnly(5.8, 0)).toBe(5.8);
  });

  test("an update record carries only the hours added since the last approval", () => {
    expect(newHoursOnly(9, 5.8)).toBe(3.2);
  });

  test("never goes negative when a deflation drops the total below the prior approval", () => {
    expect(newHoursOnly(4, 5.8)).toBe(0);
  });

  test("no approved hours stays null so Airtable falls back to its own default", () => {
    expect(newHoursOnly(null, 5.8)).toBeNull();
  });

  test("treats a missing or string prior (numeric column) as its number", () => {
    expect(newHoursOnly(9, null)).toBe(9);
    expect(newHoursOnly(9, "5.8" as unknown as number)).toBe(3.2);
  });
});
