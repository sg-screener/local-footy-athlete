/**
 * SHORTFALL COPY, THE VOCABULARY RULE, AND DERIVE-AT-READ.
 *
 * The three boundary tests for Sam's rulings of 2026-07-29:
 *
 *   - the shortfall sentence is equality-bound BOTH DIRECTIONS against the
 *     signed record (`docs/SHORTFALL_DISCLOSURE_COPY_2026-07-29.md`), the same
 *     regime as the G-1 warning copy;
 *   - "exposure" never reaches an athlete — bound as a RULE over the forbidden
 *     vocabulary list, not as a property of one string;
 *   - achieved counts are DERIVED AT READ, never read from a stored contract.
 *     The gate is a source sweep, because the defect it prevents is someone
 *     reaching for `contract.<x>.achievedCount` again in a year.
 *
 * Run: npm run test:shortfall-copy
 */

process.env.TZ = 'Australia/Melbourne';

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import {
  ATHLETE_FORBIDDEN_VOCABULARY,
  renderSection18Shortfall,
  renderSection18ShortfallDisclosure,
  shortfallsFromFindings,
} from '../rules/section18ShortfallDisclosure';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(name);
    console.error(`  FAIL ${name}\n      ${error instanceof Error ? error.message : error}`);
  }
}

const SIGNED_RECORD = join(__dirname, '..', '..', 'docs',
  'SHORTFALL_DISCLOSURE_COPY_2026-07-29.md');

console.log('\n-- Shortfall copy, vocabulary and derive-at-read --');

// ── The signed sentence, both directions ─────────────────────────────────

run('the rendered sentence matches the signed record', () => {
  const record = readFileSync(SIGNED_RECORD, 'utf8');
  const template = record.match(/```\n(Resting \[day\][^\n]*)\n```/)?.[1];
  assert(template, 'the signed record no longer carries the sentence template');

  // Build the concrete sentence the template describes and prove the renderer
  // produces exactly it. Reading the template rather than a rendered example
  // keeps the record the authority.
  const expected = template
    .replace('[day]', 'Tuesday')
    .replace('[a/n]', 'a')
    .replace('[type]', 'strength')
    .replace('session(s)', 'session');
  const rendered = renderSection18Shortfall({ date: '2026-07-28', type: 'strength', count: 1 });
  assert(rendered === expected,
    `renderer and signed record disagree:\n        record:   "${expected}"\n        renderer: "${rendered}"`);
});

run('the signed record carries every example the renderer produces', () => {
  // The other direction: a rendering the record does not show is copy that
  // shipped without a signature.
  const record = readFileSync(SIGNED_RECORD, 'utf8');
  for (const example of [
    renderSection18Shortfall({ date: '2026-07-28', type: 'strength', count: 1 }),
    renderSection18Shortfall({ date: '2026-07-31', type: 'conditioning', count: 2 }),
  ]) {
    assert(record.includes(example),
      `the renderer produces a sentence the signed record does not carry: "${example}"`);
  }
});

run('the plural and the article move with the count', () => {
  const one = renderSection18Shortfall({ date: '2026-07-28', type: 'strength', count: 1 });
  const two = renderSection18Shortfall({ date: '2026-07-28', type: 'strength', count: 2 });
  assert(/ a strength session this week$/.test(one), `singular reads wrong: "${one}"`);
  assert(/ 2 strength sessions this week$/.test(two), `plural reads wrong: "${two}"`);
  // "an" before a vowel — the signed template's [a/n] asks for both.
  const vowel = renderSection18Shortfall({ date: '2026-07-28', type: 'aerobic', count: 1 });
  assert(/ an aerobic session this week$/.test(vowel), `article reads wrong: "${vowel}"`);
});

// ── The vocabulary rule ──────────────────────────────────────────────────

run('no forbidden word can reach the athlete through this owner', () => {
  assert(ATHLETE_FORBIDDEN_VOCABULARY.includes('exposure'),
    'the vocabulary rule no longer bans "exposure" — Sam bound this as a rule');
  const disclosure = renderSection18ShortfallDisclosure(shortfallsFromFindings({
    date: '2026-07-28',
    findings: [
      { domain: 'main_strength', expected: 3, actual: 1 },
      { domain: 'conditioning', expected: 3, actual: 2 },
    ],
  }));
  assert(disclosure, 'a real shortfall rendered nothing');
  for (const word of ATHLETE_FORBIDDEN_VOCABULARY) {
    assert(!new RegExp(`\\b${word}\\b`, 'i').test(disclosure),
      `"${word}" reached the athlete: "${disclosure}"`);
  }
});

run('a domain with no athlete word is dropped, never rendered by its code name', () => {
  const disclosure = renderSection18ShortfallDisclosure(shortfallsFromFindings({
    date: '2026-07-28',
    findings: [
      { domain: 'anchor_credit', expected: 2, actual: 0 },
      { domain: 'identity', expected: 1, actual: 0 },
      { domain: 'migration', expected: 1, actual: 0 },
    ],
  }));
  assert(disclosure === null,
    `bookkeeping domains produced athlete copy: "${disclosure}"`);
});

run('two findings in one domain read as one shortfall, not two sentences', () => {
  const shortfalls = shortfallsFromFindings({
    date: '2026-07-28',
    findings: [
      { domain: 'main_strength', expected: 3, actual: 1 },
      { domain: 'strength_patterns', expected: 2, actual: 1 },
    ],
  });
  assert(shortfalls.length === 1,
    `one strength gap rendered as ${shortfalls.length} sentences: ${JSON.stringify(shortfalls)}`);
});

// ── Derive at read ───────────────────────────────────────────────────────

/**
 * The stored tallies. Reading any of these off a CONTRACT is the defect;
 * reading them off a freshly-built LEDGER is the derivation and is correct.
 */
const STORED_TALLIES = [
  'achievedCount',
  'achievedMeaningfulMainLifts',
  'achievedPrimerCount',
  'achievedTrueFullRestCount',
  'achievedActiveRecoveryCount',
  'achievedModerateDayCount',
  'achievedHardDayCount',
];

/** Files allowed to touch stored tallies: the builder that writes them and the
 *  evaluator that derives them. Everything else asks. */
const DERIVATION_OWNERS = [
  'section18EffectiveWeekEvaluator.ts',
  'weeklyExposureContractBuilders.ts',
  'weeklyExposureContractV2.ts',
  'section18AcceptedWeekGateway.ts',
];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

run('no caller reads an achieved tally off a stored contract', () => {
  // Sam's ruling: the counts are derived at read, never stored-and-trusted.
  // `contract.x.y.achievedCount` is the shape that goes stale; `ledger.x.y
  // .achievedCount` and `evaluation.ledger...` are the derivation and are fine.
  const offenders: string[] = [];
  for (const file of sourceFiles(join(__dirname, '..'))) {
    if (DERIVATION_OWNERS.some((owner) => file.endsWith(owner))) continue;
    const source = readFileSync(file, 'utf8');
    source.split('\n').forEach((line, index) => {
      if (line.trim().startsWith('*') || line.trim().startsWith('//')) return;
      for (const tally of STORED_TALLIES) {
        if (!line.includes(tally)) continue;
        // Derivation reads go through a ledger; contract reads do not.
        if (/\b(ledger|evaluation)\b/.test(line)) continue;
        offenders.push(`${file.split('/src/')[1]}:${index + 1}  ${line.trim().slice(0, 100)}`);
      }
    });
  }
  assert(offenders.length === 0,
    'an achieved tally is being read off a stored contract — derive it instead '
    + `(Sam, 2026-07-29):\n        ${offenders.join('\n        ')}`);
});

console.log(`\nShortfall copy totals: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
