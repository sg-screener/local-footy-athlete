/**
 * BLOCK ROTATION STAGGER — Sam's "two or three of the six", held.
 *
 * Run: `npm run test:block-rotation-stagger`.
 *
 * The rule is pure and cross-slot, so it is tested here in isolation from the
 * composer: every cell states a whole six-seat week and reads back which seats
 * were released. A cell that could pass on one seat is not testing this rule.
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import assert from 'node:assert/strict';
import {
  STAGGER_CORE_SLOTS,
  STAGGER_MAX_HELD_BLOCKS,
  decideBlockRotationStagger,
  staggerGuardrailsHold,
  type StaggerSeat,
} from '../rules/blockRotationStagger';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();
let passed = 0;
const failures: string[] = [];
function run(name: string, body: () => void): void {
  try { body(); passed += 1; console.log(`  PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`  FAIL ${name}: ${(error as Error).message}`); }
}

/** A six-seat week where every seat could move, all A-grade, none overdue. */
function week(over: Partial<Record<string, Partial<StaggerSeat>>> = {}): StaggerSeat[] {
  return STAGGER_CORE_SLOTS.map((slot, index) => ({
    slot,
    previousIdentity: `old-${slot}`,
    wouldRotateTo: `new-${slot}`,
    blocksHeld: 1,
    currentGrade: 'A' as const,
    candidateGrade: 'A' as const,
    forced: false,
    ...(over[slot] ?? {}),
    ...(over[String(index)] ?? {}),
  }));
}
const rotated = (seats: StaggerSeat[]) =>
  decideBlockRotationStagger(seats).filter((d) => d.rotates).map((d) => d.slot);
const reasonFor = (seats: StaggerSeat[], slot: string) =>
  decideBlockRotationStagger(seats).find((d) => d.slot === slot)?.reason;

console.log('\nBLOCK ROTATION STAGGER — "two or three of the six"\n');

run('non-vacuity: all six seats CAN move in the base fixture', () => {
  assert.equal(week().filter((s) => s.wouldRotateTo && !s.forced).length, 6);
});

run('SAM\'S CORE RULE: two or three rotate, never all six', () => {
  const moved = rotated(week());
  assert(moved.length >= 2 && moved.length <= 3,
    `${moved.length} rotated: ${moved.join(', ')}`);
});

run('and the other three or four continue — nobody is left without a lift', () => {
  const decisions = decideBlockRotationStagger(week());
  assert.equal(decisions.length, 6);
  assert(decisions.filter((d) => !d.rotates).length >= 3);
});

run('EIGHT WEEKS IS A CEILING: a seat held two blocks moves even past the quota', () => {
  const overdue = week({
    squat: { blocksHeld: STAGGER_MAX_HELD_BLOCKS },
    hinge: { blocksHeld: STAGGER_MAX_HELD_BLOCKS },
    horizontal_push: { blocksHeld: STAGGER_MAX_HELD_BLOCKS },
    vertical_push: { blocksHeld: STAGGER_MAX_HELD_BLOCKS },
  });
  const moved = rotated(overdue);
  assert.equal(moved.length, 4, `expected all four overdue seats to move, got ${moved.join(', ')}`);
  for (const slot of ['squat', 'hinge', 'horizontal_push', 'vertical_push']) {
    assert.equal(reasonFor(overdue, slot), 'held_two_blocks', slot);
  }
});

run('longest-held goes first — the quota is not first-come', () => {
  const seats = week({
    squat: { blocksHeld: 0 },
    hinge: { blocksHeld: 0 },
    horizontal_push: { blocksHeld: 0 },
    vertical_push: { blocksHeld: 0 },
    horizontal_pull: { blocksHeld: 1 },
    vertical_pull: { blocksHeld: 1 },
  });
  const moved = rotated(seats);
  assert(moved.includes('horizontal_pull') && moved.includes('vertical_pull'),
    `the two oldest seats should move first, got ${moved.join(', ')}`);
});

run('A FORCED MOVE IS NOT A ROTATION — it does not spend the quota', () => {
  const seats = week({ squat: { forced: true } });
  const decisions = decideBlockRotationStagger(seats);
  assert.equal(decisions.find((d) => d.slot === 'squat')?.reason, 'forced_move');
  const planned = decisions.filter((d) => d.rotates && d.slot !== 'squat');
  assert(planned.length >= 2,
    `an injury substitution must not eat a planned rotation; planned=${planned.length}`);
});

run('a seat with nowhere to go holds, and says so', () => {
  const seats = week({ squat: { wouldRotateTo: null } });
  assert.equal(reasonFor(seats, 'squat'), 'no_alternative');
  assert(!rotated(seats).includes('squat'));
});

run('a candidate identical to what it already has is not a rotation', () => {
  const seats = week({ squat: { wouldRotateTo: 'old-squat' } });
  assert.equal(reasonFor(seats, 'squat'), 'no_alternative');
});

/* ── The guardrails ── */

run('GUARDRAIL: four of six must be A-grade', () => {
  assert(staggerGuardrailsHold(['A', 'A', 'A', 'A', 'B', 'B']));
  assert(!staggerGuardrailsHold(['A', 'A', 'A', 'B', 'B', 'B']),
    'three A-grade lifts must fail the four-of-six floor');
});

run('GUARDRAIL: no more than two B-grade primaries at once', () => {
  assert(staggerGuardrailsHold(['A', 'A', 'A', 'A', 'B', 'B']),
    'exactly two B-grade primaries is Sam\'s ceiling, not one past it');
  assert(!staggerGuardrailsHold(['A', 'A', 'A', 'B', 'B', 'B']),
    'a third B-grade primary must be refused');
});

run('A MOVE THAT WOULD BREAK A GUARDRAIL IS REFUSED, not allowed then reported', () => {
  // Already at the two-B ceiling; every remaining move would add a third.
  const seats = week({
    squat: { currentGrade: 'B', candidateGrade: 'B' },
    hinge: { currentGrade: 'B', candidateGrade: 'B' },
    horizontal_push: { candidateGrade: 'B' },
    vertical_push: { candidateGrade: 'B' },
    horizontal_pull: { candidateGrade: 'B' },
    vertical_pull: { candidateGrade: 'B' },
  });
  const decisions = decideBlockRotationStagger(seats);
  const grades = decisions.map((d) => {
    const seat = seats.find((s) => s.slot === d.slot)!;
    return d.rotates ? seat.candidateGrade : seat.currentGrade;
  });
  assert(staggerGuardrailsHold(grades),
    `the resulting week breaks a guardrail: ${grades.join(', ')}`);
  assert(decisions.some((d) => d.reason === 'guardrail_hold'),
    'a refused move must say it was the guardrail, not the quota');
});

run('the floor never manufactures a move that has nowhere to go', () => {
  const seats = week({
    hinge: { wouldRotateTo: null },
    horizontal_push: { wouldRotateTo: null },
    vertical_push: { wouldRotateTo: null },
    horizontal_pull: { wouldRotateTo: null },
    vertical_pull: { wouldRotateTo: null },
  });
  const moved = rotated(seats);
  assert.equal(moved.length, 1, `only one seat could move; got ${moved.join(', ')}`);
});

run('DETERMINISM: the same week decides the same way, every time', () => {
  const a = JSON.stringify(decideBlockRotationStagger(week()));
  const b = JSON.stringify(decideBlockRotationStagger(week()));
  assert.equal(a, b);
});

run('every seat handed in gets a decision back — none is silently dropped', () => {
  const decisions = decideBlockRotationStagger(week());
  assert.deepEqual(decisions.map((d) => d.slot), [...STAGGER_CORE_SLOTS]);
});

console.log(`\nBlock rotation stagger: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.error(`\nFAILURES:\n${failures.map((n) => `  - ${n}`).join('\n')}`);
}
totalsPrinted(failures.length);
if (failures.length > 0) process.exitCode = 1;
