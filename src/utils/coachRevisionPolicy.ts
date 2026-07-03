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
} from './coachRevisionProposal';
import {
  buildCoachRevisionTemplateSection,
  listCoachRevisionTemplates,
  visibleDayLooksLikeGame,
} from './coachRevisionTemplates';

export function coachRevisionValidationPolicyForWeek(
  visibleWeek: ResolvedDay[],
  todayISO: string,
) {
  const signatureFor = (templateId: string): string | null => {
    const section = buildCoachRevisionTemplateSection(templateId, todayISO);
    return section ? coachRevisionSectionBodySignature(section) : null;
  };
  // ATHLETE OVERRIDE PRINCIPLE (Sam, 2026-07-04): the athlete may choose
  // ANY registry session on any week — the program is theirs to override.
  // Bye/game-week awareness is ADVISORY now: it drives warnings at the
  // point of choice (planChangeProducer.planChangeWarningForCategory),
  // never a validation rejection. The validator's byeOnly mechanism stays
  // (fed an empty list) so a future hard gate is one line away.
  const standard: string[] = [];
  for (const template of listCoachRevisionTemplates()) {
    const signature = signatureFor(template.templateId);
    if (!signature) continue;
    standard.push(signature);
  }
  return {
    allowedChangedDates: visibleWeek.map((day) => day.date),
    // Free-form section adds stay forbidden; the ONLY addable content is the
    // app template registry, matched byte-exactly by body signature.
    allowedAddedSectionKinds: [] as never[],
    allowedTemplateSectionSignatures: standard,
    byeOnlyTemplateSectionSignatures: [] as string[],
    byeUnlockedDates: byeUnlockedDatesForWeek(visibleWeek),
  };
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
