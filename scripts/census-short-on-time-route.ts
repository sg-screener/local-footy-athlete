/**
 * IS THERE ANY ATHLETE-FACING ROUTE TO "SHORT ON TIME"?
 *
 * Sam, 2026-08-21: *"Short-on-time has no current athlete-facing route. Prove
 * that, then delete its remaining implementation, tests and debt entry."*
 *
 * A grep cannot answer this — the symbols are all still there. The question is
 * whether any control an athlete can press reaches them, so this walks the two
 * doors that could and checks the CONDITION each one would have to satisfy.
 *
 * Run: npm run census:short-on-time-route
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

console.log('\n[1] DOOR A — the schedule-modifier control action');
{
  const actions = strip(read('utils/programControlActions.ts'));
  // The time-cap fact is written only inside a branch gated on today_only.
  const gate = /const shortOnTimeToday =[\s\S]{0,400}?action\.scope === 'today_only';/.exec(actions);
  ok('the short-on-time fact is gated on scope === today_only', !!gate,
    gate ? gate[0].slice(0, 120) : 'gate not found — this census is reading the wrong shape');

  // Every athlete-facing dispatch of that action, with its scope.
  const hook = strip(read('screens/home/useHomeScreen.ts'));
  const dispatches = [...hook.matchAll(/type: 'set_schedule_modifier',[\s\S]{0,300}?scope: '([a-z_]+)'/g)]
    .map((m) => m[1]);
  ok('the athlete hook dispatches set_schedule_modifier at least twice (liveness)',
    dispatches.length >= 2, dispatches);
  ok('NO athlete dispatch uses today_only — the branch is unreachable',
    dispatches.every((scope) => scope !== 'today_only'), dispatches);

  // And no screen or component dispatches it directly either.
  const surfaces = ['screens', 'components', 'hooks'];
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(p); continue; }
      if (!/\.tsx?$/.test(entry.name) || p.includes('__tests__')) continue;
      const text = strip(fs.readFileSync(p, 'utf8'));
      if (/set_schedule_modifier/.test(text) && /today_only/.test(text)) {
        offenders.push(path.relative(SRC, p));
      }
    }
  };
  for (const s of surfaces) { const d = path.join(SRC, s); if (fs.existsSync(d)) walk(d); }
  ok('no screen, component or hook pairs set_schedule_modifier with today_only',
    offenders.length === 0, offenders);
}

console.log('\n[2] DOOR B — the readiness quick option');
{
  const readiness = strip(read('utils/readiness.ts'));
  ok('`short_time` is still an authored quick option (liveness — else this cell proves nothing)',
    /'short_time'/.test(readiness));

  // The ONLY thing that can put minutes on a readiness signal is the patch
  // builder. Count its production callers.
  const callers: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'dev') continue;
        walk(p); continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      if (p.endsWith(path.join('utils', 'readiness.ts'))) continue;
      if (/buildReadinessSignalPatch\s*\(/.test(strip(fs.readFileSync(p, 'utf8')))) {
        callers.push(path.relative(SRC, p));
      }
    }
  };
  walk(SRC);
  ok('buildReadinessSignalPatch has ZERO production callers, so no signal can carry minutes',
    callers.length === 0, callers);
}

console.log('\n[3] THE ONE TIME ROUTE THAT IS ALIVE, AND IS NOT THIS ONE');
{
  const coach = strip(read('utils/coachTurnController.ts'));
  ok('the COACH still writes a time-cap fact (so the fact type is NOT dead)',
    /createTemporaryTimeCapFact\(\{[\s\S]{0,400}?sourceSurface: 'coach_chat'/.test(coach));
  ok("and it does not go near SHORT_ON_TIME_MINUTES", !/SHORT_ON_TIME_MINUTES/.test(coach));
}

console.log(`\nshort-on-time route census: ${pass} passed, ${fail} failed`);
if (fail > 0) { console.log('\nFailures:'); failures.forEach((f) => console.log(`  - ${f}`)); process.exit(1); }
console.log('\nVERDICT: the athlete has no route to "short on time". The coach duration');
console.log('answer is a DIFFERENT, LIVE feature and shares only the fact type.');
