# Exercise Locked-List Changeset — Sam's census verdicts (2026-07-24)

Authoritative application of Sam's master-census + locked-list review.
Apply EXACTLY — cues verbatim (mechanical punctuation fixes only), no rewording.

**This document is machine-parsed.** `src/__tests__/exerciseLockedListTests.ts`
reads every section below and fails the build on any divergence between the
document and what ships, so a reworded cue, a resurrected removal or an
unshipped addition cannot survive a green gate. Edit the document first.

**Applied**: 2026-07-25, branch `feat/exercise-locked-list-vocabulary-switch`.
Sections marked PROPOSED are the only ones still awaiting a Sam ruling.

## REMOVALS — delete everywhere (pools, cues, tags, videos, aliases, prompt vocab)

- Safety Bar Squat
- Tempo Squat
- Hack Squat
- Hamstring Bridge / Hamstring Isometric
- trap bar DL
- Tempo Step-Up
- Low Box Squat Jump
- Medicine Ball Throw (rotational)
- Countermovement Jump
- Hip Airplane
- Adductor Squeeze
- Lateral Step-Down
- Floor Press (bilateral, barbell/DB)
- Medicine Ball Chest Pass
- Medicine Ball Slam
- Neutral-Grip DB Press
- Cable Chest Fly
- Cable Fly
- Machine Chest Press
- Half-Kneeling Landmine Press
- Chest-Supported Machine Row
- bent over BB row
- incline DB row (chest supported)
- Light Cable Curl
- Pec Deck
- machine curls
- Landmine Rotation
- Hanging Knee Raise
- Bottoms-Up KB Carry
- Barbell Rows
- Cable Bicep Curl
- Deep Lunges
- Dumbbell Flyes
- Explosive Movements
- Full Back Squat
- Heavy Back Squats
- Heavy Deadlifts
- Heavy Sprints
- Hyperextensions
- Incline Bench Press
- Leg Curl
- Plyometric Drills
- Power Clean
- Rows
- Side to Side Movements
- Single Leg Work
- TRX Suspension
- TRX Suspension Rows
- Weighted Sits-ups
- Sled Push (late ruling)
- Step-Down (late ruling)
- Controlled Shuttle / Up-Back Shuttle (late ruling)
- Abductor Machine (late ruling)
- Adductor Machine (late ruling)
- Olympic lifts (cleans, snatches) (late ruling)
- Medicine Ball Overhead Throw (late ruling)

### Removal scope — what "everywhere" reaches, and what it does not

Enforced by `exerciseLockedListTests` §1 across the six named surfaces:
`src/data/exercisePools.ts`, `src/data/exercisePoolsStrength.ts`,
`src/data/exerciseCues.ts`, `src/data/exerciseTags.ts`,
`src/services/exerciseVideoService.ts`, `src/utils/loadEstimation.ts`, and the
live generation prompt (`src/services/api/generateProgram.ts` +
`supabase/functions/coach-chat/index.ts`).

Two removals are deliberately NOT literal deletions, recorded here so the
exception is a ruling rather than a miss:

- **Olympic lifts (cleans, snatches)** — the only occurrence in live code is
  `coach-chat`'s `NEVER program:` prohibition. Deleting the prohibition would
  *permit* them. The census entry is retired; the ban stays.
- **The medicine-ball family is gone entirely.** Chest Pass and Slam went on
  2026-07-24; Sam retired `Medicine Ball Overhead Throw` on 2026-07-25, which
  was the last one standing. Both `buildPowerBlock` branches that offered a
  med-ball alternate are deleted — the function no longer reads
  `availableEquipment` at all, and the power block is **bodyweight-only** until
  the power unit builds `POWER_EXERCISE_POOL_SPEC`'s pool.

`supabase/functions/generate-program`, `supabase/functions/sync-exercises` and
the applied SQL seed migrations still name 21 of the removals. All three are
confirmed-dead paths (census: "ORPHANED — dead edge functions"; zero call sites
in `src/`), and rewriting applied migration history is not a content change.
They belong to the follow-up purge unit — see NOT-COVERED in the report.

## MERGES / ALIASES — collapse to ONE canonical entry, variants become aliases

- vertical jump → Vertical Jump  (power pool default — ONE entry, owned by power unit)
- Vertical Jump → Vertical Jump  (power pool default — ONE entry, owned by power unit)
- explosive push-ups → Explosive Push-up  (upper power default — ONE entry; video EXISTS under variant )
- Explosive Push-Ups → Explosive Push-up  (upper power default — ONE entry; video EXISTS under variant )
- Inverted Rows → Inverted Row (Bodyweight)  (already curated w/ cue+video — alias, no new entry)
- hamstring curls → Hamstring Curl  (one entry per Sam "no double ups" — cue exists, NEEDS pool s)
- seated DB OHP → Seated DB Press  (already curated — alias)
- RFE split squats → Bulgarian Split Squats  (RFE = rear-foot-elevated = Bulgarian — alias)
- RFE Split Squat Jump → RFE Split Squat Jump  (kept — power-class jump; cue authored by Sam 2026-07-27, pool placement still open)
- trap bar DL → Trap Bar Deadlift  (curated exists — alias cleanup (Sam: only need one))
- weighted pull-ups → Pull-Ups  (REMOVE as entry; add weight line to Pull-Ups cue (proposed b)
- Pogo Jumps / Pogo Jump → **Pogo Hops** (Sam rename; power block reduced-option adopts new name)

## CUE EDIT
- Pull-Ups: append secondary line: "Add weight once bodyweight sets feel easy." (Sam-approved; absorbs weighted pull-ups)

## ADDITIONS — Sam-authored (cue verbatim: primary | secondary; pool as stated)

### Banded TKE
- Pool: Lower prehab
- Cue: Band behind knee, step back for tension, straighten knee and squeeze quads.
- Video: https://youtube.com/shorts/CU7Fn11YMTw?si=NTFuHD1T6G61HyzF

### Bodyweight Squat
- Pool: Squat
- Cue: Sit back into hips, knees follow toes, chest tall.
- Video: https://youtube.com/shorts/-5LhNSMBrEs?si=4BjCCOFx_gWNWVgc

### Bosch Hold
- Pool: Lower prehab
- Cue: Single or double leg, slight knee bend, drive heel into ground, keep hips high.
- Video: https://youtube.com/shorts/WIrkq7Kd6E8?si=uFJoVmzBX2MH-0hR

### Erg EMOM
- Pool: Conditioning
- Cue: Hit X number of calories every minute, the faster you do them the more rest you get.
- Video: (existing in app — Kneeling Jump / Lateral Jump / Single-Arm DB Floor Press use current entries; Erg EMOM = conditioning, none by design)

### Glute Bridge
- Pool: Hinge
- Cue: Keep spine neutral, don’t arch low back, lift hips, squeeze glutes, add weight to hips if you can.
- Video: https://youtube.com/shorts/mSuDY5J0Fwo?si=lbES-sNynf1nzRuV

### Hamstring Curl
- Pool: Lower isolation
- Cue: Pad should be lower calf area, squeeze heels to butt.
- Video: https://youtube.com/shorts/EfeVvA1vdd4?si=M68PVv0bXBYICDQv

### Hollow Hold
- Pool: Trunk/core
- Cue: Stay tight, remember to breathe, low back pinned to floor.
- Video: https://youtube.com/shorts/pN_YFk4Lx8Q?si=BGSE18ha_P1JsxFs

### Kneeling Jump
- Pool: Power
- Cue: Start in kneeling position, jump onto feet, land in a squat.
- Video: (existing in app — Kneeling Jump / Lateral Jump / Single-Arm DB Floor Press use current entries; Erg EMOM = conditioning, none by design)

### Lateral Jump
- Pool: Power
- Cue: Jump off outside leg to the side, turn in air and land in a squat.
- Video: (existing in app — Kneeling Jump / Lateral Jump / Single-Arm DB Floor Press use current entries; Erg EMOM = conditioning, none by design)

### Plank
- Pool: Core
- Cue: Keep spine neutral, brace midline, squeeze butt, breathe.
- Video: https://youtube.com/shorts/hoeNgjheDHk?si=urWIrNWTSgdpU5KI

### Pogo Hops
- Pool: Power
- Cue: Stand tall, jump and then bounce off the balls of your feet.
- Video: https://youtube.com/shorts/SjHRwhGXBl8?si=RzqJnRFhEhHjBzJO

### Side Plank Row
- Pool: Core
- Cue: Side plank, row band to top of belly, resist rolling forward.
- Video: https://youtube.com/shorts/h3EfXtxlonY?si=a95V7UuE-47T6-SB

### Single-Arm DB Floor Press
- Pool: Upper push
- Cue: 
- Cue not authored — ships the existing curated cue: Brace the midline, press from the floor. | Don't let the torso rotate.
- Amended 2026-07-25 by the D13 terminology ruling ("midline" replaces
  "trunk/core" in athlete-facing copy). The cue Sam declined to re-author on
  2026-07-24 read "Brace the trunk, press from the floor."; only the body-region
  word changed, so this line still records "ships the existing curated cue".
- Video: (existing in app — Kneeling Jump / Lateral Jump / Single-Arm DB Floor Press use current entries; Erg EMOM = conditioning, none by design)

### Single-Leg Hip Thrust
- Pool: Lower isolation
- Cue: Upper back on bench, add weight to hips, one leg up, drive hips to sky, squeeze glutes.
- Video: https://youtube.com/shorts/bRZeB6UG6Js?si=w4SjRdY3L96gu-gQ

### Slant Board Step-Down
- Pool: Lower prehab
- Cue: Drive knee forward, tap opposite heel on ground, knee tracks over toes.
- Video: https://youtube.com/shorts/Y7-m2oSUEJQ?si=bQDAKrpodIuBTJNp

### Spanish Squat Hold
- Pool: Lower prehab
- Cue: Band behind knees, tension on bands, sit back into a squat and hold.
- Video: https://youtube.com/shorts/UKXVgo4jfkw?si=zR6WD7rBjbFSi0X0

### Stir the Pot
- Pool: Core
- Cue: Spine stays neutral, resist rotation through midline.
- Video: https://youtube.com/shorts/TojWydRDiHY?si=Fx3Nqse-BBWn6keC

### back extension
- Pool: Lower isolation
- Cue: Squeeze glutes at top, round slightly at bottom.
- Video: https://youtube.com/shorts/d-S2VfpRL_I?si=fCBFbXBVXXToQuXG

### crab walks
- Pool: Lower prehab
- Cue: Sit back into athletic position, band around feet, push off outside leg, keep knees slightly pointed out.
- Video: https://youtube.com/shorts/yItH_robbcU?si=yWEx-UIvVnLW3rMM

### dragon flag
- Pool: Core
- Cue: Control the way down, low back should be slightly rounded and roll over ground.
- Video: https://youtube.com/shorts/mL-_0xacP_8?si=0gB_ZXpgJYeTfu7F

### high box squat
- Pool: Squat
- Cue: High box to minimise soreness, slight pause at box, stay tight through midline.
- Video: https://youtube.com/shorts/oFSJ13d3Hc4?si=WMBzS7_HeL_-c1tu

### speed trap bar DL
- Pool: Power
- Cue: Wrap band around each side of bar, stand on band, get tight, explode up, control down.
- Video: https://youtube.com/shorts/0ZfQDDiI1Hs?si=b3Pt-cMT8VU9LsRt

### QL back extension
- Pool: Mobility
- Cue: Pin legs in 45 deg hyper, bend sideways slowly, don’t push too far, just enough to feel tension.
- Video: https://youtube.com/shorts/MVu18rxmukk?si=F8L_pi2vYToxg8rb

### ATG split squat
- Pool: Mobility
- Cue: Elevate front foot, body stays upright, drive hips to front heel, go slow and pause at bottom.
- Video: https://youtube.com/shorts/7Adg7R5BknU?si=SAfVIuE7G2HpJ-pR

### Elephant walks
- Pool: Mobility
- Cue: Place blocks at level you’re comfortable with, fold forward, bend and straight one leg at a time, slowly.
- Video: https://youtube.com/shorts/GMYMWEkki6U?si=eFuoyRDoDux_QhHW

### Cossack Squat
- Pool: Groin/adductors
- Cue: Wide stance, sit onto one leg, other leg straight. | Heel down, chest up, push back through. Hold rack if needed.
- Video: https://youtube.com/shorts/MJvazUpmdZU?si=I8QDr6TOUMUWEtN6

### Lateral Lunge
- Pool: Groin/adductors
- Cue: Big step sideways, sit into that hip. | Knee tracks over toes, drive back to standing.
- Video: https://youtube.com/shorts/5JPYr0JEFtY?si=OxHmKfhzZ_GApjoY

## FINAL CANONICAL NAMES — every name that ships, for Sam's eyeball

Sam's sheet is written in his shorthand; the shipped vocabulary spells movements
out in full and title-cases them, because the generation prompt forbids the model
from abbreviating or re-casing a name and the canonicalisation boundary treats
case as insignificant. Word changes: **NONE** — only case and the one expanded
abbreviation the vocabulary's own no-abbreviation rule requires (`DL` →
`Deadlift`, the rule's named example).

`QL` and `ATG` are kept verbatim: they are the movements' names, not equipment or
implement abbreviations, and neither has a spelled-out form anywhere in the
curated vocabulary. Flagged for Sam rather than silently expanded.

| Sam's entry | Ships as | Pool (Sam) | Placement |
|---|---|---|---|
| Banded TKE | Banded TKE | Lower prehab | `LOWER_PREHAB_POOL` |
| Bodyweight Squat | Bodyweight Squat | Squat | `STRENGTH_POOLS.squat.accessory` |
| Bosch Hold | Bosch Hold | Lower prehab | `LOWER_PREHAB_POOL` |
| Erg EMOM | Erg EMOM | Conditioning | `CONDITIONING_META` |
| Glute Bridge | Glute Bridge | Hinge | `STRENGTH_POOLS.hinge.accessory` |
| Hamstring Curl | Hamstring Curl | Lower isolation | `STRENGTH_POOLS.isolation_lower.accessory` |
| Hollow Hold | Hollow Hold | Trunk/core | `TRUNK_ANTI_ROTATION_POOL` |
| Kneeling Jump | Kneeling Jump | Power | STAGED — power unit |
| Lateral Jump | Lateral Jump | Power | STAGED — power unit |
| Plank | Plank | Core | `TRUNK_ANTI_ROTATION_POOL` |
| Pogo Hops | Pogo Hops | Power | STAGED — power unit |
| Side Plank Row | Side Plank Row | Core | `TRUNK_ANTI_ROTATION_POOL` |
| Single-Arm DB Floor Press | Single-Arm DB Floor Press | Upper push | `STRENGTH_POOLS.horizontal_push.accessory` |
| Single-Leg Hip Thrust | Single-Leg Hip Thrust | Lower isolation | `STRENGTH_POOLS.isolation_lower.accessory` |
| Slant Board Step-Down | Slant Board Step-Down | Lower prehab | `LOWER_PREHAB_POOL` |
| Spanish Squat Hold | Spanish Squat Hold | Lower prehab | `LOWER_PREHAB_POOL` |
| Stir the Pot | Stir the Pot | Core | `TRUNK_ANTI_ROTATION_POOL` |
| back extension | Back Extension | Lower isolation | `STRENGTH_POOLS.isolation_lower.accessory` |
| crab walks | Crab Walks | Lower prehab | `LOWER_PREHAB_POOL` |
| dragon flag | Dragon Flag | Core | `TRUNK_ANTI_ROTATION_POOL` |
| high box squat | High Box Squat | Squat | `STRENGTH_POOLS.squat.anchor` |
| speed trap bar DL | Speed Trap Bar Deadlift | Power | STAGED — power unit |
| QL back extension | QL Back Extension | Mobility | `MOBILITY_POOL` |
| ATG split squat | ATG Split Squat | Mobility | `MOBILITY_POOL` |
| Elephant walks | Elephant Walks | Mobility | `MOBILITY_POOL` |
| Cossack Squat | Cossack Squat | Groin/adductors | `GROIN_ADDUCTORS_POOL` |
| Lateral Lunge | Lateral Lunge | Groin/adductors | `GROIN_ADDUCTORS_POOL` |

Merge survivors, for completeness: **Vertical Jump**, **Explosive Push-up**,
**Pogo Hops**, **RFE Split Squat Jump** (all four STAGED — power unit),
**Inverted Row (Bodyweight)**, **Seated DB Press**, **Bulgarian Split Squats**,
**Trap Bar Deadlift**, **Pull-Ups** (all five already curated and pooled).

## POWER — PLACED (2026-07-27), two still staged

Per Sam's note: wire per `docs/POWER_EXERCISE_POOL_SPEC_2026-07-23.md` where it
is built, else stage with pointers — do not invent placement. **That spec is now
BUILT and WIRED** (2026-07-27): `POWER_EXERCISE_POOL` + `selectPowerExercise` in
`src/rules/powerExercisePool.ts`, consumed by `buildPowerBlock`, which no longer
hardcodes identity. The pool is a real selectability source, so its entries are
ordinary vocabulary and `power_pool_pending` no longer covers them.

Sam authored the two missing cues the same day, which was the actual blocker —
`PowerRow` hardcoded `block.notes` precisely because the two power exercises that
shipped could not be cued.

**Placed in the Power pool:**

| Name | Cue ships | Video ships | Spec row |
|---|---|---|---|
| Vertical Jump | yes (Sam 2026-07-27) | yes (Sam 2026-07-27) | spec "Existing entries", lower default |
| Explosive Push-up | yes (Sam 2026-07-27) | yes (Sam 2026-07-27) | spec "Existing entries", upper default |
| Pogo Hops | yes | yes | spec "Existing entries", reduced-lower takeover |
| Kneeling Jump | yes | yes | spec "New entries", min training age `consistent` |
| Lateral Jump | yes | yes | spec "New entries", no training-age minimum |
| Depth Jumps | yes | yes | spec "New entries", min `developing`, needs a Box |
| Lateral Bounds | yes | yes | spec "New entries", min `developing` |
| RFE Split Squat Jump | yes (Sam 2026-07-27) | yes (Sam 2026-09-02) | added to lower Power pool by Sam 2026-09-02; min `consistent`, needs a Bench, off/pre-season only |

Wiring the pool turned `Vertical Jump` and `Explosive Push-up` into pool
exercises, which exposed a video gap that `power_pool_pending` had been hiding by
waiving pool + cue + video together. Sam supplied both URLs on 2026-07-27, so the
gap is CLOSED and the narrow `awaiting_sam_video` exemption that briefly held
them is RETIRED — the kind is deleted, not left empty, so it cannot become a
hiding place for a future hole. Every entry in the Power pool now carries a
curated cue and a real demo video with no exemption of any kind.

**Still STAGED — the spec's tables do not place these:**

| Name | Cue ships | Video ships | Why still staged |
|---|---|---|---|
| Speed Trap Bar Deadlift | yes | yes | NOT in the spec — barbell speed lift, see below |
| Speed Bench | yes | yes | NOT in the spec — pre-existing `power`-classified lift |

These two carry a curated cue and lack only a POOL, so `power_pool_pending`
now waives placement for a much smaller set than when it was written.

**Open for the power unit** (recorded, not invented here): the spec's pool has a
`family` axis of `lower` / `upper` only. `Speed Trap Bar Deadlift` and
`Speed Bench` are barbell speed lifts, not jumps — they need either a third
family or an explicit ruling that they belong in `lower` / `upper`. Sam's
changeset places both under "pool: Power" without splitting further.

## LOAD HANDLING

Band and bodyweight additions go straight to the no-load classes
(`TRUE_BODYWEIGHT_EXERCISES` for whole-body movements, `PREHAB_NO_LOAD_EXERCISES`
for band/prehab work): Banded TKE, Bosch Hold, Spanish Squat Hold, Slant Board
Step-Down, Crab Walks, Hollow Hold, Plank, Side Plank Row, Stir the Pot, Dragon
Flag, QL Back Extension, ATG Split Squat, Elephant Walks, Cossack Squat, Lateral
Lunge, Bodyweight Squat, Pogo Hops, Kneeling Jump, Lateral Jump.

### RULED — Sam, 2026-07-25, applied

The seven genuinely loaded additions, ruled line by line. `LOAD_RULING_PENDING`
is now **EMPTY**, and `exerciseLockedListTests` §8 asserts that emptiness plus
every shipped value below — so a future addition cannot be parked silently, and
a ruling cannot be recorded here without shipping.

Two columns because this app splits load handling in two: `loadRatio` is
progression *transfer* between pool siblings; `EXERCISE_LOAD_MAP` is the
*starting weight* estimate.

| Exercise | loadRatio | EXERCISE_LOAD_MAP | Sam's ruling |
|---|---|---|---|
| High Box Squat | 1.14 | `{ squat, 0.90, barbell }` | 1.2 × Box Squat, both derived from Box Squat (0.95 / 0.75). Heavier, not lighter — a higher box is a shorter range. |
| Glute Bridge | 0.00 | none — stays `TRUE_BODYWEIGHT_EXERCISES` | Bodyweight-with-optional. No starting suggestion; the cue's "add weight to hips if you can" stands on its own. |
| Single-Leg Hip Thrust | 0 (slot convention) | `{ squat, 0.20, dumbbell }` | Approved as proposed. |
| Hamstring Curl | 0 (slot convention) | `{ squat, 0.25, machine }` | Approved as proposed. See the rounding note below. |
| Back Extension | 0 (slot convention) | `{ squat, 0.15, dumbbell }` | Approved as proposed. |
| Single-Arm DB Floor Press | 0.35 | `{ bench, 0.22, dumbbell }` | Unchanged. |
| Speed Trap Bar Deadlift | n/a — still power-staged | `{ squat, 0.45, barbell }` | 40 kg reference (~0.45 × squat). Placement still owned by the power unit. |

`isolation_lower` entries keep `loadRatio: 0` because that slot transfers no
load between siblings by design; their starting weight comes from the map above,
not from rotation.

**Rounding — RULED by Sam, 2026-07-25: 20 kg accepted.** His reference figures —
17.5 / 22.5 / 12.5 / 40 kg — pin his reference athlete at an **88 kg squat 1RM**,
where `Single-Leg Hip Thrust` = 17.5, `Back Extension` = 12.5 and
`Speed Trap Bar Deadlift` = 40 all fall out of the ratios exactly.

`Hamstring Curl` cannot reach 22.5 at any bodyweight: `machine` rounds to 5 kg
increments (`ROUND_INCREMENTS`), so at 88 kg it surfaces **20 kg** — 22.5 is not
on the machine grid at all. Re-classing it as `dumbbell` would have produced 22.5
but would also have been wrong: equipment class gates availability filtering, and
a leg-curl stack is not a dumbbell.

Sam accepted **20 kg** and the machine grid stays at 5 kg increments. So the
ratio (0.25) and the equipment class (`machine`) both ship exactly as first
ruled, and nothing further is owed here. Recorded rather than dropped, because
the 22.5 in his original note would otherwise read as an unexplained miss.

### RULED — Erg EMOM conditioning classification

Approved by Sam, 2026-07-25: `{ tier: 'B-high', modality: 'mixed', impact: 'low' }`.

### RULED — QL / ATG naming

Approved by Sam, 2026-07-25: `QL Back Extension` and `ATG Split Squat` keep the
abbreviations verbatim. They are the movements' names, not equipment or
implement abbreviations, so the no-abbreviation rule does not reach them.

## VOCABULARY SWITCH (one circle)
- AI generation vocabulary derives from SELECTABLE POOL MEMBERSHIP (union of all
  selectable systems), replacing has-a-cue derivation. Invariant: vocabulary ≡ pool
  membership exactly; pool entry without cue+video (typed-kind exemptions only) or
  cue without pool entry FAILS the build.

### The one circle, as built

`src/data/selectableExerciseVocabulary.ts` is the single owner. Selectable pool
membership is the union of the four systems a live builder actually selects from
— `STRENGTH_POOLS`, `POOL_REGISTRY`, `MOBILITY_FLOW_TEMPLATES`,
`CONDITIONING_META` — and `curatedExerciseVocabulary()` returns exactly that set.

Exemptions are TYPED KINDS, never a bare name whitelist, so an exemption states
*why* a name is exempt and the build can check the reason still holds:

| Kind | Exempts | Meaning |
|---|---|---|
| `conditioning_format` | cue, video | A session format, not a movement to demo. Renders the conditioning family cue. |
| `zone1_recovery` | video | Zone-1 cyclical recovery: walking, skipping. Not a movement to demo. |
| `mobility_untagged` | tags | `EXERCISE_TAGS` is the strength taxonomy; stretching/breathing/tissue work carries none of its properties. |
| `power_pool_pending` | pool | Cue + video ship; pool placement is owned by `POWER_EXERCISE_POOL_SPEC`. Excluded from the AI vocabulary until placed. |

Both directions fail the build (`exerciseLockedListTests` §5,
`exerciseContentReconciliationTests` §1–§2,
`generationVocabularyContractTests` §1):

1. **pool → content**: a selectable pool entry with no cue, or no video, fails
   unless a typed kind exempts that specific field.
2. **content → pool**: a cue with no selectable pool entry fails unless
   `power_pool_pending` covers it.
3. **vocabulary ≡ pool membership**: the generation prompt offers exactly the
   selectable set, character for character, grouped by pool slot — so the
   hand-copied `MOVEMENT PATTERNS` list in `coach-chat`'s system prompt is
   deleted rather than kept in sync. One representation, derived.

## NOTES
- Conditioning formats: no videos by design (typed exemption).
- Groin coverage post-removals: Copenhagens + Groin Squeeze + Cossack + Lateral Lunge.
- speed trap bar DL / Speed Bench / jumps: pool 'Power' — placement per POWER_EXERCISE_POOL_SPEC; power unit owns wiring.
- Cue punctuation: the same mechanical terminal-stop pass Sam authorised on
  2026-07-24 is applied to the new cues (zero word changes) and mirrored above,
  so doc↔code equality holds byte for byte.

---

## Superseded by a later ruling

Rows ruled earlier in this document that Sam has since re-ruled. The original rows
are left exactly as recorded — a ruling document is a historical record, and editing
one to match today's code destroys the only evidence that the value ever changed.
Declaring the supersession here is how it becomes visible to the gate, in the same
shape `CUE_CHANGESET_2026-07-23.md` already uses.

- High Box Squat — re-ruled 2026-07-28. Sam set Box Squat to 0.9 and kept the
  relationship recorded above (High Box = 1.2 × Box), so High Box Squat becomes
  0.9 × 1.2 = **1.08**, replacing the `{ squat, 0.90, barbell }` row. The
  relationship is unchanged; only the Box Squat value it derives from moved. See
  `docs/PROVENANCE_INVENTORY_2026-07-28.md`.
