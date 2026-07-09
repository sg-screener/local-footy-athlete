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
import type { SessionAllocation } from '../../utils/coachingEngine';

const DAY_ORDER: ReadonlyArray<string> = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

const DAY_NUM: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

// ─────────────────────────────────────────────────────────────────
// Region classification (mirrors weekPlanQA.ts)
// ─────────────────────────────────────────────────────────────────

type Region = 'upper' | 'lower' | 'neutral';

/**
 * Classify a session's *strength exposure* — returns the specific movement
 * pattern it loads, or null if the session isn't a strength core.
 *
 * Source of truth: `SessionAllocation.strengthPattern`, populated by the
 * engine at every intentional strength-placement site. We deliberately
 * do NOT parse the `focus` string here — doing so conflated "tier = core"
 * with "strength exposure", because the universal team-day label pass
 * promotes every team day to `tier: 'core'` (captain's run, post-game
 * recovery) even though those days carry no strength stimulus.
 *
 * Mapping:
 *   'lower'           → 'lower'
 *   'lower_combined'  → reported as 'lower' (L-co covers BOTH squat + hinge;
 *                       callers that need to recognise the combined-coverage
 *                       case — H-PRE-7/8/9 in particular — read
 *                       strengthPattern directly to detect L-co)
 *   'push'            → 'push'
 *   'pull'            → 'pull'
 *   'upper_combined'  → reported as 'push' (covers push pattern — callers
 *                       treat U-co as covering BOTH push and pull; see
 *                       H-IS-3 invariant which also awards a pull below)
 *   'full_body'       → reported as 'lower' (covers lower — full body
 *                       additionally covers push + pull; invariants that
 *                       need push/pull credit from FB handle it directly)
 *
 * The H-IS-3 invariant (1L + 1push + 1pull) tolerates FB / U-co via
 * explicit handling in its body, not here.
 */
function classifyStrengthExposure(s: SessionAllocation): 'lower' | 'push' | 'pull' | null {
  if (s.tier !== 'core') return null;
  switch (s.strengthPattern) {
    case 'lower': return 'lower';
    case 'lower_combined': return 'lower';
    case 'push': return 'push';
    case 'pull': return 'pull';
    // U-co / FB coverage semantics are handled by individual invariants
    // that check strengthPattern directly; this helper returns the
    // *primary* pattern for the narrow 1L/1push/1pull counter.
    case 'upper_combined': return 'push';
    case 'full_body': return 'lower';
    default: return null;
  }
}

function classifyRegion(s: SessionAllocation): Region {
  const focus = (s.focus || '').toLowerCase();
  if (s.tier === 'recovery') return 'neutral';

  // Low-fatigue accessory work spans both regions (trunk, calves, groin,
  // shoulder prehab) and is intentionally region-NEUTRAL — it must not
  // trip the "max 2 consecutive same-region" guard. Mirrors the engine's
  // classifyFocusRegion (coachingEngine.ts ~line 3446) so invariants and
  // the runtime adjacency pass agree on what counts as a region exposure.
  if (focus.startsWith('low-fatigue accessor')) return 'neutral';

  // Strong region signals come FIRST — engine often produces strings like
  // "Hip-dominant lower (...) + tempo conditioning finisher" where the
  // primary stimulus is lower body and conditioning is just a finisher.
  // Classify by primary stimulus, not by the presence of a finisher tag.
  if (
    focus.includes('lower body') ||
    focus.includes('lower (') ||
    focus.includes('squat') ||
    focus.includes('hinge') ||
    focus.includes('hip-dominant') ||
    focus.includes('quad-dominant') ||
    focus.includes('leg') ||
    focus.includes('rdl') ||
    focus.includes('hip thrust')
  ) return 'lower';

  if (
    focus.includes('upper body') ||
    focus.includes('upper (') ||
    focus.includes('pull') ||
    focus.includes('push') ||
    focus.includes('arm') ||
    focus.includes('pump') ||
    focus.includes('bicep') ||
    focus.includes('tricep') ||
    focus.includes('accessor') ||
    focus.includes('prehab') ||
    focus.includes('trunk') ||
    focus.includes('shoulder') ||
    focus.includes('hypertrophy')
  ) return 'upper';

  // Only after region checks fail do we fall through to neutral signals.
  if (focus.includes('full body')) return 'neutral';
  if (focus.includes('conditioning') || focus.includes('aerobic')) return 'neutral';
  if (focus.includes('game') || focus.includes('sprint') || focus.includes('mas ') || focus.includes('metcon')) return 'neutral';
  if (focus.includes('flush') || focus.includes('easy ') || focus.includes('tempo')) return 'neutral';
  if (focus.includes('flog') || focus.includes('circuit')) return 'neutral';
  if (focus.includes('mobility') || focus.includes('foam') || focus.includes('recovery') || focus.includes('rest')) return 'neutral';
  return 'neutral';
}

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

  let lower = 0, push = 0, pull = 0;
  for (const s of plan.weeklyPlan) {
    const ex = classifyStrengthExposure(s);
    if (ex === 'lower') lower++;
    else if (ex === 'push') push++;
    else if (ex === 'pull') pull++;
  }
  const ok = lower === 1 && push === 1 && pull === 1;
  return {
    rule: 'H-IS-3: healthy in-season → 1 Lower + 1 Push + 1 Pull',
    passed: ok,
    detail: ok
      ? `1L + 1push + 1pull ✓`
      : `${lower}L + ${push}push + ${pull}pull (expected 1+1+1 — a strength pattern is missing or doubled)`,
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
    sat.strengthPattern === 'lower' &&
    sat.focus.toLowerCase().includes('lower');
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
 * H-PRE-7/8/9: Pre-season + ≥2 team days + no game + ≥5 days → target
 * 4 strength-pattern exposures spread as 2 lower + 2 upper *strength*
 * cores. Note: Sat may additionally be promoted to core for the H-PRE-11
 * conditioning peak — that's expected and does not count toward the
 * L/U strength budget.
 *
 * Source of truth: `SessionAllocation.strengthPattern` (typed engine
 * field). We do NOT parse focus strings — see project memory
 * "Engine carries explicit semantic metadata".
 *
 * Combined-coverage exception (back-to-back team days):
 *   When the two team days are *calendar-consecutive* (e.g. Thu+Fri),
 *   they pin two adjacent late-week slots as locked cores. With a
 *   typical 6-day available block, H3's "no two dedicated lowers
 *   within a 1-day gap" rule + H1's "no 3+ consecutive strength
 *   sessions" + H-PRE-12's field-load streak cap make 2 dedicated
 *   lower sessions geometrically infeasible. The engine resolves this
 *   by emitting one L-co session (`strengthPattern: 'lower_combined'`)
 *   that covers BOTH squat and hinge sub-patterns at moderate dose —
 *   yielding 4 pattern exposures (squat + hinge + push + pull) from
 *   3 calendar slots. We accept that as equivalent coverage.
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
    switch (s.strengthPattern) {
      case 'lower': lowerDedicated++; break;
      case 'lower_combined': lowerCombined++; break;
      case 'push':
      case 'pull':
      case 'upper_combined': upper++; break;
      // 'full_body' is a single slot covering all patterns; counted
      // toward both lower and upper exposure for this invariant.
      case 'full_body': lowerDedicated++; upper++; break;
      default: break;
    }
  }
  const lower = lowerDedicated + lowerCombined;

  // Calendar-consecutive team days (e.g. Thu + Fri, Sat + Sun) — geometric
  // constraint allows the L-co alternative.
  const teamDayNums = (inputs.teamTrainingDays || [])
    .map((d) => DAY_NUM[d as string])
    .filter((n) => n !== undefined)
    .sort((a, b) => a - b);
  let teamDaysConsecutive = false;
  for (let i = 1; i < teamDayNums.length; i++) {
    if (teamDayNums[i] - teamDayNums[i - 1] === 1) {
      teamDaysConsecutive = true;
      break;
    }
  }

  const standard = lowerDedicated === 2 && upper === 2;
  const combinedAlternative =
    teamDaysConsecutive && lowerCombined >= 1 && lower >= 1 && upper === 2;
  const ok = standard || combinedAlternative;

  let detail: string;
  if (standard) {
    detail = `2L + 2U ✓`;
  } else if (combinedAlternative) {
    detail = `1×L-co (sq+hi) + 2U ✓ (consecutive team days — 2 dedicated lowers infeasible)`;
  } else {
    const lowerDesc =
      lowerCombined > 0
        ? `${lowerDedicated}L + ${lowerCombined}×L-co`
        : `${lowerDedicated}L`;
    detail = `${lowerDesc} + ${upper}U (expected 2L + 2U or — with consecutive team days — 1×L-co + 2U)`;
  }

  return {
    rule: 'H-PRE-7/8/9: pre-season healthy → 2L + 2U strength cores',
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

/**
 * In-season WITH-game conditioning floor: when the trigger gate matches
 * (≥5 days, ≤2 team days, healthy, no severe injuries), the engine's
 * `applyInSeasonConditioningFloor` post-validation pass MUST place at
 * least one aerobic_base session.
 *
 * Skip caveat: when the engine's placement priority is exhausted (G−3 is
 * a team day AND G−4 is non-upper / team), the helper legitimately can't
 * land — we don't fail those structurally-infeasible cases. Detection:
 * read the same trigger conditions the engine uses, then check whether
 * G−3 and G−4 are both blocked. If both blocked → return null (skip).
 */
export const inseason_minOneConditioningWhenSafe: Invariant = ({ profile, inputs, plan }) => {
  if (inputs.seasonPhase !== 'In-season') return null;
  if (!inputs.hasGame || !inputs.gameDay) return null;
  if ((inputs.teamTrainingDays || []).length > 2) return null;
  if (inputs.availableDays < 5) return null;
  if (plan.readiness !== 'high') return null;
  if (hasSevereInjury(profile)) return null;

  // Helper: g-offset relative to game day (mirrors engine's gOffset).
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

  // Are both placement-priority slots blocked? If so the engine cannot
  // physically land conditioning — we skip the assertion.
  const teamDays = new Set(profile.teamTrainingDays || []);
  const sessionAt = (off: number) =>
    plan.weeklyPlan.find((s) => s.dayOfWeek && offsetOf(s.dayOfWeek) === off);
  const g3 = sessionAt(-3);
  const g4 = sessionAt(-4);
  const g3Blocked = !g3 || teamDays.has(g3.dayOfWeek as any) || g3.tier === 'core';
  const g4Blocked =
    !g4 ||
    teamDays.has(g4.dayOfWeek as any) ||
    !(g4.strengthPattern === 'push' ||
      g4.strengthPattern === 'pull' ||
      g4.strengthPattern === 'upper_combined');
  if (g3Blocked && g4Blocked) return null;

  // Now assert: at least one session has typed conditioning fields.
  const condCells: string[] = [];
  for (const s of plan.weeklyPlan) {
    if (s.conditioningCategory || s.hasCombinedConditioning) {
      const tag = s.hasCombinedConditioning
        ? `S+C(${s.conditioningCategory ?? '?'})`
        : `COND(${s.conditioningCategory ?? '?'})`;
      condCells.push(`${s.dayOfWeek}:${tag}`);
    }
  }
  const ok = condCells.length >= 1;
  return {
    rule: 'In-season + game + ≤2 team + healthy → ≥1 conditioning when safe',
    passed: ok,
    detail: ok
      ? `${condCells.length} conditioning cell(s): ${condCells.join('; ')}`
      : `0 conditioning cells; G−3=${g3?.dayOfWeek ?? '—'} blocked=${g3Blocked}, G−4=${g4?.dayOfWeek ?? '—'} blocked=${g4Blocked}`,
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

/**
 * In-season game-week: any conditioning placed must be aerobic_base.
 * Sprint / VO2 / glycolytic are pre-season fitness-building flavours and
 * have no place inside a game-week microcycle.
 */
export const inseason_aerobicOnlyDuringGameWeek: Invariant = ({ inputs, plan }) => {
  if (inputs.seasonPhase !== 'In-season') return null;
  if (!inputs.hasGame) return null;
  const violations: string[] = [];
  for (const s of plan.weeklyPlan) {
    if (!s.conditioningCategory) continue;
    if (s.conditioningCategory !== 'aerobic_base') {
      violations.push(`${s.dayOfWeek}: ${s.conditioningCategory}`);
    }
  }
  return {
    rule: 'In-season game week → conditioning category must be aerobic_base',
    passed: violations.length === 0,
    detail:
      violations.length === 0
        ? 'all conditioning is aerobic_base (or none)'
        : `non-aerobic flavours found: ${violations.join('; ')}`,
  };
};

/**
 * In-season push/pull balance: every in-season week must carry at least
 * 1 push exposure and 1 pull exposure. A single full_body or upper_combined
 * session covers both. Source of truth: `strengthPattern` (typed engine
 * field, never parse focus strings).
 *
 * Why an invariant alongside the engine pass: catches drift if anyone ever
 * adds a new in-season placement branch that emits one upper pattern only.
 * Mirrors the `enforceInSeasonPushPullBalance` pass — a regression here
 * means the safety net itself is broken.
 */
export const inseason_pushPullBalance: Invariant = ({ inputs, plan }) => {
  if (inputs.seasonPhase !== 'In-season') return null;
  const hasPush = plan.weeklyPlan.some(
    (s) =>
      s.strengthPattern === 'push' ||
      s.strengthPattern === 'upper_combined' ||
      s.strengthPattern === 'full_body',
  );
  const hasPull = plan.weeklyPlan.some(
    (s) =>
      s.strengthPattern === 'pull' ||
      s.strengthPattern === 'upper_combined' ||
      s.strengthPattern === 'full_body',
  );
  const ok = hasPush && hasPull;
  return {
    rule: 'In-season → ≥1 push exposure AND ≥1 pull exposure',
    passed: ok,
    detail: ok
      ? `push=${hasPush ? '✓' : '✗'} pull=${hasPull ? '✓' : '✗'}`
      : `push=${hasPush ? '✓' : '✗'} pull=${hasPull ? '✓' : '✗'} — patterns: ${plan.weeklyPlan
          .filter((s) => s.strengthPattern)
          .map((s) => `${s.dayOfWeek}:${s.strengthPattern}`)
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
    const isLower =
      s.strengthPattern === 'lower' || s.strengthPattern === 'lower_combined';
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
