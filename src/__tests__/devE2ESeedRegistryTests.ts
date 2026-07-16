import {
  DEV_E2E_SEED_IDS,
  buildDevE2ESeed,
  validateDevE2EWitnesses,
} from '../dev/e2e/devE2ESeedRegistry';

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(`${name}${detail ? `: ${detail}` : ''}`);
    console.log(`  ✗ ${name}`);
  }
}

const originalFetch = globalThis.fetch;
let fetchCalls = 0;
globalThis.fetch = (async () => {
  fetchCalls += 1;
  throw new Error('fetch must not be called by a dev E2E seed');
}) as typeof fetch;

try {
  for (const seedId of DEV_E2E_SEED_IDS) {
    const seed = buildDevE2ESeed(seedId);
    const calendarMarks = seed.witnesses
      .filter((witness) => witness.kind === 'calendar_mark')
      .reduce<Record<string, 'game' | 'rest' | 'noGame'>>((marks, witness) => {
        marks[witness.date] = witness.mark;
        return marks;
      }, {});
    const hasInjury = seed.auxiliaryState.some((item) => item.kind === 'active_injury');
    const hasEquipment = seed.auxiliaryState.some((item) => item.kind === 'temporary_equipment');
    const feedback = seed.auxiliaryState.find((item) => item.kind === 'session_feedback');
    const failuresForSeed = validateDevE2EWitnesses(seedId, seed.witnesses, {
      program: seed.program,
      profile: seed.profile,
      calendarMarks,
      activeInjury: hasInjury ? { bodyPart: 'Right hamstring', severity: 5 } : null,
      activeConstraints: hasEquipment
        ? [{ id: 'equipment-temporary:2026-07-13', type: 'equipment', reasonLabel: 'Bodyweight only' }]
        : [],
      sessionFeedback: feedback && feedback.kind === 'session_feedback'
        ? { [feedback.date]: { completion: feedback.completion } }
        : {},
    });
    ok(`${seedId} has an explicit anchor`, /^\d{4}-\d{2}-\d{2}$/.test(seed.anchorDate));
    ok(`${seedId} builds an accepted-program witness`, failuresForSeed.length === 0, failuresForSeed.join(', '));
    ok(`${seedId} has visible witnesses`, seed.witnesses.length >= 2);
  }
  ok('no named seed calls fetch', fetchCalls === 0, `fetchCalls=${fetchCalls}`);
} finally {
  globalThis.fetch = originalFetch;
}

console.log(`\nDev E2E seed registry: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  failures.forEach((failure) => console.log(`  • ${failure}`));
  process.exit(1);
}
