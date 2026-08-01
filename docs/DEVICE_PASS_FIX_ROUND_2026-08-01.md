# Device-pass fix round — boundary report (2026-08-01)

Branch `fix/g1-ownership-and-move-scoping`, base `c893b3a` (bible EXIT=0
verified at base). Input: Sam's combined device pass — **7/11, three fails in
ONE CLASS** (projection part/day naming lagging the session-type charter), one
separate ack bug, one new ruling (recorded:
`docs/TEAM_NIGHT_MOVABILITY_RULING_2026-08-01.md`, post-merge queue items
10-11). Tape: `device-export-2026-08-01-combined-pass.json` — WORLD ONLY (the
export was taken at launch and carries no tap events; its
`schedule:week:2026-07-27:busy_week` fact is the legacy-migration shape, ACTIVE
and overlaid, covering the marked game Saturday Sam tapped from).

**Merge condition unchanged: Sam re-runs the FULL checklist in one session.**
Checklist item 2d is RE-POINTED (practice match must now read its word); every
other line stands.

## The class, and the class fix

Every fail had one shape: **the projection's naming layer is typed and signed,
but the producers below it never shipped the typed fact the label reads** — so
labels fell back (generic "Strength", "Game Day") or rendered a deleted type's
word ("Recovery"). Every fix is the same move: the producer ships the typed
field; the projection reads it; a walker law enumerates the surface
coordinates.

**L11 was honoured**: the three naming laws and their red cells landed FIRST,
red, reproducing Sam's device verbatim — including `prehab` rendering exactly
`["Strength","Midline Work"]` and a seed-1 card carrying six words — then the
class was fixed and the cells went green.

## What changed

1. **Practice match (fail 1).** `Workout.fixtureVariant: 'practice_match'`,
   stamped by `createGameStub` from `state.seasonPhase` via
   `canonicalFixtureKindForResolvedPhase` — the app's ONE
   phase→fixture-identity expression (`rules/fixtureConditionedAvailability`,
   held to that file by `seasonPhaseOwnershipTests`' source gate, which
   caught the first draft of this fix minting a duplicate decider) — now also
   used by `coachingEngine.section18ModeAndSubphase`, so the week mode and
   the athlete's word cannot disagree. `workoutType` stays `'Game'`: the ~99
   `=== 'Game'` comparisons (locks, max-one-game invariant, proximity,
   HomeScreen's practice-match CTA) are untouched by construction — the ruling
   was LABEL ONLY and the implementation makes that structural.
2. **Charter types name themselves (fail 2).**
   `Workout.composedOptionalKind: 'gunshow' | 'prehab' | 'mobility'`, stamped
   at `sessionBuilder.finaliseDerivedSession` — the one site every placing
   route funnels through (generator top-ups, the athlete's three doors, the
   G-1 derivation) — and carried through the G-1 ask route's copy set, which
   erases even the row-id channel. `partHeadline` reads it ahead of the
   strength resolution: `part.headline.optional.{gunshow,prehab,mobility}` →
   "Gunshow" / "Accessories" / "Mobility" (copy sheet Batch 7-a, PROPOSED —
   all three reuse signed Add-menu labels). The `projectionCopy.ts` header's
   claim that the name pass-through covered these was MEASURED FALSE
   (31k-input trace: `partHeadline` omits `name`/`focus`, so the guards can
   never fire) and corrected — the confident-comment lesson again.
3. **Recovery vocabulary retired (fail 3).** Census found TEN producers
   (agent sweep; inventory below). Retired/renamed this round:
   - Generation's recovery-add-on placement pass DELETED
     (`generateProgram.ts`; was 2-4 add-ons on every week, team nights
     included — Sam's "TT + Recovery" card). Charter ground: placement of
     optional work is athlete-only.
   - G+1 protection over a planned displaceable session now materialises a
     MOBILITY session (was "Post-game recovery"). The Bible's G+1 protection
     stands; the deleted type is not materialised. The charter maps recovery's
     authored contents to the ten mobility flows, so this is the ruled
     substitution, not an invented one.
   - The recovery-template rebuild materialises Mobility (was "Scheduled
     recovery - active") — and gained the boundary that matters: a workout
     carrying `composedOptionalKind` is NEVER rebuilt (see Method, the bake
     collision).
   - `part.headline.recovery` REWORDED "Recovery" → "Mobility" (Batch 7-b):
     surviving recovery-KIND parts (attached add-ons, athlete-placed legacy
     recovery sessions no deriver may touch) are mobility flows by authored
     source. Kind and capabilities unchanged.
   - Canonicaliser add-on block: "Optional Mobility Add-on" / "Mobility"
     (Batch 7-c) — its `kind` field was already `'mobility'`.
   - The power-counting golden snapshot was regenerated with `--update` for
     exactly this change: every delta is a `recovery_addon` component
     disappearing from generated weeks (97 removals, all other component
     lines symmetric reflow — verified before committing, per the ratchet's
     own instruction).
4. **The ack bug.** The executor layer is PROVEN GREEN at the tape's exact
   coordinates — the walker's tape-world cell reaches Sam's world by acting
   (Pre-season profile, marked game Saturday, ACTIVE week-scoped busy fact,
   clock advanced onto the fixture day) and drives the identical
   `set_schedule_modifier` action through the real executor: no crash, honest
   refusal ack, byte-conservation. The silence therefore lives in the
   tap → setState → render path, which no harness in this repo can mount
   (recorded environment fact). Two responses:
   - The depth cell is ARMED in `test:bible` (regression floor for every
     layer below the glass).
   - `recordScheduleAckPresented` (`athleteActionDiagnostics.ts`) — both
     schedule doors emit `athlete_ui_outcome_shown` into the athlete action
     log (alive on Release, log-before-enabled-check) at the moment the ack
     state is set. The NEXT tape answers what this one could not: a completed
     schedule action with no presentation event beside it names the break as
     "executor returned, setState never ran"; one WITH it moves the break into
     render. No more reconstruction rounds.

## New laws (walker invariants, armed in `test:bible` both tiers)

- **L-P5 FIXTURE VARIANT** — a `game`-kind day's headline matches the season's
  fixture variant (typed variant outranks phase; phase decides what the
  producer should have stamped).
- **L-P6 CHARTER TYPE NAMES ITSELF** — a workout carrying
  `composedOptionalKind` headlines the charter word, never only generic
  vocabulary. Two deterministic cells carry the pre-producer red so the law
  cannot be satisfied by deleting the field.
- **L-P7 DELETED VOCABULARY** — no projected day/part headline ever renders
  "Recovery".

## Method findings

**The bake id-collision (found by the bible's absolutely-cooked cell, fixed by
narrowing the rebuild).** Changing the recovery-template rebuild to compose
mobility made its output id (`derived-mobility-<date>`) collide with the
mobility top-up's own id, and `bakeMicrocycleStrengthProgression` writes
resolved workouts back into stored microcycles BY ID — so a
`sessionTier: 'optional'` top-up was silently re-stored at tier `'recovery'`.
Two lessons: (a) at BASELINE the same rebuild was firing on top-ups at every
render and only an id MISMATCH kept it out of the store — the athlete was
being shown "Recovery Session" over a placed optional Mobility session, which
is almost certainly one of Sam's "recovery wording" sightings; (b) the fix is
a boundary, not a patch: a typed composed optional session is never a "legacy
template missing prescription fields" and the rebuild now refuses on the
marker. The absolutely-cooked cell caught it because per-type tiers are pinned
— the ratchet paying for itself.

**A stale-report from a run with undeclared reds in it is not evidence.** The
first deep run after the new laws reported two DECLARED reds as no longer
reproducing (the L6 block rollover and the D13 midline entry). Both deletions
were WRONG and were reversed the same session: the then-undeclared L-P6
violations were truncating the deep walks before the seeds reached those
entries' worlds. The stale-debt mechanism is sound — but its verdict is only
meaningful on a run whose walks completed. Corollary found the same hour: the
deep tier's known OOM-on-undeclared-red shrink hazard (boundary report method
finding d) now triggers at default heap, because walks that cross block
boundaries are heavier; declaring the red (or fixing it) is the remedy, not a
bigger heap.

**The one deep-tier L-P6 red was declared and PAID within the session.** A
typed mobility/prehab day rendering only "Conditioning" turned out to be the
composed-optional marker leaking onto COMBINED days through `stackTemplate`'s
base spread. The marker means "this workout IS one composed optional session";
it now dies with the purity it describes (cleared at the stacking site), and
the walker's stale-debt law forced the entry's deletion once every reachable
instance was gone.

**The part-list audit (Sam's "day labels say too many things"), reported not
re-answered.** Reassessment §4 rules the card renders `headline` + every part
headline. The census says the length came from PRODUCERS, not the rule:
(a) generation add-ons put a sixth word on full days ("Training Day + Power +
Lower Body Strength + Midline Work + Conditioning + Recovery" at seed 1) —
retired; (b) a prehab session split strength+support via a name-tag row
classifier, so one Accessories add read "Accessories + Midline Work" — TWO
words for ONE tapped door.

**(b) IS NOW RULED AND LANDED (Sam, 2026-08-01, with the Batch 7 signature —
copy sheet 7-e): ONE WORD.** An athlete-added session reads its door's name
alone; its rows are contents, visible inside, not card vocabulary. Landed at
the one owner — `getSessionComponentRows` no longer carves a trunk-support
part out of a marker-carrying workout — so the projection's parts, the
day-detail buckets and the rows-conservation law all agree by construction
(`composeDayDetail` reads the same function). The marker's purity guarantee
(`stackTemplate` clears it on combining) is what makes this safe: a combined
day still names both of its things. The walker's charter cell and L-P6 now
assert the EXACT one-word part list for all three door-added types.

## NOT-COVERED

- **Stored recovery add-ons are not stripped at hydration.** Sam's existing
  stored weeks keep their generator-placed add-ons, rendering "+ Mobility"
  (honest word, real rows). Dropping them at the read boundary is the
  repeat-week lift pattern (`dropRetiredWeekOverlaysAtHydration`) applied to
  §18-verified surfaces — its own small unit, named here. New generation
  places none.
- **Census producers left standing, with grounds.** B.3
  (`exposureEngine.recoverySubstitution`, injury-paused days rendering an
  empty "Recovery Session") — unreachable for Sam (no injuries; his sightings
  are explained by A.1 + the bake collision), lives in the injury pipeline;
  queued for the injury-projection owner. B.6 (the UI-hidden `recovery_flow`
  template + `CATEGORY_COPY.recovery` + charter row) — emits NOTHING into the
  projection, so outside the ruled scope; the charter contradiction stands
  recorded (boundary report NOT-COVERED item 1) with the ruling direction now
  settled (no door). B.7 (rest shells with `sessionTier: 'recovery'`) —
  conditional reachability, tier feeds §18 counting; declared hazard. C.10's
  stored names ('Recovery Session' in plan materialisation) — engine-internal;
  renaming them would move frozen coach matching keys (LR-6); the visible
  surface is owned by the rebuild.
- **The ack render layer remains unmountable.** The instrument above is the
  response; if the re-run still shows silence, the tape now names the layer.
- **The phase-source skew** (`buildScheduleStateImperative` reads the profile
  phase; `useSchedule` reads `ownSeasonPhase`) predates this round; the
  fixture variant reads whichever built the state. Recorded as existing debt —
  one more reason the clock should be the only phase author.

## L12 — what catches the next defect of this class

A new charter type, fixture variant, or vocabulary retirement now has an
enumerated home: L-P5/L-P6/L-P7 run after EVERY action in both walker tiers,
the deterministic cells pin the door-added path for each charter type, and the
tape-world cell pins the schedule door at accumulated depth. The next
producer that ships a label without its typed fact reds in `test:bible`
before Sam's phone sees it. What the harness still cannot see is the React
render layer — that gap now has a Release-alive instrument instead of a hope.

## CONVERGENCE

Toward the north star. Representations REMOVED: the generation add-on
placement pass (derived content stored uninvited); the resolver's
rebuild-over-composed-sessions (two authors of one session); name-only
identity for charter types (name-as-data-channel replaced by one typed field);
the practice-match word's second predicate (engine and label now share one).
Stored state added: NONE — both new Workout fields are stamped on derived
output at composition time, never persisted as separate truth, and the ack
instrument writes to the existing action log.
