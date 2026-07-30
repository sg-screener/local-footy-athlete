/**
 * `project()` — THE ONE CANONICAL PROJECTION. `buildProgramTabProjectedWeek`'s
 * successor.
 *
 * Sam's ruling: one projection, every surface a dumb window onto it, a day that
 * can be described two ways is a defect by construction.
 *
 * WHAT THIS STAGE DOES AND DOES NOT DO. It establishes the OWNER and the SHAPE.
 * `parts`, `capabilities`, `kind` and `owner` are computed here, once, and the
 * cells consume them — which is enough to hold L-P1/L-P3/L-P4, because those laws
 * are about structure and capability, not wording. It deliberately does NOT invent
 * headlines: `headline` resolves through the signed-copy sheet, so a day whose
 * words Sam has not yet ruled raises `UnsignedCopyError` rather than quietly
 * shipping composed text. That is the designed behaviour — the gap is loud and it
 * is Sam's to close (batches 3-4 are in flight) — and it is why `projectParts`
 * exists beside `project`: the structural laws can be armed now without waiting on
 * vocabulary, and there is still only ONE derivation, asked two questions.
 *
 * WHY IT WRAPS RATHER THAN REPLACES, FOR NOW. `buildProgramTabProjectedWeek` is
 * already a single derivation of accepted state and is the only one no screen
 * composes over. Re-deriving from accepted state here would create a fifth
 * projection during the migration — the exact thing being removed — so this reads
 * that one and re-shapes it. The wrapper is a staging device with a stated end:
 * when every surface consumes `project()`, the inner call collapses into it and
 * `buildProgramTabProjectedWeek` goes (deletion 1 of nine). Until then the
 * assertion `project() ≡ buildProgramTabProjectedWeek` is trivially true, which is
 * the point — the new owner is proven to change nothing before anything renders
 * from it.
 *
 * RECOVERY IS A DAY TYPE LIKE ANY OTHER (ruling 3). No branch here treats a
 * recovery part as less than a strength part: capabilities come from the part's
 * position in the day, never from its kind. What recovery does NOT do is count —
 * `countsTowardLoad` carries that, and only the ledger reads it.
 */

import type { ResolvedDay } from '../utils/sessionResolver';
import type { Workout } from '../types/domain';
import { getSessionComponents } from '../utils/sessionComponents';
import { composeDayDetail, type ComposedDayDetail } from '../utils/dayDetailComposition';
import { canonicalExerciseName } from '../utils/exerciseCanonicalisation';
import { resolveSessionDisplayName } from '../utils/sessionNaming';
import {
  exerciseCueCopyId,
  exerciseNameCopyId,
  registerProjectionCopy,
  STRENGTH_HEADLINE_ID_BY_LABEL,
} from './projectionCopy';
import { signedCopy, type SignedCopy } from './signedCopy';
import {
  PART_COUNTS_TOWARD_LOAD,
  type DayCapabilities,
  type PartCapabilities,
  type VisibleDay,
  type VisibleDayKind,
  type VisibleDayOwner,
  type VisiblePart,
  type VisiblePartKind,
  type VisibleRow,
  type VisibleWeek,
} from './visibleProjection';

// Registered once at module load, so every call to `project()` — the first
// one included — finds its vocabulary already there. Idempotent: see
// `registerProjectionCopy`'s own guard.
registerProjectionCopy();

/**
 * The structural half of a day — everything that needs no vocabulary.
 *
 * Same fields as `VisibleDay` minus the words. Not a second projection: it is the
 * same derivation, with the copy lookup not yet applied, so `project()` is
 * literally `projectParts()` plus headlines.
 */
export interface ProjectedDayParts {
  readonly date: string;
  readonly kind: VisibleDayKind;
  readonly owner: VisibleDayOwner;
  readonly parts: readonly Omit<VisiblePart, 'headline' | 'detail'>[];
  readonly capabilities: Omit<DayCapabilities, 'refusal'>;
}

export interface ProjectedWeekParts {
  readonly weekStart: string;
  readonly days: readonly ProjectedDayParts[];
}

const COMPONENT_TO_PART: Readonly<Record<string, VisiblePartKind>> = {
  strength: 'strength',
  conditioning: 'conditioning',
  finisher: 'conditioning',
  power: 'power',
  speed: 'speed',
  support: 'support',
  team_training: 'team_training',
  recovery: 'recovery',
  recovery_addon: 'recovery',
  session: 'strength',
};

/**
 * Is this day a fixture, complete rest, or training?
 *
 * REST IS ITS OWN KIND, never "a day whose workout is null" — that conflation is
 * what let a deletion door write a schedule fact, and it is why an empty training
 * day and a rest day must be distinguishable here.
 */
function dayKind(day: ResolvedDay): VisibleDayKind {
  if (day.source === 'game' || day.indicator === 'game') return 'game';
  if (day.source === 'rest') return 'rest';
  return 'training';
}

function dayOwner(day: ResolvedDay): VisibleDayOwner {
  if (day.workout?.athletePlacement) return 'athlete';
  if (day.source === 'manual') return 'athlete';
  if (day.source === 'rest' || day.source === 'game') return 'fact';
  return 'plan';
}

/**
 * What the athlete may do to a part.
 *
 * Derived from the part's POSITION in the day, never from its kind — that is
 * ruling 3 in code. A protected anchor (team training, a game) cannot be swapped
 * or removed because it is a fact about the athlete's week, not because of the
 * words on it; everything else on the day is equally editable whether it is
 * strength or recovery.
 */
function partCapabilities(kind: VisiblePartKind): PartCapabilities {
  const isAnchor = kind === 'team_training' || kind === 'game';
  return {
    canSwap: !isAnchor,
    canMove: !isAnchor,
    canRemove: !isAnchor,
    canEditRows: !isAnchor,
  };
}

/**
 * The row-level rescue: same numbers, an authored template.
 *
 * Reuses the SHAPE `dayWorkoutHelpers.formatStrengthSetsReps` /
 * `formatRecoveryPrescription` already ship — sets×reps and duration are the
 * two dominant row shapes across strength/support/conditioning rows. A shape
 * not covered here (distance, tempo, per-side) falls through to
 * `row.prescription.unspecified` rather than inventing a template for it; see
 * `projectionCopy.ts`'s header and the task report for that scope note.
 */
function prescriptionCopy(row: any): SignedCopy {
  const sets = Number(row?.prescribedSets);
  const min = Number(row?.prescribedRepsMin);
  const max = Number(row?.prescribedRepsMax);
  const hasRange = Number.isFinite(min) && Number.isFinite(max);
  const pType = row?.prescriptionType;
  if (pType === 'duration_minutes' && hasRange) {
    return min === max
      ? signedCopy('row.prescription.duration_minutes', { minutes: min })
      : signedCopy('row.prescription.duration_minutes_range', { min, max });
  }
  if (pType === 'duration' && hasRange) {
    return min === max
      ? signedCopy('row.prescription.duration_seconds', { seconds: min })
      : signedCopy('row.prescription.duration_seconds_range', { min, max });
  }
  if (Number.isFinite(sets) && hasRange) {
    return min === max
      ? signedCopy('row.prescription.sets_reps', { sets, reps: min })
      : signedCopy('row.prescription.sets_reps_range', { sets, min, max });
  }
  return signedCopy('row.prescription.unspecified');
}

/**
 * A raw row's exercise name, as `SignedCopy`.
 *
 * Never composed: every name a builder emits traces to either the locked
 * vocabulary (`selectableExerciseVocabulary.ts`, exercise-name-literal-lock
 * unit) or the small, structurally-closed conditioning-equipment-substitution
 * set (`conditioningFeasibility.ts`'s own exported list) — both
 * bulk-registered by `projectionCopy.ts`. Canonicalising before lookup
 * handles spelling/case variants the same way `hasCuratedCue` already does.
 *
 * NO FALLBACK, on purpose — the template-blank law
 * (`artifacts/COPY_SHEET_RULINGS_2026-07-30.md` batch 2, ruling 1): "an
 * unmapped engine value fails the build rather than falling back." A row name
 * that resolves to neither traced source is a THIRD source this projection
 * does not yet know about, and the honest behaviour is `UnsignedCopyError` —
 * the gate goes red and names the gap — not a generic word an athlete would
 * read as if it were the real exercise.
 */
function rowName(row: any): SignedCopy {
  const raw = String(row?.exercise?.name ?? row?.name ?? '');
  const canonical = canonicalExerciseName(raw);
  return signedCopy(exerciseNameCopyId(canonical));
}

function rowCue(row: any): SignedCopy | null {
  const raw = String(row?.exercise?.name ?? row?.name ?? '');
  const canonical = canonicalExerciseName(raw);
  const id = exerciseCueCopyId(canonical);
  return id ? signedCopy(id) : null;
}

function toVisibleRows(rows: readonly any[]): VisibleRow[] {
  return rows.map((row, index) => ({
    id: String(row?.id ?? `${index}`),
    name: rowName(row),
    prescription: prescriptionCopy(row),
    cue: rowCue(row),
  }));
}

/**
 * The rows a part shows, from the SAME derivation the day-detail screen uses.
 *
 * `composeDayDetail` is `useDayWorkout`'s composition, extracted so a harness
 * can call it (`dayDetailCompositionOwnershipTests.ts`). Calling it here makes
 * this projection its SECOND caller — the pin now names both, and Task 6
 * shrinks it back to one (the projection) once the screen renders from
 * `project()` instead of composing its own detail. Kinds with no row-level
 * surface in `composeDayDetail` today (recovery, team_training, power, speed,
 * game) get `[]`, matching what the existing screen shows for them.
 */
function rowsForKind(kind: VisiblePartKind, composed: ComposedDayDetail): VisibleRow[] {
  if (kind === 'strength') return toVisibleRows(composed.strengthExercises);
  if (kind === 'support') return toVisibleRows(composed.supportExercises);
  if (kind === 'conditioning') return toVisibleRows(composed.conditioningExercises);
  return [];
}

function partsForWorkout(
  date: string,
  workout: Workout | null | undefined,
): ProjectedDayParts['parts'] {
  if (!workout) return [];
  const composed = composeDayDetail(workout, workout);
  return getSessionComponents(workout).map((component) => {
    const kind = COMPONENT_TO_PART[String(component.id)] ?? 'strength';
    return {
      id: `${date}:${String(component.id)}`,
      kind,
      rows: rowsForKind(kind, composed),
      capabilities: partCapabilities(kind),
      countsTowardLoad: PART_COUNTS_TOWARD_LOAD[kind],
    };
  });
}

/**
 * THE STRUCTURAL PROJECTION — one derivation, no vocabulary.
 *
 * This is what the surface-agreement cells consume: parts conservation (L-P3) and
 * capability parity (L-P4) are structural claims, and arming them must not wait on
 * copy rulings.
 */
export function projectParts(args: {
  week: readonly ResolvedDay[];
  weekStart: string;
}): ProjectedWeekParts {
  return {
    weekStart: args.weekStart,
    days: args.week.map((day) => {
      const parts = partsForWorkout(day.date, day.workout);
      const editable = parts.filter((part) => part.capabilities.canRemove);
      return {
        date: day.date,
        kind: dayKind(day),
        owner: dayOwner(day),
        parts,
        capabilities: {
          // A day with room for more work can take more, whatever is on it
          // already. No recovery exception: ruling 3.
          canAdd: dayKind(day) !== 'game',
          canMoveWholeDay: editable.length > 0,
          canRemoveWholeDay: editable.length > 0,
        },
      };
    }),
  };
}

/**
 * THE FULL PROJECTION — structure plus the athlete's words.
 *
 * Raises `UnsignedCopyError` for any day or part whose words are not yet in the
 * signed-copy sheet. That is deliberate and is the whole value of the branded
 * type: the alternative is composing text, which is the defect. Callers during the
 * migration use `projectParts` for structural work and adopt `project` per surface
 * as batches land.
 */
export function project(args: {
  week: readonly ResolvedDay[];
  weekStart: string;
}): VisibleWeek {
  const structural = projectParts(args);
  return {
    weekStart: structural.weekStart,
    days: structural.days.map((day, index): VisibleDay => {
      const source = args.week[index];
      return {
        date: day.date,
        kind: day.kind,
        owner: day.owner,
        headline: dayHeadline(day.kind, source),
        parts: day.parts.map((part): VisiblePart => ({
          ...part,
          headline: partHeadline(part.kind, source.workout, part.rows),
          // Ambiguity resolution (Sam, as controller, 2026-07-31): populate from a
          // part's existing signed sub-line where one exists, otherwise null — do
          // not invent prose. No reliable authored sub-line source is wired to an
          // arbitrary part yet, so every part gets `null` in this task; a future
          // task can wire one in (e.g. `ConditioningVisibleIdentity.doseLabel`)
          // without this shape changing.
          detail: null,
        })),
        capabilities: {
          ...day.capabilities,
          refusal: day.capabilities.canAdd || day.parts.length > 0
            ? null
            : signedCopy('day.refusal.nothing_to_change'),
        },
      };
    }),
  };
}

/**
 * A day's one name.
 *
 * Looked up by KIND, not composed from its parts — "Recovery + Recovery Session"
 * was a composition, and a composition is what a day headline must never be. The
 * parts carry their own headlines and the surfaces render both; the day's name
 * says what kind of day it is and nothing more.
 */
function dayHeadline(kind: VisibleDayKind, _day: ResolvedDay): SignedCopy {
  return signedCopy(`day.headline.${kind}`);
}

/**
 * A part's one name.
 *
 * Looked up by KIND first (`part.headline.<kind>`, a generic fallback that
 * always resolves), with ONE specific-name resolution ahead of it: a strength
 * part's name is the pinned `canonicalStrengthLabel` output for its own typed
 * `strengthIntent` — reusing `resolveSessionDisplayName`, the EXISTING single
 * naming authority (`sessionNaming.ts`), rather than re-deriving movement
 * patterns here and becoming a second one. When that authority's answer is not
 * one of the seven pinned names (a gunshow/prehab/mobility variant, or a
 * legacy session with no typed intent), it falls through to the generic
 * "Strength" fallback rather than passing unregistered text through — see
 * `projectionCopy.ts`'s module header ("SCOPE NOTE") for why conditioning gets
 * the same generic treatment rather than a specific resolution in this task.
 */
function partHeadline(
  kind: VisiblePartKind,
  workout: Workout | null | undefined,
  rows: readonly VisibleRow[],
): SignedCopy {
  if (kind === 'strength') {
    // `focus`/`name` are deliberately NOT passed. `resolveSessionDisplayName`'s
    // last-resort precedence step is a cleaned pass-through of exactly those
    // fields, and that pass-through is defect 3's mechanism (planner-internal
    // text like "aerobic conditioning component" reaching a headline via a
    // punctuation tidier — see `surfaceAgreementTests.ts` cell 3, and this
    // module's own header). Omitting them means this call can only ever
    // return one of the pinned strength labels or fall through to `partHeadline`'s
    // own generic fallback below — never composed/pass-through text. Do not
    // add them back without re-closing that path.
    const resolved = resolveSessionDisplayName({
      strengthIntent: workout?.strengthIntent,
      exercises: rows.map((row) => ({ name: row.name })),
      isTeamDay: false,
      tier: 'core',
    }).trim();
    const id = STRENGTH_HEADLINE_ID_BY_LABEL.get(resolved);
    if (id) return signedCopy(id);
  }
  return signedCopy(`part.headline.${kind}`);
}
