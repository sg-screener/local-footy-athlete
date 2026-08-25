# ONE OWNER FOR THE VISIBLE WEEK — slice plan (R-229)

**Ruled by Sam 2026-08-26** (*"yes one owner obviously"*), answering the
item-68 escalation from launch-audit finding #1 root B. The architecture
reassessment that grounds this plan is in `docs/STATUS_AUDIT.md`
("root-B architecture reassessment", 2026-08-25, seven questions with
file:line receipts). North star: store only decisions, derive everything
else — this plan is that sentence applied to week composition.

## The defect class being retired

Several writers each rebuild or patch the visible week when facts change,
and they disagree:

1. **The re-gate write-back loop** (`programStore.ts:1013-1065`): at boot it
   re-derives a day through the gateway and OVERWRITES the athlete's stored
   `dateOverride` with the re-derived day — which is how a swap on a
   relaunched moved session silently reverts (finding #1 root B, measured).
2. **`writeCoachOverride` discards its outcome** — a refused write reads as
   done.
3. **Duplicated reduction records** in stored contracts — the frozen
   ceilings a later derivation re-answers differently.
4. **Read-time layering** (resolver fillers/adjustments) that re-decides
   what a committed transaction already decided (the "second authority"
   family — see `a-replay-that-re-adjudicates-is-a-second-authority`).

## Target shape

ONE function — `deriveVisibleWeek(storedDecisionsAndFacts)` — is the only
composition path. Doors commit a decision, then re-derive through it.
Boot replays the ledger, then derives through it. Nothing writes a derived
day back over a stored decision, ever.

## Slices (each shippable, each guarded, both-arms measured)

**S1 — The equivalence harness (measure before moving).**
The cell the audit named: *"a door-committed week equals the boot-derived
week for the same ledger."* Walker-acted worlds (fixture-fidelity law), a
byte-level week fingerprint after door-commit vs after relaunch-replay.
Born-red on today's code — the reds ARE the drift census. Ratchet: the
count of divergent worlds only falls. No production edits in S1.

**S2 — Retire the re-gate write-back.**
The boot loop stops rewriting stored `dateOverrides`; the gateway's
re-derived day becomes a read-time derivation consumed by the resolver,
never a write over the athlete's decision. This alone should close root B
(the audit's swap-on-relaunched-move case). Guards: S1 harness cells for
the moved-session worlds go green; D6b stays green; the relaunch
byte-identity cell ("an acknowledged override write reads back
byte-identical") lands here.

**S3 — `writeCoachOverride` honors its outcome.**
Refusals propagate; the discarded-outcome path is deleted. Small, isolated,
its own cell.

**S4 — The single entry.**
Extract the one `deriveVisibleWeek` seam; quiescentBoot and every door call
it; duplicate reduction records collapse into derivations. This is the
biggest slice and lands only after S1's harness holds the drift count at
zero for S2/S3's worlds — the harness is what makes the refactor honest.

*S4a WORKING (2026-08-26, `d0f9e1c8`):* `deriveVisibleWeekLive` is the one
live-week door; the four hand-assembled pairs (planChangeProducer ×2, boot
replay ×2) repointed; guard cell [7] greps the retired shape out of
production. *S4b OPEN:* the reduction-record collapse. First census
(probe-s4b, bin world): a bin stores TWO representations — a reversible
adjustment and a removal constraint — stable across relaunch; these have
distinct jobs (undo bookkeeping vs read-time effect) and are NOT the
duplication the reassessment named. `authorisedReductions` duplication is
minted only by accept-and-reduce flows (illness, fixture squeezes), so S4b
needs an accept-and-reduce probe world before any edit. *S4c WORKING in part
(2026-08-26, `931d36cb`):* both live write boundaries judge the DERIVED
contract, and a cleared illness week recovers its in-season family — the
measured forever-optional_week defect is closed at the judge. *S4c-2 OPEN
(the writer half):* the stored declaration still gets stamped with derived
modes (canonicaliser contract stamping; overlay contract writes; the
LFA_SCAFFOLD_LEGV_WRITER flag covers only weekRebuild's two sites) — the
stamp becomes harmless once every reader derives, and its retirement is
S5's demolition. Non-in-season optional_week recovery is named debt beside
it (subphase mode not reconstructible at the derivation).

**S5 — Demolition + census.**
Delete the retired representations; writer census around the owner to zero
(the "no writer around the owner" instrument), memory-law: a caller census
needs an absolute root.

## Sequencing and ownership

S1 next in this seat (audit). S2 after S1's baseline is recorded. S3 can
interleave. S4 is sized for review by a second seat when Codex returns
(~1 week); if still solo, S4 proceeds in sub-slices behind the harness.
Every slice ends with the three-word status (WORKING/BUILT/WRITTEN) and a
STATUS_AUDIT receipt; the athlete-visible close (Sam's swap case on his
device) belongs to S2.
