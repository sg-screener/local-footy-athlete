# CONSTRAINED-WORLD ACCEPTANCE — 2026-08-14

**Base: `slice-b2-generation-core` @ `54758870`.** Branch
`slice-b3-constrained-worlds`. Separate worktree; the shared checkout was never
touched.

**HEADLINE: no legacy repair route executes during generation in ANY of the ten
constrained worlds, and the 120 built worlds are unchanged — zero lost, zero
gained, zero content differences.** Three review findings closed, and two real
defects were found on the way that neither the findings nor the sweep named.

---

## 1. REVIEW FINDINGS — CLOSED

### F1 — ADAPTER OWNERSHIP. A spread was the defect.

The merge let the adapter's whole `Workout` host the composer's day. Each
previous fix was the field that had just been noticed:

| sighting | field lost | cost |
| --- | --- | --- |
| 1 | `speedBlock` (the app's only app sprint credit) | a refusal blamed on an inert envelope for three sessions |
| 2 | identity — a stripped day called itself `Conditioning`/`optional_flush` | 12 worlds |
| 3 | **`composedGaps`** — the typed record of what this kit cannot train | dropped on every day with an adapter counterpart |

**So the guard is about the CLASS.** `adapterContributionFrom` reads the adapter
day down to **12 enumerated non-strength fields** plus its non-strength rows;
`applyContribution` throws `AdapterOverreachError` if a contribution names any
composer-owned key. The composer day is the base, so its fields survive by not
being overwritten rather than by being remembered in a copy list.

`LAW-generated-week-assembly` registered **with its guard in the same commit**
(registry 126 rows, 105 guarded, UNENFORCED unchanged at 21).

**Mutations, all red:**
- **all TEN composer-owned fields** attempted individually — all ten refused.
  Catching `composedGaps` alone would have produced a fourth sighting.
- dropping the adapter's `speedBlock` is visible in the assembled day, with a
  control proving it IS carried when given.
- re-applying the sighting-3 spread reds the gaps cell (29/1); restoring → 30/0.

**`composedGaps` now traced through all five boundaries** — composer →
materialiser → assembly → validated program → **boot regeneration** — and
survive every one. The old cell stopped at materialisation, which is precisely
the boundary where the loss did not happen. Its monkeypatch teardown is fixed:
every spy is restored in a `finally`, so a later cell cannot inherit a patched
module.

### F2 — DELOAD / READINESS / ILLNESS. It reached only the adapter.

`buildWorkoutsFromCoach` applied the deload to the rows it built; composer rows
never enter that builder. **A composed week was the only week in the app whose
strength ignored an active deload, an illness reduction or a readiness window.**

Threaded, not reimplemented: generation resolves the instruction with the **same
two owners** the adapter uses, narrows it **per day** with the existing
readiness-window predicate (R-035), and `materialiseComposedWeek` applies
`applyStrengthDeloadToExercises` **once**. No second table; no round trip
through the legacy builder.

**⚠ AND THE FIRST WIRING LOST TWO WORLDS, WHICH FOUND A REAL DEFECT.**
`isMainStrengthRow` decides by NAME (`classifyPoolSlot(name)?.role === 'anchor'`).
On a dumbbell or bodyweight kit no anchor is legal, so the composer deliberately
puts a pool ACCESSORY in the main-lift role. The deload therefore called the
day's actual main lift an accessory and **the trim deleted it**. R-092 says those
rows carry the role, so the predicate now reads the declaration and asks the pool
table only about rows that never declared anything. **Mutation: removing that
read drops the sweep 120 → 118; restoring returns 120.**

### F3 — STALE MIGRATION RECEIPT.

`FEAT-legacy-program-migration` claimed `held` by
`test:legacy-migration-unreachable` — a suite deleted with its subject. **The
gate was reporting a feature PROVEN by a script that does not exist.** The
registry had no way to say "deleted", which is why the lie was structural: a
roster whose only options are *held* and *unproven* forces a deleted feature to
keep claiming one of them.

Added a typed `deleted` proof state carrying `deletedIn` and `wentWhere`. The
gate refuses a deleted row that names a guard, or whose `reachable` still claims
the code is there. **No deleted migration code was restored.**
`test:feature-registry` 6/0; roster now reads *9 rows, 7 held, 1 UNPROVEN,
1 built but unreachable, 1 DELETED*.

### ANCHOR→ACCESSORY — guarded without restoring `applyPoolRotation`

| kit | behaviour | cell |
| --- | --- | --- |
| full gym | main lift is the pool **anchor** | asserted, with `classifyPoolSlot(...).role === 'anchor'` |
| dumbbells | a legal **accessory** takes the main-lift role | asserted, plus a control proving `Back Squat` really is illegal there, so the fallback is not decorative |
| bodyweight | impossible slot is **omitted and disclosed** | typed gap present, names what the kit would need, and every composed row is legal on the kit |

---

## 2. THE CONSTRAINED MATRIX

Ten worlds through the real production entry. `repair @generation` is watched
with a **liveness control**: the same watch fires at commit in every world, so
"none" at generation is a receipt and not a silence.

| world | outcome | dose vs control | repair @generation | boot |
| --- | --- | --- | --- | --- |
| CONTROL — unconstrained full gym | BUILT | — | **none** | IDENTICAL |
| INJ-UPPER — shoulder | BUILT | 4/14 re-dosed, 3 removed (`Back Squat 3x2-4@107.5 → 1x2-2@75`) | **none** | IDENTICAL |
| INJ-LOWER — knee | BUILT | 4/17 re-dosed (`Deadlift 3x2-4@100 → 1x2-2@70`) | **none** | IDENTICAL |
| EQUIP — bodyweight-only constraint | **REFUSED** `required_safe_patterns_present:squat` | n/a | **none** | n/a |
| ILL-MOD — moderate illness | BUILT | 6/13 re-dosed (`3x2-4 → 2x2-4`, weight HELD), 4 accessories trimmed | **none** | IDENTICAL |
| ILL-SEV — severe illness | BUILT | same shape as ILL-MOD | **none** | IDENTICAL |
| READINESS — midweek window | BUILT | 0/17 re-dosed | **none** | IDENTICAL |
| DELOAD-SCHED — block week 4 | BUILT | 0/7 re-dosed, 10 removed | **none** | IDENTICAL |
| SCHED-CONSTRAINT — Friday unavailable | BUILT | 0/17 re-dosed | **none** | IDENTICAL |
| WEEK-4 — unconstrained | BUILT | 0/7 re-dosed, 10 removed | **none** | IDENTICAL |

**`gateway @commit` fires in every built world** — that is
`programStore.canonicaliseAcceptedStateCandidate` re-gating on the accepted-state
commit, which is the retained edit/commit route and is untouched by design. It is
reported separately precisely so it is not mistaken for a generation repair.

**Composer strength reached storage unchanged apart from the explicitly governed
constraint** in every built world: the only dose movements are the injury and
illness reductions above, each attributable to a named policy.

### The one refusal, and why it is acceptable

`EQUIP` refuses `required_safe_patterns_present:**squat**` — and the pattern name
is in the signature because this matrix is what proved it was needed. Measured:
the kit resolves identically to a bodyweight PROFILE
(`tags: ['bodyweight']`, `kitUnachievable: ['pull']`), so `pull` is correctly
**disclosed**, not refused. The refusal is for `squat`, which IS achievable on
bodyweight. **That is the explicit contract saying the requested week is
impossible as composed, and no legacy repair ran** — it is the same
composition-gap class as the 60 ordinary refusals, which are out of scope.

---

## 3. BASELINE WORLD DELTAS

| | worlds |
| --- | ---: |
| RETAINED | **120** |
| GAINED | 0 |
| LOST | **0** |
| content changed among retained | **0** |

Every change in this slice is a mechanism change, so the ordinary week is
byte-identical — which is exactly the control the mission asked for.

---

## 4. WHAT FOUGHT ME

- **My own matrix lied twice before it told the truth, and both were instrument
  faults I had to catch myself.** (a) It supplied a pre-built
  `generationConstraints`, and every deload world reported 0 rows re-dosed —
  because `buildGeneratedMicrocycles` REBUILDS the context per week whenever
  `args.activeConstraints` is set, and it is ALWAYS set (an array that is merely
  empty). **A caller-supplied constraint context is discarded before `doorDeload`
  reads it.** (b) It passed illness as a generation option without seeding the
  store, so the relaunch regenerated for an athlete who was no longer ill and
  read as a boot difference. Seeding the fact turned both worlds IDENTICAL,
  which is what confirmed the diagnosis rather than assuming it.
- **The repair watch could not tell generation from commit** and reported the
  gateway running in every world, including the control. Splitting it — and
  keeping the commit-time count as a liveness control — is the difference
  between "no repair ran" as a claim and as a receipt.
- The first `composeWeek` fixture omitted the top-level phase fields the dose
  owner reads and crashed inside `resolveComposedDose` — a fixture fault
  wearing the appearance of a defect.

---

## 5. NOT ESTABLISHED

- **Whether a caller-supplied `generationConstraints` is meant to survive the
  per-week rebuild.** Measured that it does not; not judged. It is reachable
  from authoring callers mid-transaction, which is exactly when a caller would
  supply one.
- Whether `SCHED-CONSTRAINT` and `READINESS` produced *no* change because the
  constraint legitimately does not move strength dose, or because the fact did
  not reach the surface that would move it. Both built and both boot identically;
  the null result is reported rather than interpreted.
- Whether `EQUIP`'s missing squat is a composer gap or a planner/kit mismatch
  (the plan is authored for the athlete's home kit while the content is authored
  for the away kit). Named, not diagnosed.

## 6. NOT COVERED

- **The remaining 60 ordinary refusals** — explicitly out of scope.
- **Bye weeks, practice-match weeks, away spans and travel facts** — not in the
  matrix.
- **Combinations**: every world carries ONE constraint. Injury + illness, or a
  readiness window inside a scheduled deload, are unmeasured.
- **Weeks 2 and 3** of a block; the matrix runs weeks 1 and 4.
- **No device or simulator pass.** Everything is headless through the same
  functions the app calls.
- **Conditioning and power under constraint** are asserted only as "unchanged
  treatment" — the adapter still owns them and was not re-measured in depth.

---

## 7. MERGE RECOMMENDATION

**Merge.** Every gate is green on its unchanged baseline, the 120 built worlds
are untouched, no legacy repair executes during generation in any constrained
world, and every new guard has been seen red. The one refusal is
contract-named, kit-correct in its disclosure, and of a class already declared
out of scope.

**Two things a reviewer should read before merging rather than after:** the
`generationConstraints` discard in §4 (a real plumbing asymmetry this slice
found but did not fix), and §5's three open questions — none of which block the
route, all of which are cheaper to answer now than after the next slice.

*Agent: core, 2026-08-14.*
