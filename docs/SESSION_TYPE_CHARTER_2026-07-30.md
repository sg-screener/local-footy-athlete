# THE SESSION TYPE CHARTER

**Sam's rulings, 2026-07-30. Step 2 of the charter work; step 1 was
`SESSION_TYPE_CHARTER_SURVEY_2026-07-30.md`.**

A session type does not exist until four questions are answered:

| | The question |
|---|---|
| **(a)** | **Who may PLACE it** — the generator, the athlete, or a declared fact |
| **(b)** | **Who CHOOSES it** — which athlete door reaches it |
| **(c)** | **What it COUNTS as** — load, hard days, and whether it is REQUIRED work |
| **(d)** | **Who AUTHORED its contents** — the sheet, pool or template it draws from |

The survey found the app could not answer all four for **five of the seven**.
Every one of those gaps is a question nobody asked at the moment the type was
introduced, which is the whole reason this gate exists rather than a document.

The charter lives in code — `src/rules/sessionTypeCharter.ts` — because a
charter in prose is a description, and a description drifts from the thing it
describes silently. That is exactly how the app came to offer five words where
Sam has seven. The four answers are **required fields**: a type with a missing
answer does not compile.

`src/__tests__/sessionTypeCharterTests.ts` (`npm run test:session-type-charter`,
in `test:bible`) binds every answer to the code, both directions.

---

## The seven, as ruled

| # | Type | (a) Placed by | (b) Chosen by | (c) Counts as | (d) Authored source |
|---|---|---|---|---|---|
| 1 | **Rest** | generator, athlete, fact | **Remove** — never by adding a rest session | nothing; the quota counts days with **no REQUIRED work** | no contents |
| 2 | **Recovery** | **athlete only** | `recovery` | nothing, never hard, never breaks rest | the 10 mobility flow templates |
| 3 | **Strength** | generator, athlete | `strength_upper` / `strength_lower` / `strength_full` | load; hard when heavy; **required** | `STRENGTH_POOLS` via `strengthIntent`, gated by the locked list — **seven variants** |
| 4 | **Conditioning** | generator, athlete | `conditioning_light` / `conditioning_hard` | load; hard when high; **required** | the 55 signed conditioning templates |
| 5 | **Mobility** | **athlete only** | a **Mobility** category (stage 4) | nothing, never hard, never breaks rest | the 10 mobility flow templates |
| 6 | **Prehab** | generator, athlete | `accessories` | nothing, never hard, never breaks rest | 36 exercises across 6 pools |
| 7 | **Gunshow** | generator, athlete | `accessories` | nothing, never hard, never breaks rest | 16 candidates: biceps 5 + triceps 5 + **pump delts** 6 |

### The Rest law

> **The rest quota counts days with no REQUIRED work. Athlete-added optional
> sessions never break rest.**

This is what resolves the collision the previous session escalated (ruling 1 vs
`section18ContractV2Tests` 8a/8b/P5). The old defect was the app crediting
itself a rest day it had filled with its own recovery session — a
**contract-satisfaction** claim. Sam's ruling is about the **athlete**: a day of
foam rolling the athlete chose is still their rest day. Both hold once
"required" is the predicate the quota tests, and once the generator stops
placing optional work uninvited, the old defect becomes unrepresentable rather
than detected. Stage 2 lands both together.

### The two signed censuses

Both were confirmed exactly as Sam stated them, and are pinned per-pool (not as
a total — a total can stay right while two pools move in opposite directions):

- **Prehab: 36 across exactly 6 pools.** Groin/adductors 5, calves 2, lower
  prehab 6, trunk anti-rotation 17, shoulder health 5, hamstring light 1.
- **Gunshow: 23 candidates (updated 2026-08-21).** Biceps 8, triceps 7,
  shoulders 8.

**Gunshow "shoulders" means `DELTS_POOL`** — pump work. Shoulder health
(external rotation, scap work) stays with Accessories, inside the 36.

**Gunshow is normal gym work with a complete authored 2 + 2 + 2 shape.** No
cross-family top-ups. The app never invents a fourth family to fill a quota.

---

## What the gate found on its first run

Two things, both of which a document could not have found.

### 1. The Accessories door builds a HARD strength day

The previous session verified ruling 2 — "gunshow, accessories, recovery and
prehab are all NOT hard days" — by reading the routing:
`gunshow_prehab` → `contributions.gunshow` → `dayRecovery`, never `dayHard`.
**The routing is exactly as it was read. The sessions never reach it.**

- `accessories_prehab` classifies as **`lower_strength` at HIGH stress** and
  takes a hard day.
- `accessories_pump` classifies as **`upper_strength`**.
- **Neither produces a `gunshow` contribution at all.**

So an athlete who adds Accessories can consume a hard day from the week's
budget, against Sam's ruling. Pinned as a red-on-change cell (C3) rather than
fixed here — a Section 18 classification change belongs to stage 4's door, not
to stage 1's charter. This is AGENTS.md's own lesson with a live example: a
check that reads code rather than behaviour is coupled to the code's shape, and
the shape was right while the behaviour was wrong.

### 2. The Gunshow draws a name Sam did not sign

The built pump session prescribes **"Face Pull"**, which is in
`UPPER_BACK_PUMP_POOL`. The signed delts pool contains **"Cable Face Pull"** —
a different authored entry. So the session reaches outside the sixteen Sam
signed, across a family boundary, which is precisely the top-up his ruling
forbids. Declared as gunshow composition debt, paid by stage 4.

### And one correction to the survey

The survey said **11** mobility flow templates. There are **10**. The handover
brief repeats the 11. Nothing depends on the number yet; stage 4 does, so it is
corrected here before it is built on.

Also worth Sam's eye before stage 4: one of the ten,
`hips-adductors-groin-reset`, carries **4** movements, below the 5-8 window the
Mobility door is ruled to offer.

---

## The debt, and why it is declared rather than hidden

The charter records the **ruled end state**. The code has not arrived at it —
stages 2, 3 and 4 are what bring it there. A charter that merely mirrored
today's behaviour could not fail, and therefore could not move anything.

So every deviation is enumerated in `CHARTER_DEBT` with the stage that pays it,
and the gate holds **four directions** on that list:

1. every ruled answer the code already satisfies stays satisfied
2. every deviation the gate observes is declared
3. every declared deviation is still **real** — stale debt fails
4. per-type ceilings hold with **equality**

Direction 3 is the one usually missing: an entry whose deviation has been fixed
goes on excusing a cell that no longer needs excusing, so the next regression
there passes silently. Direction 4 is why the ceilings are per-type and not a
budget — a budget lets one type spend another's savings, and then the total
stays flat while a regression lands.

**15 declared debts at stage 1:**

| Type | Ceiling | Owed on |
|---|---|---|
| Rest | 1 | placement (rest is a residue) |
| Recovery | 3 | placement, counting, composition |
| Strength | 1 | composition (four variants where seven were ruled) |
| Conditioning | 1 | composition (door builds from registry labels, not the 55) |
| Mobility | 4 | all four — it has no door and no builder |
| Prehab | 2 | placement, counting |
| Gunshow | 3 | placement, counting, composition |

Stage 2 pays five of them; stage 3 one; stage 4 eight; stage 5 one.

---

## Open questions for Sam — not invented, not assumed

1. **Do Prehab and Gunshow deserve separate doors?** They share `accessories`
    today. Sam's vocabulary has seven words and the athlete's has five; the
    survey called this out. Splitting the door is athlete-visible and therefore
    Sam's, so nothing has been split. Stage 5 sends the strings for signing and
    is the natural place to answer it.
2. **Does Prehab get an authored per-region shape?** `TRUNK_ANTI_ROTATION_POOL`
    is 17 of the 36, so a flat draw is mostly trunk work, and
    `HAMSTRING_LIGHT_POOL` has one entry so any session with a hamstring slot
    repeats it every time. Sam was shown this and has not ruled a shape.
3. **May a Mobility flow with 4 movements be offered** when the door is ruled
    to give 5-8, or is that template amended?
