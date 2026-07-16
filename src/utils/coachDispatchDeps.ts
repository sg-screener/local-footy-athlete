/**
 * coachDispatchDeps.ts — production wiring for `dispatchCoachIntent`'s
 * dependency surface. Pulls together the existing engines + state
 * stores + visible-diff verifier into the small `DispatchDeps` shape
 * the dispatcher expects.
 *
 *   const deps = buildLiveDispatchDeps(todayISO, userMessage)
 *   const outcome = await dispatchCoachIntent(intent, packet, deps)
 *
 * This module is the generic dispatcher seam. Injury mutation is deliberately
 * not owned here: Coach/tap injury surfaces use InjuryEpisodeTransaction,
 * while these legacy dependency callbacks fail closed without writing state.
 */

import { applyAdjustmentEvents } from './applyAdjustmentEvents';
import { buildScheduleStateImperative } from './coachWeekDiff';
import {
  resolveWeekWithConditioning,
  getMondayStr,
  getMondayForDate,
  addDays,
} from './sessionResolver';
import {
  assertVerifiedProgramMutation,
} from './visibleWorkoutDiff';
import { inspectCoachState } from './coachStateInspector';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useProgramStore } from '../store/programStore';
import type { DispatchDeps } from './coachIntentDispatcher';
import { logger } from './logger';
import type { CoachContextPacket, CoachIntent } from './coachIntent';
import {
  buildFatigueConstraintFromIntent,
  buildSorenessConstraintFromIntent,
  buildBusyWeekConstraintFromIntent,
} from './coachConstraintProducers';
import {
  buildVerifiedCommunication,
  composeGuidanceOnlyReply,
  isSeverityExplicitInMessage,
} from './verifiedCoachCommunication';
import type { ActiveConstraint } from '../store/coachUpdatesStore';
import { verifyRenderedProgramMutation } from './visibleProgramReadModel';

/**
 * Compose the live dispatcher deps. Pure — no side effects until a
 * dep handler is invoked. Each handler runs through the existing
 * deterministic engines so the LLM never bypasses verification.
 */
export function buildLiveDispatchDeps(todayISO: string): DispatchDeps {
  return {
    runUAEForInjury(bodyPart, severity, _note) {
      logger.warn('[injury-episode] legacy_dispatch_mutation_bypassed', {
        bodyPart,
        severity,
        source: 'runUAEForInjury',
      });
      return {
        reply: `The ${bodyPart} injury update was not applied because this legacy path cannot durably verify the accepted program.`,
        mutated: false,
      };
    },

    runProgression(outcome, current, _note) {
      logger.warn('[injury-episode] legacy_dispatch_mutation_bypassed', {
        bodyPart: current.bodyPart,
        outcome: outcome.kind,
        source: 'runProgression',
      });
      return {
        reply: outcome.kind === 'resolved'
          ? `The ${current.bodyPart} injury was not resolved because this legacy path cannot durably recompose and verify the accepted program.`
          : `The ${current.bodyPart} injury update was not applied because this legacy path cannot durably verify the accepted program.`,
        mutated: false,
      };
    },

    inspect(query) {
      const monday = getMondayStr(0);
      const next = addDays(monday, 7);
      const cw = resolveWeekWithConditioning(monday, buildScheduleStateImperative());
      const nw = resolveWeekWithConditioning(next, buildScheduleStateImperative());
      return inspectCoachState({
        query,
        todayISO,
        activeInjury: useCoachUpdatesStore.getState().activeInjury,
        currentWeek: cw,
        nextWeek: nw,
        overrideContexts: useProgramStore.getState().overrideContexts ?? {},
      });
    },

    reapplyInjuryAtSeverity(bodyPart, severity, monday) {
      logger.warn('[injury-episode] legacy_dispatch_reapply_bypassed', {
        bodyPart,
        severity,
        monday,
      });
      return { applied: 0, visibleDiffDetected: false };
    },

    generalReply(_intent: CoachIntent, packet: CoachContextPacket): string {
      const i = packet.activeInjury;
      if (!i) return `Sure - what would you like to do?`;
      const today = packet.currentWeek.find((d) => d.isToday);
      const todayName = today?.workout?.name ?? 'today\'s session';
      const rules = i.rules.length > 0 ? i.rules.join('; ') : 'no specific restrictions';
      return (
        `With ${i.bodyPart} at ${i.severity}/10 (${i.status}), today's ${todayName} ` +
        `should follow the active restriction: ${rules}.`
      );
    },

    applyNonInjuryConstraint(kind, intent, packet) {
      // The packet date is the app's authoritative local "today". Using the
      // wall clock here makes replayed/fixed-date turns create future-dated
      // constraints that cannot apply to the week the athlete edited.
      const nowISO = `${packet.todayISO.slice(0, 10)}T12:00:00.000Z`;
      const upsert = useCoachUpdatesStore.getState().upsertActiveConstraint;

      // Truth-gate: detect whether the athlete actually stated a
      // severity number ("5/10", "8 out of 10"). The LLM intent
      // classifier may estimate severity from intensity language —
      // those estimates MUST NOT be displayed back as if the athlete
      // had stated a number themselves.
      const severityIsExplicit = isSeverityExplicitInMessage(packet.userMessage);

      // Helper: route through the truth-gate composer with no visible
      // diff observed yet. The downstream projection layer is what
      // actually mutates the visible week — this dispatcher reply is
      // the immediate ack and must NOT claim mutations the athlete
      // hasn't seen yet. The Coach Update card surfaces the verified
      // Applied diff once it lands.
      const guidanceReply = (constraint: ActiveConstraint): string => {
        const verified = buildVerifiedCommunication({
          activeConstraints: [constraint],
          plans: [],
          visibleDiff: [],
        });
        return composeGuidanceOnlyReply({
          communication: verified,
          constraints: [constraint],
          severityIsExplicit,
        });
      };

      switch (kind) {
        case 'fatigue': {
          const c = buildFatigueConstraintFromIntent(intent, nowISO, {
            userMessage: packet.userMessage,
            selectedDateISO: packet.todayISO,
          });
          upsert(c);
          logger.debug('[non-injury-constraint] fatigue_applied', {
            id: c.id,
            severity: c.severity,
            severityIsExplicit,
          });
          return { reply: guidanceReply(c), mutated: true };
        }
        case 'soreness': {
          const c = buildSorenessConstraintFromIntent(intent, nowISO, {
            userMessage: packet.userMessage,
            selectedDateISO: packet.todayISO,
          });
          if (!c) {
            logger.debug('[non-injury-constraint] soreness_skipped', {
              reason: 'no_body_part',
            });
            return {
              reply: `Where's the soreness? (e.g. quads, calves, shoulders)`,
              mutated: false,
            };
          }
          upsert(c);
          logger.debug('[non-injury-constraint] soreness_applied', {
            id: c.id,
            bucket: c.bucket,
            bodyPart: c.bodyPart,
            severity: c.severity,
            severityIsExplicit,
          });
          return { reply: guidanceReply(c), mutated: true };
        }
        case 'busy_week': {
          const c = buildBusyWeekConstraintFromIntent(intent, nowISO, {
            userMessage: packet.userMessage,
            selectedDateISO: packet.todayISO,
          });
          upsert(c);
          logger.debug('[non-injury-constraint] busy_week_applied', {
            id: c.id,
            severity: c.severity,
            severityIsExplicit,
          });
          return { reply: guidanceReply(c), mutated: true };
        }
      }
    },

    applyConstraintResolution(ids, _todayISO) {
      const store = useCoachUpdatesStore.getState();
      const monday = getMondayStr(0);
      // Snapshot the constraints BEFORE removal so we can return them
      // to the dispatcher (for the success reply).
      const before = store.activeConstraints ?? [];
      const idSet = new Set(ids);
      const cleared = before.filter((c) =>
        idSet.has(c.id) && c.status !== 'resolved' && c.type !== 'injury');
      if (cleared.some((constraint) =>
        (constraint.temporarySourceFactIds?.length ?? 0) > 0)) {
        logger.warn('[constraint-resolution] canonical_source_fact_resolution_required', {
          ids,
        });
        return {
          cleared: [],
          remainingActiveCount: before.filter((constraint) =>
            constraint.status !== 'resolved').length,
          derivedCardShouldRender: true,
        };
      }

      // 1. Remove each constraint from the store.
      for (const id of cleared.map((constraint) => constraint.id)) {
        useCoachUpdatesStore.getState().removeActiveConstraint(id);
      }

      // 2. Deactivate the Coach Update card for the current week if
      //    no active constraints remain. (HomeScreen card derives
      //    from activeConstraints, so leaving a stale card behind
      //    would re-create the live failure this whole detector
      //    fixes.)
      const remaining = useCoachUpdatesStore.getState().activeConstraints ?? [];
      const remainingActive = remaining.filter((c) => c.status !== 'resolved');
      if (remainingActive.length === 0) {
        useCoachUpdatesStore.getState().deactivateCoachUpdate(monday);
      }
      const currentWeekCard = useCoachUpdatesStore.getState().updatesByWeek[monday];

      logger.debug('[constraint-resolution] applied', {
        ids,
        clearedTypes: cleared.map((c) => c.type),
        remaining: remaining.length,
        remainingActive: remainingActive.length,
      });
      return {
        cleared,
        remainingActiveCount: remainingActive.length,
        derivedCardShouldRender: remainingActive.length > 0 || !!currentWeekCard?.active,
      };
    },

    applyProgramAdjustmentEvents(events, intendedChange) {
      const targetDates = intendedChange.targetDates ?? events.map((e) => e.date);
      const visibleMonday = getMondayForDate(todayISO);
      const nextVisibleSunday = addDays(visibleMonday, 13);
      const outsideVisibleWindow = targetDates.some(
        (d) => d < visibleMonday || d > nextVisibleSunday,
      );
      if (outsideVisibleWindow) {
        logger.debug('[program-adjustment] target outside visible window', {
          todayISO,
          visibleMonday,
          nextVisibleSunday,
          targetDates,
        });
        return {
          eventsApplied: 0,
          visibleDiff: [],
          success: false,
          reason: 'target_outside_visible_window',
        };
      }
      const weekStarts = Array.from(new Set(targetDates.map((d) => getMondayForDate(d))));
      const beforeWeek = weekStarts.flatMap((monday) =>
        resolveWeekWithConditioning(monday, buildScheduleStateImperative()),
      );

      const apply = applyAdjustmentEvents(events, {
        todayISO,
        allowFutureWeeks: true,
        allowPastDates: true,
      });

      const afterWeek = weekStarts.flatMap((monday) =>
        resolveWeekWithConditioning(monday, buildScheduleStateImperative()),
      );
      const verified = assertVerifiedProgramMutation({
        beforeWeek,
        afterWeek,
        intendedChange,
      });
      const renderedChecks = targetDates.map((targetDate) =>
        verifyRenderedProgramMutation({
          requestedDay: 'Monday',
          todayISO,
          targetDate,
          beforeWorkout: beforeWeek.find((d) => d.date === targetDate)?.workout ?? null,
        }),
      );
      const renderedSuccess =
        renderedChecks.length > 0 &&
        renderedChecks.every(
          (r) =>
            r.overrideKeyWritten &&
            r.afterHasConditioning,
        );

      logger.debug('[program-adjustment] applied', {
        eventsEmitted: events.length,
        eventsApplied: apply.applied.length,
        rejected: apply.rejected.map((r) => `${r.kind}@${r.date ?? '-'}`),
        success: verified.success && renderedSuccess,
        reason: verified.reason,
        changedDates: verified.changedDates,
        renderedSuccess,
      });

      if (verified.success && renderedSuccess && apply.applied.length > 0) {
        const touchedWeeks = Array.from(
          new Set(verified.changedDates.map((date) => getMondayForDate(date))),
        );
        for (const weekStart of touchedWeeks) {
          useCoachUpdatesStore.getState().upsertCoachUpdate(weekStart, {
            source: 'uae',
            reason: 'User-requested program adjustment',
            rules: [],
            changes: ['Added light aerobic intervals after strength'],
          });
        }
      }

      return {
        eventsApplied: apply.applied.length,
        visibleDiff: verified.changedDates,
        success: verified.success && renderedSuccess,
        reason: verified.reason ?? (renderedSuccess ? undefined : 'rendered_projection_missing_conditioning'),
      };
    },
  };
}
