/**
 * WC-136 / WC-137 — THE CONDITIONING RESPONSE, THROUGH A REAL ROLLOVER.
 *
 *   npm run test:conditioning-rollover
 *
 * **BLOCK 1 IS GENERATED, NOT HAND-BUILT.** Every cell asks
 * `generateProgramLocally` for block 1, reads the authored hard session out of
 * it, writes the athlete's feedback about THAT block, then asks for block 2 and
 * reads what changed. A fixture week would prove the deciders work on a shape
 * nobody ships; the whole point of this unit was that a session survived every
 * decider and then died on the way to the athlete.
 *
 * ⚠ **BLOCK 1 MUST GENUINELY CONTAIN A HARD SESSION OR THE REDUCE PROOF IS
 * VACUOUS.** `decideBlockBoundaryConditioning` only fires on a category in
 * `HARD_CONDITIONING_CATEGORIES`, and until this mission the app produced none
 * — the rule sat unreachable for months. The first cell of each pair asserts
 * the precondition before the response is asserted at all.
 */
// NO `declare global` — the tests project already declares `__DEV__`.
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { generateProgramLocally } from '../services/api/generateProgram';
import { HARD_CONDITIONING_CATEGORIES } from '../rules/blockBoundaryProgression';
import { nextAuthoredDose } from '../rules/conditioningDoseStep';
import { parseConditioningDose } from '../rules/conditioningDose';
import { CONDITIONING_TEMPLATES } from '../data/conditioningTemplates';
import type { TrainingProgram } from '../types/domain';
import type { SessionFeedback } from '../store/programStore';

let passed = 0;
const failures: string[] = [];
function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

/** Block 1 runs 2026-07-06 → 2026-08-02; block 2 is authored from 2026-08-03. */
const BLOCK_1_DATES = [
  '2026-07-06', '2026-07-08', '2026-07-10', '2026-07-13', '2026-07-15', '2026-07-17',
  '2026-07-20', '2026-07-22', '2026-07-24', '2026-07-27', '2026-07-29', '2026-07-31',
];
const BLOCK_2_TODAY = '2026-08-03';

/** Pre-season, no club — the shape this mission gave a real hard session to. */
function athlete() {
  return {
    seasonPhase: 'Pre-season',
    trainingDaysPerWeek: 4,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    gameDay: 'Saturday',
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete',
    experienceLevel: '2-5 years',
    conditioningLevel: 'Average',
    recentTrainingLoad: 'Pretty consistent',
    injuries: [],
  } as never;
}

/**
 * The athlete's recorded block, with the two answers this unit reads.
 *
 * ⚠ **THE STRENGTH VERDICT IS ONLY READ ON A DAY THAT CARRIES NO CONDITIONING
 * ANSWER**, and my first fixture put a conditioning RPE on every date. That
 * made `sawStrengthQualityAnswer` permanently false, so `strengthEasy` could
 * never be true and the *"everything consistently easy"* gate was unreachable —
 * mutation N4 deleted it and reddened nothing.
 *
 * `readBlockHistory` is right to work this way: conditioning always rides a
 * strength day, so on a combined day `feeling` cannot say WHICH quality was
 * hard. The fixture now models the real shape — alternate dates carry the
 * conditioning answer, the rest carry strength alone — so the two verdicts can
 * actually disagree, which is the entire point of `byQuality`.
 */
function history(args: {
  conditioningRpe: number;
  feeling: string;
  soreness: string;
}): Record<string, SessionFeedback> {
  const feedback: Record<string, SessionFeedback> = {};
  BLOCK_1_DATES.forEach((dateStr, index) => {
    const carriesConditioning = index % 2 === 0;
    feedback[dateStr] = {
      dateStr,
      completion: 'full',
      feeling: args.feeling,
      soreness: args.soreness,
      ...(carriesConditioning ? { conditioning: { rpe: args.conditioningRpe } } : {}),
      strength: [{
        exerciseId: 'ex-0',
        workoutExerciseId: 'wex-0',
        exerciseName: 'Back Squat',
        prescribedSets: 3,
        prescribedRepsMin: 5,
        prescribedRepsMax: 5,
        weightKg: 100,
        completion: 'full' as const,
      }],
    } as unknown as SessionFeedback;
  });
  return feedback;
}

function build(blockNumber: number, todayISO: string,
  sessionFeedback: Record<string, SessionFeedback>): TrainingProgram {
  const warn = console.warn; const log = console.log;
  console.warn = () => undefined; console.log = () => undefined;
  try {
    return generateProgramLocally(athlete(), {
      todayISO, blockNumber,
      progressionHistory: { sessionFeedback, weightOverrides: {}, blockState: null },
    } as never);
  } finally { console.warn = warn; console.log = log; }
}

interface CondRow {
  week: number;
  day: number;
  category: string;
  hard: boolean;
  templateName: string | null;
  prescribedSets: number | undefined;
}

const TEMPLATE_NAMES = new Set(CONDITIONING_TEMPLATES.map((t) => t.name));

function conditioningRows(program: TrainingProgram): CondRow[] {
  const rows: CondRow[] = [];
  program.microcycles.forEach((mc, week) => {
    for (const w of mc.workouts) {
      const category = (w as unknown as { conditioningCategory?: string }).conditioningCategory;
      if (!category) continue;
      const headline = (w.exercises ?? []).find((row) =>
        (row as unknown as { role?: string }).role === 'conditioning'
        && TEMPLATE_NAMES.has((row as unknown as { exercise?: { name?: string } })
          .exercise?.name ?? ''));
      rows.push({
        week, day: w.dayOfWeek, category,
        hard: HARD_CONDITIONING_CATEGORIES.has(category as never),
        templateName: (headline as unknown as { exercise?: { name?: string } })
          ?.exercise?.name ?? null,
        prescribedSets: headline?.prescribedSets,
      });
    }
  });
  return rows;
}

/** Every strength load in the program, by exercise name. */
function loads(program: TrainingProgram): Record<string, number> {
  const out: Record<string, number> = {};
  for (const mc of program.microcycles) {
    for (const w of mc.workouts) {
      for (const ex of w.exercises ?? []) {
        const name = ex.exercise?.name ?? '';
        if (name && typeof ex.prescribedWeightKg === 'number') {
          out[name] = Math.max(out[name] ?? 0, ex.prescribedWeightKg);
        }
      }
    }
  }
  return out;
}

armTotalsOrRed();
console.log('\nWC-136 / WC-137 — conditioning response through a REAL rollover\n');

// ═══════════════════════════════════════════════════════════════════════════
console.log('[block 1 — the precondition this unit created]');
// ═══════════════════════════════════════════════════════════════════════════

const NEUTRAL = history({ conditioningRpe: 7, feeling: 'good', soreness: 'mild' });
const block1 = build(1, '2026-07-06', {});
const block1Rows = conditioningRows(block1);
const block1Hard = block1Rows.filter((r) => r.hard);
ok('[precondition] block 1 genuinely contains an authored HARD conditioning session',
  block1Hard.length > 0,
  JSON.stringify(block1Rows.map((r) => `${r.category}:${r.templateName}`)));
ok('[precondition] ...and it names a real authored template',
  block1Hard.every((r) => r.templateName !== null && TEMPLATE_NAMES.has(r.templateName)),
  JSON.stringify(block1Hard));

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[proof 1 — hard session + poor recovery -> easier/off-feet]');
// ═══════════════════════════════════════════════════════════════════════════

// The athlete says the conditioning was very hard AND their recovery was poor.
const POOR = history({ conditioningRpe: 9, feeling: 'very_hard', soreness: 'high' });
const block2Poor = build(2, BLOCK_2_TODAY, POOR);
const poorRows = conditioningRows(block2Poor);

ok('[non-vacuity] block 2 after poor recovery still BUILDS and still has conditioning',
  poorRows.length > 0, JSON.stringify(poorRows));
ok('[proof 1] block 2 carries NO hard conditioning after poor recovery',
  poorRows.every((r) => !r.hard),
  JSON.stringify(poorRows.map((r) => `${r.category}:${r.templateName}`)));
ok('[proof 1] ...and the required conditioning exposure is RETAINED, not deleted',
  poorRows.length >= block1Rows.length - 1 && poorRows.length > 0,
  `block1=${block1Rows.length} block2=${poorRows.length}`);
ok('[proof 1] ...and every replacement is a real authored template',
  poorRows.every((r) => r.templateName !== null && TEMPLATE_NAMES.has(r.templateName)),
  JSON.stringify(poorRows));

const block2PoorLoads = loads(block2Poor);
const block1Loads = loads(block1);
const raisedAfterPoor = Object.entries(block2PoorLoads)
  .filter(([name, kg]) => (block1Loads[name] ?? 0) > 0 && kg > (block1Loads[name] ?? 0));
ok('[proof 1] strength load is NOT increased after poor recovery',
  raisedAfterPoor.length === 0,
  JSON.stringify(raisedAfterPoor));

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[proof 2 — conditioning easy, strength difficult -> exactly ONE step]');
// ═══════════════════════════════════════════════════════════════════════════

// Conditioning easy on its own question; the SESSION answers stay hard, which
// is what makes this the "conditioning easy, strength difficult" branch rather
// than the "everything easy" one.
const EASY_COND = history({ conditioningRpe: 4, feeling: 'hard', soreness: 'mild' });
const block2Easy = build(2, BLOCK_2_TODAY, EASY_COND);
const easyRows = conditioningRows(block2Easy);

ok('[non-vacuity] block 2 after easy conditioning still BUILDS with conditioning',
  easyRows.length > 0, JSON.stringify(easyRows));

// What SHOULD have happened to each surviving template, asked of the sheet.
const stepReport = easyRows.map((r) => {
  const template = CONDITIONING_TEMPLATES.find((t) => t.name === r.templateName);
  const outcome = template ? nextAuthoredDose(template) : null;
  return { row: r, outcome };
});
const steppable = stepReport.filter((e) => e.outcome?.stepped === true);
const held = stepReport.filter((e) => e.outcome?.stepped === false);

ok('[proof 2 non-vacuity] at least one surviving session HAS an authored next dose, '
  + 'so the step is reachable',
  steppable.length > 0,
  JSON.stringify(stepReport.map((e) => `${e.row.templateName}:${
    e.outcome?.stepped ? 'STEP' : (e.outcome as { reason?: string })?.reason}`)));

const wrongStep = steppable.filter((e) => {
  const step = (e.outcome as { step: { to: number } }).step;
  return e.row.prescribedSets !== step.to;
});
ok('[proof 2] every steppable session advanced to EXACTLY its next authored dose',
  wrongStep.length === 0,
  JSON.stringify(wrongStep.map((e) => `${e.row.templateName} sets=${e.row.prescribedSets} `
    + `expected=${(e.outcome as { step: { to: number } }).step.to}`)));

ok('[proof 2 — rule 5] a session the sheet offers no next dose for is HELD unchanged',
  held.every((e) => {
    const template = CONDITIONING_TEMPLATES.find((t) => t.name === e.row.templateName)!;
    const parsed = nextAuthoredDose(template);
    return parsed.stepped === false && e.row.prescribedSets !== undefined;
  }),
  JSON.stringify(held.map((e) => e.row.templateName)));

ok('[proof 2 — rule 4] no session changed QUALITY: aerobic power never became anaerobic',
  easyRows.every((r) => r.category !== 'glycolytic')
  || block1Rows.some((r) => r.category === 'glycolytic'),
  JSON.stringify(easyRows.map((r) => r.category)));

const block2EasyLoads = loads(block2Easy);
const raisedAfterEasyCond = Object.entries(block2EasyLoads)
  .filter(([name, kg]) => (block1Loads[name] ?? 0) > 0 && kg > (block1Loads[name] ?? 0));
ok('[proof 2] strength does NOT progress while conditioning does',
  raisedAfterEasyCond.length === 0,
  JSON.stringify(raisedAfterEasyCond));

// ⚠ **THE AUTHORED MAXIMUM, READ INDEPENDENTLY OF THE STEPPER.** The cell above
// compares the applied sets against `nextAuthoredDose`'s own answer, so
// deleting the `Math.min(..., max)` cap moves BOTH sides together and the cell
// stays green — measured, mutation N5 survived. This reads the ceiling straight
// out of the authored string instead, so the stepper cannot vouch for itself.
const overAuthoredMax = easyRows.filter((r) => {
  const template = CONDITIONING_TEMPLATES.find((t) => t.name === r.templateName);
  if (!template || r.prescribedSets === undefined) return false;
  const parsed = parseConditioningDose(template.setsRounds);
  return parsed.ok && r.prescribedSets > parsed.quantity.max;
});
ok('[proof 2 — rule 5] no session is prescribed beyond the sheet\'s authored maximum',
  overAuthoredMax.length === 0,
  JSON.stringify(overAuthoredMax.map((r) => `${r.templateName} sets=${r.prescribedSets}`)));

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n[the gates that still win]');
// ═══════════════════════════════════════════════════════════════════════════

// ── EVERYTHING EASY IS A DIFFERENT CASE, AND IT MUST NOT REACH THIS LADDER ──
//
// The contract sends *"everything consistently easy"* to load, then sets, then
// an extra session — NOT to a conditioning step. Without this cell the
// `strengthEasy` gate was unreachable: no fixture here ever reported both
// qualities easy, so deleting the gate reddened nothing (mutation N4).
const ALL_EASY = history({ conditioningRpe: 4, feeling: 'very_easy', soreness: 'none' });
const allEasyRows = conditioningRows(build(2, BLOCK_2_TODAY, ALL_EASY));
ok('[non-vacuity] the everything-easy athlete builds with conditioning',
  allEasyRows.length > 0, JSON.stringify(allEasyRows));
const allEasyStepped = allEasyRows.filter((r) => {
  const template = CONDITIONING_TEMPLATES.find((t) => t.name === r.templateName);
  if (!template) return false;
  const outcome = nextAuthoredDose(template);
  return outcome.stepped && r.prescribedSets === outcome.step.to
    && outcome.step.to !== outcome.step.from;
});
ok('[gate] everything-easy does NOT advance conditioning — that is the load/sets ladder',
  allEasyStepped.length === 0,
  JSON.stringify(allEasyStepped.map((r) => `${r.templateName} sets=${r.prescribedSets}`)));

// Rule 1 — in-season may hold for freshness. Same feedback, in-season athlete.
function inSeasonBuild(sessionFeedback: Record<string, SessionFeedback>): TrainingProgram {
  const warn = console.warn; const log = console.log;
  console.warn = () => undefined; console.log = () => undefined;
  try {
    return generateProgramLocally({ ...(athlete() as object), seasonPhase: 'In-season' } as never, {
      todayISO: BLOCK_2_TODAY, blockNumber: 2,
      progressionHistory: { sessionFeedback, weightOverrides: {}, blockState: null },
    } as never);
  } finally { console.warn = warn; console.log = log; }
}
const inSeasonEasy = conditioningRows(inSeasonBuild(EASY_COND));
const inSeasonNeutral = conditioningRows(inSeasonBuild(NEUTRAL));
ok('[non-vacuity] the in-season athlete builds under both histories with conditioning',
  inSeasonEasy.length > 0 && inSeasonNeutral.length > 0,
  `easy=${inSeasonEasy.length} neutral=${inSeasonNeutral.length}`);
ok('[rule 1] in-season HOLDS for freshness — easy feedback advances nothing',
  JSON.stringify(inSeasonEasy.map((r) => [r.day, r.category, r.prescribedSets]))
  === JSON.stringify(inSeasonNeutral.map((r) => [r.day, r.category, r.prescribedSets])),
  `easy=${JSON.stringify(inSeasonEasy.map((r) => [r.day, r.category, r.prescribedSets]))} `
  + `neutral=${JSON.stringify(inSeasonNeutral.map((r) => [r.day, r.category, r.prescribedSets]))}`);

// Reduce outranks advance: a block that was BOTH easy on conditioning and
// brutal on recovery must reduce, never step.
const BOTH = history({ conditioningRpe: 4, feeling: 'very_hard', soreness: 'high' });
const bothRows = conditioningRows(build(2, BLOCK_2_TODAY, BOTH));
ok('[non-vacuity] the both-signals athlete builds with conditioning',
  bothRows.length > 0, JSON.stringify(bothRows));
ok('[precedence] reduce outranks advance — no hard session survives that block',
  bothRows.every((r) => !r.hard), JSON.stringify(bothRows));
// ⚠ **AND NO STEP WAS TAKEN EITHER.** Asserting only "nothing hard survives"
// left mutation N6 green: the reduce pass had already swapped the hard session
// for aerobic work, and the advance pass then quietly STEPPED that aerobic
// session. The week looked right and the athlete had been progressed on a block
// they reported brutal.
const bothStepped = bothRows.filter((r) => {
  const template = CONDITIONING_TEMPLATES.find((t) => t.name === r.templateName);
  if (!template) return false;
  const outcome = nextAuthoredDose(template);
  return outcome.stepped && r.prescribedSets === outcome.step.to
    && outcome.step.to !== outcome.step.from;
});
ok('[precedence] ...and NOTHING was stepped on a block the athlete reported brutal',
  bothStepped.length === 0,
  JSON.stringify(bothStepped.map((r) => `${r.templateName} sets=${r.prescribedSets}`)));

const total = passed + failures.length;
console.log(`\nConditioning rollover response: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
