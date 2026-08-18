# STATUS — seat `visible`

Claimed 2026-08-18. Name checked against `ls docs/STATUS_*.md` at claim time —
`VISIBLE` was free (32 other status files exist; none is this name).

Mission: **ATHLETE CAN SEE IT** — every completed athlete-facing capability is
reachable through the real app UI, visibly does what it claims, explains the
result and survives restart. Base `main @ c2aaf313`, branch
`feat/athlete-can-see-it`, worktree `scratchpad/wt-visible`. CAP 3 sessions.

**This is a functional UI/reachability pass. NOT a redesign, NOT a general audit.**

## THE DISTINCTION THAT DEFINES THIS MISSION

The `journey` seat (merged `c68b00d7`/`c2aaf313`) proved the capability list
through **production write doors, headlessly** — `test:athlete-journey`, 40
cells. This mission's acceptance bar is explicitly higher and different:

> *"Drive the actual screens, buttons, sheets and production write doors. A
> headless rule test alone is not acceptance."*

So the question here is not *does the rule fire* — `journey` answered that — it
is **can the athlete REACH the control, and does the SCREEN change.** A
capability that is proven at the door and unreachable on glass is, by this
mission's rule, **not complete**.

## ⚠ FINDING 1 — THE ENTIRE SIMULATOR RIG WAS DEAD AT `main`, AND IT IS THE THIRD COPY OF ONE LIST

**This mission could not take its first step.** The first thing attempted was one
existing golden seed (`standard-in-season-week`) against a Metro serving this
worktree. It refused, and the refusal was not in Maestro:

```
e2e-seed-error-reason:
Persisted semantic state did not converge: program-store
  memory: {...,"weightOverrides":{},"temporarySourceFacts":[],"injuryEpisodes":[]}
  disk:   {...,"weightOverrides":{},"acceptedBlocks":{},"temporarySourceFacts":[],"injuryEpisodes":[]}
```

Read off the live accessibility tree (`maestro hierarchy`) — the id
`e2e-seed-error` is a 1x1 point, so the flow reports only *"assertion is false"*
and the reason has to be dug out. **No seeded flow can start.** That is 19
golden flows and every scenario/explorer flow built on `reset-seed.yaml`.

### THE CAUSE — and the `journey` seat's own note predicted it exactly

`programStore` projects its persisted inputs in **three** places, not two:

| # | site | had `acceptedBlocks` |
| --- | --- | --- |
| 1 | `programStore.partialize` (persist middleware) | ✅ added 2026-08-17 |
| 2 | `reduceProgramEnvelopeToInputs` (storage adapter route) | ✅ added 2026-08-17 |
| 3 | `devE2EPersistence.semanticStores['program-store'].select` | ❌ **never** |

Copy 3's own docstring said *"Mirrors `programStore`'s `partialize` field for
field. **If that list ever grows a key, this one grows with it**"* — a rule
written in prose, in a different file, with nothing holding it. The list grew;
the copy did not. [[a-claim-with-no-cell-is-prose]].

**The `journey` seat found copies 1 and 2 and wrote the warning down** (*"THE
INPUT LIST IS WRITTEN IN TWO PLACES AND BOTH MUST CARRY A NEW INPUT"*). The
warning named two and there were three, so the same defect landed again one
layer out — and this time it took the whole rig with it rather than one block's
requirement.

### THE FIX — one function, three callers, no compatibility logic

`projectProgramPersistedInputs(state)` in `programStore.ts` is now the ONE
projection. `partialize` calls it, `reduceProgramEnvelopeToInputs` calls it, and
the dev-E2E check calls it instead of mirroring it. **A fourth copy cannot be
written by adding a key, because there is one place to add it.**

It accepts both shapes (a live store with fields at top level, and an
already-reduced envelope carrying `inputs`) exactly as copy 3 already did, so
the two sides of the convergence check ask the identical question of two
different sources — which is the only way that check means anything.

**AND IT CLOSED A SECOND, SILENT DRIFT IN THE SAME LIST.** Copies 2 and 3
resolved the clock as `currentProgram?.seasonPhaseClock ?? hydratedSeasonPhaseClock
?? null`; **copy 1 (`partialize`) had no `hydratedSeasonPhaseClock` arm.**
`merge` restores the persisted clock into that field while `currentProgram` is
still null — boot has not regenerated yet — so a middleware write in that window
persisted `null` over a clock restored one tick earlier. Unified onto the
three-arm resolution the other two already used. **Named here because it is a
behaviour change, not a refactor.**

### MEASURED

| | result | instrument |
| --- | --- | --- |
| seed installs on glass | **WORKING** | `.maestro/visible/smoke.yaml`, `e2e-seed-ready-standard-in-season-week` COMPLETED |
| the athlete reaches the Program screen | **WORKING** | `artifacts/visible/smoke-program-screen.png` |
| `test:compile` | **red at base, unmoved** | 7 file/scope pairs, IDENTICAL name and count in a control worktree at `c2aaf313` |

## THE INSTRUMENT, AND THE THREE THINGS IT COST TO STAND UP

Recorded so the next seat does not re-buy them.

1. **A WORKTREE CANNOT SYMLINK `node_modules` AND SERVE THIS APP.** The native
   debug build asks Metro for `.expo/.virtual-metro-entry`; expo resolves the
   `main` field to a REAL path, and through a symlink that real path is the
   MAIN checkout — so Metro reported *"Unable to resolve module
   ./Users/samgeurts/Documents/local-footy-athlete/node_modules/expo/AppEntry"*.
   Worse than failing: had it resolved, it would have served **main's `App.tsx`
   from my worktree's Metro** and every screenshot would have been of the wrong
   tree. **`cp -al` (hardlink copy) — 16 seconds, near-zero disk.**
2. **PICK A FREE PORT, DO NOT ASSUME 8081.** 8081, 8082 and 8083 were all held
   by other seats. `npx expo start --port <free>` and pass the same URL as
   `E2E_METRO_URL`; the app takes it as a launch ARGUMENT (`e2eMetroUrl`) and
   the hierarchy prints back `e2e-explorer-launch-resolved-metro-url-...` so you
   can prove which tree you are looking at. **Check it — this is the only thing
   that distinguishes a screenshot of your branch from a screenshot of main.**
3. **A COLD METRO LOOKS LIKE A SEED FAILURE.** The first launch bundles for
   ~60s while `reset-seed.yaml` waits 30s for the seed. Warm Metro first.

## THE WALK — WHAT THE ATHLETE CAN ACTUALLY REACH, MEASURED ON GLASS

Simulator `LFA Explorer 4c8535f`, iOS 26.3, Metro on 8090 serving THIS worktree
(proved by `e2e-explorer-launch-resolved-metro-url-http%3A%2F%2F127.0.0.1%3A8090`
in the live tree, not assumed). Seed `standard-in-season-week`, Mon 13/7.

### ✅ CAPABILITY 1 — PROGRAM DISPLAY: strength shows ONE prescribed rep value

`artifacts/visible/c1-session-strength-open.png`. The live session screen shows
`Back Squat 3 × 3 · 110kg`, `RDLs 3 × 3 · 90kg`, `Single-Leg RDL 3 × 7 · 20kg`,
`Band Pallof Press 2 × 10 · BW`, `Cossack Squat 3 × 10`. **One value, never a
range.** The day card's drop-down agrees on names and doses.

**⚠ ONE LEDGER LINE, NOT CHASED:** the swap CONFIRMATION sheet previews the
replacement as `3 x 6-8` — a RANGE — and the session then shows `3 × 7`. Both
are true of the same authored row; two surfaces speaking two dialects of one
prescription. Named, not fixed: it is a copy question, not a wiring one.

### ⚠ FINDING 2 — THE DAY CARD AND THE SESSION SCREEN ORDER THE SAME FIVE EXERCISES DIFFERENTLY

**MEASURED, not inferred from an id** (`scripts/tmp-probe-order.ts`, temporary):

| # | the stored program (`workout.exercises`) | the session template (`buildSessionTemplate`) | what the athlete is NUMBERED on the session screen |
| --- | --- | --- | --- |
| 1 | Back Squat | Back Squat (main_lift) | 1 Back Squat |
| 2 | RDLs | RDLs (main_lift) | 2 RDLs |
| 3 | **Cossack Squat** | Single-Leg RDL (accessory) | 3 Single-Leg RDL |
| 4 | **Single-Leg RDL** | Band Pallof Press (midline) | 4 Band Pallof Press |
| 5 | **Band Pallof Press** | Cossack Squat (prehab) | **5 Cossack Squat** |

The DAY CARD renders the stored array order; the SESSION SCREEN renders the
template's role order (main_lift → accessory → midline → prehab) and then numbers
it 1..5. **So the athlete reads "Cossack Squat, third of five" on the card and
"5 Cossack Squat" when they open the session.** Nothing disappears — membership,
names and doses agree — but the ORDER does not.

**AND `rules/dayTimeline.ts` STATES THE OPPOSITE AS ITS FOUNDING PROPERTY**, in
its own docstring: *"IT IS THE PROJECTION'S OWN `rows`, PASSED THROUGH UNTOUCHED.
Not a second read, not a filter, **not a re-order** … the card's drop-down and the
session screen cannot come to disagree about what is in a part — they are one
list asked twice."* They are not one list asked twice. They are two independent
reads of one session:

- card: `VisibleDay` → `projectDayDetail` → rows in stored order
- session: raw `Workout` → `buildSessionTemplate` → items in ROLE order

`surfaceAgreementTests` cannot see it: its conservation cell (line 384) is
*"L-P3: parts conservation — same ids, same order, same count"* over **PARTS**
(mobility / strength / conditioning), never over the exercise rows inside a part.
A green gate over the containers, and the contents unguarded.

**NOT FIXED IN SESSION 1, DELIBERATELY.** The honest fix is one owner for "what
order is this session in", read by both surfaces — and the only candidate that
invents no programming policy is the TEMPLATE, because its role order is the
order the athlete actually performs and is already shipped. That change lands
inside `projectDayDetail`/`visibleProjection`, which is deep, heavily guarded
machinery; starting it without room to measure its blast radius would be worse
than naming it. **Sized for session 2.**

### ✅ CAPABILITY 3 — ORDINARY SUBSTITUTION IS REACHABLE AND CHANGES EXACTLY ONE ROW

Real route, every tap on glass: session screen → the row's swap control
(`component-swap-action-…`) → *"Why do you want to swap it?"* → `Don't like it`
→ *"Replace Single-Leg RDL with Glute Bridge for today's session"* →
`Apply change` → *"Exercise swapped… Apply this change to future weeks?"* →
`Today only`.

| | before | after |
| --- | --- | --- |
| 1 | Back Squat 3×3 110kg | Back Squat 3×3 110kg |
| 2 | RDLs 3×3 90kg | RDLs 3×3 90kg |
| 3 | **Single-Leg RDL 3×7 20kg** | **Glute Bridge 3×7 BW + 20kg** |
| 4 | Band Pallof Press 2×10 BW | Band Pallof Press 2×10 BW |
| 5 | Cossack Squat 3×10 | Cossack Squat 3×10 |

**Exactly one visible row changed; the other four are identical name, dose AND
load.** Still 5 exercises. The success message is truthful — the screen really
did change. `artifacts/visible/c3-swap-sheet.png`,
`c3-swap-after-reason.png`, `c3-swap-applied.png`, `c3-swap-today-only.png`.

### ⚠ FINDING 3 — THE REPLACEMENT IS WEARING THE OUTGOING LIFT'S LOAD, ON THE ATHLETE'S OWN DOOR

`Glute Bridge` came in at **`BW + 20kg`**. `Single-Leg RDL`, the row it replaced,
was **20 kg**.

**MEASURED, both numbers, before claiming anything**
(`scripts/tmp-probe-load.ts`, temporary — `loadForReplacementExercise`, the one
owner of *"what load does a replacement start at"*, on this seed's own profile):

```
Glute Bridge       own authored/estimated load = UNSET (bodyweight / athlete-chosen)
Single-Leg RDL     own authored/estimated load = 20 kg
RDLs               own authored/estimated load = 87.5 kg
Back Squat         own authored/estimated load = 107.5 kg
```

**Glute Bridge's own authority is UNSET.** The honest screen is `BW`. It shows
`BW + 20kg`, and 20 is exactly the outgoing exercise's number.

This is the defect Sam ruled on 2026-08-18 — *"a substitution's replacement never
inherits another exercise's load"* — which the `journey` seat fixed at
`replaceExerciseAtDate` and proved with `Pull-Ups (0 kg) → Single-Arm Lat
Pulldown = 30 kg, its own estimate`. **That fix is in this base** (`c68b00d7`)
and the athlete's session-screen swap still produces the banned outcome.

**THE MECHANISM IS NOT ESTABLISHED, AND I AM NOT CLAIMING ONE.** Two candidates
were opened and NEITHER is confirmed — recorded so the next session does not
re-buy them:

- `coachActions.ts:663` — `Number.isFinite(Number(toExercise.weight)) ? {prescribedWeightKg: Number(toExercise.weight)} : {…loadForReplacementRow…}`. A
  caller-supplied `weight` OUTRANKS the load owner. But `tapSwapHierarchy`
  sets `weight: 0`, and `Number.isFinite(0)` is true, which would render `BW`
  and not `BW + 20kg`. **Consistent with the arm being wrong, inconsistent with
  it producing THIS number.**
- the 20 may be arriving after the write, at render, from the row the swap
  replaced. Not traced.

**OPEN-UNKNOWN on the cause. The SYMPTOM is proven on glass and reproducible.**
A confident wrong attribution costs more here than an honest gap
([[a-count-taken-for-a-record]]).

### NOT YET WALKED — named, not half-claimed

Capabilities **2** (block 1 selections, block 2 progression/rotation visible,
restart identity), **4** (combined-day readiness asked separately, tired/sore
holds load and reduces volume, the athlete sees why), **5** (the extra-session
offer card, Accept/Decline, dismissal across restart), **6** (temporary
equipment through the UI, kit legality, expiry on return), **7** (a refused world
naming its own reason). Their doors are located — `home-tired-entry`,
`home-away-entry`, `day-workout-equipment-concern-action`,
`home-rollover-refusal`, `ExtraSessionOfferCard` in `HomeScreenV2:986` — and
NONE of them has been driven. **Session 1 went entirely on standing the
instrument back up and on capabilities 1 and 3.**

## ✅ BOTH LIVE UI DEFECTS ARE CLOSED — 2026-08-18

Sam, this session: *"Close both live UI defects, not only the swapped weight. The
day summary and opened session must read one canonical exercise order. For the
swapped load, trace stored replacement authority versus screen/local state."*

### ✅ DEFECT A — THE SWAPPED LOAD. **THE WRITER WAS RIGHT AND WAS BEING TALKED OVER.**

The trace Sam asked for, stored authority vs screen state:

| layer | what it says about `Glute Bridge` replacing a 20 kg `Single-Leg RDL` |
| --- | --- |
| **stored authority** — `loadForReplacementExercise` | **UNSET** (bodyweight / athlete-chosen). Its ladder: own recorded history → authored estimate → bodyweight/blank. |
| **the writer** — `replaceExerciseAtDate` | correct already. `Number.isFinite(Number(toExercise.weight)) ? …caller's… : …owner's…` |
| **screen/local state** — the session screen's `baseSuggestion` | `weight: overrides.weight ?? raw?.prescribedWeightKg`, where **`raw` is the row being replaced**. |
| **what the athlete saw** | **`BW + 20kg`** |

**So the payload arrived pre-filled with 20, the writer's caller-arm always won,
and the fix the `journey` seat landed on 2026-08-18 could never run on the door
the athlete actually uses.** That is why the defect survived its own fix: the
coach's path and the athlete's path reach the same writer, and only one of them
was talking over it.

**THE AUTHORITY IS REMOVED, NOT BALANCED.** The fallback is gone. Nothing was
taught to compensate for it and no compatibility logic was added.

- `overrides.weight` still wins — a choice that **prescribes** a load is stating
  one, not inheriting one. The recovery fallbacks (`Easy Bike`,
  `Breathing Reset`) send `weight: 0` to mean unloaded and that is theirs to say.
  Every ordinary `same_movement_pattern` choice sends **no** prescription, which
  is exactly the population that was inheriting.
- **The DOSE still carries over** — sets, rep range, rest, per-side. A dose
  belongs to the SLOT the new movement steps into; a load belongs to the
  EXERCISE. Asserted, so "fix" by blanking everything cannot pass.

**AND THE RULE MOVED OUT OF THE SCREEN.** `utils/swapSuggestionPayload.ts` now
owns it. *Which load does the athlete see* is a rule, and a rule inside a
4,400-line screen cannot be held by anything that does not mount React Native.

**A SECOND, SMALLER THING WAS IN THE WAY AND IS FIXED:** the weight control is
`accessible`, which **replaces its subtree** in the accessibility tree — so the
kilogram number was reachable by no screen reader and by no flow. **That is how
this shipped and stayed shipped: no guard could assert a prescribed load at all.**
Its label now carries the value (`Edit weight, 110kg`) and the row carries an id.

### ✅ DEFECT B — ONE CANONICAL ORDER

**The card and the session were never "one list asked twice".** They were two
independent reads:

- card: `composeDayDetail` → the raw component buckets → **stored array order**
- session: `buildSessionTemplate` → `orderItems(items, d2Rank)` → **D2's authored
  role order** (power → main → accessory → midline → prehab)

**The template is now the one owner.** `orderRowsAsSessionPresents` **reports the
placement the template already computed** — it does not re-rank, so no second
comparator exists to drift, and supersets stay clustered for free because
`orderItems` clustered them.

**NO NEW PROGRAMMING POLICY, AND THIS WAS THE FORK.** D2's order is authored,
shipped, and already what the athlete performs. **The card was corrected to the
session, not the session to the card** — the other direction would have invented a
new performance order, which this mission is explicitly barred from doing.

Rows the template does not place keep their incoming order **after** the placed
ones: an unrecognised row is never dropped and never promoted above authored work.

**BOTH SURFACES' ROWS ARE NOW ADDRESSABLE**, and that is part of the fix rather
than decoration: neither carried a testID, so nothing could ask *"which exercise
is fourth?"*. **An order nothing can assert is an order that drifts.**

### MEASURED — and each property is held in BOTH halves

| | branch | base | instrument |
| --- | --- | --- | --- |
| swap: replacement shows its own load | **WORKING** | broken | `.maestro/visible/swap-load.yaml`, 22 steps green on glass |
| one order, card vs session | **WORKING** | broken | `.maestro/visible/one-order.yaml`, 17 steps green on glass |
| both, headless | **9/0** | — | `npm run test:visible-surfaces`, new, **in the bible chain** |
| `test:compile` | **red, IDENTICAL to base** | red | 7 file/scope pairs, same names, same counts, `TOTAL 469` both |
| `test:law-registry` | 135 rows / 114 guarded / **21 UNENFORCED** | 132 / 111 / **21** | same 12 passed, 2 failed, same two names. **THE UNENFORCED COUNT DID NOT RISE.** |
| `test:maestro-element-contract` | red, **identical missing set** | red | 3 entries, byte-identical both trees |

**WHY BOTH A FLOW AND A SUITE, STATED SO NEITHER IS MISTAKEN FOR ENOUGH.** The
flows are the acceptance — they tap the real controls and read the real glass —
but they need a booted simulator, so nothing runs them on an ordinary change, and
**a guard outside the chain is a guard nothing runs.** The suite is the chain's
half. **The suite CANNOT see a screen that stops calling these owners — which is
exactly what the swap defect WAS** — and the flow cannot run in the chain. Both,
or the property is half held.

### MUTATIONS — six, all killed

| # | mutation | result |
| --- | --- | --- |
| M1 | the hand-written harness copy of the persisted-input list | ✅ 4 cells, the simulator's own message |
| M2 | the shared projection's `hydratedSeasonPhaseClock` arm dropped | ✅ exactly its 1 cell |
| M3 | the screen pre-fills the outgoing load again (**on glass**) | ✅ *"`Edit weight, BW + 20kg` is not visible"* — the defect verbatim |
| M4 | the card reads the raw buckets again (**on glass**) | ✅ `day-card-row-strength-4-band-pallof-press` |
| M5 | the card reads the raw buckets again (headless) | ✅ prints BOTH orders side by side |
| M6 | the payload pre-fills the outgoing load (headless) | ✅ prints `20` |

### ✅ CAPABILITY 4 — READINESS: LESS WORK, LOAD HELD, AND THE ATHLETE IS TOLD

`.maestro/visible/readiness-holds-load.yaml`, 32 steps green. Real route:
Program → `Tired` → *"Feeling flat — what's closest?"* → **Totally cooked**.

| | before | after |
| --- | --- | --- |
| Back Squat | 3 sets · 110kg | **2 sets · 110kg** |
| RDLs | 3 sets · 90kg | **2 sets · 90kg** |
| the day says why | — | `modifiers-strip-day` visible |

**Less total work, load retained** — the approved contract's low-readiness order
exactly. **The load half is asserted deliberately: a reduction that also dropped
the kilograms would pass every set-count cell and is a different, wrong answer.**

**⚠ TWO THINGS FOUND HERE, NAMED AND NOT CHASED:**

1. **"Bit tired today" changes nothing and says nothing.** Measured: the fatigue
   fact IS recorded and active (`readiness-active-…fatigue-date-2026-07-13` in the
   live tree), and the session is byte-identical — sets `3,3,3,2,3` before and
   after — with no notice on the day. The mildest of the three answers may well be
   log-only by design; **the gap is that the athlete is not told that.** The
   `illness_mild` option one sheet over carries a sub-label saying exactly what it
   will do (*"Log it — I'll offer to soften today if you want"*); this one carries
   none. A copy question, not a wiring one.
2. **A readiness answer at this strength RE-MINTS the row identities** —
   `dev-e2e-…-exercise-ex-squat-1` becomes `we-w-composed-mc-ai-1-1-0`, and the
   day drops from 5 exercises to 3. The drop is a legitimate reduction. **The
   identity change is not chased and is flagged**: any decision keyed to a row id
   (an exclusion, a pin, a weight override) is pointing at an id that no longer
   exists after a rebuild. That is its own unit.

### STILL NOT WALKED

Capabilities **2** (block 2 progression/rotation visible, restart identity),
**5** (the extra-session offer card), **6** (temporary equipment, kit legality,
expiry on return), **7** (a refused world naming its reason). Doors located,
none driven.

## BLAST RADIUS — FULL SWEEPS, UNTRUNCATED, BOTH RUN TO COMPLETION

| | failures | of | world |
| --- | --- | --- | --- |
| branch `feat/athlete-can-see-it` | **154** | 405 | `scratchpad/wt-visible` |
| control worktree at `c2aaf313` | **154** | 403 | `scratchpad/wt-control`, same node_modules |

**GAINED: 0. LOST: 0. The two failing sets are IDENTICAL name for name**
(`comm -13` / `comm -23` over the full sorted sets, never a `tail` —
[[a-truncated-diff-manufactures-findings]]). The +2 suites are
`test:visible-surfaces` and `test:persisted-input-projection` joining the chain;
neither is in the failing set.

### ⚠ ONE GAINED RED WAS REAL, AND IT WAS AN INSTRUMENT AIMED AT A MOVED SHAPE

The first sweep of the final tree reported **155 of 405 — one GAINED**:
`test:dev-e2e-reset-hydration`, on the cell *"reload fingerprints compare
persisted inputs and exclude derived adjustment output"*.

**It was a SOURCE SCAN** — it grepped `devE2EPersistence.ts` for six literal
field names. Deleting the harness's hand-written copy of the input list (the
whole point of the first fix) took those strings out of that file, so the cell
went red **while the property it guards became more true, not less**.
`LAW-instrumentation-alive`, and the file's own docstring already describes this
exact shape happening to it once before.

**REPAIRED AT THE PROPERTY, NOT AT THE EXPECTATION.** The claim is unchanged; the
cell now CALLS `projectProgramPersistedInputs` on a state that carries a derived
`reversibleAdjustmentLedger` and reads what comes out, instead of grepping for
prose. **A grep passes on a comment; this does not.** Mutation-checked both
directions, which the scan never was:

| # | mutation | result |
| --- | --- | --- |
| M7 | a DERIVED ledger added to the projection | ✅ RED |
| M8 | a real input (`generationAnchorISO`) dropped | ✅ RED |

Suite is **58 passed, 0 failed**. Re-swept: **154 of 405, GAINED 0, LOST 0.**

**I did not report the first sweep's numbers as the answer.** A gained red is a
finding to attribute, and this one was mine.

## CAPABILITY 6 — EQUIPMENT: THE DOOR WORKS, AND THE DAY DOES NOT FULLY OBEY IT

`.maestro/visible/equipment-today.yaml`, 22 steps green, run twice.

### ✅ WHAT WORKS, ON GLASS

Session screen → the dumbbell button (`day-workout-equipment-concern-action`) →
*"Equipment for this session — Untick anything you don't have today. We'll
replace affected exercises using equipment you still have."* → untick **Barbell**
→ Apply.

The app answers with a receipt that **states its own scope**:

> **Session equipment updated** — *"2 exercises were replaced for this session
> only."*

and the sheet already carries *"Permanent change? Update your equipment in
Profile."* — so the athlete is told, in the moment, that unticking a barbell
today has not edited their gym. **`Back Squat` leaves the day.** Temporary
equipment IS enterable through the UI and it IS scoped, which is most of the
capability.

### ⚠ FINDING 4 — THE DAY STILL REQUIRES THE BARBELL THE ATHLETE JUST SAID THEY HAVE NOT GOT

**Measured by the app's OWN reader, not by my inference.** Re-opening the sheet
after applying — the same `deriveSessionEquipmentRequirements` that built it the
first time — still offers:

| before unticking | after unticking barbell |
| --- | --- |
| `session-equipment-option-tag-barbell` | **`session-equipment-option-tag-barbell`** |
| `session-equipment-option-tag-dumbbells` | `session-equipment-option-tag-dumbbells` |
| `session-equipment-option-tag-rack` | *(gone — Back Squat left)* |

The rack requirement disappeared, so the recalculation is live and correct for
Back Squat. **The barbell requirement did not, and the rows say why:**

```
1 RDLs                       <- STAYED
2 Single-Leg Squat (to Box)  <- replaced Back Squat
3 Single-Leg RDL
4 Glute Bridge               <- arrived
5 Band Pallof Press
```

**`RDLs` is still on the day.** The app reported *"2 exercises were replaced"* and
its own requirement calculator still names the equipment the athlete removed.
**The app is disagreeing with itself** — the mission's clause here is *"every
visible exercise is legal for that day's kit"*, and it is not.

**NOT FIXED, AND NAMED RATHER THAN HALF-BUILT.** This is not UI wiring — the
door, the scope, the receipt and the recalculation all work. It is
`buildSessionEquipmentReplacementPlan` leaving a row it should have taken, which
is a composition/replacement question of the same family as seat-inbox item 48
(*"the kit must be known when the day is COMPOSED, not subtracted from
afterwards"*). Sizing it as a guard would be patching the symptom.

### ⚠ AND A GREEN-AND-EMPTY CELL OF MY OWN, CAUGHT AND CORRECTED

My first version of this flow asserted the barbell work was gone with
`assertNotVisible: session-strength-position-2-rdls`. **It PASSED while RDLs was
still on the day** — the replacements had shifted RDLs to position 1, so the
positional id was absent for a reason with nothing to do with the claim. **A cell
that can pass because a row MOVED is not asserting that the row is GONE.** It
asserts by NAME now, and finding 4 above is the thing that false green was
hiding. [[a-bind-can-be-green-and-empty]], and this one was mine.

**The row-level checks are deliberately NOT in the flow.** Whether the strength
accordion is open after the sheet closes depends on what the athlete last left
it as, so an `optional: true` toggle made the next assertion depend on prior
state — it passed and failed on identical trees in consecutive runs. **A flaky
cell is worse than no cell: it teaches the next reader to re-run until green.**
The measurements are written above instead.

## WHERE THE MISSION STANDS AT THE CAP

| # | capability | verdict | instrument |
| --- | --- | --- | --- |
| 1 | program display — one rep value, loads, one order | **WORKING** | `one-order.yaml` · `test:visible-surfaces` |
| 2 | blocks and exercise selection | **NOT WALKED** | — |
| 3 | athlete exercise actions — ordinary substitution, own load | **WORKING** | `swap-load.yaml` · `test:visible-surfaces` |
| 3 | exclusion scopes, restore, pinning, Undo | **NOT WALKED** | — |
| 4 | readiness — less work, load held, told why | **WORKING** | `readiness-holds-load.yaml` |
| 5 | extra-session offer | **NOT WALKED** | — |
| 6 | temporary equipment entered and scoped | **WORKING** | `equipment-today.yaml` |
| 6 | every visible exercise legal for the day's kit | **BROKEN — finding 4** | the app's own requirement reader |
| 7 | refusal names its athlete-facing reason | **NOT WALKED** | — |

**THE ONE NAMED BLOCKER, if this stops here: FINDING 4.** Everything else
measured is either working with a guard, or honestly unwalked.

## ⚠ THE EQUIPMENT DEFECT IS FULLY DIAGNOSED AND DELIBERATELY NOT HALF-BUILT

Sam ordered: *"Fix the today-only equipment defect at the effective-kit/
substitution owner—no exercise-name patch. No visible row may require removed
equipment; use a typed gap if no legal replacement exists."*

**THE ANSWER IS THAT THERE IS NO EFFECTIVE-KIT OWNER TO FIX IT AT. That is the
defect.** Traced to the line, measured, and stopped there rather than guessed at.

### THE MECHANISM, END TO END

**1. Both barbell rows ARE correctly identified and replaced.** Measured through
the app's own reader (`deriveSessionEquipmentRequirements`) on this exact day:

```
PER-ROW equipmentRequired (the DATA source, not a name probe):
  Back Squat         ["Barbell","Rack"]
  RDLs               ["Barbell"]
  Cossack Squat      []
  Single-Leg RDL     []
  Band Pallof Press  []

REQUIREMENTS, and which rows each is charged to:
  tag:barbell   <- Back Squat, RDLs      <- BOTH. RDLs is not missed.
  tag:dumbbells <- Single-Leg RDL
  tag:rack      <- Back Squat
```

So `buildSessionEquipmentReplacementPlan` replaces **Back Squat AND RDLs** —
`affectedKeys` is built from `requirement.exerciseKeys` and RDLs is in it. **My
earlier reading that the plan "left a row it should have taken" was WRONG and is
corrected here.**

**2. THE ROW IS PUT BACK AFTERWARDS, BY THE POST-MUTATION FINALISER.**
`workoutCanonicalisation.finaliseWorkoutAfterMutation:895` — when an intended
main pattern is no longer represented, it restores one:

```ts
const restored = matchingReferenceRow(context.referenceWorkout, pattern) ??
  fallbackPatternRow(workout, pattern, …);
```

`referenceWorkout` is *"the ORIGINAL allocated workout"*. Replacing RDLs removed
the day's **hinge**, so the finaliser restored the hinge **from the original
day — which is RDLs, the barbell one.** It consults no equipment whatsoever.
That is why `Cossack Squat` also vanished (budget) and `RDLs` reappeared.

**This file's own `composed` clause already names the shape:** *"a restore pass
adding a row it deliberately left out would put back exactly the kit-illegal work
R-083 removes."* True of composed days; equally true here, and nothing said so.

**3. AND THE REASON IT CANNOT SIMPLY BE TOLD: THE UNTICK IS NEVER RECORDED.**
`DayWorkoutScreenV2`'s apply handler emits a **loop of `swap_exercise` actions
and nothing else**. `missingKeys` is `useState` — screen-local, gone on unmount.
**"I have no barbell today" is not a fact anywhere in this app.** So:

- nothing downstream of the swap can know the barbell is gone — not the
  finaliser, not generation, not a later re-derivation;
- the removal cannot expire on return, because it never began;
- and the mission's own clause *"temporary equipment expires on return"* has
  nothing to expire.

### WHAT I BUILT, MEASURED, AND THEN REVERTED — ON PURPOSE

The reader half is straightforward and I wrote it: a typed
`unavailableEquipmentTags?: readonly EquipmentTag[]` on
`WorkoutCanonicalisationContext`, with the restore pass asking BOTH candidates
(reference row, then fallback) and taking the first LEGAL one, refusing entirely
when neither is legal — using `equipmentTagsForRequirement`, **the same
translator the sheet itself uses, so no exercise-name patch anywhere.**

**IT IS REVERTED BECAUSE IT HAS A READER AND NO WRITER**, which is the exact
trap `CLAUDE.md` names: *"EVERY NEW DOMAIN FIELD NAMES ITS WRITER, ITS READER AND
ITS BEHAVIOURAL TEST, IN THE SAME TASK. A field with no reader is not half-built,
it is dead weight that later code will trust. `canOverride` was written nine
times and read zero."* Mine would have been the mirror image, and inert.

**AND THE TYPED GAP HAS A SECOND, REAL OBSTACLE, STATED SO IT IS NOT RE-BOUGHT.**
`ComposedGap` is keyed on a `SessionSlot`; four of the six `MainStrengthPattern`
values map to one by name, but **`push` and `pull` do not — a slot carries a
PLANE (`horizontal_push` / `vertical_push`) that a pattern does not.** Choosing a
plane there would be inventing programming policy to satisfy a disclosure, and
guessing wrong tells the athlete their vertical press is missing when their
horizontal press is. The disclosure needs that mapping ruled, not invented.

### THE UNIT THIS ACTUALLY IS

**A day-scoped, typed, dated equipment fact with one owner** — written when the
athlete unticks kit, read by the substitution owner AND the post-mutation
finaliser AND generation, expiring on its own date. The app already has the
shape for it (`temporarySourceFacts` is exactly this kind of input and is already
persisted and already expires). **That is the fix; it is a unit, not a patch**,
and it is the only version that satisfies all three of Sam's clauses — no illegal
visible row, a typed gap when nothing legal exists, and permanent equipment and
future rotation untouched.

**PERMANENT EQUIPMENT AND FUTURE ROTATION ARE UNTOUCHED TODAY** — verified on
glass: the receipt says *"for this session only"*, the sheet says *"Permanent
change? Update your equipment in Profile"*, and nothing writes the profile. That
half of the clause already holds.

# ═══════════════════════════════════════════════════════════════════════════
# SESSION 3 — 2026-08-18. THE CANONICAL EQUIPMENT FACT, AND FINDING 4 WAS
# ATTRIBUTED TO THE WRONG OWNER
# ═══════════════════════════════════════════════════════════════════════════

Sam's order: PART 1 a canonical session-equipment fact; PART 2 a constrained
strength fallback ladder; PART 3 real UI acceptance; PART 4 finish the
visibility pass. CAP 4. **This is session 1 of that cap.**

## ⚠ THE CORRECTION THAT DECIDED THE WHOLE SESSION

**Session 2 attributed Finding 4 — *"the day still requires the barbell the
athlete just said they have not got"* — to `finaliseWorkoutAfterMutation`'s
restore pass putting `RDLs` back from the original day. THAT ATTRIBUTION IS
WRONG, and the reverted `unavailableEquipmentTags` plumbing it justified is not
needed.**

Sam's authored sheet is not flat:

```
RDLs   ->  [["barbell", "dumbbells"]]      <- barbell OR dumbbells
```

`exerciseAllowedByEquipment('RDLs', kitWithoutBarbell)` answers **`true`**. The
restore pass was returning a **LEGAL** row. **The reader that called it illegal
was the sheet's own** — `deriveSessionEquipmentRequirements` flat-maps each
row's display `equipmentRequired` labels onto tags, turning that OR into an AND.
So the sheet charged `RDLs` as affected, swapped out a lift the athlete could
still do, and then re-derived the same requirement afterwards and reported the
barbell still needed. **The app disagreeing with itself was two readers of one
row, not a restore authority.**

**I did not take the previous session's diagnosis on trust, and this is why the
first thing built was an instrument rather than a fix.**

## THE INSTRUMENT — headless, through the real doors

A probe on `support/athleteJourney` (`coldStartThroughOnboarding` ->
`resolvedDays` -> `walkProgramControlDoor`) driving the session-equipment
sheet's own inputs: the raw rows, `deriveSessionEquipmentRequirements`,
`buildSessionEquipmentReplacementPlan`, then the executor loop. **Deleted after
use** — its findings are cells now (below).

**IT REPRODUCED FINDING 4 ON THE FIRST RUN**, on `2026-07-15`, and found two
defects session 2 had not seen:

```
BEFORE   1 RDLs 80  2 Bulgarian Split Squats 25  3 Landmine Press 35
         4 Barbell Row 72.5  5 Banded Dead Bug
PLAN     RDLs      -> Glute Bridge                    carried 80    own authority UNSET
         Landmine  -> Half-Kneeling S-A OH Press      carried 35    own authority 20
         BarbellRow-> Inverted Row (Bodyweight)       carried 72.5  own authority UNSET
AFTER    1 Glute Bridge 80 ... 4 Barbell Row 72.5 ... 6 RDLs 80     <- SIX rows
```

1. **EVERY replacement wore the outgoing lift's load.** A `Glute Bridge` at
   **80 kg** and a single-arm overhead press at **35 kg** are not cosmetic.
2. **The third swap FAILED outright** — *"That change didn't go through"* — so a
   barbell row simply survived.
3. **No fact was written anywhere.** `temporarySourceFacts` = 0.

## WHAT LANDED — three owners, no compatibility logic

### 1. THE LOAD RULE HAD A FOURTH COPY, AND IT STILL CARRIED THE DEFECT

`sessionEquipment.replacementExercise` was `baseSuggestion` again, byte for
byte, including `weight: prescription.weight ?? raw?.prescribedWeightKg` — the
exact line `buildSwapSuggestionPayload` was extracted to delete on 2026-08-18.
**The extraction fixed the tap door and left the equipment door holding a
private copy.** It now DELEGATES, and `SessionEquipmentReplacementExercise` is
an ALIAS of `SwapSuggestionPayload` so a field cannot be added to one and not
the other. Measured after: `Single-Arm DB Bench Press` arrives at **30** (its
own estimate), not 82.5; the OHP at **20**, not 35.

### 2. THE SHEET NOW ASKS THE ONE LEGALITY ORACLE

`buildSessionEquipmentReplacementPlan` selects affected rows with
`exerciseAllowedByEquipment` — the same oracle generation and the composer use —
instead of the flat requirement map.

**⚠ AND THE PREDICATE IS "NEWLY BLOCKED", NOT "BLOCKED". My first cut was
wrong and a cell caught it.** `test:session-execution-checklist` went red: an
athlete whose SAVED kit is barbell-without-rack unticked their ROWER, and a
plain legality test swept up `Back Squat` too — already illegal, before this
decision and independently of it. Sam's clause is *"no visible row may require
REMOVED equipment"*; removed means removed by THIS answer. The predicate is the
pair — legal on the kit before, illegal on the kit after. **A pre-existing
illegal row is a real problem and it is not this door's to fix silently while
the athlete is answering about a rowing machine.**

### 3. THE SESSION ANSWER IS WRITTEN DOWN — R-072's default case, at last

New `missing_for_session` decision on `set_equipment_modifier`, scoped
`{kind: 'date'}` so `from === until === the session's own day`. It is **NOT a
fourth scope** — it is scope (2) finally recorded, in the same typed shape as
the other two, through the same transaction. The sheet writes it **before** it
applies anything.

**`kind: 'date'` IS NOT NEW MACHINERY** — it has been in
`TemporarySourceFactScope` all along; the equipment path hard-coded `'week'` and
never reached for it, exactly as the away answer found with `'window'`.

**MEASURED — THE FACT ALONE PRODUCES A FULLY LEGAL DAY:**

```
FACT WRITE ok=true — "the visible program was safely recomposed"
AFTER   1 RDLs 80   2 Bulgarian Split Squats 25
        3 DB Shoulder Press 20   4 Chest Supported Row 30   5 Banded Dead Bug
EVERY VISIBLE ROW LEGAL: true          (asked of exerciseAllowedByEquipment)
EFFECTIVE KIT: profile minus barbell, that date only
ROTATION HISTORY UNCHANGED: true       <- Sam's constraint, held
```

**Each recomposed replacement carries its OWN load (20, 30 — not 35, 72.5).**
The composer was right all along; only the sheet's private path was not.

## MEASURED

| | branch | control `c2aaf313` | instrument |
| --- | --- | --- | --- |
| `test:visible-surfaces` | **19/0** (was 9) | 9/0 | +10 cells, 3 mutations |
| `test:session-execution-checklist` | 71/0 | 71/0 | |
| `test:equipment-scopes` | 24/0 | — | |
| `test:equipment-answer` | 41/0 | — | |
| `test:equipment-vocabulary` | 87/0 | — | |
| `test:away-flow` | 51/0 | — | |
| `test:away-span-ownership` | 8/0 | — | |
| `test:dated-equipment-fact` | 3/0 | — | |
| `test:compile` | **469, 7 pairs** | **469, 7 pairs** | IDENTICAL |
| `test:edge-generation-equipment` | 37/1 | 37/1 | red at base |
| `test:tap-swap-hierarchy` | THROWS | THROWS | red at base |
| `test:program-control-durable` | 19/1 | 19/1 | red at base |

**GAINED 0, LOST 0 on the three reds — each confirmed in the control worktree,
not assumed.**

### MUTATIONS — three, all killed

| # | mutation | result |
| --- | --- | --- |
| M1 | the sheet reads the flat requirement map again | ✅ 2 cells, **the defect verbatim**: `["RDLs","Barbell Row"]` |
| M2 | the equipment door pre-fills the outgoing load again | ✅ `weight=80 (the outgoing row was 80)` |
| M3 | the sheet writes the WEEK fact instead of the session one | ✅ `fact@-1` |

**⚠ AND ONE OF MY OWN CELLS WAS A SOURCE SCAN THAT A COMMENT COULD MOVE.** The
ordering cell matched `'swap_exercise'`, which appears in this handler's own
explanatory comment ABOVE the fact write it explains — so it went red on a tree
that was correct. It matches the code token `type: 'swap_exercise'` now. **A
grep passes on a comment; this one FAILED on one.** Same shape as the
`test:dev-e2e-reset-hydration` scan repaired last session, and this one was mine.

## SAM'S NEW ORDER, 2026-08-18 — THE SELECTED IMPLEMENT. AUDIT DELIVERED, UNIT NOT BUILT

*"Each composed/visible row must identify the actual implement selected for that
session. The athlete must not infer it from availability."* And the load ruling
that bounds it: *"do not split load history by implement … do not build
equipment-specific load-history machinery."*

**THE AUDIT, MEASURED — and the answer is bigger than the question.**

| population | count |
| --- | --- |
| authored exercises carrying an equipment requirement | 132 |
| **explicitly DISJUNCTIVE** (`[["barbell","dumbbells"]]`) | **1** — `RDLs`/`Romanian Deadlift`, two spellings of one exercise |
| strength-pool rows that are LOADABLE and whose NAME states no implement | **46** |
| of those, where **the authored sheet and the load classifier disagree** | **14** |

**THE DISAGREEMENT IS THE REAL FINDING, and it is not ambiguity — it is two
stored answers contradicting each other:**

```
Single-Leg RDL              authored ["barbell"]   load classifier dumbbell
Lat Pulldown                authored ["machine"]   load classifier cable
Single-Arm Lat Pulldown     authored ["machine"]   load classifier cable
Overhead Tricep Extension   authored ["dumbbells"] load classifier cable
Step Ups                    authored ["plyo_box"]  load classifier dumbbell
Tricep Circuit (Dirty 30)   authored ["barbell"]   load classifier dumbbell
  … 8 more
```

`equipmentClassFor` is what `loadEstimation` uses to pick the increment, so
`Single-Leg RDL` is authored BARBELL and **loaded as a DUMBBELL** — which is the
`17.5 kg` the probe printed. **There is no field anywhere that states the
implement actually selected for a session.** Two classifiers each infer one, for
different purposes, and the visible row prints neither.

**AND THE CUE SIDE ALREADY HAS THE EXACT FAILURE SAM ASKED ME TO PROVE CANNOT
HAPPEN.** Cues are keyed by exercise NAME only, with no implement dimension:

```
'RDLs': { primaryCue: 'Push hips back, BAR slides down leg.' }
```

On a day where the athlete has unticked the barbell, `RDLs` correctly STAYS on
the day (it is legal on dumbbells) **and the cue still tells them to slide a bar
down their leg.** That is a cue naming equipment unavailable that day, reachable
today, on the one exercise the authored sheet marks disjunctive.

**NOT BUILT, AND NAMED RATHER THAN HALF-BUILT.** The unit is a typed
`selectedImplement` on the composed row — written by the composer, which is the
only layer that knows the kit; read by the display and by a cue resolver that
takes the implement as a second key. Starting it in the tail of this session
would have produced a field with no reader, which is the trap `CLAUDE.md` names
by name. **Sized for session 2**, together with PART 2's ladder, which needs the
same typed implement/plane metadata.

## WHERE THE MISSION STANDS

| clause | verdict |
| --- | --- |
| PART 1 — canonical session-equipment fact, one owner, expires | **WORKING** — `test:visible-surfaces` [5], M3 |
| PART 1 — read by producers that add/restore work | **WORKING via recompose** — measured: every visible row legal, rotation untouched |
| PART 2 — the fallback ladder | **NOT BUILT** — session 2 |
| PART 3 — real UI acceptance on glass | **NOT WALKED** — session 2/3 |
| PART 4 — block two, offer card, status/restore/Undo, refusal screen | **NOT WALKED** |
| Sam's implement order | **AUDITED, not built** — above |

**NAMED, NOT FIXED — carried to session 2:**

1. **The third swap fails outright** (`Barbell Row -> Inverted Row (Bodyweight)`,
   *"That change didn't go through"*). Reproducible; **cause not established and
   I am not claiming one.**
2. **A recompose renames the session** `Full Body Strength` -> `full_body`.
   Athlete-visible, measured, unattributed.
3. **The legacy swap loop is now the weaker of two paths.** The fact alone gives
   a legal day; the loop is the pre-fact workaround. Sam's boundary says legacy
   that rewrites the current owner is removed rather than wrapped — **but that
   deletion must be proven on glass first**, and no simulator ran this session.

**NO GLASS THIS SESSION.** Everything above is headless through production
doors. `PART 3` is explicit that this is not acceptance, and it is not claimed
as any.

# ═══════════════════════════════════════════════════════════════════════════
# SESSION 4 — 2026-08-18. THE IMPLEMENT OWNER, THE LADDER, AND GLASS
# ═══════════════════════════════════════════════════════════════════════════

Sam's order: implement-and-cue owner FIRST, ladder on top of it, close the
failed swap, then drive it on the simulator and capture screenshots — and
*"ensure the two new ruling-registry rows cite their real guards — WRITTEN alone
is not acceptance."* All four delivered; both rows are now `BUILT`.

## 1. THE SELECTED IMPLEMENT — `src/rules/selectedImplement.ts`

**The audit's finding was that NOTHING stated the implement.** Two classifiers
each inferred one for different purposes and disagreed on 14 of 46 loadable
rows; the visible row printed neither. The owner reads **Sam's authored sheet
first** and the load classifier only where he has not answered — the same
precedence `exerciseAllowedByEquipment` uses, so legality and implement cannot
come apart. An OR-GROUP is resolved **against the effective kit for that date**.

**IT TAKES NO LOAD AND RETURNS NONE, and a cell asserts that** — Sam's ruling
*"do not split load history by implement"* is held in the type, not in a comment.

## 2. THE CUES — SUPPRESSED, NEVER INVENTED

`src/data/cueImplement.ts` records which implement each authored cue assumes; a
cue written for another one is SUPPRESSED and flagged. **`EXERCISE_CUES` is
untouched.** It is equality-gated to Sam's master sheet in both directions,
which is precisely the protection that stops a dumbbell RDL cue being written —
his ruling: *"flag missing authored technique guidance rather than invent
coaching copy."* There is no authored dumbbell RDL cue, so the honest answer is
no cue.

**⚠ THE COVERAGE GATE CAUGHT MY OWN AUDIT.** The table is a hand-kept reading of
the library, so a cell re-runs the implement-word scan over all 176 cues and reds
on any that is unfiled. It immediately found **three I had missed** — my earlier
audit's output was truncated and I had read the tail. Fixed, and the gate is why.

## 3. THE LADDER — AND THE SILENT SWAP IS ATTRIBUTED AND CLOSED

**THE CAUSE OF THE FAILED SWAP, measured:** the door offered
**`Inverted Row (Bodyweight)`**, which Sam's sheet requires `rings_trx` for and
which this athlete has not got. The write door **correctly** refused it, and the
refusal was flattened into the generic *"That change didn't go through."*
**The bug was never the write door — the ladder offered an illegal rung.**

`buildSessionEquipmentReplacementPlan` now WALKS the authored
`SAFE_TRAINING_FALLBACK_TIERS` ladder and takes the first rung LEGAL on the
remaining kit. **No new programming policy: the ORDER is the app's own authored
ladder** (which is Sam's ordering in the app's words, and already applies the
injury hierarchy, so injury legality still outranks it), and the filter is the
same oracle that picks the affected rows. It lands
`Barbell Row -> Single-Arm DB Row` — same pattern, legal, its own load. Rung 6 is
a typed `no_legal_fallback_on_remaining_kit`.

Partial coverage is carried, not absorbed: `fallbackTier` and
`coversOriginalPattern` on every replacement.

## 4. ⚠ AND A SILENT **SUCCESS** THE SIMULATOR FOUND, WHICH NO SUITE COULD

Driving the real sheet exposed a defect my own change had created and every
headless cell was blind to. **Once the fact write landed, the zero-replacement
branch became the COMMON case** — the recompose triggered by the fact has already
rebuilt the day, so the plan computed afterwards has nothing left to replace.
That branch closed the sheet and **said nothing at all.**

Measured on glass: the day WAS correctly rebuilt and the athlete was shown no
confirmation. **A silent success reads exactly like a dead button.** Sam's clause
is about silent failure; the same argument covers this, and it now shows a
receipt naming the scope. **This is the case the mission's own rule exists for —
a suite cannot see a screen that says nothing.**

## 5. ON GLASS — `.maestro/visible/implement-and-cues.yaml`, 20 steps green

Simulator `LFA Explorer 4c8535f`, iOS 26.3, Metro 8091 serving THIS worktree —
**asserted in the flow via `e2e-explorer-launch-resolved-metro-url-…`, never
assumed.**

| screenshot | what it shows |
| --- | --- |
| `r104-before-barbell.png` | `Back Squat 3 × 3 · Barbell 110kg`, `RDLs 3 × 3 · Barbell 90kg` — **the implement is on the row**, and every row has a `Form cues` control |
| `r104-equipment-sheet.png` | the real sheet, barbell about to be unticked |
| `r104-receipt.png` | *"Session equipment updated — saved for this session only … your saved gym setup is unchanged"* |
| `r104-after-dumbbells.png` | `RDLs 3 × 3 · **Dumbbells** 90kg`, `Leg Press · Machine`, `Single-Leg RDL · Bodyweight`. **No `· Barbell` anywhere. And the `Form cues` row is ABSENT on RDLs and present on every other row** |
| `r104-no-bar-cue.png` | the same tree with the sentence asserted gone |

The flow asserts **the sentence** *"Push hips back, bar slides down leg."* is not
visible — not merely an id. **An id can vanish because a row moved.**

**AND THE LOAD IS DELIBERATELY UNCHANGED AT 90kg** across barbell → dumbbells,
which is Sam's ruling, visible in the two screenshots side by side.

**⚠ TWO FLOW-AUTHORING TRAPS PAID, so they are not re-bought:**
1. Maestro does not read shell env — `E2E_METRO_URL` must be `-e`, or the
   argument arrives as the literal string `${E2E_METRO_URL}` and the seed fails
   with a message about the seed rather than about the argument.
2. **Do not wait on `workout-screen` after an awaited apply.** It is "visible" in
   the tree the whole time, behind the sheet, so the assertion races the write.
   Wait on the RECEIPT. And open the accordion with `runFlow: when: notVisible`,
   never `optional: true` — that is the flake this file already recorded once.

## MEASURED

| | branch | control `c2aaf313` |
| --- | --- | --- |
| `test:visible-surfaces` | **35/0** (was 19, was 9 at session 2) | 9/0 |
| `test:compile` | **469, 7 pairs** | **469, 7 pairs** — IDENTICAL |
| `test:ruling-registry` UNENFORCED | 9, same names | 9, same names — UNMOVED |
| `test:authored-cues` · `cue-join` · `session-template` | green · 6/0 · 75/0 | same |
| `test:session-execution-checklist` | 71/0 | 71/0 |
| `test:equipment-scopes` · `equipment-answer` · `away-flow` | 24/0 · 41/0 · 51/0 | same |
| `tap-swap-hierarchy` · `exercise-name-lock` · `day-first-timeline` | red | **red at base — exit codes compared, not assumed** |

**GAINED 0, LOST 0.**

### MUTATIONS — six this session, all killed

| # | mutation | result |
| --- | --- | --- |
| M1 | the sheet reads the flat requirement map again | ✅ the defect verbatim: `["RDLs","Barbell Row"]` |
| M2 | the equipment door pre-fills the outgoing load | ✅ `weight=80` |
| M3 | the sheet writes the WEEK fact, not the session one | ✅ `fact@-1` |
| M4 | the ladder stops filtering by legality | ✅ 2 cells, **`Inverted Row (Bodyweight)` by name** |
| M5 | the cue stops checking the implement | ✅ prints *"bar slides down leg"* |
| M6 | the OR-GROUP ignores the day's kit | ✅ 3 cells, same sentence |

## NAMED, NOT FIXED

1. **`Single-Leg RDL` renders `· Bodyweight` while carrying `20kg`.** Correct by
   both owners separately — Sam ruled it performable unloaded, and the load
   ruling says a load survives an implement change — but the two words sit oddly
   together on one row. **A copy question for Sam, not a wiring one.**
2. **Four authored cues disagree with Sam's own requirement sheet**
   (`Skull Crushers` sheet-dumbbells / cue-"Z bar"; `Z-Press` sheet-barbell /
   cue-"or with dumbbells"; `Inverted Row (Bodyweight)` sheet-`rings_trx` /
   cue-"chest to bar"; `Tib Raises` sheet-none / cue-"Tib bar"). Recorded in
   `cueImplement.ts` as what the CUE says. **Reconciling them would be editing
   his answers; they need his ruling.**
3. **A recompose renames the session** `Full Body Strength` -> `full_body`
   (seen headlessly last session). Athlete-visible, unattributed.
4. **PART 4 is still unwalked** — Block Two screens, the extra-session offer
   card, Today/This block/Until restored + Undo, and a genuine typed refusal
   screen. Untouched this session.

## SAM'S TWO UI CORRECTIONS, 2026-08-18 — BOTH LANDED AND RE-PROVEN ON GLASS

### CORRECTION 1 — the always-on implement label was clutter

*"Remove '· Dumbbells / · Machine / · Bodyweight / · Band' from ordinary
unchanged exercise rows … The selected implement must remain typed internally …
but do not display it by default."*

**The implement is still resolved for EVERY row** — legality, load handling and
the form cues all read it — and it is carried in a 1x1 testID so a flow or a
guard can still ask *"which implement is this row?"* without the athlete reading
a word. Same idiom as the set count and the position beside it.

**The screen only speaks when today differs from the athlete's normal kit.**
`implementFor` resolves the implement TWICE — once on the PERMANENT kit
(`resolveEquipmentCapabilities` with no constraints, which is the permanent
answer by its own docstring) and once on the EFFECTIVE kit — and the notice
renders only where they disagree. **On an ordinary day that is false on every
row and the session renders exactly as it did before any of this landed.**

Copy: `Dumbbells today — no barbell`, one quiet line under the affected row.

**⚠ THE "SWAPPED FROM BACK SQUAT" HALF IS NOT BUILT, and the reason is
provenance, not display.** `ComposedRow.substitutedFor` exists in `composeWeek`
and **does not reach the generated program** (`docs/STATUS_EQUIP.md` records the
same gap). Sam's wording was *"such as"*, so the implement notice is delivered
and this one is named. It is a composer→program plumbing unit.

### CORRECTION 2 — Single-Leg RDL, and it was a DATA defect

*"Single-Leg RDL is legal with dumbbells or a kettlebell … Bodyweight is only the
unloaded regression. If prescribedWeightKg > 0, selectedImplement must never be
bodyweight … Do not patch the visible name."*

Fixed in the canonical metadata, not at the screen:
`"Single-Leg RDL": [['dumbbells', 'kettlebell', 'barbell']]`. **Dumbbells lead,
and the ORDER is the ruling** — an OR-GROUP resolves first-available, so a
dumbbell athlete gets a dumbbell single-leg RDL and **nothing about that row
changes when the barbell goes, so it is owed no notice at all**, which is exactly
what Sam said should happen. It also settles this row's long-standing
sheet-vs-classifier disagreement in the classifier's favour.

`resolveSelectedImplement` now takes an optional `prescribedWeightKg` and will
not answer `bodyweight` for a loaded row on ANY branch. **This is not load
history and keys nothing** — Sam's earlier ruling stands.

## ⚠ TWO DEFECTS OF MY OWN THAT ONLY THE SIMULATOR FOUND

Both were green in the suite and wrong on the device. Recorded because the
pattern is the mission's whole point.

1. **THE GUARD READ A DIFFERENT FIELD FROM THE DISPLAY IT GUARDED.** My
   loaded-never-bodyweight check read `exercise.prescribedWeightKg`; the number
   the athlete sees comes from `formatWeight`, which resolves the athlete's own
   weight OVERRIDE first. So the row shipped **"Bodyweight today" beside 20kg**
   with the guard passing. It asks `formatWeight` now.
2. **A MAESTRO `assertNotVisible` WITH A BARE STRING IS AN EXACT MATCH.**
   `assertNotVisible: "Bodyweight today"` PASSED on a tree showing
   **"Bodyweight today — no barbell"** — the exact string genuinely was absent
   while the defect was on screen. **A cell that can pass because the copy is
   longer than the claim is not asserting the claim.** It is a regex now.

**And one over-broad assertion of mine went red honestly and was corrected, not
weakened:** `assertNotVisible: implement-.*-bodyweight` failed because
`Cossack Squat` carries no load and typing it bodyweight is CORRECT. The claim is
about LOADED rows.

## MEASURED AFTER BOTH CORRECTIONS

| | branch | control `c2aaf313` |
| --- | --- | --- |
| `test:visible-surfaces` | **43/0** | 9/0 |
| `test:compile` | 469, 7 pairs | 469, 7 pairs — IDENTICAL |
| `test:pools` | 473/1 | **473/1 — red at base** |
| `test:edge-generation-equipment` | 37/1 | 37/1 — red at base |
| `equipment-answer` · `equipment-vocabulary` · `exercise-exclusions` · `away-flow` | 41/0 · 87/0 · 52/0 · 51/0 | — |
| `.maestro/visible/implement-and-cues.yaml` | **green on device** | — |

**The final screenshot** (`artifacts/visible/r104-after-dumbbells.png`): a clean
session, **one** notice — `Dumbbells today — no barbell` under `RDLs` — and
**`Single-Leg RDL 3 × 7 · 20kg` carrying no notice and no "Bodyweight" anywhere.**
Form cues collapsed on every row, and absent on `RDLs` because the bar cue does
not fit dumbbells.

## THE FOUR FORM-CUE / EQUIPMENT CONFLICTS — FOR SAM'S RULING

Ordered 2026-08-18: *"print the four form-cue/equipment conflicts as a table …
Do not choose a side or invent coaching wording yet."* **No side is taken and no
wording is proposed as final** — the "recommended correction" column names WHICH
DOCUMENT would move, not what it should say.

| exercise | typed legal equipment (his sheet) | existing cue (his words, verbatim) | recommended correction |
| --- | --- | --- | --- |
| **Skull Crushers** | `['dumbbells']` | *"Lower to the sides of the head, press up, **use straight or Z bar**. Full range, elbows stay in place."* | Either the SHEET gains `barbell` as an alternative (making it `[['dumbbells','barbell']]`, the RDL shape), or the CUE drops the bar clause. **The cue reads like the sheet is incomplete**, not like the cue is wrong. |
| **Z-Press** | `['barbell']` | *"Sit up tall, slight lean back when pressing. Stay tight through midline. **Can be done seated on a bench, or with dumbbells**."* | Same shape, other direction: the SHEET gains `dumbbells` (`[['barbell','dumbbells']]`). The cue already states the alternative, so the sheet is the half that is behind. |
| **Inverted Row (Bodyweight)** | `['rings_trx']` | *"Straight body, **pull chest to bar**. Scale with foot position."* | Two readings and they are not equivalent. Either the sheet gains `pullup_bar` (a bar IS the common setup and the cue says so), or the cue's "bar" is loose wording for the ring handle. **This one materially changes who can be offered the exercise** — it is the row that caused the silent swap failure. |
| **Tib Raises** | `[]` (nothing required) | *"Lean back against wall, lift toes to sky, **can use a Tib bar if you have one**. Controlled reps, full range."* | Lowest stakes: the cue offers optional kit for a bodyweight movement. Either leave it (the requirement of `[]` is correct — the bar is optional), or add an optional-equipment concept the sheet does not currently have. **Probably nothing to do.** |

**HOW THEY BEHAVE TODAY, so the cost of leaving them is known:** all four are
recorded in `src/data/cueImplement.ts` as what the CUE says, so the renderer
suppresses each on any session where the selected implement differs. **None of
them can put wrong setup words in front of an athlete.** The open question is
only whether the sheet is under-stating the legal equipment — which affects what
generation is allowed to OFFER, not what it says.

**⚠ AND THE SWEEP FOUND TWO MORE OF A DIFFERENT KIND, named because they are not
what was asked for and should not be counted as conflicts:** `Dumbbell
Pullovers` and `Side Plank Row` have **no row on the sheet at all**
(`equipmentRequiredFor` returns `null`), so they fall through to the load
classifier. That is MISSING data rather than contradictory data, and it is its
own question.

## THE THREE REMAINING SURFACES — DOORS INVENTORIED, NOT WALKED

**STOPPED HERE DELIBERATELY, AND THIS IS NOT "ran out of time on the last item".**
Reaching any of these on glass needs an athlete driven to a BLOCK BOUNDARY —
several weeks of recorded sessions through the real completion path — which is a
different rig from the one this mission stood up. Half-driving them would produce
exactly the flaky, state-dependent cells this file has already recorded twice.

**THE DOORS, LOCATED AND ADDRESSABLE** (so the next session starts here, not at a
grep):

| surface | id |
| --- | --- |
| Block Two / new-block notice | `home-block-boundary-notice`, `-sentence`, `-dismiss` |
| per-exercise block changes | `home-block-boundary-change-<exerciseName>` |
| weekly commitment choice | `home-weekly-commitment-option-<n>` |
| **extra-session offer** | `home-extra-session-offer`, `-sentence`, `home-extra-session-accept`, `home-extra-session-decline` |
| typed refusal | `home-rollover-refusal` |
| exclusion scope + restore | `explorerTestId.componentDeleteScope(...)` on `DayWorkoutScreenV2` |

All of them live in `src/screens/home/BlockBoundaryCards.tsx` except the last.
`test:athlete-journey` already proves the offer card's RULE headlessly (the
`journey` seat, 40 cells); what is owed is the GLASS half — the athlete reaching
the control and the screen changing.

**⚠ AND ONE OF THEM CARRIES A KNOWN BASELINE RED:** `test:block-two-extra-session`
THROWS at base (recorded in the merge notes for `c2aaf313`). A glass walk of the
offer card should expect to meet that, and it is not this branch's doing.

# ═══════════════════════════════════════════════════════════════════════════
# SESSION 5 — 2026-08-18. THE RULINGS LAND, AND SURFACE 3 IS BLOCKED BY A
# REAL DEFECT THAT IS NOT MINE
# ═══════════════════════════════════════════════════════════════════════════

CAP 3, session 1. Sam: land the equipment rulings first, preserve all completed
branch work, then finish the four unopened screens.

## ✅ THE THREE EQUIPMENT RULINGS — LANDED, GUARDED, MUTATION-PROVEN

In the canonical typed sheet, never a name check.

| ruling | landed as |
| --- | --- |
| Skull Crushers: dumbbells OR barbell | `[['dumbbells','barbell']]` — dumbbells first, so no athlete's current selection moves |
| Z-Press: barbell OR dumbbells | `[['barbell','dumbbells']]` — barbell first, unchanged |
| Inverted Row: a pull-up bar does NOT qualify | **deliberately unchanged** at `['rings_trx']` |
| Tib Raises | untouched |

**Z-PRESS NEEDED SAM'S THIRD CATEGORY AND THE TABLE COULD NOT EXPRESS IT.** Its
cue OFFERS an alternative (*"or with dumbbells"*) rather than assuming an
implement, so it is correct for both. New `CUE_IMPLEMENT_NEUTRAL` holds it, and
that is **not** the same as being absent: absent means *"no implement word, never
looked at"*, a row there means *"names one, was READ, ruled neutral"*. The
coverage gate accepts either so nothing sits in the gap. **My first attempt tried
to auto-classify by counting implement words and would have forced a wrong row
into the table** — no regex can tell *"or with dumbbells"* from *"the dumbbells
should…"*, which is why this is hand-ruled.

**Skull Crushers' cue is the BARBELL variant**, so on a dumbbell selection it is
suppressed and flagged. That is the ruling's outcome and it surfaces that a
dumbbell cue is owed; splitting his sentence would be inventing the copy he
forbade.

`test:visible-surfaces` **49 → 59**. Mutations **M9** (revert Skull Crushers),
**M10** (widen Inverted Row to a pull-up bar — the thing Sam ruled AGAINST) and
**M11** (un-rule Z-Press neutral) each red two cells.

## ✅ RECON: THE EXTRA-SESSION OFFER IS REACHABLE AT THE BOUNDARY

`test:athlete-journey` **58/0** on this branch. The offer producer returns the
real card at the block boundary:

```
{"forBlockNumber":1,"currentSessionsPerWeek":2,"offeredSessionsPerWeek":3,
 "trainingDays":["Monday","Wednesday","Friday"]}
"You've been completing your training consistently and recovering well…"
```

**So the RULE half is proven and the GLASS half is what is owed** — and the world
it needs is now known exactly: a 2-session athlete, a full block of easy
completions, `history.qualifies=true`, `required=8`. **There is no block-boundary
production seed**, so the UI walk needs one built through the seed door. That is
the next unit and it is sized.

## ⚠ SURFACE 3 IS BLOCKED — AND THE BLOCKER IS TWO DOORS DISAGREEING, AT BASE

The flow (`.maestro/visible/exclusion-restore-undo.yaml`) is written and drives
the real controls. It reaches the scope question and stops, because **the app
refuses the removal**:

> **Could not remove exercise** — *"That change didn't go through — nothing on
> your plan changed. Try again, or ask your coach."*

That is the same reason-less `SAFE_REFUSAL_FALLBACK` sentence as the silent swap
failure, on the door Sam's surface 3 is about. Screenshot at
`/Users/samgeurts/.maestro/tests/2026-08-18_151420/`.

**AND THE OTHER DOOR ANSWERS THE OPPOSITE, WHICH IS THE REAL FINDING.** Measured
headlessly through `applyExerciseExclusionDecision` — the exclusion transaction
owner — on this seed's Monday:

```
MONDAY BEFORE: Back Squat, RDLs, Cossack Squat, Single-Leg RDL, Band Pallof Press
  scope=today_only     ok=true   reason=null
  scope=this_block     ok=true   reason=null
  scope=until_changed  ok=true   reason=null
MONDAY AFTER : Back Squat, RDLs, Cossack Squat, Single-Leg RDL, Band Pallof Press
```

**Three successes, and `Back Squat` never leaves the day.** That is Sam's own
clause — *"no successful message without a visible state change"* — failing on
the transaction owner, while the SCREEN's path fails the opposite way by refusing
with no reason.

**⚠ NEITHER IS MINE. THE SAME PROBE ON A CONTROL WORKTREE AT `c2aaf313` PRINTS
THE IDENTICAL FIVE ROWS AND THE IDENTICAL THREE `ok=true` LINES.** Checked before
writing a word of this, because a blocker attributed to my own branch would have
been the wrong thing to hand Sam.

**NOT FIXED, AND DELIBERATELY NOT GUESSED AT.** Whether an exclusion is *supposed*
to leave an already-accepted week alone (and only bind future composition) is a
ruling question, not something to infer from an `ok`. If it is, then the success
message is wrong. If it is not, the transaction is. **Either way surface 3 cannot
be honestly walked until that is settled**, and half-driving it would produce the
flaky cells this file has recorded twice.

## THREE FLOW-AUTHORING TRAPS PAID THIS SESSION

1. **Maestro matches a text node WHOLE.** `assertVisible: "was removed from
   today's session."` never matches, because the node is
   *"Back Squat was removed from today's session."* Wait on the CONTROL instead.
2. **The removal has a CONFIRM step before the scope question.** The first
   version looked for the scope options straight after the delete icon and found
   *"Remove this exercise?"*.
3. **Address a row by its NAME TOKEN, not its position or bare text** —
   `session-strength-position-.*-back-squat` follows the row when it moves.

## MEASURED

| | branch | control `c2aaf313` |
| --- | --- | --- |
| `test:visible-surfaces` | **59/0** | 9/0 |
| `test:athlete-journey` | **58/0** | — |
| `test:compile` | 469, 7 pairs | 469, 7 pairs — IDENTICAL |
| `edge-generation-equipment` · `pools` | 37/1 · 473/1 | same — red at base |
| `ladder-wide` · `slot-coverage` | red | red at base — exit codes compared |
| `authored-cues` · `equipment-answer` · `equipment-vocabulary` · `exercise-exclusions` | green · 41/0 · 87/0 · 52/0 | — |

**GAINED 0, LOST 0.**

## WHAT REMAINS, HONESTLY

| surface | state |
| --- | --- |
| 1. Block Two / new-block | not walked — needs the boundary seed |
| 2. Extra-session offer | rule proven 58/0; **glass needs the boundary seed** |
| 3. Exclusion / restore / Undo | **flow written, BLOCKED by the base defect above** |
| 4. Typed refusal | not walked — and the defect above is an instance of it |

## ⚠ THE REMOVAL DEFECT IS FULLY DIAGNOSED, AND THE FIX COLLIDES WITH §18

Sam ruled the scopes (2026-08-18): all three remove IMMEDIATELY and visibly, the
excluded identity must not be restored inside its scope, the fallback selector
MAY fill the slot, success only after the visible program changes, and a refusal
shows its typed reason.

### THE MECHANISM, TRACED TO THE LINE

```
CORE removeExerciseAtDate      success=true          <- the writer works
AFTER CORE  RDLs, Cossack Squat, Single-Leg RDL, Band Pallof Press, Back Squat
                                                     ^^^^^^^^^^^^ RESTORED, at the END
door remove_exercise  ok=false  "That change didn't go through"
```

**The removal succeeds and `finaliseWorkoutAfterMutation`'s restore pass puts the
SAME lift back**, because taking `Back Squat` out leaves the day without its
squat pattern and the pass restores one from the reference workout — which is
`Back Squat`. The accepted-week transaction then compares before and after, finds
the week unchanged, and reports the athlete's own removal as a failure.

**So both doors have ONE cause.** `applyExerciseExclusionDecision` returning
`ok=true` with nothing moving, and the screen's `remove_exercise` refusing with no
reason, are the same restore undoing the same decision.

### WHAT WAS BUILT, MEASURED, AND THEN REVERTED — ON PURPOSE

A typed `excludedIdentities` on the canonicalisation context, the restore pass
walking candidates and skipping excluded ones, and an INJECTED
`legalIdentityForPattern` resolver supplied by the removal door — the same
`getTapSwapChoices` ladder R-103 walks, so there is one fallback selector with
two callers rather than two implementations. **The selector works**: asked for a
legal alternative to `Back Squat` on this athlete's kit it returns
`Bodyweight Squat`, correctly rejecting `Single-Leg Squat (to Box)` for want of a
plyo box.

**IT IS REVERTED BECAUSE THE WEEK GATE THEN REFUSES:**

```
section18_week_rejected — pattern_restore_failure:strength_patterns:0
"We couldn't safely build your week from your current settings."
```

**§18 requires the squat pattern and does not accept the ladder's regression as
meaningful main content**, so stopping the illegal restore turns a wrong success
into a whole-week refusal. Measured: with the writer removed the tree is
byte-identical to base, so the canonicaliser half alone is behaviour-neutral —
**and a typed field with no writer is exactly the `canOverride` trap `CLAUDE.md`
names, so it is not being committed in that state.**

**THIS IS THE COLLISION R-083's RECEIPT ALREADY RECORDED** — *"R-083 and §18 are
in direct contradiction … and §18 wins by refusing the week"* — reaching a new
victim: the athlete's own removal rather than a kit-blocked pattern. That receipt
says the same thing this one does: **teaching §18 the difference is a change to
safety acceptance behaviour and needs Sam's ruling.**

### THE ONE NAMED BLOCKER

**When an athlete removes their only squat, may the week be accepted without a
squat main lift — or must the fallback (`Bodyweight Squat` here) count as one?**

- If the week may go without it: §18's `required_minimum` learns an
  athlete-removal exemption, and the day honestly shows the pattern gone.
- If the fallback counts: §18's "meaningful main content" test learns to accept a
  ladder regression, which changes what every kit-limited athlete's week accepts.

**Both are safety-acceptance changes. Neither is mine to pick**, and the removal
cannot be made truthful without one of them. Everything else in Sam's removal
ruling — the scopes, the no-restore rule, the selector, the typed refusal — is
built and measured behind this one answer.
