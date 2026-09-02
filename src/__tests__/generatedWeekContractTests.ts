/**
 * THE GENERATED-WEEK CONTRACT AND ITS VALIDATOR — one cell per clause.
 *
 *   npm run test:generated-week
 *
 * **EVERY CLAUSE HAS A LIVE GUARD AND EVERY GUARD HAS BEEN SEEN RED.** Each
 * block below builds a week that SATISFIES the clause, asserts acceptance, then
 * mutates exactly the fact the clause is about and asserts the refusal names
 * that clause. A cell that only asserts the happy path proves the clause is
 * spelled, not that it bites.
 *
 * The centre of the file is `[pure]`: two weeks with identical meaning and
 * different provenance must receive the SAME verdict. That is the property the
 * whole rebuild exists to create — acceptance that depends on what a week
 * contains, never on what built it.
 */
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import {
  GENERATED_WEEK_CLAUSES,
  clauseAuthorityTable,
  generatedWeekContractFrom,
  type GeneratedWeekClauseId,
  type GeneratedWeekContract,
} from '../rules/generatedWeekContract';
import { validateGeneratedWeek } from '../rules/validateGeneratedWeek';
import type { Workout } from '../types/domain';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];
function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

// ── Fixtures ───────────────────────────────────────────────────────────────

function contract(over: Partial<GeneratedWeekContract['targets']> = {}): GeneratedWeekContract {
  return {
    protocolVersion: 1,
    clauses: GENERATED_WEEK_CLAUSES,
    kitUnachievablePatterns: [],
    targets: {
      mainStrengthRequiredMinimum: 2,
      mainStrengthPlannerSelectedTarget: null,
      mainStrengthPermittedMaximum: null,
      coreConditioningRequiredMinimum: 0,
      coreConditioningPlannerTarget: null,
      sprintHighSpeedRequiredMinimum: 0,
      fullRestRequiredMinimum: 0,
      hardDayPermittedMaximum: 7,
      requiredSafePatterns: ['squat', 'hinge'],
      prohibitedPatterns: [],
      weeklyMainSeatCeilingExpected: true,
      trainingPaused: false,
      prohibitedSprintHighSpeed: false,
      prohibitedPowerFamilies: [],
      ...over,
    },
  } as GeneratedWeekContract;
}

let rowSeq = 0;
function mainLift(pattern: string, provenance = 'composer_declaration'): unknown {
  rowSeq += 1;
  return {
    id: `row-${rowSeq}`, workoutId: 'w', exerciseId: 'e', exerciseOrder: rowSeq,
    prescribedSets: 3, prescribedRepsMin: 5, prescribedRepsMax: 8, restSeconds: 0,
    exercise: { id: 'e', name: `Lift ${pattern} ${rowSeq}` },
    section18Evidence: {
      protocolVersion: 1, role: 'main_strength',
      slot: pattern === 'squat' || pattern === 'hinge' ? pattern : null,
      strengthPattern: pattern, mainStrengthPattern: pattern, provenance,
    },
  };
}

function day(dayOfWeek: number, rows: unknown[], over: Record<string, unknown> = {}): Workout {
  return {
    id: `d-${dayOfWeek}`, microcycleId: 'm', dayOfWeek,
    name: `Day ${dayOfWeek}`, description: '', durationMinutes: 60,
    intensity: 'Moderate', workoutType: 'Strength', sessionTier: 'core',
    exercises: rows, ...over,
  } as unknown as Workout;
}

/** A week that satisfies the default contract: two main-strength days. */
function lawfulWeek(): Workout[] {
  return [
    day(1, [mainLift('squat')]),
    day(3, [mainLift('hinge')]),
  ];
}

function verdictOf(workouts: Workout[], c = contract(), anchors: never[] = []): {
  verdict: string; clauses: GeneratedWeekClauseId[];
} {
  const result = validateGeneratedWeek({ workouts, contract: c, anchors });
  return { verdict: result.verdict, clauses: result.findings.map((f) => f.clause) };
}

// ── [authority] every clause cites a Bible section or an R-number ───────────
console.log('\n[authority] Every clause names an existing authority');
{
  ok('the clause set is non-empty — non-vacuity first', GENERATED_WEEK_CLAUSES.length >= 10,
    `${GENERATED_WEEK_CLAUSES.length} clauses`);
  const uncited = GENERATED_WEEK_CLAUSES.filter((clause) =>
    !(clause.authority.kind === 'bible'
      ? clause.authority.section.length > 0
      : /^R-\d+/.test(clause.authority.ruling)));
  ok('no clause is uncited', uncited.length === 0,
    uncited.map((c) => c.id).join(', '));
  const unquoted = GENERATED_WEEK_CLAUSES.filter((c) => c.authority.quote.trim().length < 10);
  ok('every citation carries the authority\'s own words', unquoted.length === 0,
    unquoted.map((c) => c.id).join(', '));
  ok('the clause→authority table is DERIVED from the clause set, not hand-written',
    clauseAuthorityTable().length === GENERATED_WEEK_CLAUSES.length);
  const ids = GENERATED_WEEK_CLAUSES.map((c) => c.id);
  ok('no duplicate clause ids', new Set(ids).size === ids.length);
}

// ── [pure] THE CENTREPIECE — provenance cannot change a verdict ─────────────
console.log('\n[pure] Two identical weeks, different provenance, SAME verdict');
{
  const composed = lawfulWeek();
  const legacy = [
    day(1, [mainLift('squat', 'canonical_row_classifier')]),
    day(3, [mainLift('hinge', 'canonical_row_classifier')]),
  ];
  const a = validateGeneratedWeek({ workouts: composed, contract: contract(), anchors: [] });
  const b = validateGeneratedWeek({ workouts: legacy, contract: contract(), anchors: [] });
  ok('the composed week is accepted', a.verdict === 'accepted', a.verdict);
  ok('the legacy-provenance week gets the SAME verdict', b.verdict === a.verdict,
    `${a.verdict} vs ${b.verdict}`);
  ok('and the SAME ledger', JSON.stringify(a.ledger) === JSON.stringify(b.ledger));

  // The envelope the three stamping attempts chased. Measured inert.
  const withEnvelope = composed.map((workout) => ({
    ...workout,
    section18Evidence: {
      protocolVersion: 1, conditioningRole: 'none',
      conditioningStress: 'unknown', provenance: 'planner_and_canonical_content',
    },
  })) as Workout[];
  const c = validateGeneratedWeek({ workouts: withEnvelope, contract: contract(), anchors: [] });
  ok('a `conditioningRole: none` envelope does not change the verdict',
    c.verdict === a.verdict && JSON.stringify(c.ledger) === JSON.stringify(a.ledger),
    `${a.verdict} vs ${c.verdict}`);

  // Session names are not evidence.
  const renamed = composed.map((workout) => ({ ...workout, name: 'Conditioning Flush' }));
  ok('renaming every session does not change the verdict',
    validateGeneratedWeek({ workouts: renamed, contract: contract(), anchors: [] })
      .verdict === a.verdict);

  // Row ORDER is not identity.
  const reordered = [composed[1], composed[0]];
  ok('reordering the days does not change the verdict',
    validateGeneratedWeek({ workouts: reordered, contract: contract(), anchors: [] })
      .verdict === a.verdict);
}

// ── [purity] the validator returns the week untouched ──────────────────────
console.log('\n[purity] Nothing is repaired, restored or rewritten');
{
  const week = lawfulWeek();
  const before = JSON.stringify(week);
  validateGeneratedWeek({ workouts: week, contract: contract(), anchors: [] });
  ok('the input week is byte-identical after judging', JSON.stringify(week) === before);
  const source = require('fs').readFileSync(
    require('path').resolve(__dirname, '../rules/validateGeneratedWeek.ts'), 'utf8');
  ok('the validator imports no builder, gateway, repair engine or canonicaliser',
    !/from '.*defaultProgram'|from '.*section18AcceptedWeekGateway'|from '.*wholeWeekRepairEngine'|from '.*workoutCanonicalisation'|from '.*section18SafetyFinaliser'/
      .test(source));
  ok('the validator never reads a row/workout `provenance`',
    !/\.provenance/.test(source));
}

// ── One cell per clause: satisfied → accepted, mutated → that clause reds ───
console.log('\n[clauses] Each clause accepts what satisfies it and REDS what does not');
{
  ok('[baseline] the lawful week is accepted',
    verdictOf(lawfulWeek()).verdict === 'accepted');

  // main_strength_required_minimum
  const oneLift = [day(1, [mainLift('squat')])];
  const r1 = verdictOf(oneLift);
  ok('[main_strength_required_minimum] RED when a main-strength session is missing',
    r1.verdict === 'refused' && r1.clauses.includes('main_strength_required_minimum'),
    r1.clauses.join(','));

  // main_strength_planner_selected_target
  const r2 = verdictOf(lawfulWeek(), contract({ mainStrengthPlannerSelectedTarget: 3 }));
  ok('[main_strength_planner_selected_target] RED when the planner asked for more',
    r2.verdict === 'refused' && r2.clauses.includes('main_strength_planner_selected_target'),
    r2.clauses.join(','));

  // main_strength_permitted_maximum
  const r3 = verdictOf(lawfulWeek(), contract({ mainStrengthPermittedMaximum: 1 }));
  ok('[main_strength_permitted_maximum] RED above the ceiling',
    r3.verdict === 'refused' && r3.clauses.includes('main_strength_permitted_maximum'),
    r3.clauses.join(','));

  // required_safe_patterns_present
  const r4 = verdictOf(lawfulWeek(), contract({ requiredSafePatterns: ['squat', 'hinge', 'pull'] }));
  ok('[required_safe_patterns_present] RED when a required pattern is untrained',
    r4.verdict === 'refused' && r4.clauses.includes('required_safe_patterns_present'),
    r4.clauses.join(','));

  // ...and DISCLOSED, not refused, when the kit cannot train it (R-083).
  const disclosed = validateGeneratedWeek({
    workouts: lawfulWeek(),
    contract: { ...contract({ requiredSafePatterns: ['squat', 'hinge', 'pull'] }),
      kitUnachievablePatterns: ['pull'] } as GeneratedWeekContract,
    anchors: [],
  });
  ok('[required_safe_patterns_present] a KIT-unachievable pattern is disclosed, not refused',
    disclosed.verdict === 'accepted_with_disclosed_gaps'
    && disclosed.disclosedGaps.length === 1
    && disclosed.findings.length === 0,
    `${disclosed.verdict} / ${disclosed.findings.length} findings`);

  // pattern_balance — the historical id now guards the weekly-seat ceiling.
  const lop = [day(1, [mainLift('squat'), mainLift('squat'), mainLift('squat')]),
    day(3, [mainLift('hinge')])];
  const r5 = verdictOf(lop);
  ok('[pattern_balance] RED when one automatic weekly main seat is spent twice',
    r5.verdict === 'refused' && r5.clauses.includes('pattern_balance'),
    r5.clauses.join(','));

  // prohibited_patterns_absent
  const r6 = verdictOf(lawfulWeek(), contract({ prohibitedPatterns: ['squat'] }));
  ok('[prohibited_patterns_absent] RED when a prohibited pattern survives',
    r6.verdict === 'refused' && r6.clauses.includes('prohibited_patterns_absent'),
    r6.clauses.join(','));

  // core_conditioning_required_minimum
  const r7 = verdictOf(lawfulWeek(), contract({ coreConditioningRequiredMinimum: 1 }));
  ok('[core_conditioning_required_minimum] RED when core conditioning is short',
    r7.verdict === 'refused' && r7.clauses.includes('core_conditioning_required_minimum'),
    r7.clauses.join(','));
  const withConditioning = [day(1, [mainLift('squat')], { conditioningBlock: { kind: 'x' } }),
    day(3, [mainLift('hinge')])];
  ok('[core_conditioning_required_minimum] GREEN once a day actually carries conditioning',
    verdictOf(withConditioning, contract({ coreConditioningRequiredMinimum: 1 }))
      .verdict === 'accepted');

  // sprint_high_speed_required_minimum
  const r8 = verdictOf(lawfulWeek(), contract({ sprintHighSpeedRequiredMinimum: 1 }));
  ok('[sprint_high_speed_required_minimum] RED with no sprint night',
    r8.verdict === 'refused' && r8.clauses.includes('sprint_high_speed_required_minimum'),
    r8.clauses.join(','));
  const withSpeed = [day(1, [mainLift('squat')], { speedBlock: { kind: 'true_speed' } }),
    day(3, [mainLift('hinge')])];
  ok('[sprint_high_speed_required_minimum] GREEN with a true-speed block — THE FIELD THE '
    + 'HANDOVER USED TO DROP',
    verdictOf(withSpeed, contract({ sprintHighSpeedRequiredMinimum: 1 })).verdict === 'accepted');

  // full_rest_required_minimum
  const everyDay = [0, 1, 2, 3, 4, 5, 6].map((d) => day(d, [mainLift('squat')]));
  const r9 = verdictOf(everyDay, contract({ fullRestRequiredMinimum: 1,
    mainStrengthPermittedMaximum: null }));
  ok('[full_rest_required_minimum] RED when every day requires work',
    r9.verdict === 'refused' && r9.clauses.includes('full_rest_required_minimum'),
    r9.clauses.join(','));

  // hard_day_permitted_maximum
  const hard = [0, 1, 2].map((d) => day(d, [mainLift('squat')], { intensity: 'High' }));
  // R-359 (Sam, 2026-09-03: "go") — R-009's word at the contract: a sixth hard
  // day is WARNED, never refused. The clause is DISCLOSED and the week stands;
  // the §18 effective-week evaluator carries the warning downstream. (Until
  // 2026-09-03 this cell pinned a refusal, and three cohort athletes saw a
  // blank program for 22 weeks.)
  const r10 = validateGeneratedWeek({ workouts: hard, contract: contract({ hardDayPermittedMaximum: 2 }), anchors: [] });
  const r10Control = validateGeneratedWeek({ workouts: hard, contract: contract({ hardDayPermittedMaximum: 3 }), anchors: [] });
  ok('[hard_day_permitted_maximum] DISCLOSED above the hard-DAY ceiling; the verdict is whatever the OTHER clauses say (R-359)',
    !r10.findings.some((f) => f.clause === 'hard_day_permitted_maximum')
      && r10.disclosedGaps.some((f) => f.clause === 'hard_day_permitted_maximum')
      && r10.verdict === r10Control.verdict
      && r10.findings.map((f) => f.clause).join(',') === r10Control.findings.map((f) => f.clause).join(','),
    `${r10.verdict} findings=${r10.findings.map((f) => f.clause).join(',')} disclosed=${r10.disclosedGaps.map((f) => f.clause).join(',')} control=${r10Control.verdict}`);

  // training_paused_means_no_training
  const r11 = verdictOf(lawfulWeek(), contract({ trainingPaused: true }));
  ok('[training_paused_means_no_training] RED when a paused week still requires work',
    r11.verdict === 'refused' && r11.clauses.includes('training_paused_means_no_training'),
    r11.clauses.join(','));

  // prohibited_power_absent
  const powerRow = { id: 'p', role: 'power', power: { family: 'lower', kind: 'jump' },
    exercise: { name: 'Vertical Jump' } };
  const withPower = [day(1, [powerRow, mainLift('squat')]), day(3, [mainLift('hinge')])];
  const r12 = verdictOf(withPower, contract({ prohibitedPowerFamilies: ['lower'] }));
  ok('[prohibited_power_absent] RED when a prohibited power family survives',
    r12.verdict === 'refused' && r12.clauses.includes('prohibited_power_absent'),
    r12.clauses.join(','));

  // prohibited_sprint_absent
  const r13 = verdictOf(withSpeed, contract({ prohibitedSprintHighSpeed: true }));
  ok('[prohibited_sprint_absent] RED when sprint work survives a sprint prohibition',
    r13.verdict === 'refused' && r13.clauses.includes('prohibited_sprint_absent'),
    r13.clauses.join(','));

  // row_role_is_declared
  const undeclared = [
    day(1, [{ id: 'u', exercise: { name: 'Mystery Lift' },
      section18Evidence: { role: 'main_strength', strengthPattern: 'squat',
        mainStrengthPattern: null, provenance: 'canonical_row_classifier' } }]),
    day(3, [mainLift('hinge')]),
  ];
  const r14 = verdictOf(undeclared);
  ok('[row_role_is_declared] RED when a strength row declares no pattern',
    r14.verdict === 'refused' && r14.clauses.includes('row_role_is_declared'),
    r14.clauses.join(','));
}

// ── [coverage] no clause is spelled without a guard ────────────────────────
console.log('\n[coverage] Every clause in the set is exercised above');
{
  const guarded: GeneratedWeekClauseId[] = [
    'main_strength_required_minimum', 'main_strength_planner_selected_target',
    'main_strength_permitted_maximum', 'required_safe_patterns_present',
    'pattern_balance', 'prohibited_patterns_absent',
    'core_conditioning_required_minimum', 'sprint_high_speed_required_minimum',
    'full_rest_required_minimum', 'hard_day_permitted_maximum',
    'training_paused_means_no_training', 'prohibited_power_absent',
    'prohibited_sprint_absent', 'row_role_is_declared',
  ];
  const ungiven = GENERATED_WEEK_CLAUSES
    .map((clause) => clause.id)
    .filter((id) => !guarded.includes(id));
  ok('every declared clause has a red-proven cell above', ungiven.length === 0,
    `unguarded: ${ungiven.join(', ')}`);
}

// ── [projection] the contract carries the phase table's numbers, never its own
console.log('\n[projection] The contract quotes the authority; it does not re-author it');
{
  const fake = {
    mainStrength: { exposure: { requiredMinimum: 3, plannerSelectedTarget: 4,
      plannerSelectionKind: 'core', permittedMaximum: 5 } },
    conditioning: { core: { requiredMinimum: 2, plannerSelectedTarget: 2 } },
    sprintHighSpeed: { exposure: { requiredMinimum: 1 } },
    restStress: { requiredFullRestMinimum: 1, permittedHardDayMaximum: 5 },
    strengthPatterns: { requiredSafePatterns: ['squat'], prohibitedPatterns: [],
      balanceExpectation: 'equal_or_near_equal', permittedCountDifference: 1 },
    safety: { trainingPaused: false, prohibitedSprintHighSpeed: false,
      prohibitedPowerFamilies: [] },
  } as never;
  const projected = generatedWeekContractFrom(fake, ['pull']);
  ok('every number is the phase table\'s own',
    projected.targets.mainStrengthRequiredMinimum === 3
    && projected.targets.mainStrengthPlannerSelectedTarget === 4
    && projected.targets.mainStrengthPermittedMaximum === 5
    && projected.targets.coreConditioningRequiredMinimum === 2
    && projected.targets.sprintHighSpeedRequiredMinimum === 1
    && projected.targets.fullRestRequiredMinimum === 1
    && projected.targets.hardDayPermittedMaximum === 5,
    JSON.stringify(projected.targets));
  ok('a non-core planner selection is not carried as a target',
    generatedWeekContractFrom({ ...(fake as object),
      mainStrength: { exposure: { requiredMinimum: 3, plannerSelectedTarget: 4,
        plannerSelectionKind: 'optional', permittedMaximum: null } } } as never)
      .targets.mainStrengthPlannerSelectedTarget === null);
  ok('kit-unachievable patterns are carried so a gap can name its cause',
    projected.kitUnachievablePatterns.length === 1);
}

console.log(`\nGenerated-week contract: passed=${passed} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
}
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
