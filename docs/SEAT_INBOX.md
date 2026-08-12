# SEAT INBOX — the review seat writes here; the terminal reads at every stop

**REWRITTEN 2026-08-12 after Sam asked the seat to audit it.** It had grown to
527 lines with three numbering schemes, stale cross-references from the seat's
own renumbering, two orders that contradicted each other, and three items already
done. **Detail lives in the linked docs; this file is the QUEUE.** Keep it under
200 lines.

## Unprocessed (newest first)

Deep background: `docs/HOW_TO_BUILD_THIS_APP_2026-08-12.md` (the architecture
answer) and `docs/ATLAS_VERIFICATION_2026-08-12.md` (receipts). A new agent's
entry point is `docs/CODEX_HANDOFF_2026-08-11.md`.

**THREE STAND-DOWNS — each has already cost time or money once.**

**A. THE FIFTH HARD DAY IS CLOSED.** **Sam:** *"4 hard days plus 1 moderate/easy
day is prefered but 5 hard days is okay"*. Five is not a defect. Measured well
(`a8f13d91`), correctly not wired. **Do not switch it on.**

**B. HYDRATION MAY QUIETLY RE-SHAPE THE DAYS AHEAD — ALREADY ANSWERED.** **Sam:**
*"once a session is done then it's locked in, only the rest of the week can
change ... wednesday to sunday should adjust to accomodate this"*. Both halves
already match the code. **No work owed. Do not ask again — fourth appearance of
the granted-permission defect.**

**C. SAM CANNOT DEVICE-TEST UNTIL HE REBUILDS HIS PHONE.** **Sam:** *"I can't
test until I've rebuilt my phone"*. **Nothing in this queue depends on his
phone.** State device items as PARKED in a stop report, never as a request.

---

1. **STANDING, EVERY STOP — MERGE, THEN VOCABULARY, THEN PROPORTION.** These are
   always in force; they are not work items to clear.

   **1a. MERGE `codex/*`.** For every `codex/*` branch with commits not in
   `main`: `git merge --no-ff`, run the gates, **fix or report anything red —
   never leave it unmade and never ask Sam to merge.** Quiet if nothing is new.
   **The stop report names in ONE LINE which of Sam's UI changes are now in
   `main`** — his phone runs `main`, so that is how he sees Codex's work.
   **KNOWN BLOCKER: `codex/program-week-navigation-bounds` adds two registry rows
   that red `test:law-registry`'s `ruledAt` cell. Fix them in the merge.**
   **Do not care which folder Codex uses** — the seat broke an isolated worktree
   on 2026-08-12 and Sam said *"you just make things more complicated for no
   fucking reason"*. This order is branch-based. **Do not propose isolation
   again unless a real collision is observed and named.**

   **1b. THE WORD "DONE" IS RETIRED.** Every claim is **WORKING** (name the test
   that fails if it breaks), **BUILT** (code exists, nothing checks it) or
   **WRITTEN** (a doc says it, no code). **Banned: done, shipped, in, handled,
   sorted.** `docs/HOW_WE_STOP_BELIEVING_THINGS_ARE_DONE_2026-08-12.md` §3.

   **1c. MECHANICAL ITEMS BATCH.** A style value, icon, copy string, label or
   one-line predicate with no behaviour change is **batched with its neighbours
   into ONE unit, ONE report, ONE sweep** — no per-item measure/build/mutate/
   report/stop cycle. Test: *would a wrong answer change an athlete's training?*
   If no, batch it. **Mutation testing stays mandatory for anything that would.**
   Rigour on rules work is untouched (`CLAUDE.md:30`).

   **1d. NEVER POLL A LONG RUN.** Start it, block on completion, read the result
   ONCE. **No progress narration, no re-reading files while waiting.** On
   2026-08-12 the terminal spent ~52.8k of Sam's tokens saying *"still zero
   reds"* fifteen times. If a wait cannot be blocked on, say so in one line and
   stop.

2. **MAKE THE CHAIN CHEAP — MEASURED 2026-08-12, AND THIS ITEM'S OWN DIAGNOSIS
   WAS WRONG.** `docs/STOP_2026-08-12_WALKER_TIMING.md`. **Sam, 2026-08-12:**
   *"i want to know how long that 192 tests are taking and if it's really
   necessary"*.
   - **PAID — the ~25 minutes.** `action-walker:deep` is **not** an expensive
     suite: it was **34.6s and green on 2026-08-10**. It cost ~25 minutes on
     2026-08-12 **only because it went RED** — one walk breaks a law at step 87
     and the shrinker replayed the whole 88-action history up to **200 times at
     11-15s a replay**. The walking itself is 7-9s per walk; the laws cost 5ms
     per action; nothing is rebuilt per step; there are no sleeps, polls,
     retries or timeouts. Budget is now **12** (`69f388c3`, both arms
     mutation-checked) and the suite measures **213s**.
   - **"SHARD IT" IS REFUSED, WITH REASONS.** All the time sat inside ONE walk,
     so three shards is still one 25-minute shard; the walks share module-level
     mutable state and cannot overlap in a process; and the stale-debt cell
     reads declared-red hits across the WHOLE tier, so it fails in every shard.
     **"Walk only what changed" does not exist** — there is no map from a source
     file to a walker coordinate.
   - **Per-suite times recorded in `NOW.md`.** The chain is a short head and a
     long free tail: **125 of 165 units finish under a second.**
   - **NOT PAID — `test:accepted-state-transactions` is 89.5s**, the largest real
     unit, new since 2026-08-07, and **never looked at.**
   - **NOT PAID — the agreement law has NOT established agreement.** Last run
     AGREES (158 units, 2.17x) but **the run before it DISAGREED** on
     `chain:runSlice1`'s exit code, and the chain has grown 158 → 192 units.
     **The flake is the finding.** `parallel` stays NON-OFFICIAL; `NOW.md:72` is
     deliberately unchanged.
   - **PAID — the red underneath.** `L-P4 MENU = PROJECTION` fired on a day the
     card called a "Rest" appointment and the projection called a movable
     recovery session. **Sam, 2026-08-12: "recovery session"**, so
     `moveOptionsForDay` now takes BOTH halves of its offer from the projection
     and `MOVE_SCOPE_SECTION_KIND`/`MOVABLE_SECTION_KINDS` are deleted. A
     representation removed, not a guard added. `0ad3793f` — seed 3 clean,
     **deep is 47s**, two mutation-checked cells, sweep 14 of 190 identical to
     baseline.
   - **PAID — `THE L16 SLICE`, and it was a REAL data-loss defect, not a test
     artefact.** A bare profile envelope must ask the disk before it writes; a
     material one need not. So a WIPE issued FIRST landed LAST, on top of the
     answers issued after it — the athlete's 40 answers were in memory and the
     disk held a 103-byte empty shell. Persisted state is inputs only, so the
     next launch had nothing to rebuild the program from. Writes to the profile
     key now chain, which also makes the quarantine law work for the first time
     (the bare write now reads a disk that holds the answers, so it is REFUSED).
     `fd4f68a2` — one mutation-checked cell, **sweep 14 of 190 -> 10 of 190,
     FOUR suites green, ZERO new reds.** Two named suspects were refuted first:
     the quarantine held nothing and the replay latch was false.
   - **NOT PAID, NOT INVESTIGATED — a second defect found on the way past.**
     Rehydrating an EMPTY profile envelope does not merely fail to restore
     answers: `profileStore`'s `merge` spreads `...persisted` over the live
     state, so it flips `isOnboardingComplete` from **true to false** in memory.
     An empty envelope actively un-finishes a finished profile. Reachable
     whenever disk is bare and memory is not.
   - **STILL OPEN — `test:accepted-state-transactions` is 89.5s**, the largest
     real unit, new since 2026-08-07, never looked at.

3. **KILL THE ±7 INVENTION — A LIVE CORRECTNESS DEFECT, AND NOW MORE REACHABLE.**
   `section18CraftTier.ts:161` fabricates neighbouring games at ±7 days and
   `weekStructureValidator.ts:255,272` **trusts them as real**, so an irregular
   fixture list gets the WRONG protection, not a missing one. **Any-day games
   landed 2026-08-12, so a midweek athlete can exist for the first time — this
   defect just became reachable by real users.** Derive from the fixture list or
   pass nothing.

4. **THE MODERATE DAY — half of Sam's shape, held by nothing.**
   *"4 hard days plus 1 moderate/easy day"* (`LFA_PROGRAMMING_BIBLE.md:4808`).
   Hard days have a range, a maximum and two findings.
   `achievedModerateDayCount` (`section18EffectiveWeekEvaluator.ts:1034`) has
   **ZERO readers** — a week of 4 hard days and no moderate day passes silently.
   **FIX: a `preferredModerateDayRange` + an ADVISORY finding, never blocking**
   (`:4810`), then a generation target toward 4+1. **MEASURE FIRST:** print the
   count across all 17 `test:qa` scenarios.

5. **UNPINCH THE FIXTURE WAIST.** `derivedWeekContract.ts:90`
   `const fixture = fixtures[0] ?? null` is the ROOT; the twelve `.find()`/`[0]`
   sites are symptoms. Then `Section18ContractV2Input.fixtureDay` →
   `fixtureDays: number[]` and `anchorsFor` mapping over it
   (`weeklyExposureContractV2.ts:693-736`). Consumers that already `.filter()`
   need no change. **`HOW_TO_BUILD_THIS_APP` §5.4. Sam's "add a game" button
   cannot be built until this lands.**

6. **PLANNED LOAD IS NOT EXPERIENCED LOAD.**
   `docs/HOW_THE_ATHLETE_TELLS_US_2026-08-12.md`. Hard/moderate/easy stays for
   BUILDING; readiness must read what the athlete REPORTED. `conditioningSRPE`
   is built and correct (`journalLoad.ts:509-520`) and its only importers are
   four journal files, behind the surface Sam hid. **Ordered after item 4 on
   Sam's call** — *"the moderate day shouldnt this be before planed vs
   experienced because it's part of planned?"* **MEASURE FIRST: does a strength
   session have a start timestamp? Grep found none and the plan depends on it.**
   **§4 IS NOW RULED. Sam, 2026-08-12:** *"assume they did as planned"*. **A
   missing answer means the session happened as planned, at the planned effort,
   MARKED AS AN ESTIMATE.** Build it; do not re-ask.

7. **STRENGTH JOINS THE CAPACITY ARITHMETIC.** Sam: *"sometimes that may mean
   only doing 1 strength session during the week if they have 2 games and 2 team
   trainings"* — **unreachable today by design.** The only fixture-authorised
   gateway reduction writes `conditioning_core_frequency` ONLY
   (`section18AcceptedWeekGateway.ts:1205`), and strength capacity counts
   team-training days as available (`weeklyExposureContractBuilders.ts:386-388`)
   though `nonTeamDays` (`:277`) exists for everything else. **A 1-strength week
   is the PLAN, not a shortfall.** **And fix the copy** —
   `section18ShortfallDisclosure.ts:96-103` has one template, *"Resting {Day}
   means you'll miss a strength session"*, which blames the athlete for the
   club's draw.

8. **MY STATUS OWNS THE MODIFIERS — ONE UNIT, THIS ORDER, DO NOT REORDER.**
   **Sam ruled the old Program sheets obsolete:** *"we don't need this anymore -
   it shows up in the status bar and on the a simple thing shows on day screen
   and week screen"*. His design: Day and Week are READ-ONLY indicators; Coach /
   My Status owns the detail as **a row with a chevron**, not inline buttons.
   **(a)** land the 7 inert actions on My Status in that shape
   (`LIVE_ACTION_KINDS = ['dismiss_note']`, `CoachStatusScreen.tsx:168`); also
   `CoachTabScreen.tsx:466` passes `EMPTY_EQUIPMENT_FACT_IDS` so its equipment
   testIDs are wrong by construction. **(b)** retire the caption
   (`projectionCopy.ts:378` *"Change this on your program screen for now."*) and
   `repoLawGuardsTests.ts:1510`'s `NOT_YET_SURFACE` cell **in the same commit —
   finishing (a) without this FAILS that guard**. **(c)** THEN delete the
   Program-side leftovers: `handleCoachNoteAction` (`HomeScreenV2.tsx:350`), its
   state (`:238`, `:242`), `clearCopyForNote` (`:2583`), `CoachNoteSheet`
   (`:2634`, mount `:1190`), the DUPLICATE injury mount `:1198` (**keep `:1148`,
   it is live**), and the false comment at `:2578`.
   **(c) BEFORE (a)+(b) STRANDS ATHLETES** — the caption sends them to the screen
   (c) removes.

9. **BUILD LAYER 3 — THE ATHLETE'S WILL. RULED BY SAM 2026-08-12:** *"should
   give warnings but allow them to do whatever they want"*. **So: the app warns
   and RECORDS that it warned, then does what the athlete asked. A `block` with
   no way through is retired except where the action is physically impossible.**
   `HOW_TO_BUILD_THIS_APP` §2. **What Sam actually asked for** — *"nothing so tight that ... the athlete can't
   choose to do whatever they want"* — **and it does not exist.** A `block` has
   one button labelled `"OK"` (`PlanChangeSheet.tsx:859-883`); `canOverride` is
   written in nine places and **read nowhere in production**; an allowed override
   is **not recorded** (`planChangeProducer.ts:2412-2416`). Collapse the four
   competing answers to "is this the athlete's will" onto `resolverMayDisplace`,
   including the `source === 'manual'` OR-branch at
   `projectVisibleWeek.ts:214-219` and the `date|name` STRING JOIN at
   `section18CraftTier.ts:217-232` **which breaks on a rename**.

10. **THE GATE — `LAW-computed-must-be-consumed`.** `HOW_TO_BUILD_THIS_APP` §4
   lists NINE values computed every assessment and read by nobody. One
   `noUnusedWrites`-style gate over `contract.*` and exported rule outputs
   catches all nine. **Subsumes the narrower `subject: 'doc' | 'behaviour'`
   proposal — build it here, not in item 13.**
   **CORRECTION FROM THE TERMINAL, 2026-08-12, worth keeping:** this gate would
   NOT have caught the eight-copies-of-one-answer class. *"Computed and unread"*
   and *"computed eight times over"* are different diseases wanting different
   instruments.

11. **THE FEATURE REGISTRY.**
   `docs/HOW_WE_STOP_BELIEVING_THINGS_ARE_DONE_2026-08-12.md`. Two states, no
   third — **`held`** (names the test that fails) or **`UNPROVEN`** (names what a
   proof would take) — plus a `reachable` field laws do not need. Copy
   `lawRegistry.ts` exactly; **do not design a second mechanism.** Seed it
   honestly and let the number be ugly.

12. **PICTURES MUST BE NEWER THAN CODE.** `UI_STATE_2026-08-12.md:14` pins itself
   to `a9c82856`, **a docs-only commit 14h48m after the newest screenshot** —
   which is why the seat cited a stale UI location with confidence. **Do NOT
   just re-shoot** (Sam has more UI coming; they would restale immediately):
   SHA in the filename, a committed manifest (shots are gitignored, so mtime
   dies at `git clone`), one gate cell, and the index may never pin to a docs
   commit. **Then shoot once, after Sam's UI work settles.**

13. **KEEP THE UNENFORCED LAW COUNT FALLING.** Measured 2026-08-12 by the
   terminal: **97 rows, 65 guarded, 32 UNENFORCED.** Priority is the FOUR that
   change what the athlete sees — `LAW-L6-honest-actions`,
   `LAW-attributed-content-change`, `LAW-L5-no-dead-affordances`,
   `LAW-L15-one-write-format`. Two rows read guarded but are held by grepping
   `NOW.md` for a word (`LAW-L4-device-is-arbiter`, `LAW-L10-phone-is-done`).

14. **FIRST BATCH UNDER 1c — ONE UNIT.** Off-feet walking gate
   (`conditioningFeasibility.ts:215` permits walking ungated while `:207`/`:210`
   reject running and hills and `:326-329` forgets walking — declare `onFeet` on
   the family table and derive both gates); session-size floor and ceiling at
   `sessionRowCounting.ts:253` plus `MIN EXERCISES PER SESSION` in the prompt;
   `ModifiersStrip`'s two dead union members (`:41-43`). **INCLUDE the `ProfileScreen` "TEMPORARY" diagnostics
   (`:147`, `:622`, `:630`, `:1626`): SAM CONFIRMED 2026-08-12 that the
   "Something changed?" dead tap the 29 July diagnostic was chasing now WORKS.**
   Delete the counter readout and its state. **The `:630` release-visible export
   block is a SEPARATE 2026-07-30 concern — read its own comment before touching
   it, and do not delete it in the same sweep.**

15. **FINISH THE PHASE-SHEET MOVE.** The surface is on the Coach tab
   (`CoachTabScreen.tsx:479`); the implementation never followed, so
   `src/components/SeasonPhaseShiftSheet.tsx` is a permanent six-line re-export
   of a component still inside `HomeScreenV2.tsx:3352`. Move it, delete the
   bridge, delete the orphaned `phaseCard` style (`:4173` — the existing gate
   greps *usage*, so the dead definition passes). Nothing breaks.

Not ordered yet, shaped in `ATLAS_VERIFICATION` §4: retire dormant code to
`src/retired/` (49 unreachable tap sites, 67 unmounted routes); make onboarding
addressable then walk it; the harvest ratchet and a computed tap atlas.

## SAFE FOR A PARALLEL AGENT — context, not orders

**This heading is the stop hook's region terminator** (`repoLawGuardsTests.ts:252`
`INBOX_ORDERS_END`). **Everything below it is invisible to the hook, which is
correct — nothing below is an order. Do not put an order here, and do not rename
this heading.**

**SAM OWNS THE UI AND IS WORKING ON IT NOW.** *"i like how the app is looking
now - but i have a few more UI tweaks to make and then it's all about getting it
functioning like a proper app with my logic fully in the app"*. **"Fully in the
app" means CONSUMED, not present** — that phrase is the whole queue above.
**LANDED by Codex 2026-08-12:** the day/week toggle staying put across weeks, and
the 7-day chip grid (4+3). **Still his:** edit icons on injury tap-throughs; icon
colours in the flat button; icon sizes; recovery icon → full battery; weekly-view
buttons (*Away this week* + equipment yes/no → bodyweight; *Practice match*
removed from the day screen in pre-season; *Bye* as a weekly-only in-season
button); an add/move/swap/remove entry point on the weekly view. **Plus "add a
game", which is BLOCKED on item 5.**
**Do not start these and do not "help".** Merging them is item 1a.

**BUTTON REMOVAL, ALWAYS:** ~49 tap sites sit in files that read as live
(`HomeScreenClassic` is inside the file the navigator mounts, behind a
compile-time const). **Prove a control is REACHABLE before removing it, and
report the ones you could not reach** — those are the finding.
`LAW-L5-no-dead-affordances` is UNENFORCED, so nothing catches a mistake here.

**THE MERGE LEFTOVERS CENSUS** (`docs/WHAT_THE_MERGE_LEFT_BEHIND_2026-08-12.md`)
found: **ZERO controls an athlete can tap that do nothing**; five half-finished
moves (items 8, 12, 15 above cover them); seven of eight surfaces with no current
picture (item 12). **The journal was NOT touched** — one commit, one line, a
shared data-shape change its readers correctly followed. Sam was right and the
seat was wrong.

## AWAITING SAM — parked behind his phone rebuild, never a request

- The Wednesday game-day check (`06401d92`), the Renee UI pass, and the craft
  tier's hydration relocation are all **BUILT, awaiting device acceptance**.
  When he rebuilds, the white screen after a refused dev launch is expected and
  now names its own cause (`docs/WHITE_SCREEN_BOUNDARY_2026-08-10.md`).
- **CLOSED, do not re-ask:** the week-card shape; the accounts question
  (LOCAL-ONLY); the platform question (iPHONE-ONLY).

## Previously (now processed)

`docs/SEAT_INBOX_ARCHIVE_TO_2026-08-10.md` — most recently the craft validator,
cleared 2026-08-12. **This file holds LIVE ORDERS ONLY.** It was 353KB once and
every stop paid to re-read it.

## HOUSEKEEPING (not an order — the hook stops scanning before here)

**EVERY ORDER LIVES UNDER `## Unprocessed`. Sub-headings inside it MUST be
`###`.** `scripts/seat-inbox-hook.sh` bounds its scan at the next `## `, so an
order under its own `## ` heading is INVISIBLE to the stop hook and Sam becomes
the courier. The seat did this twice on 2026-08-12. **A guard cell now exists
(`1fcf5c04`) — but keep orders in ONE numbered sequence anyway: three schemes
(000/00/0a/0 plus a second 1-4 inside a context section) is why the terminal
picked the wrong item three times.**
