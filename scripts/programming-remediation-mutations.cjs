'use strict';
// In-memory mutants only. The shared checkout is never changed by this runner.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const repo = path.resolve(__dirname, '..');
const mutants = {
  speed_unrelated_fatigue: ['src/rules/weeklyScheduler.ts', 'inputs.clubNights.length > 0 && missingSpeedQualities !== null\n      && (inputs.readiness.lowReadiness', 'missingSpeedQualities !== null\n      && (inputs.readiness.lowReadiness', 'speed', 'club-top-up fatigue rule does not refuse existing novice no-club programming'],
  landmine_strength_slot: ['src/rules/sessionSlotCoverage.ts', 'if (tag.power) return [];', 'if (false && tag.power) return [];', 'landmine', 'explosive landmine is absent from every strength slot'],
  primer_power_evidence: ['src/utils/sessionBuilder.ts', "role: 'power',\n    power: { family: entry.family, kind: 'primer' },", "role: 'accessory',", 'landmine', 'selected landmine is power without strength credit or changed dose'],
  primer_role_flattened: ['src/utils/sessionTemplate.ts', "oneRole && row.role !== 'power'", 'oneRole', 'landmine', 'selected landmine is power without strength credit or changed dose'],
  primer_order_lost: ['src/utils/sessionTemplate.ts', 'items: orderItems(items, oneRole\n', 'items: orderItems(items, false && oneRole\n', 'landmine', 'authored order survives truthful power roles'],
  injury_paused_copy: ['src/utils/guidedInjuryControl.ts', 'return injury.seriousSymptoms\n', 'return false && injury.seriousSymptoms\n', 'simple_injury', 'paused modifier names serious symptoms instead of inventing a high score'],
  injury_stale_copy: ['src/utils/activeProgramModifiers.ts', 'body: isSerious ? fallbackBody : c.modifierBody ?? fallbackBody,', 'body: c.modifierBody ?? fallbackBody,', 'simple_injury', 'reopened modifier uses actual safety facts instead of stale saved copy'],
  speed_club_blanket: ['src/rules/weeklyScheduler.ts', 'if (!missing?.length || inputs.readiness.lowReadiness', 'if (inputs.clubNights.length > 0 || !missing?.length || inputs.readiness.lowReadiness', 'speed', 'a club night does not blanket-deny an unmet speed need'],
  speed_quality_erased: ['src/rules/conditioningSelection.ts', "(template) => args.category !== 'sprint' || !args.requestedSpeedQualities", "(template) => true || args.category !== 'sprint' || !args.requestedSpeedQualities", 'speed', 'the delivered template serves only an unmet quality'],
  speed_fact_disconnected: ['src/rules/canonicalWeeklyCompiler.ts', 'sprintExposure: input.coaching.sprintExposure,', 'sprintExposure: undefined,', 'speed', 'actual onboarding/compiler delivers the missing quality only'],
  landmine_power_unreachable: ['src/rules/powerExercisePool.ts', "if (entry.family !== context.family) return false;", "if (entry.name === 'Explosive Landmine Press') return false;\n    if (entry.family !== context.family) return false;", 'landmine', 'real power pool includes the explosive landmine'],
  landmine_strength_fallback: ['src/data/exercisePoolsStrength.ts', 'if (!tags || tags.power) return null;', 'if (!tags) return null;', 'landmine', 'explosive landmine is absent from every strength slot'],
  pain_machine_disconnected: ['src/rules/injuryExerciseRisk.ts', 'return triggers.some(trigger => aliases[modality]?.includes(trigger.trim().toLowerCase()));', 'return false;', 'flush', 'only suitable available machines survive injury compilation'],
  injury_history_preservation: ['src/store/injuryEpisodeTransaction.ts', 'triggers: [...new Set([...args.existing.triggers, ...(args.constraint.triggers ?? [])])]', 'triggers: [...(args.constraint.triggers ?? [])]', 'simple_injury', 'simple severity update preserves reported painful movements'],
  injury_serious_score: ['src/rules/injuryWithheldRows.ts', 'return seriousSymptoms === true;', 'return seriousSymptoms === true && _severity >= 8;', 'simple_injury', 'serious symptoms do not require a high severity score'],
  injury_indirect_support: ['src/rules/injuryExerciseRisk.ts', '  const rating = tags.injury[bucket];', "  if (tags.region === 'lower' && ['shoulder','elbow','wrist/hand'].includes(bucket)) return 'good';\n  const rating = tags.injury[bucket];", 'simple_injury', 'loaded support is not blanket Good clearance'],
  injury_optional_pain: ['src/screens/home/GuidedInjuryFlowSheet.tsx', 'testID="injury-optional-pain"', 'testID="missing-pain-control"', 'injury_ui', 'painful movements are optional'],
  injury_severity_highlight: ['src/screens/home/GuidedInjuryFlowSheet.tsx', 'icon={severityBarsIcon(index + 1, SEVERITY_BAR_COLORS[index])}', 'icon={severityBarsIcon(index + 1, SEVERITY_BAR_COLORS[index])} selected={selectedSeverity.label === option.label}', 'injury_ui', 'severity rows have neutral chips and dividers'],
  removal_effect_identity: ['src/store/acceptedStateTransaction.ts', 'if (existing && reversibleAdjustmentWorkoutFingerprint(date, existing.remainingWorkout)\n    === reversibleAdjustmentWorkoutFingerprint(date, remainingWorkout)) {', 'if (existing) {', 'lowload_remove', 'removing added work is not mistaken for an already-applied addition'],
  category_missing_pool: ['src/rules/conditioningSelection.ts', "return templatesOfQuality('aerobic_power');", 'return [];', 'categories', 'vo2: nonempty pool contains only its intended qualities'],
  category_lossy_cod: ['src/rules/conditioningSelection.ts', "return templatesOfQuality('cod_decel');", "return templatesOfQuality('anaerobic');", 'categories', 'cod_decel: nonempty pool contains only its intended qualities'],
  category_new_vocabulary: ['src/rules/offseasonSubphasePolicy.ts', "| 'cod_decel';", "| 'cod_decel' | 'unhandled_quality';", 'categories_source', 'OffseasonConditioningCategory has a nonempty, fully accounted vocabulary'],
  category_recovery_identity: ['src/rules/conditioningSelection.ts', "if (role === 'optional_recovery_aerobic' || role === 'optional_flush') {", "if (role === 'optional_recovery_aerobic') {", 'categories', 'optional_flush: recovery demand selects flush'],
  flush_fixed_target: ['src/screens/home/dayWorkoutHelpers.ts', '`${exercise.prescribedSets} × ${base} ${unit}`', '`${exercise.prescribedSets} × ${exercise.prescribedRepsMin}-${exercise.prescribedRepsMax} ${unit}`', 'flush', 'fixed interval headline has one target'],
  flush_duration: ['src/data/conditioningTemplates.ts', 'function timedFlush(workSeconds: number, recoverySeconds: number, rounds: number) {', 'function timedFlush(workSeconds: number, recoverySeconds: number, rounds: number) { rounds *= 3;', 'flush', 'complete session is under 15 minutes'],
  flush_intensity: ['src/data/conditioningTemplates.ts', "intensity: 'Easy, 2–3/10; full conversation throughout'", "intensity: 'Hard, 8/10'", 'flush', 'easy throughout, transitions inside recovery'],
  flush_transition: ['src/data/conditioningTemplates.ts', 'complete rest, including transitions; after every round, including the last', 'complete rest; take extra time to change machines', 'flush', 'easy throughout, transitions inside recovery'],
  flush_warmup: ['src/rules/conditioningSelection.ts', "if (!opts.omitWarmup && template.quality !== 'flush')", 'if (!opts.omitWarmup)', 'flush', 'complete session is under 15 minutes'],
  flush_numeric_drift: ['src/data/conditioningTemplates.ts', 'intervalPrescription: { workSeconds, recoverySeconds, rounds }', 'intervalPrescription: { workSeconds: workSeconds + 30, recoverySeconds, rounds }', 'flush', 'timed dose agrees with numeric rounds/rest'],
  flush_machine_restriction: ['src/rules/conditioningSelection.ts', "return template.quality === 'flush' ? permitted : cappedErgModalities(template, permitted);", "return template.quality === 'flush' ? ['bike'] : cappedErgModalities(template, permitted);", 'flush', 'every available supported ergo is permitted'],
  eligibility_prose: ['src/rules/conditioningSelection.ts', 'const permitted = [...template.permittedModalities]', "const permitted = (template.modalityNotes.startsWith('ANY modality.') ? ['run','bike','air_bike','row','ski'] : [...template.permittedModalities])", 'flush', 'descriptive prose cannot change permitted modalities'],
  unused_duration: ['src/rules/conditioningSelection.ts', 'conditioningAthletePrescription(template).work.matchAll', 'template.workPeriod.matchAll', 'flush', 'resolved six-minute branch'],
  resolved_rounds: ['src/rules/conditioningSelection.ts', 'const parsed = parseConditioningDose(conditioningAthletePrescription(template).setsRounds);', 'const parsed = parseConditioningDose(template.setsRounds);', 'flush', 'numeric rounds agree with the displayed resolved branch'],
  retired_circuit: ['src/rules/conditioningSelection.ts', "template.automaticSelection !== 'retired' && qualities.includes(template.quality)", 'qualities.includes(template.quality)', 'flush', 'automatic pool excludes Bodyweight Circuit'],
  flush_history: ['src/services/api/generateProgram.ts', "require('../../rules/conditioningSelection').demandCategoryFor(\n                allocation.conditioningCategory, allocation.section18ConditioningRole)", 'allocation.conditioningCategory', 'flush_restart', 'new saved history records recovery demand'],
  flush_credit: ['src/rules/section18EffectiveWeekEvaluator.ts', 'if (isCoreRole(component.role)) {', "if (isCoreRole(component.role) || component.role === 'optional_flush') {", 'flush', 'recovery role never earns fitness-conditioning credit'],
  onboarding_inset: ['src/components/onboarding/OnboardingLayout.tsx', 'paddingTop: insets.top', 'paddingTop: 0', 'onboarding', 'stable context insets position the screen'],
  onboarding_skip_binding: ['src/screens/onboarding/TwoKmTimeTrialScreen.tsx', 'onPress={() => commit(null)}', 'onPress={() => commit(420)}', 'onboarding', 'skip and No have distinct button identities'],
  trigger: ['src/rules/injuryExerciseRisk.ts', '  const movement = getExerciseTags(exerciseName)?.movement;', '  return false;\n  const movement = getExerciseTags(exerciseName)?.movement;', 'injury', 'no affected existing row survives'],
  dose: ['src/rules/canonicalWeeklyInjuryCompiler.ts', 'sets: Math.min(originalRow?.prescribedSets ?? 3,\n          substitution.to.prescription?.sets ?? originalRow?.prescribedSets ?? 3)', 'sets: substitution.to.prescription?.sets ?? 3', 'injury', 'does not increase reduced session sets'],
  equipment: ['src/rules/canonicalWeeklyRowCompiler.ts', 'availableEquipment: equipment.tags,\n            availableEquipmentByDay: Object.fromEntries(Object.entries(weeklyAvailability.equipmentByDayOfWeek)\n              .map(([day, capabilities]) => [day, capabilities.tags]))', 'availableEquipment: profile.equipment ?? []', 'inputs', 'conflicting legacy equipment cannot change any final row'],
  mobility_identity: ['src/utils/visibleProgramReadModel.ts', "domain: lowLoadIds.has(exercise.id) ? 'recovery' : 'strength'", "domain: 'strength'", 'mobility', 'actual Mobility is recovery'],
  mobility_conservation: ['src/utils/workoutCanonicalisation.ts', 'const composedRows = inputWorkout.exercises.filter(row => row.composedOptionalKind);', 'const composedRows = [];', 'mobility', 'accepted Add keeps original Mobility'],
  mobility_move: ['src/utils/sessionComponents.ts', 'if (wantedExerciseIds.size > 0) return ids.some((id) => wantedExerciseIds.has(id));', 'if (wantedExerciseIds.size > 0 && hasStrength) return ids.some((id) => wantedExerciseIds.has(id));', 'mobility', 'Move transfers only Mobility'],
  weekday_prefix: ['src/rules/weeklyScheduler.ts', 'const count = Math.min(appConditioningBudget, legalConditioningCandidates.length);', 'const count = Math.min(appConditioningBudget, legalConditioningCandidates.length);\n    return legalConditioningCandidates.slice(0, count);', 'inputs', 'conditioning receiver spacing includes week boundary'],
  machine_count: ['src/rules/conditioningSelection.ts', 'let candidates = pool.filter((template) => filters.every((filter) => filter(template)));', 'let candidates = pool.filter((template) => filters.every((filter) => filter(template)));\n  if (args.offFeet && candidates.length) { const count = t => renderableModalities(t).filter(m => m !== "run" && machineOwned(m)).length; const most = Math.max(...candidates.map(count)); candidates = candidates.filter(t => count(t) === most); }', 'inputs', 'all five usable off-leg aerobic templates'],
  advanced_curl: ['src/data/exercisePools.ts', "if (ladderLevelForProfile(experience ?? null) !== 'advanced') return [...candidates];", 'return [...candidates];', 'inputs', 'advanced automatic curl pool prefers loaded alternatives'],
  specialist_choice: ['src/rules/conditioningSelection.ts', 'if (preferred) return preferred;', 'if (false && preferred) return preferred;', 'inputs', 'equivalent conditioning seats have distinct eligible templates'],
  quality_history: ['src/rules/conditioningSelection.ts', 'if (args.selectionContext) {', 'if (false && args.selectionContext) {', 'inputs', 'accepted identity restores independent of global block number'],
  in_run_selections: ['src/rules/canonicalWeeklyRowCompiler.ts', 'selectionHistory: [...(args.selectionHistory ?? []), ...selections]', 'selectionHistory: args.selectionHistory ?? []', 'inputs', 'accepted conditioning history and final rows survive restart'],
  typed_mode: ['src/utils/conditioningVisibleIdentity.ts', '  return conditioningModeLabel(option?.modality, option?.modalitySequence);', '  return undefined;', 'inputs', 'single prescriptions retain their typed running or off-leg mode'],
  clarity_cue: ['src/rules/conditioningDisplay.ts', 'const cue = athleteSentence(reviewedCopy?.cue ?? template.effortCue ??', 'const cue = athleteSentence(reviewedCopy?.intensity ?? template.effortCue ??', 'inputs', 'cue adds information rather than repeating intensity'],
  clarity_mixed: ['src/data/defaultProgram.ts', "requested === 'mixed' && template.quality === 'flush' && permittedMachines.length > 1", "requested === 'mixed' && permittedMachines.length > 1", 'inputs', 'only multi-round flushes mix machines'],
  clarity_sequence: ['src/data/defaultProgram.ts', '...(modalitySequence.length ? { modalitySequence } : {}),', '...{},', 'inputs', 'actual mode owner names only available machines'],
  no_duplicate_add: ['src/utils/sessionBuilder.ts', 'const alreadyProgrammed = new Set(existingExerciseNames.map(canonicalExerciseName));', 'const alreadyProgrammed = new Set();', 'inputs', 'added session checks every existing drill'],
  separate_mobility: ['src/utils/sessionComponents.ts', 'const key = row.workoutId ?? workout.id ?? kind;', 'const key = kind;', 'inputs', 'second session stays separately visible'],
  derived_warmup_duplicates: ['src/utils/canonicalPlanChangeCandidateMaterializer.ts', 'coachRevisionExistingExerciseNames(source, change.date)', 'source?.exercises.map(row => row.exercise.name)', 'inputs', 'separately derived visible warm-up is excluded too'],
  lowload_completion: ['src/utils/sessionExecutionChecklist.ts', 'if (lowLoadOwner) return lowLoadOwner.id;', 'if (false && lowLoadOwner) return lowLoadOwner.id;', 'inputs', 'completing the second session does not complete the first'],
  lowload_partition: ['src/utils/sessionComponents.ts', "(row.composedOptionalKind ?? lowLoadKind) === 'recovery'", "lowLoadKind === 'recovery' || row.composedOptionalKind === 'recovery'", 'inputs', 'each actual exercise appears once in the session checklist'],
  flush_absent: ['src/rules/weeklyScheduler.ts', "if (inputs.phase !== 'In-season' || entry.game || entry.clubTraining", "if (true || inputs.phase !== 'In-season' || entry.game || entry.clubTraining", 'gplus', 'optional flush attaches without replacing'],
  flush_unneeded_core: ['src/rules/weeklyScheduler.ts', 'const required = inputs.mildSorenessDays?.includes(entry.dayOfWeek) === true;', 'const required = true;', 'inputs', 'optional flush attaches without replacing'],
  fixture_flush: ['src/utils/fixtureMinimalReplan.ts', 'const source = withCompilerPlannerOffers(expired, args.targetMicrocycle.workouts);', 'const source = expired;', 'compiler', 'moving the fixture back restores the visible week exactly'],
  fallback_only: ['src/rules/blockExerciseSelection.ts', '? preferred : inputs.legalCandidates;', '? inputs.legalCandidates : inputs.legalCandidates;', 'inputs', 'automatic selection uses suitable alternatives'],
  unilateral_priority: ['src/rules/composeWeek.ts', 'const shapeSlots = singleLegOwnsLowerWork', 'const shapeSlots = false && singleLegOwnsLowerWork', 'inputs', 'missing kit does not repeat a fallback Leg Press ahead of single-leg work'],
  box_unreachable: ['src/rules/powerExercisePool.ts', "if (entry.family !== context.family) return false;", "if (entry.name === 'Box Jumps') return false;\n    if (entry.family !== context.family) return false;", 'inputs', 'Box Jumps: ordinary eligible pool'],
  standalone_mode: ['src/data/defaultProgram.ts', '...(!isStandaloneSpeed ? { conditioningBlock: buildConditioningBlock(', '...(false && !isStandaloneSpeed ? { conditioningBlock: buildConditioningBlock(', 'compiler', 'accumulated authored conditioning retains typed modality including standalone days'],
  title_as_exposure: ['src/utils/exposureEngine.ts', '${typedModality ? modalityText : displayText}', '${displayText}', 'inputs', 'typed off-leg identity survives every authored title mutation'],
  authored_kit: ['src/utils/sessionBuilder.ts', 'const names = row.names.filter(name => composedRowIsLegal(name, athlete.equipmentTags));', 'const names = row.names;', 'inputs', 'authored special rows respect the current equipment answer'],
  fact_replay: ['src/rules/canonicalWeeklyAthleteEditCompiler.ts', 'if (placement.workout && current?.sourceFactAdjustedPlacementId === placement.constraintId &&', 'if (false && placement.workout && current?.sourceFactAdjustedPlacementId === placement.constraintId &&', 'inputs', 'temporary kit restriction reaches special-session rows'],
  lifting_set_units: ['src/utils/injurySessionAdjustment.ts', 'const keptSets = [...parts.strengthRows, ...parts.supportRows, ...parts.powerRows]', 'const keptSets = rows', 'compiler', 'accumulated injury weeks retain the required strength and conditioning exposures'],
  strength_presentation: ['src/utils/sessionComponents.ts', ' && !hasTypedStrength;', ';', 'inputs', 'typed lifting retains its strength presentation in an energy container'],
  injury_horizon: ['src/rules/durableFactHorizon.ts', "fact.status === 'active' || fact.status === 'improving'\n        ? null : addDays(last, 6)", 'addDays(last, 6)', 'injury', 'accepted active injury horizon covers the next block without expiring'],
  rollover_facts: ['src/utils/programBlockRollover.ts', 'compileSourceFacts: true,', 'compileSourceFacts: false,', 'injury', 'rollover withholding and safe work survive restart'],
  optional_names: ['src/rules/projectVisibleWeek.ts', 'return kinds.size === 1 ? [...kinds][0] : workout?.composedOptionalKind;', 'return workout?.composedOptionalKind;', 'mobility', 'mixed optional parts retain their own signed names and buckets'],
  template_identity: ['src/utils/coachModalitySwap.ts', 'if (resolveTemplateByName(text)) return null;', 'if (false && resolveTemplateByName(text)) return null;', 'inputs', 'modality changes preserve every authored template identity and set the typed mode'],
  conditioning_evidence: ['src/rules/section18WorkoutEvidence.ts', "if (row.role === 'power' || row.role === 'conditioning') {", "if (row.role === 'power') {", 'inputs', 'authored conditioning rows retain conditioning evidence including every warm-up'],
};
const child = process.argv.find(a => a.startsWith('--child='))?.slice(8);
if (child) {
  require(path.join(repo, 'node_modules/sucrase/register'));
  const [file, from, to, witness] = mutants[child];
  if (witness === 'onboarding' || witness === 'categories_source' || witness === 'injury_ui') {
    const read = fs.readFileSync;
    fs.readFileSync = (filename, ...args) => {
      const result = read(filename, ...args);
      if (String(filename) !== path.join(repo, file)) return result;
      const code = result.toString();
      if (code.split(from).length !== 2) throw Error(`MUTATION MISSED: ${child}`);
      console.log(`MUTATION_LANDED=${child}`);
      return code.replace(from, to);
    };
    let failures = 0;
    const helper = witness === 'injury_ui' ? 'guidedInjuryUiTruth' : witness === 'onboarding' ? 'onboardingTapTruth' : 'conditioningCategoryTruth';
    require(path.join(repo, 'src/__tests__/support', helper))[helper]((label, value) => {
      if (!value) failures++;
      console.log(value ? 'PASS' : 'FAIL', label);
    });
    process.exitCode = failures ? 1 : 0;
    return;
  }
  const original = require.extensions['.ts'];
  require.extensions['.ts'] = (module, filename) => {
    if (filename !== path.join(repo, file)) return original(module, filename);
    let code = fs.readFileSync(filename, 'utf8');
    if (code.split(from).length !== 2) throw Error(`MUTATION MISSED: ${child}`);
    code = code.replace(from, to);
    console.log(`MUTATION_LANDED=${child}`);
    module._compile(require(path.join(repo, 'node_modules/sucrase')).transform(code, { transforms: ['typescript', 'imports'] }).code, filename);
  };
  if (witness === 'categories') {
    let failures = 0;
    require(path.join(repo, 'src/__tests__/support/conditioningCategoryTruth')).conditioningCategoryTruth((label, value) => {
      if (!value) failures++;
      console.log(value ? 'PASS' : 'FAIL', label);
    });
    process.exitCode = failures ? 1 : 0;
  }
  else if (witness === 'injury') require(path.join(repo, 'src/__tests__/injuryRecompositionTests'));
  else if (witness === 'compiler') require(path.join(repo, 'src/__tests__/canonicalWeeklyCompilerSliceTests'));
  else {
    global.__DEV__ = true;
    const storage = new Map();
    global.window = { localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k), clear: () => storage.clear() } };
    global.fetch = () => { throw Error('NETWORK DISABLED'); };
    let failures = 0;
    const helper = witness === 'speed' ? 'inseasonSpeedTruth' : witness === 'landmine' ? 'powerOnlyLandmineJourney' : witness === 'simple_injury' ? 'simpleInjurySafetyTruth' : witness === 'lowload_remove' ? 'lowLoadRemovalJourney' : witness === 'mobility' ? 'mobilityAddJourney' : witness === 'gplus' ? 'gPlusTwoFlushJourney' : witness === 'flush' ? 'flushPrescriptionTruth'
      : witness === 'flush_restart' ? 'flushRestartJourney' : 'programmingInputTruth';
    require(path.join(repo, 'src/__tests__/support', witness === 'landmine' ? 'powerOnlyLandmineTruth' : helper))[helper](storage, (label, value, detail) => {
      if (!value) failures++;
      console.log(value ? 'PASS' : 'FAIL', label, value ? '' : detail ?? '');
    }).then(() => { console.log(`MUTANT_FAILURES=${failures}`); process.exitCode = failures ? 1 : 0; })
      .catch(error => { console.error(error); process.exitCode = 1; });
  }
} else {
  const output = path.resolve(repo, process.argv.find(a => a.startsWith('--output='))?.slice(9)
    ?? 'outputs/programming-remedy-2026-08-28/mutations');
  fs.mkdirSync(output, { recursive: true });
  const receipts = [];
  for (const [id, [, , , , expected]] of Object.entries(mutants)) {
    const only = process.argv.find(a => a.startsWith('--only='))?.slice(7);
    if (only && id !== only) continue;
    const result = spawnSync(process.execPath, [__filename, `--child=${id}`], { cwd: repo, env: { ...process.env, TZ: 'Australia/Melbourne' }, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
    const log = result.stdout + result.stderr;
    fs.writeFileSync(path.join(output, `${id}.log`), log);
    const caught = result.status === 1 && log.includes(`MUTATION_LANDED=${id}`)
      && log.split('\n').some(line => /FAIL|✗/.test(line) && line.includes(expected));
    receipts.push({ id, landed: log.includes(`MUTATION_LANDED=${id}`), exit: result.status, caught, expected });
    console.log(`${caught ? 'CAUGHT' : 'UNPROVEN'} ${id}`);
  }
  fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(receipts, null, 2));
  process.exitCode = receipts.every(r => r.caught) ? 0 : 1;
}
