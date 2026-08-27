import type { CalendarDayType } from '../types/calendar';
import type { CanonicalAcceptedFixtureEditEffect } from './canonicalWeeklyFixtureEditState';

/** Pure ordered fold of accepted fixture facts. */
export function compileCanonicalFixtureMarkedDays(args: {
  markedDays: Readonly<Record<string, CalendarDayType>>;
  effects: readonly CanonicalAcceptedFixtureEditEffect[];
}): Record<string, CalendarDayType> {
  const markedDays = { ...args.markedDays };
  for (const effect of args.effects) {
    for (const change of effect.markedDayChanges) {
      if (change.value === null) {
        if (markedDays[change.dateISO] === 'game' ||
          markedDays[change.dateISO] === 'noGame') delete markedDays[change.dateISO];
      }
      else markedDays[change.dateISO] = change.value;
    }
  }
  return markedDays;
}
