/**
 * The Stage B generation baseline snapshot — Stage 0's differential deliverable.
 *
 * Records what CURRENT generation produces for the scenario matrix, in the
 * app's own canonical semantic projection, so that every later Stage B stage
 * diffs against a committed golden and every diff must match a written
 * prediction (docs/STAGE_B_PROMPT_DRAFT_2026-07-29.md §Discipline).
 *
 * ## What is recorded, per scenario week
 *
 *   - the CONTRACT'S DEMAND: `identity` (mode, subphase, week kind, block
 *     position) and the numeric policies for main strength, core conditioning,
 *     sprint/high-speed and power — because "contracts own counts" is Stage
 *     B's first standing law, and a stage that moves a count has to see the
 *     demand it was assembled against.
 *   - the PRODUCED WEEK: every day in the canonical semantic projection
 *     (`snapshotSemanticWorkout`) — exercise names, order, sets, reps, weight,
 *     rest, prescription type, intensities, durations, components,
 *     conditioning options, athlete-visible presentation. This is the "most
 *     days feel thin" evidence base: the baseline pins today's density so the
 *     5-7 acceptance criterion is a measured diff, not an impression.
 *   - the §18 GATEWAY VERDICT on that week (status + post-gateway weekly
 *     exposure counts), because the assembler must keep
 *     `requireSection18AcceptedWeek` upstream of optional top-ups
 *     (addendum §1.2) and the baseline must show what the gateway does to
 *     today's output.
 *
 * ## What is deliberately NOT recorded
 *
 * Generated ids and id-bearing identity strings (scrubbed to structural
 * labels), timestamps, and free-text reason trails. The power differential's
 * lesson stands: pinning volatile cosmetics trains people to regenerate the
 * golden without reading it, which is how a differential harness dies.
 * `exerciseId` and `name` ARE recorded — they are authored vocabulary, and
 * Stage B's selection changes must show up as predicted name movement.
 */

import type { Microcycle, OnboardingData, TrainingProgram } from '../../types/domain';
import { generateProgramLocally } from '../../services/api/generateProgram';
import { runSection18AcceptedWeekGateway } from '../../rules/section18AcceptedWeekGateway';
import type { WeeklyExposureContractV2 } from '../../rules/weeklyExposureContractV2';
import { countWeeklyExposures } from '../../rules/weeklyExposureCounts';
import type { StressContext } from '../../rules/stressClassification';
import {
  snapshotSemanticWorkout,
  type SemanticDaySnapshot,
} from '../../utils/programSemanticSnapshot';
import { STAGE_B_SCENARIOS, type StageBScenario } from './scenarios';

/** Pinned clock — the same Monday the power differential runs on. */
export const TODAY_ISO = '2026-07-13';

/* ── Snapshot shape ───────────────────────────────────────────────── */

export interface ContractDemandSnapshot {
  identity: {
    mode: string;
    declaredSubphase: string;
    weekKind: string;
    blockNumber: number | null;
    weekInBlock: number | null;
    phaseWeek: number | null;
  };
  mainStrengthExposure: Record<string, unknown>;
  conditioningCore: Record<string, unknown>;
  conditioningIntensityPolicy: Record<string, unknown>;
  sprintExposure: Record<string, unknown>;
  power: {
    eligible: boolean | null;
    plannerSelectedWeeklyBudget: number | null;
  };
}

export interface WeekGenerationSnapshot {
  weekNumber: number;
  weekStart: string;
  weekKind: string;
  contract: ContractDemandSnapshot | null;
  days: SemanticDaySnapshot[];
  section18: {
    status: string;
    visibleCounts: Record<string, unknown>;
  } | null;
}

export interface ScenarioGenerationSnapshot {
  id: string;
  description: string;
  weeks: WeekGenerationSnapshot[];
}

export interface GenerationSnapshot {
  /** Bumped only when the harness's own recorded SHAPE changes. */
  formatVersion: 1;
  todayISO: typeof TODAY_ISO;
  /** Every distinct contract mode the matrix reached — the mode census. */
  modesReached: string[];
  scenarios: ScenarioGenerationSnapshot[];
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function dateForWeekDay(weekStart: string, dayOfWeek: number): string {
  const date = new Date(`${weekStart.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() + (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function stressContext(profile: OnboardingData): StressContext {
  return {
    experienceLevel: profile.experienceLevel,
    conditioningLevel: profile.conditioningLevel,
  };
}

/** Keys that are volatile per generation run, never semantic. */
const VOLATILE_KEYS = new Set(['createdAt', 'updatedAt', 'id', 'workoutId', 'microcycleId']);

/**
 * Deep-remove volatile keys. Component `metadata` embeds whole row/exercise
 * objects, which carry generation-time `createdAt`/`updatedAt` stamps — the
 * determinism probe caught them differing between two same-input runs. Ids are
 * dropped for the same reason the identities below are scrubbed.
 */
function dropVolatile(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(dropVolatile);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !VOLATILE_KEYS.has(key))
      .map(([key, entry]) => [key, dropVolatile(entry)]),
  );
}

/**
 * Scrub generated-id noise from the semantic projection. Workout and component
 * identities embed generated workout ids; a rebuilt engine mints new ids for
 * identical content, and an id-only diff is exactly the cosmetic churn this
 * harness must not train people to wave through. Exercise `identity` collapses
 * to its `exerciseId` (authored vocabulary) for the same reason.
 */
function scrubIdentities(day: SemanticDaySnapshot): SemanticDaySnapshot {
  if (!day.workout) return day;
  return {
    date: day.date,
    workout: {
      ...day.workout,
      identity: 'scrubbed',
      components: day.workout.components.map((component, index) => ({
        ...component,
        identity: `${component.kind}:${index}`,
        metadata: dropVolatile(component.metadata),
        exercises: component.exercises.map((exercise) => ({
          ...exercise,
          identity: exercise.exerciseId,
        })),
      })),
      exercises: day.workout.exercises.map((exercise) => ({
        ...exercise,
        identity: exercise.exerciseId,
      })),
    },
  };
}

function contractDemand(contract: WeeklyExposureContractV2 | undefined): ContractDemandSnapshot | null {
  if (!contract) return null;
  return {
    identity: {
      mode: String(contract.identity.mode),
      declaredSubphase: String(contract.identity.declaredSubphase),
      weekKind: String(contract.identity.weekKind),
      blockNumber: contract.identity.blockNumber,
      weekInBlock: contract.identity.weekInBlock,
      phaseWeek: contract.identity.phaseWeek,
    },
    mainStrengthExposure: { ...contract.mainStrength.exposure },
    conditioningCore: { ...contract.conditioning.core },
    conditioningIntensityPolicy: { ...contract.conditioning.intensityPolicy },
    sprintExposure: { ...contract.sprintHighSpeed.exposure },
    power: {
      eligible: contract.power?.eligible ?? null,
      plannerSelectedWeeklyBudget: contract.power?.plannerSelectedWeeklyBudget ?? null,
    },
  };
}

/** Counts with the volatile per-day trail dropped — numbers and histogram only. */
function countsOnly(
  workouts: Microcycle['workouts'],
  weekStart: string,
  profile: OnboardingData,
): Record<string, unknown> {
  const days = workouts
    .slice()
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    .map((workout) => ({
      date: dateForWeekDay(weekStart, workout.dayOfWeek),
      workout,
    }));
  const counts = countWeeklyExposures(days, stressContext(profile));
  const { days: _perDay, byCategory, ...scalars } = counts;
  return {
    ...scalars,
    byCategory: Object.fromEntries(
      Object.entries(byCategory).sort(([left], [right]) => left.localeCompare(right)),
    ),
  };
}

function section18Snapshot(
  microcycle: Microcycle,
  profile: OnboardingData,
): WeekGenerationSnapshot['section18'] {
  const contract = microcycle.exposureContractV2;
  if (!contract) return null;
  const weekStart = microcycle.startDate.slice(0, 10);
  const result = runSection18AcceptedWeekGateway({
    contract: JSON.parse(JSON.stringify(contract)),
    workouts: microcycle.workouts.map((workout) => ({ ...workout })),
    weekStart,
    profile,
  });
  return {
    status: result.status,
    visibleCounts: countsOnly(result.visibleWorkouts, weekStart, profile),
  };
}

function weekSnapshot(
  microcycle: Microcycle,
  profile: OnboardingData,
): WeekGenerationSnapshot {
  const weekStart = microcycle.startDate.slice(0, 10);
  return {
    weekNumber: microcycle.weekNumber,
    weekStart,
    weekKind: String(microcycle.weekKind ?? 'normal'),
    contract: contractDemand(microcycle.exposureContractV2),
    days: microcycle.workouts
      .slice()
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      .map((workout) =>
        scrubIdentities(
          snapshotSemanticWorkout(dateForWeekDay(weekStart, workout.dayOfWeek), workout),
        )),
    section18: section18Snapshot(microcycle, profile),
  };
}

function generate(scenario: StageBScenario): TrainingProgram {
  return generateProgramLocally(scenario.profile, {
    todayISO: TODAY_ISO,
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: scenario.profile.seasonPhase,
      phaseEntryWeekStartISO: scenario.phaseEntryWeekStartISO ?? TODAY_ISO,
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  });
}

/* ── Entry point ──────────────────────────────────────────────────── */

export function buildGenerationSnapshot(): GenerationSnapshot {
  const scenarios = STAGE_B_SCENARIOS.map((scenario) => {
    const program = generate(scenario);
    return {
      id: scenario.id,
      description: scenario.description,
      weeks: program.microcycles.map((microcycle) =>
        weekSnapshot(microcycle, scenario.profile)),
    };
  });
  const modesReached = Array.from(new Set(
    scenarios.flatMap((scenario) =>
      scenario.weeks.map((week) => week.contract?.identity.mode ?? 'no_contract')),
  )).sort();
  return {
    formatVersion: 1,
    todayISO: TODAY_ISO,
    modesReached,
    scenarios,
  };
}

/** Stable serialisation — key order is the declaration order above, not a Map. */
export function serialiseSnapshot(snapshot: GenerationSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}
