# MERGE RECEIPT — weekly scheduler → main, 2026-08-16, seat `core`

**Merged.** Every branch receipt reproduced on merged main. No stop condition.

---

## 1. HASHES

| what | hash |
| --- | --- |
| mission branch HEAD (`slice-weekly-scheduler`) | **`1878d6b1d7fee0908a264122b648e077db33e670`** |
| main pre-merge | **`0e43fcfdc7fb5fc94fc066584fb6e6718b7db3e0`** |
| rollback tag | **`main-pre-weekly-scheduler-merge`** → `0e43fcfd` |
| merge commit (`--no-ff`) | **`9bf5db7c73f918cca30add752e3d8fc81df781e1`** |

    ROLLBACK IS ONE COMMAND:  git reset --hard main-pre-weekly-scheduler-merge

62 files changed by the merge.

---

## 2. THE SHARED CHECKOUT'S UNCOMMITTED WORK — UNTOUCHED

Backed up with hashes before the merge, verified byte-for-byte after, and **still
uncommitted and modified** — the merge neither swept, staged nor included any of it.

    IDENTICAL  src/__tests__/onboardingAnswerPresentationTests.ts
    IDENTICAL  src/screens/onboarding/PreferredTrainingDaysScreen.tsx
    IDENTICAL  src/screens/onboarding/TrainingCommitmentScreen.tsx
    IDENTICAL  src/screens/onboarding/reviewRows.ts
    IDENTICAL  src/utils/onboardingSteps.ts
    IDENTICAL  docs/BLOCK_TWO_PROGRESSION_CONTRACT_APPROVED_2026-08-16.md

Backup: `scratchpad/premerge-backup/` with `BEFORE.sha256`.

### ⚠ ONE COLLISION, AND IT WAS NOT ONBOARDING WORK

`docs/WEEKLY_PROGRAMMING_SOURCE_REVIEW_2026-08-14.md` was **untracked** in the
shared checkout and **tracked** on the branch, so the merge would not proceed
without resolving it. I diffed them before doing anything:

    shared checkout (untracked)  0d34e288…  430 lines
    branch (tracked)             eb914afa…  430 lines

**The only difference is the two-line G-2 amendment Sam ruled on 2026-08-15**
("should not rule out upper body power") plus its status line. The branch copy is
strictly the later approved one. The older untracked copy was **moved aside, not
deleted** —
`scratchpad/premerge-backup/UNTRACKED-ORIGINAL-WEEKLY_PROGRAMMING_SOURCE_REVIEW_2026-08-14.md`
— and the amended version is now tracked on main.

---

## 3. VERIFICATION ON MERGED MAIN — EVERY RECEIPT REPRODUCED

| receipt | branch | merged main | verdict |
| --- | --- | --- | --- |
| worlds built / refused | 140 / 40 | **140 / 40** | match |
| athlete setups built / refused | 70 / 20 | **70 / 20** | match |
| lost | 0 | **0** | match |
| gained | 0 | **0** | match |
| failing suites | 93 of 414 | **93 of 414** | match |
| newly red on main | — | **0** | match |
| newly green on main | — | **0** | match |
| `cyclic-proximity` cells | 110 | **110** | match |

**Refusal families identical:** 20 `main_strength_planner_selected_target`,
16 `hard_day_permitted_maximum + main_strength_permitted_maximum`,
4 `hard_day_permitted_maximum`.

### The known 124 → 110 coverage reduction is NON-VACUOUS

Confirmed on merged main by mutation, not by inspection — the off-leg intent was
removed from the scheduler and the cells reddened:

    FAIL Sunday game: LOWER + conditioning on Tuesday is typed off_leg
    FAIL Monday game: LOWER + conditioning on Wednesday is typed off_leg
    FAIL Tuesday game: LOWER + conditioning on Thursday is typed off_leg
    FAIL Wednesday game: LOWER + conditioning on Friday is typed off_leg

Restored immediately; 110/110 green. The working tree carries no mutation.

### Mission gates on merged main

    clause-enforcement    136/136 cells     weekly-scheduler    84/84 cells
    cyclic-proximity      110/110 cells     anchor-survival     12/12 cells
    weekday-index          85/85 cells      readiness-dose     105/105 cells
    readiness-structure   100/100 cells     weekly-dose         22/23 cells (1 red)

    test:compile   35 file/scope PAIRS worse, ALL [tests]
                   ZERO product, ZERO devtools

---

## 4. FINAL MAIN STATUS

    HEAD           9bf5db7c  (merge commit)
    working tree   only the shared checkout's own uncommitted onboarding work
    planner        DELETED — `buildCoachingPlan` not exported, unreachable

**Carried forward deliberately, not cleaned in this session as instructed:**

- 93 of 414 failing suites — unchanged from the pre-deletion rollback point;
  every sweep across the whole mission showed 0 newly red.
- 35 test files still referencing deleted planner symbols.
- 20 of 90 athlete setups still refuse: bodyweight-only strength targets and
  off-season ceilings.
- 1 red cell in `weekly-dose-ownership` — *"hard-day maxima are one number"*,
  where the approved source deliberately carries two ("Prefer 4; allow 5").

**Not claimed:** the 140 built weeks are not coach-approved. Sam approved one
strength layout, on the in-season Sunday-fixture world.

Agent: core
