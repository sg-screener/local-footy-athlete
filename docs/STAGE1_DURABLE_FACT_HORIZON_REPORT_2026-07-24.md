# Stage 1 report — durable fact horizon ownership

**Status: 5 of 8 invariants green, 3 RED and BLOCKED on a §18 ownership
decision.** `test:bible` green, typecheck clean. Not merged; not on a device.

Unit: Option B1 from
`docs/DURABLE_ATHLETE_STATE_FACT_OWNERSHIP_REASSESSMENT_2026-07-24.md`
(approved, plus Addendum A). Tests-first, per L9.

Run: `npm run test:fact-horizon`

---

## 1. What is green

| # | Invariant | State |
|---|---|---|
| T1 | a severe illness reported Friday reaches next week **and the week after** | **green** |
| T2 | `cooked_week` reaches next week (fact-level, not illness-specific) | **green** |
| T2 | `poor_sleep_week` reaches next week | **green** |
| T3 | clearing restores **every** week it reached, byte-exact, no residue | **green** |
| T5 | exactly one duration representation (static invariant) | **green** |
| T4 | `sick_week` leaves already-Done MON/TUE/THU untouched | **RED — blocked** |
| T4 | `cooked_week` — same | **RED — blocked** |
| T4 | `poor_sleep_week` — same | **RED — blocked** |

### The three duration representations are gone

`src/rules/durableFactHorizon.ts` is now the single owner. A fact's window is a
`{ startsFrom, endsAfter }` horizon where **`endsAfter: null` means open —
true until the athlete resolves it**. "Active until cleared" is expressible in
the type for the first time; before, `status: 'active'` and a calendar-expired
`effectiveUntil` could disagree about the same fact and nothing reconciled them.

Retired as duration authorities:

- `temporaryFactScope({kind:'week'})` **for durable state facts**. Severe
  illness, cooked fatigue and repeated poor sleep now mint their window through
  `durableStateFactScope({anchorDate, todayISO})`, which contains no `mondayFor`
  at all — the back-dating defect cannot be reintroduced by accident. Equipment
  and schedule facts, which are genuinely week-shaped, keep the old scope (Q6).
- `deriveIllnessRecoveryWeekMode`'s private overlap predicate — it now asks the
  owner and has no opinion about duration, so it cannot disagree with the fact.
- `affectedHorizon`'s `mondayFor(effectiveUntil)` in the fact transaction.
- `scopedRegenWeekStart = mondayFor(todayISO)` as the sole materialisation. The
  scoped regen now authors **every week the horizon reaches**, selected from the
  weeks the athlete actually has (the accepted program's microcycles). "Every
  week until cleared" means "every week they have", which is the only bound
  honest about what the app can author.

### The cascade extended with the horizon

One fact-linked reversible adjustment per reached week. `clear_fatigue_status`
already reverts every adjustment carrying a given `sourceFactId`, so no
mechanism was added — extending the horizon extended the cascade for free, and
T3 proves all three weeks come back byte-exact with zero residue. That was the
main risk in widening the horizon and it is closed.

---

## 2. What T5 caught — one regression and two latent defects

The static invariant earned its place immediately.

**A regression I introduced, caught by the gate (R19).** Making a fact's window
open broke `resolveVisibleReadinessState`, which compared `fact.scope.until`
directly: `null >= weekAnchorISO` is false, so **every open fact was filtered
out and the readiness card went blank** — for exactly the durable reports that
most need showing. Verified against an unmodified tree (R19 passes on `main`,
failed with my change) rather than assumed from the suite's own "expected RED"
footer, which would have misattributed it.

**My first cut of T5 did not catch it**, because the regex covered
`effectiveFrom`/`effectiveUntil` but not `scope.from`/`scope.until` — the same
two bounds under another name. Widening it surfaced **two more consumers with
the identical latent defect**, both now routed through the owner:

- `useHomeScreen.ts` — `readinessFacts` and `equipmentFacts` would both have
  gone empty for an open fact, blanking the coach note and the readiness list.
- `lighterDayTransaction.ts` — `activeReadinessFactIdForDate` would not have
  found an open fact, so an accepted lighter-day trim would have been authored
  **unlinked to its source fact**, silently breaking the R12 cascade undo.

Neither was reachable before this stage (no fact was ever open). Both would have
shipped as new bugs without the static invariant, which is the argument for
T5 existing at all.

---

## 3. What is blocked, and why it is not another line of code

T4 says a fact reported on Friday must not rewrite Monday, Tuesday or Thursday.

**Preventing the rewrite is easy.** Dropping the pre-horizon dates from the
overlay's `workoutsByDate` is byte-exact preservation by construction: both
resolvers fall through to the untouched base microcycle on a *missing* key
(`acceptedEffectiveWeek.ts:107`, `sessionResolver.ts:773`), and
`preserveExactAcceptedWorkouts` keeps that base clean.

**Doing it makes the landing week inadmissible.** With the drop in place the
commit is rejected and rolled back:

```
Accepted-state ledger mismatch for 2026-07-20:
  re-evaluation produced blockers maximum_breach, reduction_contradiction
```

Isolated executably — with the drop the horizon tests T1/T2/T3 all fail at the
commit; without it they pass and only T4 fails. So the blocker is the
preservation itself, not the horizon work.

**Root cause: §18 has no concept of an already-elapsed day.** A contract governs
a whole calendar week, uniformly, with no "as of" boundary. Grepped across both
`section18EffectiveWeekEvaluator.ts` and `weeklyExposureContractV2.ts`: no
`spent`, `elapsed`, `completed` or `delivered` anywhere, no
`Section18ReductionScope` for a partial week, and `Section18AuthorisedReduction`
only expresses *"we permit less"* — there is no vocabulary for *"this exposure
already happened and this policy does not govern it"*. `generateProgramLocally`
has no pinned-days input either, so the generator cannot author a week whose
first days are fixed.

A week of "three spent full-load days + a reduced remainder" therefore fails its
own reduced contract, because the delivered work exceeds the recovery envelope's
maximums and contradicts its authorised reductions. Both findings are *correct*:
the week really does contain more work than the illness policy permits. It
contains it because the athlete already did it.

**This is the same shape as the rider-0 finding.** There, credit was withdrawn
without a matching authorised reduction; here, content is delivered without a
matching allowance. Both are "the contract describes a week the actual week
isn't, and the transaction resolves the disagreement by destroying the athlete's
report". Same class, second occurrence — the CLAUDE.md escalation trigger — so
this stops here rather than being patched at the call site.

`horizonStart` is threaded through the materialisation owner ready for whichever
answer is chosen; the drop is one line, commented in place.

### Worse than the record states

The reassessment described the retroactive rewrite as marking completed sessions
"optional". Measured, it is more than that — it **destroys the content of
sessions the athlete has already completed**:

```
sick_week        TUE Team Training/core/High/3ex  →  Team Training/optional/Light/0ex
cooked_week      TUE Team Training/core/High/3ex  →  Team Training/core/Moderate/0ex
                 THU Team Training/core/Moderate/3ex → Team Training/core/Moderate/0ex
poor_sleep_week  MON Strength/core/High/3ex       →  Mixed/core/Moderate/4ex
```

A Done session losing its exercises is a false record of what the athlete did.
Under L6 ("false-Done anywhere = release blocker") that reads as a blocker in
its own right, and it is live on `main` today, independent of this stage.

---

## 4. Files

New: `src/rules/durableFactHorizon.ts`,
`src/__tests__/durableFactHorizonTests.ts`, `test:fact-horizon` script.

Changed: `temporarySourceFact.ts` (open scope kind, `effectiveUntil: string |
null`, hydration preserves open-ness, `factWindowKey`, expiry + active-on-date
route through the owner), `illnessRecoveryWeekMode.ts`,
`temporarySourceFactTransaction.ts` (multi-week materialisation + per-week
adjustments), `programControlActions.ts`, `visibleReadinessState.ts`,
`useHomeScreen.ts`, `lighterDayTransaction.ts`.

The test harness forks one process per scenario: re-seeding `spent-week-friday`
twice in one process makes the second install unable to record a session outcome,
and a harness that ignored that would report failures unrelated to the invariant
(M6).

---

## NOT COVERED (Process Law L2)

- **No device pass, no simulator run.** L4 stands: nothing here has been seen on
  a phone. "Gates green, awaiting Sam device acceptance" — not "done".
- **T4 is RED and `test:fact-horizon` is deliberately NOT in `test:bible`.**
  Wiring a red suite into the gate would break it; it joins when T4 is green,
  the same sequencing `derivingSourceFactDeviceCommitTests` used.
- **One seed, one profile.** Everything is `spent-week-friday` (in-season game
  week, 3 training days). No pre-season, off-season, deload, bye or
  practice-match week was run.
- **Rider 2 is NOT done.** Season transitions, block rollover and bye weeks are
  untested against an open horizon. The reassessment named this "may be the
  hardest case in Option B" and it remains exactly as unexamined as it was.
  Weeks beyond the program's microcycles are not authored at all, which is a
  silent bound on "until cleared" — bounded honestly, but bounded.
- **Rider 3 is NOT done.** Disclosure copy is unchanged. A multi-week commit
  still says "nothing's required this week" while having authored four weeks,
  which is now actively misleading — worse after this stage than before it.
- **Rider 1 is NOT done** and is now larger: §3 shows the injury path and the
  partly-spent week are both materialisation questions.
- **No equipment/schedule/`time_cap` fact was run against an open horizon.**
  They keep their closed windows by design; that they are unaffected is
  reasoned from the code, not measured.
- **Injury facts are untouched by this stage.** `factHorizon` reports their
  existing `affectedWeeks` reach unchanged rather than quietly widening a
  horizon no test covers. Injury duration is Stage 2's subject.
- **`npm run lint` is broken repo-wide** (`ESLint couldn't find a configuration
  file`), before and after this unit. Not diagnosed here.
- **`test:temporary-source-facts` fails 17 assertions** — identical count before
  and after, verified by stashing. Pre-existing; not in `test:bible`.
- **No coach-chat path was exercised.** Every fact here was committed through
  the readiness sheet's action mapping.
- **Multi-fact interaction untested.** One durable fact at a time; an open
  illness plus an open cooked fact, or a second report while one is active, was
  never run.
