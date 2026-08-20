# STATUS — seat `addflow`

**One task, stated by Sam on 2026-08-20:** replace the Active Session Add
action's random flat list with the approved hierarchy — Strength / Conditioning
/ Mobility-Warm-up, then a relevant subcategory, then the legal final choices —
and *"never show athletes a mixed internal list containing options like
'Breathing reset'."*

Branch `feat/add-flow-hierarchy`, worktree
`.../9ec1b203-.../scratchpad/wt-addflow`, cut from `main` at `c12a058c`.
Control worktree at the same commit: `.../scratchpad/wt-control`.

Ruling recorded as **R-120**. Nothing else was touched: the five-action hub, the
shared-bottom-sheet work, Injury, programming, QA sweep and demolition are all
untouched by this branch.

## THE BEFORE, MEASURED TWICE

**Headless** (full-kit off-season athlete, `test:exercise-add-candidates` case
[1] on `main`): Add returned **23 groups** —

```
Lower squat:6, Lower hinge:6, Upper push horizontal:6, Upper push vertical:6,
Upper pull horizontal:6, Upper pull vertical:6, Lower plyometric:5, Carries:4,
Accessories upper:6, Accessories lower:6, Arms — biceps:1, Groin / adductors:5,
Calves:2, Lower prehab:5, Midline:6, Shoulder health:4, Hamstring (light):1,
Tissue quality:6, Mobility:6, Easy cardio (zone 1):4, Breathing reset:4,
Power:5, Conditioning:6
```

**On glass** (session screen -> Add): the same flat list, and because `Sheet` is
auto-height with no scroll, **it ran off the top of the screen past the status
bar** — the first ten groups could not be reached at all, and the visible tail
began at `Groin / adductors (5)`.

⚠ **PROVENANCE OF THAT SHOT, STATED.** It was taken on the shared
`iPhone 17 Pro`, which was serving **another lane's bundle** (`wt-integration`
on :8096), not `main` — I did not take that simulator over. The Add flow it
showed is the flat menu, entry for entry, and the AUTHORITATIVE before-number is
the headless one above, taken on the control worktree at `c12a058c`.

That list is the GENERATION PROMPT's own filing (`selectableVocabularyGroups()`,
whose labels exist to teach movement patterns to the model). The NAMES behind it
were already legal, already equipment- and injury-filtered and already the
athlete's — it was the MENU that was internal.

## THE AFTER

```
Strength (125)          Power & jumps 10 · Lower body — squat 13 · Lower body — hinge 7 ·
                        Upper body — push 16 · Upper body — pull 12 · Carries 4 ·
                        Arms & shoulders 23 · Legs & calves 10 · Midline 16 · Prehab 14
Conditioning (94)       Sprints & speed 39 · Hard intervals 18 · Tempo & steady 20 · Easy & flush 17
Mobility / Warm-up (30) Mobility & stretching 20 · Foam rolling & release 6 · Breathing & wind-down 4
```

## WHAT I DID NOT BUILD, AND WHY

**No fourth taxonomy.** Three joins onto owners that already exist:

1. `AddFamilyId` is an `Extract` of `SessionExecutionSectionId`, and the labels
   are `SECTION_LABELS` itself — so the three words are the SAME words the
   session screen already divides the athlete's day into, and the level-1 glyph
   is `SESSION_SECTION_ICON_KIND` (R-116's one owner), not a lookalike.
2. Strength's subcategories join on a NEW stable `VocabularyGroup.id` (the pool
   key), never on the prompt's label text. `SUBCATEGORY_FOR_POOL` is a total
   `Record`, so a new pool cannot reach the athlete under its own internal label
   without somebody first choosing where it goes — the guard is the compiler.
3. Conditioning's subcategories ARE `ConditioningTier` — Sam's own
   session-intent classification of all 90 formats, rendered in athlete words.

**R-110 is honoured in the menu:** Power & jumps is Strength's FIRST
subcategory and is not a family of its own. Held by name in case [5].

## THE ONE BEHAVIOUR CHANGE BEYOND THE MENU SHAPE, STATED

`ADD_CANDIDATES_PER_GROUP = 6` is **deleted**. Its own stated reason — *"few
enough that the sheet is a decision rather than a catalogue"* — belonged to a
screen showing all 23 groups at once; the hierarchy is what makes it a decision
now. At six, an athlete with a full rack could not reach Dips, Face Pull or the
Z-Press at all, which reads as *"the app will not let me add it"*. R-088:
*"a user should be able to add as many of their own things on top of it as they
choose."* Level 3 therefore shows EVERY legal choice, in a `maxHeight` scroll
list — not `flex: 1`, which collapses to zero inside an auto-height `Sheet`.

## EVIDENCE

- `test:exercise-add-candidates` — **37 green, 0 red** (21 before). Case [5] is
  16 new cells.
- **Five mutations, each reddening its own cell and only its own:** power moved
  to another family; a prompt label passed through to level 2; a count off by
  one; a pool silently dropped; a hand-typed family label. Tree restored to 37
  green after each.
- `test:compile` — the error set is **byte-identical** to the control worktree
  at `c12a058c`. (The gate is red on `main`; this adds nothing to it.)
- Adjacent suites, each run in BOTH worktrees and compared, all identical:
  `test:locked-list` 33/0, `test:exercise-name-lock` 8/2, `test:power-pool`
  69/0, `test:generation-vocabulary` 17/1, `test:content-reconciliation` 20/0,
  `test:session-execution` 177/1, `test:exercise-exclusions` 53/2,
  `test:session-change-sequence` 22/0, `test:session-change-durability` 42/5
  (failure NAMES diffed, not just totals — identical),
  `test:exercise-edit-entry-surface` 42/0 -> 44/0.

## PRE-EXISTING, NOT MINE — MEASURED ON THE CONTROL WORKTREE

- **`test:plan-change-producer` DIES AT IMPORT on `main`** — identical stack in
  both worktrees, zero cells run. Its `[9]` cell asserts `/'add_kind'/` against
  the Day screen source; `add_kind` was deleted on 2026-08-19, so that assertion
  has been stale for a day and **nothing noticed, because the suite never
  runs**. Not fixed here; named so it is not re-discovered.
- **`test:tap-swap-hierarchy` reports 0 green / 0 red in both worktrees** —
  dead, as already recorded on `main`.
- `test:compile` red on `main` (45 test files over baseline, 0 product files).

## HARNESS FACTS THIS SEAT PAID FOR

- **`RCT_jsLocation` lives in the APP'S CONTAINER plist, not in
  `simctl spawn defaults`.** `xcrun simctl spawn <udid> defaults write
  <bundleid> RCT_jsLocation ...` writes a DIFFERENT domain, reads back happily,
  and the app ignores it. The one the app reads is
  `<data container>/Library/Preferences/<bundleid>.plist`, and cfprefsd caches
  it — `killall -9 cfprefsd` inside the simulator after writing.
- **A COPIED `.app` CANNOT BE REPOINTED AT ANOTHER CHECKOUT'S METRO.** The
  entry module path is absolute and baked at build time, so installing another
  worktree's binary and pointing it at your Metro gives
  `Unable to resolve module ./Users/samgeurts/Documents/local-footy-athlete/
  node_modules/expo/AppEntry from <your worktree>`. Useful diagnostic — that
  error PROVES your Metro is the one being asked — but the fix is a build.
- **`/tmp/qa-metro.log` IS SHARED BY EVERY SEAT.** `qa-start.sh` writes there
  unconditionally, so a second agent's run truncates yours and "no bundling in
  the log" is not evidence of anything. Read the app process's own established
  connections instead: `lsof -nP -iTCP -a -p <pid>`.
- **Ports 8081, 8082, 8083 and 8096 were all live seats** on 2026-08-20
  afternoon. The shared `iPhone 17 Pro` was pointed at 8096 (`wt-integration`).
  It was left exactly as found; this seat used the spare
  `LFA Explorer 3589b53` (`5D85D6F8-…`) on 8084.
