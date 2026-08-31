/** R-294 — derived Movement Prep and composed Mobility are distinct identities. */
import * as fs from 'fs';
import * as path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import {
  COMPOSED_OPTIONAL_ICON_KIND,
  SESSION_SECTION_ICON_KIND,
} from '../rules/sectionIconKinds';
import { registerProjectionCopy } from '../rules/projectionCopy';
import { signedCopy } from '../rules/signedCopy';
import { buildSessionExecutionPlan, SECTION_LABELS } from '../utils/sessionExecutionChecklist';
import { buildSessionTemplate } from '../utils/sessionTemplate';

armTotalsOrRed();
let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  ✗ ${name}`, detail ?? '');
  }
}

const exerciseRow = (id: string, name: string) => ({
  id,
  exerciseId: `exercise-${id}`,
  prescribedSets: 2,
  prescribedRepsMin: 8,
  prescribedRepsMax: 10,
  restSeconds: 30,
  role: 'prehab',
  exercise: { id: `library-${id}`, name },
});

const embeddedWorkout: any = {
  id: 'strength-with-derived-prep',
  name: 'Mobility', // Deliberately misleading: copy must not decide identity.
  workoutType: 'Strength',
  exercises: [exerciseRow('squat', 'Back Squat')],
};
const embeddedPlan = buildSessionExecutionPlan({
  workout: embeddedWorkout,
  template: buildSessionTemplate(embeddedWorkout),
  mobilityFlow: {
    dayType: 'lower_squat',
    movementCount: 1,
    movements: [{
      exercise: { id: 'ankle-rocks', name: 'Ankle Rocks' },
      category: 'mobility',
    }],
  } as any,
});
const embedded = embeddedPlan.sections.find(section => section.id === 'mobility');

const standaloneWorkout: any = {
  id: 'standalone-mobility',
  name: 'Anything At All', // Typed identity, not title, must control the result.
  workoutType: 'Recovery',
  composedOptionalKind: 'mobility',
  exercises: [exerciseRow('open-book', 'Open Book Thoracic Rotation')],
};
const standalonePlan = buildSessionExecutionPlan({
  workout: standaloneWorkout,
  template: buildSessionTemplate(standaloneWorkout),
  mobilityFlow: null,
});
const standalone = standalonePlan.sections.find(section => section.sessionKind === 'mobility');

console.log('\n[movement-prep] typed section identity');
ok('derived warm-up is Movement Prep', embedded?.label === 'Movement Prep', embedded);
ok('derived warm-up uses the flame', embedded?.iconKind === 'flame', embedded);
ok('standalone typed Mobility keeps its name', standalone?.label === 'Mobility', standalone);
ok('standalone typed Mobility keeps its person icon', standalone?.iconKind === 'mobility', standalone);
ok('shared embedded label and icon maps agree',
  SECTION_LABELS.mobility === 'Movement Prep'
    && SESSION_SECTION_ICON_KIND.mobility === 'flame');
ok('composed Mobility has its separate icon identity',
  COMPOSED_OPTIONAL_ICON_KIND.mobility === 'mobility');

registerProjectionCopy();
ok('the signed Day label is Movement Prep',
  signedCopy('day.part.mobility_warmup') === 'Movement Prep');

const home = fs.readFileSync(
  path.resolve(__dirname, '..', 'screens', 'home', 'HomeScreenV2.tsx'),
  'utf8',
);
const dayMovementPrepAt = home.indexOf('testID="day-timeline-part-mobility-warmup"');
const projectedEntriesAt = dayMovementPrepAt >= 0
  ? home.indexOf("{entries.filter((entry) => entry.kind !== 'team_training').map", dayMovementPrepAt)
  : -1;
ok('CONTROL — the interactive Day Movement Prep region was found',
  dayMovementPrepAt >= 0 && projectedEntriesAt > dayMovementPrepAt,
  { dayMovementPrepAt, projectedEntriesAt });
const dayMovementPrep = dayMovementPrepAt >= 0 && projectedEntriesAt > dayMovementPrepAt
  ? home.slice(dayMovementPrepAt, projectedEntriesAt)
  : '';
ok('the Day region reads the one signed Movement Prep label',
  dayMovementPrep.length > 500
    && dayMovementPrep.includes("signedCopy('day.part.mobility_warmup')"),
  dayMovementPrep.length);
ok('the Day Movement Prep row uses flame and no mobility-person fallback',
  /<RowIcon kind="flame"[^>]+rowIconColor\('flame'\)/.test(dayMovementPrep)
    && !/<RowIcon kind="mobility"/.test(dayMovementPrep));

if (fail > 0) {
  console.error(`\nmovementPrepIdentityTests failed: ${fail}`);
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`\nmovementPrepIdentityTests passed: ${pass}`);
totalsPrinted(fail);
