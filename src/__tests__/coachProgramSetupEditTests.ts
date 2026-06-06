/**
 * coachProgramSetupEditTests — typed program setup / availability edits.
 *
 * Run: npm run test:coach-program-setup-edit
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  executeProgramSetupEdit,
  interpretCoachMessageToProgramEdit,
  isProgramSetupEdit,
} from '../utils/coachProgramEdit';
import { buildCoachingPlan, onboardingToCoachingInputs } from '../utils/coachingEngine';
import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import { getProgramGenerationProfileFieldDiagnostics } from '../services/api/generateProgram';
import {
  SETUP_REBUILD_PROGRESS_INTERVAL_MS,
  setupRebuildProgressMessageForElapsedMs,
} from '../utils/coachLongRunningProgress';
import type { DayOfWeek, OnboardingData, TrainingProgram } from '../types/domain';

const fs = require('fs');
const path = require('path');

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? `\n      ${JSON.stringify(detail)}` : ''}`);
  }
}

function eq<T>(name: string, actual: T, expected: T) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}

function section(label: string) {
  console.log(`\n${label}`);
}

const TODAY = '2026-06-06';
const baseProfile: OnboardingData = {
  firstName: 'Sam',
  position: 'Midfielder',
  motivation: 'Get stronger',
  heightCm: 180,
  weightKg: 80,
  seasonPhase: 'Pre-season',
  trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  sessionDurationMinutes: 60,
  trainingLocation: 'Commercial gym',
  equipment: ['barbell'],
  experienceLevel: '2-5 years',
  squatStrength: 'Around bodyweight',
  benchStrength: 'Around bodyweight',
  conditioningLevel: 'Good',
  sprintExposure: 'Occasionally',
  recentTrainingLoad: 'Pretty consistent',
  injuries: [],
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
};

function fakeProgramForProfile(profile: OnboardingData): TrainingProgram {
  const inputs = onboardingToCoachingInputs(profile);
  const days = inputs.selectedDays as DayOfWeek[];
  const workouts = days.map((day) => ({
    id: `workout-${day}`,
    microcycleId: 'mc-setup',
    dayOfWeek: dayNumber(day),
    name: `${day} Training`,
    description: '',
    durationMinutes: 45,
    intensity: 'Moderate' as any,
    workoutType: 'Strength' as any,
    sessionTier: 'core' as any,
    exercises: [],
    createdAt: '2026-06-06T00:00:00.000Z',
    updatedAt: '2026-06-06T00:00:00.000Z',
  }));
  return {
    id: 'program-setup-test',
    userId: 'user-test',
    name: 'Setup Test Program',
    description: '',
    programPhase: 'Pre-Season-Skills' as any,
    startDate: '2026-06-01T00:00:00.000Z',
    endDate: '2026-06-07T00:00:00.000Z',
    primaryFocus: 'S&C',
    isActive: true,
    microcycles: [{
      id: 'mc-setup',
      programId: 'program-setup-test',
      weekNumber: 1,
      startDate: '2026-06-01T00:00:00.000Z',
      endDate: '2026-06-07T00:00:00.000Z',
      miniCycleNumber: 1,
      intensityMultiplier: 1,
      workouts,
      createdAt: '2026-06-06T00:00:00.000Z',
      updatedAt: '2026-06-06T00:00:00.000Z',
    }],
    createdAt: '2026-06-06T00:00:00.000Z',
    updatedAt: '2026-06-06T00:00:00.000Z',
  };
}

function dayNumber(day: DayOfWeek): number {
  return day === 'Sunday'
    ? 0
    : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(day) + 1;
}

async function applySetup(
  message: string,
  startingProfile: OnboardingData = baseProfile,
  generateProgram: (profile: OnboardingData) => Promise<TrainingProgram> = async (profile) => fakeProgramForProfile(profile),
) {
  const edit = interpretCoachMessageToProgramEdit({
    userMessage: message,
    todayISO: TODAY,
    referenceResolution: null,
    currentWeek: [],
  });
  let storedProfile = startingProfile;
  let storedProgram: TrainingProgram | null = null;
  let storedMicrocycle: TrainingProgram['microcycles'][number] | null = null;
  let storedToday: any = null;
  if (!isProgramSetupEdit(edit)) {
    return { edit, result: null, storedProfile, storedProgram, storedMicrocycle, storedToday };
  }
  const result = await executeProgramSetupEdit({
    programEdit: edit,
    todayISO: TODAY,
    getOnboardingData: () => storedProfile,
    updateOnboardingData: (patch) => {
      storedProfile = { ...storedProfile, ...patch };
    },
    generateProgramFromProfile: generateProgram,
    setCurrentProgram: (program) => { storedProgram = program; },
    setCurrentMicrocycle: (microcycle) => { storedMicrocycle = microcycle; },
    setTodayWorkout: (workout) => { storedToday = workout; },
  });
  return { edit, result, storedProfile, storedProgram, storedMicrocycle, storedToday };
}

async function main() {
  section('[1] Permanent availability add + rebuild');
  {
    const { edit, result, storedProfile, storedMicrocycle } = await applySetup(
      'I need to make an adjustment to my program setup — I can train Saturdays now — can you please rebuild my program',
    );
    ok('message becomes typed ProgramSetupEdit', isProgramSetupEdit(edit), edit);
    eq('Saturday added', storedProfile.preferredTrainingDays, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
    eq('frequency follows availability count', storedProfile.trainingDaysPerWeek, 6);
    ok('rebuild applied', result?.kind === 'mutated' && result.applied, result);
    ok('rebuilt microcycle can use Saturday', !!storedMicrocycle?.workouts.some((w) => w.dayOfWeek === 6), storedMicrocycle);
  }

  section('[2] Training frequency');
  {
    const sixDayProfile = {
      ...baseProfile,
      preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as DayOfWeek[],
      trainingDaysPerWeek: 5,
    };
    const { result, storedProfile } = await applySetup('I can train 6 days a week now', sixDayProfile);
    eq('trainingDaysPerWeek becomes 6', storedProfile.trainingDaysPerWeek, 6);
    ok('frequency-only rebuild applied when available days support it', result?.kind === 'mutated' && result.applied, result);

    const clarify = await applySetup('I can train 6 days a week now', baseProfile);
    ok('frequency asks for extra day when only 5 available days are saved', clarify.result?.kind === 'clarify', clarify.result);
  }

  section('[3] Combined availability + frequency');
  {
    const { result, storedProfile, storedMicrocycle } = await applySetup('I can train Saturdays now and 6 days per week');
    eq('combined update days', storedProfile.preferredTrainingDays, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
    eq('combined update frequency', storedProfile.trainingDaysPerWeek, 6);
    ok('combined update applied', result?.kind === 'mutated' && result.applied, result);
    ok('combined rebuild includes Saturday visibly in the microcycle', !!storedMicrocycle?.workouts.some((w) => w.dayOfWeek === 6), storedMicrocycle?.workouts.map((w) => w.dayOfWeek));

    const missingSaturday = await applySetup(
      'I can train Saturdays now and I can train 6 days per week. Please rebuild my program.',
      baseProfile,
      async (profile) => {
        const program = fakeProgramForProfile(profile);
        return {
          ...program,
          microcycles: [{
            ...program.microcycles[0],
            workouts: program.microcycles[0].workouts.filter((workout) => workout.dayOfWeek !== 6),
          }],
        };
      },
    );
    ok(
      'verifier rejects generated rebuild missing required Saturday',
      missingSaturday.result?.kind === 'rejected' &&
        /missing Saturday|did not include Saturday/i.test(missingSaturday.result.reply),
      missingSaturday.result,
    );

    const profileWithSaturday = {
      ...baseProfile,
      preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as DayOfWeek[],
      trainingDaysPerWeek: 6,
    };
    const plan = buildCoachingPlan(onboardingToCoachingInputs(profileWithSaturday));
    const aiWorkouts = plan.weeklyPlan
      .filter((session) => session.dayOfWeek !== 'Saturday')
      .map((session) => ({
        dayOfWeek: dayNumber(session.dayOfWeek as DayOfWeek),
        name: `${session.dayOfWeek} Training`,
        workoutType: session.conditioningFlavour && !session.hasCombinedConditioning ? 'Conditioning' : 'Strength',
        sessionTier: session.tier,
        exercises: [{ name: 'Bench Press', sets: 3, repsMin: 5, repsMax: 8 }],
      }));
    const normalised = buildWorkoutsFromCoach(
      aiWorkouts,
      'mc-normalise',
      plan.weeklyPlan,
      profileWithSaturday,
    );
    ok('normaliser completes AI response with missing Saturday plan day', normalised.some((workout) => workout.dayOfWeek === 6), normalised.map((workout) => workout.dayOfWeek));
  }

  section('[4] Temporary unavailable day constraint');
  {
    const { result, storedProfile } = await applySetup("I can't train Wednesdays for the next 3 weeks because of exams");
    const constraint = storedProfile.availabilityConstraints?.find((c) => c.kind === 'unavailable_day' && c.dayOfWeek === 'Wednesday');
    ok('temporary Wednesday block stored', !!constraint, storedProfile.availabilityConstraints);
    eq('temporary block scope', constraint?.scope, 'temporary' as any);
    eq('temporary block reason', constraint?.reason, 'exams' as any);
    ok('temporary block rebuild applied', result?.kind === 'mutated' && result.applied, result);
    const inputs = onboardingToCoachingInputs(storedProfile);
    ok('active unavailable Wednesday is filtered from engine selectedDays', !inputs.selectedDays.includes('Wednesday'), inputs);
  }

  section('[5] Restore unavailable day');
  {
    const blockedProfile: OnboardingData = {
      ...baseProfile,
      availabilityConstraints: [{
        id: 'unavailable_day-wednesday-2026-06-06',
        kind: 'unavailable_day',
        scope: 'temporary',
        dayOfWeek: 'Wednesday',
        startDate: TODAY,
        endDate: '2026-06-26',
        reason: 'exams',
        active: true,
      }],
    };
    const { result, storedProfile } = await applySetup('I can train Wednesdays again', blockedProfile);
    ok('restore applied', result?.kind === 'mutated' && result.applied, result);
    ok('Wednesday remains available', storedProfile.preferredTrainingDays?.includes('Wednesday'), storedProfile.preferredTrainingDays);
    ok('Wednesday block inactive', storedProfile.availabilityConstraints?.every((c) => c.dayOfWeek !== 'Wednesday' || c.active === false), storedProfile.availabilityConstraints);
  }

  section('[6] Time cap + missing travel dates');
  {
    const timeCap = await applySetup('I only have 30 minutes on Fridays');
    const constraint = timeCap.storedProfile.availabilityConstraints?.find((c) => c.kind === 'time_limit' && c.dayOfWeek === 'Friday');
    ok('Friday time cap stored', !!constraint && constraint.maxSessionMinutes === 30, timeCap.storedProfile.availabilityConstraints);
    ok('Friday time cap rebuild applied', timeCap.result?.kind === 'mutated' && timeCap.result.applied, timeCap.result);

    const away = interpretCoachMessageToProgramEdit({
      userMessage: "I'm away next week",
      todayISO: TODAY,
      referenceResolution: null,
      currentWeek: [],
    });
    eq('away next week asks dates', away.intent, 'ask_question' as any);
    ok('away next week does not mutate blindly', away.missingFields.includes('startDate') && away.missingFields.includes('endDate'), away);
  }

  section('[7] Work schedule constraints ask setup clarification');
  {
    const edit = interpretCoachMessageToProgramEdit({
      userMessage: "I'm working late Tuesdays for a month",
      todayISO: TODAY,
      referenceResolution: null,
      currentWeek: [],
    });
    eq('working late asks a schedule clarification', edit.intent, 'ask_question' as any);
    eq('working late stays in schedule domain', edit.targetDomain, 'schedule' as any);
    ok('working late asks unavailable vs short-session scope', /unavailable|short session/i.test(edit.question ?? ''), edit);
  }

  section('[8] Missing game-day handling');
  {
    const preSeasonNoGame: OnboardingData = {
      ...baseProfile,
      seasonPhase: 'Pre-season',
      gameDay: undefined,
      usualGameDay: undefined,
    };
    const preSeasonDiagnostics = getProgramGenerationProfileFieldDiagnostics(preSeasonNoGame);
    ok(
      'pre-season no-game profile does not require gameDay',
      !preSeasonDiagnostics.missingRequired.includes('usualGameDay/gameDay'),
      preSeasonDiagnostics,
    );
    const preSeason = await applySetup(
      'I can train Saturdays now and I can train 6 days per week. Please rebuild my program.',
      preSeasonNoGame,
    );
    ok('pre-season no-game setup rebuild applies', preSeason.result?.kind === 'mutated' && preSeason.result.applied, preSeason.result);

    const inSeasonMissingGame: OnboardingData = {
      ...baseProfile,
      seasonPhase: 'In-season',
      gameDay: undefined,
      usualGameDay: undefined,
    };
    const inSeasonDiagnostics = getProgramGenerationProfileFieldDiagnostics(inSeasonMissingGame);
    ok(
      'in-season missing gameDay is still required',
      inSeasonDiagnostics.missingRequired.includes('usualGameDay/gameDay'),
      inSeasonDiagnostics,
    );
    let generatorCalled = false;
    const inSeason = await applySetup(
      'I can train Saturdays now and I can train 6 days per week. Please rebuild my program.',
      inSeasonMissingGame,
      async (profile) => {
        generatorCalled = true;
        return fakeProgramForProfile(profile);
      },
    );
    ok('in-season missing gameDay asks clarification', inSeason.result?.kind === 'clarify', inSeason.result);
    ok('in-season gameDay clarification asks smallest useful question', /regular game day|no-game training week/i.test(inSeason.result?.reply ?? ''), inSeason.result);
    ok('in-season missing gameDay does not call generator before clarification', !generatorCalled, { generatorCalled });
  }

  section('[9] CoachScreen setup send path appends before async rebuild');
  {
    const coachScreenSource = fs.readFileSync(
      path.resolve(__dirname, '../screens/coach/CoachScreen.tsx'),
      'utf8',
    );
    ok('send tap logs composer state', coachScreenSource.includes("[coach-send] tapped"));
    ok('busy send logs early return instead of silent disabled tap', coachScreenSource.includes("reason: 'isLoading'"));
    ok(
      'setup branch appends user message before executeProgramSetupEdit',
      /if \(isProgramSetupEdit\(programEditForExecution\)\)[\s\S]*setMessages\(\(prev\) => \[\.\.\.prev, userMessage\]\);[\s\S]*await executeProgramSetupEdit/.test(coachScreenSource),
    );
    ok(
      'setup branch starts long-running rebuild progress immediately',
      /setInputValue\(''\);\s*startSetupRebuildProgress\(\);\s*setIsLoading\(true\);/.test(coachScreenSource),
    );
    ok(
      'setup branch appends assistant only after rebuild result',
      /id: `\$\{Date\.now\(\)\}-program-setup`[\s\S]*setMessages\(\(prev\) => \[\.\.\.prev, assistantMessage\]\);/.test(coachScreenSource),
    );
    ok(
      'setup branch clears long-running progress in finally',
      /finally\s*\{[\s\S]{0,240}clearSetupRebuildProgress\(\);[\s\S]{0,240}setIsLoading\(false\);/.test(coachScreenSource),
    );
    ok(
      'setup rebuild timer clears on unmount',
      /return \(\) => \{[\s\S]{0,260}clearInterval\(setupRebuildProgressTimerRef\.current\);[\s\S]{0,160}setupRebuildProgressTimerRef\.current = null;/.test(coachScreenSource),
    );
    const quickEditBlock = coachScreenSource.match(/if \(isMutateCommand\(commandForExecution\)\) \{[\s\S]*?if \(routedCommand\.mode === 'clarify'\)/)?.[0] ?? '';
    ok(
      'normal quick session edits do not start setup rebuild progress',
      !quickEditBlock.includes('startSetupRebuildProgress()'),
    );
    ok(
      'pending recurring move-scope answer can enter setup rebuild path',
      coachScreenSource.includes("source: 'pending_move_scope_resume'") &&
        /if \(isProgramSetupEdit\(resumedProgramEdit\)\)[\s\S]*await executeProgramSetupEdit/.test(coachScreenSource),
    );
  }

  section('[10] Setup rebuild progress copy cadence');
  {
    eq(
      '0s initial setup progress',
      setupRebuildProgressMessageForElapsedMs(0),
      'Updating your setup...',
    );
    eq(
      '15s rebuild progress',
      setupRebuildProgressMessageForElapsedMs(SETUP_REBUILD_PROGRESS_INTERVAL_MS),
      'Rebuilding your week from the new availability...',
    );
    eq(
      '30s verification progress',
      setupRebuildProgressMessageForElapsedMs(SETUP_REBUILD_PROGRESS_INTERVAL_MS * 2),
      'Checking the new plan respects your training days...',
    );
    eq(
      '45s finalising progress',
      setupRebuildProgressMessageForElapsedMs(SETUP_REBUILD_PROGRESS_INTERVAL_MS * 3),
      'Almost done - finalising your updated program...',
    );
    eq(
      '60s long-running progress',
      setupRebuildProgressMessageForElapsedMs(SETUP_REBUILD_PROGRESS_INTERVAL_MS * 4),
      "This is taking longer than expected, but I'm still working on it...",
    );
    eq(
      'over 60s keeps long-running progress',
      setupRebuildProgressMessageForElapsedMs(SETUP_REBUILD_PROGRESS_INTERVAL_MS * 8),
      "This is taking longer than expected, but I'm still working on it...",
    );
  }

  section('[11] Recurring weekday move updates setup, not a one-off override');
  {
    const { edit, result, storedProfile, storedMicrocycle } = await applySetup(
      'move Thursday to Saturday going forward',
    );
    ok('recurring weekday move becomes ProgramSetupEdit', isProgramSetupEdit(edit), edit);
    eq('Thursday removed and Saturday added',
      storedProfile.preferredTrainingDays,
      ['Monday', 'Tuesday', 'Wednesday', 'Friday', 'Saturday']);
    ok('recurring move rebuild applied', result?.kind === 'mutated' && result.applied, result);
    ok('recurring move reply names going forward',
      /moves from Thursday to Saturday going forward/i.test(result?.reply ?? ''),
      result?.reply);
    ok('rebuilt week uses Saturday instead of Thursday',
      !!storedMicrocycle?.workouts.some((w) => w.dayOfWeek === 6) &&
        !storedMicrocycle?.workouts.some((w) => w.dayOfWeek === 4),
      storedMicrocycle?.workouts.map((w) => w.dayOfWeek));
  }

  console.log(`\n-- Summary --`);
  console.log(`  Pass: ${pass}`);
  console.log(`  Fail: ${fail}`);
  if (fail > 0) {
    console.log(`\n-- Failures --`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  process.exit(0);
}

void main();
