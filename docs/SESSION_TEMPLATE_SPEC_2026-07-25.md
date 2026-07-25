# Session Template Redesign Spec — D13 (2026-07-25)

Read-only spec. Implements D13 (`docs/PROGRAMMING_DESIGN_SESSION_2026-07-23.md`,
line 53): the session screen becomes **one list**, every exercise carries a
**role badge**, and one collapsed **"Mobility & Prehab" flow** sits at the top.
"Trunk/core" becomes **"Midline"** in all athlete-facing copy. No code
changes are made by this document — it inventories current-state, proposes
the new model, and lists what needs Sam's ruling before a build unit starts.
**Update (2026-07-25):** all ten of the spec's original open questions have
since been ruled by Sam — see §6, which now records the rulings in place of
the original questions (one item, dormant-code rename timing, remains open).

## 1. What D13 actually says (source)

> The session is ONE list. No separate boxes for trunk/support, recovery
> add-ons, or the power block — every exercise renders in the single session
> list, each carrying a role badge/icon: power, main lift, accessory,
> midline, prehab, conditioning. One optional "Mobility & Prehab flow" sits
> at the TOP, collapsed — tap to pop it open. Includes session-appropriate
> primers (e.g. external rotations on upper days). TERMINOLOGY: "midline"
> replaces "trunk/core" everywhere — athlete-facing copy, badges, pool
> display names, docs (internal type keys may keep their ids; words the
> athlete sees say midline). Internal counting fences (power not-a-finisher
> etc.) are unchanged — this is a render/composition ruling, not an
> accounting change.

Interlocks used below: **D2** (session ordering: power → main → secondary →
accessories → finisher; one main per pattern; heavy-slot ladder), **D11**
(muscle blocks: no same-muscle stacking, "works: X" shown on the card), **D12**
(conditioning grid — modality × goal × dose).

## 2. Current-state inventory → what dies

Everything below is confirmed by reading `src/screens/home/DayWorkoutScreenV2.tsx`
(3439 lines) and its render-time collaborators: `src/screens/home/useDayWorkout.ts`,
`src/utils/sessionComponents.ts`, `src/screens/home/dayWorkoutHelpers.ts`, and the
five extracted components (`PowerPrimerSection.tsx`, `TrunkSupportSection.tsx`,
`StaleOverrideBanner.tsx`, `SessionCompleteMoment.tsx`, `SessionFeedbackPanel.tsx`).
Everything else the screen renders (`StrengthBlock`, `ConditioningPhases`,
`RecoveryBlock`, `RecoveryAddonSection`, `TeamTrainingBlock`, `ExerciseHeaderRow`,
`FinishMoment`) is defined **inline** inside `DayWorkoutScreenV2.tsx` — there
are no separate `ConditioningBlock.tsx` / `SpeedBlock.tsx` files today.

Current top-to-bottom order (`DayWorkoutScreenV2.tsx:1030-1233`):

| # | Block today | Backing data | Renders when | New model |
|---|---|---|---|---|
| 1 | Power Primer (`PowerPrimerSection.tsx:25`) | `workout.powerBlock: PowerBlock` | block truthy | **Dies as a box.** Becomes the first list item(s), badge **Power**. Section header "POWER / EXPLOSIVE PRIMER" (`:37`) and the "Pair with main lift" / "Before strength" placement tag (`:27-29`) both go — placement is now just list order (§3.1). |
| 2 | Conditioning Phases (`DayWorkoutScreenV2.tsx:1845-1886`) | `componentRows.conditioningRows` | `isConditioning` (conditioning-type day) | **Dies as a box.** Each phase becomes a flat-list row, badge **Conditioning**. On a conditioning-only day this *is* the list — **RULED (§6 item 4):** phase sequencing overrides the D2 power→main→…→finisher order on these days. |
| 3 | Recovery Block (`:1723-1783`) | `workout.exercises` (raw) | `isRecovery` (recovery-type day) | **RULED (§6 item 3):** Recovery-type days keep their own simple template — no badges, no collapsed Mobility & Prehab flow on top. |
| 4a | Strength exercise rows (`StrengthExerciseCard`, `:1591-1711`) | `componentRows.strengthRows`, grouped by `groupStrengthExercises()` | default branch (strength/combined/team-only days) | **Dies as a box** (the `<SectionLabel>Strength</SectionLabel>` header, shown only on combined/team days per `:1465-1467`, goes). Rows become flat-list items badged **Main Lift** or **Accessory** per §3.2. The **"SUPERSET"** pill (`:1499`) is kept as a small in-list pairing indicator, not a badge. |
| 4b | Combined-day conditioning options ("Choose one:", `:1529-1558`) | `workout.conditioningBlock.options[]` | `isCombinedDay` | **Dies as a box.** **RULED (§6 item 4):** becomes one Conditioning-badged flat-list row, expanding in place to reveal the choice. |
| 4c | Team Training (`:1932-1949`) | `getTeamTrainingWorkoutState(rawWorkout)` | `hasTeamTraining` — **but only reachable from inside the strength/default branch today** | **Dies as a box.** **RULED (§6 item 2):** non-badged inline banner. **Incidental finding:** today `TeamTrainingBlock` only mounts inside the default (strength) branch — if a day is *also* `isConditioning` or `isRecovery`, team training silently doesn't render at all (confirmed: `hasTeamTraining` isn't referenced anywhere else in the file). The one-list model fixes this by construction, since every applicable row renders unconditionally instead of one of three mutually-exclusive branches mounting. |
| 5 | Trunk / Support (`TrunkSupportSection.tsx:22`) | `componentRows.supportRows` = rows where `getExerciseTags(name)?.movement === 'core'` | rows non-empty | **Dies as a box** (header "Trunk / Support" retired with the rename). Rows become flat-list items badged **Midline**. |
| 6 | Optional Recovery Add-on (`:1787-1837`) | `workout.recoveryAddons: RecoveryAddonBlock[]` | array non-empty | **Splits.** Per §4, the mobility/reset-flavoured content moves into the collapsed Mobility & Prehab flow at the top; loaded/weighted addon content (carries, hamstring-light prehab, groin/adductor work) becomes ordinary flat-list rows badged **Prehab** or **Accessory**. **RULED (§6 item 6):** the flow can carry mobility + prehab for any muscle group, but any prehab Sam considers *important* must live in the session as a badged row, never only in the flow — the flow is never load-bearing. Exact category boundary is a future Sam curation session. |
| 7 | Finish button, post-session states | — | — | Unchanged — not exercise content. |

Two things the current code has that **do not exist as UI today** but are
relevant to this redesign:
- `workout.speedBlock: SpeedBlock` (`src/types/domain.ts:308-330`) is a real
  domain field with **zero render sites** in `src/screens` or `src/components`
  — "speed/sprint" workout types (`Sprint-Intervals`, `Hill-Sprints`,
  `Quality-Sprints`) render today through the generic Conditioning-Phases
  path, indistinguishable from `Tempo-Run` or `MetCon`. This spec does not
  invent a Speed badge (D13's badge list has none), so speed/sprint content
  stays under **Conditioning**.
- `SessionComponentKind` (`src/utils/sessionComponents.ts`) already has typed
  `'speed'` and `'finisher'` values used for feedback-prompt text and coach
  revision snapshotting, with no matching visual treatment — confirms the
  data model anticipated more granularity than the UI ever built.

## 3. The one-list model

### 3.1 Ordering

Per D2: **power → main → secondary → accessories → finisher**, with D2's own
worked example for the "secondary" tier — the heavy-slot ladder fills
**heavy squat pattern → heavy hinge pattern → single-leg knee-dominant →
single-leg hip-dominant → accessories** (`PROGRAMMING_DESIGN_SESSION
2026-07-23.md:274-278`) before accessories start. Applied to the flat list:

1. **Power** (if `powerBlock` present) — always first.
2. **Main Lift** — the session's first anchor-role heavy pattern (e.g. Back
   Squat on a squat day, or the squat slot on a full-body day per the
   heavy-slot ladder).
3. **Main Lift** again for any *second* anchor-role heavy pattern in the same
   session (e.g. a full-body day carrying both a squat and a hinge). D2 calls
   this second slot "secondary," but D13's badge set has no separate
   "Secondary Lift" badge — see §3.3 for why this spec proposes reusing the
   **Main Lift** badge and letting list *position* carry the "secondary"
   meaning. **RULED (§6 item 1):** confirmed — six badges total.
4. **Accessory** — `STRENGTH_POOLS` accessory-role entries, plus the
   arms/pump pool group (biceps/triceps/delts/upper-back-pump —
   `exercisePools.ts`'s own "ARMS / PUMP pools" comment block).
5. **Midline** and **Prehab** — D2's five-tier order (power/main/secondary/
   accessories/finisher) never explicitly places midline or prehab work.
   This spec proposes they sit **after Accessory, before any attached
   Conditioning finisher** — matching where `TrunkSupportSection` and
   `RecoveryAddonSection` already render today (item 5 and 6 in the table
   above). **RULED (§6 item 5):** confirmed.
6. **Conditioning** — combined-day conditioning options and any attached
   finisher-tier conditioning, last.

On a **conditioning-only day** (today's `isConditioning` branch), there is no
main/accessory strength content — the list is just a sequence of
Conditioning-badged rows in the order the conditioning phases already run
(warm-up → main effort → cool-down, whatever `componentRows.conditioningRows`
already carries). D2's power→...→finisher order doesn't apply to a day that
has no strength content. **RULED (§6 item 4):** confirmed — conditioning-only
days follow phase order, not D2's five-tier order.

### 3.2 Badge set

Exactly six badges, per D13's own list. Definitions are proposed
athlete-facing one-liners (not in D13 verbatim — Sam should edit freely) and
each has a concrete, source-grounded mapping rule so a builder doesn't have
to guess which pool/tag produces which badge:

| Badge | Athlete-facing one-liner (proposed) | Mapping rule |
|---|---|---|
| **Power** | "Fast, explosive work — jumps or throws that build power." | `workout.powerBlock` content. Unchanged from today's `PowerPrimerSection` data source. |
| **Main Lift** | "The main strength movement for this session." | `classifyPoolSlot(name)` (`exercisePoolsStrength.ts:491`) resolves to `role: 'anchor'` in any of the six pattern slots (squat/hinge/horizontal_push/vertical_push/horizontal_pull/vertical_pull). |
| **Accessory** | "Extra strength work supporting the main lifts." | `classifyPoolSlot(name)` resolves to `role: 'accessory'` in a pattern slot, OR the exercise is in the arms/pump `POOL_REGISTRY` group (`biceps`, `triceps`, `delts`, `upper_back_pump`). |
| **Midline** | "Core and anti-rotation work — your midline." | `POOL_REGISTRY.trunk_anti_rotation`, OR `getExerciseTags(name)?.movement === 'core'` — i.e. exactly the rule `TrunkSupportSection`'s `isTrunkSupportRow` already uses today (`sessionComponents.ts:329-334`), just renamed. |
| **Prehab** | "Joint-health and injury-resilience work — keeps you durable." | The remaining `POOL_REGISTRY` "PREHAB & ACCESSORIES" group per `exercisePools.ts`'s own section comment: `groin_adductors`, `calves`, `lower_prehab`, `shoulder_health`, `hamstring_light`. |
| **Conditioning** | "Running, biking, or engine work for fitness." | `componentRows.conditioningRows`, combined-day `conditioningOptions`, and any attached finisher-tier conditioning. Maps 1:1 onto the D12 conditioning grid's contents. |

Everything in `exercisePools.ts`'s own "RECOVERY pools" comment group
(`tissue_quality`, `mobility`, `easy_cardio`, `breathing_reset`) is
deliberately **not** given a flat-list badge — that group is the natural
source for the collapsed Mobility & Prehab flow content (§4), not ordinary
badged rows. This 3-way split (Accessory / Prehab / Mobility-flow) mirrors
`exercisePools.ts`'s own three section comments ("ARMS / PUMP", "PREHAB &
ACCESSORIES", "RECOVERY") almost exactly — a strong signal this was the
intended boundary. **RULED (§6 item 6):** the flow may carry mobility and
prehab content for any muscle group, not just the RECOVERY-pool group
guessed here — but *important* prehab must still live in the session as a
badged row, never only inside the flow, since the flow is never load-bearing
and the app assumes athletes will sometimes skip it. The exact per-session
category boundary (this section's guess vs. Sam's real intent) is deferred
to a future Sam curation session, same as the Recovery-Addon split above.

### 3.3 Reconciling D2's "secondary" tier with six badges

D2 names five order-tiers (power/main/secondary/accessories/finisher); D13
names six badges (power/main lift/accessory/midline/prehab/conditioning) with
no "secondary lift" badge. This spec resolves the mismatch by treating
**"secondary" as a list-position, not a badge** — a second anchor-role heavy
lift still shows the **Main Lift** badge, just later in the list, after the
first Main Lift's accessories would otherwise start. This is the simplest
reading that keeps D13's badge count exact. **RULED (§6 item 1):** confirmed
— six badges total, no separate "Secondary Lift" badge.

## 4. Collapsed Mobility & Prehab flow

### 4.1 Contents per session type

`MOBILITY_FLOW_TEMPLATES` (`src/data/mobilityFlowTemplates.ts:84-349`) already
exists as a catalog of 10 templates with `focusTags` and `phaseSuitability`
that map cleanly onto session type — today they're only ever flattened into
anonymous rows inside the Recovery Add-on card (`recoveryAddonBuilder.ts:581-593`,
confirmed by direct code-comment at `DayWorkoutScreenV2.tsx:355-360`: flow
rendering was explicitly deferred as "a POSSIBLE FUTURE BUILD, not now"
because "a suggestion naming a MOBILITY_FLOW_TEMPLATES entry has nowhere to
land"). This spec proposes the collapsed flow is where they finally land,
selected by session type:

| Session type | Mobility template(s) | Primer (session-appropriate low-load activation) |
|---|---|---|
| Upper-body strength day | `t-spine-shoulder-reset` | **Banded External Rotation** (`SHOULDER_HEALTH_POOL`) — the exact example D13 names. |
| Lower-body strength day (squat-dominant) | `lower-body-reset` | **Spanish Squat Hold** or **Banded TKE** (`LOWER_PREHAB_POOL`, knee activation) |
| Lower-body strength day (hinge-dominant) | `hamstring-hip-hinge-reset` | **Bosch Hold** (`LOWER_PREHAB_POOL`, hamstring/calf activation) |
| Full-body / combined day | `pre-training-movement-prep` (built for exactly this: `focusTags: ['full_body','hips','calves_ankles','shoulders_t_spine']`, `phaseSuitability: ALL_PHASES_PLUS_GAME_WEEK`) | Both upper and lower primers above, or whichever pattern is heavier that day |
| Conditioning-only day | **RULED (§6 item 8): no flow at all on conditioning-only days for v1.** | — |
| Recovery day | **RULED (§6 item 3): no flow — Recovery-type days keep their own simple template.** | — |
| Game week / G-1 | `game-week-light-mobility` (already scoped for exactly this: `phaseSuitability: ['In-season','Deload','Game week']`) overrides the above regardless of session type | None |
| Post-training downshift context | `post-training-downshift` — available if the flow is ever also offered at session-end, not just top-of-session (out of scope for D13's "sits at the TOP" wording, noted for completeness) | — |

Selection logic proposed: match the session's dominant movement pattern (from
`componentRows`) against each template's `focusTags`, filtered by
`phaseSuitability` for the current season phase, with the game-week template
overriding when the athlete is in a game week regardless of pattern match.

**RULED (§6 items 6-7):** this table and its selection logic are a v1
placeholder only, built from the existing `MOBILITY_FLOW_TEMPLATES` catalog
so the collapsed-flow mechanism has something to render. They ship as-is for
v1, but the real per-session-type flow menus (which mobility + which prehab,
per session type) are **not finalised here** — that's a future Sam curation
session, the same way he curated the exercise vocabulary and the conditioning
grid. Sam's own example of the shape he wants: an upper-push day's flow
might carry dead hangs, a pec stretch, external rotations, and scap
pull-ups — richer and more specific than this table's `t-spine-shoulder-reset`
+ Banded External Rotation placeholder. Treat every row in the table above as
provisional pending that session, not as locked content.

### 4.2 Tap-to-expand behaviour

- **Collapsed by default.** Compact header row at the top of the list, above
  the Power badge item, showing a summary (proposed: `"Mobility & Prehab ·
  {movement count} movements · ~{durationMinutes} min"`, reusing
  `MobilityFlowTemplate.durationMinutes` which already exists but is
  currently discarded on the flatten-to-rows path).
- **Tap expands in place** — reveals the full movement list (name +
  prescription, same row shape as other exercises today) plus the primer,
  without navigating away from the session screen.
- **Tap again collapses** it back (or a persistent chevron/disclosure
  affordance — exact interaction pattern not specified here, implementer's
  call within standard app conventions).

### 4.3 Completion & logging interaction

Per the task's explicit instruction and consistent with D13's own note that
"internal counting fences... are unchanged — this is a render/composition
ruling, not an accounting change":

- The flow is **optional** — an athlete can finish the session having never
  opened it.
- Completing it is **never counted as session work**: it must not appear in
  `SessionComponentKind` (`sessionComponents.ts`), must not feed
  `getSessionComponentRows`, must not gate or contribute to the "Finish
  Session" action, and must not appear in `SessionFeedbackPanel`'s
  post-session questions (the existing `"Did you complete the {x} work?"`
  pattern at `sessionComponents.ts:531` should **not** grow a mobility
  variant).
- **RULED (§6 item 9):** the flow gets a soft, purely cosmetic checkmark for
  the athlete's own sense of having done it — never logged, never persisted
  beyond the session view, never synced, never gating Finish Session.

## 5. Trunk/Core → Midline rename inventory

Full grep-and-trace pass across `src/` (excluding tests). Classification:
does the string reach the athlete as literal rendered text?

**Important exclusion, confirmed and NOT part of this rename:** `SessionTier
= 'core' | 'optional' | 'recovery'` (`src/types/domain.ts:138`) is a
same-spelling homonym meaning "required/primary session" — unrelated to the
body-region "core." It drives `SessionTierBadge.tsx:14`'s rendered **"CORE"**
label and `HomeScreenV2.tsx`'s day-row accent colour key. This must **not**
be touched by the Midline rename. **RULED (§6 item 10):** confirmed excluded
— flagged explicitly here so a future implementer doesn't sweep it in by a
naive string search.

### 5.1 Athlete-facing (confirmed — renders as literal text)

| String | File:line | Context |
|---|---|---|
| `"Trunk / Support"` | `src/components/TrunkSupportSection.tsx:26` | Section header (dies with the box per §2, but the word itself needs replacing wherever the badge/label survives) |
| `'trunk/support work'` | `src/utils/sessionComponents.ts:457` | `SessionComponent.label` |
| `'Did you complete the trunk/support work?'` | `src/utils/sessionComponents.ts:531` | Post-session feedback question (`SessionFeedbackPanel.tsx:636`) |
| `'the trunk/support work'` | `src/utils/sessionComponents.ts:544` | Feedback "reason" sentence subject |
| `'Core'` (`AddExerciseKind`) | `src/screens/home/DayWorkoutScreenV2.tsx:118,194,342` | Tappable "Add exercise" sheet option label; also the suggestion-table key for Pallof Press/Dead Bug |
| `'Opposite arm and leg. Keep core tight.'` | `src/data/exercisePools.ts:210` | Dead Bug exercise notes, rendered on the card |
| `'Front shin vertical, trunk tall.'` | `src/data/exerciseCues.ts:82` | Lunge-pattern family-fallback cue |
| `'Brace through the trunk.'` | `src/data/exerciseCues.ts:90` | Core-pattern family-fallback cue |
| `'Tall trunk, no arching.'` | `src/data/exerciseCues.ts:310` | Couch Stretch secondary cue |
| `'Stay tall through the trunk.'` | `src/data/exerciseCues.ts:422` | Front Squat secondary cue |
| `'Brace hard through the trunk.'` | `src/data/exerciseCues.ts:680` | Single-Arm DB Bench Press secondary cue |
| `'Long stride, trunk upright.'` | `src/data/exerciseCues.ts:783` | Walking Lunges primary cue |
| `'Drive with the trunk, arms guide.'` | `src/data/exerciseCues.ts:791` | Woodchop (Half Kneeling) primary cue |
| `'Brace the trunk, press from the floor.'` | `src/data/exerciseCues.ts:810` | Single-Arm DB Floor Press primary cue |
| *(precedent)* `'Stay tight through midline.'` | `src/data/exerciseCues.ts:804` | Z-Press secondary cue — **already uses "midline"**, useful precedent for voice/tone |
| `'Band at chest height. Anti-rotation trunk work.'` | `src/utils/blockAdjuster.ts:206` | Band Pallof Press note, inserted by the game-day rescheduler |
| `'Squat-focused lower session to build strength through the quads and trunk under controlled intensity.'` | `src/utils/sessionExplanation.ts:250` | Session "why" explainer text (Coach screen) |
| `'Trunk + anti-rotation'`, `'Trunk'` (×7) | `src/utils/constraintPlan.ts:261,269,277,285,292,299,306,316` | `buildSubstituteLabels()` → coach-chat "Sub in: {...}" sentences |
| `'Trunk'` (×8, `safeFocus`) | `src/utils/exposureEngine.ts:508,537,560,586,607,629,653,682` | Injury "Keep {...}" coach-chat sentences, one per body region |
| `'Unaffected core work'` (×2) | `src/utils/guidedInjuryControl.ts:184,185` | Same keep-line path |
| `'Lower-body, bike or core work stayed in where safe.'` / `'Upper-body, bike or core work stayed in where safe.'` | `src/utils/activeProgramModifiers.ts:359,361` | Home-screen coach-note card body |
| `'Core'` label + `` `Added ${customActivity}` `` → **"Added Core"** | `src/utils/coachCommandRouter.ts:2408`; `src/utils/coachCommandExecutor.ts:2410,2591,2613,1641` | Coach-chat "add conditioning" reply when athlete types e.g. "add some core work"; also recorded in mutation history |
| `'Small-muscle armour: groin, rotator cuff, trunk.'` | `src/utils/coachRevisionTemplates.ts:199-200` | Becomes visible exercise-row `notes` and `Workout.description` |
| `name: 'Low Back Friendly Trunk Reset'` | `src/data/mobilityFlowTemplates.ts:213` | Mobility flow template display name — **currently unwired to any screen** (see §5.2); becomes directly athlete-facing the moment §4 ships, since flow headers will render template names |

### 5.2 Ambiguous — flag for whoever executes the rename

- **`REGISTRY_GROUP_LABELS.trunk_anti_rotation = 'Core / trunk'`**
  (`src/data/selectableExerciseVocabulary.ts:245`) — traced to
  `generateProgram.ts:1744-1745`: only used inside the **generation LLM
  prompt**, not rendered to the athlete directly. The model could echo it
  back in generated content, so this is worth renaming for consistency even
  though it isn't a confirmed live UI string.
- **`MobilityFlowTemplate.name`/`.caution`/`.avoidWhen`**
  (`mobilityFlowTemplates.ts:213,233` and siblings) — no current consumer
  outside the data file and tests; `recoveryAddonBuilder.ts` only reads
  `.movements`. These become directly athlete-facing the moment §4 ships
  (flow header = template name), so they're in scope for this rename
  regardless of today's wiring state.
- **`recoveryAddonCoverage.ts` focus-area/rule copy** (`:158,164-165,244,253,
  262,273,393,676` — `'Trunk/Core'` label, `'Keep trunk work controlled...'`,
  `'G-1 trunk is breathing, McGill-style...'`, etc.) — `label: 'Trunk/Core'`
  is confirmed athlete-facing (today's Recovery Add-on eyebrow text, item 6
  in §2's table); the rule-description strings' exact UI consumer wasn't
  fully traced. Treat all of them as in-scope since the eyebrow label alone
  confirms this file's copy reaches the screen.
- **`src/utils/trainAroundEngine.ts`** — ~21 literal `'Trunk'` occurrences in
  `safeTrainingFocus` arrays, structurally identical to the confirmed
  `exposureEngine.ts` pattern, but the file is **not imported anywhere in
  `src/` outside its own tests** — a dormant parallel implementation. Rename
  now for consistency (cheap) or wait until it's wired up — **still open,
  see §6 "Still open."** Not among the ten questions Sam ruled on.

### 5.3 Internal-only (not renamed)

Not itemised line-by-line here (687 non-test hits total; full grep dump
available on request) — summarised for completeness:

- `SessionTier`/`SessionTierBadge` **"core"/"CORE"** homonym — explicitly
  excluded (§5, above).
- `ExerciseCategory` pool key `'trunk_anti_rotation'` (`exercisePools.ts`,
  `sessionBuilder.ts`, `recoveryAddonCoverage.ts`) — internal id, D13 permits
  keeping it.
- `MovementPattern`/`Region` enum value `'core'` (`exerciseTags.ts`) — filter/
  scoring pipeline only, never displayed.
- `RecoveryAddonKind`/`RecoveryAddonFocusArea` values `'trunk'`/`'trunk_core'`
  (`domain.ts`, `recoveryAddonBuilder.ts`, `recoveryAddonCoverage.ts`) —
  internal classification keys.
- `MobilityFlowFocusTag = 'lower_back_trunk'` — internal filter tag.
- Design/authoring comments (`exerciseCues.ts:46-70` Family Rules table,
  `coachingEngine.ts` section-header comments) — not rendered.
- Dev-only tooling (`ScheduleDebugPanel.tsx`, `smokeCoachBikeFlowProgram.ts`)
  — `__DEV__`-gated, never ships.

### 5.4 Build-process note

`docs/CUE_CHANGESET_2026-07-23.md` is the **authored source of truth** for
`src/data/exerciseCues.ts` (per that file's own header comment); a build test
(`authoredCueLibraryTests.ts`) fails if they diverge. Any cue-text rename
from §5.1 must land in that doc first, then mirror into `exerciseCues.ts`, or
the gate breaks.

## 6. Sam's rulings (D13 addendum, 2026-07-25)

All ten open questions from this spec's first draft were ruled by Sam in one
pass, recorded verbatim in `docs/PROGRAMMING_DESIGN_SESSION_2026-07-23.md` as
"D13 addendum — the ten template rulings." Numbering below matches the
original open-question numbering so every `§6 item N` cross-reference
elsewhere in this document still resolves to the right ruling.

1. **Secondary-lift badge — RULED.** Six badges total, confirmed. A second
   anchor-role heavy lift in the same session reuses the **Main Lift** badge;
   "secondary" is a list position, never its own badge.
2. **Team Training's badge — RULED.** Non-badged inline banner. It still
   renders at its ordering position in the flat list, but carries no role
   badge — it isn't athlete-prescribed work the same way the six badged
   categories are.
3. **Recovery-type (whole) sessions — RULED.** Recovery-type days keep their
   own simple template: no badges, and no collapsed Mobility & Prehab flow on
   top (a whole recovery day would make the flow redundant).
4. **Combined-day conditioning picker + conditioning-only ordering — RULED.**
   The "choose one of N" picker becomes one **Conditioning**-badged list row
   that expands in place to reveal the choice — no separate box, no carve-out
   from "one list." Conditioning-only days follow their own phase order
   (warm-up → main effort → cool-down, whatever the conditioning content
   already carries), not D2's power→main→…→finisher order — confirming
   §3.1's assumption.
5. **Midline/Prehab placement — RULED.** Confirmed: after Accessory, before
   any finisher conditioning, exactly as §3.1 item 5 proposed.
6. **The Accessory/Prehab/Mobility-flow split — RULED, with an important
   principle attached.** The collapsed flow can carry mobility AND prehab
   work for **any** muscle group — it isn't restricted to the RECOVERY-pool
   group this spec guessed at. But **any prehab Sam considers important must
   live in the session itself as an ordinary badged row (Prehab or Midline),
   never only inside the flow** — the product assumes athletes will
   sometimes skip the flow entirely, so **the flow is never load-bearing**.
   The exact per-session-type flow menus are **not finalised by this spec**
   — that's a **future Sam curation session**, the same way he curated the
   exercise vocabulary and the conditioning grid. Sam's own example of the
   shape he wants: an upper-push day's flow might carry dead hangs, a pec
   stretch, external rotations, and scap pull-ups. §4.1's table is a v1
   placeholder only, shipping now so the collapsed-flow mechanism has
   something to render — explicitly provisional and superseded whenever that
   curation session happens.
7. **Mobility-flow selection logic — RULED.** Ship §4.1's v1 mapping now;
   Sam curates the real per-session-type menus later (same ruling as item 6
   above — the original questions split this across two numbers).
8. **Conditioning-day primer — RULED.** No flow at all on conditioning-only
   days for v1 — consistent with item 3's "no flow" ruling for Recovery days,
   and resolving the duplication concern by removing the primer rather than
   cross-checking it against the Bible's conditioning sections.
9. **Local completion affordance — RULED.** A soft, purely cosmetic
   checkmark. Never logged, never persisted beyond the session view, never
   gates Finish Session, never appears in `SessionComponentKind` or
   `SessionFeedbackPanel`.
10. **`SessionTier` "CORE" homonym — RULED.** Confirmed excluded from the
    Midline rename, exactly as §5 assumed.

### Still open

11. **Dormant code in the rename scope** (§5.2): whether to rename
    `trainAroundEngine.ts`'s ~21 `'Trunk'` literals now (cheap, keeps it
    consistent if the file is ever wired back in) or leave it untouched since
    it's dead code today. Not one of the ten questions above — still needs a
    call before a rename unit executes.

## NOT COVERED

- **No code changes.** This is a read-only spec; `DayWorkoutScreenV2.tsx`,
  `sessionComponents.ts`, `exercisePools.ts`, `exerciseCues.ts`,
  `mobilityFlowTemplates.ts`, and every other file cited above are unmodified.
- **Visual/interaction design** (colours, spacing, exact badge iconography,
  animation for expand/collapse) — out of scope; this spec defines the data
  model and content mapping, not the pixel-level UI.
- **The D12 conditioning grid's own internal curation** (which dose variants
  go in the Conditioning badge's content) — already specced separately in
  `docs/CONDITIONING_GRID_REVIEW_2026-07-25.md`; not re-derived here.
- **The D11 muscle-block "works: glutes, outer hip" card text and no-same-
  muscle-stacking enforcement** — referenced as an interlock but not specced
  here; it's its own Phase 4.3 unit per D11's own text.
- **The future Mobility & Prehab flow curation session** (§6 item 6/7): the
  real per-session-type flow menus (Sam's own example: upper-push = dead
  hangs, pec stretch, external rotations, scap pull-ups) are ruled to be a
  separate curation pass, not derived here. §4.1's table ships as a v1
  placeholder only.
- **Bible cross-check for the conditioning-day mobility primer** (open
  question §8) — not checked against `LFA_PROGRAMMING_BIBLE.md`'s
  conditioning sections in this pass.
- **Full 687-hit raw grep dump** for the trunk/core inventory — summarised in
  §5.3 rather than reproduced line-by-line; available on request if a
  builder needs the exhaustive list before executing the rename.
- **Device/UI verification** — read-only spec generation; no app screens
  were touched, so there is nothing to device-test here.
