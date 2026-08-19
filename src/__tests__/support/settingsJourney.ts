/**
 * THE SETTINGS DOORS — one canonical transaction owner each, walked the way the
 * screen walks it.
 *
 * Sam's mission, 2026-08-20: *"Finish the broader athlete settings and
 * persistence journeys through real production doors"* — season phase, game
 * information, club-training information, permanent gym/equipment availability,
 * and coach/program edits, each of which must preserve unrelated accepted
 * state, survive close/reopen, and affect only the dates and blocks it is
 * supposed to affect.
 *
 * ## WHY THIS SITS BESIDE `athleteJourney.ts` RATHER THAN INSIDE IT
 *
 * `support/athleteJourney.ts` owns the LIFE doors — onboarding, a day passing,
 * a session recorded, a load typed, an exclusion, a rollover, a relaunch. This
 * module owns the SETTINGS doors, and it imports every life door from there
 * rather than copying one. Two harnesses that both know how to install block 1
 * is the same two-representations defect the app itself is being converged out
 * of, so the cold start, the census, the projection read and the relaunch below
 * are all re-exports of the existing owner's.
 *
 * ## THE DOORS, AND WHO IN THE APP CALLS THEM
 *
 * | setting | door | the app's own caller |
 * | --- | --- | --- |
 * | season phase | `commitProfileProgramTransaction({kind:'profile_setup'})` | `useSeasonPhaseControl.execute` (My Status), `ProfileScreen.executeSetupUpdate` |
 * | game information | the same door, same change kind | `ProfileScreen.executeSetupUpdate` |
 * | club-training information | the same door, same change kind | the same two callers |
 * | permanent gym equipment | `commitProfileProgramTransaction({kind:'equipment_answer'})` | `ProfileScreen` -> `EquipmentEditorSheet.onSave` |
 * | SESSION-ONLY equipment | `executeProgramControlActionDurably({type:'set_equipment_modifier', scope:'today_only'})` | `DayWorkoutScreenV2.applySessionEquipment` |
 *
 * ## ⚠ THE PATCH IS NOT WRITTEN HERE, AND THAT IS THE WHOLE POINT
 *
 * `decideProfileSetupChange` (`rules/profileSetupChange.ts`) is the ONE decision
 * behind the Profile setup sheet's Save button. Its own header records why: the
 * screen used to carry two comparisons — one deciding whether Save was enabled,
 * one deciding what got committed — and when they disagreed the athlete got a
 * live-looking button that did nothing. A harness that hand-built its patch
 * would be a third author of that comparison, and it would be unable to see a
 * defect in the real one. So `changeProgramSetup` below assembles the SELECTION
 * the sheet is holding, hands it to the real decider, and commits the patch the
 * decider returns — including refusing when the decider refuses.
 *
 * ## ⚠ AND THE OWNED PHASE IS NOT `profile.seasonPhase`
 *
 * The same header records the second half of that defect: comparing against
 * `profile.seasonPhase` on a phase-skewed device makes re-picking the phase you
 * meant read as "no change", so the rebuild that would repair the skew never
 * runs. `ownSeasonPhase` is the owner and it is what the screen passes.
 * Reproduced here rather than simplified.
 */

import type {
  ConditioningEquipmentModality,
  DayOfWeek,
  EquipmentAnswer,
  EquipmentPossession,
  OnboardingData,
  SeasonPhase,
} from '../../types/domain';
import type { EquipmentTag } from '../../data/exercisePools';

import { commitProfileProgramTransaction } from '../../store/profileProgramTransaction';
import {
  decideProfileSetupChange,
  storedGameDay,
  type ProfileSetupBlockReason,
} from '../../rules/profileSetupChange';
import { ownSeasonPhase } from '../../rules/seasonPhaseOwner';
import { classifyProgramMutationRefusal } from '../../rules/programMutationRefusal';
import { useProfileStore } from '../../store/profileStore';
import { useProgramStore, currentAcceptedBlock } from '../../store/programStore';
import { useBlockSelectionHistoryStore } from '../../store/blockSelectionHistoryStore';
import { getAthleteExclusions } from '../../store/athletePreferencesStore';
import { executeProgramControlActionDurably } from '../../utils/programControlActions';
import { addDaysISO } from '../../utils/programBlockState';
import {
  coldStartThroughOnboarding,
  followTheWeek,
  leaveExerciseOut,
  quiet,
  quietAsync,
  recordDay,
  resolvedDays,
  rolloverIfDue,
  setJourneyClock,
  weekdayName,
  type DayIntent,
  type VisibleDay,
} from './athleteJourney';

// ═══════════════════════════════════════════════════════════════════════════
// THE OUTCOME SHAPE — a refusal is a result, never an exception to swallow
// ═══════════════════════════════════════════════════════════════════════════

export interface SettingsDoorResult {
  /** Did the transaction commit at all? */
  ok: boolean;
  /** Did it change the PROGRAM, or was it a profile-only / no-op save? */
  changedProgram: boolean;
  /** The app's own sentence — the one the athlete would read. */
  message: string;
  /** The machine reason, when there is one. `no_change` is an outcome, not a bug. */
  reason: string | null;
  /**
   * The athlete-facing refusal copy, resolved through the app's OWN classifier.
   *
   * `classifyProgramMutationRefusal` is what both real callers
   * (`useSeasonPhaseControl` and `ProfileScreen.executeSetupUpdate`) put on the
   * screen. Reading it here is how *"display an honest refusal when the new
   * setup cannot form a valid week"* is checked against the sentence the athlete
   * actually gets rather than against an internal code.
   */
  refusalCopy: string | null;
  /** Why the DECIDER would not let Save run at all (setup changes only). */
  blockedBy: readonly ProfileSetupBlockReason[];
  /** What the decider decided to commit. Empty on a refusal or a no-op. */
  patchKeys: readonly string[];
}

function resultFrom(
  raw: { ok: boolean; changedProgram: boolean; message: string; reason?: string },
  patchKeys: readonly string[],
  blockedBy: readonly ProfileSetupBlockReason[] = [],
): SettingsDoorResult {
  const reason = raw.reason ?? null;
  return {
    ok: raw.ok,
    changedProgram: raw.changedProgram,
    message: raw.message,
    reason,
    refusalCopy: raw.ok && raw.changedProgram
      ? null
      : quiet(() => classifyProgramMutationRefusal({ reason: reason ?? undefined }).userMessage),
    blockedBy,
    patchKeys,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SETTING 1-3 — SEASON PHASE, GAME INFORMATION, CLUB TRAINING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * What the Profile setup sheet is holding when Save is pressed.
 *
 * Every field is OPTIONAL and an absent field means *"the athlete did not touch
 * that control"* — the sheet opens pre-filled from the stored profile, so an
 * untouched control still submits its stored value, and that is what is
 * reproduced. Passing only `seasonPhase` therefore models a phase change with
 * everything else left alone, which is exactly the isolated-toggle case the
 * mission asks for.
 */
export interface ProgramSetupEdit {
  seasonPhase?: SeasonPhase;
  preferredDays?: readonly DayOfWeek[];
  /** CLUB TRAINING — the nights the athlete trains with their team. */
  teamDays?: readonly DayOfWeek[];
  /** GAME INFORMATION — the usual game day, or `null` for "no usual day". */
  gameDay?: DayOfWeek | null;
}

/**
 * THE ONE DOOR BEHIND PHASE, GAME AND CLUB — `ProfileScreen`'s own two calls.
 *
 * `executeSetupUpdate` reads `setupDecision.patch` and commits it. This does the
 * same, in the same order, and it hands back what the decider said so a suite
 * can assert on a REFUSAL as easily as on a commit.
 */
export async function changeProgramSetup(args: {
  edit: ProgramSetupEdit;
  todayISO: string;
  /** `phase_shift` for the My Status sheet, `profile_setup` for the Profile sheet. */
  sourceSurface?: 'profile_setup' | 'phase_shift';
}): Promise<SettingsDoorResult> {
  const stored = useProfileStore.getState().onboardingData;
  // THE OWNED PHASE, NEVER `stored.seasonPhase` — see the header.
  const ownedPhase = (quiet(() => ownSeasonPhase({
    program: useProgramStore.getState().currentProgram,
    profile: stored,
  })).phase ?? 'Pre-season') as SeasonPhase;

  const nextPhase = args.edit.seasonPhase ?? ownedPhase;
  const decision = quiet(() => decideProfileSetupChange({
    stored,
    ownedPhase,
    selection: {
      // The sheet opens pre-filled; an untouched control submits its stored value.
      name: String(stored.firstName ?? ''),
      position: (stored.position ?? null) as never,
      experience: (stored.experienceLevel ?? null) as never,
      twoKmSeconds: stored.twoKmTimeTrial?.seconds ?? null,
      twoKmAnswer: stored.twoKmTimeTrial ?? null,
      seasonPhase: nextPhase,
      preferredDays: args.edit.preferredDays
        ?? ((stored.preferredTrainingDays ?? []) as DayOfWeek[]),
      teamDays: args.edit.teamDays ?? ((stored.teamTrainingDays ?? []) as DayOfWeek[]),
      gameDay: args.edit.gameDay !== undefined
        ? args.edit.gameDay
        : storedGameDay(stored),
    },
    lfaDayCountNeedsSync: false,
    storedPosition: (stored.position ?? null) as never,
  }));

  // THE SCREEN'S OWN GATE. `executeSetupUpdate` returns early on `!canUpdateSetup`,
  // so a harness that committed a blocked patch would be walking past the button
  // rather than through it — and `no_changes` is a BLOCK on that button, which is
  // why a genuine no-op is reported here instead of being sent to the transaction.
  if (!decision.canSave) {
    return {
      ok: false,
      changedProgram: false,
      message: 'Save is unavailable on the sheet.',
      reason: decision.blockedBy.join(','),
      refusalCopy: null,
      blockedBy: decision.blockedBy,
      patchKeys: Object.keys(decision.patch),
    };
  }

  const raw = await quietAsync(() => commitProfileProgramTransaction({
    change: { kind: 'profile_setup', patch: decision.patch },
    todayISO: args.todayISO,
    sourceSurface: args.sourceSurface ?? 'profile_setup',
  }));
  return resultFrom(raw as never, Object.keys(decision.patch), decision.blockedBy);
}

// ═══════════════════════════════════════════════════════════════════════════
// SETTING 4 — PERMANENT GYM / EQUIPMENT AVAILABILITY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * THE PERMANENT KIT EDIT — `EquipmentEditorSheet.onSave`'s own single call.
 *
 * R-072: *"you can make permanant changes inside the profile section, or
 * temporary changes to equipment in a session view"*. THREE SCOPES, AND NO
 * FOURTH — this is scope 1. `declareSessionEquipmentMissing` below is scope 2,
 * and the away span (R-018) is scope 3 and belongs to the away flow.
 *
 * The sheet builds `{tags, modalities, answeredOn}` from its own cycling state
 * and commits the WHOLE answer, not a delta — so the helpers below start from
 * the stored answer and return a new whole one, which is what a tick in the
 * sheet actually produces.
 */
export async function changePermanentEquipment(args: {
  answer: EquipmentAnswer;
  todayISO: string;
}): Promise<SettingsDoorResult> {
  const raw = await quietAsync(() => commitProfileProgramTransaction({
    change: { kind: 'equipment_answer', answer: args.answer },
    todayISO: args.todayISO,
    sourceSurface: 'profile_equipment_editor',
  }));
  return resultFrom(raw as never, ['equipmentAnswer']);
}

/**
 * The athlete cycles items in the sheet: unmarked -> HAVE -> NEVER -> unmarked.
 *
 * `EquipmentEditorSheet.cycle` is the owner of that ladder; this reproduces one
 * landing point of it — the sheet's `save()` sends the whole map either way.
 * `possession: undefined` REMOVES the key, which is the sheet's "not today"
 * state and is a different answer from `'never'` (which is a standing "stop
 * offering this"). Both resolve the same for capability; only what the app may
 * offer later differs, and a harness that collapsed them would be unable to see
 * that distinction break.
 */
export function equipmentAnswerWith(args: {
  from: EquipmentAnswer | undefined;
  tags?: Partial<Record<EquipmentTag, EquipmentPossession | undefined>>;
  modalities?: Partial<Record<ConditioningEquipmentModality, EquipmentPossession | undefined>>;
  answeredOn: string;
}): EquipmentAnswer {
  const tags: Record<string, EquipmentPossession> = { ...(args.from?.tags ?? {}) } as never;
  const modalities: Record<string, EquipmentPossession> =
    { ...(args.from?.modalities ?? {}) } as never;
  for (const [key, value] of Object.entries(args.tags ?? {})) {
    if (value === undefined) delete tags[key];
    else tags[key] = value;
  }
  for (const [key, value] of Object.entries(args.modalities ?? {})) {
    if (value === undefined) delete modalities[key];
    else modalities[key] = value;
  }
  return { tags, modalities, answeredOn: args.answeredOn } as EquipmentAnswer;
}

/**
 * SCOPE 2 — *"I don't have this TODAY"*, `DayWorkoutScreenV2.applySessionEquipment`'s
 * own first and only write.
 *
 * ⚠ **THE SCREEN'S SECOND HALF IS GONE AND IS NOT REPRODUCED.** That handler used
 * to follow this fact with a loop of `swap_exercise` actions of its own; it was
 * deleted 2026-08-19 after being measured to produce replacements in 0 of 2,038
 * real door walks, because the dated fact is written FIRST and the composer has
 * already recomposed the day against the reduced kit by the time the screen asks.
 * A harness that added those swaps back would be re-animating a deleted authority.
 */
export async function declareSessionEquipmentMissing(args: {
  dateISO: string;
  tags?: readonly EquipmentTag[];
  modalities?: readonly ConditioningEquipmentModality[];
}): Promise<{ ok: boolean; message: string }> {
  const result = await quietAsync(() => executeProgramControlActionDurably({
    type: 'set_equipment_modifier',
    source: {
      screen: 'session_detail',
      surface: 'session_equipment_sheet',
      initiatedBy: 'tap',
    },
    scope: 'today_only',
    payload: {
      date: args.dateISO,
      todayISO: args.dateISO,
      decision: {
        kind: 'missing_for_session',
        tags: [...(args.tags ?? [])],
        conditioningModalities: [...(args.modalities ?? [])],
      },
    },
    requiresRebuild: false,
    createsActiveModifier: true,
    oneOffOnly: true,
  } as never, { todayISO: args.dateISO }));
  return {
    ok: (result as { ok?: boolean })?.ok === true,
    message: String((result as { message?: string })?.message ?? ''),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// THE CENSUS — everything a settings change must NOT quietly destroy
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The accepted state that is NOT the setting being changed.
 *
 * Every field here is something the mission names as having to survive: the
 * accepted block number, exercise rotation, loads, exclusions, athlete
 * decisions, and the onboarding answers themselves. It is a SNAPSHOT of inputs
 * plus the derived surfaces those inputs are supposed to reproduce — the derived
 * half is included on purpose, because *"the inputs survived"* and *"the athlete
 * sees the same thing"* are two different claims and only the second is what
 * Sam asked for.
 */
export interface SettingsCensus {
  // ── the accepted block ──
  acceptedBlockKeys: readonly string[];
  acceptedBlockNumbers: readonly number[];
  acceptedBlockRequirements: readonly number[];
  /** What boot would restore the athlete to. `null` means a genuinely new athlete. */
  currentBlockNumber: number | null;
  currentBlockStart: string | null;
  liveBlockNumber: number | null;

  // ── the athlete's own decisions and results ──
  feedbackDays: number;
  feedbackWithStrengthLogs: number;
  weightOverrideDays: number;
  weightOverrideEntries: number;
  /** `name@scope` for every live exclusion, sorted — an identity, not a count. */
  exclusions: readonly string[];
  /** `block|slot|name` for every recorded selection, sorted — the rotation input. */
  recordedSelections: readonly string[];

  // ── the onboarding answers, which a settings change may never silently reset ──
  onboardingComplete: boolean;
  seasonPhase: string | null;
  ownedPhase: string | null;
  preferredTrainingDays: readonly string[];
  teamTrainingDays: readonly string[];
  gameDay: string | null;
  /** `tag=possession`, sorted — the permanent kit answer, by identity. */
  equipmentTags: readonly string[];
  equipmentModalities: readonly string[];
  /** Answers this mission never touches; a reset here is the silent-wipe defect. */
  identityAnswers: readonly string[];
}

export function takeSettingsCensus(): SettingsCensus {
  const program = useProgramStore.getState() as unknown as {
    acceptedBlocks?: Record<string, { blockNumber?: number; requiredStrengthSessions?: number }>;
    blockState?: { blockNumber?: number } | null;
    sessionFeedback?: Record<string, { strength?: unknown[] }>;
    weightOverrides?: Record<string, Record<string, unknown>>;
    currentProgram?: unknown;
  };
  const profile = useProfileStore.getState();
  const answers = profile.onboardingData ?? ({} as OnboardingData);
  const accepted = program.acceptedBlocks ?? {};
  const keys = Object.keys(accepted).sort();
  const current = currentAcceptedBlock(accepted as never);
  const feedback = Object.values(program.sessionFeedback ?? {});
  const overrides = program.weightOverrides ?? {};

  return {
    acceptedBlockKeys: keys,
    acceptedBlockNumbers: keys.map((key) => Number(accepted[key]?.blockNumber ?? -1)),
    acceptedBlockRequirements: keys
      .map((key) => Number(accepted[key]?.requiredStrengthSessions ?? -1)),
    currentBlockNumber: current?.blockNumber ?? null,
    currentBlockStart: current?.blockStartDate ?? null,
    liveBlockNumber: program.blockState?.blockNumber ?? null,

    feedbackDays: feedback.length,
    feedbackWithStrengthLogs: feedback.filter((day) => (day?.strength?.length ?? 0) > 0).length,
    weightOverrideDays: Object.keys(overrides).length,
    weightOverrideEntries: Object.values(overrides)
      .reduce((total, day) => total + Object.keys(day ?? {}).length, 0),
    exclusions: (getAthleteExclusions() as readonly {
      exercise?: string; scope?: string;
    }[])
      .map((entry) => `${String(entry.exercise)}@${String(entry.scope)}`)
      .sort(),
    // `identity` is the canonical exercise NAME (`composedRowLegality` types it
    // as a string), so this is the rotation input by identity rather than a
    // count — a count cannot tell "the same 36 selections" from "36 different
    // ones", and the second is what a settings change must never cause.
    recordedSelections: (useBlockSelectionHistoryStore.getState().selections as readonly {
      blockStartISO?: string; slot?: string; identity?: string;
    }[])
      .map((entry) => `${String(entry.blockStartISO)}|${String(entry.slot)}|`
        + `${String(entry.identity)}`)
      .sort(),

    onboardingComplete: Boolean(profile.isOnboardingComplete),
    seasonPhase: (answers.seasonPhase as string | undefined) ?? null,
    ownedPhase: quiet(() => ownSeasonPhase({
      program: program.currentProgram as never,
      profile: answers,
    })).phase ?? null,
    preferredTrainingDays: [...((answers.preferredTrainingDays ?? []) as string[])].sort(),
    teamTrainingDays: [...((answers.teamTrainingDays ?? []) as string[])].sort(),
    gameDay: storedGameDay(answers) ?? null,
    equipmentTags: Object.entries(answers.equipmentAnswer?.tags ?? {})
      .map(([tag, possession]) => `${tag}=${String(possession)}`).sort(),
    equipmentModalities: Object.entries(answers.equipmentAnswer?.modalities ?? {})
      .map(([modality, possession]) => `${modality}=${String(possession)}`).sort(),
    // The answers no settings door in this mission is allowed to touch. Named
    // individually rather than fingerprinted so a red says WHICH answer moved.
    identityAnswers: [
      `firstName=${String(answers.firstName ?? '')}`,
      `position=${String(answers.position ?? '')}`,
      `experienceLevel=${String(answers.experienceLevel ?? '')}`,
      `twoKmSeconds=${String(answers.twoKmTimeTrial?.seconds ?? '')}`,
      `squatStrength=${String(answers.squatStrength ?? '')}`,
      `benchStrength=${String(answers.benchStrength ?? '')}`,
      `trainingLocation=${String(answers.trainingLocation ?? '')}`,
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPARING TWO CENSUSES — a named diff, never a fingerprint
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Which census fields moved, by NAME.
 *
 * A fingerprint comparison answers *"did anything change"* and cannot answer
 * *"did the RIGHT thing change"*, which is the whole question here: a phase
 * change is SUPPOSED to move `seasonPhase` and `ownedPhase` and is supposed to
 * move nothing else. So every assertion in the suite is of the form *"the fields
 * that moved are exactly these"*, and this returns that list.
 */
export function censusDelta(before: SettingsCensus, after: SettingsCensus): string[] {
  const moved: string[] = [];
  for (const key of Object.keys(before) as (keyof SettingsCensus)[]) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) moved.push(String(key));
  }
  return moved.sort();
}

// ═══════════════════════════════════════════════════════════════════════════
// WHAT THE ATHLETE READS — by week, so a change can be scoped to DATES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A comparable print of one week — session names, rows, doses AND loads.
 *
 * ⚠ **LOADS ARE IN THE STRING ON PURPOSE.** The athlete-facing surface does not
 * print `prescribedWeightKg`, so a comparison of names and doses alone is blind
 * to a load change — which is exactly what a settings change must not silently
 * cause. `athleteJourney.resolvedDays` already reads it for the same reason.
 */
export function weekPrint(weekStartISO: string, todayISO: string): string[] {
  return resolvedDays(weekStartISO, todayISO).map((day: VisibleDay) =>
    `${day.weekday}:${day.sessionName ?? '(rest)'}:[`
    + day.rows.map((row) =>
      `${row.name}|${row.sets ?? '-'}|${row.repsMin ?? '-'}-${row.repsMax ?? '-'}`
      + `|${row.weightKg ?? '-'}`).join(',')
    + ']');
}

/** Which weeks the program currently holds — the dates a change may reach. */
export function programWeekStarts(): string[] {
  const program = useProgramStore.getState().currentProgram as
    { microcycles?: readonly { startDate: string }[] } | null;
  return (program?.microcycles ?? []).map((cycle) => String(cycle.startDate).slice(0, 10)).sort();
}

// ═══════════════════════════════════════════════════════════════════════════
// THE TWO ACCEPTED-STATE SHAPES A SETTING IS CHANGED ON TOP OF
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠ **A SETTINGS CHANGE ON A FRESH INSTALL PROVES ALMOST NOTHING.**
 *
 * Process Law L13: *"a harness that only reaches freshly-acted worlds tests a
 * life nobody lives"*, and *"a pass at depth 3 says nothing about depth 43"*.
 * Every claim in this mission — the accepted block number, the loads, the
 * rotation, the exclusions, the athlete's decisions — is a claim about state
 * that only EXISTS once the athlete has lived a block. On a fresh install there
 * is no block 2 to lose, no recorded load to revert, and no exclusion to leak,
 * so a green isolated toggle is green because the world is empty.
 *
 * So the matrix has two shapes, declared separately exactly as L13 requires:
 *
 * - **FRESH** — cold start through real onboarding, block 1 installed, nothing
 *   lived. This is also the mission's NON-SEEDED cold start (Process Law L3).
 * - **WORN** — the same athlete four weeks later: sessions recorded through the
 *   live outcome writer, loads typed, one session missed, a standing exclusion,
 *   and a REAL rollover into block 2.
 *
 * Both are reached by ACTING. Neither is a hand-built store snapshot, which
 * `.claude/rules/suites-and-fixtures.md` deprecates for exactly this work.
 */
export interface WornWorld {
  blockOneStart: string;
  blockTwoStart: string | null;
  /** The last simulated day — where the world's clock is left standing. */
  todayISO: string;
  /** The lift the athlete typed their own number for, derived not named. */
  editedLift: string | null;
  editedKg: number | null;
  /** The lift they said to leave out until they change it, derived not named. */
  excludedLift: string | null;
  daysRecorded: number;
  daysMissed: number;
  rolloverRefusal: string | null;
}

/** The ordinary day: did the work, felt fine, wrote the loads down. */
const DID_THE_WORK: DayIntent = {
  record: true,
  completion: 'full',
  feeling: 'good',
  soreness: 'mild',
  // MIDDLE OF THE 1-10 SCALE. A 1-5 value is silently valid here and lands in
  // `feedbackAdapter`'s `<= 5` EASY arm, which ADDS volume.
  difficulty: 6,
  logWeights: true,
};

/**
 * Cold start, then live block 1 a day at a time and roll into block 2.
 *
 * ⚠ **THE ROLLOVER IS ASKED FOR EVERY SIMULATED DAY, exactly as `useHomeScreen`
 * asks it** — so the boundary is crossed on the day the app says it is crossed,
 * never on a day this harness picked. `rolloverIfDue` is the journey harness's
 * own wrapper over `getProgramBlockRolloverStatus` + `rolloverProgramBlock`.
 */
export async function buildWornWorld(args: {
  profile: OnboardingData;
  installDayISO: string;
  /** Weeks of block 1 to live before rolling. The app's block is 4. */
  weeks?: number;
}): Promise<WornWorld> {
  const weeks = args.weeks ?? 4;
  const install = await coldStartThroughOnboarding({
    profile: args.profile,
    installDayISO: args.installDayISO,
  });
  const blockOneStart = install.blockOneStart;

  // THE LIFT THE ATHLETE EDITS, READ OFF THEIR OWN WEEK — never named.
  // A hardcoded name stops being block 1's anything the moment selection moves,
  // and the subject here is whose NUMBER wins, not which exercise carries it.
  setJourneyClock(blockOneStart);
  followTheWeek(blockOneStart);
  const loaded = resolvedDays(blockOneStart, blockOneStart)
    .flatMap((day) => day.rows)
    .filter((row) => (row.weightKg ?? 0) > 0);
  const editedLift = loaded[0]?.name ?? null;
  // Deliberately NOT a number progression could reach on its own.
  const editedKg = 111;
  const excludedLift = loaded[1]?.name ?? null;

  let daysRecorded = 0;
  let daysMissed = 0;
  let missedOnce = false;
  let excluded = false;
  let edited = false;
  let rolloverRefusal: string | null = null;
  let blockTwoStart: string | null = null;
  const lastDay = addDaysISO(blockOneStart, weeks * 7 - 1);

  for (let dateISO = blockOneStart; dateISO <= lastDay; dateISO = addDaysISO(dateISO, 1)) {
    setJourneyClock(dateISO);
    const rolled = rolloverIfDue(dateISO);
    if (rolled.refusal) rolloverRefusal = rolled.refusal;
    if (rolled.fired) blockTwoStart = rolled.nextBlockStart;
    followTheWeek(dateISO);

    const weekIndex = Math.floor(
      (Date.parse(`${dateISO}T12:00:00Z`) - Date.parse(`${blockOneStart}T12:00:00Z`))
      / (7 * 24 * 3600 * 1000)) + 1;

    // ONE STANDING EXCLUSION, in week 2. `until_changed` on purpose: a
    // `today_only` answer expires with the day and could not tell a working
    // scope from a broken one across a settings change and a restart.
    if (!excluded && excludedLift && weekIndex === 2 && weekdayName(dateISO) === 'Monday') {
      quiet(() => leaveExerciseOut({
        exercise: excludedLift, scope: 'until_changed', decidedOnISO: dateISO,
        reason: 'it aggravates an old shoulder',
      }));
      excluded = true;
    }

    // ONE MISS, week 3, and it leaves NO record — recording a skip answers a
    // question the app never put on the screen, and the completion rate the
    // block boundary reads turns on a real gap.
    const isTheMiss = weekIndex === 3 && weekdayName(dateISO) === 'Wednesday' && !missedOnce;
    // THE LOAD EDIT LANDS LATE. `lastRecordedLoadByExercise` keeps the LAST
    // valid load per exercise over all time, so an edit early in the block is
    // overwritten by later confirm-the-card days.
    const isTheEdit = weekIndex === weeks && weekdayName(dateISO) === 'Monday' && !edited;

    const intent: DayIntent = isTheMiss
      ? { ...DID_THE_WORK, record: false, absenceReason: 'did not open the app' }
      : (isTheEdit && editedLift
        ? { ...DID_THE_WORK, editLoad: { exerciseName: editedLift, toKg: editedKg } }
        : DID_THE_WORK);

    const outcome = await recordDay(dateISO, intent);
    if (outcome.result === 'recorded') { daysRecorded += 1; if (isTheEdit) edited = true; }
    if (outcome.result === 'not_recorded') daysMissed += 1;
  }

  // THE BOUNDARY DAY ITSELF. The block ends on the day AFTER its last day, so
  // the loop above stops one day short of the rollover it exists to reach.
  const boundaryDay = addDaysISO(lastDay, 1);
  setJourneyClock(boundaryDay);
  const rolled = rolloverIfDue(boundaryDay);
  if (rolled.refusal) rolloverRefusal = rolled.refusal;
  if (rolled.fired) blockTwoStart = rolled.nextBlockStart;
  followTheWeek(boundaryDay);

  return {
    blockOneStart,
    blockTwoStart,
    todayISO: boundaryDay,
    editedLift,
    editedKg: edited ? editedKg : null,
    excludedLift: excluded ? excludedLift : null,
    daysRecorded,
    daysMissed,
    rolloverRefusal,
  };
}
