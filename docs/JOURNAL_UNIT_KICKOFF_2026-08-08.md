# JOURNAL UNIT KICKOFF — SCOPE RULED (2026-08-08)

Sam, verbatim: **"I want it all in the journal"** — full scope selected.
This closes the addendum's open selection. The unit builds after the
compound-bucket order lands; day-first UI's remaining sketches (the icon
shortcut row, the four-action menu) PARK behind it, per Sam's "build the
journal after this" (his ruled roadmap order: day-first → journal → coach).

## SCOPE

Everything in both design docs:

- **Base design** (docs/JOURNAL_DESIGN_2026-07-23.md — APPROVED, source of
  truth, not re-litigated at build time): Journal tab (permanent home,
  launch build), Monday card via local notification (its five contents in
  order), post-game feel rating (the linchpin — do not cut), free notes +
  tags with resurfacing, monthly review, progressive data states,
  assume-prescribed / edit-by-exception logging, deliberate exclusions
  stand (no streaks, badges, AI summaries).
- **Full addendum** (docs/JOURNAL_DESIGN_ADDENDUM_2026-07-28.md), all 11:
  Group 1 (exposure counts not completion counts; what changed / what was
  protected; the calm week-status line; this week's job; week-shape strip;
  physical post-game wording; sleep/illness/travel tags) AND Group 2
  ("session felt different" one-tap exception; niggle history; progress
  markers; the staged data-state schedule).

## ALREADY RULED — CITE, DON'T RE-ASK

- The base doc's open question ("drop rep ranges so the assumption is
  unambiguous") was settled by Sam in the Bible (the reps PRESCRIBED vs
  WRITTEN entry): athlete sees a SINGLE MIDDLE NUMBER — 3×8–12 is written
  3×10; assume-prescribed logging reads exactly what was shown. Build to
  that; no question goes to Sam.
- Architectural stance is NON-NEGOTIABLE from the base doc: the Journal is
  a reading surface (projection) + record-only notes. It is NOT a mutation
  door; notes never derive program state. Everything on-device,
  deterministic — zero privacy-label changes.

## THE UNIT MUST SETTLE FIRST (inherited, named in the base doc)

**CORRECTED IN PLACE 2026-08-09, MEASURED AT `804a7e0f`: two of these three
items no longer exist.** They were inherited verbatim from the base design doc
(written 2026-07-23) and were already false when this kickoff was written —
resolved by deletion on 2026-07-25. Full receipts in
docs/JOURNAL_UNIT_PLAN_2026-08-09.md §1. Struck rather than deleted, so a
future reader does not re-derive them from the base doc a third time.

- ~~The logging tree has never run: `LoggedSet` lacks `actualRpe`/`completed`
  while the code reads and writes both; the journal screens are unmounted
  (barrel files nothing imports). NOT a working baseline to extend — decide the
  type deliberately, fix type + implementation together. The 15 errors are
  baseline-suppressed naming the design doc as owner.~~
  **MOOT.** `WorkoutLoggerScreen`, `SetLoggerRow`, `useWorkoutLog`,
  `workoutService` and all of `src/screens/journal/` were deleted in `2df51650`
  (ancestor of `main`, verified by `merge-base`). `actualRpe` appears in no
  source file. `cluster-B-logged-set-fields` owns **zero** live entries in
  `scripts/typecheck-baseline.json`, whose own `_ownership` note records the
  deletion. **There is no baseline to extend and no type decision owed — this
  is greenfield.**
- ~~The hand-maintained `src/types/domain.d.ts` beside `domain.ts` is standing
  drift — one owner, per L15/one-write-format law.~~
  **MOOT.** `src/types/domain.d.ts` does not exist; only `domain.ts` remains.
- **LR-18 rides this unit** (census ruling): `workoutLogStore` is
  in-memory, logged sets don't survive relaunch — diagnose, then persist
  or delete under the store-armour recipe (one door/tape/quarantine).
  **STANDS — and it is already diagnosed and gated.** Nothing writes the store;
  `resultsPersistOwnershipTests.ts:317` holds that line and reds the moment a
  set-logging surface appears. Ruled DELETE (not persist) in the plan §5,
  because Sam's own logging model rules per-set entry out. Sam holds a veto.

## STANDING RIDERS (honoured, from the addendum)

1. Reasons are only partially captured — the Journal shows an honest
   "no reason recorded" state, never invents a why.
2. Every status line and observation-line template is athlete-affecting
   authored copy: ships PROPOSED, provenance-locked, batched to Sam for
   signing — the Journal must not become a channel of unauthored words.
   BATCH the signings: one sheet per boundary, not per sentence.
3. Observation lines place facts side by side, never claim causation.

## BUILD SHAPE

Full scope is the destination, not the first commit: slice vertically
(L16), athlete-visible first (Sam's standing VISIBLE-FIRST direction) —
the tab + a real Monday card on his phone before the long tail of
surfaces. Sam's device pass is the merge gate as ever (L10/L11: matrix
and walker green BEFORE his phone). North-star note for every boundary
report: the Journal is the derive-don't-store thesis as a feature — it
reads existing facts and stores only what the athlete says (notes, one
rating, one exception tap).

## AMENDMENT, SAME DAY — CORRECTED IN PLACE, IN THE SECTION THAT WAS WRONG

The first version of this amendment ordered a "day-first close-out" before
the journal. Sam caught it within the hour: THOSE RULINGS ARE ALREADY
BUILT — four-action menu (PlanChangeSheet.tsx:69), repeat-week retired
(ruling 1), "Edit exercises" modal retired (ruling 12), injury-"Other"
traced 30 July. The seat had repeated a stale status table and NOW.md's
"rulings owed" line without reading the code. The close-out is RETRACTED;
the only remaining pre-journal work is correcting those two stale doc
sources (inbox item 2). THE JOURNAL FIRES IMMEDIATELY AFTER THE
COMPOUND-BUCKET BUILD, per Sam: "move immediately onto the journal."
