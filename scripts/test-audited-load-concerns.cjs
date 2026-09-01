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
 *   - Kettlebell Swings preserves the athlete's exact recorded 22.5 kg as
 *     history, then advances to the next real bell (24 kg) without rewriting
 *     that off-lattice base.
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
const {
  normaliseAutomaticExerciseLoadChange,
} = require('../src/utils/loadEstimation');

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

check('audited Leg Press targets come from the exact ruled 75% and 90% subphase cuts',
  earlyLegPress === 91.875 && midLegPress === 110.25,
  JSON.stringify({ earlyLegPress, midLegPress }));
const earlyLegPressFinal = normaliseAutomaticExerciseLoadChange({
  exerciseName: 'Leg Press', baseKg: 122.5, targetKg: earlyLegPress,
});
const midLegPressFinal = normaliseAutomaticExerciseLoadChange({
  exerciseName: 'Leg Press', baseKg: 122.5, targetKg: midLegPress,
});
check('the athlete-facing Leg Press values then round down on the machine lattice',
  earlyLegPressFinal === 90 && midLegPressFinal === 110,
  JSON.stringify({ earlyLegPressFinal, midLegPressFinal }));
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

check('the off-lattice kettlebell history advances by 1.5 kg to the next real bell',
  smallestPracticalIncrementKg('Kettlebell Swings', 22.5) === 1.5,
  String(smallestPracticalIncrementKg('Kettlebell Swings', 22.5)));
check('the audited 24 kg is the next real bell above exact 22.5 kg athlete history',
  kettlebellDecision?.kind === 'history_progressed'
    && kettlebellDecision.previousLoadKg === 22.5
    && kettlebellDecision.incrementKg === 1.5
    && kettlebellDecision.nextLoadKg === 24,
  JSON.stringify(kettlebellDecision));

console.log(`audited load concern tracing: ${passed} passed`);
console.log('NOT COVERED: clinical appropriateness, physical phone, changing Sam\'s 75/90 rule, or rewriting athlete-entered loads.');
