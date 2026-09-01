/**
 * R-311 — real running-speed development, read from final generated weeks.
 *
 * The founding annual artifact showed three distinct failures:
 *   - Off-season weeks 1-4 carried no Speed at all;
 *   - weeks 5-8 called `Air Bike Accelerations` Speed;
 *   - a Pre-season week called incomplete-recovery `30 m Repeats` Speed.
 *
 * This tape reads only the final `Workout.speedBlock` and the exact rows it
 * owns. Selector eligibility is not delivery.
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { generateProgramLocally } from '../services/api/generateProgram';
import { CONDITIONING_TEMPLATES } from '../data/conditioningTemplates';
import type { SeasonPhase, TrainingProgram, Workout } from '../types/domain';
import { speedBlockForTemplate } from '../rules/speedTemplates';

let passed = 0;
const failures: string[] = [];
function ok(name: string, value: unknown, detail?: unknown): void {
  if (value) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}`, detail ?? '');
}

const MONDAY = '2026-09-28';
const byName = new Map(CONDITIONING_TEMPLATES.map(template => [template.name, template]));

function phaseClockAt(phase: SeasonPhase, phaseWeek: number) {
  const entry = new Date(`${MONDAY}T12:00:00`);
  entry.setDate(entry.getDate() - ((phaseWeek - 1) * 7));
  return {
    protocolVersion: 1,
    selectedPhase: phase,
    phaseEntryWeekStartISO: entry.toISOString().slice(0, 10),
    originProvenance: 'explicit_user_phase_change',
    persistenceProvenance: 'preserved_persisted_state',
  } as const;
}

function build(args: {
  phase: SeasonPhase;
  phaseWeek: number;
  team?: readonly string[];
  gameDay?: string;
}): TrainingProgram | null {
  const team = [...(args.team ?? [])];
  const previousWarn = console.warn;
  const previousLog = console.log;
  console.warn = () => undefined;
  console.log = () => undefined;
  try {
    return generateProgramLocally({
      firstName: 'SpeedWitness',
      gender: 'male',
      seasonPhase: args.phase,
      trainingDaysPerWeek: 6,
      preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      teamTrainingDaysPerWeek: team.length,
      teamTrainingDays: team,
      trainingLocation: 'Commercial gym',
      equipment: ['Full Gym'],
      equipmentSelectionCompleteness: 'complete',
      experienceLevel: '2-5 years',
      conditioningLevel: 'Average',
      recentTrainingLoad: 'Pretty consistent',
      injuries: [],
      ...(args.gameDay ? { usualGameDay: args.gameDay, gameDay: args.gameDay } : {}),
    } as never, {
      todayISO: MONDAY,
      blockNumber: Math.max(1, Math.ceil(args.phaseWeek / 4)),
      microcycleLimit: 1,
      seasonPhaseClock: phaseClockAt(args.phase, args.phaseWeek),
    } as never);
  } catch {
    return null;
  } finally {
    console.warn = previousWarn;
    console.log = previousLog;
  }
}

function speedWorkout(program: TrainingProgram | null): Workout | null {
  return program?.microcycles[0]?.workouts.find(workout =>
    workout.speedBlock?.kind === 'true_speed') ?? null;
}

function speedDetail(program: TrainingProgram | null) {
  const workout = speedWorkout(program);
  const block = workout?.speedBlock;
  const template = block?.templateName ? byName.get(block.templateName) : undefined;
  const ownedIds = new Set(block?.exerciseIds ?? []);
  return {
    workout,
    block,
    template,
    ownedRows: (workout?.exercises ?? []).filter(row => ownedIds.has(row.id)),
  };
}

armTotalsOrRed();
console.log('\nR-311 — real running-speed development\n');

const offseason = [1, 3, 5, 6, 9, 10].map(phaseWeek => ({
  phaseWeek,
  detail: speedDetail(build({ phase: 'Off-season', phaseWeek })),
}));
ok('[non-vacuity] every sampled Off-season phase step builds',
  offseason.every(sample => sample.detail.workout !== null),
  offseason.map(sample => [sample.phaseWeek, sample.detail.block?.templateName ?? null]));
ok('early Off-season uses only short 10-20 m acceleration templates',
  offseason.filter(sample => sample.phaseWeek <= 4).every(sample =>
    sample.detail.template?.quality === 'acceleration'
    && /^(10|20) m Acceleration Reps$/.test(sample.detail.template.name)),
  offseason.slice(0, 2).map(sample => sample.detail.block?.templateName ?? null));
ok('middle Off-season retains acceleration and adds progressive build-ups',
  new Set(offseason.filter(sample => sample.phaseWeek >= 5 && sample.phaseWeek <= 8)
    .map(sample => sample.detail.template?.quality)).size === 2
  && offseason.filter(sample => sample.phaseWeek >= 5 && sample.phaseWeek <= 8)
    .some(sample => sample.detail.template?.name === 'Progressive Sprint Exposure'),
  offseason.filter(sample => sample.phaseWeek >= 5 && sample.phaseWeek <= 8)
    .map(sample => sample.detail.block?.templateName ?? null));
ok('late Off-season uses small Fly 20/Fly 30 exposures',
  offseason.filter(sample => sample.phaseWeek >= 9).every(sample =>
    sample.detail.block?.templateName === 'Fly 20 (20+20)'
    || sample.detail.block?.templateName === 'Fly 30 (30+30)'),
  offseason.filter(sample => sample.phaseWeek >= 9)
    .map(sample => sample.detail.block?.templateName ?? null));
ok('every delivered Off-season Speed component is run-only and owns real rows',
  offseason.every(sample => sample.detail.block?.modality === 'run'
    && sample.detail.ownedRows.length > 0
    && sample.detail.ownedRows.some(row => row.exercise?.name === sample.detail.block?.templateName)),
  offseason.map(sample => ({ week: sample.phaseWeek, modality: sample.detail.block?.modality,
    rows: sample.detail.ownedRows.map(row => row.exercise?.name) })));

const preseasonTeam = speedDetail(build({
  phase: 'Pre-season', phaseWeek: 5, team: ['Tuesday', 'Thursday'],
}));
ok('team training may cover acceleration but does not silently cover top speed',
  preseasonTeam.template?.quality === 'top_end_speed'
  && preseasonTeam.block?.modality === 'run',
  preseasonTeam.block);

const inSeasonTeam = speedDetail(build({
  phase: 'In-season', phaseWeek: 5, team: ['Tuesday'],
}));
ok('an available in-season one-team-night week receives only a running top-speed top-up',
  inSeasonTeam.template?.quality === 'top_end_speed'
  && inSeasonTeam.block?.modality === 'run',
  inSeasonTeam.block);

const congested = speedDetail(build({
  phase: 'In-season', phaseWeek: 5, team: ['Tuesday', 'Thursday'], gameDay: 'Saturday',
}));
ok('fixture and anchor congestion may omit the app top-speed exposure',
  congested.workout === null,
  congested.block);

const allDelivered = [...offseason.map(sample => sample.detail), preseasonTeam, inSeasonTeam]
  .filter(detail => detail.workout !== null);
ok('Bike/Air Bike acceleration never satisfies a running-Speed requirement',
  allDelivered.every(detail => detail.block?.modality === 'run'
    && detail.block?.templateName !== 'Air Bike Accelerations'));
ok('incomplete-recovery repeat sprint remains conditioning, never pure Speed',
  allDelivered.every(detail => detail.template?.quality !== 'repeat_sprint'));

for (const [name, label] of [
  ['Air Bike Accelerations', 'off-feet acceleration'],
  ['20 m Shuttle Repeats', 'incomplete-recovery repeat sprint'],
] as const) {
  let refused = false;
  try {
    speedBlockForTemplate(byName.get(name)!, 'standalone');
  } catch {
    refused = true;
  }
  ok(`[factory] ${label} cannot be written as a true running-Speed block`, refused);
}

const total = passed + failures.length;
console.log(`\nReal running-speed development: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
