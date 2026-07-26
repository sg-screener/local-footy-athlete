import type { SeasonPhase, Workout } from '../types/domain';
import {
  MOBILITY_FLOW_TEMPLATES,
  type MobilityFlowPhaseSuitability,
  type MobilityFlowTemplate,
} from '../data/mobilityFlowTemplates';
import {
  LOWER_PREHAB_POOL,
  SHOULDER_HEALTH_POOL,
  type PoolExercise,
} from '../data/exercisePools';
import { classifyPoolSlot } from '../data/exercisePoolsStrength';
import { canonicalExerciseName } from './exerciseCanonicalisation';
import { getSessionComponentRows } from './sessionComponents';
import { getTeamTrainingWorkoutState } from './teamTraining';

/**
 * D13 — which Mobility & Prehab flow sits collapsed at the top of a session.
 *
 * Spec: `docs/SESSION_TEMPLATE_SPEC_2026-07-25.md` §4.
 *
 * ## This mapping is a v1 placeholder, on purpose
 *
 * §6 items 6-7: the table below ships now so the collapsed-flow MECHANISM has
 * something to render, and Sam curates the real per-session-type menus later —
 * the same way he curated the exercise vocabulary and the conditioning grid.
 * His own example of the shape he wants is richer than this: an upper-push day
 * might carry dead hangs, a pec stretch, external rotations and scap pull-ups.
 * Treat every mapping here as provisional; the SELECTION RULES (dominant
 * pattern → template, phase filter, game-week override) are the durable part.
 *
 * ## The flow is never load-bearing
 *
 * §6 item 6 is explicit: the product assumes athletes will sometimes skip the
 * flow entirely, so any prehab that matters must live in the session as an
 * ordinary badged row. Nothing in this module feeds `SessionComponentKind`,
 * conditioning credit, the Finish action, or the feedback panel — and
 * `mobilityPrehabFlowTests` §5 fails if a future change wires it in.
 *
 * Primers are read out of the curated pools by pool id rather than written as
 * name literals, so the flow can only ever name an exercise the app can cue.
 */

export interface MobilityPrehabFlow {
  template: MobilityFlowTemplate;
  /** Session-appropriate low-load activation, shown with the flow's movements. */
  primers: PoolExercise[];
  movementCount: number;
  durationMinutes: number;
}

export interface MobilityPrehabFlowContext {
  workout: Partial<Workout> | null | undefined;
  seasonPhase: SeasonPhase | null | undefined;
  isGameWeek: boolean;
}

type SessionShape = 'upper' | 'lower_squat' | 'lower_hinge' | 'full_body';

const CONDITIONING_ONLY_TYPES: ReadonlySet<string> = new Set([
  'Conditioning',
  'Flush-Out',
  'Sprint-Intervals',
  'Hill-Sprints',
  'MAS-Training',
  'Quality-Sprints',
  'MetCon',
  'Flog-Friday',
  'Long-Run',
  '6x1km',
  'Tempo-Run',
]);

const UPPER_SLOTS = new Set([
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
]);

/** §4.1's v1 table, as template ids. Provisional pending Sam's curation session. */
const TEMPLATE_FOR_SHAPE: Record<SessionShape, string> = {
  upper: 't-spine-shoulder-reset',
  lower_squat: 'lower-body-reset',
  lower_hinge: 'hamstring-hip-hinge-reset',
  full_body: 'pre-training-movement-prep',
};

const GAME_WEEK_TEMPLATE = 'game-week-light-mobility';

function poolEntry(pool: PoolExercise[], id: string): PoolExercise | null {
  return pool.find((entry) => entry.id === id) ?? null;
}

/** Primers by shape, named through curated pool ids so they always cue. */
function primersForShape(shape: SessionShape): PoolExercise[] {
  const upper = poolEntry(SHOULDER_HEALTH_POOL, 'band-ext-rot');
  const knee = poolEntry(LOWER_PREHAB_POOL, 'spanish-squat');
  const hamstring = poolEntry(LOWER_PREHAB_POOL, 'bosch-hold');

  if (shape === 'upper') return [upper].filter(Boolean) as PoolExercise[];
  if (shape === 'lower_squat') return [knee].filter(Boolean) as PoolExercise[];
  if (shape === 'lower_hinge') return [hamstring].filter(Boolean) as PoolExercise[];
  return [upper, knee].filter(Boolean) as PoolExercise[];
}

function isRecoveryWorkout(workout: any): boolean {
  return workout?.workoutType === 'Recovery' || workout?.sessionTier === 'recovery';
}

/**
 * The session's dominant movement pattern, read off the rows the athlete will
 * actually do. Returns null when nothing classifies — a session with no
 * recognisable strength pattern has no basis for a pattern-matched flow, and
 * guessing one would be worse than offering none.
 */
function sessionShape(workout: Partial<Workout>): SessionShape | null {
  const rows = getSessionComponentRows(workout);
  const candidates = [...rows.strengthRows, ...rows.supportRows];

  let squat = 0;
  let hinge = 0;
  let upper = 0;
  for (const row of candidates) {
    const name = canonicalExerciseName(
      String(row?.exercise?.name ?? row?.name ?? '').trim(),
    );
    if (!name) continue;
    const slot = classifyPoolSlot(name)?.slot;
    if (!slot) continue;
    if (slot === 'squat') squat += 1;
    else if (slot === 'hinge') hinge += 1;
    else if (UPPER_SLOTS.has(slot)) upper += 1;
  }

  const lower = squat + hinge;
  if (lower === 0 && upper === 0) return null;
  if (lower > 0 && upper > 0) return 'full_body';
  if (upper > 0) return 'upper';
  return squat >= hinge ? 'lower_squat' : 'lower_hinge';
}

function phaseKeys(
  seasonPhase: SeasonPhase | null | undefined,
  isGameWeek: boolean,
): MobilityFlowPhaseSuitability[] {
  const keys: MobilityFlowPhaseSuitability[] = [];
  if (seasonPhase) keys.push(seasonPhase);
  if (isGameWeek) keys.push('Game week');
  return keys;
}

/**
 * A template is eligible when the catalog says it suits the athlete's current
 * phase. With no known phase we cannot filter honestly, so nothing is excluded.
 */
function suitsPhase(
  template: MobilityFlowTemplate,
  keys: MobilityFlowPhaseSuitability[],
): boolean {
  if (keys.length === 0) return true;
  return keys.some((key) => template.phaseSuitability.includes(key));
}

function templateById(id: string): MobilityFlowTemplate | null {
  return MOBILITY_FLOW_TEMPLATES.find((template) => template.id === id) ?? null;
}

export function selectMobilityPrehabFlow(
  context: MobilityPrehabFlowContext,
): MobilityPrehabFlow | null {
  const { workout, seasonPhase, isGameWeek } = context;
  if (!workout) return null;

  // Three ruled exclusions. A whole recovery day makes the flow redundant (§6
  // item 3); conditioning-only days get no flow in v1 (§6 item 8); a team-only
  // day has no gym session to prime for.
  if (isRecoveryWorkout(workout)) return null;
  if (CONDITIONING_ONLY_TYPES.has(String(workout.workoutType ?? ''))) return null;
  if (getTeamTrainingWorkoutState(workout).isTeamTrainingOnly) return null;

  const shape = sessionShape(workout);
  if (!shape) return null;

  const keys = phaseKeys(seasonPhase, isGameWeek);

  // Game week overrides the pattern match — but the phase filter still applies,
  // so an out-of-scope phase falls back to the pattern-matched template rather
  // than serving a template the catalog says is unsuitable.
  const candidates = [
    ...(isGameWeek ? [GAME_WEEK_TEMPLATE] : []),
    TEMPLATE_FOR_SHAPE[shape],
  ];

  for (const id of candidates) {
    const template = templateById(id);
    if (!template || !suitsPhase(template, keys)) continue;
    const primers = id === GAME_WEEK_TEMPLATE ? [] : primersForShape(shape);
    return {
      template,
      primers,
      movementCount: template.movements.length + primers.length,
      durationMinutes: template.durationMinutes,
    };
  }

  return null;
}
