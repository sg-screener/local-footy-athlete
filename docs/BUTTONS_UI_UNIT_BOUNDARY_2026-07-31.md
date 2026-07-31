# Buttons/UI unit — boundary report (2026-07-31)

Branch `fix/g1-ownership-and-move-scoping`. Unit BASE `8e94b11`, unit HEAD
`f0934ab` (Task 11's fix round 2). This report is Task 12 of
`docs/superpowers/plans/2026-07-31-buttons-ui-unit.md`, written from
`.superpowers/sdd/2026-07-31-buttons-ui-unit/progress.md` (the ledger) and
the eleven task reports in the same directory.

## Scope delivered

**The one-projection migration.** `project()`
(`src/rules/projectVisibleWeek.ts`) is now the single owner of what the
athlete sees — headlines, rows, capabilities. Four surfaces moved onto it in
task order: the four-action menu (Task 4), the week-screen card (Task 5), the
day-detail title and content (Task 6), and the Coach screen's read model
(Task 10, half — see NOT-COVERED). The name channel that fed the pre-projection
surfaces (`splitSessionName`, two `resolveSessionDisplayName` inference
rules) is deleted (Task 11). **Coach voice composition is LR-6-blocked**: the
packet's day summaries still read planner-composed words, not projection
vocabulary, because those words are also matching keys the frozen
router/executor string-compare — moving them would be a frozen-layer
behaviour change, which LR-6 forbids. Full trace:
`.superpowers/sdd/2026-07-31-buttons-ui-unit/task-10-report.md` §2, confirmed
independently by Task 11's measurement (2/9/972 of 30,937 distinct
`resolveSessionDisplayName` inputs are still LIVE producers of frozen coach
keys, so those three rules could not be deleted — only the ATHLETE-facing
reads were closed, structurally, via a source contract).

**The 13 design rulings** (`artifacts/HOME_SCREEN_REDESIGN_RULINGS_2026-07-30.md`):

| # | Ruling | Status | Task |
|---|---|---|---|
| 1 | Repeat-week dies entirely | SHIPPED | 1 |
| 2 | Busy/Away split into two buttons | SHIPPED | 7 |
| 3 | New "I'm injured" button | SHIPPED | 7 |
| 4 | "I'm not 100%" → "I'm sick/flat today" | SHIPPED | 7 |
| 5 | Equipment/practice-match buttons unchanged | RULED-LIVE (constraint, verified unchanged) | 7 |
| 6 | Every week-screen button carries an icon | SHIPPED | 7, 9 |
| 7 | Intermediate "Edit this session" menu deleted | SHIPPED | 4 |
| 8 | Four-action menu is the whole menu | SHIPPED | 4 |
| 9 | Add/Swap menus offer the five signed types | PARTIALLY-BLOCKED — shipped, one row's label unruled (Sam Q1) | 4 |
| 10 | Global icon rule, every option row | SHIPPED | 4, 8, 9 |
| 11 | Injury "Other" data-path investigation | ALREADY DONE pre-unit (`4bb425a`) | — |
| 12 | "Edit exercises" modal retired, inline editing | SHIPPED (+ Sam's live mid-review ruling on `concern_reason`) | 8 |
| 13 | Seven Coach preset chips removed | SHIPPED (UI only; coach pipeline untouched) | 10 |

Full copy detail for every ruling and every new/retired string is in
`artifacts/COPY_SHEET_RULINGS_2026-07-30.md` under "Batch 6 — buttons/UI unit
(2026-07-31): ONE SIGNABLE PASS" (tidied by this task into
SIGNED-BY-RULING / PROPOSED / RETIRED / OPEN QUESTIONS; `test:copy-rulings-binding`
7/7).

## CONVERGENCE

**Representations deleted:**
- The intermediate "Edit this session" menu — the menu in front of the menu
  (Task 4). `visibleSessionKindsForWorkout` and the `hasSession` derivation
  it fed are deleted; `listPlanChangeOptionsForDay` now answers from
  `ProjectedDayParts.capabilities` alone.
- `splitSessionName` — the parser that turned `"Team Training + Upper Push"`
  back into `{title, context}` — deleted outright (Task 11); its two live
  callers now name the surviving component from typed intent and rows.
- Two `resolveSessionDisplayName` text-inference rules (the cleaned-focus
  pass-through and the name-inference rule beside it) — deleted (Task 11),
  measured to produce **nothing** across 30,937 distinct inputs replayed
  from a whole `test:bible` run before deletion.
- Per-surface composition of the day-detail screen — `composeDayDetail`'s
  production callers, briefly two (the projection and `useDayWorkout`,
  Task 2's interim state) collapsed back to one (`projectVisibleWeek.ts`
  only, Task 6); `dayDetailCompositionOwnershipTests` pins it.
- The repeat-week overlay writer (`repeatWeekIntoNextWeek`,
  `reversibleAdjustmentTransaction.ts`'s `stageClearRepeatWeekAdjustment`) —
  deleted outright (Task 1); a hydration ingress lift drops any
  `reason: 'repeat_week'` overlay already on a device rather than keeping a
  writer alive for it.

**Stored state added: none.** The one fact-shape change this unit made
(Task 7's `set_schedule_modifier` today-scope) is a payload addition on the
EXISTING door — the fact already existed, this unit gave its existing
`scope.kind` vocabulary (`useHomeScreen.ts`'s `'today_only'`, already used
elsewhere) a new caller, and did not fork a new fact kind. Consistent with
`docs/NORTH_STAR.md`'s convergence rule.

**Ratchets moved:**
- `ATHLETE_VISIBLE_GAP_CEILING` (`signedCopyExtractionTests.ts`): **187 → 141**
  (Task 1: 187→182 repeat-week; Task 7: 166→164 week-screen menu collapse;
  Task 8: 164→151→148 across the retirement pass; Task 10: 148→141 chip
  removal; Task 11: held flat at 141 by design — its deletions were
  *producers*, not surface literals, so the extractor's own provenance block
  records the flat ratchet as correct).
- `LEGACY_DEBT_BASELINE` (`src/data/legacyReckoningCensus.ts`): **116 → 114**
  (Task 1 — deleting `stageClearRepeatWeekAdjustment` and the
  `explorerProductionBindings.ts` `week.repeat` case each removed one
  LR-4 `mirrorDecisionReads`-detected read; the census ratchet's own
  direction 3, "paying debt down tightens the ratchet," was applied).
  `foundingCount` (74) and `LEGACY_DEBT_FOUNDING_BASELINE` (116) are frozen,
  untouched.

## L12 — what catches the NEXT defect of each class

- **The surface-agreement laws, armed as `surface === projection`.** `L-P1`
  (one day, one name — card vs. canonical), `L-P2` (every rendered word is
  registered `SignedCopy`, both a static source-contract half and a runtime
  registry-check half), `L-P3` (parts conservation: card partIds ===
  canonical partIds; detail kinds === projected part kinds; two further
  cells added this unit — `L-P3 ROWS CONSERVATION` and row-level `L-P2`),
  `L-P4` (menu capabilities === projection capabilities, both directions,
  including `hasSession`'s converse) are all ARMED in `test:bible`
  (`test:surface-agreement`, `test:athlete-door-matrix`,
  `test:action-walker`, `test:action-walker:deep`). A future surface that
  drifts from the projection reds one of these before it reaches a phone.
- **The deep tier in the gate.** `test:action-walker:deep` runs in
  `test:bible` (armed by Task 6, positioned after `test:action-walker`) — a
  shallow-only regression suite is the exact failure L13 exists to prevent,
  and this unit closed that gap rather than leaving the deep tier
  gate-adjacent.
- **`L-P3 TEMPLATE = PROJECTION`** — the conservation law between D13's
  `buildSessionTemplate` (what fills the athlete's session list) and
  `visibleDay.parts` (what the projection says is on the day), two
  compositions neither derives from the other. It is what FOUND the four D13
  session-template reds (see below), not merely what will catch the next
  one — the law is new this unit and immediately paid for itself.
- **The differential method** (Task 11): before deleting a text-producing
  rule, replay it over every `(input → output)` pair a whole `test:bible`
  run exercises (30,937 distinct inputs / 31,036 calls for
  `resolveSessionDisplayName`; 1,705 whole-bible day-name observations for
  the `splitSessionName` removal) and require the diff to be empty. This
  caught a defect a comment had already excused (see Method findings) and is
  recommended as the standard pre-deletion check for any further name-channel
  or copy-channel work.
- **Declared-red / declared-gap stale-check mechanisms.** Both
  `DECLARED_RED` (`athleteActionWalkerTests.ts`) and `DECLARED_DOMAIN_GAPS`
  (`surfaceAgreementTests.ts`) fail the build the moment a declared entry
  STOPS reproducing (`'every declared red still reds — stale debt fails, it
  does not expire quietly'`; `staleGaps` check) — a red cannot be silently
  fixed and forgotten, and it cannot be silently un-fixed either: an owner
  who pays the debt must delete the entry in the same commit or the suite
  reds for the opposite reason.

## L13 depth reached

The deep tier (`DEPTH_TIER = { walks: 3, length: 90, minWeeksAdvanced: 4 }`,
declared Task 3) ran 3 walks of 90 actions each, biased so `advance_time`
accumulates ≥ 4 weeks (28 days) of `todayISO` movement per walk — a walk that
stayed inside one week fails the tier declaration outright. The three seeds
reached **81 / 53 / 94 days** of accumulated advance, all clearing the
28-day floor. It is ARMED in `test:bible` (`test:action-walker:deep`, added
Task 6). This is the tier that found cells 1 and 4 red honestly (Task 3) and
the four D13 session-template reds (Task 6) — shapes the bounded tier's 10-14
actions never accumulate enough state to reach.

## Declared reds standing (with owners)

Six entries in `athleteActionWalkerTests.ts`'s `DECLARED_RED`, one in
`surfaceAgreementTests.ts`'s `DECLARED_DOMAIN_GAPS` (covering two matrix
cells), two in `programControlDurableOwnershipTests.ts`. All are gated in
`test:bible` (a declared red is a pass with a receipt, not a hidden fail) and
all stay red until their named owner pays them — none is a buttons/UI task.

1-4. **4× D13 session-template conservation** (`L-P3 TEMPLATE = PROJECTION`,
   `session_list_drops_conditioning_attached_to_an_appointment`,
   `session_list_calls_a_conditioning_day_recovery`,
   `session_list_badges_a_midline_row_the_projection_has_no_part_for`,
   `session_list_has_no_representation_for_speed_work`). Owner: the D13
   session-template owner (`utils/sessionTemplate.ts`,
   `docs/SESSION_TEMPLATE_SPEC_2026-07-25.md`) — under the one-projection
   ruling the athlete's session list should be driven by the day's PARTS,
   not by two `workoutType` predicates disagreeing with the projection.

5. **1× conditioning-generation vocabulary**
   (`generated_conditioning_rows_have_no_authored_name`, `L-P2 SIGNED
   WORDS`). Half the population (template-placed rows) is paid; the other
   half is a generated conditioning row composed by `sessionBuilder.ts` out
   of planner nouns and numbers. Owner: the conditioning-generation owner —
   `data/conditioningTemplates.ts` (Sam's 55 signed doses, header: "NOT
   WIRED YET"). Not a buttons/UI task.

6. **1× block rollover** (`block_rollover_fails_silently_and_the_program_stops`,
   `L6 THE BLOCK ROLLOVER`). CONFIRMED REAL, UNOWNED. Only the deep tier
   reaches it — four weeks after install the block must roll,
   `rebuildLocalWeek` finds ledger blockers and throws, `useHomeScreen`
   catches and logs silently: the athlete gets no crash and no sentence, just
   a program that stopped outside the edit horizon. Review confirmed this is
   not a harness artifact (the generate door now publishes through the same
   accept boundary the rollover uses, and the red survived unchanged). Owner:
   the program-block lifecycle owner (`weekRebuild.rebuildLocalWeek`
   scope:block + `acceptedStateTransaction` validation) — raised for Sam,
   nobody owns it yet.

7. **2× domain gaps, one entry, two cells**
   (`g1_sunday_is_rest_not_a_recovery_day`, cells "(2) adding hard
   conditioning" and "(4) a recovery day is offered"). The Sunday after a
   Saturday fixture resolves `source: 'rest'` with no workout at all —
   game-proximity recovery is resolver-owned derived filler, never a
   composed placeholder, so it presents as NOT A SESSION and the menu
   collapses to add-only. Cell 4 aborts on its first assertion, so its
   `canRemove` and `!move.refusal` checks have not run since this entry was
   written — recorded so they are treated as new, not regressions, when the
   gap closes. Owner: the recovery-as-a-day-type owner — reassessment
   staging step 5 ("Recovery as a day type; REST as a kind. Re-verify §18
   counting explicitly"), a DOMAIN unit with a Bible question attached, not a
   surface task.

8-9. **2× schedule-door** (`programControlDurableOwnershipTests.ts`,
   Task 7). (1) The schedule-fact transaction refuses every schedule fact
   against a real accepted base — the writer picks the re-canonicalising
   path, the verifier forbids any non-scoped-regen base change; an ownership
   collision between writer and verifier, ownership ruling owed, not a
   patch. (2) Even composed by hand, the constraint changes nothing in any
   generated week — it blocks exposures the generator never emits, so the
   busy/away doors have been functionally dead in the app. Both raised for
   Sam (Sam questions 8-9 below); neither owned inside this unit.

## SAM QUESTIONS

Ten, in the order they surfaced in the ledger. Each has a pointer into the
copy sheet, a declared-red entry, or a task report for the full trace.

1. **Accessories vs Prehab.** Ruling 9 names the fifth Add/Swap row
   "Accessories"; the session-type charter split accessories into two doors
   the same day, and ruling 9 lists Gunshow separately, so the fifth row is
   the PREHAB door. Ships wired to `prehab`, rendering the label "Prehab"
   until Sam signs one of the two candidates. Pointer:
   `artifacts/COPY_SHEET_RULINGS_2026-07-30.md` §6-IV-1.

2. **Swap/Add sub-line wording: neutral or enumerating.** The two sub-lines
   one tap above the five-row Add/Swap menu can either name no type
   ("Change it for another type of session", shipped) or enumerate the five
   ("Change to strength, conditioning, gunshow, mobility or accessories").
   Neutral avoids a sub-line that has already rotted twice as the menu's own
   five types changed shape; enumerating tells the athlete what is behind
   the row before they tap, which is closer to what ruling 9 asked for.
   Pointer: `artifacts/COPY_SHEET_RULINGS_2026-07-30.md` §6-IV-2.

3. **Practice-match day now reads "Game Day."** The day-kind headline
   (`day.headline.game`, proposed this unit) applies to every fixture day,
   practice matches included — a consequence of `dayIsFixture`'s boolean
   shape, not a copy decision anyone separately ruled. Ships as "Game Day"
   (the default) until Sam rules whether a practice/trial match should read
   differently. Pointer: `artifacts/COPY_SHEET_RULINGS_2026-07-30.md` §6-IV-4.

4. **The Remove sub-line can lie on a single-session day.** Batch 3's signed
   "Remove it — anything else on the day stays." is false when the day's
   only content IS the session being removed — the next screen shows the day
   becomes rest, not that anything stays. Batch 3's own principle ("a signed
   sentence must never be able to lie") applies to itself here; this unit's
   own pattern (typed cause selecting the sentence, not a guess) is the
   candidate fix if Sam wants it applied. Not fixed in this unit. Pointer:
   `artifacts/COPY_SHEET_RULINGS_2026-07-30.md` §6-IV-3.

5. **Block rollover fails silently — CONFIRMED REAL, unowned.** Four weeks
   after install the block must roll over; when it cannot, the athlete's
   program silently stops outside the edit horizon with no crash and no
   sentence. Only the deep tier (this unit's own L13 work) reaches it.
   Nobody owns this yet. Pointer: declared red 6 above,
   `athleteActionWalkerTests.ts` `block_rollover_fails_silently_and_the_program_stops`.

6. **Generated conditioning rows have no authored name.** Half the
   conditioning-row population is composed at generation time from planner
   nouns and numbers rather than named from Sam's 55 signed
   `conditioningTemplates.ts` doses, which exist but are "NOT WIRED YET" per
   that file's own header. Pointer: declared red 5 above.

7. **G+1 Sunday resolves REST, not recovery.** The day after a Saturday
   fixture has no composed placeholder and presents as not-a-session, so it
   cannot be added to (conserving nothing) or offered the same menu as any
   other day. Needs the reassessment's stage-5 ruling ("Recovery as a day
   type") plus a §18 Bible re-verification. Pointer: declared red 7 above.

8. **Schedule-fact ownership collision — busy/away doors have been DEAD in
   production.** The writer re-canonicalises against the accepted base; the
   verifier forbids any non-scoped-regen change to that base; whichever side
   is wrong, the fact is refused on every device with a real accepted
   program. Two candidate fixes point opposite ways
   (`temporarySourceFactTransaction.ts:707` vs `:731`;
   `illnessClearGameWeek`'s own comment forbids one of them). Needs an
   accepted-state ownership ruling, not a patch. Pointer: declared reds 8-9
   above, `task-7-report.md`.

9. **What should "Short on time today" DO to a session?** The `time_cap`
   fact exists and structurally fits, but the minutes question it would need
   ("how short is short?") has not been ruled. Even once the ownership
   collision in question 8 is resolved, this constraint changes nothing
   visible in any generated week today. Pointer: declared red 9 above.

10. **Coach voice still composes from `workout.name`, LR-6-blocked.** The
    packet's day-summary prose is also a matching key the frozen
    router/executor string-compare, so moving it to projection vocabulary is
    a frozen-layer behaviour change LR-6 forbids. Unblocking needs a
    coach-pipeline unit that either lifts LR-6 with a migration plan or
    re-homes the ~983 distinct name-production inputs / ~1,002 calls
    Task 11 measured. Pointer: `task-10-report.md` §2 (the full trace),
    `task-11-report.md` §"MEASURED SCOPE REDUCTION".

## NOT-COVERED

- **Coach packet/voice composition** — LR-6-blocked; see Sam question 10 and
  the Scope-delivered section above.
- **`CoachScreen`'s verification layer reads** (`coachTurnController`,
  `coachUndoEngine`, `coachRevisionProposal`, `coachModalitySwapOrchestrator`,
  `programEditWriteGuard`) — explicitly not touched (LR-6); they keep
  `buildProgramTabProjectedWeek`/`snapshotProjectedDay` and are recorded as
  census debt, not migrated.
- **Recovery-as-a-day-type, stage 5 of the reassessment** — the 69 recovery
  branches beyond the migrated surfaces, and the §18 recovery-counting
  question. Needs Sam's ruling before it is buildable; the G+1 Sunday domain
  gap (Sam question 7) is its symptom inside this unit's own gates.
- **`HomeScreenClassic` deletion** — unreachable (`DESIGN_VERSION = 'v2'`
  early return) but not deleted; a nontrivial removal (source-regex pins
  elsewhere reference it) out of scope for a copy/UI unit.
- **`ExerciseEditSheet`'s `pick_exercise` step has no icons.** Confirmed
  NOT-COVERED on defensible grounds (Task 9): its rows are the athlete's own
  unbounded exercise names, not a fixed enum, and there is no
  name→icon vocabulary anywhere in the app for arbitrary exercise names. A
  separate design pass, not a gap in this unit's icon rule.
- **The untyped-legacy residual on strength-component naming** (Task 11).
  A partial Bin on a day with a COMPOSED title, no `strengthIntent` AND no
  classifiable row, keeps the whole composed title as the survivor's name —
  unreachable in every harness world today, but the honest closure (a
  strength section owning its own title) lives in `coachRevisionProposal.ts`,
  LR-6 FROZEN. Belongs to the same coach-pipeline unit as Sam question 10.
  Three conjuncts gate reachability (composed title AND no strengthIntent AND
  no classifiable row), which is why no harness world hits it today.
- **The refusal-numbers artifact gap** (Task 11, minor). The exact
  differential counts (2/6, 9/9, 972/987 of 30,937) are not re-runnable from
  disk as a standing artifact — the method is documented (~15 min rebuild)
  but there is no committed script that reproduces them on demand.

## Method findings (from the ledger, verbatim in spirit)

**(a) The matrix-before-phone rule held.** Every task ran its
domain/matrix/walker laws to green before any device-pass claim, and no
task's report claims glass verification it did not have — six of eleven
task reports say explicitly "NOT VERIFIED ON GLASS" and name exactly what
their slice of the combined device pass (below) must check. L11 (one
combined pass, not eleven partial ones) was honoured throughout.

**(b) Confident comments were the least reliable artifact — three
instances, all in Task 11.** Across two review rounds, three separate
defects were each hidden behind a comment that stated something false with
total confidence: a claim of "byte-identical to what the parser returned"
that wasn't; a docblock naming a threat its own cell could not actually see;
and "the component's own exercise names" while the code actually passed the
whole day's names. The whole-bible differential caught the ONE defect that
was a genuine behaviour change (a moved gym session picking up its
destination's team name); a human reviewer caught the other two, both of
which lived entirely inside a claim rather than in the diff's behaviour. The
standing lesson: a comment asserting a property is not evidence of the
property, and should be replaced by (or paired with) a test that would fail
if the comment became false.

**(c) A declared red/gap must block any task that wires its subject into a
render path.** Task 3's deep-tier walk declared cells 1 and 4 red honestly
before any surface moved onto the projection. Task 5 then shipped a card-path
crash: a plan-defect surfaced pre-review because the brief's own literal
instruction ("title = day.headline") collapsed every training card to the
generic word "Training Day," contradicting the reassessment's own §4 ruling
(card renders headline + all part headlines). The general rule the reviewer
proposed and this report ratifies: a declared red or gap is not merely
informational once a later task wires its subject onto a screen — that
wiring must re-check the declaration is still accurately scoped, or the red
becomes a live defect on glass instead of a receipt in a test file.

**(d) The deep-tier OOM-on-undeclared-red hazard.** When an UNDECLARED
violation triggers a shrink of a 90-action deep-tier history, the shrinker
can exhaust memory (exit 134) rather than producing a minimal repro. Task
6's method — enumerate every reachable shape via a catch-all assertion plus
`WALKER_SURVEY=1` BEFORE writing a law that can red at depth — avoided this
and is recorded as the standing technique for any future walker-law author
working at the deep tier.

## THE COMBINED DEVICE PASS CHECKLIST — the merge gate

One pass. Every line actionable: what to tap, what must be seen. Compiled
from the plan's Task 12 template plus the specific lines each task's report
contributed to it.

```
COMBINED DEVICE PASS — fix/g1-ownership-and-move-scoping
merge condition: this checklist passes in ONE session, start to finish.

1. THE ORIGINAL FIVE TAPS (G-1 unit, from branch memory):
   a. The move-ask flow: start a move on a session with a real destination
      conflict and confirm the athlete is ASKED, not silently overridden.
   b. G-1 add-optional routes: add an optional session on a day and confirm
      it lands without displacing existing content.
   c. Scoped move: move a single component off a combined day and confirm
      only that component leaves (the rest of the day stays).
   d. Scoped bin/remove: remove a single component off a combined day and
      confirm the day's surviving content is named for what remains, not for
      what was removed or for the day's team-training half — this is the new
      device-pass line Task 11 added, below (item 9).
   e. Kill-and-reopen after a move/bin (folded into item 7 below).

2. RENDER CHECKS — card vs. day title vs. day content:
   a. Confirm identical wording for a day's name on the week card, the
      day-detail title, and the day-detail metadata line, across every day
      of the visible fortnight, INCLUDING a G+1 recovery day.
   b. Open a combined team + strength day and confirm it still reads
      "Team Training + <strength name>" the same way on the card and the
      title.
   c. Open a plain strength day and confirm the exercise count matches what
      is actually numbered on screen (not a stale four-branch classification).

3. NEW WEEK-SCREEN BUTTONS (ruling 2-4, 6):
   a. "Short on time today" — tap it, confirm an acknowledgment sentence
      appears (not silence); TODAY's session should be the only one to
      change; every other day's plan must be untouched. NOTE: declared red 1
      (schedule-fact ownership collision) means this may currently refuse on
      a real accepted program — if it refuses, confirm the refusal sentence
      reads "That didn't save — your week is unchanged. Give it another go
      in a moment." rather than silence or a false success.
   b. "Away this week?" — pick a day, confirm it clears and the sheet
      reports success or the same honest refusal sentence as above.
   c. "I'm sick/flat today" — opens the readiness sheet; confirm the label
      reads "I'm sick/flat today" nowhere showing the old "I'm not 100%".
   d. "I'm injured" — opens the guided injury flow directly (same flow the
      readiness sheet's "Something hurts" row opens).
   e. Icons: hourglass / globe / pulse / plaster-bandage — confirm no two
      adjacent buttons share a glyph, and the injured icon reads distinctly
      from the readiness sheet's own alert-triangle "Something hurts" row.

4. FOUR-ACTION MENU straight from "Want to change something?" (no
   intermediate menu):
   a. Swap / Add / Move / Remove, four rows, each with an icon, no "Edit this
      session" step in front of them.
   b. Add offers exactly five rows: Strength / Conditioning / Gunshow /
      Mobility / Accessories(Prehab) — no recovery row.
   c. Tap Swap on a team night (has a session, not the athlete's to trade):
      confirm the sub-line reads "Nothing on this day can be swapped." — not
      the old, potentially-false "nothing here" line.
   d. Tap Swap/Remove on a genuinely empty day: confirm "There's nothing on
      this day yet."
   e. Per-row swap/remove buttons on the session-detail page (no modal); top
      icon row (+ / equipment / injury); confirm no "Edit exercises" modal
      appears anywhere in the app.

5. COACH SCREEN: no chips on a fresh conversation (welcome message followed
   by nothing); the input still works; a day-menu "Ask the coach" door still
   lands on Coach with the input prefilled.

6. EQUIPMENT STEP on FRESH INSTALL: the equipment unit's onboarding step
   appears, ticks = answers, and the NEVER surface (`equipment_answer`
   transaction kind) is present — cross-unit check, not this unit's own
   work, but this unit's onboarding-adjacent changes must not have disturbed
   it.

7. KILL-AND-REOPEN: force-quit and relaunch after a move/bin/add; confirm
   the week is relaunch-identical (L16 loop closes) — no re-derivation
   drift, no duplicate or missing content.

8. ICON EYEBALL PASS (ruling 10) — every option row, all sheets. Full
   per-row inventory to check against: `swap_reason`, `add_kind`,
   `future_scope` (Task 9's Sam-eyeball list,
   `.superpowers/sdd/2026-07-31-buttons-ui-unit/task-9-report.md` "Per-row
   glyph inventory"); the three named `WeekReadinessSheet` fixes (Rough sleep
   no longer a chevron, Totally cooked no longer generic lightning, Sick-how-
   bad no longer droplets); the session-detail icon row (Task 8, item 4e
   above).

9. BIN ONE COMPONENT OF A COMBINED DAY on the real device, legacy-state
   shaped (Task 11's device-pass addition): the survivor's title must not
   name the removed component (e.g. binning conditioning off "Team Training +
   Upper Push" must not leave a title that still says "Team Training" if the
   survivor is the strength half, or vice versa).
```
