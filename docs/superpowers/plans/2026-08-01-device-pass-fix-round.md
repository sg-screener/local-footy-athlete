# Device-pass fix round — 2026-08-01

Branch `fix/g1-ownership-and-move-scoping`, base `c893b3a`, bible EXIT=0
verified at base. Merge gate unchanged: these fixes green, then Sam re-runs
the FULL combined checklist in one session.

Input: Sam's combined device pass — 7/11, three fails in ONE CLASS
(projection part/day naming lagging the session-type charter), one separate
ack bug. Tape: `device-export-2026-08-01-combined-pass.json` (world only —
the export was taken at launch; it carries no tap events).

## The class, stated once

Every fail is the same shape: **the projection's naming layer is typed and
signed, but the PRODUCERS below it never ship the typed fact the label needs**
— so the label falls back (generic "Strength", "Game Day") or renders a
deleted type's word ("Recovery"). The class fix is always: the producer ships
the typed field; the projection reads it; a walker law enumerates the surface
coordinates so the next variant reds before a phone sees it (L11/L12).

## Phase A — laws + red cells (before any fix; L11)

New walker naming laws in `athleteActionWalkerTests.ts`, asserted from
`project()`'s SignedCopy text (branded strings, directly comparable):

- **L-P5 FIXTURE VARIANT**: in a walked world whose profile is Pre-season,
  a `game`-kind day's headline reads "Practice Match"; in-season it reads
  "Game Day". Cell: Sam's tape world by acting (pre-season profile, generate,
  mark Saturday `game`). RED today (stub ships `workoutType: 'Game'`, no
  variant).
- **L-P6 CHARTER TYPE NAMES ITSELF**: a part whose workout carries typed
  `composedOptionalKind` headlines the charter word (Gunshow / Accessories /
  Mobility), never generic "Strength"/"Recovery". Cells: athlete adds
  gunshow / prehab / mobility through the real door; the G-1 derived gunshow.
  RED today (no typed marker survives to the Workout).
- **L-P7 DELETED VOCABULARY**: no projected day/part headline renders
  "Recovery" (charter-deleted type) over content the athlete cannot reach
  through any door. Exact scope set by the producer census (agent B).
- **Schedule-door depth cell**: extend `walkTheScheduleDoors` with the tape's
  accumulated world (pre-existing week-scoped busy fact via the state-reacher,
  marked game, removal constraint, advanced time), then the REAL executor tap.
  Asserts L1 NO CRASH + honest ack + conservation at depth. Plus the
  glass-half: source contract that `HomeScreenV2`'s short-on-time onPress
  cannot lose the ack (exact shape after the red cell tells us where it
  breaks).

## Phase B — fixes

1. **Practice-match producer** (`sessionResolver.ts`). Additive typed field
   `Workout.fixtureVariant?: 'practice_match'`. New pure rule
   `fixtureVariantForPhase(seasonPhase)` (rules/, L14) — the ONE predicate,
   also adopted by `coachingEngine.ts:617` so the §18 mode and the label
   cannot disagree. `createGameStub`/`createVirtualGameStub` take the variant;
   the calendar-game branch stamps from `state.seasonPhase`.
   `dayIsPracticeMatch` reads the field OR the legacy `'Practice Match'`
   workoutType. `workoutType` stays `'Game'` — LABEL ONLY (99 comparison
   sites, HomeScreenV2:167 CTA, resolver invariants L1750/L1777 all
   untouched by construction).
2. **Charter part headlines** (`sessionBuilder.ts` + `projectVisibleWeek.ts`).
   `Workout.composedOptionalKind?: 'gunshow' | 'prehab' | 'mobility'`,
   stamped in `finaliseDerivedSession` from the `DerivedSessionType` it
   already receives (one site, every route funnels through it); carried by
   `g1RouteMaterialisation`/`placeSessionForRoute`'s copied field set; must
   survive `canonicalizeWorkout` + persistence (verify). `partHeadline` reads
   it ahead of the strength resolution → `part.headline.gunshow` /
   `part.headline.prehab` ("Accessories") / `part.headline.mobility`.
   Copy strings PROPOSED in the sheet (Batch 7): "Gunshow", "Accessories",
   "Mobility" — reusing the signed Add-menu labels, no invention.
   Legacy stored adds: narrow read-ingress lift (exact-name equality on the
   three template literals) so Sam's existing week renders right — L15
   pattern, decide at implementation whether canonicalisation ingress or
   projection-time read.
3. **Recovery producers** — the census found TEN; ruled treatment per
   producer ("retire per the charter"; charter: recovery deleted as a type,
   its contents ARE the mobility flows, placement athlete-only):
   - A.1 `attachRecoveryAddonsToWeek` (generateProgram.ts:562, every week,
     can land on team nights = Sam's "TT + Recovery"): DELETE the generation
     call (generator may not place optional work uninvited — charter rest
     law); hydration ingress lift drops generator-authored `recoveryAddons`
     (repeat-week precedent). §18 recovery-neutrality pins re-pinned in the
     same commit.
   - A.2 canonicaliser add-on promotion (workoutCanonicalisation.ts:904-944,
     label 'Recovery'): keep the row-preserving mechanics, retire the
     recovery WORD (mobility vocabulary).
   - B.3 `exposureEngine.recoverySubstitution` (empty 'Recovery Session' on
     injury-paused days — the "no recovery content" sighting): substitute to
     REST presentation, not a deleted type's name.
   - B.4/B.5 Mobility door + off-season top-up (typed 'Recovery'): headline
     from `composedOptionalKind: 'mobility'` (fix 2) — athlete taps Mobility,
     card says "Mobility".
   - B.6 `recovery_flow` template + `CATEGORY_COPY.recovery` + category
     emission (UI-hidden, live wiring): retire outright; charter file's
     recovery row re-homed per the ruling (no door), B2 gains a rendered-menu
     observation.
   - B.7 rest shells with `sessionTier: 'recovery'`: DECLARED hazard, not
     fixed here (tier feeds §18 counting; conditional reachability).
   - C.8 G+1 'Post-game recovery' over a planned displaceable session:
     retire — the displaced day lands REST (Bible G+1 protection kept, the
     deleted type not materialised); §18 relocates required exposure.
   - C.9 'Scheduled recovery - active' rebuild: rebuild AS mobility (the
     content is mobility rows; recovery-tier templates are legacy ingress).
   - C.10 allocator demotions minting 'Recovery Session': materialise as
     Mobility (engine tier strings are internal; the athlete-visible name
     was the defect).
   Re-point `devE2ESeedTestSupport`'s G+1 recovery expectation.
4. **Ack bug** — fix at whatever layer the depth cell reds.

## Phase C — audit + docs

- Part-list length/composition audit vs reassessment §4 (card = headline +
  all part headlines): report per-day-shape findings (e.g. a prehab add
  splits strength+support via name tags → "Accessories + Midline Work") for
  Sam to rule the structural half. NOT restructured in this round unless the
  census shows a producer-level fix inside scope.
- Copy sheet Batch 7 (PROPOSED, prose — projectionCopy.ts is outside the
  binder's scan); update §6-II-a 1b's producer-seam note (seam closed).
- Boundary-report addendum: L12 (what catches the next variant), NOT-COVERED,
  convergence statement.
- Fix the false comment at `projectionCopy.ts:42-49` (pass-through cannot
  fire from `project()` — measured by agent trace).

## Known risks

- `workoutCanonicalisation`'s evidence re-inference may strip/ignore new
  fields — verify survival with a test.
- D13 `L-P3 TEMPLATE = PROJECTION` declared reds must not silently shift
  (touch nothing that changes part KINDS in this round; labels only).
- Charter gate `sessionTypeCharterTests` B2 + CHARTER_DEBT ceilings: recovery
  retirement may move observed deviations — ceilings drop in the same commit
  or the ratchet fails.
