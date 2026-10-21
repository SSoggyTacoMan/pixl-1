import { beforeEach, describe, expect, test } from "bun:test";
import { clearFraudyCache, fraudyCheckAi, fraudyHours } from "./fraudy";

const ok = (body: object) => async () => new Response(JSON.stringify(body), { status: 200 });

beforeEach(() => clearFraudyCache());

describe("fraudyCheckAi", () => {
  test("maps Fraudy's seconds and sends the key as a bearer token", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const value = await fraudyCheckAi(1234, "my-website", {
      apiKey: "fraudy_test",
      fetchImpl: async (url, init) => {
        seen = { url, init };
        return new Response(
          JSON.stringify({ human_seconds: 36000, ai_seconds: 10800, recommended_deflation_seconds: 7200 }),
          { status: 200 },
        );
      },
    });
    expect(value).toEqual({ humanSeconds: 36000, aiSeconds: 10800, deflationSeconds: 7200 });
    expect(seen!.url).toBe("https://fraudy.hackclub.com/api/v1/check-ai");
    expect((seen!.init.headers as Record<string, string>).Authorization).toBe("Bearer fraudy_test");
    expect(JSON.parse(String(seen!.init.body))).toEqual({ hackatime_id: 1234, project: "my-website" });
  });

  test("returns null without a key or a usable id, without calling Fraudy", async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      return new Response("{}");
    };
    expect(await fraudyCheckAi(1234, "p", { apiKey: undefined, fetchImpl })).toBeNull();
    expect(await fraudyCheckAi("abc", "p", { apiKey: "k", fetchImpl })).toBeNull();
    expect(await fraudyCheckAi(0, "p", { apiKey: "k", fetchImpl })).toBeNull();
    expect(await fraudyCheckAi(5, "", { apiKey: "k", fetchImpl })).toBeNull();
    expect(calls).toBe(0);
  });

  test("never throws: an error status or a network failure gives null", async () => {
    const bad = await fraudyCheckAi(1, "p", {
      apiKey: "k",
      fetchImpl: async () => new Response(JSON.stringify({ error: { code: "forbidden" } }), { status: 403 }),
    });
    expect(bad).toBeNull();
    clearFraudyCache();
    const down = await fraudyCheckAi(1, "p", {
      apiKey: "k",
      fetchImpl: async () => {
        throw new Error("boom");
      },
    });
    expect(down).toBeNull();
  });

  test("caches a result for a few minutes", async () => {
    let calls = 0;
    let t = 1000;
    const deps = {
      apiKey: "k",
      now: () => t,
      fetchImpl: async () => {
        calls++;
        return ok({ human_seconds: 3600, ai_seconds: 0, recommended_deflation_seconds: 0 })();
      },
    };
    await fraudyCheckAi(7, "p", deps);
    await fraudyCheckAi(7, "p", deps);
    expect(calls).toBe(1);
    t += 6 * 60 * 1000;
    await fraudyCheckAi(7, "p", deps);
    expect(calls).toBe(2);
  });
});

describe("fraudyHours", () => {
  test("rounds to one decimal", () => {
    expect(fraudyHours(36000)).toBe("10");
    expect(fraudyHours(5400)).toBe("1.5");
    expect(fraudyHours(0)).toBe("0");
  });
});
