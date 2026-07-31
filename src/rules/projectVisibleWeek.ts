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
  exerciseCueCopyId,
  exerciseNameCopyId,
  registerProjectionCopy,
  STRENGTH_HEADLINE_ID_BY_LABEL,
} from './projectionCopy';
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
  readonly parts: readonly Omit<VisiblePart, 'headline' | 'detail' | 'rows'>[];
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
const FIXTURE_WORKOUT_TYPES: ReadonlySet<string> = new Set(['Game', 'Practice Match']);

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
  if (APPOINTMENT_COMPONENTS.has(componentId) || kind === 'team_training') {
    return { canSwap: false, canMove: false, canRemove: true, canEditRows: false };
  }
  return { canSwap: true, canMove: true, canRemove: true, canEditRows: true };
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
    return min === max
      ? signedCopy('row.prescription.sets_reps', { sets, reps: min })
      : signedCopy('row.prescription.sets_reps_range', { sets, min, max });
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
 * (`artifacts/COPY_SHEET_RULINGS_2026-07-30.md` batch 2, ruling 1): "an
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
 * `sessionBuilder.condEx` — the one constructor for conditioning, sprint and
 * speed rows — stamps `exerciseType: 'Cardio'` on everything it makes, and what
 * it makes is not an exercise from a vocabulary: it is a sentence assembled at
 * build time out of numbers, modality words and planner nouns ("Aerobic
 * conditioning component (3 x 8min zone 2 Mixed Erg Block)", "Assault Bike
 * warm-up", "Quality speed warm-up (short)"). Every other row on a generated day
 * names an exercise from the locked vocabulary (`selectableExerciseVocabulary.ts`,
 * exercise-name-literal-lock unit), and a template-placed row names one from the
 * addable-content registry — both authored, both registered.
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
  return String(row?.exercise?.exerciseType ?? '') === 'Cardio';
}

function toVisibleRows(rows: readonly any[]): VisibleRow[] {
  return rows
    .filter((row) => !isComposedPrescriptionRow(row))
    .map((row, index) => ({
      id: String(row?.id ?? `${index}`),
      name: rowName(row),
      prescription: prescriptionCopy(row),
      cue: rowCue(row),
    }));
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
      id: `${date}:${componentId}`,
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
 */
function dayHeadline(kind: VisibleDayKind, _day: ResolvedDay): SignedCopy {
  return signedCopy(`day.headline.${kind}`);
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
