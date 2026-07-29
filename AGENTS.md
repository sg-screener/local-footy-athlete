# Agent Working Agreement

This repo's most important product surface is the coach chat. Treat it as an
intelligent program-editing system, not a collection of phrase handlers.

## Coach Intelligence Rules

- Always optimise for the most elegant general solution in this app. If the
  right abstraction is unclear, ask before editing.
- Do not fix coach failures by adding one-off regexes, phrase branches, or
  narrow examples unless they are part of a broader typed intent, context, or
  executor improvement.
- For coach chat/program-edit bugs, work through the whole pipeline:
  1. parse the user's request into a typed intent,
  2. resolve the target from explicit text, recent chat, opened workout, and
     mutation history,
  3. ask the smallest useful clarification only when a required field is truly
     missing,
  4. apply the change through the deterministic executor/store layer,
  5. verify the visible program state changed before claiming it did.
- Preserve the user's exact training terms when they matter. "Assault bike
  sprints" must not become generic bike intervals; "Pilates" must not become
  aerobic base unless the user asked for that.
- Follow-up phrases like "make it longer", "make them shorter", "instead of
  that", and "a bit harder" should use structured recent context and mutation
  history first, not guess from canned wording.
- The LLM may interpret intent and missing fields, but it must not be trusted as
  the source of truth for program mutation. Program changes still go through the
  typed command/event/executor path.
- If a request could safely mean multiple different program changes, ask a
  concise question instead of pretending.

## Coach Architecture Escalation Rule

For coach chat, AI coach, program-edit, and plan-adjustment work, do not keep
patching the same pipeline after repeated failures.

If either of these happens:

- the same class of coach bug appears twice after a supposedly general fix
- the AI/semantic layer understands the user correctly, but a later layer
  changes, blocks, downgrades, or reinterprets that intent

then stop implementation immediately.

Before writing more code, produce an architecture reassessment that answers:

1. What is the current source of truth?
2. How many representations of the user request exist?
3. Where can intent, domain, date, target, or scope be reinterpreted?
4. Which layer should own the decision?
5. What simpler architecture would remove representations instead of adding
   more guards?
6. Which legacy paths should be bypassed or retired rather than patched?
7. What tests prove the new ownership boundary?

Do not add another resolver, guard, fallback, regex, compatibility branch,
phrase handler, or finaliser patch until the reassessment is approved.

Prefer architectures that reduce the number of representations and ownership
boundaries.

## Elegant Solution Requirement

When the user asks for the most elegant solution, compare at least two options
before coding:

1. Incremental fix inside the current system.
2. Simpler source-of-truth / ownership redesign.

If the redesign removes whole classes of bugs, recommend it even if it is a
bigger pivot.

For AI coach one-off edits, prefer:

visible program snapshot

- user message
  -> proposed revised visible plan
  -> diff
  -> validation
  -> override
  -> visible verification

over command/resolver/event chains unless there is a clear reason not to.

## De-duplication can silently un-gate the values it tidies

When duplicated values are collapsed behind a single reference — a shared
constant, a spread, an inherited base — **re-verify that the equality gate still
sees them**, before assuming the collapse was free.

Gates in this repo frequently parse source for inline literals (`required: 3`,
`preferredMax: 4`). Moving those literals into one object and spreading it
(`...PRE_SEASON_TARGETS`) removes them from the shape the parser matches, so the
gate stops comparing those cells and goes on passing. Nothing fails. The values
are now less protected than before the tidy-up, and the commit that did it reads
like an improvement.

This happened on 2026-07-28 collapsing three identical pre-season contracts into
one: the de-duplication was correct and ruled, and it would have un-gated the
very cells the same ruling had just authored. The fix is a second assertion that
compares the shared object directly.

The general shape: **a gate that reads code rather than behaviour is coupled to
the code's SHAPE, and refactoring changes shape by definition.** After any
de-duplication, ask what the gate matches on and whether it still matches.

## Instrumentation must be alive where the defects are

**A diagnostic that is off on the build the defect lives on is a green gate that
lies.** If you add logging, an export, a trace, or a fixture to investigate
something the repo owner is seeing on his phone, it has to run on HIS build —
not only under `__DEV__`, not only in a test process, not only behind a dev
menu.

This went wrong three times in one session (2026-07-29), each time costing a
device round-trip:

- a profile-mirror **fixture** that exercised an inert mirror, so the suite
  passed against a mirror that could never have failed;
- a stored-state **export** gated on `__DEV__`, invisible on the Release build
  it was written to diagnose;
- an athlete-action **trace** gated the same way, dark on the only device whose
  behaviour was in question.

Each looked like instrumentation and reported like instrumentation. None of them
could observe the case they were built for.

Before adding a diagnostic, answer two questions:

1. **Which build will this run on?** If the answer is not "the one the defect is
   on", it is not instrumentation yet.
2. **What would it print if the defect were present?** If you cannot say, it is
   not evidence, and a passing run of it is not a result.

The same rule applies to fixtures: a fixture whose input cannot exhibit the
defect proves nothing, however many assertions it carries.

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

## PROCESS LAW — L11 and L12

Process Law L1–L10 lives in `docs/MASTER_PLAN_2026-07-23.md` PART 1 and is
unchanged. L11 and L12 are recorded HERE because they bind every session that
touches this repo, including the review and orchestration seat (Cowork) — which
never touches git and would otherwise never read the master plan. **A reviewer is
bound by these exactly as an implementer is.**

### L11 — The matrix before the phone

**Sam's device is the LAST instrument, never the first.**

No athlete-facing change is accepted on targeted tests alone. The
**athlete-action matrix** — every door × every day-state × every route, driven
through real transactions, with law assertions per cell — must be green before
Sam is asked to touch his phone.

**The stop-rule: the moment two defects differ only by their combination
coordinates, ALL fix work stops until the matrix covers that space.** Proposing
another single fix in that condition is a violation of this law, whoever
proposes it. It does not matter that the next fix is correct; a correct fix
chosen by the same method that missed the last one is the failure repeating, and
the cost is another device round trip Sam pays for.

*Founding case:* `docs/LOCKED_DAY_DIAGNOSIS_2026-07-30.md` found two defects on
one day — a deletion door writing a schedule fact, and route (b) placing the
landing session at full size. They differ only by which door and which route,
i.e. by coordinates in a space nothing enumerated. The profile-wipe saga is the
same shape at five device round trips
(`docs/LOST_ONBOARDING_DIAGNOSIS_2026-07-30.md`), and the G-1 add-optional
investigation took four seed reconstructions before anyone asked what was
actually tapped.

*Status when this law was written (2026-07-30), so it is not mistaken for
satisfied:* the machinery exists — `src/dev/e2e/explorerCapabilityMatrix.ts`
declares the dimensions (season phase × fixture state × source-fact
combination), with a pairwise generator, scenario runner and oracle evaluator
beside it, and 18 of its 19 suites pass. **None of them is in `test:bible`.** A
harness that is green and ungated is not a matrix that is green — it is a
diagnostic nobody runs before the build, which is the failure named two sections
above in its mirror image. Gating it, and completing the door × day-state ×
route coverage, is the work L11 requires.

L10 and L11 are complementary, not in tension. L10 says Sam's phone is what makes
a thing DONE. L11 says his phone is not what makes it TESTED — and asking him to
find what a matrix should have found spends the one instrument that cannot be
automated.

### L12 — Verification strategy is reviewed like code

**Every boundary report must state what would catch the NEXT defect of this
class, not just this one.** A report that names the fix and its regression test
but says nothing about the class is incomplete, and is to be sent back the same
way an unreviewed diff is.

**A reviewer who accepts fix-by-fix verification during a combination-shaped
failure pattern is failing the same way the fix is.** Verification strategy is
not the implementer's private business subject to the reviewer's approval of the
outcome; it is part of the work under review. "The tests pass" is an
observation, not a verification strategy.

This pairs with the mandatory NOT-COVERED section (L2): NOT-COVERED says what was
not looked at, L12 says what the looking would have to change to catch the next
one.

## Test Standard

- Prefer invariant or scenario tests that prove the capability, not only the
  exact phrase that failed.
- Multi-turn coach fixes should cover follow-up context, target resolution, and
  visible mutation where possible.
- If a narrow regression test is useful, add it after the broader behaviour is
  represented.

## Working Style

- Before changing coach intelligence code, name the abstraction being improved.
- Keep implementation scoped to the pipeline layer that owns the behaviour.
- Do not expose, repeat, or commit API keys. Supabase/OpenAI secrets belong in
  deployed secrets only.

## Environment Facts

### This working tree is SHARED with concurrent sessions

More than one agent session can be working in this checkout at the same time.
Another session can check out a different branch, commit, and merge **while your
session is mid-unit**. Git branch state is therefore shared mutable state that
nothing tells you has changed.

**Run `git branch --show-current` immediately before every commit, not once at
the start and not at session end.** Which branch you are on is a fact to verify,
not a fact to remember.

This is recorded because it has already gone wrong. On 2026-07-28 a session
created `feat/provenance-lock-phase1`, committed five times, and then a
concurrent session branched off that tip, merged to `main`, and left HEAD on
`main`. The next ten commits of a fifteen-commit unit went straight to `main`
while the session went on reporting "branch …, unmerged" at the end of every
turn. Nothing was lost and no gate broke — the damage was purely that the
author's account of where the work lived was wrong for most of a long session,
including in what it told the repo owner.

Practical consequences:

- Verify the branch before each commit. A stale assumption is silent; the check
  costs nothing.
- `git stash` / `git stash pop` are unsafe here — a concurrent session can
  observe or disturb the stash, and a branch switch between stash and pop lands
  the changes somewhere unintended. Prefer committing to a scratch commit, or
  copying files to the session scratchpad.
- **`git checkout -- <file>` destroys uncommitted edits, and it is the same
  class of hazard as stash.** It is the obvious way to undo a mutation during
  mutation-testing, and it silently takes every unrelated edit in that file with
  it. This happened twice in one session on 2026-07-28: both times a deliberate
  one-line mutation was reverted along with an hour of unrelated wiring in the
  same file, and both times the loss was invisible until a later grep. Two rules
  follow, and the first is cheap enough that there is no excuse for skipping it:
  **commit before mutation-testing**, and revert a mutation by copying the file
  back from the session scratchpad rather than by asking git for it. A file that
  git does not track yet is worse still — `git checkout` fails on it and leaves
  the mutation in place, so the "restored" baseline is not restored at all.
- Before reporting "merged" or "unmerged", ask git rather than recalling:
  `git merge-base --is-ancestor <branch> main` and `git log main..<branch>`.
- A branch fully contained in `main` should be deleted rather than left as a
  pointer someone can build on.
