// Guided-tour copy, ported from the old pixl.js ONBOARDING_STEPS and
// firstProjectSteps(). Bodies are structured text (plain strings plus
// { b } bold runs) rendered as React elements - never HTML strings, so a
// Trial name or description from the server can't inject markup.

export type Rich = Array<string | { b: string } | { br: true }>;

export interface TourStep {
  title: string;
  body: Rich;
  /** CSS id (without #) to spotlight; omitted = centered card. */
  target?: string;
  /** Route to open when the player presses Next on this step. */
  nextRoute?: string;
  /** Secondary button, usually a detour into the docs (the tour resumes). */
  extra?: { label: string; href: string };
}

export interface TourTrial {
  id: number;
  name: string;
  description: string;
  region: string | null;
  reward: string | null;
}

/** The auto-run "ship your first project" tour (synced to the server counter). */
export function onboardingSteps(basePxPerHour: number): TourStep[] {
  return [
    {
      title: "Let's ship your first project",
      body: ["This is your ", { b: "Builder Terminal" }, ", where every project lives. I'll walk you through making your first one and shipping it. Skip anytime."],
    },
    {
      target: "new-btn",
      title: "Open a new project",
      body: ["Hit ", { b: "Next" }, " and I'll open a fresh project for you."],
      nextRoute: "/projects/new",
    },
    {
      target: "f-name",
      title: "Name it",
      body: ["Say what you're building, like ", { b: "“My portfolio site”" }, " or ", { b: "“Weather bot”" }, ". Keep it short and real; you can rename it later."],
    },
    {
      target: "f-repo",
      title: "Link your code",
      body: [
        "Paste your ",
        { b: "GitHub repo" },
        " here (and a live demo link below, if you have one) so a reviewer can actually see what you built. No repo yet? There's a Git guide in the docs.",
      ],
      extra: { label: "Git guide", href: "/docs/git" },
    },
    {
      target: "ht-connect",
      title: "Track your time with Hackatime",
      body: [
        "This is the important one. ",
        { b: "Hackatime" },
        " logs the hours you spend building, and every shipped hour starts at ",
        { b: `${basePxPerHour} pixels` },
        ", climbing as you build up Restoration Energy. Connect it, then tick this project's boxes so your time counts.",
      ],
      extra: { label: "New to Hackatime? Read this", href: "/docs/hackatime" },
    },
    {
      target: "f-save",
      title: "Create it",
      body: ["Save your project. Now go build it for real, come back whenever you've made progress and journal what you did."],
    },
    {
      target: "s-ship",
      title: "Ship when it's ready",
      body: [
        "Once it runs and you've logged at least ",
        { b: "1 hour" },
        " on Hackatime, ship it for review. A reviewer credits you pixels + the prize. That's the whole loop.",
      ],
    },
    {
      title: "That's it, go build",
      body: ["Not sure where to start? I wrote a step-by-step on making your first project. Hit ", { b: "Done" }, " and get to it, right here in the Builder Terminal."],
      extra: { label: "Build your first project →", href: "/docs/first-project" },
    },
  ];
}

/** The first-project walkthrough (?onboard=first-project), aware of the active Trial. */
export function firstProjectSteps(trial: TourTrial | null, basePxPerHour: number): TourStep[] {
  const t = trial;
  const intro: TourStep = t
    ? {
        title: "Let's build your Trial",
        body: [
          "Pixo sent you over. You're building for ",
          { b: t.name },
          ", this is your ",
          { b: "Builder Terminal" },
          ". I'll get the project set up here, then you build it to the brief. Pop back to the game anytime; the checklist keeps your place.",
        ],
      }
    : {
        title: "Let's make your first project",
        body: ["Pixo sent you over. This is your ", { b: "Builder Terminal" }, ", I'll get your first project set up here. Pop back to the game anytime; the checklist there keeps your place."],
      };
  const brief: TourStep[] = t
    ? [
        {
          title: "What to build",
          body: [
            { b: t.name },
            t.region ? ` · ${t.region}` : "",
            { br: true },
            t.description,
            ...(t.reward ? ([{ br: true }, { b: "Reward:" }, ` ${t.reward}`] as Rich) : []),
            { br: true },
            "Build to this, you'll flag it for the Trial when you ship.",
          ],
        },
      ]
    : [];
  const nameStep: TourStep = {
    target: "f-name",
    title: "Name it",
    body: t
      ? ["Name your project for the Trial, something like ", { b: `“${t.name}”` }, ". Short and real; you can rename it later."]
      : ["Say what you're building, like ", { b: "“My portfolio site”" }, ". Short and real; you can rename it later."],
  };
  const closing: TourStep = {
    title: "Now go build it",
    body: t
      ? [
          "Head back into the game whenever, your ",
          { b: "First Trial" },
          " checklist tracks the rest (build it, then ship it for ",
          { b: t.name },
          "). Want a starting point? I wrote a first-site walkthrough with code.",
        ]
      : [
          "Head back into the game whenever, your ",
          { b: "First Project" },
          " checklist tracks the rest (build it, then ship it). Want a starting point? I wrote the whole first site out for you, code and all.",
        ],
    extra: { label: t ? "First site (code) →" : "Your first site (code) →", href: "/docs/first-site" },
  };
  return [
    intro,
    ...brief,
    {
      target: "new-btn",
      title: "Open a new project",
      body: ["Hit ", { b: "Next" }, " and I'll open a fresh project for you."],
      nextRoute: t ? `/projects/new?trial=${t.id}` : "/projects/new",
    },
    nameStep,
    {
      target: "f-repo",
      title: "Link your code",
      body: ["Paste your ", { b: "GitHub repo" }, " here (and a demo link below, if you have one) so a reviewer can see what you built. No repo yet? There's a Git guide."],
      extra: { label: "Git guide", href: "/docs/git" },
    },
    {
      target: "ht-connect",
      title: "Track your time with Hackatime",
      body: [
        "The important one. ",
        { b: "Hackatime" },
        " logs your build hours, and every shipped hour starts at ",
        { b: `${basePxPerHour} pixels` },
        ". Connect it, then tick this project's boxes so the time counts.",
      ],
      extra: { label: "New to Hackatime? Read this", href: "/docs/hackatime" },
    },
    {
      target: "f-save",
      title: "Create it",
      body: ["Save your project. That's the first checklist item done, hop back to the game and Pixo will point you at what's next."],
    },
    closing,
  ];
}

/**
 * The Trial the player is building for: the single open one, or the most
 * recently accepted (old getActiveTrial()). null = generic first project.
 */
export function activeTrial<T extends { id: number | string; unlocked?: boolean; completed?: boolean; unlocked_at?: string | null }>(
  trials: T[],
  preferId?: number | null,
): T | null {
  const open = trials.filter((q) => q.unlocked && !q.completed);
  if (preferId) {
    const match = open.find((q) => Number(q.id) === preferId);
    if (match) return match;
  }
  if (open.length <= 1) return open[0] ?? null;
  const ts = (q: T) => (q.unlocked_at ? new Date(q.unlocked_at).getTime() || 0 : 0);
  return open.slice().sort((a, b) => ts(b) - ts(a) || Number(b.id) - Number(a.id))[0] ?? null;
}

/** Resume index for a detour into the docs; clamped, NaN-safe. */
export function clampStep(n: unknown, length: number): number {
  const v = Math.trunc(Number(n));
  if (!Number.isFinite(v) || length <= 0) return 0;
  return Math.min(Math.max(v, 0), length - 1);
}
