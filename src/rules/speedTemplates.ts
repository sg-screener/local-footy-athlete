/**
 * Late off-season speed selection — over Sam's authored conditioning
 * templates (Stage B switchover, 2026-08-05).
 *
 * This module used to carry three speed doses of its own (`SpeedTemplate`
 * rows with free-text prescriptions). Those were pinned STAGE_B_DOOMED and
 * are gone: selection now picks an AUTHORED template from the signed sheet
 * and the block renders from it by name. The progression logic — which week
 * of the late off-season gets which exposure — is unchanged; it is selection
 * policy, and it was never the part that invented doses.
 */

import type {
  SeasonPhase,
  SpeedBlock,
  SpeedBlockPlacement,
} from '../types/domain';
import type { ConditioningTemplate } from '../data/conditioningTemplates';
import {
  lateOffseasonSpeedTemplateName,
  speedTemplateByName,
  templateDurationMinutes,
  templatePrescriptionLine,
} from './conditioningSelection';
import type { OffseasonSubphase } from './offseasonSubphase';
import { speedTemplateConditioningCredit } from './conditioningCredit';

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

/**
 * The one phase progression for automatic running Speed.
 *
 * The scheduler asks for qualities; this specialist names an authored row.
 * Weeks 1-4 have no automatic Speed and therefore never call this selector.
 * Phase weeks 5-8 alternate acceleration and longer progressive build-ups so
 * both are delivered without lengthening a session. Week 9 onward alternates
 * the two small flying exposures. Competitive phases alternate missing
 * qualities when both are genuinely absent.
 */
export function runningSpeedTemplatePreference(args: {
  readonly phase: SeasonPhase;
  readonly phaseWeekNumber?: number | null;
  readonly offseasonSubphase?: OffseasonSubphase | null;
  readonly requestedQualities: readonly ('acceleration' | 'top_end_speed')[];
}): string {
  const explicitPhaseWeek = positiveInteger(args.phaseWeekNumber);
  const phaseWeek = explicitPhaseWeek ?? 1;
  if (args.phase === 'Off-season') {
    if (explicitPhaseWeek === undefined) {
      if (args.offseasonSubphase === 'early_offseason') return '10 m Acceleration Reps';
      if (args.offseasonSubphase === 'mid_offseason') return '20 m Acceleration Reps';
      return 'Progressive Sprint Exposure';
    }
    if (phaseWeek <= 4) {
      return phaseWeek <= 2 ? '10 m Acceleration Reps' : '20 m Acceleration Reps';
    }
    if (phaseWeek <= 8) {
      return phaseWeek % 2 === 1
        ? '20 m Acceleration Reps'
        : 'Progressive Sprint Exposure';
    }
    return phaseWeek % 2 === 1 ? 'Fly 20 (20+20)' : 'Fly 30 (30+30)';
  }
  if (args.requestedQualities.length === 1) {
    return args.requestedQualities[0] === 'acceleration'
      ? '20 m Acceleration Reps'
      : phaseWeek % 2 === 1 ? 'Fly 20 (20+20)' : 'Fly 30 (30+30)';
  }
  return phaseWeek % 2 === 1 ? '20 m Acceleration Reps' : 'Fly 20 (20+20)';
}

/**
 * ACCELERATIONS SPECIFICALLY, NOT TOP-SPEED (Sam's ruling 0, 2026-07-30).
 *
 * The progression's third step is the reintroduction of flying work — the
 * move toward maximum velocity. An athlete whose stated weakness is POWER &
 * EXPLOSIVENESS holds on the acceleration exposure instead: his words were
 * "should focus more on power and accelerations", and this is the only place
 * in the app where accelerating and top-speed are a choice between two of
 * Sam's own templates. Reading A holds — same number of speed exposures, a
 * different authored template filling it. No count moves.
 */
export function selectLateOffseasonSpeedTemplate(
  context: SpeedTemplateSelectionContext,
): ConditioningTemplate | null {
  if (context.seasonPhase !== 'Off-season') return null;
  if (context.offseasonSubphase !== 'late_offseason') return null;

  const name = lateOffseasonSpeedTemplateName({
    position: resolveLateOffseasonPosition(context),
    preferAcceleration: context.preferAcceleration,
  });
  return speedTemplateByName(name);
}

function speedBlockIdSlug(templateName: string): string {
  return templateName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * ── THE ONE PLACE A `SpeedBlock` IS BUILT FROM AN AUTHORED TEMPLATE ────────
 *
 * **`Workout.speedBlock` IS THE CANONICAL SOURCE OF APP-AUTHORED SPRINT
 * CREDIT** — `validateGeneratedWeek.isTrueSpeedDay` reads `kind`, and §18
 * credits the block, not the rows. Visible sprint rows are not credit.
 *
 * ⚠ **A HAND-BUILT PARTIAL BLOCK IS WHY TWELVE WORLDS REFUSED.** WC-139's
 * pre-season component passed `{ templateName }` alone into the coaching plan;
 * `buildSpeedBlock` spreads the entry's block verbatim, so the assembled
 * workout carried `kind: undefined` and §18 scored `sprintNights: 0` on a week
 * whose sprint was authored, materialised and VISIBLE. Traced at the boundary:
 *
 *     [5 ASSEMBLED] Mon speedBlock=kind=undefined tmpl=10 m Acceleration Reps
 *     [6 LEDGER]    sprintNights=0 target=1 verdict=refused
 *
 * So the shape is built HERE and nowhere else, and every caller hands in a
 * template rather than assembling fields. Nothing invents a dose: the title,
 * duration, prescription and cue are all the authored template's.
 */
export function speedBlockForTemplate(
  template: ConditioningTemplate,
  placement: SpeedBlockPlacement,
  idPrefix = 'speed',
): SpeedBlock {
  const modality = template.permittedModalities.length === 1
    ? template.permittedModalities[0]
    : template.permittedModalities.includes('run') ? 'run' : template.permittedModalities[0];
  if (!modality) throw new Error(`speed_template_has_no_modality:${template.name}`);
  if (modality !== 'run') {
    throw new Error(`running_speed_template_must_run:${template.name}:${modality}`);
  }
  if (template.quality !== 'acceleration' && template.quality !== 'top_end_speed') {
    throw new Error(`running_speed_template_wrong_quality:${template.name}:${template.quality}`);
  }
  return {
    id: `${idPrefix}-${speedBlockIdSlug(template.name)}-${placement}`,
    title: template.name,
    label: template.name,
    kind: 'true_speed',
    placement,
    modality,
    durationMinutes: templateDurationMinutes(template),
    prescription: templatePrescriptionLine(template),
    notes: [template.effortCue],
    templateName: template.name,
    counting: {
      hardExposure: true,
      mainStrength: false,
      conditioningCredit: speedTemplateConditioningCredit(template),
      createsHardDay: true,
      sprintCodExposure: true,
    },
  };
}

export function createLateOffseasonSpeedBlock(
  placement: SpeedBlockPlacement,
  context: SpeedTemplateSelectionContext,
): SpeedBlock | null {
  const template = selectLateOffseasonSpeedTemplate(context);
  if (!template) return null;
  return speedBlockForTemplate(template, placement, 'late-offseason');
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
