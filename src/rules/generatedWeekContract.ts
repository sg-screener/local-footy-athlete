/**
 * THE GENERATED-WEEK CONTRACT — what a generated week must contain, stated once.
 *
 * ## Why this file exists
 *
 * Before it, **§18's input contract was undeclared**. Nothing said what a week
 * had to CARRY to be judged, so the only reliable way to produce an acceptable
 * week was to have been built by the legacy builder — because acceptance
 * depended on residue that builder left behind as a by-product of building
 * (evidence stamping, planner-derived provenance, conditioning promotion, power
 * alignment, tier normalisation). A composed week whose days and rows were
 * byte-for-byte identical to an accepted week was still refused
 * (`a8b65151`), and three separate attempts to reproduce the residue each made
 * the sweep worse (49/131, 42/138, 32/148).
 *
 * **THE DIAGNOSIS IN THAT COMMIT WAS WRONG, AND MEASURING IT IS WHAT MADE THIS
 * FILE POSSIBLE.** It blamed `workout.section18Evidence` being null instead of
 * `{conditioningRole:'none', ...}`. Measured 2026-08-14, those two are
 * PROVABLY EQUIVALENT at `section18EffectiveWeekEvaluator.ts:317-318` — both
 * return `null` from `conditioningPresence` — and the envelope's `provenance`
 * field has **zero readers anywhere in the repo**. The real difference was
 * `workout.speedBlock`, which is the sole app sprint credit
 * (`section18EffectiveWeekEvaluator.ts:670`) and which the composed
 * materialiser never emitted. **Three sessions chased an inert stamp.**
 *
 * ## What this contract is, and is not
 *
 * It is a TYPED PROJECTION of authority that already exists — the phase table
 * in `weeklyExposureContractV2` and the safety policy — restated as clauses
 * that name what the WEEK must contain. **It invents no numbers.** Every clause
 * carries its `authority`, and the type makes that mandatory: a clause with no
 * Bible section and no R-number cannot be constructed.
 *
 * It is NOT a second authority. Where a number lives in the phase table, this
 * contract carries that number by reference, so changing the table changes the
 * contract and there is nothing to keep in step by hand.
 *
 * ## What was DROPPED as residue, and why
 *
 * Each of these was read by the old acceptance path and encodes no coaching
 * rule. They are absent from this contract deliberately:
 *
 * - `workout.section18Evidence.provenance` — no reader anywhere.
 * - `conditioningRole: 'none'` versus an absent envelope — provably identical.
 * - `conditioningStress` on a day with no conditioning — never read.
 * - the `strengthIntent` legacy pattern fallback — a shim for weeks stored
 *   before rows carried roles; it re-reads planner intent because the rows were
 *   never stamped.
 * - row POSITION feeding row identity — the counting module's own header says
 *   this contradicts Sam's ruling that intensity and volume never feed identity.
 * - day-stress inference from `workout.name` — text inference over typed facts.
 * - `legacyReportedFullRestCount` — a migration cross-check; generation never
 *   passes it.
 * - `enforcement: 'observe_only'` — a stale marker from when §18 observed.
 *
 * **Dropping them is what makes the contract satisfiable by construction rather
 * than by having been built a particular way.**
 */
import type { MainStrengthPattern } from './strengthPatternContributions';
import type { WeeklyExposureContractV2 } from './weeklyExposureContractV2';

/**
 * WHERE A CLAUSE GETS ITS RIGHT TO REFUSE A WEEK.
 *
 * A Bible section reference or a registry R-number, and nothing else. This is
 * the whole enforcement of "every coaching or safety clause cites an existing
 * authority": there is no `'none'` member and no free string, so an unauthorised
 * clause is a compile error rather than a review question.
 */
export type ClauseAuthority =
  | { readonly kind: 'bible'; readonly section: string; readonly quote: string }
  | { readonly kind: 'ruling'; readonly ruling: `R-${string}`; readonly quote: string };

export type GeneratedWeekClauseId =
  | 'main_strength_required_minimum'
  | 'main_strength_planner_selected_target'
  | 'main_strength_permitted_maximum'
  | 'required_safe_patterns_present'
  | 'pattern_balance'
  | 'prohibited_patterns_absent'
  | 'core_conditioning_required_minimum'
  | 'sprint_high_speed_required_minimum'
  | 'full_rest_required_minimum'
  | 'hard_day_permitted_maximum'
  | 'training_paused_means_no_training'
  | 'prohibited_power_absent'
  | 'prohibited_sprint_absent'
  | 'row_role_is_declared';

export interface GeneratedWeekClause {
  readonly id: GeneratedWeekClauseId;
  /** One sentence, in the terms of the WEEK — never in the terms of a builder. */
  readonly requirement: string;
  readonly authority: ClauseAuthority;
  /**
   * A clause the week may FAIL without being refused, disclosing a typed gap
   * instead. Used where the requirement is unachievable for a stated, typed
   * reason (kit, injury) rather than by a fault in composition.
   */
  readonly disclosable: boolean;
}

/** The numbers, carried by reference from the phase table. Never re-authored. */
export interface GeneratedWeekTargets {
  readonly mainStrengthRequiredMinimum: number;
  readonly mainStrengthPlannerSelectedTarget: number | null;
  readonly mainStrengthPermittedMaximum: number | null;
  readonly coreConditioningRequiredMinimum: number;
  /** The planner's own core-conditioning selection, when it made one. */
  readonly coreConditioningPlannerTarget: number | null;
  readonly sprintHighSpeedRequiredMinimum: number;
  readonly fullRestRequiredMinimum: number;
  readonly hardDayPermittedMaximum: number;
  readonly requiredSafePatterns: readonly MainStrengthPattern[];
  readonly prohibitedPatterns: readonly MainStrengthPattern[];
  readonly weeklyMainSeatCeilingExpected: boolean;
  readonly trainingPaused: boolean;
  readonly prohibitedSprintHighSpeed: boolean;
  readonly prohibitedPowerFamilies: readonly string[];
}

export interface GeneratedWeekContract {
  readonly protocolVersion: 1;
  readonly clauses: readonly GeneratedWeekClause[];
  readonly targets: GeneratedWeekTargets;
  /**
   * Patterns this athlete's kit cannot train at all, already removed from
   * `requiredSafePatterns` upstream. Carried so a gap can name its cause.
   */
  readonly kitUnachievablePatterns: readonly MainStrengthPattern[];
}

/**
 * THE CLAUSE SET. One entry per rule a generated week answers to.
 *
 * Every `authority` below was verified present at 2026-08-14 by reading the
 * Bible section or the registry row it names.
 */
export const GENERATED_WEEK_CLAUSES: readonly GeneratedWeekClause[] = [
  {
    id: 'main_strength_required_minimum',
    requirement:
      'The week carries at least the required minimum number of main-strength '
      + 'sessions for its phase and mode.',
    authority: {
      kind: 'bible',
      section: 'Section 18 A / B — authoritative phase table',
      quote: 'Required minimum | The minimum core exposure frequency for the mode.',
    },
    disclosable: false,
  },
  {
    id: 'main_strength_planner_selected_target',
    requirement:
      "The week meets the planner's own selected main-strength target when that "
      + 'target is a core selection.',
    authority: {
      kind: 'bible',
      section: 'Section 18 A — phase-owned selected target',
      quote:
        'The exposure target chosen from the canonical phase/mode table after typed '
        + 'constraints and before weekday allocation.',
    },
    disclosable: false,
  },
  {
    id: 'main_strength_permitted_maximum',
    requirement: 'The week does not exceed the permitted main-strength maximum.',
    authority: {
      kind: 'bible',
      section: 'Section 18 A — maximum',
      quote: 'Maximum | The normal programmed ceiling. It is not a target.',
    },
    disclosable: false,
  },
  {
    id: 'required_safe_patterns_present',
    requirement:
      'Every required safe pattern appears as at least one declared main lift '
      + 'somewhere in the week.',
    authority: {
      kind: 'bible',
      section: 'Section 18 D — strength-pattern rules',
      quote:
        'Default to push, pull, squat and hinge in every healthy pre-season, '
        + 'mid/late off-season and in-season week.',
    },
    // R-083: a pattern the KIT cannot train is not owed. The gap is disclosed
    // with its cause rather than refused as a composition fault.
    disclosable: true,
  },
  {
    id: 'pattern_balance',
    requirement:
      'Each automatic weekly main squat, hinge, horizontal/vertical push and '
      + 'horizontal/vertical pull seat is spent at most once.',
    authority: {
      kind: 'bible',
      section: 'Section 18 D — strength-pattern rules',
      quote:
        'These are weekly allowances—not requirements to repeat inside every '
        + 'compatible session.',
    },
    disclosable: true,
  },
  {
    id: 'prohibited_patterns_absent',
    requirement: 'No prohibited pattern appears as a main lift on any governed day.',
    authority: {
      kind: 'bible',
      section: 'Section 18 E — injury',
      quote: 'Remove prohibited affected patterns and sprint work.',
    },
    disclosable: false,
  },
  {
    id: 'core_conditioning_required_minimum',
    requirement:
      'The week carries at least the required minimum of core conditioning '
      + 'exposures, counting genuine anchor credit first.',
    authority: {
      kind: 'bible',
      section: 'Section 18 C — anchor credit and app top-ups',
      quote: 'Add only the remaining requirement after genuine anchor credit.',
    },
    disclosable: false,
  },
  {
    id: 'sprint_high_speed_required_minimum',
    requirement:
      'The week carries at least the required minimum number of sprint / '
      + 'high-speed NIGHTS, counting a night once however many efforts it holds.',
    authority: {
      kind: 'ruling',
      ruling: 'R-079',
      quote: 'yes we do nights - in season that may mean 3 sprint sessions',
    },
    disclosable: false,
  },
  {
    id: 'full_rest_required_minimum',
    requirement: 'The week leaves at least the required number of days on which nothing is required.',
    authority: {
      kind: 'bible',
      section: 'Section 18 G — rest quota',
      quote: 'The rest quota counts days on which nothing was REQUIRED of the athlete.',
    },
    disclosable: false,
  },
  {
    id: 'hard_day_permitted_maximum',
    requirement: 'The week does not exceed the permitted number of hard DAYS.',
    authority: {
      kind: 'bible',
      section: 'Section 18 G — hard-day policy',
      quote: 'Hard day budget: PREFER 4 hard days, PERMIT 5. The unit is DAYS, not sessions.',
    },
    disclosable: false,
  },
  {
    id: 'training_paused_means_no_training',
    requirement: 'When training is paused, the week requires nothing of the athlete.',
    authority: {
      kind: 'bible',
      section: 'Section 18 E — full pause or red flag',
      quote: 'No training.',
    },
    disclosable: false,
  },
  {
    id: 'prohibited_power_absent',
    requirement: 'No power primer of a prohibited family survives in the week.',
    authority: {
      kind: 'bible',
      section: 'Section 18 E / F — low or cooked readiness',
      quote: 'Remove power primers.',
    },
    disclosable: false,
  },
  {
    id: 'prohibited_sprint_absent',
    requirement: 'No app-prescribed sprint work survives when sprint work is prohibited.',
    authority: {
      kind: 'bible',
      section: 'Section 18 E — injury',
      quote: 'Remove prohibited affected patterns and sprint work.',
    },
    disclosable: false,
  },
  {
    id: 'row_role_is_declared',
    requirement:
      'Every strength row states its own role and pattern; the week is judged on '
      + 'what its rows declare, never on what their names imply.',
    authority: {
      kind: 'ruling',
      ruling: 'R-092',
      quote:
        'i think any push pull hinge squat single leg knee single leg hip should be '
        + 'counted as a main lift',
    },
    disclosable: false,
  },
];

/**
 * Project the authority already in force onto the generated-week contract.
 *
 * **BY REFERENCE, NOT BY COPY.** Every number here is read out of the Contract
 * v2 the phase table produced. This function chooses nothing.
 */
export function generatedWeekContractFrom(
  contract: WeeklyExposureContractV2,
  kitUnachievablePatterns: readonly MainStrengthPattern[] = [],
): GeneratedWeekContract {
  return {
    protocolVersion: 1,
    clauses: GENERATED_WEEK_CLAUSES,
    kitUnachievablePatterns,
    targets: {
      mainStrengthRequiredMinimum: contract.mainStrength.exposure.requiredMinimum,
      mainStrengthPlannerSelectedTarget:
        contract.mainStrength.exposure.plannerSelectionKind === 'core'
          ? contract.mainStrength.exposure.plannerSelectedTarget
          : null,
      mainStrengthPermittedMaximum: contract.mainStrength.exposure.permittedMaximum,
      coreConditioningRequiredMinimum: contract.conditioning.core.requiredMinimum,
      coreConditioningPlannerTarget: contract.conditioning.core.plannerSelectedTarget,
      sprintHighSpeedRequiredMinimum: contract.sprintHighSpeed.exposure.requiredMinimum,
      fullRestRequiredMinimum: contract.restStress.requiredFullRestMinimum,
      hardDayPermittedMaximum: contract.restStress.permittedHardDayMaximum,
      requiredSafePatterns: contract.strengthPatterns.requiredSafePatterns,
      prohibitedPatterns: contract.strengthPatterns.prohibitedPatterns,
      // Automatic generation always answers to R-317's one-seat ceiling. This
      // is deliberately independent of the retired equal-count setting carried
      // by older stored contracts at ingress.
      weeklyMainSeatCeilingExpected: true,
      trainingPaused: contract.safety.trainingPaused,
      prohibitedSprintHighSpeed: contract.safety.prohibitedSprintHighSpeed,
      prohibitedPowerFamilies: contract.safety.prohibitedPowerFamilies,
    },
  };
}

/** The clause→authority table, DERIVED. Never hand-written beside the code. */
export function clauseAuthorityTable(): readonly {
  id: GeneratedWeekClauseId; requirement: string; authority: string; quote: string;
}[] {
  return GENERATED_WEEK_CLAUSES.map((clause) => ({
    id: clause.id,
    requirement: clause.requirement,
    authority: clause.authority.kind === 'bible'
      ? `Bible ${clause.authority.section}`
      : clause.authority.ruling,
    quote: clause.authority.quote,
  }));
}
