# Priority C is blocked by a collision between two standing laws — Sam's to rule

**Written 2026-08-05, stage 2, before any Priority C code was written.
Nothing has been implemented; this is the survey result.**

---

## The collision, in one paragraph

The conditioning switchover's own gate is **all-or-nothing**, and five of the
twenty symbols it demands be deleted are **coach doses held by LR-6's standing
STOP**. So Priority C cannot land — not partially, not carefully — without
either breaking a gate or breaking a STOP.

## The receipts

**1. The gate trips on the first import, and then demands all twenty.**

`isStageBLanded(srcDir)` (`provenancePendingLists.ts:171-183`) returns true if
**any** of `utils/sessionBuilder.ts`, `data/defaultProgram.ts`,
`utils/conditioningRules.ts`, `utils/coachPlan.ts` contains an import from
`conditioningTemplates`. The moment it does, `provenancePendingListTests` block
[4] (`:125-133`) requires **every one of the 20 `STAGE_B_DOOMED` symbols to be
deleted**, or the suite fails — and `test:pending-lists` is in `test:bible`.

There is no partial landing. Wiring the athlete conditioning path alone trips
the gate for the coach symbols too.

**2. Five of the twenty are coach doses.**

| File | Symbol |
|---|---|
| `utils/coachRevisionTemplates.ts` | `TEMPLATE_DEFINITIONS` |
| `utils/coachRevisionTemplates.ts` | `conditioningRowsForTemplate` |
| `utils/coachPlan.ts` | `sprintAdditionSelection` |
| `utils/coachPlan.ts` | `aerobicAdditionSelection` |
| `utils/coachPlan.ts` | `buildConditioningPrescription` |

**3. LR-6's ratified test catches exactly this.**

> "RATIFIED BOUNDARY (Sam, 2026-08-03): routing a coach caller through an owned
> store door — identical call, identical context, identical transaction — is
> STORE-OWNERSHIP work and is NOT held by this STOP. What is held is changing
> what a coach path **DECIDES**. The test is behaviour: **if the coach path
> would produce a different write, it is LR-6 work and it stops.**"

Replacing those five with the 55 signed templates changes the **dose the coach
writes**. That is a different write. It stops.

---

## The options, with a recommendation

**(a) Split the gate by path — RECOMMENDED.** `isStageBLanded` becomes
per-path: the athlete generation path (`sessionBuilder`, `defaultProgram`,
`conditioningRules`) lands now and its 15 symbols must go; the 5 coach symbols
stay **pinned and visible** until the coach rebuild lifts LR-6.

*Why I recommend it:* it preserves both laws' intent rather than trading one
off. The athlete path stops having a second dose authority immediately — which
is the defect the sheet exists to remove — and the coach path's five survivors
remain *declared debt on a live pin* rather than quietly surviving. It also
matches how LR-3 was paid: the athlete share first, the coach share left
explicitly frozen under LR-6.

*Cost:* the gate's doc says a survivor is "a second conditioning dose authority
sitting beside the equality-bound one". Under (a) that is knowingly true of the
coach path for a while, and the pin must say so in those words.

**(b) Scope an LR-6 exemption for exactly these five.** Argument: swapping an
invented dose for Sam's signed dose *reduces* authorities rather than adding a
representation, which is what LR-6 exists to prevent. Against: the ratified test
is behavioural and unambiguous — a different write stops — and the whole point
of a standing STOP is that it is not reasoned around case by case.

**(c) Hold Priority C entirely until the coach rebuild.** Honest, but it puts
the conditioning engine — the heart of Stage B — behind the coach rebuild, and
the addendum sequences it the other way.

---

## What I did not do

- **No code written.** No import added, no symbol deleted, no gate edited.
- **The `%MAS` work (ruling 4) is untouched**, and is *not* blocked by this —
  the accreted `≤30s → 110%` binary rule dies when MAS wiring lands, and that
  can proceed independently of the vocabulary collapse if Sam wants Priority C
  split that way.
- **The typed dose-string parse at one ingress is unstarted** and is likewise
  independent of the gate collision.

## The question for Sam

Which option — (a), (b) or (c)? If (a), the gate edit is itself a ruling, since
`provenancePendingListTests` is deliberately built so that no implementer can
soften it alone.
