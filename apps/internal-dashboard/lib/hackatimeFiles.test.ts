import { describe, expect, test } from "bun:test";
import {
  capFileRows,
  fallbackFileRows,
  fileSecondsFromHeartbeats,
  isMarkdown,
  normalizePath,
  pathTail,
  relativeEntity,
  resolveFileHours,
} from "./hackatimeFiles";

const P = ["my-proj"];
const hb = (time: number, entity: string, project = "my-proj", category = "") => ({
  time,
  entity,
  project,
  category,
});

describe("relativeEntity", () => {
  test("strips everything up to the project folder", () => {
    expect(relativeEntity("/Users/someone/code/my-proj/src/a.ts", P)).toEqual({ path: "src/a.ts", inProject: true });
  });
  test("works with Windows separators", () => {
    expect(relativeEntity("C:\\Users\\me\\my-proj\\src\\a.ts", P)).toEqual({ path: "src/a.ts", inProject: true });
  });
  test("a file outside the folder keeps only its last three parts, never the user name", () => {
    expect(relativeEntity("/Users/someone/.config/app/config.toml", P)).toEqual({
      path: ".config/app/config.toml",
      inProject: false,
    });
  });
  test("non-file entities such as a terminal command stay as they are", () => {
    expect(relativeEntity("npm run", P)).toEqual({ path: "npm run", inProject: false });
    expect(relativeEntity("", P).path).toBe("(unknown)");
  });
});

describe("isMarkdown", () => {
  test("md, mdx and markdown, any case", () => {
    expect(isMarkdown("TODO.md")).toBe(true);
    expect(isMarkdown("docs/a.MDX")).toBe(true);
    expect(isMarkdown("src/a.ts")).toBe(false);
  });
});

describe("normalizePath and pathTail", () => {
  test("normalizes separators, case, and dot segments", () => {
    expect(normalizePath("./SRC\\lib//a.ts")).toBe("src/lib/a.ts");
    expect(normalizePath("/Users/me/my-proj/../my-proj/src/a.ts")).toBe("users/me/my-proj/src/a.ts");
  });
  test("tail keeps the last three non-empty segments", () => {
    expect(pathTail("/Users/someone/.config/app/config.toml")).toBe(".config/app/config.toml");
    expect(pathTail("Terminal")).toBe("Terminal");
  });
});

describe("fileSecondsFromHeartbeats", () => {
  test("a gap inside a session belongs to the open file", () => {
    const { entitySeconds } = fileSecondsFromHeartbeats(
      [hb(1000, "/h/my-proj/a.ts"), hb(1030, "/h/my-proj/b.ts")],
      P,
    );
    expect(entitySeconds.get("/h/my-proj/a.ts")).toBe(30);
    expect(entitySeconds.get("/h/my-proj/b.ts")).toBeUndefined();
  });

  test("a session break's capped 120s follows the beat that opens the next session", () => {
    const { entitySeconds } = fileSecondsFromHeartbeats(
      [hb(1000, "/h/my-proj/a.ts"), hb(5000, "/h/my-proj/b.ts")],
      P,
    );
    expect(entitySeconds.get("/h/my-proj/a.ts")).toBeUndefined();
    expect(entitySeconds.get("/h/my-proj/b.ts")).toBe(120);
  });

  test("a session break credits the next beat instead of double-crediting the previous one", () => {
    const { entitySeconds } = fileSecondsFromHeartbeats(
      [hb(1000, "/h/my-proj/a.ts"), hb(1030, "/h/my-proj/b.ts"), hb(5000, "/h/my-proj/a.ts")],
      P,
    );
    expect(entitySeconds.get("/h/my-proj/a.ts")).toBe(30 + 120);
    expect(entitySeconds.get("/h/my-proj/b.ts")).toBeUndefined();
    expect([...entitySeconds.values()].reduce((sum, seconds) => sum + seconds, 0)).toBe(150);
  });

  test("only the linked project's heartbeats are used, case-insensitively", () => {
    const { entitySeconds } = fileSecondsFromHeartbeats(
      [hb(1, "/h/other/x.ts", "other"), hb(2, "/h/my-proj/a.ts", "My-Proj"), hb(30, "/h/my-proj/b.ts", "MY-PROJ")],
      P,
    );
    expect([...entitySeconds.keys()]).toEqual(["/h/my-proj/a.ts"]);
    expect(entitySeconds.get("/h/my-proj/a.ts")).toBe(28);
  });

  test("AI-coded seconds are reported without discounting the total", () => {
    const { entitySeconds, aiEntitySeconds } = fileSecondsFromHeartbeats(
      [
        hb(0, "/h/my-proj/a.ts", "my-proj", "ai coding"),
        hb(60, "/h/my-proj/b.ts"),
        hb(120, "/h/my-proj/b.ts"),
      ],
      P,
    );
    expect(entitySeconds.get("/h/my-proj/a.ts")).toBe(60);
    expect(entitySeconds.get("/h/my-proj/b.ts")).toBe(60);
    expect(aiEntitySeconds.get("/h/my-proj/a.ts")).toBe(60);
    expect(aiEntitySeconds.get("/h/my-proj/b.ts")).toBeUndefined();
  });
});

describe("resolveFileHours", () => {
  const HEAD = [
    { path: "src/a.ts", bytes: 100 },
    { path: "src/B.ts", bytes: 200 },
    { path: "docs/deep/notes.md", bytes: 50 },
    { path: "README.md", bytes: 10 },
  ];

  test("matches a local absolute path by suffix and keeps the repo's casing", () => {
    const rows = resolveFileHours(new Map([["/Users/me/proj/SRC/A.ts", 60]]), HEAD);
    const a = rows.find((row) => row.path === "src/a.ts")!;
    expect(a.status).toBe("head");
    expect(a.seconds).toBe(60);
    expect(a.bytes).toBe(100);
  });

  test("prefers the longest repo suffix", () => {
    const rows = resolveFileHours(
      new Map([["/home/me/src/lib/a.ts", 30]]),
      [
        { path: "lib/a.ts", bytes: 1 },
        { path: "src/lib/a.ts", bytes: 2 },
      ],
    );
    expect(rows.find((row) => row.seconds === 30)!.path).toBe("src/lib/a.ts");
  });

  test("falls back to the base name", () => {
    const rows = resolveFileHours(new Map([["/home/me/notes.md", 45]]), HEAD);
    expect(rows.find((row) => row.path === "docs/deep/notes.md")!.seconds).toBe(45);
  });

  test("merges several local paths onto one repository file", () => {
    const rows = resolveFileHours(
      new Map([
        ["/Users/a/proj/src/a.ts", 60],
        ["/Users/b/proj/src/a.ts", 30],
      ]),
      HEAD,
    );
    expect(rows.find((row) => row.path === "src/a.ts")!.seconds).toBe(90);
  });

  test("adds untouched default-branch files with zero seconds", () => {
    const rows = resolveFileHours(new Map([["/Users/me/proj/src/a.ts", 60]]), HEAD);
    expect(rows.map((row) => row.path).sort()).toEqual(["README.md", "docs/deep/notes.md", "src/B.ts", "src/a.ts"]);
    expect(rows.find((row) => row.path === "README.md")).toEqual({
      path: "README.md",
      seconds: 0,
      aiSeconds: 0,
      bytes: 10,
      status: "head",
    });
  });

  test("marks files gone from the default branch as history", () => {
    const rows = resolveFileHours(new Map([["/Users/me/proj/old.ts", 60]]), HEAD, ["old.ts"]);
    expect(rows.find((row) => row.path === "old.ts")!.status).toBe("history");
  });

  test("keeps an unmatched entity's tail and marks it none", () => {
    const rows = resolveFileHours(new Map([["/Users/someone/Terminal", 120]]), HEAD);
    expect(rows.find((row) => row.seconds === 120)).toEqual({
      path: "Users/someone/Terminal",
      seconds: 120,
      aiSeconds: 0,
      bytes: null,
      status: "none",
    });
  });

  test("carries AI seconds through resolution", () => {
    const rows = resolveFileHours(
      new Map([["/Users/me/proj/src/a.ts", 60]]),
      HEAD,
      [],
      new Map([["/Users/me/proj/src/a.ts", 30]]),
    );
    expect(rows.find((row) => row.path === "src/a.ts")!.aiSeconds).toBe(30);
  });

  test("sorts by seconds, biggest first", () => {
    const rows = resolveFileHours(
      new Map([
        ["/Users/me/proj/src/a.ts", 10],
        ["/Users/me/proj/src/B.ts", 50],
      ]),
      HEAD,
    );
    expect(rows[0]!.path).toBe("src/B.ts");
  });
});

describe("fallbackFileRows", () => {
  test("uses the project folder and merges the same path", () => {
    const rows = fallbackFileRows(
      new Map([
        ["/Users/a/my-proj/src/a.ts", 30],
        ["/Users/b/my-proj/src/a.ts", 20],
        ["npm run", 60],
      ]),
      new Map(),
      P,
    );
    expect(rows.find((row) => row.path === "src/a.ts")!.seconds).toBe(50);
    expect(rows.find((row) => row.path === "src/a.ts")!.status).toBe("history");
    expect(rows.find((row) => row.path === "npm run")!.status).toBe("none");
  });
});

describe("capFileRows", () => {
  test("keeps the biggest rows and reports the rest", () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({
      path: `f${i}.ts`,
      seconds: 100 - i * 10,
      aiSeconds: 0,
      bytes: null,
      status: "head" as const,
    }));
    const capped = capFileRows(rows, 3);
    expect(capped.map((row) => row.path)).toEqual(["f0.ts", "f1.ts", "f2.ts"]);
    expect(rows.length - capped.length).toBe(3);
  });
});
