import { describe, expect, test } from "bun:test";
import { buildFileTree, formatBytes } from "./fileTree";
import type { FileRow } from "./hackatimeFiles";

const row = (path: string, seconds: number): FileRow => ({
  path,
  seconds,
  aiSeconds: 0,
  bytes: null,
  status: "head",
});

describe("buildFileTree", () => {
  test("nests files and rolls seconds up", () => {
    const tree = buildFileTree([row("src/a.ts", 30), row("src/lib/b.ts", 60), row("README.md", 10)]);
    expect(tree.seconds).toBe(100);
    expect(tree.files.map((file) => file.name)).toEqual(["README.md"]);
    expect(tree.directories.map((dir) => dir.name)).toEqual(["src"]);
    expect(tree.directories[0]!.seconds).toBe(90);
    const lib = tree.directories[0]!.directories[0]!;
    expect(lib.name).toBe("lib");
    expect(lib.seconds).toBe(60);
  });

  test("compacts a chain of single-child directories", () => {
    const tree = buildFileTree([row("src/lib/deep/a.ts", 15)]);
    const src = tree.directories[0]!;
    expect(src.name).toBe("src/lib/deep");
    expect(src.files[0]!.name).toBe("a.ts");
  });

  test("sorts files and directories by name", () => {
    const tree = buildFileTree([row("b/x.ts", 1), row("a/x.ts", 2)]);
    expect(tree.directories.map((dir) => dir.name)).toEqual(["a", "b"]);
  });

  test("a directory called constructor cannot collide with an object key", () => {
    const tree = buildFileTree([row("constructor/a.ts", 1)]);
    expect(tree.directories[0]!.name).toBe("constructor");
  });
});

describe("formatBytes", () => {
  test("bytes, kilobytes and megabytes", () => {
    expect(formatBytes(10)).toBe("10 B");
    expect(formatBytes(1_536)).toBe("1.5 KB");
    expect(formatBytes(2_097_152)).toBe("2.0 MB");
  });
});
