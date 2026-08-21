/**
 * IS THERE ANY ATHLETE-FACING ROUTE TO "SHORT ON TIME"?
 *
 * Sam, 2026-08-21: *"Short-on-time has no current athlete-facing route. Prove
 * that, then delete its remaining implementation, tests and debt entry."*
 *
 * ⚠ THIS RAN TWICE, FOR TWO DIFFERENT JOBS.
 *
 * BEFORE THE DELETION it was the PROOF, and it passed 8/8 on a tree where every
 * symbol still existed:
 *   - the time-cap fact was written only inside a branch gated on
 *     `action.scope === 'today_only'`;
 *   - all three athlete dispatches of `set_schedule_modifier` used
 *     `current_week`, and no screen, component or hook paired that action with
 *     `today_only` at all;
 *   - `buildReadinessSignalPatch`, the only thing that could put minutes on a
 *     readiness signal, had zero production callers.
 *
 * AFTER THE DELETION it is the ABSENCE GUARD for R-126. The liveness cells it
 * used to carry cannot survive their own subject — a cell asserting "the gate is
 * still gated" is unsatisfiable once the gate is gone — so they are replaced by
 * cells that fail if any of it comes BACK.
 *
 * Run: npm run test:short-on-time-absent
 */
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..', 'src');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');
const strip = (code: string) => code
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');

let pass = 0; let fail = 0; const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: unknown) {
  if (cond) { pass += 1; console.log(`  PASS ${name}`); }
  else { fail += 1; failures.push(name); console.log(`  FAIL ${name}${detail ? `\n       ${JSON.stringify(detail)}` : ''}`); }
}

console.log('\n[1] THE IMPLEMENTATION STAYS GONE');
{
  ok('rules/timeAvailabilityPolicy.ts is not back',
    !fs.existsSync(path.join(SRC, 'rules/timeAvailabilityPolicy.ts')));

  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'dev') continue;
        walk(p); continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      const text = strip(fs.readFileSync(p, 'utf8'));
      if (/SHORT_ON_TIME_MINUTES|isShortOnTime|'short_time'/.test(text)) {
        offenders.push(path.relative(SRC, p));
      }
    }
  };
  walk(SRC);
  ok('no production file names a short-on-time symbol', offenders.length === 0, offenders);
}

console.log('\n[2] THE DOOR STAYS SHUT');
{
  /* The branch that built the fact required a `set_schedule_modifier` action
   * CONSTRUCTED with `today_only`. This looks for that construction shape, not
   * for the two words in a file: `today_only` is a general scope other LIVE
   * actions use (`set_fatigue_status` is today-scoped for Bit tired today and
   * Pretty flat), and `types/programControlAction.ts` and the router in
   * `utils/programControlActions.ts` legitimately name both. A blunt
   * both-words-present scan flags those two and proves nothing. */
  const DISPATCH = /type: 'set_schedule_modifier',[\s\S]{0,400}?scope: 'today_only'/;
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'dev') continue;
        walk(p); continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      if (DISPATCH.test(strip(fs.readFileSync(p, 'utf8')))) offenders.push(path.relative(SRC, p));
    }
  };
  walk(SRC);
  ok('nothing constructs a today-scoped set_schedule_modifier', offenders.length === 0, offenders);

  // LIVENESS FOR THAT REGEX: it must still match the shape it is looking for,
  // or a green here would only mean the pattern had rotted.
  ok('the dispatch pattern still matches its own shape (liveness)',
    DISPATCH.test("type: 'set_schedule_modifier',\n  source: {},\n  scope: 'today_only'"));

  // NON-VACUITY: the action itself must still exist, or [2] proves nothing.
  const hook = strip(read('screens/home/useHomeScreen.ts'));
  const dispatches = [...hook.matchAll(/type: 'set_schedule_modifier',[\s\S]{0,300}?scope: '([a-z_]+)'/g)]
    .map((m) => m[1]);
  ok('the athlete hook still dispatches set_schedule_modifier (liveness)',
    dispatches.length >= 2, dispatches);
  ok('and every one of them is week-scoped',
    dispatches.every((scope) => scope === 'current_week'), dispatches);
}

console.log('\n[3] THE ONE TIME ROUTE THAT IS ALIVE, AND IS NOT THIS ONE');
{
  const coach = strip(read('utils/coachTurnController.ts'));
  ok('the COACH still writes a time-cap fact (so the fact type is NOT dead)',
    /createTemporaryTimeCapFact\(\{[\s\S]{0,400}?sourceSurface: 'coach_chat'/.test(coach));
  ok('and it does not go near a short-on-time threshold',
    !/SHORT_ON_TIME_MINUTES|isShortOnTime/.test(coach));
}

console.log(`\nshort-on-time route census: ${pass} passed, ${fail} failed`);
if (fail > 0) { console.log('\nFailures:'); failures.forEach((f) => console.log(`  - ${f}`)); process.exit(1); }
console.log('\nVERDICT: "short on time" stays deleted (R-126). The coach duration answer');
console.log('is a DIFFERENT, LIVE feature and shares only the fact type.');
