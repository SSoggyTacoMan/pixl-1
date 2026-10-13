// AI pre-check rules: what gets checked on a freshly shipped project before a
// human reviewer sees it, and what the player is told when it's sent back.
// Pure functions only (no DB, no network) so every rule is unit-testable;
// run.ts feeds them the repo and the model's answer.
//
// Only clear-cut misses send a project back (see BLOCKING below). Anything
// that's a judgment call - messy code, thin docs - is a note for the reviewer.
// The player-facing text is always built from the fixed labels here, never
// from model output, so a README can't make Pixo say something odd.

export type ProjectKind = "software" | "hardware";

export interface RepoRef {
  owner: string;
  repo: string;
  ref: string; // "HEAD" when the URL names no branch
  path: string; // subdirectory the project lives in, "" for the repo root
}

const SEGMENT = /^[A-Za-z0-9_.-]{1,100}$/;

// github.com/<owner>/<repo>[.git][/tree/<ref>[/<path>]]. Anything else
// (GitLab, a gist, a profile) returns null and the project skips the check.
export function parseGithubRepo(url: string): RepoRef | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.hostname.toLowerCase() !== "github.com" && u.hostname.toLowerCase() !== "www.github.com") return null;
  const parts = u.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, "");
  if (!SEGMENT.test(owner) || !SEGMENT.test(repo)) return null;
  let ref = "HEAD";
  let path = "";
  if (parts[2] === "tree" && parts[3]) {
    if (!SEGMENT.test(parts[3])) return null;
    ref = parts[3];
    const rest = parts.slice(4);
    if (rest.some((p) => !SEGMENT.test(p))) return null;
    path = rest.join("/");
  }
  // Anything else after the repo (/blob/..., /issues) still means the repo.
  return { owner, repo, ref, path };
}

// Repo files relative to the project's folder (the URL's subdirectory).
export function scopeFiles(paths: string[], dir: string): string[] {
  if (!dir) return paths;
  const prefix = `${dir.replace(/\/+$/, "")}/`;
  return paths.filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length));
}

// The README at the top of the project folder, if any.
export function findReadme(files: string[]): string | null {
  const top = files.filter((f) => !f.includes("/") && /^readme(\.(md|markdown|mdx|txt|rst))?$/i.test(f));
  return top.find((f) => /\.md$/i.test(f)) ?? top[0] ?? null;
}

const BADGE_HOSTS = [
  "img.shields.io",
  "shields.io",
  "badgen.net",
  "badge.fury.io",
  "forthebadge.com",
  "codecov.io",
  "travis-ci.org",
  "travis-ci.com",
  "circleci.com",
  "wakatime.com",
  "hackatime-badge.hackclub.com",
];

function isBadge(src: string): boolean {
  const s = src.trim().toLowerCase();
  if (/\/badge(\.svg)?(\?|$)/.test(s) || /badge\.svg/.test(s)) return true;
  try {
    const host = new URL(s).hostname;
    return BADGE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false; // relative path: a real image in the repo
  }
}

// Images in a README that actually show something: markdown ![..](src),
// reference-style ![..][id], and <img src>. Status badges don't count.
export function readmeImages(md: string): string[] {
  const out: string[] = [];
  for (const m of md.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?[^)]*\)/g)) out.push(m[1]);
  for (const m of md.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) out.push(m[1]);
  const refs = new Map<string, string>();
  for (const m of md.matchAll(/^\s*\[([^\]]+)\]:\s*<?(\S+?)>?(\s|$)/gm)) refs.set(m[1].toLowerCase(), m[2]);
  for (const m of md.matchAll(/!\[([^\]]*)\]\[([^\]]*)\]/g)) {
    const src = refs.get((m[2] || m[1]).toLowerCase());
    if (src) out.push(src);
  }
  return out.filter((src) => !isBadge(src));
}

const has = (files: string[], re: RegExp) => files.some((f) => re.test(f));

// Hardware file checks from docs/050-hardware-requirements.md that a file
// listing can settle without any judgment.
export function hardwareFileMisses(
  files: string[],
  readme: string,
  opts: { bomUrl?: string | null } = {},
): BlockingId[] {
  const misses: BlockingId[] = [];
  if (!has(files, /\.csv$/i) && !/\.csv(\?|$)/i.test(opts.bomUrl ?? "")) misses.push("bom_missing");
  if (!has(files, /\.(step|stp)$/i)) misses.push("step_missing");
  const cadSource = /\.(f3d|f3z|fcstd|sldprt|sldasm|blend|scad|ipt|iam|skp|3dm|catpart|prt)$/i;
  if (!has(files, cadSource) && !/onshape\.com/i.test(readme)) misses.push("cad_source_missing");
  return misses;
}

// --- What the model is asked --------------------------------------------

export interface Requirement {
  id: AiRequirementId;
  question: string;
}

export type AiRequirementId =
  | "what_it_is"
  | "built_with"
  | "how_to_run"
  | "how_to_use"
  | "why_made"
  | "pcb_or_wiring"
  | "firmware"
  | "build_media";

export function requirementsFor(kind: ProjectKind, finishedBuild: boolean): Requirement[] {
  if (kind === "software")
    return [
      { id: "what_it_is", question: "Does the README explain what the project is and what it does?" },
      { id: "built_with", question: "Does the README say what it was built with (languages, frameworks or libraries)?" },
      {
        id: "how_to_run",
        question:
          "Does the README explain how to set it up and run it (install/build/run steps), or link to where it's hosted for a web app?",
      },
    ];
  const reqs: Requirement[] = [
    { id: "what_it_is", question: "Does the README explain what the project is and what it does?" },
    { id: "how_to_use", question: "Does the README explain how to use it?" },
    { id: "why_made", question: "Does the README say why the maker built it?" },
    {
      id: "pcb_or_wiring",
      question:
        "If the project has electronics: does the repo contain PCB source files (KiCad, EasyEDA, gerbers) or a wiring diagram? Answer met=true if it has no electronics.",
    },
    {
      id: "firmware",
      question:
        "If the project has a microcontroller: does the repo contain its firmware source code? Answer met=true if it has no microcontroller.",
    },
  ];
  if (finishedBuild)
    reqs.push({
      id: "build_media",
      question: "Does the README include photos of the finished physical build and a link to a demo video?",
    });
  return reqs;
}

export interface AiRequirementAnswer {
  met: boolean;
  confident: boolean;
  evidence: string;
}

export interface AiAnswer {
  requirements: Partial<Record<AiRequirementId, AiRequirementAnswer>>;
  notes: string[];
  summary: string;
}

// Loose parse of the model's JSON. Anything malformed becomes "no answer"
// for that item, which never sends a project back.
export function parseAiAnswer(raw: string, asked: Requirement[]): AiAnswer | null {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(s.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  const reqIn = (obj.requirements ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const requirements: AiAnswer["requirements"] = {};
  for (const r of asked) {
    const a = reqIn[r.id];
    if (!a || typeof a.met !== "boolean") continue;
    requirements[r.id] = {
      met: a.met,
      confident: a.confident === true,
      evidence: String(a.evidence ?? "").slice(0, 300),
    };
  }
  const notes = Array.isArray(obj.notes)
    ? obj.notes.map((n) => String(n).slice(0, 300)).filter(Boolean).slice(0, 6)
    : [];
  return { requirements, notes, summary: String(obj.summary ?? "").slice(0, 600) };
}

// --- Findings and what the player is told -------------------------------

export type BlockingId =
  | "readme_missing"
  | "readme_no_image"
  | "bom_missing"
  | "step_missing"
  | "cad_source_missing"
  | AiRequirementId;

// The one place player-facing wording lives. Each line reads after
// "Here's what's missing:".
export const BLOCKING: Record<BlockingId, string> = {
  readme_missing: "Your repo has no README. Add a README.md that explains the project.",
  readme_no_image: "Your README has no screenshot or image of the project. Add at least one (status badges don't count).",
  bom_missing: "Your repo has no BOM. Add one as a .csv file with links and the total cost.",
  step_missing: "Your repo has no .step file of your 3D model.",
  cad_source_missing: "Your repo has no CAD source file (.f3d, .FCStd and so on) or Onshape link in the README.",
  what_it_is: "Your README doesn't explain what the project is and what it does.",
  built_with: "Your README doesn't say what you built it with (languages, frameworks, libraries).",
  how_to_run: "Your README doesn't explain how to set it up and run it.",
  how_to_use: "Your README doesn't explain how to use it.",
  why_made: "Your README doesn't say why you made it.",
  pcb_or_wiring: "Your repo has no PCB source files or wiring diagram.",
  firmware: "Your repo doesn't include the firmware source code.",
  build_media: "Your README needs photos of the finished build and a link to a demo video.",
};

export interface PrecheckFindings {
  blocking: BlockingId[];
  notes: string[];
  summary: string;
  evidence: Partial<Record<AiRequirementId, string>>;
  skipped: string[]; // checks that couldn't run (shown to the reviewer)
}

export interface PrecheckInputs {
  kind: ProjectKind;
  readme: string | null; // null = no README file
  files: string[] | null; // null = file list unavailable or truncated
  bomUrl?: string | null;
  ai: AiAnswer | null;
  asked: Requirement[];
}

export function evaluate(input: PrecheckInputs): PrecheckFindings {
  const blocking: BlockingId[] = [];
  const skipped: string[] = [];
  const evidence: PrecheckFindings["evidence"] = {};
  if (input.readme === null) {
    if (input.files) blocking.push("readme_missing");
    else skipped.push("README lookup");
  } else if (readmeImages(input.readme).length === 0) blocking.push("readme_no_image");

  if (input.kind === "hardware") {
    if (input.files) blocking.push(...hardwareFileMisses(input.files, input.readme ?? "", { bomUrl: input.bomUrl }));
    else skipped.push("hardware file checks (repo file list unavailable)");
  }

  if (input.ai && input.readme !== null) {
    for (const r of input.asked) {
      const a = input.ai.requirements[r.id];
      if (!a) continue;
      if (a.evidence) evidence[r.id] = a.evidence;
      // Only a confident miss is clear-cut enough to send a project back.
      if (!a.met && a.confident) blocking.push(r.id);
    }
  } else if (input.readme !== null) skipped.push("README content check (AI unavailable)");

  return {
    blocking: [...new Set(blocking)],
    notes: input.ai?.notes ?? [],
    summary: input.ai?.summary ?? "",
    evidence,
    skipped,
  };
}

// The review note the player sees on their project page.
export function reviewNoteFor(blocking: BlockingId[]): string {
  return [
    "Sent back automatically before review: your submission is missing things every Pixl project needs.",
    "",
    ...blocking.map((id) => `- ${BLOCKING[id]}`),
    "",
    "Fix these and ship again. If you think this check got it wrong, ship again as is and a human reviewer will take it from there.",
  ].join("\n");
}

// The Pixo DM. projectName must already be mrkdwn-escaped.
export function dmFor(projectName: string, projectUrl: string, blocking: BlockingId[]): string {
  return [
    `Hey! Your Pixl project *${projectName}* came back before review because a few required things are missing:`,
    "",
    ...blocking.map((id) => `• ${BLOCKING[id]}`),
    "",
    `Fix them, then ship it again from your project page: ${projectUrl}`,
    "",
    "This was an automatic check. If you think it got something wrong, ship again without changes and a human reviewer will look at it.",
  ].join("\n");
}
