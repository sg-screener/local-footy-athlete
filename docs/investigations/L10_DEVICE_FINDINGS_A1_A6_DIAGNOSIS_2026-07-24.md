# L10 device findings A1–A6 — diagnosis (2026-07-24)

DIAGNOSIS-FIRST unit on `main`. Sam's L10 device acceptance failed with six
findings. A1 was fixed directly (chore scope). A2–A6 are diagnosed here with
mechanism + evidence + a contained-vs-ownership verdict. **No fixes beyond A1
were made.** One passed-fix is confirmed: illness clear and cooked both work on
device.

Evidence for A3/A4/A5/A6 is **executable**, produced against the new
`spent-week-friday` canonical seed rather than read off the source. Probe
scripts are session scratch (not committed); every number below is copied from
their output and each is reproducible by re-running the same calls against the
seed.

---

## The seed the findings needed — `spent-week-friday`

Committed in this unit (`6182d53`, `19edf69`).

Sam's device state on 2026-07-24: today **Friday**, MON/TUE/THU already **Done**,
WED/FRI Rest, SAT Game, SUN Recovery. No existing seed could reach this, and the
reason is structural rather than incidental: `DEV_E2E_DATE_ANCHORS` was doing two
jobs at once. It was simultaneously the DevE2EClock instant ("today") and the
visible week's Monday, and every seed anchored on a Monday — so "today" and "the
week start" were always the same date, and **a partly-spent week was
unrepresentable**. On a Monday nothing is spent yet.

The seed splits the two: `DEV_E2E_DATE_ANCHORS` now explicitly means "today", and
`devE2EWeekStartForSeed` is the single owner of week-relative arithmetic. Every
prior seed anchors on a Monday, so `mondayFor(anchor)` is the identity and their
fingerprints are unchanged.

Self-checks pin the divergence itself, not just the witnesses — anchor Friday
2026-07-24 vs week start Monday 2026-07-20, three Done dates all preceding the
anchor, Wednesday/Friday unsessioned, Saturday a game, empty fact store at
install, and a real adjacent next week (2026-07-27) to project onto.

`test:dev-e2e-seeds` 64/64.

---

## A1 — cold-start flash of the old logo — **FIXED** (`0f6c223`)

**Mechanism.** The 07-23 icon work updated `assets/icon.png` and the native
`AppIcon.appiconset` but not the launch screen. `assets/splash.png` and
`ios/.../SplashScreenLegacy.imageset/image{,@2x,@3x}.png` were still dated
11 May and still carried the retired disc mark. There is no JS splash route
(`src/types/navigation.ts` declares a `Splash` entry that no navigator
registers, and no screen renders a logo image), so the native launch screen is
the sole owner of that frame — the fix is the asset, not a code path.

**Fix.** Rebuilt from `assets/brand/lfa-inline-logo-banner.png`, keyed off its
pure-black plate so the mark composites onto the existing `#0C0C0C` launch
background with no visible seam. Regenerated the iOS imageset at 1x/2x/3x as
expo prebuild emits them, plus the Android `splashscreen_logo` densities, which
carried the same stale mark.

**Status.** Requires a native rebuild to reach the phone. Awaiting Sam device
acceptance per L10 — not "done".

---

## A2 — management sheet opens the instant you confirm "Properly sick"

**Verdict: CONTAINED** (missing state in one component's state machine).

**Mechanism.** `WeekReadinessSheet` (`HomeScreenV2.tsx:2073-2287`) has exactly
**two** states, chosen by one derived boolean:

```
const showOptions = (!active || updating) && !lighterDayOffer;   // :2100
```

`sick_week` is not a today-scoped tier, so `onApply` sets no `lighterDayOffer`
(`HomeScreenV2.tsx:796-799`). The commit makes the illness fact active, so
`active` (`weekReadiness`) becomes non-null on the next render. `updating` is
false. Therefore `showOptions === false`, and the only remaining branch is the
**management** view at `:2157` — "Update — how I'm feeling changed" and "Clear
adjustment — I'm good now", titled with `active.title` and a Cancel button.

The disclosure copy Sam wants is not missing; it is already produced and already
on screen. `temporarySourceFactTransaction.ts:903` returns *"Rest up — nothing's
required this week. I've left gentle optional work if you're up to it, at a
lighter dose."*, `buildReadinessAcknowledgment` passes it through
(`readinessAcknowledgment.ts:38`), and it renders as the small acknowledgment
banner at `:2124`. It is simply stacked **above** the management options rather
than being the state.

The root cause is that the sheet conflates two different facts under one
variable: *"this week has an active adjustment"* (a fact about the week) and
*"the athlete came here to manage it"* (a fact about this visit). Management is
the fallthrough for any non-null `active`, so the moment of confirming is
indistinguishable from a later visit.

**What Sam ruled.** After confirming, show the disclosure with a close/return
button only; the clear option belongs to a later visit.

**Shape of the fix (not built).** Add the missing third state rather than
another guard: the sheet needs `confirmed` — set by `onApply` on success, reset
on open — and `showOptions`/management both become false while it holds. That
removes the overloaded meaning of `active` instead of adding a condition to it.

---

## A3 — active facts do not shape next week — **TRUST-CRITICAL**

**Verdict: OWNERSHIP for the illness half. STOP — 7-question reassessment
required before any code.** The injury half is a separate, more severe defect
(see A3b).

### A3a — illness_recovery is bounded by the calendar week, not by the fact

Recorded design: *illness_recovery mode derives from the ACTIVE fact until
cleared.* The code cannot express that.

**Executable evidence.** Seed `spent-week-friday`, today Friday 2026-07-24, then
report "Properly sick" through the exact action the sheet commits:

```
action: set_illness_status  scope=current_week
        payload={date: 2026-07-20, todayISO: 2026-07-24, severity: severe}
result: ok=true  changedProgram=true
        "Rest up — nothing's required this week…"

fact created:   illness / status=active / severity=severe
                effectiveFrom=2026-07-20  effectiveUntil=2026-07-26

deriveIllnessRecoveryWeekMode(THIS week 2026-07-20) → true
deriveIllnessRecoveryWeekMode(NEXT week 2026-07-27) → false

this week BEFORE  in_season_game_week
          20:Strength/core  21:Team Training/core  22:Rest/-
          23:Team Training/core  24:Strength/optional  25:Game/core  26:Recovery/recovery
this week AFTER   illness_recovery
          20:Mixed/optional  21:Team Training/optional  22:Rest/-
          23:Team Training/optional  24:Rest/-  25:Game/core  26:Recovery/recovery

next week BEFORE  in_season_game_week
          27:Strength/core  28:Team Training/core  29:Rest/-
          30:Team Training/core  31:Strength/optional  01:Game/core  02:Recovery/recovery
next week AFTER   in_season_game_week          ← byte-identical, zero optional marking

weekScopedOverlays: ["2026-07-20"]              ← one week only
```

This week's behaviour is correct — the 0.2 fix works. Next week is untouched,
exactly as Sam reported.

**Mechanism — three independent bounds, all set to "this calendar week":**

1. **The fact's own window.** `readinessActionForKind('sick_week', …)` emits
   `scope: 'current_week'` (`weekReadinessActions.ts:55`), which
   `programControlActions.ts:1217` turns into `temporaryFactScope({kind:'week'})`,
   which is defined as `from = mondayFor(anchor), until = mondayFor(anchor)+6`
   (`temporarySourceFact.ts:912-915`). The fact is therefore **hard-bounded to
   the week it was reported in even though `status` stays `'active'` and the
   athlete has not cleared it.** "Active until cleared" is not expressible: the
   fact expires by calendar, silently, while still reading as active.
2. **The derivation.** `deriveIllnessRecoveryWeekMode` requires
   `fact.effectiveUntil >= weekStartISO` (`illnessRecoveryWeekMode.ts:34`). With
   `effectiveUntil` = this Sunday, next Monday can never satisfy it — so the
   derivation is correct code reading a fact that was already truncated.
3. **The materialisation.** The scoped-regen commit authors exactly one week:
   `scopedRegenWeekStart = mondayFor(args.todayISO)`
   (`temporarySourceFactTransaction.ts:527`), passed as a single `weekStart` to
   `commitDerivingSourceFactScopedRegen` (`:571-579`).

**Why this is an ownership case, not a bug.** There are **three** representations
of "how long is the athlete sick": the fact's `effectiveUntil`, the week-mode
derivation's overlap test, and the authored week overlay's key set. All three
must agree, none of them owns the answer, and the first one silently truncates
the other two. Widening any one of them in isolation — extending the scope,
loosening the overlap, or looping the overlay across weeks — adds a fourth
place that must stay in sync. That is precisely the shape the CLAUDE.md
escalation rule names: the semantic layer understood Sam correctly ("I am
properly sick"), and a later layer reinterpreted it as "…for 2 more days".

Additionally the visible week for **every** week is
`buildProgramTabProjectedWeek` over `useScheduleState()`
(`useSchedule.ts:264-286`), and that state carries `activeConstraints` /
`activeInjury` but **not** `temporarySourceFacts`. The week mode is a
generation-time and validation-time concept only; it has no path into the
projection. So a future week can only ever be shaped by a fact if something
pre-authored an overlay for it — which nothing does.

**STOP.** The 7-question reassessment (CLAUDE.md) is owed before any code. The
questions this must answer, in this repo's terms: which single surface owns
"how long is this fact live" (the fact, or a derived horizon?); whether an
open-ended fact window is representable at all today; whether future weeks
should carry pre-authored overlays or whether the projection should read facts
directly; and which of the three current representations gets retired rather
than synchronised.

### A3b — an upper-body 8/10 injury is REJECTED and rolled back, recording nothing

This is worse than "nothing visibly changes" and worse than the standing F6
diagnosis in `docs/audits/DEAD_AFFORDANCE_INVENTORY_2026-07-23.md`, which
concluded the injury path "is a real, persisted mutation that just never
triggers a re-render". On this seed it does not persist at all.

**Executable evidence.** Fresh install of `spent-week-friday`, then the exact
action `handleApplyGuidedInjury` commits (`useHomeScreen.ts:1569-1581`) for an
upper-body 8/10:

```
[coach-mutation-transaction] candidate rejected and rolled back
  error: 'Section 18 final-week rejection
          (required_minimum_shortfall:conditioning:0
          |required_minimum_shortfall:main_strength:1
          |required_minimum_shortfall:sprint_high_speed:0)'
  candidatePersisted: false

result:         ok=false  changedProgram=false
                "The injury command was not applied because the accepted
                 program could not be verified."
activeInjury:   null
injuryEpisodes: 0
weekScopedOverlays: []
this week / next week: byte-identical before and after
```

**Mechanism.** Severity ≥ 8 sets `adjustmentLevel: 'training_paused'` and
`severityBand: 'avoid'` (`guidedInjuryControl.ts:207-213`). Pausing affected
training drops the resulting week below the §18 required minimums, the whole
accepted-state transaction is rejected and rolled back, and **the injury fact is
never recorded**. The athlete is told nothing useful and the app has no memory
that they are hurt.

This is the same class as device finding #3, which was solved for illness by
minting a §18 week mode that lifts minimums (`illness_recovery`). The injury
path has **no equivalent mode**, so the gate that illness now legitimately
bypasses still kills injury.

**Correction to the standing F6 record.** The inventory's diagnosis
("persists, but `requiresRebuild:false` means no re-render") does not hold for
the paused/high-severity band on this seed. `requiresRebuild:false` is real, but
it is downstream of a transaction that never commits.

**NOT established:** whether a *moderate* (severity 5, non-paused) injury
persists. The probe's severity-5 run failed with
`accepted_state_rollback_mismatch … capturedAt … 1970-01-01`, which is the known
epoch-0 harness artifact already documented in
`derivingSourceFactDeviceCommitTests.ts` and is a re-seed-within-one-process
issue, not a domain result. **Do not read the severity-5 line as evidence.** It
needs a fresh-process run before anyone concludes the whole injury path is
broken versus only the paused band.

---

## A4 — no visible active-sick state on the card

**Verdict: CONTAINED** (one component discards a value the owner computes),
**with a test that pins the defect.**

**Executable evidence.**

```
resolveVisibleReadinessState(active severe illness fact, week 2026-07-20) →
  { id: "temporary-source-fact:v1:illness:week:2026-07-20",
    isRecovery: false,
    title: "Under the weather this week",
    scope: "week" }

card renders : "Not 100% this week"
title discarded? true
HomeScreenV2 ever reads weekReadiness.title? false
```

**Mechanism.** `visibleReadinessState.ts` is the declared single owner of the
card label and correctly produces `"Under the weather this week"` for an illness
fact (`:65`) — this is exactly what the 0.2 unit claimed to ship, and the owner
does ship it. But the card at `HomeScreenV2.tsx:681-689` does not read `title`.
It re-derives its own label from `scope` and `isRecovery` only:

```tsx
{weekReadiness
  ? (weekReadiness.scope === 'today'
      ? 'Not 100% today'
      : weekReadiness.isRecovery
        ? 'Recovery mode this week'
        : 'Not 100% this week')      // ← every non-recovery week fact lands here
  : "I'm not 100%"}
```

So `title` is computed, typed, passed into `WeekReadinessSheet` as `active.title`
(where it *is* used, at `:2159`), and dropped on the floor by the one surface
Sam was looking at. Two representations of the same label; the wrong one wins on
the card.

Sam's other two observations follow from the same line: there is no banner
because the card row *is* the entire active-state affordance, and clearing is
only reachable by re-tapping that row because the management view is only
reachable through it (see A2).

**The test pins it.** `weeklyReadinessCardTests.ts:443` asserts:

```js
src.includes('Not 100% today') && src.includes("Not 100% this week") &&
src.includes('Recovery mode this week') && src.includes('Clear adjustment')
```

This is a source-substring scan that requires the hardcoded strings to be
present in `HomeScreenV2.tsx`. It passes *because* the card ignores the owner.
Any correct fix deletes those literals and **fails this test** — the test must
be inverted as part of the fix, not worked around.

**Shape of the fix (not built).** Render `weekReadiness.title`. Move the
recovery-mode label into `factKindTitle`/the owner so the sheet and the card
cannot drift, then invert the pinned test to assert the card reads `title` and
holds no literals of its own.

---

## A5 — Profile "Clear active changes" does nothing

**Verdict: BROKEN ACTION, not a dead affordance.** The control renders, is
tapped, reports success, and changes nothing. **CONTAINED-but-systemic:** the
function is whole-cloth legacy and needs replacing rather than patching.

**Executable evidence.** Seed, report "Properly sick", then call exactly what
the row's handler calls (`ProfileScreen.tsx:634` → `onClearCoachAdjustments` →
`clearCoachAdjustments()`):

```
── after reporting, before clearing ──
ProfileScreen activeIssues : ["Recovery mode active — 7/10"]
  → "Clear active changes" row renders? true
accepted state : temporarySourceFacts ["illness:active"]
                 acceptedActiveConstraints ["fatigue"]
                 overlays ["2026-07-20"]   ledgerActive 1
visible week   : 20:Mixed/optional  21:Team Training/optional  22:Rest/-
                 23:Team Training/optional  24:Rest/-  25:Game/core  26:Recovery/recovery

── tapping Clear active changes ──
summary: {activeInjuryCleared:false, coachUpdatesCleared:0, injuryOverridesRemoved:[],
          coachNotesRemoved:0, athletePrefInjuriesCleared:0, chatCleared:false}

── after clearing ──
ProfileScreen activeIssues : ["Recovery mode active — 7/10"]   ← unchanged
accepted state             : IDENTICAL (illness still active, overlay still there,
                                        ledger adjustment still active)
visible week               : IDENTICAL
```

The confirmation alert the athlete sees is built from that summary — so the app
literally reports "Active injury: none / Coach Update cards: 0 / Injury
overrides: 0" and calls it done.

**Mechanism.** The live screen is `ProfileScreen` (`AppNavigator.tsx:90`);
`ProfileHomeScreen` has the same two controls and is unreachable — worth noting
for the X1 sweep, it is a second copy of this affordance that no one can tap.

`src/utils/resetCoach.ts` is 662 lines and contains **zero** references to
`acceptedMaterialContext`, `temporarySourceFacts`, `weekScopedOverlays`,
`reversibleAdjustmentLedger`, `injuryEpisodes`, `acceptedCompositionBase`, or
any accepted-state transaction. Verified by grep across the whole file. It
operates entirely on the pre-§18 mirror stores — `coachUpdatesStore`,
`athletePreferencesStore`, `coachPreferencesStore`, `readinessStore`,
`profileStore` — plus `programStore`'s manual overrides.

Since the §18 ownership migration the visible program reads
`acceptedContext.*` whenever `revision > 0` (`useSchedule.ts:129-134`), which is
always true after onboarding. So the clear operates on state that is no longer
authoritative for anything the athlete can see. It is not that the control is
wired to nothing; it is wired to the previous architecture.

**Second defect, same probe.** The note reads **"Recovery mode active — 7/10"**
for a severe *illness* report. The illness fact surfaces in Profile under the
wrong domain and with a fabricated severity. Same misattribution class as the
findings #2/#5 copy work; flagging separately because it is a trust problem in
its own right — the athlete is told the app thinks something they never said.

**Shape of the fix (not built).** "Clear active changes" must route through the
same owner the readiness card's clear already uses — the temporary-source-fact
transaction — so bulk clear and per-fact clear cannot diverge. That is a
replacement of `clearCoachAdjustments`, not an addition to it. Note this control
would then be the *third* door onto fact clearing; whether it should exist at all
is a Sam call (L7), and X1 may prefer removing it.

---

## A6 — raw "Can't apply this edit" instead of the plain-language refusal

**Verdict: CONTAINED** (presentation layer overrides a correct domain message).

**Two corrections to the finding's framing, both from evidence:**

1. **It is not a cross-week move.** `listPlanChangeOptionsForDay` builds
   `moveDestinations` only from `args.visibleWeek`
   (`planChangeProducer.ts:306-321`), so the sheet **cannot** offer a
   destination outside the current week. On the seed, Monday's door offers
   `["2026-07-22", "2026-07-24", "2026-07-26"]` — Wed, Fri, and the upcoming
   Sunday. Sam's "next Sunday" is 2026-07-26, in-week and G+1.
2. **Done-ness is not the trigger.** The probe ran the same move twice, once
   with MON/TUE/THU unmarked and once with all three committed Done through the
   real session-outcome transaction. Identical result both times. The door still
   offered Sunday, and the refusal was the same.

**Executable evidence** (identical with and without Done):

```
door for Monday : locked=null  hasSession=true
                  moveDestinations=["2026-07-22","2026-07-24","2026-07-26"]
preview.ok      : true
rejected codes  : []
decision        : block
findings        : [{ ruleId: "game_proximity_day_locked",
                     level:  "hard_stop",
                     message:"That day is kept light around your game, so a
                              session can't be moved onto it. The plan is
                              untouched." }]
```

**Mechanism.** The domain is already correct and already deliberate about this.
`blockedAssessmentForBuildError` (`planChangeProducer.ts:1226-1268`) carries the
comment *"a plain-language refusal, never a raw error code"* and emits exactly
the sentence Sam expected.

The sheet then overrides it. `PlanChangeSheet.apply()` discards the finding's
voice and hardcodes a single generic headline for **every** hard stop:

```tsx
setStep({ kind: 'block_warning',
          title: "Can't apply this edit",          // :347 — one string, all rules
          reasons: riskReasons(preview.assessment.findings), … });
```

and renders it as the loudest element on screen — `blockingTitle` is
17px/700/`#FFFFFF` (`:875-880`) while the domain's honest sentence renders below
it as `confirmText`, 14px at 70% opacity (`:869-874`). Compounding it,
`riskReason()` (`:113-147`) has explicit cases for `g1_*`, `g2_*`,
`g_plus1_hard_work`, `game_day_hard_work` and the `protected_*` rules but **no
case for `game_day_locked` or `game_proximity_day_locked`** — the two rules whose
author wrote plain-language copy for them. They survive only through the
`default: return finding.message` fallthrough, so nothing at title level ever
speaks in the domain's voice.

Net effect on the phone: a system-voice refusal in bold, with the honest
game-framed explanation demoted to grey secondary text. Sam read the bold line
as the refusal, which is the correct way to read it.

**Shape of the fix (not built).** The finding should own the headline. Give
`ProgramEditRiskFinding` (or `riskReason`) a short title alongside the sentence
and let `block_warning` render it, so there is one representation of "why this
was refused" instead of a domain one and a UI one that outranks it. This removes
a representation rather than adding a case, so it does not trip the
stop-patching trigger — but it is adjacent to the move/edit pipeline, so it
should land with the A3 reassessment rather than ahead of it.

---

## Cross-cutting

Four of the five diagnosed findings are the same shape: **a lower layer computes
the right answer and a later layer discards or narrows it.**

| Finding | Owner computes | Later layer does |
|---|---|---|
| A2 | the disclosure message | stacks it above a management view that shouldn't be there yet |
| A3a | "the athlete is sick" | truncates it to "…until Sunday" in three places |
| A4 | `title: "Under the weather this week"` | re-derives `"Not 100% this week"` |
| A5 | the accepted fact/overlay/ledger | clears the pre-§18 mirror instead |
| A6 | a plain-language game-framed refusal | outranks it with a generic bold headline |

A3a is the one that needs the reassessment. A2/A4/A6 are each a single
representation to delete. A5 is a legacy function to replace. A3b is a distinct
and arguably more urgent problem than all of them: **the app currently cannot
record a high-severity injury at all.**

---

## Recommended order (for Sam's call — L7)

1. **A3b** — an athlete reporting an 8/10 injury and having it silently dropped
   is the worst trust failure in this set. Needs its own diagnosis of whether
   injury deserves a §18 week mode the way illness got one.
2. **A3a reassessment** — 7 questions, approval, then build. Blocks A6.
3. **A4** — one line plus inverting the pinned test.
4. **A2** — one state added to one sheet.
5. **A5** — replace `clearCoachAdjustments`, or remove the control (Sam's call).
6. **A6** — with or after A3a.

---

## NOT COVERED (Process Law L2)

This unit was source-and-harness diagnosis. It is necessary, not sufficient
(L4: device is arbiter).

- **No device pass.** Nothing here was re-observed on Sam's phone. A1's fix in
  particular is unverified on device and needs a native rebuild before it can be
  accepted (L10).
- **No simulator run.** The app was never launched. All A2–A6 evidence is from
  direct calls into the real store/transaction/projection code, not from
  rendered UI. Sheet *rendering* (that `block_warning` and the readiness
  management view actually paint as the source says) is inferred from the source
  and Sam's report, not observed.
- **A3b severity-5 is unestablished** — the run was masked by the known epoch-0
  re-seed artifact. Only the paused/8-10 band is proven to be rejected. Whether
  moderate injuries persist is open.
- **A2's device sequencing is inferred.** The probe never drove the sheet's React
  state; the state-machine reading is from source. Sam's observation and the
  source agree, but the render was not witnessed.
- **Other severities/kinds untested:** `cooked_week`, `poor_sleep_week`,
  `sniffle_today`, equipment and schedule facts were not run against next week.
  A3a's mechanism is week-scope-wide, so `cooked_week` and `poor_sleep_week`
  almost certainly share it — **untested, do not report as covered.**
- **Weeks 3+ untested.** Only week+1 was probed. Whether anything reaches week
  +2/+3 is unknown.
- **A5's clear was tested against an illness fact only.** Injury, equipment and
  schedule facts were not tried through that control; the grep evidence
  (`resetCoach.ts` touches no accepted state at all) implies they behave the
  same, but that was not executed.
- **The unreachable `ProfileHomeScreen` copy** of both clear controls was
  identified but not swept; the rest of the X1 dead-affordance sweep is
  untouched by this unit.
- **Onboarding, cold start, generation, season transitions, Coach chat, game-day
  flows, catch-up prompt, feedback forms** — entirely untouched here (L1/L3).
- **`test:dev-e2e-default-installation` fails on `main`** with
  `ExplorerCampaignBootstrapError: campaign-missing`, identically before and
  after this unit's commits. Pre-existing; not diagnosed here.
- **Full gate suite not run.** `tsc --noEmit` is clean and the dev-e2e suites
  pass, but `test:bible` and the wider suites were not executed — this unit
  changed only seed/test files plus image assets.
