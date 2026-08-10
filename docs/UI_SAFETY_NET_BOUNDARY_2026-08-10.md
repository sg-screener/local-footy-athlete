# THE UI SAFETY NET — BOUNDARY REPORT, 2026-08-10 (sixty-sixth pass)

**LOOP CHECK: an instrument that had never run is not coverage — sighting 3 —
ITERATE.** The rig had been dead since 18 July and each fix revealed the next;
the practice repeated because each layer could only be seen after the one above
it was cleared, which is iteration paying, not a wall being hit twice.
**ADDED 2026-08-10 by the next pass, and the omission is the finding:** this
report shipped with no LOOP CHECK line and no NOT-COVERED section on the same day
the cell that requires both went green. `LAW-loop-check-line`'s own words are
"No line, no valid order" — and the law was broken by the pass that ran its guard.

**The unit: make a flow walk day → week → profile end to end, so the screens
Sam signed rulings over can start changing.** Sam's sequencing, agreed by him:
*"DO NOT START CHANGING SCREENS until a flow walks day -> week -> profile end
to end."*

**STATUS: THE WALK IS GREEN.** `.maestro/golden/day-week-profile.yaml` — seed →
day shape → week shape → back → profile → coach → program, with a screenshot at
each surface. Exit 0.

---

## NORTH STAR

**Toward.** One source edit in this pass moved a READ to the value's one home
(`quiescentBoot` now asks the program for its own generation anchor before
declaring a legacy-world repair). No new stored state was introduced. Nothing
here adds a representation; one read stopped consulting a mirror.

---

## WHAT WAS BUILT

| Artefact | What it holds |
| --- | --- |
| `.maestro/golden/day-week-profile.yaml` | The walk. Widest, shallowest flow in the folder — four surfaces, four screenshots. |
| `.maestro/common/show-week-shape.yaml` | The day-first/week shape switch, declared ONCE instead of a tap copied into six flows. Witness is `day-row-tue`, a row that exists in exactly one shape. |
| `src/__tests__/maestroElementContractTests.ts` | The element-name contract. Every id a flow taps must be a name product source can emit. **Mutation-proved** (below). |
| Re-aimed: `standard-program-week`, `lower-body-deletion`, `one-set-feedback`, `fixture-move`, `component-deletion-reload`, `checkpoint-and-reload` | Six flows aimed at a screen that stopped existing on 2026-08-01. |

---

## SIX DEFECTS, EACH FOUND ONE STEP AFTER THE LAST WAS FIXED

**The pattern from the first green run repeated exactly. A blocked instrument
hides an unknown number of defects, never zero.**

### 1. THE DAY-FIRST SHAPE DRAWS ONE DAY, AND SIX FLOWS ASSERTED SEVEN
`day-row-tue` … `day-row-sun` are **not in the tree** in the shape the app opens
in — not off-screen, absent. No timeout reaches them. Fixed by declaring the
shape a flow needs as a precondition (`show-week-shape.yaml`), not by pasting a
tap into six files.

### 2. TAPPING TODAY'S CARD NOW OPENS THE SESSION
The old flows tapped `day-row-mon` to EXPAND it. Today's card is already open in
the day shape, and **the centre of it is the component timeline, whose tap opens
the session screen** — Maestro taps element centres. So `tapOn: day-row-mon`
navigated AWAY from the screen holding the link the flow then hunted for. Not an
app defect; the flow was tapping past its own target.

### 3. A DEV LOG OVERLAY BLINDED THE WHOLE TAB BAR — THE SAME WALL, TWICE
A `logger.error` at boot raised the LogBox badge, which sits in the bottom strip
— **the tab bar** — so the walk's first `tapOn: tab-profile` opened the log
viewer and three surfaces went unvisited. `App.tsx` already carried a
string-match suppression for **this exact failure** from a different message
("Open debugger to view warnings.… overlays the tab bar and swallows taps"), and
its comment promised *"Errors still surface"* — which is what did the blinding.

**§8 second-wall law: an alternative before attempt three.** Not a second
remembered string — one rule: **when the harness is holding the phone, no log
draws anything.** `LogBox.ignoreAllLogs()` under a dev-E2E launch, detected
through the native bridge that demonstrably reaches JS. **Nothing is silenced,
only undrawn** — Metro and the device log are untouched, and `e2e-seed-error` is
an app view, not a LogBox one.

### 4. THE ANCHOR ALARM FIRED ON EVERY HEALTHY SEEDED BOOT
The error behind (3) said *"generation anchor RECOVERED from the world itself"*
with evidence `stored_anchor` — whose own doc comment reads **"not a recovery at
all"**. Boot read only the store-root MIRROR of the anchor; the dev-E2E seed
installs through `commitAcceptedStateTransaction`, which does not stamp that
mirror. So a world whose anchor sat exactly where the ruling says it lives ("the
anchor rides the program it anchors") was classified as a legacy world under
repair, loudly, forever.

**Fixed by moving the READ to the home, not by guarding the alarm.** The shout
is now only ever a real repair.

### 5. THE RELOAD CHANNEL CRASHES THE APP ON THE LAUNCH PAD
`checkpoint-and-reload.yaml` relaunched with `e2eMetroUrl` and **no
`e2eLaunchPurpose`** — which `DevE2ELaunchDiagnostic` treats as fatal, by
design. **This is the crash Sam saw** (see the attribution section). Fixed:
`action-reload`, the declared purpose for a mid-flow reload.

### 6. THE SEEDED WORLD IS NOT DURABLE — MEMORY HOLDS FOUR GAME DAYS, DISK HOLDS ONE
**OPEN. NOT FIXED. This blocks the entire reload/durability half of the suite.**

The checkpoint step fails with *"Persisted semantic state did not converge:
calendar-storage"*. Measured:

```
memory: {"markedDays":{"2026-07-18":"game","2026-07-25":"game","2026-08-01":"game","2026-08-08":"game"}}
disk:   {"markedDays":{"2026-07-18":"game"}}
```

**The lead, not yet proven:** `asyncStorageCompat.setItem` drops every durable
write while the ledger replay latch is held — *"THE BOOT DOES NOT WRITE"*, R1.3,
deliberate. The seed installs its game days inside that window, so three of four
marks never reach disk. **If that is right, a seeded world silently loses future
fixtures on relaunch, and the same door is what an onboarding install uses.**
**Not fixed in this pass: it is a persistence-ownership question, not a flow
fix, and the stop-patching rule says name it rather than reach into boot.**

**What was fixed is the instrument:** the convergence error now prints BOTH
values. It had named a store and stopped — twice in two days, costing a manual
reconstruction each time. A fingerprint is a claim; the two values are its
evidence.

---

## THE CRASH SAM SAW — ATTRIBUTED, WITH THE RECEIPT

Three reports in `~/Library/Logs/DiagnosticReports/`, all today:

| When | Faulting frame | Attribution |
| --- | --- | --- |
| 10:04 | `DevE2ELaunchDiagnosticReceiptOwner.captureAndConfigureIfRequested` | Launch with no/invalid `e2eLaunchPurpose` |
| 15:10 | `…ReceiptOwner.validatedMetroURL` | Launch with a non-canonical `e2eMetroUrl` |
| 17:52 | `captureAndConfigureIfRequested` | **This session's probe**, launched without a purpose |

**All three are the SAME deliberate `fatalError`, raised in
`AppDelegate.didFinishLaunchingWithOptions` — before one line of JavaScript
runs.** The stacks contain **no JS or Hermes frames at all**, which excludes
this session's boot edits (`quiescentBoot.ts`, `App.tsx`) on the evidence rather
than on assurance.

**CATEGORY (b): A TEST-HARNESS DEFECT, NOT AN APP DEFECT.** The call site is
`#if DEBUG` and the trap only arms when `e2eMetroUrl` is supplied — which only
the runner does. **A real athlete on a release build cannot reach it.**

**AND TWO OF THE THREE PREDATE THIS SESSION** (it began ~17:20), so the
crashing is not new and not from today's edits. It is defect 5 above, firing
every time a reload flow ran. **Fixing 5 removes the cause.**

---

## THE ELEMENT-NAME CONTRACT — AND ITS PROOF

Sam asked *"why would this even be an issue?"*. The answer was that **nothing
connected the two sides**: a flow taps by name, a screen owns the name, and
between 18 July and 10 August six flows rotted with no signal.

`npm run test:maestro-element-contract` — 24 flows, 140 named ids checked, 26
runner-variable ids **declared unchecked**, against 841 product literals and 201
templates.

**MUTATION-PROVED, because a green gate is a claim.** Restoring the pre-re-aim
`lower-body-deletion.yaml` turns it RED on exactly the three ids design rulings
7-8 deleted (`plan-change-edit-session`, `plan-change-delete-session`,
`plan-change-delete-confirm`), and green again when restored.

**TWO LIMITS, STATED RATHER THAN DISCOVERED:**
1. **Existence is not reachability.** This gate would have been GREEN through
   the entire golden-flow failure: `make-change-link` never stopped existing.
   Only a device run answers reachability — that is what the walk is for.
2. **A template hole absorbs a word.** `fixture-actions-open` satisfies
   `` `fixture-actions-${fixtureId}` `` because "open" is a legal token. Ids
   deleted outright are caught; ids that merely stopped being produced are not.

**IT LANDS RED ON ONE ORPHAN, DECLARED:**
`component-deletion-reload.yaml` taps `day-workout-make-change-link`, and
neither that id **nor the menu text "Remove an exercise" exists anywhere in
product source**. That flow is aimed at a session-screen door the redesign
removed and nothing replaced. **It needs a ruling, not a patch.**

---

## FLOW STATUS AFTER THE PASS

| Flow | Verdict |
| --- | --- |
| `day-week-profile` (new) | **GREEN** — the net |
| `standard-program-week` | **GREEN** — now asserts BOTH shapes |
| `lower-body-deletion` | **GREEN** — new path, and the assertion names the part deleted instead of a whole-day proxy that had stopped meaning it |
| `one-set-feedback` | **RED** — reaches the session screen; `exercise-set-count-dev-e2e-one-set-main-1` not found. NOT INVESTIGATED. |
| `fixture-move` | **RED** — `fixture-actions-open` is a dead id; the live door is `explorerTestId.fixtureIngress`. NOT RE-AIMED. |
| `reload-standard-week` | **RED** — blocked by defect 6 |
| `action-trace-v2` (3 flows) | **RED** — blocked by defect 6 and the orphan above |

**Five flows still red. Two are blocked on the persistence question; two are
un-investigated stale ids; one needs a ruling.** Naming them, not claiming them.

---

## NOT DONE, AND OWED

1. **THE MERGE PLAN.** Sam's nine rulings are signed and unread by any plan.
   The reading half has not started.
2. **THE DRIFT CHECK** — *does this world still match what the generator
   produces for that profile today?* Sam's third alarm. Not built.
3. **THE 2KM LEAD.** One observation, offered as a fact and not a conclusion:
   the `standard-in-season-week` seed now photographs a Monday reading
   **"Strength + Conditioning"** (`artifacts/ui-walk/walk-1-day.png`) — the day
   shape Sam says 0 of 11 seeds reached. **That seed was regenerated from a
   profile that gained a real 2km time yesterday.** Suggestive; the experiment
   that would prove it (generate with and without the time) has NOT been run.
4. **THE SEED-CONSUMER CENSUS** — how many of the 328 suites built their inputs
   from `buildDevE2ESeed` and were therefore testing an impossible athlete.
   Not counted. "Some" is not an answer and this pass does not give one.
5. **RULING 4 vs THE COACH ARCHITECTURE.** Not yet checked.

---

## NOT COVERED

**ADDED 2026-08-10 by the following pass. It was owed on the day and omitted;
what follows is what this unit did not look at, written from its own artefacts
rather than reconstructed from memory.**

- **THE OTHER TEN FLOWS.** One flow was made to walk. `one-set-feedback.yaml`,
  `fixture-move.yaml`, `reload-standard-week.yaml`, `lower-body-deletion.yaml`,
  `standard-program-week.yaml` and the explorer flow were NOT run in this pass.
  "The rig is green" means one flow is green.
- **THE APP ON A REAL DEVICE.** Everything here is the simulator. Nothing in this
  unit has been on Sam's phone.
- **WHETHER THE WALK ASSERTS ANYTHING ABOUT CORRECTNESS.** It asserts each
  surface MOUNTS. It does not assert that what the surface shows is right — the
  screenshots are for a human eye, and no cell reads them.
- **THE 21 SUITES BUILT ON THE IMPOSSIBLE ATHLETE.** Named in this report as item
  4 and counted by the next pass; this one did not count them, and did not ask
  whether they still pass on a legal profile.
- **THE DRIFT CHECK.** Whether each seeded world still matches what the generator
  produces for that profile today — Sam's third alarm — is not built and was not
  designed here.
- **THE SEED'S DURABILITY.** The seeded world's calendar is 4 game days in memory
  and 1 on disk. This unit observed the flows that depend on it are red; it did
  not investigate why.
