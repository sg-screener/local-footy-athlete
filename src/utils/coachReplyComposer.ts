/**
 * coachReplyComposer.ts — produce ONE coherent injury-adjustment
 * reply from the active constraint plans + week-affected booleans.
 *
 * Replaces the older "buildInjuryReply + splice future block" pattern,
 * which produced stitched fragments ("Get a physio" then a tacked-on
 * future paragraph). The composer takes the plans (already derived
 * from the universal exposure engine) and renders a single
 * mobile-friendly response.
 *
 * Contract:
 *   - one coherent paragraph + bullets, no repeated sections
 *   - 2–4 short sections max (Headline / Avoid+Sub / Keep / Closing)
 *   - never says "program unchanged" if any week was projected
 *   - integrates physio advice naturally (not a dangling appendix)
 *   - concise (~6-12 lines) — long per-session lists live behind the
 *     card "Show details" toggle, NOT in the chat reply
 */

import type { ConstraintPlan } from './constraintPlan';
import type {
  ActiveConstraint,
  ActiveInjuryConstraint,
} from '../store/coachUpdatesStore';
import {
  composeGuidanceOnlyReply,
  validateCoachCommunicationTruth,
  type VerifiedCoachCommunication,
} from './verifiedCoachCommunication';
import { logger } from './logger';

export interface ComposeReplyInput {
  /**
   * The plan layer — ONE plan per active constraint, already derived
   * from the engine policy. Card + reply read the same fields.
   */
  plans: ConstraintPlan[];
  /** True when the visible CURRENT week is reshaped under these plans. */
  currentWeekAffected: boolean;
  /** True when the visible NEXT week is reshaped under these plans. */
  futureWeekAffected: boolean;
  /**
   * Optional one-liner the caller can use to summarise major changes
   * in the program — e.g. "RDLs swapped to goblet squats". Kept
   * deliberately short. If omitted, the reply uses generic phrasing.
   */
  majorChangesSummary?: string;
  /** Free-text headline override — caller may want a follow-up tone. */
  headline?: string;

  /**
   * TRUTH-GATE input — caller passes the verified communication +
   * source constraints when available. The composer uses these to
   * decide between the "applied changes" reply and the guidance-only
   * fallback. When omitted, the legacy behaviour applies (back-compat
   * with older tests/callers that haven't migrated yet).
   */
  verified?: VerifiedCoachCommunication;
  constraints?: ActiveConstraint[];
  /**
   * True when the user explicitly stated severity (e.g. "fatigue 7/10").
   * Drives whether the guidance-only reply prints a number or asks for
   * one. Defaults to true for back-compat (older tests already provide
   * severities downstream).
   */
  severityIsExplicit?: boolean;
}

const SEVERE_THRESHOLD = 7;

function capitalise(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function dedupe<T>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const key = JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function injuryPlans(plans: ConstraintPlan[]): ConstraintPlan[] {
  return plans.filter((p) => p.type === 'injury');
}

/**
 * Headline sentence — anchors the rest of the reply.
 *
 *   "Hammy 7/10 is too high for sprinting or heavy lower work."
 *   "Two issues active — hammy + shoulder. Putting the right restrictions on."
 */
function buildHeadline(plans: ConstraintPlan[]): string {
  if (plans.length === 0) {
    return 'Active restriction in place — keeping your training safe.';
  }
  const injuries = injuryPlans(plans);
  if (injuries.length > 1) {
    // Multi-injury combined headline.
    const parts = injuries.map((p) => {
      const m = p.activeIssue.match(/^(.*?) pain/);
      return m ? m[1].toLowerCase() : p.activeIssue.toLowerCase();
    });
    return `Two issues active — ${parts.join(' + ')}. Putting the right restrictions on.`;
  }
  if (plans.length === 1 && plans[0].type === 'injury') {
    // Bucket-themed headline so the message lands.
    const p = plans[0];
    const m = p.activeIssue.match(/^(.*?) pain — (\d+)\/10$/);
    if (!m) return p.activeIssue;
    const partLabel = m[1];
    const severity = parseInt(m[2], 10);
    const region = p.constraint.region;
    if (severity >= SEVERE_THRESHOLD) {
      if (region === 'shoulder' || region === 'elbow' || region === 'wrist') {
        return `${partLabel} ${severity}/10 is too high to press through.`;
      }
      if (
        region === 'hamstring' || region === 'knee' || region === 'calf' ||
        region === 'ankle' || region === 'groin' || region === 'hip' ||
        region === 'achilles' || region === 'quad'
      ) {
        return `${partLabel} ${severity}/10 is too high for sprinting or heavy lower work.`;
      }
      if (region === 'back') {
        return `${partLabel} ${severity}/10 is too high for heavy hinging or axial loading.`;
      }
      return `${partLabel} ${severity}/10 — putting a hard restriction on.`;
    }
    return `${partLabel} ${severity}/10 — putting a restriction on the program.`;
  }
  // Fatigue-only or other — fall back to the activeIssue text.
  return capitalise(plans[0].activeIssue);
}

/** "Avoid: Sprinting / max-speed running, Plyometrics / jumping, Heavy hinge / nordics / RDLs" */
function buildAvoidLine(plans: ConstraintPlan[]): string {
  const labels = dedupe(plans.flatMap((p) => p.avoid));
  if (labels.length === 0) return '';
  return `Avoid: ${labels.join(', ')}.`;
}

/** "Sub in: Quad-dominant lower (goblet squats, leg press), Upper body, Easy bike" */
function buildSubLine(plans: ConstraintPlan[]): string {
  const labels = dedupe(plans.flatMap((p) => p.substituteWith));
  if (labels.length === 0) return '';
  // Cap at 3 substitution suggestions to keep the line scannable.
  const trimmed = labels.slice(0, 3);
  return `Sub in: ${trimmed.join(', ')}.`;
}

/** "Keep: trunk, mobility, easy bike if pain-free." */
function buildKeepLine(plans: ConstraintPlan[]): string {
  const labels = dedupe(plans.flatMap((p) => p.keep));
  if (labels.length === 0) return '';
  const lower = labels.map((s) => s.toLowerCase());
  const joined = lower.length > 1
    ? `${lower.slice(0, -1).join(', ')}, and ${lower[lower.length - 1]}`
    : lower[0];
  return `Keep ${joined}.`;
}

/** Optional physio nudge — picks the strictest one across plans. */
function buildPhysioLine(plans: ConstraintPlan[]): string {
  const allAdvice = plans.flatMap((p) => p.advice);
  // The hard nudge contains "Get this assessed by a physio"; soft nudge
  // contains "If it's not improving". Prefer hard if any present.
  const hard = allAdvice.find((a) => /\bphysio\b/i.test(a) && /\bassessed\b/i.test(a));
  if (hard) return hard;
  const soft = allAdvice.find((a) => /\bphysio\b/i.test(a));
  return soft ?? '';
}

function splitReplySections(text: string): string[] {
  return (text || '')
    .trim()
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isFinalCloseSection(section: string): boolean {
  return /\bphysio\b/i.test(section) || /\bHit Update coach\b/i.test(section);
}

/**
 * Insert a program-change summary before final advice. This is used by
 * live injury flows that receive an engine reply plus a separately
 * computed future-week summary, so physio / Update coach advice stays
 * as the final close instead of getting a stitched paragraph after it.
 */
export function insertProgramSummaryBeforeFinalClose(
  replyText: string,
  programSummary: string,
): string {
  const sections = splitReplySections(replyText);
  const summarySections = splitReplySections(programSummary).filter(
    (s) => !sections.includes(s),
  );
  if (summarySections.length === 0) return sections.join('\n\n');

  const bodySections = sections.filter((s) => !isFinalCloseSection(s));
  const closeSections = sections.filter(isFinalCloseSection);
  if (closeSections.length === 0) {
    return [...bodySections, ...summarySections].join('\n\n');
  }
  return [...bodySections, ...summarySections, ...closeSections].join('\n\n');
}

/**
 * Compose the final reply. One paragraph + short sections, no
 * stitching, ≤ 4 sections.
 *
 * Accepts EITHER the new plan-driven shape (`{ plans, ... }`) or the
 * legacy `{ constraints, currentWeekChanges, nextWeekChanges, ... }`
 * shape — the legacy form is converted to plans on the fly.
 */
export function composeCoachAdjustmentReply(
  input: ComposeReplyInput | LegacyComposeReplyInput,
): string {
  // Legacy detection — older callers passed `constraints` + `did*` flags.
  if ((input as LegacyComposeReplyInput).constraints !== undefined) {
    return composeCoachAdjustmentReplyLegacy(input as LegacyComposeReplyInput);
  }
  return composeCoachAdjustmentReplyFromPlans(input as ComposeReplyInput);
}

function composeCoachAdjustmentReplyFromPlans(input: ComposeReplyInput): string {
  // ── TRUTH GATE ───────────────────────────────────────────────────
  // When the caller passes a verified communication object AND the
  // verified state says we cannot claim "program updated", we MUST
  // produce a guidance-only reply. This is the central protection
  // against the "I subbed in bike but no bike was actually added"
  // failure that triggered this rewrite.
  if (input.verified && !input.verified.canSayProgramUpdated) {
    return composeGuidanceOnlyReply({
      communication: input.verified,
      constraints: input.constraints ?? [],
      severityIsExplicit: input.severityIsExplicit ?? false,
    });
  }

  const headline = input.headline ?? buildHeadline(input.plans);
  const avoidLine = buildAvoidLine(input.plans);
  const subLine = buildSubLine(input.plans);
  const keepLine = buildKeepLine(input.plans);
  const physio = buildPhysioLine(input.plans);

  // Visible-program sentence — kept to ONE concise line, regardless
  // of how many sessions changed under the hood. Detail lives on the
  // Coach Update card behind "Show details".
  const programSentence = (() => {
    const major = input.majorChangesSummary?.trim();
    if (input.currentWeekAffected && input.futureWeekAffected) {
      return major
        ? `This week and next are now adjusted — ${major}.`
        : 'This week and next are now adjusted.';
    }
    if (input.currentWeekAffected) {
      return major
        ? `This week is now adjusted — ${major}.`
        : 'This week is now adjusted.';
    }
    if (input.futureWeekAffected) {
      return major
        ? `Nothing major left to change this week, but next week is now adjusted — ${major}.`
        : 'Nothing major left to change this week, but next week is now adjusted.';
    }
    return '';
  })();

  // Honest "no changes" branch — fall back to a minimal message.
  if (
    !input.currentWeekAffected &&
    !input.futureWeekAffected &&
    avoidLine === '' &&
    keepLine === ''
  ) {
    if (typeof console !== 'undefined' && (globalThis as any).__DEV__ !== false) {
      // eslint-disable-next-line no-console
      logger.debug('[constraint-plan] reply_composed', {
        sections: 1,
        mode: 'no_changes',
      });
    }
    return `${headline} Nothing on the program to change right now. Hit Update coach when anything changes.`;
  }

  // Build the body — 2–4 short sections + closing.
  const sections: string[] = [headline];

  // Combine Avoid + Sub into one block when both present, since they
  // belong together. Each on its own line.
  if (avoidLine || subLine) {
    const both = [avoidLine, subLine].filter(Boolean).join('\n');
    sections.push(both);
  }
  if (programSentence) sections.push(programSentence);
  if (keepLine) sections.push(keepLine);

  // Closing — physio nudge + update prompt, on the same line so it
  // never reads as a dangling appendix.
  const closing = [
    physio,
    'Hit Update coach when it improves, worsens, or clears.',
  ].filter(Boolean).join(' ');
  sections.push(closing);

  if (typeof console !== 'undefined' && (globalThis as any).__DEV__ !== false) {
    // eslint-disable-next-line no-console
    logger.debug('[constraint-plan] reply_composed', {
      sections: sections.length,
      currentWeekAffected: input.currentWeekAffected,
      futureWeekAffected: input.futureWeekAffected,
      planIds: input.plans.map((p) => p.id),
    });
  }

  const replyText = sections.join('\n\n');

  // ── TRUTH GATE — post-validate ─────────────────────────────────
  // If a verified communication is supplied, run the validator. A
  // failure means the composer wandered into forbidden phrasing
  // despite canSayProgramUpdated=true (e.g. plans contained an
  // "I adjusted" headline but the diff is empty). Downgrade.
  if (input.verified) {
    const v = validateCoachCommunicationTruth({
      communication: input.verified,
      replyText,
    });
    if (!v.ok) {
      return composeGuidanceOnlyReply({
        communication: input.verified,
        constraints: input.constraints ?? [],
        severityIsExplicit: input.severityIsExplicit ?? false,
      });
    }
  }

  return replyText;
}

// ─── Back-compat shim ────────────────────────────────────────────────
// Older callers invoked this with the pre-plan signature
// ({ constraints, currentWeekChanges, nextWeekChanges, ... }). The
// shim accepts that input, derives plans on the fly, and forwards
// to the plan-driven composer so existing tests/callers don't break.

export interface LegacyComposeReplyInput {
  constraints: ActiveConstraint[];
  currentWeekChanges: string[];
  nextWeekChanges: string[];
  didCurrentWeekChange: boolean;
  didFutureWeekChange: boolean;
  headline?: string;
}

/**
 * Legacy entrypoint — derives plans from `constraints` and dispatches
 * to the plan-driven composer. New code should use
 * `composeCoachAdjustmentReply` directly.
 */
export function composeCoachAdjustmentReplyLegacy(
  input: LegacyComposeReplyInput,
): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { buildConstraintPlans } = require('./constraintPlan') as typeof import('./constraintPlan');
  const plans = buildConstraintPlans(input.constraints);
  // Build a concise major-changes summary from the supplied bullets.
  const allChanges = [
    ...(input.currentWeekChanges ?? []),
    ...(input.nextWeekChanges ?? []),
  ];
  let majorChangesSummary: string | undefined;
  if (allChanges.length > 0) {
    // Pull the headline of the first change as the summary — the rest
    // surfaces in the card's "Show details" panel.
    const first = allChanges[0];
    // Strip any "Mon Lower Body Strength adjusted —" prefix.
    const m = first.match(/—\s*(.*)$/);
    majorChangesSummary = m ? m[1] : first;
    if (majorChangesSummary.length > 80) {
      majorChangesSummary = majorChangesSummary.slice(0, 77) + '...';
    }
  }
  return composeCoachAdjustmentReplyFromPlans({
    plans,
    currentWeekAffected: input.didCurrentWeekChange,
    futureWeekAffected: input.didFutureWeekChange,
    majorChangesSummary,
    headline: input.headline,
  });
}
