# The recovery-choose door — unit boundary report (2026-08-05)

Sam's ruling (docs/DISPLAY_TIMES_RULING_2026-08-05.md §1): the 2026-07-31
charter ruling STANDS — the app never places recovery uninvited — and the
device-pass finding 3 defect is that **no findable athlete door existed to
CHOOSE a recovery session**. This unit is that door.

## What the red cell taught before the fix

The first draft of the cell asked the PRODUCER and **passed** — the chartered
`recovery` category was offered on his week all along
(`listPlanChangeOptionsForDay().categories`). The phone still had no door,
because the SHEET's render vocabulary was five hardcoded MenuOption rows that
could not reach it. The same enters-below-the-door shape this repo has now
named five times, one layer higher than usual: the offer model was right and
the RENDER vocabulary was the gap. A `recoveryIcon` already existed in the
sheet, unwired — the authored source already exists, again.

## What landed

1. **`src/screens/home/planChangeTypeMenu.ts`** — the type menu as DATA
   (plain module, L14). Each row names the category ids whose offer makes it
   visible AND which its flow reaches; visibility and reachability are one
   list on purpose.
2. **`PlanChangeSheet`** derives row visibility from the model
   (`rowOffered(...)` replaces five hand-written `offers(...)` conditions)
   and gains the recovery row: `copyFor('recovery')` copy (the
   `CATEGORY_COPY` row — one name for the door), `recoveryIcon`,
   `chooseType(mode, 'recovery') → chooseCategory(mode, 'recovery')`,
   testID `plan-change-type-recovery`.
3. **The findability cell** (`finding-3`, `test:device-pass-2026-08-05`):
   every producer-offered category id must be menu-reachable. It went red
   with exactly `[recovery]` before the fix and is green after.
4. **The walker walks the door**: `recovery` re-entered `CATEGORIES` with the
   supersession chain recorded in place (charter halves stand; the CHOOSE
   grant returns). Probed through the door: an empty-Sunday recovery add
   lands a pure recovery day whose template and components AGREE
   (`recovery`/`["recovery"]`); occupied-day adds land as `recovery_addon`.

## Convergence

Toward. The menu's render vocabulary moved from five JSX conditions to one
declared model the gate reads — a representation the screen and the harness
now SHARE instead of shadowing each other. No stored state added.

## The stale-debt fallout, recorded so it is not mistaken for paid

Adding a ninth category shifted every seeded walker path, and the deep tier
stopped reaching `session_list_calls_a_conditioning_day_recovery` (L-P3: the
session list shows a recovery day over conditioning work). **The defect is
OPEN** — `buildSessionTemplate` still short-circuits on `isRecoveryWorkout`
(`sessionTemplate.ts:248`) while `getSessionComponents` can disagree. The
entry was deleted because the stale-debt cell demands it of a valid run
(unlike 2026-08-01's invalid stale-report), and the debt moved to this
report and the deletion-site comment. Owner unchanged: the D13
session-template owner. Suspected reach coordinate: a G+1 derived-recovery
replacement keeping attached conditioning — the athlete-door add was probed
and does NOT diverge.

## NOT COVERED

- The recovery row's copy (`CATEGORY_COPY.recovery`: "Recovery" / "Rolling,
  mobility, easy movement, breathing") renders athlete-visibly for the first
  time. If it is not among the signed batches, it rides Sam's next signing
  batch with parked §11.
- No mounted-render assertion exists for the row (unmountable in this repo);
  findability is asserted at the model the sheet renders from, and the
  device pass is the last instrument.
- The L-P3 disagreement above: open, unreached, owned.

## L12 — what catches the next defect of this class

A chartered category added tomorrow that no menu row reaches fails
`finding-3` immediately (offered ⊆ reachable is asserted, not enumerated).
The inverse defect — a menu row whose flow targets a category the model does
not declare — is contained by the sheet deriving visibility FROM `reaches`;
divergence would need a hand-written condition, which the model refactor
just removed.
