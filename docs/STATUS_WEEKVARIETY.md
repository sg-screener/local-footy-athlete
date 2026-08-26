# STATUS — weekly strength variety (`weekvariety`, 2026-08-26)

## Owner request

Audit item 4: generated strength weeks repeatedly chose Bench Press, Back Squat,
RDLs and similar first-listed exercises while legal alternatives such as DB
Bench Press and Pull-Ups never appeared. Sam asked for the fix after the cue,
spare-day and conditioning items, without replacing the app's existing
programming architecture.

## What was actually wrong

The app already had one deterministic block exercise selector and a persisted
selection-history store. The selector was not simply choosing array index zero.
Its durable key was too broad: one decision was recorded per movement slot per
block. When `horizontal_push`, `squat` or `hinge` appeared for a second time in
the same week, the composer restored the first occurrence's answer.

Push and pull had a second source-order problem. Each upper day visits the
horizontal plane before the vertical plane, and the first row of the pattern
owns the main-lift role. Horizontal therefore led every upper day even when a
vertical main option such as Pull-Ups was legal.

### Test-first measurement

The new guard drove 40 full-gym profile worlds through the real local program
generator:

- both genders;
- In-season, Pre-season and Off-season;
- 3, 4, 5 and 6 requested gym days;
- club and no-club worlds where the phase permits them.

Before the fix it counted **64 repeated weekly exercise-identity occurrences
across 20 distinct profile worlds, denominator 40 profile worlds**. The named
Pre-season four-day control contained neither DB Bench Press nor a Pull-Up /
Chin-Up main exposure.

## Options compared

1. Filter the already-used exercise out when rendering or composing the second
   row. This was smaller, but it would create an alternate choice that the
   accepted selection history did not own. A relaunch could disagree with the
   visible week.
2. Keep the existing selector and history as the one owner, but refine the
   decision identity to movement slot plus zero-based weekly occurrence. Balance
   which push/pull plane leads at that same composition boundary.

Option 2 landed. It adds a field to the existing decision record; it does not
add a second selector, snapshot or persistence owner.

## What changed

- Every repeated weekly movement slot now receives a distinct `seatIndex`.
- Selection history, in-run restoration and generation acceptance all key by
  `slot + seatIndex`.
- Legacy history rows with no seat field lift to seat zero at read ingress. New
  writes always store the canonical seat.
- New seats prefer an unused legal same-pattern identity. Recorded seats may
  restore their exact legal identity, keeping the block stable.
- Push and pull alternate which available plane owns the main role across the
  week: horizontal first, vertical on the next exposure, with a legal fallback.
- The existing full-body balance gate now reads the composer's typed slot
  evidence instead of an incomplete exercise-name regex; the former regex
  incorrectly called Incline Bench "not a push".
- R-241 and its guarded law row record the ruling and the in-chain guard.

## After

The same matrix generates 40/40 worlds and counts zero repeated identities in
the seven governed strength slots (`squat`, `hinge`, `single_leg_knee`, both
push planes and both pull planes).

The real four-day production seed visibly carries:

- Tuesday: Bench Press, Barbell Row, DB Shoulder Press, Lat Pulldown;
- Thursday: DB Bench Press, Seated Cable Row, Landmine Press, Pull-Ups.

Lat Pulldown and Pull-Ups are the two vertical-pull seats. Barbell Row and Seated
Cable Row are the two horizontal-pull seats.

The four-week guard proves each present seat holds its identity through the
three build weeks. The deload may remove support rows but may not introduce a
new identity for that slot.

## Liveness / mutation receipts

- Forcing every occurrence back to seat zero restored all 64 repeated
  identities across the same 20/40 worlds and killed three named cells.
- Freezing push/pull leadership at horizontal killed the DB Bench/Pull-Up
  control while the general no-repeat cell stayed green. The leadership cell
  therefore watches a separate subject.
- A proposed special pool branch for repeated main exposures was mutated back
  to the existing branch and every cell survived. The branch was dead and was
  removed rather than shipped.

## Verification

Green:

- `test:weekly-strength-variety` — 5/5;
- `test:full-body-balance` — 10/10, then the in-chain variety guard 5/5;
- `test:block-selection-authority` — 5/5;
- `test:rdl-family` — 7/7;
- `test:generated-week` — 36/36;
- `test:weekly-scheduler`, including spare-day options — 20/20;
- guarded Maestro on iPhone 17 Pro / iOS 26.3 — Thursday reached DB Bench Press
  and Pull-Ups and completed; Tuesday separately displayed its four named rows.
- `git diff --check` — clean.
- compile output contains zero diagnostics in the changed source/test files.

Inherited red, unchanged by this item:

- `test:composer-b1` — 47 pass / 3 fail: stale anti-overfit source scan,
  canonicaliser restore assertion and phase-clock assertion;
- `test:exercise-rotation` — fixture refuses before cells because gender is
  missing;
- `test:composer-severance` — its stale fixture reaches no generated worlds and
  later reads an absent history array;
- `test:law-registry` — 3 inherited failures: nonexistent `test:game-feedback`,
  missing LR-18 registry row and 21 UNENFORCED laws;
- `test:ruling-registry` — 2 inherited failures: 9 UNENFORCED rows over its old
  ceiling and 16 existing uncited questions. R-241 adds no new uncited question.

## Workspace housekeeping

Running `scripts/print-composer-completion-weeks.ts` as a diagnostic rewrote
eight tracked generated reports to stale missing-gender refusal output. Those
reports were clean before this item and are unrelated to the strength fix. They
remain unstaged. The safety reviewer refused an automatic restore, so restoring
those exact files is waiting on Sam's explicit approval.

## NOT COVERED

- Physical-iPhone Release acceptance (the simulator is not Sam's phone).
- The complete partial-kit × injury × exclusion matrix.
- More weekly occurrences than a same-pattern pool can legally supply.
- Conflicting athlete pins/preferences across two weekly seats.
- Several successive block rollovers with accumulated progression feedback.
