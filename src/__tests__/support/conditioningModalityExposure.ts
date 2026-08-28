import { ARCHETYPES, athleteAnswers, YEAR_START } from '../compilerYear/catalog';
import { coldStartThroughOnboarding, quiet, quietAsync } from './athleteJourney';
import { deriveVisibleWeekLive } from '../../utils/deriveVisibleWeek';
import { CONDITIONING_TEMPLATES } from '../../data/conditioningTemplates';
import { applyConstraintsToTypedComponents, buildInjuryConstraint } from '../../utils/exposureEngine';

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
  const constraint = buildInjuryConstraint({ region: 'knee', severity: 7 });
  for (const modality of ['bike', 'row', 'ski'] as const) {
    const failures = CONDITIONING_TEMPLATES.filter(template => {
      const candidate = { ...workout, conditioningBlock: { ...workout.conditioningBlock!,
        options: workout.conditioningBlock!.options.map(option => ({ ...option, modality, title: template.name })) } };
      return !applyConstraintsToTypedComponents(candidate, [constraint]).workout.conditioningBlock?.options.length;
    });
    ok(`${modality}: typed off-leg identity survives every authored title mutation`,
      CONDITIONING_TEMPLATES.length === 55 && failures.length === 0, JSON.stringify(failures.map(t => t.name)));
  }
  const running = { ...workout, conditioningBlock: { ...workout.conditioningBlock,
    options: workout.conditioningBlock.options.map(option => ({ ...option, modality: 'running' as const, title: 'Bike intervals' })) } };
  ok('actual running remains blocked even under an erg-looking title',
    !applyConstraintsToTypedComponents(running, [constraint]).workout.conditioningBlock);
}
