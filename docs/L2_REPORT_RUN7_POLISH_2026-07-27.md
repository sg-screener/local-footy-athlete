# L2 Report — Run-7 Polish (2026-07-27)

Three rulings from Sam's run-7 device pass, built tests-first:

1. **One "Optional work" group header** — the optional cluster at the session's
   end gets a single header; the per-row "OPTIONAL" labels die.
2. **Form cues collapsed by default** — every exercise row hides its cue behind a
   tappable "Form cues" disclosure. **This supersedes the earlier
   always-visible ruling.**
3. **Kill the builder-inline text class** — `recoveryAddonBuilder.ts` and
   `mobilityFlowTemplates.ts` carried hardcoded per-exercise note strings that
   bypassed the curated cue layer. Add-on and flow rows now source display text
   from `EXERCISE_CUES` via canonicalisation.

Spec updated: `docs/SESSION_TEMPLATE_SPEC_2026-07-25.md` §6b items 12–14 record
all three, including the supersession and why the superseded rule existed.

---

## 1. What shipped

### Ruling 1 — the optional cluster

The header forced a change in the **composition owner**, not the renderer, and
that is the substance of this item.

Add-on rows were ranked by `classifyExerciseRole(name)` exactly like prescribed
rows. So an optional `Side Plank` classified as `midline` and sorted **between**
prescribed midline work and prescribed prehab work. The RED test shows it
literally:

```
["Back Squat", "Bulgarian Split Squat", "Pallof Press",
 "Side Plank" (optional), "Copenhagen Plank (Half)" (prescribed), "Tib Raises" (optional), ...]
```

A single header drawn over that range would have told the athlete their
prescribed groin work was optional. So `optional` now outranks the role in
`sessionTemplate.ts`:

```ts
if (item.kind === 'team_training') return SESSION_ROLE_ORDER.length * 2;
return sessionRoleRank(item.role) + (isOptional(item) ? SESSION_ROLE_ORDER.length : 0);
```

Adding the role count as an **offset** rather than as a separate sort key keeps
D2's order *inside* the cluster for free — optional prehab still follows optional
midline. Being optional changes which group a row is in, not what kind of work it
is.

The renderer now knows one thing: `optionalStart`, the index the owner already
guarantees is contiguous and last. It never decides which rows a header covers.

- Cluster sorts after **all** prescribed work including the conditioning
  finisher; the team-training banner stays absolute last (your ruling — it is
  context, not work).
- `styles.optionalMarker` (per-row eyebrow) — deleted.
- `styles.recoveryAddonPill` (recovery branch's per-card "Optional") — deleted in
  both V2 and Classic. It was the same per-row label wearing a different shape.
- Recovery days keep their own simple template (D13 §6 item 3) with **no**
  clustering logic, per your note — but they mount the same `OptionalWorkHeader`
  component, so the wording cannot drift. `"Optional Recovery Add-on"` → `"Optional work"`.

### Ruling 2 — cues collapsed

One `CueDisclosure` component, collapsed by default, mounted by **strength,
recovery and add-on rows alike**. A row with no curated cue renders nothing — never
an empty disclosure that opens onto blank space.

Two things worth knowing:

- **The state was already there and unused.** `expandedCues` / `toggleCue` have
  been threaded from `useDayWorkout` into `SessionList` and `RecoveryBlock` this
  whole time, doing nothing — vestigial from before the always-visible ruling.
  This reinstates them rather than adding state.
- **A dead `CueToggle` was sitting in the file**, unreachable: it only collapsed
  when a row had generator notes, and no row has had those since Stage 3, so in
  practice it always took its always-visible branch. It is retired, not left
  beside the new one. The pinned test now fails if two implementations coexist.

**The supersession, stated plainly.** The always-visible rule (L10 run-2 Stage 3)
existed for one reason: AI-generated per-exercise notes were rendering on the same
rows, so a collapsed cue would have let the generator's words outrank yours. Stage
3 killed the AI notes, so the reason expired. The ownership guarantee is
**unchanged** — the words behind the disclosure are still curated, still reached
through `buildCueText` and canonicalisation, and the "no generator notes rendered"
half of the old pin is still enforced. Only the presentation changed.

### Ruling 3 — the builder-inline text class

**Killed by construction, not by deleting strings.** A deleted string can be
retyped; a deleted field cannot be repopulated.

| Retired | Where |
|---|---|
| `notes?: string` | `RecoveryAddonExercise` (`types/domain.ts`) |
| `notes?: string` | `MobilityFlowMovement` (`data/mobilityFlowTemplates.ts`) |
| `MobilityFlowLocalMovementMeta` + `localMeta?` | `data/mobilityFlowTemplates.ts` |
| third `notes` parameter of `exercise()` | `utils/recoveryAddonBuilder.ts` |
| `movement.notes` pass-through | `recoveryAddonBuilder.mobilityExercises` |

**`localMeta` is the one you did not name, and it mattered most.** It let a flow
movement ship even if it was *not in the curated pools*, provided it brought its
own equipment / contraindication / notes metadata. Nothing used it — but it was
standing permission to name a movement the app cannot cue and paper over the gap
with local text. Same class as the inline notes, reached from the data layer
instead of the code. You ruled: delete it. Every flow movement must now be curated
vocabulary, and `mobilityFlowTemplateTests` enforces that (its
`movementIsKnownOrLocal` is now `movementIsKnown`).

#### Every inline string retired — the full sweep

**`recoveryAddonBuilder.ts` — 15 strings, all in `exercisesFor` (was lines 522–569):**

| # | Exercise | Retired string |
|---|---|---|
| 1 | Side Plank | "Easy bracing, leave 2-3 reps in reserve." |
| 2 | Bird Dog | "Slow controlled reps; keep hips quiet." |
| 3 | McGill Curl-Up | "Low effort, no grinding." |
| 4 | Groin Squeeze *(reduced branch)* | "Gentle squeeze only; no pain chase." |
| 5 | Groin Squeeze *(full branch)* | "Smooth ramp up and down." |
| 6 | Copenhagen Plank (Half) | "Controlled, short lever, stop well before strain." |
| 7 | Tib Raises *(reduced branch)* | "Easy pace; stop if shin/calf/Achilles symptoms flare." |
| 8 | Tib Raises *(full branch)* | "Controlled reps." |
| 9 | **Seated Calf Raise** | **"Quiet tempo, no bouncing."** ← the instance you found (`:544`) |
| 10 | Glute Bridge *(reduced branch)* | "Easy squeeze; no cramping or hamstring tug." |
| 11 | Glute Bridge *(full branch)* | "Easy activation before hamstring loading." |
| 12 | Nordic Lower | "Low-rep only; stop before soreness becomes the point." |
| 13 | Banded External Rotation *(×2 sites)* | "Pain-free range only." |
| 14 | Face Pull | "Light, clean shoulder blades." |
| 15 | Suitcase Carry | "Tall posture, light-moderate load, no grind." |

**`mobilityFlowTemplates.ts` — 0 string literals, 2 channels.** No movement
actually populated `notes` or `localMeta`; both were live, empty channels through
which the same class would return. The types are gone, so they cannot.

**The found instance is the argument for the whole ruling.** The curated
`Seated Calf Raise` cue already ends *"Slow tempo, no bouncing."* The inline
string was a **paraphrase of the very cue it was displacing** — two authoring
surfaces saying the same thing, only one of them yours.

#### Nothing was lost in the trade

I swept every name the add-on builder and every mobility template can emit — **32
names, 32 curated cues, zero gaps**. Retiring the inline strings traded uncurated
text for *curated* text, never for no text. This is asserted, not assumed: §11
sweeps the flow templates directly and enumerates the builder's vocabulary **by
running the real selection logic across its whole decision space** (focus area ×
status × phase × week kind × G−1 × every template id) rather than by keeping a
second copy of the list in a test file. A second list is the thing that drifts —
that lesson is already paid for (`3639841`).

#### The invariant, and where it had to go

`enforceCuratedCueContract` runs inside `buildWorkoutsFromCoach`, which **finishes
before `attachRecoveryAddonsToWeek` wraps its output** — add-on rows were
structurally invisible to it. An invariant enforced at a point where the content
does not yet exist is not enforced at all. So the add-on gate lives at the attach
boundary, where the rows first exist:

```ts
export function attachRecoveryAddonsToWeek(args) {
  const attached = buildWeekWithRecoveryAddons(args);
  enforceCuratedAddonCueContract(attached, 'attachRecoveryAddonsToWeek');
  return attached;
}
```

It **throws**, for the same reason the strength contract does (device run 5): a
violation logged is a violation shipped.

**Scoped to add-on rows on purpose.** My first cut called the session-wide gate
there, and a fixture immediately failed on a *strength* row (`Split Squat`, an
off-vocabulary test name). That was the right signal: each stage should enforce
what **it** produced. Re-judging strength rows at attach time double-reports and
blames the attach stage for content it did not author. Pinned by a test.

Note the shape of this defect class: the hardcoded string **was** the fallback
that hid the gap. Add-on rows were never missing text and therefore never checked.
Removing the fallback is what made the gap visible enough to be worth enforcing.

---

## 2. Decisions I made that the rulings did not cover

1. **Cluster position vs. the team-training banner.** Your ruling said "the
   session's end"; the banner already sorted last. I put the cluster after all
   prescribed work and left the banner absolute last — you confirmed this.
2. **Order inside the cluster.** Not specified. I kept D2's order (optional
   midline before optional prehab) by using an offset rather than a separate sort
   key. Alternative was authored order; D2 is what the rest of the list uses.
3. **Classic (`DayWorkoutScreen.tsx`) tracks the rulings too.** It is dead code
   behind `DESIGN_VERSION = 'v2'`, but it had to compile once the `notes` field
   went. Rather than the minimum edit, I applied all three rulings to it — a
   second copy holding the *old* rulings is exactly how the two layers drifted
   before.
4. **`placementNote` kept.** It is block-level ("Low-fatigue support work. Useful,
   optional, and safe to skip.") — a placement fact about the add-on, not
   per-exercise coaching text, so not the class you named. Flag it if you want it
   gone too.
5. **Conditioning phase rows untouched.** `ConditioningPhaseRow` renders
   `exercise.notes` as a phase *description*. Conditioning content is exempt by
   kind under the existing contract and you named add-on and flow rows
   specifically. Not swept — see NOT COVERED.

---

## 3. Gates

| Gate | Result |
|---|---|
| `test:compile` (3-scope ratchet) | **PASSED** — no file regressed; total errors 483 → 474 |
| `test:session-template` | 70/70 |
| `test:exercise-canonicalisation` | 60/60 |
| `test:authored-cues` | 41/41 |
| `test:content-reconciliation`, `test:locked-list`, `test:exercise-name-lock`, `test:pools` | all pass |
| `test:mobility-flow`, `test:midline`, `test:recovery-template` | all pass |
| `mobilityFlowTemplateTests` (354), `recoveryAddonAttachmentTests` (37) | pass |
| Remaining 40 `test:bible` sub-suites | all pass |
| `test:bible` **slice 1** | **FAILS — not this unit. See below.** |

### The one red gate, and why it is not mine

```
Error: ALL-TRUNK-SUPPORT-01 anchor quote is no longer present in the Programming Bible
```

`runSlice1` fails on **clean `main`** with my changes stashed. It was introduced
by the Bible Amendment Pass (`b642d24`, merged `e899954`), which rewrote the
Programming Bible and moved the text that `ALL-TRUNK-SUPPORT-01` anchors to. That
work landed in this working tree *while this unit was in progress* (see §5).

So: **I cannot report `test:bible` EXIT=0**, and I am not going to claim it. Every
other suite in the chain passes, including all four content suites and the compile
ratchet. The anchor needs re-pointing at the amended Bible text by whoever owns
that pass.

### `authored-cues` caught me once — worth recording

A doc comment I wrote said "their prescribed *Copenhagen Plank* was optional",
using the **retired unqualified name** (only `Copenhagen Plank (Half)` survives).
The literal-lock gate failed the build over a comment. Reworded to "groin work".
The gate did exactly its job.

---

## 4. NOT COVERED

- **No device verification.** This is a purely visual unit — a new header, a new
  collapsed disclosure on every row, and a reordered list. Simulator/device
  acceptance is yours and it is the real gate. Nothing here is "done" until you
  have seen it.
- **`test:bible` is not green** (§3). Pre-existing, diagnosed, not fixed —
  re-pointing a Bible anchor belongs to the amendment unit, not to a polish unit,
  and guessing at which amended sentence should anchor `ALL-TRUNK-SUPPORT-01` is
  exactly the kind of silent reinterpretation the process law exists to prevent.
- **Cue disclosure state is per-session and in-memory.** Expanding a cue does not
  persist across a screen reopen. That is how `expandedCues` already worked; I did
  not change it. Say the word if you want expansion sticky.
- **No default-expanded rule.** Every row starts collapsed, including a first-time
  exercise the athlete has never done. If you want unfamiliar movements to open by
  default, that needs a "has the athlete done this before" signal — a real feature,
  not a polish item.
- **`PowerRow` still renders `block.notes` in cue styling.** Power-block notes are
  a *third* text channel, authored by the power builder rather than by
  `EXERCISE_CUES`. Same class as ruling 3, different file, and you named two files.
  **Flagging it, not fixing it** — it needs your ruling on whether power-block
  notes are coaching text (curate them) or structural (leave them).
- **`ConditioningPhaseRow` renders `exercise.notes` as a description.** Exempt by
  kind under the existing contract, not swept — see §2 item 5.
- **The `notes` field on `WorkoutExercise`** (the generator row type) is untouched
  and still widely read by non-render code (coach routing, logging, semantic
  snapshots). It is not rendered on the session screen and was not in scope.
- **No accessibility audit of the disclosure beyond the basics.** It has
  `accessibilityRole="button"`, `accessibilityState={{ expanded }}` and a
  show/hide label. Not screen-reader tested on device.

---

## 5. Working-tree hazard — please read

**A concurrent session used this working tree while this unit was in progress.**
The reflog shows it checked out my branch, then branched to
`docs/bible-amendment-pass-2026-07-27`, committed `b642d24`, returned to `main`
and merged it (`e899954`) — leaving HEAD on `main` and my branch pointer stale.
My uncommitted work survived and is intact.

**Two consequences you should know about:**

1. The `runSlice1` failure above arrived that way (§3).
2. **There is valuable uncommitted work in the tree that is not mine and I have
   not touched it:** `docs/PROGRAMMING_DESIGN_SESSION_2026-07-23.md` has a
   29-line **D17 — Mobility & Prehab flow menus** section, marked
   `AUTHORED-COMPLETE`, with your flow composition rules and dosing. I
   deliberately left it out of my commit rather than sweeping another unit's
   in-flight authoring into a polish commit — the repo already has a commit
   undoing exactly that mistake (`358137d`). **It is sitting uncommitted and at
   risk. It should be committed by whoever authored it.**

---

## 6. What needs your eyes on device

1. **The optional cluster's position and weight.** It now sits below the
   conditioning finisher. Does "Optional work" read as a divider or as a new
   section? I held it at eyebrow scale deliberately — the work below is still the
   same session, just no-penalty.
2. **A session with no optional work** — the header should simply not appear.
3. **The disclosure's density.** This is the point of ruling 2: does a session of
   6–8 rows now read cleanly with every cue folded away? And is `▸ Form cues`
   discoverable enough that a newer athlete finds it?
4. **A recovery day.** Same header, no pill, cues now collapsed inside the add-on
   card. Confirm it still reads as the simple template you ruled for.
5. **A conditioning day with team training** — the banner should still be last,
   below the cluster.
6. **Whether the cue disclosure belongs on the mobility flow's movements too.**
   The flow rows currently show name + dose only, no cue affordance at all.
