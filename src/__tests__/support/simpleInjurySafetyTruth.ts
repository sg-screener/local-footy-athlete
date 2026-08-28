import { EXERCISE_TAGS } from '../../data/exerciseTags';
import { injuryPermitsExerciseAtSeverity, injuryWithholdsExistingRow } from '../../rules/injuryExerciseRisk';
import { isRedFlagInjurySeverity } from '../../rules/injuryWithheldRows';
import { buildGuidedInjuryConstraint } from '../../utils/guidedInjuryControl';
import { athleteAnswers, ARCHETYPES } from '../compilerYear/catalog';
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } from './athleteJourney';
import { executeProgramControlActionDurably } from '../../utils/programControlActions';
import { useProgramStore } from '../../store/programStore';
import { deriveVisibleWeekLive } from '../../utils/deriveVisibleWeek';
import { visibleSignature, signatureDifferences } from '../compilerYear/invariants';
import { undoLastDecision } from '../../store/undoLastDecision';
import { applyPlanChange } from '../../utils/planChangeProducer';
import { selectActiveProgramModifiers } from '../../utils/activeProgramModifiers';
import { formatExerciseDisplayName } from '../../utils/exerciseDisplay';
import { rankedQuickSwapChoices } from '../../utils/quickExerciseActions';
import { resolveTapSwapEnvironment } from '../../utils/tapSwapHierarchy';
import { buildSwapSuggestionPayload } from '../../utils/swapSuggestionPayload';
import { chooseInjurySessionAdditions } from '../../utils/injurySessionAdjustment';
import { assessProgramEditRisk } from '../../utils/programEditRiskAssessment';
import { EXERCISE_LOAD_MAP } from '../../utils/loadEstimation';

export async function simpleInjurySafetyTruth(storage: Map<string, string>, ok: (label: string, value: boolean, detail?: string) => void) {
  for (let severity = 1; severity <= 10; severity++) {
    ok(`simple-injury/${severity}: serious symptoms do not require a high severity score`,
      isRedFlagInjurySeverity(true, severity) && !isRedFlagInjurySeverity(false, severity));
    const serious = buildGuidedInjuryConstraint({ region: 'upper_body', area: 'Shoulder', severity,
      severityBand: 'mild', adjustmentLevel: 'minimal', triggers: [], seriousSymptoms: true },
    { todayISO: '2026-08-24' });
    ok(`simple-injury/${severity}: serious-symptom stop preserves the reported numeric score`,
      serious.severity === severity && serious.seriousSymptoms === true && serious.adjustmentLevel === 'training_paused');
    ok(`simple-injury/${severity}: paused modifier names serious symptoms instead of inventing a high score`,
      /serious symptoms/i.test(serious.modifierBody ?? '') && !/8-10|8–10/.test(serious.modifierBody ?? ''));
    const restored = selectActiveProgramModifiers({ todayISO: '2026-08-24', activeConstraints: [{
      ...serious, modifierBody: 'You rated this as 8-10 / 10, so affected training is paused.',
    }] }).find(modifier => modifier.type === 'injury');
    ok(`simple-injury/${severity}: reopened modifier uses actual safety facts instead of stale saved copy`,
      restored?.severity === severity && /serious symptoms/i.test(restored.body) && !/8-10|8–10/.test(restored.body));
    for (const [name, tags] of Object.entries(EXERCISE_TAGS)) {
      if (!['horizontal_push', 'vertical_push'].includes(tags.movement)) continue;
      ok(`simple-injury/${severity}/${name}: explicit pressing pain overrides every generic rating`,
        !injuryPermitsExerciseAtSeverity(name, 'shoulder', severity, ['Pressing'])
        && injuryWithholdsExistingRow(name, 'shoulder', severity, ['Pressing']));
    }
  }
  // Independent examples include loads held by the arms on a LOWER-body lift;
  // a main-muscle-only filter cannot satisfy this set. No new rehab prescription.
  for (const name of ['Goblet Squat', 'Deadlift', 'Trap Bar Deadlift', 'RDLs', 'Single-Leg RDL',
    'Kettlebell Swings', 'Speed Trap Bar Deadlift', 'Bulgarian Split Squats', 'Walking Lunges', 'Reverse Lunges', 'Step Ups']) {
    for (const region of ['shoulder', 'elbow', 'wrist/hand'] as const) for (const severity of [6, 7, 8, 9, 10]) {
      ok(`simple-injury/${name}/${region}/${severity}: loaded support is not blanket Good clearance`,
        !injuryPermitsExerciseAtSeverity(name, region, severity)
        && injuryWithholdsExistingRow(name, region, severity));
    }
  }
  for (const region of ['shoulder', 'elbow', 'wrist/hand'] as const) {
    ok(`simple-injury/${region}: clearly unaffected bodyweight squat remains available`,
      injuryPermitsExerciseAtSeverity('Bodyweight Squat', region, 9));
  }
  // Cross-check actual load prescriptions, not only the main-muscle labels.
  // Native Single-Leg Box Squat was rated Good while prescribing a dumbbell;
  // a list of remembered squat/deadlift names missed that same defect class.
  for (const [name, load] of Object.entries(EXERCISE_LOAD_MAP)) {
    if (EXERCISE_TAGS[name]?.region !== 'lower' || load.ratio <= 0
      || !['barbell', 'dumbbell', 'kettlebell'].includes(load.equipment)) continue;
    for (const region of ['shoulder', 'elbow', 'wrist/hand'] as const) for (const severity of [6, 7, 8, 9, 10]) {
      ok(`simple-injury/loaded/${name}/${region}/${severity}: prescribed free weights require upper-limb support clearance`,
        !injuryPermitsExerciseAtSeverity(name, region, severity)
        && injuryWithholdsExistingRow(name, region, severity));
    }
  }
  for (const [name, regions] of [
    ['Hip Thrusts', ['shoulder']], ['Single-Leg Hip Thrust', ['shoulder']],
    ['Copenhagen Plank (Half)', ['shoulder', 'elbow']], ['Long-Lever Copenhagen', ['shoulder', 'elbow']],
    ['Back Squat', ['elbow', 'wrist/hand']], ['Front Squat', ['elbow', 'wrist/hand']],
    ['Box Squat', ['elbow', 'wrist/hand']], ['High Box Squat', ['elbow', 'wrist/hand']],
  ] as const) for (const region of regions) for (const severity of [6, 7, 8, 9, 10]) {
    ok(`simple-injury/${name}/${region}/${severity}: support and bar position also count as affected work`,
      !injuryPermitsExerciseAtSeverity(name, region, severity));
  }
  for (const [name, pain] of [['Calf Stretch', 'Calf Stretch'], ['Back Squat', 'Squatting / lunging'],
    ['RDLs', 'Hinging / bending'], ['Box Jumps', 'Jumping / landing']] as const) {
    ok(`simple-injury/${name}: exact untagged pain and historical movement labels remain effective`,
      !injuryPermitsExerciseAtSeverity(name, 'shoulder', 1, [pain]));
  }
  // Native conformance shape: four-day in-season athlete, two club nights,
  // Saturday game. Reach it through onboarding, not a copied simulator store.
  // A severe shoulder report used to add a second Bodyweight Squat on Monday,
  // then all later manual swaps failed the unchanged weekly balance rule.
  for (const gender of ['male', 'female'] as const) for (const severity of [7, 9]) {
    const now = '2026-08-28', week = '2026-08-31', target = '2026-09-01';
    const profile = athleteAnswers({ ...ARCHETYPES[3], gender, experience: '5+ years', gameDay: 'Saturday' });
    profile.heightCm = 182;
    profile.weightKg = 84;
    profile.equipmentAnswer = { ...profile.equipmentAnswer!, tags: { ...profile.equipmentAnswer!.tags,
      rack: 'have', trap_bar: 'have', dip_bars: 'have', rings_trx: 'have', ab_wheel: 'have',
      swiss_ball: 'have', sandbag: 'have', back_extension_bench: 'have' } };
    const installed = await quietAsync(() => coldStartThroughOnboarding({ profile, installDayISO: now }));
    if (installed.onboardingRefusal) throw Error(JSON.stringify(installed.onboardingRefusal));
    const view = () => quiet(() => deriveVisibleWeekLive(week, now));
    const healthyWeek = visibleSignature(view());
    const constraint = buildGuidedInjuryConstraint({ region: 'upper_body', area: 'Shoulder', severity,
      severityBand: severity >= 8 ? 'avoid' : 'moderate',
      adjustmentLevel: severity >= 8 ? 'training_paused' : 'moderate', triggers: [], seriousSymptoms: false }, { todayISO: now });
    const injury = await quietAsync(() => executeProgramControlActionDurably({ type: 'set_injury_modifier',
      source: { screen: 'program_tab', surface: 'guided_injury_flow', initiatedBy: 'tap' },
      scope: 'current_and_future', payload: { constraint }, requiresRebuild: false,
      createsActiveModifier: true, oneOffOnly: false }, { todayISO: now }));
    const label = `simple-injury/manual/${gender}/${severity}`;
    ok(`${label}: real injury report accepted`, injury.ok);
    const riskWeek = { days: view().map(day => ({ date: day.date, workouts: day.workout ? [day.workout] : [] })) };
    for (const score of [2, 9]) {
      const assessment = quiet(() => assessProgramEditRisk({ current: riskWeek, proposed: riskWeek,
        activeConstraints: [{ ...constraint, severity: score, seriousSymptoms: true }], todayISO: now }));
      ok(`${label}/${score}: serious symptoms retain the medical stop for manual edits`,
        assessment.findings.some(finding => finding.ruleId === 'active_injury_hard_stop'));
    }
    const rowNames = () => view().map(day => (day.workout?.exercises ?? []).map(row => row.exercise?.name));
    ok(`${label}: substitutions and additions never duplicate an exercise on one day`,
      rowNames().every(names => new Set(names).size === names.length), JSON.stringify(rowNames()));
    for (const afterBoot of [false, true]) {
      if (afterBoot) {
        const before = visibleSignature(view());
        const boot = await quietAsync(() => relaunchApp({ storage, todayISO: now }));
        ok(`${label}: injury rows and doses survive restart`, boot.ok && visibleSignature(view()) === before);
      }
      const workout = view().find(day => day.date === target)?.workout;
      const row = workout?.exercises.find(row => row.section18Evidence?.role === 'main_strength');
      if (!workout || !row) throw Error(`${label}: no actual unaffected main-strength target`);
      const environment = quiet(() => resolveTapSwapEnvironment({ date: target, profile,
        activeConstraints: useProgramStore.getState().acceptedMaterialContext.activeConstraints, readinessSignal: null }));
      if (!afterBoot) {
        const balanced = quiet(() => chooseInjurySessionAdditions({ environment, profile,
          keptRowNames: [], pausedRowNames: ['Bench Press'], weekExerciseNames: ['Bodyweight Squat'],
          otherMainStrengthPatterns: ['squat', 'squat', 'squat'],
          excludedByAthlete: [], pausedCount: 1, originalRowCount: 1,
          injuredHalf: 'upper', keptSets: 0, dateISO: target }));
        ok(`${label}: eligible lower replacement favours the uncovered hinge`,
          balanced[0]?.mainStrengthPattern === 'hinge', JSON.stringify(balanced));
      }
      const choice = quiet(() => rankedQuickSwapChoices({ originalExercise: row.exercise.name, reason: 'preference',
        environment, existingExerciseNames: workout.exercises.map(row => row.exercise.name), profile }))[0];
      if (!choice?.name) throw Error(`${label}: native swap menu has no unaffected choice`);
      const before = visibleSignature(view());
      const swapped = await quietAsync(() => executeProgramControlActionDurably({ type: 'swap_exercise',
        source: { screen: 'session_detail', surface: 'quick_exercise_action', initiatedBy: 'tap' },
        scope: 'today_only', payload: { date: target, fromExercise: row.exercise.name, fromExerciseId: row.id,
          toExercise: buildSwapSuggestionPayload(choice.name!, row, choice.prescription ?? {}) },
        requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true }, { todayISO: target }));
      ok(`${label}/${afterBoot ? 'reopened' : 'live'}: offered unaffected swap is accepted without relaxing weekly balance`,
        swapped.ok, JSON.stringify(swapped));
      if (swapped.ok) {
        const undo = await quietAsync(() => undoLastDecision());
        ok(`${label}/${afterBoot ? 'reopened' : 'live'}: Undo restores exact injured week`,
          undo.outcome === 'undone' && visibleSignature(view()) === before);
      }
      const unsafe = await quietAsync(() => executeProgramControlActionDurably({ type: 'swap_exercise',
        source: { screen: 'session_detail', surface: 'quick_exercise_action', initiatedBy: 'tap' },
        scope: 'today_only', payload: { date: target, fromExercise: row.exercise.name, fromExerciseId: row.id,
          toExercise: { name: 'Bench Press', sets: 2, repsMin: 10, repsMax: 10 } },
        requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true }, { todayISO: target }));
      ok(`${label}/${afterBoot ? 'reopened' : 'live'}: unsafe manual press stays refused with no state change`,
        !unsafe.ok && visibleSignature(view()) === before);
    }
    const episodeId = useProgramStore.getState().acceptedMaterialContext.injuryEpisodes
      .find(episode => episode.bucket === 'shoulder' && episode.status === 'active')?.episodeId;
    if (!episodeId) throw Error(`${label}: no actual injury to Clear`);
    const clear = await quietAsync(() => executeProgramControlActionDurably({ type: 'clear_injury_modifier',
      source: { screen: 'program_tab', surface: 'guided_injury_flow', initiatedBy: 'tap' },
      scope: 'current_and_future', payload: { episodeId }, requiresRebuild: false,
      createsActiveModifier: false, oneOffOnly: false }, { todayISO: now }));
    ok(`${label}: Clear restores the exact healthy week`, clear.ok && visibleSignature(view()) === healthyWeek);
    const clearedBoot = await quietAsync(() => relaunchApp({ storage, todayISO: now }));
    ok(`${label}: cleared healthy work survives restart`, clearedBoot.ok && visibleSignature(view()) === healthyWeek);
  }
  const today = '2026-08-24';
  for (const gender of ['male', 'female'] as const) {
    const installed = await quietAsync(() => coldStartThroughOnboarding({
      profile: athleteAnswers({ ...ARCHETYPES[6], gender }), installDayISO: today,
    }));
    if (installed.onboardingRefusal) throw Error(JSON.stringify(installed.onboardingRefusal));
    const view = () => quiet(() => deriveVisibleWeekLive(today, today));
    const report = async (severity: number, triggers: string[]) => {
      const constraint = buildGuidedInjuryConstraint({ region: 'upper_body', area: 'Shoulder', severity,
        severityBand: 'slight', adjustmentLevel: 'slight', triggers, seriousSymptoms: false }, { todayISO: today });
      return quietAsync(() => executeProgramControlActionDurably({ type: 'set_injury_modifier',
        source: { screen: 'program_tab', surface: 'guided_injury_flow', initiatedBy: 'tap' },
        scope: 'current_and_future', payload: { constraint }, requiresRebuild: false,
        createsActiveModifier: true, oneOffOnly: false }, { todayISO: today }));
    };
    const episodes = () => useProgramStore.getState().acceptedMaterialContext.injuryEpisodes;
    const active = () => episodes().find(e => e.bucket === 'shoulder' && ['active', 'improving'].includes(e.status));
    const first = await report(5, ['Pressing']);
    ok(`simple-injury/${gender}: optional pain reaches the real accepted injury door`, first.ok && active()?.triggers.includes('Pressing') === true);
    for (const severity of [2, 7, 9]) {
      const update = await report(severity, []);
      ok(`simple-injury/${gender}/${severity}: simple severity update preserves reported painful movements`,
        update.ok && active()?.triggers.includes('Pressing') === true, JSON.stringify(active()));
      if (severity >= 7) {
        const adjustments = view().map(day => day.workout?.injuryAdjustment).filter(adjustment => adjustment?.added.length);
        ok(`simple-injury/${gender}/${severity}: actual replacement work is reached for the summary check`, adjustments.length > 0);
        ok(`simple-injury/${gender}/${severity}: summary names the actual unaffected replacement work`,
          adjustments.length > 0 && adjustments.every(adjustment => adjustment?.added.every(name =>
            adjustment.summary.includes(formatExerciseDisplayName(name)))), JSON.stringify(adjustments));
      }
    }
    const beforeBoot = visibleSignature(view()), id = active()?.episodeId;
    const boot = await quietAsync(() => relaunchApp({ storage, todayISO: today }));
    ok(`simple-injury/${gender}: accumulated injury and final rows survive restart`, boot.ok
      && active()?.triggers.includes('Pressing') === true && visibleSignature(view()) === beforeBoot);
    const target = view().find(day => !day.workout?.exercises.length)?.date;
    if (!target) throw Error('No actual rest day for injury/Add/Undo coordinate');
    const added = quiet(() => applyPlanChange({ change: { kind: 'add_category', date: target, category: 'mobility' },
      visibleWeek: view(), todayISO: today, applyOverride: () => undefined }));
    ok(`simple-injury/${gender}: Add reaches a real occupied session while the injury stays active`,
      added.ok && !!view().find(day => day.date === target)?.workout?.exercises.length);
    const undo = await quietAsync(() => undoLastDecision());
    ok(`simple-injury/${gender}: Undo Add restores the exact restricted week without undoing the injury fact`,
      undo.outcome === 'undone' && active()?.triggers.includes('Pressing') === true
      && visibleSignature(view()) === beforeBoot,
      JSON.stringify({ undo, differences: signatureDifferences(beforeBoot, visibleSignature(view())) }));
    if (!id) throw Error('No actual episode reached');
    const cleared = await quietAsync(() => executeProgramControlActionDurably({ type: 'clear_injury_modifier',
      source: { screen: 'program_tab', surface: 'guided_injury_flow', initiatedBy: 'tap' },
      scope: 'current_and_future', payload: { episodeId: id }, requiresRebuild: false,
      createsActiveModifier: false, oneOffOnly: false }, { todayISO: today }));
    ok(`simple-injury/${gender}: Clear retains the historical painful report`, cleared.ok
      && episodes().some(e => e.episodeId === id && e.status === 'resolved' && e.triggers.includes('Pressing')),
      JSON.stringify(cleared));
    const clearedSignature = visibleSignature(view());
    const clearBoot = await quietAsync(() => relaunchApp({ storage, todayISO: today }));
    ok(`simple-injury/${gender}: Clear stays cleared after restart, without erasing history`, clearBoot.ok
      && !active() && visibleSignature(view()) === clearedSignature
      && episodes().some(e => e.episodeId === id && e.triggers.includes('Pressing')));
  }
}
