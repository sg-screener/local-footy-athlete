/**
 * AN EASED CONDITIONING SESSION KEEPS ITS MACHINE.
 *
 * Cohort finding FY-CCA-F003 (P1), 2026-09-03, the club-effort athlete: after
 * a hard block the boundary eases the conditioning to an aerobic template. The
 * replacement rows are composed with NEW ids, but the day's conditioning option
 * kept pointing at the OLD row ids — so the screen could no longer tell the
 * rows were on the bike. The card lost its modality and effort scale and read
 * running "% MAS" copy on a bike ("the standalone Bike flush routed through
 * the low-load exercise card"). Reproduced on `316f86e9` with
 * `scripts/athlete-cohort-year.cjs --preset=club-rpe-swings --weeks=13`
 * (weeks 12 and 13 bare).
 *
 * Run: npm run test:eased-conditioning-modality
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { applyBlockBoundaryConditioning, EASIER_AEROBIC_CATEGORY } from '../rules/blockBoundaryProgression';
import { conditioningModeLabelForRow, conditioningRowForDisplay } from '../utils/conditioningVisibleIdentity';
import type { Workout } from '../types/domain';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) { passed += 1; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}

function mixedDayOnTheBike(): Workout {
  const rows = [
    { id: 'w-strength-1', name: 'Barbell Row', role: undefined },
    { id: 'w-cond-1', name: '4 × 4 VO₂ Max', role: 'conditioning' as const },
  ];
  return {
    id: 'w', microcycleId: 'mc', dayOfWeek: 2, name: 'Upper Body Pull', description: '',
    durationMinutes: 60, intensity: 'High', workoutType: 'Mixed',
    conditioningCategory: 'vo2', conditioningFlavour: 'high-intensity', hasCombinedConditioning: true,
    conditioningBlock: {
      intent: 'vo2', options: [{
        title: 'Classic 4×4', description: 'Work: 4 min hard', exerciseIds: ['w-cond-1'],
        modality: 'bike', modalitySequence: ['bike'],
      }],
    },
    exercises: rows.map((row, index) => ({
      id: row.id, workoutId: 'w', exerciseId: row.id, exerciseOrder: index + 1,
      prescribedSets: 4, prescribedRepsMin: 1, prescribedRepsMax: 5,
      ...(row.role ? { role: row.role } : {}),
      notes: row.role ? 'Work: 4 min hard\nRecovery: 3 min complete rest\nRounds: 4\nIntensity: 90–100% MAS' : undefined,
      exercise: { id: row.id, name: row.name },
    })),
  } as unknown as Workout;
}

{
  const before = mixedDayOnTheBike();
  check('CONTROL: before the boundary the screen reads the bike from the option',
    conditioningModeLabelForRow(before, 'w-cond-1') === 'Bike');
  const [after] = applyBlockBoundaryConditioning({
    workouts: [before],
    decisions: [{ weekIndex: 0, workoutId: 'w', fromCategory: 'vo2', toCategory: EASIER_AEROBIC_CATEGORY }],
    seedISO: '2026-12-14', miniCycleNumber: 1, availableMachines: ['bike'],
  });
  const newRows = (after.exercises ?? []).filter((row) => row.role === 'conditioning');
  check('the eased session still carries conditioning rows, with new ids',
    newRows.length > 0 && newRows.every((row) => row.id !== 'w-cond-1'), JSON.stringify(newRows.map((r) => r.id)));
  const options = after.conditioningBlock?.options ?? [];
  check('F003: every eased row is referenced by the day\'s conditioning option (the ids were left stale)',
    newRows.every((row) => options.some((option) => option.exerciseIds.includes(row.id))),
    `option ids ${JSON.stringify(options.map((o) => o.exerciseIds))} rows ${JSON.stringify(newRows.map((r) => r.id))}`);
  check('F003: the screen still reads the bike for the eased rows',
    newRows.every((row) => conditioningModeLabelForRow(after, row.id) === 'Bike'),
    JSON.stringify(newRows.map((row) => conditioningModeLabelForRow(after, row.id) ?? null)));
  const shown = newRows.map((row) => conditioningRowForDisplay(after, row).notes ?? '');
  check('F003: the eased card shows an effort scale, never running "% MAS" copy on a bike',
    shown.every((notes) => /Effort:/.test(notes) && !/MAS/.test(notes)), JSON.stringify(shown));
  check('CONTROL: the option keeps its machine and the eased title',
    options.length >= 1 && options[0].modality === 'bike' && options[0].title !== 'Classic 4×4',
    JSON.stringify(options.map((o) => [o.title, o.modality])));
}

console.log(`\nEased conditioning modality: ${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
process.exit(failures.length === 0 ? 0 : 1);
