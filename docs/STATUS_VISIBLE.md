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
