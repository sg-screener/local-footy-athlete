const fs = require('fs');
const path = require('path');
const mutations = {
  hidden_rep_target: ['rules/blockBoundaryProgression.ts', 'const top = displayReps(log.prescribedRepsMin, log.prescribedRepsMax);', 'const top = log.prescribedRepsMax;', 'follow-up displayed reps'],
  dishonest_journey_reps: ['__tests__/support/athleteJourney.ts', 'displayReps(row.prescribedRepsMin, row.prescribedRepsMax) ?? undefined', 'row.prescribedRepsMax', 'follow-up displayed reps'],
  chosen_row_marked_skip: ['rules/athleteAdditionAuthority.ts', 'return !!row.athleteAdditionId', 'return false && !!row.athleteAdditionId', 'follow-up Pull-Ups'],
  goals_disconnected: ['rules/canonicalWeeklyRowCompiler.ts', 'workouts = applyGoalProgramming(workouts, {', 'applyGoalProgramming(workouts, {', 'follow-up goals change'],
  goals_unbounded: ['rules/goalProgramming.ts', 'let setAllowance = Math.floor(totalSets * 0.10);', 'let setAllowance = totalSets;', 'follow-up goal limits'],
  goals_ignore_game: ['rules/goalProgramming.ts', 'return gap == null || gap > 2;', 'return true;', 'follow-up goal limits'],
  goals_ignore_recovery: ['rules/goalProgramming.ts', 'context.protectedDays.includes(workout.dayOfWeek)', 'false', 'follow-up goal limits'],
  goals_ignore_injury: ['rules/goalProgramming.ts', '!context.injuryAdjusted', 'true', 'follow-up goal limits'],
  dumbbell_ceiling: ['data/equipmentLattice.ts', 'return origin + Math.floor((weightKg - origin) / step) * step;', 'return Math.min(60, origin + Math.floor((weightKg - origin) / step) * step);', 'dumbbell signed'],
  dumbbell_next_ceiling: ['data/equipmentLattice.ts', 'return origin + (Math.floor((baseKg - origin + 1e-9) / step) + 1) * step;', 'return Math.min(60, origin + (Math.floor((baseKg - origin + 1e-9) / step) + 1) * step);', 'dumbbell signed'],
  boot_ignores_phase: ['store/quiescentBoot.ts', 'phaseHasRecurringFixtures(profile?.seasonPhase) ? storedGameAnchor(profile) : null', 'storedGameAnchor(profile)', 'Off-season 3 days'],
  added_row_not_owned: ['rules/canonicalWeeklyExerciseEditCompiler.ts', 'athleteAdditionId: additionId,', 'athleteAdditionId: undefined,', 'athlete can add and repeat power'],
  repeated_name_one_identity: ['rules/canonicalWeeklyExerciseEditCompiler.ts', 'const additionId = edit.additionId ??', 'const additionId =', 'athlete can add and repeat power'],
  menu_filters_choice: ['utils/addExerciseCandidates.ts', 'automaticAlternative = false', 'automaticAlternative = true', 'every catalogue choice'],
  automatic_injury_uses_manual_menu: ['utils/addExerciseCandidates.ts', 'return additionCandidates(args, true);', 'return additionCandidates(args, false);', 'every catalogue choice'],
  wrong_conditioning_field: ['rules/conditioningDisplay.ts', "...(countStep ? { prescribedSets: step.to } : workStep ? {", "...(true ? { prescribedSets: step.to } : workStep ? {", 'conditioning duration step'],
  ignores_current_dose: ['rules/conditioningDoseStep.ts', '  const sets = parseConditioningDose(template.setsRounds);', '  current = undefined;\n  const sets = parseConditioningDose(template.setsRounds);', 'conditioning progression begins'],
  advances_deload: ['rules/blockBoundaryProgression.ts', "phase === 'In-season' || args.weekKind === 'deload'", "phase === 'In-season'", 'actual four-week feedback'],
  injury_loses_choice: ['rules/canonicalWeeklySourceFactCompiler.ts', 'const athleteRows = workout.exercises.filter(row => holdsChoice(row, dateISO));', 'const athleteRows = [];', 'injury and beginner'],
  ignores_later_report: ['rules/canonicalWeeklySourceFactCompiler.ts', '.filter(fact => factHorizonCoversDate(fact, dateISO))', '.filter(fact => false)', 'later injury and equipment'],
  g1_requires_other_route: ['utils/planChangeProducer.ts', "if (args.change.kind === 'add_category' || args.change.kind === 'add_template') return null;", '', 'session on 2026-10-02'],
  game_add_menu_locked: ['rules/projectVisibleWeek.ts', 'canAdd: true,', 'canAdd: !isFixture,', 'session on 2026-10-03'],
  game_hides_added_training: ['utils/sessionResolver.ts', '? { ...accepted.workout, fixtureVariant: fixture.fixtureVariant }', '? fixture', 'session on 2026-10-03'],
  no_two_day_warning: ['rules/athleteAdditionWarnings.ts', 'days >= 0 && days <= 2', 'days >= 0 && days < 2', 'warning matrix'],
  no_repeat_warning: ['rules/athleteAdditionWarnings.ts', "classifyExerciseRole(name) === 'main_lift'", 'false', 'warning matrix'],
};

function installMutation(name) {
  const entry = mutations[name];
  if (!entry) throw Error(`Unknown mutation ${name}`);
  const [relative, from, to] = entry;
  const file = path.resolve(__dirname, '../src', relative);
  const before = fs.readFileSync(file, 'utf8');
  if (before.split(from).length !== 2) throw Error(`Mutation ${name} must match exactly once`);
  const Module = require('module');
  const original = Module._extensions['.ts'];
  Module._extensions['.ts'] = (module, filename) => {
    if (filename !== file) return original(module, filename);
    const code = require('sucrase').transform(before.replace(from, to), {
      transforms: ['typescript', 'imports'], filePath: filename,
    }).code;
    process.stdout.write(`MUTATION_APPLIED ${name}\n`);
    module._compile(code, filename);
  };
}
module.exports = { installMutation };

if (require.main === module) {
  const { spawnSync } = require('child_process');
  let killed = 0;
  const failures = [];
  for (const [name, [, , , filter]] of Object.entries(mutations)) {
    const result = spawnSync(process.execPath, ['src/__tests__/yearscanRepairTests.cjs'], {
      cwd: path.resolve(__dirname, '..'), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, YEARSCAN_MUTATION: name, YEARSCAN_FILTER: filter },
    });
    const summary = result.stdout.split('\n').find(line => line.startsWith('{"suite":"yearscan-repairs"'));
    const totals = summary && JSON.parse(summary);
    const valid = result.status === 1 && result.stdout.includes(`MUTATION_APPLIED ${name}`)
      && totals?.failed > 0 && totals.failures.some(failure => failure.name.includes(filter));
    if (valid) { killed++; console.log(`KILLED ${name}: ${totals.failed} named test group(s) failed`); }
    else { failures.push(name); console.error(`UNPROVEN ${name}\n${result.stdout}\n${result.stderr}`); }
  }
  console.log(JSON.stringify({instrument:'distinct injected source faults', attempted:Object.keys(mutations).length, killed, failures}));
  process.exitCode = failures.length ? 1 : 0;
}
