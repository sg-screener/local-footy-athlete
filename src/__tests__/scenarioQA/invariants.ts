/**
 * Weekly invariants — pure assertions over (profile, inputs, plan).
 *
 * Each invariant is a function that returns:
 *   - InvariantResult { passed, detail }   when it applies
 *   - null                                  when it doesn't apply to this scenario
 *
 * "Doesn't apply" lets you have one master invariant list — each rule
 * decides for itself whether the current week is in-scope (e.g. H-IS-3
 * only fires for in-season + game weeks).
 *
 * Coverage matrix (rule → memory file → engine site):
 *   H-IS-3       project_inseason_3exposure_priority.md       coachingEngine.ts ~389
 *   H-PRE-7/8/9  project_preseason_4exposure_priority.md      coachingEngine.ts pre-season branch
 *   H-PRE-10     project_preseason_sequence_priority.md       pre-season strength sequencing
 *   H-PRE-11     project_weekend_peak_and_field_load_cap.md   weekend peak swap
 *   H-PRE-12     project_weekend_peak_and_field_load_cap.md   max-3-field-load-days
 *   No-game Sat  project_unified_program_rebuild.md           in-season NO-game branch
 *   Adjacency    project_adjacency_constraint.md              max-2 same-region streak
 *   Team labels  project_preseason_team_day_and_core_streak.md universal team-day label pass
 */

import type { Invariant, InvariantContext } from './types';
import {
  classifyGenerationAdjacencyRegion as classifyRegion,
  type SessionAllocation,
} from '../../utils/coachingEngine';
import { strengthPatternLedger } from '../../rules/strengthPatternContributions';

const DAY_ORDER: ReadonlyArray<string> = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

function plannedPatterns(session: SessionAllocation) {
  return session.strengthIntent?.plannedPatterns ?? session.strengthPatternContributions ?? [];
}

const DAY_NUM: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

function sorted(plan: InvariantContext['plan']): SessionAllocation[] {
  return [...plan.weeklyPlan].sort(
    (a, b) => DAY_ORDER.indexOf(a.dayOfWeek || '') - DAY_ORDER.indexOf(b.dayOfWeek || ''),
  );
}

function coreCount(plan: InvariantContext['plan']): number {
  return plan.weeklyPlan.filter((s) => s.tier === 'core').length;
}

function hasSevereInjury(profile: InvariantContext['profile']): boolean {
  return (profile.injuries || []).some((i) => i.severity === 'Severe');
}

// ─────────────────────────────────────────────────────────────────
// Invariants
// ─────────────────────────────────────────────────────────────────

/**
 * SANITY: Every session in the plan has a valid focus + dayOfWeek.
 * Catches engine paths that emit empty focus strings (which then break
 * canonical naming downstream).
 */
export const sanity_focusAndDay: Invariant = ({ plan }) => {
  const broken: string[] = [];
  for (const s of plan.weeklyPlan) {
    if (!s.dayOfWeek) broken.push(`session with focus "${s.focus}" has no dayOfWeek`);
    if (!s.focus || s.focus.trim().length === 0) broken.push(`${s.dayOfWeek}: empty focus`);
  }
  return {
    rule: 'Every session has dayOfWeek + non-empty focus',
    passed: broken.length === 0,
    detail: broken.length === 0 ? `${plan.weeklyPlan.length} sessions OK` : broken.join('; '),
  };
};

/**
 * SANITY: core count is in [0..6].
 * Catches runaway core promotion or a missing core entirely.
 */
export const sanity_coreCountBounds: Invariant = ({ plan }) => {
  const c = coreCount(plan);
  return {
    rule: 'Core count in [0..6]',
    passed: c >= 0 && c <= 6,
    detail: `core=${c}`,
  };
};

/**
 * SANITY: At most ONE session per day.
 * Catches double-booking from add-passes that don't dedupe.
 */
export const sanity_oneSessionPerDay: Invariant = ({ plan }) => {
  const seen = new Map<string, number>();
  for (const s of plan.weeklyPlan) {
    if (!s.dayOfWeek) continue;
    seen.set(s.dayOfWeek, (seen.get(s.dayOfWeek) || 0) + 1);
  }
  const dupes = Array.from(seen.entries()).filter(([, n]) => n > 1);
  return {
    rule: 'At most one session per day',
    passed: dupes.length === 0,
    detail: dupes.length === 0
      ? 'no duplicates'
      : dupes.map(([d, n]) => `${d}×${n}`).join(', '),
  };
};

/**
 * SANITY: Team-day flag matches config.
 * Catches stale isTeamDay flags after cross-day swaps.
 */
export const sanity_teamDayFlag: Invariant = ({ profile, plan }) => {
  const configured = new Set(profile.teamTrainingDays || []);
  if (configured.size === 0) return null;
  const violations: string[] = [];
  for (const s of plan.weeklyPlan) {
    const onTeamDay = s.dayOfWeek ? configured.has(s.dayOfWeek as any) : false;
    const flagged = !!s.isTeamDay;
    if (onTeamDay && !flagged) violations.push(`${s.dayOfWeek} is team day, flag=false`);
    if (!onTeamDay && flagged) violations.push(`${s.dayOfWeek} not team day, flag=true (stale)`);
  }
  return {
    rule: 'isTeamDay flag matches config',
    passed: violations.length === 0,
    detail: violations.length === 0 ? 'all flags consistent' : violations.join('; '),
  };
};

/**
 * H-IS-3: Healthy in-season athlete with game + ≥2 team days + ≥5 days
 * must get 3 *strength exposures* — exactly 1 Lower + 1 Push + 1 Pull.
 *
 * Why measure strength exposures instead of total tier=core cells? The
 * universal team-day label pass promotes every team day to tier=core, so
 * a week with Tue/Thu team days can have up to 2 "bare" team cores on
 * top of the 3 strength cores (when the game isn't on Saturday and the
 * team days don't absorb a strength overlay). Counting tier=core was a
 * proxy that only held for Saturday games. The rule's true intent is:
 * Push and Pull are not dropped from budget math.
 *
 * Override only fires for low readiness or severe injury.
 */
export const inseason_3exposurePriority: Invariant = ({ profile, inputs, plan }) => {
  if (inputs.seasonPhase !== 'In-season') return null;
  if (!inputs.hasGame) return null;
  if ((inputs.teamTrainingDays || []).length < 2) return null;
  if (inputs.availableDays < 5) return null;
  if (plan.readiness === 'low') return null;
  if (hasSevereInjury(profile)) return null;

  const ledger = strengthPatternLedger(
    plan.weeklyPlan.filter((session) => session.tier === 'core'),
    'planned',
  );
  const ok = ledger.squat >= 1 && ledger.hinge >= 1 && ledger.push >= 1 && ledger.pull >= 1;
  return {
    rule: 'H-IS-3: healthy in-season → squat + hinge + push + pull',
    passed: ok,
    detail: ok
      ? `squat + hinge + push + pull ✓`
      : `squat=${ledger.squat}, hinge=${ledger.hinge}, push=${ledger.push}, pull=${ledger.pull}`,
  };
};

/**
 * H-IS in-season game weeks: G-1 must be arms/pump or recovery (no
 * heavy load 24h pre-game). Captain's run / walkthrough variants OK.
 */
export const inseason_g1ArmsOrRecovery: Invariant = ({ inputs, plan }) => {
  if (inputs.seasonPhase !== 'In-season') return null;
  if (!inputs.hasGame || !inputs.gameDay) return null;
  const gNum = DAY_NUM[inputs.gameDay];
  if (gNum === undefined) return null;
  const g1Name = Object.keys(DAY_NUM).find((d) => DAY_NUM[d] === (gNum + 6) % 7);
  if (!g1Name) return null;
  const g1 = plan.weeklyPlan.find((s) => s.dayOfWeek === g1Name);
  if (!g1) return null;
  const f = g1.focus.toLowerCase();
  const ok =
    f.includes('arm') || f.includes('pump') || f.includes('bicep') || f.includes('tricep') ||
    g1.tier === 'recovery' ||
    f.includes('captain') || f.includes('walkthrough');
  return {
    rule: 'G-1 = arms/pump or recovery (or captain\'s run)',
    passed: ok,
    detail: ok ? `${g1Name}: ${g1.focus.substring(0, 60)}` : `${g1Name}: "${g1.focus}" (heavy load too close to game)`,
  };
};

/**
 * No-game in-season weeks: Saturday must be an honest top-up when the athlete
 * is ready, or an honest recovery/support slot when readiness, injury or
 * deload state calls for the lighter bye shape.
 */
export const inseason_noGameSatPeak: Invariant = ({ inputs, plan }) => {
  if (inputs.seasonPhase !== 'In-season') return null;
  if (inputs.hasGame) return null;
  // Only check if Saturday is in selectedDays.
  if (!inputs.selectedDays.includes('Saturday')) return null;
  const sat = plan.weeklyPlan.find((s) => s.dayOfWeek === 'Saturday');
  if (!sat) {
    return {
      rule: 'NO-game in-season: Saturday = honest top-up or reset',
      passed: false,
      detail: 'Saturday is in selectedDays but missing from plan entirely',
    };
  }
  const isLowerStrengthTopUp =
    plannedPatterns(sat).some((pattern) => pattern === 'squat' || pattern === 'hinge');
  const isTypedConditioningTopUp =
    !!sat.conditioningCategory &&
    !!sat.conditioningFlavour &&
    (!sat.hasCombinedConditioning || sat.attachedConditioningKind === 'component');
  const isPeakLike = sat.tier === 'core' && (isLowerStrengthTopUp || isTypedConditioningTopUp);
  const readinessTier = inputs.generationConstraints?.readiness?.tier;
  const isLighterBye =
    plan.readiness === 'low' ||
    inputs.weekKind === 'deload' ||
    readinessTier === 'moderate_reduction' ||
    readinessTier === 'major_reduction' ||
    readinessTier === 'full_pause' ||
    (inputs.generationConstraints?.injuries ?? []).some((injury) =>
      injury.removeRiskyWork || injury.pauseAffectedTraining);
  const isLightReset =
    !sat.isHardExposure &&
    !sat.conditioningCategory &&
    !sat.conditioningFlavour &&
    (sat.tier === 'recovery' || sat.tier === 'optional');
  const passed = isLighterBye ? isLightReset : isPeakLike;
  return {
    rule: 'NO-game in-season: Saturday = honest top-up or reset',
    passed,
    detail: passed
      ? `Saturday: ${sat.focus.substring(0, 60)}`
      : `Saturday: [${sat.tier}] "${sat.focus}" (expected typed top-up or light reset)`,
  };
};

/**
 * H-PRE-7/8/9: Pre-season + ≥2 team days + no game + ≥5 days → preserve
 * all four strength movement-pattern exposures: squat, hinge, push and pull.
 * The preferred four-session shape is 2 lower + 2 upper. A typed L-co session
 * is equivalent lower-pattern coverage when team anchors and the hard-day
 * budget leave three strength slots: L-co covers squat + hinge, while two
 * upper sessions preserve push + pull. This remains inside the Bible's 2–4
 * pre-season strength-session range without forcing another soreness-heavy
 * lower day merely to satisfy a calendar-session count.
 *
 * Note: Sat may additionally be promoted to core for the H-PRE-11
 * conditioning peak — that's expected and does not count toward the
 * strength-pattern budget.
 *
 * Source of truth: `SessionAllocation.strengthIntent.plannedPatterns`.
 * We do not parse focus strings or collapse combined sessions to a primary.
 *
 * The invariant intentionally reads typed `lower_combined` coverage rather
 * than inferring dose from titles. It still fails genuinely soft weeks that
 * omit either lower-pattern coverage or either upper slot.
 */
export const preseason_4exposurePriority: Invariant = ({ profile, inputs, plan }) => {
  if (inputs.seasonPhase !== 'Pre-season') return null;
  if ((inputs.teamTrainingDays || []).length < 2) return null;
  if (inputs.hasGame) return null;
  if (inputs.availableDays < 5) return null;
  if (plan.readiness === 'low') return null;
  if (hasSevereInjury(profile)) return null;

  let lowerDedicated = 0, lowerCombined = 0, upper = 0;
  for (const s of plan.weeklyPlan) {
    if (s.tier !== 'core') continue;
    const patterns = plannedPatterns(s);
    const lowerCount = Number(patterns.includes('squat')) + Number(patterns.includes('hinge'));
    if (lowerCount >= 2) lowerCombined++;
    else if (lowerCount === 1) lowerDedicated++;
    if (patterns.includes('push') || patterns.includes('pull')) upper++;
  }
  const lower = lowerDedicated + lowerCombined;

  const standard = lowerDedicated === 2 && upper === 2;
  const combinedAlternative =
    lowerCombined >= 1 && lower >= 1 && upper === 2;
  const ok = standard || combinedAlternative;

  let detail: string;
  if (standard) {
    detail = `2L + 2U ✓`;
  } else if (combinedAlternative) {
    detail = `1×L-co (sq+hi) + 2U ✓ (four movement patterns across three strength sessions)`;
  } else {
    const lowerDesc =
      lowerCombined > 0
        ? `${lowerDedicated}L + ${lowerCombined}×L-co`
        : `${lowerDedicated}L`;
    detail = `${lowerDesc} + ${upper}U (expected 2L + 2U or equivalent 1×L-co + 2U pattern coverage)`;
  }

  return {
    rule: 'H-PRE-7/8/9: pre-season healthy → squat + hinge + 2 upper strength patterns',
    passed: ok,
    detail,
  };
};

/**
 * H-PRE-6: At core=3 in pre-season, balance is 1 Lower + 1 Upper + 1 FB.
 * NOT 2L+1U or 2U+1L.
 */
export const preseason_strengthBalance: Invariant = ({ inputs, plan }) => {
  if (inputs.seasonPhase !== 'Pre-season') return null;
  const cores = plan.weeklyPlan.filter((s) => s.tier === 'core');
  if (cores.length !== 3) return null;
  let lower = 0, upper = 0, fullBody = 0;
  for (const s of cores) {
    const r = classifyRegion(s);
    if (r === 'lower') lower++;
    else if (r === 'upper') upper++;
    else if (s.focus.toLowerCase().includes('full body')) fullBody++;
  }
  // Either 1L+1U+1FB OR (degenerate) 1L+2U / 2L+1U etc — only 1L+1U+1FB passes.
  const ok = lower === 1 && upper === 1 && fullBody === 1;
  return {
    rule: 'H-PRE-6: core=3 pre-season → 1L+1U+1FB',
    passed: ok,
    detail: ok ? `1L+1U+1FB ✓` : `${lower}L+${upper}U+${fullBody}FB`,
  };
};

/**
 * Region adjacency: max 2 consecutive same-region exposures.
 */
export const adjacency_max2SameRegion: Invariant = ({ plan }) => {
  const arr = sorted(plan);
  let maxRun = 1;
  let currentRun = 1;
  let currentRegion: Region = 'neutral';
  let prevDayIdx = -99;
  let worst = '';

  for (const s of arr) {
    const dayIdx = DAY_ORDER.indexOf(s.dayOfWeek || '');
    const region = classifyRegion(s);
    if (region !== 'neutral' && region === currentRegion && dayIdx - prevDayIdx === 1) {
      currentRun++;
    } else {
      currentRun = region !== 'neutral' ? 1 : 0;
      currentRegion = region;
    }
    if (currentRun > maxRun) {
      maxRun = currentRun;
      worst = `${currentRun}× ${currentRegion} ending ${s.dayOfWeek}`;
    }
    prevDayIdx = dayIdx;
  }

  return {
    rule: 'Max 2 consecutive same-region exposures',
    passed: maxRun <= 2,
    detail: maxRun <= 2 ? `max run: ${maxRun}` : `VIOLATION: ${worst}`,
  };
};

/**
 * Every configured team day MUST appear as a session in the generated plan.
 *
 * Team days are HARD calendar anchors — the club schedules them and the
 * engine doesn't get to silently drop one. The failure mode this catches
 * is the "phase-shift → new team day ∉ preferredTrainingDays" path: the
 * profile-overlay helper sets `teamTrainingDays` but leaves
 * `preferredTrainingDays` stale, so the scorer's daySlots never include
 * the new team day and the universal team-day label pass has nothing on
 * that dayNum to mark. The athlete sees "Rest" on a day that should have
 * been their team session.
 *
 * Also catches the latent adjacency-swap bug where Strategy 2 moves a
 * session off a team day because `isTeamDay` isn't set yet when the
 * adjacency pass runs.
 *
 * Sibling to `sanity_teamDayFlag` which only validates sessions that
 * exist — this one validates PRESENCE.
 */
export const teamDay_everyConfiguredDayHasSession: Invariant = ({ profile, plan }) => {
  const teamDays = (profile.teamTrainingDays || []) as string[];
  if (teamDays.length === 0) return null;
  const planDays = new Set(plan.weeklyPlan.map((s) => s.dayOfWeek));
  const missing = teamDays.filter((d) => !planDays.has(d));
  return {
    rule: 'Every configured team day has a session in the plan',
    passed: missing.length === 0,
    detail: missing.length === 0
      ? `${teamDays.length} team day(s) present`
      : `team day(s) missing from plan: ${missing.join(', ')}`,
  };
};

/**
 * Every plan session must land on a day the athlete actually opted into.
 *
 * `inputs.selectedDays` is the union of `preferredTrainingDays` and
 * `teamTrainingDays` — the canonical "days the athlete said they'll train".
 * A session on any OTHER day means the engine is fabricating exposure on
 * a day the user didn't choose, which is the exact failure mode caused by
 * stale profile state after a phase shift (e.g. `applyPhaseShift` forgets
 * to update `preferredTrainingDays`, so onboarding's old days leak into
 * the new plan).
 *
 * Sibling to `teamDay_everyConfiguredDayHasSession`: that one guards
 * "configured day MUST appear"; this one guards "non-selected day MUST
 * NOT appear".
 */
export const allSessions_inSelectedDays: Invariant = ({ inputs, plan }) => {
  const allowed = new Set(inputs.selectedDays);
  const rogue: string[] = [];
  for (const s of plan.weeklyPlan) {
    if (s.dayOfWeek && !allowed.has(s.dayOfWeek as any)) {
      rogue.push(`${s.dayOfWeek}: "${s.focus.substring(0, 40)}"`);
    }
  }
  return {
    rule: 'Every session lands on a day in selectedDays',
    passed: rogue.length === 0,
    detail: rogue.length === 0
      ? `all ${plan.weeklyPlan.length} session(s) on selected days`
      : `session(s) on non-selected day: ${rogue.join('; ')}`,
  };
};

/**
 * H5: Pre-season + team-day weeks must produce at least MIN_COND_FLOOR
 * conditioning exposures. The engine sets MIN_COND_FLOOR = 1 for
 * pre-season + team weeks (team training already covers the bulk of field
 * load); this invariant asserts that floor holds in the *output plan* so
 * we catch the failure mode where every conditioning slot got blocked by
 * team-day adjacency rules (H-PRE-1 / H-PRE-3 / H-PRE-7) and the
 * post-validation passes (H5a / H5b) couldn't retrofit one.
 *
 * Counts:
 *   - Standalone conditioning sessions (sessions with `conditioningCategory`
 *     set but no strength pattern — i.e. pure COND slots from the scorer
 *     OR ACC/REC slots promoted by H5b).
 *   - Combined S+C sessions (`hasCombinedConditioning === true`).
 *
 * Excludes:
 *   - Team training days. Team training contributes to field load, but
 *     the engine deliberately doesn't set conditioningCategory on team
 *     days (they're locked core slots). Counting team days here would
 *     mask the actual omission bug — Sam's report was that the gym week
 *     had no conditioning *outside* the team session.
 *
 * Floor (mirrors engine's MIN_COND_FLOOR):
 *   - Pre-season + team days → 1
 *   - Pre-season + no team days → 2
 *   - Other phases → not asserted here (in-season conditioning is
 *     covered by the phase-specific rules; off-season has its own
 *     budget that doesn't share this floor).
 *
 * Skipped for low readiness / severe injury so the safety rails don't
 * fail this assertion.
 */
export const preseason_conditioningFloor: Invariant = ({ profile, inputs, plan }) => {
  if (inputs.seasonPhase !== 'Pre-season') return null;
  if (plan.readiness === 'low') return null;
  if (hasSevereInjury(profile)) return null;

  const teamDayNames = new Set(profile.teamTrainingDays || []);
  const hasTeamDays = teamDayNames.size > 0;
  const floor = hasTeamDays ? 1 : 2;

  // Count only NON-team-day conditioning. Team training itself isn't
  // tagged with conditioningCategory in the plan and the report would
  // mislead if we ever changed that.
  let standalone = 0;
  let combined = 0;
  const sample: string[] = [];
  for (const s of plan.weeklyPlan) {
    const onTeamDay = s.dayOfWeek ? teamDayNames.has(s.dayOfWeek as any) : false;
    if (onTeamDay) continue;
    if (s.hasCombinedConditioning) {
      combined++;
      sample.push(`${s.dayOfWeek}: S+C ${s.conditioningCategory ?? '?'}`);
    } else if (s.conditioningCategory) {
      standalone++;
      sample.push(`${s.dayOfWeek}: COND ${s.conditioningCategory}`);
    }
  }
  const total = standalone + combined;
  const ok = total >= floor;
  return {
    rule: `H5: pre-season conditioning floor ≥ ${floor} (excluding team days)`,
    passed: ok,
    detail: ok
      ? `${total} conditioning session(s): ${sample.join('; ') || 'none recorded'}`
      : `only ${total} conditioning session(s) — expected ≥ ${floor}. team days: [${[...teamDayNames].join(', ') || 'none'}]; selectedDays: [${inputs.selectedDays.join(', ')}]`,
  };
};

/** Section 18 game-week app-conditioning remainder after genuine TT/game credit. */
export const inseason_minOneConditioningWhenSafe: Invariant = ({ profile, inputs, plan }) => {
  if (inputs.seasonPhase !== 'In-season') return null;
  if (!inputs.hasGame || !inputs.gameDay) return null;
  if ((inputs.teamTrainingDays || []).length > 2) return null;
  if (inputs.availableDays < 5) return null;
  if (plan.readiness !== 'high') return null;
  if (hasSevereInjury(profile)) return null;

  const gNum = DAY_NUM[inputs.gameDay];
  if (gNum === undefined) return null;
  const offsetOf = (dayName: string): number => {
    const dn = DAY_NUM[dayName];
    if (dn === undefined) return 99;
    let diff = dn - gNum;
    if (diff > 0) diff -= 7;
    if (diff === 0) return 0;
    if (diff === -6) return 1;
    return diff;
  };

  const expectedAppCore = Math.max(0, 2 - (inputs.teamTrainingDays || []).length);
  const appCore = plan.weeklyPlan.filter((session) =>
    !session.isTeamDay && (
      session.section18ConditioningRole === 'required_core' ||
      session.section18ConditioningRole === 'planner_selected_core'
    ));
  const placementSafe = appCore.every((session) =>
    !!session.dayOfWeek && offsetOf(session.dayOfWeek) <= -3);
  const ok = appCore.length === expectedAppCore && placementSafe;
  return {
    rule: 'In-season game week → app core equals 2 minus genuine TT credit',
    passed: ok,
    detail: `expected app core=${expectedAppCore}; actual=${appCore.map((session) =>
      `${session.dayOfWeek}:${session.conditioningCategory}:${session.section18ConditioningRole}`).join('; ') || 'none'}`,
  };
};

/**
 * 48h game-proximity guard: no conditioning cell may sit on G−2, G−1, or
 * G+1. Conditioning means typed `conditioningCategory` or `hasCombinedConditioning`.
 */
export const inseason_no48hConditioning: Invariant = ({ inputs, plan }) => {
  if (inputs.seasonPhase !== 'In-season') return null;
  if (!inputs.hasGame || !inputs.gameDay) return null;
  const gNum = DAY_NUM[inputs.gameDay];
  if (gNum === undefined) return null;
  const offsetOf = (dayName: string): number => {
    const dn = DAY_NUM[dayName];
    if (dn === undefined) return 99;
    let diff = dn - gNum;
    if (diff > 0) diff -= 7;
    if (diff === 0) return 0;
    if (diff === -6) return 1;
    return diff;
  };
  const violations: string[] = [];
  for (const s of plan.weeklyPlan) {
    if (!s.dayOfWeek) continue;
    if (!s.conditioningCategory && !s.hasCombinedConditioning) continue;
    const off = offsetOf(s.dayOfWeek);
    if (off === -2 || off === -1 || off === 1) {
      violations.push(`${s.dayOfWeek} (G${off >= 0 ? '+' : ''}${off})`);
    }
  }
  return {
    rule: 'No conditioning on G−2 / G−1 / G+1',
    passed: violations.length === 0,
    detail:
      violations.length === 0
        ? 'no proximity violations'
        : `conditioning placed inside 48h window: ${violations.join(', ')}`,
  };
};

/** Section 18 preserves hard/medium-hard top-up intensity and light optional flush identity. */
export const inseason_aerobicOnlyDuringGameWeek: Invariant = ({ inputs, plan }) => {
  if (inputs.seasonPhase !== 'In-season') return null;
  if (!inputs.hasGame) return null;
  const teamCount = (inputs.teamTrainingDays || []).length;
  const expectedAppCore = Math.max(0, 2 - teamCount);
  const core = plan.weeklyPlan.filter((session) =>
    !session.isTeamDay && (
      session.section18ConditioningRole === 'required_core' ||
      session.section18ConditioningRole === 'planner_selected_core'
    ));
  const violations: string[] = [];
  for (const session of core) {
    const category = session.conditioningCategory;
    const hard = category === 'vo2' || category === 'glycolytic' || category === 'sprint';
    const mediumHard = hard || category === 'tempo';
    if ((teamCount === 1 && !hard) || (teamCount === 0 && !mediumHard)) {
      violations.push(`${session.dayOfWeek}: ${category ?? 'none'}`);
    }
  }
  for (const session of plan.weeklyPlan) {
    if (session.section18ConditioningRole === 'optional_flush' &&
        session.conditioningCategory !== 'aerobic_base') {
      violations.push(`${session.dayOfWeek}: optional flush=${session.conditioningCategory ?? 'none'}`);
    }
  }
  return {
    rule: 'In-season game week → required top-up intensity remains hard/medium-hard',
    passed: core.length === expectedAppCore && violations.length === 0,
    detail:
      violations.length === 0 && core.length === expectedAppCore
        ? `app core=${core.length}; approved intensity retained`
        : `expected app core=${expectedAppCore}; actual=${core.length}; violations=${violations.join('; ') || 'none'}`,
  };
};

/**
 * In-season push/pull balance: every in-season week must carry at least
 * 1 push exposure and 1 pull exposure. A single full_body or upper_combined
 * session covers both. Source of truth: the typed planned-pattern ledger.
 *
 * Why an invariant alongside the engine pass: catches drift if anyone ever
 * adds a new in-season placement branch that emits one upper pattern only.
 * Mirrors the `enforceInSeasonPushPullBalance` pass — a regression here
 * means the safety net itself is broken.
 */
export const inseason_pushPullBalance: Invariant = ({ inputs, plan }) => {
  if (inputs.seasonPhase !== 'In-season') return null;
  const hasPush = plan.weeklyPlan.some((s) => plannedPatterns(s).includes('push'));
  const hasPull = plan.weeklyPlan.some((s) => plannedPatterns(s).includes('pull'));
  const ok = hasPush && hasPull;
  return {
    rule: 'In-season → ≥1 push exposure AND ≥1 pull exposure',
    passed: ok,
    detail: ok
      ? `push=${hasPush ? '✓' : '✗'} pull=${hasPull ? '✓' : '✗'}`
      : `push=${hasPush ? '✓' : '✗'} pull=${hasPull ? '✓' : '✗'} — patterns: ${plan.weeklyPlan
          .filter((s) => plannedPatterns(s).length > 0)
          .map((s) => `${s.dayOfWeek}:${plannedPatterns(s).join('+')}`)
          .join(', ') || 'none'}`,
  };
};

/**
 * Lower-body S+C must use a non-running modality during in-season game
 * weeks. Sam's S+C fallback rule: pairing aerobic running with squat/hinge
 * compounds running stress on legs that just took heavy load. Bike / rower
 * / ski erg delivers the same energy-system stimulus with much lower
 * soft-tissue load. The helper sets `ergModality='mixed'` on these cells.
 */
export const inseason_lowerSCNonRunning: Invariant = ({ inputs, plan }) => {
  if (inputs.seasonPhase !== 'In-season') return null;
  if (!inputs.hasGame) return null;
  const violations: string[] = [];
  for (const s of plan.weeklyPlan) {
    if (!s.hasCombinedConditioning) continue;
    const isLower = plannedPatterns(s).some(
      (pattern) => pattern === 'squat' || pattern === 'hinge',
    );
    if (!isLower) continue;
    if (!s.ergModality) {
      violations.push(`${s.dayOfWeek}: lower S+C without ergModality`);
    }
  }
  return {
    rule: 'In-season lower-body S+C → ergModality (non-running) required',
    passed: violations.length === 0,
    detail:
      violations.length === 0
        ? 'all lower S+C cells use non-running modality (or none exist)'
        : violations.join('; '),
  };
};

/**
 * Team day label: every team day must lead its focus with "Team training"
 * (the universal team-day label pass should have wrapped it).
 */
export const teamDay_universalLabel: Invariant = ({ profile, plan }) => {
  const teamDays = new Set(profile.teamTrainingDays || []);
  if (teamDays.size === 0) return null;
  const missing: string[] = [];
  for (const s of plan.weeklyPlan) {
    if (!s.dayOfWeek || !teamDays.has(s.dayOfWeek as any)) continue;
    const f = s.focus.toLowerCase();
    if (!f.includes('team training') && !f.includes("captain") && !f.includes('walkthrough')) {
      missing.push(`${s.dayOfWeek}: "${s.focus.substring(0, 50)}"`);
    }
  }
  return {
    rule: 'Team days lead focus with "Team training"',
    passed: missing.length === 0,
    detail: missing.length === 0 ? 'all team days labelled' : missing.join('; '),
  };
};

// ─────────────────────────────────────────────────────────────────
// Standard invariant set (used by default)
// ─────────────────────────────────────────────────────────────────

export const STANDARD_INVARIANTS: Invariant[] = [
  sanity_focusAndDay,
  sanity_coreCountBounds,
  sanity_oneSessionPerDay,
  sanity_teamDayFlag,
  teamDay_everyConfiguredDayHasSession,
  allSessions_inSelectedDays,
  inseason_3exposurePriority,
  inseason_g1ArmsOrRecovery,
  inseason_noGameSatPeak,
  inseason_minOneConditioningWhenSafe,
  inseason_no48hConditioning,
  inseason_aerobicOnlyDuringGameWeek,
  inseason_lowerSCNonRunning,
  inseason_pushPullBalance,
  preseason_4exposurePriority,
  preseason_strengthBalance,
  preseason_conditioningFloor,
  adjacency_max2SameRegion,
  teamDay_universalLabel,
];

/**
 * Sanity-only invariant set used by the combinatorial sweep.
 * The full set has scenario-specific rules that don't generalise; the
 * sweep needs noisy combos to pass-or-fail on shape, not on policy.
 *
 * `teamDay_everyConfiguredDayHasSession` is included here because it's
 * a structural sanity check (presence, not policy) — a team day silently
 * dropped from the plan is always a bug, regardless of phase/readiness.
 */
export const SANITY_INVARIANTS: Invariant[] = [
  sanity_focusAndDay,
  sanity_coreCountBounds,
  sanity_oneSessionPerDay,
  sanity_teamDayFlag,
  teamDay_everyConfiguredDayHasSession,
  allSessions_inSelectedDays,
];
