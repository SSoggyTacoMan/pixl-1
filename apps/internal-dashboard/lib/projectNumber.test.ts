import { describe, expect, test } from "bun:test";
import { projectNumber } from "./projectNumber";

describe("projectNumber", () => {
  test("plain and hash-prefixed numbers", () => {
    expect(projectNumber("747")).toBe(747);
    expect(projectNumber("#747")).toBe(747);
    expect(projectNumber("  # 12 ")).toBe(12);
  });

  test("names, mixed text and junk are not numbers", () => {
    expect(projectNumber("sprig")).toBeNull();
    expect(projectNumber("747 sprig")).toBeNull();
    expect(projectNumber("7.5")).toBeNull();
    expect(projectNumber("-3")).toBeNull();
    expect(projectNumber("")).toBeNull();
    expect(projectNumber(undefined)).toBeNull();
  });

  test("zero and absurdly long numbers are not ids", () => {
    expect(projectNumber("0")).toBeNull();
    expect(projectNumber("12345678901234")).toBeNull();
  });
});
