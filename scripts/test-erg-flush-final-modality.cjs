'use strict';

/**
 * Exact final adapter shape captured from the enriched 2027-04-12 journey.
 * This is a pure session-template input, not a fabricated persisted athlete
 * world. The separate modality-persistence journey in the same package command
 * owns real onboarding, saving and restart; this cell owns the recovery-shaped
 * final card that path previously did not reach.
 */
global.__DEV__ = false;
require('../node_modules/sucrase/register');
const { buildSessionTemplate } = require('../src/utils/sessionTemplate');

const row = {
  id: 'cond-2027-04-12-main',
  workoutId: 'erg-flush-final',
  exerciseId: 'cond-2027-04-12-main',
  exerciseOrder: 1,
  prescribedSets: 4,
  prescribedRepsMin: 120,
  prescribedRepsMax: 120,
  restSeconds: 60,
  prescriptionType: 'duration',
  role: 'conditioning',
  notes: 'Work: 2 min easy\nRecovery: 1 min rest\nRounds: 4 × 3-minute blocks\nEffort: 3/10',
  exercise: { id: 'erg-flush-blocks', name: 'Erg Flush Blocks', exerciseType: 'Cardio' },
};
const workout = {
  id: 'erg-flush-final',
  microcycleId: 'erg-flush-week',
  dayOfWeek: 1,
  name: 'Aerobic Flush',
  description: '',
  intensity: 'Light',
  workoutType: 'Recovery',
  sessionTier: 'optional',
  composedOptionalKind: 'recovery',
  conditioningCategory: 'aerobic_base',
  section18ConditioningRole: 'optional_flush',
  conditioningBlock: {
    intent: 'aerobic',
    options: [{
      title: 'Erg Flush Blocks',
      description: '',
      durationMinutes: 12,
      exerciseIds: [row.id],
      modality: 'mixed',
      modalitySequence: ['bike', 'air_bike', 'ski', 'row'],
    }],
  },
  exercises: [row],
};

function cardFor(value) {
  return buildSessionTemplate(value).items.find((item) =>
    item.kind === 'exercise' && item.row.id === row.id);
}
function assertCard(label, card) {
  if (!card || card.kind !== 'exercise') throw new Error(`${label}: Erg Flush card missing`);
  if (card.modalityLabel !== 'Bike → Air Bike → SkiErg → RowErg') {
    throw new Error(`${label}: selected all-machine sequence not displayed: ${JSON.stringify(card)}`);
  }
  if (!/Effort: 3\/10/.test(String(card.row.notes ?? '')) || /\bMAS\b/.test(String(card.row.notes ?? ''))) {
    throw new Error(`${label}: wrong Erg Flush intensity wording: ${JSON.stringify(card.row.notes)}`);
  }
}

const before = cardFor(workout);
assertCard('final composition', before);
const reconstructed = JSON.parse(JSON.stringify(workout));
const after = cardFor(reconstructed);
assertCard('saved/restarted reconstruction', after);
if (JSON.stringify({ modality: before.modalityLabel, notes: before.row.notes }) !==
    JSON.stringify({ modality: after.modalityLabel, notes: after.row.notes })) {
  throw new Error('Erg Flush modality or copy changed across reconstruction');
}

console.log('PASS final recovery-shaped Erg Flush displays its selected all-machine sequence');
console.log('PASS JSON save/restart reconstruction preserves identical Erg Flush modality and copy');
console.log('NOT COVERED: physical iPhone, native onboarding taps, other recovery-shaped templates');
