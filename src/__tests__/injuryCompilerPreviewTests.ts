/* Real onboarding → preview → injury acceptance → restart. No authored output fixtures. */
(global as { __DEV__?: boolean }).__DEV__ = true;
const storage = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); }, clear: () => storage.clear(),
} };
process.env.TZ = 'Australia/Melbourne';
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp, setJourneyClock } from './support/athleteJourney';
import { ARCHETYPES, athleteAnswers, YEAR_START, plusDays } from './compilerYear/catalog';
import { buildGuidedInjuryConstraint } from '../utils/guidedInjuryControl';
import { compileSessionInjuryPreview, executeProgramControlActionDurably } from '../utils/programControlActions';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { completeAcceptedStateFingerprint } from '../store/coachMutationTransaction';
import { useProgramStore } from '../store/programStore';
import type { Workout } from '../types/domain';
import { buildSessionInjuryReview } from '../utils/sessionInjuryReview';
import { projectProgramPersistedInputs } from '../store/programStore';
import { compileInjuryConditioning } from '../rules/canonicalInjuryConditioning';
import { applyConstraintsToTypedComponents } from '../utils/exposureEngine';
import { compileActiveExposureConstraints } from '../rules/canonicalWeeklyConstraintCompiler';
import { scheduleWeek, scheduleRefused } from '../rules/weeklyScheduler';
import { GLOBAL_RULES, OFFSEASON_OVERLAYS } from '../rules/weeklyProgrammingContract';
import { isTemporarySourceFactConstraint } from '../rules/temporarySourceFact';
import { flushPendingStorageWrites } from '../store/asyncStorageCompat';
import { readinessActionForKind } from '../utils/weekReadinessActions';
import { useReadinessStore } from '../store/readinessStore';
import { constraintInputsForPersistence, readinessInputsForPersistence } from '../store/compatibilityPersistence';
import { undoLastDecision } from '../store/undoLastDecision';
import { activeInjuryFactsOn } from '../rules/injuryWithheldRows';

let passed = 0;
const failures: string[] = [];
function check(label: string, condition: boolean, detail = '') {
  if (condition) passed++;
  else failures.push(`${label}: ${detail}`);
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}${condition ? '' : ` ${detail}`}`);
}
const signature = (workout: Workout | null | undefined) => JSON.stringify({
  rows: workout?.exercises.filter(row => !row.unavailableForInjury).map(row => [
    row.exercise?.name, row.prescribedSets, row.prescribedRepsMin, row.prescribedRepsMax,
    row.prescribedWeightKg, row.restSeconds, row.section18Evidence?.role,
  ]),
  conditioning: workout?.conditioningBlock?.options.map(option => [option.title, option.description]),
  speed: workout?.speedBlock,
});
async function main() {
  // Input coordinate captured from the real year journey after knee 7 -> 9 -> 3.
  // Existing standalone conditioning already supplies the running floor; only
  // an additional shortfall may displace off-leg components from gym days.
  for (const gymAccessDays of [[1, 4], [1, 2, 4], [1, 2, 4, 5]]) {
    for (const weekKind of ['build', 'deload'] as const) {
      for (const appSprintPermitted of [false, true]) {
        const result = scheduleWeek({ weekStartISO: '2026-08-31', phase: 'Off-season',
          offseasonBlock: 'normal_build', gymAccessDays, clubNights: [], gameDay: null, fixtureRecurrence: 'recurring',
          age: 26, athleteGender: 'male', readiness: { lowReadiness: false,
            highReadiness: false, lowFatigue: false, consistentlyCompletesThree: false },
          unavailableDays: [], miniCycleNumber: 2, weekKind,
          appSprintPermitted, appRunningPermitted: true });
        const label = `running budget/${gymAccessDays.length}/${weekKind}/sprint-${appSprintPermitted}`;
        check(`${label} compiles`, !scheduleRefused(result), JSON.stringify(result));
        if (!scheduleRefused(result)) {
          const runningDays = new Set(result.days.filter(day => day.conditioning === 'running' ||
            day.conditioning === 'sprint_high_speed' || day.sprintComponent).map(day => day.dayOfWeek));
          check(`${label} preserves running floor and ceiling`, runningDays.size >= GLOBAL_RULES.running.min &&
            runningDays.size <= GLOBAL_RULES.running.max, JSON.stringify([...runningDays]));
          // R-303 (2026-09-01): normal Off-season app energy-system density is
          // FOUR days, Speed inside it. This pinned the old five-exposure
          // literal; it reads the contract's own overlay now, as the scheduler does.
          check(`${label} keeps phase conditioning target`,
            result.demand.coreConditioning === OFFSEASON_OVERLAYS.normal_build.conditioningTarget.max,
            JSON.stringify(result.demand));
        }
      }
    }
  }
  const limitedProfile = { ...athleteAnswers(ARCHETYPES[0]), seasonFinishedOn: plusDays(YEAR_START, -42) };
  await quietAsync(() => coldStartThroughOnboarding({ profile: limitedProfile, installDayISO: YEAR_START }));
  const restrictions = [
    buildGuidedInjuryConstraint({ region: 'lower_body', area: 'knee', severity: 7,
      severityBand: 'moderate', adjustmentLevel: 'moderate', triggers: ['running'], seriousSymptoms: false }, { todayISO: YEAR_START }),
    buildGuidedInjuryConstraint({ region: 'upper_body', area: 'shoulder', severity: 7,
      severityBand: 'moderate', adjustmentLevel: 'moderate', triggers: [], seriousSymptoms: false }, { todayISO: YEAR_START }),
  ];
  const conditioningDays = quiet(() => deriveVisibleWeekLive(YEAR_START, YEAR_START))
    .filter(day => day.workout?.conditioningBlock?.options.length);
  check('refusal witness reaches generated conditioning without equipment', conditioningDays.length > 0);
  for (const day of conditioningDays) {
    const compiled = compileInjuryConditioning({ workout: day.workout!, profile: limitedProfile,
      dateISO: day.date, constraints: restrictions });
    check(`${day.date} refused conditioning cannot fall back to unsafe original`, !compiled.conditioningBlock?.options.length);
    const ids = new Set(day.workout!.conditioningBlock!.options.flatMap(option => option.exerciseIds));
    const filtered = applyConstraintsToTypedComponents(day.workout!, compileActiveExposureConstraints(restrictions)).workout;
    const strength = filtered.exercises.filter(row => !ids.has(row.id) && row.section18Evidence?.role !== 'conditioning');
    check(`${day.date} conditioning refusal preserves other rows`, strength.every(row => compiled.exercises.includes(row)));
  }
  const cooked = await quietAsync(() => executeProgramControlActionDurably(
    readinessActionForKind('cooked_week', { anchorDateISO: YEAR_START, todayISO: YEAR_START }), { todayISO: YEAR_START }));
  check('readiness persistence witness accepts a real fatigue report', cooked.ok, cooked.message);
  // R-275 (2026-08-30) superseded R-038's rolling window: one cooked report is
  // rest on its own date and derives NO constraint; any two consecutive dated
  // reports deload from the second date through Sunday, and THAT is the
  // derived fatigue constraint this witness persists and restores. Second
  // report, next calendar day.
  const secondTiredDay = plusDays(YEAR_START, 1);
  setJourneyClock(secondTiredDay);
  const flat = await quietAsync(() => executeProgramControlActionDurably(
    readinessActionForKind('flat_today', { anchorDateISO: secondTiredDay, todayISO: secondTiredDay }), { todayISO: secondTiredDay }));
  check('readiness persistence witness accepts the second consecutive tired day (R-275)', flat.ok, flat.message);
  const liveSignals = useReadinessStore.getState().signalsByDate;
  check('readiness persistence witness reaches derived signals',
    Object.values(liveSignals).some(signal => !!signal.temporarySourceFactIds?.length));
  const signal = Object.values(liveSignals).find(signal => !!signal.temporarySourceFactIds?.length)!;
  const legacySignal = { ...signal, temporarySourceFactIds: undefined };
  check('persistence preserves independent legacy readiness input',
    readinessInputsForPersistence({ [signal.date]: legacySignal })[signal.date] === legacySignal);
  const constraint = useProgramStore.getState().acceptedMaterialContext.activeConstraints
    .find(constraint => !!constraint.temporarySourceFactIds?.length)!;
  check('persistence witness reaches a derived fatigue constraint', !!constraint);
  const legacyConstraint = { ...constraint, temporarySourceFactIds: undefined };
  check('persistence preserves independent legacy constraint input',
    constraintInputsForPersistence([constraint, legacyConstraint]).length === 1 &&
    constraintInputsForPersistence([constraint, legacyConstraint])[0] === legacyConstraint);
  await flushPendingStorageWrites();
  check('readiness persistence drops derived copies',
    Object.keys(JSON.parse(storage.get('readiness-store') ?? '{}').state?.signalsByDate ?? {}).length === 0);
  const beforeReadiness = JSON.stringify(liveSignals);
  const readinessRestart = await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
  check('readiness is reconstructed from canonical facts after restart', readinessRestart.ok &&
    JSON.stringify(useReadinessStore.getState().signalsByDate) === beforeReadiness, readinessRestart.error);
  for (const archetype of ARCHETYPES.filter(athlete => ['male-3-experienced-gym', 'female-5-home', 'female-6-sunday-fixture'].includes(athlete.id))) {
    for (const future of [false, true]) {
      await quietAsync(() => coldStartThroughOnboarding({ profile: athleteAnswers(archetype), installDayISO: YEAR_START }));
      const date = plusDays(YEAR_START, future ? 4 : 0);
      setJourneyClock(date);
      const day = () => quiet(() => deriveVisibleWeekLive(YEAR_START, date)).find(day => day.date === date)?.workout;
      const label = `${archetype.id}/${date}`;
      const healthyWeek = quiet(() => deriveVisibleWeekLive(YEAR_START, date));
      let acceptedInjuryEdit: { date: string; componentId: string; name: string; sets: number } | null = null;
      const rolesBefore = new Map(quiet(() => deriveVisibleWeekLive(YEAR_START, date)).flatMap(day =>
        day.workout?.exercises.map(row => [row.id, { name: row.exercise?.name, role: row.section18Evidence?.role }] as const) ?? []));
      check(`${label} reached a real session`, !!day()?.exercises.length);
      // What the 7/10 pass withdrew on this day. The improving-injury cell used
      // to fire on "the day differs from healthy", which the athlete's own
      // accepted set edit (below, after the 7) now also makes true — a day the
      // knee never touched then owed "restored rows" it never lost.
      let withdrawnAtSeven = 0;
      for (const severity of [7, 3]) {
        const constraint = buildGuidedInjuryConstraint({ region: 'lower_body', area: 'knee', severity,
          severityBand: severity === 7 ? 'moderate' : 'mild',
          adjustmentLevel: severity === 7 ? 'moderate' : 'slight',
          triggers: ['running'], seriousSymptoms: false }, { todayISO: date });
        const before = completeAcceptedStateFingerprint();
        const preview = quiet(() => compileSessionInjuryPreview({ date, constraint }));
        const review = quiet(() => buildSessionInjuryReview({ date, constraint }));
        check(`${label}/${severity} preview has no side effects`, before === completeAcceptedStateFingerprint());
        if (severity === 7) withdrawnAtSeven = review.paused.length + review.changes.length + review.withdrawn.length;
        if (severity === 3 && withdrawnAtSeven > 0) check(`${label} improving-injury review discloses restored rows`,
          !review.nothingChanges && review.restored.length > 0 && review.headline.includes('bring back'),
          JSON.stringify({ withdrawnAtSeven, restored: review.restored, headline: review.headline }));
        const accepted = await quietAsync(() => executeProgramControlActionDurably({ type: 'set_injury_modifier',
          source: { screen: 'session_detail', surface: 'session_injury_review', initiatedBy: 'tap' },
          scope: 'current_and_future', payload: { constraint }, requiresRebuild: false,
          createsActiveModifier: true, oneOffOnly: false }, { todayISO: date }));
        check(`${label}/${severity} accepted`, accepted.ok, accepted.message);
        await flushPendingStorageWrites();
        const coachEnvelope = JSON.parse(storage.get('coach-updates') ?? '{}').state;
        const readinessEnvelope = JSON.parse(storage.get('readiness-store') ?? '{}').state;
        check(`${label}/${severity} saves no derived health constraint copies`,
          !(coachEnvelope?.activeConstraints ?? []).some(isTemporarySourceFactConstraint));
        check(`${label}/${severity} saves no derived readiness copies`,
          !Object.values(readinessEnvelope?.signalsByDate ?? {}).some((signal: any) =>
            signal.temporarySourceFactIds?.length || signal.source === 'session_feedback'));
        check(`${label}/${severity} canonical fact history stays durable`,
          (JSON.parse(storage.get('program-store') ?? '{}').state?.inputs?.temporarySourceFacts?.length ?? 0) > 0);
        check(`${label}/${severity} preview equals accepted prescription`, !!preview && signature(preview.workout) === signature(day()),
          JSON.stringify({ preview: signature(preview?.workout), accepted: signature(day()) }));
        if (preview?.workout.exercises.length) {
          const corrupted = { ...preview.workout, exercises: preview.workout.exercises.map((row, index) =>
            index === 0 ? { ...row, prescribedSets: row.prescribedSets + 1 } : row) };
          check(`${label}/${severity} dose-mutation detector is live`, signature(corrupted) !== signature(day()));
        }
        if (severity === 7) {
          const changed = quiet(() => deriveVisibleWeekLive(YEAR_START, date)).flatMap(day => day.workout?.exercises ?? [])
            .filter(row => rolesBefore.has(row.id) && rolesBefore.get(row.id)!.name === row.exercise?.name &&
              rolesBefore.get(row.id)!.role !== row.section18Evidence?.role);
          check(`${label} injury preserves existing row roles`, changed.length === 0,
            JSON.stringify(changed.map(row => [row.exercise?.name, rolesBefore.get(row.id)?.role, row.section18Evidence?.role])));
        }
        const actual = signature(day());
        const restart = await quietAsync(() => relaunchApp({ storage, todayISO: date }));
        check(`${label}/${severity} prescription survives restart`, restart.ok && signature(day()) === actual, restart.error);
        if (severity === 7) {
          const target = quiet(() => deriveVisibleWeekLive(YEAR_START, date)).find(candidate => candidate.date >= date &&
            candidate.workout?.exercises.some(row => !row.unavailableForInjury && row.section18Evidence?.role === 'strength_accessory'));
          const row = target?.workout?.exercises.find(row => !row.unavailableForInjury && row.section18Evidence?.role === 'strength_accessory');
          check(`${label} reaches an accumulated exercise edit`, !!row?.exercise);
          if (row?.exercise && target) {
            const originalSets = row.prescribedSets;
            const originalName = row.exercise.name;
            const originalConditioning = JSON.stringify(target.workout?.conditioningBlock);
            const edit = await quietAsync(() => executeProgramControlActionDurably({ type: 'swap_exercise',
              source: { screen: 'session_detail', surface: 'exercise_edit', initiatedBy: 'tap' },
              scope: 'today_only', payload: { date: target.date, fromExercise: row.exercise!.name, fromExerciseId: row.id,
                toExercise: { name: row.exercise!.name, sets: originalSets + 1,
                  repsMin: row.prescribedRepsMin ?? 8, repsMax: row.prescribedRepsMax ?? 8 } },
              requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true }, { todayISO: date }));
            check(`${label} accepts edit while injury is active`, edit.ok, edit.message);
            if (edit.ok) acceptedInjuryEdit = { date: target.date, componentId: row.id, name: originalName, sets: originalSets + 1 };
            check(`${label} edit retains compiler preview continuation`, !!useProgramStore.getState().sourceFactCompilerInput);
            const editedDay = () => quiet(() => deriveVisibleWeekLive(YEAR_START, date)).find(day => day.date === target.date)?.workout;
            const currentRows = () => editedDay()?.exercises.filter(candidate => candidate.exercise?.name === originalName) ?? [];
            check(`${label} strength-only edit preserves injury-adjusted conditioning`,
              JSON.stringify(editedDay()?.conditioningBlock) === originalConditioning);
            check(`${label} accepted injury-row edit delivers the requested sets`,
              currentRows().length === 1 && currentRows()[0].prescribedSets === originalSets + 1,
              JSON.stringify({ expected: originalSets + 1, rows: currentRows().map(candidate => [candidate.id, candidate.prescribedSets]) }));
            const editedSignature = signature(editedDay());
            const editedBoot = await quietAsync(() => relaunchApp({ storage, todayISO: date }));
            check(`${label} exact edited injury session survives restart`, editedBoot.ok && signature(editedDay()) === editedSignature);
            check(`${label} reopened strength edit preserves injury-adjusted conditioning`,
              JSON.stringify(editedDay()?.conditioningBlock) === originalConditioning);
            if (edit.ok) {
              // Reopening creates the current screen's row objects. A second
              // tap uses that row's current identity, not a pre-restart handle.
              const current = currentRows()[0];
              const second = await quietAsync(() => executeProgramControlActionDurably({ type: 'swap_exercise',
                source: { screen: 'session_detail', surface: 'exercise_edit', initiatedBy: 'tap' },
                scope: 'today_only', payload: { date: target.date, fromExercise: originalName, fromExerciseId: current?.id,
                  toExercise: { name: originalName, sets: originalSets + 2,
                    repsMin: row.prescribedRepsMin ?? 8, repsMax: row.prescribedRepsMax ?? 8 } },
                requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true }, { todayISO: date }));
              check(`${label} a second injury-row edit accumulates`, second.ok &&
                currentRows().length === 1 && currentRows()[0].prescribedSets === originalSets + 2,
                JSON.stringify({ second, rows: currentRows().map(candidate => [candidate.id, candidate.prescribedSets]) }));
              const undo = await quietAsync(() => undoLastDecision());
              check(`${label} Undo restores the first injury-row edit exactly`, undo.outcome === 'undone' && signature(editedDay()) === editedSignature,
                JSON.stringify({ undo, before: editedSignature, after: signature(editedDay()) }));
              const undoneBoot = await quietAsync(() => relaunchApp({ storage, todayISO: date }));
              check(`${label} accumulated injury-row Undo survives restart`, undoneBoot.ok && signature(editedDay()) === editedSignature);
            }
          }
        }
      }
      // A light/accessory day must not acquire main-strength credit merely
      // because its safe replacement is a compound movement.
      const overlays = useProgramStore.getState().weekScopedOverlays[YEAR_START];
      check(`${label} compiler reached dated overlays`, !!overlays);
      const inputs = projectProgramPersistedInputs(useProgramStore.getState());
      check(`${label} compiler continuation is not persisted`, !JSON.stringify(inputs).includes('sourceFactCompilerInput'));
      const episodes = activeInjuryFactsOn(useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts, date);
      check(`${label} accumulated Clear reaches one active episode and an accepted edit`, episodes.length === 1 && !!acceptedInjuryEdit);
      const clear = await quietAsync(() => executeProgramControlActionDurably({ type: 'clear_injury_modifier',
        source: { screen: 'my_status', surface: 'status_card', initiatedBy: 'tap' },
        scope: 'current_and_future', payload: { episodeId: episodes[0]?.episodeId },
        requiresRebuild: false, createsActiveModifier: false, oneOffOnly: false }, { todayISO: date }));
      check(`${label} accumulated injury Clear succeeds`, clear.ok, clear.message);
      if (acceptedInjuryEdit) {
        const edit = acceptedInjuryEdit;
        // A replacement can keep an original slot's identity under a new name.
        // Only a genuinely added injury row has no original component.
        const originallyPresent = healthyWeek.find(day => day.date === edit.date)?.workout?.exercises
          .filter(row => row.id === edit.componentId) ?? [];
        const current = () => quiet(() => deriveVisibleWeekLive(YEAR_START, date)).find(day => day.date === edit.date)?.workout;
        const rows = current()?.exercises.filter(row => row.exercise?.name === edit.name) ?? [];
        check(`${label} Clear preserves retained-row edits without adding retired injury rows`,
          originallyPresent.length === 0 ? rows.length === 0 :
            originallyPresent.length === 1 && rows.length === 1 && rows[0].prescribedSets === edit.sets,
          JSON.stringify({ edit, originallyPresent: originallyPresent.length, rows: rows.map(row => [row.id, row.prescribedSets]) }));
        const cleared = signature(current());
        const clearBoot = await quietAsync(() => relaunchApp({ storage, todayISO: date }));
        check(`${label} injury-era edit and Clear survive reopening`, clearBoot.ok && signature(current()) === cleared);
      }
    }
  }
  // Earlier accepted edits remain the base when an injury comes and goes.
  // Use the real generated day, accepted tap, injury door and Clear door.
  for (const archetype of ARCHETYPES.filter(athlete => ['male-3-experienced-gym', 'female-5-home'].includes(athlete.id))) {
    await quietAsync(() => coldStartThroughOnboarding({ profile: athleteAnswers(archetype), installDayISO: YEAR_START }));
    const days = () => quiet(() => deriveVisibleWeekLive(YEAR_START, YEAR_START));
    const target = days().find(day => day.workout?.exercises.some(row => row.section18Evidence?.role === 'main_strength'));
    const row = target?.workout?.exercises.find(row => row.section18Evidence?.role === 'main_strength');
    const label = `${archetype.id}/edit-before-injury`;
    check(`${label} reaches a real main lift`, !!row?.exercise && !!target);
    if (!target || !row?.exercise) continue;
    const edited = await quietAsync(() => executeProgramControlActionDurably({ type: 'swap_exercise',
      source: { screen: 'session_detail', surface: 'exercise_edit', initiatedBy: 'tap' },
      scope: 'today_only', payload: { date: target.date, fromExercise: row.exercise.name, fromExerciseId: row.id,
        toExercise: { name: row.exercise.name, sets: row.prescribedSets + 1,
          repsMin: row.prescribedRepsMin ?? 8, repsMax: row.prescribedRepsMax ?? 8 } },
      requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true }, { todayISO: YEAR_START }));
    check(`${label} accepts the original edit`, edited.ok, edited.message);
    const beforeInjury = signature(days().find(day => day.date === target.date)?.workout);
    const constraint = buildGuidedInjuryConstraint({ region: 'lower_body', area: 'knee', severity: 7,
      severityBand: 'moderate', adjustmentLevel: 'moderate', triggers: ['running'], seriousSymptoms: false }, { todayISO: YEAR_START });
    const injured = await quietAsync(() => executeProgramControlActionDurably({ type: 'set_injury_modifier',
      source: { screen: 'session_detail', surface: 'session_injury_review', initiatedBy: 'tap' },
      scope: 'current_and_future', payload: { constraint }, requiresRebuild: false,
      createsActiveModifier: true, oneOffOnly: false }, { todayISO: YEAR_START }));
    check(`${label} accepts the later injury`, injured.ok, injured.message);
    const injurySignature = signature(days().find(day => day.date === target.date)?.workout);
    const boot = await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
    check(`${label} injury-adjusted earlier edit reopens exactly`, boot.ok && signature(days().find(day => day.date === target.date)?.workout) === injurySignature);
    const episodes = activeInjuryFactsOn(useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts, YEAR_START);
    check(`${label} Clear addresses exactly one active episode`, episodes.length === 1);
    const cleared = await quietAsync(() => executeProgramControlActionDurably({ type: 'clear_injury_modifier',
      source: { screen: 'my_status', surface: 'status_card', initiatedBy: 'tap' },
      scope: 'current_and_future', payload: { episodeId: episodes[0]?.episodeId },
      requiresRebuild: false, createsActiveModifier: false, oneOffOnly: false }, { todayISO: YEAR_START }));
    check(`${label} Clear restores the earlier edited session exactly`, cleared.ok && signature(days().find(day => day.date === target.date)?.workout) === beforeInjury, cleared.message);
    const clearBoot = await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
    check(`${label} earlier edited session survives Clear and reopening`, clearBoot.ok && signature(days().find(day => day.date === target.date)?.workout) === beforeInjury);
  }
  console.log(`Injury compiler preview: ${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
