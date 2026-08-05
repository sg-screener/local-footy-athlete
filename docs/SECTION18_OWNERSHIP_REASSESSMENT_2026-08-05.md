# §18 ownership reassessment — the gate that refuses a sick athlete

The architecture reassessment Sam ordered before any 5b code (2026-08-05
evening ruling). Answers the seven questions from CLAUDE.md. Every claim
below was **measured on this tree**, not inferred; the probe method is the
suite's own `PROBE_5B=1` plus read-only inline runs. **No code is proposed
here beyond ownership; no code was written.**

---

## §0 — Three corrections to the finding-5b framing, from measurement

1. **The deload is not the cause.** Regenerating the same week with **no
   fact, no constraint, no deload** produces the identical rejection
   `pattern_imbalance:strength_patterns:{"squat":2,"hinge":0,"push":0,"pull":2}`.
2. **It is not one door.** Through the real door on the fresh world, **5 of
   8 readiness kinds refuse**: `sore_today`, `poor_sleep_week`,
   `illness_moderate` (identical signature), `cooked_week`, `illness_severe`
   (a different signature, from a later week on the open horizon). The three
   that land (`tired_today`, `poor_sleep_today`, `illness_mild`) land only
   because they take the inert lane and never reach the gate.
3. **The candidate counts the whole week** (history included). Authoring is
   remainder-scoped; counting is not. The kill mechanism is elsewhere — §1.

## §1 — The measured root: the re-authored week is the WRONG WEEK

The accepted week (2026-08-03, week **2** of its block) is balanced:
Mon pull, Tue squat, Fri push, Sat hinge. The block's strength allocation
**alternates by week parity** (`coachingEngine.ts:1121/1197/1342/1871/1883/4627`:
`weekNumber % 2`).

The deriving lane's scoped regen calls generation with
`todayISO: weekStart` and `microcycleLimit: 1`
(`temporarySourceFactTransaction.ts:521-533`); generation then re-derives
block bounds **from that date** (`generateProgram.ts:804`,
`programBlockState.ts:97-112, 359-361`) — so the re-authored week is always
**week 1 of a block that starts that Monday**. Week 1 is the parity mirror
of week 2. The composite candidate is therefore:

- Mon pull, Tue squat — **pinned history** (the real, even-week shape)
- Fri pull, Sat squat — **regenerated remainder** (the odd-week shape)

Hinge and push are not removed and not excluded — **they were never in the
candidate**. The remainder was planned from a different week's layout. Then
`pattern_imbalance` (`section18EffectiveWeekEvaluator.ts:1191-1207`) fires,
and it is the one pattern rule that **reads no governed boundary** — its twin
`pattern_restore_failure` is correctly softened to advisory on partial-week
worlds (`:1177-1183`) for the very same hinge/push facts. The gateway has no
repair kind for `pattern_imbalance` (`Section18WeekRepairKind`,
`section18AcceptedWeekGateway.ts:59-66`), so `regenerate` and `safeFallback`
rebuild the same deterministic content and the result is `impossible`
(`:911` throws), the transaction rolls back, and the athlete's report dies.

**So finding 5b decomposes into three defects:**

- **D1 (root): week identity has two owners.** The accepted program says
  "this is block week 2"; the scoped regen re-derives "week 1" from a date.
  Same class as the deload-shape falsification — two owners of one fact.
- **D2 (residual elapsed-day gap): `pattern_imbalance` is not
  boundary-aware** while its sibling rules are
  (`section18EffectiveWeekEvaluator.ts:1159-1231`). The delivered-vs-remaining
  unit fixed dose, not pattern coverage —
  `section18DeliveredRemainingTests.ts` has no pattern cell.
- **D3 (ownership): a generation-time gate vetoes an athlete's fact.**
  `requireSection18AcceptedWeek` has no `operation` concept and throws
  unconditionally (`generateProgram.ts:634`); the accept-and-reduce ruling
  lives downstream in the transaction (`acceptedStateTransaction.ts:455-475`,
  forward decisions accept and disclose) and is never reached.

## §2 — The seven questions

**1. What is the current source of truth?**
For "the athlete is sick": `acceptedMaterialContext.temporarySourceFacts` —
the typed fact with a durable scope. Correctly singular. For "is this week
valid": the §18 gateway — but invoked from INSIDE generation, where it
cannot know a forward athlete decision from a restoration. For "which week
of the block is this": **two owners** — the accepted program's own week
position, and `computeBlockBounds(todayISO)` re-derivation inside the scoped
regen. D1 lives in that split.

**2. How many representations of the user request exist?**
Eleven between tap and persisted state (kind → action → fact → normalised
set → compatibility constraint → lane signature → generation context →
generated week + contract → §18 candidate/ledger/findings → overlay +
reversible record → accepted state + envelope + projection). The athlete's
sentence is re-expressed ten times and **discarded at the ninth** — a
derivation of representations 7–8 vetoes the persistence of representation 3.

**3. Where can intent, domain, date, target, or scope be reinterpreted?**
Three decisive sites, in order of harm:
(a) `todayISO: weekStart` → block-bounds re-derivation → **week parity
flip** (`temporarySourceFactTransaction.ts:522` →
`generateProgram.ts:804`) — a DATE reinterpreted into a different WEEK
IDENTITY;
(b) the lane predicate `isRuledDerivingConstraint`
(`temporarySourceFactTransaction.ts:725-742`) — whether the report
re-authors the week at all is decided by the shape of a compatibility
projection, which is why `tired_today` (composes nothing) passes and
`sore_today` (composes severity 5) dies;
(c) `pattern_imbalance` ignoring `governedFromISO` — elapsed days
reinterpreted as plannable shortfall.

**4. Which layer should own the decision?**
The **transaction**, under the already-ratified accept-and-reduce rule: a
forward athlete decision is ACCEPTED, the best achievable week is published,
and any shortfall is DISCLOSED (`acceptedStateTransaction.ts:455-475` is the
owner; `programStore.ts:1142-1156` records the same ruling for hydration).
Generation's gate is a candidate-quality instrument; it may fail a
candidate, it must never veto a fact. The illness law's "every minimum still
stands" is a statement about dose targets — nothing in it authorises
refusing the report.

**5. What simpler architecture removes representations instead of adding
guards?**
- **One owner of week identity:** the scoped regen carries the accepted
  week's block position into generation instead of letting generation
  re-derive it from a date. This removes the re-derivation, and with it D1's
  whole class (any mid-week regen of any even-parity week, under ANY
  deriving fact).
- **One owner of week acceptance:** inside the deriving lane, the gateway
  returns its typed result and the TRANSACTION decides — accept-and-disclose
  for forward decisions, throw only for restorations. This is not a new
  mode; it is extending the `operation` distinction that
  `assertAcceptedVisibleLedgerEquivalence` already has to the one caller
  that lacks it. The precedent for representing an accepted imbalance
  already exists: `intentionalImbalanceReason =
  'explicit_user_override:<id>'` (`userRemovalConstraints.ts:245-268`) — the
  deletions path already makes `pattern_imbalance` unrepresentable for an
  athlete decision. Illness/deload/elapsed-remainder have no equivalent; the
  reconciliation is a typed-reduction, not a guard.
- What this REMOVES: the unconditional throw as a fact-killer, the second
  week-identity owner, and the need for any per-kind special-casing (the
  5-of-8 table becomes one rule).

**6. Which legacy paths should be bypassed or retired rather than patched?**
The throwing `requireSection18AcceptedWeek` call inside the deriving lane's
generation (`generateProgram.ts:634` as reached from
`commitDerivingSourceFactScopedRegen`) is the accept-and-reduce ruling's
unreconstructed remnant — the comment at `programStore.ts:2420-2426` already
admits the shape ("one transaction can still reduce a week and then refuse
the reduction"). It is retired by routing the typed result to the
transaction, not patched with a kind-list. **No new resolver, no fallback,
no per-door branch is acceptable under the stop-patching triggers.**

**7. What tests prove the new ownership boundary?**
- The coverage hole, stated exactly by measurement: **no green cell commits
  a deloaded-but-minimums-standing fact through the durable door on a
  mid-week day in a full 6-day generated week at an EVEN block position.**
  T4 (`durableFactHorizonTests`) is green only because its 3-day seeded week
  regenerates into an §18-acceptable shape, and `illness_moderate` is not in
  its kind list. That cell — mid-week, even-parity, real door — is the proof
  cell, and `finding-5b` / `finding-worn-removals` in
  `test:device-pass-2026-08-05` are its declared-red forerunners (their
  ledger text still blames the deload; the fix commit corrects it with the
  measured root).
- A **week-identity conservation cell**: any scoped regen of week N
  re-authors week N — asserted on the block position the generator was
  given, not on downstream content.
- A **boundary twin cell**: `pattern_imbalance` and
  `pattern_restore_failure` agree about elapsed days (D2), red first.
- The walker: readiness kinds through the REAL door become vocabulary
  (already the L12 commitment), so the 5-of-8 table is fuzzed, not
  enumerated.

## §3 — What this does NOT settle

- Whether `cooked_week`/`illness_severe`'s different signature (a later week
  on the open horizon under the optional-week conditioning contract) is
  fully explained by D1's parity flip on that later week, or carries a
  fourth defect. The proof cells will say.
- The right typed representation for "accepted-with-shortfall" disclosure
  copy (signed sentences; Sam's, when the fix unit reaches it).

**Nothing further will be built on 5b until this reassessment is approved.
The finding-7 re-scope, the recovery-choose door cell, and 6b proceed next
per Sam's ordering — none of them touch this pipeline.**
