# Non-bible `test:*` rot sweep — 2026-07-29

Read-only inventory. Triggered by `profileResetUITests` being found dead: it had
thrown `ENOENT` at module scope since the Phase 1.6 purge (`2df5165`) deleted
`EquipmentSettingsScreen.tsx`, which it read at load. It asserted nothing for
weeks, and nothing noticed because it was not in `test:bible`.

Sam's call: sweep every non-bible `test:*` script for the same rot, because a
suite that throws on load and reports nothing is worse than no suite.

## Method

231 `test:*` scripts exist. 74 are reached by `test:bible`. The remaining 157
were swept; `test:bible:extended` and `test:bible:report` were excluded and
handled separately (they are nested aggregate runners that re-invoke `npm` for
whole gate chains and hit their own internal `spawnSync` timeout under a
sandboxed budget — slow meta-runners, not rot). **155 scripts were run.**

Classification, by the thing that actually matters:

| verdict | meaning |
| --- | --- |
| `LOAD_CRASH` | non-zero exit **and no pass/fail marker anywhere in the output** — the suite reported nothing |
| `assert_fail` | non-zero exit but the suite ran and reported |
| `pass` | exit 0 |

A static scan ran first, looking for literal `path.resolve`/`path.join` file
targets in `src/__tests__/**` that no longer exist on disk. It predicted three
of the nine crashes exactly, and is the cheapest recurring check.

Two harness bugs were found and fixed before the numbers below were trusted:
macOS has no `timeout(1)` (the first run reported 156/157 "crashes" that were
all exit 127), and bash 3.2 has no `mapfile` (the second run produced an empty
result set). Both produced confident, wrong output.

## Result

**155 run — 97 pass, 49 assert_fail, 9 LOAD_CRASH.**

All 9 crashes reproduce **identically on clean `main`** (verified in a separate
worktree). None are caused by `fix/phase-ownership-collapse`.

### The 9 silent suites, by root cause

**A. Module-scope read of a deleted file** — the exact `profileResetUITests`
failure mode. Cheapest to fix, and the class the static scan catches.

| script | missing file |
| --- | --- |
| `test:coach-note-display` | `screens/home/TodayWorkoutCard.tsx`, `screens/home/WeekViewCard.tsx`, `components/ReadinessQuickCheck.tsx` |
| `test:coach-update-card-ui` | `components/CoachUpdateCard.tsx` |
| `test:session-logging-ui` | `components/PowerPrimerSection.tsx` |

**B. Fixtures left behind by the Section 9 capacity ruling** — `scoreCapacity`
now THROWS `MissingCapacityAnswerError` when `recentTrainingLoad` and
`conditioningLevel` are absent ("there is no default and no unknown tier").
That throw was the point of the ruling; these five suites still build profiles
without those answers, so they die on the first assertion.

- `test:injury-episode-commands`
- `test:coach-orchestration`
- `test:coach-live-wiring`
- `test:coach-live-path-v2`
- `test:tap-swap-hierarchy`

These are the most valuable to recover: five coach/injury integration suites,
dark since the readiness work, all fixable by adding two fixture fields.

**C. Renamed or removed export**

- `test:strength-progression-integration` — `classifyExerciseRole is not a function`

### The 49 `assert_fail` suites

A different and lower-priority class: they run and report, so they are visible
reds rather than silent ones. Not investigated here. Includes `test:qa` (2
known pre-existing findings, byte-identical on `main`). Full list in the sweep
artefacts.

## Recommendation

1. Fix **B** first — five integration suites, two fixture fields each, highest
   value recovered per unit of work.
2. Then **A** — delete the assertions about deleted files, as was done for
   `profileResetUITests`.
3. Then **C**.
4. **Gate what is repaired.** Every suite fixed here should join `test:bible`
   in the same commit, or it will rot again exactly as these did.
5. Add the static scan as a standing check. A test that reads a source file by
   literal path is coupled to that file continuing to exist, and purges are
   routine in this repo.

Nothing in this document has been fixed. It is an inventory.
