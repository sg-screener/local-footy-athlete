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
