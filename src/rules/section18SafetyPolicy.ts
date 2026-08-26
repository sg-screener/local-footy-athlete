/**
 * Active safety projection for Section 18 Contract v2.
 *
 * Generation constraints are the typed source of truth. This module projects
 * them into the persisted contract without looking at whatever workout content
 * happened to survive. The post-canonical finaliser must conform to this
 * policy; it must never lower the policy to match unsafe output.
 */

import type { GenerationConstraintContext } from '../utils/generationConstraints';
import {
  canonicalWeeklyInjuryStateFrom,
  type CanonicalWeeklyInjuryPolicy,
} from './canonicalWeeklyInjuryState';
import { resolveRestrictedMainStrengthPatterns } from './weeklyExposureContractBuilders';
import type { MainStrengthPattern } from './strengthPatternContributions';
import {
  anchorAttendanceClaimsConditioning,
  refreshSection18SafetyPolicy,
  type AnchorParticipationState,
  type Section18AuthorisedReduction,
  type Section18ReductionMetric,
  type Section18SafetyDomain,
  type WeeklyExposureContractV2,
} from './weeklyExposureContractV2';
import type { WeeklyExposureReductionReason } from './weeklyExposureContract';

const PATTERNS: readonly MainStrengthPattern[] = ['squat', 'hinge', 'push', 'pull'];

function cloneContract(contract: WeeklyExposureContractV2): WeeklyExposureContractV2 {
  return JSON.parse(JSON.stringify(contract)) as WeeklyExposureContractV2;
}

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

function selectedMainStrengthTarget(contract: WeeklyExposureContractV2): number {
  return Math.max(
    contract.mainStrength.exposure.plannerSelectedTarget ??
      contract.mainStrength.exposure.defaultTarget,
    contract.mainStrength.optionalMainStrengthSelected,
  );
}

function addReduction(
  contract: WeeklyExposureContractV2,
  args: {
    metric: Section18ReductionMetric;
    reducedTarget: number;
    reason: WeeklyExposureReductionReason;
    scope?: Section18AuthorisedReduction['scope'];
    change?: Section18AuthorisedReduction['change'];
    detail: string;
  },
): void {
  const originalPolicy = args.metric === 'main_strength_frequency'
    ? contract.mainStrength.exposure
    : args.metric === 'conditioning_core_frequency'
      ? contract.conditioning.core
      : args.metric === 'sprint_high_speed_frequency'
        ? contract.sprintHighSpeed.exposure
        : null;
  const originalApprovedTarget = args.metric === 'main_strength_frequency'
    ? Math.max(args.reducedTarget, selectedMainStrengthTarget(contract))
    : args.metric === 'strength_pattern_count'
      ? PATTERNS.length
      : args.metric === 'power_primer_budget'
        ? Math.max(
            0,
            contract.power.plannerSelectedWeeklyBudget ?? contract.power.preferredWeeklyRange.max,
          )
        : Math.max(
            args.reducedTarget,
            originalPolicy?.plannerSelectedTarget ?? originalPolicy?.defaultTarget ?? args.reducedTarget,
          );
  const alreadyPresent = contract.authorisedReductions.some((entry) =>
    entry.metric === args.metric && entry.reason === args.reason &&
    entry.reducedTarget <= args.reducedTarget,
  );
  if (!alreadyPresent) {
    contract.authorisedReductions.push({
      metric: args.metric,
      originalApprovedTarget,
      reducedTarget: Math.max(0, args.reducedTarget),
      reason: args.reason,
      scope: args.scope ?? 'week',
      change: args.change ?? 'frequency',
      detail: args.detail,
      provenance: 'live_typed_reduction',
    });
  }
}

function effectiveFrequencyCeiling(
  contract: WeeklyExposureContractV2,
  metric: Section18ReductionMetric,
): number | null {
  const targets = contract.authorisedReductions
    .filter((entry) => entry.metric === metric && entry.change !== 'dose_intensity')
    .map((entry) => entry.reducedTarget);
  return targets.length > 0 ? Math.min(...targets) : null;
}

function applyReductionProjections(contract: WeeklyExposureContractV2): void {
  contract.mainStrength.reductions = contract.authorisedReductions.filter((entry) =>
    entry.metric === 'main_strength_frequency' || entry.metric === 'strength_pattern_count' ||
    entry.metric === 'session_intensity_percent' || entry.metric === 'session_volume');
  contract.conditioning.reductions = contract.authorisedReductions.filter((entry) =>
    entry.metric === 'conditioning_core_frequency');
  contract.sprintHighSpeed.reductions = contract.authorisedReductions.filter((entry) =>
    entry.metric === 'sprint_high_speed_frequency');

  const updatePolicy = (
    policy: WeeklyExposureContractV2['mainStrength']['exposure'],
    metric: Section18ReductionMetric,
  ) => {
    const ceiling = effectiveFrequencyCeiling(contract, metric);
    if (ceiling === null) return;
    policy.requiredMinimum = Math.min(policy.requiredMinimum, ceiling);
    policy.plannerSelectedTarget = policy.plannerSelectedTarget === null
      ? ceiling
      : Math.min(policy.plannerSelectedTarget, ceiling);
  };
  updatePolicy(contract.mainStrength.exposure, 'main_strength_frequency');
  updatePolicy(contract.conditioning.core, 'conditioning_core_frequency');
  updatePolicy(contract.sprintHighSpeed.exposure, 'sprint_high_speed_frequency');
}

function participationForConstraint(args: {
  existing: AnchorParticipationState;
  explicit: boolean;
  legacyUnknown: boolean;
  hasFieldRestriction: boolean;
  lowerBodyRestriction: boolean;
  readinessRestriction: boolean;
  deliveredHistory: boolean;
}): AnchorParticipationState {
  // Settled history: the anchor's day elapsed before the governed boundary.
  // What the athlete did there is a fact; a restriction authored later cannot
  // retroactively withdraw it.
  if (args.deliveredHistory) return args.existing;
  if (args.explicit && args.existing !== 'normal_unrestricted') return args.existing;
  if (args.legacyUnknown) return 'unknown';
  if (!args.hasFieldRestriction) {
    return args.explicit ? args.existing : 'normal_unrestricted';
  }
  if (args.lowerBodyRestriction || args.readinessRestriction) return 'reduced_running';
  return 'modified';
}

/**
 * Project a generation-time or live active-constraint context onto Contract
 * v2. Existing explicit modified participation and previously persisted
 * prohibitions are conservative: neither is ever upgraded by a later pass.
 */
export function applyGenerationSafetyToSection18Contract(args: {
  contract: WeeklyExposureContractV2;
  generationConstraints?: GenerationConstraintContext;
  injuryPolicy?: CanonicalWeeklyInjuryPolicy;
  forceFullPause?: boolean;
}): WeeklyExposureContractV2 {
  let contract = cloneContract(args.contract);
  const context = args.generationConstraints;
  const injuryPolicy = args.injuryPolicy ?? (context?.injuries.length
    ? canonicalWeeklyInjuryStateFrom({
        profile: { injuries: [] },
        generationConstraints: context,
      })
    : undefined);
  const derivedProhibited = resolveRestrictedMainStrengthPatterns({
    injuryPolicy,
  });
  const prohibited = unique([
    ...(contract.strengthPatterns.prohibitedPatterns ?? []),
    ...derivedProhibited,
  ]).filter((pattern): pattern is MainStrengthPattern => PATTERNS.includes(pattern));
  const availableSafePatterns = PATTERNS.filter((pattern) => !prohibited.includes(pattern));
  const selectedStrengthTarget = selectedMainStrengthTarget(contract);
  const requiredSafe = prohibited.length > 0 && selectedStrengthTarget > 0
    ? availableSafePatterns
    : contract.strengthPatterns.balanceExpectation === 'equal_or_near_equal'
      ? availableSafePatterns
      : contract.strengthPatterns.requiredSafePatterns.filter((pattern) =>
          !prohibited.includes(pattern));
  contract.strengthPatterns.prohibitedPatterns = prohibited;
  contract.strengthPatterns.requiredSafePatterns = requiredSafe;
  if (derivedProhibited.size > 0) {
    contract.strengthPatterns.prohibitedPatternProvenance = 'active_constraints';
  }

  const readiness = context?.readiness;
  // A sprint-only restriction may also cause the weekly power selector to
  // record a zero primer budget. Neither reduction means the athlete is
  // globally "cooked". Only strength, conditioning or session-dose
  // reductions may carry cooked-readiness ownership across validation passes.
  const persistedLowReadiness = contract.authorisedReductions.some((entry) =>
    entry.reason === 'low_readiness' && (
      entry.metric === 'main_strength_frequency' ||
      entry.metric === 'conditioning_core_frequency' ||
      entry.metric === 'session_intensity_percent' ||
      entry.metric === 'session_volume'
    ));
  const persistedAppSprintRestriction = contract.authorisedReductions.some((entry) =>
    entry.reason === 'low_readiness' && entry.metric === 'sprint_high_speed_frequency');
  // One question now: is readiness deloading this week?
  const cookedReadiness = readiness?.deloaded === true || persistedLowReadiness;
  // READINESS IS NO LONGER A SOURCE (Sam, 2026-07-27). The app never empties a
  // week on readiness alone — low readiness deloads instead. The capability
  // survives for the doors that genuinely pause training: serious injury
  // symptoms (via forceFullPause) and an explicit force. Adding readiness back
  // here would restore the full-pause tier under a different name.
  const trainingPaused = args.forceFullPause === true ||
    contract.safety?.trainingPaused === true;
  const lowerBodyRestriction = injuryPolicy?.blocksAppSprint === true ||
    prohibited.includes('squat') || prohibited.includes('hinge');
  const upperBodyRestriction = prohibited.includes('push') || prohibited.includes('pull');
  const significantReadinessRestriction = readiness?.deloaded === true ||
    cookedReadiness || trainingPaused;
  const readinessFieldRestriction = significantReadinessRestriction;
  // FIELD participation — what the athlete produces at team training and on game
  // day: conditioning, running, high-speed exposure. It is threatened by a
  // lower-body or back restriction, and by low readiness. It is NOT threatened by
  // an upper-body one: the Bible pauses the AFFECTED work, and a shoulder does
  // not stop someone running (:2131-2134, and the same shape per body area).
  //
  // Including `upperBodyRestriction` here demoted EVERY anchor to `modified` for
  // a shoulder injury, silently zeroing their conditioning and sprint production
  // claim — while no branch below ever authorises a conditioning reduction. The
  // contract then reached the §18 gate asserting both "these anchors no longer
  // produce conditioning" and "this week requires 3 conditioning exposures", so
  // it was unsatisfiable before the gate ran, and the single fact+week
  // transaction destroyed the athlete's injury report along with the week. That
  // is why NO injury from 6/10 up could be recorded, in any region.
  //
  // Sam's D10 ruling: the default never assumes an injury costs field
  // participation. Where it genuinely might, the athlete is ASKED (Stage 2b) and
  // the answer becomes a typed fact — an assumption is not a substitute for the
  // question. See Addendum A of the durable-athlete-state reassessment and
  // `docs/investigations/RIDER0_INJURY_AUTHORITY_AT_THE_GATE_2026-07-24.md`.
  //
  // NO injury region silently withdraws field participation (Sam's D10: the
  // default never assumes an injury costs the athlete their team training or
  // game; where it genuinely might, Stage 2b ASKS and records the answer).
  // The lower-body coupling that previously forced this is resolved: the
  // `sprint_high_speed_frequency <= 0` reduction and the
  // `prohibitedSprintHighSpeed` blocker both govern APP-PRESCRIBED work only
  // (delivered-vs-remaining ownership), so "the app prescribes no sprint to an
  // 8/10 knee" no longer asserts "the athlete's own Saturday game produced
  // nothing". The finaliser still strips app-authored speed blocks.
  //
  // READINESS NO LONGER WITHDRAWS FIELD PARTICIPATION (Sam, 2026-07-27).
  //
  // The clause this replaces justified itself in one breath: low readiness may
  // withdraw field participation "legitimately so: it authors matching
  // main-strength, conditioning and sprint reductions in the same pass, so its
  // contracts stay satisfiable." The readiness law DELETED exactly those
  // matching reductions — counts are structure — and this half of the bargain
  // was left standing alone.
  //
  // What remained was the D10 defect above, rebuilt from the readiness side:
  // the contract asserted both "the athlete's own game produced no sprint" and
  // "this week requires a sprint exposure", unsatisfiable before the gate ran,
  // so a deloaded week could not be committed at all.
  //
  // It is also the law itself. A deload changes dose and intensity inside the
  // sessions the app PRESCRIBES; team training and a game are neither dosed nor
  // prescribed by the app. Demoting them is the app inventing a fact about what
  // the athlete will do on Saturday — and that fact then removed the exposure
  // from the week's count, which is the identity/intensity conflation Sam's
  // ruling forbids.
  //
  // The capability survives where a medical stop genuinely owns it: an explicit
  // participation fact the athlete recorded, and a training pause.
  const hasFieldRestriction = trainingPaused;

  if (prohibited.length > 0) {
    addReduction(contract, {
      metric: 'strength_pattern_count',
      reducedTarget: requiredSafe.length,
      reason: 'injury_restriction',
      scope: 'pattern',
      detail: `Active injury policy prohibits ${prohibited.join(', ')} while preserving safe unaffected patterns.`,
    });
    // SUBSTITUTE BEFORE REDUCING FREQUENCY (Bible `:4755`, ruled 2026-08-06 in
    // `docs/FINDING_3_RULING_2026-08-06.md`).
    //
    // This used to cap the frequency at `requiredSafe.length` — the number of
    // surviving PATTERNS. Prohibit squat and hinge and the week could hold at
    // most two strength sessions, not because two is all the athlete can safely
    // do but because two patterns remain. Pattern count constrains VARIETY;
    // frequency is a different quantity, and every authored reduction at 6-7/10
    // is per-area or per-movement (`:1913-1917`, `:871`, `:923`, `:942`) — none
    // caps the week's session count.
    //
    // ONE OWNER IS PROVEN BY ENUMERATING THE SHAPES, never by the owner
    // existing. The same rule is also stated at
    // `weeklyExposureContractBuilders`' `main_strength` allocation cap, and
    // paying THIS site alone left the declared red at exactly the same 6 -> 5
    // (`docs/FINDING_3_BUILD_MEASUREMENT_2026-08-06.md` §1). Both moved together.
    //
    // The reduction survives where the Bible authors it: `:1913` at 8-10/10,
    // "pause affected training entirely… clearly unaffected work only". With no
    // safe pattern there is nothing to substitute, so the reduction is the
    // honest answer rather than an evasion of one.
    //
    // THE CONDITION IS `availableSafePatterns`, NOT `requiredSafe`, and the
    // difference is a defect the differential golden caught. `requiredSafe` is
    // `[]` whenever the MODE requires no strength — `weeklyExposureContractV2`
    // builds `requiredSafePatterns` as `policy.balance && policy.strength.required
    // > 0 ? … : []` — so an all-optional early off-season week has no required
    // safe patterns for reasons that have nothing to do with safety. Testing it
    // read that mode fact as a whole-body restriction and zeroed the frequency:
    // measured, the restricted early-off-season week's strength exposures went
    // 1 -> 0 while the healthy control kept 3, which is the very collapse Bible
    // `:72`/`:93` and this ruling forbid, and it would have shipped inside the
    // commit that fixes it. `availableSafePatterns` asks the question the ruling
    // asks: is ANY main pattern safe?
    if (availableSafePatterns.length === 0) {
      addReduction(contract, {
        metric: 'main_strength_frequency',
        reducedTarget: 0,
        reason: 'injury_restriction',
        detail: 'No main-strength pattern is safe, so there is nothing to substitute and the '
          + 'week carries no main strength.',
      });
    }
  }
  if (lowerBodyRestriction) {
    addReduction(contract, {
      metric: 'sprint_high_speed_frequency',
      reducedTarget: 0,
      reason: 'injury_restriction',
      detail: 'An active lower-body or back restriction removes sprint/high-speed exposure and anchor credit.',
    });
  }
  // READINESS MAKES NO COUNT REDUCTION (Sam's readiness law, 2026-07-27).
  //
  // Four graduated branches used to live here, cutting main strength to 2 or 0,
  // conditioning to 1 or 0, and sprint to 0 or anchor-credit, by tier. The law
  // abolishes that behaviour rather than rescaling it: "Readiness never REMOVES
  // sessions. The deload law's 'same week, same days' holds: session counts are
  // structure, and structure does not change." A deloaded week keeps its targets
  // and the sessions arrive smaller — the shrink is DELOAD_LAW's, applied to the
  // dose, and it is not a §18 frequency ceiling.
  //
  // Collapsing the tiers to one boolean and KEEPING the reductions is the trap
  // the law names, and it is what the first pass at this migration did: three
  // branches testing the same `readiness?.deloaded`, the last two unreachable,
  // still cutting counts. The whole block is deleted instead.
  //
  // What survives is TRAINING PAUSED — a §18 safety capability owned by injury
  // and the safety finaliser, never by readiness. That distinction is asserted:
  // a readiness input alone can never produce `trainingPaused`.
  if (trainingPaused) {
    for (const [metric, detail] of [
      ['main_strength_frequency', 'Paused training removes main-strength work.'],
      ['conditioning_core_frequency', 'Paused training removes core conditioning.'],
      ['sprint_high_speed_frequency', 'Paused training removes sprint/high-speed exposure.'],
    ] as const) {
      addReduction(contract, {
        metric,
        reducedTarget: 0,
        reason: 'full_pause',
        detail,
      });
    }
    // Power goes only with a genuine pause. THE DELOAD LAW keeps it otherwise:
    // "Power is not removed on a deload; a deload is not a reason to lose
    // sharpness" — which retired the cooked-readiness removal that stood here.
    addReduction(contract, {
      metric: 'power_primer_budget',
      reducedTarget: 0,
      reason: 'full_pause',
      detail: 'Paused training removes all formal power primers.',
    });
  }

  applyReductionProjections(contract);

  contract.anchors = contract.anchors.map((anchor) => {
    const deliveredHistory = anchor.participationProvenance === 'delivered_history';
    const participation = participationForConstraint({
      existing: anchor.participation,
      explicit: anchor.participationProvenance === 'explicit',
      legacyUnknown: anchor.participationProvenance !== 'explicit' &&
        !deliveredHistory && (
        contract.source === 'legacy_migration' ||
        anchor.participationProvenance === 'legacy_unknown' ||
        anchor.participationProvenance === 'healthy_legacy_assumption' ||
        anchor.participationProvenance === 'current_input_missing'
      ),
      hasFieldRestriction,
      lowerBodyRestriction,
      readinessRestriction: readinessFieldRestriction,
      deliveredHistory,
    });
    const normal = participation === 'normal_unrestricted';
    return {
      ...anchor,
      participation,
      participationProvenance: deliveredHistory
        ? 'delivered_history'
        : anchor.participationProvenance === 'explicit' &&
        participation === anchor.participation
        ? 'explicit'
        : participation === 'unknown'
          ? 'legacy_unknown'
          : hasFieldRestriction
          ? 'derived_active_constraint'
          : 'derived_healthy_unrestricted',
      currentProductionClaim: {
        // The conditioning claim follows ATTENDANCE; the other two are
        // intensity claims and stay behind full participation. Softening an
        // anchor is what a deload does, and it must not remove the session
        // from the week's count.
        conditioning: anchorAttendanceClaimsConditioning(participation),
        sprintHighSpeed: normal,
        hardDay: normal,
      },
    };
  });
  contract.migration.missingParticipationRemainsUnknown = contract.anchors.some(
    (anchor) => anchor.participation === 'unknown',
  );

  const prohibitedPowerFamilies: Array<'lower' | 'upper'> = unique([
    ...(contract.safety?.prohibitedPowerFamilies ?? []),
    ...(lowerBodyRestriction ? ['lower' as const] : []),
    ...(upperBodyRestriction ? ['upper' as const] : []),
  ]);
  // THE DELOAD LAW: "Power/speed: KEEP a small sharp dose ... Power is not
  // removed on a deload; a deload is not a reason to lose sharpness." Cooked
  // readiness, a deload week and the illness week are all DELOAD DOORS, so all
  // three stop removing power here. A bye recovery week is not a deload door and
  // keeps its removal; a genuine training pause still removes everything.
  const prohibitedPower = trainingPaused ||
    contract.identity.mode === 'in_season_bye_recovery' ||
    contract.power.eligible === false;
  if (prohibitedPower) {
    contract.power.eligible = false;
    contract.power.removalReason = trainingPaused
      ? 'full_pause'
      : cookedReadiness
        ? 'low_readiness'
        : contract.identity.mode === 'optional_week'
          ? 'optional_week_mode'
          : contract.identity.mode === 'in_season_bye_recovery'
            ? 'bye_recovery_mode'
            : contract.power.removalReason ?? 'deload_policy';
  }

  const affectedDomains: Section18SafetyDomain[] = [];
  if (prohibited.length > 0 || effectiveFrequencyCeiling(contract, 'main_strength_frequency') !== null) {
    affectedDomains.push('main_strength');
  }
  if (effectiveFrequencyCeiling(contract, 'conditioning_core_frequency') !== null) {
    affectedDomains.push('conditioning');
  }
  if (lowerBodyRestriction || readinessFieldRestriction || persistedAppSprintRestriction ||
      readiness?.deloaded) affectedDomains.push('sprint_high_speed');
  if (hasFieldRestriction) affectedDomains.push('anchor_participation');
  if (prohibitedPower || prohibitedPowerFamilies.length > 0) affectedDomains.push('power');
  if (cookedReadiness || contract.identity.mode === 'in_season_bye_recovery' ||
      contract.identity.mode === 'optional_week') {
    affectedDomains.push('session_dose');
  }

  contract = refreshSection18SafetyPolicy(contract, {
    cookedReadiness,
    // `prohibitedSprintHighSpeed` forces the week's high-speed ceiling to a hard
    // 0 — ALL exposure, including the athlete's own team-training and game
    // running (`weeklyExposureContractV2.ts:455`). That is true under a full
    // pause or a readiness restriction, both of which also withdraw anchor
    // participation, so the claim matches the week.
    //
    // It stays TRUE for a lower-body injury — the app must never prescribe a
    // speed session to a torn hamstring, and the finaliser strips speed content
    // on this flag. What changed is downstream: the flag no longer forces the
    // week's total high-speed ceiling to 0 by itself. The typed
    // `injury_restriction` reduction above carries the honest number
    // (`anchors.length`: no app sprint, the athlete's own game exposure intact),
    // and `buildSafetyPolicy` now reads it rather than assuming zero.
    // Readiness dropped out of this term. `significantReadinessRestriction` is
    // true for EVERY deloaded week, so leaving it here removed the week's sprint
    // exposure whenever the athlete reported being tired — a count reduction the
    // readiness law forbids. Injury and a genuine pause still remove sprint.
    prohibitedSprintHighSpeed: lowerBodyRestriction || trainingPaused,
    prohibitedPower,
    prohibitedPowerFamilies,
    affectedSafetyDomains: unique(affectedDomains),
    trainingPaused,
  });
  return contract;
}
