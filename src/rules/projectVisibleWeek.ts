/**
 * `project()` — THE ONE CANONICAL PROJECTION. `buildProgramTabProjectedWeek`'s
 * successor.
 *
 * Sam's ruling: one projection, every surface a dumb window onto it, a day that
 * can be described two ways is a defect by construction.
 *
 * WHAT THIS STAGE DOES AND DOES NOT DO. It establishes the OWNER and the SHAPE.
 * `parts`, `capabilities`, `kind` and `owner` are computed here, once, and the
 * cells consume them — which is enough to hold L-P1/L-P3/L-P4, because those laws
 * are about structure and capability, not wording. It deliberately does NOT invent
 * headlines: `headline` resolves through the signed-copy sheet, so a day whose
 * words Sam has not yet ruled raises `UnsignedCopyError` rather than quietly
 * shipping composed text. That is the designed behaviour — the gap is loud and it
 * is Sam's to close (batches 3-4 are in flight) — and it is why `projectParts`
 * exists beside `project`: the structural laws can be armed now without waiting on
 * vocabulary, and there is still only ONE derivation, asked two questions.
 *
 * WHY IT WRAPS RATHER THAN REPLACES, FOR NOW. `buildProgramTabProjectedWeek` is
 * already a single derivation of accepted state and is the only one no screen
 * composes over. Re-deriving from accepted state here would create a fifth
 * projection during the migration — the exact thing being removed — so this reads
 * that one and re-shapes it. The wrapper is a staging device with a stated end:
 * when every surface consumes `project()`, the inner call collapses into it and
 * `buildProgramTabProjectedWeek` goes (deletion 1 of nine). Until then the
 * assertion `project() ≡ buildProgramTabProjectedWeek` is trivially true, which is
 * the point — the new owner is proven to change nothing before anything renders
 * from it.
 *
 * RECOVERY IS A DAY TYPE LIKE ANY OTHER (ruling 3). No branch here treats a
 * recovery part as less than a strength part: capabilities come from the part's
 * position in the day, never from its kind. What recovery does NOT do is count —
 * `countsTowardLoad` carries that, and only the ledger reads it.
 */

import type { ResolvedDay } from '../utils/sessionResolver';
import type { Workout } from '../types/domain';
import { getSessionComponents } from '../utils/sessionComponents';
import { composeDayDetail, type ComposedDayDetail } from '../utils/dayDetailComposition';
import { canonicalExerciseName } from '../utils/exerciseCanonicalisation';
import { resolveSessionDisplayName } from '../utils/sessionNaming';
import {
  conditioningDoseValueCopyId,
  exerciseCueCopyId,
  exerciseNameCopyId,
  registerProjectionCopy,
  STRENGTH_HEADLINE_ID_BY_LABEL,
  type ConditioningDoseField,
} from './projectionCopy';
import { conditioningVisibleDoseFor } from './conditioningSelection';
import { displayReps } from './prescriptionDisplay';
import { signedCopy, type SignedCopy } from './signedCopy';
import {
  PART_COUNTS_TOWARD_LOAD,
  type DayCapabilities,
  type PartCapabilities,
  type VisibleDay,
  type VisibleDayKind,
  type VisibleDayOwner,
  type VisiblePart,
  type VisiblePartKind,
  type VisibleRow,
  type VisibleWeek,
} from './visibleProjection';

// Registered once at module load, so every call to `project()` — the first
// one included — finds its vocabulary already there. Idempotent: see
// `registerProjectionCopy`'s own guard.
registerProjectionCopy();

/**
 * The structural half of a day — everything that needs no vocabulary.
 *
 * Same fields as `VisibleDay` minus the words. Not a second projection: it is the
 * same derivation with the words not yet applied, so `project()` is literally
 * `projectParts()` plus the two things that carry `SignedCopy` — headlines and
 * rows. Both live on the words side deliberately; see `ProjectedDayParts.parts`.
 */
export interface ProjectedDayParts {
  readonly date: string;
  readonly kind: VisibleDayKind;
  readonly owner: VisibleDayOwner;
  /**
   * NO `rows` HERE, AND THAT IS THE POINT. Rows carry `SignedCopy`, so composing
   * them inside the structural half made a COPY GAP disarm the STRUCTURAL laws:
   * one unsigned row name and `projectParts` threw, taking parts conservation
   * (L-P3) and capability parity (L-P4) down with it. The action walker found it
   * two actions from a fresh install on every seed it tried — a real generated
   * week emits a planner-composed row name (defect 3's class, at row level) that
   * no fixture in the suite had reached. Rows are composed in `project()`, where
   * the words already live.
   */
  /**
   * `bucket` IS A WORD, SO IT SITS WITH THE WORDS. Added 2026-08-08 with Sam's
   * bucket-vocabulary ruling: like `headline` it is `SignedCopy` and is resolved
   * in `project()`, so the structural half stays free of the copy sheet and the
   * structural laws keep working when a copy entry is missing.
   */
  readonly parts: readonly Omit<VisiblePart, 'headline' | 'bucket' | 'detail' | 'rows'>[];
  readonly capabilities: Omit<DayCapabilities, 'refusal'>;
}

export interface ProjectedWeekParts {
  readonly weekStart: string;
  readonly days: readonly ProjectedDayParts[];
}

const COMPONENT_TO_PART: Readonly<Record<string, VisiblePartKind>> = {
  strength: 'strength',
  conditioning: 'conditioning',
  finisher: 'conditioning',
  power: 'power',
  speed: 'speed',
  support: 'support',
  team_training: 'team_training',
  recovery: 'recovery',
  recovery_addon: 'recovery',
  session: 'strength',
};

/**
 * Workout types that ARE a fixture, whatever route put them on the day.
 *
 * A fixture reaches a `ResolvedDay` two ways. The athlete's calendar mark is the
 * usual one — `source: 'game'`, and `calendarStore` routes an in-season game and
 * a pre-season practice match through the same mark — and `workoutToIndicator`
 * turns a generated `Game` workout into `indicator: 'game'` beside it. The third
 * is a workout the PROGRAM produced for a practice-match week
 * (`coachingEngine`'s `practice_match_week` mode), which carries neither.
 *
 * Declared as a set of typed `workoutType` values rather than matched by a regex
 * over the rendered title. `visibleDayLooksLikeGame` — the predicate this
 * replaces for the athlete's doors — is `/\bgame\b/` over title + name +
 * workoutType joined, which is the title-as-a-data-channel shape this unit exists
 * to remove: it also matches a session an athlete happened to name "game prep".
 * A set can be enumerated, and a fixture kind added later is a compile-adjacent
 * edit here rather than a regex somebody has to guess at.
 */
const PRACTICE_MATCH_WORKOUT_TYPE = 'Practice Match';

const FIXTURE_WORKOUT_TYPES: ReadonlySet<string> = new Set(['Game', PRACTICE_MATCH_WORKOUT_TYPE]);

/**
 * IS THIS FIXTURE A PRACTICE MATCH? — a LABEL question, and only a label question.
 *
 * Sam's ruling, 2026-07-31 (copy sheet §6-IV-4): a practice/trial fixture day reads
 * "Practice Match", not "Game Day". What it does NOT change is anything else — the
 * day's `kind` is still `game`, `dayIsFixture` still answers the same for it, and
 * every capability the fixture lock computes is untouched. A practice match is the
 * same shape of week with a different word on one day.
 *
 * It reads the SAME typed `workoutType` that `dayIsFixture` reads, deliberately: two
 * predicates over the same question is how a menu and a writer came to disagree
 * about which days were fixtures (see `dayIsFixture`'s header). This one narrows
 * that set, it does not re-derive it — a day this returns true for is a day
 * `dayIsFixture` returns true for, by construction.
 *
 * REACHABILITY, STATED RATHER THAN ASSUMED. `'Practice Match'` is not a member of
 * the `WorkoutType` union: today it arrives on hand-built and legacy workouts, which
 * is exactly why `dayIsFixture` compares `String(...)` against a set instead of
 * switching on the type. The app's own generator marks a practice-match anchor
 * (`TargetWeekFixture.kind: 'practice_match'`) and then resolves the day through
 * `createGameStub`, whose `workoutType` is `'Game'` — so on a freshly generated week
 * this returns false and the day still reads "Game Day". That is a gap in the
 * PRODUCER, not in the ruling: the signed word is registered and wired at the one
 * place the athlete reads it, and it turns on for free the day a practice-match
 * anchor materialises with its own type. Recorded in the copy sheet §6-IV-4 so it is
 * a known seam rather than a surprise.
 */
export function dayIsPracticeMatch(day: ResolvedDay): boolean {
  // THE PRODUCER SHIPS THE VARIANT NOW (2026-08-01, device-pass fail 1):
  // `createGameStub` stamps `fixtureVariant: 'practice_match'` from the season
  // phase — the app's one phase→fixture-identity expression
  // (`canonicalFixtureKind`, `rules/fixtureConditionedAvailability.ts`), the
  // same one the engine's week mode uses. The `workoutType` read stays for hand-built
  // and legacy workouts that carry the word as their type; the variant field
  // only ever exists on a workout whose type is already in the fixture set, so
  // this still NARROWS `dayIsFixture` by construction.
  return day.workout?.fixtureVariant === 'practice_match'
    || String(day.workout?.workoutType ?? '') === PRACTICE_MATCH_WORKOUT_TYPE;
}

/**
 * IS THIS DAY A FIXTURE? The one typed answer, for every athlete door.
 *
 * Exported because the MENU and the WRITER must not disagree about it. They did:
 * `listPlanChangeOptionsForDay` locked the day and `buildPlanChangeProposal`
 * refused it through two different predicates, and this task's first pass made
 * that worse by moving only the menu onto `dayKind` — narrowing the lock so a
 * generated practice-match day, and a hand-built `Game` day carrying neither
 * marker, stopped locking at all (`planChangeProducerTests` [4] and [17] caught
 * it). One question, one predicate, both ends.
 *
 * The COACH paths keep `visibleDayLooksLikeGame` (LR-6: `coachRevisionPolicy`,
 * `coachTurnController`, the semantic adapter are frozen). This owns the athlete
 * doors only, and says so rather than pretending the repo has one predicate when
 * it has two.
 */
export function dayIsFixture(day: ResolvedDay): boolean {
  return day.source === 'game'
    || day.indicator === 'game'
    || FIXTURE_WORKOUT_TYPES.has(String(day.workout?.workoutType ?? ''));
}

/**
 * Is this day a fixture, complete rest, or training?
 *
 * REST IS ITS OWN KIND, never "a day whose workout is null" — that conflation is
 * what let a deletion door write a schedule fact, and it is why an empty training
 * day and a rest day must be distinguishable here.
 */
function dayKind(day: ResolvedDay): VisibleDayKind {
  if (dayIsFixture(day)) return 'game';
  if (day.source === 'rest') return 'rest';
  return 'training';
}

function dayOwner(day: ResolvedDay): VisibleDayOwner {
  if (day.workout?.athletePlacement) return 'athlete';
  if (day.source === 'manual') return 'athlete';
  if (day.source === 'rest' || day.source === 'game') return 'fact';
  return 'plan';
}

/**
 * Components that are FIXED APPOINTMENTS — a commitment the athlete keeps, not
 * work the plan chose for them.
 *
 * `team_training` is the declared one. `session` is the same thing arriving
 * through a different door: `getSessionComponents` emits it as the last-resort
 * component for a workout with no recognisable training content — a "Club
 * Session" with a name, a duration and no rows. `planChangeProducer` says it in
 * its own words already ("a commitment is a fixed appointment, binnable for one
 * date but not movable to another day"), and it says it from the SECTION kinds.
 * Said here so the menu can stop saying it.
 */
const APPOINTMENT_COMPONENTS: ReadonlySet<string> = new Set(['team_training', 'session']);

/**
 * Components ATTACHED to the day rather than standing in it.
 *
 * A recovery add-on is a fact about the DAY, not a component of a session — that
 * is `sessionComponents.materializeAcceptedVisibleSections`'s own signed finding
 * (`keepRecoveryAddons`): the half of a split day that LEAVES never takes the
 * add-on with it, because on a day of strength + conditioning + team training
 * neither half owns it and moving the gym session silently deleted the athlete's
 * mobility work. It follows that an add-on cannot leave on its own either, and no
 * door can remove one: `recoveryAddons` is a top-level workout field, so it
 * produces no visible section, so there is no bin scope, no move scope and no
 * split that names it.
 *
 * NOT A RECOVERY EXCEPTION (ruling 3). A standalone recovery SESSION — the
 * `recovery` component — is as swappable, movable and removable as a strength
 * session, and `projectionOwnershipTests` states that directly. This is about
 * POSITION: attached-to-the-day is a position, and a strength add-on, if one
 * existed, would answer the same way.
 */
const ATTACHED_COMPONENTS: ReadonlySet<string> = new Set(['recovery_addon']);

const NOTHING_MAY_BE_DONE: PartCapabilities = {
  canSwap: false,
  canMove: false,
  canRemove: false,
  canEditRows: false,
};

/**
 * What the athlete may do to a part.
 *
 * Derived from the part's POSITION in the day, never from its kind — that is
 * ruling 3 in code. Three positions answer differently, and each is a fact about
 * the athlete's week rather than about the words on the part:
 *
 *   1. A FIXTURE OWNS ITS WHOLE DAY. Nothing on a game day is the athlete's to
 *      swap, move, remove or edit. The projection used to miss this: `dayKind`
 *      said "game" while `COMPONENT_TO_PART` mapped the fixture's own `session`
 *      component to `strength`, so one derivation offered a move and a removal on
 *      a fixture while the menu locked it — one derivation disagreeing with
 *      ITSELF, which is worse than two surfaces disagreeing (walker declared reds
 *      `projection_calls_a_game_day_editable` / `projection_offers_a_move_on_a_
 *      game_day`).
 *   2. AN APPOINTMENT DOES NOT TRAVEL AND DOES NOT TRADE — but it CAN be dropped
 *      for one date. Sam, 2026-07-03: "Can't make it tonight — this date only".
 *      `binScopesForSnapshot` has offered exactly that since, and
 *      `planChangeProducerTests` [12] pins it, so a blanket "an anchor is not
 *      removable" would have deleted a signed capability. Remove is true; swap,
 *      move and row-editing are not.
 *   3. AN ADD-ON RIDES WITH THE DAY. See `ATTACHED_COMPONENTS`.
 *
 * Everything else on the day is equally editable whether it is strength or
 * recovery.
 */
function partCapabilities(
  componentId: string,
  kind: VisiblePartKind,
  onDay: VisibleDayKind,
): PartCapabilities {
  if (onDay === 'game' || kind === 'game') return NOTHING_MAY_BE_DONE;
  if (ATTACHED_COMPONENTS.has(componentId)) return NOTHING_MAY_BE_DONE;
  if (kind === 'team_training') {
    // TEAM-NIGHT MOVABILITY (Sam's 2026-08-01 ruling, signed 2026-08-02): the
    // team anchor is the athlete's to MOVE — through the typed once-or-
    // permanent ask, never silently — so the projection now says so. It is
    // still not a type to TRADE (swap stays refused with its signed sentence)
    // and its rows are the club's, not the athlete's, to edit.
    return { canSwap: false, canMove: true, canRemove: true, canEditRows: false };
  }
  if (APPOINTMENT_COMPONENTS.has(componentId)) {
    // A non-team appointment ("Club Session") keeps position 2 whole: it does
    // not travel, does not trade, and can be dropped for one date.
    return { canSwap: false, canMove: false, canRemove: true, canEditRows: false };
  }
  return { canSwap: true, canMove: true, canRemove: true, canEditRows: true };
}

/**
 * DOES THIS PART HOLD THE DAY DOWN? — position 2 of `partCapabilities`, named.
 *
 * A whole-day move takes everything on the day with it, so a day carrying an
 * APPOINTMENT must not offer one: the commitment would travel, and a commitment
 * is a fixed date by definition. That question has two near-misses and this
 * predicate exists to keep them apart:
 *
 *   AN ADD-ON also answers `canMove: false` — and an add-on RIDES WITH the day,
 *   so it must NOT suppress the whole-day move (`ATTACHED_COMPONENTS`). It is
 *   `NOTHING_MAY_BE_DONE`, so `canRemove` is false and it is excluded here.
 *
 *   A TEAM NIGHT is an appointment the athlete MAY move (Sam, signed
 *   2026-08-02), so it answers `canMove: true` and is excluded here too — the
 *   move door keys the `team` scope on the projection's typed team anchor.
 *
 * EXPORTED BECAUSE THE MOVE DOOR ASKS IT. `planChangeProducer.moveOptionsForDay`
 * used to answer this for itself, from `CoachVisibleSectionSnapshot.kind`, and
 * on 2026-08-12 the two decompositions disagreed on a real walked day: the card
 * rendered a lone recovery session as a `session` appointment named "Rest" while
 * the projection carried a movable `recovery` part, so the door refused
 * `nothing_movable` about work the app itself said could move (walker L-P4,
 * seed 3, 2026-10-15). Sam ruled the day a recovery session. One predicate, both
 * ends — the same shape `isComposedPrescriptionRow` already has.
 */
export function partHoldsTheDayDown(part: {
  readonly capabilities: PartCapabilities;
}): boolean {
  return !part.capabilities.canMove && part.capabilities.canRemove;
}

/**
 * The row-level rescue: same numbers, an authored template.
 *
 * Reuses the SHAPE `dayWorkoutHelpers.formatStrengthSetsReps` /
 * `formatRecoveryPrescription` already ship — sets×reps and duration are the
 * two dominant row shapes across strength/support/conditioning rows. A shape
 * not covered here (distance, tempo, per-side) falls through to
 * `row.prescription.unspecified` rather than inventing a template for it; see
 * `projectionCopy.ts`'s header and the task report for that scope note.
 *
 * ## R-016 REACHES THIS SURFACE (2026-08-17, projection cleanup)
 *
 * Sam's prescription-display law — *"ranges remain the generation source, the
 * athlete sees a single middle number"*, Bible `:770`/`:4936`, registry R-016 —
 * was marked `BUILT`, and it WAS: in `dayWorkoutHelpers.formatStrengthSetsReps`,
 * which calls `rules/prescriptionDisplay.displayReps`. **This projection never
 * got it.** So the day-detail screen said `3 × 5` and the one canonical
 * projection said `3 × 4-6` — one question with two owners, which is the exact
 * defect class this module exists to end. `docs/printed-weeks/*` counted 15 of
 * them on a single pre-season week and said so in its own findings.
 *
 * The number comes from `displayReps` — the EXISTING owner — and not from
 * arithmetic here, because the law binds what the athlete READS to what logging
 * ASSUMES and a second midpoint is how those two drift.
 *
 * **THE STORED RANGE IS NOT TOUCHED.** `prescribedRepsMin`/`Max` are read and
 * left alone; the law's own words are "ranges remain the generation source".
 * `row.prescription.sets_reps_range` stays registered and stays reachable — see
 * the DURATION note below — so this narrows which rows use it rather than
 * deleting a signed shape.
 *
 * **DURATION RANGES ARE NOT REP RANGES AND KEEP THEIR RANGE.** R-016 is about
 * REPS. A `duration_minutes` row prescribing 20-30 min is offering a window the
 * athlete chooses inside, not an ambiguous count of repetitions, and collapsing
 * it to `25 min` would invent a precision Sam never authored. The two duration
 * branches are deliberately untouched.
 */
function prescriptionCopy(row: any): SignedCopy {
  const sets = Number(row?.prescribedSets);
  const min = Number(row?.prescribedRepsMin);
  const max = Number(row?.prescribedRepsMax);
  const hasRange = Number.isFinite(min) && Number.isFinite(max);
  const pType = row?.prescriptionType;
  if (pType === 'duration_minutes' && hasRange) {
    return min === max
      ? signedCopy('row.prescription.duration_minutes', { minutes: min })
      : signedCopy('row.prescription.duration_minutes_range', { min, max });
  }
  if (pType === 'duration' && hasRange) {
    return min === max
      ? signedCopy('row.prescription.duration_seconds', { seconds: min })
      : signedCopy('row.prescription.duration_seconds_range', { min, max });
  }
  if (Number.isFinite(sets) && hasRange) {
    // R-016. `displayReps` returns null only when BOTH ends are absent, which
    // `hasRange` has already excluded — the fallback to `min` is the same
    // defensive one `formatStrengthSetsReps` carries, kept identical so the two
    // surfaces cannot diverge on an edge either.
    const reps = displayReps(min, max) ?? min;
    return signedCopy('row.prescription.sets_reps', { sets, reps });
  }
  return signedCopy('row.prescription.unspecified');
}

/**
 * A raw row's exercise name, as `SignedCopy`.
 *
 * Never composed: every name a builder emits traces to either the locked
 * vocabulary (`selectableExerciseVocabulary.ts`, exercise-name-literal-lock
 * unit) or the small, structurally-closed conditioning-equipment-substitution
 * set (`conditioningFeasibility.ts`'s own exported list) — both
 * bulk-registered by `projectionCopy.ts`. Canonicalising before lookup
 * handles spelling/case variants the same way `hasCuratedCue` already does.
 *
 * NO FALLBACK, on purpose — the template-blank law
 * (`docs/COPY_SHEET_RULINGS_2026-07-30.md` batch 2, ruling 1): "an
 * unmapped engine value fails the build rather than falling back." A row name
 * that resolves to neither traced source is a THIRD source this projection
 * does not yet know about, and the honest behaviour is `UnsignedCopyError` —
 * the gate goes red and names the gap — not a generic word an athlete would
 * read as if it were the real exercise.
 */
function rowName(row: any): SignedCopy {
  const raw = String(row?.exercise?.name ?? row?.name ?? '');
  const canonical = canonicalExerciseName(raw);
  return signedCopy(exerciseNameCopyId(canonical));
}

function rowCue(row: any): SignedCopy | null {
  const raw = String(row?.exercise?.name ?? row?.name ?? '');
  const canonical = canonicalExerciseName(raw);
  const id = exerciseCueCopyId(canonical);
  return id ? signedCopy(id) : null;
}

/**
 * Is this row an AUTHORED EXERCISE, or a prescription the builder composed?
 *
 * `exerciseType: 'Cardio'` is the marker, and FOUR places stamp it — the claim
 * here is about all four, not just the generator:
 *
 *   - `sessionBuilder.condEx` (`:1051`) — the constructor for conditioning,
 *     sprint and speed rows, and the population this filter exists for. What it
 *     makes is not an exercise from a vocabulary: it is a sentence assembled at
 *     build time out of numbers, modality words and planner nouns ("Aerobic
 *     conditioning component (3 x 8min zone 2 Mixed Erg Block)", "Assault Bike
 *     warm-up", "Quality speed warm-up (short)").
 *   - `applyAdjustmentEvents.ts:735` and `coachCommandExecutor.ts:3807` — rows
 *     an adjustment or a coach command materialises, whose names come from the
 *     same composed vocabulary and are equally unsigned. Dropped for the same
 *     reason, deliberately.
 *   - `data/defaultProgram.ts:395,406` — two rows of the hardcoded default
 *     program. Also dropped; `defaultProgram` is the pre-generation placeholder
 *     and its conditioning rows have no authored name either.
 *
 * Every other row on a generated day names an exercise from the locked vocabulary
 * (`selectableExerciseVocabulary.ts`, exercise-name-literal-lock unit), and a
 * template-placed row names one from the addable-content registry
 * (`coachRevisionTemplates.ts`, `exerciseType: 'Conditioning'` — untouched by this
 * filter) — both authored, both registered.
 *
 * ASKED OF THE ROW'S OWN TYPE, NOT OF THE COPY SHEET. "Is this name registered?"
 * would be the same question backwards — the projection deciding what to carry by
 * consulting the words, which makes the sheet the authority over content. This
 * asks the emitter's own marker, so the boundary is a fact about how the row was
 * built. It also does not depend on WHICH bucket the row landed in: the row that
 * exposed this was a sprint warm-up that the keyword-tail classifier put in
 * `strengthRows`, and a bucket-shaped rule would have missed it.
 *
 * WHAT IT COSTS, DECLARED NOT HIDDEN. A dropped row is not a silent omission: the
 * walker's `L-P3 ROWS CONSERVATION` law reds for every part whose projected row
 * count does not equal the day's, and carries the debt as a declared entry naming
 * the conditioning-generation owner (`projection_carries_no_rows_for_a_
 * conditioning_part`). See `rowsForKind` for why the alternatives are worse.
 */
export function isComposedPrescriptionRow(row: any): boolean {
  // STAGE B LANDED (2026-08-05). The `'Cardio'` test below was a PROXY for
  // "this row's name was composed", correct only while every conditioning row
  // was built by `sessionBuilder.condEx` out of planner nouns and numbers.
  // The switchover retired that composer: a conditioning row now carries Sam's
  // authored template name, and its warm-up carries his signed sentence
  // (ruling 4, `docs/SWITCHOVER_PARKED_RULINGS_2026-08-05.md`). The emitter
  // marks those rows `nameProvenance: 'authored'`, which is the same KIND of
  // question this predicate always asked — how the row was built — just
  // answered directly instead of inferred from its exercise type.
  if (row?.nameProvenance === 'authored') return false;
  return String(row?.exercise?.exerciseType ?? '') === 'Cardio';
}

/**
 * THE AUTHORED CONDITIONING DOSE FOR A ROW, OR NO LINES AT ALL.
 *
 * Sam's first surface, 2026-08-17: *"conditioning must show its real
 * prescription — work time, rest time, repetitions/rounds and useful duration —
 * not `1 × 1`"*.
 *
 * `1 × 1` was never a dose. A real generated `Classic 4×4` row carries
 * `prescribedSets: 4, prescribedRepsMin: 1, prescribedRepsMax: 1`, and a
 * `Steady Blocks (3×8 min or 4×6 min)` row carries `1, 1, 1` — placeholders the
 * composer fills because the type demands numbers, while the prescription Sam
 * authored sits on the template those rows were built from. The projection was
 * rendering the placeholder over the top of the real thing.
 *
 * **THE LOOKUP IS BY AUTHORED NAME, WHICH IS THE ESTABLISHED LINK.** A
 * conditioning row's `exercise.name` IS its template's `name`, verbatim —
 * `composeConditioningRows` passes `template.name` — and `SpeedBlock.templateName`
 * already states the rule in its own words: *"rows derive from the template by
 * name — never from string-prefix matching on `id`"*. `resolveTemplateByName`
 * is the existing resolver and it already handles Sam's legacy-format map.
 *
 * **NOTHING IS INVENTED AND NOTHING IS PARSED BACK OUT OF WORDS.** The
 * alternative was reading the four values out of the row's own `notes`, where
 * the composer already wrote them — that is title-as-a-data-channel, the shape
 * this module exists to remove. This asks the authored sheet.
 *
 * **A ROW WITH NO TEMPLATE GETS NOTHING**, deliberately: stored legacy content,
 * coach-authored rows and the warm-up row resolve to `null` and carry no dose,
 * rather than borrowing a prescription that was never written for them. For the
 * warm-up that is also R-049 — *"dose counts main work only; warm-up and
 * cool-down never count"* — arriving at the display for free rather than as a
 * second rule about the same row.
 */
const DOSE_LINES: readonly (readonly [ConditioningDoseField, string])[] = [
  ['work', 'row.dose.work'],
  ['rest', 'row.dose.rest'],
  ['sets_rounds', 'row.dose.sets_rounds'],
  ['total_time', 'row.dose.total_time'],
];

function doseCopy(row: any): readonly SignedCopy[] {
  const dose = conditioningVisibleDoseFor(String(row?.exercise?.name ?? row?.name ?? ''));
  if (!dose) return [];
  // KEYED OFF `dose.templateName`, NOT off the row's name. A stored row may
  // carry a legacy name that Sam's legacy-format map resolves to a real
  // template; the copy sheet registers the AUTHORED name, so a row-name key
  // would find nothing and quietly drop a dose that had just resolved.
  return DOSE_LINES.flatMap(([field, labelId]) => {
    const valueId = conditioningDoseValueCopyId(dose.templateName, field);
    // No `catch` and no substitution — `signedCopy` raising `UnsignedCopyError`
    // is this module's declared behaviour for a copy gap (see the header).
    return valueId ? [signedCopy(labelId, { value: signedCopy(valueId) })] : [];
  });
}

/**
 * A ROW SHOWS ITS SETS×REPS LINE, OR ITS AUTHORED DOSE — NEVER BOTH.
 *
 * When the authored dose exists it IS the prescription, and the placeholder
 * numbers beside it are noise at best and `1 × 1` at worst. So the sets×reps
 * line is dropped for exactly those rows, and `VisibleRow.prescription` says
 * `null` out loud rather than a surface deciding which of two lines to believe.
 *
 * THE WARM-UP ROW LOSES ITS LINE TOO, and that is the same rule, not an
 * exception: `Warm-up` resolves to no template, so it has no dose — and its
 * `1 × 1` was the other half of Sam's complaint. R-049 says a warm-up carries
 * no dose; a row with no dose and no meaningful reps has no prescription line,
 * and its authored sentence (`CONDITIONING_WARMUP_COPY`, "5-10 min: start
 * easy...") is already its cue.
 */
function rowHasNoPrescriptionLine(row: any, dose: readonly SignedCopy[]): boolean {
  if (dose.length > 0) return true;
  if (String(row?.role ?? '') !== 'conditioning') return false;
  // A conditioning row with no authored dose keeps its numbers ONLY when they
  // say something. `1 × 1` says nothing, and it is the exact string Sam named.
  const sets = Number(row?.prescribedSets);
  const min = Number(row?.prescribedRepsMin);
  const max = Number(row?.prescribedRepsMax);
  const isPlaceholder = min === 1 && max === 1 && !row?.prescriptionType;
  return isPlaceholder && (!Number.isFinite(sets) || sets <= 1);
}

function toVisibleRows(rows: readonly any[]): VisibleRow[] {
  return rows
    .filter((row) => !isComposedPrescriptionRow(row))
    .map((row, index) => {
      const dose = doseCopy(row);
      return {
        id: String(row?.id ?? `${index}`),
        name: rowName(row),
        prescription: rowHasNoPrescriptionLine(row, dose) ? null : prescriptionCopy(row),
        dose,
        cue: rowCue(row),
      };
    });
}

/**
 * The rows a part shows, from the SAME derivation the day-detail screen uses.
 *
 * `composeDayDetail` is `useDayWorkout`'s composition, extracted so a harness
 * could call it (`dayDetailCompositionOwnershipTests.ts`). Since Task 6 this
 * projection is its ONLY production caller — the screen renders `parts`, and the
 * hook composes nothing.
 *
 * COMPOSED PRESCRIPTION ROWS ARE NOT CARRIED, AND THE GAP IS THE POINT (Task 6).
 * See `isComposedPrescriptionRow` for the boundary. A generated conditioning or
 * speed row's `exercise.name` is composed by `sessionBuilder.ts` out of planner
 * nouns and numbers — "Aerobic conditioning component (3 x 8min zone 2 Mixed Erg
 * Block)", "Assault Bike warm-up", "Quality speed warm-up (short)". That is
 * defect 3 (`surfaceAgreementTests` cell 3) one layer down: cell 3 bans planner
 * vocabulary from a session NAME, and the same text reaches a ROW name from the
 * same composer. There are exactly three things this projection could do with it
 * and two of them are the defect:
 *
 *   1. Register the composed strings as `SignedCopy`. That is laundering — the
 *      module's whole premise is that `allocation.focus` CANNOT become a signed
 *      word, and a sheet grown to hold the composer's output has conceded the
 *      argument. The walker's declared red says so in its own words: "the sheet
 *      cannot contain them and must not be made to".
 *   2. Catch the `UnsignedCopyError` and substitute something. Banned outright
 *      (L14, and `signedCopy.ts`'s "throws rather than falling back").
 *   3. Say plainly that this projection has no authored name for a composed
 *      prescription row yet. The part is still carried, still named, still
 *      capable; its ROWS are the open gap, and the gap is declared (walker law
 *      `L-P3 ROWS CONSERVATION`, entry
 *      `projection_carries_no_rows_for_a_conditioning_part`) rather than hidden.
 *
 * Three is what this does. Nothing consumed those rows — the card renders
 * headlines, the menu renders capabilities, and the day-detail screen's row
 * rendering is the INPUT surface (weights, receipts, cues, video), which reads the
 * workout directly and always did. The authored vocabulary these rows are owed
 * exists and is not wired: `data/conditioningTemplates.ts`, Sam's 55 signed
 * doses, "NOT WIRED YET ... Stage B switches selection onto it". Wiring it is the
 * conditioning-generation owner's, not a UI task's.
 *
 * Kinds with no row-level surface in `composeDayDetail` (recovery, team_training,
 * power, speed, game) still get `[]` here — unchanged from Task 2, and separately
 * declared by the same rows-conservation law where the day does hold rows for
 * them.
 */
function rowsForKind(kind: VisiblePartKind, composed: ComposedDayDetail): VisibleRow[] {
  if (kind === 'strength') return toVisibleRows(composed.strengthExercises);
  if (kind === 'support') return toVisibleRows(composed.supportExercises);
  if (kind === 'conditioning') return toVisibleRows(composed.conditioningExercises);
  return [];
}

/**
 * What KIND of work a component is, on the day it sits on.
 *
 * `COMPONENT_TO_PART` answers for every real component. The one thing it cannot
 * answer alone is the LAST-RESORT `session` component: `getSessionComponents`
 * emits it for a workout with no recognisable training content, which is two
 * different things wearing one id — a "Club Session" appointment on an ordinary
 * day, and the stub a FIXTURE carries (`createGameStub` /
 * `createVirtualGameStub`, both `exercises: []`). Mapping both to `strength` put
 * a "Strength" part on every game day: the projection called the day a game and
 * its only part a strength session, which is one derivation disagreeing with
 * ITSELF, and Tasks 4 and 5 each had to gate around it (the card's
 * `cardLeadHeadline` forces `day.headline` for `kind === 'game'` precisely
 * because `parts[0]` said "Strength").
 *
 * The day already knows the answer, so it gives it: on a fixture, the placeholder
 * IS the fixture, and its kind is `game`. `VisiblePartKind` has carried `game`
 * since Task 2 and `part.headline.game` has been registered since then — this is
 * the mapping that makes it reachable.
 *
 * DELIBERATELY NARROW. Only the placeholder converts, and only on a fixture day.
 * A fixture day that somehow carries real components (a `Practice Match`
 * workoutType with generated content) keeps them named for what they are — a
 * blanket "everything on a game day is a game part" would erase content to fix a
 * placeholder. `partCapabilities` already locks the whole day either way.
 */
function partKind(componentId: string, onDay: VisibleDayKind): VisiblePartKind {
  if (onDay === 'game' && componentId === 'session') return 'game';
  return COMPONENT_TO_PART[componentId] ?? 'strength';
}

/**
 * THE PART ID HAS ONE OWNER, AND IT OWNS BOTH DIRECTIONS.
 *
 * A part's id is `<date>:<componentId>` — a compound, and a compound that any
 * consumer can take apart is a shape three surfaces will end up parsing three
 * ways. L12's class for the day-first unit is exactly that: *a surface that
 * re-derives an identity the projection already carries*. So construction and
 * recovery are one pair of functions, sitting where the id is minted, and the
 * day a part id's shape changes ONE place fails loudly instead of three surfaces
 * drifting.
 *
 * THE NAIVE SPLIT IS SAFE, AND THAT WAS MEASURED RATHER THAN ASSUMED.
 * `SessionComponent.id` is typed `SessionComponentKind`, a closed union of ten
 * colon-free literals, and every id `getSessionComponents` emits is one of them
 * verbatim — so a part id carries exactly one colon. (The colon-bearing
 * `${sourceIdentity}:${movedKind}-component` id in `sessionComponents.ts` is a
 * WORKOUT id and never becomes a component id;
 * docs/DAY_FIRST_UI_UNIT_PLAN_2026-08-07.md §2e records the check.) The
 * first-colon rule below is written anyway, because it costs nothing and it is
 * the rule that stays correct if a date format ever grows one.
 */
export function partIdFor(date: string, componentId: string): string {
  return `${date}:${componentId}`;
}

/**
 * The component half of a part id.
 *
 * An id with no separator is returned whole rather than emptied: the callers are
 * lookups against a saved outcome, and a silently-blank key would read as "this
 * component was never done" — a wrong answer dressed as a real one.
 */
export function componentIdFromPartId(partId: string): string {
  const separator = partId.indexOf(':');
  return separator < 0 ? partId : partId.slice(separator + 1);
}

function partsForWorkout(
  date: string,
  workout: Workout | null | undefined,
  onDay: VisibleDayKind,
): ProjectedDayParts['parts'] {
  if (!workout) return [];
  return getSessionComponents(workout).map((component) => {
    const componentId = String(component.id);
    const kind = partKind(componentId, onDay);
    return {
      id: partIdFor(date, componentId),
      kind,
      capabilities: partCapabilities(componentId, kind, onDay),
      countsTowardLoad: PART_COUNTS_TOWARD_LOAD[kind],
    };
  });
}

/**
 * THE STRUCTURAL PROJECTION — one derivation, no vocabulary.
 *
 * This is what the surface-agreement cells consume: parts conservation (L-P3) and
 * capability parity (L-P4) are structural claims, and arming them must not wait on
 * copy rulings.
 */
export function projectParts(args: {
  week: readonly ResolvedDay[];
  weekStart: string;
}): ProjectedWeekParts {
  return {
    weekStart: args.weekStart,
    days: args.week.map((day) => {
      const kind = dayKind(day);
      const parts = partsForWorkout(day.date, day.workout, kind);
      const isFixture = kind === 'game';
      return {
        date: day.date,
        kind,
        owner: dayOwner(day),
        parts,
        capabilities: {
          // A day with room for more work can take more, whatever is on it
          // already. No recovery exception: ruling 3.
          canAdd: !isFixture,
          // THE MOVE DOOR IS OPEN IFF SOMETHING CAN LEAVE THIS DAY. Not "the
          // whole day travels intact" — a combined day offers a SCOPED move and
          // the anchor stays put, which is a move by any name the athlete uses.
          // See `DayCapabilities` for why the field is still called
          // `canMoveWholeDay`.
          canMoveWholeDay: !isFixture && parts.some((part) => part.capabilities.canMove),
          // THE REMOVE DOOR IS OPEN IFF THE DAY HOLDS ANYTHING. Removing the
          // whole day takes everything on it, add-ons and appointments included
          // — the day becomes rest — so this asks whether there is anything
          // there, not whether every part could be removed on its own. A fixture
          // is the one thing the athlete cannot take off their week.
          canRemoveWholeDay: !isFixture && parts.length > 0,
        },
      };
    }),
  };
}

/**
 * THE FULL PROJECTION — structure plus the athlete's words.
 *
 * Raises `UnsignedCopyError` for any day or part whose words are not yet in the
 * signed-copy sheet. That is deliberate and is the whole value of the branded
 * type: the alternative is composing text, which is the defect. Callers during the
 * migration use `projectParts` for structural work and adopt `project` per surface
 * as batches land.
 */
export function project(args: {
  week: readonly ResolvedDay[];
  weekStart: string;
}): VisibleWeek {
  const structural = projectParts(args);
  return {
    weekStart: structural.weekStart,
    days: structural.days.map((day, index): VisibleDay => {
      const source = args.week[index];
      // The words half owns row composition — see `ProjectedDayParts.parts`.
      const composed = source.workout
        ? composeDayDetail(source.workout, source.workout)
        : null;
      return {
        date: day.date,
        kind: day.kind,
        owner: day.owner,
        headline: dayHeadline(day.kind, source),
        parts: day.parts.map((part): VisiblePart => {
          const rows = composed ? rowsForKind(part.kind, composed) : [];
          return {
            ...part,
            rows,
            headline: partHeadline(part.kind, source.workout, rows),
            bucket: partBucket(part.kind, source.workout),
            // Ambiguity resolution (Sam, as controller, 2026-07-31): populate from
            // a part's existing signed sub-line where one exists, otherwise null —
            // do not invent prose. No reliable authored sub-line source is wired to
            // an arbitrary part yet, so every part gets `null` in this task; a
            // future task can wire one in (e.g.
            // `ConditioningVisibleIdentity.doseLabel`) without this shape changing.
            detail: null,
          };
        }),
        capabilities: {
          ...day.capabilities,
          refusal: day.capabilities.canAdd || day.parts.length > 0
            ? null
            : signedCopy('day.refusal.nothing_to_change'),
        },
      };
    }),
  };
}

/**
 * A day's one name.
 *
 * Looked up by KIND, not composed from its parts — "Recovery + Recovery Session"
 * was a composition, and a composition is what a day headline must never be. The
 * parts carry their own headlines and the surfaces render both; the day's name
 * says what kind of day it is and nothing more.
 *
 * ONE VARIANT, SIGNED (Sam, 2026-07-31): a fixture that is a practice match reads
 * its own signed word. Still a LOOKUP, still not a composition — `dayIsPracticeMatch`
 * is a typed read of the same `workoutType` set `dayIsFixture` uses, and it selects
 * between two registered ids rather than assembling text. The KIND is unchanged, so
 * nothing downstream of `dayKind` can tell the difference.
 */
function dayHeadline(kind: VisibleDayKind, day: ResolvedDay): SignedCopy {
  if (kind === 'game' && dayIsPracticeMatch(day)) {
    return signedCopy('day.headline.practice_match');
  }
  return signedCopy(`day.headline.${kind}`);
}

/**
 * WHICH BUCKET EACH KIND OF WORK BELONGS TO.
 *
 * Sam's ruling, 2026-08-08. Every kind maps to itself except one:
 *
 * **POWER IS NOT A BUCKET.** Sam, verbatim: *"power should not be labelled there
 * for just 1 exercise — power is just part of the Strength work."* A day whose
 * leading part is a power component is a STRENGTH day to the athlete, and the
 * word "Power" never reaches a week row or a day title again.
 *
 * IT IS A TABLE, NOT AN `if`. The next question of this shape — is `speed` its
 * own bucket, is `support` — is answered by editing one row that the type system
 * forces to be complete, rather than by finding the branch that hid the last
 * answer. `speed` IS its own bucket, which is Sam's ruling too and is why it is
 * written here rather than assumed.
 */
const PART_BUCKET_KIND: Readonly<Record<VisiblePartKind, VisiblePartKind>> = {
  strength: 'strength',
  power: 'strength',
  conditioning: 'conditioning',
  speed: 'speed',
  support: 'support',
  recovery: 'recovery',
  team_training: 'team_training',
  game: 'game',
};

/**
 * A part's BUCKET — the category word, for the surfaces that name a whole day.
 *
 * The week row and the day title say what KIND of work the day holds; the
 * timeline says which one. So this resolves the same two-step `partHeadline`
 * does, minus the specific-name step in the middle:
 *
 *   1. A CHARTER OPTIONAL TYPE IS ALREADY A BUCKET, and keeps its own word.
 *      "Gunshow", "Mobility" and "Accessories" are the Add-menu's doors and
 *      three of the seven bucket words Sam listed; an athlete who tapped
 *      Gunshow must not find their day filed under "Strength". This is the same
 *      precedence `partHeadline` gives them, for the same reason.
 *   2. Otherwise the kind's own generic word, through `PART_BUCKET_KIND`.
 *
 * WHAT IT DELIBERATELY NEVER DOES is look at the resolved strength variant. That
 * step is the whole difference between the two functions: "Upper Push" is a name,
 * "Strength" is a bucket, and a surface that wanted the bucket used to get the
 * name because there was only one field to ask for.
 */
function partBucket(kind: VisiblePartKind, workout: Workout | null | undefined): SignedCopy {
  const optional = workout?.composedOptionalKind;
  if (optional && (kind === 'strength' || kind === 'recovery')) {
    return signedCopy(`part.headline.optional.${optional}`);
  }
  return signedCopy(`part.headline.${PART_BUCKET_KIND[kind]}`);
}

/**
 * A part's one name.
 *
 * Looked up by KIND first (`part.headline.<kind>`, a generic fallback that
 * always resolves), with ONE specific-name resolution ahead of it: a strength
 * part's name is the pinned `canonicalStrengthLabel` output for its own typed
 * `strengthIntent` — reusing `resolveSessionDisplayName`, the EXISTING single
 * naming authority (`sessionNaming.ts`), rather than re-deriving movement
 * patterns here and becoming a second one. When that authority's answer is not
 * one of the seven pinned names (a gunshow/prehab/mobility variant, or a
 * legacy session with no typed intent), it falls through to the generic
 * "Strength" fallback rather than passing unregistered text through — see
 * `projectionCopy.ts`'s module header ("SCOPE NOTE") for why conditioning gets
 * the same generic treatment rather than a specific resolution in this task.
 */
function partHeadline(
  kind: VisiblePartKind,
  workout: Workout | null | undefined,
  rows: readonly VisibleRow[],
): SignedCopy {
  // A CHARTER OPTIONAL TYPE NAMES ITSELF (2026-08-01, device-pass fail 2).
  // The typed `composedOptionalKind` the builder now stamps outranks both the
  // strength resolution and the generic kind fallback: an athlete who tapped
  // the Gunshow / Accessories / Mobility door reads that door's word on the
  // part, never "Strength" (the honest-generic fallback) and never "Recovery"
  // (the deleted type a mobility session's `workoutType` still wears).
  // Scoped to the CONTENT part kinds a composed optional session produces —
  // its trunk rows still classify `support` and keep "Midline Work" (the
  // part-composition question is audited, not silently re-answered here), and
  // a `team_training` part on a combined day is never the optional session.
  const optional = workout?.composedOptionalKind;
  if (optional && (kind === 'strength' || kind === 'recovery')) {
    return signedCopy(`part.headline.optional.${optional}`);
  }
  if (kind === 'strength') {
    // `focus`/`name` are deliberately NOT passed. `resolveSessionDisplayName`'s
    // last-resort precedence step is a cleaned pass-through of exactly those
    // fields, and that pass-through is defect 3's mechanism (planner-internal
    // text like "aerobic conditioning component" reaching a headline via a
    // punctuation tidier — see `surfaceAgreementTests.ts` cell 3, and this
    // module's own header). Omitting them means this call can only ever
    // return one of the pinned strength labels or fall through to `partHeadline`'s
    // own generic fallback below — never composed/pass-through text. Do not
    // add them back without re-closing that path.
    const resolved = resolveSessionDisplayName({
      strengthIntent: workout?.strengthIntent,
      exercises: rows.map((row) => ({ name: row.name })),
      isTeamDay: false,
      tier: 'core',
    }).trim();
    const id = STRENGTH_HEADLINE_ID_BY_LABEL.get(resolved);
    if (id) return signedCopy(id);
  }
  return signedCopy(`part.headline.${kind}`);
}
