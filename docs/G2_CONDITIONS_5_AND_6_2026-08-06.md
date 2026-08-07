# CONDITIONS 5 AND 6 — ANSWERED, and 6 designs the unit

Conditions 5 and 6 of `docs/INJURY_AUTHORITY_EXHAUSTION_RULING_V2_2026-08-06.md`.
Both answered before any build code, because 6 changes what the build is.

---

## §1 CONDITION 5 — the `states: [3, 2]` vacuity question. IT IS VACUOUS.

> Whether a Bible-anchor gate asserts coverage of BOTH declared states and
> passes vacuously today. If it does, that is its own finding, recorded.

It does. `bibleThresholdAnchorTests.ts:115-118`:

```ts
for (const n of anchor.states) {
  ok(`${anchor.id}: quote states ${n} as a whole number`,
     statesWholeNumber(anchor.quote, n), …);
}
```

**The gate asserts each declared state appears in the anchor's own QUOTE
TEXT — never that any code honours it.** `lower_strength_g3` declares
`states: [3, 2]`; the quote contains "g-3" and "g-2"; both assertions pass.
Block [4] separately checks the cited `sites` exist and name the anchor — but
`sites` lists only `{ coachingEngine.ts, midWeek }`, which is state 3 alone.
**Nothing ever asks who implements state 2.**

So the anchor gate proves an anchor's numbers are *quoted*, not that they are
*honoured*. A numeric anchor can declare two states, implement one, and stay
green forever — which is exactly what happened here for six days.

**This is a gate-shape finding, recorded, not fixed in this unit** (it widens
to every multi-state anchor in the registry, and changing what the anchor gate
proves is its own unit with its own mutation testing). What this unit owes it
is the honest note; what the registry owes is a `sites`-per-state obligation.
Filed as the successor question: **how many other anchors declare a state no
site implements?** Unmeasured — and it is one query away for whoever picks it
up.

`gate-passing-on-coordinates-it-never-builds`, sixth sighting, and the first
one inside the anchor registry itself.

## §2 CONDITION 6 — the untraced path. TRACED, and it is not a repair engine.

> The untraced path (repair engine, `coachingEngine.ts:4659` reaching G-2) is
> traced before the unit closes, not left as a shrug.

`:4659` is **not** a separate repair engine. It is `buildStrengthIntent`
inside `buildWeeklyPlan` (opens `:1742`) — the same weekly-plan builder,
later section. It converts a chosen `CandidateType` into a `StrengthIntent`;
it chooses no days.

Day eligibility for that candidate path is governed at `:3193-3202`, and this
is the G-2 rule stated a second time:

```ts
if (offset === -2) {
  if (isHeavyLower(c) || c === 'FB') return true;   // → blocked at G-2
  …
}
```

So **the G-2 restriction has two implementations** — `lateWeek` in the
G-relative placer (structurally upper-only) and this candidate blocker — and
both key on the same predicate:

```ts
// "Heavy lower" = any dedicated lower or combined lower session.
function isHeavyLower(c) { return c === 'L-sq' || c === 'L-hi' || c === 'L-co'; }
```

**And a THIRD constraint applies to the stranded day that the diagnosis never
named.** THU is a TEAM TRAINING day, and H-TEAM-LOWER (`:3707`, `:3714`,
`:4984`) blocks heavy lower on a team day **in every phase** — Sam,
2026-07-08: *"No lower strength stacked onto team training."* So even with
G-2 solved, a heavy lower session could not go there.

### §2.1 What that means for the build — the design falls out of it

Every one of those three guards is written in terms of **`isHeavyLower`**, and
the authored G-2 exception is *expressly not heavy*: "low range of motion, low
reps, high quality … low volume, not many exercises".

So the unit does **not** need a G-2 special case, and must not add one. It
needs the vocabulary to express a lower session that is **not heavy** — and
all three existing guards then admit it **by construction**, none of them
weakened, none of them touched:

| guard | today | with a non-heavy quality-lower candidate |
|---|---|---|
| G-2 block (`:3199`) | blocks `L-sq/L-hi/L-co/FB` | admits it — not heavy |
| G-2 upper slot (`lateWeek`) | upper-only by structure | needs the fallback branch (the one real placement change) |
| H-TEAM-LOWER (`:3707/:3714/:4984`) | blocks heavy lower on team days | admits it — not heavy |

That is the elegant form the ruling asked for: the anchor scopes the
exception **by session SHAPE**, the guards are already written in terms of
shape, and the missing piece is a shape the vocabulary cannot currently name.

`StrengthArchetype = 'lower' | 'upper' | 'full_body'` gains the quality-lower
shape; `CandidateType` gains its candidate; the guards stay exactly as
written.

### §2.2 The fallback discipline, which is where the risk sits

Ruling V2: it is a FALLBACK, never a default; it never displaces a week that
already fits; **healthy differential goldens must not move a byte.**

A non-heavy candidate that the guards freely admit would otherwise be
placeable anywhere, including healthy weeks — which would move goldens and
break the ruling. So the new candidate must be **excluded from ordinary
selection** (out of `FREEFORM_STRENGTH` and the normal `STRENGTH_CANDIDATES`
queue) and reachable only through an explicit last-resort branch taken when
the week cannot otherwise hold its main-strength count. The healthy goldens
are the enforcement, exactly as the ruling says.

## §3 Build order for the unit (unchanged from ruling V2, now with §2's shape)

1. Vocabulary: `StrengthArchetype` + `CandidateType` gain the quality-lower
   shape, with the authored prescription as its focus text.
2. The G-relative placer's Step 2/3 gains the fallback branch: when the G-2
   upper slot cannot be filled (its patterns restricted) and the week would
   otherwise miss its main-strength count, place quality-lower there.
3. The exhaustion proof (ruling V1's mechanism, kept): fires only when no
   eligible day remains AFTER the quality-lower option is considered.
4. Husk unrepresentable: a day never ships titled with zero rows.
5. `:319` citation fix.
6. Three-world matrix: no-game (must not exhaust), Saturday-game + severe
   upper (must FILL G-2), genuinely exhausted (reduction witnessed only there).
7. Coach Note copy PROPOSED.

## §4 NOT-COVERED

- §1's successor question (other anchors declaring unimplemented states) is
  **unmeasured**. Named, not counted.
- The trace in §2 is read from source and from the measured outcome (THU
  returns 0 rows), not from a stepped debugger session.
- Whether the quality-lower shape needs its own load/intensity treatment in
  `loadEstimation` beyond the existing `High Box Squat` 1.2x ruling is not
  yet examined.
