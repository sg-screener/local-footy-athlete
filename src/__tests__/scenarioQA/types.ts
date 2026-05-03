/**
 * Shared types for the athlete scenario QA harness.
 *
 * The harness simulates the lifecycle of an athlete's profile + program:
 *   ─ Onboarding         → start with a profile, generate first plan
 *   ─ Phase shift        → applyPhaseShift + rebuild
 *   ─ Game add/move/remove → applyGameDayChange + rebuild
 *
 * Each scenario is a sequence of Actions. After every Action we re-run the
 * coaching engine and assert a configurable set of Invariants.
 */

import type { OnboardingData, DayOfWeek, SeasonPhase } from '../../types/domain';
import type { CoachingPlan, CoachingInputs } from '../../utils/coachingEngine';

// ─────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────

export type Action =
  | { type: 'onboard' /* profile already set in scenario */ }
  | {
      type: 'phaseShift';
      targetPhase: SeasonPhase;
      /**
       * Athlete availability for the new phase. Optional: omit to mirror
       * older scenarios that don't exercise the availability re-confirm
       * step; provide to assert the rebuild honours a changed day set.
       */
      preferredTrainingDays?: DayOfWeek[];
      teamTrainingDays?: DayOfWeek[];
      gameDay?: DayOfWeek | null;
    }
  | { type: 'addGame'; day: DayOfWeek }
  | { type: 'moveGame'; day: DayOfWeek }
  | { type: 'removeGame' };

export function describeAction(a: Action): string {
  switch (a.type) {
    case 'onboard':
      return 'onboard';
    case 'phaseShift':
      return `shift→${a.targetPhase}${a.gameDay ? ` (game ${a.gameDay})` : ''}`;
    case 'addGame':
      return `addGame(${a.day})`;
    case 'moveGame':
      return `moveGame→${a.day}`;
    case 'removeGame':
      return 'removeGame';
  }
}

// ─────────────────────────────────────────────────────────────────
// Invariants
// ─────────────────────────────────────────────────────────────────

export interface InvariantContext {
  profile: OnboardingData;
  inputs: CoachingInputs;
  plan: CoachingPlan;
}

export interface InvariantResult {
  rule: string;
  passed: boolean;
  detail: string;
}

export type Invariant = (ctx: InvariantContext) => InvariantResult | null;

// ─────────────────────────────────────────────────────────────────
// Scenarios
// ─────────────────────────────────────────────────────────────────

export interface Scenario {
  /** Short, unique label for the report. */
  name: string;
  /** Initial onboarding profile — applied before the first action. */
  profile: OnboardingData;
  /** Action sequence. Always begins with 'onboard'. */
  actions: Action[];
  /**
   * Invariants to check after EACH action. Defaults to all standard
   * invariants. Use a narrower set when testing edge cases that
   * intentionally violate a relaxed rule.
   */
  invariants?: Invariant[];
  /** Optional hand-written description of what this scenario protects against. */
  intent?: string;
}

// ─────────────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────────────

export interface StepResult {
  action: Action;
  /** Profile state AFTER applying the action. */
  profile: OnboardingData;
  /** Engine plan generated from this profile. */
  plan: CoachingPlan;
  /** All invariant results for this step. */
  invariants: InvariantResult[];
  /** Convenience: did all invariants pass? */
  passed: boolean;
}

export interface ScenarioResult {
  scenario: Scenario;
  steps: StepResult[];
  passed: boolean;
}
