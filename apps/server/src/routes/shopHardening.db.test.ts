// Migration 0217 against a real Postgres: buy_shop_item's stock-choice and
// in-lock Beacon checks (L2, L3) and the one-vote-per-round constraint (L5).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const adminUrl = process.env.PIXL_TEST_DATABASE_URL;

if (!adminUrl) {
  test("0217 hardening tests need a Postgres", () => {
    throw new Error(
      "PIXL_TEST_DATABASE_URL is not set. PIXL_TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/postgres bun test src/routes/shopHardening.db.test.ts",
    );
  });
} else {
  const dbName = `pixl_hardening_${randomBytes(4).toString("hex")}`;
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
  const testUrl = new URL(adminUrl);
  testUrl.pathname = `/${dbName}`;
  let db: postgres.Sql;

  async function createUser(pixels = 100000): Promise<string> {
    const [row] = await db<{ id: string }[]>`
      insert into users (oauth_provider, oauth_id, display_name, pixels)
      values ('test', ${randomBytes(6).toString("hex")}, 'tester', ${pixels})
      returning id`;
    return row.id;
  }

  async function createItem(opts: { beacon?: boolean } = {}): Promise<number> {
    const [row] = await db<{ id: number }[]>`
      insert into shop_items (name, price, active, beacon_locked)
      values (${`item-${randomBytes(4).toString("hex")}`}, 100, true, ${opts.beacon ?? false})
      returning id`;
    return row.id;
  }

  async function buy(userId: string, itemId: number, stockChoice = "", config: Record<string, unknown> | null = null) {
    const [row] = await db<{ r: { ok: boolean; error?: string } }[]>`
      select buy_shop_item(p_user_id => ${userId}::uuid, p_item_id => ${itemId}::int, p_option => '',
        p_config => ${config === null ? null : JSON.stringify(config)}::jsonb,
        p_stock_choice => ${stockChoice}::text) as r`;
    return row.r;
  }

  // A configurator item: the player site sends only `config` for these,
  // never a stockChoice.
  async function createConfigItem(): Promise<number> {
    const id = await createItem();
    const options = { base_price: 100, groups: [{ name: "Signer", type: "single", choices: [{ label: "Ridit" }, { label: "Gabin" }] }] };
    await db`update shop_items set config_options = ${JSON.stringify(options)}::jsonb where id = ${id}`;
    return id;
  }

  async function remaining(itemId: number, choice: string): Promise<number> {
    const [s] = await db<{ remaining: number }[]>`select remaining from shop_option_stock where item_id = ${itemId} and choice = ${choice}`;
    return s.remaining;
  }

  beforeAll(async () => {
    await admin.unsafe(`create database ${dbName}`);
    db = postgres(testUrl.toString(), { max: 4, onnotice: () => {} });
    const dir = join(import.meta.dirname, "..", "..", "drizzle");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort())
      await db.unsafe(readFileSync(join(dir, file), "utf8"));
  }, 120_000);

  afterAll(async () => {
    await db?.end();
    await admin.unsafe(`drop database if exists ${dbName} with (force)`);
    await admin.end();
  });

  describe("L2: stock-pooled items need a stock choice", () => {
    test("no choice is invalid_config and nothing is charged", async () => {
      const user = await createUser();
      const item = await createItem();
      await db`insert into shop_option_stock (item_id, choice, total, remaining) values (${item}, 'Signed', 5, 5)`;
      expect((await buy(user, item)).error).toBe("invalid_config");
      const [u] = await db<{ pixels: string }[]>`select pixels from users where id = ${user}`;
      expect(Number(u.pixels)).toBe(100000);
      const ok = await buy(user, item, "Signed");
      expect(ok.ok).toBe(true);
      const [s] = await db<{ remaining: number }[]>`select remaining from shop_option_stock where item_id = ${item}`;
      expect(s.remaining).toBe(4);
    });

    test("a configurator item takes its stock choice from the config picks", async () => {
      const user = await createUser();
      const item = await createConfigItem();
      await db`insert into shop_option_stock (item_id, choice, total, remaining) values (${item}, 'Ridit', 5, 5), (${item}, 'Gabin', 5, 5)`;
      expect((await buy(user, item, "", { Signer: "Gabin" })).ok).toBe(true);
      expect(await remaining(item, "Gabin")).toBe(4);
      expect(await remaining(item, "Ridit")).toBe(5);
      // No pick at all resolves to the group's first choice, like the price does.
      expect((await buy(user, item, "", {})).ok).toBe(true);
      expect(await remaining(item, "Ridit")).toBe(4);
    });

    test("a configurator item whose pool isn't keyed by its config still sells", async () => {
      const user = await createUser();
      const item = await createConfigItem();
      await db`insert into shop_option_stock (item_id, choice, total, remaining) values (${item}, 'Unrelated', 5, 5)`;
      expect((await buy(user, item, "", { Signer: "Ridit" })).ok).toBe(true);
      expect(await remaining(item, "Unrelated")).toBe(5);
    });
  });

  describe("L3: Beacon unlocks are checked under the buyer's row lock", () => {
    test("one Beacon project unlocks exactly one item, even with parallel purchases", async () => {
      const user = await createUser();
      await db`insert into projects (user_id, name, is_peak) values (${user}, 'beacon', true)`;
      const a = await createItem({ beacon: true });
      const b = await createItem({ beacon: true });
      const results = await Promise.all([buy(user, a), buy(user, b)]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.filter((r) => r.error === "locked")).toHaveLength(1);
    });

    test("no Beacon project, no purchase", async () => {
      const user = await createUser();
      expect((await buy(user, await createItem({ beacon: true }))).error).toBe("locked");
    });
  });

  describe("L5: one vote per round", () => {
    test("round_id comes from the entry and a second vote in the round conflicts", async () => {
      const voter = await createUser();
      const [round] = await db<{ id: number }[]>`insert into show_n_tell_rounds (title, is_open) values ('r', false) returning id`;
      const [e1] = await db<{ id: number }[]>`insert into show_n_tell_entries (round_id, custom_name) values (${round.id}, 'one') returning id`;
      const [e2] = await db<{ id: number }[]>`insert into show_n_tell_entries (round_id, custom_name) values (${round.id}, 'two') returning id`;
      await db`insert into show_n_tell_votes (entry_id, user_id) values (${e1.id}, ${voter})`;
      const [v] = await db<{ round_id: number }[]>`select round_id from show_n_tell_votes where user_id = ${voter}`;
      expect(v.round_id).toBe(round.id);
      await db`insert into show_n_tell_votes (entry_id, user_id, round_id) values (${e2.id}, ${voter}, ${round.id})
        on conflict (round_id, user_id) do update set entry_id = excluded.entry_id`;
      const rows = await db<{ entry_id: number }[]>`select entry_id from show_n_tell_votes where user_id = ${voter}`;
      expect([...rows]).toEqual([{ entry_id: e2.id }]);
    });
  });
}
