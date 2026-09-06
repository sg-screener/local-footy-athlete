# HANDOFF — seat `variety`, 2026-09-05. Written to be CHECKED, not trusted.

**Branch: `integrate/2026-09-04-morning`. Three commits, all mine, all on top of
`5b9210ad`.** Everything before `5b9210ad` is the previous seat's (R-367 to
R-377) and is not covered here.

```
85f27613  R-379: a seed that empties days, and the wall it found
0dfef003  R-379: the day the app emptied says why, on the day
cb9e4cdb  R-378: the scheduler knows the athlete is hurt, and may only ever remove
```

28 files, +1325 / -239. Working tree is clean apart from `docs/NOW.md`, which was
already modified when I arrived and which I did not touch.

**Verify the diff surface yourself:**

```bash
git log --oneline 5b9210ad..HEAD && git diff --stat 5b9210ad..HEAD
```

---

## 1. WHAT SAM ASKED FOR, AND WHAT THE HANDOFF BEFORE ME ASKED FOR

Sam's brief: *"the scheduler doesn't know when an athlete is injured. Two days
before a game it swaps the day to upper-body work for someone with an injured
shoulder. My rule: fill that day with whatever genuinely fits … and if nothing
fits, it's nothing. Don't pack junk in to fill it up."*

**`docs/STATUS_VARIETY.md`'s handoff asked for the opposite of a live ruling, and
that is the first thing to check.** It said to FILL the G-2 day with the authored
quality-lower (High Box Squat 2x3 + Vertical Jump 2x3). **R-095 (Sam,
2026-08-16) cancelled that session** — a Vertical Jump is plyometric and G-2 bars
added lower-body power — and R-095's own registry entry records that its
omit-and-disclose guard never landed and that `injuryAuthorityOwnershipTests`
G2-G4 "still assert the old exception".

I put the conflict to Sam rather than picking. He answered, and that is **R-379**
in `docs/RULINGS_REGISTRY.md`: default is nothing, the one exception is repairing
a genuine week-level gap, and it may be optional.

**Check:** `grep -n "R-095" -A 22 docs/RULINGS_REGISTRY.md`, then the R-378 and
R-379 entries at the end of that file.

---

## 2. COMMIT 1 — `cb9e4cdb`, the actual defect

`WeeklySchedulerInputs` had **no injury field at all**. The reduction ladder's
rung 1 offers `upper` wherever a constrained day may not hold heavy lower, so a
Saturday-game athlete with a paused shoulder was handed **Bench Press and Seated
DB Press two days before the game**.

What landed:

- `compileCanonicalWeek` derives `prohibitedPatterns` for the scheduler from the
  `injury` state it already receives, beside the existing `appSprintPermitted` /
  `appRunningPermitted`. Not at the call sites: `WeeklySchedulerInputs` has TWO
  builders and a fact each must remember is one that will be forgotten.
- **Substitute, then drop.** An impossible session is first swapped for a safe
  purpose still legal in place (same day, same count); only when nothing fits is
  the day left empty.
- **Applied AFTER the ladder, never inside it.** ⚠ **The first version enforced
  it during the search and that made an injury ADD work** — a candidate ruled out
  mid-search sends the ladder down a rung, and a reduced rung is the authored
  SMALLER structure, so three split days become two full-body days. Measured: a
  day went 12 sets to 20, and another 0 to 12. `WC-064` is `enforcedElsewhere`
  for that reason. **`test:injury-recomposition` is the cell that caught it and
  is the one to re-run if you touch this.**
- An **empty `activeConstraints` array is truthy**, so the row compiler was
  discarding the resolved `generationConstraints` and the injury reached
  generation as no prohibition at all.
- Two duplicate purpose-to-pattern tables folded into one owner; two unguarded
  `.join`s on `injury.triggers` guarded.

---

## 3. COMMIT 2 — `0dfef003`, the athlete-facing half (R-379)

Sam: *"put it on the day … it should replace fresh up, adapt go again - when it's
needed"* and *"it should not include any fuckign M dashes"*.

`rules/restDayReason.ts` owns a typed reason and its signed-copy ids. Scheduler
states which days it emptied → compiler stores it beside `dosePolicyByDay` →
Program tab's one day-builder attaches it → the rest card renders it INSTEAD of
the standing line. Ordinary rest days are untouched.

**Sam approved the five sentences on sight** (*"they'll do"*) and said he would
correct them once he saw them on a device. **He has not seen them.** See §5.

---

## 4. COMMIT 3 — `85f27613`, the seed Sam asked for

`empty-day-reason-showcase`: four gym days, zero club nights, both regions in the
pause band. Tuesday and Thursday come back as **Rest Day**, which nothing else in
the app could reach. It generates WITH its constraints, unlike every other seed.

Also widened, because the harness could not express the world: the seed's injury
item was one hard-coded lower-body moderate episode, and
`devE2ESeedTestSupport` modelled only the FIRST episode with `.find`. Both now
handle any region, any band, and every episode. Defaults are exactly the old
hard-coded values, so `injury-case` is byte-identical.

```bash
npm run test:dev-e2e-seeds
```

---

## 5. ⚠ THE THING THAT IS NOT DONE, AND MY WRONG DIAGNOSIS OF IT

**The reason line does not appear on the phone.** The empty days appear; the
sentence does not.

**I first told Sam the cause was that the injury door never re-plans the week.
That was WRONG and he caught it.** He said: *"if i am injured on thursday it only
has to replan for the rest of the week - before that the week was already
done"*. He is right, and the app already does exactly that:
`rules/canonicalWeeklySourceFactCompiler.ts` recompiles from `governedFromISO`
forward with `pinnedHistoryWorkouts` behind it, and
`sourceFactRequiresCompilation` returns true for `constraint.type === 'injury'`.

**The real fault is mine and I believe it is small, but it is UNVERIFIED and you
should treat it as a hypothesis, not a finding.** That recompile stores its
result as a `WeekScopedWorkoutOverlay` (`types/domain.ts:1299`). The overlay
carries `workoutsByDate`, `exposureContract` and `exposureContractV2` — **it has
no field for `restDayReasonByDay`**, so the reason is computed and then dropped
at that boundary. The read model
(`utils/visibleProgramReadModel.buildProgramTabProjectedWeek`) reads the
microcycle, never the overlay.

**Suggested fix, untested:** carry `restDayReasonByDay` on the overlay the same
way `exposureContract` already is, and have the read model prefer the overlay's
value for that week. **Verify the hypothesis before building it.**

**What IS proven, both sides of that gap:**

- `buildDevE2ESeed('empty-day-reason-showcase')` produces a stored week whose
  `restDayReasonByDay` is `{4: 'injury'}`.
- feeding that week to `buildProgramTabProjectedWeek` gives day 4 its
  `restReason`, so the card would render the sentence.

Both were measured with throwaway probes, not with a committed cell. **There is
no regression test for the end-to-end device path, and that is the gap.**

---

## 6. HOW TO CHECK ME

Sam's instruments, in the order they actually caught things:

```bash
npm run year:diff
```

Shows what a change did to a real athlete's year. **My final `year:diff` says
"nothing changed", and that is EXPECTED here rather than a pass**: it counts rows
and day types, and R-379 adds neither. The R-378 change did move it, and
`docs/YEAR_BASELINE.json` was updated in `cb9e4cdb` with that diff: one
conditioning quality swapped, total rows unchanged. **If you disagree with that
baseline update, revert it and re-measure.**

```bash
npm run test:compile
npm run test:injury-authority      # 26/26
npm run test:injury-recomposition  # 186/186 — the cell that caught the set inflation
npm run test:rest-day-reason       # 19/19 — new
npm run test:dev-e2e-seeds         # 109/109
npm run test:compiler-year         # 416/416, 0 failure keys
```

Writer census is 0 unresolved / 1170; I re-reviewed 12 owners across the three
commits, and **those reviews are my words and are worth reading sceptically**:

```bash
node -e "const fs=require('fs');const{scanSources}=require('./scripts/weekly-writer-census.js');const r=scanSources({registry:JSON.parse(fs.readFileSync('scripts/weekly-writer-ownership.json','utf8'))});console.log(r.unresolvedOwners, r.ok)"
```

### Pre-existing reds, each CONTROLLED at HEAD in an isolated worktree

Not mine, and each failed identically at `5b9210ad`:

- `test:release` stops on 4 in the canonical weekly compiler slice —
  `unilateral/{male,female}/{no-rack,no-barbell}: required bilateral squat
  coverage stays honestly bilateral`. Control at HEAD: 10616 passed, 4 failed,
  the same four.
- `test:copy-rulings-binding` 7/2, two unrelated strings. Same at HEAD.
- `test:visible-surfaces` 1 red (Pigeon Stretch cue), `test:session-template` 1
  red (numeric index). Both already recorded in `docs/STATUS_VARIETY.md`.

The control method, per this repo's law: a separate `git worktree` at HEAD with
`node_modules` symlinked. **Never `git stash`** — this is a shared checkout.

---

## 7. JUDGEMENT CALLS I MADE THAT YOU MAY WANT TO REVERSE

1. **I rebased `injuryAuthorityOwnershipTests` G2, G3, G4 and G7** from asserting
   the cancelled quality-lower to asserting omit-and-disclose. That is four cells
   whose meaning I inverted on the strength of R-095 plus Sam's answer. If you
   think R-095 does not say what I think it says, start there.
2. **I widened G7's exposure assertion from `===` to "no shortfall".** After
   R-378 that world over-delivers: the seeded week's days are already spent
   (3 sessions done) while re-deriving under the injury lowers the forward target
   to 1. I judged the cell's subject to be "no husk", not equality. **The
   spent-week question is not settled by that line and I did not settle it.**
3. **I removed the athlete-facing Coach Note assertion in G7** and replaced it
   with one that pins the CANCELLED sentence must never ship. The note kind it
   asserted, `injury_game_proximity`, exists in `types/domain` and in that
   assertion and **nowhere else in product code** — a note kind with no writer.
   The disclosure half of R-095 is therefore still owed.
4. **I updated `docs/YEAR_BASELINE.json`.** See §6.

---

## 8. STILL OWED

- **The reason line on the device.** §5.
- **The disclosure half of R-095** — the athlete is owed a reason their day is
  empty. Sam's five sentences exist and are signed; the note kind that would
  carry them into the modifiers list has no writer.
- **`I6` remains quarantined**: the injury path validates the existing base
  rather than re-authoring it, which is why a shoulder-injured athlete can still
  be shown pressing work in the week he is already in. **Note that this is NOT
  the same thing as "the week is never re-planned" — see §5 for my error there.**
