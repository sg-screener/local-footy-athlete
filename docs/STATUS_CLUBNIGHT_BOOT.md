# STATUS — seat `blocktwo-difficult`, club-night boot

Branch `fix/club-night-boot-participation`, from merged main `f3ec68d1`.
**No code change was made.** This file is the measurement.

## THE MISSION'S PREMISE IS REFUTED BY MEASUREMENT

The instruction was: *"Boot must preserve or rederive the athlete's accepted
participation context from persisted facts before validating team-training
anchors."*

**Nothing is lost at boot. There is no missing handover.** Probed on a real
club-night athlete (Pre-season, 3 gym days, club Tue/Thu), the anchors the
contract carries **before boot** are already:

```
team_training@d2 participation=unknown prov=derived_healthy_unrestricted
                 claim={"conditioning":true,"sprintHighSpeed":true,"hardDay":true}
team_training@d4 participation=unknown prov=derived_healthy_unrestricted
                 claim={"conditioning":true,"sprintHighSpeed":true,"hardDay":true}
```

That is the state GENERATION LEGITIMATELY PRODUCES for a club night the athlete
has not attended yet. There is no participation fact to preserve, because the
week is in the future.

## THE REAL CAUSE — TWO GATES, ONE QUESTION, TWO ANSWERS

**`validateGeneratedWeek` (generation time) promotes it.**
`services/api/generateProgram.ts`, and its own comment states the ruling:

> *"a DERIVED-healthy anchor participates normally for the purposes of judging
> the week we are about to hand over"* — Sam, 2026-08-15, *"conditioning/sprint
> credit supplied by those visible anchors"*.

```
const derivedHealthy = anchor.participation === 'unknown'
  && anchor.participationProvenance === 'derived_healthy_unrestricted';
const participation = derivedHealthy ? 'normal_unrestricted' : ...
```

**`section18EffectiveWeekEvaluator` does not.** It reads `anchor.participation`
raw:

```
if (anchor.participation === 'normal_unrestricted') continue;
...
code: 'unjustified_anchor_credit'
```

`grep derived_healthy_unrestricted src/rules/section18EffectiveWeekEvaluator.ts`
returns **nothing** — the evaluator has never heard of the provenance the
generator relies on.

So the same week generation ACCEPTS, the safety finaliser REFUSES. Boot is only
where it bites, because boot is the path that re-runs the finaliser against a
freshly built contract with no stored participation to carry forward
(`derivedWeekContract` carries `stored.anchors[].participation`, and boot's clean
slate empties `exposureContractsByWeek`).

## WHY NO FIX WAS ATTEMPTED

The fix is in `section18EffectiveWeekEvaluator` — teaching it the same
derived-healthy rule the generator already applies, so one question has one
owner. **That is a change to a §18 safety evaluator**, and this mission's fence
reads *"do not suppress `unjustified_anchor_credit`, weaken §18, or fabricate
participation credit."* Whether honouring an authored provenance is "applying
Sam's own rule in the second place it is needed" or "weakening §18" is a ruling,
not a judgement call for the last minutes of a capped session.

**It is also not the shape the mission asked for** — no handover is missing —
so building one would have been building a mechanism against a premise the
measurement had already refuted.

## WHAT A FIX WOULD NEED

1. One owner for *"does a derived-healthy anchor participate?"*, consulted by
   both `validateGeneratedWeek` and `section18EffectiveWeekEvaluator`.
2. The mission's guards then hold as written, including
   *"genuinely unknown participation still refuses"* — an anchor whose provenance
   is `legacy_unknown` or `explicit`+`unknown` keeps refusing, because only
   `derived_healthy_unrestricted` promotes.
3. `test:readiness-ownership` (red 13× at `6117a9fd` with this signature) is the
   existing suite that should go green.

---

# THE FIX — ONE OWNER, AND WHAT IT DID NOT CLOSE

`effectiveAnchorParticipation` in `rules/weeklyExposureContractV2.ts`, beside
`anchorAttendanceClaimsConditioning` — the same "one exported rule, delegated to,
never restated" shape the evaluator's own `attendedAnchor` comment already
demands. Both judges call it; neither carries the condition any more, and a cell
greps to prove that.

## READINESS-OWNERSHIP: THREE INVARIANTS RECOVERED

| | merged main `f3ec68d1` | with the fix |
| --- | --- | --- |
| `unjustified_anchor_credit` occurrences | **13** | **0** |
| R1 characterization | FAIL (contradiction) | **PASS** |
| R2 read-alignment | FAIL (contradiction) | **PASS** |
| R3 unconditional-ack | FAIL (contradiction) | **PASS** |
| R4, R5, R6, R12 | FAIL (contradiction) | FAIL — on their OWN subject now |

The remaining four stopped reporting the safety contradiction and started
reporting seeding preconditions, override effect and transaction ownership. They
were masked, not caused, by this defect. **Not repaired here.**

## ⚠ TWO MUTATIONS SURVIVE — STATED, NOT PAPERED OVER

P1 (`normalParticipation`) and P3 (`attendedAnchor`) reverted to the raw
participation change NO cell. The `unjustified_anchor_credit` guard reads the
LEDGER ROW, which P2 does red — but those two functions decide the CREDIT: what a
club night is WORTH. Nothing observes that number.

A cell was written and **withdrawn rather than shipped green-but-empty**: a
hand-built contract came back with `currentProductionClaim` all false and no
provenance, so it measured the builder's defaults. The honest coordinate is a
REAL generated club week's contract passed to `evaluateSection18EffectiveWeek`.

**That is why this branch is NOT merged.** The mission said merge if everything
holds; two required guards do not yet hold.
