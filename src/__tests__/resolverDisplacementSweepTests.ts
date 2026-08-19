/**
 * THE RESOLVER AUTHORS NOTHING — the guard of demolition area 3.
 *
 *   npm run test:displacement-sweep
 *
 * ## WHAT THIS SUITE USED TO BE, AND WHY IT IS NOW THIS
 *
 * It was the RESOLVER DISPLACEMENT SWEEP: a table with one row per deriver in
 * `sessionResolver.ts`, proving for each that athlete-placed content outranked
 * the derived filler that deriver produced (Sam's law, 2026-07-28, extended
 * 2026-07-30). Six rows, six derivers.
 *
 * **ALL SIX DERIVERS ARE DELETED** (demolition area 3, 2026-08-19, Sam's
 * burn-the-boats ruling: *"reading/drawing a program must not author, persist,
 * restore, repair or rewrite it"*). `applyGameProximity`, `freedByTheTrip`, the
 * freed-slot prehab, the recovery rebuild, the G-2 downgrade and the read-time
 * §18 conforming pass are gone. A table proving derived filler yields to the
 * athlete has nothing left to prove: there is no derived filler.
 *
 * SO THE SUITE IS RECLASSIFIED, NOT DELETED. Its subject was the derivers; its
 * VALUE was the ratchet underneath them — *"the next person to build derived
 * content on top of an athlete's day has to say what happens to the athlete's
 * day."* That ratchet now says the stronger thing: **there is no such person,
 * because the resolver may not build derived content at all.** It reds the
 * moment read-time synthesis is reintroduced, which is exactly the completion
 * condition the demolition is measured against.
 *
 * A structural suite is a weaker instrument than a behavioural one and this
 * file says so rather than dressing up: it proves the SITES are absent, not
 * that the athlete's week is right. The behavioural cover for the rules those
 * derivers implemented (G+1 / G-1 / G-2 proximity, the away substitution) is
 * owed at their new owner — the weekly scheduler and the composer — and is on
 * the rebuild list in `docs/STATUS_DEMOLITION.md`.
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import { readFileSync } from 'fs';
import { join } from 'path';

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
    console.error(`  FAIL ${name}`, error instanceof Error ? error.message : error);
  }
}

function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')     // block and JSDoc comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // line comments, sparing `https://`
}

// THE STRIPPER IS EXERCISED, NOT TRUSTED. A green gate is a claim: if `codeOnly`
// ever degrades to the identity, every assertion below still passes on today's
// file and the defect returns silently. This fixture reds the moment it does.
run('codeOnly strips commented call sites and keeps real ones', () => {
  const fixture = [
    "const a = buildDerivedSession('real', 1);",
    "/** doc: buildDerivedSession('prose', 2) is what this reuses */",
    "// note: buildDerivedSession('comment', 3)",
  ].join('\n');
  const stripped = codeOnly(fixture);
  assert(stripped.split('buildDerivedSession(').length - 1 === 1,
    'codeOnly no longer distinguishes a real call site from prose about one');
});

const RESOLVER = codeOnly(
  readFileSync(join(__dirname, '..', 'utils', 'sessionResolver.ts'), 'utf8'),
);

run('[1] the resolver builds ZERO derived sessions', () => {
  const sites = RESOLVER.split('buildDerivedSession(').length - 1;
  assert(sites === 0,
    `the resolver builds a derived session at ${sites} site(s). Reading a program `
    + 'may not author one — the session would be invisible to §18, uneditable by '
    + 'the athlete (nothing stored to edit), and recomposed on every render. '
    + 'Its owner is the composer.');
});

run('[2] the resolver builds ZERO conditioning sessions', () => {
  const sites = RESOLVER.split('buildConditioningSession(').length - 1;
  assert(sites === 0,
    `the resolver builds a conditioning session at ${sites} site(s). This was `
    + '`freedByTheTrip`, which filled a trip-vacated day with work nobody authored.');
});

run('[3] no read-time authoring pass has been reintroduced', () => {
  const banned = [
    'applyGameProximity',
    'section18TierFour',
    'applyInjuryFilterPass',
    'freedByTheTrip',
  ];
  const present = banned.filter((name) => RESOLVER.includes(name));
  assert(present.length === 0,
    `the resolver has regained ${present.join(', ')} — each of these authored or `
    + 'rewrote the week while drawing it.');
});

run('[4] the resolver never runs the §18 gateway', () => {
  // §18 is a WRITE boundary and it REFUSES. Running it at read made it a
  // conforming pass: measured 2026-08-17, it replaced an authored
  // `lower_hinge | 5 rows` Friday with `Rest | 0 rows` on the athlete's screen.
  const present = ['runSection18AcceptedWeekGateway', 'requireSection18AcceptedWeek']
    .filter((name) => RESOLVER.includes(name));
  assert(present.length === 0,
    `the resolver calls ${present.join(', ')} — §18 belongs at the write boundaries.`);
});

run('[5] the away pass still HIDES the club, and still builds nothing', () => {
  // The distinction the demolition drew: a projection may hide, it may not
  // create. Away is still applied at read — the club's night and the club's
  // fixture come off a day inside a live trip — and it must stay a filter.
  assert(RESOLVER.includes('applyAwayPass'),
    'the away filter is gone entirely; a live trip must still take the club off the day');
  assert(RESOLVER.includes('dateIsInsideAwaySpan') || RESOLVER.includes('awaySpansFromFacts'),
    'the away pass no longer reads the away span owner');
});

console.log(`\nResolver authoring guard totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
