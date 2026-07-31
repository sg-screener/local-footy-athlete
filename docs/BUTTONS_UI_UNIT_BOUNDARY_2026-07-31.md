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

**LR-6 disclosure.** `coachRevisionTemplates.ts` changed additively this
unit (Task 6): an exported row-name list (`COACH_REVISION_TEMPLATE_ROW_NAMES`,
derived from the same emitter the writer already calls, not transcribed) was
added so `projectionCopy.ts` could register template-placed row names as
`SignedCopy`. The file is coach-pipeline-adjacent but nothing existing —
behaviour, string, or matching key — changed; it is additive only, so it
sits within the letter of the LR-6 freeze. Disclosed here for accuracy
rather than left implicit.

**The 13 design rulings** (`docs/HOME_SCREEN_REDESIGN_RULINGS_2026-07-30.md`):

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
| 9 | Add/Swap menus offer the five signed types | SHIPPED — the fifth row's label RULED "Accessories" (Sam, 2026-07-31) | 4 |
| 10 | Global icon rule, every option row | SHIPPED | 4, 8, 9 |
| 11 | Injury "Other" data-path investigation | ALREADY DONE pre-unit (`4bb425a`) | — |
| 12 | "Edit exercises" modal retired, inline editing | SHIPPED (+ Sam's live mid-review ruling on `concern_reason`) | 8 |
| 13 | Seven Coach preset chips removed | SHIPPED (UI only; coach pipeline untouched) | 10 |

Full copy detail for every ruling and every new/retired string is in
`docs/COPY_SHEET_RULINGS_2026-07-30.md` under "Batch 6 — buttons/UI unit
(2026-07-31): ONE SIGNABLE PASS" (tidied by this task into
SIGNED-BY-RULING / SIGNED / RETIRED / RULED; `test:copy-rulings-binding`
7/7). Batch 6 is SIGNED and §6-IV carries Sam's four final rulings.

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
  reds for the opposite reason. **This was exercised within a day**: Sam's
  2026-07-31 ruling closed `DECLARED_DOMAIN_GAPS`'s only entry, and the
  mechanism forced its deletion in the same commit that re-pointed the two
  cells — the list is now empty, which is a result the mechanism is designed
  to be able to report.

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

Six entries in `athleteActionWalkerTests.ts`'s `DECLARED_RED`, two in
`programControlDurableOwnershipTests.ts`. All are gated in `test:bible` (a
declared red is a pass with a receipt, not a hidden fail) and all stay red
until their named owner pays them — none is a buttons/UI task.

`surfaceAgreementTests.ts`'s `DECLARED_DOMAIN_GAPS` is now **EMPTY** — see
entry 7, closed by ruling rather than by work. The mechanism stays (it is
general, and it degrades correctly on an empty list: nothing absorbs a failure,
and the stale-check passes trivially).

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
   scope:block + `acceptedStateTransaction` validation).
   **RULED BY SAM, 2026-07-31 — and the entry STAYS RED.** End state is a
   rolling ~two-block horizon derived on demand; the interim unit makes the
   existing rollover succeed or refuse honestly with a sentence. A ruling is not
   a fix: the athlete is still told nothing today, so the declaration stands
   until the interim lands, and its `paidBy`/`expiresWhen` now name that unit
   instead of "nobody owns it". Sam questions 5, and item 1 of the post-merge
   queue below.

7. ~~**2× domain gaps, one entry, two cells**
   (`g1_sunday_is_rest_not_a_recovery_day`)~~ — **CLOSED BY RULING,
   2026-07-31, not by work.** See Sam question 7 below for the connection.
   The entry declared that the G+1 Sunday resolves `source: 'rest'` with no
   workout, so cells 2 and 4 (which described it as a RECOVERY day) could not
   pass, and named "the recovery-as-a-day-type owner, reassessment staging
   step 5" as the owner who would eventually close it. Sam ruled that owner
   out of existence: the session-type charter work deleted recovery as an
   athlete-facing session type, so REST with zero parts IS the end state.
   Both cells are re-pointed at that end state and **PASS** against it —
   `kind: 'rest'`, zero parts, "Rest Day" on card and detail, an Add door
   offering the five signed types, and swap/move/remove refusing with the
   typed cause `no_session`. The entry is deleted, which the mechanism's own
   direction 3 ("stale debt fails") would have forced on the next run
   regardless.

   Carried forward from the old entry, because it is still true: cell 4 used
   to abort on its first assertion, so its `canRemove` and move claims had
   not run since the entry was written. They run now, against the OPPOSITE
   expectation, and they were unproven in either direction before this
   commit — treat them as new cells, not as regressions, if they ever red.

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

Eleven, in the order they surfaced in the ledger. Each has a pointer into the
copy sheet, a declared-red entry, or a task report for the full trace.

**ALL ELEVEN ARE NOW ANSWERED.** Sam ruled the remainder on 2026-07-31 in one
final pass. The numbering is kept as-is rather than compacted, so the pointers in
the task reports and the ledger still land on the question they were written
against. Status at a glance:

| # | Question | Outcome |
|---|---|---|
| 1 | Accessories vs Prehab | RULED — "ACCESSORIES", landed |
| 2 | Swap/Add sub-lines: neutral or enumerating | RULED — NEUTRAL as shipped, no code change |
| 3 | Practice-match day reads "Game Day" | RULED — signed + wired, awaits its producer (reads "Game Day" on device until createGameStub ships the type) |
| 4 | Remove sub-line can lie on a single-session day | RULED — state-selected variant, landed |
| 5 | Block rollover fails silently | RULED — end state + interim, TOP of the post-merge queue |
| 6 | Generated conditioning rows have no authored name | QUEUED — conditioning vocabulary (Stage B) |
| 7 | G+1 Sunday: rest or recovery | RULED-AND-CLOSED — Rest Day IS the end state |
| 8 | Schedule-fact ownership collision | QUEUED — declared reds 8/9 VALIDATED by Sam's device |
| 9 | What should "Short on time today" DO | QUEUED — with question 8, needs the "how short is short" ruling |
| 10 | Are the signed rulings files law | RULED-AND-DONE — tracked in `docs/` |
| 11 | Coach voice composes from `workout.name` | QUEUED — rides the LR-6 lift |

The four copy rulings (1-4) landed with the code and the copy sheet in the same
commit; §6-IV of `docs/COPY_SHEET_RULINGS_2026-07-30.md` now records them as
RULED and carries Sam's words. **Batch 6-II is SIGNED** — every PROPOSED string
signed as written, with the §6-V caveat standing: the two sentences written
against INTENDED behaviour re-sign when declared red 2 is paid.

1. **RULED (Sam, 2026-07-31): the fifth Add/Swap row is "ACCESSORIES".**
   Ruling 9's own word, and the athlete's familiar term. It stays wired to the
   prehab door and the shield icon stands — the CATEGORY ID is `prehab`, a typed
   id nobody reads, so the door, the template match and every capability are
   untouched and only the word changed. `CATEGORY_COPY.prehab.label` carries it;
   the sub-line ("...the armour work") is unchanged and signed as written.
   Pointer: `docs/COPY_SHEET_RULINGS_2026-07-30.md` §6-IV-1.

2. **RULED (Sam, 2026-07-31): the NEUTRAL form, signed as shipped.** The two
   sub-lines one tap above the five-row Add/Swap menu name no type ("Change it
   for another type of session" / "Put another session on this day"). No code
   change — the shipped wording is the signed wording. The enumerating
   alternative is recorded in the sheet as NOT TAKEN, so the next person who
   notices the menu is unnamed does not re-propose it. Pointer:
   `docs/COPY_SHEET_RULINGS_2026-07-30.md` §6-IV-2.

3. **RULED (Sam, 2026-07-31): a practice match reads "Practice Match".** A
   practice/trial fixture day carries its own signed day-headline variant
   (`day.headline.practice_match`) instead of "Game Day". LABEL ONLY:
   `dayIsFixture` keeps its week-shape behaviour, the day KIND stays `game`, and
   every capability with it. All three render sites get it through the two
   shared helpers (`visibleDayLeadHeadline` for the week card and the away-day
   picker, `projectDayDetail` for the day-detail title).
   `projectionOwnershipTests` projects a practice match and a competitive
   fixture from identical input but for the `workoutType` and asserts everything
   except the headline is equal. Pointer:
   `docs/COPY_SHEET_RULINGS_2026-07-30.md` §6-IV-4 and §6-II-a item 1b (which
   records the producer seam honestly: the generator's own practice-match anchor
   still resolves through `createGameStub`, so the word turns on when that
   anchor materialises with its own type).

4. **RULED (Sam, 2026-07-31): the Remove sub-line is STATE-SELECTED.**
   Multi-content day: "Remove it — anything else on the day stays." Sole-content
   day: "Remove it — the day becomes rest." A typed cause picks the sentence —
   this unit's own pattern, like the swap sub selected by `hasSession`. The part
   that is architecture rather than copy: the confirmation one tap later already
   makes the same claim, so ONE predicate (`removeEmptiesTheDay`, in the producer
   that owns `binScopes`) decides the scope picker, the row's sub-line and — via
   `label: null` — the confirmation, and `planChangeMoveScopingTests` forbids the
   sheet from re-deriving the question itself. Pointer:
   `docs/COPY_SHEET_RULINGS_2026-07-30.md` §6-IV-3.

5. **RULED (Sam, 2026-07-31): block rollover — END STATE and INTERIM, and it is
   the TOP of the post-merge queue.**

   **END STATE (Stage B): a rolling horizon of ~TWO TRAINING BLOCKS, derived on
   demand.** No stored future blocks, and therefore no rollover EVENT that can
   fail. Later weeks derive as they enter the horizon, using the freshest logged
   reality at the moment they do (estimate → measured). This is the north star's
   own rule applied to the block lifecycle: the rollover is not a decision, so it
   is not stored — it is the horizon moving, and a thing that is derived on
   demand has no moment at which it can silently not happen.

   **INTERIM (the unit that goes first): the existing rollover must SUCCEED, or
   REFUSE HONESTLY with a sentence.** The silent stop IS the defect — not the
   failure. Today `rebuildLocalWeek` finds ledger blockers and throws,
   `useHomeScreen` catches and logs, and the athlete gets no crash and no
   sentence, just a program that stopped outside the edit horizon. Whichever way
   the interim lands, the athlete is told.

   Declared red 6 (`block_rollover_fails_silently_and_the_program_stops`) STAYS
   RED and stays declared until that interim unit lands; its `paidBy` /
   `expiresWhen` now name the interim ruling rather than "unowned". Pointer:
   declared red 6 above.

6. **Generated conditioning rows have no authored name.** Half the
   conditioning-row population is composed at generation time from planner
   nouns and numbers rather than named from Sam's 55 signed
   `conditioningTemplates.ts` doses, which exist but are "NOT WIRED YET" per
   that file's own header. Pointer: declared red 5 above.

7. **RULED-AND-CLOSED (Sam, 2026-07-31): the G+1 Sunday resolves REST, and
   REST is the answer.** The question was raised as a gap awaiting the
   reassessment's stage-5 "recovery as a day type" ruling. **The connection
   that closes it: that ruling had already been made, in another unit.** The
   session-type charter work DELETED recovery as an athlete-facing session
   type — design ruling 9's "(type deleted)" — and Task 4 of this very unit
   implemented the consequence, dropping the recovery row from the Add and
   Swap menus. So a day the athlete cannot add recovery to, swap recovery
   onto, or reach recovery through was still being described by two of this
   unit's own cells as a recovery day, and the "gap" was those cells holding
   the app to a type Sam had retired. There is no stage-5 recovery unit
   pending: **Rest Day is the ruled end state**, and the two cells now assert
   it exactly (declared red 7 above, deleted).

   What this does NOT close, and what does not follow from it: the recovery
   VOCABULARY still standing in the code below the menus. See NOT-COVERED,
   "the recovery vocabulary the ruling leaves behind", for the four named
   residuals and the one place the charter now contradicts the ruling
   outright.

8. **Schedule-fact ownership collision — busy/away doors have been DEAD in
   production. VALIDATED BY SAM, 2026-07-31: "busy/away felt dead."** The writer
   re-canonicalises against the accepted base; the verifier forbids any
   non-scoped-regen change to that base; whichever side is wrong, the fact is
   refused on every device with a real accepted program. Two candidate fixes
   point opposite ways (`temporarySourceFactTransaction.ts:707` vs `:731`;
   `illnessClearGameWeek`'s own comment forbids one of them). Needs an
   accepted-state ownership ruling, not a patch. **Declared reds 8 and 9 are
   VALIDATED, not merely declared** — Sam's own device experience matches what
   the two reds assert, which is the confirmation a declared red normally has to
   wait for. Queued second, behind block rollover. Pointer: declared reds 8-9
   above, `task-7-report.md`.

9. **What should "Short on time today" DO to a session? VALIDATED with 8.** The
   `time_cap` fact exists and structurally fits, but the minutes question it
   would need — Sam's phrasing, **"how short is short?"** — has not been ruled.
   Even once the ownership collision in question 8 is resolved, this constraint
   changes nothing visible in any generated week today. The ruling is owed with
   the same unit as question 8, and until it lands the two success sentences in
   copy sheet §6-II-f keep their caveat. Pointer: declared red 9 above.

10. **RULED-AND-DONE (Sam, 2026-07-31): the signed rulings files are LAW and
    they get TRACKED.** The question was that `test:copy-rulings-binding`
    (armed in `test:bible`, ~position 93) hard-asserts a rulings file exists
    and binds every quoted string against it both directions, while that file
    sat in the gitignored `artifacts/` scratch directory — so a fresh clone
    had no copy sheet, the bible failed immediately on it, and the entire
    signable Batch 6 pass existed only as an untracked local file, one
    `git clean` from gone. Neither of the two candidate fixes was taken;
    Sam ruled the third: a signed rulings file is not scratch, so the three
    of them moved into the tracked tree —
    `docs/COPY_SHEET_RULINGS_2026-07-30.md`,
    `docs/HOME_SCREEN_REDESIGN_RULINGS_2026-07-30.md`,
    `docs/MOBILITY_PAIRING_RULINGS_2026-07-31.md`. The binder reads the
    tracked path, so there is no second copy to keep in sync, and every other
    reference across `src/` and `docs/` was repointed in the same commit.
    `artifacts/` and its gitignore are UNTOUCHED — it remains a working
    directory for genuine scratch. `docs/` was already where every other
    signed rulings file lived (`ONBOARDING_PHASE_SHAPE_RULINGS`,
    `OPTIONAL_PLACEMENT_RULINGS`, `STAGE_C_TIME_TRIAL_RULINGS`,
    `BATCH4_BATCH6_RULINGS`), so the ruling names the convention that already
    existed rather than inventing one. Pointer:
    `.superpowers/sdd/2026-07-31-buttons-ui-unit/post-unit-rulings-report.md`.

11. **Coach voice still composes from `workout.name`, LR-6-blocked.** The
    packet's day-summary prose is also a matching key the frozen
    router/executor string-compare, so moving it to projection vocabulary is
    a frozen-layer behaviour change LR-6 forbids. Unblocking needs a
    coach-pipeline unit that either lifts LR-6 with a migration plan or
    re-homes the ~983 distinct name-production inputs / ~1,002 calls
    Task 11 measured. Pointer: `task-10-report.md` §2 (the full trace),
    `task-11-report.md` §"MEASURED SCOPE REDUCTION".

## THE POST-MERGE QUEUE — confirmed by Sam, 2026-07-31, in this order

Sam's own order, recorded so the next session starts from a ruled queue rather
than picking the most legible item. Nothing here is in scope for this unit; the
merge gate remains the combined device pass below.

1. **BLOCK ROLLOVER — TOP.** Carries the two-block-horizon ruling: end state is
   a rolling ~two-block horizon derived on demand (no stored future blocks, no
   rollover event to fail); the INTERIM unit that goes first makes the existing
   rollover either succeed or refuse honestly with a sentence. Sam question 5.
2. **Schedule-fact ownership collision + the "how short is short" `time_cap`
   ruling.** One unit: the accepted-state ownership ruling (question 8) and the
   minutes question (question 9) are the two halves of making the busy/away
   doors do something. Declared reds 8-9, VALIDATED by Sam's device.
3. **The four D13 session-list conservation reds.** `L-P3 TEMPLATE = PROJECTION`
   — the athlete's session list should be driven by the day's PARTS, not by two
   `workoutType` predicates disagreeing with the projection. Declared reds 1-4.
4. **Conditioning vocabulary (Stage B).** Generated conditioning rows composed
   from planner nouns and numbers rather than named from Sam's 55 signed
   `conditioningTemplates.ts` doses ("NOT WIRED YET"). Declared red 5,
   question 6.
5. **Coach voice migration — rides the LR-6 lift.** The packet's day summaries
   still read planner-composed words that are also frozen matching keys.
   Question 11. Cannot start before LR-6 is lifted with a migration plan.
6. **`HomeScreenClassic` deletion.** Unreachable behind the `DESIGN_VERSION`
   early return; nontrivial because source-regex pins elsewhere reference it.
7. **The binder's `src/rules/` blind spot.** `copyRulingsBindingTests` cannot
   see `projectionCopy.ts` or `temporarySourceFact.ts`. See NOT-COVERED below
   for the exact residual — and note the sibling instrument gap recorded at the
   ceiling: `signedCopyExtractionTests`'s line-based extractor cannot see a
   multi-line ternary sub-line, which is why Sam's new Remove sentence is real
   new athlete-visible prose that moved the count by zero.
8. **Cross-walk contamination investigation.** Something from an earlier walk
   contaminates a later one across the `freshInstall` boundary; currently
   sidestepped by keeping the schedule doors in the deterministic cell. See
   NOT-COVERED. Should be found before another door tries to move into the
   random band and inherits the hazard.
9. **Practice-match workoutType producer.** `day.headline.practice_match` is
   signed and wired at the one render seam (6-IV-4), but nothing in the app
   produces a `Workout` whose `workoutType` triggers it: `createGameStub`
   (`sessionResolver.ts:397`) hardcodes `'Game'`, and the pre-season
   practice-match fixture resolves through that same stub. Small, named so it
   is not mistaken for a defect of this pass — see checklist item 2d below.

## NOT-COVERED

- **Coach packet/voice composition** — LR-6-blocked; see Sam question 11 and
  the Scope-delivered section above.
- **The Remove row's sub-line and the whole-day scope confirm can still
  disagree, on an unanchored multi-kind day.** `binScopesForSnapshot`
  (`planChangeProducer.ts:846-862`) returns `[...parts, WHOLE_DAY_SCOPE]` for
  an unanchored day carrying two or more section kinds (e.g. a plain strength
  day the athlete added conditioning to) — `parts` because there is more than
  one thing to remove individually, `WHOLE_DAY_SCOPE` because nothing anchors
  the day. `removeEmptiesTheDay` (`planChangeProducer.ts:513-515`, reading
  `binScopes.length <= 1`) is therefore false on that day, so the Remove row
  (`PlanChangeSheet.tsx:582-584`) reads "Remove it — anything else on the day
  stays." — correct for the row as a general statement, since `canRemove`
  alone does not empty the day. But `startBin` (`PlanChangeSheet.tsx:482-489`)
  still routes to the `pick_bin_scope` step because `removeEmptiesTheDay` is
  false, and that step (`PlanChangeSheet.tsx:956-979`) offers the
  `WHOLE_DAY_SCOPE` alongside the parts; choosing it sets
  `label: scope.id === 'whole_day' ? null : ...` (`:973`), and the
  `confirm_remove` step (`:981-986`) reads `step.label === null` as "Are you
  sure? This will be removed and the day becomes rest." — the row's own
  promise, contradicted one tap later, on a day the row itself was describing.
  Reproduced and confirmed real (not a fixture accident): a generated Monday
  strength day, `add_category`'d with `conditioning_light`, reaches exactly
  this state. Not invented copy here — recorded as open question 6-VI in
  `docs/COPY_SHEET_RULINGS_2026-07-30.md`, pinned behaviourally (current
  behaviour, not the intended fix) in `planChangeMoveScopingTests.ts`, and on
  the combined device pass checklist as item 4f for Sam to rule on live.
- **The binder's `src/rules/` blind spot.** `copyRulingsBindingTests`'s
  SOURCES scan covers `screens/home`, `screens/coach`, `components`, and four
  named authoring modules — it cannot see `src/rules/projectionCopy.ts` or
  `src/rules/temporarySourceFact.ts`, both of which carry athlete-visible
  strings that ship today (copy sheet §6-II-a, §6-II-e/f). Runtime `L-P2`
  covers every rendered word, so the residual is direction-one only: a
  RETIRED string could still sit unseen inside `src/rules/` after the app
  stops rendering it, with nothing in the bible saying so. Recorded here so
  whoever extends the binder next starts from a true inventory of what it
  cannot see, not just what it can.

  **TWO MORE BLIND SPOTS, MEASURED WHILE LANDING SAM'S FINAL RULINGS
  (2026-07-31) — found by mutation, not by reading.** Same inventory:

  1. **The binder's PROPOSED direction cannot see a one-word label change.**
     It asks whether a quoted string occurs ANYWHERE in the scanned sources, so
     reverting `CATEGORY_COPY.prehab.label` from "Accessories" back to "Prehab"
     leaves `test:copy-rulings-binding` **7/7 green** — "Accessories" still
     occurs in `coachRevisionTemplates.ts`'s "Prehab & Accessories" and in
     `PlanChangeSheet`'s own comments, and comments are part of the scanned
     text. The ruling is pinned behaviourally instead, on the PRODUCED option
     (`planChangeMoveScopingTests`, "the fifth Add/Swap row reads
     'Accessories'"), which reds on that mutation. General shape: a substring
     search over whole files is a weak gate for any string short enough to be
     a substring of another.
  2. **`signedCopyExtractionTests` cannot see a multi-line ternary sub-line.**
     `extract()` matches a field name and its literal on ONE LINE, so a
     state-selected `sub={...}` — the pattern this whole unit adopted — is
     invisible to it. Sam's new "Remove it — the day becomes rest." is
     genuinely new athlete-visible prose inside `SURFACE_DIRS` and moved the
     count by zero; its two siblings have been invisible the same way since
     Task 4. Stated in full at the ceiling's own docblock, because that is
     where a future reader will look. Widening the regex re-counts the whole
     surface tree in one commit — a ceiling re-baseline, and a unit of its own.
- **`CoachScreen`'s verification layer reads** (`coachTurnController`,
  `coachUndoEngine`, `coachRevisionProposal`, `coachModalitySwapOrchestrator`,
  `programEditWriteGuard`) — explicitly not touched (LR-6); they keep
  `buildProgramTabProjectedWeek`/`snapshotProjectedDay` and are recorded as
  census debt, not migrated.
- **The recovery vocabulary the ruling leaves behind** (replaces the former
  "recovery-as-a-day-type, stage 5" bullet, which described a unit that is no
  longer coming — see Sam question 7). Recovery is not an athlete-facing
  session type; it is still all over the code. Four residuals, each named so
  the next owner starts from an inventory rather than a search:

  1. **THE CHARTER NOW CONTRADICTS THE RULING, and its gate cannot see it.**
     `src/rules/sessionTypeCharter.ts` still charters `recovery` as one of
     Sam's seven programmable types, with
     `chosenBy: { categories: ['recovery'], otherDoor: null }`. The charter's
     own chooser rule (that field's docblock) says: *"Never 'there is no
     door': a type the athlete cannot reach at all is a type the charter
     refuses."* Since Task 4, `PlanChangeSheet` renders five type rows and
     `recovery` is not one of them, so the athlete cannot reach it — the
     charter is now asserting a door that does not exist. The gate passes
     anyway, and precisely why matters: `sessionTypeCharterTests` cell **B2**
     checks only that each claimed category is a member of
     `PLAN_CHANGE_CATEGORY_IDS`, and `recovery` is still one of those. The
     gate binds the charter to the PRODUCER's vocabulary and has no
     observation of what the SHEET draws. **This is not fixed here.** The
     charter is another unit's authored source and rewriting it from a
     surface unit is exactly the ownership violation the charter exists to
     prevent — but the contradiction is stated precisely so its own unit can
     rule it: either recovery keeps a door (and the sheet grows a sixth row),
     or its charter row moves to `otherDoor`/debt and B2 gains an
     observation of the rendered menu.
  2. **The producer's `CATEGORY_COPY.recovery` row** and `recovery` as a live
     `PLAN_CHANGE_CATEGORY_ID` — `listPlanChangeOptionsForDay` still returns
     it in `options.categories` on every editable day. Nothing renders it
     (the sheet groups categories into ruling 9's five rows), and
     `addOnTopCategories` already filters it explicitly. Census debt: a door
     the producer offers and no surface draws.
  3. **`applyGameProximity` still places recovery** (`sessionResolver.ts`).
     An EMPTY G+1 is rest — that half was paid by the charter unit, and it is
     what makes the ruled Rest Day above true. But when a real planned,
     displaceable, non-core session sits on G+1, the resolver still replaces
     it with a derived `Post-game recovery` session. So the athlete can still
     be SHOWN a recovery day that no menu offers and no door can produce.
     The charter file already carries this as prose ("what is deliberately
     left"), scoped to the recovery door; it is now the sharper question,
     because the door it was scoped to has been deleted.
  4. **The §18 counting question is NOT open.** Recorded here because the old
     bullet listed it as outstanding: `test:section18-recovery-neutrality` is
     armed in `test:bible` and pins the ledger's numbers directly
     (`trueFullRestDays` / `activeRecoveryDays` / findings) rather than
     asserting a green run. Sam's ruling-3 requirement, "§18 counting must be
     proven unchanged with explicit tests," is met. What remains is
     vocabulary, not arithmetic.

- **The `projectedDay` single-day shortcut** — RE-EXAMINED 2026-07-31 and
  CONVERTED, not carried. This bullet used to warn that
  `planChangeProducer.ts`'s `projectedDay(day)` projects a single-day week and
  would silently diverge "the moment cross-day recovery derivation lands (a
  day's projection depending on its neighbour, e.g. G+1 reading G's fixture)".
  That named trigger is retired by the ruling above — there is no cross-day
  recovery derivation coming. The hazard was MISNAMED rather than removed: any
  cross-day read added to `projectParts` (a week-level rest quota, a
  second-hard-day rule, a fixture glance at the neighbour) makes the MENU
  project a different day from every other surface, silently. So the claim is
  now a law instead of a warning — `projectionOwnershipTests`, "projecting ONE
  day equals projecting the week and picking that day out", asserts the
  equality over the whole generated horizon and reds if a cross-day read is
  ever introduced. Mutation-checked: a `week.length`-dependent `canAdd` reds it.
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
  LR-6 FROZEN. Belongs to the same coach-pipeline unit as Sam question 11.
  Three conjuncts gate reachability (composed title AND no strengthIntent AND
  no classifiable row), which is why no harness world hits it today.
- **The refusal-numbers artifact gap** (Task 11, minor). The exact
  differential counts (2/6, 9/9, 972/987 of 30,937) are not re-runnable from
  disk as a standing artifact — the method is documented (~15 min rebuild)
  but there is no committed script that reproduces them on demand.
- **The Task 7 cross-walk contamination harness hole** (minor, schedule
  soon). The walker's schedule doors (`busy_week` / `away`) are driven by a
  deterministic cell, not the random action band — because putting them in
  the random band turns seed 6 red with an L1 generation crash, and the
  shrunk history `[onboarding, generate]` does not reproduce it alone
  (seeds 5-6 pass, seeds 4-6 fail), meaning something from an earlier walk
  is contaminating a later one across the freshInstall boundary. Two missing
  resets (athlete pool prefs, coach modality prefs) were fixed and do not
  account for it. Currently sidestepped by keeping the doors in the
  deterministic cell; the contamination itself is unfound and should be
  scheduled soon, before another door tries to move into the random band and
  inherits the same hazard.

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
      of the visible fortnight — INCLUDING the day after a Saturday fixture
      (G+1 Sunday), which must read "Rest Day" on all three. That is the
      RULED state (Sam, 2026-07-31: recovery is not an athlete-facing session
      type, so an empty G+1 is rest), not a placeholder for something better.
      A recovery day rendered in that slot is a DEFECT of this pass.
   b. Open a combined team + strength day and confirm it still reads
      "Team Training + <strength name>" the same way on the card and the
      title.
   c. Open a plain strength day and confirm the exercise count matches what
      is actually numbered on screen (not a stale four-branch classification).
   d. A practice-match / pre-season fixture day still reads "Game Day" today
      — NOT a defect of this pass. The signed word "Practice Match"
      (`day.headline.practice_match`) is registered and wired at every render
      site; it turns on when the producer ships the workoutType. Seam:
      `createGameStub` (`sessionResolver.ts:397`) hardcodes `workoutType:
      'Game'`, so no route in the app produces `'Practice Match'` yet. See
      post-merge queue item 9.

3. NEW WEEK-SCREEN BUTTONS (ruling 2-4, 6):
   a. "Short on time today" — tap it, confirm an acknowledgment sentence
      appears (not silence); TODAY's session should be the only one to
      change; every other day's plan must be untouched. NOTE: declared red 8
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
      Mobility / Accessories — no recovery row. The fifth row reads
      "Accessories" (Sam's ruling, 2026-07-31), never "Prehab", and carries
      the shield.
   c. Tap Swap on a team night (has a session, not the athlete's to trade):
      confirm the sub-line reads "Nothing on this day can be swapped." — not
      the old, potentially-false "nothing here" line.
   d. Tap Swap/Remove on a genuinely empty day: confirm "There's nothing on
      this day yet."
   e. Per-row swap/remove buttons on the session-detail page (no modal); top
      icon row (+ / equipment / injury); confirm no "Edit exercises" modal
      appears anywhere in the app.
   f. Tap Remove and confirm the row's sub-line is the STATE-SELECTED
      sentence (ruling 6-IV-3): a sole-content day reads "Remove it — the day
      becomes rest."; a day with more than one thing on it reads "Remove it —
      anything else on the day stays." KNOWN RESIDUAL, Sam to rule live: on
      an UNANCHORED day with two-plus section kinds (e.g. a plain strength
      day an athlete has added conditioning to), the row reads "...anything
      else on the day stays" — but tapping Remove still opens a scope picker
      offering "Whole day", and choosing that scope shows a confirm reading
      "Are you sure? This will be removed and the day becomes rest." under a
      row that just promised the opposite. Look at exactly that flow (plain
      strength day + Add > Conditioning, then Remove) and rule which sentence
      the row should carry when a whole-day scope is on offer. Recorded as
      open question 6-VI in `docs/COPY_SHEET_RULINGS_2026-07-30.md`, pinned
      behaviourally in `planChangeMoveScopingTests.ts` ("the row sub-line and
      the whole-day scope can still disagree on an unanchored multi-kind
      day"), and traced in this doc's NOT-COVERED with the file:line.

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
