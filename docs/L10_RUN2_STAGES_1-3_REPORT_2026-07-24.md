# L10 Run-2 — Stages 1-3 implementation report (2026-07-24)

Branch `l10-run2-stages-1-3` off `main`, staged commits, tests-first throughout.
Full `test:bible` gate **green** including every new boundary test; typecheck
ratchet green.

**Process note (L10):** nothing here is claimed as PASS. Code + tests are green,
but device acceptance on Sam's phone is the merge/acceptance gate and has not
happened. The keyboard and session-screen changes in particular are native and
need Sam's device pass.

Commits: `8c88673` (run-2 baseline a/c/d/e) · `9949f62` (Stage 1) · `84c565a`
(Stage 2) · `2670c98` (Stage 3).

---

## Stage 1 — coach add_session ownership + no raw diagnostics reach the athlete

### Census #1 — coach add_session now §18-owned
`defaultApplyAddSession` wrote the new session via a raw `setManualOverride` with
no `UserRemovalConstraint` pin, so a coach-added session was not owned by §18 and
could be silently canonicalised back to Rest on a later repair (false-Done /
silent content loss, L6). It now materialises through `finaliseWorkoutAfterMutation`
and commits through `commitAthleteSessionAdditionTransaction` — the same owner the
tap door uses. Survival of an accepted add is guaranteed by the owner's own gate
(`sectionOwnershipInvariantTests` #10, green), which the coach path now shares.

**Discovered + fixed (pre-existing, in-theme):** the pre-apply §18 risk gate
(`hardStopRiskRejection`) let a raw `Section18WeekAcceptanceError` **escape the
whole coach turn** — crashing it and reading a raw diagnostic to the athlete when
an add breaks a week rule (e.g. removing the only rest day). It now converts a
thrown validation error to a safe, plain-language refusal via `athleteSafeRefusal`.

**Test note (honest):** in the standard in-season seed the pre-apply guard
correctly refuses an add to the sole rest day *before* `applyAdd` runs, so the
writer can't be reached behaviourally there. `coachAddSessionOwnershipTests`
therefore proves: (1) the coach add is never applied-but-unowned (no false-Done),
(2) an owned add survives a §18 repair byte-intact (when reachable), (3) a refusal
never leaks a raw internal reason, and (4) a source contract that the writer uses
the transaction owner + finalisation, not a raw override. Survival of an accepted
add is transitively covered by the owner's invariant #10.

### Census #3 — CoachScreen developer-TODO leaks
`buildNoOverrideFallbackReply` / `buildNoVisibleDiffFallbackReply` spliced raw
TODOs ("Investigate event targeting…") into the chat bubble. They now read the
owner's plain-language copy (`COACH_NO_OVERRIDE_FALLBACK` /
`COACH_NO_VISIBLE_DIFF_FALLBACK` in `planChangeRefusalCopy`); the failure-mode
diagnostic stays log-side.

### Census #8 / addendum (i) — adjustment-undo Alert
`useHomeScreen`'s "Couldn't restore this adjustment" Alert routed `result.reason`
(a raw transaction `error.message`) verbatim. It now goes through `athleteSafeRefusal`.

`athleteSafeRefusal` was extended to catch embedded snake_case tokens and §18
rejection strings (`full_rest_miscount`, "Section 18 final-week rejection", …).

**Tests:** `coach-add-session-ownership` (4), `coach-failure-copy` (6),
`athlete-safe-refusal` (12).

---

## Stage 2 — custom flush Done bar (Sam ruling: NO float)

`KeyboardDoneAccessory` is rebuilt from lower-level primitives: a full-width bar
inside `KeyboardStickyView` with a **zero opened-offset**, so it sits flush on the
keypad with no gap on every iOS version. (The library's `KeyboardToolbar` floats
as a rounded pill on iOS 26+, keyed on `Platform.Version` with no prop to defeat
it — that float read on-device as a gap.) Gated on `useKeyboardState` so it only
mounts while the keyboard is visible; dismisses via `KeyboardController.dismiss()`.
The `hasTextInput` gate is unchanged.

### Addendum (ii) — the last two keyboard drifts (census #9)
Both now route through the shared owner:
- **DayWorkoutScreenV2's whole day scroll** → `KeyboardSafeArea` (so the inline
  weight editor's numeric keypad finally gets the Done bar). `KeyboardSafeArea.scrollProps`
  gained an `onScrollBeginDrag` pass-through for the sticky-header handler;
  `dismissOnBackgroundTap` off (the body is a tappable list).
- **ProfileScreen's SetupUpdateSheet** → `KeyboardSafeArea`.

**Contract tests updated (34/34).** Flush positioning and the two migrated
layouts are native — they need Sam's device pass (flagged prominently in code).

---

## Stage 3 — content ownership unit (Part B, B5 §1-7 approved as written)

**(a) One canonicalisation boundary.** `canonicalExerciseName` resolves any
incoming name onto Sam's curated vocabulary (curated cue key → case-insensitive →
load-alias resolver) before any athlete-visible reader uses it. **Scoped to the
cue-subject paths via `buildCueText`, NOT applied generically** — a deliberate
choice: the conditioning builder emits unbounded parameterised names that no alias
table can close, and they are safe only because they never reach the cue boundary.

**(b) Retire the raw-string lookup.** `buildCueText`/tag lookup route through the
boundary. Carry-family plural/possessive aliases added, so the AI backend's
"Farmers Carry" resolves to the curated "Farmer Carry" (census #4).
`AddExerciseModal`'s `'Farmers Carry'` literal fixed to canonical.

**Generic branch unreachable in product.** `buildCueText` returns **nothing**
(not the generic filler) for any name that doesn't land on a real curated/family
cue. This absorbs the two non-pool `defaultProgram` fallbacks (`Hamstring Curl`,
`Mobility Flow`) and any off-vocabulary AI name: the athlete sees a curated cue or
no cue, never generic prose.

**(c) Generator notes removed.** The strength/recovery cards no longer render
`exercise.notes`; the curated cue is the always-visible lead, never collapsed
behind a note-gated "Form cues" disclosure. Generation provides structure only.

**(d) Boundary tests.** `exercise-canonicalisation` (12): vocabulary-closure,
no-generic-in-product, anchor-resolves, ordering, + the "Farmers Carry" fixture.
(Confirmed by a coverage sweep: 100% of `STRENGTH_POOLS` + `POOL_REGISTRY` names
are already cue-covered.)

**(e) Copyedit.** Sam-authorised mechanical punctuation pass — terminal stops + one
stray trailing comma on 43 authored cues, **zero word changes**, applied
identically to `docs/CUE_CHANGESET_2026-07-23.md` so `authored-cues` doc↔code
equality holds (40/40). Authorisation noted in the provenance header.

---

## NOT COVERED (L2 mandatory)

- **Device acceptance** — none of the shipped changes is claimed as PASS; Sam's
  phone is the gate. The flush Done bar, the two keyboard migrations, and the
  session-screen cue/notes layout especially need a device pass.
- **Addendum (iii) — readiness-copy bypass (census #6).** Assessed as **NOT cleanly
  mechanical** and carried here with its named owner. Five sites let an inline
  `modifierTitle` win over `readinessFactTitle` (`activeProgramModifiers.ts:898`
  uses `modifierTitle ?? fallbackTitle`): `tapProgramModifiers.ts:57` ('Recovery
  mode active') and `:87` ('Load reduced this week'); `coachConstraintProducers.ts:237`
  (same, coach-chat door) and `:288` (body-part soreness); `readinessConstraints.ts:56,87`
  (likely-superseded — **confirm dead before touching**). Recommended owner:
  `readinessFactTitle` (`readinessFactAttribution.ts`); recommended fix: stop
  passing `modifierTitle` for readiness-typed constraints (a deletion) so the
  owner's tiered copy applies — but it needs verifying that `fallbackTitle`
  actually yields the tiered copy and that the 5th site is dead. Deferred.
- **`Mobility Flow`** — a recovery-session placeholder emitted as an exercise. It
  no longer shows a generic cue (renders none), but the clean fix is architectural
  (route recovery-session descriptors around the cue boundary in `defaultProgram`).
  Not done.
- **Addendum (iv) — dead-code landmines → Phase 1.6 purge.** `AddExerciseModal.tsx`
  (orphaned) had its literal defused, but the full-file deletion and the dead
  `supabase/functions/generate-program` plural spellings belong to the Phase 1.6
  purge list. Recorded, not purged here.
- **Classic `DayWorkoutScreen.tsx`** — unreachable (dead-affordance inventory); the
  Stage 3 notes/ordering changes were not applied there. The cue-join and
  canonicalisation flow through the shared helper, so it inherits those.
- **A KeyboardSafeArea-vs-bare-ScrollView guard test** — deferred: distinguishing
  an owner-wrapped scroll from a bare one reliably in a source contract is
  non-trivial, and remaining offenders are unreachable/owner-wrapped.

## Pre-existing failures (do not misattribute)
`test:plan-change-producer` → 238 passed, **23 failed** (all `[19] Team Training`
replacement) — verified identical on clean `main` earlier this session. Not in
the `test:bible` chain; untouched by this unit.

## New test scripts (all in `test:bible`)
`coach-add-session-ownership`, `coach-failure-copy`, `exercise-canonicalisation`
(plus the run-2 `cue-join`, `athlete-safe-refusal`, `video-modal-fill`).
