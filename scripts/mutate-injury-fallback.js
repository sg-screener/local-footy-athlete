/**
 * MUTATION HARNESS FOR THE INJURY FALLBACK UNIT.
 *
 * A green guard is a claim. Each mutation below re-introduces one specific
 * defect this unit fixed; the guard that does NOT go red for it is a guard that
 * was not holding that rule.
 *
 * It edits by EXACT STRING and asserts the byte delta before writing — a regex
 * over a shared file is how this repo has lost work — and it restores from its
 * own backup, never from git.
 *
 *   node scripts/mutate-injury-fallback.js         # run them all
 *   node scripts/mutate-injury-fallback.js M4      # run one
 */
const fs = require('fs');
const { execSync } = require('child_process');

const MUTATIONS = [
  {
    /* ⚠ **RE-AIMED. The first version mutated `tapSwapHierarchy.injuryLevel` and
     * SURVIVED — correctly, because that function no longer decides legality.
     * It is a projection for one legacy consumer's DEPRIORITISATION, and moving
     * its edge changes nothing a guard should notice. The owner of the original
     * defect is `injuryPermitsExerciseAtSeverity`, so that is what this puts
     * back to the 4+ band. A mutant aimed at an inert line proves nothing. */
    id: 'M1',
    what: 'the legality edge goes back to the 4+ band at its real owner (the original defect)',
    file: 'src/rules/injuryExerciseRisk.ts',
    from: '  return !injurySeverityRemovesRiskyWork(severity);',
    to: '  return !severityHasModerateEffect(severity);',
    extra: {
      file: 'src/rules/injuryExerciseRisk.ts',
      from: "import { injurySeverityRemovesRiskyWork } from './injurySeverityBands';",
      to: "import { injurySeverityRemovesRiskyWork, severityHasModerateEffect } from './injurySeverityBands';",
    },
    suites: ['test:injury-fallback-journey'],
  },
  {
    id: 'M2',
    what: 'rungs 1-4 are skipped, so only "unaffected body area" is reachable (the deleted table\'s behaviour)',
    file: 'src/rules/injuryFallbackLadder.ts',
    from: '  const sameIdentity = sameFinerIdentity(original, candidate);',
    to: '  const sameIdentity = sameFinerIdentity(original, candidate);\n  if (true) return null;',
    suites: ['test:injury-fallback-journey'],
  },
  {
    id: 'M3',
    what: 'a replacement may be HEAVIER than the row it replaces',
    file: 'src/rules/injuryFallbackLadder.ts',
    from: '  return LOAD_RANK[candidate.tags.load] <= LOAD_RANK[original.tags.load];',
    to: '  return true;',
    suites: ['test:injury-fallback-journey'],
  },
  {
    id: 'M4',
    what: 'the medical-stop gate blocks the injury\'s own recomposition again',
    file: 'src/utils/coachActions.ts',
    from: '  const isInjuryFactWrite = input.substitutedFrom?.cause === \'injury\';',
    to: '  const isInjuryFactWrite = false;',
    suites: ['test:injury-fallback-journey'],
  },
  {
    id: 'M5',
    what: 'the recovery rung ignores Sam\'s authored conditioning tier, so hard intervals count as "easy"',
    file: 'src/rules/injuryFallbackLadder.ts',
    from: "  return CONDITIONING_META[candidate.name]?.tier === 'C';",
    to: '  return true;',
    suites: ['test:tap-swap-hierarchy'],
  },
  {
    id: 'M6',
    what: 'the finer pattern identity is dropped, so a squat answers a split squat as "same pattern"',
    file: 'src/rules/injuryFallbackLadder.ts',
    from: '  if (a === null || b === null) return true;\n  return a === b;',
    to: '  if (a === null || b === null) return true;\n  return true;',
    suites: ['test:injury-fallback-journey'],
  },
  {
    id: 'M7',
    what: 'the row-level question uses the 4+ caution edge again, so it is no longer idempotent',
    file: 'src/utils/tapSwapHierarchy.ts',
    from: '    if (!injuryPermitsExerciseAtSeverity(resolveExerciseName(name), region, severity)) {\n      return true;\n    }',
    to: '    const risk = classifyExerciseRiskForBucket(resolveExerciseName(name), region, severity);\n    if (risk === \'avoid\') return true;\n    if (risk === \'caution\' && severityHasModerateEffect(severity)) return true;',
    extra: {
      file: 'src/utils/tapSwapHierarchy.ts',
      from: "import { injuryPermitsExerciseAtSeverity } from '../rules/injuryExerciseRisk';",
      to: "import { classifyExerciseRiskForBucket, injuryPermitsExerciseAtSeverity } from '../rules/injuryExerciseRisk';",
    },
    suites: ['test:injury-fallback-journey'],
  },
  {
    id: 'M9',
    what: 'changed rows go back to being COUNTED instead of named',
    file: 'src/utils/injurySessionRecomposition.ts',
    from: "    parts.push(to.length > 0\n      ? `${listInWords(from)} swapped for ${listInWords(to)}`\n      : `${listInWords(from)} swapped for a safe option`);",
    to: "    parts.push(`${plan.substitutions.length} exercise${plan.substitutions.length === 1 ? '' : 's'} swapped for a safe option`);",
    suites: ['test:injury-fallback-journey'],
  },
  {
    id: 'M10',
    what: "R-103's partial-coverage disclosure is dropped",
    file: 'src/utils/injurySessionRecomposition.ts',
    from: '  const untrained = args.untrainedInWords ?? [];',
    to: '  const untrained: readonly string[] = [];',
    suites: ['test:injury-fallback-journey'],
  },
  /* ⚠ **M11 IS RETIRED, NOT LOST.** It mutated the resolve's "this session is
   * still empty" arm, and it SURVIVED once Sam's ruling of 2026-08-20 landed —
   * correctly, because nothing empties a session any more, so the arm became
   * unreachable. The arm is deleted (see \), and the
   * behaviour it guarded is now held by M12, M13 and M14. A mutant aimed at a
   * clause no world reaches proves nothing. */
  {
    id: 'M12',
    what: "an injury omission writes into the athlete's Remove list again (Sam's ruling 2, reversed)",
    file: 'src/utils/programControlActions.ts',
    from: '  appliedOmissions.push(...plan.omissions);',
    to: `  for (const omitted of plan.omissions) {
    const outcome = executeProgramControlAction({
      type: 'remove_exercise', source: args.source, scope: 'today_only',
      payload: { date: args.date, exercise: omitted },
      requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true,
    });
    if (outcome.ok) appliedOmissions.push(omitted);
  }`,
    suites: ['test:injury-fallback-journey'],
  },
  {
    id: 'M13',
    what: 'the withhold projection stops marking rows, so nothing says the work is unsafe',
    file: 'src/rules/injuryWithheldRows.ts',
    from: '  if (withheld.size === 0) return workout;',
    to: '  if (withheld.size >= 0) return workout;',
    suites: ['test:injury-fallback-journey'],
  },
  {
    id: 'M14',
    what: 'the injured date can be recorded as a normal session again',
    file: 'src/store/sessionOutcomeTransaction.ts',
    from: '  if (injuryRefusal) return injuryRefusal;',
    to: '  if (injuryRefusal && false) return injuryRefusal;',
    suites: ['test:injury-fallback-journey'],
  },
  {
    id: 'M15',
    what: 'an ORDINARY injury blocks the session too, not just a red flag',
    file: 'src/rules/injuryWithheldRows.ts',
    from: '  const withheld = injuryWithholdingsOn(args).filter((entry) => entry.redFlag);',
    to: '  const withheld = injuryWithholdingsOn(args);',
    suites: ['test:injury-fallback-journey'],
  },
  {
    id: 'M16',
    what: 'an injury withholds work on days BEFORE it was reported',
    file: 'src/rules/injuryWithheldRows.ts',
    from: '    .filter((episode) => episode.onsetOrReportedDate.slice(0, 10) <= date);',
    to: '    .filter(() => true);',
    suites: ['test:injury-fallback-journey'],
  },
  {
    id: 'M17',
    what: 'the typed sheet stops outranking the Bible\'s named swap examples at 6-7 (Sam\'s ruling 1, reversed)',
    file: 'src/rules/injuryExerciseRisk.ts',
    from: '  return !injurySeverityRemovesRiskyWork(severity);',
    to: '  return true;',
    suites: ['test:tap-swap-hierarchy'],
  },
  {
    id: 'M8',
    what: 'the 6-7 and 8-10 bands stop removing caution work, so risky rows stay legal',
    file: 'src/rules/injuryExerciseRisk.ts',
    from: '  return !injurySeverityRemovesRiskyWork(severity);',
    to: '  return true;',
    suites: ['test:injury-fallback-journey', 'test:tap-swap-hierarchy'],
  },
];

function runSuite(name) {
  try {
    const out = execSync(`npm run ${name} 2>&1`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return { out, threw: false };
  } catch (error) {
    return { out: String(error.stdout ?? '') + String(error.stderr ?? ''), threw: true };
  }
}

function verdict(out) {
  const fails = (out.match(/^\s*(FAIL|fail|✗) /gm) ?? []).length;
  const passes = (out.match(/^\s*(ok|✓) /gm) ?? []).length;
  return { fails, passes };
}

const only = process.argv[2];
const results = [];
for (const mutation of MUTATIONS) {
  if (only && mutation.id !== only) continue;
  const edits = [mutation, ...(mutation.extra ? [mutation.extra] : [])];
  const backups = new Map();
  for (const edit of edits) {
    if (!backups.has(edit.file)) backups.set(edit.file, fs.readFileSync(edit.file, 'utf8'));
  }
  let applied = true;
  for (const edit of edits) {
    const before = fs.readFileSync(edit.file, 'utf8');
    if (!before.includes(edit.from)) {
      console.log(`${mutation.id}  ANCHOR MISSING in ${edit.file} — mutation NOT applied, so it proves nothing.`);
      applied = false;
      break;
    }
    const after = before.replace(edit.from, edit.to);
    console.log(`${mutation.id}  ${edit.file}: ${before.length} -> ${after.length} bytes`);
    fs.writeFileSync(edit.file, after);
  }
  if (applied) {
    for (const suite of mutation.suites) {
      const { out, threw } = runSuite(suite);
      const { fails, passes } = verdict(out);
      const names = (out.match(/^\s*(?:FAIL|fail|✗)\s+(.*)$/gm) ?? []).slice(0, 4)
        .map((line) => line.trim().replace(/^(FAIL|fail|✗)\s+/, ''));
      results.push({ id: mutation.id, what: mutation.what, suite, fails, passes, threw, names });
    }
  }
  for (const [file, content] of backups) fs.writeFileSync(file, content);
}

console.log('\n══ MUTATION RESULTS ══');
for (const r of results) {
  const killed = r.fails > 0 || r.threw;
  console.log(`${r.id} ${killed ? 'KILLED' : '*** SURVIVED ***'}  ${r.suite}  ${r.passes} ok / ${r.fails} red${r.threw ? ' (THREW)' : ''}`);
  console.log(`     ${r.what}`);
  for (const name of r.names) console.log(`     red: ${name}`);
}
const survived = results.filter((r) => r.fails === 0 && !r.threw);
console.log(`\n${results.length - survived.length}/${results.length} mutants killed.`);
if (survived.length > 0) process.exit(1);
