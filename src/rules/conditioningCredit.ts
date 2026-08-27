/** R-261: exposure identity, not dose or display text. Pure and shared by
 * generation, the visible classifier and accepted-week reconstruction. */
import { CONDITIONING_TEMPLATES, type ConditioningTemplate } from '../data/conditioningTemplates';
import type { SpeedBlock, Workout } from '../types/domain';

const templates = new Map(CONDITIONING_TEMPLATES.map((template) => [template.name, template]));

export function speedTemplateConditioningCredit(template: ConditioningTemplate): 'full' | 'none' {
  return (template.quality === 'acceleration' || template.quality === 'top_end_speed' ||
    template.quality === 'repeat_sprint') &&
    !template.properties.includes('warmup_rider_only') &&
    !template.properties.includes('finisher_role_only') ? 'full' : 'none';
}

export function speedBlockConditioningCredit(block?: SpeedBlock | null): 'full' | 'none' {
  const template = block?.templateName ? templates.get(block.templateName) : undefined;
  // templateName is an authored catalog key, NOT the editable title. Older
  // blocks carried a derived `none` fence: re-read their typed source rather
  // than rewriting athlete history or guessing from minutes/name/row count.
  return block?.kind === 'true_speed' && template
    ? speedTemplateConditioningCredit(template) : 'none';
}

export function hasQualifyingSpeedConditioning(workout: Workout): boolean {
  return workout.composedOptionalKind !== 'primer' &&
    speedBlockConditioningCredit(workout.speedBlock) === 'full';
}

/** A second label/flag (or a second view of the same rows) earns nothing.
 * Equivalent choices in one conditioning block still represent ONE component. */
export function hasIndependentConditioningBlock(workout: Workout): boolean {
  const speedIds = new Set(workout.speedBlock?.exerciseIds ?? []);
  const rows = new Set((workout.exercises ?? []).map((row) => row.id));
  return !!workout.conditioningBlock?.options.some((option) =>
    option.exerciseIds.length > 0 &&
    option.exerciseIds.every((id) => rows.has(id) && !speedIds.has(id)));
}

/** The session gets one conditioning credit. A co-prescribed interval block
 * carries that credit; sprint keeps its separate speed quality underneath. */
export function speedOwnsConditioningCredit(workout: Workout): boolean {
  return hasQualifyingSpeedConditioning(workout) && !hasIndependentConditioningBlock(workout);
}
