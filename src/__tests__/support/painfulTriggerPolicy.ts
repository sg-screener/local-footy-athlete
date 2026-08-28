import { EXERCISE_TAGS } from '../../data/exerciseTags';
import { buildGuidedInjuryConstraint } from '../../utils/guidedInjuryControl';
import { resolveTapSwapEnvironment, injuryRequiresChange, assessTapSwapCandidateSafety } from '../../utils/tapSwapHierarchy';
import { athleteAnswers, ARCHETYPES } from '../compilerYear/catalog';
import { quiet } from './athleteJourney';

export function painfulTriggerPolicy(ok: (label: string, value: boolean, detail?: string) => void): void {
  const profile = athleteAnswers(ARCHETYPES[2]);
  const date = '2026-07-13';
  const environment = (triggers: string[], severity: number) => quiet(() => resolveTapSwapEnvironment({
    profile, date, activeConstraints: [buildGuidedInjuryConstraint({ region: 'upper_body', area: 'Shoulder',
      severity, severityBand: 'slight', adjustmentLevel: 'slight', seriousSymptoms: false, triggers }, { todayISO: date })],
  }));
  // Independent oracle: the authored exercise movement, not the production
  // trigger predicate. Every named press/pull participates, including power.
  for (const [trigger, movements] of [
    ['pressing', ['horizontal_push', 'vertical_push']],
    ['pulling', ['horizontal_pull', 'vertical_pull']],
    ['overhead pressing', ['vertical_push']],
  ] as const) {
    const names = Object.entries(EXERCISE_TAGS).filter(([, tags]) =>
      (movements as readonly string[]).includes(tags.movement)).map(([name]) => name);
    ok(`${trigger}: authored movement family is reached`, names.length > 2);
    for (const severity of [1, 3, 4, 5, 6, 7, 8, 10]) {
      const env = environment([trigger], severity);
      const retained = names.filter(name => !injuryRequiresChange(name, env));
      const offered = names.filter(name => assessTapSwapCandidateSafety(name, env).safe);
      ok(`${trigger}/${severity}: no affected existing row survives`, retained.length === 0, JSON.stringify(retained));
      ok(`${trigger}/${severity}: no replacement repeats the painful movement`, offered.length === 0, JSON.stringify(offered));
    }
  }
  ok('4/10 without a pressing trigger does not ban every press', !injuryRequiresChange('DB Bench Press', environment([], 4)));
  ok('pressing trigger does not itself ban tolerated pulling', !injuryRequiresChange('Barbell Row', environment(['pressing'], 4)));
  ok('overhead-only trigger does not ban horizontal pressing', !injuryRequiresChange('DB Bench Press', environment(['overhead pressing'], 4)));
  ok('exact painful exercise is removed even in the mild band', injuryRequiresChange('Bench Press', environment(['Bench Press'], 1)));
  ok('exact exercise trigger is not a blanket movement ban', !injuryRequiresChange('DB Bench Press', environment(['Bench Press'], 1)));
}
