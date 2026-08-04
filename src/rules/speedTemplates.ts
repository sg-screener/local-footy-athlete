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

export function createLateOffseasonSpeedBlock(
  placement: SpeedBlockPlacement,
  context: SpeedTemplateSelectionContext,
): SpeedBlock | null {
  const template = selectLateOffseasonSpeedTemplate(context);
  if (!template) return null;

  return {
    id: `late-offseason-${speedBlockIdSlug(template.name)}-${placement}`,
    title: template.name,
    label: template.name,
    kind: 'true_speed',
    placement,
    durationMinutes: templateDurationMinutes(template),
    prescription: templatePrescriptionLine(template),
    notes: [template.effortCue],
    templateName: template.name,
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
