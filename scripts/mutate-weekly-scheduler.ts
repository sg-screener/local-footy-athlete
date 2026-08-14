/**
 * THE LIVENESS HARNESS — every scheduler guard seen RED by breaking its subject.
 *
 *   npx sucrase-node scripts/mutate-weekly-scheduler.ts
 *
 * **A GUARD NOBODY HAS SEEN FAIL IS A CLAIM, NOT A GUARD.** The mission is
 * explicit: *"Every new behavioural guard must be seen red once by changing its
 * actual subject, then restored. Source-text presence checks are insufficient."*
 *
 * Doing that by hand for ~70 cells is neither honest nor repeatable, so this
 * mutates the SUBJECT — `weeklyProgrammingContract.ts` and `weeklyScheduler.ts` —
 * once per defect class, runs the real suite, and records which cells reddened.
 * The run FAILS if any cell survives every mutation, because a cell no mutation
 * can kill is not testing the thing it names.
 *
 * ⚠ **IT RESTORES FROM ITS OWN BACKUP, NEVER FROM GIT.** This repo has lost work
 * to `git checkout` used as an undo in a shared checkout; the backup is taken in
 * memory here and written back in a `finally`.
 */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..');
const CONTRACT = resolve(ROOT, 'src/rules/weeklyProgrammingContract.ts');
const SCHEDULER = resolve(ROOT, 'src/rules/weeklyScheduler.ts');

interface Edit {
  readonly file: string;
  readonly from: string;
  readonly to: string;
}

/**
 * ⚠ **A MUTATION OFTEN NEEDS MORE THAN ONE EDIT, AND THE FIRST RUN PROVED IT.**
 * Eight of twenty single-edit mutations reddened NOTHING — not because the guards
 * were blind, but because removing a legality check leaves the SCORER still
 * preferring the legal arrangement, so the output never changed. A rule held in
 * two places needs both broken before its guard can speak.
 *
 * That is a finding about the scheduler as much as the harness: lower spacing,
 * hard-day limits and explicit unavailability are each enforced twice.
 */
interface Mutation {
  readonly name: string;
  readonly edits: readonly Edit[];
  /** What this mutation is meant to break, for the report. */
  readonly breaks: string;
}

const c = (from: string, to: string): Edit => ({ file: CONTRACT, from, to });
const w = (from: string, to: string): Edit => ({ file: SCHEDULER, from, to });

/** Removing the run penalty, needed wherever the SCORER also enforces a rule. */
const DROP_RUN_PENALTY = w(
  '    score -= (longestRun - GLOBAL_RULES.consecutiveHardDays.preferred) * 15;',
  '    score -= 0;');
/** Removing the separation bonus, likewise. */
const DROP_SEPARATION = w(
  '  for (let i = 1; i < idx.length; i += 1) score += Math.min(idx[i] - idx[i - 1], 3) * 4;',
  '  for (let i = 1; i < idx.length; i += 1) score += 0 * idx[i];');
/** Inverting the lower-spacing preference so consecutive lower days WIN. */
const PREFER_CONSECUTIVE_LOWER = w(
  '    score += clear >= 2 ? 30 : clear === 1 ? 10 : 0;',
  '    score += clear >= 2 ? 0 : clear === 1 ? 10 : 30;');

const MUTATIONS: Mutation[] = [
  { name: 'M1 in-season 3-day layout loses its pull session',
    breaks: 'WC-101 layout purposes',
    edits: [c("purposes: ['lower', 'upper_pull', 'upper_push'], setBudget: DEFAULT_SET_BUDGET,\n    statement: 'Lower + Upper Pull + Upper Push.",
      "purposes: ['lower', 'upper_push', 'upper_push'], setBudget: DEFAULT_SET_BUDGET,\n    statement: 'Lower + Upper Pull + Upper Push.")] },
  { name: 'M2 the age ceiling moves from 27 to 20',
    breaks: 'WC-140 / WC-141 selector',
    edits: [c('export const FOURTH_SESSION_AGE_CEILING = 27;',
      'export const FOURTH_SESSION_AGE_CEILING = 20;')] },
  { name: 'M3 low readiness stops vetoing the fourth session',
    breaks: 'WC-141 "low readiness never adds work"',
    edits: [c('  if (inputs.lowReadiness) return false;           // absolute veto, decision 14',
      '  // veto removed by mutation')] },
  { name: 'M4 the earned arm becomes an OR instead of a conjunction',
    breaks: 'WC-141 conjunction',
    edits: [c('  const earnedIt = inputs.consistentlyCompletesThree\n    && inputs.highReadiness && inputs.lowFatigue;',
      '  const earnedIt = inputs.consistentlyCompletesThree\n    || inputs.highReadiness || inputs.lowFatigue;')] },
  { name: 'M5 the split-lower budget becomes the default 12-16',
    breaks: 'WC-031 approved 10-set exception',
    edits: [c('export const SPLIT_LOWER_SET_BUDGET: SetBudget = {\n  preferredMin: 10, preferredMax: 10, hardCeiling: 10,\n};',
      'export const SPLIT_LOWER_SET_BUDGET: SetBudget = {\n  preferredMin: 12, preferredMax: 15, hardCeiling: 16,\n};')] },
  { name: 'M6 the hard ceiling rises from 16 to 20',
    breaks: 'WC-030 set budget',
    edits: [c('  preferredMin: 12, preferredMax: 15, hardCeiling: 16,\n};',
      '  preferredMin: 12, preferredMax: 20, hardCeiling: 20,\n};')] },
  { name: 'M7 pre-season 5-6 days start creating extra sessions',
    breaks: 'WC-063 availability is not a quota',
    edits: [c("clauseId: 'WC-113', phase: 'Pre-season', gymDays: [4, 5, 6], weekendAvailable: null,\n    purposes: ['upper_pull', 'lower_squat', 'upper_push', 'lower_hinge'],",
      "clauseId: 'WC-113', phase: 'Pre-season', gymDays: [4, 5, 6], weekendAvailable: null,\n    purposes: ['upper_pull', 'lower_squat', 'upper_push', 'lower_hinge', 'upper'],")] },
  { name: 'M8 pre-season 3-day stops distinguishing weekend availability',
    breaks: 'WC-111 / WC-112',
    edits: [c("clauseId: 'WC-112', phase: 'Pre-season', gymDays: [3], weekendAvailable: true,\n    purposes: ['full_body', 'full_body', 'full_body'],",
      "clauseId: 'WC-112', phase: 'Pre-season', gymDays: [3], weekendAvailable: true,\n    purposes: ['lower', 'upper', 'full_body'],")] },
  { name: 'M9 lower sessions may fall on consecutive days (rule AND preference)',
    breaks: 'WC-043 lower spacing — held in TWO places',
    edits: [
      w('    if (PURPOSE_IS_LOWER[prev.purpose] && PURPOSE_IS_LOWER[cur.purpose]) return false;',
        '    // lower-spacing removed by mutation'),
      PREFER_CONSECUTIVE_LOWER, DROP_SEPARATION] },
  { name: 'M10 the same plane may repeat on consecutive days',
    breaks: 'WC-022 plane repeat',
    // ⚠ NEEDS A LAYOUT THAT CAN REPEAT A PLANE. Removing the rule alone changed
    // nothing, because no approved layout contains two same-plane sessions — so
    // the mutation also gives in-season three days two Upper Push sessions.
    edits: [w('    if (shared) return false;', '    if (shared && false) return false;'),
      c("purposes: ['lower', 'upper_pull', 'upper_push'], setBudget: DEFAULT_SET_BUDGET,\n    statement: 'Lower + Upper Pull + Upper Push.",
        "purposes: ['upper_push', 'upper_push', 'lower'], setBudget: DEFAULT_SET_BUDGET,\n    statement: 'Lower + Upper Pull + Upper Push."),
      DROP_SEPARATION] },
  { name: 'M11 the six-hard-day bar is removed (rule AND penalty)',
    breaks: 'WC-040 / WC-042 hard-day total',
    edits: [
      w('  if (hardDays.size >= GLOBAL_RULES.hardDays.neverProgrammed) return false;',
        '  // hard-day cap removed by mutation'),
      w('  if (longestRun > GLOBAL_RULES.consecutiveHardDays.fiveRequiresTwoFullRestDays) return false;',
        '  // consecutive cap removed by mutation'),
      DROP_RUN_PENALTY, DROP_SEPARATION] },
  { name: 'M12 a five-day hard run no longer needs two rest days',
    breaks: 'WC-041 consecutive hard days',
    edits: [w('    if (restDays.length < 2) return false;', '    if (restDays.length < 0) return false;'),
      DROP_RUN_PENALTY, DROP_SEPARATION] },
  { name: 'M13 explicit unavailable days become usable (all three places)',
    breaks: 'WC-061 explicit unavailability — held in THREE places',
    edits: [
      w('  if (inputs.unavailableDays.includes(day)) return false;\n  if (inputs.gameDay === day) return false;',
        '  if (inputs.gameDay === day) return false;'),
      w('    if (inputs.unavailableDays.includes(day)) continue;   // WC-061 — never used',
        '    // output filter removed by mutation'),
      w('      if (inputs.unavailableDays.includes(day)) continue;      // WC-061',
        '      // running filter removed by mutation')] },
  { name: 'M14 game proximity stops excluding G-1 and G+1',
    breaks: 'WC-050 game anchoring',
    edits: [w('    if (gap === -1 || gap === 1) return false;\n  }\n  return true;\n}',
      '    if (gap === -99) return false;\n  }\n  return true;\n}'), DROP_SEPARATION] },
  { name: 'M15 required running stops leaving the gym days',
    breaks: 'WC-060 / WC-046 off-gym running',
    edits: [w('      if (runningDays.size >= GLOBAL_RULES.running.min) break;', '      break;')] },
  { name: 'M16 the running streak cap is removed, and the minimum forces a streak',
    breaks: 'WC-044 running streak',
    edits: [
      w('      if (longest > GLOBAL_RULES.runningStreakMaximum) continue;',
        '      // running streak cap removed by mutation'),
      c('  running: { min: 2, preferred: 3, max: 4 },', '  running: { min: 6, preferred: 3, max: 4 },')] },
  { name: 'M17 early off-season sessions stop being optional',
    breaks: 'WC-130 early off-season optionality',
    edits: [w("  const overlayOptional = inputs.phase === 'Off-season'\n    && inputs.offseasonBlock === 'early_optional';",
      '  const overlayOptional = false;')] },
  { name: 'M18 club nights stop being carried onto shared gym days',
    breaks: 'WC-062 real club nights',
    edits: [w('        clubTraining: inputs.clubNights.includes(day), game: false,\n      });\n      continue;\n    }\n    if (inputs.clubNights.includes(day)) {',
      '        clubTraining: false, game: false,\n      });\n      continue;\n    }\n    if (inputs.clubNights.includes(day)) {')] },
  { name: 'M19 the not-enough-days refusal is skipped',
    breaks: 'WC-142 typed refusal identity',
    edits: [w("  if (usableGymDays.length < needed) {\n    return {\n      refused: true, finding: 'not_enough_legal_gym_days', clauseId: layout.clauseId,",
      "  if (false) {\n    return {\n      refused: true, finding: 'not_enough_legal_gym_days', clauseId: layout.clauseId,")] },
  { name: 'M20 the in-season sprint is added even with club training',
    breaks: 'WC-135 in-season sprint rule',
    edits: [c('  addOnlyWhenNoClubTraining: true,', '  addOnlyWhenNoClubTraining: false,')] },
  { name: 'M21 in-season 2-day layout stops being Full Body x2',
    breaks: 'WC-100 in-season two-day layout',
    edits: [c("clauseId: 'WC-100', phase: 'In-season', gymDays: [2], weekendAvailable: null,\n    purposes: ['full_body', 'full_body'],",
      "clauseId: 'WC-100', phase: 'In-season', gymDays: [2], weekendAvailable: null,\n    purposes: ['lower', 'upper'],")] },
  { name: 'M22 off-season 3-day loses its Full Body session',
    breaks: 'WC-121 off-season three-day layout',
    edits: [c("clauseId: 'WC-121', phase: 'Off-season', gymDays: [3], weekendAvailable: null,\n    purposes: ['lower', 'upper', 'full_body'],",
      "clauseId: 'WC-121', phase: 'Off-season', gymDays: [3], weekendAvailable: null,\n    purposes: ['lower', 'upper', 'upper_push'],")] },
  { name: 'M23 off-season 4-6 drops to three required sessions',
    breaks: 'WC-122 off-season four-day layout',
    edits: [c("clauseId: 'WC-122', phase: 'Off-season', gymDays: [4, 5, 6], weekendAvailable: null,\n    purposes: ['lower_squat', 'upper_pull', 'lower_hinge', 'upper_push'],",
      "clauseId: 'WC-122', phase: 'Off-season', gymDays: [4, 5, 6], weekendAvailable: null,\n    purposes: ['lower_squat', 'upper_pull', 'lower_hinge'],")] },
  { name: 'M24 pre-season 2-day drops to one session',
    breaks: 'WC-110 pre-season two-day layout',
    edits: [c("clauseId: 'WC-110', phase: 'Pre-season', gymDays: [2], weekendAvailable: null,\n    purposes: ['full_body', 'full_body'],",
      "clauseId: 'WC-110', phase: 'Pre-season', gymDays: [2], weekendAvailable: null,\n    purposes: ['full_body'],")] },
  { name: 'M25 off-season 2-day drops to one session',
    breaks: 'WC-120 off-season two-day layout',
    edits: [c("clauseId: 'WC-120', phase: 'Off-season', gymDays: [2], weekendAvailable: null,\n    purposes: ['full_body', 'full_body'],",
      "clauseId: 'WC-120', phase: 'Off-season', gymDays: [2], weekendAvailable: null,\n    purposes: ['full_body'],")] },
  { name: 'M26 pre-season 3-day weekend-unavailable row changes shape',
    breaks: 'WC-111 pre-season weekend-unavailable layout',
    edits: [c("clauseId: 'WC-111', phase: 'Pre-season', gymDays: [3], weekendAvailable: false,\n    purposes: ['lower', 'upper', 'full_body'],",
      "clauseId: 'WC-111', phase: 'Pre-season', gymDays: [3], weekendAvailable: false,\n    purposes: ['full_body', 'full_body', 'full_body'],")] },
  { name: 'M27 the in-season selector-not-met row gains a fourth session',
    breaks: 'WC-102 three-session retention',
    edits: [c("clauseId: 'WC-102', phase: 'In-season', gymDays: [4, 5, 6], weekendAvailable: null,\n    purposes: ['lower', 'upper_pull', 'upper_push'],",
      "clauseId: 'WC-102', phase: 'In-season', gymDays: [4, 5, 6], weekendAvailable: null,\n    purposes: ['lower', 'upper_pull', 'upper_push', 'upper'],")] },
  { name: 'M28 transition off-season load stops being 90%',
    breaks: 'WC-131 transition overlay',
    edits: [c("clauseId: 'WC-131', sessionsRequired: true, loadAdjustment: 0.90,",
      "clauseId: 'WC-131', sessionsRequired: true, loadAdjustment: 0.50,")] },
  { name: 'M29 normal-build stops requiring a sprint exposure',
    breaks: 'WC-132 normal-build overlay',
    edits: [c('    runningRequired: true, sprintExposureRequired: true, maxRestDays: 2,\n    conditioningTarget: { min: 3, max: 5 },\n    statement: \'Off-season week 5 onward',
      '    runningRequired: true, sprintExposureRequired: false, maxRestDays: 2,\n    conditioningTarget: { min: 3, max: 5 },\n    statement: \'Off-season week 5 onward')] },
  { name: 'M30 pre-season conditioning target drops below four',
    breaks: 'WC-133 pre-season overlay',
    edits: [c("  clauseId: 'WC-133', sessionsRequired: true, loadAdjustment: null,\n  runningRequired: true, sprintExposureRequired: true, maxRestDays: 2,\n  conditioningTarget: { min: 4, max: 4 },",
      "  clauseId: 'WC-133', sessionsRequired: true, loadAdjustment: null,\n  runningRequired: true, sprintExposureRequired: true, maxRestDays: 2,\n  conditioningTarget: { min: 2, max: 4 },")] },
  { name: 'M31 in-season gains a scheduled calendar deload',
    breaks: 'WC-134 in-season overlay',
    edits: [c("  clauseId: 'WC-134', sessionsRequired: true, loadAdjustment: null,",
      "  clauseId: 'WC-134', sessionsRequired: true, loadAdjustment: 0.8,")] },
  { name: 'M32 early off-season load and rest allowance change',
    breaks: 'WC-130 early-optional overlay values',
    edits: [c("clauseId: 'WC-130', sessionsRequired: false, loadAdjustment: 0.75,\n    runningRequired: false, sprintExposureRequired: false, maxRestDays: 3,",
      "clauseId: 'WC-130', sessionsRequired: false, loadAdjustment: 0.95,\n    runningRequired: true, sprintExposureRequired: false, maxRestDays: 1,")] },
  { name: 'M33 a pattern loses its partner',
    breaks: 'WC-020 / WC-021 pattern set and pairing',
    edits: [c("  single_leg_knee: 'single_leg_hip',\n  single_leg_hip: 'single_leg_knee',\n};",
      "  single_leg_knee: 'squat',\n  single_leg_hip: 'single_leg_knee',\n};")] },
  { name: 'M34 the daily movement ceiling and conditioning cap move',
    breaks: 'WC-045 / WC-047 / WC-048 global targets',
    edits: [c('  conditioning: { min: 3, max: 5, fifthIsOffLeg: true },',
      '  conditioning: { min: 1, max: 9, fifthIsOffLeg: false },'),
      c('  upperExposures: { min: 2, max: 3 },', '  upperExposures: { min: 0, max: 3 },'),
      c('  dailyMovementCeiling: 7,', '  dailyMovementCeiling: 99,')] },
  { name: 'M35 full body stops intending the lower patterns',
    breaks: 'WC-023 purpose -> pattern intention',
    edits: [c("  full_body: ['squat', 'hinge', 'horizontal_push', 'horizontal_pull',\n    'single_leg_knee', 'single_leg_hip'],",
      "  full_body: ['horizontal_push', 'horizontal_pull'],")] },
  { name: 'M36 a full-body day stops counting as a lower session',
    breaks: 'WC-024 which purposes load the legs',
    edits: [c('export const PURPOSE_IS_LOWER: Readonly<Record<SessionPurpose, boolean>> = {\n  full_body: true,',
      'export const PURPOSE_IS_LOWER: Readonly<Record<SessionPurpose, boolean>> = {\n  full_body: false,')] },
  { name: 'M37 the contract source hash and approval are wrong',
    breaks: 'source pinning',
    edits: [c("  approvedBy: 'Sam, 2026-08-15: \"okay i approve it\"',",
      "  approvedBy: 'unapproved draft',")] },
  { name: 'M38 a clause loses its provenance',
    breaks: 'registry provenance',
    edits: [c("  { id: 'WC-020', provenance: '§2 Strength session versus movement exposure',",
      "  { id: 'WC-020', provenance: 'unknown',")] },
  { name: 'M39 a clause is removed from the registry entirely',
    breaks: 'registry completeness (phantom detection)',
    edits: [c("  { id: 'WC-044', provenance: '§3 Running spacing / decision 7',\n    statement: 'No more than 3 running days consecutively.' },", '')] },
  { name: 'M41 in-season 2-day drops to one required session',
    breaks: 'WC-100 in-season two-day COUNT',
    edits: [c("clauseId: 'WC-100', phase: 'In-season', gymDays: [2], weekendAvailable: null,\n    purposes: ['full_body', 'full_body'],",
      "clauseId: 'WC-100', phase: 'In-season', gymDays: [2], weekendAvailable: null,\n    purposes: ['full_body'],")] },
  { name: 'M42 in-season 3-day drops to two required sessions',
    breaks: 'WC-101 in-season three-day COUNT',
    edits: [c("purposes: ['lower', 'upper_pull', 'upper_push'], setBudget: DEFAULT_SET_BUDGET,\n    statement: 'Lower + Upper Pull + Upper Push.",
      "purposes: ['lower', 'upper_pull'], setBudget: DEFAULT_SET_BUDGET,\n    statement: 'Lower + Upper Pull + Upper Push.")] },
  { name: 'M43 pre-season 3-day weekend-unavailable drops to two',
    breaks: 'WC-111 pre-season three-day COUNT',
    edits: [c("clauseId: 'WC-111', phase: 'Pre-season', gymDays: [3], weekendAvailable: false,\n    purposes: ['lower', 'upper', 'full_body'],",
      "clauseId: 'WC-111', phase: 'Pre-season', gymDays: [3], weekendAvailable: false,\n    purposes: ['lower', 'upper'],")] },
  { name: 'M40 baseLayoutFor stops applying the selector',
    breaks: 'WC-142 single entry point',
    edits: [c('  return rows.find((row) => (row.purposes.length === 4) === four) ?? rows[0];',
      '  return rows[0];')] },
];

function suiteOutput(): string {
  try {
    return execSync('npm run test:weekly-scheduler 2>&1', {
      cwd: ROOT, encoding: 'utf8', maxBuffer: 40 * 1024 * 1024,
    });
  } catch (error: unknown) {
    return String((error as { stdout?: string }).stdout ?? '');
  }
}

function passingCells(out: string): Set<string> {
  return new Set(out.split('\n')
    .filter((line) => line.trim().startsWith('PASS '))
    .map((line) => line.trim().slice(5).trim()));
}

/**
 * ⚠ **KILLED = WAS PASSING AT BASELINE AND IS NOT PASSING NOW.**
 *
 * Counting only `FAIL` lines credited nothing when a mutation made the suite
 * THROW — and a mutation that crashes the suite has certainly been observed. This
 * definition handles a failure, a crash and an early exit identically, which is
 * the only way the survivor list means what it says.
 */
function killedCells(baseline: Set<string>, out: string): string[] {
  const nowPassing = passingCells(out);
  return [...baseline].filter((name) => !nowPassing.has(name));
}

function main(): void {
  const originals = new Map<string, string>([
    [CONTRACT, readFileSync(CONTRACT, 'utf8')],
    [SCHEDULER, readFileSync(SCHEDULER, 'utf8')],
  ]);
  const killedBy = new Map<string, string[]>();
  const notApplied: string[] = [];
  let baseline = new Set<string>();

  try {
    baseline = passingCells(suiteOutput());
    console.log(`GREEN BASELINE: ${baseline.size} cells passing\n`);
    for (const mutation of MUTATIONS) {
      const missing = mutation.edits.filter((edit) =>
        !originals.get(edit.file)!.includes(edit.from));
      if (missing.length > 0) {
        console.error(`  x ${mutation.name} — ANCHOR NOT FOUND, skipped`);
        console.error('      A skipped mutation proves nothing. Fix the anchor.');
        notApplied.push(mutation.name);
        continue;
      }
      const patched = new Map<string, string>();
      for (const edit of mutation.edits) {
        const current = patched.get(edit.file) ?? originals.get(edit.file)!;
        patched.set(edit.file, current.replace(edit.from, edit.to));
      }
      for (const [file, text] of patched) writeFileSync(file, text, 'utf8');
      const killed = killedCells(baseline, suiteOutput());
      for (const [file, text] of originals) writeFileSync(file, text, 'utf8');

      for (const name of killed) {
        killedBy.set(name, [...(killedBy.get(name) ?? []), mutation.name]);
      }
      console.log(`  ${mutation.name}`);
      console.log(`      breaks: ${mutation.breaks}`);
      console.log(`      RED cells: ${killed.length}`);
      if (killed.length === 0) {
        console.error('      ! NO CELL REDDENED — this mutation is not observed by any guard.');
      }
    }
  } finally {
    for (const [file, source] of originals) writeFileSync(file, source, 'utf8');
    console.log('\nRESTORED both source files from the in-memory backup.');
  }

  const survivors = [...baseline].filter((name) => !killedBy.has(name));
  console.log(`\n${'='.repeat(72)}`);
  console.log(`CELLS: ${baseline.size} · KILLED BY AT LEAST ONE MUTATION: ${killedBy.size}`);
  console.log(`SURVIVORS (no mutation reddened them): ${survivors.length}`);
  for (const name of survivors) console.log(`    ${name}`);
  if (notApplied.length > 0) {
    console.log(`\nMUTATIONS THAT DID NOT APPLY: ${notApplied.length}`);
    for (const c2 of notApplied) console.log(`    ${c2}`);
  }
  if (survivors.length > 0 || notApplied.length > 0) {
    console.error('\nA cell no mutation can kill is not testing what it names.');
    process.exitCode = 1;
  } else {
    console.log('\nEVERY CELL WAS SEEN RED. Liveness proved by execution, not assertion.');
  }
}

if (require.main === module) main();
