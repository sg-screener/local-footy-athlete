# SEAT INBOX — the review seat writes here; terminal reads at every stop

## Unprocessed (newest first)

**READ `docs/HOW_TO_BUILD_THIS_APP_2026-08-12.md` FIRST — it supersedes the
ordering of every item below and answers Sam's 2026-08-12 brief on how the app
should be built. `docs/ATLAS_VERIFICATION_2026-08-12.md` still carries the
receipts behind it. Entry point for a new agent is `docs/CODEX_HANDOFF_2026-08-11.md`.**

**TWO STAND-DOWNS BEFORE ANYTHING ELSE — both cost money if missed.**

**STAND-DOWN A — THE FIFTH HARD DAY IS CLOSED BY SAM. DO NOT SWITCH IT ON.**
The terminal measured it well (`a8f13d91`: app-selected in 7 weeks of 8) and
correctly did not wire it. **Sam then ruled, 2026-08-12:** *"4 hard days plus 1
moderate/easy day is prefered but 5 hard days is okay"*. **Five hard days is not
a defect. The measurement was worth having and the work it implied is withdrawn.**
Do not spend another hour here.

**STAND-DOWN B — SAM HAS ALREADY ANSWERED THE HYDRATION-MOVE QUESTION. DO NOT
ASK IT AGAIN.** The 2026-08-12 stop report closes by asking Sam whether a stored
week should be quietly swapped or left alone. **He answered it before that report
was written** — see `## AWAITING SAM'S EYE` below: quiet adjustment of the days
still ahead is **the behaviour he wants**, and the lock boundary is the DATE.
**Fourth appearance of the granted-permission defect. Check this file before
writing a `⚠ SAM` line.**

---

### SAM'S DIRECTION, 2026-08-12 — THE UI IS NEARLY DONE AND HE OWNS THE REST OF IT

**SAM:** *"i like how the app is looking now - but i have a few more UI tweaks to
make and then it's all about getting it functioning like a proper app with my
logic fully in the app"*.

**THIS RE-PRIORITISES THE LEFTOVERS CENSUS AND MOSTLY MEANS LESS WORK:**

1. **DO NOT RE-SHOOT THE SEVEN SURFACES YET. Deferred, deliberately.** Sam has
   further UI tweaks coming, so shots taken now go stale the day they are taken.
   **Build `LAW-picture-newer-than-code` (census §4) FIRST — the gate, not the
   photographs** — then shoot ONCE, after his tweaks land, and let the gate name
   exactly which surfaces need it. **The gate is the deliverable; the pictures
   are its output.**
2. **M1 (the Coach note sheets that cannot open) is NOT UI work — it is a lost
   FEATURE, and it stays high.** An athlete cannot reach two sheets. Small, and
   it belongs in "make it function properly", not in the UI pass.
3. **M2 / M3 / M5 ride along with Sam's tweaks** — they touch the same screens.
   Do not open them as their own units and do not touch those files while he is
   in them.
4. **THE MAIN EVENT IS `HOW_TO_BUILD_THIS_APP` — that IS "my logic fully in the
   app".** Items 1-5 of this inbox are that work and they are almost all in
   `src/rules/` and `src/store/`, NOT in screens, **so they run in parallel with
   his UI tweaks with only three collision files** (the phase sheet,
   `GameDayScreen.tsx`, `PlanChangeSheet.tsx`). Keep going.

**THE ONE THING TO CARRY:** his phrase is *"my logic fully in the app"*. Every
finding this session says the same thing in different words — his rules exist and
are not consulted (the craft validator wired to log, the moderate day counted and
discarded, the fifth-hard-day arithmetic thrown away, `canOverride` read by
nobody). **"Fully in the app" means CONSUMED, not present.**

### SAM'S OWN UI LIST, 2026-08-12 — HE IS DOING THESE. STAY OUT OF THESE FILES.

He listed 12 UI items he wants to work on. **Mostly pure UI and none of it is
terminal work.** Recorded so nobody collides with him and so two are not built
wrong:

**BLOCKED — DO NOT BUILD THE BUTTON FIRST.** *"Add a game button - needed for
school footy or double up weeks ... needs to live in season when a game is
already scheduled and they need to add another game"*. **This is inbox item 3,
not a UI item.** `derivedWeekContract.ts:90` takes `fixtures[0]` and drops the
rest, so a second game cannot be stored. **A button shipped before item 3 is a
dead affordance that looks like it worked.** Build item 3, then the button.

**COLLISION CLEARED 2026-08-12 — GOES TO CODEX.** *"when shifting season phases
the 7 days button option is spread across 2 lines - 6 on line 1 then 1 on line
2"* — that is `styles.chipGrid` (`HomeScreenV2.tsx:4270`, `flexWrap: 'wrap'`,
`justifyContent: 'center'`), used at `:3443`, `:3491`, `:3533` in the season
phase sheet. **The seat first flagged it as colliding with item 4 and then filed
it under "Sam is doing these" — which meant NOBODY owned it. Sam caught that:**
*"this is being fixed by claude eventually isn't it?"* **It was not going to be.**
Item 4's remaining work (the ±7 invention in `section18CraftTier.ts`, the waist
at `derivedWeekContract.ts:90`) is in RULES files, not this screen, so the
collision is over. **CODEX OWNS IT.** Seven chips at `justifyContent: 'center'`
wrap 6+1; the fix is a design call — narrower chips, a deliberate 4+3, or a
single scrolling row.

**THE LESSON, AND IT IS THE SESSION'S OWN DISEASE:** *"blocked on a collision"*
and *"assigned to Sam"* got merged into one note, and the item fell out of both
queues. **An item parked for a collision must name WHO PICKS IT UP WHEN THE
COLLISION CLEARS, or it is not parked, it is dropped.**

**HIS REMAINING TEN ARE PURE UI AND HIS:** day/week toggle not sticking across
week navigation; edit icons on injury tap-throughs; icon colours in the flat
button; icon sizes too small overall; recovery icon → full battery when adding a
session; weekly-view buttons (*Away this week* with the equipment yes/no →
bodyweight branch; *Practice match* REMOVED from the day screen in pre-season,
it already lives in both; *Bye* as its own weekly-only in-season button); and an
add/move/swap/remove entry point on the weekly view that asks "what do you want
to edit" then follows the existing sequence.

**DO NOT start any of these. Do not "help".** They are recorded here only so the
terminal does not enter these files and so the two above are not built in the
wrong order.

### THE MERGE'S LEFTOVERS — from `docs/WHAT_THE_MERGE_LEFT_BEHIND_2026-08-12.md`

**SAM ASKED, 2026-08-12:** *"well how many things did codex changed that haven't
been seen and implemented properly cause thsat was not the only change we mad"*.
**Three numbers: ZERO controls an athlete can tap that do nothing; FIVE
half-finished moves; SEVEN of eight surfaces with no current picture.**

**M1. REWRITTEN — SAM RULED THE OLD SHEETS ARE OBSOLETE, AND THE SEAT'S "LOST
FEATURE" CLAIM WAS WRONG.**

**SAM, 2026-08-12, with prototype screenshots:** *"we don't need this anymore -
it shows up in the status bar and on the a simple thing shows on day screen and
week screen ... you'll see where the modifiers are"*.

**HIS DESIGN, from `docs/design/LFA_UI_PROTOTYPE_2026-08-10.html`:** Week shows
one line — *"2 active modifiers impacting program"*. Day shows a small card —
*"2 active modifiers / Currently impacting your program"* — plus a
*"Need to make a change?"* row of five modifier icons. **Coach owns the detail:**
a `PROGRAM STATUS` card, and My Status lists each modifier as a **row with a
chevron**, above an `ADD A MODIFIER` row. **Day and Week are READ-ONLY
INDICATORS. Coach/My Status is the owner.**

**THE SEAT'S CORRECTION, OWED PLAINLY.** The seat reported that
`<CoachNoteSheet>` and `<GuidedInjuryFlowSheet>` "cannot open" and called it a
LOST FEATURE needing restoration. **The guided injury flow is NOT lost:** it has
**four mounts and three live doors** — `HomeScreenV2.tsx:1148` (opened by the
"Injured" control at `:856`; the comment at `:850` says *"ONE OWNER, TWO
DOORS"*), `DayWorkoutScreenV2.tsx:1523`, and `HomeQuickActionSheet.tsx:81`
(dormant). **`HomeScreenV2.tsx:1198` is a DUPLICATE mount of a live sheet, not
the only one.** Only `<CoachNoteSheet>` (`:1190`, defined `:2642`) is genuinely
orphaned — **and Sam has now ruled it obsolete.**
**METHOD ERROR: "this code has no caller" is NOT "this feature is unreachable."
The seat checked the first and reported the second.** Third instance — see
`seat-verify-before-telling-sam` in project memory.

**SO: DELETE, DO NOT RESTORE.** Remove `handleCoachNoteAction`
(`HomeScreenV2.tsx:350`), its state (`:238`, `:242`), `clearCopyForNote`
(`:2583`), the `CoachNoteSheet` component (`:2634-2642`) and its mount (`:1190`),
and the DUPLICATE injury mount at `:1198` — **keeping `:1148`, which is live.**
Delete the false comment at `:2578`.

**BUT THERE IS ONE HARD ORDERING CONSTRAINT — DO NOT DELETE FIRST.**
`projectionCopy.ts:378` is athlete-visible signed copy reading
**`"Change this on your program screen for now."`** It renders on My Status
(`ActiveModifiersSection.tsx:150`) for every modifier action still inert — **7 of
8 kinds** (`LIVE_ACTION_KINDS = ['dismiss_note']`, `CoachStatusScreen.tsx:168`).
**That sentence sends the athlete to the exact screen this order removes.** Delete
the Program route first and the app tells them to go somewhere that no longer
does anything — a dead affordance created by the fix.

**THEREFORE M1 AND M3 ARE ONE UNIT, IN THIS ORDER:** (a) land the 7 remaining
modifier actions on My Status in Sam's shape — **a row with a chevron that opens
the modifier, not the current inline action buttons**; (b) retire the caption and
`repoLawGuardsTests.ts:1510`'s `NOT_YET_SURFACE` cell in the same commit; (c)
THEN delete the Program-side sheets. **Doing (c) first strands athletes.**

**M2. FINISH THE PHASE-SHEET MOVE.** Implementation to `src/components/`, delete
the six-line bridge, delete the orphaned `phaseCard` style
(`HomeScreenV2.tsx:4173` — the existing gate greps *usage*, so the dead
definition passes). Nothing breaks. **Good parallel-agent job, but it collides
with items 2-4 — before or after, never during.**

**M3. MY STATUS' SEVEN INERT ACTIONS (slice 3b).** 7 of 8 kinds dimmed and
disabled — honest, not lying. **WARNING: finishing this FAILS
`repoLawGuardsTests.ts:1510`, which pins the not-yet plumbing as law. Retire that
cell in the same commit.** Also `CoachTabScreen.tsx:466` passes
`EMPTY_EQUIPMENT_FACT_IDS`, so this surface's equipment testIDs are wrong by
construction.

**M4. THE PICTURE INDEX IS UNSAFE AND THAT IS WHY THE SEAT GOT IT WRONG.**
`UI_STATE_2026-08-12.md:14` pins itself to `a9c82856` — **a DOCS-ONLY commit
14h48m after the newest screenshot.** Three UI commits land after the last
shutter click; the named Day and Week shots both predate the code they claim to
show; `PlanChangeSheet` had its cannot-open crash fixed and **has never been
photographed open**. **Do NOT just re-shoot** — implement
`LAW-picture-newer-than-code` (census §4): SHA in the filename, a committed
manifest (the shots are gitignored, so mtime is the only receipt and it dies at
`git clone`), one gate cell, and the index may never pin itself to a docs commit.

**M5. SMALL:** `ModifiersStrip` says "ONE COMPONENT, THREE SURFACES" and has one
mount, with the other two gate-forbidden (`:2`, `:41-43`); and
`ProfileScreen.tsx:147`/`:622`/`:630`/`:1626` still render diagnostics marked
*"TEMPORARY ... REMOVE once the cause is known"*, dated 2026-07-29.
**OPEN-UNKNOWN whether that cause was ever found — ask before deleting.**

**M6. WITHDRAWN — THE SEAT WAS WRONG AND SAM WAS RIGHT.** The seat reported that
`JournalScreen.tsx` was "still being EDITED in this merge (08-11 03:12, 1,924
lines)" and put the question to Sam. **Sam:** *"no we didn't touch the journal -
or at least we didn't need to and i wasn't aware of that ? I don't know what's
happening"*. **He is correct. Nobody touched the journal.**
Measured: 21 commits built it 08-08 23:02 → 08-09 05:33; Sam hid it at
**08-09 07:53 (`7f9e54ab`)**. **Since the hide, exactly ONE commit touched the
file — `5f3bf336`, and it changed ONE LINE:**
`gameFeel: feedback.gameFeel` → `feedback.game?.feel ?? feedback.gameFeel`.
That is the shared game-feedback data shape moving and its readers following.
**Correct, necessary, and not journal work. Nothing to do.**

**THE METHOD ERROR THAT CAUSED IT, worth more than the item:** the seat read
"file appears in `git log --name-only`" as "someone worked on this", and quoted
the FILE'S line count (1,924) beside it — which reads as the size of the change.
**`--name-only` cannot distinguish a one-line sweep from a rewrite. Always read
`--numstat` or the diff before calling a file "worked on", and never quote a file
size as if it were a diff size.**

00. **TIME THE CHAIN. IT HAS NEVER BEEN MEASURED AND IT RUNS ON EVERY UNIT.**
   **SAM, 2026-08-12:** *"i want to know how long that 192 tests are taking and
   if it's really necessary"*.

   `test:bible` is **192 suites run SERIALLY** and it **stops at the first
   failure**, so a late break re-runs almost everything. **Grep found NO recorded
   runtime anywhere in `docs/`, `AGENTS.md` or `CLAUDE.md` — the cost paid by
   every single unit has never once been written down.**

   **DO THIS THE FREE WAY: you already run the chain. Time it and record it.** No
   special run. Report: total wall-clock, and **the ten slowest suites with their
   individual times** — that is where "is it really necessary" gets answered with
   a number instead of an opinion. Put the figure in `docs/NOW.md` and re-stamp
   it whenever it moves.

   **THEN THE OBVIOUS LEVER: `test:bible:parallel` EXISTS, and so does
   `test:bible:agreement`.** Both built. `NOW.md:72` still calls parallel *"a
   NON-OFFICIAL pre-check"*, so **every unit pays the serial cost while the
   parallel path and its own agreement check sit unused.** Same disease as
   everything else: built, never adopted. **If `agreement` passes, make parallel
   official and say so in `NOW.md`. If it does not pass, report why — that is a
   finding.**

0a. **PROPORTIONATE UNITS — THIS DEFAULT IS FLIPPED NOW, NOT SCHEDULED.**
   **SAM, 2026-08-12:** *"fic the full treatment issue for smaller iterms - again
   I think this is something we said we fixed BUT GUESS WHAT IT'S NOT FUCKING
   FIXED"*.

   **LOOP CHECK `seat-rations-what-Sam-ruled` — SIGHTING 4.** The rule
   (`AGENTS.md:99-103`) reads: *"when Sam rules a PRINCIPLE, the seat may schedule
   the WORK but may never schedule the PRINCIPLE. The default flips on the day he
   rules, and the backlog is what turns red, not what waits."* **The seat spent
   2026-08-12 queueing his rulings instead of flipping them. This item is written
   as a flipped default for that reason.**

   **THE DEFAULT, IN FORCE FROM NOW:** a MECHANICAL item — a style value, an icon,
   a copy string, a label, a one-line predicate with no behaviour change — is
   **BATCHED with its neighbours into ONE unit with ONE boundary report and ONE
   sweep.** It does not get its own measure → build → mutation run → report →
   stop cycle. **Mutation testing stays mandatory for anything that changes what
   the athlete is programmed.** The test of which bucket an item is in: *would a
   wrong answer here change an athlete's training?* If no, batch it.

   **THIS DOES NOT SHRINK THE RIGOUR ON RULES WORK** and must not be read that
   way — `CLAUDE.md:30` governs and is untouched. **It removes ceremony from work
   that never needed it, which is what has been making small items cost the same
   as large ones.**

   **FIRST BATCH, BUILD IT AS ONE UNIT:** items 8 (off-feet walking gate), 9
   (session-size floor and ceiling), M5 (`ModifiersStrip` dead union members;
   the `ProfileScreen` "TEMPORARY" release diagnostics dated 2026-07-29 — **ask
   Sam before deleting those, the cause may never have been found**).

0. **STANDING, EVERY STOP: MERGE CODEX'S WORK INTO `main`. SAM NEVER MERGES.**
   **SAM, 2026-08-12:** *"but then we'll have to merge it later won't we? how
   will i see what he's done?"*

   **AT EVERY STOP, BEFORE THE STOP REPORT:** for every `codex/*` branch holding
   commits not in `main`, `git merge --no-ff` it, run the gates, and **fix or
   report anything that reds — never leave the merge unmade and never ask Sam to
   do it.** Quiet if there is nothing new. **The stop report states in ONE LINE
   which of Sam's UI changes are now in `main`** — that is his answer to "how
   will i see what he's done", because his phone runs `main`.
   **The gates are the review.** Codex's work is judged like the terminal's own.

   **DO NOT CARE WHICH FOLDER CODEX USES.** The seat built an isolated worktree
   at `.claude/worktrees/ui-tweaks` on 2026-08-12, wrote a sandbox path into its
   git pointer, and broke it for Codex. **Sam:** *"you just make things more
   complicated for no fucking reason"* — **he is right; Codex working in the main
   checkout had been working.** This order is branch-based, not folder-based, so
   it holds either way. **Do not propose isolation again unless a real collision
   is observed and named.**

1. **STOP THE "BUILT BUT NOT IN THE APP" CLASS — read
   `docs/HOW_WE_STOP_BELIEVING_THINGS_ARE_DONE_2026-08-12.md`. THIS OUTRANKS
   EVERYTHING BELOW.** **SAM, 2026-08-12:** *"there's a lot of things that have
   been built in the past that i believed were in the actual app working but
   maybe they were just written down and then not included in the app ... how do
   we make sure this happens"*. **He asked the SAME question on 2026-08-10 about
   laws and built the answer** (`lawRegistry.ts:8`) — two states, no third, a
   number that may only fall. **Point it at features.** Item 1 of that doc costs
   nothing and starts now: **the word "done" is retired — every claim is
   WORKING (name the test), BUILT (code exists, nothing checks it) or WRITTEN (a
   doc says it, no code). Banned: done, shipped, in, handled, sorted.** Then the
   `noUnusedWrites` gate, then the feature registry seeded honestly and ugly.

2. **THE MODERATE DAY — the other half of Sam's shape, held by nothing.** He
   named *"4 hard days plus 1 moderate/easy day"*; the Bible states it once
   (`LFA_PROGRAMMING_BIBLE.md:4808`). **Hard days have a preferred range, a
   permitted maximum and two findings. Moderate days have a counter and nothing
   else:** `achievedModerateDayCount`
   (`section18EffectiveWeekEvaluator.ts:1034`) has **ZERO readers**. A week of 4
   hard days and no moderate day is accepted today with no comment from
   anything. **FIX: a `preferredModerateDayRange` and an ADVISORY
   `default_target_miss` — never blocking** (`:4810` — *"the preferred/default
   shape, not a universal blocking maximum"*) — then a generation target so the
   app builds toward 4+1. **MEASURE FIRST:** print `achievedModerateDayCount`
   across all 17 `test:qa` scenarios.

3. **PLANNED LOAD IS NOT EXPERIENCED LOAD — read
   `docs/HOW_THE_ATHLETE_TELLS_US_2026-08-12.md`.** **SAM, 2026-08-12:** *"we
   might classify something as hard when it's actually not to the athlete so
   maybe hard easy moderate is not the way to think about it or it's only a way
   to think about it for the programming but not for managing the readiness of
   the athlete?"* **His split is right.** Hard/moderate/easy stays for BUILDING
   the week; readiness must read what the athlete REPORTED. **Sighting 8:
   `conditioningSRPE` is built and correct (`journalLoad.ts:509-520`) and its
   only importers are four journal files — behind the surface Sam hid.** Order of
   work is §5 of that doc. **§4 (what happens when the athlete does not fill it
   in) is a RECOMMENDATION, not a Sam ruling — do not build past it without
   asking.** **ORDERED AFTER THE MODERATE DAY ON SAM'S CALL, 2026-08-12:** *"the moderate
   day shouldnt this be before planed vs experienced because it's part of
   planned?"* — **and his reason is the stronger one: do not start comparing
   PLANNED against EXPERIENCED while the planned shape is still half-defined.**
   Item 2 completes the planned vocabulary; this item then measures against it.
   **MEASURE FIRST: does a strength session have a start timestamp?
   Grep found none, and the whole plan depends on it.**

4. **THE FIXTURE WORK — (a) and (b) are DONE 2026-08-12; (c) and (d) are LIVE.**
   `docs/GAME_ANCHOR_BOUNDARY_2026-08-12.md`, guard `test:game-anchor`.
   **(a) any day of the week — LANDED.** One owner `src/rules/gameAnchor.ts`
   replaced EIGHT copies of the predicate; the allowlist, the `GameDay` enum and
   `mapToLegacyGameDay` are deleted. **The plan named one closed picker; there
   were two** — `ProfileScreen.tsx:74` had its own three-day list. **No device
   migration is owed and it is proven, not assumed.**
   **(b) `quiescentBoot` — LANDED in the same unit**, because it is the same
   line; declared rather than banked separately.
   **(c) THE ±7 INVENTION IS THE NEXT UNIT, and it is now MORE reachable** — a
   midweek athlete can exist for the first time, and an irregular fixture list
   is exactly what `section18CraftTier.ts:161` gets wrong.
   **(d) the waist at `derivedWeekContract.ts:90` is untouched.**

   Original order, kept for (c) and (d):
   **Supersedes every earlier game-day order in this file, on SAM'S OWN WORDS,
   2026-08-12:** *"games should be able to be placed any day of the week - i
   can't know when every single club in aus is going to play a game so I want to
   be prepared for everything"*. **This also retires his own previous-turn
   framing** (*"games are basically only ever on friday saturday sunday"*) —
   Fri/Sat/Sun is the COMMON case, not the supported set. **Build to seven days
   and N games.** In order:
   **(a) any day of the week** — the entire restriction is ONE allowlist at
   `sessionResolver.ts:526`; `GAME_DAY_MAP` already maps all seven days
   (`:2205-2213`); widen `GameDay` → `DayOfWeek`, delete `mapToLegacyGameDay`
   (3 call sites), open the picker. **Check devices for persisted `'Varies'`
   first.** **(b)** `quiescentBoot.ts:337-338`, the live loss-on-relaunch, one
   line. **(c) KILL THE ±7 INVENTION — a live correctness defect, not a gap:**
   `section18CraftTier.ts:161` fabricates neighbouring games the validator then
   trusts as real (`weekStructureValidator.ts:255,272`), so irregular fixtures
   get the WRONG protection. **(d) unpinch the waist:**
   `derivedWeekContract.ts:90` `const fixture = fixtures[0] ?? null` is the ROOT
   — the twelve `.find()`/`[0]` sites are its symptoms.

5. **STRENGTH JOINS THE CAPACITY ARITHMETIC.** `HOW_TO_BUILD_THIS_APP` §3.
   Sam: *"sometimes that may mean only doing 1 strength session during the week
   if they have 2 games and 2 team trainings"*. **Today unreachable by design:**
   the only gateway-time fixture-authorised reduction writes
   `conditioning_core_frequency` ONLY (`section18AcceptedWeekGateway.ts:1205`),
   and strength capacity counts team-training days as strength-capable
   (`weeklyExposureContractBuilders.ts:386-388`) while `nonTeamDays` (`:277`)
   exists and is used for everything else. **Derive the target from what the
   calendar leaves; a 1-strength week is the PLAN, not a shortfall.** **And fix
   the copy** — `section18ShortfallDisclosure.ts:96-103` has one template,
   *"Resting {Day} means you'll miss a strength session"*, so a fixture-caused
   shortfall blames the athlete for the club's draw.

6. **BUILD LAYER 3 — THE ATHLETE'S WILL.** `HOW_TO_BUILD_THIS_APP` §2. **This is
   what Sam actually asked for** (*"nothing so tight that ... the athlete can't
   choose to do whatever they want"*) **and it does not exist.** A `block` has
   one button, labelled `"OK"` (`PlanChangeSheet.tsx:859-883`); `canOverride` is
   written in nine places and **read nowhere in production**; an allowed override
   is **not recorded** (`planChangeProducer.ts:2412-2416`). Collapse the four
   competing answers to "is this the athlete's will" onto the one predicate
   `resolverMayDisplace` — including the `source === 'manual'` OR-branch still
   live at `projectVisibleWeek.ts:214-219` **inside the function the stamp was
   written to replace**, and the `date|name` STRING JOIN at
   `section18CraftTier.ts:217-232` **which breaks on a rename.**

7. **THE GATE — `LAW-computed-must-be-consumed`.** `HOW_TO_BUILD_THIS_APP` §4
   lists NINE values computed and read by nobody. **One `noUnusedWrites`-style
   gate over `contract.*` and exported rule outputs catches every one, and it
   subsumes the narrower `subject: 'doc' | 'behaviour'` proposal.** Sighting 6.

8. **ONE OWNER FOR OFF-FEET.** `conditioningFeasibility.ts:215` permits walking
   with no off-feet gate while `:207`/`:210` reject running and hills, and
   `:326-329` clears the flag for those two and forgets walking. Declare `onFeet`
   on the family table and derive both gates. Verification §2.2.

9. **A FLOOR AND A CEILING ON SESSION SIZE.** Enforce both at
   `sessionRowCounting.ts:253` — the site its own comment nominates. Emit
   `MIN EXERCISES PER SESSION` to the prompt.

10. **KEEP THE UNENFORCED LAW COUNT FALLING.** Measured 2026-08-12: **95 rows, 63
   guarded, 32 UNENFORCED.** Priority is the FOUR that can change what the
   athlete sees — `LAW-L6-honest-actions`, `LAW-attributed-content-change`,
   `LAW-L5-no-dead-affordances`, `LAW-L15-one-write-format`. Two rows read
   guarded and are held by grepping NOW.md for a word
   (`LAW-L4-device-is-arbiter`, `LAW-L10-phone-is-done`). **Build the subject
   check as item 5's gate, not as its own narrower one.**

Items 9-11 (retire dormant code to `src/retired/`, make onboarding addressable
then walk it, harvest ratchet + computed atlas) are shaped in the verification
doc §4 and wait behind the above.

## SAFE FOR A PARALLEL AGENT (Codex, in its OWN worktree — never this checkout)

Sam runs Codex in separate worktrees under `~/Documents/lfa-*`; that pattern is
correct and should continue. **Two agents in ONE checkout share a git index and
a test chain — the seat hit the lock toll alone on 2026-08-12 (see the handoff's
environment section). Give a parallel agent its own worktree and its own branch.**

**HANDS OFF while items 2-4 are live** — the terminal is in these:
- `src/components/SeasonPhaseShiftSheet.tsx` → `HomeScreenV2.tsx:3352` (the phase
  sheet; its `pendingGameDay` / `gameAnchorAnswered` props are item 2's fixture
  work). **NOTE THE SURFACE IS THE COACH TAB** — `CoachTabScreen.tsx:479` — not
  the home screen; see `HOW_TO_BUILD_THIS_APP` §6.
- `src/screens/onboarding/GameDayScreen.tsx` (item 2a opens this picker)
- `src/components/PlanChangeSheet.tsx` (item 4 gives its `block` step a way out)

**GOOD FIRST PARALLEL JOB — FINISH THE PHASE-SHEET MOVE.** The surface moved to
My Status; the implementation did not follow, so
`src/components/SeasonPhaseShiftSheet.tsx` is a permanent six-line re-export of a
component that still lives inside `HomeScreenV2.tsx`. Its own comment says it is
only for *"while its surface moves"*. **Move the implementation to
`src/components/`, delete the bridge.** Isolated, no rules touched — **but it
COLLIDES with items 2-4, so it runs BEFORE them or AFTER them, never during.**

**STANDING INSTRUCTION FOR ANY BUTTON REMOVAL:** this repo has ~38 tap sites in
files that read as live (`HomeScreenClassic` sits inside the file the navigator
mounts, behind a compile-time const). **Prove a control is REACHABLE before
removing it, and report the ones that could not be reached** — those are the
finding, not the failure. `LAW-L5-no-dead-affordances` is UNENFORCED, so nothing
catches a mistake here automatically.

---

## AWAITING SAM'S EYE (not terminal work)

- **SAM CANNOT DEVICE-TEST ANYTHING UNTIL HE REBUILDS HIS PHONE. DO NOT ASK
  AGAIN.** **Sam, 2026-08-12:** *"I can't test until I've rebuilt my phone"*.
  **Every device acceptance is parked behind that one act, not behind him.** The
  Wednesday game-day check, the Renee UI pass and the craft-tier hydration move
  all queue behind it. **Keep building — nothing in the queue depends on his
  phone.** State device items as PARKED in a stop report; never as a request.
  **Fifth appearance of the granted-permission defect if this is re-asked.**
  When he does rebuild: the white screen after a refused dev launch is expected
  and now names its own cause (`docs/WHITE_SCREEN_BOUNDARY_2026-08-10.md`).


- **RULED, 2026-08-12 — HYDRATION MAY ADJUST THE REST OF THE WEEK, QUIETLY. This
  item is CLOSED; do not re-ask it.** Sam, asked when a stored week should be
  allowed to move a session: *"once a session is done then it's locked in, only
  the rest of the week can change - so if it gets to wednesday, monday and
  tuesday are locked, they realise they have a saturday game and not a sunday
  game then wednesday to sunday should adjust to accomodate this"*.

  **Two laws fall out of that sentence and BOTH are already how the code
  behaves — this is a confirmation, not a change:**
  1. **The boundary is the DATE, not the tick.** `governedFromISO` is stamped
     "today" (`weeklyExposureContractV2.ts:215-217`) and the past test is
     `date < governedFromISO` (`section18EffectiveWeekEvaluator.ts:520`), so on
     Wednesday, Monday and Tuesday are facts and **Wednesday itself is still
     changeable** — exactly his words. Anchors before the boundary become
     `delivered_history`. **No work owed.**
  2. **A fixture change SHOULD re-shape the remaining days, with no notice and
     no attribution to the athlete.** The relocation the craft tier newly makes
     reachable at hydration is the BEHAVIOUR HE WANTS, not a risk to mitigate.
     **The proposed "tell him it moved" copy is WITHDRAWN by this ruling. Do not
     build it.** `docs/CRAFT_TIER_BOUNDARY_2026-08-12.md` §6 is answered.

- **The Renee UI merge is gates-green and unseen on a device.** Pictures:
  `docs/UI_STATE_2026-08-12.md`. **The week-card-shape question is CLOSED and
  must not be re-asked.**

## Previously (now processed)

Moved to `docs/SEAT_INBOX_ARCHIVE_TO_2026-08-10.md` — most recently order 1
(craft validator), cleared 2026-08-12.
**This file holds LIVE ORDERS ONLY from here.** It was 353KB and every
terminal stop paid to re-read it. Keep it small: the seat clears
processed items into the archive at every tidy, and a terminal reply
that is not an order does not belong in `## Unprocessed` at all.


## HOUSEKEEPING FOR THE SEAT (not an order — the hook never reads this far)

> **EVERY ORDER LIVES UNDER THIS HEADING. Sub-headings inside it MUST be `###`,
> never `##`.** `scripts/seat-inbox-hook.sh` bounds its scan at the next `## `
> (`awk '/^## Unprocessed/{f=1;next} f&&/^## /{exit}'`), so an order written
> under its own `## ` heading is **INVISIBLE to the stop hook** — the terminal
> ends its turn and **Sam becomes the courier again.** The seat introduced
> exactly that on 2026-08-12 with `## THE MERGE'S LEFTOVERS`; it was masked only
> because items 1-8 above it kept the hook blocking. **This is sighting 5 of the
> class the hook's own comments document** — "the scan infers 'an order exists'
> from an artefact". **The hook is right; the writer was wrong.**
> **SYSTEMIC FIX OWED (not yet built): a guard cell that reds when a `## `
> heading between `## Unprocessed` and `## SAFE FOR A PARALLEL AGENT` contains
> order-shaped content.** Until then this note is the only thing holding it.