/**
 * THE ACTION-SEQUENCE WALKER — Sam's ruling, 2026-07-30.
 *
 * A seed library is SAMPLING, not coverage. Seeding a harness from one device
 * export proves things about one state and quietly implies things about the
 * space around it; the space is where the defects live. So the walker does not
 * seed state at all. It starts from a FRESH INSTALL and reaches every state it
 * asserts over by performing REAL ATHLETE ACTIONS through the REAL DOORS — the
 * same functions the screens call.
 *
 * A state the walker cannot reach by acting is a state no athlete can be in.
 * A state an athlete CAN be in that the walker cannot reach means the ACTION
 * VOCABULARY is incomplete, and that is a defect in this file, not in the app.
 * `athleteActionWalkerTests` holds it to exactly that standard against the
 * shape of Sam's real device.
 *
 * WHAT IT ASSERTS. The athlete-door matrix's seven laws, after EVERY action —
 * not at the end of a scenario. A history that ends healthy having passed
 * through a broken intermediate state is a history that broke the app.
 *
 * REPRODUCIBILITY AND SHRINKING. The RNG is seeded and pure, so a failing run
 * is `seed + length` and nothing else. On failure the walker delta-debugs the
 * history — dropping actions and re-running while the violation survives —
 * so what gets reported is the MINIMAL sequence that breaks the law, not the
 * forty actions that happened to precede it.
 *
 * WHY NOT fast-check. No property-testing library is in this repo's dependency
 * tree, and the generator here is domain-shaped rather than value-shaped: it
 * must propose actions that are legal to *attempt* against the current visible
 * week (you cannot move a session off a day that has none). A generic arbitrary
 * would spend its budget generating no-ops. The engine below is the part a
 * library would give — seeded RNG, generation, shrinking — and it is ~150 lines.
 */

import type { OnboardingData, TrainingProgram, Workout } from '../../types/domain';
import type { ResolvedDay } from '../../utils/sessionResolver';
import type { PlanChange } from '../../utils/planChangeTypes';

// ── Seeded RNG ────────────────────────────────────────────────────────────
// mulberry32: small, fast, and identical across runs for a given seed, which
// is the whole contract. `Math.random` is banned here for the obvious reason.

export function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

// ── The action vocabulary ─────────────────────────────────────────────────
//
// Every entry is something an athlete can actually do in the app. Adding a
// capability to the product means adding it here; that is the point.

export type WalkerAction =
  | { kind: 'answer_onboarding'; profile: OnboardingData }
  | { kind: 'generate_program' }
  | { kind: 'plan_change'; change: PlanChange }
  | { kind: 'mark_calendar'; date: string; mark: 'game' | 'rest' | 'clear' }
  | { kind: 'declare_source_fact'; date: string; fact: 'illness_minor' | 'illness_severe' | 'poor_sleep' }
  // THE TWO SCHEDULE DOORS SAM SPLIT ON 2026-07-31 (ruling 2). "Short on time
  // today" and "Away this week?" are things an athlete can now do from the week
  // screen, and a state an athlete can reach that the walker cannot is a defect
  // in the harness (L13), not a gap in the app.
  | { kind: 'short_on_time_today'; date: string }
  | { kind: 'away_this_week'; dates: string[] }
  | { kind: 'clear_source_facts' }
  | { kind: 'advance_time'; days: number };

export interface WalkerStepResult {
  action: WalkerAction;
  /** The door's own answer, when the action went through a door that has one. */
  outcome: string | null;
  message: string | null;
  threw: Error | null;
}

/** A law violation, with everything needed to reproduce it. */
export interface WalkerViolation {
  law: string;
  detail: string;
  atStep: number;
  history: WalkerAction[];
}

/**
 * The host supplies the app-facing operations. The walker owns generation,
 * sequencing, invariant checking and shrinking; the test file owns how a
 * fresh install is built and how each action reaches its door. That split
 * keeps this engine free of store imports and therefore reusable for any
 * future action vocabulary.
 */
export interface WalkerHost {
  /** Wipe to fresh install. Called before every replay. */
  reset: () => void;
  /** Perform one action through the real door. Must not swallow throws. */
  perform: (action: WalkerAction) => WalkerStepResult;
  /** Propose a legal-to-attempt next action given where the walk is now. */
  propose: (rng: () => number, step: number) => WalkerAction | null;
  /** The seven laws, checked after every action. Empty array = healthy. */
  checkInvariants: (last: WalkerStepResult) => { law: string; detail: string }[];
}

// ── Running a history ─────────────────────────────────────────────────────

function runHistory(
  host: WalkerHost,
  history: readonly WalkerAction[],
): WalkerViolation | null {
  host.reset();
  for (let index = 0; index < history.length; index++) {
    const action = history[index];
    let result: WalkerStepResult;
    try {
      result = host.perform(action);
    } catch (error) {
      return {
        law: 'L1 NO CRASH',
        detail: `the door threw instead of answering — ${
          error instanceof Error ? error.message : String(error)}`,
        atStep: index,
        history: history.slice(0, index + 1),
      };
    }
    if (result.threw) {
      return {
        law: 'L1 NO CRASH',
        detail: `the door threw instead of answering — ${result.threw.message}`,
        atStep: index,
        history: history.slice(0, index + 1),
      };
    }
    const broken = host.checkInvariants(result);
    if (broken.length > 0) {
      return {
        law: broken[0].law,
        detail: broken[0].detail,
        atStep: index,
        history: history.slice(0, index + 1),
      };
    }
  }
  return null;
}

/**
 * DELTA DEBUGGING. Drop one action at a time, keep the history if the SAME
 * violation still occurs, repeat until nothing more can go.
 *
 * "Same" is the law PLUS a normalised signature of the detail — dates, names
 * and numbers stripped out. Comparing on the law alone is not enough and the
 * first run proved it: a history whose real defect was a wrong confirmation
 * shrank all the way down to `[generate the program]`, which crashes for a
 * completely different reason (no season phase answered yet) and is not a
 * sequence any athlete can perform. A shrinker that swaps one defect for
 * another reports a reproduction that does not reproduce.
 */
function signatureOf(violation: { law: string; detail: string }): string {
  return `${violation.law}::${violation.detail
    .replace(/\d{4}-\d{2}-\d{2}/g, '<date>')
    .replace(/\d+/g, '<n>')
    .replace(/"[^"]*"/g, '<name>')
    .slice(0, 160)}`;
}
function shrink(host: WalkerHost, violation: WalkerViolation): WalkerViolation {
  // Diagnosis seam: shrinking replays up to 200 sub-histories, each a full
  // re-walk with program generations — minutes of work and real memory. When a
  // deep walk dies INSIDE the shrink (2026-08-03: heap exhaustion at 12GB
  // before the shrunk result ever printed), the violation that started it is
  // the evidence that never got reported. Print it first, behind an env flag,
  // so a dying shrink still names its defect.
  if (process.env.WALKER_LOG_PRESHRINK === '1') {
    console.error(`[walker] pre-shrink violation at step ${violation.atStep}: `
      + `${violation.law} — ${violation.detail}`);
  }
  let best = violation;
  let improved = true;
  let guard = 0;
  while (improved && guard < 200) {
    improved = false;
    for (let index = best.history.length - 1; index >= 0; index--) {
      guard += 1;
      if (guard >= 200) break;
      const candidate = best.history.filter((_, position) => position !== index);
      if (candidate.length === 0) continue;
      const replayed = runHistory(host, candidate);
      if (replayed && signatureOf(replayed) === signatureOf(best)) {
        best = replayed;
        improved = true;
        break;
      }
    }
  }
  return best;
}

/**
 * One walk. Generates up to `length` actions, checking every law after each,
 * and returns the MINIMAL failing history if a law breaks.
 */
export function walk(args: {
  host: WalkerHost;
  seed: number;
  length: number;
}): WalkerViolation | null {
  const rng = makeRng(args.seed);
  const history: WalkerAction[] = [];
  args.host.reset();
  for (let step = 0; step < args.length; step++) {
    const action = args.host.propose(rng, step);
    if (!action) break;
    history.push(action);
    let result: WalkerStepResult;
    try {
      result = args.host.perform(action);
    } catch (error) {
      return shrink(args.host, {
        law: 'L1 NO CRASH',
        detail: `the door threw instead of answering — ${
          error instanceof Error ? error.message : String(error)}`,
        atStep: step,
        history: [...history],
      });
    }
    if (result.threw) {
      return shrink(args.host, {
        law: 'L1 NO CRASH',
        detail: `the door threw instead of answering — ${result.threw.message}`,
        atStep: step,
        history: [...history],
      });
    }
    const broken = args.host.checkInvariants(result);
    if (broken.length > 0) {
      return shrink(args.host, {
        law: broken[0].law,
        detail: broken[0].detail,
        atStep: step,
        history: [...history],
      });
    }
  }
  return null;
}

/** Render a history as something a human can read back into the app. */
export function describeHistory(history: readonly WalkerAction[]): string {
  return history.map((action, index) => {
    switch (action.kind) {
      case 'answer_onboarding':
        return `  ${index + 1}. answer onboarding (${
          (action.profile as { seasonPhase?: string }).seasonPhase ?? '?'}, team ${
          ((action.profile as { teamTrainingDays?: string[] }).teamTrainingDays ?? []).join('/')})`;
      case 'generate_program': return `  ${index + 1}. generate the program`;
      case 'plan_change': return `  ${index + 1}. ${describeChange(action.change)}`;
      case 'mark_calendar':
        return `  ${index + 1}. mark ${action.date} as ${action.mark}`;
      case 'declare_source_fact':
        return `  ${index + 1}. declare ${action.fact} on ${action.date}`;
      case 'short_on_time_today':
        return `  ${index + 1}. tap "Short on time today" on ${action.date}`;
      case 'away_this_week':
        return `  ${index + 1}. tap "Away this week?" and pick ${action.dates.join(', ')}`;
      case 'clear_source_facts': return `  ${index + 1}. clear all source facts`;
      case 'advance_time': return `  ${index + 1}. advance time ${action.days} day(s)`;
      default: return `  ${index + 1}. ${JSON.stringify(action)}`;
    }
  }).join('\n');
}

function describeChange(change: PlanChange): string {
  const anyChange = change as Record<string, unknown>;
  switch (change.kind) {
    case 'add_category':
      return `add ${String(anyChange.category)} on ${String(anyChange.date)}${
        anyChange.g1Route ? ` via route ${String(anyChange.g1Route)}` : ''}`;
    case 'swap_category':
      return `swap ${String(anyChange.date)} to ${String(anyChange.category)}`;
    case 'move_session':
      return `move ${String(anyChange.fromDate)} → ${String(anyChange.toDate)}${
        anyChange.scope ? ` (scope ${String(anyChange.scope)})` : ''}`;
    case 'remove_session':
      return `bin ${String(anyChange.date)} (scope ${String(anyChange.scope)})`;
    default:
      return JSON.stringify(change);
  }
}

export type { OnboardingData, TrainingProgram, Workout, ResolvedDay };
