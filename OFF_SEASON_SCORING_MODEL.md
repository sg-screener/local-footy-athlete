# Off-Season Weekly Planner: Scoring Model (v2 — revised conditioning)

## Architecture

Slot-by-slot scorer. Walk sorted available days Mon → Sun. At each slot, score
every candidate session type against the partial plan built so far. Pick the
highest-scoring valid candidate. Every decision is context-dependent.

**Key change from v1**: conditioning is actively planned by the scorer, not
left to resolver Pass 2 gap-fill. The scorer outputs COND and S+C allocations
directly. The resolver respects these rather than independently deciding.

---

## 1. Candidate Session Types

| Candidate          | Shorthand | Tier     | What it means                                          |
|--------------------|-----------|----------|--------------------------------------------------------|
| Lower — squat      | `L-sq`    | core     | Quad-dominant: squat, lunge, step-up                   |
| Lower — hinge      | `L-hi`    | core     | Hip-dominant: deadlift, RDL, hip thrust                |
| Upper — push       | `U-pu`    | core     | Push: bench, OHP, dips                                 |
| Upper — pull       | `U-pl`    | core     | Pull: rows, pull-ups, face pulls                       |
| Full body          | `FB`      | core     | 1 squat/hinge + 1 push + 1 pull — all patterns        |
| Conditioning       | `COND`    | core     | Standalone conditioning (planned by scorer)             |
| Strength + Cond    | `S+C`     | core     | Combined: full strength block + conditioning finisher  |
| Accessories        | `ACC`     | optional | Trunk, prehab, calves, groin, shoulder health          |
| Recovery           | `REC`     | recovery | Mobility, foam rolling, light movement                 |

S+C is a modifier — it pairs with any strength candidate (L-sq+C, U-pu+C, etc.).
The strength subtype is scored independently; the +C part adds conditioning credit.

---

## 2. Hard Constraints

| ID  | Constraint               | Rule                                                                    |
|-----|--------------------------|-------------------------------------------------------------------------|
| H1  | Consecutive core cap     | No 3+ consecutive calendar days of core strength (S+C counts as core)  |
| H2  | Same-lower spacing       | Same lower subtype (L-sq or L-hi) separated by ≥2 calendar days       |
| H3  | Any-lower spacing        | Any lower exposure (L-sq, L-hi, FB) separated by ≥1 calendar day      |
| H4  | Availability             | Never schedule on unavailable days                                      |
| H5  | Minimum conditioning     | Week must contain ≥3 conditioning exposures (post-validation)           |
| H6  | Core strength budget     | Total core strength slots ≤ `core` count from buildCoachingPlan        |

---

## 3. Conditioning Targets

### 3a. Target calculation

```
Off-season conditioning targets:
  minimum (floor):   3 exposures/week
  baseline (target): 4 exposures/week
  high-end (cap):    5 exposures/week (occasional, not default)

condTarget = 4  (baseline for all off-season athletes)

adjustments:
  availableDays <= 3:              condTarget = 3  (not enough room)
  conditioningLevel == 'Poor':     condTarget = 3
  readiness == 'low':              condTarget = max(3, condTarget - 1)

condTarget = clamp(condTarget, 3, 5)
```

5 is NOT the default even for elite. It can be reached but is not targeted.
If condTarget reaches 5, the structure is: 4 core conditioning + 1 lower-intensity
optional conditioning (the 5th exposure is always lighter).

### 3b. Counting exposures

- Standalone COND day: 1.0 exposure
- S+C combined day (conditioning appended to strength): 0.75 exposure
- The 0.75 reflects shorter duration / reduced stimulus vs standalone

### 3c. Conditioning type variation

The scorer tracks conditioning TYPE across the week to ensure balance:

| Conditioning flavour | Description                              | Max per week |
|----------------------|------------------------------------------|-------------|
| `aerobic`            | Zone 2 / steady state / easy cardio      | 2           |
| `tempo`              | Tempo runs / repeat effort / threshold   | 2           |
| `high-intensity`     | MAS intervals / sprint intervals / Flog  | 1           |

The scorer doesn't pick the exact exercise (the resolver/builder does that),
but it assigns a conditioning FLAVOUR to each COND or S+C slot. This flavour
goes into the focus string so downstream systems respect the intent.

Scoring: if a flavour is at its weekly cap, candidates of that flavour get
score = -Infinity (hard block on excess high-intensity). Under cap, the
least-used flavour gets a small variety bonus.

### 3d. Conditioning is planned, not filled

The scorer actively places COND and S+C allocations. These go into the
weeklyPlan as real SessionAllocation entries. The resolver does NOT
independently gap-fill on top of these. Resolver Pass 2 only places
conditioning on days the scorer left truly empty (rare in off-season —
mostly relevant for in-season).

---

## 4. Soft Preferences (weighted scoring)

### 4a. Exposure need (weight: 30)
```
deficit = target - currentCount
if deficit > 0: score += 30 * deficit
if deficit <= 0: score -= 15  (overshoot penalty)
```
Applies to lower, upper, conditioning, and full-body targets independently.

### 4b. Spacing quality (weight: 20)
```
daysSinceSameRegion = gap since last lower/upper/conditioning
if daysSinceSameRegion >= 2: score += 20
if daysSinceSameRegion == 1: score += 0
```

### 4c. Team day preference (weight: +10 / -5)
```
if isTeamDay and candidate is upper/FB: score += 10
if isTeamDay and candidate is lower:    score -= 5
```
Small penalty — exposure need can override it.

### 4d. Combined day bonus (weight: 12)
Incentivise S+C when conditioning target has room and athlete can handle volume:
```
if condDeficit > 0 and (conditioningLevel in ['Good','Elite'] or
   no standalone COND adjacent): score += 12
```

### 4e. Fatigue wave (weight: 5)
```
Mon-Wed core: score += 5
Fri-Sun recovery/COND: score += 5
```
Tiebreaker only — never overrides exposure need or spacing.

### 4f. Variety (weight: -10)
```
if lastCoreSubtype == thisSubtype: score -= 10
```

### 4g. Conditioning flavour balance (weight: 8)
```
leastUsedFlavour bonus: score += 8 if this flavour has lowest count
atCapFlavour: score = -Infinity (hard block)
```

---

## 5. Combined Day Representation

A combined day is a single SessionAllocation:
```typescript
{
  tier: 'core',
  focus: 'Lower body — squat emphasis + tempo conditioning finisher (20min)',
  dayOfWeek: 'Monday',
  isHardExposure: true,
  conditioningFlavour: 'tempo',         // NEW — guides resolver/builder
  hasCombinedConditioning: true,        // NEW — tells resolver to skip gap-fill
}
```

Strength block renders first (full template). Conditioning block appended below.
NOT a merged hybrid session — two distinct blocks in the UI.

---

## 6. Algorithm

```
function buildOffSeasonPlan(inputs, core, optional, recovery):
  state = {
    consecutiveCoreCount: 0,
    lastLowerDay: -99,
    lastLowerSubtype: null,
    lastUpperDay: -99,
    lowerCount: 0,
    upperCount: 0,
    condCount: 0.0,         // fractional
    condFlavours: { aerobic: 0, tempo: 0, 'high-intensity': 0 },
    fbCount: 0,
    coreCount: 0,
    lastCoreSubtype: null,
    prevDayNum: -99,
  }

  targets = computeTargets(inputs, core)
  plan = []

  for slot in sortedDaySlots:
    best = { candidate: null, score: -Infinity }

    for candidate in ALL_CANDIDATES:
      if violatesHardConstraint(candidate, slot, state, targets): continue
      score = sumSoftPreferences(candidate, slot, state, targets, inputs)
      if score > best.score: best = { candidate, score }

    assign best.candidate to slot
    updateState(state, best.candidate, slot)
    plan.push(allocation)

  // Post-validation: ensure minimum conditioning
  if state.condCount < 3:
    promoteLowestValueSlotToConditioning(plan)

  return plan
```

---

## 7. Example Outputs

Same inputs, different contexts:

**4 core, 6 days, no team, Good conditioning, medium readiness**
```
Mon: L-sq    Tue: U-pu+C(tempo)   Wed: COND(aerobic)
Thu: L-hi    Fri: U-pl+C(aerobic) Sat: COND(tempo)
→ 4 strength, 4 conditioning (2 standalone + 2 combined × 0.75 = 3.5)
```

**4 core, 6 days, Tue/Thu team, Average conditioning, medium readiness**
```
Mon: L-sq+C(aerobic)  Tue: U-pu   Wed: COND(tempo)
Thu: U-pl             Fri: L-hi   Sat: COND(aerobic)
→ 4 strength, 3.75 conditioning (2 standalone + 1 combined)
```

**3 core, 5 days, no team, Poor conditioning, low readiness**
```
Mon: L-sq   Tue: COND(aerobic)   Wed: U-pu
Thu: COND(tempo)   Fri: L-hi
→ 3 strength, 2 standalone + 0 combined = 2 ... post-validation promotes Fri to L-hi+C(aerobic) → 2.75 ≈ 3
```

**2 core, 4 days, no team, Good conditioning, medium readiness**
```
Mon: FB+C(tempo)   Wed: COND(aerobic)   Thu: U-pu   Sat: COND(aerobic)
→ 2 strength, 3.75 conditioning
```
