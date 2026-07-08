/**
 * coachDispatchDeps.ts — production wiring for `dispatchCoachIntent`'s
 * dependency surface. Pulls together the existing engines + state
 * stores + visible-diff verifier into the small `DispatchDeps` shape
 * the dispatcher expects.
 *
 *   const deps = buildLiveDispatchDeps(todayISO, userMessage)
 *   const outcome = await dispatchCoachIntent(intent, packet, deps)
 *
 * This module is the seam that lets `CoachScreen.handleSend` stay
 * thin — all the nuanced engine plumbing (UAE → applyAdjustmentEvents
 * → visible-diff → Coach Update card → activeInjury seed) lives here
 * in one named function instead of being inlined in the screen.
 */

import {
  applyProgramAdjustment,
  buildInjuryPolicy,
  resolveInjuryBucket,
  eventToBullet,
} from './programAdjustmentEngine';
import {
  applyAdjustmentEvents,
  removeInjuryOverridesForWeek,
} from './applyAdjustmentEvents';
import { buildScheduleStateImperative } from './coachWeekDiff';
import {
  resolveWeekWithConditioning,
  getMondayStr,
  getMondayForDate,
  addDays,
} from './sessionResolver';
import {
  snapshotVisibleWorkout,
  computeVisibleDiff,
  assertVerifiedProgramMutation,
} from './visibleWorkoutDiff';
import { inspectCoachState } from './coachStateInspector';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useProgramStore } from '../store/programStore';
import type { InjuryState } from './injuryProgression';
import type { DispatchDeps } from './coachIntentDispatcher';
import { logger } from './logger';
import type { CoachContextPacket, CoachIntent } from './coachIntent';
import {
  buildFatigueConstraintFromIntent,
  buildSorenessConstraintFromIntent,
  buildBusyWeekConstraintFromIntent,
  buildMissedSessionConstraintFromIntent,
} from './coachConstraintProducers';
import {
  buildVerifiedCommunication,
  composeGuidanceOnlyReply,
  isSeverityExplicitInMessage,
} from './verifiedCoachCommunication';
import type { ActiveConstraint } from '../store/coachUpdatesStore';
import { verifyRenderedProgramMutation } from './visibleProgramReadModel';

function capitalize(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

/**
 * Compose the live dispatcher deps. Pure — no side effects until a
 * dep handler is invoked. Each handler runs through the existing
 * deterministic engines so the LLM never bypasses verification.
 */
export function buildLiveDispatchDeps(todayISO: string): DispatchDeps {
  return {
    runUAEForInjury(bodyPart, severity, note) {
      // 1. BEFORE snapshot — for visible-diff verification.
      const monday = getMondayStr(0);
      const beforeWeek = resolveWeekWithConditioning(
        monday,
        buildScheduleStateImperative(),
      );
      const beforeByDate: Record<string, ReturnType<typeof snapshotVisibleWorkout>> = {};
      for (const d of beforeWeek) beforeByDate[d.date] = snapshotVisibleWorkout(d.workout);

      // 2. Engine.
      const result = applyProgramAdjustment(
        {
          intent: 'injury',
          todayISO,
          message: note,
          payload: { bodyPart, severity },
          source: 'client_guard',
        } as any,
        buildScheduleStateImperative(),
      );
      const apply = applyAdjustmentEvents(result.events, { todayISO });

      // 3. AFTER snapshot + visible-diff verification.
      const afterWeek = resolveWeekWithConditioning(
        monday,
        buildScheduleStateImperative(),
      );
      const afterByDate: Record<string, ReturnType<typeof snapshotVisibleWorkout>> = {};
      for (const d of afterWeek) afterByDate[d.date] = snapshotVisibleWorkout(d.workout);
      const dates = Array.from(new Set([
        ...apply.applied.map((a) => a.date),
        ...result.events.map((e) => e.date),
      ]));
      const visibleDiff = computeVisibleDiff(dates, beforeByDate, afterByDate);
      const visibleDiffDetected = visibleDiff.length > 0;

      // 4. Bucket canonicalisation + activeInjury seed.
      // Bucket is ALWAYS derived from bodyPart here so known aliases
      // ('hammy' / 'lower back' / 'calves' / 'quads' …) never produce
      // a null bucket. Without the canonical bucket, the resolver-
      // level filter has nothing to act on for future weeks.
      const cardBucket =
        bodyPart && bodyPart !== 'unknown' ? resolveInjuryBucket(bodyPart) : null;
      if (!cardBucket && bodyPart && bodyPart !== 'unknown') {
        logger.warn('[injury-context] canonicalization_failed', {
          rawBodyPart: bodyPart,
          source: 'runUAEForInjury',
        });
      }
      logger.debug('[injury-context] canonicalized', {
        rawBodyPart: bodyPart,
        canonicalBucket: cardBucket,
        severity,
        source: 'runUAEForInjury',
      });
      const policy = buildInjuryPolicy(cardBucket, severity);
      const nowISO = new Date().toISOString();

      // ── ACTIVE INJURY SEED (UNCONDITIONAL when severity ≥ 5) ────
      // Persistent constraint drives future-week filtering even when
      // the current week had nothing to mutate.
      if (severity >= 5) {
        const existing = useCoachUpdatesStore.getState().activeInjury;
        const newState: InjuryState = existing && existing.bodyPart.toLowerCase() === bodyPart.toLowerCase()
          ? {
              ...existing,
              bucket: cardBucket as any,
              severity,
              status: 'active',
              rules: [...policy.globalRules],
              lastUpdatedAt: nowISO,
              history: [
                ...existing.history,
                { timestamp: nowISO, fromStatus: existing.status, toStatus: 'active', severity, note },
              ],
            }
          : {
              bodyPart,
              bucket: cardBucket as any,
              severity,
              initialSeverity: severity,
              status: 'active',
              rules: [...policy.globalRules],
              startDate: nowISO,
              createdAt: nowISO,
              lastUpdatedAt: nowISO,
              history: [{ timestamp: nowISO, fromStatus: 'new', toStatus: 'active', severity, note }],
            };
        useCoachUpdatesStore.getState().setActiveInjury(newState);
        logger.debug('[active-injury] set', {
          bodyPart: newState.bodyPart,
          bucket: newState.bucket,
          severity: newState.severity,
          status: newState.status,
          rules: newState.rules,
        });
      }

      // ── CARD WRITE (gated on apply.applied + visibleDiff) ─────
      if (apply.applied.length > 0 && visibleDiffDetected) {
        useCoachUpdatesStore.getState().upsertCoachUpdate(monday, {
          source: 'uae',
          reason: `${capitalize(bodyPart)} pain - ${severity}/10`,
          rules: [...policy.globalRules],
          changes: result.events.map((e) => eventToBullet(e)),
        });
      }

      // 5. Reply gate — match CoachScreen.handleSend's existing logic.
      if (result.events.length === 0) return result.reply;
      if (apply.applied.length === 0) {
        const head =
          bodyPart === 'unknown'
            ? `Got it - ${severity}/10.`
            : `Got it - ${bodyPart} ${severity}/10.`;
        return `${head}\n\nPlanned changes could not be applied - I lined up adjustments for your week, but they didn't land on real sessions.`;
      }
      if (!visibleDiffDetected) {
        const head =
          bodyPart === 'unknown'
            ? `Got it - ${severity}/10.`
            : `Got it - ${bodyPart} ${severity}/10.`;
        return `${head}\n\nNo changes applied - the user-visible surface didn't move. Investigate the apply layer.`;
      }
      return result.reply;
    },

    runProgression(outcome, current, note) {
      const monday = getMondayStr(0);
      const nowISO = new Date().toISOString();
      const partTitle = capitalize(current.bodyPart);

      if (outcome.kind === 'resolved') {
        removeInjuryOverridesForWeek(monday);
        useCoachUpdatesStore.getState().deactivateCoachUpdate(monday);
        useCoachUpdatesStore.getState().transitionInjuryStatus({
          toStatus: 'resolved', severity: 0, note, timestamp: nowISO,
        });
        useCoachUpdatesStore.getState().setActiveInjury(null);
        return `Great news - clearing the ${current.bodyPart} restrictions and getting your week back to normal.`;
      }

      if (outcome.kind === 'unchanged') {
        useCoachUpdatesStore.getState().transitionInjuryStatus({
          toStatus: 'active', severity: current.severity, note, timestamp: nowISO,
        });
        return `Got it - keeping the ${current.bodyPart} ${current.severity}/10 restrictions in place.`;
      }

      // improving / worsening: wipe + re-run engine at the new severity.
      const newSeverity = outcome.newSeverity;
      removeInjuryOverridesForWeek(monday);
      let appliedCount = 0;
      let visibleDiffDetected = false;
      let newRules: string[] = [];
      let newChanges: string[] = [];
      const beforeWeek = resolveWeekWithConditioning(monday, buildScheduleStateImperative());
      const beforeByDate: Record<string, ReturnType<typeof snapshotVisibleWorkout>> = {};
      for (const d of beforeWeek) beforeByDate[d.date] = snapshotVisibleWorkout(d.workout);

      if (newSeverity >= 5) {
        const result = applyProgramAdjustment(
          {
            intent: 'injury',
            todayISO,
            message: note,
            payload: { bodyPart: current.bodyPart, severity: newSeverity },
            source: 'client_guard',
          } as any,
          buildScheduleStateImperative(),
        );
        const apply = applyAdjustmentEvents(result.events, { todayISO });
        appliedCount = apply.applied.length;
        const afterWeek = resolveWeekWithConditioning(monday, buildScheduleStateImperative());
        const afterByDate: Record<string, ReturnType<typeof snapshotVisibleWorkout>> = {};
        for (const d of afterWeek) afterByDate[d.date] = snapshotVisibleWorkout(d.workout);
        const dates = Array.from(new Set([
          ...apply.applied.map((a) => a.date),
          ...result.events.map((e) => e.date),
        ]));
        visibleDiffDetected = computeVisibleDiff(dates, beforeByDate, afterByDate).length > 0;
        const cardBucket =
          current.bucket ?? (current.bodyPart && current.bodyPart !== 'unknown'
            ? resolveInjuryBucket(current.bodyPart) : null);
        const policy = buildInjuryPolicy(cardBucket, newSeverity);
        newRules = [...policy.globalRules];
        newChanges = result.events.map((e) => eventToBullet(e));
      }

      const trendWord = outcome.kind === 'improving' ? 'improving' : 'worse';
      const reason = `${partTitle} ${trendWord} - ${newSeverity}/10`;
      if (newSeverity < 5) {
        useCoachUpdatesStore.getState().deactivateCoachUpdate(monday);
      } else if (appliedCount > 0 && visibleDiffDetected) {
        useCoachUpdatesStore.getState().upsertCoachUpdate(monday, {
          source: 'uae', reason, rules: newRules, changes: newChanges,
        });
      }
      useCoachUpdatesStore.getState().transitionInjuryStatus({
        toStatus: outcome.kind === 'improving' ? 'improving' : 'active',
        severity: newSeverity, note, timestamp: nowISO,
      });

      if (outcome.kind === 'improving') {
        return newSeverity < 5
          ? `Good - ${current.bodyPart} ${newSeverity}/10 is light enough to train through. Easing the restrictions off this week.`
          : `Good - ${current.bodyPart} easing to ${newSeverity}/10. Pulling back some of the load restrictions.`;
      }
      return newSeverity >= 8
        ? `Sorry to hear - ${current.bodyPart} ${newSeverity}/10 is serious. Pulling things back hard.`
        : `Sorry to hear - ${current.bodyPart} worse at ${newSeverity}/10. Tightening the restrictions.`;
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
      removeInjuryOverridesForWeek(monday);
      const beforeWeek = resolveWeekWithConditioning(monday, buildScheduleStateImperative());
      const beforeByDate: Record<string, ReturnType<typeof snapshotVisibleWorkout>> = {};
      for (const d of beforeWeek) beforeByDate[d.date] = snapshotVisibleWorkout(d.workout);
      const result = applyProgramAdjustment(
        {
          intent: 'injury',
          todayISO,
          payload: { bodyPart, severity },
          source: 'client_guard',
        } as any,
        buildScheduleStateImperative(),
      );
      const apply = applyAdjustmentEvents(result.events, { todayISO });
      const afterWeek = resolveWeekWithConditioning(monday, buildScheduleStateImperative());
      const afterByDate: Record<string, ReturnType<typeof snapshotVisibleWorkout>> = {};
      for (const d of afterWeek) afterByDate[d.date] = snapshotVisibleWorkout(d.workout);
      const dates = Array.from(new Set([
        ...apply.applied.map((a) => a.date),
        ...result.events.map((e) => e.date),
      ]));
      const visibleDiff = computeVisibleDiff(dates, beforeByDate, afterByDate);
      return { applied: apply.applied.length, visibleDiffDetected: visibleDiff.length > 0 };
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
      const nowISO = new Date().toISOString();
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
          const c = buildFatigueConstraintFromIntent(intent, nowISO);
          upsert(c);
          logger.debug('[non-injury-constraint] fatigue_applied', {
            id: c.id,
            severity: c.severity,
            severityIsExplicit,
          });
          return { reply: guidanceReply(c), mutated: true };
        }
        case 'soreness': {
          const c = buildSorenessConstraintFromIntent(intent, nowISO);
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
          const c = buildBusyWeekConstraintFromIntent(intent, nowISO);
          upsert(c);
          logger.debug('[non-injury-constraint] busy_week_applied', {
            id: c.id,
            severity: c.severity,
            severityIsExplicit,
          });
          return { reply: guidanceReply(c), mutated: true };
        }
        case 'missed_session': {
          const c = buildMissedSessionConstraintFromIntent(intent, nowISO);
          upsert(c);
          logger.debug('[non-injury-constraint] missed_session_applied', {
            id: c.id, missedDate: c.missedDate, sessionName: c.sessionName,
          });
          const target = c.sessionName ?? (c.missedDate ? `the ${c.missedDate} session` : 'that session');
          const reply = `No worries about ${target} - picking up where the schedule left off, no make-up needed.`;
          return { reply, mutated: false };
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
      const cleared = before.filter((c) => idSet.has(c.id) && c.status !== 'resolved');

      // 1. Remove each constraint from the store.
      for (const id of ids) {
        useCoachUpdatesStore.getState().removeActiveConstraint(id);
      }

      // 2. Wipe injury overrides for the current week if any cleared
      //    constraint was an injury — the resolver-level filter
      //    already stops applying, but the manual overrides need to
      //    be flushed so the visible week reverts immediately.
      const anyInjuryCleared = cleared.some((c) => c.type === 'injury');
      if (anyInjuryCleared) {
        removeInjuryOverridesForWeek(monday);
      }

      // 3. Deactivate the Coach Update card for the current week if
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
        anyInjuryCleared,
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
