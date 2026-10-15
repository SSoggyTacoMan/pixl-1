extends RefCounted
## Every word Pixo says during the first-run onboarding, in the order the
## player sees it. Edit the text here; scripts/onboarding.gd only plays it.
##
## Each Array is one dialogue box sequence: one entry per click. `%s` is filled
## in by onboarding.gd, keep it where it is.

const SPEAKER := "Pixo"

# ── 1. greeting (after the intro cinematic) ─────────────────────────────────
const GREETING := [
	"Oh, you actually came. Good. I wasn't sure anyone would.",
	"I'm Pixo. I've kept this little Hub lit since the Static hit. It's the last stable ground we've got.",
	"Everything past the edge is frozen. Saloons stopped mid-song. Trains halted on the rails. Whole districts gone to pixels.",
	"We can bring it back. That's not a hope, it's how this place works. But I can't do it alone, and neither can the Core.",
	"First things first, though. Let's get you sorted.",
]

# ── 2. naming ritual ────────────────────────────────────────────────────────
const NAMING_ASK := [
	"So, what should everyone call you around here?",
	"Names matter. It's the first thing the world remembers about you.",
]
const NAME_ACCEPTED := "%s. Alright, the Hub knows you now."
# When the server rejects the name: a friendly line, then the question again.
const NAME_REJECTED_FRIENDLY := "Hah, let's keep it friendly, yeah? The little ones look up to us. Try another."
const NAME_REJECTED_GENERIC := "Hm, that one won't stick. Try another?"

# The name box that opens over the dialogue.
const NAME_BOX_TITLE := "What should everyone call you?"
const NAME_BOX_PLACEHOLDER := "Your name"
const NAME_BOX_KEEP := "Keep \"%s\""
const NAME_BOX_SKIP := "Skip"
const NAME_BOX_SAVE := "That's me"

# ── 3. experience question ──────────────────────────────────────────────────
const EXPERIENCE_ASK := [
	"One more thing, so I know how much to explain. Be honest: there's no wrong answer.",
	"How much have you built before?",
]
# Same order as EXPERIENCE_IDS in onboarding.gd.
const EXPERIENCE_OPTIONS := [
	"I'm just starting out.",
	"I've shipped a few things.",
	"I build all the time.",
]
# Pixo's reply, keyed by the id stored server-side.
const EXPERIENCE_REPLY := {
	"beginner": "Perfect, we all start somewhere. I will walk you through the first one!",
	"intermediate": "Nice. I'll point you at something with a bit of bite and stay out of your way.",
	"advanced": "Very cool! That mean I can stop the \"hand-holding\". You will be very useful to help repair the world!",
}

# ── 4. how the loop works ───────────────────────────────────────────────────
const LOOP_PATTER := [
	"Here's the whole deal. See that dark spire? That's the Core: it used to power all of Origin. Now it's a sealed vault, holding everything we ever made.",
	"You bring it back by building. Real things: a website, a bot, a game, whatever's yours. The jobs are called Trials.",
	"Every hour of real work you ship becomes Restoration Energy. That's what thaws the world and wakes the Core.",
	"And when the Core wakes, it hands back what it's been keeping: real gear, real rewards. That part isn't a metaphor.",
	"Ship enough and you'll feel it: the more you build, the more each hour pays. Pixels for you, energy for all of us.",
]

# ── 5. point the player at the frontier (Ridit) ─────────────────────────────
const FRONTIER_PITCH := [
	"The Trials themselves aren't here in the Hub, they're out past the edge, in the regions.",
	"Head through the Lobbies to reach the frontier, and find Ridit out there. He keeps the Dustline, and he's holding a first Trial for you.",
	"Take his, or build something entirely your own, the Core recognizes both. Either way the loop's the same: build it, ship it, watch the world thaw.",
]
# Same order as the ids in onboarding.gd ("lobbies", "later").
const FRONTIER_OPTIONS := ["Open the Lobbies", "I'll head out myself"]

# ── 6. sign-off ─────────────────────────────────────────────────────────────
const CINEMATIC_CREDIT := [
	"Oh, one more thing: that opening you just watched was drawn by noct. Genuinely great artist, go hire them if you ever need art done.",
]
const CHECKLIST_NOTE := [
	"I'll pin a checklist to your screen so you never lose the thread. First stop, find Ridit.",
]
