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

## A count names the instrument's unit, not the domain noun

**Before a number enters a report or a ruling, state its unit and its
denominator, and give the distinct count of the domain object beside it.**

Seat-endorsed 2026-08-07 at the third sighting of the same shape, and by then it
had cost a whole ruling:

- "3 red both sides" hid one cell improving and two regressing into a different
  KIND of delta.
- A `| tail -3` totals line reported six-for-six green while four suites
  exited 1.
- **"159 athlete-removal DECISIONS the ledger does not record"** was 330
  *per-store-write occurrences* of 40 reduction rows authored by 23 decisions,
  and "absent" meant absent-from-THIS-WEEK rather than absent-from-the-ledger.
  A ruling was written against that premise — a doors-append fix and a one-time
  extraction — before the write side measured `noAdjustment` at 0 of 40 and the
  extraction was cancelled as having nothing to extract.

The failure is not arithmetic. Each number was correct **in the unit its
instrument counts in**; each was then read in the unit the domain cares about.
An instrument that compares on every store write counts store writes. One that
dedups by row counts rows. Neither counts decisions unless it says so.

Practically:

- Emit counters as a PAIR — occurrences and distinct — with the dedup key named
  in the field. `src/dev/measure.ts`'s `Tally` does this and refuses to print a
  lone number; use it for new instruments.
- Where two identities are meaningful (a row and the decision behind it), report
  both. "40 rows from 23 decisions" is a sentence a ruling can be built on;
  "159" is not.
- Breakdowns and ranked lists are reported in DISTINCT terms, so they never
  inherit the occurrence inflation.

This is the counting half of `a-ruling-premise-is-a-claim-too`: a premise stated
as a number gets checked as a number, including when the ruling is the seat's.

### The same law for SOURCE SCANS — count the occurrences, then read what runs them

**Sighting 4, 2026-08-08, and it fired inside a brand-new gate on its first
mutation test.** The day-first slice added a cell asserting that every day of
the week still mounts its explorer state leaves. It counted `<DayStateLeaves`
occurrences and required exactly two. It **passed** against a mutation that
emptied the loop feeding one of them (`weekDays.map` → `[].map`): the count was
right and the days were gone. It also matched on a prefix, so renaming the
component satisfied it too.

The failure is the section above in a new instrument. A source scan counts
**call sites**; the domain noun is **days that report themselves**. Those are
different units, and a call site iterating nothing mounts nothing.

So, for any gate that asserts on source text:

- **Count with a word boundary.** `<Foo` matches `<FooBar`. `\b` costs nothing.
- **A count is never the whole assertion.** Locate the REGION the occurrence
  lives in and assert what makes it run — the loop it is inside, the collection
  it iterates, the branch that reaches it. A cell that only counts is satisfied
  by dead code.
- **Prove the region was found.** Assert the extracted slice is non-trivial
  before asserting anything about it; a `slice` between two `indexOf`s that both
  missed returns something a regex will happily pass over.

The general shape, third time it has been written in this file: **an instrument
answers in its own unit, and a gate that never states its unit will eventually
be read in the domain's.**

### The same law again — its subject is ANCHORING, not counting

**Sighting 6, 2026-08-09, journal slice 1, and again inside a brand-new gate on
its first mutation test.** A cell asserted the new Journal tab sits between
Program and Profile by comparing three `indexOf` results directly. Renaming
`ProgramTab` left the cell **green**: `indexOf` returns `-1` when the anchor is
MISSING, and `-1` is less than everything, so "Program comes before Journal" was
satisfied by Program having vanished.

The two sections above are written about COUNTS, and that is why this slipped —
the same author applied them correctly to the cell counting `<Tab.Screen` in the
same file, and did not recognise an ORDER assertion as the same shape. So the
law is restated at its real subject:

**Any assertion that locates something in source by POSITION must prove every
anchor was FOUND before claiming anything about their relationship.** That
includes `indexOf` comparisons, a `slice` between two markers, "appears before /
after", and a regex spanning anchors with `[\s\S]*?`. Every one of them returns
a value that compares perfectly well when the anchor is absent — `-1`, `''`, an
empty slice — and every one of them reads as a pass.

Counting is one instance of anchoring, not the other way round. If a gate finds
its subject before asserting on it, prove the finding first; the assertion is
only meaningful afterwards.

## A behaviour claim the owner can read is held by a CELL, or written OPEN-UNKNOWN

**Seat-ruled 2026-08-10.** DOC-TRUTH already forbids a *"built"* claim without a
code receipt. This is its sibling for behaviour: **a sentence saying the app does
or does not do X — anywhere Sam reads it — is either (a) pinned by a NAMED cell
or tape, or (b) written as OPEN-UNKNOWN / "read at source, not measured".**

That covers `docs/NOW.md`'s Sam-facing block and every boundary report's
behaviour prose. Both forms are acceptable. What is forbidden is the third form:
a confident behavioural sentence held by nothing.

*Founding case.* The slice-2 boundary said *"why is Friday heavy?"* was refused.
`docs/NOW.md` told Sam it was refused. **No cell held the claim — it lived in
prose only, and it was false**: the coach answered *"Friday: Lower Squat."*, so
the athlete asked WHY and was told WHAT, which is worse than the refusal that was
being reported as a limitation. It survived two reports and reached the owner.

*Second case, one pass later, and it is why the rule names TAPES too.* Slice 3
reported that the coach's move *"goes through the SAME door as your own tap, so
the toast and Undo work on it exactly as they do."* 116 cells were green. **The
door had never been executed** — the boundary said so in its own first NOT
COVERED line — and when a tape finally ran it, the coach's move was inert:
`handleConfirm` omitted the door's required visible week. **Every green cell was
a claim about which FUNCTION is called; the defect was in an ARGUMENT.**

Two practical consequences:

- **A cell that names a function does not cover its arguments.** Where a door
  takes an optional context that changes whether it acts at all, the call-site
  cell asserts the CONTEXT, and a second cell compares it against the
  established caller's. `coachTabSlice3Tests` [7] is the worked example.
- **"The door has never run" in a NOT-COVERED section is a debt with a deadline,
  not a disclosure.** A slice whose own first uncovered line is that its
  mechanism was never executed should not be followed by another slice before it
  is. Sighting 2 of a source-level reading standing in for a run; the overnight
  pass predicted its own in writing and was right about that one too.

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

## PROCESS LAW — L11, L12 and L13

Process Law L1–L10 lives in `docs/MASTER_PLAN_2026-07-23.md` PART 1 and is
unchanged. L11, L12 and L13 are recorded HERE because they bind every session that
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

### L14 — Domain purity

**Sam ratified, 2026-07-30 (recorded via Cowork).** Domain logic — rules,
generation, repairs, counting, projection — knows nothing about React,
navigation, screens, Supabase, or device time. Any new or moved domain module
must be callable from a plain test with explicit inputs. The
`dayDetailComposition` purity pin is the precedent; apply its standard to
everything Stage B touches. Existing violations are census debt, not
emergencies — they are converted when their unit comes up, not hunted.

### L15 — One write format

**Sam ratified, 2026-07-30 (recorded via Cowork).** New saves are always
written in the current canonical format; superseded formats are never written
again, by anything, ever. Old formats exist only as read-ingress lifts at the
boundary (powerBlock precedent, hydration lift). A writer of a retired shape
is a red-gate defect, not a compatibility feature.

### L16 — Vertical slice first

**Sam ratified, 2026-07-30 (recorded via Cowork).** A rebuilt system proves
one complete loop before anything else builds on it: load → display → change →
repair → approve → persist → relaunch-identical. Stage B is held to this shape
explicitly: the engine's first acceptance is one clean slice through the
walker, not breadth.

*Context for L14–L16:* these arose from an external architecture review Sam
commissioned on 2026-07-30. The review's remaining recommendation — a parallel
V2 shell behind a legacy flag — was REJECTED by Sam's seat: two live truths is
the disease every law here exists to kill; the in-place convergence continues.
Recorded so nobody re-litigates it.

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

## Seat coordination laws (Sam, 2026-08-07)

- **SEAT INBOX:** when this terminal stops for a review-seat ruling, read
  `docs/SEAT_INBOX.md` FIRST — the review seat writes rulings there
  before Sam relays anything. A one-line nudge from Sam ("check inbox")
  means exactly that. This retires Sam as the courier of paste blocks.
- **NOW FILE:** every checkpoint/handover updates `docs/NOW.md` — branch,
  HEAD, current unit, next step, open rulings; five lines, overwrite in
  place (it is a pointer, not history — history lives in the dated
  docs). Every fresh session reads it before anything else.
- **LOOP-AUDIT LAW:** docs/SEAT_LOOP_AUDIT_LAW_2026-08-07.md binds this
  seat — third sighting of any repeated ruling-shape, round-trip, toll
  or rediscovery = propose the compression, never a fourth silent run.
