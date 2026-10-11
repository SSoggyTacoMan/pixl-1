// The Chronicle: node shape from GET /api/story (apps/server/src/routes/story.ts),
// the seed content shown when the API is empty or unreachable, and the
// reveal / outcome helpers. Pure, unit tested in timeline-lib.test.ts.

export interface StoryNode {
  id?: string;
  kind?: string | null;
  seal?: string | null;
  tag?: string | null;
  duration?: string | null;
  dur?: string | null;
  title: string;
  body?: string | null;
  quote?: string | null;
  q?: string | null;
  outcome?: string | null;
  revealed?: boolean;
}

export const REVEALED_THROUGH = "chapter-1";

export const SEED_NODES: StoryNode[] = [
  { id: "prologue", kind: "prologue", seal: "✦", tag: "PROLOGUE", dur: "", title: "The Fall of Pixl",
    body: "Origin has fallen. Centuries of every invention uploaded into the Core finally exceeded its limits: the overload became The Great Static, and the world crashed into pixelated fragments drifting in the Void. Unable to repair itself, the Core reaches into our universe and wakes the Builders." },
  { id: "chapter-1", kind: "chapter", seal: "I", tag: "CHAPTER I", dur: "3 WEEKS", title: "Rise of Pixl",
    body: "Builders arrive in Pixl for the first time. They restore the Capital District, reactivate the Core, and help the first settlements recover from the Crash. Hope returns for the first time in centuries." },
  { id: "operation-1", kind: "op", seal: "I", tag: "OPERATION I", dur: "1 WEEK", title: "Forge Weekend",
    q: "The Capital is standing… but its workshops remain silent.", body: "A mini online hackathon focused on developer tools.",
    outcome: "The <b>Great Forge</b> is restored, Pixl can manufacture advanced technology once again." },
  { id: "chapter-2", kind: "chapter", seal: "II", tag: "CHAPTER II", dur: "3 WEEKS", title: "Echoes Beneath",
    body: "Power restored to the Great Forge awakens Vault Zero, an underground research facility buried since before the Crash. Builders uncover forgotten technology and the first clues about what truly caused Pixl's downfall." },
  { id: "operation-2", kind: "op", seal: "II", tag: "OPERATION II", dur: "1 WEEK", title: "Skybound Jam",
    q: "The Sky Docks are almost ready.", body: "A week-long game jam.",
    outcome: "The first <b>airships</b> return to service, opening travel beyond the known lands." },
  { id: "chapter-3", kind: "chapter", seal: "III", tag: "CHAPTER III", dur: "3 WEEKS", title: "Beyond the Clouds",
    body: "Using the restored airships, Builders explore the floating Sky Isles. Ancient ruins, new allies, and strange relics hint that Pixl's history is far older than anyone believed." },
  { id: "operation-3", kind: "op", seal: "III", tag: "OPERATION III", dur: "1 WEEK", title: "Core Intelligence",
    q: "The Observatory requires new minds.", body: "Builders create AI projects.",
    outcome: "The <b>Observatory</b> is reactivated, letting the Core scan regions unreachable since the Crash." },
  { id: "chapter-4", kind: "chapter", seal: "IV", tag: "CHAPTER IV", dur: "3 WEEKS", title: "The Signal",
    body: "The Observatory detects a mysterious transmission repeating from deep within the Void. As Builders investigate, they discover someone, or something, is trying to communicate with Pixl." },
  { id: "operation-4", kind: "op", seal: "IV", tag: "OPERATION IV", dur: "1 WEEK", title: "Relay Protocol",
    q: "The transmission is unstable.", body: "Builders create web apps, APIs, networking, or communication tools.",
    outcome: "The signal is decoded, revealing <b>coordinates to a forgotten civilization</b>." },
  { id: "chapter-5", kind: "chapter", seal: "V", tag: "CHAPTER V", dur: "3 WEEKS", title: "The Forgotten Frontier",
    body: "Builders journey beyond Pixl's known borders and find the remnants of another civilization that survived the Crash in isolation. The chapter ends with an ancient gateway leading even farther into the unknown." },
  { id: "operation-5", kind: "op", seal: "V", tag: "OPERATION V", dur: "1 WEEK", title: "Genesis Week",
    q: "A new frontier awaits.", body: "Builders can create any type of project to help establish the first outpost beyond Pixl.",
    outcome: "The <b>gateway is stabilized</b>, and the expedition into the unknown officially begins." },
];

export function kindClass(k: string | null | undefined): "op" | "prologue" | "chapter" {
  return k === "operation" || k === "op" ? "op" : k === "prologue" ? "prologue" : "chapter";
}

/** Index of the last revealed node; everything after it shows as one sealed card. */
export function revealCut(nodes: StoryNode[]): number {
  if (nodes.some((n) => typeof n.revealed === "boolean")) {
    let last = -1;
    nodes.forEach((n, i) => {
      if (n.revealed !== false) last = i;
    });
    return last;
  }
  const i = nodes.findIndex((n) => n.id === REVEALED_THROUGH);
  return i === -1 ? nodes.length - 1 : i;
}

export interface OutcomePart {
  text: string;
  bold: boolean;
}

/**
 * Outcome text is dashboard-authored and may contain <b>...</b>. It's split
 * into plain/bold runs rendered as React text, so no other markup (or an
 * unbalanced tag) can ever become HTML.
 */
export function outcomeParts(src: string): OutcomePart[] {
  const out: OutcomePart[] = [];
  let bold = false;
  for (const piece of String(src).split(/(<\/?b>)/i)) {
    const tag = piece.toLowerCase();
    if (tag === "<b>") bold = true;
    else if (tag === "</b>") bold = false;
    else if (piece) out.push({ text: piece, bold });
  }
  return out;
}
