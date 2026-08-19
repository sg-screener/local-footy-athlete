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
/**
 * ⚠ **THERE IS NO `power` PART — SAM, 2026-08-20, EXTENDING R-110 TO THE DAY
 * CARD.** *"Merge POWER into Strength on the Program tab's Day summary card
 * too. No separate POWER row. Strength's count includes the power exercise. If
 * Strength is expanded, power appears first."*
 *
 * The projection already said power was strength work — `PART_BUCKET_KIND`
 * mapped `power -> strength` so no day could be TITLED "Power" (Sam, 2026-08-08:
 * *"power is just part of the Strength work"*). What it still did was list power
 * as its own timeline row underneath that title, so the day card said "Strength"
 * at the top and "POWER — 1 exercise" one line below it. The bucket ruling now
 * reaches the parts list: `COMPONENT_TO_PART` maps the power COMPONENT to a
 * strength PART, and `partsForWorkout` does not mint a second one.
 *
 * **The component is untouched.** `getSessionComponents` still emits `power`
 * with its own `completionPolicy`, `powerRows()` still answers every §18
 * counter, budget and progression read, and `role: 'power'` still rides the row.
 * A part is a display grouping; this changes the grouping and nothing else.
 */
export type VisiblePartKind =
  | 'strength'
  | 'conditioning'
  | 'recovery'
  | 'team_training'
  | 'game'
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
  /**
   * The sets×reps / duration line — and `null` WHEN THERE IS NO SUCH LINE.
   *
   * Nullable since 2026-08-17. A conditioning row's `prescribedSets` /
   * `prescribedRepsMin` / `Max` are PLACEHOLDERS, not a dose: a real generated
   * `Classic 4×4` carries `sets:1, min:1, max:1` while its authored dose (4 min
   * hard, 3 min easy jog, 4 rounds) sits in `dose` below. Rendering the
   * placeholders produced `1 × 1` on the athlete's screen over the top of a real
   * prescription — the defect Sam named first.
   *
   * A warm-up row is the other `null`: R-049, *"dose counts main work only —
   * warm-up and cool-down never count"*. It has no dose and must not be given
   * one.
   *
   * NULL MEANS "THIS ROW HAS NO SETS×REPS LINE", never "we could not work one
   * out". A row whose numbers ARE its dose still carries them here.
   */
  readonly prescription: SignedCopy | null;
  /**
   * THE AUTHORED CONDITIONING DOSE — work, rest, sets/rounds, total time.
   *
   * Sam, 2026-08-17: conditioning shows *"work time, rest time,
   * repetitions/rounds and useful duration"*, each on its own line. Every line
   * is one authored field of `data/conditioningTemplates.ts`, fetched through
   * `conditioningSelection.conditioningVisibleDoseFor` — the same accessor the
   * ROW COMPOSER uses, so the day screen and this projection cannot render one
   * dose two ways.
   *
   * Empty for every row that is not authored conditioning. It is a LIST rather
   * than a shaped record because the surfaces render it as lines and the
   * projection owns which lines exist — a card that picked fields out of a
   * record would be deciding presentation the projection already decided.
   */
  readonly dose: readonly SignedCopy[];
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
  /**
   * THE PART'S BUCKET — the athlete's CATEGORY for it, never its variant name.
   *
   * Sam's ruling, 2026-08-08: "bucket words only on the week view rows AND the
   * day title" — Strength, Conditioning, Rest, Mobility, Accessories, Gunshow,
   * Speed. The variant (Upper Push, Lower Squat, Full Body) belongs on the
   * timeline, where the day enumerates its parts one per line.
   *
   * IT IS CARRIED, NOT DERIVED BY THE SURFACE, for the reason `countsTowardLoad`
   * is: a card that mapped a headline back to a category would be a second
   * naming authority, and the two would disagree the first time a variant was
   * added. `headline` and `bucket` answer two different questions about one
   * part, and the projection answers both.
   */
  readonly bucket: SignedCopy;
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
  /**
   * WHAT THE DAY COULD NOT TRAIN, AND WHY — one signed sentence per typed gap.
   *
   * Sam's surface 4, 2026-08-17: *"typed equipment/kit gaps carried by the
   * program must be visible and understandable to the athlete."* The gap was
   * already typed and already stored — `Workout.composedGaps` — and the day
   * screen already had a notice for it. What was missing is that the ONE
   * CANONICAL PROJECTION did not carry it, so every other surface was blind to a
   * gap the app had already worked out and written down.
   *
   * EMPTY IS THE NORMAL ANSWER. A day with no gap carries no sentence; this is
   * never "we could not tell", it is "there was nothing missing".
   *
   * THE PROJECTION DOES NOT DECIDE THERE IS A GAP — the composer does, and this
   * reads its record. Nothing here inspects equipment or re-derives coverage,
   * which is the boundary the mission was given: *"do not invent replacement
   * exercises"*, and by the same token do not invent the absence of one.
   */
  readonly gaps: readonly SignedCopy[];
  readonly capabilities: DayCapabilities;
  readonly owner: VisibleDayOwner;
}

export interface VisibleWeek {
  readonly weekStart: string;
  readonly days: readonly VisibleDay[];
  /**
   * WHY THE WEEK CHANGED — the block-boundary explanations, as signed sentences.
   *
   * Sam's surface 5, 2026-08-17: *"existing load progression, reduced-week and
   * typed-refusal explanations must render clearly and agree exactly with the
   * stored program."*
   *
   * The sentences were BUILT AND SIGNED and had **no production reader at all** —
   * `blockBoundaryExplanationSentences` was called by two test files and nothing
   * else, so an athlete whose weights went up, or whose block was reduced after a
   * hard run, was told nothing. That is the field-with-no-reader shape this repo
   * bans by name.
   *
   * WEEK-LEVEL BECAUSE THE DECISION IS. A block boundary is a fact about the
   * BLOCK, not about a Tuesday; hanging it on a day would make the projection
   * pick a day to blame.
   *
   * THEY AGREE WITH THE STORED PROGRAM BY CONSTRUCTION — `program.
   * blockBoundaryExplanation` is the only input, and the renderer already refuses
   * to say a sentence whose claims the stored row does not support ("a signed
   * sentence is not a licence to say it in a world where it is false").
   *
   * EMPTY IS THE COMMON AND CORRECT ANSWER: a first block, or an athlete with no
   * qualifying history, changed no loads and has nothing to explain.
   */
  readonly explanations: readonly SignedCopy[];
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
  const out: string[] = [day.headline, ...day.gaps];
  if (day.capabilities.refusal) out.push(day.capabilities.refusal);
  for (const part of day.parts) {
    out.push(part.headline);
    if (part.detail) out.push(part.detail);
    for (const row of part.rows) {
      out.push(row.name);
      // `prescription` is nullable since 2026-08-17 — a conditioning row shows
      // its authored `dose` lines instead. Both are athlete-visible and both
      // are collected, so L-P2 still sees every word on the screen.
      if (row.prescription) out.push(row.prescription);
      out.push(...row.dose);
      if (row.cue) out.push(row.cue);
    }
  }
  return out;
}
