# One projection to the glass

**STATUS: REASSESSMENT FOR REVIEW. NO CODE WRITTEN.** The end state is RULED by
Sam and is not in scope for debate. This document decides HOW, names every site
that must change, and states what the walker must assert so that his device is
never again the instrument that finds a surface disagreement.

## Sam's ruling, restated so the rest of this document can be checked against it

1. There is **ONE** projection of the athlete's week. Every surface with pixels
   renders from it and is forbidden to compose, infer, name, merge or re-derive
   anything. A day that can be described two ways is a defect by construction.
2. **Recovery is a day type like any other** — real session, real exercises. REST
   is complete rest. No recovery special-casing in composition, rendering or
   menus. Same projection, same menu capabilities, same rules.
3. Athlete-facing vocabulary comes from the **authored/signed copy layer only**.
   Internal names must be structurally unable to reach a card.

## The evidence, and what it already proves

`device-export-2026-07-29-render-split.json` (revision 11, 3 overlays, 3 removal
constraints) plus the two prior exports. Every door in the tape reported
**accepted**:

```
plan_change_add_category_accepted        2026-08-13   appliedDates ["2026-08-13"]
program_control_move_session_accepted    2026-08-04 -> 2026-08-08
plan_change_move_session_accepted        appliedDates ["2026-08-04","2026-08-08"]
```

No refusals, no rollbacks, no mismatches. **The domain agreed with itself every
time.** Every one of the four defects is therefore downstream of accepted state,
which is why this is an architecture problem and not four bugs.

## The seven questions

### 1. What is the current source of truth?

For accepted state: `rebaseAcceptedEffectiveWeek` — one owner, and it is fine.

For **what the athlete sees: there is no single source of truth.** There are at
least four independent projections of the same day, each with its own
composition:

| surface | what it resolves through | who names the day |
|---|---|---|
| week card | `useScheduleState` → `resolveWeekWithConditioning` → `_resolveDateRaw` | `workout.name` as composed by the resolver/generator |
| day detail (title + content) | `useResolvedDay` → `resolveDate`, then `useDayWorkout` re-derives sections, conditioning identity and rows | `useDayWorkout`, from `workout.name` + `projectConditioningVisibleIdentity` + `getSessionComponentRows` |
| day menu | `listPlanChangeOptionsForDay` → `snapshotProjectedDay` → `section.kind` | not named; capability derived from `sections` |
| coach snapshot | `buildProgramTabProjectedWeek` (+ `summariseDay` for the LLM) | `summariseDay` |

`buildProgramTabProjectedWeek` — the thing named "the projected week" — is used by
`coachTurnController`, `coachUndoEngine`, `coachRevisionProposal`,
`coachModalitySwapOrchestrator`, `programEditWriteGuard` and `useSchedule`'s week
helper. **No pixel-bearing screen imports it.** The screens use
`useResolvedDay` / `useScheduleState`. So the surface named "projection" is the
one the athlete never sees, and the surfaces he does see each build their own.

That is defect 1 exactly: card "Recovery + Recovery Session", title "Recovery
Session + Full Body Strength", content recovery-only. Three surfaces, three
composition sites, three answers — and none of them is wrong about the state they
were each given.

### 2. How many representations of the athlete's week exist?

**Four projections and three naming authorities**, for one accepted week:

- `resolveWeekWithConditioning` / `_resolveDateRaw` — precedence + conditioning
  attachment + game-proximity filler (`sessionResolver.ts`, ~1800 lines).
- `buildProgramTabProjectedWeek` — a second precedence pass with overlay/override
  contexts (`visibleProgramReadModel.ts`).
- `snapshotProjectedDay` → `CoachVisibleDaySnapshot` — a THIRD shape, sections
  and items, which the menu and the split/reduce owners treat as truth.
- `useDayWorkout` — a fourth, which re-derives conditioning identity, option
  titles and row grouping at render time.

Naming: `resolveSessionDisplayName` (content-derived), `getTeamTrainingWorkoutState().displayName`
(team-only override), and free-text `workout.name` inherited from the generator's
`allocation.focus`. Plus `splitSessionName`, which PARSES a composed name back
apart — a parser existing at all is proof the name is being used as a data
channel between layers.

### 3. Where can it be reinterpreted?

Every boundary above. Named concretely, because the deletion list depends on it:

**a. The generator writes athlete-facing prose into an internal field.**
`coachingEngine.ts:1262` and `:6500`: `allocation.focus += ' + easy off-feet
aerobic conditioning component'`; `:4630-4655` compose `'VO2 conditioning
component (bike/rower hard repeat efforts, 20-30min)'` and similar. Then
`resolveSessionDisplayName`'s precedence rule 7 is "cleaned name/focus
pass-through". **That is defect 3: the card rendered "Aerobic conditioning
component (25m…)" to an athlete because the naming owner's last resort is the
planner's own scratch text.** There is no signed copy layer between them; there
is a `fallbackFromText` that tidies punctuation.

**b. `useDayWorkout` re-derives content at render.** `projectConditioningVisibleIdentity`
+ `getSessionComponentRows` + `conditioningIdentity?.attachedLabel ?? opt.title`
(`useDayWorkout.ts:435,449`) decide what the detail screen shows. This is defect
2's mechanism: the intervals were added as a real component, and the detail
screen's own grouping folded them INSIDE the recovery template because its
grouping rule is not the composition rule.

**c. The card renders a raw name.** `HomeScreenV2.tsx:2449` — `· ${day.workout.name}`
— and `:1422` builds an accessibility label the same way. Whatever any upstream
layer put in `name`, the athlete reads.

**d. The menu derives capability from `section.kind`.**
`visibleSessionKindsForWorkout` (`planChangeProducer.ts:216-222`) is
`workout.sections.map(s => s.kind)`. Capability then follows from that set, and
`hasSession = snap.workout !== null`. A recovery day whose content is
resolver-owned derived filler has no composed placeholder — established in the
occupied-day add unit — so it presents as *not a session*, and the menu collapses
to add-only. **That is defect 4, and it is not a menu bug: the menu is correctly
reporting a projection that does not consider a recovery day to be a day.**

**e. `splitSessionName` reinterprets a name as structure.** Already caused one
shipped defect this branch (a gym session arriving at its destination called "Team
Training"). It exists only because names carry data.

### 4. Which layer should own the decision?

**One projection function, one type, at the boundary between accepted state and
every surface.** Nothing below it renders; nothing above it composes.

```
VisibleWeek = project(accepted state, facts, decisions, results, today)

VisibleDay {
  date
  kind: 'training' | 'rest' | 'game'        // REST is complete rest; recovery is training
  headline: SignedCopy                       // from the copy layer, never free text
  parts: VisiblePart[]                       // ordered, each already named + described
  capabilities: DayCapabilities              // edit/swap/move/remove/add, per part and whole
  provenance                                 // who owns this day (athlete / fact / plan)
}

VisiblePart {
  id; kind; headline: SignedCopy; detail: SignedCopy
  rows: VisibleRow[]                         // exercises, already resolved and ordered
  capabilities: PartCapabilities
}
```

Three properties do the work, and each kills a defect class by construction:

- **`headline`/`detail` are `SignedCopy`, not `string`.** A branded type whose only
  constructor is the authored copy layer. `allocation.focus` cannot be assigned to
  it, so defect 3 stops compiling rather than stopping being reported. This is the
  exercise-name-literal-lock pattern already proven in this repo.
- **`parts` is the ONLY plural.** No surface may merge, split, re-title or
  re-group. The card renders `headline` + `parts.map(p => p.headline)`; the detail
  renders the same `parts` with rows. Defects 1 and 2 become unrepresentable —
  there is one list, and two surfaces reading one list cannot disagree.
- **`capabilities` is computed once, in the projection.** The menu renders it. It
  cannot ask "is this a session?" because that question is answered before it gets
  there. Defect 4 goes with it.

### 5. What simpler architecture removes representations instead of adding guards?

The whole value is in DELETIONS. This is not a new layer on top of four old ones —
four collapse into one:

**Retired, not wrapped:**

1. `buildProgramTabProjectedWeek` — becomes the one projection (renamed to say so)
   or is deleted in favour of it. It is closest to correct and has no pixel
   callers to break.
2. `resolveWeekWithConditioning` / `resolveDate` / `resolveDateWithConditioning`
   as **screen-facing** entry points. They stay as internals of the one projection
   if still needed; `useResolvedDay` and `useScheduleState` stop being how a
   screen gets a day.
3. `useDayWorkout`'s composition half — conditioning identity projection, option
   titling, row grouping, `attachedLabel` fallbacks. The projection ships `rows`
   already. The hook keeps input handling (weights, receipts, keyboard) and loses
   its opinions.
4. `HomeScreenV2`'s `day.workout.name` reads — replaced by `day.headline` /
   `parts[].headline`.
5. `splitSessionName` — **deleted outright.** With `parts` there is no composed
   name to parse. Its existence is the proof of the defect.
6. `getTeamTrainingWorkoutState().displayName` as a naming authority — the anchor
   becomes a `VisiblePart`, so "Team Training" is a part with a signed headline,
   not a display-name override that has to beat other names.
7. `resolveSessionDisplayName`'s text-inference chain (rules 5, 6, 7 — focus
   inference, name inference, cleaned pass-through). Typed intent + rows already
   determine the part; those three rules exist only to rescue free text.
8. `visibleSessionKindsForWorkout` and `hasSession` in the menu — replaced by
   `day.capabilities`.
9. `snapshotProjectedDay` as a THIRD shape — the split/reduce owners take
   `VisibleDay`/`VisiblePart` directly. (This one has the widest blast radius; see
   Risk.)

**Every recovery special-case, to be removed:** 69 `isRecoveryWorkout` /
`isRecovery` call sites outside tests, ~80 in the render path alone
(`visibleProgramReadModel`, `sessionResolver`, `sessionComponents`,
`useDayWorkout`, `HomeScreenV2`, `DayWorkoutScreenV2`). Named specifically:

- `getSessionComponents`: `if (components.length === 0 && isRecoveryWorkout(workout))`
  — recovery is a *fallback* when nothing else matched, i.e. explicitly not a
  first-class kind. Becomes a part like any other.
- `hasRecoveryAddon` / `recovery_addon` as an `optional_no_penalty` component —
  recovery work modelled as an add-on to something else.
- `categoryAddsSessionKind`: `if (addedKind === 'recovery') return false` in
  `addOnTopCategories` — recovery cannot be added on top, by rule.
- Game-proximity filler recovery (`derived-recovery-<date>`,
  `isResolverOwnedDerivedSession`) — regenerated every render, which is why a
  recovery day has no composed placeholder and therefore no menu. Under the ruling
  a recovery day is a real projected day with real parts.
- `reduceAcceptedSessionForAthleteRemoval`'s `recovery_component` scope and the
  `survivorWorkoutType` ladder that ends `: 'Recovery'`.

**REST becomes a distinct `kind`,** not "a day whose workout is null" — which is
what currently makes "no session" and "rest" indistinguishable, and is the same
conflation that produced the deletion-door-writing-a-rest-mark defect.

### 6. Which legacy paths should be bypassed rather than patched?

All nine above. The specific temptations to refuse:

- Teaching the card to compose the same string as the title. That is a fifth
  composition site and the defect's own logic.
- A "display name reconciler" that makes the three naming authorities agree. Three
  authorities plus a referee is four.
- Special-casing recovery in the projection "for now". The ruling is that it is a
  day type; a projection with a recovery branch has not implemented the ruling.
- Keeping `snapshotProjectedDay` as an adapter. An adapter between the projection
  and its consumers is a second shape wearing a helpful name.

### 7. What tests prove the new ownership boundary?

**The walker law, and it is the point of the unit.** After EVERY action, for every
day in the visible horizon, the walker asserts that the four surfaces are the same
projection:

- **L-P1 one story.** `card(day)`, `menu(day)`, `title(day)`, `content(day)` are
  each derived from `VisibleDay` and must be *equal to it*, not merely consistent
  with each other: the assertion is `surface === projection`, so a surface cannot
  drift by agreeing with another surface that also drifted.
- **L-P2 no surface composes.** Every athlete-visible string is `SignedCopy`. A
  build-time ban (the exercise-name-literal-lock pattern) plus a runtime assertion
  that no rendered string is absent from the copy registry. Defect 3 becomes a
  failed build.
- **L-P3 parts conservation.** `card.parts.length === detail.parts.length ===
  projection.parts.length`, same ids, same order. Defects 1 and 2 are one
  assertion.
- **L-P4 capability parity.** `menu(day).capabilities === projection(day).capabilities`,
  and — the recovery ruling as a law — **for any two days with the same `parts`
  shape, the capabilities are identical regardless of part kind.** Defect 4 reds
  the moment a recovery day is offered less than a strength day.
- **L-P5 rest is not emptiness.** `kind: 'rest'` and "no parts" are distinguished;
  an empty training day is not a rest day.

Plus the athlete-door matrix gaining a **surface axis** (card × menu × title ×
content) on its existing door × day-state × route cells, and the three tape
scenarios as named conformance cells.

**Why this catches the NEXT one (L12):** the current suites all assert domain
outcomes — did the door accept, did accepted state change. Every defect in this
unit passed all of them. The projection identity assertion is the first law whose
subject is the *glass*, and it is stated as `surface === projection` rather than
`surface_a === surface_b`, so it does not depend on anyone having thought of the
specific pair that disagrees. A fifth surface added later inherits the law by
being a surface.

## Convergence

Strongly toward, and this is the north star's own sentence finally reaching the
screen: `visibleWeek = derive(...)`, with the derivation having exactly one
consumer-facing shape. It stores nothing new. It deletes four representations, one
name-parsing channel, three naming authorities and ~69 recovery branches. After
it, "the card and the detail disagree" is not a bug that can be written.

## Risk, stated plainly

This is the largest single unit in the plan. Honest costs:

- `sessionResolver.ts` (~1800 lines) and `HomeScreenV2`/`DayWorkoutScreenV2`
  (~7000 lines together) are all touched.
- `snapshotProjectedDay` is consumed by the coach revision, split/reduce, and
  write-guard owners. Retiring the third shape reaches beyond rendering.
- Recovery is currently load-bearing as a *fallback* in `getSessionComponents`;
  making it first-class changes what every consumer of components sees, including
  §18 counting. **The contract must be re-verified, not assumed** — this is the
  de-duplication-un-gates-the-gate hazard in AGENTS.md.
- 69 call sites means a staged retirement, and every stage must keep
  `test:bible` green.

**Recommended staging** (each stage green, no stage leaving two projections live
on one surface):

1. Define the types + copy layer. No behaviour. Prove `SignedCopy` cannot accept
   `allocation.focus`.
2. Build `project()` over accepted state, asserted equal to today's
   `buildProgramTabProjectedWeek` for every matrix cell — so the new owner is
   proven to change nothing before anything renders from it.
3. Walker gains L-P1/L-P3 against the CURRENT surfaces. **This is where the three
   tape defects go red on today's code** — the red cells Sam is owed, before any
   surface changes.
4. Move surfaces onto it one at a time — menu, card, title, content — each
   turning its own defect green.
5. Recovery as a day type; REST as a kind. Re-verify §18 counting explicitly.
6. Delete the nine retired paths; L-P2/L-P4/L-P5 armed.

## What this reassessment does NOT settle, and needs Sam

1. **Does the coach snapshot render from the same projection, or from a
   coach-specific view of it?** It has no pixels but it does have a voice, and
   `summariseDay` is a fifth composition today.
2. **Is `SignedCopy` per-part-kind templated, or one authored string per
   (kind, variant)?** Affects how much authoring Sam owes before stage 4.
3. **Recovery as a day type changes §18 counting** — a recovery day that is a real
   session with real exercises may now count where filler did not. That is a
   Bible question, not a rendering one.

Nothing is built. `test:bible` is EXIT=0 and untouched by this document.
