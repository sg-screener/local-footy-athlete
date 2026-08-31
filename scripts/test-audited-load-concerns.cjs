'use strict';

/**
 * Source-tracing regressions for the two unique load changes isolated by the
 * bf97b179 audit. These are pure programming-owner inputs, not fabricated
 * persisted athlete worlds; the enriched lived-year replay is their
 * reachability witness.
 *
 * The investigation found two independent ruled producers, not one shared
 * progression defect:
 *   - Leg Press is U-2's pre-authored early -> mid Off-season cut change.
 *   - Kettlebell Swings starts from the athlete's exact recorded 22.5 kg and
 *     adds the authored 4 kg kettlebell increment without rewriting their base.
 */
global.__DEV__ = false;
require('../node_modules/sucrase/register');

const {
  applyOffseasonMainLiftLoad,
} = require('../src/rules/composedDose');
const {
  decideBlockBoundaryLoads,
  smallestPracticalIncrementKg,
} = require('../src/rules/blockBoundaryProgression');
const {
  mainLiftSchemeForSlot,
} = require('../src/rules/phaseRepSchemes');

let passed = 0;
function check(label, condition, detail) {
  if (!condition) throw new Error(`${label}: ${detail ?? 'failed'}`);
  passed += 1;
  console.log(`PASS ${label}`);
}

const earlyLegPress = applyOffseasonMainLiftLoad({
  load: 122.5,
  isMainLift: true,
  poolSlot: 'squat',
  seasonPhase: 'Off-season',
  offseasonSubphase: 'early_offseason',
});
const midLegPress = applyOffseasonMainLiftLoad({
  load: 122.5,
  isMainLift: true,
  poolSlot: 'squat',
  seasonPhase: 'Off-season',
  offseasonSubphase: 'mid_offseason',
});
const earlyScheme = mainLiftSchemeForSlot('squat', 'Off-season', 'early_offseason');
const midScheme = mainLiftSchemeForSlot('squat', 'Off-season', 'mid_offseason');

check('audited Leg Press values come from the ruled 75% and 90% subphase cuts',
  earlyLegPress === 92.5 && midLegPress === 110,
  JSON.stringify({ earlyLegPress, midLegPress }));
check('the same authored transition drops the main-lift target from 10 to 8 reps',
  earlyScheme?.base === '3x10' && midScheme?.base === '3x8',
  JSON.stringify({ earlyScheme, midScheme }));

const kettlebellHistory = {
  completedStrengthSessions: 3,
  recordedStrengthSessions: 3,
  recoveryGood: true,
  recoveryVerdict: 'good',
  lastRecordedLoadByExercise: { 'Kettlebell Swings': 22.5 },
  lastRecordedPrescribedSetsByExercise: { 'Kettlebell Swings': 3 },
  byQuality: {
    strength: 'good', conditioning: 'unknown',
    strengthAnswerDays: 3, conditioningAnswerDays: 0,
    strengthEasy: false, conditioningEasy: false,
  },
  qualifies: true,
  reduces: false,
};
const kettlebellWorkout = {
  id: 'audited-kettlebell-week',
  workoutType: 'Strength',
  exercises: [{
    id: 'audited-kettlebell-row',
    exerciseId: 'ex-custom-kettlebell-swings',
    prescribedSets: 3,
    prescribedRepsMin: 6,
    prescribedRepsMax: 8,
    section18Evidence: {
      protocolVersion: 1,
      role: 'main_strength',
      strengthPattern: 'hinge',
      mainStrengthPattern: 'hinge',
      slot: 'hinge',
      provenance: 'composer_declaration',
    },
    exercise: { name: 'Kettlebell Swings' },
  }],
};
const kettlebellDecision = decideBlockBoundaryLoads({
  history: kettlebellHistory,
  nextBlockWorkouts: [kettlebellWorkout],
}).find((decision) => decision.exerciseName === 'Kettlebell Swings');

check('the authored kettlebell progression increment is exactly 4 kg',
  smallestPracticalIncrementKg('Kettlebell Swings', 22.5) === 4,
  String(smallestPracticalIncrementKg('Kettlebell Swings', 22.5)));
check('the audited 26.5 kg is exact athlete history plus one ruled 4 kg increment',
  kettlebellDecision?.kind === 'history_progressed'
    && kettlebellDecision.previousLoadKg === 22.5
    && kettlebellDecision.incrementKg === 4
    && kettlebellDecision.nextLoadKg === 26.5,
  JSON.stringify(kettlebellDecision));

console.log(`audited load concern tracing: ${passed} passed`);
console.log('NOT COVERED: clinical appropriateness, physical phone, changing Sam\'s 75/90 rule, or rewriting athlete-entered loads.');
