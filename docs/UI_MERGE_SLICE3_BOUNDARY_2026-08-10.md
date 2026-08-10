# UI MERGE SLICE 3 — "MY STATUS" — BOUNDARY REPORT, 2026-08-10

**LOOP CHECK: guessing at a selector instead of reading the tree — sighting 3 —
COMPRESS.** Three attempts to tap a row by its visible text failed in a row
before `maestro hierarchy` was run at all. The compression is a rule written into
the flow itself and reusable by every flow after it: **every action row in this
app carries its explorer coordinate as its `accessibilityLabel`, and an
accessibility label REPLACES the visible text for a UI runner — so text selectors
can never match. Use ids.**

**The unit: the coach page grows "my status", so ruling 4's strip has a
destination.**

**STATUS: BUILT AND GREEN ON THE DEVICE, END TO END.**
`.maestro/golden/coach-my-status.yaml` — no strip on a clean week, the athlete
makes a modifier through the equipment door, the strip appears on the day screen,
the same component appears on the coach tab, it opens "my status" with the list,
and it closes back to the conversation. `artifacts/ui-walk/coach-my-status.png`.
**Not on Sam's phone.**

---

## NORTH STAR

**Toward, and the whole slice is one removal of a representation.**
`selectActiveCoachNotes` was already the single selector — what was missing was a
way to REACH it from anywhere but `useHomeScreen`, a 2000-line hook belonging to
one screen. `useActiveModifiers` is that reach. **No new stored state, no second
list, no second count**: the strip is handed `modifiers.length`, so the number and
the list it opens cannot disagree.

---

## WHAT WAS BUILT

| Artefact | What it is |
| --- | --- |
| `hooks/useActiveModifiers.ts` | The one derivation, reachable from any screen. Every input read from the store that owns it; the week passed IN, never re-derived. |
| `components/ModifiersStrip.tsx` | ONE component, THREE mounts — day, week, coach. The seat's words: *"same component as the day screen's, not a second one."* |
| `components/ActiveModifiersSection.tsx` | The coach-notes list, EXTRACTED from `HomeScreenV2` byte-for-byte. Every `testID` unchanged — a rename here is a silent rename of doors Sam has tapped. |
| `screens/coach/CoachStatusScreen.tsx` | "My status". Mounts the extracted list; owns its own close control. |
| `.maestro/golden/coach-my-status.yaml` | The only instrument that proves the doorway opens. |

**THE STRIP IS OUTSIDE THE CONVERSATION SCROLL, AND THAT IS THE ONE REAL DESIGN
DECISION.** `CoachTabScreen` pins to bottom on new content, so a status block
inside it is unreachable after three exchanges. **A door the athlete cannot find
is not a door.** One fixed row costs a strip and never scrolls away; the detail
lives on the screen it opens, which is her prototype's own shape.

---

## TWO DEFECTS THE DEVICE FOUND THAT NO CELL COULD

1. **The close control landed ON the status bar, over the battery.** It was an
   absolutely-positioned sibling in `CoachTabScreen` at `top: 14` — outside the
   safe area of the screen it closes. It now belongs to `CoachStatusScreen`,
   inside its own `SafeAreaView`, so it cannot drift again.
2. **The title rendered as a full-width "MY STATUS" that dwarfed the one card
   under it.** `h1` is the app's front-page size; a detail screen reached from a
   strip is not the front page. `h2`.

**Neither is visible to a source-reading cell.** Both came from looking at the
screenshot, which is the instrument Sam has been saying is the instrument.

---

## WHAT THE FLOW COST, AND WHY THAT IS WORTH RECORDING

Seven runs. **Every failure was true and none of them was the strip:**

- **Three on selectors.** Text can never match a row whose accessibility label is
  its explorer id. Now a rule in the flow's own header.
- **One on the container tap.** Tapping `home-life-fact-chips` "to bring it into
  view" hit whichever chip sat in the CENTRE and opened that sheet — the same
  shape that made the older golden flows tap past their own targets.
- **Two on the precondition.** The readiness door is FOUR steps, and **declining
  its lighter-day offer applies nothing at all**, so no modifier becomes active
  and the strip correctly rendered nothing. Even accepting, a fatigue fact alone
  produced no coach note in that world — the day screen's own section was empty
  beside the strip, which is the app agreeing with itself.
- **One on a rotten seed. `injury-case` CANNOT INSTALL** — *"Seed witness
  validation failed: injury-case:program:dev-e2e-injury-case:2026-07-13"*. **A
  world no flow can use.** This is the seed-rot family Sam warned about and it is
  a NEW named instance, not a known one.

---

## NOT COVERED

- **THE STATUS SCREEN'S ACTIONS ARE NOT WIRED. `onAction` is a no-op.** The
  buttons render — they are the extracted section's own — and they do nothing on
  this surface. **The file says so in as many words and a cell asserts that it
  says so**, because a surface whose buttons do nothing with nothing saying so is
  the dead-affordance law broken in a new place. Wiring them needs
  `handleCoachNoteAction` and its equipment-fact set lifted out of
  `useHomeScreen` into a shared owner — **that is slice 3b and it is the same
  extraction the season-phase control needs.**
- **NOTHING WAS REMOVED FROM THE DAY SCREEN.** The modifiers section and the
  phase-shift card both stay, and a cell asserts they stay. This is
  `LAW-removal-ships-with-its-replacement` HOLDING, not being worked around: the
  replacement cannot yet do their job. **So this slice closes ruling 4's
  DESTINATION, and closes neither ruling 4 nor ruling 6.** The seat's expectation
  that the coach view closes two rulings is not met by this pass, and that is
  said plainly rather than implied.
- **THE WEEK MOUNT IS UNPROVEN ON GLASS.** `surface="week"` renders from the same
  call site as `surface="day"` and no flow switches to the week shape with a
  modifier active. A cell proves one component; a flow proves one mount.
- **`injury-case` IS BROKEN AND NOT FIXED HERE.** Named above, untouched.
- **THE `useHomeScreen` COPY OF THE DERIVATION STILL EXISTS.** `useActiveModifiers`
  is used by the coach tab; `useHomeScreen` still calls `selectActiveCoachNotes`
  directly. **Two callers of one selector is fine; two assemblies of one snapshot
  is the thing to collapse**, and it is not collapsed yet.
- **`test:bible` WAS NOT RUN END TO END** — red on purpose, stops at the first
  failing suite. Eight suites run by name plus the flow.
- **THE WEEKLY VIEW (ruling 7) IS NOT STARTED.** It is the next slice.

---

# ADDENDUM — SLICE 5, THE WEEKLY VIEW (ruling 7), SAME PASS

**STATUS: THE STRUCTURAL HALF IS BUILT AND GREEN ON THE DEVICE.**
`.maestro/golden/standard-program-week.yaml` now asserts a row's count and opens
one in place. `artifacts/ui-walk/week-row-open.png`.

## THE CHANGE IS ONE DELETED CONDITION

`timeline={dayFirst && visibleDay ? …}` became `timeline={visibleDay ? …}`.
**That is the whole of the week's structural change**, and it is why the week
cannot come to disagree with the day card: it is the same `DayTimeline`, the same
`dayTimeline()` read, the same collapsible parts with their exercises and
prescriptions. A cell asserts there is exactly ONE `<DayTimeline` call site.

Sam's parked question — *"when you tap Thursday, does it open in place or take
you to a day screen?"* — **never needed to be asked.** Her signed prototype
expands in place, and the app already did; the rows simply had nothing worth
opening.

## THE COUNT

Each collapsed row carries the day's exercise total, summed from
`visibleDay.parts` — the same list the row opens onto, so the head and the
opened drop-downs are one fact. **It uses the sheet template the day card's
drop-downs already use**, so the two surfaces cannot phrase it differently, and
the singular form is the same one that earned its keep on the strip.

**ZERO RENDERS NOTHING.** A rest day already says Rest; a fixture says Game Day.
Confirmed on the device: SAT (Game Day) and SUN (Rest Day) carry no count line,
THU reads "3 exercises", FRI "6 exercises".

**REST AND GAME DAYS DO NOT EXPAND, AND NOTHING HAD TO SAY SO.** `DayTimeline`
returns null on zero entries. Her prototype's `noExpand` is a property this app
gets by construction rather than a flag it has to carry.

## NOT COVERED BY THE ADDENDUM

- **"Completed" IN PLACE OF THE COUNT ON PAST WEEKS IS NOT BUILT.** The seat's
  spec names it; this pass does the current week only.
- **THE TEAM-TRAINING BADGE ON THE WEEK ROW IS NOT ADDED.** The row already shows
  "Strength + Team Training" as its title, so the badge is duplication until
  someone rules otherwise — **not skipped, deferred with a reason.**
- **THE PREV/NEXT WEEK SETS ARE HELD**, as the seat instructed.
- **THE SELECTED ROW SHOWS NO COUNT LINE.** It renders the day CARD head — eyebrow,
  tier chip, wrapping title — and its counts live on the drop-downs inside it.
  The count line belongs to the six collapsed rows. A flow assertion on Monday
  failed for exactly this reason and the selector was the fix, not the feature.
- **NOTHING IS ON SAM'S PHONE.**

---

# ADDENDUM 2 — THE NOT-YET CONTROLS, AND THE INJURY SEED DIAGNOSED

## ORDER 1's HEDGE IS TAKEN, AND THE KNOT IS PRICED RATHER THAN FORCED

**The seat's own instruction: *"if the untangling runs long, make the dead
buttons visibly not-yet rather than leaving them looking ready."*** It runs long.

**THE PRICE, MEASURED BY READING IT.** `handleClearCoachNote` alone closes over
`handleProgramControlResult`, `clearCoachNoteAction`,
`registerSourceFactRenderObservation`, `temporarySourceFacts`, the pending
restoration/observation setters and two `Alert` paths; `handleCoachNoteAction` and
`handleUpdateCoachNoteStatus` sit on top of it, and the phase-shift machine is
fifteen more pieces of state driving a multi-step sheet. **This is a genuine
ownership extraction, not a move**, and the Coach Architecture Escalation Rule
says price it before forcing it.

**SO THE CONTROLS SAY WHAT THEY ARE.** On the status screen every action renders
**dimmed, `disabled`, and captioned** — *"Change this on your program screen for
now."* All three, because any one alone fails: dimming alone reads as "broken",
a caption alone leaves a live-looking button that lies, and disabling alone is
silent. **Proven on the device**, not just in source: the flow asserts
`coach-note-actions-not-yet`.

**The day screen still mounts the list LIVE and a cell asserts it does** — its
controls are the working ones and nothing has replaced them.

## ORDER 2 — `injury-case` IS DIAGNOSED, NOT FIXED

**MEASURED with `scripts/probe-injury-seed.ts`, which is committed so the next
pass does not re-derive it:**

```
=== injury-case ===
program.id       : dev-e2e-injury-case      <- matches
witness programId: dev-e2e-injury-case
microcycle starts: 2026-07-13               <- matches
witness weekStart: 2026-07-13
```

**THE SEED BUILDS CORRECTLY. The witness that fails on the device
(`injury-case:program:dev-e2e-injury-case:2026-07-13`) cannot be failing at
BUILD time — so it fails at INSTALL time, after the auxiliary state is applied.**
The auxiliary state for this seed is a severity-5 canonical injury episode, and
applying an injury of that severity **rebuilds the program** — which replaces the
program the `program` witness was captured against.

**THE LEAD, NOT YET PROVEN:** the program witness is about the seed's program
INSTALL, and it is being validated after a subsequent mutation has legitimately
replaced that program. If that is right the fix is ordering — validate the base
witness before auxiliary state is applied — **not loosening the witness**, which
would blind it to the rot it exists to catch.

**NOT FIXED. NOT RETIRED. The order asked "fix or retire it, and say which" and
the honest answer is "neither yet, and here is exactly where to look."**

## NOT COVERED — ORDERS 3 TO 7 ARE NOT STARTED

Said plainly rather than left to be inferred:

- **ORDER 3, THE 21 SUITES** on the impossible athlete — not run against a legal
  profile.
- **ORDER 4, THE DRIFT CHECK** — not built.
- **ORDER 5, THE SEEDED WORLD'S DURABILITY** — not priced this pass.
- **ORDER 6, THE UNENFORCED COUNT** — 35 of 74; three rows were ADDED guarded
  today (`LAW-hot-file-budget`, `LAW-diagnostic-refuses-never-crashes`,
  `LAW-removal-ships-with-its-replacement`, plus `LAW-no-silent-blank-screen`),
  so the count fell, but `LAW-instrumentation-alive` is untouched.
- **ORDER 7, THE LAYOUT-BLINDNESS FINDING** — the registry row is NOT written.
  **The finding itself is recorded above** (two real defects, neither visible to
  any assertion) and the answer it points at is: **if only an eye can catch that
  class, the screenshots are load-bearing and every flow must photograph every
  state it touches.** That is a rule worth having and it is not yet a row.

**THE STOPPING REASON IS CONTEXT, NOT JUDGEMENT.** Each remaining order is a real
unit and none is blocked on Sam.

---

# ADDENDUM 3 — ORDERS 6, 7 AND HALF OF 3

## ORDER 7 — THE LAYOUT-BLINDNESS FINDING IS NOW A LAW, AND IT PAID ON ITS FIRST RUN

`LAW-flows-photograph-what-they-touch`, BORN GUARDED. **The answer to "what would
catch that class" is: only an eye — so the screenshots are load-bearing, and the
one thing a script CAN enforce is that they exist to be looked at.**

**ITS FIRST RUN FOUND SIX BLIND FLOWS**: `dev-launch-refusal-speaks`,
`explorer-all-nine`, `fixture-move`, `lower-body-deletion`, `one-set-feedback`,
`reload-standard-week` — every one of them navigating and photographing nothing.
**Paid, not exempted**: each now takes a shot of the state it ends on, and the
refusal flow photographs the refusal screen itself, which is the entire thing it
exists to prove.

## ORDER 6 — `LAW-instrumentation-alive` IS OUT OF UNENFORCED. 35 → 34.

**The row could not be guarded until the rig actually ran, which is the law
describing its own history.** What enforces it is
`docs/GOLDEN_FLOW_RUN_RECEIPT.md` plus a cell that reds when a golden flow is
missing from the table **or the newest recorded run is more than 7 days old** —
seven because the founding case was **23**, so the alarm fires three times over
before that number is reachable again.

**THE RECEIPT CARRIES `NOT RUN` ROWS ON PURPOSE. FIVE OF TEN FLOWS HAVE RUN**, and
a receipt recording only successes would make the rig look alive while half of it
was dark — precisely this law's failure mode.

**WHAT IT CANNOT DO, STATED:** it cannot prove the receipt is honest. A row edited
without a run defeats it, exactly as a LOOP CHECK line can be typed without the
thinking. Same trust every process law here runs on; the alternative left 23 days
invisible.

## ORDER 3 — ANSWERED, AND IT FOUND A SECOND IMPOSSIBLE ATHLETE

**Every suite that consumes the seed registry was run. 14 suites: 10 GREEN, 4
RED.** And the first red is the order's own question answered with a new instance
of the same class:

> `ProgramGenError: I still need to know what equipment you can train with
> before I can build your program.`

**`equipment-restriction-case` ANSWERED IN A VOCABULARY THE APP DOES NOT ACCEPT.**
Its profile said `equipment: ['bodyweight']` — but `'bodyweight'` is a TAG the
resolver EMITS, not an OPTION an athlete can pick. `tagsForChecklistOption`
recognised nothing, `recognized === 0`, the source resolved to `unanswered_floor`,
and the generator refused **correctly — exactly as it would refuse a real person
who skipped the equipment step.** The app's own word is `'Bodyweight Only'`.

**FIXED, IN BOTH PLACES.** The profile now answers with the checklist option, and
the `profile_equipment` witness — which compares the profile's raw array — holds
the OPTION rather than the TAG. **Holding the tag is what let a seed answering in
a made-up vocabulary look declared-and-correct.** `test:dev-e2e-seeds` went from
3 failures to 2.

## NOT COVERED

- **THREE SEED SUITES ARE STILL RED and are NOT this pass's**:
  `test:dev-e2e-reset-hydration` (2), `test:dev-e2e-entry` (2),
  `test:dev-e2e-scenario-session` (1). Counted, not diagnosed.
- **TWO REDS REMAIN IN `test:dev-e2e-seeds`** — `coach-production-replay`'s
  visible-equality witness, and a manifest count. **Pre-existing**: this pass
  touched only `equipment-restriction-case`.
- **ORDER 2 IS STILL ONLY DIAGNOSED.** `injury-case` install-time failure —
  the lead is in addendum 2 and no fix is attempted.
- **ORDERS 4 AND 5 ARE NOT STARTED** — the drift check, and the seeded world's
  durability price.
- **ORDER 1's KNOT IS STILL TIED.** The hedge holds; the extraction is not begun.
- **THE FLOWS WERE NOT RE-RUN AFTER THE SEED FIX.** No golden flow uses
  `equipment-restriction-case`, so the receipt is not stale about them — but that
  is a reasoned claim, not a run.

---

# ADDENDUM 4 — ORDER 5, THE DURABILITY PRICE

**The order: *"Price it; fix if small, write the price down if not."* IT IS NOT
SMALL. Here is the price.**

## THE MECHANISM, TRACED RATHER THAN ASSUMED

| Step | Where |
| --- | --- |
| The latch is held during boot | `store/ledgerReplayLatch.ts` — `ledgerReplayActive()` |
| Every durable write drops at ONE boundary while it is held | `store/asyncStorageCompat.ts:34` and `:50` — `setItem` and `removeItem` both `recordDroppedDurableWrite(name)` and return |
| The rule it is enforcing | R1.3, in that file's own words: **"THE BOOT DOES NOT WRITE. While the replay latch is held, disk is already the truth of inputs and outputs are never persisted."** |
| Five other sites honour the same latch | `decisionLedgerStore.ts:271`, `quiescentBoot.ts:281`, `athleteActionLog.ts:201`, `fixtureMutationTransaction.ts:634` |

**THE SEED INSTALLS ITS GAME DAYS INSIDE THAT WINDOW.** So three of four marks are
dropped — correctly, by a rule that is right about the case it was written for.

## WHY IT IS NOT A SMALL FIX

**R1.3 IS NOT WRONG. IT IS BEING ASKED A QUESTION IT WAS NOT WRITTEN TO ANSWER.**
"The boot does not write" is true of a REPLAY — disk is already the truth, so
re-emitting it is noise. **A dev-E2E seed install is the opposite: it is a fresh
world being authored, and disk is NOT yet the truth of it.** The latch cannot
tell those apart, because it is a global boolean and both happen at boot.

**SO THE FIX IS AN OWNERSHIP DECISION, NOT A PATCH**, and there are three shapes:

1. **Sequence the install outside the latch** — release before the seed writes.
   Smallest diff, and the risk is real: anything else that legitimately runs
   during replay would start writing too, and the latch exists because that
   caused a defect once.
2. **Give the latch a REASON rather than a boolean** — `replaying` vs
   `installing` — so the storage boundary can drop replay writes and pass install
   writes. Removes the ambiguity instead of routing around it, and touches six
   call sites.
3. **Make the install not a write-through-boot at all** — seed straight to disk
   before the app's boot begins.

**(2) IS THE ONE THAT REMOVES A REPRESENTATION** and is what the elegance law
points at: today one boolean carries two meanings and the storage boundary has to
guess. But it is a change to the boot path of the whole app, and the boot path is
where three of today's defects lived.

## THE PRICE, PLAINLY

**A boot-path ownership change plus its guard, and it must be proven on the
device** — `reload-standard-week.yaml` and the checkpoint flows are its evidence
and they are RED behind this exact question. **That is not a one-pass job, and it
is not something to start at the end of a long pass.**

**WHAT IT UNBLOCKS, so the cost has something to weigh against: six red flows,
the whole reload/durability half of the suite.**

## NOT COVERED

- **NOT FIXED. NOT STARTED.** Priced only, which is what the order asked for when
  it is not small.
- **WHETHER A REAL ONBOARDING INSTALL HITS THE SAME WINDOW IS NOT MEASURED.** The
  earlier boundary flagged it as a worry — *"the same door an onboarding install
  uses"* — and this pass did not check it. **If it does, this is an athlete-facing
  data-loss bug and not a harness one**, and that is the single most important
  open question in this addendum.

---

# ADDENDUM 5 — ORDER 4, THE DRIFT CHECK: IT ALREADY EXISTED AND NOTHING RAN IT

**The order asked whether each test world still matches what the generator
produces for that profile today. THE INSTRUMENT THAT ANSWERS THAT WAS ALREADY
BUILT.**

`test:dev-e2e-seeds` rebuilds every seed **through the real generator** and
validates it against its own declared witnesses. That IS the drift check: a seed
is not a stored fixture here, it is generated on demand, so the only thing that
can drift is the gap between what the generator now produces and what the seed
DECLARES about it — which is exactly what those witnesses compare.

**AND IT WAS NOT IN THE CHAIN. NEITHER WERE THE OTHER FOUR:**

```
test:dev-e2e-seeds            -> NOT IN CHAIN
test:dev-e2e-witnesses        -> NOT IN CHAIN
test:dev-e2e-entry            -> NOT IN CHAIN
test:dev-e2e-reset-hydration  -> NOT IN CHAIN
test:dev-e2e-scenario-session -> NOT IN CHAIN
```

**THAT IS WHY THE EQUIPMENT ROT SAT THERE.** The suite that would have caught a
seed answering in a vocabulary the app refuses existed, passed nobody's eye, and
was never run by the one command that counts. **`a green gate is a claim` — and
an unrun gate is not even a claim.**

**FIXED: all five are now in `test:bible`, placed immediately before
`test:law-registry`** — the deliberate last link — **so their reds cost no
coverage.** That is the same reasoning that put the registry last, applied rather
than re-derived.

## WHAT THIS DOES NOT DO

- **IT DOES NOT MAKE THEM GREEN.** Four of the five are red as of this commit
  (`dev-e2e-seeds` 2, `dev-e2e-entry` 2, `dev-e2e-reset-hydration` 2,
  `dev-e2e-scenario-session` 1). **They are now VISIBLE reds instead of invisible
  ones**, which is the whole of what this addendum claims.
- **IT DOES NOT DIAGNOSE THEM.** Counted, named, not investigated.
- **IT DOES NOT ANSWER THE DEEPER DRIFT QUESTION** Sam actually asked — *does the
  world still match what the generator would build for that profile TODAY?* The
  witnesses check declared PROPERTIES (this day has a squat, this week starts
  here), not the whole shape. **A seed could satisfy every witness and still be a
  week the generator would no longer produce.** That is a real gap and it is the
  next thing this alarm needs.
