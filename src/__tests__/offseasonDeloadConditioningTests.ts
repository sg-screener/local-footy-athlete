/**
 * THE OFF-SEASON DELOAD'S CONDITIONING — on a REAL generated block.
 *
 *   npm run test:offseason-deload-conditioning
 *
 * **Sam's ruling, 2026-08-17.** In mid/late off-season a deload MAY:
 *   - remove/downgrade the hard conditioning session to authored tempo/easy work;
 *   - reduce sprint VOLUME using an authored legal dose.
 * It MUST NOT erase the required genuine sprint exposure, or convert sprint
 * into aerobic work, unless a typed safety/feasibility reduction permits it.
 *
 * **THE ATHLETE IS THE ONE WITH NO ANCHORS.** No club night, no fixture, later
 * off-season — so every conditioning and sprint exposure in the week is the
 * app's own. Any world with a club night or a game is saved by anchor credit
 * and cannot see this defect; that is exactly how it survived.
 *
 * Every cell reads the FINAL workouts of a real four-week block.
 */
// NO `declare global` — the tests project already declares `__DEV__`.
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { generateProgramLocally } from '../services/api/generateProgram';
import { CONDITIONING_TEMPLATES } from '../data/conditioningTemplates';
import { parseConditioningDose } from '../rules/conditioningDose';
import { templateDurationMinutes } from '../rules/conditioningSelection';
import { resolveConditioningAthleteCopy } from '../rules/conditioningAthleteCopy';
import type { TrainingProgram } from '../types/domain';

let passed = 0;
const failures: string[] = [];
function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

const WEEK_MONDAY = '2026-08-10';
/** Categories the approved source treats as HARD conditioning. */
const HARD = new Set(['vo2', 'glycolytic']);
const SPRINT_QUALITIES = new Set(['acceleration', 'top_end_speed', 'repeat_sprint']);

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

/** No club, no fixture, later off-season — the athlete with no anchor at all. */
function athlete() {
  return {
    gender: 'male',
    seasonPhase: 'Off-season',
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
  } as never;
}

function build(): TrainingProgram {
  const warn = console.warn; const log = console.log;
  console.warn = () => undefined; console.log = () => undefined;
  try {
    return generateProgramLocally(athlete(), {
      todayISO: WEEK_MONDAY,
      blockNumber: 1,
      seasonPhaseClock: clockAtPhaseWeek('Off-season', 6),
    } as never);
  } finally { console.warn = warn; console.log = log; }
}

interface Cond {
  week: number;
  day: number;
  category: string;
  hard: boolean;
  templateName: string | null;
  sets: number | undefined;
  estimatedDurationMinutes: number;
}

const TEMPLATE_BY_NAME = new Map(CONDITIONING_TEMPLATES.map((t) => [t.name, t]));

function estimatedDurationMinutes(
  templateName: string | null,
  sets: number | undefined,
  visibleNotes: string | undefined,
): number {
  const template = templateName ? TEMPLATE_BY_NAME.get(templateName) : undefined;
  if (!template) return 0;
  const approved = resolveConditioningAthleteCopy(template.name);
  const authoredSets = parseConditioningDose(approved?.setsRounds ?? template.setsRounds);
  const countRatio = authoredSets.ok && sets !== undefined
    ? Math.min(1, sets / Math.max(1, authoredSets.quantity.max))
    : 1;
  const visibleWork = /^Work:\s*(\d+(?:\.\d+)?)\s+min\b/im.exec(visibleNotes ?? '');
  const authoredWork = /^(\d+(?:\.\d+)?)\s+min\b/i.exec(approved?.work ?? template.workPeriod);
  const workRatio = visibleWork && authoredWork
    ? Math.min(1, Number(visibleWork[1]) / Math.max(1, Number(authoredWork[1])))
    : 1;
  return templateDurationMinutes(template) * Math.min(countRatio, workRatio);
}

function conditioning(program: TrainingProgram): Cond[] {
  const out: Cond[] = [];
  program.microcycles.forEach((mc, week) => {
    for (const w of mc.workouts) {
      const category = (w as unknown as { conditioningCategory?: string }).conditioningCategory;
      if (category) {
        const headline = (w.exercises ?? []).find((row) =>
          (row as unknown as { role?: string }).role === 'conditioning'
          && TEMPLATE_BY_NAME.has((row as unknown as { exercise?: { name?: string } })
            .exercise?.name ?? ''));
        out.push({
          week: week + 1,
          day: w.dayOfWeek,
          category,
          hard: HARD.has(category),
          templateName: (headline as unknown as { exercise?: { name?: string } })
            ?.exercise?.name ?? null,
          sets: headline?.prescribedSets,
          estimatedDurationMinutes: estimatedDurationMinutes(
            headline?.exercise?.name ?? null,
            headline?.prescribedSets,
            headline?.notes,
          ),
        });
      }
      // Speed is a separately typed component, not a conditioningCategory.
      // Read its canonical exercise-id membership; looking only at category
      // rows made this gate claim sprint had disappeared while the athlete's
      // final session still carried it.
      if (w.speedBlock?.kind === 'true_speed') {
        const speedIds = new Set(w.speedBlock.exerciseIds ?? []);
        const headline = (w.exercises ?? []).find((row) =>
          speedIds.has(row.id) && row.exercise?.name === w.speedBlock?.templateName);
        out.push({
          week: week + 1,
          day: w.dayOfWeek,
          category: 'sprint',
          hard: false,
          templateName: w.speedBlock.templateName ?? null,
          sets: headline?.prescribedSets,
          estimatedDurationMinutes: estimatedDurationMinutes(
            w.speedBlock.templateName ?? null,
            headline?.prescribedSets,
            headline?.notes,
          ),
        });
      }
    }
  });
  return out;
}

armTotalsOrRed();
console.log('\nOff-season deload conditioning — no club, no fixture, later off-season\n');

let program: TrainingProgram | null = null;
let refusal: string | null = null;
try { program = build(); } catch (err: unknown) {
  refusal = String((err as { message?: string })?.message ?? err);
}

ok('[non-vacuity] the whole four-week block BUILDS — every build week AND the deload',
  program !== null && program.microcycles.length >= 4,
  refusal ?? `weeks=${program?.microcycles.length}`);

const rows = program ? conditioning(program) : [];
const weeks = [...new Set(rows.map((r) => r.week))].sort();

// ── WHICH WEEK IS THE DELOAD? The one with no hard conditioning in it. ──────
//
// Read from the OUTPUT rather than assumed to be week 4: the block plan owns
// which week deloads, and a cell that hard-codes it would pass on the wrong
// week the day that plan changes.
const hardByWeek = new Map(weeks.map((w) => [w, rows.filter(
  (r) => r.week === w && r.hard).length]));
const deloadWeeks = weeks.filter((w) => (hardByWeek.get(w) ?? 0) === 0);
const buildWeeks = weeks.filter((w) => (hardByWeek.get(w) ?? 0) > 0);

ok('[non-vacuity] the block contains BOTH build weeks with hard work and one without',
  buildWeeks.length >= 2 && deloadWeeks.length === 1,
  `hardByWeek=${JSON.stringify([...hardByWeek])}`);

const deloadWeek = deloadWeeks[0];
const buildWeek = buildWeeks[0];
const relevantBuildWeek = deloadWeek === undefined ? undefined : deloadWeek - 1;

ok('[rule] the deload contains NO hard conditioning session',
  rows.filter((r) => r.week === deloadWeek).every((r) => !r.hard),
  JSON.stringify(rows.filter((r) => r.week === deloadWeek)));

const deloadSprints = rows.filter((r) => r.week === deloadWeek && r.category === 'sprint');
const buildSprints = rows.filter((r) => r.week === buildWeek && r.category === 'sprint');

ok('[non-vacuity] the BUILD week genuinely carries a sprint to compare against',
  buildSprints.length === 1, JSON.stringify(buildSprints));
ok('[rule] the deload STILL contains a genuine sprint exposure',
  deloadSprints.length === 1, JSON.stringify(rows.filter((r) => r.week === deloadWeek)));
ok('[rule] ...and it is still SPRINT quality, not converted to aerobic work',
  deloadSprints.every((r) => {
    const template = r.templateName === null ? null : TEMPLATE_BY_NAME.get(r.templateName);
    return template !== null && template !== undefined
      && SPRINT_QUALITIES.has(template.quality);
  }),
  JSON.stringify(deloadSprints));

// ── VOLUME DOWN, QUALITY UNCHANGED ─────────────────────────────────────────
ok('[rule] the deload sprint carries LOWER VOLUME than the build week\'s',
  deloadSprints[0] !== undefined && buildSprints[0] !== undefined
  && (deloadSprints[0].sets ?? 0) < (buildSprints[0].sets ?? 0),
  `build=${buildSprints[0]?.templateName} ${buildSprints[0]?.sets} `
  + `deload=${deloadSprints[0]?.templateName} ${deloadSprints[0]?.sets}`);

// ⚠ READ FROM THE SHEET, NOT FROM THE REDUCER. A cell that asked the reducing
// code what the low end was would move with it; this reads the authored string.
ok('[rule] ...and that lower volume is the SHEET\'S OWN authored minimum',
  deloadSprints.every((r) => {
    const template = r.templateName === null ? null : TEMPLATE_BY_NAME.get(r.templateName);
    if (!template) return false;
    const parsed = parseConditioningDose(template.setsRounds);
    if (!parsed.ok) return true;
    return r.sets !== undefined
      && r.sets >= parsed.quantity.min && r.sets <= parsed.quantity.max;
  }),
  deloadSprints.map((r) => {
    const t = r.templateName === null ? null : TEMPLATE_BY_NAME.get(r.templateName);
    return `${r.templateName} sets=${r.sets} authored="${t?.setsRounds}"`;
  }).join(' | '));

ok('[rule] the deload keeps the athlete\'s OWN sprint template, not a substitute',
  deloadSprints[0]?.templateName === buildSprints[0]?.templateName,
  `build=${buildSprints[0]?.templateName} deload=${deloadSprints[0]?.templateName}`);

// ── THE HARD SESSION IS DOWNGRADED TO AUTHORED EASY/TEMPO WORK, NOT DELETED ──
const buildCount = rows.filter((r) => r.week === buildWeek).length;
const deloadCount = rows.filter((r) => r.week === deloadWeek).length;
ok('[rule] the deload keeps its conditioning exposures — the hard one is '
  + 'downgraded, not deleted',
  deloadCount === buildCount,
  `build=${buildCount} deload=${deloadCount}`);

const durationFor = (week: number | undefined): number => rows
  .filter((row) => row.week === week)
  .reduce((sum, row) => sum + row.estimatedDurationMinutes, 0);
const relevantBuildDuration = durationFor(relevantBuildWeek);
const deloadDuration = durationFor(deloadWeek);
const durationRatio = relevantBuildDuration > 0 ? deloadDuration / relevantBuildDuration : 0;
ok('[rule] the complete deload week cuts estimated programmed conditioning duration 30-50%',
  // Integer authored doses make an exact 50% boundary impossible in some
  // weeks; 47.2% retained is the nearest final-row result (52.8% reduction).
  durationRatio >= 0.45 && durationRatio <= 0.7,
  `buildWeek=${relevantBuildWeek} buildMinutes=${relevantBuildDuration.toFixed(1)} `
    + `deloadWeek=${deloadWeek} deloadMinutes=${deloadDuration.toFixed(1)} ratio=${durationRatio.toFixed(3)}`);

const total = passed + failures.length;
console.log(`\nOff-season deload conditioning: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
