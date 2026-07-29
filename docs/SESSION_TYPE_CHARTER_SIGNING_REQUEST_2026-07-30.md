# Charter step 2 — two items back for Sam's signing

Both are the prerequisites Sam named. **No code written.** Everything below is
existing authored data, counted and presented; nothing is invented.

## 1. Prehab pool census — YOUR COUNT IS EXACT

You said ~36 across 6 pools. It is **36 across exactly 6 pools**, from
`src/data/exercisePools.ts`:

| Pool | n | Contents |
|---|---|---|
| `GROIN_ADDUCTORS_POOL` `:164` | 5 | Copenhagen Plank (Half), Long-Lever Copenhagen, Groin Squeeze, Cossack Squat, Lateral Lunge |
| `CALVES_POOL` `:176` | 2 | Single-Leg Calf Raise, Seated Calf Raise |
| `LOWER_PREHAB_POOL` `:200` | 6 | Tib Raises, Banded TKE, Bosch Hold, Spanish Squat Hold, Slant Board Step-Down, Crab Walks |
| `TRUNK_ANTI_ROTATION_POOL` `:209` | 17 | Band Pallof Press, Dead Bug, Banded Dead Bug, Weighted Dead Bug, McGill Sit Up, Ab Wheel, Hanging Leg Raise, Bird Dog, Side Plank, Plank, Hollow Hold, Stir the Pot, Dragon Flag, Side Plank Row, Woodchop (Standing), Woodchop (Half Kneeling), Suitcase Carry |
| `SHOULDER_HEALTH_POOL` `:231` | 5 | Band Pull-Apart, Banded External Rotation, Bottoms-Up KB Press, Scap Push-Up, Scap Pull Ups |
| `HAMSTRING_LIGHT_POOL` `:247` | 1 | Swiss Ball Hamstring Curl |
| **TOTAL** | **36** | |

**SIGN-OFF ASKED:** is this the Accessories session's source, as-is?

Two observations, not proposals:
- `TRUNK_ANTI_ROTATION_POOL` is 17 of the 36 — nearly half. An Accessories session
  "structured like a strength session" drawn uniformly would be mostly trunk work.
  You may want a per-region shape (as you gave Gunshow) rather than a flat draw.
- `HAMSTRING_LIGHT_POOL` has ONE entry, so any session requiring a hamstring slot
  has no choice and will repeat it every time.

## 2. Gunshow candidate list — NO GAPS. Nothing needs authoring.

Your structure: **2 biceps + 2 triceps + 2 shoulder, 2-3 sets each.** Every family
has enough, and every candidate is already inside 2-3 sets, so no new entries and
no dose changes are needed.

**Biceps** — `BICEPS_POOL:120`, 5 candidates, all 2-3 sets:

| Exercise | Dose | Equipment |
|---|---|---|
| Hammer Curl | 2 × 10-12, 45s | dumbbells |
| Incline Dumbbell Curl | 3 × 10-12, 45s | dumbbells, bench |
| Banded Bicep Curl | 3 × 15-20, 30s | bands |
| Concentration Curl | 2 × 12-15, 30s | dumbbells |
| Chin-Up Negative (Slow) | 2 × 4-6, 60s | pullup_bar |

**Triceps** — `TRICEPS_POOL:128`, 5 candidates, all 2-3 sets:

| Exercise | Dose | Equipment |
|---|---|---|
| Tricep Pushdown | 3 × 12-15, 45s | cables |
| Overhead Tricep Extension | 2 × 10-12, 45s | cables |
| Dumbbell Kickback | 2 × 12-15, 30s | dumbbells |
| Banded Tricep Pushdown | 3 × 15-20, 30s | bands |
| Dumbbell Skull Crusher | 3 × 10-12, 45s | dumbbells, bench |

**Shoulder** — `DELTS_POOL:136`, 6 candidates, all 3 sets:

| Exercise | Dose | Equipment |
|---|---|---|
| Lateral Raise | 3 × 12-15, 45s | — |
| Cable Face Pull | 3 × 15-20, 30s | cables |
| Seated DB Press | 3 × 8-12, 45s | dumbbells |
| Rear Delt Fly | 3 × 12-15, 30s | — |
| Shrugs | 3 × 10-12, 45s | — |
| Single-Arm Shrug | 3 × 10-12, 45s | — |

**A question, not a decision:** I read "shoulder" as `DELTS_POOL` (pump work) rather
than `SHOULDER_HEALTH_POOL` (external rotation, scap work — prehab-flavoured, and
part of the 36 above). Gunshow is a pump session, so delts seems right, but the
word "shoulder" could mean either and the two pools do different jobs. Confirm.

**SIGN-OFF ASKED:** these 16 as the Gunshow source, with `DELTS_POOL` as the
shoulder family?

## Equipment note (neither a gap nor a proposal)

Every candidate carries equipment tags, and some families would be thin under
restriction — e.g. triceps without cables/dumbbells/bands/bench leaves nothing.
That is a selection-time concern the existing equipment resolver already handles
for other pools; flagging it so the charter can state whether Gunshow may fall
below 6 exercises when equipment is limited, or must substitute.
