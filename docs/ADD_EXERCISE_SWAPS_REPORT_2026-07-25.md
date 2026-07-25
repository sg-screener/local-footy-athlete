# Add-exercise swaps + Hamstring Curl ruling — build report (L2)

**Branch**: `feat/add-exercise-swaps-sam-approved` → merged to `main` `--no-ff`
(`bbd9754`, feature commit `2380a40`).
**Status**: **Gates green, awaiting Sam device acceptance.**

---

## 1. Applied — the three approved swaps

`src/screens/home/DayWorkoutScreenV2.tsx`, the "Add exercise" suggestion table
on the live session screen. Each of these named a movement the curated vocabulary
already had under its real name, so they were renames rather than content
decisions — which is exactly why they were the three safe to apply.

| Was offered | Now offers | Cue it renders |
|---|---|---|
| `T-Spine Openers` | **Open Book Thoracic Rotation** | "Knees stacked, rotate through the upper back. Follow the hand with the eyes." |
| `Bike Flush Finisher` | **Easy Bike** | "Conversational pace, legs turning over. This is recovery, not training." |
| `Tempo Run Finisher` | **Tempo Run** | "Hold the pace, settle into the rhythm. Controlled breathing throughout." |

Verified through `buildCueText` — all three returned `null` before and return
real curated text now. Three blank cards in a live affordance, closed.

**Prescriptions and notes are untouched.** The notes already carried the intent
the invented "Finisher" suffix was reaching for ("Easy-moderate pace.", "Smooth,
not a test."), so nothing about the dose needed to move. `Tempo Run` is a
`B-low`/high-impact conditioning format rather than a flush, so the note is now
doing real work — worth an eye on device.

### The lock did the bookkeeping

I did not go looking for which exemptions to remove. Applying the swaps made the
three parked literals vanish from the sweep, the staleness assertion **failed the
build**, and it named exactly which three to unpark. Second time the
self-liquidating mechanism has done that work instead of me — the first was the
Phase 1.6 purge clearing `Leg Curl` and `Squat`.

---

## 2. Ruled — Hamstring Curl 20 kg accepted

**No code changed.** The ratio (`0.25`) and equipment class (`machine`) already
shipped exactly as first ruled, and the machine grid stays at 5 kg increments, so
accepting 20 kg is accepting what is already there.

Recorded in `EXERCISE_LOCKED_LIST_CHANGESET_2026-07-24.md` rather than quietly
dropped: the 22.5 kg in Sam's original note would otherwise read as an
unexplained miss to whoever opens that document next. The section now states the
ruling and why 22.5 was never reachable.

---

## 3. Still owed — three names, and they need authoring, not mapping

These survived the swap pass **because** they are not renames. Each names a
movement the curated vocabulary does not contain at all, so closing one means
authoring an entry (cue + video + pool placement) or dropping the suggestion.
They remain parked under `awaiting_sam_ruling`, and the gate still asserts both
that they render no cue and that the lock report names them.

| Name offered today | Renders | What closing it actually requires |
|---|---|---|
| `Split Squat` | **no cue** | A real progression the app is missing. The census flagged plain split squat as a **distinct, easier regression** from `Bulgarian Split Squats`, not a synonym — so mapping it to Bulgarian would be wrong, it would hand a beginner the harder variant. Either author it into the squat slot, or drop the suggestion and let Lower body offer `Bulgarian Split Squats` / `Reverse Lunges`. |
| `Calf Isometric Hold` | **no cue** | Nothing equivalent exists. `Single-Leg Calf Raise` is dynamic, so swapping would change the prescription from a hold to reps. Author it, or drop it — the Prehab slot still offers `Copenhagen Plank (Half)`. |
| `Hip Mobility Flow` | **no cue** | This is a **flow, not a movement**: `MOBILITY_FLOW_TEMPLATES` already has **Hips/Adductors/Groin Reset**. The clean fix is for the suggestion to point at a flow *template*, but the table can only emit single exercises today — so this one is a small structural change, not a one-liner. Flagged as design. |

---

## 4. Gates

| Gate | Result |
|---|---|
| `test:bible` (incl. `test:compile`) | **EXIT 0** — 792 PASS assertions |
| `test:exercise-name-lock` | PASS 9/9 |
| `test:content-reconciliation` | PASS |
| `test:generation-vocabulary` | PASS |
| `test:pools` | PASS |
| `test:locked-list` | PASS |
| `test:exercise-canonicalisation` | PASS |
| `test:authored-cues` | PASS |
| `test:compile` ratchet | PASSED at 474 — unchanged, no file regressed |

Sweep after the swaps: **47 distinct literals across 97 positions** — 39 resolve
outright, 8 typed-exempt, **0 unaccounted** (was 49/97 with 11 exempt).

---

## 5. NOT-COVERED

- **No device or simulator verification.** **Device acceptance is the gate.** The
  specific thing to look at: open the "Add exercise" sheet on a session and check
  Mobility and Conditioning-finisher now show cued cards. `Tempo Run` under
  "Conditioning finisher" is the one worth judging — it is a real tempo run
  (B-low, high impact), not a flush, so if it reads as too much work for a
  finisher slot that is a content call, not a bug.
- **The three remaining names still render blank cards.** Made loud, not fixed;
  fixing them is authoring.
- **The suggestion table still cannot emit a flow template**, which is what
  `Hip Mobility Flow` actually wants. Named as design work rather than worked
  around.
- **The literal lock's known limit is unchanged**: it closes hardcoded literals,
  not names composed at runtime (template string, join, bare function argument).
  No such site exists today.
- **Pre-existing failures, unchanged and not caused by this unit**:
  `generatedProgramNormalizerTests` (3) and `programmingBiasTests` (1) fail
  identically on `main`.

---

## 6. Next

1. **Sam device acceptance** — the gate.
2. **The three remaining names** — author or drop; `Hip Mobility Flow` also needs
   the suggestion table to learn flow templates.
3. **The power unit** — `POWER_EXERCISE_POOL_SPEC`, still the only thing between
   eight staged power names and a real pool, and owner of the missing cues for
   `Vertical Jump`, `Explosive Push-up` and `RFE Split Squat Jump`.
