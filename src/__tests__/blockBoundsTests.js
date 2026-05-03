/**
 * Block Boundary Tests
 *
 * Verifies that computeBlockBounds() produces correct Mon→Sun aligned
 * block boundaries for every day-of-week input.
 *
 * computeBlockBounds() is the single source of truth for training block
 * date ranges. If it regresses, the calendar, block labels, week navigation,
 * and current training block display all break.
 *
 * Run:
 *   npm run test:compile && node src/__tests__/blockBoundsTests.js
 */

const assert = require('assert');
const { computeBlockBounds } = require('../utils/sessionResolver');

// ─── Helpers ───

/** Create a Date at noon on a given ISO date string. */
function dateOf(isoStr) {
  return new Date(isoStr + 'T12:00:00');
}

/** Get JS day-of-week (0=Sun, 1=Mon, ..., 6=Sat) from an ISO date string. */
function dayOfWeek(isoStr) {
  return new Date(isoStr + 'T12:00:00').getDay();
}

/** Day-of-week names for readable assertions. */
const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Inclusive day count between two ISO date strings. */
function inclusiveDays(startStr, endStr) {
  const s = new Date(startStr + 'T12:00:00');
  const e = new Date(endStr + 'T12:00:00');
  return Math.round((e.getTime() - s.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
    console.error(`    expected: ${expected}`);
    console.error(`    actual:   ${actual}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Section 1: Monday Input — Perfect Alignment
// ═══════════════════════════════════════════════════════════════
console.log('=== Section 1: Monday Input ===');
{
  // Monday 2026-04-06
  const result = computeBlockBounds(dateOf('2026-04-06'));

  check('Monday → blockStart is same Monday',
    result.blockStart, '2026-04-06');
  check('Monday → blockEnd is Sunday 27 days later',
    result.blockEnd, '2026-05-03');
  check('Monday → blockStart is a Monday',
    DOW_NAMES[dayOfWeek(result.blockStart)], 'Monday');
  check('Monday → blockEnd is a Sunday',
    DOW_NAMES[dayOfWeek(result.blockEnd)], 'Sunday');
  check('Monday → span is 28 days inclusive',
    inclusiveDays(result.blockStart, result.blockEnd), 28);
}

// ═══════════════════════════════════════════════════════════════
// Section 2: Thursday Input — Mid-Week
// ═══════════════════════════════════════════════════════════════
console.log('=== Section 2: Thursday Input ===');
{
  // Thursday 2026-04-09
  const result = computeBlockBounds(dateOf('2026-04-09'));

  check('Thursday → blockStart is previous Monday',
    result.blockStart, '2026-04-06');
  check('Thursday → blockEnd is Sunday of 4th week',
    result.blockEnd, '2026-05-03');
  check('Thursday → blockStart is a Monday',
    DOW_NAMES[dayOfWeek(result.blockStart)], 'Monday');
  check('Thursday → blockEnd is a Sunday',
    DOW_NAMES[dayOfWeek(result.blockEnd)], 'Sunday');
  check('Thursday → span is 28 days inclusive',
    inclusiveDays(result.blockStart, result.blockEnd), 28);
}

// ═══════════════════════════════════════════════════════════════
// Section 3: Saturday Input — End of Week
// ═══════════════════════════════════════════════════════════════
console.log('=== Section 3: Saturday Input ===');
{
  // Saturday 2026-04-11
  const result = computeBlockBounds(dateOf('2026-04-11'));

  check('Saturday → blockStart is previous Monday',
    result.blockStart, '2026-04-06');
  check('Saturday → blockEnd is Sunday of 4th week',
    result.blockEnd, '2026-05-03');
  check('Saturday → blockStart is a Monday',
    DOW_NAMES[dayOfWeek(result.blockStart)], 'Monday');
  check('Saturday → blockEnd is a Sunday',
    DOW_NAMES[dayOfWeek(result.blockEnd)], 'Sunday');
  check('Saturday → span is 28 days inclusive',
    inclusiveDays(result.blockStart, result.blockEnd), 28);
}

// ═══════════════════════════════════════════════════════════════
// Section 4: Sunday Input — Last Day of Mon→Sun Week
// ═══════════════════════════════════════════════════════════════
console.log('=== Section 4: Sunday Input ===');
{
  // Sunday 2026-04-12
  const result = computeBlockBounds(dateOf('2026-04-12'));

  check('Sunday → blockStart is previous Monday (same Mon→Sun week)',
    result.blockStart, '2026-04-06');
  check('Sunday → blockEnd is Sunday of 4th week',
    result.blockEnd, '2026-05-03');
  check('Sunday → blockStart is a Monday',
    DOW_NAMES[dayOfWeek(result.blockStart)], 'Monday');
  check('Sunday → blockEnd is a Sunday',
    DOW_NAMES[dayOfWeek(result.blockEnd)], 'Sunday');
  check('Sunday → span is 28 days inclusive',
    inclusiveDays(result.blockStart, result.blockEnd), 28);
}

// ═══════════════════════════════════════════════════════════════
// Section 5: Stability — All Days in Same Week Produce Same Bounds
// ═══════════════════════════════════════════════════════════════
console.log('=== Section 5: Same-Week Stability ===');
{
  // Every day of the week 2026-04-06 (Mon) → 2026-04-12 (Sun)
  // should produce identical block bounds.
  const dates = [
    '2026-04-06', // Mon
    '2026-04-07', // Tue
    '2026-04-08', // Wed
    '2026-04-09', // Thu
    '2026-04-10', // Fri
    '2026-04-11', // Sat
    '2026-04-12', // Sun
  ];

  for (const d of dates) {
    const result = computeBlockBounds(dateOf(d));
    check(`${DOW_NAMES[dayOfWeek(d)]} ${d} → blockStart stable`,
      result.blockStart, '2026-04-06');
    check(`${DOW_NAMES[dayOfWeek(d)]} ${d} → blockEnd stable`,
      result.blockEnd, '2026-05-03');
  }
}

// ═══════════════════════════════════════════════════════════════
// Section 6: Adjacent Week Boundary — Monday vs Previous Sunday
// ═══════════════════════════════════════════════════════════════
console.log('=== Section 6: Week Boundary Crossover ===');
{
  // Sunday 2026-04-12 and Monday 2026-04-13 are adjacent days
  // but belong to DIFFERENT Mon→Sun weeks.
  const sunday = computeBlockBounds(dateOf('2026-04-12'));
  const monday = computeBlockBounds(dateOf('2026-04-13'));

  check('Sunday 12 Apr → blockStart is Mon 6 Apr',
    sunday.blockStart, '2026-04-06');
  check('Monday 13 Apr → blockStart is Mon 13 Apr (new week)',
    monday.blockStart, '2026-04-13');
  check('Adjacent Sun/Mon produce different blocks',
    sunday.blockStart !== monday.blockStart, true);
  check('Monday 13 Apr → blockEnd is Sun 10 May',
    monday.blockEnd, '2026-05-10');
  check('Monday → span is 28 days inclusive',
    inclusiveDays(monday.blockStart, monday.blockEnd), 28);
}

// ═══════════════════════════════════════════════════════════════
// Section 7: Invariants Across Multiple Weeks
// ═══════════════════════════════════════════════════════════════
console.log('=== Section 7: Invariants Across Multiple Weeks ===');
{
  // Test 8 consecutive Mondays to verify invariants hold broadly.
  let monday = '2026-03-02';
  for (let i = 0; i < 8; i++) {
    const result = computeBlockBounds(dateOf(monday));

    check(`Week ${i + 1} (${monday}) → blockStart is a Monday`,
      DOW_NAMES[dayOfWeek(result.blockStart)], 'Monday');
    check(`Week ${i + 1} (${monday}) → blockEnd is a Sunday`,
      DOW_NAMES[dayOfWeek(result.blockEnd)], 'Sunday');
    check(`Week ${i + 1} (${monday}) → span is 28 days`,
      inclusiveDays(result.blockStart, result.blockEnd), 28);

    // Advance to next Monday
    const d = new Date(monday + 'T12:00:00');
    d.setDate(d.getDate() + 7);
    monday = d.toISOString().split('T')[0];
  }
}

// ═══════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(50)}`);
console.log(`Block Bounds Tests: ${passed} passed, ${failed} failed`);
console.log('═'.repeat(50));

if (failed > 0) {
  process.exit(1);
}
