/**
 * R-232 — conditioning feedback picks among Sam's authored tiers.
 *
 * Sam, 2026-08-26: feedback must affect future programming "for both
 * strength and conditioning" — WITHOUT reopening his 2026-07-27 retirement
 * of invented dose adjustments. The build: two rough logs of a tier inside
 * the block window ease that tier off the resolver's preference ladder,
 * only while an authored easier tier can still serve the day. Nothing is
 * stored; the ease derives from the feedback each run.
 *
 * Run: npm run test:conditioning-feedback-ease
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();

import {
  CONDITIONING_EASE_NOTE,
  EASE_AFTER_ROUGH_COUNT,
  EASE_EVIDENCE_WINDOW_DAYS,
  ROUGH_EFFORT_MINIMUM,
  easedConditioningTiers,
  roughConditioningEntry,
  type ConditioningFeedbackEntry,
} from '../rules/conditioningFeedbackEase';

let passed = 0;
const failures: string[] = [];

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  FAIL ${name}: ${(error as Error).message}`);
  }
}

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

const entry = (
  date: string,
  effort: number | null,
  completedFully: boolean,
  tier: ConditioningFeedbackEntry['tier'] = 'B-high',
): ConditioningFeedbackEntry => ({ date, tier, effort, completedFully });

const TODAY = '2026-08-26';

run("ROUGH is Sam's approved pair: high effort AND incomplete", () => {
  assert(roughConditioningEntry(entry('2026-08-20', 8, false)), 'effort 8 + partial is rough');
  assert(!roughConditioningEntry(entry('2026-08-20', 8, true)),
    'a brutal session FINISHED is not rough — completion is half the definition');
  assert(!roughConditioningEntry(entry('2026-08-20', 7, false)),
    `effort below ${ROUGH_EFFORT_MINIMUM} is not rough`);
  assert(!roughConditioningEntry(entry('2026-08-20', null, false)),
    'no effort answer must never classify as rough');
});

run('two rough logs of a tier ease that tier', () => {
  const eased = easedConditioningTiers({
    dateStr: TODAY,
    entries: [entry('2026-08-19', 9, false), entry('2026-08-22', 8, false)],
  });
  assert(eased.has('B-high'), 'two rough B-high logs must ease B-high');
  assert(eased.size === 1, 'no other tier is eased');
});

run('one rough log does not ease — the count is the ruling', () => {
  const eased = easedConditioningTiers({
    dateStr: TODAY,
    entries: [entry('2026-08-22', 9, false)],
  });
  assert(eased.size === 0, `${EASE_AFTER_ROUGH_COUNT} rough logs are required`);
});

run('a fine session after a rough pair clears the ease — the LAST two decide', () => {
  const eased = easedConditioningTiers({
    dateStr: TODAY,
    entries: [
      entry('2026-08-18', 9, false),
      entry('2026-08-20', 9, false),
      entry('2026-08-23', 5, true),
    ],
  });
  assert(eased.size === 0, 'the newest log is comfortable, so the tier stands');
});

run('stale evidence outside the block window does not ease today', () => {
  const eased = easedConditioningTiers({
    dateStr: TODAY,
    entries: [entry('2026-07-01', 9, false), entry('2026-07-05', 9, false)],
  });
  assert(eased.size === 0,
    `evidence older than ${EASE_EVIDENCE_WINDOW_DAYS} days must not reach today`);
});

run("a rough tier eases only ITSELF — B's pain never touches A", () => {
  const eased = easedConditioningTiers({
    dateStr: TODAY,
    entries: [
      entry('2026-08-19', 9, false, 'B-low'),
      entry('2026-08-22', 9, false, 'B-low'),
      entry('2026-08-21', 4, true, 'A'),
    ],
  });
  assert(eased.has('B-low') && !eased.has('A'), JSON.stringify([...eased]));
});

run('the planned day itself is never evidence about itself', () => {
  const eased = easedConditioningTiers({
    dateStr: '2026-08-22',
    entries: [entry('2026-08-22', 9, false), entry('2026-08-21', 9, false)],
  });
  assert(!eased.has('B-high'),
    'a log dated the planned day must not count toward easing that day');
});

/* ── THE WIRING, at the source level ─────────────────────────────────────── */

const repoRoot = path.join(__dirname, '..');
const resolver = fs.readFileSync(path.join(repoRoot, 'utils', 'conditioningRules.ts'), 'utf8');
const builder = fs.readFileSync(path.join(repoRoot, 'utils', 'sessionBuilder.ts'), 'utf8');

run('the ladder skips an eased tier ONLY when an easier authored tier exists', () => {
  assert(/easierExists/.test(resolver) && /easedFrom = easedFrom \?\? tier/.test(resolver),
    'the never-empty-the-day guard is gone from the resolver ladder');
});

run('the builder feeds the ease from stored feedback and discloses the pick', () => {
  assert(/easedConditioningTiers\(\{/.test(builder),
    'the builder no longer derives the eased set');
  assert(/CONDITIONING_EASE_NOTE/.test(builder) && /easedFromTier/.test(builder),
    'an eased pick ships without its why');
});

run('the disclosure is one short sentence (PROPOSED for Sam)', () => {
  assert(CONDITIONING_EASE_NOTE.length < 100 && /Eased/i.test(CONDITIONING_EASE_NOTE),
    CONDITIONING_EASE_NOTE);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
process.exit(0);
