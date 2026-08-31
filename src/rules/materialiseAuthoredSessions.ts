/**
 * THE MATERIALISATION BOUNDARY — scheduler-authored intentions in, content out.
 *
 * **Sam's boundary, 2026-08-15, verbatim.**
 *
 *   The SCHEDULER owns: whether conditioning, sprint or power is required · its
 *   purpose/category · standalone versus combined role · its weekday · hard/rest
 *   classification · weekly count and spacing.
 *
 *   The SPECIALISTS own: the exact conditioning template · the exact sprint
 *   template within the scheduler's requested quality · the exact power
 *   exercise/primer · work, rest, rounds, distance, modality and dose.
 *
 *   *"A specialist may refuse an impossible request with a typed reason. It may
 *   never add, remove, move or repurpose a session."*
 *
 * ## THIS FILE IS A BOUNDARY, NOT AN ORCHESTRATOR
 *
 * It was explicitly ordered not to become one: *"Do not copy the old planner's
 * orchestration into a new large file."* So every decision below is DELEGATED to
 * an authority that already exists —
 *
 *   - `conditioningSelection.selectConditioningTemplate` — which template
 *   - `conditioningSelection.speedTemplateByName` — which sprint template
 *   - `powerPrimerPolicy.decidePowerPrimer` — which primer, and whether any
 *
 * — and this module contributes exactly one thing: **the guarantee that a
 * specialist's answer can only fill in a day the scheduler already authorised.**
 *
 * ## THE STRUCTURAL GUARANTEE
 *
 * `materialiseAuthoredSessions` maps over `schedule.days` and returns **exactly
 * one entry per scheduler-authored day, in the scheduler's order**. A specialist
 * cannot add a day (nothing appends), cannot remove one (a refusal yields a typed
 * `unmaterialised` reason and the day survives), cannot move one (`dayOfWeek` is
 * copied, never computed) and cannot repurpose one (`purpose` and `owner` are
 * copied). **Those four properties are guarded behaviourally, not asserted here.**
 */
import {
  selectConditioningTemplateWithTrace,
  speedTemplateByName,
  type AthleteConditioningCategory,
  type ConditioningRole,
  type BlockConditioningSelection,
} from './conditioningSelection';
import { decidePowerPrimer, type PowerPrimerSpec } from './powerPrimerPolicy';
import type { ConditioningModality, ConditioningTemplate } from '../data/conditioningTemplates';
import type { CapacityBand } from '../types/domain';
import type { SessionIntention, WeeklySchedule } from './weeklyScheduler';
import type { SessionPurpose } from './weeklyProgrammingContract';
import type { AutomaticProgrammingSelectionTrace } from './programmingSelectionTrace';

/** Why a specialist could not serve an authorised request. Typed, never silent. */
export type UnmaterialisedReason =
  | 'no_template_for_category_on_this_equipment'
  | 'power_primer_declined_by_policy'
  /** §3 G-2: "No heavy lower-body or added speed work." Omitted, never moved. */
  | 'power_refused_lower_body_on_g2';

export interface MaterialisedSession {
  /** Copied from the intention. Never recomputed — the day is not ours to move. */
  readonly dateISO: string;
  readonly dayOfWeek: number;
  readonly purpose: SessionPurpose | null;
  readonly owner: SessionIntention['owner'];
  readonly clubTraining: boolean;
  readonly game: boolean;
  readonly optional: boolean;
  /** R-130: the scheduler's composed-optional offer, copied verbatim. */
  readonly composedOptional?: 'primer' | 'gunshow';
  /** The scheduler's clause, carried so a session can name who authorised it. */
  readonly clauseId: string;
  /** Specialist content. Null when the day authorises none. */
  readonly conditioningTemplate: ConditioningTemplate | null;
  readonly conditioningOffFeet?: boolean;
  readonly conditioningRole: ConditioningRole | null;
  /**
   * WC-139. A SECOND conditioning component on this day, and it is a sprint.
   *
   * Separate from `conditioningTemplate` because the day genuinely carries two:
   * Sam's pre-season Tuesday is *"Sprint first → Upper strength → authored hard
   * conditioning"*. Reusing the one slot displaced the hard session.
   *
   * **The specialist still names it.** `speedTemplateByName` is the same
   * authority the standalone sprint goes through; this module names no session.
   */
  readonly sprintTemplate: ConditioningTemplate | null;
  /** Strength-side only, and only where the scheduler marked the day eligible. */
  readonly powerPrimer: PowerPrimerSpec | null;
  /** Set when a specialist refused something the scheduler authorised. */
  readonly unmaterialised: UnmaterialisedReason | null;
  /** Actual specialist decisions made while materialising this authored day. */
  readonly selectionTraces: readonly AutomaticProgrammingSelectionTrace[];
}

export interface MaterialisationFacts {
  readonly weekStartISO: string;
  readonly miniCycleNumber?: number;
  readonly capacity: CapacityBand;
  readonly isBeginner: boolean;
  readonly experienced: boolean;
  readonly powerGoalNudge: boolean;
  readonly injuries: Parameters<typeof decidePowerPrimer>[0]['injuries'];
  readonly availableMachines?: readonly ConditioningModality[];
  readonly availableMachinesByDay?: Readonly<Partial<Record<number, readonly ConditioningModality[]>>>;
  readonly conditioningSelectionContext?: { readonly blockStartISO: string; readonly history: readonly BlockConditioningSelection[] };
  /** No erg access — the template must render on run or bodyweight. */
  readonly runOnly?: boolean;
  readonly phase: Parameters<typeof decidePowerPrimer>[0]['phase'];
  readonly offseasonSubphase?: Parameters<typeof decidePowerPrimer>[0]['offseasonSubphase'];
}

/** The power specialist's own vocabulary for what a strength day trains. */
const POWER_PATTERN_FOR_PURPOSE: Readonly<
  Record<SessionPurpose, NonNullable<Parameters<typeof decidePowerPrimer>[0]['strengthPattern']>>
> = {
  full_body: 'full_body',
  lower: 'lower_combined',
  lower_squat: 'lower',
  lower_hinge: 'lower',
  upper: 'upper_combined',
  upper_push: 'push',
  upper_pull: 'pull',
};

const WEEK_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 0];
const orderIndex = (day: number): number => WEEK_ORDER.indexOf(day);

export function materialiseAuthoredSessions(args: {
  readonly schedule: WeeklySchedule;
  readonly facts: MaterialisationFacts;
  readonly gameDay: number | null;
  readonly gameDays?: readonly number[];
}): MaterialisedSession[] {
  const { schedule, facts } = args;
  const gameDays = args.gameDays === undefined
    ? (args.gameDay === null ? [] : [args.gameDay])
    : args.gameDays;
  const hasGame = gameDays.length > 0;
  const seats = new Map<string, number>();
  const selectedThisWeek: BlockConditioningSelection[] = [];
  const selectionContext = () => facts.conditioningSelectionContext ? {
    ...facts.conditioningSelectionContext,
    history: [...facts.conditioningSelectionContext.history, ...selectedThisWeek],
  } : undefined;
  const remember = (category: AthleteConditioningCategory, seatIndex: number, template: ConditioningTemplate) => {
    if (facts.conditioningSelectionContext) selectedThisWeek.push({
      blockStartISO: facts.conditioningSelectionContext.blockStartISO,
      category, seatIndex, templateName: template.name,
    });
  };

  // ⚠ ONE ENTRY PER AUTHORISED DAY, IN THE SCHEDULER'S ORDER. `map`, never
  // `flatMap`, never `filter`, never a push into the result — the specialists
  // physically cannot change the shape of the week from in here.
  return schedule.days.map((intention): MaterialisedSession => {
    const selectionTraces: AutomaticProgrammingSelectionTrace[] = [];
    const gameOffset = gameDays.length === 0
      ? null
      : gameDays.map((gameDay) =>
          orderIndex(intention.dayOfWeek) - orderIndex(gameDay))
        .sort((left, right) => Math.abs(left) - Math.abs(right))[0];
    const traceContext = {
      weekStartISO: facts.weekStartISO,
      phase: String(facts.phase),
      experience: facts.isBeginner ? 'new' : facts.experienced ? 'experienced' : 'developing',
      injuries: facts.injuries.map((injury) => `${injury.area}:${injury.severity}`),
      daysToGame: gameOffset,
      equipment: [...(facts.availableMachinesByDay?.[intention.dayOfWeek] ?? facts.availableMachines ?? [])],
    };
    const base = {
      dateISO: intention.dateISO,
      dayOfWeek: intention.dayOfWeek,
      purpose: intention.purpose,
      owner: intention.owner,
      clubTraining: intention.clubTraining,
      game: intention.game,
      optional: intention.optional,
      // The off-leg preference is resolved against actual dated kit here;
      // the connector must not reintroduce the unresolved planner preference.
      conditioningOffFeet: intention.conditioning === 'off_leg'
        && (facts.availableMachinesByDay?.[intention.dayOfWeek] ?? facts.availableMachines)?.length !== 0,
      // R-130: copied, never decided — the day is not ours to repurpose.
      ...(intention.composedOptional
        ? { composedOptional: intention.composedOptional }
        : {}),
      clauseId: intention.clauseId,
    };

    // ── CONDITIONING: the scheduler named the category, the specialist picks ──
    let conditioningTemplate: ConditioningTemplate | null = null;
    let unmaterialised: UnmaterialisedReason | null = null;
    if (intention.conditioningCategory && intention.conditioningRole) {
      const seatIndex = seats.get(intention.conditioningCategory) ?? 0;
      seats.set(intention.conditioningCategory, seatIndex + 1);
      const availableMachines = facts.availableMachinesByDay?.[intention.dayOfWeek] ?? facts.availableMachines;
      try {
        const decision = selectConditioningTemplateWithTrace({
          category: intention.conditioningCategory as AthleteConditioningCategory,
          requestedSpeedQualities: intention.sprintQualities,
          dateStr: intention.dateISO,
          miniCycleNumber: facts.miniCycleNumber,
          seatIndex,
          selectionContext: selectionContext(),
          // §3 "Lower + conditioning: prefer off-leg work" — the scheduler already
          // decided that by choosing the category; this passes the same fact on.
          offFeet: base.conditioningOffFeet,
          runOnly: availableMachines?.length === 0 || facts.runOnly,
          availableMachines,
          noTeamTrainingWeek: schedule.days.every((day) => !day.clubTraining),
          role: intention.conditioningRole as ConditioningRole,
          traceContext,
        });
        conditioningTemplate = decision.template;
        selectionTraces.push(decision.trace);
        remember(intention.conditioningCategory as AthleteConditioningCategory, seatIndex, conditioningTemplate);
      } catch {
        // A SPECIALIST MAY REFUSE, AND THE DAY SURVIVES THE REFUSAL. It is
        // recorded with a typed reason rather than the session quietly vanishing,
        // which would be the specialist removing a session it does not own.
        unmaterialised = 'no_template_for_category_on_this_equipment';
      }
    }
    // WC-139 — the second component, chosen by the same specialist as the
    // standalone sprint so there is one sprint authority, not two.
    // ⚠ THE SPRINT CATEGORY SELECTOR, NOT A HARD-CODED NAME. `speedTemplateByName
    // ('Flying 30s')` silently resolved to `SPEED_FALLBACK_TEMPLATE` — the sheet
    // has no row of that name — so every athlete got the same fallback with no
    // rotation and no kit filter. The `sprint` category is the same pool the
    // standalone sprint draws from, so the two agree by construction.
    let sprintTemplate: ConditioningTemplate | null = null;
    if (intention.sprintComponent) {
      const seatIndex = seats.get('sprint') ?? 0;
      seats.set('sprint', seatIndex + 1);
      try {
        const decision = selectConditioningTemplateWithTrace({
          category: 'sprint',
          requestedSpeedQualities: intention.sprintQualities,
          dateStr: intention.dateISO,
          miniCycleNumber: facts.miniCycleNumber,
          seatIndex,
          selectionContext: selectionContext(),
          runOnly: facts.runOnly,
          availableMachines: facts.availableMachines,
          noTeamTrainingWeek: schedule.days.every((day) => !day.clubTraining),
          role: 'component',
          traceContext,
        });
        sprintTemplate = decision.template;
        selectionTraces.push(decision.trace);
        remember('sprint', seatIndex, sprintTemplate);
      } catch {
        unmaterialised = 'no_template_for_category_on_this_equipment';
      }
    }

    if (intention.conditioning === 'sprint_high_speed' && !conditioningTemplate && !intention.sprintQualities) {
      // The scheduler asked for sprint QUALITY; the specialist names the template.
      conditioningTemplate = speedTemplateByName('Flying 30s');
      unmaterialised = null;
    }

    // ── POWER: strength-side only, on a day the scheduler marked eligible ──
    //
    // **Sam, 2026-08-15: power is strength-side content, not a standalone
    // scheduling category.** It attaches to an already-authored strength session,
    // never creates or moves a day, and never counts as conditioning — which is
    // why this is gated on `owner === 'strength'` AND `powerEligible`, and why a
    // declined primer changes nothing about the day.
    let powerPrimer: PowerPrimerSpec | null = null;
    const gOffset = gameOffset ?? -99;
    if (intention.owner === 'strength' && intention.powerEligible && intention.purpose) {
      powerPrimer = decidePowerPrimer({
        phase: facts.phase,
        offseasonSubphase: facts.offseasonSubphase,
        strengthPattern: POWER_PATTERN_FOR_PURPOSE[intention.purpose],
        hasGame,
        gOffset,
        isTeamDay: intention.clubTraining,
        capacity: facts.capacity,
        isBeginner: facts.isBeginner,
        experienced: facts.experienced,
        injuries: facts.injuries,
        powerGoalNudge: facts.powerGoalNudge,
      });
    }
    // ⚠ THE SPECIALIST REFUSES IT TOO, EVEN IF ASKED — defence in depth.
    //
    // The scheduler no longer requests lower-body power on G-2, but a specialist
    // that would happily serve an illegal request is one caller away from serving
    // it again. §3 G-2: *"No heavy lower-body or added speed work."* A jump primer
    // is explosive lower-body work at ANY dose, so it is OMITTED — not moved to
    // another day, not converted to an upper primer.
    // ⚠ **LOWER ONLY** — Sam, 2026-08-15: *"should not rule out upper body
    // power"*. An upper primer on G-2 is legal as a component of the upper
    // strength session already authorised there, so the family check is the whole
    // rule and must not be widened to all power.
    if (powerPrimer && gOffset === -2 && powerPrimer.family === 'lower') {
      powerPrimer = null;
      unmaterialised = unmaterialised ?? 'power_refused_lower_body_on_g2';
    }

    return {
      ...base,
      conditioningTemplate,
      conditioningRole: conditioningTemplate
        ? (intention.conditioningRole as ConditioningRole) : null,
      sprintTemplate,
      powerPrimer,
      unmaterialised,
      selectionTraces,
    };
  });
}
