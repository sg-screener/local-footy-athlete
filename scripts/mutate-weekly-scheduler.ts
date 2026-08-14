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

interface Mutation {
  readonly name: string;
  readonly file: string;
  readonly from: string;
  readonly to: string;
  /** What this mutation is meant to break, for the report. */
  readonly breaks: string;
}

const MUTATIONS: Mutation[] = [
  {
    name: 'M1 in-season 3-day layout loses its pull session',
    file: CONTRACT, breaks: 'WC-101 layout purposes',
    from: "purposes: ['lower', 'upper_pull', 'upper_push'], setBudget: DEFAULT_SET_BUDGET,\n    statement: 'Lower + Upper Pull + Upper Push.",
    to: "purposes: ['lower', 'upper_push', 'upper_push'], setBudget: DEFAULT_SET_BUDGET,\n    statement: 'Lower + Upper Pull + Upper Push.",
  },
  {
    name: 'M2 the age ceiling moves from 27 to 20',
    file: CONTRACT, breaks: 'WC-140 / WC-141 selector',
    from: 'export const FOURTH_SESSION_AGE_CEILING = 27;',
    to: 'export const FOURTH_SESSION_AGE_CEILING = 20;',
  },
  {
    name: 'M3 low readiness stops vetoing the fourth session',
    file: CONTRACT, breaks: 'WC-141 "low readiness never adds work"',
    from: '  if (inputs.lowReadiness) return false;           // absolute veto, decision 14',
    to: '  // veto removed by mutation',
  },
  {
    name: 'M4 the earned arm becomes an OR instead of a conjunction',
    file: CONTRACT, breaks: 'WC-141 conjunction',
    from: '  const earnedIt = inputs.consistentlyCompletesThree\n    && inputs.highReadiness && inputs.lowFatigue;',
    to: '  const earnedIt = inputs.consistentlyCompletesThree\n    || inputs.highReadiness || inputs.lowFatigue;',
  },
  {
    name: 'M5 the split-lower budget becomes the default 12-16',
    file: CONTRACT, breaks: 'WC-031 approved 10-set exception',
    from: 'export const SPLIT_LOWER_SET_BUDGET: SetBudget = {\n  preferredMin: 10, preferredMax: 10, hardCeiling: 10,\n};',
    to: 'export const SPLIT_LOWER_SET_BUDGET: SetBudget = {\n  preferredMin: 12, preferredMax: 15, hardCeiling: 16,\n};',
  },
  {
    name: 'M6 the hard ceiling rises from 16 to 20',
    file: CONTRACT, breaks: 'WC-030 set budget',
    from: '  preferredMin: 12, preferredMax: 15, hardCeiling: 16,\n};',
    to: '  preferredMin: 12, preferredMax: 20, hardCeiling: 20,\n};',
  },
  {
    name: 'M7 five or six gym days start creating extra sessions',
    file: CONTRACT, breaks: 'WC-063 availability is not a quota',
    from: "    clauseId: 'WC-113', phase: 'Pre-season', gymDays: [4, 5, 6], weekendAvailable: null,\n    purposes: ['upper_pull', 'lower_squat', 'upper_push', 'lower_hinge'],",
    to: "    clauseId: 'WC-113', phase: 'Pre-season', gymDays: [4], weekendAvailable: null,\n    purposes: ['upper_pull', 'lower_squat', 'upper_push', 'lower_hinge'],",
  },
  {
    name: 'M8 pre-season 3-day stops distinguishing weekend availability',
    file: CONTRACT, breaks: 'WC-111 / WC-112',
    from: "    clauseId: 'WC-112', phase: 'Pre-season', gymDays: [3], weekendAvailable: true,\n    purposes: ['full_body', 'full_body', 'full_body'],",
    to: "    clauseId: 'WC-112', phase: 'Pre-season', gymDays: [3], weekendAvailable: true,\n    purposes: ['lower', 'upper', 'full_body'],",
  },
  {
    name: 'M9 lower sessions may fall on consecutive days',
    file: SCHEDULER, breaks: 'WC-043 lower spacing',
    from: '    if (PURPOSE_IS_LOWER[prev.purpose] && PURPOSE_IS_LOWER[cur.purpose]) return false;',
    to: '    // lower-spacing removed by mutation',
  },
  {
    name: 'M10 the same plane may repeat on consecutive days',
    file: SCHEDULER, breaks: 'WC-022 plane repeat',
    from: '    if (shared) return false;',
    to: '    if (shared && false) return false;',
  },
  {
    name: 'M11 the six-hard-day bar is removed',
    file: SCHEDULER, breaks: 'WC-040 / WC-042',
    from: '  if (hardDays.size >= GLOBAL_RULES.hardDays.neverProgrammed) return false;',
    to: '  // hard-day cap removed by mutation',
  },
  {
    name: 'M12 a five-day hard run no longer needs two rest days',
    file: SCHEDULER, breaks: 'WC-041 consecutive hard days',
    from: '    if (restDays.length < 2) return false;',
    to: '    if (restDays.length < 0) return false;',
  },
  {
    name: 'M13 explicit unavailable days become usable',
    file: SCHEDULER, breaks: 'WC-061 explicit unavailability',
    from: '  if (inputs.unavailableDays.includes(day)) return false;\n  if (inputs.gameDay === day) return false;',
    to: '  if (inputs.gameDay === day) return false;',
  },
  {
    name: 'M14 game proximity stops excluding G-1 and G+1',
    file: SCHEDULER, breaks: 'WC-050 game anchoring',
    from: '    if (gap === -1 || gap === 1) return false;\n  }\n  return true;\n}',
    to: '    if (gap === -99) return false;\n  }\n  return true;\n}',
  },
  {
    name: 'M15 required running stops leaving the gym days',
    file: SCHEDULER, breaks: 'WC-060 / WC-046 off-gym running',
    from: '      if (runningDays.size >= GLOBAL_RULES.running.min) break;',
    to: '      break;',
  },
  {
    name: 'M16 the running streak cap is removed',
    file: SCHEDULER, breaks: 'WC-044 running streak',
    from: '      if (longest > GLOBAL_RULES.runningStreakMaximum) continue;',
    to: '      // running streak cap removed by mutation',
  },
  {
    name: 'M17 early off-season sessions stop being optional',
    file: SCHEDULER, breaks: 'WC-130 early off-season optionality',
    from: "  const overlayOptional = inputs.phase === 'Off-season'\n    && inputs.offseasonBlock === 'early_optional';",
    to: '  const overlayOptional = false;',
  },
  {
    name: 'M18 club nights stop being carried onto shared gym days',
    file: SCHEDULER, breaks: 'WC-062 real club nights',
    from: '        clubTraining: inputs.clubNights.includes(day), game: false,\n      });\n      continue;\n    }\n    if (inputs.clubNights.includes(day)) {',
    to: '        clubTraining: false, game: false,\n      });\n      continue;\n    }\n    if (inputs.clubNights.includes(day)) {',
  },
  {
    name: 'M19 a refusal is replaced by a silently smaller week',
    file: SCHEDULER, breaks: 'WC-142 typed refusal',
    from: "  if (usableGymDays.length < needed) {\n    return {\n      refused: true, finding: 'not_enough_legal_gym_days', clauseId: layout.clauseId,",
    to: "  if (false) {\n    return {\n      refused: true, finding: 'not_enough_legal_gym_days', clauseId: layout.clauseId,",
  },
  {
    name: 'M20 the in-season sprint is added even with club training',
    file: CONTRACT, breaks: 'WC-135 in-season sprint rule',
    from: '  addOnlyWhenNoClubTraining: true,',
    to: '  addOnlyWhenNoClubTraining: false,',
  },
];

/** Cell names that failed under this suite run. */
function runSuite(): { failed: string[]; crashed: boolean } {
  try {
    const out = execSync('npm run test:weekly-scheduler 2>&1', {
      cwd: ROOT, encoding: 'utf8', maxBuffer: 40 * 1024 * 1024,
    });
    return { failed: parseFailures(out), crashed: false };
  } catch (error: unknown) {
    const out = String((error as { stdout?: string }).stdout ?? '');
    const failed = parseFailures(out);
    // A mutation that makes the suite THROW still counts as killing every cell
    // that never got to run — recorded honestly as a crash rather than silently.
    return { failed, crashed: failed.length === 0 };
  }
}

function parseFailures(out: string): string[] {
  return out.split('\n')
    .filter((line) => line.trim().startsWith('FAIL '))
    .map((line) => line.trim().slice(5).split('\n')[0].trim());
}

function allCellNames(): string[] {
  const out = execSync('npm run test:weekly-scheduler 2>&1', {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 40 * 1024 * 1024,
  });
  return out.split('\n')
    .filter((line) => line.trim().startsWith('PASS '))
    .map((line) => line.trim().slice(5).trim());
}

function main(): void {
  const originals = new Map<string, string>([
    [CONTRACT, readFileSync(CONTRACT, 'utf8')],
    [SCHEDULER, readFileSync(SCHEDULER, 'utf8')],
  ]);
  const killedBy = new Map<string, string[]>();
  const crashes: string[] = [];
  let cells: string[] = [];

  try {
    cells = allCellNames();
    console.log(`GREEN BASELINE: ${cells.length} cells passing\n`);
    for (const mutation of MUTATIONS) {
      const source = originals.get(mutation.file)!;
      if (!source.includes(mutation.from)) {
        console.error(`  ⚠ ${mutation.name} — ANCHOR NOT FOUND, mutation skipped`);
        console.error('      A skipped mutation proves nothing. Fix the anchor.');
        crashes.push(`${mutation.name} (anchor not found)`);
        continue;
      }
      writeFileSync(mutation.file, source.replace(mutation.from, mutation.to), 'utf8');
      const { failed, crashed } = runSuite();
      writeFileSync(mutation.file, source, 'utf8');
      for (const name of failed) {
        killedBy.set(name, [...(killedBy.get(name) ?? []), mutation.name]);
      }
      console.log(`  ${mutation.name}`);
      console.log(`      breaks: ${mutation.breaks}`);
      console.log(`      RED cells: ${failed.length}${crashed ? ' (suite crashed)' : ''}`);
      if (failed.length === 0 && !crashed) {
        console.error('      ⚠ NO CELL REDDENED — this mutation is not observed by any guard.');
      }
    }
  } finally {
    for (const [file, source] of originals) writeFileSync(file, source, 'utf8');
    console.log('\nRESTORED both source files from the in-memory backup.');
  }

  const survivors = cells.filter((name) => !killedBy.has(name));
  console.log(`\n${'='.repeat(72)}`);
  console.log(`CELLS: ${cells.length} · KILLED BY AT LEAST ONE MUTATION: ${killedBy.size}`);
  console.log(`SURVIVORS (no mutation reddened them): ${survivors.length}`);
  for (const name of survivors) console.log(`    ${name}`);
  if (crashes.length > 0) {
    console.log(`\nMUTATIONS THAT DID NOT APPLY: ${crashes.length}`);
    for (const c of crashes) console.log(`    ${c}`);
  }
  if (survivors.length > 0 || crashes.length > 0) {
    console.error('\nA cell no mutation can kill is not testing what it names.');
    process.exitCode = 1;
  } else {
    console.log('\nEVERY CELL WAS SEEN RED. Liveness proved by execution, not by assertion.');
  }
}

if (require.main === module) main();
