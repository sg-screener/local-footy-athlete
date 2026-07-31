/**
 * THE ONE PROJECTION OF THE ATHLETE'S WEEK.
 *
 * Sam's ruling, 2026-07-30: there is ONE projection. Every surface — week card,
 * day menu, session title, session content, coach prose, anything with a voice —
 * renders from it and is forbidden to compose, infer, name, merge or re-derive
 * anything of its own. A day that can be described two ways is a defect by
 * construction. This is `visibleWeek = derive(...)` from docs/NORTH_STAR.md
 * carried to the glass.
 *
 * It replaces FOUR projections of one accepted week (see
 * docs/ONE_PROJECTION_REASSESSMENT_2026-07-30.md §2): the resolver chain the card
 * reads, `buildProgramTabProjectedWeek`, the `CoachVisibleDaySnapshot` the menu
 * treats as truth, and the re-derivation `useDayWorkout` performs at render. And
 * three naming authorities, plus `splitSessionName` — a parser that turns a
 * composed name back into structure, whose existence is the proof that names were
 * being used as a data channel between layers.
 *
 * THREE PROPERTIES DO THE WORK, and each removes a defect class by construction
 * rather than by assertion:
 *
 *   1. `headline` and `detail` are `SignedCopy`. The generator's
 *      `allocation.focus` cannot be assigned to them, so "Aerobic conditioning
 *      component (25m…)" on a week card stops COMPILING.
 *   2. `parts` is the ONLY plural. No surface may merge, split, re-title or
 *      re-group. The card renders headlines, the detail renders the same parts
 *      with rows — two surfaces reading one list cannot disagree, so
 *      "Recovery + Recovery Session" beside "Recovery Session + Full Body
 *      Strength" becomes unrepresentable.
 *   3. `capabilities` is computed HERE, once. The menu renders it and cannot ask
 *      "is this a session?", because that question is answered before it arrives.
 *
 * RECOVERY IS A DAY TYPE LIKE ANY OTHER (Sam's ruling 3). A recovery day is a
 * real session with real exercises: same projection, same menu capabilities, same
 * editing rules. REST is complete rest and is its own `kind` — never "a day whose
 * workout happens to be null", which is the conflation that let a deletion door
 * write a schedule fact.
 *
 * AND RECOVERY COUNTS TOWARD NOTHING (same ruling). Not strength, not
 * conditioning, no exposure total, no maximum, no hard-day count. First-class for
 * rendering, menus and editing; invisible to the load ledger. `countsTowardLoad`
 * below is that ruling expressed as data, so no consumer has to remember it.
 *
 * PARKED, NOT RULED — recorded verbatim so nobody later reads it as
 * authorisation: Sam, 2026-07-30, "it should almost improve readiness but we
 * won't go there". No readiness credit for recovery is to be built.
 */

import type { SignedCopy } from './signedCopy';

/**
 * What KIND of day this is, for the athlete.
 *
 * `rest` is complete rest — an athlete decision or a fact, not an absence of
 * content. `training` covers every day with work on it, INCLUDING recovery: the
 * distinction the athlete cares about lives in the parts, not in the day type,
 * which is what "recovery is a day type like any other" means in practice.
 * `game` is the fixture.
 */
export type VisibleDayKind = 'training' | 'rest' | 'game';

/**
 * A part of a day, already named and already described.
 *
 * `kind` is structural and never a rendering instruction: no surface may branch
 * on it to decide how much of a session something is. It exists so the LEDGER can
 * ask what counts, and so capabilities can be reasoned about — not so a card can
 * decide that recovery deserves smaller words.
 */
export type VisiblePartKind =
  | 'strength'
  | 'conditioning'
  | 'recovery'
  | 'team_training'
  | 'game'
  | 'power'
  | 'speed'
  | 'support';

/**
 * Does this part count toward the §18 load ledger?
 *
 * Sam's ruling 3, as data. Recovery is `false` — first-class everywhere the
 * athlete touches it, invisible to every total, maximum and hard-day count.
 * Expressed here so that promoting recovery to a first-class part cannot silently
 * change what §18 counts: `section18RecoveryNeutralityTests` asserts the ledger
 * is byte-identical across the promotion, because the de-duplication-un-gates-
 * the-gate hazard (AGENTS.md) is live in exactly this change.
 */
export const PART_COUNTS_TOWARD_LOAD: Readonly<Record<VisiblePartKind, boolean>> = {
  strength: true,
  conditioning: true,
  power: true,
  speed: true,
  support: true,
  team_training: true,
  game: true,
  recovery: false,
};

export interface VisibleRow {
  readonly id: string;
  /** The exercise's authored name — traced to the master sheet, never composed. */
  readonly name: SignedCopy;
  readonly prescription: SignedCopy;
  readonly cue: SignedCopy | null;
}

export interface PartCapabilities {
  readonly canSwap: boolean;
  readonly canMove: boolean;
  readonly canRemove: boolean;
  readonly canEditRows: boolean;
}

export interface VisiblePart {
  readonly id: string;
  readonly kind: VisiblePartKind;
  readonly headline: SignedCopy;
  readonly detail: SignedCopy | null;
  readonly rows: readonly VisibleRow[];
  readonly capabilities: PartCapabilities;
  /** Ruling 3, carried with the part so no consumer re-derives it. */
  readonly countsTowardLoad: boolean;
}

/**
 * WHAT THE FOUR-ACTION MENU MAY OFFER ON THIS DAY.
 *
 * These are DOOR answers, not transaction shapes: each one says whether the
 * athlete gets that row, and the producer then says which scopes and which
 * destinations sit behind it.
 *
 * THE `WholeDay` SUFFIX IS OLDER THAN THE SCOPED DOORS AND NOW READS NARROWER
 * THAN IT MEANS. Both fields are asked of the DAY, and a combined day answers
 * yes to a move that takes only its gym session. Not renamed here because the
 * name is part of `MenuView` and reaches surfaces this task does not own; the
 * meaning is pinned below so nobody has to guess it from the identifier.
 */
export interface DayCapabilities {
  /** May work be added to this day at all? False only for a fixture. */
  readonly canAdd: boolean;
  /** Is there work on this day that can LEAVE it — whole or scoped? */
  readonly canMoveWholeDay: boolean;
  /** Can work be taken OFF this day — whole or scoped? */
  readonly canRemoveWholeDay: boolean;
  /** Why the day offers nothing, in words the athlete may read. */
  readonly refusal: SignedCopy | null;
}

/** Who owns this day's content — the athlete, a declared fact, or the plan. */
export type VisibleDayOwner = 'athlete' | 'fact' | 'plan';

export interface VisibleDay {
  readonly date: string;
  readonly kind: VisibleDayKind;
  /** The day's one name. Every surface shows THIS — there is no second name. */
  readonly headline: SignedCopy;
  readonly parts: readonly VisiblePart[];
  readonly capabilities: DayCapabilities;
  readonly owner: VisibleDayOwner;
}

export interface VisibleWeek {
  readonly weekStart: string;
  readonly days: readonly VisibleDay[];
}

/**
 * THE SURFACE CONTRACT — what a surface is allowed to be.
 *
 * A surface is a pure function from `VisibleDay` to what it shows. It receives no
 * store, no profile, no resolver and no accepted state, because those are the
 * ingredients of composition and a surface does not compose. The walker's L-P1
 * asserts `surface(day) === projection(day)`, never `surface_a === surface_b`:
 * two surfaces that drifted together would satisfy the weaker form, and the whole
 * failure this replaces was surfaces agreeing with each other's mistakes.
 */
export type Surface<T> = (day: VisibleDay) => T;

/** What the week card shows. Headlines only — the card has no other vocabulary. */
export interface CardView {
  readonly date: string;
  readonly headline: SignedCopy;
  readonly partHeadlines: readonly SignedCopy[];
}

/** What the day detail shows: the same parts, with rows. */
export interface DetailView {
  readonly date: string;
  readonly headline: SignedCopy;
  readonly parts: readonly VisiblePart[];
}

/** What the menu offers. Rendered capability — never re-derived from content. */
export interface MenuView {
  readonly date: string;
  readonly day: DayCapabilities;
  readonly parts: readonly { readonly id: string; readonly capabilities: PartCapabilities }[];
}

/**
 * What the coach's prose may describe.
 *
 * Sam's ruling 1: the coach reads the same projection; `summariseDay` is retired
 * as an independent composition. A surface with a VOICE is a surface — prose or
 * pixels — so the coach gets a view of the projection like every other surface
 * and may not compose its own account of the week.
 *
 * Deliberately identical in shape to what the card and detail receive, so the
 * coach cannot describe a day the athlete cannot see, and cannot fail to describe
 * one they can.
 */
export interface CoachView {
  readonly date: string;
  readonly kind: VisibleDayKind;
  readonly headline: SignedCopy;
  readonly parts: readonly {
    readonly id: string;
    readonly kind: VisiblePartKind;
    readonly headline: SignedCopy;
  }[];
}

export const cardView: Surface<CardView> = (day) => ({
  date: day.date,
  headline: day.headline,
  partHeadlines: day.parts.map((part) => part.headline),
});

export const detailView: Surface<DetailView> = (day) => ({
  date: day.date,
  headline: day.headline,
  parts: day.parts,
});

export const menuView: Surface<MenuView> = (day) => ({
  date: day.date,
  day: day.capabilities,
  parts: day.parts.map((part) => ({ id: part.id, capabilities: part.capabilities })),
});

export const coachView: Surface<CoachView> = (day) => ({
  date: day.date,
  kind: day.kind,
  headline: day.headline,
  parts: day.parts.map((part) => ({
    id: part.id,
    kind: part.kind,
    headline: part.headline,
  })),
});

/**
 * Every athlete-visible string a day would put on a screen.
 *
 * Used by L-P2 to assert that nothing rendered is absent from the signed-copy
 * sheet. Collected from the PROJECTION rather than by scraping components,
 * because the law is that the projection is the only source — if a surface shows
 * something this does not return, that surface composed it.
 */
export function athleteVisibleStrings(day: VisibleDay): readonly string[] {
  const out: string[] = [day.headline];
  if (day.capabilities.refusal) out.push(day.capabilities.refusal);
  for (const part of day.parts) {
    out.push(part.headline);
    if (part.detail) out.push(part.detail);
    for (const row of part.rows) {
      out.push(row.name, row.prescription);
      if (row.cue) out.push(row.cue);
    }
  }
  return out;
}
