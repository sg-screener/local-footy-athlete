# Ownership reassessment — power as a row, not a block

**Status:** written before any code, per Sam's ruling and the CLAUDE.md
escalation rule. Nothing in this document is built.

**Trigger:** Unit 2's diagnose sweep found that moving power into `exercises[]`
changes counting semantics rather than just rendering. Sam's instruction was to
stop and produce this before coding.

**Target architecture to evaluate (Sam's words):** single `exercises[]` list,
typed role on every row, fence semantics carried by the role at one choke point,
`powerBlock` + alignment module retired, §18 operating on rows.

---

## 1. What is the current source of truth?

For "does this session contain power, and what does it count as", there are
**two** sources today and they answer different halves:

- `workout.powerBlock` — a nullable field beside `exercises[]`. It owns the
  fact that power EXISTS, its family, its dose, and its counting fence
  (`hardExposure: false, mainStrength: false, conditioningCredit: 'none',
  isFinisher: false`).
- `workout.exercises[]` — owns everything the athlete performs that anything
  counts. Every counter, classifier and validator reads this list.

The fence is currently enforced **by construction**: power is not in
`exercises[]`, so nothing that iterates exercises can count it. The fence
object is documentation of a fact that the data shape already guarantees.

That is the crux. The fence is not enforced by logic — it is enforced by
absence. Move power into the list and the guarantee evaporates unless something
else re-establishes it.

## 2. How many representations of "a thing the athlete performs" exist?

**Four**, and power is the only one that is not a row:

| Representation | Home | Counted by |
|---|---|---|
| Strength / conditioning / recovery rows | `workout.exercises[]` | everything |
| Power | `workout.powerBlock` | nothing (by absence) |
| Conditioning block | `workout.conditioningBlock` | partially |
| Speed block | `workout.speedBlock` | partially |

`sessionTemplate.ts` already composes all four into ONE visible list for
rendering (the D13 one-list composition owner). So the one-list design exists at
the VIEW layer and stops there; the DATA layer still carries four shapes. Unit 2
is the proposal to push the view layer's shape down into the data.

Note this makes power the *last* of the separate boxes in rendering terms but
NOT the last in data terms — `conditioningBlock` and `speedBlock` remain. A
decision is needed on whether this unit sets the pattern for those two or
special-cases power.

## 3. Where can the fence be reinterpreted?

Three places, and the first is a live defect risk rather than a theoretical one.

**(a) `sessionTaxonomy` classifies by NAME, over `exercises[]`.**

Four probes iterate the list: `detectModality` (157), the strength-region
probe (222), `hasMainLiftExercises` (237), `hasStrengthExercises` (316).

Measured against the seven pool entries:

| Power entry | matches `MAIN_LIFT_EXERCISE_RX` | is a `STRENGTH_EXPOSURES` exposure |
|---|---|---|
| **Explosive Push-up** | **YES** (via `push[-\s]?ups?`) | **YES** (`horizontal_press`) |
| Vertical Jump | no | no |
| Pogo Hops | no | no |
| Depth Jumps | no | no |
| Lateral Jump | no | no |
| Lateral Bounds | no | no |
| Kneeling Jump | no | no |

`hasMainLiftExercises` is the gate that decides whether an accessory-named
session counts as `upper_strength` instead of `gunshow_prehab`. A power row
would supply **main-lift proof** — directly contradicting `mainStrength: false`
and flowing into `countWeeklyExposures` → `mainStrengthExposures` → the 4-session
cap and hard-day grading.

Six of seven entries are harmless. One is not. That asymmetry is what makes this
dangerous: it would pass most tests and most device passes.

**(b) The exercise budget.** `maxExercisesPerStrengthSession` — a power row
would consume a slot. (Sam's 2026-07-27 rulings resolve this: one cap for every
training age, the invented beginner cap of 3 abolished, and power never counts
against the cap.)

**(c) §18 strip operations.** `section18AcceptedWeekGateway` runs a weekly power
BUDGET selector that keeps primers on chosen days and strips the rest via
`powerBlock: undefined` — a field delete. As a row, stripping becomes removing
an element from `exercises[]`, which must route through the transaction owner.
Nine sites across the codebase do a field-delete strip today.

## 4. Which layer should own the decision?

**One choke point at the taxonomy's iteration source**, per Sam's ruling — not
per-probe guards.

The taxonomy's four probes should read from a single role-filtered accessor
rather than `workout.exercises` directly: rows whose role participates in
strength classification. The name probes below stay name-based, over an
already-filtered list. Scattered per-probe guards are the patch pattern this
repo bans, and with four probes today they would rot the moment a fifth appears.

The same choke point serves the exercise budget: counting strength-role rows,
not all rows.

This gives the fence a **positive** definition for the first time. Today it means
"power is not in the list". After, it means "power's role does not participate in
strength counting" — a fact the code states rather than a fact the data shape
implies.

## 5. What simpler architecture removes representations instead of adding guards?

The target Sam named, stated as a diff in representations:

| | Before | After |
|---|---|---|
| Performed things | 4 shapes | 1 list, N roles |
| Fence | by absence | by role, at one choke point |
| Power presence | `!!workout.powerBlock` (26 files) | `rows.some(r => r.role === 'power')` |
| Power strip | field delete (9 sites) | row removal via transaction owner |
| Alignment | `rules/powerBlockContentAlignment.ts` | **deleted** — nothing to align |

`powerBlockContentAlignment.ts` exists solely to keep a parallel structure
consistent with the list. One list means the module has no job. Its deletion is
the clearest evidence the redesign removes a representation rather than adding a
layer — and, per Sam, leaving the field-delete path alive would keep the old
representation breathing.

## 6. Which legacy paths should be retired rather than patched?

- `PowerBlock` / `PowerBlockOption` types — retired once rows carry role + dose.
- `workout.powerBlock` field — retired. **This is a persisted-shape change**:
  stored programs carry it, so a read-path migration is required. Not optional
  and not free; see risks.
- `rules/powerBlockContentAlignment.ts` — deleted entirely.
- `PowerPrimerSection.tsx` (the V1 screen's renderer) — dead with `PowerRow`.
- The nine `powerBlock: undefined` strip sites — replaced by row removal.
- `sessionTemplate.ts`'s `kind: 'power'` branch — collapses, since a power row
  is already a row.

Explicitly NOT retired: `powerPrimerPolicy` (owns whether power happens and its
dose), `powerExercisePool` + `selectPowerExercise` (owns identity, block-stable
on mini-cycle). Both are upstream of representation and untouched.

## 7. What tests prove the new ownership boundary?

Byte-equivalence is the bar. The invariants Sam named, each with the test that
would prove it:

| Invariant | Proof |
|---|---|
| `hardExposure: false` | a week with power has identical `hardDays` before/after |
| `mainStrength: false` | identical `mainStrengthExposures`; plus a targeted case for **Explosive Push-up**, the one entry that would flip it |
| `conditioningCredit: 'none'` | identical `conditioningExposures` |
| `isFinisher: false` | identical finisher counts |
| Weekly power budget | the §18 gateway keeps/strips the same days for the same input |
| Block-stable selection | selector output unchanged; mini-cycle seeding untouched |

Plus two structural gates, because the fence's new home must be defended:

- **One choke point** — the taxonomy references no un-filtered
  `workout.exercises` iteration. Structural, like the power selector's
  no-clock/no-randomness assertion, because a future edit adding a fifth probe
  that reads the raw list is exactly the regression to catch.
- **No second strip path** — no `powerBlock: undefined` remains anywhere.

The strongest available proof is a **differential test**: generate a set of weeks
on the current code, snapshot every count, then assert the new architecture
reproduces them exactly. That converts "we think the fence survived" into
evidence, and it is the only way to cover the counters this sweep did not find.

---

## Recommendation

**Do the redesign.** It removes a representation, deletes a module, and gives the
fence a positive definition. The incremental alternative — keep `powerBlock` and
add role guards where power leaks — fails the CLAUDE.md test outright: it adds
guards, keeps four shapes, and leaves the fence enforced by absence.

Two conditions on that recommendation:

**1. The persisted-shape migration is the real cost, and it is not in Sam's
brief.** `workout.powerBlock` exists in stored athlete programs. Retiring the
field means a read-path migration that lifts a stored `powerBlock` into a power
row. Without it, existing athletes silently lose their power work. This is the
one part of the target architecture I would not build without an explicit ruling
— it touches stored data, and the brief covers rendering and counting.

**2. Scope boundary on the other two blocks.** `conditioningBlock` and
`speedBlock` have the same shape problem. Doing power alone is coherent (power is
what Sam ruled on) but leaves the pattern half-applied, and the choke point built
here will need to serve them later. Recommend building the choke point
general — role-filtered iteration, not power-specific — so the later units
extend it rather than replace it.

### Suggested staging

| Stage | Content | Gate |
|---|---|---|
| 0 | Beginner-cap abolition + the sweep's other findings | rules-kernel green |
| 1 | Differential harness: snapshot all counts on current code | harness reproduces itself |
| 2 | `role` on rows + the single role-filtered choke point; `powerBlock` still populated | every count byte-identical |
| 3 | Power becomes a row; §18 strips rows through the transaction owner | differential green, §18 suites green |
| 4 | Retire `powerBlock`, alignment module, PowerRow, PowerPrimerSection | no strip path remains |
| 5 | Read-path migration for stored programs | **needs Sam's ruling first** |

Stage 2 is where the risk concentrates: it is the only stage where both
representations exist at once, which is also what makes byte-equivalence
provable there.

---

## Appendix — the beginner-limit sweep (Sam's request)

Sam abolished `maxExercisesPerStrengthSession: 3`. He asked what else the code
invents. `NEW_ATHLETE_POLICY` carries **12** beginner-specific values. Scored
against Bible §11's authored text:

| Value | Authored? | Note |
|---|---|---|
| `compoundRepMin/Max: 4-8` | **YES** | §11: "4-8 reps" |
| `BEGINNER_EXERCISE_PRIORITY` | **YES** | matches §11's "Good options" list |
| `maxExercisesPerStrengthSession: 3` | **NO** | abolished by Sam 2026-07-27 |
| `maxSetsPerExercise: 2` | **CONTRADICTS** | §11 says "2-3 sets" twice; the code caps at 2, stricter than Sam authored |
| `targetRpeMin/Max: 6-7` | **NO** | §11 says "not close to failure" — no RPE numbers |
| `initialLoadMultiplier: 0.75` | **NO** | no such number in §11 |
| `avoidCombinedStrengthConditioning: true` | **INTERPRETED** | §11 says "avoid smashing them with hard conditioning too soon" — that is about dose, not about combining |
| `maxCoreSessions: 2` | **NO** | no beginner core number in the Bible |
| `maxHardExposures: 3 / 3 / 3` | **PARTIAL** | §17 has a mid-off-season beginner line ("2 strength, 2-3 conditioning, 1 safe sprint"); a flat 3 across all phases is not authored |
| `maxOptionalSessions: 1` | **NO** | no beginner optional-session number |

**Reported, not changed** — per Sam's instruction. The one worth his attention
first is `maxSetsPerExercise: 2`, because it does not merely invent a limit, it
CONTRADICTS authored text: the Bible says beginners start with 2-3 sets and the
code forbids the 3.
