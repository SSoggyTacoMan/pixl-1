import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { deleteAirtableRecords } from "./airtable";

const A = "recAAAAAAAAAAAAAA";
const B = "recBBBBBBBBBBBBBB";
const C = "recCCCCCCCCCCCCCC";

function fakeFetch(statusById: Record<string, number | "throw">) {
  const calls: { url: string; method?: string }[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method });
    const id = url.split("/").pop()!;
    const status = statusById[id];
    if (status === "throw") throw new Error("network down");
    return new Response(null, { status: status ?? 200 });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("deleteAirtableRecords", () => {
  const saved = process.env.AIRTABLE_PIXL_YSWS_UNIFIED_TOKEN;
  beforeEach(() => {
    process.env.AIRTABLE_PIXL_YSWS_UNIFIED_TOKEN = "test-token";
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.AIRTABLE_PIXL_YSWS_UNIFIED_TOKEN;
    else process.env.AIRTABLE_PIXL_YSWS_UNIFIED_TOKEN = saved;
  });

  test("deletes each record once and counts a 404 as already gone", async () => {
    const { impl, calls } = fakeFetch({ [B]: 404 });
    const r = await deleteAirtableRecords([A, B, A], impl);
    expect(r).toEqual({ deleted: [A, B], failed: [] });
    expect(calls.map((c) => c.method)).toEqual(["DELETE", "DELETE"]);
  });

  test("reports server errors and network failures without stopping", async () => {
    const { impl } = fakeFetch({ [A]: 500, [B]: "throw" });
    const r = await deleteAirtableRecords([A, B, C], impl);
    expect(r.deleted).toEqual([C]);
    expect(r.failed).toEqual([A, B]);
  });

  test("never sends a malformed id to Airtable", async () => {
    const { impl, calls } = fakeFetch({});
    const r = await deleteAirtableRecords(["../tbl", A], impl);
    expect(calls).toHaveLength(1);
    expect(r.failed).toEqual(["../tbl"]);
  });

  test("fails every record when the token is missing", async () => {
    delete process.env.AIRTABLE_PIXL_YSWS_UNIFIED_TOKEN;
    const { impl, calls } = fakeFetch({});
    const r = await deleteAirtableRecords([A], impl);
    expect(calls).toHaveLength(0);
    expect(r.failed).toEqual([A]);
    expect(r.error).toContain("not set");
  });
});
