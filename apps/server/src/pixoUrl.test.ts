import { afterEach, expect, test } from "bun:test";
import { PIXO_INTERNAL_URL, externalDmUrl, pixorpheusUrl } from "./pixoUrl.js";

const saved = { p: process.env.PIXORPHEUS_URL, d: process.env.EXTERNAL_DM_URL };
afterEach(() => {
  if (saved.p === undefined) delete process.env.PIXORPHEUS_URL;
  else process.env.PIXORPHEUS_URL = saved.p;
  if (saved.d === undefined) delete process.env.EXTERNAL_DM_URL;
  else process.env.EXTERNAL_DM_URL = saved.d;
});

test("defaults to Pixo's in-cluster address", () => {
  delete process.env.PIXORPHEUS_URL;
  delete process.env.EXTERNAL_DM_URL;
  expect(PIXO_INTERNAL_URL).toBe("http://pixl-pixorpheus.ysws-pixl.svc.cluster.local:3000");
  expect(pixorpheusUrl()).toBe(PIXO_INTERNAL_URL);
  expect(externalDmUrl()).toBe(`${PIXO_INTERNAL_URL}/api/external/dm`);
});

test("env overrides win, trailing slashes trimmed", () => {
  process.env.PIXORPHEUS_URL = "https://pixo.example.com/";
  delete process.env.EXTERNAL_DM_URL;
  expect(pixorpheusUrl()).toBe("https://pixo.example.com");
  expect(externalDmUrl()).toBe("https://pixo.example.com/api/external/dm");
  process.env.EXTERNAL_DM_URL = "https://dm.example.com/x";
  expect(externalDmUrl()).toBe("https://dm.example.com/x");
});
