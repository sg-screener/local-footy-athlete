(global as any).__DEV__ = false;
(globalThis as any).window = { localStorage: {
  getItem: () => null, setItem: () => undefined, removeItem: () => undefined,
} };

import { compileCanonicalProgram } from '../rules/canonicalProgramCompiler';
import {
  canonicalProgramInputFromProfile,
  type GenerateProgramFromProfileOptions,
} from '../services/api/generateProgram';
import {
  TRACKED_LIFT_PAIRS,
  selectedTrackedLifts,
  type TrackedLiftChoices,
} from '../rules/estimatedOneRepMax';
import { trackedLiftProgrammingEvidence } from '../rules/trackedLiftProgrammingEvidence';
import type { AutomaticProgrammingSelectionTrace } from '../rules/programmingSelectionTrace';
import { athleteAnswers } from './compilerYear/catalog';
import { presetEquipmentAnswer } from './support/equipmentAnswerFixture';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();
let passed = 0;
let failed = 0;
function check(label: string, condition: unknown, detail?: unknown) {
  if (condition) { passed += 1; console.log(`  PASS ${label}`); return; }
  failed += 1;
  console.error(`  FAIL ${label}${detail === undefined ? '' : `\n       ${JSON.stringify(detail)}`}`);
}

const start = '2026-09-28';
const defaults: TrackedLiftChoices = {
  pull_up: 'pull_up', bench_press: 'bench_press', rdl: 'rdl', back_squat: 'back_squat',
};
const alternatives: TrackedLiftChoices = {
  pull_up: 'lat_pulldown', bench_press: 'overhead_press',
  rdl: 'trap_bar_deadlift', back_squat: 'bulgarian_split_squat',
};
const expectedNames = {
  pull_up: 'Pull-Ups', bench_press: 'Bench Press', rdl: 'RDLs', back_squat: 'Back Squat',
  lat_pulldown: 'Lat Pulldown', overhead_press: 'Overhead Press',
  trap_bar_deadlift: 'Trap Bar Deadlift', bulgarian_split_squat: 'Bulgarian Split Squats',
} as const;
const patternForSlot = (slot: string): keyof TrackedLiftChoices | null => {
  if (slot.includes('push')) return 'bench_press';
  if (slot.includes('pull')) return 'pull_up';
  if (slot === 'squat') return 'back_squat';
  if (slot === 'hinge') return 'rdl';
  return null;
};

function profile(gender: 'male' | 'female') {
  const value = athleteAnswers({
    id: `tracked-${gender}`, gender,
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    experience: '5+ years', equipment: 'commercial', initialPhase: 'Off-season',
    clubDays: ['Tuesday', 'Thursday'], gameDay: 'Saturday', extraGame: false,
  });
  value.seasonFinishedOn = '2026-09-27';
  value.equipmentAnswer = presetEquipmentAnswer('commercial_gym', start);
  return value;
}

function compile(
  gender: 'male' | 'female',
  choices: TrackedLiftChoices,
  extra: Partial<GenerateProgramFromProfileOptions> = {},
) {
  const log = console.log;
  const warn = console.warn;
  console.log = () => undefined;
  console.warn = () => undefined;
  try {
    const input = canonicalProgramInputFromProfile(profile(gender), {
      todayISO: start,
      microcycleLimit: 4,
      selectionHistory: [], conditioningSelectionHistory: [], powerSelectionHistory: [],
      trackedLiftChoices: choices,
      ...extra,
    } as GenerateProgramFromProfileOptions);
    return compileCanonicalProgram(input);
  } finally {
    console.log = log;
    console.warn = warn;
  }
}

console.log('\n[tracked lifts are programming anchors]');
for (const gender of ['male', 'female'] as const) {
  for (const choices of [defaults, alternatives]) {
    const built = compile(gender, choices);
    const main = built.selectionTraces.filter((trace) =>
      trace.kind === 'strength_exercise' && trace.need.role === 'main_strength');
    const eligible = main.map((trace) => ({
      trace,
      slot: patternForSlot(trace.need.movementOrQuality),
    })).filter((item): item is typeof item & { slot: keyof TrackedLiftChoices } => item.slot !== null);
    const wrong = eligible.filter(({ trace, slot }) =>
      trace.selected !== expectedNames[choices[slot] ?? slot]);
    check(`${gender}/${choices === defaults ? 'defaults' : 'alternatives'}: every eligible main pattern takes its selected anchor`,
      eligible.length >= 8 && wrong.length === 0,
      wrong.map(({ trace, slot }) => ({ date: trace.need.dateISO, pattern: slot,
        expected: expectedNames[choices[slot] ?? slot], actual: trace.selected })));
    const deliveredNames = built.program.microcycles.flatMap((week) => week.workouts)
      .flatMap((workout) => workout.exercises.map((row) => row.exercise?.name ?? ''));
    for (const id of selectedTrackedLifts(choices)) {
      check(`${gender}: ${expectedNames[id]} repeats often enough for observations`,
        deliveredNames.filter((name) => name === expectedNames[id]).length >= 3);
    }
    if (choices === alternatives) {
      for (const slot of Object.keys(TRACKED_LIFT_PAIRS) as (keyof TrackedLiftChoices)[]) {
        check(`${gender}: selected ${expectedNames[choices[slot]!]} displaces ${expectedNames[slot]}`,
          !deliveredNames.includes(expectedNames[slot]));
      }
    }
  }
}

console.log('\n[live choice and restart use the same compiler input]');
{
  const authoredDefault = compile('male', defaults);
  const liveAlternative = compile('male', alternatives, {
    selectionHistory: authoredDefault.selections,
  });
  const restartedAlternative = compile('male', alternatives, {
    selectionHistory: liveAlternative.selections,
  });
  const selected = (result: typeof liveAlternative) => result.selectionTraces
    .filter((trace) => trace.kind === 'strength_exercise')
    .map((trace) => [trace.need.dateISO, trace.need.movementOrQuality, trace.selected]);
  check('an alternative choice overrides the already-authored default block',
    selected(liveAlternative).some((entry) => entry[2] === 'Overhead Press')
      && !liveAlternative.program.microcycles.flatMap((week) => week.workouts)
        .flatMap((workout) => workout.exercises).some((row) => row.exercise?.name === 'Bench Press'));
  check('cold reconstruction retains the exact selected exercise decisions',
    JSON.stringify(selected(restartedAlternative)) === JSON.stringify(selected(liveAlternative)));
}

console.log('\n[safety and availability outrank an anchor]');
{
  const excluded = compile('female', defaults, {
    athletePrefs: { excluded: ['Bench Press'] } as never,
  });
  const names = excluded.program.microcycles.flatMap((week) => week.workouts)
    .flatMap((workout) => workout.exercises.map((row) => row.exercise?.name ?? ''));
  check('an athlete removal withholds Bench rather than forcing it', !names.includes('Bench Press'));
  check('the removed anchor leaves a valid delivered program', excluded.program.microcycles.length === 4);
}

console.log('\n[annual evidence counts final decisions, not overlapping rebuilds]');
{
  const trace = (
    selected: string,
    rejectedBy: readonly ('experience' | 'weekly_spacing')[],
  ): AutomaticProgrammingSelectionTrace => ({
    schemaVersion: 1,
    decisionId: 'strength:2026-10-01:vertical_pull:0',
    kind: 'strength_exercise',
    owner: 'blockExerciseSelection',
    need: {
      dateISO: '2026-10-01', weekStartISO: '2026-09-28', dayOfWeek: 4,
      phase: 'Off-season', movementOrQuality: 'vertical_pull',
      role: 'main_strength', seatIndex: 0, equipment: ['pullup_bar'],
      experience: 'Complete beginner', injuries: [], daysToGame: null,
    },
    candidates: [{
      name: 'Pull-Ups', eligible: rejectedBy.length === 0, rejectedBy, rank: null,
      score: { phasePriority: 0, athletePreference: false, recentUsage: 0,
        annualUsage: 0, weeksOrBlocksSinceUse: null, weeklyUsage: 0 },
    }],
    selected,
    selectionReason: selected === 'Pull-Ups' ? 'athlete_preference' : 'phase_priority',
  });
  const selectedFallback = trackedLiftProgrammingEvidence([
    trace('Pull-Ups', ['experience']),
  ]).find((item) => item.liftId === 'pull_up')!;
  check('a selected fallback is one eligible and delivered date, never 0 eligible / 1 delivered',
    selectedFallback.eligibleDates.length === 1
      && selectedFallback.deliveredDates.length === 1
      && selectedFallback.withheld.length === 0,
    selectedFallback);
  const rebuiltFinal = trackedLiftProgrammingEvidence([
    trace('Single-Arm DB Row', ['experience']),
    trace('Pull-Ups', ['experience']),
  ]).find((item) => item.liftId === 'pull_up')!;
  check('overlapping live/restart traces collapse to the final decision id once',
    rebuiltFinal.eligibleDates.length === 1
      && rebuiltFinal.deliveredDates.length === 1
      && rebuiltFinal.withheld.length === 0,
    rebuiltFinal);
}

console.log(`\nTracked-lift programming anchors: ${passed} passed, ${failed} failed`);
console.log('NOT COVERED: physical-iPhone acceptance; clinical safety; annual injury-event denominator (final year audit).');
totalsPrinted(failed);
process.exitCode = failed ? 1 : 0;
