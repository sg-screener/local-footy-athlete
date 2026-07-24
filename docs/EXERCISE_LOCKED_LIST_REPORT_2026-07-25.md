# Exercise Locked List + Vocabulary Switch — build report (L2)

**Unit**: apply `docs/EXERCISE_LOCKED_LIST_CHANGESET_2026-07-24.md` exactly.
**Branch**: `feat/exercise-locked-list-vocabulary-switch` → merged to `main`
`--no-ff` (`3639841`, feature commit `20e289d`).
**Status**: gates green. **Device acceptance not done — that is the gate.**

---

## 1. The architectural heart — one circle

Three sets used to answer "which exercises exist":

1. `EXERCISE_CUES` keys — what the generation prompt offered.
2. the pools — what a builder could actually select.
3. `coach-chat`'s hand-copied `MOVEMENT PATTERNS` list in its system prompt.

Three representations means three ways to drift, and every drift renders as
the same athlete-visible failure: a card the app cannot cue, or a movement Sam
curated that nothing can ever prescribe. The census counted **42 orphans**
across those seams.

**Now**: membership of a pool a live builder selects from is the ONLY
definition. `src/data/selectableExerciseVocabulary.ts` owns it; the union is
the four systems the census proved live builders select from —
`STRENGTH_POOLS`, `POOL_REGISTRY`, `MOBILITY_FLOW_TEMPLATES`,
`CONDITIONING_META`.

- `curatedExerciseVocabulary()` returns that set verbatim.
- The prompt emits it **grouped by the pool slot that owns each name**, which
  is what allowed representation (3) to be **deleted** rather than kept in
  sync. One derived source now teaches both the names and the patterns.
- The invariant fails the build **in both directions**: a selectable entry
  with no cue or video, and a cue no pool can prescribe.

### Typed-kind exemptions, not name whitelists

Four bare-name whitelists (`ZONE_1_NO_VIDEO_BY_DESIGN`,
`MOBILITY_NO_TAGS_BY_DESIGN`, `UNPOOLED_BY_RULING`, `CUE_ONLY_BY_RULING`) are
gone. A name in one of those was exempt from whatever the assertion happened to
skip, and nothing checked the stated reason still applied. Five typed kinds
replace them; each declares the fields it waives and the ruling behind it, so
`isExempt(name, 'video')` is a different question from `isExempt(name, 'pool')`
and an entry cannot quietly widen its own licence.

| Kind | Waives | Why |
|---|---|---|
| `conditioning_format` | cue, video, tags | Session format, not a movement to demo |
| `zone1_recovery` | video, tags | Walking / skipping — nothing to demo |
| `mobility_untagged` | tags | `EXERCISE_TAGS` is the strength taxonomy |
| `power_pool_pending` | pool, cue, video | Placement owned by the power unit |
| `load_ruling_pending` | load | Sam rules the ratio line by line |

Kinds **compose** — `Speed Trap Bar Deadlift` carries both `power_pool_pending`
and `load_ruling_pending`, which a single-kind model would have silently
dropped.

---

## 2. Sam's four notes — how each was handled

### (1) Display names — word changes: NONE

Every one of Sam's lowercase entries is title-cased; one abbreviation is
expanded per the vocabulary's own no-abbreviation rule. **Every final canonical
name, for your eyeball:**

| Sam's entry | Ships as |
|---|---|
| Banded TKE | **Banded TKE** |
| Bodyweight Squat | **Bodyweight Squat** |
| Bosch Hold | **Bosch Hold** |
| Erg EMOM | **Erg EMOM** |
| Glute Bridge | **Glute Bridge** |
| Hamstring Curl | **Hamstring Curl** |
| Hollow Hold | **Hollow Hold** |
| Kneeling Jump | **Kneeling Jump** |
| Lateral Jump | **Lateral Jump** |
| Plank | **Plank** |
| Pogo Hops | **Pogo Hops** |
| Side Plank Row | **Side Plank Row** |
| Single-Arm DB Floor Press | **Single-Arm DB Floor Press** |
| Single-Leg Hip Thrust | **Single-Leg Hip Thrust** |
| Slant Board Step-Down | **Slant Board Step-Down** |
| Spanish Squat Hold | **Spanish Squat Hold** |
| Stir the Pot | **Stir the Pot** |
| back extension | **Back Extension** |
| crab walks | **Crab Walks** |
| dragon flag | **Dragon Flag** |
| high box squat | **High Box Squat** |
| speed trap bar DL | **Speed Trap Bar Deadlift** |
| QL back extension | **QL Back Extension** |
| ATG split squat | **ATG Split Squat** |
| Elephant walks | **Elephant Walks** |
| Cossack Squat | **Cossack Squat** |
| Lateral Lunge | **Lateral Lunge** |

Merge survivors: **Vertical Jump**, **Explosive Push-up**, **Pogo Hops**,
**RFE Split Squat Jump**, **Inverted Row (Bodyweight)**, **Seated DB Press**,
**Bulgarian Split Squats**, **Trap Bar Deadlift**, **Pull-Ups**.

**Two names I did NOT expand — please rule.** `QL` and `ATG` are the movements'
names, not equipment abbreviations, and neither has a spelled-out form anywhere
in the curated vocabulary. Expanding them ("Quadratus Lumborum Back Extension",
"Ass-to-Grass Split Squat") looked worse than leaving them, so they ship
verbatim and are flagged rather than silently changed.

`DL → Deadlift` was applied as a general rule (added to the canonicalisation
token expansions), not a one-off rename — so "trap bar DL" and any other
shorthand a generator emits now collapses onto the spelled-out lift without
needing an alias per lift.

### (2) Load handling

Band and bodyweight additions went straight to the no-load classes (19 names).
The seven genuinely loaded entries are parked in `load_ruling_pending`; their
**pool entries ship, their numbers do not**. `estimateStartingWeight` falls
through to the tag heuristic meanwhile, so no card is ever blank — it is just
not yet anchored to a Sam-approved ratio.

**PROPOSED — please rule line by line.** Two columns because this app splits
load handling in two: `loadRatio` is progression *transfer* between pool
siblings; `EXERCISE_LOAD_MAP` is the *starting weight* estimate. Every number
mirrors the named comparable; none is a new judgement about how heavy a lift
should be.

| Exercise | Proposed loadRatio | Mirrors | Proposed EXERCISE_LOAD_MAP | Mirrors |
|---|---|---|---|---|
| High Box Squat | 1.00 | Box Squat 0.95 — higher box, shorter ROM | `{ squat, 0.78, barbell }` | Box Squat 0.75 |
| Glute Bridge | 0.90 | Hip Thrusts 1.10 — floor ROM, less loadable | `{ squat, 0.55, barbell }` | Hip Thrusts 0.70 |
| Single-Leg Hip Thrust | 0 (slot convention) | `isolation_lower` is all-zero by design | `{ squat, 0.20, dumbbell }` | Single-Leg RDL 0.15 |
| Hamstring Curl | 0 (slot convention) | `isolation_lower` is all-zero by design | `{ squat, 0.25, machine }` | Leg Extension 0.30 |
| Back Extension | 0 (slot convention) | `isolation_lower` is all-zero by design | `{ squat, 0.15, dumbbell }` | Weighted Dead Bug 0.10 |
| Single-Arm DB Floor Press | 0.35 | Single-Arm DB Bench Press 0.35 | `{ bench, 0.22, dumbbell }` — already shipped, unchanged | — |
| Speed Trap Bar Deadlift | n/a until the power unit places it | — | `{ squat, 0.55, barbell }` | Speed Bench 0.55 |

**One contradiction worth your eye:** `Glute Bridge` currently ships as
bodyweight (`{ squat, 0.00, bodyweight }`, and it sits in
`TRUE_BODYWEIGHT_EXERCISES`), but your own cue says "add weight to hips if you
can". The proposal moves it out of bodyweight. Until you rule it keeps today's
bodyweight handling.

**Also proposed:** `Erg EMOM` needs a `CONDITIONING_META` triple to be
selectable and your sheet gives a cue only. Proposed
`{ tier: 'B-high', modality: 'mixed', impact: 'low' }` — mirrors Hard Row
Intervals / 4x4 VO2; the Bible names it a hard-intervals format and an erg is a
low-impact mixed modality.

### (3) Power — staged, never invented

`POWER_EXERCISE_POOL_SPEC_2026-07-23.md` is APPROVED but **NOT BUILT**
(`selectPowerExercise` does not exist; `buildPowerBlock` still hardcodes
identity at `defaultProgram.ts:1389`). So no placement was invented. Eight
names carry `power_pool_pending`: cue, video and tags ship where they exist;
pool placement — and therefore presence in the AI vocabulary — waits for that
unit. The staged set is checked against the changeset's POWER table in both
directions.

Two things did land in the power block, because they are renames not
placements: `Pogo Jumps → Pogo Hops`, and the retired
`Medicine Ball Chest Pass` removed from the upper option list.
`Medicine Ball Overhead Throw` is **not** in your removal list and survives.

> **Superseded 2026-07-25**: Sam then retired `Medicine Ball Overhead Throw`
> too. The whole medicine-ball family is gone, `buildPowerBlock` no longer
> branches on equipment, and the power block is bodyweight-only. See the
> follow-up unit's report.

**Open for the power unit** (recorded, not decided here): the spec's pool has a
`family` axis of `lower` / `upper` only. `Speed Trap Bar Deadlift` and
`Speed Bench` are barbell speed lifts, not jumps — they need a third family or
an explicit ruling. Your changeset places both under "pool: Power" without
splitting further.

### (4) The vocabulary switch

See §1. Both directions build-failing, exemptions typed.

### (5) Docs updated to match what ships

- `EXERCISE_LOCKED_LIST_CHANGESET_2026-07-24.md` is now the machine-parsed
  source of truth: final-name table, power staging table, proposed-load table,
  removal-scope rulings, and the switch as built.
- `CUE_CHANGESET_2026-07-23.md` and `VIDEO_CHANGESET_2026-07-24.md` were **not
  rewritten** — they are records of sign-offs you gave. Each now declares its
  own *supersessions* (4 cues, 2 videos), and the test subtracts them, so both
  documents stay true at once.

---

## 3. Cue punctuation

The same mechanical terminal-stop pass you authorised on 2026-07-24 was applied
to the 25 new cue lines — **zero word changes** — and mirrored byte-for-byte
into the changeset document, so doc↔code equality holds.

One addition has no authored cue: `Single-Arm DB Floor Press`, whose sheet
entry is blank. It keeps the existing Bible pressing-injury-swap cue, and the
document records that explicitly rather than inventing one.

One cue was **replaced**, not added: `Hamstring Curl`. Your locked list gives
"Pad should be lower calf area, squeeze heels to butt." with no secondary; the
older "Curl the heels toward your butt. / Control the return, no slamming."
is superseded.

---

## 4. Gates

| Gate | Result |
|---|---|
| `test:content-reconciliation` | PASS 12/12 |
| `test:generation-vocabulary` | PASS 18/18 |
| `test:pools` | PASS 456/456 |
| `test:authored-cues` | PASS 41/41 |
| `test:locked-list` (new) | PASS 31/31 |
| `test:exercise-canonicalisation` | PASS 46/46 |
| `test:cue-join` | PASS 6/6 |
| `test:bible` (incl. `test:compile` ratchet) | **EXIT 0**, 782 PASS lines |
| `test:compile` ratchet | PASSED — no file regressed |

Adjacent suites verified not-regressed: `exerciseBibleLibraryTests` (updated
for the retirements, PASS), `exposureEngineTests`, `trainAroundEngineTests`,
`workoutCanonicalisationTests` — all PASS.

`test:locked-list` was added to `test:bible`, so the document is a permanent
gate rather than a one-off check.

---

## 5. NOT-COVERED

Stated explicitly per Process Law, not silently omitted.

- **No device or simulator verification.** Nothing here was run on a phone or
  simulator. Every claim above is a static/source claim. **Device acceptance is
  the gate for this unit** — in particular the new cards' cue rendering, the
  video play buttons on 23 new URLs, and the power block now showing
  "Pogo Hops".
- **The dead-path purge is NOT done.** `supabase/functions/generate-program`,
  `supabase/functions/sync-exercises` and the applied SQL seed migrations still
  name 21 of your removals (Barbell Rows, TRX Suspension, Sled Push, Pec Deck,
  Deep Lunges, …). All three are confirmed-dead by import graph (zero call
  sites in `src/`), and rewriting applied migration history is not a content
  change. **This is the purge unit** — it is the next thing, not an oversight.
- **Olympic lifts were not literally deleted.** The only live occurrence is
  `coach-chat`'s `NEVER program:` prohibition. Deleting it would *permit* them.
  The census entry is retired; the ban stays. Recorded as a ruling in the
  changeset.
- **`Vertical Jump`, `Explosive Push-up` and `RFE Split Squat Jump` have no
  authored cue and no pinned video.** You authored none, and I did not invent
  any. They render the plyo/push **family** cue (a real curated cue, not the
  generic filler), so no card is blank — but they are the three power names
  with the thinnest content, and the power unit should collect cues for them.
- **`Erg EMOM` conditioning classification is a proposal**, not your ruling —
  see §2(2). It is live now because `CONDITIONING_META` is required for
  selectability; if the triple is wrong, the format is mis-tiered.
- **Pre-existing failures NOT caused by this unit**, recorded so they are never
  misattributed: `generatedProgramNormalizerTests` fails 3 tests identically on
  `main` and on this branch ("all three strength contributions retain Mixed
  identity", "weekly-card identity preserves strength title and surfaces
  aerobic context", "weekly visible items surface strength and conditioning
  separately"). The `test:compile` gate also reports 3 pre-existing
  *improvements* in `illnessRecoveryWeekMode.ts` that I did not lock into the
  baseline — that file belongs to another unit's ratchet.
- **`exerciseSubstitutes.ts` selection behaviour not re-audited.** The pools it
  reads changed shape (isolation_lower 5 → 7 entries, squat anchor 3 → 4,
  Adductor Machine gone), and `test:pools` proves rotation and classification
  still hold, but which substitutes it *offers* for a given injury was not
  tested. Same NOT-COVERED the census recorded.
- **`coach-revision-proposal` / `coach-semantic-program-edit-draft` prompts not
  audited** for exercise-name vocabulary. Only `coach-chat`'s generation prompt
  was in scope. They consume the same canonicalised pools, so the exposure
  should be a subset — not independently verified.
- **Groin coverage after the machine removals** is Copenhagens + Groin Squeeze
  + Cossack Squat + Lateral Lunge, exactly as your NOTES specify. Whether four
  entries is enough rotation depth for that pool is a programming question, not
  a content one, and was not assessed.

---

## 6. Next

1. **Sam device acceptance** — the gate.
2. **Sam rules the load table** (§2(2)) and the Erg EMOM triple; unparking is a
   one-line change per row plus removing the name from `LOAD_RULING_PENDING`.
3. **The purge unit** — dead edge functions and seed migrations.
4. **The power unit** — `POWER_EXERCISE_POOL_SPEC`, which unblocks eight staged
   names and the missing power cues.
