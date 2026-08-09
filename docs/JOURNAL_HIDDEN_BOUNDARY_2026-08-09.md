# THE JOURNAL IS HIDDEN — BOUNDARY (2026-08-09)

**Ruling:** `docs/JOURNAL_HIDDEN_RULING_2026-08-09.md`, committed as authored at
`47312bd9` before a line was built.

Sam, after his own eye pass: *"journal looks really bad - i'm not sure it's
actually useful as it is - maybe we come back to it... i'd like all the journal
stuff hidden for now - keep the data behind the scenses because it might be
useful for the coach."*

---

## 1. ONE LINE

The Journal tab is gone from the tab bar in one edit at the navigation owner, the
machinery is frozen in the tree exactly as R5.7 left the coach — **and the hide
has a second half the ruling's own wording does not cover: the OS is this
feature's store, and it kept what the surface put there.**

## 2. THE FINDING OF THE PASS — "UNREACHABLE = NOTHING CAN EVER FIRE" IS HALF TRUE

The ruling states it as a parenthetical, and it is a claim, so it was checked
before being built against (`a ruling premise is a claim too`).

**It is true of every FUTURE schedule.** The opt-in is a tap on a screen no tab
reaches any more; `enableJournalReminder` has exactly one product caller and that
caller is the hidden screen. Nothing reachable can arm the reminder again, and
the gate asserts the caller SET rather than an absence — an opt-in that moved to
a reachable screen would satisfy "no call here" perfectly.

**It is false of a schedule already accepted.** The notification unit's own
design says it in as many words — *"ZERO new stored state — the OS is the
store"* — and that store outlives the surface. A `WEEKLY` trigger handed to the
notification centre fires every Monday whether this app is opened or not. Sam
rebuilt with pods and ran the proof path; whether he tapped the opt-in is not
knowable from this repo. If he did, hiding the tab alone would have left an
athlete-facing notification firing forever into a tab that no longer exists.

Worse than firing: **tapping it would have crashed.** The old handler navigated
to `JournalTab` by name, and navigating to a name the navigator does not know
throws. The handler's own comment called that the worst place in this app to
crash — *"the athlete is not even in the app yet"* — and the hide would have
created exactly that case.

So the hide is two removals and one addition, all in the navigation owner:

- the tab block — gone;
- the notification tap door — gone with it (R5.7's shape: the entry surface and
  every door that targeted it);
- **a cancel on mount**, through the reminder service's existing
  `disableJournalReminder` door, by the stable identifier. Stateless and
  idempotent: no "have I cancelled yet" flag is stored, so it costs the north
  star nothing. **North star: NEUTRAL — no new stored state, no new derivation.**

**WHAT THE CANCEL CANNOT REACH, stated rather than implied:** an athlete who
never opens the app again keeps whatever the OS accepted. Nothing inside a binary
can cancel a notification for a binary that is never run.

## 3. WHAT WAS BUILT

| ruling | what happened |
|---|---|
| 1 — the surface is hidden | one `Tab.Screen` block removed at `AppNavigator`; the tap door removed; the cancel added |
| 2 — the data layer stays live and gated | untouched; all twelve journal suites still run in `test:bible`, and a cell now asserts that |
| 3 — the two data-creating taps stay | **no code change needed, and that is measured rather than assumed** — both live on `SessionFeedbackPanel`, mounted by `DayWorkoutScreenV2`, registered on the Program stack. Every hop is asserted |
| 4 — the return is parked | nothing deleted, no word withdrawn from the copy sheet; batches 15-28 stay signed |

New gated suite: **`test:journal-hidden`** (`journalHiddenContractTests`), 35
cells — the ratchet the ruling requires, because *the gate must watch the deleted
surface*. It sweeps the whole PRODUCT tree rather than the navigator alone: the
door that comes back is rarely the door that left.

## 4. SIX CELLS WENT RED AND EVERY ONE WAS RE-AIMED, NOT DELETED

They existed to red on exactly this day.

- `journalWeekTests` [7] × 4 — the reachability cells. They were written as the
  lesson of the purge (*a Journal that exists but is not wired is a defect*).
  That lesson has not changed; it has been **ruled on**. Deliberate
  unreachability with the machinery kept is a different thing from an unwired
  screen nobody decided about, so the surviving claim is that the screen is still
  KEPT, and the absence of the route moved to the suite that sweeps for it.
  The tab-order cell now compares the two SURVIVORS — with both anchors proven
  present first, because that cell's own comment records the mutation that once
  passed it vacuously on a `-1`.
- `journalReminderTests` × 2 — the tap-handler cells, **inverted, and the second
  is now the stronger claim**: the navigator must CANCEL, not merely decline to
  navigate.

## 5. NINE MUTATIONS, NINE RED — AND ONE REFUSED TO BE READ

Each mutation's presence in the file was proven before its result was read
(`a mutation that never applied reports as a survivor`, built into the harness).

| # | mutation | red |
|---|---|---|
| M1 | the tab block comes back | ✓ 3 cells |
| M2 | a `navigate` door appears in `ProfileScreen` | ✓ |
| M3 | the cancel is dropped from the navigator | ✓ |
| M4 | the tap listener comes back | ✓ |
| M5 | a frozen rules module is emptied | ✓ |
| M6 | the feedback panel is unmounted from the day screen | ✓ |
| M7 | a journal suite drops out of `test:bible` | ✓ |
| M8 | the opt-in appears on a reachable screen | ✓ |
| M9 | the frozen `JournalScreen` import is removed | ✓ |

**M6's first run was REFUSED by the harness rather than reported as a survivor.**
The probe string `<SessionFeedbackPanel` is a prefix of the mutation
`<SessionFeedbackPanelRetired`, so the count did not move and the harness said
so instead of reading a green suite as a weak cell. Re-probed on
`SessionFeedbackPanel date=`, it reds. The gate cell itself was already
word-boundary-correct (`\b`), which is why the mutation was detectable at all —
the same law, on both sides of the instrument, in one run.

## 6. TWO CELLS FAILED ON THEIR FIRST RUN AND BOTH WERE MY DEFECT, NOT THE HIDE'S

- **`a count taken for a record`, source-scan form — TENTH SIGHTING.** The
  opt-in sweep read its own OWNER as a second caller: `journalReminderService`
  contains `enableJournalReminder` because it *declares* it. The instrument
  counted occurrences of a NAME; the claim was about CALL SITES. Split into two
  cells — the owner asserted by its declaration, the callers asserted as a set
  minus the owner — so neither can drift silently.
- **An anchor that found a 175-character region.** The navigator body was
  located between `export default function AppNavigator` and `return (` — and
  the mount logger's own `return () => logger.info(...)` is a `return (`. It
  reported the region as NOT FOUND rather than passing on it, which is the
  anchoring law working, but a cell that cannot find its subject proves nothing
  either way. Re-anchored on `<Tab.Navigator`, which appears once.

## 7. THE GATE

- Full **unpiped** `npm run test:bible` via `scripts/gate.sh`:
  **`GATE_EXIT=1` at `test:program-control-durable`, 1 FAIL line** — main's
  declared red, unchanged by this commit.
- `test:compile` PASSED inside the chain (459 errors against baseline, no file
  regressed).
- **Sweep: 2 of 169** — `program-control-durable` + `fixture-identity`, the
  declared set exactly (`scripts/sweep.sh journal-hidden`, world line printed:
  `head=77f5e415`).
- New suite `test:journal-hidden` **35 passed, 0 failed** (chain position 130 —
  the declared red is at 92, so the official chain stops before it and the sweep
  is what proves it registered).

**THE DENOMINATOR NAMES ITS INSTRUMENT, AND THE LAST REPORTS' DID NOT.**
`a count taken for a record`, applied to my own report before it is written.
Three different units have been called "the chain" in these boundary reports:

| unit | value now |
|---|---:|
| chain STEPS (`runSlice1` + every `npm run`) | **171** |
| `npm run` suites in `test:bible` | **170** |
| SWEEP suites (the above minus `test:compile`, which the runner excludes) | **169** |

The last two passes reported "sweep 2 of 170" while the sweep's own instrument
was measuring 168 — the failure count was right and the denominator was the
chain-step count, not the sweep's. **The number above is the one the sweep
printed, in the sweep's unit.**

## 8. NOT COVERED — first line

**NOBODY HAS SEEN THE TAB BAR WITH TWO TABS IN IT. DEPTH 0.** No cell mounts a
navigator; every assertion here is about the SHAPE of the wiring. The tab bar has
a fixed height and fixed padding and now holds two items instead of three —
whether that reads as intentional or as something missing is Sam's eye, not a
gate's.

Also not covered:

- **The cancel is proven as far as "the door is called on mount" and no
  further.** No cell reaches the notification centre; nothing in this repo can
  observe whether a schedule ever existed on Sam's device.
- **The weekday `+1` conversion is now unproven AND unprovable without restoring
  the tab.** The proof panel it needed lives on the hidden screen. This is not a
  loss — nothing can schedule, so the byte no longer ships — but the open
  question in `NOW.md` is closed by removal, not by an answer, and that
  distinction is the whole reason it is written here.
- **The legacy `JournalStack` / `JournalHome` / `RouteEnum.JOURNAL` entries in
  `src/types/navigation.ts` are pre-existing census debt from the OLD purged
  journal tree.** Type-only, reached by nothing, untouched. Named rather than
  hunted.
- **The copy sheet now records ~100 signed strings that are authored, present in
  source, and unreachable.** Nothing red: the gates assert PRESENCE, and every
  string is present. Ruling 4 keeps batches 15-28 signed on purpose. But the
  sheet's silent implication — *these are what an athlete reads* — is now false
  for the journal's share of it, and no instrument in this repo distinguishes
  "shipped" from "shipped and reachable". Filed, not ridden silently. The
  precedent is "Ask Coach", DORMANT under batch 11-e for the same reason.

## 9. L12 — WHAT CATCHES THE NEXT ONE OF THIS CLASS

The class is **a surface cut that leaves something running behind it.** R5.7 cut
the coach and had one owed item: a gate watching the deleted surface. This cut
had a second kind of remainder — state held OUTSIDE the app, by the OS — and no
gate in the repo asks that question because no previous cut had any.

What is now in place: `journalHiddenContractTests` [3] pairs the two halves in
one block, so "nothing can fire" cannot be satisfied by the arming half alone.
What is NOT in place, and is the honest answer to L12: **there is no general
census of app state that lives outside the app.** Notification schedules today;
widgets, calendar entries, background tasks and Live Activities if any arrive.
The next surface cut will have to ask the question by hand. Sizing it is a unit
of its own, and it is small today — one feature, one identifier.

## 10. FOR SAM

1. **His veto is open on ruling 3** — the two data-creating taps stay
   athlete-visible ("How did that go?" and the post-game legs/energy rating).
   That was the seat's call, not his; hiding them would stop the record he asked
   to keep, but they are journal-flavoured questions on a non-journal screen.
2. **The reminder cancels itself on next launch.** If he tapped the opt-in during
   the proof pass, one launch of the new build clears it. If he never taps
   launch again, his phone keeps it.
3. **C4 (the week bars' colours) is now moot** and struck from the waiting list
   with the surface it was about.
