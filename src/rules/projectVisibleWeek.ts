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
  type VisibleWeek,
} from './visibleProjection';

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

function partsForWorkout(
  date: string,
  workout: Workout | null | undefined,
): ProjectedDayParts['parts'] {
  if (!workout) return [];
  return getSessionComponents(workout).map((component) => {
    const kind = COMPONENT_TO_PART[String(component.id)] ?? 'strength';
    return {
      id: `${date}:${String(component.id)}`,
      kind,
      rows: [],
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
          headline: signedCopy(`part.headline.${part.kind}`),
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
