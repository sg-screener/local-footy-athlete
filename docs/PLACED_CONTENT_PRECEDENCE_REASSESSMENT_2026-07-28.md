# Placed content vs derived filler — architecture reassessment

**Date:** 2026-07-28
**Ruling being implemented:** Sam, 2026-07-28 — *athlete-placed content outranks
derived filler, as law. Explicit athlete moves land first; derived/optional
sessions fill only remaining days and never occupy a day the athlete explicitly
targeted.*
**Status:** reassessment only. No product code changed. Required by `CLAUDE.md`
before further implementation, and by Sam's own instruction: *"if the fix exceeds
a contained change, stop and produce the reassessment rather than patching."*

---

## Why this stopped

The fix looked contained and is one condition. `sessionResolver.ts:679`:

```ts
if (isProtectedCoreExposure(templateWorkout) && !explicitGameDates.has(nextDate)) {
```

Dropping `&& !explicitGameDates.has(nextDate)` makes the G-1 Gunshow stop
replacing protected core. `athleteSessionMoveTests` goes to **22 passed, 0
failed** — the stopped move is fixed.

Then `test:bible` fails two OTHER regressions:

```
FAIL [regression] 14 exact in-season Lower Body deletion relocates and explains publication
       lower destination=5
FAIL [regression] 15 exact Upper Pull component deletion preserves Team Training and ...
```

A deleted Monday Lower Body used to relocate to **Wednesday (day 3)**. With the
condition dropped it relocates to **Friday (day 5)** — which is G-1 for a
Saturday fixture. Freeing G-1 from the Gunshow does not merely stop destroying
moved sessions; it opens G-1 as a **destination for heavy lower work**, which
`BIBLE_ANCHOR: g_minus_1_optional_only` exists to prevent.

So the one-line change trades a move-destruction defect for a G-1 safety defect.
That is not containment, and the gates said so rather than me.

## 1. What is the current source of truth?

For *what occupies a day*, there are three, resolved in sequence rather than by
precedence:

| | Decides | When it runs |
|---|---|---|
| the accepted week (athlete's moves, deletions, coach edits) | what the athlete has actually placed | written first |
| `sessionResolver` fixture proximity | G-1 → Gunshow, G+1 → Recovery | every render, over the top |
| repair/relocation | where displaced core work lands | after a deletion or refusal |

The resolver runs last and unconditionally, so it wins by ordering. Nothing
declares that it should.

## 2. How many representations of "the athlete put this here" exist?

**Zero that reach the decision.** This is the finding.

`sessionResolver.resolveDerivedForDay` receives a `templateWorkout` and the
fixture dates. It has no idea whether that workout is there because the planner
generated it, because the athlete moved it, or because a repair relocated it. The
move transaction records the intent — a typed `session_move` adjustment in the
reversible ledger — but that record never travels to the layer that overwrites
the day.

`isProtectedCoreExposure` is the closest available proxy and is a **superset**:
it protects programmed core work whoever placed it. That is why the one-line fix
also changed relocation behaviour — it was never scoped to athlete intent.

## 3. Where can the decision be reinterpreted?

- **Silently, every render.** The Gunshow is regenerated on read, so an athlete's
  moved session is not overwritten once and stored; it is overwritten repeatedly,
  and only the move transaction's content-conservation post-condition notices.
- **Into a refusal.** Conservation then refuses the whole commit, so the athlete
  sees "I couldn't safely make that change" for a move the preview accepted.
  Preview and commit disagree because they run different layers.
- **Into a different day.** Repair reads day occupancy, and occupancy is decided
  by the same resolver, so relocation inherits whatever the fixture rule did.

## 4. Which layer should own the decision?

The accepted week. Fixture proximity is a **constraint on content**, not a claim
on a day: "G-1 must be light" is a statement about what may be *in* Friday's
session, not about *whose* session Friday holds.

The current code implements it as a claim on the day, which is why the only
tools available are "replace the session" or "leave it heavy". Both are wrong.

## 5. What simpler architecture removes representations?

**Make G-1 a transform, not a substitution.** Today:

```
day holds core session  →  discard it  →  build a Gunshow
```

Instead:

```
day holds core session  →  keep its identity  →  apply the G-1 lightening
```

The athlete's session survives with its `planEntryId`, so conservation is
satisfied by construction and no athlete-placement marker is needed anywhere.
G-1 stays light, so the Bible anchor holds. Relocation scoring is untouched,
because the day is still "occupied by core" for ranking purposes.

This is the same shape as `DELOAD_LAW` and the illness `asIllnessRecoveryWeek`
decoration, both of which this repo already uses: *the exposure survives at a
smaller size.* It removes a representation (the substituted Gunshow) rather than
adding one (an athlete-placement flag).

The alternative — thread an `athletePlaced` marker from the move transaction
through the accepted-state surfaces into the resolver — adds a fourth
representation of the user's request to a pipeline that already has three, which
is what `CLAUDE.md` exists to prevent.

## 6. Which legacy paths should be retired rather than patched?

- The `explicitGameDates` carve-out at `sessionResolver.ts:679` and its G+1 twin
  at `:632`. Both encode "an explicit fixture may destroy core work"; under the
  transform model neither is needed.
- `buildDerivedSession('arms_pump', …)` as a *replacement* on G-1. It stays as a
  filler for genuinely empty days.

## 7. What tests prove the new ownership boundary?

1. **Identity survives proximity.** A core session on G-1 keeps its
   `planEntryId` through resolution. Fails today.
2. **G-1 stays light.** The surviving session carries no heavy lower or speed
   work — the existing anchors, re-pointed at the transformed session.
3. **Preview equals commit.** Any move the preview accepts, the commit accepts.
   This is the athlete-visible defect and nothing currently asserts it.
4. **Relocation is unchanged.** Deletion regressions 14 and 15 keep their
   Wednesday destinations — the guard against the fix I reverted.
5. **Filler fills only empty days.** A derived session never replaces one with a
   stable identity, in either proximity direction.
6. **Mutation-proven**, per the standing rule.

## Recommendation

Do not implement ruling 1 as a precedence change in the resolver. Implement it as
the **G-1/G+1 transform**, which satisfies the ruling and the Bible anchor at
once. That is its own unit: it touches session content, not just ordering, and it
needs the lightening rule authored — "what a G-1 session keeps" is a Sam
question, and Section 14's deload transform is the obvious precedent.

## Not covered

- **What the G-1 lightening actually is.** The deload transform halves sets at
  RPE 5-6; whether G-1 uses the same numbers or its own is unruled.
- **G+1 recovery.** Same shape at `sessionResolver.ts:632`, not swept.
- **Coach edits and repair placements.** The ruling names athlete moves; whether
  a coach-placed session outranks filler is the same question and is unasked.
