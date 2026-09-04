# STATUS — seat `variety`

Opened 2026-09-04. Owner of Sam's main-lift variety programme, approved that
morning off the root-cause report in this file's first section.

**Branch:** `integrate/2026-09-04-morning`.
**Nobody else writes this file.**

---

## THE APPROVED PLAN, IN SAM'S ORDER (2026-09-04)

He reordered my proposed order himself. The order below is HIS, verbatim in
intent, and the slices are worked in it:

1. **Fix the role-label source of truth.** ← SLICE 1, this file's first entry
2. **Grade eligible mains A/B/none.**
3. **Build the two-or-three-at-a-time rotation rule.**
4. **Then unglue the four tracked lifts.**
5. **Add Bulgarian split squat separately.**
6. **Weight tracking last.**

**Why HIS order is better than mine and it is worth writing down.** I proposed
ungluing the four lifts second. He moved it to fourth, behind grading and the
stagger. That is correct and I had it wrong: ungluing first would have put all
six main seats into rotation with no grade filter and no stagger, so every seat
would have rotated on the same block boundary and could have promoted
`Glute Bridge` or `Incline Push-Up` into a main seat. **The pins are load-bearing
scaffolding until the things that replace them exist.**

### His three ruling answers, same conversation

- **Unglue the four tracked lifts — YES.**
- **RDLs rotate in-season — YES, but only at block boundaries.** (Rotation is
  already block-boundary-only, so this is a constraint on the implementation,
  not a new cadence: whatever replaces `phasePinsSlot` may not move a lift
  mid-block.)
- **Bulgarian split squat as a real squat main — YES, but separately, later.**
- **On weight tracking, deferring it is safe because:** *"it doesn't matter if a
  lift isn't tracked for 4 weeks, it will just update the next time it is."*

---

## SLICE 1 — THE MAIN-LIFT BADGE IS THE COMPOSER'S DECISION

### The defect, measured before any change

Driver: `scripts/run-programming-selection-trace-year.cjs`, full 52 weeks, male
athlete, 13,335 typed selection traces.

| measurement | value |
| --- | --- |
| `lower_squat` days shipping **no `main_lift` row at all** | **14 of 14** |
| squat main-seat decisions the composer actually made | **406 of 406** (`Leg Press`) |
| reason recorded for those decisions | `single_legal_candidate` |

The composer chose a main lift for the squat seat every single week. The athlete
never saw one.

### Root cause

`utils/sessionRoles.ts` `classifyExerciseRole` answered from **which array the
name sits in** — `STRENGTH_POOLS[slot].anchor.entries` vs `.accessory.entries`:

```ts
const slot = classifyPoolSlot(canonical);
if (slot?.role === 'anchor') return 'main_lift';
```

That is a property of the EXERCISE. The badge is a property of the SEAT IT
FILLED. `Leg Press` lives on the accessory bench and filled the squat main seat,
so the glass called it accessory work.

**R-092 had already settled the ownership** — *"the composer DECIDES the role;
§18 reads this rather than re-inferring it from the exercise name"* — and both
row producers have been writing `section18Evidence.role` all along:

- `rules/materialiseComposedWeek.ts:141` for composed days;
- `data/defaultProgram.ts:2388` (`ex.composedRole`) for the retained adapter.

**Nothing was missing. The screen was simply a second authority and it won**,
because `utils/sessionTemplate.ts` fell straight from `row?.role` to the name
classifier and never looked at the evidence sitting on the row.

### The change

One resolver, `sessionRoleForRow(row, rawName)` in `utils/sessionRoles.ts`:

- `section18Evidence.role === 'main_strength'` → `main_lift`;
- `=== 'strength_accessory'` → the name classifier, but its `main_lift` answer
  is suppressed (this closes the INVERSE leak: an anchor name such as
  `Barbell Row` sitting in a second-pull supporting seat no longer wears the
  main-lift badge);
- no evidence → the name classifier, unchanged.

Two readers now call it:

- `utils/sessionTemplate.ts` — the one owner every screen builds its list from,
  and the one the preserved year driver reads (`item.role`), so the app and the
  annual evidence move together.
- `rules/mainLiftPatternLaw.ts` `isMainLift` — R-070's *"one main per pattern"*
  reader. Left on the bare name classifier it would have disagreed with the
  glass: blind to a real second main off the accessory bench, and able to flag a
  supporting `Barbell Row` that is not one.

**`classifyExerciseRole` is NOT deleted and that is deliberate.** Athlete
additions and legacy stored weeks carry no evidence; for them the pool lookup is
still the honest answer. What it may no longer do is overrule a decided row.

### The precedent this follows rather than invents

`rules/deloadWeekRules.ts:387-401` already reads `section18Evidence.role` first
and falls back to the pool registry — same fact, same precedence, ruled earlier
for the same reason (two readers of one row disagreeing). Slice 1 makes the
screen agree with a rule the app already had.

**KNOWN DUPLICATION, NOT PAID OFF HERE.** `deloadWeekRules` keeps its own inline
copy of that precedence because its fallback resolves aliases with
`resolveExerciseName` rather than `canonicalExerciseName`, and its own comment
records the defect that alias handling was written to fix. Folding it into the
shared resolver is a second behaviour change and does not belong in this slice.
**Next convergence, named here so it is not lost.**

### Guard

`test:visible-surfaces` section **[12]**, both directions, driving the real
materialiser and the real session-template owner:

- a main lift off the accessory bench badges Main Lift;
- an anchor name in a supporting seat does NOT;
- the squat day the athlete opens carries a visible main lift.

Born RED on both directional cells, for the stated reasons, before the fix.

### Gates

| gate | before (HEAD control) | after |
| --- | --- | --- |
| `test:compile` | 0 errors | **0 errors** |
| `test:visible-surfaces` | 69 passed / 1 failed | **76 passed / 1 failed** |
| `test:main-lift-pattern` | — | **23/23** |
| `test:slot-coverage` | — | **92/92** |
| `test:row-counting` | — | **45/45** |
| `test:session-template` | 87 / **1** | 87 / **1** (same cell) |
| `test:role-buckets` | 53 / **1** | 53 / **1** (same cell) |

**PRE-EXISTING REDS ON THIS BRANCH, CONTROLLED AT HEAD AND NOT MINE.** Each was
re-run with all four of my files restored to `HEAD` and failed identically:

- `test:visible-surfaces` — *"Pigeon Stretch: bodyweight row keeps its cue when
  the required bench exists"*
- `test:session-template` — *"the numeric index is back in the row header"*
- `test:role-buckets` — *"screen title is Sam's approved position copy"*
- `test:session-execution-checklist` — five cells refusing with *"Fixture
  mutation requires an accepted profile and program"*

**The control was taken by backing my four files up to scratchpad and
`git checkout HEAD -- <the four paths>`, never `git stash`** — this is a shared
checkout and a whole-tree write would have taken another seat's work with it.

---

## STATUS WORDS

- **WORKING** — the composer's main-lift decision reaches the athlete's session
  list, and an anchor-named supporting row no longer claims the badge. Breaks
  `test:visible-surfaces` [12] if it regresses.
- **NOT YET STARTED** — slices 2 through 6.
