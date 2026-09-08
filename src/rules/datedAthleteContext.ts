import { guidedInjuryBucketForArea } from '../utils/guidedInjuryControl';
import { onboardingInjurySeverityScore } from './injurySeverityBands';
import { injuryWithholdsExistingRow } from './injuryExerciseRisk';
import type { AthleteContext } from '../utils/sessionBuilder';
import { buildGenerationConstraintContext, applyGenerationConstraintsToProfile } from '../utils/generationConstraints';
import { equipmentTagsOnDate } from './canonicalWeeklyAvailabilityState';
import { resolveTapSwapEnvironment, injuryRequiresChange } from '../utils/tapSwapHierarchy';

/** Same dated injury facts as the program, including the end of a restriction. */
export function datedAthleteContext(athlete: AthleteContext,dateISO:string): AthleteContext {
  const profile=athlete.onboardingData;
  if(!profile)return athlete;
  const dated=applyGenerationConstraintsToProfile(profile,buildGenerationConstraintContext({
    activeConstraints:athlete.activeConstraints,todayISO:dateISO}));
  return {...athlete,injuries:dated.injuries??[],
    equipmentTags:equipmentTagsOnDate(profile,dateISO,athlete.equipmentTags)};
}

export function injuryAllowsContextExercise(name:string,athlete:AthleteContext|undefined,dateISO:string):boolean {
  if(!athlete?.onboardingData)return true;
  const dated=datedAthleteContext(athlete,dateISO);
  return !injuryRequiresChange(name,resolveTapSwapEnvironment({date:dateISO,
    profile:athlete.onboardingData,activeConstraints:athlete.activeConstraints??[]}))
    && dated.injuries.every(injury=>{
      const region=guidedInjuryBucketForArea(injury.bodyArea);
      return !region || !injuryWithholdsExistingRow(name,region,onboardingInjurySeverityScore(injury),injury.movementTriggers);
    });
}
