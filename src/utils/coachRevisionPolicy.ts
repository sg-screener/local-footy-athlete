/**
 * coachRevisionPolicy — the SINGLE owner of app-side revision policy.
 *
 * Both change doors consume this module:
 *   - the chat coach (coachTurnController), and
 *   - the tap-first plan-change sheet (planChangeProducer).
 *
 * Policy says WHAT is allowed for a visible week: which dates may change,
 * which template content may be added (byte-exact body signatures), and
 * which dates have the bye-week hard-conditioning unlock. Neither door may
 * carry its own copy of these rules — that is exactly the
 * two-representations disease the revision pipeline was built to kill.
 */

import { getMondayForDate } from './sessionResolver';
import type { ResolvedDay } from './sessionResolver';
import {
  coachRevisionSectionBodySignature,
  snapshotProjectedDay,
  type CoachRevisionProtectedAnchor,
  type CoachVisibleDaySnapshot,
  type CoachVisibleSectionSnapshot,
} from './coachRevisionProposal';
import {
  buildCoachRevisionTemplateSection,
  buildCoachRevisionTemplateWorkout,
  listCoachRevisionTemplates,
  templateIdFromSection,
  visibleDayLooksLikeGame,
} from './coachRevisionTemplates';
import { validateLiveWorkoutWrite } from './postGenerationConstraintValidation';
import { projectVisibleDay } from './visibleProgramProjection';
import { materializeCanonicalPlanChangeCandidate } from './canonicalPlanChangeCandidateMaterializer';

function canonicalTemplateSectionSignature(
  templateId: string,
  date: string,
  todayISO: string,
): string | null {
  const workout = buildCoachRevisionTemplateWorkout(templateId, date);
  if (!workout) return null;
  let canonical;
  try {
    canonical = validateLiveWorkoutWrite(date, workout);
  } catch (error) {
    if ((error as { code?: string })?.code === 'section18_week_rejected') {
      return null;
    }
    throw error;
  }
  const projected = projectVisibleDay({
    day: {
      date,
      dayOfWeek: canonical.dayOfWeek,
      short: 'DAY',
      isToday: date === todayISO,
      source: 'manual',
      indicator: null,
      workout: canonical,
    } as ResolvedDay,
    activeInjury: null,
    todayISO,
  }).day;
  const section = snapshotProjectedDay(projected).workout?.sections[0];
  return section ? coachRevisionSectionBodySignature(section) : null;
}

export function coachRevisionValidationPolicyForWeek(
  visibleWeek: ResolvedDay[],
  todayISO: string,
) {
  const signatureFor = (templateId: string, date: string): string | null => {
    const section = buildCoachRevisionTemplateSection(templateId, date);
    return section ? coachRevisionSectionBodySignature(section) : null;
  };
  // ATHLETE OVERRIDE PRINCIPLE (Sam, 2026-07-04): the athlete may choose
  // ANY registry session on any week — the program is theirs to override.
  // Bye/game-week awareness is ADVISORY now: it drives warnings at the
  // point of choice (planChangeProducer.planChangeWarningForCategory),
  // never a validation rejection. The validator's byeOnly mechanism stays
  // (fed an empty list) so a future hard gate is one line away.
  //
  // DYNAMIC templates (engine-generated strength/accessories) produce
  // date-dependent content, so their signatures are computed for every
  // visible date; static templates are date-independent and computed once.
  const standard: string[] = [];
  const weekDates = visibleWeek.map((day) => day.date);
  for (const template of listCoachRevisionTemplates()) {
    const dates = template.dynamic ? weekDates : [todayISO];
    for (const date of dates) {
      const signature = signatureFor(template.templateId, date);
      if (signature) standard.push(signature);
    }
    // The publishable candidate passes through the normal safety/finalisation
    // boundary before projection. Authorise that exact registry-derived body
    // as well as the advertised raw body; free-form sections remain forbidden.
    // Canonicalisation can be date/phase dependent, so compute every visible
    // date even for otherwise-static template builders.
    for (const date of weekDates) {
      const signature = canonicalTemplateSectionSignature(
        template.templateId,
        date,
        todayISO,
      );
      if (signature) standard.push(signature);
    }
  }
  // A template stacked onto an accepted container can legitimately acquire a
  // container-derived section title while retaining byte-exact registry rows.
  // Derive those signatures from the same candidate materializer used by the
  // producer and writer. This authorizes only shapes the registry can actually
  // materialize against the visible source state; arbitrary free-form content
  // still has no allowed kind or signature.
  for (const day of visibleWeek) {
    if (!day.workout) continue;
    for (const template of listCoachRevisionTemplates()) {
      for (const kind of ['add_template', 'swap_template'] as const) {
        const candidate = materializeCanonicalPlanChangeCandidate({
          change: {
            kind,
            date: day.date,
            templateId: template.templateId,
          },
          currentDay: day,
          todayISO,
          canonicalizeWorkout: (date, workout) =>
            validateLiveWorkoutWrite(date, workout),
        });
        if (candidate.ok === false) continue;
        for (const section of candidate.projectedDay.workout?.sections ?? []) {
          if (templateIdFromSection(section) !== template.templateId) continue;
          standard.push(coachRevisionSectionBodySignature(section));
        }
      }
    }
  }
  return {
    allowedChangedDates: visibleWeek.map((day) => day.date),
    // Free-form section adds stay forbidden; the ONLY addable content is the
    // app template registry, matched byte-exactly by body signature.
    allowedAddedSectionKinds: [] as never[],
    allowedTemplateSectionSignatures: [...new Set(standard)],
    byeOnlyTemplateSectionSignatures: [] as string[],
    byeUnlockedDates: byeUnlockedDatesForWeek(visibleWeek),
    protectedAnchors: protectedAnchorsForVisibleWeek(visibleWeek),
  };
}

export function protectedAnchorsForVisibleWeek(
  visibleWeek: ResolvedDay[],
): CoachRevisionProtectedAnchor[] {
  return uniqueAnchors(
    visibleWeek.flatMap((day) =>
      protectedAnchorsForDaySnapshot(snapshotProjectedDay(day))),
  );
}

export function protectedAnchorRefsForDaySnapshot(
  day: CoachVisibleDaySnapshot,
): string[] {
  return protectedAnchorsForDaySnapshot(day).map((anchor) => anchor.ref);
}

export function protectedAnchorsForDaySnapshot(
  day: CoachVisibleDaySnapshot,
): CoachRevisionProtectedAnchor[] {
  if (!day.workout) return [];
  const anchors: CoachRevisionProtectedAnchor[] = [];

  if (visibleDayLooksLikeGame(day)) {
    anchors.push({
      date: day.date,
      kind: 'game',
      ref: day.workout.id,
      label: day.workout.title || 'Game day',
    });
  }

  for (const section of day.workout.sections) {
    if (!sectionLooksLikeTeamTraining(section)) continue;
    anchors.push({
      date: day.date,
      kind: 'team_training',
      ref: section.id,
      label: section.title || 'Team Training',
    });
  }

  return uniqueAnchors(anchors);
}

function sectionLooksLikeTeamTraining(
  section: CoachVisibleSectionSnapshot,
): boolean {
  if (section.kind !== 'session') return false;
  const haystack = [
    section.title,
    ...section.items.flatMap((item) => [item.title, item.description ?? '']),
  ].join(' ').toLowerCase();
  return /\bteam training\b/.test(haystack);
}

function uniqueAnchors(
  anchors: CoachRevisionProtectedAnchor[],
): CoachRevisionProtectedAnchor[] {
  const seen = new Set<string>();
  const out: CoachRevisionProtectedAnchor[] = [];
  for (const anchor of anchors) {
    const key = `${anchor.date}:${anchor.kind}:${anchor.ref}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(anchor);
  }
  return out;
}

/** Dates belonging to visible weeks that contain NO game day. Coaching
 *  policy: bye weeks unlock the work-capacity templates. */
export function byeUnlockedDatesForWeek(visibleWeek: ResolvedDay[]): string[] {
  const weekHasGame = new Map<string, boolean>();
  for (const day of visibleWeek) {
    const monday = getMondayForDate(day.date);
    const snapshotDay = snapshotProjectedDay(day);
    weekHasGame.set(
      monday,
      (weekHasGame.get(monday) ?? false) || visibleDayLooksLikeGame(snapshotDay),
    );
  }
  return visibleWeek
    .filter((day) => !weekHasGame.get(getMondayForDate(day.date)))
    .map((day) => day.date);
}
