# Mobility pairing — Sam's authored design, 2026-07-31 (via Cowork)

**Status: AUTHORED, NOT COMMISSIONED.** Captured conversationally while the
buttons/UI unit runs; implemented as its own unit before or within Stage B
(session composition is Stage B's territory). Nothing here interrupts the
in-flight unit.

## Why (Sam, in his own words — authoring context)

Thirty years old, outperformed his talent through S&C, and beat up in ways he
attributes to three mistakes: not enough smart mobility, chasing weights too
much, and pushing until his body forced the rest. This app is the culmination —
everything done right, plus fixing what he did wrong. Smart mobility, smart
progressions, and readiness monitoring are core to it. Mobility pairing exists
because "most footballers aren't going to do it if it's an entire session or
just an optional warm-up — you need to get it in throughout the week."

## The design (all Sam-ruled)

1. **On strength days, 2–3 accessory exercises are paired with mobility
   exercises as SUPERSETS by default** — programmed, visible in the session,
   athlete free to skip. Mobility fills the accessory's rest periods.
2. **Main lifts are NEVER paired.** Heavy-lift rest is recovery; the first
   one or two lifts of the session are left alone.
3. **Non-compete pairing rule:** the mobility pick must target a region that
   is neither the paired accessory's region NOR any of the day's main-lift
   regions — prefer regions untouched by the whole session. (Examples signed:
   split squats + QL extension; single-arm bench + butterfly.)
4. **Division of labour with the warm-up flow:** the session-start
   mobility/prehab flow targets the area being trained; PAIRED mobility
   improves areas NOT currently trained — potentially sore/stiff from
   previous days.
5. **Dose:** the exercise's authored warm-up dose (e.g. "2 × 30s Butterfly
   hips between sets"). **Not logged for weight or performance** — no load
   entry, no progression tracking. Counts toward nothing (mobility law:
   never hard, no load credit, never breaks rest).
6. **Selection source:** the signed 20-exercise mobility pool via the signed
   region table. Prefer equipment-light / floor-based picks — supersets must
   be practical in a crowded gym.
7. **The standalone Mobility session and the off-season top-up are
   UNCHANGED.** Off-season standalone mobility is valid and closer to active
   recovery — "that's the time of year to really push mobility as well"
   (consistent with Bible :104/:108). Pairing is the everyday drip; the
   standalone is off-season volume and athlete choice.

## Parked for v2 (recorded, not authorized)

- **Soreness-informed selection:** SessionFeedback already logs per-date
  soreness; pairing selection could prefer regions the athlete reported
  stiff. Estimate→measured applied to mobility targeting. Needs its own
  ruling when built — nobody builds it from this note alone.

## Implementation notes for the eventual unit

- This is authored session COMPOSITION: the pairing rules belong beside the
  charter/composition owners, gated like everything else (pairing outside
  the non-compete rule = red; a paired mobility pick outside the signed pool
  = red).
- Rendering: superset presentation inside the session detail, on project(),
  copy through the signed sheet.
- Stage B's prompt inherits this document by reference.
