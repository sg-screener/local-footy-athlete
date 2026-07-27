# Provenance Lock — design

**Date:** 2026-07-28
**Status:** Phase 1 approved (diagnosis). Phase 2 gated on Sam's value-by-value rulings.
**Precedent:** `src/__tests__/hardcodedExerciseNameLockTests.ts` + `src/rules/exerciseNameLiteralSweep.ts`

## The principle

Every number an athlete can see or be prescribed — sets, reps, rest, holds, loads,
multipliers, ratios, caps, paces, durations — must trace to an authored source: the
Bible, one of Sam's sheets, or a Sam-attributed ruling. The build fails on any that
don't.

This extends the exercise-name literal-lock from names to numbers. The name lock
closed the question "who is allowed to name an exercise?". This closes "who is
allowed to decide how much of it the athlete does?".

## Why a lock and not a sweep

A one-time sweep answers "are the numbers authored today?". It cannot answer "is the
number someone adds next Tuesday authored?". The failure the lock exists to prevent is
not the current state of the code; it is the *next* invented number entering it
silently. So the deliverable is a machine gate in `test:bible`, in the same class as
`test:exercise-name-lock`.

## Architecture: candidate generator + reviewed registry

Two parts, mirroring the name lock. This split is the load-bearing decision.

**The sweep** (`src/rules/athleteNumberSweep.ts`) is a syntactic, over-inclusive
candidate generator scoped to prescribed + computed positions. It is deliberately not
smart. A regex can recognise a *prescribed* number — a numeric literal in a dose field
inside an object that also carries identity, the same precision rule that kept the
name-lock residual readable (a dose always comes with its identity; a store key, a
route, a z-index never do). A regex cannot recognise a *computed* one: whether a `0.85`
redoses an athlete's week is a dataflow judgement, not a pattern.

**The registry** (`src/data/athleteNumberProvenance.ts`) is the reviewed ground truth.
The dataflow judgement is made once by a human, recorded, and never re-derived by a
pattern at runtime.

The gate then fails on two independent conditions:

1. a registry entry that no longer holds (source edited, value drifted, anchor gone);
2. **a swept site absent from the registry** — the new-number door.

Condition 2 is what makes this a lock rather than a sweep. Without it the registry is
documentation.

## Scope: prescribed + computed

**In.**

| Class | Examples |
|---|---|
| Prescribed dose | `sets: 3`, `reps: [8,12]`, `restSeconds: 90`, `holdSeconds: 30`, `durationMinutes: 20`, `'3x10'`, `load: 0.7` |
| Computed dose | `volume *= 0.85`, `Math.min(sets, 4)` |
| Exposure / threshold gates | `if (severity >= 6)`, weekly sprint caps, hard-exposure ceilings |

**Out.** Styling and layout (`padding`, `fontSize`, `opacity`, z-index), animation and
timeout durations, array indices, string-length guards, pagination, cache TTLs, retry
counts, IDs.

The boundary test is *does this value flow into a dose, or gate one?* — not a keyword.

## Provenance vocabulary

Four values. Three are authored; the fourth is the pending list.

| Kind | Applies to | Gate mechanism |
|---|---|---|
| `equality_bound` | Sources already machine-readable: the muscle/experience sheet, the conditioning templates xlsx | The existing both-directions equality test. Equality is strictly stronger than an anchor and those sheets already lead the code — do **not** downgrade them to prose anchors. |
| `bible_anchor` | Bible prose | Verbatim quote asserted present in `docs/LFA_PROGRAMMING_BIBLE.md`, and the quote must contain the number. |
| `ruling_anchor` | Sam-attributed rulings, including ones living only in a commit message or report doc | Same mechanism, anchored verbatim to that doc. |
| `UNAUTHORED` | Everything else | Not a kind — the absence of one. Goes to the pending-Sam list; fails the gate. |

### Anchor discipline

The anchor must be **the sentence that states the rule**, never an adjacent line. This
is a real near-miss, not a hypothetical: a recovery-session line almost became the
anchor for a conditioning rule.

Two defences, because a rule I have to remember is not a defence:

- Every anchor is printed in the inventory doc beside its number, so a wrong-sentence
  anchor is visible on the page during review.
- The gate asserts the anchor text *contains the value*, so a nearby line that never
  mentions the number cannot silently qualify.

Neither catches a wrong sentence that happens to contain the right number. Review does.
The doc layout exists to make review possible.

## Registry entry shape

```ts
type Consequence =
  | 'redoses_work'      // changes how much the athlete does
  | 'gates_exposure'    // blocks or allows a session/exposure
  | 'shifts_threshold'  // moves a boundary (severity, readiness, phase)
  | 'display';          // rendered to the athlete without dosing

type ProvenanceKind = 'equality_bound' | 'bible_anchor' | 'ruling_anchor';

interface Attribution {
  ruledOn: string;   // ISO date of the ruling
  where: string;     // resolvable: 'docs/LFA_PROGRAMMING_BIBLE.md:2494' | commit sha | doc path
}

interface ProvenanceEntry {
  value: number | string;
  site: string;            // file:symbol
  consequence: Consequence;
  kind: ProvenanceKind;
  source: string;          // path of the authored source
  anchor: string;          // verbatim rule-stating sentence; omitted for equality_bound
  attribution: Attribution;   // REQUIRED
}
```

### Attribution is required, not conventional

`attribution` is a typed field on every entry. **An entry without it fails the gate
exactly as UNAUTHORED does.** The gate additionally resolves `where` — the file must
exist, the line or commit must resolve — so an attribution cannot be decorative.

The reason is the registry's own failure mode. A registry that accepts entries on
assertion becomes the invention channel the lock exists to close: the cheapest way past
a lock is always to write yourself a pass. Requiring attribution means blessing a new
number takes a diff that visibly claims *Sam ruled this, here* — reviewable, dated,
and falsifiable. Inventing a number and inventing a ruling to justify it are then the
same visible act, rather than the second one being invisible.

## Phase 1 deliverable

`docs/PROVENANCE_INVENTORY_2026-07-28.md`, three parts.

**Part A — authored.** Value, site, consequence, kind, citation, attribution. Recorded,
**not** put in front of Sam. Already-traced values are not re-ruled. Seeds the registry.

**Part B — pending Sam.** Grouped by athlete-facing consequence, highest stakes first:
`redoses_work` → `gates_exposure` → `shifts_threshold` → `display`. Grouped by
consequence and **not by file**, so the ruling session goes fastest where the stakes are
highest. Each row carries: value, site, what the athlete experiences differently if it
is wrong, and my best guess at the intended source — explicitly flagged as a guess, never
as a citation.

**Part C — the three known gaps.** Diagnosed, with the specific assertion each needs.
No fixes in Phase 1.

Phase 1 changes no behaviour. It writes a document.

## Part C — the three known gaps

### 1. `inj()` blank-defaults-to-`'good'` (strength taxonomy)

An unset injury key currently reads identically to "Sam reviewed this and it's safe."
A default must never impersonate an authored ruling — that is the same class of defect
as an unverified citation, expressed in a different layer. Incomplete injury profiles
must fail loud rather than resolve to the permissive value.

### 2. Cues have no enforced source

The muscle/experience sheet is held to the code by a both-directions equality test.
Cues are just a code file — authored once, then drifting freely. Bring cues under the
same sheet-leads-code-follows enforcement.

### 3. Render-truth for labels

The reconciliation gate asks *is load handled?*, not *is the label honest?*. The
Dumbbell Pullovers `BW` case passed every gate while lying on the card. The assertion
belongs at the render seam: a card's displayed dose/load must derive from the authored
values, not from a category's assumption.

Gap 3 is the one that proves the unit is necessary. Every existing gate passed and the
athlete still read a false number.

## Escalation

Stop and report rather than compress rulings if either holds:

- Part B exceeds ~120 rows;
- closing any Part C gap requires an authored source artifact that does not exist yet
  (notably: there is no authored dose sheet today, which is why `equality_bound` is
  reserved for the sheets that already exist rather than being the default kind).

## Calibration

Two findings predicted before the sweep ran, recorded so the report can mark them
held or failed:

1. the strength taxonomy `inj()` default is unauthored;
2. the deload/readiness multipliers are the densest UNAUTHORED cluster in `redoses_work`.

The report states whether each held. A prediction that fails is the more useful of the
two outcomes and gets recorded as such, not quietly dropped.

## Phase boundary

Phase 1 ends at the report. **STOP** — Sam rules value-by-value before any Phase 2 code.
Precedent: the invented-rules purge, where the pending list ended empty of unruled items.
