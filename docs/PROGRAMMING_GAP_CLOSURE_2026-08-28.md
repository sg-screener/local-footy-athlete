# Programming gap closure — 28 August 2026

Owner: programming-remedy. Work in progress; installation hold remains.

## Baseline and scope

Started at `1922a99517a507462afbe04e9c318fdc7d3a7ae7`, whose application is the
verified `263369ba6873008cef28fab1a7f831dfc5989e4f`. Existing release evidence,
athlete history, phones and other seats' files were preserved. No production
programming change is needed to repair the old diagnostic expectations.

Evidence lives in `outputs/programming-gap-closure-2026-08-28/`; original
evidence remains in `outputs/flush-remediation-2026-08-28/`. Simulator work uses
only `B8B2C7B0-0558-448A-896D-EAB9C2C6C326`, with the frozen verified app served
from `/private/tmp/lfa-flush-final.P1nmiM/source` on port 8086.

## Four old diagnostic failures: obsolete expectations, current protection

Baseline `test:conditioning-templates`: **104/108 assertions**, four failures
in C12. They are four assertions cascading from one removed function, not four
separate programming defects:

| Old assertion | Classification and disposition |
| --- | --- |
| Find `categoryToFlavour` | Obsolete implementation anchor; removed in `3417731e`. Retired. |
| Read its flavour cases | Obsolete source shape; retired. |
| Account for every category through that map | Preserve the no-category-loss principle at the current typed selector. |
| No new category may be missing except old COD debt | Retire the permanent COD-debt exception; current COD is selectable as COD. New categories still fail unless fully accounted for. |

Compared retaining/reconstructing the old three-flavour map with exercising the
existing typed owner. The latter is the smaller change and avoids reintroducing
the lossy COD-to-glycolytic translation. No architecture rebuild or programming
change was made. `conditioningCategoryTruth` now tests all seven actual category
pools, demand identity, selected quality and composed prescriptions, plus both
planner/selector vocabularies with non-vacuous source anchors.

The diagnostic now has **152/152 passing assertions**. The helper also runs in
the release-gated canonical compiler suite via `programmingInputTruth`. All four
new in-memory mutants were caught for the intended assertion: empty VO2 pool,
COD relabelled as anaerobic, an unhandled new vocabulary member, and lost
optional-flush identity. See `category-mutations/*/receipt.json`. Historical law
id `LAW-every-category-has-a-flavour` is preserved, with its implementation
expectation explicitly superseded; R-003 records the same distinction.

## Delivered-year spacing: classification, not a zero-pair target

Instrument unit: adjacent calendar-date pairs sharing a displayed conditioning
part; not repeated exercises, sets, hard days or a count of defects. The original
**15 pairs per year** means **60 pair occurrences across four athlete/equipment
worlds, on 15 distinct date pairs**. There are no adjacent Upper/Upper or
Lower/Lower pairs in that measure.

Reading actual prescriptions changes the interpretation:

| Per delivered year | Pairs | Assessment |
| --- | ---: | --- |
| Easy/moderate Monday → hard Tuesday | 5 | One hard day, not hard/hard. |
| Easy/controlled → easy/controlled | 10 | Eight Thu/Fri pairs plus two deload Mon/Tue pairs. |
| Friday easy/controlled → Saturday Speed | 8 | Omitted by the old same-part counter; included in this review. |
| Hard → hard | 0 | Actual effort text checked on both sides, not inferred from session names. |

The expanded measure is **23 distinct date pairs / 92 pair occurrences** across
four worlds. `spacing-classification.json` lists every pair with its actual
exercises, doses, effort, recovery and modality. The first classification probe
failed on 16 November because it assumed every Tuesday was hard. The delivered
deload Tuesday is controlled tempo: the probe was corrected to classify actual
effort, not to alter correct programming. Original failure evidence is retained.

Affected weeks start 26 October through 14 December. The approved normal-build
contract asks for five conditioning/speed exposures; the current week uses
Mon/Tue/Thu/Fri/Sat, with four lifting days and Wed/Sun free of core training.
Independent enumeration of all 21 five-day subsets of a cyclic seven-day week
proves a minimum of three adjacent exposure pairs. This arrangement attains
three, with a longest core-training run of three days. That does **not** make
each exact date pair compulsory: another arrangement moves the adjacency.

The actual scheduler's six candidate receiver sets were captured in memory for
all affected weeks. There were 272 search observations and 40 distinct complete
input/output records across the two equipment worlds, covering eight distinct
week starts. None improves on the chosen arrangement without creating a
four-day core streak or six core-active days. No genuinely poor avoidable
placement was demonstrated among these legal candidates. The illness week is
separate: Tuesday quality is absent, Monday is easy-adjusted, and Thu/Fri/Sat
follow the actual all-clear. The five-exposure lower bound is not claimed for
that altered week.

Before/after comparability: the real driver replayed the first 12 weeks for both
genders in both original-partial and corrected-commercial equipment worlds.
Profiles and **every exported week, row, dose, modifier and weekly restart
result match the delivered years exactly** (`classify-spacing.cjs`). Existing
52-week reports remain the delivered reports; no dose or placement was changed
to make this count look smaller.

## Native simulator findings

Fresh real onboarding and generation succeeded without a seed. The actual
in-app injury screens accept region, area and severity, then apply immediately.
They do not offer painful movements. The shoulder/slight flow applied 5/10;
`painful-entry-before.yaml` then failed to find `injury-trigger-pressing`.
This is a real missing input surface, not a successful painful-trigger test.
Existing compiler-trigger protection remains green but does not close this UI
gap. The removal is explicitly protected by older guided-injury UI tests; a
question about restoring that step has been sent to Sam, without holding up
independent work.

The actual reported shoulder modifier survived app termination/reopening,
displayed in My Status, cleared through **Injury resolved → Clear and update
program**, and stayed absent after another reopening. One initial test used the
generic clear-action id instead of the injury-specific id; the observed label
fixed that automation error. The first restart probe also supplied an invalid
diagnostic-purpose string; ordinary app termination/relaunch occurred, but the
flow now uses valid `action-reload` / `final-step-reload` values. A clean rerun
is required before calling the final flow complete.

Add-session simulator checks and final exact-checkpoint release verification
are still in progress. Native evidence, including unsuccessful probes, remains
under `baseline-1922a995/`.

### New native removal finding and existing-owner correction

Actual sequence: real onboarding → add Mobility on Saturday rest → add another
Mobility → Undo → re-add → reopen → Remove. Removal reported **“Your plan already
has that, so nothing changed”** while both sessions remained. The before/after
screenshots are `remove-two-mobility-result.png` and
`after-remove-two-mobility.png`. This was not classified from a failed selector:
the observed result and unchanged day established the defect.

`lowLoadRemovalJourney` reproduced it in **8/8 athlete/session-kind worlds**:
male/female × Mobility/Recovery first × Mobility/Recovery second. Baseline:
32 passing assertions, eight removal failures. All state is reached through
real onboarding, Add, Undo, re-add and restart, then the same durable action
called by the native screen. No saved-state fixture was invented.

Ownership review: the visible plan is derived from canonical accepted effects;
the screen sends a typed removal through the existing program-control door to
`stageAthleteSessionDeletionTransaction`. That owner treated an active record
for the same target as proof that the requested effect had already happened.
But Add/Swap uses that target with a nonempty remaining workout. Options were
(1) compare effects at this existing idempotency owner, using its existing
semantic workout fingerprint, or (2) redesign constraint identities and migrate
all writers/readers. Option 1 preserves the current architecture and addresses
the missing distinction directly. No new resolver, write format or finaliser.

The owner now compares the remaining-workout effect as well as the target.
After correction, **64/64 assertions** pass across the eight worlds, including
removal → reopen → Undo removal → reopen and exact restoration of both sessions.
The existing deletion matrix remains **147/147** across 18 deletion coordinates
(eight whole-day, six strength, four conditioning). All three TypeScript scopes
have zero errors. The new journey is in the release compiler witness; a mutant
restoring the target-only shortcut is required to fail before final acceptance.
Native verification of the revised application is still owed.

### Broader diagnostic registry, separate from the four C12 failures

`test:law-registry` reports three failures on both untouched 263369ba and the
follow-up: nonexistent `test:game-feedback`, unregistered LR-18, and 21 of 208
law rows marked UNENFORCED. These are baseline diagnostic debt, not introduced
by this change, and not evidence that the whole diagnostic fleet is green.
No law was quietly waived or marked guarded to make that result pass.

## What catches the next defect of these classes

Category vocabulary is checked against real selection and rendering, rather
than the existence of a deleted translation function; mutations prove it is
live. Spacing analysis includes Speed, deloads, illness, actual efforts and
alternative receiver sets, rather than treating a repeated heading as a bug.
Native journeys must reach the actual input/control and compare resulting
content after Undo/Clear/reopen; compiler-only coverage cannot stand in for an
absent screen.

## NOT COVERED

- Painful-movement input through real screens: missing UI, unresolved.
- Remaining native Add/occupied/game-adjacent combinations: in progress.
- Physical iPhone acceptance, installation or phone resets: none performed.
- Clinical validation or a claim that every prescription is ideal.
- A new full-year generation run: application unchanged; all affected weeks
  were replayed identically, and original 52-week evidence was preserved.
- Final exact-checkpoint release run for this test/documentation change: pending.
