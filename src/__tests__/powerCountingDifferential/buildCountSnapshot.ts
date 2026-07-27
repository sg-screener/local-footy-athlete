/**
 * The differential count snapshot — Stage 1 of the power-row redesign.
 *
 *   docs/POWER_ROW_OWNERSHIP_REASSESSMENT_2026-07-27.md §7
 *
 * ## Why a snapshot rather than assertions
 *
 * Today power's counting fence is enforced BY ABSENCE: power is not in
 * `workout.exercises[]`, so nothing that iterates exercises can count it. The
 * fence object on `PowerBlock` documents a guarantee the data shape already
 * makes. Move power into the list and that guarantee evaporates unless
 * something else re-establishes it.
 *
 * Hand-written assertions can only defend the counters someone thought to name.
 * The reassessment's own sweep found four taxonomy probes and nine strip sites;
 * the honest position is that it may not have found everything. So this harness
 * records EVERY count the production code produces for a fixed scenario matrix,
 * on current `main`, and later stages must reproduce the file byte for byte.
 * A counter nobody listed is still in the file, and still breaks the build if
 * it moves.
 *
 * ## What is recorded
 *
 * Per scenario week:
 *   - `countWeeklyExposures` in full — hard exposures, hard days, main-strength
 *     exposures, conditioning credit, running, sprint/COD, gunshow, recovery,
 *     team anchors, games, and the per-category histogram.
 *   - per day: the taxonomy's classified units (category + modality), the
 *     session components (which is where `finisher` lives), the counted row
 *     populations that feed the per-session exercise budget, and the
 *     representation-neutral power projection.
 *   - the §18 accepted-week gateway's weekly power budget: which days keep
 *     power, which are stripped, and the contract fields that record why.
 *
 * ## What is deliberately NOT recorded
 *
 * Timestamps, ids that embed a workout id, and free-text `reason` trails. Those
 * are not counts, and pinning them would make the harness fail on cosmetic
 * edits — which trains people to regenerate the golden without reading it,
 * which is how a differential harness dies.
 */

import type {
  Microcycle,
  OnboardingData,
  TrainingProgram,
  Workout,
} from '../../types/domain';
import { generateProgramLocally } from '../../services/api/generateProgram';
import { classifyDaySessions } from '../../rules/sessionTaxonomy';
import { countWeeklyExposures } from '../../rules/weeklyExposureCounts';
import { getSessionComponentRows, getSessionComponents } from '../../utils/sessionComponents';
import { runSection18AcceptedWeekGateway } from '../../rules/section18AcceptedWeekGateway';
import type { StressContext } from '../../rules/stressClassification';
import { projectPower, powerDays, type ProjectedPower } from './powerProjection';
import { POWER_SCENARIOS, type PowerScenario } from './scenarios';

const TODAY_ISO = '2026-07-13';

/* ── Snapshot shape ───────────────────────────────────────────────── */

export interface DaySnapshot {
  dayOfWeek: number;
  name: string;
  workoutType: string;
  /** Taxonomy units — the classifier the power row would leak into. */
  taxonomy: Array<{ category: string; modality: string }>;
  /** Session components; `finisher` is one of these kinds. */
  components: string[];
  /** Row populations that feed the per-session exercise budget. */
  countedRows: {
    strength: number;
    support: number;
    conditioning: number;
    /** Every row in `exercises[]`, whatever its population. */
    total: number;
  };
  strengthRowNames: string[];
  power: ProjectedPower | null;
}

export interface WeekSnapshot {
  weekNumber: number;
  weekKind: string;
  counts: Record<string, unknown>;
  days: DaySnapshot[];
  section18: {
    status: string;
    powerBudget: number | null;
    powerEligible: boolean | null;
    achievedPrimerCount: number | null;
    removalReason: string | null;
    /** Days carrying power BEFORE the gateway's weekly budget selector. */
    powerDaysBefore: number[];
    /** Days still carrying power after it. */
    powerDaysKept: number[];
    powerDaysStripped: number[];
    /** Counts recomputed on the accepted visible week. */
    visibleCounts: Record<string, unknown>;
  } | null;
}

/**
 * The over-budget probe.
 *
 * Generation never hands §18 more power than the weekly budget allows — the
 * allocation layer has already applied the same gates — so on a generated week
 * the selector's STRIP path never runs. That is a real gap: nine sites in the
 * codebase strip power by deleting the field, and Stage 3 replaces all of them
 * with row removal through the transaction owner. Byte-equivalence on a path
 * that never executes proves nothing.
 *
 * So the probe takes a real accepted week and its real contract, stamps power
 * onto every strength day, and runs the gateway. That over-fills the budget and
 * forces the selector to choose — which is the behaviour Sam named ("the §18
 * gateway keeps/strips the same days for the same input").
 */
export interface OverBudgetProbeSnapshot {
  weekNumber: number;
  budget: number | null;
  /** Days carrying power after the probe stamped them, before the gateway. */
  powerDaysBefore: number[];
  powerDaysKept: number[];
  powerDaysStripped: number[];
  /** Family per kept day — the selector prefers family diversity. */
  keptFamilies: Array<{ dayOfWeek: number; family: string }>;
  achievedPrimerCount: number | null;
  removalReason: string | null;
  /** Counts on the over-filled week, so the fence is pinned here too. */
  visibleCounts: Record<string, unknown>;
}

export interface ScenarioSnapshot {
  id: string;
  description: string;
  weeks: WeekSnapshot[];
  /** Null when no week in the scenario is power-eligible. */
  overBudgetProbe: OverBudgetProbeSnapshot | null;
}

export interface CountSnapshot {
  /** Bumped only when the harness's own recorded SHAPE changes. */
  formatVersion: 1;
  scenarios: ScenarioSnapshot[];
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
    teamTrainingIntensity: profile.teamTrainingIntensity,
  };
}

function rowNames(rows: readonly any[]): string[] {
  return rows
    .map((row) => String(row?.exercise?.name ?? row?.name ?? '').trim())
    .filter(Boolean);
}

/** Counts with the volatile per-day trail dropped — numbers and histogram only. */
function countsOnly(
  workouts: readonly Workout[],
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

function daySnapshot(workout: Workout): DaySnapshot {
  const rows = getSessionComponentRows(workout);
  return {
    dayOfWeek: workout.dayOfWeek,
    name: workout.name,
    workoutType: String(workout.workoutType ?? ''),
    taxonomy: classifyDaySessions(workout).map((unit) => ({
      category: unit.category,
      modality: unit.modality,
    })),
    components: getSessionComponents(workout).map((component) => component.kind),
    countedRows: {
      strength: rows.strengthRows.length,
      support: rows.supportRows.length,
      conditioning: rows.conditioningRows.length,
      total: (workout.exercises ?? []).length,
    },
    strengthRowNames: rowNames(rows.strengthRows),
    power: projectPower(workout),
  };
}

function section18Snapshot(
  microcycle: Microcycle,
  profile: OnboardingData,
): WeekSnapshot['section18'] {
  const contract = microcycle.exposureContractV2;
  if (!contract) return null;
  const weekStart = microcycle.startDate.slice(0, 10);
  const before = powerDays(microcycle.workouts);
  const result = runSection18AcceptedWeekGateway({
    contract: JSON.parse(JSON.stringify(contract)),
    workouts: microcycle.workouts.map((workout) => ({ ...workout })),
    weekStart,
    profile,
  });
  const kept = powerDays(result.canonicalWorkouts);
  return {
    status: result.status,
    powerBudget: result.contract.power?.plannerSelectedWeeklyBudget ?? null,
    powerEligible: result.contract.power?.eligible ?? null,
    achievedPrimerCount: result.contract.power?.achievedPrimerCount ?? null,
    removalReason: result.contract.power?.removalReason ?? null,
    powerDaysBefore: before,
    powerDaysKept: kept,
    powerDaysStripped: before.filter((day) => !kept.includes(day)),
    visibleCounts: countsOnly(result.visibleWorkouts, weekStart, profile),
  };
}

function weekSnapshot(microcycle: Microcycle, profile: OnboardingData): WeekSnapshot {
  const weekStart = microcycle.startDate.slice(0, 10);
  return {
    weekNumber: microcycle.weekNumber,
    weekKind: String(microcycle.weekKind ?? 'normal'),
    counts: countsOnly(microcycle.workouts, weekStart, profile),
    days: microcycle.workouts
      .slice()
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      .map(daySnapshot),
    section18: section18Snapshot(microcycle, profile),
  };
}

/**
 * Stamp power onto every strength day of a week, alternating family.
 *
 * Alternating matters: the selector's second rule prefers a different family
 * when one is available, so a same-family fill would keep the rule dark. The
 * block is cloned from whatever the week already produced, so the dose and the
 * fence stay production values rather than harness inventions.
 */
function overFillPower(workouts: readonly Workout[]): Workout[] {
  const template = workouts.map((workout) => workout.powerBlock).find(Boolean);
  if (!template) return workouts.map((workout) => ({ ...workout }));
  let index = 0;
  return workouts.map((workout) => {
    const strengthRows = getSessionComponentRows(workout).strengthRows.length;
    if (strengthRows === 0) return { ...workout };
    const family = index % 2 === 0 ? 'lower' : 'upper';
    index += 1;
    return {
      ...workout,
      powerBlock: {
        ...template,
        id: `probe-power-${workout.dayOfWeek}`,
        family: family as typeof template.family,
      },
    };
  });
}

function overBudgetProbe(
  program: TrainingProgram,
  profile: OnboardingData,
): OverBudgetProbeSnapshot | null {
  const microcycle = program.microcycles.find((cycle) =>
    !!cycle.exposureContractV2 &&
    cycle.exposureContractV2.power?.eligible !== false &&
    cycle.workouts.some((workout) => !!workout.powerBlock));
  if (!microcycle?.exposureContractV2) return null;

  const weekStart = microcycle.startDate.slice(0, 10);
  const filled = overFillPower(microcycle.workouts);
  const before = powerDays(filled);
  const result = runSection18AcceptedWeekGateway({
    contract: JSON.parse(JSON.stringify(microcycle.exposureContractV2)),
    workouts: filled,
    weekStart,
    profile,
  });
  const kept = powerDays(result.canonicalWorkouts);
  return {
    weekNumber: microcycle.weekNumber,
    budget: result.contract.power?.plannerSelectedWeeklyBudget ?? null,
    powerDaysBefore: before,
    powerDaysKept: kept,
    powerDaysStripped: before.filter((day) => !kept.includes(day)),
    keptFamilies: result.canonicalWorkouts
      .filter((workout) => !!workout.powerBlock)
      .map((workout) => ({
        dayOfWeek: workout.dayOfWeek,
        family: workout.powerBlock!.family,
      }))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek),
    achievedPrimerCount: result.contract.power?.achievedPrimerCount ?? null,
    removalReason: result.contract.power?.removalReason ?? null,
    visibleCounts: countsOnly(result.visibleWorkouts, weekStart, profile),
  };
}

function generate(scenario: PowerScenario): TrainingProgram {
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

export function buildCountSnapshot(): CountSnapshot {
  return {
    formatVersion: 1,
    scenarios: POWER_SCENARIOS.map((scenario) => {
      const program = generate(scenario);
      return {
        id: scenario.id,
        description: scenario.description,
        weeks: program.microcycles.map((microcycle) =>
          weekSnapshot(microcycle, scenario.profile)),
        overBudgetProbe: overBudgetProbe(program, scenario.profile),
      };
    }),
  };
}

/** Stable serialisation — key order is the declaration order above, not a Map. */
export function serialiseSnapshot(snapshot: CountSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}
