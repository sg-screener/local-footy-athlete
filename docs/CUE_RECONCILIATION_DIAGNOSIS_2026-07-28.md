# Cue Reconciliation — Phase 1 diagnosis (2026-07-28)

Closes the enumeration half of Gap 2 in `docs/PROVENANCE_INVENTORY_2026-07-28.md`:
cues are enforced verbatim, but **one-directionally**, because authored-ness
accumulated across several documents and nothing reconciles them.

Every cue in code was compared against every cue in every authored document,
with names resolved through the repo's own `canonicalExerciseName` rather than
by string equality — which is what turns most of the apparent gap into nothing.

## Headline

**There are no conflicts.** Not one cue exists in both code and a document with
different text. The entire gap is *filing*, not disagreement, so Phase 2 needs
no Sam ruling round on cue text.

| Class | Count |
|---|---|
| (a) in code + an authored doc, text matches | **170** |
| (b) in code, in NO doc — orphaned | **5** |
| (c) in a doc, not in code — dead or lost | **0** |
| (d) in code AND a doc, text DIFFERS — Sam rulings | **0** |
| | **175** |

Sub-split of (a): **162** match under the same name; **8** match verbatim but
are filed in the doc under Sam's informal lowercase name.

## What the sources actually are

| Artifact | Cues | Status |
|---|---|---|
| `docs/CUE_CHANGESET_2026-07-23.md` "Final cue library" | 142 live (+4 superseded) | authored; the only doc the gate reads |
| `docs/EXERCISE_LOCKED_LIST_CHANGESET_2026-07-24.md` "ADDITIONS" | 27 | authored; **the gate has never read it** |
| ditto, "CUE EDIT" | 1 (an *append* to a changeset cue) | authored; a composition, not a standalone cue |
| `docs/CUE_REVIEW_2026-07-23.xlsx` | 0 | **not an authored source — see below** |

### The review spreadsheet is blank

`CUE_REVIEW_2026-07-23.xlsx` is named "Source of truth: Sam's edited review
sheet, parsed verbatim" by the changeset header, but the copy in the repo has
**no filled rewrite cells at all** — columns F/G are empty on all 143 exercise
rows; the only populated pair is the `(example) Back Squat` demo row. Sam's
edited copy was never committed; his rulings were transcribed straight into the
`.md`. The sheet in the repo is the *ask*, not the answer.

This is a records gap, not an authorship gap — the changeset's instruction was
"leave F/G blank to keep the current cue as-is", so a blank row is Sam
approving the standing cue, and the `.md` is his signed output. But the artifact
the doc points at cannot corroborate it, and it should not be mistaken for a
canonical source in Phase 2.

## (b) The 5 orphans — in code, in no document

All five are athlete-facing, all five are within the 18-word cap, and all five
trace to Sam through their commit messages rather than through a document.

| Exercise | Words | Attribution |
|---|---|---|
| Butterfly Stretch | 18 | `09afe43` — "Sam-authored 2026-07-28, verbatim" |
| Jefferson Curl | 17 | `09afe43` — same |
| Pissing Dog Against Wall | 15 | `09afe43` — same |
| Scap Pull Ups | 17 | `27e7470` — "Sam-authored 2026-07-28, verbatim" |
| Dumbbell Pullovers | 17 | `4554a80` — "Sam-authored 2026-07-28, verbatim" |

> `Dumbbell Pullovers` first landed on the blocked WIP commit `8a02b06`, whose
> message claims only "everything authored and verified except load" with no
> attribution. The later commit that unblocked it, `4554a80`, carries the
> explicit Sam attribution. Traceable — but only via the second commit.

These are Sam's cues that never got filed. They are class (b) by clerical
accident, not by unclear authorship, so Phase 2 can write them into the
canonical source as Sam-authored-as-shipped.

## (a-alias) The 8 filed under an informal name

Same text, verbatim, in both places. The doc carries Sam's shorthand; code
carries the canonical name. Nothing to rule on — the reconciliation just has to
resolve names rather than compare strings.

| Code | Document |
|---|---|
| ATG Split Squat | `ATG split squat` |
| Back Extension | `back extension` |
| Crab Walks | `crab walks` |
| Dragon Flag | `dragon flag` |
| Elephant Walks | `Elephant walks` |
| High Box Squat | `high box squat` |
| QL Back Extension | `QL back extension` |
| Speed Trap Bar Deadlift | `speed trap bar DL` |

## Two supersessions that still ship, correctly

`Hamstring Curl` and `Pull-Ups` appear in the changeset's "Superseded by the
locked list" section, so the gate subtracts them — yet both are live in code.
Neither is a defect:

- `Hamstring Curl` was re-authored in the locked list's ADDITIONS.
- `Pull-Ups` ships `changeset primary` + `changeset secondary + the CUE EDIT
  append line`. Its shipped text exists in **no single document**; it is a
  composition of two.

That composition is the clearest small illustration of the whole gap: the cue
is fully authored and fully correct, and no single-document gate can see it.

## Second gap found: the family fallbacks are unauthored and reachable

Outside `EXERCISE_CUES` sit 13 `FAMILY_FALLBACKS` cue pairs, rendered whenever a
name has a movement tag but no cue entry. **None of the 13 appears in any
authored document, and the gate does not check them at all.**

They are not dead. Nine names are tagged-but-uncued, eight of them selectable:

```
MAS Training · 6x1km · Hard Row Intervals · Hard SkiErg Intervals
Hard Assault Bike Intervals · SkiErg Intervals · Assault Bike Intervals
Easy Swim                                        (+ MetCon, not selectable)
```

Confirmed through the real render path — `buildCueText('MAS Training')` returns:

> "Hold the prescribed effort. Breathe rhythmically."

So eight selectable conditioning modalities show the athlete a cue no document
records and no gate protects. The gate's own coverage assertion, "every pool
exercise has an authored cue", cannot see them: it derives its list from
`POOL_REGISTRY` + `STRENGTH_POOLS`, while conditioning modalities reach
selectability through a different source.

The generic pair below them (`Control the movement.` / `Stay tight through the
full range.`) is deliberately suppressed by `buildCueText` and never renders —
that one is fine.

## For Sam's eye — authorship genuinely unclear

Per the stop rule, these were **not** blessed:

1. **The 13 `FAMILY_FALLBACKS` pairs.** No document, no commit attribution, no
   sign-off record. They predate the cue pass. One of them (`conditioning`) is
   live to eight selectable exercises today.

Nothing else on the list. Every other cue in the app traces to Sam.

### Sam's rulings (2026-07-28) — and what shipped

**Ruling 1 — DELETE the 12 latent pairs.** *"The coverage gate makes them
unreachable, and fail-loud beats a safety net nobody authored."*

Shipped, and the **table** went with them rather than being shrunk to its one
live key. A one-key record is a mechanism pretending to still exist, and twelve
empty slots is an invitation a later unit can accept with no gate noticing.
`getExerciseCue` now returns a single named constant for conditioning and falls
through to the suppressed generic — which renders nothing — for everything else.
The gate bans the identifier `FAMILY_FALLBACKS` from reappearing anywhere in
`src`, so the mechanism cannot come back by accident.

**Ruling 2 — the live conditioning pair stays UNRULED.** Attributed
pending-Stage-B; not blessed, not replaced; renders as-is on test devices (no
live users). Resolution deferred to Stage B, where template `effortCue`s
supersede it and `Easy Swim` gets a Sam-authored cue.

> **TRIPWIRE:** if the app approaches real athletes before Stage B lands, this
> line comes back to Sam.

Shipped as `PENDING_CONDITIONING_CUE`, carrying that tripwire in its own
docstring, and as `PENDING — Stage B` on all 23 of its sheet rows. The gate
asserts the pair is still *labelled* unruled, so the attribution cannot be
quietly deleted to make it read as authored.

### The Stage B question, answered

Asked before ruling 2: does modality-level cue text survive template-owned
rendering, or die? **Not a clean death — so nothing was pinned.**

- *Argues they die:* all 55 conditioning templates carry `effortCue`, "Sam's
  authored athlete-facing cue for how the effort should feel", verbatim from the
  templates workbook and equality-gated both directions. It has **no consumer
  outside its own module** today ("NOT WIRED YET").
- *Argues they survive:* none of the 8 live names appears in
  `LEGACY_CONDITIONING_FORMAT_MAP`, the artifact documenting *"how each
  pre-template format resolves"*. That map holds 15 session **formats** (Classic
  4x4, Tabata, MetCon, Grind…), not these modality names.
- *One provably cannot die:* `Easy Swim`. `ConditioningModality` is
  `run | bike | air_bike | ski | row`. There is no swim.

The inventory set the precedent on the tier-cap table — *"its fate at Stage B is
genuinely unclear, so it stays in `pending_sam` rather than being pinned on a
guess."* Same call. The shelf-life note is recorded on the pending entry so Sam
knows what he is deferring.

### One more thing found while answering it

Of the 23 selectable conditioning rows, **8 render the pending pair and 15
render no cue text at all** — they fall through to the generic pair, which
`buildCueText` suppresses. That is not a regression and not fixed here; it is
recorded on the pending entry because Stage B has to answer for it too.

## Numbers reconciled against the inventory

The inventory measured 173 code cues with 29 absent from the gate's doc; today
it is **175** with **31** absent. The difference is the three mobility cues
added later the same day (`09afe43`). Same finding, moved snapshot.

## What Phase 2 shipped

| | |
|---|---|
| Canonical source | `docs/EXERCISE_MASTER_SHEET_2026-07-28.xlsx` — the muscle/experience sheet renamed, `primaryCue`/`secondaryCue` on the row that already owns each exercise |
| Rows | 198: **175** authored, **23** `PENDING — Stage B` |
| Bind | **both directions** — a cue absent from the sheet fails the build |
| Coverage | derives from `selectableExerciseNames()`, not the two pool registries |
| Pending set | pinned at exactly 23 |
| Deleted | the `FAMILY_FALLBACKS` table, banned from `src` by name |
| Gate | `test:authored-cues` 41/41 → **53/53** |

The 5 orphans are filed as Sam-authored-as-shipped with their attributing commit
in the sheet's `Notes`, so attribution now lives in the source rather than in a
commit message someone has to go looking for.

**The gate was mutation-tested**, because a gate that has never failed has not
been shown to work. Seven mutations, seven catches: rewording a shipped cue;
shipping a cue absent from the sheet; quietly cueing a `PENDING` row; blanking a
sheet cell; adding a 24th pending row; reintroducing a fallback table; and
stripping the "NOT Sam-authored" label off the pending pair.

## Method

`EXERCISE_CUES` was imported directly rather than parsed; documents were parsed
per-format (markdown sections, xlsx `sharedStrings` + inline strings); names on
both sides were resolved through `canonicalExerciseName`; comparison normalised
whitespace and the typographic apostrophe only. Baseline `npm run
test:authored-cues` is green at 41/41.
