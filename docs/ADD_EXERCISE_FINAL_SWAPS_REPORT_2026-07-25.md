# Add-exercise final redirects — build report (L2)

**Branch**: `feat/add-exercise-final-three-swaps` → merged to `main` `--no-ff`
(`8f6256a`, feature commit `94ea3a2`, plus `5139690` housekeeping).
**Status**: **Gates green, awaiting Sam device acceptance.**

The cueless-suggestion class is **closed**. All six names the literal lock
surfaced in the live "Add exercise" table now render real curated cues, and the
`awaiting_sam_ruling` queue is empty with the emptiness asserted.

---

## 1. Applied — Sam's three redirects

| Was offered | Now offers | Prescription change |
|---|---|---|
| `Split Squat` | **Reverse Lunges** | none — 2 × 8-10 per side already suited it |
| `Calf Isometric Hold` | **Single-Leg Calf Raise** | `duration` 30-45s → **`reps` 12-15 per side** |
| `Hip Mobility Flow` | **Hip 90/90 Stretch** | `duration_minutes` 5-8 → **`duration` 30-45s per side** |

**Two of the three needed the dose to move with the name.** A name and its
prescription are not independent, and swapping only the name would have shipped a
card that reads as nonsense:

- `Calf Isometric Hold` was an isometric **hold** at 30-45 seconds.
  `Single-Leg Calf Raise` is rep-counted, so leaving the duration in place would
  have prescribed "30-45 seconds" of a movement measured in reps.
- `Hip Mobility Flow` was 5-8 **minutes** of a flow. `Hip 90/90 Stretch` is a
  single hold, so minutes became seconds per side.

Both new doses match their curated pool entry exactly — `CALVES_POOL` (3 × 12-15
per side, "3-second lowering.") and `MOBILITY_POOL` (2 × 30-45s per side,
"Breathe into the stretch.") — so the suggestion and the pool cannot disagree
about the same movement.

Copy was adapted only where the old text described something that no longer
exists: "Move easy." described a flow you move through, and what ships now is a
hold you breathe into.

### Why Reverse Lunges and not Bulgarian Split Squats

Recorded at the call site, because it is the kind of thing that looks like an
arbitrary choice a year from now. The census flagged plain split squat as a
**distinct, easier regression** from Bulgarian — not a synonym. Mapping the
suggestion onto Bulgarian would have handed a beginner the *harder* variant,
which is the opposite of what a split-squat suggestion is for.

### Flow-capable suggestions — deferred, not forgotten

Sam's ruling: a possible future build, not now. The suggestion table emits single
exercises only, so a suggestion naming a `MOBILITY_FLOW_TEMPLATES` entry has
nowhere to land. `Hip 90/90 Stretch` is the honest single-movement stand-in, and
the reason is written at the call site so the next reader does not mistake the
stand-in for the intent.

---

## 2. Verified — zero blank cards

Every name the table can offer, checked through `buildCueText`: **12 of 12 cue.**

```
Reverse Lunges · Hip Thrust · Copenhagen Plank (Half) · Single-Leg Calf Raise
Hip 90/90 Stretch · Open Book Thoracic Rotation · Easy Bike · Tempo Run
Face Pulls · Push-Ups · Pallof Press · Dead Bug
```

The affordance that was handing athletes six blank cards now hands them none.

---

## 3. The lock drove this — third time

I did not go looking for which exemptions to delete. Applying the redirects made
the three parked literals vanish from the sweep, the staleness assertion **failed
the build**, and it named exactly which three to unpark.

That is now three for three: the Phase 1.6 purge cleared `Leg Curl` and `Squat`,
the first swap pass cleared three, and this pass cleared the last three. The
bookkeeping has been done by the gate every time rather than by memory.

`awaiting_sam_ruling` is empty, and a **new §4 assertion checks the emptiness** —
so the next park cannot be a quiet one. The two per-name guards stay in place for
when something is parked again.

---

## 4. Still open — Sam's device read

`Tempo Run` under "Conditioning finisher" **resolves and cues**, so the lock is
satisfied. But it is a real `B-low` / high-impact tempo run, not a flush, and
whether that is the right dose for a finisher slot is a content judgement. It
stays as the finisher pending Sam's read — flagged, not quietly changed.

---

## 5. Gates

| Gate | Result |
|---|---|
| `test:bible` (incl. `test:compile`) | **EXIT 0** — 793 PASS assertions |
| `test:exercise-name-lock` | PASS 10/10 |
| `test:content-reconciliation` | PASS |
| `test:generation-vocabulary` | PASS |
| `test:pools` | PASS |
| `test:locked-list` | PASS |
| `test:exercise-canonicalisation` | PASS |
| `test:authored-cues` / `test:cue-join` | PASS |
| `test:compile` ratchet | PASSED at 474 — unchanged, no file regressed |

Sweep: **46 distinct literals across 97 positions** — 41 resolve outright, 5
typed-exempt, **0 unaccounted, 0 parked**. (Was 60/125 with 6 parked when the
lock was first built.)

---

## 6. NOT-COVERED

- **No device or simulator verification. Device acceptance is the gate.** The
  specific checks: open the "Add exercise" sheet and confirm all five categories
  offer cued cards, and that the two re-dosed entries read correctly —
  Single-Leg Calf Raise as **12-15 reps per side** (not seconds) and Hip 90/90
  Stretch as **30-45 seconds per side** (not minutes).
- **`Tempo Run` as a finisher is unresolved** — see §4.
- **Flow-capable suggestions are not built.** `Hip 90/90 Stretch` is a stand-in
  for what the Mobility slot arguably wants (a flow template). Deferred by Sam.
- **The literal lock's limit is unchanged**: it closes hardcoded literals, not
  names composed at runtime (template string, join, bare function argument). No
  such site exists today.
- **Pre-existing tracked junk I did NOT clean**, flagged rather than silently
  left: `.tmp-compiled/`, `.tmp-compiled2/`, `.tmp-compiled3/` (63 stale compiled
  `.js` files) and `.tmp_mutation_check.ts` are committed to the repo and predate
  this work. They belong to a follow-up cleanup, not to a ruling-application
  unit. I also removed one zero-byte scratch file of my own that leaked into the
  feature commit (`5139690`).
- **Pre-existing test failures, unchanged and not caused by this unit**:
  `generatedProgramNormalizerTests` (3) and `programmingBiasTests` (1) fail
  identically on `main`.

---

## 7. Next

1. **Sam device acceptance** — the gate, including the `Tempo Run` finisher read.
2. **The power unit** — `POWER_EXERCISE_POOL_SPEC` is now the only substantial
   open item in this area: eight staged power names still have no pool, and it
   owns the missing cues for `Vertical Jump`, `Explosive Push-up` and
   `RFE Split Squat Jump`.
3. Optional housekeeping: the `.tmp-compiled*` directories.
