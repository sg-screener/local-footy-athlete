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
