/**
 * WC-139 — THE SPRINT COMPONENT, AND THE EVIDENCE §18 CREDITS IT BY.
 *
 *   npm run test:sprint-credit-evidence
 *
 * **`Workout.speedBlock` IS THE CANONICAL SOURCE OF APP-AUTHORED SPRINT
 * CREDIT.** Visible sprint rows are not credit. That is not a style rule — it
 * is the thing that cost twelve worlds:
 *
 *     [5 ASSEMBLED] Mon speedBlock=kind=undefined tmpl=10 m Acceleration Reps
 *     [6 LEDGER]    sprintNights=0 target=1 verdict=refused
 *
 * The sprint was authored, materialised, composed and VISIBLE on the day. Its
 * block carried no `kind`, so `isTrueSpeedDay` did not see it and the week was
 * refused for having no sprint in it.
 *
 * The world here is the one that exposed it: PRE-SEASON, no club night, NO
 * FIXTURE — no anchor anywhere, so the app's own sprint is the only sprint
 * credit the week can have. Every anchored world is rescued by club or game
 * credit and cannot see this defect.
 */
// NO `declare global` — the tests project already declares `__DEV__`.
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { generateProgramLocally } from '../services/api/generateProgram';
import * as validatorModule from '../rules/validateGeneratedWeek';
import { measureGeneratedWeek, validateGeneratedWeek } from '../rules/validateGeneratedWeek';
import { CONDITIONING_TEMPLATES } from '../data/conditioningTemplates';
import type { TrainingProgram, Workout } from '../types/domain';

let passed = 0;
const failures: string[] = [];
function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

const WEEK_MONDAY = '2026-08-10';
const TEMPLATE_NAMES = new Set(CONDITIONING_TEMPLATES.map((t) => t.name));

function clockAtPhaseWeek(selectedPhase: string, phaseWeekNumber: number) {
  const entry = new Date(`${WEEK_MONDAY}T12:00:00`);
  entry.setDate(entry.getDate() - (phaseWeekNumber - 1) * 7);
  return {
    protocolVersion: 1,
    selectedPhase,
    phaseEntryWeekStartISO: `${entry.getFullYear()}-${String(entry.getMonth() + 1)
      .padStart(2, '0')}-${String(entry.getDate()).padStart(2, '0')}`,
    originProvenance: 'explicit_user_phase_change',
    persistenceProvenance: 'preserved_persisted_state',
  };
}

/**
 * The REAL input §18 was handed, captured at the seam.
 *
 * ⚠ Rebuilding a contract by hand for the mutation would prove a claim about a
 * contract nobody ships. The wrapper records exactly what generation passed.
 */
let capturedValidatorInput: { workouts: readonly Workout[]; contract: unknown;
  anchors: readonly unknown[] } | null = null;
{
  const real = (validatorModule as unknown as Record<string, unknown>)
    .validateGeneratedWeek as (input: unknown) => unknown;
  (validatorModule as unknown as Record<string, unknown>).validateGeneratedWeek =
    function wrapped(input: unknown) {
      capturedValidatorInput = input as typeof capturedValidatorInput;
      return real(input);
    };
}

/** Pre-season, no club night, NO fixture — the world with no anchor at all. */
function build(): TrainingProgram | null {
  const warn = console.warn; const log = console.log;
  console.warn = () => undefined; console.log = () => undefined;
  try {
    return generateProgramLocally({
      seasonPhase: 'Pre-season',
      trainingDaysPerWeek: 4,
      preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
      teamTrainingDaysPerWeek: 0,
      teamTrainingDays: [],
      trainingLocation: 'Commercial gym',
      equipment: ['Full Gym'],
      equipmentSelectionCompleteness: 'complete',
      experienceLevel: '2-5 years',
      conditioningLevel: 'Average',
      recentTrainingLoad: 'Pretty consistent',
      injuries: [],
    } as never, {
      todayISO: WEEK_MONDAY, blockNumber: 1, microcycleLimit: 1,
      seasonPhaseClock: clockAtPhaseWeek('Pre-season', 6),
    } as never);
  } catch { return null; } finally { console.warn = warn; console.log = log; }
}

type Speed = { kind?: string; templateName?: string; prescription?: string;
  counting?: { sprintCodExposure?: boolean }; exerciseIds?: string[] };
const speedOf = (w: Workout): Speed | undefined =>
  (w as unknown as { speedBlock?: Speed }).speedBlock;

armTotalsOrRed();
console.log('\nWC-139 — sprint credit is the speedBlock, not the rows\n');

const program = build();
ok('[non-vacuity] the no-club, no-fixture pre-season week BUILDS at all',
  program !== null);

const workouts: Workout[] = program?.microcycles[0]?.workouts ?? [];
const speedDays = workouts.filter((w) => speedOf(w) !== undefined);

ok('[non-vacuity] the week has NO anchor to borrow sprint credit from',
  workouts.every((w) => !(w as unknown as { isTeamDay?: boolean }).isTeamDay)
  && workouts.every((w) => String(w.workoutType) !== 'Game'),
  JSON.stringify(workouts.map((w) => [w.dayOfWeek, w.workoutType])));

ok('[WC-139] exactly ONE day carries a speedBlock', speedDays.length === 1,
  JSON.stringify(speedDays.map((w) => w.dayOfWeek)));

const speed = speedDays[0] ? speedOf(speedDays[0]) : undefined;
ok('[WC-139] ...and its kind is `true_speed` — the field §18 reads',
  speed?.kind === 'true_speed', JSON.stringify(speed));
ok('[WC-139] ...it names an AUTHORED template',
  speed?.templateName !== undefined && TEMPLATE_NAMES.has(speed.templateName),
  String(speed?.templateName));
ok('[WC-139] ...it carries the authored dose as its prescription, not an invented one',
  typeof speed?.prescription === 'string' && speed.prescription.length > 0,
  String(speed?.prescription));
ok('[WC-139] ...and it declares itself a sprint/COD exposure',
  speed?.counting?.sprintCodExposure === true, JSON.stringify(speed?.counting));

// ── ONE SET OF SPRINT ROWS, ONE CONDITIONING BLOCK, SPRINT FIRST ───────────
const day = speedDays[0];
const rows = day?.exercises ?? [];
const sprintRows = rows.filter((r) =>
  (r as unknown as { exercise?: { name?: string } }).exercise?.name === speed?.templateName);
ok('[WC-139] the day carries exactly ONE sprint row for that template — no '
  + 'duplicate from a second composer',
  sprintRows.length === 1,
  JSON.stringify(rows.map((r) => (r as unknown as { exercise?: { name?: string } })
    .exercise?.name)));
ok('[WC-139] the day also carries its own conditioningBlock — the sprint did NOT '
  + 'displace the hard session',
  !!(day as unknown as { conditioningBlock?: unknown })?.conditioningBlock,
  String((day as unknown as { conditioningCategory?: string })?.conditioningCategory));

const sprintOrder = sprintRows[0]?.exerciseOrder ?? Number.MAX_SAFE_INTEGER;
const condRowOrders = rows
  .filter((r) => {
    const n = (r as unknown as { exercise?: { name?: string } }).exercise?.name ?? '';
    return TEMPLATE_NAMES.has(n) && n !== speed?.templateName;
  })
  .map((r) => r.exerciseOrder);
ok('[WC-139] the sprint is ordered BEFORE the conditioning — never after it',
  condRowOrders.every((order) => sprintOrder < order),
  `sprint=${sprintOrder} conditioning=${JSON.stringify(condRowOrders)}`);

// ── THE MUTATION THE RULING NAMES ──────────────────────────────────────────
//
// Strip the speedBlock and leave every visible sprint row exactly where it is.
// The week must REFUSE: rows are not credit.
{
  const captured = capturedValidatorInput;
  const contract = captured?.contract;
  const anchors = (captured?.anchors ?? []) as never;
  const graded = (captured?.workouts ?? workouts) as Workout[];
  const stripped = graded.map((w) => {
    const copy = { ...w } as Record<string, unknown>;
    delete copy.speedBlock;
    return copy as unknown as Workout;
  });
  ok('[non-vacuity] the real §18 input was captured at the seam',
    captured !== null && graded.length > 0);
  const measuredWith = measureGeneratedWeek({
    workouts: graded, contract: contract as never, anchors,
  } as never);
  const measuredWithout = measureGeneratedWeek({
    workouts: stripped, contract: contract as never, anchors,
  } as never);
  ok('[non-vacuity] the sprint ROWS survive the strip — only the block is gone',
    stripped.every((w) => speedOf(w) === undefined)
    && stripped.some((w) => (w.exercises ?? []).some((r) =>
      (r as unknown as { exercise?: { name?: string } }).exercise?.name
        === speed?.templateName)),
    'rows must still be visible for this mutation to mean anything');
  ok('[WC-139] §18 credits the BLOCK: stripping it drops sprintNights to zero '
    + 'while the rows remain',
    measuredWith.sprintNights === 1 && measuredWithout.sprintNights === 0,
    `with=${measuredWith.sprintNights} without=${measuredWithout.sprintNights}`);

  const verdictWithout = validateGeneratedWeek({
    workouts: stripped, contract: contract as never, anchors,
  } as never);
  ok('[WC-139] ...and the week is REFUSED for it',
    verdictWithout.verdict === 'refused'
    && verdictWithout.findings.some((f) => f.clause === 'sprint_high_speed_required_minimum'),
    JSON.stringify(verdictWithout.findings.map((f) => f.clause)));
}

const total = passed + failures.length;
console.log(`\nSprint credit evidence: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
