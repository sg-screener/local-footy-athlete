import { CONDITIONING_TEMPLATES, type ConditioningModality, type ConditioningTemplate } from '../data/conditioningTemplates';
import type { ConditioningOption, Workout } from '../types/domain';

const TEMPLATE_BY_NAME = new Map(CONDITIONING_TEMPLATES.map((template) => [template.name, template]));

export function selectedConditioningModalities(
  modality: ConditioningOption['modality'],
  sequence?: ConditioningOption['modalitySequence'],
): ConditioningModality[] {
  if (!modality) return [];
  if (modality === 'mixed') return [...(sequence ?? [])];
  if (modality === 'running') return ['run'];
  if (modality === 'bike') return [sequence?.[0] === 'air_bike' ? 'air_bike' : 'bike'];
  return [modality];
}

export function templateSupportsSelectedModalities(
  template: ConditioningTemplate,
  selected: readonly ConditioningModality[],
): boolean {
  return selected.length > 0 && selected.every((mode) => template.permittedModalities.includes(mode));
}

/** Final acceptance boundary for every authored template/modality pairing. */
export function assertConditioningTemplateModalityCompatibility(workout: Partial<Workout>): void {
  for (const option of workout.conditioningBlock?.options ?? []) {
    const template = TEMPLATE_BY_NAME.get(option.title);
    if (!template) continue; // Athlete-authored conditioning is not one of the signed 55.
    const selected = selectedConditioningModalities(option.modality, option.modalitySequence);
    if (!templateSupportsSelectedModalities(template, selected)) {
      throw new Error(`conditioning_template_modality_incompatible:${template.name}:${selected.join('+') || 'missing'}:workout=${workout.name ?? workout.id ?? 'unknown'}:optional=${workout.composedOptionalKind ?? 'none'}`);
    }
  }

  if (workout.speedBlock?.templateName) {
    const template = TEMPLATE_BY_NAME.get(workout.speedBlock.templateName);
    if (!template) throw new Error(`conditioning_speed_template_unknown:${workout.speedBlock.templateName}`);
    const selected = workout.speedBlock.modality ? [workout.speedBlock.modality] : [];
    if (!templateSupportsSelectedModalities(template, selected)) {
      throw new Error(`conditioning_template_modality_incompatible:${template.name}:${selected[0] ?? 'missing'}`);
    }
  }
}

export function isTemplateIdentityModalityContractValid(template: ConditioningTemplate): boolean {
  // Retired rows may retain their historical modality contract so an old saved
  // session still reopens honestly. The bodyweight circuit is the one
  // modality-less legacy row.
  if (template.automaticSelection === 'retired' && template.permittedModalities.length === 0) return true;
  if (template.baseUnit === 'distance') {
    return template.permittedModalities.length === 1 && template.permittedModalities[0] === 'run';
  }
  if (/\bMAS\b/.test(template.name) || /\bRun\b/.test(template.name)) {
    return template.permittedModalities.length === 1 && template.permittedModalities[0] === 'run';
  }
  if (/\bAir Bike\b/.test(template.name)) {
    return template.permittedModalities.length === 1 && template.permittedModalities[0] === 'air_bike';
  }
  if (/\bErg\b/.test(template.name)) return !template.permittedModalities.includes('run');
  return template.permittedModalities.length > 0;
}
