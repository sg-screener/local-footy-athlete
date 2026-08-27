/** Legacy diagnostic request adapter; the accepted effect uses the current
 * pure fixture input owner. Production accepts effects, never this flag. */
import { rebuildLocalWeek as rebuildAcceptedWeek, type RebuildLocalWeekArgs } from '../../utils/weekRebuild';
import { canonicalAcceptedFixtureEditEffectFromIntent } from '../../rules/canonicalWeeklyFixtureEditState';
import { storedGameAnchor } from '../../rules/gameAnchor';
import { useProgramStore } from '../../store/programStore';
import { todayISOLocal } from '../../utils/appDate';

export function rebuildLocalWeek(args: RebuildLocalWeekArgs & { manageCalendarFixture?: boolean; commitGameMark?: () => void }) {
  const { manageCalendarFixture, commitGameMark, ...current } = args;
  if (!manageCalendarFixture) return rebuildAcceptedWeek(current);
  if (!args.targetDate) throw new Error('Diagnostic fixture intent requires its date');
  const todayISO = args.todayISO ?? todayISOLocal();
  const action = args.clearOverlayDate ? 'move' : args.newGameDay ? 'add' : 'remove';
  const result = rebuildAcceptedWeek({ ...current, acceptedFixtureEffect:
    canonicalAcceptedFixtureEditEffectFromIntent({
      action,
      fixtureKind: args.baseProfile.seasonPhase === 'Pre-season' ? 'practice_match' : 'game',
      sourceDate: args.clearOverlayDate ?? (action === 'remove' ? args.targetDate : undefined),
      targetDate: args.targetDate,
      acceptedAt: `${todayISO}T12:00:00.000Z`,
      beforeMarkedDays: useProgramStore.getState().acceptedMaterialContext.markedDays,
      recurringGameDay: storedGameAnchor(args.baseProfile),
      source: { requestedBy: 'athlete', producer: 'tap', surface: 'program_tab',
        commandId: `diagnostic-rebuild:${action}:${args.targetDate}` },
    }),
  });
  if (args.commit !== false) commitGameMark?.();
  return result;
}
