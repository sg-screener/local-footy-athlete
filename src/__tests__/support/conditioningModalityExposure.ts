import { ARCHETYPES, athleteAnswers, YEAR_START } from '../compilerYear/catalog';
import { coldStartThroughOnboarding, quiet, quietAsync } from './athleteJourney';
import { deriveVisibleWeekLive } from '../../utils/deriveVisibleWeek';
import { CONDITIONING_TEMPLATES } from '../../data/conditioningTemplates';
import { applyConstraintsToTypedComponents, buildInjuryConstraint } from '../../utils/exposureEngine';
import { buildSessionTemplate } from '../../utils/sessionTemplate';
import { applyConditioningModalityToWorkout } from '../../utils/coachModalitySwap';
import { composeConditioningRows } from '../../rules/conditioningSelection';
import { withSection18WorkoutEvidence } from '../../rules/section18WorkoutEvidence';

/** Metamorphic unit checks on a real generated component, never a stored-state
 * fixture. A title mutation cannot turn an explicitly selected erg into running;
 * the negative mode mutation must still remove actual running. */
export async function conditioningModalityExposure(ok: (label: string, value: boolean, detail?: string) => void) {
  const profile = athleteAnswers({ ...ARCHETYPES[6], extraGame: false });
  const installed = await quietAsync(() => coldStartThroughOnboarding({ profile, installDayISO: YEAR_START }));
  if (installed.onboardingRefusal) throw Error(JSON.stringify(installed.onboardingRefusal));
  const workout = quiet(() => deriveVisibleWeekLive(YEAR_START, YEAR_START))
    .find(day => day.workout?.conditioningBlock?.intent === 'high-intensity')?.workout;
  if (!workout?.conditioningBlock?.options.length) throw Error('Real hard-conditioning component not reached');
  /* THE CENSUS COVERS EVERY AUTHORED TEMPLATE, HOWEVER MANY THE SHEET HOLDS.
   * The literal `55` written here on 2026-08-20 (R-117's census) went stale on
   * 2026-09-02 when the three COD sessions became sections of the one combined
   * Change of Direction session (R-331; registry now 52). A count is not the property;
   * the property is one distinct identity per authored template and every one
   * of them walked — so that is what is asserted (hingecod, 2026-09-03). */
  const authoredIdentities = new Set(CONDITIONING_TEMPLATES.map(template => template.name));
  const everyTemplateDistinct = CONDITIONING_TEMPLATES.length > 0
    && authoredIdentities.size === CONDITIONING_TEMPLATES.length;
  const misclassified = CONDITIONING_TEMPLATES.flatMap(template => {
    const rows = composeConditioningRows(template, YEAR_START);
    const evidenced = withSection18WorkoutEvidence({ ...workout, exercises: rows });
    return evidenced.exercises.filter(row => row.role !== 'conditioning' ||
      row.section18Evidence?.role !== 'conditioning' || row.section18Evidence.mainStrengthPattern !== null)
      .map(row => `${template.name}/${row.exercise.name}`);
  });
  ok('authored conditioning rows retain conditioning evidence including every warm-up',
    everyTemplateDistinct && misclassified.length === 0, JSON.stringify(misclassified));
  const constraint = buildInjuryConstraint({ region: 'knee', severity: 7 });
  for (const modality of ['bike', 'row', 'ski'] as const) {
    const failures = CONDITIONING_TEMPLATES.filter(template => {
      const candidate = { ...workout, conditioningBlock: { ...workout.conditioningBlock!,
        options: workout.conditioningBlock!.options.map(option => ({ ...option, modality, title: template.name })) } };
      return !applyConstraintsToTypedComponents(candidate, [constraint]).workout.conditioningBlock?.options.length;
    });
    ok(`${modality}: typed off-leg identity survives every authored title mutation`,
      everyTemplateDistinct && failures.length === 0, JSON.stringify(failures.map(t => t.name)));
    const renamed = CONDITIONING_TEMPLATES.filter(template => {
      const candidate = { ...workout, name: template.name, exercises: workout.exercises.map(row => ({ ...row,
        exercise: { ...row.exercise, name: template.name }, section18Evidence: { ...row.section18Evidence, role: 'conditioning' as const } })),
        conditioningBlock: { ...workout.conditioningBlock!, options: workout.conditioningBlock!.options.map(option =>
          ({ ...option, title: template.name, modality: 'running' as const })) } };
      const swapped = applyConditioningModalityToWorkout(candidate, { fromModality: null, toModality: modality });
      return swapped.name !== template.name || swapped.exercises.some(row => row.exercise.name !== template.name) ||
        swapped.conditioningBlock.options.some(option => option.title !== template.name || String(option.modality) !== modality);
    });
    ok(`${modality}: modality changes preserve every authored template identity and set the typed mode`,
      everyTemplateDistinct && renamed.length === 0, JSON.stringify(renamed.map(t => t.name)));
  }
  const running = { ...workout, conditioningBlock: { ...workout.conditioningBlock,
    options: workout.conditioningBlock.options.map(option => ({ ...option, modality: 'running' as const, title: 'Bike intervals' })) } };
  ok('actual running remains blocked even under an erg-looking title',
    !applyConstraintsToTypedComponents(running, [constraint]).workout.conditioningBlock);
  ok('an explicit Row-only change does not retag an existing Running option',
    applyConditioningModalityToWorkout({ ...running, name: 'Classic 4x4', conditioningBlock: {
      ...running.conditioningBlock, options: running.conditioningBlock.options.map(option => ({ ...option, title: 'Classic 4x4' })) } },
    { fromModality: 'row', toModality: 'bike' }).conditioningBlock.options.every(option => option.modality === 'running'));
  // Presentation metamorphism over actual generated rows: an injury can put
  // safe lifting into a former energy-only container. The container title/type
  // cannot turn those typed lifts into intervals or erase their lifting dose.
  const strength = quiet(() => deriveVisibleWeekLive(YEAR_START, YEAR_START)).flatMap(day =>
    day.workout?.exercises.filter(row => row.section18Evidence?.role === 'main_strength') ?? []);
  const energyIds = new Set(workout.conditioningBlock.options.flatMap(option => option.exerciseIds));
  const energy = workout.exercises.filter(row => energyIds.has(row.id));
  const bad = strength.filter(row => {
    const mixed = { ...workout, workoutType: 'Conditioning' as const, exercises: [...energy, row] };
    return !buildSessionTemplate(mixed).items.some(item => item.kind === 'exercise' &&
      item.row.id === row.id && item.presentation === 'strength' && item.row.prescribedSets === row.prescribedSets);
  });
  ok('typed lifting retains its strength presentation in an energy container',
    strength.length > 0 && energy.length > 0 && bad.length === 0, JSON.stringify(bad.map(row => row.exercise.name)));
}
