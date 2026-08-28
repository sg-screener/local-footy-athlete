/**
 * THE FINAL AUTHORED CANDIDATE — composer strength plus the retained adapters,
 * merged by day. Pure. This is the week §18 is handed.
 *
 * **THE SEPARATION IS THE POINT.** `materialiseComposedWeek` owns every strength
 * row and reinterprets nothing. The conditioning and warm-up adapters keep their
 * existing behaviour and are NOT redesigned — they are simply asked for the days
 * the composer does not author, and their output is merged rather than passed
 * through the legacy builder to be re-dosed.
 *
 * **MEASURED FEASIBILITY, 2026-08-14:** of 143 composed strength days across the
 * 61 built worlds, **16 carry a conditioning block and ZERO carries a warm-up
 * row**. So a combined strength+conditioning day merges the adapter's block onto
 * the composed day, and **no warm-up abstraction is built to represent nothing** —
 * the zero is measured and reported instead.
 */
import type { AuthoredDayIdentity, Workout } from '../types/domain';

/** Where a non-composer row or block came from. Never "it fills no ladder slot". */
export type RetainedAdapterOwner = 'conditioning_adapter' | 'warmup_adapter' | 'planner_day';

export interface AssembleAuthoredWeekInput {
  /** Composer-owned strength days. Authoritative; never edited here. */
  readonly composerWorkouts: readonly Workout[];
  /**
   * The retained adapters' output for the days the composer does not author,
   * plus the conditioning blocks belonging to combined days.
   */
  readonly adapterWorkouts: readonly Workout[];
}

export interface AuthoredWeek {
  readonly workouts: readonly Workout[];
  /** Provenance census — every row and block, with its owner named. */
  readonly provenance: readonly {
    readonly dayOfWeek: number;
    readonly owner: 'composer' | RetainedAdapterOwner;
    readonly rows: number;
    readonly hasConditioningBlock: boolean;
  }[];
  /**
   * Strength rows on a composed day that the composer did not declare.
   * **The slice's acceptance gate asserts this is 0.** Anything else means the
   * retained adapter is still authoring lifts.
   */
  readonly retainedStrengthRows: number;
}

/** Roles the COMPOSER owns. Every other row on the day is the adapter's. */
const COMPOSER_OWNED_ROLES = new Set(['main_strength', 'strength_accessory']);

function rowRole(row: unknown): string | null {
  const typed = row as { section18Evidence?: { role?: string }; role?: string };
  return typed.section18Evidence?.role ?? typed.role ?? null;
}

/**
 * ⚠ THE COMPOSER DAY IS THE BASE. THE ADAPTER CONTRIBUTES, IT DOES NOT HOST.
 *
 * **THIS IS THE THIRD STRIPPED-ADAPTER SIGHTING AND THE LAST ONE THIS SHAPE CAN
 * PRODUCE.** The history is worth keeping because each fix was narrower than the
 * defect:
 *
 *   1. the merge copied ONE field (`conditioningBlock`) and threw the rest of
 *      the adapter's day away — losing `speedBlock`, the app's only source of
 *      app sprint credit, and costing a refusal that got blamed on an inert
 *      envelope for three sessions;
 *   2. so the merge took the adapter's WHOLE day as the base — and a day
 *      stripped of its lifts describes itself as `Conditioning` /
 *      `optional_flush`, costing 12 worlds;
 *   3. and even after identity was pinned back, `...adapter` still silently
 *      decided which composer fields survived. **`composedGaps` — the typed
 *      record of what this athlete's kit cannot train — was dropped on every
 *      day that had an adapter counterpart**, because it was simply not in the
 *      list of fields copied back.
 *
 * **A SPREAD IS THE DEFECT.** Each round fixed the field that had just been
 * noticed while leaving the mechanism that loses fields intact. So the merge no
 * longer spreads an adapter workout at all: the adapter's contribution is a
 * TYPED, ENUMERATED object, and anything not named in it cannot travel.
 *
 * LAW-generated-week-assembly (Sam, 2026-08-14): *"Adapter contributions are
 * typed and enumerated. The composer day is always the base. No adapter field
 * may overwrite a composer-owned field."*
 */

/** Fields the COMPOSER owns. An adapter contribution may never carry these. */
export const COMPOSER_OWNED_FIELDS: readonly string[] = [
  'id', 'microcycleId', 'dayOfWeek',
  'name', 'description', 'sessionTier', 'intensity', 'planEntryId',
  'exercises', 'composedGaps', 'strengthIntent',
];

/**
 * EVERYTHING THE RETAINED ADAPTER IS ALLOWED TO CONTRIBUTE, named one by one.
 *
 * Adding a field here is a deliberate act with a reviewer; a field that is not
 * here cannot reach a composed day by accident, which is precisely what the
 * three sightings above each did.
 */
export interface AdapterContribution {
  /** Conditioning the adapter hung on this day. */
  readonly conditioningBlock?: unknown;
  readonly conditioningCategory?: unknown;
  readonly conditioningFlavour?: unknown;
  readonly section18ConditioningRole?: Workout['section18ConditioningRole'];
  readonly attachedConditioningKind?: unknown;
  readonly conditioningFeasibility?: unknown;
  readonly hasCombinedConditioning?: boolean;
  /** THE SPRINT NIGHT. The field whose loss started this whole history. */
  readonly speedBlock?: unknown;
  /** The team-training anchor fact about the day. */
  readonly isTeamDay?: boolean;
  /**
   * THE SCHEDULER'S TYPED DAY IDENTITY, as the adapter stamped it.
   *
   * It is a contribution rather than something read off the composer's day
   * because **the composer only ever authors the strength half** — it does not
   * know the day is a club night or the fixture. The adapter does, and this is
   * the channel by which it says so without also handing over the whole day.
   */
  readonly authoredDay?: AuthoredDayIdentity;
  /** Typed lifecycle ownership for derived sessions. */
  readonly derivedSessionProvenance?: unknown;
  /** The PLANNER's declared strength intent; the composer emits none. */
  /** The conditioning envelope — carried only when conditioning was contributed. */
  readonly section18Evidence?: unknown;
  /** Adapter-authored duration; the composer does not compute one. */
  readonly durationMinutes?: number;
  /** Non-strength rows (power, conditioning, mobility) in the adapter's order. */
  readonly rows: readonly unknown[];
}

/** THE ONLY FIELDS AN ADAPTER CONTRIBUTION MAY NAME. */
const ADAPTER_CONTRIBUTED_FIELDS: readonly string[] = [
  'conditioningBlock', 'conditioningCategory', 'conditioningFlavour', 'section18ConditioningRole',
  // ⚠ `conditioningOffFeet` was ABSENT from this list, so the merge silently
  // dropped it on every composer day: the scheduler typed `off_leg` (WC-115,
  // lower + conditioning), the adapter stamped it, and the athlete's week said
  // `undefined`. The other conditioning fields were all here — it is the one
  // that says the block is deliberately OFF THE LEGS, which on a lower day is
  // the whole point of pairing it.
  'conditioningOffFeet',
  'attachedConditioningKind', 'conditioningFeasibility', 'hasCombinedConditioning',
  'speedBlock', 'isTeamDay', 'derivedSessionProvenance',
  'section18Evidence', 'durationMinutes', 'authoredDay',
];

/**
 * The workout type an ANCHOR forces, or null when the day carries no anchor.
 *
 * Only the anchor is answered here. What a non-anchor day should be called
 * depends on what got merged onto it, and that is the merge's business — this
 * function exists solely to say "not yours to rename".
 */
function anchorWorkoutType(
  authored: AuthoredDayIdentity | undefined,
): 'Game' | 'Team Training' | null {
  if (authored?.anchor === 'game') return 'Game';
  if (authored?.anchor === 'club_training') return 'Team Training';
  return null;
}

/**
 * Read the adapter's day down to what it is ALLOWED to give. Everything else
 * about that day — its identity, its type, its tier — stays behind.
 */
export function adapterContributionFrom(adapter: Workout | undefined): AdapterContribution {
  if (!adapter) return { rows: [] };
  const source = adapter as unknown as Record<string, unknown>;
  const contribution: Record<string, unknown> = {};
  for (const field of ADAPTER_CONTRIBUTED_FIELDS) {
    if (source[field] !== undefined) contribution[field] = source[field];
  }
  // The envelope describes the adapter's CONDITIONING. With no conditioning
  // contributed it is a statement about nothing, and a stale `optional_flush`
  // on a strength day is a false one — `null` and `conditioningRole: 'none'`
  // are the same statement anyway (`section18EffectiveWeekEvaluator.ts:317-318`).
  if (!source.conditioningBlock) {
    delete contribution.section18Evidence;
    delete contribution.section18ConditioningRole;
    delete contribution.conditioningCategory;
    contribution.hasCombinedConditioning = false;
  }
  return {
    ...contribution,
    rows: (adapter.exercises ?? []).filter(
      (row) => !COMPOSER_OWNED_ROLES.has(rowRole(row) ?? '')),
  } as AdapterContribution;
}

/** Thrown when a contribution reaches for a field the composer owns. */
export class AdapterOverreachError extends Error {
  readonly code = 'adapter_contribution_overreach';

  constructor(fields: readonly string[]) {
    super('LAW-generated-week-assembly: an adapter contribution named '
      + `composer-owned field(s) [${fields.join(', ')}]. The composer day is `
      + 'always the base and no adapter field may overwrite a composer-owned one.');
    this.name = 'AdapterOverreachError';
  }
}

function applyContribution(composed: Workout, contribution: AdapterContribution): Workout {
  // ⚠ THE GUARD THAT MAKES A FOURTH SIGHTING IMPOSSIBLE. It is not a check on
  // one field; it refuses the whole CLASS by refusing any contribution that
  // names a composer-owned key at all.
  const overreach = Object.keys(contribution)
    .filter((key) => key !== 'rows')
    .filter((key) => COMPOSER_OWNED_FIELDS.includes(key));
  if (overreach.length > 0) throw new AdapterOverreachError(overreach);

  const { rows: adapterRows, ...fields } = contribution;
  const composerRows = composed.exercises ?? [];
  // Power leads, then the lifts, then everything else the day carries — the
  // order the app renders and the counting fence expects.
  const power = adapterRows.filter((row) => rowRole(row) === 'power');
  const rest = adapterRows.filter((row) => rowRole(row) !== 'power');
  const exercises = [...power, ...composerRows, ...rest]
    .map((row, index) => ({ ...(row as object), exerciseOrder: index + 1 }));

  return {
    // THE COMPOSER DAY IS THE BASE. `composedGaps`, identity, tier, intensity
    // and the strength rows survive because nothing overwrites them — not
    // because they were remembered in a copy list.
    ...composed,
    ...fields,
    // ⚠ A DAY CARRYING BOTH IS `Mixed`, AND THE BOOT ALREADY KNEW THAT. This is
    // a DERIVED consequence of the contribution, not the adapter overwriting an
    // identity: `programHydrationProjection` retypes such a day at the store
    // boundary regardless, and leaving the composer's `Strength` here made
    // generation and relaunch disagree on exactly one field.
    // ── AN ANCHOR'S IDENTITY IS NOT THE MERGE'S TO CHANGE ──────────────────
    //
    // **Sam, 2026-08-15:** *"anchors pass through unchanged"* / *"no layer
    // replaces an entire scheduler-authored day"*.
    //
    // The line below used to be the whole answer, and it is the reason a club
    // night reached the athlete as "Mixed": the composer had authored strength
    // on the same day, the adapter had correctly built it as the club anchor,
    // and the merge — knowing only that the day now held two things — retyped
    // it. **Adding gym work to a club night does not stop it being a club
    // night.** So when the day's owner declared an anchor, that answer stands
    // and the combined typing applies only below it.
    //
    // Read off the TYPED identity the adapter stamped, never off the workout's
    // name or type string — matching on "Team Training" would fix exactly the
    // days that happen to be spelled that way.
    workoutType: anchorWorkoutType(contribution.authoredDay)
      ?? (fields.conditioningBlock ? 'Mixed' : composed.workoutType),
    // THE NAME IS PART OF THE IDENTITY, and it was being lost separately: the
    // fixture reached the athlete typed `Game` and NAMED "Strength Session",
    // and a club night was named with the composer's raw purpose token. The
    // athlete reads the name, so an anchor whose name says something else is
    // still a lost anchor. Same typed source, so the two cannot disagree.
    name: anchorWorkoutType(contribution.authoredDay) ?? composed.name,
    // Carried so the same defence still has something to read after assembly.
    ...(contribution.authoredDay ? { authoredDay: contribution.authoredDay } : {}),
    exercises,
  } as Workout;
}


/**
 * THE GUARD'S OWN DOOR. `applyContribution` is private because callers must go
 * through `assembleAuthoredWeek`; the assembly guard has to be reachable to be
 * mutation-proven against EVERY composer-owned field, and a guard nobody can
 * aim at is a guard nobody has checked.
 */
export function __applyContributionForTest(
  composed: Workout,
  contribution: AdapterContribution,
): Workout {
  return applyContribution(composed, contribution);
}

export function assembleAuthoredWeek(input: AssembleAuthoredWeekInput): AuthoredWeek {
  const composedDays = new Set(input.composerWorkouts.map((workout) => workout.dayOfWeek));
  const adapterByDay = new Map(
    input.adapterWorkouts.map((workout) => [workout.dayOfWeek, workout]),
  );

  const merged = input.composerWorkouts.map((workout) =>
    applyContribution(workout, adapterContributionFrom(adapterByDay.get(workout.dayOfWeek))));
  // Days the composer does not author — conditioning, team training, the
  // fixture, mobility — arrive from the retained adapters unchanged.
  const adapterOnly = input.adapterWorkouts.filter(
    (workout) => !composedDays.has(workout.dayOfWeek));

  const workouts = [...merged, ...adapterOnly].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const provenance = workouts.map((workout) => ({
    dayOfWeek: workout.dayOfWeek,
    owner: composedDays.has(workout.dayOfWeek)
      ? ('composer' as const)
      : ('planner_day' as const),
    rows: (workout.exercises ?? []).length,
    hasConditioningBlock:
      !!(workout as unknown as { conditioningBlock?: unknown }).conditioningBlock,
  }));
  // THE GATE THIS FILE EXISTS TO MAKE CHECKABLE: after assembly, not one
  // strength row on a composed day may belong to the retained adapter.
  const retainedStrengthRows = workouts
    .filter((workout) => composedDays.has(workout.dayOfWeek))
    .flatMap((workout) => workout.exercises ?? [])
    .filter((row) => COMPOSER_OWNED_ROLES.has(rowRole(row) ?? '')
      && (row as unknown as { section18Evidence?: { provenance?: string } })
        .section18Evidence?.provenance !== 'composer_declaration').length;
  return { workouts, provenance, retainedStrengthRows };
}
