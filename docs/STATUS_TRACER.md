# TRACER — this seat's own status file. ONE WRITER: this seat.

**NAMED 2026-08-14.** Sent in on the LEGACY GENERATION INTERFERENCE AUDIT —
measurement only, ahead of severing the old strength-content builder. `tracer`
because that is what it does: it traces composer output through the lifecycle's
boundaries. `ls docs/STATUS_*.md` and the last 15 commit stamps showed the name
free (`baseline`, `kit`, `elegance`, `seat` live recently).

**EVERY COMMIT FROM THIS SEAT ENDS `Agent: tracer`.**

---

## THE AUDIT — DELIVERED

**Document:** `docs/LEGACY_GENERATION_INTERFERENCE_AUDIT_2026-08-14.md`.
One pointer line + three ledger one-liners appended to
`docs/MISSION_THREE_FIXES.md`. Nothing else in the shared tree was touched.

**Base:** `slice-b1-cp2` @ `943e030b` (also the tip of `slice-b1-pivot` and
`legacy-strength-builder-preserved`), measured in a detached worktree under the
session scratchpad with the main checkout's `node_modules` symlinked in. The
shared checkout never left `main`.

**Method:** temporary `__AUDIT_TAP__` boundary probes (composer output, §18
input, gateway output, post-top-ups) + `__AUDIT_ATTR__` execution taps on nine
suspect mutators + a harness that walks the real doors (fresh install →
onboarding → `generateProgramLocally` → `commitRebuiltProgram` → flush →
storage snapshot/restore → full rehydration → `runQuiescentBoot()` →
`buildProgramTabProjectedWeek`/`projectWithGapsMarked`). Semantic fingerprint
only (identities, roles, patterns, dose, removal records, conditioning
signature; no ids/timestamps). Three env-gated mutants proved the quiet edges
(c→c2, d0→d1, d1→e) each red at exactly their own boundary. **All probes and
mutants died with the worktree.**

## HEADLINES (full detail in the audit doc)

1. **The program is never persisted.** `programStore.partialize` writes inputs
   only; every launch regenerates via `quiescentBoot` →
   `generateProgramLocally` + ledger replay. Generation IS hydration — so any
   generation-time interference re-executes on every launch. The whole
   `canonicaliseHydratedState` pipeline is dead code (receipt
   `featureRegistry.ts:213`).
2. **All seven composed worlds refuse at §18 at this base** (that is the 173/7)
   — the composed route's interference lives entirely on the composer→§18
   edge: power row prepended (`defaultProgram.ts:2899`), names/types
   rewritten, the composer's typed kit-gap records dropped (no carrier field —
   `Workout.equipmentRemovals` does not exist in src at this commit), roles
   re-inferred to `strength_accessory` (R-092 not carried — the refusal
   cause), prescriptions rewritten, and drift strips through the five
   `finaliseWorkoutAfterMutation` callers that never pass `composed`
   (`Back Squat`/`Single-Leg RDL` measured going out with `composed:false`).
3. **Every built legacy world came out of the gateway `status=repaired`** —
   mostly the weekly power budget un-inserting the power rows the builder
   itself prepends. And `bakeMicrocycleStrengthProgression` rewrites
   `prescribedWeightKg` AFTER acceptance on every route.
4. **Projection is not a faithful witness:** `Romanian Deadlift`→`RDLs`,
   `Pallof Press`→`Band Pallof Press` at the glass; Gunshow arm rows
   materialised at read that storage never held; stored conditioning rows not
   shown; an unknown identity vanishes silently (mutant-proven).
5. **Classification: 13 executed / 10 reachable-unexecuted / 4 dead /
   8 shared / 6 already-severed (one partial).** Deletion list and a
   dependency-only severance order are in the doc — step 1 is carrying the
   composed declaration (R-092 + gap records), because nothing downstream can
   stand down while the row loses its authorship at the first hop.

## WHAT FOUGHT THE MEASUREMENT

- The worktree has no `node_modules`; symlinked the main checkout's.
- The profile store's quarantine guard fires on harness resets (writes still
  proceed — noise, not loss).
- A week-2 composed world cannot be fingerprinted: week 1's refusal throws the
  whole generation call before week 2 exists.
- `Pre-season/4d/noclub` cannot complete onboarding (team-days step), so the
  boot refuses to regenerate it — boundaries e/f unmeasured for that world and
  said so in NOT COVERED.
- The projection speaks a different vocabulary than storage, so the last edge
  compares identities/prescriptions, not full structure.

## NOT DONE, DELIBERATELY (scope fence)

No fixes, no deletions, no registry rows, no ratchets, no queue items. The
"what would catch the next unknown route" section names the standing
instrument (a boundary-fingerprint conformance cell + zero-execution counters
on the legacy authors + a `composed`-flag totality check) — building any of it
is a future seat's funded work, not this one's.
