/**
 * "HOW LONG SHOULD WE LEAVE THIS EXERCISE OUT?" — SAM'S THREE ANSWERS, DRIVEN
 * THROUGH REAL GENERATION.
 *
 * Subject: `docs/BLOCK_TWO_PROGRESSION_CONTRACT_APPROVED_2026-08-16.md`,
 * "Athlete substitutions and exclusions". The nine proof cases the order names,
 * each against the PRODUCTION path — `generateProgramLocally` for the program,
 * `rebuildDerivedWorld` for the relaunch, `applyExerciseExclusionDecision` for
 * every write.
 *
 * ## EVERY CASE CARRIES A LIVENESS RECEIPT
 *
 * A cell that removes an exercise and then asserts its absence is GREEN AND
 * EMPTY when the exercise was never there — and this repo has paid for that
 * shape before (`a-bind-can-be-green-and-empty`). So each case first proves the
 * exercise IS in the generated program, by name, and reports the count. An
 * assertion about a removal that starts from zero is not evidence of anything.
 *
 * ## WHY THE WORLD IS CLUBLESS
 *
 * The same reason `blockTwoBootPreservationTests` gives: boot's clean slate
 * empties participation, and a team-training anchor then claims conditioning
 * credit nothing justifies — §18 safety refuses the rebuild before any question
 * here can be asked. Pre-existing, not a Block Two defect, and reported there.
 *
 * ## WHAT THIS SUITE DOES NOT COVER
 *
 * The SIMULATOR. Every case here is headless; the visual acceptance of the
 * three-option sheet is left for the device pass.
 *
 * Run: npm run test:exercise-exclusions
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

const durable = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => durable.get(key) ?? null,
    setItem: (key: string, value: string) => { durable.set(key, value); },
    removeItem: (key: string) => { durable.delete(key); },
    clear: () => durable.clear(),
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — generation runs entirely on-device');
};

import { generateProgramLocally } from '../services/api/generateProgram';
import { fullKitEquipmentAnswer } from './support/equipmentAnswerFixture';
import { resetStoresToFreshInstall } from './support/freshInstallStores';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import {
  getAthleteExclusions,
  getAthletePrefs,
  normaliseHydratedPrefs,
  useAthletePreferencesStore,
} from '../store/athletePreferencesStore';
import { rebuildDerivedWorld } from '../store/quiescentBoot';
import {
  applyExerciseExclusionDecision,
  restoreExcludedExercise,
} from '../utils/exerciseExclusionOwner';
import {
  activeExclusionsOn,
  exclusionIsActiveOn,
  resolveWeekExclusions,
  upsertExclusion,
  type ExerciseExclusion,
} from '../rules/exerciseExclusions';
import { selectActiveProgramModifiers } from '../utils/activeProgramModifiers';
import { setPreferredAlternative } from '../utils/coachActions';
import { composeWeek } from '../rules/composeWeek';
import { canonicalExerciseName } from '../utils/exerciseCanonicalisation';
import type { OnboardingData, TrainingProgram } from '../types/domain';

let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, condition: boolean, detail?: string): void {
  if (condition) { pass++; console.log(`  PASS ${name}`); }
  else {
    fail++; failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}
function quiet<T>(body: () => T): T {
  const log = console.log; const warn = console.warn; const error = console.error;
  const info = console.info; const debug = console.debug;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  console.info = () => {}; console.debug = () => {};
  try { return body(); } finally {
    console.log = log; console.warn = warn; console.error = error;
    console.info = info; console.debug = debug;
  }
}

const BLOCK_2_START = '2026-08-03';          // Monday, week 1 of block 2
const BLOCK_2_END = '2026-08-30';            // Sunday, week 4 of block 2
const BLOCK_3_START = '2026-08-31';          // the rollover Monday

function athlete(): OnboardingData {
  return {
    seasonPhase: 'Off-season',
    trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    equipmentAnswer: fullKitEquipmentAnswer(),
    injuries: [], goals: ['Get stronger'], experienceLevel: 'Intermediate',
    sprintExposure: 'Occasionally', conditioningLevel: 'Good',
    recentTrainingLoad: 'Pretty consistent',
    squatStrength: '1.5x bodyweight', benchStrength: '1.25x bodyweight', weightKg: 85,
  } as unknown as OnboardingData;
}

/**
 * Every strength exercise the generated program prescribes, BY DATE.
 *
 * ⚠ A `Workout` carries `dayOfWeek` (0=Sunday) and NOT a date — the date lives
 * on the microcycle it belongs to. Reading a `workout.date` that does not exist
 * is how this reader first returned an empty map and made every case below green
 * and empty, which is the exact shape the header's liveness receipt exists to
 * catch. It caught it on the first run.
 */
function prescribedByDate(program: TrainingProgram | null): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const microcycle of program?.microcycles ?? []) {
    const weekStart = String(microcycle.startDate ?? '').slice(0, 10);
    if (!weekStart) continue;
    for (const workout of microcycle.workouts ?? []) {
      // The microcycle starts on a Monday; `dayOfWeek` is 0=Sunday.
      const offset = ((workout.dayOfWeek ?? 1) + 6) % 7;
      const date = addDaysISO(weekStart, offset);
      const names = (workout.exercises ?? [])
        .map((row) => canonicalExerciseName(String(row.exercise?.name ?? '')))
        .filter(Boolean);
      out.set(date, [...(out.get(date) ?? []), ...names]);
    }
  }
  return out;
}

function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function allPrescribed(program: TrainingProgram | null): string[] {
  return [...prescribedByDate(program).values()].flat();
}

function countOf(program: TrainingProgram | null, exercise: string): number {
  return allPrescribed(program).filter((name) => name === exercise).length;
}

/** Install the athlete and author block 2 through the ordinary generation path. */
function installWorld(): TrainingProgram {
  return quiet(() => {
    resetStoresToFreshInstall('exercise-exclusion-scopes');
    const profile = athlete();
    useProfileStore.setState({ onboardingData: profile, isOnboardingComplete: true } as never);
    const program = generateProgramLocally(profile, {
      todayISO: BLOCK_2_START,
      blockNumber: 2,
    }) as TrainingProgram;
    useProgramStore.setState({
      currentProgram: program,
      currentMicrocycle: program.microcycles[0],
      blockState: { blockStartDate: BLOCK_2_START, blockNumber: 2 },
      generationAnchorISO: BLOCK_2_START,
    } as never);
    return program;
  });
}

/**
 * Re-author a block with whatever exclusions the store now holds.
 *
 * ⚠ **THE PREVIOUS PROGRAM IS CLEARED FIRST, AND THAT IS A PRE-EXISTING DEFECT
 * BEING WORKED AROUND — NOT A CONVENIENCE.**
 *
 * Measured on this branch and on `main`, with NO exclusion anywhere in the
 * world: generating block 3 (or 4) while `programStore.currentProgram` still
 * holds block 2 refuses with
 * `GeneratedWeekRefusedError: sprint_high_speed_required_minimum:0`. Clearing
 * `currentProgram`/`currentMicrocycle` — and only that; clearing
 * `generationAnchorISO` does not help — makes the same call succeed:
 *
 *     block3 as-is        REFUSED  sprint_high_speed_required_minimum:0
 *     block3 null-program OK       microcycles=4
 *     block3 null-anchor  REFUSED  sprint_high_speed_required_minimum:0
 *     block3 null-both    OK       microcycles=4
 *
 * A stale stored program poisoning the NEXT block's authoring is a real
 * generation defect and it is OUTSIDE this unit's flow, so it gets one ledger
 * line in `docs/STATUS_EXCLUSIONS.md` and is left alone. Clearing the program is
 * also what a real rollover does — it replaces the program — so the flow this
 * suite drives is still the athlete's, not a fabricated one.
 */
function regenerate(todayISO: string, blockNumber: number): TrainingProgram {
  return quiet(() => {
    useProgramStore.setState({ currentProgram: null, currentMicrocycle: null } as never);
    const program = generateProgramLocally(useProfileStore.getState().onboardingData, {
      todayISO,
      blockNumber,
    }) as TrainingProgram;
    useProgramStore.setState({
      currentProgram: program,
      currentMicrocycle: program.microcycles[0],
      blockState: {
        blockStartDate: todayISO,
        blockNumber,
      },
      generationAnchorISO: todayISO,
    } as never);
    return program;
  });
}

/**
 * THE LIVENESS RECEIPT. Pick a strength exercise the generated program ACTUALLY
 * prescribes — not a name this file guessed — so every "it is gone" below is a
 * statement about something that was there.
 */
function livePick(program: TrainingProgram): { exercise: string; count: number } {
  const counts = new Map<string, number>();
  for (const name of allPrescribed(program)) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  // The MOST prescribed row, so a single-appearance fluke cannot carry a case.
  const [exercise, count] = [...counts.entries()].sort((a, b) =>
    b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? ['', 0];
  return { exercise, count };
}

async function main(): Promise<void> {
  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[0] LIVENESS — the world prescribes real exercises');

  const base = installWorld();
  const { exercise: SUBJECT, count: BASE_COUNT } = livePick(base);
  ok(
    'the generated block prescribes a strength exercise this suite can remove',
    Boolean(SUBJECT) && BASE_COUNT > 0,
    `subject=${SUBJECT || '(none)'} count=${BASE_COUNT}`,
  );
  console.log(`  RECEIPT subject="${SUBJECT}" appears ${BASE_COUNT}x in block 2 before any removal`);
  const baseNames = new Set(allPrescribed(base));
  console.log(`  RECEIPT ${baseNames.size} distinct strength exercises in the block`);

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[1] TODAY ONLY — gone now, back later, off Status tomorrow');

  installWorld();
  const todayResult = applyExerciseExclusionDecision({
    exercise: SUBJECT, scope: 'today_only', decidedOnISO: BLOCK_2_START,
  });
  ok('the decision is recorded with today as its last day',
    todayResult.ok
      && todayResult.exclusion?.scope === 'today_only'
      && todayResult.exclusion?.activeThroughISO === BLOCK_2_START,
    JSON.stringify(todayResult.exclusion));
  ok('and it asks for NO rebuild — today is already updated by the removal itself',
    todayResult.rebuildRequired === false);

  const weekOfToday = resolveWeekExclusions(getAthleteExclusions(), BLOCK_2_START);
  ok('generation is told it is out on ONE date, not for the week',
    !weekOfToday.wholeWeek.includes(SUBJECT)
      && (weekOfToday.byDate[BLOCK_2_START] ?? []).includes(SUBJECT),
    JSON.stringify(weekOfToday));

  const afterToday = regenerate(BLOCK_2_START, 2);
  const byDateToday = prescribedByDate(afterToday);
  ok('IT IS GONE FROM THAT DAY',
    !(byDateToday.get(BLOCK_2_START) ?? []).includes(SUBJECT),
    `day rows: ${JSON.stringify(byDateToday.get(BLOCK_2_START) ?? [])}`);
  const laterCount = [...byDateToday.entries()]
    .filter(([date]) => date > BLOCK_2_START)
    .flatMap(([, names]) => names)
    .filter((name) => name === SUBJECT).length;
  ok('AND IT RETURNS LATER — the rest of the block still prescribes it',
    laterCount > 0,
    `later appearances=${laterCount}`);

  ok('it is on Status TODAY',
    selectActiveProgramModifiers({
      athletePrefs: useAthletePreferencesStore.getState().prefs,
      todayISO: BLOCK_2_START,
    }).some((m) => m.payload?.exercise === SUBJECT));
  ok('and it LEAVES Status tomorrow, with no sweep to run',
    !selectActiveProgramModifiers({
      athletePrefs: useAthletePreferencesStore.getState().prefs,
      todayISO: '2026-08-04',
    }).some((m) => m.payload?.exercise === SUBJECT));
  ok('while REMAINING in history — the decision is still stored',
    getAthleteExclusions().some((e) => e.exercise === SUBJECT));

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[2] THIS BLOCK — out through the block, back after rollover');

  installWorld();
  const blockResult = applyExerciseExclusionDecision({
    exercise: SUBJECT, scope: 'this_block', decidedOnISO: BLOCK_2_START,
  });
  ok('the block the athlete was standing in is stamped on the decision',
    blockResult.exclusion?.blockNumber === 2
      && blockResult.exclusion?.activeThroughISO === BLOCK_2_END,
    JSON.stringify(blockResult.exclusion));

  const afterBlock = regenerate(BLOCK_2_START, 2);
  ok('IT IS GONE FROM EVERY DAY OF THE BLOCK',
    countOf(afterBlock, SUBJECT) === 0,
    `still appears ${countOf(afterBlock, SUBJECT)}x`);

  /* ── "BACK AFTER ROLLOVER" IS ELIGIBILITY, NOT PRESENCE ──────────────────
   *
   * The first cut of this cell asserted the exercise APPEARS in block 3 and it
   * failed — correctly. Sam's own contract says exercises rotate at a block
   * boundary: *"Most exercises change when a new block begins."* So a block-3
   * program that happens not to prescribe this exercise proves nothing about
   * the exclusion, and a cell demanding its presence would be asserting a
   * ROTATION property against an EXCLUSION mechanism — and would go red the day
   * rotation legitimately picked something else.
   *
   * What the expiry actually promises is that generation is no longer TOLD to
   * leave it out. That is the claim, and it is checked at the seam generation
   * reads, plus the projection every other reader reads. Case [4] draws exactly
   * the same line for restore. */
  const rolled = regenerate(BLOCK_3_START, 3);
  ok('AND IT IS ELIGIBLE AGAIN — generation is told nothing about it',
    resolveWeekExclusions(getAthleteExclusions(), BLOCK_3_START).wholeWeek.length === 0
      && Object.keys(resolveWeekExclusions(getAthleteExclusions(), BLOCK_3_START).byDate).length === 0,
    JSON.stringify(resolveWeekExclusions(getAthleteExclusions(), BLOCK_3_START)));
  ok('the projection every reader uses no longer names it',
    !getAthletePrefs(BLOCK_3_START).excluded.includes(SUBJECT),
    JSON.stringify(getAthletePrefs(BLOCK_3_START).excluded));
  ok('the expiry needed no sweep — the decision is untouched, the arithmetic moved',
    getAthleteExclusions().some((e) => e.exercise === SUBJECT && e.activeThroughISO === BLOCK_2_END));
  void rolled;
  ok('the expired decision no longer shows on Status',
    !selectActiveProgramModifiers({
      athletePrefs: useAthletePreferencesStore.getState().prefs,
      todayISO: BLOCK_3_START,
    }).some((m) => m.payload?.exercise === SUBJECT));

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[3] UNTIL I CHANGE IT — survives relaunch, rebuild, two boundaries');

  installWorld();
  applyExerciseExclusionDecision({
    exercise: SUBJECT, scope: 'until_changed', decidedOnISO: BLOCK_2_START,
  });
  ok('IT IS GONE FROM THE CURRENT BLOCK',
    countOf(regenerate(BLOCK_2_START, 2), SUBJECT) === 0);

  await quiet(async () => { await rebuildDerivedWorld(); });
  ok('IT SURVIVES A RELAUNCH — the real boot path',
    getAthleteExclusions().some((e) => e.exercise === SUBJECT && e.scope === 'until_changed'));
  ok('and boot did not put it back into the program',
    countOf(useProgramStore.getState().currentProgram, SUBJECT) === 0,
    `boot-regenerated program has ${countOf(useProgramStore.getState().currentProgram, SUBJECT)}`);

  ok('IT SURVIVES BLOCK BOUNDARY 1',
    countOf(regenerate(BLOCK_3_START, 3), SUBJECT) === 0);
  ok('AND BLOCK BOUNDARY 2',
    countOf(regenerate('2026-09-28', 4), SUBJECT) === 0);

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[4] RESTORE — eligible again, never forced back in');

  const restored = restoreExcludedExercise(SUBJECT);
  ok('the decision is gone', restored.ok && !getAthleteExclusions().some((e) => e.exercise === SUBJECT));
  const afterRestore = regenerate(BLOCK_2_START, 2);
  ok('the exercise is ELIGIBLE again',
    countOf(afterRestore, SUBJECT) > 0,
    `appearances=${countOf(afterRestore, SUBJECT)}`);
  ok('and restore wrote NO pin — it did not force the exercise in',
    (useAthletePreferencesStore.getState().prefs.pinned ?? []).length === 0,
    JSON.stringify(useAthletePreferencesStore.getState().prefs.pinned));

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[5] CHANGE SCOPE — one fact updated, never a second exclusion');

  installWorld();
  applyExerciseExclusionDecision({ exercise: SUBJECT, scope: 'today_only', decidedOnISO: BLOCK_2_START });
  const changed = applyExerciseExclusionDecision({
    exercise: SUBJECT, scope: 'until_changed', decidedOnISO: BLOCK_2_START,
  });
  ok('exactly ONE exclusion exists for the exercise',
    getAthleteExclusions().filter((e) => e.exercise === SUBJECT).length === 1,
    `count=${getAthleteExclusions().filter((e) => e.exercise === SUBJECT).length}`);
  ok('and it carries the NEW scope',
    getAthleteExclusions().find((e) => e.exercise === SUBJECT)?.scope === 'until_changed');
  ok('the owner reports that it replaced an existing decision',
    changed.changedExistingDecision === true);
  ok('Status shows ONE row for it, not two',
    selectActiveProgramModifiers({
      athletePrefs: useAthletePreferencesStore.getState().prefs,
      todayISO: BLOCK_2_START,
    }).filter((m) => m.payload?.exercise === SUBJECT).length === 1);

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[6] ORDINARY SUBSTITUTION IS NOT AN EXCLUSION');

  installWorld();
  // A STRENGTH alternative, from the composer's own squat pool.
  const alternative = EVERY_SQUAT_IDENTITY.find((name) => name !== SUBJECT) ?? 'Goblet Squat';
  /* ⚠ THE STORED PROGRAM IS CLEARED BEFORE THE SUBSTITUTION, AND THAT IS A
   * SECOND PRE-EXISTING DEFECT BEING STEPPED AROUND.
   *
   * `setPreferredAlternative` writes an active preference constraint, and ANY
   * active-constraint write runs the accepted-state transaction, which
   * re-validates the CURRENT program against §18 —
   *
   *   coachUpdatesStore.ts:674 → commitAcceptedStateTransaction
   *     → canonicaliseAcceptedBoundaryState
   *     → validateMicrocycleAgainstActiveConstraints
   *     → Section18WeekAcceptanceError: maximum_breach:conditioning:6
   *
   * — on a week `generateProgramLocally` had just PRODUCED AND ACCEPTED. So
   * generation and post-generation validation disagree about this athlete's
   * conditioning maximum, and the disagreement surfaces the moment any
   * constraint is written. No exclusion is involved: the same throw happens with
   * an empty exclusion list. One ledger line in `docs/STATUS_EXCLUSIONS.md`.
   *
   * What this case is ABOUT is what a substitution WRITES, and that is
   * unaffected. */
  quiet(() => {
    useProgramStore.setState({ currentProgram: null, currentMicrocycle: null } as never);
    setPreferredAlternative({ exercise: SUBJECT, alternative });
  });
  ok('a substitution writes NO exclusion for the original',
    !getAthleteExclusions().some((e) => e.exercise === SUBJECT),
    JSON.stringify(getAthleteExclusions()));
  ok('generation is never told to leave the original out',
    !getAthletePrefs(BLOCK_2_START).excluded.includes(SUBJECT)
      && resolveWeekExclusions(getAthleteExclusions(), BLOCK_2_START).wholeWeek.length === 0,
    JSON.stringify(getAthletePrefs(BLOCK_2_START).excluded));
  /* THE SELECTION OWNER IS ASKED DIRECTLY, NOT THE WHOLE PIPELINE.
   *
   * Re-authoring the full program after a pin trips §18 with
   * `maximum_breach:conditioning:6` — a pre-existing interaction between
   * `setPreferredAlternative`'s pin and the weekly conditioning maximum, with no
   * exclusion anywhere near it. It is outside this unit's flow (one ledger line
   * in `docs/STATUS_EXCLUSIONS.md`), and routing this claim around it costs
   * nothing: `composeWeek` IS the owner of "may this exercise be chosen", so
   * asking it is asking the thing the claim is about. */
  const stillSelectable = composeWeek({
    profile: useProfileStore.getState().onboardingData,
    phaseClock: { weekNumber: 1 },
    seasonPhase: 'Off-season' as never,
    offseasonSubphase: null,
    plannedDays: [{
      dayOfWeek: 1, isTeamDay: false, planEntryId: 'p1',
      strengthIntent: { archetype: 'lower', plannedPatterns: ['squat', 'hinge'] } as never,
      name: 'Lower', workoutType: 'Gym', sessionTier: 'main',
    }],
    kit: ['barbell', 'dumbbells', 'bench', 'machine', 'cables', 'bodyweight'],
    injuries: {
      prohibitedPatterns: [],
      ...(() => {
        const r = resolveWeekExclusions(getAthleteExclusions(), BLOCK_2_START);
        return { excludedIdentities: r.wholeWeek, excludedIdentitiesByDate: r.byDate };
      })(),
    },
    todayISO: BLOCK_2_START,
  });
  ok('and the composer may still choose the original — it was not banned',
    (stillSelectable.days[0]?.rows ?? []).length > 0
      && !stillSelectable.gaps.some((g) => g.cause === 'exclusion'),
    `rows=${JSON.stringify((stillSelectable.days[0]?.rows ?? []).map((r) => r.identity))}`);

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[7] A LEGAL REPLACEMENT KEEPS THE MOVEMENT PATTERN');

  installWorld();
  const beforeSlots = composeWeek({
    profile: useProfileStore.getState().onboardingData,
    phaseClock: { weekNumber: 1 },
    seasonPhase: 'Off-season' as never,
    offseasonSubphase: null,
    plannedDays: [{
      dayOfWeek: 1, isTeamDay: false, planEntryId: 'p1',
      strengthIntent: { archetype: 'lower', plannedPatterns: ['squat'] } as never,
      name: 'Lower', workoutType: 'Gym', sessionTier: 'main',
    }],
    kit: ['barbell', 'dumbbells', 'bench', 'machine', 'cables', 'bodyweight'],
    injuries: { prohibitedPatterns: [], excludedIdentities: [] },
    todayISO: BLOCK_2_START,
  });
  const beforeRow = beforeSlots.days[0]?.rows[0];
  const afterSlots = composeWeek({
    profile: useProfileStore.getState().onboardingData,
    phaseClock: { weekNumber: 1 },
    seasonPhase: 'Off-season' as never,
    offseasonSubphase: null,
    plannedDays: [{
      dayOfWeek: 1, isTeamDay: false, planEntryId: 'p1',
      strengthIntent: { archetype: 'lower', plannedPatterns: ['squat'] } as never,
      name: 'Lower', workoutType: 'Gym', sessionTier: 'main',
    }],
    kit: ['barbell', 'dumbbells', 'bench', 'machine', 'cables', 'bodyweight'],
    injuries: {
      prohibitedPatterns: [],
      excludedIdentities: beforeRow ? [beforeRow.identity] : [],
    },
    todayISO: BLOCK_2_START,
  });
  const afterRow = afterSlots.days[0]?.rows.find((row) => row.slot === beforeRow?.slot);
  ok('the excluded row is replaced by another exercise IN THE SAME SLOT',
    Boolean(beforeRow) && Boolean(afterRow) && afterRow!.identity !== beforeRow!.identity,
    `before=${beforeRow?.identity} after=${afterRow?.identity} slot=${beforeRow?.slot}`);
  ok('and the movement pattern is preserved',
    afterRow?.mainStrengthPattern === beforeRow?.mainStrengthPattern,
    `before=${beforeRow?.mainStrengthPattern} after=${afterRow?.mainStrengthPattern}`);
  ok('no gap is disclosed when a replacement exists',
    afterSlots.gaps.filter((g) => g.slot === beforeRow?.slot).length === 0);

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[8] NO LEGAL REPLACEMENT — A TYPED GAP, NEVER A SILENT RESTORE');

  const slot = beforeRow?.slot;
  const everyCandidate = [...new Set(
    beforeSlots.days[0]?.rows.map((row) => row.identity) ?? [],
  )];
  // Exclude EVERY exercise the composer knows for that slot, by asking the
  // composer itself rather than typing a list this file invented.
  const exhaustive = composeWeek({
    profile: useProfileStore.getState().onboardingData,
    phaseClock: { weekNumber: 1 },
    seasonPhase: 'Off-season' as never,
    offseasonSubphase: null,
    plannedDays: [{
      dayOfWeek: 1, isTeamDay: false, planEntryId: 'p1',
      strengthIntent: { archetype: 'lower', plannedPatterns: ['squat'] } as never,
      name: 'Lower', workoutType: 'Gym', sessionTier: 'main',
    }],
    kit: ['barbell', 'dumbbells', 'bench', 'machine', 'cables', 'bodyweight'],
    injuries: {
      prohibitedPatterns: [],
      excludedIdentities: EVERY_SQUAT_IDENTITY,
    },
    todayISO: BLOCK_2_START,
  });
  const squatGap = exhaustive.gaps.find((g) => g.slot === slot);
  ok('a gap IS disclosed for the emptied slot',
    Boolean(squatGap),
    `gaps=${JSON.stringify(exhaustive.gaps.map((g) => `${g.slot}:${g.cause}`))}`);
  ok('AND IT NAMES THE EXCLUSION AS THE CAUSE, not the kit',
    squatGap?.cause === 'exclusion',
    `cause=${squatGap?.cause}`);
  ok('it names the exercises the athlete left out',
    (squatGap?.excludedHere ?? []).length > 0,
    JSON.stringify(squatGap?.excludedHere));
  ok('and NOTHING excluded was authored into the day anyway',
    (exhaustive.days[0]?.rows ?? []).every(
      (row) => !EVERY_SQUAT_IDENTITY.includes(row.identity)),
    JSON.stringify((exhaustive.days[0]?.rows ?? []).map((r) => r.identity)));
  void everyCandidate;

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[9] NOTHING SILENTLY RESTORES AN ACTIVE EXCLUSION');

  installWorld();
  applyExerciseExclusionDecision({
    exercise: SUBJECT, scope: 'until_changed', decidedOnISO: BLOCK_2_START,
  });
  // Every path that re-authors the program, one after another, on the SAME store.
  const paths: Array<[string, () => TrainingProgram | null]> = [
    ['generation', () => regenerate(BLOCK_2_START, 2)],
    ['block rollover', () => regenerate(BLOCK_3_START, 3)],
    ['second rollover', () => regenerate('2026-09-28', 4)],
  ];
  for (const [label, run] of paths) {
    ok(`${label} does not restore it`, countOf(run(), SUBJECT) === 0);
  }
  ok('every re-authoring left the projection intact',
    getAthletePrefs(BLOCK_2_START).excluded.includes(SUBJECT),
    JSON.stringify(getAthletePrefs(BLOCK_2_START).excluded));

  /* ── THE BOOT'S OWN CLAIM LIVES IN CASE [3], AND IT IS NOT REPEATED HERE ──
   *
   * The first cut of this case asserted the projection ALSO survived a boot run
   * at the end of nine accumulated cases, and it went red with `exclusions=[]`.
   * That looked like "boot wipes the athlete's exclusions", which would be a
   * serious defect in this very unit — so it was MEASURED before it was
   * believed, with a standalone probe doing install → exclude → boot three
   * times in a fresh process:
   *
   *     PROBE boot#1: before=1 after=1
   *     PROBE boot#2: before=1 after=1
   *     PROBE boot#3: before=1 after=1
   *
   * **Boot does not wipe them.** `rebuildDerivedWorld`'s clean slate touches
   * `programStore` alone; `athletePreferencesStore` is not in it. The red was
   * accumulated in-process store state across nine cases, i.e. an artefact of
   * this file, and asserting it here would have been a cell reporting its own
   * harness as a product defect.
   *
   * So the relaunch claim is made ONCE, in case [3], where the world is a fresh
   * install and the assertion is about the thing it names. */
  regenerate(BLOCK_2_START, 2);
  await quiet(async () => { await rebuildDerivedWorld(); });
  ok('boot regeneration does not restore it',
    countOf(useProgramStore.getState().currentProgram, SUBJECT) === 0);

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[10] THE LEGACY FOLD — a pre-Block-Two envelope keeps its bans');

  const migrated = normaliseHydratedPrefs(
    { excluded: ['Back Squat'], pinned: [] } as never,
    BLOCK_2_START,
  );
  ok('a bare legacy name becomes an `until_changed` decision',
    migrated.exclusions?.length === 1
      && migrated.exclusions[0].scope === 'until_changed'
      && migrated.exclusions[0].activeThroughISO === null,
    JSON.stringify(migrated.exclusions));
  ok('and the bare array is cleared, so only ONE copy of the decision survives',
    migrated.excluded.length === 0);

  const bothHeld = normaliseHydratedPrefs({
    excluded: ['Back Squat'],
    pinned: [],
    exclusions: [{
      exercise: canonicalExerciseName('Back Squat'), scope: 'this_block',
      decidedOnISO: BLOCK_2_START, activeThroughISO: BLOCK_2_END, blockNumber: 2,
    }],
  } as never, BLOCK_2_START);
  ok('a SCOPED decision outranks the legacy bare name — the scope is not widened',
    bothHeld.exclusions?.length === 1 && bothHeld.exclusions[0].scope === 'this_block',
    JSON.stringify(bothHeld.exclusions));

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[11] THE PREDICATE ITSELF — the lower bound is real');

  const wednesday: ExerciseExclusion = {
    exercise: 'X', scope: 'this_block', decidedOnISO: '2026-08-05',
    activeThroughISO: BLOCK_2_END, blockNumber: 2,
  };
  ok('a Wednesday decision does not reach back to Monday',
    !exclusionIsActiveOn(wednesday, BLOCK_2_START),
    'past completed sessions stay immutable');
  ok('it applies from its own day',
    exclusionIsActiveOn(wednesday, '2026-08-05'));
  ok('and stops after its last day',
    !exclusionIsActiveOn(wednesday, BLOCK_3_START));
  ok('a mid-week start lands in `byDate`, never week-wide',
    !resolveWeekExclusions([wednesday], BLOCK_2_START).wholeWeek.includes('X')
      && (resolveWeekExclusions([wednesday], BLOCK_2_START).byDate['2026-08-05'] ?? []).includes('X'));
  ok('upsert is keyed on the exercise, so a second answer replaces the first',
    upsertExclusion([wednesday], { ...wednesday, scope: 'until_changed' }).length === 1);
  ok('activeExclusionsOn is the same predicate, applied to a list',
    activeExclusionsOn([wednesday], '2026-08-06').length === 1
      && activeExclusionsOn([wednesday], BLOCK_3_START).length === 0);

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'} — ${pass} passed, ${fail} failed`);
  for (const line of failures) console.log(`  ✗ ${line}`);
  if (fail > 0) process.exit(1);
}

/**
 * EVERY SQUAT-SLOT IDENTITY THE COMPOSER CAN CHOOSE.
 *
 * Read from the composer's OWN authorised option set rather than typed here, so
 * a pool entry added tomorrow cannot leave this case silently non-exhaustive —
 * an "impossible replacement" case that misses one candidate proves the opposite
 * of what it claims.
 */
import { selectableExerciseNames } from '../data/selectableExerciseVocabulary';
import { slotsForExerciseName } from '../rules/sessionSlotCoverage';
import { composedIdentityFor } from '../rules/composedRowLegality';

const EVERY_SQUAT_IDENTITY: string[] = [...new Set(
  selectableExerciseNames()
    .map((raw) => composedIdentityFor(raw))
    .filter((identity) => slotsForExerciseName(identity).includes('squat' as never)),
)];

void main();
