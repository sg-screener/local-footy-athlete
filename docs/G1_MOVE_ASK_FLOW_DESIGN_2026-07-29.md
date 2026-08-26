# G-1 Move Ask-Flow — athlete-placed content outranks derived filler

**Unit G-1. Ruled by Sam 2026-07-28/29. Status: SHIPPED — `test:bible` EXIT=0.**

Generation never plans hard strength or conditioning on G-1. That law is
unchanged. This unit is about what happens when the ATHLETE puts a session
there: the app stops silently substituting or refusing, warns once, and offers
the current gender-appropriate named routes.

---

## 1. The defect

Probed against the seeded `practice match` scenario (`athleteSessionMoveTests`
case 12, Pre-season, phase entry −2 weeks, practice match on Saturday):

```
composed week (athlete's, pre-resolver)      visible week (post-resolver)
  Mon  Full Body Strength   core               Mon  Full Body Strength
  Tue  Hard Intervals       core               Tue  Hard Intervals
  Wed  Upper Push           core               Wed  Upper Push
  Thu  Upper Pull           core               Thu  Upper Pull
  Fri  Rest stub                               Fri  EMPTY
  Sat  practice match anchor                   Sat  Game Day
```

Move Monday → Friday and `commitAthleteSessionMoveTransaction` throws:

```
athlete_move_content_not_conserved
Move would silently destroy session w1:monday:none:strength
```

The chain:

1. `applyUserRemovalConstraintsToWeek` (`rules/userRemovalConstraints.ts:61`)
   correctly places the athlete's session on Friday.
2. `applyGameProximity` (`utils/sessionResolver.ts:659`) then overwrites it with
   the derived G-1 Gunshow.
3. The conservation post-condition in `commitAthleteSessionMoveTransaction`
   detects the loss and correctly refuses the whole move.

Step 2 is the defect. The G-1 branch does have a protection guard —

```ts
if (isProtectedCoreExposure(templateWorkout) && !explicitGameDates.has(nextDate))
```

— but it is disabled for EXPLICIT fixtures. A practice match is an explicit
calendar mark, so the guard is bypassed and the derived filler wins. Before the
practice-match ruling (`db9a9af`) the Saturday fixture was virtual, the guard
held, and this row passed. That is why exactly one matrix row broke.

**Root cause, stated as law: derived filler outranks athlete-placed content.**
Sam's ruling inverts it.

## 2. Two refusal doors, not one

The ask-flow has to replace both, or the practice-match case keeps falling
through to a generic failure.

| Case | Door | Today's athlete-facing outcome |
|---|---|---|
| G-1 visibly shows the Gunshow (normal in-season week) | `resolveAthleteMutation` → `move_destination_resolver_owned` (`utils/planChangeProducer.ts:1093`) | *"That day is kept light around your game, so a session can't be moved onto it."* |
| G-1 visibly empty but still G-1 (practice match; canonical Rest stub) | conservation post-condition throws | *"I couldn't safely make that change, so the plan is untouched."* |

## 3. Design

Four touches. No new resolver, no new resolution of the athlete's request, no
compatibility branch.

### 3.1 Ownership condition — one site

`applyGameProximity`'s G-1 branch never displaces an **athlete-placed** session,
explicit fixture or virtual. This is the whole law, applied where the violation
happens.

The placement stamp is written at the single site athlete content enters a week
— `applyUserRemovalConstraintsToWeek`, the sole applier of
`UserRemovalConstraint.movedWorkout`. The stamp is DERIVED from the constraint
at application time; the constraint stays the only stored representation. No
second source of truth is created.

§18 repair relocation does not pass through that site, so it does not receive
the stamp: automatic heavy relocation onto G-1 stays refused exactly as today.
`athleteSessionDeletionTests` regressions 14/15 pin this. **The ask-flow is the
only door onto G-1.**

### 3.2 The ask reuses the existing typed classifier

`gMinusOneHardStopFindings` (`utils/programEditRiskAssessment.ts:305`) already
emits a typed `g1_hard_work` hard stop and already knows the offending unit's
category and stress. It stops being a dead end and becomes a typed offer,
carried on the producer's existing blocked-assessment channel and rendered as a
new `PlanChangeSheet` step beside `confirm_warning` / `block_warning`.

The ask fires only for sessions that classifier already calls hard. A recovery
or mobility session moved onto G-1 passes straight through as it does today —
the existing G-1 branch already preserves recovery and rest.

### 3.3 The current routes — one direct menu (Sam, revised 2026-08-26)

Every landing type reaches the same typed route owner. Male athletes see Same
session but easier, Gunshow, Primer and Accessories only. Female athletes see
the same ordered menu without Gunshow. Go back is the only no-op; the historical
keep-day route remains readable but is no longer rendered.

Accessories only keeps accessory work when the source can be split honestly;
otherwise it materialises the authored pump session or refuses rather than
claiming an unchanged full session is accessories. Gunshow and Primer each
materialise their own authored session.

**Reduction mechanism:** exactly one. Same session but easier applies
`applyStrengthDeloadToExercises` + `applyConditioningDeloadToExercises`
(`rules/deloadWeekRules.ts`) under a `resolveDoorDeloadPolicy`-shaped policy.
Its day-scoped `preserveExerciseSelection` mode keeps every selected row while
reducing its dose. A typed G-1 adjustment tells the shared stress classifier
that this athlete-chosen result is low stress. The Add stack keeps that marker
only when the content already on the day is also low stress, so it cannot mask a
team night or a separate hard session. Accessories only continues to reuse the
accessory/main-lift classification in the same module.

### 3.4 Typed option list, extensible by construction

The menu is a typed list, not hardcoded UI branches. Primer is now an authored
route in that list. Gender filtering changes only which typed route is offered;
the producer and materialiser still read the same registry.

### 3.5 Transaction ownership

All committing routes go through the accepted plan-change transaction. Move's
constraint keeps the FULL accepted source session so Undo restores exactly what
was there; Add and Swap use their existing canonical candidate materialiser.
The route button commits with the trace from the preview that raised the ask,
instead of previewing the same action again. That is what makes the warning one
warning while leaving the commit boundary responsible for the real write.

## 4. Warning copy — authored, signed by Sam 2026-07-29 and 2026-07-30

Day names resolve from the actual fixture and source day; `Friday` / `Monday`
below are the seeded example.

**Sam signed the PATTERN, not four fixed strings (2026-07-30).** Once Swap and
Add raise the ask too, route (a) can be offered over a day that holds the
derived Gunshow, a recovery session, or nothing at all, and a swap has no source
day to name. His ruling:

```
Option 1 — name what the day holds, and Sam signs the pattern rather than each
string: occupied G-1 -> "Keep Friday's {session name} — what the day before a
game is built for. Your {source} stays where it is." (source clause only when
there is a source). Empty G-1 (rest stub) -> "Leave Friday free — rest before
the game." Day names always dynamic. Same voice as the signed originals;
anything that can't be expressed by the pattern comes back for signing.

Option 1 — drop the clause when there's no source; the remaining copy stands
as signed.
```

A blockquote is how this section files ATHLETE-FACING copy, and the equality
gate reads every one of them. Sam's ruling is quoted in a fenced block for that
reason: it is prose about the copy, not copy.

Every rendering the pattern produces is filed below and pinned in both
directions by `g1LandingAskFlowTests` 18.

**The one confirmation — revised by Sam 2026-08-26.**

> **Are you sure?**
> Train hard Friday and you'll feel it Saturday
>
> - **Same session but easier**
> - **Gunshow**
> - **Primer**
> - **Accessories only**
> - **Go back**

The male menu shows all four choices. The female menu is identical except that
Gunshow is absent. Every choice is an obvious bordered box with no subtitle.
Go back is the only way to abandon the change, so **Leave Friday free** is no
longer duplicated as a visible option. The ask itself is the confirmation;
Same session but easier does not open a second warning. It keeps every exercise
the athlete selected and reduces the work inside the session; a one-row session
therefore remains one row instead of becoming an empty refusal.

## 5. Escalation boundary

Sam's standing rule applies. If honouring athlete placement turns out to need
more than the contained condition in §3.1 plus the ask-flow — a second resolver,
another guard, a fallback, a finaliser patch — implementation STOPS and the
seven-question reassessment is written before any further code.

## 6. Gates

- `npm run test:athlete-session-move` — **22 passed, 0 failed** (case 12 fixed).
- `npm run test:athlete-session-deletion` — regressions 14/15 green; G-1 stays
  protected from silent heavy relocation.
- New suite pinning the ask-flow: menu uniformity, route outcomes, the
  no-transaction property of (a), DELOAD_LAW as the only reduction, the second
  warning on (c), and copy equality against this document.
- `npm run test:bible` — **EXIT=1, one red, and it is NOT this unit's.** See below.
- Merge brings `feat/practice-match-g1-hold` (`4a0de0d`) with it.

## 7. RESOLVED: the held commit's second red gate

`npm run test:power-counting` fails on the hold branch. Bisected across every
commit in this unit and the two below it:

| Commit | `test:power-counting` |
|---|---|
| `ca2a796` (main) | 13/13 green |
| `4a0de0d` practice-match ruling | **FAILS** |
| `ef85470` … `2f2bc2d` (this unit, 6 commits) | fails, unchanged |

**The held practice-match commit was the cause. None of this unit's commits moved
it.** The hold was recorded as blocked on ONE red gate
(`athleteSessionMoveTests` 12); there were two.

**Sam ruled it on 2026-07-29 and it is fixed** — see §8.

Failing scenario: `preseason-team-and-game` — Pre-season, one team training, a
Saturday fixture.

```
Section18WeekAcceptanceError: Section 18 final-week rejection
  (conditioning_intensity_mismatch:conditioning:{"mediumHardApp":1,"hardApp":0})
  authorisedReductions[1].detail:
    'Weekly selector budget=1; normal anchors=team_training,practice_match'
```

Under Sam's ruling a Pre-season fixture IS a practice match and its week IS a
game week. That week's exposure contract then requires a HARD app-conditioning
exposure, and the week — now game-week-shaped, with G-1 and G+1 protection
consuming days — can only supply a medium-hard one. The gateway exhausts its
repairs and returns `status: 'impossible'`.

This is not a test artifact. `impossible` is what the athlete would meet as
*"We couldn't safely build your week from your current settings."* on a
perfectly ordinary pre-season week with one team training and a practice match.

Everything else in `test:bible` was green, before and after this suite.

## 8. Sam's fixture-week ruling (2026-07-29)

> "In any fixture week — game or practice match — the game itself carries the
> hard conditioning exposure. The contract never requires a hard app-conditioning
> session in a game-shaped week; app top-up is moderate or easier."

Fixed at the contract/anchor-credit level. The COUNT side of that credit already
existed (`appCoreConditioning` subtracts one for a fixture week); only the
INTENSITY side was missing, so the row still read
`requiredAppHardMinimum: tt === 1 ? 1 : 0`.

`isFixtureWeekMode` is now the single owner of "a game and a practice match are
the same shape". It was spelled out inline at the anchor credit and nowhere
else — which is precisely why the intensity policy never learned the fact.

**The re-check Sam asked for.** Every week mode swept against every
team-training count in `section18ContractV2Tests`. The game-week row was the
only non-zero hard demand, and it fired for one arm of a ternary only. The sweep
is what stops it returning that way.

**Three authored assertions re-pointed, not deleted** — `section18PhasePlanner`
scenario 2, property P5, mutation M6 all required the top-up to be HARD. They
now require MODERATE: not hard per this ruling, not dropped to easy aerobic per
the contract's surviving medium-hard floor. M6 is strictly stronger than before
— it now kills an upgrade to hard, which the old form permitted.

The power-counting golden was regenerated: 49 lines, all inside
`preseason-team-and-game`, and NO conditioning content changed. This fix only
removed an unsatisfiable demand; the 49 lines are the practice-match ruling's own
effect on a scenario that used to throw before it could be recorded.

**R-223 (Sam, 2026-08-25), VERBATIM:** *"friday's gunshow instead"*. The row read
**Keep Friday's Gunshow**; he saw it on an EMPTY Friday and said *"it always says
keep fridays gunshow even if there is no gunshow programmed"*. The verb was the
fault, not the route: this route is offered only on an empty G-1, where its job
is to PLACE the session the day is built for, and "Keep" promises something is
already there. Route (a) — which really does keep what the day holds — is the
only row entitled to that word. The female path takes the same correction
(**Friday's Primer instead**), which he predicted before it was checked.
