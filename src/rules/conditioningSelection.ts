/**
 * CONDITIONING SELECTION + COMPOSITION — the one owner that turns Sam's 55
 * signed templates into the athlete's conditioning and speed sessions.
 *
 * Stage B's switchover (prediction:
 * `docs/STAGE_B_STAGE2_SWITCHOVER_PREDICTION_2026-08-05.md`). Before this
 * module, the generation path authored its own doses in twelve places and
 * named sessions in a vocabulary nobody signed. The Bible is explicit:
 * "Conditioning doses are NOT defined in this Bible ... Doses come from the
 * templates sheet. A layer that invents its own conditioning dose is a
 * defect." This module never writes a number that did not come from the
 * sheet: quantities are read through `parseConditioningDose` — the single
 * ingress — and every athlete-visible word on the headline row is the
 * authored string verbatim.
 *
 * WHAT THIS MODULE DECIDES (selection policy — allowed):
 *   - which quality tabs serve each of the app's demand categories;
 *   - which tab rows count as tempo vs steady inside Aerobic Capacity
 *     (the one tab that serves two demand categories);
 *   - which template a given day gets, deterministically, with the same
 *     seeds the old path used (mini-cycle-stable index, else date hash).
 *
 * WHAT IT NEVER DECIDES (doses — forbidden): work, rest, sets, intensity,
 * session time. Those are the sheet's, field for field.
 *
 * L14: pure. No store, no clock beyond the dateStr it is handed, no React.
 */

import {
  CONDITIONING_TEMPLATES,
  LEGACY_CONDITIONING_FORMAT_MAP,
  type ConditioningModality,
  type ConditioningQuality,
  type ConditioningTemplate,
} from '../data/conditioningTemplates';
import {
  doseMidpoint,
  doseSeconds,
  parseConditioningDose,
} from './conditioningDose';
import type { WorkoutExercise, WorkoutType } from '../types/domain';

/* ── The surviving demand vocabulary ── */

/** The app's conditioning demand categories (allocation vocabulary). */
export type AthleteConditioningCategory =
  | 'aerobic_base'
  | 'tempo'
  | 'sprint'
  | 'vo2'
  | 'glycolytic';

/** Placement tier — the eligibility engine's vocabulary, unchanged. */
export type ConditioningSelectionTier = 'A' | 'B-high' | 'B-low' | 'C';

/** The role a conditioning block plays in its session. Selection-time only. */
export type ConditioningRole = 'standalone' | 'finisher' | 'component';

/* ── Tier ← quality (placement policy, declared once) ── */

/**
 * Which tier each quality tab's sessions occupy in the eligibility engine.
 * Placement policy, not dose: A = maximal/sprint-family + glycolytic work,
 * B-high = aerobic power, B-low = aerobic capacity, C = flush/recovery.
 */
export const TIER_FOR_QUALITY: Readonly<Record<ConditioningQuality, ConditioningSelectionTier>> = {
  acceleration: 'A',
  top_end_speed: 'A',
  repeat_sprint: 'A',
  cod_decel: 'A',
  anaerobic: 'A',
  aerobic_power: 'B-high',
  aerobic_capacity: 'B-low',
  flush: 'C',
};

/* ── Category ← quality pools ── */

const byName = new Map<string, ConditioningTemplate>(
  CONDITIONING_TEMPLATES.map((template) => [template.name, template]),
);

function mustExist(names: readonly string[]): readonly string[] {
  for (const name of names) {
    if (!byName.has(name)) {
      throw new Error(
        `conditioningSelection names a template the sheet does not carry: "${name}" — `
        + 'the equality gate holds the sheet and module in lockstep, so this name is stale.',
      );
    }
  }
  return names;
}

/**
 * Aerobic Capacity is the one tab serving TWO demand categories. The split is
 * selection policy declared here once; the names are checked against the
 * sheet at module init so a Sam rename cannot leave a dangling reference.
 */
const TEMPO_CAPACITY_TEMPLATES = mustExist([
  '30:30 Controlled Tempo Blocks',
  '1 min On / 1 min Easy Tempo',
  '2 min On / 1 min Easy',
  'Extensive Tempo (100 m repeats)',
  'Aerobic Shuttles',
]);

const STEADY_CAPACITY_TEMPLATES = mustExist([
  'Continuous Aerobic Run',
  'Steady Blocks (3×8 min or 4×6 min)',
  'Long Aerobic Intervals',
  'Controlled 10–20 min Blocks',
  'Steady 5 min Blocks',
]);

function templatesOfQuality(...qualities: ConditioningQuality[]): ConditioningTemplate[] {
  return CONDITIONING_TEMPLATES.filter((template) => qualities.includes(template.quality));
}

function poolForCategory(category: AthleteConditioningCategory): ConditioningTemplate[] {
  switch (category) {
    case 'aerobic_base':
      return STEADY_CAPACITY_TEMPLATES.map((name) => byName.get(name)!);
    case 'tempo':
      return TEMPO_CAPACITY_TEMPLATES.map((name) => byName.get(name)!);
    case 'vo2':
      return templatesOfQuality('aerobic_power');
    case 'glycolytic':
      return templatesOfQuality('anaerobic');
    case 'sprint':
      return templatesOfQuality('acceleration', 'top_end_speed', 'repeat_sprint');
  }
}

/** The tier pools the eligibility engine selects from. */
export function templatesForTier(tier: ConditioningSelectionTier): ConditioningTemplate[] {
  return CONDITIONING_TEMPLATES.filter(
    (template) => TIER_FOR_QUALITY[template.quality] === tier,
  );
}

/* ── Modality renderability (read from the authored notes) ── */

/**
 * Which modalities a template's authored `modalityNotes` prose admits.
 * The notes are the only place per-row renderability is authored (a known
 * representation gap, same as `equipmentVocabulary`'s reader) — this reader
 * is deliberately conservative and mirrors Sam's own wording.
 */
export function renderableModalities(template: ConditioningTemplate): ConditioningModality[] {
  const full = template.modalityNotes.toLowerCase();
  if (/all 5 modalities|any modality/.test(full)) {
    return ['run', 'bike', 'air_bike', 'ski', 'row'];
  }
  // A clause like "Ski/Row use 'Steady Blocks'" or "Ski/Row/Air Bike
  // substitute ..." names modalities the row does NOT render on — it points
  // them at a different authored row. Those sentences must not read as
  // renderability.
  const lower = full
    .split(/[.;]/)
    .filter((sentence) => !/\buse\b|substitut/.test(sentence))
    .join('. ');
  const out = new Set<ConditioningModality>();
  const excluded = /ski\s*\/\s*row excluded|no ski\s*\/\s*row|ski\/row excluded/.test(lower);
  if (/run-only|\brun\b/.test(lower)) out.add('run');
  if (/\bair bike\b|\bassault\b/.test(lower)) out.add('air_bike');
  if (lower.replace(/air bike/g, '').includes('bike')) out.add('bike');
  if (!excluded && /\brow\b|\browing\b|\browers?\b/.test(lower)) out.add('row');
  if (!excluded && /\bski\b/.test(lower)) out.add('ski');
  if (/erg only|erg-only/.test(lower)) {
    out.add('row'); out.add('ski'); out.add('air_bike'); out.add('bike');
    out.delete('run');
  }
  if (/no machine rendering/.test(lower)) {
    for (const machine of ['bike', 'air_bike', 'ski', 'row'] as const) out.delete(machine);
    out.add('run');
  }
  // Modality-agnostic work (e.g. the bodyweight fallback) names no modality;
  // treat it as runnable anywhere so no filter can strand it.
  if (out.size === 0) return ['run', 'bike', 'air_bike', 'ski', 'row'];
  return [...out];
}

export function rendersOffFeet(template: ConditioningTemplate): boolean {
  return renderableModalities(template).some((modality) => modality !== 'run');
}

export function rendersOnRun(template: ConditioningTemplate): boolean {
  return renderableModalities(template).includes('run');
}

/* ── Deterministic seeds (same as the retired path) ── */

export function conditioningSelectionHash(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/* ── Selection ── */

export interface ConditioningSelectionArgs {
  readonly category: AthleteConditioningCategory;
  readonly dateStr: string;
  /** Block-stable rotation: stable within a mini-cycle, rotates at the boundary. */
  readonly miniCycleNumber?: number;
  /** The block must render off feet (run load caps, lower-body pairing). */
  readonly offFeet?: boolean;
  /** The athlete has no ergs — the template must render on run/bodyweight. */
  readonly runOnly?: boolean;
  /**
   * The machine modalities the athlete actually has. When present, a
   * template must render on run or on an owned machine to be selectable,
   * and an off-feet requirement must be satisfiable on an OWNED machine.
   */
  readonly availableMachines?: readonly ConditioningModality[];
  /** The week carries NO team training (lifts the availability gate). */
  readonly noTeamTrainingWeek?: boolean;
  readonly role?: ConditioningRole;
}

/** Parsed low end of the authored total session time, or null. */
function totalMinutesLow(template: ConditioningTemplate): number | null {
  const parsed = parseConditioningDose(template.totalSessionTime);
  if (!parsed.ok) return null;
  const seconds = doseSeconds(parsed.quantity);
  return seconds ? seconds.min / 60 : null;
}

/** Role caps: a finisher/component must not dominate its session. */
const ROLE_MAX_MINUTES: Readonly<Record<ConditioningRole, number | null>> = {
  standalone: null,
  finisher: 16,
  component: 32,
};

/**
 * Deterministically select the authored template serving a demand category.
 * Filters are selection policy; the returned template is Sam's, untouched.
 */
export function selectConditioningTemplate(
  args: ConditioningSelectionArgs,
): ConditioningTemplate {
  const role = args.role ?? 'standalone';
  const pool = poolForCategory(args.category);

  const filters: Array<(template: ConditioningTemplate) => boolean> = [
    (template) =>
      !template.properties.includes('finisher_role_only') || role === 'finisher',
    (template) =>
      !template.properties.includes('fallback_only') || args.runOnly === true,
    (template) =>
      !template.properties.includes('availability_gate_no_team_training')
      || args.noTeamTrainingWeek === true,
  ];
  const machineOwned = (modality: ConditioningModality): boolean =>
    args.availableMachines === undefined || args.availableMachines.includes(modality);
  if (args.offFeet) {
    filters.push((template) =>
      renderableModalities(template).some((m) => m !== 'run' && machineOwned(m)));
  } else if (args.availableMachines !== undefined) {
    filters.push((template) =>
      renderableModalities(template).some((m) => m === 'run' || machineOwned(m)));
  }
  if (args.runOnly) filters.push(rendersOnRun);
  const cap = ROLE_MAX_MINUTES[role];
  const withinCap = (template: ConditioningTemplate): boolean => {
    if (cap === null) return true;
    const minutes = totalMinutesLow(template);
    return minutes === null || minutes <= cap;
  };

  let candidates = pool.filter((template) => filters.every((filter) => filter(template)));
  // A role cap is a preference, not a wall — when it empties the pool the
  // authored session runs long rather than a dose being invented short.
  const capped = candidates.filter(withinCap);
  if (capped.length > 0) candidates = capped;
  if (candidates.length === 0) candidates = pool;

  const index = args.miniCycleNumber !== undefined
    ? (Math.max(1, args.miniCycleNumber) - 1) % candidates.length
    : conditioningSelectionHash(args.dateStr) % candidates.length;
  return candidates[index];
}

/**
 * The off-feet rendering of a session: an authored template of the SAME
 * quality that renders on a machine. Replaces the retired parallel dose
 * library (`switchToOffFeetModality`) — the run cap now swaps templates
 * inside the authored sheet instead of re-authoring the dose. Null when the
 * quality has no off-feet row (the sprint family — which is exactly the set
 * the old guard refused to convert).
 */
export function offFeetAlternative(
  name: string,
  dateStr: string,
): ConditioningTemplate | null {
  const template = resolveTemplateByName(name);
  if (!template) return null;
  const pool = CONDITIONING_TEMPLATES.filter(
    (candidate) => candidate.quality === template.quality && rendersOffFeet(candidate),
  );
  if (pool.length === 0) return null;
  return pool[conditioningSelectionHash(dateStr) % pool.length];
}

/* ── Name resolution for stored/legacy content ── */

/**
 * Resolve a session name to an authored template: the authored vocabulary
 * first, then Sam's legacy-format map. `null` means the name is not the
 * template vocabulary's to render (stored legacy content keeps its words —
 * rendering them is not inventing a dose).
 */
export function resolveTemplateByName(name: string): ConditioningTemplate | null {
  const direct = byName.get(name);
  if (direct) return direct;
  const legacy = LEGACY_CONDITIONING_FORMAT_MAP.find((entry) => entry.legacyName === name);
  if (legacy && legacy.resolution.kind === 'template') {
    return byName.get(legacy.resolution.templateName) ?? null;
  }
  return null;
}

/* ── Composition (dose parse → rows) ── */

function nowISO(): string {
  return new Date().toISOString();
}

function conditioningRow(
  id: string,
  name: string,
  order: number,
  sets: number,
  rest: number,
  notes?: string,
): WorkoutExercise {
  const now = nowISO();
  return {
    id,
    workoutId: '',
    exerciseId: id,
    exerciseOrder: order,
    prescribedSets: sets,
    prescribedRepsMin: 1,
    prescribedRepsMax: 1,
    restSeconds: rest,
    notes,
    exercise: {
      id,
      name,
      description: notes || name,
      muscleGroups: [],
      exerciseType: 'Cardio' as const,
      equipmentRequired: [],
      difficultyLevel: 'Intermediate' as const,
      createdAt: now,
      updatedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}

/** Sets for the headline row: the authored governing quantity, or 1. */
function headlineSets(template: ConditioningTemplate): number {
  const parsed = parseConditioningDose(template.setsRounds);
  if (!parsed.ok) return 1;
  return Math.max(1, Math.round(doseMidpoint(parsed.quantity)));
}

/** Rest seconds for the headline row: the authored rest, when it is a time. */
function headlineRest(template: ConditioningTemplate): number {
  const parsed = parseConditioningDose(template.restPeriod);
  if (!parsed.ok) return 0;
  const seconds = doseSeconds(parsed.quantity);
  return seconds ? Math.round((seconds.min + seconds.max) / 2) : 0;
}

function joinNotes(...lines: Array<string | false | null | undefined>): string {
  return lines
    .filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
    .join('\n');
}

export interface ComposeOptions {
  readonly idPrefix?: string;
  readonly orderBase?: number;
  /** Skip the structural warm-up row (combined days warm up on the lift). */
  readonly omitWarmup?: boolean;
}

/**
 * The template as rows. One structural `Warm-up` row (no invented
 * prescription text — authoring warm-up copy is Sam's, parked), then the
 * headline row: authored name verbatim, parsed sets/rest, authored fields
 * as the notes. No cool-down row — recovery is the Flush tab's job.
 */
export function composeConditioningRows(
  template: ConditioningTemplate,
  dateStr: string,
  opts: ComposeOptions = {},
): WorkoutExercise[] {
  const prefix = opts.idPrefix ?? `cond-${dateStr}`;
  const base = opts.orderBase ?? 1;
  const rows: WorkoutExercise[] = [];
  if (!opts.omitWarmup) {
    rows.push(conditioningRow(`${prefix}-warmup`, 'Warm-up', base, 1, 0));
  }
  rows.push(
    conditioningRow(
      `${prefix}-main`,
      template.name,
      base + rows.length,
      headlineSets(template),
      headlineRest(template),
      joinNotes(
        `Work: ${template.workPeriod}`,
        `Rest: ${template.restPeriod}`,
        `Sets: ${template.setsRounds}`,
        `Intensity: ${template.intensity}`,
        template.effortCue,
        template.modalityNotes,
      ),
    ),
  );
  return rows;
}

/* ── Session type (category-level, replacing the per-name map) ── */

export function workoutTypeForCategory(
  category: AthleteConditioningCategory | null,
  tier?: ConditioningSelectionTier,
): WorkoutType {
  if (tier === 'C') return 'Recovery';
  switch (category) {
    case 'sprint': return 'Sprint-Intervals';
    case 'tempo': return 'Tempo-Run';
    case 'aerobic_base': return 'Long-Run';
    default: return 'Conditioning';
  }
}

export function workoutTypeForTemplate(template: ConditioningTemplate): WorkoutType {
  const tier = TIER_FOR_QUALITY[template.quality];
  if (tier === 'C') return 'Recovery';
  if (
    template.quality === 'acceleration'
    || template.quality === 'top_end_speed'
    || template.quality === 'repeat_sprint'
  ) return 'Sprint-Intervals';
  if (TEMPO_CAPACITY_TEMPLATES.includes(template.name)) return 'Tempo-Run';
  if (STEADY_CAPACITY_TEMPLATES.includes(template.name)) return 'Long-Run';
  return 'Conditioning';
}

/* ── Speed (the sprint-family templates as SpeedBlock content) ── */

/**
 * The authored successor for every retired speed micro-dose (the Stage B
 * pins name it: `buildSprintMicroDose`, `buildSprintReducedVolume` and
 * `createQualitySpeedMicroDoseBlock` are all superseded by this row).
 */
export const SPEED_FALLBACK_TEMPLATE = '20 m Acceleration Reps';

/** Late-off-season speed selection, by the same position logic as before. */
export function lateOffseasonSpeedTemplateName(args: {
  position: number;
  preferAcceleration?: boolean;
}): string {
  if (args.position <= 1) return 'Hill Acceleration';
  if (args.position === 2) return '20 m Acceleration Reps';
  // Sam's ruling 0: only the step that LEAVES accelerations changes — a
  // power weakness holds the acceleration exposure instead of progressing
  // to the flying reintroduction. Earlier positions are identical either way.
  if (args.preferAcceleration) return '20 m Acceleration Reps';
  return 'Off-Season Speed Reintroduction';
}

mustExist([SPEED_FALLBACK_TEMPLATE, 'Hill Acceleration', 'Off-Season Speed Reintroduction']);

export function speedTemplateByName(name: string): ConditioningTemplate {
  const template = byName.get(name) ?? byName.get(SPEED_FALLBACK_TEMPLATE)!;
  return template;
}

/** Speed rows: structural warm-up + the authored template row. */
export function composeSpeedRows(
  templateName: string | undefined,
  dateStr: string,
  idSeed = '',
): WorkoutExercise[] {
  const template = speedTemplateByName(templateName ?? SPEED_FALLBACK_TEMPLATE);
  return composeConditioningRows(template, dateStr, {
    idPrefix: `speed-${dateStr}${idSeed ? `-${idSeed}` : ''}`,
  });
}

/** The authored template's whole-session length, for SpeedBlock display. */
export function templateDurationMinutes(template: ConditioningTemplate): number {
  const parsed = parseConditioningDose(template.totalSessionTime);
  if (!parsed.ok) return 15;
  const seconds = doseSeconds(parsed.quantity);
  return seconds ? Math.max(1, Math.round((seconds.min + seconds.max) / 120)) : 15;
}

/** The authored dose as one line, authored fields joined, nothing rewritten. */
export function templatePrescriptionLine(template: ConditioningTemplate): string {
  return `${template.setsRounds} · ${template.workPeriod} · ${template.restPeriod}`;
}
