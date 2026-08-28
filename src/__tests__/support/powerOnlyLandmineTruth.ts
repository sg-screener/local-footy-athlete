import { classifyPoolSlot, STRENGTH_POOLS } from '../../data/exercisePoolsStrength';
import { eligiblePowerExercises, selectPowerExercise } from '../../rules/powerExercisePool';
import { classifyGeneratedWorkoutRow } from '../../rules/generatedWorkoutRowClassification';
import { buildPowerRow } from '../../data/defaultProgram';
import { decidePowerPrimer } from '../../rules/powerPrimerPolicy';
import { getExerciseTags } from '../../data/exerciseTags';
import { ARCHETYPES, athleteAnswers } from '../compilerYear/catalog';
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp, rolloverIfDue, setJourneyClock } from './athleteJourney';
import { deriveVisibleWeekLive } from '../../utils/deriveVisibleWeek';
import { visibleSignature, signatureDifferences } from '../compilerYear/invariants';

export async function powerOnlyLandmineJourney(storage: Map<string, string>, ok: (label: string, value: boolean, detail?: string) => void) {
  powerOnlyLandmineTruth(ok);
  const today = '2026-08-24';
  for (const gender of ['male', 'female'] as const) {
    const installed = await quietAsync(() => coldStartThroughOnboarding({
      profile: athleteAnswers({ ...ARCHETYPES[6], gender, extraGame: false }), installDayISO: today }));
    if (installed.onboardingRefusal) throw Error(JSON.stringify(installed.onboardingRefusal));
    let delivered = 0;
    for (const date of [today, '2026-09-21', '2026-10-19']) {
    setJourneyClock(date);
    const rollover = quiet(() => rolloverIfDue(date));
    ok(`P19/${gender}/${date}: real block rollover is accepted`, !rollover.refusal, JSON.stringify(rollover));
    const view = () => quiet(() => deriveVisibleWeekLive(date, date));
    const rows = view().flatMap(day => day.workout?.exercises ?? []).filter(row => row.exercise.name === 'Explosive Landmine Press');
    delivered += rows.length;
    ok(`P19/${gender}/${date}: every delivered explosive landmine is power without strength credit`,
      rows.every(row => row.role === 'power' && row.power?.family === 'upper'
        && row.section18Evidence?.role === 'power' && row.section18Evidence.mainStrengthPattern === null),
      JSON.stringify({ rows, powers: view().flatMap(day => day.workout?.exercises ?? []).filter(row => row.role === 'power') }));
    const before = visibleSignature(view());
    const boot = await quietAsync(() => relaunchApp({ storage, todayISO: date }));
    ok(`P19/${gender}/${date}: exact delivered power identity and dose survive restart`, boot.ok
      && before === visibleSignature(view()), JSON.stringify(signatureDifferences(before, visibleSignature(view()))));
    }
    ok(`P19/${gender}: real compiler reaches landmine power during three accepted blocks`, delivered > 0);
  }
}

export function powerOnlyLandmineTruth(ok: (label: string, value: boolean, detail?: string) => void) {
  const name = 'Explosive Landmine Press';
  ok('P19: explosive landmine is absent from every strength slot', classifyPoolSlot(name) === null
    && Object.values(STRENGTH_POOLS).every(pool => [pool.anchor, pool.accessory]
      .every(definition => !definition.entries.some(entry => entry.name === name))));
  const classification = classifyGeneratedWorkoutRow({ name, sets: 4, repsMax: 6, index: 0 });
  ok('P19: a saved explosive landmine identity cannot earn main-strength credit',
    classification.kind === 'power' && classification.mainPattern === null && getExerciseTags(name)?.power === true);
  for (const phase of ['Off-season', 'Pre-season', 'In-season'] as const) {
    const context = { family: 'upper', phase, trainingAge: 'advanced', reduced: false,
      availableEquipment: ['barbell'], blockId: 'p19' } as const;
    ok(`P19/${phase}: real power pool includes the explosive landmine`,
      eligiblePowerExercises(context).some(row => row.name === name));
    ok(`P19/${phase}: missing kit and existing experience gate still exclude it`,
      !eligiblePowerExercises({ ...context, availableEquipment: [] }).some(row => row.name === name)
      && !eligiblePowerExercises({ ...context, trainingAge: 'new' }).some(row => row.name === name));
    const blockId = Array.from({ length: 128 }, (_, i) => `p19-${i}`)
      .find(blockId => selectPowerExercise({ ...context, blockId })?.name === name);
    ok(`P19/${phase}: actual selector reaches a landmine power slot`, !!blockId);
    if (!blockId) continue;
    const spec = decidePowerPrimer({ phase, offseasonSubphase: 'late_offseason', strengthPattern: 'push',
      hasGame: phase === 'In-season', gOffset: -4, isTeamDay: false, capacity: 'high',
      isBeginner: false, experienced: true, injuries: [], powerGoalNudge: true });
    if (!spec) throw Error(`Power-policy control did not reach ${phase}`);
    const row = buildPowerRow(spec, 'p19', { phase, experienceLevel: '5+ years', availableEquipment: ['barbell'], blockId });
    ok(`P19/${phase}: delivered power row uses the unchanged policy dose and no strength credit`,
      row.exercise?.name === name && row.role === 'power' && row.power?.family === 'upper'
      && row.prescribedSets === spec.sets && row.prescribedRepsMin === spec.repsMin
      && row.prescribedRepsMax === spec.repsMax && row.section18Evidence?.role === 'power'
      && row.section18Evidence.mainStrengthPattern === null);
  }
}
