# SEAT INBOX — the review seat writes here; terminal reads at every stop

## Unprocessed (newest first)

**THE ATLAS IS VERIFIED. Read `docs/ATLAS_VERIFICATION_2026-08-12.md` before
taking any order below — it carries the receipts, the corrections, and the two
live defects the atlas does not contain. Entry point for a new agent is still
`docs/CODEX_HANDOFF_2026-08-11.md`.**

**Order 1 (turn on the craft validator) is DONE and cleared to the archive.
`docs/CRAFT_TIER_BOUNDARY_2026-08-12.md` is accepted. Item 1 below is its
unfinished half and is the direct continuation of the same question.**

1. **SAM RULED ON THE HARD-DAY COUNT, AND HIS WORDS MOVE THIS ORDER TO A
   DIFFERENT TARGET — SAYING SO OUT LOUD.**

   **SAM, 2026-08-12, asked whether the app should be stopped from choosing a
   5th hard day:** *"4 hard days plus 1 moderate/easy day is prefered but 5 hard
   days is okay"*.

   **WHAT THAT WITHDRAWS:** the seat had proposed making an app-selected 5th
   hard day BLOCKING. **It is not a defect and must not be blocked.** Five hard
   days stays permitted exactly as it is today
   (`section18EffectiveWeekEvaluator.ts:1518-1537` is CORRECT — blocking only
   above the scalar maximum, advisory at 5). The `5 hard days` `soft` finding on
   six of seventeen QA scenarios is **not evidence of bad programming** and no
   further work is owed on it. **Do not re-open this.**

   **WHAT HIS WORDS ACTUALLY EXPOSE — the other half of the shape, and NOTHING
   HOLDS IT.** He named a shape with two halves: 4 hard **plus 1 moderate/easy**.
   The Bible states it once, `LFA_PROGRAMMING_BIBLE.md:4808`: *"Default weekly
   shape is 4 hard days plus 1 moderate day."*

   **Measured across all of `src/`: the moderate day has a COUNTER AND NOTHING
   ELSE.** `contract.restStress.achievedModerateDayCount` is written at
   `section18EffectiveWeekEvaluator.ts:1034` and has **ZERO readers**. There is
   no `preferredModerateDayRange`, no minimum, no finding code, no severity, no
   mention in the Section 17 kernel. Compare hard days, which have a preferred
   range, a permitted maximum, a blocking finding and an advisory one. **One
   half of Sam's default weekly shape is fully governed; the other half is
   counted and discarded.** A week of 4 hard days and no moderate day at all is
   accepted today with no comment from anything.

   **FIX — a preferred range, not a gate.** Give moderate days the same treatment
   hard days already have: a `preferredModerateDayRange` on the contract, and an
   **advisory** `default_target_miss` in the `hard_days`/rest-stress domain when
   a week carries none. **Advisory, not blocking** — it is a default shape, not a
   law (`:4810`: *"the preferred/default shape, not a universal blocking
   maximum"*), and it must never refuse an athlete's week. Then make it a
   generation TARGET so the app builds toward 4+1 by default.

   **MEASURE FIRST:** print `achievedModerateDayCount` for all 17 `test:qa`
   scenarios. **If most weeks have zero moderate days, that is the shape defect
   located in a number** — and it is a far better candidate for *"the programming
   is pretty shit"* than the hard-day count Sam has now cleared.

   **LOOP CHECK `enforcement-deferred-then-forgotten` — SIGHTING 5, NEW ORGAN,
   NOW WITH TWO INSTANCES.** Sightings 1-4 were rules wired to a **logger**.
   These two are wired to **write-only report fields**:
   `achievedModerateDayCount` (`:1034`) and `unavoidableAnchorCausedExcess`
   (`:1047`), both computed on every single assessment, both read by nothing.
   **A `noUnusedWrites`-style gate over `contract.*` assignments would have
   caught BOTH on the day they were written, and it is one gate.** Build that
   before or with item 5.

2. **ONE OWNER FOR THE GAME DAY — THERE IS A LIVE DEFECT, AND IT IS THE ONLY
   THING ON THIS LIST AN ATHLETE CAN SEE TODAY.** `quiescentBoot.ts:337`
   derives the recurring game day from `profile.gameDay` alone and skips
   `'Varies'`, so a Wednesday game day is lost on relaunch. No test covers it.
   Fix that line first, then make `resolveEffectiveGameDay` the sole reader and
   gate the ~25 direct readers. **Eight representations of one fact — this is
   the defect class, not an instance of it.** Verification §2.1.
   **If Sam wants a visible fix before a correctness one, this outranks item 1.**

3. **ONE OWNER FOR OFF-FEET.** `conditioningFeasibility.ts:215` permits walking
   with no off-feet gate while `:207`/`:210` reject running and hills, and
   `:326-329` clears the flag for those two and forgets walking — so the
   session keeps `conditioningOffFeet: true` while its rows read "Brisk
   Walking". Declare `onFeet` on the family table and derive both gates.
   Verification §2.2.

4. **A FLOOR AND A CEILING ON SESSION SIZE.** Enforce both at
   `sessionRowCounting.ts:253` — the site its own comment nominates — so the AI
   path, the eleven 3-row fallback branches and every future branch are caught
   by one predicate. Emit `MIN EXERCISES PER SESSION` to the prompt.

5. **KEEP THE UNENFORCED LAW COUNT FALLING.** Measured 2026-08-12: **95 rows,
   63 guarded, 32 UNENFORCED.** **Priority is the FOUR that can change what the
   athlete sees** — `LAW-L6-honest-actions`, `LAW-attributed-content-change`,
   `LAW-L5-no-dead-affordances`, `LAW-L15-one-write-format` — not the 24
   process laws. Two rows READ guarded and are held by grepping NOW.md for a
   word (`LAW-L4-device-is-arbiter`, `LAW-L10-phone-is-done`); they need a real
   subject or a `subject: 'behaviour'` red.

   **THIS ORDER WIDENS VERIFICATION ITEM 7 — SAYING SO OUT LOUD.** That item
   reads *"add `subject: 'doc' | 'behaviour'` to every row and red when a
   behaviour law is held by a markdown grep"*. **Item 1 above proves that test
   is too narrow**: `unavoidableAnchorCausedExcess` is held by neither a
   markdown grep nor a logger — it is held by a field with no readers, and the
   test as written passes it. **Build the check as: a behaviour law whose only
   consumer is a markdown grep, a logger, OR a value nothing reads.**

Items 6-8 (retire dormant code to `src/retired/`, make onboarding addressable
then walk it, harvest ratchet + computed atlas) are shaped in the verification
doc §4 and are NOT ordered yet — they wait behind 1-4.

## AWAITING SAM'S EYE (not terminal work)

- **Hydration can now MOVE a session in a week already on his phone.** A stored
  week whose hard lower sits on G-2 is swapped at next launch, disclosed as
  `craft_violation_relocated`, not attributed to the athlete. **One line to
  change if a week must stay exactly as he last saw it.**
  `docs/CRAFT_TIER_BOUNDARY_2026-08-12.md` §6.

  **SAM ASKED 2026-08-12: "when would this happen?" The answer, from the code —
  keep it, a future seat will be asked again.** The tier only ever touches dates
  in `governableDates`, which the gateway alone derives from `governedFromISO`
  (`section18CraftTier.ts:93-105`), so **a day the athlete has already trained
  can never move**, and anchors are never a source or a target. It fires when a
  STORED week newly breaks a `strong` Section 17 rule — `g1_not_light`,
  `g2_hard_lower`, `g2_hard_conditioning`, `g2_sprint_cod`, `g_plus1_hard_work`,
  `tt_marked_recovery`, `double_hinge_plus_sprint`, `double_cod_plus_heavy_lower`,
  `cap_maxMainStrengthSessions_over`, `cap_maxRunningExposures_over`. **Four real
  triggers, in likelihood order:** (a) **first launch after this ships** — every
  stored week predates the check; (b) **the fixture moves** — the sessions did
  not change, the game did, and a safe Tuesday becomes G-2; (c) **team training
  is added or changes night**; (d) rarely after that, since a repaired week stays
  repaired.

  **UNMEASURED AND IT IS THE NUMBER THAT WOULD MAKE HIS DECISION INFORMED:** how
  often (a) and (b) actually fire. `test:qa` measured ZERO `strong` findings on
  freshly GENERATED weeks — that says nothing about stored or fixture-shifted
  ones. **Cheap measurement: replay the QA weeks through hydration with the game
  day shifted one day and count relocations.** Do this before treating "it will
  hardly ever happen" as true.
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
