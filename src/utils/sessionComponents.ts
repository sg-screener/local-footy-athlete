import type { UserRemovalScope, Workout } from '../types/domain';
import type { ResolvedDay } from './sessionResolver';
import {
  snapshotProjectedDay,
  type CoachRevisionSectionKind,
  type CoachVisibleSectionSnapshot,
} from './coachRevisionProposal';
import {
  resolveSessionDisplayName,
  strengthComponentDisplayName,
} from './sessionNaming';
import {
  getTeamTrainingWorkoutState,
  isTeamTrainingItem,
} from './teamTraining';
import { composedOptionalClearingPatch } from './composedOptionalMarker';
import { getExerciseTags } from '../data/exerciseTags';
import { resolveExerciseName } from './loadEstimation';
import { hasPowerRow, isPowerRow } from '../rules/sessionRowCounting';

export type SessionComponentKind =
  | 'power'
  | 'strength'
  | 'support'
  | 'conditioning'
  | 'team_training'
  | 'speed'
  | 'finisher'
  | 'recovery_addon'
  | 'recovery'
  | 'session';

export type SessionComponentCompletionPolicy =
  | 'required'
  | 'optional_no_penalty';

export interface SessionComponent {
  id: SessionComponentKind;
  kind: SessionComponentKind;
  label: string;
  completionPolicy: SessionComponentCompletionPolicy;
}

export type AthleteSessionComponentReductionResult =
  | { ok: true; remainingWorkout: Workout | null }
  | { ok: false; code: 'nothing_to_remove' | 'scope_not_on_day' };

const REMOVAL_SECTION_KIND: Partial<Record<UserRemovalScope, CoachRevisionSectionKind>> = {
  strength_component: 'strength',
  conditioning_component: 'conditioning',
  recovery_component: 'recovery',
  team_component: 'session',
};

/**
 * Deterministic component-reduction owner for athlete session deletion.
 *
 * The accepted visible snapshot decides which concrete rows belong to the
 * requested component. This function only removes that typed component and
 * never canonicalises, repairs, authorises templates, or writes state. The
 * accepted-state transaction remains responsible for relocation, Section 18
 * repair, validation, provenance and atomic publication.
 */
export function reduceAcceptedSessionForAthleteRemoval(args: {
  day: ResolvedDay;
  scope: UserRemovalScope;
}): AthleteSessionComponentReductionResult {
  const source = args.day.workout;
  if (!source) return { ok: false, code: 'nothing_to_remove' };
  if (args.scope === 'whole_session') {
    return { ok: true, remainingWorkout: null };
  }

  const snapshot = snapshotProjectedDay(args.day);
  if (!snapshot.workout) return { ok: false, code: 'nothing_to_remove' };
  const removedKind = REMOVAL_SECTION_KIND[args.scope];
  if (!removedKind || !snapshot.workout.sections.some((section) =>
    section.kind === removedKind)) {
    return { ok: false, code: 'scope_not_on_day' };
  }
  const survivingSections = snapshot.workout.sections.filter((section) =>
    section.kind !== removedKind);
  if (survivingSections.length === 0) {
    return { ok: true, remainingWorkout: null };
  }

  // WHAT STAYS IS NAMED FROM ITSELF TOO — the mirror of the rule below for what
  // leaves. This read `splitSessionName(snapshot.workout.title).title`, parsing
  // the day's composed name for a strength half; `strengthComponentDisplayName`
  // derives it from the typed intent and, failing that, from the component's own
  // rows.
  //
  // WHERE THE LAST FALLBACK DIFFERS FROM THE DELETED PARSER — stated because the
  // first version of this comment claimed "byte-identical" and that was FALSE for
  // composed titles. When a day has NEITHER typed intent NOR a classifiable row,
  // the day's own title is returned: identical to the parser for an uncomposed
  // title, but for "Team Training + Upper Push" the parser returned "Upper Push"
  // and this returns the whole string — which after a partial Bin can name the
  // component just removed, in a frozen coach matching key.
  //
  // WHY THAT IS ACCEPTED HERE. The population is a day with a composed title, no
  // `strengthIntent` (present in 29,896 of 30,937 distinct inputs across a whole
  // bible run) AND no row the authored vocabulary can classify — unreachable in
  // every world the harness reaches, and the whole-bible day-name differential is
  // empty across both Bin call sites. Closing it honestly means giving a strength
  // SECTION its own title instead of the day's, and `buildVisibleSections` sets
  // it to `cleanText(workout.name)` in `coachRevisionProposal.ts`, which is on the
  // LR-6 frozen list. Recorded as residual risk with a device-pass line, not
  // patched around here. See `strengthComponentDisplayName`'s docblock.
  const strengthSurvives = survivingSections.some((section) => section.kind === 'strength');
  const survivorTitle = strengthSurvives
    ? strengthComponentDisplayName({
        strengthIntent: source.strengthIntent,
        // THE COMPONENT'S OWN ROWS, NOT THE DAY'S. See `strengthComponentRows`.
        exercises: strengthComponentRows(source, survivingSections),
        fallbackTitle: snapshot.workout.title,
      })
    : survivingSections[0].title || snapshot.workout.title;
  const survivorWorkoutType =
    survivingSections.every((section) => section.kind === 'session')
      ? source.workoutType
      : strengthSurvives
      ? 'Strength'
      : survivingSections.some((section) => section.kind === 'conditioning')
      ? 'Conditioning'
      : 'Recovery';

  return {
    ok: true,
    remainingWorkout: materializeAcceptedVisibleSections({
      source,
      title: survivorTitle,
      workoutType: survivorWorkoutType,
      durationMinutes: snapshot.workout.durationMinutes,
      intensity: snapshot.workout.intensity,
      sections: survivingSections,
    }),
  };
}

export type AthleteSessionComponentSplitResult =
  | { ok: true; movedWorkout: Workout; remainingWorkout: Workout | null }
  | { ok: false; code: 'nothing_to_move' | 'scope_not_on_day' | 'scope_is_whole_day' };

/**
 * Split a day into the component that LEAVES and the day that STAYS.
 *
 * Sam's ruling (2026-07-30): a session-scoped Move on a combined day — take the
 * gym session, leave team training anchored — "same scoping Bin has". Bin's
 * half of that already exists above; this returns BOTH halves from ONE snapshot
 * so the day that stays and the session that leaves cannot disagree about which
 * rows went where. Splitting them across two calls is how a move silently
 * duplicates or drops content.
 *
 * IDENTITY. The remainder keeps the source identity — the day continues to
 * exist — and the departing component takes a deterministic `:<kind>-component`
 * suffix. That is the convention the §18 relocation path already mints (see
 * `componentIdentity` in acceptedStateTransaction), so the move's conservation
 * post-condition can find both halves rather than reading the split as a loss.
 */
export function splitAcceptedSessionForAthleteMove(args: {
  day: ResolvedDay;
  scope: UserRemovalScope;
}): AthleteSessionComponentSplitResult {
  const source = args.day.workout;
  if (!source) return { ok: false, code: 'nothing_to_move' };
  if (args.scope === 'whole_session') return { ok: false, code: 'scope_is_whole_day' };

  const snapshot = snapshotProjectedDay(args.day);
  if (!snapshot.workout) return { ok: false, code: 'nothing_to_move' };
  const movedKind = REMOVAL_SECTION_KIND[args.scope];
  const movedSections = movedKind
    ? snapshot.workout.sections.filter((section) => section.kind === movedKind)
    : [];
  if (!movedKind || movedSections.length === 0) {
    return { ok: false, code: 'scope_not_on_day' };
  }

  const remainder = reduceAcceptedSessionForAthleteRemoval({ day: args.day, scope: args.scope });
  if (remainder.ok === false) return { ok: false, code: remainder.code === 'nothing_to_remove' ? 'nothing_to_move' : 'scope_not_on_day' };

  const sourceIdentity = source.planEntryId ?? source.id;
  const moved = materializeAcceptedVisibleSections({
    source,
    title: movedSections[0].title || snapshot.workout.title,
    workoutType: source.workoutType,
    durationMinutes: snapshot.workout.durationMinutes,
    intensity: snapshot.workout.intensity,
    sections: movedSections,
    // The day keeps its recovery add-on; only the recovery component itself
    // takes one away. See `keepRecoveryAddons`.
    keepRecoveryAddons: movedKind === 'recovery',
  });
  // WHAT LEAVES IS NAMED FROM ITSELF, NOT FROM THE DAY IT LEFT.
  //
  // This used to string-split the composite day name with `splitSessionName`,
  // on the reasoning that "Team Training + Upper Push" yields "Upper Push". It
  // does — but only when the other half is a canonical strength label. When the
  // strength arrived by a later ADD, the day is still called "Team Training +
  // Easy Zone 2 Ski Erg", neither half is a strength label, and the splitter
  // falls back to the LEFT one. So the gym session moved to its destination
  // called "Team Training", was then classified team-only by its own name (its
  // eight rows swallowed as team-training items), and stacking that onto a real
  // team night was refused — the athlete was told his plan could not safely
  // change, about a destination his own menu had just offered him.
  //
  // A parse of a name is not evidence about content. `resolveSessionDisplayName`
  // is the naming owner and derives from typed intent and the actual rows, which
  // is what `fixtureMinimalReplan` already does when it splits a strength
  // component off a day. The composed half is named after it is composed, so the
  // name describes what is really in it.
  //
  // TASK 11 — UNCHANGED, AND THE DIFFERENTIAL IS WHY.
  //
  // This site was never the name channel: it already derives from typed intent
  // and rows, which is what the remainder above was rewired to do. The first
  // draft of Task 11 also routed it through `strengthComponentDisplayName` on
  // the reasoning that one function should answer for both halves of a split —
  // and the whole-bible day-name differential came back with exactly ONE
  // difference, here: a moved component on 2026-08-07 went from "Session" to
  // "Team Training + Upper Pull". The helper's fallback keeps the title the
  // component arrived with, and the title an untyped strength component arrives
  // with is the COMPOSITE DAY NAME — so the "improvement" was the defect the
  // block above exists to prevent, handing a departing gym session a name that
  // says "Team Training" and gets it swallowed as team-training items at its
  // destination. Left exactly as it was.
  //
  // The two functions therefore differ deliberately in ONE respect: what to do
  // when there is no typed evidence. What STAYS keeps the day's title (the day
  // continues to exist under its own name, which is byte-for-byte what the
  // deleted parser returned). What LEAVES must not inherit it.
  const movedWorkout = movedKind === 'strength'
    ? {
        ...moved,
        name: resolveSessionDisplayName({
          strengthIntent: moved.strengthIntent,
          exercises: moved.exercises,
          isTeamDay: false,
          tier: 'core',
        }) || moved.name,
      }
    : moved;
  return {
    ok: true,
    movedWorkout: {
      ...movedWorkout,
      id: `${sourceIdentity}:${movedKind}-component`,
      planEntryId: `${sourceIdentity}:${movedKind}-component`,
    },
    remainingWorkout: remainder.remainingWorkout,
  };
}

/**
 * THE ROWS THAT BELONG TO THE STRENGTH COMPONENT — nobody else's.
 *
 * Introduced by review round 2, and the finding it pays is worth keeping because
 * it is the same mistake twice in one unit. Round 1 fixed
 * `strengthComponentDisplayName` to name a component "from its own rows"; both
 * callers then handed it `workout.exercises` — the PRE-REMOVAL, WHOLE-DAY list,
 * every section combined. The docblock said one thing and the call did another.
 *
 * The consequence is not a cosmetic mislabel. `inferMeaningfulExerciseMovementPatterns`
 * runs over whatever it is given, so ONE unrelated sibling row from a surviving
 * recovery or accessory section widens the pattern set and FABRICATES a canonical
 * label:
 *
 *     two real squat rows + one "Assisted Pull-up" sibling
 *       whole-day list  -> "Full Body Strength"    <- invented, nothing is full-body
 *       component rows  -> "Lower Squat"           <- what the day actually is
 *
 * and that string is written into `workout.name`, a FROZEN coach matching key.
 * A fabricated label is worse than the composed title it replaced: the composed
 * title at least described something that had been on the day.
 *
 * The scoping rule is not new either — `materializeAcceptedVisibleSections`
 * already filters the source rows by the surviving sections' own
 * `items[].exerciseIds` (`wantedExerciseIds`). This is that rule, narrowed to
 * the one section being named, so the name and the rows the survivor actually
 * keeps are derived from the same evidence.
 *
 * An empty result is honest and expected: a strength section whose items carry
 * no ids yields no rows, no patterns, and the caller falls back to the day's
 * title — the residual already recorded above, unchanged.
 */
export function strengthComponentRows(
  source: Workout,
  sections: readonly CoachVisibleSectionSnapshot[],
): Workout['exercises'] {
  const strengthSection = sections.find((section) => section.kind === 'strength');
  if (!strengthSection) return [];
  const ownIds = new Set(strengthSection.items.flatMap((item) => item.exerciseIds));
  if (ownIds.size === 0) return [];
  return (source.exercises ?? []).filter((row: any) =>
    workoutRowIds(row).some((id) => ownIds.has(id)));
}

function materializeAcceptedVisibleSections(args: {
  source: Workout;
  title: string;
  workoutType: string;
  durationMinutes?: number;
  intensity?: string;
  sections: CoachVisibleSectionSnapshot[];
  /**
   * Does the day's recovery ADD-ON belong to this half?
   *
   * THE ADD-ON IS A FACT ABOUT THE DAY, NOT ABOUT A COMPONENT — the same shape
   * as `isTeamDay` above, and it went wrong the same way. `recoveryAddons` is a
   * top-level field, so it was carried by whichever half happened to satisfy
   * `hasRecovery`; on a day of strength + conditioning + team training NEITHER
   * half does, and moving the gym session silently deleted the athlete's
   * mobility work. `deviceFindingsReplayTests` caught it as a scoped move
   * taking `recovery_addon` with it.
   *
   * It was invisible until Sam's charter (2026-07-30) stopped the generator
   * filling spare days: the add-on used to land on the standalone recovery
   * session the app placed, so a strength day rarely carried one.
   *
   * Default `true` keeps every existing caller's behaviour for the half that
   * STAYS; the half that LEAVES passes false unless it is the recovery
   * component itself.
   */
  keepRecoveryAddons?: boolean;
}): Workout {
  const strength = args.sections.find((section) => section.kind === 'strength');
  const conditioning = args.sections.find((section) => section.kind === 'conditioning');
  const recovery = args.sections.find((section) => section.kind === 'recovery');
  const session = args.sections.find((section) => section.kind === 'session');
  const hasStrength = !!strength;
  const hasConditioning = !!conditioning;
  const hasRecovery = !!recovery;
  const hasSession = !!session;
  const wantedExerciseIds = new Set(args.sections.flatMap((section) =>
    section.items.flatMap((item) => item.exerciseIds)));
  const conditioningExerciseIds = sourceConditioningExerciseIds(args.source);

  let exercises = (args.source.exercises ?? []).filter((row: any) => {
    const ids = workoutRowIds(row);
    const isConditioning = ids.some((id) => conditioningExerciseIds.has(id));
    if (isConditioning && !hasConditioning && !hasRecovery) return false;
    if (!isConditioning && !hasStrength) return false;
    if (wantedExerciseIds.size === 0) return true;
    return ids.some((id) => wantedExerciseIds.has(id));
  });

  const nextConditioningBlock = hasConditioning || hasRecovery
    ? filterAcceptedConditioningBlock(args.source, conditioning ?? recovery, exercises)
    : undefined;
  if (nextConditioningBlock) {
    const linkedIds = new Set(nextConditioningBlock.options.flatMap((option) =>
      (option.exerciseIds ?? []).map((id: unknown) => String(id))));
    exercises = exercises.filter((row: any) => {
      const ids = workoutRowIds(row);
      const isConditioning = ids.some((id) => conditioningExerciseIds.has(id));
      return !isConditioning || ids.some((id) => linkedIds.has(id));
    });
  }

  const onlyConditioning = !hasStrength && (hasConditioning || hasRecovery);
  const onlyStrength = hasStrength && !hasConditioning && !hasRecovery && !hasSession;
  const onlySession = hasSession && !hasStrength && !hasConditioning && !hasRecovery;
  const title = onlySession
    ? session?.items[0]?.title || args.title || args.source.name
    : args.title || args.source.name;
  const workoutType = onlySession
    ? 'Team Training'
    : onlyConditioning
    ? 'Conditioning'
    : onlyStrength
    ? 'Strength'
    : hasRecovery
    ? 'Recovery'
    : args.workoutType || args.source.workoutType;

  return cloneWorkout(args.source, {
    name: title,
    workoutType: workoutType as Workout['workoutType'],
    // THE ANCHOR IS A FACT ABOUT THE DAY, NOT ABOUT A COMPONENT.
    //
    // `isTeamDay` is what `isTeamTrainingSession` reads, and `cloneWorkout`
    // inherits every field this call does not override — so BOTH halves of a
    // split came out flagged as team days. The consequences were mirror images
    // of each other and both wrong: the half that LEFT was classified team-only
    // (its eight gym rows swallowed as team-training items, renamed "Team
    // Training"), and the half that STAYED was renamed off the anchor, so the
    // athlete's combined Monday reported as conditioning alone and the team
    // night appeared to have travelled with the gym session.
    //
    // `hasSession` is exactly the question "did the team section stay with this
    // half?" — team training snapshots as section kind `session`
    // (REMOVAL_SECTION_KIND maps `team_component` -> `session`). So the anchor
    // travels with the section that represents it and with nothing else. A Bin
    // of the team component drops it; a Bin of anything else keeps it.
    isTeamDay: hasSession,
    durationMinutes: args.durationMinutes ?? args.source.durationMinutes,
    intensity: (args.intensity ?? args.source.intensity) as Workout['intensity'],
    description: onlyConditioning
      ? conditioning?.items[0]?.description ?? args.source.description
      : args.source.description,
    hasCombinedConditioning: hasStrength && !!nextConditioningBlock,
    attachedConditioningKind: nextConditioningBlock
      ? args.source.attachedConditioningKind
      : undefined,
    conditioningFlavour: nextConditioningBlock
      ? args.source.conditioningFlavour ?? 'aerobic'
      : undefined,
    conditioningCategory: nextConditioningBlock
      ? args.source.conditioningCategory ?? 'aerobic_base'
      : undefined,
    conditioningBlock: nextConditioningBlock,
    section18Evidence: nextConditioningBlock
      ? args.source.section18Evidence
      : {
          protocolVersion: 1,
          conditioningRole: 'none',
          conditioningStress: 'unknown',
          provenance: 'explicit_mutation',
        },
    section18ConditioningRole: nextConditioningBlock
      ? args.source.section18ConditioningRole
      : 'none',
    strengthIntent: hasStrength ? args.source.strengthIntent : undefined,
    strengthIntentDiagnostics: hasStrength
      ? args.source.strengthIntentDiagnostics
      : undefined,
    strengthPatternContributions: hasStrength
      ? args.source.strengthPatternContributions
      : undefined,
    recoveryAddons: (args.keepRecoveryAddons ?? true) || hasRecovery
      ? args.source.recoveryAddons
      : undefined,
    coachAddedConditioningLabel: onlyConditioning
      ? title
      : nextConditioningBlock
      ? args.source.coachAddedConditioningLabel
      : undefined,
    exercises,
  });
}

function filterAcceptedConditioningBlock(
  source: Workout,
  section: CoachVisibleSectionSnapshot | undefined,
  exercises: Workout['exercises'],
): Workout['conditioningBlock'] {
  if (!section || !source.conditioningBlock?.options?.length) return undefined;
  const sectionExerciseIds = new Set(section.items.flatMap((item) => item.exerciseIds));
  const exerciseIds = new Set(exercises.flatMap((row: any) => workoutRowIds(row)));
  const options = source.conditioningBlock.options.filter((option: any) =>
    (option.exerciseIds ?? []).some((id: unknown) =>
      sectionExerciseIds.has(String(id)) && exerciseIds.has(String(id))))
    .map((option) => {
      const optionIds = new Set((option.exerciseIds ?? []).map(String));
      const acceptedItem = section.items.find((item) =>
        item.exerciseIds.some((id) => optionIds.has(String(id))));
      return {
        ...option,
        durationMinutes:
          acceptedItem?.prescription?.itemDurationMinutes ??
          acceptedItem?.durationMinutes ??
          option.durationMinutes,
        intensity: (acceptedItem?.prescription?.intensity ?? option.intensity) as any,
      };
    });
  return options.length > 0 ? { ...source.conditioningBlock, options } : undefined;
}

function sourceConditioningExerciseIds(workout: Workout): Set<string> {
  const ids = new Set<string>();
  for (const option of workout.conditioningBlock?.options ?? []) {
    for (const id of option.exerciseIds ?? []) ids.add(String(id));
  }
  return ids;
}

function workoutRowIds(row: any): string[] {
  return [row?.id, row?.exerciseId, row?.exercise?.id]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);
}

/**
 * THE THIRD CLONE HELPER. The D13 payment routed "both `cloneWorkout` helpers"
 * through `composedOptionalMarker`; there were three. This one composes the
 * ACCEPTED week's visible sections, so a split or a bin that leaves a composed
 * optional day carrying conditioning is exactly the shape ruling 7-e forbids.
 */
function cloneWorkout(workout: Workout, overrides: Partial<Workout>): Workout {
  return {
    ...workout,
    ...overrides,
    ...composedOptionalClearingPatch(overrides),
    exercises: (overrides.exercises ?? workout.exercises ?? []).map((row: any) => ({
      ...row,
      exercise: row.exercise ? { ...row.exercise } : row.exercise,
    })),
    coachNotes: overrides.coachNotes ?? (
      workout.coachNotes ? [...workout.coachNotes] : undefined
    ),
  };
}

const CONDITIONING_TYPES = new Set([
  'Conditioning',
  'Flush-Out',
  'Sprint-Intervals',
  'Hill-Sprints',
  'MAS-Training',
  'Quality-Sprints',
  'MetCon',
  'Flog-Friday',
  'Long-Run',
  '6x1km',
  'Tempo-Run',
  'Nordic-4x4',
  'MetCon',
]);

const LEGACY_CONDITIONING_KEYWORDS =
  /finisher|zone\s*2|aerobic|tempo|interval|conditioning|repeat\s*effort|threshold|MAS|sprint/i;

function compactText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function workoutNameHasTeamTraining(workout: Partial<Workout> | null | undefined): boolean {
  const name = compactText(workout?.name);
  if (!name) return false;
  return name.split(/\s+\+\s+/).some((part) => part.trim() === 'team training');
}

function workoutTypeHasConditioning(workout: Partial<Workout>): boolean {
  return CONDITIONING_TYPES.has(String(workout.workoutType ?? ''));
}

function isRecoveryWorkout(workout: Partial<Workout>): boolean {
  return workout.workoutType === 'Recovery' || (workout as any).sessionTier === 'recovery';
}

function isStandaloneConditioningWorkout(workout: Partial<Workout>): boolean {
  return workoutTypeHasConditioning(workout) && !isRecoveryWorkout(workout);
}

function hasSpeedBlock(workout: Partial<Workout>): boolean {
  return !!workout.speedBlock;
}

function hasPower(workout: Partial<Workout>): boolean {
  return hasPowerRow(workout);
}

function hasRecoveryAddon(workout: Partial<Workout>): boolean {
  return (workout.recoveryAddons ?? []).some((addon) => addon.exercises.length > 0);
}

/**
 * Typed trunk/support ownership. Core rows remain visible training content,
 * but they are not conditioning phases and do not earn conditioning credit.
 */
export function isTrunkSupportRow(row: any): boolean {
  const name = String(row?.exercise?.name ?? row?.name ?? '').trim();
  if (!name) return false;
  const canonicalName = resolveExerciseName(name);
  return getExerciseTags(canonicalName)?.movement === 'core';
}

function conditioningIdsFromBlock(workout: Partial<Workout>, rows: any[]): Set<string> {
  const ids = new Set<string>();
  const rowIds = new Set(rows.map((row) => row?.id).filter(Boolean));
  const options = ((workout as any).conditioningBlock?.options ?? []) as Array<{
    exerciseIds?: string[];
  }>;

  for (const option of options) {
    for (const id of option.exerciseIds ?? []) {
      if (rowIds.has(id)) ids.add(id);
    }
  }

  return ids;
}

function legacyConditioningTailIds(workout: Partial<Workout>, rows: any[]): Set<string> {
  if (!(workout as any).hasCombinedConditioning || rows.length === 0) return new Set();

  let splitIdx = rows.length;
  for (let i = rows.length - 1; i >= 0; i--) {
    const name = rows[i]?.exercise?.name || '';
    const notes = rows[i]?.notes || '';
    if (LEGACY_CONDITIONING_KEYWORDS.test(name) || LEGACY_CONDITIONING_KEYWORDS.test(notes)) {
      splitIdx = i;
    } else {
      break;
    }
  }

  if (splitIdx >= rows.length) return new Set();
  return new Set(rows.slice(splitIdx).map((row) => row?.id).filter(Boolean));
}

/**
 * Split a day's rows into the populations the app reasons about.
 *
 * POWER IS ITS OWN POPULATION (Sam, 2026-07-28). This function serves two
 * masters — the session screen, which must render every row, and the counters,
 * which must not count power. While power was a block beside the list the two
 * jobs never collided; as a row they would, and `strengthRows` would silently
 * gain main-lift-looking power work. Giving power its own bucket kills that
 * conflation rather than papering over it: renderers ask for `powerRows`,
 * counters ask for `strengthRows`, and neither has to know about the other.
 *
 * The split is by AUTHORED role, before any name or tag probe runs — the same
 * ordering rule the taxonomy's choke point enforces, and for the same reason:
 * `Explosive Push-up` would otherwise read as a strength row here too.
 */
export function getSessionComponentRows(workout: Partial<Workout> | null | undefined): {
  powerRows: any[];
  strengthRows: any[];
  supportRows: any[];
  conditioningRows: any[];
  teamTrainingRows: any[];
} {
  if (!workout) {
    return {
      powerRows: [], strengthRows: [], supportRows: [], conditioningRows: [], teamTrainingRows: [],
    };
  }

  const teamState = getTeamTrainingWorkoutState(workout);
  const allRenderable = (teamState.renderableExercises ?? []).filter(
    (row) => !isTeamTrainingItem(row),
  );
  const powerRows = allRenderable.filter(isPowerRow);
  const renderableRows = allRenderable.filter((row) => !isPowerRow(row));

  const blockConditioningIds = conditioningIdsFromBlock(workout, renderableRows);
  const legacyConditioningIds = blockConditioningIds.size > 0
    ? new Set<string>()
    : legacyConditioningTailIds(workout, renderableRows);
  const conditioningIds = new Set([...blockConditioningIds, ...legacyConditioningIds]);
  // CARD IDENTITY, ONE NAME (Sam, 2026-08-01 — extending ruling 7-e from
  // composed optional sessions to ALL sessions). Support/midline rows inside
  // a strength or conditioning session are CONTENTS, visible inside the
  // session, never card vocabulary: a lower day reads "Lower Body Strength",
  // never "+ Midline Work". "Midline Work" survives ONLY as the identity of
  // a day whose sole content is trunk work — so the trunk split happens
  // exactly when trunk rows are ALL the content rows there are (power rides
  // beside a sole-trunk day unchanged: folding trunk under an invented
  // "Strength" word would be the opposite defect; team anchors are not
  // content). A recovery workout and a marker-carrying composed optional
  // session never split (7-e); everywhere else trunk rows flow into the
  // session's own bucket — strength days keep them in `strengthRows`,
  // standalone conditioning keeps them in `conditioningRows` — so the rows
  // are conserved, re-homed not lost.
  const trunkRows = isRecoveryWorkout(workout) || (workout as Workout).composedOptionalKind
    ? []
    : renderableRows.filter(isTrunkSupportRow);
  const trunkIds = new Set(trunkRows.map((row) => row?.id).filter(Boolean));
  const trunkIsSoleContent = trunkRows.length > 0 &&
    !isStandaloneConditioningWorkout(workout) &&
    conditioningIds.size === 0 &&
    renderableRows.every((row) => trunkIds.has(row?.id));
  const supportRows = trunkIsSoleContent ? trunkRows : [];
  const supportIds = new Set(supportRows.map((row) => row?.id).filter(Boolean));

  const conditioningRows = isStandaloneConditioningWorkout(workout)
    ? renderableRows.filter((row) => !supportIds.has(row?.id))
    : renderableRows.filter((row) => conditioningIds.has(row?.id) && !supportIds.has(row?.id));
  const strengthRows = isStandaloneConditioningWorkout(workout) || isRecoveryWorkout(workout)
    ? []
    : renderableRows.filter((row) => !conditioningIds.has(row?.id) && !supportIds.has(row?.id));

  return {
    powerRows,
    strengthRows,
    supportRows,
    conditioningRows,
    teamTrainingRows: teamState.teamTrainingItems ?? [],
  };
}

export function getSessionComponents(
  workout: Partial<Workout> | null | undefined,
): SessionComponent[] {
  if (!workout) {
    return [{
      id: 'session',
      kind: 'session',
      label: 'session',
      completionPolicy: 'required',
    }];
  }

  const teamState = getTeamTrainingWorkoutState(workout);
  const { strengthRows, supportRows, conditioningRows } = getSessionComponentRows(workout);
  const components: SessionComponent[] = [];

  if (hasPower(workout)) {
    components.push({
      id: 'power',
      kind: 'power',
      label: 'power work',
      completionPolicy: 'required',
    });
  }

  if (hasSpeedBlock(workout)) {
    components.push({
      id: 'speed',
      kind: 'speed',
      label: 'speed work',
      completionPolicy: 'required',
    });
  }

  if (strengthRows.length > 0) {
    components.push({
      id: 'strength',
      kind: 'strength',
      label: 'strength work',
      completionPolicy: 'required',
    });
  }

  if (supportRows.length > 0) {
    components.push({
      id: 'support',
      kind: 'support',
      label: 'midline work',
      completionPolicy: 'optional_no_penalty',
    });
  }

  if (
    conditioningRows.length > 0 ||
    (isStandaloneConditioningWorkout(workout) && !teamState.isTeamTrainingOnly)
  ) {
    const isFinisher = workout.attachedConditioningKind === 'finisher';
    components.push(isFinisher
      ? {
          id: 'finisher',
          kind: 'finisher',
          label: 'finisher',
          completionPolicy: 'optional_no_penalty',
        }
      : {
          id: 'conditioning',
          kind: 'conditioning',
          label: 'conditioning',
          completionPolicy: 'required',
        });
  }

  if (teamState.hasTeamTraining || workoutNameHasTeamTraining(workout)) {
    components.push({
      id: 'team_training',
      kind: 'team_training',
      label: 'team training',
      completionPolicy: 'required',
    });
  }

  if (components.length === 0 && isRecoveryWorkout(workout)) {
    components.push({
      id: 'recovery',
      kind: 'recovery',
      label: 'recovery work',
      completionPolicy: 'required',
    });
  }

  if (hasRecoveryAddon(workout)) {
    components.push({
      id: 'recovery_addon',
      kind: 'recovery_addon',
      label: 'recovery add-on',
      completionPolicy: 'optional_no_penalty',
    });
  }

  if (components.length === 0) {
    components.push({
      id: 'session',
      kind: 'session',
      label: 'session',
      completionPolicy: 'required',
    });
  }

  return components;
}

export function componentQuestionLabel(
  component: SessionComponent,
  componentCount: number,
): string {
  if (component.kind === 'strength') {
    return componentCount === 1
      ? 'Did you complete it?'
      : 'Did you complete the strength work?';
  }
  if (component.kind === 'power') return 'Did you complete the power work?';
  if (component.kind === 'support') return 'Did you complete the midline work?';
  if (component.kind === 'conditioning') return 'Did you complete the conditioning?';
  if (component.kind === 'team_training') return 'Did you complete team training?';
  if (component.kind === 'speed') return 'Did you complete the speed work?';
  if (component.kind === 'finisher') return 'Did you complete the finisher?';
  if (component.kind === 'recovery_addon') return 'Did you complete the recovery add-on?';
  if (component.kind === 'recovery') return 'Did you complete the recovery work?';
  return 'Did you complete it?';
}

function componentReasonSubject(component: SessionComponent): string {
  if (component.kind === 'power') return 'the power work';
  if (component.kind === 'strength') return 'the strength work';
  if (component.kind === 'support') return 'the midline work';
  if (component.kind === 'conditioning') return 'the conditioning';
  if (component.kind === 'team_training') return 'team training';
  if (component.kind === 'speed') return 'the speed work';
  if (component.kind === 'finisher') return 'the finisher';
  if (component.kind === 'recovery_addon') return 'the recovery add-on';
  if (component.kind === 'recovery') return 'the recovery work';
  return 'the session';
}

export function componentSkipReasonLabel(component: SessionComponent): string {
  return `Why did you skip ${componentReasonSubject(component)}?`;
}

export function componentPartialReasonLabel(component: SessionComponent): string {
  return `Why did you only complete part of ${componentReasonSubject(component)}?`;
}

export function feedbackComponentKindForWorkoutType(
  workoutType: string,
): SessionComponentKind | null {
  const type = compactText(workoutType);
  if (type.includes('conditioning') || type.includes('sprint') || type.includes('run')) {
    return 'conditioning';
  }
  if (type.includes('team training')) return 'team_training';
  if (type.includes('recovery')) return 'recovery';
  return 'strength';
}
