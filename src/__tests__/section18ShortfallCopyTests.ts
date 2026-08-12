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


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
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
  const rendered = renderSection18Shortfall(
    { date: '2026-07-28', type: 'strength', count: 1, cause: 'athlete_rest', fits: 2 });
  assert(rendered === expected,
    `renderer and signed record disagree:\n        record:   "${expected}"\n        renderer: "${rendered}"`);
});

run('the signed record carries every example the renderer produces', () => {
  // The other direction: a rendering the record does not show is copy that
  // shipped without a signature.
  const record = readFileSync(SIGNED_RECORD, 'utf8');
  for (const example of [
    renderSection18Shortfall(
      { date: '2026-07-28', type: 'strength', count: 1, cause: 'athlete_rest', fits: 2 }),
    renderSection18Shortfall(
      { date: '2026-07-31', type: 'conditioning', count: 2, cause: 'athlete_rest', fits: 1 }),
  ]) {
    assert(record.includes(example),
      `the renderer produces a sentence the signed record does not carry: "${example}"`);
  }
});

run('the plural and the article move with the count', () => {
  const one = renderSection18Shortfall(
    { date: '2026-07-28', type: 'strength', count: 1, cause: 'athlete_rest', fits: 2 });
  const two = renderSection18Shortfall(
    { date: '2026-07-28', type: 'strength', count: 2, cause: 'athlete_rest', fits: 1 });
  assert(/ a strength session this week$/.test(one), `singular reads wrong: "${one}"`);
  assert(/ 2 strength sessions this week$/.test(two), `plural reads wrong: "${two}"`);
  // "an" before a vowel — the signed template's [a/n] asks for both.
  const vowel = renderSection18Shortfall(
    { date: '2026-07-28', type: 'aerobic', count: 1, cause: 'athlete_rest', fits: 2 });
  assert(/ an aerobic session this week$/.test(vowel), `article reads wrong: "${vowel}"`);
});

// ── THE FIXTURE SENTENCE (Sam 2026-08-12, fixture-only ruling 2026-08-13) ──
//
// One sentence served two causes and blamed the athlete for the club's draw.
// These cells hold BOTH branches and, just as hard, the DAY each one names —
// because the day was wrong too and no cell could see it.

run('the fixture sentence matches the signed record, both directions', () => {
  const record = readFileSync(SIGNED_RECORD, 'utf8');
  const template = record.match(/```\n(With a game \[day\][^\n]*)\n```/)?.[1];
  assert(template, 'the signed record no longer carries the fixture template');
  const expected = template
    .replace('[day]', 'Saturday')
    .replace('[n]', 'two')
    .replace('[type]', 'strength')
    .replace('session(s)', 'sessions');
  const rendered = renderSection18Shortfall(
    { date: '2026-08-15', type: 'strength', count: 1, cause: 'fixture', fits: 2 });
  assert(rendered === expected,
    `renderer and signed record disagree:\n        record:   "${expected}"\n        renderer: "${rendered}"`);
  // The other direction: a rendering the record does not show is unsigned copy.
  for (const example of [
    rendered,
    renderSection18Shortfall(
      { date: '2026-08-16', type: 'conditioning', count: 2, cause: 'fixture', fits: 1 }),
  ]) {
    assert(record.includes(example),
      `the renderer produces a fixture sentence the record does not carry: "${example}"`);
  }
});

run('the fixture sentence states what FITS, never what is missed', () => {
  // `count` and `fits` are deliberately different numbers here: if the renderer
  // reached for `count` the sentence would read "only room for a", which is the
  // exact confusion the order warns about.
  const rendered = renderSection18Shortfall(
    { date: '2026-08-15', type: 'strength', count: 1, cause: 'fixture', fits: 2 });
  assert(/only room for two strength sessions this week$/.test(rendered), rendered);
});

run('the athlete\'s own rest mark KEEPS the original sentence', () => {
  // Sam: "Do not replace it; it was never the defect." Including its digit at
  // two, which his 2026-07-29 signature already covers.
  const rest = renderSection18Shortfall(
    { date: '2026-08-14', type: 'strength', count: 2, cause: 'athlete_rest', fits: 1 });
  assert(rest === 'Resting Friday means you\'ll miss 2 strength sessions this week', rest);
});

run('each sentence names the day belonging to its CAUSE', () => {
  // THE DEFECT THIS CELL EXISTS FOR: the one production call site used to pass
  // `weekStart`, so every Monday-start week said "Resting Monday" whichever day
  // was rested — and whether or not anything was rested at all.
  const week = [
    { domain: 'main_strength' as const, expected: 3, actual: 2 },
  ];
  const fixture = shortfallsFromFindings({
    gameDate: '2026-08-15', restedDate: '2026-08-13', findings: week,
  });
  assert(fixture[0]?.cause === 'fixture' && fixture[0]?.date === '2026-08-15',
    `a week with a game must name the GAME day: ${JSON.stringify(fixture)}`);
  assert(/^With a game Saturday,/.test(renderSection18Shortfall(fixture[0]!)),
    renderSection18Shortfall(fixture[0]!));

  const rested = shortfallsFromFindings({ restedDate: '2026-08-13', findings: week });
  assert(rested[0]?.cause === 'athlete_rest' && rested[0]?.date === '2026-08-13',
    `a week with no game must name the RESTED day: ${JSON.stringify(rested)}`);
  assert(/^Resting Thursday means/.test(renderSection18Shortfall(rested[0]!)),
    renderSection18Shortfall(rested[0]!));

  // NEITHER FACT = NO SENTENCE. Better silence than naming a day nobody chose,
  // which is what the weekStart default did.
  assert(shortfallsFromFindings({ findings: week }).length === 0,
    'a week with neither a game nor a rest mark still produced a sentence');
});

run('the TRANSACTION hands the sentence the week\'s real days, not the week start', () => {
  // THIS CELL EXISTS BECAUSE A MUTATION SURVIVED WITHOUT IT. Reverting the call
  // site to `date: weekStart` left every pure cell above green while the athlete
  // read "Resting Monday" again — the pure functions were right and the WIRING
  // was the defect, which is the same class as a reader that stops at the rule.
  const source = readFileSync(join(__dirname, '..', 'store', 'acceptedStateTransaction.ts'), 'utf8');
  assert(source.length > 4000, 'the transaction source was not read');
  assert(/shortfallDayFacts\(weekStart, visibleWorkouts, markedDays\)/.test(source),
    'the shortfall no longer derives its days from the week the athlete actually has');
  // THE ATHLETE'S OWN MARKS ARE THE PRIMARY FACT. A rest mark is a CALENDAR
  // fact, not a workout named Rest; reading only the sessions silenced the
  // disclosure on the exact case the accept-and-reduce ruling exists for.
  assert(/recordAcceptedWeekShortfall\(\s*\n?\s*weekStart, evaluation\.blockingViolations, rebased\.visibleWorkouts, context\.markedDays\)/.test(source),
    'the transaction stopped handing the shortfall the calendar marks');
  assert(/shortfallsFromFindings\(\{\s*gameDate,\s*restedDate,/.test(source),
    'the shortfall is not being handed a gameDate/restedDate pair');
  // The old shape, banned by name: a bare `date:` back into the producer is the
  // defect returning under a different spelling.
  assert(!/shortfallsFromFindings\(\{\s*date:/.test(source),
    'a bare `date:` is being passed to shortfallsFromFindings again — that is the '
    + 'week-start defect, which named the wrong day on every Monday-start week');
  // And the identity owner is ASKED, never re-implemented: a third private copy
  // of "is this a game" is the defect this repo keeps finding.
  assert(/classifyDaySessions\(/.test(source),
    'the transaction stopped asking the session-identity owner what a game is');
});

run('`fits` is READ from the finding, never derived by subtracting a target', () => {
  const shortfalls = shortfallsFromFindings({
    gameDate: '2026-08-15',
    findings: [{ domain: 'main_strength', expected: 4, actual: 2 }],
  });
  assert(shortfalls[0]?.fits === 2 && shortfalls[0]?.count === 2,
    `fits/count read wrong: ${JSON.stringify(shortfalls)}`);
});

// ── The vocabulary rule ──────────────────────────────────────────────────

run('no forbidden word can reach the athlete through this owner', () => {
  assert(ATHLETE_FORBIDDEN_VOCABULARY.includes('exposure'),
    'the vocabulary rule no longer bans "exposure" — Sam bound this as a rule');
  const disclosure = renderSection18ShortfallDisclosure(shortfallsFromFindings({
    restedDate: '2026-07-28',
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
    restedDate: '2026-07-28',
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
    restedDate: '2026-07-28',
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
  // THE LAW REGISTRY IS PROSE ABOUT DEFECTS, NOT A CALLER. Its rows NAME
  // `achievedModerateDayCount` inside receipt STRINGS while describing the very
  // defect this cell hunts, and the scan skips `//` and `*` comment lines but
  // not string literals — so the registry reported itself. MEASURED, not
  // assumed: both offenders already matched at 6cd253f4, so this cell has been
  // red since before 2026-08-13 and was reporting an instrument fault rather
  // than a defect. Excluding a module that READS NOTHING is not a loosening;
  // the cell's subject is a caller reading a stored tally, and a receipt is not
  // a caller.
  'lawRegistry.ts',
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
totalsPrinted(failed);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
