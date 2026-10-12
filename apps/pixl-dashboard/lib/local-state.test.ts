import { describe, expect, test } from "bun:test";
import { clearPlayerLocalState, journalDraftKey } from "./local-state";

class MemStorage {
  m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

describe("clearPlayerLocalState", () => {
  test("removes every journal draft and the tour keys, keeps device preferences", () => {
    const local = new MemStorage();
    const session = new MemStorage();
    for (const id of [1, 22, 333]) local.setItem(journalDraftKey(id), '{"content":"secret"}');
    local.setItem("pixl_tour_step", "3");
    local.setItem("pixl_onboarded", "1");
    local.setItem("pixl_theme_v2", "dark");
    local.setItem("pixl_font", "phantom");
    session.setItem("pixl_fp_shown", "1");
    session.setItem("other", "x");

    clearPlayerLocalState(local, session);

    expect([...local.m.keys()].sort()).toEqual(["pixl_font", "pixl_theme_v2"]);
    expect([...session.m.keys()]).toEqual(["other"]);
  });

  test("blocked storage never throws", () => {
    const broken = {
      get length(): number {
        throw new Error("SecurityError");
      },
      key: () => null,
      removeItem: () => {},
    };
    expect(() => clearPlayerLocalState(broken, null)).not.toThrow();
    expect(() => clearPlayerLocalState(null, null)).not.toThrow();
  });

  test("the draft key matches what the journal writes", () => {
    expect(journalDraftKey(42)).toBe("pixl_journal_draft_42");
  });
});

describe("logout wiring", () => {
  test("the LOG OUT form clears local player state before posting", async () => {
    const src = await Bun.file(new URL("../app/(shell)/shell-nav.tsx", import.meta.url)).text();
    expect(src).toMatch(/<form action="\/api\/auth\/logout" method="post" onSubmit=\{\(\) => clearPlayerLocalState\(\)\}>/);
  });
});
