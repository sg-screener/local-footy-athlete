# Deriving Source-Fact Device-Commit Reassessment — 2026-07-23

> **⚠️ SUPERSEDED (proposed fix only).** The root-cause *symptom* here (the
> `accepted_composition_base_changed_by_temporary_fact` reject) is real, but the
> proposed fix — "Option B: base-preserving deriving commit" — was built on a wrong
> mechanism model: it would make the commit succeed as a **silent no-op** (no reduction,
> because the illness_recovery mode is generation-only and this path never regenerates).
> The corrected diagnosis and the approved direction (scoped regeneration committed as
> authored state) are in
> **`DERIVING_SOURCE_FACT_SCOPED_REGEN_REASSESSMENT_2026-07-23.md`**. Read that one.

**Status:** architecture reassessment required by `CLAUDE.md` (Coach Architecture
Escalation Rule) and `AGENTS.md`. **Design document only — no fix here, and none may
be written until this is approved.** Trigger: the bed-ridden device smoke
(2026-07-23) found that a DERIVING severe source-fact commit fails on the real
device, and the failure is a **deriving-side sibling of the already-fixed Part 2b
finding** (`docs/READINESS_SOURCE_FACT_REASSESSMENT_2026-07-22.md` §Part 2b). The
same class of source-fact commit bug has now appeared twice after a "general" fix
(Part 2b fixed it for INERT facts only), which is exactly the escalation condition.

All `file:line` at branch `diagnose/move-occupied-content-loss` HEAD.

---

## 0. Trigger, provenance & faithful repro

### What broke (device)
On the device-exact seed (`standard-in-season-week`, iPhone 17 Pro), tapping the
week-readiness **"Sick / run down"** tier (bed-ridden → severe illness) shows
*"Couldn't log that just now — give it another go in a moment."*
(`readinessAcknowledgment.ts:40`, shown when `result.ok === false`). The commit
never lands: no reduced week, no disclosure, nothing to clear.

### It is NOT the illness_recovery work — three proofs
1. **Severe FATIGUE (`cooked_week`) fails identically** on the same seed. That tier
   shipped before this branch and this branch does not touch its path.
2. **The failure is before/independent of §18.** If it were a §18 rejection,
   `illness_recovery` (minimums lifted) would make *illness* pass while *fatigue*
   failed. They fail the **same way** → the reject is upstream of the mode.
3. **The commit diff is clear of the verify path.** This branch's only edit to
   `temporarySourceFactTransaction.ts` is a disclosure **string**;
   `acceptedStateTransaction.ts` / `verifyCandidate` are untouched.

### Provenance — why this was never caught
- The R1–R10 readiness invariants use the **R1-style seed** (`seed()` in
  `readinessSourceFactOwnershipTests.ts`), which leaves `acceptedCompositionBase`
  **null** — so `verifyCandidate`'s composition-base check is trivially satisfied
  and the class is invisible. Part 2b called this out for the inert case; the same
  blind spot hides the deriving case.
- **R11** added a device-exact base but only exercises an **inert** fact.
- The **Group B item 2 device passes covered only the minor/inert tier + the
  lighter-day offer** (`docs/READINESS_SOURCE_FACT_REASSESSMENT_2026-07-22.md`
  §Part 2b "Full device pass"). The **severe tiers were "kept unchanged"** and,
  evidently, **never device-verified**. This gap's provenance is that omission.

### Faithful headless repro (requirement a) — the harness can now see the class
`src/__tests__/derivingSourceFactDeviceCommitTests.ts` (standalone, RED, **not in
`test:bible`** until approved+green): the R11-style device-exact seed +
`executeProgramControlActionDurably({set_illness_status severe})` /
`{set_fatigue_status cooked}`. Both assert the commit is **accepted** and both are
**RED today** ("could not be verified"). Run: `npm run test:deriving-device-commit`.

**Dealing with the runbook epoch-0 `capturedAt` mask.** The mask
(`accepted_state_rollback_mismatch … capturedAt "1970-01-01"`, QA_RUNBOOK) is
strictly **downstream**: `verifyCandidate` rejects on the base-surfaces fingerprint
**before** any rollback runs, so the `ok:false` OUTCOME is deterministic and
clock-independent. A fix that makes `verifyCandidate` pass removes the rollback path
entirely → `ok:true`, no epoch-0. Therefore the harness gates the fix on the
**outcome** (RED→GREEN) without needing to defeat the mask. The **specific reason**
was confirmed with temporary `verifyCandidate` instrumentation (`LFA_DIAG`, reverted):

```
inertComposition: false, factsMatch: true, baseSurfacesMatch: FALSE,
provenanceMatch: true, ledgerMatch: true
→ reason = accepted_composition_base_changed_by_temporary_fact
```

(Recommendation for the fix phase, not now: to make the *reason* observable in the
returned result too, the harness's restore-side epoch-0 `capturedAt` fidelity should
be fixed so `restoreExactPreState` stops masking `candidateVerification.reason` — a
**harness** fix, distinct from the product fix. Not required to gate the outcome.)

---

## 1. Root cause (the spine)

**A deriving source-fact commit re-canonicalises the accepted week and stores the
re-canonicalised surfaces as the composition base, which `verifyCandidate` forbids —
`verifyCandidate` treats ANY change to `acceptedCompositionBase.surfaces` as an
illegitimate mutation by a source fact.**

- `commitTemporarySourceFactSet` (`src/store/temporarySourceFactTransaction.ts`)
  classifies the commit: `inertComposition` = "the set of source-fact constraints is
  unchanged" (`:291`). For a **deriving** fact (severe fatigue/illness adds a
  constraint) `inertComposition === false`.
- The commit is then dispatched (`:321`) with, for deriving facts,
  **`preserveExactAcceptedWorkouts: undefined`** and **`validateWeekStarts:
  horizon.weeks`** (`:335-336`). Without `preserveExact`,
  `commitAcceptedStateTransaction` re-canonicalises the surfaces (runs the §18
  gateway + canonicalisation over the horizon), producing surfaces whose
  fingerprint differs from the pre-commit base.
- `verifyCandidate` (`:353`) compares
  `semanticFingerprint(accepted.acceptedCompositionBase.surfaces)` against the
  captured `baseFingerprint` (`:294`) and, on mismatch, returns
  **`accepted_composition_base_changed_by_temporary_fact`** →
  `coachMutationTransaction.ts:284-302` rolls back and returns `ok:false`.

Part 2b fixed exactly this for **inert** facts by passing
`preserveExactAcceptedWorkouts: true` (`:336`, the `inertComposition ? true :
undefined` ternary). Deriving facts were deliberately left on the re-canonicalising
path — and that is the whole of the bug: **the fix was scoped to the one class that,
by definition, changes nothing, and skipped the class that legitimately changes the
visible week.**

---

## 2. The seven required questions

### Q1 — What is the current source of truth?
The **`acceptedCompositionBase`** — the clean authored surfaces captured at
acceptance (`compositionBase.surfaces`) — plus the **active source-fact constraints**
(`compatibility.activeConstraints`) as an overlay. The visible week is a *projection*
of (base + overlay), re-derived on read (`resolveWeekWithConditioning`; see the §18
reassessment). `verifyCandidate` correctly encodes the invariant **"a source fact
must not mutate the base"** — the base is authored truth; a fact is an overlay.

### Q2 — How many representations of the "I'm not 100%" report exist?
The one report is re-encoded as: (1) the `ProgramControlAction`
(`set_illness_status`/`set_fatigue_status`), (2) the `TemporarySourceFact`, (3) the
composed `ActiveConstraint` overlay, (4) the **re-canonicalised accepted surfaces**
(the deriving commit bakes the reduction into the base), and (5) the projected
visible week. Representation **(4) is the defect**: the reduction is *also* baked
into the base, duplicating what the overlay (3) + projection (5) already express —
so the base moves, and the "base unchanged" invariant fires.

### Q3 — Where can the report be reinterpreted / where does the base drift?
Only one place matters here: the deriving branch of the commit dispatch
(`temporarySourceFactTransaction.ts:335-336`), which routes a deriving fact through
`commitAcceptedStateTransaction` **without** `preserveExactAcceptedWorkouts`. That
re-canonicalisation is the sole producer of the base-surfaces drift. (Whether the
drift is a *semantic* reduction or mere canonicalisation normalisation is immaterial
to `verifyCandidate`, which is fingerprint-exact — Part 2b showed even a record-only
fact drifted the surfaces via normalisation.)

### Q4 — Which layer should own the decision?
**The composition base must be immutable across a source-fact commit — inert OR
deriving. The reduction a severe fact causes is owned by the constraint overlay +
projection, not by mutating the base.** `verifyCandidate`'s invariant is *correct*
and should stand for both classes. The ownership question the fix must answer is
therefore narrow: *how does a deriving fact get (a) §18-validated (R9/R14 require
severe facts to stay gated) and (b) visibly reduced, while leaving the base
byte-stable?* The answer implied by the architecture: validate/project the reduced
week from **base + overlay** without persisting a re-canonicalised base — i.e.
deriving facts should also `preserveExactAcceptedWorkouts` (base stays clean) while
the constraint overlay drives the §18 gate and the visible reduction. (This is the
design to confirm in review — the point of this doc is that it is an **ownership**
choice, not a guard to bolt on.)

### Q5 — What simpler architecture removes representations instead of adding guards?
Delete representation (4). Route **both** inert and deriving commits through the
base-preserving path (`preserveExactAcceptedWorkouts: true`); let the **active
constraint overlay** be the single carrier of the reduction, validated by the §18
gate against the projected week and rendered by the projection. Then:
- `verifyCandidate`'s "base unchanged" invariant holds for every source fact (no
  carve-out, no second code path).
- The severe/deriving class stops re-canonicalising the base, so
  `accepted_composition_base_changed_by_temporary_fact` cannot fire for a legitimate
  report.
- This is strictly fewer representations than today (base no longer duplicates the
  overlay), which is what the escalation rule asks for.

**Do NOT** "fix" this by relaxing `verifyCandidate` to allow base changes for
deriving facts (a guard that reopens the exact hole Part 2b closed), nor by adding a
third commit path.

### Q6 — Which legacy paths should be bypassed or retired?
- The **deriving branch of the commit dispatch** (`inertComposition ? true :
  undefined` at `temporarySourceFactTransaction.ts:336`, and the paired
  `validateWeekStarts` ternary at `:335`) — the split that sends deriving facts down
  a base-mutating path. It should collapse into one base-preserving path with the
  §18 validation expressed over the projected (base + overlay) week.
- Any assumption that "severe reduction ⇒ persist a re-canonicalised accepted week"
  — the reduction lives in the overlay/projection, not the base.

### Q7 — What tests prove the new ownership boundary?
See §3 (proposed invariants). The load-bearing ones: the deriving commit is accepted
against a **real composition base** (D1/D2, already RED), the **base surfaces are
byte-stable** across the commit, the visible week **is** reduced (overlay works), and
clearing the fact restores the base byte-identical.

---

## 3. Finding — the `optionalOnlyMode` generation-vs-recomposition gap (requirement c)

Sam's signed-off illness_recovery semantics require the recomposed bed-ridden week to
mark its remaining sessions **visibly OPTIONAL and reduced** (not cleared to rest).
That marking is implemented **only in the generation path**: `optionalOnlyMode` /
`applyOptionalRecovery` live in `coachingEngine.ts:6865/6851` and operate on
`SessionAllocation` during generation. They are **absent from the projection /
recomposition path** (`sessionResolver.ts`, `visibleProgramReadModel.ts`) that a
durable source-fact commit actually flows through.

Consequence: even once the commit succeeds (Q4/Q5), the recomposed week is at risk of
**not** rendering its sessions as optional/reduced on the day/week surfaces — the
exact "visibly optional" check the device smoke was asked to make, and could not
reach because the commit failed first. **This must be in scope for the fix**: the
optional-recovery marking has to hold on the projection path, or bed-ridden's
disclosed semantics won't match the rendered week. (Design note: this is the
generation-vs-projection duplication the §18 reassessment already flagged — the
projection must own the derived session character, not just generation.)

---

## 4. Proposed invariants (tests-first — RED first, then STOP for review)

Standalone suite `derivingSourceFactDeviceCommitTests.ts` (device-exact base). **D1,
D2 already written and RED.** Proposed additions (to author on approval, before any
fix):

1. **D1 deriving-illness accepted** *(written, RED)* — severe illness commits
   `ok:true` against a real composition base.
2. **D2 deriving-fatigue accepted** *(written, RED)* — severe (cooked) fatigue
   commits `ok:true` against a real composition base (proves class, not
   illness-specific).
3. **D3 base immutability** — across a successful deriving commit, the
   `acceptedCompositionBase.surfaces` fingerprint is **byte-identical** before/after
   (the invariant `verifyCandidate` enforces — pins that the fix preserves the base,
   not relaxes the check).
4. **D4 overlay reduces the visible week** — after the deriving commit the *projected*
   week is genuinely reduced/recovery-tier (the reduction survives as an overlay,
   not a no-op).
5. **D5 cascade restore** — clearing the fact restores the projected week and the base
   byte-identical (deriving sibling of R12).
6. **D6 optional-recovery on projection** *(finding §3)* — the recomposed bed-ridden
   week marks its remaining sessions visibly optional/reduced **through the
   projection path**, not only through generation.

Gate on approval: these green; `test:section18-ownership` 12/12 (monotonic);
`test:readiness-ownership` green incl. R15; `test:bible` exit 0; tsc clean. Only then
append `test:deriving-device-commit` to `test:bible`, and only then re-run the
bed-ridden device pass (commit → reduced+optional week disclosed → clear → restored).

---

## 5. Recommendation

Per the Elegant Solution Requirement, two options:

- **Option A — relax `verifyCandidate` for deriving facts** (allow an "authorised"
  base change). **Reject.** It reopens the Part 2b hole, adds a per-class carve-out to
  the exact invariant that protects the authored base, and keeps representation (4).
- **Option B — base-preserving deriving commit (recommend).** Route deriving facts
  through the same base-preserving path as inert, with the constraint overlay owning
  the §18-validated reduction and the projection owning the visible/optional
  rendering. Deletes representation (4), keeps one commit path and one base invariant,
  and fixes the whole severe class (fatigue + illness) at once. Fold the §3
  optional-on-projection finding into the same change.

**No fix, no door-routing until this is reviewed.** The bed-ridden device pass — and
the branch merge gate — stay red until Option B (or an approved alternative) lands
behind the §4 invariants.
