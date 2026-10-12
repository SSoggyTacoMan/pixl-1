import { expect, test } from "bun:test";
import { outcomeFrom } from "./lib";

test("outcomeFrom", () => {
  expect(outcomeFrom("connected")).toBe("connected");
  expect(outcomeFrom("failed")).toBe("failed");
  expect(outcomeFrom(["failed", "connected"])).toBe("failed");
  expect(outcomeFrom("<script>")).toBeNull();
  expect(outcomeFrom(undefined)).toBeNull();
});
