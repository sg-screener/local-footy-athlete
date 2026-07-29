import type { Workout } from '../types/domain';
import type { PlanChange } from './planChangeTypes';
import { g1LandingRoute, placeSessionForRoute } from '../rules/g1LandingAsk';
import { liveAthleteContext } from './liveAthleteContext';
import { useProfileStore } from '../store/profileStore';

/**
 * THE ATHLETE'S ANSWER, APPLIED TO WHAT LANDS — one owner, every writer.
 *
 * When the athlete answers the G-1 ask with "accessories only" or "deloaded",
 * the answer changes the CONTENT they are putting on the day. Two independent
 * paths materialise that content — the typed athlete-mutation transaction and
 * the legacy proposal/override writer — and an add onto an occupied G-1 goes
 * through the legacy one twice (once to propose, once to write).
 *
 * If any of those materialisations missed the answer, the athlete would be
 * asked, would pick "deloaded", and the full session would land anyway: the
 * exact class of defect the ask exists to prevent, now with a warning screen in
 * front of it. So the transformation lives here and every materialiser asks
 * this module rather than deciding for itself.
 *
 * THE TEMPLATE, NOT THE STACKED RESULT. The transform applies to the registry
 * template before it is stacked onto whatever is already on the day. Deloading
 * the stacked day would reach into a session the athlete never touched.
 *
 * Store reads are deliberately INSIDE the returned closure: a change with no
 * route never touches a store, so nothing here changes what a store-free caller
 * can do.
 */
export function g1RouteTemplateTransform(
  change: PlanChange | null | undefined,
): ((template: Workout) => Workout) | undefined {
  const route = change && 'g1Route' in change ? change.g1Route : undefined;
  // Route (a) commits nothing, so there is nothing to transform. It reaches a
  // writer only if a caller ignored the sheet, and the resolver refuses it
  // there — this is not the layer that decides that.
  if (!route || !g1LandingRoute(route).commits) return undefined;
  const targetDate = change && 'date' in change
    ? change.date
    : change && change.kind === 'move_session'
      ? change.toDate
      : null;
  if (!targetDate) return undefined;
  return (template) => placeSessionForRoute({
    route,
    landingWorkout: template,
    targetDate,
    athlete: liveAthleteContext(),
    profile: useProfileStore.getState().onboardingData,
  }) ?? template;
}
