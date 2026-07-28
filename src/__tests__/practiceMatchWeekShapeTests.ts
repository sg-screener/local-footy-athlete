/**
 * THE PRACTICE-MATCH WEEK IS A GAME WEEK (Sam, 2026-07-28).
 *
 * > A pre-season practice-match week is structurally an IN-SEASON GAME WEEK —
 * > same shape, 2 team trainings + 1 game — and carries the game week's
 * > authored numbers (strength 2/2/3, conditioning 3 total, sprint 1, rest 1-2,
 * > hard 4/5), not the generic pre-season row.
 *
 * WHAT THE RULING FIXES. `buildPreseasonBase` took its selected target from the
 * `practice_match_week` policy and its preferred range from the generic
 * pre-season row, so one week declared a target of 3 beside an aim of 4 — two
 * modes' numbers in one contract. Batch 0 found it by aiming at the preferred
 * maximum and watching a pre-season fixture week request a fourth strength
 * session the fixture leaves nowhere safe to place.
 *
 * The ruling is a DELETION, like `strongByeBuild` before it. There is no new
 * row: the game week's row already says what a fixture week needs, so the fix
 * is to stop writing a second one.
 *
 * WHY THIS IS ASSERTED AS AN EQUALITY, NOT AS LITERALS. Re-typing 2/2/3 here
 * would be a THIRD copy of the game-week numbers, and the next person to change
 * the authored row would leave this test agreeing with a value that no longer
 * ships. So the assertions compare a pre-season fixture week against a real
 * in-season game week built on the same schedule. If either row moves, or they
 * stop agreeing, this fails.
 *
 * Run: npm run test:practice-match-week
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';

import {
  buildWeeklyExposureContract,
  type WeeklyExposureContractInput,
} from '../rules/weeklyExposureContractBuilders';
import { resolveSection18PhasePlannerSelection } from '../rules/weeklyExposureContractV2';

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failures.push(name);
  console.error(`  FAIL ${name}`);
  if (detail !== undefined) console.error(`       ${JSON.stringify(detail)}`);
}

/** Sam's own schedule for the ruling: 2 team trainings + 1 game. */
const SCHEDULE = {
  selectedDayNumbers: [1, 2, 3, 4, 6],
  teamTrainingDayNumbers: [2, 4],
  hasGame: true,
  gameDay: 6,
  readiness: 'high',
} as const;

function contractFor(over: Partial<WeeklyExposureContractInput>): ReturnType<typeof buildWeeklyExposureContract> {
  return buildWeeklyExposureContract({
    ...SCHEDULE,
    seasonPhase: 'In-season',
    ...over,
  } as WeeklyExposureContractInput);
}

const gameWeek = contractFor({ seasonPhase: 'In-season' });
const fixtureWeek = contractFor({ seasonPhase: 'Pre-season', preseasonSubphase: 'mid_preseason' });
const plainPreseason = contractFor({
  seasonPhase: 'Pre-season', preseasonSubphase: 'mid_preseason',
  hasGame: false, gameDay: null,
});

console.log('practiceMatchWeekShapeTests');

console.log('\n[1] A pre-season fixture week carries the GAME WEEK\'s authored numbers');
{
  const slots: Array<[string, (c: typeof gameWeek) => unknown]> = [
    ['strength.required', (c) => c.strength.required],
    ['strength.preferred', (c) => c.strength.preferred],
    ['sprintCod.required', (c) => c.sprintCod.required],
    ['sprintCod.preferred', (c) => c.sprintCod.preferred],
    ['fullRest.required', (c) => c.fullRest.required],
    ['fullRest.preferred', (c) => c.fullRest.preferred],
    ['hardDays.preferredCount', (c) => c.hardDays.preferredCount],
    ['hardDays.permittedCount', (c) => c.hardDays.permittedCount],
    ['conditioning.required', (c) => c.conditioning.required],
    ['conditioning.preferred', (c) => c.conditioning.preferred],
  ];
  for (const [name, read] of slots) {
    ok(`${name} equals the in-season game week on the same schedule`,
      JSON.stringify(read(fixtureWeek)) === JSON.stringify(read(gameWeek)),
      { fixtureWeek: read(fixtureWeek), gameWeek: read(gameWeek) });
  }
}

console.log('\n[2] And is NOT the generic pre-season row');
{
  // The ruling only means something if the two rows genuinely differ. If the
  // pre-season row were ever edited into agreement, block [1] would start
  // passing for the wrong reason and this would catch it.
  ok('the generic pre-season row differs from the game-week row',
    JSON.stringify(plainPreseason.strength.preferred) !== JSON.stringify(gameWeek.strength.preferred)
    || plainPreseason.fullRest.required !== gameWeek.fullRest.required,
    { preseason: plainPreseason.strength.preferred, gameWeek: gameWeek.strength.preferred });

  ok('the fixture week does not take the pre-season strength range',
    JSON.stringify(fixtureWeek.strength.preferred) !== JSON.stringify(plainPreseason.strength.preferred),
    { fixture: fixtureWeek.strength.preferred, preseason: plainPreseason.strength.preferred });

  ok('the fixture week does not take the pre-season full-rest requirement',
    fixtureWeek.fullRest.required === gameWeek.fullRest.required,
    { fixture: fixtureWeek.fullRest.required, preseason: plainPreseason.fullRest.required });
}

console.log('\n[3] The ruling is about SHAPE — the week still sits in pre-season');
{
  // "Structurally an in-season game week" is a statement about the numbers, not
  // about where the week sits in the season. Moving the identity too would
  // hand a pre-season week an in-season subphase, and Section 18 checks the
  // declared subphase against the season phase.
  ok('the fixture week keeps its pre-season phase', fixtureWeek.identity.phase === 'Pre-season',
    fixtureWeek.identity);
  ok('the fixture week keeps its pre-season subphase',
    fixtureWeek.identity.subphase === 'mid_preseason', fixtureWeek.identity.subphase);
  ok('the in-season game week is unaffected', gameWeek.identity.phase === 'In-season'
    && gameWeek.identity.mode === 'in_season_game_week', gameWeek.identity);
}

console.log('\n[4] Contract V2 selects the same numbers for both modes');
{
  // The legacy builder and V2 must land on one row together. Leaving V2's
  // `practice_match_week` policy in place would move the second representation
  // rather than remove it — the mistake Batch 2 named when it authored the
  // owner first.
  for (const teamTrainingCount of [0, 1, 2, 3]) {
    for (const availableDayCount of [3, 4, 5, 6]) {
      const base = { readiness: 'high' as const, availableDayCount, teamTrainingCount };
      const practice = resolveSection18PhasePlannerSelection({ ...base, mode: 'practice_match_week' });
      const game = resolveSection18PhasePlannerSelection({ ...base, mode: 'in_season_game_week' });
      ok(`V2 selection agrees at team=${teamTrainingCount} days=${availableDayCount}`,
        JSON.stringify(practice) === JSON.stringify(game), { practice, game });
    }
  }
}

console.log('\n[5] There is ONE authored game-week row, not two');
{
  const source = fs.readFileSync(
    path.resolve(__dirname, '../rules/weeklyExposureContractBuilders.ts'), 'utf8');
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');

  const declarations = [...code.matchAll(/const GAME_WEEK_TARGETS = \{/g)];
  ok('the game-week shape is a single named authored object', declarations.length === 1,
    `${declarations.length} declarations`);

  // Domain-QUALIFIED, deliberately. A bare "2/2/3 appears once" is wrong: the
  // same three numbers are also `in_season_bye_recovery` and `early_offseason`
  // full-rest, and 1/1/2 is `in_season_bye_build` and `late_offseason` rest.
  // Those modes genuinely share a triple with the game week's strength row and
  // always did — a duplicate-number check would call that a defect and teach
  // the next person to "fix" unrelated authored values into disagreement.
  //
  // What must be unique is the game-week STRENGTH row specifically, and only
  // outside the constant that owns it.
  const withoutConstant = code.replace(/const GAME_WEEK_TARGETS = \{[\s\S]*?\n\} as const;/, '');
  const restated = [...withoutConstant.matchAll(
    /strength:\s*\{\s*required:\s*2,\s*preferredMin:\s*2,\s*preferredMax:\s*3/g)];
  ok('no other row restates the game-week strength triple', restated.length === 0,
    `${restated.length} restatements`);

  // And BOTH fixture weeks reach the row by the same path. Two builders each
  // spreading it would agree today and drift on the next edit, which is the
  // shape this ruling exists to remove.
  const wholeSpreads = [...code.matchAll(/\.\.\.GAME_WEEK_TARGETS,/g)];
  ok('the authored row is spread in exactly one place', wholeSpreads.length === 1,
    `${wholeSpreads.length} whole-object spreads`);

  const delegates = (fn: string): boolean => {
    const body = new RegExp(`function ${fn}\\([\\s\\S]*?\\n\\}`).exec(code)?.[0] ?? '';
    return /buildFixtureWeekContract\(/.test(body);
  };
  ok('the in-season game week delegates to the fixture builder',
    delegates('buildInSeasonGameWeekExposureContract'));
  ok('the pre-season fixture week delegates to the same builder',
    delegates('buildPreseasonBase'));
}

console.log('\n[6] The ruling is attributed where the numbers live');
{
  const source = fs.readFileSync(
    path.resolve(__dirname, '../rules/weeklyExposureContractBuilders.ts'), 'utf8');
  ok('the builder cites the ruling date', /Sam, 2026-07-28/.test(source));
  ok('the builder states the ruling in words',
    /structurally an in-season game week/i.test(source));
}

console.log(`\n${failures.length === 0 ? 'PASS' : 'FAIL'} — ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
