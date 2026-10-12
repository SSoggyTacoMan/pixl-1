import { expect, test } from "bun:test";
import { sql } from "./pgCompat";

test("sql is callable as a tagged template, not only through its properties", () => {
  expect(typeof sql).toBe("function");
});
