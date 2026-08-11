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

1. **THE MODERATE DAY — the other half of Sam's shape, held by nothing.** He
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

2. **THE FIXTURE WORK — sequenced in `HOW_TO_BUILD_THIS_APP` §5, items 1-4.**
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

3. **STRENGTH JOINS THE CAPACITY ARITHMETIC.** `HOW_TO_BUILD_THIS_APP` §3.
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

4. **BUILD LAYER 3 — THE ATHLETE'S WILL.** `HOW_TO_BUILD_THIS_APP` §2. **This is
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

5. **THE GATE — `LAW-computed-must-be-consumed`.** `HOW_TO_BUILD_THIS_APP` §4
   lists NINE values computed and read by nobody. **One `noUnusedWrites`-style
   gate over `contract.*` and exported rule outputs catches every one, and it
   subsumes the narrower `subject: 'doc' | 'behaviour'` proposal.** Sighting 6.

6. **ONE OWNER FOR OFF-FEET.** `conditioningFeasibility.ts:215` permits walking
   with no off-feet gate while `:207`/`:210` reject running and hills, and
   `:326-329` clears the flag for those two and forgets walking. Declare `onFeet`
   on the family table and derive both gates. Verification §2.2.

7. **A FLOOR AND A CEILING ON SESSION SIZE.** Enforce both at
   `sessionRowCounting.ts:253` — the site its own comment nominates. Emit
   `MIN EXERCISES PER SESSION` to the prompt.

8. **KEEP THE UNENFORCED LAW COUNT FALLING.** Measured 2026-08-12: **95 rows, 63
   guarded, 32 UNENFORCED.** Priority is the FOUR that can change what the
   athlete sees — `LAW-L6-honest-actions`, `LAW-attributed-content-change`,
   `LAW-L5-no-dead-affordances`, `LAW-L15-one-write-format`. Two rows read
   guarded and are held by grepping NOW.md for a word
   (`LAW-L4-device-is-arbiter`, `LAW-L10-phone-is-done`). **Build the subject
   check as item 5's gate, not as its own narrower one.**

Items 9-11 (retire dormant code to `src/retired/`, make onboarding addressable
then walk it, harvest ratchet + computed atlas) are shaped in the verification
doc §4 and wait behind the above.

## AWAITING SAM'S EYE (not terminal work)

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
