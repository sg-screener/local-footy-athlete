# OVERNIGHT HANDOVER — 2026-08-06

Written at a clean stop, per the overnight rule. **Totals-or-red applies to
this document: what is not listed as done is not done.**

## Branch state — read this first

| branch | head | state |
|---|---|---|
| `feat/stage-b-stage2` | `17022bac` | **GREEN.** Last full-chain-verified code commit is `d41c0499`; `17022bac` on top is the ruling doc only. |
| `fix/1a-club-season-scope` | `38f89555` | **UNMERGED, ONE WALKER RED.** Holds 1a + the D13 payment. |

`feat/stage-b-stage2` was never left red. Everything unfinished is on the
scratch branch.

## Done this session, on the green branch

- **`17022bac`** — `docs/FLUSH_OFFER_RULING_2026-08-05.md`, committed as
  authored.

## Done on the scratch branch (not merged)

**`fc4919a5` — 1a, club season phase-scoped at derivation.** New rule
`src/rules/clubSeasonScope.ts` (Bible `:107`/`:108`/`:1289`), applied at the
single engine-input boundary `onboardingToCoachingInputs`. Both
`teamTrainingDays` and `teamTrainingDaysPerWeek` come from the scoped set.
`phaseStructureConformanceTests` — 6 cells, its own four green: off-season
derives no team training, the stored answer is byte-identical across the shift,
pre-season restores the club fact by itself, and early off-season stays
all-optional (`:110`, a CONTROL that must not move).

**`38f89555` — the D13 composition payment, two thirds of it.**

- `buildSessionTemplate` is driven by the day's PARTS, not by two workoutType
  predicates. `isCombinedDay` deleted. Pays
  `session_list_drops_conditioning_attached_to_an_appointment`.
- `utils/composedOptionalMarker.ts` — one owner for "the marker dies where the
  day gains conditioning", used by the engine's attach spread and both
  `cloneWorkout` helpers. Pays
  `composed_optional_marker_survives_a_stacked_combination`.
- **Both declared-red entries deleted, and the payment is verified rather than
  assumed:** the walker's stale-debt failure ("declared red no longer reds") is
  gone from the run.

## THE ONE THING BLOCKING THE MERGE

The deep walker still reports:

```
SEED 3 — L-P6 CHARTER TYPE NAMES ITSELF
2026-10-14: a typed gunshow session renders ["Gunshow","Conditioning"]
  — ruling 7-e says exactly ["Gunshow"]
```

A further site attaches a conditioning part to a gunshow-marked day by a route
neither the engine spread (`plan[i] = { ...s, … }`) nor `cloneWorkout` covers.
**Next step: find it and route it through `composedOptionalMarker`** — the two
owners already fixed are the pattern to match. Candidate routes not yet
eliminated: `sessionBuilder`'s composition, and any attach that reaches the day
as an attached activity rather than a workout patch.

Running the deep walker takes ~12-15 minutes; budget for it.

## 1b — implemented, then REVERTED deliberately

Not shipped, and the reason is worth reading before anyone re-attempts it:
`docs/PARKED_QUESTIONS/1B_FLUSH_OFFER_THRESHOLD_IS_INERT_2026-08-05.md`.

**The threshold Sam's ruling supersedes does nothing.**
`optionalFlush.min` is not read by any enforcement path — only `.max` is
(`permitted: max > 0`, and the placement cap). Flipping `min: 0 → 1` changes no
derived week.

The behaviour lives in the placement pass at `coachingEngine` ~6987, which can
only **demote** an existing conditioning candidate to `optional_flush`. In an
in-season game week the core target is already met by 2 team trainings + the
game (`:127`), so nothing is left to demote and nothing is offered.

An offer pass was written against that seam and **did not take effect** — the
suite stayed red — which most likely means the in-season week is composed by a
different pass than the one edited. That was not chased further on a shrinking
context; both edits were reverted so no dead engine code ships. The two 1b
cells remain DECLARED reds in `phaseStructureConformanceTests`, so the ratchet
will force their deletion the day they are paid.

## Not started

- **Finding 3** — injury substitute-before-reduce (`:4688`, `:4755`, `:1917`).
  Citations and the measured before/after are in
  `docs/R3_DOOR_PASS_FINDINGS_BIBLE_MEASUREMENT_2026-08-06.md`.
- **R5** — deletion, census closures, structural sweep. Sam's combined device
  pass is its gate and was correctly not started.

## Suggested resume order

1. Find the third marker-leaking site; walker green; **merge
   `fix/1a-club-season-scope` into `feat/stage-b-stage2`** (1a + D13 land
   together — they are entangled and the walker only reds with both).
2. 1b, starting from the parked doc: identify which pass actually composes the
   in-season week before writing another offer pass.
3. Finding 3.
4. R5, stopping at the combined pass.

## Standing gates

Full `npm run test:bible` EXIT 0 before every commit — run it bare in the
background and read the true exit line. `git branch --show-current` before
every commit; the tree is shared and an unrelated `docs/PUBLISH_ROADMAP_2026-08-05.md`
is sitting untracked in it (not this terminal's, deliberately not committed).
A declared red that stops redding owes its entry's deletion in the greening
commit.
