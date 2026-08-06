# CONDITION 1 VERIFICATION — and it REFUTES the exhaustion premise

Binding condition 1 of `docs/INJURY_AUTHORITY_EXHAUSTION_RULING_2026-08-06.md`:

> Instrument FIRST the placement function that consumes the G-anchor
> constraints — the G-2 conclusion is currently inferred from quoted anchors
> plus day arithmetic, not stepped. **Verify before building.**

Verified. **The premise does not hold, and no exhaustion code was written.**

---

## §1 What the diagnosis claimed, and what is actually authored

The diagnosis (`45fb91cb`) concluded that THU (G-2) *"can legally hold
nothing"* — upper paused by the injury, heavy lower barred by the game — and
the ruling approved a typed reduction on that basis.

The second half is **wrong**. Read in full, the anchor authors an exception:

```
id: 'lower_strength_g3'
quote: 'How close can lower strength be to game day: g-3
        (g-2 if it's low range of motion, low reps, high quality
         i.e. 2x3 box squats to high box + 2x3 vertical jumps)
        - low volume, not many exercises'
states: [3, 2]
meaning: 'Lower-body strength stops at G-3, with a named G-2 exception for
          low-volume, high-quality work. Governs which day slots may host a
          HEAVY lower session.'
```

And its companion is consistent rather than contradictory:

```
id: 'g_minus_2_no_heavy_lower_or_speed'
quote: 'Rules around G-2: no HEAVY lower body work or speed work'
```

**Heavy lower is barred at G-2. A low-ROM, low-rep, high-quality, low-volume
lower session is expressly authorised there — Sam wrote the prescription
himself: `2x3 box squats to high box + 2x3 vertical jumps`.**

So THU is not unfillable. It has an authored, Bible-named occupant, and it is
exactly the "clearly unaffected training" the 8-10/10 band calls for
(`:1920-1926`) — squat/jump work is untouched by a shoulder.

## §2 Why the day came back empty: the exception is authored, not built

The anchor names its own implementation sites:

```
sites: [ { file: 'utils/coachingEngine.ts', symbol: 'midWeek' } ]
```

`midWeek` is **G-3 only** (`coachingEngine.ts:1877`:
`const midWeek = daySlots.filter(d => d.offset === -3)`). The G-2 half of the
anchor has **no site at all**. In the placer, G-2 is `lateWeek`, and
`lateWeek` is structurally the UPPER slot — Step 2/3's comment says so
outright: *"The late-week G−2 slot is the anchor for the upper session in both
cases"*, with `lateWeek.find(d => d.isTeamDay …)` as the *"G-2 team — ideal"*
push slot.

The vocabulary cannot express the exception either:

```ts
export type StrengthArchetype = 'lower' | 'upper' | 'full_body';
```

There is no low-volume/high-quality lower variant to place. The exercises
exist (`High Box Squat`, `Vertical Jump` are both in the pools, and
`loadEstimation` even carries Sam's 1.2× high-box ruling) — the SESSION SHAPE
does not.

So when the injury removes push from the G-2 slot, the placer has nothing to
put there, not because the Bible forbids it, but because **the authorised
alternative was never implemented.**

## §3 Why this must not be paid as approved

Bible `:4688` step 4 — the ruling's own governing line — authorises a typed
reduction for an **unavoidable** shortfall, and only after step 2
(*substitute*) is exhausted. Here step 2 has an authored option that was
never built. The shortfall is avoidable.

Emitting `main_strength_frequency` exhaustion in this world would therefore
record a reduction that masks a missing placement capability — which is the
named class this repo has already paid once:

> **A reduction masked a placement defect** (finding 3, `9d676e7c`): removing
> the cap made the injured contract identical to the healthy one and exposed a
> placer that fit the week by accident.

It would also defeat binding condition 2 in spirit. That condition exists so
exhaustion is *witnessed only where it is real*; this world is precisely one
where it is not real, and the gate as scoped would have blessed it.

## §4 The corrected fix shape — for a revised ruling, NOT built

1. **Implement the authored G-2 exception.** A low-volume, high-quality lower
   session becomes placeable at G-2: low ROM, low reps, few exercises, to
   Sam's own prescription. This fills the stranded day with clearly
   unaffected training and holds main-strength frequency at 3 — the answer
   finding 3's law already gives ("the week keeps its count and fills the
   freed days with safe work").
2. **Keep the exhaustion proof from the approved ruling** — it is still the
   right mechanism, and §1 does not touch it. It simply must not fire in
   THIS world. After (1), a genuinely exhausted week is one where no
   eligible day remains after the G-2 option is also considered.
3. **Conditions 2–5 carry unchanged**, and condition 2 becomes sharper: the
   matrix now needs three worlds — no-game (must not exhaust), Saturday-game
   with severe upper (must FILL G-2, not exhaust), and a genuinely exhausted
   world for the reduction to be witnessed in.
4. Condition 4 (the `:319` citation drift) is untouched and still owed.

**Open question for the ruling, and it is a coaching call, not a code one:**
whether the G-2 low-volume lower session is *always* available as a
substitute, or only when the athlete's week has lost its other main-strength
slots to a restriction. Placing quality lower work at G-2 by default would
change healthy weeks too, which is a bigger change than this unit.

## §5 NOT-COVERED

- I did not step the placer with a debugger; §2 is read from the placement
  source, the anchor's own `sites` list, the archetype union, and the
  measured outcome (THU returns with 0 rows). Those agree, but a stepped
  trace is stronger and was not run.
- Whether any OTHER path (the repair engine, `coachingEngine.ts:4659`'s lower
  intents) can reach G-2 was not exhaustively traced. If one can, §2's
  "cannot express it" is too strong and the diagnosis narrows to the placer
  alone.
- `lower_strength_g3` declares `states: [3, 2]` while implementing only state
  3. Whether any Bible-anchor gate asserts coverage of BOTH declared states —
  and is passing vacuously — was not checked. It is the obvious next question
  for whoever builds this.
- No device pass.
