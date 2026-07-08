/**
 * Strength Progression Rules — State resolution and mechanics.
 *
 * Pure functions. No React. No Zustand. No side effects.
 *
 * Implements the full progression design:
 *   - 6 states: build, maintain, hold, deload, return, overreach
 *   - 8-step priority resolution chain
 *   - Hard/soft deload trigger split
 *   - In-season lower body micro-progression
 *   - Trend-based build→hold gate
 *   - Overreach (off-season only)
 *
 * Called by the session builder AFTER exercise selection, BEFORE
 * set/load prescription. The builder applies the output mechanically
 * without making progression state decisions.
 *
 * Architecture:
 *   resolveProgression() → ProgressionOutput
 *   Builder reads output.loadDelta, setsDelta, rpeDelta and applies.
 */

import type {
  SessionFeeling,
  SeasonPhase,
  ReadinessLevel,
} from '../types/domain';
import {
  type CompletionQuality,
  type TrendSignal,
  type ExerciseRole,
  feelingToRPE,
} from './progressionHelpers';

// ─── Types ───

export type ProgressionState = 'build' | 'maintain' | 'hold' | 'deload' | 'return' | 'overreach';

export type LoadDelta = 'micro_up' | 'up' | 'none' | 'down' | 'big_down';
export type SetsDelta = 'add_one' | 'none' | 'drop_one' | 'drop_two';
export type RPEDelta = 'push' | 'none' | 'pull';

export interface ProgressionInput {
  exerciseRole: ExerciseRole;
  seasonPhase: SeasonPhase;
  readiness: ReadinessLevel;
  completionQuality: CompletionQuality;
  weeksSinceDeload: number;
  consecutiveBuildWeeks: number;
  recentRPE: number;
  daysToGame: number | null;
  daysSinceGame: number | null;
  doubleGameWeek: boolean;
  weeksOffTraining: number;
  injuryAvoidFlag: boolean;
  recentDeloadTrigger: 'overreach' | null;
  missedSessionsThisWeek: number;
  sessionFeeling: SessionFeeling;
  trend: TrendSignal;
  /** Whether this is a lower body exercise (for in-season micro-progression). */
  isLowerBody: boolean;
  /** Consecutive full completions at current load (for build mechanics). */
  consecutiveFullCompletions: number;
}

export interface ProgressionOutput {
  state: ProgressionState;
  loadDelta: LoadDelta;
  setsDelta: SetsDelta;
  rpeDelta: RPEDelta;
  note: string;
}

// ─── Main API ───

/**
 * Resolve the progression state and output for a strength exercise.
 *
 * 8-step priority chain. This function makes the final state decision.
 * The builder receives the output and applies it without modification.
 */
export function resolveProgression(input: ProgressionInput): ProgressionOutput {
  const rpe = input.recentRPE;

  // ── Step 1: Return-to-training gate ──
  if (input.weeksOffTraining >= 2) {
    return buildReturn(input);
  }

  // ── Step 2: Hard deload triggers (any ONE fires immediately) ──
  if (input.recentDeloadTrigger === 'overreach') {
    return buildDeload('Post-overreach mandatory deload');
  }
  if (input.doubleGameWeek) {
    return buildDeload('Double game week - reduce training load');
  }
  if (input.injuryAvoidFlag) {
    return buildDeload('Injury avoidance - immediate load reduction');
  }

  // ── Step 3: Soft deload triggers (require 2+ concurrent) ──
  let softCount = 0;
  if (input.readiness === 'low') softCount++;
  if (rpe >= 8) softCount++;
  if (input.missedSessionsThisWeek >= 1) softCount++;
  if (input.sessionFeeling === 'Cooked') softCount++;
  if (softCount >= 2) {
    const signals: string[] = [];
    if (input.readiness === 'low') signals.push('low readiness');
    if (rpe >= 8) signals.push('high RPE');
    if (input.missedSessionsThisWeek >= 1) signals.push('missed sessions');
    if (input.sessionFeeling === 'Cooked') signals.push('cooked feeling');
    return buildDeload(`Soft deload: ${signals.join(' + ')}`);
  }

  // ── Step 4: Scheduled deload cycle (candidate, not forced) ──
  // Only fires when there is at least 1 supporting fatigue signal.
  const deloadThreshold = input.seasonPhase === 'In-season' ? 4 : 6;
  if (input.weeksSinceDeload >= deloadThreshold) {
    // Check for at least one fatigue signal
    const hasSignal =
      input.readiness === 'low' ||
      rpe >= 8 ||
      input.missedSessionsThisWeek >= 1 ||
      input.sessionFeeling === 'Cooked' ||
      input.sessionFeeling === 'Sore';
    if (hasSignal) {
      return buildDeload(`Scheduled deload cycle (${input.weeksSinceDeload} weeks) with fatigue signal`);
    }
    // No fatigue signal — skip deload, continue to normal resolution
  }

  // ── Step 5: Game proximity hold ──
  if (input.daysToGame !== null && input.daysToGame <= 2) {
    return buildHold('Game proximity - hold for G-2 or closer');
  }

  // ── Step 6: Season phase + readiness matrix ──
  let state: ProgressionState;
  let note: string;

  if (input.seasonPhase === 'In-season') {
    if (input.readiness === 'low') {
      state = 'hold';
      note = 'In-season, low readiness - hold';
    } else if (input.readiness === 'medium') {
      state = 'maintain';
      note = 'In-season, medium readiness - maintain';
    } else {
      // High readiness — check in-season lower body build gate
      if (input.isLowerBody) {
        const gatePass = inSeasonLowerBodyGate(input);
        if (gatePass) {
          return buildInSeasonLowerBodyBuild();
        }
      }
      state = 'maintain';
      note = 'In-season, high readiness - maintain';
    }
  } else if (input.seasonPhase === 'Pre-season') {
    if (input.readiness === 'low') {
      state = 'maintain';
      note = 'Pre-season, low readiness - maintain';
    } else {
      state = 'build';
      note = `Pre-season, ${input.readiness} readiness - build`;
    }
  } else {
    // Off-season
    if (input.readiness === 'low') {
      state = 'maintain';
      note = 'Off-season, low readiness - maintain';
    } else {
      state = 'build';
      note = `Off-season, ${input.readiness} readiness - build`;
    }
  }

  // ── Step 7: Trend gate ──
  if (state === 'build' && input.trend === 'down') {
    state = 'hold';
    note = 'Build downgraded to hold - trend is declining';
  }

  // ── Step 8: Overreach decision (off-season only) ──
  if (
    state === 'build' &&
    input.seasonPhase === 'Off-season' &&
    input.readiness === 'high' &&
    input.consecutiveBuildWeeks >= 3 &&
    rpe <= 7 &&
    input.trend !== 'down'
  ) {
    return buildOverreach();
  }

  // ── Build output from resolved state ──
  return buildOutputForState(state, note, input);
}

// ─── In-Season Lower Body Build Gate ───

function inSeasonLowerBodyGate(input: ProgressionInput): boolean {
  return (
    input.readiness === 'high' &&
    input.recentRPE <= 6 &&
    (input.daysToGame === null || input.daysToGame >= 3) &&
    !input.doubleGameWeek &&
    input.trend !== 'down'
  );
}

// ─── Output Builders ───

function buildReturn(input: ProgressionInput): ProgressionOutput {
  // Post-deload: start at 80%. Extended gap: start at 60%.
  const isPostDeload = input.recentDeloadTrigger === 'overreach' || input.weeksOffTraining === 2;
  return {
    state: 'return',
    loadDelta: isPostDeload ? 'down' : 'big_down',
    setsDelta: 'none',
    rpeDelta: 'pull',
    note: `Return to training after ${input.weeksOffTraining} weeks off - ramping back`,
  };
}

function buildDeload(reason: string): ProgressionOutput {
  return {
    state: 'deload',
    loadDelta: 'big_down',
    setsDelta: 'drop_two',
    rpeDelta: 'pull',
    note: reason,
  };
}

function buildHold(reason: string): ProgressionOutput {
  return {
    state: 'hold',
    loadDelta: 'none',
    setsDelta: 'none',
    rpeDelta: 'pull',
    note: reason,
  };
}

function buildInSeasonLowerBodyBuild(): ProgressionOutput {
  return {
    state: 'build',
    loadDelta: 'micro_up',
    setsDelta: 'none',
    rpeDelta: 'none',
    note: 'In-season lower body micro-progression - conditions met',
  };
}

function buildOverreach(): ProgressionOutput {
  return {
    state: 'overreach',
    loadDelta: 'up',
    setsDelta: 'add_one',
    rpeDelta: 'push',
    note: 'Off-season overreach - high readiness, 3+ build weeks, RPE ≤ 7',
  };
}

function buildOutputForState(
  state: ProgressionState,
  note: string,
  input: ProgressionInput,
): ProgressionOutput {
  switch (state) {
    case 'build':
      return buildBuildOutput(note, input);
    case 'maintain':
      return buildMaintainOutput(note, input);
    case 'hold':
      return buildHold(note);
    case 'deload':
      return buildDeload(note);
    default:
      return { state: 'maintain', loadDelta: 'none', setsDelta: 'none', rpeDelta: 'none', note };
  }
}

function buildBuildOutput(note: string, input: ProgressionInput): ProgressionOutput {
  // Build mechanics:
  //   - micro_up after each full completion
  //   - up after 2 consecutive full completions
  //   - add_one set after 3 consecutive full completions
  //   - partial: hold (no regression from one partial)
  //   - failed: drop load one step
  if (input.completionQuality === 'failed') {
    return {
      state: 'build',
      loadDelta: 'down',
      setsDelta: 'none',
      rpeDelta: 'none',
      note: note + ' - failed completion, dropping load one step',
    };
  }

  const loadDelta: LoadDelta = input.completionQuality === 'full'
    ? (input.consecutiveFullCompletions >= 2 ? 'up' : 'micro_up')
    : 'none';

  const setsDelta: SetsDelta = (
    input.completionQuality === 'full' &&
    input.consecutiveFullCompletions >= 3
  ) ? 'add_one' : 'none';

  return {
    state: 'build',
    loadDelta,
    setsDelta,
    rpeDelta: 'push',
    note,
  };
}

function buildMaintainOutput(note: string, input: ProgressionInput): ProgressionOutput {
  // Maintain: hold current weight and volume. RPE 6-7.
  // If completion failed → transition to hold.
  if (input.completionQuality === 'failed') {
    return {
      state: 'hold',
      loadDelta: 'none',
      setsDelta: 'none',
      rpeDelta: 'pull',
      note: note + ' - failed completion, downgrading to hold',
    };
  }

  const enrichedNote = input.trend === 'up'
    ? note + ' - progressing well within maintenance band'
    : note;

  return {
    state: 'maintain',
    loadDelta: 'none',
    setsDelta: 'none',
    rpeDelta: 'none',
    note: enrichedNote,
  };
}
