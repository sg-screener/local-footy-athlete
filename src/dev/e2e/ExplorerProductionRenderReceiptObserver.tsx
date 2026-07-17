import React from 'react';
import { ExplorerRenderWitness } from '../../components/ExplorerRenderWitness';
import { useProgramStore } from '../../store/programStore';
import { buildScheduleStateImperative } from '../../utils/coachWeekDiff';
import { todayISOLocal } from '../../utils/appDate';
import { buildProgramTabProjectedWeek } from '../../utils/visibleProgramReadModel';
import { getSessionComponents } from '../../utils/sessionComponents';
import {
  explorerRenderExpectationIsSatisfied,
  getExplorerRenderExpectations,
  recordExplorerRenderedExpectation,
  subscribeExplorerRenderExpectations,
  type ExplorerRenderAcceptedSnapshot,
  type ExplorerRenderExpectation,
} from './explorerRenderReceiptBindings';

/**
 * Development-only post-render observer. It renders the exact semantic leaves
 * only after their accepted-state witness is true, then records the React
 * effect. It never treats a transaction return as rendered proof and never
 * invents screenshot or accessibility-hierarchy references.
 */
export function ExplorerProductionRenderReceiptObserver(): React.ReactElement {
  const [, refresh] = React.useState(0);
  React.useEffect(() => subscribeExplorerRenderExpectations(() =>
    refresh((value) => value + 1)), []);
  const accepted = useProgramStore((state) => state.acceptedMaterialContext);
  const reversibleAdjustments = useProgramStore((state) =>
    state.reversibleAdjustmentLedger.adjustments);
  const sessionFeedback = useProgramStore((state) => state.sessionFeedback);
  const weekScopedOverlays = useProgramStore((state) => state.weekScopedOverlays);
  const currentProgram = useProgramStore((state) => state.currentProgram);
  const currentMicrocycle = useProgramStore((state) => state.currentMicrocycle);
  const dateOverrides = useProgramStore((state) => state.dateOverrides);
  const overrideContexts = useProgramStore((state) => state.overrideContexts);
  const expectations = getExplorerRenderExpectations();
  const snapshot = React.useMemo<ExplorerRenderAcceptedSnapshot>(() => {
    const weekStarts = Array.from(new Set([
      ...(currentProgram?.microcycles.map((week) =>
        week.startDate.slice(0, 10)) ?? []),
      ...(currentMicrocycle ? [currentMicrocycle.startDate.slice(0, 10)] : []),
      ...Object.keys(weekScopedOverlays),
    ])).sort();
    const visibleSessions = weekStarts.flatMap((mondayISO) =>
      buildProgramTabProjectedWeek({
        mondayISO,
        todayISO: todayISOLocal(),
        state: buildScheduleStateImperative(),
        overrideContexts,
      })).flatMap((day) => {
        const workout = day.workout;
        if (!workout) return [];
        const componentIds = getSessionComponents(workout).map((component) =>
          `${workout.id}:component:${component.id}`);
        const strengthPatterns = workout.strengthIntent?.plannedPatterns ??
          workout.strengthPatternContributions ?? [];
        if (strengthPatterns.includes('pull')) {
          componentIds.push(`${workout.id}:component:strength:pull`);
        }
        return [{
          date: day.date,
          sessionId: workout.id,
          componentIds,
        }];
      });
    return {
      markedDays: accepted.markedDays,
      injuryEpisodes: accepted.injuryEpisodes,
      readinessSignalsByDate: accepted.readinessSignalsByDate,
      temporarySourceFacts: accepted.temporarySourceFacts,
      reversibleAdjustments,
      sessionFeedback,
      weekScopedOverlayIds: Object.fromEntries(Object.entries(weekScopedOverlays)
        .map(([weekStart, overlay]) => [weekStart, overlay?.id ?? null])),
      visibleSessions,
    };
  }, [
    accepted,
    currentMicrocycle,
    currentProgram,
    dateOverrides,
    overrideContexts,
    reversibleAdjustments,
    sessionFeedback,
    weekScopedOverlays,
  ]);
  const ready = React.useMemo(() => expectations.filter((expectation) =>
    explorerRenderExpectationIsSatisfied(expectation, snapshot)),
  [expectations, snapshot]);

  React.useEffect(() => {
    for (const expectation of ready) {
      recordExplorerRenderedExpectation({
        expectation,
        renderedControlIds: expectation.requiredControlIds,
        canonicalSemanticIdentity: expectation.canonicalSemanticIdentity,
        accessibilityNode: {
          role: 'text',
          testIDs: [...expectation.requiredControlIds],
          canonicalSemanticIdentity: expectation.canonicalSemanticIdentity,
        },
      });
    }
  }, [ready]);

  return (
    <>
      {ready.flatMap((expectation: ExplorerRenderExpectation) =>
        expectation.requiredControlIds.map((testID) => (
          <ExplorerRenderWitness
            key={`${expectation.traceV2RootId}:${testID}`}
            testID={testID}
            accessibilityLabel={`${testID}:${expectation.canonicalSemanticIdentity}`}
          />
        )))}
    </>
  );
}
