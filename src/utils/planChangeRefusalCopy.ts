/**
 * planChangeRefusalCopy — the single owner of the athlete-facing sentence for a
 * program-edit risk finding.
 *
 * Ownership boundary (A6, L10 device finding 2026-07-24): the DOMAIN owns why an
 * edit was refused. `blockedAssessmentForBuildError` in planChangeProducer says
 * so explicitly — "a plain-language refusal, never a raw error code" — and
 * writes game-framed copy for the locked-day rules.
 *
 * The device defect was a SECOND representation: `PlanChangeSheet` hardcoded a
 * generic "Can't apply this edit" headline for every hard stop and rendered it
 * at 17px/700 while the domain's honest sentence sat below it at 14px/70%
 * opacity. The bold generic line is what the athlete read as the refusal.
 *
 * So this module maps a finding to ONE sentence and nothing else. Rules whose
 * copy the domain already writes deliberately — `game_day_locked`,
 * `game_proximity_day_locked` — deliberately have NO case here: they fall
 * through to `finding.message` and reach the athlete verbatim. Adding cases for
 * them would re-create the duplicate this boundary exists to remove.
 *
 * Pure by construction (no React Native imports) so the copy contract is
 * directly testable — same seam as `readinessBodyLead`.
 */

export interface PlanChangeRiskFindingLike {
  ruleId: string;
  message: string;
  data?: Record<string, unknown>;
}

/** Maximum reasons shown for a single refusal — beyond this it stops being read. */
const MAX_REASONS = 3;

/**
 * The athlete-facing sentence for one finding. Cases exist only where the UI
 * adds athlete framing the rule engine does not carry; everything else is the
 * domain's own message, unchanged.
 */
export function riskReason(finding: PlanChangeRiskFindingLike): string {
  const observed = typeof finding.data?.observed === 'number' ? finding.data.observed : null;
  switch (finding.ruleId) {
    case 'cap_maxHardDays_over':
      return observed
        ? `This gives you ${observed} hard days this week. That's the upper edge.`
        : 'This pushes your hard days above the clean weekly target.';
    case 'cap_maxMainStrengthSessions_over':
      return observed
        ? `This gives you ${observed} main strength sessions this week. That's more than the normal cap.`
        : 'This pushes main strength above the normal weekly cap.';
    case 'cap_maxRunningExposures_over':
      return 'This adds more running than the weekly cap.';
    case 'cap_sprintCodExposures_over':
      return 'This adds more sprint/COD than the week needs.';
    case 'g1_hard_work':
    case 'g1_not_light':
      return "This puts hard work one day before your game, so it can't be applied. Choose a lighter session or another day.";
    case 'g2_hard_lower':
    case 'g2_hard_conditioning':
    case 'g2_sprint_cod':
      return 'This puts hard work too close to game day.';
    case 'g_plus1_hard_work':
      return 'This adds hard work the day after your game, when recovery should win.';
    case 'game_day_hard_work':
      return "This puts hard training on game day, so it can't be applied. Choose a recovery session or another day.";
    case 'protected_anchor_edit_blocked':
    case 'protected_game_anchor_removed':
    case 'protected_team_training_anchor_removed':
      return "This would remove a protected team/game anchor, so it can't be applied. Use the team/game controls to change that anchor.";
    case 'active_injury_hard_stop':
      return "There's an active medical/injury hard stop, so normal training edits are paused. Choose recovery or clear it once you're ready.";
    default:
      return finding.message;
  }
}

/** Distinct reasons for a refusal, most important first. */
export function riskReasons(findings: readonly PlanChangeRiskFindingLike[]): string[] {
  return Array.from(new Set(findings.map(riskReason))).slice(0, MAX_REASONS);
}

/**
 * The one sentence shown when a program edit did not go through but there is no
 * athlete-framed reason to show — either the layer produced none, or it produced
 * an internal diagnostic never meant for a human.
 */
const SAFE_REFUSAL_FALLBACK =
  "That change didn't go through — nothing on your plan changed. Try again, or ask your coach.";

/**
 * Markers of a raw internal reason. These are the vocabulary of the transaction
 * and rules layers (executor candidates, accepted-state fingerprints, route
 * codes, "requires the durable … transaction" developer messages) — none of it
 * is athlete copy. If a reason carries any of these, it is replaced wholesale.
 */
const INTERNAL_REASON_MARKERS: readonly RegExp[] = [
  /executor/i,
  /candidate/i,
  /fingerprint/i,
  /accepted[-\s]?state/i,
  /\btransaction\b/i,
  /envelope/i,
  /presentation field/i,
  /programming field/i,
  /\bsemantic/i,
  /rolled back/i,
  /could not be persisted/i,
  /source[-\s]?fact/i,
  /guided executor/i,
  /\bStage \d/i,
];

/** A bare snake_case token (e.g. a route code like `coach_mutation_not_applied`). */
const SNAKE_CASE_TOKEN = /^[a-z0-9]+(?:_[a-z0-9]+)+$/;

/**
 * athleteSafeRefusal — gate every refusal string through here before it reaches
 * the athlete. Athlete-framed domain copy (the sentences `riskReason` owns)
 * passes through unchanged; a missing reason or any raw internal diagnostic
 * collapses to one honest fallback sentence.
 *
 * The single display seam for refusal copy: a raw internal reason must never be
 * rendered, no matter which layer produced it (L10 device finding, 2026-07-24).
 */
export function athleteSafeRefusal(reason?: string | null): string {
  const trimmed = (reason ?? '').trim();
  if (!trimmed) return SAFE_REFUSAL_FALLBACK;
  if (SNAKE_CASE_TOKEN.test(trimmed)) return SAFE_REFUSAL_FALLBACK;
  if (INTERNAL_REASON_MARKERS.some((marker) => marker.test(trimmed))) return SAFE_REFUSAL_FALLBACK;
  return trimmed;
}
