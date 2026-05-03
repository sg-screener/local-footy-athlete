# Conditioning rotation — design pass

**Status:** draft for review, no code yet.
**Scope:** answer the five mapping questions. Decide afterwards whether to extend the strength-pool architecture or build adjacent.

---

## TL;DR

Conditioning is **not a pool-shaped problem**, and the strength-pool architecture does not port cleanly onto it. The instinct to reuse is strong because both systems ask "what should this session be?", but the shape of the answer is different.

The strength pool works because within a slot every entry is a variant of the same movement pattern with a shared progression currency (load × reps). That lets us rotate between Back Squat and Front Squat and meaningfully transfer load via `loadRatio`. Conditioning has no such shared currency — a 4x4 VO2 session and a 1km Repeats session aren't "variants of the same lift," and you can't normalise one to the other with a ratio.

What conditioning already has is **five independent rotation axes** (category, template, feel, modality, variant) with well-tuned cadences. The useful question isn't "should we bolt on pool rotation?" It's "what cross-cycle coherence is missing today, and is that coherence worth adding?"

My read: there is a real but small gap — **mini-cycle-level template stability**. Everything else is working. A minimal, targeted enhancement is the right move, not a parallel pool architecture.

---

## Q1 — What is the "unit"?

There are five candidates, all of which exist as fields on the engine output today:

- **Category** (`aerobic_base | sprint | vo2 | glycolytic`) — what energy system this session trains. *This is the load-bearing concept.* The weekly plan decides on categories; everything downstream flows from the category.
- **Template** (`4x4 VO2`, `1km Repeats`, `Free Sprint Session`, `Long Nasal Run`, `MAS 15:15`, ...) — how the session is structured. Each category has a small pool of templates.
- **Feel** (`grindy | sharp | flowing`) — density dimension (work:rest ratio, work duration). Engine-authoritative via `assignConditioningFeel`.
- **Modality** (`bike | row | ski | mixed` for ergometer, or "run") — what equipment. Engine-level via `ergModality`, with weekly-uniqueness and consecutive-day avoidance.
- **Variant** (`standard | reduced | micro_dose`) — volume scaling. Only used today for sprint-rescue fallback.

Concretization pipeline: `pickCondCategory` (engine, per-slot) → `conditioningCategoryToExerciseName` (builder, date-hashed template pick) → `buildConditioningTemplate` (builder, reads feel / variant / ergModality and emits `WorkoutExercise[]`).

**The unit for rotation purposes should be category.** It's the axis the athlete perceives as "what am I training today?" and it's what the weekly planner already works in. Template / feel / modality / variant are variation dimensions layered over it.

---

## Q2 — Does rotation happen within a block or across blocks?

The honest answer: **conditioning already rotates at every granularity, but mostly within a week, not across blocks.**

The existing rotation cadences:

1. Category → **within-week** via `pickCondCategory`. Every week walks all four categories before repeating. Zone-biased (early → vo2/glyco, mid → sprint, late → aerobic_base).
2. Template → **week-to-week** via `conditioningDateHash`. Same week → same template; next week → different template within the same category.
3. Feel → **within-week** via `assignConditioningFeel`. Engine-authoritative, balanced so every week has ≥1 sharp + ≥1 flowing.
4. Modality → **week-to-week** with consecutive-day avoidance.
5. Variant → **cross-week only for sprint** (`previousWeekSprintVariant` guards against back-to-back micro_dose).

What's missing: **mini-cycle-level coherence.** Today a 3-week block gets three different VO2 templates because the date hash re-picks each week. That's fine for variety but doesn't let the athlete get good at one template — there's no "3 weeks of 4x4, progression via shorter rest or faster splits" equivalent to how strength rides the same anchor for a whole block.

The parallel to strength is: anchor stable within block, accessory varies within block. For conditioning, a similar shape would be: **template stable within block** (athlete becomes fluent on one VO2 structure), **feel/modality vary within block** (week-to-week novelty), **template rotates across blocks** (new stimulus, no mathematical load transfer needed).

The question to validate: do you actually want template stability, or is weekly variety more important? This is a coaching philosophy call, not a technical one.

---

## Q3 — What replaces the idea of "slots" for conditioning?

Nothing, directly. Strength slots are movement patterns — a structural partitioning of the body's work. A week has one squat slot, one hinge slot, etc., and rotation happens *inside* each slot.

Conditioning has no analogous partitioning. Categories aren't slots — they're axes. A week doesn't have "a sprint slot and a VO2 slot in fixed positions"; it has N conditioning sessions and the planner distributes categories across them based on zones, priority, and constraints. The slot *position* (early/mid/late) influences category choice, but the category isn't pinned to a slot the way Back Squat is pinned to the squat slot.

If we force an analogy, the closest thing is: **category is the axis, and the template pool within each category is the variation set.** But there's no anchor/accessory split — a 4x4 VO2 is not "primary" and a 1km Repeats is not "secondary"; they're peers within the VO2 pool.

Practical implication: a pool-like data structure would look something like

```ts
type CondTemplatePool = Record<ConditioningCategory, TemplateEntry[]>;
```

— a flat list per category, no anchor/accessory role, no `loadRatio`. That's fundamentally a different shape from `STRENGTH_POOLS`. Reusing the strength pool types would require either distorting them (make every accessory role empty; make every loadRatio 0) or forking them (new types, new rotation helpers).

My vote: **don't force slot shape onto conditioning.** If we add cross-cycle coherence, do it with a conditioning-specific primitive that honours the actual structure.

---

## Q4 — Where should variation actually live?

Three levels, with different cadences:

1. **Energy system (category)** — this is what the athlete's *body* perceives. Rotation at this level is about weekly coverage and seasonal periodization. Already handled well by `pickCondCategory` and `CATEGORY_PRIORITY_OFF/PRE`. Nothing to do here unless you want per-mini-cycle phase priority (e.g., off-season mc1 emphasises aerobic_base, mc2 emphasises vo2). That's a coaching call, not a code problem.

2. **Template (structure)** — this is what the athlete's *mind* perceives. "Today is 4x4" vs "Today is 1km repeats" feels different even within the same category. Current rotation: date hash. Possible enhancement: mini-cycle-aware template selection so a block stays on one structure.

3. **Modality (equipment) + feel (density)** — these are what the athlete's *legs and lungs* perceive. Current rotation: weekly for erg modality, within-week for feel. Both feel well-tuned. Probably no action needed.

**The main lever worth pulling is template-level rotation across mini-cycles.** Everything else is either already handled or a coaching preference dressed up as a technical question.

What template rotation would *not* do: transfer any kind of progression. There's no conditioning `loadRatio`. If mc1 uses 4x4 VO2 and mc2 uses 1km Repeats, the athlete starts fresh on the new template. That's fine — conditioning progression is mostly within-template (shorter rest, faster splits, more reps), not across templates.

---

## Q5 — How does it interact with team training and existing constraints?

All five constraint families already live in the engine/builder, and a template-rotation layer would sit **above** them — rotation picks the template, post-validation enforces caps and swaps. No constraint relaxation is needed for rotation to slot in.

Relevant constraints, briefly:

- **Team training days** displace standalone conditioning. Team day = no conditioning block placed. Team day **counts as run exposure** for the run-load guard (`dayIsRun = candidateIsRun OR isTeamDay`). Rotation must respect: if this week's scheduled VO2 falls on a team day, it doesn't happen this week — the template pick should either skip or defer.
- **Running caps (R23, H-PRE-12)** mean that even if a rotation would pick a run-based template, it can get swapped to an off-feet variant by `switchToOffFeetModality`. Rotation is *proposal*; post-validation is *enforcement*. Same pattern as strength pool rotation sitting before structural invariants.
- **Sprint protection (ABSOLUTE)** — sprint never after vo2/glyco. Rotation within the sprint category should never pick a variant that lands after vo2/glyco; the engine already enforces this at placement time, so template rotation downstream of placement is safe.
- **Game proximity** (conditioningRules.ts) blocks conditioning 48h pre/post game. Rotation decisions would be moot on those days — no session to rotate. Only relevant at the week boundary (which template the *next* eligible conditioning day gets).
- **Combined S+C pairing rules** (bad: lower+glyco, lower+sprint; good: lower+aerobic, upper+vo2). Rotation touches template not category, so pairing rules are upstream and unaffected.

Practical principle: any rotation layer must **read the engine's category placement as fixed** and only vary the template/feel/modality within that placement. It must not try to move categories between days to satisfy a rotation schedule — that way lies fighting the placement logic.

---

## Architectural recommendation

Three options, from lightest to heaviest.

**Option A — Do nothing. Document the five existing rotation axes.** The current system already delivers varied, balanced, constraint-respecting weeks. The strength-pool work exposed a real gap (cross-cycle anchor stability); it's not obvious conditioning has the same gap. Write a memo that catalogues the five rotation axes and their cadences, so future refactors don't re-implement what's there. No code changes.

**Option B — Mini-cycle-aware template stability.** Add a single primitive: template selection becomes `f(category, miniCycleNumber)` instead of `f(category, date)`. Block 1 of 3–4 weeks uses the same VO2 template; block 2 swaps. Implementation is small — a `pickTemplateForCategory(category, miniCycleNumber)` helper that replaces the date-hash call site in `conditioningCategoryToExerciseName`. Week-to-week variety within a block comes from feel + modality (already rotating). Persona test: same category across four weeks of a block → same template; block boundary → different template. This is the smallest change that mirrors the "anchor stable within block" design philosophy.

**Option C — Full adjacent rotation system.** Build `CONDITIONING_POOLS` as a new data structure, wire it at the engine seam, expose `rotationContext` through the conditioning path, and add tests analogous to `exercisePoolsStrengthTests.ts`. Biggest architectural commitment but opens up: per-mini-cycle phase priority, cross-week template memory, athlete-preference layering, programmatic season periodization. Worth it only if you can name a concrete coaching goal that today's week-to-week variation doesn't meet.

**My vote: Option B.** Option A leaves a small real gap unfilled; Option C is scope creep ahead of a validated need. Option B is a 50-line change with a clear test story and mirrors a design philosophy you already validated on the strength side.

---

## Open questions for you

1. **Template stability vs weekly variety — coaching preference?** Option B assumes you want the athlete to get fluent on one VO2 structure for 3–4 weeks. Is that your view, or would you prefer weekly variety (keep date-hash) because that's what the athlete's body is adapting to anyway?
2. **Is mini-cycle even the right rotation unit for conditioning?** Strength uses mini-cycles because progression runs in 3–4 week loading blocks. Conditioning progression is murkier — could be weekly, could be phase-level. Worth naming explicitly.
3. **Do you want cross-week memory beyond sprint variant?** Today only `previousWeekSprintVariant` is tracked. If we go beyond Option B, we'd need a `ConditioningRotationState` of some kind. Flagging scope.
4. **Conditioning progression — does it exist?** For strength we have `loadRatio` + `applyStrengthProgression`. For conditioning, "progression" would be shorter rest / faster splits / more reps within a template. Is there an appetite to make that explicit, or is it currently left to the athlete's feel?

Picking answers to these determines whether we stop at Option A, do Option B, or go to Option C.
