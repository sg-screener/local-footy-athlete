import {
  buildConditioningCoachPlan,
  detectRequestedModality,
  detectRequestedTrainingIntent,
} from '../utils/coachPlan';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? `\n      ${detail}` : ''}`);
    console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`);
  }
}

function eq<T>(name: string, actual: T, expected: T) {
  ok(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

console.log('\ncoachPlan');

eq('detects SkiErg modality from casual wording',
  detectRequestedModality('Actually can you make them ski erg?'),
  'ski' as any);
eq('detects HIIT training intent',
  detectRequestedTrainingIntent('Yeah can you make it HIIT though?'),
  'hiit' as any);

const hiitRowToSki = buildConditioningCoachPlan({
  userMessage: 'Actually can you make them ski erg?',
  referenceResolution: null,
  lastChange: {
    target: { kind: 'date', date: '2026-06-02', sessionName: 'Lower Squat' },
    touchedActivities: [
      {
        kind: 'conditioning',
        date: '2026-06-02',
        sessionName: 'Lower Squat',
        title: 'HIIT Rowing Intervals',
        modality: 'row',
        intensity: 'hard',
        effortKind: 'interval',
        trainingIntent: 'hiit',
        sets: 8,
        repsMin: 45,
        repsMax: 45,
        prescriptionType: 'duration',
      },
    ],
  },
});

ok('builds a plan for modality-only follow-up',
  hiitRowToSki?.kind === 'conditioning_edit',
  JSON.stringify(hiitRowToSki));
if (hiitRowToSki) {
  eq('plan targets last changed session',
    hiitRowToSki.target,
    { kind: 'date', date: '2026-06-02', sessionName: 'Lower Squat' } as any);
  eq('plan preserves HIIT as final activity',
    hiitRowToSki.payload.customActivity,
    'HIIT SkiErg Intervals');
  eq('plan replaces old row activity',
    hiitRowToSki.payload.replaceActivity,
    'HIIT Rowing Intervals');
  eq('plan preserves hard interval quality',
    {
      modality: hiitRowToSki.payload.modality,
      intensity: hiitRowToSki.payload.intensity,
      effortKind: hiitRowToSki.payload.effortKind,
      trainingIntent: hiitRowToSki.payload.trainingIntent,
      sets: hiitRowToSki.payload.sets,
      repsMin: hiitRowToSki.payload.repsMin,
      repsMax: hiitRowToSki.payload.repsMax,
      changeKind: hiitRowToSki.payload.changeKind,
    },
    {
      modality: 'ski',
      intensity: 'hard',
      effortKind: 'interval',
      trainingIntent: 'hiit',
      sets: 8,
      repsMin: 45,
      repsMax: 45,
      changeKind: 'modality',
    } as any);
}

const lowLoadSkiToHiit = buildConditioningCoachPlan({
  userMessage: 'Yeah can you make it HIIT though?',
  referenceResolution: null,
  lastChange: {
    target: { kind: 'date', date: '2026-06-02', sessionName: 'Lower Squat' },
    touchedActivities: [
      {
        kind: 'conditioning',
        date: '2026-06-02',
        sessionName: 'Lower Squat',
        title: 'ski erg',
        modality: 'ski',
        intensity: 'light',
        trainingIntent: 'low_load',
        durationMinutes: 20,
        sets: 1,
        repsMin: 45,
        repsMax: 45,
        prescriptionType: 'duration_minutes',
      },
    ],
  },
});

ok('builds a plan for training-intent follow-up',
  lowLoadSkiToHiit?.kind === 'conditioning_edit',
  JSON.stringify(lowLoadSkiToHiit));
if (lowLoadSkiToHiit) {
  eq('training-intent plan preserves modality and changes quality',
    {
      customActivity: lowLoadSkiToHiit.payload.customActivity,
      replaceActivity: lowLoadSkiToHiit.payload.replaceActivity,
      modality: lowLoadSkiToHiit.payload.modality,
      intensity: lowLoadSkiToHiit.payload.intensity,
      effortKind: lowLoadSkiToHiit.payload.effortKind,
      trainingIntent: lowLoadSkiToHiit.payload.trainingIntent,
      sets: lowLoadSkiToHiit.payload.sets,
      repsMin: lowLoadSkiToHiit.payload.repsMin,
      repsMax: lowLoadSkiToHiit.payload.repsMax,
      durationMinutes: lowLoadSkiToHiit.payload.durationMinutes,
      changeKind: lowLoadSkiToHiit.payload.changeKind,
    },
    {
      customActivity: 'HIIT SkiErg Intervals',
      replaceActivity: 'ski erg',
      modality: 'ski',
      intensity: 'hard',
      effortKind: 'interval',
      trainingIntent: 'hiit',
      sets: 8,
      repsMin: 45,
      repsMax: 45,
      durationMinutes: undefined,
      changeKind: 'training_intent',
    } as any);
}

console.log(`\n— Summary —\n  Pass: ${pass}\n  Fail: ${fail}`);
if (fail > 0) {
  console.log('\n— Failures —');
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
