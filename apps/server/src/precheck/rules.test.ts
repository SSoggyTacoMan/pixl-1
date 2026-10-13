import { describe, expect, test } from "bun:test";
import {
  BLOCKING,
  dmFor,
  evaluate,
  findReadme,
  hardwareFileMisses,
  parseAiAnswer,
  parseGithubRepo,
  readmeImages,
  requirementsFor,
  reviewNoteFor,
  scopeFiles,
  type AiAnswer,
} from "./rules";

describe("parseGithubRepo", () => {
  test("plain, .git and subdirectory URLs", () => {
    expect(parseGithubRepo("https://github.com/a/b")).toEqual({ owner: "a", repo: "b", ref: "HEAD", path: "" });
    expect(parseGithubRepo("https://github.com/a/b.git")?.repo).toBe("b");
    expect(parseGithubRepo("https://github.com/a/b/tree/main/hw/pcb")).toEqual({
      owner: "a",
      repo: "b",
      ref: "main",
      path: "hw/pcb",
    });
  });

  test("anything that isn't a GitHub repo is skipped", () => {
    for (const u of ["https://gitlab.com/a/b", "https://github.com/a", "not a url", "ftp://github.com/a/b", "https://github.com/a/b%2F..%2Fc"])
      expect(parseGithubRepo(u)).toBeNull();
  });
});

test("scopeFiles keeps only the project's folder", () => {
  expect(scopeFiles(["hw/a.step", "sw/b.py", "README.md"], "hw")).toEqual(["a.step"]);
  expect(scopeFiles(["a", "b"], "")).toEqual(["a", "b"]);
});

test("findReadme prefers a top-level markdown README", () => {
  expect(findReadme(["docs/README.md", "readme.txt", "README.md"])).toBe("README.md");
  expect(findReadme(["Readme.txt"])).toBe("Readme.txt");
  expect(findReadme(["docs/README.md"])).toBeNull();
});

describe("readmeImages", () => {
  test("markdown, html and reference images count", () => {
    expect(readmeImages("![shot](docs/shot.png)")).toEqual(["docs/shot.png"]);
    expect(readmeImages('<img width="300" src="https://i.imgur.com/x.png">')).toHaveLength(1);
    expect(readmeImages("![demo][1]\n\n[1]: ./demo.gif")).toEqual(["./demo.gif"]);
  });

  test("badges don't count", () => {
    const md = [
      "![build](https://github.com/a/b/actions/workflows/ci.yml/badge.svg)",
      "![license](https://img.shields.io/badge/license-MIT-blue)",
      "![time](https://hackatime-badge.hackclub.com/U123/proj)",
    ].join("\n");
    expect(readmeImages(md)).toEqual([]);
  });

  test("plain links aren't images", () => {
    expect(readmeImages("[screenshot](shot.png)")).toEqual([]);
  });
});

describe("hardwareFileMisses", () => {
  const complete = ["bom.csv", "case.step", "case.f3d", "pcb/board.kicad_pcb"];
  test("a complete repo misses nothing", () => {
    expect(hardwareFileMisses(complete, "")).toEqual([]);
  });

  test("each missing file is reported", () => {
    expect(hardwareFileMisses(["firmware/main.c"], "")).toEqual(["bom_missing", "step_missing", "cad_source_missing"]);
  });

  test("an Onshape link or a CSV bom_url stands in", () => {
    expect(hardwareFileMisses(["a.step"], "CAD: https://cad.onshape.com/documents/x", { bomUrl: "https://x.com/bom.csv" })).toEqual([]);
  });
});

const softwareAsked = requirementsFor("software", false);
const answer = (over: Partial<AiAnswer["requirements"]> = {}): AiAnswer => ({
  requirements: {
    what_it_is: { met: true, confident: true, evidence: "" },
    built_with: { met: true, confident: true, evidence: "" },
    how_to_run: { met: true, confident: true, evidence: "" },
    ...over,
  },
  notes: ["repo is a bit messy"],
  summary: "A todo app.",
});

describe("evaluate", () => {
  test("a complete software project has nothing blocking but keeps notes", () => {
    const f = evaluate({ kind: "software", readme: "![s](s.png)", files: ["README.md"], ai: answer(), asked: softwareAsked });
    expect(f.blocking).toEqual([]);
    expect(f.notes).toEqual(["repo is a bit messy"]);
  });

  test("no README is blocking, but only when the file list proves it", () => {
    expect(evaluate({ kind: "software", readme: null, files: ["main.py"], ai: null, asked: softwareAsked }).blocking).toEqual([
      "readme_missing",
    ]);
    const unknown = evaluate({ kind: "software", readme: null, files: null, ai: null, asked: softwareAsked });
    expect(unknown.blocking).toEqual([]);
    expect(unknown.skipped.length).toBeGreaterThan(0);
  });

  test("a README with only badges is blocking", () => {
    const f = evaluate({ kind: "software", readme: "![ci](https://img.shields.io/x)", files: [], ai: answer(), asked: softwareAsked });
    expect(f.blocking).toEqual(["readme_no_image"]);
  });

  test("only a confident AI miss blocks", () => {
    const unsure = evaluate({
      kind: "software",
      readme: "![s](s.png)",
      files: [],
      ai: answer({ how_to_run: { met: false, confident: false, evidence: "" } }),
      asked: softwareAsked,
    });
    expect(unsure.blocking).toEqual([]);
    const sure = evaluate({
      kind: "software",
      readme: "![s](s.png)",
      files: [],
      ai: answer({ how_to_run: { met: false, confident: true, evidence: "no setup steps" } }),
      asked: softwareAsked,
    });
    expect(sure.blocking).toEqual(["how_to_run"]);
  });

  test("hardware file checks are skipped, not failed, without a file list", () => {
    const f = evaluate({ kind: "hardware", readme: "![s](s.png)", files: null, ai: null, asked: requirementsFor("hardware", false) });
    expect(f.blocking).toEqual([]);
  });
});

describe("parseAiAnswer", () => {
  test("reads fenced JSON and drops unasked or malformed items", () => {
    const raw =
      '```json\n{"requirements":{"what_it_is":{"met":false,"confident":true,"evidence":"x"},"built_with":{"met":"no"},"bogus":{"met":false,"confident":true}},"notes":["a"],"summary":"s"}\n```';
    const a = parseAiAnswer(raw, softwareAsked)!;
    expect(Object.keys(a.requirements)).toEqual(["what_it_is"]);
    expect(a.notes).toEqual(["a"]);
  });

  test("garbage is null", () => {
    expect(parseAiAnswer("sorry, I can't", softwareAsked)).toBeNull();
  });
});

test("build_media is only asked for finished hardware builds", () => {
  expect(requirementsFor("hardware", false).map((r) => r.id)).not.toContain("build_media");
  expect(requirementsFor("hardware", true).map((r) => r.id)).toContain("build_media");
});

test("player-facing text is built from the fixed labels only", () => {
  const note = reviewNoteFor(["readme_no_image", "bom_missing"]);
  expect(note).toContain(BLOCKING.readme_no_image);
  expect(note).toContain(BLOCKING.bom_missing);
  const dm = dmFor("My &lt;thing&gt;", "https://pixl.hackclub.com/projects/1", ["how_to_run"]);
  expect(dm).toContain(BLOCKING.how_to_run);
  expect(dm).toContain("https://pixl.hackclub.com/projects/1");
  expect(dm).not.toMatch(/<[!@#]/);
});
