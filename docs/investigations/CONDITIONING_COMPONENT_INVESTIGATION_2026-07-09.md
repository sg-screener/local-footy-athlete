# Conditioning Components vs Finishers — Investigation & Design (2026-07-09)

READ-ONLY investigation. No code changed. Companion to
`BIBLE_FINISHER_RULES_2026-07-09.md` (esp. §10 finisher ≠ conditioning
component) and `FINISHER_VARIETY_INVESTIGATION_2026-07-09.md`.

Question: where do hard conditioning, VO2, glycolytic and sprint/speed work
belong for an off-season 4-day athlete, and why does the engine currently
output only `Upper+tempo / Lower+easy aerobic` ×2?

---

## 1. Root cause of the tempo/aerobic-only output

Two independent causes. Both must be fixed; fixing only one is not enough.

### 1a. Structural: on a 4-day week, ALL conditioning is finisher-sized

- 4-day athlete → `core = 4` strength, `daySlots.length = 4`
  → `standaloneSlotsAvailable = Math.max(0, 4 - 4) = 0`
  (coachingEngine.ts:1302). No standalone COND day can ever exist.
- Therefore every conditioning exposure must ride as
  `hasCombinedConditioning` — and the ONLY combined representation is the
  finisher: `CONDITIONING_DURATION_CAP.combined = { max: 30, target: 22 }`
  and the tempo combined template is 10–15 min, commented "small by design
  (a finisher, not a session)" (sessionBuilder.ts:1196–1199, 1289–1323).
- There is no type anywhere that says "this attached conditioning is a
  planned 20–30 min component". Bible §10 requires that distinction; the
  code cannot express it.

### 1b. Mechanical: the flavour round-trip makes VO2/glycolytic unreachable

This is the smoking gun for "why never hard conditioning on upper days".

Both S+C call sites compute the requested category as:

```
requestedCategory = flavourToSelectedCategory(pickCondFlavour(pos), pos)
```
(coachingEngine.ts:3321 candidate filter, 3347 placement)

The round-trip is lossy — 5 categories are squeezed through 3 flavours:

1. `pickCondCategory` picks `vo2` (mid-zone priority, coachingEngine.ts:2274).
2. `categoryToFlavour(vo2)` → `'high-intensity'` (coachingEngine.ts:1214).
3. `flavourToSelectedCategory('high-intensity')` candidates are
   **`['sprint', 'glycolytic']` — vo2 is not in the candidate set**
   (coachingEngine.ts:2356–2359).
4. Off-season priority is `['aerobic_base', 'sprint', 'vo2', 'glycolytic']`
   (coachingEngine.ts:1194–1195), so the first uncovered candidate is
   always **sprint**.
5. `finisherEligibility` ladders every non-standalone sprint request to
   **tempo** (coachingEngine.ts:1894–1897) — correct law, wrong input.
6. The placed category recorded in `st.condCategories` is `tempo`
   (coachingEngine.ts:3394), so **sprint never becomes "covered"** — and
   step 4 therefore resolves to sprint again on every subsequent slot.

Net effect in off-season: every high-intensity pick → sprint request →
tempo. `vo2` and `glycolytic` are **unreachable** in the attached path,
even though `finisherEligibility`'s hard-non-sprint branch
(coachingEngine.ts:1969–1975) WOULD allow them on upper days: a 4-day
week has only 2 high-stress days (the lowers), well under the ≥4 headroom
gate, and readiness gates pass on a healthy athlete.

### Resulting week (matches Sam's observed output exactly)

| Slot | Day | Zone pick | Round-trip | Eligibility | Placed |
|---|---|---|---|---|---|
| 1 | Upper Push | sprint (early) | sprint | ladder → tempo | **U-push + tempo** |
| 2 | Lower Hinge | sprint (uncovered) | sprint | lower pairing → easy | **L-hinge + easy aerobic (off-feet)** |
| 3 | Upper Pull | vo2 (mid) | **sprint** (!) | ladder → tempo | **U-pull + tempo** |
| 4 | Lower Squat | aerobic (late) | aerobic_base | allowed | **L-squat + easy aerobic (off-feet)** |

The lower-day protection (1935–1941) is CORRECT per Bible §5 and should
stay. The upper days are wrongly capped at tempo by 1b, and even a fixed
request would only buy a 10–15 min *finisher*, not a real component (1a).

---

## 2. Current code paths (A + B answers)

### A. Representation

`SessionAllocation` (coachingEngine.ts:68–171) — everything attached is:

- `hasCombinedConditioning?: boolean` — the ONLY finisher/component marker
- `conditioningFlavour?: 'aerobic' | 'tempo' | 'high-intensity'`
- `conditioningCategory?: 'aerobic_base' | 'tempo' | 'sprint' | 'vo2' | 'glycolytic'`
- `conditioningVariant?: 'standard' | 'reduced' | 'micro_dose'` (sprint only)
- `conditioningOffFeet?: boolean` (4B, standalone tempo)
- `conditioningFeel?`, `ergModality?`, `stressLevel?`

**No duration, size, or intent field exists** on allocation or domain
`Workout` (domain.ts:287–359, mirrors the same fields +
`conditioningBlock`). Size is inferred downstream in
`buildCombinedConditioningTemplate` purely from category + the combined
flag. Standalone = separate allocation with cond fields and
`hasCombinedConditioning` falsy (caps 45/35, sessionBuilder.ts:1196–1199).

Carries / trunk / mobility / prehab add-ons: **no category exists at
all**. Bible §5/§6 lists them as first-class lower-day finisher options;
the engine can only express `aerobic_base`.

### B. Gating today

`finisherEligibility` (coachingEngine.ts:1872–1978), wired into all four
paths (in-loop S+C 3321/3347, standalone COND 3420, H5a 3650, H5b 3761):

| Branch | Effect |
|---|---|
| sprint + attached (1894) | ALWAYS ladder → tempo. Sprint is blocked from ALL attached conditioning by design, not just "as a finisher" |
| game window (1901) | G-0/G-1 deny; G-2 hard→easy |
| team day (1910) | pre-season deny; else hard→easy |
| TT-adjacent (1919) | hard→easy (standalone tempo survives off-feet; sandwiched→easy) |
| lower/hinge/full pairing (1936) | hard→easy off-feet. Correct, keep |
| standalone sprint (1947) | off-season deny (no late-block model), TT/game deny, readiness<high deny |
| tempo (1959) | low readiness→easy, else allow |
| vo2/glyco (1969) | low readiness→easy; ≥4 high days→tempo; **else ALLOW** — but never receives a request (§1b) |

So: vo2/glyco are blocked *de facto* (request path bug + finisher-only
sizing), not *de jure*. Sprint is blocked entirely from attachment (v1
law) and from off-season standalone (no late-block flag). H5a floor
conversion (3511) only fires when `condCount < 2` — with 4 finishers at
0.75 credit each (3392) it never fires on this week shape.

`condTarget` for this athlete = `max(4,4)=4` (1279); ~3.0 credited via
finishers — target quietly missed, and nothing escalates a finisher into
a component to close the gap.

---

## 3. Missing model (C answer)

The Bible §10 distinction needs to become a TYPE, not a comment. Proposed:

```ts
// On SessionAllocation + domain Workout, only when conditioning is attached:
attachedConditioningKind?:
  | 'finisher'                // small add-on, ≤15 min, skip ladder applies
  | 'component'               // planned 20–30 min conditioning, first-class
  | 'speed_component'         // sprint/COD done FRESH (pre-lift), upper days
  | 'recovery_addon';         // carries / trunk / mobility / breathing / prehab
```

Semantics per kind:

| | finisher | component | speed_component | recovery_addon |
|---|---|---|---|---|
| Categories | aerobic_base, tempo | aerobic_base, tempo, vo2, glycolytic | sprint (COD later) | new: carries/trunk/mobility/prehab |
| Duration | ≤15 min (aerobic flush 20–25 bike OK per Bible §3) | 20–30 min | 15–20 min, placed BEFORE lifting | 8–12 min |
| Cond credit | 0.75 | 1.0 | counts sprint/COD exposure, not cond | 0 (recovery) |
| Hard exposure | never (tempo=medium) | yes when vo2/glyco | yes | no |
| Skip ladder (Bible §1/§9) | applies | **never stripped** (Bible §10) | never stripped; may be *moved*, not converted | applies |
| Legal pairings | any day per current law | upper days only (v1) | upper days only, fresh | lower/hinge days primarily |

Standalone conditioning stays what it is (its own allocation) — no change.

The old boolean stays derivable: `hasCombinedConditioning === kind != null`,
so downstream readers keep working during migration.

---

## 4. Off-season 4-day target (D answer)

For a normal healthy off-season 4-day athlete (readiness normal+, no
lower-limb niggle, no games/TT). Within Bible caps: ≤4 main strength,
3–5 cond exposures, ≤4 hard days target (BIBLE_WEEKLY_CAPS,
weeklyExposureCounts.ts:47–67).

Target shape:

- **1 hard conditioning component** (vo2 OR glycolytic OR hard mixed) on
  an upper day — high-day math: 2 lowers + 1 upper+hard = 3 ≤ 4 ✅
- **1 tempo component or finisher** on the other upper day
- **Lower days: easy aerobic flush / carries / trunk / mobility — or
  nothing** when session load is high (Bible §5/§6)
- **Speed**: optional, as a fresh pre-lift `speed_component` on an upper
  day — but GATED on the late-block model that does not exist yet (Sam
  rejected the miniCycle proxy; sprint stays out of off-season until a
  real block/subphase flag exists). Zone picker should stop requesting
  sprint in off-season until then.
- **Long aerobic**: bike may be 20–30+ min continuous; row/ski ≤10 min
  continuous or intervalised (Bible §2/§3 — already the law for
  finishers; components inherit it).

Correct example weeks (all currently impossible to generate):

```
1. L-hinge + carries/trunk        2. U-push + speed (pre-lift)   3. L-hinge + easy flush
   U-push + VO2 component            L-hinge + easy off-feet        U-push + tempo
   L-squat + easy bike               U-pull + hard component        L-squat + (nothing)
   U-pull + tempo finisher           L-squat + easy bike            U-pull + hard component
   (shape 2 blocked on late-block model for the speed day)
```

Weekly exposure ledger for shape 1: cond credits 0.75+1.0+0.75+0.75 ≈ 3.25
(target 4 → close; component=1.0 helps), hard days 3, steady-erg
finishers ≤2, all four strength patterns intact.

---

## 5. Rules proposal (E answer)

All evaluated in a new `componentEligibility()` that REUSES
finisherEligibility's protective branches (game window, TT day/adjacency,
readiness, pairing) — one law, two dose levels:

1. **Upper + hard conditioning (vo2/glyco/component)**: allowed when
   readiness ≠ low, high-day count would stay ≤ 4, not TT-adjacent, not
   G-0/-1/-2, max 1 hard component per week (off-season v1).
2. **Upper + VO2**: same as above; vo2 vs glycolytic chosen by coverage
   rotation (both must be reachable — fix §1b).
3. **Upper + sprint/speed**: `speed_component` only, placed BEFORE
   lifting, readiness high, day before must not be vo2/glyco (existing
   sprint-protection), never TT-adjacent. Off-season: denied until the
   late-block flag exists (unchanged law).
4. **Lower + hard conditioning**: never attached (keep 1936–1941).
   Hard conditioning after heavy lower only as Bible §5 forbids.
5. **Lower + easy aerobic**: allowed; bike steady 15–25 min, row/ski
   ≤10 min or intervalised; counts toward the ≤2 steady-erg cap.
6. **Lower + carries/trunk**: allowed as `recovery_addon` (new
   categories), short/controlled per Bible §6; skip when session load
   already high.
7. **Full body + conditioning**: treat as lower (current
   `strengthContextOf` already maps FB → 'full' → easy only). Keep.
8. **Game/TT proximity**: components obey the SAME window law as
   finishers (G-0/G-1 none, G-2 easy only, TT days/adjacent no hard).
   TT+games count as cond/sprint exposure before adding anything (Bible §8).
9. **Low readiness**: hard component → tempo → easy (existing ladder);
   speed_component → skip entirely (never downgrade sprint into grind).
10. **Lower-limb injury/niggle**: read via the same regex family as
    `standaloneTempoOffFeet` (coachingEngine.ts:1862–1864) — hard
    component forced off-feet or → tempo; speed_component denied.
    (Inspect-only here; real injury wiring is Phase 5.)

---

## 6. Implementation options (F answer)

1. **Minimal — fix the round-trip only.** Pass `pickCondCategory(pos)`
   straight to `shouldAttachFinisher` at 3321/3347; delete the lossy
   flavour→category re-derivation (flavour becomes purely
   category-derived, which 4A already half-did). VO2/glyco reappear on
   upper days. ~20 lines. **But**: they appear as 10–15 min finishers —
   exactly the "hard work hidden as random finishers" Sam ruled out, and
   still no carries/trunk, no speed, no §10 protection.
2. **Typed `attachedConditioningKind`** (recommended): option 1 + the
   kind field (§3) + `componentEligibility` dose tier + component-sized
   templates (20–30 min) in `buildCombinedConditioningTemplate` + 1.0
   credit + kernel/validator counting components as hard when hard.
   Systemic: one enum drives eligibility, sizing, credit, stress, label.
3. **Separate `speedComponent`**: adds the pre-lift speed slot. BLOCKED
   on the late-block/subphase model (Sam rejected proxies) — design it
   into the enum now (`speed_component`), implement after that model exists.
4. **Broad session-component rework** (sessions become ordered lists of
   typed components: warmup/speed/strength/conditioning/addon). Cleanest
   long-term, but touches rendering, naming, QA stubs, revision
   snapshots — out of scope while coach-revision + rebuild architecture
   are settling. Not now.

## 7. Recommended next slice (G answer)

**Option 2, in two Codex-sized sub-slices:**

- **Slice 1 (mechanical, no new model):** kill the flavour round-trip —
  category is picked ONCE by `pickCondCategory` and flows through
  eligibility → placement → template untouched; flavour is derived from
  final category only (single source, finishing what 4A started). Gate
  the zone picker's sprint entry off-season (it can never be granted →
  stop requesting it, so mid-zone vo2 picks survive). Result: upper days
  can carry vo2/glyco again, correctly labelled.
- **Slice 2 (the model):** add `attachedConditioningKind` +
  `componentEligibility` (dose tier over the same protective branches) +
  component templates (20–30 min vo2/glyco/tempo/aerobic) + credit/stress
  /counting + Bible §10 protection (validator: components are never
  skip-laddered). Recovery_addon (carries/trunk/mobility) can ride in
  slice 2 or follow as slice 2b using the finisher-pool work already
  specced in FINISHER_VARIETY_INVESTIGATION (slice D there).

Speed/speed_component = slice 3, explicitly BLOCKED on Sam's late-block/
subphase decision.

## 8. Files affected (slices 1–2)

- `src/utils/coachingEngine.ts` — round-trip removal (3321/3347),
  zone lists (2272–2280), `finisherEligibility`/new `componentEligibility`
  (1872–1978), S+C placement (3343–3414), credit (3392), kind stamping
- `src/utils/sessionBuilder.ts` — component-sized templates + duration
  caps (1196–1199, 1232–1400), kind-aware label/sizing
- `src/types/domain.ts` — `attachedConditioningKind` on Workout (287–359)
- `src/utils/defaultProgram.ts` — `buildCondLabel`/focus rendering honesty
  ("+ VO2 conditioning component (25 min)" vs "+ easy flush")
- `src/rules/sessionTaxonomy.ts` / `stressClassification.ts` /
  `weeklyExposureCounts.ts` — component classification, hard-exposure
  counting, credit
- `src/rules/weekStructureValidator.ts` — §10 never-strip finding; hard
  component counted into hard-day grading
- QA stubs in `src/__tests__/weekPlanQA.ts` — carry the new field
  (same class of bug as the S6 stub-drop)

## 9. Tests needed

1. **Round-trip regression**: off-season 4-day, normal readiness → at
   least one upper day carries vo2 OR glycolytic; zero sprint requests
   off-season; category recorded == category requested-or-laddered (no
   silent sprint substitution).
2. **Component sizing**: kind='component' → 20–30 min template;
   kind='finisher' → ≤15 min (tempo) / Bible §2–3 erg rules.
3. **Lower protection unchanged**: lower/hinge/FB days never receive
   hard attached work, any kind (existing finisher-eligibility suite grows).
4. **Headroom**: week already at 4 high days → component request lands
   as tempo; readiness low → easy; G-window/TT branches identical for
   both kinds.
5. **§10 never-strip**: skip ladder may remove finishers, never
   components/standalone (validator finding if violated).
6. **Counting**: component=1.0 credit + hard exposure when hard; ≤2
   steady-erg cap spans both kinds; BIBLE_WEEKLY_CAPS audit stays clean
   on the target shapes in §4.
7. **QA sweep**: S6-class scenarios re-baselined; display label matches
   category+kind (label-honesty assertion).
8. Existing suites must stay green: finisher-eligibility (79),
   stress-placement, rules-kernel, week-validator, QA (163, only known
   S4/E1 bye strongs).

## 10. Codex-readiness

- **Slice 1: YES** after approval — small, mechanical, fully specced above.
- **Slice 2: YES** after Sam approves the §3 enum + §5 rules (this doc is
  the spec); needs the §9 test list attached to the task.
- **Slice 3 (speed): NO** — blocked on the late-block/subphase model
  decision (Sam previously rejected proxies).

Untouched per instructions: rebuild architecture, Coach Notes, chat/LLM;
injury/readiness only inspected (read via `inputs.injuries` regex +
profile-derived `readiness`, coachingEngine.ts:735, 1856–1870).
