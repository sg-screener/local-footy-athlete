# ELEGANCE AUDIT — why LFA is large, tangled and still writes weak programs

**LOOP CHECK — `rules-added-after-the-decision`: COMPRESSION.** Independent
equipment, single-leg, away, COD, progression and coach probes keep landing on
the same shape: the correct fact or rule exists, but it enters after the
decision it needed to shape. This report groups those sightings into one
architecture finding instead of ordering another local fix.

## Verdict

The app is not short of programming knowledge. It is short of **one brain that
uses the knowledge to compose the week once**.

Today it builds a plausible candidate, then runs a succession of classifiers,
substitutions, canonicalisers, validators, repair searches, fallbacks, top-ups
and projections. Each layer is defensible alone. Together they make the final
program an emergent side effect: a later layer can discard, rename, restore or
reinterpret what an earlier layer decided. That is why fixes are often inert,
why edge cases cross over, and why a very large test system can stay green while
the printed week is poor.

The evidence supports an architectural simplification. It does **not** support
a big-bang rewrite of the whole app.

## What was audited

- Onboarding/profile to local generation.
- Weekly allocation to exercise composition.
- Equipment, injury, availability and fixture constraints.
- Accepted-state validation, repair and persistence.
- Program-tab and day-screen projection.
- Coach interpretation and mutation architecture.
- Session results, progression and four-week rollover.
- The broad scenario, QA, printed-week and lived-history instruments.
- Source size, import direction, cycles, stores and yesterday's git growth.

## 1. There is no single generation owner

The live deterministic path is not one composition. In
`buildGeneratedMicrocycles` it:

1. Builds a phase/week allocation in `buildCoachingPlan`.
2. Re-resolves conditioning feasibility.
3. Synthesises workouts in `buildWorkoutsFromCoach`.
4. Applies hard post-generation constraints.
5. Sends the week into the Section 18 gateway, which can repair it, regenerate
   it, or generate a safe fallback.
6. Rebinds provenance after acceptance.
7. Adds optional work **after** acceptance.
8. Runs a second craft check over that added work.
9. Bakes progression into the generated program.
10. Resolves and conditionally re-projects the week again for the screen.

This is the root crossing. A rule that should shape the choice is frequently a
filter or repair over a choice already made.

Measured consequences:

- Four equipment fixes failed in four different ways: inert, over-removal,
  broken leg days, and a week gutted to one exercise. Correct equipment data did
  not help because the mechanism was post-composition filtering.
- The fallback builder was proven to run with the right kit, but its rows were
  then discarded and replaced downstream. Editing it changed zero shipped rows.
- The generation path uses only the admission helpers from the slot engine. Its
  composing functions (`buildIntent`, `selectExercises`,
  `buildTagAwareSession`, `sessionSlotCoverage`) record zero generation calls.
- The current ladder census finds **92 deficient of 318** judged strength days.
- A bodyweight-only athlete still receives eight visible findings, including
  pull-ups, barbell rows, overhead press and RDLs requiring equipment they do
  not own. The log states that an empty equipment-filtered pool falls back to
  the raw pool.

This is why adding another rule rarely fixes the class. The rule arrives at the
wrong time.

## 2. The modules form a knot, not layers

`node scripts/measure-elegance-audit.js` measures the production TypeScript
graph:

| measure | current result |
| --- | ---: |
| production files | 549 |
| production lines | 266,430 |
| files over 1,000 lines | 59 |
| files over 2,000 lines | 20 |
| files over 4,000 lines | 6 |
| relative import edges | 3,249 |
| cross-area edges | 2,037 |
| files inside circular groups | 242 |
| largest circular group | **232 files** |
| second circular group | 4 files |

The largest cycle joins the generator, rules, stores, transactions, coach
modules, resolvers and projection code. The graph is bidirectional:
`utils → rules` 204 edges, `rules → utils` 82; `utils → store` 169,
`store → utils` 114; `store → rules` 79.

That means a local owner does not exist in practice. The code uses lazy
`require(...)` calls to get through some of the cycles. `programStore` has 77
production importers and `sessionResolver` 68. A change in either is an app-wide
change even when the diff is one line.

The largest owners also mix jobs:

- `coachingEngine`: 9,057 lines.
- `coachTurnController`: 6,296.
- `coachProgramEdit`: 5,798.
- `coachCommandExecutor`: 4,811.
- `DayWorkoutScreenV2`: 4,304.
- `HomeScreenV2`: 4,222.
- `acceptedStateTransaction`: 3,814.

The circular graph is a lower bound: the measurement includes static relative
imports and literal runtime `require` calls, but not non-literal dynamic
resolution.

## 3. Coach/program editing has become a second application

Production files named for coach, plan-change, program-edit or adjustment total
**79 files and 73,031 lines**. A user request can be represented as a coach
intent, command, edit draft, semantic draft, revision proposal, plan change,
adjustment request/event, target frame, mutation and accepted-state transaction.

The 6,296-line turn controller simultaneously supports deterministic ownership,
semantic active/shadow modes and a fenced legacy fallback. This is exactly the
architecture's own stop-patching trigger: intent is understood in one layer and
can be blocked, downgraded or reinterpreted later.

The complexity is not mainly the LLM. It is the number of internal forms and
compatibility routes after the LLM has spoken.

## 4. The judging system grew faster than the product brain

Current surface:

- 406 `test:*` commands; 253 commands in the Bible chain.
- 233,076 lines in `src/__tests__`; another 10,822 in scripts.
- 21 of 406 suites are not runnable.
- The compile gate is green only against a baseline containing **459 errors**:
  35 in product source, 51 in devtools and 373 in tests.
- 125 engineering laws, 21 unenforced.
- 89 Sam rulings, 4 not enforced by the live state panel.
- 1,003 mechanically classified Bible rule lines; 8 have a named enforcer.
  That census explicitly reports depth 0 and is not a conformance measure.
- 93 unchecked vocabulary crosswalks; 29 duplicated concepts and 42 redundant
  declarations. Conditioning category is declared five times.
- 16 of 43 assigned `contract.*` fields have no reader.
- The feature registry has only 9 rows, declares itself incomplete, and already
  contains 2 built-but-unreachable features.

Yesterday (`45e34bdb..HEAD`) had 617 commits and changed 323 files:

| area | added | removed | net |
| --- | ---: | ---: | ---: |
| product source | 7,594 | 803 | +6,791 |
| tests and scripts | 15,688 | 693 | +14,995 |
| docs | 30,264 | 1,178 | +29,086 |
| other | 913 | 11 | +902 |

The supporting system grew about 6.5 times as much as product source. Much of
that work found real defects and is valuable. The architectural problem is that
it mostly judges or documents a generator it does not own.

The instruments disagree at the product boundary:

- Narrow scenario harness: 64/65.
- Broader QA: 168 assertions pass and 10 fail across 17 scenarios.
- Printed weeks: 18 athlete-visible findings across six weeks.
- Wide strength ladder: 92/318 deficient, above its 88 ceiling.

Passing more local cells has not become the same thing as writing a good week.

## 5. Athlete history is stored but does not close the loop

`npm run sim:changeover` was rerun on the current tree. Five athletes began with
the same profile, then lived five genuinely different histories: completed
everything, logged every weight, missed every Friday, went away in week 3, or
declared soreness in week 2.

Their week 5 is identical. The control athlete stored 67 loads over 23 days, so
this is not a no-op harness. Week 5 changes from week 1 by date-seeded exercise
rotation, not by responding to the athlete. A completed strength session without
logged rows is also invisible to progression.

This is the most important product result: the app collects feedback, results,
misses and facts, but the next block is still primarily rebuilt from the
original profile and calendar. The 16 unread contract fields are the same
disconnect at source level.

## 6. The screen is another interpretation layer

The Program tab resolves a raw week and may apply constraint projection unless
an accepted contract suppresses it. The Day screen has a parallel single-day
route. The full visible projection then composes parts and signed words.

The paper-phone probe found the practical result:

- The canonical projection prints rep ranges such as `3 × 2-4`; the Day screen
  converts them to one middle number.
- Conditioning filler prints as `1 × 1` in the projection but is suppressed by
  another screen formatter.
- Named Power parts can contain no rows.
- Every UI picture in the picture manifest is currently stale.

The app therefore has a generation truth, an accepted-state truth, a resolved
truth, and at least two presentation truths. One visible-week output does not
yet feed every surface.

## 7. The shared-work process amplifies the app problem

This is not the product root cause, but it makes every product change less
reliable:

- The live inbox is 185KB against a 96KB budget and still mixes active,
  completed and blocked work.
- The repo guard finds 33 agent commits that rewrote the shared inbox instead
  of marking one item.
- Two independently built paper-phone directories coexist.
- Registry rows repeatedly said `UNENFORCED` over work that already existed,
  sending agents to rebuild it.
- Several probes recorded conclusions against a working tree being edited by
  another seat at the same time.

This is the same architecture defect in miniature: too many writers, too many
representations, and no single accepted output.

## The two real options

### Option A — keep the current system and pay down defects

Continue fixing the 92 ladder misses, bodyweight equipment failures, 10 QA
failures, vocabulary seams, unread fields and unenforced laws inside the current
pipeline.

This is the smaller immediate change. It will improve individual cases. The
measured history says it will also keep producing inert fixes and new repair
interactions because the ownership structure does not change.

### Option B — one vertical source-of-truth composer

Build one pure composition boundary:

`visible week = compose(Bible contracts, profile, dated facts, athlete decisions, results, today)`

At that boundary:

- Phase and calendar derive the week's targets once.
- Session slots are chosen once.
- Equipment, injury and experience are inputs while filling each slot, never a
  filter over finished rows.
- Athlete decisions are immutable inputs, not work a later repair may undo.
- Results and misses are explicit progression inputs.
- Validation reports on the composed week; it does not silently rewrite it.
- Program, Day, Coach and QA all consume the same visible-week result.

Do this as a strangler, not a rewrite: prove one ordinary in-season loop end to
end, compare it against the current system, then move one phase/door at a time
and delete the displaced branch. The first slice must include full-gym,
bodyweight-only and week-5-after-real-history cases; otherwise it can reproduce
the current disconnect while looking cleaner.

## Recommendation

Choose Option B. Freeze non-safety edge fixes and new feature work while its
first vertical slice is proved. Keep the current UI, authored data, ledgers and
valuable test cases as adapters and acceptance evidence. Replace the generation
and repair knot incrementally; do not discard the whole app.

The success measure is subtraction, not another green suite:

- one composer becomes the only writer of session content;
- post-composition row repair paths are deleted;
- one visible week feeds all surfaces;
- the bodyweight scenario cannot select unavailable work;
- week 5 differs for a ruled reason when the athlete's history differs;
- the large circular groups shrink as old paths are retired.

## What would catch the next defect of this class

A standing differential over the first vertical slice:

1. Feed the same typed inputs to old and new composers.
2. Print both through the same visible projection.
3. State every intentional difference in athlete language.
4. Walk real decisions and results into week 5.
5. Refuse any new post-composition mutation or second visible-week formatter.

The important assertion is not that old and new remain identical. It is that
every difference has one owner and every consumed input can be shown to affect,
or deliberately not affect, the output.

## NOT COVERED

- No physical iPhone run. Sam's phone remains the last acceptance instrument.
- No claim that every source file or every one of 406 suites was semantically
  reviewed. The graph covers every production TypeScript import; the behavioural
  audit follows the named product paths and current end-to-end instruments.
- No live OpenAI/edge coach conversation was sent. The coach finding is source
  architecture plus existing pipeline receipts, not a fresh network run.
- No migration plan for persisted legacy envelopes was designed.
- No app code was changed, and no architectural build has started.

**NORTH STAR:** the recommendation moves toward “store decisions, derive
everything.” The current system has moved persistence closer to inputs-only,
but live composition and projection still have several competing owners.
