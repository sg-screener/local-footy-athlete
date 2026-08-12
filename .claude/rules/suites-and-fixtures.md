---
paths:
  - src/__tests__/**
---

# Suites, fixtures and the walker

**MOVED OUT OF `AGENTS.md` ON 2026-08-12** so it loads only when the files it
governs are touched. `AGENTS.md` was 746 lines re-read every single turn, and
these apply only when writing or changing a suite.

**NOTHING HERE IS NEW.** Every word below is the law as it stood in `AGENTS.md`;
this file changed WHERE it is read, never WHAT it says. `AGENTS.md` keeps a
pointer at each moved section, so if the path-scoped mechanism is ever inert the
law is still findable rather than lost.

**THIS FILE IS TRACKED.** `.gitignore` excludes `.claude/*` and re-includes
`.claude/rules/` for exactly this reason — a law only one machine can see is not
a law.

---

## Hand-built state fixtures are deprecated for athlete-facing suites

**Sam's ruling, 2026-07-30: a seed library is SAMPLING, not coverage.**

Seeding a harness from a device export — or from a hand-written store snapshot —
proves things about one state and quietly implies things about the space around
it. The space is where the defects live. Worse, a seed cannot be checked: it
asserts a state nobody arrived at by acting, so nothing catches it when the
state it claims to represent is not reachable at all.

That failure is not hypothetical. Seeding the athlete-door matrix from
`device-export-8.json` produced a week scoring squat 0 / hinge 0 / push 2 /
pull 1, which §18 cannot repair and which threw straight through the tap door.
Sam's device was demonstrably NOT in that state — it held a materialised
overlay for the very week the seed could not rebuild, because the export
carries overlay KEYS and not overlay CONTENT. **A seed that cannot restore what
it claims to restore manufactures defects, and a manufactured defect costs a
device round trip — the exact cost the matrix exists to avoid.**

The replacement, for anything asserting athlete-facing behaviour:

- **Reach state by ACTING.** Start from a fresh install and perform real
  athlete actions through the real doors — onboarding, generation, every door,
  life-facts, calendar marks, and the passage of time. `athleteActionWalker`
  is the engine; `athleteActionWalkerTests` is the wiring.
- **A state you cannot reach by acting is a state no athlete can be in.** If a
  state an athlete CAN be in is unreachable, the ACTION VOCABULARY is
  incomplete, and that is a defect in the harness.
- **A device export's only legitimate role is a CONFORMANCE TARGET** — proof
  that the vocabulary can reach a shape a real phone was in. Never a seed.

This is the fixture-fidelity law ("a fixture whose input cannot exhibit the
defect proves nothing") carried one step further: a fixture whose input could
never have existed proves something false. It is also the verification-layer
statement of the north star — store only decisions, derive everything else. A
seed stores a derived output; a walker stores the decisions and derives the
state, which is why only one of them can be wrong about what it represents.

### L13 — The walker reaches ACCUMULATED state

**Sam ratified, 2026-07-30.** A harness that only reaches freshly-acted worlds
tests a life nobody lives. The walker must reach **accumulated** state — long
athlete lives, many edits deep, weeks of time advancing — and athlete-facing
suites must assert over those states, not only over three-actions-from-install.

**A defect class that only exists in well-worn state is in scope by law.**

*Why it is law:* it had already cost three units in three different layers.
The hydration wipe could not be reproduced because Sam's week breached a current
rule only after 43 revisions of edits. Surface-agreement cells 1 and 4 both pass
in a freshly-acted world, because there the G+1 Sunday resolves a real session and
the surfaces agree — so the two defects he photographed most directly were the
ones the harness could not reach. And the G-1 ask cell tapped a move off an empty
Thursday, which one added session fixed: the same lesson at depth one.

**What it forbids.** Loosening an assertion so that it reds in a shallow world.
Cells go red by the walker walking FURTHER, never by asking less. And "passes in a
freshly-acted world" stops counting as evidence of absence — a pass at depth 3 says
nothing about depth 43, so **a report must state the depth it reached.**

**What it requires.** The walker's budget gains a DEPTH dimension beside its
width. Because depth is expensive — every walk generates a program — the shallow
and deep tiers must be DECLARED separately: a shallow gate that looks like the deep
one is the exact failure this law exists to prevent.

L11 says the matrix comes before the phone. L13 says the matrix must be deep enough
to contain the defect.
