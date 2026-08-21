/**
 * R-039 HELD — FATIGUE NEVER BLOCKS AN EXPOSURE, AND NEVER COLLAPSES A SESSION.
 *
 * SAM'S ABOLITION, `LFA_PROGRAMMING_BIBLE.md:4962`, 2026-07-27, verbatim on the
 * mechanisms it killed:
 *   *"A fatigue signal at severity 7+ blocked nine exposure types (sprint,
 *   high-speed running, plyometric, explosive lower/push, heavy lower strength,
 *   max-effort strength, hard erg, change of direction) … Strength sessions lost
 *   every row and collapsed to Rest — a count reduction by SIDE EFFECT rather
 *   than by a recorded reduction, which is why it survived a migration that
 *   retired the recorded ones. Three sites shared the mechanism: the constraint
 *   builder, a rule escalating "limited" exposures to "removed" at severity 7+,
 *   and a session-action rule converting a session to recovery once 75% of its
 *   rows were stripped. All three are gone. Fatigue never blocks an exposure
 *   type and never collapses a session; the deload transform doses the work down
 *   and the session survives. Injury is untouched — a medical restriction may
 *   still block and pause."*
 *
 * Registry row R-039 read `UNENFORCED` — *"no suite named for it; the abolition
 * is recorded in the Bible and I could not name an enforcer."* Inbox item 57:
 * *"the three mechanisms are gone from production; no suite stops them coming
 * back."* This is what stops them.
 *
 * ## WHY IT IS A DIFFERENCE TEST AND NOT A SOURCE SCAN
 *
 * The abolition survives today as DELIBERATE NO-OPS — `void
 * input.readinessDeloaded;` at two sites in `weeklyExposureContractBuilders`,
 * each with a comment explaining what was removed. **A comment is not a gate.**
 * Someone reinstating a reduction there would be deleting a `void` and writing
 * ordinary-looking code, and nothing in the chain would notice.
 *
 * So the assertion is the OBSERVABLE consequence of all of it: **the weekly
 * exposure contract must be BYTE-IDENTICAL with the deload flag on and off.**
 * That is stronger than naming the three sites, and it does not decay when they
 * are refactored — it is a statement about what the athlete gets, not about
 * where the code lives.
 *
 * ## THE CONTROL IS NOT OPTIONAL
 *
 * A difference test that passes because the instrument sees NOTHING is the
 * emptiest kind of green. Block [3] proves the same comparison DOES see a
 * difference when an injury restricts patterns — so "no difference from fatigue"
 * is a finding rather than a shrug. It also pins the other half of Sam's
 * sentence: *"injury is untouched — a medical restriction may still block."*
 */

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import {
  buildWeeklyExposureContract,
  selectedExposureDaysFromCount,
  type WeeklyExposureContractInput,
} from '../rules/weeklyExposureContractBuilders';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

/**
 * THE WORLDS. Every phase and sub-phase the builder branches on, because the
 * retired mechanism lived in a phase-specific branch and a single-phase sweep
 * would have walked straight past it — `buildForPhase` sends In-season,
 * Off-season and Pre-season down three different functions, and only one of them
 * carried the site that reduced `main_strength` to zero.
 */
const WORLDS: Array<[string, WeeklyExposureContractInput]> = [];
{
  const base = {
    capacity: 'medium' as const,
    selectedDayNumbers: selectedExposureDaysFromCount(5),
    teamTrainingDayNumbers: [2, 4],
    hasGame: true,
    gameDay: 6,
  };
  for (const capacity of ['low', 'medium', 'high'] as const) {
    WORLDS.push([`in-season game week / capacity ${capacity}`,
      { ...base, capacity, seasonPhase: 'In-season' }]);
    WORLDS.push([`in-season no club / capacity ${capacity}`,
      { ...base, capacity, seasonPhase: 'In-season', teamTrainingDayNumbers: [] }]);
    WORLDS.push([`in-season bye (build) / capacity ${capacity}`,
      { ...base, capacity, seasonPhase: 'In-season', hasGame: false, gameDay: null, byeMode: 'build' }]);
    WORLDS.push([`in-season bye (recovery) / capacity ${capacity}`,
      { ...base, capacity, seasonPhase: 'In-season', hasGame: false, gameDay: null, byeMode: 'recovery' }]);
    // ⚠ THE CANONICAL SPELLINGS, AND THE COMPILER IS WHY THEY ARE RIGHT. The
    // first cut passed `'early'`/`'mid'`/`'late'` and the suite went 8/8 GREEN
    // — `test:compile` was the only thing that objected. Twenty of these thirty
    // worlds were silently falling back to one default sub-phase, so a sweep
    // advertising sub-phase coverage was covering one. A green suite is not
    // evidence that its own inputs are the ones it names.
    for (const sub of ['early', 'mid', 'late'] as const) {
      WORLDS.push([`off-season ${sub} / capacity ${capacity}`,
        { ...base, capacity, seasonPhase: 'Off-season', offseasonSubphase: `${sub}_offseason` }]);
      WORLDS.push([`pre-season ${sub} / capacity ${capacity}`,
        { ...base, capacity, seasonPhase: 'Pre-season', preseasonSubphase: `${sub}_preseason` }]);
    }
  }
}

const canon = (input: WeeklyExposureContractInput): string =>
  JSON.stringify(buildWeeklyExposureContract(input));

// ── [1] NON-VACUITY — the contracts are real and they ask for real work ────
//
// A builder returning an empty object would make every "identical" assertion
// below trivially true. This is the cell that stops that, and it asks for the
// two things the retired mechanism used to take away: strength sessions, and
// the sprint/conditioning exposures it blocked nine of.
console.log('\n[1] The contracts are real — non-vacuity first');
{
  ok('the world list covers all three phases',
    new Set(WORLDS.map(([, w]) => w.seasonPhase)).size === 3,
    JSON.stringify([...new Set(WORLDS.map(([, w]) => w.seasonPhase))]));
  let withStrength = 0;
  let withConditioning = 0;
  for (const [, world] of WORLDS) {
    const contract = buildWeeklyExposureContract(world) as any;
    if ((contract?.strength?.required ?? 0) > 0) withStrength += 1;
    if ((contract?.conditioning?.required ?? 0) > 0) withConditioning += 1;
  }
  ok('most worlds demand strength work — there is something to take away',
    withStrength >= WORLDS.length - 6, `${withStrength} of ${WORLDS.length}`);
  ok('some world demands conditioning — the other half of the nine',
    withConditioning >= 1, `${withConditioning} of ${WORLDS.length}`);
  console.log(`\n  FATIGUE CENSUS: ${WORLDS.length} worlds, ${withStrength} demanding strength`);
}

// ── [2] THE ABOLITION ──────────────────────────────────────────────────────
//
// **This is R-039.** The deload flag is the only fatigue signal that survives
// the door (R-040 — raw severity is private to the door, downstream consumes
// flags only), so "fatigue at severity 7+" reaches the contract builder as
// `readinessDeloaded: true` and as nothing else. If the contract moves at all,
// fatigue has changed STRUCTURE, and structure is the thing the deload law holds
// constant while the work inside shrinks.
console.log('\n[2] Fatigue changes NOTHING about the week\'s structure');
{
  const moved: string[] = [];
  for (const [label, world] of WORLDS) {
    const rested = canon({ ...world, readinessDeloaded: false });
    const cooked = canon({ ...world, readinessDeloaded: true });
    if (rested !== cooked) moved.push(label);
  }
  ok('a deloaded week gets the SAME exposure contract as a fresh one',
    moved.length === 0,
    `fatigue moved the contract in ${moved.length} of ${WORLDS.length} worlds:\n     `
    + moved.join('\n     ')
    + '\n     R-039 abolished fatigue exposure-blocking (Bible :4962). Counts are '
    + 'STRUCTURE; the deload transform doses the work DOWN and the session '
    + 'survives. A reduction here at any magnitude is the retired tier system in '
    + 'disguise.');

  // AND NO REDUCTION IS *RECORDED* AGAINST FATIGUE EITHER. The original defect
  // was a count reduction by SIDE EFFECT — it survived a migration that retired
  // the recorded ones precisely because it was never written down. Both halves
  // are asserted: the contract does not move, and nothing claims it should have.
  const reasoned: string[] = [];
  for (const [label, world] of WORLDS) {
    const contract = buildWeeklyExposureContract({ ...world, readinessDeloaded: true }) as any;
    for (const reduction of (contract?.reductions ?? [])) {
      const reason = String(reduction?.reason ?? '');
      if (/readiness|fatigue|cooked|wrecked|tired|deload/i.test(reason)) {
        reasoned.push(`${label} -> ${reason} (${reduction?.domain})`);
      }
    }
  }
  ok('no exposure reduction is recorded against fatigue',
    reasoned.length === 0, reasoned.join('\n     '));
}

// ── [3] THE CONTROL — the comparison CAN see a difference ──────────────────
//
// Without this, block [2] is satisfied by an instrument that never moves. It
// also pins Sam's own exception in the same sentence: *"Injury is untouched — a
// medical restriction may still block and pause."* So this cell reds in BOTH
// directions — if fatigue starts blocking, [2] goes; if injury stops blocking,
// this one does.
console.log('\n[3] The control — an INJURY still restricts, and still may block');
{
  const [, world] = WORLDS[0];
  const healthy = canon({ ...world });
  const injured = canon({
    ...world,
    activeInjuries: [{
      region: 'lower_body', pauseAffectedTraining: true, severity: 8,
      injuryKeys: ['knee'],
    }],
  });
  ok('[control] an active severe injury DOES move the contract',
    healthy !== injured,
    'if this passes while [2] also passes, the comparison is inert and [2] proves nothing');

  const contract = buildWeeklyExposureContract({
    ...world,
    activeInjuries: [{
      region: 'lower_body', pauseAffectedTraining: true, severity: 8,
      injuryKeys: ['knee'],
    }],
  }) as any;
  const patterns: string[] = contract?.strength?.requiredPatterns ?? [];
  ok('[control] and it removes the affected patterns — injury is untouched by R-039',
    !patterns.includes('squat') && !patterns.includes('hinge'),
    JSON.stringify(patterns));

  // THE ASYMMETRY IS THE WHOLE RULING, IN ONE CELL: same week, same severity,
  // one signal moves the structure and the other does not.
  const cooked = canon({ ...world, readinessDeloaded: true });
  ok('the two signals are NOT symmetric — injury moves it, fatigue does not',
    injured !== healthy && cooked === healthy);
}

// ── NOT COVERED, and it is named rather than implied ───────────────────────
//
// **MECHANISM THREE IS NOT HELD BY THIS SUITE.** Sam names three sites: the
// constraint builder, the "limited" -> "removed" escalation at severity 7+, and
// **a session-action rule converting a session to recovery once 75% of its rows
// were stripped.** The first two are exposure-contract shapes and blocks [2] and
// [3] hold them — a reinstated escalation reaches the contract or it reaches
// nothing. The third lives at the session-action layer, downstream of this
// builder, and a contract comparison cannot see it.
//
// **WHAT WOULD HOLD IT:** a cell that drives a real generated week through the
// session-action layer with the deload flag set, strips rows to past 75%, and
// asserts the session's TYPE and TIER are unchanged. That needs the action
// walker rather than a pure builder, which is a different unit and is recorded
// in `docs/STATUS_PATTERNS.md` rather than left as a silent gap.
console.log('\n  NOT COVERED: mechanism 3 (session -> recovery at 75% stripped) '
  + '— it lives below this builder; see docs/STATUS_PATTERNS.md');

const total = passed + failures.length;
console.log(`\nFatigue abolition law: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
