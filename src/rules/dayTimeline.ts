/**
 * THE DAY-FIRST TIMELINE — what the Program tab's today view shows for one day.
 *
 * Sam's day-first direction (docs/DAY_FIRST_UI_DIRECTION_2026-08-01.md): "the
 * day's session as a tappable component timeline — Mobility flow warm-up → tap to
 * open · Strength/Power component → tap to open · Conditioning or Team Training
 * → tap to open. Check off components as done."
 *
 * IT IS NOT A NEW PROJECTION, AND IT DELIBERATELY OWNS NOTHING THE PROJECTION
 * OWNS. Every word and every part on this list comes from `projectDayDetail`,
 * which is already the day-detail surface's reading of `VisibleDay`. The two
 * screens therefore cannot disagree about what is on a day, because they are one
 * list asked twice — and the walker's L-P3 cell already compares that list
 * against the projection after every action, so this surface inherits the law
 * rather than needing its own.
 *
 * WHAT THIS FILE DOES ADD IS THE ONE THING THE PROJECTION MUST NOT CARRY: THE
 * RESULT. `visibleWeek = derive(Bible, profile, facts, decisions, results,
 * today)` names results as an INPUT, and the athlete's saved session outcome is
 * exactly that — a record of what they did, not a description of what is
 * planned. Folding it into `VisibleDay` would put a result inside the plan's own
 * projection and give `SignedCopy` a second job. So the plan arrives as
 * `VisibleDay` and the result arrives beside it, and this function is where the
 * two meet.
 *
 * COMPLETION IS SHOWN, NEVER WRITTEN (Sam's fork A, 2026-08-07). Nothing here
 * mutates anything: `dayTimeline` is a read. There is no incremental
 * per-component door in the app — `componentCompletions` has exactly one writer,
 * `commitSessionOutcomeTransaction`, which mints a whole-session receipt — so a
 * timeline tick that PERSISTED would either fabricate a completion the athlete
 * never claimed or invent stored state of the shape the north star presumes
 * wrong. The timeline reflects what a saved outcome recorded and routes a tap
 * into the existing session door. docs/DAY_FIRST_UI_UNIT_PLAN_2026-08-07.md §1.
 */

import type { SessionFeedback } from '../store/programStore';
import type { FeedbackCompletion } from '../types/sessionOutcome';
import { completionByComponentId } from '../utils/sessionFeedbackForm';
import type { RecordedSessionExecutionReconciliation } from '../utils/sessionExecutionChecklist';
import {
  COMPOSED_OPTIONAL_ICON_KIND,
  PART_ICON_KIND,
  type RowIconKind,
} from './sectionIconKinds';
import { componentIdFromPartId, optionalKindForPart } from './projectVisibleWeek';
import type { Workout } from '../types/domain';
import { projectDayDetail } from './visibleDayDetail';
import type { SignedCopy } from './signedCopy';
import type { VisibleDay, VisiblePartKind, VisibleRow } from './visibleProjection';

export interface DayTimelineEntry {
  /** The projected part this row IS — same id, so nothing has to be matched up. */
  readonly partId: string;
  /** The component half of `partId`, recovered through the id's one owner. */
  readonly componentId: string;
  readonly kind: VisiblePartKind;
  /** Signed by the projection before it reached here. Never composed. */
  readonly headline: SignedCopy;
  /**
   * What the athlete's SAVED outcome recorded for this component, or `null` when
   * they have not saved one. `null` is "not answered yet", never "skipped" —
   * the two are different facts and an athlete who skipped a component said so.
   */
  readonly completion: FeedbackCompletion | null;
  /**
   * THE PART'S EXERCISES, FOR THE DROP-DOWN — name and prescription, both
   * already `SignedCopy` before they reached here.
   *
   * SAM'S EYE PASS, 2026-08-10: *"hers has like mobility / warmup then drop down
   * of the exercise and the sets and reps"* — the day card listed its parts as
   * flat lines with no detail at all, and that was the gap he named.
   *
   * IT IS THE PROJECTION'S OWN `rows`, PASSED THROUGH UNTOUCHED. Not a second
   * read, not a filter, not a re-order: `projectDayDetail` is already the
   * day-detail SCREEN's reading of the same day, so the card's drop-down and the
   * session screen cannot come to disagree about what is in a part — they are
   * one list asked twice, which is this file's founding property and the reason
   * `surfaceAgreementTests` can compare them at all.
   */
  readonly rows: readonly VisibleRow[];
  /**
   * THE GLYPH THIS ROW DRAWS, decided where the WORKOUT is still in scope.
   *
   * The card used to look this up itself with `PART_ICON_KIND[entry.kind]`, and
   * that table is keyed on `VisiblePartKind` — which has no `primer` member and
   * should not grow one, because a Primer IS a strength part; it is a strength
   * part with its own identity. So the card could not tell one from any other
   * and drew a dumbbell where Sam asked for his bolt (R-129).
   *
   * Decided HERE rather than on the screen because this is where the typed
   * `composedOptionalKind` is still readable. The alternative — matching the
   * headline STRING on the card — is `displayLabelIconKind`'s antipattern, and
   * this repo already has one of those.
   */
  readonly iconKind: RowIconKind;
}

/**
 * The day's components, in the projection's order, with what was recorded.
 *
 * Keyed on `partId` and never on `kind`: `COMPONENT_TO_PART` is many-to-one — a
 * conditioning component and a finisher both project as kind `conditioning`, and
 * `session`/`strength` and `recovery`/`recovery_addon` collide the same way — so
 * a day carrying both yields two entries of one kind. Anything keying this list
 * by kind loses a row the athlete has to do.
 *
 * Every part, in order, always. There is no filter in this file and there must
 * never be one (`visibleDayDetail`'s rule, and for the same reason).
 */
/**
 * A composed optional session's own glyph, or the part kind's.
 *
 * The table moved to `rules/sectionIconKinds` on 2026-08-27, beside the two maps
 * it has to agree with. It lived here AND in `utils/sessionExecutionChecklist`
 * as two hand-kept copies, which is the split R-116 exists to prevent.
 */
function iconKindForSection(
  kind: VisiblePartKind,
  workout: (Pick<Workout, 'composedOptionalKind'> & Partial<Pick<Workout, 'exercises'>>) | null | undefined,
  rows: readonly VisibleRow[],
): RowIconKind {
  /*
   * ⚠ **THE WORKOUT IS PASSED IN; IT IS NOT ON `VisibleDay`.** The first version
   * read `(day as { workout?: ... }).workout?.composedOptionalKind` — and
   * `VisibleDay` HAS NO `workout` FIELD, so the cast made a real lookup look
   * like one and silently answered `undefined` every time. The bolt never
   * appeared and nothing failed. A cast that invents a field is not a read.
   */
  const composed = optionalKindForPart(workout, rows);
  // Scoped to the part kinds a composed optional session's CONTENT produces —
  // the same two `partHeadline` names — so a team anchor on a combined day keeps
  // its own glyph.
  if (composed && (kind === 'strength' || kind === 'recovery')) {
    const chosen = COMPOSED_OPTIONAL_ICON_KIND[composed];
    if (chosen) return chosen;
  }
  return PART_ICON_KIND[kind];
}

/**
 * DID THE ATHLETE DO THIS PART? Only `full` or `partial` is work. `skipped` is
 * an answer ("I did not do it") and `null` is no answer; neither is done.
 *
 * ONE OWNER FOR "DONE" (everyday acceptance F3, 2026-09-09). The row ticks on
 * the Day card asked this question correctly while the day-level flag asked
 * "was every part ANSWERED" — so a session saved with nothing ticked read as
 * "Session complete" with a DONE badge over grey, untick'd rows. Every surface
 * that says "done" now asks here.
 */
export function timelineEntryWorked(completion: FeedbackCompletion | null): boolean {
  return completion === 'full' || completion === 'partial';
}

/**
 * IS THE DAY'S SESSION COMPLETE? The athlete's own work decides; a club-only
 * day follows its club answer. Complete means every deciding part has been
 * ANSWERED and at least one of them was WORKED: a part still unanswered leaves
 * the day open, and a day whose every part was skipped is answered but not
 * done. (A partly-done session — one part skipped, another done — is complete:
 * the athlete trained and said what they left out.)
 */
export function dayTimelineSessionCompleted(entries: readonly DayTimelineEntry[]): boolean {
  const ownWork = entries.filter((entry) => entry.kind !== 'team_training');
  const deciding = ownWork.length > 0 ? ownWork : entries;
  return deciding.length > 0
    && deciding.every((entry) => entry.completion !== null)
    && deciding.some((entry) => timelineEntryWorked(entry.completion));
}

export function dayTimeline(
  day: VisibleDay | null | undefined,
  feedback: SessionFeedback | null | undefined,
  /**
   * The day's STORED workout, for the typed facts the visible projection does
   * not carry. Optional so every existing caller is unchanged; a caller that
   * omits it gets the part kind's own glyph, which is what the screen did before.
   */
  workout?: Pick<Workout, 'composedOptionalKind'> & Partial<Pick<Workout, 'exercises'>> | null,
  /**
   * The same plan-aware execution receipt that restores the workout checklist.
   * Components covered by it never fall back to stale kind-level completions.
   */
  recordedExecution?: RecordedSessionExecutionReconciliation | null,
): readonly DayTimelineEntry[] {
  const detail = projectDayDetail(day);
  if (!detail) return [];

  const componentIds = detail.sections.map((section) =>
    componentIdFromPartId(section.partId));
  const recordedByLegacyComponent = completionByComponentId(feedback, componentIds);

  return detail.sections.map((section, index) => ({
    partId: section.partId,
    componentId: componentIds[index],
    kind: section.kind,
    headline: section.headline,
    completion: recordedExecution
      && componentIds[index] in recordedExecution.componentCompletions
      ? recordedExecution.componentCompletions[componentIds[index]]
      : recordedByLegacyComponent[componentIds[index]] ?? null,
    rows: section.rows,
    iconKind: iconKindForSection(section.kind, workout, section.rows),
  }));
}
