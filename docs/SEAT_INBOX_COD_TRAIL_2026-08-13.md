# THE COD TRAIL — items 28-C1b … 28-C1h, archived verbatim 2026-08-13

**Six build attempts, six reverts, and every wall was real.** Folded out of the
live inbox because the CONCLUSION is now one item and the trail is history.
**Do not read this file. Grep it** — and only if a claim in item 28-C1 is
challenged.

---

28-C1h. **THE COD PROBE RAN — ELIGIBILITY NEVER SEES `cod_decel` AT ALL, AND A
   **Full report archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 28-C1h).**


28-C1b. **ANSWERED 2026-08-13 — THE MEASUREMENT GATE IS PAID, THE PASS WAS BUILT,
   **Full report archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 28-C1b).**


28-C1c. **STOP CHASING COD. THE WALL YOU HIT IS CENSUS FINDING C5 — THE
    SPARE-ROOM MEASUREMENT WAS TAKEN ON AN ILLEGAL WEEK.**

    **⚠ CORRECTED 2026-08-13 BY THE TERMINAL — THE WEEK WAS LEGAL. THE "ZERO
    REST DAYS" NUMBER WAS MY INSTRUMENT FAULT, NOT THE APP'S.** I counted
    workouts whose `workoutType` is `'Rest'`, and there are none, because **REST
    IS REPRESENTED BY ABSENCE — a day with no session at all.** Counted properly
    the week covers days 1-6 and leaves day 0 empty: **ONE rest day, which is
    legal at Sam's floor of 1-2.** `a-count-taken-for-a-record`, second sighting
    this session.
    **SO THIS ITEM'S PREMISE IS WITHDRAWN: the measurement was not taken on an
    illegal week.** "There is no spare room" still stands, but for the plain
    reason that all six chosen training days carry work — not because a ruling
    was broken.
    **C5 IS FIXED ANYWAY (`afd07164`) AND WAS RIGHT ON ITS OWN MERITS**, exactly
    as this item predicted: all four `required: 0` rows now require 1 (including
    `early_offseason`, which the receipt did not name — same ruling, same
    defect), so a genuinely rest-free week can now be rejected. **Measured impact:
    NONE — nothing currently violates it.**
    **⚠ A FIFTH UNLISTED LINK, FOUND 2026-08-13 — THE LABEL. Do not place COD
    before fixing this.** `coachingEngine.ts:4804`'s `case 'COND'` maps category
    to the athlete-facing focus text and has branches for aerobic_base, tempo,
    vo2, glycolytic and sprint — **and NO `cod_decel` branch.** A placed COD
    session falls through to *"Conditioning - high intensity intervals (short,
    hard repeats with short rest)"*. **That is athlete-facing text describing the
    wrong session**, and it would ship the moment placement succeeds. Sam's
    signed-copy law applies: **the words are his, and this fallthrough invents
    them.**
    **THE CHAIN IS FIVE LINKS, NOT FOUR** — category, pool, gate, placement, and
    now the LABEL. Four are fixed or measured; the label is untouched.

    **THE STANDING RULE THIS ITEM ADDS IS UNAFFECTED and is the better half:**
    grep the census before treating any obstacle as a fact of the system.

    **OWNED BY THE TERMINAL. Read this before the next COD unit.**

    **THE MEASUREMENT:** *"A six-day off-season week produces six workouts and
    zero rest days. Every day already has work."* Correct as an observation —
    **and that week breaks a ruling of Sam's, so the number it produced cannot
    be used to decide anything.**

    **SAM'S RULING, verbatim (`LFA_PROGRAMMING_BIBLE.md:128`):** *"Full rest
    days: 1-2 stands everywhere except bye-recovery weeks and early off-season,
    where 3 full rest days are permitted."*
    **Read the exception carefully — it permits MORE rest, not less. There is no
    phase in which ZERO rest days is legal.**

    **THE CODE (census C5, receipted):** `weeklyExposureContractV2.ts:1005`
    (`mid_offseason`), `:1016` (`late_offseason`) and `:1030` (all three
    pre-season rows) carry `rest: { required: 0, preferred: { min: 2, max: 2 } }`.
    **The app knows the preferred answer is 2 and requires 0**, and `required` is
    the sole input to the blocking check
    (`section18EffectiveWeekEvaluator.ts:1484`), so with 0 that check is
    unreachable.

    **SO: "there is no room" is not a fact about the week. It is the symptom of
    an unenforced ruling.** A legal mid/late off-season week is FIVE training
    days and two rest days. **Re-measure spare room on a legal week before any
    further COD work.**

    **⚠ DO NOT OVERCLAIM THE FIX, AND DO NOT SKIP THE NEXT QUESTION.** Restoring
    the rest floor frees a DAY. It does not by itself create a STANDALONE
    conditioning slot, and the terminal's own next question — *why does a week
    with no team training never produce a standalone conditioning slot?* —
    remains the right one. **Both are needed. C5 first, because it is already
    ruled, already receipted, and correct on its own merits whatever COD does.**

    **THE PATTERN, NAMED BY THE TERMINAL ITSELF AND NOW A STANDING RULE.** Four
    attempts, four reverts, and its own verdict: *"three of the four went wrong
    the same way — changing code before measuring the layer above it."* **The
    compression is one question, asked before every build from now on:**

    > **IS THE WALL I JUST HIT ITSELF A CENSUS FINDING?**

    **Here it was, and nobody checked.** `docs/RULINGS_NOT_IN_THE_APP_2026-08-13.md`
    has twenty rows; the wall at layer four was row C5 the whole time. **Grep the
    census before treating any obstacle as a fact of the system.** Twenty
    known-broken rulings mean the odds are good that the thing blocking you is
    one of them.


28-C1d. **28-C1c WAS WRONG AND THE SEAT OWNS IT — the week was legal. AND THE
    THIRD MISCOUNT IN ONE SESSION HAS THE SAME SHAPE, SO IT IS NOW A RULE.**

    **RETRACTED:** 28-C1c told the terminal the six-day off-season week was
    ILLEGAL and that the COD wall was census finding C5. **That was false.** Rest
    is stored as an EMPTY DAY, not as a session named "Rest"
    (`section18EffectiveWeekEvaluator.ts:746` — `trueRestDays` is every day NOT
    in `requiredWorkDays`), so the week trains six days, leaves Sunday empty, and
    has ONE rest day. **Sam's floor is 1-2. One is legal.** The seat passed on an
    agent's number without checking what it counted — **the exact rule the seat
    is bound by, broken by the seat.** Recorded, not smoothed.

    **WHAT STILL STANDS, and it is not a consolation prize:** `required: 0`
    meant the blocking check could never fire, so a genuinely rest-free week
    could never have been REJECTED whatever the generator happens to emit today.
    The floor is now `required: 1` on all four rows (`weeklyExposureContractV2.ts:
    1002,1021,1040,1062`) with nothing moved. **Correct on its own merits.**

    **WHAT IS BACK OPEN:** "no spare room" is true for the plain reason — all six
    chosen training days are used. **The COD wall is UNEXPLAINED, and the
    standalone-conditioning-slot question is again the only live one.**

    **⚠ THE THIRD MISCOUNT TONIGHT, AND ALL THREE HAVE ONE SHAPE:**
    1. Team-training rows "inside `workout.exercises`" — there were none; the
       count was of a thing that does not occur on that path.
    2. "Hard days" — the validator counts a strength day as hard, the QA
       expectations do not. Same word, two definitions, three different targets.
    3. Rest days — counted as sessions NAMED rest; rest is an ABSENCE.

    **THE STANDING RULE, effective now, for every agent and this seat:**

    > **BEFORE REPORTING A COUNT, STATE WHAT IS BEING COUNTED AND SHOW ONE
    > INSTANCE OF IT. A count of zero must show what a non-zero would have
    > looked like.**

    Every one of the three would have died at that step. **A zero is the most
    dangerous number in this repo** — it is equally produced by "the thing does
    not happen" and "I am not looking where it happens". **They are not the same
    finding and must never again be reported as if they were.**


28-C1e. **THE COD LABEL IS NOT A NEW RULING — SAM ALREADY NAMED IT. DO NOT ASK
   **Full report archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 28-C1e).**


28-C1g-RESULT. **THE ZERO WAS MY PROBE, CONFIRMED — AND COD-AS-A-THIRD-KIND WAS
    BUILT, MEASURED AND REVERTED (SIXTH). THE REFUSAL IS STANDALONE-SIDE.**
    **THE ZERO: my error, exactly as Sam said.** `countWeeklyExposures` takes
    `WeekDayInput[]` — `{ date, workout }` pairs — and I passed raw `Workout[]`,
    so every day looked empty and the count was 0. **The counter is fine.**
    **THE BUILD:** COD ranked FIRST on the STANDALONE path only, gated on no team
    training, once per week — the right shape, because the week's three
    conditioning pieces are 1 standalone + 2 attached, and the two attached
    cannot be COD (a hard category on a lower/hinge/full day is correctly
    refused). **The standalone piece is the only one COD can be.**
    **RESULT: still `COD=0 of 10 conditioning pieces`, with and without team
    training.** So being first on the standalone list is not enough either —
    **eligibility refuses COD in the STANDALONE context too**, and site #7 (the
    lower/hinge/full pairing rule) does not apply there, so it is a DIFFERENT
    site.
    **NEXT, AND IT IS ONE PROBE:** tag the nine `finisherEligibility` downgrade
    sites again but with `strengthContext === 'standalone'` in the log, and read
    which site fires. **The earlier tagging run showed all six refusals at site
    #7 — those were the ATTACHED path. Nobody has yet seen which site refuses a
    STANDALONE COD request.** That single line is the whole remaining unknown.
    **Patch parked at `scratchpad/cod-standalone-pass.patch`. Reverted for the
    same reason as the other five: it changes candidate order for every week and
    buys nothing while the count is zero.**


28-C1f. **THE CONDITIONING COUNT IS NOT A FRESH JOB AND NOT SAM'S DECISION —
    THE CONTRACT ALREADY REQUIRES 3. THE WEEK SHIPS 2.**

    **OWNED BY THE TERMINAL. Measured by the seat before handing it back, so the
    sixth attempt does not start with an exploratory pass.**

    **THE TERMINAL'S QUESTION** — *"what decides how many conditioning sessions a
    week gets? COD needs a third slot, or to take one of the two"* — **has an
    answer already in the contract, and it is not 2:**
    - **`mid_offseason`: `conditioning: { required: 3, defaultTarget: 3, preferred: { min: 3, max: 4 }, max: 5 }`** (`weeklyExposureContractV2.ts:1010`)
    - **`late_offseason`: `required: 3, defaultTarget: 4, preferred: { min: 4, max: 4 }`** (`:1029`)
    - Sam's own weekly floor agrees: **`conditioningExposures: { min: 3, max: 5 }`** (`weeklyExposureCounts.ts:45`).

    **SO THE THIRD SLOT COD NEEDS IS A SLOT THE CONTRACT ALREADY DEMANDS.** Do
    not put "should an off-season week have 3 conditioning sessions?" to Sam.
    **He has answered it twice, in two places.** The live question is only WHY 2
    ships against a required 3.

    **TWO CANDIDATE MECHANISMS. MEASURE WHICH, DO NOT ASSUME — and note they are
    not exclusive.**
    1. **The under-finding is advisory** (census C4): `weeklyExposureCounts.ts:
       323-367` emits `kind: 'under'`, and `weekStructureValidator.ts:454-466`
       takes the `under` branch FIRST and hardcodes `severity: 'info'`,
       `canOverride: true`. Ceilings refuse; floors do not.
    2. **⚠ THE REQUIREMENT REWRITES ITSELF TO MATCH THE OUTPUT.**
       `weeklyExposureContract.ts:759-760`, inside
       `reconcileWeeklyExposureContractToLedger`:
       `contract.conditioning.required = Math.min(required, actual);`
       **A week that delivers 2 sets required to 2, and is then short of
       nothing.** It is NOT silent — it writes an `addExposureReduction` with a
       reason first (`:745-752`) — **so the whole question is whether a legitimate
       reason authorised it, or whether it fires simply because the generator
       produced fewer.** **Read the reason on a real off-season week before
       judging this line.** If the reason is anything other than an authorised
       reduction, this is the defect, and it is a bigger one than COD.

    **CLEARED 2026-08-13 — AND THE TRAP WAS REAL. "THE WEEK SHIPS 2" WAS MY
    FOURTH MISCOUNT.** Measured on a five-day mid-off-season week, block 3:
    - **standalone SESSIONS = 1, combined PIECES = 2, TOTAL = 3.**
    - **The contract requires 3. The week DELIVERS 3.** There is no shortfall.
    **My "2" was a count of CATEGORIES (`aerobic_base`, `tempo`), not sessions.**
    Two categories spread across three pieces. **So this item's premise —
    "required 3, ships 2" — is comparing a session count with a category count,
    and it is withdrawn.**
    **MECHANISM 2 IS ANSWERED AND IS NOT FIRING.** The reconcile line
    (`contract.conditioning.required = Math.min(required, actual)`) was
    instrumented on that week: **it never fired for conditioning** — no reduction
    was written at all, because `actual >= from`. **The requirement is not
    rewriting itself here.**
    **SO COD'S "THIRD SLOT" ALREADY EXISTS.** The week has three conditioning
    pieces; what it does not have is a third CATEGORY. COD does not need a new
    slot — **it needs to be one of the categories those three pieces are drawn
    from**, and two of the three are attached to lifting days where a hard
    category is correctly refused.
    **⚠ ONE NUMBER I WILL NOT REPORT AS A FINDING:** my probe read
    `conditioningExposures = 0` from `countWeeklyExposures` on the same week.
    **That contradicts three visible pieces, so it is far more likely my call
    passed the wrong input shape than that the counter is broken.** Per the
    standing rule it is recorded as UNVERIFIED, not as a defect. **Verify the
    call before anyone builds on it.**

    ~~ORIGINAL~~ **THE UNIT TRAP, GIVEN THREE MISCOUNTS TONIGHT — CLEAR IT FIRST.** The
    contract says "conditioning sessions"; the validator counts
    `conditioningExposures`. **A conditioning piece attached to a lifting day may
    count as an exposure while not being a standalone SESSION.** Per the standing
    rule: **state what is being counted and show one instance before reporting
    either number.** If the two units differ, "required 3 vs delivered 2" may be
    comparing different things and this whole item needs restating.

    **⚠ SAM ASKED THE QUESTION THAT SHARPENS THIS, AND IT PARTLY DEFENDS THE
    LINE:** *"what if they said they can only train 2 days or something? or is
    that not a scenario we have created yet"*. **It IS a scenario, it is coded,
    and it has a TYPED REASON.** `WeeklyExposureReductionReason`
    (`weeklyExposureContract.ts:31-44`) opens with `'insufficient_availability'`,
    and `coachingEngine.ts:2800` branches on `inputs.availableDays <= 2`.
    **So lowering required-3 to actual is CORRECT for a 2-day athlete** — that is
    the mechanism working, not a defect, and 28-C1f's flag must not be read as
    condemning the line.

    **WHICH MAKES THE TEST EXACT, AND IT IS ONE RUN:** on a **five-day**
    off-season week with **no** availability limit, no injury, no deload and no
    equipment problem, **the contract requires 3 and the week ships 2 — so WHAT
    REASON IS ON THAT REDUCTION?**
    - **If it is `insufficient_availability` on a five-day week — THAT IS THE
      DEFECT**, and it is bigger than COD: every floor Sam has written is being
      excused by a constraint that is not present.
    - **If no reduction is recorded at all**, the requirement dropped without
      authorisation and the reduction ledger is not the owner it claims to be.
    - **If a genuine reason is recorded**, there is no defect here, COD's third
      slot is legitimately unavailable, and **COD must take one of the two
      existing slots instead — which is Sam's "cut first" read from the other
      side and needs no new ruling.**
    **Report the reason string verbatim. That one string decides which of three
    different jobs this is.**

    **AND CREDIT, BECAUSE THE DISCIPLINE IS WHAT PRODUCED THIS.** Five attempts,
    five reverts, and the terminal handed over a MEASURED LAYER instead of a
    sixth attempt. **That is the behaviour this queue wants.** Each revert also
    left something shipped and standing: the category, the selector branch, the
    gate, the rest floor, the signed label. **COD is one link from the athlete.**


28-C1g. **THE ZERO IS THE PROBE, NOT THE COUNTER — ANSWERED WITH EVIDENCE THE
    SEAT ALREADY HELD, SO NOBODY SPENDS A PASS ON IT.**

    **The terminal asked for this to be verified and was right to flag it as
    UNVERIFIED rather than announce a fifth miscount.** That restraint is the
    correct behaviour and is why this took one paragraph instead of an hour.

    **THE OPEN ITEM:** its probe read the validator's conditioning count as ZERO
    on a week with three visible conditioning sessions.

    **THE COUNTER IS FINE. RECEIPT, from the seat's own `npm run test:qa` run
    earlier this session** — the QA harness prints
    `counts.conditioningExposures` straight from `weeklyExposureCounts`
    (`weekShapeSummary.ts:283`), and across the 17 scenarios it returned:
    **S1 = 5, S2 = 5, S3 = 3, S4 = 3, S5 = 2, S6 = 1, S7 = 3, S8 = 4, S9 = 4,
    S10 = 5, S11 = 4, S12 = 4, E1 = 3, E2 = 5, E3 = 5, S13 = 5, S14 = 4.**
    **Seventeen weeks, seventeen non-zero counts, same function.** A counter
    that returns 0 on a week with three sessions is not the counter.

    **WHY, MECHANICALLY:** `countWeeklyExposures` walks `dayWorkouts(day)` and
    calls `classifyVisibleSession(w)` per workout
    (`weeklyExposureCounts.ts:241-250`). **It counts RESOLVED, VISIBLE sessions.**
    Feed it plan entries, unresolved days, or a day list whose workouts have not
    been composed yet and every contribution is zero — **correctly, because
    there are no visible sessions to classify.** **Check the INPUT the probe
    passed before touching the counter.**

    **AND THE FOURTH MISCOUNT CONFIRMS THE STANDING RULE RATHER THAN WEAKENING
    IT.** The terminal's "2" was a count of CATEGORIES compared against a
    contract expressed in SESSIONS. That is the same failure as team-training
    rows, hard days, and rest days: **two units, one word.** The rule stands and
    is now four-for-four: **state what is being counted and show one instance.**
    **Add the unit to the number itself — "3 sessions", "2 categories" — never a
    bare integer.** Every one of the four would have died at that step.

    **THE LIVE QUESTION IS UNCHANGED AND IS THE LAST ONE:** the week has three
    conditioning sessions and two kinds. **COD must become one of the kinds those
    sessions are drawn from.** Two of the three are attached to lifting days
    where hard work is correctly refused — **so the standalone slot is the only
    home, and there is exactly one.** State plainly whether COD can live there
    without displacing what is there now; if it cannot, that IS the "cut first"
    trade and Sam's ruling already decides it.


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

- **ANSWERED 2026-08-13, NOW PART OF ITEM 28 — away and the club.** Sam:
  ***"yes clear team training and games while away"***. **Do not re-ask.** Built
  the same day; see item 28 for what is WORKING and what is only BUILT.
- **ANSWERED 2026-08-13, NOW ITEM 21 — the team-night size question is
  CLOSED and its premise refused.** Sam: a team night's strength session is
  **a normal strength session**; the only difference is ORDER (prefer not to
  put lower body or sprint work before training, but allow it when that is
  the only room). **No team-night floor, in either direction. Do not
  re-ask.**
- The Wednesday game-day check (`06401d92`), the Renee UI pass, and the craft
  tier's hydration relocation are all **BUILT, awaiting device acceptance**.
  When he rebuilds, the white screen after a refused dev launch is expected and
  now names its own cause (`docs/WHITE_SCREEN_BOUNDARY_2026-08-10.md`).
- **NOT A DECISION, A BLOCKER, RECORDED SO IT IS NOT RE-ATTEMPTED:** item 9's
  four-answer collapse and item 3's remaining step both need files another agent
  is editing in this shared checkout (`section18CraftTier.ts`,
  `projectVisibleWeek.ts`, the generator under stand-down D). **Neither is
  skipped for want of a ruling; both are waiting for a clear file.**
- **ANSWERED 2026-08-12, NOW ITEM 16 — the day/week modifier indicator.**
  Sam: *"yes — one line on week, small card on day, read-only both"*. Moved
  out of this section into the queue. **Do not re-ask.**
- **ANSWERED 2026-08-13 — BUILT. Sam: *"add the popup"*.** `ModifiersSheet` now
  stands between the notice and My Status on both Program shapes, with his
  prototype's five strings signed verbatim. **Do not re-ask.** One follow-up
  question it raised is the entry directly below.
- **ANSWERED 2026-08-13, NOW ITEM 23 — the short phrase per modifier kind is
  SIGNED and the column question is closed with it.** Sam: *"i'd rather them
  shortened"*, then ***"signed"*** on the four phrases in item 23. **It was FOUR,
  not the three every doc said** — excluded and pinned are opposites sharing one
  builder. The rows become two columns for every kind that HAS a phrase; soreness
  and the generated programme-effect notes keep their own sentence on purpose and
  stay one column. **Do not re-ask.**
   ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 22).

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
