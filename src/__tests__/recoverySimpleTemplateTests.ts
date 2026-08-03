/**
 * D13 — recovery-type days keep their own simple template (§6 item 3).
 *
 * Sam ruled recovery days OUT of the one-list redesign: no role badges, and no
 * collapsed Mobility & Prehab flow on top, because a whole recovery day would
 * make the flow redundant.
 *
 * "Keeps its own template" is a CONSERVATION claim, and conservation claims are
 * where refactors quietly lose things. The one-list rewrite moved four render
 * calls; a recovery day has to come out of it rendering everything it rendered
 * before and nothing it did not. So this suite does not just assert the mode
 * flag — it walks each thing the old screen put on a recovery day and checks it
 * still arrives:
 *
 *   - the recovery exercise rows           (RecoveryBlock, unchanged)
 *   - the optional add-on box              (RecoveryAddonSection, unchanged)
 *   - trunk/support rows                   (never rendered here — the component
 *                                           owner returns none for recovery)
 *
 * And one thing that must NOT arrive. The power primer used to render above the
 * branch split, so it reached recovery days by accident of layout. Stage 4
 * originally restored it on conservation grounds; Sam ruled on 2026-07-27 that
 * power work does not belong on a recovery day at all, so the legacy behaviour
 * was preserving a bug. §4 pins its absence.
 *
 * Run: npm run test:recovery-template
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import path from 'path';

import { buildSessionTemplate } from '../utils/sessionTemplate';
import { getSessionComponentRows } from '../utils/sessionComponents';
import { selectMobilityPrehabFlow } from '../utils/mobilityPrehabFlow';
import { DEFAULT_ATHLETE_CONTEXT } from '../utils/sessionBuilder';

const src = path.resolve(__dirname, '..');

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

let rowSeq = 0;
function row(name: string): any {
  rowSeq += 1;
  return {
    id: `rec-${rowSeq}`,
    exerciseId: `ex-${rowSeq}`,
    exerciseOrder: rowSeq,
    prescribedSets: 1,
    prescribedRepsMin: 30,
    prescribedRepsMax: 45,
    restSeconds: 0,
    prescriptionType: 'duration',
    exercise: { id: `lib-${rowSeq}`, name },
  };
}

function recoveryWorkout(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'w-rec',
    microcycleId: 'm1',
    dayOfWeek: 0,
    name: 'Recovery',
    description: '',
    durationMinutes: 30,
    intensity: 'low',
    workoutType: 'Recovery',
    exercises: [row('Couch Stretch'), row('Cat-Cow'), row('90/90 Breathing')],
    ...overrides,
  };
}

const screen = fs.readFileSync(
  path.join(src, 'screens/home/DayWorkoutScreenV2.tsx'),
  'utf8',
);

/* ══ 1. A recovery day takes the recovery template ══ */

console.log('\n[1] Recovery days route to their own template');
{
  ok(
    'workoutType Recovery takes the recovery mode',
    buildSessionTemplate(recoveryWorkout()).mode === 'recovery',
  );
  ok(
    'sessionTier recovery takes it too, whatever the workoutType says',
    buildSessionTemplate(
      recoveryWorkout({ workoutType: 'Conditioning', sessionTier: 'recovery' }),
    ).mode === 'recovery',
    'the AI can tag a recovery session as Conditioning; the tier is the tiebreak',
  );
  ok(
    'a non-recovery day does NOT get the recovery template',
    buildSessionTemplate({
      ...recoveryWorkout(),
      workoutType: 'Strength',
      sessionTier: undefined,
    } as any).mode === 'badged_list',
  );
}

/* ══ 2. No badges, no flow ══ */

console.log('\n[2] No badges and no flow on a recovery day');
{
  const template = buildSessionTemplate(recoveryWorkout());
  ok('the recovery template emits no badged items', template.items.length === 0);
  ok(
    'no flow is offered',
    selectMobilityPrehabFlow({
      workout: recoveryWorkout(),
      seasonPhase: 'In-season',
      isGameWeek: false,
      athlete: DEFAULT_ATHLETE_CONTEXT,
      date: '2026-07-30',
    }) === null,
  );
  ok(
    'the screen renders the plain RecoveryBlock on this branch',
    /mode === 'recovery' \? \([\s\S]{0,900}<RecoveryBlock/.test(screen),
  );
  ok(
    'the recovery rows carry no role badge',
    !/<RecoveryBlock[\s\S]{0,400}SessionRoleBadge/.test(screen),
  );
}

/* ══ 3. Conservation — everything the old screen showed still arrives ══ */

console.log('\n[3] Nothing a recovery day used to render was lost');
{
  const recoveryBranch = screen.slice(
    screen.indexOf("sessionTemplate.mode === 'recovery' ? ("),
    screen.indexOf(') : ('),
  );

  ok('the recovery branch was located in the source', recoveryBranch.length > 0);
  ok(
    'the recovery exercise rows still render',
    /<RecoveryBlock/.test(recoveryBranch),
  );
  ok(
    'the optional add-on box still renders',
    /<RecoveryAddonSection/.test(recoveryBranch),
  );
  // Trunk/support was never shown on a recovery day: the shared component owner
  // returns no support rows for one. Pinned so "we dropped the box" can never be
  // mistaken for "we dropped content".
  const rows = getSessionComponentRows(recoveryWorkout({
    exercises: [row('Couch Stretch'), row('Dead Bug')],
  }));
  ok(
    'the component owner returns no trunk/support rows for a recovery day',
    rows.supportRows.length === 0,
    'so retiring the Trunk / Support box cost a recovery day nothing',
  );
  ok(
    'and it returns no strength rows either',
    rows.strengthRows.length === 0,
  );
}

/* ══ 4. Power work does not belong on a recovery day ══ */

console.log('\n[4] The power primer is gone from recovery days (Sam, 2026-07-27)');
{
  ok(
    'the screen no longer renders a power primer anywhere',
    !/PowerPrimerSection/.test(screen),
    'it survived on recovery days only as a legacy of rendering above the old branch split',
  );

  // The owner never emitted a power item for a recovery day, so removing the
  // render call leaves no path by which power can reach one.
  const withPower = buildSessionTemplate(
    recoveryWorkout({
      powerBlock: {
        id: 'pb1',
        kind: 'primer',
        title: 'Broad Jumps',
        prescription: '3 x 3',
        options: [],
        notes: [],
      },
    }),
  );
  ok(
    'a recovery day stays a recovery template — no items, power or otherwise',
    withPower.items.length === 0,
  );
}

console.log(`\n${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
