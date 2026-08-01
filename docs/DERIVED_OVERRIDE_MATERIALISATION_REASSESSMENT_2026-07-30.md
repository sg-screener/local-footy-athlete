# The repair that writes itself onto the athlete's surface

**STATUS: REASSESSMENT. NO FIX WRITTEN. AWAITING SAM'S RULING.**

Required by CLAUDE.md's escalation rule, second trigger, met literally: the
semantic layer understands the athlete correctly, and a later layer changes what
his answer means. It is also the third distinct root cause under one device
finding, which is the "same class twice after a general fix" trigger as well.

The wrapper reassessment (`PROGRAM_CONTROL_WRAPPER_REASSESSMENT_2026-07-29.md`)
was right about the wrapper and its fixes hold — finding (2/3) is green through
the real screen door as of this session. Findings (4) and the offer/commit law
are **not** a wrapper problem, not a scope problem, and not a move problem. They
are one layer further down and they are older than all of it.

## The defect, in three actions from a fresh install

Onboard as Sam. Generate. Mark **one** day as rest.

```
PROGRAM TAB (what he sees)     ACCEPTED WEEK (what the domain holds)
2026-07-28  "Lower Squat"      2026-07-28  NULL      <<< SPLIT
2026-07-31  "Lower Hinge"      2026-07-31  NULL      <<< SPLIT
```

He said he was resting on Tuesday. The screen keeps prescribing Lower Squat on
it. The domain agrees with him; the screen does not.

## Where it comes from

`canonicaliseAcceptedStateCandidate` (`src/store/programStore.ts:1114-1133`).
After the §18 accepted-week gateway repairs a week, each day whose repaired
workout differs from the pre-repair one is written back to the surface that owns
it:

```js
if (dateOverrides && hasOwnProperty(dateOverrides, date)) {
  if (after) dateOverrides[date] = after;        // an override already existed
  else delete dateOverrides[date];
} else if (overlayWorkouts) {
  overlayWorkouts[date] = after;                 // the week has an overlay
} else if (after) {
  dateOverrides = { ...dateOverrides, [date]: after };   // <<< THE DEFECT
}
```

The third branch is reached when the week is **base-owned** — no overlay yet.
There is no athlete decision on that day, so the repair invents one. A single
`setRestDay('2026-07-28')` materialises **five** date overrides across the week,
including one on the rest day itself:

```
[overrides after generate]              []
[overrides after rest 2026-07-28]       ["2026-07-27","2026-07-28","2026-07-29","2026-07-30","2026-07-31"]
```

`dateOverrides` is the athlete's decision surface. `rebaseAcceptedEffectiveWeek`
says so in its own comment: *"`date_override` is an athlete-owned surface;
`week_overlay` is not — a scoped-regen overlay is authored by a source fact, not
by the athlete."* A §18 repair is authored by the gateway. It is being filed
under the athlete's signature.

## Why the split appears — two precedence orders for two inputs

Both resolvers read the same date override and the same rest mark. They order
them oppositely:

| resolver | order |
|---|---|
| `_resolveDateRaw` (`sessionResolver.ts:920-929`) | **Priority 1 manual override**, then Priority 2 calendar mark |
| `rebaseAcceptedEffectiveWeek` (`acceptedEffectiveWeek.ts:104-166`) | override composes the week, then `resolveFinalVisibleSection18Week` applies the marks **last** |

So on the screen the override wins and the session renders; in the accepted week
the mark wins and the day is empty. With no override present the two agree
exactly — proved by removing them and re-asking: **splits 2 → 0**, and both rest
days render empty as the athlete asked.

That is the whole of findings (4) and the offer/commit law. The move door is not
refusing the scope; `stageAthleteSessionMoveTransaction:2782` compares accepted
against visible on the destination day and throws
`Accepted athlete move target identity changed`. **The identity check is correct
and is doing its job.** It refuses because the day underneath disagrees with
itself. Scope was attached properly the whole time.

## The seven questions

**1. Current source of truth.** For a day's content: `dateOverrides` >
`weekScopedOverlays` > base microcycle, plus calendar marks — but with two
different orderings of override-vs-mark, so there is no single truth today.

**2. How many representations?** Of a §18 repair, two: an overlay entry (when a
week happens to have an overlay) and a date override (when it does not). Which
one a repair lands in depends on unrelated history, and only one of them is
athlete-owned.

**3. Where can it be reinterpreted?** At the two resolvers, which disagree about
whether the athlete's rest mark outranks a stored workout on the same day.

**4. Which layer should own the decision?** The overlay. It already means
"derived content for this week, authored by a fact, not by the athlete", which is
precisely what a gateway repair is. `dateOverrides` should hold athlete decisions
only.

**5. Simpler architecture that removes representations.** Delete the third
branch's write to `dateOverrides` and let a base-owned week's repair create the
overlay it belongs in. That is a **deletion of a second home** for one kind of
content, not a new guard: after it, a repair has exactly one surface and
`dateOverrides` means one thing. It also removes a stored derived output from a
decision store, which is the north star's own presumed-wrong shape.

**6. What retires rather than gets patched.** The `else if (after)` override
write. Teaching the screen resolver "a mark beats an override" instead would be
a third interpretation of the same pair and leaves derived output sitting in the
decision store — the cheaper-looking fix, and the wrong one.

**7. What tests prove the boundary.** Named below, and none of them exists.

## Convergence

Strongly toward. It removes stored derived state from an input store, collapses
two homes for one kind of content to one, and makes an override-vs-mark
disagreement unrepresentable rather than tested-for.

## Risk, stated plainly

`canonicaliseAcceptedStateCandidate` is load-bearing — hydration, every accepted
transaction and program replacement run through it. Creating an overlay where
none existed changes which surface later code reads for those days. This is why
it is a ruling and not a patch: it is the right shape, and it is not a small
blast radius. It needs the matrix and the walker green across it, not three
targeted tests.

## What I have NOT done

Written any of it. No fix, no guard, no test. Findings (4) and the offer/commit
law stay red and `test:bible` stays EXIT=1 until this is ruled on.
