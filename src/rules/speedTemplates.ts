import type {
  SeasonPhase,
  SpeedBlock,
  SpeedBlockPlacement,
} from '../types/domain';
import type { OffseasonSubphase } from './offseasonSubphase';

export type SpeedTemplateId =
  | 'late_offseason_low_risk_acceleration'
  | 'late_offseason_acceleration_build'
  | 'late_offseason_build_up_intro';

export interface SpeedTemplate {
  id: SpeedTemplateId;
  title: string;
  label: string;
  durationMinutes: number;
  prescription: string;
  notes: string[];
}

export interface SpeedTemplateSelectionContext {
  seasonPhase?: SeasonPhase | null;
  offseasonSubphase?: OffseasonSubphase | null;
  weekNumber?: number | null;
  weekInBlock?: number | null;
  /**
   * Hold the progression on ACCELERATIONS rather than progressing to build-ups.
   *
   * Set from the athlete's stated weakness when it is Power & explosiveness (Sam's
   * ruling 0, 2026-07-30). Selection only — the exposure count is the contract's.
   */
  preferAcceleration?: boolean;
}

export const LATE_OFFSEASON_SPEED_TEMPLATES: readonly SpeedTemplate[] = [
  {
    id: 'late_offseason_low_risk_acceleration',
    title: 'Late Off-season Low-risk Acceleration',
    label: 'Low-risk Acceleration',
    durationMinutes: 12,
    prescription: '4-6 x 10-15m short hills or controlled accelerations, full walk-back rest',
    notes: [
      'Keep the reps crisp, not grindy.',
      'Use hills if flat sprinting feels too sharp.',
      'Stop before mechanics or speed drop.',
    ],
  },
  {
    id: 'late_offseason_acceleration_build',
    title: 'Late Off-season Acceleration Build',
    label: 'Acceleration Build',
    durationMinutes: 15,
    prescription: '4-6 x 10-20m accelerations, full walk-back rest',
    notes: [
      'Build speed smoothly over each rep.',
      'Full recovery between efforts.',
      'This is quality speed, not conditioning.',
    ],
  },
  {
    id: 'late_offseason_build_up_intro',
    title: 'Late Off-season Build-up Intro',
    label: 'Build-up Intro',
    durationMinutes: 18,
    prescription: '3-5 x 20-30m smooth build-ups, not all-out, full rest',
    notes: [
      'Smooth exposure only; do not chase max velocity yet.',
      'Rest long enough to keep every rep fast and relaxed.',
      'Stop if hamstrings, groin, calves, Achilles, knees or ankles feel off.',
    ],
  },
];

const TEMPLATE_BY_ID: Record<SpeedTemplateId, SpeedTemplate> = {
  late_offseason_low_risk_acceleration: LATE_OFFSEASON_SPEED_TEMPLATES[0],
  late_offseason_acceleration_build: LATE_OFFSEASON_SPEED_TEMPLATES[1],
  late_offseason_build_up_intro: LATE_OFFSEASON_SPEED_TEMPLATES[2],
};

export function selectLateOffseasonSpeedTemplate(
  context: SpeedTemplateSelectionContext,
): SpeedTemplate | null {
  if (context.seasonPhase !== 'Off-season') return null;
  if (context.offseasonSubphase !== 'late_offseason') return null;

  const latePosition = resolveLateOffseasonPosition(context);
  if (latePosition <= 1) return TEMPLATE_BY_ID.late_offseason_low_risk_acceleration;
  if (latePosition === 2) return TEMPLATE_BY_ID.late_offseason_acceleration_build;
  // ACCELERATIONS SPECIFICALLY, NOT TOP-SPEED (Sam's ruling 0, 2026-07-30).
  //
  // The progression's third step is the build-up — "smooth build-ups, not all-out" —
  // which is the move toward maximum velocity. An athlete whose stated weakness is
  // POWER & EXPLOSIVENESS holds on the acceleration build instead: his words were
  // "should focus more on power and accelerations", and this is the only place in the
  // app where accelerating and top-speed are a choice between two authored templates.
  //
  // Reading A holds — the same number of speed exposures, a different one of Sam's own
  // templates filling it. No count moves.
  if (context.preferAcceleration) return TEMPLATE_BY_ID.late_offseason_acceleration_build;
  return TEMPLATE_BY_ID.late_offseason_build_up_intro;
}

export function createLateOffseasonSpeedBlock(
  placement: SpeedBlockPlacement,
  context: SpeedTemplateSelectionContext,
): SpeedBlock | null {
  const template = selectLateOffseasonSpeedTemplate(context);
  if (!template) return null;

  return {
    id: `${template.id}-${placement}`,
    title: template.title,
    label: template.label,
    kind: 'true_speed',
    placement,
    durationMinutes: template.durationMinutes,
    prescription: template.prescription,
    notes: template.notes,
    counting: {
      hardExposure: true,
      mainStrength: false,
      conditioningCredit: 'none',
      createsHardDay: true,
      sprintCodExposure: true,
    },
  };
}

function resolveLateOffseasonPosition(context: SpeedTemplateSelectionContext): number {
  const weekNumber = positiveInteger(context.weekNumber);
  if (weekNumber) return Math.max(1, weekNumber - 3);

  const weekInBlock = positiveInteger(context.weekInBlock);
  if (weekInBlock) return Math.max(1, weekInBlock - 3);

  return 1;
}

function positiveInteger(value: number | null | undefined): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  const n = Math.floor(Number(value));
  return n > 0 ? n : undefined;
}
