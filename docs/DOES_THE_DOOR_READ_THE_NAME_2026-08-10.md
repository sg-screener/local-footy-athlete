# DOES THE DOOR READ THE DAY NAME? — YES, TWICE, AND BOTH ARE LOAD-BEARING

The seat's question, and it was the right one: *"you said it is carried, not that
it is consumed. That single question decides whether this is Sam's defect or a
cosmetic staleness beside it."*

**ANSWER: IT IS CONSUMED. `planEntryId` is not a label — it is the identity two
separate mechanisms make decisions with.** The staleness is not cosmetic.

## CONSUMER 1 — THE MOVE DOOR'S IDENTITY ORACLE

`src/store/acceptedStateTransaction.ts:3163`

```ts
const expectedSourceIdentity = args.acceptedSourcePlanEntryId ?? args.sourceWorkoutId;
if (!acceptedSource || workoutIdentity(acceptedSource) !== expectedSourceIdentity ||
  workoutIdentity(args.originalSourceWorkout) !== expectedSourceIdentity) {
  throw new Error('Accepted athlete move source identity changed');
}
```

**The move VERIFIES its source by `planEntryId` and throws when it does not
match.** `acceptedSourcePlanEntryId` is fed from `sourceWorkout.planEntryId` at
`planChangeProducer.ts:1474` and `coachCommandExecutor.ts:4429` — both doors.

**And the comment directly above it already declares this oracle RED:** it reads
the MATERIALISED week while the athlete acts on the DERIVED one. That was known
and carried as scoped debt. **What was not joined to it is that the identity it
compares cannot name a Mixed day's conditioning at all.**

## CONSUMER 2 — THE REPAIR DECIDES RETAINED vs DISPLACED BY THE SAME NAME

`src/utils/fixtureMinimalReplan.ts:638-655`

```ts
const retainedIds = new Set(source.map((w) => w.planEntryId ?? w.id));
const inferredDisplacements = input.sourceWorkouts.flatMap((workout) => {
  if (!hasMainStrength(workout)) return [];                       // ← gate
  if (explicitSourceIds.has(workout.planEntryId ?? workout.id)) return [];
  const displaced = !retainedIds.has(workout.planEntryId ?? workout.id) || ...
```

**Two things here, and together they are the shape of Sam's symptom:**

1. **Membership is keyed on `planEntryId`.** A day whose identity is
   `w2:monday:none:strength` is one entry in that set, whatever else it carries.
   **A Mixed day's conditioning has no identity of its own to be retained BY.**
2. **The displacement scan only looks at workouts with main strength**
   (`if (!hasMainStrength(workout)) return []`). Conditioning that went missing is
   not something this pass is looking for.

## WHY THIS JOINS BOTH HALVES OF HIS EXPORT

His two facts were being treated as separate leads:

| his export says | this explains it |
|---|---|
| `planEntryId: "w2:monday:none:strength"` on a day of `workoutType: Mixed` | the ladder in `stablePlanEntryId` stops at `strength` — conditioning is never named |
| `gatewayStatus: "repaired"` ×4, `changedDays: 1`, `rejectionCodes: []` | the repair keys retained/displaced on that same name, and re-derives |

**The strength has an identity and travels. The conditioning has no identity of
its own on a Mixed day, so nothing carries it and the repair re-derives it back.**
That is precisely what he described: *only the strength moved; the conditioning
reappeared.*

## WHAT THIS IS AND IS NOT

**IT IS:** a decisive answer to the question asked — the door reads the name, in
two places, and both make decisions with it. The staleness is not cosmetic and
the ladder is not a display bug.

**IT IS NOT A REPRODUCTION, AND THE SEAT ASKED FOR ONE.** Its order was *"answer
it by running the door, not by reading it — that is the lesson the inert slice
already charged us for."* **This pass READ it.** Every line above is a source
reading over his export; **no arm of any tape was run against a world carrying a
Mixed day, and the causal claim in the table above is UNPROVEN.**

The reading is strong enough to name the mechanism and to stop the "cosmetic
staleness" reading. **It is not strong enough to close his case**, and the
inert-slice lesson is exactly that a mechanism that reads correctly can still be
inert in the running system.

## THE NEXT ACT, AND IT IS SMALL AND DECISIVE

**Run the door over a Mixed day.** One arm in `tape:coach-move-durability`: a
source day carrying strength + conditioning and no anchor — **Sam's Monday
exactly** — moved to an empty day, with the stored rows and the plan entry ids
printed on both sides. Two outcomes, both worth having:

- the conditioning does not travel → **his defect is reproduced**, and the fix is
  an identity that can name every part of a day;
- it travels → the reading above is inert here and the repair is the live half,
  which the new `repairKinds` field will name on his next export.

## NOT COVERED

**No cell holds any of this.** `LAW-claim-needs-a-cell`: a behaviour claim the
owner can read is held by a cell or written OPEN-UNKNOWN, and this is written
**OPEN-UNKNOWN**. Nothing here has been on a device. The identity oracle's
materialised-vs-derived red is pre-existing, recorded in
`docs/R53_LANDING_SET_BUILT_2026-08-07.md`, and is **not** fixed by this pass.
