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
  selectedTrackedLiftProgrammingSeat,
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
/* RE-PINNED 2026-09-02 to R-317: every plane is its own weekly main seat, so
   only the seat the SELECTED lift is programmed in is judged — a horizontal
   pull main beside the tracked Pull-Ups is lawful, not "wrong". The seat table
   is the product's own (`selectedTrackedLiftProgrammingSeat`). */
const patternForSlot = (slot: string, choices: TrackedLiftChoices): keyof TrackedLiftChoices | null => {
  for (const pattern of ['bench_press', 'pull_up', 'back_squat', 'rdl'] as const) {
    const trackedPattern = pattern === 'bench_press' ? 'push' : pattern === 'pull_up' ? 'pull'
      : pattern === 'back_squat' ? 'squat' : 'hinge';
    if (selectedTrackedLiftProgrammingSeat(choices, trackedPattern) === slot) return pattern;
  }
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
      slot: patternForSlot(trace.need.movementOrQuality, choices),
    })).filter((item): item is typeof item & { slot: keyof TrackedLiftChoices } => item.slot !== null);
    const wrong = eligible.filter(({ trace, slot }) =>
      trace.selected !== expectedNames[choices[slot] ?? slot]);
    check(`${gender}/${choices === defaults ? 'defaults' : 'alternatives'}: every eligible main pattern takes its selected anchor`,
      eligible.length >= 8 && wrong.length === 0,
      wrong.map(({ trace, slot }) => ({ date: trace.need.dateISO, pattern: slot,
        expected: expectedNames[choices[slot] ?? slot], actual: trace.selected })));
    const deliveredNames = built.program.microcycles.flatMap((week) => week.workouts)
      .flatMap((workout) => workout.exercises.map((row) => row.exercise?.name ?? ''));
    /* ⚠ **THE ANNUAL QUOTA IS GONE — R-304 AMENDED BY SAM, 2026-09-04.**
     *
     * This asked for THREE deliveries per tracked lift, and it went red when
     * `B-Stance RDL` was added to a completely unrelated pool: the full-body
     * day's slots are computed from what the REST OF THE WEEK is missing, so
     * changing one row's identity changed the gap arithmetic and that day
     * declared four slots instead of five. **Overhead Press was never beaten —
     * the vertical-push SLOT was never created**, and its deliveries fell 4 -> 2.
     *
     * Sam, shown that: *"i dont care - i just want the most well balanced
     * program ... i don't want the program to be worse or less balanced just so
     * they can track a lift."* **So the quota is not a law and it may not bend
     * the week.** A count-based cell here would keep forcing composition
     * decisions to serve a graph, which is precisely what he ruled against.
     *
     * WHAT SURVIVES, AND IT IS THE ACTUAL LAW. R-304's own sentence is *"the
     * anchor applies whenever its pattern is programmed and the exercise is
     * legal"* — held by the `every eligible main pattern takes its selected
     * anchor` cell above, which reads the compiler's own selection traces. This
     * cell keeps only the part that cell cannot see: that the choice SURVIVES
     * the compiler and reaches a real delivered row, rather than being selected
     * and then dropped on the way to the athlete. One delivery proves the
     * chain; three proved a quota nobody ruled. */
    for (const id of selectedTrackedLifts(choices)) {
      check(`${gender}: ${expectedNames[id]} reaches the athlete's program at all`,
        deliveredNames.filter((name) => name === expectedNames[id]).length >= 1,
        `${expectedNames[id]} delivered ${deliveredNames.filter((name) => name === expectedNames[id]).length}x`);
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
