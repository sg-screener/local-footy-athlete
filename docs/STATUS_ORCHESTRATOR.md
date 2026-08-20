# STATUS — seat `orchestrator`

Opened 2026-08-19 from `20cb1422`. One writer: `orchestrator`. Name checked free
against `ls docs/STATUS_*.md` before the first commit.

## Mission

Take over integration of the four `codex/finish-*` lanes. Trust no lane's own
completion claim. Independently inspect state, fix or reject candidates, and
prove the two UI contracts on glass before declaring the UI corrected.

## FINDING O-1 — THE DAY-SCREEN DEFECT IS ON `main`, NOT IN ANY CANDIDATE

**No lane reported this.** QA routed the Day/Session contract as future work for
the *product* candidate ("the next tip must prove the two action sets
separately"). It is not future work: `main` @ `20cb1422` already ships the wrong
Day screen, and all three candidates branch from it, so all three inherit it.

Measured at `src/screens/home/HomeScreenV2.tsx` on `20cb1422`:

- lines ~988-1010 — `<SessionChangeHub testID="home-change-card">` renders the
  FIVE session actions (Equipment · Injury · Add · Remove · Swap) inside the
  original "Need to make a change?" card;
- lines ~1020-1055 — a SEPARATE, card-less `View testID="home-life-fact-chips"`
  holds only Tired and Sick;
- the `Injured` `LifeFactChip` (red `#FF7F7F` medical cross,
  `home-injured-entry`) is GONE from the Day screen. Injury is now the hub's
  amber-adjacent warning-triangle glyph.

The authority `1a7e7bd0:src/screens/home/HomeScreenV2.tsx` lines 858-935 has
exactly the contracted shape: one `Card testID="home-change-card"` with
signedCopy heading + subline, containing three chips —

| chip | testID | stroke | glyph |
|---|---|---|---|
| Tired | `home-tired-entry` | `#67D7FF` cyan | battery `M3 8h15v8H3z` + terminal |
| Sick | readiness set/update id | `#FFCA68` amber | thermometer `M10 5a2 2 0 0 1 4 0v8.2a4 4 0 1 1-4 0Z` |
| Injured | `home-injured-entry` | `#FF7F7F` red | cross `M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z` |

**So the corrective work is a change to `main` itself.** Product `fe6ed715` is
Coach work and does not touch either screen; holding it does not fix this.

## FINDING O-2 — THE HUB HARD-CODES ITS ACTION LIST

`SESSION_CHANGE_ACTION_IDS` in `src/components/SessionChangeHub.tsx` is frozen
at the five session actions, with per-id tints and glyphs in closed `Record`s
and a non-exhaustive-safe `switch`. Sam's contract permits a shared visual
component but forbids a hard-coded action list. The component must carry
`tired`/`sick`/`injured` identities too, and neither surface may reach for a
list it did not pass in.

## Candidate verdicts (independent)

| lane | tip | my verdict | basis |
|---|---|---|---|
| journey | `74c593aa` | MERGE-ELIGIBLE, guards only | `git diff --name-only main...` = 1 doc + 2 test files. Zero production bytes. Ruling conflict raised to Sam, not decided here. |
| programming | `12fac3f1` | HOLD | QA's 84 duplicate identities / 36 bodyweight bench cues / red travel worlds, to be independently reproduced before any ruling. |
| product | `fe6ed715` | HOLD | unreviewed by QA; does not address O-1. |
| qa | `5f94d6e7` | evidence only | consumed as input; its artifacts are not a merge candidate for product code. |

## Log

- 2026-08-19 — seat opened; O-1 and O-2 recorded before any write.

## FINDING O-3 — UNDO IS UNREACHABLE FOR A SESSION-SCREEN REMOVAL

`UndoToast` mounts on the Program screen and nowhere else, by the 2026-08-09
ruling (*"This mounts once, on the Program screen"*). A removal driven from the
pushed session screen therefore raises its toast on the screen BEHIND it, where
its six-second life expires unseen.

The Day-screen Remove chip had been hiding this: it was added on 2026-08-19 with
the explicit reasoning *"UndoToast mounts here, so a removal driven from here
finishes where the toast appears"*. Sam's contract removes that chip, so the gap
is now live for every one of the five session changes, not just Remove.

**NOT FIXED HERE, DELIBERATELY.** A second `<UndoToast />` mount would breach the
one-mount ruling and put two nodes under one `undo-toast` testID. The fix is
either a ruling change (the toast may mount per-surface) or a navigation change
(a session-screen change returns to Program). Both are Sam's, not mine.

Undo's own behaviour stays covered headlessly by `test:undo-reversal`. The Undo
half of `.maestro/visible/remove-hub-labelled.yaml` was removed with this reason
written into the flow, not silently dropped.

## FINDING O-4 — THE APP COULD NOT LAUNCH ON ANY SIMULATOR FROM THIS TIP

`Cannot find native module 'ExpoPushTokenManager'`, thrown from
`journalReminderService.ts:33` through `AppNavigator` before any screen mounts.

`expo-notifications` has been a package.json dependency since `8b12fcdd`
(2026-08-09) and `ios/Podfile.lock` carries `EXNotifications 0.32.17`, but **no
installed simulator binary contained it** — checked across every simulator on
this machine, including the four installed today. The newest DerivedData build
was 2026-08-12 and its `Frameworks` held three entries with no notifications
module.

So every simulator pass on `main` died at boot. Fixed by `pod install` (needs
`LANG=en_US.UTF-8`; CocoaPods 1.16.2 on Ruby 4.0.1 raises
`Encoding::CompatibilityError` otherwise) then `npx expo run:ios`. **No tracked
file changed** — `ios/Podfile.lock` and the xcodeproj are byte-identical after.

⚠ This is why QA's release manifest marks all four simulator cases NOT RUN and
why their isolated clone "exited during seeding without a crash receipt". It was
not an instrument-isolation problem; the binary was stale.

## FINDING O-5 — SHEET ROWS ANNOUNCE THEIR TEST ID INSTEAD OF THEIR WORD

`ExerciseSheetOption` sets `accessibilityLabel={testID ?? label}` on a
`accessibilityRole="button"` Pressable, which makes the row ONE accessibility
leaf. The athlete's word is not in the accessibility tree at all: a screen-reader
user hears `component-delete-action-dev-e2e-standard-in-season-week-2026-07-13-
dow-1-…-ex-squat-1` where the screen plainly reads "Back Squat".

Measured against the live hierarchy: `assertVisible: "Back Squat"` fails on a
screen whose debug screenshot shows "Back Squat" in 34pt type.

Six call sites share the pattern — `DayWorkoutScreenV2`, `PlanChangeSheet`,
`GuidedInjuryFlowSheet`, `HomeScreenV2`, `EquipmentLimitationSheet`,
`StoredStateExportButton`. It is its own unit, not a line in a Maestro flow.

## PROGRAMMING CANDIDATE `12fac3f1` — MEASURED AT BOTH ENDS

QA's own matrix script (`scripts/run-programming-release-matrix.ts` from
`codex/finish-qa`) run by me in two detached worktrees, unchanged:

| | `20cb1422` base | `12fac3f1` candidate |
|---|---:|---:|
| built / refused | 140 / 40 | **180 / 0** |
| findings | **44** | **3** |
| duplicate workout occurrences | 50 | 84 |
| cue-conflict occurrences | 16 | 36 |

**QA'S THREE BLOCKERS ARE ALL PRESENT AT BASE TOO, AND THE CANDIDATE CLEARS 41
FINDINGS THAT ARE NOT.** The 41 are the Off-season anchor class — a base
Off-season week publishes `d2:Team Training, d4:Team Training, d6:Game` in 40
worlds, plus the four-week block control. That is a worse athlete-visible defect
than any of the three that remain.

The duplicate delta, counted exactly rather than in aggregate:

| collision | base | candidate | delta |
|---|---:|---:|---:|
| Outdoor Aerobic Run / Running Intervals `[strength_accessory+conditioning]` | 42 | 48 | +6 |
| Explosive Push-up `[main_strength+strength_accessory]` | 8 | 4 | −4 |
| Explosive Push-up `[power+main_strength]` | 0 | 12 | **+12 NEW** |
| Explosive Push-up `[power+strength_accessory]` | 0 | 20 | **+20 NEW** |

⚠ **THE 32 NEW ONES ARE THE CANDIDATE'S OWN, AND EVERY SINGLE ONE IS A
`Bodyweight Only` WORLD.** Not one occurs in Full Gym or Dumbbells. The
signature is a small legal pool: the candidate's power materialisation picks an
exercise the same day's strength block already holds, and in a zero-equipment
world `Explosive Push-up` is one of very few legal power options. The +6 running
collisions are the pre-existing class reaching six worlds that previously
refused to build at all.

The cue conflicts (16 -> 36) are the same: one content defect
(`Copenhagen Plank (Half)` cues a bench under an empty equipment declaration)
exposed in more worlds because more worlds now build. **The candidate does not
create it.**

The travel partial-trip finding is byte-identical at base and candidate.

**VERDICT: HOLD, WITH ONE NAMED BLOCKER** — the 32 power/strength collisions.
The rest of the candidate is a large net improvement and the other two findings
are `main`'s, not its.

## THE PROGRAMMING BLOCKER, DIAGNOSED TO ITS ROOT AND PARTLY FIXED

Branch `orchestrator/power-primer-yields` @ `a1f91e27`, off `12fac3f1`.
**NOT PROPOSED FOR MERGE** — see the open question below.

`materialiseComposedWeek` drops the power primer when its identity is already
in the day's strength rows, compared with the composer's own
`composedIdentityFor` so it cannot disagree with the census that found the
defect. Re-measured with QA's matrix: **84 -> 52 duplicate occurrences, still
180/180 built, 0 refused, findings unchanged at 3.**

The 52 that remain are 48 running `[strength_accessory+conditioning]` and 4
push-up `[main_strength+strength_accessory]`. **All 52 are `main`'s class**; base
carries 50 of them over 140 built worlds (0.357 per world) against 52 over 180
(0.289). A general row-deduplication pass belongs to the composer and is not
this line's job.

### THE ROOT IS A ONE-MEMBER POOL, NOT THE CANDIDATE

`Explosive Push-up` is the **only** `upper` entry in `POWER_EXERCISE_POOL`. In a
`Bodyweight Only` world it is also a legal main/accessory push, so the power
pool and the strength pool intersect in exactly one exercise and both reach for
it. Full Gym and Dumbbells worlds produced **zero** collisions. The candidate's
`01fa17eb` did not create the overlap; it made the overlap visible by letting a
power row reach an athlete for the first time.

### THE COST, STATED

`generatedPowerDeliveryTests` **7/7 -> 5/7**, both failures in one Bodyweight
world whose strength block is `Explosive Push-up, Scap Push-Up`:
"the composer delivers the complete selected allowance" `{budget:2,rows:1}`, and
the club-night visibility cell.

⚠ **I DID NOT EDIT THOSE CELLS.** In that world the allowance is deliverable
only by printing one exercise twice. The guard and the fix are two answers to a
product question; editing the guard to match my change is the
expectation-edited-to-match-the-regression shape.

### THE OPEN QUESTION — SAM'S

REGISTRY-GREP: **R-076, R-081, R-015.** None rules on power/strength identity
collision or on the size of the upper power pool. R-081 settles how a contrast
partner is chosen (by family, *"similar is right"*); it does not say what happens
when the partner and the lift are the same movement.

Zero-equipment world, the only explosive upper movement is already the athlete's
strength lift that day:

- **(a)** no power primer that day — `a1f91e27`;
- **(b)** the movement appears twice — the candidate today;
- **(c)** the pool gains more upper entries so a non-colliding option exists.

**(c) is almost certainly right and is a content ruling on Sam's own
`docs/POWER_EXERCISE_POOL_SPEC_2026-07-23.md`.** A pool with one member for a
whole family is the actual defect. (a) is the floor that stops the athlete
seeing a contradiction while (c) is decided.

## PROGRAMMING VERDICT — HOLD, ONE BLOCKER, DOWN FROM THREE

| finding | candidate's own? | status |
|---|---|---|
| 32 power/strength duplicate sessions | **YES** | fixed on `orchestrator/power-primer-yields`, blocked on the ruling above |
| 48 running-row duplicates | no — 42 at base | `main`'s, composer-owned |
| 36 `Copenhagen Plank (Half)` bench-cue contradictions | no — 16 at base | `main`'s, content ruling |
| travel partial trip leaves in-span anchors | no — identical at base | `main`'s |

**Against that it clears 41 findings**, all Off-season anchor worlds publishing
`Team Training` and `Game` in a phase that has neither. That is a worse
athlete-visible defect than anything it leaves behind.

## PRODUCT CANDIDATE `fe6ed715` — MEASURED, NOT MERGED

QA never reviewed it. I ran the **73 suites in its blast radius** (`test:coach*`,
`injury*`, `block-two*`, `extra*`, `accessibility*`, `pending*`, `signed-copy*`,
`copy-rulings*`, `visible*`, `dead*`) at **three** points, because two would have
conflated its effect with mine:

| tree | red of 73 |
|---|---:|
| `20cb1422` | 31 |
| current `main` (my UI correction) | 30 |
| current `main` + product | **26** |

### A. MY OWN EFFECT ON THOSE 73 — ONE SUITE, AND IT WENT GREEN

`test:copy-rulings-binding` **8/1 -> 9/0**. Unplanned: the hub reading
`day.change_card.heading` / `.subline` from the signed sheet again gave those two
rows their readers back. They had **zero** readers on `20cb1422`, because the
literals had been inlined into the component.

Nothing else in the 73 moved. The UI correction's blast radius on this surface
is one suite, in the right direction.

### B. PRODUCT'S EFFECT — FIVE GREEN, ONE RED

| suite | main | + product |
|---|---|---|
| `test:coach-accepted-injury` | throws | **37/0** |
| `test:coach-intent` | red | **37/0** |
| `test:coach-live-wiring` | red | **17/0** |
| `test:coach-tab-slice4` | absent | **28/0 + 9/0** |
| `test:pending-injury-priority` | throws | **12/0** |
| `test:coach-tab-slice1` | **79/79** | **78/79** ⚠ |

⚠ **CORRECTION TO MY OWN FIRST READING.** `test:coach-tab-slice3` appeared to
collapse 151/151 -> 9/0, which is the suite-died-at-import shape this repo has a
law about. **It had not.** The candidate chains `slice3 && slice4`, and
`coachTrackingContextTests` in turn `require`s `extraSessionOfferPreviewTests`,
so my reader took the LAST totals line. Verified directly: slice3 still runs
151/151, and the chain adds 28/0 + 9/0. **A totals line is output; read the pass
count, and read all of them.**

### THE ONE RED, AND IT IS FIXED ON A BRANCH

`orchestrator/coach-sentence-provenance` @ `f14b3aeb`, off the merged candidate.

The cell enumerated three rule functions plus the literal `proposal.text`. The
candidate added `say(injuryTurn.text)` where
`injuryTurn = readAcceptedInjuryChatTurn({...})` — the same shape
`proposal.text` already was. **The law was never broken; the list was short.**
The gate now states the law (a coach sentence is a rule's return value, and a
`.text` off a local is verified by reading the local's assignment and the import
list) and is strictly stronger than the list it replaces — the old cell would
have passed a hand-written object assigned to a local named `proposal`.
Mutation-proven three ways; **80/80**.

⚠ **THE LANE SHIPPED WITH ONE OF ITS OWN GOVERNING GATES RED AND ITS STATUS
DOCUMENT DOES NOT LIST `test:coach-tab-slice1`.**

### PRODUCT VERDICT — HOLD, PENDING REVIEW, NOT PENDING A RED

Its measured position is good: five suites recovered, one regression, and that
regression closed on a branch. It also implements the exact handoff the Journey
lane routed to it — `extraSessionOfferPreview` previews the combined day the
"Add one session" card creates.

**But 31 files have had no independent review, by QA or by me**, and it does not
touch either screen in Sam's UI contract (`HomeScreenV2`, `DayWorkoutScreenV2`
and `SessionChangeHub` are untouched), so correcting the UI neither cleared nor
blocked it. Merging it now would be merging on a lane's own word, which is the
one thing this seat was told not to do.

## SUMMARY — WHERE THE FOUR CANDIDATES STAND

| lane | tip | verdict | why |
|---|---|---|---|
| **journey** | `74c593aa` | **MERGED** `3ddc4c16` | zero production bytes; 64/0 on this tip; the ladder conflict it was held for is identical with and without it |
| **product** | `fe6ed715` | HOLD — review, not red | 5 suites recovered, 1 regression closed on `orchestrator/coach-sentence-provenance`; 31 files unreviewed |
| **programming** | `12fac3f1` | HOLD — one ruling | clears 41 findings; its own 32 duplicates fixed on `orchestrator/power-primer-yields`; blocked on the power-pool question |
| **qa** | `5f94d6e7` | evidence, not a candidate | its matrix instrument was used here and reproduced exactly |

**AND THE UI CONTRACT ITSELF WAS NONE OF THEM.** It was on `main`, it is fixed
on `main`, and it is proven on glass.

---

# 2026-08-20 — SAM'S THREE RULINGS, AND WHAT EACH ONE COST

All three are in `docs/RULINGS_REGISTRY.md` as **R-118** (renumbered from
`R-105` by seat `finish-integration` on 2026-08-20, on Sam's ruling, because the
unbuilt weekly-reduction row already held that id), **R-106**, **R-107**,
added in the same commits that record them.

## R-107 — UNDO FOLLOWS THE ACTION · `4dc5339a` · MERGED

Mounted on the session screen; the "at most one visible" guard lives inside
`UndoToast` (focus check + an unfocused mount that keeps its seen-marker
CURRENT, not merely quiet — silence alone replays the session's toast when the
athlete returns to Day). `test:undo-reversal` **19 -> 24**, mutation-proven
three ways.

**ON GLASS:** `artifacts/visible/hub-6-undo-inside-the-session.png` — "You
removed an exercise · Undo" over the session screen, Back Squat gone.

⚠ **ONE HALF IS NOT PROVEN ON GLASS AND IS NAMED, NOT DROPPED.** Three runs
proved the toast APPEARS; all three failed to TAP it. The toast lives 6s
(`VISIBLE_MS`) and each Maestro hierarchy fetch here costs ~1.5s — trimmed to
one wait, one screenshot, one tap, it still did not fit. **The control was never
missing; the walk is slower than the affordance's life.** Reversal stays proven
headlessly (`test:undo-reversal` case 19, which reaches the EXCLUSION and not
just the ledger). Lengthening the toast for E2E would be changing the product to
suit the instrument.

## R-106 — A COMBINED DAY IS ONE DAY, TWO COMPONENTS · `4dc5339a` · MERGED

**This is what the Journey candidate was held for, and it is now closed.**
`test:block-two-ladder` **49/3 -> 59/0**. The three obsolete cells are rewritten
to the ruling; the protection they were built for MOVED to the coordinate where
it still applies (a combined day with no conditioning answer is still ambiguous
and still discarded — the original M3 mutant still dies there).

Mutation-proven three ways, including the leak direction: copying the
conditioning answer onto the strength quality reds the discriminating cell.

## R-118 (was R-105) — THE PRIMER YIELDS, AND THE POOL MUST GROW · HALF BUILT

**The half Sam ordered as the interim IS built** —
`orchestrator/power-primer-yields` (`a1f91e27` skip, `276b3e39` guard rewrite).
84 -> 52 duplicate occurrences, 180/180 still built, `generatedPowerDelivery`
**14/14** with the original claims moved to a Full Gym world where a shortfall
would be a real defect.

⚠ **THE HALF THAT MATTERS MOST — MORE POOL ENTRIES — NEEDS SAM, AND THE
PRECEDENT IS EXACT.** A new selectable exercise name must carry a curated cue
AND a demo video URL: `test:authored-cues` reads
`docs/VIDEO_CHANGESET_2026-07-24.md` and fails a pool exercise with no demo.
That file records the identical situation: *"Reopened 2026-07-27 when the
power-pool wiring turned `Vertical Jump` and `Explosive Push-up` into pool
exercises with no demo. **Sam supplied both URLs.**"*

**I will not invent a demo video URL.** A fabricated link is shown to an
athlete. For each new movement Sam supplies: the name, one primary cue, one
secondary cue, and a demo URL. The wiring (pool entry, cues, tags, equipment
requirement, vocabulary) is mechanical once those exist.

⚠ **A REAL DEFECT SURFACED WHILE WRITING THAT GUARD, AND IT IS NOT R-118'S.**
The first cut asked "does any session name one exercise twice?" and reddened on
a day reading `["Explosive Push-up", "Explosive Push-up"]` **with no power row
on it** — two STRENGTH rows, one identity. That is the composer placing one
movement in two slots: 52 occurrences corpus-wide (48 running-row, 4
main/accessory), older and wider than R-118. The guard is narrowed to power and
carries a DISCLOSURE cell so its green cannot be read as "no duplicates
anywhere". **Composer-owned, unfixed, measured.**

## PRODUCT `fe6ed715` — **REJECTED FOR MERGE.** THE REVIEW SAM ORDERED FOUND FIVE

Reviewed on the merged tree (main + candidate), against the real generator and
the real functions, not against the lane's account.

### ⚠ P0 — "CALL EMERGENCY SERVICES" NOW REACHES GLASS, FIRES ON DOMS, UNSIGNED

`coachAcceptedInjuryTurn.ts:37` calls `detectRedFlagSymptoms(args.message)`
**first and unconditionally**, before any injury-context test, on every message
typed into the routed Coach tab. Its replies are unsigned string constants
(`injuryClarificationGuard.ts:29-33`).

**Its only previously reachable caller was `CoachScreen`, which `AppNavigator`
defines and never renders. This candidate is the first path that puts that text
in front of an athlete.**

**REPRODUCED BY ME, with the real `readAcceptedInjuryChatTurn` and an EMPTY
episode list — so it hits every athlete, injured or not:**

| typed | route |
|---|---|
| "I cannot walk after leg day" | `red_flag_hard_stop` → *"Stop training now and do not run or lift through this…needs a physio or medical assessment"* |
| "The tempo run left me breathless" | `red_flag_hard_stop` → *"…call emergency services if symptoms are severe"* |
| "My hands went numb on the bar" | `red_flag_hard_stop` |
| "I was a bit dizzy after the sprints" | `red_flag_hard_stop` |

Ordinary post-leg-day soreness is answered with a medical hard stop. **This is
the highest-stakes copy in the app and it is not in the signed sheet.**

### ⚠ P0 — ORDINARY MESSAGES OPEN AN INJURY MODAL AND GET NO REPLY

`FOLLOWUP` (`:25`) matches the bare words `still`, `same`, `gone`, `pain`,
`sore`, `tight`. It runs before `readCoachMessage`, so for any athlete with one
active accepted episode it captures the turn — and the `open_existing_update`
branch (`CoachTabScreen.tsx:305-317`) calls `coachNoteActions.onAction(...)` and
returns **without calling `say()`**.

"Can I still do Friday?" → the athlete's message appears, **the coach says
nothing**, and the guided injury sheet opens.

### P1 — THE EXTRA-SESSION PREVIEW PROMISES A DAY GENERATION DOES NOT BUILD

`extraSessionOfferPreview.ts:41-51` reads the **current** program and tells the
athlete the day becomes "Strength + Conditioning". Nothing checks the
regenerated week agrees. Swept over 36 generated worlds: of 20 previews shown,
**9 matched the rebuilt week and 11 did not.** In-season, 2 gym days: preview
says "Saturday: Strength + Conditioning"; after accepting, Saturday is strength
alone and the conditioning moved to Monday.

⚠ **This is the exact second authority `extraSessionOffer.ts`'s own header
exists to prevent** — the athlete finding out by accepting. The legality probe
already builds the `n+1` program and throws it away; the preview should be
derived from that call.

### P1 — ONE INJURY REPORTED AS TWO PROBLEMS

`coachTrackingContext.ts:151-152`: `activeInjuryCount` and
`activeNiggleRegionCount` are computed from **the same `accepted.injuryEpisodes`
array** with byte-identical predicates. One hamstring episode prints *"I have 1
active injury on file. I have 1 active niggle region on file."*

### UNCONFIRMED — two context fields reported as having no reader

`coachIntent.ts:302-303` (`safeFocus`, `advice`). **I could not confirm this and
I am not asserting it:** both names are used widely elsewhere in the app (138
and 213 hits), so a name-based census cannot separate these two fields from
their namesakes. It needs a type-aware check. Recorded as reported, not as
found.

### NOTED, NOT SCORED

~330 lines of the diff — the dispatcher, deps, state-inspector and `CoachScreen`
clarifier rebuild — sit behind the unmounted `CoachScreen`. **The lane's own
status document says so plainly**, which is an honest `BUILT` claim rather than
an unsupported completion claim.

### VERDICT

Its measured position is good — 5 suites recovered, 1 regression, and that
regression closed on `orchestrator/coach-sentence-provenance`. **The reds were
never the problem.** Two P0s that only a read of the code could find are, and
one of them puts unsigned emergency-medical instruction in front of an athlete
who typed that their legs are sore.
