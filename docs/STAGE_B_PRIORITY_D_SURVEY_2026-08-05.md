# Stage B Priority D — survey of the three carried opens (receipts, no code)

Written 2026-08-05, branch `feat/stage-b-stage2` at `44a3c60`. **Nothing was
implemented.** The three opens are stage-1 handover items 8–10
(`docs/STAGE_B_STAGE1_HANDOVER_2026-08-04.md:215-220`). Each section states
the receipts, the corrections to prior framing, and the option space —
recommendations are marked as the survey's read, not decisions.

---

## D-1. The legacy v1 `exposureContract` vs L15

**CORRECTION TO THE RECORD FIRST.** The stage-1 boundary report and the
walker comment attribute the hydrate-time v1 write to
`validateLiveWeekOverlayWrite`. That attribution does not survive the call
graph: that function's only reachable product caller is the lighter-day
transaction (`lighterDayTransaction.ts:143` → `setWeekScopedOverlay`,
`programStore.ts:1872`) — an athlete-action path. The HYDRATE-reachable v1
writer is a different one: fixture-mark materialisation
(`programStore.ts:2274-2280` → `acceptedStateTransaction.ts:299-326`, `:1731`)
copying `sourceMicrocycle.exposureContract` verbatim into the overlay at
`weekRebuild.ts:220`. Whichever option is chosen, the site named in the
handover is not the site the hydrate path runs.

**The write census (5 writers):**
- **W1** `postGenerationConstraintValidation.ts:1838-1841` — re-derived v1
  attached to an overlay on the lighter-day path; SKIPPED entirely when a V2
  exists on the overlay or base (`:1784`).
- **W2** `weekRebuild.ts:220` — verbatim copy onto the overlay; hydrate-
  reachable via fixture-mark materialisation; re-fires when
  `alreadyMaterialised` is false (judged on the V2 contract).
- **W3** `generateProgram.ts:692,767` — **every freshly generated microcycle
  today gets a v1 contract.** Not residue; if L15 is read literally this is
  the first writer it names.
- **W4** `postGenerationConstraintValidation.ts:1281-1286` — microcycle
  re-write during live validation.
- **W5** `programStore.ts:1553,2812-2817` — `exposureContractsByWeek`, a
  third persisted v1 surface; dormant on V2 installs (producer returns null
  when V2 present).

**Readers:** every product reader sits behind an explicit `if V2 absent`
guard — the bye-mode fallback (`sessionResolver.ts:1690`, dead on V2
installs), the V2-less acceptance throws
(`postGenerationConstraintValidation.ts:688-698`;
`generateProgram.ts:697-713`, self-described as "a compatibility gate only
when v2 is absent"), and date-mutation reconciliation (`pGCV:721-725`). **No
screen or read model reads v1** (`visibleProgramReadModel.ts:29,34` is
V2-only). ~7 test files assert on the v1 field.

**Shape:** NOT LR-27. W2 is a verbatim bounded copy (38 leaves, every one
`undefined → value` — a one-time materialisation, not an accumulator); both
overlay writers self-limit once V2 exists. The defect claim, if any, is
L15's (a retired shape still being written), not per-launch growth.

**Load-bearing nuance:** `domain.ts:665-667` records that v1 "runs alongside
the legacy acceptance contract **until the final commit-gateway slice is
approved**" — v1's retirement was STAGED behind a gate nobody has declared
closed. That is the strongest argument this is not yet a red-gate defect;
L15's own text ("never written again, by anything, ever") admits no
"temporarily" clause once it applies.

**Census:** no entry (zero `exposure` hits in the census).

**Options for Sam:**
- **(a) Retire the writers, migrate readers to V2.** L15-literal. The true
  scope is W3-first (generation itself), dragging the generation-time
  compatibility throw, the bye-mode fallback and ~7 test files. Contained
  first slice exists: delete only the OVERLAY writers (W1 `:1840` + W2
  `:220`) — consumers all fall back to the microcycle's v1, no test asserts
  the overlay copy.
- **(b) Keep, typed as staged compatibility** until the commit-gateway slice
  is declared closed — then (a) fires. Requires declaring WHO closes that
  gate, or the note rots into the compatibility feature L15 forbids.
- **(c) File as a census unit** (measured, named law, bounded consumers);
  costs a ceiling raise.

Survey's read (not a decision): (b)'s staging clause is real but unowned;
the overlay-writers-only slice of (a) is cheap, contained, and reduces the
v1 surface from three to two without touching the staged gate.

---

## D-2. The hydration-repair in-place branch (`programStore.ts:1216-1219`)

**What it is, established:** inside `canonicaliseAcceptedBoundaryState`, when
the §18 gateway's repaired day disagrees with the composed day AND
`dateOverrides` already owns the date, the branch **overwrites the athlete's
stored override with the gateway's output in place** (`:1218`) or deletes
the entry (`:1219`). The result reaches disk on both paths (hydration
readback forces bytes to disk, `programStore.ts:244-254`; every accepted
commit routes through `canonicaliseAcceptedStateCandidate`,
`acceptedStateTransaction.ts:646`). It is a **stored-output write**: derived
gateway output stored under the athlete's date key — and downstream it is
stamped `authorship: 'athlete'` (`acceptedEffectiveWeek.ts:130-147`).

**Four receipts that sharpen the parked question:**
1. **The carve-out's own test proves less than the carve-out claims.**
   `derivedRepairOwnershipTests` cell 4 asserts KEY-SET preservation only —
   no assertion anywhere that the athlete's authored CONTENT survives. "The
   athlete owns the key" is proven; "so he owns the stored value" is not.
2. **The write bypasses the door's tape.** `applyProgramOverrideSliceWrite`
   is "THE DOOR… every write names itself"; the in-place swap changes no
   count, names no writer, and has no `ProgramOverrideWriterId` member. The
   census's §2e class ("writes that do not go through the door"), restated
   as mechanism.
3. **Redirection is mechanically inert.** `dayPrecedence.ts:151-160` puts
   the override above the overlay on BOTH stacks, so a repair filed in the
   overlay is shadowed by the very override it repairs. "Just move it" is
   secretly a precedence-reordering decision (decision-1 class).
4. **Nothing measures it.** The branch is reached constantly (walker
   overrides + every commit) and asserted NOWHERE; the only relaunch-proof
   world (`walkTheL16Slice`) never authors an override, so the `:1217` guard
   is never true across a relaunch. Whether this branch churns, grows, or is
   a no-op on a worn world is unknown — the exact epistemic state LR-27 was
   in before the probe.

**Also flagged — census bookkeeping gap:** the census FILE on disk closes at
26 units and its "LR-27" is the injury-door unit; the stage-1 report's LR-27
(provenance growth) and the handoff's "census at 27" are not reflected in
the file.

**Options for Sam:**
1. **Ratify as written + add the missing content assertion** (cheapest;
   ratifies an untaped stored-output write on the surface stage 0
   recommended locking down).
2. **Narrow to non-athlete-authored entries** (prerequisite missing: the
   branch reads no per-entry authorship; and coach entries sit under LR-6).
3. **Redirect + precedence change or clear the override** (inert without
   the second change; the second change is decision-1 class; clearing is the
   forbidden "delete the write" fix).
4. **MEASURE FIRST — the LR-27 method**: extend the relaunch cell with a
   `plan_change` that authors an override, diff `dateOverrides` across
   relaunch, then rule on evidence.
5. **File as a census unit** in the stored-output family beside
   LR-25/26/27 (also fixes the census bookkeeping gap); ceiling cost.

Survey's read (not a decision): 4 is the same move that turned LR-27 from
suspicion into fact in one run, and every other option is currently chosen
without evidence; 5 composes with it.

---

## D-3. The two-facts tie-break in `activeReadinessFactIdForDate`

**The headline receipt: the tie-break is ALPHABETICAL BY FACT-KIND.**
`normalizeTemporarySourceFacts` sorts by `factId`
(`temporarySourceFact.ts:576-577`), ids embed the kind as a string prefix
(`:1037-1054`), and the function takes `.find` — so, deterministically:
**fatigue beats illness beats poor_sleep beats soreness.** A byte-comparison
artifact of an id format chosen for stability. Nobody authored it.

**The decision it re-guesses was already made and is being thrown away.**
The athlete's tap commits exactly one fact and the door RETURNS its id
(`programControlActions.ts:1493,1554`); `HomeScreenV2.tsx:905-908` discards
it, keeping only `{ date }`, and the transaction then re-derives "which
fact" from the date. The north-star defect in one frame: a decision existed,
was dropped, and a derivation invents it back.

**It matters visibly.** The picked id is the cascade-undo foreign key
("You can undo this anytime by clearing…"). And a SECOND selector answers
the same question differently: `visibleReadinessState.ts:103` picks
prefer-today-else-first for the card's Clear button. Concrete divergence: an
open `cooked` fatigue window + today's `illness_mild` tap → the card's Clear
resolves the ILLNESS fact while the trim is linked to the FATIGUE fact —
the athlete clears, reads "Cleared — today's back to its original session",
and the day stays trimmed.

**Coexistence is real, not theoretical:** the doors are independent handlers
(only poor-sleep dedupes against itself, `programControlActions.ts:1508-1512`);
the sheet routes back to the leaf list while a fact is active (two taps);
and Stage 1's open horizons make durable facts cover every later date.
**Zero tests pin the tie-break in either direction.**

**No authored kind-priority exists to import:** the illness law UNIONS the
two doors ("more protective per field", `readinessIllnessLaw.ts:201-219`)
and explicitly lets mild illness feed the readiness door. Where the codebase
does rank overlapping facts it ranks by **severity then recency** — never by
kind (`temporarySourceFact.ts:672-674,755-757`;
`illnessRecoveryWeekMode.ts:24-46`, "The order is the law's, not this
file's").

**Census:** no entry; not in the parked-questions doc either.

**Options for Sam:**
- **(a) Severity-then-recency ordering** — a derivation from the codebase's
  three existing overlap resolvers; a fresh kind ladder would be new law
  needing your signature.
- **(b) Pass the authored factId through** — widen `lighterDayOffer` to
  `{ date, factId }` and delete `activeReadinessFactIdForDate` entirely. No
  derivation, no tie-break, no possible disagreement with what the athlete
  just did.
- **(c) Make the doors prevent coexistence** — evidence is against it: the
  fact set is information (R21 renders two facts as two notes; the law
  consumes both); collapsing them destroys what the athlete reported.
- **Orthogonal, needed under (a) OR (b): one owner for "which fact is THE
  fact for this day"** — today `visibleReadinessState.ts:103` and the
  transaction answer it differently, and the athlete-visible undo promise
  depends on them agreeing.

Survey's read (not a decision): (b) is the only option that stores a
decision instead of deriving one, and it deletes a representation rather
than adding a rule; the selector unification rides along either way.

---

## Cross-cutting

- Two prior-record corrections made by this survey: the D-1 hydrate-writer
  attribution, and the census file's missing 27th unit (D-2).
- All three opens share one class with the switchover's two unpredicted
  movements: **a derivation standing where a decision (or a typed field)
  already exists** — the v1 contract beside V2, the gateway's repair beside
  the athlete's stored value, the re-guessed fact beside the returned
  factId.

**Nothing here is implemented.** Implementation order — including rulings
1, 4, 5 from `docs/SWITCHOVER_PARKED_RULINGS_2026-08-05.md` — awaits the
next instruction.
